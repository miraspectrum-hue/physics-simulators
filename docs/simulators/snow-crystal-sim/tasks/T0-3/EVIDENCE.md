# T0-3 Evidence — Layer directory skeleton

## Written change approach

Create the four planned, Git-retained directories beneath
`apps/snow-crystal-sim/src/simulators/snow-crystal-sim/`: `domain`, `app`,
`ui`, and `scene`. Each contains only a `.gitkeep` placeholder. This adds no
application behavior, imports, physical model, or layer-crossing dependency.

## Omitted stages

This is a `lightweight` task with no UI impact. Design and test-case stages are
not applicable: it establishes filesystem layout only and adds no executable
behavior or testable physical, numerical, or UI requirement.

## Preflight

- Worktree: clean (`git status --porcelain=v1` produced no output).
- Staged paths: none (`git diff --cached --name-only` produced no output).
- Baseline fast verification: passed — `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`.
- Baseline architecture check: passed — `node scripts/check-architecture.mjs --workspace apps/snow-crystal-sim`.

## Deterministic verification

- Directory existence: passed — `app`, `domain`, `scene`, and `ui` exist under
  `apps/snow-crystal-sim/src/simulators/snow-crystal-sim/`.
- Architecture boundaries: passed — `node scripts/check-architecture.mjs --workspace apps/snow-crystal-sim`.
- Fast verification: passed — `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`.
- Full workspace verification: passed — `node scripts/verify.mjs --workspace apps/snow-crystal-sim`.
- Diff whitespace check: passed — `git diff --check` produced no output.

The full verification build generated `apps/snow-crystal-sim/dist/`; it was
removed after verification because it is a reproducible build artifact outside
this task's allowed change boundary.
