# T1-5 Evidence

## Preflight and baseline

- Date: 2026-09-21
- Branch: `feature/snow-crystal-sim`
- Before the task split, no files were staged. The worktree contained the abandoned
  T1-2 test-code draft, sentinel modules, and task artifacts; these are recorded in
  `tasks/T1-2/DECISIONS.md`. Three unapproved test files were preserved in
  `tasks/T1-2/abandoned-test-code/` and excluded from test discovery.
- Baseline command: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`
- Result: architecture and typecheck passed; 4 test files and 24 tests passed.

```yaml
baseline_status: green
red_status: expected-failure
green_status: pending
final_status: pending
ui_acceptance: not-required
```

## Expected Red (2026-09-21)

- Before execution, the latest approved test-code review hashes matched the exact
  test file and importable sentinel modules.
- Targeted command: `npm.cmd run test --workspace snow-crystal-sim -- src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts`
- Result: exit 1; 1 test file, 33 tests: 31 failed and 2 passed. Failures were
  assertions against the importable zero-returning `vaporBudget` sentinel, not
  syntax, type, dependency, or environment errors. For example, VB-01 expected
  deposited water 3.4 within `2.4158453015843406e-14` but received 0; VB-02
  expected `{ mobileVapor: 1.125, depositedWater: 3.625, totalWater: 4.75,
  iceCellCount: 2 }` but received all zero. Invalid/overflow cases expected an
  exception but the sentinel did not throw.
- Existing-tests command: `npm.cmd run test --workspace snow-crystal-sim -- src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts`
- Existing-tests result: exit 0; 4 files and 24 tests passed.
- `npm` via PowerShell `npm.ps1` was blocked by ExecutionPolicy, so the Windows
  `npm.cmd` entry point was used. This did not affect the Vitest results.

## Red recheck after T1-5 scaffold separation

- The obsolete T1-2 `reiter-step.ts` sentinel was preserved under
  `tasks/T1-2/abandoned-test-code/`; `types.ts` and `index.ts` now expose only
  the T1-5 additions. A new independent test-code review approved the exact
  current four source hashes in `REVIEW.md`. Typecheck passed.
- Repeated the targeted command above: exit 1; 31 expected assertion failures
  and 2 passes in 33 tests. VB-01 still reports the 3.4 versus 0 assertion;
  validation and overflow cases report missing expected exceptions. No syntax,
  import, type, or environment failure occurred. The new test file was unchanged.
