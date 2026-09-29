# 雪の結晶シミュレータ（snow-crystal-sim）タスク一覧

## 運用

- 作成・更新時は `docs/tasks-authoring-rules.md` を参照する。
- 実行指示は原則タスク単位とする。例: 「`snow-crystal-sim` の `P1 / T1-2` を進めてください。」
- 仕様・受入基準・数式は `SPEC.md`、層構成と公開契約は `DESIGN-OUTLINE.md` を正とする。
  本書へ複製しない。
- 各タスクの `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、`DECISIONS.md` は、
  特記がない限り `docs/simulators/snow-crystal-sim/tasks/<task-id>/` に保存する。上位成果物の
  更新は、そのタスクの `DECISIONS.md` とレビューで根拠・影響範囲を記録してから行う。

## P0: 開発準備

- ゴール: 契約と開発環境を確定し、成長コアの実装を開始できる状態にする。
- 受入条件: `SPEC.md` と `DESIGN-OUTLINE.md` がレビュー承認済みであり、workspace で
  `node scripts/verify.mjs --workspace apps/snow-crystal-sim` が通る。
- 対象外: 成長計算・UI の実装。
- 依存: なし

### T0-1: 仕様・全体設計のレビュー

- 目的: 上位成果物を確定し、以降のタスクの拠り所にする。
- 完了条件: `SPEC.md` と `DESIGN-OUTLINE.md` に対する `REVIEW.md` が `status: approved`。
- 実行プロファイル: `lightweight`
- UI影響: なし
- 担当分類: 設計・テストケース・差分の独立レビュー（Reviewer）
- 依存: なし
- 変更境界: `docs/simulators/snow-crystal-sim/` のみ。コードを変更しない。
- 成果物: `tasks/T0-1/REVIEW.md`（レビュー対象の SHA-256 を記録）
- 状態: 完了
- 備考: レビューでは出典名だけでなく、実装に使う数値を追跡できる恒久 URL・版・頁または図表番号を
  確認する。未決定事項は T1-0、T1-7、T1-8 の対象として明確に記録し、未承認のまま数値実装へ進まない。

### T0-2: workspace の作成

- 目的: `apps/snow-crystal-sim/` を npm workspace として成立させる。
- 完了条件: `npm install` 後に `node scripts/verify.mjs --workspace apps/snow-crystal-sim` が
  成功する（テスト 0 件で正常終了してよい）。`package.json` の `name` が `snow-crystal-sim`。
- 実行プロファイル: `lightweight`
- UI影響: なし
- 担当分類: 環境構築、設定、定型的な配線（DeliveryBuilder）
- 依存: T0-1
- 変更境界: `apps/snow-crystal-sim/`（`package.json` / `tsconfig.json` / `vite.config.ts` /
  `index.html`）とルート `README.md` のシミュレータ一覧。既存アプリを変更しない。
- 成果物: 設定ファイル、`README.md` 追記、`tasks/T0-2/REVIEW.md`、`tasks/T0-2/EVIDENCE.md`
- 状態: 完了

### T0-3: 層ディレクトリの雛形

- 目的: `DESIGN-OUTLINE.md` の層構成を実体化し、境界検査を有効にする。
- 完了条件: `src/simulators/snow-crystal-sim/{domain,app,ui,scene}/` が存在し、
  `node scripts/check-architecture.mjs --workspace apps/snow-crystal-sim` が成功する。
- 実行プロファイル: `lightweight`
- UI影響: なし
- 担当分類: 環境構築、設定、定型的な配線（DeliveryBuilder）
- 依存: T0-2
- 変更境界: `apps/snow-crystal-sim/src/`
- 成果物: ディレクトリ雛形、`tasks/T0-3/REVIEW.md`、`tasks/T0-3/EVIDENCE.md`
- 状態: 完了

## P1: 成長コア

- ゴール: UI に依存せず、条件を与えると結晶が育つ計算ができる。
- 受入条件: AC-03、AC-04、AC-06、AC-07、AC-09 に対応する自動テストが通る。
- 対象外: 描画、中谷ダイヤグラムの UI。
- 依存: P0

### T1-0: 数値モデル契約と出典の確定

- 目的: CA の実装に必要な物理・数値の前提を、検証可能な出典と公開契約に固定する。
- 完了条件: 採用 CA モデル、状態量、過飽和度の定義・単位・範囲、`dt` の単位・範囲、境界流量、
  性能測定条件、形態・対称性の判定量が `DESIGN.md` と `DECISIONS.md` に記録される。各数値には
  恒久 URL と論文版・頁または図表番号を含む出典があり、`SPEC.md` と `DESIGN-OUTLINE.md` の
  更新が物理レビューで `status: approved` になる。
- 実行プロファイル: `lightweight`
- UI影響: なし
- 担当分類: 設計、公開 API、型の契約、数式、単位、境界条件（ArchitectPhysics）
- 依存: T0-3
- 変更境界: `docs/simulators/snow-crystal-sim/` と `tasks/T1-0/`。`apps/` のコードを変更しない。
- 成果物: `tasks/T1-0/DESIGN.md`、`tasks/T1-0/TESTCASES.md`、`tasks/T1-0/REVIEW.md`、
  `tasks/T1-0/EVIDENCE.md`、`tasks/T1-0/DECISIONS.md`、`SPEC.md`、`DESIGN-OUTLINE.md`
- 省略工程と代替検証: 文書だけで物理・数値契約を確定し、実行コードを変更しないため、
  テストコード、Red、Green は実装対象を持つ T1-1、T1-5、T1-6、T1-3、T1-7、T1-8、
  T1-9、T1-4、T1-10、T2-4、T2-5、T4-2 へ移管する。
  T1-0 では設計・テストケースの物理レビュー、成果物ハッシュ、差分検査、全ワークスペース検証、
  文書差分の独立レビューを代替検証とする。
- 状態: 完了

### T1-1: 六角格子・型・座標変換

- 目的: domain 層の語彙と格子表現を確定する。
- 完了条件: 軸座標⇔直交座標の往復変換、近傍6セルの取得、格子生成が型検査とテストを通る。
  `createLattice` が同一 seed で同一状態を返す。`three` を import しない。
- 実行プロファイル: `full`
- UI影響: なし
- 担当分類: 設計、公開 API、型の契約、数式、単位、境界条件（ArchitectPhysics）
- 依存: T1-0
- 変更境界: `src/simulators/snow-crystal-sim/domain/` と、domain 配下のテストを収集対象へ
  追加するための `vite.config.ts`。他層を変更しない。
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 完了

### T1-2: 成長セルオートマトン（分割前の履歴）

- 目的: 水蒸気拡散と凍結判定による結晶成長を実装する。
- 完了条件: AC-06（同一 seed・同一入力で完全一致）、AC-07（水蒸気の収支が閉じる）、
  AC-09（NaN / Infinity なし）のテストが通る。外縁到達をフラグで通知する。
  **`vaporBudget` は `step` とは独立に実装し、期待値を `step` から生成しない。**
- 実行プロファイル: `full`
- UI影響: なし
- 担当分類: 物理計算の純粋関数、数値計算、アルゴリズム（ArchitectPhysics）
- 依存: T1-1
- 変更境界: `src/simulators/snow-crystal-sim/domain/`
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: stale
- 備考: 2026-09-21 の人間判断で T1-5（独立収支監査）と T1-6（成長 step）へ分割。
  本タスクの設計・テストケース・レビューは履歴として保持し、以後の承認根拠には使わない。
  上位の T1-0 数値契約、`SPEC.md`、`DESIGN-OUTLINE.md` は変更しない。

### T1-5: 独立した水量収支監査

- 目的: 成長 step と独立した `vaporBudget(state)` で、水量の相分類と総量を検査できるようにする。
- 完了条件: 氷・受容セルによる相分類、補償和、入力検証と overflow のテストが通り、
  `step` の台帳・更新関数・集計 helper を期待値生成にも実装にも使わない。
- 実行プロファイル: `full`
- UI影響: なし
- 担当分類: 物理計算の純粋関数、数値計算、アルゴリズム（ArchitectPhysics）
- 依存: T1-1
- 変更境界: `src/simulators/snow-crystal-sim/domain/` の `vapor-budget.ts`、公開型・export、
  対応テスト。`reiter-step.ts` と他層を変更しない。
- 成果物: `tasks/T1-5/DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 完了
- 備考: T1-2 の履歴を参照資料にできるが、新しい設計・テストケースは本タスクで独立に承認する。

### T1-6: 成長 step と収支台帳

- 目的: Reiter `alpha=1` の拡散・添加・凍結・停止を1 step の純粋関数として実装する。
- 完了条件: AC-06、AC-07、AC-09 と外縁到達通知を、独立した参照計算・
  収支監査・再生テストで確認できる。`vaporBudget` の実装経路を共有しない。
- 実行プロファイル: `full`
- UI影響: なし
- 担当分類: 物理計算の純粋関数、数値計算、アルゴリズム（ArchitectPhysics）
- 依存: T1-5
- 変更境界: `src/simulators/snow-crystal-sim/domain/` の `reiter-step.ts`、公開型・export、
  対応テスト。`vapor-budget.ts` と他層を変更しない。
- 成果物: `tasks/T1-6/DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 完了
- 備考: 境界交換・面外入力・台帳・入力不変・PRNG 非消費を含む。T1-0 契約を変更しない。

### T1-3: 独立した形態指標

- 目的: 成長実装と独立した `morphologyMetrics` で、基底面形状を定量比較できるようにする。
- 完了条件: 半径・周長・compactness・tip density・6腕の長さと質量の CV が既知の人工格子で
  独立計算と一致し、厚み未指定または基底面直径 0 の `aspectRatio` が `null` になる。
- 実行プロファイル: `full`
- UI影響: なし
- 担当分類: 物理計算の純粋関数、数値計算、アルゴリズム（ArchitectPhysics）
- 依存: T1-6
- 変更境界: `src/simulators/snow-crystal-sim/domain/` の形態指標、公開型・export、対応テスト。
  成長 step、較正値、描画層を変更しない。
- 成果物: `tasks/T1-3/DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手
- 備考: production の成長コードや `morphologyAt` を期待値生成に使わない。

### T1-7: 観測コーパスと較正プロトコル

- 目的: Libbrecht (2023) Figure 2 の206観測点を追跡可能なデータとして固定し、再現可能な
  較正手順を定義する。
- 完了条件: 全観測点に出典内ID、温度、氷過飽和度、既知時刻、寸法、形態タグ、不確かさ、
  転記根拠があり、原資料との照合・データハッシュ・学習/holdout分割・loss・探索順が再現できる。
- 実行プロファイル: `full`
- UI影響: なし
- 担当分類: 物理データ、較正手順、再現性（ArchitectPhysics）
- 依存: T1-3
- 変更境界: `docs/simulators/snow-crystal-sim/tasks/T1-7/` と、較正用の静的データ・検証コード。
  runtime の形態写像、成長 step、UI を変更しない。
- 成果物: `tasks/T1-7/DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、
  `DECISIONS.md`、追跡可能な観測コーパス、検証テスト
- 状態: 未着手
- 備考: 206点すべてを収録する。物理時間と実寸は照合・報告するが、CA step に物理秒を
  割り当てないため適合 loss の対象外とし、形態タグと無次元形状だけを較正対象にする。

### T1-8: 経験的な形態写像

- 目的: `(temperatureC, supersaturationPct)` から Reiter CA の `beta`、`gamma`、
  `noiseAmplitude` 候補、c/a 比、`calibrationId` への経験的写像を実装する。
- 完了条件: T1-7 の固定プロトコルで選んだ写像が holdout 基準を満たし、0 % で
  `beta=gamma=0`、有限範囲外のクランプ、非有限入力拒否、補間の連続性、同一入力の決定性を
  独立テストで確認できる。採用値と不採用候補を追跡できる。
- 実行プロファイル: `full`
- UI影響: なし
- 担当分類: 物理計算の純粋関数、経験的較正、数値計算（ArchitectPhysics）
- 依存: T1-7
- 変更境界: `src/simulators/snow-crystal-sim/domain/` の `morphologyAt`、公開型・export、
  対応テスト、および較正結果。成長 step、厚み実装、UI を変更しない。
- 成果物: `tasks/T1-8/DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、
  `DECISIONS.md`、コード、テスト
- 状態: 未着手
- 備考: **第一原理による変換ではなく経験的較正である。** `noiseAmplitude` は T1-0 の
  CV 自動基準を満たす候補として固定し、最終値は T2-5 の人間 UI 受け入れで確定する。

### T1-9: 境界形状・距離の感度ゲート

- 目的: production の六角 ring 境界近似が、較正結果を境界形状や距離へ過度に依存させない
  ことを確認する。
- 完了条件: T1-8 の全代表軌跡を、半径 `R=115` の六角格子、境界距離を倍にした六角格子、
  同セル数に最も近い Euclidean disk 境界で共通 master field と同一 control prefix から実行し、
  T1-0 の形態指標差・回転共変性基準を満たす。
- 実行プロファイル: `full`
- UI影響: なし
- 担当分類: 物理・数値検証、境界近似の感度分析（ArchitectPhysics）
- 依存: T1-8
- 変更境界: `src/simulators/snow-crystal-sim/domain/` の比較専用境界・fixture・検証コードと
  `tasks/T1-9/`。較正パラメータを感度試験へ合わせて調整しない。
- 成果物: `tasks/T1-9/DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、
  `DECISIONS.md`、比較 harness、テスト
- 状態: 未着手
- 備考: 基準を満たさない場合は T1-8 を調整せず、T1-0 の決定どおり境界設計へ差し戻す。

### T1-4: c軸方向の厚み

- 目的: 温度による板状／柱状の切り替えを、基底面 CA に厚みを与える形で表す。
- 完了条件: 板状の温度帯で薄く、柱状の温度帯で厚くなることがテストで確認できる。
  厚みが負にならない。
- 実行プロファイル: `full`
- UI影響: なし
- 担当分類: 物理計算の純粋関数、数値計算、アルゴリズム（ArchitectPhysics）
- 依存: T1-9
- 変更境界: `src/simulators/snow-crystal-sim/domain/`
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手
- 備考: 中空角柱の表現は `DESIGN-OUTLINE.md` の未決定事項5に従い、第一段階では扱わない。

### T1-10: 形態較正の統合受入

- 目的: 基底面の枝分かれ写像と c 軸厚みを統合し、代表条件で期待形態になることを
  自動指標により確認する。
- 完了条件: T1-3 の独立指標により、過飽和度上昇で枝分かれが増える AC-03 と、
  `-2 °C` 付近で板状、`-6 °C` 付近で柱状、`-15 °C` 付近で薄い板状になる AC-04 の
  自動基準を、T1-7 の holdout 観測を含む代表条件で満たす。
- 実行プロファイル: `full`
- UI影響: なし
- 担当分類: 物理モデル統合、独立形態検証（ArchitectPhysics）
- 依存: T1-4, T1-9
- 変更境界: 既存の `step`、`morphologyMetrics`、`morphologyAt`、`columnThickness` を使う
  統合 fixture・harness・テストと `tasks/T1-10/`。新しい公開 API、UI、描画を変更しない。
- 成果物: `tasks/T1-10/DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手
- 備考: 最終的な見た目と `noiseAmplitude` は T2-5 で人間が受け入れる。自動基準の通過を
  見た目の受け入れと同一視しない。

## P2: 最小可視化

- ゴール: 結晶が 3D で育つ様子が見え、六回対称性が創発していることを確認できる。
  本アプリ最大の技術リスクをここで解消する。
- 受入条件: AC-05 が満たされ、人間が結晶の見た目を受け入れる。
- 対象外: 中谷ダイヤグラムの操作 UI、タイムライン。
- 依存: P1

### T2-1: シーンの土台

- 目的: 3D ビューポートを表示し、カメラ操作ができる状態にする。
- 完了条件: 開発サーバでシーンが表示され、軌道回転・パン・ズームが動作する。
  コンソールエラーが 0 件である。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: UI、スタイル、画面遷移、アクセシビリティ実装（DeliveryBuilder）
- 依存: T0-3
- 変更境界: `src/simulators/snow-crystal-sim/scene/`、`src/simulators/snow-crystal-sim/ui/`
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

### T2-2: 結晶の立体描画

- 目的: 格子状態と厚みから立体を描画する。
- 完了条件: 固定条件で結晶が成長する様子が表示される。六角柱ジオメトリを1つだけ用意し、
  `InstancedMesh` のインスタンス属性バッファを書き換えていること（毎フレームのジオメトリ
  再生成をしていないこと）をコードレビューで確認する。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: UI、スタイル、画面遷移、アクセシビリティ実装（DeliveryBuilder）
- 依存: T1-4, T2-1
- 変更境界: `src/simulators/snow-crystal-sim/{scene,app}/`
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

### T2-3: 成長ステップと描画の分離

- 目的: 成長の進行を描画フレームレートから切り離し、性能測定できる土台を作る。
- 完了条件: 固定ステップ幅で成長を 10〜20 回/秒に進め、描画と分離できる。固定の seed・軌跡で
  AC-06 の再現性を保ち、描画フレームでは成長していない状態を変更しない。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: 物理計算以外のロジック、UI、検証実行（DeliveryBuilder）
- 依存: T2-2
- 変更境界: `src/simulators/snow-crystal-sim/{app,scene,ui}/`。domain の成長則を変更しない。
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

### T2-4: 性能実測と計算経路の決定

- 目的: 最小可視化の段階で AC-08 の実現可能性を確かめ、CPU/GPU と既定値を確定する。
- 完了条件: 代表機で格子 200×200 相当、固定の成長履歴、カメラ操作中という測定条件を記録し、
  60 fps を満たすかを `EVIDENCE.md` に記録する。未決定事項3・6の結論を `DECISIONS.md` に
  記録する。満たせない場合は P3 へ進まず、計算経路の見直しを T1-6 へ差し戻す。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: 環境、非物理ロジック、UI、検証実行（DeliveryBuilder）
- 依存: T2-3
- 変更境界: `src/simulators/snow-crystal-sim/{scene,app}/`。成長則を変更する場合は T1-6 へ差し戻す。
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、`DECISIONS.md`、コード、テスト
- 状態: 未着手

### T2-5: 対称性の創発と見た目の受入判定

- 目的: 六回対称性が強制ではなく創発していることを確認し、ゆらぎの大きさを決める。
- 完了条件: AC-05 のテスト（**セクターのミラーリングをしていない**こと、一様条件下で6本の
  腕の分散が小さいが 0 ではないこと）が通り、人間が見た目を受け入れる。未決定事項4の
  結論が記録されている。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: 要件の整理、タスク分解、工程遷移、例外判断（Coordinator）
- 依存: T2-4
- 変更境界: `src/simulators/snow-crystal-sim/domain/`（ゆらぎの既定値）、
  `docs/simulators/snow-crystal-sim/`
- 成果物: `DECISIONS.md`、`EVIDENCE.md`、`REVIEW.md`、`SPEC.md` の更新（ゆらぎを確定した場合）
- 状態: 未着手

## P3: 落下軌跡を描く操作

- ゴール: 中谷ダイヤグラム上のドラッグという主操作が完成し、条件の履歴が形に残る。
- 受入条件: AC-01、AC-02 を人間が受け入れる。
- 対象外: タイムラインの巻き戻し、結晶の保存・比較。
- 依存: P2

### T3-1: 中谷ダイヤグラムの操作盤

- 目的: 主操作となるドラッグ UI を実装する。
- 完了条件: マーカーをドラッグすると温度・過飽和度が変わり、結晶の成長に反映される
  （AC-01）。形態領域のラベルが色以外の手がかりでも判別できる。矢印キーでも操作できる。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: UI、スタイル、画面遷移、アクセシビリティ実装（DeliveryBuilder）
- 依存: T2-5
- 変更境界: `src/simulators/snow-crystal-sim/{ui,app}/`。domain を変更しない。
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

### T3-2: 成長速度コントロール

- 目的: 利用者が成長速度を変更し、停止中も条件を準備できるようにする。
- 完了条件: 開始・停止ボタンと成長速度スライダーが操作できる。スライダーは UI 上の進行速度を
  変更するだけで、T2-3 で固定した domain のステップ幅・同一履歴の再現性を変えない。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: 非物理ロジック、UI、アクセシビリティ実装（DeliveryBuilder）
- 依存: T3-1
- 変更境界: `src/simulators/snow-crystal-sim/{app,ui}/`。domain を変更しない。
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

### T3-3: 軌跡の重ね描きと形態領域の表示

- 目的: 「この結晶がどんな条件を経てきたか」を可視化する。
- 完了条件: マーカーが通った軌跡がダイヤグラム上に線として残り、条件をまたいだ位置と
  結晶の形の変化が対応していることを目視で確認できる（AC-02）。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: UI、スタイル、画面遷移、アクセシビリティ実装（DeliveryBuilder）
- 依存: T3-1
- 変更境界: `src/simulators/snow-crystal-sim/{ui,app}/`
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

### T3-4: 情報バー

- 目的: 現在の条件と結晶の状態を数値で示す。
- 完了条件: 温度・過飽和度・経過ステップ数・最大半径がテキストで表示され、UI ⇄ 状態の
  双方向が jsdom テストで検証されている。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: UI、スタイル、画面遷移、アクセシビリティ実装（DeliveryBuilder）
- 依存: T3-1
- 変更境界: `src/simulators/snow-crystal-sim/{ui,app}/`
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

## P4: 履歴・再現・比較

- ゴール: 作った結晶を巻き戻し、再現し、見比べられる。
- 受入条件: AC-06、AC-12 を満たす。
- 対象外: 性能の最終最適化。
- 依存: P3

### T4-1: タイムラインのスクラブ

- 目的: 成長の過程を巻き戻し・早送りできるようにする。
- 完了条件: タイムラインのドラッグで任意の時点の結晶を表示でき、キーボードでも操作できる。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: 物理計算以外のロジック（DeliveryBuilder）
- 依存: T3-1
- 変更境界: `src/simulators/snow-crystal-sim/{app,ui}/`
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

### T4-2: 共有 URL と seed

- 目的: 結晶を完全に再現・共有できるようにする。
- 完了条件: AC-06 を満たし、seed と軌跡を含む URL の往復で結晶が一致するテストが通る。
- 実行プロファイル: `full`
- UI影響: あり
- 担当分類: 物理計算以外のロジック（DeliveryBuilder）
- 依存: T4-1
- 変更境界: `src/simulators/snow-crystal-sim/{app,ui}/`
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

### T4-3: 結晶の保存と並べて比較

- 目的: 異なる軌跡で作った結晶を見比べられるようにする。
- 完了条件: 現在の結晶を保存し、複数を並べて表示できる。各結晶にその軌跡が対応づいている。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: UI、スタイル、画面遷移、アクセシビリティ実装（DeliveryBuilder）
- 依存: T4-2
- 変更境界: `src/simulators/snow-crystal-sim/{app,ui}/`
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

### T4-4: ヘルプと較正の明示

- 目的: モデルの位置づけを利用者へ正しく伝える。
- 完了条件: AC-12 を満たす。**(T, σ) → 成長パラメータの対応付けが経験的な較正であること**、
  および**板／柱の交替の機構が未解明であること**が記載されている。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: UI、スタイル、画面遷移、アクセシビリティ実装（DeliveryBuilder）
- 依存: T4-1
- 変更境界: `src/simulators/snow-crystal-sim/ui/`
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

## P5: 受入・品質確認

- ゴール: リリース判断できる状態にする。
- 受入条件: 全 AC を満たし、`node scripts/verify.mjs --workspace apps/snow-crystal-sim` が
  通り、人間の UI 受入が完了している。
- 対象外: なし
- 依存: P4

### T5-2: アクセシビリティと非対応環境

- 目的: AC-10・AC-11 を満たす。
- 完了条件: 中谷ダイヤグラムとタイムラインがキーボードで操作可能であること、WebGL2
  非対応時のメッセージ表示、数値のテキスト提示がテストで検証されている。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: UI、スタイル、画面遷移、アクセシビリティ実装（DeliveryBuilder）
- 依存: T4-4
- 変更境界: `src/simulators/snow-crystal-sim/ui/`
- 成果物: `DESIGN.md`、`TESTCASES.md`、`REVIEW.md`、`EVIDENCE.md`、コード、テスト
- 状態: 未着手

### T5-3: 最終検証と UI 受入

- 目的: リリース判断に必要な証跡をそろえる。
- 完了条件: 全 AC の確認結果と `verify.mjs` の結果が `EVIDENCE.md` に記録され、
  人間が UI を受け入れている。
- 実行プロファイル: `ui`
- UI影響: あり
- 担当分類: 要件の整理、タスク分解、工程ゲート（Coordinator）
- 依存: T5-2
- 変更境界: `docs/simulators/snow-crystal-sim/`
- 成果物: `EVIDENCE.md`、`REVIEW.md`
- 状態: 未着手
