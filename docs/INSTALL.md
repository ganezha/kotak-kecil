# Pasang

Node **18+** (CI menguji **18 / 20 / 22**). Git di PATH. Tidak ada dependency npm.

Belum terbit di registry. Repo = **kotak-kecil**, bin = `han.sip` + `jejak`. **Jangan** `npm i han.sip`.

## Cara utama

Di repo kamu. Pin ke commit SHA (bukan tag yang bisa digeser).

`npx --yes github:…` di npm 10 sering gagal (`GitFetcher requires an Arborist`). Pakai `npm install`:

```bash
npm install github:ganezha/kotak-kecil#fa0b9ce08b794cc18f6fabbbcbc20973a3752911
npx han.sip .
npx jejak
```

`0` = `sip.` = bersih. `1` = ada temuan (jenis + lokasi, **bukan** nilai secret). `2` = gagal jalan — **bukan** aman.

```bash
npx han.sip --help
npx han.sip --staged
npx han.sip --diff
npx han.sip --json .
npx han.sip --sarif . > han.sip.sarif
npx han.sip pasang
```

`pasang` menulis `.git/hooks/pre-commit` di **repo ini**. Tidak global. Tidak lewat `npm prepare`.

Hook asing: **di-chain** — salinan ke `pre-commit.han.sip-prev` (dijalankan dulu), lalu shim han.sip. Cadangan `pre-commit.bak` (atau `.bak.<epoch>`) tetap ada. Bukan hanya timpa + bak.

Hook yang teriak: cabut secret, **bukan** `git commit --no-verify`.

`--` mengakhiri flag han.sip (Unix). `--` milik npm (pemisah `npx`) sudah dimakan npm sebelum argv sampai ke kita.

## GitHub Actions

Salin [`templates/github-actions.yml`](../templates/github-actions.yml) ke `.github/workflows/han.sip.yml`. Itu meronda checkout dan mengunggah SARIF ke code scanning.

## Clone (mengembangkan kotak)

```bash
git clone https://github.com/ganezha/kotak-kecil.git
cd kotak-kecil
node han.sip/cli.mjs --help
npm test
```

Tidak perlu `npm install`. Skrip di `package.json` hanya pintasan. Tes jalan di Node 18+ (`import.meta.url`, bukan `import.meta.dirname`).

## gitignore Node yang ketat

Pin SHA, **bukan** `main` (bergerak). **Jangan** `-o .gitignore` — itu menimpa ignore yang sudah ada.

```bash
curl -fsSL https://raw.githubusercontent.com/ganezha/kotak-kecil/fa0b9ce08b794cc18f6fabbbcbc20973a3752911/gitignore/node.gitignore -o gitignore.node
# gabung manual ke .gitignore kamu
```

## Kerangka `.env`

```bash
curl -fsSL https://raw.githubusercontent.com/ganezha/kotak-kecil/fa0b9ce08b794cc18f6fabbbcbc20973a3752911/templates/env.example -o env.example.kotak
cp env.example.kotak .env.example
cp .env.example .env
# isi .env lokal. jangan git add .env
```

## Syarat jalan

| | |
|---|---|
| Node | 18+, ESM (`"type": "module"`) |
| git | wajib untuk `--staged`, `pasang`, `jejak`, `--diff` |
| OS | apa pun yang punya `git` + `node` |

Exit: `0` sip, `1` temuan (han.sip), `2` gagal jalan.
