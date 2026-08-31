# AFDS Generation Platform

[![verify](https://github.com/hyojii00/afds-generation-platform/actions/workflows/verify.yml/badge.svg)](https://github.com/hyojii00/afds-generation-platform/actions/workflows/verify.yml)

A portfolio-safe reference implementation for building an asynchronous media-generation platform through small, evidence-driven pull requests.

The repository demonstrates two things together:

- A NestJS backend that evolves from job acceptance toward reliable asynchronous execution.
- An Agent-First Development System (AFDS) where repository-owned plans, decision gates, tests, and evidence constrain AI-assisted work.
- A Fastify runtime with SWC production compilation and a separate TypeScript type-safety gate.

## Current capability

The implemented platform accepts a job for the local mock provider, persists it in PostgreSQL, executes it in an independent worker process through a provider-neutral port, and reports the job's persisted lifecycle status.

```http
POST /v1/jobs
Content-Type: application/json

{
  "prompt": "A cinematic sunrise over Seoul",
  "provider": "mock"
}
```

See `docs/plans/active-loop.md` for the exact scope, acceptance criteria, and verification evidence behind that capability.

Loop 005 is active in `docs/plans/active-loop.md`; later possible outcomes remain non-active candidates in `docs/plans/candidates/README.md`.

## Repository shape

| Path | Responsibility |
| --- | --- |
| `.afds` | Stable AI-first development principles and loop protocol |
| `docs/product` | Product purpose, scope, and non-goals |
| `docs/architecture` | Current boundaries and explicit evolution gates |
| `docs/plans` | The single active loop and its evidence ledger |
| `packages/generation` | Framework-independent generation behavior |
| `apps/api` | NestJS HTTP delivery, the worker entrypoint, and PostgreSQL and provider adapters |
| `drizzle` | Versioned PostgreSQL migrations |

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait postgres
pnpm db:migrate
pnpm verify
pnpm dev:api
```

The API listens on `http://localhost:3000` by default; set `PORT` to override it. Use `pnpm build && pnpm start:api` to run the SWC-compiled output, and `pnpm start:worker` to run the worker process beside it. The API requires `DATABASE_URL` and an applied migration and fails startup instead of falling back to memory. `pnpm verify` uses isolated PostgreSQL containers, so Docker must be available. See `docs/runbooks/local-development.md` for operations and cleanup.

## Portfolio safety

This repository uses a synthetic domain and local mock provider. It contains no employer source code, data model, prompts, customer data, credentials, or internal identifiers.

## License

MIT. See `LICENSE`.
