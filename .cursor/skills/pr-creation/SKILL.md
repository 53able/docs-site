---
name: pr-creation
description: |
  ghコマンドでドラフトPRを作成する。
  ブランチにコミット済み＆リモートにpush済みの状態で使用。
  git + gh / GitButler 両環境に対応。
  単純ケースはスキル内で完結、複雑ケースはpr-managerサブエージェントへ委譲。
---

# PR Creation Expert

> **核心原則**: レビュアーは忙しい。「読みたい」と思っていない前提で、読んでもらう努力をする。

## Step 0: 環境検出

PR作成フローの最初に、現在の作業環境を判定する。

```bash
but status 2>/dev/null && echo "GITBUTLER" || echo "GIT"
```

| 結果 | 環境 | 状態確認 | Push | PR作成 |
|------|------|----------|------|--------|
| `GITBUTLER` | GitButler | `but status -f` | `but push <branch>` | `gh pr create` |
| `GIT` | 通常 git | `git status` 等 | 済み前提 | `gh pr create` |

> **設計意図**: PR作成は両環境とも `gh pr create` を使用する。`but pr` は対話式のため、エージェント自動化には `gh pr create` + ヒアドキュメントの方が制御しやすい。

## 判断基準: スキル vs サブエージェント

```
IF 単純なケース（以下すべて該当）:
├─ ブランチ: feature/{codename}/00-* または fix/* または hotfix/*
├─ ベースブランチ: main
├─ 依存PR: なし
└─ → スキル内で完結（下記フローに従う）

IF 複雑なケース（以下いずれか該当）:
├─ ブランチ: feature/{codename}/{NN}-*（NN > 00）
├─ ベースブランチ: 前の連番ブランチ
├─ 依存PR: あり
├─ マルチパッケージ変更
├─ GitButler スタックブランチ
└─ → pr-manager サブエージェントを起動
```

## クイックフロー（単純なケース）

```mermaid
flowchart LR
    A[環境検出] --> B[状況把握]
    B --> C[コマンド生成]
    C --> D[Self-Refine]
    D --> E[Push + PR作成]
    E --> F[完了確認]
```

### Step 1: 状況把握

#### 通常 git 環境

```bash
git branch --show-current  # 現在のブランチ名
git status --short         # 未コミットの変更確認
git log --oneline -3       # 最新のコミット確認
```

#### GitButler 環境

```bash
but status -f              # ブランチ一覧・コミット・ファイル状態を一括確認
```

> `but status -f` は、ブランチ名・コミット履歴・未コミット変更を全て含む。git 環境で3コマンド必要な情報が1コマンドで得られる。

**判断**:
| 状態 | 判断 | アクション |
|------|------|------------|
| ブランチ名が取得できない | エラー | 処理終了、ユーザーに報告 |
| 未コミットの変更がある | 警告 | ユーザーに確認を求める |
| コミットがない | 警告 | ユーザーに確認を求める |
| スタックブランチである（GitButler） | 複雑 | pr-manager サブエージェントへ委譲 |

### Step 2: コマンド生成

[templates.md](templates.md) のテンプレートを使用してPR本文を作成。
[decision-logic.md](decision-logic.md) でベースブランチ・タイトルを決定。

### Step 3: Self-Refine（自己評価）

コマンドを実行する**前に**、[safety-checks.md](safety-checks.md) に従って評価。

```mermaid
flowchart LR
    A["生成<br>(Generator)"] --> B["評価<br>(Evaluator)"]
    B --> C{"合格?"}
    C -->|No| D["修正<br>(Refiner)"]
    D --> B
    C -->|Yes| E["実行へ"]
```

**重要**: 評価結果を表示し、問題がなければ「評価完了」と宣言して実行に進む。

### Step 4: Push + PR作成

#### 通常 git 環境（push 済み前提）

```bash
cat <<'EOF' | gh pr create \
  --draft \
  --base main \
  --assignee @me \
  --title "<タイトル>" \
  --body-file -
<本文>
EOF
```

#### GitButler 環境

```bash
# 1. Push（GitButler経由）
but push <branch>

# 2. PR作成（gh CLI — 通常 git と同じ）
cat <<'EOF' | gh pr create \
  --draft \
  --base main \
  --assignee @me \
  --title "<タイトル>" \
  --body-file -
<本文>
EOF
```

> GitButler 環境では `but push` でリモートに反映してから `gh pr create` を実行する。PR作成コマンド自体は両環境で同一。

### Step 5: 完了確認

```
PR作成完了:

- Title: <タイトル>
- URL: https://github.com/org/repo/pull/123
- Base: main
- Draft: true
- Assignee: @me
```

**確認チェックリスト**:
- [ ] PRがドラフトモードで作成されている
- [ ] ベースブランチが正しい
- [ ] アサインが設定されている

## サブエージェント起動テンプレート

複雑なケースでは以下のプロンプトで `pr-manager` サブエージェントを起動:

```
【タスク】
PR作成

【環境】
{GIT または GITBUTLER}

【現在のブランチ】
{git branch --show-current または but status の結果}

【最新コミット】
{git log --oneline -5 または but status -f の結果}

【期待する出力】
- 依存PRの特定と関連付け
- 適切なベースブランチの決定
- PR本文の生成
- Push（GitButler環境の場合は but push）
- ghコマンドの実行
```

## 詳細参照

| シーン | 参照ファイル |
|--------|-------------|
| 本文・タイトルテンプレート | [templates.md](templates.md) |
| ベースブランチ・依存PR決定 | [decision-logic.md](decision-logic.md) |
| クォーティング・Self-Refine | [safety-checks.md](safety-checks.md) |

## 設定項目（固定）

| 項目 | 値 | 理由 |
|------|-----|------|
| ドラフトモード | 有効 | レビュー前の準備期間を確保 |
| アサイン | 作成者（@me） | 責任者の明確化 |
| レビュー依頼 | なし | ドラフト解除時に設定 |
