# T1-7 判断記録

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
