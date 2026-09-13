#!/usr/bin/env node
/**
 * jejak — commit per hari di repo ini.
 * One job: graph that only starts to mean something on day 2.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const NAMA = ["sen", "sel", "rab", "kam", "jum", "sab", "min"];

function help() {
  console.log(`jejak — commit per hari

Usage:
  jejak [hari]     default 14, max 366

Exit:
  0  sip
  2  gagal
`);
}

function parseArgs(argv) {
  const rest = argv.slice(2);
  if (rest.includes("-h") || rest.includes("--help")) return { help: true };
  const raw = rest.find((a) => !a.startsWith("-"));
  const days = raw == null ? 14 : Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new Error("hari 1–366");
  }
  return { help: false, days };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function midnight(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return midnight(x);
}

/** 0 = sen … 6 = min */
function senIndex(d) {
  return (d.getDay() + 6) % 7;
}

function cell(n) {
  if (!n) return "·";
  if (n > 9) return "#";
  return String(n);
}

async function datesSince(since) {
  try {
    await execFileP("git", ["rev-parse", "--is-inside-work-tree"]);
  } catch (err) {
    if (err && err.code === "ENOENT") throw new Error("git tidak ada di PATH");
    throw new Error("bukan git repo");
  }
  try {
    const { stdout } = await execFileP("git", [
      "log",
      "--all",
      "--pretty=format:%as",
      `--since=${since} 00:00`,
    ]);
    return stdout.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function report(days, counts) {
  const today = midnight(new Date());
  const start = addDays(today, -(days - 1));
  const padLeft = senIndex(start);
  const seq = [];
  for (let i = 0; i < padLeft; i += 1) seq.push(null);
  for (let i = 0; i < days; i += 1) seq.push(addDays(start, i));

  let commit = 0;
  let hidup = 0;
  for (let i = 0; i < days; i += 1) {
    const n = counts.get(ymd(addDays(start, i))) ?? 0;
    commit += n;
    if (n) hidup += 1;
  }

  console.log("jejak");
  console.log(`${days} hari · ${commit} commit · ${hidup} hari hidup`);
  console.log("");
  console.log(NAMA.join(" "));

  for (let i = 0; i < seq.length; i += 7) {
    const row = seq.slice(i, i + 7);
    const line = row
      .map((d) => (d == null ? " " : cell(counts.get(ymd(d)) ?? 0)))
      .join("   ");
    console.log(line);
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    help();
    process.exit(0);
  }
  const today = midnight(new Date());
  const start = addDays(today, -(opts.days - 1));
  const list = await datesSince(ymd(start));
  const counts = new Map();
  for (const day of list) counts.set(day, (counts.get(day) ?? 0) + 1);
  report(opts.days, counts);
}

main().catch((err) => {
  console.error("jejak gagal:", err.message);
  process.exit(2);
});
