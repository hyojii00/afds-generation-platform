# Loop Roadmap

This roadmap shows the active loop and likely later outcomes in dependency order. Candidate documents are intentionally narrower than an active loop and contain no completed evidence ledger.

## Order

1. [Loop 002 — Persist Generation Jobs](../completed/002-persist-generation-jobs.md) — completed
2. [Loop 003 — Execute Jobs Reliably](../completed/003-execute-jobs-reliably.md) — completed
3. [Loop 004 — Isolate Provider Integrations](../completed/004-isolate-provider-integrations.md) — completed
4. [Loop 005 — Deliver Provider Completion Events](../completed/005-deliver-provider-events.md) — completed
5. [Loop 006 — Report Runtime Health and Job Outcomes](../active-loop.md) — active

No candidate is scheduled after Loop 006; the next one is written when it is proposed. Each later candidate depends on the previous loop being merged. Authentication, observability infrastructure, external messaging, billing, and real paid providers remain unscheduled.

## Activation rule

Only one candidate may replace `docs/plans/active-loop.md`, and only after explicit selection. Activation must re-check repository evidence, resolve its decision gates, convert the acceptance outline into exact criteria, and create an empty evidence ledger. Selecting one loop does not activate the following loop.
