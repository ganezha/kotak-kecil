# Security

## Do not commit secrets

Never add these to git:

- `.env` and `.env.local`
- API tokens, bot tokens, private keys
- wallet seed phrases
- files named `private.txt`

Use `.env.example` with empty values instead.

If a secret is committed, **rotating the secret** is required. Deleting the file is not enough — git history still has it. Delete the repository or rewrite history after rotating.

## Report a vulnerability

Open a [GitHub security advisory](https://github.com/ganezha/kotak-kecil/security/advisories/new) on this repo. Do not file a public issue for leaked credentials.
