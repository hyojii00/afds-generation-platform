# Active Loop 006 — Report Runtime Health and Job Outcomes

## State

`ready_for_review`

## Target

An operator can ask the running API whether it is able to serve requests, and can read one structured line per HTTP request and per settled job that identifies the job without exposing prompts, credentials, or callback tokens.

## Allowed scope

- Add a `GET /health` route that reports whether the API can reach its migrated schema.
- Enable the Fastify runtime's structured request logging behind a configurable level.
- Add an observer port the worker notifies when a job settles, and a JSON log adapter that writes it.
- Replace the worker's unstructured console output with that adapter.
- Make database shutdown idempotent, so an unusable database can be exercised without a second close throwing.
- Add health, logging, and worker-observer tests.
- Update architecture, configuration, and local-operation owners required by the new route and log format.

## Non-goals

- Metrics, tracing, dashboards, alerting, log shipping, or a metrics endpoint.
- Authentication or rate limiting for the health route.
- Liveness and readiness as separate routes, dependency-by-dependency health detail, or a health route for the worker process.
- Changing the `POST /v1/jobs`, `GET /v1/jobs/:id`, or provider callback contracts.
- Changing the lifecycle, lease, attempt, or provider semantics of Loops 003 through 005.

## Acceptance criteria

1. `GET /health` returns `200` with exactly `{"status":"ok"}` while the API can query its migrated schema.
2. `GET /health` returns `503` with exactly `{"status":"unavailable"}` when the database is unreachable, and the response carries no connection string, driver message, or stack.
3. The health route needs no authentication, is outside `/v1`, and leaves the existing routes and their responses unchanged.
4. The worker notifies its observer once for every settled job with the job identifier, the attempt, and the outcome, and never for an idle poll.
5. The log adapter writes one JSON line per event carrying a timestamp, a level, an event name, and the job fields, and never a prompt, a callback token, a credential, or a provider payload.
6. The API emits one structured line per request, and `LOG_LEVEL` sets or silences the level for both processes.
7. The generation package still imports no NestJS, transport, or configuration code, and the observer stays a port with an adapter outside it.
8. Health, logging, worker, and existing tests, documentation validation, boundary checks, SWC builds, built-process smoke tests, and `pnpm verify` pass.

## Decisions

- Serve one health route rather than separate liveness and readiness routes. A single deployable answer keeps the contract small; splitting it is a decision for whoever deploys this.
- Make the check the same query startup uses, so `200` means "this process can serve `GET /v1/jobs/:id`" rather than "the process is alive".
- Put the route at `/health`, outside `/v1`, because it reports on the runtime rather than on the product API, and version it only if its body ever changes.
- Answer an unhealthy check with a fixed body. An operator reads the status; the driver's message belongs in the log, not in an unauthenticated response.
- Give the domain an observer port instead of a logger. The worker owns what happened; formatting and transport stay in the adapter, and the port keeps the generation package free of both.
- Use the Fastify runtime's own request logging rather than an interceptor, so one library owns the API's log format.

## Decision gates

- Stop in `replan` if the health check cannot distinguish an unusable database without leaking its message.
- Stop in `replan` if structured logging requires the generation package to import a logger or configuration.
- Do not add metrics, tracing, a second health route, or a log-shipping dependency.

## Pre-mortem

- **Health that always answers `200`:** the route checks the process, not the database. Mitigate by closing the pool in a test and asserting `503`.
- **Leaked internals:** the failure body or a log line carries a connection string or a token. Mitigate by asserting the exact bodies and the exact log fields.
- **Noisy logs drowning the outcome:** request logging buries job events. Mitigate with one line per settled job and a configurable level.
- **Domain coupling:** the worker reaches for a logger. Mitigate with the observer port and the boundary check.

## Evidence ledger

| Check | Result |
| --- | --- |
| Healthy and unhealthy health responses | Passed — `pnpm test:e2e` returns `200 {"status":"ok"}` against a migrated database and `503 {"status":"unavailable"}` after the pool closes, with neither the connection string nor a driver message in the body |
| Health route isolation from the product API | Passed — `pnpm test:e2e` keeps `POST /v1/jobs`, `GET /v1/jobs/:id`, and `404` behavior unchanged, and `/v1/health` stays absent |
| Worker observer notifications | Passed — `pnpm test:unit` reports one settled event per job with its identifier, attempt, and outcome, and none for an idle poll |
| Log line shape and secret containment | Passed — `pnpm test:integration` asserts the exact JSON keys for an event, an error event, and a settled job, so only named fields are written |
| Configurable log level | Passed — `pnpm test:integration` silences the adapter at `LOG_LEVEL=silent`; both smoke scripts run the built processes at that level |
| Unchanged HTTP contract and domain boundaries | Passed — `pnpm test:e2e` (13 tests) and `pnpm check:boundaries`; the observer stays a port in the generation package with its adapter in `apps/api` |
| SWC-built API and worker smoke tests | Passed — `pnpm test:smoke` also asserts the built API's health answer, and `pnpm test:smoke:worker` asserts the built worker's `generation_job.settled` line for the job it finished |
| `pnpm verify` | Passed — formatting, lint, boundaries, 92 tests (27 unit, 52 integration, 13 E2E), docs, typecheck, SWC build, and both built-process smoke tests |
| Diff critique | Passed — `git diff --check`; reviewed for scope, domain coupling, public-contract regression, and speculative abstractions |
