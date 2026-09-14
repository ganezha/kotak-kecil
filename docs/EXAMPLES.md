# Contoh CLI

Salin apa adanya. Output disingkat. Isi secret **tidak pernah** muncul.

Syarat: [INSTALL.md](INSTALL.md). Node 18+.

## Di repo kamu

```bash
npm install github:ganezha/kotak-kecil#38477de22ecaff33198be1e9509ab1de188c17fd
npx han.sip .
npx han.sip --staged
npx han.sip --diff
npx han.sip --json .
npx han.sip --sarif . > han.sip.sarif
npx han.sip pasang
```

## Hasil

```text
sip.                         bersih. exit 0
! github-token  src/x.js:4   jenis + lokasi. bukan nilai token. exit 1
han.sip gagal: bukan git repo
                             tool tidak jalan. exit 2
```

`! env-file .env` = file itu tidak boleh masuk git. Bukan “isi `.env` dicetak”.

Kalau ini pernah di-commit: **rotate** token. `git rm` tidak cukup.

## GitHub Actions

Salin [`templates/github-actions.yml`](../templates/github-actions.yml) ke `.github/workflows/han.sip.yml`.

Inti:

```yaml
- run: npm install github:ganezha/kotak-kecil#38477de22ecaff33198be1e9509ab1de188c17fd
- run: npx han.sip --quiet .
- run: npx han.sip --sarif . > han.sip.sarif
- uses: github/codeql-action/upload-sarif@faaca9a8f6edddba5725ffe5adefdab6669a2eca # v3.38.0
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
npx han.sip --help
node han.sip/cli.mjs --help
```

Isi `--help` ikut versi. Jangan menghafal dump di sini.

### Pasang hook di repo ini

```bash
npx han.sip pasang
# han.sip pasang: pre-commit terpasang.

npx han.sip pasang --check
# han.sip pasang: sip.
```

Commit berikutnya: yang di-stage dironda. Unstaged `.env` tidak menghalangi (itu kerjaan folder scan / CI).

Kalau `.git/hooks/pre-commit` sudah ada dan **bukan** punya han.sip: file lama disalin ke `pre-commit.bak` (atau `.bak.<epoch>` kalau cadangan itu sudah ada), baru ditimpa. Baca cadangan sebelum commit berikutnya.

**Jangan** `git commit --no-verify`. Hook yang teriak = ada secret di index. Cabut dari stage. Kalau sudah pernah masuk history: rotate, baru (kalau perlu) baseline.

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

`--quiet` tetap nulis JSON. Isi secret tidak ada di payload — `file`, `line`, `kind`, `fp` (128 bit), `sha256` (penuh). Bukan plaintext. Lihat [SECURITY.md](../SECURITY.md).

`ok: true` = sip. `ok: false` = ada temuan. `hits[].kind` + `hits[].file` — tidak ada nilai token.

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

Baseline = temuan yang **diterima / di-suppress**. Bukan berarti secret itu aman, hilang, atau sudah di-rotate.

```bash
node han.sip/cli.mjs --write-baseline .han.sip-baseline.json .
# exit 0. file berisi fingerprint turunan + note, bukan token.
# note: "diterima/di-suppress, bukan aman."
git add .han.sip-baseline.json

node han.sip/cli.mjs --baseline .
# sip kalau tidak ada temuan *baru*
# "sip. N diterima di baseline — bukan aman."
```

Kalau nilai itu sempat masuk git: **rotate dulu**, baru tulis baseline. Baseline bukan pengganti rotate. Bukan alasan `git commit --no-verify`.

Gabung: `--baseline --write-baseline` menulis set *sekarang* (refresh), lalu exit menurut temuan baru vs file lama.

### Yang ditangkap (bentuk, bukan nilai)

File: `.env`, `.env.*` kecuali nama `.env.example`, `*.p12` `*.pfx`, `private.txt`, `id_rsa` / `id_ed25519` dkk. `*.pem` `*.key` hanya kalau private key / kosong / tidak terbaca — sertifikat publik (`fullchain.pem`, `cert.pem`) bukan temuan.

`.env.example` tidak dihitung `env-file`. **Isinya tetap dironda.** `API_KEY=` lolos. Token berbentuk secret di situ tidak.

Isi: private key PEM, `ghp_` / `github_pat_`, token Telegram, `AKIA…` + secret 40 karakter dekatnya, Slack `xox*`, Stripe, OpenAI `sk-` (klasik, proj, svcacct), Anthropic `sk-ant-`, Google `AIza`, `npm_`, GitLab `glpat-`, Hugging Face `hf_`, seed phrase 12/24 kata plus konteks (`seed` / `mnemonic` / `recovery` / `wallet`).

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

`.env.example` untuk nilai **kosong**. Token berbentuk secret di file itu = temuan. Model: [SECURITY.md](../SECURITY.md).

## Tes (bukan CLI produk, tapi sering dipakai)

```bash
npm test
# node --test tes/*.test.mjs
```

Token di tes dirakit di `tes/palsu.mjs` saat runtime, supaya file tes tidak berbentuk secret.
