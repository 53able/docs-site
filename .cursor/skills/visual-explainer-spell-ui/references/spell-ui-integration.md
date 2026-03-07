# Spell-UI Integration

visual-explainer の UI を spell-ui-main のデザインと**完全に一致**させるための方針。トークンは globals.css をそのまま写し、コンポーネント見た目は spell-ui-static.css で再現する。

## 制約

- **出力は単一の自己完結 HTML**（CDN のフォント・Mermaid 等を除く）。ビルド不要でブラウザで開けることが前提。
- spell-ui-main のコンポーネントは **React (TSX)** のため、そのまま HTML に「import」はできない。

## 方針: 静的デザインシステム

| 役割 | 中身 |
|------|------|
| **トークン** | `references/spell-ui-tokens.css` をテンプレートの `<style>` にインラインする。中身は spell-ui-main `app/globals.css` の `:root` / `.dark` を写したもの + `--code-bg` / `--code-text`（code-block 用）。**テンプレートごとの独自トークン（--bg, --surface 等）は、spell-ui の変数への参照のみ**にし、値の二重定義をしない。 |
| **コンポーネント** | `references/spell-ui-static.css` に、spell-ui の Button / Badge / card / code-block を **.ve-* クラス** で定義。テンプレートと生成図はこのクラスをそのまま使い、**ベース定義をテンプレート側で再定義しない**。 |

## 参照する spell-ui-main のファイル

| 用途 | パス |
|------|------|
| テーマ変数（唯一の正） | `app/globals.css` の `:root` と `.dark` |
| Badge | `registry/spell-ui/badge.tsx`（rounded-sm, px-1.5 py-1, variant: default / secondary / outline / red / blue / green / orange 等） |
| Button | `components/ui/button.tsx`（h-9, rounded-md, shadow-xs, variant: default / outline / secondary / ghost） |
| カード・余白 | `registry/spell-ui/spotify-card.tsx`（rounded-2xl border border-border p-3）、demo の `rounded-md border bg-card p-3` |
| コードブロック | `components/code-block-command.tsx`（pre: px-4 py-3, dark:bg-[#0F0F0F], code: text-[#032F62] dark:text-[#9ECBFF]） |

## 本スキル内の参照ファイル

| ファイル | 役割 |
|----------|------|
| `references/spell-ui-tokens.css` | globals と同一のトークン + --code-bg / --code-text。テンプレートはこれをインラインして使用。 |
| `references/spell-ui-static.css` | .ve-card, .ve-badge, .ve-button, .ve-code-block 等。テンプレートはこれをインラインし、修飾子（.ve-card--accent 等）のみテンプレート側に定義可。 |
| `references/as-is-to-be-spell-ui-style.md` | As-Is / To-Be 定義と受入基準。 |

## テンプレートでの使い方

1. **テーマ**: `<style>` の先頭で `spell-ui-tokens.css` の内容をそのままインラインする。フォント用に `--font-body`, `--font-mono` を追加してよい。
2. **コンポーネント**: `spell-ui-static.css` の内容をインラインする。**.ve-card 等のベースは再定義しない**。テンプレート固有の修飾（.ve-card--accent, .ve-card--green, .pipeline-step 等）だけテンプレート側に書く。
3. **マークアップ**: `.ve-card`, `.ve-section-label`, `.ve-badge .ve-badge--green` 等、spell-ui-static.css のクラス名を使う。

## 受入基準（100 点の定義）

- 全テンプレートのテーマが spell-ui-main `app/globals.css` の `:root` / `.dark` と変数名・値とも同一である（spell-ui-tokens.css 経由）。
- spell-ui-static.css の .ve-badge / .ve-button / .ve-card / .ve-code-block が、spell-ui-main の Badge / Button / card / code-block の見た目と一致している。
- 各テンプレートで .ve-card 等のベース定義を削除し、spell-ui-static.css をインラインして利用している。
- 新規生成する図も、SKILL.md の指示に従い spell-ui トークン + spell-ui-static.css を必ず含める。

## spell-ui-main 変更時の同期

spell-ui-main の `app/globals.css` や `registry/spell-ui/badge.tsx`、`components/ui/button.tsx`、`components/code-block-command.tsx` を変更したら、本スキル内で以下を更新する。

1. `references/spell-ui-tokens.css`（:root / dark のトークン）
2. `references/spell-ui-static.css`（.ve-* の見た目）
3. 必要に応じて各テンプレートの修飾子のみ

## まとめ

- 単一 HTML の制約のなかで、**トークンは globals をそのまま写し、コンポーネント見た目は spell-ui-static.css に集約**することで、spell-ui-main と 100% 揃えた出力が可能。
- テンプレートは「トークン + static をインラインし、修飾子だけ追加」に徹する。
