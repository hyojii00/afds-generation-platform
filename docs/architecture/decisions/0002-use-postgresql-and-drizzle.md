# ADR 0002 — Use PostgreSQL and Drizzle

## Status

Accepted

## Context

Accepted jobs must remain retrievable after an API restart without coupling the generation domain to infrastructure. Persistence needs an explicit schema, reproducible migrations, and isolated verification.

## Decision

- Use PostgreSQL 18 as the persistent store for generation jobs.
- Use Drizzle ORM only in the API persistence adapter.
- Keep forward-only, versioned SQL migrations in `drizzle` and apply them explicitly before API startup.
- Fail API startup when `DATABASE_URL`, connectivity, or the migrated schema is unavailable; do not fall back to memory.
- Use Testcontainers for repository, restart E2E, and built-artifact verification.

## Consequences

- Local development and verification require Docker and PostgreSQL availability.
- Schema and adapter changes must remain aligned through migration-from-empty and round-trip tests.
- The generation package remains independent of PostgreSQL, Drizzle, and NestJS.
- Migration automation for deployed environments and destructive rollback tooling remain outside this loop.
