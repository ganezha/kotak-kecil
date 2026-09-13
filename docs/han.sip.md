# han.sip — desain

Satu tugas: temukan file dan string berbentuk secret **sebelum** masuk GitHub. Tidak mencetak secret.

Baca [cli.mjs](../han.sip/cli.mjs) dulu. File ini hanya yang tidak kentara dari kode.

## Empat file

| File | Urusan |
|---|---|
| `han.sip/cli.mjs` | Argumen, pilih mode, exit code |
| `han.sip/ronda.mjs` | Walk, aturan, index, diff, ignore, fingerprint |
| `han.sip/lapor.mjs` | Manusia, JSON, SARIF, baseline |
| `han.sip/pasang.mjs` | Shim pre-commit di `.git` repo **ini** |

`.githooks/pre-commit.mjs` ikut di-commit. `.git/hooks/pre-commit` tidak.

## Tiga mode baca

**Folder** (`han.sip [dir]`): isi *working tree*. Untuk CI.

**Staged** (`--staged`): isi *git index*. `git diff --cached --name-only -z --diff-filter=ACMR`, lalu `git show :path`. Working tree yang sudah diubah sesudah `git add` **tidak** dihitung.

**Diff** (`--diff [ref]`): hanya baris `+` dari `git diff -U0 --diff-filter=ACMR <ref>`. Default ref `HEAD`. File untracked tidak kelihatan — itu kerjaan folder scan atau `git add` lalu `--staged`. `--staged --diff` = baris baru di index.

Itu disengaja. Pre-commit menjaga yang akan masuk commit, bukan sampah di disk. `--diff` biar secret *lama* di file yang kamu sentuh tidak menggagalkan setiap commit.

Tes yang mengunci ini: `unstaged .env: --staged sip`, `staged .env: --staged baca index`, `--diff: hanya baris baru`.

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

Hit unik: fingerprint `sha256(kind + file + potongan cocok)` 16 hex. Nilai secret di-hash, tidak disimpan, tidak dicetak.

## Ignore

`--ignore <pola>` bisa diulang. Plus file `.han.sipignore` di root git (gitignore-lite: `#`, `*`, `**`, pola tanpa `/` = nama file di path mana pun). Dihitung sebelum baca isi.

## Baseline

Repo lama yang sudah kena temuan tidak bisa memakai tool kalau setiap CI merah. `--write-baseline [file]` (default `.han.sip-baseline.json`) menulis `{ version, hits: [{ file, kind, fp }] }`. `--baseline` membuang hit yang `fp`-nya sudah ada: exit 0 kalau sisanya kosong. Temuan baru tetap `1`.

`--write-baseline` tanpa `--baseline` = snapshot, exit 0 meski ada temuan.

## Mesin

`--json` / `--sarif` ke stdout. `--quiet` tidak menekan JSON/SARIF. Pilih satu. SARIF 2.1.0, `startLine >= 1`, `partialFingerprints["han.sip/v1"]`. Redirect: `han.sip --sarif > han.sip.sarif`.

## Exit

| Code | Arti |
|---|---|
| 0 | sip |
| 1 | temuan baru (bukan yang di baseline) |
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
