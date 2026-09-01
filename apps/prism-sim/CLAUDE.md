# CLAUDE.md - 開発指示・制約・コーディング規約

## プロジェクト概要

正三角柱プリズムによる白色光の分散（スペクトル分離）を、Web ブラウザ上で 3D 可視化するインタラクティブ・シミュレータ。プリズムの回転・移動・入射角の変更に、光路がリアルタイムで追従する。

> **草案からの変更点**: 草案では「単色光が入射し七色に分離する」とあったが、単色光（単一波長）は屈折はしても分散しない。七色に分離するのは白色光であるため、**光源は白色光**とする（ユーザー承認済み）。

## 使用言語・フレームワーク

| 区分 | 採用 |
|------|------|
| 言語 | TypeScript 5.9.3（`strict: true`） |
| 3D | Three.js 0.185.1 + @types/three 0.185.4（WebGL2） |
| ビルド | Vite 8.2.1 |
| スタイル | 素の CSS（CSS Variables でテーマ管理、CSS フレームワーク不使用） |
| テスト | Vitest 4.1.10（+ jsdom 29.1.1）。**対象の境界は下の「テスト方針」節で定める** |
| パッケージ管理 | npm |
| 実行環境 | Chrome 最新版 / デスクトップ |

## ディレクトリ構成

```
prism-sim/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                  # エントリポイント・全体配線
│   ├── optics/                  # 光学計算（Three.js・DOM 非依存の純粋関数）
│   │   ├── constants.ts         #   波長範囲・材質定数・頂角・追跡上限
│   │   ├── dispersion.ts        #   屈折率 n(λ)：Cauchy の分散式
│   │   ├── spectrum.ts          #   波長サンプリング、λ → sRGB 変換
│   │   ├── convexSolid.ts       #   凸多面体（平面集合）とレイ交差判定
│   │   ├── fresnel.ts           #   フレネル反射率（Phase 6）
│   │   └── tracer.ts            #   スネル則・全反射・光路の逐次計算
│   ├── scene/                   # Three.js 描画層
│   │   ├── SceneManager.ts      #   renderer / camera / composer / loop
│   │   ├── PrismObject.ts       #   プリズムメッシュと姿勢（Object3D）
│   │   ├── BeamRenderer.ts      #   LightPath[] → Line2 群への変換・更新
│   │   ├── ScreenObject.ts      #   仮想スクリーン（Phase 6）
│   │   ├── SectionView.ts       #   断面 2D ビュー（Phase 6）
│   │   └── InteractionCtl.ts    #   OrbitControls / TransformControls 切替
│   ├── ui/
│   │   ├── ControlPanel.ts      #   スライダー・セレクト等の操作 UI
│   │   ├── InfoOverlay.ts       #   偏角・屈折率などの数値表示
│   │   └── store.ts             #   アプリ状態と変更通知（簡易 observable）
│   ├── types/
│   │   └── optics.ts            #   Ray / Segment / LightPath / PrismMaterial 等
│   └── styles/
│       └── main.css
└── tests/
    ├── optics/                  # dispersion / convexSolid / tracer / fresnel のテスト
    ├── scene/                   # scene 層の純粋関数。svgRaster.test.ts / InteractionCtl.test.ts は jsdom
    └── ui/                      # store / shareUrl 等。ControlPanel.test.ts / HelpModal.test.ts は jsdom
```

## テスト方針（Vitest と CDP の境界）

テストは 2 層に分ける。**どちらに置くかは「DOM を触るか」ではなく「決定論的に速く回せるか」で決める。**

### Vitest（`prism-sim/tests/`）

| 環境 | 対象 |
|------|------|
| `node`（既定） | 純粋ロジック。`src/optics/` の全体、Three の数学（`Matrix4` / `Vector3`）のみに依存する `src/scene/` の純粋関数、`src/ui/store.ts` のような状態ロジック |
| `jsdom` | **DOM の構造・状態束縛ロジック**。属性・要素の組み立て、UI ⇄ store の双方向、a11y の意味論（`role` / `name` / `legend`） |

- jsdom を使うファイルは**先頭に `// @vitest-environment jsdom` を書く**。環境はファイル単位で
  切り替わるので、他は `node` のままにしておく（全体を jsdom にはしない）
- 現在 jsdom 節に属するのは 4 ファイルである
  - `tests/scene/svgRaster.test.ts` —— ラスタ化の前に SVG へ焼き込む属性（PNG-2）
  - `tests/ui/ControlPanel.test.ts` —— スペクトルラジオ ⇄ store の双方向（4-3）
  - `tests/scene/InteractionCtl.test.ts` —— 入力サスペンドゲートと window keydown の束縛（4-9）
  - `tests/ui/HelpModal.test.ts` —— モーダルの構造・aria・フォーカス移動/復帰の束縛（4-9）
- **jsdom でも WebGL と実レイアウトには触れない。** `getBoundingClientRect` は 0 を返し CSS も
  効かないので、見た目・寸法・画素を jsdom で確かめようとしてはいけない（それは CDP 側の仕事）
- 同じ id を持つ要素を何度も組み立てるテストでは `beforeEach` で DOM を掃く。jsdom の `#id`
  セレクタは `getElementById` に落ちるため、id が重複すると要素に限定した検索が外を拾う

### CDP（開発サーバ + Chrome DevTools Protocol の使い捨てスクリプト）

- 実描画・画素比較・実レイアウト（`getBoundingClientRect` / `devicePixelRatio` / リサイズ）
- `main.ts` の配線を含む end-to-end（共有 URL の復元、`hashchange`、キーボード操作、console エラー 0）
- ビーム位置指紋。**指紋を報告するときは測定 URL とモードを必ず併記する**

### この節の経緯

`ControlPanel.ts` は当初「シーングラフ・DOM を触るモジュールは Vitest 対象外」として除外していたが、
PNG-2 で jsdom を devDependency に入れた時点でこの方針へ更新した（2026-08-27、4-3）。
描画を伴わない DOM 束縛は決定論的で速く、CDP に置くと回帰検知が人手に依存するためである。

## コーディング規約

### 命名規則

- **ファイル名**: クラスを default export するものは PascalCase（`BeamRenderer.ts`）、関数群のモジュールは camelCase（`dispersion.ts`）
- **変数・関数**: camelCase
  - ✅ `incidentAngleDeg`, `refractAt()`, `isTotalReflection`
- **型・インターフェース・クラス**: PascalCase
  - ✅ `LightPath`, `PrismMaterial`, `SceneManager`
- **定数**: UPPER_SNAKE_CASE
  - ✅ `WAVELENGTH_MIN_NM`, `APEX_ANGLE_DEG`, `MAX_BOUNCE_COUNT`
- **角度を扱う変数は単位をサフィックスで明示する**
  - ✅ `angleDeg` / `angleRad` — ❌ `angle`
  - 内部計算はラジアン統一。度が現れてよいのは UI 層との境界のみ
- **波長は nm 単位で統一する**。Cauchy 式の内部でのみ µm に変換する
- **基準波長は He の d 線 587.56nm に統一する**。Na の D 線 589.3nm は使わない（n_d・アッベ数の定義が d 線のため）

### フォーマット

- インデント: 2 スペース
- 行の長さ: 最大 100 文字
- セミコロン: 必須
- クォート: シングルクォート
- import 順: 外部ライブラリ → 自作モジュール（間に空行）

### TypeScript

- `any` は禁止。型が不明な入力は `unknown` で受けて絞り込む
- **`src/optics/` は副作用のない純粋関数のみで構成する**。同一入力に対し必ず同一出力を返すこと
- 公開関数には JSDoc を付け、**引数の単位**と**戻り値の意味**を日本語で記載する

```typescript
/**
 * Cauchy の分散式から屈折率を求める。
 * @param material 材質定数
 * @param wavelengthNm 波長 [nm]
 * @returns 屈折率（無次元）
 */
export function refractiveIndex(material: PrismMaterial, wavelengthNm: number): number
```

### Three.js 運用

- **毎フレームでの `new` を禁止**。`Vector3` 等は生成済みインスタンスを使い回す
  - **適用範囲は `src/scene/` と描画ホットパス（レンダーループ内）に限る**
  - `src/optics/` は純粋関数であることを優先し、**不変オブジェクト（`Vec3` 等）を新規に返してよい**。同一入力に同一出力を返す性質を、インスタンスの使い回しより上に置く
  - optics 層の割り当てが 60fps に影響するかは 5-1（パフォーマンス検証）で測定し、問題が出た場合にのみ tracer にミュータブルな高速経路を追加する
- ジオメトリ・マテリアルは `dispose()` 可能な形で保持する
- 描画ループは常時 60fps で回し、**光路の再計算のみ dirty フラグで抑制**する
- 光線の更新は `setPositions()` で行い、ジオメトリを作り直さない
  - ただし `setPositions()` / `setColors()` は呼ぶたびに `InstancedInterleavedBuffer` と属性を作り直す（`LineSegmentsGeometry.js` 参照）。**呼ぶのは初回の属性確立のときだけ**とする
  - 以降は**自前で保持した `Float32Array` を書き換え、`geometry.attributes.instanceStart.data.needsUpdate = true`** を立てる。これで更新時の割り当てがゼロになる
  - この方法ではバウンディングが更新されないため、光線オブジェクトは `frustumCulled = false` にする（1 オブジェクトに束ねるのでカリングの利益はない）

### コメント

- 日本語で記載する
- 物理式には根拠（式名）を 1 行添える
  - ✅ `// Cauchy の分散式 n(λ) = A + B/λ²（λ は µm）`
  - ✅ `// スネル則のベクトル形式。k < 0 のとき全反射`
- 自明なコードにコメントは書かない

## やってはいけないこと

- ❌ `any` 型の使用
- ❌ `src/optics/` から DOM や Three.js のシーングラフに触れること（テスト不能になる）
- ❌ 屈折率を波長非依存の定数で近似すること（本アプリの主題そのものを失う）
- ❌ **虹色を「7 本の固定色を扇状に描く」等、見た目だけの偽装で実装すること。必ず λ ごとの屈折計算の結果として分散させる**
- ❌ 全反射（判別式 `k < 0`）の未処理。屈折方向が NaN のまま描画してはならない
- ❌ 毎フレームでのジオメトリ再生成
- ❌ CDN からの実行時スクリプト読み込み（依存は npm で固定する）
- ❌ プリズム姿勢をオイラー角で自前に二重保持すること（`Object3D.matrix` を単一の真実とする）
- ❌ 材質定数を出典・検証なしに書き換えること（n_d とアッベ数での検算を必ず通す）
- ❌ ダイヤモンドで虹が出ないことをバグ扱いして「直す」こと。頂角 60° では `A < 2·θc` を満たさず常に全反射するのが物理的に正しい（SPEC.md 参照）
- ❌ SPEC.md からの逸脱を独断で行うこと

## 作業の進め方

1. **TASKS.md のフェーズ順に進め、各フェーズ完了時にユーザーの確認を仰ぐ**
2. タスク完了時は TASKS.md の該当チェックボックスを `[ ]` → `[x]` に更新して報告する
3. **`src/optics/` は先に Vitest でテストを書いてから実装する**
   - 検証に使う既知値: 最小偏角の式、臨界角、n_d の実測値との一致、アッベ数
   - テストが通ってから描画層に進む（虹が出ない時の原因切り分けを可能にするため）
4. SPEC.md との乖離が生じそうな場合は、勝手に判断せず必ず確認する
   - 例: 「パフォーマンスのため波長サンプル数を減らしたいが、SPEC を更新してよいか？」
5. 物理式を実装する際は、SPEC.md の「光学モデル」節の記述と一字一句対応させる

## 環境・起動コマンド

```
- 開発サーバポート: 5173
- プレビュー: http://localhost:5173
```

下記コマンドは許可を求めずに実行してよい。

```
cd apps/prism-sim ; npm run dev
cd apps/prism-sim ; npm run test
cd apps/prism-sim ; npm run build
```
