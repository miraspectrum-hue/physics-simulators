# T1-3 Evidence

## Preflight and baseline

- Date: 2026-09-29
- Branch: `feature/snow-crystal-sim`
- Scope: design artifacts for the split T1-3 `morphologyMetrics` task only.
- Before T1-3 edits, no files were staged. The worktree contained unrelated
  uncommitted agent-policy files and historical T1-2 artifacts; they are outside
  this task boundary and were not modified or staged by this design stage.
- Baseline command: `node scripts/verify.mjs`
- Baseline result: exited 0. Architecture checks and workspace typechecks passed;
  prism-sim passed 33 files / 937 tests, snow-crystal-sim passed 8 files / 77 tests,
  and both production builds passed.

```yaml
baseline_status: green
red_status: expected-failure
green_status: green
final_status: passed
ui_acceptance: not-required
```

## Design and test-stage status

- `DESIGN.md` defines the public contract, discrete geometry, units, empty and
  zero-diameter behavior, deterministic six-arm assignment, aggregation order,
  state/thickness validation, independent oracles, and binary64 tolerances.
- Design review was approved and the human-approved design was committed as
  `1c99f1bcdbdf49b4a448a30665c832cb5342cf2c`.
- `TESTCASES.md` was approved after independent numerical review.
- Test code was approved at SHA-256
  `97f9400b89288ce24175e5071c5da1a01d2eb1286aed74f22789853cf32bcb9a`.

## Expected Red

- Date: 2026-09-29
- Command:
  `npm.cmd --prefix apps/snow-crystal-sim test -- --run src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts`
- Result: exited 1 as expected. Vitest ran 12 tests: the independent literal-index
  audit passed, and the remaining 11 tests failed only at
  `morphologyMetrics must be publicly exported`, receiving `undefined` instead
  of a function. There were no syntax, type, module-resolution, dependency, or
  environment failures.
- Implementation Green, final workspace verification, and implementation review
  were pending at the end of the test stage.

## Green and final verification

- Date: 2026-09-29
- Targeted command:
  `npm.cmd --prefix apps/snow-crystal-sim test -- --run src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts`
  - Result: exited 0; 1 file / 12 tests passed.
- Fast command: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`
  - Result: exited 0; architecture and typecheck passed; 9 files / 89 tests passed.
- Full command: `node scripts/verify.mjs`
  - Result: exited 0; workspace architecture, lint/typecheck, prism-sim 33 files /
    937 tests, snow-crystal-sim 9 files / 89 tests, and both production builds passed.
  - The existing prism bundle-size warning remained non-fatal and unrelated.
- Independent implementation review approved the exact production files recorded
  in `REVIEW.md`. UI acceptance is not required for this task.
