#!/usr/bin/env node
/**
 * Pre-commit: ronda git index. Diam kalau sip. Teriak kalau bukan.
 * Fail closed — kalau node/git hilang, commit ditolak.
 * Pin npx sama dengan pasang: #v + package.json, bukan main.
 */
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NPX } from "../han.sip/pasang.mjs";

const execFileP = promisify(execFile);

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd });
    child.on("error", (err) => {
      console.error("han.sip hook:", err.message);
      resolve(2);
    });
    child.on("exit", (code) => resolve(code ?? 2));
  });
}

const { stdout } = await execFileP("git", ["rev-parse", "--show-toplevel"]);
const root = stdout.trim();
const localCli = path.join(root, "han.sip", "cli.mjs");

let code;
try {
  await access(localCli);
  code = await run(process.execPath, [localCli, "--staged", "--quiet"], root);
} catch {
  code = await run(
    "npx",
    ["--yes", NPX, "--", "--staged", "--quiet"],
    root,
  );
}

process.exit(code);
