# T1-0 数値モデル契約テストケース

## 1. 目的、権威、実装時期

本書は `SPEC.md`、`DESIGN-OUTLINE.md`、本タスクの `DESIGN.md` と `DECISIONS.md`、および
`REVIEW.md` の最新 `status: approved` の設計レビューだけを入力として、数値モデル契約を
後続タスクで実装できる機械判定可能なテストへ展開する。式、単位、適用範囲、近似、出典は
`DESIGN.md` の S1〜S4 と各契約節を正とし、ここでは期待値を作る手順と判定条件を固定する。

T1-0 の変更境界は文書だけであり、`apps/` のコードを変更しない。したがって本書のケースを
T1-0 中に未作成の production module へ import して Red にしてはならない。各ケースの
テストコードは表中の後続タスクで、そのタスクの baseline Green の後に追加する。Red は
対象 API が存在した状態での期待した assertion failure とし、`module-not-found`、構文エラー、
依存不足を Red の証拠にしない。

| ケース群 | 実装する後続タスク | 主な候補ファイル |
|---|---|---|
| TC-NORM、TC-HEX、TC-RNG-001、TC-RNG-002A、TC-CREATE | T1-1 | `src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts`、`hex-lattice.test.ts`、`prng.test.ts`、`lattice.test.ts` |
| TC-MASS の独立 `vaporBudget` | T1-5 | `src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts` |
| TC-DIFF、TC-BETA、TC-GAMMA、TC-FREEZE、TC-MASS の step 台帳、TC-INVARIANT、TC-STOP、TC-REPLAY、TC-RNG-002B | T1-6 | `src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts`、`mass-conservation.test.ts`、`replay.test.ts` |
| TC-MORPH | T1-3 | `src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts` |
| TC-ROT、TC-SENS | T1-9 | `src/simulators/snow-crystal-sim/domain/__tests__/boundary-sensitivity.test.ts` |
| TC-SYMMETRY | T2-5 | `src/simulators/snow-crystal-sim/domain/__tests__/symmetry.acceptance.test.ts` |
| TC-PERF | T2-4 | `src/simulators/snow-crystal-sim/app/__benchmarks__/domain-step.bench.ts`、`app` 層のブラウザ性能 harness |
| TC-REPLAY-KEY | T4-2 | `src/simulators/snow-crystal-sim/app/__tests__/replay-url.test.ts`、`app/replay-url.ts` |

T1-8 で確定する経験的写像候補と代表条件軌跡、T1-10 で検証する形態クラス閾値を本書では仮定しない。
該当ケースは、T1-8 の承認済み成果物が列挙する**全代表軌跡**をパラメータ化入力として使う。

## 2. 共通オラクルと許容誤差

### 2.1 実装経路からの独立性

- 期待値の生成に、検査対象の関数、production の Neumaier/Kahan helper、production の
  座標列挙 helper、production の PRNG を import しない。
- 六角座標の参照実装はテスト内の整数式
  `h=max(abs(q),abs(r),abs(q+r))` と固定近傍差分
  `{(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)}` を直接使う。
- 拡散の参照計算は production のセル中心 neighbor reduction と別経路にする。テスト側で
  座標 Map と無向最近傍 edge を一度だけ列挙し、各 edge の flux
  `f=dtCa*(u_j-u_i)/12` を `i` に加え `j` から引く pairwise graph 計算を使う。
- 台帳の before/after は入力・出力配列をテスト専用 Kahan accumulator で再走査する。
  `gamma` 添加、開始時 reservoir 交換、参照 edge 拡散、終了時 reservoir 交換はテスト内の
  直接式で再構成する。production ledger の値から期待値を逆算しない。
- PRNG の既知値は `DESIGN.md` 7.1 の固定表を literal として持つ。seed 決定性の期待 noise を
  production PRNG で別途生成しない。

### 2.2 判定量

- 整数、boolean、列挙座標、`ice`、uint32 output/state、seed/replay の bit pattern は完全一致。
- IEEE 754 bit-for-bit は `DataView` で binary64 の上位・下位 32 bit を比較する。`Object.is`
  を併用し、`+0` と `-0` の取り違えも許さない。
- 正規化は絶対誤差 `1e-12`。座標往復は `eps=Number.EPSILON` とし、成分ごとに
  `16*eps*max(1,abs(expected),abs(actual))` の規模比例許容差とする。
- 局所更新既知値は
  `tauLocal=32*Number.EPSILON*max(1,abs(expected))`。
- 収支は独立参照計算から

  ```text
  ledgerScale=max(1, abs(beforeTotal), abs(afterTotal),
                     abs(outOfPlaneInput), abs(reservoirExchange),
                     diffusionAbsSum, reservoirAbsSum)
  tauMass=256*Number.EPSILON*ledgerScale
  ```

  を毎回求め、台帳各量と独立値の差、および `abs(residual)` を `tauMass` 以下とする。
  `diffusionAbsSum` と `reservoirAbsSum` はテストの参照中間値から求める。物理・観測誤差を
  `tauLocal` や `tauMass` に混ぜない。
- 相対差は `abs(a-b)/max(1,abs(a),abs(b))`。境界感度だけは上限 `0.05`、腕 CV の
  絶対差は上限 `0.02` とする。

## 3. 条件正規化と入力境界

### TC-NORM-001: 端点、中央、往復

- **対象 / 候補**: T1-1 / `conditions.test.ts`
- **前提入力**: `(-30,0)`、`(-15,15)`、`(0,30)`。
- **独立オラクル**: テスト内 literal 式 `x=(T+30)/30`、`y=sigmaPct/30` と逆式
  `T2=30*x-30`、`sigmaPct2=30*y` を使う。
- **期待値**: 順に `(x,y)=(0,0),(0.5,0.5),(1,1)`、返した物理値は入力と同じ、
  `clamped=false`。逆変換は元のクランプ後値へ戻る。
- **許容誤差**: 正規化座標と往復値の絶対誤差 `<=1e-12`。`clamped` は完全一致。
- **失敗意味**: UI 座標の単位、符号、閉区間、または % と無次元比の取り違え。

### TC-NORM-002: 有限範囲外のクランプと非有限拒否

- **対象 / 候補**: T1-1 / `conditions.test.ts`
- **前提入力**: `(-30.000000000001,-1e-12)`、`(1e-12,30.000000000001)`、各引数を
  個別に `NaN`、`+Infinity`、`-Infinity` とした全 6 ケース。
- **独立オラクル**: `min(max(value,lower),upper)` をテスト内で直接適用する。
- **期待値**: 有限入力はそれぞれ `(-30,0,0,0,true)` と `(0,30,1,1,true)`。
  非有限入力はクランプせず `TypeError`。
- **許容誤差**: 有限値は絶対 `1e-12`、例外 class は完全一致。
- **失敗意味**: 端点外挿、非有限値の黙示クランプ、または不正な数値結果の流出。

## 4. 六角格子、座標、生成

### TC-HEX-001: axial 近傍と直交座標往復

- **対象 / 候補**: T1-1 / `hex-lattice.test.ts`
- **前提入力**: `(q,r)=(0,0)` と `(2,-1)`。中心の近傍を取得する。
- **独立オラクル**: 2.1 節の固定近傍差分と
  `x=q+r/2`、`z=sqrt(3)*r/2`、`r2=2*z/sqrt(3)`、`q2=x-r2/2`。
- **期待値**: 中心近傍の集合は
  `{(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)}` で重複なし。
  `(2,-1)` は `(x,z)=(1.5,-sqrt(3)/2)` となり、逆変換で `(2,-1)`。
- **許容誤差**: 座標集合は完全一致、直交座標と往復は 2.2 節の規模比例許容差。
- **失敗意味**: axial 規約、XZ 平面の向き、近傍接続、または格子間隔の不一致。

### TC-HEX-003: safe-neighbor 境界、規模比例誤差、変換 overflow

- **対象 / 候補**: T1-1 / `src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts`
- **前提入力**: `M=Number.MAX_SAFE_INTEGER`、最大有効 axial `(M-1,0)`、その直外
  `(M,0)`、大規模 axial `(24149949,-48187277)`、極大 Cartesian
  `(Number.MAX_VALUE,Number.MAX_VALUE)`。
- **独立オラクル**: テスト内 literal の 6 近傍差分を `(M-1,0)` へ直接加算し、各
  `q`、`r`、`q+r` を `Number.isSafeInteger` で判定する。座標は 2 基底からテスト内に
  直接書いた行列と逆行列で往復し、production helper を期待値生成に使わない。
- **期待値**: `(M-1,0)` は受理され、座標変換結果は有限、往復は 2.2 節の許容差内。
  その 6 近傍はすべて safe integer。`(M,0)` はその `(+1,0)` 近傍が unsafe になるため
  `RangeError`。`(24149949,-48187277)` も往復許容差内。極大 Cartesian 入力は
  fractional axial 成分の overflow を検出して `RangeError` とし、非有限値を返さない。
- **許容誤差**: 安全整数性と例外 class は完全一致。座標往復は 2.2 節の規模比例許容差。
- **失敗意味**: 近傍加算が unsafe integer を公開する、固定絶対誤差が入力規模と整合しない、
  または有限入力から NaN/Infinity を公開する。

### TC-HEX-002: 半径 2 の全格子と reservoir ring

- **対象 / 候補**: T1-1 / `hex-lattice.test.ts`、`lattice.test.ts`
- **前提入力**: `radius=2`。
- **独立オラクル**: `r=-2..2`、各行で `h<=2` の整数 `q` を昇順に列挙する。
- **期待値**: 列挙順は

  ```text
  r=-2: (0,-2),(1,-2),(2,-2)
  r=-1: (-1,-1),(0,-1),(1,-1),(2,-1)
  r= 0: (-2,0),(-1,0),(0,0),(1,0),(2,0)
  r= 1: (-2,1),(-1,1),(0,1),(1,1)
  r= 2: (-2,2),(-1,2),(0,2)
  ```

  全 19 セル、`h=2` の reservoir は 12 セル、`h<=1` の成長領域は 7 セル。
  一般式は全セル `1+3R(R+1)`、ring `6R`。
- **許容誤差**: 整数・順序・mask は完全一致。
- **失敗意味**: 境界セルの誤分類、PRNG 消費順の破壊、または 60° sector だけの生成。

### TC-CREATE-001: 初期状態、型、入力エラー

- **対象 / 候補**: T1-1 / `lattice.test.ts`
- **前提入力**: `radius=2, seed=[1,2,3,4], beta=0.2, noiseAmplitude=0.3`。
  併せて `radius=1,2.5,NaN,+Infinity`、all-zero seed、uint32 外の seed component、
  `beta=-1e-12,0.950000000001,NaN,+Infinity`、
  `noiseAmplitude=-1e-12,1.000000000001,NaN,+Infinity` を個別入力する。
- **独立オラクル**: TC-HEX-002 の座標列と設計 literal を使う。
- **期待値**: 正常時は長さ 19 の `Float64Array`、`Uint8Array`、`Float64Array`。
  中心だけ `waterMass=1, ice=1`、他は `waterMass=0.2, ice=0`、`stepIndex=0`、
  `elapsedCa` は bit pattern が `+0`、`stopped=false`、metadata と
  `modelVersion="reiter-alpha1-xoshiro128ss-1.1-v1"` が完全一致し、全 noise は
  `-1<=noise<1` の有限値。有限範囲違反は
  `RangeError`、非有限の公開 scalar は `TypeError`、all-zero seed は `RangeError`。
- **許容誤差**: 初期 scalar、型、metadata、例外 class は完全一致。
- **失敗意味**: 初期 seed、数値領域、配列表現、またはモデル版再現契約の破壊。

## 5. Reiter 拡散と境界流量

### TC-DIFF-001: Reiter `alpha=1` の既知 impulse

- **対象 / 候補**: T1-6 / `reiter-step.test.ts`
- **前提入力**: 半径 3 以上のテスト fixture。全 `ice=0`、全水量 0 のうち中心だけ
  `waterMass=0.6`。`beta=0, gamma=0, noiseAmplitude=0, dtCa=1`。impulse と reservoir の間に
  1 セル以上の 0 領域を置く。
- **独立オラクル**: S1 の `alpha=1` 重みを紙上適用する。中心は
  `(1-1/2)*0.6=0.3`、各最近傍は `(1/12)*0.6=0.05`。
- **期待値**: 更新後は中心 0.3、最近傍 6 セルが各 0.05、その他 0、総量 0.6。
  `diffusionNet=0`、外部流量と residual は 0。
- **許容誤差**: セル値は `tauLocal`、収支は `tauMass`。
- **失敗意味**: Reiter Laplacian の係数、同時更新、近傍数、または `dtCa` の誤実装。

### TC-DIFF-002: 一様な非受容場と平衡端点

- **対象 / 候補**: T1-6 / `reiter-step.test.ts`
- **前提入力**: (A) 全 `ice=0`、全 `waterMass=beta=0.4`、`gamma=0,e=0,dtCa=1`。
  (B) `createLattice(radius=5,beta=0,e=0)` を `beta=gamma=0,dtCa=1` で 64 step。
- **独立オラクル**: (A) 各 edge で `u_j-u_i=0`。(B) 中心以外に移動・添加できる水が 0。
- **期待値**: (A) 全セル 0.4 の固定点。(B) 全 step で中心だけ `ice=1,waterMass=1`、
  `iceCellCount=1`、`reachedEdge=false`。`stepIndex` と `elapsedCa` 以外の数値配列は不変。
- **許容誤差**: (A) `tauLocal`、(B) 状態配列は bit-for-bit、台帳は `tauMass`。
- **失敗意味**: 一様場の人工拡散、または 0 % 平衡端点での自発成長。

### TC-BETA-001: 動的 beta の開始時・終了時 reservoir 台帳

- **対象 / 候補**: T1-6 / `reiter-step.test.ts`、`mass-conservation.test.ts`
- **前提入力**: `createLattice(radius=2,beta=0.2,e=0)` へ
  `beta=0.4,gamma=0,e=0,dtCa=1` を 1 step 適用する。
- **独立オラクル**: ring は 12 セルなので開始時交換は
  `pre=12*(0.4-0.2)=2.4`。中心と `h=1` の 7 セルは受容、ring は mobile。
  `h=1` と `h=2` の無向 edge は 18 本なので ring から内部への拡散は
  `18*(0.4/12)=0.6`。終了時固定は `post=+0.6`。
- **期待値**: `reservoirExchangePre` の参照値 2.4、`reservoirExchangePost` の参照値 0.6、
  公開 `ledger.reservoirExchange=3.0`。`beforeTotal=1+18*0.2=4.6`、
  `afterTotal=7.6`、`outOfPlaneInput=0`、`diffusionNet=0`、residual 0。
  ring の最終値は全て 0.4、metadata `beta=0.4`。
- **許容誤差**: 局所値は `tauLocal`、台帳と独立 Kahan 値は `tauMass`。
- **失敗意味**: 新 beta の適用が 1 step 遅い、pre/post の片方が収支から欠落、符号反転、
  または Dirichlet ring が終端に固定されていない。

### TC-BETA-002: 内部場を beta 比で再スケールしない

- **対象 / 候補**: T1-6 / `reiter-step.test.ts`
- **前提入力**: `createLattice(radius=7,beta=0.2,e=0)` に対し、最初の control は
  `beta=0.2`、次を `beta=0.4` とし、両方 `gamma=0,e=0,dtCa=1`。第 2 step 開始直前の状態も
  保存する。`(q,r)=(4,0)`（`h=4`）から reservoir ring `h=7` までの最短 graph 距離は 3 で、
  第 2 step に新境界値が到達できる 1-step front `h=6` からも 2 step 離れているため、これを
  観測する。
- **独立オラクル**: 新 beta の開始時置換対象は `h=radius=7` だけである。`(4,0)` から
  `h=7` への最短路 `(4,0)->(5,0)->(6,0)->(7,0)` を整数近傍で列挙し、第 2 step の
  pairwise 計算を `beta_new/beta_old` の全体乗算なしで行う。新しい 0.4 が当該 step の拡散で
  直接到達するのは `h=6` までである。
- **期待値**: 第 2 step 開始時は `h=7` だけが 0.4 に置換され、内部 `h<7` の作業入力は
  保存状態と bit-for-bit 同一。第 2 step 後の新 beta による差分は 1-step front `h=6` より
  内側へ伝播せず、`(4,0)` は 0.2 のままで 0.4 へ比例変更されない。既存 `ice` も同一。
  第 2 step 出力は独立 pairwise 計算と一致する。
- **許容誤差**: 開始時入力と `ice` は bit-for-bit、更新値は `tauLocal`。
- **失敗意味**: 条件変更が過去の内部水量や既成形態を一括変換し、AC-02 を破る。

### TC-GAMMA-001: 面外入力の既知値

- **対象 / 候補**: T1-6 / `reiter-step.test.ts`、`mass-conservation.test.ts`
- **前提入力**: `createLattice(radius=2,beta=0,e=0)` へ
  `beta=0,gamma=0.25,noiseAmplitude=0,dtCa=0.5` を 1 step。
- **独立オラクル**: 受容セルは中心と `h=1` の計 7。各添加は
  `0.25*0.5=0.125`、合計 `7*0.125=0.875`。mobile vapor は 0。
- **期待値**: 中心水量 1.125、`h=1` の 6 セルが各 0.125、他は 0。
  `outOfPlaneInput=0.875`、`reservoirExchange=0`、`beforeTotal=1`、
  `afterTotal=1.875`、residual 0、氷は中心だけ。
- **許容誤差**: すべて binary で正確な 1/8 の倍数は完全一致、それ以外の台帳比較は
  `tauMass`。
- **失敗意味**: `gamma` の単位、`dtCa` 係数、受容 mask、面外入力と reservoir の混同。

### TC-FREEZE-001: 閾値の包含と step 開始時 receptive mask の同期

- **対象 / 候補**: T1-6 / `reiter-step.test.ts`
- **前提入力**: `radius=4,beta=0,noiseAmplitude=0` の状態で、中心だけを既存氷とし、中心の
  最近傍 `A=(1,0)` を `ice=0,waterMass=0.5`、他の非中心セルを
  `ice=0,waterMass=0` とする。(A) `dtCa=1,e=0` で `gamma` を順に
  `0.5-2^-53`、`0.5`、`0.5+2^-52` とする独立した 3 fixture、(B) `gamma=0.5` の fixture を
  2 step 実行し、`A` の外向き最近傍 `B=(2,0)` を観測する。いずれも reservoir は `h=4`。
- **独立オラクル**: step 開始時には `A` は中心氷の最近傍なので receptive、`B` は氷の最近傍で
  ないため non-receptive。mobile 水は全て 0 なので拡散寄与も 0 であり、最初の step の
  `A` は紙上で `0.5+gamma`、`B` は 0 となる。binary64 の閾値直下・ちょうど・直上は順に
  `1-2^-53=0.9999999999999999`、`1`、`1+2^-52=1.0000000000000002`。凍結判定は
  `m'>=1` を literal に適用する。
- **期待値**: (A) `A` の最終水量は上記 3 値と bit-for-bit 一致し、`ice[A]` は順に
  `0,1,1`。(B) 第 1 step では `A` が新たに凍結しても、開始時 mask が non-receptive だった
  `B` は水量 0、氷 0 のまま。第 2 step の開始時にだけ `B` が receptive となり、水量は
  0.5、氷は 0 となる。第 1 step 後の氷集合は中心と `A` だけで、同じ step 内に新規氷の
  近傍へ receptive が連鎖伝播しない。
- **許容誤差**: 列挙した二進有理数、`ice`、mask は完全一致。
- **失敗意味**: `>` と `>=` の取り違え、丸め近傍の凍結誤り、または新規凍結セルから同一
  step 中に receptive mask を再計算する逐次更新。

### TC-MASS-001: production と別経路の独立質量収支

- **対象 / 候補**: T1-6 / `mass-conservation.test.ts`
- **前提入力**: seeds `[1,2,3,4]`、`[0xffffffff,0x12345678,9,10]`、半径
  `2,3,5` の直積ごとに、`initialBeta=0.2,initialNoiseAmplitude=0.4` を明示して状態を作る。
  その各初期状態の fresh copy へ、端点を含む controls
  `(beta,gamma,e,dtCa)=(0,0,0,1),(0.95,1,1,1),(0.37,0.23,0.4,0.125)` の各 1 個を
  **ちょうど 1 step** 適用する。したがって全 18 fixture とし、入力 state が外縁停止前である
  呼出しを評価し、その 1 step で停止へ遷移する場合も含める。
- **独立オラクル**: 2.1 節のテスト専用 edge-flux 参照計算、直接 pre/post reservoir 式、
  直接 gamma 式、入力・出力の Kahan 再走査を使う。`vaporBudget` と production helper は
  期待値生成に使わない。
- **期待値**: ledger の `beforeTotal`、`afterTotal`、`diffusionNet`、
  `outOfPlaneInput`、`reservoirExchange` が独立値と一致し、
  `after-before-outOfPlane-reservoir=0`。独立に呼ぶ `vaporBudget` は
  `mobileVapor+depositedWater=totalWater` かつ出力状態の独立 Kahan 総和と一致する。各半径・seed
  で beta 0 の fixture は初期 ring 0.2 を下げるため `reservoirExchange<0`、beta 0.95 の
  fixture は同じ ring を上げるため `reservoirExchange>0` とする。テスト側の pre/post 直接式でも
  両符号を個別確認し、正負いずれかを絶対値化して隠さない。
- **許容誤差**: 各 fixture 固有の `tauMass`。`iceCellCount` は完全一致。
- **失敗意味**: AC-07 の流量欠落、同じ集計バグを持つ偽オラクル、集計順の非決定化。

## 6. 不変条件、停止、再現性

### TC-INVARIANT-001: 非負性、有限性、氷の不可逆性

- **対象 / 候補**: T1-6 / `reiter-step.test.ts`
- **前提入力**: TC-MASS-001 と同じ `initialBeta=0.2,initialNoiseAmplitude=0.4` の全 18 fixture
  について、割り当て済みの同じ control を初期状態から最大 32 step、または停止まで反復する。
- **独立オラクル**: `0<dtCa<=1` では自己重み `1-dtCa/2>=1/2`、近傍重み
  `dtCa/12>=0`、添加 `gamma*(1+e*noise)*dtCa>=0` を直接確認する。step 前後の `ice` を
  index ごとに比較する。
- **期待値**: 全 `waterMass>=0` かつ有限、`elapsedCa>=0` かつ有限、nullable 指標以外に
  NaN/Infinity なし。全 index で `iceBefore<=iceAfter`、`iceCellCount` は非減少。
- **許容誤差**: 非負判定に負の tolerance を置かない。boolean・count は完全一致。
- **失敗意味**: 安定域外の実装、負の水量、融解・昇華の混入、または AC-09 違反。

### TC-INVARIANT-002: 不正 state/control を結果へ通さない

- **対象 / 候補**: T1-6 / `reiter-step.test.ts`、T1-3 / `morphology-metrics.test.ts`
- **前提入力**: `beta<0`、`beta>0.95`、`gamma<0`、`gamma>1`、`e<0`、`e>1`、
  `dtCa<=0`、`dtCa>1` の各有限値、各 scalar の NaN/±Infinity、配列長不一致、
  負または非有限の `waterMass`、`ice` が 0/1 以外、unsafe `stepIndex`、負/非有限
  `elapsedCa`、`thicknessCells<0` と非有限値。固定 noise 配列については有効端点 `-1` と
  `1-2^-53` を control とし、下端直外 `-1-2^-52`、上端ちょうど `1`、`NaN`、`+Infinity`、
  `-Infinity` を各 1 要素だけに入れた 5 state を検査する。state metadata は `beta` と
  `noiseAmplitude` の有限範囲外・NaN・±Infinity、all-zero seed、seed component の負値・
  `2^32`・非整数・NaN・±Infinity、`radius=1`・非整数・unsafe integer・格子配列長と不整合な
  radius、固定値以外・欠落した `modelVersion` をそれぞれ独立 fixture とする。
- **独立オラクル**: `DESIGN.md` 6 節の閉区間・型・状態不変条件を literal table にする。
- **期待値**: 有限 scalar の範囲違反は `RangeError`、非有限の公開 scalar は
  `TypeError`。不正 state は少なくとも同期的に例外となり、状態を変更せず返値を生成しない。
  `thicknessCells<0` は `RangeError`、非有限は `TypeError`。noise の `-1` と `1-2^-53` は
  受理され、列挙した 5 不正 noise と全 metadata 不正 fixture は同期的に拒否される。
- **許容誤差**: 例外有無と明記された class は完全一致。
- **失敗意味**: 不正入力から NaN/Infinity、部分更新、または未定義の物理状態が生成される。

### TC-STOP-001: 外縁到達と停止後固定点

- **対象 / 候補**: T1-6 / `reiter-step.test.ts`
- **前提入力**: 半径 2 の有効 fixture で、成長領域外周 `h=1` の `(1,0)` を
  `ice=1,waterMass>=1` にした `stopped=false` 状態。任意の有効 control で 1 step し、
  返った状態へ別の有効 control をさらに 1 step。
- **独立オラクル**: 成長領域外周は整数式 `h=radius-1=1`。2 回目の期待状態は 1 回目の
  出力をテスト側で deep copy したもの。
- **期待値**: 1 回目は `reachedEdge=true, state.stopped=true`。2 回目は全 state 配列、
  metadata、`stepIndex`、`elapsedCa` が bit-for-bit 不変で、ledger の全流量と residual が
  `+0`。入力 state は両呼出しとも変更されない。
- **許容誤差**: 完全一致。
- **失敗意味**: 外縁通知漏れ、停止後の隠れた成長、無音の格子拡張、または純粋関数違反。

### TC-RNG-001: xoshiro128** version 1.1 既知ベクトル

- **対象 / 候補**: T1-1 / `prng.test.ts`
- **前提入力**: 次の state を各 1 回だけ遷移させる。

  | state | output | nextState |
  |---|---:|---|
  | `[1,2,3,4]` | `11520` | `[7,0,1026,12288]` |
  | `[7,0,1026,12288]` | `0` | `[12295,1029,1029,25165824]` |
  | `[12295,1029,1029,25165824]` | `5927040` | `[25179138,12295,540162,2107404]` |
  | `[25179138,12295,540162,2107404]` | `70819200` | `[27274249,25704967,31982592,12605441]` |
  | `[27274249,25704967,31982592,12605441]` | `2031721883` | `[15224335,29364750,272377353,1125134346]` |

- **独立オラクル**: 表の literal。最初の noise は
  `2*11520/4294967296-1=-0.9999946355819702`、2 番目は `-1` と直接計算する。
- **期待値**: 全 5 output と nextState が uint32 として表へ完全一致。noise 変換も一致。
- **許容誤差**: output/state は完全一致、noise は binary64 bit-for-bit。
- **失敗意味**: 旧 version 1.0 の `s[0]` scrambler、符号付き乗算、回転、unsigned 化の誤り。

### TC-RNG-002A: createLattice の seed、列挙順、noise、モデル版の決定性

- **対象 / 候補**: T1-1 / `src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts`
- **前提入力**: 同じ入力
  `radius=2,seed=[1,2,3,4],beta=0.2,e=0.3` を 2 回、seed だけ
  `[1,2,3,5]` に変えたものを 1 回。
- **独立オラクル**: TC-HEX-002 の 19 座標順で 1 セル 1 output、計 19 output を消費する
  という回数を spy ではなく、先頭既知 noise、19 個目の output `3571406116`、消費後 state
  `[2456999277,4279822836,334074982,4097125698]` の test literal で同定する。
- **期待値**: 同じ入力の全配列、metadata、保存された初期 seed は bit-for-bit 一致。
  TC-HEX-002 の列挙順と同じ index に対応する noise が一致し、1 bit 違う seed は noise 配列が
  少なくとも 1 要素異なる。いずれも固定 `modelVersion`。
- **許容誤差**: bit-for-bit。
- **失敗意味**: 座標列挙・消費回数の揺れ、global random の利用、seed 無視、版識別不足。

### TC-RNG-002B: step の PRNG 非消費

- **対象 / 候補**: T1-6 / `src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts`
- **前提入力**: TC-RNG-002A と同じ初期 seed から生成した固定格子を複製し、一方に複数 step の
  固定 control 列を適用する。
- **独立オラクル**: `prng.ts` の `nextXoshiro128ss` を実処理へ委譲するテスト用 wrapper で計数し、
  `createLattice` による初期化後、最初の `step` 直前にカウンタを 0 へ戻す。全 `step` 完了後も呼出し数が
  0 であることを検査する。加えて保存初期 seed と noise 配列の
  bit pattern が不変で、同じ初期状態と control 列の再実行が各 checkpoint で bit-for-bit 一致
  することを比較する。T1-1 の `createLattice` 以外の初期化経路は使わない。
- **期待値**: `step` 中の `nextXoshiro128ss` 呼出し回数は 0。保存初期 seed と固定 noise 配列を
  変更しない。
- **許容誤差**: seed、noise、全 checkpoint は bit-for-bit。
- **失敗意味**: step が暗黙の乱数、新しい PRNG 消費、または noise 再生成に依存し、再現性を破る。

### TC-REPLAY-001: 動的 control 列の完全再生

- **対象 / 候補**: T1-6 / `replay.test.ts`
- **前提入力**: 同じ固定初期状態を 2 個作り、少なくとも
  `(beta,gamma,e,dtCa)=(0.2,0.1,0.3,1),(0.4,0.05,0.3,0.5),(0.1,0.2,0.1,1)`
  の 3 control を、有限範囲内の `temperatureC`、`supersaturationPct` と異なる
  `calibrationId` を含む順序付き列として固定し、両状態へ同じ列の保存済み数値を順に渡す。
- **独立オラクル**: 1 回目の各 state/ledger を `DataView` bit pattern として凍結し、2 回目も
  同じ control 列の保存済み数値だけで `step` を再実行する。較正関数、wall-clock、描画 frame、
  replay-key の生成・シリアライズはこのケースで呼ばない。
- **期待値**: 全 checkpoint の全配列、metadata、`stepIndex`、`elapsedCa`、ledger が
  bit-for-bit 一致する。
- **許容誤差**: bit-for-bit。
- **失敗意味**: domain の step 再実行が現在の較正値・wall-clock・描画 frame・暗黙の乱数へ
  依存する、または順序付き control 列を同じ順で適用しても決定的にならない。

### TC-REPLAY-KEY-001: canonical replay-key と共有 URL の往復

- **対象 / 候補**: T4-2 / `app/__tests__/replay-url.test.ts`。T4-2 の設計で app production API
  `serializeReplayKey(key: ReplayKey): string` と `parseReplayKey(text: string): ReplayKey` を
  `app/replay-url.ts` に確定してから Red を取る。
- **前提入力**: `DESIGN.md` 7.2 の全 field を持ち、3 個の順序付き control、異なる
  `calibrationId`、`+0`・非整数の有限 binary64 値を含む replay key。control 順、
  `calibrationId`、保存済み数値 1 個をそれぞれ変えた派生 key も用意する。
- **独立オラクル**: T4-2 の承認済み設計が固定する canonical field 順・数値表現をテスト literal
  とし、production serializer を期待文字列生成に使わない。parse 後の全数値は `DataView`、
  seed は uint32、配列順と文字列は完全一致で比較する。復元 key の保存済み control だけを
  `step` へ渡し、較正写像は再実行しない。
- **期待値**: `serializeReplayKey` は同じ key に常に同じ canonical 文字列を返し、
  `parseReplayKey(serializeReplayKey(key))` は全 field と binary64 bit pattern を保存する。
  canonical 文字列を含む共有 URL の往復後に全 checkpoint の domain state/ledger が元の再生と
  bit-for-bit 一致する。派生 key はそれぞれ異なる canonical 文字列となる。
- **許容誤差**: 文字列、順序、uint32、binary64、再生結果は完全一致。
- **失敗意味**: app 層の共有表現が control 順・較正識別・浮動小数点を失う、または将来の較正を
  再実行して共有 URL の完全再現性を破る。

## 7. 形態指標と対称性

### TC-MORPH-001: 中心 seed の null 境界

- **対象 / 候補**: T1-3 / `morphology-metrics.test.ts`
- **前提入力**: 半径 2 以上で中心だけ `ice=1,waterMass=1`。(A) 厚み省略、
  (B) `thicknessCells=0`、(C) `thicknessCells=4`。
- **独立オラクル**: 中心の Euclidean 半径は 0、外向きの氷/非氷 edge は 6、腕から中心を
  除外する。`compactness=6/(pi*sqrt(3))=1.1026577908435842`。
- **期待値**: 全ケースで radius 0、diameter 0、count 1、perimeter 6、tipDensity 0、
  `armLength=[0,0,0,0,0,0]`、`armMass=[0,0,0,0,0,0]`、両 CV は `null`、
  `aspectRatio=null`。nullable 項目以外は有限。
- **許容誤差**: count/array/null は完全一致、compactness は `tauLocal`。
- **失敗意味**: 正常初期状態でのゼロ除算、NaN/Infinity、中心の腕への二重計上。

### TC-MORPH-002: compactness と aspectRatio の既知集合

- **対象 / 候補**: T1-3 / `morphology-metrics.test.ts`
- **前提入力**: 中心と `h=1` の全 6 セルを氷にした完全な 7 セル六角形を、半径 2 以上の
  非氷領域内へ置く。`thicknessCells` を省略、0、4 とする。
- **独立オラクル**: 外周 6 セルは各 3 本の外向き edge を持つため perimeter 18。
  面積代理 count 7 より
  `compactness=18^2/(6*pi*sqrt(3)*7)=54/(7*pi*sqrt(3))`
  `=1.4177028739417512`。radius 1、diameter 2、厚み 4 の比は 2。
- **期待値**: count 7、perimeter 18、radius 1、diameter 2、tipDensity 0。
  aspectRatio は順に `null,0,2`、compactness は上記値。
- **許容誤差**: 整数/null/0 は完全一致、実数は `tauLocal`。
- **失敗意味**: perimeter の辺数ではなくセル数を数える、compactness の寸法係数誤り、
  または nullable 契約違反。

### TC-MORPH-003: 六腕 CV の独立既知値

- **対象 / 候補**: T1-3 / `morphology-metrics.test.ts`
- **前提入力**: 半径 3 以上の紙上集合を 3 組作る。(A) 中心に加え、各 60° sector の中央
  `(1,1),(-1,2),(-2,1),(-1,-1),(1,-2),(2,-1)` を氷にし、水量を sector 0..5 の順に
  `1,2,3,4,5,6` とする。(B) 中心と角度 `0,60,120,180,240,300 deg` の sector 境界座標
  `(1,0),(0,1),(-1,1),(-1,0),(0,-1),(1,-1)` を氷にし、この角度順で水量を
  `1,2,3,4,5,6` とする。(C) 中心と `(1,0)` だけを氷にし、`(1,0)` の水量を 1 とする。
- **独立オラクル**: (A) 各角度は `30,90,150,210,270,330 deg`、半径は全て `sqrt(3)`。
  水量の母平均 3.5、母分散 `35/12` より
  `armMassCv=sqrt(5/21)=0.4879500364742666`。(B) 境界上を小さい index へ入れる規則を
  literal に適用すると角度 0° と 60° は sector 0、120°〜300° は順に sector 1〜4、
  sector 5 は空となる。したがって長さは `[1,1,1,1,1,0]`、質量は `[3,3,4,5,6,0]`。
  長さの母平均は `5/6`、母分散は `5/36` なので `armLengthCv=1/sqrt(5)`。質量の
  母平均は 3.5、母分散は `43/12` なので `armMassCv=sqrt(43/3)/7`。(C) 2 氷セルは
  互いだけを氷近傍に持つため、氷近傍がちょうど 1 個のセルは 2 個である。
- **期待値**: (A) `armLength=[sqrt(3),...x6]`、`armLengthCv=0`、
  `armMass=[1,2,3,4,5,6]`、`armMassCv=sqrt(5/21)`。(B) `armLength` と `armMass` は上記
  literal 配列、`armLengthCv=1/sqrt(5)=0.4472135954999579`、
  `armMassCv=sqrt(43/3)/7`、`tipDensity=0`。(C) `tipDensity=2/2=1`、
  `armLength=[1,0,0,0,0,0]`、`armMass=[1,0,0,0,0,0]`、両 CV は `sqrt(5)`。
- **許容誤差**: 配列対応は完全一致、実数は `tauLocal`。
- **失敗意味**: sector の角度/向き、0°/60° 境界の tie-break、母標準偏差、中心除外、
  腕質量定義、または tip の氷近傍数の誤り。

### TC-ROT-001: 60° 回転共変性

- **対象 / 候補**: T1-9 / `boundary-sensitivity.test.ts`
- **前提入力**: 境界から 2 セル以上離した非対称な非負 `waterMass`/`ice` fixture と
  `noiseAmplitude=0` の有効 control。同じ fixture を
  `Rot60(q,r)=(-r,q+r)` で回転したもの。
- **独立オラクル**: テスト側の整数座標 Map で入力を回転し、元入力への 1 step 出力を同じ
  `Rot60` で回転する。期待値を production step で再生成するのではなく、比較は
  `step(rotatedInput)` 対 `rotate(step(originalInput))` の metamorphic relation とする。
- **期待値**: `ice` と mask は回転後に完全一致。`waterMass` は全対応セルで
  `tauLocal` 以内。ledger の回転不変 scalar も `tauMass` 以内。
- **許容誤差**: 上記。
- **失敗意味**: 近傍・列挙・境界更新に方向バイアスがあり、六回対称性の創発条件を壊す。

### TC-SYMMETRY-001: 「ほぼ揃うが完全複製でない」の受入

- **対象 / 候補**: T2-5 / `symmetry.acceptance.test.ts`
- **前提入力**: T1-8 で承認された一様条件の代表軌跡、承認済み候補の
  `noiseAmplitude>0`、固定 seed。全 6 腕に氷があり `basalRadiusCells>=10` の checkpoint。
- **独立オラクル**: TC-MORPH-003 で検証済みの独立形態指標を成長実装とは別 module として
  適用する。コード構造レビューで全格子を持つことと sector 複製処理がないことも確認する。
- **期待値**: `armLengthCv<=0.15` かつ `armMassCv<=0.15`、さらに少なくとも片方が
  `>1e-6`。全 6 腕に氷セルがある。
- **許容誤差**: 閾値そのものを inclusive に判定し、追加 tolerance を置かない。
- **失敗意味**: 腕が揃わない、または 60° sector の複製等で不自然な完全対称を強制した。

## 8. reservoir 近似の境界感度

### TC-SENS-001: 比較格子の幾何と master field 初期化

- **対象 / 候補**: T1-9 / `boundary-sensitivity.test.ts`
- **前提入力**: `R=115`、固定 seed、任意の承認済み代表軌跡の初期 beta と noise amplitude。
- **独立オラクル**: テストだけの二重整数 loop で `H_R={h<=115}`、`H_2R={h<=230}`、
  `E_R={q^2+q*r+r^2<=105^2}` を列挙する。`E_R` の次の候補 shell は
  `q^2+q*r+r^2=11028` で count 40,027 となり、40,021 との差が同じ 6 なので小さい
  `d_R=105` を選ぶ。Euclidean boundary は外側近傍を 1 つ以上持つ内側セル。
- **期待値**: `|H_R|=40,021`、`|H_2R|=159,391`、`|E_R|=40,015`、
  `|B_E|=726`。master 列は H_R の通常列挙 40,021 座標を先頭に置き、残りの和集合を
  `(r,q)` 昇順に一度だけ含む。和集合はこの条件では H_2R で 159,391 座標。
  全 pairwise intersection の `waterMass`/`noise` binary64 bit pattern と `ice` が完全一致。
  H_R は通常 `createLattice` と完全一致。追加セルは中心以外の初期化規則を満たし、共通
  metadata は一致する。不一致時は step を 0 回のまま失敗させる。
- **許容誤差**: count、順序、mask、共有 field、metadata は bit-for-bit。近似比較で
  tolerance を使わない。
- **失敗意味**: 格子別 PRNG 消費が noise と境界差を交絡し、感度試験が境界だけを比較しない。

### TC-SENS-002: 全代表軌跡・checkpoint の境界距離/形状感度

- **対象 / 候補**: T1-9 / `boundary-sensitivity.test.ts`
- **前提入力**: T1-8 が候補とする**全代表条件軌跡**。
  TC-SENS-001 の単一 fixture から H_R、H_2R、E_R を開始し、同一 control prefix を実行する。
- **独立オラクル**: 各 checkpoint 前に control の順序、全文字列、全数値 bit pattern、
  `stepIndex=k` を比較する。H_R reservoir ring の最小 Euclidean 中心距離は
  `sqrt(9919)=99.5941765365827...` なので、H_R の `basalRadiusCells<=sqrt(9919)/2`
  （約 49.7970882683）の checkpoint だけを形態比較へ使う。
- **期待値**: checkpoint 前にどの格子も `stopped=false`。`basalRadiusCells`、
  `iceCellCount`、`perimeterEdges`、`compactness`、`tipDensity` は H_R 対 H_2R と
  H_R 対 E_R の両方で相対差 `<=0.05`。両方 non-null の `armLengthCv` と
  `armMassCv` は絶対差 `<=0.02`。各比較格子でも TC-ROT-001 を満たす。
- **許容誤差**: 記載した 0.05、0.02、TC-ROT-001 の `tauLocal` のみ。
- **失敗意味**: axial ring 近似が production 半径で形態へ有意な境界バイアスを与える。
  一つでも失敗したら beta/gamma/noise/閾値を調整せず、Euclidean 境界へ上位設計を差し戻す。

## 9. 性能測定の判定

### TC-PERF-001: domain step 性能

- **対象 / 候補**: T2-4 / `app/__benchmarks__/domain-step.bench.ts`。T2-4 の変更境界内である
  `app` 層の harness が公開 domain `step` を呼び、domain production code は変更しない。
- **前提入力**: production build、`radius=115`（40,021 セル）、T1-8 の固定代表履歴から得た
  外縁到達前かつ氷占有率 10〜50 % の状態、`dtCa=1`。前景タブ、電源接続、DevTools 閉、
  1920×1080、devicePixelRatio 1。OS、CPU、GPU、RAM、Chrome version を記録する。
- **独立オラクル**: 120 step warm-up 後の 600 step を monotonic high-resolution clock で
  個別計測する。昇順 sample の nearest-rank p95 を 1-origin の
  `ceil(0.95*600)=570` 番目として求め、平均は 600 sample の合計/600。3 run を独立実行する。
- **期待値**: 各 run で p95 `<=50 ms` かつ平均 `<=50 ms`。全 3 run 合格。
- **許容誤差**: 50 ms を inclusive に判定し、追加 tolerance を置かない。background tab、
  サーマルスロットリング、fixture の占有率/停止条件違反は無効測定として理由を記録し再実行。
- **失敗意味**: 20 step/s の性能予算を満たさず、P3 前に計算経路を T1-6 へ差し戻す必要がある。

### TC-PERF-002: growth と描画を同時実行した UI 性能

- **対象 / 候補**: T2-4 / `app/performance-harness.ts` と app 起点のブラウザ性能 harness。
- **前提入力**: TC-PERF-001 と同じ機器・production 条件。growth scheduler を 20 step/s、
  camera を一定角速度で回転し、10 秒間の連続 `requestAnimationFrame` timestamp gap を記録。
- **独立オラクル**: gap を昇順にし、奇数 sample は中央、偶数は中央 2 値の平均を median とする。
  `gap>25 ms` の個数を全 gap 数で割る。growth の完了 step 数も scheduler とは別に数える。
- **期待値**: median gap `<=17.5 ms`、`gap>25 ms` の割合 `<=0.01`、growth は 10 秒で
  200 step（scheduler の開始/終了境界で 1 step の差だけを許す）。3 run 全て合格し、描画 frame
  から domain state を変更する呼出しがない。
- **許容誤差**: gap 閾値は inclusive、割合は実測整数比、growth count は 199〜201。
  無効測定条件は TC-PERF-001 と同じ。
- **失敗意味**: AC-08 の 60 fps と 20 step/s の同時達成失敗、または描画と成長の未分離。

## 10. 完了時の追跡条件

- 各後続タスクは、自タスクに割り当てられたケース ID をその `TESTCASES.md` と実テスト名へ
  転記し、baseline、期待した Red、Green、最終検証を自タスクの `EVIDENCE.md` に記録する。
- T1-8 の経験的写像候補が決まった時点で、TC-SENS-002 と TC-SYMMETRY-001 の入力に使う代表軌跡、
  checkpoint、seed を T1-8 の承認済み成果物へ固定する。本書の許容差を不合格回避のために
  広げない。
- T2-4 は TC-PERF-001/002 の raw sample、集計結果、機器情報、無効 run の理由を保存する。
- 60° sector の複製不存在は数値テストだけでは証明できないため、TC-ROT-001 と
  TC-SYMMETRY-001 に加えて implementation review のコード構造検査を必須とする。
