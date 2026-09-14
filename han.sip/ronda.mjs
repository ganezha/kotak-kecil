/**
 * Inti ronda: aturan file + isi. Tidak mencetak secret.
 * cli.mjs yang bicara ke manusia / mesin.
 */
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, readFile, stat } from "node:fs/promises";
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
export const STREAM_CHUNK = 64 * 1024;
const LINE_WINDOW = 64 * 1024;
const LINE_OVERLAP = 2048;
export const GENERIC_MIN_CONF = 0.6;

export const FILE_RULES = [
  { kind: "env-file", test: (name) => name === ".env" || name.startsWith(".env.") },
  { kind: "key-file", test: (name) => /\.(p12|pfx)$/i.test(name) },
  { kind: "private-file", test: (name) => name.toLowerCase() === "private.txt" },
  {
    kind: "ssh-key-file",
    test: (name) => /^(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i.test(name),
  },
];

const PEM_OR_KEY = /\.(pem|key)$/i;
const PUBLIC_CERT = /-----BEGIN CERTIFICATE-----/;
const AWS_SECRET_RE = /(?<![A-Za-z0-9/+])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/;
const AWS_NEAR_RE = /AKIA[0-9A-Z]{16}|AWS_SECRET|aws_secret_access_key/i;
const SEED_CTX_RE = /\b(?:seed|mnemonic|recovery|wallet)\b/i;
const SEED_RUN_RE = /\b[a-z]+(?:\s+[a-z]+){11}(?:(?:\s+[a-z]+){12})?\b/;
const KW_RE =
  /\b(?:secret|password|passwd|token|api[_-]?key|access[_-]?key|private[_-]?key|credential|auth(?:orization)?|bearer)\b/i;
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const GENERIC_CAND_RE = /[A-Za-z0-9_+-]{24,}/g;

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
  // sk-ant- sebelum sk- generik, supaya bukan openai-key. Span dobel dilewati scanLine.
  { kind: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { kind: "openai-key", re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { kind: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { kind: "npm-token", re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { kind: "gitlab-pat", re: /\bglpat-[A-Za-z0-9_-]{20,}/ },
  { kind: "huggingface-token", re: /\bhf_[A-Za-z0-9]{20,}/ },
];

const PRIVATE_KEY_RE = CONTENT_RULES.find((r) => r.kind === "private-key").re;

/** Nama template. Bukan temuan env-file. Isi tetap dironda. */
export const isExampleEnv = (name) => name === ".env.example";

export const IGNORE_FILE = ".han.sipignore";

export function posixPath(p) {
  return String(p).split(path.sep).join("/");
}

/**
 * Fingerprint turunan, bukan plaintext token.
 *
 * sha256(kind || NUL || posix(file) || NUL || matched_piece)
 *   fp     = 32 hex (128 bit) — identitas baseline / unik
 *   sha256 = 64 hex (penuh)
 * `piece` adalah potongan yang cocok rule (bisa material secret).
 * Satu arah. Bukan credential. Tetap bukti string berbentuk secret ada di path itu.
 */
export const FP_HEX = 32;
export const SHA256_HEX = 64;

export function fingerprint256(kind, file, piece = "") {
  const h = createHash("sha256");
  h.update(kind);
  h.update("\0");
  h.update(posixPath(file));
  h.update("\0");
  h.update(piece);
  return h.digest("hex");
}

export function fingerprint(kind, file, piece = "") {
  return fingerprint256(kind, file, piece).slice(0, FP_HEX);
}

export function shannon(s) {
  if (!s) return 0;
  const freq = new Map();
  for (const ch of s) freq.set(ch, (freq.get(ch) || 0) + 1);
  let h = 0;
  const n = s.length;
  for (const c of freq.values()) {
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Skor 0–1. Di bawah GENERIC_MIN_CONF tidak teriak. */
export function genericConfidence(piece, { keyword = false, jwt = false } = {}) {
  if (!piece || piece.length < 24) return 0;
  if (/^https?:\/\//i.test(piece)) return 0;
  if (/^sha[0-9]+-/i.test(piece)) return 0;
  if (/^(?:true|false|null|undefined)$/i.test(piece)) return 0;
  const ent = shannon(piece);
  let c = 0;
  if (jwt) c += 0.55;
  if (keyword) c += 0.4;
  if (ent >= 4.5) c += 0.35;
  else if (ent >= 3.7) c += 0.2;
  else if (ent >= 3.2) c += 0.08;
  if (piece.length >= 40) c += 0.1;
  if ((keyword || jwt) && piece.length >= 48 && ent >= 4.7) c += 0.25;
  if (/^[a-f0-9]+$/i.test(piece) && (piece.length === 40 || piece.length === 64)) {
    c -= 0.55;
  }
  if (c > 1) c = 1;
  if (c < 0) c = 0;
  return Math.round(c * 100) / 100;
}

function pushHit(hits, file, line, kind, piece = "", conf) {
  const sha256 = fingerprint256(kind, file, piece);
  const hit = {
    file,
    line,
    kind,
    fp: sha256.slice(0, FP_HEX),
    sha256,
  };
  if (conf != null) hit.conf = conf;
  hits.push(hit);
}

let activeContent = null;
let activeFile = null;

/** Plugin / tes. null = builtin. */
export function setRules(next) {
  activeContent = next?.content ?? null;
  activeFile = next?.file ?? null;
}

function contentRules() {
  return activeContent || CONTENT_RULES;
}

function fileRules() {
  return activeFile || FILE_RULES;
}

function globRe(pattern) {
  let out = "^";
  let i = 0;
  while (i < pattern.length) {
    if (pattern.startsWith("**/", i)) {
      out += "(?:.*/)?";
      i += 3;
      continue;
    }
    if (pattern.startsWith("**", i)) {
      out += ".*";
      i += 2;
      continue;
    }
    const ch = pattern[i];
    if (ch === "*") out += "[^/]*";
    else if (ch === "?") out += "[^/]";
    else if ("\\.[]{}()+-^$|".includes(ch)) out += `\\${ch}`;
    else out += ch;
    i += 1;
  }
  return new RegExp(`${out}$`);
}

/** gitignore-lite. Pola tanpa `/` mencocok nama file di path mana pun. */
export function matchGlob(rel, pattern) {
  const s = posixPath(rel).replace(/^\.\//, "");
  let p = posixPath(pattern).replace(/^\.\//, "").replace(/^\/+/, "");
  if (!p) return false;
  const dirOnly = p.endsWith("/");
  if (dirOnly) p = p.slice(0, -1);
  if (dirOnly) return s === p || s.startsWith(`${p}/`);
  if (globRe(p).test(s)) return true;
  if (!p.includes("/")) {
    const base = s.slice(s.lastIndexOf("/") + 1);
    if (globRe(p).test(base)) return true;
    if (globRe(`**/${p}`).test(s)) return true;
  }
  return false;
}

export function parseIgnore(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

export function isIgnored(rel, patterns) {
  if (!patterns?.length) return false;
  return patterns.some((p) => matchGlob(rel, p));
}

export async function loadIgnoreFile(root) {
  try {
    const text = await readFile(path.join(root, IGNORE_FILE), "utf8");
    return parseIgnore(text);
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
}

export async function walk(dir, files) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.has(entry.name)) await walk(full, files);
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

export function scanName(relFile, hits) {
  const name = path.basename(relFile);
  if (isExampleEnv(name)) return;
  for (const rule of fileRules()) {
    if (rule.test(name)) pushHit(hits, relFile, 0, rule.kind);
  }
}

/**
 * *.pem / *.key: nama = sinyal lemah.
 * key-file hanya jika kosong/tidak terbaca.
 * BEGIN PRIVATE KEY → private-key (isi), jangan dobel.
 * BEGIN CERTIFICATE → bukan temuan.
 */
function considerKeyFile(relFile, hits, { text, empty = false, unreadable = false, sawPrivate = false, sawCert = false } = {}) {
  if (!PEM_OR_KEY.test(path.basename(relFile))) return;
  if (empty || unreadable || text == null || text.includes("\u0000")) {
    pushHit(hits, relFile, 0, "key-file");
    return;
  }
  if (sawPrivate || PRIVATE_KEY_RE.test(text)) return;
  if (sawCert || PUBLIC_CERT.test(text)) return;
}

function scanAwsSecret(relFile, line, text, near, hits) {
  if (!AWS_NEAR_RE.test(near)) return;
  const m = AWS_SECRET_RE.exec(text);
  if (!m) return;
  pushHit(hits, relFile, line, "aws-secret", m[0]);
}

function scanSeedPhrase(relFile, line, text, near, hits) {
  const m = text.match(SEED_RUN_RE);
  if (!m) return;
  const n = m[0].split(/\s+/).length;
  if (n !== 12 && n !== 24) return;
  if (!SEED_CTX_RE.test(near)) return;
  pushHit(hits, relFile, line, "seed-phrase", m[0]);
}

export function scanContent(relFile, text, hits) {
  if (text == null) return;
  if (text.includes("\u0000")) return;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const prev = i > 0 ? lines[i - 1] : "";
    const next = i + 1 < lines.length ? lines[i + 1] : "";
    scanLine(relFile, i + 1, lines[i], hits, { prev, next });
  }
}

export function scanLine(relFile, line, text, hits, nearby = {}) {
  if (text == null || text.includes("\u0000")) return;
  const caught = [];
  for (const rule of contentRules()) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const a = m.index;
    const b = a + m[0].length;
    if (caught.some((s) => a < s.b && b > s.a)) continue;
    caught.push({ a, b });
    pushHit(hits, relFile, line, rule.kind, m[0]);
  }
  const near = [nearby.prev, text, nearby.next].filter(Boolean).join("\n") || text;
  scanAwsSecret(relFile, line, text, near, hits);
  scanSeedPhrase(relFile, line, text, near, hits);
  scanGeneric(relFile, line, text, hits, caught);
}

function scanGeneric(relFile, line, text, hits, caught) {
  const keyword = KW_RE.test(text);
  JWT_RE.lastIndex = 0;
  GENERIC_CAND_RE.lastIndex = 0;
  for (const spec of [
    { re: JWT_RE, jwt: true },
    { re: GENERIC_CAND_RE, jwt: false },
  ]) {
    spec.re.lastIndex = 0;
    let m;
    while ((m = spec.re.exec(text))) {
      const a = m.index;
      const b = a + m[0].length;
      if (caught.some((s) => a < s.b && b > s.a)) continue;
      const conf = genericConfidence(m[0], { keyword, jwt: spec.jwt });
      if (conf < GENERIC_MIN_CONF) continue;
      caught.push({ a, b });
      pushHit(hits, relFile, line, "generic-secret", m[0], conf);
    }
  }
}

export function scanText(relFile, text, hits) {
  scanName(relFile, hits);
  considerKeyFile(relFile, hits, { text, empty: text === "" });
  scanContent(relFile, text, hits);
}

export function uniqueHits(hits) {
  const out = [];
  const seen = new Set();
  for (const hit of hits) {
    const key = hit.fp || `${hit.file}:${hit.line}:${hit.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

function notePem(text, pem) {
  if (PRIVATE_KEY_RE.test(text)) pem.priv = true;
  if (PUBLIC_CERT.test(text)) pem.cert = true;
}

function emitStreamLine(relFile, lineNo, text, prev, next, hits, pem) {
  scanLine(relFile, lineNo, text, hits, { prev, next });
  notePem(text, pem);
}

/**
 * Isi file besar: chunk, bukan Buffer utuh.
 * Baris ditahan satu langkah supaya prev/next ada.
 * Baris raksasa tanpa newline dipecah jendela + overlap.
 */
export async function scanBufferStream(relFile, readable, hits) {
  let pending = "";
  let prevComplete = "";
  let hold = null;
  let lineNo = 1;
  let binary = false;
  const pem = { priv: false, cert: false };

  const emitHeld = (nextText) => {
    if (!hold) return;
    emitStreamLine(relFile, hold.lineNo, hold.text, hold.prev, nextText, hits, pem);
    hold = null;
  };

  const pushCompleteLine = (text) => {
    emitHeld(text);
    hold = { lineNo, text, prev: prevComplete };
    prevComplete = text;
    lineNo += 1;
  };

  const windowHuge = () => {
    while (pending.length > LINE_WINDOW) {
      const slice = pending.slice(0, LINE_WINDOW);
      emitHeld("");
      emitStreamLine(relFile, lineNo, slice, prevComplete, "", hits, pem);
      pending = pending.slice(LINE_WINDOW - LINE_OVERLAP);
      prevComplete = "";
    }
  };

  for await (const chunk of readable) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (buf.includes(0)) {
      binary = true;
      break;
    }
    pending += buf.toString("utf8");
    if (pending.includes("\u0000")) {
      binary = true;
      break;
    }
    for (;;) {
      const crlf = pending.indexOf("\r\n");
      const lf = pending.indexOf("\n");
      const cr = pending.indexOf("\r");
      let idx = -1;
      let skip = 1;
      if (crlf !== -1 && (lf === -1 || crlf <= lf) && (cr === -1 || crlf <= cr)) {
        idx = crlf;
        skip = 2;
      } else if (lf !== -1 && (cr === -1 || lf <= cr)) {
        idx = lf;
      } else if (cr !== -1) {
        idx = cr;
      }
      if (idx === -1) break;
      pushCompleteLine(pending.slice(0, idx));
      pending = pending.slice(idx + skip);
    }
    windowHuge();
  }

  if (binary) {
    considerKeyFile(relFile, hits, { unreadable: true });
    return;
  }
  if (pending.length) pushCompleteLine(pending);
  emitHeld("");
  considerKeyFile(relFile, hits, {
    text: "ok",
    sawPrivate: pem.priv,
    sawCert: pem.cert,
  });
}

export async function scanFileStream(absPath, relFile, hits) {
  const stream = createReadStream(absPath, { highWaterMark: STREAM_CHUNK });
  try {
    await scanBufferStream(relFile, stream, hits);
  } finally {
    stream.destroy();
  }
}

export async function scanStagedStream(root, relPath, hits) {
  const child = spawn("git", ["show", `:${relPath}`], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const err = [];
  child.stderr.on("data", (d) => err.push(d));
  let scanErr;
  try {
    await scanBufferStream(relPath, child.stdout, hits);
  } catch (e) {
    scanErr = e;
    child.kill();
  }
  const code = await new Promise((resolve) => {
    child.on("close", resolve);
  });
  if (scanErr) throw scanErr;
  if (code !== 0) {
    throw new Error(Buffer.concat(err).toString("utf8") || "git show gagal");
  }
}

export async function scanFolder(root, { ignore = [] } = {}) {
  const files = [];
  await walk(root, files);
  const hits = [];
  let count = 0;
  for (const file of files) {
    const shown = path.relative(root, file) || file;
    if (isIgnored(shown, ignore)) continue;
    count += 1;
    scanName(shown, hits);
    let lst;
    try {
      lst = await lstat(file);
    } catch {
      considerKeyFile(shown, hits, { unreadable: true });
      continue;
    }
    if (lst.isSymbolicLink()) continue;
    let info;
    try {
      info = await stat(file);
    } catch {
      considerKeyFile(shown, hits, { unreadable: true });
      continue;
    }
    if (info.size === 0) {
      considerKeyFile(shown, hits, { empty: true });
      continue;
    }
    if (info.size > MAX_BYTES) {
      await scanFileStream(file, shown, hits);
      continue;
    }
    let text;
    try {
      text = await readFile(file, "utf8");
    } catch {
      considerKeyFile(shown, hits, { unreadable: true });
      continue;
    }
    if (text.includes("\u0000")) {
      considerKeyFile(shown, hits, { unreadable: true });
      continue;
    }
    considerKeyFile(shown, hits, { text });
    scanContent(shown, text, hits);
  }
  return { count, hits: uniqueHits(hits) };
}

export async function scanStaged(root, { ignore = [] } = {}) {
  const rels = await listStaged(root);
  const hits = [];
  let count = 0;
  for (const relFile of rels) {
    const name = path.basename(relFile);
    if (SKIP_EXT.has(path.extname(name).toLowerCase())) continue;
    if (isIgnored(relFile, ignore)) continue;
    count += 1;
    scanName(relFile, hits);
    let size;
    try {
      const { stdout } = await execFileP(
        "git",
        ["cat-file", "-s", `:${relFile}`],
        { cwd: root },
      );
      size = Number(stdout.trim());
    } catch {
      considerKeyFile(relFile, hits, { unreadable: true });
      continue;
    }
    if (!size) {
      considerKeyFile(relFile, hits, { empty: true });
      continue;
    }
    if (size > MAX_BYTES) {
      await scanStagedStream(root, relFile, hits);
      continue;
    }
    let buf;
    try {
      buf = await readStaged(root, relFile);
    } catch {
      considerKeyFile(relFile, hits, { unreadable: true });
      continue;
    }
    if (!buf.length) {
      considerKeyFile(relFile, hits, { empty: true });
      continue;
    }
    if (buf.includes(0)) {
      considerKeyFile(relFile, hits, { unreadable: true });
      continue;
    }
    const text = buf.toString("utf8");
    considerKeyFile(relFile, hits, { text });
    scanContent(relFile, text, hits);
  }
  return { count, hits: uniqueHits(hits) };
}

function unquoteGitPath(p) {
  let s = String(p ?? "").trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (s.startsWith("b/")) s = s.slice(2);
  return s;
}

/** Parse `git diff -U0`. Hanya baris `+`. Input rusak → hasil parsial, tidak throw. */
export function parseUnifiedDiff(text) {
  const files = [];
  let cur = null;
  let newLine = 0;
  const src = text == null ? "" : String(text);
  for (const line of src.split(/\r?\n/)) {
    const raw = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (raw.startsWith("diff --git ")) {
      cur = { file: "", added: [], isNew: false };
      files.push(cur);
      const mid = raw.lastIndexOf(" b/");
      if (mid !== -1) cur.file = unquoteGitPath(raw.slice(mid + 1));
      continue;
    }
    if (!cur) continue;
    if (raw.startsWith("new file ")) cur.isNew = true;
    if (raw.startsWith("+++ ")) {
      const p = raw.slice(4).trim();
      if (p === "/dev/null") {
        cur.file = "";
        continue;
      }
      cur.file = unquoteGitPath(p);
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      const n = Number(hunk[1]);
      newLine = Number.isFinite(n) ? n : 0;
      continue;
    }
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      cur.added.push({ line: newLine, text: raw.slice(1) });
      newLine += 1;
      continue;
    }
  }
  return files.filter((f) => f.file);
}

export async function scanDiff(
  root,
  { ignore = [], ref = "HEAD", staged = false, pathFilter = "" } = {},
) {
  const args = [
    "diff",
    "--unified=0",
    "--no-color",
    "--no-ext-diff",
    "--diff-filter=ACMR",
  ];
  if (staged) args.push("--cached");
  args.push(ref);
  if (pathFilter && pathFilter !== ".") args.push("--", pathFilter);

  let stdout;
  try {
    ({ stdout } = await execFileP("git", args, {
      cwd: root,
      maxBuffer: 10 * 1024 * 1024,
    }));
  } catch (err) {
    if (err && err.code === "ENOENT") throw new Error("git tidak ada di PATH");
    const msg = String(err?.stderr || err?.message || "");
    if (/bad revision|unknown revision|ambiguous argument|Needed a single revision/i.test(msg)) {
      throw new Error(`ref tidak ada: ${ref}`);
    }
    if (/not a git repository/i.test(msg)) {
      throw new Error("bukan git repo. --diff butuh .git");
    }
    throw new Error("bukan git repo. --diff butuh .git");
  }

  const files = parseUnifiedDiff(stdout);
  const hits = [];
  let count = 0;
  for (const file of files) {
    const relFile = posixPath(file.file);
    const name = path.basename(relFile);
    if (SKIP_EXT.has(path.extname(name).toLowerCase())) continue;
    if (isIgnored(relFile, ignore)) continue;
    count += 1;
    scanName(relFile, hits);
    const addedText = file.added.map((row) => row.text).join("\n");
    considerKeyFile(relFile, hits, {
      text: addedText,
      empty: file.isNew && addedText.length === 0,
    });
    for (let i = 0; i < file.added.length; i += 1) {
      const row = file.added[i];
      const prev = file.added[i - 1]?.line === row.line - 1 ? file.added[i - 1].text : "";
      const next = file.added[i + 1]?.line === row.line + 1 ? file.added[i + 1].text : "";
      scanLine(relFile, row.line, row.text, hits, { prev, next });
    }
  }
  return { count, hits: uniqueHits(hits) };
}
