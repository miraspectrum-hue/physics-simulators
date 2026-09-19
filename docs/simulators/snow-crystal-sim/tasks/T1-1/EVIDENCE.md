# T1-1 Evidence

```yaml
baseline_status: green
red_status: expected-failure
green_status: green
final_status: passed
ui_acceptance: not-required
```

## Preflight baseline

- Commit baseline: `5229557267f7892d4a3b777b2d3626f0efa57d64`.
- `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim` passed after
  that commit, before T1-1 test code existed (`0` discovered domain test files,
  `0` implementation source files).

## Test-code mapping

| Test file | Approved cases |
|---|---|
| `domain/__tests__/conditions.test.ts` | TC-NORM-001 through TC-NORM-004 |
| `domain/__tests__/prng.test.ts` | TC-RNG-001, TC-RNG-001-SENTINEL, TC-RNG-001-NOISE, TC-RNG-001-INVALID, TC-RNG-001-PURE |
| `domain/__tests__/hex-lattice.test.ts` | TC-HEX-001 through TC-HEX-008 |
| `domain/__tests__/lattice.test.ts` | TC-CREATE-001 through TC-CREATE-007 and TC-RNG-002A |

`vite.config.ts` includes the exact approved domain-test glob in addition to
the existing `tests/**/*.test.ts` glob.

## Expected Red

- Date: 2026-09-19.
- Command: `npm.cmd test -- --reporter=verbose src/simulators/snow-crystal-sim/domain/__tests__`
  from `apps/snow-crystal-sim`.
- Result: expected failure, exit code `1`.
- Vitest collected all `4` approved test files and all `24` tests.
- All `24` tests failed on assertions against the deterministic sentinel
  scaffolds. There were no missing-module, syntax, type, dependency, or
  environment failures.
- Representative failures included the condition-normalization tolerance,
  published PRNG vector, fixed axial radius, and initial lattice metadata
  assertions. This is the intended Red before physical implementation.

## Green and final verification

- Date: 2026-09-19.
- Approved test files remained byte-for-byte unchanged from the approved
  test-code review.
- `npm.cmd test -- --reporter=verbose src/simulators/snow-crystal-sim/domain/__tests__`
  from `apps/snow-crystal-sim`: passed, `4` files and `24` tests.
- `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`: passed;
  architecture boundary check, TypeScript typecheck, and all `24` domain tests
  succeeded.
- `node scripts/verify.mjs`: passed for the complete workspace. The prism app
  passed `33` files / `937` tests; the snow-crystal app passed `4` files / `24`
  tests; both workspace builds succeeded. The prism build retained its existing
  non-failing chunk-size advisory.
- `git diff --check`: passed.

## Post-review remediation verification

- The first implementation review found a safe-integer rounding defect in the
  positive-`r` row-start calculation at the maximum accepted radius.
- `rowStartIndex` was corrected without changing approved tests or contracts.
- Independent BigInt oracle at `radius=54794157`: cell count
  `9007199088404419`, final-row start `9007199033610261`, and final index
  `9007199088404418`; both boundary coordinates round-trip exactly through
  `axialIndex` and `axialAtIndex`.
- After the correction, the targeted `4` files / `24` tests, `verify-fast`,
  `git diff --check`, and full `node scripts/verify.mjs` all passed again.
- The full verification again passed prism `937` tests and snow-crystal `24`
  tests, plus both builds. Generated `apps/snow-crystal-sim/dist/` output was
  removed after verification and is not part of the task diff.
