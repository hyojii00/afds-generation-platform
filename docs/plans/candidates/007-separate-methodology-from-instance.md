# Candidate Loop 007 — Separate the Methodology from This Instance

## State

`candidate — not active`

## Target

`.afds/` states the complete AFDS contract in project-neutral terms, so a second repository adopts the system by copying that directory unchanged, and a check proves `.afds/` names nothing belonging to this project.

## Prerequisites

- Loop 006 merges and its plan moves to `docs/plans/completed/006-report-runtime-health.md`.

This loop runs before Candidate Loop 009, which changes the concurrency model and the unit's name. Moving text into one owner per concern is mechanical; changing the contract's meaning across four scattered documents is not. Running this loop first means 009 edits one file instead of four, and this loop stays a relocation rather than a redesign.

## Problem

The contract is split across two layers that were never separated.

`.afds/constitution.md` opens with "This repository demonstrates", so the constitution is written about this repository rather than as a contract a repository can adopt. The rest of the protocol lives outside `.afds/`: `WORKFLOW.md` restates the loop as Shape, Execute, and Close, `CONTRIBUTING.md` owns "one loop, one pull request", and `docs/plans/candidates/README.md` owns the activation rule. Adopting AFDS elsewhere currently means reading four files and deciding which sentences are portable.

Two consequences follow from the same cause:

- The loop state machine has no owner. States are defined in `.afds/constitution.md`, activation in `docs/plans/candidates/README.md`, closure in `WORKFLOW.md`, and the pull-request rule in `CONTRIBUTING.md`. `MAP.md` exists to prevent exactly this, and the contract itself is the concern that escapes it.
- Two documents describe one protocol. `.afds/workflow.md` and `WORKFLOW.md` cover the same loop at different granularity, and neither says which is normative.

The repository also enforces invariants mechanically — `scripts/check-boundaries.mjs` keeps the generation domain free of NestJS, `scripts/validate-docs.mjs` keeps plan documents honest — but the contract never names that layer, so an adopting repository has no reason to build one.

## Proposed scope

- Rewrite `.afds/constitution.md` in project-neutral terms and give it sole ownership of the loop state machine, including the activation and archival transitions currently stated elsewhere.
- Merge `WORKFLOW.md` into `.afds/workflow.md` so one document is normative for the loop protocol, and delete the root file.
- Add `.afds/adoption.md` stating what an adopting repository must supply: its map, its entry point, its plan directory, its verification gate, and its invariant checks.
- Add `.afds/templates/loop.md` as the loop document skeleton, carrying the headings `scripts/validate-docs.mjs` requires.
- Name the machine-checked invariant layer in the constitution and reference it from the workflow's verification step.
- Reduce `AGENTS.md` to this repository's entry point and its own invariants, delegating the portable contract to `.afds/`.
- Complete `MAP.md` so every normative document appears as a row.
- Add a portability check to `pnpm verify` that fails when `.afds/` names this project's stack, packages, or paths.
- Register this candidate in `scripts/validate-docs.mjs` so its schema is enforced.

## Non-goals

- Applying AFDS to any other repository.
- Extracting `.afds/` into a separate repository, package, or submodule.
- Changing the substance of the loop protocol. Steps, states, gates, and evidence rules keep their current meaning; only their location and wording change.
- Adding new obligations to the contract, including any decision-record rule. That is Candidate Loop 008.
- Renaming the work unit or changing how many units may be active at once. That is Candidate Loop 009. This loop states the single-active model as it exists today, in its final location, so 009 can change it in one place.
- Changing product code, tests, migrations, or the CI workflow beyond adding the portability check.
- Rewriting completed loop records 001–006.

## Decision gates

- Stop in `replan` if project-neutral wording cannot decide a real case. Verify by re-reading Loop 006's decisions against the rewritten constitution and confirming it still adjudicates them.
- Deleting `WORKFLOW.md` removes a contributor-facing path; confirm before removal.
- Do not add a dependency to implement the portability check.
- Do not let neutral wording enter completed loop records.

## Acceptance outline

1. Copying `.afds/` into an empty repository yields a contract that reads completely, with no sentence that depends on this project existing.
2. A repository check fails when `.afds/` names this project's stack, packages, or paths, and passes on the rewritten directory.
3. Loop states and every transition between them are defined in one file.
4. Exactly one document is normative for the loop protocol, and `MAP.md` names it.
5. `MAP.md` has a row for every normative document, including the contract, the entry point, and the invariant checks.
6. `AGENTS.md` carries this repository's entry point and invariants only, and directs the reader to `.afds/` for the delivery contract.
7. `pnpm verify` passes, including documentation validation over the moved documents.

## Expected evidence

| Check | Expected result |
| --- | --- |
| Portability check on rewritten `.afds/` | `pnpm verify` passes; the check reports no project-specific term |
| Portability check against a seeded violation | The check fails when a project term is reinserted into `.afds/` |
| Single owner for the state machine | Every state and transition appears in `.afds/constitution.md`, and no other document defines one |
| Single normative protocol | `WORKFLOW.md` is absent and `MAP.md` names `.afds/workflow.md` |
| Map completeness | Every normative document has a `MAP.md` row |
| Constitution decides a real case | Loop 006's six decisions remain adjudicable under the rewritten constitution |
| Documentation validation | `scripts/validate-docs.mjs` passes over the moved documents and this candidate |
| Repository gate | `pnpm verify` passes |
| Diff critique | Changes stay inside the allowed paths; completed loops are untouched |

## Primary risks

- **Abstraction hollows the contract.** Neutral wording drifts into statements no change can violate. Mitigate by phrasing every obligation as a rule something can fail, and by testing the result against Loop 006.
- **The entry point loses its teeth.** `AGENTS.md` shrinks to a link list and agents stop meeting operative rules. Mitigate by keeping this repository's invariants inline and naming the files to read before editing.
- **The portability check is theater.** A short substring list passes because it asks too little. Mitigate by seeding it from the project-specific terms present in `.afds/` today and asserting it fails on a deliberate violation.
- **Link rot.** Moving normative text breaks references from completed loops and the roadmap. Mitigate with documentation validation over every moved link.
- **Scope leak.** Structural work drifts into rewording finished loops or adding contract obligations. Mitigate with the non-goals and a diff review restricted to the allowed paths.

## Activation

On activation this candidate replaces `docs/plans/active-loop.md`, its acceptance outline becomes exact criteria, its decision gates are re-checked against repository evidence, and its evidence ledger starts empty.
