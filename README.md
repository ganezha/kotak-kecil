# KOTAK kecil

Kotak perkakas MIT milik [Ganezha](https://github.com/ganezha). Satu tool, satu tugas.

A public toolbox. Small tools, one job each.

## Tools

### [`han.sip`](han.sip/cli.mjs)

Ronda malam untuk git. Cek folder — atau **hanya file yang di-stage**. Kalau ada `.env`, key, atau token berbentuk secret — teriak pelan. Isi secret tidak dicetak. Isi yang dibaca untuk `--staged` datang dari git index, bukan working tree.

```bash
node han.sip/cli.mjs .           # seluruh folder (CI)
node han.sip/cli.mjs --staged    # git index
node han.sip/pasang.mjs          # pre-commit di repo ini (manual)
```

`0` = sip. `1` = bukan sip. `--quiet` diam kalau sip.

Pasang merakit shim `0755` di `.git/hooks/pre-commit` yang mengeksekusi [`.githooks/pre-commit.mjs`](.githooks/pre-commit.mjs). Fail closed. Tidak global. Tidak lewat `npm prepare` / `postinstall` — itu nulis `.git` tiap install.

Belum terbit npm. Kalau nanti terbit: pasang tetap perintah di atas.

```bash
npm test                       # fixture .env, staged vs unstaged, token palsu
```

Desain: [docs/han.sip.md](docs/han.sip.md). Contoh: [docs/EXAMPLES.md](docs/EXAMPLES.md).

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
