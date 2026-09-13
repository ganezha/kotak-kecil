#!/usr/bin/env node
/**
 * han.sip — ronda malam untuk git.
 * One job: find secret-shaped files and strings before they reach GitHub.
 * Never prints the secret itself — only path, line, and kind.
 */
import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

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
  han.sip [folder]      ronda folder (default .)
  han.sip --staged      ronda file di git index (pre-commit)

Exit:
  0  sip
  1  bukan sip (temuan)
`);
}

function parseArgs(argv) {
  const rest = argv.slice(2);
  if (rest.includes("-h") || rest.includes("--help")) return { help: true };
  return {
    help: false,
    staged: rest.includes("--staged"),
    folder: rest.find((a) => !a.startsWith("-")) ?? ".",
  };
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

async function listStaged(root) {
  let stdout;
  try {
    ({ stdout } = await execFileP(
      "git",
      ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"],
      { cwd: root, maxBuffer: 10 * 1024 * 1024 },
    ));
  } catch (err) {
    if (err.code === "ENOENT") throw new Error("git tidak ada di PATH");
    throw new Error("bukan git repo. --staged butuh .git");
  }
  return stdout.split("\0").filter(Boolean);
}

async function readStaged(root, relPath) {
  const { stdout } = await execFileP("git", ["show", `:${relPath}`], {
    cwd: root,
    encoding: "buffer",
    maxBuffer: MAX_BYTES + 2048,
  });
  return stdout;
}

function scanText(relFile, text, hits) {
  const name = path.basename(relFile);
  if (ALLOW_FILE(name)) return;
  for (const rule of FILE_RULES) {
    if (rule.test(name)) hits.push({ file: relFile, line: 0, kind: rule.kind });
  }
  if (text == null) return;
  if (text.includes("\u0000")) return;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    for (const rule of CONTENT_RULES) {
      if (rule.re.test(lines[i])) {
        hits.push({ file: relFile, line: i + 1, kind: rule.kind });
      }
    }
  }
}

function uniqueHits(hits) {
  const out = [];
  const seen = new Set();
  for (const hit of hits) {
    const key = `${hit.file}:${hit.line}:${hit.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

async function scanFolder(root) {
  const files = [];
  await walk(root, files);
  const hits = [];
  for (const file of files) {
    const name = path.basename(file);
    if (ALLOW_FILE(name)) continue;
    const shown = path.relative(root, file) || file;
    for (const rule of FILE_RULES) {
      if (rule.test(name)) hits.push({ file: shown, line: 0, kind: rule.kind });
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
    scanText(shown, text.includes("\u0000") ? "\u0000" : text, hits);
  }
  return { count: files.length, hits: uniqueHits(hits) };
}

async function scanStaged(root) {
  const rels = await listStaged(root);
  const hits = [];
  let count = 0;
  for (const relFile of rels) {
    const name = path.basename(relFile);
    if (SKIP_EXT.has(path.extname(name).toLowerCase())) continue;
    count += 1;
    if (ALLOW_FILE(name)) continue;
    for (const rule of FILE_RULES) {
      if (rule.test(name)) hits.push({ file: relFile, line: 0, kind: rule.kind });
    }
    let buf;
    try {
      buf = await readStaged(root, relFile);
    } catch {
      continue;
    }
    if (!buf.length || buf.length > MAX_BYTES) continue;
    const text = buf.includes(0) ? "\u0000" : buf.toString("utf8");
    scanText(relFile, text, hits);
  }
  return { count, hits: uniqueHits(hits) };
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    help();
    process.exit(0);
  }

  const root = path.resolve(opts.folder);
  const { count, hits } = opts.staged
    ? await scanStaged(root)
    : await scanFolder(root);

  console.log("han.sip");
  console.log(`ronda: ${count} file${opts.staged ? " (staged)" : ""}`);

  if (hits.length === 0) {
    console.log("sip.");
    process.exit(0);
  }

  console.log("");
  for (const hit of hits) {
    const where = hit.line ? `${hit.file}:${hit.line}` : hit.file;
    console.log(`! ${hit.kind.padEnd(16)} ${where}`);
  }
  console.log("");
  console.log(`bukan sip. ${hits.length} temuan.`);
  console.log("Kalau ini pernah masuk git: rotate dulu. Hapus file tidak cukup.");
  process.exit(1);
}

main().catch((err) => {
  console.error("han.sip gagal:", err.message);
  process.exit(2);
});
