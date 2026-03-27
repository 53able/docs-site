---
name: repo-to-visual-doc
description: >-
  Transforms a repos/ source directory into a Spell UI visual documentation HTML page for docs-site.
  Applies Context Engineering principles — Just-in-Time loading, structured content extraction,
  and self-refinement — to produce consistent, high-quality visual documentation.
  Use when converting technical source material (READMEs, SKILLs, guides) in repos/ to a docs-site page.
  Don't use for non-docs-site projects, for source outside repos/, or for updating existing pages.
---

# repo-to-visual-doc

docs-site の `repos/<name>` を `docs/<name>.html` に変換するワークフロー。  
**Context Engineering 三原則** をスキル全体に適用する:

| 原則 | 適用フェーズ | 目的 |
|------|------------|------|
| **JiT Loading** (§4.3) | Phase 1-2 | 必要な時だけ読み込み、コンテキストを汚染しない |
| **Structured Extraction** (§4.2) | Phase 3 | 生のソースを視覚コンポーネントへ変換 |
| **Self-Refinement** (§4.2) | Phase 5 | 既存パターンとの整合を検証して品質保証 |

---

## Phase 1: Source Acquisition（JiT — ディレクトリ優先）

ソースを読む順序は固定する。前段が十分なら後段を読まない。

1. `scripts/scan-source.sh <repos-path>` を実行してファイル一覧・サイズを取得する。
2. 優先度 1: ディレクトリ構造 → 責務を推測する。
3. 優先度 2: `README.md` を読む → ソースのインターフェイスと目的を把握する。
4. 優先度 3: メインエントリ（`SKILL.md` / `index.*` / `main.*`）を読む → 公開 API・手順を把握する。
5. 優先度 4-6（JiT）: Step 3 で必要と判断した時のみ `references/` / `assets/` を読む。  
   不要なら **スキップ**する。

> **Context Compression ルール**: 読んだファイルから「タイトル・目的・主要構造・重要な制約」だけを内部的に記録する。全文を保持しない。

---

## Phase 2: Reference Acquisition（JiT — Spell UI パターン）

6. `docs/react-grab.html` または `docs/defuddle.html` のどちらか 1 本を読む  
   → `<style>` 全体（THEME / Spell UI static / TOC）を把握する。
7. `docs/defuddle.html` 末尾の `<script>` ブロックをコピー用に保持する（Scroll Spy 正実装）。
8. `index.html` の `.doc-list` 付近 (`grep "doc-list"`) を読む → リンクカード形式を確認する。

> **読むのは 2-3 ファイルのみ**。Spell UI の全ソースを読み直す必要はない。  
> 詳細コンポーネント仕様が必要な時だけ `references/spell-ui-map.md` を読む。

---

## Phase 3: Structured Extraction（コンテンツ変換）

`references/context-extraction.md` を読んで以下を実施する。

9. ソースから**情報タイプ**を分類する: 概念説明 / 手順 / 設定値 / コード例 / 比較表。
10. 情報タイプ → Spell UI コンポーネントへのマッピングを決める（`references/spell-ui-map.md` 参照）。
11. セクション構成を決める（4 セクション以上 → TOC 付きレイアウト必須）。
12. 審美方向を決める: フォント・パレット・アクセントを選ぶ。  
    **禁止**: Inter / Roboto / violet / cyan-magenta-pink。

---

## Phase 4: Generation（HTML 生成）

13. `docs/<name>.html` を新規作成する。`<name>` はソースディレクトリ名と一致させる。
14. 以下の構造を必ず含める:
    - `<head>` に Unfurl メタ（description + Open Graph + Twitter Card）
    - THEME (`:root` + `@media dark`) → Spell UI static → Reset → Wrap+TOC → Typography
    - Scroll Spy `<script>`（Step 7 でコピーしたもの）
15. セクションは `id` 付きの `.sec-head` で区切り、TOC `a[href="#id"]` と対応させる。
16. コンポーネント選択と配置は Step 10-11 の決定に従う。

---

## Phase 5: Self-Refinement（整合検証）

17. 生成した HTML を既存 1 ページと目視比較する:
    - フォント・パレットが **既存ページと差別化**されているか
    - THEME トークン名が Spell UI 標準（`--background`, `--chart-1` 等）と一致しているか
    - Scroll Spy が `toggle('active', s === current)` 形式（active が常に 1 件）になっているか
18. `index.html` の `.doc-list` にリンクカードを 1 件追加する。
19. `git status -s` で未追跡ファイルがないことを確認する。

---

## Phase 6: Commit & PR

20. 現在ブランチを確認する: `git branch --show-current`。
21. `main` ならブランチを切る（命名: `docs/<name>-page` など、単語連結最大 4 つ）。
22. ステージ + コミット（1 コミットに HTML 追加 + index 変更をまとめる）:

```bash
git add docs/<name>.html index.html
git commit -m "docs: <name> ビジュアル解説追加と index リンク"
```

23. Push して PR 作成:

```bash
git push -u origin <branch>
gh pr create --draft --base main --assignee @me \
  --title "docs: <name> ビジュアル解説ページ追加" \
  --body-file - <<'PRBODY'
## なぜ必要か
（ソースの要約とドキュメント化の理由）

## 何を変えたか
- docs/<name>.html 新規追加（Spell UI 準拠）
- index.html の doc-list にリンク追加

## レビューポイント
- Spell UI の体裁が他資料と揃っているか
- コンテンツの内容が正確か
PRBODY
git checkout main
```

---

## Error Handling

| 状況 | 対応 |
|------|------|
| `repos/<name>` が Glob で見つからない | `.gitignore` 対象のため Glob 不可。`ls <path>` または `Read` で直接確認する |
| Phase 1 で README が存在しない | 優先度 3 のメインエントリから直接読む |
| Scroll Spy が動作しない | `docs/defuddle.html` 末尾スクリプトを再コピー。`docTop <= top` 判定の後に `toggle` パターンを使う |
| index.html の doc-list 位置が分からない | `grep -n "doc-list"` で行番号を確認してから編集する |
| フォント・パレットが既存ページと被る | `references/spell-ui-map.md` の「差別化チェック」セクションを参照する |

---

## 参照（JiT — 必要な時のみ読む）

| タイミング | ファイル |
|-----------|---------|
| Phase 3 でコンテンツ変換に迷った時 | `references/context-extraction.md` |
| Phase 3-4 でコンポーネント選択に迷った時 | `references/spell-ui-map.md` |
| Phase 1 の前にスキャン結果を整理したい時 | `scripts/scan-source.sh <path>` を実行 |
