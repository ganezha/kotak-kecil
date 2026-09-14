# KOTAK kecil

Kotak perkakas MIT milik [Ganezha](https://github.com/ganezha). Satu tool, satu tugas.

A public toolbox. Small tools, one job each.

Repo ini **kotak-kecil**. Paket npm (belum registry) bernama `"han.sip"` — itu nama bin, bukan nama kotak. **Jangan** `npm i han.sip`.

## Pakai han.sip sekarang

Node **18+** (CI menguji 18 / 20 / 22). Di repo kamu. `npx github:…` di npm 10 sering gagal (`GitFetcher`); pasang lewat git SHA:

```bash
npm install github:ganezha/kotak-kecil#fa0b9ce08b794cc18f6fabbbcbc20973a3752911
npx han.sip .
npx jejak
```
```text
han.sip
ronda: 12 file
sip.
```

**Hasil**

| yang muncul | arti |
|---|---|
| `sip.` | bersih. tidak ada secret. exit **0** |
| `! jenis  lokasi` | temuan. kiri = jenis, kanan = path[:baris]. **bukan** nilai token. exit **1** |
| `han.sip gagal: …` | tool tidak jalan. **bukan** “aman”. exit **2** |

Kalau bukan sip:

```text
! env-file         .env
! github-token     src/config.js:14

bukan sip. 2 temuan.
Kalau ini pernah masuk git: rotate dulu. Hapus file tidak cukup.
```

Hapus file tidak cukup. Token yang sempat masuk git harus di-rotate.

```bash
npx han.sip --help
npx han.sip --staged
npx han.sip pasang
```

CI + SARIF: salin [`templates/github-actions.yml`](templates/github-actions.yml) ke `.github/workflows/han.sip.yml`. Pin `github:…#SHA` dan `uses:` ke commit SHA sudah di template.

Belum npm registry. **Jangan** `npm i han.sip`.

## Tools

### [`han.sip`](han.sip/cli.mjs)

Ronda malam untuk git. Cek folder — atau **hanya file yang di-stage**. Kalau ada `.env`, key, atau token berbentuk secret — teriak pelan. Isi secret tidak dicetak. Isi yang dibaca untuk `--staged` datang dari git index, bukan working tree. `--staged src` hanya path di bawah `src`.

```bash
node han.sip/cli.mjs .           # seluruh folder (CI)
node han.sip/cli.mjs --staged    # git index
node han.sip/cli.mjs --diff      # baris baru vs HEAD (repo baru: empty tree)
node han.sip/cli.mjs --json
node han.sip/cli.mjs --sarif     # GitHub code scanning
node han.sip/cli.mjs --baseline  # temuan diterima — bukan aman
node han.sip/cli.mjs --plugin x.mjs   # EKSEKUSI KODE. lihat SECURITY.md
node han.sip/cli.mjs --plugins        # .han.sip/plugins/*.mjs (default mati)
node han.sip/cli.mjs pasang      # pre-commit (manual)
```

`han.sip pasang` merakit shim `0755` di `.git/hooks/pre-commit`. Lokal `han.sip/cli.mjs` kalau ada; lalu `node_modules/.bin/han.sip`; selain itu npx pin commit SHA (npm 10 sering gagal — pasang lewat `npm install`). Hook asing: **di-chain** (`pre-commit.han.sip-prev` dulu, han.sip kemudian) plus cadangan `pre-commit.bak`. Fail closed. Tidak global. Tidak lewat `npm prepare` / `postinstall`.

Hook yang teriak: cabut secret dari index. **Jangan** `git commit --no-verify`. **Jangan** `--write-baseline` sebagai ganti rotate.

Plugin = **eksekusi JavaScript dari tree yang sedang discan**. Tidak auto-load. `--plugin` / `--plugins` sadar-risiko.

```bash
npm test
```

Desain: [docs/han.sip.md](docs/han.sip.md). Model keamanan: [SECURITY.md](SECURITY.md). Contoh: [docs/EXAMPLES.md](docs/EXAMPLES.md). Pasang: [docs/INSTALL.md](docs/INSTALL.md).

### [`jejak`](jejak/cli.mjs)

Commit per hari. Graph baru hidup di hari ke-2. Ada di `bin` (`npx jejak`).

```bash
node jejak/cli.mjs        # 14 hari
node jejak/cli.mjs 30
npx jejak
```

Desain: [docs/jejak.md](docs/jejak.md).

### [`gitignore/node.gitignore`](gitignore/node.gitignore)

Strict gitignore for Node.js so `.env`, private keys, and dumps never reach GitHub.

Pin ke commit SHA, **bukan** `main`. **Jangan** `-o .gitignore` kalau file itu sudah ada (menimpa).

```bash
curl -fsSL https://raw.githubusercontent.com/ganezha/kotak-kecil/fa0b9ce08b794cc18f6fabbbcbc20973a3752911/gitignore/node.gitignore -o gitignore.node
# gabung manual ke .gitignore kamu
```

### [`templates/env.example`](templates/env.example)

Kerangka `.env` kosong. Salin, isi lokal, file aslinya tidak masuk git.

## Docs

- [Pasang](docs/INSTALL.md)
- [Contoh CLI](docs/EXAMPLES.md)
- [Versi](docs/VERSIONING.md) · [Rilis](docs/RELEASE.md) · [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md)

## —

Tool berikutnya: file dulu, bukan README.

## Principles

1. Public by default
2. MIT
3. Small enough to read in one sitting
4. No secrets in git — see [SECURITY.md](SECURITY.md)

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Review tunggal (author = merger) adalah risiko yang diketahui.

## License

[MIT](LICENSE) © Ganezha
