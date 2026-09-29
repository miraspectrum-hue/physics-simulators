# T1-3 独立した形態指標 — 設計

## 1. 責務、権威、変更境界

本タスクは、保存済みの全六角格子から基底面の離散形態を測る純粋関数
`morphologyMetrics` を設計する。成長則から独立した半径、直径、氷セル数、周長、
inverse circularity としての compactness、tip density、6 腕の長さ・質量とそれぞれの
変動係数（CV）、任意の c 軸厚みに対する aspect ratio が対象である。

権威は `SPEC.md > DESIGN-OUTLINE.md > tasks/T1-0/DESIGN.md > 本書` の順である。
T1-0 `DECISIONS.md` と `TESTCASES.md` の `TC-MORPH-001`〜`003`、承認済み T1-6 の
`LatticeState` 契約を引き継ぐ。分割前 T1-2 の文書、production の `step`、将来の
`morphologyAt`、較正値、形態クラス閾値を期待値や判定へ使わない。

実行プロファイルは `full`、UI 影響はない。実装工程の変更境界は
`src/simulators/snow-crystal-sim/domain/` の `morphology-metrics.ts`、公開型・export、
対応する `__tests__/morphology-metrics.test.ts` に限る。成長 step、収支監査、較正、
厚み生成、app/UI/scene を変更しない。

## 2. 座標、単位、適用範囲

格子は T1-0/T1-6 と同じ axial 座標 `(q,r)`、cube 座標 `(q,-q-r,r)` を使う。
基底面は XZ 平面、セル中心間隔を 1 cell とし、

```text
x = q + r/2
z = sqrt(3) r/2
rho(q,r) = sqrt(x^2+z^2) = sqrt(q^2+q r+r^2)  [cell]
h(q,r) = max(|q|,|r|,|q+r|)
```

とする。`rho` は原点からの Euclidean 距離であり、`h` ではない。c 軸は +Y。
`thicknessCells` は c 軸方向の全厚みを同じ cell 間隔で表す有限・非負の数であり、
物理 m や成長時間ではない。`aspectRatio` と compactness、tip density、CV は無次元である。

指標に含める集合は `I={(q,r) | state.ice[index(q,r)]===1}` だけである。
非氷セルの `waterMass`、受容だが未凍結のセル、noise は形態へ含めない。腕質量だけは
`I` に属する非中心セルの `waterMass` を CA 水量単位で合計する。集合は連結を仮定せず、
穴と複数成分をそのまま測る。格子全体を走査し、60° sector の複製や平均形状の生成をしない。

本指標は有限六角格子上の二次元離散形態の比較量である。実寸、三次元表面積、物理質量、
観測上の形態クラスを表さない。観測・較正への利用は T1-7/T1-8/T1-10、c 軸厚みは T1-4、
境界近似の感度は T1-9 の責務である。

## 3. 公開型と関数

```ts
type SixArmValues = readonly [number, number, number, number, number, number];

interface MorphologyMetrics {
  readonly basalRadiusCells: number;
  readonly basalDiameterCells: number;
  readonly iceCellCount: number;
  readonly perimeterEdges: number;
  readonly compactness: number;
  readonly tipDensity: number;
  readonly aspectRatio: number | null;
  readonly armLength: SixArmValues;
  readonly armMass: SixArmValues;
  readonly armLengthCv: number | null;
  readonly armMassCv: number | null;
}

function morphologyMetrics(
  state: LatticeState,
  thicknessCells?: number,
): MorphologyMetrics;
```

`SixArmValues` は index `0..5` のちょうど6要素である。各呼出しは新しい返値 object と
新しい2配列を返し、入力配列や別呼出しの返値と変更可能な参照を共有しない。nullable は
`aspectRatio` と2個の CV だけで、それ以外は有限な number である。

## 4. 指標の定義

### 4.1 半径、直径、面積代理

```text
iceCellCount = |I|
basalRadiusCells = max[i in I] rho(q_i,r_i)
basalDiameterCells = 2 basalRadiusCells
```

`I` が空なら最大値は 0 と定義し、半径・直径・氷セル数はすべて 0 とする。
直径は原点中心の半径の2倍であり、氷セル対の最大距離ではない。

### 4.2 周長と compactness

`perimeterEdges` は、各氷セルの6近傍のうち非氷側へ接する辺の総数である。各界面は
氷側から一度だけ数える。穴と外周、別成分の外周をすべて含む。格子 domain 外は非氷として
扱うが、有効な `LatticeState` は reservoir ring の氷を禁止するため、通常の氷セルの6近傍は
格子内にある。

最近傍中心間隔 1 の正六角セルでは辺長 `s=1/sqrt(3)`、セル面積
`a=3 sqrt(3)s^2/2=sqrt(3)/2` である。`E=perimeterEdges`、`n=iceCellCount` として、

```text
P = E / sqrt(3)                [cell]
A = n sqrt(3) / 2              [cell^2]
compactness = P^2/(4 pi A)
            = E^2/(6 pi sqrt(3) n)
```

を返す。これは circularity の逆数で、同面積なら周長が長い形ほど大きい。`n=0` では
ゼロ除算をせず `perimeterEdges=0`、`compactness=0` と定義する。実装は有限性を保つため
`((E/n)*E)/(6*Math.PI*Math.sqrt(3))` の順で評価する。

### 4.3 tip density

氷セル `i` の6近傍にある氷セル数を `d_i` とし、`d_i===1` の氷セルを tip と数える。

```text
tipDensity = |{i in I | d_i=1}| / iceCellCount
```

空集合は 0。孤立セルの `d_i=0` は tip ではない。したがって中心 seed だけなら 0、
隣接する2氷セルだけなら両方が tip で 1 となる。

### 4.4 6腕の割当、長さ、質量

中心 `(0,0)` は全腕から除く。その他の氷セルは `theta=atan2(z,x)` を `[0,2*pi)` に
正規化した60° sector へ一度だけ割り当てる。境界 ray は隣接する小さい index へ割り当て、
0°/360° 境界は index 0 とする。整数 axial 座標については浮動小数点 epsilon で境界を
推測せず、次の `atan2` と等価な整数述語を上から順に使う。

| 腕 index | 座標条件 | 角度域 |
|---:|---|---|
| 0 | `q>=0 && r>=0`（中心を除く） | `[0°,60°]` |
| 1 | `q<0 && r>0 && q+r>=0` | `(60°,120°]` |
| 2 | `q<0 && r>=0 && q+r<0` | `(120°,180°]` |
| 3 | `q<=0 && r<0` | `(180°,240°]` |
| 4 | `q>0 && r<0 && q+r<=0` | `(240°,300°]` |
| 5 | `q>0 && r<0 && q+r>0` | `(300°,360°)` |

これは、`(1,0)` と `(0,1)` を腕0、`(-1,1)` を腕1、`(-1,0)` を腕2、
`(0,-1)` を腕3、`(1,-1)` を腕4へ割り当てる。全ての非中心 axial 座標がちょうど一条件に
一致しなければ実装不変条件違反である。

腕 `k` について

```text
armLength[k] = max rho(q_i,r_i)                     (assigned ice i)
armMass[k]   = sum state.waterMass[index(q_i,r_i)]  (assigned ice i)
```

とする。空の腕は両方 0。中心の `waterMass` はどの腕にも加えない。

### 4.5 腕 CV と aspect ratio

6値 `x_k>=0` の母変動係数を

```text
mean = sum[k=0..5] x_k / 6
variance = sum[k=0..5] (x_k-mean)^2 / 6
cv = sqrt(variance) / mean
```

とする。標本標準偏差ではない。平均が厳密に 0 なら CV は `null`。overflow を避けるため、
最大値 `m=max(x_k)` が正なら `y_k=x_k/m` にスケールし、index 0→5 の順で平均を求めた後、
同じ順に非負項 `(y_k-mean)^2` を加える二走査で母分散と同じ CV を得る。`E[y^2]-E[y]^2`
の cancellation する式は使わない。分散または CV が負・非有限なら `RangeError` とする。

```text
aspectRatio = thicknessCells / basalDiameterCells
```

ただし、厚み省略（明示的 `undefined` を含む）または直径 0 なら `null`。正の直径と
`thicknessCells=0` または `-0` なら `+0`、正の両値なら有限な商を返す。

## 5. 決定的な走査と数値集計

全セルは T1-0/T1-6 と同じく `r=-radius..radius`、各行で有効な `q` の昇順、すなわち
typed array の index 0→`N-1` で一度だけ走査する。近傍は T1-1 の固定順
`(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)` とする。整数 count、半径の最大値、
sector 割当はこの順で確定する。

各腕の質量は、腕ごとに独立した Neumaier accumulator を `sum=+0, correction=+0` で作り、
セル走査順に該当値を投入する。更新は T1-0/T1-6 と同じ

```text
t = sum + x
if abs(sum)>=abs(x): correction += (sum-t)+x
else:                correction += (x-t)+sum
sum = t
result = sum + correction
```

である。ただし accumulator を成長 step から import・共有せず、このモジュール内に独立実装する。
空腕の結果は `+0`。count が safe integer でなくなる場合、質量集計・距離・compactness・CV・
aspect ratio の中間値または返値が非有限になる場合は `RangeError` とし、飽和、clamp、
`Infinity`、暗黙のセル除外で隠さない。

同じ有効入力の同じ binary64 bit pattern からは、全 scalar と6要素配列を bit-for-bit
一致させる。乱数、時計、global state、`Math.random`、PRNG を使わない。

## 6. 入力検証、例外、純粋性

公開 TypeScript 型に依存せず JavaScript 呼出しを同期的に検証する。T1-6 と同じ
`LatticeState` を受けるため、状態検証と先着順を変更しない。

1. `state` は null でない非配列 object。違反は `TypeError(state)`。
2. `radius` は finite number、2以上の safe integer で、`N=1+3R(R+1)` も safe integer。
   型違い・NaN・±Infinity は `TypeError(radius)`、有限な非整数・範囲外・`N` overflow は
   `RangeError(radius)`。
3. `waterMass`、`ice`、`noise` の順に型と長さを調べる。前二者の型はそれぞれ
   `Float64Array`、`Uint8Array`、noise は `Float64Array`。型違いは `TypeError(field)`、
   `length!==N` は `RangeError(field)`。
4. metadata は `stepIndex`、`elapsedCa`、`stopped`、`beta`、`noiseAmplitude`、
   `modelVersion`、`seed` の順。T1-6 §7 と同じ型、有限性、範囲、固定 model version、
   4×uint32 非全ゼロ seed を要求する。
5. index 昇順で `waterMass`（有限・非負）、`ice`（0/1）、外周 ring の氷禁止、
   `noise`（有限かつ `[-1,1)`）の順に調べる。セル不変条件違反は `RangeError(field[index])`。
   `waterMass>=1` と `ice=1` の一致、ring 水量と `state.beta` の一致、氷集合の連結性、
   中心が氷であることは要求しない。
6. state 全体が有効になった後、`thicknessCells` を調べる。省略または `undefined` は有効。
   それ以外は number かつ finite を要求し、型違い・NaN・±Infinity は
   `TypeError(thicknessCells)`、有限な負値は `RangeError(thicknessCells)`。
   `-0`、`+0`、`Number.MIN_VALUE` は有効。
7. 集計中の safe-integer 違反、overflow、非有限結果は `RangeError`。

複数不正では上記の最初の field を報告する。エラー文面全体は契約にせず、例外 class と
対象 field を検査する。成功・失敗のどちらでも入力 object、3 typed array、seed tuple の
全 bit pattern を変更しない。`stepIndex`、停止状態、beta、noise、seed は指標値へ影響しないが、
公開状態の妥当性として検証する。

## 7. 既知値、独立オラクル、許容差

テストコード工程は production `morphologyMetrics`、`step`、`morphologyAt`、成長結果、
production の座標・近傍・集計 helper を期待値生成に使わない。テスト内の literal axial Map、
固定6近傍差分、手列挙した氷/非氷 edge、紙上式または別実装の補償和を使う。

最低限、次を固定する。

1. **空集合**: 有効な半径2状態の `ice` を全0にする。count/perimeter/radius/diameter/
   compactness/tipDensity と全 arm 値は `+0`、両 CV と aspect ratio は `null`。
   正の厚みを渡しても直径0なので aspect ratio は `null`。
2. **中心 seed** (`TC-MORPH-001`): 中心だけ氷かつ水量1。半径・直径0、count 1、
   perimeter 6、`compactness=6/(pi*sqrt(3))=1.1026577908435842`、tip density 0、
   全腕0、両 CV `null`。厚み省略、0、4の全てで aspect ratio `null`。
3. **7セル完全六角形** (`TC-MORPH-002`): 中心と `h=1` の6セルを氷にする。
   count 7、perimeter 18、radius 1、diameter 2、tip density 0、
   `compactness=54/(7*pi*sqrt(3))=1.4177028739417512`。厚み省略、0、4で
   aspect ratio は `null,0,2`。
4. **非対称・sector 中央** (`TC-MORPH-003A`): 中心と
   `(1,1),(-1,2),(-2,1),(-1,-1),(1,-2),(2,-1)` を氷にし、この順の水量を
   `1..6` とする。各半径は `sqrt(3)`、`armLength=[sqrt(3) x6]`、長さ CV 0、
   `armMass=[1,2,3,4,5,6]`、質量 CV `sqrt(5/21)`。
5. **全 boundary ray** (`TC-MORPH-003B`): 0°から60°刻みの
   `(1,0),(0,1),(-1,1),(-1,0),(0,-1),(1,-1)` の水量を `1..6` とする。
   tie-break により `armLength=[1,1,1,1,1,0]`、`armMass=[3,3,4,5,6,0]`、
   長さ CV `1/sqrt(5)`、質量 CV `sqrt(43/3)/7`、tip density 0。
6. **隣接2セル** (`TC-MORPH-003C`): 中心と `(1,0)` だけを氷、腕セル水量1。
   count 2、perimeter 10、tip density 1、`armLength=[1,0,0,0,0,0]`、
   `armMass=[1,0,0,0,0,0]`、両 CV `sqrt(5)`。
7. **純粋性・決定性**: 同じ入力を2回測り全返値を bit-for-bit 比較する。返した腕配列を
   変更しても入力と別呼出し結果は変わらない。`stepIndex`、`elapsedCa`、`stopped`、`beta`、
   `noiseAmplitude`、有効な seed、noise、非氷セルまたは中心セルの `waterMass` だけを
   有効範囲内で変えても形態値は変わらない。非中心の氷セルの `waterMass` 変更は armMass と
   armMassCv だけへ反映する。
8. **異常系**: §6 の state shape、全 metadata、3配列の型・長さ・セル値、複合不正の順序、
   `thicknessCells` の省略・端点・直外・型違い・NaN/±Infinity、集計 overflow と入力不変を
   T1-0/T1-6 から漏れなく引き継ぐ。

既知の実数は

```text
abs(actual-expected) <= 32*Number.EPSILON*max(1,abs(expected))
```

で比較する。整数、null、配列長、sector index、例外 class、入力不変、同一入力の bit pattern は
完全一致。観測不確かさ、T1-9 の境界感度 5 %、AC-05 の CV 0.15、較正閾値をこの局所丸め許容差へ
混ぜない。

## 8. 出典、近似、停止条件

- 氷集合と axial 六角格子は C. A. Reiter (2005), “A Local Cellular Model for Snow Crystal
  Growth,” *Chaos, Solitons & Fractals* 23(4), 1111–1119、
  [DOI 10.1016/j.chaos.2004.06.071](https://doi.org/10.1016/j.chaos.2004.06.071)、
  [著者公開版 pp. 4–7](https://webbox.lafayette.edu/~reiterc/mvp/sfn/sfn_pp.pdf) に基づく。
  ただし本節の形態指標は Reiter の物理量ではなく、T1-0 が採用した製品上の離散幾何量である。
- 浮動小数点と補償和は N. J. Higham, *Accuracy and Stability of Numerical Algorithms*,
  2nd ed. (2002), Chapters 2, 4、
  [DOI 10.1137/1.9780898718027](https://doi.org/10.1137/1.9780898718027) を根拠とする。
- compactness は正六角セルの辺長・面積を `P^2/(4*pi*A)` に代入した inverse circularity。
  セル化、有限格子、原点中心の半径、腕 sector は近似・製品定義であり物理定数ではない。

本タスクで形態クラス、`beta/gamma/noiseAmplitude`、温度・過飽和度写像、物理時間、実寸、
c 軸厚み関数、AC-03/AC-04 の合否を決めない。指標の定義を変更して較正結果へ合わせてはならない。
上位の物理式・単位・数値法を変更する未解決の人間判断はない。
