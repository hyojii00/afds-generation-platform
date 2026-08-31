# Candidate Loop 005 — Deliver Provider Completion Events

## State

`candidate — not active`

## Target

A generation that a provider completes asynchronously reaches its terminal state through an authenticated completion notice, without a worker holding a lease for the provider's whole runtime.

## Prerequisites

- Loop 004 is merged and the provider port, its normalized result, and its error taxonomy are verified.
- The Loop 003 lifecycle can gain a waiting state without weakening lease, fencing, or attempt guarantees.

## Proposed scope

- Add a waiting state for work the provider accepted but has not finished, and release the lease while waiting.
- Add an authenticated inbound completion route that applies a provider notice idempotently.
- Add a sweeper that gives waiting work a terminal state when no notice arrives inside its deadline.
- Extend the local provider with delayed completion, duplicate notice, and missing notice scenarios.

## Non-goals

- Real paid providers, media storage, provider failover, or client-facing notifications.
- Replacing the Loop 004 request/response contract for providers that answer immediately.
- Streaming progress, partial results, or user cancellation.

## Decision gates

- Decide whether a notice authenticates with a shared secret, a signature, or a per-job token before implementation.
- Define the waiting deadline, its relationship to the attempt limit, and what a missing notice means.
- Define how a duplicate or out-of-order notice is rejected without a lease to fence it.
- Stop in `replan` if the waiting state cannot be proven without weakening Loop 003 guarantees.

## Acceptance outline

1. Accepted work leaves `processing` for a waiting state and releases its lease.
2. An authenticated notice moves waiting work to its terminal state exactly once.
3. An unauthenticated, duplicate, or unknown notice changes nothing.
4. Work with no notice inside its deadline reaches a terminal state.
5. Local provider, route, sweeper, and existing tests plus `pnpm verify` pass.

## Expected evidence

- Notice authentication and rejection tests.
- Duplicate and out-of-order notice tests.
- Waiting deadline sweeper test.
- Architecture decision for the inbound boundary.

## Primary risks

- A notice applied twice or applied to the wrong attempt.
- Work waiting forever because a notice is lost.
- An inbound route widening the public attack surface without authentication evidence.
