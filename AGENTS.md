# Codex project instructions

## Purpose and authoritative sources

This repository contains independent physical-simulator web apps under `apps/`.
Before changing simulator `<simulator-id>`, read the nearest `AGENTS.md`,
`docs/simulators/<simulator-id>/SPEC.md`,
`docs/simulators/<simulator-id>/TASKS.md`, and any task artifacts referenced by
that `TASKS.md`.

Use these project-wide references:

- `docs/agent-architecture-codex.md` for roles, gates, review, and commit policy.
- `docs/tasks-authoring-rules.md` whenever creating or updating a `TASKS.md`.

The source-of-truth order is:

```text
SPEC.md > DESIGN-OUTLINE.md > task DESIGN.md > task TESTCASES.md > implementation
```

Do not silently resolve a conflict by changing a higher-level artifact. Stop and
ask the user when the decision changes requirements, acceptance criteria, UI
design, physical equations, units, approximations, or numerical methods.

## Coordinator workflow

The primary Codex thread is the Coordinator. For each requested task:

1. Identify the simulator, task ID, execution profile, UI impact, dependencies,
   and allowed change boundary.
2. Use the default role from the task classification below. Ask the user only
   when the task cannot be classified, cannot be split safely, or meets an
   exception in the architecture document.
3. Take a preflight snapshot of `git status`, staged changes, and the baseline
   verification result before edits.
4. Apply the gates required by the task profile. Only `status: approved` advances
   a review gate.
5. Invalidate downstream approvals and evidence when an approved input changes.
6. Do not mark a task complete until its final verification and implementation
   review pass. Require human UI acceptance only when `UI影響: あり`.

Task routing:

- Coordinator: requirements, task decomposition, gates, exceptions, and commits.
- ArchitectPhysics: design, test-case design, and physical/numerical implementation.
- Reviewer: read-only review of design, test cases, test code, and implementation.
- DeliveryBuilder: environment, test code, non-physical logic, UI, and verification.

Use a fresh subagent thread for design, test-case creation, physical
implementation, and each review. Do not expose one stage's unrecorded reasoning
to another stage. Parallelize read-only investigation only; serialize writers
unless their files, dependencies, configuration, and generated outputs are fully
disjoint.

## Test and physics invariants

- For `full` and `ui` tasks, establish baseline Green before adding tests.
- Red must be the expected assertion failure, not a syntax, type, dependency, or
  environment error. Record baseline, Red, Green, and final checks in `EVIDENCE.md`.
- After Red, do not delete, skip, weaken, or broaden tolerances in tests without
  returning to test-case review.
- Physical work must record sources, units, validity range, approximations,
  tolerance rationale, and reproducibility. Do not derive expected values only
  through the implementation under test.

## Verification commands

- Targeted: `node scripts/verify-fast.mjs --workspace apps/<simulator>`
- Full workspace: `node scripts/verify.mjs`
- Task gates: `node scripts/verify-task-state.mjs --task-dir <dir> --gate <gate> --profile <profile> --ui-impact <none|yes>`

If an app defines lint or typecheck scripts, the verification helpers run them.
Report pre-existing failures separately; do not hide or fix unrelated failures
without authorization.

## Git safety and commits

- Preserve user changes. Never discard, reset, overwrite, or include unrelated
  work.
- Never use `git add .` or `git add -A`; stage explicit task-owned paths only.
- If pre-existing staged changes or mixed-purpose file changes exist, stop before
  staging and ask the user.
- Never run direct `git commit`. Use the `commit-proposal` skill and
  `scripts/commit-approved.mjs` after the user says `コミットしてください` for the
  current proposal.
- Never push unless the user separately requests and authorizes it.

Commit proposals are made after approved design, approved test code plus expected
Red, and approved implementation plus required UI acceptance. A proposal becomes
invalid if its staged paths, staged diff hash, message, review state, or session
changes.
