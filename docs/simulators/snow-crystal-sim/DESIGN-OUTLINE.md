# 雪の結晶シミュレータ（snow-crystal-sim）全体設計

## 前提と制約

- 要件・受入基準・物理モデルは `SPEC.md` を正とする。本書はそれを満たすための層構成と
  公開契約だけを定め、仕様の記述を複製しない
- リポジトリの制約に従う
  - `scripts/check-architecture.mjs` が `src/simulators/*/domain/` を走査し、`three` などの
    描画ライブラリ・`app` / `ui` / `scene` 層・ブラウザグローバルへの依存を機械的に検出して
    失敗させる。**domain 層はこの検査を通ることが前提の設計とする**
  - 依存は npm で固定する。CDN からの実行時読み込みを行わない
  - 他の `apps/*` のコードを import しない
- 対象の受入基準: `SPEC.md` の AC-01〜AC-12

## 層の境界

```text
src/
  core/                                   共通の型とシミュレータ登録の契約
  simulators/snow-crystal-sim/
    domain/   六角格子の成長計算と形態パラメータ（Three.js・DOM 非依存）
    app/      軌跡の記録、履歴管理、共有 URL、表示用データ変換
    ui/       中谷ダイヤグラム操作盤、タイムライン、情報バー、ヘルプ
    scene/    Three.js による立体化と描画
```

`domain/` は純粋関数のみで構成し、同一入力に同一出力を返す。成長は
`step(state, params) => { state, ledger, reachedEdge }` の形にする。seed は
xoshiro128** version 1.1 の 4×uint32 state とし、初期化時に固定 noise 配列を生成する。
`step` は乱数を消費せず、各条件サンプルから得た `beta`、`gamma`、`noiseAmplitude`、`dtCa`
を受け取る（AC-02、AC-06）。数値詳細は `tasks/T1-0/DESIGN.md` を正とする。

## 公開契約

| 契約 | 入力と単位 | 出力と単位 | エラーと境界 |
|---|---|---|---|
| `normalizeConditions(temperatureC, supersaturationPct)` | 温度 `[-30,0]` [°C]、遠方の氷に対する相対過飽和度 `[0,30]` [%] | クランプ後の条件、`x=(T+30)/30`、`y=σ%/30`、クランプ情報 | 有限な定義域外はクランプ。非有限は `TypeError` |
| `morphologyAt(temperatureC, supersaturationPct)` | 上記の温度と過飽和度 | c/a 比、Reiter の `β`・`γ`・ゆらぎと較正 ID、クランプ情報 | **写像値は T1-3 の経験的較正で確定**。Reiter パラメータを物理量と同一視しない |
| `createLattice({radius, seed, beta, noiseAmplitude})` | 六角格子半径 [セル]、xoshiro128** 1.1 の 4×uint32 state、初期の無次元 CA 値 | 中心 seed、初期 `β` reservoir ring、固定 noise を持つ初期状態 | `radius<2`、all-zero seed、パラメータ範囲外は `RangeError`。同一 seed で同一状態（AC-06） |
| `step(lattice, {beta, gamma, noiseAmplitude, dtCa})` | 格子、その step の無次元 CA `β`・添加率 `γ`・ゆらぎ振幅、`dtCa` `(0,1]` [CA step] | 次状態、面外入力・reservoir exchange を分離した収支台帳、外縁到達フラグ | step 開始時に外周だけを `β` へ置換して拡散へ使い、終端でも固定する。内部場・既存氷を再スケールしない。純粋関数。停止後は固定点 |
| `vaporBudget(lattice)` | 格子状態 | mobile vapor、deposited water、合計、氷セル数 | `step` の台帳と走査・集計コードを共有しない独立 compensated sum で収支検証（AC-07） |
| `morphologyMetrics(lattice, thickness?)` | 格子、任意の有限・非負 c 軸厚み [セル] | 半径、周長、compactness、tip density、`number \| null` の aspect ratio、6 腕の長さ・質量 CV | 厚み省略または直径 0 なら aspect ratio は `null`。形態クラス閾値は T1-3/T1-4 で較正する |
| `columnThickness(morphology, cell)` | 形態パラメータ、セル | c軸方向の厚み [格子単位] | 板状で薄く、柱状で厚くなる。負にならない |
| `latticeToInstances(lattice, thickness)` | 格子状態、厚み関数 | 描画用のインスタンス配列（位置・厚み・氷の濃度） | scene 層が消費する。Three.js 型を返さない |
| `axialToCartesian(q, r)` | 六角格子の軸座標 | 直交座標 | 純粋な座標変換 |

`step` は毎秒 10〜20 回呼ばれ、格子は 200×200 相当になる。純粋関数の形を保ちつつ
割り当てを抑えるため、**あらかじめ確保した2枚のバッファを交互に使う**（入力を書き換えず、
出力先バッファへ書き出す）設計を検討する。純粋性と性能が両立しない場合は純粋性を優先し、
性能は実測に基づいて後から最適化する（`apps/prism-sim` が optics 層で採った方針と同じ）。

## 物理・数値の決定

- **出典**: 恒久 URL、版、頁、式、図表番号を `tasks/T1-0/DESIGN.md`「出典台帳」に固定した
- **モデル**: 二層構造（温度→c軸/a軸の異方性、過飽和度→枝分かれ）。詳細は `SPEC.md`
- **CA の選択**: Reiter (2005) の二次元六角 CA、標準 `α=1`。`dtCa` は `(0,1]` CA step。
  各 step の開始時に外周だけを当該条件の `β` へ置換して拡散へ使い、終端でも同値へ固定する。
  内部場は再スケールしない。外周 `β` reservoir の交換量と `γ` 面外入力を別々に台帳へ記録する。各台帳総和は固定した
  セル順の Neumaier compensated summation で求める
- **過飽和度**: `σ∞=(c∞-csat)/csat`、UI 単位は %、範囲 `[0,30]`。30 % は参照実験の
  有限上限であり自然界の普遍的上限ではない
- **較正の位置づけ**: `morphologyAt` は**経験的較正**である。この一点が本アプリで最も
  誠実さを要する箇所であり、較正手順・採用値・参照した観測点を実装時の `DESIGN.md` に
  記録する。UI では較正であることを明示する（AC-12）
- **対称性**: `SPEC.md` のとおり、格子全体を計算し対称性を創発させる。**60° セクターの
  ミラーリングは禁止**（AC-05 がこれをテストで縛る）
- **独立オラクル戦略**: 期待値を実装と同じ経路で生成しない
  1. **水蒸気の収支**（AC-07）—— `vaporBudget` を `step` とは独立の走査と compensated sum で
     実装し、面外入力・reservoir exchange を除いた residual と突き合わせる
  2. **形態の定性的判定** —— 得られた結晶の枝分かれ数・アスペクト比を測る指標関数を
     成長コードとは独立に書き、`SPEC.md` の温度帯（AC-04）と過飽和度依存（AC-03）を検証する
  3. **非ミラーリングの構造検証** —— `step` が 60° セクターの計算結果を回転・反転して
     複製せず、格子全体の各セルを独立した更新経路で計算していることを構造テストまたは
     コードレビューで確認する（AC-05）
  4. **対称性の統計と見た目** —— 6本の腕の質量・長さの CV を測り、一様条件下で両方
     `<=0.15`、較正済みの非ゼロゆらぎでは少なくとも一方 `>1e-6` を確認する。この分散は
     「ほぼ揃うが完全一致ではない」
     見た目とゆらぎの受入判定だけに用い、非ミラーリングの構造を立証する根拠には用いない
  5. **決定性** —— 同一 seed と、各 step の条件・較正 ID・`β`・`γ`・ゆらぎ振幅・`dtCa` を
     含む同一軌跡で全セルが一致すること（AC-06）
  6. **境界近似の感度** —— production の六角 ring を、境界距離を倍にした六角格子および
     同セル数に最も近い Euclidean disk 境界と比較する。通常の `createLattice` の再現契約は
     変更せず、比較時だけ一つの master field から 3 格子へ初期状態を射影し、共有座標の
     `waterMass`・`ice`・`noise` を bit-for-bit 同一にする。比較開始前の一致検査と各 checkpoint
     までの同一 control prefix 検査により、境界形状・距離以外の入力を固定する。T1-3 の代表
     軌跡について形態指標の差と 60° 回転共変性が T1-0 設計書の基準内であることを較正承認前に
     確認し、失敗時は `β`・`γ` を調整せず Euclidean 境界へ差し戻す
- **再現性**: 作者参照実装 xoshiro128** version 1.1、`modelVersion` の
  `reiter-alpha1-xoshiro128ss-1.1-v1`、セル列挙順を固定する。domain 層でグローバルな
  `Math.random` を呼ばず、同じ再現キーは bit-for-bit 一致する

## 検証方針

| 層 | 手段 | 対象 |
|---|---|---|
| domain | Vitest（`node`） | 成長則、収支、形態指標、決定性、境界値、異常系 |
| app | Vitest（`node`） | 軌跡の記録・再生、共有 URL の往復 |
| ui | Vitest（`jsdom`、ファイル先頭に `// @vitest-environment jsdom`） | 中谷ダイヤグラムの DOM 構造、キーボード操作、UI ⇄ 状態、a11y の意味論 |
| scene | ブラウザでの受入確認 | 実描画、fps、立体の見え方 |
| 人間 | UI 受入（工程⑩） | AC-01〜AC-04（成長の見た目と形態の妥当性）、操作の手応え |

AC-04（温度帯ごとの形態）は最終的に**人間の目視判断**を含む。指標関数による自動判定を
一次のゲートにしつつ、`ui-acceptance` のチェックリストで代表条件のスクリーンショットを
比較する運用とする。

コマンドは `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim`（タスク中）と
`node scripts/verify.mjs --workspace apps/snow-crystal-sim`（完了時）を用いる。

## 未決定事項

| # | 決定事項 | 判断者 | 選択肢 | 推奨 |
|---|---|---|---|---|
| 3 | 格子半径と成長ステップ頻度の既定値 | DeliveryBuilder | 実測で決める | 200×200 相当・10〜20 ステップ/秒を出発点とし、T2-4 の性能実測で確定する |
| 4 | ゆらぎの大きさ | 人間（UI 受入） | 実測に基づく調整 | 「ほぼ対称だが完全ではない」に見える最小の値。P2 の見た目評価で確定し `SPEC.md` を更新する |
| 5 | 柱状形態の立体表現 | ArchitectPhysics | (a) 基底面 CA ＋ c軸方向の一様な厚み (b) 中空角柱まで表現する | まず (a)。中空角柱（-7°C 付近）は (b) が要るため、必要になった時点で別タスクにする |
| 6 | 計算を CPU と GPU のどちらで回すか | DeliveryBuilder | (a) CPU の `Float32Array`（見積もりでは十分） (b) GPGPU の ping-pong | まず (a) を T2-4 で実測。性能予算を満たせない場合のみ (b) へ移す |
