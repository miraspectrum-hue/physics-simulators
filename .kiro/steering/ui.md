---
inclusion: manual
name: ui-rules
description: UIAgentとしてUI・スタイル・ビジュアル実装を担当するときに読み込む
---

# UIAgent 専用ルール

このSteeringは **MiniMax M2.5** で UI・スタイル・Three.jsビジュアル層を実装するときに手動で読み込んでください。

## 担当範囲

```
src/ui/              ← ControlPanel, InfoOverlay, HelpModal, store等（触ってよい）
src/styles/          ← CSSテーマ・レイアウト（触ってよい）
src/scene/           ← Three.jsビジュアル部分（マテリアル・色・グロー）（触ってよい）
tests/ui/            ← jsdom環境のUIテスト（触ってよい）
```

**触ってはいけないファイル層**

```
src/optics/          ← PhysicsAgentの担当。物理計算の変更は禁止
```

`src/scene/` のビジュアル変更（マテリアル・Bloom・カラー）はOK。  
`src/scene/` の計算ロジック変更（光路計算・交差判定）はNG。

## デザイン提案フロー

UIの新規実装・変更は必ずこの順で進める：

1. **デザイン案を3つ以上**言語で記述して人間に提示する
2. 人間が選んだ案を実装する
3. 実装後にアクセシビリティチェックリストを確認する

### デザイン案の記述フォーマット

```markdown
### 案A: [名称]
- 見た目: （視覚的な特徴）
- 操作感: （インタラクションの特徴）
- トレードオフ: （利点・欠点）

### 案B: [名称]
...

### 案C: [名称]
...
```

## デザイン基準

`apps/prism-sim/prizm.png` のダークテーマを基準にする。

| 項目 | 値 |
|---|---|
| 背景 | `#05070d` → `#0d1220` のグラデーション |
| パネル | `#111826` 半透明 + backdrop-blur |
| テキスト | `#e6ecf5` |
| アクセント | `#5b8dff` |
| 警告・全反射 | `#ffb454` |
| プリズム色 | `#4a6ea8`（青味がかった透明ガラス） |

フォントはシステムフォント（日本語は Noto Sans JP / Yu Gothic フォールバック）。

## アクセシビリティチェックリスト（実装後に必ず確認）

- [ ] 全操作にキーボードで到達できるか（Tab・矢印キー）
- [ ] `label[for]` または `aria-label` が全入力要素に付いているか
- [ ] ラジオグループに `fieldset` + `legend` + `role="radiogroup"` があるか
- [ ] フォーカスリングが全要素で表示されるか（`outline: none` にしていないか）
- [ ] 色のみに依存した情報表現になっていないか（数値テキストも表示しているか）
- [ ] ダイアログ（モーダル）にはフォーカストラップがあるか

## テスト環境の注意事項

jsdomを使うテストファイルには先頭に `// @vitest-environment jsdom` を書く。

jsdomの既知の制約：
- `getBoundingClientRect()` は常に 0 を返す（実レイアウトは測れない）
- `input[type=range]` の `value` 属性を省くと jsdom は min/max の中点ではなく `"50"` を返す
  → コンストラクタで明示的に初期値をセットすること
- WebGL・CSS は効かない。見た目・寸法・画素の検証は CDPで行う

## Three.jsビジュアル変更時の注意

- `transmission` を使うと加算ブレンドで描く内部ビームが消える（TASKS.md 4-2c 設計メモ参照）
- マテリアル変更後は `renderer.info.memory` でGPU資源が増えていないか確認する
- 毎フレームで `new` を呼ぶ変更は禁止（`src/scene/` のホットパス内）

## テスト実行コマンド

```bash
# UIテストのみ実行
cd apps/prism-sim
npm run test -- ui

# 全テスト実行
cd apps/prism-sim
npm run test
```
