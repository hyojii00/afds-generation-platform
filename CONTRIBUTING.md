# Contributing

## Setup

Use Node.js 24.20.0, pnpm 11.22.0, and a running Docker engine.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait postgres
pnpm db:migrate
```

See `docs/runbooks/local-development.md` for local runtime and cleanup commands. Verification starts isolated PostgreSQL containers and does not reuse the development database.

## Branches and pull requests

- Branch from `main` with `feat/<short-name>`, `fix/<short-name>`, or `docs/<short-name>`.
- Keep one AFDS active loop in one pull request.
- Keep commits focused on the observable result defined by the active loop.
- Update the active loop's evidence ledger with commands actually run.
- Run `pnpm verify` before opening or updating a pull request.
