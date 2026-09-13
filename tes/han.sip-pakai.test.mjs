import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { parseArgs } from "../han.sip/cli.mjs";
import { matchGlob, parseIgnore, parseUnifiedDiff } from "../han.sip/ronda.mjs";
import { palsu } from "./palsu.mjs";

const execFileP = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const CLI = path.join(ROOT, "han.sip", "cli.mjs");

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

async function gitInit(dir) {
  await execFileP("git", ["init"], { cwd: dir });
  await execFileP("git", ["config", "user.name", "tes"], { cwd: dir });
  await execFileP("git", ["config", "user.email", "tes@example.com"], {
    cwd: dir,
  });
}

async function commit(dir, name, body) {
  await writeFile(path.join(dir, name), body);
  await execFileP("git", ["add", "--", name], { cwd: dir });
  await execFileP("git", ["commit", "-m", name], { cwd: dir });
}

test("parseArgs: flag baru", () => {
  const a = parseArgs(["node", "han.sip", "--json", "--staged", "src"]);
  assert.equal(a.json, true);
  assert.equal(a.staged, true);
  assert.equal(a.folder, "src");
  const b = parseArgs(["node", "han.sip", "--diff", "origin/main", "--ignore", "docs/**"]);
  assert.equal(b.diff, true);
  assert.equal(b.diffRef, "origin/main");
  assert.deepEqual(b.ignore, ["docs/**"]);
  const c = parseArgs(["node", "han.sip", "--baseline", "--write-baseline=out.json"]);
  assert.equal(c.baseline, ".han.sip-baseline.json");
  assert.equal(c.writeBaseline, "out.json");
  assert.throws(() => parseArgs(["node", "han.sip", "--json", "--sarif"]), /pilih/);
  assert.throws(() => parseArgs(["node", "han.sip", "--wat"]), /tidak dikenal/);
  assert.throws(() => parseArgs(["node", "han.sip", "--ignore"]), /butuh pola/);
  const p = parseArgs(["node", "han.sip", "pasang", "--check"]);
  assert.equal(p.command, "pasang");
  assert.equal(p.check, true);
});

test("matchGlob: * ** dan nama tanpa slash", () => {
  assert.equal(matchGlob("README.md", "*.md"), true);
  assert.equal(matchGlob("docs/a.md", "*.md"), true);
  assert.equal(matchGlob("docs/a.md", "docs/**"), true);
  assert.equal(matchGlob("a.md", "docs/**"), false);
  assert.equal(matchGlob("src/app.js", "app.js"), true);
  assert.equal(matchGlob("app.js", "app.js"), true);
  assert.equal(matchGlob("src/app.ts", "app.js"), false);
  assert.equal(matchGlob("docs/x/y.md", "docs/**/*.md"), true);
  assert.equal(matchGlob(".env", ".env"), true);
  assert.equal(parseIgnore("# x\n\ndocs/**\n").join(","), "docs/**");
});

test("parseUnifiedDiff: baris + dan file baru", () => {
  const files = parseUnifiedDiff(`diff --git a/app.js b/app.js
index 111..222 100644
--- a/app.js
+++ b/app.js
@@ -2,0 +3,1 @@
+const t = 1
diff --git a/n.js b/n.js
new file mode 100644
--- /dev/null
+++ b/n.js
@@ -0,0 +1,1 @@
+ok
`);
  assert.equal(files[0].file, "app.js");
  assert.equal(files[0].added[0].line, 3);
  assert.equal(files[0].added[0].text, "const t = 1");
  assert.equal(files[1].isNew, true);
  assert.equal(files[1].file, "n.js");
});

test("--json: bentuk, tanpa nilai secret", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    const token = palsu.github();
    await writeFile(path.join(dir, "app.js"), `export const t = "${token}"\n`);
    const { code, stdout } = await runCli(["--json", "."], dir);
    assert.equal(code, 1);
    assert.equal(stdout.includes(token), false);
    const body = JSON.parse(stdout);
    assert.equal(body.ok, false);
    assert.equal(body.hits[0].kind, "github-token");
    assert.equal(body.hits[0].file, "app.js");
    assert.equal(body.hits[0].line, 1);
    assert.equal(typeof body.hits[0].fp, "string");
    assert.equal(body.hits[0].fp.length, 16);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--sarif: 2.1.0, startLine >= 1, tanpa secret", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await writeFile(path.join(dir, ".env"), `API_KEY=${palsu.nilaiEnv()}\n`);
    const { code, stdout } = await runCli(["--sarif", "."], dir);
    assert.equal(code, 1);
    assert.equal(stdout.includes(palsu.nilaiEnv()), false);
    const body = JSON.parse(stdout);
    assert.equal(body.version, "2.1.0");
    const res = body.runs[0].results[0];
    assert.equal(res.ruleId, "env-file");
    assert.ok(res.locations[0].physicalLocation.region.startLine >= 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--ignore: path yang cocok tidak dironda", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await mkdir(path.join(dir, "docs"), { recursive: true });
    const token = palsu.github();
    await writeFile(path.join(dir, "docs", "a.js"), `export const t = "${token}"\n`);
    await writeFile(path.join(dir, "app.js"), "export const ok = 1\n");
    const ignored = await runCli(["--ignore", "docs/**", "--quiet", "."], dir);
    assert.equal(ignored.code, 0);
    const raw = await runCli(["--quiet", "."], dir);
    assert.equal(raw.code, 1);
    assert.equal(raw.stdout.includes(token), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test(".han.sipignore di root repo", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await gitInit(dir);
    await mkdir(path.join(dir, "vendor"), { recursive: true });
    const token = palsu.github();
    await writeFile(path.join(dir, "vendor", "lib.js"), `export const t = "${token}"\n`);
    await writeFile(path.join(dir, ".han.sipignore"), "vendor/**\n");
    const { code } = await runCli(["--quiet", "."], dir);
    assert.equal(code, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--baseline: temuan lama sip, temuan baru gagal", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    const a = palsu.github();
    const b = palsu.stripe();
    await writeFile(path.join(dir, "old.js"), `export const t = "${a}"\n`);
    const written = await runCli(["--write-baseline", "base.json", "."], dir);
    assert.equal(written.code, 0);
    const raw = JSON.parse(await readFile(path.join(dir, "base.json"), "utf8"));
    assert.equal(raw.hits.length, 1);
    assert.equal(JSON.stringify(raw).includes(a), false);

    const frozen = await runCli(["--baseline", "base.json", "--quiet", "."], dir);
    assert.equal(frozen.code, 0);

    await writeFile(path.join(dir, "new.js"), `export const t = "${b}"\n`);
    const neu = await runCli(["--baseline=base.json", "--json", "."], dir);
    assert.equal(neu.code, 1);
    const body = JSON.parse(neu.stdout);
    assert.equal(body.hits.length, 1);
    assert.equal(body.hits[0].file, "new.js");
    assert.equal(body.baseline.suppressed, 1);
    assert.equal(neu.stdout.includes(a), false);
    assert.equal(neu.stdout.includes(b), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--diff: hanya baris baru; token lama di file yang sama tidak teriak", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await gitInit(dir);
    const oldTok = palsu.github();
    const newTok = palsu.slack();
    await commit(dir, "app.js", `export const old = "${oldTok}"\nexport const ok = 1\n`);

    const committed = await runCli(["--diff", "--quiet"], dir);
    assert.equal(committed.code, 0);
    const folder = await runCli(["--quiet", "."], dir);
    assert.equal(folder.code, 1);

    await writeFile(
      path.join(dir, "app.js"),
      `export const old = "${oldTok}"\nexport const neu = "${newTok}"\n`,
    );
    const changed = await runCli(["--diff", "--json"], dir);
    assert.equal(changed.code, 1);
    const body = JSON.parse(changed.stdout);
    assert.equal(body.diff, "HEAD");
    assert.equal(body.hits.some((h) => h.kind === "slack-token"), true);
    assert.equal(body.hits.some((h) => h.kind === "github-token"), false);
    assert.equal(changed.stdout.includes(oldTok), false);
    assert.equal(changed.stdout.includes(newTok), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--staged --diff: index, bukan working tree", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await gitInit(dir);
    await commit(dir, "app.js", "export const ok = 1\n");
    const stagedTok = palsu.github();
    const dirtyTok = palsu.stripe();
    await writeFile(path.join(dir, "app.js"), `export const t = "${stagedTok}"\n`);
    await execFileP("git", ["add", "--", "app.js"], { cwd: dir });
    await writeFile(path.join(dir, "app.js"), `export const t = "${dirtyTok}"\n`);

    const { code, stdout } = await runCli(["--staged", "--diff", "--json"], dir);
    assert.equal(code, 1);
    assert.equal(stdout.includes(stagedTok), false);
    assert.equal(stdout.includes(dirtyTok), false);
    const body = JSON.parse(stdout);
    assert.equal(body.hits.some((h) => h.kind === "github-token"), true);
    assert.equal(body.hits.some((h) => h.kind === "stripe-key"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--diff di folder bukan git: exit 2", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    const { code, stderr } = await runCli(["--diff"], dir);
    assert.equal(code, 2);
    assert.match(stderr, /--diff butuh \.git/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--quiet --json tetap nulis JSON", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await writeFile(path.join(dir, "ok.js"), "export default 1\n");
    const { code, stdout } = await runCli(["--json", "--quiet", "."], dir);
    assert.equal(code, 0);
    const body = JSON.parse(stdout);
    assert.equal(body.ok, true);
    assert.deepEqual(body.hits, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("symlink bin (npx) tetap menjalankan main", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    const link = path.join(dir, "han.sip");
    await symlink(CLI, link);
    const { code, stdout } = await new Promise((resolve) => {
      const child = spawn(process.execPath, [link, "--help"]);
      let out = "";
      child.stdout.on("data", (d) => {
        out += d;
      });
      child.stderr.on("data", () => {});
      child.on("close", (c) => resolve({ code: c, stdout: out }));
    });
    assert.equal(code, 0);
    assert.match(stdout, /ronda malam/);
    assert.match(stdout, /npx --yes github:ganezha\/kotak-kecil/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("han.sip pasang: hook self-contained, --check sip", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await gitInit(dir);
    const { code, stdout } = await runCli(["pasang"], dir);
    assert.equal(code, 0);
    assert.match(stdout, /terpasang/);
    const hook = await readFile(path.join(dir, ".git/hooks/pre-commit"), "utf8");
    assert.match(hook, /generated by han\.sip/);
    assert.match(hook, /npx --yes github:ganezha\/kotak-kecil/);
    const check = await runCli(["pasang", "--check"], dir);
    assert.equal(check.code, 0);
    assert.match(check.stdout, /sip/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
