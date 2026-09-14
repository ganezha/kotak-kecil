# Rilis

Belum npm. `private: true` itu disengaja. Distribusi = `npm install github:ganezha/kotak-kecil#<PIN_SHA>`. Rilis = git tag + GitHub Release + changelog.

Nama paket `"han.sip"` bisa tabrakan di registry. Nama repo `kotak-kecil`. Jangan samakan.

## Syarat

- [ ] `npm test` hijau (Node 18, 20, 22 — CI matrix)
- [ ] `node han.sip/cli.mjs .` exit 0 di tree rilis (tidak ada secret)
- [ ] `node jejak/cli.mjs` exit 0
- [ ] CI di `main` hijau
- [ ] Tidak ada `.env`, key, token di diff
- [ ] `package.json` `version` sudah angka baru
- [ ] [CHANGELOG.md](../CHANGELOG.md): `[Unreleased]` dipindah ke `## [X.Y.Z] — YYYY-MM-DD`
- [ ] Link compare di bawah changelog diisi
- [ ] `PIN_SHA` = commit yang berisi **kode rilis**, dan semua copy-paste (README, INSTALL, EXAMPLES, han.sip.md, template Actions) memakai SHA yang sama

## Langkah

1. Tulis perubahan di `CHANGELOG.md`.
2. Set `"version"` di `package.json` (lihat [VERSIONING.md](VERSIONING.md)).
3. Commit kode + docs + changelog di `main` **tanpa** menggeser `PIN_SHA` dulu (atau biarkan pin rilis sebelumnya).
4. Catat SHA commit itu (`git rev-parse HEAD`). Itu SHA yang orang harus pasang.
5. Commit susulan yang **hanya** menggeser `PIN_SHA` + salinan docs/template ke SHA langkah 3.
6. Tag di commit PIN_SHA:

   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin main --follow-tags
   ```

   Jangan tag commit kode kalau pin masih SHA lama — itu bug 0.8.1 (`PIN_SHA` tertinggal satu rilis).

7. GitHub → Releases → **Draft a new release** dari tag `vX.Y.Z`.
   Body = isi seksi changelog versi itu, bukan esai.
   Kalau *immutable releases* aktif: publish setelah draft siap. Tag dan aset terkunci.
8. Jangan `npm publish` selama `"private": true`.
9. Cek dari repo **lain**: `npm install github:ganezha/kotak-kecil#<PIN_SHA>` lalu `npx han.sip --help` harus mencetak usage. Jangan andalkan `npx github:` di npm 10 (GitFetcher).

`npx github:ganezha/kotak-kecil#<40-hex>` mengandalkan commit, bukan tag. Tag yang bisa digeser = pin palsu — itu sebabnya `PIN_SHA` bukan `#vX.Y.Z`.

## Immutable

Pertimbangkan **immutable releases** (repo: Settings → General → Releases → Enable release immutability). Setelah publish:

- tag rilis tidak bisa digeser atau dihapus
- aset rilis tidak bisa ditambah/diubah/dihapus
- judul dan catatan masih bisa diedit

Rilis ini tidak mengunggah aset terpisah (npx ambil tree dari tag). Immutable tetap berguna: mengunci tag.

Salah angka setelah publish: rilis patch. Jangan geser tag.

## Kalau suatu hari npm

Baru setelah ada yang *memakai* tool ini di luar repo ini.

- `"private": false`
- `"name"` di registry (bukan semata `han.sip` kalau nama itu sudah dipakai orang)
- `files` sudah memuat yang perlu: `han.sip/`, `jejak/`, `.githooks/`, `gitignore/`, `templates/`
- `bin` memuat `han.sip` **dan** `jejak`
- Tetap **jangan** `prepare` / `postinstall` yang nulis `.git`
- Pasang hook tetap `node han.sip/pasang.mjs`

## Rollback

Tag yang salah: jangan hapus tag yang sudah diumumkan. Rilis patch. Secret yang ikut ter-tag: rotate dulu, baru bicarakan history. [SECURITY.md](../SECURITY.md).
