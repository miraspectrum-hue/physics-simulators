# T1-7 形態タグ複数AI注釈 — 24画像pilot準備・実行手順書

> **状態: 非規範・未実行のrunbook**
>
> 本書は `MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.md` とD-14を、後続の正式設計へ移すための実務手順である。
> 現行 `DESIGN.md` §5.1、D-03、schema、既存LocalStorage、人間確認結果を変更しない。本書のcommitだけでは、
> 画像作成、外部AIへの送信またはcorpus反映を開始してはならない。正式な `DESIGN.md` 改訂、review、test、
> validator実装と、その時点で必要な人間承認が先である。

## 1. 固定済みのpilot条件

| 項目 | 固定値 |
|---|---|
| 方針 | 案A。AIだけでfinalにしない |
| 画像数 | 24（PDF pp. 11–14から各6） |
| annotator | Claude Code、Codex、Gemini Chat |
| annotation batch | 同じ順序の12画像×2 batch |
| human final | 24件すべて。spot-checkで代替しない |
| adjudication | 3者の不一致または不確実routeだけ。結果は助言でありhuman finalではない |
| 画像入力 | 同じblinded derivative PNG bytesを3 actorへ渡す |
| 画像加工 | 条件文字の単色maskだけ。crop、回転、補間、強調、生成補完を禁止 |
| 実行開始条件 | 正式設計・schema・test・validator・reviewが完了していること |

GitHub Copilotをadjudicator候補にする場合は、画面に表示された基盤modelがClaude、Codex/OpenAI、Geminiの
3 familyと重複しないことを記録できる場合に限る。製品名しか分からない、auto selectionで基盤modelが
不明、または重複する場合は4つ目の独立familyとは数えず、人間へadjudicator選択を戻す。

## 2. 物理的な対象、限界、独立確認

- 対象は2D写真上で観察できる `growthAxis`、`basalBranchingLevel`、`hollowing` と、その `confidence` である。
- 分類定義と観察からlabelへの写像は草案§6を参照し、本runbookでは変更しない。
- 温度、過飽和度、成長時間、視野寸法を形態推測へ使わない。
- 2D投影だけから三次元の空洞、奥行き、c/a比を確定しない。判別不能は `indeterminate` / `null` とする。
- AI一致は論文著者の正解または物理的ground truthではない。独立確認は、人間が24件すべてをsource PDFへ
  戻って確認する案Aで行う。
- pilotはmodel間一致、人間とのdisagreement、visibility limitation、作業時間を調べる探索であり、206件に
  対する性能保証ではない。小標本の率は分子・分母・Wilson intervalを併記する。

数式、単位、物理定数、Reiter CA、較正値、許容誤差はこのpilotで変更しない。

## 3. 保管境界とworkspace分離

実行前に、repository外のcommit禁止領域を `PILOT_WORK_ROOT` として人間が決める。成果物内には絶対path、
username、account ID、chat URL、API keyを保存せず、rootからの相対pathと無意味なstorage IDだけを記録する。

```text
PILOT_WORK_ROOT/
  restricted/                 # coordinatorだけ。source対応表と原資料locator
  images/source-crops/        # 著作物。commit禁止
  images/blinded/             # 著作物。commit禁止
  frozen/
    protocol/
    schema/
    prompts/
    provider-policy/           # documented-no-transformを使う場合の版付き公式policy artifact
    manifests/blinded/
    input-tables/
  workspaces/
    annotator-1-claude/batch-01|02/
    annotator-2-codex/batch-01|02/
    annotator-3-gemini/batch-01|02/
    adjudicator-1/<batch>/
  raw-responses/              # modelが返した原文を不変保存
  validated-runs/
  consensus/
  approvals/
  reports/
```

各annotator workspaceには次だけをcopyする。

- frozen rendered prompt
- model payload schemaとprotocol canonical JSON
- 当該batchのblinded manifest/input table
- 当該batchの12 PNG

repository、restricted mapping、他actorのworkspace/output、既存A/B候補、既存human final、温度等の条件値を
置かない。actor×batchごとにfresh contextを使い、batch-01の会話をbatch-02へ継続しない。

## 4. 実行前に作る成果物

正式設計でpathとschema versionを確定した後、次をこの順で作る。

1. `pilot-selection-plan.json`
   - 24 selection slot、PDF page quota、proxy候補集合、selection seed、選定ruleを固定する。
2. `restricted-source-map.json`
   - source ID、page/panel、source crop、匿名IDを結ぶ。annotatorへ渡さない。
3. `blinded-input-manifest.json`
   - 匿名ID、匿名filename、寸法、file/RGBA hash、mask、codecだけを持つ。
4. `protocol.json` とschema群
   - 草案§6/§7のtruth table、payload、artifact、transport契約を機械検証可能にする。
5. `annotator-prompt.md` と `adjudicator-prompt.md`
   - placeholder展開後のrendered prompt hashをactor×batchで固定する。
6. `batch-01-input.json`、`batch-02-input.json`
   - 同じ24件をmanifest順で12件ずつ分割する。3 actorで同じ順序を使う。
7. `annotation-consensus-slot-plan.json`
   - 最初のrun前に、actor×batchの6 annotation root IDとconsensus root IDを事前登録する。
8. `post-consensus-route-slot-plan.json`
   - active consensus snapshot確定後、adjudication/human approval前に、最大2 adjudication slotと
     human batch/individual slotを固定する。unused slotはrootなし・理由付きで明示する。

原PDF、crop、derivative、restricted map、画像を含むchat exportはcommitしない。provider credentialや会話URLも
保存しない。テキスト出力を将来commitするかは、著作物・PII検査と正式設計で決める。

## 5. Phase 0 — 正式設計とtooling gate

次がすべて満たされるまでPhase 1へ進まない。

- [ ] `DESIGN.md` §5.1とD-03が3 annotator、adjudication、案A pilotを正式に扱う
- [ ] schema/test case/test codeがreview済み
- [ ] derivative generator、manifest validator、run validator、consensus generatorがGreen
- [ ] transportの972状態網羅テストが、草案§5.3の5状態だけを受理する
- [ ] 2段階slot plan、active root、supersession、unused slot、snapshotの非循環testがGreen
- [ ] pilot coverageが24 expected IDの未知・重複・欠落・supersededを拒否するtestがGreen
- [ ] 既存A/B草案、人間入力、LocalStorageを上書きしない境界がtestで固定される
- [ ] commit外 `PILOT_WORK_ROOT` とbackup/recovery手順が決まる
- [ ] selection seed、評価閾値、adjudicator modelが決まる

## 6. Phase 1 — 24画像の選定

PDF pp. 11–14の各pageから6件を選ぶ。24件全体のproxy strataと最低数は正式設計のselection planで
事前登録する。候補分類は既存A/Bまたはhuman入力をproxyとして使えるが、正解ラベルとは扱わない。

1. source候補集合とselection seedをfreezeする。
2. 事前登録した決定的selection algorithmとhash tie-breakで24件を選ぶ。
3. 24 source ID、pageごとの6件、proxy strata、候補集合hashを確認する。
4. page quotaまたはproxy最低数を満たせない場合は停止し、人間がselection planを決め直す。
5. 選定後に都合のよい画像へ差し替えない。差替えは新selection plan/versionにする。

## 7. Phase 2 — source cropとblinded derivative

1. source PDF SHA-256が `20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af` と一致する。
2. 草案§5.3の固定raster contractでpageをrenderし、source cropを生成する。
3. 原寸を維持したまま条件文字だけをopaque grayでmaskする。
4. rectangle外pixelがbit-for-bit同一であることを検証する。
5. 人間が24件すべてについて、maskが結晶/seedへ重ならず、条件文字が読めず、外周/先端が欠けていないと
   確認する。
6. canonical PNG file hash、decoded RGBA hash、width/height、MIMEをmanifestへfreezeする。

このphaseでは超解像、denoise、sharpen、contrast/gamma/color変更、回転、paddingを行わない。

## 8. Phase 3 — promptと入力のfreeze

1. protocol/schema/templateをNFC、UTF-8、LFでfreezeしhashを計算する。
2. batch-01とbatch-02を各12件へ固定する。
3. 3 actorへ同じbatchごとに、同じPNG file bytes、同じrendered prompt、同じinput tableを用意する。
4. local validatorで、各添付fileのfile hash、decode後RGBA hash、寸法、MIMEをmanifestと照合する。
5. actorへ見せるworkspaceにsource ID、page、条件、他actor output、human finalがないことを検査する。
6. 6 annotation slotとconsensus slotのroot artifact IDを先取りし、annotation/consensus planをfreezeする。

## 9. Phase 4 — 3 actorの独立実行

### 9.1 Claude Code / Codex（VSCode）

actorごとに別のpilot専用workspaceとfresh contextを開く。repository rootから実行せず、対象batchの隔離workspace
だけを開く。

1. 画面に表示されたprovider/product/model名、client version、開始UTCを記録する。
2. 実際に使うattachment mode（例: clientのfile upload/pasteの表示名）をNFC非空文字で記録する。
3. 添付直前に12 PNGのlocal hash・RGBA・寸法・MIMEをvalidatorで再確認する。
4. attachment previewで12件すべてが全体表示され、crop、破損、向き変更、過度な縮小が目視できないことを
   確認する。
5. frozen rendered promptを一度だけ渡す。途中で補足・誘導・他actor出力を渡さない。
6. modelの応答原文をそのまま `raw-responses/<actor>/<batch>/<run-id>.txt` へ保存する。
7. batch-02は新しいcontextで同じ手順を繰り返す。

### 9.2 Gemini Chat（APIなし）

batchごとに新しいchatを使う。会話URL、account情報、画面全体のexportは保存しない。

1. 画面に表示されたmodel名、product=`Gemini Chat`、client/browser version、開始UTCを記録する。
2. 実際のattachment mode（Gemini Chat画面上のfile upload/paste等の表示名）をNFC非空文字で記録する。
3. 同じ12 PNGをmanifest順に添付し、各previewと匿名filenameの対応を確認する。
4. frozen rendered promptを貼り、JSON arrayだけを返させる。
5. 返答本文を選択し、文字を直さずUTF-8/LFのraw response fileへ1回だけ保存する。
6. capture UTC、operatorが手入力した表示model名、raw response SHA-256をsidecar provenanceへ記録する。
7. Markdown fence、前後説明、ID欠落、JSON不正があっても人間が修正しない。runをfailedとして保存し、
   prompt/schema変更なしの新しいfresh chat/run IDでbatch全体を再実行する。

手動保存で許されるのは、画面に表示されたresponse本文を不変にcopyすることだけである。coordinator header、
hash、時刻、transportはtrusted wrapperが別に付与し、model回答から推測しない。

### 9.3 transport記録

全actorで実行時attachment mode、local upload hash、decoded RGBA hash、width/height、`image/png`、`clientSideTransform='none'`、
preview結果を必須にする。

- provider受領file bytesを検証できる: `verified-bytes`
- provider受領decoded pixelsを検証できる: `verified-pixels`
- providerがどちらも公開しない: `local-input-only`

`local-input-only` は許容するが、providerが同じpixelsをmodelへ渡したとは主張しない。provider内部処理が不明なら
`internalPreprocessing='unobservable'` とし、policy version/evidenceは両方 `null` にする。
`local-input-only` は必ずこの組合せであり `documented-no-transform` を許さない。
`documented-no-transform` は、当該provider/model/client/添付方式について受領後からmodel入力まで変換なしと
明示する版付き公式policy artifactを保存し、適用範囲を結ぶpolicy evidence object、その一致hash、非空versionを記録できる
`verified-bytes|verified-pixels` runだけに許す。provider、model ID、client tool/version、実行時attachment mode、
policy versionはevidence objectとすべて完全一致させる。見えるcrop、破損、向き変更、mask欠落、過度な縮小、画像/IDの
対応欠落があれば停止する。

## 10. Phase 5 — raw保存とvalidator

actor×batchのraw responseを上書きしない。trusted wrapper/validatorは次を行う。

1. raw response bytesとSHA-256を固定する。
2. JSON only、schema、enum、短文長、truth table mappingを検証する。
3. 12匿名IDがmanifest順で過不足なく1回ずつ存在することを検証する。
4. model payloadへtrusted manifestのhash、run header、transport recordをjoinする。
5. protocol/prompt/input/model metadataと開始・終了UTCを記録する。
6. validated JSONLを一時fileへ書き、再parse・再hash後にatomic renameする。

1 recordでも不正ならbatch全体をrejectedとし、有効な一部をconsensusへ混ぜない。手作業でIDやlabelを補完しない。

## 11. Phase 6 — consensusと不一致adjudication

1. 3 actor×2 batchが24件を完全に覆るまでconsensusを作らない。
2. 6 active annotationとactive consensusの7 slotを含むactive annotation/consensus snapshotをfreezeする。
3. 草案§9の `D/U/L/O/H` を決定的に計算し、4 categoryへ一意にrouteする。
4. adjudication最大2 partitionとhuman batch/individualのrequired/unused、root ID、ID集合を持つroute planを
   freezeする。ここまでをadjudicationまたはhuman approval作成前に終える。
5. `single-field-disagreement` と `multi-field-or-uncertain` だけをadjudication対象にする。
6. candidateとactor/modelの対応をX/Y/Zへseed付きで匿名化する。
7. fresh adjudicatorには同じblinded image、候補X/Y/Z、protocol、schemaだけを渡す。
8. adjudicatorの提案はhuman画面への補助であり、finalへ自動昇格しない。

Copilotの基盤modelが重複/不明なら、adjudicationを始めず正式設計で決めたfallbackへ従う。未決定のまま
便宜的に別familyと記録しない。

## 12. Phase 7 — 案Aの人間全件確認

24件すべてをsource PDFへ戻して確認する。

- unanimous/highでも省略しない。
- batch確認できるcategoryはbatch画面で確認できるが、24 source IDをapproval recordが完全被覆すること。
- confidence差、不一致、不確実、adjudicator対象はindividual確認する。
- humanは `approved`、`corrected`、`rejected` を記録し、correctedでは最終4 fieldと短い根拠を保存する。
- `pilot-spot-check` recordだけではhuman final coverageへ数えない。
- 24件の有効なbatch/individual finalが揃うまでpilot approvalはincompleteである。

最後に `PilotApprovalCoverageRecordV0` を生成し、凍結manifest/restricted map由来の期待24匿名ID・24 source IDを、
指定cutoffのactive batch/individual `approved|corrected` finalが各1回だけ覆ることを検証する。未知、重複、欠落、
rejected、spot-check、superseded approvalがあればcoverage recordを拒否する。このrecordは206件corpus coverageの
代用にしない。

既存LocalStorageや過去approvalを上書きしない。移行が必要なら、正式なmigration設計とbackup検証を別gateにする。

## 13. Phase 8 — reportと終了判断

次をactor別、field別、transport assurance別に報告する。

- coverage、schema validity、rejected/superseded run
- 3者exact agreementとpairwise confusion matrix
- branch weighted kappaと定義可能な場合のbootstrap interval
- `indeterminate` / `null` とvisibility limitation
- human finalに対するdisagreement（24件全体）
- adjudicatorのresolution率（正解率とは呼ばない）
- operatorの実作業時間とhuman confirmation時間
- `local-input-only` 件数、およびprovider受信pixel同一性を検証できなかった制約

人間がreportを見て、次のいずれかを決める。

1. protocol/prompt/schemaを修正して新しいholdout pilotを行う
2. 正式設計のまま残り182件へ展開する
3. 複数AI方式を中止し、現行A/B＋human経路へ戻る

pilot結果を見て閾値やselection ruleを変えた分析は探索的と明記し、同じ24件で採用性能を再主張しない。

## 14. 即時停止条件

- 正式設計、schema、test、validatorのいずれかが未承認
- PDF、crop、derivative、manifest、prompt、protocolのhash不一致
- maskが結晶/seedへ重なる、条件文字が読める、結晶外周/先端が欠ける
- 3 actorへ異なるlocal derivative bytesまたは異なるpromptを渡した
- preview上のcrop、破損、向き変更、過度な縮小、画像/匿名ID対応欠落
- annotatorへsource mapping、条件値、他actor output、human finalが露出した
- raw responseを人間が修正した、IDを推測補完した、batchの一部だけを採用した
- providerまたは画面表示model名を記録できない
- Copilotの基盤modelが不明/重複なのに別family adjudicatorとして扱おうとした
- 24件すべてのhuman finalなしにpilot完了またはcorpus反映を主張した
- 画像、PDF、restricted mapping、PII、credentialをcommitしようとした

停止後は既存artifactを上書きせず、reason、対象slot、hashを記録し、新run/versionで再開する。
