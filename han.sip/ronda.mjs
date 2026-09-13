/**
 * Inti ronda: aturan file + isi. Tidak mencetak secret.
 * cli.mjs yang bicara ke manusia.
 */
import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export const SKIP_DIR = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".out",
]);

export const SKIP_EXT = new Set([
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

export const MAX_BYTES = 512 * 1024;

export const FILE_RULES = [
  { kind: "env-file", test: (name) => name === ".env" || name.startsWith(".env.") },
  { kind: "key-file", test: (name) => /\.(pem|key|p12|pfx)$/i.test(name) },
  { kind: "private-file", test: (name) => name.toLowerCase() === "private.txt" },
  {
    kind: "ssh-key-file",
    test: (name) => /^(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i.test(name),
  },
];

export const CONTENT_RULES = [
  {
    kind: "private-key",
    re: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY-----/,
  },
  { kind: "github-token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}/ },
  { kind: "github-pat", re: /\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { kind: "telegram-token", re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { kind: "aws-key-id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { kind: "stripe-key", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { kind: "openai-key", re: /\bsk-(?:proj-|svcacct-)[A-Za-z0-9_-]{20,}/ },
  { kind: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { kind: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { kind: "npm-token", re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { kind: "gitlab-pat", re: /\bglpat-[A-Za-z0-9_-]{20,}/ },
  { kind: "huggingface-token", re: /\bhf_[A-Za-z0-9]{20,}/ },
];

export const ALLOW_FILE = (name) => name === ".env.example";

export async function walk(dir, files) {
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

export async function listStaged(root) {
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

export async function readStaged(root, relPath) {
  const { stdout } = await execFileP("git", ["show", `:${relPath}`], {
    cwd: root,
    encoding: "buffer",
    maxBuffer: MAX_BYTES + 2048,
  });
  return stdout;
}

export function scanText(relFile, text, hits) {
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

export function uniqueHits(hits) {
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

export async function scanFolder(root) {
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

export async function scanStaged(root) {
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
