# Completed Loop 002 — Persist Generation Jobs

## State

`completed`

## Target

A job accepted through the existing API remains retrievable after the API process restarts against the same PostgreSQL database.

## Allowed scope

- PostgreSQL runtime configuration for local development and tests.
- Drizzle schema, versioned SQL migration, and migration command.
- A PostgreSQL `GenerationJobRepository` adapter outside the domain boundary.
- NestJS database lifecycle and repository wiring that fail startup when PostgreSQL is unavailable.
- Isolated repository integration tests and an API create → restart → retrieve E2E test using Testcontainers.
- Documentation and verification changes required by persistence.

## Non-goals

- Workers, asynchronous execution, retries, leases, Outbox/Inbox, or external messaging.
- Provider adapters, real provider calls, credentials, generated media, authentication, billing, or cloud deployment.
- Production migration automation, destructive rollback tooling, or starting Loop 003.
- Changing the existing `POST /v1/jobs` or `GET /v1/jobs/:id` request and response shapes.

## Acceptance criteria

1. A versioned migration initializes an empty PostgreSQL database with the generation-jobs schema.
2. `POST /v1/jobs` persists the returned identifier, prompt, provider, status, and creation time atomically.
3. After closing and recreating the NestJS application against the same database, `GET /v1/jobs/:id` returns the original response unchanged.
4. Invalid creation input still returns `400`, an unknown identifier still returns `404`, and PostgreSQL unavailability fails application startup explicitly.
5. The generation package imports no NestJS, Drizzle, PostgreSQL, or platform adapter code.
6. Repository integration tests, restart E2E tests, existing unit/E2E tests, documentation validation, SWC build, built-API smoke test, and `pnpm verify` pass.

## Decisions

- Use PostgreSQL with Drizzle ORM and versioned SQL migrations; do not introduce Prisma or TypeORM.
- Use Testcontainers for isolated PostgreSQL integration and restart E2E tests; Docker is a verification prerequisite.
- Store the identifier as UUID, creation time as `timestamptz`, and provider/status as constrained text values mapped at the adapter boundary.
- Fail API startup when database configuration, connection, or migration state is unusable; do not fall back to in-memory storage.
- Use forward-only migrations in this portfolio loop. Rollback is the previous application against the additive schema or recreation of disposable local/test databases.

## Decision gates

- Stop in `replan` if persistence requires changing the public HTTP contract or generation domain imports.
- Stop in `replan` if verification cannot use an isolated PostgreSQL database.
- Do not add a worker, broker, provider SDK, generalized repository framework, or speculative persistence abstraction.

## Pre-mortem

- **Schema drift:** adapter mappings and database constraints disagree. Mitigate with migration-from-empty and repository round-trip tests.
- **False restart evidence:** tests recreate the application but silently replace the database. Mitigate by asserting the same container and persisted identifier across application instances.
- **Masked outage:** the API starts with an unavailable database or falls back to memory. Mitigate with explicit startup-failure verification and no in-memory runtime provider.

## Evidence ledger

| Check | Result |
| --- | --- |
| Migration from empty PostgreSQL | Passed — `pnpm test:integration` creates the schema through `drizzle/0000_create_generation_jobs.sql` |
| Repository integration tests | Passed — `pnpm test:integration` (3 tests) |
| API create → restart → retrieve E2E | Passed — `pnpm test:e2e` (4 tests) |
| PostgreSQL-unavailable startup test | Passed — covered by `pnpm test:e2e` |
| Existing unit and HTTP contract tests | Passed — `pnpm test:unit` (2 tests) and `pnpm test:e2e` (4 tests) |
| `pnpm check:boundaries` | Passed — generation and Fastify adapter boundaries are intact |
| `pnpm verify` | Passed — formatting, lint, boundaries, 9 tests, docs, typecheck, SWC build, and built-API smoke |
| Diff critique | Passed — `git diff --check`; reviewed for scope, domain coupling, public-contract regression, and speculative abstractions |
