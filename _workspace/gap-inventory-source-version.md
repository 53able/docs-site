# ギャップ一覧（Self-Refine プラン実行時）

## スコープ決定

- **採用**: **(A) 版情報ブロック + `source-repo-commit` のみ**（本文の upstream 全面リライトは行わない）

## verify-docs-repos-gap.py（実行結果サマリ）

- `docs` ページ数: 86
- unresolved（canonical GitHub なし）: 0
- `repos/` 未クローン: 0

## 未対応 HTML（実行前）

- `rg` により **解説時点 / source-repo-commit なし** は worktree 上で 86 件すべて（main 時点）。

## 実行後

- `tmp/inject-source-version-blocks.py` により全 `docs/*.html` に注入。
- `repos/<dir>` に `.git` がない場合は **一時 shallow clone** でメタデータ取得（opentui / react-grab 等）。
- `<main class="main">` ページ（`openui.html`）はアンカー拡張で対応。

## 補足

- `repos/` はコミット対象外（`.gitignore`）。作業時は各 `repos/*` で `pull` / 一時 clone のみ参照。
