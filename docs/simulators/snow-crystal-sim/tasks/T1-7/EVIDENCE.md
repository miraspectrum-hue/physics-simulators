# T1-7 Evidence

## Preflight and baseline

- Date: 2026-09-29
- Branch: `feature/snow-crystal-sim`
- Scope: T1-7 design-stage artifacts only.
- Before T1-7 edits, no files were staged. The worktree contained unrelated agent-policy changes and historical
  T1-2 artifacts. They are outside T1-7 and were not modified or staged by this design stage.
- Baseline command supplied by the Coordinator: `node scripts/verify.mjs`
- Baseline result: Green. Architecture and typecheck passed; prism-sim passed 33 files / 937 tests,
  snow-crystal-sim passed 9 files / 89 tests, and both production builds passed.

```yaml
baseline_status: green
red_status: expected-failure
green_status: pending
final_status: pending
ui_acceptance: not-required
```

## Primary-source check

- Confirmed arXiv:2306.13087v1 title, author, 206-observation abstract, and permanent identifier.
- Downloaded the primary PDF from arXiv for read-only inspection: 14 pages, 12,317,042 bytes,
  SHA-256 `20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af`.
- Extracted and checked the complete text. Paper pp. 7–8 and the Figure 2 caption confirm 206 panels,
  temperature, far-field supersaturation, known growth time, square field-of-view size, temperature uncertainty
  `±0.2 °C`, and supersaturation uncertainty `[0.8,1.2] × stated`.
- The paper also states that photographs are subjectively selected representative crystals and that interpreting
  3D morphology from their 2D projections requires experience. No author-assigned panel IDs or machine-readable
  morphology tags were found.
- The PDF and temporary extraction/rendering tools are not task deliverables and will not be staged.

## Design-stage status

- The first independent design review returned `needs-human` with findings R-001 through R-005. Its reviewed
  hashes and verbatim findings remain in `REVIEW.md`; that decision is not being overwritten.
- The user resolved D-03 on 2026-09-29: two independent development-agent sessions create all 206 drafts;
  exact/high-confidence agreements may receive human batch approval, while disagreements and low/medium-confidence
  items require individual comparison with the hash-pinned source PDF. Unapproved tags cannot enter any loss.
- The design revision fixes auditable annotation approval sets, A/B extraction evidence and recomputation,
  scale-marginalized 10/20/40-cell checkpoint scoring, exact rank/CDF algorithms and aggregation order, and a
  persistent sealed/opening/opened holdout record with an exclusive open-intent marker.
- The revised design and decisions passed a fresh independent design review after the two-dimensional
  stratum order and the radius-115 boundary-distance derivation were corrected. Test cases, Red,
  implementation, Green, and final verification remain pending.

## Test-case rollback and design revision

- The first test-case review returned `changes-requested` with `rollback_to: design`. Its reviewed
  `TESTCASES.md` hash and verbatim R-001 through R-003 remain in `REVIEW.md`. The previously approved design
  review is stale because its reviewed `DESIGN.md` changed; the unapproved `TESTCASES.md` was not edited by
  this design revision.
- R-001 design response: `SplitV1` and `ProtocolV1` now define every required field, exact schema/version,
  null and unknown-property behavior, fixed tuple/array order, all nine strata, group/partition/ID/hash
  references, loss definitions, raster protocol, literal seed/checkpoint/max-step records, candidate-manifest
  reference contract, and holdout-record contract. The calibration data directory is explicitly limited to
  three JSON files plus `SHA256SUMS`, four files total.
- Rasterizer selection was checked read-only on 2026-09-29. The workspace runtime reports Node `v24.14.1`.
  The pinned renderer is `pdfjs-dist@6.3.289` with `@napi-rs/canvas@1.0.6`; the upstream PDF.js v6.3.289
  package declares Node `>=22.13.0 || >=24` and canvas backend `^1.0.6`, so the exact lower-bound backend and
  current runtime are compatible. No package was installed and no image/PDF artifact was added by this
  design stage.
- R-002 design response: `SOURCE-AUDIT.json` is now a separate task-doc artifact captured from the hash-pinned
  PDF by a human auditor who cannot read the production corpus or its generator during capture. Its schema
  freezes page counts, all 206 IDs/locators/raw labels/normalized values, source-entry and pre-annotation split
  hashes, final canonical corpus hash, and approval. The protocol references the final audit JCS hash, and
  any corpus/audit/hash change invalidates downstream evidence.
- The revised design expands the test handoff with positive fixtures and explicit missing/unknown/wrong-type/
  null/order/reference/JCS-mutation/renderer-literal/independent-oracle cases. The fresh design review approved
  the exact revised `DESIGN.md`; test-case revision may resume after this corrected design is committed.

## Test-case and test-code status

- The human-approved D-06 decision split the test code into three independently reviewed files without changing
  requirements, numerical methods, fixtures, or acceptance criteria. The revised `TESTCASES.md` passed a fresh
  independent review at SHA-256
  `292a82adce22faa4fa486280ccf29c848afd3a4a768cad051142c392896ffd73`.
- Approved test-code hashes:
  - schema/artifacts: `610c01e5f75c10d3519b0415845edb4cfff0c121f78cd89a0b55a7d91ed24b4a`
  - scoring/protocol: `907f10446bfb7b69bb514ff742e70f9145530a048721a935bcd6e3fdd2d343a7`
  - holdout-safety: `96de66062ec81703a18fd48fc42ccf0d943aa7f623100403a31ca9e5df632189`
- The obsolete unapproved single-file test draft was removed after the three split files were approved.

## Expected Red

- Date: 2026-10-06
- Typecheck command: `npm.cmd run typecheck --workspace=apps/snow-crystal-sim`
  - Result: exited 0.
- Synthetic-only command:
  `npm.cmd run test --workspace=apps/snow-crystal-sim -- tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts`
  - Result: exited 0; 2 files / 28 tests passed.
- Full expected-Red command: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`
  - Result: exited 1 after architecture and typecheck passed. Vitest reported 12 files total,
    2,328 tests passed, 1 planned REAL206 integration test skipped, and exactly 5 expected failures.
  - Each failure is an independent `TC-RED-001` existence assertion for one missing implementation artifact:
    `corpus.json`, `split.json`, `protocol.json`, `SHA256SUMS`, or task-doc `SOURCE-AUDIT.json`.
  - There were no syntax, type, module-resolution, dependency, environment, scoring/protocol, or holdout-safety
    failures. These five missing artifacts are the planned implementation boundary for the next stage.

## D-10 source-audit redesign: test cases, test code, and expected Red

- Date: 2026-10-09
- The prior test-case approval, schema/artifacts test-code approval, and 2026-10-06 Red above became stale when
  D-10 changed the source-audit workflow. They remain as history and are not the current gate evidence.
- Revised `TESTCASES.md` SHA-256:
  `31087002d9b47b0e5bdcb0be69bb3d62c9aab6d4be664b250523985d788d2b2b`.
  A fresh independent test-case review approved 45 testcase IDs, including A/B candidate and comparison hashes,
  the 32-entry migration, all 206 panels / 824 fields, production-corpus isolation, action/rationale rules,
  freeze order, and stale propagation.
- Revised schema/artifacts test-code SHA-256:
  `ff9bfd0daf0c2f332d6a329a659e12d1abb94884314f9fc5c957d65b284d24c5`.
  A fresh independent test-code review approved it after confirming that duplicate verification events are
  retained and rejected rather than overwritten.
- Typecheck command executed through the Windows Node/npm CLI equivalent of
  `npm run typecheck --workspace apps/snow-crystal-sim`.
  - Result: exited 0.
- Targeted Red command executed through the Windows Node/npm CLI equivalent of
  `npm run test --workspace apps/snow-crystal-sim -- --run tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts`.
  - Result: exited 1 with 2,345 synthetic tests passed, one permitted `TC-REAL-001` skip, and exactly five
    `TC-RED-001` failures.
  - Each failure is the expected assertion for one missing artifact: `corpus.json`, `split.json`, `protocol.json`,
    `SHA256SUMS`, or task-doc `SOURCE-AUDIT.json`.
- Full expected-Red command: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`.
  - Result: exited 1 after architecture and typecheck passed. Vitest reported 12 files, 2,462 tests passed,
    one permitted `TC-REAL-001` skip, and exactly the same five missing-artifact failures.
  - No syntax, type, module-resolution, dependency, environment, scoring/protocol, holdout-safety, or unrelated
    regression was present.
- The fixed LocalStorage backup was independently read-only checked at SHA-256
  `9fd9708029f553e386dfd2dece8df5f8237d5c8b586502d90bfbe93b8bb47f0c`: version 1,
  role `human-source-auditor`, 33 entries, 32 complete/confirmed entries, and blank/incomplete `P11-N033`.
  The test suite does not depend on the external attachment path and does not commit the backup.

## D-15 morphology ensemble pilot formal-design preflight

- Date: 2026-10-16
- Branch/head before edits: `feature/snow-crystal-sim` at
  `29464032136bc47b7f438812792ca41e0071642c`.
- Staged changes before edits: none.
- The working tree already contained unrelated unstaged/untracked changes outside the T1-7 formal-pilot
  design boundary. They were not staged, modified, discarded, or included.
- Baseline command: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`.
  - Architecture check and TypeScript typecheck passed.
  - Vitest reported 12 files, 2,462 tests passed, one permitted `TC-REAL-001` skip, and exactly five
    pre-existing `TC-RED-001` failures.
  - The five failures are the already recorded expected assertions for missing `corpus.json`, `split.json`,
    `protocol.json`, `SHA256SUMS`, and task-doc `SOURCE-AUDIT.json`.
  - No new syntax, type, dependency, environment, or unrelated test failure was present.
- This preflight does not treat the expected Red as baseline Green and does not authorize image generation,
  external model submission, corpus replacement, or LocalStorage changes.

## D-18 morphology ensemble pilot test-code approval and expected Red

- Date: 2026-10-17.
- Approved test-code files:
  - `libbrecht-2023-figure2-morphology-pilot.test.ts`:
    `9b491f872fa9e15c31f8a608f6b4430431b0dc1996b9d7c492e10d62fdff3bd5`
  - `pilot-oracle.mjs`:
    `880a740bbc34357614a14f156348aae02b67e0828970cd99dda171acbbd953a3`
  - `pilot-images.mjs`:
    `9d0fd79526f004eade44c13829d85088aca8a0e279ee2bc61e4d4235d7c87af1`
  - `pilot-contract-fixtures.mjs`:
    `aa44ccb8dbe32db9c357a42108b7bf15d413b7afa169739f531d234fa9c20e6b`
  - `pilot-workflow-fixtures.mjs`:
    `117804178890a33d5c1f7fa6275d4ea070472f21bb41cb8c3d2ceadfcdf1272f`
  - `pilot-state-cases.mjs`:
    `cf41f7b241757236cd4e3b8bb97ebb58d974ed311d03761ed434b4b16a35c96a`
  - `pilot-schema-cases.mjs`:
    `95150ce11bcad306a46b2f30aa0cc22e25bfa6197183de2bbbf535878e70767c`
  - `pilot-metrics-isolation.mjs`:
    `06aa92cd86c0cf45738db621aea75d99de5b53e9215d1857201ba3126cad08bb`
- Fresh independent test-code review status: `approved`, with no findings or conditions.
- The conformance registry contains 15,056 cases. The dependency boundary self-check contains 710 rejected,
  81 allowed, and 15 path cases. The filesystem guard contains 17 positive and 62 negative cases.
- Targeted command:
  `npm.cmd test --workspace apps/snow-crystal-sim -- tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts`
  - Result: exited 1; 13 tests passed, no tests skipped, and exactly one expected failure.
  - The only failure is `TC-PILOT-RED-001`, asserting that test-only implementation artifact
    `apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs`
    does not yet exist.
- Typecheck command: `npm.cmd run typecheck --workspace apps/snow-crystal-sim`.
  - Result: exited 0.
- All seven pilot support modules passed `node --check`.
- Full expected-Red command: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`.
  - Architecture and typecheck passed.
  - Vitest reported 2,475 tests passed, one pre-existing permitted skip, and exactly six expected failures.
  - Five failures are the previously recorded missing production artifacts: `corpus.json`, `split.json`,
    `protocol.json`, `SHA256SUMS`, and task-doc `SOURCE-AUDIT.json`.
  - The sixth is the new pilot validator missing-artifact assertion above.
  - No syntax, type, module-resolution, dependency, environment, or unrelated regression was present.

## Post-commit pilot fixture correction and refreshed expected Red

- Date: 2026-10-18.
- The approved test implementation exposed two fixture-construction defects before implementation review:
  - `slot-plans` lacked the normative restricted mapping needed to derive the exact 24 source-observation IDs;
  - rendered prompts used sequential replacement, which could rewrite placeholder text inside an inserted JSON value
    and make an order mutation identical to its positive fixture.
- The limited correction adds only the normative `restrictedMap` to the slot-plan fixture and performs prompt
  substitution once over placeholder byte ranges from the original template. It does not add source-ID answer arrays,
  fixed expected hashes, or implementation-derived values.
- Fresh independent test-code review approved all eight test/support files. The registry remains exactly 15,056 cases:
  1,031 positive and 14,025 negative.
- To refresh Red without changing the implementation, the four uncommitted validator modules were moved to a
  validated temporary directory inside the workspace, both commands were executed, and the files were restored in a
  `finally` block.
- Targeted command:
  `npm.cmd test --workspace apps/snow-crystal-sim -- tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts`
  - Result: exited 1; 13 tests passed, no tests skipped, and exactly one expected failure.
  - The only failure was `TC-PILOT-RED-001` at line 152, the missing
    `libbrecht-2023-figure2-morphology-pilot-validator.mjs` assertion.
- Full expected-Red command: `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`.
  - Architecture and typecheck passed.
  - Vitest reported 2,475 tests passed, one existing permitted skip, and exactly six expected failures.
  - Five are the existing missing production artifacts and the sixth is the missing pilot validator.
  - No syntax, type, dependency, module-resolution, environment, or unrelated regression was present.

## Implementation-review gap regressions and refreshed expected Red

- Date: 2026-10-20.
- The first implementation review found three untested rejection paths: divergence between captured model output and
  formal records, incomplete semantic validation of invalid-attempt evidence, and incomplete artifact-DAG closure.
- Two support modules add 924 independently derived cases without changing the approved classification mapping or
  production artifacts. The registry now contains 15,980 cases; all 15,056 prior cases retain their prior outcome.
- Fresh independent test-code review status: `approved`, with no findings or conditions. Approved hashes:
  - `pilot-workflow-fixtures.mjs`:
    `77a8e0769928e0e268493d13d1da6a6b928591f87073ef688cd1b82338daef14`
  - `pilot-state-cases.mjs`:
    `870a32dd3fcbd089826713bbdf632f2f67d820dfe25419666a4f87b31d61107b`
- Targeted command:
  `npm.cmd test --workspace apps/snow-crystal-sim -- tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts`
  - Result: exited 1; 13 tests passed, no tests skipped, and exactly one expected assertion failure.
  - The failure is `TC-PILOT-RED-001`: the current validator accepted the independently rehashed
    `annotation-run/capture-integrity/root-annotator-3-batch-01/all-fields/classification.fieldConfidence.growthAxis`
    mutation instead of throwing the required `RangeError`.
  - This is the intended behavioral Red for the review finding, not a syntax, type, dependency, module-resolution,
    or environment failure.
- Independent full-registry comparison found 852 expected negative-case failures among the 924 additions: 624
  invalid fixtures were accepted and 228 were rejected with an incomplete error contract. The other 72 additions
  already pass. This detailed comparison is diagnostic; the single Vitest conformance assertion remains the gate Red.
- `node --check` for both changed support modules, TypeScript typecheck, and `git diff --check` passed.
