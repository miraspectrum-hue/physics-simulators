# T1-2 成長セルオートマトン 設計

## 1. 目的、権威、変更境界

本タスクは、T1-1 が実装した六角格子状態へ Reiter `alpha=1` の拡散、受容セルへの面外添加、
凍結、動的 reservoir 境界、外縁停止を適用する決定的な成長 step を実装可能な契約へ落とす。
あわせて、成長経路とは独立した `vaporBudget` で AC-07 の収支を監査できるようにする。

権威の順序は `SPEC.md`、`DESIGN-OUTLINE.md`、承認済み T1-0 `DESIGN.md` /
`DECISIONS.md` / `TESTCASES.md`、承認済み T1-1 `DESIGN.md` / `TESTCASES.md` とその実装、
本書とする。本書は上位契約を具体化するだけで、物理式、単位、数値範囲、境界近似、
経験的較正、モデル版を変更しない。

- 実行プロファイル: `full`
- UI 影響: なし
- 実装変更境界:
  `apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/`
- 対象受入基準: AC-06（完全再現）、AC-07（収支）、AC-09（有限性）と外縁到達通知
- 引き継ぐテスト契約: T1-0 の `TC-DIFF`、`TC-BETA`、`TC-GAMMA`、`TC-FREEZE`、
  `TC-MASS`、`TC-INVARIANT`、`TC-STOP`、`TC-REPLAY`、`TC-RNG-002B`

描画、UI、条件履歴の永続化、共有 URL、形態指標、`(temperatureC,
supersaturationPct)` から CA パラメータへの写像、c 軸厚みは変更しない。

## 2. 出典、単位、適用範囲

### 2.1 出典

- C. A. Reiter, “A Local Cellular Model for Snow Crystal Growth,” *Chaos, Solitons &
  Fractals* 23(4), 1111–1119 (2005),
  [DOI 10.1016/j.chaos.2004.06.071](https://doi.org/10.1016/j.chaos.2004.06.071)、
  [May 2004 author preprint](https://webbox.lafayette.edu/~reiterc/mvp/sfn/sfn_pp.pdf)
  pp. 4–7。受容セル、閾値 1、`beta` 背景境界、`gamma` 面外添加、六角格子 Laplacian、
  `alpha=1` の更新重みを採用する。
- Reiter の著者補助資料
  [Snowflake Automaton, May 2004](https://webbox.lafayette.edu/~reiterc/mvp/sfn/index.html)
  “The Local Model”。固定背景境界と局所モデルの補助説明に用いる。
- N. J. Higham, *Accuracy and Stability of Numerical Algorithms*, 2nd ed., SIAM
  (2002), [DOI 10.1137/1.9780898718027](https://doi.org/10.1137/1.9780898718027)、
  Chapters 2, 4。台帳の Neumaier compensated summation、独立収支の Kahan summation、
  機械 epsilon に比例する許容差の根拠とする。
- PRNG と固定 noise の出典・版は T1-0 S4 と T1-1 に固定済みである。本タスクの `step` は
  PRNG を呼ばず、新しい乱数源も追加しない。

### 2.2 記号と単位

| 記号 / フィールド | 単位・範囲 | 意味 |
|---|---|---|
| `m_i`, `waterMass[i]` | 無次元 CA 水量、`>=0` | セル `i` の Reiter 水量。kg ではない |
| `R_i` | 0 または 1 | step 開始時の受容判定 |
| `p_i` | CA 水量 | 受容セルに固定された deposited part |
| `u_i` | CA 水量 | 非受容セルの mobile vapor part |
| `beta` | CA 水量、`[0,0.95]` | 当該 step の Dirichlet reservoir 値 |
| `gamma` | CA 水量 / CA step、`[0,1]` | 受容セルへの面外添加率 |
| `noise[i]` | 無次元、`[-1,1)` | T1-1 で seed から一度だけ作った固定値 |
| `noiseAmplitude` (`e`) | 無次元、`[0,1]` | 固定 noise へ掛ける当該 step の振幅 |
| `dtCa` | CA step、`(0,1]` | 物理秒ではない離散時間幅 |

座標、列挙順、格子半径は T1-1 の axial 六角格子契約を使う。格子全体
`H_R={h(q,r)<=R}` を計算し、`h=R` を reservoir ring、`h<=R-1` を成長領域とする。
60° sector の回転・反転複製は禁止する。

### 2.3 適用範囲と近似

本モデルは単一結晶の二次元基底面形態を表す中間スケール CA であり、物理秒、物理質量、
分子付着速度を予測しない。`beta` と `gamma` は温度・過飽和度そのものではなく、T1-3 が
観測形態へ経験的に較正する CA パラメータである。T1-2 は値の写像や既定値を持たない。

axial 六角 reservoir ring は原著の等 Euclidean 距離境界の数値近似である。production 形態の
妥当性を主張できるのは、T1-3 が T1-0 10.3 節の境界感度オラクルを半径 115 で満たした後に
限る。T1-2 の小半径 fixture は局所則、境界流量、停止だけを検証し、形態妥当性を主張しない。

## 3. 公開型と API

### 3.1 型

`domain/types.ts` は既存型を維持し、次を追加 export する。

```ts
export interface StepParameters {
  readonly beta: number
  readonly gamma: number
  readonly noiseAmplitude: number
  readonly dtCa: number
}

export interface StepControl extends StepParameters {
  readonly temperatureC: number
  readonly supersaturationPct: number
  readonly calibrationId: string
}

export interface MassLedger {
  readonly beforeTotal: number
  readonly afterTotal: number
  readonly diffusionNet: number
  readonly outOfPlaneInput: number
  readonly reservoirExchange: number
  readonly residual: number
}

export interface StepResult {
  readonly state: LatticeState
  readonly ledger: MassLedger
  readonly reachedEdge: boolean
}

export interface VaporBudget {
  readonly mobileVapor: number
  readonly depositedWater: number
  readonly totalWater: number
  readonly iceCellCount: number
}
```

`StepControl` は再現キーに保存する順序付き条件サンプルの domain 型である。`step` が数値更新に
使うのは `StepParameters` の 4 値だけであり、`temperatureC`、`supersaturationPct`、
`calibrationId` を参照したり、現在の較正写像を再実行したりしない。T1-2 では replay key の
serialization API は追加しない。

### 3.2 関数

`domain/reiter-step.ts` は次を export する。

```ts
export function step(
  state: LatticeState,
  parameters: StepParameters,
): StepResult
```

`domain/vapor-budget.ts` は次を export する。

```ts
export function vaporBudget(state: LatticeState): VaporBudget
```

`domain/index.ts` は上記の値と型を wildcard ではなく明示的に再 export する。`step` と
`vaporBudget` は純粋関数であり、入力 object、typed array、seed tuple を変更しない。

## 4. 状態不変条件と検証順

### 4.1 有効な `LatticeState`

公開関数は計算前に次を検証する。

1. `state` は object である。
2. `radius` は 2 以上の safe integer で、T1-1 の `latticeCellCount(radius)` が安全整数を返す。
3. `waterMass` はセル数と同じ長さの `Float64Array`、`ice` は同長の `Uint8Array`、
   `noise` は同長の `Float64Array` である。
4. `stepIndex` は 0 以上の safe integer、`elapsedCa` は有限かつ 0 以上、`stopped` は boolean。
5. metadata の `beta` は `[0,0.95]`、`noiseAmplitude` は `[0,1]`。
6. `seed` は T1-1 と同じ 4×uint32、all-zero 禁止、`modelVersion` は
   `MODEL_VERSION` と完全一致する。
7. index 0 から末尾まで固定順に走査し、`waterMass[i]` は有限かつ 0 以上、`ice[i]` は
   0 または 1、`noise[i]` は有限かつ `-1<=noise[i]<1` である。reservoir ring の
   `ice[i]` は 0 でなければならない。

配列種別、object/seed/modelVersion の型・形違い、boolean でない `stopped` は `TypeError`。
公開 scalar と配列要素の NaN / ±Infinity は `TypeError`。有限な範囲違反、配列長不一致、
不正な `ice`、all-zero seed、異なるモデル版は `RangeError` とする。最初の違反で同期的に
throw し、入力を変更せず、部分結果を公開しない。

### 4.2 `StepParameters` と出力可能性

state の検証後、`beta`、`gamma`、`noiseAmplitude`、`dtCa` の順で検証する。

- `beta`: `[0,0.95]`
- `gamma`: `[0,1]`
- `noiseAmplitude`: `[0,1]`
- `dtCa`: `(0,1]`

非有限または数値でない値は `TypeError`、有限な範囲違反は `RangeError`。active state では
`stepIndex+1` が safe integer、`elapsedCa+dtCa` が有限となることも配列確保前に検証し、
満たさなければ `RangeError` とする。これにより有効入力から非有限 metadata を生成しない。

`vaporBudget` は 4.1 の state だけを検証する。`StepControl` の物理条件・較正 ID の検証と
canonical serialization は T4-2 の責務であり、本タスクの数値 step へ混入させない。

## 5. `step` の状態遷移

### 5.1 固定点の先行判定

検証済みの `state.stopped===true` なら成長計算、境界置換、添加、PRNG、metadata 更新を
行わない。返す状態の全値は入力と bit-for-bit 同じとし、参照 identity は公開契約にしない。
`reachedEdge=true` を返して停止状態をラッチする。台帳は

```text
beforeTotal = afterTotal = 入力 waterMass の固定順 Neumaier sum
diffusionNet = outOfPlaneInput = reservoirExchange = residual = +0
```

とする。停止後に異なる有効 parameters を渡しても固定点であり、`stepIndex` と `elapsedCa` も
増やさない。

### 5.2 作業入力と開始時 reservoir 交換

active state では、まず元の `waterMass` を新しい作業配列へコピーする。入力 state の総量を
`beforeTotal` とし、`h=radius` の index だけを当該 step の `beta` へ置換する。

```text
mbar_i = beta  (h_i=radius)
mbar_i = m_i   (otherwise)

reservoirExchangePre = sum[h_i=radius](beta-m_i)
```

境界 index は全セルの固定列挙順に現れる順で加える。内部 `h<radius` の水量、`ice`、`noise` を
`beta_new/beta_old` で再スケールしてはならない。受容判定と拡散はこの `mbar` を使うため、
新しい `beta` は同じ step から作用する。

### 5.3 step 開始時の受容 mask

受容 mask は入力 `ice` の snapshot から一度だけ作り、その step 中は再計算しない。

```text
R_i = 1  iff ice_i=1 または格子内の6近傍のいずれかで ice_j=1
R_i = 0  otherwise
```

近傍順は T1-1 の
`(+1,0),(+1,-1),(0,-1),(-1,0),(-1,+1),(0,+1)` とする。格子外近傍は
受容判定に寄与しない。新たに凍結したセルの近傍が受容になるのは次の `step` からであり、
同一 step 内で連鎖させない。

### 5.4 deposited/mobile 分割と拡散

作業入力を次に分ける。

```text
p_i = R_i mbar_i
u_i = (1-R_i) mbar_i
```

`alpha=1` を固定し、mobile part だけを同時更新する。

```text
uStar_i = u_i + (dtCa/12) * sum[j in N(i)](u_j-u_i)
```

格子外の欠けた近傍は `u_j=u_i` の zero-normal-flux と等価に扱い、和へ 0 を加える。
各セルは index 0 から末尾、近傍は 5.3 の固定順で読み、すべての `uStar` を元の `u` から
計算する。計算中に `u` または入力 state を逐次更新しない。

`0<dtCa<=1` では内部6近傍セルの自己重みは `1-dtCa/2>=1/2`、各近傍重みは
`dtCa/12>=0` である。したがって非負入力から負値を作らない。丸めにより負値が生じた場合に
0 へ黙示 clamp せず、不変条件違反として `RangeError` を throw する。

```text
diffusionNet = sum_i(uStar_i-u_i)
```

は全セルの固定 index 順で Neumaier 集計する。閉じた無向格子グラフでは理論値 0 である。

### 5.5 面外添加

固定 noise を再生成せず、各受容セルへ次を加える。

```text
gamma_i = gamma * (1 + noiseAmplitude * noise_i)
a_i = R_i * gamma_i * dtCa
mTilde_i = p_i + uStar_i + a_i
outOfPlaneInput = sum_i(a_i)
```

演算順は上記の左から右へ固定する。`noise_i>=-1`、`noiseAmplitude<=1`、`gamma>=0` なので
`a_i>=0`。非受容セルでは `a_i=+0` とする。`outOfPlaneInput` は固定 index 順の Neumaier
集計であり、reservoir 交換へ合算しない。

### 5.6 終了時 reservoir 固定、凍結、外縁停止

拡散・添加後、reservoir ring を同じ `beta` へ戻す。

```text
mPrime_i = beta      (h_i=radius)
mPrime_i = mTilde_i  (otherwise)

reservoirExchangePost = sum[h_i=radius](beta-mTilde_i)
reservoirExchange = reservoirExchangePre + reservoirExchangePost
```

pre の全項を先に、続けて post の全項を、それぞれ境界 index の固定順で**同じ** Neumaier
accumulator へ加える。符号は正を reservoir から格子への流入、負を格子から reservoir への
流出とし、絶対値化しない。

氷判定は成長領域だけで、すべての `mPrime` が完成した後に同時適用する。

```text
icePrime_i = ice_i OR (mPrime_i >= 1)  (h_i<=radius-1)
icePrime_i = 0                          (h_i=radius)
```

閾値は `>=1`。既存氷は不可逆で 1 から 0 へ戻さない。新旧いずれかの氷が
`h=radius-1` に存在すれば、その step の更新結果を返した上で
`stopped=true,reachedEdge=true` とする。存在しなければ両方 false。格子を拡張しない。

active step の metadata は次へ更新する。

```text
stepIndex = previous.stepIndex + 1
elapsedCa = previous.elapsedCa + dtCa
beta = parameters.beta
noiseAmplitude = parameters.noiseAmplitude
radius, seed, modelVersion = previous と同値
```

`waterMass` と `ice` は新しい typed array を返す。固定 `noise` と seed は値を一切変更せず、
実装は不変データとして参照共有してよい。共有の有無を値の公開契約にせず、呼出し中に入力へ
書き込まないことをテストする。module-level の可変 buffer pool は使用しない。

### 5.7 台帳

`afterTotal` は `mPrime` の固定 index 順 Neumaier sum とする。公開台帳は

```text
residual = ((afterTotal-beforeTotal)-outOfPlaneInput)-reservoirExchange
```

の減算順に固定する。相分類、拡散、凍結は内部移動であり、`residual` から
`diffusionNet` を再度引かない。台帳の各値は有限でなければならず、NaN / Infinity を
計算した場合は状態を返さず `RangeError` とする。

`beforeTotal`、`afterTotal`、`diffusionNet`、`outOfPlaneInput`、
`reservoirExchange` は `reiter-step.ts` 内だけの Neumaier 実装で集計する。通常の `+=`、
並列 reduction、object key の列挙順へ置き換えない。Neumaier helper は公開せず、
`vaporBudget` から import しない。

## 6. 独立 `vaporBudget`

`vaporBudget(state)` は `step` の中間配列、受容 mask、台帳、Neumaier helper、更新関数を
import または再利用しない。別モジュールで状態を独立に検証し、index 0 から末尾まで独自に
走査する。

各 index について、入力 `ice` だけから 5.3 と同じ受容条件を独立に判定し、

```text
R_i=0: waterMass[i] を mobileVapor へ
R_i=1: waterMass[i] を depositedWater へ
ice[i]=1: iceCellCount を整数で +1
```

とする。`mobileVapor` と `depositedWater` は相互に独立な Kahan accumulator で求める。
`totalWater` はセルを3回目に集計せず、**新しい** Kahan accumulator へ
`mobileVapor`、`depositedWater` の順で投入して求める。したがって全水量は相分類に関係なく
全 `waterMass` と一致する。

返却 object を構築・公開する前に、`mobileVapor`、`depositedWater`、`totalWater` の3値を
それぞれ `Number.isFinite` 相当で検証する。入力の各 `waterMass[i]` が有限でも Kahan 集計が
overflow していずれかが非有限になった場合は、部分的な `VaporBudget` を返さず同期的に
`RangeError` を throw し、入力 state、配列、metadata を一切変更しない。これは `step` が
5.7 と 8.1 で全台帳値・全出力水量の有限性を公開前に保証する契約と同じであり、有限な入力要素の
総和が公開 binary64 の有限範囲を超えた出力可能性違反を表すため `TypeError` にはしない。

`vapor-budget.ts` は `reiter-step.ts` または共有の compensated-sum helper を import しては
ならない。T1-1 の座標/index API と公開型は使用できるが、受容判定ループと Kahan 実装は
このモジュール固有とする。これが `step` の台帳と同じ集計バグを複製しない production 側の
独立経路である。ただしテスト期待値はさらに別のテスト専用直接式から生成し、
`vaporBudget` 自身を台帳期待値の生成には使わない。

## 7. 決定性、再現性、純粋性

- `step` は `prng.ts`、`nextXoshiro128ss`、`Math.random`、`crypto` を呼ばない。noise 配列を
  再生成・並べ替え・スケールして保存し直さない。T1-0 `TC-RNG-002B` は T1-1 の
  `createLattice` 後に PRNG wrapper の counter を 0 へ戻し、複数 step 後も 0 であることを
  検査する。
- 同じ初期 `LatticeState` と同じ順序の `StepControl` から `StepParameters` の保存済み数値を
  同じ順に渡した場合、各 checkpoint の全 state と ledger は IEEE 754 / uint8
  bit-for-bit 一致する。wall-clock、描画 frame、locale、現在の較正写像へ依存しない。
- セル順は T1-1 の `(r 昇順,q 昇順)`、近傍順、総和順、演算順を固定する。並列化や GPU 化で
  reduction 順を変える場合は `modelVersion` と旧 replay 互換性の上位判断へ戻す。
- active step は入力 state を変更せず新しい `waterMass` / `ice` を返す。失敗時にも入力を
  部分更新しない。`vaporBudget` は状態を一切変更しない。
- domain は DOM、browser global、Three.js、`app/ui/scene`、他 simulator、network、storage、
  worker、共有可変 module state に依存しない。

## 8. 数値安定性と許容誤差

### 8.1 安定性

公開範囲 `0<dtCa<=1` は `alpha=1` の非負係数条件 `alpha*dtCa<=2` の内側にある。
面外添加も非負であるため、有効な非負状態から負の水量を生成しない。氷相は不可逆で、
`iceCellCount` は非減少である。全 active step の終了時に全 `waterMass`、台帳、`elapsedCa` の
有限性と水量の非負性を確認し、不正結果を公開しない。

固定回数の陽的更新であり、収束判定や反復 solver はない。停止条件は外縁到達または呼出し側が
step の実行をやめることだけである。T1-2 は最大 step 数を暗黙に設けない。

### 8.2 許容差

- integer、boolean、`ice`、seed/noise 不変、停止後状態、再現 checkpoint: 完全一致または
  bit-for-bit
- 局所既知値:
  `tauLocal=32*Number.EPSILON*max(1,abs(expected))`
- 質量収支:

  ```text
  ledgerScale=max(1,abs(beforeTotal),abs(afterTotal),
                     abs(outOfPlaneInput),abs(reservoirExchange),
                     diffusionAbsSum,reservoirAbsSum)
  tauMass=256*Number.EPSILON*ledgerScale
  ```

  `diffusionAbsSum=sum(abs(uStar_i-u_i))`、`reservoirAbsSum` は pre/post の各境界差の
  絶対値和で、テスト専用参照経路が求める。

これらは binary64 の工学的丸め許容差であり、物理観測の不確かさ、経験較正誤差、通常加算、
負値 clamp、流量欠落を隠すために拡大しない。

## 9. 独立オラクルとテスト設計への要求

テストケース工程は、承認済み T1-0 の割当ケースを T1-2 の exact test path へ展開し、少なくとも
次を満たす。

1. **局所既知値**: 全 `ice=0`、中央 mobile impulse 0.6、`dtCa=1` から、紙上の
   `1/2,1/12` 重みで中央 0.3、6近傍各 0.05、合計 0.6 を導く。production step を期待値生成に
   使わない。
2. **平衡端点**: 一様な非受容場は固定点。`beta=gamma=0` の中心 seed は 64 step 後も中心以外
   成長しない。
3. **動的境界**: 半径2の ring 12セル、境界 edge 18本を test literal で列挙し、
   `beta:0.2->0.4` の pre 2.4、post 0.6、合計 3.0 と収支を直接計算する。半径7では
   新 beta の 1-step front と内部非再スケールを検査する。
4. **面外入力と凍結**: `gamma=0.25,dtCa=0.5` の7受容セルから 0.875 を紙上計算する。
   `mPrime=1` の直下・一致・直上と、受容 mask が次 step まで更新されないことを検査する。
5. **独立収支**: test 内の座標 Map と無向 edge-flux、直接 gamma/pre/post 式、入力・出力の
   test 専用 Kahan 走査を使う。production `vaporBudget`、Neumaier helper、ledger 値から
   期待値を逆算しない。T1-0 の 2 seeds×3 radii×3 controls=18 fixture を各1 step で検査する。
6. **独立 `vaporBudget` 分類**: 半径2、中心 `(0,0)` だけ `ice=1`、他18セルを `ice=0` とする
   有効 state を専用 fixture とする。test 内だけの literal 座標集合を、中心
   `C=[(0,0)]`、6近傍
   `N=[(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)]`、外周
   `O=[(0,-2),(1,-2),(2,-2),(-1,-1),(2,-1),(-2,0),(2,0),(-2,1),(1,1),(-2,2),(-1,2),(0,2)]`
   と固定する。水量は中心を `64/128`、`N` の記載順を `k/128 (k=1..6)`、`O` の記載順を
   `k/128 (k=7..18)` とし、各領域と各セルを識別できる binary64 exact の literal とする。
   production の近傍・index・列挙 helper によらず、test 専用の受容 mask を `C union N`、
   非受容 mask を `O` として構成する。期待値は test 内で整数分子を個別に加算して最後に128で
   1回だけ除算し、`depositedWater=(64+1+...+6)/128=85/128`、
   `mobileVapor=(7+...+18)/128=150/128`、`totalWater=235/128`、
   `iceCellCount=1` をそれぞれ独立に求め、8.2 の既定許容差で公開返値と照合する。
   期待値生成には production `vaporBudget`、`step`、ledger、共有の補償和・受容判定 helper を
   使用しない。正常呼出しの前後で `waterMass`、`ice`、`noise` の全 bit pattern と全 metadata
   （seed tuple を含む）が不変であることも確認する。さらに同 fixture の独立 clone から
   `waterMass` 1要素を `NaN` にした state は `TypeError`、`modelVersion` だけを不一致にした
   state は `RangeError` として同じ呼出し内で同期的に拒否され、例外後も各入力配列の全 bit
   pattern と metadata が不変で部分結果を返さないことを確認する。
   これとは独立に、同じ半径2・中心だけ `ice=1`・reservoir ring の `ice=0`、有効な noise と
   metadata を持ち、全19個の `waterMass` 要素を有限な `Number.MAX_VALUE` とした有効 state を
   用意する。test 専用 Kahan 実装で literal の `C union N` と `O` を別々に固定順集計し、各相の
   総和が overflow して非有限になることを production helper に依存せず確認する。その state の
   `vaporBudget` は同期的に `RangeError` を throw して返値・部分結果を公開せず、例外前後で
   `waterMass`、`ice`、`noise` の全 bit pattern と seed tuple を含む全 metadata が不変である
   ことを検査する。
   さらに前段の全要素最大値ケースとは独立に、同じ literal の受容集合 `C union N` のうち
   `(0,0)` と、非受容集合 `O` のうち `(0,-2)` の `waterMass` だけをそれぞれ
   `0.75*Number.MAX_VALUE`、残り17セルを `0` とした有効 state を用意する。test 専用 Kahan
   実装で、受容相と非受容相をそれぞれ独立に固定順集計した
   `depositedWater=0.75*Number.MAX_VALUE` と
   `mobileVapor=0.75*Number.MAX_VALUE` はともに有限だが、その2値を
   `mobileVapor`、`depositedWater` の順で**新しい** test 専用 Kahan accumulator へ投入した
   `totalWater` だけが非有限になることを、production の `vaporBudget`、`step`、ledger、
   補償和・受容判定 helper に依存せず事前確認する。この state の `vaporBudget` は同期的に
   `RangeError` を throw し、返値・部分結果を公開しない。例外前後で `waterMass`、`ice`、
   `noise` の全 bit pattern、seed tuple、および全 metadata が完全不変であることを検査する。
7. **有限性と不変条件**: 同じ18 fixture を最大32 stepまたは停止まで実行し、負値なし、
   全有限、氷の不可逆性、count 非減少を検査する。有限範囲外、非有限、配列/metadata 不整合も
   T1-0 `TC-INVARIANT-002` の table で同期拒否する。
   これとは別に、半径2、中心 `(0,0)` だけ `ice=1`、reservoir ring を含む他18セルを
   `ice=0`、全19個の `waterMass` を有限な `Number.MAX_VALUE`、全 `noise` を `0` とした
   `stopped=false` の有効な active state を用意する。metadata は有効な固定 seed、
   `beta=0.5`、`noiseAmplitude=0`、既定 `modelVersion` とし、有効な
   `StepParameters={beta:0.5,gamma:0,noiseAmplitude:0,dtCa:1}` を渡す。呼出し前に、test 内だけの
   literal 座標・近傍・受容 mask と直接更新式を使い、production の `step`、ledger、Neumaier
   helper を一切呼ばずに、入力19要素の `beforeTotal` 集計と更新後19要素の集計がそれぞれ
   binary64 の有限範囲を超えて非有限になることを確認する。`step` は同期的に `RangeError` を
   throw し、返値・部分状態・台帳を公開しない。例外前後で `waterMass`、`ice`、`noise` の全
   bit pattern、`stepIndex`、`elapsedCa`、`stopped`、seed tuple を含む全 metadata、および渡した
   `StepParameters` object の全値が完全不変であることを検査する。
8. **停止**: `h=radius-1` に既存氷を置いた active fixture は1 stepの結果を返して停止し、
   次の step は異なる parameters でも bit-for-bit 固定点、全外部流量と residual は `+0`。
9. **PRNG 非消費**: T1-0 `TC-RNG-002B` の wrapper counter、初期 seed/noise の bit pattern、
   各 checkpoint の一致をすべて満たす。単なる最終状態一致だけで代替しない。
10. **完全再生**: 少なくとも3個の動的 control を保存済みの順で2回再生し、全 state/ledger を
   `DataView` で bit-for-bit 比較する。較正関数、時刻、描画 frame、URL serializer は呼ばない。

数値テストに加え、implementation review で格子全体を走査していること、sector 複製がないこと、
`vaporBudget` と `step` の走査・補償和経路が分離していることを確認する。

## 10. ファイル構成と実装境界

```text
apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/
  types.ts                    T1-2 公開型を追加
  reiter-step.ts              Reiter alpha=1 step と private Neumaier 集計
  vapor-budget.ts             独立走査と private Kahan 集計
  index.ts                    T1-2 の型・関数を明示再 export
  __tests__/
    reiter-step.test.ts       拡散、境界、添加、凍結、不変条件、停止、RNG非消費
    mass-conservation.test.ts 独立 edge-flux / Kahan による18 fixture収支
    replay.test.ts            保存済み control 列の checkpoint 完全再生
```

既存の `conditions.ts`、`hex-lattice.ts`、`prng.ts`、`lattice.ts` の挙動と T1-1 テストを
変更しない。型・scalar・配列種別・配列長だけを検査する状態検証 helper を新規の domain
内部ファイルへ分けることは許す。一方、配列要素の走査、受容判定、補償和、相分類、収支計算は
`vaporBudget` と `step` で共有してはならない。依存 package、Vite 設定、他層のファイルは
変更しない。

## 11. 検証コマンドと工程証跡

テストコード工程では app workspace の対象テストを明示実行する。

```text
npm test -- --reporter=verbose \
  src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts \
  src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts \
  src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts
node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim
```

実装後の最終検証は次を使う。

```text
node scripts/verify.mjs --workspace apps/snow-crystal-sim
node scripts/verify-task-state.mjs \
  --task-dir docs/simulators/snow-crystal-sim/tasks/T1-2 \
  --gate implementation --profile full --ui-impact none
```

`EVIDENCE.md` へ baseline Green、承認済みテストコードによる期待した assertion Red、同じテストを
変更しない Green、対象/全体検証を記録する。module-not-found、構文、型、依存、0件収集は Red と
認めない。

## 12. T1-3 以降との境界と停止条件

- T1-3 は本 API へ渡す `beta`、`gamma`、`noiseAmplitude` を経験的に較正し、形態指標と
  reservoir 境界感度を実装する。T1-2 は仮の較正値、形態 class 閾値、代表軌跡を追加しない。
- T1-4 は c 軸厚みを追加する。T1-2 の CA 水量や `step` を物理厚みへ読み替えない。
- T2-4 は半径115・40,021セルで性能を実測する。本タスクでは純粋性と固定 reduction 順を
  優先する。性能不足を理由に mutable input、GPU、並列 reduction へ独断で変更しない。
- T2-5 は較正済み非ゼロゆらぎの見た目と六腕 CV を人間受入する。T1-2 は noise 振幅の既定値を
  決めない。
- T4-2 は `StepControl` を含む replay key の canonical serialization と共有 URL を実装する。
  本タスクは保存済み数値による domain 再実行だけを保証する。

実装中に Reiter の式、`beta/gamma/dtCa` の範囲・単位、境界形状、reservoir の適用順、
凍結閾値、補償和・許容差、モデル版を変える必要が生じた場合は実装を停止し、上位設計と人間判断へ
戻す。承認済み契約の範囲では未解決のプロダクト判断はない。
