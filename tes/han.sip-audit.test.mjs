import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { parseArgs } from "../han.sip/cli.mjs";
import {
  MAX_BYTES,
  STREAM_CHUNK,
  isExampleEnv,
  isIgnored,
  matchAll,
  scanFolder,
  scanStaged,
  scanText,
  setRules,
  uniqueHits,
  utf8IncompleteTail,
} from "../han.sip/ronda.mjs";
import { palsu } from "./palsu.mjs";

const execFileP = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

test("dua ghp_ satu baris: dua temuan", () => {
  const a = palsu.github();
  const b = `ghp_${"B".repeat(36)}`;
  const hits = [];
  scanText("app.js", `const x = "${a}"; const y = "${b}";\n`, hits);
  const g = hits.filter((h) => h.kind === "github-token");
  assert.equal(g.length, 2);
  assert.equal(g[0].line, 1);
  assert.equal(g[1].line, 1);
  assert.notEqual(g[0].fp, g[1].fp);
});

test("token sama dua baris: uniqueHits menyimpan keduanya", () => {
  const tok = palsu.github();
  const hits = [];
  scanText("app.js", `const a = "${tok}"\nconst b = "${tok}"\n`, hits);
  const g = hits.filter((h) => h.kind === "github-token");
  assert.equal(g.length, 2);
  assert.equal(g[0].line, 1);
  assert.equal(g[1].line, 2);
  assert.notEqual(g[0].fp, g[1].fp);
  assert.equal(uniqueHits(g).length, 2);
});

test("plugin /g: lastIndex tidak menelan file ke-2", () => {
  setRules({
    content: [{ kind: "abc-id", re: /abc[0-9]{3,}/g }],
    file: [],
  });
  try {
    const a = [];
    scanText("a.js", "abc111\n", a);
    const b = [];
    scanText("b.js", "abc222\n", b);
    assert.equal(a.some((h) => h.kind === "abc-id"), true);
    assert.equal(b.some((h) => h.kind === "abc-id"), true);
  } finally {
    setRules(null);
  }
});

test("matchAll: flag g tidak bocor; match kosong aman", () => {
  const re = /x/g;
  assert.equal(matchAll(re, "x x").length, 2);
  assert.equal(matchAll(re, "y").length, 0);
  assert.equal(re.lastIndex, 0);
});

test("--staged src tidak meronda other/", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await gitInit(dir);
    await mkdir(path.join(dir, "src"));
    await mkdir(path.join(dir, "other"));
    const inSrc = palsu.github();
    const inOther = palsu.slack();
    await writeFile(path.join(dir, "src", "x.js"), `export const t = "${inSrc}"\n`);
    await writeFile(path.join(dir, "other", "y.js"), `export const t = "${inOther}"\n`);
    await execFileP("git", ["add", "-f", "--", "src/x.js", "other/y.js"], { cwd: dir });

    const all = await scanStaged(dir);
    assert.equal(all.hits.some((h) => h.file.replaceAll("\\", "/").includes("other/")), true);

    const filtered = await scanStaged(dir, { pathFilter: "src" });
    assert.equal(
      filtered.hits.some((h) => h.file.replaceAll("\\", "/").endsWith("src/x.js")),
      true,
    );
    assert.equal(
      filtered.hits.some((h) => h.file.replaceAll("\\", "/").includes("other/")),
      false,
    );

    const cli = await runCli(["--staged", "--json", "src"], dir);
    assert.equal(cli.code, 1);
    const body = JSON.parse(cli.stdout);
    assert.equal(body.hits.some((h) => h.file.includes("other/")), false);
    assert.equal(body.hits.some((h) => h.kind === "github-token"), true);
    assert.equal(cli.stdout.includes(inOther), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--diff repo baru (belum HEAD): empty tree, bukan exit 2", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await gitInit(dir);
    const tok = palsu.github();
    await writeFile(path.join(dir, "app.js"), `export const t = "${tok}"\n`);
    await execFileP("git", ["add", "--", "app.js"], { cwd: dir });
    const { code, stdout, stderr } = await runCli(["--diff", "--json"], dir);
    assert.equal(code, 1, stderr);
    const body = JSON.parse(stdout);
    assert.equal(body.hits.some((h) => h.kind === "github-token"), true);
    const staged = await runCli(["--staged", "--diff", "--json"], dir);
    assert.equal(staged.code, 1);
    assert.equal(JSON.parse(staged.stdout).hits.some((h) => h.kind === "github-token"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("utf8IncompleteTail: sekuens 3-byte di ekor", () => {
  const euro = Buffer.from("€"); // e2 82 ac
  assert.equal(utf8IncompleteTail(Buffer.from("abc")), 0);
  assert.equal(utf8IncompleteTail(euro), 0);
  assert.equal(utf8IncompleteTail(euro.subarray(0, 1)), 1);
  assert.equal(utf8IncompleteTail(euro.subarray(0, 2)), 2);
  assert.equal(utf8IncompleteTail(Buffer.concat([Buffer.from("x"), euro.subarray(0, 1)])), 1);
});

test("stream: UTF-8 pecah di batas chunk, token berikutnya tetap ketemu", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    const tok = palsu.github();
    const prefix = Buffer.alloc(STREAM_CHUNK - 1, 0x61);
    const body = Buffer.concat([
      prefix,
      Buffer.from("€"),
      Buffer.from(`\nconst t = "${tok}"\n`),
      Buffer.alloc(MAX_BYTES, 0x62),
    ]);
    await writeFile(path.join(dir, "big.js"), body);
    const { hits } = await scanFolder(dir);
    assert.equal(hits.some((h) => h.kind === "github-token" && h.file === "big.js"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("stream: .pem besar tanpa header PEM = key-file", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await writeFile(path.join(dir, "weird.pem"), `${"x".repeat(MAX_BYTES + 64)}\n`);
    const { hits } = await scanFolder(dir);
    assert.equal(hits.some((h) => h.kind === "key-file" && h.file === "weird.pem"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("template env: .env.sample/.env.template/.env.test bukan env-file; .envrc iya", async () => {
  assert.equal(isExampleEnv(".env.example"), true);
  assert.equal(isExampleEnv(".env.sample"), true);
  assert.equal(isExampleEnv(".env.template"), true);
  assert.equal(isExampleEnv(".env.test"), true);
  assert.equal(isExampleEnv(".env"), false);

  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await writeFile(path.join(dir, ".env.sample"), "API_KEY=\n");
    await writeFile(path.join(dir, ".env.template"), "TOKEN=\n");
    await writeFile(path.join(dir, ".env.test"), "FOO=\n");
    await writeFile(path.join(dir, ".envrc"), "export FOO=1\n");
    const { hits } = await scanFolder(dir);
    assert.equal(hits.some((h) => h.kind === "env-file" && h.file === ".env.sample"), false);
    assert.equal(hits.some((h) => h.kind === "env-file" && h.file === ".env.template"), false);
    assert.equal(hits.some((h) => h.kind === "env-file" && h.file === ".env.test"), false);
    assert.equal(hits.some((h) => h.kind === "env-file" && h.file === ".envrc"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ignore: negasi ! last-match-wins", async () => {
  assert.equal(isIgnored("vendor/a.js", ["vendor/**"]), true);
  assert.equal(isIgnored("vendor/keep.js", ["vendor/**", "!vendor/keep.js"]), false);
  assert.equal(isIgnored("vendor/a.js", ["vendor/**", "!vendor/keep.js"]), true);

  const dir = await mkdtemp(path.join(tmpdir(), "han-sip-"));
  try {
    await mkdir(path.join(dir, "vendor"));
    const hide = palsu.github();
    const keep = palsu.slack();
    await writeFile(path.join(dir, "vendor", "a.js"), `export const t = "${hide}"\n`);
    await writeFile(path.join(dir, "vendor", "keep.js"), `export const t = "${keep}"\n`);
    const { code, stdout } = await runCli(
      ["--ignore", "vendor/**", "--ignore", "!vendor/keep.js", "--json", "."],
      dir,
    );
    assert.equal(code, 1);
    const body = JSON.parse(stdout);
    assert.equal(body.hits.some((h) => h.file.replaceAll("\\", "/").endsWith("vendor/a.js")), false);
    assert.equal(body.hits.some((h) => h.file.replaceAll("\\", "/").endsWith("vendor/keep.js")), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("detector baru: ASIA, xapp, whsec, discord, azure, gcp, seed BIP39", () => {
  const asia = [];
  scanText("a.js", `const id = "${palsu.awsTemp()}"\n`, asia);
  assert.equal(asia.some((h) => h.kind === "aws-key-id"), true);

  const app = [];
  scanText("a.js", `const t = "${palsu.slackApp()}"\n`, app);
  assert.equal(app.some((h) => h.kind === "slack-token"), true);

  const hook = [];
  scanText("a.js", `const t = "${palsu.stripeWebhook()}"\n`, hook);
  assert.equal(hook.some((h) => h.kind === "stripe-key"), true);

  const disc = [];
  scanText("a.js", `const t = "${palsu.discord()}"\n`, disc);
  assert.equal(disc.some((h) => h.kind === "discord-token"), true);

  const az = [];
  scanText("a.js", `${palsu.azure()}\n`, az);
  assert.equal(az.some((h) => h.kind === "azure-storage"), true);

  const gcp = [];
  scanText("sa.json", `${palsu.gcpSa()}\n`, gcp);
  assert.equal(gcp.some((h) => h.kind === "gcp-service-account"), true);

  const fake = [];
  scanText("w.txt", `wallet: ${palsu.seedFake()}\n`, fake);
  assert.equal(fake.some((h) => h.kind === "seed-phrase"), false);

  const real = [];
  scanText("w.txt", `wallet: ${palsu.seed12()}\n`, real);
  assert.equal(real.some((h) => h.kind === "seed-phrase"), true);
});

test("parseArgs: -- mengakhiri flag; --plugins", () => {
  const a = parseArgs(["node", "han.sip", "--staged", "src"]);
  assert.equal(a.staged, true);
  assert.equal(a.folder, "src");
  const b = parseArgs(["node", "han.sip", "--", "--staged", "src"]);
  assert.equal(b.staged, false);
  assert.equal(b.folder, "--staged");
});

test("package.json: jejak di bin; engines >=18", async () => {
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.bin["han.sip"], "./han.sip/cli.mjs");
  assert.equal(pkg.bin.jejak, "./jejak/cli.mjs");
  assert.equal(pkg.engines.node, ">=18");
  assert.equal(pkg.version, "0.9.0");
});

test("docs: curl gitignore tidak ke main dan tidak -o .gitignore", async () => {
  for (const rel of ["README.md", "docs/INSTALL.md", "docs/EXAMPLES.md"]) {
    const body = await readFile(path.join(ROOT, rel), "utf8");
    assert.equal(body.includes("/main/gitignore"), false, rel);
    assert.equal(/curl[^\n]*-o \.gitignore/.test(body), false, rel);
  }
});
