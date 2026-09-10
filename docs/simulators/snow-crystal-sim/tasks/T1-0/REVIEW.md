```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/SPEC.md
    hash: sha256:3874556be2a5c40ced87dad83d8ef00a93c447bfa6d5ea1ac609e8df6cfc82a6
  - path: docs/simulators/snow-crystal-sim/DESIGN-OUTLINE.md
    hash: sha256:fea0ce7fa703a3b30100d4433d7193c98648d2c9347fa1e653b8660793a4ac0b
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/DESIGN.md
    hash: sha256:6c131632cb30fd29c89a04778995b7f7120fd92ebedbc6b1ba31c60b9e2320f1
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/DECISIONS.md
    hash: sha256:ae5c089254e0ec5d7ffdf7c3893bbf4fa85acb7eca5d29f38b79818774b44e27
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/DESIGN.md:226
    problem: "条件履歴に応じて β を変更する公開契約がなく、軌跡による形態変更を一意に実装できない。"
    evidence: "morphologyAt は各条件から β と γ を返す一方、createLattice だけが β を受け取り、step は gamma と dtCa しか受け取らない。したがって成長途中に条件が変わっても reservoir の β を更新できない。これは SPEC の「条件変更後の成長だけが新形態になる」要件、DESIGN.md:252 の条件軌跡を含む再現キー、および DECISIONS.md:7 が参照する Reiter Figure 7 の途中条件変更と整合しない。"
    required_change: "β が変わるステップ遷移を公開契約に追加し、reservoir ring の更新時点、非受容場を再スケールするか否か、reservoirExchange の台帳処理、再現キーへの記録方法を定義して SPEC・DESIGN-OUTLINE・DESIGN・DECISIONS を整合させる。"
  - id: R-002
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/DESIGN.md:245
    problem: "PRNG を xoshiro128** version 1.0 と固定する記述が、参照先の作者実装 version 1.1 と矛盾しており、bit-for-bit 再現契約が一意でない。"
    evidence: "作者公開の xoshiro128starstar.c は自身を version 1.1 と明記し、version 1.0 は scrambler に誤って s[0] を使っていたと説明している。初期 state [1,2,3,4] では 1.1 の先頭出力は 11520、旧 1.0 は 5760 となり、選択によって保存 URL の再生結果が変わる。"
    required_change: "採用版を明示的に決定し、出力式と状態遷移を設計書内に固定する。作者実装の版または内容ハッシュと既知 state/output ベクトルを記録し、modelVersion と DESIGN-OUTLINE の版表記も一致させる。"
  - id: R-003
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/DESIGN.md:267
    problem: "aspectRatio の省略入力および直径ゼロ時の境界動作が未定義で、正常な初期状態から Infinity または NaN を生成し得る。"
    evidence: "初期格子は中心 seed だけが氷なので basalRadiusCells と basalDiameterCells は 0 になるが、aspectRatio は thicknessCells/basalDiameterCells と定義されている。また morphologyMetrics の thicknessCells は任意引数なのに、省略時の返値がない。これは SPEC の計算結果に NaN/Infinity を含めない要件と衝突する。"
    required_change: "thicknessCells 省略時と basalDiameterCells=0 時の返値またはエラーを有限値・null 等で明示し、公開型、不変条件、独立オラクル、境界テストを追加する。"
  - id: R-004
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/DESIGN.md:324
    problem: "質量収支許容差は compensated summation を前提としているが、MassLedger の各総和にその算法を要求していない。"
    evidence: "DESIGN.md:214-216 は vaporBudget だけに compensated summation を指定し、beforeTotal、afterTotal、outOfPlaneInput、reservoirExchange の集計法は未指定である。40,021 セルを通常加算した誤差は項数に依存するため、256*EPSILON*scale という compensated-sum 前提の閾値を超え、正しい更新を誤って不合格にし得る。"
    required_change: "台帳の各総和にも compensated summation と演算順を固定するか、採用する集計法と項数に基づく誤差上界から tauMass を再導出し、独立計算側と実装側の算法を区別して記録する。"
  - id: R-005
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/DECISIONS.md:10
    problem: "固定 β 境界の形状を Reiter 原著の Euclidean 境界から六角 axial ring へ変更した近似の影響が記録・検証されていない。"
    evidence: "Reiter 著者版 pp.4-5 は初期セルから一定 Euclidean 距離の境界を用いて等方性を高めると明記するが、DESIGN.md:131-133 は h=radius の六角 ring を採用する。D-04 は固定背景境界を根拠にするだけで、この形状変更による六回方向の境界バイアス、適用範囲、誤差を扱っていない。"
    required_change: "六角 ring を採用するなら原著からの明示的な近似として記録し、境界距離・格子半径に対する形態指標と回転共変性の感度オラクルを定義する。そうでなければ原著に沿う Euclidean 境界契約へ改める。"
conditions: []
rollback_to: design
summary: "Reiter の α=1 更新係数と β/γ 探索域、Libbrecht の過飽和度定義・0.5–30%測定域・206観測および不確かさ、工学的閾値を物理定数としない区別は独立確認できた。しかし、動的 β、PRNG 版、ゼロ直径、収支加算誤差、境界形状近似が未確定または矛盾しており、実装開始前に設計へ差し戻す必要がある。"
```

```yaml
review_type: testcases
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md
    hash: sha256:5fd638905fa0b71605027d6c66da8ef7ead0b49eaa964c11518dabc1f1ea0dfb
findings:
  - id: R-001
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md:193
    problem: "TC-BETA-002 が radius=7 の reservoir 置換対象を h=5 としており、承認済み設計の h=radius と矛盾する。"
    evidence: "DESIGN.md:136,182-192 は reservoir ring を h=radius と定義するため、この fixture の置換対象は h=7 である。同じケースの期待値も h<7 の作業入力は保存状態と同一としており、h=5 を置換する独立オラクルとは両立しない。独立な整数距離確認では (4,0) から h=7 ring までの最短 graph 距離は3であり、第2 step の新 beta の1-step front は h=6 までである。現記述どおりテスト化すると正しい production 境界更新を不合格にし得る。"
    required_change: "置換対象を h=7 に訂正し、(4,0) と reservoir および当該 step の拡散 front の距離説明を正しい値へ直したうえで、h=7 だけが開始時に置換される独立参照計算を要求する。"
  - id: R-002
    severity: high
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md:143
    problem: "氷判定閾値と同期更新を直接拘束するテストケースがなく、成長コアの主要契約を誤実装しても既存26ケースを通過し得る。"
    evidence: "DESIGN.md:217-220 は成長領域で ice'=ice OR (m'>=1) とし、receptive mask は step 開始時の氷から一度だけ作る。既知値ケースは h=1 を0.125または0.3に留め、STOP は既に氷である外縁セルを入力するため、閾値ちょうど1、直下・直上、今回新たに凍結したセルの近傍が同じ step 中には受容化しないことを検査しない。例えば >1 を使う誤りや逐次的な受容域伝播は明示された期待値に捕捉されない。"
    required_change: "凍結前の水量と添加量を手計算し、m' が1直下・ちょうど1・直上となるセルを含む fixture を追加する。ice の期待値を完全一致で検査し、新規凍結セルの近傍への gamma 添加は次 step からだけ生じることも固定する。"
  - id: R-003
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md:218
    problem: "TC-MASS-001 の初期状態が一意に定まらず、独立期待値と fixture 固有 tauMass を再現可能に構築できない。"
    evidence: "createLattice は radius、seed、beta、noiseAmplitude を必須とするが、TC-MASS-001 は seed と radius だけを列挙し、初期 beta と noiseAmplitude を指定していない。beforeTotal、開始時 reservoirExchange、noise を介した outOfPlaneInput、停止遷移はこれらの値に依存する。TC-INVARIANT-001 もこの未確定 fixture を参照するため同じ曖昧さを継承する。"
    required_change: "直積の各初期状態について initialBeta と initialNoiseAmplitude を固定し、各 control をどの初期状態へ何 step 適用するかを明記する。少なくとも正負両方の reservoirExchange を生じる決定的 fixture を含める。"
  - id: R-004
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md:246
    problem: "不正状態の網羅に固定 noise 配列と状態 metadata の契約違反が含まれていない。"
    evidence: "DESIGN.md:118,123-126,307-314 は noise[i] を有限な [-1,1) とし、state の beta、noiseAmplitude、seed、modelVersion にも固定契約を与える。一方 TC-INVARIANT-002 が具体的に列挙する不正 state は waterMass、ice、stepIndex、elapsedCa が中心で、noise の -1 未満・1以上・NaN・Infinity、および不正 metadata を拘束しない。noise<-1 は gamma*(1+e*noise) を負にし、非負性の根拠そのものを破る。"
    required_change: "noise の下端直外、上端ちょうど1、NaN、±Infinityと、範囲外または不整合な state metadata、all-zero/不正 seed、modelVersion 不一致を明示的な不正 state fixtureへ追加し、同期例外と入力非変更を検査する。"
  - id: R-005
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md:323
    problem: "形態指標の既知集合が tipDensity の非ゼロ分岐とセクター境界規約を検査せず、較正オラクルとして不足している。"
    evidence: "TC-MORPH-001/002 は tipDensity の期待値がともに0であり、常に0を返す実装を排除できない。TC-MORPH-003 の座標は30,90,...,330度という各 sector の中央だけなので、DESIGN.md:397-398 の『境界上は小さい index』規約を検査しない。T1-3 は tipDensity と六腕統計を独立形態オラクルとして較正に使用するため、誤った近傍数または0/60度等の割当てが較正結果を汚染し得る。"
    required_change: "氷近傍がちょうど1個の枝先を含み tipDensity が非ゼロとなる紙上集合と、0,60,...,300度の境界座標を含む集合を追加する。armLength、armMass、tipDensity、非一様な armLengthCv を手計算値で拘束する。"
  - id: R-006
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md:432
    problem: "TC-PERF-001 の割当先と候補ファイルが TASKS.md の変更境界に違反する。"
    evidence: "本書は TC-PERF を T2-4 に割り当て、domain/__benchmarks__/step.bench.ts の作成を要求する。しかし TASKS.md:194-205 の T2-4 変更境界は scene と app のみで、domain の成長則変更は T1-2 へ差し戻す契約である。DeliveryBuilder は承認済みケースを推測で別パスへ移せず、このままではテスト実装工程でスコープ違反か停止が必ず生じる。"
    required_change: "domain step を呼ぶ測定 harness を T2-4 の app 境界内へ置くよう候補と追跡条件を変更するか、Coordinator が TASKS.md の変更境界を正式に整合させてからケース割当を確定する。"
  - id: R-007
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md:308
    problem: "TC-REPLAY-001 の replay-key 判定には検査対象となる production API がなく、テストの一部が自己生成した入力同士の自明な比較になる。"
    evidence: "承認済み公開契約が T1-2 に与える production 関数は step と状態・台帳であり、ReplayKey の canonical serialization または比較関数は定義されていない。TC-REPLAY-001 は calibrationId や保存済み数値の変更を『異なる replay key』と要求するが、候補テストがテスト内で ordered control 文字列を作るだけなら production behavior を検査しない。共有URLと履歴は DESIGN-OUTLINE.md では app 層の責務であり、T1-2 の変更境界は domain のみである。"
    required_change: "T1-2 では保存済み control 列からの step 再実行と状態・台帳の bit-for-bit 一致だけを検査する。canonical replay-key生成・シリアライズの差分判定は、その production API と app 層の変更境界を持つ後続タスクへ割り当て、具体的な対象関数と往復期待値を定める。"
conditions: []
rollback_to: testcases
summary: "26ケースの存在を確認した。独立再計算では半径2の全19セル・ring 12セル、TC-BETA-001 の境界edge 18本と台帳 2.4+0.6=3.0、TC-GAMMA-001 の受容7セルと入力0.875、compactness 1.1026577908435842/1.4177028739417512、armMassCv=sqrt(5/21)、xoshiro128** 1.1 の5既知ベクトル・19番目出力3571406116、H_115=40021、H_230=159391、E_105=40015、B_E=726、最小境界距離二乗9919、p95 index 570は一致した。単位、dtCa安定域、beta/gamma質量台帳、境界感度許容値、性能統計、未確定較正値を先取りしない方針も上位成果物と整合する。しかし、誤ったreservoir座標、凍結同期規則の未検査、未確定fixture、形態指標の未網羅、および後続タスク境界違反が残るためテストケースゲートは通過できない。"
```

```yaml
review_type: design
status: changes-requested
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/SPEC.md
    hash: sha256:cbf2f8b8f379e93c1d04eb714b8d4ea003124f84c79b512a46d663b5c0795dd5
  - path: docs/simulators/snow-crystal-sim/DESIGN-OUTLINE.md
    hash: sha256:745f2c121308e991a18dd6defabaa0dadca0fd93fa08b15d561fa67108f2e1aa
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/DESIGN.md
    hash: sha256:db5f55089b46a98bd4ababb14cf2c6ec62be2084afec117a0aefc6a2c6787165
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/DECISIONS.md
    hash: sha256:6a738fe7d7a22c8b4648664f68256db0cff5aa0b4f6368df2b835fb8b4f5ef36
findings:
  - id: R-005
    severity: medium
    location: docs/simulators/snow-crystal-sim/tasks/T1-0/DESIGN.md:501
    problem: "六角 reservoir の境界感度比較で格子間の固定 noise 場を揃える契約がなく、境界形状・距離以外の差が形態指標へ混入する。"
    evidence: "DESIGN.md:355-356 は r=-radius..radius の列挙順で PRNG 出力を各セルへ割り当てるため、同じ seed でも radius=115 の H_R と radius=230 の H_2R では共通座標の PRNG 消費位置が異なる。独立計算では中心セルの列挙 index がそれぞれ 20010 と 79695 になり、noiseAmplitude>0 の代表軌跡では共通成長領域の noise 自体が異なる。DESIGN.md:501-515 は同一 control prefix だけを要求し、noise 場の結合を定めていないため、5%/0.02 の差が reservoir 近似によるものか別のゆらぎ実現によるものか判別できない。Reiter 原著が示す境界近似の検証として独立変数が分離されていない。"
    required_change: "H_R、H_2R、E_R の共通座標では waterMass・ice・noise が同一になる比較初期化契約を定義し、追加セルの初期化、共通 noise の生成・注入方法、および比較開始前の一致検査を記録する。少なくとも全境界感度 checkpoint で境界形状・距離以外の入力差がないことを保証し、DESIGN-OUTLINE.md と DECISIONS.md の感度条件も同じ契約へ整合させる。"
conditions: []
rollback_to: design
summary: "R-001〜R-004は解消された。動的 beta/noise の StepControl、前後 reservoir 台帳、内部場を再スケールしない規則、xoshiro128** version 1.1 の s[1] 式・状態遷移・既知ベクトル・modelVersion、aspectRatio の null 境界、全台帳総和の固定順 Neumaier と独立 Kahan oracle は文書間で整合する。PRNG ベクトルは独立再計算で全5行一致し、Reiter 原著の alpha=1 重み・beta/gamma 範囲・Euclidean 固定境界、Libbrecht の過飽和度定義と単位も一次資料に照らして確認した。ただし R-005 の感度オラクルは格子半径依存の noise 割当てにより比較変数が交絡するため、境界近似の承認根拠として未成立である。"
```

```yaml
review_type: design
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/SPEC.md
    hash: sha256:dc07d48fb2a2360f67cef0e9dfc58b5686561edcc9904dc4236afbf17ec162b5
  - path: docs/simulators/snow-crystal-sim/DESIGN-OUTLINE.md
    hash: sha256:822c47deb32cf5bb6791ce080c8e13612723bcbccaed59fb60e4ef9512e0d7bf
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/DESIGN.md
    hash: sha256:f47bd555be23a1e26e745e3f08b013cfb925e00638bcc6937ceccc4634804e63
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/DECISIONS.md
    hash: sha256:3c9c441217ea3d90b485f27be110bde416b02d7702eeadd85d3f11ccd6fab6e9
findings: []
conditions: []
rollback_to: none
summary: "R-005 は解消された。比較専用 master 列は通常列挙順の H_R を先頭に置くため production H_R の PRNG 消費列と一致し、残りの和集合座標も一度だけ生成される。各格子は同じ master field から waterMass・ice・noise のビット列をコピーし、追加セルにも同一規則を適用する。初回 step 前の全 pairwise intersection、production H_R、追加セル、共通 metadata の完全一致検査、および全 checkpoint の stepIndex・control prefix・数値 bit pattern・文字列一致と早期停止失敗が明記され、境界形状または距離以外の比較条件は一意に固定されて実装可能である。独立計算では R=115 の H_R が 40,021 セル、H_2R が 159,391 セル、同セル数最近傍の E_R が d_R=105・40,015 セルとなり、E_R は H_2R 内に収まる。R-001〜R-004 の動的 beta 境界、xoshiro128** 1.1、aspectRatio の null 境界、固定順 Neumaier と独立 Kahan の各契約も文書間で維持されている。作者参照実装は version 1.1 と s[1] scrambler を示し、設計書の5組の PRNG state/output ベクトルは独立再計算ですべて一致した。CA 水量、gamma の CA水量/CA step、dtCa の CA step、無次元過飽和度と百分率表示にも次元矛盾はない。"
```

```yaml
review_type: testcases
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md
    hash: sha256:f7ee452a47c5f4ea15df5258d81e79aeeb278a86bd44e106083c0c42f61b0aae
findings: []
conditions: []
rollback_to: none
summary: "前回の R-001〜R-007 はすべて解消された。TC-BETA-002 は radius=7 の reservoir を h=7 とし、(4,0) からの最短距離3と新 beta の1-step front h=6を正しく拘束する。TC-FREEZE-001 は m'=1 の直下・一致・直上を 0.9999999999999999、1、1.0000000000000002 と独立確認でき、step開始時の固定 receptive mask と次stepだけの伝播を検査する。TC-MASS-001 は initialBeta=0.2、initialNoiseAmplitude=0.4、18個の1-step fixtureを固定し、beta=0/0.95で reservoirExchange の負/正を別々に要求する。不正 state は noise の境界外・非有限値、beta/noiseAmplitude、seed、radius、modelVersion を網羅する。形態ケースは tipDensity=1 の非ゼロ分岐と 0〜300度のsector境界を追加し、独立再計算した armLengthCv=1/sqrt(5)、armMassCv=sqrt(43/3)/7、単一腕CV=sqrt(5)と整合する。性能 harness は T2-4 の app 境界内へ移され、replay-key の canonical化とURL往復は具体的なapp APIを確定する T4-2へ割り当てられ、T1-2には保存済みcontrol列によるdomain再実行だけが残る。Reiter alpha=1 の無次元CA水量、gammaのCA水量/CA step、dtCaのCA step、過飽和度[%]の区別、独立pairwise/Kahanオラクル、許容誤差、境界感度条件にも上位設計との矛盾はない。"
```

```yaml
review_type: implementation
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/TASKS.md
    hash: sha256:4c9331e4d1802d206d8cc98163752b1c48ca9fd79c2ed1012bfdbf344a003742
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md
    hash: sha256:f7ee452a47c5f4ea15df5258d81e79aeeb278a86bd44e106083c0c42f61b0aae
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/EVIDENCE.md
    hash: sha256:266e22d2046e0365b961ecbb0aaef4a76645032a21063e96c9a0111a7384c297
findings: []
conditions: []
rollback_to: none
summary: "ユーザー承認済みの full から lightweight への是正は、実行コードや既存挙動を変更しない文書専用の変更境界、および tasks-authoring-rules の省略理由・代替検証・差分レビュー要件と整合する。テストコード、expected Red、Green はケース群と候補ファイルを伴って T1-1、T1-2、T1-3、T2-4、T2-5、T4-2 へ明示的に移管され、各後続タスクで baseline、Red、Green、最終検証を記録する追跡条件もある。未作成 module の依存エラーを Red としないテスト不要理由は妥当であり、設計・テストケースの物理レビュー、成果物ハッシュ、差分検査、全 workspace 検証を代替検証とする記録も十分である。TESTCASES.md の現 SHA-256 は最新 approved 記録と一致し、承認済み SPEC、DESIGN-OUTLINE、DESIGN、DECISIONS の各ハッシュも維持されている。全 workspace 検証を独立再実行し、architecture、lint、typecheck、prism-sim 33 files・937 tests、snow-crystal-sim のテストなし code 0、両 build の成功を確認した。Reiter alpha=1 の更新式、CA 水量と CA step の単位、beta/gamma 範囲、reservoir と面外入力の収支、xoshiro128** 1.1、独立 Kahan オラクル、境界感度の適用範囲・許容値に未解決の物理・数値矛盾はない。"
```

```yaml
review_type: implementation
status: approved
reviewed_files:
  - path: docs/simulators/snow-crystal-sim/TASKS.md
    hash: sha256:3c96b2fea02a3859470f016ca7f2b7dbb49a8b91714124be4b74c6bb320ce164
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/TESTCASES.md
    hash: sha256:f7ee452a47c5f4ea15df5258d81e79aeeb278a86bd44e106083c0c42f61b0aae
  - path: docs/simulators/snow-crystal-sim/tasks/T1-0/EVIDENCE.md
    hash: sha256:266e22d2046e0365b961ecbb0aaef4a76645032a21063e96c9a0111a7384c297
findings: []
conditions: []
rollback_to: none
summary: "前回承認対象の TASKS.md を T1-0 の状態だけ「完了」から「レビュー待ち」へメモリ上で戻すと、SHA-256 は前回 implementation review の承認ハッシュ 4c9331e4d1802d206d8cc98163752b1c48ca9fd79c2ed1012bfdbf344a003742 と完全一致した。したがって承認後の変更は、最終検証と implementation review 承認後に行う機械的な完了状態遷移だけである。lightweight へのユーザー承認済み是正、文書専用の変更境界、テストコード・Red・Green の省略理由、T1-1・T1-2・T1-3・T2-4・T2-5・T4-2 へのケース別移管、各後続タスクでの baseline・Red・Green・最終検証の追跡条件は維持されている。TESTCASES.md と EVIDENCE.md は前回承認ハッシュから不変であり、REVIEW.md の設計・テストケース・実装承認記録とも整合する。さらに SPEC.md、DESIGN-OUTLINE.md、DESIGN.md、DECISIONS.md の現ハッシュは最新の design approved 記録と一致し、Reiter alpha=1、CA水量・CA step の単位、beta/gamma、reservoir収支、xoshiro128** 1.1、独立オラクル、境界感度の適用範囲と許容値を含む物理・数値契約に変更はない。git diff --check も成功しており、T1-0 を完了とする状態遷移は妥当である。"
```
