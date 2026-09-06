---
inclusion: always
---

# 全エージェント共通ルール

このSteeringは PhysicsAgent・UIAgent・ReviewerAgent の全エージェントに常時適用されます。

## セッション開始時に必ずすること

1. `apps/prism-sim/TASKS.md` を読み、現在の進捗（完了済み・未着手・進行中のタスク）を把握する
2. `apps/prism-sim/CLAUDE.md` のコーディング規約を確認する
3. 今回のタスクが `apps/prism-sim/SPEC.md` のどの機能に対応するかを確認する

## タスク管理ルール

- 完了したタスクは TASKS.md の `[ ]` を `[x]` に更新してから完了を報告する
- **PhysicsAgentのLevel 1疑問（ロジック）は `invoke_sub_agent` で ReviewerAgent に委譲し、自己解決する**
- **Level 2疑問（仕様変更）・Level 3疑問（デザイン）は即座に中断し、人間に報告する**
- 設計に問題が発見されたら ③設計 へ戻り、TASKS.md にその旨を記録してから人間に報告する
- SPEC.md との乖離が生じそうな場合は、Level 2疑問として人間に確認を取る

## レビュー結果の引き継ぎルール

エージェント間の状態引き継ぎは **`.kiro/reviews/` フォルダ** を使う。

| ファイル | 生成者 | 内容 |
|---|---|---|
| `phaseX-taskY-design.md` | PhysicsAgent | 設計ドキュメント |
| `phaseX-taskY-design-review.md` | ReviewerAgent | 設計レビュー結果（判定: ✅OK / 差し戻し） |
| `phaseX-taskY-tc.md` | PhysicsAgent | テストケース一覧 |
| `phaseX-taskY-tc-review.md` | ReviewerAgent | TCレビュー結果（判定: ✅OK / 差し戻し） |
| `phaseX-taskY-question-log.md` | PhysicsAgent | Level 1疑問と解決ログ（任意） |

PhysicsAgentは次のステップへ進む前に、対応する `-review.md` ファイルが存在し、判定が `✅OK` であることを必ず確認すること。

## Gitコミットのタイミング（人間の承認後に実行）

以下のタイミングで人間に「Gitコミットしてください」と報告する：

| タイミング | 条件 | 報告内容 |
|---|---|---|
| ④設計レビュー完了時 | `.kiro/reviews/*-design-review.md` が✅OK | 「設計レビューOKです。Gitコミットをお願いします」 |
| ⑦テストコード作成完了時 | テストがRedになることを確認済み | 「テストコードが完成しました（Red確認済み）。Gitコミットをお願いします」 |
| ⑨テストコード実行完了・全Green時 | `npm run test` が全Green | 「テストが全件Greenです。Gitコミットをお願いします」 |

Gitコミット自体はエージェントが自動実行しない。人間の明示的な指示を待つ。

## モデル切替の案内（フェーズ単位推奨）

タスク単位での切替は認知負荷が高いため、**フェーズ単位で切り替える**ことを推奨する：

| フェーズ | エージェント | モデル | 期間 |
|---|---|---|---|
| Phase 0〜3 | PhysicsAgent | Flagship | 環境構築〜インタラクション |
| Phase 4 | UIAgent | M2.5 | UIパネル・数値表示 |
| Phase 5〜6 | PhysicsAgent | Flagship | 仕上げ・検証 |

タスクごとに判定が必要な場合は以下を参照：

- `src/optics/`・`src/scene/`計算層・`tests/` を扱うタスク
  → **「PhysicsAgentのスコープです。Flagshipモデルで実行してください」**
- `src/ui/`・`src/styles/`・`src/scene/`ビジュアル層を扱うタスク
  → **「UIAgentのスコープです。MiniMax M2.5で実行してください」**
- 設計レビュー・テストケースレビューのタスク
  → **「ReviewerAgentのスコープです。Flagshipモデルで実行してください」**

## 開発フロー（全体）

```
①要件定義    → 人間 + TASKS.md更新
②環境構築    → PhysicsAgent
③設計        → PhysicsAgent（タスク単位の設計ドキュメントを生成）
④設計レビュー → ReviewerAgent → OKなら人間がGitコミット
⑤TCケース作成 → PhysicsAgent
⑥TCレビュー  → ReviewerAgent → OKなら次へ
⑦テストコード → PhysicsAgent → 人間がGitコミット
⑧実装（物理） → PhysicsAgent（optics/・scene/計算層）
⑧実装（UI）  → UIAgent（ui/・styles/・scene/ビジュアル）
⑨テスト実行  → PhysicsAgent（npm run test 実行・結果報告）→ 人間がGitコミット
⑩UI確認     → 人間（ブラウザで目視）→ UIAgentへフィードバック
```

## 参照ドキュメント

- `apps/prism-sim/TASKS.md` — 実装タスク一覧・進捗管理
- `apps/prism-sim/CLAUDE.md` — コーディング規約・開発指示
- `apps/prism-sim/SPEC.md` — 機能仕様・光学モデル
- `docs/agent-architecture.md` — エージェント構成設計ドキュメント
