# T1-1 六角格子・型・座標変換 設計

## 1. 目的と権威

本タスクは、後続の Reiter CA が共有する domain 層の語彙、六角格子の格納順、座標変換、
決定的 PRNG、初期状態生成を実装可能な公開契約へ落とす。対象は T1-0 の
`TC-NORM`、`TC-HEX`、`TC-RNG-001`、`TC-RNG-002A`、`TC-CREATE` であり、成長則、収支、
形態写像、描画は扱わない。`step` が PRNG を消費しないことは T1-0
`TC-RNG-002B` として T1-2 の `domain/__tests__/reiter-step.test.ts` で検査する。

権威の順序は `SPEC.md`、`DESIGN-OUTLINE.md`、承認済み T1-0 `DESIGN.md` / `DECISIONS.md` /
`TESTCASES.md`、本書とする。本書は上位契約を変更せず、型と API の未展開部分だけを固定する。
実行プロファイルは `full`、UI 影響はなし、実装変更境界は
`apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/` と、その配下のテストを収集するための
`apps/snow-crystal-sim/vite.config.ts` である。他層は変更しない。

## 2. 出典、単位、適用範囲

### 2.1 出典

- 六角最近傍 CA と基底面モデルは C. A. Reiter, “A Local Cellular Model for Snow Crystal
  Growth,” *Chaos, Solitons & Fractals* 23(4), 1111–1119 (2005),
  [DOI 10.1016/j.chaos.2004.06.071](https://doi.org/10.1016/j.chaos.2004.06.071)、
  [May 2004 author preprint](https://webbox.lafayette.edu/~reiterc/mvp/sfn/sfn_pp.pdf)
  pp. 4–7 を正とする。
- PRNG は D. Blackman, S. Vigna, “Scrambled Linear Pseudorandom Number Generators,”
  *ACM TOMS* 47(4), Article 36 (2021),
  [DOI 10.1145/3460772](https://doi.org/10.1145/3460772)、および作者参照実装
  [`xoshiro128starstar.c`](https://prng.di.unimi.it/xoshiro128starstar.c) の
  **version 1.1** を正とする。旧 version 1.0 は対象外である。
- 過飽和度の定義と製品入力範囲は上位 T1-0 設計 S2 を正とする。本タスクは物理量から CA
  パラメータへの写像を追加しない。

### 2.2 座標、向き、単位

- 基底面は XZ 平面、c 軸は +Y。axial 座標は整数 `(q,r)`、対応する cube 座標は
  `(q,-q-r,r)` とする。
- XZ の長さ単位は最近傍セル中心間隔 1 cell。`q` 基底は `(x,z)=(1,0)`、`r` 基底は
  `(1/2,sqrt(3)/2)`。したがってセル中心を結ぶ 6 方向は 60° 間隔である。
- この縮尺では正六角セルの辺長は `1/sqrt(3)` cell、面積は `sqrt(3)/2` cell² となり、
  T1-0 の形態指標の縮尺と一致する。
- 格子半径 `radius` は cell 単位の非負距離ではなく、本タスクでは 2 以上の整数である。
  production 形態の妥当性を主張する半径 115 と、小半径の局所テストという上位の区別は変えない。

### 2.3 数値上の範囲と近似

座標式は実数上では互いに厳密な逆変換だが、実装は IEEE 754 binary64 なので `sqrt(3)` を含む
XZ 値は丸められる。`M=Number.MAX_SAFE_INTEGER`、`eps=Number.EPSILON` とする。
公開 axial API の座標数値域は、任意の小さな上限ではなく全 6 近傍の安全整数性から導く
`max(abs(q),abs(r),abs(q+r)) <= M-1` とする。座標変換は返値の全成分が有限であることも
検査する。

往復誤差は成分ごとに、参照値 `expected` と観測値 `actual` に対して
`abs(actual-expected) <= 16*eps*max(1,abs(expected),abs(actual))` と判定する。これは固定絶対誤差ではなく、
加減算、`sqrt(3)` による乗除算、逆変換の丸めが積み上がる有限な演算列に対する 16 eps の
規模比例許容差である。整数の axial 座標、index、セル数、近傍順、uint32、typed array の
要素型は許容差なしで判定する。

本タスクの格子は二次元基底面の離散表現であり、物理距離、物理時間、kg、結晶の c 軸厚みを
表さない。xoshiro128** は再現可能なゆらぎ生成用であり、暗号用途には使用しない。

## 3. 公開型

`domain/types.ts` は次を export する。TypeScript の `number` を用いる値には、下記の実行時検証も
必須とする。

```ts
export const MODEL_VERSION = "reiter-alpha1-xoshiro128ss-1.1-v1" as const
export type ModelVersion = typeof MODEL_VERSION

// 各成分は 0 以上 2^32-1 以下の整数。4 成分すべて 0 は不可。
export type Seed128 = readonly [number, number, number, number]

export interface AxialCoord {
  readonly q: number
  readonly r: number
}

export interface CartesianXZ {
  readonly x: number
  readonly z: number
}

export interface NormalizedConditions {
  readonly temperatureC: number
  readonly supersaturationPct: number
  readonly x: number
  readonly y: number
  readonly clamped: boolean
}

export interface CreateLatticeInput {
  readonly radius: number
  readonly seed: Seed128
  readonly beta: number
  readonly noiseAmplitude: number
}

export interface LatticeState {
  readonly radius: number
  readonly waterMass: Float64Array
  readonly ice: Uint8Array
  readonly noise: Float64Array
  readonly stepIndex: number
  readonly elapsedCa: number
  readonly stopped: boolean
  readonly beta: number
  readonly noiseAmplitude: number
  readonly seed: Seed128
  readonly modelVersion: ModelVersion
}

export interface Xoshiro128ssResult {
  readonly output: number
  readonly state: Seed128
}
```

`readonly` は参照の再代入を禁じる型契約である。typed array 自体は JavaScript 上で変更可能なため、
全 domain 関数は入力配列を書き換えないことを別の実行時契約とする。`createLattice` は呼出しごとに
新しい配列と新しい seed tuple を所有して返し、入力 seed との参照共有をしない。

`LatticeState.seed` は **初期 seed** の正規化済みコピーであり、noise 生成後の内部 PRNG state
ではない。PRNG は初期化中の局所変数だけで進め、全セルの noise を生成した後に破棄する。
`step` が乱数を消費しないという上位契約はこの表現で維持するが、本タスクに `step` API は
存在しないため、その検査は T1-2 の `TC-RNG-002B` へ移管する。

## 4. 六角格子 API

`domain/hex-lattice.ts` は次の純粋関数を export する。

```ts
export function hexRadius(q: number, r: number): number
export function axialNeighbors(q: number, r: number): readonly [
  AxialCoord, AxialCoord, AxialCoord,
  AxialCoord, AxialCoord, AxialCoord,
]
export function axialToCartesian(q: number, r: number): CartesianXZ
export function cartesianToAxial(x: number, z: number): AxialCoord
export function latticeCellCount(radius: number): number
export function enumerateAxial(radius: number): readonly AxialCoord[]
export function axialIndex(radius: number, q: number, r: number): number | null
export function axialAtIndex(radius: number, index: number): AxialCoord
```

### 4.1 距離と近傍順

中心からの六角距離は次の整数式に固定する。

```text
h(q,r) = max(abs(q), abs(r), abs(q+r))
```

`axialNeighbors(q,r)` は、入力へ次の差分を **この順** に加えた 6 要素 tuple を返す。

```text
0: (+1,  0)
1: (+1, -1)
2: ( 0, -1)
3: (-1,  0)
4: (-1, +1)
5: ( 0, +1)
```

入力が 2.3 節の safe-neighbor 域内なので、返す 6 近傍の `q`、`r`、`q+r` はすべて
safe integer である。例えば `(M-1,0)` は有効で `(+1,0)` 方向の `q=M` も安全だが、
`(M,0)` はその近傍が unsafe になるため入力時に `RangeError` とする。

近傍は半径で切り落とさない。有限格子内かどうかは、呼出し側が `axialIndex(...) !== null` で
判定する。この順は T1-0 の独立オラクル、将来の近傍走査、60° 回転
`Rot60(q,r)=(-r,q+r)` の共変性の基準であり、モデル版を変えずに変更してはならない。

### 4.2 axial と XZ の変換

```text
axialToCartesian:
  x = q + r/2
  z = sqrt(3) r/2

cartesianToAxial:
  r = 2z/sqrt(3)
  q = x - r/2
```

`axialToCartesian` は両成分を計算後に有限検査し、非有限の返値を公開しない。
`cartesianToAxial` は `r=z/(sqrt(3)/2)`、`q=x-r/2` の順に評価し、`q`、`r`、`q+r` の
いずれかが非有限なら `RangeError` として返値を公開しない。これにより有限であっても変換で
overflow する極大 Cartesian 入力を明示的に拒否する。`cartesianToAxial` は最寄りセルへ丸めず、
fractional axial 座標を返す。格子 index に使う前の
丸め方は UI/scene 側の用途と受入条件が確定していないため、本タスクでは公開しない。
整数セル中心を `axialToCartesian` してから逆変換した結果は、元の `(q,r)` へ 2.3 節の
規模比例許容差以内で戻る。有効な Cartesian 座標を axial へ変換し、同じ式をテスト側の
独立行列演算で XZ へ戻す場合も同じ許容差とする。

### 4.3 格子集合と列挙順

半径 `R` の格子集合は `H_R={(q,r) | h(q,r)<=R}`。各行 `r=-R..R` について、

```text
qMin(r) = max(-R, -r-R)
qMax(r) = min( R, -r+R)
```

とし、`q=qMin..qMax` の昇順で列挙する。総セル数は

```text
N(R) = 1 + 3R(R+1)
```

である。`enumerateAxial(R)[i]`、`axialAtIndex(R,i)`、`axialIndex(R,q,r)` は必ず同じ対応を
返す。行 `r` の開始 index は、それ以前の行長
`2R+1-abs(k)` を `k=-R..r-1` の順に加えた値であり、行内 offset は `q-qMin(r)`。

`axialIndex` は検証済み整数座標が `H_R` の外なら `null` を返す。`axialAtIndex` は範囲外を
例外にする。格子外を index へ丸めたり、剰余で折り返したりしない。

半径 2 の列挙は次に固定される。

```text
r=-2: (0,-2),(1,-2),(2,-2)
r=-1: (-1,-1),(0,-1),(1,-1),(2,-1)
r= 0: (-2,0),(-1,0),(0,0),(1,0),(2,0)
r= 1: (-2,1),(-1,1),(0,1),(1,1)
r= 2: (-2,2),(-1,2),(0,2)
```

これは 19 セルで、`h=2` の reservoir ring は 12 セル、`h<=1` の成長領域は 7 セルである。
一般に ring は `6R` セル。格子全体を列挙し、60° sector の結果を複製しない。

### 4.4 整数の表現可能性

`latticeCellCount` は上式を binary64 の安全整数演算として評価し、結果が安全整数でなければ
`RangeError` とする。任意の固定した上限を追加しない。実際の typed array を確保できない大きさは
`createLattice` で ECMAScript 実行環境の `RangeError` をそのまま返し、部分状態を返さない。

## 5. 条件正規化 API

`domain/conditions.ts` は次を export する。

```ts
export function normalizeConditions(
  temperatureC: number,
  supersaturationPct: number,
): NormalizedConditions
```

入力が有限なら、温度を `[-30,0]` °C、氷に対する遠方相対過飽和度を `[0,30]` % へ、それぞれ
最近傍端で独立にクランプする。返値は

```text
T = clamp(temperatureC, -30, 0)
sigmaPct = clamp(supersaturationPct, 0, 30)
x = (T+30)/30
y = sigmaPct/30
clamped = (T != temperatureC) OR (sigmaPct != supersaturationPct)
```

とする。`clamped` は少なくとも一方が範囲外だったことを表す単一 boolean で、端点ちょうどは
`false`。この関数は CA の `beta` / `gamma` / `noiseAmplitude` を生成せず、T1-3 の経験的較正を
先取りしない。

## 6. xoshiro128** version 1.1 API

`domain/prng.ts` は次を export する。

```ts
export function nextXoshiro128ss(state: Seed128): Xoshiro128ssResult
export function uint32ToNoise(output: number): number
```

`nextXoshiro128ss` は入力 tuple を変更せず、0 以上 `2^32-1` 以下の整数 output と、新しい
4 成分 tuple を返す。入力を `[a,b,c,d]` として、演算順は作者 version 1.1 と同じ次へ固定する。

```text
output = rotl(b * 5, 7) * 9
t = b << 9
c1 = c xor a
d1 = d xor b
b1 = b xor c1
a1 = a xor d1
c2 = c1 xor t
d2 = rotl(d1, 11)
nextState = [a1,b1,c2,d2]
```

乗算は `Math.imul`、回転、shift、xor の中間値を含め各結果を modulo `2^32` の unsigned 値へ
`>>>0` で正規化する。scrambler は **`b=s[1]`** を使う。`s[0]` を使う version 1.0 と、
符号付きの output を返す実装は不適合である。

`uint32ToNoise` は検証済み output に対し、評価順も含め

```text
u = output / 4294967296
noise = 2*u - 1
```

を適用して有限な `[-1,1)` の binary64 を返す。別の除数、端点補正、分布変換を加えない。

固定同定ベクトルは T1-0 `DESIGN.md` 7.1 の 5 行を literal としてテストへ転記する。特に
`[1,2,3,4] -> output 11520, nextState [7,0,1026,12288]`、次の output は 0 である。
最初の noise は `-0.9999946355819702`、次は `-1`。同じ初期 state から 19 回進めた 19 番目の
output は `3571406116`、消費後 state は
`[2456999277,4279822836,334074982,4097125698]` である。

## 7. `createLattice` 契約

`domain/lattice.ts` は次を export する。

```ts
export function createLattice(input: CreateLatticeInput): LatticeState
```

処理は観測可能な結果について次の順序に固定する。

1. 8 節の順で全入力を検証し、入力 seed を正規化した新しい tuple へコピーする。
2. `N=latticeCellCount(radius)` 要素の `Float64Array waterMass`、`Uint8Array ice`、
   `Float64Array noise` を新規確保する。
3. 4.3 節の全セル列挙順で、初期 seed から 1 セルにつき xoshiro128** output をちょうど 1 回
   消費し、`uint32ToNoise(output)` を同じ index の `noise` へ保存する。中心、reservoir ring を
   含む全セルが消費する。並列化、座標 hash、別順の先行生成をしない。
4. `(q,r)=(0,0)` の index だけ `waterMass=1, ice=1`、それ以外の全セルを
   `waterMass=beta, ice=0` とする。reservoir ring もこの時点では他の非中心セルと同じ `beta`。
5. metadata を次のとおり設定して返す。

```text
radius = input.radius
stepIndex = 0
elapsedCa = +0
stopped = false
beta = input.beta
noiseAmplitude = input.noiseAmplitude
seed = 入力初期 seed の正規化済みコピー
modelVersion = "reiter-alpha1-xoshiro128ss-1.1-v1"
```

`noiseAmplitude` は固定 `noise` 配列を生成・スケールし直す値ではない。配列は常に
`[-1,1)` の基底 noise を保持し、振幅は T1-2 の各 step が `noiseAmplitude*noise[i]` として
適用する。作成時の値は再現 metadata として保存する。

同一の `radius`、seed 4 成分、`beta`、`noiseAmplitude` からは、全配列の binary64/uint8、
metadata、seed、モデル版が bit-for-bit 一致する。seed が 1 bit でも異なる場合、同一 noise を
保証してはならず、T1-0 `TC-RNG-002A` では少なくとも 1 要素が異なることを検査する。

## 8. 入力検証と例外

全 API は結果の計算・配列確保より前に、該当する入力を次の規則で検証する。
ただし座標変換の overflow 検査は有限な入力を検証後に中間値を計算し、返値を公開する前に行う。

| 入力 | 有効条件 | 不正時 |
|---|---|---|
| 一般の公開 scalar | `typeof value === "number"` かつ有限 | 型違いまたは NaN/±Infinity は `TypeError` |
| `temperatureC` / `supersaturationPct` | 有限値 | 範囲外だけクランプ |
| axial `q`,`r` | safe integer、かつ `max(abs(q),abs(r),abs(q+r))<=M-1` | 有限な非整数・safe-neighbor 域外は `RangeError` |
| Cartesian `x`,`z` | 有限値、かつ変換後の `q`,`r`,`q+r` がすべて有限 | 入力非有限は `TypeError`、変換 overflow は `RangeError` |
| `radius` | 2 以上の safe integer、`N(R)` も safe integer | 有限な範囲違反は `RangeError` |
| `index` | `0<=index<N(R)` の safe integer | 有限な非整数・範囲外は `RangeError` |
| seed 成分 | `0<=s[i]<=2^32-1` の整数 | 非有限/型違いは `TypeError`、有限な非整数・範囲外は `RangeError` |
| seed 全体 | 長さ 4 の Array、全成分有効、all-zero でない | 形・長さ違いは `TypeError`、all-zero は `RangeError` |
| `uint32ToNoise(output)` | `0<=output<=2^32-1` の整数 | scalar 規則に従い `TypeError` / `RangeError` |
| `beta` | `[0,0.95]` | 有限範囲外は `RangeError` |
| `noiseAmplitude` | `[0,1]` | 有限範囲外は `RangeError` |

seed の有効成分は unsigned 32-bit 値へ正規化して新しい tuple に保存する。`-0` は整数値 0 として
`+0` に正規化する。元の Array/tuple は変更しない。

複数引数の検証順は、条件正規化では `temperatureC`、`supersaturationPct`、座標関数では
`q`/`x`、`r`/`z`、格子関数では `radius`、`q`、`r` または `index`、`createLattice` では
`radius`、seed の index 0〜3、all-zero、`beta`、`noiseAmplitude` とする。最初の違反を同期的に
throw し、入力を書き換えず、部分的な返値を公開しない。

## 9. 純粋性、再現性、依存境界

- 公開関数は引数、引数が参照する seed/配列、過去の返値を変更しない。同一の有効入力には
  同じ値・同じ列挙順を返す。新しい object/array を返す API は参照 identity の一致を要求しない。
- `Math.random`、`Date`、`performance`、`crypto`、locale、環境変数、DOM、browser global、
  network、storage、worker、共有の可変 module state、順序が変わり得る object key 列挙に
  依存しない。
- `domain/` から `three`、`app/`、`ui/`、`scene/`、他 simulator を import しない。
  `Math.imul`、`Math.sqrt` と ECMAScript 組込み typed array だけで実装でき、依存パッケージを
  追加しない。
- 格子全体を `H_R` として保持する。60° sector のミラー、回転複製、事前描画形状を使わない。
- 列挙順、PRNG 式・消費回数、noise 変換、モデル版のいずれかを変える変更は AC-06 の再現性を
  破るため、本タスクの単純な refactor として行わず、上位設計へ差し戻す。

## 10. ファイル分割と公開面

実装工程の所有範囲は次とする。

```text
src/simulators/snow-crystal-sim/domain/
  types.ts          MODEL_VERSION と公開型
  conditions.ts     normalizeConditions
  hex-lattice.ts    距離、近傍、座標変換、列挙、index 対応
  prng.ts           xoshiro128** 1.1 と uint32ToNoise
  lattice.ts        createLattice
  index.ts          上記 public symbol の明示的な再 export
  __tests__/        次工程で追加する T1-1 のテストだけ
```

`vite.config.ts` の `test.include` は次の **exact glob** を両方持つように変更する。

```ts
include: [
  'tests/**/*.test.ts',
  'src/simulators/snow-crystal-sim/domain/__tests__/**/*.test.ts',
]
```

実装後は app workspace で
`npm test -- --reporter=verbose src/simulators/snow-crystal-sim/domain/__tests__` を実行し、出力に上記ディレクトリの
テストファイルが列挙され、実行テスト数が 0 より大きいことを `EVIDENCE.md` へ記録する。
その後 `node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim` でも同じ domain テストの実行を
レポータ出力で確認する。`passWithNoTests: true` による 0 件の成功は収集確認と見なさない。

`index.ts` は wildcard ではなく公開 symbol を明示して export し、module 内部 helper を公開しない。
T1-2 以降が状態型と座標対応を利用できる一方、UI/scene 固有型は domain の公開面へ入れない。

## 11. 独立検証方針と許容差

テストケース工程では T1-0 の割当ケースを転記し、少なくとも次の独立オラクルを使う。

1. **既知値**: 半径 2 の 19 座標、ring 12、成長領域 7、中心 index、初期配列を test literal
   から検査する。production の列挙 helper で期待値を作らない。
2. **解析的逆変換**: 2.2 節の 2 基底から作る 2×2 行列の逆をテスト側へ直接書き、
   `(2,-1) <-> (1.5,-sqrt(3)/2)` と複数座標を 2.3 節の規模比例許容差で検査する。
3. **不変性**: 近傍差分 6 個の重複なし、全近傍の `hexRadius` 差が高々 1、座標平行移動で
   近傍差分が不変、`axialIndex` と `axialAtIndex` が全 index で厳密な逆であることを検査する。
4. **PRNG の独立既知列**: T1-0 7.1 の 5 state/output/nextState と 19 回消費 sentinel を
   literal にし、production PRNG を期待値生成へ使わない。
5. **再現性**: T1-0 `TC-RNG-002A` として `domain/__tests__/lattice.test.ts` で、同じ作成入力
   2 個の全 field を binary64/uint8 単位で比較し、列挙順、1 セル 1 output、noise、初期
   seed の保存、`modelVersion` を検査する。1 bit 違う seed の noise は少なくとも 1 要素
   異なることを検査する。`step` の PRNG 非消費は T1-2 `TC-RNG-002B` /
   `domain/__tests__/reiter-step.test.ts` の責務である。
6. **境界・異常系**: 全閉区間端点、その直外、NaN、±Infinity、非整数、unsafe integer、
   all-zero seed を literal table で網羅し、例外 class と入力不変を厳密比較する。座標は独立に
   `(M-1,0)` の最大有効値とその変換往復、直外 `(M,0)` の `RangeError`、最大有効値からの
   6 近傍がすべて
   safe integer であること、`(M,0)` の近傍加算境界拒否、`cartesianToAxial(Number.MAX_VALUE,
   Number.MAX_VALUE)` の変換 overflow `RangeError` を個別テストとする。また `(24149949,-48187277)` の
   往復が固定 `1e-12` ではなく 2.3 節の規模比例許容差で成立することを検査する。

座標変換は 2.3 節の規模比例許容差、条件正規化は絶対誤差 `1e-12`。整数、順序、型、boolean、
例外 class、uint32、
モデル版、初期 scalar、metadata は完全一致。noise と同一入力の状態は `DataView` を用いて
binary64 bit-for-bit とし、物理・観測の不確かさを数値実装の tolerance へ混ぜない。

## 12. 対象外と未決事項

次は本タスクで決めず、上位タスク割当を維持する。

- Reiter の拡散、受容判定、凍結、reservoir 更新、収支台帳、停止条件: T1-2
- `(temperatureC,supersaturationPct)` から `beta`、`gamma`、`noiseAmplitude` への経験的写像、
  形態指標、境界感度: T1-3
- c 軸厚み: T1-4
- typed array 二重 buffer、CPU/GPU、production 半径・step 頻度の性能上の最終決定: T2-4
- ゆらぎ振幅の既定値と見た目: T2-5 の人間 UI 受入
- fractional axial 座標のセル選択用丸め、URL serialization、描画用変換: 各 app/scene 後続タスク

上位成果物と矛盾する未解決事項はない。本書の API 名、型、検証順、index 対応は T1-1 の
実装詳細として確定でき、物理式、単位、近似、受入基準、経験較正を変更しないため、新しい
`DECISIONS.md` は作成しない。
