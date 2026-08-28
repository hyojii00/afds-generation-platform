# Generation Platform Product Brief

## Purpose

Provide a synthetic, portfolio-safe reference for accepting asynchronous media-generation jobs and evolving them through reliable execution boundaries.

## Users

- API clients that submit generation work and inspect its state.
- Engineers reviewing how product requirements become code, evidence, and pull requests through AFDS.

## Initial capability

A client can create a job for the local mock provider and retrieve the accepted job by identifier. The first loop stores jobs in process memory so that the HTTP contract can be proven before a persistence decision.

## Planned evolution

Later loops may add PostgreSQL persistence, Transactional Outbox/Inbox delivery, workers, provider adapters, authentication, observability, and a signaling state machine. Each capability requires its own active loop and pull request.

## Non-goals

- Production media generation or paid provider calls.
- Company source code, schemas, prompts, data, or internal identifiers.
- A frontend, cloud deployment, billing, or multi-tenancy.
- Claiming production readiness from a portfolio reference implementation.
