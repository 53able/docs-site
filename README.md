# 資料サイト（GitHub Pages）

HTML 資料を GitHub Pages で公開するリポジトリ。トップで資料一覧を表示し、各 HTML へリンクする構成です。

## 概要

- **目的**: 技術資料・スライドなどの HTML を GitHub 上でホスティングし、URL で共有する。
- **構成**: ルートに `index.html`（一覧）と各資料の HTML を置き、main への push で GitHub Actions が GitHub Pages にデプロイする。

## リポジトリ構成

| パス | 説明 |
|------|------|
| `index.html` | 資料一覧トップ。ここに各資料へのリンクを追加する。 |
| `docs/` | 資料用 HTML を格納するディレクトリ。 |
| `docs/agency-agents.html` | 資料の一例（The Agency: agency-agents リポジトリ説明）。 |
| `README.md` | 本ドキュメント。 |

資料を増やすときは、新しい HTML を `docs/` に追加し、`index.html` の資料リストに 1 件追加する。
