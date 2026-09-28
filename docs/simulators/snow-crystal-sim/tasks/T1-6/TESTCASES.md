# T1-6 成長 step と収支台帳 — テストケース

## 1. 範囲、出典、オラクル

対象は `step(state, {beta,gamma,noiseAmplitude,dtCa})`、返す新状態・
`MassLedger`・`reachedEdge` である。実行プロファイルは `full`、UI 影響なし。
`SPEC.md` AC-06/07/09、T1-0 数値契約、承認済み T1-6 `DESIGN.md` を固定入力とする。
温度・過飽和度の経験的較正、c 軸、形態指標、描画は検査しない。
分割前 T1-2 の未承認テスト草稿を期待値の根拠にしない。

式の一次資料は C. A. Reiter (2005), “A Local Cellular Model for Snow Crystal
Growth”, *Chaos, Solitons & Fractals* 23(4), 1111–1119,
[著者公開版 pp. 4–7](https://webbox.lafayette.edu/~reiterc/mvp/sfn/sfn_pp.pdf),
[DOI 10.1016/j.chaos.2004.06.071](https://doi.org/10.1016/j.chaos.2004.06.071)。
浮動小数点評価は N. J. Higham, *Accuracy and Stability of Numerical Algorithms*,
2nd ed., Ch. 2, 4,
[DOI 10.1137/1.9780898718027](https://doi.org/10.1137/1.9780898718027)。
固定 noise の生成元は Blackman–Vigna (2021), DOI 10.1145/3460772 と
[xoshiro128** 作者実装 version 1.1](https://prng.di.unimi.it/xoshiro128starstar.c)。
本テストは `step` 中で乱数生成をしないことだけを検査し、PRNG の既知ベクトル自体は
T1-1 の承認済みテストに委ねる。

`waterMass`、`beta`、`gamma*dtCa`、台帳は kg ではない無次元 CA 水量。
`dtCa`/`elapsedCa` は物理秒でなく CA step。axial `(q,r)`、
`h=max(|q|,|r|,|q+r|)`、6 近傍は T1-1 §4.1 の順。半径 2 は**局所更新の
解析用**であり、production 形態の妥当性は半径 115 と T1-3 境界感度審査に残す。
氷の融解・昇華、負の `gamma`、物理速度への換算は対象外である。

期待値は以下の三つの独立経路を組み合わせる。

1. **紙上有理数**: §2–4 の小格子値を literal にする。production `step`、
   `reiter-step.ts` の private helper、分割前 T1-2 の結果から生成しない。
2. **pairwise flux**: テスト専用の literal または `(q,r)` から作る `Map` と
   無向辺集合を使用し、各辺を一度だけ見て `c*(u_j-u_i)` と逆符号を両端へ同時投入する。
   `u*` の各セル値を比較する。production の `axialIndex`・近傍走査・更新 helper を
   参照計算に使わない。参照用の受容、前後 ring 置換、添加も別実装とする。
3. **独立収支監査**: T1-5 の独立 Kahan 経路 `vaporBudget(input/output)` を別々に呼び、
   前置 `beta-oldRing`、後置 `beta-preClampCandidate`、受容セルの `gamma_i*dtCa`
   はテスト側の座標走査で再構成する。台帳フィールドからその期待値を作らない。

局所実数期待値は `abs(actual-expected) <= 32*Number.EPSILON*max(1,abs(expected))`。
台帳の残差・拡散診断は
`tauMass=256*Number.EPSILON*max(1,|before|,|after|,|outOfPlane|,
|reservoir|,diffusionAbsSum,reservoirAbsSum)`。絶対値和も独立の固定順
Neumaier 集計で作る。これは binary64 丸めに対する工学的許容差であって観測誤差ではない。
整数、boolean、型、例外 class、同一再生キーの全 binary64 bit pattern は完全一致。
`diffusionNet` と `residual` の微小な非零値を単に 0 に丸めた返値は、参照 Neumaier
演算列で直接照合して検出する。停止時・空の流量だけは `Object.is(value,+0)` を要求する。

## 2. 共通 fixture とグラフ検査

`S2`: 半径 `R=2`、seed `[1,2,3,4]`、`stepIndex=0`、`elapsedCa=+0`、
`stopped=false`、`beta=2/5`、`noiseAmplitude=0`、中心 `(0,0)` のみ
`ice=1,waterMass=1`、他 18 セル `ice=0,waterMass=2/5`。
noise は `createLattice` が作った固定配列を使うか、対象ケースでは有効範囲の
literal 値に差し替える。`createLattice` を使うときも期待値はその返値に依存しない。
`S2` の旧総量は `1+18(2/5)=41/5`。受容は中心と h=1 の 6 セル、
非受容は h=2 の 12 セルである。セル列挙の literal は次とする。

```text
r=-2: (0,-2),(1,-2),(2,-2)
r=-1: (-1,-1),(0,-1),(1,-1),(2,-1)
r= 0: (-2,0),(-1,0),(0,0),(1,0),(2,0)
r= 1: (-2,1),(-1,1),(0,1),(1,1)
r= 2: (-2,2),(-1,2),(0,2)
```

参照辺集合は各無向辺を座標対の辞書順で一度だけ数え、半径 2 で全 42 辺、
ring と h<=1 を結ぶ 18 辺、半径 7 で ring と内側を結ぶ 78 辺と確認する。
辺数を production の index/neighbor API から取得しない。半径 2 の 6 外周角は
それぞれ内側 1 辺、6 外周辺はそれぞれ内側 2 辺を持つ。

| ID | 入力と独立期待値 | 主な検出対象 |
|---|---|---|
| `TC-STEP-001` | `S2`, `beta=2/5,gamma=0,e=0,dt=1`。`c=1/12`。中心 `m'=1`、h=1 の各セル `m'=1/2`、ring は全セル `2/5`。ring 後置前は角 `11/30`、辺 `1/3`。`before=41/5,after=44/5,out=0,reservoir=3/5,diffusionNet≈0,residual≈0`。`stepIndex=1,elapsedCa=1,stopped=false,reachedEdge=false`。 | mobile/deposited の混同、旧状態での同時更新、外周固定・符号 |
| `TC-STEP-002` | 同じ `S2`, `gamma=1/4,dt=1,e=0`。中心 `5/4`、h=1 の各セル `3/4`、ring `2/5`。`out=7/4,reservoir=3/5,after=211/20`、凍結は中心だけ。 | 氷セル自身への添加、受容セル数 7、`gamma` 単位 |
| `TC-STEP-003` | 同じ `S2`, `gamma=1/4,dt=1/2,e=0`。`c=1/24`、中心 `9/8`、h=1 各 `23/40`、ring `2/5`。後置前の角 `23/60`、辺 `11/30`。`out=7/8,reservoir=3/10,after=75/8`、`elapsedCa=1/2`。 | 分数 `dtCa` を拡散・添加の両方に掛けるか |
| `TC-STEP-004` | `S2`, `beta=0,gamma=0,e=0,dt=1`。ring は開始時に 0、中心 `1`、h=1 は旧蓄積 `2/5`、全 ring 0、`before=41/5,after=17/5,reservoir=-24/5`。別途 `createLattice(beta=0)` の中心 seed は任意の正しい `dt` を反復しても新氷なし。 | β の新値を旧内部場に比例再スケールしないこと、平衡端点 |
| `TC-STEP-005` | `S2`, `beta=3/5,gamma=0,e=0,dt=1`。前置 `+12/5`、h=1 各 `11/20`、後置 `+9/10`、合計 reservoir `+33/10`、ring `3/5`、`after=23/2`。内部の旧 `2/5` は一括 `3/5` にならない。 | 新 β の即時拡散・前置流入 |
| `TC-STEP-006` | `S2`, `beta=1/5,gamma=0,e=0,dt=1`。前置 `-12/5`、h=1 各 `9/20`、後置 `+3/10`、reservoir 合計 `-21/10`、`after=61/10`。 | 前置流出と後置流入の両符号を保持 |

上表の `TC-STEP-004` は旧 interior `2/5` のままなので `beta=gamma=0` でも
既存の内部蓄積は残る。初期から `beta=0` の無成長ケースと区別する。
`TC-STEP-001` の ring-to-inner 純流量は
`18*(2/5)/12=3/5`、角の戻しは `6*(1/30)=1/5`、
辺の戻しは `6*(1/15)=2/5`。これを台帳から逆算しない。

## 3. 受容、ゆらぎ、凍結、収支

| ID | 入力と独立期待値 | 主な検出対象 |
|---|---|---|
| `TC-STEP-007` | `S2`, `beta=2/5,gamma=1/2,e=0,dt=1`。中心 `3/2`、h=1 の 6 セル各 `1`、ring `2/5`。`out=7/2,reservoir=3/5,after=123/10`。新氷が h=1 に生じ `stopped=reachedEdge=true`、その step の台帳も返る。 | 閾値 `>=1`、停止直前結果の欠落 |
| `TC-STEP-008` | `S2` の固定 noise を中心 `-1`、h=1 の 1 セル `1/2`、他すべて `0` に設定。`gamma=2/5,e=1,dt=1/2,beta=2/5`。添加は中心 `0`、指定隣接 `3/10`、残り 5 隣接各 `1/5`、計 `13/10`。中心 `1`、指定隣接 `3/4`、残り各 `13/20`、`reservoir=3/10,after=49/5`。noise 配列は前後で同じ bit pattern。 | 固定 noise の読み取り、`1+e noise`、添加非負、PRNG 非消費 |
| `TC-STEP-009` | `R=2`、全 7 interior セル `ice=1,m=1`、ring 12 セル `ice=0,m=2/5`、旧 `stopped=false`。`beta=1/5,gamma=1/4,e=0,dt=1`。全 19 セル受容で `u*=0`。前置 `-12/5`、後置 `-3`、`out=19/4`、`reservoir=-27/5`、`before=59/5,after=223/20`、`stopped=true`。 | ring も受容・添加するが凍結させない、後置流出、旧 h=R-1 氷で停止 |
| `TC-STEP-010` | 半径 3、氷なし、ring/他セル 0、中心だけ `3/5`、`beta=gamma=0,dt=1`。中心 `3/10`、その 6 近傍各 `1/20`、他は 0、`diffusionNet=0,reservoir=0,out=0,after=before=3/5`。 | 非受容単独 pulse の凸結合、閉グラフ保存 |
| `TC-STEP-011` | `R=3`、中心だけ `ice=1,m=1`、非中心は `ice=0,m=2/5`、ただし mobile な `(2,0)` だけ `m=3/8`。`beta=2/5,gamma=0,e=0`。pairwise flux の全セル値を `dt=1/2,1` それぞれ照合。特に `dt=1` で `(2,0)` は `17/48`、受容 `(1,0)` は `239/480`、`dt=1/2` ではそれぞれ `35/96`,`431/960`。すべての `m'>=0`、旧 `ice=1` は新でも 1、ring `ice=0`、`|diffusionNet|,|residual|<=tauMass`。 | 隣接方向、全格子更新、同期更新、非負性 |

`TC-STEP-011` の fixture は氷近傍では値が deposited になる点に注意する。
テストコード工程では座標別の質量・氷配列を literal に固定し、独立辺計算を回す。
`vaporBudget` の input/output `totalWater` と、テスト側で再構成した外部流量から
`after-before≈outOfPlane+reservoir` を別経路で確認する。`vaporBudget` の
`mobileVapor` / `depositedWater` は凍結によって再分類され得るが、その差を
外部流量へ加えない。局所値の比較だけでは見落とす分配バグを防ぐ。

`TC-STEP-017`（T1-0 `TC-FREEZE-001` の引継ぎ）: `R=4,beta=0,e=0`、
中心 `(0,0)` だけ `ice=1,m=1`、その隣 `A=(1,0)` は `ice=0,m=1/2`、
残る 59 セルは `ice=0,m=0` の有効状態を作る。`B=(2,0)` は A の外向き隣で、
旧氷中心の隣ではない。各 fixture は独立した入力コピーとし、
`dtCa=1,noiseAmplitude=0`、`gamma` を `1/2-2^-53`、`1/2`、
`1/2+2^-52` とする。旧 mobile が全セルで 0 なので辺流束も 0。
step 開始時の受容は中心と 6 近傍のみ、A の候補水量は紙上で
`1/2+gamma`、すなわち binary64 の `1-2^-53`、`1`、`1+2^-52` と
bit-for-bit 一致し、`ice[A]` は順に `0,1,1`。いずれの第 1 step でも
`B` は `m=0,ice=0` のまま、ring 交換は 0、`stopped=reachedEdge=false`。
数値 3 値、氷 flag、受容 mask は許容差なしで判定する。閾値の `>` と `>=`、
ならびに旧 mask でなく新しい `ice[A]` を同一 step 中の B に伝播する誤りを検出する。

同ケースの `gamma=1/2` fixture を続けて 2 step 実行する。第 1 step は
中心 `3/2`、A `1`、他の h=1 の 5 セル各 `1/2`、B `0`、
`beforeTotal=3/2,afterTotal=5,outOfPlaneInput=7/2,reservoirExchange=0`、
新氷は A だけ。第 2 step 開始時には、A が既存氷なので B が初めて受容となる。
第 2 step の B は `m=1/2,ice=0`、中心 `2`、A `3/2`、他の h=1 の 5 セル各 `1`。
A の外向き h=2 の受容セルは B を含む 3 個で各 `1/2`、
`beforeTotal=5,afterTotal=10,outOfPlaneInput=5,reservoirExchange=0`。
第 2 step 終了時も h=3 に氷はなく停止しない。期待値は旧氷配置の座標近傍から
独立に数え、production の受容 mask や step 結果を使って生成しない。

`TC-STEP-012`: `e=0` の非対称 `R=3` fixture とその
`Rot60(q,r)=(-r,q+r)` 版へ同一 parameters を適用する。
回転前後で全 `ice` は完全一致、対応 `waterMass` は局所許容差内、台帳の
`outOfPlaneInput` と `reservoirExchange` は `tauMass` 内、停止フラグも一致する。
入力の固定 noise は回転不要（`e=0`）。別の有効非対称 noise と `e>0` では、
noise と状態を共に回転したときのみ同じ共変性を期待する。
コードレビュー／構造検査では全格子セルを更新し、60° sector の結果を回転・
ミラー複製しないことを別途確認する。共変性だけを非複製の証拠にしない。

## 4. 停止、純粋性、再生

| ID | 入力と期待値 |
|---|---|
| `TC-STEP-013` | `TC-STEP-007` の出力へ、前回と異なる `beta=0,gamma=1,e=1,dt=1/2` を渡す。新しい state object と 3 typed array・seed tuple を所有するが、全 scalar/配列 bit pattern は停止入力と同じ。`reachedEdge=true`、`beforeTotal=afterTotal=123/10`、残り 4 台帳値はすべて `+0`。ring を新 β に置換せず、`stepIndex`/`elapsedCa` も増やさない。 |
| `TC-STEP-014` | 停止済み状態でも不正な `parameters.beta=NaN` を `TypeError` にし、状態・パラメータを変えない。`stepIndex=Number.MAX_SAFE_INTEGER,elapsedCa=Number.MAX_VALUE,stopped=true` では有効 parameters に対して固定点を返す（停止後の加算 overflow 検査はしない）。ただし入力全量が overflow する停止済み状態は `RangeError`。 |
| `TC-STEP-015` | 同じ seed `[1,2,3,4]`、`R=3` と初期 `beta=2/5,e=1/4` から独立に二つの state を作り、順序付き control 列 `[(beta=2/5,gamma=1/8,e=1/4,dt=1),(beta=3/5,gamma=0,e=1/2,dt=1/2),(beta=1/5,gamma=1/4,e=1/4,dt=1)]` を再生する。各 step の全配列、seed、modelVersion、metadata、台帳 6 項目、`reachedEdge` を DataView 等で bit-for-bit 比較。`temperatureC`、`supersaturationPct`、`calibrationId` は記録側の同一 control 列に固定し、`step` へは実数 4 パラメータだけ渡す。将来の較正値で再計算しない。 |
| `TC-STEP-016` | `TC-STEP-015` の各呼出し前後で入力 object、3 typed array、seed tuple の bit pattern を比較し、過去の返値も後続呼出しで不変。入力と出力の配列・seed 参照は共有せず、出力配列を改変しても入力は変わらない。保存済み noise と seed は step 数によらず不変。`Math.random` は spy で呼出し 0 を確認し、`nextXoshiro128ss` / PRNG モジュールの import が step 実装にないことを構造レビューで確認する。 |

`TC-STEP-015` は同一キーの同一結果を要求するだけで、異なる seed や
異なる control の出力が必ず異なるという非保証を誤って要求しない。
`modelVersion` は `reiter-alpha1-xoshiro128ss-1.1-v1` のままとする。
`gamma=0` の途中 step でも、旧蓄積の拡散が進み得るので一般固定点とはしない。

## 5. 検証、境界、異常系

以下は有効 `S2` または `TC-STEP-007` 停止出力の**一箇所だけ**を変更する表駆動ケースとする。
それぞれ同期的な例外 class、最初の対象 field（文面全体は固定しない）、
入力 object・typed arrays・seed tuple の bit pattern 不変を確認する。
二箇所不正ケースは表の検証順に従い先着 field を確認する。

| ID | 変更と期待 |
|---|---|
| `TC-INVALID-001` | `state=null`, `[]`, primitive → `TypeError(state)`。`radius=NaN,±Infinity,"2"` → `TypeError(radius)`、`1,2.5,Number.MAX_SAFE_INTEGER`（後者は `N(R)` unsafe）→ `RangeError(radius)`。 |
| `TC-INVALID-002` | `waterMass` / `ice` / `noise` を別の typed array または通常 Array にする → 各 `TypeError(field)`。それぞれ長さ `N-1,N+1` → `RangeError(field)`。複数不正なら `waterMass` → `ice` → `noise`。 |
| `TC-INVALID-003` | metadata の `stepIndex` に `-1,1/2,Number.MAX_SAFE_INTEGER+1` → `RangeError`、`NaN,±Infinity,"0"` → `TypeError`。`elapsedCa=-1` → `RangeError`、`NaN,±Infinity` → `TypeError`。`stopped=0` → `TypeError`。 |
| `TC-INVALID-004` | state `beta=-Number.MIN_VALUE,0.95+Number.EPSILON` → `RangeError`、`NaN,±Infinity,"0.4"` → `TypeError`。state `noiseAmplitude=-Number.MIN_VALUE,1+Number.EPSILON` → `RangeError`、非数値・非有限 → `TypeError`。誤った `modelVersion` → `TypeError`。 |
| `TC-INVALID-005` | seed が非 Array・長さ 3/5 → `TypeError(seed)`。成分 0〜3 を `NaN,Infinity,"1"` → `TypeError(seed[index])`、`-1,2^32,1/2` → `RangeError(seed[index])`、`[0,0,0,0]` → `RangeError(seed)`。異なる成分で同時不正なら最小 index。 |
| `TC-INVALID-006` | index 0 と中心などで `waterMass=-1,NaN,+Infinity` → `RangeError(waterMass[index])`。`ice=2`、ring 角 `(2,0)` または ring 辺 `(1,1)` の `ice=1` → `RangeError(ice[index])`。`noise=-1-Number.EPSILON,1,NaN,Infinity` → `RangeError(noise[index])`。`waterMass=-0`、`noise=-1`、`noise=1-Number.EPSILON` は有効。`waterMass>=1,ice=0`、および ring `waterMass!=state.beta` も受け入れる。 |
| `TC-INVALID-007` | `parameters=null,[],primitive` → `TypeError(parameters)`。各 `beta,gamma,noiseAmplitude,dtCa` の型違い、`NaN,±Infinity` → `TypeError(field)`。有限直外は `beta<0,>0.95`、`gamma<0,>1`、`e<0,>1`、`dtCa<=0,>1` → `RangeError(field)`。端点 `beta=0,0.95`、`gamma=0,1`、`e=0,1`、`dtCa=1,Number.MIN_VALUE` は有効。 |
| `TC-INVALID-008` | state metadata と parameters が共に不正なら state の先着。state が有効で 2 parameter が不正なら `beta→gamma→noiseAmplitude→dtCa` の最初。停止済みでも両全検証を実施。 |
| `TC-INVALID-009` | `stopped=false,stepIndex=Number.MAX_SAFE_INTEGER` → `RangeError(stepIndex)`。同状態で `stopped=true` は `TC-STEP-014` の固定点。 |
| `TC-INVALID-010` | 各セルは有限でも、半径 2 の二つの内側セルへ `Number.MAX_VALUE` を設定すると全量集計 overflow → `RangeError`、入力不変。停止済みでも同じ。clamp、`Infinity` の返値は認めない。 |

複合セル不正の追加順序ケース: 同一 index の `waterMass` と `noise` が不正なら
`waterMass`、同一 index の `ice` 外周違反と `noise` が不正なら `ice`、
異なる index なら小さい index の最初の不正を報告する。metadata 不正はセル走査より先。
有効な `waterMass=-0` は返値では `+0` 正規化が許される箇所を除き、入力は保存する。

`elapsedCa+dtCa` overflow と局所候補だけの overflow は実装で防御するが、
`dtCa<=1` かつ非負有限 `elapsedCa`、非負セル値という公開入力域では、
`Number.MAX_VALUE+1` は binary64 で `Number.MAX_VALUE` に丸められ、
局所値が全量より先に overflow する独立 fixture も作れない。
したがって不可能な `RangeError` を捏造せず、`elapsedCa=Number.MAX_VALUE,dtCa=1`
が有限のまま通る境界ケースを追加する。`stepIndex` と全量 overflow は上表で
到達可能な経路を検査し、防御的な非有限候補チェックは実装レビューで確認する。

## 6. テストコード工程への引渡し

配置は `domain/__tests__/reiter-step.test.ts`（局所則・検証）、
`mass-conservation.test.ts`（pairwise flux・台帳・監査）、
`replay.test.ts`（停止・純粋性・再生）。参照計算は production `step`、
`vaporBudget` の private helper、T1-2 草稿を import しない。
テストコードレビュー承認前にテスト実行しない。承認後に baseline Green に対する
**期待した assertion failure** の Red を記録し、型・構文・環境エラーを Red と
見なさない。Red 後のテスト削除、skip、許容差拡大にはテストケース再審査が必要。
成長実装後 Green、全 workspace 検証、実装レビューまでを `EVIDENCE.md` に記録する。
