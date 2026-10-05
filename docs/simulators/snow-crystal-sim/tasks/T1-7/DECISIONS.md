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
