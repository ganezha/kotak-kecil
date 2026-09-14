# Contributing

Thanks for looking. **KOTAK kecil** stays small on purpose.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Fit

A tool belongs in this toolbox if:

- it does **one** job
- a newcomer can read it in one sitting
- it is MIT-licensed
- it has no secrets and no `.env` with real values

## How

1. Open an issue first if the change is more than a typo — pakai template di `.github/ISSUE_TEMPLATE/`
2. Fork, branch, pull request against `main` (ada [PR template](.github/PULL_REQUEST_TEMPLATE.md))
3. `npm test` must pass
   - han.sip: fixture `.env`, staged vs unstaged, token palsu, json/sarif/diff/baseline/ignore, plugin, fuzz diff
   - jejak: repo kosong, hari ke-2, jendela
   - `npm run bench` opsional, bukan CI
4. README / docs / `[Unreleased]` di [CHANGELOG.md](CHANGELOG.md) kalau user-facing
5. Jangan nulis `.git` dari npm lifecycle

PRs with `.env`, keys, or tokens will be closed. Secret yang sudah masuk git: rotate, lalu [advisory](https://github.com/ganezha/kotak-kecil/security/advisories/new) — hapus file tidak cukup.

Detector kind baru = versi minor. Lihat [docs/VERSIONING.md](docs/VERSIONING.md).
