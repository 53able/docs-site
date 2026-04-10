# harness-min-ts

TypeScript の最小ハーネス実験。リポジトリ内のテストは **決定的なモック** で回し、CI と再現性を担保する。**LLM を使った意味的な検証**（設計の妥当性、追加シナリオの発案、実 API 接続の試行など）は **コーディングエージェント（Cursor）側** で行う。パッケージ本体に LLM 呼び出しを埋め込む必要はない。

## 検証の役割分担

| 層 | 何をするか |
| --- | --- |
| このパッケージ（Vitest） | 状態・チェックポイント・境界契約・trace・トポロジー比較を **決定的に** 実証する。 |
| Cursor（コーディングエージェント） | テスト結果の解釈、ハーネス設計のレビュー、新しい失敗シナリオの追加、任意で `createMockLlm` 以外のアダプタ実装やスモーク手順の実行。 |

Cursor で検証するときの最小手順の例: `npm test` と `npm run typecheck` をエージェントに実行させ、失敗時は `src/harness.test.ts` と `src/runner.ts` を起点に原因を切り分ける。実 API を試す場合は **環境変数とスモーク用の短命コード** に限定し、本番秘密情報をリポジトリに残さない。

## 実行

```bash
cd experiments/harness-min-ts
npm install
npm run typecheck
npm test
```

## ドキュメント論点との対応

| 論点（[tmp/ハーネスエンジニアリングのベストプラクティス.md](../../tmp/ハーネスエンジニアリングのベストプラクティス.md)） | テスト / コード |
| --- | --- |
| 状態は会話ではなく明示オブジェクト（prompt は view） | `promptView`、`HarnessState` |
| 長時間・再開（checkpoint） | `TC-5.1 crash after checkpoint then resume` |
| workflow と policy（承認はプロンプトではない） | `evaluateSpendPolicy` のテスト |
| マルチステップ境界の契約 | `TC-6.1 agent A to B payload contract` |
| 観測可能性（trace） | `TC-7.1 trace shape` |
| トポロジーは実験で比較 | `TC-9.1 topology comparison (chain vs star)` |
| 決定論は LLM に頼らない | `normalizeIsoDate`（TC-3.1） |

## 実 API について

本パッケージの既定テストはモックのみ。実キーによるスモークは **Cursor セッション上で任意実施**し、再現性は落ちる旨をコミットメッセージまたは PR 説明に残す。キーはリポジトリにコミットしない。
