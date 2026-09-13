# Pasang

Node **18+** (CI pakai **22**). Git di PATH. Tidak ada dependency npm.

Belum terbit di registry. **Jangan** `npm i han.sip`.

## Satu perintah (cara utama)

Di repo kamu:

```bash
npx --yes github:ganezha/kotak-kecil -- .
```

Pin rilis:

```bash
npx --yes github:ganezha/kotak-kecil#v0.4.0 -- .
```

`--` memisahkan npm dari han.sip. Pakai di depan flag.

`0` = `sip.` = bersih. `1` = ada temuan (jenis + lokasi, **bukan** nilai secret). `2` = gagal jalan — **bukan** aman.

```bash
npx --yes github:ganezha/kotak-kecil -- --help
npx --yes github:ganezha/kotak-kecil -- --staged
npx --yes github:ganezha/kotak-kecil -- --diff
npx --yes github:ganezha/kotak-kecil -- --json .
npx --yes github:ganezha/kotak-kecil -- --sarif . > han.sip.sarif
npx --yes github:ganezha/kotak-kecil -- pasang
```

`pasang` menulis `.git/hooks/pre-commit` di **repo ini**. Tidak global. Tidak lewat `npm prepare`.

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
