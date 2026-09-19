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

```yaml
review_type: testcases
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-1/TESTCASES.md
    hash: sha256:2d9909cf0e449339c66a7ecb10fa74f425a2a3357dc87382b4946dafc218902f
findings:
  - id: R-001
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-1/TESTCASES.md:325
    problem: "cartesianToAxial の overflow ケースが r 自体の overflow しか検出せず、q と r は有限だが q+r だけが overflow する契約分岐を検査していない。"
    evidence: "T1-1 DESIGN.md:186 は q、r、q+r の全てが有限でなければ RangeError とする。現行 literal (Number.MAX_VALUE, Number.MAX_VALUE) では r が Infinity になるため、q+r の検査を実装しなくても通る。独立計算では x=Number.MAX_VALUE、z=Number.MAX_VALUE/4 に対し q=1.5382184810290406e+308 と r=5.189493076665501e+307 は有限だが q+r は Infinity となる。"
    required_change: "q と r が有限で q+r だけが非有限になる固定 Cartesian literal を追加し、独立逆行列で3値の有限性を確認したうえで RangeError を要求する。"
  - id: R-002
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-1/TESTCASES.md:347
    problem: "格子 index API の異常入力表が、公開契約の TypeError／RangeError 分類と q→r の検証を十分に拘束していない。"
    evidence: "axialAtIndex の index ケースは -1、19、0.5、unsafe integer の RangeError だけで、DESIGN.md:351,356 が要求する NaN、±Infinity、型違いの TypeError を検査しない。axialIndex も有効な radius と q の後で r 単独が NaN・非整数・safe-neighbor 域外となるケースや、q/r が M 境界にあるケースを持たないため、r 検証の欠落、NaN index の誤分類、格子外 null による unsafe axial の握り潰しがテストを通過できる。"
    required_change: "axialAtIndex(2,index) に NaN、±Infinity、型違いの TypeError を追加する。axialIndex には有効な先行引数の後で r が非有限・非整数となるケースと、q・r・q+r の safe-neighbor 直外を RangeError とするケースを追加し、radius→q→r/index の順序を各公開 API で明示する。"
  - id: R-003
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-1/TESTCASES.md:428
    problem: "createLattice が全入力を検証してから配列を確保する順序を、確保不能 radius と後段の不正入力を組み合わせて検査していない。"
    evidence: "DESIGN.md:315-317 は radius、seed、beta、noiseAmplitude の全検証後に typed array を確保すると固定する。現行ケースは確保不能 radius では後続入力が全て有効、検証順ケースでは radius=2 を使うため、radius 検証直後に巨大配列を確保し、その後で noiseAmplitude 等を検証する実装でも全ケースを通過できる。"
    required_change: "例えば radius=54794157、正常 seed・beta、noiseAmplitude=NaN を与え、配列確保の RangeError より先に noiseAmplitude の TypeError が同期 throw されるケースを追加して、最終入力までの事前検証を拘束する。"
  - id: R-004
    severity: low
    location: docs/simulators/snow-crystal-sim/tasks/T1-1/TESTCASES.md:506
    problem: "公開定数 MODEL_VERSION の固定値を直接検査せず、import 可能であることだけを要求している。"
    evidence: "DESIGN.md:68 は MODEL_VERSION 自体を reiter-alpha1-xoshiro128ss-1.1-v1 に固定するが、現行ケースは createLattice の modelVersion だけを literal と比較する。定数を別の文字列で export し、createLattice 側だけを正しい literal にした実装が通過できる。"
    required_change: "MODEL_VERSION を固定 literal と完全一致で検査し、createLattice が返す modelVersion とも同一であることを確認する。"
conditions: []
rollback_to: testcases
summary: "exact Vitest include、4テストファイルの非0件収集、T1-2へ残すTC-RNG-002B、半径2の既知格子、safe-neighbor境界、16 epsilon許容差、xoshiro128** 1.1のs[1]式と19出力列、noise変換、createLatticeのbit-for-bit決定性は上位契約と整合し、PRNG値とセル数境界も独立再計算で一致した。ただし変換のq+r単独overflow、index APIの例外分類、巨大確保前の全入力検証順、公開モデル版定数に未拘束の分岐が残るため、テストケースへ差し戻す。"
```

```yaml
review_type: testcases
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-1/TESTCASES.md
    hash: sha256:3c4a99497e79f1f6bb32e773ae4851defead449c4dba2ef8fe96d7882ee93bbf
findings: []
conditions: []
rollback_to: none
summary: "R-001〜R-004はすべて解消された。qとrが有限でq+rだけがoverflowするCartesian literalを独立計算で確認し、index APIのTypeError/RangeError分類、radius→q→rまたはindexの検証順、q・r・q+rそれぞれのsafe-neighbor直外が網羅されている。巨大だがセル数はsafe integerのradiusと不正noiseAmplitudeの複合入力により、全入力検証がtyped array確保より先であることを拘束している。MODEL_VERSIONは固定literalと直接比較され、state.modelVersionとの一致も検査される。セル数、座標往復、xoshiro128** 1.1の19出力・最終state、noise写像も独立再計算と一致し、上位設計からの退行やT1-2以降の責務混入は認められない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/vite.config.ts
    hash: sha256:a06135bc67da69da9d0a0bc6c04a20a1f414a5e39a3cd96c6f8a73e10195d3aa
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts
    hash: sha256:5932a8e7f5a6fbece570a027b4474b90591cff7a94a0acd14b11946cca0b7fc4
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts
    hash: sha256:010bec09d6b432aa7c44a6bbe46384ebad0d32d33faf1ed9a2dc306ed23a645f
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts
    hash: sha256:78e5f3179bbddb01e446cf9915ca032f3bdd22acb7d6e7df7859b11740c855df
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts
    hash: sha256:315e72b1eb02c0b549f9a8009137e6d83fef38d44e05a18093bc5f0abfd01b1a
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:d7d5b2e99d50f14bb25a49a33546a443640634e4a7cf6e283a802d26514c4352
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/conditions.ts
    hash: sha256:49e756068e877defea6921678600845563ed5d9149e4f10560ca81f047acc7af
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/hex-lattice.ts
    hash: sha256:e2c5b93f67ebf131cd12ab22b8de0365ad186c00ec3a95b241c7a61e3f7589a3
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/prng.ts
    hash: sha256:d60a397546ae264a408b5ba75c426a36cfa5621cd2bde205d24df5f34f2599a1
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/lattice.ts
    hash: sha256:f534800e376695b3a301bced46f3a5ab2f26e6f827509896fa60381bd3aca88e
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:73f134fb2dbebf3327b9e1efe21b6d79c1b26c02b55b83c27fdcef14ae32aca9
findings:
  - id: R-001
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts:11
    problem: "TC-NORM-002 と TC-NORM-004 が承認済みケースの literal と独立オラクルを実装し切っていない。"
    evidence: "TC-NORM-002 は指定された5入力のうち [-31,15]、[-15,31]、[-30,30] を欠き、低側2軸同時の [-30.000000000001,-1e-12] も別入力へ置換している。TC-NORM-004 は2返値の一致だけを確認し、指定された x=17.5/30、y=7.25/30 を独立に検査しないため、共有状態に依存するが毎回同じ誤値を返す実装を検出できない。"
    required_change: "承認済み TC-NORM-002 の5 literal をそのまま追加し、TC-NORM-004 で全返値を独立 literal/四則演算結果と絶対誤差 1e-12 以内で比較する。"
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts:43
    problem: "TC-RNG-001-INVALID の seed 成分検証表が不完全で、成分位置による検証漏れと -0 の入力変更を許す。"
    evidence: "形違いと index 0 の代表的 RangeError はあるが、各 index を個別に NaN、±Infinity、型違い、-1、0.5、4294967296 とする承認済み表を実装していない。有効な最大 uint32 seed と [0,0,0,1] の受理、[-0,0,0,1] の入力側が呼出し後も -0 であることも未検査である。現在の複合3例だけでは index 1〜3 の型・上限・整数検証を省いた実装が通る。"
    required_change: "4成分それぞれについて承認済み TypeError/RangeError 表を実装し、有効最小・最大 seed、-0 正規化結果、および元入力の -0 bit pattern 不変を検査する。"
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts:35
    problem: "TC-HEX-003〜008 の複数の境界・共変性・検証順契約が欠落しており、六角格子 API の誤実装を広く見逃す。"
    evidence: "半径2では ring の個数しか確認せず固定 ring index と h<=1 の7 index を検査しない。TC-HEX-005 は指定された (-4,2) と平行移動 (7,-3) の近傍差分共変性を実装していない。TC-HEX-006 は (M-1,0) の Cartesian 有限性と往復を実行しない。TC-HEX-007 は各公開 axial API の q/r 双方、Cartesian API の x/z 双方を個別検査せず、(Number.MAX_VALUE,NaN) の順序や overflow 中間値の独立確認もない。TC-HEX-008 は enumerateAxial の radius 異常、列挙結果の呼出し履歴不変、BigInt セル数オラクル、および指定された複合異常の検証順を欠く。"
    required_change: "TC-HEX-003〜008 に記載された全 literal、固定 index 集合、平行移動関係、最大境界往復、引数位置別異常表、複合異常の順序、独立 overflow/BigInt オラクル、列挙純粋性を追加する。"
  - id: R-004
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts:66
    problem: "TC-CREATE-005 が非有限 beta/noiseAmplitude に誤った例外 class を要求している。"
    evidence: "承認済み DESIGN 8 と TESTCASES 476〜487 は NaN と ±Infinity を TypeError、有限範囲外を RangeError とする。一方、現在の2つの loop は NaN と ±Infinity を有限範囲外値と同じ配列へ入れ、すべて RangeError を期待している。このテストに合わせると公開入力契約を逆に実装することになる。"
    required_change: "beta と noiseAmplitude の NaN/±Infinity を TypeError 表へ分離し、-1e-12 と上端直外だけを RangeError として検査する。"
  - id: R-005
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts:36
    problem: "createLattice の決定性・確保境界・所有権テストに偽成功経路と未実装ケースがある。"
    evidence: "seed 変更結果は snapshot 全体で比較しているため、noise が全く変わらなくても seed metadata の差だけで not.toEqual が必ず成功する。TC-CREATE-003 は有効だが確保不能な radius=54794157 の同期 RangeError を欠く。TC-CREATE-004 は seed 各 index の全異常表、保存 seed の別参照、入力 -0 の維持を欠く。TC-CREATE-007 は A/B/C の seed と全typed arrayの相互別参照、不正呼出し後の有効呼出し、B/C と独立 literal state の一致を検査していない。"
    required_change: "変更 seed では noise 要素だけを直接比較して少なくとも1差分を要求する。さらに TC-CREATE-003/004/007 の承認済み確保不能、全 seed 表、参照所有権、失敗呼出し後純粋性、独立 literal state 比較を追加する。"
  - id: R-006
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts:3
    problem: "公開型 export のコンパイル検査が承認済み完了条件を満たしていない。"
    evidence: "4テストファイルが型として import するのは Seed128 と CreateLatticeInput だけであり、TESTCASES 540〜541 が対象とする ModelVersion、AxialCoord、CartesianXZ、NormalizedConditions、LatticeState、Xoshiro128ssResult を import していない。したがってこれらの public type export が欠落してもテストコンパイルでは検出できない。"
    required_change: "指定された全公開型を domain/index.ts から type import し、未使用制約を回避しつつ各型の公開面が TypeScript コンパイルで検査される最小の型専用 sentinel を追加する。"
conditions: []
rollback_to: test-code
summary: "静的検査では exact Vitest glob、4ファイル合計24件、skip/todo/only 不在、上位範囲外の step 不在を確認した。scaffold は決定的 sentinel と型・公開面だけで、座標式、PRNG、物理式、格子初期化を先取りしていない。既知 PRNG/noise literal と 16 eps の式も上位契約に整合する。しかし条件正規化、seed、六角格子境界、createLattice の重要ケースが欠落し、非有限 metadata の例外期待には契約違反があるため承認できない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/vite.config.ts
    hash: sha256:a06135bc67da69da9d0a0bc6c04a20a1f414a5e39a3cd96c6f8a73e10195d3aa
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts
    hash: sha256:807571f29bed586aaded7b6b120ac613b1dc6749095de118a200a931e4f2e05f
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts
    hash: sha256:75aa8ed7be79eba8c92cfe9ec2547bfc516f01290c985a365eea89932a949e00
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts
    hash: sha256:ed29f544b39eeebe9222a83adb7d78d7f40665b589c6dca78863555700d725f5
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts
    hash: sha256:93c0f135b635d9cd8513789b2d9057624e6c5a427c26e269aeb8c04fd61378b4
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:d7d5b2e99d50f14bb25a49a33546a443640634e4a7cf6e283a802d26514c4352
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/conditions.ts
    hash: sha256:49e756068e877defea6921678600845563ed5d9149e4f10560ca81f047acc7af
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/hex-lattice.ts
    hash: sha256:e2c5b93f67ebf131cd12ab22b8de0365ad186c00ec3a95b241c7a61e3f7589a3
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/prng.ts
    hash: sha256:d60a397546ae264a408b5ba75c426a36cfa5621cd2bde205d24df5f34f2599a1
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/lattice.ts
    hash: sha256:f534800e376695b3a301bced46f3a5ab2f26e6f827509896fa60381bd3aca88e
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:73f134fb2dbebf3327b9e1efe21b6d79c1b26c02b55b83c27fdcef14ae32aca9
findings:
  - id: R-002
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts:55
    problem: "TC-RNG-001-INVALID の -0 有効入力に対する期待値が xoshiro128** v1.1 の正しい遷移と矛盾し、有効な最大 uint32 seed の検査も欠けている。"
    evidence: "入力 [-0,0,0,1] は正規化後 [0,0,0,1] であり、承認済み演算順を独立適用すると output=0、nextState=[1,0,0,2048] となる。したがって normalized.state[0] を +0 とする line 57 と、[1,2,3,4] 用 sentinel {output:11520,state:[7,0,1026,12288]} との一致を要求する line 59 は、正しい実装を必ず失敗させる。また承認済み literal [4294967295,4294967295,4294967295,4294967295] を nextXoshiro128ss に渡す有効境界検査がないため、前回 R-002 は未解消である。"
    required_change: "[-0,0,0,1] と [0,0,0,1] がともに正しい literal result {output:0,state:[1,0,0,2048]} を返すこと、元の -0 入力が不変であること、および全成分 4294967295 の seed が受理され output/state の全成分が uint32 整数であることを検査する。"
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts:29
    problem: "TC-HEX-002、006、007、008 の承認済み独立オラクル、複合異常の検証順、および境界検査がなお一部欠落している。"
    evidence: "TC-HEX-002 は (2,-1) の Cartesian literal (1.5,-sqrt(3)/2) を直接比較せず production の往復だけに依存する。TC-HEX-006 は (M-1,0) の変換後を有限確認するだけで axial への tauCoord 往復を検査しない。TC-HEX-007 は (Number.MAX_VALUE,NaN) の z 検証優先 TypeError と、(MAX,MAX) で独立逆行列の r 自体が非有限になる確認を欠く。TC-HEX-008 は axialIndex/axialAtIndex の承認済み複合異常7件による radius→q→r/index 順を実装せず、54794157/54794158 のセル数を BigInt で独立再計算して safe-integer 境界を裏付けていない。前回 R-003 の主要要求が残存している。"
    required_change: "各承認済み literal と oracle をそのまま追加する。具体的には (2,-1) の直接 XZ 比較、(M-1,0) の逆変換、(MAX,NaN) と第1 overflow の独立 r 非有限確認、TESTCASES.md 374-381 の全検証順 literal、および N(R)=1+3R(R+1) の BigInt 評価による両境界確認を含める。"
  - id: R-005
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts:105
    problem: "TC-CREATE-007 が A/B/C の全 typed array の相互非共有を検査しておらず、TC-CREATE-004 の境界 seed について保存値と所有権も確認していない。"
    evidence: "line 112 は A と B の waterMass/ice/noise だけを参照比較し、B と C および A と C を比較しないため、B/C が同じ可変配列を共有する実装が通過できる。seed は B/C まで比較されるが、TC-CREATE-004 の最小・最大 uint32 seed は toBeDefined() のみで、保存 seed の値、新規 tuple 所有、入力不変を拘束しない。承認済み TC-CREATE-004/007 が要求する相互所有権を満たさず、前回 R-005 は未解消である。"
    required_change: "A/B/C の waterMass、ice、noise、seed を全組合せで別参照と確認し、最小・最大 seed の各呼出しでも保存 seed の値一致、入力 seed との非共有、入力不変を明示的に検査する。"
  - id: R-007
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts:121
    problem: "TC-HEX-008 が列挙返値の参照 identity を判定し、承認済みテストケースが明示的に対象外とした制約を追加している。"
    evidence: "TESTCASES.md:385-389 は1回目の snapshot 後に2回目を呼び、過去の返値が変化しないことだけを要求し、返値どうしの参照 identity は判定対象にしない。line 122 の expect(enumerated).not.toBe(enumeratedAgain) は、値・順序・過去返値不変を満たす共有不変結果まで不当に失敗させる。"
    required_change: "参照非同一 assertion を除き、1回目の値を呼出し前 snapshot として保持し、2回目の呼出し後もその snapshot と一致することを検査する。"
conditions: []
rollback_to: test-code
summary: "exact Vitest include、4テストファイルの非空収集、skip/todo/only 不在、公開値・型 export、noise の直接差分、BigUint64 による配列 bit 比較、および6 scaffold が非実装 sentinel のままであることは静的に確認した。しかし PRNG の -0 有効入力には正しい実装を拒否する誤期待値があり、六角格子の独立境界・検証順・BigInt oracle と createLattice の所有権検査にも未解消箇所があるため承認できない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/vite.config.ts
    hash: sha256:a06135bc67da69da9d0a0bc6c04a20a1f414a5e39a3cd96c6f8a73e10195d3aa
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts
    hash: sha256:807571f29bed586aaded7b6b120ac613b1dc6749095de118a200a931e4f2e05f
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts
    hash: sha256:3f5faeb77c0b2060c29e8a07b4e5e6bc680591f8079c79340feaf389b6847025
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts
    hash: sha256:9e95c63e64421048cf57324c45a5e0023bc410b38e68286fe9eeb44a63ba4492
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts
    hash: sha256:091412c5eafb62b2a0c1e2b9e3a38f3eb1ed23f225b71b2c70e254926dd83e82
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:d7d5b2e99d50f14bb25a49a33546a443640634e4a7cf6e283a802d26514c4352
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/conditions.ts
    hash: sha256:49e756068e877defea6921678600845563ed5d9149e4f10560ca81f047acc7af
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/hex-lattice.ts
    hash: sha256:e2c5b93f67ebf131cd12ab22b8de0365ad186c00ec3a95b241c7a61e3f7589a3
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/prng.ts
    hash: sha256:d60a397546ae264a408b5ba75c426a36cfa5621cd2bde205d24df5f34f2599a1
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/lattice.ts
    hash: sha256:f534800e376695b3a301bced46f3a5ab2f26e6f827509896fa60381bd3aca88e
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:73f134fb2dbebf3327b9e1efe21b6d79c1b26c02b55b83c27fdcef14ae32aca9
findings:
  - id: R-003
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts:105
    problem: "safe-neighbor 域外となる (q,r)=(M-1,1) を axialNeighbors だけで検査しており、同じ入力契約を持つ hexRadius と axialToCartesian の q+r 境界違反を拘束していない。また半径2の h<=1 固定 index literal も個数だけの検査になっている。"
    evidence: "承認済み DESIGN.md の入力検証表は全 axial API に max(abs(q),abs(r),abs(q+r))<=M-1 を要求し、TESTCASES.md の TC-HEX-007 は hexRadius、axialNeighbors、axialToCartesian を対象として q+r=M の literal を RangeError とする。現行テストでは hexRadius または axialToCartesian が q と r の個別安全整数性だけを検査して (M-1,1) を受理する誤実装が通過できる。TC-HEX-003 も承認済み固定 index [4,5,8,9,10,13,14] ではなく長さ7だけを確認している。"
    required_change: "hexRadius、axialNeighbors、axialToCartesian のそれぞれで (M-1,1) が RangeError になることを検査し、TC-HEX-003 では h<=1 の index が承認済み7要素 literalと順序を含め完全一致することを追加する。"
  - id: R-008
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts:11
    problem: "TC-NORM の数値を完全一致で比較し、TC-NORM-004 では返値の参照非同一まで要求しているため、承認済みの絶対許容差と identity 非拘束契約よりテストが厳しい。"
    evidence: "TESTCASES.md は条件正規化の全数値を abs(actual-expected)<=1e-12、boolean を完全一致とするが、TC-NORM-001、002、004 は object の toEqual により x と y を含む数値を完全一致で拘束している。さらに DESIGN.md は object/array 返値の参照 identity 一致を要求しないのに、line 38 の not.toBe は共有された適合返値を不当に失敗させる。toBeCloseTo(...,12) も明記された <=1e-12 判定そのものではなく、先行する完全一致 assertion を緩和しない。"
    required_change: "TC-NORM-001、002、004 の数値 field を明示的な絶対誤差 <=1e-12 で比較し、clamped を完全一致で比較する。返値の参照非同一 assertion は削除し、値の決定性だけを検査する。"
conditions: []
rollback_to: test-code
summary: "前回の R-002、R-005、R-007 は解消され、-0 と最大 uint32 seed、A/B/C 全組合せの所有権、enumerateAxial の過剰な identity 制約、7件の検証順、BigInt セル数境界を確認した。xoshiro128** v1.1 の -0 遷移、最大 seed、セル数境界、Cartesian q+r overflow は独立再計算とも一致し、4テストファイルは非空で skip/todo/only を含まず、6 scaffold も非実装 sentinel の範囲に留まる。ただし axial API の q+r 境界網羅と条件正規化の許容差・identity 契約に未解消のテスト不整合があるため承認できない。"
```

```yaml
review_type: test-code
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/vite.config.ts
    hash: sha256:a06135bc67da69da9d0a0bc6c04a20a1f414a5e39a3cd96c6f8a73e10195d3aa
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts
    hash: sha256:47f5effdab7c518e099b9f81eee1f283025dd9f8ab794dcd63382e525c38b88b
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts
    hash: sha256:3f5faeb77c0b2060c29e8a07b4e5e6bc680591f8079c79340feaf389b6847025
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts
    hash: sha256:8ffa5c03bd5a191dcac683412cff9f87fc08f9c49c27c9f9ac6ee8481b0e3a04
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts
    hash: sha256:091412c5eafb62b2a0c1e2b9e3a38f3eb1ed23f225b71b2c70e254926dd83e82
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:d7d5b2e99d50f14bb25a49a33546a443640634e4a7cf6e283a802d26514c4352
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/conditions.ts
    hash: sha256:49e756068e877defea6921678600845563ed5d9149e4f10560ca81f047acc7af
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/hex-lattice.ts
    hash: sha256:e2c5b93f67ebf131cd12ab22b8de0365ad186c00ec3a95b241c7a61e3f7589a3
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/prng.ts
    hash: sha256:d60a397546ae264a408b5ba75c426a36cfa5621cd2bde205d24df5f34f2599a1
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/lattice.ts
    hash: sha256:f534800e376695b3a301bced46f3a5ab2f26e6f827509896fa60381bd3aca88e
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:73f134fb2dbebf3327b9e1efe21b6d79c1b26c02b55b83c27fdcef14ae32aca9
findings:
  - id: R-008
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts:40
    problem: "TC-NORM-004 が2回の返値を独立期待値へ許容差付きで照合するだけで、値として完全に同一という決定性契約を検査していない。"
    evidence: "承認済み TESTCASES.md は2返値の値が完全に同じことを要求する。現在は各返値が期待値の1e-12以内なら通るため、呼出しごとに数値を異なる方向へ微小変動させる共有可変状態依存の実装でも成功する。前回R-008で残すべきとされた値の決定性が未拘束である。"
    required_change: "独立期待値への絶対誤差比較を維持したうえで、firstとsecondを参照identityではなく全fieldの値として完全一致させる assertion を追加する。"
  - id: R-009
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts:69
    problem: "TC-HEX-005/006 の非原点近傍が承認済みの固定6差分オラクルで検査されず、誤った axialNeighbors が成功できる。"
    evidence: "line 71 は非原点centerのproduction返値を平行移動後の期待値生成に再利用し、line 75-80は最大境界の返値がsafe integerかだけを確認する。原点だけ正しい6近傍を返し、他の全座標では入力座標を6回返す実装でも、平行移動関係、半径差<=1、最大境界safe判定をすべて通過する。TESTCASES.mdは固定差分 [(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)] を元座標、平行移動後座標、最大境界へテスト側で直接加える独立オラクルを要求している。"
    required_change: "(-4,2)、その(7,-3)平行移動後、および(M-1,0)について、各返値から入力を引いた6差分が承認済みliteralと順序を含め完全一致することをproduction返値から期待値を生成せず検査する。"
  - id: R-010
    severity: medium
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts:69
    problem: "TC-RNG-001-PURE の有効値3571406116は同じ関数呼出し同士を比較するだけで、承認済みの独立noiseオラクルを検査していない。"
    evidence: "line 72は決定的だが誤った任意の値でも成功する。別の4入力だけ正しく処理し、3571406116では誤値を返す公開uint32ToNoise実装が通過でき、createLatticeが写像を別経路で実装すれば他テストにも検出されない。独立計算 2*(3571406116/4294967296)-1 は 0.6630655694752932 である。"
    required_change: "3571406116についてテスト側のliteral式から期待値を生成し、2回の返値がそのbinary64 bit patternと一致することをDataViewまたはObject.isで検査する。"
  - id: R-011
    severity: low
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts:31
    problem: "TC-HEX-002 の(q,r)=(1,0)だけが座標契約のtauCoordではなくobject完全一致を要求している。"
    evidence: "承認済み TESTCASES.md は座標のbinary64比較をすべて16 epsilonの規模比例許容差とする。現在のtoEqualは、その許容差内にある数値的に適合した座標変換を不当に失敗させ得る。"
    required_change: "返されたxとzを他のTC-HEX-002座標と同じclose helperでそれぞれ比較する。"
conditions: []
rollback_to: test-code
summary: "静的レビューで、最新R-003のq+r境界3 APIとh<=1固定indexは解消され、R-008の数値許容差と過剰な参照identity制約も修正されたことを確認した。過去のseed境界、所有権、検証順、BigIntセル数、公開型、確保前検証にも退行はなく、xoshiro128** 1.1の既知列と19 noise値は独立再計算に一致する。ただし決定性、非原点近傍、公開noise写像の独立オラクルに偽成功経路が残り、座標許容差にも偽失敗条件があるため承認できない。"
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/vite.config.ts
    hash: sha256:a06135bc67da69da9d0a0bc6c04a20a1f414a5e39a3cd96c6f8a73e10195d3aa
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts
    hash: sha256:c49bdb89923f0d949c93afd184c3e49732a48735e0a89d6a6929d507a8e922f8
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts
    hash: sha256:c222b297b46cae504accc6628eeee3145eb64df78a51563531a5c9f4b8947cb1
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts
    hash: sha256:d3c5a3a9f518a228631a83e2df0d6f30d2e22a3bd3b4f41b6f0d34186fd822cb
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts
    hash: sha256:091412c5eafb62b2a0c1e2b9e3a38f3eb1ed23f225b71b2c70e254926dd83e82
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:d7d5b2e99d50f14bb25a49a33546a443640634e4a7cf6e283a802d26514c4352
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/conditions.ts
    hash: sha256:49e756068e877defea6921678600845563ed5d9149e4f10560ca81f047acc7af
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/hex-lattice.ts
    hash: sha256:e2c5b93f67ebf131cd12ab22b8de0365ad186c00ec3a95b241c7a61e3f7589a3
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/prng.ts
    hash: sha256:d60a397546ae264a408b5ba75c426a36cfa5621cd2bde205d24df5f34f2599a1
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/lattice.ts
    hash: sha256:f534800e376695b3a301bced46f3a5ab2f26e6f827509896fa60381bd3aca88e
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:73f134fb2dbebf3327b9e1efe21b6d79c1b26e02b55b83c27fdcef14ae32aca9
findings: []
conditions: []
rollback_to: none
summary: "前回のR-008〜R-011はすべて解消された。条件正規化は独立期待値への絶対誤差比較に加えて2返値の完全な値一致を検査し、非原点・平行移動後・safe-neighbor最大境界の近傍は固定6差分literalで独立に拘束されている。uint32ToNoise(3571406116)は独立値0.6630655694752932およびbinary64 bit pattern 0x3fe537d549000000と照合され、(1,0)の座標も承認済み16 epsilon許容差を使う。過去に修正されたseed境界、検証順、BigIntセル数、所有権、公開型、列挙順、19段PRNG列にも退行はなく、独立再計算結果と一致した。exact Vitest glob、非実装sentinel scaffold、依存境界は適切で、テストを実行せず静的typecheckが成功したことも確認した。"
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/vite.config.ts
    hash: sha256:a06135bc67da69da9d0a0bc6c04a20a1f414a5e39a3cd96c6f8a73e10195d3aa
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts
    hash: sha256:c49bdb89923f0d949c93afd184c3e49732a48735e0a89d6a6929d507a8e922f8
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts
    hash: sha256:c222b297b46cae504accc6628eeee3145eb64df78a51563531a5c9f4b8947cb1
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts
    hash: sha256:d3c5a3a9f518a228631a83e2df0d6f30d2e22a3bd3b4f41b6f0d34186fd822cb
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts
    hash: sha256:091412c5eafb62b2a0c1e2b9e3a38f3eb1ed23f225b71b2c70e254926dd83e82
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:d7d5b2e99d50f14bb25a49a33546a443640634e4a7cf6e283a802d26514c4352
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/conditions.ts
    hash: sha256:49e756068e877defea6921678600845563ed5d9149e4f10560ca81f047acc7af
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/hex-lattice.ts
    hash: sha256:e2c5b93f67ebf131cd12ab22b8de0365ad186c00ec3a95b241c7a61e3f7589a3
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/prng.ts
    hash: sha256:d60a397546ae264a408b5ba75c426a36cfa5621cd2bde205d24df5f34f2599a1
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/lattice.ts
    hash: sha256:f534800e376695b3a301bced46f3a5ab2f26e6f827509896fa60381bd3aca88e
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:73f134fb2dbebf3327b9e1efe21b6d79c1b26c02b55b83c27fdcef14ae32aca9
findings: []
conditions: []
rollback_to: none
summary: "R-008〜R-011の解消とtest-code全体を再確認した。条件正規化は独立期待値への絶対誤差比較と2返値の完全な値一致を併用し、非原点・平行移動後・safe-neighbor最大境界の近傍は固定6差分literalで検査する。uint32ToNoise(3571406116)は独立値0.6630655694752932およびbinary64 bit pattern 0x3fe537d549000000に一致し、(1,0)を含む座標比較は承認済み16 epsilon許容差を用いる。seed境界、検証順、BigIntセル数境界、所有権、公開型、半径2の固定列挙、19段PRNG列にも退行はない。独立再計算でPRNG既知値・noise bit pattern・セル数境界を確認し、静的typecheckとarchitecture boundary checkも成功した。既存の期待したRedは再実行していない。全11対象のハッシュを再取得し、index.tsの正しいSHA-256を記録した。"
```

```yaml
review_type: implementation
status: changes-requested
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:d7d5b2e99d50f14bb25a49a33546a443640634e4a7cf6e283a802d26514c4352
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/conditions.ts
    hash: sha256:64b3fa5045438fa1ddaf4dc46566b2469410434ac112adbde7861c6eedab2ead
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/hex-lattice.ts
    hash: sha256:6486ec84df7372a8d0966c272f6a970eb9eb29c7e6c398bcc66c7797bfcdf98b
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/prng.ts
    hash: sha256:fd83c3f0604de3184122104c817dcac5a3086919e5bd2a79752b0a094edccc80
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/lattice.ts
    hash: sha256:54a228448499faeda2d12b1ddb32326fb47c6adc645b1404ad3d4bfe65b31633
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:73f134fb2dbebf3327b9e1efe21b6d79c1b26c02b55b83c27fdcef14ae32aca9
findings:
  - id: R-001
    severity: high
    location: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/hex-lattice.ts:55
    problem: "有効な最大格子半径付近で正の r の行開始 index が丸められ、axialIndex と axialAtIndex の厳密な対応が壊れる。"
    evidence: "radius=54794157 は latticeCellCount が受理し、N=9007199088404419 も安全整数である。最終行 r=radius の正しい開始 index は BigInt による独立和 N-(radius+1)=9007199033610261 だが、現行式は加算途中で Number.MAX_SAFE_INTEGER を超えてから減算するため 9007199033610262 を返す。その結果 axialIndex(radius,-radius,radius) は1大きくなり、axialAtIndex(radius,9007199033610261) は格子外の {q:2,r:54794156} を返す。承認済み契約の全有効 radius における列挙・index 双方向一致に違反する。"
    required_change: "rowStartIndex の正の r 分岐を、中間値を含め安全整数性を保つ等価な計算へ修正し、radius=54794157 の最終行開始・末尾 index で axialIndex と axialAtIndex が独立整数オラクルと厳密に一致することを確認する。"
conditions: []
rollback_to: implementation
summary: "24件の承認済みテスト、TypeScript型検査、architecture boundary checkは成功した。座標基底、近傍順、条件正規化、入力検証順、所有権、公開API、xoshiro128** 1.1のs[1] scrambler・19出力列・noise写像は一次資料および独立再計算と一致した。ただしテスト未捕捉の最大有効半径境界でindex写像が破綻するため、実装ゲートは承認できない。"
```

```yaml
review_type: implementation
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/types.ts
    hash: sha256:d7d5b2e99d50f14bb25a49a33546a443640634e4a7cf6e283a802d26514c4352
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/conditions.ts
    hash: sha256:64b3fa5045438fa1ddaf4dc46566b2469410434ac112adbde7861c6eedab2ead
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/hex-lattice.ts
    hash: sha256:e9f4c2b84a3e1cb7effafda2e05bcaa7aa7f049352231122263343d6df1e14a8
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/prng.ts
    hash: sha256:fd83c3f0604de3184122104c817dcac5a3086919e5bd2a79752b0a094edccc80
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/lattice.ts
    hash: sha256:54a228448499faeda2d12b1ddb32326fb47c6adc645b1404ad3d4bfe65b31633
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/index.ts
    hash: sha256:73f134fb2dbebf3327b9e1efe21b6d79c1b26c02b55b83c27fdcef14ae32aca9
findings: []
conditions: []
rollback_to: none
summary: "前回R-001は解消された。radius=54794157を独立BigIntオラクルで再計算し、セル数9007199088404419、正の最終行開始9007199033610261、末尾9007199088404418、および両境界のaxialIndex/axialAtIndex双方向一致を確認した。修正式の最大中間値は負側・正側とも4503599489408052以下で、セル数を含む全Number整数中間値がNumber.MAX_SAFE_INTEGER以内である。小半径の全行と大半径の代表境界を含む66095組も独立行開始式と一致した。条件正規化、座標式と境界検証、xoshiro128** 1.1、決定性・所有権、公開API、依存境界に未解決不整合はなく、4ファイル24テストとverify-fastが成功した。"
```

```yaml
review_type: test-code
status: approved
reviewed_files:
  - path: apps/snow-crystal-sim/vite.config.ts
    hash: sha256:a06135bc67da69da9d0a0bc6c04a20a1f414a5e39a3cd96c6f8a73e10195d3aa
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/conditions.test.ts
    hash: sha256:c49bdb89923f0d949c93afd184c3e49732a48735e0a89d6a6929d507a8e922f8
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/prng.test.ts
    hash: sha256:c222b297b46cae504accc6628eeee3145eb64df78a51563531a5c9f4b8947cb1
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/hex-lattice.test.ts
    hash: sha256:d3c5a3a9f518a228631a83e2df0d6f30d2e22a3bd3b4f41b6f0d34186fd822cb
  - path: apps/snow-crystal-sim/src/simulators/snow-crystal-sim/domain/__tests__/lattice.test.ts
    hash: sha256:091412c5eafb62b2a0c1e2b9e3a38f3eb1ed23f225b71b2c70e254926dd83e82
findings: []
conditions: []
rollback_to: none
summary: "承認済みTESTCASESに対する5ファイルの最終再レビューを実施した。exact収集globを維持し、skip・todo・onlyはなく、TC-NORM、TC-RNG、TC-HEX、TC-CREATEの正常系、境界、例外分類、検証順、純粋性、所有権、決定性を公開API経由で検査している。PRNGの19出力と最終state、noise値、最大有効半径のセル数と最終行indexを独立再計算し、テストliteralと一致した。座標許容差は16 epsilonの規模比例、整数・PRNG・noise・状態は完全一致またはbinary64 bit比較を用い、独立oracleの弱化や対象外のT1-2契約混入はない。"
```
