# T1-1 六角格子・型・座標変換 テストケース

## 1. 目的、範囲、実装配置

本書は、承認済み T1-1 `DESIGN.md` の公開 API を、DeliveryBuilder が仕様を推測せず
Vitest へ実装できる判定条件に具体化する。権威の順序は `SPEC.md`、`DESIGN-OUTLINE.md`、
承認済み T1-0 `DESIGN.md` / `DECISIONS.md` / `TESTCASES.md`、承認済み T1-1 `DESIGN.md`、
本書とする。本書は物理式、単位、数値域、近似、経験較正、許容差を変更しない。

T1-1 で実装するケースと exact path は次のとおりである。テスト対象はすべて
`../index` の公開 export から import し、module 内部 helper をオラクルとして使わない。

| ケース | exact test path |
|---|---|
| TC-NORM-001〜004 | `apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts` |
| TC-HEX-001〜008 | `apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts` |
| TC-RNG-001、TC-RNG-001-SENTINEL / NOISE / INVALID / PURE | `apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts` |
| TC-CREATE-001〜007、TC-RNG-002A | `apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts` |

T1-0 `TC-RNG-002B`（`step` 中の PRNG 非消費）と Reiter `step` は T1-2 の
`domain/__tests__/reiter-step.test.ts` の責務であり、T1-1 の import、Red、テスト数へ含めない。
同様に拡散、凍結、reservoir 更新、収支、形態指標、経験較正、c 軸厚みは対象外である。

## 2. 共通オラクル、比較方法、収集ゲート

### 2.1 独立オラクル

- 六角格子の期待値は本書の座標 literal、整数式
  `max(abs(q),abs(r),abs(q+r))`、固定差分
  `[(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)]` をテスト内へ直接書く。
  production の列挙、距離、index helper から期待値を生成しない。
- 座標変換の期待値は、基底ベクトル `(1,0)`、`(1/2,sqrt(3)/2)` から作るテスト側の
  2×2 行列と解析的逆行列で計算する。production の変換を往復の唯一のオラクルにしない。
- PRNG の期待値は 4.1 節の state/output literal と 19 出力 literal を使う。
  production の PRNG や `createLattice` から期待列を生成しない。
- noise の期待値は literal uint32 にテスト側で `2*(output/4294967296)-1` を左から順に
  適用する。production の `uint32ToNoise` は期待値生成に使わない。
- 配列、seed、metadata の再現性は同じ入力から独立に作った2結果を比較し、片方の返値を
  もう片方の期待値生成へ加工しない。

### 2.2 比較方法

座標の binary64 比較だけは、成分ごとに次を用いる。

```text
tauCoord(expected,actual)
  = 16 * Number.EPSILON * max(1,abs(expected),abs(actual))

pass iff abs(actual-expected) <= tauCoord(expected,actual)
```

条件正規化値とその逆算値は絶対誤差 `<=1e-12`。整数、順序、長さ、boolean、例外 class、
uint32、`ice`、`radius`、`stepIndex`、`stopped`、`beta`、`noiseAmplitude`、seed、
`modelVersion` は完全一致とする。binary64 の bit-for-bit 比較は `DataView` で各要素の
上位・下位 32 bit を比較し、scalar では `Object.is` も使って `+0` と `-0` を区別する。
noise、同一入力から作った `waterMass`、`elapsedCa` はこの bit 比較を使う。物理・観測上の
不確かさを数値実装の tolerance に加えない。

### 2.3 テスト収集ゲート

`apps/snow-crystal-sim/vite.config.ts` の `test.include` は、既存 glob を残して次の2本を
exact に含める。

```ts
include: [
  'tests/**/*.test.ts',
  'src/simulators/snow-crystal-sim/domain/__tests__/**/*.test.ts',
]
```

テストコード追加後、app workspace で1行目を、repository root で2行目を実行する。

```text
npm test -- --reporter=verbose src/simulators/snow-crystal-sim/domain/__tests__
node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim
```

`EVIDENCE.md` には4つの exact test path が reporter 出力へ列挙されたこと、各ファイルの
実行件数、合計実行件数が `>0` であることを記録する。`passWithNoTests: true` による0件成功、
対象ファイル名が出力にない成功、`module-not-found`、構文・型・依存エラーは期待する Red と
認めない。Red は対象公開 API が import 可能な状態で、本書の assertion が仕様との差を検出した
失敗でなければならない。

## 3. 条件正規化

### TC-NORM-001: 閉区間端点と中央

- **対象**: `normalizeConditions` / `conditions.test.ts`
- **入力 literal**:
  `[-30,0]`、`[-15,15]`、`[0,30]`。
- **独立オラクル**: `T=min(max(temperatureC,-30),0)`、
  `sigma=min(max(supersaturationPct,0),30)`、`x=(T+30)/30`、`y=sigma/30` を
  テスト内へ直接書く。
- **期待値**: 順に
  `{temperatureC:-30,supersaturationPct:0,x:0,y:0,clamped:false}`、
  `{temperatureC:-15,supersaturationPct:15,x:0.5,y:0.5,clamped:false}`、
  `{temperatureC:0,supersaturationPct:30,x:1,y:1,clamped:false}`。
- **tolerance**: 数値は絶対 `1e-12`、boolean は完全一致。
- **失敗意味**: 閉区間、温度符号、% 単位、または正規化軸の取り違え。

### TC-NORM-002: 端点直外と独立クランプ

- **対象**: `normalizeConditions` / `conditions.test.ts`
- **入力 literal と期待値**:
  - `[-30.000000000001,-1e-12]` → `[-30,0,0,0,true]`
  - `[1e-12,30.000000000001]` → `[0,30,1,1,true]`
  - `[-31,15]` → `[-30,15,0,0.5,true]`
  - `[-15,31]` → `[-15,30,0.5,1,true]`
  - `[-30,30]` → `[-30,30,0,1,false]`
- **独立オラクル**: 各軸へ 3.1 の clamp 式を独立適用する。
- **tolerance**: 数値は絶対 `1e-12`、boolean は完全一致。
- **失敗意味**: 一方の範囲外入力が他方を変える、端点ちょうどを clamp 扱いする、または外挿する。

### TC-NORM-003: 非有限値と型違いの拒否

- **対象**: `normalizeConditions` / `conditions.test.ts`
- **入力 literal**: 第1引数を `NaN`、`Infinity`、`-Infinity`、
  `'0' as unknown as number` とした各ケース（第2引数は `15`）。第2引数にも同じ4値を与える
  各ケース（第1引数は `-15`）。
- **独立オラクル**: `typeof value === "number" && Number.isFinite(value)` をテスト側で
  各引数へ適用し、clamp 式を評価する前に偽となることを確認する。
- **期待値**: 全ケースが同期的に `TypeError` を throw し、返値を公開しない。
- **tolerance**: 例外 class 完全一致。
- **失敗意味**: 非有限値や数値でない値を黙示変換・クランプして不正値を domain へ流した。

### TC-NORM-004: 決定性と入力不変

- **対象**: `normalizeConditions` / `conditions.test.ts`
- **入力 literal**: `temperatureC=-12.5`、`supersaturationPct=7.25` を2回。
- **独立オラクル**: 共有状態を使わない 3.1 の literal 四則演算結果と、呼出し前 snapshot。
- **期待値**: 2返値は値として完全に同じで、入力 scalar は不変。返値は
  `{temperatureC:-12.5,supersaturationPct:7.25,x:17.5/30,y:7.25/30,clamped:false}`。
- **tolerance**: `x`,`y` は絶対 `1e-12`、他は完全一致。
- **失敗意味**: 条件正規化が時刻、乱数、共有可変状態、または呼出し履歴へ依存する。

## 4. xoshiro128** version 1.1

### 4.1 固定 literal

先頭5遷移は次の表をそのままテストへ転記する。

| state | output | nextState |
|---|---:|---|
| `[1,2,3,4]` | `11520` | `[7,0,1026,12288]` |
| `[7,0,1026,12288]` | `0` | `[12295,1029,1029,25165824]` |
| `[12295,1029,1029,25165824]` | `5927040` | `[25179138,12295,540162,2107404]` |
| `[25179138,12295,540162,2107404]` | `70819200` | `[27274249,25704967,31982592,12605441]` |
| `[27274249,25704967,31982592,12605441]` | `2031721883` | `[15224335,29364750,272377353,1125134346]` |

初期 state `[1,2,3,4]` から連続19回の output は次の literal とする。

```text
[
  11520, 0, 5927040, 70819200, 2031721883,
  1637235492, 1287239034, 3734860849, 3729100597, 4258142804,
  337829053, 2142557243, 3576906021, 2006103318, 3870238204,
  1001584594, 3804789018, 2299676403, 3571406116,
]
```

19番目を消費した直後の state は
`[2456999277,4279822836,334074982,4097125698]` である。

### TC-RNG-001: 先頭5既知ベクトル

- **対象**: `nextXoshiro128ss` / `prng.test.ts`
- **入力**: 4.1 の5つの state を、それぞれ独立に1回だけ渡す。
- **独立オラクル**: 4.1 の literal 表。テストで別 state の production 出力を期待値へ使わない。
- **期待値**: output と nextState が各行へ完全一致し、すべて uint32 整数。
- **tolerance**: 完全一致。
- **失敗意味**: version 1.0 の `s[0]` scrambler、`Math.imul`、回転、状態遷移、unsigned 化の誤り。

### TC-RNG-001-SENTINEL: 19回消費 sentinel

- **対象**: `nextXoshiro128ss` / `prng.test.ts`
- **入力**: `[1,2,3,4]` から戻り state を次入力にして19回呼ぶ。
- **独立オラクル**: 4.1 の19 output literal と最終 state literal。
- **期待値**: 各回の output が配列の同じ index に完全一致。19番目は `3571406116`、
  消費後 state は `[2456999277,4279822836,334074982,4097125698]`。
- **tolerance**: 完全一致。
- **失敗意味**: 一部遷移だけの誤り、消費回数ずれ、または signed 32-bit 値の流出。

### TC-RNG-001-NOISE: uint32 から基底 noise への写像

- **対象**: `uint32ToNoise` / `prng.test.ts`
- **入力 literal と期待値**:
  - `0` → `-1`
  - `11520` → `-0.9999946355819702`
  - `2147483648` → `+0`
  - `4294967295` → `0.9999999995343387`
- **独立オラクル**: 各 literal へ `2*(output/4294967296)-1` を評価順どおり適用する。
- **期待値**: 上記の binary64 bit pattern と一致し、すべて有限かつ `-1<=noise<1`。
- **tolerance**: `DataView` と `Object.is` による bit-for-bit。`2147483648` は `+0`。
- **失敗意味**: 除数 `2^32-1`、端点補正、異なる演算順、または別分布を用いた。

### TC-RNG-001-INVALID: seed の境界、形、例外 class と検証順

- **対象**: `nextXoshiro128ss` / `prng.test.ts`
- **有効入力 literal**: `[0,0,0,1]`、
  `[4294967295,4294967295,4294967295,4294967295]`、`[-0,0,0,1]`。
- **TypeError 入力**: `[]`、`[1,2,3]`、`[1,2,3,4,5]`、
  `new Uint32Array([1,2,3,4]) as unknown as Seed128`、各 index を個別に `NaN`、
  `Infinity`、`-Infinity`、`'1' as unknown as number` とした長さ4の Array。
- **RangeError 入力**: `[0,0,0,0]`、各 index を個別に `-1`、`0.5`、
  `4294967296` とした長さ4の Array。
- **検証順 literal**: `[-1,NaN,0,1]` は index 0 の `RangeError`、
  `[1,-1,NaN,1]` は index 1 の `RangeError`、`[1,2,-1,NaN]` は index 2 の
  `RangeError`。各ケースで後方の `TypeError` より先に先頭側の有限範囲違反を検出する。
- **独立オラクル**: Array/長さ判定、index 0→3 の
  `typeof` / `Number.isFinite` / `Number.isInteger` / uint32 閉区間判定、最後の all-zero 判定を
  テスト table の順序として直接持つ。
- **期待値**: 有効入力の output/state は uint32。無効入力は記載 class を同期 throw。
  `[-0,0,0,1]` の呼出し後も元配列の第0要素は `Object.is(value,-0)` で真。
- **tolerance**: 型、例外 class、入力 bit pattern は完全一致。
- **失敗意味**: seed の形、uint32 閉区間、all-zero 禁止、または入力不変契約の破壊。

### TC-RNG-001-PURE: `uint32ToNoise` の異常入力と純粋性

- **対象**: `uint32ToNoise`、`nextXoshiro128ss` / `prng.test.ts`
- **入力 literal**: `uint32ToNoise` へ `NaN`、`Infinity`、`-Infinity`、
  `'1' as unknown as number`、`-1`、`0.5`、`4294967296`。有効値 `3571406116` は2回。
  凍結した入力 Array `[1,2,3,4]` も `nextXoshiro128ss` へ2回渡す。
- **独立オラクル**: uint32 の型・有限性・整数・閉区間をテスト側 predicate で判定し、
  有効値は literal 式、PRNG は4.1の該当 literal、入力不変は呼出し前 snapshot と比較する。
- **期待値**: 非有限・型違いは `TypeError`、有限範囲違反・非整数は `RangeError`。
  有効値の2結果は bit-for-bit 一致。PRNG の2結果は値として完全一致し、入力 Array は完全不変。
  返値どうしの参照 identity は判定対象にしない。
- **tolerance**: bit-for-bit / 完全一致。
- **失敗意味**: 検証不足、入力 state の in-place 更新、または共有可変 PRNG state への依存。

## 5. 六角格子と座標変換

### 5.1 半径2の固定座標列

次の19要素を exact order の test literal とする。

```text
[
  {q: 0,r:-2}, {q: 1,r:-2}, {q: 2,r:-2},
  {q:-1,r:-1}, {q: 0,r:-1}, {q: 1,r:-1}, {q: 2,r:-1},
  {q:-2,r: 0}, {q:-1,r: 0}, {q: 0,r: 0}, {q: 1,r: 0}, {q: 2,r: 0},
  {q:-2,r: 1}, {q:-1,r: 1}, {q: 0,r: 1}, {q: 1,r: 1},
  {q:-2,r: 2}, {q:-1,r: 2}, {q: 0,r: 2},
]
```

中心 `(0,0)` の index は `9`。`h=2` の index は
`[0,1,2,3,6,7,11,12,15,16,17,18]`、`h<=1` の index は
`[4,5,8,9,10,13,14]` である。

### TC-HEX-001: 距離、近傍順、重複なし

- **対象**: `hexRadius`、`axialNeighbors` / `hex-lattice.test.ts`
- **入力 literal**: `(0,0)`、`(2,-1)`、`(-2,1)`。中心の近傍。
- **独立オラクル**: `h=max(abs(q),abs(r),abs(q+r))` と固定差分6個。
- **期待値**: 半径は順に `0,2,2`。中心近傍は順に
  `[{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:0},{q:-1,r:1},{q:0,r:1}]`。
  6要素は重複せず、すべて `hexRadius=1`。
- **tolerance**: 整数、順序、座標は完全一致。
- **失敗意味**: axial/cube 規約、近傍接続、または将来の走査順を破壊した。

### TC-HEX-002: 座標基底と解析的逆変換

- **対象**: `axialToCartesian`、`cartesianToAxial` / `hex-lattice.test.ts`
- **入力 literal と期待値**:
  - `(q,r)=(1,0)` → `(x,z)=(1,0)`
  - `(q,r)=(0,1)` → `(x,z)=(0.5,sqrt(3)/2)`
  - `(q,r)=(2,-1)` → `(x,z)=(1.5,-sqrt(3)/2)` → `(q,r)=(2,-1)`
  - `(x,z)=(0.75,sqrt(3)/2)` → `(q,r)=(0.25,1)`。丸めないことも検査する。
- **独立オラクル**: テスト内の基底行列
  `[[1,1/2],[0,sqrt(3)/2]]` と逆行列を直接評価する。
- **期待値**: 上記値へ規模比例 tolerance 内で一致し、全成分は有限。
- **tolerance**: `tauCoord`。
- **失敗意味**: XZ の向き、セル間隔、基底、逆行列、または fractional axial の不正な丸め。

### TC-HEX-003: 半径2の全格子、ring、成長領域

- **対象**: `latticeCellCount`、`enumerateAxial` / `hex-lattice.test.ts`
- **入力 literal**: `radius=2`。
- **独立オラクル**: 5.1 の19座標、ring index、成長領域 index の literal。
- **期待値**: `latticeCellCount(2)===19`、列挙結果は19座標と順序を含め完全一致。
  テスト側の整数 `h` 式で `h=2` は12セル、`h<=1` は7セル。全6方向を含み、
  60° sector の複製結果ではない。
- **tolerance**: 完全一致。
- **失敗意味**: セル欠落、境界誤分類、sector 化、または PRNG 消費順の前提を破壊した。

### TC-HEX-004: index 対応と格子外 `null`

- **対象**: `axialIndex`、`axialAtIndex` / `hex-lattice.test.ts`
- **入力 literal**: `radius=2`、5.1 の全 `(index,q,r)`。格子外の有効 axial
  `(3,0)`、`(0,-3)`、`(-3,3)`。
- **独立オラクル**: 期待 index は5.1 の Array position。production の列挙 helper を使わない。
- **期待値**: 全19要素で `axialIndex(2,q,r)===index` かつ
  `axialAtIndex(2,index)==={q,r}`。格子外3座標は `null` で、丸め・wrap しない。
- **tolerance**: 完全一致。
- **失敗意味**: row offset、q 範囲、列挙順、または有限境界処理の不一致。

### TC-HEX-005: 一般式、ring 式、変換不変性

- **対象**: 全 hex API / `hex-lattice.test.ts`
- **入力 literal**: `radius=3`、座標 `(-4,2)`、平行移動 `(7,-3)`。
- **独立オラクル**: `N=1+3R(R+1)` より `N(3)=37`、ring は `6R=18`。
  固定差分を元座標と平行移動後座標へ直接加える。
- **期待値**: 列挙37セル、テスト側 `h=3` の数18。全37 index で
  `axialIndex` と `axialAtIndex` が厳密な逆。元と移動後の各近傍差分は同じ順で完全一致。
  各近傍 `n` は `abs(hexRadius(n)-hexRadius(center))<=1`。
- **tolerance**: 完全一致。
- **失敗意味**: 半径2だけへの hard-code、近傍の位置依存、または index 逆写像の不整合。

### TC-HEX-006: safe-neighbor 最大境界と大規模往復

- **対象**: `hexRadius`、`axialNeighbors`、`axialToCartesian`、
  `cartesianToAxial` / `hex-lattice.test.ts`
- **入力 literal**: `M=9007199254740991`、`(M-1,0)`、
  `(24149949,-48187277)`。
- **独立オラクル**: 固定差分を `(M-1,0)` へ直接加え、各近傍の `q`,`r`,`q+r` に
  `Number.isSafeInteger` を適用する。変換はテスト側行列・逆行列を使う。
- **期待値**: `(M-1,0)` は受理され、6近傍すべての3整数が safe integer。
  axial→Cartesian は有限で、逆変換は `tauCoord` 内。
  `(24149949,-48187277)` も往復が `tauCoord` 内である。後者は固定絶対 `1e-12` を要求しない。
- **tolerance**: safe integer 判定は完全一致、座標は `tauCoord`。
- **失敗意味**: safe-neighbor 域を狭める/広げる、規模非依存 tolerance を使う、または
  有効な大規模座標を不当に拒否した。

### TC-HEX-007: 座標・変換の異常入力、overflow、検証順

- **対象**: `hexRadius`、`axialNeighbors`、`axialToCartesian`、
  `cartesianToAxial` / `hex-lattice.test.ts`
- **TypeError literal**:
  - axial API の `q` または `r` を個別に `NaN`、`Infinity`、`-Infinity`、
    `'1' as unknown as number`
  - Cartesian API の `x` または `z` を個別に同じ4値
- **RangeError literal**:
  - axial API の `q` または `r` を個別に `0.5`、`M`、`M+1` とする
  - `q=M-1,r=1`（`q+r=M` となり safe-neighbor 域外）
  - `cartesianToAxial(Number.MAX_VALUE,Number.MAX_VALUE)`
  - `cartesianToAxial(Number.MAX_VALUE,Number.MAX_VALUE/4)`。テスト側の独立逆行列で
    `q=1.5382184810290406e+308`、`r=5.189493076665501e+307` がともに有限である一方、
    `q+r===Infinity` となることを個別に確認してから、公開 API の `RangeError` を要求する
- **検証順 literal**: axial API へ `(q,r)=(0.5,NaN)` は、先に q を検証して
  `RangeError`。`(NaN,0.5)` は `TypeError`。Cartesian API は
  `(Number.MAX_VALUE,NaN)` を入力検証の `TypeError` とし、変換 overflow より先に z を拒否する。
- **独立オラクル**: `typeof`、有限性、safe integer、`h<=M-1` をテスト側で順に判定し、
  Cartesian overflow は独立逆行列 `r=2*z/sqrt(3)`, `q=x-r/2` を直接評価する。
  極大2入力の一方では `r` 自体の非有限性を、`z=Number.MAX_VALUE/4` の入力では
  `q` と `r` の有限性および `q+r` だけの非有限性を production の変換関数を使わず確認する。
- **期待値**: 記載 class を同期 throwし、非有限・部分返値を公開しない。特に `(M,0)` は
  `RangeError`、極大 Cartesian は有限入力でも変換結果 overflow の `RangeError`。
- **tolerance**: 例外 class 完全一致。
- **失敗意味**: 型と範囲の混同、q/x→r/z の検証順違反、unsafe 近傍、または NaN/Infinity 流出。

### TC-HEX-008: radius、index、セル数 overflow と入力不変

- **対象**: `latticeCellCount`、`enumerateAxial`、`axialIndex`、
  `axialAtIndex` / `hex-lattice.test.ts`
- **有効 literal**:
  - `latticeCellCount(2)===19`
  - `latticeCellCount(115)===40021`
  - `latticeCellCount(54794157)===9007199088404419`
- **radius TypeError**: `NaN`、`Infinity`、`-Infinity`、
  `'2' as unknown as number`。
- **radius RangeError**: `1`、`2.5`、`Number.MAX_SAFE_INTEGER+1`、
  `54794158`。最後の数学的 `N=9007199417169367` は `M` を超え、binary64 式評価値も
  `9007199417169368` となって safe integer でない。
- **index RangeError**: `axialAtIndex(2,-1)`、`(2,19)`、`(2,0.5)`、
  `(2,Number.MAX_SAFE_INTEGER+1)`。
- **index TypeError**: `axialAtIndex(2,index)` の `index` を `NaN`、`Infinity`、`-Infinity`、
  `'0' as unknown as number` とする。
- **axialIndex の q/r 異常 literal**:
  - 有効な `radius=2,q=0` に対し `r` を `NaN`、`Infinity`、`-Infinity`、
    `'0' as unknown as number` とすると `TypeError`、`r=0.5` とすると `RangeError`
  - safe-neighbor 域の直外を各成分について分離し、`(q,r)=(M,0)`、`(0,M)`、
    `(M-1,1)` をそれぞれ q、r、q+r の境界違反として `RangeError` とする
- **検証順 literal**:
  - `axialIndex(NaN,0.5,0)` → radius の `TypeError`
  - `axialIndex(1,NaN,0)` → radius の `RangeError`
  - `axialIndex(2,NaN,0.5)` → q の `TypeError`
  - `axialIndex(2,0.5,NaN)` → q の `RangeError`
  - `axialAtIndex(NaN,0.5)` → radius の `TypeError`
  - `axialAtIndex(1,NaN)` → radius の `RangeError`
  - `axialAtIndex(2,NaN)` → index の `TypeError`
- **固定検証順**: `latticeCellCount` / `enumerateAxial` は radius、`axialIndex` は
  `radius → q → r`、`axialAtIndex` は `radius → index` の順に検証する。複合異常 literal は、
  後続引数の class に左右されず先頭の違反に対応する例外 class を要求する。
- **純粋性入力**: `enumerateAxial(2)` を2回呼び、1回目の返値を snapshot 後に2回目を呼ぶ。
- **独立オラクル**: セル数は整数式を BigInt でも評価し、radius/index の型・範囲判定は
  production helper と独立な test table、列挙値は5.1の literal を使う。
- **期待値**: 記載値・例外 class が一致。2回の列挙値は同一で、後続呼出しは過去の返値を
  変更しない。返値どうしの参照 identity は判定対象にしない。
- **tolerance**: 完全一致。
- **失敗意味**: 安全整数でないセル数、固定の恣意的 radius 上限、検証順、index wrap、
  または共有可変列挙結果の利用。

## 6. `createLattice` と決定性

### TC-CREATE-001: 半径2の初期 state とモデル版定数

- **対象**: `MODEL_VERSION`、`createLattice` / `lattice.test.ts`
- **入力 literal**:
  `{radius:2,seed:[1,2,3,4],beta:0.2,noiseAmplitude:0.3}`。
- **独立オラクル**: 5.1 の19座標と中心 index `9`。初期値は上位設計 literal。
- **期待値**:
  - `waterMass` は長さ19の `Float64Array`、`ice` は長さ19の `Uint8Array`、
    `noise` は長さ19の `Float64Array`
  - index 9 だけ `waterMass[9]===1`、`ice[9]===1`
  - 他18 index は `waterMass[i]===0.2`、`ice[i]===0`。ring 12セルも `0.2/0`
  - `radius===2`、`stepIndex===0`、`elapsedCa` は `Object.is(value,+0)`、
    `stopped===false`、`beta===0.2`、`noiseAmplitude===0.3`
  - 保存 seed は値 `[1,2,3,4]` だが入力とは別参照
  - 公開定数 `MODEL_VERSION === "reiter-alpha1-xoshiro128ss-1.1-v1"` を literal と直接比較する
  - `state.modelVersion === "reiter-alpha1-xoshiro128ss-1.1-v1"` かつ
    `state.modelVersion === MODEL_VERSION`
  - noise 全要素が有限で `-1<=value<1`
- **tolerance**: scalar、型、長さ、metadata は完全一致。配列初期値は bit-for-bit。
- **失敗意味**: 中心、配列表現、初期 metadata、モデル版、または reservoir 初期化の不一致。

### TC-RNG-002A: 列挙順、1セル1出力、noise、同 seed 決定性

- **対象**: `createLattice` / `lattice.test.ts`
- **入力 literal**: TC-CREATE-001 と同じ入力を2回。seed だけ `[1,2,3,5]` に変えた入力を1回。
- **独立オラクル**: 5.1 の19 index と 4.1 の19 output literal。各 index `i` の期待 noise は
  `2*(outputs[i]/4294967296)-1`。先頭は `-0.9999946355819702`、2番目は `-1`、
  19番目は `0.6630655694752932`。PRNG spy は消費回数オラクルにしない。
- **期待値**:
  - 19個の期待 noise が同じ index に bit-for-bit 一致し、中心 index 9 と ring を含め
    全セルが列挙順に1出力ずつ消費したことを同定できる
  - 同一入力2結果の `waterMass`、`ice`、`noise` 全要素、全 metadata、seed、モデル版が
    bit-for-bit / 完全一致
  - seed `[1,2,3,5]` の noise は少なくとも1要素が基準と異なる
  - 保存 seed は noise 生成後 state でなく、各入力の初期 seed
- **tolerance**: 全比較 bit-for-bit / 完全一致。
- **失敗意味**: 座標列挙・消費回数のずれ、global random、seed 無視、noise 再変換、
  または版識別不足。

### TC-CREATE-002: beta と noiseAmplitude の閉区間

- **対象**: `createLattice` / `lattice.test.ts`
- **入力 literal**: 共通 `radius=2,seed=[1,2,3,4]` で
  `(beta,noiseAmplitude)=(0,0),(0.95,1)`。
- **独立オラクル**: 閉区間 `[0,0.95]`、`[0,1]` と TC-CREATE-001 の初期化 literal。
- **期待値**: 両入力を受理し、中心以外の `waterMass` はそれぞれ `0` / `0.95`。
  metadata は入力端点と完全一致する一方、基底 noise 配列は両結果で bit-for-bit 同じ。
- **tolerance**: bit-for-bit / 完全一致。
- **失敗意味**: 閉区間端点の拒否、または `noiseAmplitude` による基底 noise の再スケール。

### TC-CREATE-003: radius と配列確保境界

- **対象**: `createLattice` / `lattice.test.ts`
- **入力 literal**: 有効最小 `radius=2`。不正 radius は `1`、`2.5`、`NaN`、
  `Infinity`、`-Infinity`、`54794158`。配列確保不能確認は
  `radius=54794157,seed=[1,2,3,4],beta=0.2,noiseAmplitude=0.3`。
- **独立オラクル**: 5.8 の `N(R)` literal。`54794158` の数学的なセル数は
  `9007199417169367 > Number.MAX_SAFE_INTEGER`（binary64 の式評価値は丸められて
  `9007199417169368`）であり、safe integer でない。
  `54794157` の `N=9007199088404419` は safe integer だが ECMAScript typed array として
  実メモリ確保不能な大きさである。
- **期待値**: `radius=2` は成功。非有限は `TypeError`、有限範囲・整数・セル数違反は
  `RangeError`。確保不能ケースは実行環境の `RangeError` を同期的にそのまま返し、state を返さない。
- **tolerance**: 例外 class 完全一致。
- **失敗意味**: radius 検証漏れ、安全でないセル数演算、部分 state 公開、または確保失敗の握り潰し。

### TC-CREATE-004: seed 形・成分・正規化

- **対象**: `createLattice` / `lattice.test.ts`
- **有効入力 literal**: seed `[0,0,0,1]`、
  `[4294967295,4294967295,4294967295,4294967295]`、`[-0,0,0,1]`。
- **無効入力**: TC-RNG-001-INVALID と同じ形違い、各 index の非有限/型違い、
  非整数/範囲外、all-zero。
- **独立オラクル**: TC-RNG-001-INVALID のテスト table と、入力 seed の呼出し前 bit snapshot。
- **期待値**: 有効 seed を受理し、保存 seed は新しい tuple。`[-0,0,0,1]` の保存値第0要素は
  `Object.is(value,+0)`、入力第0要素は呼出し後も `Object.is(value,-0)`。
  無効入力は TC-RNG-001-INVALID と同じ `TypeError` / `RangeError`。
- **tolerance**: seed bit pattern、参照非共有、例外 class は完全一致。
- **失敗意味**: uint32 正規化、入力不変、初期 seed 保存、または例外分類の不一致。

### TC-CREATE-005: beta / noiseAmplitude の異常入力

- **対象**: `createLattice` / `lattice.test.ts`
- **入力 literal**: 共通の有効 radius/seed に対し、beta を `-1e-12`、
  `0.950000000001`、`0.5`、`NaN`、`Infinity`、`-Infinity`、
  `'0.2' as unknown as number`。ここで `0.5` は有効対照。
  noiseAmplitude を `-1e-12`、`1.000000000001`、`0.5`、`NaN`、`Infinity`、
  `-Infinity`、`'0.3' as unknown as number`。ここでも `0.5` は有効対照。
- **独立オラクル**: テスト側で型・有限性を先に、次に literal 閉区間
  `0<=beta<=0.95` / `0<=noiseAmplitude<=1` を判定する。
- **期待値**: 有効対照は成功。有限範囲外は `RangeError`、非有限・型違いは `TypeError`。
- **tolerance**: 例外 class 完全一致。
- **失敗意味**: 有効範囲の拡張、黙示クランプ、または非有限 metadata の公開。

### TC-CREATE-006: 検証順

- **対象**: `createLattice` / `lattice.test.ts`
- **入力 literal と期待 class**:
  - `radius=NaN, seed=[-1,0,0,1]` → radius の `TypeError`
  - `radius=1, seed=[NaN,0,0,1]` → radius の `RangeError`
  - seed `[-1,NaN,0,1]` → index 0 の `RangeError`
  - seed `[1,-1,NaN,1]` → index 1 の `RangeError`
  - seed `[1,2,-1,NaN]` → index 2 の `RangeError`
  - seed `[1,2,3,-1]`, `beta=NaN` → index 3 の `RangeError`
  - seed `[0,0,0,0]`, `beta=NaN` → all-zero の `RangeError`
  - 有効 seed、`beta=NaN,noiseAmplitude=-1` → beta の `TypeError`
  - 有効 seed、`beta=-1,noiseAmplitude=NaN` → beta の `RangeError`
  - 有効 seed/beta、`noiseAmplitude=NaN` → noiseAmplitude の `TypeError`
  - `radius=54794157,seed=[1,2,3,4],beta=0.2,noiseAmplitude=NaN` →
    noiseAmplitude の `TypeError`。セル数は safe integer だが確保不能な大きさであり、
    配列確保由来の `RangeError` より前に全入力検証を終えることをこの例外 class で拘束する
- **独立オラクル**: T1-1 DESIGN 8 の固定順
  `radius → seed[0..3] → all-zero → beta → noiseAmplitude`。
- **期待値**: 最初の違反に対応する class を同期 throwし、配列確保や返値公開へ進まない。
  特に巨大な有効 radius と不正 noiseAmplitude の複合入力は、確保を試みず同期 `TypeError` とする。
- **tolerance**: 例外 class 完全一致。
- **失敗意味**: 観測可能な検証順が設計と異なり、異常入力の診断や巨大配列防御を壊した。

### TC-CREATE-007: 入力不変、所有権、呼出し履歴からの独立

- **対象**: `createLattice` / `lattice.test.ts`
- **入力 literal**: seed Array と input object をそれぞれ `Object.freeze` した
  `{radius:2,seed:[1,2,3,4],beta:0.2,noiseAmplitude:0.3}` を3回。
- **手順**: 結果 A/B を作り、A の3 typed array を変更する。その後結果 C を同じ frozen 入力から作る。
- **独立オラクル**: frozen 入力の呼出し前 snapshot、A/B/C の参照比較、4.1/5.1/TC-CREATE-001
  の literal expected state を使う。
- **期待値**: 呼出しで入力 object/seed は変化しない。A/B/C の各 typed array と seed は
  互いに別参照。A の変更は B と C を変えず、B と C は TC-CREATE-001 / TC-RNG-002A の
  全 bit pattern と一致する。不正入力を1回 throwさせた後の有効呼出しも C と一致する。
- **tolerance**: bit-for-bit / 完全一致。
- **失敗意味**: 入力・返値の alias、module-level 可変 state、または失敗呼出しの副作用。

## 7. 公開面と完了判定

4つのテストファイルは `domain/index.ts` から次を明示 import し、公開面に存在することを
TypeScript コンパイルでも確認する。

```text
MODEL_VERSION, normalizeConditions,
hexRadius, axialNeighbors, axialToCartesian, cartesianToAxial,
latticeCellCount, enumerateAxial, axialIndex, axialAtIndex,
nextXoshiro128ss, uint32ToNoise, createLattice
```

型 import は `ModelVersion`、`Seed128`、`AxialCoord`、`CartesianXZ`、
`NormalizedConditions`、`CreateLatticeInput`、`LatticeState`、`Xoshiro128ssResult` を対象とする。
domain 外依存、browser global、`Math.random`、他 simulator、`app/ui/scene` import の不存在は、
unit test だけで推測せず repository の architecture check と実装レビューでも確認する。

T1-1 のテストケース工程が完了する条件は次のすべてである。

1. TC-NORM、TC-HEX、TC-RNG-001、TC-RNG-002A、TC-CREATE と本書で追加した境界・異常・純粋性を
   exact path のテストへ実装する。
2. 例外 class と、class が区別可能な複合異常入力で固定検証順を確認する。
3. 半径2の19座標・19 PRNG output を literal にし、同 seed の全 state を bit-for-bit 比較する。
4. 規模比例 `16 eps`、safe-neighbor 最大境界、セル数 overflow、変換 overflow を緩和しない。
5. reporter で4ファイルと合計 `>0` テストを確認し、baseline、期待する Red、Green、最終検証を
   `EVIDENCE.md` へ記録する。
6. T1-2 の `TC-RNG-002B` または `step` を T1-1 のテストや Red に含めない。

上位成果物と矛盾する未決事項はない。
