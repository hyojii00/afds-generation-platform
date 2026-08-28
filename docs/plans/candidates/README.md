# Candidate Loops

Candidate loops describe likely next outcomes without activating implementation. They are intentionally narrower than an active loop and contain no completed evidence ledger.

## Order

1. [Loop 002 — Persist Generation Jobs](002-persist-generation-jobs.md)
2. [Loop 003 — Execute Jobs Reliably](003-execute-jobs-reliably.md)
3. [Loop 004 — Isolate Provider Integrations](004-isolate-provider-integrations.md)

Each candidate depends on the previous loop being merged. Authentication, observability infrastructure, external messaging, billing, and real paid providers remain unscheduled.

## Activation rule

Only one candidate may replace `docs/plans/active-loop.md`, and only after explicit selection. Activation must re-check repository evidence, resolve its decision gates, convert the acceptance outline into exact criteria, and create an empty evidence ledger. Selecting one loop does not activate the following loop.
