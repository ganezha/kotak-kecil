# KOTAK kecil

Kotak perkakas MIT milik [Ganezha](https://github.com/ganezha). Satu tool, satu tugas.

A public toolbox. Small tools, one job each.

## Tools

### [`han.sip`](han.sip/cli.mjs)

Ronda malam untuk git. Cek folder sebelum commit. Kalau ada `.env`, key, atau token berbentuk secret — teriak pelan. Isi secret tidak dicetak.

```bash
node han.sip/cli.mjs .
# or, from any project:
npx --yes github:ganezha/kotak-kecil
```

`0` = sip. `1` = bukan sip.

Pasang sebagai pre-commit: salin [`han.sip/pre-commit.sample`](han.sip/pre-commit.sample) ke `.git/hooks/pre-commit`.

### [`gitignore/node.gitignore`](gitignore/node.gitignore)

Strict gitignore for Node.js so `.env`, private keys, and dumps never reach GitHub.

```bash
curl -fsSL https://raw.githubusercontent.com/ganezha/kotak-kecil/main/gitignore/node.gitignore -o .gitignore
```

### [`templates/env.example`](templates/env.example)

Kerangka `.env` kosong. Salin, isi lokal, jangan pernah commit file aslinya.

## Principles

1. Public by default
2. MIT
3. Small enough to read in one sitting
4. No secrets in git — see [SECURITY.md](SECURITY.md)

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Ganezha
