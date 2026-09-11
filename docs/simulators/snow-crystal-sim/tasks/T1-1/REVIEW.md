# T1-1 レビュー記録

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-1/DESIGN.md
    hash: sha256:6a5a930d9bc77b753cca34a8ccfd2bc0bc0934b9018bd6541f7749b81e71aea3
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-1/DESIGN.md:375
    problem: "指定された domain/__tests__ 配下のテストは現行 Vitest 設定の対象外であり、T1-1 の変更境界内だけでは自動テストを実行可能にできない。"
    evidence: "apps/snow-crystal-sim/vite.config.ts:9 の include は tests/**/*.test.ts だけである。一方、本書は src/simulators/snow-crystal-sim/domain/__tests__/ を指定し、11～12行目では変更境界を同 domain ディレクトリだけに限定する。tests/ への配置も vite.config.ts の変更も境界外になるため、現設計どおり実装すると npm test と verify-fast は passWithNoTests により対象テストを実行せず成功し得る。"
    required_change: "Vitest が実際に収集するテスト配置と T1-1 の変更境界を整合させる。例えば Coordinator が TASKS.md の境界へ tests/ と必要な設定変更を正式に追加したうえで tests/**/*.test.ts に置くか、vite.config.ts の include 変更を許可して domain/__tests__ を収集対象にし、その実行確認方法を設計へ記録する。"
  - id: R-002
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-1/DESIGN.md:7
    problem: "T1-1 の対象に TC-RNG 全体を含めているが、TC-RNG-002 の一部は本タスクで存在しない step API を検査するため、この工程では完全にテスト化できない。"
    evidence: "承認済み T1-0 TESTCASES.md:332-343 は TC-RNG-002 で step 中の PRNG 呼出し回数 0 を要求する。本書の 112～114行目も step が乱数を消費しない上位契約を掲げる一方、406行目では Reiter step の実装を T1-2 に明示的に残している。T1-1 でこの検査を追加すると未作成 API の依存エラーになり、追加しなければ割当ケースを完了できない。"
    required_change: "TC-RNG-002 を分割し、createLattice の列挙順・noise・seed・modelVersion の検査だけを T1-1 に割り当て、step の PRNG 非消費検査を T1-2 の具体的な対象テストへ追跡可能に移管する。"
  - id: R-003
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-1/DESIGN.md:44
    problem: "公開座標 API の有効入力域が、有限・安全な出力および絶対誤差 1e-12 の往復保証と両立しない。"
    evidence: "331～332行目は axial 入力を q、r、q+r が safe integer なら有効、Cartesian 入力を有限なら有効とする。しかし有効な (q,r)=(24149949,-48187277) を記載式で往復すると q の誤差は -3.725290298461914e-9、r の誤差は 7.450580596923828e-9 となり、1e-12 を超える。また axialNeighbors(Number.MAX_SAFE_INTEGER,0) は unsafe integer の近傍を返し、cartesianToAxial の有限な極大入力は Infinity を生成し得る。これは SPEC.md の NaN/Infinity 非生成要件と、出力を再び公開 API に渡せる座標契約を破る。"
    required_change: "座標 API の有効範囲を、全近傍が safe integer、変換結果が有限、宣言した往復誤差が成立する範囲へ制限するか、入力規模に応じた許容誤差と非有限結果の拒否規則を定義する。最大有効値、その直外、近傍加算境界、極大 Cartesian 値を独立テストへ含める。"
conditions: []
rollback_to: design
summary: "Reiter の著者公開版は二次元六角最近傍モデル、閾値1、受容セル、beta/gamma、alpha=1 の中心1/2・近傍1/12を支持し、xoshiro128** 作者参照実装は version 1.1、s[1] scrambler、非全ゼロstateを示す。座標基底、半径2の19セル・ring 12セル、単位と層境界は上位契約と整合し、PRNG の先頭5ベクトルおよび19番目 output 3571406116 と消費後stateも独立再計算で一致した。ただしテスト収集設定と変更境界の衝突、T1-2 API に依存するケース割当、座標APIの数値適用範囲に未解決事項があり、実装前に設計へ差し戻す必要がある。"
```

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-1/DESIGN.md
    hash: sha256:d123092864f7f6ddd70dec74c9a0705e8dfd11f531a82c5574ef6d2327946c96
findings: []
conditions: []
rollback_to: none
summary: "R-001〜R-003はすべて解消された。T1-1の変更境界にはvite.config.tsが正式に追加され、現行includeへ追加可能なexact glob、対象ディレクトリの明示実行、実行テスト数が0より大きいことの証跡要求によりpassWithNoTestsの偽成功を排除している。PRNG責務はcreateLatticeのTC-RNG-002AをT1-1、step非消費のTC-RNG-002BをT1-2へ追跡可能に分離した。safe-neighbor域 h<=M-1 は全6近傍のq・r・q+rを安全整数内に保ち、変換後の有限性検査、規模比例16ε許容差、最大有効値・直外値・大規模座標・極大Cartesian overflowの独立テストが定義された。座標式、半径2の19セル、xoshiro128** 1.1のs[1]式、先頭5ベクトル、19番目outputと消費後stateを独立再計算し、上位契約との整合および公開API・型・純粋性・依存境界に退行がないことを確認した。"
```
