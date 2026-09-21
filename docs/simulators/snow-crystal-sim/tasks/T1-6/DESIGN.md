# T1-6 成長 step と収支台帳 — 設計

## 1. 責務と権威

本タスクは、保存済みの全六角格子を 1 CA step だけ進める純粋関数 `step` を設計する。
Reiter `α=1` の拡散、受容セルへの面外添加、不可逆な凍結、外縁停止、独立した質量台帳が対象である。
`SPEC.md` の AC-06（同じ seed・軌跡の完全再現）、AC-07（外部流量を分けた収支）、
AC-09（非有限値を返さない）を担う。温度・過飽和度からの経験的なパラメータ写像、
形態指標、描画、UI は扱わない。

権威は `SPEC.md > DESIGN-OUTLINE.md > tasks/T1-0/DESIGN.md` とその `DECISIONS.md`
`> tasks/T1-1/DESIGN.md > 本書` の順である。T1-5 の承認済み `DESIGN.md` は
独立監査 API の契約として参照する。分割前の T1-2 文書・テスト草稿は履歴であり、
本書の承認根拠にしない。実行プロファイルは `full`、UI 影響はない。
開始時ベースラインは T1-6 `EVIDENCE.md` の 5 ファイル・57 テスト Green である。

## 2. 出典、座標、単位、適用範囲

- 成長則の一次資料は C. A. Reiter, “A Local Cellular Model for Snow Crystal Growth,”
  *Chaos, Solitons & Fractals* 23(4), 1111–1119 (2005),
  [DOI 10.1016/j.chaos.2004.06.071](https://doi.org/10.1016/j.chaos.2004.06.071)、
  [著者公開版](https://webbox.lafayette.edu/~reiterc/mvp/sfn/sfn_pp.pdf)
  “Model and Parameter Diagram” pp. 4–6、 “Variation on Diffusion” pp. 6–7 である。
  六角最近傍、受容セル、`β`、`γ`、固定背景境界、`α=1` の更新則を採る。
- binary64 の丸めと補償和は N. J. Higham, *Accuracy and Stability of Numerical
  Algorithms*, 2nd ed. (2002), Chapters 2, 4,
  [DOI 10.1137/1.9780898718027](https://doi.org/10.1137/1.9780898718027)
  を数値解析上の根拠とする。Neumaier と集計順の選択は T1-0 §5.4 の製品契約である。
- 初期 noise は T1-1 が、D. Blackman and S. Vigna, *ACM TOMS* 47(4), Article 36
  (2021), [DOI 10.1145/3460772](https://doi.org/10.1145/3460772) と
  [作者版 xoshiro128** version 1.1](https://prng.di.unimi.it/xoshiro128starstar.c)
  に従い生成済みである。`step` は PRNG を呼ばない。

axial 座標 `(q,r)` の cube 表現は `(q,-q-r,r)`、六角距離は
`h=max(|q|,|r|,|q+r|)`。半径 `R>=2` の格子 `H_R={h<=R}` は
`N=1+3R(R+1)` セルで、`h=R` の `6R` セルが Dirichlet reservoir ring `B`、
`h<=R-1` が成長領域である。格子外の隣接は無流束とし、受容氷とみなさない。
近傍差分とその順は T1-1 §4.1 の 6 方向、全セル順は `r=-R..R` の各行で
`q` 昇順に固定する。格子全域を計算し、60° sector の反転・回転複製はしない。

`waterMass`、`β`、1 step 当たりの `γ`、台帳は無次元の CA 水量（kg ではない）。
`dtCa` と `elapsedCa` は CA step（秒ではない）。`noise` は固定無次元値 `[-1,1)`、
`noiseAmplitude=e` は無次元、`ice` は 0/1、`stepIndex` は呼出し回数である。
正の reservoir exchange と面外添加は格子への**流入**、負は**流出**を表す。
本モデルは一様な外部条件にさらされる単一結晶の二次元基底面形態の近似であり、
実時間の成長速度、三次元質量、融解、昇華、雲輸送を予測しない。
六角 ring は原著の等 Euclidean 距離境界と同値ではない。形態妥当性を主張する
production 半径 115 と、その境界感度の T1-3 承認前検査は T1-0 §4、§10.3 を維持する。

## 3. 公開型、関数、所有境界

```ts
interface StepParameters {
  readonly beta: number;            // [0, 0.95], CA 水量
  readonly gamma: number;           // [0, 1], CA 水量 / CA step
  readonly noiseAmplitude: number;  // [0, 1]
  readonly dtCa: number;            // (0, 1], CA step
}

interface MassLedger {
  readonly beforeTotal: number;
  readonly afterTotal: number;
  readonly diffusionNet: number;
  readonly outOfPlaneInput: number;
  readonly reservoirExchange: number;
  readonly residual: number;
}

interface StepResult {
  readonly state: LatticeState;
  readonly ledger: MassLedger;
  readonly reachedEdge: boolean;
}

function step(state: LatticeState, parameters: StepParameters): StepResult;
```

`LatticeState` は T1-1 の既存公開型をそのまま使う。`StepParameters`、
`MassLedger`、`StepResult` は `domain/types.ts` に追加し、`domain/index.ts` は型と
`step` を明示的に再 export する。関数本体と private Neumaier helper は
`domain/reiter-step.ts` に置く。対応する T1-6 テストだけを
`domain/__tests__/reiter-step.test.ts`、`mass-conservation.test.ts`、`replay.test.ts`
に置ける。実装工程の編集境界はこれらと公開型・export に限り、
`vapor-budget.ts`、T1-1 の格子・PRNG 実装、他層、上位文書を変更しない。

`step` は `vaporBudget`、その Kahan helper、集計結果を import せず、台帳を独自に
作る。`vaporBudget` はテスト側から入力・出力状態を独立に監査するためだけに使える。
温度・過飽和度または `calibrationId` を `step` へ渡さない。それらは後続 app 層の
`StepControl` / `ReplayKey` に、渡した実数パラメータと一緒に記録する。

## 4. 1 step の更新順と境界

以下のすべてのセル式は、`i=0..N-1` の**旧状態**と、その step の単一
`parameters` に対する同時更新である。`N(i)` は格子内最近傍、`R_i` は旧 `ice`
により決まる受容 mask である。ループ途中に得た新 `ice` を別セルの拡散・受容へ
伝播させない。

1. **前置 reservoir 交換**: 作業入力を `mbar_i=beta` if `i in B`、それ以外は
   `mbar_i=m_i` とする。旧 `m_i=state.waterMass[i]`。旧状態の metadata `beta`
   ではなく今回値を使う。`pre_i=beta-m_i` を ring だけで集計する。内部水量・氷・
   noise は一括再スケールしない。ring の旧値が今回 `beta` と等しい必要はない。
2. **受容・相分割**: `R_i=1` iff `ice_i=1` または旧 `ice_j=1` for some `j in N(i)`。
   `p_i=R_i mbar_i` を deposited、`u_i=(1-R_i)mbar_i` を mobile とする。
   ring も同じ規則で受容判定する。したがって氷に隣接する ring の mobile は 0 に
   なり得るが、ring 自体を凍結させない。
3. **拡散**: `α=1` 固定で

   ```text
   c = dtCa/12
   u*_i = u_i + c Σ[j in N(i)](u_j-u_i)
        = (1-c degree(i))u_i + c Σ[j in N(i)]u_j
   ```

   とする。実装時は非負係数の右側の凸結合形を使い、T1-1 の近傍順で存在する
   近傍の `u_j` を加える。欠けた近傍は自己値で埋めた無流束と同値である。
   最大 degree 6、`dtCa<=1` なので自己係数は `>=1/2`、近傍係数は非負。
   各セルの `u*_i-u_i` を、セル順に `diffusionNet` へ加える。理論上の閉グラフ
   拡散和は 0 であり、浮動小数点上の微小な符号付き値を 0 に丸めて隠さない。
4. **面外添加**: `gamma_i=gamma*(1+noiseAmplitude*noise_i)`、
   `a_i=R_i*gamma_i*dtCa`、`mtilde_i=p_i+u*_i+a_i` とする。
   `a_i` は全受容セル（ring を含む）で非負。`outOfPlaneInput=Σ_i a_i`。
   既に凍ったセルも受容セルであり、量を維持したまま添加を受ける。
5. **後置 reservoir 交換と凍結**: `post_i=beta-mtilde_i` を ring だけで集計し、
   `mprime_i=beta` if `i in B`、それ以外は `mtilde_i`。ring `iceprime_i=0`、
   成長領域 `iceprime_i=ice_i OR (mprime_i>=1)`。氷は 1→0 にならない。
   `reservoirExchange` はすべての `pre_i` をセル順、その後にすべての `post_i` を
   セル順で同じ accumulator へ入れた確定値である。
6. **停止・metadata**: 終端で `h=R-1` に旧または新 `ice=1` が一つでもあれば
   `stopped=true`、`reachedEdge=true` として、この step の計算結果・台帳も返す。
   それ以外は双方 false。`stepIndex` を 1 増やし、`elapsedCa` に `dtCa` を加え、
   `beta` と `noiseAmplitude` を今回値へ更新する。`radius`、初期 `seed`、
   `modelVersion`、全 `noise` 値は不変である。

`beta=gamma=0` の平衡端点では、T1-0 の中心 seed から新しい氷を作らない。
`gamma=0` でも mobile の拡散・deposited の既存蓄積は進み得るため、任意の途中状態の
全セルが固定点であるとは主張しない。`dtCa=1` が標準軌跡、`0<dtCa<1` も
同じ式で 1 回の呼出しとして扱う。`dtCa` を実時間速度へ換算しない。

## 5. 収支台帳と丸め

```text
beforeTotal       = Σ_i m_i
afterTotal        = Σ_i mprime_i
diffusionNet      = Σ_i (u*_i-u_i)
outOfPlaneInput   = Σ_i a_i
reservoirExchange = Σ[i in B](beta-m_i) + Σ[i in B](beta-mtilde_i)
residual          = ((afterTotal-beforeTotal)-outOfPlaneInput)-reservoirExchange
```

`beforeTotal`、`afterTotal`、`diffusionNet`、`outOfPlaneInput` の 4 総和はそれぞれ
独立した Neumaier accumulator に全セルを固定順で投入する。`reservoirExchange` は
前置の ring 全項、後置の ring 全項の順で一つの Neumaier accumulator に投入する。
各 accumulator は `sum=+0, correction=+0` から開始し、各 `x` について
`t=sum+x`、`|sum|>=|x|` なら `correction+=(sum-t)+x`、そうでなければ
`correction+=(x-t)+sum`、`sum=t`、確定値は `sum+correction` とする。
項の順・分岐・演算順・確定値の式は同一再現キーの bit-for-bit 契約に含める。
空項と計算結果が厳密に 0 の項は `+0` に正規化するが、有限な非零の
`diffusionNet` や `residual` を許容差内という理由だけで 0 にしない。

相分類 `p/u` の変更と凍結は内部の再ラベルで外部流量ではない。
`diffusionNet` は数値診断欄であり、`residual` の減算式へさらに引かない。
理論上 `diffusionNet=0`、`after-before=outOfPlaneInput+reservoirExchange`。
この等式を binary64 で比較するときは T1-0 §10.1 の

```text
ledgerScale = max(1, |beforeTotal|, |afterTotal|,
                  |outOfPlaneInput|, |reservoirExchange|,
                  diffusionAbsSum, reservoirAbsSum)
tauMass = 256 * Number.EPSILON * ledgerScale
```

を使う。`diffusionAbsSum=Σ_i |u*_i-u_i|`、`reservoirAbsSum` は前置・後置の
全 ring 差の絶対値和で、診断計算も同じ順の Neumaier とする。
これは binary64 丸めの工学的安全率であり、観測の不確かさではない。
セル局所既知値は `32*Number.EPSILON*max(1,|expected|)` の絶対誤差を使う。
整数・boolean、同一再現キーの配列・台帳・metadata bit pattern は完全一致を要求する。
通常 `+=`、並列 reduction、異なる総和順、`vaporBudget` の Kahan helper への統合はしない。

## 6. 停止済み状態、純粋性、再現

`state.stopped=true` なら、**入力状態と今回 parameters をすべて検証した後に**
固定点を返す。次 `state` は全値・全 bit pattern が入力と等しく、`stepIndex`、
`elapsedCa`、`beta`、`noiseAmplitude` も変えない。`reachedEdge=true`、台帳の
`beforeTotal` と `afterTotal` は入力全セルを独自 Neumaier で走査した同じ値、
`diffusionNet`、`outOfPlaneInput`、`reservoirExchange`、`residual` は `+0` とする。
停止後は新しい `beta` への ring 置換も `gamma` 添加もしない。

有効入力でも、入力 object、typed arrays、seed tuple、過去の出力を変更しない。
返す `state` は新しい object と全 3 typed array および seed tuple のコピーを所有する。
停止時も同じで、返値と入力間に変更可能な配列参照を共有しない。
`step` は `Math.random`、`nextXoshiro128ss`、時計、browser/global state を一切使わず、
保存済み固定 noise を読み取るのみである。同じ有効状態とパラメータ列では
全 step の配列・台帳・metadata が bit-for-bit 一致する。再生キーと
`modelVersion` の変更規則は T1-0 §7.2 のままとする。

## 7. 検証順、例外、overflow

公開 TypeScript 型に依存せず JavaScript 呼出しを同期的に検証する。部分結果を返さず、
失敗時の入力全フィールドの bit pattern を保持する。複数不正があるときの先着順は次とする。

1. `state` を T1-5 `DESIGN.md` §4 の検証順で**全体**検証する。すなわち object shape、
   半径と安全な `N(R)`、`waterMass` / `ice` / `noise` の型と長さ、
   `stepIndex`、`elapsedCa`、`stopped`、`beta`、`noiseAmplitude`、
   `modelVersion`、seed 4 成分と all-zero、index 昇順の `waterMass` / `ice` /
   外周氷禁止 / `noise` である。scalar の型違い・NaN・±Infinity は `TypeError`、
   有限な範囲違反、非 safe integer、配列長違い、セル不変条件違反は `RangeError`。
   配列型・shape・boolean・version 違いは `TypeError`。`waterMass>=1` と
   `ice=1` の一致、および旧 ring 値と `state.beta` の一致は要求しない。
2. `parameters` は null でない非配列 object。違反は `TypeError`。
   `beta`、`gamma`、`noiseAmplitude`、`dtCa` の順で検証する。各値は number かつ
   有限で、そうでなければ `TypeError`。有限値の範囲違反は `RangeError`。
   `beta∈[0,0.95]`、`gamma∈[0,1]`、`noiseAmplitude∈[0,1]`、`dtCa∈(0,1]`。
   有効な端点 `beta=0/0.95`、`gamma=0/1`、`e=0/1`、`dtCa=1` は受け入れる。
   `dtCa=Number.MIN_VALUE` も有限で正なら有効である。
3. `state.stopped=false` の場合に限り、`stepIndex+1` の安全整数性、
   `elapsedCa+dtCa` の有限性を確認する。overflow は `RangeError`。
   有効な非常に小さい `dtCa` が丸めにより `elapsedCa` を変えないことは許す。
4. 更新中に、有限入力でも `gamma_i`、添加、セル候補値、台帳の途中値または確定値、
   `residual` が非有限になったら `RangeError`。負の `waterMass` 候補が生じても
   `RangeError` とし、飽和・clamp・負値切り捨てで隠さない。有限な `beta` でも
   総量が binary64 最大値を超える場合は返値を出さない。

停止済みであっても無効な parameters を無視して成功してはならない。
ただし停止済み状態では `stepIndex+1` と `elapsedCa+dtCa` を実行しないため、
その加算が overflow する組合せは固定点を返せる。停止時の `beforeTotal` 集計
自体が overflow すれば `RangeError` とする。エラー文面は契約にせず、
例外 class と最初の対象 field を検査する。

## 8. 独立オラクルと次工程への要求

テストケース工程は本書の数値を production `step` から生成しない。少なくとも次を
相互に独立した検査として具体化する。

1. **紙上既知値**: 半径 2 の 19 セル、中心氷、6 受容隣接、12 非受容、12 ring を
   literal 座標と質量で表す。`beta=2/5`、`gamma=0` と正の `gamma`、`dtCa=1`
   と分数値で、受容と mobile の局所更新・外周後置固定を算出する。
2. **グラフ独立参照**: テスト専用の座標→index Map と無向辺列を作り、各辺で
   `c(u_j-u_i)` / `c(u_i-u_j)` を同時加算する pairwise flux から、全セルの
   `u*` を独立生成する。受容による `p/u` 分割と前置・後置 ring 固定も
   テスト専用に実施する。半径 2 の全辺 42、ring-to-inner 辺 18 を確認し、
   半径 7 の ring-to-inner 辺 78 を別ケースで確認する。全セルを局所許容差で照合する。
3. **収支と境界符号**: 入力・出力を T1-5 `vaporBudget` で別々に監査し、
   テスト専用の前置差、後置差、`gamma_i` 添加を再構成する。
   境界 `beta` 増減の両符号、前置と後置の個別符号、境界値と内部場の非再スケール、
   `|diffusionNet|` と `|residual|<=tauMass` を検査する。
   台帳値を期待値へ流用しない。
4. **不変性**: 非負性、氷の単調性、ring 氷禁止、60° 回転共変性（`e=0`）、
   全格子の計算とセクター複製の不在を、値とコード構造の両方で確認する。
5. **停止・再生**: 外縁 `h=R-1` の新氷で停止する step 自体の結果・台帳を検査し、
   次の呼出しは全量 0 の固定点にする。T1-0 の `ReplayKey` に対応する同じ
   seed と control 列で、全状態と台帳を bit-for-bit 比較する。初期 noise、
   seed、`modelVersion` が step により変わらず、PRNG 消費がないことを確認する。
6. **境界・異常系**: §7 の全 scalar の端点・端点直外、NaN/±Infinity、型違い、
   state 配列型・長さ・成分・metadata、複合不正での先着順、停止済みでの不正入力、
   `stepIndex` / `elapsedCa` / セルと全量の overflow を検査する。
   失敗前後で入力全体を bit-for-bit 比較する。

全相と質量をテスト用参照計算だけで作り、`step` の private helper を import しない。
T1-5 の Kahan 経路と `step` の Neumaier 経路は独立のまま保持する。
ベースライン Green → 承認済みテストの期待どおりの Red → 実装後 Green と全検証を
`EVIDENCE.md` に記録する。上位の物理式・単位・近似・受入基準を変える未解決判断はない。
