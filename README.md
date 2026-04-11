# 資料サイト（GitHub Pages）

HTML 資料を GitHub Pages で公開するリポジトリ。トップで資料一覧を表示し、`docs/` 配下の各ページへリンクする構成です。

## 概要

- **目的**: オープンソース製品・ライブラリなどの **ビジュアル解説**（Spell UI ベースの単体 HTML）をホスティングし、URL で共有する。
- **公開 URL**: https://tadano-go.github.io/docs-site/
- **デプロイ**: `main` ブランチへの push で [GitHub Actions](.github/workflows/deploy-pages.yml) が走り、リポジトリルートをそのまま GitHub Pages にアップロードする（Settings → Pages のソースは GitHub Actions）。

## リポジトリ構成

| パス | 説明 |
|------|------|
| `index.html` | 資料一覧トップ。新しい資料を増やしたら `.doc-list` にカードを 1 件追加する。 |
| `docs/` | ビジュアル解説用 HTML。1 ページ 1 テーマ（ファイル数は運用で増減）。 |
| `.github/workflows/` | Pages デプロイ定義。 |
| `.cursor/skills/` | Cursor 用スキル（追加・更新手順や repos 同期など）。コミット対象はリポジトリの `.gitignore` 方針に従う。 |

## ビジュアル解説の追加・本文更新

手順の正本は **docs-site-add-visual-doc** スキルにまとめてある。

- スキル: `.cursor/skills/docs-site-add-visual-doc/SKILL.md`
- 新規 `docs/<名前>.html`、JiT でソース走査、Spell UI 生成、`index.html` へのリンク、ドラフト PR までが一連の流れ。

各解説ページの冒頭付近には **解説時点のソース**（コミット短縮 SHA・describe・ブランチ・日時・GitHub リンク）を載せる。メタデータだけを一括で揃え直す場合は、リポジトリルートで次を実行する。

```bash
python3 .cursor/skills/docs-site-repos-sync/scripts/inject-source-version-blocks.py
```

（`repos/` 側に Git 履歴がないディレクトリだけ、一時的な shallow clone でメタデータを取る。）

## 解説対象リポジトリとの対応確認

`docs/*.html` とローカルに置いたソースミラーとの突合は、次で一覧できる。

```bash
python3 .cursor/skills/docs-site-repos-sync/scripts/verify-docs-repos-gap.py
```

詳細は **docs-site-repos-sync** スキル（`.cursor/skills/docs-site-repos-sync/SKILL.md`）を参照。ローカル用のソースミラーは **コミットに含めない** 運用とする。

## 全リポジトリのソースを最新化したいとき

`.cursor/skills/repos-pull-latest/SKILL.md` に従い、`repos/` 配下をまとめて `git pull` するスクリプトを利用できる。
