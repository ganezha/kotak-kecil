# KOTAK kecil

Kotak perkakas MIT milik [Ganezha](https://github.com/ganezha). Satu tool, satu tugas.

A public toolbox. Small tools, one job each.

Alur kerja: **[WORKFLOW.md](WORKFLOW.md)** — tiga loop, kamu di tahap 03 (pakai sendiri).

## Tools

### [`han.sip`](han.sip/cli.mjs)

Ronda malam untuk git. Cek folder — atau **hanya file yang di-stage**. Kalau ada `.env`, key, atau token berbentuk secret — teriak pelan. Isi secret tidak dicetak. Isi yang dibaca untuk `--staged` datang dari git index, bukan working tree.

```bash
node han.sip/cli.mjs .           # seluruh folder (CI)
node han.sip/cli.mjs --staged    # git index (pre-commit)
npx --yes github:ganezha/kotak-kecil -- --staged
```

`0` = sip. `1` = bukan sip.

Pasang sebagai pre-commit: salin [`han.sip/pre-commit.sample`](han.sip/pre-commit.sample) ke `.git/hooks/pre-commit`.

### [`gitignore/node.gitignore`](gitignore/node.gitignore)

Strict gitignore for Node.js so `.env`, private keys, and dumps never reach GitHub.

```bash
curl -fsSL https://raw.githubusercontent.com/ganezha/kotak-kecil/main/gitignore/node.gitignore -o .gitignore
```

### [`templates/env.example`](templates/env.example)

Kerangka `.env` kosong. Salin, isi lokal, file aslinya tidak masuk git.

## Principles

1. Public by default
2. MIT
3. Small enough to read in one sitting
4. No secrets in git — see [SECURITY.md](SECURITY.md)

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Ganezha
