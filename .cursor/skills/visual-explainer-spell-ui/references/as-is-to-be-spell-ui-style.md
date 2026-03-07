# As-Is → To-Be: アウトプットスタイルを spell-ui-main に 100 点で合わせる

## 現在地

- **As-Is 把握済み**（テンプレート・static CSS・spell-ui-main の差分は把握済み）
- **To-Be 定義** → 本ドキュメント
- **Solution** → 同一スキル内で実装

---

## To-Be 定義書

### 目標状態

visual-explainer の生成 HTML および参照テンプレートが、**spell-ui-main のデザインシステム（トークン＋コンポーネント見た目）と完全に一致**している状態。単一 HTML の制約のなかで「spell-ui の画面をそのまま切り出したように見える」ことを目指す。

### 指標と目標値

| 指標 | 現状（As-Is） | 目標（To-Be） | 根拠 |
|------|----------------|----------------|------|
| トークン一致 | テンプレートごとに抜け・エイリアス乱立 | globals.css の :root/.dark と 100% 同一のトークンを使用 | 色・余白・角丸が spell-ui と一致するため |
| コンポーネント見た目 | static が oklch 近似、Button に shadow なし | Badge/Button/Card/Code が spell-ui 実装と同一見た目 | 70 点→100 点の主因 |
| テンプレートの重複 | .ve-card 等を各テンプレートで再定義 | ベースは spell-ui-static.css のみ、修飾子だけテンプレート側 | 保守性と一貫性 |
| 参照ドキュメント | integration が方針のみ | 参照ファイル一覧・トークン写し手順・受入基準を明記 | 今後の同期ミスを防ぐ |

### 制約条件

- **予算・期間**: スキル内のファイル変更のみ。spell-ui-main のソースは読むだけ（変更しない）。
- **技術的制約**: 出力は単一自己完結 HTML。React コンポーネントは使わず、静的 CSS で再現する。

### 受入基準

1. [ ] 全テンプレート（architecture, data-table, mermaid-flowchart, slide-deck）のテーマが spell-ui-main `app/globals.css` の `:root` および `.dark` と**変数名・値とも同一**である（エイリアスは `var(--background)` 等の参照のみ）。
2. [ ] `references/spell-ui-static.css` の .ve-badge / .ve-button / .ve-card / .ve-code-block が、spell-ui-main の Badge / Button / card / code-block の**見た目と一致**している（Badge は default・red・blue・green・orange、Button は shadow-xs 含む）。
3. [ ] 各テンプレートで .ve-card 等の**ベース定義を削除**し、spell-ui-static.css をインラインして利用している。テンプレート固有の修飾（.ve-card--accent 等）のみテンプレート側に残している。
4. [ ] `references/spell-ui-integration.md` に「トークンは globals.css をそのまま写す」「参照ファイル一覧」「受入基準」が記載されている。
5. [ ] SKILL.md の「For spell-ui-main alignment」で、生成時に spell-ui トークン＋spell-ui-static.css を必ず含める旨が明記されている。

### 前提条件

- spell-ui-main の `app/globals.css` および `registry/spell-ui/badge.tsx`、`components/ui/button.tsx`、`components/code-block-command.tsx` 等が今後の変更で大きく変わらないこと。変わった場合は本スキル内のトークン・static を同期し直す。

---

## As-Is の要点（差分サマリ）

| 項目 | As-Is | To-Be でやること |
|------|--------|-------------------|
| トークン | primary/secondary/input/popover がテンプレートに無い。--bg, --surface, --green 等の独自エイリアスが多い | globals の全トークンを写す。エイリアスは --bg: var(--background) 等の参照のみ |
| Badge | static は oklch/chart ベース。spell-ui は Tailwind neutral-700, red-100, dark:red-900/30 | Badge を spell-ui の default/red/blue/green/orange に合わせる（oklch で同等表現） |
| Button | shadow-xs なし | shadow-xs を追加 |
| テンプレート | .ve-card の padding 等を再定義して static と微妙に不一致 | ベースは static のみ。修飾子のみテンプレートに残す |
| コードブロック | light の code 色 #032F62 がトークン化されていない | --code-text-light 等をトークンに含め、static で参照 |

---

## 完了条件

上記「受入基準」5 項目をすべて満たした時点で 100 点とする。
