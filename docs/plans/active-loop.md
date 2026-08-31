# Active Loop 004 — Isolate Provider Integrations

## State

`ready_for_review`

## Target

The worker executes generation through a provider-neutral port whose success, transient failure, permanent failure, and timeout behavior are proven against a local HTTP provider, without changing the public HTTP contract.

## Allowed scope

- Define a provider port, its request, its normalized result, and its error taxonomy in the generation package.
- Add an HTTP provider adapter that sends the job identifier as an idempotency key, bounds every call with a timeout, and normalizes provider identifiers, results, and failures.
- Select the in-process mock provider or the HTTP adapter from runtime configuration, and keep credentials in configuration.
- Add a forward migration for the normalized provider reference on `generation_jobs`.
- Add a local HTTP provider for tests with success, transient failure, permanent failure, timeout, and idempotency scenarios.
- Add contract tests shared by the mock provider and the HTTP adapter, plus worker integration tests for retry classification.
- Update architecture, configuration, and local-operation owners required by the provider boundary.

## Non-goals

- Calls to real paid providers, committed credentials, media storage, or provider failover.
- Webhooks, callbacks, polling orchestration, or any asynchronous completion notice; Loop 005 owns those.
- Changing the Loop 003 lifecycle, lease, fencing, attempt limit, or backoff semantics.
- Changing the `POST /v1/jobs` or `GET /v1/jobs/:id` request and response fields.
- Multiple production adapters, provider-specific product features, billing, or rate-limit optimization.

## Acceptance criteria

1. The worker depends on the provider port; neither the worker nor the generation package imports the HTTP adapter, `fetch` wiring, or configuration.
2. A shared contract test suite proves that the mock provider and the HTTP adapter both return a normalized reference for a successful generation and reject an unusable request as a permanent failure.
3. The HTTP adapter classifies `429`, `5xx`, connection failure, and timeout as transient, and `4xx` other than `429` and an unusable success body as permanent.
4. Only transient failures reach the Loop 003 retry path; a permanent failure ends the job on its first attempt, and the lifecycle, lease, fencing, and backoff behavior of Loop 003 is unchanged.
5. Every provider call carries the job identifier as an idempotency key and is bounded by a timeout shorter than the lease, and the local provider proves a repeated key returns the first reference without doing the work twice.
6. A successful job persists the normalized provider reference; `GET /v1/jobs/:id` still returns exactly its existing fields, and `400` and `404` behavior is unchanged.
7. Normalized failures carry the provider status and reason without provider payloads, credentials, or request bodies, and no configured credential appears in an error or a log line.
8. A forward migration adds the provider reference without losing existing jobs, and jobs created before it remain claimable and completable.
9. Contract, adapter, worker integration, and existing tests, documentation validation, boundary checks, SWC builds, built-process smoke tests, and `pnpm verify` pass without network access or real credentials.

## Decisions

- Make the first provider contract request/response with a bounded timeout. An asynchronous completion notice would reopen the Loop 003 lease and lifecycle contract, so Loop 005 owns callbacks and their inbound authentication.
- Send the job identifier as the idempotency key on every call and classify timeouts and `5xx` as transient. The key, not the absence of a retry, is what keeps a repeated attempt from duplicating paid work.
- Persist the normalized provider reference on `generation_jobs` and keep it out of the HTTP response. Exposing it is a public-contract decision that no current requirement needs.
- Keep `provider: "mock"` as the only accepted request value and choose the adapter from configuration, so the provider boundary can be proven without changing the public contract.
- Keep provider payloads out of the domain: the port accepts a prompt and returns a reference, and failures carry a normalized status and reason.
- Bound the provider call at 5 seconds by default, well inside the 30-second lease, so a slow provider cannot outlive its lease.

## Decision gates

- Stop in `replan` if the provider boundary requires changing the Loop 003 lifecycle, lease, or retry semantics.
- Stop in `replan` if proving the contract requires a real provider, a network call, or a credential.
- Stop in `replan` if normalized failures cannot be classified without inspecting provider payloads.
- Do not add a second production adapter, a provider registry, callbacks, or a generalized transport abstraction.

## Pre-mortem

- **Duplicate paid work:** a retry repeats a request the provider already accepted. Mitigate with the job identifier as an idempotency key and a local provider that proves a repeated key does the work once.
- **Payload leakage:** provider bodies or credentials reach domain types, job records, or logs. Mitigate by normalizing at the adapter and asserting that error text carries neither.
- **Silent misclassification:** a permanent failure is retried three times, or a transient failure ends the job. Mitigate with a status-by-status classification test.
- **Timeout outliving the lease:** a slow provider holds a job past its lease and another worker reclaims it. Mitigate with a provider timeout well inside the lease and an explicit assertion on the configured bound.
- **Contract drift:** the mock provider and the HTTP adapter diverge. Mitigate by running one contract suite against both.

## Evidence ledger

| Check | Result |
| --- | --- |
| Shared provider contract suite | Passed — `pnpm test:integration` runs one suite against the mock provider and the HTTP adapter for a normalized reference, a repeated request, and a permanently rejected request |
| HTTP failure classification and timeout | Passed — `pnpm test:integration` classifies `429`, `503`, a refused connection, a 500ms header timeout, and a body that stops mid-stream as transient, and an unparseable body and an identifier-less success as permanent |
| Idempotency key and single execution | Passed — `pnpm test:integration` repeats a request and the local provider returns the first reference after doing the work once |
| Worker retry classification through the port | Passed — `pnpm test:integration` drives the worker through the HTTP provider: a transient failure requeues at attempt 1, a permanent failure ends the job at attempt 1, and neither writes a reference |
| Credential and payload containment | Passed — `pnpm test:integration` asserts the provider received the bearer credential while the normalized failure carries only `provider 503: provider is unavailable` |
| Provider reference migration and persistence | Passed — `pnpm test:integration` migrates a Loop 002 database through `drizzle/0002_add_provider_reference.sql`, then claims, completes, and reads back the preserved job's reference |
| Configuration refuses unusable values | Passed — `pnpm test:integration` fails startup for a base URL that is set but empty, is not a URL, or carries a timeout that outlives the lease, and keeps the path of a base URL that has one |
| Unchanged HTTP contract and domain boundaries | Passed — `pnpm test:e2e` (5 tests) keeps the response fields, `400`, and `404`; `pnpm check:boundaries` also rejects `fetch`, `node:http`, and `process.env` inside the generation package |
| SWC-built API and worker smoke tests | Passed — `pnpm test:smoke` and `pnpm test:smoke:worker` |
| `pnpm verify` | Passed — formatting, lint, boundaries, 60 tests (20 unit, 35 integration, 5 E2E), docs, typecheck, SWC build, and both built-process smoke tests |
| Diff critique | Passed — `git diff --check`; reviewed for scope, domain coupling, public-contract regression, and speculative abstractions |
