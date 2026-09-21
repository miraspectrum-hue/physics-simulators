# T1-5 独立した水量収支監査 — 設計

## 1. 責務と上位契約

`vaporBudget(state)` だけを設計・実装する。対象は `SPEC.md` の AC-07（水量収支）と
AC-09（非有限値を返さない）のうち、**単一の保存済み格子状態を独立に監査する部分**である。
Reiter CA の拡散、凍結、境界交換、台帳、停止、再生は T1-6 の責務とする。
T1-2 の成果物は分割前の履歴であり、本設計の承認根拠ではない。上位の優先順位は
`SPEC.md > DESIGN-OUTLINE.md > tasks/T1-0/DESIGN.md > 本書` とする。

基底面の axial 座標は `(q,r)`、六角距離は `h=max(|q|,|r|,|q+r|)`、格子は
`h<=radius`、セル列挙順は `r=-radius..radius` の各行で有効な `q` の昇順とする。
`N(R)=1+3R(R+1)` 個の全セルを監査し、外周 reservoir ring も除外しない。
水量の単位は **無次元の CA 水量**であり、kg、分子数、物理秒へ換算しない。
`iceCellCount` の単位はセル個数である。`beta`、`noiseAmplitude`、seed は入力状態の
妥当性確認に使うが、水量の再較正や再生成には使わない。

設計入力として、Coordinator が T1-2 の未承認テストを収集対象外へ保存した後の
`node scripts/verify-fast.mjs --workspace apps/snow-crystal-sim` は 4 ファイル・24 テストの
Green だった（`tasks/T1-5/EVIDENCE.md`）。本書はテストコードも実装コードも変更しない。

## 2. 公開 API と所有境界

```ts
interface VaporBudget {
  readonly mobileVapor: number;
  readonly depositedWater: number;
  readonly totalWater: number;
  readonly iceCellCount: number;
}

function vaporBudget(state: LatticeState): VaporBudget;
```

`LatticeState` は T1-1 の公開型をそのまま使う。`VaporBudget` の型定義は
`domain/types.ts`、公開 export は `domain/index.ts`、関数本体は
`domain/vapor-budget.ts` が所有する。既存の公開型・export が残っている場合は
同じ契約へ整えるだけとし、重複定義しない。対応テストは
`domain/__tests__/vapor-budget.test.ts` に置く。`reiter-step.ts`、他の domain
計算、他層、上位文書は変更しない。実装とテストは、T1-6 の `step`、`MassLedger`、
その内部更新関数・走査・Neumaier helper を import も共有もしない。

有効入力に対し、4 項目すべてを有限の非負 `number` として返す。
`iceCellCount` は `0..N(R)` の安全整数である。同じ状態の同じ binary64 bit pattern
からは同じ返値を得る。入力オブジェクト、配列、seed tuple は一切変更せず、新しい
結果オブジェクトだけを返す。PRNG は呼ばない。停止済み状態も同じ規則で監査し、
停止フラグによる短絡や固定点処理は行わない。

T1-6 はこの型と関数を**独立監査 API**として呼べるが、`step` 自身の before/after
台帳値を本関数から生成してはならない。テストは T1-6 の入力・出力の各状態を
別々に本関数で走査し、台帳値と外部流量を照合する。これが T1-6 との唯一の依存方向で、
T1-5 から T1-6 への依存はない。

## 3. 相分類と集計式

保存済み `ice[i]` は 0 または 1。`waterMass[i]=m_i>=0` とする。格子内の
最近傍集合を `N(i)` とし、状態の **現在の氷配置**から

```text
R_i = 1  if ice[i]=1 or any ice[j]=1 for j in N(i)
      0  otherwise
mobileVapor    = Σ_i (1-R_i) m_i
depositedWater = Σ_i R_i m_i
totalWater     = mobileVapor + depositedWater = Σ_i m_i   （実数演算での恒等式）
iceCellCount   = Σ_i ice[i]
```

を求める。受容セルは氷セル自身と、その 6 近傍に氷セルがある非氷セルである。
「氷セル数」は受容セル数ではない。受容セルの `waterMass` 全体を deposited とし、
水蒸気のうちどの割合が凍ったかを別途推定しない。非受容セルの全 `waterMass` を mobile
とする。外周 ring も通常のセルと同じ受容判定をするが、T1-6 の終端固定や流量計算を
ここで行わない。ただし外周 ring の `ice` は T1-0 §5.3 により常に 0 であり、
`ice=1` の外周状態は集計前に拒否する。欠けた格子外近傍は氷ではなく、
領域外の仮想水量も加算しない。

`R_i` の判定には T1-1 の座標・index 幾何 API または同じ axial 近傍定義を使えるが、
T1-6 の受容 mask/分類 helper を流用しない。**全格子**を固定した列挙順で走査し、
60° セクターの複製や境界の除外をしない。`waterMass` の閾値から `ice` を再計算せず、
保存済みの `ice` を分類の唯一の相フラグとする。したがって監査は氷相への内部移動を
外部流入・流出と誤認しない。

`mobileVapor` と `depositedWater` は、別々に初期値 `(sum=+0,
compensation=+0)` の **Kahan compensated summation** を使う。各セルを分類した側の
accumulator へ `m_i` を 1 回だけ投入し、走査順を固定する。両相の確定値を、さらに
新しい Kahan accumulator へ `mobileVapor`、`depositedWater` の順に投入して
`totalWater` を求める。ice 数だけは安全整数加算する。通常の `+=`、Neumaier、並列
reduction、異なるセル順への置換は bit-for-bit の再現性を変えるので認めない。
各投入値 `x` に対する演算順も `y=x-compensation; t=sum+y;
compensation=(t-sum)-y; sum=t` に固定し、確定値は `sum` とする。
空の相または水量 0 の結果は `+0` に正規化する。入力の `-0` は非負の 0 として認める。

これは二次元 CA 内の数値的な相分類・収支診断であって、水蒸気の実測量、相変化潜熱、
三次元の質量保存を推定するものではない。Reiter の対象外である昇華・融解・着氷・併合も
扱わない。

## 4. 入力検証、例外、overflow

公開 TypeScript 型にかかわらず、JavaScript 呼出し・改変された状態を同期的に検証する。
部分的な `VaporBudget` は返さず、例外時にも入力を変更しない。複数不正があるときは
次の順で最初の不正を報告する。エラー文言は契約にせず、**例外 class と対象 field**を
テストする。

1. `state` は null でないオブジェクト（配列は不可）。違反は `TypeError`。
2. `radius` は有限の number、2 以上の安全整数で、`N(R)` も安全整数。
   非数値・NaN・±Infinity は `TypeError`、有限な非整数・範囲外・セル数 overflow は
   `RangeError`。
3. `waterMass` と `noise` は `Float64Array`、`ice` は `Uint8Array` で、
   それぞれ長さが `N(R)`。型違いは `TypeError`、長さ違いは `RangeError`。
   検査順は `waterMass`、`ice`、`noise`。
4. metadata を `stepIndex`、`elapsedCa`、`stopped`、`beta`、
   `noiseAmplitude`、`modelVersion`、`seed` の順に検証する。`stepIndex` は 0 以上の
   安全整数、`elapsedCa` は有限・非負の CA step、`stopped` は boolean、`beta` は
   `[0,0.95]`、`noiseAmplitude` は `[0,1]`、`modelVersion` は
   `reiter-alpha1-xoshiro128ss-1.1-v1` と完全一致。`seed` は長さ 4 の Array で、
   各成分が uint32 整数かつ全ゼロでない。非数値・非有限の scalar は `TypeError`、
   有限だが範囲違反の scalar と全ゼロ seed は `RangeError`、shape・boolean・version
   の型／値違いは `TypeError`。seed 成分は index 0〜3、最後に all-zero を調べる。
5. index 0 から順に各セルの `waterMass[i]`、`ice[i]`、`noise[i]` を検証する。
   `waterMass` は有限・非負、`ice` は 0 または 1、`noise` は有限かつ `[-1,1)`。
   `ice[i]=1` かつ当該セルの `h(q,r)=radius` なら、外周 reservoir ring の
   不変条件違反として `RangeError` にする。各 index では `waterMass`、`ice` の
   0/1、外周氷禁止、`noise` の順に検査し、次の index へ進む。
   不正値は状態不変条件違反の `RangeError` とする。これは T1-0 §6 の
   「負または非有限のセル値は RangeError／不変条件エラー」という、単独 scalar より
   具体的な規定を適用する。`Uint8Array` は代入時に値を変換するので、氷の非整数・NaN
   などは **配列へ入る前に変換済み**であり、この API では 0/1 以外を拒否する。

監査は保存済み `ice` に従う。`waterMass>=1` と `ice=1` の一致や ring の現在値が
`beta` と等しいことまでは再検証しない。前者は T1-6 の相遷移責務であり、後者は
step 開始前に ring が再置換される場合もあるため、ここで水量を書き換えたり
分類を変更したりしない。ただし負値・非有限値・不正な氷値は拒否する。
外周 ring の `ice=1` は、保存済み相フラグとして 0/1 の範囲内でも拒否する。

検証が完了してから集計する。いずれかの Kahan 演算の中間値または確定した相別／総量が
非有限なら `RangeError` とし、返値を公開しない。有限な各セル値でも数学的な合計が
binary64 の最大有限値を超える場合を含む。`iceCellCount` の安全整数性も確認する
（`N(R)` の上限から通常は自動的に従う）。有限範囲への飽和、`Infinity` の返却、
水量の黙示的な削除はしない。どの例外でも入力全フィールドの bit pattern を保持する。

## 5. 独立オラクル、許容差、再現性

テストケース工程では本関数・T1-6 の関数を期待値生成に import しない。
少なくとも次の互いに独立な観点を具体化する。

1. **紙上の位相・既知値**: 半径 2 の 19 セル、中心だけ氷、他セルの水量を
   `β=2/5` とすると、中心と 6 近傍の 7 セルが受容、残り 12 セルが非受容。
   実数演算では deposited=`1+6(2/5)=17/5`、mobile=`12(2/5)=24/5`、
   total=`41/5`、氷セル数 1。ring も含める。中心以外の氷を手で配置した非一様場、
   停止済み場、氷なしの場も独立に分類し、氷セル数と受容セル数の混同を検出する。
2. **保存・分割の性質**: 全セルの水量を厳密有理数（2 の冪の分母なら binary64
   にも正確）として別経路で合計し、mobile + deposited が総量に一致することを調べる。
   水量を変えず氷配置だけ変えれば total は不変で、相別の内訳だけが変わる。
   60° 回転した入力では各相量・氷セル数が不変。格子外隣接は受容にしない。
3. **数値計算**: テスト専用の整数／有理数または高精度参照集計と比較する。
   `2^53` と小さな 1 の加算のような単純逐次 `+=` が失う低位項を含め、
   Kahan の採用を直接検出する。大きい有限値の集合で集計 overflow を起こし、
   `RangeError` と入力不変を確かめる。
4. **不正入力**: 4 節の shape、全 scalar の端点・端点直外・NaN/±Infinity、
   seed、3 配列の長さと成分、複合不正での検証順を表で網羅する。半径 2 の
   外周角 `(q,r)=(2,0)` と外周辺の非角セル（例 `(1,1)`）で、それぞれ
   `ice=1` を `RangeError` とし、直内側の `h=1` にある氷は受け入れる。
   外周氷と同じ index の不正な `waterMass`／`noise`、別 index の不正値を
   組み合わせ、規定の検証順も確認する。
   各失敗の前後で metadata と typed array の bit pattern を比較する。

既知値の有限 `number` との比較は T1-0 §10.1 の局所数値許容差
`|actual-expected| <= 32*Number.EPSILON*max(1,|expected|)` を使う。
厳密な整数、boolean、例外 class、モデル版、入力不変、同一入力の再現は完全一致とする。
T1-6 台帳との照合では T1-0 §10.1 の `tauMass=256*Number.EPSILON*ledgerScale`
をそのまま用い、観測誤差と混ぜない。これらは IEEE 754 binary64 の丸めを覆う
工学的許容値であって、物理観測との一致判定ではない。Kahan の演算順・列挙順を
固定すること自体が bit-for-bit 再現性の条件である。乱数は使わず、seed は状態の
妥当性確認のみで、監査時の PRNG 消費は 0 とする。

## 6. 出典、妥当範囲、未確定事項

- 相分類、受容セル、`β` の意味、二次元 CA の適用範囲は T1-0 §2 S1 に固定した
  C. A. Reiter (2005), *A Local Cellular Model for Snow Crystal Growth*,
  pp. 4–7（[著者公開版](https://webbox.lafayette.edu/~reiterc/mvp/sfn/sfn_pp.pdf)、
  DOI [10.1016/j.chaos.2004.06.071](https://doi.org/10.1016/j.chaos.2004.06.071)）による。
- 補償和と binary64 丸め評価は T1-0 §2 S3 の N. J. Higham,
  *Accuracy and Stability of Numerical Algorithms*, 2nd ed. (2002), Chapters 2, 4
  （DOI [10.1137/1.9780898718027](https://doi.org/10.1137/1.9780898718027)）を
  数値解析上の根拠とする。Kahan 集計の具体的な採用と順序は T1-0 §5.4 の製品契約である。

半径 2 以上、有限・非負の CA 水量、固定の全六角格子だけに適用する。
production の形態妥当性は T1-0 が指定する半径 115 と T1-3 の境界感度審査に依存し、
この収支監査だけで形態の観測的一致を証明しない。`β`・`γ` と実際の温度・過飽和度の
経験較正値、c 軸厚み、融解・昇華などは未決定のまま保持する。

本設計に、上位の物理式・単位・数値法を変更する未解決判断はない。
