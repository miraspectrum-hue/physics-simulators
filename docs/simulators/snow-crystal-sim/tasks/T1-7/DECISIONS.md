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
