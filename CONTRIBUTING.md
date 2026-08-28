# Contributing

## Setup

Use Node.js 24.19.0 and pnpm 11.22.0.

```bash
corepack enable
pnpm install --frozen-lockfile
```

## Branches and pull requests

- Branch from `main` with `feat/<short-name>`, `fix/<short-name>`, or `docs/<short-name>`.
- Keep one AFDS active loop in one pull request.
- Keep commits focused on the observable result defined by the active loop.
- Update the active loop's evidence ledger with commands actually run.
- Run `pnpm verify` before opening or updating a pull request.
