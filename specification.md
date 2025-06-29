# RSS To Discord Lambda Function

## Rule for Agent

- すべてのエージェントとユーザーの対話は日本語を利用する。
- コード内部のコメントやテストの説明文は英語を利用する。
- 開発環境は Windows であるため、コマンドは Powershell で実行されることに留意してください。
- わかりやすくメンテナンス性に優れたソフトウェアを作成しましょう！
- **コード品質管理**: 毎回のファイル編集後は必ずlintを実行し、コードの整形と品質チェックを行う。
- **テスト駆動開発**: 大きな変更や新機能の実装後は必ずテストを実行し、エラーがなくなるまで修正を継続する。
- **継続的品質保証**: コンパイルエラー、lint警告、テストエラーは即座に修正し、常に動作可能な状態を保つ。

## 機能要件

### RSS取得
- 対象RSSフィード: 環境変数から設定したURLリスト
- 取得頻度: EventBridge（旧CloudWatchイベント）のスケジュール設定で制御
- RSSフィードURL管理方法: 環境変数（カンマ区切りのURL一覧）
- 対応RSSフォーマット: RSS 2.0、Atom（必要に応じて）
- HTTPリクエストタイムアウト: 3秒
- リトライ回数: 1回（合計2回試行）

### 記事管理
- 新着記事の判別方法: 発行日時（pubDate）による判別
- 既読管理: 前回のチェック時刻を永続化し、それより新しい記事のみを処理
- 初回実行時の動作: 最新の記事のみを処理し、それ以前の記事は無視
- 1回の実行で処理する最大記事数: 10件（負荷軽減のため）

### Discord連携
- Discord連携方法: Webhook
- 投稿フォーマット: シンプルテキスト（タイトル + URL）
- 添付情報: 発行日時
- Webhookリクエストタイムアウト: 2秒
- エラー通知フォーマット: エラータイプ、発生時刻、エラー詳細を含むテキスト形式

## 環境変数定義
- RSS_FEED_URLS: RSSフィードのURL（カンマ区切り）
- DISCORD_WEBHOOK_URL: 記事投稿用Discord WebhookのURL
- ERROR_WEBHOOK_URL: エラー通知用Discord WebhookのURL（省略可、省略時は通常のWebhookを使用）
- S3_BUCKET_NAME: 状態保存用S3バケット名
- S3_STATE_KEY: 状態ファイルのキー名（デフォルト: 'rss-discord-state.json'）

## 技術要件

### 使用言語・フレームワーク
- プログラミング言語: Node.js
- 利用するライブラリ: 最小限の外部依存関係（必要に応じて軽量なXMLパーサーのみ）

### AWS構成
- トリガー: EventBridge (CloudWatch Events)
- 実行間隔: EventBridgeのスケジュール設定に従う
- タイムアウト設定: 10秒（RSS取得に5秒＋余裕をもって設定）
- メモリ割り当て: 512MB

### 状態管理
- 永続化方法: Amazon S3（小さなJSONファイルに最終チェック時刻を保存）
- エラーハンドリング: 基本的なエラー記録とCloudWatch Logsへの出力、一時的なネットワークエラーに対する再試行、重大なエラー発生時はDiscordにエラー内容を通知

## セキュリティ要件
- 認証情報管理: AWS IAMロールベースの権限付与
- 環境変数: Lambda関数に直接設定

## 実装ガイド

### 処理フロー
1. S3から前回チェック時刻を読み込む
2. 環境変数からRSSフィードURLリストを取得
3. 各RSSフィードに対して:
   - フィードを取得してパース
   - 前回チェック時刻より新しい記事をフィルタリング
   - 新着記事をDiscord Webhookに投稿
4. 現在時刻をS3に保存
5. 処理結果をログに記録

### 状態ファイル形式
```json
{
  "lastCheckedAt": "2023-01-01T00:00:00Z",
  "feeds": {
    "https://example.com/feed.xml": "2023-01-01T00:00:00Z"
  }
}
```

### エラー処理戦略
- ネットワークエラー: 1回再試行後、続行不可能な場合はエラーを通知
- パースエラー: ログに記録し、Discord通知後、他のフィードの処理を継続
- S3アクセスエラー: 重大エラーとして処理を中断し通知

### テスト戦略
1. モック化したRSSフィードを用いた単体テスト
2. S3インタラクションのローカルモック
3. Discordへの実際の投稿をテストモードでスキップする仕組み

### サンプルRSSエントリと期待出力
**RSS入力例:**
```xml
  <entry>
    <id>https://crt.sh/?id=263803911#q;yukimochi.jp</id>
    <link rel="alternate" type="text/html" href="https://crt.sh/?id=263803911"/>
    <summary type="html">blog.yukimochi.jp&lt;br&gt;&lt;br&gt;&lt;div style="font:8pt monospace"&gt;-----BEGIN CERTIFICATE-----&lt;br&gt;MIIEVzCCAz+gAwIBAgISAydFtIGqFfygxbQoVmPcujQxMA0GCSqGSIb3DQEBCwUA&lt;br&gt;MEoxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MSMwIQYDVQQD&lt;br&gt;ExpMZXQncyBFbmNyeXB0IEF1dGhvcml0eSBYMzAeFw0xNzExMjUwMjQ2MzZaFw0x&lt;br&gt;ODAyMjMwMjQ2MzZaMBwxGjAYBgNVBAMTEWJsb2cueXVraW1vY2hpLmpwMHYwEAYH&lt;br&gt;KoZIzj0CAQYFK4EEACIDYgAEXXgguAfWvrfeUNnhIwVJsQvXU9PvlN2wAlyAuizf&lt;br&gt;3A5q6bX5vlKdBaJjGrcsA4EXOMOheZpzRqf2YLGWYRHYQvP3RR8zSVKlvfi0Du1w&lt;br&gt;d/5zOu6UIkgqENc8tRGu4CA+o4ICETCCAg0wDgYDVR0PAQH/BAQDAgeAMB0GA1Ud&lt;br&gt;JQQWMBQGCCsGAQUFBwMBBggrBgEFBQcDAjAMBgNVHRMBAf8EAjAAMB0GA1UdDgQW&lt;br&gt;BBRrMmOQ6lTVA/TWZ45M5dAprM+goDAfBgNVHSMEGDAWgBSoSmpjBH3duubRObem&lt;br&gt;RWXv86jsoTBvBggrBgEFBQcBAQRjMGEwLgYIKwYBBQUHMAGGImh0dHA6Ly9vY3Nw&lt;br&gt;LmludC14My5sZXRzZW5jcnlwdC5vcmcwLwYIKwYBBQUHMAKGI2h0dHA6Ly9jZXJ0&lt;br&gt;LmludC14My5sZXRzZW5jcnlwdC5vcmcvMBwGA1UdEQQVMBOCEWJsb2cueXVraW1v&lt;br&gt;Y2hpLmpwMIH+BgNVHSAEgfYwgfMwCAYGZ4EMAQIBMIHmBgsrBgEEAYLfEwEBATCB&lt;br&gt;1jAmBggrBgEFBQcCARYaaHR0cDovL2Nwcy5sZXRzZW5jcnlwdC5vcmcwgasGCCsG&lt;br&gt;AQUFBwICMIGeDIGbVGhpcyBDZXJ0aWZpY2F0ZSBtYXkgb25seSBiZSByZWxpZWQg&lt;br&gt;dXBvbiBieSBSZWx5aW5nIFBhcnRpZXMgYW5kIG9ubHkgaW4gYWNjb3JkYW5jZSB3&lt;br&gt;aXRoIHRoZSBDZXJ0aWZpY2F0ZSBQb2xpY3kgZm91bmQgYXQgaHR0cHM6Ly9sZXRz&lt;br&gt;ZW5jcnlwdC5vcmcvcmVwb3NpdG9yeS8wDQYJKoZIhvcNAQELBQADggEBABgsF+7L&lt;br&gt;MNUJw3zxNwi+BqNVIkIZlqXWykXHi0P/aiq7I9X7S7DEP6UND8fQjLAq5pGVLF9k&lt;br&gt;PcFRtgyXrzxIogw/39+rcLGy8ffAYurbCeQWNRH1Nm65rf73Qns6ViT0twfPt51j&lt;br&gt;r6l18oEHw9X00GN/ksbpedjuC6zOoKnRLCWWQJ2IrKaw+M9VdMwl29h78hYihU8L&lt;br&gt;/hZCA+RRl4JzjHB0P6SavDcvYIbuVbTHdHFwjT9Z6pd/NwxL9FDhsmDhmJ3Gkmw5&lt;br&gt;wRdDTWmK4XB0XwBUNPtAqbYY2rR6trRW51/uKQGTtN0RoSzfnIFkjVPaPgt6nBW3&lt;br&gt;KYgyb65MQ+JsYjs=&lt;br&gt;-----END CERTIFICATE-----&lt;/div&gt;
    </summary>
    <title>[Certificate] Issued by Let's Encrypt Authority X3; Valid from 2017-11-25 to 2018-02-23; Serial number 032745b481aa15fca0c5b4285663dcba3431</title>
    <published>2017-11-25T02:46:36Z</published>
    <updated>2017-11-25T03:50:31Z</updated>
  </entry>
```

**Discord出力例:**
```
[Certificate] Issued by Let's Encrypt Authority X3; Valid from 2017-11-25 to 2018-02-23; Serial number 032745b481aa15fca0c5b4285663dcba3431
https://crt.sh/?id=263803911
投稿日時: 2017-11-25 02:46:36 UTC
```
