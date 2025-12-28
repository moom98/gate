# GitHub Actions 自動化ドキュメント

## Copilot Review Auto-Handler

### 概要

GitHub CopilotがPRにレビューコメントを投稿すると、自動的にClaude Codeが起動して以下を実行します：

1. Copilotのレビューコメントを収集
2. Claude Codeで指摘事項を修正
3. lint/typecheck/buildを実行
4. 変更をコミット・プッシュ
5. PRに対応完了のコメントを投稿

これにより、**Copilotレビュー → Claude修正 → push** が完全自動化されます。

### フロー図

```
Copilot Review投稿
    ↓
GitHub Actions トリガー
    ↓
既に対応済み？ → Yes → スキップ
    ↓ No
リトライ上限超過？ → Yes → スキップ（手動対応必要）
    ↓ No
レビューコメント収集
    ↓
Claude Code実行
    ↓
修正 → lint/typecheck/build → commit → push
    ↓
PRにコメント投稿（マーカー付き）
```

### 必要な設定

#### 1. GitHub Secrets

以下のいずれか（または両方）を設定してください：

**推奨: `CLAUDE_CODE_OAUTH_TOKEN`**
```bash
# Claude Code OAuth トークンを取得
claude auth login

# トークンを表示
cat ~/.config/claude-code/auth.json

# GitHub Secretsに設定
# Settings > Secrets and variables > Actions > New repository secret
# Name: CLAUDE_CODE_OAUTH_TOKEN
# Value: <上記で取得したトークン>
```

**代替: `ANTHROPIC_API_KEY`**
```bash
# Anthropic APIキーを取得（https://console.anthropic.com/）

# GitHub Secretsに設定
# Name: ANTHROPIC_API_KEY
# Value: <APIキー>
```

#### 2. GitHub Copilot設定

Copilotが新しいpushに対して再レビューしないように設定することを推奨します：

1. リポジトリ設定 > Code review > Copilot
2. "Re-review on new commits" を無効化（推奨）

これにより無限ループを防ぎます。

### 無限ループ対策

以下の複数の対策により、無限ループを防止しています：

1. **マーカーコメント**
   - Claudeが投稿するコメントに `[claude-copilot-handled]` マーカーを含める
   - 既にマーカーがある場合はスキップ

2. **リトライ上限**
   - 同一PRで最大2回までの自動修正
   - 超過した場合は手動対応が必要

3. **並行実行制御**
   - `concurrency` グループで同一PRの並列実行を防止

### ワークフロートリガー

以下のイベントで起動します：

- `pull_request_review: [submitted]` - レビュー全体が投稿された時
- `pull_request_review_comment: [created]` - インラインコメントが投稿された時

**フィルタ条件:**
- レビュアーのログインに "copilot" が含まれる場合のみ実行

### 動作確認方法

#### 手動テスト

1. **PRを作成**
   ```bash
   git checkout -b test/copilot-review
   # 何か変更を加える
   git commit -am "test: trigger copilot review"
   git push -u origin test/copilot-review
   gh pr create --title "Test Copilot Review" --body "Testing automation"
   ```

2. **Copilotレビューをトリガー**
   - PRにコメントを追加するか、コードを変更
   - Copilotが自動的にレビューを投稿（設定による）

3. **ワークフローの実行を確認**
   ```bash
   gh run list --workflow=copilot-review-to-claude.yml
   gh run view <run-id> --log
   ```

4. **結果確認**
   - PRのコミット履歴に修正コミットがあるか
   - PRに `[claude-copilot-handled]` マーカー付きコメントがあるか

#### ログ確認

```bash
# 最新の実行ログを表示
gh run list --workflow=copilot-review-to-claude.yml --limit 1
gh run view --log

# 特定PRの実行履歴
gh run list --workflow=copilot-review-to-claude.yml --json databaseId,headBranch,conclusion
```

### トラブルシューティング

#### Claude Codeが実行されない

**チェック項目:**
- [ ] `CLAUDE_CODE_OAUTH_TOKEN` または `ANTHROPIC_API_KEY` が設定されているか
- [ ] Copilotレビューがトリガーされているか（ログで確認）
- [ ] マーカーコメントが既に投稿されていないか
- [ ] リトライ上限（2回）に達していないか

**ログ確認:**
```bash
gh run view <run-id> --log | grep "Claude"
```

#### 無限ループが発生する

**対策:**
1. Copilotの "Re-review on new commits" を無効化
2. ワークフローを一時的に無効化
   ```bash
   # .github/workflows/copilot-review-to-claude.yml を編集
   # 先頭に以下を追加
   # on: workflow_dispatch
   ```

3. マーカーコメントを手動で投稿
   ```bash
   gh pr comment <PR番号> --body "[claude-copilot-handled] Manual override"
   ```

#### 権限エラー

**必要な権限:**
- `contents: write` - コードの変更・プッシュ
- `pull-requests: write` - PRへのコメント投稿
- `issues: write` - Issue/PRコメントの読み取り

これらはワークフローファイルで既に設定済みです。

### 制限事項

1. **Claude Codeの制約**
   - 非対話モードでの実行のため、複雑な質問には対応不可
   - エラー時はスキップして継続（ログで確認必要）

2. **Copilot検出の精度**
   - ユーザー名に "copilot" を含むかで判定（環境差に注意）
   - 誤検出を防ぐため、ログで実際のユーザー名を確認可能

3. **リトライ制限**
   - 同一PRで2回まで
   - 超過後は手動対応が必要

### カスタマイズ

#### リトライ上限の変更

`.github/workflows/copilot-review-to-claude.yml` の以下を編集：

```yaml
# Maximum 2 auto-fixes per PR
if [ "$COUNT" -ge 2 ]; then
  # 2 を任意の数値に変更
```

#### Claudeへの指示変更

`Run Claude Code to fix review issues` ステップの `PROMPT` を編集：

```yaml
PROMPT="カスタムプロンプト..."
```

#### 対象ブランチの制限

ワークフローに以下を追加：

```yaml
on:
  pull_request_review:
    types: [submitted]
    branches:
      - main
      - develop
```

## 関連リソース

- [GitHub Actions ドキュメント](https://docs.github.com/actions)
- [Claude Code ドキュメント](https://docs.anthropic.com/claude-code)
- [GitHub Copilot ドキュメント](https://docs.github.com/copilot)
