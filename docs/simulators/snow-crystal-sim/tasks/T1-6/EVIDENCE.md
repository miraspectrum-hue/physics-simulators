# T1-6 Evidence

## Preflight and baseline

- Date: 2026-09-22
- Branch: `feature/snow-crystal-sim`
- Before T1-6 edits, no files were staged. The worktree contains the uncommitted
  T1-2 historical draft/artifacts and the mixed `TASKS.md` planning update;
  these are outside the T1-6 code boundary and must not be staged with it.
- Baseline: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`
  exited 0. Architecture and typecheck passed; 5 test files / 57 tests passed.

```yaml
baseline_status: green
red_status: expected-failure
green_status: pending
final_status: pending
ui_acceptance: not-required
```

## Red attempt 1 — invalid, returned to test-code

- Date: 2026-09-28
- Command: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`
- Result: exited 1 during `tsc --noEmit`; tests did not start.
- Classification: not an expected Red. The new test code had TypeScript errors
  (`TS2532`, unused helper `TS6133`, and unsafe seed casts `TS2352`). No product
  implementation was present, but the intended missing-`step` assertion was not
  reached. The test-code approval is stale and the work returns to test-code
  correction and fresh review.

## Red attempt 2 — invalid, returned to test-code

- Date: 2026-09-28
- Command: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`
- Result: architecture check passed, but `tsc --noEmit` exited 1 before tests.
- Classification: not an expected Red. Two `TS2532` errors remained in the
  pairwise-flux loop of `mass-conservation.test.ts` line 22 (`c[i][0/1]`). The
  prior fix covered the ordered-ledger loop but not this separate local oracle.
  `red_status` remains pending; implementation remains blocked.

## Red attempt 3 — invalid, human decision required

- Date: 2026-09-28
- Command: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`
- Result: architecture check passed, but `tsc --noEmit` exited 1 before tests.
- Classification: not an expected Red. After the pairwise coordinate access was
  fixed, `noUncheckedIndexedAccess` still rejected the same loop's compound
  assignments `delta[i] += flux` and `delta[j] -= flux` (`TS2532`). The test
  suite again did not reach the missing-`step` assertion.
- Gate consequence: `red_status` remains pending. Per the three-attempt rule,
  no fourth correction, test commit, or implementation may proceed without a
  new human decision recorded in `DECISIONS.md`.

## Red attempt 4 — expected failure

- Date: 2026-09-28
- Human authorization: the fourth limited type-safety correction was approved
  and recorded in `DECISIONS.md`; a fresh test-code review approved its exact
  two-assignment diff before execution.
- Command: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`
- Result: exited 1 as expected. Architecture and `tsc --noEmit` passed. Vitest
  ran 8 files / 77 tests: the 5 baseline files and 58 existing tests passed;
  the 3 new T1-6 files failed 19 tests.
- Failure reason: every new failure originates from the explicit public-API
  guard reporting that `step` is `undefined` instead of a function. The two
  invalid-input table tests consequently receive that same assertion before
  their later exception-class assertions. There were no syntax, type,
  dependency, module-resolution, environment, or unrelated-test failures.
- Classification: expected assertion Red for the intentionally absent T1-6
  `step` export. The reviewed tests are now frozen; deletion, skip, tolerance
  broadening, or semantic weakening requires returning to test-case review.
