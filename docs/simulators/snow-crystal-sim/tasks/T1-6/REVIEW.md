# T1-6 レビュー記録

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-6/DESIGN.md
    hash: sha256:a41d037e1f36a2bc164af57ab7de9fec24547fcea47c612f49582ef0c09c4d06
findings: []
conditions: []
rollback_to: none
summary: "Reiter 著者公開版の受容・拡散則と承認済み上位契約に整合する。半径2の19セル・42辺・ring-to-inner 18辺、半径7のring-to-inner 78辺を独立に確認した。半径2の中心氷・beta=0.4・gamma=0では、中心1、内側6セル各0.5、内側への純流入0.6となる。単位、境界交換、停止、独立台帳、検証順、再現性、許容差、変更境界に未解決の不整合はない。"
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts
    hash: sha256:c8854aa3a82e35b3156d2d11c0a6892d2f37e8cc9187cf2912f00e384de087c5
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts
    hash: sha256:020bd902b0ca8599681e3f85ac7380c6dfad9d78b332cc2cd4ff1f92e5b2dd9d
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts
    hash: sha256:29dee0976d9f69930e16aaba32f56f9ebc0c6738aabd9235e75be45237e2451c
findings: []
conditions: []
rollback_to: none
summary: "承認済み TESTCASES の局所既知値、独立 pairwise-flux、収支監査、境界符号、閾値、停止、純粋性、再生、入力検証を対象3ファイルが満たす。代表値と次元・符号・許容差を独立再確認した。verify-fast は architecture と typecheck を通過し、既存58テストが成功、新規19テストはすべて未実装 public step API が undefined であることを示す明示 assertion から失敗したため、構文・型・依存・環境・無関係テスト由来ではない期待 Red と確認した。skip・todo・許容差拡大はなく、テストは凍結可能である。"
```

```yaml
review_type: testcases
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-6/TESTCASES.md
    hash: sha256:0642af5b19274634e5828bd6d0a62f84967af761e919d017e951b5ba6ddbd103
findings:
  - id: R-001
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-6/TESTCASES.md:104
    problem: 凍結閾値の直下・ちょうど・直上と、新規氷の近傍へ同一 step 中に受容判定が連鎖しないことのケースが欠けている。
    evidence: 承認済み T1-0 TESTCASES.md の TC-FREEZE-001 は三つの閾値と二段階の受容判定を明示的に要求する。現行 TC-STEP-007 は閾値ちょうどだけを確認し、半径2では停止するため次 step の伝播も確認できない。Reiter 著者公開版 pp. 4–5 も受容判定と拡散を段階として定義する。
    required_change: T1-0 TC-FREEZE-001 に相当する半径4の独立 fixture を追加し、閾値直下・ちょうど・直上の氷判定と、隣接先が次 step で初めて受容になることを検査する。
conditions: []
rollback_to: testcases
summary: "S2 の TC-STEP-001〜009 と TC-STEP-011 の有理数値、42/18/78 辺、境界交換・収支の符号は独立計算と一致した。凍結境界と旧状態受容の承認済み必須ケースが未移管のため、テストケース承認は保留する。"
```

```yaml
review_type: testcases
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-6/TESTCASES.md
    hash: sha256:91854c1353b86d4647bfc930dda4b908077d2fbaaec8786e341e191429663539
findings: []
conditions: []
rollback_to: none
summary: "R-001 は TC-STEP-017 で解消した。半径4の61セル、旧受容7セル、閾値直下・一致・直上の binary64 値と氷判定を独立に確認した。2 step 目の旧氷による受容10セル、B の水量1/2、総量5→10、添加量5、外周交換0も一致する。Reiter の受容・拡散段階および承認済み上位契約との回帰的不整合は見つからない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts
    hash: sha256:3d9d99c7b0521021a5557e44ed586be50e5e5de560c0d13baa864d9b440d9796
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts
    hash: sha256:23bd58fad128213968fd1d26b89e8f7d12f177a7caa0ee0f4c10dc64f591a967
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts
    hash: sha256:aaf32fa3585ec4a6bf56a84d9c78a9f1dce2278948c02be2df9aeb1743312b5c
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:91
    problem: TC-INVALID-001–010 の表の大半が未実装で、例外の最初の対象 field も検査していない。
    evidence: 現在の13ケースは、非有限値、seed成分、セル値・外周氷、複合不正の優先順位、有効端点、停止状態での境界、総量 overflow をほぼ検査しない。field 変数は assertion に使われず、変更後オブジェクト自体の不変性も確認しない。
    required_change: 承認済み TESTCASES.md §5 の到達可能な境界・異常入力と優先順位を表駆動で追加し、対象 field と変更対象全体の bit 不変性を検査する。
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts:35
    problem: reservoirExchange と台帳の beforeTotal・afterTotal を独立した期待値で照合していない。
    evidence: 参照計算は添加量だけを返し、収支式の右辺には production 台帳の reservoirExchange をそのまま使用する。固定値20による residual 許容差は承認済みの ledgerScale と独立絶対値和に基づく tauMass ではない。境界交換の前置・後置をそれぞれ誤記録しても検出できない。
    required_change: テスト専用計算で前置・後置 ring 差を別々に再構成し、独立 vaporBudget の前後総量と各台帳欄を照合する。diffusionAbsSum・reservoirAbsSum からケースごとの tauMass を算出する。
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts:26
    problem: TC-STEP-012 の60度回転共変性テストが存在しない。
    evidence: describe 名には 012 があるが、実際はグラフ辺数、TC-STEP-011、収支の3テストのみで、非対称状態を回転した入力・出力の比較がない。
    required_change: 承認済み TESTCASES.md §3 に従い、非対称状態とその回転版で氷、全セル水量、外部流量、停止フラグを比較する。
  - id: R-004
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:84
    problem: TC-STEP-017 が閾値付近と次 step の一部のセルしか検査しない。
    evidence: A の水量・氷と B の水量は確認するが、第1・第2 step の独立総量、添加量、ring 交換、他の受容セル、停止フラグは承認済みケースの期待値と照合しない。
    required_change: TESTCASES.md §3 の紙上値を使い、2 step の局所値、台帳、停止状態を独立に確認する。
  - id: R-005
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts:10
    problem: 再生と停止の台帳6項目を完全には検査していない。
    evidence: Object.values(result.ledger) の比較は欠落した欄を検出せず、停止テストは先頭2項目の beforeTotal・afterTotal を照合しない。停止時の ice・noise・seed の参照非共有も未確認。
    required_change: 台帳6項目を名前付きで bit 比較し、停止時の前後総量と全可変配列・seed の非共有を確認する。
conditions: []
rollback_to: test-code
summary: Reiter 著者公開版の受容・拡散則と主要な半径2既知値は整合するが、承認済みケースの検証行列、独立収支オラクル、回転共変性、停止・再生の検査が不足している。テスト実行前にテストコード工程へ差し戻す。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts
    hash: sha256:330fc2b92ec84ad38d97b57c341eb414a14067925b1110272d97a59265650724
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts
    hash: sha256:8ca359c73cfbde137cb96b739d48d0c4600e08761478abc0c2ff6723607b71f8
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts
    hash: sha256:2dfdaecc8c160b24f3e9455f72788ad6d095e2113cdc62ec4c7eac5d93e2afa9
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:96
    problem: 承認済み TC-INVALID-001–010 の異常入力・有効端点・検証優先順位の大半がなお未実装で、入力不変性の一部は実際には検査されていない。
    evidence: 表駆動部は13例のみで、複合不正は1例、全量 overflow と停止済み境界は未検査。104行目は同一の変更後 snapshot を自身と比較する恒真 assertion であり、parameters の不変性も確認しない。
    required_change: TESTCASES.md §5 の到達可能な検証行列、先着 field、停止済み境界、全量 overflow を追加し、呼出し前に保存した変更対象 state・parameters の bit pattern と呼出し後を比較する。
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts:25
    problem: 台帳診断値の独立オラクルが承認済み Neumaier 契約を検査せず、微小な非零値をゼロへ丸める実装を通し得る。
    evidence: 参照総和と絶対値和は通常の reduce で、42・45行目の diffusionNet と residual は tauMass 内の近似比較のみ。TESTCASES.md §1 は固定順 Neumaier による直接照合を要求する。境界ケースでは vaporBudget による前後総量の別経路監査も行っていない。
    required_change: テスト専用の固定順 Neumaier 参照で台帳各項と診断用絶対値和を構成し、非零診断値の bit pattern を直接照合する。境界増減ケースでも vaporBudget の入力・出力総量と再構成した外部流量を照合する。
  - id: R-003
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts:31
    problem: 回転共変性は e=0 のみで、固定された非対称 noise を状態と共に回転する e>0 ケースがない。
    evidence: TESTCASES.md §3 の TC-STEP-012 は両ケースを指定するが、35行目の唯一の回転実行では noiseAmplitude=0 である。
    required_change: 有効な非対称 noise と e>0 の fixture を加え、noise と状態を共に60度回転した出力の全セル値・氷・外部流量・停止を比較する。
  - id: R-004
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:85
    problem: TC-STEP-017 の閾値3ケースで B の氷、台帳、停止フラグを確認せず、二段階検査でも受容範囲全体を確認していない。
    evidence: 3ケースの loop は A の質量・氷と B の質量だけを assertion にする。紙上期待値である各第1 step の ring 交換0・非停止、および第2 step の B の氷0と受容外セルの不変性は未検査である。
    required_change: TESTCASES.md §3 の literal 期待値に従い、3ケースそれぞれの B・ring・停止・台帳と、二段階目の受容範囲外のセルを確認する。
  - id: R-005
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts:10
    problem: 台帳項目の欠落と停止時総量の共通誤りを検出できない。
    evidence: 欠落した ledger 項目は bits(undefined) が NaN へ変換され、二つの再生結果で同じ欠落なら比較が通る。19行目の停止時 beforeTotal・afterTotal は直前の production 台帳値と比較するだけで、独立既知値123/10を検査しない。
    required_change: 台帳6項目の存在と数値型を名前ごとに確認したうえで bit 比較し、停止時の両総量を独立既知値123/10とも照合する。
conditions: []
rollback_to: test-code
summary: "Reiter 著者公開版の受容・拡散則、半径2の既知値、42/18/78辺、e=0回転は整合する。前回指摘の修正は部分的だが、異常入力行列、独立台帳診断、閾値・停止・再生の検出力に未解決の不足がある。テストは実行していない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts
    hash: sha256:3d5668fd6bad88385acd884eece07e6d4dcb8eb4aa82e50108f8506b0af34fae
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts
    hash: sha256:5981ab9f790893401edb8987ab31081f54fe3895bd91453498c5d961b14fa528
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts
    hash: sha256:08ef6a10681d7231c2f4290863087b35fac25b675bb2308c8f133d6f73326e15
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:96
    problem: 承認済み TC-INVALID-001–010 の検証行列と先着 field の検査が依然として大幅に不足している。
    evidence: 表駆動部は13例のみ。radius の非有限値・巨大値、各配列の型と両側の長さ、metadata、seed の全成分、セルの非有限値、各 parameter の非有限値・範囲、複数不正の優先順位、非停止時 stepIndex overflow、停止時の総量 overflow が未検査。後続 loop は例外 class のみを確認するものが多く、parameters の不変性も一部だけ確認する。
    required_change: TESTCASES.md §5 の到達可能な各代表値・優先順位・停止境界を表駆動で実装し、例外 class と最初の field、および変更対象 state・parameters の呼出し前後の bit 不変性を確認する。
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts:27
    problem: 微小な非零診断値に対する bit 比較の参照演算列が、承認済み台帳契約と異なる。
    evidence: diffusionNet は pairwise flux を各セルへ加算した delta の総和であり、契約上の固定順 Neumaier による各セルの u*_i-u_i の総和ではない。residual も指定の逐次減算ではなく3項の Neumaier 和で作る。50行目の条件付き bit 比較は、参照値が0なら非零値のゼロ丸めを検出せず、非零なら正しい実装を丸め順の差で棄却し得る。
    required_change: pairwise flux は独立した局所値オラクルとして維持し、台帳診断値には契約どおりのセル順・演算順・Neumaier 集計と residual の減算順を別途再現する。境界増減ケースでも vaporBudget の前後総量を照合する。
  - id: R-004
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:84
    problem: TC-STEP-017 の第2 step で、受容範囲全体と氷判定を確認していない。
    evidence: B を含む3セルの水量と h>=3 の水量は確認するが、残りの h=2 セルが非受容のまま水量0か、h=1 の各セルが閾値どおり氷になったかを確認しない。総量が一致しても誤ったセル間配分を見逃せる。
    required_change: 第2 step の全セルについて、承認済みの旧状態受容 mask から期待する水量と氷を照合する。
  - id: R-005
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts:17
    problem: 固定 noise・seed の値の保存と、返値を変更しても入力が不変であることを検査していない。
    evidence: 二つの再生結果の比較は、noise・seed を毎回同じように改変する実装でも通る。入力と出力の参照非共有は確認するが、出力配列を実際に変更して入力の bit pattern を再検査していない。
    required_change: 各 step の出力 noise・seed を入力値と bit 比較し、出力の3配列・seed tuple を個別に改変しても元入力が不変であることを確認する。
conditions: []
rollback_to: test-code
summary: "前回の e>0 回転ケース、停止時の既知総量、台帳6項目の存在確認は追加された。42/18/78辺と主要な紙上値も整合する。一方、異常入力行列、台帳の厳密な独立オラクル、受容範囲、固定 noise・seed の検出力が未完了。テストは実行していない。"
```

## 分割修正のファイル別レビュー（全3件の承認まで工程ゲートは未通過）

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts
    hash: sha256:29dee0976d9f69930e16aaba32f56f9ebc0c6738aabd9235e75be45237e2451c
findings: []
conditions: []
rollback_to: none
summary: "対象ファイルに限り承認。前回 R-005 は解消した。台帳6項目の存在・数値型・有限性と bit 一致、停止時総量の独立既知値123/10、各 step の noise・seed 保存、全可変配列と seed の参照非共有および改変時の入力不変性を確認した。TC-STEP-014 の異常入力・overflow 行列と PRNG import の構造検査は、このファイルの審査範囲外である。テストは実行していない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts
    hash: sha256:a8e7653fea7279830788cc306623bc6ebfa0a07b65e3e5604d1a3787597c4275
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:95
    problem: 有効な ice 配列を型違反として拒否する期待値がある。
    evidence: 3配列共通のループで ice に長さ19の Uint8Array を与えて TypeError を期待するが、半径2の ice の正しい型と長さである。
    required_change: 各配列について実際に異なる型を与え、有効な Uint8Array(19) は受け入れる。
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:127
    problem: TC-STEP-017 の第1 step 全セル期待値が承認済み紙上値と矛盾する。
    evidence: 中心以外の全セルで水量を A 以外0、氷を frozen と期待する。実際には A 以外の h=1 の5セルは各 gamma の水量を受け、3条件とも氷は0である。Reiter の旧状態受容則および TESTCASES.md §3 と一致しない。
    required_change: 中心・A・残り5つの h=1・受容外を分け、3条件それぞれの水量と氷を全セルで照合する。
  - id: R-006
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:103
    problem: seed の shape 異常ケースは対象 API を呼ぶ前にテスト側で例外を起こす。
    evidence: reject は最初に snapshot(state) を実行し、snapshot は seed を展開する。seed=null または非反復オブジェクトの場合、step を呼ぶ前に TypeError となり、例外 class・field・入力不変性を検査できない。
    required_change: 不正な seed shape も安全に記録できる snapshot を使い、step が seed を対象 field とする TypeError を出すことを確認する。
  - id: R-007
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:119
    problem: 非停止時の stepIndex 加算 overflow が未検査である。
    evidence: Number.MAX_SAFE_INTEGER の stepIndex は stopped=true でのみ成功を確認しており、stopped=false で RangeError(stepIndex) となる TC-INVALID-009 がない。
    required_change: 有効な非停止状態の stepIndex を Number.MAX_SAFE_INTEGER にして、例外 class・対象 field・入力 bit 不変性を確認する。
conditions: []
rollback_to: test-code
summary: "対象ファイルに限るレビュー。承認済み入力検証行列は大きく拡充されたが、有効入力を拒否する期待値、閾値ケースの誤った全セル期待値、seed 異常ケースのテスト側例外、非停止 overflow の欠落が残る。テストは実行していない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts
    hash: sha256:27270494143e47cd27197c08608bad5cf679b0db1b201944faa2fbcaca36ae33
findings:
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts:23
    problem: 台帳の bit 比較用オラクルが、承認済み設計で指定された凸結合形の拡散演算順を再現していない。
    evidence: uStar を pairwise flux の delta から作り、その値で diffusionNet と residual を厳密照合している。独立再計算では、現行 TC-STEP-011 の半径3・dtCa=1 で pairwise の diffusionNet は 1.942890293094024e-16、指定順の凸結合では -4.718447854656915e-16 となる。正しい実装を棄却し得る。
    required_change: pairwise flux は局所値の独立・許容差付き検査に残し、台帳の厳密比較には、座標から独立構築した近傍を用いつつ、指定された凸結合、セル順 Neumaier、residual 減算順を別途再現する。
conditions: []
rollback_to: test-code
summary: 前置・後置 reservoir 差、独立 vaporBudget、ケース別 tauMass、e>0 の noise・状態同時回転は確認できた。診断値の厳密オラクルに演算順の不一致が残るため、対象ファイルは未承認。テストは実行していない。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts
    hash: sha256:3b3040871e6cf260a95dc70d3b99a9de59c22580b3b44bfa8fb870cc11250992
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:119
    problem: 全量 overflow に契約外のエラー対象 field を要求している。
    evidence: TC-INVALID-010 は RangeError と入力不変のみを要求するが、テストは waterMass という field 名も要求する。beforeTotal などを対象に報告する適合実装を棄却する。
    required_change: 全量 overflow ケースでは RangeError と入力不変を検査し、エラー文面の field 名を固定しない。
  - id: R-002
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:33
    problem: 一部の不正入力について、入力不変性の snapshot が変更を検出できない。
    evidence: 83行目の paramBits は文字列 "0" と数値 0 を同じ bit pattern に変換する。state の beta・noiseAmplitude も同様で、seed が非反復オブジェクトのときは snapshot が元の参照を保持するため、例外前の型変更やオブジェクト内部の変更を見逃す。
    required_change: 不正型を数値へ強制変換せず、型と値を保持した独立 snapshot で例外前後を比較する。
  - id: R-003
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:113
    problem: 承認済み異常入力行列の検証優先順位と有限境界の一部が未検査である。
    evidence: 複数の配列型・長さ違反時の waterMass→ice→noise、state metadata と parameters が共に不正な場合の先着 field、停止済みで state と parameters が共に不正な場合、および非停止の elapsedCa=Number.MAX_VALUE と dtCa=1 が有限のまま通る境界を確認していない。
    required_change: TESTCASES.md §5 のこれらの組合せと境界を追加し、規定された例外・先着 field・入力不変または正常終了を確認する。
conditions: []
rollback_to: test-code
summary: "対象ファイルに限る再レビュー。前回の氷配列型、seed shape のテスト前例外、TC-STEP-017 の61セル・2 step、非停止 stepIndex overflow は修正済み。全量 overflow の過剰な field 指定と、不変性・優先順位の検出漏れが残る。テストは実行していない。"
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts
    hash: sha256:45cca957d510d126d01b2fcabe311728635a6228e8e1146f5e545dfc081d3f2d
findings: []
conditions: []
rollback_to: none
summary: "対象ファイルに限り承認。pairwise flux は局所値の許容差付きオラクルに限定され、台帳診断値は指定の近傍順による凸結合、セル順 Neumaier、residual の逐次減算で独立に再構成されている。半径3・dtCa=1 の凸結合 diffusionNet=-4.718447854656915e-16 を独立確認した。beta 増減時の前置・後置交換、独立 vaporBudget 監査、e>0 の noise 同時回転も確認した。テストは実行していない。"
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts
    hash: sha256:3c9e5fa146bc251e3d39e7f127bed3f0f21f71ccf907d6d637869ab1ce1cdc6b
findings: []
conditions: []
rollback_to: none
summary: "対象ファイルに限り承認。全量 overflow は契約どおり RangeError と入力不変のみを検査し、エラー field を固定していない。snapshot は数値の bit pattern と型を保持し、非反復 seed の内部も独立に記録する。配列・metadata・parameter・セルの優先順位、停止／非停止境界、elapsedCa の有限境界を確認した。TC-STEP-017 は61セルの水量・氷を2 step にわたり照合し、閾値近傍の総量も独立計算と一致する。テストは実行していない。"
```

## 分割修正後の横断レビュー

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts
    hash: sha256:3c9e5fa146bc251e3d39e7f127bed3f0f21f71ccf907d6d637869ab1ce1cdc6b
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts
    hash: sha256:45cca957d510d126d01b2fcabe311728635a6228e8e1146f5e545dfc081d3f2d
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts
    hash: sha256:29dee0976d9f69930e16aaba32f56f9ebc0c6738aabd9235e75be45237e2451c
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:61
    problem: TC-STEP-004 の平衡端点に必要な、beta=gamma=0 の初期格子を反復しても中心 seed 以外が成長しない検査が実装されていない。
    evidence: 現在の beta=0 ケースは、旧 interior に 2/5 の蓄積がある S2 を1 stepだけ進める。承認済み TESTCASES.md はこれとは別に createLattice(beta=0) の中心 seed を有効な dtCa で反復し、新氷なしを確認するよう要求している。現状ではゼロ reservoir からの自発的な水量生成や、複数 step 後の誤凍結を検出できない。
    required_change: createLattice(beta=0,noiseAmplitude=0) の中心 seed を beta=gamma=0 かつ有効な dtCa で複数 step進め、各 stepで中心以外の waterMass と ice が0、中心が waterMass=1かつice=1、reachedEdge=falseであることを確認する。
  - id: R-002
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts:83
    problem: TC-STEP-010 の閉グラフ pulse 検査が局所7セルと台帳2項目に限られ、承認済みの全セル値と総量保存を網羅していない。
    evidence: テストは中心3/10、最近傍6セル各1/20、diffusionNetとreservoirExchangeの+0だけを検査する。他の全セルが0、beforeTotal=afterTotal=3/5、outOfPlaneInput=0、residual=0を確認しないため、未観測セルへの人工的な質量生成や台帳総量の誤りが通過し得る。
    required_change: 半径3の全セルを独立期待値と照合し、beforeTotal、afterTotal、outOfPlaneInput、residualも承認済みTC-STEP-010の値と比較する。
conditions: []
rollback_to: test-code
summary: "入力検証、pairwise flux、指定順の凸結合・Neumaier台帳、独立vaporBudget監査、回転共変性、閾値、停止、再生の主要経路は整合し、未実装のpublic stepはnamespace経由の明示assertionで失敗するためRedは構文・型・module解決エラーではなく期待したassertion failureになる。一方、TC-STEP-004の反復平衡端点とTC-STEP-010の全セル・総量検査が欠けるため、TC-STEP-001〜017全体のゲートは未承認。テストは実行していない。"
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts
    hash: sha256:e1a803af5e1090992ab1292b758710aed789d85b08eed335c9b77a9919bdfd18
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts
    hash: sha256:45cca957d510d126d01b2fcabe311728635a6228e8e1146f5e545dfc081d3f2d
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts
    hash: sha256:29dee0976d9f69930e16aaba32f56f9ebc0c6738aabd9235e75be45237e2451c
findings: []
conditions: []
rollback_to: none
summary: "前回 R-001 は、beta=gamma=0 の中心 seed を dtCa=1、1/2、Number.MIN_VALUE で反復し、全セルの水量・氷・停止状態を検査するケースにより解消した。R-002 も、半径3の全37セルと台帳6項目を独立既知値へ照合することで解消した。既承認の入力検証、閾値、指定順の凸結合・Neumaier台帳、独立収支監査、回転共変性、停止、純粋性、再生に回帰はなく、TC-STEP-001〜017およびTC-INVALID-001〜010のゲートを承認する。指示に従いテストは実行していない。"
```

## 無効な Red 後の型検査修正レビュー

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/reiter-step.test.ts
    hash: sha256:c8854aa3a82e35b3156d2d11c0a6892d2f37e8cc9187cf2912f00e384de087c5
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts
    hash: sha256:70d1fbbcccef9eb983f0a5e843fd4ec7fcaf21bc614ace24afb109d791518935
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/replay.test.ts
    hash: sha256:29dee0976d9f69930e16aaba32f56f9ebc0c6738aabd9235e75be45237e2451c
findings: []
conditions: []
rollback_to: none
summary: "無効な Red で判明した型検査修正を静的に再審査した。reiter-step.test.ts の unknown 経由キャストは、通常 Array、誤 typed array、非反復 seed、長さ違反 seed など意図的な実行時不正 fixture の値を変えず、型注釈は実行時に消去される。未使用 helper の除去後も、承認済みの入力検証順・入力不変性・平衡端点・全37セル pulse・61セル閾値検査は保持されている。mass-conservation.test.ts の座標 tuple 明示展開は同じセル順と近傍式を保持し、pairwise 局所値、指定順の凸結合、Neumaier 台帳、独立 vaporBudget 監査、回転共変性を弱めていない。replay.test.ts は前回承認済み hash と一致する。指示に従い型検査・テストは実行していない。"
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts
    hash: sha256:0a871124dfc98a60add8c5e9418739faff1767ed0265c903ccde6f4afe195fde
findings: []
conditions: []
rollback_to: none
summary: "Red attempt 2 で残った TS2532 の修正を静的に再審査した。pairwise-flux とグラフ計数の各ループは c[i]! を readonly tuple として安全に分割代入し、セル順・方向順・無向辺選別・flux と delta の演算順を保持する。同じ非安全な c[i][0/1] 形式は残らず、独立グラフ、pairwise 局所値、凸結合・Neumaier 台帳、vaporBudget 監査、回転共変性に変更はない。型検査とテストは実行していない。"
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/mass-conservation.test.ts
    hash: sha256:020bd902b0ca8599681e3f85ac7380c6dfad9d78b332cc2cd4ff1f92e5b2dd9d
findings: []
conditions: []
rollback_to: none
summary: "ユーザー承認済みの4回目の限定修正を静的に再審査した。明示代入2箇所を元のcompound assignmentへ逆変換したファイルのSHA-256は、直前の承認済みhash 0a871124dfc98a60add8c5e9418739faff1767ed0265c903ccde6f4afe195fde と一致し、他の変更混入はない。明示代入は noUncheckedIndexedAccess のTS2532を解消し、同じbinary64加減算、セル順、方向順、flux適用順を保持する。型検査とテストは実行していない。"
```
