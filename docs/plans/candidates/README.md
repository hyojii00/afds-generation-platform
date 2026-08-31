# Loop Roadmap

This roadmap shows the active loop and likely later outcomes in dependency order. Candidate documents are intentionally narrower than an active loop and contain no completed evidence ledger.

## Order

1. [Loop 002 — Persist Generation Jobs](../completed/002-persist-generation-jobs.md) — completed
2. [Loop 003 — Execute Jobs Reliably](../completed/003-execute-jobs-reliably.md) — completed
3. [Loop 004 — Isolate Provider Integrations](../active-loop.md) — active
4. [Loop 005 — Deliver Provider Completion Events](005-deliver-provider-events.md) — candidate

Each later candidate depends on the previous loop being merged. Authentication, observability infrastructure, external messaging, billing, and real paid providers remain unscheduled.

## Activation rule

Only one candidate may replace `docs/plans/active-loop.md`, and only after explicit selection. Activation must re-check repository evidence, resolve its decision gates, convert the acceptance outline into exact criteria, and create an empty evidence ledger. Selecting one loop does not activate the following loop.
