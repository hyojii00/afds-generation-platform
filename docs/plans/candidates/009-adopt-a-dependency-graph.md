# Candidate Loop 009 — Adopt a Dependency Graph of Concurrent Slices

## State

`candidate — not active`

## Target

Work units form a declared dependency graph, more than one may be active at the same time, and repository checks prove the graph is acyclic and that concurrent units claim disjoint scope.

## Prerequisites

- Candidate Loop 007 merges. That loop moves the contract into one owner per concern, so this loop changes the meaning of the delivery contract in one file rather than in four.

## Problem

The contract assumes exactly one unit is in flight, and the assumption is encoded in four places.

- `docs/plans/active-loop.md` is a single file, so a second active unit has nowhere to live.
- `.afds/constitution.md` states that a unit "stops before the next target begins", which is a sequential claim, not a scoping one.
- `AGENTS.md` instructs the reader to treat "the active loop" as the session scope, which stops naming a specific unit once several are active.
- `scripts/validate-docs.mjs` hardcodes `Active loop must be Loop 006`, so the validator needs editing every time a unit activates.

The roadmap has the matching limitation. `docs/plans/candidates/README.md` orders candidates in a chain where "each later candidate depends on the previous loop being merged", which cannot express two independent units, or one unit that waits on two predecessors.

The vocabulary is the second problem. "Loop" currently names two different things: the bounded process cycle in `.afds/workflow.md`, and the unit of work in "Active Loop 006". In a dependency graph a loop is a cycle, which the graph must not contain, so naming the nodes "loops" makes cycle detection ambiguous in exactly the conversations the graph exists to support. The process cycle keeps the name; the unit needs a different one.

Concurrency also introduces a hazard that sequential execution made impossible. Two active units can declare overlapping allowed paths and edit the same files. Nothing in the contract forbids it, because until now nothing could.

## Proposed scope

- Rename the unit of work from "loop" to "slice" across the contract, the plans, the map, and the checks. Keep "loop" for the bounded process cycle in `.afds/workflow.md`.
- Replace `docs/plans/active-loop.md` with `docs/plans/active/`, holding one document per active slice.
- Declare each slice's predecessors in its `## Prerequisites` section in a machine-readable form, making those declarations the edges of the graph.
- Restate the activation rule in graph terms: a slice may activate when every declared predecessor is merged and its declared scope is disjoint from every other active slice.
- Add a check that builds the graph from declared prerequisites and fails when it contains a cycle.
- Add a check that fails when two active slices declare overlapping allowed paths.
- Generalize `scripts/validate-docs.mjs` to enumerate `docs/plans/active/` rather than assert a single slice number.
- Restate "one loop, one pull request" in `CONTRIBUTING.md` as "one slice, one pull request", without implying one slice at a time.
- Rewrite `docs/plans/candidates/README.md` as a graph view derived from the declared edges.

## Non-goals

- Designing the agent execution graph or its orchestration runtime. This loop covers planning units; how an agent traverses work inside one slice is separate.
- Changing the seven steps of the bounded process cycle, the terminal states, or what evidence means.
- Automating activation, merge ordering, or dependency resolution. The graph is declared and checked, not scheduled.
- Rewriting completed records 001 through 006 into the new vocabulary. They stay as written, and the constitution notes where the term changed.
- Changing decision gates or adding new ones.

## Decision gates

- The rename touches every plan document and every reference to a unit. Confirm the chosen noun before the rename lands.
- Stop in `replan` if scope disjointness cannot be decided from declared paths alone, since deciding it by building or running the change would make the check unusable during planning.
- Stop in `replan` if concurrent activation cannot be reconciled with one pull request per slice.
- Do not rewrite completed records to the new vocabulary.

## Acceptance outline

1. Two slices can be active at once, each owning its own document under `docs/plans/active/`.
2. A cycle among declared prerequisites fails verification and names the cycle.
3. Two active slices declaring overlapping allowed paths fail verification and name the overlap.
4. Documentation validation enumerates the active directory and hardcodes no slice number.
5. The contract uses "slice" for the unit and "loop" only for the bounded process cycle, and completed records keep their original wording.
6. The roadmap renders the graph and shows at least one pair of slices with no dependency between them.
7. `pnpm verify` passes.

## Expected evidence

| Check | Expected result |
| --- | --- |
| Two concurrently active slices | Documentation validation passes with two documents in `docs/plans/active/` |
| Cycle detection | A seeded cycle in declared prerequisites fails verification and reports the participating slices |
| Scope disjointness | A seeded overlap between two active slices fails verification and reports the shared path |
| Disjoint scopes pass | Two active slices with separate paths pass verification |
| Validator generality | Activating a slice requires no edit to `scripts/validate-docs.mjs` |
| Vocabulary split | The contract names the unit "slice" and the process cycle "loop"; completed records are unchanged |
| Roadmap derived from edges | The graph view matches the declared prerequisites with no separately maintained ordering |
| Repository gate | `pnpm verify` passes |

## Primary risks

- **Parallel slices collide anyway.** Disjointness is declared, not enforced while editing, so two agents can still touch one file. Mitigate by checking declared scopes in the gate, so a colliding merge fails even when the edit succeeded.
- **The graph becomes bookkeeping.** Declaring edges costs more than the linear list did, and the roadmap drifts from the declarations. Mitigate by deriving the roadmap view from the edges instead of maintaining both.
- **Rename churn.** Vocabulary change touches every plan document and breaks references from merged pull requests. Mitigate by leaving completed records untouched and recording where the term changed.
- **Concurrency without capacity.** A single maintainer may never run two slices at once, leaving the machinery unearned. Mitigate by requiring the roadmap to show a real independent pair before this slice closes; if none exists, the graph is premature and this slice should stop in `replan`.
- **Two graphs, one word.** The planning graph and the agent execution graph both have nodes and edges, and documents start conflating them. Mitigate by naming them separately in the contract and keeping execution out of scope here.
