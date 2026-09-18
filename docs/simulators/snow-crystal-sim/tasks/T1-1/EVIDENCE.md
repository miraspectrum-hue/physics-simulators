# T1-1 Evidence

```yaml
baseline_status: green
red_status: expected-failure
green_status: pending
final_status: pending
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
