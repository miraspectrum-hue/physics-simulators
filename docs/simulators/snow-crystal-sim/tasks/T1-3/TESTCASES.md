# T1-3 独立した形態指標 — テストケース

## 1. 範囲、固定入力、単位

対象は公開関数
`morphologyMetrics(state: LatticeState, thicknessCells?: number): MorphologyMetrics`
である。実行プロファイルは `full`、UI 影響はない。`SPEC.md`、`DESIGN-OUTLINE.md`、
T1-0 の数値契約、承認済み T1-6 の `LatticeState` 契約、承認済み T1-3 `DESIGN.md` を
固定入力とする。成長 step、`morphologyAt`、経験的較正、形態クラス、c 軸厚み生成、描画は
検査しない。

axial 座標は `(q,r)`、基底面のセル中心間隔は 1 cell、
`rho=sqrt(q^2+q*r+r^2)` [cell] とする。`thicknessCells` は同じ cell 間隔で表す c 軸の
全厚みであり、物理長ではない。`waterMass` と腕質量は無次元 CA 水量、compactness、
tip density、aspect ratio、CV は無次元である。本指標は有限六角格子上の離散幾何量であり、
実寸、三次元表面積、物理質量または観測形態クラスを表さない。

出典は T1-3 `DESIGN.md` §8 と同じく、格子モデルについて C. A. Reiter (2005),
“A Local Cellular Model for Snow Crystal Growth,” *Chaos, Solitons & Fractals* 23(4),
1111–1119、[DOI 10.1016/j.chaos.2004.06.071](https://doi.org/10.1016/j.chaos.2004.06.071)、
[著者公開版 pp. 4–7](https://webbox.lafayette.edu/~reiterc/mvp/sfn/sfn_pp.pdf)、
浮動小数点と補償和について N. J. Higham, *Accuracy and Stability of Numerical
Algorithms*, 2nd ed. (2002), Ch. 2, 4、
[DOI 10.1137/1.9780898718027](https://doi.org/10.1137/1.9780898718027) とする。
形態指標、sector、有限格子、原点中心半径は製品上の定義であって Reiter の物理量ではない。

## 2. テスト配置、独立オラクル、許容差

テストコードは次の 1 ファイルへ配置する。

```text
apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts
```

期待値生成では production の `morphologyMetrics`、`step`、`morphologyAt`、成長結果、
`axialIndex`、`axialAtIndex`、`enumerateAxial`、`axialNeighbors`、座標変換・集計 helper を
使わない。テスト内だけに次の独立経路を置く。

1. `(r,q)` 昇順の二重 loop で axial 座標と index の `Map<string,number>` を作る。
   近傍は literal 差分
   `[(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)]` とし、氷集合の `Set` に対して
   氷/非氷 edge と氷近傍数を手列挙する。production helper は import しない。
2. 半径は各 literal 座標へ `sqrt(q*q+q*r+r*r)` を直接適用する。sector は §5 の整数条件を
   上から順にテスト側で適用し、各非中心セルがちょうど一条件に一致することも検査する。
3. compactness と CV は §4 の紙上式・有理数から求める。腕質量の一般参照だけは、
   production とコードを共有しないテスト専用 Neumaier 和を index 昇順で腕ごとに持つ。
   fixture の既知値はこの参照計算から書き出さず、本書の literal 値とも照合する。

既知の有限実数は、期待値ごとに

```text
tau(expected) = 32*Number.EPSILON*max(1,abs(expected))
abs(actual-expected) <= tau(expected)
```

で比較する。整数、`null`、配列長、例外 class、報告 field、sector の割当、参照の非共有、
入力不変は完全一致。同じ入力を反復した返値の全 number は `DataView` 等で IEEE 754
binary64 bit pattern を完全一致させる。空結果の scalar と腕要素は `Object.is(value,+0)` を
要求する。これは binary64 丸めの局所許容差であり、観測誤差、T1-9 の 5 %、AC-05 の 0.15、
較正閾値を混ぜない。

## 3. 共通の literal 状態

`base(R)` は `N=1+3R(R+1)` 要素を持ち、全 `waterMass=+0`、全 `ice=0`、全 `noise=+0`、
`stepIndex=0`、`elapsedCa=+0`、`stopped=false`、`beta=0`、`noiseAmplitude=0`、
`seed=[1,2,3,4]`、`modelVersion="reiter-alpha1-xoshiro128ss-1.1-v1"` とする。
配列はそれぞれ `Float64Array`、`Uint8Array`、`Float64Array` である。各 fixture は新しい
配列と seed Array を持つ。氷座標と明記した水量だけを次節の literal で上書きする。
氷セルの水量 0、中心や非氷セルの任意の非負有限水量、ring 水量と `beta` の不一致は
T1-6/T1-3 の契約上有効である。

production 列挙に依存しない index の監査用 literal は次とする。

```text
R=2, N=19
r=-2:  0:(0,-2)  1:(1,-2)  2:(2,-2)
r=-1:  3:(-1,-1) 4:(0,-1)  5:(1,-1)  6:(2,-1)
r= 0:  7:(-2,0)  8:(-1,0)  9:(0,0)  10:(1,0) 11:(2,0)
r= 1: 12:(-2,1) 13:(-1,1) 14:(0,1) 15:(1,1)
r= 2: 16:(-2,2) 17:(-1,2) 18:(0,2)

R=3, N=37
r=-3:  0:(0,-3)  1:(1,-3)  2:(2,-3)  3:(3,-3)
r=-2:  4:(-1,-2) 5:(0,-2)  6:(1,-2)  7:(2,-2)  8:(3,-2)
r=-1:  9:(-2,-1) 10:(-1,-1) 11:(0,-1) 12:(1,-1) 13:(2,-1) 14:(3,-1)
r= 0: 15:(-3,0) 16:(-2,0) 17:(-1,0) 18:(0,0) 19:(1,0) 20:(2,0) 21:(3,0)
r= 1: 22:(-3,1) 23:(-2,1) 24:(-1,1) 25:(0,1) 26:(1,1) 27:(2,1)
r= 2: 28:(-3,2) 29:(-2,2) 30:(-1,2) 31:(0,2) 32:(1,2)
r= 3: 33:(-3,3) 34:(-2,3) 35:(-1,3) 36:(0,3)
```

## 4. 既知形態 fixture

### TC-MORPH-000: 空集合

- **fixture**: `base(2)` のまま。(A) 厚み省略、(B) `undefined` 明示、
  (C) `thicknessCells=4`。
- **独立計算**: 氷集合、界面、tip、腕がすべて空で、直径も 0。
- **期待値**: A～C の全てで `basalRadiusCells=+0`、`basalDiameterCells=+0`、
  `iceCellCount=0`、`perimeterEdges=0`、`compactness=+0`、`tipDensity=+0`、
  `aspectRatio=null`、`armLength=[+0,+0,+0,+0,+0,+0]`、
  `armMass=[+0,+0,+0,+0,+0,+0]`、`armLengthCv=null`、`armMassCv=null`。

### TC-MORPH-001: 中心 seed の null 境界

- **fixture**: `base(2)` の index 9 `(0,0)` だけ `ice=1,waterMass=1`。
  (A) 厚み省略、(B) 0、(C) 4。
- **独立計算**: `rho(0,0)=0`。中心の6辺は全て非氷へ接し、氷近傍数は0。中心は全腕から除く。
  `compactness=6/(pi*sqrt(3))=1.1026577908435842`。
- **期待値**: A～C の全てで radius 0、diameter 0、count 1、perimeter 6、
  compactness は上記、tip density 0、両腕配列は全 `+0`、両 CV は `null`、
  aspect ratio は `null`。nullable 項目以外は全て有限。

### TC-MORPH-002: 7セル完全六角形

- **fixture**: `base(2)` の中心 `(0,0)` と
  `(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)`、すなわち index
  `9,10,5,4,8,13,14` を氷にする。中心水量だけ 1、外周6セルの水量は 0。
  (A) 厚み省略、(B) 0、(C) 4。
- **独立計算**: 外周6セルは各3本の外向き edge を持つので `E=18`。中心の氷近傍数は6、
  外周は各3で tip は0。radius 1、diameter 2、
  `compactness=18^2/(6*pi*sqrt(3)*7)=54/(7*pi*sqrt(3))`
  `=1.4177028739417512`。境界 ray の小さい index 規則から
  `armLength=[1,1,1,1,1,0]`、その母 CV は `1/sqrt(5)=0.4472135954999579`。
- **期待値**: count 7、perimeter 18、radius 1、diameter 2、tip density 0、compactness は
  上記、`armLength=[1,1,1,1,1,0]`、`armMass=[0,0,0,0,0,0]`、
  `armLengthCv=1/sqrt(5)`、`armMassCv=null`。aspect ratio は A～C の順に `null,+0,2`。

### TC-MORPH-003A: 非対称・sector 中央

- **fixture**: `base(3)` の中心 index 18 を氷、水量 7 とする。さらに次表を氷にする。

| 腕 | 座標 | index | 水量 | `rho` |
|---:|---|---:|---:|---:|
| 0 | `(1,1)` | 26 | 1 | `sqrt(3)` |
| 1 | `(-1,2)` | 30 | 2 | `sqrt(3)` |
| 2 | `(-2,1)` | 23 | 3 | `sqrt(3)` |
| 3 | `(-1,-1)` | 10 | 4 | `sqrt(3)` |
| 4 | `(1,-2)` | 6 | 5 | `sqrt(3)` |
| 5 | `(2,-1)` | 13 | 6 | `sqrt(3)` |

  厚みは省略する。非中心6セルは互いにも中心にも隣接しない。
- **独立計算**: count 7、`E=7*6=42`、全セルの氷近傍数0なので tip density 0、
  radius `sqrt(3)`、diameter `2*sqrt(3)`、
  `compactness=42^2/(6*pi*sqrt(3)*7)=42/(pi*sqrt(3))=7.718604535905089`。
  腕長は全 `sqrt(3)` で長さ CV 0。質量 `[1,2,3,4,5,6]` の母平均は `7/2`、
  母分散は `35/12`、質量 CV は `sqrt(5/21)=0.4879500364742666`。
- **期待値**: 上記全 scalar、`aspectRatio=null`、
  `armLength=[sqrt(3),sqrt(3),sqrt(3),sqrt(3),sqrt(3),sqrt(3)]`、
  `armMass=[1,2,3,4,5,6]`、`armLengthCv=+0`、`armMassCv=sqrt(5/21)`。

### TC-MORPH-003B: 全 boundary ray と tie-break

- **fixture**: `base(3)` の中心 index 18 を氷、水量 7 とする。角度 0° から 60° 刻みの
  `(1,0),(0,1),(-1,1),(-1,0),(0,-1),(1,-1)`、index
  `19,25,24,17,11,12` を氷にし、この順で水量 `1,2,3,4,5,6` とする。厚みは省略する。
- **独立計算**: これは中心と `h=1` の完全六角形なので count 7、perimeter 18、radius 1、
  diameter 2、tip density 0、compactness `54/(7*pi*sqrt(3))`。境界を隣接する小さい腕 index
  へ入れるため 0° と60° は腕0、120°～300° は腕1～4、腕5は空となる。
  よって長さ `[1,1,1,1,1,0]`、質量 `[3,3,4,5,6,0]`。長さは平均 `5/6`、分散
  `5/36` から CV `1/sqrt(5)`。質量は平均 `7/2`、分散 `43/12` から
  CV `sqrt(43/3)/7=0.5408484138857403`。
- **期待値**: 上記全値、`aspectRatio=null`、
  `armLengthCv=1/sqrt(5)`、`armMassCv=sqrt(43/3)/7`。

### TC-MORPH-003C: 隣接2セル、tip の端点

- **fixture**: `base(3)` の中心 index 18 を `ice=1,waterMass=7`、`(1,0)` index 19 を
  `ice=1,waterMass=1` とする。厚みは省略する。
- **独立計算**: 2セルは互いだけを氷近傍に持つので tip は2、tip density 1。
  共有辺を二重に外周へ数えないため `E=6+6-2=10`。radius 1、diameter 2、
  `compactness=10^2/(6*pi*sqrt(3)*2)=25/(3*pi*sqrt(3))=1.5314691539494225`。
  `[1,0,0,0,0,0]` の母平均は `1/6`、母分散は `5/36` なので CV は `sqrt(5)`。
- **期待値**: count 2、perimeter 10、radius 1、diameter 2、compactness は上記、
  tip density 1、`aspectRatio=null`、両腕配列 `[1,0,0,0,0,0]`、
  両 CV `sqrt(5)=2.23606797749979`。

### TC-MORPH-003D: 直線3セル、tip density の真分数

- **fixture**: `base(3)` の `(0,0),(1,0),(2,0)`、index `18,19,20` を氷にし、
  水量をそれぞれ `7,1,1` とする。厚みは省略する。
- **独立計算**: 直線の両端 `(0,0)` と `(2,0)` は氷近傍を1個だけ持つ tip、中央
  `(1,0)` は氷近傍を2個持つ非 tip なので、tip 数は2、分母 `iceCellCount` は3、
  `tipDensity=2/3=0.6666666666666666`。隣接する共有辺が2本あるため
  `E=3*6-2*2=14`、radius 2、diameter 4、
  `compactness=14^2/(6*pi*sqrt(3)*3)=98/(9*pi*sqrt(3))`
  `=2.0011196944939118`。中心を除く2セルはどちらも腕0で、腕長は
  `[2,0,0,0,0,0]`、腕質量も `[2,0,0,0,0,0]`。いずれも最大値で割ると
  `[1,0,0,0,0,0]` となり、母平均 `1/6`、母分散 `5/36` から CV は `sqrt(5)`。
- **期待値**: count 3、perimeter 14、radius 2、diameter 4、compactness は上記、
  tip 数2と `tipDensity=2/3`、`aspectRatio=null`、両腕配列 `[2,0,0,0,0,0]`、
  両 CV `sqrt(5)=2.23606797749979`。tip 数はテスト専用近傍走査でも独立に数え、
  0/1 の端点への丸めや、tip 数そのものを返す誤実装を認めない。

## 5. sector、境界、数値性質

### TC-MORPH-004: sector 整数述語の全域と ray

テスト専用 classifier は次の条件を上から順に適用する。`base(3)` の中心以外36座標について
一致数が必ず1であることをまず確認し、その上で TC-MORPH-003A/B の腕出力を照合する。

| 腕 | 条件 | 必須代表 |
|---:|---|---|
| 0 | `q>=0 && r>=0` | interior `(1,1)`、ray `(1,0),(0,1)` |
| 1 | `q<0 && r>0 && q+r>=0` | interior `(-1,2)`、ray `(-1,1)` |
| 2 | `q<0 && r>=0 && q+r<0` | interior `(-2,1)`、ray `(-1,0)` |
| 3 | `q<=0 && r<0` | interior `(-1,-1)`、ray `(0,-1)` |
| 4 | `q>0 && r<0 && q+r<=0` | interior `(1,-2)`、ray `(1,-1)` |
| 5 | `q>0 && r<0 && q+r>0` | interior `(2,-1)`、0°/360° 側は空 |

0°/360° は `(1,0)` と同じ ray なので腕0である。浮動小数点角度 epsilon による境界推測、
中心の割当、1セルの複数腕への重複を認めない。

### TC-MORPH-005: aspect ratio の端点

TC-MORPH-002 の正の直径2に対して、厚み省略、明示 `undefined`、`-0`、`+0`、
`Number.MIN_VALUE`、4、`Number.MAX_VALUE` を渡す。期待値は順に
`null,null,+0,+0,+0,2,Number.MAX_VALUE/2` で、有限である。`Number.MIN_VALUE/2` は
binary64 で正の最小 subnormal より小さくなるため `+0` へ underflow する。
`-0` の商も `Object.is(result.aspectRatio,+0)` を要求する。空集合と中心 seed は正の厚みを
含め常に `null` で、0除算を行わない。

### TC-MORPH-006: 補償和、スケール CV、overflow

- **有限小項消失 fixture**: `base(3)` の腕0に属する `(1,0),(2,0),(0,1)`、index
  `19,20,25` を氷にし、index 昇順の水量を `[2**53,1,1]` とする。中心は非氷、厚みは
  省略する。3セルは `(1,0)` を中央とする2辺の連結形なので count 3、perimeter 14、
  tip 数2、tip density `2/3`、radius 2、diameter 4、compactness
  `98/(9*pi*sqrt(3))=2.0011196944939118`、腕長 `[2,0,0,0,0,0]`、
  `armLengthCv=sqrt(5)`、`aspectRatio=null` である。腕0の独立 Neumaier 計算は、
  `2**53` の後の最初の `1` で `sum=2**53, correction=1`、次の `1` で
  `sum=2**53, correction=2`、最後に `sum+correction=2**53+2`
  `=9007199254740994` となる。したがって
  `armMass=[9007199254740994,0,0,0,0,0]`、`armMassCv=sqrt(5)` を期待する。
  この armMass literal は正確に表現できる binary64 整数なので
  `Object.is(armMass[0],9007199254740994)` も要求し、逐次単純加算が返す
  `9007199254740992` を明示的に拒否する。CV は最大値でスケールした
  `[1,0,0,0,0,0]` の母平均 `1/6`、母分散 `5/36` から独立に導く。
- TC-MORPH-003A の6腕水量を全て `Number.MAX_VALUE` とした有効状態では、各腕に1セルだけ
  なので `armMass=[MAX,MAX,MAX,MAX,MAX,MAX]`、`armMassCv=+0`。CV の計算前に総和して
  overflow せず、最大値でスケールすることを検出する。
- 同一腕0に入る `(1,0)` と `(0,1)` を氷にして両水量を `Number.MAX_VALUE` とした
  `base(3)` では、腕質量集計が非有限になるため `RangeError`。`Infinity` の返却、clamp、
  セルの黙示除外を認めず、入力は不変。
- 有効公開入力から到達できない count safe-integer、距離、compactness、aspect ratio、CV の
  防御的な非有限経路は実装レビューで確認し、到達不能な fixture を捏造しない。

## 6. 純粋性、決定性、依存しない状態量

### TC-MORPH-007: bit-for-bit 決定性と所有権

TC-MORPH-003A の同一 object を2回測り、全 scalar、両6要素配列、nullable を bit-for-bit
比較する。返値 object と両配列は呼出し間・入力間で同一参照でない。テスト側で第1返値の腕配列を
書換えても入力と第2返値は変わらない。成功前後で入力 object、3 typed array、seed Array の
参照、own property、全 byte を比較し不変を要求する。`Math.random` は spy で呼出し0、時計・
PRNG・global state への依存がないことを構造レビューでも確認する。

### TC-MORPH-008: 形態に影響しない差分

TC-MORPH-003A から毎回独立 clone を作り、一項目ずつ有効範囲内で変更する。

- `stepIndex`、`elapsedCa`、`stopped`、`beta`、`noiseAmplitude`、有効な別 seed、全 `noise`。
- 非氷セルの `waterMass`、中心 `(0,0)` の `waterMass`。

各変更後の全 MorphologyMetrics は基準と bit-for-bit 一致する。一方、腕0の氷セル `(1,1)` の
水量だけ 1→2 に変えると、幾何 scalar、aspect ratio、armLength、armLengthCv、他腕の質量は
完全に不変で、`armMass=[2,2,3,4,5,6]`、
`armMassCv=2*sqrt(5)/11=0.4065578140908709` だけが変わる。期待 CV は平均 `11/3`、
母分散 `20/9` から独立に導く。

### TC-MORPH-009: 穴、別成分、domain 外周の edge

TC-MORPH-003A は7個の孤立成分、TC-MORPH-003C は1成分であり、連結性を仮定しないことを
既知周長で確認する。追加の `base(3)` fixture として中心の周囲6セルだけを氷、中心は非氷にする。
内側の穴6辺と外周18辺を合わせ `perimeterEdges=24`、count 6、中心穴を無視しないことを要求する。
有効状態では reservoir ring に氷を置けないため、domain 外 edge の通常到達 fixture は作らず、
ring 氷を受け入れて数える実装を異常系で拒否する。

## 7. 入力検証、先着順、入力不変

各異常系は `base(2)` または TC-MORPH-002 の一箇所だけを変え、同期的な例外 class と
最初の対象 field を検査する。エラー文面全体は固定せず、少なくとも
`state`、`radius`、`waterMass`、`ice`、`noise`、metadata 名、`seed[index]`、
`waterMass[index]`、`ice[index]`、`noise[index]`、`thicknessCells` のどれを報告したかを
検査する。成功・失敗の両方で入力 object、3 typed array、seed Array の全 bit pattern と
参照が不変であることを要求する。

| ID | 入力と期待 |
|---|---|
| `TC-MORPH-V01` | `state=null,undefined,1,"state",[]` は `TypeError(state)`。 |
| `TC-MORPH-V02` | `radius="2",NaN,+Infinity,-Infinity` は `TypeError(radius)`。`1,1.5,2**26,Number.MAX_SAFE_INTEGER` は `RangeError(radius)`。2は有効。 |
| `TC-MORPH-V03` | `waterMass`、`ice`、`noise` を通常 Array、null、異なる typed array class にすると各 `TypeError(field)`。長さ `N-1,N+1` は各 `RangeError(field)`。検証順は `waterMass→ice→noise`。 |
| `TC-MORPH-V04` | `stepIndex` の string/NaN/±Infinity は `TypeError`、`-1,1/2,2**53` は `RangeError`、`Number.MAX_SAFE_INTEGER` は有効。`elapsedCa` の string/NaN/±Infinity は `TypeError`、負有限は `RangeError`、`-0,Number.MIN_VALUE,Number.MAX_VALUE` は有効。`stopped=0,"false",null` は `TypeError`。 |
| `TC-MORPH-V05` | `beta` は `[0,0.95]`、`noiseAmplitude` は `[0,1]` の端点を受理。string/NaN/±Infinity は `TypeError`、`-Number.MIN_VALUE` と上端 `+Number.EPSILON` は `RangeError`。誤った `modelVersion` は `TypeError(modelVersion)`。 |
| `TC-MORPH-V06` | seed が非 Array、長さ3/5なら `TypeError(seed)`。成分ごとの string/NaN/±Infinity は `TypeError(seed[i])`、`-1,1/2,2**32` は `RangeError(seed[i])`、全0は `RangeError(seed)`。0 と `0xffffffff` は有効で、複数成分不正は小さい index を先に報告。 |
| `TC-MORPH-V07` | index 0、中心、末尾で `waterMass=-Number.MIN_VALUE,NaN,±Infinity` は `RangeError(waterMass[i])`。`+0,-0,Number.MAX_VALUE` は有効。`ice=2,255` と ring の `ice=1` は `RangeError(ice[i])`。内側の `ice=1` は有効。 |
| `TC-MORPH-V08` | index 0、中心、末尾で `noise=-1-Number.EPSILON,1,NaN,±Infinity` は `RangeError(noise[i])`。`-1,+0,1-Number.EPSILON` は有効。`waterMass>=1` と `ice=0`、ring 水量と `state.beta` の不一致、氷なし、中心非氷、非連結氷は有効。 |
| `TC-MORPH-V09` | state が全て有効になった後だけ thickness を検証する。省略、`undefined,-0,+0,Number.MIN_VALUE,Number.MAX_VALUE` は有効。string/null/NaN/±Infinity は `TypeError(thicknessCells)`、`-Number.MIN_VALUE,-1` は `RangeError(thicknessCells)`。 |
| `TC-MORPH-V10` | §6 の同一 index 内は `waterMass→ice→noise`。異なる index は index 昇順を優先し、低 index の不正 noise は高 index の不正 waterMass より先。metadata はセル走査より先。state 不正と thickness 不正の複合では state を先に報告する。 |
| `TC-MORPH-V11` | metadata の先着順は `stepIndex→elapsedCa→stopped→beta→noiseAmplitude→modelVersion→seed`。隣接する2 field を同時に不正化して左を報告する。 |
| `TC-MORPH-V12` | radius と3配列を同時に不正化して radius、`waterMass` と `ice` なら waterMass、`noise` と stepIndex なら noise、seed とセルなら seed を報告する。集計 overflow の `RangeError` でも入力は不変。 |

## 8. 期待 Red とテストコード工程への引渡し

テストファイルは実装前から型検査・構文解析を通すため、未存在の named export や未存在の
production 型を静的 import しない。`import * as domain from '../index'` とテストローカルな
関数型・返値型を使い、最初に次と同等の assertion を置く。

```ts
const candidate = (domain as Record<string, unknown>)['morphologyMetrics'];
expect(candidate, 'morphologyMetrics must be publicly exported').toBeTypeOf('function');
```

`candidate` が関数と確認できた後だけローカル型へ narrow して以後のケースを呼ぶ。したがって
承認済みテスト追加後の期待 Red は「公開 `morphologyMetrics` が `undefined` で、function ではない」
という Vitest の assertion failure であり、TypeScript error、構文 error、module resolution error、
依存・環境 error を Red と見なさない。テストコードレビュー承認前に Red を取らない。

Red 後にテストを削除・skip・弱化したり、`32*EPSILON` を広げたり、期待値を production 結果で
更新したりする場合はテストケース設計レビューへ戻る。実装後は targeted Green、全 workspace
検証、実装レビューまでを T1-3 `EVIDENCE.md` に記録する。乱数 seed は fixture ごとに固定され、
本テスト自身は確率的判定を含まない。上位の式・単位・境界・数値法・API を変える未解決判断はない。
