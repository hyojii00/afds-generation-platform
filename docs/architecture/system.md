# System Architecture

## Current boundary

```mermaid
flowchart LR
  Client -->|POST /v1/jobs| API[NestJS API]
  Client -->|GET /v1/jobs/:id| API
  API --> Application[Generation application service]
  Application --> Repository[GenerationJobRepository port]
  Repository -. implemented by .-> Adapter[Drizzle repository adapter]
  Adapter --> PostgreSQL[(PostgreSQL)]
  Worker[Generation job worker process] --> Queue[GenerationJobQueue port]
  Queue -. implemented by .-> Leasing[PostgreSQL leasing adapter]
  Leasing --> PostgreSQL
```

The generation package owns job state, lifecycle transitions, execution policy, the repository port, and the queue port without importing NestJS, database, or worker entrypoint code. The API owns HTTP validation, status mapping, the PostgreSQL adapters, and database lifecycle. The worker is a separate process built from the same package and shares only PostgreSQL with the API.

## Execution boundary

`generation_jobs` is the durable work item. A worker claims one row with `FOR UPDATE SKIP LOCKED`, increments its attempt, and holds it under a UUID fencing token and a 30-second lease. A result applies only while the row is `processing`, carries that token, and holds an unexpired lease, so a worker that lost its lease cannot overwrite the outcome. Availability, expiry, and fencing all compare against `now()`, the PostgreSQL transaction timestamp, so worker clock skew cannot change ownership.

Three attempts are allowed. A retryable failure returns the job to `queued` behind a 1-second and then a 2-second backoff; the third retryable failure and every permanent failure are terminal. Expired leases below the attempt limit return to `queued`, and an expired final attempt becomes `failed`.

The API uses Fastify rather than Express. TypeScript performs static verification, and SWC produces the runnable JavaScript artifacts as recorded in [ADR 0001](decisions/0001-use-fastify-and-swc.md).

## Intentional limitation

Accepted jobs survive API and worker restarts against the same migrated database. Neither process runs migrations automatically, and both fail startup when configuration, connectivity, or schema state is unusable. Leasing fences persisted state application; it does not make external side effects exactly-once, and the local mock execution deliberately has none. Retry backoffs are fixed, without jitter or global rate limiting.

## Evolution gates

- Persistent schema changes require a versioned forward migration and adapter evidence.
- External side effects require an idempotency strategy beyond PostgreSQL fencing.
- External providers require mock-first contract tests and credential isolation.
- Authentication requires a threat model and key-rotation decision.
