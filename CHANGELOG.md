# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versi: [SemVer](https://semver.org/). Kebijakan: [docs/VERSIONING.md](docs/VERSIONING.md).

Toolbox **KOTAK kecil** versi satu angka di `package.json`. Tool baru = minor. Belum `1.0.0`, belum npm.

## [Unreleased]

### Changed

- README/INSTALL/EXAMPLES: tabel hasil (`sip.` / `! jenis lokasi` / exit 2), Node 18+, jangan `npm i han.sip`.
- Dump `--help` di EXAMPLES dihapus — ikut CLI, jangan dihafal.

### Fixed

- Tag `v0.0.1`, `v0.1.0`, `v0.1.1` supaya tautan compare di bawah ini tidak 404.

## [0.3.0] — 2026-09-14

### Added

- **han.sip** flags: `--json`, `--sarif`, `--diff [ref]`, `--ignore` / `.han.sipignore`, `--baseline` / `--write-baseline`. Fingerprint, bukan nilai secret.
- `han.sip pasang` — pre-commit di **repo mana pun**. Shim memakai `han.sip/cli.mjs` lokal kalau ada, selain itu `npx github:ganezha/kotak-kecil`.
- Instalasi tanpa clone: `npx --yes github:ganezha/kotak-kecil -- .`
- Template CI+SARIF: [`templates/github-actions.yml`](templates/github-actions.yml)
- Docs: CoC, issue/PR templates, INSTALL, EXAMPLES, VERSIONING, RELEASE, catatan desain

### Fixed

- CLI `main()` jalan lewat bin symlink npm/npx (dulu diam, exit 0, tanpa output)

### Changed

- `package.json` tetap `"private": true`. Distribusi = GitHub (`npx github:…`). Bukan npm registry.

## [0.2.0] — 2026-09-13

### Added

- `jejak` — graph commit per hari. Hidup di hari ke-2.
- Tes `han.sip`: fixture `.env`, staged vs unstaged (index, bukan working tree), token palsu dirakit di runtime.
- Detector: GitHub PAT, Slack, Stripe, OpenAI, Anthropic, Google, npm, GitLab, Hugging Face, file SSH (`id_rsa` dkk).

### Changed

- `package.json` `private: true`. Belum terbit npm.
- Pasang hook **manual**: `node han.sip/pasang.mjs`. Tidak lewat `npm prepare` / `postinstall` — itu nulis `.git` tiap install.

### Removed

- Lifecycle npm yang memasang pre-commit otomatis.

## [0.1.1] — 2026-09-13

### Added

- `han.sip --staged` — ronda git index (`git show :path`), bukan working tree.
- `han.sip --quiet` / `HAN_SIP_QUIET` — diam kalau sip.
- `han.sip/pasang.mjs` — shim `0755` di `.git/hooks/pre-commit`.
- `.githooks/pre-commit.mjs` ikut di-commit. Fail closed.

## [0.1.0] — 2026-09-13

### Added

- `han.sip` — ronda malam. File `.env` / key / token berbentuk secret. Isi secret tidak dicetak.
- `gitignore/node.gitignore`
- `templates/env.example`
- CI `.github/workflows/han.sip.yml`
- MIT, `CONTRIBUTING.md`, `SECURITY.md`

## [0.0.1] — 2026-09-13

### Added

- Repo toolbox: satu tool, satu tugas.

[Unreleased]: https://github.com/ganezha/kotak-kecil/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/ganezha/kotak-kecil/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ganezha/kotak-kecil/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ganezha/kotak-kecil/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ganezha/kotak-kecil/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/ganezha/kotak-kecil/releases/tag/v0.0.1
