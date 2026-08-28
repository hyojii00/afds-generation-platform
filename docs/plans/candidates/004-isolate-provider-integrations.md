# Candidate Loop 004 — Isolate Provider Integrations

## State

`candidate — not active`

## Target

The worker executes generation through a provider-neutral contract whose success, transient failure, permanent failure, and timeout behavior are proven against a local HTTP provider.

## Prerequisites

- Loop 003 is merged and the worker's retry and idempotency semantics are verified.
- Provider-specific behavior can be introduced without changing job execution ownership.

## Proposed scope

- Define a provider port owned by the generation application boundary.
- Add a local HTTP mock provider with success, transient failure, permanent failure, and timeout scenarios.
- Implement one HTTP adapter that normalizes provider identifiers, results, and failures.
- Add contract tests shared by the mock provider and adapter.
- Keep credentials in runtime configuration and prevent provider payloads from entering domain contracts or logs.

## Non-goals

- Calls to real paid providers, committed credentials, media storage, webhooks, polling orchestration, or provider failover.
- Multiple production adapters, provider-specific product features, billing, or rate-limit optimization.
- Changing the worker's verified retry semantics without an explicit replan.

## Decision gates

- Define the provider request, normalized result, error taxonomy, timeout, and cancellation boundary before implementation.
- Decide whether the first contract is request/response, polling, or callback based on a synthetic provider requirement.
- Define which provider errors are safe to retry without duplicating paid work.
- Stop in `replan` if a real provider or secret is required to prove the contract.

## Acceptance outline

1. The worker depends on the provider port rather than an adapter or mock implementation.
2. Contract tests prove normalized success, transient failure, permanent failure, and timeout behavior.
3. Only transient failures enter the Loop 003 retry path.
4. Logs and job records contain normalized data rather than raw provider payloads or credentials.
5. The local provider, adapter tests, worker integration tests, and `pnpm verify` pass without network credentials.

## Expected evidence

- Provider contract test matrix.
- Worker-to-local-provider integration result.
- Retry classification and timeout tests.
- Architecture decision and configuration-boundary documentation.

## Primary risks

- Retrying a request after the provider accepted it and creating duplicate paid work.
- Provider payload details leaking into domain contracts or logs.
- A synthetic contract that does not expose polling, callback, or cancellation constraints.
