# T1-7 Reviews

```yaml
review_type: design
status: needs-human
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:be042a6cdddbf4144683b2f87a4c8ab5aad6fabb2d7b9028c101aa50e2476e17
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:54206b497c15292bb5f6af050d12c010c8a4e70f4f520360bde8f7b1798020af
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md:22
    problem: "D-03の形態タグprovenanceが人間所有の未決事項であり、T1-7の設計ゲートを確定できない。"
    evidence: "選択肢1・2は人間承認されたproject annotationをtag lossへ使用する一方、選択肢3はtag loss自体を保留するため、コーパス契約、loss、T1-8の候補選択、T1-7完了条件が変わる。DESIGN.mdは未決の間にloss・較正入力へ進まない停止境界を正しく置いているが、これは設計承認後に解消できる実装詳細ではない。"
    required_change: "人間がD-03の選択肢を決定してDECISIONS.mdへ記録し、その決定に合わせて形態注釈schema、監査、loss、テストhandoff、T1-7完了条件を一意に更新する。"
  - id: R-002
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md:341
    problem: "観測1点と半径10・20・40 cellsの三つのsimulation checkpointを対応付ける規則がなく、shape/tag lossが一意に定まらない。"
    evidence: "physical time、視野寸法、実寸、CA stepをlossから除外する一方、候補は三つの成長段階でmetricsを返す。どのcheckpointを観測予測とするか、三段階を平均・選択・別成分化するかが未定義なので、同じcorpus、candidate、seedから異なるloss、候補順位、Pareto判定を得られる。視野寸法を結晶寸法と誤認していない点は正しいが、観測成長段階との対応を全て捨てた後の比較近似と不確かさが固定されていない。"
    required_change: "観測ごとの予測を三checkpointから作る完全な決定規則と集計順を定義し、その規則が物理時間・FOV・実寸を読まないこと、成長段階差をどの近似として扱うか、候補failure/null時の挙動を記録する。物理的意味付けを伴う選択なら人間判断へ戻す。"
  - id: R-003
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md:209
    problem: "projected-shapeの抽出根拠を保存する契約がschemaに存在せず、無次元形状intervalを監査・再計算できない。"
    evidence: "ProjectedShapeV1が保持するのは最終interval、reason、mask hashだけだが、本文は中心と6 endpoint座標をobservationのextraction evidenceへ保存すると要求する。そのpropertyはObservationV1にもProjectedShapeV1にもなく、unknown propertyは拒否される。さらにmask自体をcommitしないため、annotator A/B別のraster寸法、中心・endpoint、foreground数、周長、共分散、抽出値がなければmin/max intervalの由来を後から検証できない。"
    required_change: "A/B別の抽出証跡を表す明示schemaを追加し、raster寸法、mask hash、中心・時計回りendpoint、各生値と必要な中間量、利用可否理由、adjudicationとの整合を検証対象にする。保存しないmaskだけに再現性を依存させない。"
  - id: R-004
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md:352
    problem: "tagRankLossとempirical-CDF shape lossの数値アルゴリズムが再現可能な精度まで定義されていない。"
    evidence: "tagRankLossはどのannotation fieldを順序化するか、compactnessとtipDensityを別成分にするか統合するか、増減方向、pair母集団と分母、seed/checkpoint集計の前後関係を定めていない。shape lossもmid-rankは同値点だけを定め、sample間・最小未満・最大超過の予測値やinterval端点へ適用するCDFの厳密式を定めていない。このままでは独立実装が異なるlossを返し得る。"
    required_change: "各rank componentの入力field、向き、比較pair、tie・欠測、分数の分子分母、集計順を式で固定する。CDFは有限train multisetに対する全実数上の関数、同値mid-rank、区間端、外挿端、null条件を明示し、TESTCASESへ独立したliteral手計算を引き渡す。"
  - id: R-005
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md:414
    problem: "holdoutを一度だけ開封する要件に、再起動後も検証可能な状態遷移または記録schemaがない。"
    evidence: "scoreHoldoutOnceという名称とtrain APIの入力拒否だけでは、同じrunでの二回目呼出しや別processからの再評価を識別できない。候補manifestとtrain reportのhash固定を述べるが、未開封・開封済み状態、評価対象hash、結果hash、二回目のerrorを保持する成果物が定義されていないため、テストhandoffの「評価記録が一回」を機械的に立証できない。"
    required_change: "holdout run recordまたは明示的な人間ゲートを設計し、corpus・split・protocol・candidate manifest・train reportのhash、開封状態、結果、二回目呼出し時の挙動を固定する。永続的に強制しない場合は機械保証を主張せず、手続き上の受入責任者と証跡を明記する。"
conditions: []
rollback_to: design
summary: "一次資料v1について206観測、PDF 12,317,042 bytes、SHA-256、温度±0.2°C、過飽和度0.8–1.2倍、既知成長時間、image scale、代表例の主観選択、2D投影解釈の熟練依存を独立照合した。FOVを結晶寸法と呼ばない分離、source値とproject annotationのprovenance、206点監査、condition-group split、train CDF再利用、RFC 8785 canonical hash、time/FOV/実寸のloss除外、著作物境界、latticeCellCount(115)=40021、seed生成、次元式は妥当である。しかしD-03はloss契約を変える未解決の人間判断であり、checkpoint対応、抽出証跡、loss式、holdout一回性にも再現性を妨げる設計欠落が残るため承認できない。"
```

```yaml
review_type: testcases
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:519c93484e8a8fe890fe49694ac75a196e9cdac78c0e4f11790eb0b6ab2ec92e
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md:398
    problem: 人間確認工程がproduction corpusを参照しないことを、宣言値以外では検証していない。
    evidence: >-
      TC-SOURCE-AUDIT-001はproductionCorpusReadDuringHumanVerification=falseをschema literalとして検査するが、
      TC-SOURCE-AUDIT-004/005の状態fixtureにはproduction corpus accessorのthrowing stubまたは呼出し回数検査がない。
      そのため、確認画面がcorpus.jsonから値を読み、manifestにはfalseを記録する実装でも、候補hash、表示時刻、
      field確認、824件完全性の各検査を通過できる。これはDESIGN.md §6.1の「production corpusをsource oracleとして
      採用しない」という独立性境界を機械的に保証しない。
    required_change: >-
      人間確認状態fixtureへproduction corpus読込み境界を注入し、候補表示、既存32件移行、各field確認・訂正、
      export完了までaccessorをthrowing stubにして呼出し0回を検査する。確認値の入力元がfrozen A/B候補、
      comparison、backup、原PDF操作だけであり、最終的なcorpusとの事後照合とは経路が分離されることを固定する。
  - id: R-002
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md:321
    problem: A/B双方が同じU+03BCのFOV rawを持つexact分岐で、proposed/final rawをU+00B5へ正規化する契約が検査されない。
    evidence: >-
      DESIGN.md §6.1.1はexactであってもsquareFieldOfViewの有効なU+03BC suffixをU+00B5へ変換すると定める。
      TESTCASESはcanonical-unit-equivalent分岐のU+00B5 proposalを明記する一方、exact分岐では単に
      proposed=[raw,normalized]とし、このsynthetic境界例を持たない。固定証跡は全206 FOVが
      A=U+03BC、B=U+00B5であるため、既知comparison hashだけではexact-U+03BC分岐を通らない。
    required_change: >-
      squareFieldOfViewについて、双方U+03BCでraw/normalizedが一致するexact正例を追加し、
      candidate preimageのrawはU+03BCのまま、comparison proposedとfinal rawだけがU+00B5になることを検査する。
      双方U+00B5は無変更、FOV以外やsuffix以外のmuは変換されない負例も同じ分岐表へ固定する。
  - id: R-003
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md:427
    problem: 訂正・不一致理由の非PII要件を、rationale文字列の内容に対して検査していない。
    evidence: >-
      TESTCASESはPII propertyを拒否するとだけ規定するが、schema上の理由はrationaleという単一stringである。
      したがってrationaleに氏名、email、account ID、端末名を直接入れても、追加property禁止、非空検査、
      action整合性をすべて通過できる。DESIGN.md §6.1とD-10は非個人情報の理由を必須としている。
    required_change: >-
      少なくともemail、account ID、端末名など定義可能な禁止形式をrationaleへ入れたmutationを追加して拒否し、
      理由には原資料上の差異だけを記録する制約を検査する。自由文で完全なPII検出を保証できない場合は、
      許可された非PII reason codeと任意の限定補足へ契約を狭める。
conditions: []
rollback_to: testcases
summary: >-
  対象hashは指定値と一致した。独立再計算によりA/B各206件、candidate hash
  de2d1e32eed414f020c1be76fc82b2209848da2b399aa1f00c96ecb55638f732 と
  b641538a2344cb348e62532cb6e48aaf3b9b5cf236fd703a51a7f1b3d9cdcfd3、
  comparison hash 33c545adebfae122fea0d84985445f60eeb7f17ed1e0e9ba2cb99d7a34b6bad9、
  exact 618・canonical-unit-equivalent 206・different 0、および移行ID集合hash
  92e23ab4ae1ea2b1406296a11e94ab519a1c020fb2a54559acf4b4bf0fbc6ea5を再現した。
  backupもhash一致、33件中32件complete、P11-N033未完了、128 fieldすべてA/B整合を確認した。
  既存32件のbytes/binary64保持、全206 panel・824 field確認、disagreement default禁止、
  freeze順、非循環、旧第三blank転記方式の除去は概ね反映され、split/loss/protocol/holdoutケースは
  差分上弱体化されていない。しかしproduction corpus非参照、exact-U+03BC正規化、非PII理由に
  未検査経路が残るため承認できない。
```

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:f848e95eab3c7d6be0f86e46a778a780345aaba2faa3e5ed3fc57b593f091a62
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:c76eee8fcb6dd0f04761da080d7bcd5ad267fead87e79d8d4bc5fb340d0a4dd6
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md:523
    problem: The exact JCS preimages for transcriberASetSha256, transcriberBSetSha256, comparisonSetSha256, and migratedConfirmedIdSetSha256 are not fully specified.
    evidence: The A/B preimage is described only with bracket notation, the comparison hash has no record or tuple schema for its per-ID/per-field results, and the migrated confirmed-ID-set hash has no stated ordering or preimage definition. Multiple object/tuple representations satisfy the prose but produce different SHA-256 values, so an independent validator cannot reproduce these provenance hashes uniquely from TranscriptionEvidenceV1 and the migration record.
    required_change: Define exact JSON interfaces or fixed-width tuple schemas for all four hash preimages, including included fields, field/tuple order, ID ordering, candidate-comparison representation, the stage at which the narrowly scoped U+03BC/U+00B5 rule is applied, and the precise migrated-ID-set JCS preimage.
conditions: []
rollback_to: design
summary: The amendment otherwise matches the human decision and preserves per-panel human confirmation, A/B independence, disagreement handling, source-oracle boundaries, and downstream invalidation. Independent checks confirmed the supplied backup hash, 33 objects, 32 confirmed entries, blank P11-N033, and agreement of those 32 entries with the two 206-entry drafts; however, the new provenance hashes are not yet uniquely reproducible.
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts
    hash: sha256:e52f80413dc866c02807d9296610b098d179141507952e47e29162b01c90e6a2
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:85
    problem: "実artifact validatorは承認済み完全schemaと依然として非互換かつ不完全である。"
    evidence: "validateCorpusV1はDESIGNのnested sourceとannotationApprovalsを許可せず、schema外のflat arxivId等を要求し、ObservationV1のsourceIdKind、sourceUncertainty、morphology、projectedShape、transcriptionを検証しない。validateSourceAuditV1はpages、auditMethod、全source entry、approval、相互hashを検証しない。validateSplitV1は正しいschemaVersion snow-crystal-observation-split/1ではなくsnow-crystal-calibration-split/1とflat assignmentを使う。validateProtocolV1もroot unknown propertyを拒否せず、loss、seed、failure code、candidate、holdout契約の大半を検証しない。"
    required_change: "DESIGNおよびTESTCASESのCorpusV1、ObservationV1、SourceAuditV1、SplitV1、ProtocolV1を完全に識別するvalidatorへ置き換え、全階層のrequired、unknown、wrong-type、null、literal、固定順、参照、JCS hash mutationを正例と負例で実行する。"
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:192
    problem: "annotationとprojected-shapeの追加テストは承認済みliteral契約をまだ実行していない。"
    evidence: "annotation fixtureはgrowthAxis='basal'とhollowing=falseというschema外の値を使い、TESTCASESの基底vote、3個の既知hash、既知approvalId、batch/individual適格性、PII拒否、完全validatorを検査しない。206件も全てP11-N001..N206として生成した自己整合配列にすぎない。shape fixtureはTESTCASESの2x2/3x3既知mask hash、11x11 evidence、4/pi、6-arm CV、covariance/eigenvalue再計算を使わず、endpoint角度順やstatus/null/reason/audit整合もvalidatorへ渡していない。"
    required_change: "TC-ANNOTATION-001..003とTC-SHAPE-001..003の承認済みliteral値を使用し、完全validatorを通る正例、既知hash、独立再計算、および各field/status/order/hash mutationの負例を追加する。"
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:209
    problem: "split、rank/CDF、scale、candidate、baseline、Paretoの主要アルゴリズムが依然として縮退したfixtureまたは自己比較である。"
    evidence: "split testは9個のstratum名と3件の簡易assignmentを見るだけで、bin境界、group hash、holdout数、完全SplitV1、10 synthetic ID、冗長参照を検査しない。rankは観測pair直積、整数分数、component/group/stratum/seed/checkpoint階層を計算せず、CDF scorerはpredictionを受け取らずu=0.5相当を暗黙に固定している。24件は件数と一意性だけで、time/FOV metamorphic invariance、failure伝播、等重み集計を検査しない。modal/median/nearest baselineは未実装で、候補順、null、failure、全Pareto表も未検査である。"
    required_change: "TC-SPLIT-001..004、TC-RANK-001..003、TC-CDF-001..003、TC-SCALE-001..002、TC-CANDIDATE-001、TC-BASELINE-001、TC-ACCEPT-001の各literal fixtureとmutationを個別に実装し、厳密分数、各階層で再初期化するNeumaier、24 record、failure/null、候補順、baseline、全Pareto期待値を検査する。"
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:229
    problem: "8 seedの正値確認は追加されたが、ProtocolV1完全契約とseed mutation・決定性検査は未完了である。"
    evidence: "8個のdigestとlittle-endian stateは独立再生成される一方、順序検査は配列を自身のcopyと比較する恒等式で、index交換、重複、欠落、all-zero、prefix変更、state bit変更を試さない。fresh process決定性もなく、spawnSyncは未使用である。protocolFixtureとvalidateProtocolV1は完全なrank/shape定義、criterion、seed list、failureCodes、candidate path/hash/id rule、holdout basenamesを欠き、required/unknown/null/version/order/reference mutationも未実装である。"
    required_change: "TC-PROTOCOL-002..005の完全positive literalと全mutationを実装し、8 seedの順序・一意性・all-zero・prefix/state変更、同一processとfresh processのbit-for-bit決定性、およびProtocolV1全階層を検査する。"
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:97
    problem: "holdout helperは設計された漏洩防止、永続marker、排他競合、crash境界を満たしていない。"
    evidence: "helperは全input hash、selected comparator、human gate、sealedRecordSha256を検証せず、intent markerをflushせず、成功時にmarkerを削除してDESIGNの永続保持規則へ違反する。reportには全hash、candidate/comparator、24明細、loss、Paretoがない。テストは同一process二回目だけで、trainingへのholdout混入、hash/gate mutation、2 child process競合、opening/report crash、再起動後reader 0回、sealed/opening/openedとmarkerの全組合せを検査しない。"
    required_change: "TC-HOLDOUT-001..003どおり、完全sealed recordの事前検証、wx+flushした永続marker、same-directory temp+flush+rename、reader境界、完全report/opened record、training隔離、二重open、child-process競合、各crash/restart状態を観測可能なspyで検査する。"
  - id: R-006
    severity: medium
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:239
    problem: "5成果物の独立Redと実directory走査は解消したが、通常テストの非ネットワーク境界が未検査である。"
    evidence: "実行結果はcorpus.json、split.json、protocol.json、SHA256SUMS、SOURCE-AUDIT.jsonについて異なる5個の欠落assertionとなり、readdirSyncによる4 basename、subdirectory、画像拡張子の検査も存在する。一方、TESTCASESが要求するglobal fetch throwing stubまたは同等のHTTP/DNS利用検出がなく、将来real-artifact loaderへネットワーク経路が加わってもこのtestは識別しない。"
    required_change: "通常テスト中のfetch/HTTP(S)/DNS利用を失敗させる明示的な非ネットワーク検査を追加し、既存の5独立存在assertionと実directory走査を維持する。"
conditions: []
rollback_to: test-code
summary: "typecheckは成功した。対象Vitestは26件中20件Green、5件がcorpus.json・split.json・protocol.json・SHA256SUMS・SOURCE-AUDIT.jsonそれぞれ固有の期待Red、REAL206統合1件が計画どおりskipであり、Red形状とR-007のescaped duplicate key／合法文字列Infinityは解消している。ring 690点、rho²最小9919、40021、8 seed値も妥当だった。しかし完全schema、annotation/extraction、split/loss/baseline/Pareto、Protocol mutation、holdout永続性の主要検査が未実装のためtest-code gateは不合格とする。"
```

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:5e9adac92f25482808f6026ece2b22fe954c4f7b436a2d42fabd48ec86241eec
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:810072d42faef608019c34bba7440c7e0e085b721972f3ed529da0b1a4e3a889
findings:
  - id: R-004
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md:467
    problem: "rank/shape lossのstratum定義と走査順が一意でなく、同じ入力から異なるgroupingまたはbinary64集計値を得られる。"
    evidence: "§9はtemperature 3区間とsupersaturation 3区間の直積をstratumとする一方、§10.1は「temperature stratum h」と記し、temperatureだけの3区間とも読める。また§10.2はNeumaier sumを「§9順」で行うが、§9は9個の直積要素についてtemperature-majorかsupersaturation-majorかを定義していない。tag lossのpair母集団とshape lossのbit-for-bit値に複数の適合実装が生じるため、前回R-004の集計順要件は完全には解消されていない。"
    required_change: "hを`(temperatureBin,supersaturationBin)`の2次元stratumと明記し、9 stratumの正確なnested順序を固定する。§10.1のtemperature-only表現、§10.2、baseline、TESTCASES handoffをその順序へ統一し、異なる両軸binを含むliteral fixtureで検証する。"
  - id: R-006
    severity: low
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md:564
    problem: "半径40 checkpointの境界感度適用範囲について、T1-0の上限を`115/2`とする説明が誤っている。"
    evidence: "T1-0は上限を`H_R`の最小reservoir中心距離の1/2と定義する。`h=115`の六角ringでは最小`rho`は`(q,r)=(115,-57)`または`(115,-58)`の`sqrt(9919)≈99.5942`であり、上限は約49.7971 cellsであって57.5ではない。checkpoint 40自体は真の上限内なので、現行値では挙動不良にならないが、適用範囲の根拠が上位設計と不一致である。"
    required_change: "T1-0の定義から最小reservoir中心距離を導出して約49.7971 cellsと記録し、40がこの真の上限内であることを根拠にする。"
conditions: []
rollback_to: design
summary: "固定版PDFを独立確認し、14 pages、12,317,042 bytes、SHA-256、206観測、既知成長時間、image scale、温度±0.2°C、過飽和度0.8–1.2倍、代表例の主観選択、2D投影解釈の熟練依存は一次資料と一致した。ユーザー決定した独立A/B草案と人間のbatch/個別承認、承認前利用禁止、静的データ限定、checkpoint周辺化、A/B抽出証跡、rank/CDF式、holdout永続状態によりR-001、R-002、R-003、R-005は解消されている。しかしlossの2次元stratumと走査順がまだ一意でなくR-004が残り、境界感度上限の説明にも数値誤りがあるため承認できない。"
```

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:e408c8b193e784cac685352e6e178bf5d64c5fcc0a6d041898df4bee7769e911
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:810072d42faef608019c34bba7440c7e0e085b721972f3ed529da0b1a4e3a889
findings: []
conditions: []
rollback_to: none
summary: "一次資料と上位成果物に照らして全体を再審査した。公式arXiv記録の206観測、既知成長時間、c-axis needle、温度・過飽和度依存という資料位置づけ、および記録済みPDF検証証跡と整合する。R-004はhを温度bin×過飽和度binの2次元9 stratumへ一意化し、(T0,S0)から(T2,S2)までのtemperature-major／supersaturation-minor順をsplit、rank、shape、baseline、acceptance、階層別Neumaier集計、literal test handoffへ一貫して適用したことで解消した。指定fixtureも両軸が異なる4 stratumと異なる寄与を要求しており、temperature-only実装を検出できる。R-006はh=115 ringを独立全列挙し、最小q^2+qr+r^2=9919、sqrt(9919)/2=49.79708826829135、checkpoint 40が上限内であることを再計算してT1-0の適用範囲と一致した。独立A/B草案、exact/highのみのbatch承認、不一致・low・mediumの原PDF個別確認、全206点の人間承認被覆、承認前利用禁止がD-03と整合し、R-001の人間判断は解決済みである。checkpoint等重み周辺化、A/B抽出証跡、rank分数とempirical mid-CDF、永続holdout状態機械、出典転記監査、単位・不確かさ・適用範囲、著作物境界、独立oracle、変更境界にも未解決の矛盾はないため設計を承認する。"
```

```yaml
review_type: testcases
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:d733a786b4a2005aa80ced9c392c224f6d1b0a2cab974b294830a615c0652256
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md:562
    problem: "split.json と protocol.json の版付き完全 schema、および protocol が固定すべき rasterizer 名・完全 version の期待値と検査が定義されておらず、テスト実装者が公開静的データ契約を発明しなければならない。"
    evidence: "TC-REAL-001 は抽象的に protocol literal とだけ記す一方、split/protocol の schemaVersion、必須 property、null/型、unknown property、9 stratum record、明示 ID list、group hash、loss component、renderer、seed/checkpoint、候補 manifest 契約の保存形を固定していない。承認済み DESIGN は protocol.json に 600 dpi・sRGB・RGBA8・top-left と renderer 名・完全 version を固定すると要求するが、TESTCASES には renderer 検査が一件もない。このままでは互換性のない複数の JSON 構造が Green になり得て、後続 T1-8 が一意に消費できない。"
    required_change: "DESIGN に戻り、split.json と protocol.json の versioned schema、全必須 field、canonical array order、renderer の literal 名・完全 version、候補 manifest 参照契約を固定する。その後 TESTCASES に正例、missing/unknown/wrong-type、順序、参照、JCS hash mutation の検査を追加する。"
  - id: R-002
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md:120
    problem: "REAL206 の出典内容を、テスト対象 corpus から独立した固定 oracle に照合する手順が不足しており、自己整合した誤転記または架空データでも Green にできる。"
    evidence: "page 別件数は「実PDF監査で得た corpus 値」と比較するとされ、TC-REAL-001 も個別 source 値を「committed data」から期待するとしている。corpus 自身から page count、raw label、bounds、転記 A/B、approval hash、SHA256SUMS を再生成すれば、固定 PDF と異なる206件でも機械検査を通せる。これは production data loader と期待値経路を分離するという本書 §1、および独立原資料 oracle の要件を満たさない。"
    required_change: "固定 hash PDF から corpus 作成経路と独立して得た page 別件数・ID/locator・raw/normalized source 値の監査 manifest、または人間レビュー済み canonical corpus hash を別証跡として凍結し、REAL206 がその独立値へ照合する手順を定義する。対象 corpus や同じ generator から期待値を生成しないことを明記する。"
  - id: R-003
    severity: low
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md:24
    problem: "成果物数の記述が固定配置と矛盾し、許可されるファイル集合が一意でない。"
    evidence: "§1 は corpus.json、split.json、protocol.json、SHA256SUMS の4ファイルを列挙するが、§1.1 は「4 JSON」、TC-CORPUS-001 は「4 JSON/SHA256SUMS」と記す。実際は3 JSONとSHA256SUMSであり、後者の解釈では余分なJSONを許可し得る。"
    required_change: "全記述を「3 JSON と SHA256SUMS の計4ファイル」に統一し、repository scan は列挙した4 basename以外を拒否する。"
conditions: []
rollback_to: design
summary: "一次資料の206観測という位置付けを確認し、approval/JCS/mask hash、8 seed、shape CV、rank/CDF、Neumaier、rho^2=9919 と境界上限の literal 値は独立再計算で一致した。主要な数値 fixture は妥当だが、split/protocol の実装可能な schema と renderer 固定、およびREAL206を対象データから独立に保証する oracleが不足しているため承認できない。"
```

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:38ce331f9e88d0bc39e7654c68192f6f0e88853777c21c9ad97bc9be1654a998
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:810072d42faef608019c34bba7440c7e0e085b721972f3ed529da0b1a4e3a889
findings: []
conditions: []
rollback_to: none
summary: "前回testcase R-001/R-002/R-003への上位設計修正を、SPEC、DESIGN-OUTLINE、T1-0、T1-7の既存承認設計および未承認TESTCASESと照合した。SplitV1とProtocolV1は全property必須・追加property拒否・null規則・固定tuple順、9 stratum、group/partition/全206 IDと冗長参照、JCS hash、loss、raster、8 seed、checkpoint、最大step、candidate、holdout契約を実装判断不要な粒度で固定している。calibration data directoryも3 JSONとSHA256SUMSの計4 basenameだけに一意化された。SOURCE-AUDIT.jsonは固定hash PDFからproduction corpus/generatorを見ずに行う別の人間captureとして、4 page・全206 ID/locator/raw/normalized値、source-entry、pre-annotation split、最終corpus、payload hashと人間承認を保持し、作成順と相互hash参照に循環はない。公式資料でpdfjs-dist v6.3.289と@napi-rs/canvas v1.0.6の存在、PDF.jsのNode要件 >=22.13.0 || >=24 とcanvas ^1.0.6、ローカルNode v24.14.1の適合を確認した。600 dpi、scale 25/3、sRGB、RGBA8、top-left等もliteral化され、通常テストは保存済み証跡のみを検証する境界が明確である。独立再計算では600/72が25/3とbit一致し、h=115 ringの最小rho^2=9919、適用上限49.79708826829135、8 seedのhash/stateも既存契約と一致した。annotation、loss、split、checkpoint、holdout、著作物境界に退行はなく、新たな人間所有の設計判断も残っていない。"
```

```yaml
review_type: testcases
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:c9fab94a490e431a580e48c9f306d1f80d0ad4c3adfaf7daf23427bff5632a22
findings: []
conditions: []
rollback_to: none
summary: "承認済みDESIGN、DECISIONS、上位成果物および前回R-001〜R-003に照らして全体を再審査した。calibration data directoryはcorpus.json・split.json・protocol.json・SHA256SUMSの4 basenameだけを許し、3 JSONとSHA256SUMSという成果物境界および余分なfile/subdirectory拒否が一貫している。SplitV1とProtocolV1は完全なversioned positive schema、全階層のrequired/unknown/wrong-type/null、固定tuple・array順、冗長参照、JCS mutation、9 stratum、loss、seed、checkpoint、candidate、holdout契約を検査し、rendererもpdfjs-dist 6.3.289、@napi-rs/canvas 1.0.6、Node 24.14.1、600 dpi、600/72=25/3、sRGB、RGBA8 straight alpha、top-leftを完全一致で固定している。SOURCE-AUDITはproduction corpus・generator・A/B転記表から独立した人間の原PDF captureとして、4 page、206 ID、locator、raw/normalized値、source-entry・pre-annotation split・final corpus・payload hash、人間approvalを全件照合し、freeze/stale伝播と非循環依存を検査するため、REAL206はcorpus自身をoracleにできない。実観測placeholderとsynthetic literalは明確に分離され、未確定実測値を捏造せず、正規データが準備されれば適合実装がGreenになれる。approval/JCS/mask hash、形状CV、8 seed、rank分数、mid-CDF、階層別Neumaier、rho^2最小値9919、境界上限49.79708826829135、lattice cell数40021を独立再計算して記載値と一致し、time/FOV非依存、24 checkpoint×seed、holdout隔離・一回開封、expected Redにも退行はない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts
    hash: sha256:71d836ae9ca3fea498da61352fa0dfd62ed32f1e502682dc373e4974ee3e1556
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:90
    problem: "実artifactのvalidatorが承認済みschemaと非互換かつ不完全で、適合corpusを拒否する一方、必須データを欠くartifactを受理する。"
    evidence: "validateCorpusV1はDESIGNのnested sourceとannotationApprovalsをunknown propertyとして拒否し、逆に設計に存在しないflat arxivId等を要求する。さらにcorpus observationへSourceAudit用normalizedSourceValues形式を要求し、sourceUncertainty、morphology、projectedShape、transcriptionを検証しない。validateSourceAuditV1、validateSplitV1、validateProtocolV1も完全schemaの大半を検査せず、unknown property、required property、固定array順、相互hash参照の欠陥を見逃す。"
    required_change: "DESIGNとTESTCASESの完全なCorpusV1、ObservationV1、SourceAuditV1、SplitV1、ProtocolV1をそのまま識別するvalidatorへ置き換え、全階層のrequired、unknown、type、null、literal、順序、参照、hash mutationをpositive/negative fixtureで検査する。"
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:119
    problem: "annotationとprojected-shapeのテストが契約を実行せず、無効な値を単に自己比較している。"
    evidence: "annotation fixtureはschema外のagent/value='plate'を使い、A/B vote、draftStatus、reviewMode、approvalId算出、206 IDのapproval被覆をvalidatorへ渡していない。shape fixtureは規定外の0/255 maskを文字列hashし、uint32 little-endian寸法、0/1 pixel bytes、foreground count、4-neighbor perimeter、centroid、covariance、eigenvalue、6-arm CV、A/B interval、status/null/reason整合を検査しない。このためannotationや抽出証跡が壊れた実artifactでもGreenになり得る。"
    required_change: "TESTCASESのliteral annotation、approval hash、mask bytes、中間量、固有値、arm endpoint、intervalを使用し、完全validatorと独立再計算を通す正例および各mutationの負例を追加する。"
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:146
    problem: "split、rank/CDF、scale、candidate、baseline、Paretoの主要契約が代表値または恒等式に縮退しており、不正な較正実装を識別できない。"
    evidence: "splitは1行だけで9 stratum、bin境界、canonical order、group hash、206 ID参照を検査しない。rankは単一配列の平均だけでpair/group/component/stratum/seed/checkpoint階層を検査せず、CDFも階層集計を検査しない。scale testは必要な3 checkpoint×8 seed=24件ではなく無関係な4 scale×8 seed=32件を数える。candidate family/order/tie/failure、modal/median/nearest baseline、nullを含むPareto規則も計算せず、配列やbooleanを自己比較している。"
    required_change: "TC-SPLIT-001..004、TC-RANK-001..003、TC-CDF-001..003、TC-SCALE-001..002、TC-CANDIDATE-001、TC-BASELINE-001、TC-ACCEPT-001のliteral fixtureとmutationを個別に実行し、24 recordの等重み集計、Neumaier再初期化、failure/null、候補順、baseline、Pareto期待値を厳密検査する。"
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:168
    problem: "ProtocolV1の固定値・完全schema・8 seed契約がほぼ未検査である。"
    evidence: "radius 115、rho²=9919、40021は正しく独立計算されるが、seedはindex 0のderivation hashだけで、8件のlittle-endian uint32 state、順序、重複、all-zero、prefix mutationを検査しない。protocol fixtureはrank/shape loss、criterion、seed list、failure codes、candidate path/hash/id rule、holdout basename等を欠き、validatorもrendererの一部と数値数個しか確認しない。完全version、隣接binary64、固定array交換、未知property、sibling hash mutationの欠陥を見逃す。"
    required_change: "TC-PROTOCOL-002..005の完全positive literalを使用し、8 seedのhashとstateを独立再生成する。ProtocolV1全階層に対するrequired/unknown/wrong-type/null、全literal/order/version/reference mutationを実行する。"
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:103
    problem: "holdout helperとテストが、設計された耐久性・排他性・漏洩防止・crash境界を実装または検査していない。"
    evidence: "openHoldoutFixtureOnceは入力hashとhuman gateを検証せず、flushやsame-directory atomic renameなしでrun/reportを直接上書きし、holdout reader境界、JCS report hash、24明細も持たない。テストは同一processの二回目だけで、2 child process同時open、wx勝者一件、各crash point、markerとsealed/opening/openedの組合せ、再起動後reader 0回、trainingへのholdout混入を検査しない。"
    required_change: "TC-HOLDOUT-001..003の順序を観測できるspyと隔離temp directoryで実装し、事前hash/gate検証、exclusive-create+flush、atomic rename、reader呼出し位置、report/opened永続化、二重open、別process競合、全crash状態を検査する。"
  - id: R-006
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:29
    problem: "実artifact依存4件がすべて最初にcorpus.jsonだけを要求するため、各artifactの欠落を個別に識別せず、成果物・著作物境界も実際には走査していない。"
    evidence: "requireRealBundleは常にcorpus.jsonから停止するので、現在のRedは4件とも同じcorpus欠落であり、split.json、protocol.json、SHA256SUMS、SOURCE-AUDIT.json固有の存在境界を示さない。またTC-CORPUS-001はローカルnames配列を検査するだけでdirectoryを列挙せず、余分なJSON、PDF、画像、mask、subdirectoryを許す。non-network性も検査されない。実行結果はtypecheck成功、13件成功、4件失敗だったが、4件すべて同一corpus欠落assertionだった。"
    required_change: "5成果物をそれぞれ最初の存在assertionとする独立testへ分け、calibration directoryを実走査して許可された4 basenameだけであることを確認する。SOURCE-AUDITはtask docs側で個別確認し、PDF・画像・mask・余分なfile/subdirectoryと通常testのnetwork利用を検出する。"
  - id: R-007
    severity: medium
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts:48
    problem: "duplicate-aware JSON parserがJSON文字列を正しく字句解析せず、重複keyの偽陰性と合法JSONの偽陽性を生む。"
    evidence: "key tokenのescapeをdecodeしないため、\"a\"と\"\\u0061\"のようにJSON上同じproperty名を重複として検出できない。一方、NaN/Infinityの正規表現を文字列全体へ先に適用するため、合法な文字列値\"Infinity\"までjson-syntaxとして拒否する。"
    required_change: "文字列escapeとUnicode escapeを復号し、object keyの文脈だけで重複を検出するJSON tokenizer/parserを使用する。文字列内のNaN/Infinityは許可し、tokenとして現れた非JSON数値だけをsyntax errorにする負例を追加する。"
conditions: []
rollback_to: test-code
summary: "型検査は成功し、rho²最小値9919、ring 690点、lattice cell数40021、seed 0 hashなど一部の独立数値確認は妥当だった。局所的なNode importの@ts-expect-errorも現状の型構成では対象を限定しており、無関係な型エラーを隠していない。しかし承認済みTESTCASESの完全schema、独立監査、annotation/extraction、split/loss、24実行、candidate/Pareto、8 seed、holdout永続性、成果物境界の大半を識別できず、実artifact schemaには非互換もあるためtest-code gateは不合格とする。"
```

```yaml
review_type: testcases
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:292a82adce22faa4fa486280ccf29c848afd3a4a768cad051142c392896ffd73
findings: []
conditions: []
rollback_to: none
summary: DECISIONS.md D-06で人間承認された3分割を反映し、43個のtestcase IDが3つの正確なtest filenameへ重複なく一度ずつ割り当てられている。schema/artifact、scoring/protocol、holdout-safetyの境界、順次fresh review、共有helper・production export禁止、schema-artifactsだけに置く5件の独立expected Red、他2ファイルのsynthetic Greenが明記されている。設計上のschema、literal、独立oracle、物理・数値式、集計順、許容差、holdout安全性は弱められていない。承認hash、mask hash、shape値、8 seed、境界半径およびloss代表値も独立再計算と一致した。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts
    hash: sha256:b9435cd8cb717d0681999066737f91d0994255b5a16547f1b86f1bc6e5b18d1e
findings:
  - id: R-001
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:59
    problem: CorpusV1、ObservationV1、source uncertainty、transcription の validator と正例 fixture が承認済み schema と互換でない。
    evidence: >-
      validateCorpusV1 は source metadata を root の arxivId 等として要求し、observation を
      {source,morphology,projectedShape} として受理するが、DESIGN.md §4 は root.source object と、
      sourceObservationId/sourceIdKind/locator/rawLabels/4 normalized values/sourceUncertainty/
      inProductDomain/exclusionReason/morphology/projectedShape/transcription を持つ flat ObservationV1 を定める。
      sourceUncertainty の内部と TranscriptionEvidenceV1 は検査されない。さらに正例は locator ordinal が
      全件1のまま P11-N001..N206 を生成し、annotationApprovals=[] でも成功するため、ID/locator連続性、
      全206承認被覆、検証順を検出できない。
    required_change: >-
      DESIGN.md §4、§6、§7どおりの完全な再帰 validator と整合した synthetic fixtureへ置き換え、
      source定数、sourceIdKind、page-local ID/ordinal/bounds、raw十進単位換算、uncertainty定数、
      domain派生値、transcription A/B/adjudication、承認被覆、canonical order、および
      TESTCASES.md TC-CORPUS-001..003・TC-SOURCE-001..004 の全 mutation/precedenceを実装する。
  - id: R-002
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:71
    problem: SourceAuditV1 の「完全 schema」検査が page record、approval、hash、独立照合をほぼ検査せず、正しい audit observation を拒否する。
    evidence: >-
      fixture の pages は [11,12,13,14] だが承認済み schema は
      {pdfPage,panelCount,sourceObservationIds} の4 recordである。approval fixture は
      {decision:"approved"} だけで、approverRole、4 hash、UTC、noteを欠くが成功する。
      observations は source() に渡され、SourceAuditObservationV1 に存在しない sourceUncertainty を
      必須にする一方、page合計/ID集合/order、sourceEntrySet、pre-annotation assignment、
      canonical corpus、payload、approval参照、corpusとの全field join、非循環/stale依存を検査しない。
    required_change: >-
      DESIGN.md §6.1 と TESTCASES.md TC-SOURCE-AUDIT-001..003 の完全な page/observation/approval schema、
      exact order/count/reference、4 hash独立再計算、production corpusとのsource-only全field照合、
      freeze順・非循環・stale mutationを実装し、全required/unknown/type/null/order/value/hash/
      approval negativeを個別に通す。
  - id: R-003
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:67
    problem: morphology annotation と projected-shape の schema、承認規則、独立数値oracleが実装されていない。
    evidence: >-
      morphology validator は schema外の reviewMode を observation内へ要求し、許可される
      growthAxis="indeterminate" を拒否する。A/B一致、confidence、batch/individual、final、note、
      approval object/approvalIdのJCS再計算、全206重複なし被覆を検査しない。projectedShape は
      DESIGN.md の extractionA/extractionB、3 interval、auditStatus、adjudicationNote、
      extractionProtocolIdではなく evidenceA/evidenceB/rawFeatureIntervals を要求する。
      TC-SHAPE testは2x2のA/P/centroidだけを再計算し、11x11 SYN-EA/SYN-EBのcovariance、
      eigenvalues、6 endpoint順、arm CV、minor/major比、A/B interval、status/null/reason/audit
      mutationを検査していない。
    required_change: >-
      TESTCASES.md TC-ANNOTATION-001..003 と TC-SHAPE-001..003 の承認済み literal fixtureをそのまま
      具体化し、approval hashと全206被覆、uint32-LE mask、両mask hash、A/P/centroid/covariance/
      eigenvalues/endpoints、3 raw feature、64*EPSILON tolerance、厳密interval端点、
      usable/null/reason/audit整合と全negative境界を独立再計算する。
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:76
    problem: SplitV1 validator は complete schema、冗長参照、canonical order、assignment hashを検証しない。
    evidence: >-
      strata と reportOnly の内部を検査せず、groupもgroupKey由来の2 hashとgroupSha256重複だけを検査する。
      splitAssignmentSha256 は任意の d×64で成功し、sourceObservationIdSetSha256、partition/stratum/bin、
      train/holdout/report-only相互参照、ID全被覆、固定order/count、null/type/enums、annotation不変性、
      dangling/duplicate/cross-partition mutationが未検査である。
    required_change: >-
      TC-SPLIT-003 の全literal recordを完全検証し、TC-SPLIT-004で全階層のrequired/unknown/wrong-type/
      null/literal/order/reference/hash mutation、assignment JCS hash、group/ID hash、
      冗長配列相互一致と自己整合hashによる迂回拒否を実装する。
  - id: R-005
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:79
    problem: ProtocolV1 fixture と validator が承認済み ProtocolV1 ではなく、正しい protocol.json を拒否して不完全なobjectを受理する。
    evidence: >-
      rasterization は protocolId/sourcePdfSha256を欠き、losses は承認済み nested rank/shape contractの代わりに
      rankLossDefinition/shapeLossDefinitionを使う。simulation は checkpointCriterion、
      seedDerivationPrefix、8 literal seeds、failureCodesを欠き、schema外seedDerivationVersionを持つ。
      candidate contractはpath/hash/id ruleを、holdout contractは3 basenameを欠くが正例として成功する。
      validatorもこれらの完全schema、8 seedのindex/hash/state、uint32/all-zero/order、全literal配列、
      sibling reference/hash mutationを検査しない。
    required_change: >-
      TESTCASES.md TC-PROTOCOL-003 の完全literal objectへ置き換え、TC-PROTOCOL-004..005で全階層の
      required/unknown/type/null/version/order/reference/hash、固定renderer/runtime/raster値、
      rank/shape契約、8 seed、checkpoint/failure code、candidate/holdout contract、
      viewportScale bit一致とraster preparation boundaryを検査する。
  - id: R-006
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:89
    problem: TC-CORPUS、TC-SOURCE、TC-JCS の割当ケースがまとめられた少数の自己比較に縮退し、要求されたnegative分岐とerror契約を網羅しない。
    evidence: >-
      duplicate-aware parserのtestはescaped root keyだけでnested duplicateを検査せず、NaN/Infinityの
      JSON pointerも常に"/"である。I/O cause、sourceObservationId付きmessage、TC-CORPUS-003の
      複合mutation precedenceの大半、205/207・duplicate locator/bounds・ordinal gap、十進単位換算と
      product-domain境界がない。JCSもpretty/compact、LF/CRLF、property order、array/Unicode mutation、
      b=3の固定hash、3行ASCII順SHA256SUMSとcanonical JSON再hashを検査していない。
    required_change: >-
      所有する各 testcase IDを独立に具体化し、TESTCASES.md記載の全mutation、例外class、
      JSON pointer/reason/sourceObservationId/cause、validation precedence、十進単位oracle、
      RFC8785固定vectorおよび完全SHA256SUMS grammar/canonical rehashを検査する。
  - id: R-007
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:100
    problem: REAL206 integration と著作権・非ネットワーク境界は、5件の存在Red以外が不完全である。
    evidence: >-
      実行結果は8 synthetic test Green、5件の意図したmissing-artifact Red、TC-REAL-001 skipであり、
      5件の独立Red自体は成立した。しかし成果物存在後のTC-REAL-001はcorpusIdと2つのhash参照しか比較せず、
      SHA256SUMSを読みもしない。206 source全fieldのSOURCE-AUDIT join、page/ID完全性、
      annotation approval、projected evidence、split全ID、protocol完全literal、3 canonical JSON hash、
      source-audit hash参照を検査しない。global fetchのthrowing stub、HTTP/DNS/browser非使用、
      base64/data URL・mask binary拒否もない。
    required_change: >-
      5つの独立存在assertionを維持したまま、全成果物存在後にTC-REAL-001の全acceptanceを実行し、
      exact basename/content境界、3行SHA256SUMS、全相互hash/source照合、206承認・shape完全性と
      throwing fetchによる非ネットワーク境界を検査する。synthetic test名にはTESTCASES.md §1.2どおり
      syntheticを明示し、TC-RED-001以外の未割当IDを新設しない。
conditions: []
rollback_to: test-code
summary: >-
  D-06の3分割と5件の独立missing-artifact Redは機能し、typecheckも成功したが、schema-artifacts担当の
  5完全schema、annotation/projected-shape oracle、mutation網羅、REAL206相互照合の中心契約が未実装である。
  現状は承認済み成果物を拒否し、壊れたsynthetic成果物をGreenにするためtest-code gateを通過できない。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts
    hash: sha256:bf283db6d2aeac033ff1a613161dd3b44644c01b0e12cbd4544db84d0e262599
findings:
  - id: R-001
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:14
    problem: CorpusV1の完全性、出典転記規則、annotation approval被覆を壊したsynthetic corpusが正例として受理される。
    evidence: >-
      fixtureは206 IDをすべてP11-N001..N206として同一bounds [10,20,30,40]へ割り当て、
      annotationApprovalsを空配列にしているが、line 68のvalidateCorpusV1は成功する。
      validatorはIDとlocatorのpage/ordinal対応、page-local連番、locator/bounds一意性とcrop-box境界、
      raw labelの十進単位換算、transcription A/Bと最終source値の一致、全206 IDのapproval被覆、
      reviewMode適格性、approvalId/target/draft/final hash再計算を検査しない。
      empty approvals、重複bounds、同じproduction fixtureから生成した転記値がすべてGreenであり、
      TC-CORPUS-001..003、TC-SOURCE-001..004、TC-ANNOTATION-001..003を識別できない。
    required_change: >-
      206件の架空一括fixtureを正例にせず、承認済みTESTCASESの個別synthetic entry/approval literalを使う。
      CorpusV1の検証順に従ってpage-local ID/ordinal/bounds、raw変換、uncertainty/domain、
      transcription解決、annotation approvalのJCS hash・review mode・全206重複なし被覆を完全検証し、
      記載された各mutationとerror precedenceを実行する。
  - id: R-002
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:43
    problem: SourceAuditV1の独立性、全field照合、4 hash、freeze順および非循環契約が未検証である。
    evidence: >-
      audit fixtureはproduction側source()からauditRowsを生成しており独立oracleではない。
      validatorが再計算するのはsourceEntrySetSha256だけで、preAnnotationSplitAssignmentSha256、
      canonicalCorpusSha256、auditPayloadSha256を再計算しない。page IDが宣言pageと一致すること、
      locator/raw/normalized値をcorpusと全field joinすること、split/protocolのsourceAudit参照、
      annotation前assignment freeze、stale伝播、hash dependency graphの非循環性も検査しない。
      206件を全てpage 11に置いたfixtureも正例として成功する。
    required_change: >-
      TC-SOURCE-AUDIT-001..003どおり、REAL206_AUDITだけを原PDF由来の独立値として扱う。
      page/ID/order/reference、production corpusとのsource-only全field join、4 hashの独立再計算、
      approval参照、split/protocol参照、freeze/stale mutationおよび非循環DFSを実装する。
  - id: R-003
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:36
    problem: annotationとprojected-shapeの数値oracleがvalidatorへ接続されず、承認済みshape契約を判定できない。
    evidence: >-
      morphologyはdraftStatus以外のbatch/individual規則、confidence制限、final/note規則を検査しない。
      shapeValuesで4/pi、CV、固有値を計算しているだけで、その値をevidenceまたはprojected validatorへ
      入れていない。evidenceはuint32上限、pixel-center、raster境界、endpoint角順・重複、
      covarianceと固有値の整合、raw 3 featureの再計算を行わず、projectedもA/B raw値からintervalを
      再計算しない。さらにauditStatusをA/B evidence object全体の完全一致で決めるため、
      TC-SHAPE-003の「status/reasonは合意しraw evidenceは独立に異なる」正例と非互換である。
      独立再計算では4/pi=1.2732395447351628、SYN-EA eigenvalues=[0.25,0.25]、ratio=1を確認したが、
      現テストはこれらをschema検証へ結び付けていない。
    required_change: >-
      TC-ANNOTATION-001..003とTC-SHAPE-001..003の完全literal fixtureをvalidatorへ通し、
      approvalIdと被覆、mask byte契約、A/P/centroid/covariance/eigenvalues/endpoints、
      raw feature、64*EPSILON tolerance、A/B min/max interval、status/null/reason/auditの
      全positive/negative境界を独立再計算で検査する。
  - id: R-004
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:47
    problem: SplitV1 validatorが10 IDだけの不完全splitを正例として受理し、完全schemaと冗長参照を検証しない。
    evidence: >-
      split fixtureは9 train groupと1 report-only groupの計10 IDしか含まないがline 107で成功する。
      validatorはsplitAssignmentSha256を再計算せず、partitionの未知値、binから導くstratum、
      groupCount/holdoutCount、train/holdout配列とgroup recordの相互一致、canonical group順、
      reportOnly配列、全206 IDの一回被覆、corpus/audit参照を検査しない。
      sourceObservationIdSetSha256も配列のASCII sortを要求せず現在順をhashするだけである。
    required_change: >-
      TC-SPLIT-003の完全positive literalとTC-SPLIT-004の全required/unknown/type/null/literal/order/
      reference/hash mutationを実装し、assignment/group/ID hash、partition/bin/count、
      9 strataの冗長配列、report-only、全206 ID被覆を相互に厳密照合する。
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:51
    problem: ProtocolV1は完全literalとの自己比較に依存し、schema error契約、seed独立導出、参照hashおよびraster準備境界を検証しない。
    evidence: >-
      nested rank/shape/simulation/candidate/holdout objectをJCS文字列で一括比較するため、
      missing/unknown/wrong-type/null mutationが指定されたTypeErrorとJSON pointerではなく
      RangeError(literal-mismatch)になる。8 seedは保存したhash/stateとの自己比較だけで、
      prefixからSHA-256と4個のlittle-endian uint32を再導出しない。
      corpus/split/source-auditの実hash参照、logical mutation後のsibling hash mismatch、
      package/runtime version確認、既存raster evidenceの拒否もテストされない。
      独立確認したseed 7 hashは記載値と一致するが、現在のテスト経路はその計算を行わない。
    required_change: >-
      ProtocolV1の各nested objectを再帰的に完全検証し、TC-PROTOCOL-004の全mutationを指定class/
      pointer/reasonで検査する。8 seedをprefixから独立再生成し、固定array順・uint32・all-zero、
      sibling参照hash、renderer/canvas/Node完全versionとTC-PROTOCOL-005の準備境界を実行する。
  - id: R-006
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:1
    problem: ファイル全体の型検査が無効化され、割当testcaseのmutationとerror契約も少数の代表assertionへ縮退している。
    evidence: >-
      @ts-nocheckによりtypecheck成功はこのテストコードの型健全性を示さない。
      duplicate parserはescaped keyと合法な文字列Infinityを扱えるようになったが、
      nested duplicateやNaN/Infinity tokenの完全JSON pointer、1e400、I/O cause、
      sourceObservationId付きmessage、設計順の複合mutationを検査しない。
      JCS testもpretty/compact、LF/CRLF、array/Unicode mutation、3行ASCII順SHA256SUMS、
      schema検証後のcanonical rehashを実行していない。
    required_change: >-
      file-wide @ts-nocheckを除去して必要なNode importだけを限定的に扱い、
      TC-CORPUS-002..003、TC-SOURCE、TC-JCS-001..002に列挙された全mutation、例外class、
      JSON pointer/reason/sourceObservationId/cause、precedence、RFC 8785 vector、
      完全SHA256SUMS grammarとcanonical再hashを実装する。
  - id: R-007
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:120
    problem: 5件の独立expected Red以外のREAL206、著作物境界、非ネットワーク検証が未完成である。
    evidence: >-
      targeted実行は8 synthetic Green、5件の独立missing-artifact Red、TC-REAL-001 skipであり、
      5 pathが個別に失敗する点は改善済みである。しかしTC-REAL-001はSHA256SUMSを読まず、
      corpus全source fieldとSOURCE-AUDITのjoin、206 annotation approval、projected evidence、
      split全ID、protocol literal、3 JSONのJCS hash、source-audit参照を検査しない。
      global fetch throwing stub、HTTP/DNS/browser不使用、base64/data URLやmask binary拒否もない。
      またTESTCASESでは5 test case全体がTC-RED-001であるのに、未割当のTC-RED-002..005を新設している。
    required_change: >-
      5つの独立存在assertionを維持しつつ、名前を割当済みTC-RED-001の個別caseとして扱う。
      全成果物存在後にTC-REAL-001の完全acceptance、3行SHA256SUMSと全相互hash/source照合、
      206 approval/shape完全性、exact content境界、throwing fetchによる非ネットワーク境界を実行する。
conditions: []
rollback_to: test-code
summary: >-
  typecheckコマンドは終了コード0だったがfile-wide @ts-nocheckのため対象ファイルの型検証証拠にはならない。
  targeted Vitestは5成果物それぞれの意図したmissing-artifact Redを独立に示した一方、
  8 synthetic testだけがGreenで、完全schema、独立監査、annotation/shape数値oracle、
  splitの206件完全性、protocol mutation、REAL206相互照合の主要契約を依然として識別できない。
  prior R-007のescaped duplicate/string Infinityとprior R-006の独立5 Redは改善したが、
  prior R-001..R-006の中核required_changeは未完了である。
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts
    hash: sha256:610c01e5f75c10d3519b0415845edb4cfff0c121f78cd89a0b55a7d91ed24b4a
findings: []
conditions: []
rollback_to: none
summary: "承認済みTESTCASES hash 292a82adce22faa4fa486280ccf29c848afd3a4a768cad051142c392896ffd73 と D-03/D-06/D-07 に照らし、schema-artifacts が所有する全ケースを独立test-local実装で具体化している。Corpus/SourceAudit/Split/Protocolの再帰schema、required/unknown/type/null/literal/order/reference/hash mutation、duplicate-aware JSON、JCS、206承認被覆、projected-shape再計算、source-audit join/freeze、seed導出、raster境界、著作物・非ネットワーク・REAL206受入を確認した。@ts-nocheck、共有helper、production export/importはない。型検査は成功し、対象Vitestは2211 synthetic Green、意図した5件の独立missing-artifact Red、成果物完成前に限るREAL206 1件skipとなった。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts
    hash: sha256:f450e6e1f66dde0c35f2ec6bb41a3e4bce674835f9f55860fee87b0f767a5654
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:14
    problem: TC-SPLIT-001..002 do not implement the specified condition-group split oracle.
    evidence: The helper orders arbitrary group IDs and hashes JSON.stringify output instead of ordering each stratum by SHA-256(prefix plus JCS groupKey). The tests manually declare partitions, never exercise the n=1, n=2..9, and n=10 holdout-count boundaries or report-only handling, and do not use the required four-stratum contributions or verify the 7/16 macro-average. The claimed annotation invariance compares an object with itself and contains no annotation, confidence, or shape fields. Consequently group indivisibility, split allocation, canonical hash order, and annotation independence can all regress while the tests remain Green.
    required_change: Implement a test-local JCS-based split derivation for literal condition groups, covering all holdout-count boundaries, out-of-domain report-only groups, group indivisibility, unsigned hash order, the four specified strata and 7/16 result, plus genuine annotation-only and condition mutations.
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:60
    problem: TC-RANK-001..003 cover isolated arithmetic but not the required rank scoring hierarchy and failure boundaries.
    evidence: rankPairLoss receives two arrays and therefore cannot prove same-group exclusion or canonical cross-group enumeration. No fixture checks the three field/rank mappings, component and empty-stratum omission, all-empty null result, or candidate failure for null, NaN, Infinity, and unreached metrics when eligible pairs exist. TC-RANK-003 does not construct the required 24 records or the four-stratum contribution table and merely averages [0,0.5,1], so checkpoint/seed order, equal weighting, stratum order, and per-level Neumaier resets are not exercised together.
    required_change: Add literal group/component fixtures that calculate exact numerator and denominator fractions through group-pair, component, four-stratum, seed, and checkpoint levels; assert same-group exclusion, empty-level behavior, all metric failure modes, canonical evidence order, exactly 24 records, and independent Neumaier initialization at every level.
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:75
    problem: TC-CDF-002..003 omit required invalid-prediction behavior and most of the shape aggregation hierarchy.
    evidence: The mid-CDF literal values and interval distances are correct, but there are no assertions for null observations, empty training multisets, null/non-finite/unreached predictions against non-null intervals, feature ordering, or report-only minorMajorAxisRatio. shapeMacro stops at observation averaging; it does not exercise observation to condition-group to 2D stratum to nonempty-strata to seed to checkpoint aggregation or per-level Neumaier resets.
    required_change: Extend the independent CDF/shape oracle with the specified null, empty, non-finite, and failure mutations and a non-flattenable literal fixture spanning every aggregation level in canonical order.
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:88
    problem: TC-SCALE-001 is a self-comparison, and TC-SCALE-002 converts candidate failures into null loss.
    evidence: The invariance test clones identical Record24 objects; it contains no growth time, field of view, raw labels, raster dimensions, reported dimensions, rank/shape primitives, baseline, candidate order, or Pareto result. scaleLoss returns null for missing records, failed states, null, or non-finite metrics, whereas the contract requires the entire candidate to have status failed rather than receive a null score. Execution order and duplicate checkpoint/seed records are also not explicitly rejected.
    required_change: Build paired literal observation bundles differing only in all specified scale/time fields and compare the complete scoring evidence bit-for-bit. Represent and assert candidate failure distinctly from null loss, and reject missing, duplicate, reordered, non-finite, and each named failure record across the exact checkpoint-outer/seed-inner 24-record sequence.
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:99
    problem: TC-CANDIDATE-001, TC-BASELINE-001, and TC-ACCEPT-001 do not implement the required baseline and comparator oracles.
    evidence: The baseline test only counts two occurrences of rank 1, evaluates a constant arithmetic expression for the median, sorts already supplied fake hashes, and checks that an array has length 24. It never computes modal ties, midpoint medians, normalized nearest-condition distance, group hashes, holdout non-use, or replicated predictions. The acceptance test directly supplies the comparator instead of selecting it from the blind and nearest train tuples, and a STRATA length assertion does not verify canonical acceptance evidence. Candidate handling also uses the non-contract family literal production and cannot distinguish globally absent loss components from a candidate-specific unusable metric.
    required_change: Implement independent literal mode, even-median, normalized-distance, group-hash tie-break, 24-record baseline replication, candidate-specific failure, baseline comparator selection, and the complete Pareto matrix while preserving the nine-stratum evidence order and contract family literals.
  - id: R-006
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:114
    problem: TC-PROTOCOL-001..002 do not verify checkpoint semantics or fresh-process determinism.
    evidence: Independent recomputation confirms the eight seed hashes/states, ring count 690, minimum rho-squared 9919, and cell count 40021 are numerically correct. However the test only repeats deriveSeed twice in the same process despite claiming fresh-process coverage. It does not spawn a fresh process, compare condition/candidate/seed/checkpoint metrics and evidence bit-for-bit, enumerate the full lattice cell set, test first-state basalRadiusCells greater-than-or-equal checkpoint capture, or reject alternate/best checkpoints, physical-time selection, and step counts above 40021.
    required_change: Add an isolated child-process seed and deterministic-metrics oracle, independently enumerate the complete radius-115 lattice as well as its ring, and exercise checkpoint first-crossing plus all specified invalid checkpoint/time/max-step mutations.
conditions: []
rollback_to: test-code
summary: The file has no production/shared-helper imports, skips, or artifact assertions, and both TypeScript typecheck and the targeted Vitest run pass with 15 tests. Independent calculations confirm its seed and lattice constants, but most allocated test cases are only partial arithmetic assertions or self-comparisons and would not detect major split, scoring, baseline, scale, failure, checkpoint, or fresh-process regressions.
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts
    hash: sha256:6551d0a9a8d34e904568cb8fca8b62fe5abe2254d26d120fbe2be66c209bc192
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:25
    problem: "TC-SPLIT-001..002 の分割オラクルが承認済みの holdout 割当てと condition-group 不可分性を実装していない。"
    evidence: "DESIGN.md は split-order 昇順の先頭 holdoutCount group を holdout とするが、deriveSplit は末尾を holdout にする。n=9/10 fixture は i%5 により同一 condition key を重複生成しながら、それらを一つの group に統合せず別 group として数える。テストは件数と各 record が2 IDを持つことだけを確認するため、同一 condition が train/holdout を跨ぐ退行、先頭と末尾の逆転、unsigned hash 順の具体的な割当てを検出できない。4-stratum の 7/16 も split から得た contribution ではなく定数配列を直接平均している。"
    required_change: "相異なる literal condition group を用いて split-order hash と期待順を固定し、先頭 holdoutCount が holdout になること、同一 key の全 observation が一つの groupとして不可分であること、n=1/2/9/10、report-only、4-stratum contribution と7/16を導出結果から厳密検査する。"
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:39
    problem: "TC-RANK-001..003 は group別 prediction 差、厳密分数、全集計階層および階層ごとの Neumaier 再初期化を検査していない。"
    evidence: "rankLoss は component ごとに単一 prediction 数値を受け、その符号を全 group pair に流用するため、必要な sign(m(g_j,s,k)-m(g_i,s,k)) を計算できない。テストは +/0/- の結果が failed でないことしか確認せず、1/8、3/8、7/8、欠測1組の1/2、同一group除外、全欠測nullを拘束しない。RANK-002 は定数 [1/8,3/8,7/8] を直接平均し、観測fieldのenum順と予測metric写像を通らない。RANK-003 の24 recordには4-stratum contributionがなく、別個のadversarial和を置くだけなので group-pair→component→stratum→seed→checkpoint 各段の accumulator reset や順序違反を検出できない。"
    required_change: "groupごとの3 prediction metric とliteral観測rankから各group-pair分数を独立導出し、1/8・3/8・7/8・1/2・null・failureを厳密比較する。4-stratumを各24 recordへ保持し、全階層を通した非flattenable fixture、canonical順拒否、各段の新規Neumaier accumulatorを検査する。"
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:48
    problem: "TC-CDF-001..003 は empirical CDF の入力境界と shape loss の完全な階層をまだ拘束していない。"
    evidence: "cdf は samples[0] と末尾を最小・最大と仮定するため、同じmultisetの順序変更で誤答し得るが、テストはソート済み配列だけである。feature列は scored 2要素と report-only 1要素を分離せず、3要素を同列に置く自己一致になっている。CDF-003 は observation とその直後の平均だけを計算し、仕様の非flattenable 1/4対1/3 fixture、condition-group、2D stratum、9-stratum順、seed、checkpoint、各段のNeumaier resetを実行しない。holdoutでtrain CDFを維持することも検査していない。"
    required_change: "順序に依存しない重複保持CDFとtrain-only multisetを検査し、scoredFeatureIdsとreportOnlyFeatureIdsを分離する。非flattenable literalを observation→condition-group→2D stratum→nonempty strata→seed→checkpoint の全階層へ通し、canonical順と各段の再初期化を厳密比較する。"
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:51
    problem: "TC-SCALE-001..002 は完全な scale-marginalized scoring 証跡と step 上限境界を検査していない。"
    evidence: "SCALE-001 は異なるtime/FOV/raster/labelをobjectへ格納するが、scoreRunsには同一runsだけを渡すため、それらのfieldがscoringへ混入しても検出する統合オラクルになっていない。24 primitive、rank/shape全階層、candidate order、baseline、Pareto、証跡bytesの比較もない。SCALE-002 は欠落・逆順・重複・非有限・4 failure codeを拒否する点は改善したが、Runにstepがなく、成功stateのstep 40021超過を検出できない。またrankとshapeの一方が全candidate共通で不存在となる正当なnull成分とcandidate固有の欠損を区別できない。"
    required_change: "time/FOV/raw labels/raster/report-only dimensionだけが異なる二つの完全bundleを同一の独立scoring経路へ通し、24 primitiveから最終Pareto証跡までbit一致させる。各recordへstepを持たせ、40021超過をfailureにし、全体不存在のloss成分とcandidate固有のunusable値を区別する。"
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:53
    problem: "TC-CANDIDATE-001、TC-BASELINE-001、TC-ACCEPT-001 は承認済みfamily literal、baseline導出、comparator選択、null規則を実装していない。"
    evidence: "Candidate family は上位DESIGNの allowedFamilies にある piecewise-bilinear-map-v1 ではなく production を使用する。candidate固有のnullはstatus:'failed'をfixture側で予告しており、他candidateにその成分のusable evidenceがある場合をオラクル自身が判定しない。nearestは正規化距離を計算せず既成のfake hashをsortするだけで、mode同数tie、holdout label非参照、全24 recordへの同値・順序つき複製も未検査である。acceptanceはblind/nearest train tupleからcomparatorを選ばず直接 [.5,.25] を渡し、9-stratum evidenceも配列長しか確認しない。"
    required_change: "familyを承認済みliteralへ合わせ、execution orderとtrain selection keyを別々に検査する。mode tie、midpoint median、正規化nearest距離と実group hash tie-break、holdout非参照、順序つき24複製を独立導出し、blind/nearestからcomparatorを選択して完全Pareto matrixと9-stratum証跡を検査する。global-null成分とcandidate固有nullはfixture入力から自動判定する。"
  - id: R-006
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:59
    problem: "TC-PROTOCOL-001..002 の checkpoint と fresh-process 決定性検査が不完全である。"
    evidence: "完全lattice 40021、ring 690、rho2最小9919、および8 seed hashは独立再計算と一致した。しかしstateU32Leはseed 0しかliteral比較せず、残り7 seedの4 wordとall-zero境界を拘束しない。checkpoint fixtureは最小例だけで、初回crossing以前の状態列、alternate/best選択拒否、全10/20/40境界を十分に識別しない。child processはseed 0 hashと固定JSONを出力するだけで、同一process 2回の実行も、同じcondition/candidate/seed/checkpointから算出したmetrics・完全evidenceも比較しないため、fresh-process決定性の実証になっていない。child内のcandidate literalも未承認の production である。"
    required_change: "8 seedすべてのhash、4個のlittle-endian uint32、非all-zeroをliteral比較する。10/20/40それぞれのfirst crossingとalternate/best/physical-time/max-step変異を検査し、同じ独立計算を同一processで2回かつfresh child processで1回実行して、condition・承認済みcandidate family・seed・checkpoint・metrics・canonical evidenceをbit-for-bit比較する。"
conditions: []
rollback_to: test-code
summary: "報告hashは再計算値と一致し、production/shared helper import、skip、artifact assertionはない。TypeScript typecheckと対象Vitestは成功し、1 file・14 testsがGreenだった。lattice/ring/rho2、8 seed hash、seed 0 state、mid-CDF代表値など一部の数値は独立再計算と一致する。しかし前回R-001〜R-006の中心要件であるsplit先頭割当て、group別rank差と完全階層、shape全階層、scale完全証跡、baseline/comparator導出、実質的なchild-process決定性が未解消であり、現在のGreenは承認済みTESTCASESを十分に拘束しない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts
    hash: sha256:3e7c09d8ff8e3890056cd8aa1a47d8a073097610d32cf2d0c61b1b4a72d6db06
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:30
    problem: "TC-SPLIT-001..002 の分割オラクルが、split-order の先頭を holdout にする承認済み規則と、4-stratum の導出証跡を実装していない。"
    evidence: "deriveSplit は train=ordered.slice(0,n-holdoutCount)、holdout=ordered.slice(n-holdoutCount) として末尾を holdout にする。テストも件数とソート済みであることしか確認せず、具体的にどのgroupがholdoutかを固定しない。bin境界 -30/-10/-3/0 も未検査で、7/16はsplit結果ではなく定数配列 [0,.5,.25,1] の直接平均である。したがって先頭・末尾の逆転、境界bin、group allocationの退行を検出できない。"
    required_change: "相異なるliteral condition groupのsplit-order hashと期待partitionを固定し、先頭holdoutCount groupがholdoutになること、n=1/2/9/10、全bin境界、同一condition groupの不可分性、report-only、4-stratum contributionと7/16を導出結果から厳密検査する。"
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:38
    problem: "TC-RANK-001..003 はgroup別prediction差、3 componentの写像、および全階層を通したrankオラクルを拘束していない。"
    evidence: "rankComponent はcomponentごとに単一prediction符号を受け、各groupのmetricから sign(m(g_j)-m(g_i)) を導出しない。1/8・3/8・7/8は確認するが、rankRecordの3 component結果を1/4・11/24へ導く検査はなく、24-record fixtureも既成のbyStratum定数を平均するだけでgroup-pair→component→stratum→seed→checkpointを通らない。canonical順拒否、全空null、各階層でのNeumaier再初期化も実質的に検査されない。"
    required_change: "groupごとのcompactness、tipDensity、aspectRatioとliteral観測rankから各差分を導出し、厳密分数、basal/integrated結果、欠測・failure・全空nullを検査する。各24 recordに4-stratumのgroup/component入力を保持し、全階層、canonical順拒否、階層ごとの独立Neumaier accumulatorを非flattenable fixtureで検査する。"
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:47
    problem: "TC-CDF-001..003 はtrain-only CDF、feature契約、shapeの完全な非flattenable階層を検査していない。"
    evidence: "CDF自体は未ソート重複multisetと代表値を正しく扱うが、holdout値を加えてもtrain CDFが不変であることは未検査である。shape fixtureは単一group・単一stratumの同一内容を24回複製し、feature IDを持たず、scored featureとreport-only featureの分離も文字列の自己比較だけである。shapeHierarchyはgroupをASCII sortし、9-stratum canonical入力順の違反を拒否せず、group・stratum・seed・checkpoint各段で異なる寄与を持つfixtureにもなっていない。"
    required_change: "holdout mutationに対するtrain-only CDF不変性を追加し、scoredFeatureIdsとreportOnlyFeatureIdsを構造的に分離する。複数group・複数2D stratum・8 seed・3 checkpointに異なる寄与を持つ非flattenable fixtureを全階層へ通し、9-stratum順と各段のNeumaier再初期化を厳密検査する。"
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:53
    problem: "TC-SCALE-001..002 は完全なpaired scoring経路とglobal-null対candidate固有failureの区別を実装していない。"
    evidence: "paired evidenceはtime/FOV/raw/raster/reportをobjectへ格納するが、scoreRunsには両側とも同じrunsだけを渡し、比較時にはそれらのfieldを除外する。そのため対象fieldがscoringへ混入する退行を検出できない。24 primitiveからrank/shape全階層、baseline、candidate selection、Pareto証跡へ至る一つの経路でもない。scoreRunsはrankとshapeの両方を常にfinite必須とするため、全candidate共通で不存在となる正当なnull成分とcandidate固有unusable値を表現できない。"
    required_change: "scale/timeだけが異なる二つの完全bundleを同一の独立scoring関数へ入力し、24 primitiveから最終canonical evidenceまでbit一致させる。global-null componentは比較keyから除外し、usable evidenceがある場合のcandidate固有nullだけをfailureにするfixtureを追加する。"
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:56
    problem: "TC-CANDIDATE-001、TC-BASELINE-001、TC-ACCEPT-001 はtrain selection、baseline導出、完全なacceptance証跡を実装していない。"
    evidence: "candidateOrderはfamilyによる実行順だけを実装し、train選択key (tagRankLoss,shapeLoss,knotCount,candidateId) を持たない。candidate固有nullはfixtureでstatus:'failed'を事前指定しており、他candidateのusable evidenceから自動判定しない。nearest testは実group keyからhashを導出せずfake hashを渡し、holdout label非参照も検査しない。24 baseline replicationは同じobjectを24個作って長さを確認するだけでcheckpoint-outer/seed-inner順を拘束しない。comparator選択とPareto表は代表値を確認するが、9-stratum証跡は配列長だけである。"
    required_change: "execution orderとtrain selectionを別々に実装し、global-nullとcandidate固有failureを入力から判定する。mode、even median、正規化距離、実group hash tie-break、holdout非参照、順序付き24 baseline予測をtrain fixtureから導出し、blind/nearest comparator選択、完全Pareto matrix、9-stratum canonical evidenceを検査する。"
  - id: R-006
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:62
    problem: "TC-PROTOCOL-001..002 の全checkpoint first-crossingとfresh-process完全決定性が未実装である。"
    evidence: "完全lattice 40021、ring 690、最小rho2 9919、および8 seedのhash・全4 little-endian wordは独立再計算と一致する。一方、checkpoint testは10だけのfirst crossingを確認し、20/40の初回crossingを検査しない。child processはseed hashを計算するがmetrics [.5,.25] とevidence配列は固定値を出力するだけで、condition/candidate/seed/checkpointから決定的に計算していない。同一processで同じ完全計算を2回行う検査もないため、定数を返す実装が通過する。"
    required_change: "10/20/40それぞれについて直前stateと初回crossingを検査し、alternate/best/physical-time/max-step mutationを明示的に拒否する。同一の独立計算を同一processで2回、fresh child processで1回実行し、condition、承認済みcandidate family、全seed、全checkpoint、計算metrics、完全canonical evidenceをbit-for-bit比較する。"
conditions: []
rollback_to: test-code
summary: "対象hashを再計算した。production/shared helper、skip、artifact依存はなく、型検査と対象Vitestは成功し11 testsがGreenだった。CDF代表値、lattice/ring/rho2、8 seedのhashとstateは独立確認値に一致する。しかしsplitはholdout方向が仕様と逆であり、rank/shape/scale/baseline/checkpoint/fresh-processの主要オラクルは依然として定数、自己比較、または途中階層の省略で迂回できるため承認できない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts
    hash: sha256:2e23b0e0716472dbdadc943cdc9c9171dc6cfc1711ebe721eecdd1a97fbe301b
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:468
    problem: "24実行からbaseline、候補選択、Paretoまでの統合経路が、独立した固定期待値ではなく同じcompleteScore関数との自己比較で検査されている。"
    evidence: >-
      scale検査はcompleteScore(bundle1)とcompleteScore(bundle2)のJSON一致、決定性検査は同じ関数の
      2回実行と、その関数自身をtoStringでchild processへ渡した結果の一致だけを要求する。
      selected、comparator、最終loss、outcomeのliteral期待値がなく、outcomeは
      accepted/rejectedのどちらでも成功する。返却証跡にもrank pairの整数N/M、primitive count、
      各階層の非空分母、seed hash/u32 stateがない。このため定数prediction、component省略、
      誤った集計を同じ関数が一貫して行っても通過できる。
    required_change: >-
      24 primitive、全rank/shape階層、2 baseline、production選択、comparator、9-stratum証跡、
      Pareto outcomeについてproduction経路と共有しないliteral期待値を固定し、各段の値・分母・順序を
      厳密比較する。child processにも全seed/checkpointから実計算した完全証跡を出させ、
      同一関数同士の一致だけを正しさのoracleにしない。
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:496
    problem: "condition-blindおよびnearest baselineがinverseCircularityの中央値を計算せず、tag用compactness rankをshape predictionとして流用している。"
    evidence: >-
      blindとnearestはarmLengthCvの中央値だけを保持し、line 550でinverseCircularity predictionに
      g.prediction.compactnessを使用する。completeBundleのtrainではinverseCircularity midpointは
      1.5と2.5が各4件なので中央値は2だが、basal rank 0と2の同数tieからcompactnessは0になる。
      現在の統合経路は正しいbaseline prediction 2ではなく0を採点する。nearestでも各groupの
      inverseCircularity midpoint 1.5または2.5の代わりにrank 0または2を使う。
    required_change: >-
      両baselineでscored featureごとにtrain midpoint medianを独立導出し、
      inverseCircularityとnormalizedArmLengthCvを対応するpredictionへ渡す。
      completeBundleのliteral medianと最終baseline lossを固定値で検査する。
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:199
    problem: "global-null componentを観測側のeligible evidenceではなく、全candidateの計算結果がnullかどうかから推定している。"
    evidence: >-
      globalTagNull/globalShapeNullはitems.every(candidate loss is null)で決まる。
      したがって観測側にeligible rank pairまたはusable shapeがあるのに全candidateが予測不能でnullを
      返す場合も、component全体が存在しないものとして比較keyから除外される。
      executionResultもglobal-null booleanを外部から直接受け取り、観測fixtureから導出しない。
      これはcandidate固有の失敗を有利な欠測へ変えないというDESIGN §11とTC-CANDIDATE-001に反する。
    required_change: >-
      global component availabilityを承認済み観測fixtureのeligible pair／usable featureから導出し、
      candidate出力とは独立させる。観測evidenceありで全candidate nullなら全てfailed、
      観測evidenceなしの場合だけcomparison keyから除外される反例を統合経路で検査する。
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:72
    problem: "rank/shapeの24実行検査は完全なfield写像、component階層、canonical group/observation証跡を拘束していない。"
    evidence: >-
      RankGroupは承認fieldではなく汎用number配列だけを持つため、
      basalBranchingLevelとgrowthAxisのenum順、indeterminate/null、hollowing除外を検査できない。
      24-recordのrankHierarchyはCOMPONENTS[0]だけで実行され、3 componentのmacro段階を24実行へ
      通していない。rankComponentとshapeHierarchyはgroupおよびobservationを内部sortするため、
      入力証跡のcanonical順違反を拒否せず隠す。pair numerator/denominatorや階層分母も保持しない。
    required_change: >-
      literal observation fieldから3 rankを独立写像し、3 componentすべてを非flattenableな
      4-stratum×8-seed×3-checkpoint fixtureへ通す。group key、observation ID、stratum、seed、
      checkpointの順序違反を拒否し、各pairの約分済みfraction、primitive count、各macro階層の
      非空分母とNeumaier結果を厳密比較する。
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:52
    problem: "split oracleは同一conditionの複数入力を一つのgroupへ導出する境界を検査せず、重複group keyをtrain/holdoutへ分割できる。"
    evidence: >-
      splitは既にgroup化済みの配列を受け取るだけで、同じkeyを持つ複数recordを統合も拒否もしない。
      現テストのduplicate fixtureも3 IDを一つのGroupへ事前格納しているためgroup化処理を通らない。
      同じkeyのGroupを2件渡すとn=2として先頭1件をholdout、残りをtrainにでき、
      同一condition group不可分性の退行を検出できない。
    required_change: >-
      時刻・写真IDだけが異なる同一conditionのraw observationからgroupを導出するliteral fixtureを追加し、
      全IDが一つのgroupとして同じpartitionへ入ることを検査する。既にgroup化済み入力を契約とするなら、
      duplicate groupKeyを割当て前に明示的に拒否するnegative fixtureを追加する。
  - id: R-006
    severity: medium
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:276
    problem: "synthetic fixtureを使う14件のテスト名に、TESTCASES §1.2が必須とするsynthetic表示がない。"
    evidence: >-
      ファイルコメントにはsyntheticとあるが、各describe/it名はTC IDと挙動だけで、
      実観測REAL206ではないことがテスト名から判別できない。
    required_change: "各synthetic testcaseの表示名へsyntheticを含め、実コーパスの検査と誤認されないようにする。"
conditions: []
rollback_to: test-code
summary: >-
  対象hashを再計算した。production/shared helper、artifact依存、skipはなく、
  TypeScript typecheckと対象Vitestは成功して14 testsがGreenだった。splitの先頭holdout、
  7/16、CDF代表値、lattice/ring/rho2、8 seed hash/u32、10/20/40 first crossingは改善されている。
  しかし統合scoreは自己比較中心で、baselineのinverseCircularity予測が仕様と異なり、
  global-null判定、完全rank/shape階層、同一condition group化も未拘束なため承認できない。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts
    hash: sha256:3c3d1f128802c43e36564e8e93ad011182e11c1ef9a7621780d0b70c90047873
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:691
    problem: The integrated oracle uses all three rank components as the candidate-selection and acceptance tag loss.
    evidence: DESIGN §10.1 assigns the first two components to the primary basal-rank-v1 used for T1-8 selection; the third belongs to the separately reported integrated-rank-v1. completeScore averages all three into tag, then uses tag at lines 743–753. The isolated 1/4 and 11/24 checks do not correct the integrated selection path.
    required_change: Preserve and assert both basal and integrated losses throughout all 24 records; use the basal loss for T1-8 selection and acceptance, with independently pinned expected results.
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:593
    problem: The integrated oracle reads holdout annotations before selecting a candidate.
    evidence: observationAvailability receives every observation, and line 739 scores every candidate on holdout before selection at line 743. Holdout-only eligible evidence can therefore affect the train comparison key. DESIGN §12 requires train-only candidate selection and a separately gated holdout evaluation.
    required_change: Derive training availability and scores solely from train observations, select the production candidate and comparator, then evaluate holdout in a separate stage. Assert that changing holdout annotations cannot change training selection.
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:429
    problem: The standalone 24-record rank and shape hierarchy fixtures place groups in incorrect two-dimensional strata.
    evidence: In the rank fixture, the groups under T0-S2 use temperature -5 and supersaturation 5, which belong to T1-S0. In the shape fixture at lines 474–485, every populated group's supersaturation is 5 and temperature is below -10, so they all belong to T0-S0 despite four distinct record IDs. Both hierarchy functions accept these assignments.
    required_change: Build nonflattenable rank and shape fixtures with group keys belonging to each recorded stratum, and reject mismatched stratum membership.
  - id: R-004
    severity: medium
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:823
    problem: The scale-invariance and fresh-process comparisons do not establish binary64 bit-for-bit equality.
    evidence: Lines 823 and 947–959 compare JSON.stringify output. JSON serialization maps -0 to 0 and nonfinite numbers to null, while TESTCASES §1.3 requires DataView comparison of binary64 bits. The separate bits assertion covers only one Neumaier example.
    required_change: Compare every numeric metric and loss in the paired and fresh-process evidence by its binary64 bits, alongside exact structural and ordering checks.
conditions: []
rollback_to: test-code
summary: Typecheck and targeted Vitest passed (14 tests). The reviewed hash matches the reported SHA-256. Independent calculations confirm the lattice count 40021, ring count 690, minimum rho-squared 9919, boundary 49.79708826829135, and the 1/4 basal versus 11/24 integrated rank distinction. The four findings leave the scoring/protocol gate unapproved.
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts
    hash: sha256:be4c8e1b0db5c1c5f5a476b13faf340f7eea5058424d84c495d337107203b256
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts:817
    problem: The gated holdout stage scores every candidate, including unselected production candidates.
    evidence: "withHoldout maps run(candidate, holdout) over all evaluated candidates, and line 1019 asserts holdout scores for all of them. DESIGN §12 specifies a one-time confirmatory holdout report for the selected production candidate and its fixed comparator. Scoring losing candidates exposes additional holdout results that can inform later choices."
    required_change: "After the gate, score only the selected production candidate and fixed comparator on holdout. Assert that unselected candidates have no holdout result, while the selected/comparator outcome and train-only selection remain pinned to independent expected values."
conditions: []
rollback_to: test-code
summary: "The reported hash matches. Typecheck and targeted Vitest pass (14 tests). The prior basal/integrated, train-only selection, 2D stratum, and recursive binary64 comparison findings are resolved; the remaining holdout scoring scope violates the one-time confirmatory protocol."
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts
    hash: sha256:907f10446bfb7b69bb514ff742e70f9145530a048721a935bcd6e3fdd2d343a7
findings: []
conditions: []
rollback_to: none
summary: "指定ハッシュを確認。承認ゲート後のholdout採点は選択済みproduction候補20、固定comparator nearestの順に各1回だけ行い、未選択候補のholdout結果を返さない。trainだけによる選択、literal期待値に基づくrejected判定、holdout注釈変更時のtrain不変性を確認した。既存の数値・順序・決定性検証も維持され、typecheckと対象Vitest 14件が成功した。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts
    hash: sha256:98c3536553b422a800e1c121b0e37a4c97d7df1c41a93d1f9537e93b32bef64d
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:29
    problem: The sealed fixture and validator do not implement the approved HoldoutRunRecordV1 contract.
    evidence: The fixture flattens input hashes instead of using inputs, uses selectedCandidateId "candidate-001" instead of a SHA-256 value, uses comparatorId instead of selectedComparatorId, omits sealedRecordSha256 and holdoutReportSha256:null, and uses humanGate fields and literals that differ from decision:"approved-for-one-time-open", approverRole:"human-approver", approvedAtUtc, and note. Consequently the test can pass for records the DESIGN rejects.
    required_change: Build and validate the exact sealed discriminated-union member, including exact required and unknown-property behavior, null rules, SHA-256 fields, selectedComparatorId, and the approved HumanHoldoutGateV1 names and literals.
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:36
    problem: TC-HOLDOUT-001 checks malformed hash syntax but not the required hash, reference, candidate, comparator, and human-gate equality relationships before the reader boundary.
    evidence: Replacing a hash with any different valid 64-character lowercase hexadecimal value passes validateSealed. inputBundleSha256, sealedRecordSha256, humanGateSha256, candidate selection, comparator selection, and referenced artifacts are never independently recomputed or compared. scoreTraining only rejects four specially named properties and does not exercise or spy on CDF, baseline, candidate selection, threshold, or tie-break; a training-labelled row carrying a known holdout source ID in ordinary annotation/shape fields is accepted.
    required_change: Use independent JCS/SHA-256 fixture calculations and valid-but-mismatching mutations for every required input, candidate, comparator, sealed-record, and gate relationship. Model train/holdout identity independently and prove every training-derived stage remains uncalled when any holdout ID, annotation, shape, or mixed partition enters the training API.
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:42
    problem: TC-HOLDOUT-002 does not verify the approved durable state records, intent contents, canonical report hash, or complete report contract.
    evidence: The intent marker contains only calibrationId/state rather than sealedRecordSha256, inputBundleSha256, and openedAtUtc. The opening record lacks openIntentSha256, openedAtUtc, and holdoutReportSha256:null; the opened record lacks acceptance. holdoutReportSha256 is calculated from raw JSON bytes rather than RFC 8785 JCS bytes. The report details are arbitrary index/loss objects, not checkpoint-by-seed candidate/comparator details, and the assertions check only length, one loss value, and one Pareto value. Only the accepted path is exercised. Event assertions do not verify every flush-before-rename edge or the persisted contents at each reader boundary.
    required_change: Persist and reopen exact intent, opening, report, and opened literals; independently verify their hashes and all fields. Assert the complete observable order for wx/write/flush, same-directory temp/write/flush/rename, reader, report persistence, and opened persistence, and exercise both accepted and rejected reports with all 24 structured details.
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:93
    problem: TC-HOLDOUT-003 does not test the required API-level two-process race or complete crash/restart and copied-directory boundaries.
    evidence: The children race a standalone openSync("wx") script instead of openHoldoutFixtureOnce; the loser prints a label rather than producing RangeError(holdout-already-opened-or-in-progress), and neither child performs the validated state protocol. The marker/state matrix uses structurally invalid opening/opened records. Crash tests do not assert the exact marker, opening record, report, and unchanged state left on disk, nor absence of rollback/deletion/reuse behavior. The copied-directory case only observes that an uncopied marker is absent and never checks record hashes or the human repository-evidence gate.
    required_change: Run the actual test-local opening protocol in two barrier-synchronized child processes and collect exit/result evidence proving one reader and one specified RangeError with zero loser reads. Use valid records for every marker/state combination, assert exact durable disk state after both crash points and after restart, verify no retry/rollback/deletion/same-calibration reuse path, and test the documented copied-directory procedural boundary without claiming cryptographic one-time enforcement.
conditions: []
rollback_to: test-code
summary: The reviewed hash matches the reported file, and both TypeScript typecheck and the targeted Vitest file pass with 6 tests. However, the tests validate a materially different holdout schema and omit the required JCS relationships, complete durable records, API-level child-process race, and crash/restart evidence, so TC-HOLDOUT-001..003 are not yet implemented as approved.
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts
    hash: sha256:7819d792435d2148aefc8a3326ca00d096a43a1021af1360dd5ef022b0a8512f
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:42
    problem: "opening/opened records are not validated as the complete HoldoutRunRecordV1 union or against their durable marker/report relationships."
    evidence: "assertState checks root key names, state, timestamp, hash syntax, null, and acceptance only. It does not revalidate schemaVersion, calibrationId, nested inputs, selectedComparatorId, humanGate, sealedRecordSha256, or their JCS relationships; nor does it compare openIntentSha256 with the persisted marker. The reopened opened record is likewise not validated against the persisted report hash inside the helper. No negative fixtures mutate these fields in opening/opened states."
    required_change: "Apply a complete exact validator to all three discriminated-union members, recompute every nested and JCS relationship from the persisted marker/report and referenced expected artifacts, and add valid-but-mismatching, missing, unknown, type, literal, and null mutations for opening and opened records."
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:45
    problem: "TC-HOLDOUT-001 neither proves external artifact/candidate/comparator equality nor models a usable train-only scoring boundary."
    evidence: "The mutations at line 49 leave dependent human-gate and sealed-record hashes stale, so rejection can occur solely through an outer self-hash mismatch. A fully self-consistent replacement of an input, evidence, selected candidate, or comparator is accepted because openOnce receives no independently expected artifact hashes or selected identities. scoreTraining rejects every annotation or shape, including legitimate train data, and the tests only exercise rejected inputs; they never prove that CDF, baseline, candidate selection, threshold, and tie-break run for train records while remaining uncalled for independently identified holdout content."
    required_change: "Pass independently fixed expected artifact hashes, selected candidate/comparator identities, and gate evidence into the opening oracle; mutate each value while recomputing dependent hashes to prove the underlying mismatch is detected before reader access. Model train and holdout identities independently, allow legitimate train annotations/shapes, and assert positive per-stage spies plus zero calls for every holdout-ID, holdout-annotation, holdout-shape, and mixed-partition case."
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:28
    problem: "The durable transition test does not independently pin the complete intent, opening, report, opened records, or the full persistence order."
    evidence: "Both accepted and rejected paths execute, but the test asserts only the 24-detail count/order, final report hash, three partial event inequalities, and marker existence. It does not compare all 24 candidate/comparator loss and Pareto records or aggregate candidate/comparator/loss/Pareto fields with an independent literal oracle. It also omits assertions for marker wx→write→flush, opening temp write→flush→rename, report write→flush→rename, report durability before opened creation, and the exact persisted marker/opening/opened contents. The helper-generated report is effectively checked against itself."
    required_change: "Define independent accepted and rejected literal expectations for the marker, opening record, all 24 ordered details, aggregate report, and opened record; compare every field and JCS hash after reopening. Assert the complete ordered event trace, including every write/flush/rename edge and report persistence before the opened transition."
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:56
    problem: "The two-child race still bypasses the actual complete test-local opening protocol and fabricates the required loser result."
    evidence: "Each child only reads the sealed file and races openSync('wx') on a minimal marker. The winner does not persist opening/report/opened records or invoke a reader; it merely prints reader:1. The catch block labels every exception as RangeError(holdout-already-opened-or-in-progress), regardless of its real type or message. In the actual openOnce implementation, existsSync followed by an unguarded openSync('wx') leaves a race window whose loser receives the Node EEXIST error rather than the mandated RangeError."
    required_change: "Make both barrier-synchronized children execute the same complete test-local openOnce protocol, including validation, marker conversion of EEXIST to the specified RangeError, durable state transitions, and observable reader spy. Collect genuine serialized success/error evidence and prove exactly one complete winner, one exact RangeError loser, and zero loser reader calls."
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:54
    problem: "The required marker/state matrix, exact crash evidence, same-calibration sealing, and copied-directory procedural boundary remain incomplete."
    evidence: "Crash tests cover marker+opening after two injection points but do not test marker with valid sealed and opened records, exact marker/opening/report bytes and hashes, or explicit absence of rollback/deletion/reuse paths. The copied-directory test copies only holdout-run.json, observes that the marker was not copied, and asserts that a hard-coded sentence contains 'human'; it does not validate record hashes or a repository-evidence/human-gate comparison and therefore establishes no procedural boundary."
    required_change: "Exercise valid marker+sealed, marker+opening, and marker+opened states with reader zero; pin exact on-disk contents after both crash points and after restart; prove no marker deletion, rollback, resume, or same-calibration reuse API exists. For a copied directory, verify the copied record/hash evidence and an explicit repository-evidence gate check while documenting that copying cannot be prevented cryptographically."
conditions: []
rollback_to: test-code
summary: "The reported SHA-256 matches. TypeScript typecheck and the targeted Vitest file both pass, with 7 tests Green. The sealed field names and basic accepted/rejected paths improved, but externally anchored hash equality, usable training spies, complete durable evidence, the actual child-process opening protocol, crash/state coverage, and the copied-directory boundary remain unverified."
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts
    hash: sha256:6d29040130ef90066edf86c4bdf64f5b923c1b0ef9bcc05a7990068588f04016
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:130
    problem: The opening protocol incorrectly requires the opening time to equal the earlier human approval time.
    evidence: validate compares record.openedAtUtc with expected.approvedAtUtc, and open writes approvedAtUtc into the marker. DESIGN.md defines approvedAtUtc and openedAtUtc as distinct events. A valid run opened after approval would be rejected.
    required_change: Supply an independently fixed opening timestamp, validate its UTC format and agreement between marker and record, and test a valid opening time later than approval.
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:135
    problem: An opened record can validate against a malformed or unrelated report when its report hash is recomputed.
    evidence: validate checks only report JCS hash and acceptance. It does not check the report schema, input hashes, selected candidate and comparator, 24 checkpoint-by-seed details, loss, or Pareto fields. The positive literal comparisons cover reports generated by this helper but do not reject a self-consistently replaced persisted report.
    required_change: Validate the persisted report contract and its external references before accepting an opened record; add a mutation that replaces report content and updates holdoutReportSha256 while preserving a matching acceptance.
  - id: R-003
    severity: medium
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:489
    problem: The crash tests do not verify rejection after an actual process restart.
    evidence: Both injected crash cases invoke protocol.open again in the same Vitest process. Only the successful race uses child processes, so the required restart boundary is untested.
    required_change: Reopen each crash residue from a fresh child process using the same protocol source and assert the exact RangeError, zero reader calls, and unchanged marker, run record, and report bytes.
conditions: []
rollback_to: test-code
summary: The reported SHA-256 matches. Typecheck and targeted Vitest pass with 13 tests. The test now covers externally anchored sealed inputs, independent accepted and rejected detail literals, full event traces, and a genuine two-child opening race, but the timestamp contract, opened-report validation, and crash restart evidence remain incomplete.
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts
    hash: sha256:c5b58a0fb3c0070fc142dcc59e48c565038caee565f6bf08d72724e8941f8d31
findings:
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts:160
    problem: The synthetic holdout report asserts an unsupported scalar loss and internally inconsistent aggregates.
    evidence: DESIGN.md §10 requires separate rank and shape losses, rank fractions, primitive counts, and nonempty denominators, without collapsing components into an arbitrary scalar. The report instead uses totalLoss and candidateTotalLoss/comparatorTotalLoss. In the accepted fixture, aggregate candidateTotalLoss is 0.13 although every one of its 24 detail totalLoss values is at least 0.14; comparatorTotalLoss is 0.33 although every detail is at least 0.34. The rejected fixture has the same inconsistency. The literal oracle and validator accept these reports.
    required_change: Replace scalar totals with the approved separate loss and evidence fields. Make the 24 literal details and aggregates mathematically consistent with the specified seed and checkpoint aggregation, and reject a report whose recomputed hash matches an inconsistent aggregate or Pareto decision.
conditions: []
rollback_to: test-code
summary: The reviewed hash matches. Typecheck and targeted Vitest pass with 14 tests. Earlier timestamp, report-reference, and fresh-process crash findings are resolved, but the report fixture still validates loss records that contradict the approved design.
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts
    hash: sha256:96de66062ec81703a18fd48fc42ccf0d943aa7f623100403a31ca9e5df632189
findings: []
conditions: []
rollback_to: none
summary: >-
  Typecheck and targeted Vitest pass with 14 tests. The reviewed hash and approved
  TESTCASES hash match. Unsupported scalar totals are removed. Independent
  calculations confirm accepted basal/integrated rank losses of 1/6 and 1/4,
  shape loss 3/8, rejected losses of 5/6, 3/4, and 3/4, and comparator losses
  of 1/2. Ordered checkpoint-by-seed details retain reduced rank fractions,
  primitive counts, and nonempty hierarchical denominators. The validator
  recomputes detail losses, aggregates, evidence, and integrated-rank Pareto
  decisions and rejects inconsistent reports despite recomputed hashes.
  Earlier schema, external-anchor, training-spy, durable-trace, timestamp,
  report-reference, complete child-process race, fresh-process crash-restart,
  and copied-directory procedural-boundary fixes remain intact.
```

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:38ce331f9e88d0bc39e7654c68192f6f0e88853777c21c9ad97bc9be1654a998
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:b762d2ea3b05791394acb048c42145e5ff0bc15079d574eccaea731c8b951d88
findings: []
conditions: []
rollback_to: none
summary: >-
  SPEC、DESIGN-OUTLINE、TASKS、DESIGN、TESTCASES、D-01からD-09、
  既存レビューと証跡を照合した。DESIGNのhashは直近の承認値と一致し、
  作業ツリー差分もない。DECISIONSの追加はD-06からD-09の76行だけである。
  D-03は独立A/B草案、exact/highのみのbatch承認、その他の原PDF個別確認、
  全206点の人間承認被覆と承認前利用禁止を維持している。
  D-06はテスト配置を3ファイルへ分割する工程判断であり、
  TESTCASESに単独所有権、順次fresh review、共有helper禁止、
  schema-artifactsだけに置く5件の独立expected Redが反映されている。
  D-07からD-09の高性能モデル例外は各指定テストファイルの実装担当に限定され、
  独立Reviewer、変更境界、既存ゲート、コミット方針を変更していない。
  判断日2026-09-29、2026-09-30、2026-10-01と人間決定済み状態に矛盾はなく、
  今回の工程判断に未解決の人間選択は残っていない。
  要求、物理、schema、受入基準、数値手法の変更はない。
  独立計算でもring数690、最小rho二乗9919、半径上限49.79708826829135、
  格子数40021、600/72、seed0 hash、代表rankとshape値を確認した。
  実コーパスの原資料監査と注釈の人間承認は実装工程で必要なままであり、
  この設計承認はそれらの完了を意味しない。
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts
    hash: sha256:610c01e5f75c10d3519b0415845edb4cfff0c121f78cd89a0b55a7d91ed24b4a
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts
    hash: sha256:907f10446bfb7b69bb514ff742e70f9145530a048721a935bcd6e3fdd2d343a7
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts
    hash: sha256:96de66062ec81703a18fd48fc42ccf0d943aa7f623100403a31ca9e5df632189
findings: []
conditions: []
rollback_to: none
summary: >-
  承認済みDESIGN、TESTCASES、D-06〜D-09および各ファイルの先行承認と照合し、
  3ファイルのSHA-256完全一致をレビュー前後に確認した。旧単一ファイルは存在せず、
  43ケースIDの所有権に重複はなく、共有helper・production importもない。
  型検査は成功。schema単独は2211件成功、5成果物それぞれの独立した期待assertion Red、
  成果物完成前に限るREAL206の許可済み1件skipとなった。scoringとholdoutの同時実行は
  28件すべて成功。3ファイル同時実行も2239件成功、同じ期待Red5件、REAL206 skip1件だけで、
  ファイル間の干渉はない。trainだけによる候補・comparator選択、承認後の選択済み候補と
  comparatorだけのholdout採点、basalとintegratedの段階別rank境界、永続marker、
  排他競合、crash後の別process再開拒否を確認した。格子40021セル、ring690点、
  最小rho²9919、8 seed、およびholdoutのrank・shape代表値を独立再計算した。
  本承認は実装前の統合test-code gateに対するものであり、実コーパス完成を意味しない。
```

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:db91dbcb45221a9da3ff4316f78c7432ae0a1f322dcbd2bbb8d7f8808ac90610
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:c76eee8fcb6dd0f04761da080d7bcd5ad267fead87e79d8d4bc5fb340d0a4dd6
findings: []
conditions: []
rollback_to: none
summary: >-
  直前のR-001は解消された。A/B候補集合、比較集合、移行済みID集合について、
  wrapper、収録field、固定tuple幅、field順、ASCII ID順、JCS UTF-8前像が一意に定義されている。
  U+03BC/U+00B5の限定正規化は、原文字列を保持したA/B集合hashの計算後、
  comparison/proposed生成時かつcomparison hash計算前にだけ適用され、他の文字差へ拡張されない。
  固定証跡から独立再計算したA/B集合hashは
  de2d1e32eed414f020c1be76fc82b2209848da2b399aa1f00c96ecb55638f732 と
  b641538a2344cb348e62532cb6e48aaf3b9b5cf236fd703a51a7f1b3d9cdcfd3、
  comparison hashは33c545adebfae122fea0d84985445f60eeb7f17ed1e0e9ba2cb99d7a34b6bad9、
  32件の移行ID集合hashは92e23ab4ae1ea2b1406296a11e94ab519a1c020fb2a54559acf4b4bf0fbc6ea5
  となり、206件ずつの共通ID、618 exact field、206 canonical-unit-equivalent fieldを再現できた。
  固定PDFの12,317,042 bytesとSHA-256、LocalStorage backupのSHA-256、
  33 entry中32件complete/confirmed、未完了P11-N033、および32件のA/B値との一致も独立確認した。
  既存32件をbyte-for-byte保持して候補で上書きしない移行、残りを含む全206 panel・4 fieldの
  人間による能動確認、disagreementのdefault禁止と理由記録、第三blank転記ではない独立性限界が
  明記されている。旧design/testcase/test-code/Red/implementation証跡をstaleとし、
  修正版design承認後に順次再ゲートする規則も維持されている。
```

```yaml
review_type: testcases
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:31087002d9b47b0e5bdcb0be69bb3d62c9aab6d4be664b250523985d788d2b2b
findings: []
conditions: []
rollback_to: none
summary: >-
  対象hashは指定値と一致した。確認workflowでは候補表示、32件移行、確認・訂正、
  途中保存、824 field完成後のexportまでproduction corpus accessorをthrowing spyで厳密に0回とし、
  export後の全件照合は別関数・別fixture・別spyでreaderを1回だけ許すため、原資料oracle作成と
  事後corpus照合が分離されている。U+03BC同士のexact候補をA/B preimageへ原code pointのまま保持しつつ、
  proposed/finalだけU+00B5へ正規化する正例が追加され、U+03BC/U+00B5差も候補原文を保持する。
  非FOV、末尾空白、unit suffix以外のmuはdifferentかつproposed=nullとなり、finalのcode point mutationも
  拒否される。rationaleには正例とemail・account・端末識別子・schema外PII propertyのmutationがあり、
  自由文中の全PIIを自動検出できるとは主張せず、残余をhuman source-auditorの承認境界に置いている。
  独立再計算でA/B各206件、824 field、exact 618、canonical-unit-equivalent 206、different 0、
  A/B/comparison hashがde2d1e32eed414f020c1be76fc82b2209848da2b399aa1f00c96ecb55638f732、
  b641538a2344cb348e62532cb6e48aaf3b9b5cf236fd703a51a7f1b3d9cdcfd3、
  33c545adebfae122fea0d84985445f60eeb7f17ed1e0e9ba2cb99d7a34b6bad9と一致した。
  backupも固定hash、33 entry、32 complete、未完了P11-N033、移行ID集合hash
  92e23ab4ae1ea2b1406296a11e94ab519a1c020fb2a54559acf4b4bf0fbc6ea5を再現し、
  32件すべてでnormalizedはA/B双方、rawは少なくとも一方と一致した。
  非影響契約も45 testcase IDに重複がなく、ring 690、最小rho² 9919、格子40021、
  8 seed、形状代表値を再計算して維持を確認した。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts
    hash: sha256:e45b1e41af76e799f283a1fe8b328ed5648f4a97a82e9c59720e50a29d5940a2
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:344
    problem: A/B候補とcomparisonの既知hashが実際の206件の転記証跡から再計算されず、宣言値をそのまま信用している。
    evidence: >-
      candidateDraftRuleは任意の64桁hashを受理し、validateSourceAuditV1もcorpusの
      transcriptionからA/B固定tupleとcomparisonを再構築しない。TC-SOURCE-AUDIT-002は
      CANDIDATE_A/B/COMPARISON定数を同じliteralと比較するだけで、comparisonPreimageは
      1件を渡して206件でないことによる失敗しか確認していない。このため、corpus側のA/B転記を
      自己整合的に変更しても、既知3 hashを据え置いた成果物がREAL206を通過できる。
    required_change: >-
      corpus transcriptionから206件のA/B固定幅tupleを独立再構築し、field名・順序・tuple幅・
      ASCII ID順・locator・raw code pointを検証したうえで3 hashを再計算して既知値へ一致させる。
      exact 618、canonical-unit-equivalent 206、different 0も数え、各構成要素のmutationが
      対応hashまたは比較検査で失敗することを追加する。
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:720
    problem: LocalStorage backupの32件を無改変移行するoracleが実装されていない。
    evidence: >-
      テストはmanifestの件数と移行ID集合hashを確認し、1件のsynthetic rawだけを変更して
      unit mismatchを起こしている。backup schema、33件中32件complete、P11-N033除外、
      A/Bとの事前一致、raw UTF-8/code-unit一致、normalized binary64 bit一致、
      copy前後tuple、失敗時の保存状態不変を検査しない。rawとnormalizedを同時に
      自己整合的な別値へ変更したpreserved-prior-human-confirmationもauditEntryを通過する。
    required_change: >-
      承認済みTESTCASESのmigratePriorCaptureForOracle相当をtest-localに実装し、
      SYN-MIGRATIONでcopy前後のraw bytes/code unitsとDataView binary64 bitsを比較する。
      全拒否条件、候補による上書き禁止、P11-N033非移行、失敗前後の状態不変をmutationで証明する。
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:376
    problem: 人間確認workflowが集計値だけの模型で、確認bias緩和策とproduction corpus経路分離を検証できない。
    evidence: >-
      workflowStateはA/Bのreadyと2 hashしか見ず、各206件、comparison hash freeze、
      backup移行、PDF表示順、panel別・field別の明示操作を扱わない。exportThenCompareは
      confirmedFields=824という整数だけでexportを許すため、実際には一つもpanelを表示・確認しなくても通る。
      さらに同じreader spyをexport時に直接呼び、TESTCASESが要求する別関数・別fixture・別spyによる
      export後照合と、確認からexport完了までの厳密な0回を分離していない。
    required_change: >-
      A/B各206件とcomparison freeze、sourcePanelVisibleAt<=candidateVisibleAt、
      206 panel×4 fieldの個別操作、既存32件の移行、途中保存、824件完成後exportまでを持つ
      状態fixtureを実装する。確認経路のproduction readerはexport完了まで0回とし、
      verifyExportedAuditAgainstCorpusを別状態・別spyで1回だけ呼ぶテストへ分離する。
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:341
    problem: candidateComparison、humanAction、最終値、rationaleの相互契約が不完全である。
    evidence: >-
      auditEntryはdifferent+confirmed-proposalなど一部だけを拒否し、exactでの
      resolved-disagreement、differentでのcorrected-proposal、任意IDでの
      preserved-prior-human-confirmation、proposalと同値のcorrected-proposal、
      proposalと異なるconfirmed-proposalを受理する。canonical proposal/finalのU+00B5も拘束しない。
      PII検査の/@/と単語account/deviceだけでは、指定されたaccountId=、user_id:、
      deviceName=、hostname=、machine_id:などを検出できない。
    required_change: >-
      再構築したcomparison/proposedおよび移行backup tupleへ各fieldを結合し、
      TESTCASESのaction表を完全に検証する。U+03BC/U+00B5の正例・限定負例、
      final code-point mutation、空白rationale、指定されたemail/account/device label、
      schema外PII propertyを個別mutationで拒否する。
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:491
    problem: freeze順とstale依存graphが再設計前のままで、候補・comparison・migration変更の無効化を検査しない。
    evidence: >-
      FREEZE_ORDERにはA/B個別hash、comparison freeze、backup検証・32件移行、
      全206 panelの人間確認が表現されていない。HASH_GRAPHにもcandidate A/B、
      comparison、migration backup、migrated ID setのnodeがなく、これらを変更しても
      approval、review、Red/Green、calibrationがstaleになることをテストしていない。
    required_change: >-
      承認済みDESIGNとTESTCASESの作成順・有向依存へfixtureとgraphを更新し、
      A/B候補、comparison、backup、移行ID集合、人間確定sourceの各mutationから
      必要な全下流証跡がstaleになること、および循環がないことを検証する。
conditions: []
rollback_to: test-code
summary: >-
  対象hashは指定値と一致した。TypeScript型検査は成功し、対象Vitestは2339件Green、
  5成果物それぞれのmissing-artifact assertion Red、成果物存在だけを条件とするREAL206の
  1件skipとして実行された。独立再計算ではA/B各206件、exact 618、
  canonical-unit-equivalent 206、既知3 hash、backupの33件中32件complete、
  P11-N033未完了、移行ID集合hashを再現した。しかし現在のテストは、それらを成果物の実内容や
  workflow状態から再構築せず、宣言定数・集計値・部分的mutationで自己充足しているため、
  承認済みSOURCE-AUDIT契約を保護できない。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts
    hash: sha256:76c4d7d00b9620b26fec9e8a462b17a7457f4cbd82419a3048a17c58844911fa
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:724
    problem: 206件のA/B・comparison再構築経路は追加されたが、成果物不在時にも実行されるmutation感度テストがない。
    evidence: >-
      verifyFrozenCandidatesはcorpus transcriptionからA/Bとcomparisonを再構築し、既知3 hashおよび
      exact=618、canonical-unit-equivalent=206、different=0を検査する。しかしこの経路を呼ぶのは
      成果物存在時だけのTC-REAL-001であり、現在はskipされる。通常実行されるTC-SOURCE-AUDIT-002は
      1行fixtureをcomparisonPreimageへ渡して件数エラーにするだけで、206件のID順、locator、
      field順、tuple幅、raw code point、role、各構成要素のmutationに対するhash感度を実行していない。
    required_change: >-
      test-localの206件fixtureまたは凍結候補証跡から全再構築経路を成果物不在でも実行し、既知3 hashと
      618/206/0を確認する。ID順、locator、field順、tuple幅、role、各raw/normalized code pointを
      個別mutationし、対応hashまたはcomparison検査が失敗することを追加する。
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:387
    problem: LocalStorage backup移行oracleとmutationテストが承認済み契約を満たさず、失敗時atomicityの検査も自己充足している。
    evidence: >-
      migratePriorCaptureForOracleはbackup raw bytesの固定SHA-256、version、roleを受け取らず検査できない。
      locator、copy前後のUTF-8/code-unit列、DataView binary64 bits、移行後verification/actionも比較しない。
      さらにline 745の全mutationは、成功済み32件を保持した同じstateへ再移行するため、先頭IDの
      migration-conflictだけで必ず失敗し、個々のconfirmed、mu code point、-0、P11-N033、
      unknown property条件や失敗途中のatomicityを実際には到達・検査していない。
    required_change: >-
      固定backup hash・version・role・33/32/P11-N033を検証し、空の独立stateごとに各mutationを実行する。
      copy前後の4 rawをUTF-8 bytesとcode-unit列、4 normalizedをObject.isとDataView bitsで比較し、
      locator、候補による上書き禁止、preserved-prior-human-confirmation、失敗前後state不変を
      それぞれ到達可能なテストで証明する。
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:392
    problem: 人間確認workflowが集計値だけで、206 panel×4 fieldの能動確認とproduction corpus隔離を検査していない。
    evidence: >-
      workflowStateはA/B readyと2 hashだけを扱い、各206件、comparison hash、backup移行、
      sourcePanelVisibleAt<=candidateVisibleAt、panel/field別操作、途中保存を持たない。
      exportThenCompareはconfirmedFields=824という整数だけで完了扱いにし、export処理内で同じreaderを
      直接1回呼ぶ。承認済みTESTCASESが要求する確認開始からexport完了まで0回、およびexport後の
      別fixture・別spyによるverifyExportedAuditAgainstCorpusの1回を分離していない。
    required_change: >-
      A/B各206件とcomparison freeze、32件移行、206 panel×4 fieldの個別イベント、
      PDF/候補表示時刻、途中保存、824件完成後exportを表す状態fixtureへ置き換える。
      確認・export完了まではproduction readerを0回とし、事後照合を別関数・別状態・別spyで
      1回だけ呼ぶテストとして分離する。
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:341
    problem: candidateComparison、proposal、final pair、humanAction、rationaleのaction表が結合されていない。
    evidence: >-
      auditEntryは再構築済みcomparison/proposedやbackup tupleを入力に持たないため、
      exactでのresolved-disagreement、differentでのcorrected-proposal、任意IDでの
      preserved-prior-human-confirmation、proposalと同値のcorrected-proposal、
      proposalと異なるconfirmed-proposalを受理できる。canonical final rawのU+00B5も拘束しない。
      PII検査は@または単語account/deviceだけで、accountId=、user_id:、deviceName=、
      hostname=、machine_id:等の必須負例を検出しない。
    required_change: >-
      各fieldを再構築済みcomparison/proposedまたは移行backup pairへ結合し、TESTCASESのaction表を
      全分岐で検証する。confirmed/corrected/resolved/preservedのfinal pair条件、
      canonical U+00B5、空白rationale、指定email/account/device label、
      schema外PII propertyの個別mutationを追加する。
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:507
    problem: freeze順とstale依存graphが再設計後の候補・comparison・migration工程を表現していない。
    evidence: >-
      FREEZE_ORDERはsource-ab-sealed等の旧来の粗い8段階のままで、A/B個別seal、
      comparison freeze、backup検証、32件移行、全206 panel確認を区別しない。
      HASH_GRAPHにもcandidate A/B、comparison、migration backup、migrated ID set、
      human-confirmed source entriesのnodeがなく、line 771はsource、assignment、corpus、
      auditObjectだけをmutation起点としている。このため新しい上流証跡が変わっても
      approval、review、Red/Green、較正がstaleになる契約を保護できない。
    required_change: >-
      DESIGNとTESTCASESの作成順および有向依存をfixtureへ反映し、A/B候補、comparison、
      backup、移行ID集合、人間確定sourceの各mutationから必要な全下流証跡がstaleになることと、
      完全なgraphが非循環であることを検証する。
conditions: []
rollback_to: test-code
summary: >-
  対象hashと指定hashは一致し、TypeScript型検査は成功した。対象Vitestは2340件Green、
  5件は各欠落成果物だけを理由とする期待Red、TC-REAL-001の1件は全成果物存在だけを条件とするskipだった。
  独立再計算ではA/B各206件、既知3 hash、exact=618、canonical-unit-equivalent=206、
  different=0を再現し、backupも固定SHA-256、33 entry、32 complete、P11-N033未完了を確認した。
  ただし直前のR-001からR-005は部分実装に留まり、mutationが未実行または自己充足しているため、
  承認済みTESTCASESを保護するtest-code gateとしては通過できない。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts
    hash: sha256:c3a2fca438264622fd7db6c19cc71a13318263235d4d2beb63307a8d2f98f4ab
findings:
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:392
    problem: LocalStorage移行oracleは固定backupの真正性と無改変移行を検証せず、mutationも固有の拒否条件へ到達していない。
    evidence: >-
      migratePriorCaptureForOracleはsource file SHA-256、version、role、entryの完全schema、
      locator、移行後verification/actionを検査しない。TC-SOURCE-AUDIT-003の各mutationは、
      成功済み32件を保持した同じstateへ再移行するため、すべて先頭IDのmigration-conflictで失敗する。
      confirmed=false、mu code point変更、-0、P11-N033 confirmed、unknown propertyの各条件は
      実際には評価されず、失敗時atomicityの検査も自己充足している。
    required_change: >-
      固定backup hash・version・role・33件中32 complete・P11-N033を検証するtest-local fixtureを用い、
      各mutationを空の独立stateから実行する。copy前後のraw UTF-8 bytes/code units、
      normalized binary64 bits、locator、preserved-prior-human-confirmation、候補による上書き禁止を
      個別に比較し、各固有拒否条件へ到達したうえで失敗前後state不変を確認する。
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:397
    problem: 人間確認workflowは824という件数とID形式だけを検査し、凍結済み候補・移行済み32件・正確な206×4 event集合へ結合されていない。
    evidence: >-
      verifyHumanWorkflowは任意の正規表現適合IDを824個用意すれば通過でき、frozen A/B各206件、
      comparison hash、backup migration、期待される206 ID集合との一致を受け取らない。
      通常テストの負例もeventを1件削除するだけで、PDF表示順違反、明示操作なし、未保存、
      候補freeze未完了、未知または欠落panel/fieldを個別に検出しない。production readerの
      確認時0回と事後照合時1回は分離されたが、確認開始条件と完全event mapの契約は保護されない。
    required_change: >-
      A/B・comparisonの既知hash、移行済み32件、frozen 206 IDから期待824 keyを導出する独立workflow stateを作り、
      event key集合の完全一致、sourcePanelVisibleAt<=candidateVisibleAt、field別explicit action、
      persisted stateを検証する。各条件を一つずつ壊す到達可能なmutationと、export完了までreader 0回、
      別fixtureによる事後照合reader 1回を維持する。
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:341
    problem: candidate comparison・proposal・最終値・backup pair・humanActionのaction表が依然として結合されていない。
    evidence: >-
      auditEntryはcomparison/proposedまたは移行backupを入力に持たないため、exactでの
      resolved-disagreement、proposalと同値のcorrected-proposal、proposalと異なる
      confirmed-proposal、任意IDでのpreserved-prior-human-confirmationを受理できる。
      canonical-unit-equivalentのfinal rawをU+00B5へ拘束せず、PII検査も単純な@と
      account/device単語だけなので、accountId=、user_id:、deviceName=、hostname=、
      machine_id:およびschema外PII propertyを検出しない。追加された負例は
      different+confirmed-proposalとemail風文字列の2件だけで、承認済みaction表の全分岐を覆わない。
    required_change: >-
      各fieldを再構築済みcomparison/proposedまたは移行backup pairへ結合し、
      confirmed/corrected/resolved/preservedのfinal raw・normalized条件とrationale条件を
      全分岐で検証する。canonical U+00B5、空白rationale、指定されたemail/account/device label、
      schema外PII propertyを個別mutationで拒否する。
conditions: []
rollback_to: test-code
summary: >-
  指定hashは再計算値と一致した。TypeScript型検査は成功し、対象Vitestは2341件Green、
  corpus.json・split.json・protocol.json・SHA256SUMS・SOURCE-AUDIT.jsonの欠落だけを理由とする
  5件の期待Red、全成果物存在を条件とするREAL206の1件skipだった。通常実行されるgzip固定fixtureは
  tmpの独立A証跡206件と一致し、そこから限定mu変換したBも独立B証跡と一致した。既知A/B hash、
  comparison hash、exact 618・canonical-unit-equivalent 206・different 0を再現し、
  206件の温度・過飽和度・時間・FOVの単位変換も独立検算で不一致0件だった。
  新しいfreeze順とstale graphは候補A/B、comparison、backup、移行ID集合、人間確定sourceから
  review・Red・Green・calibrationまでの推移集合を持ち、cycle負例も到達するため、直前のR-001とR-005は解消された。
  旧workflowState、exportThenCompare、FREEZE_ORDER、HASH_GRAPH等のhelper残存もない。
  ただしR-002、R-003、R-004はmutationが別条件で失敗するか、必要な状態結合自体がなく未解決である。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts
    hash: sha256:06d324a129e172b437ed03a3c6490617f2be208fc88c44e42ba758db96fb4ccd
findings:
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts:500
    problem: 人間確認eventの重複を表現・拒否できず、824 fieldの完全なevent集合契約が未完成である。
    evidence: >-
      WorkflowState.eventsはMap<string, VerificationEvent>であり、同じpanel/field keyを二度setすると
      後のeventが前のeventを無条件に上書きする。verifyHumanWorkflowもSet由来の期待keyとの
      membershipとMap.sizeだけを検査するため、重複eventが発生した履歴を正常な824件として受理する。
      line 999以降のmutationは欠落、未知panel、未知field、PDF表示順、raw/normalized操作、永続化を
      個別検査するが、duplicate eventの到達可能なmutationと固有reasonがない。
    required_change: >-
      確認eventを重複回数が失われない配列またはkey別件数付き構造で保持し、frozen 206 IDから導いた
      824 keyについて各keyの許容件数を明示して検証する。同一panel/field eventを重複させたfresh
      fixtureが専用reasonで拒否され、exportされず、readerが0回のままであるmutationを追加する。
conditions: []
rollback_to: test-code
summary: >-
  指定hashは公式hashスクリプトでも一致し、TypeScript型検査は成功した。対象Vitestは2350件中、
  synthetic 2344件Green、5成果物それぞれのmissing-artifact assertionだけが期待Red、
  REAL206が1件skipだった。固定gzip証跡はtmpの独立A 206件と完全一致し、独立再計算で
  A hash de2d1e32eed414f020c1be76fc82b2209848da2b399aa1f00c96ecb55638f732、
  B hash b641538a2344cb348e62532cb6e48aaf3b9b5cf236fd703a51a7f1b3d9cdcfd3、
  comparison hash 33c545adebfae122fea0d84985445f60eeb7f17ed1e0e9ba2cb99d7a34b6bad9、
  exact 618、canonical-unit-equivalent 206、different 0を再現した。
  A/B計1648 fieldのraw単位換算とnormalized値も不一致0件だった。R-001/R-005、backupの
  schema・hash・32件無改変移行・atomic failure、action表、U+00B5、PII拒否、
  reader分離、および旧helper残存0は維持されているが、duplicate event契約が未解決のため承認しない。
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts
    hash: sha256:ff9bfd0daf0c2f332d6a329a659e12d1abb94884314f9fc5c957d65b284d24c5
findings: []
conditions: []
rollback_to: none
summary: >-
  直前レビューの未解決findingは解消された。確認eventは重複履歴を保持するtuple配列となり、
  frozen A/B comparisonの206 IDから導く824 keyを各1回に限定する。既存確認P11-N001と
  新規確認P11-N033をそれぞれ重複させたfresh fixtureは専用reason
  duplicate-human-verificationで検証・exportの双方が失敗し、exported=false、
  production reader 0回を確認する。欠落、未知panel/field、PDF提示順、raw/normalizedの
  明示操作、永続化、origin、候補freeze、32件無改変移行、action表、hash、stale伝播の
  既存検査も維持されている。独立再計算では206 ID・824 field、A/B/comparison hash、
  exact 618、canonical-unit-equivalent 206、different 0、raw単位換算不一致0を再現した。
  TypeScript型検査は成功。対象Vitestは2351件中synthetic 2345件成功、計画済み成果物5件の
  missing-artifact assertionだけが期待Red、REAL206は成果物完成前の許可済み1件skipだった。
  重複event専用テストの単独実行も成功し、レビュー後の対象hashは指定値と一致した。
```

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:db91dbcb45221a9da3ff4316f78c7432ae0a1f322dcbd2bbb8d7f8808ac90610
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:debda9d6c4ea0b7db2c3a7ac7a3f11a774594052e65b6ad3ac698d5ca2cb3e31
findings: []
conditions: []
rollback_to: none
summary: >-
  D-10承認時のDESIGNをcommit 786dd3bとbyte-for-byte照合し、hash
  db91dbcb45221a9da3ff4316f78c7432ae0a1f322dcbd2bbb8d7f8808ac90610
  が不変であることを確認した。DECISIONSの差分はD-11の17行だけで、対象を
  libbrecht-2023-figure2-schema-artifacts.test.ts内の
  TC-SOURCE-AUDIT-001..005およびTC-REAL-001のテストコード化に限定し、
  通常DeliveryBuilderの初回・修正1回目・修正2回目と各レビューで残った同一種の
  migration、206×4 workflow、action表の結合不足を記録している。D-11はD-07で同じ
  ファイルに対して人間承認済みの高性能書込み担当例外と、人間の「必要なら高性能モデルへ
  切り替えて続行」指示を再適用する工程判断であり、エージェント設計書の3回停止規則および
  高性能モデル切替時の人間確認規則に整合する。変更境界、fresh Reviewer、期待Red、
  非設計コミットゲートを維持し、SPEC/TASKSの要求・完了条件、SOURCE-AUDIT schema、
  A/B凍結hash、32件無改変移行、206 panel全件確認、物理式、単位、適用範囲、数値法、
  独立oracle、許容誤差を変更していない。TESTCASESも直近承認hash
  31087002d9b47b0e5bdcb0be69bb3d62c9aab6d4be664b250523985d788d2b2b
  と一致し、テストケース契約の変更はない。
```
