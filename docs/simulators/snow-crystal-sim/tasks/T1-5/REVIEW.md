# T1-5 レビュー記録

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-5/DESIGN.md
    hash: sha256:01748bd68f68102d3b53a97ed286e3c8258cc1fc9db9867e56bd6c1f7b078116
findings:
  - id: R-001
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-5/DESIGN.md:116
    problem: 外周 reservoir ring の ice=1 を有効な保存状態として受け入れる設計になっている。
    evidence: 本書は ice の各要素を 0/1 のみで検証し、外周も通常の受容判定に含める。一方、上位の T1-0 DESIGN §5.3 は外周 ring 自体を凍結させないと定めている。外周 ice=1 を持つ改変状態でも水量監査が正常値を返し、状態不変条件違反を検出できない。
    required_change: 外周 ice=1 を状態不変条件違反として RangeError で拒否することを検証順とテスト方針に明記する。
conditions: []
rollback_to: design
summary: 相分類、Kahan 集計、既知値、単位、独立性、overflow 方針は上位契約と整合するが、reservoir ring の氷不変条件の検証が欠けている。
```

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-5/DESIGN.md
    hash: sha256:160a63877532a23ad5bc5de1bfad321e76f4c6aef9fedbd08f49f38d302f6fa3
findings: []
conditions: []
rollback_to: none
summary: 前回指摘された外周 ring の ice=1 は、集計前に RangeError で拒否する設計へ修正済み。相分類、Kahan 集計、検証順、独立性、単位、適用範囲は上位契約と整合する。半径2の既知値と補償和の識別例も独立に確認した。
```

```yaml
review_type: testcases
status: changes-requested
reviewed_files:
  - path: AGENTS.md
    hash: sha256:4dee0eb9aff74010fd8d8625aa75e15691cc100c7f4c1dcc71823836efdbbc90
  - path: apps/snow-crystal-sim/AGENTS.md
    hash: sha256:63fdad1bcd657afc9aa2aa6f00658649b565b7dd53c71675d155b0daea036761
  - path: docs/simulators/snow-crystal-sim/SPEC.md
    hash: sha256:dc07d48fb2a2360f67cef0e9dfc58b5686561edcc9904dc4236afbf17ec162b5
  - path: docs/simulators/snow-crystal-sim/DESIGN-OUTLINE.md
    hash: sha256:822c47deb32cf5bb6791ce080c8e13612723bcbccaed59fb60e4ef9512e0d7bf
  - path: docs/simulators/snow-crystal-sim/TASKS.md
    hash: sha256:d20289c431530fea86ab5619a5d32cfaa5287d3fb7104cba105ae8539c7b2f0d
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/DESIGN.md
    hash: sha256:f47bd555be23a1e26e745e3f08b013cfb925e00638bcc6937ceccc4634804e63
  - path: docs/simulators/snow-crystal-sim/tasks/T1-5/DESIGN.md
    hash: sha256:160a63877532a23ad5bc5de1bfad321e76f4c6aef9fedbd08f49f38d302f6fa3
  - path: docs/simulators/snow-crystal-sim/tasks/T1-5/REVIEW.md
    hash: sha256:6dfcaf9139f092abb380ff5024915ac7a59dedbec1591aee2f424691edec4104
  - path: docs/simulators/snow-crystal-sim/tasks/T1-5/TESTCASES.md
    hash: sha256:8354dce7419ae348653381283cd6a2700fef1b93cd3c2955e708e3aab08d6c9a
findings:
  - id: R-001
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-5/TESTCASES.md:58
    problem: Kahan 補償和の識別ケース VB-08 は mobile 側だけを検査し、deposited 側を単純逐次加算に置き換えた実装を検出できない。
    evidence: T1-5 DESIGN §3 は mobileVapor と depositedWater に別々の Kahan accumulator を要求する。VB-01〜07 の deposited 期待値は小さい値の和、VB-O2 は overflow であり、deposited 側の低位項消失を識別しない。半径2で中心のみ氷とし、受容セルの列挙順に 2^53,1,1,1,1 を配置すれば、正しい Kahan は 2^53+4、単純加算は 2^53 となる。
    required_change: deposited 側にも独立した Kahan 識別ケースを追加し、厳密な期待値で照合する。
conditions: []
rollback_to: testcases
summary: 座標 index、相分類の分数値、回転、overflow、検証順と境界値は整合し、VB-08 の Kahan 値も独立計算で一致した。ただし相別に補償和を要求する契約の片側に識別テストが欠ける。
```

```yaml
review_type: testcases
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-5/TESTCASES.md
    hash: sha256:070187b81482c19fd41a601f2953960a677611b227841a432e5686386a8de184
findings: []
conditions: []
rollback_to: none
summary: 前回指摘の deposited 側 Kahan 識別ケース VB-08D を確認した。半径2の受容 index は 4,5,8,9,10,13,14 で、指定順の Kahan 和は 2^53+4、単純加算は 2^53 となる。相分類の既知値、外周条件、overflow、入力検証順と許容差も上位設計に整合する。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: AGENTS.md
    hash: sha256:4dee0eb9aff74010fd8d8625aa75e15691cc100c7f4c1dcc71823836efdbbc90
  - path: apps/snow-crystal-sim/AGENTS.md
    hash: sha256:63fdad1bcd657afc9aa2aa6f00658649b565b7dd53c71675d155b0daea036761
  - path: docs/simulators/snow-crystal-sim/SPEC.md
    hash: sha256:dc07d48fb2a2360f67cef0e9dfc58b5686561edcc9904dc4236afbf17ec162b5
  - path: docs/simulators/snow-crystal-sim/DESIGN-OUTLINE.md
    hash: sha256:822c47deb32cf5bb6791ce080c8e13612723bcbccaed59fb60e4ef9512e0d7bf
  - path: docs/simulators/snow-crystal-sim/TASKS.md
    hash: sha256:d20289c431530fea86ab5619a5d32cfaa5287d3fb7104cba105ae8539c7b2f0d
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/DESIGN.md
    hash: sha256:f47bd555be23a1e26e745e3f08b013cfb925e00638bcc6937ceccc4634804e63
  - path: docs/simulators/snow-crystal-sim/tasks/T1-5/DESIGN.md
    hash: sha256:160a63877532a23ad5bc5de1bfad321e76f4c6aef9fedbd08f49f38d302f6fa3
  - path: docs/simulators/snow-crystal-sim/tasks/T1-5/TESTCASES.md
    hash: sha256:070187b81482c19fd41a601f2953960a677611b227841a432e5686386a8de184
  - path: apps/snow-crystal-sim/package.json
    hash: sha256:71fd2d7e2b8e06b96a260269ca3e365feba4ffb5f2c7cc04ee5d7e933c27aba1
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts
    hash: sha256:545b4459d02e0899023b5cd1078ab6ff6aebf4a92af8e761df279e6ffa09ebb2
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/vapor-budget.ts
    hash: sha256:58d439f6428c0ce53e016670797fe792da795a7c88a6e863e0cae4571de2980e
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:c3e5897aec5c6fd472c1a4bdccf3ea86e90d99d46132fd88096f7d5c34beda5c
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:05c3ffb0cc576dfd5c395256c9379114f7270314666b26f549cb1b346ebe084e
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts:51
    problem: VB-V04 の配列 null ケースで、製品 API を呼ぶ前に snapshot が例外を投げる。
    evidence: expectError は最初に snapshot を呼び、bytes は null の buffer を参照する。3 配列それぞれの null ケースがテスト補助関数の TypeError で停止し、規定の例外 class・field と入力不変性を検査できない。
    required_change: 不正 shape や null も安全に記録できる snapshot にし、例外が vaporBudget から発生したことを確認する。
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts:56
    problem: 入力の参照 identity と全成功ケースの入力不変性が検査できていない。
    evidence: arrays.ref と seedRef を含む snapshot 全体を toEqual で構造比較しており、同内容の新しい配列や seed への差し替えを検出できない。成功系の大半は呼出し前後の snapshot 自体を比較せず、VB-09 も2つ目の入力を確認しない。
    required_change: 各成功・失敗ケースで全フィールドの bit pattern と配列・seed の参照 identity を前後比較し、VB-09 では2入力と各呼出しの結果オブジェクトの新規性を確認する。
  - id: R-003
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts:150
    problem: VB-V01 が要求する最初の対象 field state を検査していない。
    evidence: null、undefined、数、文字列、配列の各ケースで TypeError class だけを確認するため、別 field を報告する実装でも通過する。
    required_change: 各ケースで TypeError の対象 field が state であることも確認する。
  - id: R-004
    severity: low
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts:167
    problem: VB-V16 が指定する有効 seed [0,0,0,1] の受理を直接検査していない。
    evidence: 既定 seed [1,2,3,4] の1成分だけを0または最大値へ変えるため、3成分が0で1成分だけ非零の入力が作られない。
    required_change: [0,0,0,1] を独立した受理ケースに追加する。
conditions: []
rollback_to: test-code
summary: 型チェックは通過。半径2の相分類、分数値、Kahan 識別値、overflow fixture は独立計算と整合するが、異常入力の snapshot が実行前に失敗し、入力不変性と一部の検証表を十分に確認できない。Vitest は未実行。
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts
    hash: sha256:8859d94f2ebd9388c5c70ab7327473c06585a90b10bc0a6e6497d6c7a4c77905
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/vapor-budget.ts
    hash: sha256:58d439f6428c0ce53e016670797fe792da795a7c88a6e863e0cae4571de2980e
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:c3e5897aec5c6fd472c1a4bdccf3ea86e90d99d46132fd88096f7d5c34beda5c
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:05c3ffb0cc576dfd5c395256c9379114f7270314666b26f549cb1b346ebe084e
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts:44
    problem: 不正 shape の入力について、全要素と参照 identity の不変性を保証できない。
    evidence: 通常 Array を waterMass、ice、noise に渡す VB-V04 では valueSnapshot が参照を保存せず、同内容の別 Array への差し替えを toEqual では検出できない。不正 seed の要素に number 以外が一つでもあると seed snapshot が空になり、同じ Array 内の不正要素を別の不正要素へ変更しても検出できない。
    required_change: 不正 shape も含め、存在する各配列と seed の参照を明示的に比較し、全要素の値または number bit pattern を保存して比較する。
  - id: R-002
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts:57
    problem: metadata の number field を bit pattern として記録していない。
    evidence: fields と descriptors には number 値をそのまま保持し、前後を toEqual で比較する。VB-V02 などの NaN 入力では payload の変更を検出できず、TESTCASES §6 が要求する全 own field の bit snapshot を満たさない。
    required_change: scalar number field も DataView で bit pattern 化して前後比較する。
  - id: R-003
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts:73
    problem: 例外の対象 field を部分文字列だけで判定している。
    evidence: all-zero seed に対する期待 field は seed だが、誤って seed[0] を報告する実装も toContain('seed') を通過する。配列の型・長さエラーでも ice と ice[0] などを区別できず、承認済み検証表の対象 field 契約を検査できない。
    required_change: 例外から報告対象 field を一意に抽出し、期待 field と完全一致で比較する。
  - id: R-004
    severity: low
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts:78
    problem: VB-V01 の配列状態は入力不変性を確認していない。
    evidence: 空配列 [] は object だが、expectStateError は呼出し前後の snapshot も参照比較も行わない。TESTCASES §6 は object を渡す失敗系にも不変性確認を要求する。
    required_change: 配列状態でも呼出し前後の own field、要素、参照 identity を確認する。
conditions: []
rollback_to: test-code
summary: 前回の4指摘の主要部分は修正され、型チェックは通過した。相分類、既知値、Kahan 識別、overflow の期待値も整合する。ただし異常入力の完全な不変性と対象 field の厳密な照合には不足がある。Vitest は未実行。
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts
    hash: sha256:a0dd93eae6f0247278bad88087e6210d7d3869fc5ce8d43e0ad4575c524e39e2
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/vapor-budget.ts
    hash: sha256:58d439f6428c0ce53e016670797fe792da795a7c88a6e863e0cae4571de2980e
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:c3e5897aec5c6fd472c1a4bdccf3ea86e90d99d46132fd88096f7d5c34beda5c
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:05c3ffb0cc576dfd5c395256c9379114f7270314666b26f549cb1b346ebe084e
findings: []
conditions: []
rollback_to: none
summary: 前回指摘された不正 shape・seed・NaN のビットと参照 identity の記録、対象 field の区別、空配列状態の不変性確認を修正済み。承認済みケースの相分類、Kahan 識別、overflow、検証順を照合し、型チェックも通過した。Vitest はゲート指示に従い未実行。
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts
    hash: sha256:a0dd93eae6f0247278bad88087e6210d7d3869fc5ce8d43e0ad4575c524e39e2
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/vapor-budget.ts
    hash: sha256:a1a62f7b4fd93a45c9ef0962555b649eda4216abab100470cf446d035abbbfff
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:981093d822101bb032c89040de8a0d6fe33eefefabb115ae96648b36560f6c27
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:62f117444abd8ce262f86d703821c83c1dfc396f904fc3c7aadeac52e7fd713c
findings: []
conditions: []
rollback_to: none
summary: T1-5 の4ファイルは T1-6 の step・台帳に依存せず、公開 API から import できる。相分類の既知値、Kahan 識別値、overflow と検証順を承認済みケースに照合した。型チェックは通過。指示に従い Vitest は未実行。
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts
    hash: sha256:33c22bf2a51836852cd2fab933449319632ea779e18e2b7271fec6fe071892be
findings: []
conditions: []
rollback_to: none
summary: 89ba8ca からの差分は、overflow の報告フィールド3種を認識する正規表現の追加と、VB-P02 の配列型違いに対する期待例外を設計 §4 どおり TypeError に修正したものだけ。ケースの削除・許容差の拡大はなく、型チェックと差分検査は通過した。指示に従い Vitest は未実行。
```

```yaml
review_type: implementation
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/vapor-budget.ts
    hash: sha256:1b6bd8074fb18a0f6df1b17040ac4b29f2668487f02098c98566ca8f4887d0ff
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/vapor-budget.test.ts
    hash: sha256:33c22bf2a51836852cd2fab933449319632ea779e18e2b7271fec6fe071892be
findings: []
conditions: []
rollback_to: none
summary: 保存済み氷配置による全セルの相分類、外周氷禁止、検証順、相別の固定順 Kahan 和、overflow 時の例外と入力不変性は承認済み設計に一致する。半径2の相別値と低位項を保つ Kahan 識別値を独立計算で確認した。テスト修正は例外種別の訂正と報告フィールドの認識追加に限られ、33件の対象テストが通過した。
```
