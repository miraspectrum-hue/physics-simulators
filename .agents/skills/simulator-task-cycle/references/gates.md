# Task gate reference

## Profiles

| Profile | Required flow |
|---|---|
| `full` | Preflight → design → design review → test cases → test-case review → test code → test-code review → expected Red → test commit proposal → implementation → Green/full verification → implementation review → final commit proposal |
| `ui` | `full`, followed by prepared browser evidence and human UI acceptance before the final commit proposal |
| `lightweight` | Preflight → written change approach → applicable deterministic checks → implementation review → final commit proposal; record why omitted stages do not apply |
| `emergency` | Only the human-approved shortened path; record omitted stages, minimum checks, and a follow-up task that restores normal assurance |

## Evidence file

For `full` and `ui`, create `EVIDENCE.md` in the task artifact directory. Keep
human-readable commands and results, and include these machine-readable keys:

```yaml
baseline_status: green
red_status: expected-failure
green_status: green
final_status: passed
ui_acceptance: not-required
```

When pre-existing failures are explicitly accepted by the user, use
`baseline_status: approved-existing-failures` and record the approval and exact
failures. A syntax, type, dependency, or environment failure is not expected Red.

## State invalidation

When a reviewed input changes:

1. Set the task state to `stale`.
2. Invalidate the affected review records and commit proposal.
3. Identify downstream artifacts affected by the change.
4. Resume from the earliest invalid gate.

Only `status: approved` advances a review. Conditions that remain unresolved are
`changes-requested`, not conditional approval.

## Gate validation

Use:

```text
node scripts/verify-task-state.mjs --task-dir <task-dir> --gate design --profile <profile> --ui-impact <none|yes>
node scripts/verify-task-state.mjs --task-dir <task-dir> --gate test --profile <profile> --ui-impact <none|yes>
node scripts/verify-task-state.mjs --task-dir <task-dir> --gate implementation --profile <profile> --ui-impact <none|yes>
```

Set `ui_acceptance: pending` while human acceptance is outstanding and change it
to `accepted` only after the user accepts the UI. An implementation gate with
`--profile ui` or `--ui-impact yes` rejects every other value.
