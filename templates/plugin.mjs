/**
 * Salin ke `.han.sip/plugins/` lalu `han.sip --plugins`,
 * atau `han.sip --plugin file.mjs`.
 * Default: folder plugins TIDAK di-load.
 * Plugin = eksekusi kode di proses yang sama. Jangan di tree yang tidak kamu percaya.
 * kind baru = temuan extra. Jangan mencetak nilai.
 */
export const rules = {
  content: [
    // { kind: "acme-key", re: /acme_[A-Za-z0-9]{20,}/ },
  ],
  file: [
    // { kind: "acme-file", test: (name) => name === "secrets.acme" },
  ],
};
