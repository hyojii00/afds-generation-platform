# ADR 0001 — Use Fastify and SWC

## Status

Accepted

## Context

The API needs an explicit HTTP adapter and a production compilation path. Runtime and build choices should stay visible, reproducible, and independent from TypeScript's static verification.

## Decision

- Use `@nestjs/platform-fastify` as the only NestJS HTTP adapter.
- Use SWC to compile workspace packages and the API into runnable JavaScript.
- Keep `tsc --noEmit` as a separate type-safety gate before SWC compilation.
- Keep source maps and class names; do not minify the server build.

## Consequences

- HTTP-specific behavior and tests follow Fastify semantics rather than Express semantics.
- Production compilation does not depend on TypeScript emitting JavaScript.
- Build throughput is expected to benefit from SWC, but the repository makes no numerical performance claim without a benchmark.
- Decorator metadata configuration must remain covered by the built-API smoke test.
