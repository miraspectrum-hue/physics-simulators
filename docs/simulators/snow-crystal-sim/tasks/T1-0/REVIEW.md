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
