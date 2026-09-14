# han.sip — desain

Satu tugas: temukan file dan string berbentuk secret **sebelum** masuk GitHub. Tidak mencetak secret.

Baca [cli.mjs](../han.sip/cli.mjs) dulu. File ini hanya yang tidak kentara dari kode.

## File

| File | Urusan |
|---|---|
| `han.sip/cli.mjs` | Argumen, pilih mode, exit code |
| `han.sip/ronda.mjs` | Walk, aturan, index, diff, ignore, fingerprint |
| `han.sip/lapor.mjs` | Manusia, JSON, SARIF, baseline |
| `han.sip/pasang.mjs` | Shim pre-commit di `.git` repo **ini** |
| `han.sip/plugin.mjs` | Muat aturan extra |

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

Lewati: `.git`, `node_modules`, `dist`, `build`, `coverage`, `.next`, `.turbo`, `.out`.

Folder tersembunyi **tetap** diwalk (`.github`, `.hidden`, `.ssh`, `.config`, …). `.git` tidak — itu objek git, bukan sumber.

Lewati ekstensi biner (`png` `jpg` `pdf` `zip` `woff` …). File kosong: nama tetap dicek, isi tidak. File `> 512 KiB`: isi di-stream (chunk), bukan di-skip. Null byte → isi tidak discan (bukan teks).

Symlink **tidak diikuti** — file maupun folder. Target di luar repo tidak dibaca (traversal).

## Aturan

`FILE_RULES` — nama:

- `.env` dan `.env.*`
- `*.p12` `*.pfx`
- `private.txt`
- `id_rsa` `id_dsa` `id_ecdsa` `id_ed25519`

`*.pem` / `*.key`: nama = sinyal lemah. Temuan `key-file` hanya kalau file kosong atau tidak terbaca. Isi `BEGIN … PRIVATE KEY` tertangkap `private-key`, bukan dobel. `BEGIN CERTIFICATE` (fullchain.pem, cert.pem) bukan temuan.

`CONTENT_RULES` — regex di baris. Ambang panjang sengaja tinggi supaya `ghp_short` tidak lolos. Span yang sudah tertangkap aturan lain dilewati (mis. `sk-ant-` = Anthropic, bukan OpenAI).

OpenAI: `sk-` + 20+ (klasik, `sk-proj-`, `sk-svcacct-`). Bukan hanya proj/svcacct.

AWS secret: 40 karakter `[A-Za-z0-9/+=]`, hanya di baris dekat `AKIA` / `AWS_SECRET` / `aws_secret_access_key`. Bukan entropy buta di seluruh file.

`generic-secret`: kandidat 24+ dengan **confidence** 0–1. Teriak kalau skor ≥ 0.6. Naik kalau ada kata `secret` / `token` / `password` / `api_key` / `bearer` di baris yang sama, entropy tinggi, atau bentuk JWT `eyJ….….…`. Turun untuk SHA hex 40/64, `sha512-` npm, URL. Span yang sudah tertangkap named rule tidak dobel. JSON/SARIF: `conf` / `properties.confidence`. Nilai tidak dicetak.

Seed phrase: 12 atau 24 kata Latin lowercase dipisah spasi, plus konteks `seed` / `mnemonic` / `recovery` / `wallet` di baris itu atau tetangga. Tanpa konteks tidak teriak (README).

`.env.example`: nama file **bukan** temuan `env-file`. Isi **tetap** dironda. `API_KEY=` lolos. `ghp_…` di file itu = temuan. Model: [SECURITY.md](../SECURITY.md).

Hit unik: fingerprint `sha256(kind || NUL || posix(file) || NUL || potongan cocok)`. **`fp`** = 32 hex (128 bit). **`sha256`** = 64 hex penuh. Potongan itu material yang cocok rule (bisa secret). Hash satu arah, tidak disimpan sebagai plaintext, tidak dicetak. Bukan credential — tetap bukti bahwa string berbentuk secret ada di path itu.

Baseline v1 (16 hex) tidak match v2. Tulis ulang `--write-baseline` setelah upgrade.

## Ignore

`--ignore <pola>` bisa diulang. Plus file `.han.sipignore` di root git (gitignore-lite: `#`, `*`, `**`, pola tanpa `/` = nama file di path mana pun). Dihitung sebelum baca isi.

## Baseline

Repo lama yang sudah kena temuan tidak bisa memakai tool kalau setiap CI merah. Baseline **bukan** stempel aman.

`--write-baseline [file]` (default `.han.sip-baseline.json`) menulis `{ version: 2, note, hits: [{ file, kind, fp, sha256 }] }`. `note`: diterima/di-suppress, bukan aman. `--baseline` membuang hit yang `fp`-nya sudah ada: exit 0 kalau sisanya kosong. Temuan baru tetap `1`. JSON: `baseline.safe` selalu `false`.

`--write-baseline` tanpa `--baseline` = snapshot, exit 0 meski ada temuan — tetap “diterima, bukan aman”.

Kalau nilai itu sempat masuk git: rotate dulu, baru baseline. `--write-baseline` tanpa rotate = memilih diam. Bukan pengganti `git commit --no-verify` — itu dua cara berbeda untuk mengabaikan temuan; keduanya salah.

## Mesin

`--json` / `--sarif` ke stdout. `--quiet` tidak menekan JSON/SARIF. Pilih satu. SARIF 2.1.0, `startLine >= 1`, `partialFingerprints["han.sip/v2"]` (128 bit) dan `["han.sip/sha256"]` (penuh). Redirect: `han.sip --sarif > han.sip.sarif`.

## Plugin

`--plugin <file.mjs>` bisa diulang. Plus auto `.han.sip/plugins/*.mjs` di root repo.

```js
export const rules = {
  content: [{ kind: "acme-key", re: /acme_[A-Za-z0-9]{20,}/ }],
  file: [{ kind: "acme-file", test: (name) => name === "secrets.acme" }],
};
```

Contoh: [`templates/plugin.mjs`](../templates/plugin.mjs). kind baru = temuan extra. Plugin rusak → exit 2. Builtin tidak bisa dihapus dari plugin.

## Exit

| Code | Arti |
|---|---|
| 0 | sip |
| 1 | temuan baru (bukan yang di baseline) |
| 2 | tidak bisa ronda (git hilang, bukan repo, I/O) |

Pre-commit **fail closed**: node/git hilang → commit ditolak (`2`), bukan dilepas.

## Pasang

Git tree sering `0644`, jadi `pasang` tidak andalkan bit `+x`. Yang dieksekusi git: shim shell `0755`:

```sh
root="$(git rev-parse --show-toplevel)" || exit 2
prev="$(dirname "$0")/pre-commit.han.sip-prev"
if [ -f "$prev" ]; then
  if [ -x "$prev" ]; then
    "$prev" "$@" || exit $?
  else
    /bin/sh "$prev" "$@" || exit $?
  fi
fi
if [ -f "$root/han.sip/cli.mjs" ]; then
  exec node "$root/han.sip/cli.mjs" --staged --quiet
fi
exec npx --yes github:ganezha/kotak-kecil#211cc004f3486a602f89cd50e11ffb5f6dad7c8b -- --staged --quiet
```

Pin = commit SHA 40 hex (`PIN_SHA` di `pasang.mjs`), bukan tag `#v`. Tag bisa digeser.

`--check` memastikan file hook ada dan mengandung marker kita (termasuk hook lama yang menunjuk `.githooks/pre-commit.mjs`).

Hook asing (tidak ada marker): disalin ke `pre-commit.han.sip-prev` lalu **di-chain** (prev dulu, han.sip kemudian). Cadangan `pre-commit.bak` (atau `.bak.<epoch>`) tetap ada. Prev yang exit ≠ 0 menggagalkan commit — han.sip tidak dijalankan. Hook kita ditimpa tanpa cadangan — itu upgrade pin. `.githooks/pre-commit.mjs` memakai `NPX` yang sama.

`han.sip pasang` (atau `node han.sip/pasang.mjs`) jalan di repo **mana pun**. Tidak perlu menyalin `.githooks`.

Pre-commit yang teriak: cabut secret dari index. **Jangan** `git commit --no-verify`.

npx memakai symlink `.bin/han.sip` → `cli.mjs`. `main()` membandingkan `realpath(argv[1])` dengan `import.meta.url` supaya shim itu tidak diam.

## Batas yang disengaja

Bukan SAST. Bukan entropy scanner. Tidak dekripsi. False negative ada (token custom, secret di biner, file > 512 KiB). False positive mungkin (contoh di README) — kind yang salah lebih baik daripada diam.

Kind baru = versi minor. Lihat [VERSIONING.md](VERSIONING.md).
