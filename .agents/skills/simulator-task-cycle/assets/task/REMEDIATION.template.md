# <Task ID> remediation record

## Root Cause

- Root-cause key: `<finding-id>.<short-stable-cause>`
- Review type: `<design | testcases | test-code | implementation>`
- Rollback target: `<design | testcases | test-code | implementation>`
- Allowed change boundary: `<paths and prohibited boundaries>`

## Attempt <number>

- Source review: `<review_type>` / `<status>`
- Finding IDs: `<R-...>`
- Root-cause key: `<finding-id>.<short-stable-cause>`
- Changed paths: `<paths>`
- Deterministic checks: `<commands and results>`
- Re-review result: `<pending | approved | changes-requested | needs-human | stopped>`

## Stop Result

<When automation stops, summarize the stop reason, unchanged root-cause key,
attempt count, and where the human options were recorded. Use `not-stopped`
while remediation remains active.>

## Rationale

<Summarize how the changes satisfy the Reviewer-required changes without changing protected decisions.>
