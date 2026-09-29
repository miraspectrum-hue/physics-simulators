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
red_status: pending
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
