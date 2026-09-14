import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { scanFolder, scanStaged, scanText } from "../han.sip/ronda.mjs";
import { palsu } from "./palsu.mjs";

const execFileP = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const CLI = path.join(ROOT, "han.sip", "cli.mjs");
const FIX_ENV = path.join(ROOT, "tes", "fixtures", "dot-env");

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

async function tmpDir() {
  return mkdtemp(path.join(tmpdir(), "han-sip-"));
}

async function gitInit(dir) {
  await execFileP("git", ["init"], { cwd: dir });
  await execFileP("git", ["config", "user.name", "tes"], { cwd: dir });
  await execFileP("git", ["config", "user.email", "tes@example.com"], {
    cwd: dir,
  });
}

async function gitAdd(dir, file) {
  await execFileP("git", ["add", "-f", "--", file], { cwd: dir });
}

function kinds(hits) {
  return hits.map((h) => h.kind).sort();
}

test("fixture .env: folder scan teriak env-file, tidak mencetak nilai", async () => {
  const dir = await tmpDir();
  try {
    const body = await readFile(FIX_ENV, "utf8");
    await writeFile(path.join(dir, ".env"), body);
    await writeFile(path.join(dir, "app.js"), "console.log(1)\n");
    const { hits } = await scanFolder(dir);
    assert.equal(hits.some((h) => h.kind === "env-file" && h.file === ".env"), true);
    const cli = await runCli(["."], dir);
    assert.equal(cli.code, 1);
    assert.match(cli.stdout, /env-file/);
    assert.equal(cli.stdout.includes(palsu.nilaiEnv()), false);
    assert.equal(cli.stderr.includes(palsu.nilaiEnv()), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fixture .env.example kosong: bukan env-file, sip", async () => {
  const dir = await tmpDir();
  try {
    await writeFile(path.join(dir, ".env.example"), "API_KEY=\nTOKEN=\n# ghp_bukan_token\n");
    const { hits } = await scanFolder(dir);
    assert.deepEqual(hits, []);
    const cli = await runCli(["--quiet", "."], dir);
    assert.equal(cli.code, 0);
    assert.equal(cli.stdout, "");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fixture .env.example berisi token berbentuk secret: teriak isi, bukan env-file", async () => {
  const dir = await tmpDir();
  try {
    const token = palsu.github();
    await writeFile(path.join(dir, ".env.example"), `API_KEY=\nTOKEN=${token}\n`);
    const { hits } = await scanFolder(dir);
    assert.equal(hits.some((h) => h.kind === "env-file"), false);
    assert.equal(
      hits.some((h) => h.kind === "github-token" && h.file === ".env.example"),
      true,
    );
    const cli = await runCli(["."], dir);
    assert.equal(cli.code, 1);
    assert.match(cli.stdout, /github-token/);
    assert.equal(cli.stdout.includes(token), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("unstaged .env: --staged sip, folder bukan sip", async () => {
  const dir = await tmpDir();
  try {
    await gitInit(dir);
    await writeFile(path.join(dir, "ok.js"), "export default 1\n");
    await gitAdd(dir, "ok.js");
    await writeFile(path.join(dir, ".env"), `API_KEY=${palsu.nilaiEnv()}\n`);
    const staged = await scanStaged(dir);
    assert.deepEqual(staged.hits, []);
    const folder = await scanFolder(dir);
    assert.equal(folder.hits.some((h) => h.kind === "env-file"), true);
    const cliStaged = await runCli(["--staged", "--quiet"], dir);
    assert.equal(cliStaged.code, 0);
    const cliFolder = await runCli(["--quiet", "."], dir);
    assert.equal(cliFolder.code, 1);
    assert.equal(cliFolder.stdout.includes(palsu.nilaiEnv()), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("staged .env: --staged baca index, bukan working tree", async () => {
  const dir = await tmpDir();
  try {
    await gitInit(dir);
    await writeFile(path.join(dir, ".env"), `API_KEY=${palsu.nilaiEnv()}\n`);
    await gitAdd(dir, ".env");
    await writeFile(path.join(dir, ".env"), "API_KEY=\n");
    const staged = await scanStaged(dir);
    assert.equal(staged.hits.some((h) => h.kind === "env-file"), true);
    const cli = await runCli(["--staged"], dir);
    assert.equal(cli.code, 1);
    assert.match(cli.stdout, /env-file/);
    assert.equal(cli.stdout.includes(palsu.nilaiEnv()), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("token palsu di working tree, index bersih: --staged sip", async () => {
  const dir = await tmpDir();
  try {
    await gitInit(dir);
    const token = palsu.github();
    await writeFile(path.join(dir, "app.js"), "export const ok = 1\n");
    await gitAdd(dir, "app.js");
    await writeFile(path.join(dir, "app.js"), `export const t = "${token}"\n`);
    const staged = await scanStaged(dir);
    assert.deepEqual(staged.hits, []);
    const folder = await scanFolder(dir);
    assert.equal(
      folder.hits.some((h) => h.kind === "github-token" && h.line === 1),
      true,
    );
    const cli = await runCli(["--staged", "--quiet"], dir);
    assert.equal(cli.code, 0);
    const dirty = await runCli(["."], dir);
    assert.equal(dirty.code, 1);
    assert.equal(dirty.stdout.includes(token), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("token palsu di index, working tree bersih: --staged teriak", async () => {
  const dir = await tmpDir();
  try {
    await gitInit(dir);
    const token = palsu.github();
    await writeFile(path.join(dir, "app.js"), `export const t = "${token}"\n`);
    await gitAdd(dir, "app.js");
    await writeFile(path.join(dir, "app.js"), "export const ok = 1\n");
    const staged = await scanStaged(dir);
    assert.equal(staged.hits.some((h) => h.kind === "github-token"), true);
    const folder = await scanFolder(dir);
    assert.deepEqual(folder.hits, []);
    const cli = await runCli(["--staged"], dir);
    assert.equal(cli.code, 1);
    assert.equal(cli.stdout.includes(token), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const DETECT = [
  ["github-token", palsu.github],
  ["github-pat", palsu.githubPat],
  ["telegram-token", palsu.telegram],
  ["aws-key-id", palsu.aws],
  ["slack-token", palsu.slack],
  ["stripe-key", palsu.stripe],
  ["openai-key", palsu.openai],
  ["anthropic-key", palsu.anthropic],
  ["google-api-key", palsu.google],
  ["npm-token", palsu.npm],
  ["gitlab-pat", palsu.gitlab],
  ["huggingface-token", palsu.huggingface],
  ["private-key", palsu.pemHeader],
];

for (const [kind, make] of DETECT) {
  test(`detector ${kind}: hit baris, token tidak dicetak`, async () => {
    const token = make();
    const hits = [];
    scanText("app.js", `const x = "${token}"\nconst ok = 1\n`, hits);
    assert.equal(
      hits.some((h) => h.kind === kind && h.line === 1),
      true,
      kinds(hits).join(","),
    );
    const dir = await tmpDir();
    try {
      await writeFile(path.join(dir, "app.js"), `const x = "${token}"\n`);
      const cli = await runCli(["."], dir);
      assert.equal(cli.code, 1);
      assert.match(cli.stdout, new RegExp(kind));
      assert.equal(cli.stdout.includes(token), false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

test("detector ssh-key-file: .ssh/id_rsa", async () => {
  const dir = await tmpDir();
  try {
    await mkdir(path.join(dir, ".ssh"));
    await writeFile(path.join(dir, ".ssh", "id_rsa"), "not-a-real-key\n");
    const { hits } = await scanFolder(dir);
    assert.equal(
      hits.some(
        (h) =>
          h.kind === "ssh-key-file" &&
          h.file.replaceAll("\\", "/").endsWith(".ssh/id_rsa"),
      ),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("walk: .hidden/secret tertangkap; .git dilewati", async () => {
  const dir = await tmpDir();
  try {
    await mkdir(path.join(dir, ".hidden"));
    await mkdir(path.join(dir, ".git"));
    const token = palsu.github();
    await writeFile(path.join(dir, ".hidden", "secret"), `export const t = "${token}"\n`);
    await writeFile(path.join(dir, ".git", "config"), `export const t = "${token}"\n`);
    const { hits } = await scanFolder(dir);
    assert.equal(
      hits.some(
        (h) =>
          h.kind === "github-token" &&
          h.file.replaceAll("\\", "/").endsWith(".hidden/secret"),
      ),
      true,
    );
    assert.equal(
      hits.some((h) => h.file.replaceAll("\\", "/").includes(".git/")),
      false,
    );
    const cli = await runCli(["."], dir);
    assert.equal(cli.code, 1);
    assert.match(cli.stdout, /\.hidden\/secret/);
    assert.equal(cli.stdout.includes(token), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("detector key-file: *.p12 nama; *.pem hanya private/kosong, bukan sertifikat", async () => {
  const cert = [];
  scanText("cert.pem", `${palsu.certHeader()}\nMIIB\n-----END CERTIFICATE-----\n`, cert);
  assert.equal(cert.some((h) => h.kind === "key-file"), false);
  assert.equal(cert.some((h) => h.kind === "private-key"), false);

  const fullchain = [];
  scanText("fullchain.pem", `${palsu.certHeader()}\nMIIB\n-----END CERTIFICATE-----\n`, fullchain);
  assert.deepEqual(fullchain, []);

  const empty = [];
  scanText("tls.key", "", empty);
  assert.equal(empty.some((h) => h.kind === "key-file"), true);

  const priv = [];
  scanText("priv.pem", `${palsu.pemHeader()}\n`, priv);
  assert.equal(priv.some((h) => h.kind === "private-key"), true);
  assert.equal(priv.some((h) => h.kind === "key-file"), false);

  const p12 = [];
  scanText("client.p12", "binary-ish\n", p12);
  assert.equal(p12.some((h) => h.kind === "key-file"), true);

  const dir = await tmpDir();
  try {
    await writeFile(path.join(dir, "empty.pem"), "");
    await writeFile(
      path.join(dir, "cert.pem"),
      `${palsu.certHeader()}\nX\n-----END CERTIFICATE-----\n`,
    );
    const { hits } = await scanFolder(dir);
    assert.equal(hits.some((h) => h.kind === "key-file" && h.file === "empty.pem"), true);
    assert.equal(hits.some((h) => h.file === "cert.pem"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("detector openai-key: sk- klasik; sk-ant- bukan dobel", () => {
  const classic = [];
  const tok = palsu.openaiClassic();
  scanText("app.js", `const x = "${tok}"\n`, classic);
  assert.equal(classic.some((h) => h.kind === "openai-key"), true);

  const ant = [];
  scanText("app.js", `const x = "${palsu.anthropic()}"\n`, ant);
  assert.equal(ant.some((h) => h.kind === "anthropic-key"), true);
  assert.equal(ant.some((h) => h.kind === "openai-key"), false);

  const stripe = [];
  scanText("app.js", `const x = "${palsu.stripe()}"\n`, stripe);
  assert.equal(stripe.some((h) => h.kind === "stripe-key"), true);
  assert.equal(stripe.some((h) => h.kind === "openai-key"), false);
});

test("detector aws-secret: 40 karakter hanya dekat AKIA/AWS_SECRET", () => {
  const secret = palsu.awsSecret();
  const alone = [];
  scanText("app.js", `const x = "${secret}"\n`, alone);
  assert.equal(alone.some((h) => h.kind === "aws-secret"), false);

  const same = [];
  scanText("app.js", `aws_secret_access_key=${secret}\n`, same);
  assert.equal(same.some((h) => h.kind === "aws-secret"), true);

  const near = [];
  scanText("app.js", `${palsu.aws()}\n${secret}\n`, near);
  assert.equal(near.some((h) => h.kind === "aws-key-id"), true);
  assert.equal(near.some((h) => h.kind === "aws-secret"), true);

  const far = [];
  scanText("app.js", `${palsu.aws()}\n\n\n${secret}\n`, far);
  assert.equal(far.some((h) => h.kind === "aws-secret"), false);
});

test("detector seed-phrase: 12/24 kata + konteks; tanpa konteks diam", async () => {
  const phrase = palsu.seed12();
  const naked = [];
  scanText("README.md", `${phrase}\n`, naked);
  assert.equal(naked.some((h) => h.kind === "seed-phrase"), false);

  const labeled = [];
  scanText("notes.txt", `seed: ${phrase}\n`, labeled);
  assert.equal(labeled.some((h) => h.kind === "seed-phrase" && h.line === 1), true);

  const adj = [];
  scanText("w.txt", `mnemonic\n${phrase}\n`, adj);
  assert.equal(adj.some((h) => h.kind === "seed-phrase"), true);

  const short = [];
  scanText("w.txt", `wallet: ${Array.from({ length: 11 }, () => "alpha").join(" ")}\n`, short);
  assert.equal(short.some((h) => h.kind === "seed-phrase"), false);

  const twentyFour = [];
  scanText("w.txt", `recovery ${palsu.seed24()}\n`, twentyFour);
  assert.equal(twentyFour.some((h) => h.kind === "seed-phrase"), true);

  const dir = await tmpDir();
  try {
    await writeFile(path.join(dir, "notes.txt"), `wallet seed\n${phrase}\n`);
    const cli = await runCli(["."], dir);
    assert.equal(cli.code, 1);
    assert.match(cli.stdout, /seed-phrase/);
    assert.equal(cli.stdout.includes(phrase), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("bukan secret: string pendek tidak lolos ambang", () => {
  const hits = [];
  scanText("app.js", 'const a = "ghp_short"\nconst b = "AKIA"\n', hits);
  assert.deepEqual(hits, []);
});

test("npm lifecycle tidak nulis .git", async () => {
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.private, true);
  const life = [
    "prepare",
    "preinstall",
    "install",
    "postinstall",
    "prepack",
    "prepublish",
    "prepublishOnly",
    "publish",
  ];
  for (const name of life) {
    const script = pkg.scripts?.[name] ?? "";
    assert.equal(script, "", name);
    assert.equal(script.includes("pasang"), false, name);
  }
  assert.equal(pkg.scripts["han.sip:pasang"], "node han.sip/cli.mjs pasang");
});
