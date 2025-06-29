# RSS Discord Transfer Lambda Function

AWS Lambdaを使用してRSSフィードの新着記事をDiscordに自動投稿するシステムです。

## 機能

- 複数のRSSフィードを監視
- 新着記事のみをDiscordに投稿  
- S3による状態管理
- エラー通知機能
- TypeScript + Node.js 18.x
- RSS取得: 20秒タイムアウト、Discord Webhook: 10秒タイムアウト

## ローカルテスト

本番環境にデプロイする前に、ローカル環境でLambda関数をテストできます。

### 1. 環境設定

`.env`ファイルを作成して、必要な環境変数を設定してください：

```bash
# .env ファイルの例
RSS_FEED_URLS=https://example.com/feed.xml,https://example2.com/rss.xml
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
ERROR_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_ERROR_WEBHOOK_URL
S3_BUCKET_NAME=your-s3-bucket-name
S3_STATE_KEY=rss-discord-state.json
AWS_REGION=us-east-1
```

テンプレートファイル `scripts/env.example` を参考にしてください。

### 2. 事前準備

```bash
# 依存関係をインストール
npm install

# TypeScriptをコンパイル
npm run build
```

### 3. ローカルテスト実行

#### 方法1: npmスクリプト経由
```bash
npm run test:local
```

#### 方法2: 直接実行

**Windows:**
```cmd
scripts\test-local.bat
```

**Linux/macOS:**
```bash
./scripts/test-local.sh
```

### 4. 必要なAWS権限

ローカルテストを実行するには、以下のAWS権限が必要です：

- S3バケットへの読み取り・書き込み権限
- 適切なAWS認証情報の設定（AWS CLI、環境変数、IAMロールなど）

## ビルドとデプロイ

### ビルド

```bash
# Windows
scripts\build.bat

# Linux/macOS
./scripts/build.sh
```

ビルドが完了すると、`rss-discord-transfer.zip` ファイルが生成されます。

### デプロイ

1. AWS Lambda コンソールにアクセス
2. 新しい関数を作成するか、既存の関数を選択
3. `rss-discord-transfer.zip` をアップロード
4. ハンドラーを `lambda-handler.handler` に設定
5. 環境変数を設定
6. 必要に応じてEventBridgeでスケジュール実行を設定

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `RSS_FEED_URLS` | ✓ | 監視するRSSフィードのURL（カンマ区切り） |
| `DISCORD_WEBHOOK_URL` | ✓ | Discord WebhookのURL |
| `ERROR_WEBHOOK_URL` | | エラー通知用Webhook URL（未設定時はメイン用を使用） |
| `S3_BUCKET_NAME` | ✓ | 状態管理用S3バケット名 |
| `S3_STATE_KEY` | | 状態ファイルのS3キー（デフォルト: rss-discord-state.json） |
| `AWS_REGION` | | AWSリージョン（デフォルト: us-east-1） |
| `SUPPRESS_FEED_ERROR_NOTIFICATIONS` | | RSS取得失敗時のDiscord通知を抑制（true/false、デフォルト: false） |

## トラブルシューティング

### よくある問題

1. **AWS認証エラー**
   - AWS CLIの認証情報が正しく設定されているか確認
   - IAMロールに必要な権限が付与されているか確認

2. **S3アクセスエラー**
   - S3バケットが存在するか確認
   - バケットに対する読み取り・書き込み権限があるか確認

3. **Discord Webhook エラー**
   - WebhookのURLが正しいか確認
   - Discordサーバーの権限設定を確認

### ログの確認

ローカルテスト時は、コンソールに詳細なログが出力されます。
AWS Lambda環境では、CloudWatch Logsでログを確認できます。

## 開発

### テスト実行

```bash
# 単体テスト
npm test

# テスト（watch mode）
npm run test:watch

# ローカル統合テスト
npm run test:local
```

### コード品質

```bash
# リント実行
npm run lint

# リント自動修正
npm run lint:fix

# フォーマット
npm run format
```

## ライセンス

MIT License
