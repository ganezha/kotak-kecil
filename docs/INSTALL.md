# Pasang

Node **18+** (CI pakai **22**). Git di PATH. Tidak ada dependency npm.

Belum terbit di registry. **Jangan** `npm i han.sip`.

## Cara utama

Di repo kamu. Pin ke commit SHA (bukan tag yang bisa digeser).

`npx --yes github:…` di npm 10 sering gagal (`GitFetcher requires an Arborist`). Pakai `npm install`:

```bash
npm install github:ganezha/kotak-kecil#38477de22ecaff33198be1e9509ab1de188c17fd
npx han.sip .
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

`pasang` menulis `.git/hooks/pre-commit` di **repo ini**. Tidak global. Tidak lewat `npm prepare`. Hook asing di-backup ke `pre-commit.bak` dulu. Hook yang teriak: cabut secret, **bukan** `git commit --no-verify`.

## GitHub Actions

Salin [`templates/github-actions.yml`](../templates/github-actions.yml) ke `.github/workflows/han.sip.yml`. Itu meronda checkout dan mengunggah SARIF ke code scanning.

## Clone (mengembangkan kotak)

```bash
git clone https://github.com/ganezha/kotak-kecil.git
cd kotak-kecil
node han.sip/cli.mjs --help
npm test
```

Tidak perlu `npm install`. Skrip di `package.json` hanya pintasan.

## gitignore Node yang ketat

```bash
curl -fsSL https://raw.githubusercontent.com/ganezha/kotak-kecil/main/gitignore/node.gitignore -o .gitignore
```

## Kerangka `.env`

```bash
curl -fsSL https://raw.githubusercontent.com/ganezha/kotak-kecil/main/templates/env.example -o .env.example
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
