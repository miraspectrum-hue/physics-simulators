# prism-sim instructions

This app is a Vite 8 + TypeScript 5.9 + Three.js 0.185 simulator tested with
Vitest. Read `SPEC.md` and `TASKS.md` before changes. The current `TASKS.md` is a
legacy record; create new tasks using `../../docs/tasks-authoring-rules.md` rather
than copying its historical phase format.

## Boundaries

- `src/optics/` contains deterministic physical calculations and must not depend
  on DOM APIs or the Three.js scene graph.
- `src/scene/` owns rendering and interaction with Three.js.
- `src/ui/` owns DOM, state binding, controls, and accessibility.
- Internal angles use radians; degrees are allowed only at UI boundaries. Name
  variables with `Deg` or `Rad` suffixes.
- Wavelengths use nanometers except for documented local conversions required by
  a physical formula.
- Do not change material constants without a cited source and validation against
  the reference values in `SPEC.md`.
- Never fake dispersion with fixed decorative colors; rendered separation must
  follow wavelength-dependent optical calculations.

## TypeScript and rendering

- Keep strict typing; use `unknown` plus narrowing instead of `any`.
- Public physical functions need Japanese JSDoc describing argument units and
  return meaning.
- In rendering hot paths, do not allocate geometry or materials every frame.
  Keep disposable resources owned by an object that can call `dispose()`.
- Use two-space indentation, semicolons, single quotes, and external imports
  before local imports.

## Tests and commands

- Put deterministic logic and semantic DOM/state binding tests in Vitest.
- Add `// @vitest-environment jsdom` only to files that need DOM behavior; do not
  make the full suite jsdom.
- Do not use jsdom for layout, pixels, WebGL, or devicePixelRatio behavior. Those
  require browser acceptance evidence.
- Targeted verification from the repository root:
  `node scripts/verify-fast.mjs --workspace apps/prism-sim`
- Full app verification:
  `node scripts/verify.mjs --workspace apps/prism-sim`
