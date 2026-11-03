# T1-7 Phase B1 — ローカル画像準備と匿名化のテストケース

## 1. 目的、適用範囲、上位契約

本書は、承認済み `PHASE-B1-DESIGN.md` をテストコードへ落とすための規範テストケースである。
上位の `DESIGN.md`、`MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md`、既存 `TESTCASES.md` の
`TC-PILOT-SELECTION-002`、`TC-PILOT-DERIVATIVE-001..002` は変更しない。

- task: `T1-7`
- 実行プロファイル: `full`
- UI影響: なし
- 対象: L0 curation runner、L0 lock curation、B0 exact toolchain、B1a source preparation、
  mask revision、B1b blinding、active generation resolver
- 対象外: 外部AIへのupload、model実行、形態判定、consensus、adjudication、human final、production corpus
- 実画像、PDF raster、crop、mask、restricted map、blinded PNGはrepository fixtureへ置かない。

本書は画像から物理形態を推測しない。pixel変換、hash、境界、状態遷移、監査証跡だけを検証する。
矛盾時の優先順位は上位契約を正とし、テスト側で補完・緩和しない。

## 2. 工程分割と期待Red

Phase B1は、依存循環を避けるため次の順で進める。

1. **L0 runner mini-cycle**
   - 本書の `TC-B1-L0R-*` だけを先にテストコード化して独立レビューする。
   - 最初の単一assertionでrunner pathの存在を`true`と比較する。
   - runner未存在によるそのassertion failureだけをexpected Redとする。
   - dynamic execution、network、filesystem write、module import errorをRedにしない。
   - runner実装、Green、implementation review、commitまで完了する。
2. **L0 data-preparation gate**
   - approved runnerだけでreal network L0を実行する。
   - `TC-B1-L0-CURATION-*`に従う独立reviewでcandidate lockを承認する。
   - approved candidate lock exact bytesだけをrepositoryの
     `phase-b1-toolchain-lock.json`へcopyする。
3. **B0/B1 test cycle**
   - approved lockのfile hashをliteralに固定して、残りの本書をテストコード化する。
   - 先頭の単一assertionでB0 launcherとB1 implementationの存在結果を
     `{bootstrap:true,images:true}`と比較する。
   - どちらかの未存在によるそのassertion failureだけをexpected Redとする。
   - Red後にlock literal、期待値、許容範囲を追加・削除・変更しない。
4. **B0/B1 implementation、Green、real preparation**
   - 全synthetic test Greenとimplementation review後にだけreal B0/PDFを実行する。
   - 実行直前にCoordinator execution artifact gateを通す。

構文、型、dependency、environment、permission、timeout、real network失敗はexpected Redではない。

## 3. 共通fixtureと独立oracle

### 3.1 synthetic root

各testは固有の隔離temp rootを使い、次のsentinelを実行前後で比較する。

- repository/workspace: path、entry type、全対象fileのexact bytes
- root外external directory: file list、bytes、hash
- LocalStorage/SOURCE-AUDIT相当sentinel
- Phase A final、source PDF、selection final相当sentinel

test-only adapterの注入は原則library APIだけとする。唯一のCLI例外はL0 runner mini-cycleの
`-Operation synthetic-probe -ProtocolVersion 1`であり、review前の単一PowerShell fileを別processで検査するためだけに使う。
B0/B1 adapterは従来どおりlibrary API限定で、CLI option、environment variable、artifactへ露出しない。
L0 production `curate`へのadapter/stdin注入、synthetic response/artifactのauthority・L0 completionへの昇格を禁止する。
通常testはsynthetic-probeを含めDNS、socket、HTTP client、browser、real PDF、実画像、runner codeからのreal filesystem
dispatchを0件とする。PowerShell process loader/runtime自身のsystem file readだけはこのapplication dispatch countから除外する。

### 3.2 canonical JSON oracle

test oracleは実装と共有しないduplicate-aware parser、NFC validator、RFC 8785 JCS、SHA-256を使う。

- object hash preimage: final LFなしJCS bytes
- file hash preimage: 同じJCS bytes + final LF 1個
- UTF-8 BOM、CRLF、末尾複数LF、duplicate/unknown property、非NFC、`NaN`、Infinity、`-0`、
  safe integer外を個別に拒否する。
- relative pathはNFC、`/`区切り、空segment、`.`、`..`、backslash、NUL、absolute、UNC、drive、
  usernameを拒否する。

L0/B0/B1-only objectは設計のstrict schemaを使う。Phase A schemaを適用するのは
`BlindedInputManifestV1`、`RestrictedImageMapV1`、`BatchInputTableV1`だけとする。

### 3.3 filesystem fault oracle

実装と別のfault adapterで、次の順序と各境界のcrashを観測する。

```text
wx temp -> file fsync -> close -> separate read/hash -> exclusive hardlink
-> parent directory sync -> temp unlink -> parent directory sync
```

normal rename/copyへのfallback、existing finalのreplace/unlink、未知tempの自動削除を禁止する。
既知hardlink非対応と未知directory sync errorは別reasonとする。

### 3.4 synthetic pixel oracle

RGBA hashは`uint32LE(width)||uint32LE(height)||top-left row-major RGBA8`をpreimageとする。
cropとmaskは実装と共有しないnested loopで期待bytesを作る。PNG oracleは既存
`TC-PILOT-DERIVATIVE-001`のCRC32、Adler32、stored DEFLATE、chunk parserとliteral snapshotを再利用する。

### 3.5 mutation規則

各mutationはpositive fixtureをdeep cloneし、対象契約を1つだけ壊す。関連hashを意図的に整合させるcaseでは、
「hash不一致」ではなく意味契約を隔離するため、全直接・上位参照hashをoracleで再計算する。
最初のerror class、stable reason、logical field、output 0 byteまたは既存state不変を検査する。

## 4. L0 curation runner mini-cycle

### TC-B1-L0R-000: production CLIとsynthetic probeの同一core境界

runner未存在assertionの後、PowerShell 5.1を別processで次の2形だけ起動する。

- production: `-Operation curate -CurationRoot ... -AuthorityBundleFile ... -ExpectedAuthorityBundleFileSha256 ...`
- test: `-Operation synthetic-probe -ProtocolVersion 1`とstdin JCS+LF request 1 object

synthetic transcriptはclock/network/filesystemのoperation、target、file-write input hash/length、outcomeを0始まりの
stepで与える。positiveでは全stepをexact 1回consumeし、real DNS/socket/filesystem dispatch 0件、host exit 0、stderr 0 byte、
stdout JCS+LF response 1行を要求する。responseのsimulated stdout/stderr/exit code、published file bytes/hash/length、
auditは、同じfixtureを独立oracleで実行したproduction contractと一致する。

CLI token構文検査後、production adapter生成までのfilesystem/network/clock dispatchは0件とする。authority bundleの
path identity/stat/read/hashは同一coreがproduction adapterで実行し、synthetic positiveでは先頭のfile-stat/file-read stepと
audit attempt/completeとして再現する。pre-core direct filesystem API、bootstrap read/hash、別authority検証pathをsource検査と
dispatch counterで拒否する。

operation/target/outcome branch違い、write input hash/length違い、step欠落・余剰・順序違い、duplicate/unknown field、
BOM/CRLF/余分LF、非canonical base64ではprobe自体がexit 2、stdout 0 byte、probe-invalid error 1行となり、real dispatch 0件とする。
productionへstdin、`-ProtocolVersion`、synthetic parameterを渡すcaseと、testへproduction parameterを渡すcaseを拒否し、
production operationへtest adapterを注入できないことを確認する。missing/duplicate/unknown/順序違い/positional CLI parameterも
adapter生成前にargument-invalidとする。

production/simulated successはexit 0・summary 1行・stderr 0 byte、契約errorはstdout 0 byte・error 1行とし、exit mapping
`2/10/11/12/13/70`、reason、logical fieldを設計literalと照合する。stdout/stderr/response/artifactにabsolute path、drive、
username、credential、errno、stackがないことを確認する。PowerShell source上の`Invoke-PhaseB1L0Core`、
`New-PhaseB1L0ProductionAdapters`、`New-PhaseB1L0TranscriptAdapters`は各exact 1定義で、両operationが同じcoreを呼ぶ。

operation別に許可したoutcome/error code以外（utc＋TLS、network＋directory、file-read＋clock、file-write＋generic error等）を
probe-invalidで拒否する。file-write failure tableの全row・全許可error codeを独立fixtureにし、filesystemFilesのtemp/final、
publishedFiles、audit attempt/error complete、completion inventory未公開、stdout 0、stderr reason/exitをliteral比較する。
`accepted/none/null`だけがsuccess completeとなり、late failureのfinalも自動削除・上書きされない。
`clock-failed`はexit 70で新しいaudit I/O entryを作らず、直前までのchainだけを保持する。

### TC-B1-L0R-001: review request、標準review投影、approval binding

**前提**: runner bytes `R` と独立SHA-256 `h`、標準review schemaのpositive recordを用意する。

**操作**:

1. request IDを`T1-7-l0-runner-${h}`とし、対象path/hashが1件だけのrequestをoracleでJCS+LF化する。
2. 標準recordの`review_type,status,reviewed_files,findings,conditions,rollback_to`だけをcamelCase projectionへ写す。
3. request object/file hashとprojectionからbinding object/file hashを求める。

**期待**:

- 同じrunner bytesではrequest/binding bytesとhashが常に同じ。
- summary、YAML scalar style、改行、session、時刻、proposal IDを変えてもbindingは不変。
- runner 1 byte変更ではrequest ID、対象hash、request/binding hash、authority directoryがすべて変わる。
- `review_type!='implementation'`、未承認status、findings/conditions非空、`rollback_to!='none'`、
  path/hash違い、0件/2件reviewed file、標準field欠落/追加ではbindingを生成しない。

**独立oracle**: strict objectを直接構築するtest-local JCS/SHA。REVIEW.md parserを使わない。

### TC-B1-L0R-002: operation別auditとhash chain

**前提**: synthetic adapterで、authority read、curation-root stat/list/write/read、許可network responseを順に行う。

**操作と期待**:

- ordinalは0始まり欠番なし。最初のprior hashは64桁zero、以後は直前entry hash。
- entry hashは自身の`entrySha256`だけを除くstrict objectのJCS SHA-256。
- allow attemptの直後は同operation IDのcomplete 1件で、attempt ordinal、operation、target、request ordinalが一致。
- denyはdispatch 0回、complete 0件。denyを含むrunはsuccess inventoryを公開しない。
- networkだけが非null request ordinalを0始まり連続で持つ。
- evidence requestとnetwork completeはordinal、canonical URL、host、response length/hashが双方向1対1。
- file read/writeとnetwork resultはexact bytes hash/length、listはUTF-8 byte辞書順entry JCS hash、
  statはstrict metadata JCS hashと一致する。
- final hash、evidence、inventoryに1 byte mutation、entry削除/交換/重複、unpaired attemptを入れると拒否する。
- authority bundleのstat/read/hashはaudit chainの先頭に存在し、pre-core dispatchは0件。
- adapter errorはallow attempt＋error completeのpairとなり、operation別code/failurePoint表と一致する。error completeを
  success evidence requestへ数えず、success inventoryを公開しない。

**独立oracle**: audit entryのstrict unionをtest側でparseし、全preimageとchainを再計算する。

### TC-B1-L0R-003: deny-by-default I/Oと禁止scope集計

positiveはauthorityとcuration rootのowned path、設計で許可されたexact HTTPS requestだけを通す。
次を別mutationとしてdispatch前に拒否し、auditにdeny 1件、外部副作用0件を要求する。

- repository、image、PDF、phase artifact、LocalStorage、source-audit UI、production corpus、other path
- symlink/junction/reparse、path差替え、root外list/stat/read/write
- AI/provider、未知host、HTTP、userinfo/query/fragment/IP/nondefault port、redirect
- 許可version以外、汎用registry query、mutable raw branch/tag、未知GitHub API

禁止countはevidence fieldを信用せず、operation ID単位でaudit target scope/network classから独立導出する。
positive successでは全禁止countとdeny countが0である。

### TC-B1-L0R-004: 単一file dependency boundary

PowerShell sourceをtoken/ASTとimplementation reviewで確認する。

- package/module install、repository import、child process、dynamic code/eval、profile、ambient proxyを使わない。
- application network/filesystem callはreview済みadapter以外に存在しない。
- credential/header、absolute path、usernameをstdout、stderr、artifactへ出さない。
- synthetic test中のDNS/socket/real network invocation countは0。

source検査だけで安全性を断定せず、TC-B1-L0R-002..003のadapter probeも必須Greenとする。

### TC-B1-L0R-005: authority bundle、external exact copy、root/host gate

approved runner、request、binding、PowerShell 5.1 host hash/versionからauthority bundleを作る。

- external pathのhash segment、external copy bytes、repository reviewed/current hashが一致する。
- request/binding object/file hash、review対象path/hash/statusが一致する。
- host executable hash/full version、runner contract versionが一致する。
- authority bundleのpath identity、regular-file stat、read bytes、expected hashは同一core/adapter/auditで検証し、
  synthetic transcriptでもexact同順となる。pre-core direct stat/read/hashは0件。
- authority/request/binding/copyはcreate-newであり、同bytes再実行はno-op、同path異bytesはconflict。
- runner/host 1 byte変更、別PowerShell、repositoryからの直接load、process開始後repository accessを拒否する。
- `PILOT_LOCK_CURATION_ROOT`がrepository/workspace/PILOT_WORK_ROOTと同一、祖先、子孫、reparseの場合は
  directory作成前に拒否する。

**期待Red**: このcase群を持つ最初のtestはrunner未存在assertionだけでRedとなる。

## 5. L0 lock curation data-preparation gate

### TC-B1-L0-CURATION-001: exact request membershipとcandidate lock

approved runnerを使うreal L0のfrozen artifactを、runnerと別のreader/JCS/SHA/OpenPGP oracleで検査する。

- allowed hostsはexactに`api.github.com,nodejs.org,raw.githubusercontent.com,registry.npmjs.org`。
- nodejs/node main tip、release-keys main tip、immutable README、immutable keyring、release index、
  manifest、signature、win-x64 runtimeを各exact 1件持つ。
- npm metadata/tarballはtop-levelと全transitive/native dependency closureへexact 1対1。
- request ordinalは0始まり欠番なし、URL/host/length/hash/redirect 0/TLS verifiedがauditと一致する。
- candidate lockはwin32/x64/msvc、Node 24.14.1、pdfjs 6.3.289、canvas 1.0.6、
  exact artifact URL/length/SHA、npm SRIを持ち、placeholder/range/duplicateがない。
- candidate lock hashから`generationId=lock-${hash}`を作り、directory basenameと一致する。

このcaseだけがreal network artifactを読む。test runner自身はnetworkへ接続しない。

### TC-B1-L0-CURATION-002: Node trust rootと時刻規則

frozen GitHub response、README、keyring、release index、manifest、signatureだけを使う。

- commit evidenceのrepository full name/owner/SHAとraw URL commit segmentが一致する。
- READMEのRelease keys節が`nodejs/release-keys`を参照する。
- keyring hash/length、primary↔signing subkey binding、署名者tupleがtrust rootと一致する。
- detached signatureはそのkeyringだけでmanifestへ成功する。ambient keyring/keyserverは0回。
- release indexのv24.14.1 exact 1 recordからrelease dateを導出する。
- `primaryCreated <= subkeyCreated <= signatureCreated <= started <= finished`。
- signature UTC dateはrelease dateと一致し、signature時点でprimary/subkeyが期限内。
- finished以前のrevocationは署名前後を問わず拒否。署名後の単なるexpiryだけでは拒否しない。

mutationはunknown signer、self-generated key、commit/hash違い、README参照欠落、invalid signature、
future signature、release date違い、creation順違反、signature時点expiry、finished以前revocation、
revokedAt null偽装を1件ずつ拒否する。

### TC-B1-L0-CURATION-003: evidence/audit/inventory closure

全response bytes、trust root、candidate lock、evidence、auditを独立再hashする。

- audit requestとevidence requestは双方向1対1。
- evidence禁止countはauditから再導出してすべて0。
- owned finalsはresponse全件、trust root、lock、evidence、auditのexact集合でASCII順。
- inventory自身、temp、authority、他generationを含まない。
- authority/runner/audit final hash/trust root/lock/evidenceの全相互参照が一致する。
- completion inventoryは最後に公開される。

extra/missing/renamed response、同hash異bytes、inventory self inclusion、別generation混入、
禁止count自己申告の改変を拒否する。

### TC-B1-L0-CURATION-004: atomic publish、再実行、競合

- empty rootの1回目は`created`、同じcomplete generationの2回目はnetwork 0件で`unchanged`。
- metadata/keyring更新は別candidate hash/generationとなり、旧generationを変更しない。
- staging crash、owned temp、同basename異bytes、completion後欠落/不一致、late final差込みはfail closed。
- hardlink非対応、directory sync error、path identity変更はstable L0 reasonで停止する。
- candidate lockをrepositoryへ直接writeしない。独立review approved後だけexact copyを許す。

### TC-B1-L0-CURATION-005: repository lock promotion

reviewed candidate、repository copy、review対象hashの3者をbyte-for-byte比較する。
trust root/evidence/inventory/authority hashもEVIDENCEへ記録できる非機密値だけであることを確認する。
copy前後にrepositoryの他fileと外部generationは不変。placeholder、未承認review、hash違いではpromotion 0 byte。

L0 negativeは次のreasonを個別に固定し、別reasonへ丸めない。

```text
phase-b1-lock-curation-network-forbidden
phase-b1-lock-curation-authority-invalid
phase-b1-lock-curation-input-invalid
phase-b1-lock-curation-final-conflict
phase-b1-lock-curation-temp-present
phase-b1-lock-curation-hardlink-unsupported
phase-b1-lock-curation-directory-sync-failed
```

## 6. B0 exact toolchain bootstrap

### TC-B1-B0-001: lock strict validationとsynthetic acquisition

approved real lock bytesをtest fixtureとして読み、raw file hash literalをparse前に検査する。network adapterはlockの
artifactごとにfrozen synthetic response bytesを返す。

- B0 runtime repository readはlock 1件だけ。entrypoint自己read、directory走査、追加import、package resolutionを拒否。
- exact URL以外、metadata endpoint、host/path/query/port/redirect違いをdispatch前に拒否。
- response length/SHA、Node manifest hash、npm SRI SHA-512とtarball SHA-256の全てを検査してから展開。
- dependency artifact欠落/余分/重複、Node/package/version/platform/ABI違い、lifecycle scriptを拒否。
- synthetic testのreal network countは0。

### TC-B1-B0-002: toolchain treeとcanonical artifact

synthetic payload treeをrelative path ASCII順に独立列挙する。

- payload tree object hashは`SHA-256(JCS(payloadFiles))`。
- toolchain inventoryのNode/package exact version、lock source hash、B0 read allowlist 1件、network log hashが一致。
- completion markerはinventory object/file hash、network log、tree hashへ結合する。
- inventory/markerはpayload membership外、unknown package/fileを許さない。
- success summaryはcanonical 1行だけで、該当しないhash fieldはnull。

version mismatch、公開version mismatch、wrong backend、lock mutationは入力読取前またはoutput 0 byteで
`phase-b1-environment-invalid`/`phase-b1-toolchain-incomplete`となる。

### TC-B1-B0-003: atomicity、再実行、root isolation

fault oracleでstaging、environment directory、inventory、markerの全publish点を検査する。

- 1回目`created`、complete同入力2回目`unchanged`でwrite/network 0件。
- completion前crashでowned temp/stagingが残れば自動削除せず停止。
- markerなしのpublished environment、markerあり欠落/不一致、late-final race、link競合、path差替えは
  自動resumeせず、既存bytesを保持してfail closedとする。
- repository/workspace/Phase A final/PDF/LocalStorage sentinelは不変。

### TC-B1-B0-004: B0 CLIと実行前gate

CLI optionのmissing/duplicate/unknown/relative root/emptyを副作用前に拒否する。stdoutはcanonical summary 1行、
failure stderrはstable reason/fieldだけで、absolute path、username、stack、errno、credentialを含まない。

real B0の直前にCoordinatorはlauncher current hashをlatest approved implementation review hashへ、lock current hashを
approved lock review hashへ照合する。不一致時はprocessを起動せずnetwork 0件。test codeへlauncher hash literalを埋め込まない。

## 7. B1共通境界とcanonical contract

### TC-B1-COMMON-001: execution artifact gateとrepository 0-read

B1 entrypoint current hashはreal PDF/B1実行直前にlatest approved implementation reviewへ照合する。
test codeに未実装entrypoint hashを固定しない。process load後はrepository read/write/temp/cache/lock/logを0件とする。
entrypoint自己read、追加import、directory read、repository `node_modules`、symlink/reparseを拒否し、sentinel不変を確認する。

### TC-B1-COMMON-002: B1-only canonical JSON mutation registry

設計§4.1の各schemaについてpositive objectを1件ずつ作り、required欠落、unknown、wrong type、null、配列件数/順序、
relative path、file/object hash、owned-final membership、inventory self inclusion、JCS+LF違反を全fieldごとに生成する。
phase-b0 network、toolchain inventory/marker、source preparation、B1a/final inventory、command summary、
mask plan/head、active head/closureを含む。各negativeは修復、implicit sort、drop、default補完せず最初のfieldで拒否する。

同じregistryへL0専用artifactを別groupとして全て追加する。対象は次のstrict object/unionであり、
設計に記載されたnested objectも省略しない。

- runner review request、approval projection、approval binding、authority bundle
- network target、file target、bytes result、directory entry/list result、stat result
- allowed attempt、completed operation、denied attempt、audit entry union、audit log
- lock-curation request、evidence、owned-final、inventory
- Node release signer、Node release trust root
- acquisition artifactのNode/npm両branch、toolchain lock

duplicate-aware parser、test-local JCS/SHA oracleで、各object/branch/propertyについてrequired欠落、unknown、duplicate、
wrong type、明示null、union branchのproperty混在、enum/domain、配列exact件数・順序・重複、NFC、safe integer、
`NaN`/Infinity/`-0`、BOM、CRLF、末尾LF 0/2個、property順だけを変えた非canonical bytes、object/file hash違いを
個別に生成する。request ordinal、audit ordinal/operation pair、authorized signer tuple、artifact ordinal、owned-final pathは
規範順以外をimplicit sortせず拒否する。Node acquisition recordへnpm integrityを混ぜる、npm recordへNode signature fieldを
混ぜる、audit target/resultをoperationと異なるbranchへ替えるcaseも含める。

positiveはLFなしJCS object hashとJCS+LF file hashを独立再計算してliteral fixtureへ照合する。
negativeでは補完、property drop、branch推測、暗黙sort、null変換、parse後の再canonicalizeによる受理を禁止し、
最初のclass/reason/fieldとoutput 0 byteまたは既存state不変を検査する。

### TC-B1-COMMON-003: root、network、入力hash境界

- work rootはrepository/workspaceと同一・祖先・子孫・reparseを拒否。
- B1 process全期間でnetwork API/socket/network可能child process attempt 0件。試行時はfinal 0 byte。
- PDF、Phase A inventory/protocol/candidate/selection、locatorの固定hashをparse前に検査。
- 24 source ID joinのmissing/duplicate/unknown/page/ordinal違いを補完せず拒否。
- proxy、A/B vote、human final、画像特徴を匿名ID、mask、cropへ読むhookを設けない。

### TC-B1-COMMON-004: 全write経路のpath identity再検証

fault filesystemは、初回のroot/ancestor検証後かつ各`wx` temp作成直前、およびtemp検証後かつ
exclusive hardlink直前にcallbackを発火できる。次の全公開経路を別々に実行する。

- B1a page raster、source crop、source-preparation、initial revision/head、B1a inventory
- save-mask-draft revision、next head、各restricted preview
- B1b confirmed snapshot、restricted map、24 blinded PNG、manifest、2 batch table、final inventory
- active final closure、初回/next active head

各経路で、rootからtarget parentまでの各ancestor/componentを1つずつ、別identity directory、symlink、junction、
reparse point、repository内sentinelへの解決へ交換する。さらにexisting target/tempを別file identityまたはreparseへ交換する。
交換は「検査後・temp作成直前」と「temp再read/hash後・hardlink直前」の両時点で行う。

全caseで実装はancestor/component/file identityとcanonical pathを再検証する。ancestor/componentのidentity・canonical
path変更またはreparse化は`phase-b1-root-invalid <logical-path>`、検証済みimmutable final/output targetのidentity・bytes差替えは
`phase-b1-final-conflict <logical-path>`、mask next-headのlate占有は`phase-b1-draft-cas-conflict`、active next-headの
late占有は`phase-b1-active-final-cas-conflict`、その他のexclusive publish targetのlate占有は
`phase-b1-write-conflict <logical-path>`へ固定する。owned tempのreparse/identity差替えはroot-invalid、既存owned tempは
`phase-b1-temp-present <logical-path>`とし、別reasonへ丸めない。

失敗時は新しいcompletion inventory、mask head、active final headを公開せず、root外writeを0件とする。repository sentinel、
既存revision/head/final、unrelated external fileのpath、entry type、exact bytesは不変で、競合file、未知temp、
orphan finalを削除・rename・置換しない。権限上real junctionを作れないplatformでもskipせず、同じresolver/file-identity
adapter mutationを必須Greenとする。

## 8. B1a source preparation

### TC-B1-B1A-001: page rasterとhalf-open crop

4×3 synthetic pageを、pixel `(x,y)=[x,10+y,20+x+4y,255]`で固定する。
viewport transformを`[1,0,0,1,0,0]`、locator cornerを
`[(1.25,0.20),(2.25,0.20),(1.25,1.20),(2.25,1.20)]`とすると、
`floor(min)/ceil(max)`は`[1,0,3,2]`、cropは2×2で次の4 pixelとなる。

```text
[1,10,21,255], [2,10,22,255]
[1,11,25,255], [2,11,26,255]
```

test oracleは4 corner全てをbinary64計算し、row `[x0,x1)`を`y0..y1-1`でcopyする。
別rounding、clamp、padding、rotation追加、flip、interpolation、bottom-up、big-endian寸法を個別に拒否する。
実装rendererを期待値生成に使わない。

### TC-B1-B1A-001A: renderer exact environment/configuration

renderer spyはPDF bytesを読ませる前に、環境検査値とrendererへ渡す設定objectを記録する。positiveは次のliteralと
binary64 bit patternまで完全一致させる。

| field | expected |
|---|---|
| Node runtime | `24.14.1` |
| installed/public PDF.js version | `6.3.289` / `6.3.289` |
| installed/public canvas backend version | `1.0.6` / `1.0.6` |
| DPI / viewport scale | `600` / binary64 `25/3`（`600/72`と同じ64-bit値） |
| page box | PDF crop box |
| page rotation | PDF page rotationをそのまま尊重し、追加rotation 0 |
| rendering intent | `display` |
| annotation / worker | disabled / disabled |
| system fonts / eval | `false` / `false` |
| background | exact RGBA `[255,255,255,255]` |
| color / pixel layout | sRGB / RGBA8 straight alpha |
| origin / row order | top-left / top-to-bottom |

test-local literal oracleは設定objectを実装helperからimportせず直接構築する。DPI 599/601、scaleをdecimal丸めした値、
media box、rotation無視/二重適用、print intent、annotation/worker有効、system fonts/eval true、transparent/別white、
別color space、BGRA/premultiplied alpha、bottom-left/bottom-up、Node/package/public/backend versionの各1 field mutationを
別々に注入する。全mutationはPDF file read、renderer call、output directory作成より前に
`RangeError('phase-b1-environment-invalid <field>')`となり、PDF read count 0、renderer invocation 0、output 0 byte、
既存sentinel不変である。installed versionだけ正しくpublic versionだけ違うcaseと、その逆も個別に含める。

### TC-B1-B1A-002: 24 selection bindingとsource preparation

SYN-PILOT-24のselection ordinalから`img-001..024`を導出し、source crop filenameはsource ID、匿名IDはordinalだけから作る。

- page 11..14を各1回だけrasterize。
- raster 4件、crop 24件をexact生成し、source ID ASCII順でsource-preparationへ記録。
- width/height、viewport tuple、bounds、file/RGBA hashをoracle再計算値へ一致。
- page/source ID/条件を匿名IDへ符号化しない。
- locatorやselection順1 byte mutation、renderer extra page/read、24外cropを拒否。

### TC-B1-B1A-003: initial mask revisionと31 final completion

initial planは24 entry exact順、rectangle 0件、provenance none、draft、4 checks false、role/time nullとする。
revision basenameはfile hash。generation 0 headはprior nullでrevisionを指す。

B1a inventory owned finalsは4 raster+24 crop+source-preparation+initial revision+initial headの31件exact集合。
preview、後続revision/head、inventory自身を含めない。31 predecessorの再検証後にinventoryを最後へ公開する。

### TC-B1-B1A-004: prepare-source atomicityと再実行

empty rootは`created`、全exact finalの再実行は`unchanged`、marker前crashかつtempなしは不足分だけ`resumed`。
existing final異bytes、marker後欠落/不一致、temp orphan、late-final raceは上書きせず停止する。
4 raster、24 crop、initial revision/headのいずれのpublish点でもfault injectionする。

## 9. mask plan、human confirmation、preview

### TC-B1-MASK-001: editable/confirmed validation matrix

24 entry bindingを保ったまま、次を独立検査する。

| state | rectangles | checks | role/time | provenance | expected |
|---|---:|---|---|---|---|
| draft | 0 | mixed | null/null | none | editable受理 |
| draft | 1+ | mixed | null/null | operator/machine accepted/edited | editable受理 |
| confirmed | 1+ | all true | human role/valid UTC | non-none | editable/confirmed受理 |
| confirmed | 0 | all true | human role/valid UTC | none | 拒否 |
| confirmed | 1+ | one false | human role/valid UTC | non-none | 拒否 |
| draft | any | any | nonnull | any | 拒否 |

fractional/non-Z/offset/leap second/不実在UTC、wrong role、unknown provenance、0 rectangle+non-none、
1+ rectangle+none、0幅/負/範囲外/重複、source hash/寸法/ID/order違い、note>300/非NFC/個人情報fixtureを拒否する。
APIは時刻、check、provenanceを補完・推測しない。

### TC-B1-MASK-002: canonical revision、head CAS、no-op

- property順/whitespaceだけ異なる等価candidateは同じcanonical revision hashとなる。
- active hashとexpected prior一致時だけ次generation headを公開。
- stale expected、fork、欠番、basename/hash違い、generation 100000000、同generation並行writerを拒否。
- 同じrevisionは新headを作らず`unchanged`。既存revision/head exact bytes/mtime不変。
- head前crashのunreferenced revisionはstateを変えず、同candidate retryで再利用。
- orphan temp、head後revision欠落、chain異常を自動修復・削除しない。

### TC-B1-MASK-003: previewと人間境界

3×2 fixtureと既存`TC-PILOT-DERIVATIVE-001`のliteralを使い、previewのmask内gray、外側bit一致、canonical PNGを検査する。
preview pathはrevision hash/source IDを含むrestricted pathだけで、final/actor inputへ混入しない。

machine suggestionはrectangle/provenanceまでを許すが、status confirmed、check true、role/timeの自動生成を拒否する。
機械testは「文字が読めない」「結晶へ重ならない」を画像から推測せず、24件の人間入力fieldの整合だけを検査する。

### TC-B1-MASK-004: save-mask-draft CLI isolation

candidateはinbox直下regular fileだけを許し、relative escape、subdirectory、symlink/reparseを拒否。
stdout summary/stderr redaction、toolchain hash、repository 0-read、network 0件を確認する。

## 10. B1b blinded final generation

### TC-B1-B1B-001: 24/24 confirmation gateとstale head

positiveはactive tipが指すcanonical revisionで24 entry全てconfirmed、rectangle 1+、4 checks true、role/UTC有効、
source crop hash/寸法一致とする。1 entryずつdraft、check false、role/time null/invalid、crop hash staleを作り、
`phase-b1-mask-unconfirmed <img-NNN>`、final output 0 byteを確認する。

specified revisionとtip不一致、head fork/欠番/hash違いを拒否する。validation中またはcompletion直前に新headを追加する
raceでは`phase-b1-draft-cas-conflict`となり、generation completionを公開しない。

### TC-B1-B1B-002: blinded pixelsとcanonical PNG

既存`TC-PILOT-DERIVATIVE-001`の3×2 fixture、期待RGBA hash
`ce498a4c03778d930ccd0fb7c8d131354411078735b91921825efd511d94d7a8`、
PNG hash`facaaab2f65212b4f83f6ff6201e11cb802bb04b0ff1a8b5003bfe0a0578891c`、94 byteを完全一致させる。

- rectangle内は`[127,127,127,255]`、外側はbit-for-bit同一。
- decode後寸法/RGBA/file hashを別経路で検査。
- ancillary chunk、filter非0、compressed DEFLATE、複数IDAT、bad CRC/Adler、別codecを拒否。
- crop/padding/rotation/flip/interpolation/生成補完/匿名ID描画を拒否。

stored DEFLATE 65535/65536/131071 primitiveとPNG境界literalは既存caseをそのままGreenに保つ。

### TC-B1-B1B-003: manifest/map/batchと非漏洩

- final generation IDは`phase-b1-${confirmedRevisionFileSha256}`のfull lowercase hash。
- blinded PNG 24件は`img-001..024.png`、manifestは同順、batchはordinal 0..11/12..23各12件。
- restricted mapだけがsource ID/page/locator/source crop/rasterへ結合。
- manifest/PNG/batchへsource ID、page、条件値、proxy、A/B、人間final、note、absolute path等を含めない。
- Phase A schemaへB1-only fieldを追加しない。
- batch tableはmanifest object hashと同じfile/RGBA hashへ結合する。

禁止property、anonymous IDへのP11/source ID/条件埋込み、map/manifest pair欠落、batch重複/順序違いを拒否する。

### TC-B1-B1B-004: final inventory exact membershipとresume

frozen owned finalsは24 PNG+manifest+2 tableの27件、restrictedはconfirmed snapshot+mapの2件。
inventory自身、head、closure、preview、他generationを含めない。confirmed snapshotは入力revisionとexact bytes/file hash同一。

empty generationは`created`、全exact再実行は`unchanged`、inventory前crashかつtempなしは不足分だけ`resumed`。
inventory後欠落/不一致、existing final conflict、late mutation、temp orphanは旧bytesを保持して停止する。

## 11. active generation、replacement、upload resolver

### TC-B1-ACTIVE-001: 初回headと一意tip

初回headはgeneration 0、prior head/final/closure nullで、完成inventoryとrevision hashを指す。
head basename、JCS+LF、file hashを検査する。fork、欠番、unknown prior、hash mutation、複数highest headではactiveを推測しない。

### TC-B1-ACTIVE-002: replacement closureと二重CAS

別confirmed revisionから別full-hash generationを完成させ、旧active、新inventory、reason、timeを持つclosureを先に公開し、
next headをexclusive publishする。

- current mask headとactive final headの両expected hashをpublish直前に再検査。
- winnerだけがactive。CAS loserのcomplete generation/closureはinactive/inertで旧activeをcloseしない。
- effective closureは旧generationのupload適格性だけをcloseし、旧artifactを削除・変更しない。
- retryは新current headを明示し、既存generationを全再検証してからactivation。

### TC-B1-ACTIVE-003: replacement crash/race matrix

generation完成前後、inventory後、closure後、head前後へfaultを注入する。
old activeはnew head成功まで変わらず、unreferenced closureは無効、fixed convenience path/symlink/copyは0件。
同時2 writer、late head変更、inventory mutationを個別に拒否する。

### TC-B1-ACTIVE-004: materialize/upload resolver

resolverは一意なactive tip、closure chain、final inventory、全owned finalを毎回再hashする。
active generationのmanifest順とbatch slotだけを返し、inactive/closed/fixed pathを拒否する。

upload直前head変更、file/RGBA hash、width/height、MIME、slot、preview evidence違いはrun全体を拒否する。
機械testは外部送信を実行せず、`uploadAuthorized=false`のまま解決結果までを検査する。
初回外部送信には別途ユーザー明示確認が必要であり、本caseのGreenを承認とみなさない。

## 12. CLI、failure reason、情報漏洩

### TC-B1-CLI-001: argument matrixとsummary

B1 CLI各commandについてmissing/duplicate/unknown option、relative/overlapping root、不正hash、empty、candidate escapeを
副作用前に拒否する。success stdoutは`PhaseB1CommandSummaryV1`のJCS+LF 1行だけ。

- bootstrap/prepare: 対応inventory hashだけnon-null
- save: revision hashだけnon-null
- finalize: generation/revision/inventory hash全てnon-null
- statusはcommand contractに従う`created|resumed|unchanged`

stderrは設計のstable reasonとlogical fieldだけ。stdout/stderr/artifactにabsolute path、drive、username、credential、
stack、errno、source ID（summary）を含めない。

### TC-B1-CLI-002: stable failure registry

少なくとも次を各1回発生させ、RangeError/TypeError、reason、field、既存state不変を検査する。

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

L0固有reasonはL0 case群で別途検査し、B1 reasonへ丸めない。

## 13. test-code構成とgate evidence

### TC-B1-RED-001: B0/B1 implementationの単一expected Red

approved lockをrepositoryへ固定し、全test fixture、oracle、型検査が有効な状態で、test case先頭に次の
単一object assertionを置く。

```text
actual   = {bootstrap: exists(B0 launcher), images: exists(B1 implementation)}
expected = {bootstrap: true, images: true}
```

一方でもfalseならdynamic import、PowerShell/Node child process、filesystem write、network、PDF rendererを実行しない。
このassertion failureだけをB0/B1実装前のexpected Redとする。module-not-found、syntax/type error、lock/schema/hash error、
permission、environment、timeoutはRedとして認めない。Green時は同じtest suiteで本書の全synthetic caseを実行する。

### 13.1 file分割境界

test codeは少なくとも次を分離し、implementation moduleからoracleをimportしない。

- L0 runner test/oracle
- L0 frozen artifact independent validator
- B0/B1 test/oracle
- synthetic filesystem/network/renderer/clock fault adapters
- approved lock exact fixtureまたはraw exact copy

L0 real artifact、PDF、実画像を通常test fixtureへcopyしない。approved lockだけは設計どおりrepository test inputとなる。

### 13.2 evidence

Coordinatorは次を`EVIDENCE.md`へ記録する。

- baseline Greenと既知のT1-7 pending final artifact failures
- L0 runner test review、expected Red、Green、implementation review、runner hash
- L0 authority request/binding/runner/host hash、real request count/hosts、trust root/lock/evidence/inventory hash、独立review
- B0/B1 test review、単一expected Red、test commit
- B0/B1 Green、execution artifact gate hash、implementation review
- real B0/PDF実行のexact toolchain/PDF/artifact hashと件数
- 24/24 mask human confirmationは人間が実施した後だけ記録
- 外部uploadはユーザー明示確認前は未実施

### 13.3 traceability

| contract | cases |
|---|---|
| L0 runner process/core、review binding、authority、audit | TC-B1-L0R-000..005 |
| L0 request、trust root、lock、atomic curation | TC-B1-L0-CURATION-001..005 |
| B0 exact toolchain、network、inventory | TC-B1-B0-001..004 |
| execution hash/repository/network/input/path-identity boundary | TC-B1-COMMON-001..004 |
| renderer exact config、raster/crop/source completion | TC-B1-B1A-001, TC-B1-B1A-001A, TC-B1-B1A-002..004 |
| mask validation、CAS、preview、人間境界 | TC-B1-MASK-001..004 |
| blinded derivative、artifact、inventory | TC-B1-B1B-001..004 |
| active replacement、resolver、upload前停止 | TC-B1-ACTIVE-001..004 |
| CLI/error/redaction | TC-B1-CLI-001..002 |
| B0/B1単一expected Red | TC-B1-RED-001 |

## 14. 完了条件

Phase B1のtest-case gateは、次を全て満たす場合だけ通過する。

1. 本書の独立reviewが`approved`。
2. L0 runner mini-cycleを独立Red/Green/reviewとして実行できる。
3. L0 candidate lockを実network testと混同せず、外部root frozen artifactの独立reviewで固定できる。
4. B0/B1 testはapproved lockを固定後、entrypoint未存在だけの単一expected Redにできる。
5. 通常testのreal network/PDF/実画像アクセスが0件。
6. 24/24人間確認と外部AI送信前確認を自動化・代行・推測しない。
7. test実装で新しい要件、許容範囲、物理判定を追加しない。

各画像のmask rectangle座標はB1a後の人間実行dataであり、本書の期待値として固定しない。
