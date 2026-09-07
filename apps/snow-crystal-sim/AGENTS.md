# snow-crystal-sim: Codex instructions

## Scope and authoritative artifacts

This directory is the Snow Crystal Simulator. It is planning-only until
`T0-2` creates its workspace. Do not add a package, install dependencies, or
implement behavior before the selected task permits it.

Read these files before every task, in this order:

1. The repository-root `AGENTS.md`.
2. `../../docs/simulators/snow-crystal-sim/SPEC.md`.
3. `../../docs/simulators/snow-crystal-sim/DESIGN-OUTLINE.md`.
4. `../../docs/simulators/snow-crystal-sim/TASKS.md` and the selected task's
   artifacts under `../../docs/simulators/snow-crystal-sim/tasks/<task-id>/`.

The source-of-truth order is:

```text
SPEC.md > DESIGN-OUTLINE.md > tasks/<task-id>/DESIGN.md > tasks/<task-id>/TESTCASES.md > implementation
```

`CLAUDE.md` is the companion instruction file for Claude Code. Do not delete,
rename, or overwrite it. Requirements, acceptance criteria, equations, source
records, and task status belong in the documents above, not in this file.

## Task execution

- Work on one `TASKS.md` task at a time. Confirm its execution profile, UI
  impact, dependencies, change boundary, and required artifacts before edits.
- Apply the root `AGENTS.md` role routing and gates. Use the named skills for
  task execution, physical validation, review, UI acceptance, and commit
  proposals when their trigger conditions apply.
- Store every task artifact in
  `docs/simulators/snow-crystal-sim/tasks/<task-id>/`. An approved review or
  evidence becomes stale when an input it records changes.
- Ask the human before changing requirements, acceptance criteria, UI design,
  physical equations, units, approximations, numerical methods, or an open
  decision. Do not treat an empirical calibration as a first-principles result.
- Never directly commit or push. Follow the repository commit-proposal flow;
  only explicit human approval permits its guarded commit wrapper.

## Domain and rendering boundaries

Keep the planned structure separate:

```text
src/simulators/snow-crystal-sim/
  domain/  hexagonal-lattice growth and morphology parameters
  app/     trajectory, history, URL state, and presentation conversion
  ui/      Nakaya diagram, timeline, information, and help
  scene/   Three.js rendering
```

- `domain/` is deterministic, side-effect-free, and independent of Three.js,
  DOM, browser globals, and the other layers. Pass a seed explicitly; never
  call global `Math.random` in `domain/`.
- Calculate the whole lattice. Never generate one 60-degree sector and mirror
  or rotate it to fabricate sixfold symmetry.
- Do not use pre-drawn snowflake geometry, textures, or curves as the crystal;
  its shape must come from the growth result.
- Name units in identifiers: `temperatureC`, `angleRad`, and `angleDeg`.
  Keep the basal plane in XZ and the c-axis in +Y. Use axial `q` / `r`
  coordinates for the lattice.
- Use traceable sources for physical constants and model parameters. Record
  applicability, uncertainty, independent oracle, tolerance rationale, and
  reproducibility in the task design.
- In `scene/`, avoid allocation and geometry regeneration in the render hot
  path. Manage Three.js resource disposal explicitly.

## Verification

After `T0-2`, use:

```text
node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim
node scripts/verify.mjs --workspace apps/snow-crystal-sim
```

The first command currently fails before `T0-2` because `package.json` does
not exist; record that expected baseline rather than treating it as a product
failure. For a task gate, also run `verify-task-state.mjs` with the selected
task directory, profile, gate, and UI-impact values.
