# Active Loop 003 — Execute Jobs Reliably

## State

`implementing`

## Target

A persisted queued job is claimed by an independently runnable worker and reaches `succeeded` or `failed`, while concurrent claimers and stale owners cannot apply a terminal result twice.

## Allowed scope

- Expand the generation job lifecycle to `queued`, `processing`, `succeeded`, and `failed` with explicit valid transitions.
- Add a forward PostgreSQL migration for attempt, availability, lease, and lifecycle metadata on `generation_jobs`.
- Keep job creation and claimable work atomic by using the generation-job row as the durable work item.
- Add an independently runnable SWC-built worker with PostgreSQL claim, completion, retry, and stale-lease recovery adapters.
- Execute deterministic local mock work without a provider SDK or network call.
- Add deterministic domain, repository integration, concurrent-worker, restart, and built-worker smoke tests.
- Update architecture and local-operation owners required by the worker lifecycle.

## Non-goals

- Real provider calls, provider SDKs, callbacks, generated media, credentials, billing, authentication, or user cancellation.
- Kafka, RabbitMQ, an external broker, Transactional Outbox/Inbox, or cross-service integration events.
- Exactly-once external side effects; this loop fences persisted state application and uses only side-effect-free local mock work.
- Generalized workflow engines, multiple job types, unlimited retries, cloud deployment, or starting Loop 004.
- Changing existing HTTP routes or response fields.

## Acceptance criteria

1. A forward migration upgrades the Loop 002 schema without losing existing jobs; existing `queued` rows become immediately claimable with zero attempts.
2. `POST /v1/jobs` creates one claimable `queued` row atomically and retains its existing `201` request and response fields.
3. Two worker instances racing for the same queued job yield one active lease, one local execution, and valid `queued` → `processing` → `succeeded` persisted transitions.
4. Completion requires the current unexpired fencing token; an expired owner cannot apply a result, stale work below the attempt limit can be reclaimed, and an expired third attempt becomes `failed`.
5. Retryable failures requeue after bounded 1-second and 2-second backoffs, then become `failed` on the third failed attempt; permanent failures become `failed` on the first attempt.
6. Recreating the worker against the same database resumes queued or stale work without applying a successful result twice.
7. `GET /v1/jobs/:id` retains its fields and reports the persisted lifecycle status; `400` and `404` behavior remains unchanged.
8. The generation package remains free of NestJS, Drizzle, and worker entrypoint imports, and all focused tests, documentation validation, SWC builds, built-process smoke tests, and `pnpm verify` pass.

## Decisions

- Use PostgreSQL job-row leasing with `FOR UPDATE SKIP LOCKED`; an outbox adds a relay and duplicate-delivery boundary without an external consumer in this loop.
- Use the existing generation-job row as the durable work item so API creation remains a single atomic insert rather than a speculative queue table.
- Assign a UUID fencing token and a 30-second lease on each claim. Completion or failure updates require `processing`, the current token, and an unexpired lease.
- Use PostgreSQL transaction time for availability, lease expiry, and fencing comparisons so worker clock skew cannot change ownership decisions.
- Increment the attempt count when claiming. Allow three total attempts, with retryable failures available after 1 second and then 2 seconds; the third retryable failure and every permanent failure are terminal.
- Reclaim expired `processing` rows below three attempts with a new fencing token so late updates from the prior owner are rejected. Mark an expired third attempt `failed` during recovery.
- Keep the local executor deterministic and side-effect-free. Loop 004 owns real provider contracts and their external idempotency strategy.
- Keep existing HTTP routes and fields. Expanding `status` from only `queued` to the four documented lifecycle values is the observable result of this loop.

## Decision gates

- Stop in `replan` if PostgreSQL leasing and fencing cannot prove one active owner and rejection of stale completion under concurrency.
- Stop in `replan` if reliable execution requires an external broker, outbox relay, or a new HTTP route or response field.
- Stop in `replan` if retry and lease tests require wall-clock sleeps or application-process clocks for ownership decisions; arrange database timestamps directly in tests.
- Do not introduce a provider abstraction, distributed scheduler, generalized repository framework, or external side effect.

## Pre-mortem

- **Duplicate application:** a worker finishes after losing its lease. Mitigate with an unexpired UUID fencing token on every terminal update.
- **Stuck processing row:** a worker exits mid-execution. Mitigate by reclaiming expired leases and proving recovery after worker recreation.
- **Retry amplification:** many failures become claimable together. Cap amplification with three attempts and persisted availability; production jitter and rate limiting remain out of scope.
- **Clock skew:** workers disagree about lease expiry. Mitigate by using PostgreSQL transaction time as the single ownership clock.
- **False concurrency evidence:** tests serialize worker claims accidentally. Mitigate with two independent database connections synchronized at the claim boundary.

## Evidence ledger

| Check | Result |
| --- | --- |
| Migration from the Loop 002 schema | Pending |
| Atomic job creation and claimability | Pending |
| Concurrent claim and fencing tests | Pending |
| Retry, permanent failure, and stale recovery tests | Pending |
| Worker restart and persisted terminal state | Pending |
| Existing HTTP contract and domain boundaries | Pending |
| SWC-built API and worker smoke tests | Pending |
| `pnpm verify` | Pending |
| Diff critique | Pending |
