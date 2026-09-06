---
name: simulator-task-cycle
description: Execute or resume one task from a physical simulator TASKS.md through its required design, review, test, implementation, verification, UI, and commit gates. Use for task execution; use simulator-scaffold instead when creating a new simulator or initial task plan.
---

# Simulator task cycle

Execute one task ID at a time. The primary thread remains the Coordinator and
delegates stage-specific work to the configured custom agents.

## Start

1. Read the repository and nearest app `AGENTS.md` files.
2. Read `docs/agent-architecture-codex.md`, `docs/tasks-authoring-rules.md`, the
   simulator `SPEC.md`, `DESIGN-OUTLINE.md` when present, and its `TASKS.md`.
3. Identify the requested task ID, dependencies, execution profile, UI impact,
   acceptance conditions, allowed change boundary, and artifact directory.
4. If the task is missing a profile or required field, update `TASKS.md` using
   the authoring rules before implementation. Do not reinterpret approved
   requirements while doing so.
5. Read [references/gates.md](references/gates.md) and apply only the gates for
   the selected profile.

For an existing simulator that stores `SPEC.md` and `TASKS.md` in its app root,
preserve that layout unless the user requests migration. For new simulators use
the paths defined by the scaffold skill.

## Invariants

- Take a preflight snapshot before edits. If staged changes already exist, do
  not create a commit proposal until the user resolves them.
- Spawn fresh stage-specific agents. Do not reuse a design or test-author thread
  for physical implementation, and use a fresh Reviewer for every review gate.
- Give agents only approved artifacts and the assigned change boundary. Do not
  send unrecorded reasoning from earlier agents as authority.
- Serialize write-capable agents. Parallel work is allowed only for read-only
  investigation or completely disjoint changes.
- Persist subagent results in task artifacts. The Coordinator writes Reviewer
  output verbatim to `REVIEW.md`; the read-only Reviewer never edits it.
- A changed reviewed file invalidates that review and all dependent gates.
- After three attempts for the same root cause, record attempts and options in
  `DECISIONS.md` and ask the user.

Use `$physics-validation` for any physical model or numerical work,
`$simulator-review` at every review gate, `$ui-acceptance` for UI-impacting
tasks, and `$commit-proposal` at commit gates.

## Finish

Run the appropriate repository verification helper and task-state validator.
Pass `--ui-impact yes` when `UI影響: あり`; UI work cannot pass the
implementation gate until `EVIDENCE.md` records `ui_acceptance: accepted`.
Report completed gates, changed files, verification evidence, pending human
actions, and the next allowed action. Do not claim UI acceptance or commit
approval on the user's behalf.
