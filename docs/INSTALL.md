# Pasang

Node **18+** (CI pakai **22**). Git di PATH. Tidak ada dependency npm.

Belum terbit di registry. Jangan `npm i han.sip`.

## Clone (cara utama)

```bash
git clone https://github.com/ganezha/kotak-kecil.git
cd kotak-kecil
node han.sip/cli.mjs --help
node jejak/cli.mjs --help
npm test
```

Tidak perlu `npm install`. Skrip di `package.json` hanya pintasan:

```bash
npm run han.sip          # ronda folder .
npm run han.sip:staged   # ronda git index
npm run han.sip:pasang   # pre-commit di repo ini
npm run jejak            # 14 hari
```

## Pakai di repo lain, tanpa clone toolbox

Salin file, atau rujuk path absolut ke clone.

```bash
# dari repo kamu, kalau kotak-kecil ada di samping
node ../kotak-kecil/han.sip/cli.mjs --staged
node ../kotak-kecil/jejak/cli.mjs 30
```

Hook pre-commit di repo *ini* (kotak-kecil) dipasang manual:

```bash
node han.sip/pasang.mjs
node han.sip/pasang.mjs --check
```

Itu nulis shim `0755` di `.git/hooks/pre-commit` → `node .githooks/pre-commit.mjs`. Tidak global. Tidak lewat `npm prepare`.

Kalau `han.sip/cli.mjs` tidak ada di repo target, hook fallback ke:

```bash
npx --yes github:ganezha/kotak-kecil -- --staged --quiet
```

## gitignore Node yang ketat

```bash
curl -fsSL https://raw.githubusercontent.com/ganezha/kotak-kecil/main/gitignore/node.gitignore -o .gitignore
```

Menutup `.env`, `.env.*` (kecuali `.env.example`), `*.pem` / `*.key` / `*.p12` / `*.pfx`, `private.txt`, `secrets/`.

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
| git | wajib untuk `--staged`, `pasang`, `jejak` |
| OS | apa pun yang punya `git` + `node` |

Exit: `0` sip, `1` temuan (han.sip), `2` gagal jalan (bukan git repo, git hilang, dsb).
