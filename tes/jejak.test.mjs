import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileP = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "jejak", "cli.mjs");

function runCli(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function stamp(offsetDays) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00`;
}

async function gitInit(dir) {
  await execFileP("git", ["init"], { cwd: dir });
  await execFileP("git", ["config", "user.name", "tes"], { cwd: dir });
  await execFileP("git", ["config", "user.email", "tes@example.com"], {
    cwd: dir,
  });
}

async function commitAt(dir, name, offsetDays) {
  const when = stamp(offsetDays);
  await writeFile(path.join(dir, name), `${when}\n`);
  await execFileP("git", ["add", "--", name], { cwd: dir });
  await execFileP("git", ["commit", "-m", name], {
    cwd: dir,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: when,
      GIT_COMMITTER_DATE: when,
    },
  });
}

test("bukan git repo: exit 2", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "jejak-"));
  try {
    const { code, stderr } = await runCli(["7"], dir);
    assert.equal(code, 2);
    assert.match(stderr, /bukan git repo/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("repo kosong: 0 commit, graph tetap ada", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "jejak-"));
  try {
    await gitInit(dir);
    const { code, stdout } = await runCli(["7"], dir);
    assert.equal(code, 0);
    assert.match(stdout, /7 hari · 0 commit · 0 hari hidup/);
    assert.match(stdout, /sen sel rab kam jum sab min/);
    assert.match(stdout, /·/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("hari ke-1 satu titik; hari ke-2 graph hidup", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "jejak-"));
  try {
    await gitInit(dir);
    await commitAt(dir, "d1.txt", 0);
    const day1 = await runCli(["7"], dir);
    assert.equal(day1.code, 0);
    assert.match(day1.stdout, /7 hari · 1 commit · 1 hari hidup/);

    await commitAt(dir, "d2.txt", -1);
    const day2 = await runCli(["7"], dir);
    assert.equal(day2.code, 0);
    assert.match(day2.stdout, /7 hari · 2 commit · 2 hari hidup/);
    assert.equal(day2.stdout.includes("2 hari hidup"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("hari di luar jendela tidak dihitung", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "jejak-"));
  try {
    await gitInit(dir);
    await commitAt(dir, "lama.txt", -20);
    await commitAt(dir, "baru.txt", 0);
    const { code, stdout } = await runCli(["7"], dir);
    assert.equal(code, 0);
    assert.match(stdout, /7 hari · 1 commit · 1 hari hidup/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
