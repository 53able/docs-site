---
name: docs-site-add-visual-doc
description: >-
  Adds Spell UI visual documentation pages to docs-site from repos/ sources: optional clone into repos/,
  Context Engineering (JiT loading, structured extraction, self-refinement), scan-source.sh inventory,
  Think–Structure–Style and templates, writes docs/<name>.html, links index.html, opens draft PRs.
  Use when converting READMEs, SKILLs, or cloned repos under repos/ into docs-site pages.
  Do not use for non-docs-site projects, source outside repos/, standalone generic HTML outside this site,
  or large in-place rewrites of existing pages (do focused edits instead).
---

# docs-site ビジュアル解説（統合スキル）

`repos/<name>/`（またはクローン取得）を **`docs/<name>.html`** にし、`index.html` を更新して **ドラフト PR まで**完了させる。旧 `repo-to-visual-doc` の **Context Engineering 三原則** と、旧 `docs-site-add-visual-doc` の **クローン・Spell UI・PR 手順** を一本化したもの。

| 原則 | 適用 | 目的 |
|------|------|------|
| **JiT Loading** | ソース走査・参照読み込み | 必要な時だけ読み、コンテキストを汚染しない |
| **Structured Extraction** | コンテンツ分類 → コンポーネント | 生ソースを視覚コンポーネントへ変換 |
| **Self-Refinement** | 生成後の検証 | 既存 `docs/*.html` との整合で品質担保 |

## スコープ

- **対象**: docs-site リポジトリ内。解説の正は **`repos/<名前>/`**（URL クローン時は Step 0 で取得）。
- **出力**: `<プロジェクトルート>/docs/<名前>.html`。汎用 Visual Explainer の `~/.agent/diagrams/` は **docs-site 作業では使わない**（`references/visual-explainer-core.md` 先頭の注記どおり）。
- **ファイル名・ブランチ名**: 単語連結 **最大 4 つ**。

### repos の可視性

`repos/` は **`.gitignore` 対象**のため Glob で見えないことがある。`ls` や Read でパス直接確認する。

---

## 入力

- **リポジトリ URL（通常）**: HTTPS または SSH → Step 0 で `repos/` にクローン。
- **既存 `repos/<名前>/` のみ**: URL なしでパスだけなら Step 0 をスキップ。必要なら `git -C repos/<名前> pull`。
- **クローン先名（任意）**: URL 時のみ。省略時は URL から推測。

---

## Phase 1: Source Acquisition（JiT — ディレクトリ優先）

### Step 0: リポジトリのクローン（URL があるときのみ）

1. プロジェクトルート（`docs/` と `index.html` がある階層）で作業する。
2. `repos/<clone-dir>/` を決める（ユーザー指定 → URL から推測 → 長すぎる場合は短名を確認）。
3. `mkdir -p repos`。
4. 既存あり **かつ Git リポジトリ**: `git -C repos/<clone-dir> pull --ff-only` を試す。衝突時は別名を確認。
5. 新規: `git clone <URL> repos/<clone-dir>`（任意で `--depth 1`）。
6. `ls repos/<clone-dir>` で取得を確認。以降 **`repos/<clone-dir>` を解説ルート**とする。

### Step 1a: スキャン（推奨）

ワークスペースルートから:

```bash
bash .cursor/skills/docs-site-add-visual-doc/scripts/scan-source.sh repos/<clone-dir>
```

出力を手がかりに、読むファイルの優先度を決める。

### Step 1b: ソース読み取り順（固定。前段で足りれば後段を読まない）

1. 優先度 1: ディレクトリ構造 → 責務を推測。
2. 優先度 2: `README.md` → インターフェイスと目的。
3. 優先度 3: メインエントリ（`SKILL.md` / `index.*` / `main.*`）→ 公開 API・手順。
4. 優先度 4–6（JiT）: Step 3 で必要と判断した時のみ `references/` / `assets/` 等を読む。

**Context Compression**: 読んだファイルから「タイトル・目的・主要構造・重要な制約」だけを内部に保持し、全文をコンテキストに載せ続けない。

### Step 1c: 深い解析

**code-reading スキル**（`.cursor/skills/code-reading`）に従い、Glob に頼らずパスで確認する。得た理解を HTML 本文に反映する。

---

## Phase 2: Reference Acquisition（JiT — Spell UI パターン）

読むのは **2〜3 本＋本スキル補助**が基本。

| 読むファイル | 目的 |
|-------------|------|
| `index.html` | Spell UI、`.doc-list`、Unfurl コメントとメタの並び |
| `docs/react-grab.html` または `docs/defuddle.html` のいずれか 1 件 | `<style>` 順序・コンポーネント・体裁 |
| `docs/defuddle.html` 末尾 | Scroll Spy（`active` は常に 1 件） |

**本スキル配下の `references/` は補助**。見た目の正は **リポジトリの `index.html` と `docs/*.html`**。

ページ生成前に必ず次を踏む。

1. **`references/visual-explainer-core.md`**（Think → Structure → Style、図タイプ、品質、Anti-Patterns）。Deliver の diagrams パスは無視。
2. **Spell UI**: `references/spell-ui-integration.md`、`references/spell-ui-tokens.css`、`references/spell-ui-static.css`。既存ページ（`opentui.html` / `react-grab.html` 等）に合わせる。
3. **必要時のみ JiT**: `references/context-extraction.md`（変換に迷った時）、`references/spell-ui-map.md`（コンポーネント選択に迷った時）、`references/css-patterns.md`、`references/libraries.md`、`references/responsive-nav.md`、`templates/`。

---

## Phase 3: Structured Extraction（コンテンツ変換）

`references/context-extraction.md` を読み、ソースから **情報タイプ**を分類する（概念 / 手順 / 設定 / コード / 比較 / 注意）。

- 情報タイプ → Spell UI へのマッピングは **`references/spell-ui-map.md`**。
- セクション **4 本以上**なら TOC 付きレイアウト（`references/responsive-nav.md`、`docs/defuddle.html` の Scroll Spy）。
- 審美: フォント・パレット・アクセントを選ぶ。**禁止**: Inter / Roboto / violet / cyan-magenta-pink（詳細は `spell-ui-map.md`）。
- **ASCII 表を避ける**: 複雑な表は HTML テーブル化（`visual-explainer-core.md`）。

---

## Phase 4: Generation（`docs/<名前>.html`）

`references/visual-explainer-core.md` と Phase 2 の既存 HTML を踏まえ、新規 `docs/<名前>.html` を作成する。`<名前>` はソースディレクトリ名と一致させる。

1. **Unfurl**: 既存 `docs/*.html` と同形式。`og:url` = `https://tadano-go.github.io/docs-site/docs/<ファイル名>.html`。
2. **Spell UI**: THEME → Spell UI static → Wrap+TOC → …。`.ve-card`、`ve-code-block`、`ve-table-wrap` 等は `spell-ui-map.md` と内容に合わせて使う。
3. **4 セクション以上**: `.wrap` / `.toc` / `.main`、Scroll Spy を `defuddle.html` からコピー。
4. **Mermaid・表・図**: `visual-explainer-core.md` の Diagram Types と **`references/libraries.md`**。

---

## Phase 5: Self-Refinement（整合検証）

1. 生成 HTML を既存 1 ページと目視比較: フォント・パレット差別化、THEME トークン名、Scroll Spy の `toggle('active', s === current)`。
2. **`references/checklist.md`** で一通り確認。

---

## Phase 6: index・コミット・PR

### index.html へのリンク追加

`.doc-list` に既存と同形式のリンクカードを 1 件追加する（コメント「追加する資料はここに」の直前が無難）。

```html
<li>
  <a class="ve-card ve-card--link" href="docs/<ファイル名>.html">
    <span class="index-doc-title">（資料のタイトル）</span>
    <span class="index-doc-file">docs/<ファイル名>.html</span>
  </a>
</li>
```

### index の画面構成を Spell UI で揃える（任意）

別コミット可。変更は `index.html` のみ。

### ブランチ・コミット

1. `git branch --show-current`。main のまま直コミット禁止なら `git checkout -b docs/<名前>-link`。
2. `git add docs/<新規>.html index.html` → `git commit -m "docs: ○○ ビジュアル解説追加と index リンク"`。**`repos/` はコミットに含めない。**

### Push とドラフト PR

1. `git push -u origin <branch>`
2. `gh pr create --draft --base main`（`--title`・`--body-file` はプロジェクトルールに合わせる）。本文に **解説元**（URL または `repos/<名前>`）と **変更ファイル**。詳細は **pr-creation スキル**。絵文字禁止ルールがある場合は PR 本文にも入れない。
3. 完了後 `git checkout main`

---

## Error Handling

| 状況 | 対応 |
|------|------|
| `repos/<name>` が Glob で見つからない | `.gitignore` のため Glob 不可。`ls` または `Read` で直接確認 |
| README が無い | メインエントリから直接読む |
| Scroll Spy が動かない | `docs/defuddle.html` 末尾スクリプトを再コピー。`toggle` パターンを確認 |
| `doc-list` の位置が分からない | `grep -n "doc-list" index.html` |
| フォント・パレットが既存と被る | `references/spell-ui-map.md` の差別化チェック |

---

## 参照（他スキル）

| 用途 | 参照先 |
|------|--------|
| repos 内の解析 | code-reading（`.cursor/skills/code-reading`） |
| コミット分割 | commit-diffs |
| 複雑な PR | pr-creation |
| index 変更の事前評価 | self-refine |

**ビジュアル詳細**は `references/visual-explainer-core.md` と `references/spell-ui-integration.md` を正とする。

---

## JiT リファレンス一覧（迷った時だけ読む）

| タイミング | ファイル |
|-----------|---------|
| コンテンツ変換 | `references/context-extraction.md` |
| コンポーネント選択・フォント | `references/spell-ui-map.md` |
| Phase 1 の整理 | `scripts/scan-source.sh` を実行 |
