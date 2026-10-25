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

## test-code review: D-22 negative-matrix intermediate approval

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-d20-negative-builders.mjs
    hash: sha256:fa47ea8d81e35e768162b4bfbce785aef0c54b61d3fc244cb918daf5c230ee9c
  - path: apps/snow-crystal-sim/tests/calibration/pilot-negative-selfcheck.mjs
    hash: sha256:67d530ceb4bfba9d352c99cd01c209f8b0e8b35bc1adfab030722f5a6b5be9f1
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:ff20e2d344ed6508c354519445b6d4bdd2b2fdf46a4c87b776485aed35e17489
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:4fc791f181f6f3f86a5e3e48a88a4a812ed23e781a66be783fa8ed63e86eaa22
findings: []
conditions: []
rollback_to: none
summary: "Approved D-22 substage B: independent self-checks prove 48 replacement rows with 14 authority negatives, 2 correct controls, and 6 fully signed TypeError enum probes; 72 state-attempt rows; 66+67 reissue rows; and exactly 253 unique registry labels. Concrete schemas, signatures, artifact bytes, runtime shapes, and the isolated fully re-signed duplicate-evidence probe were independently checked. Typecheck passed; targeted Vitest passed 14 tests and failed only at the intentional duplicate-evidence expected Red. No skips or assertion weakening were introduced; the 30-second reissue timeout is supported by the observed 15.4-second exhaustive check. Approved positive modules remain byte-identical at d077df5d64ad79c059fd3317b620e97c31d8420fe5ca5ad4ebf3da046c6fee13 and 40a4ac441da6e06b566d22f63316106db3815a08b33831587ed447378ccbfbe0."
```

## test-code review: D-20 first pass

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:0a166d2895d05fa36adcb2e87fb46b20e67f6f0af7987a9239eee8f602408db0
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:22d6f5b9507e35f67fb8d0024d5588b5f6ba5dbcad5c53aa6a789100ff41ff0b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:d464035030b61de762d180d41709a5f4ba5307216aef837d6539014a01ce1c32
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:6d813aca2cdd86ce5c317acc4a858b01c5b62529202ea6c63939e04320064a43
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:221
    problem: 18件とされる状態遷移fixtureのうち一意なのは12件だけで、各campaignの中間retryable状態が検査されていない。
    evidence: transitionShapesはinvalid-validとinvalid-invalid-invalidを各2回登録する一方、plannedからinvalid attempt 1を受理してretryable-2になる系列と、先行evidence 1付きでinvalid attempt 2を受理してretryable-3になる系列を持たない。生成registryを独立集計するとattempt-state-transitionは18件だがJSONとして一意なfixtureは12件だった。TESTCASES.md 1512-1513およびprotocolの3 campaign×6状態遷移を満たさず、件数assertionだけが通る。
    required_change: 各campaignについてvalid-1、invalid-1、invalid-1→valid-2、invalid-1→invalid-2、invalid-1/2→valid-3、invalid-1/2→invalid-3の6個を異なるfixtureと期待stateで構成し、fixture hashの重複が0であることもassertする。
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:258
    problem: plan再発行のpositive fixtureが規範の具体的な再発行chainを表さず、浅い自己申告配列だけで未実行・非再利用を判定している。
    evidence: 新protocolはHラベル由来のhashしか存在せず、新schema/template、selection、manifest/restricted map、batch input、prompt variables/evidenceの実objectやfreeze順がない。crossPlanReferences等の空配列も新DAGから導出されないため、新第一plan内部で旧ID/hashを再利用しても検出できない。positive reasonはschema-changeだけで、prompt-change、旧第二planがnullの経路、closure前後時刻の旧plan受付拒否、旧新ID/hash集合の完全非交差も未検査である。これはTESTCASES.md 1557-1583の主要条件を満たさない。
    required_change: schema-changeとprompt-changeの両方について、具体的な新schema/templateから新protocol、selection、manifest/map、input、prompt evidence、第一planまでを実object/hashで構成する。freeze順と旧新ID/hash集合をartifactから導出し、第二planのnull/非null、closure後受付、旧成果物再利用、cross-plan edgeの各負例を追加する。
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:148
    problem: model-retryとinput-changeの禁止変更matrixが不足し、authority hashの差替え以外の意味違反を検出できない。
    evidence: input-change positiveはattachmentSlotだけを変えて派生promptを再生成しているが、負例は主にchangedInputSha256の交換・stale値・null化である。replacementInputsの画像file/RGBA hash、ID、順序、schema/template、prompt variables直接編集を、campaign/evidenceまで再署名した状態で試していない。model-retryでもprompt/inputを整合的に1 byte変更する負例がなく、schema-fixとprompt-changeをreplacement reasonとしてfully re-signedで拒否するfixtureもない。TESTCASES.md 1544-1555の必須matrixを満たさない。
    required_change: 実object/bytes由来のauthorityを使い、model-retryのprompt/input変更、input-changeの画像hash・ID・順序・schema・template変更、variablesだけの直接変更、schema-fix・prompt-change reasonをcampaign/evidence/ID/file hashまで再計算した独立負例として追加する。
conditions: []
rollback_to: test-code
summary: node --checkとtypecheckは成功し、対象Vitestは意図された14 pass・1件の決定論的named Redになった。23 schema、selectionのPDF直接field、再署名済みduplicate-evidence Red自体は追加されているが、状態遷移、plan再発行、replacement invariantの必須coverageが不足するためtest-code gateは不合格。
```

## test-code review: D-20 second pass

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:0a166d2895d05fa36adcb2e87fb46b20e67f6f0af7987a9239eee8f602408db0
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:22d6f5b9507e35f67fb8d0024d5588b5f6ba5dbcad5c53aa6a789100ff41ff0b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:e51d3dc817b06c494fe3d547116bbf81b1a5e3e9585b905ab7bbda5fc9eb9d52
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:c523979d969c40a2cf53e119504b50e3fbc796b277ecd49d61846c54e8393f6b
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:224
    problem: >-
      18件のstate-sensitive fixtureは相互には一意だが、既存の6件の
      attempt-campaign正例と重複し、TESTCASESが要求するfixture hash重複0を満たさない。
    evidence: >-
      独立にfixtureを生成してJSON表現をSHA-256化すると、既存6件と新18件の計24件は
      19 hashしか持たない。root/valid-1、root/invalid-1-valid-2、
      root/invalid-1-invalid-2-valid-3、root/3-invalid-failed-closed、
      model-retry/3-invalid-failed-closedの5組が完全重複する。
      line 268のassertは新18件だけを検査し、全登録fixtureの重複を検出しない。
    required_change: >-
      root、model-retry、input-changeの各6遷移を単一の規範matrixとして登録するか、
      重複する旧正例を除去する。全attempt campaign/state fixtureのunionについて、
      exact label、直前state、必要なevidence番号・件数、fixture hash一意性をassertする。
  - id: R-002
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:299
    problem: >-
      prompt-changeの2つのpositive reissue chainは、新template bytesと異なる旧templateから
      rendered promptを生成しており、規範上有効な再発行fixtureではない。
    evidence: >-
      line 301はannotator templateへLFを追加し、そのhashをnewProtocolとnewEvidenceへ格納するが、
      line 310のrender('annotator', newVariables)はpilot-oracle.mjsの固定
      templates.annotatorを使用する。したがってnewEvidence.promptTemplateFileSha256が指す
      bytesからnewRendered/newEvidence.renderedPromptSha256を再現できない。
    required_change: >-
      exact newTemplate bytesを入力に取る独立rendererでrendered promptを生成し、
      template、variables、rendered evidence、rendered prompt、protocol、planの全hashを
      実bytes/objectから再計算して相互一致をassertする。
  - id: R-003
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:312
    problem: >-
      PlanClosureのterminal受付拒否、old/new集合の分離、cross-plan再利用禁止が、
      実artifact registryではなく不完全な手作業集合と空配列・ラベルhashで表現されている。
    evidence: >-
      oldSecondPlanが存在する2 fixtureでもoldIdsにそのobject hashが含まれず、旧run/active
      artifact、campaign/evidence、snapshot、approval、coverageもoldIdsの対象外である。
      oldPlanSubmissionsAfterClosure等は実submission/root/ledger objectではなく空配列へ
      H(label)を加えるだけで、closure前後UTC双方の受付拒否を検査しない。
      crossPlanReferencesも実ledger/root/approval/coverage参照ではない。
      new-reference mutationは未定義のf.newProtocolObjectSha256を代入しており、
      具体的な新plan hash参照を作らない。さらにschema/template変更原因は各1種類だけで、
      TESTCASESが要求するschema reference、placeholder、renderer、instruction semantics、
      判断規則・mappingの各単独変更を網羅しない。
    required_change: >-
      旧・新artifact inventoryを実object、canonical bytes、object/file hashから導出し、
      第二planを含む全旧実行artifactと新未実行planの集合が非交差であることを検査する。
      実submission/root/ledger/approval/coverageを使ったclosure後受付、cross-plan
      ledger/root lineage、旧成果物再利用、新DAGからclosure参照の負例を追加する。
      新planは7 planned root IDを持つ一方、materialized root/campaign/run/ledger/snapshot/
      second plan/approval/coverageが0件であることを実registryから導出する。
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:152
    problem: >-
      replacement禁止変更matrixが完全再署名されたartifact chainになっておらず、
      model-retry固有のnull境界とenum-valid reason不一致も欠けている。
    evidence: >-
      input-changeのstale authorityはreplacementSources.staleの実体をfixtureへ保存せず、
      model-retryのstale/wrong authorityもw.runs[1]とw.consensusのfile hashだけを持つ。
      model-retry template/input mutationはschema、PromptVariables、RenderedPromptEvidence、
      rendered promptを再導出せず参照fieldだけを変更する。input-changeのschema/template/
      direct-variables mutationも同様に全chainを更新していない。campaign/evidence双方を
      更新する4個のnull mutationはinput-changeにしか生成されず、model-retryにはない。
      campaignとevidenceがmodel-retry/input-changeで食い違うenum-valid負例もなく、
      not-a-reasonと禁止enumだけに依存する。
    required_change: >-
      各mutation fixtureへstale/future/wrong authorityの実object・bytesを含め、
      table、ordered input、schema、template、variables、rendered evidence/prompt、
      campaign、evidence ID/fileを一貫して再計算する。model-retryとinput-changeの双方で
      active ID、active file、reason、changed inputを1項目ずつ共同null化し、
      enum-valid reason不一致、schema-fix、prompt-change、unknown reasonを独立検査する。
conditions: []
rollback_to: test-code
summary: >-
  23 schema bundle、PilotSelectionPlanV1のsourcePdfSha256直接結合、
  18種類のstate形状、fully re-signed duplicate-invalid-evidence probeは追加されている。
  node --checkとworkspace typecheckは成功し、対象Vitestは14 pass・1 failで、
  failureは予定どおりduplicate evidence attemptを現validatorが受理したことによる
  RangeError assertion failureだけだった。構文・型・環境failureはない。
  ただしstate fixtureの全体重複、無効なprompt-change正例、象徴的なplan reissue境界、
  不完全な禁止変更matrixにより、修正後validatorのGreenを正しく判定できない。
```

## test-code review: D-20 third pass

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:0a166d2895d05fa36adcb2e87fb46b20e67f6f0af7987a9239eee8f602408db0
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:22d6f5b9507e35f67fb8d0024d5588b5f6ba5dbcad5c53aa6a789100ff41ff0b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:22f57daa09338ba6ca95f9bb40f50fbe5dbdbd4f8c05ad947a72cab8c01c1bca
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:3923a7b35dee56d33fc306c6b49d383350603fd90e9bf8213d643d19a1d555d5
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:279
    problem: The six input-change state-transition positives use a valid wrapper cloned from the old run instead of the re-derived replacement input and prompt artifacts.
    evidence: The fixture campaign binds promptVariablesObjectSha256 94ecb0cce92e416901b591e8cc12dddd2571bc4ac1e5992a3dac333cee7f17eb and batchInputTableObjectSha256 ba9c1d8b9f38a51dfa34d7f11c114c4f28bbcb32d158b91858db096565b14593, while its validWrapper still binds the old values a22784d3307444d08e510fe654a8b9930c44d7e0135e2f56e0a1923ab4841085 and 980b79b7ecc55f7a2dc54a21ff558691b368f43286525bda0e6603092f573f25. A validator enforcing the approved input-change contract must reject these intended positives.
    required_change: Construct input-change valid wrappers from the changed attachment-slot table and exact-template re-rendered variables/evidence/prompt, update every corresponding header/input reference, and recompute wrapper bytes and file hash before registering all affected transitions.
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:322
    problem: The reissue cause matrix does not contain the concrete one-change fixtures required by TC-PILOT-REISSUE-001.
    evidence: The placeholder and renderer rows only append a comment to template bytes; their placeholder tuple and rendererId remain unchanged. The decision-rules-mapping row also changes the schema $id, so it changes two authorities. Consequently the labels do not describe the exercised changes, and template-only, placeholder, renderer, and mapping boundaries are not independently verified.
    required_change: Build separate, concrete single-cause fixtures for schema bytes/object/reference, template bytes, placeholder tuple, renderer, instruction semantics, and decision-rule/mapping changes, then independently derive each new protocol and downstream artifact chain.
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:339
    problem: Plan-closure binding, disjointness, post-closure rejection, and unexecuted-new-plan coverage remain incomplete.
    evidence: The inventories omit canonical file hashes for ordinary objects and do not collect nested campaign IDs, invalid-evidence IDs/file hashes, or all old execution artifacts. Negatives do not alter old protocol/selection/first-plan/second-plan/ledger/cutoff references, do not test null versus non-null second-plan mismatch, and only populate newPlanMaterializedRoots while leaving the other eight required-zero execution collections untested. Reuse negatives cover one root ID but not old active artifacts, campaigns/evidence, snapshots, approvals, or coverage.
    required_change: Derive audited old/new inventories from actual objects and canonical bytes, include every protected execution ID/file hash, assert a zero intersection, and add concrete one-field negatives for every closure reference/cutoff/second-plan state, every post-closure operation, all nine new-plan execution collections, and each prohibited cross-plan reuse category.
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs:835
    problem: The generated PlanClosureV1 schema does not constrain oldCutoffSequence to a non-negative safe integer.
    evidence: INTEGER_PROPERTIES contains cutoffSequence but not oldCutoffSequence. Independent schema checks therefore accept oldCutoffSequence values 1.5, -1, and 9007199254740992, contrary to the ledger terminal-sequence contract.
    required_change: Add oldCutoffSequence to the integer constraint set with zero allowed, and retain explicit fractional, negative, and unsafe-integer rejection cases.
  - id: R-005
    severity: medium
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:222
    problem: Out-of-enum schema-fix and prompt-change replacement reasons have the wrong expected error class.
    evidence: semanticBad registers these cases as RangeError with invalid-attempt-evidence, while TESTCASES.md explicitly requires enum-external replacement reasons to produce TypeError.
    required_change: Register these mutations with TypeError and the stable enum/type reason and field required by the approved test cases.
conditions: []
rollback_to: test-code
summary: The targeted test run reaches the intended deterministic duplicate-evidence Red with the other 14 test blocks passing, and typecheck is Green. However, several intended positive fixtures are internally inconsistent and the reissue/closure matrices omit required semantic boundaries, so this gate cannot approve.
```

## test-code review: D-21 builder refactor first pass

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-d20-builders.mjs
    hash: sha256:306c69bea18acc70271cdbe6dcff38ab3e50421e4ddfb68854a2f43c2599938d
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:0ed014c1450d55bb8624343095f5bb7e6fc7bd8eecee67d349f41b2d0f7b9b43
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:9c77878d132652c035fa2feb67db1a4ff98fecf31348fff34c1acf44c17a9275
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:22d6f5b9507e35f67fb8d0024d5588b5f6ba5dbcad5c53aa6a789100ff41ff0b
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:82e452bf516d9265ffa2d96b55d0fc6cc3cf6220a76da708b0f5273ce05c7848
findings:
  - id: R-D21-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:261
    problem: The three accepting input-change transition fixtures still use a valid wrapper cloned from the unchanged original run instead of materializing the wrapper from the changed table and prompt chain.
    evidence: Independent fixture inspection found campaign batch-input hash dcc42328d5c31926939e783143c55c6c85b4cfe16fad9ebba63d84c9b549f9bd while validWrapper.table hashes to eeef71085c8d5fd1bcf0c8ea32fb0c7068d4e626e33b3c1979b35d8423dc0cd4. Campaign prompt-variables hash is 095d74870d98bd92b68fe3abd18e96dc4422b61d7a34493523c0c3fd11262ca4 while the wrapper and its generator retain cb3a9f8c9961ea154efa43f967fa9ef509e2ef35b0bbcd6fe401dbc8f27093d9. This occurs for valid attempts 1, 2, and 3, reproducing the central synchronization defect D-21 was intended to remove.
    required_change: Add a pure valid-wrapper materializer that consumes the replacement prompt chain and regenerates the wrapper table, prompt variables/evidence/rendered bytes, generator references, header input hashes, campaign binding, artifact bytes, and file hash. Assert every wrapper reference equals the changed campaign authority before registering all three positive histories.
  - id: R-D21-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:79
    problem: Replacement enum and authority negatives do not implement the approved typed, fully re-derived matrix.
    evidence: semanticBad hard-codes RangeError for every mutation, so schema-fix, prompt-change, and unknown replacement reasons are registered as RangeError even though TESTCASES requires TypeError for enum-invalid reasons. The wrong-authority cases do not cover active file, new table, stale/future artifact, schema file, template file, and prompt-variables hash for both model-retry and input-change. The schema, template, and direct-variable mutations at lines 180-205 alter selected evidence references without rebuilding all dependent prompt, campaign, wrapper, ID, bytes, and file hashes, allowing rejection for shallow inconsistency instead of the intended semantic boundary.
    required_change: Use separate typed negative registration for enum-invalid TypeError cases. Generate the complete 2-reason authority matrix from concrete artifacts, and for each semantic mutation rebuild and re-sign the entire affected chain so only the intended forbidden authority or reason differs.
  - id: R-D21-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-d20-builders.mjs:58
    problem: Reissue inventories and reuse negatives are not derived from a complete concrete artifact graph, so the asserted old/new disjointness is incomplete.
    evidence: collectArtifactInventory records fileSha256 only when the object already exposes that field and never derives SHA-256 over canonical object-plus-LF bytes; all eight new inventory entries therefore have null file hashes. The old inventory omits campaigns as independent artifacts, invalid-attempt evidence, active upstream snapshots, skipped approvals/coverage, and other protected execution materializations. The new inventory omits the changed schema and template. Several reuse negatives only append a hash to the bookkeeping newIds array, and all nine nonempty-new-plan mutations insert the old slot-plan entry regardless of the artifact kind, rather than constructing type-correct campaign, evidence, ledger, snapshot, approval, or coverage reuse.
    required_change: Inventory every protected old and new artifact from its actual object and canonical file bytes, including object hash, file hash, artifact ID, and relevant embedded references. Include campaigns, invalid evidence, all snapshots, approvals, coverage, schema, and template authorities. Derive disjointness from those artifacts and use type-correct concrete post-closure and cross-plan reuse mutations rather than independently mutable ID lists.
  - id: R-D21-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:369
    problem: PlanClosure oldCutoffSequence is tested only for numeric-domain validity, not for equality with the old ledger terminal sequence.
    evidence: The positive closure uses terminal sequence 0, while the negative cases cover only -1, 0.5, and an unsafe integer. A safe integer value of 1 remains schema-valid and is not registered as a semantic rejection, so a validator could accept a cutoff different from the ledger terminal and still pass this suite.
    required_change: Add a fully re-signed closure negative with oldCutoffSequence set to a different safe integer, such as terminal sequence plus one, and require protocol-reissue-required at oldCutoffSequence. Retain the existing TypeError/RangeError schema-boundary cases separately.
  - id: R-D21-005
    severity: medium
    location: apps/snow-crystal-sim/tests/calibration/pilot-d20-builders.mjs:76
    problem: The six reissue causes are not all isolated to the named authority and two prompt causes are classified as schema changes.
    evidence: The template-bytes case appends the instruction text "Reissued instruction boundary.", so it also changes instruction semantics and overlaps the separate instruction-semantics case. The group rule assigns schema-change to placeholder-tuple and renderer even though both are prompt-rendering authorities. This prevents the six fixtures from independently proving the intended cause-to-closure-reason boundary.
    required_change: Give each cause an explicit expected closure reason and a single authoritative source mutation. Make the template-byte mutation semantics-neutral, keep instruction wording as the separate semantic case, and classify placeholder and renderer changes under prompt-change.
conditions: []
rollback_to: test-code
summary: Node syntax checks and TypeScript typecheck passed. The targeted Vitest run produced 14 passing tests and exactly the intended deterministic duplicate-evidence Red. The 23-schema bundle, direct selection PDF field, 18 distinct registered transition fixtures, and isolated probe are present. Approval is withheld because the accepting input-change wrappers remain internally inconsistent and the reissue inventories, typed authority matrix, and cutoff semantics do not yet prove the D-20 contract.
```

## test-code review: D-21 builder refactor second pass

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-d20-builders.mjs
    hash: sha256:1302e4cb6cac2105fd830e6b071190f49b4e7085622b15c1d89b9e180bdd2716
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:ca9abcbf190efbec1a1ca09f242e6da4c46a45e7b83351a8fa6c49b2be02f941
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:9c77878d132652c035fa2feb67db1a4ff98fecf31348fff34c1acf44c17a9275
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:22d6f5b9507e35f67fb8d0024d5588b5f6ba5dbcad5c53aa6a789100ff41ff0b
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:82e452bf516d9265ffa2d96b55d0fc6cc3cf6220a76da708b0f5273ce05c7848
findings:
  - id: R-D21-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-d20-builders.mjs:62
    problem: The replacement wrapper materializer still leaves the artifact header bound to the old batch-input table for all three accepting input-change histories.
    evidence: Independent fixture execution found attempts 1, 2, and 3 all retain header.batchInputTableObjectSha256 eeef71085c8d5fd1bcf0c8ea32fb0c7068d4e626e33b3c1979b35d8423dc0cd4, while both the materialized wrapper table and campaign bind dcc42328d5c31926939e783143c55c6c85b4cfe16fad9ebba63d84c9b549f9bd. Lines 67-85 replace the table and prompt chain but never regenerate the header batch-input reference, reproducing the synchronization defect D-21 is intended to prevent.
    required_change: Regenerate and assert every affected wrapper header/input reference from the replacement chain, including header.batchInputTableObjectSha256, before recomputing artifact bytes and file hash; retain explicit consistency assertions for accepting attempts 1, 2, and 3.
  - id: R-D21-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:86
    problem: The replacement-reason and authority negatives still do not implement the approved typed, fully re-derived two-reason matrix.
    evidence: Registered in-plan schema-fix and prompt-change cases both expect RangeError/invalid-attempt-evidence at line 213, while TESTCASES.md requires TypeError for enum-invalid reasons; no equivalent fully signed unknown-reason campaign is registered. Several authority mutations at lines 179-212 still patch evidence or campaign references without rebuilding the complete prompt, campaign, wrapper, ID, bytes, and file-hash chain, and the required concrete active-file/new-table/stale-or-future-artifact/schema-file/template-file/prompt-variables matrix is not enumerated for both model-retry and input-change.
    required_change: Register schema-fix, prompt-change, and unknown replacement reasons as schema-level TypeError cases, then generate every two-reason authority negative from concrete artifacts while fully re-deriving and re-signing all dependent objects so only the intended semantic authority violation remains.
  - id: R-D21-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-d20-builders.mjs:146
    problem: The reissue inventory and nonempty-new-plan mutations are still incomplete and not consistently type-correct.
    evidence: Independent execution found the old inventory contains neither the old annotation schema nor template and contains no invalid-attempt evidence. The builder reads invalid evidence from globalThis.__snowCrystalD20InvalidEvidence, which is never assigned. Lines 155-156 add embeddedRefs arrays themselves to the ID sets instead of flattening their referenced IDs and hashes. In pilot-state-cases.mjs, newPlanMaterializedRoots receives a slot-plan row, newPlanInvalidEvidence receives the surrounding fixture envelope rather than InvalidAttemptEvidenceV1, and newPlanLedgerEntries receives an entire ledger wrapper rather than a ledger entry. Required concrete negatives for reused selection/manifest/plan, cross-plan ledger/root lineage, reversed freeze order, new-plan attempt 2 or 3, closure UTC, and unknown new-plan reference properties are also absent.
    required_change: Build old and new inventories from the complete concrete authority/artifact graph, including schemas, templates, campaigns, InvalidAttemptEvidenceV1 objects, all snapshots, approvals, and coverage; flatten embedded references into the compared sets. Populate every nonempty-state and reuse negative with the correct artifact type and add the remaining TC-PILOT-REISSUE-001 boundary mutations.
  - id: R-D21-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-d20-builders.mjs:131
    problem: Two of the six positive reissue causes produce artifacts invalid under their declared schemas.
    evidence: Independent schema checks return false for the placeholder-tuple new protocol because reversing annotatorAllowedPlaceholders violates MorphologyPilotProtocolV1's fixed tuple. The renderer cause changes rendererId to ascii-placeholder-exact-replacement/2, causing both the new protocol and RenderedPromptEvidenceV1 to fail their literal /1 schemas. No corresponding reissued protocol or rendered-evidence schema is materialized, so these are not valid positive reissue chains.
    required_change: Materialize the new schema authorities required by placeholder and renderer contract changes, bind them into the new protocol and prompt chain, and validate every artifact in all six positive reissue chains against its declared schema while preserving the isolated prompt-change closure reason.
conditions: []
rollback_to: test-code
summary: TypeScript typecheck is Green, and the targeted test run has 14 passing blocks plus exactly the intended deterministic duplicate-evidence Red. The 23-schema bundle, direct PDF binding, 18 uniquely registered transitions, signed terminal-plus-one cutoff rejection, and six correctly named closure reasons are present. Approval is withheld because accepting input-change wrappers remain internally inconsistent, the enum/authority matrix and reissue graph remain incomplete, and two positive reissue chains are schema-invalid.
```

## test-code review: D-21 builder refactor third pass

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:82e452bf516d9265ffa2d96b55d0fc6cc3cf6220a76da708b0f5273ce05c7848
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:22d6f5b9507e35f67fb8d0024d5588b5f6ba5dbcad5c53aa6a789100ff41ff0b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:9c77878d132652c035fa2feb67db1a4ff98fecf31348fff34c1acf44c17a9275
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:e7247a086b10a3c44d6def9058d6c785c3dc12e2294fb36d8a989ea3984c3ed8
  - path: apps/snow-crystal-sim/tests/calibration/pilot-d20-builders.mjs
    hash: sha256:703296ddcbb263450c0b6f0e16ae1b8d7b6a3a1d826e23c71d9dca8c82fd05ac
findings:
  - id: R-D21-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:149
    problem: The approved two-reason authority matrix and enum-invalid behavior remain incomplete.
    evidence: The fully re-signed schema-fix and prompt-change mutations at line 213 still expect RangeError/invalid-attempt-evidence, whereas TESTCASES.md requires schema-level TypeError for those enum-invalid values and an independently signed unknown reason. The authority negatives also do not enumerate active file, new table, stale/future artifact, schema file, template file, and prompt-variables authorities for both model-retry and input-change; notably model-retry is never paired with the concrete input-change table authority.
    required_change: Generate schema-fix, prompt-change, and unknown-reason cases as fully signed schema-level TypeError fixtures, and build the complete two-reason by wrong-authority matrix from concrete stored objects and bytes with every dependent campaign, evidence ID, filename, bytes, and file hash re-derived.
  - id: R-D21-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:369
    problem: The reissue graph and required boundary mutations are still incomplete and several nonempty collections use the wrong artifact type.
    evidence: oldInvalidEvidence contains fixture envelopes rather than direct InvalidAttemptEvidenceV1 objects, and collectArtifactInventory records each envelope without recursively inventorying the nested evidence object. newPlanMaterializedRoots receives a slot-plan declaration, newPlanInvalidEvidence receives an evidence envelope, and newPlanLedgerEntries receives a whole ledger artifact instead of a ledger entry. Embedded references are stored as path/value pairs but omitted from oldIds/newIds. Required TC-PILOT-REISSUE-001 negatives remain absent for old selection/manifest/plan reuse, cross-plan ledger and root lineage, reversed freeze order, new-plan attempts 2 and 3, invalid closure UTC, and unknown new-plan reference properties.
    required_change: Materialize the complete old graph with direct schema, template, campaign, InvalidAttemptEvidenceV1, every snapshot including nested coverage snapshots, skipped approvals, and skipped coverage artifacts; flatten all scalar embedded references into compared sets. Populate all nine nonempty new-plan collections with their correct artifact types and add every missing reissue boundary mutation from TESTCASES.md lines 1579-1583.
  - id: R-D21-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-d20-builders.mjs:149
    problem: Reissue positives do not isolate one changed authority, and two declared positive chains remain schema-invalid.
    evidence: materializeReissuePlan changes schema.$id for every cause, so template, placeholder, renderer, instruction, and mapping fixtures change both their named authority and the annotation schema. Independent schema checks returned false for placeholder-tuple's new protocol and for renderer's new protocol and RenderedPromptEvidenceV1. The builder obtains protocol, selection, and table schemas but discards them with void statements, and the owning test never validates every newly issued artifact against a corresponding new schema authority.
    required_change: Change exactly the named authority for each of the six causes, derive all downstream artifacts from that single change, materialize any updated protocol or rendered-evidence schemas required by placeholder and renderer changes, bind those schemas into the new protocol bundle, and independently schema-validate every artifact in every positive reissue chain.
conditions: []
rollback_to: test-code
summary: The input-change wrapper header synchronization defect is fixed. Typecheck and syntax checks pass; the schema bundle has 23 distinct files, the 18 transition fixtures are unique, and the targeted run has 14 passing blocks plus only the intended deterministic duplicate-evidence Red. Approval remains blocked because the enum/authority matrix is incomplete, the reissue graph and mandatory negatives are incomplete or mistyped, and placeholder/renderer positive chains are schema-invalid.
```

## test-code review: D-22 positive-builder intermediate gate

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-d20-builders.mjs
    hash: sha256:d077df5d64ad79c059fd3317b620e97c31d8420fe5ca5ad4ebf3da046c6fee13
  - path: apps/snow-crystal-sim/tests/calibration/pilot-positive-selfcheck.mjs
    hash: sha256:40a4ac441da6e06b566d22f63316106db3815a08b33831587ed447378ccbfbe0
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:7f3bb0cb3738e5a59ffed09c1a91ba52462866aad89c242f7dc566abd49c99db
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:f38c12dda80c405a5759597e2452b877efa60b8d9c9be0fc4850a4a32fa7a852
findings: []
conditions: []
rollback_to: none
summary: "D-22正常例限定の中間サブ工程だけを承認する。standalone selfcheckは実際にGreenとなり、6つの独立変更原因×旧第二plan null/non-nullのexact 12 reissue、別監査されたskipped route、23 schemaと全宣言artifactのschema適合、canonical bytes・object/file hash・PlanClosure ID、freeze依存、明示的な旧新graph inventory、旧新plan identity/reference分離、新planの9 execution collection全0件を確認した。root/model-retry/input-change×attempt 1/2/3の9 accepting wrapperと、重複のない18 state-sensitive transitionも自己検査および対象テストで確認した。TypeScript型検査と3つのmjs構文検査は成功し、対象Vitestは14 pass・規範どおりduplicate invalid-evidence attemptだけの決定論的Red 1件だった。本承認はpositive builder/fixtureに限り、未レビューの負例行列を含む全体test-code gateの承認ではない。"
```
```yaml
review_type: implementation
status: changes-requested
reviewed_files:
  - path: tmp/snow-crystal-t1-7/source-audit-capture/README.md
    hash: sha256:83961364415a56e2ab9ef27b85e3c7c3ced5358552dd63d68769496e3b5ee7e6
  - path: tmp/snow-crystal-t1-7/source-audit-capture/app.js
    hash: sha256:2abf3ee49a9e4c5305ac7d6f5c5a031badcb69f3f1f136e179c870a38d5588de
  - path: tmp/snow-crystal-t1-7/source-audit-capture/candidate-data.js
    hash: sha256:0d3bcacabfe8625e3c76f7d48bba3fb99280d48cac15c40cff5551f66d5e2c1e
  - path: tmp/snow-crystal-t1-7/source-audit-capture/core.mjs
    hash: sha256:a572e5f94edda9b8809184cfebb7a77806d4b7f6bc19c4fc5cfa4074c6cda2ba
  - path: tmp/snow-crystal-t1-7/source-audit-capture/generate-candidates.mjs
    hash: sha256:f859c405ced21b26b297332ed6589b3b02fadf7b1f1cde5b2b2002352c3df761
  - path: tmp/snow-crystal-t1-7/source-audit-capture/index.html
    hash: sha256:2eeeb1a5a851aad4a603900580fbec01774bd9f11b2c20d42391c07c11d1616f
  - path: tmp/snow-crystal-t1-7/source-audit-capture/pdf-controller.mjs
    hash: sha256:103649d119df1f365eb7df60d715c51fa53242624bbe320f1b91acdec713e908
  - path: tmp/snow-crystal-t1-7/source-audit-capture/prior-pairs.mjs
    hash: sha256:1318e78713420c6108a0b928b13c140217facb1f2ec210fae7c3a41b009a9174
  - path: tmp/snow-crystal-t1-7/source-audit-capture/server.mjs
    hash: sha256:69bcf01d60a29062a6338d140e96c7d8003062e7cdc65438cab62ce8641f0d3a
  - path: tmp/snow-crystal-t1-7/source-audit-capture/source-audit-capture.test.mjs
    hash: sha256:25f5337c048bedbfef123617f7e40f4879966104b0f923d0e6738e61e8a5dbc0
  - path: tmp/snow-crystal-t1-7/source-audit-capture/styles.css
    hash: sha256:5e4fc0d5e96f062101c72600411331209d9a460de8aa3e0bf9ab7272301c1b07
  - path: tmp/snow-crystal-t1-7/source-audit-capture/synthetic-migration.fixture.mjs
    hash: sha256:f139099bc1557fcddc5dfb8e4c68805efd9c4b5905612181842c243217f3afb9
findings:
  - id: R-001
    severity: high
    location: tmp/snow-crystal-t1-7/source-audit-capture/server.mjs:1
    problem: 原資料として表示する4枚のpage rasterが、固定SHA-256のPDFから生成された画像であることを実行時に検証していない。
    evidence: >-
      app.js:66-73はpage番号からPNGの固定pathnameを組み立てるだけで、server.mjsはpathnameが正規表現に
      一致すれば任意のfile bytesをimage/pngとして返す。source-audit-capture.test.mjs:206も200応答と
      Content-Typeだけを検査するため、別の正常なPNGへ置換しても候補gate、server integration、画像decode、
      人間確認、exportが通り、exportには引き続き固定PDF hash
      20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af
      が記録される。独立計算した現在の4画像hashはpage 11から順に
      2354a7b5f79182ef4fd3debae6da006f8e940adc1b87ef2c75a249de0a77bb6d、
      ae75d6d5c1f2f63d6cb4fbbca7bb3a915ee92467dd613544afe8a9d870a927c4、
      dc09dc81664d87c03a8744d8777311c9db4483c9847dd2ba4e53f9af82bb41a2、
      96ecd9a7bf05fa430df7af9eb7ba96896b01f8da4e795ad4eaa310283cf2c654
      だが、これらを固定PDFからの検証済みrenderへ結び付けるmanifestまたはgateはrepository内に存在しない。
      したがって「同じhashの原PDF panelを全206件で目視する」というD-10/TESTCASES契約を保証できない。
    required_change: >-
      固定PDFのbytes hashを確認して承認済み条件で再renderした4 rasterについて、pageごとのSHA-256と
      pixel dimensionsを固定証跡として記録する。serverはlistenまたは配信前に4 fileのbytes hashと
      dimensionsを検証し、不一致なら候補を表示できないようfail closedにする。決定的テストでは4つの
      既知hashを独立に照合し、1 byte変更または別の正常PNGへの置換でserver/UI gateが停止することを検査する。
conditions: []
rollback_to: implementation
summary: >-
  過去3回のimplementation findingは解消されている。実添付をread-onlyで固定hash照合後に
  migrateLegacyからvalidateStateへ通し、33 entry、32 confirmed、blank P11-N033、128 pairのUTF-8 bytes・
  Unicode code unit・binary64 bits不一致0、A/B pair不一致0、移行ID hash一致を再現した。
  検証後のatomic 1 write、write失敗時の旧raw不変、v2 reload/save/export共通validator、
  action/domain/-0/PII、206 panel・824 field、JSDOM実app配線、画像load/paint/stale/failure、
  candidate mutation、export、127.0.0.1限定serverとmodule graph・拒否後生存は独立実行で成功した。
  9 JS/MJSの構文検査と決定的testもPASSし、A/B/comparison hash、618 exact、
  206 canonical-unit-equivalent、1648 pairの単位換算、page件数50/54/54/48を再現した。
  ただし、人間が確認する原画像自体が固定PDFへ暗号学的に結合されていないため、
  source-oracleの正しさを保証できず承認できない。
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

```yaml
review_type: implementation
status: changes-requested
reviewed_files:
  - path: tmp/snow-crystal-t1-7/source-audit-capture/app.js
    hash: sha256:27c6ee4f9ae4ce8151a5944cd50dd47dc8d29cfb6aa970dfcc9e31ea8413cf32
  - path: tmp/snow-crystal-t1-7/source-audit-capture/candidate-data.js
    hash: sha256:0d3bcacabfe8625e3c76f7d48bba3fb99280d48cac15c40cff5551f66d5e2c1e
  - path: tmp/snow-crystal-t1-7/source-audit-capture/generate-candidates.mjs
    hash: sha256:f859c405ced21b26b297332ed6589b3b02fadf7b1f1cde5b2b2002352c3df761
  - path: tmp/snow-crystal-t1-7/source-audit-capture/index.html
    hash: sha256:2c514925786527ef66aac92275051586983193dd9f0cc967780b066eac0c77ff
  - path: tmp/snow-crystal-t1-7/source-audit-capture/README.md
    hash: sha256:47905b4d6ab49dc626a9a074fb67fbecdaef6de26e86840e8e6c47e69d43f158
  - path: tmp/snow-crystal-t1-7/source-audit-capture/server.mjs
    hash: sha256:bc84d1ef554526f862f71b12593bc2a89c6a6cb2186135877b61400688ea0565
  - path: tmp/snow-crystal-t1-7/source-audit-capture/source-audit-capture.test.mjs
    hash: sha256:76171f06b34016b6d38853b68c439708d82a64887879da292d3e715638e7a760
  - path: tmp/snow-crystal-t1-7/source-audit-capture/styles.css
    hash: sha256:5e4fc0d5e96f062101c72600411331209d9a460de8aa3e0bf9ab7272301c1b07
findings:
  - id: R-001
    severity: critical
    location: tmp/snow-crystal-t1-7/source-audit-capture/app.js:1
    problem: version-1 LocalStorage migration is neither an exact preflight nor atomic, and a failed or partial load can overwrite the existing capture.
    evidence: migrate() does not verify the fixed backup byte hash, version, exact role, 33-entry/32-complete shape, incomplete P11-N033, migrated-ID-set hash, unit conversions, candidate agreement, unknown IDs, or the complete set before constructing version 2. Invalid entries are silently skipped while migration metadata still asserts the fixed source hash and entry count. load() converts any JSON parse exception to blank(), and initialization immediately calls save(), replacing the prior LocalStorage value. This violates TC-SOURCE-AUDIT-003's bit-for-bit unchanged-on-failure rule and can destroy the user's prior work.
    required_change: Preserve the exact original LocalStorage string, validate its UTF-8 SHA-256 and every fixed backup invariant before mutation, construct and verify the complete 32-entry migrated state in memory, and write version 2 only after all checks pass. On any failure, leave LocalStorage byte-for-byte unchanged, show a STOP state, and disable confirmation/export.
  - id: R-002
    severity: critical
    location: tmp/snow-crystal-t1-7/source-audit-capture/app.js:1
    problem: Candidates can be confirmed before the matching source panel is visible, and asynchronous image races can display a different panel from the current candidate.
    evidence: update() renders and enables candidate fields before calling renderCrop(), and does not await it. renderCrop() clears the canvas and awaits only newly created Image objects; a cached-but-still-loading image is drawn immediately, while an older asynchronous render may later paint over a newer navigation. There is no observation token or loaded-image identity check. Thus sourcePanelVisibleAt can be later than candidateVisibleAt, and rapid navigation can pair one panel image with another observation's fields.
    required_change: Load/decode and paint the exact observation crop before exposing or enabling its candidates, associate every render with an observation/navigation token, discard stale completions, await cached images that are still loading, and fail closed with confirmation controls disabled when the image cannot be displayed.
  - id: R-003
    severity: high
    location: tmp/snow-crystal-t1-7/source-audit-capture/app.js:1
    problem: The completion/export gate does not enforce the approved comparison/action/final-value state machine and can export false verification evidence.
    evidence: completeField() accepts any non-empty raw string and finite normalized number with a checked box. It does not require confirmed-proposal values to equal the frozen proposal, corrected-proposal values to differ and have valid unit conversion, resolved-disagreement for different comparisons, or preserved-prior-human-confirmation to originate from the migrated 32 entries. That preserved action is selectable on every new field. Raw/normalized unit consistency and -0 are not checked. validRationale() also misses required PII labels such as userId=, uid=, hostname=, computerName=, machine_id:, accountId=, and deviceName=. The exported migration evidence is hardcoded and omits the migrated ID-set hash, incomplete ID list, and originalVerificationTimeKnown.
    required_change: Gate export through one authoritative validator implementing the complete TC-SOURCE-AUDIT-004 action/final/rationale/unit matrix; restrict preserved action to immutable migrated records; implement the specified PII patterns; reject -0 and inconsistent raw/normalized pairs; and export migration evidence computed from the successfully validated migration, including the required ID-set hash and incomplete-ID metadata.
  - id: R-004
    severity: high
    location: tmp/snow-crystal-t1-7/source-audit-capture/source-audit-capture.test.mjs:1
    problem: The deterministic test does not exercise the actual application migration, LocalStorage, panel-display ordering, field state machine, or export gate.
    evidence: The test loads only candidate-data.js and uses separate simplified cmp(), migrate(), and gate() implementations. It checks one positive migrated entry and an empty gate, but never loads app.js. Consequently it passes while R-001 through R-003 remain present, and it does not cover the rejection/unchanged-state matrix required by TC-SOURCE-AUDIT-003/004. generate-candidates.mjs merely imports this same test.
    required_change: Test the actual shared application logic or execute app.js in a deterministic DOM/browser harness. Add mutation coverage for every migration rejection with unchanged LocalStorage, the complete 32-entry backup mapping, PDF readiness and stale-render races, all action/final/rationale combinations, PII labels, 824-field/role/hash export gating, clear confirmation, reload persistence, and exported evidence fields.
  - id: R-005
    severity: medium
    location: tmp/snow-crystal-t1-7/source-audit-capture/server.mjs:6
    problem: The tool described as local-only binds without a loopback host and serves the entire tmp directory rather than only required capture assets.
    evidence: listen(port) uses the unspecified network address, while root resolves to repository tmp. An independent request successfully retrieved /snow-crystal-t1-7/source-extraction-a.json through this server even though it is outside source-audit-capture. Other files under tmp are likewise reachable to any network peer able to connect.
    required_change: Bind explicitly to 127.0.0.1 or ::1 and allowlist only the capture application files plus the four required raster images, rejecting every other path.
conditions: []
rollback_to: implementation
summary: Candidate integrity checks themselves were reproducible: both frozen originals and the bundle contain 206 matching observations, the independently recomputed hashes are de2d1e32eed414f020c1be76fc82b2209848da2b399aa1f00c96ecb55638f732, b641538a2344cb348e62532cb6e48aaf3b9b5cf236fd703a51a7f1b3d9cdcfd3, and 33c545adebfae122fea0d84985445f60eeb7f17ed1e0e9ba2cb99d7a34b6bad9, with 618 exact, 206 canonical-unit-equivalent, and 0 different fields. All 1,648 A/B raw-to-normalized unit checks passed, syntax and the current deterministic test passed, the generator left both originals unchanged, and the supplied backup independently reproduced its fixed hash, 33/32 counts, P11-N033 incompleteness, and migrated-ID-set hash. Approval is blocked because migration can destroy prior data, source images are not reliably paired before confirmation, invalid field evidence can be exported, and the tests do not detect these failures.
```

```yaml
review_type: implementation
status: changes-requested
reviewed_files:
  - path: tmp/snow-crystal-t1-7/source-audit-capture/README.md
    hash: sha256:47905b4d6ab49dc626a9a074fb67fbecdaef6de26e86840e8e6c47e69d43f158
  - path: tmp/snow-crystal-t1-7/source-audit-capture/app.js
    hash: sha256:784ebf8cfcd00d5a4214c23938799422bae9ec9b66f9164adf010a511a34a2d0
  - path: tmp/snow-crystal-t1-7/source-audit-capture/candidate-data.js
    hash: sha256:0d3bcacabfe8625e3c76f7d48bba3fb99280d48cac15c40cff5551f66d5e2c1e
  - path: tmp/snow-crystal-t1-7/source-audit-capture/core.mjs
    hash: sha256:6099d94f330f313165be35551f2a9976f1e9947189a2bd7daff7869db04fa13e
  - path: tmp/snow-crystal-t1-7/source-audit-capture/generate-candidates.mjs
    hash: sha256:f859c405ced21b26b297332ed6589b3b02fadf7b1f1cde5b2b2002352c3df761
  - path: tmp/snow-crystal-t1-7/source-audit-capture/index.html
    hash: sha256:2eeeb1a5a851aad4a603900580fbec01774bd9f11b2c20d42391c07c11d1616f
  - path: tmp/snow-crystal-t1-7/source-audit-capture/server.mjs
    hash: sha256:fe4e7a57c64543feefbd044f652191cfe4c3e71bb312f58c60bbd1dc5907a980
  - path: tmp/snow-crystal-t1-7/source-audit-capture/source-audit-capture.test.mjs
    hash: sha256:16eed28c90f51efcbd13f8a3d164737a16658a6c37342e50bcfee9411af8340e
  - path: tmp/snow-crystal-t1-7/source-audit-capture/styles.css
    hash: sha256:5e4fc0d5e96f062101c72600411331209d9a460de8aa3e0bf9ab7272301c1b07
findings:
  - id: R-001
    severity: critical
    location: tmp/snow-crystal-t1-7/source-audit-capture/core.mjs:9
    problem: 固定hashと一致する実LocalStorage backupを移行できない。
    evidence: >-
      SHA-256が9fd9708029f553e386dfd2dece8df5f8237d5c8b586502d90bfbe93b8bb47f0cの
      ユーザー再取得backupは、P11-N033を9個の既定propertyを持つblank/incomplete entryとして保存している。
      migrateLegacyはP11-N033にpropertyが一つでもあれば
      "P11-N033 must be blank"で拒否するため、この固定backupを独立実行すると必ず失敗した。
      テストは実際の形ではなくP11-N033={}を生成しているため欠陥を検出しない。
    required_change: >-
      P11-N033について、実backupどおり4 raw空文字、4 normalized null、confirmed=falseの
      完全schemaだけをblank/incompleteとして受理し、それ以外の形は拒否する。
      実backupと同形のtest-local fixtureで33件、32 complete、P11-N033未完了、固定hash gate後の
      32件無改変移行を検証する。
  - id: R-002
    severity: high
    location: tmp/snow-crystal-t1-7/source-audit-capture/core.mjs:7
    problem: exportで使うvalidatorが承認済みaction表、source domain、PII規則、既存32件の真正性を完全には強制しない。
    evidence: >-
      validateFieldはproposalと同値のcorrected-proposalを受理し、growthTime="-1sec"/-1も受理する。
      validRationaleはaccount_id、user_id、device_nameの必須禁止labelを検出しない。
      preserved=trueならbackup pairとのbytes/bits一致を確認せず、例えばtemperature="999C"/999でも
      preserved-prior-human-confirmationとして受理する。さらにapp.js:3はversion 2状態を
      entries objectの存在だけで信頼し、unknown propertyを含む改変状態も再検証しないため、
      app.js:6のexport gateを偽造済みまたは壊れた保存状態が通過し得る。
    required_change: >-
      comparison/proposalまたは固定backup pairへ結合した単一のauthoritative validatorを作り、
      confirmed/corrected/resolved/preservedの全action条件、correctedとproposalの差、
      growthTime/FOVの正値を含むsource grammar/domain、-0、指定された全PII labelとschema外propertyを
      検証する。version 2再読込時とexport直前にも206 ID、824 field、保存schema、移行32件の
      backup一致と不変性を同じvalidatorで検証する。
  - id: R-003
    severity: high
    location: tmp/snow-crystal-t1-7/source-audit-capture/source-audit-capture.test.mjs:1
    problem: deterministic testが実アプリのLocalStorage、画像workflow、完全なaction/export gateを検証していない。
    evidence: >-
      テストはcore.mjsだけを直接呼び、app.jsを読み込まない。固定backupではなく期待hashを引数で差し替えた
      簡略fixtureを使い、移行拒否行列、1回だけのatomic write、失敗時のstorage byte不変、
      version 2再読込、32件全値、824 field、全action分岐、PII全形式、-0、保存・再読込、
      sourcePanelVisibleAt順序、stale image completion、画像失敗、export内容を検査しない。
      現テストはPASSする一方で、R-001とR-002の反例はいずれも到達した。
    required_change: >-
      appとtestが同じ共有production logicを通る構造を維持しつつ、実backup同形fixtureによる全移行条件と
      atomic LocalStorage adapter、206×4 workflow、action matrix、PII、domain、reload、exportを検査する。
      DOM/browser harnessまたは等価な注入可能境界で、画像decode/draw完了前のcontrols無効、
      navigation tokenによるstale破棄、画像失敗時STOPも決定的に検査する。
  - id: R-004
    severity: medium
    location: tmp/snow-crystal-t1-7/source-audit-capture/server.mjs:1
    problem: malformed percent-encoded pathが403/400で拒否されずローカルサーバーを終了させる。
    evidence: >-
      通常allowlist、4 raster、source-extraction拒否、encoded traversal拒否、127.0.0.1 bindは確認できた。
      しかし/%ZZを要求するとtry外のdecodeURIComponentがURIErrorを投げ、Node processはexit code 1で終了した。
    required_change: >-
      URL解析とdecodeを例外処理内へ置き、不正encodingを400または403で終了させる。
      allowlist外・encoded traversal・malformed encodingの各要求後もserverが稼働していることをテストする。
conditions: []
rollback_to: implementation
summary: >-
  全対象ファイルの構文と現行共有テストは成功した。独立再計算でも候補206件、A/B/comparisonの既知hash、
  exact 618、canonical-unit-equivalent 206、different 0、A/B計1648 pairの単位換算不一致0、
  page件数50/54/54/48を再現した。画像経路は候補を消してからcached pending loadをawaitし、
  navigation tokenでstale completionを破棄し、draw後にだけmountする形へ改善されている。
  serverも127.0.0.1 bind、アプリallowlist、4 raster限定、source-extractionとencoded traversalの拒否を確認した。
  ただし固定hashの実backup自体を移行できず、最終validatorとテストに承認済み契約を通過させる穴が残るため、
  implementation gateは承認できない。
```

```yaml
review_type: implementation
status: changes-requested
reviewed_files:
  - path: tmp/snow-crystal-t1-7/source-audit-capture/app.js
    hash: sha256:90a8735549b389b37e5919fc328fc1188541fabfe391b8d6bc592847af7dade6
  - path: tmp/snow-crystal-t1-7/source-audit-capture/candidate-data.js
    hash: sha256:0d3bcacabfe8625e3c76f7d48bba3fb99280d48cac15c40cff5551f66d5e2c1e
  - path: tmp/snow-crystal-t1-7/source-audit-capture/core.mjs
    hash: sha256:89a61bdc1af4ced5ebaeceb1d2876004c762d61da6d0cd2aa3783243599f5068
  - path: tmp/snow-crystal-t1-7/source-audit-capture/generate-candidates.mjs
    hash: sha256:f859c405ced21b26b297332ed6589b3b02fadf7b1f1cde5b2b2002352c3df761
  - path: tmp/snow-crystal-t1-7/source-audit-capture/index.html
    hash: sha256:2eeeb1a5a851aad4a603900580fbec01774bd9f11b2c20d42391c07c11d1616f
  - path: tmp/snow-crystal-t1-7/source-audit-capture/pdf-controller.mjs
    hash: sha256:103649d119df1f365eb7df60d715c51fa53242624bbe320f1b91acdec713e908
  - path: tmp/snow-crystal-t1-7/source-audit-capture/README.md
    hash: sha256:47905b4d6ab49dc626a9a074fb67fbecdaef6de26e86840e8e6c47e69d43f158
  - path: tmp/snow-crystal-t1-7/source-audit-capture/server.mjs
    hash: sha256:91b22d35568519ce0bcb8be8d06813197bab8bf01b14e13df4c5c8f4e415498a
  - path: tmp/snow-crystal-t1-7/source-audit-capture/source-audit-capture.test.mjs
    hash: sha256:7dc1b74818e5825b597b823f94a5c463972902725a0af2b9146730217e5bf7d4
  - path: tmp/snow-crystal-t1-7/source-audit-capture/styles.css
    hash: sha256:5e4fc0d5e96f062101c72600411331209d9a460de8aa3e0bf9ab7272301c1b07
findings:
  - id: R-001
    severity: critical
    location: tmp/snow-crystal-t1-7/source-audit-capture/core.mjs:8
    problem: 固定hashの実バックアップから生成したv2状態をauthoritative validator自身が拒否する一方、appは検証前にその状態で旧LocalStorageを上書きする。
    evidence: >-
      SHA-256 9fd9708029f553e386dfd2dece8df5f8237d5c8b586502d90bfbe93b8bb47f0c
      の実添付をmigrateLegacyへ入力すると33件中32件をbyte/bit不一致0で移行できたが、
      validateStateはL23-F2-P11-N021..N032の12件のsquareFieldOfViewをv2 fieldとして拒否した。
      実バックアップはこの12件でU+03BCのrawを保持しA候補と一致するが、validateFieldのpreserved分岐は
      全32件を候補Bとだけ照合している。app.js:3はmigrateLegacy後にvalidateStateを実行せず、
      state=migrated; save()で同じkeyへ書くため、固定v1文字列は無効なv2で置換される。
      保存済みfieldは画面上immutableなので修復できず、exportまたは次回reloadでSTOPする。
    required_change: >-
      preserved fieldを固定バックアップの各raw byte列・normalized binary64 bitsそのものへ結合し、
      AまたはBのどちらと一致したかに依存せず32件を再検証する。移行結果全体を同じauthoritative validatorで
      検証してから、LocalStorageへ一度だけatomic writeする。検証またはwrite失敗時は旧文字列を
      byte-for-byte保持する。
  - id: R-002
    severity: high
    location: tmp/snow-crystal-t1-7/source-audit-capture/core.mjs:8
    problem: v2再読込・export用validatorが承認済みaction表、移行証跡、PDF表示状態を完全には強制しない。
    evidence: >-
      独立反例でcomparison=differentのfieldへaction=corrected-proposalを指定してもvalidateFieldがtrueとなったが、
      TESTCASESのaction表ではdifferentに許されるのはresolved-disagreementだけである。また206件全てに
      sourcePanelInspected=true、sourcePanelVisibleAt=null、migration=nullを設定した状態が
      validateState(...,{complete:true})を通過した。さらに有効なsynthetic移行状態の
      migration.sourceKindをwrong、entryObjectCountを999へ変えてもvalidateStateがtrueだった。
      したがって改変したv2 LocalStorageから、固定バックアップ証跡や実際のpanel表示を欠く824-field captureを
      完成扱いにできる。
    required_change: >-
      単一のauthoritative validatorでcomparisonごとのactionを表どおり限定し、固定移行証跡の全定数、
      32件の保存pair、206 ID・824 field、schema外property、sourcePanel表示完了の証跡を検査する。
      固定バックアップを使う本workflowではmigration=nullを完成状態として拒否し、v2 reload時とexport直前に
      同じ検証を実行する。
  - id: R-003
    severity: high
    location: tmp/snow-crystal-t1-7/source-audit-capture/server.mjs:1
    problem: ローカルサーバーがapp.jsの必須moduleであるpdf-controller.mjsを配信しないため、実画面が起動できない。
    evidence: >-
      app.js:1は./pdf-controller.mjsをstatic importするが、serverのallowlistに同fileがない。
      実サーバーへindex.htmlとapp.jsを要求すると200、pdf-controller.mjsは403となった。
      そのためブラウザーはmodule graphを読み込めず、候補hash gate、LocalStorage移行、PDF表示、
      STOP処理のいずれも開始できない。
    required_change: >-
      pdf-controller.mjsをcapture applicationの限定allowlistへ追加し、index.htmlから辿れる全module graphが
      200で解決することをserver integrationで検査する。tmp内のその他のfileは引き続き拒否する。
  - id: R-004
    severity: high
    location: tmp/snow-crystal-t1-7/source-audit-capture/source-audit-capture.test.mjs:1
    problem: 現行テストは実バックアップ同形fixture、appの保存・再読込・export配線、実serverのmodule graphを通さないため、R-001からR-003を検出できない。
    evidence: >-
      テストは32件全ての値を候補Bから生成するため、実バックアップ後半12件のU+03BC rawを再現せず、
      migrateLegacy後のvalidateState不一致を隠している。app.jsを実行せず、LocalStorageのwrite回数・失敗時不変、
      v2 reload、export gateも検査しない。PdfPanelControllerは単体でstale/failureを検査するだけで、
      appの実配線を通らない。server integrationもpdf-controller.mjsを要求しないため、テスト全体はPASSしても
      実画面の必須moduleが403である。
    required_change: >-
      外部添付をapp/test依存にはせず、実バックアップと同じ33-entry schemaおよび32件の混在mu rawを持つ
      test-local fixtureを用意する。共有production経路でhash後の完全移行、検証後のatomic one-write、
      全拒否時のstorage不変、v2 reload、action表、206×4 completion、export内容を検査する。
      注入可能DOM/storage境界または決定的browser harnessでappのPDF controller配線を実行し、
      server testではindexから辿る全moduleを要求する。
conditions: []
rollback_to: implementation
summary: >-
  implementation gateは未承認。全JS/MJSの構文検査と現行共有テストは成功した。独立再計算では候補206件、
  page件数50/54/54/48、A/B/comparison hash
  de2d1e32eed414f020c1be76fc82b2209848da2b399aa1f00c96ecb55638f732、
  b641538a2344cb348e62532cb6e48aaf3b9b5cf236fd703a51a7f1b3d9cdcfd3、
  33c545adebfae122fea0d84985445f60eeb7f17ed1e0e9ba2cb99d7a34b6bad9、
  exact 618、canonical-unit-equivalent 206、different 0、A/B計1648 pairの単位換算不一致0を再現した。
  pdf-controller自体はdecode/loadとpaint完了前にreadyを呼ばず、tokenでstale完了を破棄し、failure時はfailへ進む。
  serverもmalformed percentを400、encoded traversalとallowlist外を403とした後も200応答を継続した。
  しかし固定実バックアップ移行後の状態がvalidatorと矛盾して旧保存を上書きし得ること、
  export validatorの迂回、必須moduleの配信漏れ、およびそれらを検出しないテストが残る。
```

```yaml
review_type: implementation
status: approved
reviewed_files:
  - path: tmp/snow-crystal-t1-7/source-audit-capture/app.js
    hash: sha256:2abf3ee49a9e4c5305ac7d6f5c5a031badcb69f3f1f136e179c870a38d5588de
  - path: tmp/snow-crystal-t1-7/source-audit-capture/candidate-data.js
    hash: sha256:0d3bcacabfe8625e3c76f7d48bba3fb99280d48cac15c40cff5551f66d5e2c1e
  - path: tmp/snow-crystal-t1-7/source-audit-capture/core.mjs
    hash: sha256:a572e5f94edda9b8809184cfebb7a77806d4b7f6bc19c4fc5cfa4074c6cda2ba
  - path: tmp/snow-crystal-t1-7/source-audit-capture/generate-candidates.mjs
    hash: sha256:f859c405ced21b26b297332ed6589b3b02fadf7b1f1cde5b2b2002352c3df761
  - path: tmp/snow-crystal-t1-7/source-audit-capture/index.html
    hash: sha256:2eeeb1a5a851aad4a603900580fbec01774bd9f11b2c20d42391c07c11d1616f
  - path: tmp/snow-crystal-t1-7/source-audit-capture/pdf-controller.mjs
    hash: sha256:103649d119df1f365eb7df60d715c51fa53242624bbe320f1b91acdec713e908
  - path: tmp/snow-crystal-t1-7/source-audit-capture/prior-pairs.mjs
    hash: sha256:1318e78713420c6108a0b928b13c140217facb1f2ec210fae7c3a41b009a9174
  - path: tmp/snow-crystal-t1-7/source-audit-capture/raster-integrity.mjs
    hash: sha256:86b6368ae417dd4da19a634b6b64da4e71db39daf5fa9a119cb5cafba5872dbf
  - path: tmp/snow-crystal-t1-7/source-audit-capture/raster-integrity.test.mjs
    hash: sha256:caa784056282b33b7c4bb9d5263419a935ea8c2ba0d52828b7cb787ed85383b6
  - path: tmp/snow-crystal-t1-7/source-audit-capture/raster-manifest.mjs
    hash: sha256:748e976f91ef006838f0b8f1c778a123870cdd8ffbdf56e41f22b49ba4752571
  - path: tmp/snow-crystal-t1-7/source-audit-capture/README.md
    hash: sha256:5749854d09a264a24de2cbc4e9966036306580a9013318157c06d9f8c2b08b6c
  - path: tmp/snow-crystal-t1-7/source-audit-capture/server.mjs
    hash: sha256:51942a8e19f4d137c205c2fa614d9da8cfed29c9f4b0af1d59929cc141a1e5d9
  - path: tmp/snow-crystal-t1-7/source-audit-capture/source-audit-capture.test.mjs
    hash: sha256:25f5337c048bedbfef123617f7e40f4879966104b0f923d0e6738e61e8a5dbc0
  - path: tmp/snow-crystal-t1-7/source-audit-capture/styles.css
    hash: sha256:5e4fc0d5e96f062101c72600411331209d9a460de8aa3e0bf9ab7272301c1b07
  - path: tmp/snow-crystal-t1-7/source-audit-capture/synthetic-migration.fixture.mjs
    hash: sha256:f139099bc1557fcddc5dfb8e4c68805efd9c4b5905612181842c243217f3afb9
  - path: tmp/snow-crystal-t1-7/source-audit-capture/verify-raster-provenance.mjs
    hash: sha256:17af3049f801d532a0e1f8eb1b2cfebfae42402797aa3c1bd5f688e74c09370a
  - path: tmp/snow-crystal-t1-7/source-2306.13087v1.pdf
    hash: sha256:20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af
  - path: tmp/pdfs/snow-crystal-t1-7/page-11-600dpi.png
    hash: sha256:2354a7b5f79182ef4fd3debae6da006f8e940adc1b87ef2c75a249de0a77bb6d
  - path: tmp/pdfs/snow-crystal-t1-7/page-12-600dpi.png
    hash: sha256:ae75d6d5c1f2f63d6cb4fbbca7bb3a915ee92467dd613544afe8a9d870a927c4
  - path: tmp/pdfs/snow-crystal-t1-7/page-13-600dpi.png
    hash: sha256:dc09dc81664d87c03a8744d8777311c9db4483c9847dd2ba4e53f9af82bb41a2
  - path: tmp/pdfs/snow-crystal-t1-7/page-14-600dpi.png
    hash: sha256:96ecd9a7bf05fa430df7af9eb7ba96896b01f8da4e795ad4eaa310283cf2c654
findings: []
conditions: []
rollback_to: none
summary: >-
  一時source-audit確認ツールの直前R-001は解消された。
  独立実行したverify-raster-provenance.mjsは固定PDFの12,317,042 bytesと指定SHA-256、
  Node 24.14.1、pdfjs-dist 6.3.289、@napi-rs/canvas 1.0.6を確認し、
  承認済み600 dpi・crop-box・PDF rotation・display・annotation無効・system font/eval無効・
  白背景・sRGB条件でpage 11–14をメモリへ再renderした。
  全4枚が5100×6601で、manifest記載PNGとbyte-for-byte一致し、終了コード0だった。
  serverは全4枚のhash・dimensions・RGBA8 headerを検証するまでserver/socketを作成せず、
  配信には同じ検証済み独立Buffer snapshotだけを使う。
  raster-integrity.test.mjsの既知hash照合、1 byte改変、同寸法の別正常PNGへの置換、
  missing/dimension異常のpre-listen拒否、検証後caller buffer変更からの配信保護が独立実行でPASSした。
  source-audit-capture.test.mjsもPASSし、33/32件の混在mu移行、128 pairのbytes/bits保持、
  検証後atomic one-write、失敗時storage不変、v2 reload、action/unit/-0/PII、
  206 panel・824 field完成とexport、実app DOM/PDF readiness、
  localhost限定serverの全module graphと拒否後生存が維持されている。
  13 JS/MJSの構文検査も成功した。
  独立再計算したA/B/comparison hash、618 exact・206 canonical-unit-equivalent、
  page件数50/54/54/48は固定契約と一致する。
  全読取り対象をscripts/hash-files.mjsでhashした。
  本承認は一時確認ツールに限定され、原資料の人間全件確認、
  最終SOURCE-AUDIT・corpus完成、注釈承認またはT1-7全体の完了を意味しない。
```

```yaml
review_type: implementation
status: changes-requested
reviewed_files:
  - path: AGENTS.md
    hash: sha256:3318d6489da13b50fa38756529d24e5b30ec30a46aa4538a531c7f9c93edf160
  - path: .agents/skills/simulator-review/SKILL.md
    hash: sha256:b83713167175991fcd6614a19c39319a071c77eb0976840f23e38e250d49639e
  - path: .agents/skills/simulator-review/references/review-schema.md
    hash: sha256:6f68a8261fce196387be2d8aa8dce8674a1b03670b5754ed7402028c6d9f8104
  - path: apps/snow-crystal-sim/AGENTS.md
    hash: sha256:e823a1daf8e876e917a7875a8c166ea350f311dd42cf748dc8d4fded8972c747
  - path: docs/agent-architecture-codex.md
    hash: sha256:ff01e1071a3732a06d27d1b768a5ba762e421d3aaddc5b65d9ec65f9a015ddd2
  - path: docs/simulators/snow-crystal-sim/SPEC.md
    hash: sha256:92c0ee8ad1fd22f31915bac66f6369b155072ce70dd725078bfcb5f1f3eaedd1
  - path: docs/simulators/snow-crystal-sim/DESIGN-OUTLINE.md
    hash: sha256:b0aecd2dd517e810913d44e93fea02aa6f50dc56398ef5ee046d9ca514bc68ff
  - path: docs/simulators/snow-crystal-sim/TASKS.md
    hash: sha256:6b8205edc58b83ecb29039d4017461cff53db78390bb9faa99c2672de637cab4
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:db91dbcb45221a9da3ff4316f78c7432ae0a1f322dcbd2bbb8d7f8808ac90610
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:31087002d9b47b0e5bdcb0be69bb3d62c9aab6d4be664b250523985d788d2b2b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:0a7b1e21a8ef153c21fee319d89dd9731067e8a1518e255d7ec165500d95f0a8
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/EVIDENCE.md
    hash: sha256:01f6fae8bf399871ec62dab7969649e3acff5c7a39982cb96ce8ca484202a3c0
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/REVIEW.md
    hash: sha256:753f9a81eb8260e4d74f8e8bc44d48737793f413620b1eab52d90e2c4f2509d4
  - path: tmp/snow-crystal-t1-7/source-audit-capture/legacy-restore.mjs
    hash: sha256:1a58845402b1c92babaa6a1f0f2acffa30bad619320f1a3a5503e0c3b453a769
  - path: tmp/snow-crystal-t1-7/source-audit-capture/restore-app.js
    hash: sha256:a15e8ce218935bc24c685208310358bed693626e374740aa78066152d58eeb98
  - path: tmp/snow-crystal-t1-7/source-audit-capture/restore.html
    hash: sha256:50494ac06eba2c02ce245de663c1441af2b279f040602364f61b6a6ef2e558ac
  - path: tmp/snow-crystal-t1-7/source-audit-capture/legacy-restore.test.mjs
    hash: sha256:e00693a742cf1dd4d103926837d98a0a0eda7884da928394886e0a31ca4e77fa
  - path: tmp/snow-crystal-t1-7/source-audit-capture/server.mjs
    hash: sha256:85f38770a033dde2c6537399be6df2e3a625aca67c41faa08be347f584e54438
  - path: tmp/snow-crystal-t1-7/source-audit-capture/README.md
    hash: sha256:511853e83832cb24d262b15d46c7e087ef83dfb5447a6c566ab4283bdd2ace04
  - path: tmp/snow-crystal-t1-7/source-audit-capture/core.mjs
    hash: sha256:a572e5f94edda9b8809184cfebb7a77806d4b7f6bc19c4fc5cfa4074c6cda2ba
  - path: tmp/snow-crystal-t1-7/source-audit-capture/app.js
    hash: sha256:2abf3ee49a9e4c5305ac7d6f5c5a031badcb69f3f1f136e179c870a38d5588de
  - path: tmp/snow-crystal-t1-7/source-audit-capture/raster-integrity.mjs
    hash: sha256:86b6368ae417dd4da19a634b6b64da4e71db39daf5fa9a119cb5cafba5872dbf
  - path: tmp/snow-crystal-t1-7/source-audit-capture/raster-integrity.test.mjs
    hash: sha256:caa784056282b33b7c4bb9d5263419a935ea8c2ba0d52828b7cb787ed85383b6
  - path: tmp/snow-crystal-t1-7/source-audit-capture/source-audit-capture.test.mjs
    hash: sha256:25f5337c048bedbfef123617f7e40f4879966104b0f923d0e6738e61e8a5dbc0
findings:
  - id: R-001
    severity: high
    location: tmp/snow-crystal-t1-7/source-audit-capture/legacy-restore.mjs:28
    problem: >-
      Current-state equivalence accepts invalid non-finite values in the intentionally
      blank P11-N033 record and consequently overwrites unexpected current state.
    evidence: >-
      Independently replaced the trusted JSON's first "temperatureC": null with
      "temperatureC": 1e999. JSON.parse produces Infinity, but canonical(current)
      serializes Infinity as null, making it equal to the trusted blank record.
      currentIsEquivalentV1 returned true; controller.prepare and controller.restore
      both returned ok:true, and injected storage recorded one write. P11-N033 must
      contain literal null normalized fields, and unexpected current state must be
      rejected with zero writes. Existing restore tests pass without exercising this case.
    required_change: >-
      Reject invalid current-state values before canonical comparison, or use a recursive
      schema-aware equality check that preserves primitive types and distinguishes null
      from non-finite numbers. Apply the same check at preparation and immediately before
      writing. Add regression coverage for positive and negative overflow numbers in all
      four P11-N033 normalized fields, including mutation after successful preparation;
      require refusal, zero writes, unchanged stored bytes, and zero navigation.
conditions: []
rollback_to: implementation
summary: >-
  Independently ran legacy-restore.test.mjs, source-audit-capture.test.mjs, and
  raster-integrity.test.mjs successfully. Syntax checks passed for legacy-restore.mjs,
  restore-app.js, legacy-restore.test.mjs, server.mjs, core.mjs, and app.js.
  Trusted backup validation confirms the fixed SHA-256, 10774 UTF-8 bytes, 33 entries,
  32 confirmations, and blank P11-N033. Normal LF-equivalent restoration, explicit-click
  wiring, one-write success, readback verification, write failure, and v2 refusal work.
  Existing app/core hashes remain identical to their approved versions. Localhost binding,
  raster preflight, immutable snapshot serving, and restricted asset allowlist remain intact.
  However, the independently reproduced non-finite-to-null equivalence permits a prohibited
  write, so the restore implementation is not approved. All listed files were hashed with
  scripts/hash-files.mjs. No files or real browser LocalStorage were modified.
```

```yaml
review_type: implementation
status: approved
reviewed_files:
  - path: AGENTS.md
    hash: sha256:3318d6489da13b50fa38756529d24e5b30ec30a46aa4538a531c7f9c93edf160
  - path: .agents/skills/simulator-review/SKILL.md
    hash: sha256:b83713167175991fcd6614a19c39319a071c77eb0976840f23e38e250d49639e
  - path: .agents/skills/simulator-review/references/review-schema.md
    hash: sha256:6f68a8261fce196387be2d8aa8dce8674a1b03670b5754ed7402028c6d9f8104
  - path: apps/snow-crystal-sim/AGENTS.md
    hash: sha256:e823a1daf8e876e917a7875a8c166ea350f311dd42cf748dc8d4fded8972c747
  - path: docs/agent-architecture-codex.md
    hash: sha256:ff01e1071a3732a06d27d1b768a5ba762e421d3aaddc5b65d9ec65f9a015ddd2
  - path: docs/simulators/snow-crystal-sim/SPEC.md
    hash: sha256:92c0ee8ad1fd22f31915bac66f6369b155072ce70dd725078bfcb5f1f3eaedd1
  - path: docs/simulators/snow-crystal-sim/DESIGN-OUTLINE.md
    hash: sha256:b0aecd2dd517e810913d44e93fea02aa6f50dc56398ef5ee046d9ca514bc68ff
  - path: docs/simulators/snow-crystal-sim/TASKS.md
    hash: sha256:6b8205edc58b83ecb29039d4017461cff53db78390bb9faa99c2672de637cab4
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:db91dbcb45221a9da3ff4316f78c7432ae0a1f322dcbd2bbb8d7f8808ac90610
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:31087002d9b47b0e5bdcb0be69bb3d62c9aab6d4be664b250523985d788d2b2b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:0a7b1e21a8ef153c21fee319d89dd9731067e8a1518e255d7ec165500d95f0a8
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/EVIDENCE.md
    hash: sha256:01f6fae8bf399871ec62dab7969649e3acff5c7a39982cb96ce8ca484202a3c0
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/REVIEW.md
    hash: sha256:67979bccd6ded10608e8b10994ab3d064025d674c69311c862d573b50fb5043a
  - path: tmp/snow-crystal-t1-7/source-audit-capture/legacy-restore.mjs
    hash: sha256:afc2cb68bab782218c2da564c24b8b5161f2c462f38dc5be5ce72a9dc7e24050
  - path: tmp/snow-crystal-t1-7/source-audit-capture/restore-app.js
    hash: sha256:a15e8ce218935bc24c685208310358bed693626e374740aa78066152d58eeb98
  - path: tmp/snow-crystal-t1-7/source-audit-capture/restore.html
    hash: sha256:50494ac06eba2c02ce245de663c1441af2b279f040602364f61b6a6ef2e558ac
  - path: tmp/snow-crystal-t1-7/source-audit-capture/legacy-restore.test.mjs
    hash: sha256:1f364487245a9a545257d03932544dcfda9506b633fc963af5c8f2c2cfe9cde2
  - path: tmp/snow-crystal-t1-7/source-audit-capture/server.mjs
    hash: sha256:85f38770a033dde2c6537399be6df2e3a625aca67c41faa08be347f584e54438
  - path: tmp/snow-crystal-t1-7/source-audit-capture/README.md
    hash: sha256:511853e83832cb24d262b15d46c7e087ef83dfb5447a6c566ab4283bdd2ace04
  - path: tmp/snow-crystal-t1-7/source-audit-capture/core.mjs
    hash: sha256:a572e5f94edda9b8809184cfebb7a77806d4b7f6bc19c4fc5cfa4074c6cda2ba
  - path: tmp/snow-crystal-t1-7/source-audit-capture/app.js
    hash: sha256:2abf3ee49a9e4c5305ac7d6f5c5a031badcb69f3f1f136e179c870a38d5588de
  - path: tmp/snow-crystal-t1-7/source-audit-capture/candidate-data.js
    hash: sha256:0d3bcacabfe8625e3c76f7d48bba3fb99280d48cac15c40cff5551f66d5e2c1e
  - path: tmp/snow-crystal-t1-7/source-audit-capture/raster-integrity.mjs
    hash: sha256:86b6368ae417dd4da19a634b6b64da4e71db39daf5fa9a119cb5cafba5872dbf
  - path: tmp/snow-crystal-t1-7/source-audit-capture/raster-integrity.test.mjs
    hash: sha256:caa784056282b33b7c4bb9d5263419a935ea8c2ba0d52828b7cb787ed85383b6
  - path: tmp/snow-crystal-t1-7/source-audit-capture/raster-manifest.mjs
    hash: sha256:748e976f91ef006838f0b8f1c778a123870cdd8ffbdf56e41f22b49ba4752571
  - path: tmp/snow-crystal-t1-7/source-audit-capture/source-audit-capture.test.mjs
    hash: sha256:25f5337c048bedbfef123617f7e40f4879966104b0f923d0e6738e61e8a5dbc0
  - path: scripts/hash-files.mjs
    hash: sha256:b20b691bb7bad6107b7de817f876cd566f95bc1c78305dcae4c85ed296f92295
findings: []
conditions: []
rollback_to: none
summary: >-
  Prior R-001 is resolved. Recursive equality preserves primitive types and rejects
  non-finite numbers instead of serializing them as null. Independent probes covered
  positive and negative JSON overflow in all four P11-N033 normalized fields at
  preparation and after successful preparation immediately before writing: all 16
  cases refused with zero writes, unchanged stored bytes, and zero navigation.
  Independent getItem-failure probes at both gates also refused with zero writes,
  unchanged bytes, and zero navigation. Trusted UTF-8 bytes independently reproduce
  SHA-256 9fd9708029f553e386dfd2dece8df5f8237d5c8b586502d90bfbe93b8bb47f0c
  and length 10774; schema validation confirms 33 entries, 32 confirmations, and
  intentionally blank P11-N033. LF/CRLF semantic equivalence, explicit-click wiring,
  one exact write, readback verification before navigation, repeated-click refusal,
  missing/partial/v2 rejection, write failure, and tampered readback pass.
  Independently executed syntax checks for legacy-restore.mjs, restore-app.js,
  legacy-restore.test.mjs, server.mjs, core.mjs, and app.js, plus all three restore,
  source-audit-capture, and raster-integrity suites successfully. Restricted asset
  serving, localhost binding, malformed-path refusal, raster verification before
  server creation, and serving only verified byte snapshots remain intact.
  Main app/core hashes match their previously approved versions. All listed files
  were hashed with scripts/hash-files.mjs. No files or real browser LocalStorage
  were modified; approval covers this temporary restore implementation only.
```
## 複数AI形態注釈プロトコル草案 限定修正レビュー（2026-10-15）

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.md
    hash: sha256:fcfa38879c41ef626a16ab953977e5a29d6f1f809d676c50a4cbb1087a7ad097
findings: []
conditions: []
rollback_to: none
summary: "限定修正3点を独立再検証した。hollowingは243組中93組（sufficient 46、limited 46、not-visible 1）だけが合法で、指定されたclear/clear/clearかつ帰属uncertainを含め全合法組が重複なく一意のlabelへ写像される。3種のRGBA hashはwidth/heightのuint32 little-endianと規定layoutのRGBA bytesを共通preimageとし、対応dimension検証および承認済みrasterization objectのLFなしJCS hash一致を要求している。ImageTransportEvidenceは27状態中3状態だけを有効とし、包含recordのderivative hash一致、共通RGBA preimage、not-exposed runの停止・全後続処理からの除外を一貫して規定している。非規範性、現行DESIGN/D-03の権威、人間承認、artifact DAGにも回帰はない。"
```
```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.md
    hash: sha256:a8f3f7935e169def302d5c633ea48661168776b25b4fb3b9decac35bc376e5d7
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/PILOT-RUNBOOK.md
    hash: sha256:ed0360cac17f13c4b3f1964207dae601d0ac83377cbf2dfbd021d7eb23f0f9e7
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:7d27341534f87424e4da06b991471e6fa7795d10432cd4cd9481fe7228237b27
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.md:311
    problem: "D-14がlocal-input-only時に必須としたinternalPreprocessing='unobservable'をschemaとstate matrixが強制していない。"
    evidence: "ImageTransportEvidenceV0はinternalPreprocessingに'unobservable'と'documented-no-transform'の両方を常時許し、81状態テストもこのfieldを列挙しない。そのためprovider受領bytes/pixelsを確認できないrunでもdocumented-no-transformを受理でき、DECISIONS.md:253の「provider/model受信pixel同一性を主張しない」という決定より強い保証を記録できる。"
    required_change: "local-input-only/not-exposedではinternalPreprocessingをunobservableに固定する。documented-no-transformを許す状態、必要なprovider policy証跡、providerImagePolicyVersionのnull規則を明記し、それらを含む完全なtransport状態テストへ更新する。"
  - id: R-002
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/PILOT-RUNBOOK.md:79
    problem: "artifact-slot-planのfreeze時点が草案とrunbookで矛盾し、結果依存のadjudication・human approval slotを事前登録する決定規則がない。"
    evidence: "runbookは全実行前に「必要なadjudication、人間承認slot」を登録する一方、草案§7.7は実行済みrunの後、承認開始前にplanをfreezeするとする。adjudication対象Qとhuman-batch/individual経路はconsensus後にしか確定しない。またrequiredForApprovalCoverage=trueの全slotにはactive terminalが必要なため、最大集合を事前登録すると未使用slotがcoverageを阻害し、必要分だけ登録すると実行前には決められない。"
    required_change: "slot planを作る正確なphaseを一本化し、route確定前でも決定可能なoptional slot semanticsを定義するか、annotation/consensus用planとroute確定後のadjudication/approval用planを非循環に分離する。未使用slot、required flag、active root、snapshot hashの扱いを完全に定義する。"
  - id: R-003
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.md:1036
    problem: "案A pilotの24件全件human final完了を表現・検証するcoverage artifactが定義されていない。"
    evidence: "唯一のApprovalCoverageRecordV0はexpectedCountを206へ固定し、最終corpus用である。一方、runbookは24件のapproved/corrected finalが揃うまでpilotを未完了とするが、24件の凍結期待集合、active approval、重複・欠落・superseded recordを結合して完了を証明するrecord/hash契約がない。このままでは23件だけでもreport生成側がprose規則を実装し損なう余地がある。"
    required_change: "pilot専用coverage recordを追加するか、coverage schemaをscope付きで一般化し、pilotでは凍結selectionの24 source ID、expectedCount=24、active batch/individual approvals、未知・重複・欠落・supersessionを機械検証する。206件のcorpus coverageとは明確に分離する。"
conditions: []
rollback_to: design
summary: "非規範境界、24画像の各page割当、案Aの全24件人間確認、3 model familyの分離、Gemini手動原文保存、2D投影の限界は明確である。独立列挙でもgrowth 76組、hollowing 93組の合法写像件数を再現した。ただしtransport保証、route依存slot計画、24件approval coverageの3点はpilotのprovenanceと完了判定を一意に実装できないため修正が必要である。"
```

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.md
    hash: sha256:9fb80aab68c95d5de6cf580d5953c3a70f0d5094f04309f6b380c8c27772b50b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/PILOT-RUNBOOK.md
    hash: sha256:96fe04ca9c1c8f9323e1180749c94cf93d6a8ad23c93cfa70736f2cc6e0070d5
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:4ae396af475e132f3f68445c08a739f2805640e113acedd397112e2ec2f2be1b
findings:
  - id: R-001
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.md:863
    problem: "documented-no-transform の適用条件に attachmentMode を要求しているが、実際のrunへ結合される ImageTransportEvidenceV0 に添付方式がなく、policy evidenceの attachmentMode と実行時添付方式を照合できない。"
    evidence: "ProviderImagePolicyEvidenceV0 は attachmentMode を必須とし、§5.3とPILOT-RUNBOOK.md:193-195も当該添付方式への適用を条件にする。一方、ImageTransportEvidenceV0とArtifactHeaderV0には実行時attachmentModeが存在しないため、972状態検査で「適用可能objectと一致」を機械的に判定できず、別の添付方式向けpolicyでも documented-no-transform の2状態を通せる。独立再計算では列挙数972・受理形5自体は一致したが、そのうちpolicy使用2形の適用可能性が未拘束である。"
    required_change: "実行時attachmentModeをImageTransportEvidenceV0またはhash固定されたrun契約へ追加し、ProviderImagePolicyEvidenceV0.attachmentModeとの完全一致を必須にする。runbookにも記録手順を追加し、972状態テストの「適用可能objectと一致」がprovider/model/client/version/attachmentModeの全一致を意味するよう明記する。"
conditions: []
rollback_to: design
summary: "local-input-only→unobservable＋policy null、transport 972状態中5状態の列挙、2段階slot planの非循環性、24件案A coverageと206件coverageの分離、各6画像/page、3 model family、Gemini手動provenance、非規範境界は確認できた。documented-no-transformだけはpolicyの添付方式を実runへ結合できないため承認不可。"
```

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.md
    hash: sha256:a43bd6326c44a92d5534c7134c459edf5fb23a714581ebaaa5e1f262393b9cc2
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/PILOT-RUNBOOK.md
    hash: sha256:b7fd79bebc5efc3eb20d2c52562da68c3ec31dc646a29f6fd1d09a267e3c4903
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:4ae396af475e132f3f68445c08a739f2805640e113acedd397112e2ec2f2be1b
findings: []
conditions: []
rollback_to: none
summary: "前回指摘を独立再検証した。実行時attachmentModeは各ImageTransportEvidenceV0内でartifact hashへ拘束され、documented-no-transformではprovider/model/client/version/policy versionとともにProviderImagePolicyEvidenceV0のattachmentModeへ完全一致する。transport直積を機械列挙して972状態中5状態のみ有効、967状態不正を再現した。annotation/consensus事前計画とconsensus後route計画は非循環に分離され、required/unused root、supersession、active snapshotを一意に定義している。案Aのpilot coverageは凍結した24匿名IDと24 source IDをactive batch/individual approvedまたはcorrected finalで各1回完全被覆し、未知・重複・欠落・rejected・spot-check・supersededを拒否する。現行DESIGN、物理式、単位、較正値、LocalStorageを変更しない準備設計の境界も維持されている。"
```

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.md
    hash: sha256:a43bd6326c44a92d5534c7134c459edf5fb23a714581ebaaa5e1f262393b9cc2
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/PILOT-RUNBOOK.md
    hash: sha256:8ad0f980ec3219290acec8f47fe092d72f173921de6a8418f31a47d8b09adac5
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:4ae396af475e132f3f68445c08a739f2805640e113acedd397112e2ec2f2be1b
findings: []
conditions: []
rollback_to: none
summary: >-
  前回承認後の変更はPILOT-RUNBOOK.md末尾の余分な空行1行の削除だけであり、
  本文、schema、物理的分類、単位、raster契約、pilot手順の意味は変わっていない。
  MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.mdとDECISIONS.mdは前回承認時のhashと
  完全一致する。前回findingだった実行時attachmentModeとprovider policyの完全一致、
  transport直積972状態中5状態だけの受理、2段階slot plan、案Aの24件human final完全被覆、
  pilotと206件corpus coverageの分離も維持されている。物理式、Reiter CA、較正値、
  LocalStorageおよび現行human finalへの変更はない。
```
```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:972bd6a89abd9897c99d356349a6f988239b8bee2a7a90f44d7660c349ab5826
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:89c7968c5655a519d2558824cd6c1d94f5322f25865172bcb97e8286d6cf6c5e
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md:601
    problem: "§5.1Aを唯一の規範契約と宣言しているが、pilotのartifact DAG、active terminal、adjudicationおよびhuman coverageを一意に実装・検証するschemaとhash preimageが不足している。"
    evidence: "非規範の草案にはannotation/adjudication artifact、consensus、candidate alias、2種類のslot plan、supersession ledger、active snapshot、human approvalの具体的schemaとpreimageがある一方、正式§5.1Aは名称と概略規則だけを記す。特にprotocolObjectSha256、schemaFileSha256、inputTableObjectSha256、upstreamSnapshotSha256のpreimageが未定義で、PilotHumanFinalV1には比較対象proposalやactive consensus/adjudicationへの参照がないため、DESIGN.md:707-714のproposal一致とactive approval完全被覆を機械的に再計算できない。PilotRunHeaderV1にもPilotImageTransportV1を結合するfieldがなく、DESIGN.md:475-476が要求するrun headerとtransportのattachment mode完全一致も、headerにattachmentModeが存在しないため検証不能である。"
    required_change: "§5.1A内または明示的な規範artifactへ、protocol/input table、annotation/adjudication wrapper、consensus、candidate alias、両slot plan、supersession ledger、active snapshots、human approval、coverageまでの全required property、順序、hash preimage、参照制約を定義する。各画像transportをrun artifactへhash拘束し、実行時attachmentModeをheaderとtransportで照合可能にする。human finalは検証対象proposalとactive upstream artifactを一意に参照させ、24件coverageを元approvalから再計算できるようにする。"
  - id: R-002
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md:391
    problem: "3モデルへ同一promptを渡すことは要求しているが、正式なprompt template、renderer、protocol objectの内容が規範化されておらず、hashが一致する任意なpromptでpilotを実行できる。"
    evidence: "§5.1AはrenderedPromptSha256とprotocolObjectSha256を記録するだけで、placeholder、置換規則、template bytes、annotator/adjudicator向け指示、候補入力形式を定義していない。唯一具体的なprompt templateとrendering契約はDESIGN.md:260-261が非規範とした草案にある。このため実装者ごとに異なる判断指示を採用してもschema上は通り、actor間比較、再実行、adjudicationの独立性を再現できない。"
    required_change: "annotator用とadjudicator用の正確なprompt template、許可placeholder、canonical JSON挿入位置、UTF-8/NFC/LF規則、rendering preimage、候補匿名化入力を正式§5.1Aまたはhash固定された規範artifactとして定義する。非規範草案への参照だけで補わない。"
conditions: []
rollback_to: design
summary: "24画像・各page6件、Claude/Codex/Geminiの独立実行、12件×2 batch、全24件の人間final、production corpus・loss・LocalStorageからの隔離、adjudicator失敗時のhuman fallback、探索的metrics、著作物・PII境界、限定invalidatonは上位仕様とD-14/D-15に整合する。物理分類は2D project labelに限定され、曖昧さも保持される。独立全列挙でgrowth 243中76、branch 2304中44、hollowing 243中93、confidence 81中27、transport 972中5の期待件数を再現した。しかし正式契約だけではartifact DAGとpromptを決定的に構築・監査できないため、design gateは不通過とする。"
```
```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:7874c60875bef838db7757e76c5e0c123ffb87cc049f3a926d3861ba210911d5
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:740a443eb8ae42f92c1d5a03a01ba6b8a3a24a6ba5d06cb040402632372c0541
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:0cd449f012ab5beeb74f9431928cae40bd9ce59f1b055b971730131e2cfda46f
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md:297
    problem: "BatchInputTableV1のobject hash契約が自己参照になり、vision artifact headerにも同hashを格納するpropertyがない。"
    evidence: "全property requiredかつtop-level object全体のLFなしJCSをhashすると規定する一方、BatchInputTableV1自身がbatchInputTableObjectSha256を含む。さらに495行はvision runでこのhashをnon-nullにしてprompt variablesと一致させるよう要求するため、hash値を入れるとpreimageが変わる循環になる。nullをpreimageにする例外や専用wrapperは定義されていない。加えてArtifactHeaderV1にはbatchInputTableObjectSha256が存在ず、495行と1090–1095行が要求するheader上のbatch-input参照を機械検証できない。"
    required_change: "BatchInputTableV1から自己hash propertyを除き外部で直接JCS hashを計算するか、自己fieldを含まない専用preimageを明示する。ArtifactHeaderV1へartifact kind別にnon-null/nullを拘束したbatchInputTableObjectSha256を追加し、PromptVariablesV1、canonical JSON、ordered image inputおよび実在するtable objectと完全一致させる。"
  - id: R-002
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md:726
    problem: "consensus categoryからrouteへの規範記述がDESIGN §5.1A.6と矛盾する。"
    evidence: "ConsensusCategoryV1の宣言順ではcategory 2がlabel-exact-nonhigh-or-confidence-differs、category 4がmulti-field-or-uncertainだが、727–728行はcategory 4をhuman-individual、category 2/3をadjudicationへ送る。DESIGN.md:655–660はmulti-field-or-uncertainとsingle-field-disagreementをadjudication、label-exact-nonhigh-or-confidence-differsをhuman-individualと固定している。したがってordinal解釈ではcategory 2と4が逆になり、第二slot plan、candidate alias、adjudication件数を異なる結果へ導く。"
    required_change: "ordinalの「category 1..4」を廃止し、4つのcategory literalごとにDESIGN表と同じrouteを明記する。D/U/L/O/Hの全排他的predicateについてcategoryとrouteを同時に検査する完全なtruth-table testを要求する。"
  - id: R-003
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md:652
    problem: "第一slot planとvision headerがannotator actor・batch・model familyの固定対応を機械的に拘束しないため、3独立familyというpilotの中核条件を検証できない。"
    evidence: "AnnotationConsensusSlotPlanV1のslotはartifactKind、logicalSlot、batchIdだけでactorIdを持たない。VisionGeneratorV1.actorIdは3 annotatorとadjudicatorを同じunionで許し、modelFamilyは任意stringである。protocol objectにぬannotatorIdsとannotatorFamiliesの別々の配列があるが、両者の対応、plan slotとの対応、annotation-runではadjudicator-1禁止、adjudication-runではadjudicator-1必須というcross-field規則がない。716–718行の配列順だけでは、headerのactor/familyがそのslotに正しいことを一意に立証できない。"
    required_change: "第一planのannotation slotへactorIdを必須化し、6 slotを3 actor×2 batchの固定tupleとして定義する。protocol上でactorIdと要求model familyを一対一に結び、annotation/adjudicationのartifact kind、slot、header generator.actorId、modelFamilyを完全一致させるcross-field制約を追加する。"
conditions: []
rollback_to: design
summary: >-
  24画像限定、各page 6件、案Aの全24件人間final、production corpus・LocalStorage・既存承認からの隔離、
  safe human fallback、2D project annotationの限界、著作権・PII境界、限定invalidatonは上位設計と
  D-03/D-15に整合する。一次資料の206観測・c-axis needle上の既知条件画像という位置づけも確認した。
  独立列挙ではgrowth 76/243、branch 44/2304、hollowing 93/243、confidence 27/81、transport product 972を再現し、
  protocol fileとexact prompt templateはUTF-8・BOMなし・NFC・LF・末尾LFおよびplaceholder個数を満たした。
  しかしbatch input hashの循環とheader参照欠落、consensus routeの矛盾、actor-family-slot拘束不足により、
  現在の規範contractから同一の実行DAGとpilot結果を一意に再構成できないため承認できない。
```
```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:d4e0bdf5d92a6c82d3d01d074d66a8f0d68488dbfa1825a7fea3c66198a90a90
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:740a443eb8ae42f92c1d5a03a01ba6b8a3a24a6ba5d06cb040402632372c0541
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:f710318380d9adbcdc6624600b70554413b1a0ce5a2d6237f4a3e88aa9af8803
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md:832
    problem: >-
      schema-invalidなmodel応答後のretry規則と、supersession chainの適格条件が両立せず、
      annotation slotを有効なterminalへ回復できない。
    evidence: >-
      第一slot planは実行前にrootArtifactIdを固定する一方、selectActiveはsupersessionのold/new
      artifact ID・file hashが実在しschema-validであることを要求する。ところが1309–1310行は、
      Markdown fence、不正JSON、欠落IDまたはschema違反のbatchにも新artifact IDとsupersessionを
      作って再実行するよう要求する。失敗応答にはschema-validなannotation artifactが存在しないため、
      ledgerが要求するsupersededArtifactFileSha256を合法に作れない。失敗rootを上書き・再利用すれば、
      新IDとimmutable/supersession規則に反する。
    required_change: >-
      invalid attempt用のschema-valid immutable artifact kind/statusを定義してledgerとactive選択へ組み込むか、
      invalid raw-response attemptはslot artifactを消費せず別attempt evidenceとして保存し、最初のvalid
      wrapperだけが凍結rootArtifactIdを取得すると明記する。どちらの場合もretry、ledger、root、
      active-terminalの完全な状態遷移とtestを固定する。
  - id: R-002
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md:1174
    problem: >-
      promptへ挿入するmodel payload schema objectが、protocol objectで凍結したrole別schema fileへ
      明示的にhash結合されていない。
    evidence: >-
      protocol objectはannotationPayloadSchemaFileSha256と
      adjudicationPayloadSchemaFileSha256を保持するが、PromptVariablesV1は独立した
      modelPayloadSchemaObjectSha256とmodelPayloadSchemaCanonicalJsonだけを持つ。1189–1206行は
      canonical JSONと隣接object hashの一致を要求するだけで、annotator roleをannotation schema fileへ、
      adjudicator roleをadjudication schema fileへ結ぶbyte-preimage規則がない。このため別のschema objectを
      自己整合するhashとともにpromptへ挿入しても、明示されたcross-field検査だけでは拒否できない。
    required_change: >-
      promptRoleごとに対応するprotocol schema-file hashを固定し、
      SHA-256(UTF-8(modelPayloadSchemaCanonicalJson) || LF)がそのfile hashと一致し、
      LFなしcanonical JSON hashがmodelPayloadSchemaObjectSha256と一致することを規範化する。
      またはrole別schemaFileSha256をPromptVariablesV1へ追加し、protocol、variables、rendered prompt、
      vision header間の完全一致を要求する。
conditions: []
rollback_to: design
summary: >-
  前回の3 findingは解消されている。BatchInputTableV1はself-hashを持たず、header・prompt variables・
  canonical JSON・保存table・ordered image inputへ結合された。consensusは4つのcategory literalとrouteを
  直接対応させ、D/U/L/O/H全64組が重複なく分類された。第一planは3 actor×2 batchの固定6 tupleで、
  actor-family-kind-slot-header制約と、適格adjudicatorまたはdirect-human fallbackも定義された。
  独立再計算ではgrowth 76/243、branch 44/2304、hollowing 93/243、confidence 27/81、
  consensus 64/64、transport 5/972を再現し、exact promptのplaceholder数、UTF-8 BOMなし、
  NFC、LF、最終LFも一致した。24件全human coverage、production/LocalStorage隔離、2D投影上の
  不確かさ、残り182件を許可しない境界も維持され、物理式・単位・較正値は変更されていない。
  ただしretry DAGとprompt-schema bindingの2点が決定的再現性を阻害するためdesign gateは不通過である。
```
```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:b6f5c3ea62884de3dd7242df8d3706679f5362880afe48e2bc9adeff5328c56b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:ee83c180289af05e44b3c00513c4d24006d41749133298e3c093e42533e5fc77
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:32492287e1267ddbbcbd352f769d7428cc70373c2afafd8e70f4ce436daa900e
findings: []
conditions: []
rollback_to: none
summary: D-16 option 1 is recorded and both limited fixes are complete. Invalid responses are immutable sidecar evidence outside the slot DAG, use non-circular evidence/file hashes, do not consume slot IDs or ledger entries, enforce contiguous attempts with a three-submission limit, assign the frozen root only to the first valid wrapper, and fail closed. Role-specific schema bytes are bound without circularity through protocol file hashes, LF-free JCS object hashes, PromptVariables, rendered-prompt evidence, exact rendered prompt hashes, and vision headers. Independent enumeration reproduced growth 76/243, branch 44/2304, hollowing 93/243, confidence 27/81, and transport 5/972; the primary Figure 2 source still supports the 206-observation provenance boundary. The 24-image Option A scope, exact prompt text, actor-family mapping, full human review, production and LocalStorage isolation, and prohibition on the remaining 182 images are unchanged.
```
```yaml
review_type: testcases
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:3c11ed81e0fbb3ac648879eecf122a1fec7afb522e4313911ca9c2b76da77d73
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:b6f5c3ea62884de3dd7242df8d3706679f5362880afe48e2bc9adeff5328c56b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:32492287e1267ddbbcbd352f769d7428cc70373c2afafd8e70f4ce436daa900e
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:ee83c180289af05e44b3c00513c4d24006d41749133298e3c093e42533e5fc77
  - path: docs/simulators/snow-crystal-sim/SPEC.md
    hash: sha256:92c0ee8ad1fd22f31915bac66f6369b155072ce70dd725078bfcb5f1f3eaedd1
  - path: docs/simulators/snow-crystal-sim/DESIGN-OUTLINE.md
    hash: sha256:b0aecd2dd517e810913d44e93fea02aa6f50dc56398ef5ee046d9ca514bc68ff
  - path: docs/simulators/snow-crystal-sim/TASKS.md
    hash: sha256:6b8205edc58b83ecb29039d4017461cff53db78390bb9faa99c2672de637cab4
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md:1274
    problem: Canonical PNG coverage exercises only a 3x2 image whose zlib stream uses one stored DEFLATE block; it does not cover the mandatory 65535-byte block boundary used by real pilot images.
    evidence: The independently recomputed 94-byte PNG and its SHA-256 are correct, but the testcase has no 65535/65536-byte or multi-block fixture and no explicit BFINAL, LEN/NLEN, block-order, or single-IDAT boundary mutation. An encoder or validator that mishandles every realistic multi-block derivative could therefore pass this gate.
    required_change: Add independent exact-byte fixtures at the stored-block boundary and for at least three blocks, including literal expected hashes, and reject wrong BFINAL, LEN/NLEN complements, missing/extra/reordered blocks, bad Adler-32, and splitting into multiple IDAT chunks.
  - id: R-002
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md:1396
    problem: Invalid-attempt tests do not bind InvalidAttemptEvidenceV1 to the immutable raw-response bytes or test its required timestamp ordering.
    evidence: The normative protocol requires rawResponseSha256 and rawResponseByteLength to match the stored response and requires startedAtUtc <= completedAtUtc <= responseCapturedAtUtc. TC-PILOT-ATTEMPT-001 mutates the evidence ID/file hash and forbids embedded raw text, but has no raw-response hash/length mismatch, zero or unsafe length, or reversed/equal-boundary timestamp cases. Falsified attempt provenance could pass while retry state tests remain green.
    required_change: Add a test-owned immutable raw-response byte fixture, independently recompute its hash and byte length, test all valid timestamp equalities/orderings, and reject hash mismatch, length mismatch, zero/non-safe length, and each timestamp inversion.
  - id: R-003
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md:1344
    problem: Exact byte-to-hash binding is specified only for the annotator and adjudicator payload schemas, while the protocol object contains hashes for the remaining schema files without corresponding file-byte tests.
    evidence: MorphologyPilotProtocolV1 lists schema-file hashes for selection, manifests, tables, artifacts, ledger, invalid-attempt evidence, snapshots, approvals, and coverage. TC-PILOT-PROMPT-001 explicitly verifies only the role-specific payload schema files. A protocol object with stale, swapped, missing, or unrelated non-role schema-file hashes could pass despite being unreproducible.
    required_change: Add a schema-bundle fixture covering every schemaFiles property, recompute each hash from canonical UTF-8 JCS plus one LF, and reject missing files, swapped references, object/file-hash substitution, and one-byte changes in either each file or each protocol reference.
conditions: []
rollback_to: testcases
summary: Existing source-audit, scoring, and holdout cases are not weakened, and independent checks reproduced the stated PNG/RGBA hashes, prompt hashes, mapping counts, transport 972/5 count, consensus partition, and Wilson interval. Approval is blocked by three boundary and provenance gaps in the new pilot cases.
```
```yaml
review_type: testcases
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:404400dcd37f9d2769b3a3a042fdd92fd530706d99e927bdfc82bb527c48ff5b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:b6f5c3ea62884de3dd7242df8d3706679f5362880afe48e2bc9adeff5328c56b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:32492287e1267ddbbcbd352f769d7428cc70373c2afafd8e70f4ce436daa900e
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:ee83c180289af05e44b3c00513c4d24006d41749133298e3c093e42533e5fc77
  - path: docs/simulators/snow-crystal-sim/SPEC.md
    hash: sha256:92c0ee8ad1fd22f31915bac66f6369b155072ce70dd725078bfcb5f1f3eaedd1
  - path: docs/simulators/snow-crystal-sim/DESIGN-OUTLINE.md
    hash: sha256:b0aecd2dd517e810913d44e93fea02aa6f50dc56398ef5ee046d9ca514bc68ff
  - path: docs/simulators/snow-crystal-sim/TASKS.md
    hash: sha256:6b8205edc58b83ecb29039d4017461cff53db78390bb9faa99c2672de637cab4
findings: []
conditions: []
rollback_to: none
summary: >-
  The three previously blocking gaps are resolved without weakening existing
  cases. TC-PILOT-DERIVATIVE-001 now fixes exact stored-DEFLATE fixtures at
  65535 and 65536 bytes and at three blocks, integrates one-, two-, and
  three-block canonical PNG fixtures, and requires rejection of BFINAL,
  LEN/NLEN, block-order, Adler-32, and multiple-IDAT mutations. Independent
  byte construction reproduced all six stated zlib/PNG hashes and lengths,
  including PNG SHA-256
  c0b5b070084e0f58cea7b60449ea1a99719c619adfdd6375a4cf2c686c60dc07,
  eb8d1eca0e065338a3a6ca9c04898568af22ec4e013530c5d9ef869664fed154,
  and c0a06dbe2d0e810ae986be96cdd6db45dc42050367599d27d9d89c68c3bee333.
  TC-PILOT-ATTEMPT-001 binds immutable raw-response bytes to hash and byte
  length; the independently recomputed nine-byte fixture hash is
  60498ebafa3f473a2a72c1242e8c3202bf50a6d81dfc721958be1550f46faf33.
  It covers all four valid equality/order classes, all six strict
  permutations, each inversion predicate, unsafe lengths, and immutable-file
  mutations. TC-PILOT-SCHEMA-001 exactly enumerates the same 22 schemaFiles
  properties as the normative protocol, independently derives LF-free JCS
  object hashes and JCS-plus-LF file hashes, and applies missing, swapped,
  object/file-substitution, per-file byte, and per-reference mutations to
  every property. The expected Red remains one computed-path missing-artifact
  assertion and cannot degrade into module-resolution, syntax, dependency, or
  network failure. No physical equations, units, validity ranges, numerical
  tolerances, production data, or existing testcase acceptance criteria were
  changed.
```
```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:b6f5c3ea62884de3dd7242df8d3706679f5362880afe48e2bc9adeff5328c56b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:32492287e1267ddbbcbd352f769d7428cc70373c2afafd8e70f4ce436daa900e
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:404400dcd37f9d2769b3a3a042fdd92fd530706d99e927bdfc82bb527c48ff5b
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:c10d75b2c9a18e82c17c8329cf1c5c1b768bd6412aed57e662ae6354a0b5a8f6
findings:
  - id: R-001
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts:1
    problem: The suite never exercises the validator implementation it is intended to specify.
    evidence: Lines 1-2 explicitly exclude the future validator; lines 75-205 test only local helper functions and self-constructed objects. Lines 207-210 dynamically import the validator only after it exists but ignore every export and perform no conformance call. An empty side-effect-free module would turn the sole Red Green while every invalid implementation behavior remained undetected.
    required_change: Keep the single missing-artifact assertion as the only pre-implementation Red, but after existence is true dynamically load a specified validator API and run every positive fixture and mutation against that API, comparing its results with independent test-local literal oracles.
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts:28
    problem: TC-PILOT-SELECTION-001 and TC-PILOT-SELECTION-002 do not implement the approved 206-candidate selection and blinding contracts.
    evidence: The fixture contains only 24 already-selected source IDs with six ordinals per page, uses anon-01 rather than the required img-001 form, and has no 52/52/51/51 candidate population, eight proxy signatures per page, selection-key oracle, round-robin ranking, pageSlot, literal selected snapshot, or mutation cases. The manifest at lines 83-87 contains only three properties and does not test filenames, relative paths, dimensions, mask/codec/tool data, forbidden properties, traversal, actor inventory, or one-to-one batch coverage.
    required_change: Build the complete SYN-PILOT-24 206-row candidate/proxy fixture and independent literal selection snapshot, then exercise the validator with every selection, manifest, restricted-map, path, leakage, inventory, count, order, and hash mutation required by TC-PILOT-SELECTION-001..002.
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts:90
    problem: TC-PILOT-DERIVATIVE-001..002 omit the exact PNG, raster, crop, mask, and upload-byte oracle.
    evidence: The test hashes an unrelated 2x1 byte array and merely checks that the result has SHA-256 syntax. It never asserts the required RGBA hash ce498a4..., canonical 94-byte PNG hash facaaab2..., exact PNG bytes, CRC32, Adler32, stored-DEFLATE boundaries at 65535/65536/65537 and three blocks, viewport rounding, exterior-pixel invariance, PNG chunk restrictions, or prescribed mutations. Upload evidence is a local object equality plus an intentionally false JPEG comparison, not 24 validator-checked attachment records.
    required_change: Implement the independent PNG/DEFLATE/CRC/Adler oracle and all fixed hashes, lengths, boundaries, crop/mask mutations, decode checks, and 24-item upload evidence mutations exactly as specified in TC-PILOT-DERIVATIVE-001..002.
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts:119
    problem: The supposedly exhaustive morphology mapping tests are semantically malformed and do not verify valid/invalid tuple sets.
    evidence: The loops pass clear/absent/uncertain as visibility while mapGrowth, mapBranch, and mapHollow require the unenumerated literal sufficient; consequently all 243 growth loop rows map to indeterminate, all 2304 branching rows map to null, and all 243 hollowing rows map to indeterminate. Seed/separation or new-basal context is ignored. The required valid/invalid counts 76/167, 44/2260, 93/150, and 27/54 are never asserted, and payload-local constraints and forbidden visual shortcuts are absent.
    required_change: Encode the protocol's legal observation tuples independently, assert every required valid/invalid count and exactly one mapping for each legal tuple, compare every row with the validator, and add all payload, confidence, context, and shortcut mutations from TC-PILOT-MAPPING-001..004.
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts:104
    problem: TC-PILOT-TRANSPORT-001 checks only a simplified local truth function, not the full transport contract.
    evidence: Although 972 combinations and an accepted count of five are produced, policy is reduced to a boolean and evidence to an arbitrary hash. Received RGBA dimensions/layout, saved policy bytes, provider/model/client/version/attachment mode bindings, upload evidence, mixed header modes, double receipt hashes, transform/preview failures, and false claims about local-input-only are not validated or mutated.
    required_change: Construct the five exact normative transport records and the complete 972-row independent expected set, invoke the validator for every row, and add all out-of-product policy, receipt, dimension/layout, upload, transform, preview, and reporting mutations required by the testcase.
  - id: R-006
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts:143
    problem: TC-PILOT-PROMPT-001..003 and TC-PILOT-SCHEMA-001 do not bind the normative protocol, 22 named schema files, or exact prompt bytes.
    evidence: The test invents schema-01.json through schema-22.json in an array instead of checking the 22 required protocol properties and distinct schema objects/files. It does not distinguish JCS object hashes from LF-terminated file hashes or test BOM/CRLF/swap/mutation cases. The prompt is a short invented string using ${...}, not the normative 4531-byte and 3133-byte templates with hashes d5d5f557... and 21c13a7d.... The protocol document is never read; its path is only checked for a filename substring at line 197.
    required_change: Add duplicate-aware parsing and independent JCS/file-byte hashing for every named schemaFile property and mutation, extract and verify both exact normative templates and placeholder sets, and validate prompt variables, rendered evidence, batch tables, headers, run hashes, and attachment order through the validator.
  - id: R-007
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts:155
    problem: TC-PILOT-RUN-001..002 and TC-PILOT-ATTEMPT-001 cover only counts and one toy retry sequence.
    evidence: Run fixtures omit provider, product, displayed model, client/tool, attachment mode, timestamps, raw capture, prompt/schema/input hashes, campaign isolation, workspace inventory, atomic JSONL validation, and all batch-rejection mutations. Attempt testing covers only invalid-invalid-valid and a constant false assertion; it omits the six required sequences, immutable raw-file revalidation, first-valid root identity, invalid-evidence schema, attempt numbering, campaign/preimage binding, all UTC equalities/permutations, ledger/snapshot exclusion, replacement atomicity, and annotation/adjudication fail-closed behavior.
    required_change: Implement all six attempt sequences and exact raw-byte fixture against the validator, including filesystem mutation checks and UTC permutations, and supply complete six-run/72-record atomic fixtures with every identity, provenance, capture, independence, and rejection mutation specified by TC-PILOT-RUN-001..002 and TC-PILOT-ATTEMPT-001.
  - id: R-008
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts:168
    problem: Consensus, slot planning, supersession, snapshots, DAG, and adjudication contracts are replaced by toy structures.
    evidence: The consensus test generates category/route with its own route function and checks only that a newly computed digest looks like a hash; it has no literal truth-table hash, record-derived D/U/L/O/H, confidence/observation semantics, or mutations. The slot test has only seven strings and a five-node toy graph, with no second plan, Q partition, unused slots, ledger chains/cutoffs, active terminals, snapshots, artifact hashes, or normative DAG. Adjudication accepts the placeholder other-family and a simple skipped object without GitHub Copilot display metadata, eligibility/skip reasons, candidate aliases, candidate-table redaction, partition coverage, cross-field actions, or replacement plan.
    required_change: Add the fixed 64-row consensus oracle and record derivation, both normative slot plans, all ledger/snapshot/DAG fixtures and mutations, and complete fresh-family/direct-human adjudication fixtures through the validator.
  - id: R-009
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts:187
    problem: TC-PILOT-APPROVAL-001..002 do not verify human approval provenance, active upstream state, or exact source-derived coverage.
    evidence: The test constructs a non-normative object containing only source IDs and approved decisions. It lacks the required 8 batch plus 16 individual fixture, approved/corrected/rejected rules, rationale constraints, proposal/final/hash bindings, source ordering, upstream consensus/adjudication snapshots, ledger terminal resolution, approval/file/record/coverage hashes, restricted-map pairing, and all inactive, superseded, missing, duplicate, 23/25, and production-206 isolation mutations.
    required_change: Implement the complete normative approval records, active-source resolution, source-map-derived exact-24 coverage snapshot, independent hashes, and every approval/coverage mutation required by TC-PILOT-APPROVAL-001..002.
  - id: R-010
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts:193
    problem: Isolation and metrics tests do not exercise side effects, production boundaries, or the required descriptive aggregations.
    evidence: Isolation only computes a parent-directory path and checks that two constant strings omit forbidden words; it does not invoke the validator, snapshot repository/production/LocalStorage sentinels, stub network access, enforce output allowlists, test traversal/writes, or verify atomic temp behavior. Metrics calculate one Wilson interval, then use expect(1).toBe(1) instead of computing kappa, and omit actor/field/transport coverage, attempts, supersession, confusion matrices, indeterminate/limitations, human disagreement, adjudication, timing, zero-denominator behavior, and report-language/migration mutations.
    required_change: Run all synthetic validation under an isolated temp root with repository and sentinel before/after hashes plus throwing network stubs, exercise every forbidden-output mutation, and independently compute and validate all TC-PILOT-METRICS-001 aggregates and non-promotion/reporting constraints.
conditions: []
rollback_to: test-code
summary: The targeted run produced exactly one missing-validator Red and 19 nominal passes with no skips or direct network calls, but those passes test simplified local helpers rather than the future validator. Major required fixtures, exact byte/hash oracles, exhaustive valid/invalid mappings, mutations, provenance chains, and isolation checks are absent, so this test-code gate cannot constrain or validate the implementation.
```
## test-code review: morphology ensemble pilot high-performance rebuild

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:1fa082406ad8ddcade458ad499c3642ece3a15d37f8f116ca0673d0f1ca86fc0
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:ce5ea444051675eb5ffdfe166264d44577d1994c8bb1594cf38748a78f0416b1
  - path: apps/snow-crystal-sim/tests/calibration/pilot-images.mjs
    hash: sha256:9d0fd79526f004eade44c13829d85088aca8a0e279ee2bc61e4d4235d7c87af1
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:aa44ccb8dbe32db9c357a42108b7bf15d413b7afa169739f531d234fa9c20e6b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-workflow-fixtures.mjs
    hash: sha256:1854e77dee87e54492489f0179ad7c295e1dd2b83d4065583d294119bbf211b4
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:148840725a0bfa980f838b5b9d6fed2db9e78142310813341ff4b407370be51a
  - path: apps/snow-crystal-sim/tests/calibration/pilot-schema-cases.mjs
    hash: sha256:a4c61d15826fb8b66996d63909385e2bcb5e99af0040f8282d0beace9f8d04fd
  - path: apps/snow-crystal-sim/tests/calibration/pilot-metrics-isolation.mjs
    hash: sha256:dfed271db176995a18b04dccff5c50ecc8eefaf49fb0e9db3ed2a6d161ebc21b
findings:
  - id: R-001
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts:137
    problem: "全fixtureをvalidatorへ渡すようになったが、validatorによるtest oracle再利用を防げず、入力を検証しないreplay実装でも全ケースを通過できる。"
    evidence: "`cases` registryと各caseのexpected/errorClass/reason/fieldはpilot-oracle.mjsから公開され、validator予定位置と同じdirectoryからimport可能である。validatorは共有moduleのcasesを呼出順に読み、positiveではexpectedを返し、negativeでは記録済みclass/messageを投げるだけで、fixture内容を一切検証せず通過できる。main loopは固定登録順で、validatorの依存先検査、oracle module隔離、順序変形によるanti-replay検査がない。"
    required_change: "validatorからpilot-oracleおよびfixture support moduleへの直接・推移的importを禁止して機械検査し、case registryをvalidatorから参照不能にする。さらに固定呼出順replayを検出できるよう、同一caseの順序変更・再実行・独立metamorphic入力を含むconformance runnerを追加する。"
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-schema-cases.mjs:33
    problem: "全22 schemaのproperty mutationがrequired/type/null中心で、同じ型の不正enum・const・formatやartifact union全memberを拘束していない。"
    evidence: "string propertyのnegativeは値をboolean falseへ変えるだけで、例えばprotocol.serialization.hashAlgorithm='sha1'のようなsame-type const違反を作らない。hashの長さ・小文字hex、IDのNFC/長さ/禁止文字、UTC形式も全schema propertyへ適用されない。またartifact schemaはheader、consensus、adjudication、human approval、coverageだけをexerciseSchemaへ渡し、annotation record、ledger metadata、ledger recordを欠く。したがってstring型だけ確認してconst/formatを無視するschema validatorや、未提示union memberを無検査にするvalidatorが通過できる。"
    required_change: "22 schemaの全到達propertyについてsame-type enum/const/format/boundary mutationを追加し、Sha256Hex、ID、UtcSeconds、safe integer等の共通制約を拘束する。artifactとledgerの全union memberをpositiveおよびproperty mutation walkへ含める。"
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-workflow-fixtures.mjs:99
    problem: "fresh modeのbatch-summary approval positive fixtureが、参照していないadjudication artifactをactive upstream snapshotへ含めている。"
    evidence: "upstreamFreshは6 annotation、consensus、adjudicationを常に含み、makeApprovalsはbatch-summaryとindividual-source-pdfの両方へ同じsnapshot hashを使用する。batch-summaryの8 targetはlabel-exact-all-highのactive consensusだけをproposalとして参照し、adjudicationを参照しない。規範protocol §11とTC-PILOT-SLOTS-003は対象approvalが参照するconsensus/adjudicationと推移的annotation closureを過不足なく要求するため、このpositiveは余分なadjudication itemを持つ。適合validatorはpositiveを拒否せざるを得ない。"
    required_change: "approvalごとに必要な推移的closureを独立導出し、fresh batch snapshotからadjudicationを除外する。individual snapshotだけに実際に参照するadjudication artifactを含め、余分・欠落双方のmutationを追加する。"
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-metrics-isolation.mjs:78
    problem: "metrics/report fixtureが各二項率のWilson 95% intervalを含まず、承認済み評価契約を拘束していない。"
    evidence: "aggregateはcoverage、exact、human disagreement、adjudication resolution等を分子・分母で返すがinterval fieldを生成しない。wilson(12,24)の独立primitive caseはあるものの、metricsまたはpilot-reportへ結合されていないため、全率のintervalを欠くvalidatorがそのままexpectedと一致する。DESIGN §5.1A.7とTC-PILOT-METRICS-001は二項率へz=1.959963984540054のtwo-sided Wilson、分母0へreason付きundefinedを要求する。"
    required_change: "metrics/reportの各二項率にWilson intervalまたはzero-denominator reasonを含め、分子・分母との再計算一致、代表値、分母0、interval改変mutationをvalidatorへ通す。"
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-metrics-isolation.mjs:46
    problem: "隔離guardはvalidation directory内のwriteを記録するだけで検査せず、negative caseやvalidation-only caseの副作用を見逃す。"
    evidence: "guardEffects.writesはmain testで一度もassertされず、afterAllのisolatedSnapshotもinputs directoryだけを比較する。したがってvalidatorがnegative fixtureで出力を作ってから例外を投げる、要求外fileをvalidation directoryへ残す、全validation caseで任意fileを書く実装でも通過できる。個別に不存在を確認するのはisolation-atomic-failureのfinal fileだけであり、TC-PILOT-ISOLATION-001のoutput allowlistとfail-closed無出力を満たさない。"
    required_change: "各validator call前後でvalidation directoryをsnapshotし、writeを許可するisolation positiveだけにexact temp/final pathとatomic sequenceを限定する。全negativeおよびvalidation-only caseではwrite 0、失敗後はtemp/finalとも不存在、未知output basenameも拒否することを検査する。"
conditions: []
rollback_to: test-code
summary: "権威3文書のhashは承認値と一致した。独立再計算でmapping valid数76/44/93/27とWilson(12,24)=[0.3142742581957335,0.6857257418042665]を再現した。対象Vitestは13 Greenとmissing validator artifactだけの期待Red 1件、typecheckとarchitecture checkは成功し、workspace全体は2475 Green・1 skip・既知5件とpilot 1件の計6期待Redだった。R-002〜R-010の大部分は完全fixtureと7553登録caseへ拡張されたが、oracle replay防止、schema同型mutation、approval closure、Wilson report結合、失敗時write隔離に未解決欠陥があるためtest-code gateは不合格とする。"
```

## test-code re-review: morphology ensemble pilot oracle isolation

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:1a892f8b458724793a289135c8a1105d51509aa40629cf785bf5bad46b98280a
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:ba8cb2eca46ac53075bf9a93cdfbea524f903bad16bf156c51fb2fe671e4e862
  - path: apps/snow-crystal-sim/tests/calibration/pilot-images.mjs
    hash: sha256:9d0fd79526f004eade44c13829d85088aca8a0e279ee2bc61e4d4235d7c87af1
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:aa44ccb8dbe32db9c357a42108b7bf15d413b7afa169739f531d234fa9c20e6b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-workflow-fixtures.mjs
    hash: sha256:117804178890a33d5c1f7fa6275d4ea070472f21bb41cb8c3d2ceadfcdf1272f
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:cf41f7b241757236cd4e3b8bb97ebb58d974ed311d03761ed434b4b16a35c96a
  - path: apps/snow-crystal-sim/tests/calibration/pilot-schema-cases.mjs
    hash: sha256:95150ce11bcad306a46b2f30aa0cc22e25bfa6197183de2bbbf535878e70767c
  - path: apps/snow-crystal-sim/tests/calibration/pilot-metrics-isolation.mjs
    hash: sha256:06aa92cd86c0cf45738db621aea75d99de5b53e9215d1857201ba3126cad08bb
findings:
  - id: R-001
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs:101
    problem: "validatorのtest oracle依存検査をnode:moduleのnamespace import経由で迂回でき、共有case registryを直接requireするvalidatorが許可される。"
    evidence: "独立したvirtual dependency graphで `import * as m from 'node:module'; const r=m.createRequire(import.meta.url); r('./pilot-oracle.mjs')` を検査したところ、assertValidatorDependenciesは例外を出さず、nodesにはvalidatorだけ、edgesは空を返した。実装はnamed importのcreateRequireだけをfactoryとして追跡し、namespace/default importのproperty accessを追跡しない。これによりvalidatorはrandom順・再実行を問わず共有cases/expected/error情報を読んでreplayでき、全conformance検査を実入力検証なしで通過できる。"
    required_change: "node:moduleのnamespace/default/named aliasおよびcreateRequireのproperty accessから生成された全require aliasを追跡し、直接・推移的なpilot support/test importを拒否する。上記namespace-import例とdefault-import例をdependencyGateOracleへ追加し、いずれもoracle-import-forbiddenで停止することを確認する。"
conditions: []
rollback_to: test-code
summary: "権威3文書のhashは承認値と一致した。前回指摘の全22 schema到達・artifact 8/ledger 3 union member、approval別closure、全二項率Wilson/zero-denominator、validator call単位のwrite監査は修正されている。node --checkとtypecheckは成功し、対象Vitestは13 Greenとmissing-validatorだけの期待Red 1件、verify-fastは2475 Green・1 skip・既知5件とpilot 1件の計6期待Redだった。しかしoracle依存検査に実証可能なrequire迂回が残り、validatorが共有expected registryを再利用できるためtest-code gateは通過できない。"
```

## test-code final review: morphology ensemble pilot oracle isolation

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:1a892f8b458724793a289135c8a1105d51509aa40629cf785bf5bad46b98280a
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:ada009eb14a7c0d767f7b4c9c4855c98038356e00383856520265c43608fe339
  - path: apps/snow-crystal-sim/tests/calibration/pilot-images.mjs
    hash: sha256:9d0fd79526f004eade44c13829d85088aca8a0e279ee2bc61e4d4235d7c87af1
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:aa44ccb8dbe32db9c357a42108b7bf15d413b7afa169739f531d234fa9c20e6b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-workflow-fixtures.mjs
    hash: sha256:117804178890a33d5c1f7fa6275d4ea070472f21bb41cb8c3d2ceadfcdf1272f
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:cf41f7b241757236cd4e3b8bb97ebb58d974ed311d03761ed434b4b16a35c96a
  - path: apps/snow-crystal-sim/tests/calibration/pilot-schema-cases.mjs
    hash: sha256:95150ce11bcad306a46b2f30aa0cc22e25bfa6197183de2bbbf535878e70767c
  - path: apps/snow-crystal-sim/tests/calibration/pilot-metrics-isolation.mjs
    hash: sha256:06aa92cd86c0cf45738db621aea75d99de5b53e9215d1857201ba3126cad08bb
findings:
  - id: R-001
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs:107
    problem: "dependency gateには、今回追加した48例と同等のcreateRequire取得経路でoracle依存を迂回できる経路がまだ残っている。"
    evidence: "追加された8形式×3禁止対象×直接・推移の48攻撃例は対象Vitest内で成功し、同じ8形式でnode:cryptoを読む正常例も誤拒否されなかった。しかし独立virtual graph検査では、`const key='createRequire'; const f=m[key]`、computed destructuring、`.bind`、`.call`、comma alias、`Reflect.get(m,'createRequire')`、および`process.getBuiltinModule('module').createRequire(...)`から生成したrequireで`./pilot-oracle.mjs`を読む全7例が例外なく許可され、いずれもnodes=1・edges=0となった。特にexpressionKindはElementAccessExpressionを文字列literalの場合だけ追跡し、CallExpressionはFACTORY自身の直接呼出ししか伝播せず、process.getBuiltinModuleも追跡しない。このためvalidatorは共有cases/expected/error情報へ到達し、実入力を検証しないreplay実装でconformance検査を通過できる。"
    required_change: "validatorの全依存closureについてfail-closedな静的import allowlistを採用し、少なくとも`node:module`/`module`と`process.getBuiltinModule('module')`による動的loader取得を禁止するか、computed-key定数伝播、destructuring、bind/call/apply、Reflect.get、comma/alias chain、process.getBuiltinModuleまでtaint追跡する。上記各経路をpilot support/testの3禁止対象について直接・推移の自己検査へ追加し、すべてoracle-import-forbiddenになることと、node:crypto等の許可済みstatic依存が通ることを確認する。"
conditions: []
rollback_to: test-code
summary: "前回R-002〜R-010の対象ファイルは同一hashで回帰はなく、node --checkとtypecheckは成功した。対象Vitestは13 Greenとmissing-validatorだけの期待Red 1件で、verify-fastも2475 Green・1 skip・既知5件とpilot 1件の計6期待Redだった。追加された48攻撃例と正常builtin例は有効だが、実証可能な同等loader迂回が残るためoracle isolationはまだ成立せず、test-code gateは承認できない。"
```

## test-code review: D-18 fail-closed static import allowlist

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:1a892f8b458724793a289135c8a1105d51509aa40629cf785bf5bad46b98280a
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:50a6dcb1e6341e4e4413315a94a9c1c44830b959f4634313109cad52d300bc58
  - path: apps/snow-crystal-sim/tests/calibration/pilot-images.mjs
    hash: sha256:9d0fd79526f004eade44c13829d85088aca8a0e279ee2bc61e4d4235d7c87af1
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:aa44ccb8dbe32db9c357a42108b7bf15d413b7afa169739f531d234fa9c20e6b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-workflow-fixtures.mjs
    hash: sha256:117804178890a33d5c1f7fa6275d4ea070472f21bb41cb8c3d2ceadfcdf1272f
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:cf41f7b241757236cd4e3b8bb97ebb58d974ed311d03761ed434b4b16a35c96a
  - path: apps/snow-crystal-sim/tests/calibration/pilot-schema-cases.mjs
    hash: sha256:95150ce11bcad306a46b2f30aa0cc22e25bfa6197183de2bbbf535878e70767c
  - path: apps/snow-crystal-sim/tests/calibration/pilot-metrics-isolation.mjs
    hash: sha256:06aa92cd86c0cf45738db621aea75d99de5b53e9215d1857201ba3126cad08bb
findings:
  - id: R-001
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs:97
    problem: "static import先は列挙されたが、builtinのimport形式とexport名が無制限なため、validatorはnode:fs経由でtest oracleを直接読める。D-18のoracle再利用防止は成立していない。"
    evidence: "独立virtual-source検査で `import {openAsBlob} from 'node:fs'` を使用してpilot-oracle.mjsを読むvalidatorを渡すと、assertValidatorDependenciesは拒否せずnodes=1、builtins=['node:fs']を返した。Node v24.14.1で同じopenAsBlobをguardEffects下から実行するとpilot-oracle.mjsの42616文字を読み出せた一方、guardEvents、writes、networkCallsはいずれも0だった。dependencyGateOracleの478 reject、28 allow、15 path fixtureは成功するが、この経路を含まない。"
    required_change: "builtinごとに必要なnamed exportと許可形式をexact allowlist化し、default/namespace importおよびopenAsBlob等の未監視read APIを拒否する。許可するfilesystem readはguardEffectsが禁止対象basenameを検査できるAPIだけに限定し、openAsBlobによる直接・推移的oracle/support/test読出しを自己検査へ追加する。これができない場合はD-18選択肢2相当のfilesystem sandboxが必要。"
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-metrics-isolation.mjs:67
    problem: "許可されたnode:fs/node:fs/promisesにはeffect guardが監視しない書込みAPIが残り、validation外の未知出力を作るvalidatorでも副作用検査を回避できる。"
    evidence: "guardEffectsはcopyFile/link系をpatchするが、fs.cpSync、fs.promises.cp、mkdtemp系をpatchまたは拒否しない。独立virtual-source検査ではcpSyncとfs/promisesのcpを使うvalidatorがどちらもdependency gateを通過した。repositorySnapshotはtracked fileだけ、ownSnapshotはpilot-*とtest本体だけを対象とするため、別名のuntracked outputは終了時検査でも捕捉されない。"
    required_change: "filesystem builtinのexact named-export allowlistからcp/cpSync/mkdtemp等の不要な書込み能力を除外し、許可された全書込みAPIがcall単位guardを通ることを機械検査する。少なくともcpSync、fs.promises.cp、未許可basenameへの新規untracked出力をnegative自己検査へ追加する。"
conditions: []
rollback_to: test-code
summary: "path normalization、case folding、traversal、symlink/realpath検査、dynamic loader・非literal・re-export・CJS・評価系・未知構文の既定拒否は確認できた。対象Vitestは13 Greenとmissing-validatorだけの期待Red 1件、typecheckと全MJSのnode --checkは成功し、独立再構築したconformance registryは15056件だった。しかしbuiltin module単位のallowlistが広すぎ、実証可能なoracle readと未監視writeが残るためtest-code gateは承認できない。"
```

## test-code re-review: D-18 builtin named-export allowlist

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:e4f6269d985b6df20a9f1999c37c2659c448a28e2ba0dc5b17bbb93172fcb42d
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:c6f556476fcc731d1ba10ec6c9dcd153dad298aad6ccd7814d6ad528f19cd86b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-images.mjs
    hash: sha256:9d0fd79526f004eade44c13829d85088aca8a0e279ee2bc61e4d4235d7c87af1
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:aa44ccb8dbe32db9c357a42108b7bf15d413b7afa169739f531d234fa9c20e6b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-workflow-fixtures.mjs
    hash: sha256:117804178890a33d5c1f7fa6275d4ea070472f21bb41cb8c3d2ceadfcdf1272f
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:cf41f7b241757236cd4e3b8bb97ebb58d974ed311d03761ed434b4b16a35c96a
  - path: apps/snow-crystal-sim/tests/calibration/pilot-schema-cases.mjs
    hash: sha256:95150ce11bcad306a46b2f30aa0cc22e25bfa6197183de2bbbf535878e70767c
  - path: apps/snow-crystal-sim/tests/calibration/pilot-metrics-isolation.mjs
    hash: sha256:06aa92cd86c0cf45738db621aea75d99de5b53e9215d1857201ba3126cad08bb
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs:115
    problem: "node:assert/strictの許可export `ok`から、禁止したdefault exportと未許可exportへ到達できるため、D-18のexact named-export allowlistになっていない。"
    evidence: "Node v24.14.1では`ok.strict === default export`であり、`ok`には`fail`、`Assert`、`CallTracker`など22個のmodule APIがpropertyとして公開される。独立virtual-source検査で`import {ok as permitted} from 'node:assert/strict'; permitted.fail(...)`を直接validatorと推移helperの双方へ配置したところ、assertValidatorDependenciesは拒否せずbuiltins=['node:assert/strict']を返した。構文上のdefault/namespace/side-effect importは拒否される一方、同じdefault capabilityがこの経路で取得できる。"
    required_change: "最小修正としてVALIDATOR_BUILTINSから`ok`を除外し、必要な真偽検査は`strictEqual`またはvalidator内の通常分岐で行う。`ok.strict`、`ok.fail`、`ok.Assert`を直接・推移helper双方で拒否する自己検査も追加する。あるいはbuiltin import bindingからのproperty accessを個別member allowlistで制限する。"
conditions: []
rollback_to: test-code
summary: "D-18のfilesystem対策は大幅に改善されている。dependency gateは696 reject・83 allow・15 path case、filesystem guardは全8 APIについて17 positive・62 attack、独立再構築registryは15056件だった。openAsBlob、cp/cpSync、mkdtemp、stream、FileHandle、promises object、未許可出力、root外read/write、symlink/junction、path alias、未追跡descriptorは拒否され、relative validator closureにも同じ規則が適用される。対象Vitestは13 Greenとmissing-validatorだけの期待Red 1件、typecheckと全MJSのnode --checkは成功し、verify-fastは2475 Green・1 skip・既知5件とpilot 1件の計6期待Redだった。R-002〜R-010の回帰は認めなかったが、`ok`経由でexact export境界を迂回できるためtest-code gateはまだ承認できない。"
```

## test-code final approval: D-18 exact named-export allowlist

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:9b491f872fa9e15c31f8a608f6b4430431b0dc1996b9d7c492e10d62fdff3bd5
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:880a740bbc34357614a14f156348aae02b67e0828970cd99dda171acbbd953a3
  - path: apps/snow-crystal-sim/tests/calibration/pilot-images.mjs
    hash: sha256:9d0fd79526f004eade44c13829d85088aca8a0e279ee2bc61e4d4235d7c87af1
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:aa44ccb8dbe32db9c357a42108b7bf15d413b7afa169739f531d234fa9c20e6b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-workflow-fixtures.mjs
    hash: sha256:117804178890a33d5c1f7fa6275d4ea070472f21bb41cb8c3d2ceadfcdf1272f
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:cf41f7b241757236cd4e3b8bb97ebb58d974ed311d03761ed434b4b16a35c96a
  - path: apps/snow-crystal-sim/tests/calibration/pilot-schema-cases.mjs
    hash: sha256:95150ce11bcad306a46b2f30aa0cc22e25bfa6197183de2bbbf535878e70767c
  - path: apps/snow-crystal-sim/tests/calibration/pilot-metrics-isolation.mjs
    hash: sha256:06aa92cd86c0cf45738db621aea75d99de5b53e9215d1857201ba3126cad08bb
findings: []
conditions: []
rollback_to: none
summary: "D-18の限定契約を独立再検証した。node:assert/strictのokはallowlistから除外され、strictEqual/deepStrictEqualだけが直接・推移closureで許可される。ローカル合成fixtureでもok.fail/ok.strictは直接・推移とも拒否され、必要なnamed importは受理された。Node v24.14.1上の18 named exportについて、native own/inherited property・accessor・symbolを再帰監査した結果は2564 properties、2 accessors、216 symbols、許可外module capability露出0、検査不能accessor 0で、除外したokのnegative controlも機能した。static dependency自己検査は710 reject・81 allow・15 path、filesystem guardは8 capability・17 positive・62 negative、独立再構築registryは15056件だった。literal static import、exact builtin export、relative path closure、realpath/symlink、動的loader・評価系・未知構文の拒否、およびcall単位のread/write/network guardを確認した。対象Vitestは13 Greenとmissing-validatorだけの期待Red 1件、typecheckと7 MJSのnode --checkは成功した。verify-fastは2475 Green・1 skipで、既知5 artifact Redとpilot validator欠落Redの計6件だけが失敗した。schema全22件、approval closure、全二項率Wilson、side-effect検査および従前R-002〜R-010に回帰は認めない。"
```

## design refresh review: D-17 and D-18 decision status

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:b6f5c3ea62884de3dd7242df8d3706679f5362880afe48e2bc9adeff5328c56b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:6a242076b9c5534fe365767a2db5063f19a9a241dba90ed07a1585a16e4fcf7a
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:32492287e1267ddbbcbd352f769d7428cc70373c2afafd8e70f4ce436daa900e
findings:
  - id: R-001
    severity: low
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md:340
    problem: "D-17とD-18の状態が「人間判断待ち」のままだが、各節末尾には推奨案を採用した人間判断が記録されている。"
    evidence: "D-17は同ファイル366行付近に2026-10-16の採用判断、D-18は同ファイル400行付近に2026-10-17の採用判断を持つため、状態欄と決定本文が矛盾し、実装担当切替およびdependency gate切替の承認状態を一意に判定できない。"
    required_change: "D-17とD-18の状態を、それぞれ記録済みの日付を維持した「人間判断済み」へ更新する。決定内容、DESIGN、規範protocolは変更しない。"
conditions: []
rollback_to: design
summary: "D-17/D-18はtest-code担当とfail-closedなvalidator依存境界だけを変更し、24画像案A、3 actor、12件×2 batch、全24件human final、mapping・prompt・schema・transport、production隔離、残り182件禁止、2D project label、非ground-truth、単位・不確かさ・indeterminate境界を弱めていない。唯一の未解決点は、採用済み判断に対する状態欄の不整合である。"
```

## design refresh approval: D-17 and D-18 decision status

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:b6f5c3ea62884de3dd7242df8d3706679f5362880afe48e2bc9adeff5328c56b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:b5f30d1327c070ee30d3d09033e3249b4c74930cf32fbd2ebe95bcb38e410b36
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:32492287e1267ddbbcbd352f769d7428cc70373c2afafd8e70f4ce436daa900e
findings: []
conditions: []
rollback_to: none
summary: D-17とD-18は人間判断日を維持して「人間判断済み」へ修正され、本文の採用内容と状態が一致した。DESIGN.mdと規範プロトコルは不変であり、24画像・3 actor・12件×2 batch・全24件human final、productionおよびLocalStorage隔離、残り182件の実行禁止を維持している。分類は2D画像上のproject annotationであって論文著者ラベルや物理的ground truthではなく、不確実な3D形態をindeterminate/nullへ送る境界にも回帰や矛盾はない。
```

## testcase refresh approval: D-17 and D-18 decisions

```yaml
review_type: testcases
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:404400dcd37f9d2769b3a3a042fdd92fd530706d99e927bdfc82bb527c48ff5b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:b6f5c3ea62884de3dd7242df8d3706679f5362880afe48e2bc9adeff5328c56b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:32492287e1267ddbbcbd352f769d7428cc70373c2afafd8e70f4ce436daa900e
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:b5f30d1327c070ee30d3d09033e3249b4c74930cf32fbd2ebe95bcb38e410b36
findings: []
conditions: []
rollback_to: none
summary: >-
  D-17はpilot test-codeの担当切替、D-18はtest-only validatorのdependency
  gateをfail-closedな静的import allowlistへ変更する実装保証だけであり、承認済み
  TESTCASESのR-001〜R-010相当のselection、PNG、transport、全mapping、22
  schema、prompt、run/retry、DAG、approval、isolation、metrics、期待Red、
  独立oracle・mutation・count・toleranceを削減または変更していない。15,056件の
  conformance registryを含む下流test-code保証を弱める決定もない。DESIGNおよび
  規範protocolとの24画像・全24 human final・production隔離・残り182件非昇格の
  境界は一致する。物理分類は引き続き2D project annotationでありground truthを
  主張せず、indeterminate/nullを維持する。独立再計算でもgrowth 76/243、branch
  44/2304、hollowing 93/243、confidence 27/81およびWilson区間
  [0.3142742581957335,0.6857257418042665]は規範値と整合した。
```
## test-code approval: post-commit fixture corrections

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:9b491f872fa9e15c31f8a608f6b4430431b0dc1996b9d7c492e10d62fdff3bd5
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:aa44ccb8dbe32db9c357a42108b7bf15d413b7afa169739f531d234fa9c20e6b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-images.mjs
    hash: sha256:9d0fd79526f004eade44c13829d85088aca8a0e279ee2bc61e4d4235d7c87af1
  - path: apps/snow-crystal-sim/tests/calibration/pilot-metrics-isolation.mjs
    hash: sha256:06aa92cd86c0cf45738db621aea75d99de5b53e9215d1857201ba3126cad08bb
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:2c57ea859545e745ed64b96bd1be018ce9e514cd39d9ef24cfa078f6b76e88da
  - path: apps/snow-crystal-sim/tests/calibration/pilot-schema-cases.mjs
    hash: sha256:95150ce11bcad306a46b2f30aa0cc22e25bfa6197183de2bbbf535878e70767c
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:ed59776afec32828b403cb8f85d0d72f4503905a134dd0223a9c71be69477f09
  - path: apps/snow-crystal-sim/tests/calibration/pilot-workflow-fixtures.mjs
    hash: sha256:117804178890a33d5c1f7fa6275d4ea070472f21bb41cb8c3d2ceadfcdf1272f
findings: []
conditions: []
rollback_to: none
summary: "前回承認後の変更を独立再検証した。slot-plans fixtureのrestrictedMapはschemaとprotocol・manifest・selection-plan hashへ結合された24件で、anonymous/source IDはいずれも24件一意、source IDのASCII昇順集合からhuman-individual全24件、consensus categoryとの結合からhuman-batch集合を再導出できる。individual-23負例はこの根拠を保持してplan内hashだけを不一致にし、top-level selectionPlan、sourceIds、固定期待hashを追加していない。rendererは元template上の一意なASCII byte rangeを出現順に一回だけ置換し、annotator 2件とadjudicator 1件の全positiveで独立single-pass実装とbyte/hash一致した。挿入protocol JSON内のplaceholder文字列は保存され、旧sequential実装とは全件hashが異なる。annotatorのorder負例2件もpositiveと異なるrendered/JCS結合hashになり、no-opではない。8ファイルからregistryを独立再構築して15056件（positive 1031、negative 14025）を確認し、schema、mapping、transport、run、DAG、approval、isolation、metricsの件数に回帰はない。D-18 self-checkは710 reject、81 allow、15 path case、native builtin capability exposure 0で成功し、7 support moduleのnode --checkと対象diffのwhitespace検査も成功した。実装中validatorはreview対象およびoracleから除外した。"
```
## implementation review: morphology ensemble pilot validator

```yaml
review_type: implementation
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs
    hash: sha256:c12c0e0a8e6fadeddf119d6f8798a418e976049130fa876aca6a082eff264e38
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator-core.mjs
    hash: sha256:192e4c208fe16afba698b367971c5f1e354378e3b67e8329b74cc61998c6a59a
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator-schema.mjs
    hash: sha256:b25629a98ae4272bfa48f79a22671d1ba136914670aec332a507fb084cd93d69
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator-io.mjs
    hash: sha256:17fc40a06ba37729fc1d689369b7c0310bb3aea303b61d251105f244148fe9be
findings:
  - id: R-001
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs:83
    problem: "annotation raw response/modelPayloadsが凍結artifact recordsのpayloadへ結合されておらず、captureと正式recordが異なるrunを受理する。"
    evidence: "独立mutationでpositive annotation-runのmodelPayloads[0].evidenceだけを変更し、rawResponseBytes、capturedResponseFileSha256、artifact bytes/file hashを整合させた。recordsと各modelPayloadObjectSha256は変更していないが、validatePilot('annotation-run', fixture)は成功した。実装はparsed rawとmodelPayloadsの一致、およびrecord自身のhashを別々に検査するだけで、modelPayloads各要素とrecordsから導出したpayloadOf(record)を比較していない。これはTC-PILOT-RUN-002のcapture integrityと12件atomic batch契約を破る。"
    required_change: "raw responseからparseした全model payloadを、manifest順の全recordsから導出したpayloadへ件数・ID・順序・全fieldを含めて完全一致させる。annotationとadjudicationの双方へ同種の独立negative mutationを追加し、raw、modelPayloads、recordsのいずれか一つだけが異なる場合を拒否する。"
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs:126
    problem: "InvalidAttemptEvidenceV1の必須意味制約を検査せず、PII混入を明示するevidenceさえ正当なinvalid attemptとして受理する。"
    evidence: "positive invalid-attempt fixtureのcontainsPiiをtrueへ変更し、その内容からevidence ID、filename、canonical bytes、file hashを独立再計算したところ、validatePilot('invalid-attempt', fixture)は成功した。実装はproperty allowlist、UTC、raw length/hash、validationErrors件数、campaign hash、evidence ID/file hashだけを検査し、containsPii=false、containsRawResponse=false、schema/contract/protocol/policy literal、attempt/disposition対応、plan/run参照の完全結合を検査していない。"
    required_change: "InvalidAttemptEvidenceV1の完全schemaと規範意味制約を適用し、containsPii/containsRawResponseはfalse固定、attempt 1..3とdisposition、campaign kind、actor/batch/slot/plan/prompt/input/run参照を凍結campaignへ完全結合する。内部整合するよう全hashを再計算したPII・raw-response・参照差替えmutationも拒否する回帰テストを追加する。"
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs:249
    problem: "artifact DAG検査がcycleとunknown IDだけで、規範§13の必須node・一方向dependency closureを検証しない。"
    evidence: "positive artifact-dag fixtureの全nodeからdependenciesを削除して孤立node集合にした独立mutationでもvalidatePilot('artifact-dag', fixture)はtrueを返した。これによりrunからprompt/input/plan、consensusからruns、approvalからactive upstream、coverageからapprovalへのprovenance edgeをすべて失っても通過する。"
    required_change: "規範§13のnode集合と各nodeの必須dependency closureを入力artifact/hashから再構成し、欠落、余分、逆向き、自己参照、後続参照を拒否する。少なくとも全edge削除、単一必須edge削除、合法だが余分な前方edgeを独立mutationへ追加する。"
conditions: []
rollback_to: test-code
summary: "D-18のliteral static import allowlist、relative closure、filesystem/network guardには回帰を認めず、2D project annotationを物理ground truthへ拡張する処理もなかった。対象Vitestは14/14、typecheck、4ファイルのnode --checkが成功した。verify-fastは2476 Green・1 skipで、既知のproduction成果物未作成による5 Redだけだった。しかし登録外の独立mutationでraw capture分離、PII付きinvalid-attempt、依存edge欠落DAGの3経路が受理された。承認済みTESTCASESが要求するcapture integrity、privacy、完全DAGを保証できず、現行テストもこれらを検出しないためtest-codeへ戻す必要がある。"
```
## test-code review: implementation-review gap regressions

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-workflow-fixtures.mjs
    hash: sha256:77a8e0769928e0e268493d13d1da6a6b928591f87073ef688cd1b82338daef14
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:870a32dd3fcbd089826713bbdf632f2f67d820dfe25419666a4f87b31d61107b
findings: []
conditions: []
rollback_to: none
summary: "前回implementation reviewのR-001〜R-003を独立再検証した。annotation 6 runとadjudicationのraw response、modelPayloads、正式recordsについて、件数・順序・ID・観察・分類・全根拠field・adjudication固有fieldを各層単独およびraw+modelPayloadsで変異し、capture/file/record hashを再計算したnegativeが追加されている。InvalidAttemptEvidenceV1はPII/raw-response flag、固定literal、attempt/disposition、root/replacement条件、actor/batch/slot/plan、全prompt/input参照、主要run metadata、campaign再hash変異を含み、root/replacement各attempt 1..3のpositiveも保持する。DAGは独立literal 21 node closureから、全edge削除、各必須edge欠落・逆転・重複、各node欠落・重複・自己参照、invalid-attempt node混入、およびacyclicな余分edgeを決定論的に列挙する。既存contract、物理分類mapping、test oracleを弱める変更やvalidatorへの依存はない。両moduleのnode --checkとgit diff --checkは成功し、対象Vitestは13件Green、現validatorが余分なDAG edgeを受理する新規期待Red 1件だけで失敗した。"
```
## test-code review: pilot conformance performance correction

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-schema-cases.mjs
    hash: sha256:76e1790291f63c9bd2d63cd9406bfa373d92b934f58386f6afb7c64e563e5215
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:d574d7fc0c56446d0276a613203b24cddfe477b868728b09de7590cc0e60edad
findings: []
conditions: []
rollback_to: none
summary: "HEAD bd36b18との差分を限定監査した。schemaGood/schemaBadはschema objectだけを共有し、mutableなvalueはケースごとにclone、bytesはimmutable stringとして保持する。全mutationはvalueまたはbytesだけを変更し、validatorへは各case fixtureのdeep cloneが渡るためケース間汚染はない。削除されたbefore比較はvalidatorへ渡らない元fixtureの冗長検査だけで、実際に渡すfixtureのinputBefore比較は維持されている。error class/reason/field/expected、120秒timeout、ランダムshuffle、逆順repeat、fresh metamorphic、skip 0はいずれも不変。registryを独立再構築して15,980件（positive 1,037、negative 14,943）、schema fixture 9,603件、共有schema identity 22個を確認した。対象Vitestは14/14 Green、TypeScript typecheck、node --check、git diff --checkも成功した。mapping 76/243・44/2304・93/243・27/81、静的依存境界、物理的分類契約には変更がない。"
```
## implementation review: pilot validator final retry

```yaml
review_type: implementation
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs
    hash: sha256:adb5022cb033dd5c7685930dbc4fb49b6ae261781479e1e06fb6885238e27d6b
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator-core.mjs
    hash: sha256:7d810161286431c5da9a3ac33e89a88dd612c4eb0453b9577718bbc980c20f30
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator-schema.mjs
    hash: sha256:b25629a98ae4272bfa48f79a22671d1ba136914670aec332a507fb084cd93d69
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator-io.mjs
    hash: sha256:17fc40a06ba37729fc1d689369b7c0310bb3aea303b61d251105f244148fe9be
findings:
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs:180
    problem: >-
      InvalidAttemptEvidenceV1 の validationErrors 要素へ規範schemaのenumとRFC 6901制約を適用しておらず、
      再署名された不正な監査証跡を有効として受理する。
    evidence: >-
      positive invalid-attempt fixtureのvalidationErrors[0].codeをinvented-codeへ変更したケースと、
      jsonPointerをnot/a/pointerへ変更したケースについて、invalidAttemptEvidenceId、evidence bytes、
      filename、file hashを独立再計算したところ、validatePilot('invalid-attempt', fixture)はいずれも成功した。
      protocol §8.1はcodeを13個のInvalidAttemptValidationErrorCodeV1 literalへ限定し、jsonPointerを
      RFC 6901 pointerまたはnullへ限定している。現実装はcodeを非空NFC文字列、pointerを任意文字列としてしか検査しない。
    required_change: >-
      InvalidAttemptEvidenceV1の完全な規範schemaをinvalid-attempt検証へ適用し、validationErrors[0].codeを
      規定enumへ、jsonPointerを有効なRFC 6901 pointerまたはnullへ限定する。ID/file hashを再計算した各不正値が
      拒否される独立回帰ケースをtest-codeへ追加する。
conditions: []
rollback_to: test-code
summary: >-
  前回R-001のraw/modelPayloads/records全field結合とR-003のexact 21-node DAG closureは解消した。
  対象14テスト、型検査、4ファイルのnode --check、D-18依存・副作用境界、入力不変性、物理mapping非拡張も通過した。
  verify-fastは2476 pass、1既存skip、既知production成果物不足5 Redのみだったが、R-002の完全schema検証が未解消である。
```
## test-code review: invalid-attempt validation error vocabulary

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:fc0a45a6834823a2773c2de223c406b5925d39c1c15e85b9301b3997aa99c49c
findings: []
conditions: []
rollback_to: none
summary: >-
  HEAD d0427f4からの差分はTC-PILOT-ATTEMPT-001のvalidationErrors回帰56件だけであり、
  既存15,980件を変更せずregistryを16,036件へ増やす。規範13 codeをnull、空文字、
  通常token、~0/~1 escapeを含む有効RFC 6901 pointerとの直積52 positiveで検査し、
  unknown code、先頭slashなし、~2 escape、末尾dangling ~の4 negativeを独立に追加している。
  全mutationはinvalidAttemptEvidenceId、filename、canonical evidence bytes、file SHA-256を
  再計算・自己検証するためstale hashでは通らず、既存schema mutationも削除・緩和されていない。
  RangeError、invalid-attempt-evidence、対象fieldという契約は既存のtyped first-error oracleと
  前回implementation review R-002の要求に整合し、validator内部手順には依存しない。
  node --checkとgit diff --checkは成功し、対象Vitestは13 pass、追加したdangling escape拒否だけが
  現validatorで期待どおりRedとなった。
```
## implementation review: pilot validator semantic completeness

```yaml
review_type: implementation
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs
    hash: sha256:9c13086e94d19d55219e64df2739741959582fd9cdcf8395f65f11200d37b4c7
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator-core.mjs
    hash: sha256:7d810161286431c5da9a3ac33e89a88dd612c4eb0453b9577718bbc980c20f30
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator-schema.mjs
    hash: sha256:b25629a98ae4272bfa48f79a22671d1ba136914670aec332a507fb084cd93d69
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator-io.mjs
    hash: sha256:17fc40a06ba37729fc1d689369b7c0310bb3aea303b61d251105f244148fe9be
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs:153
    problem: >-
      replacement-materialization の InvalidAttemptEvidenceV1 を
      replacementReasonCode=model-retry に固定しており、規範protocol §8.1が許可する
      schema-fix、prompt-change、input-change の正当なreplacement campaignを拒否する。
    evidence: >-
      expectedCampaign の replacementReasonCode はreplacement時に常にmodel-retry、
      changedInputSha256は常に現在のrun.fileSha256として構築される。規範protocol
      MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md:925-927および967-973は4種類のreasonを許可し、
      schema-fixでは新schema file、prompt-changeでは新prompt variables object、
      input-changeでは新batch input table、model-retryではcampaign開始時active artifact fileの
      hashへchangedInputSha256を結合するよう要求している。現登録16,036ケースには
      model-retry以外の正例がなく、対象14テストがGreenでもこの拒否回帰を検出できない。
    required_change: >-
      4種類すべてのreplacement reasonについて、campaign開始時active artifactと変更後の
      schema/prompt/inputを独立した権威入力へ結合してexpected campaignを導出する。
      各reasonの正例と、reasonとchangedInputSha256の組合せ交換を再署名して拒否させる
      独立回帰ケースをtest-codeへ追加する。
conditions: []
rollback_to: test-code
summary: >-
  raw/modelPayloads/recordsの全field結合、13 validation error codeとRFC 6901 pointer、
  exact 21-node DAG closure、D-18静的依存境界、入力不変性、承認済み物理mappingの非拡張は
  独立確認できた。対象Vitestは14/14、typecheckとnode --checkは成功し、verify-fastは
  2476 pass、既知のproduction artifact不足5 Red、既存skip 1だった。ただし規範上有効な
  3種類のreplacement campaignを拒否する未検査の高重大度回帰が残るため承認できない。
```
## test-code review: replacement authority matrix

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:567d5beb7b157495e16f7baa5811b6f81e422b7166f7ae26e811dc1d2335c070
findings:
  - id: R-001
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:20
    problem: >-
      schema-fix、prompt-change、input-change の正例が、実在する新しい凍結artifactから
      導出されたcampaignではなく、H('replacement/...')で作った孤立hashと一部fieldの
      差替えだけになっているため、規範上整合するreplacement campaignを表していない。
    evidence: >-
      protocol §3のcampaign preimageと§8.1だけでなく、§14はschema file bytes、
      modelPayloadSchemaObjectSha256、PromptVariablesV1、RenderedPromptEvidenceV1、
      renderedPromptSha256、batch input tableを相互導出して完全一致させる。現在の
      schema-fixはschemaFileSha256だけを変え、schema object、prompt variables、
      rendered evidence/prompt、protocol参照を旧値のまま残す。input-changeも新table hashだけを
      置き、tableを含む新PromptVariablesV1とrendered artifactを作らない。
      prompt-changeも新prompt variables objectの実体とrendered artifactを持たない。
      したがって自己整合したhash文字列ではあっても、再計算可能な凍結campaignではない。
    required_change: >-
      3種類それぞれについて新schema bytes/object、新PromptVariablesV1、
      RenderedPromptEvidenceV1/rendered prompt、新BatchInputTableV1など必要な実体を
      test側で独立構築し、各hashを実bytes/objectから計算する。campaign、promptRefs、
      inputRefs、protocol/plan参照まで規範どおり連鎖させ、全cross-referenceをassertした
      正例から負例を作る。単なるラベル由来hashを権威入力として扱わない。
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:114
    problem: >-
      reason/hash交換、stale、current、wrong-authorityのmutationは
      changedInputSha256だけを壊しているのに、非model-retryの54ケースで
      exact first-error fieldをreplacementReasonCodeと要求している。
    evidence: >-
      lines 115および122が変更するのはcampaign/evidenceのchangedInputSha256であり、
      replacementReasonCodeは元の正当な値のままである。それにもかかわらずlines 116、123は
      schema-fix、prompt-change、input-changeでreplacementReasonCodeを期待するため、
      正しいvalidatorがchangedInputSha256を報告するとテストが失敗する。またmodel-retryの
      current値は実際の開始時active artifact file hashであるrun.fileSha256ではなく、
      H('replacement/current-active-before-campaign')という架空値であり、current境界を検査していない。
    required_change: >-
      hash authority不一致のexact fieldを全reasonでchangedInputSha256にする。
      stale/current/wrong-authorityは実際の凍結artifactから導出し、model-retryでは
      開始時current active file hashを正例として扱う。異なる旧・将来artifactを検査するなら、
      それらの実体とfile hashをfixtureに含める。
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:95
    problem: >-
      replacement campaignの4 field全non-null制約について、campaignとevidenceの双方を
      整合してnullへ変更し再署名する意味境界テストがない。
    evidence: >-
      active-nullはevidence.activeArtifactBeforeCampaignだけをnullにしてcampaign側を残すため、
      単純な参照不一致しか検出しない。replacementReasonCodeとchangedInputSha256にも
      campaign/evidence双方をnullにするケースがない。InvalidAttemptEvidence schemaでは
      これらのnullがroot campaign用に許可され、complete schema walkもroot sampleだけを使うため、
      replacement固有の全non-null意味制約を代替検査できない。
    required_change: >-
      replacement campaignについて、開始時active 2 field、replacementReasonCode、
      changedInputSha256を各々nullにしたcampaignを作り、対応するevidenceも整合更新して
      campaign ID・evidence ID・file hashを再計算した独立負例を追加する。
  - id: R-004
    severity: medium
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:95
    problem: >-
      既存16,036ケースを意味的に保持できておらず、model-retry正例3件を完全重複登録する一方、
      valid-enumのcampaign/evidence reason不一致テストをinvalid enumテストへ弱めている。
    evidence: >-
      独立registry生成結果は16,120件（positive 1,101、negative 15,019）で、追加数は84件だった。
      しかしsemantic-positive/model-retry/{1,2,3}と
      replacement-positive/model-retry/{1,2,3}はattemptごとにfixture hashが完全一致した。
      また従来のmodel-retry campaignに対してevidence reasonだけをschema-fixへ変える
      valid-enum不一致が、not-a-reasonへ変更され、既存のcross-document binding検査を
      enum検査へ置換している。新matrixはhashだけを交換するため、この失われた検査を補わない。
    required_change: >-
      root正例と4 reason×3 attempt正例を重複なく登録する。従来のvalid-enum
      replacementReasonCode不一致を保持し、unknown enum拒否は別ケースとして追加する。
conditions: []
rollback_to: test-code
summary: >-
  対象hashは指定値と一致し、node --checkは成功した。独立registryは16,120件で、
  4 reason×3 attemptのラベル、36 reason/hash交換負例、36 stale/current/wrong-authority負例を
  生成する。対象Vitestは13 pass・1 expected Redで、最初のschema-fix正例を現validatorが
  replacementReasonCodeで拒否した。ただし追加正例が再計算可能な凍結artifact chainではなく、
  exact error field、replacement null境界、既存検査保持にも欠陥があるためtest-code gateは承認できない。
  test表はvalidatorと共有されておらず、静的依存境界自体は維持されている。
```
## test-code review: replacement authority matrix re-review

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:50fe82ab7072c50cdef6bfdd2ff152f24b50d2d731f4c441b7a46dbd16731e25
findings:
  - id: R-001
    severity: critical
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:24
    problem: >-
      schema-fix、prompt-change、input-change の9正例が、protocol §14を満たす
      reason別の凍結artifact chainになっていない。
    evidence: >-
      materializeReplacementは3 reasonすべてでschema.$idとbatch input tableを同時に変更し、
      prompt variablesとrendered promptを再計算する一方、protocol objectとprompt templateは
      元のまま保持する。独立計算では9正例すべてでreplacement schema file hashが
      protocol.schemaFiles.annotationPayloadSchemaFileSha256と不一致だった。また全reasonで
      schema、table、prompt variablesが同時に変わり、prompt-changeでもtemplate hashは変化しない。
      §14はschema file hashとprotocol、PromptVariablesV1、RenderedPromptEvidenceV1、
      generator参照の完全一致を要求し、template変更時はprotocol再発行とplan再作成を要求する。
      現fixtureは自己整合する一部hashを持つだけで、規範上有効な正例ではない。
    required_change: >-
      reasonごとに影響しない入力を維持した独立materializerを作り、schema bytes/object、
      batch table、prompt variables、rendered evidence/prompt、protocolおよびplan参照を
      規範どおり再発行・連鎖させる。prompt-changeを既存protocolの下で正当に具体化できない場合は、
      架空の正例を作らず上位設計へ差し戻す。
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:155
    problem: >-
      staleおよび一部wrong-authority mutationのhash preimageが登録fixtureに保存されず、
      登録後は実体から再計算できない不透明なdigestになっている。
    evidence: >-
      replacementSources.staleは関数内でだけ構築され、semanticBadへ渡すfixtureの
      replacementInputsには正例側sourceしか残らない。したがってstale hashのschema bytes、
      prompt variables、tableは登録caseから復元・検証できない。前回R-002が要求した
      「異なる旧・将来artifactの実体とfile hashをfixtureに含める」を満たしていない。
    required_change: >-
      stale/wrong authorityに使用する凍結artifact実体を各fixtureへ含め、digestをその実体から
      再計算していることをassertする。既存workflow artifactを使える境界では、その実在artifactと
      file hashを直接参照する。
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:136
    problem: >-
      replacement固有4 fieldのcampaign・evidence共同null境界がmodel-retryについて未検査である。
    evidence: >-
      共同再署名nullケースはschema-fix、prompt-change、input-changeだけに生成される。
      model-retryの既存active-null、reason、changed-inputケースはevidence側だけを変更し、
      campaignを非nullのまま残すため、単純なcross-reference不一致しか証明しない。
    required_change: >-
      model-retryについても開始時active ID、active file hash、replacementReasonCode、
      changedInputSha256を個別にnullへ変更し、campaignとevidenceを共同更新してcampaign ID、
      evidence ID、filename、file hashを再計算した負例を追加する。
  - id: R-004
    severity: medium
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:144
    problem: >-
      既存のvalid-enum campaign/evidence reason不一致テストが保持されず、
      unknown-enumテストへ置き換えられている。
    evidence: >-
      旧16,036ケースではmodel-retry campaignに対してevidenceだけをschema-fixへ変え、
      有効enum同士のcross-document不一致を検査した。現コードは同じcaseをnot-a-reasonへ変更し、
      別のvalid-enum不一致caseを追加していない。
    required_change: >-
      evidenceだけをschema-fixへ変える既存valid-enum不一致を復元し、
      not-a-reasonによるunknown-enum拒否は別caseとして保持する。
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs:155
    problem: >-
      期待Redがランダムなcase順に依存し、未実装機能を直接示す決定論的な失敗になっていない。
    evidence: >-
      対象Vitestは13 pass・1 Redになったが、shuffleで非model-retry負例が正例より先に実行され、
      テストはchangedInputSha256を期待したのに現validatorがreplacementReasonCodeで先に拒否して
      失敗した。現validatorではこの負例の期待fieldへ到達不能であり、実行順によって
      どのassertionがRedになるか変わる。一方、3種類の正例を個別実行すると、いずれも
      replacementReasonCodeで拒否され、必要な機能差を直接示した。
    required_change: >-
      shuffle corpusより前に少なくとも1件の規範上有効な非model-retry正例を決定論的に実行し、
      現validatorがその正例を拒否することを唯一の期待Redとして記録する。負例のexact-field検査は
      修正後validatorに対するGreen検証として維持する。
conditions: []
rollback_to: test-code
summary: >-
  対象hashと指定値は一致し、node --checkは成功した。独立registryは期待総数16,137件
  （positive 1,098、negative 15,039）で、追加101件は正例9・負例92、追加case内の
  ID/fixture重複はなく、model-retry正例3件も重複登録されていない。reasonと
  changedInputSha256の4行対応およびmodel-retryのcurrent active file hash自体は正しい。
  ただし非model-retry正例のprotocol/schema/prompt/input chainが規範不適合で、
  model-retry null境界と既存valid-enum不一致も未保持であり、期待Redもshuffle依存のため
  test-code gateは承認できない。物理分類表、単位、数値oracleには変更がない。
```
## design review: D-20 plan-boundary correction

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:6ae0f822d18d4f3861aa21b71fad90c3c7e5ce84bb8a3faf012cddd0db03581a
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:c61012f49aec0ec3b3d93def2d3f9d699f1fcce7057044a5af892013194721ab
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:09b4a06ab87e81abc3ebfbbbef3dcd6595dc03f7587893c4e4ef6041010cca95
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:6ce47bac71b330da0f9356ed9d970e533aeb57f73bda5affb96d44c2de19fa23
findings:
  - id: D20-R001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md:1019
    problem: Campaign state transition table cannot represent a valid retry after an invalid attempt and simultaneously permits a valid attempt 2 or 3 directly from the initial state.
    evidence: Invalid attempts 1 or 2 move root campaigns to root-retryable and replacement campaigns to replacement-retryable, but no valid-attempt row accepts either retryable state. Conversely, valid rows accept attempts 1..3 from root planned or active terminal even though §8.1 requires attempt numbers without gaps. This contradicts TC-PILOT-ATTEMPT-001 sequences invalid→valid and invalid→invalid→valid for root, model-retry, and input-change campaigns.
    required_change: Enumerate valid transitions with state-sensitive attempt numbers: initial state may accept only valid attempt 1, while retryable state may accept the next contiguous valid attempt 2 or 3 backed by preceding invalid evidence. Apply the same rule to root, model-retry, and input-change campaigns, and align testcase wording with the corrected table.
  - id: D20-R002
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md:284
    problem: PilotSelectionPlanV1 has conflicting serializable contracts between DESIGN and the normative protocol.
    evidence: DESIGN states that the plan contains sourcePdfSha256 and includes that property in its TypeScript projection, while the normative schema at MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md:389-406 omits sourcePdfSha256. DESIGN §5.1A declares the protocol the sole authority for serializable properties and requires stopping on semantic conflict.
    required_change: Make the two contracts identical. Either add the direct sourcePdfSha256 binding to the normative selection-plan schema and corresponding tests, or remove it from the DESIGN projection and explicitly document the intended indirect binding through the candidate-set object.
  - id: D20-R003
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md:1041
    problem: The required invalidated-reissue-required closure is not represented by a normative state or evidence contract, so the validator cannot prove that the old plan was closed before the new plan started.
    evidence: Sections 8.1, 13, and 14 require closing the old protocol/plan and TC-PILOT-REISSUE-001 requires testing that closure, but no schema, hash preimage, lifecycle record, or explicitly defined validator state carries invalidated-reissue-required. The defined immutable artifacts can verify prohibited cross-plan references, but not the asserted old-plan closure or prohibition on subsequent submissions under that plan.
    required_change: Define a machine-verifiable, immutable old-plan closure/state contract that does not reference or migrate into the new plan, or narrow the testcase and normative wording to a precisely defined fail-closed validator result plus independently enforceable no-cross-plan checks.
conditions: []
rollback_to: design
summary: D-20 correctly narrows in-plan model replacement to model-retry and attachmentSlot-only input-change, preserves derived prompt regeneration and changedInput authorities, rejects schema-fix and prompt-change as campaign or ledger reasons, and keeps the 24-image, three-model, human-final, privacy, provenance, and physical-interpretation boundaries unchanged. Approval is blocked by the incomplete retry state machine, the selection-plan schema conflict, and the lack of a machine-verifiable old-plan closure contract.
```
## design review: D-20 plan-boundary correction re-review

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:88dd9568e737a5abac9f25a120cdd24fcb9c701dbcb437509cb161e1bedba781
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:bdf96f43db8f042ee2b83afee804f3b398c57f5dbc77d7940c842f78d1267e40
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:5b4574b97bd684bdd4cc3bd03e2a4669fa5b9559e3035102d8c19dbf8ab33522
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:248fa06cd9b488458cf519869a900db27588e519fa27e6d8d8965f75efc0b5f0
findings:
  - id: D20-R004
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md:1692
    problem: "D-20の隔離期待Redとして指定されたplanned stateからのvalid attempt 2は、現validatorが既にattempt番号の連続性検査で拒否するため、記載どおりのassertion failureを発生させられない。"
    evidence: "現validatorのattemptCampaignはsubmissionsを先頭からattemptNumber=i+1に固定しており、planned stateを表す単独valid attempt 2 fixtureはattemptNumber不一致として拒否する。したがってTESTCASESが予告する「現validatorがこの不正attempt 2を受理する」状態は成立せず、test-code工程の決定論的Red要件を満たせない。未知の中間stateをattempt 1として挿入すれば通せる可能性はあるが、それはplanned stateからの直接遷移という規範fixtureではなく、別の型・enum欠陥を利用するものになる。"
    required_change: "隔離Redを、現validatorが実際に受理する未実装のstate-sensitive違反へ置き換える。例えば、連続submission 1,2,3を保ったままretryable-3のimmutable evidence 1,2を同じattempt番号へ重複させる、欠番にする、または別campaign evidenceへ置換し、現validatorが受理することを事前確認した1件を指定する。Redの原因、期待error field、fixture前提をTESTCASESへ明記する。"
conditions: []
rollback_to: design
summary: "前回D20-R001〜R003の設計欠陥は解消された。規範protocolはroot/model-retry/input-change各6行、計18行のstate-sensitive遷移を持ち、初期stateはvalid attempt 1だけ、attempt 2/3は連続するimmutable evidenceを要求する。PilotSelectionPlanV1は固定PDF hashを直接保持し、protocol object・candidate setとの3-way bindingが設計・テストで一致する。PlanClosureV1には完全schema、domain-separated ID preimage、file hash規則、UTC/cutoff、freeze順、terminal registry拒否、出edgeなし、新plan参照禁止、未実行新plan境界が定義された。schema bundleとtest literal listはいずれも23件で、D-20は24画像・3モデル・人間最終判断・privacy・provenance・物理分類境界を変更していない。ただし指定された最初の期待Redが現validatorの既存検査で既にGreenになるため、test-code工程へ進む前にRed fixtureの限定修正が必要である。"
```
## design review: D-22 decisions freshness approval

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:88dd9568e737a5abac9f25a120cdd24fcb9c701dbcb437509cb161e1bedba781
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:bdf96f43db8f042ee2b83afee804f3b398c57f5dbc77d7940c842f78d1267e40
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:fa16236613963557bbcc3f2d2979b8b63b8af98f0de02e4129b7945312e17b52
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:b473ba03e86121eca41fc82d226338a4bd04a0e57bfad7c20af6bc0f2409efeb
findings: []
conditions: []
rollback_to: none
summary: "DESIGN、規範protocol、TESTCASESは承認済みD-20入力とbyte-identicalで、DECISIONSの差分はD-21/D-22の34行追加・削除0行だけである。追加内容はtest-only builderの再構築、正常例と負例行列の直列化、担当分解および進捗を記録し、TESTCASES縮小を明示的に退けているため、D-20の要件、24画像pilot、schema、18状態遷移、PlanClosureV1、物理解釈、単位、適用範囲、loss、独立oracle、許容境界を変更しない。一次資料の206観測契約も公式arXiv v1と整合し、独立再計算でlatticeCellCount(115)=40021、境界半距離49.79708826829135 cells、checkpoint 40の適用範囲内を再確認した。"
```

## testcases review: D-20/D-22 freshness approval

```yaml
review_type: testcases
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/SPEC.md
    hash: sha256:92c0ee8ad1fd22f31915bac66f6369b155072ce70dd725078bfcb5f1f3eaedd1
  - path: docs/simulators/snow-crystal-sim/DESIGN-OUTLINE.md
    hash: sha256:b0aecd2dd517e810913d44e93fea02aa6f50dc56398ef5ee046d9ca514bc68ff
  - path: docs/simulators/snow-crystal-sim/TASKS.md
    hash: sha256:6b8205edc58b83ecb29039d4017461cff53db78390bb9faa99c2672de637cab4
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:88dd9568e737a5abac9f25a120cdd24fcb9c701dbcb437509cb161e1bedba781
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:bdf96f43db8f042ee2b83afee804f3b398c57f5dbc77d7940c842f78d1267e40
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:fa16236613963557bbcc3f2d2979b8b63b8af98f0de02e4129b7945312e17b52
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:b473ba03e86121eca41fc82d226338a4bd04a0e57bfad7c20af6bc0f2409efeb
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs
    hash: sha256:9c13086e94d19d55219e64df2739741959582fd9cdcf8395f65f11200d37b4c7
findings: []
conditions: []
rollback_to: none
summary: >-
  TESTCASESは承認済みD-20設計・規範protocolと整合する。
  rootおよび2 replacement reasonの状態依存attempt遷移、先行immutable evidence、
  authority交換とenum外TypeError、第二plan有無に対応するclosure参照、
  terminal受付拒否、全再発行と旧成果物再利用禁止、23 schema bindingを検査対象としている。
  exact prompt bytes/hash、invalid raw bytes/hash、RGBA hash、Wilson期待値を独立再計算して一致を確認した。
  named duplicate-evidence probeは現validatorの未検査箇所に対応し、
  期待Redをschema/hash・構文・型・依存エラーから分離している。
```

## test-code review: D-22 final approval

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts
    hash: sha256:4fc791f181f6f3f86a5e3e48a88a4a812ed23e781a66be783fa8ed63e86eaa22
  - path: apps/snow-crystal-sim/tests/calibration/pilot-contract-fixtures.mjs
    hash: sha256:22d6f5b9507e35f67fb8d0024d5588b5f6ba5dbcad5c53aa6a789100ff41ff0b
  - path: apps/snow-crystal-sim/tests/calibration/pilot-oracle.mjs
    hash: sha256:9c77878d132652c035fa2feb67db1a4ff98fecf31348fff34c1acf44c17a9275
  - path: apps/snow-crystal-sim/tests/calibration/pilot-state-cases.mjs
    hash: sha256:ff20e2d344ed6508c354519445b6d4bdd2b2fdf46a4c87b776485aed35e17489
  - path: apps/snow-crystal-sim/tests/calibration/pilot-d20-builders.mjs
    hash: sha256:d077df5d64ad79c059fd3317b620e97c31d8420fe5ca5ad4ebf3da046c6fee13
  - path: apps/snow-crystal-sim/tests/calibration/pilot-positive-selfcheck.mjs
    hash: sha256:40a4ac441da6e06b566d22f63316106db3815a08b33831587ed447378ccbfbe0
  - path: apps/snow-crystal-sim/tests/calibration/pilot-d20-negative-builders.mjs
    hash: sha256:fa47ea8d81e35e768162b4bfbce785aef0c54b61d3fc244cb918daf5c230ee9c
  - path: apps/snow-crystal-sim/tests/calibration/pilot-negative-selfcheck.mjs
    hash: sha256:67d530ceb4bfba9d352c99cd01c209f8b0e8b35bc1adfab030722f5a6b5be9f1
findings: []
conditions: []
rollback_to: none
summary: "The D-20/D-22 test-code gate is complete: independent selfchecks passed for 12 reissue chains, 9 valid wrappers, 23 schema authorities, and 253 unique negative rows (48 replacement, 72 attempt-state, 133 reissue); typecheck and syntax checks passed; no skips or weakened tolerances were found; and targeted Vitest produced exactly 14 passing tests plus the sole intentional Red because the current validator accepted the fully re-signed duplicate invalid-evidence attempt."
```

## design review: D-20 final approval

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:88dd9568e737a5abac9f25a120cdd24fcb9c701dbcb437509cb161e1bedba781
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:bdf96f43db8f042ee2b83afee804f3b398c57f5dbc77d7940c842f78d1267e40
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:fa16236613963557bbcc3f2d2979b8b63b8af98f0de02e4129b7945312e17b52
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:248fa06cd9b488458cf519869a900db27588e519fa27e6d8d8965f75efc0b5f0
findings: []
conditions: []
rollback_to: none
summary: "D20-R001〜R004が全て解消された。root・model-retry・input-changeは各6行、計18行のstate-sensitive遷移を持ち、初期stateではattempt 1だけ、retryable-2/3では同一campaignの連続したimmutable evidenceを各exactly 1件要求する。期待Redはsubmission 1,2,3を維持したまま2件目のevidenceだけをattempt 1へ変更してID・JCS+LF bytes・filename・file hashを再計算するためschema/hash不整合ではなく、現validatorが未検査のevidence attempt重複だけを決定論的に検出する。現validatorはsubmission連続性とevidence件数/campaign一致だけを検査するため当該fixtureを受理し、修正後のmissing evidenceおよび別campaign evidenceはGreen回帰として分離されている。PilotSelectionPlanV1は固定PDF hashを直接保持しprotocol object・candidate setとの3-way bindingを要求する。PlanClosureV1はdomain-separated ID、JCS+LF file hash、旧protocol/selection/両slot plan/ledger cutoff、terminal registry、closure後受付拒否、出edgeなし、新plan非参照および未実行新plan境界を機械検査可能に定義する。protocolとtestのschema一覧はともに23件で一致する。D-20は24画像、3モデル、全24件の人間最終確認、production・LocalStorage隔離、残り182件禁止、2D project annotation、非ground-truth、不確実性をindeterminate/nullへ送る物理境界、単位・数式・較正範囲を変更しておらず、上位SPEC/DESIGN-OUTLINEとの矛盾もない。"
```

## design review: D-22 decisions freshness approval (current)

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DESIGN.md
    hash: sha256:88dd9568e737a5abac9f25a120cdd24fcb9c701dbcb437509cb161e1bedba781
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md
    hash: sha256:bdf96f43db8f042ee2b83afee804f3b398c57f5dbc77d7940c842f78d1267e40
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/TESTCASES.md
    hash: sha256:fa16236613963557bbcc3f2d2979b8b63b8af98f0de02e4129b7945312e17b52
  - path: docs/simulators/snow-crystal-sim/tasks/T1-7/DECISIONS.md
    hash: sha256:b473ba03e86121eca41fc82d226338a4bd04a0e57bfad7c20af6bc0f2409efeb
findings: []
conditions: []
rollback_to: none
summary: "DESIGN、規範protocol、TESTCASESは承認済みD-20入力とbyte-identicalで、DECISIONSの差分はD-21/D-22の34行追加・削除0行だけである。追加内容はtest-only builderの再構築、正常例と負例行列の直列化、担当分解および進捗を記録し、TESTCASES縮小を明示的に退けているため、D-20の要件、24画像pilot、schema、18状態遷移、PlanClosureV1、物理解釈、単位、適用範囲、loss、独立oracle、許容境界を変更しない。一次資料の206観測契約も公式arXiv v1と整合し、独立再計算でlatticeCellCount(115)=40021、境界半距離49.79708826829135 cells、checkpoint 40の適用範囲内を再確認した。"
```
