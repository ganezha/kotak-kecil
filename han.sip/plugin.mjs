/**
 * Plugin aturan extra. Builtin tetap di ronda.mjs.
 *
 *   export const rules = {
 *     content: [{ kind: "acme-key", re: /acme_[A-Za-z0-9]{20,}/ }],
 *     file: [{ kind: "acme-file", test: (name) => name === "secrets.acme" }],
 *   };
 *
 * --plugin <file.mjs> (bisa diulang). Plus auto `.han.sip/plugins/*.mjs`.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CONTENT_RULES, FILE_RULES } from "./ronda.mjs";

export const PLUGIN_DIR = path.join(".han.sip", "plugins");

export function normalizeContent(rule) {
  if (!rule || !rule.kind) throw new Error("plugin content: butuh kind");
  const kind = String(rule.kind);
  if (kind.includes("\0") || !kind.trim()) throw new Error("plugin content: kind kosong");
  if (rule.re) {
    const re = rule.re instanceof RegExp ? rule.re : new RegExp(String(rule.re));
    return { kind, re };
  }
  throw new Error(`plugin content ${kind}: butuh re`);
}

export function normalizeFile(rule) {
  if (!rule || !rule.kind || typeof rule.test !== "function") {
    throw new Error("plugin file: butuh kind dan test(name)");
  }
  return { kind: String(rule.kind), test: rule.test };
}

export async function loadPluginModule(abs) {
  let mod;
  try {
    mod = await import(pathToFileURL(abs).href);
  } catch (err) {
    throw new Error(`plugin gagal dimuat: ${path.basename(abs)} (${err.message})`);
  }
  const rules = mod.rules || mod.default || {};
  return {
    path: abs,
    content: (rules.content || []).map(normalizeContent),
    file: (rules.file || []).map(normalizeFile),
  };
}

export async function loadPluginDir(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
  const out = [];
  for (const name of names.sort()) {
    if (!name.endsWith(".mjs")) continue;
    out.push(await loadPluginModule(path.join(dir, name)));
  }
  return out;
}

export function mergeRules(plugins) {
  if (!plugins.length) {
    return { content: CONTENT_RULES, file: FILE_RULES };
  }
  const content = CONTENT_RULES.slice();
  const file = FILE_RULES.slice();
  for (const p of plugins) {
    content.push(...p.content);
    file.push(...p.file);
  }
  return { content, file };
}

export async function loadPlugins({ root, files = [] } = {}) {
  const plugins = [];
  for (const rel of files) {
    const abs = path.isAbsolute(rel) ? rel : path.resolve(root, rel);
    plugins.push(await loadPluginModule(abs));
  }
  plugins.push(...(await loadPluginDir(path.join(root, PLUGIN_DIR))));
  return { plugins, rules: mergeRules(plugins) };
}
