# Gate iOS Client

**[English](README.md)** | 日本語

Claude Codeのパーミッションリクエストをリモートで管理するためのSwiftUI iOSアプリケーションです。

## 概要

Gate iOS Clientを使用すると、iPhoneまたはiPadからClaude Codeのコマンド実行リクエストを承認または拒否できます。Claude Codeがコマンドの実行許可を必要とすると、リクエストがデバイスに即座に表示され、ローカルネットワーク上のどこからでも確認して承認できます。

## 要件

- iOS 17.0以降
- Xcode 15以降（Xcode 16以降を推奨）
- Gate brokerと同じWi-Fiネットワーク
- コンピューター上でGate brokerが実行中

## 機能

- ✅ 6桁のペアリングコード認証
- ✅ 手動でのbroker IP:port設定
- ✅ WebSocketリアルタイム更新
- ✅ パーミッションリクエスト用のAllow/Denyボタン
- ✅ 永続化されたトークンベース認証
- ✅ 自動再接続処理
- ✅ エラーハンドリングとユーザーフィードバック
- ✅ ユニバーサルアプリ（iPhoneとiPad）

## プロジェクト構造

```
Gate.xcworkspace/           # Xcodeワークスペース
├── Gate.xcodeproj/         # アプリシェル
├── Gate/                   # アプリターゲット（エントリーポイントのみ）
│   └── GateApp.swift
└── GatePackage/            # Swiftパッケージ（すべての機能）
    └── Sources/
        └── GateFeature/
            ├── Models/             # データモデル
            │   ├── PermissionRequest.swift
            │   ├── AuthResponse.swift
            │   ├── WebSocketMessage.swift
            │   └── BrokerConfig.swift
            ├── Services/           # ビジネスロジック
            │   ├── AuthStorage.swift
            │   ├── APIClient.swift
            │   ├── WebSocketManager.swift
            │   └── AppState.swift
            └── Views/              # SwiftUIビュー
                ├── ContentView.swift
                ├── PairingView.swift
                ├── MainView.swift
                └── PermissionRequestCard.swift
```

## セットアップ

### 1. Xcode Command Line Toolsの修正（必要な場合）

`xcodebuild`がXcodeを要求するエラーが表示される場合は、次を実行:

```bash
# Xcodeアプリケーションに切り替え
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer

# パスを確認
xcode-select -p
# 出力: /Applications/Xcode.app/Contents/Developer
```

### 2. プロジェクトを開く

```bash
cd apps/ios-client
open Gate.xcworkspace
```

**重要:** 常に`Gate.xcworkspace`を開き、`Gate.xcodeproj`は開かないでください。

### 3. ビルドと実行

Xcodeで:
1. シミュレーターまたは接続されたデバイスを選択
2. `Cmd + R`を押してビルドと実行

## 使い方

### 初回セットアップ

1. **Brokerを起動**（コンピューター上で）:
   ```bash
   cd apps/broker
   pnpm dev
   ```

   Brokerは6桁のペアリングコードを表示します:
   ```
   ┌─────────────────────────────────────────┐
   │         PAIRING CODE                    │
   │                                         │
   │         123456                          │
   │                                         │
   │  Use this code to pair clients          │
   │  Expires in 5 minutes                   │
   └─────────────────────────────────────────┘
   ```

2. **iOSアプリを起動**:
   - アプリはペアリング画面を表示します
   - Broker URLを入力（例: `http://192.168.1.100:3000`）
     - コンピューターのIPアドレスを使用し、`localhost`は使用しないでください
     - IPを確認: `ifconfig | grep "inet "`
   - 6桁のペアリングコードを入力
   - 「Pair Device」をタップ

3. **認証完了**:
   - ペアリング後、アプリはWebSocket経由で自動的に接続します
   - 認証トークンはローカルに保存されます
   - 接続ステータスを含むメイン画面が表示されます

### パーミッションリクエストの管理

1. **リアルタイム更新**:
   - Claude Codeがパーミッションをリクエストすると、アプリに即座に表示されます
   - 各リクエストには以下が表示されます:
     - サマリー（コマンドの説明）
     - 完全なコマンド
     - 作業ディレクトリ
     - 生のプロンプトテキスト

2. **承認または拒否**:
   - 「Allow」（緑）をタップしてコマンドを承認
   - 「Deny」（赤）をタップしてコマンドを拒否
   - 決定は即座にbrokerに送信されます
   - リクエストは解決されると消えます

3. **接続ステータス**:
   - ● 緑: 接続済み
   - ● オレンジ: 接続中
   - ● 赤: エラー
   - ● グレー: 切断

### 設定

右上のメニューアイコン（⋯）をタップして:
- **Reconnect**: Brokerに手動で再接続
- **Logout**: 保存された認証情報をクリアし、ペアリング画面に戻る

## アーキテクチャ

### モデル
- `PermissionRequest`: Adapterからのパーミッションリクエスト
- `Decision`: Allow/Deny決定のenum
- `WebSocketMessage`: WebSocketメッセージプロトコル
- `BrokerConfig`: Broker URLと認証トークン

### サービス
- `AuthStorage`: UserDefaultsにトークンを永続化（actor）
- `APIClient`: ペアリングと決定のためのHTTP APIクライアント（actor）
- `WebSocketManager`: WebSocket接続マネージャー（@Observable）
- `AppState`: アプリケーション全体の状態管理（@Observable）

### ビュー
- `ContentView`: 認証ルーティングを持つルートビュー
- `PairingView`: Broker URLとコード入力を持つペアリング画面
- `MainView`: リクエストリストと接続ステータスを持つメイン画面
- `PermissionRequestCard`: Allow/Denyボタンを持つ個別のリクエストカード

### 状態管理

アプリは**SwiftUIのネイティブ状態管理**を使用:
- リアクティブ状態オブジェクトに`@Observable`
- ビューローカル状態に`@State`
- 依存性注入に`@Environment`
- スレッドセーフなデータアクセスにActor
- 全体でSwift Concurrency（async/await）

## セキュリティ

- 認証トークンは`UserDefaults`に保存されます
- すべてのAPIリクエストはBearerトークン認証を使用
- WebSocket接続はクエリパラメータにトークンを含む
- トークンはログアウトするまでアプリ起動間で永続化
- ネットワークリクエストは本番環境でHTTPSを使用（ローカル開発ではHTTP）

## 開発

### XcodeBuildMCPでのビルド

```javascript
// セッションデフォルトを設定
session-set-defaults({
  workspacePath: "/path/to/Gate.xcworkspace",
  scheme: "Gate",
  simulatorName: "iPhone 16"
})

// シミュレーター用にビルド
build_sim()

// ビルドと実行
build_run_sim()

// テストを実行
test_sim()
```

### 依存関係の追加

`GatePackage/Package.swift`を編集:

```swift
dependencies: [
    .package(url: "https://github.com/example/Package", from: "1.0.0")
],
targets: [
    .target(
        name: "GateFeature",
        dependencies: ["Package"]
    ),
]
```

### テスト

テストは**Swift Testing**フレームワーク（XCTestではない）を使用:

```swift
import Testing

@Test func pairingCodeValidation() async throws {
    let code = "123456"
    #expect(code.count == 6)
    #expect(code.allSatisfy { $0.isNumber })
}
```

Xcodeで`Cmd + U`またはXcodeBuildMCP経由でテストを実行。

## トラブルシューティング

### Brokerに接続できない

**問題:** アプリが「Error」または「Disconnected」を表示

**解決方法:**
- iOSデバイス/シミュレーターがbrokerと同じWi-Fiネットワークにあることを確認
- Broker URLが正しいことを確認（IPアドレスを使用、`localhost`ではない）
- Brokerが実行中であることを確認: `curl http://<broker-ip>:3000/health`
- Brokerにpingを試す: `ping <broker-ip>`

### WebSocket接続が失敗する

**問題:** 接続済みだがリクエストが表示されない

**解決方法:**
- 認証トークンが有効であることを確認
- Brokerログで接続エラーを確認
- メニューから再接続を試す
- トークンが期限切れの場合はデバイスを再ペアリング

### ペアリングが失敗する

**問題:** 「Invalid code」または「Request failed」エラー

**解決方法:**
- ペアリングコードが正しいことを確認（6桁）
- コードが期限切れでないことを確認（5分）
- Broker URLがアクセス可能であることを確認: `curl http://<broker-ip>:3000/health`
- URLのタイプミスを確認（http://プレフィックスが必要）

### Xcodeビルドエラー

**問題:** `xcode-select: error: tool 'xcodebuild' requires Xcode`

**解決方法:**
```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
xcode-select -p  # 確認
```

## 設定

### ビルド設定

ビルド設定は`Config/`のXCConfigファイルで管理:
- `Config/Shared.xcconfig` - 共通設定（バンドルID、デプロイメントターゲット）
- `Config/Debug.xcconfig` - デバッグ固有の設定
- `Config/Release.xcconfig` - リリース固有の設定
- `Config/Tests.xcconfig` - テスト固有の設定

### Entitlements

アプリ機能は`Config/Gate.entitlements`で定義されます。このファイルを直接編集して、以下のような機能を追加できます:
- HealthKit
- CloudKit
- プッシュ通知
- バックグラウンドモード

## 今後の機能強化

潜在的な改善:
- [ ] ローカルネットワーク上のbrokerのmDNS自動検出
- [ ] バックグラウンド動作のためのプッシュ通知
- [ ] iPad最適化マルチカラムレイアウト
- [ ] ダークモードサポート
- [ ] 決定のための触覚フィードバック
- [ ] リクエスト履歴と統計
- [ ] 複数brokerのサポート
- [ ] 生体認証（Face ID / Touch ID）

## サポート

問題や機能リクエストについては、メインのGateリポジトリのissue trackerを使用してください。

## ライセンス

MIT
