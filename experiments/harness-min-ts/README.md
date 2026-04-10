# harness-min-ts

TypeScript の最小ハーネス実験。LLM はネットワークなしのモック。状態・チェックポイント・境界契約・トポロジー切替を Vitest で実証する。

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

本パッケージはデフォルトでモックのみ。実キーによるスモークは別フェーズで行い、再現性は README に明記すること。
