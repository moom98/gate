# Gate Adapter for Claude CLI

**[English](README.md)** | 日本語

Claude Code CLIのパーミッションプロンプトをインターセプトし、リモート承認のためにGate brokerに送信するPTYラッパーです。

## 仕組み

```
ユーザー -> adapter-claude (これ) -> claude CLI -> プロンプト -> broker -> Web UI/iOS
                                         ^                                    |
                                         |                                    |
                                         +--- y/n 注入 <---------------------+
```

**重要**: `claude`コマンドを直接実行**しないでください**。AdapterはClaude CLIを内部で起動し、PTYでラップします。

## 前提条件

1. Claude Code CLIがインストールされていること（`claude`コマンドがPATHにあること）
2. Gate brokerが実行中であること（`cd ../broker && pnpm dev`）
3. Web UIがbrokerとペアリング済み（BROKER_TOKENを取得するため）

## クイックスタート

### 自動セットアップ（推奨）

リポジトリルートからセットアップスクリプトを実行:

```bash
./scripts/setup-adapter.sh
```

このスクリプトは以下を実行します:
- Adapterのビルド
- Brokerへの接続確認
- BrokerのPORTに合わせてBROKER_URLを更新
- BROKER_TOKENの入力を促す
- .env.localを自動更新

### 手動セットアップ

#### 1. Adapterのビルド

```bash
cd apps/adapter-claude
pnpm build
```

#### 2. 環境変数の設定

`.env.example`を`.env.local`にコピー:

```bash
cp .env.example .env.local
```

`.env.local`を編集:

```bash
# Broker HTTP URL（BrokerのPORTと一致させる必要があります）
BROKER_URL=http://localhost:3033

# Broker認証トークン（ステップ7以降必須）
# Web UIでペアリング後に取得
BROKER_TOKEN=your-token-from-web-ui

# Claude CLIコマンド（デフォルト: claude）
CLAUDE_COMMAND=claude

# Claude CLIの作業ディレクトリ（デフォルト: カレントディレクトリ）
# CLAUDE_CWD=/path/to/working/directory
```

#### 3. BROKER_TOKENの取得

1. Brokerを起動: `cd ../broker && pnpm dev`
2. Brokerコンソールに表示されるペアリングコードをメモ
3. Web UIを開く: http://localhost:3001
4. ペアリングコードを入力
5. ペアリング成功後、ブラウザのDevToolsを開く
6. Application > localStorageに移動
7. `token`の値をコピー
8. `.env.local`に`BROKER_TOKEN=...`として貼り付け

#### 4. Adapterの起動

```bash
pnpm dev
```

Adapterは以下を実行します:
- PTYで`claude` CLIを起動
- パーミッションプロンプトの出力を監視
- 検出されたプロンプトをbrokerに送信
- Web UI/iOSからの決定を待機
- Claude CLIに`y`または`n`を注入

## 使い方

Adapterを起動すると、すべてのClaude Codeのパーミッションプロンプトがインターセプトされ、brokerに送信されます。以下から承認/拒否できます:

- **Web UI**: http://localhost:3001
- **iOSアプリ**: （ペアリング済みの場合）

## 重要な注意事項

### ⚠️ Claudeを直接実行しない

Adapterを実行しているときは、`claude`コマンドを別途実行**しないでください**。AdapterはすでにClaude CLIを内部で起動しています。

✅ **正しい使い方**:
```bash
# ターミナル1: Adapterを起動
cd apps/adapter-claude
pnpm dev

# AdapterがClaude CLIを起動
# 同じターミナルでClaudeとやり取り
```

❌ **間違った使い方**:
```bash
# ターミナル1: Adapterを起動
cd apps/adapter-claude
pnpm dev

# ターミナル2: これはしないでください
claude  # これはAdapterに接続されていない別のClaudeインスタンスを作成します
```

### Claudeとのやり取り方法

`pnpm dev`でAdapterを起動した後:

1. AdapterがClaude CLIを自動的に起動
2. `[Adapter] Claude CLI spawned successfully (PID: XXXXX)`が表示されます
3. Claude CLIのプロンプトが**同じターミナル**に表示されます
4. 通常通りClaudeにリクエストを入力
5. Claudeがパーミッションを必要とすると、Adapterがそれをインターセプトしてbrokerに送信
6. Web UIまたはiOSアプリから承認/拒否
7. 決定が自動的にClaudeに注入されます

## トラブルシューティング

### 問題: Adapterからログが出ない

**症状**:
- `[Adapter]`ログが表示されない
- Claudeがbrokerに接続されていない様子

**考えられる原因**:
1. Adapterが実行されていない
2. Adapterを通さずに`claude`を直接実行している
3. 環境変数が読み込まれていない

**解決方法**:
1. Adapterが実行されていることを確認: `cd apps/adapter-claude && pnpm dev`
2. `[Adapter] Starting Gate Adapter for Claude CLI`が表示されることを確認
3. `claude`コマンドを別途実行しない
4. `.env.local`が存在し、正しい値が設定されていることを確認

### 問題: "401 Unauthorized"エラー

**症状**:
- Adapterログに認証エラーが表示される
- Brokerへのリクエストが401で失敗

**考えられる原因**:
1. `.env.local`に`BROKER_TOKEN`がない
2. トークンが無効または期限切れ
3. 別のbrokerインスタンスのトークン

**解決方法**:
1. Brokerが実行されていることを確認
2. ペアリングコードを使用してWeb UIをbrokerとペアリング
3. ブラウザのlocalStorageから新しいトークンを取得
4. `.env.local`の`BROKER_TOKEN`を更新
5. Adapterを再起動: `pnpm dev`

### 問題: Brokerへの"Connection refused"

**症状**:
- Brokerに接続できない
- ログに`ECONNREFUSED`エラー

**考えられる原因**:
1. Brokerが実行されていない
2. `.env.local`の`BROKER_URL`が間違っている
3. ポート番号の不一致

**解決方法**:
1. Brokerを起動: `cd apps/broker && pnpm dev`
2. `apps/broker/.env.local`でBrokerのPORTを確認
3. `apps/adapter-claude/.env.local`の`BROKER_URL`を一致させる
4. セットアップスクリプトを実行: `./scripts/setup-adapter.sh`
5. Adapterを再起動

### 問題: パーミッションプロンプトが検出されない

**症状**:
- Claudeがパーミッションプロンプトを表示
- しかしWeb UIに表示されない
- `[Adapter] Permission prompt detected`ログがない

**考えられる原因**:
1. パターン正規表現がClaude Codeの出力と一致しない
2. ANSI色コードが検出を妨害
3. 複数行のプロンプトがキャプチャされていない

**解決方法**:
1. デバッグモードを有効化: `DEBUG_MODE=true pnpm dev`
2. PTY出力のログを確認
3. `(y/n)`を含む行を探す
4. パターンが一致しない場合は、サンプル出力を添えてissueを報告
5. 必要に応じて`config.json`のパターンを調整

### 問題: Web UIが通知を受信しない

**症状**:
- Adapterがプロンプトを検出: `[Adapter] Permission prompt detected`
- Brokerがリクエストを受信
- しかしWeb UIに通知が表示されない

**考えられる原因**:
1. Web UIがbrokerに接続されていない
2. WebSocketが切断されている
3. ブラウザタブがバックグラウンド（通知が無効）

**解決方法**:
1. Web UIに"Connected"（緑）が表示されることを確認
2. Web UIページを更新
3. ブラウザコンソールでWebSocketエラーを確認
4. Web UIがAdapterのトークンと同じペアリングコードを使用していることを確認

## デバッグモード

詳細なログを有効化:

```bash
DEBUG_MODE=true pnpm dev
```

これにより以下がログ出力されます:
- Claude CLIからのすべてのPTY出力
- パターンマッチングの試行
- Broker通信の詳細
- 決定の注入

## 開発

```bash
# 自動リロードで起動
pnpm dev

# TypeScriptをビルド
pnpm build

# 型チェックのみ
pnpm typecheck

# ビルド成果物をクリーン
pnpm clean
```

## アーキテクチャ

**主要ファイル**:
- [src/index.ts](src/index.ts) - エントリーポイント、PTYマネージャーを初期化
- [src/pty-manager.ts](src/pty-manager.ts) - Claude CLIを起動、I/Oを処理
- [src/detection.ts](src/detection.ts) - パーミッションプロンプトのパターンマッチング
- [src/broker-client.ts](src/broker-client.ts) - Broker通信用HTTPクライアント
- [src/config.ts](src/config.ts) - 設定の読み込み

**フロー**:
1. index.tsが設定を読み込み、PtyManagerを作成
2. PtyManagerがPTYで`claude`コマンドを起動
3. PTY標準出力をPatternDetectorが監視
4. パターンが一致すると、BrokerClientがbrokerにリクエストを送信
5. BrokerがWebSocket経由でWeb UI/iOSにブロードキャスト
6. ユーザーがUIから承認/拒否
7. Brokerがadapterに決定を返す
8. Adapterがpta標準入力に`y\n`または`n\n`を注入
9. Claude CLIが応答を受け取り、続行

## セッション例

```bash
$ cd apps/adapter-claude
$ pnpm dev

[Adapter] Starting Gate Adapter for Claude CLI
[Adapter] Configuration loaded:
  Broker URL: http://localhost:3033
  Claude Command: claude
  Working Directory: /Users/you/project
[Adapter] Spawning Claude CLI: claude
[Adapter] Claude CLI spawned successfully (PID: 12345)

# Claude CLIプロンプトが表示される
> What can I help you with?

# ユーザーがリクエストを入力
> Read the README.md file

# Claudeがパーミッションを要求
Allow command execution? (y/n)

[Adapter] Permission prompt detected: generic_permission
[BrokerClient] Sending permission request: abc-123-def
[BrokerClient] Received decision for abc-123-def: allow
[Adapter] Injecting decision: y

# Claudeが承認されたアクションを続行
Reading file: README.md
...
```

## ライセンス

MIT
