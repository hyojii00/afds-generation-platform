# Active Loop 001 — Accept and Retrieve Generation Jobs

## State

`ready_for_review`

## Target

An API client can submit a mock-provider generation job and retrieve the same accepted job by identifier.

## Allowed scope

- AFDS repository ownership and workflow documents.
- A framework-independent generation job model and application service.
- A NestJS HTTP adapter with process-local storage.
- Unit, HTTP E2E, documentation, type, lint, format, and build checks.

## Non-goals

- PostgreSQL, migrations, queues, workers, Outbox/Inbox, retries, or idempotency.
- Real provider calls, credentials, generated media, authentication, or observability infrastructure.
- Starting Active Loop 002.

## Acceptance criteria

1. `POST /v1/jobs` with a non-empty prompt and `provider: "mock"` returns `201` and a queued job with an identifier and creation time.
2. `GET /v1/jobs/:id` returns the same job accepted during the process lifetime.
3. Invalid creation input returns `400`; an unknown identifier returns `404`.
4. The generation package imports no NestJS or platform adapter code.
5. `pnpm verify` passes.

## Decision gates

- Stop in `replan` if the HTTP contract requires persistent or asynchronous behavior.
- Do not select persistence, messaging, or provider SDKs in this loop.

## Evidence ledger

| Check | Result |
| --- | --- |
| `pnpm test:unit` | Passed — 2 tests |
| `pnpm test:e2e` | Passed — 3 tests |
| `pnpm check:boundaries` | Passed |
| `pnpm verify` | Passed |
| Manual `POST` → `GET` HTTP round trip | Passed — retrieved response matched created response |
| Diff critique | Passed — no proprietary material, unrelated changes, or next-loop implementation found |
