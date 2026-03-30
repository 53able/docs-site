# Spell UI Map — コンテンツ型 → コンポーネントマッピング

このファイルは **構造化抽出〜HTML 生成でコンポーネント選択に迷った時だけ**読む（JiT ロード）。親は `docs-site-add-visual-doc` の `SKILL.md`。

---

## コンテンツ型 → Spell UI コンポーネント

| コンテンツ型 | 推奨コンポーネント | 使い方の要点 |
|------------|-----------------|------------|
| ページ導入・サービス概要 | `.ve-card.ve-card--hero` | 先頭 1 枚のみ。KPI カードを内包すると効果的 |
| 定量値・主要指標 | `.ve-kpi-card`（`.kpi-row` でグリッド）| `__value` + `__label` で 4 枚揃える |
| 一般的な説明・本文 | `.ve-card`（デフォルト） | `--i` で stagger アニメーション |
| 強調ブロック・注目情報 | `.ve-card.ve-card--elevated` | セクション内の主役コンテンツに使う |
| 補足・参照・警告 | `.ve-card.ve-card--recessed` | 目立たせたくない二次情報 |
| 重要な注意・制約 | `.ve-callout` | border-left が chart-1 または chart-2 |
| コード例・CLI コマンド | `.ve-code-block > pre > code` | `white-space: pre-wrap` 必須 |
| 設定値・オプション表 | `.ve-table-wrap > table` | `th` に `background: var(--muted)` |
| 比較（good/bad）| `.ve-table-wrap` + `.badge--good/.badge--bad` | バッジは `border-radius: 4px` |
| セクション小見出し | `.ve-section-label > .ve-dot` | `.ve-dot` の background は `--chart-1` |
| 手順フロー（2×N グリッド） | `.step-flow > .step-card` | `step-card__num` + `__title` + `__body` |
| チェックリスト | `.check-list > li > .check-mark` | border-bottom で区切る |
| ディレクトリ構造 | `.ve-code-block` + スパンカラー | `.dir` / `.file-main` / `.comment` で色分け |

---

## 情報タイプ → コンポーネント決定フロー

```
情報タイプは何か？
│
├─ 概念説明（What/Why）
│   └─ セクション先頭 → ve-card--hero または ve-card--elevated
│       内部に KPI カード（定量値があれば）
│
├─ 手順（Step N）
│   ├─ 4 手順以下 → ve-card 内の ol
│   └─ 5 手順以上 → step-flow グリッド（2列）
│
├─ 設定値・オプション
│   └─ ve-table-wrap（列: 名前 / 型orデフォルト / 説明）
│
├─ コード例
│   └─ ve-code-block（言語に応じた syntax ヒント）
│
├─ 比較（BAD/GOOD）
│   └─ ve-table-wrap + badge--bad / badge--good
│
├─ 制約・注意
│   └─ ve-callout（chart-2 = amber の border-left 推奨）
│
└─ チェックリスト
    └─ check-list（グループごとに ve-card または ve-card--recessed で囲む）
```

---

## フォント・パレット差別化チェック

既存ページとの重複を避けるため、生成前に **`docs/*.html` を数本開いて**フォント・chart の使い回しを確認する。

### 推奨フォントペア（未使用から選ぶ）

| ペア | 雰囲気 | Google Fonts 指定 |
|-----|--------|-----------------|
| Instrument Serif + JetBrains Mono | editorial, refined | `Instrument+Serif:ital,wght@...\|JetBrains+Mono:wght@...` |
| Bricolage Grotesque + Fragment Mono | bold, characterful | `Bricolage+Grotesque:opsz,wght@...\|Fragment+Mono:wght@...` |
| Plus Jakarta Sans + Azeret Mono | rounded, approachable | `Plus+Jakarta+Sans:wght@...\|Azeret+Mono:wght@...` |

### 禁止パレット

- Tailwind violet/indigo (`#8b5cf6`, `#7c3aed`)
- cyan + magenta + pink の組み合わせ
- gradient text (`background-clip: text`)
- 定常アニメーション `glow` / `pulse`

### 推奨パレット（chart-1 / chart-2 の oklch 値）

| スタイル | chart-1 | chart-2 |
|---------|---------|---------|
| Blueprint (deep blue) | `oklch(0.38 0.12 248)` | `oklch(0.72 0.17 76)` |
| Editorial (rose) | `oklch(0.55 0.19 15)` | `oklch(0.60 0.08 55)` |
| Warm (terracotta) | `oklch(0.55 0.16 42)` | `oklch(0.62 0.12 155)` |
| Teal (technical) | `oklch(0.45 0.12 200)` | `oklch(0.65 0.15 80)` |

---

## TOC 構成ガイドライン

| セクション数 | レイアウト |
|------------|-----------|
| 3 以下 | TOC 省略可、`.main` を全幅で使う |
| 4-7 | `.wrap / .toc / .main` 2 カラム、Scroll Spy 必須 |
| 8 以上 | `.toc` の項目が多くなりすぎないよう 2-3 レベルに整理 |

### Scroll Spy — 正しい実装（defuddle.html からコピー）

```js
// active は常に 1 件だけ付ける（toggle パターン）
sections.forEach(function(s) {
  s.link.classList.toggle('active', s === current);
});
```

**禁止**: `classList.add('active')` を `docTop <= top` のたびに呼ぶ実装（複数 active になる）。
