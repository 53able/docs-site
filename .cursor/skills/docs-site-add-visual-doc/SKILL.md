---
name: docs-site-add-visual-doc
description: docs-site に Spell UI 準拠のビジュアル解説ページを追加し、index にリンク・画面構成を揃え、ブランチでコミットして PR まで行う一連のワークフロー。本スキル内の手順だけで完結する。「資料を追加して」「新しい解説ページを」「index に載せたい」と依頼された時に使用。
---

# docs-site ビジュアル解説の追加ワークフロー

docs-site リポジトリに、Spell UI で統一したビジュアル解説ページを追加し、index との整合を取って **PR まで完了**させる手順。参照はすべて **プロジェクト内** の既存ファイルに取り、本スキル内で完結する。

**visual-explainer-spell-ui スキルとの連携**: 解説ページの**構成・図の種類・スタイル指針**（Think → Structure → Style）には **visual-explainer-spell-ui スキル**（`.cursor/skills/visual-explainer-spell-ui`）を活用する。ページ生成（Step 2）の前に当該スキルを読み、Spell UI トークン・コンポーネント・図タイプ（Mermaid / CSS Grid / データテーブル等）の選び方に従う。出力先・Unfurl・index リンクは本スキルのルールに従う。

## 前提

- **参照元**: 解説の元ネタ（ソース）は **ワークスペース内** の **`<プロジェクトルート>/repos/`** 以下に置かれたディレクトリを参照する。プロジェクト外のパスは参照しない。
- **出力先**: 解説ページの HTML は **`<プロジェクトルート>/docs/`** に出力する（ユーザーが別指定した場合はそれに従う）。
- **main 直接コミット禁止**のルールがある場合は、必ずブランチを切ってからコミットする。
- ファイル名・ブランチ名は **単語連結最大 4 つまで** のルールに従う。

### repos の有無を判定するときの注意

**`repos/` は `.gitignore` に含まれているため**、Glob や grep など「gitignore を尊重する検索」では `repos/` 以下が 0 件になることがある。**「repos がない」と結論しないこと。**

- **存在確認**: `repos/` および対象ディレクトリ（例: `repos/Kaku`）の有無は、**そのパスを直接扱う方法**で行う。例: 当該パスを Read で開く、またはターミナルで `ls <プロジェクトルート>/repos` / `ls <プロジェクトルート>/repos/Kaku` を実行する。
- ユーザーが `@repos/Kaku` のように指定した場合は、`<プロジェクトルート>/repos/Kaku` を上記の方法で確認してから Step 0 に進む。

---

## ワークフロー（スキル内完結）

### Step 0: 解説対象のコード解析（repos 内にソースがある場合）

解説の元ネタが **`repos/`** 以下のディレクトリ（例: `repos/Kaku`、`repos/learn-claude-code-main/`）である場合、**code-reading スキル**（`.cursor/skills/code-reading`）に従ってコード解析を行う。対象が repos 以下かどうかは、上記「repos の有無を判定するときの注意」に従い、Glob に頼らずパス直接で確認する。

- **事前に code-reading の SKILL.md を読む**。3 層フレームワーク（取得・処理・管理）とクイックフロー（ゴール定義 → 境界設定 → 情報取得の優先順位）に沿って、インターフェイスと役割の理解に集中し、読む箇所を極小化する。
- 複数モジュール跨ぎ・探索的ゴールの場合は、code-reading で推奨するサブエージェント（explore）の起動を検討する。
- 得た理解を元に、Step 2 で解説ページの**内容**（概要・構成・使い方・参考リンクなど）を書く。

### Step 1: 参照取得（プロジェクト内のみ）

Spell UI のトークン・コンポーネント・TOC 実装は、**プロジェクト内の既存ファイル** を読んで把握する。

| 読むファイル | 目的 |
|-------------|------|
| `index.html` | Spell UI トークン（`:root` / dark）、`.ve-card` / `.ve-card--hero` / `.ve-section-label`、`.doc-list` とリンクカード（`.ve-card--link`、`.index-doc-title`、`.index-doc-file`）の構造。**Unfurl**: `<head>` 内の `<!-- Unfurl: Open Graph -->` / `<!-- Unfurl: Twitter Card -->` コメントと、その直下の `og:*`・`twitter:*` メタタグの並び |
| `docs/opentui.html` または `docs/react-grab.html` のいずれか 1 件 | 解説ページ 1 本の体裁：**Unfurl**（`<head>` の description ＋ Open Graph ＋ Twitter Card のメタブロック）、THEME（:root + dark）、Spell UI static（.ve-card, .ve-card--elevated, .ve-card--recessed, .ve-card--hero, .ve-section-label, .ve-code-block, .ve-table-wrap, .ve-kpi-card, .ve-callout）、`.wrap` / `.toc` / `.main`、`.sec-head`、Scroll Spy 用の `<script>`。**Scroll Spy** は `docs/defuddle.html` 末尾のスクリプトをコピーすること（active が常に1件になる正しい実装）。 |

**注意**: 本スキル配下に `references/` がある場合でも、**実際の見た目は index と docs の既存 HTML に合わせる**。プロジェクト内の `index.html` と `docs/*.html` を正とする。

### Step 2: ビジュアル解説ページの生成

**事前に visual-explainer-spell-ui スキルを読む。** その Workflow（Think → Structure → Style）に沿って、誰向けか・図の種類（アーキテクチャ / Mermaid / データテーブル等）・Spell UI トークン・コンポーネントの使い方を決める。同スキル内の `references/`（spell-ui-tokens.css, spell-ui-static.css, spell-ui-integration.md, css-patterns.md, responsive-nav.md 等）や `templates/` を必要に応じて参照し、品質チェック・アンチパターンも満たす。出力先は本スキルに従い `docs/<名前>.html` とする。

1. **新規ファイル**: `docs/<名前>.html`（名前は内容が分かるように、例: `react-grab.html`, `kaku-terminal.html`）。
2. **Unfurl（リンクプレビュー）**
   - `<head>` に以下を必ず含める。既存の `docs/*.html` のメタブロックを流用し、**コメント** `<!-- Unfurl: Open Graph -->` と `<!-- Unfurl: Twitter Card -->` を付けて index と揃える。
   - **共通**: `<meta name="description" content="（資料の短い説明）">`
   - **Open Graph**: `og:type` = `article`、`og:locale`（例: `ja_JP`）、`og:title`、`og:description`、`og:url` = `https://tadano-go.github.io/docs-site/docs/<ファイル名>.html`
   - **Twitter Card**: `twitter:card` = `summary`、`twitter:title`、`twitter:description`
   - タイトル・説明は資料の内容に合わせて記述する。
3. **Spell UI 準拠**
   - 上記 Step 1 で読んだ `docs/opentui.html` または `docs/react-grab.html` の `<style>` 構造を流用する（THEME → Spell UI static → Reset → Wrap+TOC → Typography → その他）。
   - コンポーネント: `.ve-card`（本文）、`.ve-card--elevated`（強調ブロック）、`.ve-card--recessed`（参照・補足）、`.ve-card--hero`（先頭ヒーロー用）、`.ve-section-label` + `.ve-dot`、`.ve-code-block`、`.ve-table-wrap`、`.ve-kpi-card`、`.ve-callout` を内容に応じて使い分ける。
4. **4 セクション以上の場合**
   - `.wrap` / `.toc` / `.main` のレイアートを使う。
   - デスクトップ: スティッキーサイドバー TOC。モバイル: 横スクロール TOC（既存 docs のメディアクエリを流用）。
   - 各セクションに `id` を付け、TOC の `a[href="#id"]` と対応させる。
   - スクロールに連動して TOC の `active` を付ける Scroll Spy 用の `<script>` は、**`docs/defuddle.html` 末尾**からコピーして使う。**注意**: `active` は常に **1 件だけ**付けること。`docTop <= top` のたびに `classList.add('active')` すると、スクロール位置より上にある全セクションがハイライトされる不具合になる。正しい実装は「current = スクロール位置を超えていない最後のセクション」を決め、そのリンクだけ `classList.toggle('active', s === current)` する。
5. **内容**
   - 対象の製品・ツール・概念に合わせて、概要・構成・使い方・API・参考リンクなどのセクションを組み、既存の解説ページと同程度の粒度で書く。元ネタが **`repos/`** 内のディレクトリの場合は、Step 0 の code-reading に基づいた理解を反映する。

### Step 3: index.html へのリンク追加

- 資料一覧 **`.doc-list`** 内に、既存と同形式のリンクカードを **1 件** 追加する。
- 挿入位置: 既存の `<li>...</li>` の直後（コメント「追加する資料はここに」の直前が無難）。

```html
<li>
  <a class="ve-card ve-card--link" href="docs/<ファイル名>.html">
    <span class="index-doc-title">（資料のタイトル）</span>
    <span class="index-doc-file">docs/<ファイル名>.html</span>
  </a>
</li>
```

### Step 4: index の画面構成を Spell UI で揃える（任意）

index のレイアートを他ページと統一したい場合のみ行う。

- ヒーローを `.ve-card.ve-card--hero` でラップする。
- 資料リスト直前に `.ve-section-label`（＋`.ve-dot`）を追加する。
- `.container` に `max-width: 920px` を設定する。
- 背景を chart-1 系の淡いグラデーションにする。
- 変更対象は `index.html` のみ。既存のリンクカードの挙動は変えない。
- 実施する場合は、**別コミット**（例: refactor）に分けるとよい。

### Step 5: ブランチ・コミット

1. **環境確認**
   - `git branch --show-current` で現在ブランチを確認。
2. **main にいる場合**
   - main 直接コミット禁止なら、作業用ブランチを切る。
   - ブランチ名例: `docs/<名前>-link`（単語連結最大 4 つ、例: `docs/react-grab-link`）。
   ```bash
   git checkout -b docs/<名前>-link
   ```
3. **ステージ・コミット**
   - 「解説ページ追加＋index リンク」は **1 コミット** にまとめる（論理単位）。
   - コミットメッセージ例: `docs: ○○ ビジュアル解説追加と index リンク`（○○は資料名・トピック）。
   ```bash
   git add docs/<新規ファイル>.html index.html
   git commit -m "docs: ○○ ビジュアル解説追加と index リンク"
   ```

### Step 6: Push とドラフト PR 作成

1. **未コミットの有無確認**
   - `git status -s` で未コミット変更が無いことを確認。
2. **Push**
   ```bash
   git push -u origin docs/<名前>-link
   ```
3. **ドラフト PR**
   - `gh` でドラフト PR を作成。本文はヒアドキュメントで渡し、クォーティング問題を避ける。
   ```bash
   gh pr create --draft --base main --assignee @me --title "docs: ○○ ビジュアル解説ページ追加" --body-file - <<'PRBODY'
   ## なぜ必要か
   （○○の概要を資料として残し、資料一覧から参照できるようにするため、など）

   ## 何を変えたか
   - docs/<ファイル>.html を新規追加（Spell UI 準拠・目次・Scroll Spy 付き）
   - index.html の資料リストに ○○ へのリンクカードを 1 件追加

   ## 変更内容
   - （セクション構成の簡潔な説明）

   ## レビューポイント
   - Spell UI の体裁が他資料と揃っているか
   - リンク・コード例の内容が誤っていないか

   ## 確認済み事項
   - main には直接コミットせずブランチでコミット済み
   - コミットは 1 件（解説ページ追加＋index リンク）
   PRBODY
   ```
   - GitHub コメントでは絵文字を使わないルールがある場合は、PR 本文にも絵文字を入れない。

---

## チェックリスト（完了確認）

- [ ] Step 2 で visual-explainer-spell-ui スキルを読み、その Workflow・品質チェック・アンチパターンに沿ってページを生成している
- [ ] 解説ページが `docs/` にあり、Spell UI トークン・コンポーネントで統一されている
- [ ] 解説ページの `<head>` に Unfurl（`description` ＋ Open Graph ＋ Twitter Card メタ、コメント付き）が含まれている
- [ ] index の資料一覧（`.doc-list`）に当該ページへのリンクが追加されている
- [ ] （任意）index のヒーロー・セクションラベル・コンテナ幅が Spell UI で揃っている
- [ ] main に直接コミットしておらず、ブランチでコミットしている
- [ ] ドラフト PR が作成され、ベースは main・アサイン済み

---

## 参照（必要時のみ）

| 用途 | 参照先 |
|------|--------|
| **ビジュアル解説の構成・図タイプ・スタイル指針（Step 2 で必須）** | **visual-explainer-spell-ui スキル**（`.cursor/skills/visual-explainer-spell-ui`） |
| **repos 内のコード・ドキュメント解析** | **code-reading スキル**（`.cursor/skills/code-reading`） |
| コミット分割・複数カテゴリ | commit-diffs スキル |
| PR 本文の詳細テンプレート・複雑な PR | pr-creation スキル |
| index 変更プランの事前評価 | self-refine スキル |

通常の「1 解説ページ追加 + index リンク → 1 コミット → 1 ドラフト PR」は、**上記 Step 1〜6 のみで完結**する。
