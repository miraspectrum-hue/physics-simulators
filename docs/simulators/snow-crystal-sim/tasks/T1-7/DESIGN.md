# T1-7 観測コーパスと較正プロトコル — 設計

## 1. 目的、権威、変更境界

本タスクは Libbrecht (2023) Figure 2 の 206 観測を、原資料へ戻って監査できる静的コーパスへ
固定し、後続の T1-8、T1-4、T1-10 が同じ学習／holdout 分割と比較手順を再現できるようにする。
コーパスは実験観測であり、Reiter CA のパラメータを物理量へ変換する式ではない。

権威は `SPEC.md > DESIGN-OUTLINE.md > tasks/T1-0/DESIGN.md > 本書` の順である。
T1-3 の承認済み `morphologyMetrics` はシミュレーション側の独立指標として参照するが、
観測画像の値や形態タグを生成するオラクルには使わない。

- 実行プロファイル: `full`
- UI 影響: なし
- 依存: T1-3
- 設計・実装の変更境界:
  - `docs/simulators/snow-crystal-sim/tasks/T1-7/`
  - `apps/snow-crystal-sim/calibration/libbrecht-2023-figure2-v1/` の静的データ
  - `apps/snow-crystal-sim/tests/calibration/` の読込み・検証・loss テスト
- 禁止:
  - `domain/morphologyAt`、`step`、`morphologyMetrics`、公開 domain export の変更
  - app/UI/scene、描画、較正済み数値写像の実装
  - 物理秒と CA step の対応付け
  - 観測点、形態タグ、寸法、較正値、出典内にない不確かさの推測による補完

本タスクの静的 JSON はリポジトリ内で公開されるデータ契約だが、ブラウザ runtime の公開 API
ではない。検証 helper は test-only とし、domain から import しない。

## 2. 一次資料と確認済み事実

### 2.1 固定する版

- Kenneth G. Libbrecht, “A Taxonomy of Snow Crystal Growth Behaviors: 2. Quantifying the
  Nakaya Diagram,” arXiv:2306.13087v1 (2023), DOI
  [10.48550/arXiv.2306.13087](https://doi.org/10.48550/arXiv.2306.13087)、
  [恒久ページ](https://arxiv.org/abs/2306.13087v1)、
  [v1 PDF](https://arxiv.org/pdf/2306.13087v1)。
- 取得した PDF は 14 pages、12,317,042 bytes、raw bytes の SHA-256 は
  `20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af` とする。
  この値と一致しない PDF から転記してはならない。将来 arXiv に新版が出ても v1 を暗黙に
  置換せず、別の `corpusId` と再レビューを必要とする。

### 2.2 論文が明示する内容

論文本文 pp. 7–8 と Figure 2 caption（p. 10、図は pp. 11–14）は、次を明示する。

- Figure 2 は温度と空気中の遠方水蒸気過飽和度の関数として 206 観測を示す。
- 各正方形 panel は、細い c-axis ice needle の先端で一定条件下に成長した代表例である。
- 各 panel に温度、遠方過飽和度、成長時間、正方形視野の物理寸法が表示される。
- 温度の代表的不確かさは `±0.2 °C`、記載過飽和度の不確かさは
  `[0.8,1.2] × stated value` である。
- 写真は複数の結晶から、良好な対称性と孤立した needle を持つ well-formed crystal を
  主観的に選んだ代表例である。無作為標本ではない。
- 二次元投影から三次元形態を理解するには経験が必要であり、論文は将来の報告で三次元 sketch
  を示す予定としている。Figure 2 自体は機械可読の形態ラベルを与えない。

したがって、温度・過飽和度・時間・視野寸法は**出典転記値**、形態タグと画像由来の無次元量は
**本プロジェクトの注釈**として別 provenance を持たせる。著者が panel ID、結晶の実幅・実厚、
時間・視野寸法の測定不確かさを与えていない場合、それらを著者値として作らない。

JSON の canonical serialization は
[RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html) を使う。
I-JSON、有限 binary64、再帰的 property sort、配列順保持、UTF-8、空白なしを適用する。

## 3. 成果物の固定配置

実装工程では次だけを追加する。

```text
apps/snow-crystal-sim/
  calibration/libbrecht-2023-figure2-v1/
    corpus.json          206点、出典、転記証跡、注釈
    split.json           固定したcondition group単位のtrain/holdout
    protocol.json        loss、seed、checkpoint、候補manifest契約
    SHA256SUMS           上3 JSON の JCS canonical bytes の SHA-256
  calibration/runs/<calibrationId>/       T1-8/T1-10 が作る較正run証跡
    holdout-run.json                      sealed/opening/opened の永続状態
    holdout-open-intent.json              一度だけexclusive-createする永続marker
    holdout-report.json                   opened時だけ存在する結果
  tests/calibration/
    libbrecht-2023-figure2.test.ts
```

論文 PDF、Figure 2 全体、panel crop は著作物なのでコミットしない。`corpus.json` は恒久 URL、
PDF SHA-256、page/panel locator、raw label、照合記録を保持する。原資料照合時だけ同一 hash の PDF
をローカルに置き、通常テストはネットワークへ接続しない。

`SHA256SUMS` は ASCII filename 昇順で、各行を
`<64 lowercase hex><two spaces><filename>\n` とする。自身は hash 対象にしない。

## 4. コーパス公開データ契約

以下は説明用 TypeScript であり、runtime export を追加する指示ではない。JSON では optional
property を使わず、値が得られない箇所は `null` と理由 code を明記する。

```ts
type SourceObservationId = `L23-F2-P${11 | 12 | 13 | 14}-N${string}`;
type AuditStatus = 'agreed' | 'adjudicated';
type Confidence = 'high' | 'medium' | 'low';
type Sha256Hex = string; // exactly 64 lowercase hexadecimal characters

interface MorphologyVoteV1 {
  readonly growthAxis: 'basal-dominant' | 'c-axis-dominant' | 'mixed' | 'indeterminate';
  readonly basalBranchingLevel: 0 | 1 | 2 | 3 | null;
  readonly hollowing: 'present' | 'absent' | 'indeterminate';
  readonly confidence: Confidence;
}

interface CorpusV1 {
  readonly schemaVersion: 'snow-crystal-observation-corpus/1';
  readonly corpusId: 'libbrecht-2023-figure2-arxiv-v1';
  readonly source: {
    readonly arxivId: '2306.13087v1';
    readonly doi: '10.48550/arXiv.2306.13087';
    readonly permanentUrl: 'https://arxiv.org/abs/2306.13087v1';
    readonly pdfUrl: 'https://arxiv.org/pdf/2306.13087v1';
    readonly pdfSha256: '20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af';
    readonly pageCount: 14;
    readonly figureNumber: 2;
    readonly figurePdfPages: readonly [11, 12, 13, 14];
  };
  readonly observations: readonly ObservationV1[];
  readonly annotationApprovals: readonly AnnotationApprovalV1[];
}

interface AnnotationApprovalV1 {
  readonly approvalId: Sha256Hex;
  readonly reviewMode: 'batch-summary' | 'individual-source-pdf';
  readonly targetSourceObservationIds: readonly SourceObservationId[];
  readonly targetIdSetSha256: Sha256Hex;
  readonly draftAnnotationSetSha256: Sha256Hex;
  readonly finalAnnotationSetSha256: Sha256Hex;
  readonly sourcePdfSha256:
    '20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af';
  readonly approverRole: 'human-approver';
  readonly approvedAtUtc: string;
  readonly decision: 'approved';
  readonly note: string | null;
}

interface ObservationV1 {
  readonly sourceObservationId: SourceObservationId;
  readonly sourceIdKind: 'derived-page-panel-id';
  readonly locator: {
    readonly pdfPage: 11 | 12 | 13 | 14;
    readonly pagePanelOrdinal: number;
    readonly panelBoundsPdfPt: readonly [number, number, number, number];
  };
  readonly rawLabels: {
    readonly temperature: string;
    readonly supersaturation: string;
    readonly growthTime: string;
    readonly squareFieldOfView: string;
  };
  readonly temperatureC: number;
  readonly supersaturationPct: number;
  readonly growthTimeSeconds: number;
  readonly squareFieldOfViewUm: number;
  readonly sourceUncertainty: {
    readonly temperaturePlusMinusC: 0.2;
    readonly supersaturationFactorRange: readonly [0.8, 1.2];
    readonly growthTime: 'not-reported';
    readonly squareFieldOfView: 'not-reported';
  };
  readonly inProductDomain: boolean;
  readonly exclusionReason: null | 'outside-product-domain';
  readonly morphology: MorphologyAnnotationV1;
  readonly projectedShape: ProjectedShapeV1;
  readonly transcription: TranscriptionEvidenceV1;
}
```

`sourceObservationId` は著者付与 ID ではない。`Pxx` は PDF page、`Nxxx` はその page の図示順
（上から下、同じ行は左から右、3桁 zero padding）である。ID と locator の対応を固定し、page
間で ordinal を継続しない。`panelBoundsPdfPt=[left,bottom,width,height]` は PDF user space の
point 単位で、4値は有限、正の width/height、page crop box 内でなければならない。

`temperatureC` と `supersaturationPct` は Figure 2 の stated value をそのまま保持し、製品範囲へ
クランプしない。`growthTimeSeconds` は raw label の単位から秒へ、`squareFieldOfViewUm` は µm
へ十進有理数として換算する。両方とも有限かつ正でなければならない。正方形視野寸法を結晶の
実直径や厚みと呼び替えない。

`inProductDomain` は `temperatureC in [-30,0] && supersaturationPct in [0,30]` の完全な派生値。
範囲外点も 206 点に数えて報告するが、loss へは入れない。範囲外観測を端点へクランプして
学習点にすることは禁止する。

## 5. 形態タグと無次元画像特徴

### 5.1 project annotation

```ts
interface MorphologyAnnotationV1 {
  readonly annotatorA: MorphologyVoteV1;
  readonly annotatorB: MorphologyVoteV1;
  readonly draftStatus: 'exact-agreement' | 'different';
  readonly final: MorphologyVoteV1;
  readonly approvalId: Sha256Hex;
  readonly adjudicationNote: string | null;
}
```

`basalBranchingLevel` は image projection 上の観察規約であり、物理定数でも著者分類でもない。

- `0`: 識別可能な primary arm/sector がなく、外形が主に facet で構成される
- `1`: primary arm または sector はあるが、識別可能な sidebranch はない
- `2`: sidebranch が一段以上見える
- `3`: 複数段の sidebranch を持つ dendritic network が見える
- `null`: basal 面が見えない、投影が曖昧、または二者が根拠を持って決着できない

`growthAxis` は像と needle 軸に対する主成長方向、`hollowing` は投影で空洞を識別できるかを
表す。二次元写真からの三次元推定は source value ではない。草案を作る A/B は本アプリ内で動く
エージェントではなく、`docs/agent-architecture-codex.md` に従う**開発支援用エージェントの独立した
新規セッション**である。両者には同じ hash の原 PDF、本節の vocabulary、同じ出力 schema だけを
渡し、相手の出力、比較結果、未記録 reasoning を完成前に見せない。アプリへ AI、prompt、会話履歴、
agent runtime を組み込まず、最終的に収録するのは人間承認済みの静的データだけである。

A/B は全206点をそれぞれ判定する。`draftStatus='exact-agreement'` は confidence を含む4 field が
完全一致するときだけで、それ以外は `different` とする。次の人間確認規則を固定する。

1. A/B の4 field が完全一致し、かつ両方の `confidence='high'` である点だけを
   `batch-summary` 対象にできる。人間は ID、page/panel locator、両 vote、最終案を並べた一覧を
   確認して一括承認する。最終値は一致した vote と同一でなければならない。
2. 不一致、どちらかが `low`、一致していても `medium` を含む点はすべて
   `individual-source-pdf` とし、人間が hash 一致済み原 PDF の該当 panel を個別に照合する。
   人間は A/B のどちらかを選ぶ義務はなく、修正または `indeterminate` / `null` を選べる。
3. 全206 ID は `annotationApprovals` の `targetSourceObservationIds` に重複なくちょうど一度現れ、
   各 observation の `approvalId` はその ID を含む approval を参照する。`approvedAtUtc` は fractional
   second のない UTC RFC 3339 (`YYYY-MM-DDTHH:mm:ssZ`) とする。氏名、メール、account ID、端末名は
   保存せず、承認者は固定 role `human-approver` だけで表す。
4. target ID 配列は ASCII 昇順・重複なしとし、その JCS bytes を `targetIdSetSha256` にする。
   `[sourceObservationId,annotatorA,annotatorB]` の ID 昇順配列を `draftAnnotationSetSha256`、
   `[sourceObservationId,final]` の ID 昇順配列を `finalAnnotationSetSha256` とする。
   `approvalId` は `approvalId` 自身を除く approval object の JCS SHA-256 である。これにより batch
   承認の対象集合と、その時点の草案・最終値を後から一意に照合できる。
5. local draft、未承認 annotation、approval の hash/対象が一致しない annotation を
   `corpus.json` の完成版へ入れず、split 後の loss、candidate 順位、baseline、holdout、T1-8/T1-10
   の較正入力へ渡す API は `RangeError(annotation-approval)` で拒否する。

`adjudicationNote` は batch では `null`、individual では原 PDF 上の判断根拠または
「判断不能」を表す空でない非個人情報文字列とする。不確かな点は `indeterminate` / `null` を許し、
該当 loss component から除外するが、観測点自体を削除しない。この手順は人間承認済み project
annotation を作るものであり、著者付与ラベルへ provenance を変更しない。

### 5.2 dimensionless projected shape

```ts
interface IntervalV1 {
  readonly low: number;
  readonly high: number;
}

type PointPxV1 = readonly [number, number];
type ProjectionReasonV1 =
  | 'orientation'
  | 'occlusion'
  | 'needle-overlap'
  | 'segmentation'
  | 'center-indeterminate'
  | 'endpoint-indeterminate';

interface ProjectionExtractionEvidenceV1 {
  readonly rasterWidthPx: number;
  readonly rasterHeightPx: number;
  readonly maskStatus: 'usable' | 'not-usable';
  readonly maskUsabilityReason: ProjectionReasonV1 | null;
  readonly maskSha256: Sha256Hex | null;
  readonly foregroundPixelCount: number | null;
  readonly fourNeighborPerimeterEdges: number | null;
  readonly foregroundCentroidPx: PointPxV1 | null;
  readonly populationCovariancePx2: {
    readonly xx: number;
    readonly xy: number;
    readonly yy: number;
  } | null;
  readonly eigenvaluesPx2: readonly [number, number] | null; // [lambdaMin, lambdaMax]
  readonly armStatus: 'usable' | 'not-usable';
  readonly armUsabilityReason: ProjectionReasonV1 | null;
  readonly centerPx: PointPxV1 | null;
  readonly armEndpointsClockwisePx: readonly [
    PointPxV1, PointPxV1, PointPxV1, PointPxV1, PointPxV1, PointPxV1,
  ] | null;
  readonly rawInverseCircularity: number | null;
  readonly rawNormalizedArmLengthCv: number | null;
  readonly rawMinorMajorAxisRatio: number | null;
}

interface ProjectedShapeV1 {
  readonly status: 'usable' | 'not-usable';
  readonly inverseCircularity: IntervalV1 | null;
  readonly normalizedArmLengthCv: IntervalV1 | null;
  readonly minorMajorAxisRatio: IntervalV1 | null;
  readonly reason: null | 'no-common-usable-feature';
  readonly extractionA: ProjectionExtractionEvidenceV1;
  readonly extractionB: ProjectionExtractionEvidenceV1;
  readonly auditStatus: AuditStatus;
  readonly adjudicationNote: string | null;
  readonly extractionProtocolId: 'figure2-projection-v1';
}
```

利用できる panel だけ、二つの独立 silhouette から次を計測する。`protocol.json` は PDF page を
600 dpi、sRGB、RGBA8、top-left origin へ rasterize する renderer 名と完全な version を固定する。
extractor A/B は相手の mask と evidence を見ず、panel bounds 内で needle tip から成長した可視 ice を1、背景、
support wire、tip より下の seed needle を0とする binary mask を作る。境界が focus stack、occlusion、
needle overlap により一意でなければ修復せず `not-usable` にする。mask は commit しないが、幅・高さを
unsigned 32-bit little-endian、続けて top-left row-major の1 byte/pixel（0または1）を並べた bytes の
SHA-256 を A/B 別に記録する。raster width/height は両 status で正の uint32 とする。各 extraction の
`maskStatus='usable'` では mask hash、foreground count、4-neighbor perimeter、centroid、covariance、
eigenvalues、inverse circularity、minor/major ratio がすべて必須で、`not-usable` ではそれらをすべて
`null`、reason を非 null とする。mask 自体は収録しないため hash から segmentation を再構成できるとは
主張しないが、収録する中間量から全 raw feature と最終 interval を独立再計算できなければならない。

- `inverseCircularity=P^2/(4*pi*A)`。`A` は foreground pixel 数、`P` は foreground pixel と
  background/page 外の間にある4-neighbor unit edge 数。無次元、`A>0`、`P>0` を要求し、binary64
  では overflow を避けて `((P/A)*P)/(4*pi)` の順に評価する。
- `normalizedArmLengthCv` は annotator が同じ mask 上で指定した中心1点と時計回りの6 arm endpoint
  の Euclidean pixel 距離の母 CV。6腕、中心、順序を識別できる basal view だけで使い、endpoint
  座標も A/B 別 evidence に保存する。座標は top-left origin の pixel-center 座標（各成分は
  `integer+0.5`、raster 内）である。top-left 座標で `atan2(y-centerY,x-centerX)` を `[0,2*pi)` に
  正規化した値の昇順（紙面上の +X から時計回り）とし、同角 endpoint は拒否する。
- `minorMajorAxisRatio=sqrt(lambdaMin/lambdaMax)`。`lambdaMin/max` は foreground pixel center の
  population covariance matrix の固有値。`lambdaMax>0` を要求し、範囲は `[0,1]`。投影の扁平度
  であり、結晶の c/a 比と同一視しない。

pixel center `(x,y)` の population covariance は top-left row-major 順の独立 Neumaier sum と
divisor `A` で計算する。`xx,xy,yy` に対し `trace=xx+yy`,
`delta=Math.hypot(xx-yy,2*xy)`, `lambdaMin=(trace-delta)/2`,
`lambdaMax=(trace+delta)/2` の評価順で `eigenvaluesPx2` を保存する。6 arm の距離は endpoint index
`0..5` 順、平均と二乗偏差和は別々の Neumaier sum、divisor 6 の母 CV とする。`A` と perimeter は
正の safe integer、共分散、固有値、raw feature は有限・非負、`lambdaMin<=lambdaMax` とする。
`armStatus='usable'` なら center、6 endpoints、raw arm CV が必須で reason は `null`、それ以外は
3項目を `null` とし reason を必須にする。mask が not-usable なら arm も not-usable である。

feature ごとに二つの独立 raw 値がともに非 null の場合だけ、その min/max を interval にし、同じ値
なら zero-width interval を許す。一方だけが null なら最終 feature は null で、片方の値を正解として
採用しない。少なくとも一 feature interval があれば top-level `usable`/reason `null`、全て null なら
`not-usable`/`no-common-usable-feature` とする。A/B の status/reason が異なる場合は
`auditStatus='adjudicated'` と空でない note、完全一致なら `agreed` と note `null` を要求する。
adjudication は raw 値を書き換えない。

独立再計算は保存済み `A,P` から `P^2/(4*pi*A)`、center/endpoints から6距離と母 CV、covariance から
固有値と `sqrt(lambdaMin/lambdaMax)` を求め、raw 値と
`64*Number.EPSILON*max(1,abs(expected))` 以内で一致させる。これは binary64 の再計算許容差であり、
写真の物理的不確かさではない。interval 端点は再計算済み A/B raw 値の厳密な `min/max` とする。
raw pixel 数、物理時間、視野 µm、結晶の実寸は loss に使わない。
T1-3 の `compactness` と `armLengthCv` は定義が対応する場合だけ比較し、観測画像の投影・pixel
離散化と CA 六角セル離散化が同じ測定であるとは主張しない。

## 6. 転記、二重照合、原資料監査

```ts
interface FieldVoteV1 {
  readonly raw: string;
  readonly normalized: number;
}

interface TranscriptionEvidenceV1 {
  readonly transcriberA: {
    readonly temperature: FieldVoteV1;
    readonly supersaturation: FieldVoteV1;
    readonly growthTime: FieldVoteV1;
    readonly squareFieldOfView: FieldVoteV1;
  };
  readonly transcriberB: {
    readonly temperature: FieldVoteV1;
    readonly supersaturation: FieldVoteV1;
    readonly growthTime: FieldVoteV1;
    readonly squareFieldOfView: FieldVoteV1;
  };
  readonly auditStatus: AuditStatus;
  readonly adjudicationNote: string | null;
  readonly sourceCheckedAgainstPdfSha256: string;
}
```

作業順は固定する。

1. PDF hash と page count を先に検証し、Figure 2 の全 panel locator を列挙する。
2. Transcriber A と B は互いの draft を見ず、4 raw labels と正規化値を独立転記する。
3. 機械比較は raw label と正規化値の両方を比較する。全一致を `agreed` とする。
4. 不一致は第三者が同一 hash の PDF panel を見て解決し、どちらを採用したかではなく、差異と
   原資料上の根拠を `adjudicationNote` に残す。
5. 別工程で page ごとの panel count、全206点、ID、locator、最終値を原 PDF と全件照合する。
6. 形態注釈と silhouette 抽出は数値転記の完了後に行い、source labels を変更しない。

全 observation は `auditStatus` が `agreed` または `adjudicated` でなければならない。
`pending` を最終データへ入れない。役割名は固定文字列 A/B/adjudicator とし、個人情報は持たない。

## 7. 206点の完全性、一意性、validation、error

検証順は次で固定し、最初の失敗で停止する。error message は少なくとも
`file`, `sourceObservationId`（判明時）、`field`, `reason` を含む。

1. UTF-8 JSON parse、duplicate key 拒否、schema/corpus/source 定数
2. `observations.length===206`
3. ID pattern、一意性、page/ordinal/bounds の一意性、page ごとの ordinal が `1..count` で連続
4. raw label が空でないこと、正規化値が有限で raw label の単位変換と一致すること
5. 温度・過飽和度・時間・視野・不確かさ、product-domain 派生値
6. 二重転記、原 PDF hash、全件 audit status と adjudication note の整合
7. morphology vocabulary、独立 A/B vote、draft status、human final の整合
8. annotation approval の JCS hash、review mode 適格性、対象集合の重複なし全206点被覆、参照整合
9. A/B projected-shape evidence の status/null/reason、中間量・raw feature の再計算、audit 整合
10. projected-shape interval の有限性、`low<=high`、A/B raw 値との min/max 整合
11. observation と approval を ID/approval ID 昇順にした canonical order
12. split/protocol との参照完全性と hash

`NaN`、±`Infinity`、`-0`、safe integer 外の ordinal、unknown property、unknown enum、暗黙の
unit、空文字を拒否する。JSON parser が duplicate key を上書きしてから検証する実装は禁止し、
raw token 段階または duplicate-aware parser で拒否する。parse/duplicate key は `SyntaxError`、
型・unknown property/enum は `TypeError`、値域・件数・相互整合・hash 不一致は `RangeError` とする。
I/O error は元の error を cause に保持する。失敗時に値を clamp、drop、補完しない。

## 8. Canonical serialization と hash

各 JSON は parse と schema validation 後に RFC 8785 JCS で canonicalize し、UTF-8 bytes の
SHA-256 を `SHA256SUMS` と照合する。pretty-print、CRLF/LF、property の記載順は hash に影響
しないが、array order、文字列 code point、数値は影響する。hash は raw file bytes ではなく
canonical bytes に対する値であると明記する。

テストは本実装用 canonicalizer と経路を共有しない最小の独立 canonicalizer を持ち、RFC 8785
Appendix B の代表 number と property order fixture、1 byte 改変で hash が変わる fixture を通す。
T1-8 以降の `calibrationId` は少なくとも corpus、split、protocol の3 hash を含む。いずれかが
変われば以前の較正結果、review、holdout 結果を stale とする。

## 9. 固定 train / holdout 分割

同じ `(temperatureC,supersaturationPct)` の観測を `conditionGroup` とし、同じ group を train と
holdout に分けない。時刻違い、写真違い、重複 panel でも同じ group へ入れる。product domain 外
は `report-only` で、どちらにも入れない。

split は形態タグと画像特徴を見る前に、条件だけで作る。stratum `h` は
`h=(temperatureBin,supersaturationBin)` の2次元直積であり、次の9要素に固定する。

```text
temperature: [-30,-10), [-10,-3), [-3,0]
supersaturationPct: [0,10), [10,20), [20,30]
```

temperature bin を上記の順に `T0,T1,T2`、supersaturation bin を上記の順に
`S0,S1,S2` と呼ぶ。stratum の canonical nested 走査順は temperature bin を外側の
昇順、supersaturation bin を内側の昇順とする。すなわち

```text
(T0,S0), (T0,S1), (T0,S2),
(T1,S0), (T1,S1), (T1,S2),
(T2,S0), (T2,S1), (T2,S2)
```

である。以下の split、tag rank、categorical tag、shape、baseline、acceptance の全評価と
Neumaier 集計はこの同じ9要素順を使い、temperature-only または supersaturation-only
stratum へ投影しない。

各 group key を JCS array `[temperatureC,supersaturationPct]` とし、
`SHA-256("snow-crystal-sim/T1-7/split-v1\0" + canonicalGroupKey)` の unsigned byte
lexicographic 順で stratum 内を並べる。group 数 `n>=2` なら先頭
`min(n-1,max(1,floor(n/5)))` を holdout、`n=1` は train とする。境界値は右側区間、30 は
最後の区間へ含める。`split.json` の stratum record も§9の9要素順で保存する。
明示的な全 ID list と group hash を `split.json` に保存し、テストで再計算
する。source label の二重転記・監査が完了した直後、annotation を始める前に split と hash を
固定する。annotation の分布を見て split を入れ替えてはならない。

## 10. loss 契約

loss は physical time、視野 µm、実寸、CA step 数を一切読まない。二つの成分を別に報告し、
恣意的な重み付き一 scalar へ畳み込まない。全 loss API は §5.1 の人間承認被覆を最初に検証し、
未承認 tag を一件でも含む corpus を prediction の有無にかかわらず拒否する。

### 10.1 tag loss

形態 class threshold が未確定の T1-8/T1-4 では、次の3 rank component 以外を作らない。

| component ID | 承認済み観測 field と順序 `r(o)` | prediction `m(g,s,k)` | 方向 | 使用段階 |
|---|---|---|---|---|
| `branching-compactness-v1` | `basalBranchingLevel`: `0<1<2<3` | `compactness` | 大きいほど高 rank | T1-8 以降 |
| `branching-tip-density-v1` | `basalBranchingLevel`: `0<1<2<3` | `tipDensity` | 大きいほど高 rank | T1-8 以降 |
| `axis-aspect-ratio-v1` | `growthAxis`: `basal-dominant<mixed<c-axis-dominant` | `aspectRatio` | 大きいほど高 rank | T1-4/T1-10 のみ |

`indeterminate` と `null` は欠測である。`hollowing` は対応する承認済み simulation metric がないため
rank loss へ入れない。T1-8 の candidate 選択に使う component set は最初の2個だけの
`basal-rank-v1`、厚み統合後の報告は3個を含む `integrated-rank-v1` とし、score 前に
`protocol.json` へ固定する。結果を見た後で component を追加・削除しない。

checkpoint `k`、seed `s`、2次元 stratum
`h=(temperatureBin,supersaturationBin)`、component `c` ごとに次を行う。

1. `h` 内にある異なる condition group の unordered pair `{g_i,g_j}` を、canonical group key の
   ASCII 昇順で `g_i<g_j` として列挙する。同一 group 内の observation 同士は比較しない。
2. 各 group pair について、`g_i` と `g_j` の承認済み observation の直積を ID 昇順に列挙し、
   `r(o)` が両方非欠測の pair だけを使う。この集合が空なら group pair を除外する。
3. 観測符号 `a=sign(r(o_j)-r(o_i))`、予測符号
   `b=sign(m(g_j,s,k)-m(g_i,s,k))` とする。binary64 の bit pattern が異なっても数値 `===` なら
   tie (`sign=0`) とする。penalty `p` は `a===b` なら0（両 tie を含む）、片方だけ tie なら `1/2`、
   `a=-b` かつ非0なら1である。
4. group pair の loss は `N/(2M)` とする。`M` は eligible observation pair 数、`N=sum(2p)` は
   非負整数である。各段の算術平均は約分した任意精度整数 fraction で保持し、最終 report に
   numerator/denominator と binary64 値の両方を保存する。

集計階層は、group pair の observation-pair 平均 → component ごとの group-pair macro-average →
2次元 stratum 内 component macro-average（表の順）→ 非空 stratum macro-average
（§9 の temperature-major / supersaturation-minor の9要素順）→ seed
macro-average（index `0..7`）→ checkpoint macro-average（`10,20,40`）で固定する。実行・証跡配列は
checkpoint を外側、seed を内側にして `(10,0)..(10,7),(20,0)..,(40,7)` の順で保存する。
分母0の group pair/component/stratum はその階層から除くが、全階層が空なら
`tagRankLoss=null` とする。eligible pair があるのに candidate の必要 metric が null、非有限、
未到達なら観測欠測として除かず candidate failure とする。

T1-10 で別途承認された class threshold が得られた後だけ `categoricalTagLoss` を評価できる。
field 順は `growthAxis`, `basalBranchingLevel`, `hollowing`。categorical は一致0/不一致1、branching は
`abs(predicted-observed)/3`、indeterminate/null は欠測とする。利用可能 field の observation 平均 →
observation の group 平均 → group の2次元 stratum 平均 → §9 の9要素順の
stratum 平均 → seed → checkpoint の同じ macro-average とし、rank loss と混ぜない。

### 10.2 dimensionless shape loss

scored feature 順は `inverseCircularity`, `normalizedArmLengthCv` とする。feature `f` ごとに、人間
承認済み train partition で最終 interval が非 null の各 observation から midpoint
`x=low/2+high/2` を1個取り、重複を保つ有限 multiset `X_f` を作る。中間値が非有限なら corpus error。
`n=|X_f|>0` に対し、全ての実数 `z` で empirical mid-CDF を

```text
F_f(z) = ( count{x in X_f | x < z} + 0.5 * count{x in X_f | x === z} ) / n
```

と定義する。補間はしない。したがって `z<min(X_f)` は0、`z>max(X_f)` は1、sample 間は
`count(x<z)/n`、同値 sample は multiplicity を含む mid-rank である。`-0`、NaN、Infinity は入力へ
入らない。holdout でも train の `X_f` と `F_f` をそのまま再利用し、holdout 自身から scale、rank、
median、欠測補完を計算しない。

観測 interval `[low,high]` は閉区間 `[F_f(low),F_f(high)]` へ写す。checkpoint/seed の有限予測値
`v` に対し `u=F_f(v)` とし、primitive loss は

```text
d_f = 0                                  if F_f(low) <= u <= F_f(high)
      F_f(low) - u                       if u < F_f(low)
      u - F_f(high)                      if u > F_f(high)
```

で `[0,1]`。interval 端が sample と同値なら上式の mid-rank を使う。`inverseCircularity` の prediction
は T1-3 `compactness`、`normalizedArmLengthCv` は `armLengthCv` である。観測 interval が null なら
その feature は欠測として除く。観測 interval が非 null なのに予測が null/非有限/未到達なら
candidate failure とし、0点や欠測に変換しない。`X_f` 自体が空ならその feature は全 partition で
score せず report を null とする。

集計階層は feature primitive → observation 内 feature macro-average（上記順）→ observation の
condition-group macro-average（ID昇順）→ group の2次元 stratum macro-average
（group key昇順）→ 非空 stratum macro-average（§9 の temperature-major /
supersaturation-minor の9要素順）→ seed macro-average (`0..7`) → checkpoint macro-average
(`[10,20,40]`) で固定し、各 binary64 平均は階層ごとに初期化した独立 Neumaier sum を
その順で使う。

`inverseCircularity` と `normalizedArmLengthCv` は定義が対応するシミュレーションだけを比較する。
`minorMajorAxisRatio` は投影特徴なので、T1-4/T1-10 が投影規約を承認するまで報告のみとする。
使えない feature は 0 点扱いせず分母から除く。全 shape feature が欠測なら `shapeLoss=null`。

全 report は primitive count、各階層の非空分母、rank fraction、checkpoint×seed 別値も保存する。
binary64 の最終結果は IEEE 754 shortest round-trip decimal で記録する。

## 11. 探索候補、実行順、seed、checkpoint

本タスクは較正値を選ばない。T1-8 は観測 loss を実行する前に、次の schema の有限
`candidate-manifest.json` を設計レビューし、その JCS hash を protocol 実行記録へ固定する。

- family は `condition-blind-baseline`、`nearest-train-condition-baseline`（独立 oracle）、
  production 候補の `piecewise-bilinear-map-v1` の三種だけ
- production 候補は温度・過飽和度 knot、`beta`、`gamma`、`noiseAmplitude`、c/a 候補、
  補間規則、0 % の `beta=gamma=0` を全て literal で持つ
- 数値は T1-0 の範囲内の有限 binary64。候補を loss 結果から追加・削除しない
- candidate ID は candidate object の JCS SHA-256。重複 hash を拒否する

実行順は `familyRank`（baseline 2種、production）、knot 数の昇順、candidate ID の ASCII 昇順。
production 同士の選択は train の `(tagRankLoss,shapeLoss,knotCount,candidateId)` をこの順で
lexicographic 最小とする。観測側に eligible rank pair が一つもなく全 candidate 共通で
`tagRankLoss=null` の場合はその項を、usable shape が一つもなく全 candidate 共通で
`shapeLoss=null` の場合はその項を比較から除く。両方が null なら較正候補を選択せず
`RangeError(no-calibration-evidence)` とする。usable shape または eligible tag pair があるのに予測不能な candidate は
`status='failed'` と failure code を記録し、有限 loss の全 candidate より後に並べる。I-JSON に
`Infinity` は保存せず、`null` で有利にしない。loss が bit-for-bit 同じなら少ない knot、最後に ID を使う。
ランダム探索、wall-clock 順、object insertion order は使わない。具体的な候補数値は T1-8 の
設計責務であり、T1-7 で観測結果を装って置かない。

シミュレーション比較条件は次で固定する。

- lattice radius `115`
- morphology checkpoint の半径は `[10,20,40]` cells。10 は T1-0 の指標適用下限、以後2倍で、
  T1-0 の `h=max(|q|,|r|,|q+r|)`、`rho(q,r)=sqrt(q^2+qr+r^2)` に従うと、
  `h=115` の reservoir ring の最小 Euclidean 中心距離は `sqrt(9919)`
  `=99.5941765365827...` cells である。例えば edge `q=115`では
  `q^2+qr+r^2=(r+57.5)^2+9918.75` で、整数 `r=-57,-58` のとき最小値
  `9919`（他の5 edge も60°対称）となる。よって T1-0 の boundary 感度適用上限は
  `sqrt(9919)/2=49.79708826829135...` cells であり、checkpoint `40` はこの真の上限内にある
- 各 checkpoint は `basalRadiusCells` が初めて値以上になった state。物理時間・実寸へ換算しない
- 最大 step は `latticeCellCount(115)=40,021`。checkpoint 未到達、外縁停止、非有限値は candidate
  failure とし、観測時間に合わせて step 上限を変えない
- seed は `SHA-256("snow-crystal-sim/T1-7/seed-v1/" + decimalIndex)` の先頭16 bytes を
  little-endian uint32 4個へ変換した index `0..7` の8本。all-zero の場合は末尾へ `"/retry"`
  を追加して再hashする。`protocol.json` に literal seed と生成 hash を保存し、再計算テストする
- 同じ condition、candidate、seed、checkpoint は bit-for-bit 同一の metrics を返す

各 candidate は、partition 内の各 condition group について24通りの `(checkpoint,seed)` をすべて
実行する。§10 の primitive score は observation ごとに24通りを別々に作り、checkpoint を選択したり、
観測ごとに最も近い段階を採用したり、3段階を先に平均した morphology から score を作ったりしない。
§10 のとおり seed を等重み、続いて checkpoint を等重みで macro-average する。候補の一部
observation、seed、checkpoint だけを都合よく除外しない。一つでも checkpoint 未到達、外縁停止、
非有限 metric、最大 step 超過になればその candidate 全体を failure とする。

これは Figure 2 の各写真に写る未知の成長段階を、半径10/20/40 cellsという3つの無次元形態 scale
へ等しく周辺化する **scale-marginalized comparison** である。物理時刻との対応を推定する方法では
なく、`growthTimeSeconds`、`squareFieldOfViewUm`、panel pixel 寸法、結晶実寸を checkpoint の選択・
重み・停止条件へ一切読ませない。従って同じ tag/shape interval のまま time/FOV/実寸だけを変更しても
primitive と全集計 loss は bit-for-bit 不変でなければならない。この近似は、画像ごとの真の成長段階を
識別できず、scale による形態変化を平均化する限界を持つ。そのため loss を物理成長速度の検証や、
写真と特定 CA step の一致の証拠として使わない。

## 12. leakage 防止と holdout 開封

- split を source labels のみで先に固定し、その hash を annotation 開始前に記録する。
- candidate 作成・train CDF・threshold 候補・knot 選択・tie-break は train だけを読む API にする。
- `scoreTraining` と `scoreHoldoutOnce` を分離し、前者へ holdout annotation object を渡すと
  `RangeError` にする。
- holdout は production candidate を一つ選択し candidate manifest と train report を hash 固定
  し、人間が開封 gate を承認した後にだけ一度評価する。
- source transcription の誤り訂正は許すが、corpus/split/protocol hash を更新し全 downstream
  review を stale にする。holdout 成績を改善するための annotation 変更は禁止する。

T1-8/T1-10 の各較正 run は上記 `calibration/runs/<calibrationId>/` に、次の永続 record と marker を持つ。
hash はすべて JCS canonical bytes の lowercase SHA-256 である。

```ts
interface HoldoutInputHashesV1 {
  readonly corpusSha256: Sha256Hex;
  readonly splitSha256: Sha256Hex;
  readonly protocolSha256: Sha256Hex;
  readonly candidateManifestSha256: Sha256Hex;
  readonly selectedCandidateId: Sha256Hex;
  readonly selectedCandidateSha256: Sha256Hex;
  readonly trainReportSha256: Sha256Hex;
}

interface HumanHoldoutGateV1 {
  readonly decision: 'approved-for-one-time-open';
  readonly inputBundleSha256: Sha256Hex;
  readonly evidenceSha256: Sha256Hex;
  readonly approverRole: 'human-approver';
  readonly approvedAtUtc: string; // YYYY-MM-DDTHH:mm:ssZ
  readonly note: string | null;
}

type HoldoutRunRecordV1 =
  | {
      readonly schemaVersion: 'snow-crystal-holdout-run/1';
      readonly calibrationId: string;
      readonly state: 'sealed';
      readonly inputs: HoldoutInputHashesV1;
      readonly selectedComparatorId: Sha256Hex;
      readonly humanGate: HumanHoldoutGateV1;
      readonly sealedRecordSha256: Sha256Hex;
      readonly holdoutReportSha256: null;
    }
  | {
      readonly schemaVersion: 'snow-crystal-holdout-run/1';
      readonly calibrationId: string;
      readonly state: 'opening';
      readonly inputs: HoldoutInputHashesV1;
      readonly selectedComparatorId: Sha256Hex;
      readonly humanGate: HumanHoldoutGateV1;
      readonly sealedRecordSha256: Sha256Hex;
      readonly openIntentSha256: Sha256Hex;
      readonly openedAtUtc: string;
      readonly holdoutReportSha256: null;
    }
  | {
      readonly schemaVersion: 'snow-crystal-holdout-run/1';
      readonly calibrationId: string;
      readonly state: 'opened';
      readonly inputs: HoldoutInputHashesV1;
      readonly selectedComparatorId: Sha256Hex;
      readonly humanGate: HumanHoldoutGateV1;
      readonly sealedRecordSha256: Sha256Hex;
      readonly openIntentSha256: Sha256Hex;
      readonly openedAtUtc: string;
      readonly holdoutReportSha256: Sha256Hex;
      readonly acceptance: 'accepted' | 'rejected';
    };
```

`inputBundleSha256` は上記 `inputs` と `selectedComparatorId` の JCS hash、`sealedRecordSha256` は同 field
を持つ sealed record から自身の property を除いた JCS hash とする。human gate はこの bundle と
holdout をまだ読んでいない train report の review evidence を承認する。氏名、account、端末名は
保存しない。holdout report は candidate/comparator の checkpoint×seed 明細、loss、Pareto 判定、
全 input hash を含み、その JCS hash が opened record と一致しなければならない。

`scoreHoldoutOnce(runDirectory, ...)` は holdout annotation や simulation を読む**前**に次を行う。

1. `holdout-run.json` が `sealed`、全 input hash、candidate、comparator、human gate が一致することを
   検証する。不一致または gate 未承認は拒否する。
2. `holdout-open-intent.json` を exclusive-create (`wx`) し、sealed record hash、input bundle hash、
   `openedAtUtc` を書いて flush する。既存 marker があれば、同一 process の二回目でも再起動・別
   process でも `RangeError(holdout-already-opened-or-in-progress)` とし、holdout を読まない。
3. record を `opening` として temp file へ書き、flush 後に同 directory 内で atomic rename する。
   その後だけ holdout を評価する。
4. report を temp+flush+atomic rename で保存し、その hash を持つ `opened` record へ同様に遷移する。
   intent marker は成功後も削除しない。

許される状態遷移は `sealed -> opening -> opened` だけである。`opening` 中の crash は自動 retry せず、
marker を残したまま当該 run を失敗として封印する。結果を見た後の候補・注釈・split・loss 変更、
opened/opening record の再評価、marker の削除・巻戻しを同じ run で許さない。変更または crash 復旧には
protocol version と calibration ID を更新し、未使用の confirmatory split と新しい human gate を要する。

機械的に保証できるのは、同じ管理 directory と永続 marker を尊重する process による二回目・競合
process の拒否、hash 不一致の拒否までである。権限を持つ人が directory を複製・削除・過去 revision へ
巻き戻す行為までは防げない。Coordinator と `human-approver` は version-control history、review
evidence、marker を保持し、別 directory からの再開を承認しない手続き上の責任を持つ。この境界を
「暗号学的に一度しか読めない」とは主張しない。

## 13. acceptance threshold の由来

絶対的な正解率を観測論文は与えていないため、根拠のない百分率を作らない。condition-blind
baseline は train の modal tag（tie は enum 順）を表の数値 rank へ写した値と、feature midpoint の
median とする。rank component の prediction には CA metric の代わりにこの数値 rank を直接使う。
nearest-condition baseline は T1-0 の `x=(T+30)/30`, `y=supersaturationPct/30` における squared
Euclidean distance が最小の train condition group を使い、tie は group hash で決める。group 内の
tag は modal の数値 rank、feature は midpoint の median とする。偶数個の median は中央2値を
`a/2+b/2` で平均する。両 baseline の prediction は全 checkpoint/seed へ同じ値を複製し、どちらも
holdout labels を参照しない独立 empirical oracle である。

二 baseline のどちらを comparator とするかは train の
`(tagRankLoss,shapeLoss,familyRank)` lexicographic 最小で holdout 開封前に一つへ固定する。
両 baseline と production candidate の loss は別経路で再集計せず、§10.1・§10.2 の同じ
2次元 stratum と§9の9要素走査順で求める。comparator 選択と下記 Pareto acceptance は
その順で得た loss だけを比較し、別の temperature-only 集計や並べ替えを行わない。
統合候補の holdout 受入は、その固定 comparator に対し、利用可能な各 loss component が
`candidate<=comparator` で、少なくとも一つが厳密に小さい Pareto improvement のときだけ通す。
`shapeLoss=null` なら tag component の厳密改善を要求する。これは「条件を使わない／最寄り観測
を返すだけの予測より悪い較正を採用しない」という由来を持つ閾値であり、観測不確かさや
binary64 tolerance ではない。AC-03、AC-04、T1-0 の CV、T1-9 の境界感度は別ゲートであり、
この相対基準で置換しない。

## 14. 独立 oracle とテスト工程への handoff

`TESTCASES.md` は少なくとも次を literal fixture として具体化する。

1. source metadata、PDF hash、206 count、page count、ID/locator 連続性
2. 1 panel の raw unit 変換を production parser と別の手計算で確認
3. temperature `±0.2`、supersaturation factor `[0.8,1.2]`、time/FOV `not-reported`
4. duplicate ID、duplicate locator、missing panel、207件、NaN/Infinity/-0、unknown enum/error path
5. 独立agent A/B の exact-high batch 適格性、不一致/low/medium の individual 強制、未承認拒否
6. approval target ID/hash/final hash、206点の重複なし全被覆、PII property の拒否
7. A/B extraction evidence の usable/null/reason、中間量から3 raw featureを独立再計算する literal 値
8. feature ごとの片側 unusable、interval min/max、status/audit/adjudication 境界
9. RFC 8785 canonical vectors、hash 固定、1 byte 相当の論理変更による hash 変更
10. condition group が partition を跨がず、annotation を変えても split が変わらないこと。
    少なくとも `(T0,S0),(T0,S1),(T1,S0),(T1,S1)` のように両軸 bin が異なる4つの
    stratum と異なる literal contribution を含め、temperature-major /
    supersaturation-minor の split・tag rank・shape・baseline・acceptance 証跡順、および
    階層ごとの Neumaier 再初期化を production scorer 非依存の手計算で確認する
11. physical time/FOV/実寸だけを変更しても全checkpoint lossが bit-for-bit 不変であること
12. rank component 3種について、観測/prediction tie、反転、欠測、cross-group pair、整数
    numerator/denominator と全macro-average を production scorer 非依存の小さい literal 表で手計算
13. empirical mid-CDF の min未満、min同値、重複同値、sample間、max同値、max超過、zero-width/
    nonzero interval、null、集計を production CDF/scorer 非依存の literal 表で手計算
14. 各 observation を24通り別採点すること、checkpoint/seed等重み、checkpoint/seed一件 failure で
    candidate全体が失敗し、best checkpoint や一部 seed 除外をしないこと
15. baseline、候補順、failure の後置、同点 tie-break、Pareto acceptance
16. 8 literal seed の再生成、checkpoint、max-step、同一入力の bit-for-bit 再現。
    T1-0 の定義から production コード非依存に `h=115` ring の全座標を列挙し、
    `min(q^2+qr+r^2)=9919`、上限 `sqrt(9919)/2=49.79708826829135...`、
    `40<sqrt(9919)/2` を確認する
17. train API が holdout annotation を受け取らないこと。sealed→opening→opened、marker の
    exclusive-create、同一/別process二回目、hash違い、opening crash を holdout read 前に拒否すること

独立原資料 oracle は二重転記と第三者全件監査であり、実装 validator が自分で生成した値を
期待値に使わない。loss の期待値は production `score` を import せず、少数 fixture の整数分数・
手計算 CDF から導く。

## 15. 制約、停止条件、未解決判断

- Figure 2 は representative selection であり、頻度分布や自然界の事前確率を推定しない。
- stated uncertainty は temperature と supersaturation だけ。time/FOV、shape、tag に同じ誤差を
  流用しない。
- 2D projection から c/a、空洞、奥行きを一意に復元しない。曖昧なら欠測にする。
- PDF と panel image をコミットせず、著作物の再配布を本タスクに含めない。
- 206点の実データ、候補数値、採用較正値は本設計書に捏造しない。
- morphology annotation は論文著者のラベルではなく、論文自身が熟練を要すると述べる人間判断
  である。§5.1 の独立2-agent草案と人間承認手順は `DECISIONS.md` D-03 で解決済みであり、未承認
  draft を較正の正解として使わない。
- checkpoint平均は未知の画像scaleを周辺化する製品上の近似であり、物理時刻・実寸の復元でも
  Figure 2の成長段階モデルでもない。

T1-7 の完了には、(a) 出典転記と全件監査、(b) annotation開始前に固定したsplit/hash、(c) 独立
A/B草案、(d) batch適格集合と個別確認集合を合わせた全206点の人間承認、(e) A/B別 extraction
evidence と再計算可能な interval、(f) corpus/split/protocol の JCS hash、(g) 本書の loss・探索・
holdout state machine の検証テストがすべて必要である。一つでも未承認 annotation、approval hash
不一致、未解決抽出差異があれば corpus は incomplete であり、T1-8 の loss 入力へ進めない。
