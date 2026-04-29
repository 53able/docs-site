# 統合スキル完了確認チェックリスト

## docs-site 手順

- [ ] Step 0 でリポジトリ URL を `repos/<名前>/` にクローン（または既存を pull）し、解説対象のパスが確定している
- [ ] `scripts/scan-source.sh` で一覧を取り、JiT で読むファイルを絞っている（または同等の理由付きでスキップ）
- [ ] 構造化抽出で情報タイプ分類し、必要なら `context-extraction.md` / `spell-ui-map.md` を参照している
- [ ] Step 1（code-reading）を必要範囲で実施している
- [ ] Step 3 前に `references/visual-explainer-core.md` の Think / Structure / Style と品質・アンチパターンを踏まえている
- [ ] 解説ページが `docs/` にあり、Spell UI と既存 `docs/*.html` の体裁に揃っている
- [ ] `<head>` に Unfurl（description ＋ Open Graph ＋ Twitter Card、コメント付き）が含まれている
- [ ] index の `.doc-list` にリンクカードを追加している
- [ ] コードブロックがある場合、`.ve-code-block pre code` でインラインコード用の `background` / `padding` を打ち消し、コードが帯状表示になっていない
- [ ] `scripts/validate-public-paths.sh docs/<名前>.html` を実行し、公開 HTML に `/Users/...` などのローカル絶対パスや `repos/<名前>/...` が残っていない
- [ ] main に直接コミットしておらず、ブランチでコミットしている（`repos/` はコミットに含めない）
- [ ] ドラフト PR を作成し、作成後に main に戻っている

## ビジュアル品質（Spell UI）

- [ ] `index.html` / `docs/opentui.html` 等とトーンが大きく乖離していない
- [ ] Mermaid 利用時は `references/libraries.md` のテーマ・ズーム方針に沿っている
- [ ] `references/visual-explainer-core.md` の Anti-Patterns（スロップ検査）を一通り確認した
