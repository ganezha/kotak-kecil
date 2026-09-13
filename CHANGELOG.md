# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versi: [SemVer](https://semver.org/). Kebijakan: [docs/VERSIONING.md](docs/VERSIONING.md).

Toolbox **KOTAK kecil** versi satu angka di `package.json`. Tool baru = minor. Belum `1.0.0`, belum npm.

## [Unreleased]

### Added

- `CODE_OF_CONDUCT.md`
- Template issue (bug, tool baru, lain) dan `PULL_REQUEST_TEMPLATE.md`
- [docs/INSTALL.md](docs/INSTALL.md) — cara pasang, tanpa npm registry
- [docs/EXAMPLES.md](docs/EXAMPLES.md) — contoh CLI `han.sip` dan `jejak`
- [docs/VERSIONING.md](docs/VERSIONING.md) dan [docs/RELEASE.md](docs/RELEASE.md)
- Catatan desain [docs/han.sip.md](docs/han.sip.md) dan [docs/jejak.md](docs/jejak.md)

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

[Unreleased]: https://github.com/ganezha/kotak-kecil/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ganezha/kotak-kecil/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ganezha/kotak-kecil/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ganezha/kotak-kecil/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/ganezha/kotak-kecil/releases/tag/v0.0.1
