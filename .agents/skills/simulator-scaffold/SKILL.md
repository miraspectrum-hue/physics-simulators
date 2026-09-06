---
name: simulator-scaffold
description: Create the requirement, architecture, task-plan, and task-artifact skeleton for a new physical simulator in this repository. Use for initial simulator setup or a new simulator plan; do not use to execute an existing task.
---

# Simulator scaffold

Create a new simulator without copying application-specific physics or UI from an
existing simulator.

1. Read root `AGENTS.md`, `docs/agent-architecture-codex.md`, and
   `docs/tasks-authoring-rules.md`.
2. Confirm the simulator ID, user goal, minimum supported behavior, and human
   acceptance criteria. Ask only when a missing answer would materially change
   the architecture or physics.
3. Create code under `apps/<id>/` and planning artifacts under
   `docs/simulators/<id>/`.
4. Adapt the templates in `assets/`; remove every placeholder that is not useful.
5. Keep physical domain, application logic, UI, and rendering separated. Do not
   select a physical model or constants without traceable sources.
6. Define phases as value or risk-reduction milestones. Define each task with an
   execution profile, UI impact, owner classification, dependency, change
   boundary, artifacts, and objectively checkable completion criteria.
7. Review the initial `SPEC.md` and `DESIGN-OUTLINE.md` before marking the task
   plan ready for execution.

Do not install dependencies, implement simulator behavior, or commit unless the
user's request includes those actions and the normal approval workflow permits
them.
