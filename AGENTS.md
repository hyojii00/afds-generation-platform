# AGENTS.md

This file is the entry point for humans and AI agents working in this repository.

## Critical rules

- Read `MAP.md`, `WORKFLOW.md`, and `docs/plans/active-loop.md` before editing.
- Treat the active loop as the complete session scope; do not begin a later loop without explicit approval.
- Do not commit secrets, `.env` files, raw prompts, temporary plans, or validation logs.
- Do not add dependencies or expand product scope without an explicit requirement.
- Keep the generation domain independent of NestJS and infrastructure adapters.
- Update the owning document when behavior, architecture, policy, or operations change.

## Verification

Use the narrowest relevant test while developing. Run `pnpm verify` and inspect the full diff before opening or updating a pull request.
