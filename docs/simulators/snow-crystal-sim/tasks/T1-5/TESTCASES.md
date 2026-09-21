# T1-5 独立した水量収支監査 — テストケース

## 1. 範囲、前提、独立性

- 対象 API は `vaporBudget(state): VaporBudget` のみ。実装するテストの場所は
  `apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts`。
  `step`、`MassLedger`、T1-6 の更新・相分類・集計 helper は import しない。
- 上位契約は `SPEC.md`（AC-07/09）、`DESIGN-OUTLINE.md`、T1-0 `DESIGN.md`
  §4/5.4/6/7.2/10.1、承認済み T1-5 `DESIGN.md`（SHA-256
  `160a63877532a23ad5bc5de1bfad321e76f4c6aef9fedbd08f49f38d302f6fa3`）。
  旧 T1-2 の設計・テスト草稿を期待値の根拠にしない。
- 水量は無次元の CA 水量、`iceCellCount` はセル個数。`beta` は監査対象状態の
  metadata であって、この関数は水量の再較正、拡散、境界固定、PRNG 消費をしない。
  有効範囲は半径 `R>=2` の完全六角格子、有限・非負セル水量、外周氷なし。
- 独立した紙上オラクルは `h(q,r)=max(|q|,|r|,|q+r|)` と六方向
  `(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)` で座標を列挙し、
  保存済み `ice` のみから受容集合を作る。実装対象の関数やその分類 helper は使わない。
  テスト専用の座標表は各 `r=-R..R` に `q=max(-R,-R-r)..min(R,R-r)` の昇順で生成する。
  半径2では行長が `3,4,5,4,3`、合計19、中心 `(0,0)` は index 9、
  `(1,0)` は index 10、外周角 `(2,0)` は index 11、外周辺 `(1,1)` は index 15。
- 数値比較は、紙上の局所値には
  `tauLocal(e)=32*Number.EPSILON*max(1,|e|)` を用いる。
  整数・boolean・例外 class・ビット不変性・同一入力の再現は完全一致。
  以下の 2 の冪分母の既知値、Kahan 識別、`+0` 正規化は binary64 で厳密に
  表現できるため、該当箇所では完全一致も要求する。T1-6 台帳を将来照合する
  場合だけ T1-0 §10.1 の `tauMass=256*Number.EPSILON*ledgerScale` を使い、
  本タスクの期待値を台帳から生成しない。許容差は丸め用であり物理観測誤差ではない。

## 2. 共通 fixture とオラクル

全成功・失敗ケースは、特記しない限り次の有効状態を**テストごとに新規作成**してから
1 箇所だけ変える。`radius=2`、`waterMass` は長さ19の `Float64Array` で全要素
`1/8`、`ice` は長さ19の `Uint8Array` で中心 index 9 だけ 1、`noise` は長さ19の
`Float64Array` で全要素 0。中心水量は 1。metadata は `stepIndex=0`、
`elapsedCa=+0`、`stopped=false`、`beta=1/8`、`noiseAmplitude=0`、
`seed=[1,2,3,4]`、`modelVersion='reiter-alpha1-xoshiro128ss-1.1-v1'`。
配列は共有・再利用しない。外周値が `beta` に等しい必要はなく、状態を監査時に
書き換えてはならない。

テスト専用オラクルは、入力 `ice` を座標の `Set` に写し、各セル自身または六方向の
**格子内**隣接セルに氷があるときだけ受容とする。水量を一度だけその相へ割り当てる。
既知値は次節の分数と整数で直接指定し、期待値生成に `vaporBudget` を呼ばない。
一般の小さい有理数 fixture では、各 `waterMass` を分母 `2^k` の整数分子へ
変換して `BigInt` で相別・総量を足し、最後に number へ変換する独立経路を使う。
これは補償和の実装を複製せず、数学的な分割・総量を検査できる。

## 3. 正常系と性質

| ID | 変更・計算 | 独立した期待値と検査 |
|---|---|---|
| VB-01 | 半径2、中心だけ氷、中心水量1、他18セルは `2/5`、`beta=2/5`。 | 受容は中心と6近傍の7、非受容は外周12。`depositedWater=17/5`、`mobileVapor=24/5`、`totalWater=41/5` は `tauLocal` 以内、`iceCellCount=1`。外周12を除外すると失敗する。 |
| VB-02 | 共通 fixture に内側 `(1,0)` の `ice=1, waterMass=3/2`、外周角 `(2,0)` の `waterMass=1/4` を設定。 | 中心氷の受容7に `(2,0),(2,-1),(1,1)` が新たに加わり受容10、非受容9。受容の残り7セルは各 `1/8` なので `depositedWater=1+3/2+7/8+1/4=29/8`、`mobileVapor=9/8`、`totalWater=19/4`、`iceCellCount=2`。外周の受容セルも deposited とし、氷数と受容数を混同しない。4 返値はここでは厳密一致。 |
| VB-03 | 氷をすべて0、全19セルを `1/8`、`stopped=false`。 | `mobileVapor=19/8`、`depositedWater=+0`、`totalWater=19/8`、`iceCellCount=0`。氷ゼロ状態を受け入れ、保存済み `ice` を水量閾値から再計算しない。 |
| VB-04 | 共通 fixture の `stopped=true`、`stepIndex=7`、`elapsedCa=7/2`。 | 停止中でも VB-01 と同じ分類方法。共通 fixture のままなら deposited=`1+6/8=7/4`、mobile=`12/8=3/2`、total=`13/4`、ice=1。停止による固定点返値や短絡をしない。 |
| VB-05 | VB-02 の水量・metadata を保持し、`ice` だけを全0へ変更。 | 新しい mobile=`19/4`、deposited=`+0`、ice=0、total=`19/4`。VB-02 と総量が厳密一致し、相別だけが移る。外部流入・流出を相分類から捏造しない。 |
| VB-06 | VB-02 の全 `(q,r)` 水量・氷を `(-r,q+r)` へ60°回転。noise も同じ座標写像で移す。 | 格子全体の19セルを写し、相量 `9/8,29/8,19/4` と氷数2が VB-02 に厳密一致。6 セクターの複製ではなく入力全体の共変性を検査する。 |
| VB-07 | 氷なし・水量0の状態。`waterMass[0]=-0`、他は `+0`。 | 3 水量すべて `Object.is(value,+0)` が真、氷数0。`-0` 入力は有効で結果を `+0` に正規化し、元の負零ビットは保持する。 |
| VB-08 | 氷なし。index 0 の水量を `2^53`、index 1〜4 を各1、他0。 | 真の和 `2^53+4` は表現可能。指定順の Kahan でも mobile と total が**厳密に** `2^53+4`、deposited=`+0`、ice=0。単純な `+=` では小さい4項を失い `2^53` となる。巨大値への `tauLocal` 比較ではこの差を隠すため、このケースだけは厳密比較する。 |
| VB-08D | 中心 `(0,0)` index 9 のみ `ice=1`。全水量を0にしてから、受容セルの列挙順で最初の `(0,-1)` index 4 に `2^53`、続く `(1,-1)` index 5、`(-1,0)` index 8、中心 `(0,0)` index 9、`(1,0)` index 10 に各1を入れる。 | 中心と6近傍の受容 index は `4,5,8,9,10,13,14`。受容列で `2^53,1,1,1,1,0,0` を別個の deposited Kahan accumulator に入れるため、`depositedWater=2^53+4`、`totalWater=2^53+4` が**厳密一致**し、`mobileVapor=+0`、`iceCellCount=1`。受容側を単純 `+=` にすると `2^53` となり検出できる。氷でない受容セルの水量1は、T1-5 DESIGN §4 が水量閾値と氷 flag の一致を要求しないので有効。 |
| VB-09 | VB-02 を同一ビット列の新規入力として2回監査。 | 全返値のビット列が一致し、呼出し前後の入力全フィールドのビット列が一致。結果は新しい object で入力と参照同一ではない。固定 seed から noise を再生成しない。 |

VB-02 の受容追加3セルは、`(1,0)` の近傍から中心側の既存受容集合を除いて
紙上で得る。特に `(2,0)` と `(1,1)` は外周 ring 上でも水量を数える。
VB-02 は全セルの有理数和 `1+3/2+1/4+16/8=19/4` でも独立照合する。

## 4. overflow — 有限セル値からの失敗

いずれも共通 metadata、長さ19、有限・非負水量、外周氷0のまま行い、
`Number.MAX_VALUE` を `M` とする。予期する `RangeError` の対象 field を
検査し、返値がなく入力ビット列も不変とする。個々の入力セルの検証後、
集計段階で失敗しなければならない。

| ID | 設定 | overflow の相・対象 |
|---|---|---|
| VB-O1 | 氷なし、全水量0、非受容の index 0 と1を各 `M`。 | `mobileVapor` の和 `2M` が非有限。deposited は0。 |
| VB-O2 | 中心氷のみ、全水量0、受容の中心 index 9 と隣接 index 10 を各 `M`。 | `depositedWater` の和 `2M` が非有限。mobile は0。 |
| VB-O3 | 中心氷のみ、全水量0、中心 index 9 と非受容の外周角 `(2,0)` index 11 を各 `M`。 | 各相は `M` で有限、両相の和だけ `2M` が非有限。`totalWater` を報告し、飽和値や Infinity を返さない。 |

## 5. 入力検証表

各行は**別の**共通 fixture を作り、記載 field だけを変える。TypeScript の型を
意図的に破る試験は JS 呼出し相当の cast をテスト側に閉じ込める。例外の文言全文は
固定せず、`TypeError` / `RangeError` の正確な class と最初に報告される
対象 field（セルでは index も）を調べる。全失敗行で呼出し前後の bit snapshot を
照合する。有限な不正値を `beta` や水量へクランプしない。

| ID | field / 値の代表と端点 | 期待 |
|---|---|---|
| VB-V01 | `state=null`, `undefined`, 数、文字列、`[]`。正常 object は受け入れる。 | 各 `TypeError(state)`。 |
| VB-V02 | `radius=2` は受理。`'2'`, `NaN`, `Infinity`, `-Infinity`。 | 不正4件は `TypeError(radius)`。 |
| VB-V03 | `radius=1`, `1.5`, `2^53`, `2^26`（`N(R)` が安全整数を超す）。 | 各 `RangeError(radius)`。`2` は下限受理。巨大半径は配列を確保せず先に拒否。 |
| VB-V04 | `waterMass` を通常 Array / `Float32Array` / null、`ice` を通常 Array / `Int8Array` / null、`noise` を通常 Array / `Float32Array` / null。 | 各 `TypeError(該当配列名)`。 |
| VB-V05 | 各配列を正しい typed array の長さ18または20へ個別に差し替える。長さ19は受理。 | 各 `RangeError(該当配列名)`。3配列×2端外を確認。 |
| VB-V06 | `stepIndex=0` と `Number.MAX_SAFE_INTEGER` は受理。`'0'`, `NaN`, `Infinity`, `-Infinity`。 | 不正4件は `TypeError(stepIndex)`。 |
| VB-V07 | `stepIndex=-1`, `1/2`, `2^53`。 | 各 `RangeError(stepIndex)`。 |
| VB-V08 | `elapsedCa=+0`, `-0` と任意有限正値は受理。`'0'`, `NaN`, `Infinity`, `-Infinity`。 | 不正4件は `TypeError(elapsedCa)`。 |
| VB-V09 | `elapsedCa=-Number.MIN_VALUE`。 | `RangeError(elapsedCa)`。 |
| VB-V10 | `stopped=true/false` は受理。`0`, `'false'`, null。 | 不正3件は `TypeError(stopped)`。 |
| VB-V11 | `beta=0`, `0.95` は受理。`'0'`, `NaN`, `Infinity`, `-Infinity`。 | 不正4件は `TypeError(beta)`。 |
| VB-V12 | `beta=-Number.MIN_VALUE`, `0.95+Number.EPSILON`。 | 各 `RangeError(beta)`。 |
| VB-V13 | `noiseAmplitude=0`, `1` は受理。`'0'`, `NaN`, `Infinity`, `-Infinity`。 | 不正4件は `TypeError(noiseAmplitude)`。 |
| VB-V14 | `noiseAmplitude=-Number.MIN_VALUE`, `1+Number.EPSILON`。 | 各 `RangeError(noiseAmplitude)`。 |
| VB-V15 | 完全一致の版文字列は受理。別文字列、空文字列、数、null。 | 各 `TypeError(modelVersion)`。 |
| VB-V16 | `seed=[1,2,3,4]`、`[0,0,0,1]`、各成分0と `2^32-1` は受理。`seed=null`, `Uint32Array(4)`, 通常 Array 長3/5。 | 不正 shape は各 `TypeError(seed)`。 |
| VB-V17 | seed の各 index 0,1,2,3 へ個別に `'1'`, `NaN`, `Infinity`, `-Infinity` を置く。 | 各 `TypeError(seed[index])`。 |
| VB-V18 | seed の各 index へ個別に `-1`, `1/2`, `2^32` を置く。 | 各 `RangeError(seed[index])`。 |
| VB-V19 | `seed=[0,0,0,0]`。 | `RangeError(seed)`。 |
| VB-V20 | 各 `waterMass` の index 0,9,18 を個別に `-Number.MIN_VALUE`, `NaN`, `Infinity`, `-Infinity`。`+0` と `-0`、`M` は受理（単独セルでは overflow させない）。 | 各 `RangeError(waterMass[index])`。 |
| VB-V21 | 各 `ice` の index 0,9,18 を個別に2または255へ設定。0/1は位置制約を満たせば受理。 | 各 `RangeError(ice[index])`。typed array 代入前の非整数・NaN 検証は要求しない。 |
| VB-V22 | `noise` の index 0,9,18 を個別に `-1-Number.EPSILON`, `1`, `NaN`, `Infinity`, `-Infinity`。`-1`, `0`, `1-Number.EPSILON` は受理。 | 各 `RangeError(noise[index])`。上端1は開区間。 |
| VB-V23 | 半径2の外周角 `(2,0)` index 11 と外周辺 `(1,1)` index 15 に個別に `ice=1`。内側 `(1,0)` index 10 の氷は受理。 | 外周2件は `RangeError(ice[index])`。`waterMass>=1` と氷 flag の一致、ring 水量と `beta` の一致は要求しない。 |

`noise` の `-1-Number.EPSILON` は浮動小数点で `-1` より小さいことを
テスト側で先に確かめる。`ice` は `Uint8Array` への代入時に変換されるので、
格納後の 0/1 以外のみを本 API の検証対象にする。

### 複合不正と順序

次の fixture では例外が単に出るだけでなく、**最初の対象 field**を確認する。
比較する二つの不正は必ず両方とも個別試験で不正と確認済みとする。

| ID | 同時不正 | 最初に報告すべき対象 |
|---|---|---|
| VB-P01 | `radius=1` と全配列長18 | `radius` |
| VB-P02 | `waterMass` 型違い、`ice` 長さ18、`noise` 型違い | `waterMass` |
| VB-P03 | `ice` 長さ18、`noise` 型違い | `ice` |
| VB-P04 | `noise` 長さ18、`stepIndex=-1` | `noise` |
| VB-P05 | metadata の隣接組 `stepIndex/elapsedCa`, `elapsedCa/stopped`, `stopped/beta`, `beta/noiseAmplitude`, `noiseAmplitude/modelVersion`, `modelVersion/seed` をそれぞれ不正にする。 | 各組の左側。これで §4 の metadata 全順序を検査。 |
| VB-P06 | `seed[0]=-1`, `seed[1]=-1`。別ケースで `seed[2]=-1`, `seed[3]=-1`。 | 最小 index の不正成分。all-zero の単独試験は VB-V19。 |
| VB-P07 | index 0 の `waterMass=-1` と `ice=2` と `noise=1`。 | `waterMass[0]` |
| VB-P08 | index 0 の `ice=2` と `noise=1`。 | `ice[0]` |
| VB-P09 | 外周 index 11 の `ice=1` と `noise=1`。別ケースで同 index の `waterMass=-1` も加える。 | 前者 `ice[11]`（外周禁止）、後者 `waterMass[11]`。 |
| VB-P10 | index 0 の `noise=1` と index 1 の `waterMass=-1`。 | `noise[0]`。先の index の全 field を検査してから次の index へ進む。 |
| VB-P11 | 全ゼロ seed と index 0 の `waterMass=-1`。 | `seed`。metadata 全体をセル走査より先に検査する。 |

VB-P05 の各不正値は順に `stepIndex=-1`、
`elapsedCa=-Number.MIN_VALUE`、`stopped=0`、`beta=-Number.MIN_VALUE`、
`noiseAmplitude=-Number.MIN_VALUE`、`modelVersion='wrong-version'`、
`seed=[0,0,0,0]` とする。

## 6. bit snapshot、Red と完了判定

object を渡す成功系・失敗系は呼出し前後で `state` の全 own field、3 typed array の
constructor・長さ・各 byte（`Float64Array` には NaN の payload と `-0` を含む）、
seed の配列形状・要素の number bit pattern と参照 identity を比較する。
`Object.is` だけでは NaN payload を見落とすので `DataView` / byte copy で記録する。
不正な object/shape の試験では、存在する field の descriptor と identity も
保持されることを確認する。入力に新しい property を付けず、異常時も部分返値を
受け入れない。VB-09 の同一入力再現も result の各 number を bit 比較する。

現行 `domain/vapor-budget.ts` は import 可能で型が通る 0 固定の sentinel である。
承認済み TESTCASES に沿うテストコードを新設し、テストコードの独立レビュー承認後に
対象テストを実行する。Red は VB-01/02 等の**期待された assertion failure**で確認し、
syntax/type/import/environment failure を Red と認めない。既存 baseline は T1-5
`EVIDENCE.md` の4ファイル24テスト Green。Red 後にテスト削除・skip・許容差拡大を
する場合はテストケースレビューへ戻す。実装はレビュー済み Red の後にのみ行い、
Green と全検証を別途記録する。

以上は独立監査関数の試験であり、実際の温度・過飽和度から `beta/gamma` への
経験較正や三次元の物理質量保存を検証したと主張しない。出典は T1-0 §2 S1 の
Reiter (2005) pp.4–7 と S3 の Higham (2002) Chapters 2,4、採用数値法は
T1-0 §5.4 と T1-5 DESIGN §3–5 に従う。乱数は使わず、seed は検証専用である。
