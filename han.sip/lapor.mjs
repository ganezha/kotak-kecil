/**
 * Laporan: manusia, JSON, SARIF.
 * Baseline menyimpan fingerprint turunan (SHA-256 dipotong), bukan plaintext.
 * Baseline = temuan yang diterima/di-suppress — bukan “aman”.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { posixPath } from "./ronda.mjs";

export const DEFAULT_BASELINE = ".han.sip-baseline.json";
export const BASELINE_NOTE =
  "diterima/di-suppress, bukan aman. Kalau sempat masuk git: rotate.";

function where(hit) {
  return hit.line ? `${hit.file}:${hit.line}` : hit.file;
}

function modeTag({ staged, diff }) {
  if (staged && diff) return " (staged diff)";
  if (staged) return " (staged)";
  if (diff) return " (diff)";
  return "";
}

export function printHuman({ count, hits, staged, diff, quiet, suppressed }) {
  const extra = modeTag({ staged, diff });
  const accepted = suppressed
    ? `${suppressed} diterima di baseline — bukan aman.`
    : "";
  if (hits.length === 0) {
    if (!quiet) {
      console.log("han.sip");
      console.log(`ronda: ${count} file${extra}`);
      console.log(accepted ? `sip. ${accepted}` : "sip.");
    }
    return 0;
  }

  console.log("han.sip");
  if (!quiet) console.log(`ronda: ${count} file${extra}`);
  console.log("");
  for (const hit of hits) {
    console.log(`! ${hit.kind.padEnd(16)} ${where(hit)}`);
  }
  console.log("");
  const base = accepted ? ` ${accepted}` : "";
  console.log(`bukan sip. ${hits.length} temuan.${base}`);
  console.log("Kalau ini pernah masuk git: rotate dulu. Hapus file tidak cukup.");
  return 1;
}

function publicHit({ file, line, kind, fp }) {
  return { file: posixPath(file), line, kind, fp };
}

export function toJson({
  count,
  hits,
  staged,
  diff,
  suppressed,
  baseline,
  wrote,
  ok,
}) {
  const body = {
    ok: typeof ok === "boolean" ? ok : hits.length === 0,
    count,
    staged: Boolean(staged),
    diff: diff || false,
    hits: hits.map(publicHit),
  };
  if (baseline) {
    body.baseline = {
      file: baseline,
      suppressed: suppressed || 0,
      safe: false,
    };
  }
  if (wrote) body.wrote = wrote;
  return `${JSON.stringify(body, null, 2)}\n`;
}

export function toSarif({ hits, version }) {
  const kinds = [...new Set(hits.map((h) => h.kind))];
  const body = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "han.sip",
            version,
            informationUri: "https://github.com/ganezha/kotak-kecil",
            rules: kinds.map((id) => ({
              id,
              shortDescription: { text: id },
              helpUri:
                "https://github.com/ganezha/kotak-kecil/blob/main/docs/han.sip.md",
            })),
          },
        },
        results: hits.map((h) => {
          const result = {
            ruleId: h.kind,
            level: "error",
            message: { text: h.kind },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: posixPath(h.file) },
                  region: { startLine: Math.max(1, h.line || 1) },
                },
              },
            ],
          };
          if (h.fp) result.partialFingerprints = { "han.sip/v1": h.fp };
          return result;
        }),
      },
    ],
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

export async function readBaseline(file) {
  try {
    const raw = JSON.parse(await readFile(file, "utf8"));
    const fps = new Set((raw.hits ?? []).map((h) => h.fp).filter(Boolean));
    return { file, fps };
  } catch (err) {
    if (err && err.code === "ENOENT") return { file, fps: new Set() };
    throw new Error(`baseline rusak: ${path.basename(file)}`);
  }
}

export function splitBaseline(hits, fps) {
  if (!fps || fps.size === 0) return { hits, suppressed: 0 };
  const neu = [];
  let suppressed = 0;
  for (const h of hits) {
    if (h.fp && fps.has(h.fp)) suppressed += 1;
    else neu.push(h);
  }
  return { hits: neu, suppressed };
}

export async function writeBaseline(file, hits) {
  const body = {
    version: 1,
    note: BASELINE_NOTE,
    hits: hits.map(({ file: f, kind, fp }) => ({
      file: posixPath(f),
      kind,
      fp,
    })),
  };
  await writeFile(file, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}
