---
name: simulator-task-cycle
description: Execute or resume one task from a physical simulator TASKS.md through its required design, review, test, implementation, verification, UI, and commit gates. Use for task execution; use simulator-scaffold instead when creating a new simulator or initial task plan.
---

# Simulator task cycle

Execute one task ID at a time. The primary thread remains the Coordinator and
delegates stage-specific work to the configured custom agents.

## Start

1. Read the repository and nearest app `AGENTS.md` files.
2. Read `docs/agent-architecture-codex.md`, `docs/tasks-authoring-rules.md`, and
   `docs/simulators/<simulator-id>/SPEC.md`, `DESIGN-OUTLINE.md` when present,
   and `TASKS.md`.
3. Identify the requested task ID, dependencies, execution profile, UI impact,
   acceptance conditions, allowed change boundary, and artifact directory.
4. If the task is missing a profile or required field, update `TASKS.md` using
   the authoring rules before implementation. Do not reinterpret approved
   requirements while doing so.
5. Read [references/gates.md](references/gates.md) and apply only the gates for
   the selected profile.

Use `docs/simulators/<simulator-id>/` for simulator planning artifacts. The app
directory under `apps/<simulator-id>/` contains implementation code and its local
`AGENTS.md`, not the simulator's `SPEC.md` or `TASKS.md`.

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

## Automatic remediation and re-review

When a Reviewer returns `status: changes-requested`, the Coordinator continues
without asking the human only when every finding has a concrete
`required_change`, the change stays within the current task's documented
boundary, and it does not change a requirement, acceptance criterion, UI
design, physical equation, unit, approximation, numerical method, or other
human-owned decision.

1. Append the Reviewer YAML unchanged to `REVIEW.md`. Create or update
   `REMEDIATION.md` with the source review, finding IDs, rollback target,
   attempt number, allowed boundary, changed paths, and deterministic checks.
   Use `assets/task/REMEDIATION.template.md` when creating the file.
2. Invalidate the rejected approval and send a fresh writer for the
   `rollback_to` stage. Give it only the authoritative artifacts, the Reviewer
   findings, and the documented boundary. It must not review its own change.
3. Run the applicable deterministic checks, then send a fresh Reviewer the
   updated artifacts. Append its result unchanged to `REVIEW.md`.
4. Resume only on `status: approved`. A changed input invalidates the earlier
   record; do not overwrite the review history or treat an old approval as
   current.

Stop and request human direction instead when the review returns `needs-human`,
the remediation would cross the task boundary or alter a protected decision,
the same root cause reaches three attempts, or the user asks to pause. Never
create a commit proposal or perform a commit automatically as part of this
loop.

## Finish

Run the appropriate repository verification helper and task-state validator.
Pass `--ui-impact yes` when `UI影響: あり`; UI work cannot pass the
implementation gate until `EVIDENCE.md` records `ui_acceptance: accepted`.
Report completed gates, changed files, verification evidence, pending human
actions, and the next allowed action. Do not claim UI acceptance or commit
approval on the user's behalf.
