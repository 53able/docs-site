---
name: docs-site-add-visual-doc
description: >-
  Adds Spell UI visual documentation pages to docs-site from repos/ sources: optional clone into repos/,
  Context Engineering (JiT loading, structured extraction, self-refinement), scan-source.sh inventory,
  Think–Structure–Style and templates, writes docs/<name>.html, links index.html, opens draft PRs.
  Encodes requested reading tone in concrete wording (short steps, clear labels, respectful imperatives)
  instead of meta section titles or brochure taglines. Aligns index card titles with the page title and subject matter.
  Use when converting READMEs, SKILLs, or cloned repos under repos/ into docs-site pages.
  Do not use for non-docs-site projects, source outside repos/, standalone generic HTML outside this site,
  large in-place rewrites of existing pages (do focused edits instead), or pages that only name a vibe in headings
  without substantive content.
---

# docs-site ビジュアル解説（統合スキル）

`repos/<name>/`（またはクローン取得）を **`docs/<name>.html`** にし、`index.html` を更新して **ドラフト PR まで**完了させる。

| 原則 | 適用 | 目的 |
|------|------|------|
| **JiT Loading** | ソース走査・参照読み込み | 必要な時だけ読み、コンテキストを汚染しない |
| **Structured Extraction** | コンテンツ分類 → コンポーネント | 生ソースを視覚コンポーネントへ変換 |
| **Self-Refinement** | 生成後の検証 | 既存 `docs/*.html` との整合で品質担保 |
| **Factual copy** | 見出し・index カード・メタ | トーンは本文の書き方で示し、雰囲気ラベル見出しにしない |

## スコープ

- **対象**: docs-site リポジトリ内。解説の正は **`repos/<名前>/`**（URL クローン時は Step 0 で取得）。
- **出力**: `<プロジェクトルート>/docs/<名前>.html`。`assets/` 内の Markdown プロンプトが参照する `~/.agent/diagrams/` は **docs-site 作業では使わない**（standalone HTML 生成用）。
- **ファイル名・ブランチ名**: 単語連結 **最大 4 つ**。
- **公開表記**: 生成 HTML と PR 本文に、ローカル絶対パス（例: `/Users/...`）や作業ツリー前提の `repos/<名前>/...` をそのまま載せない。公開ページでは GitHub URL、プロジェクト名（例: `mattpocock/skills`）、またはリポジトリ内相対パス（例: `README.md`）へ変換する。

> `repos/` は `.gitignore` 対象のため Glob で見えない。`ls` または Read でパス直接確認する。

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
4. 優先度 4–6（JiT）: Phase 3 で必要と判断した時のみ `references/` / `assets/` 等を読む。

**Context Compression**: 読んだファイルから「タイトル・目的・主要構造・重要な制約」だけを内部に保持し、全文をコンテキストに載せ続けない。

### Step 1c: 深い解析

**code-reading スキル**（`.cursor/skills/code-reading`）に従い、Glob に頼らずパスで確認する。得た理解を HTML 本文に反映する。

---

## Phase 2: Reference Acquisition（JiT — Spell UI パターン）

読むのは **必須 3 本のみ**。残りは下の JiT 表を参照。

**必ず読む:**

| 読むファイル | 目的 |
|-------------|------|
| `index.html` | `.doc-list` の形式（各 `<a>` の `data-updated` / `title="更新: …"`・末尾のソート用 `<script>` は **`data-updated` のみ参照**）・Unfurl コメントとメタの並び |
| `docs/defuddle.html`（末尾スクリプト含む） | `<style>` 順序・コンポーネント・体裁・Scroll Spy パターン |
| `references/visual-explainer-core.md` | Think → Structure → Style、品質、Anti-Patterns |

**本スキル配下の `references/` は補助**。見た目の正は **リポジトリの `index.html` と `docs/*.html`**。

> `visual-explainer-core.md` の Deliver セクションにある `~/.agent/diagrams/` パスは無視する（docs-site では `docs/<名前>.html` が出力先）。

---

## Phase 3: Structured Extraction（コンテンツ変換）

`references/context-extraction.md` を読み、ソースから **情報タイプ**を分類する（概念 / 手順 / 設定 / コード / 比較 / 注意）。

- 情報タイプ → Spell UI へのマッピングは **`references/spell-ui-map.md`**。
- セクション **4 本以上**なら TOC 付きレイアウト（`references/responsive-nav.md`、`docs/defuddle.html` の Scroll Spy）。
- 審美: フォント・パレット・アクセントを選ぶ。**禁止**: Inter / Roboto / violet / cyan-magenta-pink（詳細は `spell-ui-map.md`）。
- **ASCII 表を避ける**: 複雑な表は HTML テーブル化（`visual-explainer-core.md`）。
- **文体**: 依頼に「丁寧に」「ホスピタリティ」などがあっても、**見出しでトーンを名指ししない**。`references/copy-tone.md` を読み、事実・手順ベースのラベルにする。

---

## Phase 4: Generation（`docs/<名前>.html`）

`references/visual-explainer-core.md` と Phase 2 の既存 HTML を踏まえ、新規 `docs/<名前>.html` を作成する。`<名前>` はソースディレクトリ名と一致させる。

1. **Unfurl**: 既存 `docs/*.html` と同形式。`og:url` = `https://tadano-go.github.io/docs-site/docs/<ファイル名>.html`。
2. **Spell UI**: THEME → Spell UI static → Wrap+TOC → …。`.ve-card`、`ve-code-block`、`ve-table-wrap` 等は `spell-ui-map.md` と内容に合わせて使う。
3. **4 セクション以上**: `.wrap` / `.toc` / `.main`、Scroll Spy を `defuddle.html` からコピー。
4. **Mermaid・表・図**: `visual-explainer-core.md` の Diagram Types と **`references/libraries.md`**。
5. **コードブロック可読性**: グローバル `code { background: ...; padding: ... }` を使う場合、`.ve-code-block pre code` で必ず打ち消す。打ち消しが無いとコード行が帯状になり読めない。
6. **パスの公開化**: 本文・ラベル・出典表記では、読み取り元の `repos/<clone-dir>/...` を公開向けに言い換える。例: `repos/mattpocock/skills/README.md` は `mattpocock/skills の README.md` または `README.md` と書く。
7. **index カードとページの整合**: `.index-doc-title` はページの `<title>` / 主題と矛盾させない。キャッチコピー専用のカードタイトルにしない（`references/copy-tone.md`）。

```css
.ve-code-block pre code {
  display: block;
  background: transparent;
  border-radius: 0;
  color: var(--code-text);
  padding: 0;
  tab-size: 2;
}
```

### テンプレート選択（`assets/`）

テンプレートは **ゼロから書くよりも参考程度**に使う。既存 `docs/*.html` の体裁を正とする。

| ソースの性質 | 参照テンプレート |
|------------|----------------|
| アーキテクチャ・構成図が中心 | `assets/architecture.html` |
| テーブル・設定値・比較が主体 | `assets/data-table.html` |
| フロー・状態遷移が主体 | `assets/mermaid-flowchart.html` |
| スライド形式で説明したい | `assets/slide-deck.html` |

> スライド形式に特化した詳細は `references/slide-patterns.md` を JiT 参照。

---

## Phase 5: Self-Refinement（整合検証）

生成した HTML を出荷前に以下の項目で検証する。すべて通過してから Phase 6 に進む。

**インライン検証（必須）:**

1. `docs/<名前>.html` が存在し、ブラウザで開ける構造になっている。
2. `<head>` に `og:title` / `og:url` / `og:description` / `twitter:card` がコメント付きで揃っている。
3. `index.html` の `.doc-list` にリンクカードが追加され、`<a>` に **`data-updated="YYYY-MM-DD"`** と **`title="更新: YYYY-MM-DD"`** が付いている（`data-updated` の欠落はソート用 script が日付 `0` 扱いにし、意図した新着順にならない。**script は `title` を読まない**ため `title` 欠落で script が壊れることはないが、既存 index と形式を揃えるため **両方必須**）。
4. 4 セクション以上の場合、Scroll Spy スクリプトが `defuddle.html` のパターン（`toggle('active', s === current)`）と一致している。
5. フォントとアクセントカラーが既存 `docs/*.html` と被っていない（`references/spell-ui-map.md` の差別化チェック）。
6. コードブロックがある場合、`.ve-code-block pre code` が `background: transparent` / `padding: 0` を持ち、インラインコード用背景がコード全体に漏れていない。
7. `git status` で `repos/` がステージングされていない。
8. `scripts/validate-public-paths.sh docs/<名前>.html` を実行し、ローカル絶対パスと `repos/<名前>/...` 表記が公開 HTML に残っていないことを確認する。
9. 見出し・リード・メタ description に、**雰囲気の単語だけ**が載っていない。トーンの修正依頼があれば `references/copy-tone.md` に沿って差し替え、ユーザーが **stop-slop** スキルを添付している場合はその手順に従う。

**全項目チェック:** `references/checklist.md` を読んで残りの項目を確認する。

---

## Phase 6: index・コミット・PR

### index.html へのリンク追加

`.doc-list` に既存と同形式のリンクカードを 1 件追加する（**`.doc-list` 末尾の説明コメント直前**が無難。コメント内に `href="docs/....html"` の生パターンを書かない — 将来の一括置換やツールが誤マッチするため）。

**更新日ソート（必須）:** `index.html` 末尾のインライン `<script>` が、各カードの `<a>` の **`data-updated` 属性だけ**を読み、**新しい日付が上**になるよう `li` を並べ替える（`title` は参照しない）。追加する `<a>` には **`data-updated`** と **`title="更新: YYYY-MM-DD"`** を **両方** 付ける（`data-updated` を付け、末尾の `<script>` を編集しない限り、ソート用 script の挙動は壊れない）。

**`data-updated` の値（どちらかでよい）:**

1. **推奨:** リポジトリルートで `git log -1 --format=%cs -- docs/<ファイル名>.html` を実行し、出力された `YYYY-MM-DD` を使う（そのファイルに既にコミット履歴がある場合）。
2. **初回追加で未コミットのとき:** 作業日の日付を `YYYY-MM-DD` で入れる（初回マージ後は次回以降の更新で Git 日付と近づく）。

`index-doc-title` は **`docs/<名前>.html` の `<title>` と主題**に合わせ、ページとカードで言い回しが食い違わないようにする（詳細は `references/copy-tone.md`）。

```html
<li>
  <a class="ve-card ve-card--link" href="docs/<ファイル名>.html" data-updated="YYYY-MM-DD" title="更新: YYYY-MM-DD">
    <span class="index-doc-title">（資料のタイトル）</span>
    <span class="index-doc-file">docs/<ファイル名>.html</span>
  </a>
</li>
```

**触らない:** `index.html` の `.doc-list` 直後〜`</body>` 手前の **ソート用 `<script>`** と、既存カードの `data-updated` 属性を一括削除・リフォーマットしない（並び順の契約を壊す）。

### ブランチ・コミット

1. `git branch --show-current`。main のまま直コミット禁止なら新規ブランチを作成する。
   - ブランチ名は `git diff --name-only` の変更ファイルから対象を判断し、`docs/<対象名>` 形式で命名する。
2. **commit-diffs スキル**の全手順を実行する:
   - `.cursor/skills/commit-diffs/SKILL.md` を読み、環境検出コマンドを実行する。
   - `.cursor/skills/commit-diffs/classification.md` を読み、変更カテゴリを特定する。
   - ヒアドキュメント形式でコミットを作成する。**`repos/` はステージングに含めない。**

### Push とドラフト PR

1. `git push -u origin <branch>`
2. **pr-creation スキル**の全手順を実行する（ショートカット禁止）:
   - `.cursor/skills/pr-creation/SKILL.md` を読み、環境検出コマンドを実行する。
   - `.cursor/skills/pr-creation/templates.md` を読み、PR タイトルと本文を生成する。
     - ベースブランチは MUST `main`。他は絶対に指定しない。
     - PR 本文に **解説元**（GitHub URL または公開向けプロジェクト名。`repos/<名前>` は避ける）と **変更ファイル**を含める。
     - 絵文字は使用しない。
   - `.cursor/skills/pr-creation/decision-logic.md` を読み、ベースブランチとタイトル形式を確認する。
   - `.cursor/skills/pr-creation/safety-checks.md` を読み、Self-Refine 評価を実施する。
   - **「評価完了」と宣言してから** `gh pr create` を実行する。
3. PR 作成を確認したら `git checkout main` でメインブランチへ戻る。

---

## Error Handling

| 状況 | 対応 |
|------|------|
| `repos/<name>` が Glob で見つからない | `.gitignore` のため Glob 不可。`ls` または `Read` で直接確認 |
| README が無い | メインエントリから直接読む |
| Scroll Spy が動かない | `docs/defuddle.html` 末尾スクリプトを再コピー。`toggle` パターンを確認 |
| コードブロックがベージュ/灰色の帯で読みにくい | グローバル `code` スタイルが漏れている。`.ve-code-block pre code { background: transparent; padding: 0; }` を追加 |
| `doc-list` の位置が分からない | `rg -n "doc-list" index.html` |
| 新規カードが一覧の一番下に固定され、新着にならない | `<a>` に `data-updated="YYYY-MM-DD"` を付け忘れている（script は欠落を日付 0 扱い）。Phase 6 の日付ルールで追加する |
| `title="更新: …"` を付け忘れた | ソート順は `data-updated` のみで決まるため script は動くが、既存カードと形式がずれる。`data-updated` と同じ `YYYY-MM-DD` で `title="更新: YYYY-MM-DD"` を補う |
| 一括ツールで `data-updated` を消した | `git log -1 --format=%cs -- docs/<ファイル名>.html` で復元し、ソート用 `<script>` が残っているか確認 |
| フォント・パレットが既存と被る | `references/spell-ui-map.md` の差別化チェック |
| `repos/` がステージに混入した | `git reset HEAD repos/` で除外してからコミット |
| 公開 HTML に `/Users/...` や `repos/<名前>/...` が残った | `scripts/validate-public-paths.sh docs/<名前>.html` の検出箇所を、GitHub URL・プロジェクト名・リポジトリ内相対パスへ置換 |
| 見出しやカードが「歓迎」「おもてなし」などラベル先行で違和感がある | `references/copy-tone.md` で見出しを事実・手順ラベルへ置換し、本文で丁寧さを担保する |
| commit-diffs または pr-creation スキルを部分的に読んで実行した | スキル内のすべての参照ファイルを読み直し、未実施ステップを実行する |

---

## 参照（他スキル）

| 用途 | 参照先 |
|------|--------|
| repos 内の解析 | code-reading（`.cursor/skills/code-reading`） |
| コミット作成 | commit-diffs（`.cursor/skills/commit-diffs/SKILL.md` + `classification.md`） |
| PR 作成 | pr-creation（`.cursor/skills/pr-creation/SKILL.md` + `templates.md` + `decision-logic.md` + `safety-checks.md`） |
| index 変更の事前評価 | self-refine |

---

## JiT リファレンス一覧（迷った時だけ読む）

| タイミング | ファイル |
|-----------|---------|
| Phase 1 のファイル一覧把握 | `scripts/scan-source.sh` を実行 |
| トーン・見出し・index カードの違和感 | `references/copy-tone.md` |
| コンテンツ変換で迷った時 | `references/context-extraction.md` |
| コンポーネント選択・フォント | `references/spell-ui-map.md` |
| Spell UI 実装仕様（CSS 詳細） | `references/spell-ui-integration.md` + `references/spell-ui-tokens.css` + `references/spell-ui-static.css` |
| CSS カスタムパターン | `references/css-patterns.md` |
| Mermaid・外部ライブラリ | `references/libraries.md` |
| TOC 付きレスポンシブナビ | `references/responsive-nav.md` |
| スライド形式の詳細 | `references/slide-patterns.md` |
| AS-IS/TO-BE 比較スタイル | `references/as-is-to-be-spell-ui-style.md` |
| HTML テンプレート参考 | `assets/architecture.html` / `assets/data-table.html` / `assets/mermaid-flowchart.html` / `assets/slide-deck.html` |
| 汎用 HTML 生成プロンプト（docs-site 外） | `assets/generate-visual-plan.md` / `assets/generate-web-diagram.md` 等 |
