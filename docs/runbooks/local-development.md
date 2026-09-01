# Local Development

## Prerequisites

- Node.js 24.20.0 and pnpm 11.22.0.
- A running Docker engine.

## Start

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait postgres
pnpm db:migrate
pnpm dev:api
```

The API reads `.env`, listens on `http://localhost:3000`, and fails startup when the database or migrated `generation_jobs` table is unavailable.

## Run the worker

```bash
pnpm build
pnpm start:worker
```

The worker is a separate process that shares only PostgreSQL with the API. It claims one queued job at a time, recovers leases that expired, and stops on `SIGINT` or `SIGTERM` after the job in flight settles. A database error that escapes the loop is logged and exits the process with status 1 rather than retrying silently, so run it under a supervisor that restarts it; the lease its job holds expires and another worker reclaims the work. It polls every 200 milliseconds while the queue is empty; set `WORKER_IDLE_DELAY_MS` to change that. Running several workers is safe: row leasing gives each job one owner.

By default the worker runs the in-process mock provider and needs no configuration. Set `PROVIDER_BASE_URL` to call an HTTP provider instead, with `PROVIDER_API_KEY` for its credential and `PROVIDER_TIMEOUT_MS` for its call bound (5 seconds by default, and it must stay under the 30-second lease or the worker refuses to start). Set `PUBLIC_CALLBACK_BASE_URL` to the address the provider can reach the API on; a provider that answers `202` without one fails the job permanently. Credentials live in `.env`, never in the repository, and never reach job records or logs.

Jobs move `queued` → `processing` → `succeeded` or `failed`. Work a provider accepts for later waits in `awaiting_provider`, which the API reports as `processing`; it holds no lease and settles when the provider posts to `/v1/provider-callbacks/:id/:token`. A wait whose deadline passes is recovered like a retryable failure. A retryable failure returns the job to `queued` behind a 1-second and then a 2-second backoff, and the third attempt is terminal. Inspect a stuck job directly:

```bash
docker compose exec postgres psql -U afds -d afds_generation_platform \
  -c "select id, status, attempt_count, available_at, lease_expires_at, failure_reason, provider_reference from generation_jobs order by created_at desc limit 10;"
```

## Check the runtime

```bash
curl -s http://localhost:3000/health
```

`{"status":"ok"}` means the API reached its migrated schema; `503 {"status":"unavailable"}` means it did not, and the reason is in the API log rather than the response. Both processes write structured JSON lines; set `LOG_LEVEL` (for example `debug`, `warn`, or `silent`) to change or silence them. Follow one job with its identifier:

```bash
pnpm start:worker | grep generation_job.settled
```

## Verify

```bash
pnpm verify
```

Integration, E2E, and built API and worker smoke checks create isolated PostgreSQL containers. They do not use the development database configured in `.env`.

## Reset

```bash
docker compose down -v
docker compose up -d --wait postgres
pnpm db:migrate
```

Reset deletes local development data. Migrations are forward-only in the current loop.
