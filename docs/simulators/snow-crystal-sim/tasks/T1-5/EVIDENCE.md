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
green_status: green
final_status: passed
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

## First implementation check (not Green)

- The new `vaporBudget` implementation was checked with
  `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`.
- Architecture and typecheck passed; Vitest reported 53 passed and 4 failed in
  57 tests. The implementation writer changed only `vapor-budget.ts` and stopped.
- Three failures are VB-O1/O2/O3: the test-only `reportedField` parser omits
  `mobileVapor`, `depositedWater`, and `totalWater`, so it cannot recognize a
  correct `RangeError` field. VB-P02 sets `waterMass` to a plain Array; the
  test expects `RangeError` despite T1-5 DESIGN §4 requiring `TypeError` for
  array type mismatch. These are test-code transcription defects; no approved
  case, numerical expected value, or tolerance is being changed.
- `green_status` and `final_status` remain pending. Return to test-code review
  and re-establish applicable Red evidence before treating the implementation
  as Green.

## Red recheck for corrected test code

- An independent Reviewer approved the corrected test file at SHA-256
  `33c22bf2a51836852cd2fab933449319632ea779e18e2b7271fec6fe071892be`.
- The verification worker extracted the committed `89ba8ca` app snapshot to an
  isolated temporary directory, mechanically copied only the current reviewed
  test file into it, and used the existing repository Vitest installation.
  The workspace implementation and Git index were not changed.
- Targeted Vitest result against the committed zero-returning sentinel: exit 1;
  33 tests, 31 expected assertion failures and 2 passes. VB-01 was still 3.4
  expected versus 0 received; VB-02 was the expected phase totals versus four
  zeros; invalid/overflow cases expected an exception but the sentinel did not
  throw. No syntax, type, import, dependency, or environment failure occurred.
- Existing four test files in that snapshot: exit 0; 24/24 tests passed.

## Green and final verification (2026-09-22)

- `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`: exit 0.
  Architecture and typecheck passed; 5 test files / 57 tests passed.
- `node scripts/verify.mjs`: exit 0. Workspace architecture, typechecks,
  tests, and builds passed. `prism-sim`: 33 files / 937 tests passed;
  `snow-crystal-sim`: 5 files / 57 tests passed. Both production builds passed.
- The `prism-sim` build emitted a non-failing warning about a chunk over
  500 kB; no unrelated source was changed for this task.
