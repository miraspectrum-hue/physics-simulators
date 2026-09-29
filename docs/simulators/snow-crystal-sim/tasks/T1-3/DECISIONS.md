# T1-3 Decisions

## D-001: テストコードレビュー3回不合格後の進め方

- 状態: resolved — option 1 approved by user
- 対象ゲート: test-code
- 発生日: 2026-09-29

同じ test-code ゲートで3回連続して `changes-requested` となったため、
`simulator-task-cycle` の反復上限に従い自動修正を停止した。

### 試行履歴

1. 初回実装レビュー (`sha256:8cf992d676fa15e7cd8272c66209e89faff4c7eeb09be3f0f86c344fff19fd2c`)
   - 複合検証順、入力参照不変、引数省略と正のゼロ、fixture全出力、literal index の不足。
2. 1回目修正レビュー (`sha256:8b92c1c7446d75e656ae23cb2452a10ff7e305e469353fd0317a0b5fa79726dd`)
   - 多くを解消したが、ice/noise順、明示undefined、全index/sector、誤ったnoise fixture、非依存状態差分、有効境界が残存。
3. 2回目修正レビュー (`sha256:ece63127f508f8968bb89cffa06917d2da43f49ec3dfb166b220ce665ff14f1b`)
   - 上記を解消したが、不正shapeを扱えないsnapshotと中心seedの`tipDensity=+0`厳密検査が残存。

### 現在の未解決事項

1. 異常入力用 snapshot が `state=[]`、null field、異種 field、`seed=null` で
   candidate 呼出し前に自己例外を起こし得る。任意 shape を安全に記録する汎用 snapshot が必要。
2. 中心 seed fixture の全呼出し結果について `tipDensity` を
   `Object.is(value, +0)` で検査する必要がある。

### 選択肢

1. **推奨: 追加の限定修正を許可する。**
   新しい DeliveryBuilder が上記2点だけを修正し、新しい Reviewer が再審査する。
   DESIGN/TESTCASES/production は変更しない。
2. TESTCASES の入力不変要件を再検討する。
   上位の承認済み契約を変えるため、testcases ゲートへ戻る。
3. T1-3 を保留し、別タスクへ移る。

推奨案1は既承認契約を維持した最小修正であり、残件も局所的である。

### 解決

- ユーザー承認: 2026-09-29
- 採用: 選択肢1
- 修正後テストコード: `sha256:97f9400b89288ce24175e5071c5da1a01d2eb1286aed74f22789853cf32bcb9a`
- 最終 test-code review: `approved`
