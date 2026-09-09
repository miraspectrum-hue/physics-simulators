# 物理シミュレータ集

各種の物理シミュレータを集めたモノレポです。`apps/` 配下に、独立した Web アプリとして
シミュレータを1つずつ追加していきます。

## シミュレータ一覧

- [プリズム分光シミュレータ（prism-sim）](./apps/prism-sim/README.md) — 正三角柱プリズムによる白色光の分散を3Dで可視化
  - 公開URL: <https://miraspectrum-hue.github.io/physics-simulators/> （GitHub Pagesで自動デプロイ、`main`への変更を反映）
- [雪の結晶シミュレータ（snow-crystal-sim）](./apps/snow-crystal-sim/) — 温度と過飽和度による雪の結晶の成長を3Dで可視化

## 構成

```
repo-root/
├── package.json      # npm workspaces のルート定義（apps/* をまとめて扱う）
└── apps/
    └── prism-sim/     # プリズム分光シミュレータ（独立した Vite + TypeScript プロジェクト）
```

各 `apps/*` は完全に自己完結したプロジェクトです。それぞれ独自の `package.json`・
`CLAUDE.md`（開発規約）・`SPEC.md`（仕様）・`TASKS.md`（作業記録）を持ち、
他のシミュレータへのコード依存はありません。開発する際は対象のディレクトリへ移動して
作業してください（例: `cd apps/prism-sim`）。

## セットアップ

```bash
npm install       # ルートで実行すると全 apps の依存を一括解決
npm run test      # 全 apps のテストを実行（各 app に test スクリプトがあれば）
npm run build     # 全 apps をビルド
```

個別のシミュレータだけを操作したい場合は、そのディレクトリへ移動するか
`npm run <script> --workspace=apps/<name>` を使ってください。
