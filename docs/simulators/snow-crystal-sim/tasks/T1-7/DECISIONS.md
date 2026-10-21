# T1-7 判断記録

## D-20: schema/prompt変更時のplan境界

- 状態: 人間承認済み（2026-10-21）
- 発見: D-19の完全な成果物チェーンを設計した結果、現行protocolにはcross-plan replacementを表現する契約がない。
  `schema-fix`とtemplateを伴う`prompt-change`はprotocol hashを変え、selection、manifest、restricted map、batch table、
  prompt variables、rendered evidence、slot planを再発行させる。一方replacement campaignは旧planのactive terminalを
  始点にする必要があるが、`InvalidAttemptEvidenceV1`はslot plan参照を1個しか持たず、旧planと新planを同時に証明できない。
- 現行設計で正当に表現できるもの:
  - `model-retry`: 入力不変、開始時active artifact file hashへ結合。
  - `input-change`: 同じprotocol/planのままbatch input table、prompt variables、rendered prompt/evidenceを再生成可能。
- 選択肢:
  1. **推奨・限定修正**: plan内replacementを`model-retry`と`input-change`だけにする。
     `schema-fix`とtemplate変更を伴う`prompt-change`は旧planを無効化し、新protocol・新planを未実行状態から開始する。
     supersessionではなく再計画として記録する。DESIGN、protocol、TESTCASES、D-19をこの意味へ限定修正する。
  2. 4種類すべてをreplacementとして維持する。campaign/evidence/ledgerへ旧planと新planの双方、cross-plan migration、
     root lineageを追加する大規模なschema・protocol再設計が必要になる。
- 推奨理由: 選択肢1は架空のcross-plan関係を作らず、既存のactive lineageを壊さない。変更範囲が小さく、
  現在利用するpilotの再試行・入力差替えを安全に表現できる。選択肢2は将来必要になった時点で独立タスクとして設計できる。
- 人間判断: 2026-10-21、選択肢1（推奨・限定修正）を採用。plan内replacementは`model-retry`と
  `input-change`だけに限定し、`schema-fix`とtemplate変更を伴う`prompt-change`は旧planを無効化して、
  新protocol・新planを未実行状態から開始する。cross-plan supersessionは導入しない。
- 境界の具体化:
  - `input-change`で同一plan内に変更できるのは、protocol/schema/template/manifest/画像hash/ID/orderを保った
    `BatchInputTableV1.attachmentSlot`と、そこから決定的に再生成されるprompt variables/evidence/rendered promptだけである。
  - schema bytes/object/reference、template bytes、placeholder/renderer、instruction wording/semantics、判断規則、mappingの
    変更は全て再発行対象であり、`schema-fix|prompt-change`をcampaign/ledger enumへ残さない。
  - 再発行後はselection以降を新protocol objectから作り直し、第一planはroot IDだけを事前freezeし、
    materialized root artifactが0件の未実行状態で開始する。
    旧root/active/campaign/evidence/ledger/snapshot/approval/coverageのmigration、supersession、hash参照を禁止する。
  - campaignの初期stateはvalid attempt 1だけを受理する。attempt 2/3のvalidは、同campaignで先行attempt 1、または1,2の
    immutable invalid evidenceが欠番・重複なく存在するretryable stateでだけ受理する。この規則をroot、
    `model-retry`、`input-change`の全系列へ明示適用する。
  - `PilotSelectionPlanV1`は固定`sourcePdfSha256`を直接持ち、protocol objectおよびcandidate setのPDF hashと一致させる。
  - schema/prompt変更時は、旧protocol、selection/slot plan、ledger cutoff、理由、UTCを直接結合するimmutable
    `PlanClosureV1`をterminal登録する。closure後の旧plan submission/root materialization/ledger追加は0件とし、
    closureは新plan参照も出edgeも持たない。新第一planはmaterialized root 0件で、旧ID/hashを一切再利用しない。

## D-19: InvalidAttemptEvidence 意味検証の3回連続未達

- 状態: 人間承認済み（2026-10-20）、replacement reasonの範囲はD-20で限定修正
- 根本原因: `InvalidAttemptEvidenceV1` の規範を個別fieldの手書き検証として追加してきたため、レビューごとに
  未網羅の意味制約が見つかった。テストやハッシュの問題ではなく、規範全体を一度に実装・検査する戦略が不足している。
- 連続試行:
  1. raw/model/record結合、privacy、campaign参照、DAGを追加したが、validation error codeとRFC 6901制約が未網羅だった。
  2. 13 codeとRFC 6901の正負例・実装を追加したが、replacement reason 4種類のうち`model-retry`以外の正例が未網羅だった。
  3. 16,036ケース、対象14/14 Green、型・構文・依存境界を通した後の独立レビューでも、規範上有効な
     `schema-fix`、`prompt-change`、`input-change`を実装が拒否することが判明した。
- 選択肢:
  1. **推奨**: 個別修正を止め、§8.1の規範表から4 replacement reasonと対応hash authorityを表駆動で実装する。
     4正例、reason/hash交換負例、完全schema mutationを追加し、別のfresh reviewerが規範表との全行照合を行う。
  2. pilotでは`model-retry`だけに制限する。承認済みprotocolを狭める設計変更となるため、DESIGN/protocol/testcaseの
     再設計・人間承認が必要で、将来のschema/prompt/input変更証跡を扱えなくなる。
  3. pilot validatorをここで停止し、T1-7本体へ進まない。
- 推奨理由: 選択肢1は既承認protocolを変更せず、今回の反復原因である手書きの部分検証を解消できる。
- 人間判断: 2026-10-20、選択肢1（推奨案）を採用。実装とテストは同じ対応表を共有せず、別々の権威表から
  4種類すべての正例、reason/hash交換負例、完全schema mutationを導出し、fresh reviewerが規範表と全行照合する。
- D-20による後続修正: 完全なartifact chainを設計した結果、`schema-fix|prompt-change`は同一planのreplacementとして
  正当に表現できないことが判明した。このためD-19の「4種類すべて」は現行契約では`model-retry|input-change`の2行へ
  置き換える。表駆動、実装/テストの独立authority、reason/hash交換負例、全行照合という根本対策は維持する。

## D-01: 出典内IDの扱い

- 状態: 設計決定
- 決定: Figure 2 は各 panel の条件を示すが、機械可読の著者付与 observation ID を示さない。
  `L23-F2-Pxx-Nxxx` を page と page-local panel ordinal から作る派生 ID とし、
  `sourceIdKind="derived-page-panel-id"` を必須にする。
- 理由: 架空の著者 ID を作らず、原資料の page/panel へ一意に戻れるため。

## D-02: 寸法と不確かさ

- 状態: 設計決定
- 決定: 全点の source dimension は panel に記された正方形 field-of-view の物理寸法とする。
  これを結晶直径・厚みと呼ばない。論文が与える temperature `±0.2 °C` と supersaturation
  `[0.8,1.2] × stated` だけを source uncertainty とし、growth time と field-of-view は
  `not-reported` とする。
- 理由: 論文本文 pp. 7–8 と Figure 2 caption が明示する範囲を越えないため。

## D-03: 形態タグの provenance

- 状態: 人間決定済み（2026-09-29）
- 事実: Figure 2 は機械可読の形態タグを与えず、論文は 2D projection から 3D morphology を
  理解するには経験が必要と述べる。写真は well-formed/symmetric な代表例を主観選択している。
- 決定:
  1. `docs/agent-architecture-codex.md` に従う開発支援用エージェントを、互いの出力を見ない独立した
     2セッション A/B として使い、両者が全206点の草案を同じ基準で作る。シミュレータアプリへ
     agent/AI 機能は組み込まない。
  2. A/B の全 field と high confidence が一致する点は、人間が locator と判定を並べた一覧でまとめて
     確認し batch 承認できる。不一致、low confidence、一致していても medium confidence の点は、
     人間が hash 一致済み原 PDF の該当 panel を個別確認する。
  3. 全206点を batch または個別承認のどちらかで重複なく覆う。承認対象ID集合、草案hash、最終値hash、
     原PDF hash、承認role、UTC日時を保存し、氏名・メール・account IDなどの個人情報は保存しない。
  4. 人間承認前の tag は loss、baseline、候補順位、holdout、T1-8/T1-10 の較正入力に使用できない。
- 理由: 二重の独立草案で曖昧な写真を見つけやすくしつつ、AIが作った分類をAI自身の正解として
  循環利用することを避ける。全件を人間が一から転記する負担は、明確な一致点のbatch確認で抑える。
- 影響: `DESIGN.md` §5.1 の approval schema と適格性を満たすまで corpus は incomplete である。

## D-04: 実画像のリポジトリ収録

- 状態: 設計決定
- 決定: 論文 PDF と Figure 2/panel crop はコミットせず、v1 恒久 URL、raw PDF hash、locator、
  raw label、監査記録だけを収録する。
- 理由: traceability を保ちつつ、論文図版の複製配布を避けるため。

## D-05: loss と acceptance

- 状態: 設計決定
- 決定: physical time と実寸は報告専用。loss は形態 tag/rank と dimensionless shape の二成分を
  別々に保持する。acceptance は condition-blind / nearest-train baseline に対する Pareto
  improvement とし、根拠のない絶対正解率を置かない。
- 理由: 論文は本アプリの二次元 CA に対する正解率や較正閾値を与えず、物理秒と CA step の対応も
  定義されていないため。

## D-06: テストコード工程を3領域へ分割

- 状態: 人間決定済み（2026-09-30）
- 対象: `apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2.test.ts`
- 事実:
  1. テストコードの初回レビュー、修正1回目の再レビュー、修正2回目の自己監査で、同じ根本原因が
     3回連続して残った。
  2. 改善済みなのは、5成果物ごとの独立した期待 Red、JSON duplicate key、非ネットワーク境界、
     一部の rank/CDF/24実行/candidate/baseline/Pareto fixture である。
  3. 未達なのは、5種類の完全な再帰 schema validator、annotation/projected-shape の承認済み
     literal fixture、holdout の child-process 競合および crash/restart 状態行列である。
  4. 未達のままでは、壊れた較正データや holdout 漏洩をテストが見逃すため、期待 Red の正式記録と
     test commit へ進めない。
- 決定: T1-7 の要求や受入基準は変えず、テストコード工程だけを次の3つの独立ファイル・順次レビューへ
  分割して組み直す。
  1. schema/artifact: CorpusV1、SourceAuditV1、SplitV1、ProtocolV1、annotation、shape、成果物境界
  2. scoring/protocol: split、rank、CDF、scale、seed、candidate、baseline、Pareto
  3. holdout-safety: sealed record、排他 marker、atomic write、child-process race、crash/restart、漏洩防止
- 不採用案: 現在の単一ファイルのまま4回目の全面修正を行う。一度に扱う契約が大きく、同じ欠落を
  繰り返す可能性が高いため採用しない。
- 再開条件: 各ファイルの担当 testcase、共有 test helper の所有権、5件の期待 Red の配置を
  `TESTCASES.md` に明記し、testcase review を再承認してからテストコードを組み直す。

## D-07: schema/artifact テスト実装担当の例外切替

- 状態: 人間決定済み（2026-10-01）
- 対象: `libbrecht-2023-figure2-schema-artifacts.test.ts`
- 事実:
  1. D-06 の3分割とテストケース再レビューは完了し、schema/artifact の担当範囲は独立した。
  2. DeliveryBuilder による初回実装、修正1回目、修正2回目の3回で、5成果物の独立 Red、
     duplicate key、型検査は改善した。
  3. 3回とも、完全な再帰 schema、独立 SourceAudit、annotation/projected-shape の既知値、
     Split/Protocol の全 mutation、REAL206 相互照合が簡略化されたまま残った。
  4. 現在のテストは正しい成果物を拒否し、壊れた成果物を受理し得るため、test-code gate と
     test commit へ進めない。
- 決定: この1ファイルのテスト実装に限り、通常のコスト重視 DeliveryBuilder から高性能モデルの
  書込みエージェントへ例外的に切り替える。承認済み DESIGN/TESTCASES、変更境界、独立 Reviewer、
  3回失敗時停止、非設計コミットのゲートは変更しない。
- 不採用案: schema/artifact をさらに小さい testcase 群へ分け、同じ DeliveryBuilder 帯で順次実装する。
  ファイル配置は維持できるが、同一ファイルへの複数回編集とレビューが増え、完了まで長くなる。
- 停止理由: 同一根本原因の3回反復、およびエージェント設計書の「コスト重視モデルから高性能モデルへ
  切り替える場合は人間確認」に該当する。

## D-08: scoring/protocol テスト実装担当の例外切替

- 状態: 人間決定済み（2026-10-01）
- 対象: `libbrecht-2023-figure2-scoring-protocol.test.ts`
- 事実:
  1. DeliveryBuilder による初回実装、修正1回目、修正2回目の3回で、型検査、代表 CDF、
     格子数、ring、8 seed hash/state などの一部は正しくなった。
  2. 3回目にも split が仕様の「hash昇順の先頭をholdout」ではなく末尾をholdoutにしている。
  3. rank/shape の全階層、scale の完全証跡、baseline/comparator の導出、checkpoint と
     fresh-process 決定性が、定数または途中階層の省略で迂回可能なままである。
  4. この状態では誤った較正候補を正しいと判定し得るため、test-code gate へ進めない。
- 決定: D-07 と同様、この1ファイルに限り高性能モデルの書込みエージェントへ切り替え、
  承認済み TESTCASES と直近レビューの6項目を満たすまで再構築する。独立 Reviewer と全ゲートは維持する。
- 不採用案: scoring/protocol をさらに複数ファイルへ分割する。ただし D-06 の3ファイル構成と
  TESTCASES.md を再変更・再レビューする必要がある。
- 停止理由: 同一根本原因の3回反復、およびコスト重視モデルから高性能モデルへの切替に人間確認が
  必要な例外へ再度該当した。

## D-09: holdout-safety テスト実装担当の例外切替

- 状態: 人間決定済み（2026-10-01）
- 対象: `libbrecht-2023-figure2-holdout-safety.test.ts`
- 事実:
  1. DeliveryBuilder による初回実装、修正1回目、修正2回目の3回で、基本スキーマ、JCS関係、
     EEXIST変換、正常train境界の一部は改善した。
  2. 完全な独立literal永続化オラクル、子プロセスでの完全open protocol、crash/state行列、
     copied-directory手続き境界が3回目にも未達だった。
  3. 未達のままではholdout漏洩、二重開封、クラッシュ後の再開をテストが見逃し得る。
- 決定: 2026-10-01 の人間指示「高性能モデルを使いたい場合は切り替えて続行してください」に基づき、
  この1ファイルも高性能モデルの書込みエージェントへ切り替える。承認済みTESTCASES、独立Reviewer、
  test commitゲートは維持する。
- 不採用案: 通常DeliveryBuilderで4回目を繰り返す。同じ省略が3回継続したため採用しない。

## D-10: 原資料監査を独立A/B候補＋人間全件確認へ変更

- 状態: 人間決定済み（2026-10-08）
- 対象: `DESIGN.md` §6.1 のうち、`human-source-auditor` が A/B を見ずに全206件を blank から
  再転記する手順だけ。D-03 の形態タグ、人間の最終責任、206 panel 全件確認、未承認値を loss に
  入れない規則、その他の物理・較正契約は変更しない。
- 事実:
  1. 独立した Transcriber A/B は原 PDF の全206件を転記済みである。両者の normalized value は全件で
     一致する。systematic な raw 差は square-field-of-view unit の U+03BC GREEK SMALL LETTER MU と
     U+00B5 MICRO SIGN だけであり、PDF raster 上の同形 glyph から Unicode code point は決められない。
  2. 人間が blank form へ32件を直接入力・確認した時点で、206件すべての再入力は疲労と転記ミスを
     増やし得ると判断した。これは token 節約のためではない。
  3. LocalStorage backup SHA-256
     `9fd9708029f553e386dfd2dece8df5f8237d5c8b586502d90bfbe93b8bb47f0c` は33 entry object を持ち、
     32件が complete/confirmed、末尾 `P11-N033` は blank/incomplete である。32件の normalized value は
     A/B双方と一致し、raw は少なくとも片方の spelling と一致する。
- 決定:
  1. A/B は互いの出力、人間入力、比較結果を見ない独立セッションのまま、206件ずつの draft を
     別々の JCS SHA-256 で凍結する。両 draft の完成・件数・hash が確定する前に確認 UI へ候補を
     prefill しない。
  2. exact match は一つの proposed raw/normalized pair を表示できる。不一致は A/B の両候補を highlight
     し、default を選ばない。µ unit の二 code point だけは、数字、末尾 `m`、normalized µm値が一致する
     場合に限り canonical equivalent とし、final raw は U+00B5 `µm` とする。A/Bの元文字列はhash済み
     draftに残し、他の文字差へこの例外を広げない。
  3. 人間は同じ hash の原 PDF panel を全206件で目視し、temperature、supersaturation、growth time、
     square field of view の各 raw/normalized pair を能動操作で確認または訂正する。未確認値は
     `SOURCE-AUDIT.json`、corpus、split、lossへ入れない。訂正・disagreement解決は、氏名、メール、
     account ID、端末名を含まない非空 rationale を残す。
  4. backup の32 confirmed entryは、人間がすでに原 panel から直接確認した値としてそのまま移行し、
     AI候補で上書きしない。backup自体はcommitせず、hash、件数、移行ID集合hash、上書きなしの宣言を
     保存する。blank の `P11-N033` は未確認として通常の候補確認へ回す。
  5. 人間が候補を見る以上、旧手順の第三 blank transcription と同じ独立性はない。この限界を明記し、
     A/B事前凍結、原画像の常時併置、disagreementのdefaultなし、field別の明示確認、訂正理由、206件
     完全性検査で confirmation bias と共通誤りの risk を低減する。人間が最終値へ責任を持つ点は
     弱めない。
- 理由: 人間の原資料判断を維持しながら、機械的な再入力負担と疲労由来の誤りを減らすため。
  A/B候補を正解として無条件採用せず、全panelの人間目視とfield別承認を必須にする。
- 既存入力の保全: 画面実装やLocalStorage移行を行う前に上記backup hashを再検証し、32 confirmed値を
  上書きしない migration test を通す。移行不能またはhash不一致なら処理を停止し、人間へ報告する。
- 無効化: この決定で `DESIGN.md` が変わるため、従来のdesign review、`TESTCASES.md` とそのreview、
  既存test-code review、期待Red、implementation evidenceはstaleである。既存のtest commitを履歴から
  消さないが、修正版designの承認・design commit後にtestcase修正と再レビュー、test修正レビュー、
  新しい期待Redを順に完了するまで監査UI/corpus実装へ進まない。A/B draftそのものは、独立性証跡、
  206件完全性、凍結hashを再検証できる場合に限り再利用できる。

## D-11: source-audit再設計後のschemaテスト実装を高性能モデルへ再切替

- 状態: 人間決定済みのD-07および「必要なら高性能モデルへ切り替えて続行」の再適用（2026-10-09）
- 対象: `apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts` のうち、
  D-10で変更した `TC-SOURCE-AUDIT-001..005` と関連する `TC-REAL-001` のテストコード化。
- 事実:
  1. 通常DeliveryBuilderによる初回、修正1回目、修正2回目の3回で、型検査、期待Red、
     A/B/comparison既知hash再構築、freeze/stale graphは改善した。
  2. 3回目の独立レビューでも、LocalStorage移行mutationが同じmigration-conflictへ先に到達すること、
     206×4 workflowが凍結候補・32件移行・期待ID集合へ結合されていないこと、action表が
     comparison/proposal/backup tupleへ結合されていないことがhigh findingとして残った。
  3. 同一根本原因の3回反復により、通常DeliveryBuilderで4回目を行う条件を満たさない。
- 決定: D-07で人間承認済みの例外を同じファイルへ再適用し、高性能モデルの書込みエージェントへ
  切り替える。変更境界、承認済みDESIGN/TESTCASES、fresh Reviewer、期待Red、非設計自動コミットの
  各ゲートは変更しない。
- 不採用案: 通常DeliveryBuilderで4回目を繰り返す。同じ未結合・到達不能mutationが3回続いたため採用しない。

## D-12: source-audit確認ツール実装を高性能モデルへ切替

- 状態: 人間の「必要なら高性能モデルへ切り替えて続行」指示の再適用（2026-10-10）
- 対象: `tmp/snow-crystal-t1-7/source-audit-capture/` の一時確認ツール。production app、corpus、
  DESIGN/TESTCASESの契約は変更しない。
- 事実:
  1. 通常DeliveryBuilderによる初回、修正1回目、修正2回目の3回で、候補hash、localhost限定、
     画像token、共有validatorなどは改善した。
  2. 3回目にも、固定実backup後半12件のU+03BC rawを候補Bだけに照合して移行後stateを拒否すること、
     検証前に旧LocalStorageを上書きし得ること、action/migration/PDF証跡の完成validator迂回、
     必須moduleのserver allowlist漏れが残った。
  3. 同一の安全な移行・状態結合不足が3回反復したため、通常DeliveryBuilderで4回目を行わない。
- 決定: この一時ツールの修正に限り、高性能モデルの書込みエージェントへ切り替える。旧LocalStorageを
  実ブラウザで操作する前に、実backupのread-only検証、atomic migration、共有validator、module graph、
  独立Reviewerの承認を必須とする。監査画面は承認後にだけ起動する。
- 不採用案: 不完全な現画面で人間確認を再開する。既存32件を失う危険があるため採用しない。

## D-13: 複数AI形態注釈草案の3回レビュー後停止と限定修正

- 状態: 人間決定済み（2026-10-15）
- 対象: 非規範・未採用の
  `MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.md`。現行 `DESIGN.md` §5.1 と D-03、画像、
  LocalStorage、既存の人間確認結果は変更しない。
- 事実:
  1. 初回草案の独立レビューでは、観察値から現行enumへの写像に未定義組合せがあり、完全な
     truth tableと相互制約が必要とされた。
  2. 1回目の修正後レビューでは、branch対象が不可視だがbasal面は見える組合せを合法に表現できず、
     同じ全組合せ被覆の不足が残った。
  3. 2回目の修正後レビューでは、hollowing対象が十分見え、opening/rim/innerWallが全てclearだが
     新成長への帰属がuncertainである1組だけが、合法とされながらどのlabelにも写らなかった。
  4. 画像RGBA hash preimageとtransport状態行列にも、独立実装を一意にするための限定修正が3点残る。
  5. 現行仕様は一切変更されておらず、草案をpilotやcorpusへ使用していない。
- 停止理由: 「合法な全観察組合せを一つのlabelまたはschema-invalidへ送る」という同じ根本原因が、
  初回作成と2回の修正を経た3回の独立レビューで反復したため、通常工程で自動的に4回目へ進まない。
- 選択肢:
  1. **推奨**: fresh ArchitectPhysicsへ、残る3 findingだけを小さく分割して限定修正させ、別のfresh
     Reviewerで再確認する。実行可能なJSONL/hash契約を草案に残せる。
  2. 草案を概念設計へ縮小し、完全schema、truth table、hash契約を後続の正式設計タスクへ分離する。
     今回の文書は短くなるが、そのままpilotには使えない。
  3. 既知findingを残したまま草案として受け取る。誤分類とprovenance不整合の可能性があるため非推奨。
- 決定: ユーザーが選択肢1を承認した。fresh ArchitectPhysicsが未写像だったhollowing 1組、3種類の
  RGBA hash preimage、画像transport状態行列だけを限定修正し、fresh Reviewerがhash
  `fcfa38879c41ef626a16ab953977e5a29d6f1f809d676c50a4cbb1087a7ad097` の草案をfindingなしで
  `approved` とした。草案は引き続き非規範・未採用であり、現行 `DESIGN.md` §5.1 と D-03を変更しない。

## D-14: 複数AI形態注釈の24画像・案A pilot準備

- 状態: 人間決定済み（2026-10-16）、準備設計のみ。pilot未実行
- 対象: 非規範・未採用の `MORPHOLOGY-ENSEMBLE-ANNOTATION-DRAFT.md` と
  `PILOT-RUNBOOK.md`。現行 `DESIGN.md` §5.1、D-03、schema、画像、LocalStorage、既存human approvalは
  この決定では変更しない。
- 人間決定:
  1. 最初のpilotは案Aを採用し、AI一致/highを含む24画像すべてを人間が最終確認する。
  2. 24画像はFigure 2のPDF pp. 11–14から各6画像とし、同じ順序の12画像×2 batchで各annotatorへ渡す。
  3. 独立annotatorはClaude Code（VSCode）、Codex（VSCode）、Gemini Chat（APIなし）を基本とする。
  4. GitHub Copilotは、画面に表示された基盤modelが3 annotatorのfamilyと重複しないと記録できる場合だけ、
     別familyのfresh adjudicator候補にする。重複または不明なら人間決定へ戻す。
- transportの限定修正:
  - 3 actorへ同じlocal blinded derivative bytesを渡し、送信前のfile hash、decoded RGBA hash、寸法、MIME、
    transformなし、attachment previewを必須にする。
  - provider受領bytes/pixelsが公開されないVSCode/chatでは `transportAssurance='local-input-only'` を許す。
    この場合はprovider内部preprocessを必ず `unobservable`、policy version/evidenceを `null` と記録し、
    provider/modelが受け取ったpixelsの同一性を主張しない。
  - provider受領bytesまたはdecoded pixelsを検証できる場合は `verified-bytes` / `verified-pixels` として、
    より強い保証を残す。`documented-no-transform` は、版付き公式policy artifactが受領後からmodel入力まで
    変換なしを明示し、その一致hashを保存できる場合だけ許す。
  - preview上のcrop、破損、向き変更、過度な縮小、mask欠落、画像/匿名ID対応欠落はreceipt公開の有無に
    かかわらず停止する。
- 理由: 実際に利用できるClaude Code/Codex/Gemini Chatはprovider受領hashを通常公開しないため、D-13時点の
  `not-exposed => run停止` ではpilotを実行できない。一方、観測不能なprovider内部処理を同一pixelと断言する
  こともできないため、local入力の固定と保証レベルの明示を分ける。
- 限界: これはpilot準備の決定であり、3-agent方式を現行corpus工程へ正式採用する決定ではない。画像生成・
  model実行前に `DESIGN.md` §5.1、D-03、schema、tests、approval workflowを正式改訂し、独立reviewと
  必要な人間承認を通す。物理的分類定義、Reiter CA、較正値、現行human finalは変更しない。

## D-15: 24画像・案A ensemble pilotの正式採用と安全なadjudicator fallback

- 状態: 設計決定（2026-10-16）。pilot実行前
- 人間決定: Figure 2の24画像で案Aを試し、準備を開始する。草案等の設計変更はcommitする。
- 決定:
  1. `DESIGN.md` §5.1Aを、24画像pilotだけに適用する正式契約として採用する。PDF pp. 11–14から各6画像、
     Claude Code/Codex/Gemini Chat、12画像×2 batch、24件すべての人間finalを固定する。完全なartifact DAG、
     schema、hash preimage、exact promptは規範artifact `MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md` のcontract ID
     `t1-7-morphology-ensemble-pilot-contract/1` / protocol ID `morphology-ensemble-pilot/1`を取り込む。
  2. pilotはcommit外sidecarであり、現行§5.1、D-03、`MorphologyAnnotationV1`、既存A/B、既存human final、
     source audit、LocalStorageおよびproduction corpusを変更しない。pilot coverageは206件coverageの代用に
     せず、残り182画像またはT1-8へ進む許可にも使わない。
  3. 選定は画像作成前に、各page6件、proxy-stratum多様化、固定seed/hash algorithmでfreezeする。
     proxyは対象選定だけに使い、annotatorへ見せず、正解またはground truthと呼ばない。
  4. fresh adjudicatorは、不一致またはindeterminate routeだけに使う。GitHub Copilotは、画面表示された
     基盤model familyが3 annotator familyのいずれとも重複せず、その表示名を記録できる場合だけ候補にする。
     重複、不明、利用不能またはrun失敗ならAI adjudicationを省略し、該当IDを直接human individualへ送る。
     Option Aでは全24件を人間が確認するため、このfallbackは安全要件を弱めない。
  5. provider受領bytes/pixelsを公開しないclientでは、同一local bytes、送信前hash、transformなし、preview、
     `internalPreprocessing=unobservable` を記録した `local-input-only` を許す。provider/modelへ同一pixelが
     到達したとは主張せず、assurance別に結果を報告する。
  6. pilotのmetricsは記述的・探索的である。結果後のthreshold、selection、prompt、schema、mapping変更を
     同じ24件の採用性能として再主張しない。残り182件への展開またはcorpus移行には、新しい人間決定と
     正式設計・test・reviewを要求する。
- 物理検証上の限界: annotationは2D投影上のproject labelであり、三次元の成長軸、枝次数、空洞、c/a比、
  論文著者の分類または物理的ground truthを確定しない。温度、過飽和度、時刻、視野寸法から画像にない構造を
  補完しない。曖昧さは`indeterminate|null`として残す。
- 著作権・privacy: PDF、crop、derivative、restricted mapping、raw chat/model response、PII、credential、
  chat URLをcommitしない。task evidenceへ収録できるのはprivacy/copyright検査済みのhash、件数、集計、
  制約、停止理由だけである。
- 無効化と次gate: `DESIGN.md`のfresh reviewを要求する。`TESTCASES.md`、test-code review、期待Redは、
  pilot sidecar validatorを追加する範囲だけstaleとする。既存source-audit、人間入力、production corpus契約、
  既存test意図を消去・上書きしない。design承認・commit後にpilot分のtestcase review、test code review、
  期待Red、validator Greenを順に完了するまで、画像作成とmodel実行を開始しない。

## D-16: 正式pilot契約の3回レビュー後停止と残る2点

- 状態: 人間判断済み（2026-10-16）
- 対象: `DESIGN.md` §5.1Aと規範artifact
  `MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md`。24画像・案A、production隔離、画像、LocalStorage、
  既存人間確認結果は変更しない。
- 反復した根本原因: 「規範プロトコルだけからartifact DAG、hash参照、promptと実行結果を
  一意に再構成できること」の不足が、初回review、1回目修正後review、2回目修正後reviewの
  3回で継続した。
- 解消済み: 24件限定、各page6件、3 actor×2 batch、全24件human final、完全mapping、
  transport 972状態、非循環batch input hash、literal route 64組、actor/family/slot拘束、
  非重複adjudicatorまたはdirect-human fallback、正確promptと著作権・privacy境界。
- 残る2点:
  1. schema-invalidなmodel応答は正式slot artifactを作れないのに、現契約はそれを
     supersession chainに入れるよう求め、retry後のactive terminalを合法に作れない。
  2. promptへ挿入するrole別payload schema objectが、protocolのrole別schema file hashと
     byte単位で結合されておらず、別schemaの挿入を機械的に拒否できない。
- 選択肢:
  1. **推奨**: fresh ArchitectPhysicsが残る2点だけを限定修正する。invalid responseは
     slot/supersessionを消費しないimmutable attempt evidenceとして別管理し、最初のvalid wrapperを
     rootにする。PromptVariablesにrole別schema file hashを追加し、protocol・canonical JSON・
     rendered prompt・vision header間の完全一致を要求する。その後fresh Reviewerで再確認する。
  2. retry契約を簡略化し、schema-invalidが1回でも出たactor/batchはパイロット全体を新versionで
     最初からやり直す。状態は単純になるが、他の正常batchもやり直すため作業量が増える。
  3. 現契約の不整合を既知の制約として残す。retryとpromptの再現性を保証できないため
     非推奨であり、このままpilotを開始しない。
- 推奨理由: 選択肢1は既存の24件・案A契約と安全境界を変えず、変更範囲が
  retry状態とrole別schema hashの2点に限定できる。
- 人間判断（2026-10-16）: 選択肢1（推奨案）を採用する。schema-invalid responseはslot artifact IDを
  消費せずsupersession ledgerへ入れないimmutable attempt evidenceとして保存し、campaignごと最大3回、
  3回目のinvalidでfail closedとする。最初のschema-valid wrapperだけが凍結root IDを取得する。
  role別payload schemaは`PromptVariablesV1.schemaFileSha256`を介してprotocol、LFなしcanonical JSON、
  rendered prompt evidence、vision headerへbyte単位で結合する。24画像・案A、actor選定、mapping、prompt本文、
  production隔離、残り182件禁止は変更しない。

## D-17: pilot test-codeの3回未達と実装担当の切替候補

- 状態: 人間判断済み（2026-10-16）
- 対象: `apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot.test.ts` と、
  必要な場合に追加するtest専用support moduleだけ。production code、画像、LocalStorage、既存testは変更しない。
- 実施済みの試行:
  1. 通常DeliveryBuilderによる初回実装は、期待Redとtypecheckを成立させたが、将来validatorを呼ばず、
     test内local helperだけを検査していたため、空のvalidator実装でも通過できる状態だった。
  2. 同じ担当による修正は、`validatePilot(caseName, fixture)` の動的API要求を追加したが、承認済み
     testcaseが要求する完全なfixture、mutation、provenance DAGを実装しきれなかった。
  3. fresh DeliveryBuilderによる再実装は、206候補の選定、PNG/CRC/Adler/stored DEFLATE境界、
     branch/confidenceの一部oracle、invalid response provenanceを改善したが、transport 972状態、
     22 schema、run/attempt、consensus/slot/ledger/adjudication、approval/coverage、isolation/metrics、
     validator mutation coverageが未完成のまま残った。
- 反復した根本原因: 承認済みTESTCASESが求める独立したliteral fixture、mutation集合、完全な
  provenance DAGを、簡略fixtureとtest内helperへ置き換えてしまうことが3回続いた。
- 現在地: typecheckは成功し、対象testは19件成功＋将来validator欠落による期待Red 1件である。
  ただしtest-code reviewは`changes-requested`で、test-code gateは未承認、commitも未実施である。
- 選択肢:
  1. **推奨**: pilot test-codeだけを高性能モデルの書き込み担当へ切り替える。R-001〜R-010を
     小さなtest専用support moduleへ分割し、writerを直列化して順に完成させる。承認済みDESIGN、
     TESTCASES、期待Red、独立reviewなど既存gateは維持する。
  2. TESTCASESを「選定・画像bytes」「mapping・transport・prompt」「run・DAG・approval・isolation」の
     3 test fileへ正式分割し、testcase reviewからやり直す。通常DeliveryBuilderを維持できるが、
     設計・reviewの手戻りとgate数が増える。
  3. test範囲を縮小する。正式pilot契約の保証を弱めるため非推奨であり、design reapprovalが必要になる。
- 推奨理由: 選択肢1は設計と受入条件を弱めず、未完成部分だけを小さく分割して高性能担当へ移せる。
  productionや既存の人間確認結果へ影響せず、最短でtest-code gateへ戻れる。
- 人間判断（2026-10-16）: 選択肢1（推奨案）を採用する。pilot test-codeだけを高性能モデルの
  書き込み担当へ切り替え、R-001〜R-010をtest専用support moduleへ分割して直列に完成させる。
  承認済みDESIGN、TESTCASES、期待Red、独立reviewなど既存gateを維持し、production code、画像、
  LocalStorage、既存test、人間確認結果は変更しない。

## D-18: oracle再利用防止の3回未達とfail-closed方式への切替候補

- 状態: 人間判断済み（2026-10-17）
- 対象: pilot validatorがtest専用oracle、fixture、test本体を読み、入力を検証せず期待値を再生することを
  防ぐdependency gate。production code、設計、物理分類、画像、LocalStorage、人間確認結果は変更しない。
- 解消済み: R-002〜R-010、22 schema全到達制約、approval別closure、全二項率Wilson、validator call単位の
  write監査は独立reviewで解消確認済み。対象Vitestは13 Green＋missing-validator期待Red 1件、typecheck成功。
- 3回反復した根本原因:
  1. 初回reviewではvalidatorが同じdirectoryのoracle/fixture registryをimportして期待値を再生できた。
  2. 修正後reviewでは`node:module`のnamespace/default importから`createRequire`を得る経路が残った。
  3. 追加修正後reviewではcomputed key、computed destructuring、`bind`/`call`、comma alias、
     `Reflect.get`、`process.getBuiltinModule('module')`による同等の動的loader経路が残った。
- 現在の問題: JavaScriptの動的な値伝播を個別にtaint追跡する方式では、別表現のloader取得経路を
  完全に列挙しにくい。既知攻撃例を増やすだけでは、新しい同等表現が再び抜ける可能性がある。
- 選択肢:
  1. **推奨**: dependency gateをfail-closedな静的import allowlistへ置き換える。validatorとその依存closureは
     literalなstatic `import`だけを許し、許可されたbuiltinとvalidator専用moduleだけを正規化済みpathで列挙する。
     `node:module`/`module`、`createRequire`、`require`、dynamic `import()`、`process.getBuiltinModule`、
     `eval`/`Function`、非literal specifierは表現方法にかかわらず拒否する。既知の全攻撃例と正常static importを
     自己検査し、fresh Reviewerで再確認する。
  2. validatorを隔離child processで実行し、test support directoryへのfilesystem readとmodule loadを
     OS/process境界で拒否する。静的解析への依存は減るが、sandbox、Windows対応、実行時間、保守負荷が増える。
  3. 現在のtaint追跡をさらに拡張する。変更は局所的だが、JavaScriptの別表現を追い続ける構造が残るため非推奨。
- 推奨理由: 選択肢1は「許可した構文と依存だけ通す」ため、未知のloader表現を既定で拒否できる。
  validatorはtest専用の限定artifactなので、一般的なJavaScript module表現を許す必要がなく、変更範囲も
  `pilot-oracle.mjs`とその自己検査に限定できる。
- 人間判断（2026-10-17）: 選択肢1（推奨案）を採用する。dependency gateをfail-closedな
  静的import allowlistへ置き換え、validatorと依存closureにはliteralなstatic importだけを許可する。
  動的loader、非literal specifier、評価系APIは表現方法にかかわらず拒否し、既知攻撃例と正常な
  allowlist内static importを自己検査した後、fresh Reviewerで再確認する。
