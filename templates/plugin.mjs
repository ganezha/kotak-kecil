/**
 * Salin ke `.han.sip/plugins/` atau `han.sip --plugin file.mjs`.
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
