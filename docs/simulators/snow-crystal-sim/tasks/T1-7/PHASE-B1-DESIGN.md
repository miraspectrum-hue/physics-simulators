# T1-7 Phase B1 設計: ローカル画像準備と匿名化の凍結

## 1. 位置づけ

本書は、承認済み `DESIGN.md` §5.1A.2・§9.2・§15、
`MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md`、`TESTCASES.md` の
`TC-PILOT-SELECTION-002`、`TC-PILOT-DERIVATIVE-001..002` を変更せず、
Phase A で凍結した選定計画を画像入力へ変換する実行順と失敗境界を具体化する。
上位文書と競合する場合は上位文書を正とし、本書だけを変更して要件を読み替えない。

- 実行プロファイル: `full`
- product UI 影響: なし
- 対象: repository 外での source raster/crop、mask 人間確認、匿名画像と対応 artifact の凍結
- 対象外: 外部 AI への upload、model 実行、annotation、consensus、adjudication、human final
- 物理的 ground truth: 生成しない。画像変換は既存 pixel の決定的な切出しと指定 rectangle の置換だけである。

Phase B1 は次の二段階とする。

1. **B1a prepare-source**: exact toolchain で page raster と選定24件の source crop を生成し、
   人間が mask rectangle を作成・確認するための restricted review material を準備する。
2. **B1b finalize-blinding**: 24件すべての人間確認済み mask plan だけを入力に、canonical blinded PNG、
   blinded manifest、restricted map、2つの batch input table を immutable に凍結する。

この前提として、画像を読まない独立 Stage **B0 bootstrap-toolchain** でexact toolchainを外部rootへ準備する。
B0は画像準備ではなく環境provisioningであり、外部AI通信ではない。

## 2. 信頼境界と保存先

唯一の作業 root を repository 外の絶対 path `PILOT_WORK_ROOT` とする。
repository root、workspace root、その祖先・子孫、symlink、junction、reparse point を root または
owned path に使わない。実装は既存 ancestor から各 path component を `lstat` / canonical path /
file identity で検査し、検査後の差替えを fail closed にする。

許可する書込み先は次だけである。

```text
PILOT_WORK_ROOT/
  tooling/phase-b1/                         # exact-version一時実行環境。artifact参照は禁止
  restricted/page-rasters/
  restricted/mask-review/
    inbox/
    revisions/
    heads/
    previews/
  restricted/preparation/
  restricted/phase-b1-generations/
  restricted/phase-b1-final-heads/
  restricted/phase-b1-final-closures/
  images/source-crops/
  frozen/phase-b1-generations/
```

既存の Phase A final、`restricted/source/`、`restricted/selection/`、その他の無関係な外部 file/directory は
read-only とし、削除・rename・上書き・一括 cleanup しない。repository、LocalStorage、source-audit UI、
production corpusへのwriteを禁止する。repositoryは全pathについてwrite、temp、cache、lock、log、生成物作成を禁止し、
§2.1のallowlist以外のreadもfail closedとする。LocalStorage、source-audit UIはread/writeとも禁止する。

`tooling/phase-b1/` は data-preparation 専用で、manifest、restricted map、hash preimage、actor input、
evidenceへ絶対 path、drive letter、username、package cache pathを入れない。package download はB0だけに
分離し、B1a/B1b の実行中はoffline強制かつnetwork callを0件にする。

### 2.1 repository read allowlist

実行時にrepositoryから読めるregular fileは次だけである。pathとfile SHA-256は後続の承認済みTESTCASES/test codeが
literal `RepositoryReadAllowlistV1`として固定し、未確定hash、hash不一致、追加import、directory走査、package resolution、
symlink/reparse、allowlist外readを`phase-b1-repository-read-forbidden`で入力読取前に拒否する。

| logical role | repository-relative path |
|---|---|
| B0 reviewed launcher | `apps/snow-crystal-sim/tests/calibration/bootstrap-morphology-pilot-toolchain.ps1` |
| B1 reviewed launcher/implementation | `apps/snow-crystal-sim/tests/calibration/prepare-morphology-pilot-images.mjs` |
| B0 exact dependency source | `apps/snow-crystal-sim/tests/calibration/phase-b1-toolchain-lock.json` |

launcherが分割moduleを必要とする場合は、その各regular fileもTESTCASESでpath/hashを個別列挙するまで実行しない。
Phase A contract、schema、protocol、selection final、PDFはrepository fixtureから読まず、`PILOT_WORK_ROOT/frozen/`、
`PILOT_WORK_ROOT/restricted/`のhash-bound finalだけを読む。locator inventoryはrepository外のread-only regular fileで、
raw file SHA-256 `0d3bcacabfe8625e3c76f7d48bba3fb99280d48cac15c40cff5551f66d5e2c1e`だけを許す。
OS runtime libraryはB0が外部rootへ凍結したpayloadだけを使い、repositoryからの暗黙importを禁止する。

## 3. exact toolchain と再現性

実行前に次を完全一致で検査する。major/minor一致、semver range、caret、互換versionで代用しない。

| component | exact value |
|---|---|
| Node | `24.14.1` |
| `pdfjs-dist` | `6.3.289` |
| `@napi-rs/canvas` | `1.0.6` |
| DPI / scale | `600` / binary64 `600/72` (`25/3`) |
| page box / rotation / intent | crop box / PDF page rotation尊重 / display |
| annotation / worker / system fonts / eval | disabled / disabled / false / false |
| background / color / pixel layout | `[255,255,255,255]` / sRGB / RGBA8 straight alpha |
| origin / row order | top-left / top-to-bottom |

`process.version`、各 package の installed `package.json` version、PDF.js 公開 version、backend 公開 version の
どれかが異なれば、入力を読む前かつ output 0 byte で
`RangeError('phase-b1-environment-invalid <field>')` とする。現在の通常 workspace runtimeが別versionでも
緩和せず、`PILOT_WORK_ROOT/tooling/phase-b1/` に exact-version の一時環境を構築して実行する。

### 3.1 Stage B0 bootstrap-toolchain

B0だけがpackage/runtime取得のためnetworkを使える。repositoryのscriptをhost PowerShellから次の契約で起動する。

```text
powershell -NoProfile -File <REPOSITORY_ROOT>/apps/snow-crystal-sim/tests/calibration/bootstrap-morphology-pilot-toolchain.ps1 \
  -WorkRoot <absolute PILOT_WORK_ROOT> \
  -Command bootstrap-toolchain
```

B0はNode `24.14.1` runtime、exact dependency lock、`pdfjs-dist@6.3.289`、
`@napi-rs/canvas@1.0.6`だけを`tooling/phase-b1/staging/<nonce>/`へ取得する。download bytesは配布元の
review済みintegrity/signatureまたはlockfile integrityへ照合し、展開後にversionと公開versionを検査する。
package lifecycle script、repository/workspaceへのinstall、PDF・crop・manifestのread、AI/provider endpointへの接続を禁止する。
全commandのworking directoryは`PILOT_WORK_ROOT/tooling/phase-b1/`内とし、repository cwd、PowerShell profile、NODE_PATH、
repository `node_modules`、implicit package resolutionを使わない。

取得開始直前からcompletion marker公開後までをB0 network計測範囲とし、許可したruntime/package取得requestの
件数・host・response bytes SHA-256だけを
`restricted/preparation/phase-b0-network.json`へ記録する。credential、query、絶対pathは記録しない。
staging payloadの全regular fileをrelative path ASCII順でhashし、version、lockfile hash、network summaryとともに
`tooling/phase-b1/toolchain-inventory.json`へJCS+LFで保存する。全検証後にtreeをimmutable finalへ排他的公開し、
最後に`tooling/phase-b1/toolchain-complete.json`をatomic completion markerとして公開する。
inventory/marker自身はpayload tree hash対象外とする。staging payloadは
`tooling/phase-b1/environments/<treeObjectSha256>/`という未存在final directoryへcreate-new renameし、
既存directoryをreplace/mergeしない。
completion markerはinventory file hashとnetwork log file hashを結合する。

B0の同一再実行はmarkerと全file hash一致なら`unchanged`、staging残存、欠落、不一致final、marker不整合はfail closedとする。
B1a/B1bは`--toolchain-inventory-file-sha256`でmarkerが結合するinventory file hashを受け、全hashを再検証し、
記録済みB0 Nodeで起動する。B1a/B1bの計測範囲はprocess開始からcompletion/error終了までで、network API、socket、
network可能なchild processをdenyし、試行があればoutputを公開せず
`RangeError('phase-b1-network-forbidden <logical-operation>')`、0件なら0件をevidenceへ記録する。
B0のpackage取得は外部AIへの画像・prompt送信とは別であり、
B0完了をAI upload承認とみなさない。

## 4. 入力と hash binding

B1a/B1b は path の存在だけでなく、次の file bytes または LF なし JCS object hashを検証する。

| input | binding |
|---|---|
| `restricted/source/source-2306.13087v1.pdf` | file SHA-256 `20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af` |
| `frozen/protocol/phase-a-hash-inventory.json` | file SHA-256 `d5120eb809aba141d3d5b48c9a3e0aa1af5daa32967488ad8f5ed9c480c49256` と34 entryの再計算一致 |
| `frozen/protocol/morphology-ensemble-pilot-v1.json` | object SHA-256 `a4e03bf680979cc65ec6389ca89475201a73c77163bf2533845b8ee75be13b68` |
| `restricted/selection/candidate-set.json` | object SHA-256 `2ed0c86bd7484e2fa25117eedfc81116263029f6a76bba7fb137ab72aaf2f716` |
| `restricted/selection/pilot-selection-plan.json` | object SHA-256 `cc90c71fee3dcae0c19ae55433f145d449d3c4d5860bcf1c1dd0245357b6408a` |
| locator inventory | raw file SHA-256 `0d3bcacabfe8625e3c76f7d48bba3fb99280d48cac15c40cff5551f66d5e2c1e` |

selection planの24 source IDをlocator inventoryへ一対一でjoinし、page、panel ordinal、PDF point boundsを得る。
欠落、重複、未知ID、plan/candidate/protocol/PDF hash不一致、Phase A inventory不一致は補完せず
`RangeError('phase-b1-input-invalid <logical-field>')` とする。proxy、A/B vote、human final、画像特徴を
maskや匿名IDの決定に使わない。

anonymous ID は selection plan の `ordinal` にだけ対応する
`img-001` .. `img-024`、filenameは `img-001.png` .. `img-024.png` とする。
ordinal 0..11を `batch-01`、12..23を `batch-02` とし、source ID、page、条件値を符号化しない。

### 4.1 B1-only canonical JSON contract

Phase Aで凍結済みschemaを適用するのは`BlindedInputManifestV1`、`RestrictedImageMapV1`、
`BatchInputTableV1`の3種類だけである。次のB0/B1-only objectは本設計を直接契約とし、Phase A asset/schemaを
遡及追加・変更しない。全objectはUTF-8 BOMなし、stringをNFC化し、LFなしRFC 8785 JCS objectをobject hash preimage、
その末尾にLFを1つ付けたbytesをfile SHA-256 preimageとする。propertyは下表・interfaceの厳密集合で全てrequired、
unknown/duplicate property、`NaN`、Infinity、`-0`、safe integer外、暗黙nullを拒否する。

```ts
interface ArtifactEntryV1 {
  readonly relativePath: string;
  readonly kind:
    | 'toolchain-payload' | 'page-raster' | 'source-crop'
    | 'mask-plan-revision' | 'mask-plan-head' | 'blinded-png'
    | 'phase-b1-json';
  readonly fileSha256: Sha256Hex;
  readonly byteLength: number;
}

interface RepositoryReadAllowlistEntryV1 {
  readonly repositoryRelativePath: string;
  readonly fileSha256: Sha256Hex;
}

interface RepositoryReadAllowlistV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-repository-read-allowlist/1';
  readonly entries: readonly RepositoryReadAllowlistEntryV1[];
}
```

relative pathはNFC、`/`区切り、非空segmentだけとし、absolute/UNC/drive、`.`、`..`、NUL、backslash、usernameを
禁止する。`ArtifactEntryV1`配列は`relativePath` ASCII昇順で重複不可、allowlistは
`repositoryRelativePath` ASCII昇順で重複不可とする。各inventoryのowned-final配列は列挙した集合とexact一致し、
inventory自身、completion marker、temp、inbox、preview、他generation、unrelated fileを含めない。

| schemaVersion | 厳密なtop-level field集合と配列契約 |
|---|---|
| `snow-crystal-morphology-pilot-phase-b0-network/1` | `schemaVersion,stage,startedAtUtc,finishedAtUtc,requests,requestCount,aiProviderRequestCount`; `stage='B0'`; UTCは`UtcSeconds`; requestは`ordinal,host,artifactKind,responseByteLength,responseFileSha256,integrityOutcome`だけ、ordinal 0始まり、`artifactKind='node-runtime'|'npm-package'`、`integrityOutcome='verified'`; `requestCount=requests.length`; `aiProviderRequestCount=0` |
| `snow-crystal-morphology-pilot-toolchain-inventory/1` | `schemaVersion,nodeVersion,packages,lockSource,repositoryReadAllowlist,payloadTreeObjectSha256,payloadFiles,networkLogFileSha256`; exact Node、packagesは`name,version`だけを持つ2件name ASCII順、lockSourceは`repositoryRelativePath,fileSha256`、payloadFilesは全payload regular file、tree object hashは`JCS(payloadFiles)`のSHA-256 |
| `snow-crystal-morphology-pilot-toolchain-complete/1` | `schemaVersion,toolchainInventoryFileSha256,toolchainInventoryObjectSha256,networkLogFileSha256,payloadTreeObjectSha256,completedAtUtc`; inventory/marker自身はpayload membership外 |
| `snow-crystal-morphology-pilot-source-preparation/1` | `schemaVersion,protocolObjectSha256,selectionPlanObjectSha256,sourcePdfSha256,locatorInventoryFileSha256,toolchainInventoryFileSha256,pageRasters,sourceCrops`; pageRastersはpage 11..14昇順の4件、各`pdfPage,widthPx,heightPx,file,rgbaSha256`; sourceCropsはanonymous ID昇順24件、各`anonymousImageId,sourceObservationId,pdfPage,pagePanelOrdinal,widthPx,heightPx,file,rgbaSha256,viewportTransform,cropPixelBounds` |
| `snow-crystal-morphology-pilot-phase-b1a-inventory/1` | `schemaVersion,protocolObjectSha256,selectionPlanObjectSha256,sourcePdfSha256,toolchainInventoryFileSha256,sourcePreparationFileSha256,initialMaskRevisionFileSha256,initialMaskHeadFileSha256,ownedFinals`; ownedFinalsは4 raster、24 crop、source-preparation、generation 0 mask revision/headの31件exact集合 |
| `snow-crystal-morphology-pilot-phase-b1-final-inventory/1` | `schemaVersion,finalGenerationId,confirmedMaskPlanRevisionFileSha256,protocolObjectSha256,selectionPlanObjectSha256,sourcePdfSha256,toolchainInventoryFileSha256,phaseB1aInventoryFileSha256,frozenOwnedFinals,restrictedOwnedFinals`; frozenは24 PNG＋manifest＋2 tableの27件、restrictedはconfirmed plan＋mapの2件exact集合。§6.3のgeneration内finalだけを列挙し、inventory自身とactive head/closureを除外 |
| `snow-crystal-morphology-pilot-phase-b1-command-summary/1` | `schemaVersion,command,status,finalGenerationId,revisionFileSha256,inventoryFileSha256`; commandは`bootstrap-toolchain|prepare-source|save-mask-draft|finalize-blinding`、statusは`created|unchanged|resumed`、該当しない3 hash fieldはnull; stdout 1行だけでpath、username、source IDなし |

上表のnested objectも記載fieldだけを持つ。`file`は`ArtifactEntryV1`である。width/height/pagePanelOrdinalは正のsafe integer、
viewportTransformは有限binary64 6-tuple、cropPixelBoundsは`[x0,y0,x1,y1]`の非負safe integerで§5.2と一致する。
page raster file kindは`page-raster`、source cropは`source-crop`に固定する。`packages`は
`@napi-rs/canvas@1.0.6`と`pdfjs-dist@6.3.289`、`nodeVersion='24.14.1'`以外を拒否する。
toolchain inventoryの`repositoryReadAllowlist`は上記`RepositoryReadAllowlistV1`そのもので、§2.1の実行allowlistと一致させる。
command summaryはbootstrap/prepareで対応completion inventory file hashだけ、saveでrevision file hashだけ、finalizeで
3 hash fieldすべてを非nullとし、それ以外をnullにする。
mask plan/headは§5.3、final generation head/closureは§6.4を完全契約とし、同じserializationを適用する。

## 5. B1a prepare-source

### 5.1 CLI/API

```text
<B0_NODE> <REPOSITORY_ROOT>/apps/snow-crystal-sim/tests/calibration/prepare-morphology-pilot-images.mjs prepare-source \
  --work-root <absolute PILOT_WORK_ROOT> \
  --locator-inventory <absolute read-only path> \
  --toolchain-inventory-file-sha256 <sha256> \
  --storage-root-id snow-crystal-t1-7-pilot
```

library API は filesystem、renderer、clockを注入可能にする。production default rendererだけが exact PDF.js/canvasを
使い、testは synthetic rendererを使う。CLI stdoutは相対pathを含まないcanonical JSON summary 1行、stderrは
stable reasonとlogical fieldだけとし、absolute path、username、errno、stackを出さない。

### 5.2 raster と crop

PDF page 11..14だけを各1回rasterizeする。page raster保存形式は
`uint32LE(width)||uint32LE(height)||top-left row-major RGBA8` とし、次へ保存する。

```text
restricted/page-rasters/page-011.rgba8
restricted/page-rasters/page-012.rgba8
restricted/page-rasters/page-013.rgba8
restricted/page-rasters/page-014.rgba8
```

locatorのPDF user-space rectangle 4 cornerへviewport transform `[a,b,c,d,e,f]` をbinary64で適用し、
`x0=floor(minX), y0=floor(minY), x1=ceil(maxX), y1=ceil(maxY)` とする。
`0<=x0<x1<=pageWidth`、`0<=y0<y1<=pageHeight` を要求し、clamp、padding、別丸め、回転追加、反転、補間を禁止する。
各row `[x0,x1)` を `y0..y1-1` 順にcopyし、source cropを上位設計と同じcanonical PNG codecで保存する。

```text
images/source-crops/<sourceObservationId>.png
```

page rasterとsource cropについてfile SHA-256、RGBA SHA-256、width/height、viewport transform、crop boundsを
`restricted/preparation/source-preparation.json`へsource ID ASCII昇順で記録する。RGBA hash preimageは
`uint32LE(width)||uint32LE(height)||RGBA8 bytes` である。

### 5.3 mask plan、CAS保存、review material

B1a初回成功時、空rectangle・未確認の24 entryを持つcanonical initial revisionを作る。単一のmutable draft fileは
使わない。plan本体はfile bytesのSHA-256をbasenameとする
`restricted/mask-review/revisions/<revisionFileSha256>.json`へJCS+LF exact bytesでimmutable公開する。
active revisionはappend-onlyな`restricted/mask-review/heads/<8桁generation>.json`で指す。headはgeneration、
revision file hash、直前head file hashを持つJCS+LFであり、generation 0から欠番なく一本鎖でなければならない。
未知head、fork、欠番、hash不一致、同generation競合はfail closedとする。

```ts
interface PhaseB1MaskPlanHeadV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-mask-plan-head/1';
  readonly generation: number; // 0..99999999 safe integer; basenameと10進値一致
  readonly revisionFileSha256: Sha256Hex;
  readonly priorHeadFileSha256: Sha256Hex | null; // generation 0だけnull
}
```

headもUTF-8 BOMなし・NFC・LFなしJCS object＋final LF 1つとする。generation上限到達時はwrapせず停止する。

人間編集は手動file上書きではなく、次の保存操作だけを使う。

```text
<B0_NODE> <REPOSITORY_ROOT>/apps/snow-crystal-sim/tests/calibration/prepare-morphology-pilot-images.mjs save-mask-draft \
  --work-root <absolute PILOT_WORK_ROOT> \
  --candidate <PILOT_WORK_ROOT/restricted/mask-review/inbox/candidate.json> \
  --expected-prior-draft-file-sha256 <active revision file sha256> \
  --toolchain-inventory-file-sha256 <sha256>
```

library APIはcandidate bytesとexpected prior hashを受ける。duplicate-aware parse、unknown property/type/domain、
NFC、entry順、hash binding、下記editing validationを検査し、accepted objectをJCS+LFへcanonicalizeする。
candidateは`PILOT_WORK_ROOT/restricted/mask-review/inbox/`直下のregular fileだけを許し、symlink/reparseを拒否する。
現在headが指すrevision file hashとexpected prior hashが一致しなければcandidateを公開せず
`phase-b1-draft-cas-conflict`とする。新revisionはowned tempへ`wx`、fsync、再read/hash後にhash名へexclusive hardlinkし、
次generation headも同じ手順でexclusive publishしてdirectory syncする。同時writerは同じnext head名の一方だけが成功し、
敗者は既存headを変更せずconflictとなる。head公開前crashのunreferenced revisionは既存stateを変えず、同じcandidateの
resumeでhash一致なら再利用できる。head temp/orphan、head公開後のrevision欠落、chain異常は自動削除・修復しない。
candidate canonical hashがactive revisionと同一なら新headを作らず`unchanged`とし、欠落previewだけを再生成できる。

人間または人間が明示的に採用した補助案だけがrectangleを追加できる。AI/OCR/画像処理による自動案は
provenanceに留め、`confirmed`や確認checkboxを自動生成してはならない。

```ts
interface PhaseB1MaskPlanV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-mask-plan/1';
  readonly protocolObjectSha256: Sha256Hex;
  readonly selectionPlanObjectSha256: Sha256Hex;
  readonly sourcePdfSha256: Sha256Hex;
  readonly entries: readonly {
    readonly anonymousImageId: `img-${string}`;
    readonly sourceObservationId: SourceObservationId;
    readonly sourceCropFileSha256: Sha256Hex;
    readonly sourceCropRgbaSha256: Sha256Hex;
    readonly widthPx: number;
    readonly heightPx: number;
    readonly maskRectanglesPx: readonly (readonly [x: number, y: number, width: number, height: number])[];
    readonly provenance:
      | 'none'
      | 'operator-entered'
      | 'machine-suggested-human-accepted'
      | 'machine-suggested-human-edited';
    readonly status: 'draft' | 'confirmed';
    readonly checks: {
      readonly conditionTextUnreadable: boolean;
      readonly maskClearOfCrystalAndSeed: boolean;
      readonly outlineAndTipsComplete: boolean;
      readonly fullFrameOrientationIntegrity: boolean;
    };
    readonly confirmedByRole: 'human-image-mask-auditor' | null;
    readonly confirmedAtUtc: UtcSeconds | null;
    readonly note: string | null; // NFC、非個人情報、0..300文字
  }[];
}
```

editing validationでは24 entryとsource bindingを常に要求する。`status='draft'` entryはrectangle 0件以上を許し、
`confirmedByRole=null`、`confirmedAtUtc=null`を必須とする。途中保存のためchecksはtrue/false混在を許す。
rectangle 0件なら`provenance='none'`、1件以上なら`none`を禁止する。`status='confirmed'` entryはrectangle 1件以上、
4 checksすべてtrue、`confirmedByRole='human-image-mask-auditor'`、非null`confirmedAtUtc`を必須とする。
`UtcSeconds`は上位契約どおりfractional secondなしのRFC 3339 UTC `YYYY-MM-DDTHH:mm:ssZ`、実在時刻、leap second禁止である。
rectangleはinteger `[x,y,width,height]`、width/heightは1以上、crop内、相互に非重複とする。
mask対象は温度、過飽和度、成長時間、視野寸法、page/panel文字だけである。
planのtop-level/entry/checksはinterface記載propertyの厳密集合とし、entriesは`img-001`..`img-024`昇順でexact被覆する。
各anonymous ID、source ID、crop hash、寸法はselection/source-preparationとの同じordinalのrecordへ一対一で一致させる。

libraryは`validateEditableMaskPlan(candidateBytes)`と`validateConfirmedMaskPlan(exactRevisionBytes)`を分離する。
前者は上記mixed draft/confirmed entryを検査してcanonical JCS+LF bytesを返す。後者はcanonical bytes一致を先に要求し、
前者の全制約に加えて全24 entryがconfirmed規則を満たす場合だけ受理する。両APIとも値の補完、時刻生成、checkbox変更、
provenance推測を行わない。

`save-mask-draft`成功後、その保存済みrevisionをread-only入力としてopaque gray `[127,127,127,255]` を適用した
restricted previewをhash-bound revision directoryへatomic生成する。

```text
restricted/mask-review/previews/<revisionFileSha256>/<sourceObservationId>.png
```

previewはfinal blinded artifactではなく、source IDを含むrestricted materialである。人間はsource cropとpreviewを比較し、
24件すべてについて次を能動確認する。

1. 温度、過飽和度、成長時間、視野寸法、page/panel文字が読めない。
2. mask rectangleが新しい結晶、seed crystal、support needle/wireへ重ならない。
3. 結晶の外周・先端がcropまたはmaskで欠けていない。
4. full frameであり、向き変更、破損、過度な縮小がない。

全checkを人間がtrueにし、roleと`UtcSeconds`を記録したentryだけを`confirmed`とする。machine suggestionを無修正採用した
場合は`machine-suggested-human-accepted`、rectangleを変更した場合は`machine-suggested-human-edited`とする。
未確認、一部確認、status/null不整合、不正UTC、source crop hash変更後の古い確認は保存またはB1bで拒否する。

### 5.4 B1a completion

4 page raster、24 source crop、`source-preparation.json`が完全一致した後だけ、最後に
`restricted/preparation/phase-b1a-inventory.json`をcompletion markerとして公開する。
generation 0のinitial revision/headはB1a markerより先に公開し、そのexact file hashをB1a inventoryへ含める。
後続の人間編集revision/head/previewは追加可能なためB1a inventoryのowned finalへ含めない。markerがあるのに
initial revision/headが欠落・不一致なら自動再生成せず`phase-b1-incomplete`とする。

## 6. B1b finalize-blinding

### 6.1 CLI/API

```text
<B0_NODE> <REPOSITORY_ROOT>/apps/snow-crystal-sim/tests/calibration/prepare-morphology-pilot-images.mjs finalize-blinding \
  --work-root <absolute PILOT_WORK_ROOT> \
  --locator-inventory <absolute read-only path> \
  --mask-plan-revision restricted/mask-review/revisions/<revisionFileSha256>.json \
  --expected-head-file-sha256 <active head file sha256> \
  --expected-active-final-head-file-sha256 <sha256|absent> \
  --toolchain-inventory-file-sha256 <sha256> \
  --storage-root-id snow-crystal-t1-7-pilot
```

B1bはB1a completion、全source output hash、Phase A input、exact toolchainを再検証する。
入力mask planはUTF-8 BOMなし・NFC・duplicate keyなし・LFなしJCS objectにfinal LFを1つ付けたexact bytesだけを許す。
parse後の再canonicalize bytesが入力bytesと一致し、file hashがbasenameと一致し、指定headが一意なactive chain tipとして
そのrevisionを指すことを要求する。final validationでは24 entryすべてにconfirmed entry規則を適用し、4 checks true、
source crop hash/寸法一致でなければ
`RangeError('phase-b1-mask-unconfirmed <anonymousImageId>')` とし、final outputを1 byteも作らない。
B1b completion marker公開直前にも同じheadが一意なactive tipであることを再検証し、確認中に新headが追加された場合は
`phase-b1-draft-cas-conflict`で停止する。

### 6.2 blinded derivative

source cropのrectangle内だけを `[127,127,127,255]` へ置換する。rectangle外RGBA bytesはbit-for-bit同一とする。
crop、padding、回転、反転、補間、超解像、denoise、sharpen、contrast/gamma/color変更、生成補完、匿名ID描画を禁止する。
PNGは `canonical-rgba8-png-stored-deflate/1` とし、上位設計のIHDR/IDAT/IEND、filter 0、zlib `78 01`、
最大65535 byte stored DEFLATE、ancillary chunk禁止を満たす。

```text
frozen/phase-b1-generations/<finalGenerationId>/images/blinded/img-001.png
...
frozen/phase-b1-generations/<finalGenerationId>/images/blinded/img-024.png
```

encode後に別経路でdecodeし、寸法、RGBA、file/RGBA hash、mask外不変、rectangle内完全grayを再検証してから公開する。

### 6.3 final artifact

`finalGenerationId`は`phase-b1-<confirmedMaskPlanRevisionFileSha256>`とし、confirmed revisionのfull lowercase
64 hexを省略せず使う。同じrevisionは同じgeneration、別revisionは別generationとなり、source IDや条件値を符号化しない。
次をgeneration固有pathへ生成する。Phase Aで凍結したreview済みschema bytesを使うのはmanifest/map/batch tableだけで、
mask snapshotとinventoryは§4.1/§5.3のB1-only契約を使う。

```text
restricted/phase-b1-generations/<finalGenerationId>/mask-plan.confirmed.json
restricted/phase-b1-generations/<finalGenerationId>/restricted-source-map.json
restricted/phase-b1-generations/<finalGenerationId>/phase-b1-final-inventory.json
frozen/phase-b1-generations/<finalGenerationId>/images/blinded/img-001.png ... img-024.png
frozen/phase-b1-generations/<finalGenerationId>/manifests/blinded-input-manifest.json
frozen/phase-b1-generations/<finalGenerationId>/input-tables/batch-01-input.json
frozen/phase-b1-generations/<finalGenerationId>/input-tables/batch-02-input.json
```

- `mask-plan.confirmed.json` は検証済みB1b入力revisionからexclusive hardlinkで公開するexact bytes snapshotであり、
  入力revisionとfile SHA-256・bytesが同一でなければならない。そのhashをfinal inventoryへ入れる。
- blinded manifestは24匿名ID昇順で、匿名relative pathを
  `frozen/phase-b1-generations/<finalGenerationId>/images/blinded/img-NNN.png`に固定し、寸法、derivative file/RGBA hash、
  mask rectangle、codec/tool/versionだけを持つ。
- restricted mapだけが匿名IDをsource ID、locator、source crop relative path/hash、page raster hash、crop boundsへ結ぶ。
- batch input tableはmanifestのbatch順で各12件、ordinal 0..11、attachment slotは
  `attachment-01` .. `attachment-12`、file/RGBA hashを持つ。
- `storageRootId` はNFC固定値だけを保存し、絶対path、drive letter、usernameを保存しない。
- final inventoryは上記24 PNG＋manifest＋2 tableを`frozenOwnedFinals`、confirmed snapshot＋restricted mapを
  `restrictedOwnedFinals`としてexact列挙し、自身を除外する。inventoryをgeneration completion markerとして最後に公開する。
- Phase A schemaの3 artifactへB1-only fieldを追加しない。代わりにfull revision hashを含むgeneration IDとfinal inventoryが
  全artifact file hashを直接結合し、batch tableはmanifest object hash、manifest/mapは同じ24匿名ID・derivative hashへ結合する。
  このchainのいずれかが欠ければgeneration全体を拒否する。

blinded manifest、blinded PNG、batch input tableにはsource ID、page、locator、source filename/path、条件値、
proxy、A/B、人間final、review noteを含めない。actor workspaceのmaterializeと外部uploadは後続工程で行う。

### 6.4 active final generationとreplacement

固定のconvenience output、symlink、`images/blinded/`へのcopyは作らない。active generationはappend-only headだけで示す。

```ts
interface PhaseB1ActiveFinalHeadV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-phase-b1-active-final-head/1';
  readonly headGeneration: number; // 0..99999999 safe integer; basenameと一致
  readonly finalGenerationId: `phase-b1-${Sha256Hex}`;
  readonly confirmedMaskPlanRevisionFileSha256: Sha256Hex;
  readonly finalInventoryFileSha256: Sha256Hex;
  readonly priorHeadFileSha256: Sha256Hex | null;
  readonly priorFinalGenerationId: `phase-b1-${Sha256Hex}` | null;
  readonly closureFileSha256: Sha256Hex | null;
}

interface PhaseB1FinalClosureV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-phase-b1-final-closure/1';
  readonly closedFinalGenerationId: `phase-b1-${Sha256Hex}`;
  readonly closedFinalInventoryFileSha256: Sha256Hex;
  readonly replacementFinalGenerationId: `phase-b1-${Sha256Hex}`;
  readonly replacementFinalInventoryFileSha256: Sha256Hex;
  readonly priorActiveFinalHeadFileSha256: Sha256Hex;
  readonly reason: 'confirmed-mask-revision-changed';
  readonly closedAtUtc: UtcSeconds;
}
```

headは`restricted/phase-b1-final-heads/<8桁headGeneration>.json`、closureは
`restricted/phase-b1-final-closures/<closureFileSha256>.json`へJCS+LFでimmutable公開する。初回headはgeneration 0、
prior/closure 3 fieldがnullである。replacementでは新generationの全finalとinventoryを先に完成させ、旧activeと新generationを
結ぶclosureをcontent-addressed pathへ公開し、そのclosure hashを持つnext headをexclusive publishする。closureはactive headから
参照された場合だけ有効であり、CAS競合でheadを得なかったunreferenced closureは旧generationをcloseしない。
headはgeneration 0からtipまで欠番なし、`priorHeadFileSha256`一致の一本鎖だけを許し、一意な最高generation headをactive tipとする。
fork、unknown head、欠番、hash不一致ではactiveを推測しない。effective closureはold generationのupload適格性だけをcloseし、
old artifactの完全性・保存・監査参照を無効化しない。

next head公開直前にmask plan headとcurrent active final headの両file hashがCLIの各expected値と一致すること、
新旧inventoryとclosureが完全であることを再検証する。同時replacementは同じnext head basenameの一方だけが勝ち、
敗者の完成generation/closureはimmutableだがinactiveである。
CAS敗者はconflictで停止する。再試行にはcallerが新しいcurrent headを読み、そのfile hashを新たなexpected値として明示する必要がある。
その場合も既存完成generationを全再検証してからactivationし、暗黙上書きしない。old generation、old head、
effective/inert closureを削除・変更しないためfresh work rootは不要である。

actor workspace materializationとuploadは、一意なhead chainのtipが指すactive finalized generationだけを対象とする。
upload直前にhead、closure chain、final inventory、全owned finalを再hashし、headが変われば停止する。inactive generationや
固定pathからのuploadを禁止する。

## 7. 状態、atomicity、再実行

論理状態は次の一方向だけである。

```text
absent -> toolchain-ready -> source-prepared -> mask-revision(s) -> generation-finalized -> active-final
                                                          \-> newer revision -> newer generation-finalized -> active-final
```

- B0: toolchain completionと全hash一致なら`unchanged`、未完成stagingまたは不一致finalは停止する。B1は`toolchain-ready`なしで開始しない。
- B1a: source finalが全て期待bytesなら`unchanged`、一部だけ正しいなら欠落分だけ`resumed`、不一致finalは`phase-b1-final-conflict`。
- draft/preview: immutable revisionをCASで追加するだけとし、既存revision/headを更新しない。confirmed snapshot公開後の新revisionは
  old finalへ暗黙反映せず、そのrevision hashから別のfinal generationとして全replacement artifactを再発行する。
- B1b: 対象generationのfinal inventoryと全owned finalが完全一致ならgeneration作成は`unchanged`。inventoryなしで正しいfinalだけが
  ある場合は同じgeneration内の欠落分だけ`resumed`。active head CASはgeneration作成と別に検証し、既にactiveなら`unchanged`、
  expected head不一致ならgenerationを保持したまま停止する。
- completion markerがあるのに欠落・不一致があれば`phase-b1-incomplete`。自動修復・上書きしない。
- 競合する既存file、未知temp、orphan finalを削除しない。

各fileは同一directoryの予測可能なowned tempへ`wx`で書き、file fsync/close、別readでbytes/hash検証、
exclusive hardlink publish、parent directory sync、owned temp unlink、再syncの順とする。completion inventoryは最後に公開し、
直前に全predecessor finalとowned temp不在を再検証する。crash後にowned tempが残ればfail closedにしてoperatorへ示す。
hardlink非対応、directory syncの未知error、path identity変更は黙ってfallbackしない。

CLIのstable error reasonは次に限定する。

```text
phase-b1-environment-invalid
phase-b1-toolchain-incomplete
phase-b1-network-forbidden
phase-b1-repository-read-forbidden
phase-b1-root-invalid
phase-b1-input-invalid
phase-b1-mask-invalid
phase-b1-mask-unconfirmed
phase-b1-draft-cas-conflict
phase-b1-draft-head-invalid
phase-b1-active-final-cas-conflict
phase-b1-final-head-invalid
phase-b1-temp-present
phase-b1-final-conflict
phase-b1-incomplete
phase-b1-write-conflict
phase-b1-hardlink-unsupported
phase-b1-directory-sync-failed
```

## 8. 検証戦略

test codeは通常workspaceでnetwork/PDF/実画像を使わず、renderer/filesystem/clock adapterを注入する。

1. synthetic viewport transformで4 corner、floor/ceil、half-open cropを独立計算する。
2. synthetic RGBAでmask内gray、mask外bit一致、file/RGBA hash、canonical PNGを独立oracleと比較する。
3. exact version/PDF/Phase A hash mismatchがoutput 0 byteで停止することを確認する。
4. 24 entry、匿名ID、batch 12+12、manifest/map非漏洩、Phase A schema適用が3種類だけであることを検査する。
   §4.1のB1-only canonical JSONそれぞれについてrequired/unknown/wrong type/null、array順・件数、relative path、
   file/object hash、owned-final exact membership、inventory self exclusion、JCS+LFを独立oracleで検査する。
5. B0だけが許可取得先へnetwork requestでき、toolchain marker/hash、同一再実行、不一致、staging crashを検査する。
   B1a/B1bはnetwork API・socket・network可能child processの試行0件をprocess全期間で検査する。
6. draft rectangle 0件、checks混在、role/time nullを受理し、confirmed rectangle 0件、check false、role/time null・wrong roleを拒否する。
   status/null不整合、fractional/non-Z/offset/leap-second/不実在`confirmedAtUtc`、unknown provenance、rectangle 0件で
   provenance非`none`、rectangleありで`none`を個別に拒否し、machine suggestionの無修正採用と人間編集を区別して受理する。
7. stale expected prior hash、同generation並行保存、head fork/欠番/generation上限、candidate duplicate key/invalid schema、revision basename hash mutation、
   stale crop hash、rectangle重複/範囲外/0幅、B1b指定revisionとactive head不一致を個別に拒否する。等価candidateの
   whitespace/property順差は同じJCS+LF revisionへcanonicalizeされることも確認する。
8. draft revision/headのatomic publish、no-op、crash前後resume、unreferenced revision再利用、temp orphan、link/fsync crash、
   late-final race、reparse/path差替えをfault adapterで検査し、既存revision/head exact bytesが不変であることを確認する。
9. confirmed snapshotがB1b入力revisionとexact bytes/file hash同一で、入力revisionを保存後またはvalidation中に変えたmutationを
   completion marker前に拒否することを確認する。
10. repository read allowlistの全path/hash正例と、hash違い、追加import、directory read、allowlist外read、symlink/reparseを検査する。
    repository内のwrite/temp/cache/lock/logをfilesystem adapterで全面拒否し、repositoryとprotected sentinelの
    path・entry type・exact bytesが不変で、無関係な外部fileを保持することを確認する。
11. 同じconfirmed revisionから同じfull-hash generation IDと同じartifactを再生成し、別revisionでは別generationとなること、
    old generation exact bytesが不変でfixed convenience pathが作られないことを確認する。
12. 初回active head、replacement closure/head、head CAS競合、generation/closure完成後crash、inactive complete generation、
    inert closure、head fork/欠番、inventory mutationを検査する。勝者だけがactiveとなり、敗者はold activeをcloseしない。
13. upload/materialize resolverが一意なactive head tipだけを受理し、inactive/closed/fixed path、hash不一致、upload直前head変更を拒否する。

承認済みtest codeで、tool/library未存在を最初の存在assertionによる唯一のexpected Redにする。
実PDFの実行はtest code・実装の独立レビューとGreen後だけに行い、exact runtime/package/PDF hash、生成件数、
artifact hashをdata-preparation evidenceへ記録する。実PDF、page raster、crop、mask、restricted map、blinded PNGを
repository fixtureへ追加しない。

## 9. 人間ゲートと外部送信境界

B1aの生成自体には形態分類の人間判断はない。人間に必要なのは、24件それぞれのmask/cropに対する§5.3の4確認である。
B1bは24/24確認が揃うまで実行できず、Coordinatorやtoolが確認を代行・推測・自動true化しない。

B1b完了後も外部AIへは送信しない。初回upload直前にactive final headを解決し、そのgenerationのlocal file/RGBA hash、
寸法、MIME、full-frame preview、匿名ID/attachment slotをmanifestと再照合する。その時点を外部送信の明示確認点とし、ユーザーの確認なしに
Claude Code、Codex、Gemini Chatその他のproviderへ画像を送信しない。

## 10. 決定事項と未決定事項

本書で追加するのは実行の分割、path、状態、失敗境界だけであり、既存の画像変換・匿名化・分類要件を変更しない。

- 採用: B1a/B1b二段階、`img-001..024`、source ID付きrestricted review material、24/24人間確認、finalize後の外部送信分離。
- 採用: network可能なtoolchain取得をB0へ隔離し、B1a/B1bはB0 inventoryへhash結合したoffline実行とする。
- 採用: mask編集はimmutable revisionとappend-only generation headによるCAS保存とし、mutable fileの上書きを禁止する。
- 採用: finalはconfirmed revision hash由来のgenerationへ凍結し、append-only head/closureだけでactiveを切り替える。old finalを保持する。
- 採用: repositoryはwrite全面禁止、review済みpath/hash allowlist以外のreadも禁止する。
- 採用: maskのmachine suggestionは任意だが非権威。人間確認なしのfinalizeは禁止。
- 採用: exact toolchainは`PILOT_WORK_ROOT/tooling/phase-b1/`へ隔離し、通常workspace依存を変更しない。
- 未決定: 各画像のrectangle座標。これは設計値ではなく、B1a source cropを見て人間が確定する実行dataである。
