import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { parseArgs } from "../han.sip/cli.mjs";
import { hookBody, NPX, PIN_SHA, PREV_HOOK } from "../han.sip/pasang.mjs";
import { BASELINE_NOTE } from "../han.sip/lapor.mjs";
import { fingerprint, fingerprint256, FP_HEX, SHA256_HEX, matchGlob, parseIgnore, parseUnifiedDiff } from "../han.sip/ronda.mjs";
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
  const pl = parseArgs(["node", "han.sip", "--plugin", "a.mjs", "--plugin=b.mjs"]);
  assert.deepEqual(pl.plugin, ["a.mjs", "b.mjs"]);
  assert.throws(() => parseArgs(["node", "han.sip", "--plugin"]), /butuh file/);
  const d = parseArgs(["node", "han.sip", "--", "--json", "."]);
  assert.equal(d.json, true);
  assert.equal(d.folder, ".");
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
    assert.equal(body.hits[0].fp.length, FP_HEX);
    assert.equal(body.hits[0].sha256.length, SHA256_HEX);
    assert.equal(body.hits[0].sha256.startsWith(body.hits[0].fp), true);
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
    assert.equal(res.partialFingerprints["han.sip/v2"].length, FP_HEX);
    assert.equal(res.partialFingerprints["han.sip/sha256"].length, SHA256_HEX);
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
    assert.equal(raw.version, 2);
    assert.equal(raw.hits[0].fp.length, FP_HEX);
    assert.equal(raw.hits[0].sha256.length, SHA256_HEX);
    assert.equal(raw.note, BASELINE_NOTE);
    assert.match(raw.note, /bukan aman/);
    assert.equal(JSON.stringify(raw).includes(a), false);

    const frozen = await runCli(["--baseline", "base.json", "."], dir);
    assert.equal(frozen.code, 0);
    assert.match(frozen.stdout, /bukan aman/);

    await writeFile(path.join(dir, "new.js"), `export const t = "${b}"\n`);
    const neu = await runCli(["--baseline=base.json", "--json", "."], dir);
    assert.equal(neu.code, 1);
    const body = JSON.parse(neu.stdout);
    assert.equal(body.hits.length, 1);
    assert.equal(body.hits[0].file, "new.js");
    assert.equal(body.baseline.suppressed, 1);
    assert.equal(body.baseline.safe, false);
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
    assert.match(stdout, new RegExp(String.raw`npx --yes github:ganezha/kotak-kecil#[0-9a-f]{40}`));
    assert.equal(stdout.includes(NPX), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fingerprint: 128-bit + SHA-256 penuh, bukan token", () => {
  const token = palsu.github();
  const fp = fingerprint("github-token", "app.js", token);
  const full = fingerprint256("github-token", "app.js", token);
  assert.match(fp, /^[0-9a-f]{32}$/);
  assert.match(full, /^[0-9a-f]{64}$/);
  assert.equal(fp.length, FP_HEX);
  assert.equal(full.length, SHA256_HEX);
  assert.equal(full.startsWith(fp), true);
  assert.equal(fp.includes(token), false);
  assert.equal(full.includes(token), false);
  assert.equal(token.includes(fp), false);
  const hashed = createHash("sha256")
    .update("github-token")
    .update("\0")
    .update("app.js")
    .update("\0")
    .update(token)
    .digest("hex");
  assert.equal(full, hashed);
  assert.equal(fp, hashed.slice(0, 32));
  assert.notEqual(fingerprint("github-token", "other.js", token), fp);
  assert.equal(fingerprint("github-token", "app.js", token), fp);
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
    assert.equal(hook.includes(`npx --yes ${NPX} -- --staged --quiet`), true);
    assert.match(hook, /github:ganezha\/kotak-kecil#[0-9a-f]{40}/);
    const check = await runCli(["pasang", "--check"], dir);
    assert.equal(check.code, 0);
    assert.match(check.stdout, /sip/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("npx pin: pasang + template + salinan = commit SHA", async () => {
  assert.match(PIN_SHA, /^[0-9a-f]{40}$/);
  const pin = `github:ganezha/kotak-kecil#${PIN_SHA}`;
  assert.equal(NPX, pin);
  assert.equal(hookBody().includes(`npx --yes ${pin} -- --staged --quiet`), true);
  assert.equal(hookBody().includes("github:ganezha/kotak-kecil --"), false);
  assert.equal(hookBody().includes("github:ganezha/kotak-kecil#v"), false);

  const surfaces = [
    "templates/github-actions.yml",
    "README.md",
    "docs/INSTALL.md",
    "docs/EXAMPLES.md",
    "docs/han.sip.md",
  ];
  const unpinned = /github:ganezha\/kotak-kecil(?!#[0-9a-f]{40})/;
  for (const rel of surfaces) {
    const body = await readFile(path.join(ROOT, rel), "utf8");
    assert.equal(body.includes(pin), true, rel);
    assert.equal(unpinned.test(body), false, `unpinned di ${rel}`);
  }

  const hookSrc = await readFile(
    path.join(ROOT, ".githooks/pre-commit.mjs"),
    "utf8",
  );
  assert.match(hookSrc, /import\s*\{[^}]*NPX/);
  assert.match(hookSrc, /from\s*["']\.\.\/han\.sip\/pasang\.mjs["']/);
  assert.equal(unpinned.test(hookSrc), false, "unpinned di .githooks/pre-commit.mjs");
  assert.equal(hookSrc.includes("github:ganezha/kotak-kecil --"), false);
});

test("GitHub Actions pin uses ke commit SHA 40 hex", async () => {
  const files = [
    ".github/workflows/han.sip.yml",
    "templates/github-actions.yml",
  ];
  const usesRe = /^\s+- uses:\s+(\S+)/gm;
  for (const rel of files) {
    const body = await readFile(path.join(ROOT, rel), "utf8");
    const pins = [...body.matchAll(usesRe)].map((m) => m[1]);
    assert.ok(pins.length >= 2, rel);
    for (const spec of pins) {
      assert.match(spec, /@[0-9a-f]{40}$/, `${rel}: ${spec}`);
    }
  }
});

test("han.sip pasang: hook asing di-backup; .bak lama tidak ditimpa", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await gitInit(dir);
    const dest = path.join(dir, ".git/hooks/pre-commit");
    await mkdir(path.dirname(dest), { recursive: true });
    const foreign = "#!/bin/sh\necho foreign\n";
    await writeFile(dest, foreign, { mode: 0o755 });

    const first = await runCli(["pasang"], dir);
    assert.equal(first.code, 0);
    assert.match(first.stdout, /terpasang/);
    const warn = `${first.stdout}\n${first.stderr}`;
    assert.match(warn, /hook asing/);
    assert.match(warn, /pre-commit\.bak/);
    assert.equal(await readFile(`${dest}.bak`, "utf8"), foreign);
    const ours = await readFile(dest, "utf8");
    assert.match(ours, /generated by han\.sip/);
    assert.match(ours, /pre-commit\.han\.sip-prev/);
    assert.equal(
      await readFile(path.join(dir, ".git/hooks", PREV_HOOK), "utf8"),
      foreign,
    );

    const again = await runCli(["pasang"], dir);
    assert.equal(again.code, 0);
    assert.equal(/hook asing/.test(`${again.stdout}\n${again.stderr}`), false);

    const other = "#!/bin/sh\necho other\n";
    await writeFile(dest, other, { mode: 0o755 });
    const second = await runCli(["pasang"], dir);
    assert.equal(second.code, 0);
    assert.equal(await readFile(`${dest}.bak`, "utf8"), foreign);
    const hooks = await readdir(path.join(dir, ".git/hooks"));
    const stamped = hooks.filter((f) => /^pre-commit\.bak\.\d+$/.test(f));
    assert.equal(stamped.length, 1);
    assert.equal(
      await readFile(path.join(dir, ".git/hooks", stamped[0]), "utf8"),
      other,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("han.sip pasang: chain hook asing; prev gagal = han.sip tidak jalan", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await gitInit(dir);
    const dest = path.join(dir, ".git/hooks/pre-commit");
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, "#!/bin/sh\necho FOREIGN_RAN\n", { mode: 0o755 });
    const r = await runCli(["pasang"], dir);
    assert.equal(r.code, 0);
    await mkdir(path.join(dir, "han.sip"));
    await writeFile(
      path.join(dir, "han.sip", "cli.mjs"),
      'console.log("HAN_SIP_RAN");\n',
    );
    const hook = await readFile(dest, "utf8");
    assert.match(hook, /pre-commit\.han\.sip-prev/);
    assert.match(hookBody(), /pre-commit\.han\.sip-prev/);

    const ran = await execFileP(dest, { cwd: dir });
    assert.match(String(ran.stdout), /FOREIGN_RAN/);
    assert.match(String(ran.stdout), /HAN_SIP_RAN/);

    const prev = path.join(dir, ".git/hooks", PREV_HOOK);
    await writeFile(prev, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const fail = await new Promise((resolve) => {
      const child = spawn(dest, { cwd: dir });
      let stdout = "";
      child.stdout.on("data", (d) => {
        stdout += d;
      });
      child.stderr.on("data", () => {});
      child.on("close", (code) => resolve({ code, stdout }));
    });
    assert.equal(fail.code, 1);
    assert.equal(fail.stdout.includes("HAN_SIP_RAN"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("plugin: --plugin dan auto .han.sip/plugins", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    const val = "acme_" + "B".repeat(20);
    await writeFile(
      path.join(dir, "plug.mjs"),
      "export const rules = { content: [{ kind: \"acme-key\", re: /acme_[A-Za-z0-9]{16,}/ }] };\n",
    );
    await writeFile(path.join(dir, "app.js"), `const k = "${val}"\n`);
    const off = await runCli(["--quiet", "."], dir);
    assert.equal(off.code, 0);

    const on = await runCli(["--plugin", "plug.mjs", "."], dir);
    assert.equal(on.code, 1);
    assert.match(on.stdout, /acme-key/);
    assert.equal(on.stdout.includes(val), false);

    await mkdir(path.join(dir, ".han.sip", "plugins"), { recursive: true });
    await writeFile(
      path.join(dir, ".han.sip", "plugins", "auto.mjs"),
      "export const rules = { content: [{ kind: \"auto-key\", re: /auto_[A-Za-z0-9]{16,}/ }] };\n",
    );
    const autoVal = "auto_" + "C".repeat(20);
    await writeFile(path.join(dir, "b.js"), `const k = "${autoVal}"\n`);
    const auto = await runCli(["."], dir);
    assert.equal(auto.code, 1);
    assert.match(auto.stdout, /auto-key/);
    assert.equal(auto.stdout.includes(autoVal), false);

    const bad = await runCli(["--plugin", "tidak-ada.mjs", "."], dir);
    assert.equal(bad.code, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function fuzzDiff(seed) {
  let x = seed | 0;
  const rnd = () => {
    x = (Math.imul(x, 1664525) + 1013904223) | 0;
    return (x >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const junk = (n) => {
    let s = "";
    for (let i = 0; i < n; i += 1) s += String.fromCharCode(32 + Math.floor(rnd() * 95));
    return s;
  };
  const kinds = [
    () => "",
    () => junk(Math.floor(rnd() * 180)),
    () => `diff --git a/a.js b/a.js\n+++ b/a.js\n@@ -1 +1 @@\n+${junk(24)}\n`,
    () => "diff --git a/a b/a\n+++ /dev/null\n",
    () => 'diff --git "a/weird file" "b/weird file"\n+++ b/weird file\n@@ -0,0 +1 @@\n+ok\n',
    () => "+++ b/no-header\n+line\n",
    () => "diff --git a/x b/x\n@@ garbage @@\n+still\n",
    () => "diff --git a/x b/x\n+++ b/x\n@@ -1,1 +NaN @@\n+z\n",
    () => "diff --git a/x b/x\n+++ b/x\n@@ -1 +1 @@\n+\0bin\n",
    () => `diff --git a/x b/${"y".repeat(200)}\n+++ b/y\n+ok\n`,
    () => ["diff --git a/a b/a", "+++ b/a", "@@ -1,0 +1,3 @@", "+a", "+b", "+c"].join("\r\n"),
    () => "diff --git a/a b/a\n+++ b/a\n@@ -1 +1 @@\n+diff --git a/nested b/nested\n",
    () => "diff --git a/a b/a\nnew file mode 100644\n+++ b/a\n@@ -0,0 +1 @@\n+ok\n\\ No newline at end of file\n",
    () => `diff --git a/a b/a\n+++ b/a\n@@ -1 +1 @@\n+${"x".repeat(4000)}`,
    () => "diff --git a/foo b/bar\nrename from foo\nrename to bar\n+++ b/bar\n@@ -1 +1 @@\n+z\n",
    () => "diff --git a/a b/a\n+++ b/a\n@@ -1,1 +1,1 @@\n-old\n+new\n",
    () => "diff --git a/a b/a\n+++ b/a\n@@ -0,0 +1 @@\n+\n",
    () => "diff --git\n+++ \n@@ \n+",
    () => "diff --git a/a b/a\n+++ b/a\n@@ -1 +1 @@\n context\n+added\n",
    () => "diff --git a/a b/a\n+++ b/\"quoted\"\n@@ -1 +1 @@\n+q\n",
    () => null,
    () => 42,
  ];
  let out = pick(kinds)();
  if (typeof out !== "string") return out;
  if (rnd() < 0.3) out = out.slice(0, Math.floor(rnd() * (out.length + 1)));
  if (rnd() < 0.12) out = out.replace(/\n/g, "\r\n");
  if (rnd() < 0.12) out += "\ndiff --git a/z b/z\n+++ b/z\n+z\n";
  return out;
}

test("fuzz parseUnifiedDiff: tidak throw; bentuk aman", () => {
  for (let i = 0; i < 250; i += 1) {
    const text = fuzzDiff(i * 9973 + 17);
    const files = parseUnifiedDiff(text);
    assert.equal(Array.isArray(files), true, `iter ${i}`);
    for (const f of files) {
      assert.equal(typeof f.file, "string");
      assert.ok(f.file.length > 0);
      assert.equal(f.file.includes("\0"), false);
      assert.equal(typeof f.isNew, "boolean");
      assert.equal(Array.isArray(f.added), true);
      for (const row of f.added) {
        assert.equal(typeof row.line, "number");
        assert.equal(Number.isFinite(row.line), true);
        assert.ok(row.line >= 0);
        assert.equal(typeof row.text, "string");
      }
    }
  }
});
