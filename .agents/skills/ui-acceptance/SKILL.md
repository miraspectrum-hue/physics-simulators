---
name: ui-acceptance
description: Prepare deterministic browser evidence and a human acceptance checklist for a simulator task with UI impact. Use before human UI confirmation; never claim or record acceptance without the user's decision.
---

# UI acceptance preparation

Use only when the active task declares `UI影響: あり`.

1. Verify automated UI tests and the production build.
2. Start the appropriate development or preview server without changing product
   data or external systems.
3. Read [references/checklist.md](references/checklist.md), select the applicable
   states, and record exact reproduction steps, URL, viewport, browser, and known
   limitations.
4. Capture deterministic evidence when tools permit, but treat screenshots as
   supporting evidence rather than acceptance.
5. Ask the user to confirm the specified states. Record accepted, rejected, and
   deferred items separately.

If the user rejects a state, invalidate the final implementation review and
commit proposal, return to implementation, rerun verification and review, then
request UI acceptance again.
