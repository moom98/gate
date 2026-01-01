# Gate

**[English](README.md)** | 日本語

Claude Code Permission Gateway - Claude Code CLIからのコマンド実行許可リクエストをリモートで管理します。

## 概要

GateはClaude Code CLIからのパーミッションプロンプトをインターセプトし、同じWi-Fiネットワーク上のWeb UIまたはiOSアプリからリモートでコマンドを承認または拒否できるようにします。

**ユースケース:** Claude Codeが「Allow command execution? (y/n)」と尋ねたとき、ターミナルで応答する代わりに、スマートフォンや別のブラウザウィンドウからリクエストを確認して承認できます。

## アーキテクチャ

```text
┌─────────────────┐
│  Claude Code    │
│  (with Hooks)   │
└────────┬────────┘
         │ PreToolUse event
         ▼
┌─────────────────┐
│  Hook Script    │
│  (.claude/hooks)│
└────────┬────────┘
         │ HTTP POST /v1/requests
         ▼
┌─────────────────┐      WebSocket      ┌─────────────────┐
│  Broker (3000)  │ ◄─────────────────► │  Web UI (3001)  │
└─────────────────┘                     └─────────────────┘
         ▲
         │ POST /v1/decisions
         │
    ┌────┴────┐
    │  User   │
    │ (allow/ │
    │  deny)  │
    └─────────┘
```

**注意:** アダプターは不要です！フックはClaude CLIと直接統合されます。

## 技術スタック

- **パッケージマネージャー**: pnpm
- **ランタイム**: Node.js 20 LTS
- **言語**: TypeScript
- **Broker**: HTTP + WebSocketサーバー
- **フック統合**: Claude Code PreToolUseフック（Node.jsスクリプト）
- **Web UI**: Next.js（App Router）+ shadcn/ui + Tailwind CSS
- **iOSクライアント**: SwiftUI + URLSessionWebSocketTask
- **CI/CD**: GitHub Actions

## 前提条件

- Node.js 20 LTS（`.nvmrc`を参照）
- pnpm 8.x以降
- Git

## クイックスタート

### 1. 依存関係のインストール

```bash
# corepackを有効化（まだ有効化していない場合）
corepack enable

# すべての依存関係をインストール
pnpm install
```

### 2. すべてのパッケージをビルド

```bash
pnpm -r build
```

### 3. システムの起動

#### ターミナル1: Brokerの起動

```bash
cd apps/broker
pnpm dev
```

Brokerは`http://localhost:3000`で起動し、6桁のペアリングコードが表示されます。

**出力例:**

```text
[Broker] Server running on http://localhost:3000
[Broker] Health check: http://localhost:3000/health
[Broker] WebSocket endpoint: ws://localhost:3000/ws

┌─────────────────────────────────────────┐
│         PAIRING CODE                    │
│                                         │
│         123456                          │
│                                         │
│  Use this code to pair clients          │
│  Expires in 5 minutes                   │
└─────────────────────────────────────────┘
```

#### ターミナル2: Web UIの起動

```bash
cd apps/web-ui
pnpm dev
```

Web UIは`http://localhost:3001`で利用可能になります。

**初回セットアップ:**

1. `http://localhost:3001`を開く
2. `/pair`ページにリダイレクトされます
3. Brokerコンソールに表示された6桁のコードを入力
4. 「Pair Device」をクリック
5. メインダッシュボードにリダイレクトされます

認証トークンはlocalStorageに保存されるため、ブラウザデータをクリアまたはログアウトしない限り、再度ペアリングする必要はありません。

#### オプション: ElectronでデスクトップUIを起動

```bash
cd apps/web-ui
pnpm electron:dev
```

同じダッシュボードをElectronのウィンドウ内で表示します（Next.js開発サーバーを起動してからElectronを立ち上げます）。配布用アプリを作成する場合は次を実行してください:

```bash
cd apps/web-ui
pnpm electron:build
```

`next build && next export`を実行したあと、`electron-builder`でパッケージ化します（macOSではXcodeコマンドラインツールが必要）。

### 4. Claude Code Hooksの設定

**認証トークンの取得:**

1. Web UIをペアリングした後（ステップ3）、ブラウザのDevToolsを開く（F12）
2. Application > localStorageに移動
3. `token`の値をコピー

**フックのセットアップ:**

1. テンプレートをコピーし、フックスクリプトを実行可能にします:

   ```bash
   cp .claude/settings.json.example .claude/settings.json
   chmod +x .claude/hooks/pretooluse-gate.js
   ```

2. `.claude/settings.json`を編集:
   - `/absolute/path/to/gate/`をGateプロジェクトへの実際のパスに置き換え
   - `{{REPLACE_WITH_YOUR_TOKEN}}`をlocalStorageから取得したトークンに置き換え

   例:

   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash",
           "hooks": [
             {
               "type": "command",
               "command": "/Users/yourname/gate/.claude/hooks/pretooluse-gate.js",
               "timeout": 65000,
               "env": {
                 "GATE_BROKER_URL": "http://localhost:3000",
                 "GATE_BROKER_TOKEN": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
               }
             }
           ]
         }
       ]
     }
   }
   ```

3. フックスクリプトはBash、Edit、Write、NotebookEditツールをインターセプトします
4. その他のツール（Read、Grepなど）は承認なしで実行されます

**使い方:**

1. 任意のプロジェクトディレクトリでClaude CLIを起動:

   ```bash
   claude
   ```

2. Claudeがインターセプト対象のツール（Bash、Edit、Write、NotebookEdit）を実行しようとすると:
   - フックがBrokerにパーミッションリクエストを送信
   - Web UIまたはiOSアプリで通知が表示されます
   - リクエストを承認または拒否
   - Claudeが決定を受け取り、それに応じて処理を進めます

3. インターセプト対象外のツール（Read、Grep、Globなど）は承認なしで即座に実行されます

**注意:** アダプターは不要です！フックはClaude CLIと直接統合されます。

## 開発コマンド

**ルートレベル:**

```bash
pnpm install           # 依存関係のインストール
pnpm -r build          # すべてのパッケージをビルド
pnpm -r lint           # すべてのパッケージをLint
pnpm -r typecheck      # すべてのパッケージを型チェック
pnpm -r test           # テストを実行（利用可能な場合）
pnpm dev               # すべてのサービスを開発モードで起動
pnpm clean             # ビルド成果物をクリーン
```

**パッケージごと:**

```bash
# Broker
cd apps/broker
pnpm dev               # tsx watchで起動
pnpm build             # TypeScriptをビルド
pnpm typecheck         # 型チェックのみ

# Adapter（非推奨 - Claude Code Hooksを使用してください）
cd apps/adapter-claude
pnpm dev               # tsx watchで起動
pnpm build             # TypeScriptをビルド
pnpm typecheck         # 型チェックのみ

# Web UI
cd apps/web-ui
pnpm dev               # Next.js開発サーバーを起動（ポート3001）
pnpm build             # 本番用バンドルをビルド
pnpm export            # Electron用に静的エクスポートを生成
pnpm lint              # ESLint
pnpm typecheck         # TypeScript型チェック
pnpm electron:dev      # Electronデスクトップアプリを開発モードで起動
pnpm electron:build    # デスクトップバイナリをビルド
```

## プロジェクト構造

```text
gate/
├── apps/
│   ├── broker/              # HTTP + WebSocketサーバー
│   │   ├── src/
│   │   │   └── index.ts     # エントリーポイント
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web-ui/              # Next.jsダッシュボード
│   │   ├── src/
│   │   │   ├── app/         # App Routerページ
│   │   │   ├── components/  # Reactコンポーネント
│   │   │   └── lib/         # ユーティリティ
│   │   ├── electron/        # Electronメインプロセス
│   │   ├── package.json
│   │   └── next.config.js
│   ├── ios-client/          # SwiftUI iOSアプリ（予定）
│   │   └── README.md
│   └── adapter-claude-legacy/  # 非推奨 PTYラッパー（レガシー）
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── .claude/
│   ├── hooks/
│   │   └── pretooluse-gate.js  # Claude Code PreToolUseフック
│   └── settings.json.example   # フック設定テンプレート
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions CI
├── package.json             # ルートパッケージ
├── pnpm-workspace.yaml      # ワークスペース設定
├── tsconfig.json            # ベースTypeScript設定
├── .nvmrc                   # Nodeバージョン（20.18.1）
├── .gitignore
├── AGENTS.md                # 開発者向けドキュメント
└── README.md                # このファイル
```

## 実装ステータス

✅ **完了したステップ:**

1. ✅ **Step 1**: プロジェクト構造のブートストラップ
2. ✅ **Step 2**: 基本的なHTTPエンドポイントを持つBrokerスケルトンの実装
3. ✅ **Step 3**: Claude CLIをスポーンするPTYラッパーの追加
4. ✅ **Step 4**: BrokerへのWebSocketサポートの追加
5. ✅ **Step 5**: アダプターでのパターン検出とy/nインジェクションの実装
6. ✅ **Step 6**: WebSocket経由でWeb UIをBrokerに接続
7. ✅ **Step 7**: トークンベース認証の追加

🚧 **進行中:**

- **Step 8**: 最小限のiOSクライアントの構築（SwiftUIスキャフォールディング利用可能、Xcodeプロジェクトのセットアップが必要）

## 設定

設定は環境変数で処理されます:

**Broker** (`apps/broker/.env`):

- `PORT` - HTTPサーバーポート（デフォルト: 3000）
- `WS_PATH` - WebSocketエンドポイントパス（デフォルト: /ws）

**Adapter（非推奨）** (`apps/adapter-claude/.env`):

- `BROKER_URL` - Broker HTTP URL（デフォルト: <http://localhost:3000>）
- `BROKER_TOKEN` - 認証トークン（ステップ7以降必須）
- `CLAUDE_COMMAND` - Claude CLIコマンド（デフォルト: claude）

**Web UI** (`apps/web-ui/.env.local`):

- `NEXT_PUBLIC_BROKER_URL` - Broker HTTP URL
- `NEXT_PUBLIC_WS_URL` - Broker WebSocket URL

## CI/CD

GitHub Actionsはすべてのpushとpull requestで実行されます:

- すべてのパッケージをLint
- すべてのパッケージを型チェック
- テストを実行（利用可能な場合）
- すべてのパッケージをビルド（Next.js本番ビルドを含む）

CIの使用環境:

- ランナー: `ubuntu-latest`
- Node.js: 20 LTS（`.nvmrc`から取得）
- パッケージマネージャー: pnpm（`corepack enable`経由）
- キャッシュ: pnpmストア

## セキュリティ

**現在の実装:**

- ✅ JWTトークンベース認証
- ✅ 6桁のペアリングコードフロー（5分の有効期限、1回限りの使用）
- ✅ すべての変更エンドポイントでBearerトークンが必須
- ✅ クエリパラメータ経由のWebSocket認証
- ✅ 本番モード: 自動生成コードは無効
- ✅ サニタイズされたエラーログ（トークン/シークレットの露出なし）

**セキュリティのベストプラクティス:**

- Brokerはlocalhostまたは信頼できるLAN上でのみ実行
- トークンは環境変数（adapter）またはlocalStorage（web-ui）に保存
- `.env`ファイルやトークンをバージョン管理にコミットしない
- 不審なアクティビティについてBrokerログを監視
- 本番環境では定期的にペアリングコードを再生成

**予定されている改善（MVP後）:**

- Let's EncryptによるHTTPS/WSSサポート
- ペアリングエンドポイントのレート制限
- トークンのローテーションとリフレッシュメカニズム
- すべてのパーミッション決定の監査ログ

詳細なセキュリティドキュメントは[AGENTS.md](AGENTS.md#5-security-considerations)をご覧ください。

## コントリビューション

1. `feat/NNN-description`のパターンに従ってフィーチャーブランチを作成
2. 変更を加える
3. ローカルでチェックを実行:

   ```bash
   pnpm -r lint
   pnpm -r typecheck
   pnpm -r build
   ```

4. 意味のあるメッセージでコミット
5. プッシュしてPRを作成
6. マージ前にCIが成功するのを待つ

## ブランチ戦略

各主要機能は独自のブランチで開発されます:

- `feat/000-bootstrap` - 初期プロジェクトセットアップ（現在）
- `feat/010-broker-skeleton` - HTTP APIエンドポイント
- `feat/020-adapter-pty` - PTYマネージャー
- `feat/030-broker-ws` - WebSocket統合
- `feat/040-adapter-detect-inject` - パターン検出とインジェクション
- `feat/050-web-ui-integrate` - Web UI統合
- `feat/060-token-pairing` - 認証
- `feat/070-ios-minimal` - iOSクライアント

## ライセンス

MIT

## 自動化

### Copilotレビュー自動ハンドラー

GateにはGitHub Copilotのコードレビューを自動的に処理するGitHub Actions自動化が含まれています:

**機能:**

1. GitHubのCopilotがPRにレビューコメントを投稿したことを検出
2. 自動的にClaude Codeを実行して問題を修正
3. 修正をコミットしてプッシュ
4. PRにサマリーコメントを投稿

**セットアップ:**

リポジトリに以下のいずれかのシークレットを追加:

```bash
# オプション1（推奨）: Claude Code OAuthトークン
# 1. ローカルの認証ファイルからaccess_tokenを取得:
cat ~/.config/claude-code/auth.json
# 出力例: {"access_token":"sk-ant-api03-ABC123...","refresh_token":"..."}

# 2. access_tokenの値のみをコピー（"access_token":"の後の部分）
# 例: 上記の出力から、sk-ant-api03-ABC123...をコピー

# 3. GitHubに追加:
# Settings > Secrets and variables > Actions > New repository secret
# 名前: CLAUDE_CODE_OAUTH_TOKEN
# 値: sk-ant-api03-ABC123... (access_tokenの値のみ、JSON全体ではない)

# オプション2（代替）: Anthropic APIキー
# 名前: ANTHROPIC_API_KEY
# 値: <https://console.anthropic.com/からのAPIキー>
```

**安全機能:**

- PR毎に最大2回の自動修正（無限ループを防止）
- マーカーベースの重複検出（`[claude-copilot-handled]`）
- 並行実行の防止

詳細なドキュメントは[docs/automation.md](docs/automation.md)をご覧ください。

## サポート

問題や機能リクエストについては、GitHubのissue trackerを使用してください。
