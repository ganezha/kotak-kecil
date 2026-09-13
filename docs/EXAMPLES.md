# Contoh CLI

Salin apa adanya. Output disingkat. Isi secret **tidak pernah** muncul.

Syarat: [INSTALL.md](INSTALL.md).

## Di repo kamu (tanpa clone)

```bash
npx --yes github:ganezha/kotak-kecil -- .
npx --yes github:ganezha/kotak-kecil -- --staged
npx --yes github:ganezha/kotak-kecil -- --diff
npx --yes github:ganezha/kotak-kecil -- --json .
npx --yes github:ganezha/kotak-kecil -- --sarif . > han.sip.sarif
npx --yes github:ganezha/kotak-kecil -- pasang
npx --yes github:ganezha/kotak-kecil#v0.3.0 -- --quiet .
```

## GitHub Actions

Salin [`templates/github-actions.yml`](../templates/github-actions.yml) ke `.github/workflows/han.sip.yml`.

Inti:

```yaml
- run: npx --yes github:ganezha/kotak-kecil -- --quiet .
- run: npx --yes github:ganezha/kotak-kecil -- --sarif . > han.sip.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: han.sip.sarif
```

Butuh `permissions: { contents: read, security-events: write }` (repo publik).

Dari root clone `kotak-kecil`, perintah `node han.sip/cli.mjs …` di bawah ini sama artinya.

## han.sip

Ronda malam. `0` sip, `1` bukan sip, `2` gagal jalan.

### Folder (CI)

```bash
node han.sip/cli.mjs .
```

```text
han.sip
ronda: 12 file
sip.
```

Kalau ada temuan:

```text
han.sip
ronda: 12 file

! env-file         .env
! github-token     src/config.js:14

bukan sip. 2 temuan.
Kalau ini pernah masuk git: rotate dulu. Hapus file tidak cukup.
```

Hanya path, baris, kind. Bukan nilai token.

### Git index (pre-commit)

Working tree kotor tidak dihitung. Yang dihitung: `git add`.

```bash
node han.sip/cli.mjs --staged
node han.sip/cli.mjs --staged --quiet
```

`--quiet` / `HAN_SIP_QUIET=1`: tidak nulis apa-apa kalau sip. Tetap teriak kalau bukan.

### Folder lain

```bash
node han.sip/cli.mjs ~/proyek/bot
```

### Bantuan

```bash
node han.sip/cli.mjs --help
```

```text
han.sip — ronda malam untuk git

Usage:
  han.sip [folder]      ronda folder (default .)
  han.sip --staged      ronda file di git index (pre-commit)
  han.sip --quiet       diam kalau sip; teriak kalau bukan

Exit:
  0  sip
  1  bukan sip (temuan)
```

### Pasang hook di repo ini

```bash
node han.sip/pasang.mjs
# han.sip pasang: pre-commit terpasang.

node han.sip/pasang.mjs --check
# han.sip pasang: sip.
```

Commit berikutnya: yang di-stage dironda. Unstaged `.env` tidak menghalangi (itu kerjaan folder scan / CI).

### Diff — hanya baris baru

Secret yang sudah di `HEAD` tidak teriak. Yang baru kamu ketik, iya.

```bash
node han.sip/cli.mjs --diff              # vs HEAD (working tree + index)
node han.sip/cli.mjs --diff origin/main  # PR
node han.sip/cli.mjs --staged --diff     # baris baru di index
```

File belum `git add` tidak masuk `--diff`. Pakai `.` atau `--staged`.

### JSON / SARIF

```bash
node han.sip/cli.mjs --json .
node han.sip/cli.mjs --sarif . > han.sip.sarif
# Actions: upload han.sip.sarif pakai github/codeql-action/upload-sarif
```

`--quiet` tetap nulis JSON. Isi secret tidak ada di payload — hanya `file`, `line`, `kind`, `fp`.

### Ignore

```bash
node han.sip/cli.mjs --ignore 'docs/**' --ignore '*.md' .
```

Atau file di root repo:

```gitignore
# .han.sipignore
vendor/**
docs/EXAMPLES.md
```

### Baseline (repo yang sudah kotor)

```bash
node han.sip/cli.mjs --write-baseline .han.sip-baseline.json .
# exit 0. file berisi fingerprint, bukan token.
git add .han.sip-baseline.json

node han.sip/cli.mjs --baseline .
# sip kalau tidak ada temuan baru
```

Gabung: `--baseline --write-baseline` menulis set *sekarang* (refresh), lalu exit menurut temuan baru vs file lama.

### Yang ditangkap (bentuk, bukan nilai)

File: `.env`, `.env.*` kecuali `.env.example`, `*.pem` `*.key` `*.p12` `*.pfx`, `private.txt`, `id_rsa` / `id_ed25519` dkk.

Isi: private key PEM, `ghp_` / `github_pat_`, token Telegram, `AKIA…`, Slack `xox*`, Stripe, OpenAI, Anthropic, Google `AIza`, `npm_`, GitLab `glpat-`, Hugging Face `hf_`.

Lihat aturan persis di [han.sip.md](han.sip.md).

## jejak

Commit per hari di repo **saat ini**. Graph baru hidup di hari ke-2.

```bash
node jejak/cli.mjs        # 14 hari
node jejak/cli.mjs 7
node jejak/cli.mjs 30
node jejak/cli.mjs --help
```

```text
jejak
14 hari · 9 commit · 6 hari hidup

sen sel rab kam jum sab min
        ·   1   ·   2   ·   1
1   ·   3   ·   ·   1   ·
```

- `·` = 0 commit hari itu
- `1`–`9` = jumlah
- `#` = 10 atau lebih
- spasi di kiri = padding ke Senin
- hari di luar jendela tidak dihitung
- `--all` (semua branch)

Bukan git repo → exit 2, `jejak gagal: bukan git repo`.

Rentang: 1–366. `node jejak/cli.mjs 0` gagal.

## gitignore + env.example

```bash
curl -fsSL https://raw.githubusercontent.com/ganezha/kotak-kecil/main/gitignore/node.gitignore -o .gitignore
curl -fsSL https://raw.githubusercontent.com/ganezha/kotak-kecil/main/templates/env.example -o .env.example
cp .env.example .env
```

`.env.example` boleh berisi *bentuk* token di tes; han.sip **tidak** meronda file bernama `.env.example`.

## Tes (bukan CLI produk, tapi sering dipakai)

```bash
npm test
# node --test tes/*.test.mjs
```

Token di tes dirakit di `tes/palsu.mjs` saat runtime, supaya file tes tidak berbentuk secret.
