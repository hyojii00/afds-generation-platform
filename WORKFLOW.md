# Development Workflow

## Shape

1. Define one externally observable target and explicit non-goals.
2. Find the durable owner through `MAP.md`.
3. Record testable acceptance criteria in `docs/plans/active-loop.md`.
4. Stop in `replan` when repository evidence conflicts with the loop contract.

## Execute

1. Add the narrowest failing test for one acceptance criterion.
2. Make the smallest implementation change that passes it.
3. Re-run the exact failed command after each correction.
4. Record only commands actually run in the evidence ledger.

## Close

1. Run `pnpm verify`.
2. Review the complete diff for unrelated edits and speculative abstractions.
3. Set the loop to `ready_for_review`, `blocked`, or `replan`.
4. Open one pull request for the loop; do not start the next loop implicitly.
