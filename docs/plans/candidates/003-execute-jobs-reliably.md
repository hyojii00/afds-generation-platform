# Candidate Loop 003 — Execute Jobs Reliably

## State

`candidate — not active`

## Target

A persisted queued job is executed asynchronously by an independent worker, with duplicate-safe claiming and explicit terminal failure.

## Prerequisites

- Loop 002 is merged and PostgreSQL persistence is the verified runtime path.
- Job state transitions and persistence transactions can be tested deterministically.

## Proposed scope

- Persist execution work atomically with job creation.
- Add an independently runnable worker that claims work with a bounded lease.
- Define `queued`, `processing`, `succeeded`, and `failed` transitions and reject invalid transitions.
- Add bounded retry with explicit attempt count, backoff, and permanent-failure handling.
- Recover stale claims and prevent duplicate delivery from applying the same result twice.
- Execute only deterministic local mock work.

## Non-goals

- Real provider calls, provider SDKs, callbacks, billing, authentication, or user cancellation.
- Kafka, RabbitMQ, or another external broker unless activation evidence forces a replan.
- Cross-service integration events, generalized workflow engines, or unlimited retry policies.

## Decision gates

- Prefer the smallest durable transport; compare PostgreSQL leasing with a transactional outbox before selecting either.
- Define lease duration, retryable failures, backoff limits, stale recovery, and idempotency keys before implementation.
- Define the transaction boundary between job creation, execution request, and state updates.
- Stop in `replan` if reliable execution requires an external broker or changes the HTTP contract.

## Acceptance outline

1. Creating a job records durable execution work in the same transaction.
2. One worker claim moves the job through valid states to `succeeded` for the local mock path.
3. Duplicate claims or worker restarts do not execute or apply the same successful result twice.
4. Retryable failures stop after the configured bound; permanent failures become `failed` immediately.
5. Stale work is recoverable, and integration tests plus `pnpm verify` pass.

## Expected evidence

- Transactional creation test.
- Concurrent claim and duplicate-delivery integration tests.
- Retry, permanent failure, and stale-lease recovery tests.
- Worker lifecycle and local-operation runbook updates.

## Primary risks

- Duplicate side effects despite idempotent state updates.
- Jobs remaining permanently `processing` after worker failure.
- Retry storms or concurrent claims overwhelming PostgreSQL.
