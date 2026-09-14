#!/usr/bin/env node
/**
 * Benchmark ronda. Bukan tes CI. npm run bench
 * HAN_SIP_BENCH_FILES (default 200), HAN_SIP_BENCH_BYTES (default 4096).
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MAX_BYTES, scanFolder } from "../han.sip/ronda.mjs";
import { palsu } from "./palsu.mjs";

const N = Number(process.env.HAN_SIP_BENCH_FILES || 200);
const SIZE = Number(process.env.HAN_SIP_BENCH_BYTES || 4096);

const dir = await mkdtemp(path.join(tmpdir(), "han-sip-bench-"));
try {
  const token = palsu.github();
  for (let i = 0; i < N; i += 1) {
    const body =
      i % 17 === 0
        ? `const t = "${token}"\n${"x".repeat(SIZE)}`
        : `const ok = 1;\n${"y".repeat(SIZE)}`;
    await writeFile(path.join(dir, `f${i}.js`), body);
  }
  await writeFile(
    path.join(dir, "big.js"),
    `${"z".repeat(MAX_BYTES + 8)}\nconst t = "${token}"\n`,
  );
  const t0 = performance.now();
  const { count, hits } = await scanFolder(dir);
  const ms = performance.now() - t0;
  const bytes = N * (SIZE + 24) + MAX_BYTES + 32;
  const sec = ms / 1000;
  console.log("han.sip bench");
  console.log(`files ${count}  hits ${hits.length}  ${ms.toFixed(1)} ms`);
  console.log(
    `${(count / sec).toFixed(0)} files/s  ${(bytes / 1024 / 1024 / sec).toFixed(1)} MiB/s`,
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
