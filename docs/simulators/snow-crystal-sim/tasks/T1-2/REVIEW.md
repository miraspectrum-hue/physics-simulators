# T1-2 レビュー記録

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-2/DESIGN.md
    hash: sha256:f62710e73852f34909b52f9714feed9493a27855e754ab9ec515af528189bccf
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-2/DESIGN.md:402
    problem: "独立 vaporBudget の公開契約に対し、mobileVapor と depositedWater の相分類を独立期待値と照合するテスト要求がない。"
    evidence: "6節は ice 自身または ice の近傍を受容セルとして depositedWater へ、それ以外を mobileVapor へ分類すると定義する。一方、9節5項と承認済み TC-MASS-001 が明示する vaporBudget の判定は mobileVapor+depositedWater=totalWater、全 waterMass の独立総和との一致、iceCellCount に留まる。このため、全水量を mobileVapor に入れて depositedWater=0 とする実装や、受容判定を ice セルだけに限定する実装でも、合計と収支の検査を通過できる。これは T1-2 の完了条件である step から独立した収支監査経路と、公開された相別予算の正しさを拘束しない。"
    required_change: "9節へ vaporBudget 専用の独立ケースを追加する。例えば半径2で中心だけを ice とし、中心・6近傍・外周へ互いに識別可能な literal 水量を置き、テスト専用の座標集合と受容 mask から mobileVapor、depositedWater、totalWater、iceCellCount を個別に手計算して照合すること。併せて vaporBudget が不正 state を同期拒否し、入力配列と metadata を変更しないことも明示的に要求する。production の vaporBudget、step、台帳、共有補償和 helper は期待値生成に使用しない。"
conditions: []
rollback_to: design
summary: "Reiter 一次資料の受容セル定義、閾値1、alpha=1 の中心1/2・近傍1/12、beta/gamma の範囲と設計式は整合する。独立再計算でも中央0.6の更新は中央0.3・6近傍各0.05、半径2は外周12セル・内外境界18辺で beta 0.2→0.4 の交換は pre 2.4、post 0.6、合計3.0、gamma=0.25・dtCa=0.5 の7受容セル添加は0.875となり、収支符号、凍結、停止、決定性、TC-RNG-002B追跡、単位・範囲・許容差・変更境界にも矛盾はない。ただし独立 vaporBudget の相分類を誤実装しても要求済みテストを通過できるため、設計ゲートは承認できない。"
```

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-2/DESIGN.md
    hash: sha256:de6a7e705b81fa51568fac8e2c629e56ed34d11cebcb00b546d37d6a9506b163
findings:
  - id: R-002
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-2/DESIGN.md:342
    problem: "vaporBudget が有効な有限要素の総和で overflow した場合に、非有限な公開返値を拒否する契約とテスト要求がない。"
    evidence: "4.1節は各 waterMass が有限かつ非負なら有効とするため、半径2・中心だけice・全19要素を Number.MAX_VALUE とした状態は検証を通る。しかし6節の独立 Kahan 集計では mobileVapor と depositedWater の双方が overflow し、Infinity または補償項の NaN を生成し得る。6節は返値の有限性検査と例外を定めず、9節6項は小さい二進有理数、9節7項はstepの18 fixtureだけを検査するため、この実装でも要求済みテストを通過できる。これは SPEC.md の AC-09 と、T1-0 DESIGN.md が定める全非nullable返値の有限性に反する。"
    required_change: "6節で mobileVapor、depositedWater、totalWater を返す前に全値の有限性を検査し、非有限なら部分結果を返さず同期的に RangeError とする契約を明記する。9節へ、全waterMass要素は有限だが独立Kahan和がoverflowする有効stateを追加し、RangeErrorと入力配列・metadataの不変を検査する独立ケースを要求する。"
conditions: []
rollback_to: design
summary: "前回R-001は解消された。半径2 fixture の C・N・O は重複のない全19座標で、受容集合はC∪N、非受容集合は外周12セルに固定され、productionの近傍・index・step・ledger・補償和経路を期待値生成に使わない。整数分子を独立再計算すると deposited=64+1+...+6=85、mobile=7+...+18=150、total=235であり、85/128=0.6640625、150/128=1.171875、235/128=1.8359375、iceCellCount=1となる。不正state拒否と正常・例外時の入力不変も拘束された。Reiter alpha=1の拡散式、境界18辺、pre/post収支、gamma添加、凍結、停止、決定性、TC-RNG-002B、許容差、変更境界に退行はないが、vaporBudgetの有限出力保証が未拘束のため設計ゲートは承認できない。"
```

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-2/DESIGN.md
    hash: sha256:a0f47fc0100164398a6dda9bb440aefc03ab0d8a4ff89ae77ee0ed0fa712ce70
findings:
  - id: R-003
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-2/DESIGN.md:446
    problem: "vaporBudget の totalWater だけが overflow する経路を独立に拘束するテスト要求がない。"
    evidence: "6節は mobileVapor、depositedWater、totalWater の3値を個別に有限検査すると定めるが、追加された全19要素 Number.MAX_VALUE fixture では C∪N の7項 Kahan 和と O の12項 Kahan 和がどちらも NaN になり、相別値の検査だけで RangeError になる。そのため、相別2値だけを検査して新しい Kahan accumulator で得た totalWater の有限性検査を省略した実装でもテストを通過できる。独立 binary64 再計算では、mobileVapor と depositedWater をそれぞれ 0.75*Number.MAX_VALUE とすれば両者は有限だが、その2項の Kahan 合計は Infinity となる。"
    required_change: "9節6項へ、中心など受容集合の1セルと外周など非受容集合の1セルをそれぞれ 0.75*Number.MAX_VALUE、残りを0とした有効 state を追加する。テスト専用 Kahan で mobileVapor と depositedWater が個別には有限、両者から作る totalWater だけが非有限になることを確認し、vaporBudget が同期的に RangeError を throwして入力配列・seedを含むmetadataを変更しないことを要求する。"
  - id: R-004
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-2/DESIGN.md:452
    problem: "有限な有効 state から step の台帳または出力集計が overflow する経路に対するテスト要求がない。"
    evidence: "5.7節と8.1節は全台帳値・全出力水量を公開前に有限検査し、違反時は RangeError とする。しかし9節7項の18 fixture は通常規模の createLattice 状態だけで、TC-INVARIANT-002相当も非有限入力や有限範囲違反の拒否に限られる。全19要素が Number.MAX_VALUE の state は4.1節上は有効だが、active step の beforeTotal Neumaier 集計だけでも非有限になり得る。有限性検査を省略して非有限な ledger/state を返す実装を現行要求では検出できず、AC-09を機械的に拘束できない。"
    required_change: "9節7項へ、全要素 Number.MAX_VALUE など有限要素だけで step の集計または更新が overflow する active state と有効 StepParameters を追加し、同期的な RangeError、返値・部分状態の非公開、入力 waterMass・ice・noise・seed・metadata の完全不変を要求する。期待する overflow はproductionのstep、ledger、Neumaier helperに依存しないテスト専用計算で確認する。"
conditions: []
rollback_to: design
summary: "前回R-001とR-002の直接要求は解消された。相分類fixtureは重複のない全19座標をC∪NとOへ分け、独立再計算で depositedWater=85/128、mobileVapor=150/128、totalWater=235/128、iceCellCount=1となる。全19要素Number.MAX_VALUEでは7項・12項の各Kahan和が非有限となり、契約どおりvaporBudgetのRangeError対象である。Reiter一次資料との照合でも受容条件、閾値1、alpha=1の中心1/2・近傍1/12、beta/gamma範囲は整合し、境界18辺、pre/post収支、gamma添加、凍結、停止、決定性、TC-RNG-002B、許容差、独立経路、変更境界に退行はない。ただしtotalWater単独overflowとstepの有限入力overflowをテスト要求が拘束していないため承認できない。"
```

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-2/DESIGN.md
    hash: sha256:738a7101db7ef437c2896e2aa8f490feb321eeccb15843cdf7e9b76e466dd4c3
findings: []
conditions: []
rollback_to: none
summary: "R-001〜R-004はすべて解消された。独立vaporBudget fixtureはproductionの座標・近傍・index・集計経路を使わず全19座標をC∪NとOへ固定し、独立再計算でdepositedWater=85/128、mobileVapor=150/128、totalWater=235/128、iceCellCount=1となる。全要素Number.MAX_VALUEでは7項・12項の各Kahan和が非有限となり、0.75*Number.MAX_VALUEを受容相と非受容相へ1個ずつ置くfixtureでは相別2値が有限のまま新しいKahan accumulatorによるtotalWaterだけがInfinityとなることを確認した。active stepの全19要素Number.MAX_VALUE fixtureも入力総量のNeumaier集計が非有限となり、各overflowケースはRangeError、部分結果非公開、配列・seed・metadata・StepParametersの完全不変をproduction経路に依存しないオラクルで拘束している。Reiter著者公開版との照合で、閾値1、氷自身または氷近傍の受容条件、alpha=1の中心1/2・各近傍1/12、beta範囲0〜0.95、gamma範囲0〜1、固定背景境界と二次元モデルの適用限界は一致する。拡散・面外添加・pre/post reservoir収支、凍結同期、外縁停止、有限性、固定順Neumaierと独立Kahan、256 epsilon収支許容差、TC-RNG-002B、完全再生、全格子計算、domain限定の変更境界にも上位契約からの退行や未解決矛盾はない。"
```
