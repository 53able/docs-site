---
name: docs-site-repos-sync
description: >-
  Aligns local repos/ with docs-site visual doc pages by resolving each docs/*.html to one GitHub owner/repo,
  diffing against repos/ directory names, and cloning missing sources with a predictable folder name.
  Use when syncing or cloning “解説対象” repositories, filling repos/ gaps, verifying “not cloned under repos/”,
  or after adding docs pages that need a matching clone under repos/.
---

# docs-site: repos/ と解説ページの同期

ビジュアル解説（`docs/*.html`）の **正ソース 1 本**と **`repos/<名前>/`** を突合し、未取得だけ `git clone` する。`docs-site-add-visual-doc` の Step 0（取得）と同じ前提。

## 前提

- 作業ディレクトリは **docs-site リポジトリのルート**（`docs/` と `index.html` がある階層）。
- `repos/` は **`.gitignore` 対象**のため Glob に載らない。存在確認は `ls repos` やパス直読み。
- `repos/` が無いと検証が失敗する → 先に `mkdir -p repos`。

## パス表記（本スキルディレクトリ基準）

以下は **`docs-site-repos-sync/`（このスキルフォルダ）をカレントとした相対パス**。

| 役割 | 相対パス |
|------|----------|
| 検証スクリプト | `./scripts/verify-docs-repos-gap.py` |
| 近傍スキル（解説生成） | `../docs-site-add-visual-doc/SKILL.md` |

リポジトリルートでコマンドを打つときは、スキルまでを一度変数にまとめるとスキル相対パスと対応しやすい。

```bash
SKILL=./.cursor/skills/docs-site-repos-sync
# 検証スクリプト = $SKILL + ./scripts/verify-docs-repos-gap.py
```

## 手順

### 1. ギャップ検証

**正本（スキル同梱）** — リポジトリルートで:

```bash
SKILL=./.cursor/skills/docs-site-repos-sync
python3 "$SKILL/scripts/verify-docs-repos-gap.py"
```

読む指標:

| 出力 | 意味 |
|------|------|
| `unresolved (no canonical GitHub) > 0` | その HTML から `owner/repo` を一意に決められない。スクリプト内の `OVERRIDE`（`./scripts/verify-docs-repos-gap.py`）や本文の GitHub リンクを直す（スキル外の編集が必要ならユーザーに確認）。 |
| `not cloned under repos/: N` | 下の TSV 行が **未クローン一覧**（`owner/repo` と対応する `*.html`）。 |

### 2. クローン先ディレクトリ名（必ずこの形）

検証ロジック `match_folder` が認識する候補のうち、衝突しにくく機械的なのは **`repos/{owner}-{repo}`**（GitHub 上の **owner / repo の表記どおり**）。

- 例: `AlexsJones/llmfit` → `repos/AlexsJones-llmfit`
- 例: `browser-use/browser-use` → `repos/browser-use-browser-use`

### 3. 一括クローン

未存在のみ（既に `repos/{owner}-{repo}/.git` がある場合はスキップまたは `git -C ... pull --ff-only`）。

```bash
SKILL=./.cursor/skills/docs-site-repos-sync
python3 "$SKILL/scripts/verify-docs-repos-gap.py" | awk -F'\t' 'NF==2 && $1 ~ /\// {print $1}' | while IFS= read -r ref; do
  owner="${ref%%/*}"
  repo="${ref#*/}"
  target="repos/${owner}-${repo}"
  [ -d "$target/.git" ] && { echo "SKIP $target"; continue; }
  git clone --depth 1 "https://github.com/${owner}/${repo}.git" "$target"
done
```

- 履歴が要る場合のみ各リポで `git fetch --unshallow` 等（デフォルトは浅いクローンで十分なことが多い）。
- 認証・ネットワーク・プライベートリポは失敗しうる → 失敗行をログに残して再実行。

### 4. 完了条件

再度:

```bash
SKILL=./.cursor/skills/docs-site-repos-sync
python3 "$SKILL/scripts/verify-docs-repos-gap.py"
```

**`not cloned under repos/: 0`** なら、当該 HTML については `repos/` 側の名前解決が通っている。

### 5. 解説ページの版メタ注入（`inject-source-version-blocks.py`）

`repos/` を `repos-pull-latest` 等で更新したあと、各 `docs/*.html` の **`<!-- source-repo-commit -->`** と **「解説時点のソース」カード**を、対応する `repos/<folder>` の **現在の HEAD** に合わせて書き換える。

- スクリプト: `./scripts/inject-source-version-blocks.py`（リポジトリルートで実行）
- **既にカードがあるページも毎回置換**する（古い SHA のまま残さない）
- 本文の README 同期はしない（版メタのみ）。本文まで直す場合は `docs-site-add-visual-doc` を使う

## エージェント向け注意

- **このスキルは `docs/*.html` や検証スクリプトのロジックを変えない**。ギャップの原因が `unresolved` なら、編集が必要かユーザーに止める。
- **git の main 直コミット禁止**などリポジトリ規約は別ルールに従う。`repos/` 配下は通常 docs-site のコミット対象外。
- 複数エージェントと並列するときは **agents-orchestrator** 観点で「検証 → クローン → 再検証」を一連のパイプラインにする。

## 関連

- 解説ページ生成・PR まで: `../docs-site-add-visual-doc/SKILL.md`（スキルディレクトリからの相対）
- 検証スクリプト（同梱）: `./scripts/verify-docs-repos-gap.py`
