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
