# T1-0 検証証跡 — 数値モデル契約と出典の確定

## 変更方針

CA の実装前提となる物理・数値契約を文書として確定する。対象は `SPEC.md`、
`DESIGN-OUTLINE.md`、本タスクの `DESIGN.md`、`DECISIONS.md`、`TESTCASES.md`、
`REVIEW.md`、`EVIDENCE.md`、および工程記録としての `TASKS.md` に限定し、`apps/` の
実行コードは変更しない。

## プロファイル是正と人間確認

- 2026-09-11: T1-0 の変更境界が文書だけである一方、当初の `full` プロファイルが
  テストコードレビューと expected Red を要求し、工程を完遂できない不整合を確認した。
- 2026-09-11: ユーザーが推奨案を承認し、T1-0 を `lightweight` に変更して、実テストと
  Red / Green を後続タスクへ移管する方針を確定した。

## 省略工程

テストコード、expected Red、Green、物理実装、UI 受け入れは適用しない。T1-0 は
実行コードもユーザーに見える振る舞いも変更せず、承認済みテストケースを実装可能な契約として
固定する文書タスクである。未作成の production module を import して Red を作ることは、
依存エラーを expected Red と誤認させるため行わない。

テストケースごとの実装先は `TESTCASES.md` に固定しており、T1-1、T1-2、T1-3、T2-4、
T2-5、T4-2 がそれぞれ baseline Green、テストコードレビュー、expected Red、Green を実施する。

## Preflight

- 再開時ブランチ: `feature/snow-crystal-sim`。
- 再開時の task-owned 変更: `tasks/T1-0/REVIEW.md` と `tasks/T1-0/TESTCASES.md`。
- 再開時のステージ済みファイル: なし。
- 無関係な変更: 検出なし。

## 承認済みレビュー

- 設計レビュー: `approved`。対象ハッシュは `REVIEW.md` の最新 `review_type: design` を正とする。
- テストケースレビュー: `approved`。`TESTCASES.md` の SHA-256 は
  `f7ee452a47c5f4ea15df5258d81e79aeeb278a86bd44e106083c0c42f61b0aae`。
- テストコード不要理由と代替検証: lightweight 実装レビューで独立確認する。

## 決定的検証

- 設計承認ハッシュ: passed —
  `node scripts/verify-task-state.mjs --task-dir docs/simulators/snow-crystal-sim/tasks/T1-0 --gate design --profile full --ui-impact none`。
  プロファイル是正前に完了した設計レビューの対象ファイルが未変更であることを確認した。
- テストケース承認ハッシュ: passed — `node scripts/hash-files.mjs
  docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md` が `REVIEW.md` の最新承認ハッシュと一致した。
- 全ワークスペース検証: passed — `node scripts/verify.mjs`。architecture、lint、typecheck、
  test、build が完了し、prism-sim は 33 files / 937 tests passed、snow-crystal-sim は
  テストファイル未作成のため code 0、両 workspace の build が成功した。
- 差分空白検査: passed — `git diff --check` は出力なし。
- ステージ済みファイル: なし。

全検証で生成された未追跡の `apps/snow-crystal-sim/dist/` は、再生成可能で変更境界外の
build artifact であるため、検証後に削除した。
