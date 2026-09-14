# Rilis

Belum npm. `private: true` itu disengaja. Distribusi = `npx github:ganezha/kotak-kecil`. Rilis = git tag + GitHub Release + changelog.

## Syarat

- [ ] `npm test` hijau
- [ ] `node han.sip/cli.mjs .` exit 0 di tree rilis (tidak ada secret)
- [ ] `node jejak/cli.mjs` exit 0
- [ ] CI di `main` hijau
- [ ] Tidak ada `.env`, key, token di diff
- [ ] `package.json` `version` sudah angka baru
- [ ] [CHANGELOG.md](../CHANGELOG.md): `[Unreleased]` dipindah ke `## [X.Y.Z] — YYYY-MM-DD`
- [ ] Link compare di bawah changelog diisi

## Langkah

1. Tulis perubahan di `CHANGELOG.md`.
2. Set `"version"` di `package.json` (lihat [VERSIONING.md](VERSIONING.md)).
3. Commit di `main`:

   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Release vX.Y.Z"
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin main --follow-tags
   ```

4. GitHub → Releases → **Draft a new release** dari tag `vX.Y.Z`.
   Body = isi seksi changelog versi itu, bukan esai.
   Kalau *immutable releases* aktif: publish setelah draft siap. Tag dan aset terkunci.
5. Jangan `npm publish` selama `"private": true`.
6. Cek dari repo **lain**: `npx --yes github:ganezha/kotak-kecil#vX.Y.Z -- --help` harus mencetak usage.

## Immutable

Pertimbangkan **immutable releases** (repo: Settings → General → Releases → Enable release immutability). Setelah publish:

- tag rilis tidak bisa digeser atau dihapus
- aset rilis tidak bisa ditambah/diubah/dihapus
- judul dan catatan masih bisa diedit

`npx github:ganezha/kotak-kecil#vX.Y.Z` mengandalkan tag itu. Tag yang bisa digeser = pin palsu.

Rilis ini tidak mengunggah aset terpisah (npx ambil tree dari tag). Immutable tetap berguna: mengunci tag.

Salah angka setelah publish: rilis patch. Jangan geser tag.

## Kalau suatu hari npm

Baru setelah ada yang *memakai* tool ini di luar repo ini.

- `"private": false`
- `"name"` di registry (bukan semata `han.sip` kalau nama itu sudah dipakai orang)
- `files` sudah memuat yang perlu: `han.sip/`, `jejak/`, `.githooks/`, `gitignore/`, `templates/`
- Tetap **jangan** `prepare` / `postinstall` yang nulis `.git`
- Pasang hook tetap `node han.sip/pasang.mjs`

## Rollback

Tag yang salah: jangan hapus tag yang sudah diumumkan. Rilis patch. Secret yang ikut ter-tag: rotate dulu, baru bicarakan history. [SECURITY.md](../SECURITY.md).
