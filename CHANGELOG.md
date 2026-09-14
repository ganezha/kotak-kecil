# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versi: [SemVer](https://semver.org/). Kebijakan: [docs/VERSIONING.md](docs/VERSIONING.md).

Toolbox **KOTAK kecil** versi satu angka di `package.json`. Tool baru = minor. Belum `1.0.0`, belum npm.

## [Unreleased]

## [0.6.0] — 2026-09-14

### Security

- Walk tidak lagi melewati seluruh folder tersembunyi. `.hidden/secret` tertangkap. `.git` tetap dilewati.
- GitHub Actions (`checkout`, `setup-node`, `codeql-action/upload-sarif`) pin ke commit SHA, bukan tag bergerak `v4` / `v3`.
- npx pin ke commit SHA (`16f0c992c0d2dbbc18d0310882cf577ff764cfb8`), bukan tag `#v` yang bisa digeser.

## [0.5.0] — 2026-09-14

### Security

- **OpenAI**: `sk-` klasik (20+) tertangkap, bukan hanya `sk-proj-` / `sk-svcacct-`. `sk-ant-` tetap Anthropic, tidak dobel.
- **`*.pem` / `*.key`**: nama = sinyal lemah. `fullchain.pem` / `cert.pem` (sertifikat publik) bukan temuan. `key-file` hanya kalau kosong atau tidak terbaca. Isi `BEGIN … PRIVATE KEY` = `private-key`.
- **aws-secret**: 40 karakter, hanya di baris dekat `AKIA` / `AWS_SECRET` / `aws_secret_access_key`. Bukan entropy buta.
- **seed-phrase**: 12 atau 24 kata Latin lowercase plus konteks `seed` / `mnemonic` / `recovery` / `wallet`. Tanpa konteks tidak teriak.
- `.githooks/pre-commit.mjs` pin npx ke `#v` + `package.json` (sama dengan `pasang` / template). Fallback tidak mengikuti `main`.
- `pasang`: hook asing tidak ditimpa diam-diam — cadangan `pre-commit.bak` (+ `.bak.<epoch>` kalau sudah ada) dan peringatan dulu.

### Changed

- Pin npx di README / INSTALL / EXAMPLES / template Actions / docs: `#v0.5.0`.
- Residual ops di docs + `--help`: jangan `git commit --no-verify`; jangan `--write-baseline` tanpa rotate. Pertimbangkan immutable GitHub Release.

## [0.4.0] — 2026-09-14

### Security

- **`.env.example`**: nama file bukan temuan `env-file`. **Isi tetap dironda.** Nilai kosong/placeholder lolos; token berbentuk secret tidak.
- **Baseline**: berarti temuan *diterima/di-suppress*, **bukan** aman. Output manusia, `note` di file baseline, `baseline.safe: false` di JSON.
- **Fingerprint**: SHA-256 turunan dari kind + path + potongan yang cocok rule, dipotong 16 hex, non-reversible. Bukan plaintext; tetap bukti material secret-shaped. Model: [SECURITY.md](SECURITY.md).
- `pasang` dan template Actions pin `npx` ke `github:ganezha/kotak-kecil#v` + angka `package.json`. Salinan orang tidak lagi mengikuti `main`.

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

[Unreleased]: https://github.com/ganezha/kotak-kecil/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/ganezha/kotak-kecil/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ganezha/kotak-kecil/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/ganezha/kotak-kecil/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ganezha/kotak-kecil/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ganezha/kotak-kecil/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ganezha/kotak-kecil/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ganezha/kotak-kecil/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/ganezha/kotak-kecil/releases/tag/v0.0.1
