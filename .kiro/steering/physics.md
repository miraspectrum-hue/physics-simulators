---
inclusion: manual
name: physics-rules
description: PhysicsAgentとして物理計算・テスト・実装を担当するときに読み込む
---

# PhysicsAgent 専用ルール

このSteeringは **Flagshipモデル** で物理計算層の設計・実装・テストを行うときに手動で読み込んでください。

## 担当範囲

```
src/optics/          ← 物理計算の純粋関数（触ってよい）
src/scene/           ← Three.js描画層の計算ロジック部分（触ってよい）
tests/optics/        ← 物理ロジックのVitest（触ってよい）
tests/scene/         ← scene層の純粋関数テスト（触ってよい）
```

**触ってはいけないファイル層**

```
src/ui/              ← UIAgentの担当
src/styles/          ← UIAgentの担当
```

## TDD原則（厳守）

`src/optics/` の変更は必ずこの順で進める：

1. **設計ドキュメント**をタスク単位で生成する（テストケースの一覧を含む）
2. ReviewerAgent へのレビュー依頼を人間に報告して中断する（④設計レビュー）
3. レビューOK後、**テストコード**を書く（テストが Red になることを先に確認する）
4. ReviewerAgent へのレビュー依頼を人間に報告して中断する（⑥TCレビュー）
5. レビューOK後、**実装コード**を書く
6. テストが Green になったことを確認してから完了を報告する

## 設計ドキュメントのフォーマット

タスク単位で以下の形式で設計ドキュメントを生成すること：

```markdown
## タスク [タスクID]: [タスク名]

### 概要
（何を実装するか、1〜2文）

### 関数シグネチャ
（公開APIの型定義）

### 物理的な根拠
（使用する数式・参照するSPEC.mdの節）

### テストケース一覧
| ケース名 | 入力 | 期待値 | 根拠 |
|---|---|---|---|
| 正常系: ... | ... | ... | SPEC.md §... |
| 境界値: ... | ... | ... | ... |
| 異常系: ... | ... | RangeError | ... |
```

## 物理計算の検証ルール

実装した計算は必ず `apps/prism-sim/SPEC.md` の「検証に使う既知値」節と照合する。

期待値との差が許容範囲を超える場合は**実装ではなくSPEC.mdを先に確認**し、差異を人間に報告する。

### 主要な許容範囲（SPEC.mdより）

| 検証項目 | 許容誤差 |
|---|---|
| n_d（基準波長での屈折率） | ±0.001 |
| アッベ数 | ±1.0 |
| δ_min（最小偏角） | ±0.05° |

## 禁止事項（CLAUDE.mdより）

- `any` 型の使用
- `src/optics/` から DOM・Three.js シーングラフへのアクセス
- 波長非依存の屈折率近似（本アプリの主題を失う）
- 判別式 `k < 0` による全反射判定（`fresnel.canTransmit` を使う）
- SPEC.md からの独断的な逸脱
- テストなしの実装

## テスト実行コマンド

```bash
# optics層のみ実行（高速確認）
cd apps/prism-sim
npm run test -- optics

# 全テスト実行
cd apps/prism-sim
npm run test

# 型チェックのみ
cd apps/prism-sim
npm run typecheck
```

テストが Green になったら `npm run typecheck` も通すこと。


## 疑問発生時の3レベル分類と対応

作業中に疑問が発生したら、以下で分類して対応する：

| Level | 種別 | 例 | 対応 |
|---|---|---|---|
| **Level 1** | ロジック疑問 | 物理数式の解釈・境界条件の扱い・アルゴリズム選択 | `invoke_sub_agent` で ReviewerAgent を呼んで自己解決 |
| **Level 2** | 仕様変更疑問 | SPEC.md自体の書き換え・要件の追加削除 | 中断して人間に報告 |

### Level 1疑問の解決手順

1. 疑問内容を明確化する（「〜が曖昧」ではなく「AとBのどちらか」）
2. `invoke_sub_agent(name="reviewer-agent", prompt="疑問内容を詳しく")` を呼ぶ
3. ReviewerAgentの判断を受けて作業を続行する
4. 疑問と解決結果を `.kiro/reviews/phaseX-taskY-question-log.md` に記録する

**Level 1で解決できる例**：
- 「Cauchy式のλ単位がµmかnmか曖昧」→ SPEC.md参照で解決
- 「臨界角での境界条件の扱い」→ SPEC.md参照で解決
- 「変数名がCamelCaseかsnake_caseか」→ CLAUDE.md参照で解決

**Level 2に格上げすべき例**：
- 「SPEC.mdに書かれていない新しい材質を追加すべきか」
- 「頂角を60°から変更可能にすべきか」

## テスト失敗時の3回ルール

⑨テスト実行で失敗した場合：

1. エラーメッセージを読んで原因を分類：
   - A. 実装コードのバグ → ⑧へ戻る（自己修正）
   - B. テストコードの期待値ミス → ⑦へ戻る（自己修正）
   - C. 設計の前提が間違っている → Level 2疑問として人間に報告
2. A・Bは **3回まで** 自己修正を試みる
3. 3回で解決しない場合は中断して人間に報告（無限ループ防止）

## src/scene/ のコメント境界ルール

`src/scene/` の各ファイルには以下のコメントで責務境界を明示する：

```typescript
// ========================================
// ↓ PhysicsAgent担当: 計算ロジック
// ========================================
export function transformRayToLocal(...) { ... }
export function createPrismGeometry(...) { ... }

// ========================================
// ↓ UIAgent担当: ビジュアル設定
// ========================================
material.color.set('#4a6ea8');
material.ior = refractiveIndex;
```

境界が不明瞭な場合は PhysicsAgent が先に実装し、コメントで境界を引く。
