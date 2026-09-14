# Security

## Do not commit secrets

Never add these to git:

- `.env` and `.env.local`
- API tokens, bot tokens, private keys
- wallet seed phrases
- files named `private.txt`

Use `.env.example` with **empty** values. A live-shaped token in `.env.example` is a finding.

If a secret is committed, **rotating the secret** is required. Deleting the file is not enough — git history still has it. Delete the repository or rewrite history after rotating.

## han.sip — security model

One job: find secret-shaped files and strings **before** they reach GitHub. Not a promise that the repo is clean of every possible secret.

### What leaves the process

- Report: `kind`, path, line (`0` = filename rule). **Never** the matched value.
- `--json` / `--sarif`: `file`, `line`, `kind`, `fp`. No token field.
- No network. No rewrite of git history.

### `.env.example`

The **name** `.env.example` is not an `env-file` finding — templates belong in git.

The **contents** are still scanned. Empty / placeholder values (`API_KEY=`) are not secret-shaped, so they pass. A string that matches a content rule (`ghp_…`, `sk_live_…`, PEM, …) is a finding, same as in any other file.

### Baseline

`--baseline` means: these findings are **accepted / suppressed**. It does **not** mean the secret is safe, gone, or rotated.

`--write-baseline` writes `{ version, note, hits: [{ file, kind, fp }] }`. `note` states the same: accepted, not safe. If those values ever entered git, rotate first.

Exit `0` with `N diterima di baseline — bukan aman.` is still “you chose to ignore N hits”, not a green bill of health.

Do **not** `--write-baseline` as a substitute for rotating. A baseline of live credentials is a decision to stay quiet.

### Residual ops

han.sip is a gate, not a cleanup crew.

- **Do not `git commit --no-verify`.** The hook failed because the index looks like a secret. Unstage, fix, commit again. `--no-verify` is how tokens reach GitHub.
- **Do not `--write-baseline` instead of rotating.** If that value entered git, rotate first. Then, if a false-positive or an already-rotated leftover must stay in history, baseline that finding.
- **Deleting the file is not enough** once git history has the value. Rotate, then consider history rewrite / repo deletion.

### Fingerprint

`fp` is a **derived, non-reversible** identifier:

```text
sha256(kind || NUL || posix(file) || NUL || matched_piece) → first 16 hex
```

`matched_piece` is the substring that hit the rule (secret-shaped material). It is hashed, never stored, never printed. SHA-256 does not reverse to the token. 16 hex (64 bits) is an id for suppression, not a password hash.

The baseline file is not a credential dump. It **is** evidence that a secret-shaped string existed at a path. Do not treat `fp` as “not derived from a secret”.

## Report a vulnerability

Open a [GitHub security advisory](https://github.com/ganezha/kotak-kecil/security/advisories/new) on this repo. Do not file a public issue for leaked credentials.
