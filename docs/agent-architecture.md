# AIエージェント構成設計

## 概要

このドキュメントはKiro IDE上でのAIエージェントを使ったアプリ開発における構成設計を記録したものです。
**案B（タスクループ型）にoptics層とui層でエージェントを分ける**構成を採用します。

---

## 設計思想

### 前提

- Kiroは「人間がループの起点にいる」1ショット実行モデル
- 常駐型のオーケストレーターは持てないため、**人間 + TASKS.md + global Steering** が三位一体でオーケストレーターを担う
- モデルの使い分けはKiro側で自動切替できないため、**フェーズ単位でモデルを切り替える**運用とする（タスク単位の切替は認知負荷が高いため避ける）
- エージェント間の状態引き継ぎは **`.kiro/reviews/` フォルダにレビュー結果ファイル** を記録することで行う

### エージェント間の疑問解決フロー

物理計算・ロジックに関する疑問はエージェント間で自己解決し、人間の介入を最小化する。

**疑問の3レベル分類**

| Level | 種別 | 例 | 対応 |
|---|---|---|---|
| **Level 1** | ロジック疑問 | 物理数式の解釈・境界条件の扱い・アルゴリズム選択 | PhysicsAgent → ReviewerAgent（`invoke_sub_agent`）で自己解決 |
| **Level 2** | 仕様変更疑問 | SPEC.md自体の書き換え・要件の追加削除 | 中断して人間に報告 |
| **Level 3** | UIデザイン疑問 | 見た目の方向性・UX判断 | 中断して人間に報告 |

**Level 1 の自己解決フロー**

```
PhysicsAgent が疑問を持つ
    ↓
疑問を Level 1〜3 で分類
    ↓
【Level 1】
    invoke_sub_agent で ReviewerAgent を呼ぶ
    ↓
    ReviewerAgent が SPEC.md・CLAUDE.md を参照して判断
    ↓
    判断結果を受けて PhysicsAgent が続行
    ↓
    疑問と解決結果を .kiro/reviews/ にログとして記録

【Level 2・3】
    中断して人間に報告
```

### モデル使い分けの方針

| 層 | 使用モデル | 理由 |
|---|---|---|
| `src/optics/`・`src/scene/`計算層・`tests/` | Flagship（GPT-5.6 Sol / Opus 5等） | 物理計算・アルゴリズム精度が最優先 |
| `src/ui/`・`src/styles/`・`src/scene/`ビジュアル層 | MiniMax M2.5 | 見た目の生成・デザイン提案に最適化 |
| 設計レビュー・テストケースレビュー | Flagship | 論理矛盾・SPEC整合性の検出 |

---

## 全体マップ

```
┌─────────────────────────────────────────────────────────────────┐
│                      人間（オーケストレーター）                     │
│  TASKS.md を見て「次のタスクを実行」と指示するだけ                  │
└────────┬──────────────┬──────────────────┬──────────────────────┘
         │              │                  │
    ┌────▼────┐    ┌────▼────┐       ┌────▼────┐
    │ Physics │    │  UI     │       │Reviewer │
    │ Agent   │    │ Agent   │       │ Agent   │
    │(Flagship│    │(MiniMax │       │(Flagship│
    │  モデル) │    │  M2.5)  │       │  モデル) │
    └─────────┘    └─────────┘       └─────────┘
    optics/         ui/               設計・TC
    scene/計算層    styles/           レビュー専任
    tests/          scene/ビジュアル層

         ↕ 全エージェントが共有する基盤
┌─────────────────────────────────────────────────────────────────┐
│  Steering（global）  TASKS.md  CLAUDE.md  SPEC.md               │
│  Hook: 保存時lint / タスク完了時Git通知 / セッション開始時状態把握  │
└─────────────────────────────────────────────────────────────────┘
```

---

## エージェント定義

### PhysicsAgent（物理実装エージェント）

**使用モデル**：Flagship（GPT-5.6 Sol / Opus 5等）  
**担当ステップ**：③設計 → ⑤テストケース作成 → ⑦テストコード作成 → ⑧実装（optics/・scene/計算層） → ⑨テスト実行

**担当ファイル層（明確な境界）**

```
✅ 触ってよい:
src/optics/          ← 物理計算の純粋関数（全体）
tests/optics/        ← 物理ロジックのVitest（全体）
tests/scene/         ← scene層の純粋関数テスト（全体）

src/scene/           ← 以下のコメント境界内のみ
  // ========================================
  // ↓ PhysicsAgent担当: 計算ロジック
  // ========================================
  （レイ変換・光路計算・交差判定・ジオメトリ生成）

❌ 触ってはいけない:
src/ui/              ← UIAgentの担当
src/styles/          ← UIAgentの担当
src/scene/           ← コメント境界外のビジュアル設定
  // ========================================
  // ↓ UIAgent担当: ビジュアル設定
  // ========================================
  （material.color / material.ior / Bloom設定）
```

**責務**
- TASKS.mdの該当タスクを読み、設計ドキュメント（タスク単位）を `.kiro/reviews/phaseX-taskY-design.md` に生成する
- テストケース → テストコード → 実装の順で進める（TDD厳守）
- **Level 1疑問（ロジック）**: `invoke_sub_agent` で ReviewerAgent を呼んで自己解決
- **Level 2疑問（仕様変更）**: 中断して人間に報告
- ⑨テスト失敗時は原因を3分類（実装バグ/テストミス/設計前提ミス）し、3回まで自己修正を試みる
- 完了したタスクは`[ ]`→`[x]`に更新する

**制約**
- `src/ui/`・`src/styles/` には触れない
- `src/scene/` のビジュアル設定コメント境界には入らない
- `any`型の使用禁止（CLAUDE.md準拠）
- テストなしの実装禁止

---

### UIAgent（UI実装エージェント）

**使用モデル**：MiniMax M2.5  
**担当ステップ**：⑧実装（ui/・styles/・scene/ビジュアル層） → ⑩画面UIの確認（案の生成）

**担当ファイル層（明確な境界）**

```
✅ 触ってよい:
src/ui/              ← ControlPanel, InfoOverlay, store等（全体）
src/styles/          ← CSSテーマ・レイアウト（全体）
tests/ui/            ← jsdom環境のUIテスト（全体）

src/scene/           ← 以下のコメント境界内のみ
  // ========================================
  // ↓ UIAgent担当: ビジュアル設定
  // ========================================
  （material.color / material.ior / Bloom設定 / カメラ初期位置）

❌ 触ってはいけない:
src/optics/          ← PhysicsAgentの担当
src/scene/           ← コメント境界外の計算ロジック
  // ========================================
  // ↓ PhysicsAgent担当: 計算ロジック
  // ========================================
  （レイ変換・光路計算・交差判定）
```

**責務**
- PhysicsAgentが確定した計算層のインターフェースに合わせてUIを実装する
- デザイン案を複数提示してから実装に入る
- `prizm.png`のダークテーマを基準に実装する
- アクセシビリティ（キーボード到達・aria属性）を必ず確認する
- **Level 1疑問（ロジック）**: PhysicsAgentに委譲（人間経由）
- **Level 3疑問（デザイン）**: 中断して人間に報告

**制約**
- `src/optics/` の物理計算には触れない
- `src/scene/` の計算ロジックコメント境界には入らない

---

### ReviewerAgent（レビュアーエージェント）

**使用モデル**：Flagship  
**担当ステップ**：④設計レビュー → ⑥テストケースレビュー + PhysicsAgentからのLevel 1疑問対応

**責務**
- **④⑥レビュー時**: SPEC.mdとの整合性チェック・物理的妥当性チェック・テストの網羅性チェック
- **サブエージェントとして呼ばれた時**: PhysicsAgentのLevel 1疑問に対し、SPEC.md・CLAUDE.mdを参照して判断を返す
- レビュー結果を `.kiro/reviews/phaseX-taskY-[design|tc]-review.md` に記録する
- 判定は機械的チェックリストに基づく（主観を排除）

**修正必須の判定チェックリスト**

以下に1つでも該当したら差し戻し：

```
- [ ] SPEC.mdの数式と異なる式を使っている
- [ ] SPEC.mdの材質定数と値が異なる（許容誤差外）
- [ ] CLAUDE.mdの禁止事項に抵触している
- [ ] JSDocが欠けている公開関数がある
- [ ] テストケースに境界値（臨界角・±89°・波長端）が含まれていない
- [ ] 単位のサフィックス（Deg/Rad/Nm）が欠けている変数がある
- [ ] 異常系テストケースに RangeError 検証がない
```

**サブエージェント応答形式**

PhysicsAgentから `invoke_sub_agent` で呼ばれた場合は以下の形式で返す：

```markdown
## Level 1疑問への回答

**疑問内容**: （PhysicsAgentの疑問を再掲）

**判断**: （採用すべきアプローチ）

**根拠**: SPEC.md §X.Y / CLAUDE.md §Z の記述に基づく

**続行してよい理由**: （SPEC逸脱ではない理由を明記）
```

**制約**
- 実装は行わない（レビューと判断のみ）
- 「とりあえずOK」な曖昧な判定は出さない
- SPEC.mdを読まずにレビューしない

---

## 開発フローとエージェントの対応表

```
①要件定義    → 人間 + TASKS.md更新（エージェント不使用）
②環境構築    → PhysicsAgent（package.json・tsconfig等）
③設計        → PhysicsAgent（タスク単位の設計docを .kiro/reviews/ に生成）
④設計レビュー → ReviewerAgent → 結果を .kiro/reviews/ に記録
⑤TCケース作成 → PhysicsAgent（.kiro/reviews/ のOKファイルを確認してから開始）
⑥TCレビュー  → ReviewerAgent → 結果を .kiro/reviews/ に記録
⑦テストコード → PhysicsAgent（.kiro/reviews/ のOKファイルを確認してから開始）
⑧実装（物理） → PhysicsAgent（optics/・scene/計算層）
⑧実装（UI）  → UIAgent（ui/・styles/・scene/ビジュアル）
⑨テスト実行  → PhysicsAgent（npm run test実行・失敗時は3分類して3回まで自己修正）
⑩UI確認     → 人間（ブラウザで目視）→ UIAgentへフィードバック
```

### レビュー結果ファイルの命名規則

```
.kiro/reviews/
  ├── phase1-task1-design.md           # ③で生成
  ├── phase1-task1-design-review.md    # ④で生成（判定: ✅OK / 差し戻し）
  ├── phase1-task1-tc.md               # ⑤で生成
  ├── phase1-task1-tc-review.md        # ⑥で生成（判定: ✅OK / 差し戻し）
  └── phase1-task1-question-log.md     # Level 1疑問のログ（任意）
```

PhysicsAgentは次のステップへ進む前に、必ず対応する `-review.md` ファイルが存在し、判定が `✅OK` であることを確認する。

### Gitコミットのタイミング

| タイミング | 担当 | 備考 |
|---|---|---|
| ④設計レビュー完了時 | 人間 | `.kiro/reviews/*-design-review.md` が✅OKのとき |
| ⑦テストコード作成完了時 | 人間 | テストがRedになることを確認済み |
| ⑨テストコード実行完了時 | 人間 | テストが全Greenになったとき |

---

## タスク実行フロー（具体例）

### 通常フロー（Level 1疑問なし）

```
人間:「TASKS.md の Phase 1 の 1-2-1 を進めてください」
  ↓ [PhysicsAgent / Flagship で実行]

PhysicsAgent:
  1. TASKS.mdを読む
  2. 設計ドキュメントを .kiro/reviews/phase1-task1-2-1-design.md に生成
  3. 中断して人間に報告「④設計レビューをReviewerAgentで実行してください」

  ↓ 人間がReviewerAgentに切替

ReviewerAgent:
  4. 設計ドキュメントをSPEC.mdと照合
  5. 結果を .kiro/reviews/phase1-task1-2-1-design-review.md に記録
  6. 判定: ✅OK → 「Gitコミットをお願いします」

  ↓ 人間がコミット実行 → PhysicsAgentに戻す

PhysicsAgent:
  7. .kiro/reviews/phase1-task1-2-1-design-review.md が✅OKであることを確認
  8. テストケース生成 → .kiro/reviews/phase1-task1-2-1-tc.md
  9. 中断してレビュー依頼

  ↓ ReviewerAgent → ✅OK

PhysicsAgent:
  10. テストコード作成 → Red確認 → 「Gitコミットをお願いします」
  11. 実装
  12. npm run test 実行
      → Green → 「Gitコミットをお願いします」
      → Red → 原因分類（実装バグ/テストミス/設計ミス）→ 3回まで自己修正
  13. TASKS.mdの [x] 更新 → 完了報告
```

### Level 1疑問が発生したフロー

```
PhysicsAgent:
  1. 設計中に「Cauchy式のλ単位がµmかnmか曖昧」という疑問
  2. 疑問をLevel分類 → Level 1（ロジック疑問）
  3. invoke_sub_agent(ReviewerAgent, 疑問内容)

    ReviewerAgent（サブエージェント）:
      4. SPEC.md §光学モデルを参照
      5. 「λの単位はnm。Cauchy式の内部でのみµmに変換」と判断
      6. 判断結果を返す

  7. PhysicsAgentが判断を受けて設計を完成させる
  8. 疑問と解決を .kiro/reviews/phase1-task1-2-1-question-log.md に記録
  9. 通常フローに合流
```

---

## Hookの一覧

| Hook ID | トリガー | 対象 | 目的 |
|---|---|---|---|
| `lint-on-save` | PostFileSave | `.ts` / `.css` | 保存時に型チェック実行 |
| `test-on-physics-save` | PostFileSave | `src/optics/**` | optics層変更時にテスト即時実行 |
| `session-context` | SessionStart | — | TASKS.mdを読んで現状を把握 |
| `commit-reminder` | PostTaskExec | — | Gitコミット対象タスク完了時に通知 |
| `model-switch-notice` | PreTaskExec | — | タスク種別を判定してモデル切替を促す |

---

## Steeringファイルの一覧

| ファイル | inclusion | 対象 |
|---|---|---|
| `.kiro/steering/global.md` | always | 全エージェント共通ルール |
| `.kiro/steering/physics.md` | manual | PhysicsAgent専用ルール |
| `.kiro/steering/ui.md` | manual | UIAgent専用ルール |
| `.kiro/steering/reviewer.md` | manual | ReviewerAgent専用ルール |

---

## 関連ファイル

- `apps/prism-sim/TASKS.md` — 実装タスク一覧・進捗管理
- `apps/prism-sim/CLAUDE.md` — コーディング規約・開発指示
- `apps/prism-sim/SPEC.md` — 機能仕様・光学モデル
- `.kiro/agents/physics-agent.md` — PhysicsAgent定義
- `.kiro/agents/ui-agent.md` — UIAgent定義
- `.kiro/agents/reviewer-agent.md` — ReviewerAgent定義
- `.kiro/reviews/` — 設計ドキュメント・レビュー結果・疑問ログ格納フォルダ

## 運用ガイド

### フェーズ単位でのモデル切替推奨

タスク単位での切替は認知負荷が高いため、フェーズ単位で切り替える。

| フェーズ | エージェント | モデル | 期間 |
|---|---|---|---|
| Phase 0〜3 | PhysicsAgent | Flagship | 環境構築〜インタラクション |
| Phase 4 | UIAgent | M2.5 | UIパネル・数値表示 |
| Phase 5〜6 | PhysicsAgent | Flagship | 仕上げ・検証 |

### src/scene/ のコメント境界ルール

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

### テスト失敗時の3回ルール

⑨テスト実行で失敗した場合：

1. エラーメッセージを読んで原因分類
   - A. 実装コードのバグ → ⑧へ戻る
   - B. テストコードの期待値ミス → ⑦へ戻る
   - C. 設計の前提が間違っている → Level 2疑問として人間に報告
2. A・Bは3回まで自己修正を試みる
3. 3回で解決しない場合は中断して人間に報告（無限ループ防止）
