# T1-7 観測コーパスと較正プロトコル — テストケース

## 1. 範囲、権威、テスト配置

本書は承認済み `DESIGN.md` と `DECISIONS.md` を実行可能な検査へ具体化する。対象は
Libbrecht (2023) Figure 2 v1 の静的コーパス、固定 split、較正 protocol、loss、候補選択、
holdout 一回開封手順、および `DESIGN.md` §5.1A / 規範
`MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md` の24画像pilot sidecarである。観測値から Reiter CA の
物理パラメータを導くテストではなく、pilotのproject annotationも三次元形態または物理的ground truthを
確定するオラクルとして扱わない。

- 実行プロファイル: `full`
- UI 影響: なし
- テスト本体（`DECISIONS.md` D-06 による3分割）:
  1. `apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts`
  2. `apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-scoring-protocol.test.ts`
  3. `apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-holdout-safety.test.ts`
- pilot sidecar専用テスト（D-06の既存3ファイルを変更しない独立所有）:
  4. `apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts`
- pilot validator実装（test-only、browser/runtime/domainからexportしない）:
  - `apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs`
- 実装成果物:
  - `apps/snow-crystal-sim/calibration/libbrecht-2023-figure2-v1/{corpus.json,split.json,protocol.json,SHA256SUMS}`
  - `docs/simulators/snow-crystal-sim/tasks/T1-7/SOURCE-AUDIT.json`
  - 上記3 test file
  - pilot専用の4番目のtest fileとtest-only validator module
  - holdout 状態機械の synthetic test だけが使う一時 directory
- 禁止: domain、app、UI、scene、公開 export、論文 PDF、panel crop、mask、raw model/chat response、
  restricted source mapping、pilot個票のrepository追加または変更。既存LocalStorage、source-audit UI、
  `SOURCE-AUDIT.json`、production corpus/split/protocolおよび既存3 test fileもpilot工程では変更しない。

既存3テストファイルは自己完結させ、別の test file、共有 test helper/source file、production validator/scorer、
公開 export を import しない。必要な小さい oracle は所有する test file 内に置く。3ファイルを横断して
共通化するための4個目の helper/source fileは作らない。少なくとも
duplicate-aware JSON scanner、RFC 8785 fixture canonicalizer、SHA-256、十進有理数の単位換算、整数分数、
source candidate preimage/comparison、migration copy oracle、empirical mid-CDF、Neumaier sum、
hex ring 列挙、seed 再生成を独立に実装する。期待値を corpus validator、
split generator、production scorer、T1-3 `morphologyMetrics` から生成してはならない。

pilot専用testは、上記3ファイルのhelperやproduction corpus validatorをimportせず、独立JCS/SHA-256、
直積列挙、truth table、canonical PNG、DAG、Wilson interval、quadratic-weighted kappaのoracleをtest file内に
所有する。実装対象のpilot validatorだけを動的に読み込み、同じ関数から期待値を生成しない。validatorは
`PILOT_WORK_ROOT`のartifactを検査するtest-only library/CLIであり、ネットワーク、browser、LocalStorage、
production runtimeへ依存しない。

### 1.1 テストファイルの単独所有権、ケースID、レビュー順

ケースIDは次の1ファイルだけが所有し、他ファイルへ同じケースまたは同じ完全契約検査を複製しない。

| review順 | test file | 単独所有する testcase ID | 境界 |
|---:|---|---|---|
| 1 | `libbrecht-2023-figure2-schema-artifacts.test.ts` | `TC-CORPUS-001..003`, `TC-SOURCE-001..004`, `TC-SOURCE-AUDIT-001..005`, `TC-ANNOTATION-001..003`, `TC-SHAPE-001..003`, `TC-JCS-001..002`, `TC-SPLIT-003..004`, `TC-PROTOCOL-003..005`, `TC-REAL-001`, `TC-RED-001` | duplicate-aware JSON tokenization、JCS、Corpus/Observation/SourceAudit/Split/Protocol の完全 schema、A/B候補hash・既存入力移行・人間の全field確認、annotation、projected shape、著作権・非ネットワーク・成果物境界、REAL206、および5件すべての期待 Red を所有する。 |
| 2 | `libbrecht-2023-figure2-scoring-protocol.test.ts` | `TC-SPLIT-001..002`, `TC-RANK-001..003`, `TC-CDF-001..003`, `TC-SCALE-001..002`, `TC-CANDIDATE-001`, `TC-BASELINE-001`, `TC-ACCEPT-001`, `TC-PROTOCOL-001..002` | split導出、rank/CDF/scale、seed/radius/lattice、候補・baseline・Pareto と決定的なprotocol数値挙動を所有する。完全 schema validator は持たず、schema fileの完全契約検査を複製しない。 |
| 3 | `libbrecht-2023-figure2-holdout-safety.test.ts` | `TC-HOLDOUT-001..003` | training leakage、sealed検証、永続exclusive marker、atomic write、child-process race、crash/restart状態行列を所有する。 |
| 4 | `libbrecht-2023-figure2-morphology-pilot.test.ts` | `TC-PILOT-*` | 24画像pilotのselection、blinding、transport、mapping、prompt/schema binding、run、retry、consensus、slot/ledger/snapshot、adjudication、全24人間final、isolation、metrics、期待Redを単独所有する。既存3ファイルのcaseを複製しない。 |

test-code reviewは表の順に、各回fresh Reviewerで1ファイルだけを独立に審査する。既存1..3は現在の
承認済み実装を変更せず、今回の追加test-code review対象は4だけとする。validatorは期待Red後の
非物理・test-only実装であり、test-code reviewへ先取りせず、Green後のimplementation差分review対象とする。
caseとoracleの所有者はtest file、検査対象はvalidatorと明確に分離する。
pilot fileは既存3ファイルとhelperを共有しないため、修正が先行ファイルの実行経路を暗黙に変更しない。
ただし上流の `DESIGN.md`、本書、または所有境界が変わった場合は、影響する承認をstaleとして再レビューする。

### 1.2 実コーパスと synthetic fixture の分離

`REAL206` は実装工程で、人間承認済みの実データが **3 JSON と `SHA256SUMS` の計4ファイル**、および
production 経路から独立した `SOURCE-AUDIT.json` に存在する場合だけ完成する fixture である。
本書は206件の source label、panel bounds、annotation、mask hash を捏造しない。`SYN` は validation と
score の手計算だけに使う明示的な架空 fixture であり、`corpusId` や source provenance を実観測として
公開してはならない。テスト名にも必ず `synthetic` を含める。

### 1.3 許容差と等価性

- source の十進単位換算、件数、enum、ID、ordinal、整数分数、JCS bytes、SHA-256、split、seed、状態遷移は
  厳密一致とする。
- `-0` は `Object.is(value,-0)` で検出して拒否する。
- hash は lowercase hex 64桁。hash 比較は文字列厳密一致とする。
- projected-shape の独立再計算だけ
  `64 * Number.EPSILON * max(1, abs(expected))` 以下を許す。interval 端点は再計算した A/B raw 値の
  `Math.min/Math.max` と `Object.is` 相当で厳密一致し、許容差で interval を広げない。
- loss の整数分数は約分済み numerator/denominator を厳密一致させる。binary64 report は定められた
  階層・順序・各階層で再初期化した Neumaier sum の結果と bit-for-bit 一致させる。
- 再現性は `DataView` で binary64 の64 bitを比較し、表示文字列だけを比較しない。

## 2. 共通定数、基底 fixture、error 検査

### TC-CORPUS-001: source metadata と成果物境界

`REAL206` の期待値を次に固定する。

| field | expected |
|---|---|
| `schemaVersion` | `snow-crystal-observation-corpus/1` |
| `corpusId` | `libbrecht-2023-figure2-arxiv-v1` |
| `arxivId` | `2306.13087v1` |
| `doi` | `10.48550/arXiv.2306.13087` |
| `permanentUrl` | `https://arxiv.org/abs/2306.13087v1` |
| `pdfUrl` | `https://arxiv.org/pdf/2306.13087v1` |
| `pdfSha256` | `20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af` |
| `pageCount` | `14` |
| `figureNumber` | `2` |
| `figurePdfPages` | `[11,12,13,14]` |
| `observations.length` | `206` |

repository scan は calibration data directory の直下 basename set が厳密に
`{corpus.json,protocol.json,split.json,SHA256SUMS}` と一致することを確認する。すなわち、許可するのは
**3 JSON と `SHA256SUMS` の計4ファイルだけ**で、余分な JSON、subdirectory、`.pdf`, `.png`, `.jpg`,
`.jpeg`, `.tif`, `.tiff`, `.webp`, `.bmp`, mask binary、base64/data URL、source image replica を一つでも
拒否する。`SOURCE-AUDIT.json` は calibration data directory ではなく task docs 配下に一つだけ置く。
通常テスト中の `fetch`、HTTP(S)、DNS、browser、arXiv access は禁止し、global `fetch` を throwing stub
にしても全テストが通ることを確認する。

### TC-CORPUS-002: duplicate-aware parse、例外 class、message

すべての error は message に `file=<relative path>`, 判明時は `sourceObservationId=<id>`,
`field=<JSON pointer>`, `reason=<stable code>` を含む。I/O error は同じ error を `cause` に保持する。
次は各 mutation を単独で適用する。

| mutation | expected class | field / reason |
|---|---|---|
| raw JSON に同じ `schemaVersion` key を2回記載 | `SyntaxError` | `/schemaVersion`, `duplicate-key` |
| raw JSON の `NaN` token | `SyntaxError` | 該当 field, `json-syntax` |
| raw JSON の `Infinity` / `-Infinity` token | `SyntaxError` | 該当 field, `json-syntax` |
| `1e400` が parse 後 `Infinity` | `RangeError` | 該当 field, `non-finite` |
| number `-0` | `RangeError` | 該当 field, `negative-zero` |
| root/observation/vote/evidence に unknown property | `TypeError` | property pointer, `unknown-property` |
| enum に未知文字列 | `TypeError` | enum pointer, `unknown-enum` |
| number field が文字列または `null` | `TypeError` | field pointer, `wrong-type` |
| ordinal が safe integer 外 | `RangeError` | `/locator/pagePanelOrdinal`, `unsafe-integer` |
| empty raw label | `RangeError` | raw field, `empty-string` |
|存在しない file|元の I/O error class|file path, `io`; `cause` 厳密一致|

duplicate key は `JSON.parse` が上書きした object を validator に渡す前に拒否する。全 raw text を対象にし、
nested object の duplicate も同じ扱いとする。

### TC-CORPUS-003: validation precedence

設計 §7 の番号順で最初の失敗だけを返す。次の複合 mutation で順序を固定する。

| mutations | first expected failure |
|---|---|
| duplicate key + 205件 | `SyntaxError`, `duplicate-key` |
| unknown root property + 205件 | `TypeError`, `unknown-property` |
| 205件 + duplicate ID | `RangeError`, `/observations`, `wrong-count` |
| duplicate ID + empty raw label | `RangeError`, `sourceObservationId`, `duplicate-id` |
| bad raw conversion + bad uncertainty | `RangeError`, raw/normalized field, `unit-mismatch` |
| bad uncertainty + transcription disagreement | `RangeError`, uncertainty field, `constant-mismatch` |
| unresolved transcription + bad morphology enum | `RangeError`, transcription field, `unresolved-audit` |
| unapproved morphology + bad projected interval | `RangeError`, `/annotationApprovals`, `annotation-approval` |
| bad extraction raw value + bad final interval | `RangeError`, extraction raw field, `recalculation-mismatch` |
| valid corpus + noncanonical observation order + split hash mismatch | `RangeError`, `/observations`, `noncanonical-order` |

## 3. 出典転記、ID、完全性

### TC-SOURCE-001: page、ordinal、locator の全件検査

`REAL206` の206 IDを ASCII 昇順および file order で検査する。

1. ID は `^L23-F2-P(11|12|13|14)-N[0-9]{3}$`。
2. `Pxx===locator.pdfPage`、`Nxxx===pagePanelOrdinal`。
3. 各 page の ordinal set は `1..maxOrdinal` と厳密一致し、欠番・0・重複がない。page 間で ordinal は
   `1` に戻る。
4. ID、`[pdfPage,pagePanelOrdinal]`、`panelBoundsPdfPt` の各 tuple は一意。
5. bounds の4数は有限、`left>=cropLeft`, `bottom>=cropBottom`, `width>0`, `height>0` で、右上が
   PDF crop box 内。bounds 同一は別IDでも拒否する。
6. 4 page の件数合計だけを literal `206` とする。page別件数は production corpus から作らず、固定hash PDFを
   production経路と別に独立A/B候補を原PDF全件目視で人間確認した `SOURCE-AUDIT.json.pages` と比較する。
   本書からも作らない。

mutation は duplicate ID、duplicate locator、duplicate bounds、page内 ordinal 1件欠落、N002 を N004へ
変更、205件、207件を個別に作り、すべて `RangeError` にする。205/207 は一意性より先に
`field=/observations, reason=wrong-count` で失敗する。

### TC-SOURCE-002: synthetic raw 単位換算

production parserを呼ばず十進文字列を分子・10の冪・単位へ分ける oracle で、次の架空 panel を確認する。

| raw field | literal | normalized expected |
|---|---|---|
| temperature | `-15.0 °C` | `temperatureC=-15` |
| supersaturation | `12.5 %` | `supersaturationPct=12.5` |
| growth time | `2 min` | `growthTimeSeconds=120` |
| square FOV | `0.40 mm` | `squareFieldOfViewUm=400` |

同じ意味の `120 s` と `400 µm` もそれぞれ120、400になる。temperature/supersaturation は source stated
valueを保持し、clampしない。time/FOVは有限かつ正で、`0`, 負値、暗黙 unit、unknown unit は
`RangeError(unit-or-domain)`。この fixture は論文の実 panel 値ではない。

### TC-SOURCE-003: uncertainty と product-domain 境界

全206点で次を厳密検査する。

```text
temperaturePlusMinusC === 0.2
supersaturationFactorRange === [0.8,1.2]
growthTime === "not-reported"
squareFieldOfView === "not-reported"
inProductDomain === (-30 <= T && T <= 0 && 0 <= S && S <= 30)
exclusionReason === (inProductDomain ? null : "outside-product-domain")
```

synthetic 境界 `(-30,0),(0,30)` は true、`(-30.000000000000004,0)`, `(0,30.000000000000004)` は false。
範囲外値を `-30/0/30` へ clamp した object は source normalized value不一致として拒否する。source
uncertainty を time/FOVへ流用した文字列や数値も拒否する。

### TC-SOURCE-004: 独立A/B転記 evidence と人間確定値

- A/B の4 fieldで `raw` と `normalized` がすべて厳密一致する場合だけ `auditStatus='agreed'`, note `null`。
- `raw` だけ、normalizedだけ、または一 fieldだけ違う場合は `adjudicated` と空でない noteを要求する。
  FOV末尾のU+03BC/U+00B5だけが異なる場合も、A/B原文字列を保持するこのcorpus evidenceでは
  `adjudicated` のままとし、`agreed` へ書き換えない。限定同値とfinal rawのU+00B5化は
  `SOURCE-AUDIT.json` のcandidate comparisonで別に検証する。
- `sourceCheckedAgainstPdfSha256` は固定PDF hashと一致する。
- `pending`、空 note、A/B不一致のまま `agreed`、一致したまま理由なく `adjudicated`、人間確定値が raw labelの
  単位換算と一致しないケースを拒否する。
- `REAL206` は全点について resolved statusであり、未解決を drop せず `RangeError(unresolved-audit)`。

### TC-SOURCE-AUDIT-001: A/B候補＋人間全件確認 manifest の完全 schema

`docs/simulators/snow-crystal-sim/tasks/T1-7/SOURCE-AUDIT.json` を production の corpus loader、
transcription generator、候補比較 generator を import しない duplicate-aware parser で読む。
正例 `REAL206_AUDIT` は人間監査工程でコミットされた file 自身であり、次の全 property を必須、
追加 property を禁止する。

```text
root:
  schemaVersion="snow-crystal-source-audit/1"
  corpusId="libbrecht-2023-figure2-arxiv-v1"
  sourcePdfSha256="20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af"
  auditMethod={kind:"independent-ai-candidates-human-source-pdf-verification",
               candidatePrefillEnabledOnlyAfterBothDraftsFrozen:true,
               productionCorpusReadDuringHumanVerification:false,
               productionGeneratorUsed:false,
               imageArtifactsCommitted:false}
  candidateDrafts={
    transcriberASetSha256:
      "de2d1e32eed414f020c1be76fc82b2209848da2b399aa1f00c96ecb55638f732",
    transcriberBSetSha256:
      "b641538a2344cb348e62532cb6e48aaf3b9b5cf236fd703a51a7f1b3d9cdcfd3",
    comparisonSetSha256:
      "33c545adebfae122fea0d84985445f60eeb7f17ed1e0e9ba2cb99d7a34b6bad9",
    eachDraftObservationCount:206
  }
  priorHumanCaptureMigration={
    sourceKind:"local-storage-human-source-audit-draft/1",
    sourceFileSha256:
      "9fd9708029f553e386dfd2dece8df5f8237d5c8b586502d90bfbe93b8bb47f0c",
    entryObjectCount:33,
    migratedConfirmedCompleteCount:32,
    incompleteSourceObservationIds:["P11-N033"],
    migratedConfirmedIdSetSha256:
      "92e23ab4ae1ea2b1406296a11e94ab519a1c020fb2a54559acf4b4bf0fbc6ea5",
    confirmedValuesOverwrittenDuringMigration:false,
    originalVerificationTimeKnown:false
  }
  pages=[page11,page12,page13,page14]
  observations=[...206 human-confirmed source entries in sourceObservationId ASCII order...]
  sourceEntrySetSha256=<human-audit freezeで確定する64桁lowercase hex>
  preAnnotationSplitAssignmentSha256=<annotation前freezeで確定する64桁lowercase hex>
  canonicalCorpusSha256=<最終corpusのJCS hashとして確定する64桁lowercase hex>
  auditPayloadSha256=<定義済みpayloadのJCS hashとして確定する64桁lowercase hex>
  approval={decision:"approved",approverRole:"human-source-auditor",
            sourcePdfSha256:<rootと同じ固定PDF hash>,
            sourceEntrySetSha256:<rootと同じ値>,
            canonicalCorpusSha256:<rootと同じ値>,
            auditPayloadSha256:<rootと同じ値>,
            approvedAtUtc:<YYYY-MM-DDTHH:mm:ssZ>,note:<string|null>}

pageN:
  {pdfPage:<11|12|13|14>,panelCount:<nonnegative safe integer>,
   sourceObservationIds:<page-local ordinal順のID配列>}

observation:
  {sourceObservationId,locator:{pdfPage,pagePanelOrdinal,panelBoundsPdfPt:[left,bottom,width,height]},
   rawLabels:{temperature,supersaturation,growthTime,squareFieldOfView},
   normalizedSourceValues:{temperatureC,supersaturationPct,growthTimeSeconds,
                           squareFieldOfViewUm,inProductDomain,exclusionReason},
   verification:{
     sourcePanelInspected:true,
     fields:{
       temperature:<SourceAuditFieldVerificationV1>,
       supersaturation:<SourceAuditFieldVerificationV1>,
       growthTime:<SourceAuditFieldVerificationV1>,
       squareFieldOfView:<SourceAuditFieldVerificationV1>
     },
     verifiedByRole:"human-source-auditor",
     verificationRecordedAtUtc:<YYYY-MM-DDTHH:mm:ssZ>
   }}

SourceAuditFieldVerificationV1:
  {candidateComparison:<"exact"|"canonical-unit-equivalent"|"different">,
   humanAction:<"confirmed-proposal"|"resolved-disagreement"|
                "corrected-proposal"|"preserved-prior-human-confirmation">,
   humanConfirmedRawAndNormalized:true,
   rationale:<string|null>}
```

`<...>` はこの工程で作る架空値ではなく、固定hash PDFを人間が全件確認して初めて置換・凍結する
実観測 placeholder contract である。テストケース本文やgeneratorはpage別件数、個別raw label、bounds、
normalized value、source/corpus/auditの最終hashを生成しない。A/B候補3 hashと移行ID集合hashだけは、
凍結済み候補とbackupから本書で既知値へ固定する。`pages` の順は厳密に `[11,12,13,14]`、各pageのIDは
page-local ordinal 昇順、`observations` は ID の ASCII 昇順、page count 合計・page ID 合計・observation 数は
すべて206、全ID集合は厳密一致する。全206 observationで `sourcePanelInspected===true`、
4 fieldすべての `humanConfirmedRawAndNormalized===true`、合計824 field verificationを要求する。

schema field coverage 用の `SYN-AUDIT-ENTRY` は実観測でないことを名前に固定し、
`L23-F2-P11-N001`, bounds `[10,20,30,40]`, raw `[-15.0 °C,12.5 %,2 min,0.40 mm]`,
normalized `[-15,12.5,120,400,true,null]` を literal にする。verificationは
`sourcePanelInspected=true`、4 fieldとも
`{candidateComparison:"exact",humanAction:"confirmed-proposal",
humanConfirmedRawAndNormalized:true,rationale:null}`、role `human-source-auditor`、
UTC `2026-10-08T12:00:00Z` とする。これは個別 entry の型、順序、単位換算、field確認、JCS mutationを
試すだけで、REAL206 の件数・内容・hash の期待値には使わない。

### TC-SOURCE-AUDIT-002: A/B・comparison hash preimage と限定文字同値

production corpus の各 observation から source-only projection
`{sourceObservationId,locator,rawLabels,normalizedSourceValues}` を作り、IDで joinして
`REAL206_AUDIT.observations` の独立値と全 field 厳密比較する。expected 側を production corpus、同じ
generator、production validator の正規化結果から作ってはならない。page count、page ID、locator、raw、
normalized、domain派生値を audit 側から読み、実 corpus を照合する。

まず最終 `corpus.json` の各 observation から `locator` と `transcription.transcriberA/B` を投影し、
`DESIGN.md` 6.1.1節の固定tupleをproduction候補比較helperなしで組み立てる。全IDはASCII byte昇順、
fieldは `temperature,supersaturation,growthTime,squareFieldOfView` の順とし、各A/B rowは
`[id,[page,ordinal,[left,bottom,width,height]],[[fieldName,raw,normalized]×4]]` の固定幅にする。
candidate wrapperは
`{schemaVersion:"snow-crystal-source-candidate-set-hash-preimage/1",sourcePdfSha256,
transcriberRole,observations}` の4 property、comparison wrapperは
`{schemaVersion:"snow-crystal-source-comparison-set-hash-preimage/1",sourcePdfSha256,
transcriberASetSha256,transcriberBSetSha256,observations}` の5 propertyだけを持つ。このJCS UTF-8 bytes
（BOM・末尾改行なし）から次の既知値を再計算し、完全一致させる。

| preimage | expected SHA-256 |
|---|---|
| role A candidate set | `de2d1e32eed414f020c1be76fc82b2209848da2b399aa1f00c96ecb55638f732` |
| role B candidate set | `b641538a2344cb348e62532cb6e48aaf3b9b5cf236fd703a51a7f1b3d9cdcfd3` |
| comparison set | `33c545adebfae122fea0d84985445f60eeb7f17ed1e0e9ba2cb99d7a34b6bad9` |

comparison rowは `[id,fields]`、各fieldは
`[fieldName,[rawA,normalizedA],[rawB,normalizedB],comparison,proposed]` の固定5要素とする。
`proposed` は `different` だけ `null`、それ以外は `[raw,normalized]` である。比較順を独立に実行すると、
206×4=824 fieldの内訳は `exact=618`、`canonical-unit-equivalent=206`、`different=0` になる。
FOV以外はrawとnormalizedの両方の完全一致だけを `exact` とする。FOVの末尾だけに
`^[0-9]+(?:\.[0-9]+)?(?:\u03BC|\u00B5)m$` を適用し、数字、末尾 `m`、normalized µmが一致し、
変換前rawがU+03BC/U+00B5の一文字だけ異なる場合に限って `canonical-unit-equivalent` とし、
proposed rawをU+00B5 `µm` にする。

mu処理の独立literal fixtureを次に固定する。各fixtureはcandidate set hash前のA/B raw、comparison、
proposed、`confirmed-proposal` 時のfinal rawを別々に比較し、同じ変数を使い回して期待値を生成しない。

| field / A raw / B raw / normalized | comparison | A/B preimage raw | proposed / confirmed final |
|---|---|---|---|
| FOV / `"123μm"` / `"123μm"` / `123` | `exact` | 双方ともU+03BCのまま | `"123µm"`（U+00B5） |
| FOV / `"123µm"` / `"123µm"` / `123` | `exact` | 双方ともU+00B5のまま | `"123µm"`（無変更） |
| FOV / `"123μm"` / `"123µm"` / `123` | `canonical-unit-equivalent` | AはU+03BC、BはU+00B5のまま | `"123µm"`（U+00B5） |
| temperature / `"-3μC"` / `"-3µC"` / `-3` | `different` | 双方のcode pointを保持 | `null` |
| FOV / `"123μm "` / `"123µm "` / `123` | `different` | suffix外の空白を含め保持 | `null` |
| FOV / `"μ123m"` / `"µ123m"` / `123` | `different` | unit suffix以外のmuを保持 | `null` |

最初の正例により、raw/normalized完全一致の `exact` 判定と、その後のproposed/final canonicalizationを
混同しないことを検出する。後ろ3負例はFOV以外、末尾unit suffix以外、他文字差へ変換を広げない。
source grammar違反を含むnegative rawはcomparison段階で勝手に補正せず `different` とした後、
final source値として採用しようとした時点では別途 `RangeError(unit-or-domain)` で拒否する。

この限定変換はA/B candidate set hashの**後**、comparison/proposed作成の**前**にだけ行う。
A/B preimageとcomparison row内のrawA/rawBは元code pointを保持する。FOV末尾以外のmu、空白、符号、
数字、単位、case、Unicode normalizationの差はすべて `different` でproposedなしとする。synthetic
mutationでA/B preimageを事前canonicalizeする実装、field順・tuple幅・ID順・role・locatorを変える実装、
`different` に一方のdefaultを入れる実装をすべてhash不一致または `RangeError` にする。

source auditとproduction corpusのhashは次をそれぞれ独立JCS canonicalizerで再計算する。

1. candidate A/B/comparisonの3 hashを上の既知値へ一致させる。
2. `sourceEntrySetSha256 = SHA-256(JCS(observations))`。
3. `preAnnotationSplitAssignmentSha256 = SHA-256(JCS(split.assignment))`。
4. `canonicalCorpusSha256 = SHA-256(JCS(corpus object))`。
5. `auditPayloadSha256` は root から `auditPayloadSha256` と `approval` を除いた object の JCS hash。
6. approval 内の PDF/source-entry/corpus/payload hash は root と厳密一致する。
7. `protocol.sourceAuditSha256 = SHA-256(JCS(SOURCE-AUDIT object))`、
   `split.sourceAuditSha256` も同じ値と厳密一致する。

各 mutation は一つずつ行い、missing property、unknown property、wrong type、許可されない null、page tuple
順交換、page内ID順交換、observation順交換、duplicate/dangling ID、合計205/207、locator/raw label/
normalized valueの片側だけ変更、final raw labelの1 code point変更、candidate A/B/comparison hash不一致、
候補count 205/207、source-entry/split/corpus/payload hash不一致、approval未承認、fractional second付きUTC、
`productionCorpusReadDuringHumanVerification=true`、`productionGeneratorUsed=true`、
`imageArtifactsCommitted=true` を拒否する。candidate比較でU+03BC/U+00B5を限定同値にしても、
canonicalized final rawのU+00B5をU+03BCへ変えるmutationは引き続き拒否する。型・unknownは `TypeError`、
順序・件数・値・参照・hash・approval不一致は `RangeError` とする。

### TC-SOURCE-AUDIT-003: LocalStorage backupの無改変移行

移行を実装・実行する前の一回限りのgateでは、ユーザーが再取得したbackup fileのraw bytesをSHA-256し、
次の固定値と一致しなければUI stateまたは成果物へ一切書き込まず停止する。

```text
sourceFileSha256 =
  9fd9708029f553e386dfd2dece8df5f8237d5c8b586502d90bfbe93b8bb47f0c
version = 1
role = "human-source-auditor"
entry object count = 33
confirmedかつ4 raw非空・4 normalized有限のcomplete entry = 32
blank/incomplete = ["P11-N033"]
```

移行対象IDはbackup key `P11-N001` から `P11-N032` を
文字列連結 `"L23-F2-" + backupKey` だけで完全形へ写した32件である。ASCII byte昇順の完全形ID配列そのもの
（wrapper、count、backup hash、値、timestamp、末尾改行なし）をJCS化した既知値は
`92e23ab4ae1ea2b1406296a11e94ab519a1c020fb2a54559acf4b4bf0fbc6ea5` とする。test-local oracleは
整数1..32を3桁zero paddingしてこの配列とhashを独立再生成し、`P11-N033` が含まれないことを確認する。

32 entryについて、移行前の4 raw stringはUTF-8 bytesとUnicode code unit列の完全一致、4 normalized numberは
`Object.is` と `DataView` のbinary64 bit完全一致で移行後の `rawLabels` / `normalizedSourceValues` と比較する。
8値を固定field順に並べたtest-local tupleのbytes/bitsもcopy前後で一致させる。候補A/Bは比較のためにだけ読み、
normalizedが双方と一致し、rawが少なくとも片方と一致することを事前検査するが、proposalやU+00B5への
canonicalizationで既存rawを上書きしてはならない。移行後の4 fieldは
`humanAction="preserved-prior-human-confirmation"`、`humanConfirmedRawAndNormalized=true` とし、
`confirmedValuesOverwrittenDuringMigration=false`、`originalVerificationTimeKnown=false` を要求する。
backupにない元確認時刻を推測せず、`verificationRecordedAtUtc` は移行記録時刻とする。

backup自体をrepository fixtureへ保存しない。通常の自動testは同じschemaの `SYN-MIGRATION` で
copy-before/copy-afterを比較し、実backupのone-time gate結果は `EVIDENCE.md` にfile hash、件数、
移行ID集合hash、A/B一致、上書きなしとして記録する。次を一つずつ拒否し、失敗前後で保存状態を
bit-for-bit不変にする。

- source file hash違い、`version/role` 違い、33件以外、32 complete以外。
- `confirmed!==true`、空raw、非有限または`-0` normalized、raw/normalizedの単位変換不一致。
- unknown/duplicate key、完全形IDとの重複、未知ID、locator不一致、単純連結以外のID補正。
- `P11-N033` をconfirmed移行へ含める、または不完全entryを黙って補完する。
- 候補値で既存raw/normalizedを置換、FOVのmu code pointをcanonicalize、移行後に既存32件を再prefill。
- 移行ID集合hash、backup hash、件数、上書きなし宣言のいずれかを偽る。

### TC-SOURCE-AUDIT-004: 全206 panel・824 fieldの能動確認

A/B両draftが各206件で既知hashへ凍結され、comparison hashも確定した状態だけが確認を開始できる。
一方でも未完了、hash不一致、count不一致ならcandidate prefillを表示せず、確認stateを進めない。
これは人間が候補を見る方式であるため第三の独立blank転記とは記録せず、
`auditMethod.kind="independent-ai-candidates-human-source-pdf-verification"` を要求する。

確認workflowの状態fixtureには `readProductionCorpus` をthrowing spyとして注入する。A/B候補表示、
TC-SOURCE-AUDIT-003の32件移行、残りfieldの確認・訂正、途中保存、全824 field完成後のexportまで、
spyは一度も呼ばれずcall countが厳密に0でなければならない。候補値はfrozen A/B証跡から、既存32件は
hash一致backupから、PDF表示は固定hash sourceから得る。production corpusを候補、移行値、normalized値、
確認済みflag、export値の生成に使う実装は、返値を読む前にthrowして失敗させる。

export後の `verifyExportedAuditAgainstCorpus` は別の関数・別の状態fixtureとし、完成した
`SOURCE-AUDIT.json` を期待側としてproduction corpusを事後照合する。この経路ではcorpus readerを
明示的に1回だけ呼べるが、確認workflowへ結果を戻さず、候補表示・人間判断・exportを再実行しない。
同じspy、cache、object referenceを両経路で共有してcall countを曖昧にする実装を拒否する。

各panelは同じ固定hash PDFの該当locatorを候補より先または同時に提示し、event fixtureで
`sourcePanelVisibleAt <= candidateVisibleAt` を要求する。人間が4 fieldのraw/normalized pairをfieldごとに
明示操作した場合だけ `humanConfirmedRawAndNormalized=true` にできる。画面を開く、候補をprefillする、
panelを表示する、次へ移動する、他fieldを確認する操作を代用にしない。既存32件はTC-SOURCE-AUDIT-003の
保存済み確認を1回分として数え、残る174件を含む全206 observation、全824 fieldがtrueでなければ
export、`SOURCE-AUDIT.json`、corpus、split、loss入力をすべて `RangeError(incomplete-human-verification)`
で拒否する。

field別規則を次に固定する。

| comparison | proposed/default | 許されるaction | rationale |
|---|---|---|---|
| `exact` | 同一候補をprefill可 | unchangedなら`confirmed-proposal`、変更なら`corrected-proposal` | confirmedは`null`、correctedは非空 |
| `canonical-unit-equivalent` | U+00B5 `µm`のcanonical proposalをprefill可 | unchangedなら`confirmed-proposal`、変更なら`corrected-proposal` | 同上 |
| `different` | A/Bを同じ優先度で提示し`proposed=null`、defaultなし | A/B以外の第三値を選ぶ場合も`resolved-disagreement` | 必ず非空 |
| 既存32件 | candidateでprefill/上書きしない | `preserved-prior-human-confirmation` | `null` |

全fieldの `candidateComparison` はTC-SOURCE-AUDIT-002の再計算結果と一致させる。
`confirmed-proposal` のfinal pairはproposedとraw/normalizedとも厳密一致、
`corrected-proposal` はproposedと少なくとも一方が異なりraw単位換算とnormalizedが一致、
`resolved-disagreement` も原PDFから確定したraw単位換算とnormalizedが一致、
`preserved-prior-human-confirmation` はTC-SOURCE-AUDIT-003のbackup pairとbytes/bits一致を要求する。
`different` をAまたはBへ自動選択、候補一方だけの表示、確認操作なしの自動true化、rawだけ／normalizedだけ
の片側確認、空白だけのrationale、氏名・email・account ID・端末名などPII property、PDF未表示での新規確認を
拒否する。`sourcePanelInspected=true`、roleは `human-source-auditor`、UTCはfractional secondなしとする。
訂正後もfrozen A/B evidenceと3候補hashを変更せず、final source値だけを更新する。これにより
A/B完成前表示禁止、hash固定、原画像併置、disagreement default禁止、field別能動確認、訂正理由という
confirmation-bias緩和策を機械的に検査する。

rationaleは原PDF上の該当fieldの差異または判断不能理由だけを記録する。positive literalは
`"原PDFではgrowthTimeは82secと読める"` と
`"A/Bのtemperature rawが異なり、原PDFでは-3Cと読める"` とする。少なくとも次の定義可能な禁止形式を
文字列mutationとして拒否する。

- email形式 `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`。
- account識別子の明示label `accountId=`、`account_id:`、`userId=`、`user_id:`、`uid=`
  （ASCII case-insensitive、区切り前後の空白を許して検出）。
- 端末識別子の明示label `deviceName=`、`device_name:`、`hostname=`、`computerName=`、
  `machine_id:`（同じくASCII case-insensitive）。
- schema外の `name`、`email`、`accountId`、`deviceName`、`hostname` property。

自動検査が自由文中の全PIIや原資料との差異との意味的関連を完全検出できるとは主張しない。
上記positive/negative形式を機械gateとし、それ以外の自由文はhuman source-auditorが原資料差異だけを
記録していることを承認時に確認する。これによりDESIGNの非PII要件を弱めず、検出可能範囲を過大主張しない。

### TC-SOURCE-AUDIT-005: 作成順、freeze、stale、非循環

作成順を状態fixtureで固定する。

```text
source A/B captureを互いに独立して各206件完了
  -> A/B candidate setを別々の既知JCS hashでsealed
  -> field別comparison生成・comparison set hash freeze
  -> backup hash検証・32 confirmed値を無改変移行
  -> 全206 panel・4 fieldを原PDFと照合して人間確認
  -> sourceEntrySet + preAnnotation SplitAssignment freeze
  -> morphology annotation/extraction + human approval
  -> final corpus JCS hash freeze
  -> SOURCE-AUDIT approval + audit object JCS hash freeze
  -> split/protocolがsourceAuditSha256を参照
```

annotation開始前の assignment と最終 `split.assignment` は JCS bytesが同一でなければならない。
annotation/shapeだけの変更で `preAnnotationSplitAssignmentSha256` が変わってはならない。source field、
assignment、final corpus、SOURCE-AUDIT の一つを変更すると、それを参照する approval/hash/review/Red/Green/
下流較正は stale となり、旧hashのままGreenにしない。

hash依存は `A/B candidates -> comparison -> human-confirmed source entries -> split assignment`、
`migration backup -> migrated ID set -> human-confirmed source entries`、`final corpus -> source audit approval`、
`source audit object -> split/protocol reference` の有向順である。`SOURCE-AUDIT.json` 自身のhashを
自身のpayload/approvalへ埋め込まないため循環がないことを dependency graph のDFSで確認する。
`canonicalCorpusSha256` が audit を参照する corpus fieldから導かれる実装、または audit object hashを
audit rootへ書き戻す実装を拒否する。

## 4. 形態注釈と人間承認

### TC-ANNOTATION-001: A/B draft と review mode

基底 vote を次に固定する。

```json
{"growthAxis":"basal-dominant","basalBranchingLevel":2,"hollowing":"absent","confidence":"high"}
```

- A/Bが4 fieldとも一致し high/high のときだけ `draftStatus='exact-agreement'` かつ
  `batch-summary` を許し、`final` は同じ vote、`adjudicationNote=null`。
- confidenceだけ medium/medium に変えた一致、high/medium、いずれか low、growthAxis/branch/hollowing の
  いずれか不一致はすべて `individual-source-pdf`。individualは空でないnoteを要求し、finalはA/B以外の
  有効値または indeterminate/nullでもよい。
- `exact-agreement`なのに一 fieldが違う、`different`なのに完全一致、medium/lowをbatchに入れる、batchの
  finalを書き換える、individualのnoteをnull/emptyにする場合は `RangeError(annotation-approval)`。
- unknown vocabulary/confidenceは `TypeError(unknown-enum)`。branchは `0|1|2|3|null` 以外を拒否する。

### TC-ANNOTATION-002: literal approval hash

ID `L23-F2-P11-N001` と TC-ANNOTATION-001 の基底 vote について、JCS canonical bytes の SHA-256を
production hash helperから独立に計算し、次へ厳密一致させる。

| target | canonical logical value | SHA-256 |
|---|---|---|
| target IDs | `["L23-F2-P11-N001"]` | `0446f0d4af4ae33312f7726af9e436750e0886a33540df8783ca837c80015c6b` |
| draft set | `[[id,vote,vote]]` | `53aafe785f93df225e57b08dbf502c37864e334ebeabfda5b9682dda6c787daf` |
| final set | `[[id,vote]]` | `563192cd1f7ec3799a357c843aa269e6dc3e355eecdda500c464cb919e6cd873` |

approval は `reviewMode=batch-summary`, 上記3 hash、固定 PDF hash、`approverRole=human-approver`,
`approvedAtUtc=2026-09-29T12:00:00Z`, `decision=approved`, `note=null` とする。`approvalId` を除いた object の
JCS hash は `a4cfc6fbb96f578a871a32c528d07930751392b5ce45bd7e3cb1a0f65148133c` であり、observationの
`approvalId` もこれへ一致させる。fractional second、timezone offset、氏名/email/account/deviceなど
schema外PII propertyは拒否する。

### TC-ANNOTATION-003: 全206点の完全被覆と承認前拒否

`REAL206` の approval target配列は各配列内ASCII昇順・重複なし、approvalId昇順であり、multiset unionは
observation ID setと厳密一致する。重複対象、未被覆1件、未知ID、approval参照不一致、target/draft/final
hash不一致を各々拒否する。未承認1件を含む corpus では、predictionが空でも `scoreTraining`, baseline,
candidate ranking, split後loss, holdoutのすべてが最初に `RangeError(annotation-approval)` を投げる。

## 5. projected-shape extraction evidence

### TC-SHAPE-001: mask byte encoding と hash

mask hashのbyte順を独立確認する。

- `width=2,height=2,pixels=[1,1,1,1]` の bytes は uint32 little-endian width/heightの8 byteに
  row-major 4 byteを続け、SHA-256は
  `66ad96f0cffebe842cc5d3b24a8c8aac3bc21b781aa3d3e749c3b2d62e884030`。
- `width=3,height=3,pixels=9個の1` は
  `a0a7f65a1e81907621d6dc7c9acd606e445022041cd91ac82af733f3f73e37a1`。

bit packing、big-endian、bottom-up、RGBA byteを使うとhashが異なることを確認する。mask本体を成果物へ
保存せず、テスト内でだけ生成する。

### TC-SHAPE-002: 中間量から3 raw featureを独立再計算

次の `SYN-EA` evidence を使う。rasterは `11x11`、center/endpointsはpixel-center規約である。

```text
foregroundPixelCount A=4, fourNeighborPerimeterEdges P=8
centroid=(1.0,1.0)
covariance={xx:0.25,xy:0,yy:0.25}
eigenvalues=[0.25,0.25]
center=(5.5,5.5)
endpoints clockwise=
  [(7.5,5.5),(6.5,7.5),(4.5,7.5),(3.5,5.5),(4.5,3.5),(6.5,3.5)]
```

独立期待値は次である。

```text
inverseCircularity = ((8/4)*8)/(4*pi) = 4/pi
                     = 1.2732395447351628
arm lengths = [2,sqrt(5),sqrt(5),2,sqrt(5),sqrt(5)]
mean = (2+2*sqrt(5))/3 = 2.1573786516665265...
population CV = 0.051582744513315945
trace=0.5, delta=hypot(0,0)=0
lambdaMin=lambdaMax=0.25
minorMajorAxisRatio=sqrt(0.25/0.25)=1
```

endpoint angleは top-left座標の `atan2(y-cy,x-cx)` を `[0,2*pi)` に直した厳密昇順で、先頭は+X、
紙面上時計回りとなる。同角endpoint、integer座標、raster外座標、endpoint重複、`lambdaMax=0`,
`lambdaMin>lambdaMax`, 非有限/負共分散、safe integer外A/Pを拒否する。

`SYN-EB` は A=9,P=12、covariance `{xx:1,xy:0,yy:4}`, eigenvalues `[1,4]` とする。同じ
center `(5.5,5.5)` から、時計回りに
`[(10.5,5.5),(8.5,9.5),(2.5,9.5),(0.5,5.5),(2.5,1.5),(8.5,1.5)]` を使う。
各offsetは `(5,0),(3,4),(-3,4),(-5,0),(-3,-4),(3,-4)` なので6距離はすべて5、raw値は
`4/pi`, `0`, `0.5` となる。A/B最終intervalは
`inverseCircularity=[4/pi,4/pi]`, `normalizedArmLengthCv=[0,0.051582744513315945]`,
`minorMajorAxisRatio=[0.5,1]`。interval端はA/B再計算値のmin/maxと厳密一致する。

### TC-SHAPE-003: status、null、reason、audit

| A/B状態 | final feature/status | expected audit |
|---|---|---|
| 両方usable、同じstatus/reason | 共通rawのmin/max、top `usable` | `agreed`, note `null` |
| Aだけfeature usable、Bがnull | そのfeature `null`。他に共通featureありならtop `usable` | `adjudicated`, nonempty note |
| 両方mask unusable | 全中間量/raw `null`, top `not-usable`, reason `no-common-usable-feature` | status/reason一致なら`agreed` |
| mask usable、arm unusable | mask由来2 feature可、arm feature null | reasonはarm側のみnon-null |

mask usableなら hash/A/P/centroid/covariance/eigenvalues/2 raw featureは必須でreason null。mask unusableなら
それら全部null、reason必須、armもunusable。arm usableならcenter/6 endpoints/raw CV必須でreason null。
片方だけのraw値をintervalへ採用、adjudicationでrawを書換え、全interval nullなのにtop usable、差異が
あるのにagreed、完全一致なのに理由なくadjudicatedを拒否する。

## 6. JCS、SHA256SUMS、logical mutation

### TC-JCS-001: RFC 8785代表 vector

独立 canonicalizer は UTF-16 code unit property sort と ECMAScript number serializationを使い、少なくとも
次のcanonical bytesを厳密比較する。

```text
input property order: {"b":2,"a":1}
canonical:            {"a":1,"b":2}
SHA-256:               43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777

333333333.33333329 -> 333333333.3333333
1E30                 -> 1e+30
4.50                 -> 4.5
2e-3                 -> 0.002
1e-27                -> 1e-27
```

arraysは順序保持、objectは再帰sort、UTF-8・空白なし。JCS単体では `-0` が `0` になるため、corpus
validatorがcanonicalize前に `-0` を拒否することも確認する。

### TC-JCS-002: canonical file hash と mutation

pretty/compact、LF/CRLF、property input orderが違っても同一logical objectのhashは同一。
`{"a":1,"b":2}` の `b` を3へ変えた canonical hashは
`f9c6777fb86597920de313c707c2c0aa7b059e208a66e1f56f7a2b548e11453d` となり、元hashと異なる。
array element swap、Unicode code point変更、number変更もhashを変える。

`SHA256SUMS` は filename ASCII順 `corpus.json`, `protocol.json`, `split.json`、各行
`^[0-9a-f]{64}  [A-Za-z0-9._-]+\.json\n$`、末尾LFあり、自身を含まない。3 JSONをparse/schema検証後の
JCS bytesで再hashし一致させる。raw pretty bytesをhashする誤実装を検出する。

## 7. condition group と固定 split

### TC-SPLIT-001: group不可分、bin境界、hash順

同じ `[temperatureC,supersaturationPct]` の時刻違い・写真違いは同じgroupで、partitionを跨がない。
bin境界の期待値は次である。

```text
(-30,0)->(T0,S0), (-10,10)->(T1,S1), (-3,20)->(T2,S2), (0,30)->(T2,S2)
```

各stratum内で `SHA-256("snow-crystal-sim/T1-7/split-v1\0" + JCS(groupKey))` のunsigned byte
lexicographic順を独立計算する。group数 `n=1` はholdout 0、`n=2..9` はholdout 1、`n=10` は2。
holdout数は `min(n-1,max(1,floor(n/5)))`。domain外groupはreport-onlyでtrain/holdoutに入らない。

### TC-SPLIT-002: 4-stratum canonical order とannotation不変性

架空groupを次の順で保存する。

```text
G00=(-20,5)  -> (T0,S0), contribution 0
G01=(-20,15) -> (T0,S1), contribution 1/2
G10=(-5,5)   -> (T1,S0), contribution 1/4
G11=(-5,15)  -> (T1,S1), contribution 1
```

full 9-record orderは `(T0,S0),(T0,S1),(T0,S2),(T1,S0),(T1,S1),(T1,S2),(T2,S0),(T2,S1),(T2,S2)`。
上の非空4 recordの証跡順は `G00,G01,G10,G11` であり、temperature-only groupingなら得られない。
非空stratum macro-averageは `(0+1/2+1/4+1)/4=7/16`。annotation final、confidence、shape intervalを
全て変更してsplit bytes/hashがbit-for-bit不変、conditionを1つ変更するとhashが変わることを確認する。

### TC-SPLIT-003: `SplitV1` 完全 positive literal

`SYN-SPLIT-V1` は実観測値を含まない schema/canonical-order 専用 bundle とする。root は次の propertyを
この型と値で全て持つ。`H_*` は同じ bundle に literal 保存した sibling object の JCS SHA-256を、test-local
独立 canonicalizer で fixture 作成時に一度求めて固定した64桁lowercase hexであり、REAL206 の最終hash用
placeholderではない。

```text
schemaVersion="snow-crystal-observation-split/1"
corpusId="libbrecht-2023-figure2-arxiv-v1"
corpusSha256=H_SYN_CORPUS
sourceEntrySetSha256=H_SYN_SOURCE_ENTRIES
sourceAuditSha256=H_SYN_SOURCE_AUDIT
splitAssignmentSha256=H_SYN_ASSIGNMENT
assignment={
  algorithmId:"condition-group-hash-stratified-v1",
  hashPreimagePrefix:"snow-crystal-sim/T1-7/split-v1\0",
  stratumOrder:["T0-S0","T0-S1","T0-S2","T1-S0","T1-S1","T1-S2",
                 "T2-S0","T2-S1","T2-S2"],
  strata:[S00,S01,S02,S10,S11,S12,S20,S21,S22],
  groups:[G00,G01,G02,G10,G11,G12,G20,G21,G22,G_REPORT],
  reportOnly:{groupSha256s:[G_REPORT.groupSha256],
              sourceObservationIds:["L23-F2-P11-N010"]}
}
```

各 `Sxy` の完全 literal は次表の値を使い、表にない propertyを許さない。各行で
`groupCount=1`, `holdoutGroupCount=0`, `holdoutGroupSha256s=[]`,
`holdoutSourceObservationIds=[]` とする。

| record | stratumId | temperatureBin | supersaturationBin | train group | train ID |
|---|---|---|---|---|---|
| S00 | `T0-S0` | `T0` | `S0` | `G00.groupSha256` | `L23-F2-P11-N001` |
| S01 | `T0-S1` | `T0` | `S1` | `G01.groupSha256` | `L23-F2-P11-N002` |
| S02 | `T0-S2` | `T0` | `S2` | `G02.groupSha256` | `L23-F2-P11-N003` |
| S10 | `T1-S0` | `T1` | `S0` | `G10.groupSha256` | `L23-F2-P11-N004` |
| S11 | `T1-S1` | `T1` | `S1` | `G11.groupSha256` | `L23-F2-P11-N005` |
| S12 | `T1-S2` | `T1` | `S2` | `G12.groupSha256` | `L23-F2-P11-N006` |
| S20 | `T2-S0` | `T2` | `S0` | `G20.groupSha256` | `L23-F2-P11-N007` |
| S21 | `T2-S1` | `T2` | `S1` | `G21.groupSha256` | `L23-F2-P11-N008` |
| S22 | `T2-S2` | `T2` | `S2` | `G22.groupSha256` | `L23-F2-P11-N009` |

各 `Sxy.trainGroupSha256s=[Gxy.groupSha256]`、`trainSourceObservationIds=[train ID]` である。
各 `G` は次の全 propertyを持つ。

```text
Gxy={groupKey:[T,S], groupSha256:SHA256(JCS([T,S])),
     splitOrderSha256:SHA256(UTF8(prefix)+UTF8(JCS([T,S]))),
     stratumId:"Tx-Sy", partition:"train", sourceObservationIds:[ID],
     sourceObservationIdSetSha256:SHA256(JCS([ID]))}
```

group keyは順に `[-20,5],[-20,15],[-20,25],[-5,5],[-5,15],[-5,25],[-1,5],[-1,15],[-1,25]`。
`G_REPORT` は `groupKey=[-31,5]`, `stratumId=null`, `partition="report-only"`, ID
`L23-F2-P11-N010` で、同じ hash 式を使う。ここでは schema/order を小さく検査するため10 synthetic IDだけを
用いる。REAL206 integration は TC-REAL-001 で厳密に206 IDを要求し、この小fixtureを実データ完全性の
oracleにはしない。

### TC-SPLIT-004: required/null/order/reference/hash mutation

`SYN-SPLIT-V1` について root、assignment、各stratum、各group、reportOnlyの全 required propertyを
property tableから一つずつ削除して `TypeError(missing-property)`、各階層に `extra` を加えて
`TypeError(unknown-property)`、string/number/boolean/array/objectを一つずつwrong typeへ変えて
`TypeError(wrong-type)` とする。`stratumId` が report-only groupでだけ nullを許すことを除き、全fieldの
nullを拒否する。

個別に次も検査する。

- `schemaVersion`、`algorithmId`、prefix、stratum enum、partition enum の1文字変更。
- `stratumOrder` または `strata` の隣接交換、長さ8/10、binとID不一致。
- stratumのtrain/holdout group hash順交換、ID順交換、count不一致。
- groupの`groupKey` tuple順交換/長さ違い、誤bin、誤stratum、train/holdout跨ぎ、report-onlyの非null。
- `groups` のstratum間/stratum内交換、report-onlyを途中へ挿入。
- dangling/duplicate group hash、dangling/duplicate ID、同じcondition groupをtrainとholdoutへ分割。
- `reportOnly` とgroupsのreport-only suffixの不一致。
- group/source-ID-set/split-order/assignment/corpus/source-entry/source-audit hash参照を各1桁変更。
- annotationだけの変更では assignment JCS/hash不変、conditionまたはID配列変更では必ずhash変更。

logical mutation後に古い `splitAssignmentSha256` を残すと `RangeError(hash-mismatch)`、新しいhashへ
追随しても固定順、参照またはallocation違反があれば対応する `RangeError` とする。これにより
自己整合hashだけで意味契約を迂回できないことを確認する。

## 8. tag rank loss の厳密分数

### TC-RANK-001: pair、tie、反転、欠測

同じstratumの異なるgroup `g_i<g_j` について、観測rankを `g_i=[0,1]`, `g_j=[2,1]` とする。
直積4 pairの観測signは `[+,+,+,0]`。group prediction signごとの結果は次である。

| prediction sign | `2p`列 | `M` | `N` | reduced loss |
|---|---:|---:|---:|---:|
| `+` | `[0,0,0,1]` | 4 | 1 | `1/8` |
| `0` | `[1,1,1,0]` | 4 | 3 | `3/8` |
| `-` | `[2,2,2,1]` | 4 | 7 | `7/8` |

同じgroup内pairは列挙しない。`g_i=[null,1]`, `g_j=[2,null]` では eligibleは1組だけで、prediction tieの
lossは `1/2`。全pair欠測ならgroup pairを除外する。eligible pairがあるのにmetric null/NaN/Infinity/
未到達なら欠測でなくcandidate failure。数値 `===` ならbit pattern差にかかわらずtieである。

### TC-RANK-002: 3 component と macro階層

TC-RANK-001 の同じrank表に対し、predictionを compactness `+`, tipDensity `0`, aspectRatio `-` とする。

```text
branching-compactness-v1 = 1/8
branching-tip-density-v1 = 3/8
axis-aspect-ratio-v1     = 7/8
basal-rank-v1            = (1/8+3/8)/2 = 1/4
integrated-rank-v1       = (1/8+3/8+7/8)/3 = 11/24
```

growthAxis順は `basal-dominant<mixed<c-axis-dominant`、branch順は `0<1<2<3`、全prediction方向は大きいほど
高rank。hollowingはrankへ入れない。分母0 component、空stratumを各階層から除外するが、全空ならnull。

### TC-RANK-003: 固定24実行、stratum順、Neumaier再初期化

各candidateは checkpoint外側 `[10,20,40]`、seed内側 `0..7` の24 recordを必須とする。各recordで
TC-SPLIT-002 の4 stratum contributionを別々に集計し、temperature-major/supersaturation-minor以外の
順を拒否する。階層ごとに新しいNeumaier accumulatorを作る。

Neumaier単体のadversarial vector `[1,2^-54,2^-54,2^-54]` は補償和後 `1.0000000000000002`、平均は
`0.25000000000000006` とbit一致させる。前階層のcompensationを次階層へ持ち越してはならない。
checkpoint10の8 seed lossを全0、checkpoint20をseed0..3=0/seed4..7=1、checkpoint40を全1とするfixtureは
checkpoint別 `[0,1/2,1]`、最終 `1/2`。best checkpoint選択、seed除外、24 primitive前のmetric平均を
行う実装を失敗させる。

## 9. empirical mid-CDF と shape loss

### TC-CDF-001: 全実数上のliteral CDF

train multiset `X=[1,2,2,4]`（重複保持、n=4）に対する期待値を固定する。

| z | position | F(z) |
|---:|---|---:|
| 0.5 | min未満 | `0` |
| 1 | min同値 | `1/8` |
| 1.5 | sample間 | `1/4` |
| 2 | 重複同値 | `1/2` |
| 3 | sample間 | `3/4` |
| 4 | max同値 | `7/8` |
| 5 | max超過 | `1` |

線形補間、重複除去、right-CDFを使わない。midpointは `low/2+high/2` の評価順とし非有限ならcorpus error。
holdoutでもこのtrain Xを使い、holdout値からCDFを再作成しない。

### TC-CDF-002: interval distance と null

TC-CDF-001 のCDFで観測interval `[2,4]` はCDF区間 `[1/2,7/8]`。

```text
prediction 1 -> u=1/8, d=3/8
prediction 3 -> u=3/4, d=0
prediction 5 -> u=1,   d=1/8
```

zero-width `[2,2]` とprediction 4は `d=7/8-1/2=3/8`。観測interval nullはfeatureを分母から除外する。
interval非nullでprediction null/非有限/未到達はcandidate failure。Xが空ならfeature reportはnull。
feature順はinverseCircularity、normalizedArmLengthCv。minorMajorAxisRatioはreport-only。

### TC-CDF-003: hierarchical shape aggregation

2 observationのfeature primitiveを `o1=[0,1/2]`, `o2=[1/4,null]` とすると、observation平均は
`o1=1/4`, `o2=1/4`、group平均 `1/4`。primitiveを先に全件flat平均した `1/4` と偶然一致するfixtureだけに
依存せず、`o1=[0,1]`, `o2=[0,null]` も使い、正しいobservation macroは `(1/2+0)/2=1/4`、flat平均は
`1/3` となることを確認する。その後 group→2D stratum→非空stratum→seed→checkpointの順に、各階層で
Neumaierを再初期化する。

## 10. scale-marginalized comparison と候補

### TC-SCALE-001: time/FOV/dimension-only metamorphic invariance

承認tag/shape、condition、candidate、seed、checkpoint predictionを固定し、各observationの
`growthTimeSeconds` を `120->240`、`squareFieldOfViewUm` を `400->800`、raw labelsも整合する別値へ変える。
panel raster width/heightと報告専用dimensionも別値にするが、承認shape intervalは同じに保つ。
24 primitive、rank/shape全階層、candidate order、baseline、Pareto結果はbinary64 bit-for-bit不変とする。
time/FOV/実寸をcheckpoint選択、重み、停止stepへ使う実装を検出する。

### TC-SCALE-002: checkpoint、8 seed、candidate failure

各condition/candidateに `(10,0)..(10,7),(20,0)..(20,7),(40,0)..(40,7)` が一度ずつ必要。
一件欠落、checkpoint未到達、外縁停止、metric null/非有限、step 40021超過のいずれもcandidate全体を
`failed` にし、null lossや0点、残り23件平均へ変えない。全24件成功なら各observationを24回別採点してから
seed、checkpointを等重みmacro-averageする。

### TC-CANDIDATE-001: family/order/tie/failure

実行順はfamilyRank `condition-blind-baseline < nearest-train-condition-baseline < production`、production内は
knot数、candidateId ASCII順。train選択keyは `(tagRankLoss,shapeLoss,knotCount,candidateId)`。

```text
C1=(1/4,1/3,4,"20...")
C2=(1/4,1/3,3,"f0...") -> C2 wins fewer knots
C3=(1/4,1/3,3,"0a...") -> C3 wins ID tie-break
C4=status failed         -> 有限lossの全candidateより後ろ
```

全candidate共通でtag nullならtag項、shape nullならshape項を比較keyから除く。両方nullなら
`RangeError(no-calibration-evidence)`。usable evidenceがあるのに当該candidateだけnullならfailureとして
後置する。manifest追加削除、wall-clock/object insertion orderを使わない。

### TC-BASELINE-001: modal、median、nearest tie

condition-blind synthetic trainのtag ranks `[0,1,1,2]` はmode `1`、feature midpoint `[1,3,7,9]` のmedianは
`3/2+7/2=5`。enum mode同数tieは定義済みenum順の先頭。nearest fixtureはtrain key `[-20,5]` と
`[-10,5]`、query `[-15,5]` とし、正規化座標のsquared distanceが同じなのでgroup hashのunsigned ASCII
小さい方を選ぶ。holdout labelsは読まない。baseline predictionは全24 recordへ同じ値を複製する。

### TC-ACCEPT-001: comparator と Pareto

baseline train tupleを blind `(1/2,1/3,rank0)`, nearest `(1/2,1/4,rank1)` とするとnearestを固定 comparator
にする。holdout comparator `(tag=1/2,shape=1/4)` に対する期待は次である。

| candidate | expected |
|---|---|
| `(1/2,1/4)` | rejected（厳密改善なし） |
| `(1/3,1/4)` | accepted |
| `(1/2,1/5)` | accepted |
| `(1/3,1/3)` | rejected（shape悪化） |
| `(null,1/5)` when comparator tag nonnull | failed/rejected、null有利化禁止 |
| shape両者null、tag `1/3<1/2` | accepted |

acceptance証跡も9 stratum canonical順を保持する。

## 11. lattice、checkpoint、seed、決定性

### TC-PROTOCOL-001: radius 115 ring の独立全列挙

production lattice helperを使わず、整数 `q,r in [-115,115]` を二重loopし
`max(abs(q),abs(r),abs(q+r))===115` の座標だけを列挙する。ring countは `6*115=690`。
各点の `rho2=q*q+q*r+r*r` の最小は `9919` で、少なくとも `(115,-57),(115,-58)` が達成する。

```text
sqrt(9919) = 99.5941765365827...
sqrt(9919)/2 = 49.79708826829135...
40 < sqrt(9919)/2
latticeCellCount(115)=1+3*115*116=40021
```

checkpoint `[10,20,40]` は初めて `basalRadiusCells>=k` になったstateで記録する。10/20/40以外、best段階、
物理時刻対応、step上限40021超過を拒否する。

### TC-PROTOCOL-002: 8 literal seed

ASCII `snow-crystal-sim/T1-7/seed-v1/<decimalIndex>` のSHA-256 raw bytes先頭16をuint32 little-endian 4個へ
変換し、次へ厳密一致させる。

| i | SHA-256 | seed `[u32,u32,u32,u32]` |
|---:|---|---|
|0|`067267644959298fcccf5751a438cb6eedcefe325f085997025e29a6fd7fd6af`|`[1684500998,2401851721,1364709324,1858812068]`|
|1|`7061bcfbe7242c394ac03d46ed5d1496e87e17821f5e2a1f4abb637423493aff`|`[4223426928,959194343,1178452042,2517917165]`|
|2|`7df501fec43bd4feaf6bca052062d0cb36203c27de50e1cb65e495b0db001996`|`[4261541245,4275321796,97151919,3419431456]`|
|3|`5d41398e0d5790438b7f804de7f351fc2a9acaf7399ed30c1f08a35b13c6070b`|`[2386116957,1133532941,1300266891,4233229287]`|
|4|`82e8a7e0b0be4953a50179247e748c2077006dec0d51b4586aad68c57e7efdeb`|`[3769100418,1397341872,611910053,546075774]`|
|5|`d21f3ac2b8df5e280d04f0b42b12f54ee705e31fae215c94faa7e584f4df7e62`|`[3258589138,677306296,3035628557,1324683819]`|
|6|`926c9755bb09b0b5b9b686f9f129be4d258a49d9cba8cc26270e4587a2af8966`|`[1435987090,3048212923,4186355385,1304308209]`|
|7|`5d4b43b7013caec4be9bc34702737ff707b244c60771f4e9486bb7e7682c544c`|`[3074640733,3299752961,1204001726,4152324866]`|

いずれもall-zeroでないためretryなし。protocolのliteral hash/seedを再生成して比較する。同じ
condition/candidate/seed/checkpointを同processで2回、fresh processで1回実行し、metricsと証跡をbit-for-bit
一致させる。

### TC-PROTOCOL-003: `ProtocolV1` 完全 positive literal

`SYN-PROTOCOL-V1` は次の object を完全な正例として literal 保存する。`H_SYN_CORPUS`,
`H_SYN_SPLIT`, `H_SYN_SOURCE_AUDIT` は `SYN-SPLIT-V1` bundleの参照先と同じ64桁lowercase hexであり、
REAL206の未確定hashとは混用しない。

```text
schemaVersion="snow-crystal-calibration-protocol/1"
protocolId="libbrecht-2023-figure2-scale-marginalized-v1"
corpusId="libbrecht-2023-figure2-arxiv-v1"
corpusSha256=H_SYN_CORPUS
splitSha256=H_SYN_SPLIT
sourceAuditSha256=H_SYN_SOURCE_AUDIT

rasterization={
  protocolId:"figure2-projection-v1",
  rendererName:"pdfjs-dist", rendererVersion:"6.3.289",
  canvasBackendName:"@napi-rs/canvas", canvasBackendVersion:"1.0.6",
  nodeRuntimeVersion:"24.14.1",
  sourcePdfSha256:"20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af",
  dpi:600, pointsPerInch:72, viewportScale:25/3,
  pageBox:"crop-box", pageRotation:"respect-pdf-page-rotate", intent:"display",
  annotationMode:"disable", workerMode:"disabled",
  useSystemFonts:false, isEvalSupported:false,
  backgroundRgba:[255,255,255,255], outputColorSpace:"srgb",
  pixelFormat:"rgba8-straight-alpha", origin:"top-left", rowOrder:"top-to-bottom"
}

losses={
  rank:{
    primarySetId:"basal-rank-v1",
    primaryComponentIds:["branching-compactness-v1","branching-tip-density-v1"],
    integratedSetId:"integrated-rank-v1",
    integratedComponentIds:["branching-compactness-v1","branching-tip-density-v1",
                            "axis-aspect-ratio-v1"],
    components:[
      {id:"branching-compactness-v1",
       observationField:"morphology.final.basalBranchingLevel",
       predictionMetric:"compactness",direction:"larger-is-higher-rank"},
      {id:"branching-tip-density-v1",
       observationField:"morphology.final.basalBranchingLevel",
       predictionMetric:"tipDensity",direction:"larger-is-higher-rank"},
      {id:"axis-aspect-ratio-v1",observationField:"morphology.final.growthAxis",
       predictionMetric:"aspectRatio",direction:"larger-is-higher-rank"}
    ],
    pairPenalty:{matchingSign:0,exactlyOneTie:0.5,reversedNonzeroSign:1},
    aggregationOrder:["observation-pair","group-pair","component","stratum",
                      "nonempty-strata","seed","checkpoint"]
  },
  shape:{
    scoredFeatureIds:["inverseCircularity","normalizedArmLengthCv"],
    predictionMetrics:["compactness","armLengthCv"],
    reportOnlyFeatureIds:["minorMajorAxisRatio"],
    scaleId:"train-empirical-mid-cdf-v1",
    intervalDistanceId:"closed-cdf-interval-distance-v1",
    aggregationOrder:["feature","observation","condition-group","stratum",
                      "nonempty-strata","seed","checkpoint"]
  },
  categoricalTagLossDefinition:null
}

simulation={
  latticeRadiusCells:115,
  checkpointBasalRadiusCells:[10,20,40],
  checkpointCriterion:"first-state-basalRadiusCells-greater-than-or-equal",
  executionOrder:"checkpoint-outer-seed-inner",
  maxStepCount:40021,
  seedDerivationPrefix:"snow-crystal-sim/T1-7/seed-v1/",
  seeds:[
    {index:0,derivationSha256:"067267644959298fcccf5751a438cb6eedcefe325f085997025e29a6fd7fd6af",
     stateU32Le:[1684500998,2401851721,1364709324,1858812068]},
    {index:1,derivationSha256:"7061bcfbe7242c394ac03d46ed5d1496e87e17821f5e2a1f4abb637423493aff",
     stateU32Le:[4223426928,959194343,1178452042,2517917165]},
    {index:2,derivationSha256:"7df501fec43bd4feaf6bca052062d0cb36203c27de50e1cb65e495b0db001996",
     stateU32Le:[4261541245,4275321796,97151919,3419431456]},
    {index:3,derivationSha256:"5d41398e0d5790438b7f804de7f351fc2a9acaf7399ed30c1f08a35b13c6070b",
     stateU32Le:[2386116957,1133532941,1300266891,4233229287]},
    {index:4,derivationSha256:"82e8a7e0b0be4953a50179247e748c2077006dec0d51b4586aad68c57e7efdeb",
     stateU32Le:[3769100418,1397341872,611910053,546075774]},
    {index:5,derivationSha256:"d21f3ac2b8df5e280d04f0b42b12f54ee705e31fae215c94faa7e584f4df7e62",
     stateU32Le:[3258589138,677306296,3035628557,1324683819]},
    {index:6,derivationSha256:"926c9755bb09b0b5b9b686f9f129be4d258a49d9cba8cc26270e4587a2af8966",
     stateU32Le:[1435987090,3048212923,4186355385,1304308209]},
    {index:7,derivationSha256:"5d4b43b7013caec4be9bc34702737ff707b244c60771f4e9486bb7e7682c544c",
     stateU32Le:[3074640733,3299752961,1204001726,4152324866]}
  ],
  failureCodes:["checkpoint-not-reached","reservoir-boundary-reached",
                "non-finite-metric","max-step-exceeded"]
}

candidateManifestContract={
  schemaVersion:"snow-crystal-candidate-manifest/1",
  relativePathPattern:"calibration/runs/{calibrationId}/candidate-manifest.json",
  hashAlgorithm:"rfc8785-jcs-sha256",
  candidateIdRule:"jcs-sha256-of-candidate-without-candidateId",
  allowedFamilies:["condition-blind-baseline","nearest-train-condition-baseline",
                   "piecewise-bilinear-map-v1"],
  requiredBeforeAnyScore:true
}

holdoutRecordContract={
  schemaVersion:"snow-crystal-holdout-run/1",
  runRecordBasename:"holdout-run.json",
  openIntentBasename:"holdout-open-intent.json",
  reportBasename:"holdout-report.json",
  stateOrder:["sealed","opening","opened"],
  secondOpenError:"holdout-already-opened-or-in-progress",
  requiredInputHashFields:["corpusSha256","splitSha256","protocolSha256",
                           "candidateManifestSha256","selectedCandidateId",
                           "selectedCandidateSha256","trainReportSha256"]
}
```

上の `25/3` は JSON文字列ではなく、test fixture生成コードで `600/72` を一度評価して保存する同一binary64
numberの表記である。

### TC-PROTOCOL-004: required/null/order/version/reference mutation

root、rasterization、losses、rank、各component、pairPenalty、shape、simulation、各seed、
candidateManifestContract、holdoutRecordContractの全 required propertyを一つずつ削除して
`TypeError(missing-property)`、各階層にunknown propertyを追加して `TypeError(unknown-property)`、
wrong typeを与えて `TypeError(wrong-type)` とする。`categoricalTagLossDefinition` だけが nullを許し、
他のnullは拒否する。

次の literal/order mutationを一つずつ検査する。

- schema/protocol/corpus ID、corpus/split/source-audit hashを1文字変更。
- rendererを `pdfjs-dist@6.3.288`、`6.3`、`^6.3.289`、canvasを `1.0`、`^1.0.6`、Nodeを
  `24.14`、`>=24` に変更し、完全一致でないものをすべて拒否。
- dpi 599/601、pointsPerInch 71/73、viewportScaleを25/3の隣接binary64、page-box/rotation/intent/
  annotation/worker/font/eval/background/sRGB/RGBA8/top-left/row-orderの各1項目変更。
- rank primary/integrated ID、component ID/field/metric/direction、pair penalty、aggregation順の変更・交換・欠落。
- shape scored feature/prediction metricの対応交換、report-only feature混入、CDF/distance ID、aggregation順変更。
- radius 114/116、checkpoint順交換/重複/値変更、criterion、execution order、maxStep 40020/40022、seed prefix変更。
- seed index交換/重複/欠落、derivation hash/stateの1 bit変更、uint32範囲外、all-zero state。
- failure code順交換、未知code、欠落。
- candidate manifest version/path/hash/id rule/family順/booleanを変更し、未知version/familyをscore前に拒否。
- holdout version/basename/state順/error/required hash field順を変更し、run recordとの不一致をopen前に拒否。

全固定幅tuple/arrayは長さと順序を厳密検査する。numberは有限、`-0`不可、integer fieldはsafe integer、seed
stateはuint32。protocol objectのlogical mutation後に `SHA256SUMS` または sibling hash参照を更新しなければ
`RangeError(hash-mismatch)`、hashだけ追随してもliteral契約違反なら対応するType/RangeErrorとする。

### TC-PROTOCOL-005: raster preparation boundary

通常test/runtimeはrendererを起動しない。データ準備工程だけが実行前に package/runtime versionを完全一致
assertし、固定PDF hash確認後、600 dpi、`viewportScale===600/72`、crop-box、PDF page rotation尊重、display、
annotation/worker無効、system font/eval無効、白背景、sRGB、RGBA8 straight alpha、top-left/top-to-bottomで
rasterizeした証跡だけを許す。renderer/canvas/Nodeのいずれかが違う既存evidenceを再利用せず
`RangeError(raster-protocol-mismatch)` とする。ネットワークなしの通常testは保存済みprotocol/evidenceのみを
検証し、PDF/page raster/panel cropをrepositoryへ追加しない。

## 12. holdout leakage と永続一回開封

### TC-HOLDOUT-001: training隔離とsealed検証

`scoreTraining` にholdout ID、annotation、shape、またはpartition混在objectを1件でも渡すと
`RangeError(holdout-data-in-training)`。training CDF、baseline、candidate選択、threshold、tie-breakはtrain
だけから作る。sealed recordのcorpus/split/protocol/manifest/selected candidate/train report/comparator/
human gate hashを一つずつ変更し、すべてholdout reader呼出し前に拒否する。human gateの
`decision`, `inputBundleSha256`, `evidenceSha256`, role, UTCも検証する。

### TC-HOLDOUT-002: sealed→opening→opened

isolated temp directoryにvalid sealed recordを置き、holdout readerをspyにする。期待順は次である。

1. sealed/hash/gate検証。
2. `holdout-open-intent.json` を`wx`でexclusive-createしflush。
3. opening recordをtemp+flush+same-directory atomic rename。
4. ここで初めてreaderが1回呼ばれる。
5. reportをtemp+flush+renameし、JCS hashをopened recordへ保存。
6. opened recordをtemp+flush+rename。intent markerは残る。

最終recordはstate opened、report hash一致、acceptance accepted/rejectedのいずれか。reportは全input hash、
candidate/comparator、24明細、loss、Paretoを持つ。

### TC-HOLDOUT-003: 排他、二回目、別process、crash

- 同一processの二回目は既存markerで `RangeError(holdout-already-opened-or-in-progress)`、reader 0回。
- child processを2つbarrierで同時開始し、`wx`成功はちょうど1つ。他方は同じRangeErrorでreader 0回。
- markerあり+sealed/opening/openedの各状態はすべて拒否し、自動resumeしない。
- opening record保存直後に注入crashさせるとmarkerとopening recordが残る。再起動後はreaderを呼ばず拒否。
- report保存後/opened保存前crashでもretryせず拒否。marker削除、state巻戻し、同じcalibrationIdでの再実行を
  APIとして提供しない。
- 別directoryにcopyしたrunは機械的には防げないため、テストは「暗号学的一回性」を主張せず、record/hashと
  repository evidenceを人間gateが照合する境界を確認する。

## 13. 完全コーパス acceptance と expected Red

### TC-REAL-001: 206件完成条件

`REAL206` について本書の全validation、全件二重転記、A/B candidate setとcomparisonの既知3 hash、
LocalStorage backupの固定hash・32件移行ID集合hash・上書きなし宣言、全206 panel×4 fieldの人間確認、
全206 morphology approval被覆、全projected evidence、`SOURCE-AUDIT.json` のproduction非依存全件照合、
split参照完全性、protocol完全literal、`SHA256SUMS` の3 canonical JSON hash、source-audit JCS hashと
そのsplit/protocol参照を検査する。個別source値は、固定hash PDFをfrozen A/B候補と照合し、人間が全206 panelを
確認したcommitted `SOURCE-AUDIT.json` だけを期待値とし、corpus自身、本書、test generator、
production generator/validatorから作らない。auditのcanonical corpus hashも実corpus JCS hashと一致させる。
1 fieldでも `humanConfirmedRawAndNormalized!==true`、1件でもpending、unapproved、hash mismatch、
移行上書き、unresolved extractionならcorpus incompleteでT1-8入力を拒否する。

### TC-RED-001: typecheckを壊さない期待 Red

`libbrecht-2023-figure2-schema-artifacts.test.ts` だけが期待 Red を持つ。static JSONをTypeScriptの静的importにせず、
`fs.existsSync` とpath variableで存在を確認し、次の5 pathを**別々の5 test case**で一つずつassertする。

1. `apps/snow-crystal-sim/calibration/libbrecht-2023-figure2-v1/corpus.json`
2. `apps/snow-crystal-sim/calibration/libbrecht-2023-figure2-v1/split.json`
3. `apps/snow-crystal-sim/calibration/libbrecht-2023-figure2-v1/protocol.json`
4. `apps/snow-crystal-sim/calibration/libbrecht-2023-figure2-v1/SHA256SUMS`
5. `docs/simulators/snow-crystal-sim/tasks/T1-7/SOURCE-AUDIT.json`

各testは対応する1 pathだけを検査し、先頭の例は次の意味にする。

```text
expect(artifactExists("calibration/libbrecht-2023-figure2-v1/corpus.json")).toBe(true)
```

5件それぞれについて存在確認がtrueになってからだけ、その成果物を必要とする動的read/parseへ進む。従って
実装前Redは5件すべてが独立したmissing-artifact assertion failureであり、module resolution、型error、依存error、
syntax errorではなく、欠けているcalibration artifactに対する期待assertion failureでなければならない。
同じ `describe` やloopの最初の失敗で残り4件を未実行にしてはならず、test runnerの結果に5つのpathが個別に現れる。
schema-artifacts file内のsynthetic oracle testsはGreenであり、scoring-protocolとholdout-safetyの全testも実装成果物を
読まないsynthetic Greenでなければならない。後者2ファイルへartifact存在assertionまたは期待Redを複製しない。

実装工程で作る計画済みfileは、calibration data directoryの **3 JSONと`SHA256SUMS`の計4ファイル**、task docs
配下のA/B候補＋人間全件確認 `SOURCE-AUDIT.json`、および§1に列挙した3 test fileだけである。
schema-artifacts fileは
`parseJsonRejectingDuplicateKeys`, `validateCorpusV1`, `validateSourceAuditV1`, `validateSplitV1`,
`validateProtocolV1`, `canonicalizeForOracle`, `rebuildSourceCandidateHashesForOracle`,
`migratePriorCaptureForOracle`、scoring-protocol fileは `deriveSplitForOracle`,
`scoreRankFixture`, `scoreShapeFixture`、holdout-safety fileは `openHoldoutFixtureOnce` をtest-local functionとして
所有する。同名helperを他ファイルへ複製せず、共有helper/source fileまたはbrowser/runtime/domain exportにしない。
holdout synthetic一時fileはtest終了時に隔離temp directoryごと破棄し、repository成果物へ含めない。

## 14. 追跡表

所有fileの略号は `schema-artifacts`、`scoring-protocol`、`holdout-safety` とし、いずれも§1の完全basenameを指す。

| DESIGN handoff | testcase | 単独所有file |
|---|---|---|
| source/PDF/206/page/ID/locator/raw/uncertainty/domain | TC-CORPUS-001, TC-SOURCE-001..004 | schema-artifacts |
| production非依存SOURCE-AUDIT schema、A/B/comparison既知hash、限定mu同値、32件無改変移行、824 field確認、approval/freeze/stale | TC-SOURCE-AUDIT-001..005, TC-REAL-001 | schema-artifacts |
| duplicate JSON、unknown、NaN/Infinity/-0、205/207、precedence | TC-CORPUS-002..003, TC-SOURCE-001 | schema-artifacts |
| A/B annotation、人間approval、hash、承認前拒否 | TC-ANNOTATION-001..003 | schema-artifacts |
| A/B extraction evidence、raw再計算、interval | TC-SHAPE-001..003 | schema-artifacts |
| RFC 8785、canonical hash、logical mutation | TC-JCS-001..002 | schema-artifacts |
| grouped split、9 stratum順、4-stratum、annotation不変 | TC-SPLIT-001..002 | scoring-protocol |
| SplitV1完全schema、required/null/order/reference/hash | TC-SPLIT-003..004 | schema-artifacts |
| exact rank fraction、direction/tie/missing、macro/Neumaier | TC-RANK-001..003 | scoring-protocol |
| empirical mid-CDF、interval、shape hierarchy | TC-CDF-001..003 | scoring-protocol |
| time/FOV invariance、24 scale marginalization、failure | TC-SCALE-001..002 | scoring-protocol |
| baseline、候補順、tie、Pareto | TC-CANDIDATE-001, TC-BASELINE-001, TC-ACCEPT-001 | scoring-protocol |
| radius115、9919、checkpoint40、40021 | TC-PROTOCOL-001 | scoring-protocol |
| literal 8 seed、決定性 | TC-PROTOCOL-002 | scoring-protocol |
| ProtocolV1完全schema、renderer/loss/simulation/candidate/holdout | TC-PROTOCOL-003..005 | schema-artifacts |
| sealed/opening/opened、exclusive marker、crash | TC-HOLDOUT-001..003 | holdout-safety |
| copyright、non-network、実データ非捏造、5件の独立expected Red | TC-CORPUS-001, TC-REAL-001, TC-RED-001 | schema-artifacts |

## 15. 24画像・3モデル形態注釈pilot sidecar

### 15.1 共通fixture、独立oracle、実装境界

本節は `morphology-ensemble-pilot/1` だけを対象にする。positive fixture `SYN-PILOT-24` は架空の
206 candidate/proxy行と24件の匿名画像をtest内だけで生成し、Libbrecht画像、実source値、既存A/B vote、
人間finalを複製しない。source ID形式だけを契約どおりにし、page別候補数は
`[52,52,51,51]`、pageは`[11,12,13,14]`、ordinalは各pageで1始まり連続とする。各pageのproxy signatureは
少なくとも8種類を循環させ、A/B完全一致とfield別`disagreement`の双方を含める。test-local selection oracleは
規範preimageを直接UTF-8化してSHA-256し、group内rank、page内round-robin、batch-orderをvalidatorと別実装で
導出する。期待24 ID、各page6件、`pageSlot=1..6`、全体ordinal`0..23`、batch`12+12`をliteral snapshotとして
test codeへ固定し、validator自身の出力を期待値に使わない。

匿名IDは `img-001..img-024`、filenameは `img-001.png..img-024.png` とし、source/page/条件を符号化しない。
hash fixtureはtest-local `H(label)=SHA-256(UTF-8("SYN-PILOT-24/"+label))` で互いに異なる64 lowercase hexを
作る。実装validatorへ渡す期待hashは、JCS/PNG/raw byteをtest oracleが再計算してからliteral fixtureと照合する。

test-only validatorの許可された外部作用は、明示された隔離temp directory内でのtemp write、flush、atomic rename
だけである。入力artifact、repository、workspace、`PILOT_WORK_ROOT`外、既存LocalStorage相当sentinelを変更しない。
ネットワーク、DNS、HTTP(S)、browser API、production runtime exportを使用しない。各mutationはbase fixtureを
deep cloneして1箇所だけ変更し、期待する最初のerror class、field、stable reasonを検査する。duplicate keyと
JSON/JSONL構文は`SyntaxError`、型/required/unknown/enumは`TypeError`、件数/順序/値域/hash/参照/mapping/
coverageは`RangeError`とし、修復、clamp、drop、implicit sort、partial acceptanceを許さない。

### TC-PILOT-SELECTION-001: 206候補、proxy blindness、各page6件

`SYN-PILOT-24`について次を独立再計算し、完全一致させる。

1. candidate/proxyは同じ206 source IDをASCII昇順でちょうど1回覆い、candidate page/ordinalとIDが一致する。
2. proxyは凍結A/B voteだけから、field一致なら値、不一致なら`disagreement`へ写像する。human final、pilot final、
   condition、画像特徴を読むhookを設けない。
3. selection keyはpage、完全proxy signature、source ID、固定seed、batch keyは固定seedとsource IDの規範preimageから
   test oracleが再計算する。
4. pageごとにsignature group内rankを付け、`(rank,key,id)`順の先頭6件を選ぶ。結果は各page6件、全24件、
   source ID重複なしである。
5. 選定24件を`(batchOrderKey,id)`で再排序してordinal`0..23`を付け、batch-01=`0..11`、batch-02=`12..23`。

mutationは candidate/proxy 205または207件、A/B片側欠落、field欠落、proxyをhuman finalから変更、未知/重複ID、
page候補5件、page quota `7/5/6/6`、pageSlot/ordinal/key/orderの1 byte相当変更、選定後の画像/slot差替えを含む。
いずれも`selection-invalid`または対応する最初のstable reasonで停止し、別候補で補完しない。

### TC-PILOT-SELECTION-002: blinded manifestとrestricted mapの非漏洩

positiveではmanifest/mapが同じ24 anonymous ID、filename、relative pathを一対一で持ち、entriesはanonymous ID昇順、
2 batchは各12件で全24件を重複なく被覆する。manifestに許すのは匿名ID/path、寸法、derivative file/RGBA hash、
mask rectangle、codec/tool/versionだけであり、source ID、page、locator、source filename/path、温度、過飽和度、
成長時間、視野寸法、proxy、A/B、人間finalを含めない。restricted mapだけがsourceへ結合する。

unknown/duplicate/missing pair、両manifestのfilename/path不一致、absolute path、drive letter、`..`、username、
匿名ID/filenameへの`P11`/source ID/条件値埋込み、manifestへの禁止propertyを各々拒否する。actor workspace inventoryは
当該12 PNG、protocol object、role schema、prompt、batch inputだけを許し、repository、restricted map、別actor出力、
既存A/B、human finalを1 entryでも含めればfail closedとする。

### TC-PILOT-DERIVATIVE-001: raster crop、mask外不変、RGBA hash

3×2 RGBA8 source fixtureを次で固定する。row 0は
`[1,2,3,255],[4,5,6,255],[7,8,9,255]`、row 1は
`[10,11,12,255],[13,14,15,255],[16,17,18,255]`。rectangle `[1,0,1,1]` だけを
`[127,127,127,255]`へ置換したderivativeの
`uint32LE(3)||uint32LE(2)||top-left row-major RGBA8` hashは
`ce498a4c03778d930ccd0fb7c8d131354411078735b91921825efd511d94d7a8`、§5.1A.2のcanonical PNG file hashは
`facaaab2f65212b4f83f6ff6201e11cb802bb04b0ff1a8b5003bfe0a0578891c`、file lengthは94 byteとする。
test oracleはCRC32、zlib header/Adler32、stored DEFLATE block、PNG chunkをvalidatorと共有せず実装する。

stored DEFLATE primitiveのblock境界は、`payload[i]=i % 251` のbyte列で次のliteralを固定する。

| payload bytes | stored blocks | zlib stream bytes | zlib stream SHA-256 | Adler32 big-endian |
|---:|---:|---:|---|---|
| 65535 | 1 | 65546 | `9881331fd58a9bbabb90ab8183df28d656aa8842e9803b9c59887f4dba2e5652` | `76e7fc24` |
| 65536 | 2 | 65552 | `859a87cf3e62ebc586ea75afd22590201cec9f4b7264e77660902135d20fa2db` | `7332fc3c` |
| 131071 | 3 | 131092 | `1f94cbdc18866a65579e3affe1306e380cce9a444b7548c92f0aa79b784073a8` | `6517fac6` |

RGBA8 PNG positiveはpixel `(x,y)=[x&255,y&255,(x+y)&255,255]`、各scanline filter 0とする。
64×255でraw payload 65535 byte、16384×1で境界直後の65537 byte、64×511で131327 byte/3 stored blocksにする。
RGBA8/filter-byte付きPNGのraw長は正の整数`height*(1+4*width)`であり、`1+4*width`は1より大きい奇数なので、
2の冪65536と厳密一致する正のwidth/heightは存在しない。このため65536 exact boundaryは上のstored-DEFLATE
primitiveで固定し、PNG統合は65535 exactと直後の65537の両側で検査する。この理由なく65536 caseを
省略したり、width 0の不正PNGで代用したりしない。

| dimensions | raw scanline bytes | blocks | IDAT zlib bytes | IDAT SHA-256 | PNG bytes | PNG SHA-256 |
|---|---:|---:|---:|---|---:|---|
| 64×255 | 65535 | 1 | 65546 | `eb44697f4de622d087fdc539c6f1b61bf1c856b24897f53bbf424d8be16e71ac` | 65603 | `c0b5b070084e0f58cea7b60449ea1a99719c619adfdd6375a4cf2c686c60dc07` |
| 16384×1 | 65537 | 2 | 65553 | `b6ecf0d57058bc7883248568655c57f103fd6926f9330e69db3ad4eb515ef5b4` | 65610 | `eb8d1eca0e065338a3a6ca9c04898568af22ec4e013530c5d9ef869664fed154` |
| 64×511 | 131327 | 3 | 131348 | `030b8718c90dd509aac5b3312f6677e3a87c267413e83de4873a378325a27c54` | 131405 | `c0a06dbe2d0e810ae986be96cdd6db45dc42050367599d27d9d89c68c3bee333` |

各stored blockは5 byte headerを独立parseし、非終端`BFINAL=0`、最終だけ`BFINAL=1`、`BTYPE=00`、
little-endian `LEN`、`NLEN=(~LEN)&0xffff`、payload連続性を確認する。65535/65536の境界でBFINALを逆転、
LEN/NLENの1 bit変更、block欠落/余分/順序交換、65535を越えるLEN、payload重複/欠落、bad Adler32、
IDAT分割または複数IDATを各々拒否する。少なくとも3 block fixtureで、先頭/中間/最終の各header mutationを
別々に適用し、先頭errorで停止する。

PDF viewportはbinary64の4 corner変換から`floor(min)`/`ceil(max)`し、clamp/paddingなしのhalf-open cropを確認する。
rectangle外RGBAの1 byte変更、big-endian寸法、bottom-up、別rounding、clamp、padding、rotation/flip/interpolation、
mask `[127,127,127,254]`、重複/範囲外/0幅rectangle、ancillary/ICC/EXIF/text/time chunk、filter非0、compressed
DEFLATE、複数IHDR/IDAT/IEND、decode寸法/hash不一致を個別に拒否する。実論文画像はfixtureに含めない。

### TC-PILOT-DERIVATIVE-002: upload直前再照合とattachment evidence

24件すべてでupload直前のfile/RGBA hash、width/height、MIMEをmanifestと再照合し、
`clientSideTransform='none'`、`attachmentPreview='full-frame-visible-no-obvious-corruption'`、匿名IDとattachment slot
の一対一対応を要求する。file差替え、decode失敗、寸法違い、MIME違い、slot重複、previewのcrop/破損/向き変更/
過度な縮小/mask欠落/ID対応欠落はrun全体を拒否する。maskが結晶/seedへ重ならず外周/先端を欠かないこと自体は
実画像の人間送信前確認であり、testはその代わりに物理形態を推測せず、synthetic pixel不変性とpreview evidenceだけを
機械検査する。

### TC-PILOT-TRANSPORT-001: 972直積中5 stateだけを受理

receipt 3値×received file hash 3状態（null/期待一致/well-formed不一致）×received RGBA hash 3状態×
assurance 3値×preprocessing 2値×policy version 2状態×policy evidence 3状態の972組を固定順で全列挙する。
独立oracleのvalid setは規範protocol §5の5 tupleだけで、受理数をliteral `5` とする。未分類/二重分類は0。

- `byte-identical`は期待file hash、RGBA null、`verified-bytes`だけ。
- `decoded-rgba-identical`はfile null、期待RGBA hash/寸法/layout、`verified-pixels`だけ。
- `not-exposed`は両receipt hash null、`local-input-only`、`unobservable`、policy null/nullだけ。
- 前2種のpreprocessingは`unobservable/null/null`または、保存policy bytesとprovider/model/client/version/
  attachment mode/version/hashが全一致する`documented-no-transform`だけ。

972外でもclient transform非none、preview不合格、upload hash/寸法/MIME不一致、headerとattachment mode混在、
受領hash二重記録、policy bytes/provider/model/client/version/attachment mode不一致を拒否する。
`local-input-only`をprovider受信pixel同一とreportするmutationも拒否する。

### TC-PILOT-MAPPING-001: growth全243組

`growthTargetVisibility` 3×`newBasalPlane` 3×`newAxialGrowth` 3×`seedCrystal` 3×
`seedNewGrowthSeparation` 3の243組を全列挙する。seed合法性とnot-visible固定値を先に適用し、規範predicateへ
排他的に写像する独立oracleと比較する。schema-validはliteral `76`、invalidは167、valid各組のlabel数1、
未分類/二重分類0とする。`sufficient+(clear,absent)`、`sufficient+(absent,clear)+separation clear`、
`sufficient+(clear,clear)+separation clear`、limited/not-visible、元seedをaxialへ誤算入するmutationを含む。

### TC-PILOT-MAPPING-002: branching全2304組

branch visibility 3×new basal 3×`primaryArmOrSector/facetedOutline/sidebranch/secondGenerationBranch`各4の
2304組を全列挙する。合法10 tuple、visibility/basal文脈、level 0..3/nullをtest-local set/predicateから判定し、
valid `44`、invalid `2260`、valid各組のlabel数1、未分類/二重分類0とする。溝、反射、鋸歯、粒状付着を
sidebranch clearへ昇格するshortcutを許さず、ACNN=0、CNAN=1、CNCA=2、CNCC=3と残りnullを固定する。

### TC-PILOT-MAPPING-003: hollowing全243組

hollow visibility 3×opening/rim/inner wall各3×belongs 3の243組を全列挙し、valid `93`、invalid `150`、
valid各組のlabel数1、未分類/二重分類0とする。sufficient+3 clear+belongs clearだけpresent、3 absent+
not-applicableだけabsent、3 clear+belongs uncertainを含む残り合法値とlimited/not-visibleはindeterminate。
暗線、白窓、段差、陰影だけをpresentへ昇格するshortcutを許さない。

### TC-PILOT-MAPPING-004: confidence全81組とpayload局所制約

3 field confidence各3×final confidence 3の81組を全列挙し、3 fieldの最小値と一致する27組だけを受理し、
54組を拒否する。`low<medium<high`をliteral順で持ち、平均/多数決による引上げを検出する。
あわせてvisibility limitationのenum順・重複なし、`other`と`otherLimitation`の双方向、evidence NFC 1..200、
other 1..120、unknown property、12 payloadのID/order/coverageを検査する。

### TC-PILOT-PROMPT-001: protocol/schema file-object hash binding

protocol objectはcontract/protocol literal、24、page quota、3 actor family、2×12、案A、最大3 attempt、raster/
serialization/consensus/approval literalを完全schemaで検査する。role別schema fileは
`UTF-8(JCS(schemaObject))||LF`だけを許し、object hashはLFなし、file hashはLF込みで独立再計算する。
protocol、`PromptVariablesV1`、`RenderedPromptEvidenceV1`、vision headerのrole/file/object hashが完全一致する
positive fixtureを置く。CRLF、BOM、indent/space、追加LF、複数object、self hash property、annotator/adjudicator
schema交換、object/file hash代用、1 byte schema mutationを各々拒否する。

### TC-PILOT-SCHEMA-001: protocolの全22 schema file bundle

`MorphologyPilotProtocolV1.schemaFiles` の次の22 propertyをliteral expected setとして固定し、欠落、追加、重複、
property名のaliasを許さない。

```text
protocolObjectSchemaFileSha256
selectionCandidateSetSchemaFileSha256
selectionProxyInputSchemaFileSha256
selectionPlanSchemaFileSha256
blindedManifestSchemaFileSha256
restrictedMapSchemaFileSha256
batchInputTableSchemaFileSha256
annotationPayloadSchemaFileSha256
adjudicationPayloadSchemaFileSha256
consensusRoutingTruthTableSchemaFileSha256
artifactSchemaFileSha256
candidateAliasSchemaFileSha256
candidatePayloadTableSchemaFileSha256
annotationConsensusSlotPlanSchemaFileSha256
activeAnnotationConsensusSnapshotSchemaFileSha256
supersessionLedgerSchemaFileSha256
invalidAttemptEvidenceSchemaFileSha256
renderedPromptEvidenceSchemaFileSha256
postConsensusRouteSlotPlanSchemaFileSha256
activeUpstreamSnapshotSchemaFileSha256
humanApprovalSchemaFileSha256
pilotCoverageSchemaFileSha256
```

positive schema bundleは22個の互いに異なるschema object/fileを持つ。test-local duplicate-aware parserで各fileを
1 objectとしてparseし、追加property禁止を含む当該schemaの正例を確認した後、NFC、RFC 8785 JCS、UTF-8、BOMなし、
末尾LF厳密1個のbytesへ再構成する。各fileについて
`objectHash=SHA-256(UTF-8(JCS(object)))` と
`fileHash=SHA-256(UTF-8(JCS(object))||0x0A)` をvalidatorと共有しないoracleで再計算する。
protocolの22 referenceは対応する`fileHash`へ一対一で一致させ、annotation/adjudication roleではさらに
`PromptVariablesV1`、rendered evidence、vision headerのfile/object hash bindingまで辿る。

mutation loopは22 property **それぞれ**について、(a) property欠落、(b) file欠落、(c)別propertyとのreference交換、
(d)object hashをfile hash欄へ代入、(e)file hashをobject hash欄へ代入できるrole/schemaでの代入、
(f)schema fileの先頭・中央・末尾LF直前の1 byte変更、(g)referenceだけの1 hex変更を独立適用し、全て拒否する。
同一bytes/hashのschemaを別propertyへ使い回すpositiveは置かず、swapが偶然見逃されないfixtureにする。
CRLF、BOM、追加LF、pretty print、unknown schema file、schema file自身へのhash埋込みも拒否する。

### TC-PILOT-PROMPT-002: exact template bytesとrendering

規範protocol §15/§16のcode fence内だけをUTF-8/NFC/LF/末尾LF1個で抽出したliteral file hashを固定する。

| role | byte length | SHA-256 |
|---|---:|---|
| annotator | 4531 | `d5d5f557b701e76cb1c71b86c378e59cb44a8ddb81dba33577a248767bb5ed8c` |
| adjudicator | 3133 | `21c13a7dc4a782181dc0df55ac24a17f1840bf457b4196a09894160fc4174a03` |

annotatorは許可3 placeholder、adjudicatorは許可4 placeholderを各1回だけ持ち、他の`{{`/`}}`を持たない。
ASCII byte rangeをtemplate出現順にcanonical JSON bytesへ無加工置換し、元template最終LFを含むrendered hashを
独立oracleで計算する。placeholder重複/欠落/未知、置換順交換、quote/escape/trim/indent/fence/改行変換、
templateまたは変数の1 byte mutationを拒否する。

### TC-PILOT-PROMPT-003: batch input tableとprompt/runの同一入力

annotation tableはmanifest該当12件をbatch順、adjudication tableはroute partition 1..20件をmanifest順に持ち、
ordinal 0始まり連続、anonymous ID/attachment slot重複なしとする。tableのdirect JCS object hash、
`batchInputTableCanonicalJson` UTF-8 hash、prompt variables、vision header、run records、実添付順を完全一致させる。
annotation `orderedInputSha256` はordered-image-input、adjudicationはcandidate-inputである一方、画像列はtable bindingで
別途固定されることを検査する。1 item swap、hash/slot/ID/batch変更、部分table、余分itemをrun全体rejectとする。

### TC-PILOT-RUN-001: 3 actor×2 batch、family binding、独立入力

第一slot planは次の6 annotation tupleとconsensus 1 slotの厳密7 slotである。
`(annotator-1,batch-01/02)`、`(annotator-2,batch-01/02)`、`(annotator-3,batch-01/02)`、`consensus/all-24`。
各annotationは12 record、計72、actorごとに同じ24件を同じbatch順で被覆する。familyは
`annotator-1=claude`、`annotator-2=openai`、`annotator-3=google`だけを許す。provider、product、表示model ID、
client/tool、attachment mode、開始/終了UTC、raw capture、prompt/schema/input hashを必須にし、表示model IDまたは
provider欠落、actor交換、兼任、adjudicator混入、batch共有artifactを拒否する。

actor×batchは異なるlogical slot/campaign IDと隔離workspace inventoryを持ち、他actor出力、既存A/B、human final、
restricted mapを入力hash/DAGに含めない。campaign IDの分離と入力inventoryは機械検査するが、VSCode/chatの
fresh contextそのものはprovider内部状態を暗号学的に証明できないため、実行時checklistで新規session/chatを人間が確認する。
この限界をAI独立性の完全証明と記載してはならない。

### TC-PILOT-RUN-002: 12件atomic batchとcapture integrity

positive annotation JSONLはheader+12 record、manifest順、各ID1回、全payload/mapping/hash/transport validである。
1件でもmissing/duplicate/unknown/order違反、schema-invalid、mapping違反、transport不正、raw hash違反なら12件全体を
rejectし、validな11件をconsensusへ混ぜない。Gemini manual copyはvisible本文をUTF-8/LFで文字変更なく保存し、
Markdown fence、前後説明、不正JSONを人間修復しない。account/chat URL/clipboard metadata/画面exportの混入を拒否する。

### TC-PILOT-ATTEMPT-001: invalid attempt、最大3回、first-valid root

規範protocol §8.1の次のpositive sequenceをすべて固定fixtureで検査する。

1. valid attempt 1、2. invalid→valid、3. invalid→invalid→valid、4. invalid×3でfailed-closed、
5. replacement invalid→valid、6. replacement invalid×3でfailed-closed。

schema-invalid raw responseのimmutable byte fixtureはASCII/UTF-8/LFの
`6e6f742d6a736f6e0a`（表示文字列`not-json`と末尾LF）、byte length `9`、SHA-256
`60498ebafa3f473a2a72c1242e8c3202bf50a6d81dfc721958be1550f46faf33` とする。test oracleは保存raw fileを
直接stream hash/countし、evidenceの`rawResponseSha256`/`rawResponseByteLength`と一致させる。evidence作成後の
raw file上書き、追記、truncate、rename先差替えを行うと再検証で必ず拒否し、evidence側を更新して修復しない。

UTC orderingのpositiveは、`startedAtUtc <= completedAtUtc <= responseCapturedAtUtc`について、
(a)3値すべて等しい、(b)started=completed<captured、(c)started<completed=captured、(d)3値が厳密増加、の4組を
固定する。`00:00:00Z`、`00:00:01Z`、`00:00:02Z`の全6 strict permutationも列挙し、昇順1組だけを受理、
残る5 inversionを拒否する。さらにstarted>completed、completed>captured、started>capturedの各predicateが
少なくとも1 fixtureでtrueになることをassertし、隣接比較片方だけの実装を検出する。

invalid responseは`InvalidAttemptEvidenceV1`だけを作り、planned root/replacement artifact ID、slot header、ledger edge、
snapshot/consensus/candidate/coverage itemを作らない。最初のschema-valid wrapperだけが凍結root IDを取得する。
replacementはvalid wrapper+ledger edgeをatomic確定するまで旧activeを変えない。attempt 1/2はretry-allowed、3は
attempt-limit-reached、retryはfresh contextで同じcampaignの凍結prompt/input/current activeを保つ。

mutationはattempt 0/4、欠番/重複、validとinvalid evidenceの同番号二重化、campaign/preimage不一致、evidence ID/file
hash不一致、raw本文/断片/自由文error/path/PII混入、validation error複数、UTC逆転、invalid evidenceのslot/ledger/
snapshot混入、root invalid3回後の継続、activeを先に置換する実装を含む。required annotation rootが3回失敗すれば
pilot全体停止、adjudication3回失敗は旧planを書換えず、新しいskipped planへのdirect-human fallbackだけを許す。
raw response mutationは、hashだけ不一致、lengthだけ不一致、双方不一致、length `0`、負数、小数、
`Number.MAX_SAFE_INTEGER+1`、実fileより1小さい/大きい値を個別に含める。UTCはfractional second、offset、lowercase
`t/z`、不存在日時に加え、上記5 strict inversionをすべて拒否する。

### TC-PILOT-CONSENSUS-001: 64 predicate全列挙とrecord導出

`D=0..3`外側、`U,L,O,H=false,true`内側の固定順で64組を全列挙し、規範4 predicateのちょうど1つへ一致させる。
row count 64、重複/欠落0、各rowのcategory/route一致をliteral truth table hashと照合する。record fixtureではDを3つの
morphology field差、Uをindeterminate/null、Lをfield/final low、OをObservation JCS差、Hを全field/final highから
再計算し、evidence自由文差をOへ入れない。disagreement fieldはenum順完全集合、observation pathはASCII昇順、
D=0だけproposed morphology、4 confidence component全一致時だけproposed confidenceを許す。

入力されたcategory/routeを信頼する、`confidenceDiffers`だけでOを立てる、`D=1`をU/L/Oより優先する、代表例だけを
検査する、truth-table row swap/hash違いを拒否する。

### TC-PILOT-SLOTS-001: 二段階slot planとroute partition

第一planはmodel run前に7 slotをfreezeする。7 active terminalとconsensus hash確定後、adjudication/approval前にだけ
第二plan4 slotをfreezeする。Q=consensus route adjudicationのanonymous ID昇順集合とし、fresh modeは先頭最大20を
adjudication-01、残り最大4を02へ分割する。human batch allowed setはlabel-exact-all-high source ID、human individual
allowed setは常に24 source IDでrequired。unused slotはroot/artifact/terminalなし、空set hash、理由ありとする。

第二plan早期作成、Qの21件目欠落、partition重複/順序違い、unused root、required null root、human individualの
非required/23件、plan後のin-place変更を拒否する。

### TC-PILOT-SLOTS-002: supersession ledger一本鎖とactive terminal

空ledger、rootのみ、root→replacement、root→r1→r2のpositiveを検査する。ledgerはheader、metadata、sequence昇順、
previous file hash、byte/object同一prefix、連続sequenceを要求する。`selectActive`は指定cutoffまでだけを読み、slot rootから
唯一terminalを返す。cycle、branch、multiple root/terminal、sequence欠番/交換、別kind/slot edge、unknown artifact/file hash、
plan外/unused artifact、ledger自身のsupersede、in-place overwriteを拒否する。

### TC-PILOT-SLOTS-003: active snapshotsと非循環DAG

annotation/consensus snapshotは7 required active terminalをkind/slot順、upstream snapshotは対象approvalのconsensus/
adjudicationと推移的annotation closureを過不足なく持つ。指定ledger/cutoff後artifact、human approval、coverage、ledger自身、
自己hash、後続artifactを含めない。規範§13のDAGをDFSしcycle 0とする。active artifact置換後に旧snapshotを再利用、
snapshot item欠落/余分/順序交換、cutoff mismatch、逆参照、object/file hash代用を拒否する。

### TC-PILOT-ADJUDICATION-001: fresh非重複familyまたはdirect-human

fresh positiveはGitHub Copilotの画面表示family/client versionを記録し、familyが`claude|openai|google`のいずれとも
異なる場合だけeligibility non-null、skip reason null、Q partition artifactを許す。family重複/不明、表示名欠落、利用不能、
run失敗はeligibility null、規範skip reason、新しい第二plan、adjudication artifact 0、Q全件human individualとする。

fresh modeではactive3候補をactor非表示のX/Y/Zへdomain-separated sort keyで決定的に割り当て、candidate tableから
provider/model/actor/time/元順を除く。`propose-one-candidate`、`propose-new-value`、`retain-human-review`のcross-field条件、
partition 1..20 exact coverage、同じblinded image/prompt/hashを検査する。多数派やalias順への固定、架空family、
evidenceだけ違うnew value、自動human final昇格を拒否する。

### TC-PILOT-APPROVAL-001: batch/individual approvalの正例とmutation

24件のうち8件を`label-exact-all-high` batch approved、16件をindividual（approved/correctedを混在）とするpositive fixtureを
固定する。batchはactive consensus proposal non-null、final JCS一致、approved、rationale nullだけ。individualはactive
consensus必須、fresh Qならactive adjudication、skip Qならconsensusを参照し、approvedはproposal/final一致、correctedは
final non-nullかつproposal nullまたは不一致、rejectedはfinal null、全outcomeでNFC 1..500の非個人情報rationaleを要求する。

source ID順、mode/target kind、active upstream hash、proposal object/hash、final values hash、approval IDとcompleted record
object hashを独立再計算する。batch修正、individual空rationale、inactive/superseded proposal、架空adjudication、proposalを
そのままhuman final扱い、氏名/email/account/device/chat URLを含むschema外propertyを拒否する。

### TC-PILOT-APPROVAL-002: active source approvalからだけexact 24 coverage

第二planのrequired human slotsをledger/cutoffでactive terminalへ解決し、coverage snapshotを先にhashする。covered finalsは
active approval JSONL targetからだけ抽出し、手入力/consensus/adjudication/別cacheから受け取らない。restricted map由来の
期待24 anonymous/source pairを、approved|correctedかつfinal non-nullで各1回覆い、source ID昇順の厳密24件とする。
approval/file/record/target hash、approval ID、expected set hashを独立再計算する。

unknown/duplicate/missing/片側mapping、rejected/spot-check、superseded/non-terminal approval、proposalだけ、upstream snapshot
不一致、23/25件、coverageScope変更を拒否する。coverageは`pilot-24`であり、productionの206 annotation approval、
corpus complete、split/loss/holdout、T1-8入力へ渡すと既存`RangeError(annotation-approval)`境界で拒否されることを確認する。

### TC-PILOT-ISOLATION-001: copyright、privacy、production、LocalStorage隔離

repository rootとworkspace rootの子孫を`PILOT_WORK_ROOT`に指定すると開始前に拒否し、隔離temp rootだけを許す。
実行前後にrepository file list/hash、production calibration directoryの許可4 basename、`SOURCE-AUDIT.json`相当sentinel、
既存human approval/LocalStorage export相当sentinelを比較しbit-for-bit不変を確認する。global fetchをthrowing stubにし、
全synthetic testが通る。

repository/evidence allowlistはcontract/protocol/test source、privacy/copyright検査済みhash、byte length、件数、集計、
制約、stable stop reasonだけとする。PDF、page raster、crop、derivative、mask、restricted map、source mapping、raw response、
自由記述画像説明、PII、credential、chat URL、accountをfixture output/repositoryへ書くmutationを拒否する。
validation temp fileは隔離root内で再parse/rehash後にatomic renameし、失敗時はpartial final fileを残さない。

### TC-PILOT-METRICS-001: 記述的metricsと残り182件非昇格

24件positiveからactor/field/transport assurance別に、分子/分母付きcoverage、invalid attempt、rejected/superseded valid、
3者exact、pairwise confusion、branch pairwise quadratic-weighted Cohen kappa、indeterminate/null、visibility limitation、
human final disagreement、adjudication resolution、operator/human timeを独立集計する。二項率は
`z=1.959963984540054`のtwo-sided Wilsonを使い、`k=12,n=24`は
`[0.3142742581957335,0.6857257418042665]`、分母0はreason付きundefined。kappaは両側non-nullの0..3だけを使い、
identical `[0,1,2,3,null]` pairのincluded=4、excluded=1、kappa=1を確認する。集計順交換でも整数countは不変とする。

reportはhuman finalをoperational referenceとだけ呼び、著者正解/物理ground truth/206件性能保証、採用pass/fail閾値を
出力しない。残り182画像、Option B、production migration、selection/prompt/schema/mapping変更後の採用性能を許可する
flag/APIを持たない。24件を`206`へ外挿、182件を実行済み扱い、pilot finalをcorpusへcopyするmutationを拒否する。

### TC-PILOT-RED-001: validator artifactだけの期待Red

新規test fileはcomputed pathへ`existsSync`を使い、test-only validator
`apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs`の存在を
**1個の独立test**でassertする。静的importを使わず、存在確認がtrueになった後だけdynamic importしてvalidator conformance
testを有効化する。従ってtest-code commit直後の新規Redは、この1 pathのmissing-artifact assertion failureであり、
module resolution、型、構文、依存、ネットワークerrorではない。test-local oracle、literal hash/count、protocol文書hash/
template抽出testはGreenである。

validator実装後はpilot fileのskipが0、全`TC-PILOT-*`がGreenでなければならない。既存の5件の
`TC-RED-001`はproduction corpus未完成による既知Redであり、本pilot validator実装のGreen判定と別に報告する。
test-code review後は本書のmutation、count、toleranceを削除、skip、緩和せず、変更が必要ならtestcase reviewへ戻す。

### 15.2 pilot追跡表

| DESIGN/protocol handoff | testcase | 単独所有file |
|---|---|---|
| 24 selection、page quota、proxy blindness、batch order | TC-PILOT-SELECTION-001 | morphology-pilot |
| blinded/restricted分離、匿名性、workspace inventory | TC-PILOT-SELECTION-002, TC-PILOT-RUN-001 | morphology-pilot |
| crop/mask/PNG/RGBA/upload evidence | TC-PILOT-DERIVATIVE-001..002 | morphology-pilot |
| transport 972/5、policy binding | TC-PILOT-TRANSPORT-001 | morphology-pilot |
| growth 76/243、branch 44/2304、hollowing 93/243、confidence 27/81 | TC-PILOT-MAPPING-001..004 | morphology-pilot |
| protocol/schema file-object hash、全22 schema bundle、exact prompt/rendering/input binding | TC-PILOT-PROMPT-001..003, TC-PILOT-SCHEMA-001 | morphology-pilot |
| 3 actor×2 batch、family、72 records、atomic capture | TC-PILOT-RUN-001..002 | morphology-pilot |
| invalid evidence、max3、first-valid root、fail closed | TC-PILOT-ATTEMPT-001 | morphology-pilot |
| D/U/L/O/H 64 route rows | TC-PILOT-CONSENSUS-001 | morphology-pilot |
| 二段plan、ledger、active snapshot、DAG | TC-PILOT-SLOTS-001..003 | morphology-pilot |
| nonoverlap adjudicator / direct-human fallback、candidate alias | TC-PILOT-ADJUDICATION-001 | morphology-pilot |
| exact24 human final、source approval由来coverage | TC-PILOT-APPROVAL-001..002 | morphology-pilot |
| copyright/privacy/production/LocalStorage隔離 | TC-PILOT-ISOLATION-001 | morphology-pilot |
| Wilson/kappa/assurance別metrics、182非昇格 | TC-PILOT-METRICS-001 | morphology-pilot |
| 1 validator pathの期待Red | TC-PILOT-RED-001 | morphology-pilot |
