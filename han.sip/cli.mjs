#!/usr/bin/env node
/**
 * han.sip — ronda malam untuk git.
 * One job: find secret-shaped files and strings before they reach GitHub.
 * Never prints the secret itself — only path, line, and kind.
 */
import { execFile } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  DEFAULT_BASELINE,
  printHuman,
  readBaseline,
  splitBaseline,
  toJson,
  toSarif,
  writeBaseline,
} from "./lapor.mjs";
import { pasang } from "./pasang.mjs";
import {
  loadIgnoreFile,
  scanDiff,
  scanFolder,
  scanStaged,
} from "./ronda.mjs";

const execFileP = promisify(execFile);
const VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

function help() {
  console.log(`han.sip ${VERSION} — ronda malam untuk git

Usage:
  han.sip [folder]              ronda folder (default .)
  han.sip --staged              ronda file di git index (pre-commit)
  han.sip --diff [ref]          ronda baris baru vs ref (default HEAD)
  han.sip --quiet               diam kalau sip; teriak kalau bukan
  han.sip --json                keluar JSON
  han.sip --sarif               keluar SARIF 2.1.0
  han.sip --ignore <pola>       skip path (bisa diulang)
  han.sip --baseline [file]     temuan diterima/di-suppress — bukan aman
  han.sip --write-baseline [file]  tulis fingerprint turunan (bukan plaintext)
  han.sip pasang                pre-commit di repo git ini
  han.sip pasang --check

npx --yes github:ganezha/kotak-kecil -- .
npx --yes github:ganezha/kotak-kecil -- pasang

.han.sipignore di root repo ikut dibaca. Pola: * dan **.
--staged --diff = hanya baris baru di index.

Exit:
  0  sip
  1  bukan sip (temuan baru)
  2  gagal jalan
`);
}

function takeVal(rest, a, flag, i) {
  const eq = `${flag}=`;
  if (a.startsWith(eq)) return { val: a.slice(eq.length), i };
  const n = rest[i + 1];
  if (n && !n.startsWith("-") && n !== ".") return { val: n, i: i + 1 };
  return { val: null, i };
}

export function parseArgs(argv) {
  const rest = argv.slice(2);
  const ignore = [];
  const positional = [];
  let staged = false;
  let quiet =
    process.env.HAN_SIP_QUIET === "1" || process.env.HAN_SIP_QUIET === "true";
  let json = false;
  let sarif = false;
  let diff = false;
  let diffRef = "HEAD";
  let baseline = null;
  let write = null;
  let check = false;

  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === "-h" || a === "--help") return { help: true };
    if (a === "--check") {
      check = true;
      continue;
    }
    if (a === "--staged") {
      staged = true;
      continue;
    }
    if (a === "--quiet") {
      quiet = true;
      continue;
    }
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--sarif") {
      sarif = true;
      continue;
    }
    if (a === "--diff" || a.startsWith("--diff=")) {
      diff = true;
      const t = takeVal(rest, a, "--diff", i);
      if (t.val) diffRef = t.val;
      i = t.i;
      continue;
    }
    if (a === "--ignore" || a.startsWith("--ignore=")) {
      const t = takeVal(rest, a, "--ignore", i);
      if (!t.val) throw new Error("--ignore butuh pola");
      ignore.push(t.val);
      i = t.i;
      continue;
    }
    if (a === "--baseline" || a.startsWith("--baseline=")) {
      const t = takeVal(rest, a, "--baseline", i);
      baseline = t.val || DEFAULT_BASELINE;
      i = t.i;
      continue;
    }
    if (a === "--write-baseline" || a.startsWith("--write-baseline=")) {
      const t = takeVal(rest, a, "--write-baseline", i);
      write = t.val || DEFAULT_BASELINE;
      i = t.i;
      continue;
    }
    if (a === "--") continue;
    if (a.startsWith("-")) throw new Error(`flag tidak dikenal: ${a}`);
    positional.push(a);
  }

  if (json && sarif) throw new Error("pilih --json atau --sarif");
  if (positional[0] === "pasang") {
    if (check && positional.length > 1) {
      /* ok */
    }
    return { help: false, command: "pasang", check };
  }
  if (check) throw new Error("--check hanya untuk pasang");
  return {
    help: false,
    command: "ronda",
    staged,
    quiet,
    json,
    sarif,
    diff,
    diffRef,
    ignore,
    baseline,
    writeBaseline: write,
    folder: positional[0] ?? ".",
  };
}

async function gitTop(cwd) {
  try {
    const { stdout } = await execFileP("git", ["rev-parse", "--show-toplevel"], {
      cwd,
    });
    return stdout.trim();
  } catch (err) {
    if (err && err.code === "ENOENT") throw new Error("git tidak ada di PATH");
    throw new Error("bukan git repo");
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    help();
    process.exit(0);
  }
  if (opts.command === "pasang") {
    await pasang({ check: opts.check });
    return;
  }

  const folder = path.resolve(opts.folder);
  let root = folder;
  if (opts.staged || opts.diff) {
    try {
      root = await gitTop(folder);
    } catch (err) {
      if (err.message === "git tidak ada di PATH") throw err;
      throw new Error(
        opts.diff
          ? "bukan git repo. --diff butuh .git"
          : "bukan git repo. --staged butuh .git",
      );
    }
  }

  let ignoreRoot = folder;
  try {
    ignoreRoot = await gitTop(folder);
  } catch {
    ignoreRoot = root;
  }
  const ignore = [...(await loadIgnoreFile(ignoreRoot)), ...opts.ignore];
  const scanOpts = { ignore };
  const pathFilter = path.relative(root, folder);

  let result;
  if (opts.diff) {
    result = await scanDiff(root, {
      ...scanOpts,
      ref: opts.diffRef,
      staged: opts.staged,
      pathFilter,
    });
  } else if (opts.staged) {
    result = await scanStaged(root, scanOpts);
  } else {
    result = await scanFolder(folder, scanOpts);
  }

  const allHits = result.hits;
  if (opts.writeBaseline) {
    const dest = path.resolve(opts.writeBaseline);
    await writeBaseline(dest, allHits);
  }

  let hits = allHits;
  let suppressed = 0;
  if (opts.baseline) {
    const b = await readBaseline(path.resolve(opts.baseline));
    const split = splitBaseline(allHits, b.fps);
    hits = split.hits;
    suppressed = split.suppressed;
  }

  const snapshotOnly = Boolean(opts.writeBaseline) && !opts.baseline;
  const reportHits = snapshotOnly ? [] : hits;
  const payload = {
    count: result.count,
    hits: reportHits,
    staged: opts.staged,
    diff: opts.diff ? opts.diffRef : false,
    quiet: opts.quiet,
    suppressed: snapshotOnly ? 0 : suppressed,
    baseline: opts.baseline,
    wrote: opts.writeBaseline ? path.resolve(opts.writeBaseline) : null,
    version: VERSION,
  };

  if (opts.json) {
    if (snapshotOnly) {
      payload.hits = allHits;
      payload.ok = true;
    }
    console.log(
      toJson({
        ...payload,
        hits: snapshotOnly ? allHits : reportHits,
        ok: snapshotOnly ? true : reportHits.length === 0,
      }).trimEnd(),
    );
    process.exit(snapshotOnly || reportHits.length === 0 ? 0 : 1);
  }

  if (opts.sarif) {
    console.log(
      toSarif({
        hits: snapshotOnly ? allHits : reportHits,
        version: VERSION,
      }).trimEnd(),
    );
    process.exit(snapshotOnly || reportHits.length === 0 ? 0 : 1);
  }

  if (snapshotOnly) {
    if (!opts.quiet) {
      console.log("han.sip");
      console.log(
        `baseline: ${opts.writeBaseline} (${allHits.length} temuan). Diterima, bukan aman.`,
      );
    }
    process.exit(0);
  }

  process.exit(printHuman(payload));
}

function isCliEntry() {
  const arg = process.argv[1];
  if (!arg) return false;
  let resolved = arg;
  try {
    resolved = realpathSync(arg);
  } catch {
    /* npm bin is often a symlink */
  }
  try {
    return (
      import.meta.url === pathToFileURL(resolved).href ||
      import.meta.url === pathToFileURL(arg).href
    );
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  main().catch((err) => {
    console.error("han.sip gagal:", err.message);
    process.exit(2);
  });
}
