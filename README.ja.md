# Gate

**[English](README.md)** | 日本語

Claude Code Permission Gateway - Claude Code CLIからのコマンド実行許可リクエストをリモートで管理します。

## 概要

GateはClaude Code CLIからのパーミッションプロンプトをインターセプトし、同じWi-Fiネットワーク上のWeb UIまたはiOSアプリからリモートでコマンドを承認または拒否できるようにします。

**ユースケース:** Claude Codeが「Allow command execution? (y/n)」と尋ねたとき、ターミナルで応答する代わりに、スマートフォンや別のブラウザウィンドウからリクエストを確認して承認できます。

## アーキテクチャ

```
┌─────────────────┐
│  Claude Code    │
│      CLI        │
└────────┬────────┘
         │ (PTY)
         ▼
┌─────────────────┐      HTTP/WS      ┌─────────────────┐
│  Adapter        ├──────────────────►│     Broker      │
│  (node-pty)     │◄──────────────────┤  (HTTP + WS)    │
└─────────────────┘                   └────────┬────────┘
                                               │
                                ┌──────────────┴───────────────┐
                                │                              │
                                ▼                              ▼
                        ┌───────────────┐            ┌────────────────┐
                        │   Web UI      │            │   iOS App      │
                        │  (Next.js)    │            │  (SwiftUI)     │
                        └───────────────┘            └────────────────┘
```

## 技術スタック

- **パッケージマネージャー**: pnpm
- **ランタイム**: Node.js 20 LTS
- **言語**: TypeScript
- **Broker**: HTTP + WebSocketサーバー
- **Adapter**: node-pty (PTYラッパー)
- **Web UI**: Next.js (App Router) + shadcn/ui + Tailwind CSS
- **iOS Client**: SwiftUI + URLSessionWebSocketTask
- **CI/CD**: GitHub Actions

## 前提条件

- Node.js 20 LTS (`.nvmrc`参照)
- pnpm 8.x以降
- Git

## クイックスタート

### 1. 依存関係のインストール

```bash
# corepackを有効化（まだの場合）
corepack enable

# すべての依存関係をインストール
pnpm install
```

### 2. すべてのパッケージをビルド

```bash
pnpm -r build
```

### 3. システムの実行

#### ターミナル1: Brokerの起動

```bash
cd apps/broker
pnpm dev
```

Brokerは`http://localhost:3000`で起動し、6桁のペアリングコードを表示します。

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

認証トークンはlocalStorageに保存されるため、ブラウザデータをクリアするかログアウトしない限り、再度ペアリングする必要はありません。

#### ターミナル3: Adapterの起動

**⚠️ 重要**: AdapterはClaude CLIをラップします。Adapterを使用する場合は`claude`コマンドを別途実行**しないでください**。

##### クイックセットアップ（推奨）

自動セットアップスクリプトを実行:

```bash
./scripts/setup-adapter.sh
```

このスクリプトはAdapterをビルドし、環境変数を更新し、BROKER_TOKENの入力を求めます。

##### 手動セットアップ

```bash
cd apps/adapter-claude

# Adapterをビルド
pnpm build

# 環境変数を設定
# .env.localを編集してBROKER_TOKENを設定（apps/adapter-claude/README.md参照）

# Adapterを起動
pnpm dev
```

**AdapterはClaude CLIを内部で起動します。`claude`コマンドを別途実行しないでください。**

**BROKER_TOKENの取得方法:**

1. ペアリングコードを使用してWeb UIをBrokerとペアリング
2. ブラウザのDevTools > Application > localStorageを開く
3. `token`の値をコピー
4. `apps/adapter-claude/.env.local`に`BROKER_TOKEN=...`として追加

または、このプロセスを自動化するセットアップスクリプトを使用してください。

**使い方:**

`pnpm dev`でAdapterを起動した後:

1. AdapterがClaude CLIを自動的に起動します
2. **Adapterが実行されているターミナルで**Claudeとやり取りします
3. Claudeが許可を必要とすると、Adapterがそれをインターセプトします
4. Web UIまたはiOSアプリから承認/拒否します
5. 決定が自動的にClaudeに注入されます

詳細なドキュメントは[apps/adapter-claude/README.md](apps/adapter-claude/README.md)を参照してください。

## 開発コマンド

**ルートレベル:**
```bash
pnpm install           # 依存関係のインストール
pnpm -r build          # すべてのパッケージをビルド
pnpm -r lint           # すべてのパッケージをLint
pnpm -r typecheck      # すべてのパッケージの型チェック
pnpm -r test           # テストの実行（利用可能な場合）
pnpm dev               # すべてのサービスをdevモードで起動
pnpm clean             # ビルド成果物をクリーン
```

**パッケージ別:**
```bash
# Broker
cd apps/broker
pnpm dev               # tsxウォッチで起動
pnpm build             # TypeScriptをビルド
pnpm typecheck         # 型チェックのみ

# Adapter
cd apps/adapter-claude
pnpm dev               # tsxウォッチで起動
pnpm build             # TypeScriptをビルド
pnpm typecheck         # 型チェックのみ

# Web UI
cd apps/web-ui
pnpm dev               # Next.js devサーバーを起動（ポート3001）
pnpm build             # プロダクションバンドルをビルド
pnpm lint              # ESLint
pnpm typecheck         # TypeScriptチェック
```

## プロジェクト構造

```
gate/
├── apps/
│   ├── broker/              # HTTP + WebSocketサーバー
│   │   ├── src/
│   │   │   └── index.ts     # エントリーポイント
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── adapter-claude/      # Claude CLI用PTYラッパー
│   │   ├── src/
│   │   │   └── index.ts     # エントリーポイント
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web-ui/              # Next.jsダッシュボード
│   │   ├── src/
│   │   │   ├── app/         # App Routerページ
│   │   │   ├── components/  # Reactコンポーネント
│   │   │   └── lib/         # ユーティリティ
│   │   ├── package.json
│   │   └── next.config.js
│   └── ios-client/          # SwiftUI iOSアプリ
│       └── README.md
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions CI
├── package.json             # ルートパッケージ
├── pnpm-workspace.yaml      # ワークスペース設定
├── tsconfig.json            # ベースTypeScript設定
├── .nvmrc                   # Nodeバージョン（20.18.1）
├── .gitignore
├── AGENTS.md                # 開発者ドキュメント
└── README.md                # 英語版README
```

## 実装状況

✅ **完了したステップ:**

1. ✅ **ステップ1**: プロジェクト構造のブートストラップ
2. ✅ **ステップ2**: 基本HTTPエンドポイントを持つBrokerスケルトンの実装
3. ✅ **ステップ3**: Claude CLIを起動するPTYラッパーの追加
4. ✅ **ステップ4**: BrokerへのWebSocketサポートの追加
5. ✅ **ステップ5**: Adapterでのパターン検出とy/n注入の実装
6. ✅ **ステップ6**: WebSocket経由でWeb UIをBrokerに接続
7. ✅ **ステップ7**: トークンベース認証の追加

🚧 **進行中:**

- **ステップ8**: 最小限のiOSクライアントの構築（SwiftUIスキャフォールディング利用可能、Xcodeプロジェクトセットアップ完了）

## 設定

設定は環境変数で処理されます:

**Broker** (`apps/broker/.env`):
- `PORT` - HTTPサーバーポート（デフォルト: 3000）
- `WS_PATH` - WebSocketエンドポイントパス（デフォルト: /ws）

**Adapter** (`apps/adapter-claude/.env`):
- `BROKER_URL` - Broker HTTP URL（デフォルト: http://localhost:3000）
- `BROKER_TOKEN` - 認証トークン（ステップ7以降必須）
- `CLAUDE_COMMAND` - Claude CLIコマンド（デフォルト: claude）

**Web UI** (`apps/web-ui/.env.local`):
- `NEXT_PUBLIC_BROKER_URL` - Broker HTTP URL
- `NEXT_PUBLIC_WS_URL` - Broker WebSocket URL

## CI/CD

GitHub Actionsはすべてのプッシュとプルリクエストで実行されます:

- すべてのパッケージをLint
- すべてのパッケージを型チェック
- テストを実行（利用可能な場合）
- すべてのパッケージをビルド（Next.jsプロダクションビルドを含む）

CIで使用:
- ランナー: `ubuntu-latest`
- Node.js: 20 LTS (`.nvmrc`から)
- パッケージマネージャー: pnpm (`corepack enable`経由)
- キャッシュ: pnpmストア

## セキュリティ

**現在の実装:**

- ✅ JWTトークンベース認証
- ✅ 6桁のペアリングコードフロー（5分間有効、1回のみ使用）
- ✅ すべての変更エンドポイントにBearerトークンが必要
- ✅ クエリパラメータ経由のWebSocket認証
- ✅ プロダクションモード: 自動生成コードを無効化
- ✅ サニタイズされたエラーログ（トークン/シークレットの漏洩なし）

**セキュリティのベストプラクティス:**

- Brokerはlocalhostまたは信頼できるLANでのみ実行
- トークンは環境変数（adapter）またはlocalStorage（web-ui）に保存
- `.env`ファイルやトークンをバージョン管理にコミットしない
- Brokerログで不審なアクティビティを監視
- プロダクション環境では定期的にペアリングコードを再生成

**計画中の機能強化（MVP後）:**

- Let's EncryptによるHTTPS/WSSサポート
- ペアリングエンドポイントのレート制限
- トークンローテーションとリフレッシュメカニズム
- すべての許可決定の監査ログ

詳細なセキュリティドキュメントは[AGENTS.md](AGENTS.md#5-security-considerations)を参照してください。

## 貢献

1. `feat/NNN-description`パターンに従ってフィーチャーブランチを作成
2. 変更を加える
3. ローカルでチェックを実行:
   ```bash
   pnpm -r lint
   pnpm -r typecheck
   pnpm -r build
   ```
4. 意味のあるメッセージでコミット
5. プッシュしてPRを作成
6. マージ前にCIが通るのを待つ

## ブランチ戦略

各主要機能は独自のブランチで開発されます:
- `feat/000-bootstrap` - 初期プロジェクトセットアップ
- `feat/010-broker-skeleton` - HTTP APIエンドポイント
- `feat/020-adapter-pty` - PTYマネージャー
- `feat/030-broker-ws` - WebSocket統合
- `feat/040-adapter-detect-inject` - パターン検出と注入
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

詳細なドキュメントは[docs/automation.md](docs/automation.md)を参照してください。

## サポート

問題や機能リクエストについては、GitHubのissue trackerを使用してください。
