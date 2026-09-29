# T1-3 Reviews

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-3/DESIGN.md
    hash: sha256:cb9ca9f6e311f293eabfd93d152ffd611b17caea18df08962a0b28cc399ff8e3
findings: []
conditions: []
rollback_to: none
summary: "SPEC、DESIGN-OUTLINE、T1-0および承認済みT1-6の契約と整合する。compactnessの寸法と既知値、周長、tip density、TC-MORPH-003A/B/Cの腕配列と母CVを独立再計算し一致を確認した。6-sector整数述語はq、r、q+rの符号分割により全非中心axial座標を重複なく被覆し、全境界rayの小index tie-breakも正しい。nullable aspectRatio、LatticeState検証順、有限性・overflow処理、純粋性、公開型、変更境界、production stepおよびmorphologyAtからの独立性、局所binary64許容差にも未解決の欠陥はない。"
```

```yaml
review_type: testcases
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-3/TESTCASES.md
    hash: sha256:edc3206e74f0e846c447b2ed151a8b048eba932190fba941ecd28ef2cfa12d5d
findings:
  - id: R-001
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-3/TESTCASES.md:166
    problem: tipDensity の既知 fixture が 0 と 1 の端点しか検査せず、tip 数を iceCellCount で割る中核契約を識別できない。
    evidence: 現在の fixture は tip がない形態と、2セル中2セルが tip の TC-MORPH-003C だけであるため、tip が1個でもあれば1を返す実装や誤った分母を使う実装でも通過し得る。例えば直線状の3セル `(0,0),(1,0),(2,0)` なら独立に tip 数2、iceCellCount 3、tipDensity 2/3 を導ける。
    required_change: 0と1の間の既知値を持つ literal fixture を追加し、tip 数、分母、tipDensity の有限実数値を独立計算で検査する。
  - id: R-002
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-3/TESTCASES.md:206
    problem: 設計で必須の腕別 Neumaier 補償和を、単純加算と区別できる有限・非overflow fixture がない。
    evidence: 現在の複数セル腕質量は小さい整数の正確な和であり、TC-MORPH-006 は各腕1セルまたは非有限overflowだけを検査する。そのため、有限入力を単純加算する実装でも全期待値を満たせる。腕0のindex昇順セルへ `[2**53,1,1]` を置けば、独立な正確値は `2**53+2` だが逐次単純加算は `2**53` となり、補償和を識別できる。
    required_change: 同一腕の複数セルで小項消失が起きる有限 literal fixture を追加し、独立計算した補償和と armMass を完全一致または規定許容差で検査する。
conditions: []
rollback_to: testcases
summary: 座標index、周長、compactness、sector tie-break、腕配列とCV、aspect ratio境界、validation順、overflow拒否、期待Redは独立検算と整合したが、tipDensityの除算と有限補償和を誤実装から識別する必須ケースが不足している。
```

```yaml
review_type: testcases
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-3/TESTCASES.md
    hash: sha256:add867a9afcab445e48f54210eb3530f71364566a34df5fa140e3a55f499ba46
findings: []
conditions: []
rollback_to: none
summary: "SPEC、DESIGN-OUTLINE、T1-3 DESIGNおよび既存契約との整合を再審査した。R-001は直線3セルfixtureによりtip数2、iceCellCount 3、tipDensity 2/3を識別可能になり、周長14、半径2、compactness 98/(9π√3)、腕長・質量[2,0,0,0,0,0]、両母CV√5も独立再計算と一致した。R-002はindex 19,20,25の水量[2**53,1,1]により、Neumaier和9007199254740994と単純逐次和9007199254740992を明確に区別し、同fixtureの幾何・CV期待値も正しい。既存のsector、aspect ratio、overflow、純粋性、検証順、許容差、独立オラクル契約に弱化や新たな未解決欠陥はない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts
    hash: sha256:8cf992d676fa15e7cd8272c66209e89faff4c7eeb09be3f0f86c344fff19fd2c
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:90
    problem: TC-MORPH-V03/V06/V10/V11/V12 の複合不正による検証先着順が網羅されていない。
    evidence: 配列型の waterMass→ice→noise 順、metadata とセルの優先関係、metadata の全隣接ペア、複数 seed 成分の小 index 優先、noise 対 stepIndex、seed 対セルが検査されていない。セルを metadata より先に検証する実装や後半 metadata の順序を誤る実装でも現在のテストを通過できる。
    required_change: 承認済み TESTCASES.md の V03、V06、V10、V11、V12 に列挙された複合不正を追加し、各ケースで例外 class と最初の field を完全一致で検査する。
  - id: R-002
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:10
    problem: 入力不変検査が値だけを snapshot し、入力 object が保持する3 typed array と seed の参照不変を検出できない。
    evidence: valueSnapshot は配列内容を再帰的な値へ変換するため、実装が state.waterMass、ice、noise、seed を同内容の新規配列へ差し替えても TC-MORPH-007 と異常系の assertUnchanged は成功する。承認済み TC-MORPH-007 と §7 は参照と全 bit pattern の双方を要求している。
    required_change: 呼出し前の waterMass、ice、noise、seed の参照を個別に保持し、成功・失敗の双方で同一参照、own property、全 binary64 bit pattern が不変であることを検査する。
  - id: R-003
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:35
    problem: 厚み省略ケースが実際には省略されず、空結果と中心 seed の正のゼロ契約も一部が近似比較になっている。
    evidence: call は常に第2引数を渡すため、TC-MORPH-000 の2個の undefined は両方とも明示 undefined であり arguments.length に依存する誤実装を検出しない。また common と array は許容差比較なので、basalRadiusCells、basalDiameterCells、compactness、tipDensity、および TC-MORPH-001 の腕要素が -0 でも通過する。
    required_change: 少なくとも1回は candidate(state) と直接呼び出して省略を検査し、TESTCASES.md が +0 を要求する scalar と腕要素は Object.is(value, +0) で検査する。
  - id: R-004
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:62
    problem: 承認済み fixture の期待出力が部分的にしか検査されず、関連しない出力の回帰が見逃される。
    evidence: TC-MORPH-006 の有限小項 fixture は全 armMass、armLength、armLengthCv、aspectRatio を検査していない。TC-MORPH-008 の腕0質量変更は iceCellCount、perimeterEdges、aspectRatio、armLengthCv の不変を検査していない。巨大 waterMass や単一腕質量がこれらへ誤って混入する実装でも通過できる。
    required_change: TESTCASES.md に記録された各 fixture の全期待 scalar、6要素配列、CV、nullable 項目を検査し、TC-MORPH-008 では armMass と armMassCv 以外の全出力を bit-for-bit 不変として比較する。
  - id: R-005
    severity: low
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:18
    problem: R=2/R=3 の production 非依存 index 一覧が監査されていない。
    evidence: fixture は生成した Map をそのまま信頼しており、TESTCASES.md §3 の literal index と照合する assertion がない。TC-MORPH-006 の一部だけが hard-coded index を使うため、全 fixture 座標の index 契約を固定できていない。
    required_change: TESTCASES.md §3 の R=2/R=3 literal 座標-index 対応を直接 assertion し、fixture が承認済み index 配置上にあることを固定する。
conditions: []
rollback_to: test-code
summary: 32*EPSILON、公差、sector 境界、tipDensity=2/3、Neumaier の 9007199254740994、overflow、Math.random 非使用、skip/todo 不在は確認できた。typecheck は成功し、未実装 API による Red も module・型・構文エラーではなく公開 export の assertion failure になったが、承認済み検証順・入力参照不変・全 fixture 出力のテスト不足により gate は不合格。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts
    hash: sha256:8b92c1c7446d75e656ae23cb2452a10ff7e305e469353fd0317a0b5fa79726dd
findings:
  - id: R-001
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:64
    problem: "複合不正による waterMass→ice→noise の先着順が完全には検査されていない。"
    evidence: "配列では waterMass と ice の複合だけ、同一セルでは3 field 同時不正だけを検査しているため、waterMass→noise→ice と誤実装しても双方を通過する。承認済み V03/V10 は ice と noise の相対順も要求する。"
    required_change: "waterMass が有効な状態で ice と noise を同時に不正化する配列型ケースおよび同一セル値ケースを追加し、ice が先に報告されることを例外 class と field で検査する。"
  - id: R-003
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:16
    problem: "明示的 undefined が省略呼出しへ変換され、中心 seed の正のゼロ契約も完全一致で検査されていない。"
    evidence: "call は thickness===undefined の全呼出しを candidate(state) に変換するため、TC-MORPH-000/005 の candidate(state, undefined) が存在しない。また line 35 の中心 seed は all の許容差比較だけなので、radius、diameter、tipDensity、腕要素の -0 を受理する。"
    required_change: "省略と明示 undefined を別々に直接呼び出し、TC-MORPH-001で規定されたゼロ scalar と両腕配列を Object.is(value,+0) で検査する。"
  - id: R-005
    severity: low
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:26
    problem: "R=2/R=3 の承認済み literal index 一覧の一部しか固定されていない。"
    evidence: "R=2 は19座標中5座標、R=3 は37座標中9座標だけを TESTCASES.md §3 の literal と照合しており、未検査座標の列挙または index 計算の誤りを検出できない。"
    required_change: "TESTCASES.md §3 に記録された R=2 の19件と R=3 の37件すべてについて、literal 座標と期待 index の対応を直接 assertion する。"
  - id: R-006
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:64
    problem: "noise の異種 typed-array fixture が正しい Float64Array を TypeError 入力として扱っており、適合実装を失敗させる。"
    evidence: "f==='noise' の分岐でも new Float64Array(19) が選ばれる。これは radius 2 の noise として正しい型・長さなので、適合実装は受理するが reject は TypeError を要求し、実装後 Green が不可能になる。"
    required_change: "noise の異種 typed-array fixture を Uint8Array など Float64Array 以外へ修正し、正しい Float64Array(19) は有効入力として扱う。"
  - id: R-007
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:54
    problem: "TC-MORPH-007/008 の決定性と形態非依存状態量の検査が承認済み範囲を満たしていない。"
    evidence: "反復呼出しの bit-for-bit 比較は両腕配列だけで、scalar と nullable 項目を比較していない。TC-MORPH-008 は腕0水量変更だけで、stepIndex、elapsedCa、stopped、beta、noiseAmplitude、seed、noise、非氷セル水量、中心水量を個別に変更して全出力不変を検査するケースがない。これらへ誤って依存する実装が通過し得る。"
    required_change: "反復結果の全 number、配列、nullable を bit-for-bit 比較し、TESTCASES.md §6 の各非依存入力を一項目ずつ変更して全 MorphologyMetrics が基準と完全一致することを検査する。"
  - id: R-008
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:44
    problem: "TC-MORPH-004 が代表12座標だけで、R=3 の全36非中心座標の排他的 sector 被覆を検査していない。"
    evidence: "現在の ternary classifier は最終 else を無条件に腕5とするため、一致条件数を検査できない。承認済みケースが要求する各座標の『ちょうど一条件』を満たさない述語や、代表点以外の誤分類を検出できない。"
    required_change: "R=3 の全非中心36座標について6個の整数述語を個別評価し、一致数が厳密に1であることと期待 sector を検査する。"
  - id: R-009
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:66
    problem: "承認済み V04〜V08 の有効境界入力が複数欠落している。"
    evidence: "stepIndex=Number.MAX_SAFE_INTEGER、elapsedCa=-0/MIN/MAX、beta=0.95、noiseAmplitude=1、seed成分0/0xffffffff、waterMass=-0、noise=-1および1-EPSILON、非氷セルのwaterMass>=1、ring水量とbetaの不一致などを受理する検査がない。範囲を狭める誤実装が現在の異常系テストを通過できる。"
    required_change: "TESTCASES.md の V04〜V08 に列挙された有効端点と有効な非不変条件を追加し、例外なしと必要な出力・入力不変を検査する。"
conditions: []
rollback_to: test-code
summary: "前回R-002の入力object・typed array・seed参照、own-property名、全bit不変と、前回R-004の有限補償和fixtureおよび腕0質量変更時の全出力確認は解消された。32*EPSILON、公差、TC-MORPH-003D、Neumaierの9007199254740994、overflow、未実装API assertion Red、skip/todo不在も確認し、typecheckは成功した。compactness、CV、tipDensity、単位・次元を独立再計算して既知値は正しいが、誤ったnoise fixtureにより適合実装がGreenにならず、検証順、省略/正のゼロ、決定性、sector全域、literal index、入力境界の必須検査も残るため不承認とする。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts
    hash: sha256:ece63127f508f8968bb89cffa06917d2da43f49ec3dfb166b220ce665ff14f1b
findings:
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:23
    problem: "異常入力の不変性を記録する snap が、検証対象である不正な object shape や null field を扱えず、適合実装でもテスト自身が先に TypeError を送出する。"
    evidence: "snap は object なら無条件に bits(x.waterMass)、Array.from(x.ice)、bits(x.noise)、bits(x.seed) を実行する。V01 の state=[]、V03 の waterMass/ice/noise=null、V06 の seed=null では candidate 呼出し前に snapshot が失敗するため、規定の TypeError(field) と入力不変を検査できず、実装後Greenが不可能になる。"
    required_change: "不正な shape や null/異種 field でも例外を出さない汎用 snapshot にし、存在する own property と参照・内容だけを型に応じて記録する。candidate の例外後に、状態objectおよび存在する配列・seedが不変であることを比較する。"
  - id: R-003
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts:40
    problem: "中心seed fixtureの tipDensity=+0 が完全一致で検査されていない。"
    evidence: "中心seedの正のゼロ検査対象は basalRadiusCells、basalDiameterCells、armLength、armMassだけで、tipDensityは all の許容差比較に委ねられている。このため -0 を返す実装も通過し、前回R-003の要求が完全には満たされない。省略呼出しと明示undefinedの分離は解消済みである。"
    required_change: "中心seedの各呼出し結果について tipDensity も Object.is(value,+0) で検査する。"
conditions: []
rollback_to: test-code
summary: "typecheckは成功し、対象テストのRedは未実装公開APIに対する期待どおりのassertion failureだった。既知値、compactness、tipDensity=2/3、六腕CV、Neumaier和9007199254740994、overflow、32*EPSILONを独立再計算して整合を確認した。前回R-001、R-004〜R-009とR-003の省略/明示undefined部分は解消され、literal index全56件、sector全36座標、検証順、決定性、境界入力も追加されたが、異常入力snapshotの自己例外と中心seedの+0検査不足が残るため不承認とする。"
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/morphology-metrics.test.ts
    hash: sha256:97f9400b89288ce24175e5071c5da1a01d2eb1286aed74f22789853cf32bcb9a
findings: []
conditions: []
rollback_to: none
summary: "承認済みDESIGN/TESTCASESとの全体整合を再審査した。汎用snapshotはstate=[]、null・異種field、seed=nullをcandidate呼出し前に自己例外なく扱い、入力objectの同一性、own property descriptor、waterMass・ice・noise・seedの参照および内容byte/number bitを成功・失敗双方で検査できる。中心seedの省略、明示undefined、厚み0、厚み4の全呼出しでtipDensityをObject.is(value,+0)により厳密検査しており、前回残件2件は解消された。過去findingの検証順、literal index全56件、sector全36座標、独立fixture、全出力、決定性、境界入力、Neumaier和9007199254740994、tipDensity=2/3、overflow、32*EPSILON許容差にも退行はない。typecheckは成功し、対象テストは未実装morphologyMetricsの公開export assertionだけで期待どおりRedとなり、型・構文・module・環境エラーはない。適合実装のGreenを妨げる矛盾した期待値も認めない。"
```

```yaml
review_type: implementation
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/morphology-metrics.ts
    hash: sha256:3094428e9cd3e71ac49a403b99312814cef9888129f65a12ad69967d38a836dc
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:21d8e3c7bc2dd1f0f5666c0395a7d56d46953081687389225c1ecfa0119a860b
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:54db0d4400aaaad9ba66952a027c192918f0c288279d1004ceabd8c793b8daba
findings: []
conditions: []
rollback_to: none
summary: "SPEC、DESIGN-OUTLINE、T1-0、承認済みT1-3 DESIGN/TESTCASESおよびT1-6 LatticeState契約と整合する。axial index走査、6-sector整数述語とray tie-break、穴を含む周長、tip、Euclidean半径、inverse circularity、中心除外の腕長・腕質量、腕別独立Neumaier和、最大値スケール母CV、aspectRatioのnull/+0、状態と厚みの検証順・例外class・field、有限性とoverflow防御、純粋性・決定性、公開型/export、step/helper非依存、変更境界を確認した。中心・完全六角形・直線3セルの既知値とCVを独立再計算し一致し、最大有効半径付近のindex算術も有限なsafe integerとして確認した。対象テスト12件、typecheck、architecture境界検査、diff checkはいずれも成功し、未解決の欠陥はない。"
```
