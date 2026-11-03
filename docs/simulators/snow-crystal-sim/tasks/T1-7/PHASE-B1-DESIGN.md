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

この前提として、画像を読まない独立 Stage **L0 curate-toolchain-lock** で供給元lockを先に凍結し、
Stage **B0 bootstrap-toolchain** でそのlockだけに従ってexact toolchainを外部rootへ準備する。
L0/B0は画像準備ではなく供給元確認と環境provisioningであり、外部AI通信ではない。

## 2. 信頼境界と保存先

画像準備で使う唯一の作業 root を repository 外の絶対 path `PILOT_WORK_ROOT` とする。
repository root、workspace root、その祖先・子孫、symlink、junction、reparse point を root または
owned path に使わない。実装は既存 ancestor から各 path component を `lstat` / canonical path /
file identity で検査し、検査後の差替えを fail closed にする。

L0だけは別の絶対 path `PILOT_LOCK_CURATION_ROOT` を使う。このrootもrepository、workspace、
`PILOT_WORK_ROOT`のいずれとも祖先・子孫関係を持たず、同じreparse/file identity検査を通す。
L0以外はこのrootへread/writeせず、L0は`PILOT_WORK_ROOT`へread/writeしない。

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

PILOT_LOCK_CURATION_ROOT/
  authority/
  staging/
  generations/
```

既存の Phase A final、`restricted/source/`、`restricted/selection/`、その他の無関係な外部 file/directory は
read-only とし、削除・rename・上書き・一括 cleanup しない。repository、LocalStorage、source-audit UI、
production corpusへのwriteを禁止する。repositoryは全pathについてwrite、temp、cache、lock、log、生成物作成を禁止し、
process loadは§2.1のexecution artifact gate、それ以後のapplication readは同節のruntime allowlist以外を
fail closedとする。LocalStorage、source-audit UIはread/writeとも禁止する。

`tooling/phase-b1/` は data-preparation 専用で、manifest、restricted map、hash preimage、actor input、
evidenceへ絶対 path、drive letter、username、package cache pathを入れない。networkを使う取得はL0とB0だけに
分離し、通常testとB1a/B1bの実行中はoffline強制かつnetwork callを0件にする。

### 2.1 repository read allowlist

repository fileの検証を、process起動前の**execution artifact gate**と、process起動後の
**runtime read allowlist**に分離する。OS/PowerShell/Nodeがentrypointをprocess imageへ読み込む処理は前者、
entrypoint開始後にapplication codeが明示的に行うfile readは後者に属する。

execution artifact gateの対象は次の3 fileである。

| logical role | repository-relative path | hashを固定する工程 |
|---|---|---|
| B0 reviewed launcher | `apps/snow-crystal-sim/tests/calibration/bootstrap-morphology-pilot-toolchain.ps1` | implementation review後 |
| B1 reviewed launcher/implementation | `apps/snow-crystal-sim/tests/calibration/prepare-morphology-pilot-images.mjs` | implementation review後 |
| B0 platform acquisition lock | `apps/snow-crystal-sim/tests/calibration/phase-b1-toolchain-lock.json` | test-code review前 |

B0/B1 entrypointの最終file SHA-256を未実装時のTESTCASES/test codeへliteral固定しない。実装レビューが
`approved`となった時点のreviewed file hashをCoordinatorが`EVIDENCE.md`へ記録し、実PDFまたは実networkを使う
各commandの直前にrepositoryの現在bytesを再hashして一致を要求する。不一致、未承認hash、review後の変更では
processを起動しない。このhashをentrypoint自身へ埋め込んだり、entrypointに自身を再読込・自己hash検証させたり
しない。したがって自己参照hashも、実装後に承認済みtest codeを書き換える循環も生じない。

Phase B1のB0/B1 entrypointは各1 fileで完結させ、repository内の分割moduleをimportしない。process起動後の
runtime repository read allowlistは、B0ではtest-code工程で先に凍結した
`phase-b1-toolchain-lock.json` 1 fileだけ、B1a/B1b/save-mask-draftでは空集合とする。B0 test codeはlockの
pathとfile SHA-256をliteral `RepositoryReadAllowlistV1`として固定できる。未確定hash、hash不一致、追加import、
directory走査、package resolution、entrypoint自身の明示的再読込、symlink/reparse、allowlist外readを
`phase-b1-repository-read-forbidden`で入力読取前に拒否する。将来分割moduleが必要になった場合は本設計と
test caseを再レビューするまで追加しない。

testはentrypointのload自体をspy対象にせず、load完了後のapplication filesystem adapterをspyする。
repository内の全write/temp/cache/lock/log生成を拒否し、B0では上記lock以外のreadを、B1では全repository readを
拒否する。実行前execution artifact gateはtest内の自己hash検査ではなく、review/EVIDENCEと現在bytesを比較する
Coordinator gateとして別に検証する。

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

### 3.1 Stage L0 curate-toolchain-lock

#### 3.1.0 L0 execution authority

L0を自己申告scriptとして実行しない。L0より前に、lockを必要としない単一fileの
`curate-morphology-pilot-toolchain-lock.ps1`を通常workspaceのhost Windows PowerShellだけで実行できる
**L0 curation runner**として、独立したtest-first mini-cycleで作る。このmini-cycleは
TESTCASES/test code review、runner未存在だけのexpected Red、実装、Green、implementation reviewの順とし、
Phase B1のB0/B1 entrypoint実装より先に完了する。runnerはpackage/module install、repository module import、
child process、dynamic code generation/eval、profile、ambient proxy設定を使わず、単一file内のreview済み
network/filesystem/audit adapter以外からapplication I/Oを行わない。したがってrunnerの作成・test・reviewは
Node/npm acquisition lockへ依存せず、lockを作るためにlockが必要となる循環を生じない。

##### 3.1.0.1 runner process、core、adapter 契約

runnerの単一file内で、判断・artifact組立てを行う唯一のcoreを`Invoke-PhaseB1L0Core`、production adapter生成を
`New-PhaseB1L0ProductionAdapters`、test transcript adapter生成を`New-PhaseB1L0TranscriptAdapters`と命名する。
`Invoke-PhaseB1L0Core`が受け取るadapter集合は次の6操作だけを持つ。

```text
UtcNow() -> UtcSeconds
NetworkRequest(PhaseB1L0NetworkTargetV1) -> bytes + redirectCount + tlsOutcome
FileRead(PhaseB1L0FileTargetV1) -> bytes
FileWrite(PhaseB1L0FileTargetV1, bytes) -> accepted written bytes
FileList(PhaseB1L0FileTargetV1) -> PhaseB1L0DirectoryEntryV1[]
FileStat(PhaseB1L0FileTargetV1) -> PhaseB1L0StatResultV1 without resultObjectSha256
```

`FileWrite`はrunnerが要求するcreate-new temp、flush/fsync、別read、exclusive publish、parent sync、temp unlink、
second parent syncを含む
単一のreview済みfilesystem adapter境界であり、成功completeはdurable publication後だけ返る。内部failure pointは
`before-temp|after-temp-write|after-temp-sync|after-reread|before-exclusive-publish|after-exclusive-publish|after-first-parent-sync|after-temp-unlink|after-second-parent-sync`
としてsynthetic transcriptから注入できる。coreはOS、network、clock APIを直接呼ばず、productionとtestは同じ
`Invoke-PhaseB1L0Core`を使う。adapter自身をartifact生成、署名・hash oracle、policy判断の代替にせず、coreが
§3.1〜§3.1.1の検証、audit entry、evidence、inventory、summary/errorを生成する。

production CLIは次のexact形だけを受理する。

```text
<WINDOWS_POWERSHELL_5_1> -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass \
  -File <EXTERNAL_REVIEWED_RUNNER> \
  -Operation curate \
  -CurationRoot <absolute PILOT_LOCK_CURATION_ROOT> \
  -AuthorityBundleFile <absolute authority bundle JSON> \
  -ExpectedAuthorityBundleFileSha256 <64 lowercase hex>
```

`-Operation`を含むscript parameterはASCII case-sensitive、記載順、各1回だけとする。欠落、重複、未知parameter、
positional argument、`--`、empty valueをadapter生成前に拒否する。adapter生成前に許す処理はraw CLI tokenの構文検査と、
stdinがredirectされているかのhost property確認だけであり、path解決、stat、read、hash、identity検査を含むfilesystem/
network/clock dispatchは0件とする。`curate`ではredirected stdinを内容・長さによらずargument-invalidとして拒否し、
stdin bytesを読まない。console stdinも読まず空入力として扱う。environment variable、
PowerShell profile、ambient proxy、pipeline object、test hookからargumentやadapterを
補完しない。`New-PhaseB1L0ProductionAdapters`はI/Oを行わずdelegateだけを生成する。生成後、
`Invoke-PhaseB1L0Core`がproduction adapterの`FileStat`/`FileRead`だけを通して`CurationRoot`と
`AuthorityBundleFile`の§2/§3.1.0 canonical path・identity・descendant規則、regular-file bytes、expected hashを検査する。
これらのattempt/completeはaudit chainの先頭に入り、synthetic probeでも同じstat/read stepを必須とする。
authority検査前のdirect filesystem dispatch、pre-core bootstrap read/hash、別実装pathを禁止する。

通常testはreview前のrepository runnerを次のexact形で別processとして起動する。

```text
<WINDOWS_POWERSHELL_5_1> -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass \
  -File <REPOSITORY_RUNNER> -Operation synthetic-probe -ProtocolVersion 1
```

`synthetic-probe`はstdinのUTF-8 BOMなしJCS+LF exact 1 objectだけを読み、stdoutへresponse 1 objectを返す。
`-CurationRoot`、`-AuthorityBundleFile`、`-ExpectedAuthorityBundleFileSha256`、production filesystem/network/clock、
environment由来のadapter、追加stdin bytesを使わない。反対に`curate`は`-ProtocolVersion`とsynthetic requestを受理しない。
したがってtest adapterをproduction operationへ注入できない。synthetic request/responseはtest専用でartifact、authority、
review evidence、L0 completionとして保存・昇格してはならない。

```ts
interface PhaseB1L0CurateArgumentsV1 {
  readonly curationRoot: string; // absolute path。response/artifactへは出力しない
  readonly authorityBundleFile: string; // curationRoot/authority内のabsolute regular-file path
  readonly expectedAuthorityBundleFileSha256: Sha256Hex;
}

type PhaseB1L0SyntheticAdapterOperationV1 =
  | 'utc-now' | 'network-request' | 'file-read' | 'file-write' | 'file-list' | 'file-stat';

interface PhaseB1L0SyntheticBytesOutcomeV1 {
  readonly kind: 'bytes';
  readonly bytesBase64: string; // RFC 4648 canonical base64、padding必須
  readonly redirectCount: number | null; // networkだけ0、それ以外null
  readonly tlsOutcome: 'verified' | null; // networkだけverified、それ以外null
}

interface PhaseB1L0SyntheticClockOutcomeV1 {
  readonly kind: 'utc';
  readonly value: UtcSeconds;
}

interface PhaseB1L0SyntheticDirectoryOutcomeV1 {
  readonly kind: 'directory-list';
  readonly entries: readonly PhaseB1L0DirectoryEntryV1[];
}

interface PhaseB1L0SyntheticStatOutcomeV1 {
  readonly kind: 'stat';
  readonly value: Omit<PhaseB1L0StatResultV1, 'resultObjectSha256'>;
}

interface PhaseB1L0SyntheticWriteOutcomeV1 {
  readonly kind: 'write';
  readonly disposition: 'accepted' | 'error';
  readonly failurePoint:
    | 'none' | 'before-temp' | 'after-temp-write' | 'after-temp-sync'
    | 'after-reread' | 'before-exclusive-publish' | 'after-exclusive-publish'
    | 'after-first-parent-sync' | 'after-temp-unlink' | 'after-second-parent-sync';
  readonly errorCode:
    | 'access-denied' | 'identity-changed' | 'reparse-found' | 'already-exists'
    | 'hardlink-unsupported' | 'directory-sync-failed' | null;
}

interface PhaseB1L0SyntheticErrorOutcomeV1 {
  readonly kind: 'error';
  readonly code:
    | 'clock-failed' | 'not-found' | 'access-denied'
    | 'identity-changed' | 'reparse-found' | 'network-failed' | 'tls-failed';
}

interface PhaseB1L0SyntheticAdapterStepV1 {
  readonly ordinal: number; // 0始まり、欠番なし
  readonly adapter: 'clock' | 'network' | 'filesystem';
  readonly operation: PhaseB1L0SyntheticAdapterOperationV1;
  readonly expectedTarget: PhaseB1L0NetworkTargetV1 | PhaseB1L0FileTargetV1 | null;
  readonly expectedInputFileSha256: Sha256Hex | null; // file-writeだけnon-null
  readonly expectedInputByteLength: number | null; // file-writeだけnon-null
  readonly outcome:
    | PhaseB1L0SyntheticBytesOutcomeV1
    | PhaseB1L0SyntheticClockOutcomeV1
    | PhaseB1L0SyntheticDirectoryOutcomeV1
    | PhaseB1L0SyntheticStatOutcomeV1
    | PhaseB1L0SyntheticWriteOutcomeV1
    | PhaseB1L0SyntheticErrorOutcomeV1;
}

interface PhaseB1L0SyntheticProbeRequestV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-l0-synthetic-request/1';
  readonly protocolVersion: '1';
  readonly arguments: PhaseB1L0CurateArgumentsV1;
  readonly steps: readonly PhaseB1L0SyntheticAdapterStepV1[];
}

interface PhaseB1L0SyntheticPublishedFileV1 {
  readonly logicalPath: string;
  readonly bytesBase64: string;
  readonly fileSha256: Sha256Hex;
  readonly byteLength: number;
}

interface PhaseB1L0SyntheticFileStateV1 {
  readonly logicalPath: string;
  readonly state: 'temp' | 'final';
  readonly bytesBase64: string;
  readonly fileSha256: Sha256Hex;
  readonly byteLength: number;
}

interface PhaseB1L0SyntheticProbeResponseV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-l0-synthetic-response/1';
  readonly protocolStatus: 'completed';
  readonly simulatedExitCode: number;
  readonly simulatedStdoutLine: string | null;
  readonly simulatedStderrLine: string | null;
  readonly consumedStepCount: number;
  readonly remainingStepCount: 0;
  readonly networkDispatchCount: number;
  readonly filesystemDispatchCount: number;
  readonly filesystemFiles: readonly PhaseB1L0SyntheticFileStateV1[];
  readonly publishedFiles: readonly PhaseB1L0SyntheticPublishedFileV1[];
  readonly auditLog: PhaseB1L0AuditLogV1 | null;
}
```

stepのadapter/operation/target/outcome branchはexact対応させる。`utc-now`はclock/null target/utc、networkは
network/network target/bytes、file-readはfilesystem/file target/bytes、file-writeはfilesystem/file target/write、
file-listはfilesystem/file target/directory-list、file-statはfilesystem/file target/statだけを許す。
network bytesだけが`redirectCount=0,tlsOutcome='verified'`、file-read bytesは両field nullである。
generic errorはutc-now=`clock-failed`、network=`network-failed|tls-failed`、file-read/list/stat=
`not-found|access-denied|identity-changed|reparse-found`だけを許し、file-writeでは禁止する。したがってutc outcomeへTLS、
file outcomeへnetwork errorなど、operationに意味のない組合せをstrict schemaで拒否する。
write outcomeは次表の組だけを許す。`accepted`は`none/null`、`error`は表のnon-none/non-null pairである。

| failurePoint | 許可errorCode | failure後のfilesystemFiles | publishedFiles |
|---|---|---|---|
| `before-temp` | `access-denied|identity-changed|reparse-found|already-exists` | 新規0件 | 新規0件 |
| `after-temp-write` | `access-denied|identity-changed` | tempのみ | 新規0件 |
| `after-temp-sync` | `access-denied|identity-changed` | tempのみ | 新規0件 |
| `after-reread` | `identity-changed` | tempのみ | 新規0件 |
| `before-exclusive-publish` | `already-exists|identity-changed|reparse-found|hardlink-unsupported` | tempのみ | 新規0件 |
| `after-exclusive-publish` | `identity-changed|directory-sync-failed` | temp＋final | finalのみ |
| `after-first-parent-sync` | `access-denied|identity-changed` | temp＋final | finalのみ |
| `after-temp-unlink` | `identity-changed|directory-sync-failed` | finalのみ | finalのみ |
| `after-second-parent-sync` | `identity-changed` | finalのみ | finalのみ |

file-write以外のexpected input 2 fieldはnull、file-writeではcoreが渡したbytesの
hash/lengthとexact一致させる。adapterは次のstepとoperation/target/inputが一致した場合だけconsumeし、不一致、step枯渇、
未消費stepはprobe protocol errorとする。test responseのfilesystem filesはfailure後を含むin-memory stateを
`logicalPath,state` ASCII tuple順でexact列挙し、published filesはそのうちfinalだけをlogical path ASCII順で列挙する。
両配列のbytes/hash/lengthを一致させ、absolute path、credential、usernameを含めない。

network/filesystem adapterがdispatchされたoperationはallow attemptに続いてcompleteを必ず1件持つ。success resultだけでなくadapter errorも
下記`PhaseB1L0AdapterErrorResultV1`をcomplete resultとするため、失敗runにもunpaired attemptを残さない。error completeを
1件でも含むrunはsuccess summary/evidence/inventoryを公開しない。denyは従来どおりdispatch 0件、complete 0件である。
`UtcNow`はaudit I/O unionの対象外であり、`clock-failed`では新しいaudit entryを作らず、既存chainがあればその末尾までを保持する。
file-write error後のstdoutは0 byte、stderrはerror 1行で、completion inventoryは常に未公開とする。late failureで
finalが存在してもそれは未完成generationのimmutable predecessorであり、次回はexact bytesを再検証してresumeするか
conflictで停止し、自動削除・上書きしない。

| adapter error | stable reason / exit |
|---|---|
| `clock-failed` | `phase-b1-lock-curation-internal-error` / `70` |
| `network-failed|tls-failed` | `phase-b1-lock-curation-input-invalid` / `11` |
| authority/curation-rootの`not-found|access-denied|identity-changed|reparse-found` | `phase-b1-lock-curation-authority-invalid` / `11` |
| file-write `already-exists` | `phase-b1-lock-curation-final-conflict` / `12` |
| file-write `hardlink-unsupported` | `phase-b1-lock-curation-hardlink-unsupported` / `13` |
| file-write `directory-sync-failed` | `phase-b1-lock-curation-directory-sync-failed` / `13` |

valid synthetic requestでは、simulated curateが成功・契約エラーのどちらでもhost process自体はexit 0、stderr 0 byte、
stdoutは`PhaseB1L0SyntheticProbeResponseV1`のJCS+LF 1行だけとする。`simulatedStdoutLine`/
`simulatedStderrLine`にproduction CLIと同じ結果を格納する。request parse/schema/JCS、transcript対応、response構築に失敗した
probe自体はhost exit 2、stdout 0 byte、stderrへ下記error 1行だけを出し、real network/filesystem dispatchを0件とする。

```ts
interface PhaseB1L0CommandSummaryV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-l0-command-summary/1';
  readonly operation: 'curate-toolchain-lock';
  readonly status: 'created' | 'unchanged';
  readonly generationId: `lock-${Sha256Hex}`;
  readonly candidateLockFileSha256: Sha256Hex;
  readonly curationInventoryFileSha256: Sha256Hex;
  readonly auditLogFileSha256: Sha256Hex;
  readonly auditFinalEntrySha256: Sha256Hex;
}

interface PhaseB1L0CommandErrorV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-l0-command-error/1';
  readonly status: 'error';
  readonly operation: 'curate-toolchain-lock' | 'synthetic-probe';
  readonly reason:
    | 'phase-b1-lock-curation-argument-invalid'
    | 'phase-b1-lock-curation-probe-invalid'
    | 'phase-b1-lock-curation-network-forbidden'
    | 'phase-b1-lock-curation-authority-invalid'
    | 'phase-b1-lock-curation-input-invalid'
    | 'phase-b1-lock-curation-final-conflict'
    | 'phase-b1-lock-curation-temp-present'
    | 'phase-b1-lock-curation-hardlink-unsupported'
    | 'phase-b1-lock-curation-directory-sync-failed'
    | 'phase-b1-lock-curation-internal-error';
  readonly field: string | null; // logical fieldだけ。path、URL、errno、stackは禁止
}
```

production successはexit 0、stdoutにsummary JCS+LF 1行、stderr 0 byteとする。failureはstdout 0 byte、stderrにerror
JCS+LF 1行だけとし、exit codeはargument/probe=`2`、network forbidden=`10`、authority/input=`11`、
final conflict/temp=`12`、hardlink/directory sync=`13`、unexpected internal=`70`へ固定する。internal errorは
`field=null`とし、例外message、path、URL、errno、stackを出さない。productionとsynthetic simulated resultの
summary/error bytesおよびexit codeは同一core inputに対してexact一致しなければならない。

implementation reviewが`approved`としたrunnerのrepository-relative path、file SHA-256、canonical approval binding、
host Windows PowerShellの`powershell.exe` file SHA-256と`5.1` full version、runner contract versionを
Coordinatorが`PhaseB1L0AuthorityBundleV1`へ固定する。Coordinatorはreviewed runner bytesを
`PILOT_LOCK_CURATION_ROOT/authority/<runnerFileSha256>/curate-morphology-pilot-toolchain-lock.ps1`へ
create-new copyし、copy bytes/hash、authority bundle、host runtime hashを再検証してからだけprocessを起動する。
repositoryからのrunner loadは行わず、process load後はrepository read/writeを0件とする。OS loader/runtime自身の
system file readはapplication filesystem countに含めないが、runner codeからの全file APIはadapter境界に含める。

```ts
interface PhaseB1L0RunnerReviewRequestV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-l0-runner-review-request/1';
  readonly requestId: `T1-7-l0-runner-${Sha256Hex}`;
  readonly taskId: 'T1-7';
  readonly stage: 'l0-curation-runner';
  readonly reviewType: 'implementation';
  readonly reviewedFiles: readonly [{
    readonly path: 'apps/snow-crystal-sim/tests/calibration/curate-morphology-pilot-toolchain-lock.ps1';
    readonly hash: `sha256:${Sha256Hex}`;
  }];
}

interface PhaseB1L0RunnerApprovalProjectionV1 {
  readonly reviewType: 'implementation';
  readonly status: 'approved';
  readonly reviewedFiles: readonly [{
    readonly path: 'apps/snow-crystal-sim/tests/calibration/curate-morphology-pilot-toolchain-lock.ps1';
    readonly hash: `sha256:${Sha256Hex}`;
  }];
  readonly findings: readonly [];
  readonly conditions: readonly [];
  readonly rollbackTo: 'none';
}

interface PhaseB1L0RunnerApprovalBindingV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-l0-runner-approval/1';
  readonly reviewRequestObjectSha256: Sha256Hex;
  readonly reviewRequestFileSha256: Sha256Hex;
  readonly approval: PhaseB1L0RunnerApprovalProjectionV1;
}

interface PhaseB1L0AuthorityBundleV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-l0-authority/1';
  readonly runnerContractVersion: '1';
  readonly runnerRepositoryRelativePath: 'apps/snow-crystal-sim/tests/calibration/curate-morphology-pilot-toolchain-lock.ps1';
  readonly runnerFileSha256: Sha256Hex;
  readonly runnerReviewRequestObjectSha256: Sha256Hex;
  readonly runnerReviewRequestFileSha256: Sha256Hex;
  readonly runnerApprovalBindingObjectSha256: Sha256Hex;
  readonly runnerApprovalBindingFileSha256: Sha256Hex;
  readonly externalRunnerRelativePath: `authority/${Sha256Hex}/curate-morphology-pilot-toolchain-lock.ps1`;
  readonly hostRuntime: 'windows-powershell-5.1';
  readonly hostRuntimeFileSha256: Sha256Hex;
  readonly hostRuntimeFullVersion: string;
}
```

Coordinatorはreview依頼前に、runnerの現在file SHA-256から
`requestId='T1-7-l0-runner-'+runnerFileSha256`を決定し、上記requestを生成する。同じrunner bytesに対する
requestは同じstrict objectだけであり、session、時刻、proposal ID、乱数を含めない。requestとnested objectは記載propertyの
厳密集合、UTF-8 BOMなし、NFC、LFなしJCS objectをobject SHA-256 preimageとし、同じJCS bytesへfinal LFを1つ付けた
bytesをfile SHA-256 preimageとする。`requestId`末尾と`reviewedFiles[0].hash`のhexはrunner file SHA-256と
exact一致しなければならない。Coordinatorはreview開始前にexact request bytesを
`PILOT_LOCK_CURATION_ROOT/authority-requests/<reviewRequestFileSha256>.json`へcreate-newで保存し、
request object/file hashとdecoded requestをreviewerへ渡す。ただしreviewerが返すmachine resultは規範の標準review schemaだけとし、
request IDやsession IDを追加fieldとして返させない。

Coordinatorは標準review resultの`review_type,status,reviewed_files,findings,conditions,rollback_to`だけを検査する。
`review_type='implementation'`、`status='approved'`、`rollback_to='none'`、findings/conditionsが空であり、
`reviewed_files`がrequestのpath/hashとexact一致する1件だけの場合に限り、snake_caseの標準fieldから上記camelCaseの
`PhaseB1L0RunnerApprovalProjectionV1`へ名前を固定対応させてapproval bindingを生成する。標準resultの`summary`、
`REVIEW.md`のYAML fence、表示上の改行・scalar表現は投影にもhash preimageにも使わない。追加・欠落した標準field、
複数reviewed file、requestと異なるpath/hash、未承認statusではbindingを生成しない。

bindingも記載propertyの厳密集合を同じJCS object/file規則でhashし、requestのobject/file hashとapproval projectionを結合する。
Coordinatorはrequest exact bytesを`authority/<runnerFileSha256>/runner-review-request.json`へ、binding exact bytesを
同directoryの`runner-approval-binding.json`へcreate-new copyし、両fileを別readしてhash一致を確認する。
runner hashごとにrequest bytesが一意で、approval projectionからsummary等を除いたため、同じ標準承認に対するbindingも一意である。
再reviewでrunner bytesが変われば別request/directoryとなり、bytesが同じなら同じrequestを再利用し、承認済みbindingと競合する
異なるbytesを受理しない。commit proposalはこのmini-cycleの後に作るためrequest/bindingの入力にせず、後続proposalは
request file hash、binding file hash、runner hashを別途照合する。これにより標準review schemaを拡張せず、proposal、session、
YAML表現への循環・依存を生じない。

authority bundleはJCS+LFでrunnerと同じhash directoryへimmutable公開する。`externalRunnerRelativePath`のhash
segmentは`runnerFileSha256`と一致し、external runner bytes、approved implementation reviewの対象hash、
repository current bytes、review request、approval projectionの対象path/hash/type/statusの全てが一致しなければL0を起動しない。
runnerまたはhost runtimeが変わった場合は
既存authorityを再利用せず、runner mini-cycleまたはhost runtime reviewからやり直す。

runnerのnetwork adapterはdeny-by-defaultで、§3.1に列挙したexact request ruleへ一致するURLだけを受ける。
filesystem adapterはexternal runner、authority bundle、`PILOT_LOCK_CURATION_ROOT`内のowned pathだけを許し、
他pathのread/write/list/statを拒否する。各application I/O attemptは実行前に、ordinal、operation、logical target、
decision、priorEntryHashをJCS化したSHA-256 hash chainへ追加し、許可operationは完了後にresult hash/lengthを持つ
paired entryを追加する。最初の`priorEntryHash`は64桁のzero、最後のentry hashを
`lock-curation-audit.json`へ固定し、途中entryの削除、並べ替え、重複、未完了pairを拒否する。
network request recordはauditの許可済みnetwork-start/completion pairとordinal・URL・response hash/lengthが
一対一でなければならない。禁止対象0件とrepository/image/PDF/AI access countはevidence writerの申告値ではなく、
このaudit全entryを独立集計して導出する。

runnerのtestはsynthetic adapterで、全network/file operationがadapterとauditを通ること、直接I/O API、module import、
child processがsource/dependency boundaryに存在しないこと、許可外attemptがdispatch前にdeny記録されcompletionを
公開しないことを検査する。implementation reviewは単一file dependency boundaryを静的に再確認する。
これにより、approved runner hashと改変不能なhash chainの組だけをL0の実行・監視authorityとする。

L0はB0/B1 test-code工程より前、かつ§3.1.0のrunner mini-cycle後に1回だけ行う、供給元lock作成専用の
隔離network工程である。実行時B0ではなく、
product/runtime実装でもない。L0が取得できるのは次だけである。

1. `nodejs.org`上のNode `24.14.1` win-x64 zip、同releaseの`SHASUMS256.txt`とそのdetached signature。
2. `registry.npmjs.org`上の`pdfjs-dist@6.3.289`、`@napi-rs/canvas@1.0.6`およびそれらの
   exact transitive/native dependency metadataとtarball。
3. `raw.githubusercontent.com`上の、Node.js公式GitHub organization `nodejs`が所有する
   `nodejs/release-keys` repositoryのimmutable 40 lowercase hex commitに固定したrelease keyring bytes。
4. `raw.githubusercontent.com`上の、Node.js公式`nodejs/node` repositoryのimmutable 40 lowercase hex commitに
   固定した`README.md`と、`nodejs.org`のrelease index。
5. `api.github.com`のexact endpoint
   `https://api.github.com/repos/nodejs/release-keys/commits/main`と
   `https://api.github.com/repos/nodejs/node/commits/main`から得る、両immutable commitのtip/provenance response。

許可hostはASCII順のexact集合
`['api.github.com','nodejs.org','raw.githubusercontent.com','registry.npmjs.org']`、schemeは`https`だけ、redirectは0回とする。
userinfo、query、fragment、IP literal、非default port、短縮URL、mutable branch/tag URLを禁止する。
上記2つ以外のGitHub API、search、package manager install、lifecycle script、AI/provider endpointへの接続を禁止する。
GitHub APIの`main`はimmutable artifact取得には使わず、responseが示す40桁commitのprovenanceを凍結してから、
artifact本体をそのcommitを含むexact raw URLで取得するためだけに使う。
Node/npmについては上記exact versionのrelease path、exact package-version metadata path、そのmetadataが示す
exact tarball pathだけを許し、別versionや汎用registry queryを許さない。

L0のnetwork計測範囲は最初のDNS/socket試行直前からcompletion inventoryの排他的公開後までである。
request ordinal、logical purpose、exact URL、host、response byte length、response file SHA-256、redirect count、
TLS検証結果を外部rootの`lock-curation-evidence.json`へ記録し、全application I/Oを§3.1.0のauditへ記録する。
credential/header値、絶対local path、usernameは記録しない。
画像、PDF、Phase A/B artifact、LocalStorage、source-audit UI、production corpusはread/writeとも0件、
AI/provider requestは0件でなければL0全体を拒否する。repositoryはread/writeとも0件とし、候補lockを
repositoryへ直接作成しない。

L0は全responseを`PILOT_LOCK_CURATION_ROOT/staging/<nonce>/`へcreate-newで保存し、digestと署名検証前の
bytesを展開・実行しない。trust rootを先に検証してfile hashを固定し、そのhashを参照する
candidate lock、response bytes、curation evidence、audit logを
`generations/lock-<candidateLockFileSha256>/`という未存在directoryへcreate-new renameで公開する。
最後に同directoryの`curation-inventory.json`をexclusive hardlinkでcompletion markerとして公開する。
各file write、fsync、別read hash検証、parent directory syncを行い、既存generationをreplace/mergeしない。
temp残存、同basename異bytes、欠落、path identity変更、directory sync未知errorはfail closedとし、自動削除しない。

同じcandidate lock hashの再実行はcompletion inventoryと全owned fileが一致すればnetworkへ接続せず`unchanged`、
不一致なら停止する。供給元metadataやkeyring commitを更新する場合は明示的な新curationとして別generationを作り、
旧generationを保持して再レビューする。L0完了だけでは候補lockを権威化しない。独立reviewが§3.1.1のtrust root、
Node署名、npm integrity、依存closure、request完全性、禁止対象0件、atomicityを`approved`とした後に限り、
候補lockのexact bytesをtest-code工程でrepositoryの`phase-b1-toolchain-lock.json`へ追加する。
Coordinatorはcandidate lock、repository copy、reviewed hashの3者一致に加え、trust root、curation evidence、
curation inventoryのfile hashを`EVIDENCE.md`へ記録する。

#### 3.1.1 Node release signing trust root

Node署名の信頼根はcandidate lock内の`signerFingerprint`ではなく、先に凍結する
`node-release-trust-root.json`である。

```ts
interface PhaseB1AuthorizedNodeSignerV1 {
  readonly primaryFingerprint: string; // 40 lowercase hex
  readonly signingSubkeyFingerprint: string; // 40 lowercase hex
  readonly primaryCreatedAtUtc: UtcSeconds;
  readonly primaryExpiresAtUtc: UtcSeconds | null;
  readonly signingSubkeyCreatedAtUtc: UtcSeconds;
  readonly signingSubkeyExpiresAtUtc: UtcSeconds | null;
  readonly primaryRevokedAtUtc: UtcSeconds | null;
  readonly signingSubkeyRevokedAtUtc: UtcSeconds | null;
}

interface PhaseB1NodeReleaseTrustRootV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-node-release-trust-root/1';
  readonly officialVerificationRepository: 'https://github.com/nodejs/node';
  readonly officialVerificationCommitSha: string; // 40 lowercase hex
  readonly officialVerificationCommitEvidenceFileSha256: Sha256Hex;
  readonly officialVerificationDocumentUrl: `https://raw.githubusercontent.com/nodejs/node/${string}/README.md`;
  readonly officialVerificationDocumentFileSha256: Sha256Hex;
  readonly officialVerificationDocumentByteLength: number;
  readonly releaseKeysRepository: 'https://github.com/nodejs/release-keys';
  readonly releaseKeysCommitSha: string; // 40 lowercase hex
  readonly releaseKeysCommitEvidenceFileSha256: Sha256Hex;
  readonly keyringSourceUrl: `https://raw.githubusercontent.com/nodejs/release-keys/${string}/${string}`;
  readonly keyringFileSha256: Sha256Hex;
  readonly keyringByteLength: number;
  readonly nodeReleaseIndexUrl: 'https://nodejs.org/dist/index.json';
  readonly nodeReleaseIndexFileSha256: Sha256Hex;
  readonly nodeReleaseDateUtc: string; // YYYY-MM-DD
  readonly manifestSignatureCreatedAtUtc: UtcSeconds;
  readonly authorizedSigners: readonly PhaseB1AuthorizedNodeSignerV1[];
}
```

trust rootはUTF-8 BOMなし・NFC・LFなしJCS object＋final LF 1つとする。
`officialVerificationDocumentUrl`と`keyringSourceUrl`のcommit segmentはそれぞれ
`officialVerificationCommitSha`と`releaseKeysCommitSha`にexact一致し、relative pathは非空segment、`..`なしでなければならない。
両commit evidenceは§3.1で許可したGitHub API response exact bytesであり、repository full name、owner、commit SHAを
独立parserで検査する。verification documentのfrozen bytesは`Release keys`節で
`https://github.com/nodejs/release-keys`を公式verification sourceとして参照しなければならない。
`authorizedSigners`は`primaryFingerprint,signingSubkeyFingerprint`のASCII tuple順、重複なし、1件以上とする。
独立reviewは、Node.js公式release verification文書が`nodejs/release-keys`を信頼元として示すこと、両immutable commitが
公式`nodejs` organizationの各repository tip evidenceと一致すること、取得keyring bytes/hash、各primary keyと
署名可能subkeyのbinding・失効/期限packetを照合する。Node release manifestのdetached signatureは
このkeyringだけで検証し、実際に署名したsubkeyと対応primary keyのtupleが`authorizedSigners`にexact一致することを要求する。
candidate lockの`signerFingerprint`はその検証済みsigning subkeyであり、trust root file SHA-256をlockへ結合する。
lock自身が提示するfingerprint、同じL0で任意生成した鍵、OSのambient keyring、keyserver lookupを信頼根にしない。

時刻判定はfrozen artifactだけから次の順で行う。`nodeReleaseDateUtc`はfrozen Node release indexの
`version='v24.14.1'`のexact 1 recordにあるUTC calendar dateであり、manifest署名packetのcreation timeを
`manifestSignatureCreatedAtUtc`とする。署名creation timeのUTC日付は`nodeReleaseDateUtc`とexact一致し、
`primaryCreatedAtUtc <= signingSubkeyCreatedAtUtc <= manifestSignatureCreatedAtUtc <= startedAtUtc <= finishedAtUtc`
でなければならない。primary/subkeyの`expiresAtUtc`が非nullなら、それぞれ
`manifestSignatureCreatedAtUtc < expiresAtUtc`を要求する。つまり署名時点で両keyが有効であることを要求する。
署名後に期限切れとなり、そのexpiryがL0 `finishedAtUtc`以下でも、署名時点で有効ならexpiryだけを理由に拒否しない。
一方、frozen keyringにprimaryまたはsubkeyのrevocation signatureがあり、そのsignature creation timeが
L0 `finishedAtUtc`以下なら、manifest署名時刻の前後を問わず拒否する。各`revokedAtUtc`は該当keyに対する
最古のrevocation signature creation timeであり、nullなのは該当revocation signatureが
frozen keyringに存在しない場合だけである。`manifestSignatureCreatedAtUtc <= startedAtUtc <= finishedAtUtc`、
各key packetから独立導出した時刻とtrust root値の一致を要求する。将来のambient keyring、current clock、
keyserver状態を再判定に使わず、後日新しいrevocationを反映する場合は新L0 generationと再reviewを必要とする。

L0 artifactも§4.1と同じUTF-8/JCS+LF、strict property、duplicate/unknown/non-JSON拒否を適用し、
次の契約を使う。

```ts
interface PhaseB1L0NetworkTargetV1 {
  readonly kind: 'network';
  readonly networkClass: 'allowed-supply' | 'ai-provider' | 'other';
  readonly exactUrl: `https://${string}`;
  readonly host: string;
}

interface PhaseB1L0FileTargetV1 {
  readonly kind: 'file';
  readonly scope:
    | 'authority' | 'curation-root' | 'repository' | 'image' | 'pdf'
    | 'phase-artifact' | 'local-storage' | 'source-audit-ui'
    | 'production-corpus' | 'other';
  readonly logicalPath: string;
}

interface PhaseB1L0BytesResultV1 {
  readonly kind: 'bytes';
  readonly resultFileSha256: Sha256Hex;
  readonly resultByteLength: number;
}

interface PhaseB1L0DirectoryEntryV1 {
  readonly name: string;
  readonly entryType: 'regular-file' | 'directory' | 'reparse' | 'other';
}

interface PhaseB1L0DirectoryListResultV1 {
  readonly kind: 'directory-list';
  readonly entries: readonly PhaseB1L0DirectoryEntryV1[];
  readonly resultObjectSha256: Sha256Hex;
}

interface PhaseB1L0StatResultV1 {
  readonly kind: 'stat';
  readonly exists: boolean;
  readonly entryType: 'regular-file' | 'directory' | 'reparse' | 'other' | null;
  readonly byteLength: number | null;
  readonly fileIdentity: string | null;
  readonly reparseTag: number | null;
  readonly resultObjectSha256: Sha256Hex;
}

interface PhaseB1L0AdapterErrorResultV1 {
  readonly kind: 'error';
  readonly code:
    | 'not-found' | 'access-denied' | 'identity-changed' | 'reparse-found'
    | 'network-failed' | 'tls-failed' | 'already-exists'
    | 'hardlink-unsupported' | 'directory-sync-failed';
  readonly failurePoint:
    | 'before-temp' | 'after-temp-write' | 'after-temp-sync' | 'after-reread'
    | 'before-exclusive-publish' | 'after-exclusive-publish'
    | 'after-first-parent-sync' | 'after-temp-unlink' | 'after-second-parent-sync'
    | null;
}

interface PhaseB1L0AuditEntryBaseV1 {
  readonly ordinal: number; // 0始まり、欠番なし
  readonly operationId: string; // `io-` + attempt/deny ordinalの8桁0埋め10進数
  readonly operation: 'network-request' | 'file-read' | 'file-write' | 'file-list' | 'file-stat';
  readonly priorEntrySha256: Sha256Hex;
  readonly entrySha256: Sha256Hex;
}

type PhaseB1L0AllowedAttemptV1 = PhaseB1L0AuditEntryBaseV1 & {
  readonly phase: 'attempt';
  readonly decision: 'allow';
  readonly pairedAttemptOrdinal: null;
  readonly requestOrdinal: number | null;
  readonly target: PhaseB1L0NetworkTargetV1 | PhaseB1L0FileTargetV1;
  readonly result: null;
  readonly denialReason: null;
};

type PhaseB1L0CompletedOperationV1 = PhaseB1L0AuditEntryBaseV1 & {
  readonly phase: 'complete';
  readonly decision: 'allow';
  readonly pairedAttemptOrdinal: number;
  readonly requestOrdinal: number | null;
  readonly target: PhaseB1L0NetworkTargetV1 | PhaseB1L0FileTargetV1;
  readonly result:
    | PhaseB1L0BytesResultV1
    | PhaseB1L0DirectoryListResultV1
    | PhaseB1L0StatResultV1
    | PhaseB1L0AdapterErrorResultV1;
  readonly denialReason: null;
};

type PhaseB1L0DeniedAttemptV1 = PhaseB1L0AuditEntryBaseV1 & {
  readonly phase: 'deny';
  readonly decision: 'deny';
  readonly pairedAttemptOrdinal: null;
  readonly requestOrdinal: null;
  readonly target: PhaseB1L0NetworkTargetV1 | PhaseB1L0FileTargetV1;
  readonly result: null;
  readonly denialReason:
    | 'network-rule-mismatch' | 'filesystem-scope-forbidden'
    | 'path-invalid' | 'reparse-forbidden' | 'operation-forbidden';
};

type PhaseB1L0AuditEntryV1 =
  | PhaseB1L0AllowedAttemptV1
  | PhaseB1L0CompletedOperationV1
  | PhaseB1L0DeniedAttemptV1;

interface PhaseB1L0AuditLogV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-l0-audit/1';
  readonly authorityBundleFileSha256: Sha256Hex;
  readonly authorityRunnerFileSha256: Sha256Hex;
  readonly entries: readonly PhaseB1L0AuditEntryV1[];
  readonly finalEntrySha256: Sha256Hex;
}

interface PhaseB1LockCurationRequestV1 {
  readonly ordinal: number; // 0始まり、欠番なし
  readonly purpose:
    | 'node-verification-repository-tip' | 'node-release-keyring-repository-tip'
    | 'node-verification-document' | 'node-release-keyring' | 'node-release-index'
    | 'node-release-manifest' | 'node-release-signature' | 'node-runtime'
    | 'npm-version-metadata' | 'npm-tarball';
  readonly exactUrl: `https://${string}`;
  readonly host: 'api.github.com' | 'nodejs.org' | 'raw.githubusercontent.com' | 'registry.npmjs.org';
  readonly responseByteLength: number;
  readonly responseFileSha256: Sha256Hex;
  readonly redirectCount: 0;
  readonly tlsOutcome: 'verified';
}

interface PhaseB1LockCurationEvidenceV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-lock-curation-evidence/1';
  readonly startedAtUtc: UtcSeconds;
  readonly finishedAtUtc: UtcSeconds;
  readonly allowedHosts: readonly ['api.github.com', 'nodejs.org', 'raw.githubusercontent.com', 'registry.npmjs.org'];
  readonly requests: readonly PhaseB1LockCurationRequestV1[];
  readonly requestCount: number;
  readonly aiProviderRequestCount: 0;
  readonly imageReadCount: 0;
  readonly pdfReadCount: 0;
  readonly phaseArtifactReadCount: 0;
  readonly repositoryReadCount: 0;
  readonly repositoryWriteCount: 0;
  readonly authorityBundleFileSha256: Sha256Hex;
  readonly authorityRunnerFileSha256: Sha256Hex;
  readonly auditLogFileSha256: Sha256Hex;
  readonly auditFinalEntrySha256: Sha256Hex;
  readonly nodeReleaseTrustRootFileSha256: Sha256Hex;
  readonly candidateLockFileSha256: Sha256Hex;
}

interface PhaseB1LockCurationOwnedFinalV1 {
  readonly relativePath: string;
  readonly fileSha256: Sha256Hex;
  readonly byteLength: number;
}

interface PhaseB1LockCurationInventoryV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-lock-curation-inventory/1';
  readonly generationId: `lock-${Sha256Hex}`;
  readonly candidateLockFileSha256: Sha256Hex;
  readonly authorityBundleFileSha256: Sha256Hex;
  readonly authorityRunnerFileSha256: Sha256Hex;
  readonly auditLogFileSha256: Sha256Hex;
  readonly auditFinalEntrySha256: Sha256Hex;
  readonly nodeReleaseTrustRootFileSha256: Sha256Hex;
  readonly curationEvidenceFileSha256: Sha256Hex;
  readonly ownedFinals: readonly PhaseB1LockCurationOwnedFinalV1[];
}
```

各entryとnested objectは上記型の該当branchに記載したpropertyだけを持つ。auditの`entrySha256` preimageは
そのentryから`entrySha256`だけを除いた厳密objectのLFなしJCS bytesである。ordinal 0の
`priorEntrySha256`は64桁zero、以後は直前entryの`entrySha256`である。`finalEntrySha256`は空配列を禁止した
最後のentry hashと一致する。`operationId`はattemptまたはdeny自身のordinalから決まり、completeは対応attemptと
同じ値を持つ。許可attemptの直後entryはexact 1件のcompleteで、completeの`pairedAttemptOrdinal`、operation、target、
requestOrdinalはattemptとexact一致する。denyはdispatchせずcompleteを持たず、denyが1件でもあるrunは成功inventoryを
公開できない。`network-request`はnetwork targetだけ、4つのfile operationはfile targetだけを持つ。
success complete resultはnetwork-request/file-read/file-writeでbytes、file-listでdirectory-list、file-statでstatだけを許す。
adapter error completeはoperation別codeとfile-write failurePointの表へexact一致しなければならず、error resultがあるrunは
completion inventoryを公開できない。

network targetの`exactUrl`はuserinfo/query/fragmentなしのcanonical HTTPS URL、`host`はURL parserが返す
lowercase ASCII hostnameとexact一致する。許可network attempt/completeだけが0始まり欠番なしの非null
`requestOrdinal`を持ち、file operationとdenyではnullである。`requests`の各recordは、同じrequest ordinalを持つ
bytes resultのnetwork completeとexact 1対1で、`exactUrl`、host、response hash、response byte lengthが一致する。
反対方向にも各bytes resultのnetwork completeにexact 1 recordを要求するため、auditにないrequestまたはrequestのないsuccessful audit pairを
受理しない。2 repository tip、Node verification document、keyring、release index、manifest、signature、runtimeは各1件、
npm metadata/tarballはcandidate lockのdependency closureと一対一に対応する。

file targetの`logicalPath`はNFC、`/`区切りで、許可rootでは`authority/<relative>`または
`curation/<relative>`とする。既知の禁止rootは`repository/<relative>`、`image/<relative>`、`pdf/<relative>`、
`phase-artifact/<relative>`、`local-storage/<relative>`、`source-audit-ui/<relative>`、
`production-corpus/<relative>`としてscopeとprefixを一致させる。その他は
`other/sha256:<sha256(UTF8(NFC(canonicalAbsolutePath)))>`とし、絶対path自体を保存しない。relative部分は空segment、
`.`、`..`、backslash、NULを禁止する。同じOS pathは常に同じlogical pathへ分類してからpolicy判定し、denyも省略しない。

`network-request`、`file-read`、`file-write`のcomplete resultは`bytes`だけで、hash preimageは実response/read/written
bytesそのもの、`resultByteLength`はそのbyte数である。`file-list`のresultは`directory-list`だけで、entry nameはNFC、
`/`、backslash、NUL、`.`、`..`を含まない単一segment、`name`のUTF-8 byte辞書順、重複なしとする。
`resultObjectSha256=SHA-256(JCS(entries))`とする。`file-stat`のresultは`stat`だけで、存在しない場合は
`exists=false`かつentryType/byteLength/fileIdentity/reparseTagを全てnull、存在する場合はentryTypeを非null、
regular-fileだけbyteLengthを非負safe integer、それ以外はnullとする。`fileIdentity`は
`<16 lowercase hex volume serial>:<32 lowercase hex file id>`、reparseだけ`reparseTag`を非負uint32、それ以外nullとし、
`resultObjectSha256`は同resultから自身だけを除いた厳密objectのLFなしJCS bytesのSHA-256とする。

禁止access countはoperationId単位で集計し、attempt+completeを1件、denyを1件と数える。repository/image/PDF/
phase artifact/LocalStorage/source-audit UI/production corpusはfile target scopeから、AI/provider requestはnetworkClassから
独立導出する。成功runではこれらのcountとdeny件数が全て0でなければならない。これにより全operationについて同じ
target/result、request対応、audit hash chainをfrozen bytesだけから独立再生成できる。

response bytesはgeneration内の`responses/<responseFileSha256>`へ保持し、同じhashの同一bytesだけを共有できる。
`ownedFinals`はresponse全件、`node-release-trust-root.json`、`phase-b1-toolchain-lock.json`、
`lock-curation-evidence.json`、`lock-curation-audit.json`のexact集合をrelative path ASCII順で列挙し、inventory自身、
temp、authority directory、他generationを含めない。`generationId`は
`lock-${candidateLockFileSha256}`とし、generation directory basenameとexact一致する。
`requestCount=requests.length`、開始時刻は終了時刻以下、
各requestのhostはURLのcanonical hostと一致し、response fileのhash/lengthも一致しなければならない。
trust rootの公式verification document bytesはevidenceの対応requestと一致し、その文書が
`https://github.com/nodejs/release-keys`をrelease verificationの信頼元として示すことを独立reviewで確認する。
evidence/inventoryのauthority bundle、runner、audit log、final entry hashは相互にexact一致し、audit再計算で
全hash chain、request一対一対応、禁止access count 0を再現できなければならない。
L0の成功statusは`created|unchanged`だけとする。許可外request/redirectは`phase-b1-lock-curation-network-forbidden`、
authority/hash/audit不整合は`phase-b1-lock-curation-authority-invalid`、trust root・署名・integrity・dependency closure不整合は
`phase-b1-lock-curation-input-invalid`、既存final競合は
`phase-b1-lock-curation-final-conflict`、temp残存は`phase-b1-lock-curation-temp-present`、hardlink/directory sync失敗は
`phase-b1-lock-curation-hardlink-unsupported|phase-b1-lock-curation-directory-sync-failed`として停止し、部分finalを権威化しない。

### 3.2 Stage B0 bootstrap-toolchain

B0はreview済みlock記載artifactを再取得するdata-preparation network工程である。L0以外の工程ではB0だけが
package/runtime取得のためnetworkを使える。repositoryのscriptをhost PowerShellから次の契約で起動する。

```text
powershell -NoProfile -File <REPOSITORY_ROOT>/apps/snow-crystal-sim/tests/calibration/bootstrap-morphology-pilot-toolchain.ps1 \
  -WorkRoot <absolute PILOT_WORK_ROOT> \
  -Command bootstrap-toolchain
```

B0はNode `24.14.1` runtime、exact dependency lock、`pdfjs-dist@6.3.289`、
`@napi-rs/canvas@1.0.6`とlockに列挙した全transitive/native packageだけを
`tooling/phase-b1/staging/<nonce>/`へ取得する。download bytesは配布元の
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

#### 3.2.1 win32-x64 platform acquisition lock

`phase-b1-toolchain-lock.json`は実装ではなく、test-code工程でB0/B1 entrypointより先に作成・レビュー・固定する
供給元authorityである。placeholder、semver range、実行時registry metadata解決を禁止する。対象platformは
`os='win32'`、`arch='x64'`、native ABIは`msvc`だけとし、別platformは別設計・別lockなしに実行しない。
許可hostはASCII昇順のexact集合 `['nodejs.org','registry.npmjs.org']`、schemeは`https`だけ、redirectは0回とする。

```ts
interface PhaseB1AcquisitionArtifactV1 {
  readonly ordinal: number; // 0始まりで欠番なし
  readonly artifactId: string;
  readonly kind: 'node-runtime' | 'npm-package';
  readonly packageName: string | null; // node-runtimeだけnull
  readonly version: string;
  readonly exactUrl: `https://${string}`;
  readonly responseByteLength: number;
  readonly responseFileSha256: Sha256Hex;
  readonly integrity:
    | {
        readonly kind: 'node-release-sha256-signed-manifest';
        readonly artifactSha256: Sha256Hex;
        readonly manifestUrl: `https://nodejs.org/${string}`;
        readonly manifestFileSha256: Sha256Hex;
        readonly signatureUrl: `https://nodejs.org/${string}`;
        readonly signatureFileSha256: Sha256Hex;
        readonly signerFingerprint: string;
      }
    | {
        readonly kind: 'npm-dist-integrity-sha512';
        readonly distIntegritySha512: `sha512-${string}`;
        readonly tarballSha256: Sha256Hex;
      };
}

interface PhaseB1ToolchainLockV1 {
  readonly schemaVersion: 'snow-crystal-morphology-pilot-toolchain-lock/1';
  readonly target: {
    readonly os: 'win32';
    readonly arch: 'x64';
    readonly nativeAbi: 'msvc';
  };
  readonly allowedHosts: readonly ['nodejs.org', 'registry.npmjs.org'];
  readonly redirectPolicy: 'forbid';
  readonly nodeReleaseTrustRootFileSha256: Sha256Hex;
  readonly nodeVersion: '24.14.1';
  readonly packages: readonly [
    { readonly name: '@napi-rs/canvas'; readonly version: '1.0.6' },
    { readonly name: 'pdfjs-dist'; readonly version: '6.3.289' },
  ];
  readonly artifacts: readonly PhaseB1AcquisitionArtifactV1[];
}
```

lockはUTF-8 BOMなし、NFC、LFなしJCS object＋final LF 1つとし、§4.1と同じduplicate/unknown/non-JSON拒否を
適用する。`exactUrl`のhostは`allowedHosts`にexact一致し、userinfo、query、fragment、IP literal、非default portを
禁止する。Node recordは公式win-x64 zip 1件で、versionとbasenameが一致し、signed `SHASUMS256.txt`から得た
artifact SHA-256、manifest/signature bytesのSHA-256、検証済みsigner fingerprintを全て非placeholderで持つ。
npm recordはoffline展開に必要なtop-level packageと全transitive/native package tarballをexactに1回ずつ列挙し、
registry `dist.integrity`のSHA-512とdownload bytesのSHA-256の両方を持つ。artifactsはordinal順で、
`artifactId`、URL、package name/versionの重複を禁止する。
`signerFingerprint`は40 lowercase hex、`distIntegritySha512`はpaddingを含むcanonical base64 SRIとする。

lock作成時の独立レビューは、§3.1.1の独立trust rootによるNode signed manifestの署名検証結果、npm registry metadataの
`dist.tarball`/`dist.integrity`、全exact URL・host、全download byte hash、依存closureの完全性を照合する。
そのreviewが`approved`となり、lock hashがtest code literalと一致するまで実装とreal B0を開始しない。
B0はlock記載URL以外を組立てず、metadata endpointへ接続せず、redirectを追わず、全digest検証後にだけ展開する。
通常testはこの実lockをparse/hash検査するがnetworkへ接続せず、synthetic network adapterで正例・host/URL違い・
redirect・digest不一致・依存欠落を検証する。real networkはtest-code前の隔離L0と、実装Green・実装レビュー・
execution artifact gate後のdata-preparation B0だけで使える。L0はlock curationだけ、B0はreview済みlockの再取得だけを行う。

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

`RepositoryReadAllowlistV1`はprocess load後のapplication readだけを表し、entrypointのprocess loadや
execution artifact gateを表さない。B0では`phase-b1-toolchain-lock.json` 1件、B1では0件である。

relative pathはNFC、`/`区切り、非空segmentだけとし、absolute/UNC/drive、`.`、`..`、NUL、backslash、usernameを
禁止する。`ArtifactEntryV1`配列は`relativePath` ASCII昇順で重複不可、allowlistは
`repositoryRelativePath` ASCII昇順で重複不可とする。各inventoryのowned-final配列は列挙した集合とexact一致し、
inventory自身、completion marker、temp、inbox、preview、他generation、unrelated fileを含めない。

| schemaVersion | 厳密なtop-level field集合と配列契約 |
|---|---|
| `snow-crystal-morphology-pilot-phase-b0-network/1` | `schemaVersion,stage,startedAtUtc,finishedAtUtc,requests,requestCount,aiProviderRequestCount`; `stage='B0'`; UTCは`UtcSeconds`; requestは`ordinal,host,artifactKind,responseByteLength,responseFileSha256,integrityOutcome`だけ、ordinal 0始まり、`artifactKind='node-runtime'|'npm-package'`、`integrityOutcome='verified'`; `requestCount=requests.length`; `aiProviderRequestCount=0` |
| `snow-crystal-morphology-pilot-toolchain-inventory/1` | `schemaVersion,nodeVersion,packages,lockSource,repositoryReadAllowlist,payloadTreeObjectSha256,payloadFiles,networkLogFileSha256`; exact Node、packagesは`name,version`だけを持つ2件name ASCII順、lockSourceは`repositoryRelativePath,fileSha256`、repositoryReadAllowlistはB0 runtimeのlock 1件だけ、payloadFilesは全payload regular file、tree object hashは`JCS(payloadFiles)`のSHA-256 |
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

test codeは通常workspaceでreal network/PDF/実画像を使わず、renderer/filesystem/clock/network adapterを注入する。
network正例もsynthetic response bytesだけを使い、DNS、socket、HTTP clientを起動しない。

1. synthetic viewport transformで4 corner、floor/ceil、half-open cropを独立計算する。
2. synthetic RGBAでmask内gray、mask外bit一致、file/RGBA hash、canonical PNGを独立oracleと比較する。
3. exact version/PDF/Phase A hash mismatchがoutput 0 byteで停止することを確認する。
4. 24 entry、匿名ID、batch 12+12、manifest/map非漏洩、Phase A schema適用が3種類だけであることを検査する。
   §4.1のB1-only canonical JSONそれぞれについてrequired/unknown/wrong type/null、array順・件数、relative path、
   file/object hash、owned-final exact membership、inventory self exclusion、JCS+LFを独立oracleで検査する。
5. L0 authority mini-cycleでは、synthetic network/filesystemだけでrunnerのdeny-by-default adapter、全I/O hash-chain、
   operation別target/result preimage、attempt/complete pair、requestOrdinal/URL/hash/length一対一、directory/stat oracle、
   禁止scope集計、許可外dispatch 0件を検査する。runner review requestはrunner hash由来の一意なrequest ID、対象path/hash、
   review typeから独立JCS oracleでobject/file hashを求める。approval bindingは標準review schemaのtype/status/reviewed files/
   findings/conditions/rollbackだけを厳密投影し、request hashと結合して、summary、YAML表現、session、commit proposalに
   依存しないことを確認する。
   direct I/O/import/child process禁止、runner/authority/host hash gateも検査する。
   そのapproved runnerで生成したL0のcuration evidence/inventory、4 host、request exact membership、禁止対象0件、
   trust rootのimmutable nodejs/node document provenance、release-keys tip、primary/subkey mapping、署名creation/release日、
   expiry/revocation時刻規則、Node署名検証をfrozen artifactだけの独立oracle/reviewで確認する。
   reviewed win32-x64 lockのschema、exact target、
   B0用2 host、redirect禁止、Node signed-manifest evidence、npm SRI＋SHA-256、
   exact dependency closureを独立oracleで検査する。synthetic network adapterでB0だけがlock記載exact URLを取得でき、
   host/path/query/port/redirect/digest/byte length/依存closureの差異を拒否し、toolchain marker/hash、同一再実行、
   不一致、staging crashを検査する。B1a/B1bはnetwork API・socket・network可能child processの試行0件を
   process全期間で検査する。通常testからreal networkへは接続しない。
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
10. process load後のfilesystem spyで、B0はreview済みlock 1件だけをreadでき、B1はrepository readが0件であること、
    hash違い、entrypoint自己再読込、追加import、directory read、allowlist外read、symlink/reparseを拒否することを検査する。
    repository内のwrite/temp/cache/lock/logをfilesystem adapterで全面拒否し、repositoryとprotected sentinelの
    path・entry type・exact bytesが不変で、無関係な外部fileを保持することを確認する。entrypoint自身のfile hashは
    test implementation内へ埋め込まず、approved implementation reviewのhashと現在bytesを比較するCoordinatorの
    execution artifact gateを独立した実行前checkとして検査・記録する。
11. 同じconfirmed revisionから同じfull-hash generation IDと同じartifactを再生成し、別revisionでは別generationとなること、
    old generation exact bytesが不変でfixed convenience pathが作られないことを確認する。
12. 初回active head、replacement closure/head、head CAS競合、generation/closure完成後crash、inactive complete generation、
    inert closure、head fork/欠番、inventory mutationを検査する。勝者だけがactiveとなり、敗者はold activeをcloseしない。
13. upload/materialize resolverが一意なactive head tipだけを受理し、inactive/closed/fixed path、hash不一致、upload直前head変更を拒否する。

L0 authorityの独立mini-cycleをRed/Green/reviewまで完了し、そのapproved runnerによるL0と独立reviewで
win32-x64 lockを先に固定する。その承認済みlockを使うB0/B1 test codeを固定してから、
B0/B1 entrypoint未存在を最初の存在assertionによる唯一の
expected Redにする。entrypoint実装後にtest literalを追加・変更しない。
L0以外の実network/PDFの実行はtest code・実装の独立レビューとGreen後だけに行う。直前にCoordinatorがB0/B1 entrypointと
lockのcurrent file SHA-256を各latest approved review hashへ照合し、結果を`EVIDENCE.md`へ記録する。さらに
exact platform/runtime/package/PDF hash、network request件数・host、生成件数、artifact hashをdata-preparation evidenceへ
記録する。実PDF、page raster、crop、mask、restricted map、blinded PNGをrepository fixtureへ追加しない。

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
- 採用: entrypoint hashは実装レビュー後のCoordinator execution artifact gateで照合し、runtime自己hashや
  未実装file hashのtest literalを要求しない。runtime repository readはB0 lock 1件、B1は0件とする。
- 採用: B0 acquisitionはtest-code工程で先に承認するwin32-x64 exact lockへ限定し、通常testはsynthetic networkだけ、
  real networkはtest-code前の隔離L0と、Green・実装レビュー・実行前hash gate後のB0だけに使う。
- 採用: L0は画像/PDF/Phase artifact/AI endpoint/repositoryへアクセスせず、Node/npm配布情報と
  immutable official release keyringだけを外部rootへ取得する。Node署名はlock外のreview済みtrust rootで検証する。
- 採用: L0はlock非依存の単一file runnerを別のtest-first mini-cycleで先に承認し、external exact copy、
  deny-by-default adapter、全application I/O hash-chainをauthorityとする。公式verification文書はimmutable
  `nodejs/node` commit、keyringはimmutable`nodejs/release-keys` commitへ固定し、署名・期限・失効判定は
  frozen artifactとL0時刻だけで再現する。
- 採用: maskのmachine suggestionは任意だが非権威。人間確認なしのfinalizeは禁止。
- 採用: exact toolchainは`PILOT_WORK_ROOT/tooling/phase-b1/`へ隔離し、通常workspace依存を変更しない。
- 未決定: 各画像のrectangle座標。これは設計値ではなく、B1a source cropを見て人間が確定する実行dataである。
