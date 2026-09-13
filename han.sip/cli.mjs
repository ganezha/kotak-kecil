#!/usr/bin/env node
/**
 * han.sip — ronda malam untuk git.
 * One job: find secret-shaped files and strings before they reach GitHub.
 * Never prints the secret itself — only path, line, and kind.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const SKIP_DIR = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".out",
]);

const SKIP_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".woff",
  ".woff2",
  ".ttf",
]);

const MAX_BYTES = 512 * 1024;

const FILE_RULES = [
  { kind: "env-file", test: (name) => name === ".env" || name.startsWith(".env.") },
  { kind: "key-file", test: (name) => /\.(pem|key|p12|pfx)$/i.test(name) },
  { kind: "private-file", test: (name) => name.toLowerCase() === "private.txt" },
];

const CONTENT_RULES = [
  {
    kind: "private-key",
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  { kind: "github-token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}/ },
  { kind: "telegram-token", re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { kind: "aws-key-id", re: /\bAKIA[0-9A-Z]{16}\b/ },
];

const ALLOW_FILE = (name) => name === ".env.example";

function help() {
  console.log(`han.sip — ronda malam untuk git

Usage:
  han.sip [folder]

Exit:
  0  sip
  1  bukan sip (temuan)
`);
}

async function walk(dir, files) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.has(entry.name) && !entry.name.startsWith(".")) {
        await walk(full, files);
      } else if (entry.name === ".github") {
        await walk(full, files);
      }
      continue;
    }
    if (!entry.isFile()) continue;
    if (SKIP_EXT.has(path.extname(entry.name).toLowerCase())) continue;
    files.push(full);
  }
}

function rel(root, file) {
  return path.relative(root, file) || file;
}

async function main() {
  const arg = process.argv[2];
  if (arg === "-h" || arg === "--help") {
    help();
    process.exit(0);
  }

  const root = path.resolve(arg ?? ".");
  const files = [];
  await walk(root, files);

  const hits = [];

  for (const file of files) {
    const name = path.basename(file);
    if (ALLOW_FILE(name)) continue;

    for (const rule of FILE_RULES) {
      if (rule.test(name)) {
        hits.push({ file: rel(root, file), line: 0, kind: rule.kind });
      }
    }

    let info;
    try {
      info = await stat(file);
    } catch {
      continue;
    }
    if (info.size === 0 || info.size > MAX_BYTES) continue;

    let text;
    try {
      text = await readFile(file, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\u0000")) continue;

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      for (const rule of CONTENT_RULES) {
        if (rule.re.test(lines[i])) {
          hits.push({ file: rel(root, file), line: i + 1, kind: rule.kind });
        }
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const hit of hits) {
    const key = `${hit.file}:${hit.line}:${hit.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(hit);
  }

  console.log("han.sip");
  console.log(`ronda: ${files.length} file`);

  if (unique.length === 0) {
    console.log("sip.");
    process.exit(0);
  }

  console.log("");
  for (const hit of unique) {
    const where = hit.line ? `${hit.file}:${hit.line}` : hit.file;
    console.log(`! ${hit.kind.padEnd(16)} ${where}`);
  }
  console.log("");
  console.log(`bukan sip. ${unique.length} temuan.`);
  console.log("Kalau ini pernah masuk git: rotate dulu. Hapus file tidak cukup.");
  process.exit(1);
}

main().catch((err) => {
  console.error("han.sip gagal:", err.message);
  process.exit(2);
});
