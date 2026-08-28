# AFDS Loop Protocol

Each pull request follows the same bounded loop:

1. **Target** — state one result visible outside the implementation.
2. **Constraints** — declare allowed paths, non-goals, and decision gates.
3. **Tests first** — create evidence that fails for the missing behavior.
4. **Minimal implementation** — change only what is needed to satisfy the evidence.
5. **Verification** — run focused checks, then the repository-wide gate.
6. **Critique** — inspect the diff for correctness, minimality, coverage, and regression risk.
7. **Terminal state** — record evidence and stop at `ready_for_review`, `blocked`, or `replan`.

AI may explore, propose, implement, test, and critique. Humans retain decisions about scope, architecture, security, persistence, cost, and publication.
