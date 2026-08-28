# Local Development

## Prerequisites

- Node.js 24.19.0 and pnpm 11.22.0.
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

## Verify

```bash
pnpm verify
```

Integration, E2E, and built-API smoke checks create isolated PostgreSQL containers. They do not use the development database configured in `.env`.

## Reset

```bash
docker compose down -v
docker compose up -d --wait postgres
pnpm db:migrate
```

Reset deletes local development data. Migrations are forward-only in the current loop.
