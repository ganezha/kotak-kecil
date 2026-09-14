# Security

## Do not commit secrets

Never add these to git:

- `.env` and `.env.local`
- API tokens, bot tokens, private keys
- wallet seed phrases
- files named `private.txt`

Use `.env.example` / `.env.sample` / `.env.template` with **empty** values. A live-shaped token in those files is a finding.

If a secret is committed, **rotating the secret** is required. Deleting the file is not enough — git history still has it. Delete the repository or rewrite history after rotating.

## han.sip — security model

One job: find secret-shaped files and strings **before** they reach GitHub. Not a promise that the repo is clean of every possible secret.

### What leaves the process

- Report: `kind`, path, line (`0` = filename rule). **Never** the matched value.
- `--json` / `--sarif`: `file`, `line`, `kind`, `fp`, `sha256`. `conf` only for `generic-secret`. No token field.
- Full SHA-256 of the fingerprint material is an identifier, not a password hash — still evidence a secret-shaped string existed.
- No network. No rewrite of git history.

### Plugins = code execution

`--plugin <file.mjs>` and `--plugins` (`HAN_SIP_PLUGINS=1`) **`import()` JavaScript from the tree being scanned.** Same process, no sandbox, no allowlist.

A PR that drops `.han.sip/plugins/evil.mjs` plus CI that used to auto-load plugins = RCE on the runner. That is why **auto-load is off**. CI that needs extra rules must pass `--plugin` / `--plugins` explicitly.

Loading a plugin prints a warning on stderr: path + SHA-256 of the file bytes. That is a breadcrumb, not a sandbox.

Do not run han.sip `--plugins` on an untrusted checkout.

### `.env.example`

The **name** `.env.example` (also `.env.sample`, `.env.template`, `.env.test`, `.env.testing`, `.env.default`) is not an `env-file` finding — templates belong in git.

The **contents** are still scanned. Empty / placeholder values (`API_KEY=`) are not secret-shaped, so they pass. A string that matches a content rule (`ghp_…`, `sk_live_…`, PEM, …) is a finding, same as in any other file.

`.envrc` (direnv) **is** an `env-file` finding — it often holds secrets.

Folder mode does **not** read the user's `.gitignore`. Secrets in an ignored path are still scanned unless `.han.sipignore` / `--ignore` says so. That is deliberate: `git add -f` exists.

### Baseline

`--baseline` means: these findings are **accepted / suppressed**. It does **not** mean the secret is safe, gone, or rotated.

`--write-baseline` writes `{ version: 3, note, hits: [{ file, line, kind, fp, sha256 }] }`. `note` states the same: accepted, not safe. If those values ever entered git, rotate first.

Exit `0` with `N diterima di baseline — bukan aman.` is still “you chose to ignore N hits”, not a green bill of health.

Do **not** `--write-baseline` as a substitute for rotating. A baseline of live credentials is a decision to stay quiet.

Baseline v2 (no `line` in the fingerprint) does not match v3. Rewrite with `--write-baseline` after upgrade.

### Residual ops

han.sip is a gate, not a cleanup crew.

- **Do not `git commit --no-verify`.** The hook failed because the index looks like a secret. Unstage, fix, commit again. `--no-verify` is how tokens reach GitHub.
- **Do not `--write-baseline` instead of rotating.** If that value entered git, rotate first. Then, if a false-positive or an already-rotated leftover must stay in history, baseline that finding.
- **Deleting the file is not enough** once git history has the value. Rotate, then consider history rewrite / repo deletion.

### Fingerprint

`fp` is a **derived, non-reversible** identifier:

```text
sha256(kind || NUL || posix(file) || NUL || line || NUL || matched_piece)
  fp     = 32 hex (128 bit)
  sha256 = 64 hex (full)
```

`matched_piece` is the substring that hit the rule (secret-shaped material). It is hashed, never stored as plaintext, never printed. SHA-256 does not reverse to the token. 128-bit `fp` is an id for suppression; full SHA-256 is the same digest without truncation. Not a password hash.

`line` is in the digest so the same token on two lines is two findings (and two baseline rows). Filename rules use `line = 0`.

The baseline file is not a credential dump. It **is** evidence that a secret-shaped string existed at a path. Do not treat `fp` as “not derived from a secret”.

## Report a vulnerability

**Credentials / tool bugs that leak secrets:** open a [GitHub security advisory](https://github.com/ganezha/kotak-kecil/security/advisories/new) on this repo. Do not file a public issue for leaked credentials.

**Conduct / harassment:** do **not** use a security advisory (those can become public after publish). Contact the repository owner [@ganezha](https://github.com/ganezha) privately, or use GitHub's report-abuse flow.
