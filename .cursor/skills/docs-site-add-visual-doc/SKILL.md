---
name: docs-site-add-visual-doc
description: Adds Spell UI visual documentation pages to docs-site, links them from index, and opens draft PRs. Accepts a repository URL for cloning into repos/ or an existing repos/ path without a URL. Applies Think–Structure–Style guidance from bundled references and templates. Does not replace repo-to-visual-doc for non-docs-site pipelines, or standalone generic HTML diagrams outside this GitHub Pages site.
---

# docs-site ビジュアル解説（統合スキル）

docs-site リポジトリに Spell UI で統一したビジュアル解説ページを追加し、index との整合を取って **PR まで完了**させる。**ビジュアル設計（Think → Structure → Style）、Mermaid・テーブル・品質チェック**は旧 `visual-explainer-spell-ui` の内容を **本スキル配下の `references/`・`templates/`・`prompts/`** に集約している。別スキルディレクトリを参照しない。

## 入力

- **リポジトリ URL（通常）**: HTTPS または SSH。Step 0 で `repos/` にクローンする。
- **既存 `repos/<名前>/` のみ**: URL を渡さずパスだけ指定する場合は Step 0 をスキップし、そのディレクトリを解説ルートとする。必要なら `git -C repos/<名前> pull`。
- **クローン先名（任意）**: URL クローン時のみ。省略時は URL から推測。**単語連結最大 4 つ**。

## 前提

- **取得**: 解説の元ネタは、URL クローン時は Step 0 で **`repos/` へ取り込んだディレクトリ**、既存のみのときは **その `repos/<名前>/`** を正とする（プロジェクト外パスは参照しない）。
- **出力先**: 解説 HTML は **`<プロジェクトルート>/docs/<名前>.html`**。汎用 Visual Explainer 本文に出てくる `~/.agent/diagrams/` は **docs-site 作業では使わない**（`references/visual-explainer-core.md` 先頭の注記どおり）。
- **main 直接コミット禁止**がある場合はブランチでコミットする。
- ファイル名・ブランチ名は **単語連結最大 4 つ**。

### repos の有無

**`repos/` は `.gitignore` 対象のため**、Glob 等では見えないことがある。`ls` や Read でパス直接確認する。

---

## ビジュアル設計（Step 3 の前に読む）

ページ生成前に次を行う。

1. **`references/visual-explainer-core.md` を読む**（Think → Structure → Style、図タイプの選び方、品質チェック、Anti-Patterns）。長いが docs-site では Deliver の diagrams パスは無視する。
2. **Spell UI 固定**: `references/spell-ui-integration.md`、`references/spell-ui-tokens.css`、`references/spell-ui-static.css` を把握する。実装の見た目は **プロジェクトの `index.html` と `docs/opentui.html` または `docs/react-grab.html`** を正とし、トークン・コンポーネントは既存ページに合わせる。
3. **補助参照**（必要に応じて）: `references/css-patterns.md`、`references/libraries.md`（Mermaid・フォント）、`references/responsive-nav.md`（4+ セクションの TOC）、`templates/` 内の該当 HTML。
4. **ASCII 表を避ける**: 複雑な表は HTML テーブル化する方針は `visual-explainer-core.md` に従う（docs-site では `docs/*.html` へ出力）。

---

## ワークフロー

### Step 0: リポジトリのクローン（URL を渡したとき）

URL が無い場合はこの Step をスキップする。

1. プロジェクトルート（`docs/` と `index.html` がある階層）で作業する。
2. `repos/<clone-dir>/` を決める（ユーザー指定 → URL から推測 → 長すぎる場合は短名を確認）。
3. `mkdir -p repos`。
4. 既存あり **かつ Git リポジトリ**: `git -C repos/<clone-dir> pull --ff-only` を試す。衝突時は別名を確認。
5. 新規: `git clone <URL> repos/<clone-dir>`（任意で `--depth 1`）。
6. `ls repos/<clone-dir>` で取得を確認。以降 **`repos/<clone-dir>` を解説ルート**とする。

### Step 1: 解説対象のコード解析

**`repos/`** 以下が元ネタのとき、**code-reading スキル**（`.cursor/skills/code-reading`）に従い解析する。Glob に頼らずパスで確認する。得た理解を Step 3 の本文に反映する。

### Step 2: 参照取得（プロジェクト内）

| 読むファイル | 目的 |
|-------------|------|
| `index.html` | Spell UI、`.doc-list`、Unfurl コメントとメタの並び |
| `docs/opentui.html` または `docs/react-grab.html` のいずれか 1 件 | 1 ページ分の体裁・`<style>` 順序・コンポーネント |
| `docs/defuddle.html` 末尾 | Scroll Spy（`active` は常に 1 件） |

**本スキル配下の `references/` は補助**。見た目の正は **リポジトリの `index.html` と `docs/*.html`**。

### Step 3: ビジュアル解説ページの生成

**`references/visual-explainer-core.md` と Step 2 の既存 HTML を踏まえ、** 次を満たす `docs/<名前>.html` を新規作成する。

1. **Unfurl**: 既存 `docs/*.html` と同形式。`<!-- Unfurl: Open Graph -->` / `<!-- Unfurl: Twitter Card -->`。`og:url` = `https://tadano-go.github.io/docs-site/docs/<ファイル名>.html`。
2. **Spell UI**: Step 2 で流用した THEME → Spell UI static → Wrap+TOC → …。コンポーネントは `.ve-card`、`.ve-card--elevated`、`.ve-card--recessed`、`.ve-card--hero`、`.ve-section-label`、`.ve-code-block`、`.ve-table-wrap`、`.ve-kpi-card`、`.ve-callout` 等を内容に合わせて使う。
3. **4 セクション以上**: `.wrap` / `.toc` / `.main`、`references/responsive-nav.md` の方針と `docs/defuddle.html` の Scroll Spy をコピー。
4. **本文**: Step 1 の理解に基づき、概要・構成・使い方等を既存資料と同程度の粒度で書く。Mermaid・表・図の扱いは **`references/visual-explainer-core.md`** の Diagram Types と **`references/libraries.md`** に従う。

### Step 4: index.html へのリンク追加

`.doc-list` に既存と同形式のリンクカードを 1 件追加する（コメント「追加する資料はここに」の直前が無難）。

```html
<li>
  <a class="ve-card ve-card--link" href="docs/<ファイル名>.html">
    <span class="index-doc-title">（資料のタイトル）</span>
    <span class="index-doc-file">docs/<ファイル名>.html</span>
  </a>
</li>
```

### Step 5: index の画面構成を Spell UI で揃える（任意）

ヒーロー・セクションラベル・コンテナ幅など。実施時は **別コミット**可。変更は `index.html` のみ。

### Step 6: ブランチ・コミット

1. `git branch --show-current`。main のまま直コミット禁止なら `git checkout -b docs/<名前>-link`。
2. `git add docs/<新規>.html index.html` → `git commit -m "docs: ○○ ビジュアル解説追加と index リンク"`。**`repos/` はコミットに含めない。**

### Step 7: Push とドラフト PR

1. `git push -u origin docs/<名前>-link`
2. `gh pr create --draft --base main`（`--assignee`・`--title`・`--body-file` はプロジェクトルールに合わせる）。本文に必ず **解説元**（クローンした URL または `repos/<名前>`）と **変更ファイル** を書く。詳細テンプレは **pr-creation スキル**を参照。絵文字禁止ルールがある場合は PR 本文にも入れない。
3. 完了後 `git checkout main`

---

## チェックリスト

`references/checklist.md` を完了確認に使う。

---

## 参照（他スキル）

| 用途 | 参照先 |
|------|--------|
| repos 内の解析 | code-reading（`.cursor/skills/code-reading`） |
| コミット分割 | commit-diffs |
| 複雑な PR | pr-creation |
| index 変更の事前評価 | self-refine |
| repos のみ・別パイプライン | repo-to-visual-doc（`.cursor/skills/repo-to-visual-doc`） |

**本スキル内のビジュアル詳細**は `references/visual-explainer-core.md` と `references/spell-ui-integration.md` を正とする。
