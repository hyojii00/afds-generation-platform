# Candidate Loop 008 — Require Decision Records for Gated Decisions

## State

`candidate — not active`

## Target

A change that crosses a gated surface cannot reach `ready_for_review` without an accepted decision record, and a repository check proves it.

## Prerequisites

- Candidate Loop 007 merges. That loop rewrites `.afds/constitution.md`, which is where this obligation belongs, and this loop would otherwise write into a document being restructured.

## Problem

Decision records exist but nothing requires one. `docs/architecture/decisions/` holds three records, and `MAP.md` gives each a row, yet no sentence in `.afds/constitution.md`, `.afds/workflow.md`, `AGENTS.md`, or `CONTRIBUTING.md` says when a record must be written. `scripts/validate-docs.mjs` never reads the directory.

The gap has a concrete cost. A loop document carries a `## Decisions` section, and that section is archived to `docs/plans/completed/` when the loop closes. Loop 006 decided to give the domain an observer port rather than a logger — an architectural choice that outlives its loop and constrains every later one. Once Loop 006 is archived, that decision lives only inside a completed loop record, which the repository treats as history rather than as a durable owner.

This is a direct contradiction of the constitution's second principle. Durable concerns are supposed to live in the files `MAP.md` maps, not in the record of the change that introduced them.

The trigger condition does not need inventing. The constitution's fifth principle already names the surfaces that require human review: scope changes, public contracts, persistent data, external services, and security boundaries. A decision that crosses one of those is exactly a decision that outlives its loop.

## Proposed scope

- State in `.afds/constitution.md` when a decision record is required, reusing the five gated surfaces already named in the human-decision-gate principle.
- State in `.afds/workflow.md` where the obligation lands in the loop: a gated decision is recorded before the loop reaches a terminal state.
- Draw the boundary between a loop's `## Decisions` section and a decision record: the loop records why this change was shaped this way, the record owns a constraint that binds later changes.
- Add `.afds/templates/decision-record.md` matching the existing records' shape.
- Add a check that fails when a diff touches a gated surface and the active loop links no decision record.
- Collapse the per-record rows in `MAP.md` into one row owning `docs/architecture/decisions/`, so the map does not grow a row per decision.
- Backfill a record for Loop 006's observer-port decision, since it is the case that exposed the gap.

## Non-goals

- Backfilling records for Loops 001 through 005 beyond the one case named above.
- Changing the existing records 0001 through 0003.
- Introducing a decision status workflow beyond the `Accepted` status the records already use.
- Requiring a record for decisions that do not cross a gated surface. Most loop decisions stay in the loop document.
- Changing which surfaces require human review. This loop reuses the five that exist; it does not add a sixth.

## Decision gates

- Stop in `replan` if the gated surfaces cannot be detected from a diff without encoding project-specific paths into `.afds/`, since Loop 007 makes that directory portable.
- Stop in `replan` if the check cannot distinguish a gated change from an ordinary one well enough to avoid demanding records for routine work.
- Do not add a dependency to implement the check.

## Acceptance outline

1. The constitution states the condition under which a decision record is required, in terms of the gated surfaces it already names.
2. The workflow states when in the loop the record must exist.
3. A diff that adds a dependency, a migration, a public route, an external service, or an authentication path fails verification when the active loop links no decision record.
4. A diff that touches none of those surfaces passes without a record.
5. `MAP.md` owns the decision directory as one row.
6. Loop 006's observer-port decision has a record, and the completed loop links it.
7. The detection rule lives in this repository's checks, not in `.afds/`, so portability from Loop 007 is preserved.
8. `pnpm verify` passes.

## Expected evidence

| Check | Expected result |
| --- | --- |
| Gated diff without a record | The check fails and names the surface it detected |
| Gated diff with a linked record | The check passes |
| Ungated diff | The check passes without demanding a record |
| Surface detection coverage | Dependency, migration, public route, external service, and authentication changes are each detected |
| Portability preserved | Loop 007's portability check still passes; no project path entered `.afds/` |
| Map shape | `MAP.md` owns the decision directory in one row and lists no individual record |
| Backfilled record | The observer-port decision is recorded and linked from the completed Loop 006 |
| Repository gate | `pnpm verify` passes |

## Primary risks

- **The rule demands records for routine work.** Detection is too broad, every loop needs a record, and records stop meaning anything. Mitigate by testing an ordinary diff passes untouched, and by keeping the trigger tied to the five existing gated surfaces rather than inventing new ones.
- **Detection is trivially avoided.** A gated change lands through a path the check does not watch. Mitigate by deriving the watched surfaces from the gates themselves and asserting each one is detected.
- **The obligation leaks into the portable contract.** `.afds/` gains this repository's paths and Loop 007's work is undone. Mitigate by keeping the condition in `.afds/` and the detection in this repository's checks, and by running the portability check.
- **Two homes for one decision.** Authors duplicate a decision into both the loop and a record, and the two drift. Mitigate by stating the boundary explicitly and by linking rather than copying.
