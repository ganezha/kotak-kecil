# KOTAK kecil

Kotak perkakas MIT milik [Ganezha](https://github.com/ganezha). Satu tool, satu tugas.

A public toolbox. Small tools, one job each.

## Pakai han.sip sekarang

Node **18+**. Di repo kamu, tanpa clone, tanpa `npm i`:

```bash
npx --yes github:ganezha/kotak-kecil#d67521f6ed1ea0b309912563f593bd506c87eada -- .
```

`--` memisahkan npm dari han.sip. Pakai kalau kamu kirim flag (`--staged`, `--help`, `--json`).

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
npx --yes github:ganezha/kotak-kecil#d67521f6ed1ea0b309912563f593bd506c87eada -- --help
npx --yes github:ganezha/kotak-kecil#d67521f6ed1ea0b309912563f593bd506c87eada -- --staged
npx --yes github:ganezha/kotak-kecil#d67521f6ed1ea0b309912563f593bd506c87eada -- pasang
```

CI + SARIF: salin [`templates/github-actions.yml`](templates/github-actions.yml) ke `.github/workflows/han.sip.yml`. Pin npx dan `uses:` ke commit SHA sudah di template.

Belum npm registry. **Jangan** `npm i han.sip`.

## Tools

### [`han.sip`](han.sip/cli.mjs)

Ronda malam untuk git. Cek folder — atau **hanya file yang di-stage**. Kalau ada `.env`, key, atau token berbentuk secret — teriak pelan. Isi secret tidak dicetak. Isi yang dibaca untuk `--staged` datang dari git index, bukan working tree.

```bash
node han.sip/cli.mjs .           # seluruh folder (CI)
node han.sip/cli.mjs --staged    # git index
node han.sip/cli.mjs --diff      # baris baru vs HEAD
node han.sip/cli.mjs --json
node han.sip/cli.mjs --sarif     # GitHub code scanning
node han.sip/cli.mjs --baseline  # temuan diterima — bukan aman
node han.sip/cli.mjs pasang      # pre-commit (manual)
```

`han.sip pasang` merakit shim `0755` di `.git/hooks/pre-commit`. Lokal `han.sip/cli.mjs` kalau ada; selain itu npx pin commit SHA. Hook asing: cadangan `pre-commit.bak` dulu, baru ditimpa. Fail closed. Tidak global. Tidak lewat `npm prepare` / `postinstall`.

Hook yang teriak: cabut secret dari index. **Jangan** `git commit --no-verify`. **Jangan** `--write-baseline` sebagai ganti rotate.

```bash
npm test
```

Desain: [docs/han.sip.md](docs/han.sip.md). Model keamanan: [SECURITY.md](SECURITY.md). Contoh: [docs/EXAMPLES.md](docs/EXAMPLES.md). Pasang: [docs/INSTALL.md](docs/INSTALL.md).

### [`jejak`](jejak/cli.mjs)

Commit per hari. Graph baru hidup di hari ke-2.

```bash
node jejak/cli.mjs        # 14 hari
node jejak/cli.mjs 30
```

Desain: [docs/jejak.md](docs/jejak.md).

### [`gitignore/node.gitignore`](gitignore/node.gitignore)

Strict gitignore for Node.js so `.env`, private keys, and dumps never reach GitHub.

```bash
curl -fsSL https://raw.githubusercontent.com/ganezha/kotak-kecil/main/gitignore/node.gitignore -o .gitignore
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

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Ganezha
