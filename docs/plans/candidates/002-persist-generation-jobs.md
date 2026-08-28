# Candidate Loop 002 — Persist Generation Jobs

## State

`candidate — not active`

## Target

A job accepted through the existing API remains retrievable after the API process restarts.

## Prerequisites

- Active Loop 001 is merged and its HTTP contract remains the baseline.
- A local PostgreSQL runtime is available for integration and E2E verification.

## Proposed scope

- Define a PostgreSQL schema and versioned migration for generation jobs.
- Implement a PostgreSQL `GenerationJobRepository` adapter.
- Replace the runtime in-memory repository while preserving the generation package boundary.
- Manage database configuration, connection startup, shutdown, and readiness failure explicitly.
- Add repository integration tests and an API restart E2E test against the same database.

## Non-goals

- Workers, asynchronous execution, retries, leases, Outbox/Inbox, or external messaging.
- Provider SDKs, authentication, billing, cloud deployment, or production migration automation.
- Changing the existing `POST /v1/jobs` or `GET /v1/jobs/:id` response shape.

## Decision gates

- Select and record the schema and migration tool before adding a dependency.
- Decide how domain values map to database constraints without leaking database types into the generation package.
- Define migration rollback and startup-failure behavior before wiring the API.
- Stop in `replan` if persistence requires changing the public HTTP contract.

## Acceptance outline

1. Migrations initialize an empty PostgreSQL database reproducibly.
2. A created job is retrieved with the same identifier, status, provider, prompt, and creation time after API restart.
3. An unknown identifier still returns `404`, and invalid creation input still returns `400`.
4. The generation package remains independent of NestJS and database libraries.
5. Focused integration and E2E tests plus `pnpm verify` pass.

## Expected evidence

- Migration-from-empty-database result.
- Repository save/find integration tests.
- API create → restart → retrieve E2E result.
- Architecture decision and local-development runbook updates.

## Primary risks

- Schema and domain state drifting apart.
- Connection lifecycle leaks or startup succeeding without a usable database.
- Tests passing against reused state rather than an isolated database.
