# AFDS Generation Platform

[![verify](https://github.com/hyojii00/afds-generation-platform/actions/workflows/verify.yml/badge.svg)](https://github.com/hyojii00/afds-generation-platform/actions/workflows/verify.yml)

A portfolio-safe reference implementation for building an asynchronous media-generation platform through small, evidence-driven pull requests.

The repository demonstrates two things together:

- A NestJS backend that evolves from job acceptance toward reliable asynchronous execution.
- An Agent-First Development System (AFDS) where repository-owned plans, decision gates, tests, and evidence constrain AI-assisted work.

## Current capability

The first active loop accepts a job for the local mock provider and retrieves it during the API process lifetime.

```http
POST /v1/jobs
Content-Type: application/json

{
  "prompt": "A cinematic sunrise over Seoul",
  "provider": "mock"
}
```

See `docs/plans/active-loop.md` for the exact scope, acceptance criteria, and verification evidence.

## Repository shape

| Path | Responsibility |
| --- | --- |
| `.afds` | Stable AI-first development principles and loop protocol |
| `docs/product` | Product purpose, scope, and non-goals |
| `docs/architecture` | Current boundaries and explicit evolution gates |
| `docs/plans` | The single active loop and its evidence ledger |
| `packages/generation` | Framework-independent generation behavior |
| `apps/api` | NestJS HTTP delivery adapter |

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm verify
pnpm dev:api
```

The API listens on `http://localhost:3000`. No external service or credential is required in Active Loop 001. Jobs are intentionally stored in memory; PostgreSQL and asynchronous workers remain separate future loops.

## Portfolio safety

This repository uses a synthetic domain and local mock provider. It contains no employer source code, data model, prompts, customer data, credentials, or internal identifiers.

## License

MIT. See `LICENSE`.
