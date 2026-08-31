# Active Loop 005 — Deliver Provider Completion Events

## State

`implementing`

## Target

A generation the provider accepts asynchronously reaches its terminal state through an authenticated completion notice, without a worker holding a lease for the provider's whole runtime, and without changing the public HTTP response fields or values.

## Allowed scope

- Add an `awaiting_provider` lifecycle state that releases the lease, and report it to clients as `processing`.
- Extend the provider port so an implementation can answer "completed" or "accepted", and give the adapter a callback URL to hand the provider.
- Issue one callback token per attempt, store only its hash, and bound the wait with a deadline.
- Add an authenticated inbound completion route that applies a notice once.
- Recover waits whose deadline passed as retryable failures inside the Loop 003 attempt budget.
- Add a forward migration for the callback token hash, the wait deadline, and the expanded status constraint.
- Extend the local provider with delayed completion, duplicate notice, unauthorized notice, and missing notice scenarios.
- Update architecture, configuration, and local-operation owners required by the inbound boundary.

## Non-goals

- Real paid providers, media storage, provider failover, or client-facing notifications.
- Replacing the Loop 004 request/response path for providers that answer immediately.
- Streaming progress, partial results, user cancellation, or provider-initiated retries.
- Changing the `POST /v1/jobs` or `GET /v1/jobs/:id` request and response fields or their status values.
- General inbound authentication, API keys for clients, or a webhook subscription model.

## Acceptance criteria

1. A provider answer of "accepted" moves the job to `awaiting_provider`, persists the normalized reference, releases the lease and fencing token, and records a deadline; the attempt count does not change.
2. `GET /v1/jobs/:id` reports an awaiting job as `processing` and still returns exactly its existing fields; `400` and `404` behavior is unchanged.
3. A notice carrying the attempt's callback token moves an awaiting job to `succeeded` or `failed` exactly once, and the second identical notice changes nothing.
4. A notice with an unknown job, a wrong token, a job that is not awaiting, or a deadline that already passed changes nothing and is answered without revealing which condition failed.
5. Only the hash of a callback token is persisted, and no callback token appears in a job record, an error, or a log line.
6. A wait whose deadline passed is recovered as a retryable failure: it returns to `queued` behind the Loop 003 backoff while attempts remain, and becomes `failed` on the last attempt.
7. A reclaimed or requeued attempt issues a new callback token, so a notice for a previous attempt no longer applies.
8. A forward migration adds the callback and deadline columns without losing existing jobs, and jobs created before it still execute to a terminal state.
9. The local provider proves the full asynchronous round trip against the running API: submit, `202`, callback, terminal state.
10. Contract, adapter, route, worker integration, and existing tests, documentation validation, boundary checks, SWC builds, built-process smoke tests, and `pnpm verify` pass without network access or real credentials.

## Decisions

- Keep `awaiting_provider` out of the public contract and report it as `processing`. The wait is a provider mechanic, and Loop 003's four reported values stay the platform's vocabulary.
- Authenticate a notice with a per-attempt callback token rather than a shared secret or a signature. It needs no secret distribution, scopes a leak to one attempt, and gives the notice its authorization and its identity in one value.
- Issue the callback token at claim time and store only its SHA-256 hash, so a database reader cannot forge a notice and a new attempt invalidates the previous token.
- Treat a missed notice as a retryable failure inside the existing three-attempt budget, using the Loop 003 backoff. The idempotency key from Loop 004 keeps the resubmitted attempt from duplicating accepted work.
- Answer every rejected notice the same way, so the route cannot be used to discover which jobs exist or which tokens are valid.
- Recover expired waits in the worker's existing recovery pass rather than a separate process, so no new deployable unit appears.

## Decision gates

- Stop in `replan` if the waiting state cannot release the lease without weakening Loop 003's fencing or attempt guarantees.
- Stop in `replan` if the notice cannot be applied exactly once without a lease.
- Stop in `replan` if proving the round trip requires a public address, a real provider, or a credential.
- Do not add a webhook subscription model, a signature scheme, a second inbound route, or a separate sweeper process.

## Pre-mortem

- **Notice applied twice:** a provider retries its callback. Mitigate by requiring the awaiting state and the current token hash in the same update, and by proving the second notice changes nothing.
- **Notice for a stale attempt:** a late callback settles work another attempt already owns. Mitigate by issuing a token per claim and proving the previous token stops applying.
- **Work waiting forever:** the notice is lost. Mitigate with a deadline, recovery into the attempt budget, and a test that ends the last attempt as `failed`.
- **Token leakage:** the token reaches logs, job records, or errors. Mitigate by persisting only its hash and asserting its absence in records and messages.
- **Enumeration through the route:** rejections reveal which jobs or tokens exist. Mitigate with one indistinguishable rejection for every failed condition.

## Evidence ledger

| Check | Result |
| --- | --- |
| Accepted answer releases the lease into a bounded wait | Pending |
| Notice applied exactly once | Pending |
| Rejected notices change nothing and stay indistinguishable | Pending |
| Callback token hashing and per-attempt rotation | Pending |
| Deadline recovery inside the attempt budget | Pending |
| Asynchronous round trip against the running API | Pending |
| Unchanged HTTP contract and domain boundaries | Pending |
| Callback and deadline migration | Pending |
| SWC-built API and worker smoke tests | Pending |
| `pnpm verify` | Pending |
| Diff critique | Pending |
