# han.sip — desain

Satu tugas: temukan file dan string berbentuk secret **sebelum** masuk GitHub. Tidak mencetak secret.

Baca [cli.mjs](../han.sip/cli.mjs) dulu. File ini hanya yang tidak kentara dari kode.

## Tiga file

| File | Urusan |
|---|---|
| `han.sip/cli.mjs` | Argumen, laporan ke manusia, exit code |
| `han.sip/ronda.mjs` | Walk, aturan, baca index |
| `han.sip/pasang.mjs` | Shim pre-commit di `.git` repo **ini** |

`.githooks/pre-commit.mjs` ikut di-commit. `.git/hooks/pre-commit` tidak.

## Dua mode baca

**Folder** (`han.sip [dir]`): isi *working tree*. Untuk CI.

**Staged** (`--staged`): isi *git index*. `git diff --cached --name-only -z --diff-filter=ACMR`, lalu `git show :path`. Working tree yang sudah diubah sesudah `git add` **tidak** dihitung.

Itu disengaja. Pre-commit menjaga yang akan masuk commit, bukan sampah di disk.

Tes yang mengunci ini: `unstaged .env: --staged sip` dan `staged .env: --staged baca index`.

## Yang tidak dilakukan

- Tidak mencetak nilai. Laporan: `kind`, path, nomor baris (`0` = aturan nama file).
- Tidak kirim jaringan.
- Tidak rewrite history, tidak `git rm`. Orang yang ketahuan harus **rotate**.
- Tidak global. `pasang` hanya toplevel git saat ini.
- Tidak `npm prepare` / `postinstall`. Install tidak boleh nulis `.git`.

## Walk

Lewati: `.git`, `node_modules`, `dist`, `build`, `coverage`, `.next`, `.turbo`, `.out`, folder tersembunyi lain.

Pengecualian: **`.github`** tetap diwalk — workflow bisa nyimpan token.

Lewati ekstensi biner (`png` `jpg` `pdf` `zip` `woff` …). File `> 512 KiB` atau kosong: nama tetap dicek, isi tidak. Null byte → isi tidak discan (bukan teks).

## Aturan

`FILE_RULES` — nama:

- `.env` dan `.env.*`
- `*.pem` `*.key` `*.p12` `*.pfx`
- `private.txt`
- `id_rsa` `id_dsa` `id_ecdsa` `id_ed25519`

`CONTENT_RULES` — regex di baris. Ambang panjang sengaja tinggi supaya `ghp_short` tidak lolos.

`ALLOW_FILE`: hanya `.env.example`. Isi contoh di situ tidak ditangkap. Jangan taruh nilai hidup di `.env.example`.

Hit unik: `file:line:kind`.

## Exit

| Code | Arti |
|---|---|
| 0 | sip |
| 1 | temuan |
| 2 | tidak bisa ronda (git hilang, bukan repo, I/O) |

Pre-commit **fail closed**: node/git hilang → commit ditolak (`2`), bukan dilepas.

## Pasang

Git tree sering `0644`, jadi `pasang` tidak andalkan bit `+x` pada `.githooks/pre-commit.mjs`. Yang dieksekusi git: shim shell `0755`:

```sh
root="$(git rev-parse --show-toplevel)" || exit 2
exec node "$root/.githooks/pre-commit.mjs"
```

`--check` memastikan file hook ada dan mengandung marker itu.

Hook sendiri: pakai `han.sip/cli.mjs --staged --quiet` kalau ada di repo; kalau tidak, `npx --yes github:ganezha/kotak-kecil -- --staged --quiet`.

## Batas yang disengaja

Bukan SAST. Bukan entropy scanner. Tidak dekripsi. False negative ada (token custom, secret di biner, file > 512 KiB). False positive mungkin (contoh di README) — kind yang salah lebih baik daripada diam.

Kind baru = versi minor. Lihat [VERSIONING.md](VERSIONING.md).
