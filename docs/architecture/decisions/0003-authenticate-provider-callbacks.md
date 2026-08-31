# ADR 0003 — Authenticate Provider Callbacks with a Per-Attempt Token

## Status

Accepted

## Context

A provider that accepts work and reports it later needs an inbound route. That route settles jobs, so it must authenticate the caller, apply a notice exactly once, and survive a lost notice — without a lease, because the worker releases its lease while waiting.

A shared secret or a signature scheme both require distributing and rotating a repository-wide secret, and a signature still needs a separate answer for which job a notice belongs to.

## Decision

- Issue one callback token per claim, inside the same statement that takes the lease, and store only its SHA-256 hash.
- Compose the callback URL in the provider adapter from `PUBLIC_CALLBACK_BASE_URL`, the job identifier, and the token; the domain never sees a URL.
- Apply a notice when the row still belongs to the attempt that issued the token — `processing` or `awaiting_provider`, with an unexpired deadline once one exists — and clear the hash in the same statement. A provider may answer before the worker finishes parking the job; the parking update then owns nothing and the worker reports a lost lease.
- Answer every rejected notice with `404`, whatever failed.
- Keep `awaiting_provider` out of the HTTP response and report it as `processing`.
- Recover a wait whose deadline passed as a retryable failure inside the existing three-attempt budget.

## Consequences

- A leaked token settles one attempt of one job and stops working as soon as that attempt ends.
- The awaiting state, the token hash, and the deadline replace the lease as the fence, so a duplicate, late, or stale-attempt notice matches nothing.
- The route reveals nothing about which jobs exist or which tokens are valid.
- The platform depends on the provider calling the URL it was given; a lost notice costs one attempt and its backoff instead of the job.
- Deployments that use an HTTP provider must expose `PUBLIC_CALLBACK_BASE_URL` to it; without one, the adapter refuses accepted work as a permanent failure.
