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
