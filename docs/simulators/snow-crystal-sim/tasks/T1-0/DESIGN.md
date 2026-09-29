# T1-0 数値モデル契約

## 1. 目的と適用範囲

本タスクは、基底面（XZ 平面）内の成長コアとして用いる Reiter 型二次元 CA の契約を
固定する。柱状・針状を表す c 軸（+Y）方向の厚み、ならびに `(T, σ∞)` から CA
パラメータへの経験的写像の値は、それぞれ T1-4、T1-8 の責務である。本書の CA は
実時間の成長速度や分子付着過程を第一原理から予測するものではない。

座標は六角格子の axial 座標 `(q, r)`、cube 座標 `(q, -q-r, r)` を用い、格子半径は
`h(q,r)=max(|q|, |r|, |q+r|)` で定義する。描画座標への変換は
`x = q + r/2, z = sqrt(3) r/2`（セル間隔 1）とし、c 軸は `+Y` とする。

## 2. 出典台帳

### S1: Reiter CA

- C. A. Reiter, “A Local Cellular Model for Snow Crystal Growth,” *Chaos, Solitons &
  Fractals* 23(4), 1111–1119 (2005), DOI
  [10.1016/j.chaos.2004.06.071](https://doi.org/10.1016/j.chaos.2004.06.071)。
- 再現可能な著者公開版:
  [May 2004 preprint](https://webbox.lafayette.edu/~reiterc/mvp/sfn/sfn_pp.pdf)。
  採用箇所は “Model and Parameter Diagram” pp. 4–6、Figure 2–4、および
  “Variation on Diffusion” pp. 6–7（拡散方程式、六角格子 Laplacian、更新式、
  `α=1` の重み）。論文はこのモデルが物理方程式への fit ではなく、二次元形態だけを
  対象とすると明記する（pp. 2–3）。
- 著者補助資料:
  [Snowflake Automaton, May 2004](https://webbox.lafayette.edu/~reiterc/mvp/sfn/index.html)
  “The Local Model”（受容セル、`β`、`γ`、固定背景境界、`α=1`）。

### S2: 過飽和度の定義と観測範囲

- K. G. Libbrecht, H. C. Morrison, B. Faber, “Measurements of Snow Crystal Growth
  Dynamics in a Free-fall Convection Chamber,” arXiv:0811.2994v1 (2008),
  [恒久ページ](https://arxiv.org/abs/0811.2994v1)、
  [PDF](https://arxiv.org/pdf/0811.2994v1)。式 (1) と本文 pp. 3–4 は
  `σ=(c-csat)/csat` を定義し、Abstract p. 1 は測定範囲を 0.5–30 %、温度を
  −2–−25 °C とする。pp. 21–23、Appendix Table は各測定条件と約 20 % の
  測定不確かさを示す。
- K. G. Libbrecht, “A Taxonomy of Snow Crystal Growth Behaviors: 2. Quantifying the
  Nakaya Diagram,” arXiv:2306.13087v1 (2023), DOI
  [10.48550/arXiv.2306.13087](https://doi.org/10.48550/arXiv.2306.13087)、
  [恒久ページ](https://arxiv.org/abs/2306.13087v1)。式 (1)–(2), p. 4 は表面過飽和度を
  同じ無次元比で定義する。p. 8 と Figure 2（pp. 11–14）は 206 条件の温度、遠方
  過飽和度、成長時間、寸法を示し、記載した過飽和度の不確かさを 0.8–1.2 倍、温度を
  ±0.2 °C とする。

### S3: 浮動小数点誤差

- N. J. Higham, *Accuracy and Stability of Numerical Algorithms*, 2nd ed., SIAM
  (2002), DOI [10.1137/1.9780898718027](https://doi.org/10.1137/1.9780898718027)、
  Chapter 2（floating-point model）および Chapter 4（summation）。収支オラクルの
  compensated summation と、機械 epsilon に比例する許容誤差の根拠に用いる。

### S4: 決定的 PRNG

- D. Blackman, S. Vigna, “Scrambled Linear Pseudorandom Number Generators,”
  *ACM TOMS* 47(4), Article 36 (2021), DOI
  [10.1145/3460772](https://doi.org/10.1145/3460772)。採用生成器は xoshiro128**。
- 作者が公開する固定参照実装
  [`xoshiro128starstar.c`](https://prng.di.unimi.it/xoshiro128starstar.c)。ファイル冒頭が
  **version 1.1** と明記する版を採用する（2026-09-09 確認）。同ファイルが説明する旧
  version 1.0 の `s[0]` scrambler は採用しない。4 個の 32-bit state、出力式、状態遷移を
  7.1 節へ転記し、初期 state `[1,2,3,4]` の既知 state/output 列でも参照内容を同定する。

## 3. 物理入力

### 3.1 温度

`temperatureC` は °C で、公開入力範囲は `[-30, 0]`。有限な範囲外入力は最近傍端へ
クランプし、元値とクランプ有無を返す。NaN と ±Infinity は `TypeError` とする。
この範囲は `SPEC.md` の中谷ダイヤグラム表示範囲であり、Reiter CA 自体の物理量ではない。
Libbrecht 2023 の attachment model が述べる妥当範囲は `-30<T<0 °C`（p. 5、式 (3) の
説明）なので、端点は UI の閉区間を作る境界値であり、端点外への物理的外挿は主張しない。

### 3.2 遠方過飽和度

採用量は氷平面に対する遠方の相対過飽和度

```text
σ∞ = (c∞ - csat(T)) / csat(T)
supersaturationPct = 100 σ∞
```

である。`c∞` と `csat(T)` はともに水蒸気の数密度 [m⁻³]（同じ式は質量密度にも適用可）で、
`σ∞` は無次元、API/UI の `supersaturationPct` は % である。Libbrecht 2008 の実測上限を
有限の教育用領域として採り、入力範囲を `[0, 30] %` とする。0 % は氷に対する飽和であり、
正の成長駆動力がない端点である。30 % は自然界の普遍的上限ではなく、参照測定が覆う有限の
製品上限である。

有限な範囲外入力は `[0,30]` へクランプし、NaN と ±Infinity は `TypeError` とする。
ダイヤグラム正規化座標は

```text
x = (temperatureC + 30) / 30
y = supersaturationPct / 30
```

で、いずれも `[0,1]`。逆変換は `temperatureC=30x-30`、
`supersaturationPct=30y` とする。往復許容誤差は Float64 演算で絶対 `1e-12`。

`supersaturationPct` を Reiter の `β` または `γ` と同一視しない。写像値・補間法・形態領域の
閾値は T1-7 で固定する Figure 2 の観測との比較を行う T1-8/T1-10 で較正・検証し、
較正であることを明記する。
ただし平衡端点 `supersaturationPct=0` は `β=0, γ=0` に固定し、中心 seed 以外が成長しない
ことを較正の境界条件とする。これは S1 p. 6 の既知ケースとも一致する。

## 4. 採用 CA と状態量

Reiter の標準 `α=1` の二段階、最近傍六角 CA を採用する。格子全体を計算し、60° セクターの
複製は禁止する。

各セル `i` は次を持つ。

| 状態 | 型 | 単位・範囲 | 意味 |
|---|---|---|---|
| `waterMass[i]` | `Float64` | CA 水量単位、`>=0` | Reiter の実数セル値。物理的 kg ではない |
| `ice[i]` | `Uint8` | 0 または 1 | `waterMass>=1` に達した不可逆な氷相 |
| `noise[i]` | `Float64` | `[-1,1)` | seed から一度だけ生成する固定ゆらぎ |
| `stepIndex` | safe integer | call | 完了した `step` 呼出し数 |
| `elapsedCa` | `Float64` | CA step | `dtCa` の累積。有限かつ `>=0` |
| `stopped` | boolean | — | 外縁到達後は true |

格子 metadata は `radius`（2 以上の整数）、直前に完了した step で有効だった `beta`
（`[0,0.95]`）と `noiseAmplitude`（`[0,1]`）、`seed`、固定文字列 `modelVersion =
"reiter-alpha1-xoshiro128ss-1.1-v1"` を持つ。作成直後は `createLattice` に渡した初期値を
記録する。各 step は新しい値を明示的に受け取り、完了時に metadata をその値へ更新する。
`beta` 上限 0.95 と後述の `gamma` 上限 1 は、S1 p. 5、Figure 3 が調べた
`0<=β<=0.95, 0<=γ<=1` の範囲に合わせる。

`ice` は一度 1 になれば 0 に戻らない。ステップ開始時に、氷セル自身または氷セルの最近傍を
持つセルを `receptive` とする。受容セルの水は固定（deposited）され、非受容セルの水だけが
移動可能（mobile vapor）である。氷判定閾値 1、中心 seed の初期値 1、背景値 `β`、受容セル
への面外添加率 `γ` は S1 pp. 4–6 に従う。`β` と `γ` は無次元 CA 水量で、物理過飽和度では
ない。

格子は `h<=radius` の六角形全体。`h=radius` を Dirichlet reservoir ring、
`h<=radius-1` を成長領域とする。初期状態は中心 `waterMass=1, ice=1`、それ以外は `β`。
`radius` は 2 以上の整数とする。

この axial 六角 ring は、S1 pp. 4–5 が用いる「初期 seed から一定 Euclidean 距離」の
固定境界を、格子格納領域と同形にした**数値近似**である。六回方向の境界距離が方向間で
異なり得るため、原著と等価とは主張しない。形態について妥当性を主張する production 半径は
9 節の `radius=115` とし、それ未満の半径は局所則・境界値のテスト用途に限る。T1-9 で
10.3 節の境界形状・境界距離感度を T1-8 の全代表軌跡で検証し、基準を一つでも
満たさなければ、この近似を棄却して原著相当の Euclidean 境界契約へ設計を差し戻す。

## 5. 更新式、時間、安定性

### 5.1 時間単位

`dtCa` の単位は **CA step**（物理秒ではない）で、許容範囲は `(0,1]`。標準値は
`1 ca-step`。UI の成長速度は呼出し間隔を変え、同じ軌跡の各基準ステップでは `dtCa=1` を
維持する。これにより seed と離散軌跡だけで結果を再生できる。非有限値は `TypeError`、
0 以下または 1 より大きい有限値は `RangeError`。

### 5.2 拡散

ステップ開始時の受容判定を `R_i∈{0,1}` とし、

```text
p_i = R_i m_i                  (deposited part)
u_i = (1-R_i) m_i              (mobile part)
u*_i = u_i + (α dtCa / 12) Σ[j∈N(i)] (u_j-u_i)
```

とする。`m_i=waterMass[i]`、`N(i)` は格子内の最近傍である。欠けた外側近傍は自己値と同じ
（zero normal flux）として扱うため和へ寄与しない。内部の次数 6 では

```text
u*_i = (1-α dtCa/2)u_i + (α dtCa/12)Σ6 u_j
```

となり、S1 pp. 6–7 の式に一致する。`α=1` を固定する。係数が非負となる条件は
`0<=α dtCa<=2`。公開範囲 `0<dtCa<=1` はこれを保守的に満たし、非負入力から負値を作らない。

### 5.3 面外添加と境界 reservoir

各 `step` は、その離散条件サンプルを T1-8 の較正写像へ通した `beta`、`gamma`、
`noiseAmplitude=e` と `dtCa` を明示的に受け取る。`beta` は `[0,0.95]`、`e` は `[0,1]`、
`gamma` は `[0,1]` CA 水量/CA step である。

条件変更をその step から反映するため、受容判定と拡散の**前**に reservoir ring `B` だけを
新しい `beta` へ置換して作業入力を作る。

```text
mbar_i = beta (i∈B), otherwise m_i
reservoirExchangePre = Σ[i∈B](beta-m_i)
```

この置換で内部の非受容 mobile 場を `beta_new/beta_old` などで再スケールしてはならない。
内部の受容・deposited 水量、既存の `ice`、過去に形成された形態も再スケールしない。4 節と
5.2 節の `m_i` は、この step 内では `mbar_i` と読み替え、受容判定も作業入力上で行う。
これにより新しい `beta` は当該 step の内部拡散へ直ちに影響する一方、履歴で蓄積した内部場は
局所更新を通してのみ変化する。

セル別添加率は

```text
γ_i = γ (1 + e noise_i)
a_i = R_i γ_i dtCa
m~_i = p_i + u*_i + a_i
```

とする。したがって `γ>=0` なら添加は非負。`e` の候補値は T1-8、最終値は T2-5 の
人間 UI 受け入れ対象であり、
T1-0 では定めない。`e=0` は無ゆらぎの参照計算専用である。

拡散・面外添加の後にも reservoir ring を同じ `beta` へ固定し、Dirichlet 条件を保持する。

```text
m' _i = beta (i∈B)
m' _i = m~_i (otherwise)
reservoirExchangePost = Σ[i∈B](beta-m~_i)
```

`reservoirExchange=reservoirExchangePre+reservoirExchangePost` とし、`beta` の条件変更による
瞬時の外周置換と、その step 中に Dirichlet 値を保つための交換を一つの境界台帳項目へ
含める。氷相は成長領域だけで `ice'_i = ice_i OR (m'_i>=1)`。成長領域
`h=radius-1` に新旧いずれかの氷セルが存在した時点で `stopped=true` とし、そのステップの
結果と台帳を返す。完了時に metadata の `beta` と `noiseAmplitude` を今回値へ更新する。
以後の `step` は状態を変えず、全流量 0 の台帳を返す。reservoir ring 自体を凍結させず、
無音の格子拡張もしない。

### 5.4 独立質量台帳

各ステップは次を返す。

```text
MassLedger {
  beforeTotal
  afterTotal
  diffusionNet
  outOfPlaneInput
  reservoirExchange
  residual
}
```

- `beforeTotal=Σm_i`, `afterTotal=Σm'_i`
- `diffusionNet=Σ(u*_i-u_i)`（閉じた格子グラフでは理論値 0）
- `outOfPlaneInput=Σa_i`
- `reservoirExchange=Σ[i∈B](beta-m_i)+Σ[i∈B](beta-m~_i)`（前項は step 開始時の
  新しい境界値への置換、後項は step 終端の Dirichlet 固定。正が流入、負が流出）
- `residual=afterTotal-beforeTotal-outOfPlaneInput-reservoirExchange`

上記 5 総和はすべて、7 節のセル列挙順（境界和はその部分列）を崩さずに **Neumaier
compensated summation** で集計する。`reservoirExchange` は開始時の全境界差、終了時の
全境界差の順に同じ accumulator へ加える。`residual` の減算順は
`((afterTotal-beforeTotal)-outOfPlaneInput)-reservoirExchange` に固定する。並列 reduction、
通常の逐次 `+=`、処理系依存の列挙順へ置換すると台帳の bit-for-bit 契約と 10 節の誤差評価が
変わるため、別モデル版なしには行わない。

mobile から deposited への相分類は内部移動で総量を変えないため、外部流量の台帳項目には
含めない。相別の量はステップ前後の `vaporBudget` で独立に比較する。

AC-07 の「境界」は有限格子 reservoir ring と、二次元面外からの `γ` 添加の両方を含む。
両者を一つに合算せず別欄にする。`vaporBudget(state)` は `step` の中間値、台帳、Neumaier
accumulator helper を再利用しない。別モジュールで全セルを同じ固定列挙順に独立走査し、
**Kahan compensated summation** により `mobileVapor` と `depositedWater` を別々に求め、
両者を新しい Kahan accumulator へ投入して `totalWater` を求める。`iceCellCount` は整数加算
する。この経路分離により、台帳側と同じ集計バグをオラクルへ複製しない。

## 6. 公開契約

```text
type Seed128 = readonly [uint32, uint32, uint32, uint32] // all-zero は不可
type ModelVersion = "reiter-alpha1-xoshiro128ss-1.1-v1"

type StepControl = {
  temperatureC: number
  supersaturationPct: number
  calibrationId: string
  beta: number
  gamma: number
  noiseAmplitude: number
  dtCa: number
}

type MorphologyMetrics = {
  basalRadiusCells: number
  basalDiameterCells: number
  iceCellCount: number
  perimeterEdges: number
  compactness: number
  tipDensity: number
  aspectRatio: number | null
  armLength: readonly number[]
  armMass: readonly number[]
  armLengthCv: number | null
  armMassCv: number | null
}

normalizeConditions(temperatureC, supersaturationPct)
  -> { temperatureC, supersaturationPct, x, y, clamped }

createLattice({ radius, seed, beta, noiseAmplitude }) -> LatticeState

step(state, { beta, gamma, noiseAmplitude, dtCa })
  -> { state, ledger, reachedEdge }

vaporBudget(state) -> {
  mobileVapor, depositedWater, totalWater, iceCellCount
}

morphologyMetrics(state, thicknessCells?) -> MorphologyMetrics
```

全関数は純粋で入力を書き換えない。状態配列は `Float64Array` / `Uint8Array`。公開入力の
NaN/Infinity は `TypeError`。範囲外をクランプするのは温度と過飽和度だけで、`radius`、
seed、`β`、`γ`、`noiseAmplitude`、`dtCa` の有限な範囲違反は `RangeError`。`β` は
`[0,0.95]`、`γ` は `[0,1]`。安全整数でない半径・step index、配列長不一致、負または非有限の
セル値は `RangeError`/不変条件エラーとし、NaN/Infinity を含む状態を返さない。
`morphologyMetrics` の `thicknessCells` は省略可能だが、指定する場合は有限かつ 0 以上とし、
非有限は `TypeError`、負値は `RangeError` とする。返値の nullable 項目以外はすべて有限値で
なければならない。

## 7. seed と再現性

### 7.1 PRNG の固定

PRNG は S4 の作者参照実装 `xoshiro128**` **version 1.1** とする。旧 version 1.0 は採用しない。
`Seed128` を参照実装と同じ 4×uint32 state とし、全ゼロ state は `RangeError`。`rotl(x,k)` は
32-bit 左回転、乗算・shift・xor の各結果は modulo `2^32` の unsigned 値へ正規化する。
遷移前 state を `[a,b,c,d]` とすると、1 回の出力と遷移を次の順序に固定する。

```text
output = rotl(b * 5, 7) * 9
t = b << 9
c1 = c xor a
d1 = d xor b
b1 = b xor c1
a1 = a xor d1
c2 = c1 xor t
d2 = rotl(d1, 11)
nextState = [a1, b1, c2, d2]
```

これは作者版 1.1 が scrambler に `s[1]` を用いる式である。ECMAScript 実装では
`Math.imul` と 32-bit bitwise 演算を用い、`>>>0` で unsigned 化する。各 `output` を
`output/2^32` で `[0,1)` へ変換し、`noise=2*output/2^32-1` とする。

参照内容の固定同定用ベクトルは次のとおり。10 進値はすべて uint32 で、各行の state から
1 回呼び出した output と nextState である。テストの期待値はこの表を直接使い、実装関数から
生成してはならない。

| state | output | nextState |
|---|---:|---|
| `[1,2,3,4]` | `11520` | `[7,0,1026,12288]` |
| `[7,0,1026,12288]` | `0` | `[12295,1029,1029,25165824]` |
| `[12295,1029,1029,25165824]` | `5927040` | `[25179138,12295,540162,2107404]` |
| `[25179138,12295,540162,2107404]` | `70819200` | `[27274249,25704967,31982592,12605441]` |
| `[27274249,25704967,31982592,12605441]` | `2031721883` | `[15224335,29364750,272377353,1125134346]` |

### 7.2 列挙順と再現キー

セル列挙順は `r=-radius..radius`、各 `r` で有効な `q` の昇順。中心を含む全セルについて
ちょうど 1 出力を消費し、noise 配列を状態へ保存する。`step` は PRNG を呼ばない。

再現キーは次の順序付きデータである。

```text
ReplayKey {
  modelVersion: "reiter-alpha1-xoshiro128ss-1.1-v1"
  seed: Seed128
  radius: integer
  initialBeta: number
  initialNoiseAmplitude: number
  controls: readonly StepControl[]
}
```

`controls[n]` は第 `n` step の、クランプ後の `temperatureC`・`supersaturationPct`、その写像を
同定する `calibrationId`、実際に `step` へ渡した `beta`・`gamma`・`noiseAmplitude`・`dtCa`
をすべて保存する。wall-clock 時刻や描画 frame は含めない。共有用のシリアライズでは配列順を
保持し、数値は IEEE 754 binary64 へ round-trip する最短 10 進表現を用いる。再生時は保存済み
数値を `step` へ渡し、将来の較正写像で再計算しない。同じ再現キーは全状態配列と台帳を
bit-for-bit 一致させる。作者参照式、集計順、境界更新順のいずれかを変える場合は
`modelVersion` を更新し、旧 URL を旧版ロジックで再生可能に保つ。

## 8. 形態・対称性指標

指標は成長則とは別モジュールで、`ice=1` のセルだけから求める。

| 指標 | 定義 | 用途 |
|---|---|---|
| `basalRadiusCells` | 原点からの最大 Euclidean 距離 | 成長量・外縁判定の表示 |
| `basalDiameterCells` | `2*basalRadiusCells` | 3D aspect ratio の分母 |
| `iceCellCount` | 氷セル数 | 面積代理 |
| `perimeterEdges` | 氷/非氷間の六角辺数 | 複雑さ |
| `compactness` | `perimeterEdges²/(6π√3 iceCellCount)` | 六角セルの面積と辺長を入れた逆 circularity。同面積で枝分かれほど増加 |
| `tipDensity` | 氷近傍が 1 個だけの氷セル数 / `iceCellCount` | 枝先の代理 |
| `aspectRatio` | 厚み指定済みかつ直径 `>0` のとき `thicknessCells/basalDiameterCells`、それ以外は `null` | 板状/柱状（T1-4 が厚みを供給） |
| `armLength[k]` | 60° セクター k 内の最大半径 | 六腕の長さ |
| `armMass[k]` | セクター k 内の `waterMass` 合計 | 六腕の質量 |
| `armLengthCv` | 6 腕の母標準偏差 / 平均 | 対称性 |
| `armMassCv` | 6 腕の母標準偏差 / 平均 | 対称性 |

セクターは `atan2(z,x)` を 0° の +X 軸から反時計回りに 60° 幅で分割し、境界上は小さい
index へ入れる。中心は腕指標から除く。平均 0 の CV は `null` とする。

`thicknessCells` を省略した場合、または中心 seed だけの初期状態など
`basalDiameterCells=0` の場合は `aspectRatio=null` とする。両条件が同時でも同じであり、0 除算
を行わない。有限な `thicknessCells=0` と正の直径に対しては `aspectRatio=0`。この nullable
契約により正常な初期状態から NaN/Infinity を作らない。呼出し側は `null` を「厚み未確定または
基底面径未成立」と表示し、形態クラス判定へ有限値として渡してはならない。

AC-05 の自動判定は、全 6 腕に氷セルがあり `basalRadiusCells>=10` の状態で
`armLengthCv<=0.15` かつ `armMassCv<=0.15` を「ほぼ揃う」とする。また較正済みの
`noiseAmplitude>0` と固定 seed の受入ケースでは、少なくとも一方の CV が `>1e-6` である
ことを確認し、完全複製を受け入れない。0.15 と `1e-6` は物理定数ではなく、AC-05 の語を
機械判定可能にする製品許容値であり、P2 の人間受入で見た目と矛盾すれば仕様判断へ戻す。

`compactness` は最近傍中心間隔 1 の正六角セルについて、辺長 `1/√3`、面積 `√3/2` を
`P²/(4πA)` へ代入して導いた無次元量である。形態クラスの `compactness`、`tipDensity`、
`aspectRatio` を含む形態クラス閾値は経験的較正値なので T1-8/T1-4/T1-10
へ残す。T1-0 で観測値のように装わない。

## 9. 性能測定条件

200×200 相当は六角半径 115、`1+3R(R+1)=40,021` セルで固定する。production build、
Chrome 最新安定版、前景タブ、電源接続、DevTools 閉、1920×1080・devicePixelRatio 1 を
基準とし、OS、CPU、GPU、RAM、Chrome version を EVIDENCE に記録する。

- domain benchmark: 120 step warm-up 後 600 step、`dtCa=1`。GC を含む wall time の
  p95 が 50 ms 以下（20 step/s）で、平均が 50 ms 以下。状態は外縁到達前の代表的な
  10–50 % 氷占有率を含める。
- UI benchmark: growth と rendering を別 scheduler にし、10 秒間の `requestAnimationFrame`
  gap の中央値が 17.5 ms 以下、25 ms 超の gap が 1 % 以下。growth は 20 step/s を要求し、
  同時にカメラを一定速度で回す。
- 同条件を 3 run 実行し、全 run が合格すること。サーマルスロットリングや background tab
  は無効測定として理由を記録して再実行する。

50 ms、60 fps、200×200、10–20 step/s は `SPEC.md` の性能予算から導く。半径 115 は
40,000 セルへ最も近い完全六角格子として算出した値、17.5/25 ms と 1 % は 60 Hz ブラウザの
スケジューリング揺らぎを許す工学的判定値であり、物理定数ではない。T2-4 で実機測定し、
満たさない場合は計算経路を見直す。

## 10. 独立オラクルと許容誤差

テストケース工程は少なくとも次を、実装対象関数を import しない参照計算で具体化する。

1. **既知値**: 一様な非受容場では拡散後も不変。氷のない十分大きい格子で中央 mobile 値
   0.6、最近傍 0、`dt=1` とすれば、紙上の重み `1/2,1/12` から中央 0.3、各最近傍 0.05、
   総量 0.6 となる。`β=γ=0` は中心 seed 以外に成長しない（S1 p. 6）。
2. **動的境界と保存則**: reservoir 固定と `γ` を無効にした任意の非負場で、pairwise graph
   diffusion の総和は不変。`beta` を変更した小格子では、手で列挙した境界セルについて
   `reservoirExchangePre` と `reservoirExchangePost` を別々に計算し、その和、符号、台帳 residual
   を検査する。内部の非受容セル値が境界置換時に比例再スケールされないことも直接検査する。
3. **非負性・単調性**: 安定域で負値なし、`ice` は 1→0 にならず、`iceCellCount` は減らない。
4. **回転共変性**: `noiseAmplitude=0` で入力を 60° 回転すると出力も同じ回転となる。ただし
   セクター複製の不存在はコード構造レビューでも確認する。
5. **seed**: 7.1 節の固定 state/output 列と一致し、同じ再現キーは
   bit-for-bit 一致、1 bit 異なる seed は noise 配列が異なる。
6. **境界**: reservoir exchange の符号と値を小格子の手計算で検査し、外縁到達後は固定点。
7. **形態のゼロ直径**: 中心 seed だけの紙上集合から半径・直径 0 を独立に導き、厚み省略、
   厚み指定かつ直径 0 の両方で `aspectRatio=null` を要求する。正の直径と厚み 0 では 0、正の
   両値では手計算した商と一致させ、全返値が有限または契約上の `null` であることを検査する。
8. **入力**: 全端点、端点直外、NaN、±Infinity、負値、配列不整合を網羅する。

### 10.1 収支オラクルと丸め許容差

テスト側は `MassLedger` の before/after 値を期待値に流用しない。入力状態と出力状態を
`vaporBudget` の独立 Kahan 経路で再走査し、面外入力と開始時・終了時の reservoir exchange も
テスト専用の直接式で再構成する。production の Neumaier helper を import してはならない。

厳密整数・boolean・seed 再現は完全一致。正規化座標は絶対 `1e-12`。質量収支は

```text
ledgerScale = max(1, |beforeTotal|, |afterTotal|,
                     |outOfPlaneInput|, |reservoirExchange|,
                     diffusionAbsSum, reservoirAbsSum)
tauMass = 256 * Number.EPSILON
          * ledgerScale
```

とする。`diffusionAbsSum=Σ|u*_i-u_i|`、`reservoirAbsSum` は 5.4 節の開始時・終了時の
全境界差の絶対値和で、いずれも台帳と同じ固定順の Neumaier sum で求める内部診断値である。
各集計を compensated summation に固定したため、項数に比例する通常加算の誤差上界ではなく、
各集計の一次丸め、符号のある差の cancellation、最後の 3 回の減算を `256ε` で覆う。この係数は
Float64 の工学的安全率であり、物理・観測誤差や通常 `+=` の採用を隠す許容値ではない。
局所更新の既知値は
`absError<=32*Number.EPSILON*max(1,|expected|)`。Libbrecht 2023 の観測比較では、論文が
示す温度 ±0.2 °C と過飽和度 0.8–1.2 倍を観測不確かさとして別扱いし、数値丸め許容差へ
混ぜない。

### 10.2 動的条件と再現性

同じ初期 state へ `beta` だけが異なる 2 step 以上の `StepControl` 列を与え、各 step の開始時に
新しい境界値が拡散へ使われること、内部場が一括変換されないこと、既存 `ice` が不変であること、
保存した列の再生が台帳を含め bit-for-bit 一致することを検査する。`calibrationId` または保存済み
数値の一つを変えた列は別の再現キーである。

### 10.3 六角 reservoir 近似の感度オラクル

`ρ(q,r)=sqrt(q²+qr+r²)` をセル中心の Euclidean 距離とする。production の
`H_R={h<=R}, B_H={h=R}` に対し、次の独立な比較格子をテスト専用参照計算として作る。

- 境界距離比較 `H_2R`：同じ六角 ring で reservoir までの距離だけを 2 倍にする
- 境界形状比較 `E_R={ρ<=d_R}`：セル数が `H_R` に最も近くなる `d_R` を選び（同数差なら小さい
  `d_R`）、最近傍に `E_R` 外のセルを持つ内側セルを Euclidean reservoir boundary `B_E` とする

#### 比較専用の共通初期化契約

通常の `createLattice` は 6 節および 7.2 節の公開契約を維持する。すなわち、対象格子自身の
列挙順で PRNG を 1 セルにつき 1 回消費する。境界感度比較で `H_R`、`H_2R`、`E_R` をそれぞれ
`createLattice` してはならない。同じ seed でも格子ごとに中心セルまでの PRNG 消費数が異なり、
境界形状・距離と noise 実現が交絡するためである。

代わりに、テスト専用参照契約

```text
createBoundarySensitivityFixture({ radius: R, seed, beta, noiseAmplitude })
  -> { hR, h2R, eR, coordinateDomains, boundaryMasks }
```

を用いる。この契約は production API ではなく、比較用状態を一組として作る。入力の型・範囲と
エラーは `createLattice` と同じで、`R=115` をこのオラクルの承認用半径とする。初期化は次の
順序へ固定する。

1. 比較対象の座標和集合 `U=H_R union H_2R union E_R` を作る。
2. 7.2 節の通常列挙順による `H_R` の座標列を先に置き、その後へ `U minus H_R` を
   `(r の昇順, q の昇順)` で置いた master 列を作る。重複座標は一度だけ含める。
3. 単一の xoshiro128** 1.1 state を `seed` から開始し、master 列の各座標についてちょうど
   1 出力を消費する。7.1 節の変換で得た binary64 `noise` を座標キー付き master field に
   保存する。これにより `H_R` の noise は通常の `createLattice({radius:R,...})` と
   bit-for-bit 一致する。
4. 同じ master field に、中心 `(0,0)` は `waterMass=1`, `ice=1`、それ以外は
   `waterMass=beta`, `ice=0` を一度だけ格納する。境界 mask の違いで初期値を変えない。
5. 各対象格子へ、その格子に含まれる座標の `waterMass`、`ice`、`noise` のビット列を
   再計算せずコピーする。`H_2R` または `E_R` にだけある追加セルも master field の同じ規則で
   初期化し、格子ごとの再 seed・noise 再生成・座標に応じた振幅補正を禁止する。

したがって、任意の二つの比較格子 `D1,D2` と任意の共有座標 `c in D1 intersection D2` で、
初期 `waterMass[c]` と `noise[c]` の IEEE 754 binary64 bit pattern、および `ice[c]` が完全一致
する。3 格子は `seed`、`beta`、`noiseAmplitude`、`modelVersion`、`stepIndex=0`、
`elapsedCa=+0`、`stopped=false` も同一とし、許される初期入力差は座標 domain、reservoir
boundary mask、およびそれらから決まる配列長だけである。

最初の `step` より前に、テスト harness は全 pairwise intersection を走査し、上記 3 状態量を
bit-for-bit 比較する。加えて `H_R` 全座標が同じ入力で通常の `createLattice` が返す 3 状態量と
bit-for-bit 一致すること、追加セルが中心以外の初期化規則を満たすこと、共通 metadata が一致
することを検査する。一つでも不一致なら step を実行せず、感度試験を初期化エラーとして失敗
させる。浮動小数点許容差でこの事前一致検査を緩和してはならない。

T1-8 が候補として選ぶ**すべての代表条件軌跡**について、T1-9 の production 境界採用前に
`R=115` の `H_R`、`H_2R`、`E_R` を上記の一つの fixture から開始し、同一 control prefix で
実行する。各 checkpoint `k` では、3 格子の `stepIndex` が同じ `k` であり、各格子が実行した
`controls[0..k)` の順序、`temperatureC`、`supersaturationPct`、`calibrationId`、`beta`、
`gamma`、`noiseAmplitude`、`dtCa` の文字列および IEEE 754 bit pattern がすべて一致することを
形態指標の比較前に検査する。3 格子には同じ更新式、セル状態型、丸め・集計規則を使い、
checkpoint の wall-clock 時刻や個別格子の半径到達時点を control prefix の区切りに使わない。
いずれかが checkpoint 前に `stopped=true` となった場合も感度試験は不合格とする。これにより
各 checkpoint で意図して変える独立変数は boundary の形状または seed からの距離だけとなる。

形態比較の適用範囲は
`H_R` の最小 reservoir 中心距離の 1/2 以下に `basalRadiusCells` がある checkpoint とする。
この範囲が中谷ダイヤグラムとの形態比較に用いてよい六角 reservoir 近似の妥当範囲であり、
それを越えた状態は外縁到達表示まで継続できるが、較正オラクルには使わない。

各 checkpoint で `basalRadiusCells`、`iceCellCount`、`perimeterEdges`、`compactness`、
`tipDensity` に対し

```text
relativeDifference(a,b) = |a-b| / max(1, |a|, |b|) <= 0.05
```

を `H_R` 対 `H_2R`、`H_R` 対 `E_R` の両方へ要求する。`armLengthCv` と `armMassCv` は、両方が
非 null の checkpoint で絶対差 `<=0.02` とする。5 % と 0.02 は境界近似を受け入れる工学的な
感度上限であって、形態較正値や物理観測誤差ではない。

さらに `noiseAmplitude=0` の各比較格子で、入力状態と control を 60° 回転した 1 step の
`ice` は回転後と完全一致し、`waterMass` は 10.1 節の局所更新許容差内で一致しなければならない。
これは六角格子に期待する回転共変性を検査するもので、六角境界と Euclidean 境界の差が小さい
こと自体は上記の形態指標比較で判定する。

いずれかの代表軌跡・checkpoint・回転検査が一つでも不合格なら、六角 ring の採用を撤回する。
その際は `beta`、`gamma`、ゆらぎまたは上記閾値を不合格回避のために調整せず、原著相当の
Euclidean 境界へ上位設計を差し戻して設計レビューからやり直す。

## 11. 除外・停止条件

- Reiter CA の step を物理秒へ換算しない。
- `β`、`γ`、`noiseAmplitude` の候補値、温度・過飽和度からの写像は T1-8、
  形態クラス閾値は T1-10 の承認前に確定しない。`noiseAmplitude` の最終値は T2-5 で人間が受け入れる。
- c 軸厚み関数は T1-4 まで確定しない。
- 昇華、融解、着氷、併合、潜熱、表面張力、雲スケール輸送を追加しない。
- T1-10 で AC-03/AC-04 を満たせない場合、無断で Gravner–Griffeath 等へ切り替えず、
  上位設計へ差し戻す。
