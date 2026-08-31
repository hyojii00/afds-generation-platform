# AFDS Constitution

## Purpose

This repository demonstrates an AI-first development system in which repository-owned specifications and executable evidence—not chat history—decide whether a change is acceptable.

## Principles

1. **One loop, one pull request.** Each loop has one observable target and stops before the next target begins.
2. **Durable owners over prompt history.** Product, architecture, and behavior live in the files mapped by `MAP.md`.
3. **Evidence over confidence.** A loop is reviewable only when its stated verification has run and passed.
4. **Smallest safe change.** Dependencies, abstractions, and future capabilities require current evidence.
5. **Human decision gates.** Scope changes, public contracts, persistent data, external services, and security boundaries require explicit review.
6. **No proprietary material.** Company source code, schemas, prompts, customer data, credentials, and internal identifiers are excluded.

## Loop states

- `implementing`: the loop contract is agreed and its evidence ledger is not yet satisfied.

## Terminal states

- `ready_for_review`: acceptance criteria and verification pass; a pull request may be opened.
- `blocked`: an external dependency prevents completion and is documented.
- `replan`: repository evidence invalidates the agreed loop contract.

## Archive state

- `completed`: the loop reached `ready_for_review`, its pull request merged, and its plan moved to `docs/plans/completed/`.
