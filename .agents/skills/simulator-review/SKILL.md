---
name: simulator-review
description: Perform an independent read-only review of a simulator design, test cases, test code, or implementation diff and return a machine-checkable gate decision. Use only for review; do not use to implement fixes.
---

# Simulator review

Remain read-only. Review one gate per invocation and do not implement fixes.

1. Read the applicable `AGENTS.md`, `SPEC.md`, `DESIGN-OUTLINE.md`, task
   `DESIGN.md`, and `TESTCASES.md` according to the source-of-truth order.
2. Inspect only the assigned review target and enough surrounding code to verify
   behavior and integration.
3. For physics or numerical content, also use `$physics-validation`.
4. Prioritize correctness, regressions, missing coverage, boundary behavior,
   scope violations, and accessibility. Do not report style preferences without
   concrete impact.
5. Hash every reviewed file with `node scripts/hash-files.mjs <paths...>`.
6. Read [references/review-schema.md](references/review-schema.md) and return
   exactly one record. Do not write `REVIEW.md`; the Coordinator persists the
   record verbatim.

Use `needs-human` only when the missing decision changes requirements, UI design,
physical behavior, or another human-owned choice. Otherwise use
`changes-requested` with a precise rollback target.
