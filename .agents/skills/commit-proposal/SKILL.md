---
name: commit-proposal
description: Safely stage task-owned files, create a hashed commit proposal, wait for explicit human approval, and execute the approved commit. Use at workflow commit gates or when the user asks to commit; never use for push.
---

# Commit proposal

This skill does not grant commit permission. The user must approve the current
proposal by saying `コミットしてください` in the same conversation.

## Create a proposal

1. Confirm the required task gate is approved and run the required verification.
2. Inspect `git status`, working diff, and staged diff. If anything was staged
   before the task, stop and ask the user to resolve it.
3. If a target file contains unrelated edits, do not stage it. Explain the mixed
   diff and ask the user how to proceed.
4. Stage only explicit task-owned paths with `git add -- <path>...`. Never use
   `git add .` or `git add -A`.
5. Inspect `git diff --cached` and create a concise message describing the staged
   change.
6. Create the machine state and human-readable proposal:

```text
node scripts/commit-proposal.mjs create --task <task-id> --stage <design|test|implementation|lightweight|emergency> --message "<message>"
```

7. Add verification results to the response and stop. Do not approve or commit in
   the same turn as the proposal.

## Execute after approval

When the user says `コミットしてください`:

1. Read the active state with `node scripts/commit-proposal.mjs status`.
2. Confirm it is the latest proposal from this conversation and that the user's
   message does not narrow or change the scope.
3. Record approval, which revalidates staged paths and diff hash:

```text
node scripts/commit-proposal.mjs approve --id <proposal-id>
```

4. Execute only through the guarded wrapper:

```text
node scripts/commit-approved.mjs --id <proposal-id>
```

5. Report the resulting commit hash. Do not push.

If any check fails or the staged diff changes, invalidate the state with
`node scripts/commit-proposal.mjs invalidate`, create a new proposal, and request
approval again. Approval from another conversation or an older Proposal ID is
not reusable.
