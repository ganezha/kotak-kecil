#!/usr/bin/env node
/**
 * han.sip — ronda malam untuk git.
 * One job: find secret-shaped files and strings before they reach GitHub.
 * Never prints the secret itself — only path, line, and kind.
 */
import path from "node:path";
import { scanFolder, scanStaged } from "./ronda.mjs";

function help() {
  console.log(`han.sip — ronda malam untuk git

Usage:
  han.sip [folder]      ronda folder (default .)
  han.sip --staged      ronda file di git index (pre-commit)
  han.sip --quiet       diam kalau sip; teriak kalau bukan

Exit:
  0  sip
  1  bukan sip (temuan)
`);
}

function parseArgs(argv) {
  const rest = argv.slice(2);
  if (rest.includes("-h") || rest.includes("--help")) return { help: true };
  const quiet =
    rest.includes("--quiet") ||
    process.env.HAN_SIP_QUIET === "1" ||
    process.env.HAN_SIP_QUIET === "true";
  return {
    help: false,
    staged: rest.includes("--staged"),
    quiet,
    folder: rest.find((a) => !a.startsWith("-")) ?? ".",
  };
}

function report({ count, hits, staged, quiet }) {
  if (hits.length === 0) {
    if (!quiet) {
      console.log("han.sip");
      console.log(`ronda: ${count} file${staged ? " (staged)" : ""}`);
      console.log("sip.");
    }
    process.exit(0);
  }

  console.log("han.sip");
  if (!quiet) console.log(`ronda: ${count} file${staged ? " (staged)" : ""}`);
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

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    help();
    process.exit(0);
  }

  const root = path.resolve(opts.folder);
  const result = opts.staged ? await scanStaged(root) : await scanFolder(root);
  report({ ...result, staged: opts.staged, quiet: opts.quiet });
}

main().catch((err) => {
  console.error("han.sip gagal:", err.message);
  process.exit(2);
});
