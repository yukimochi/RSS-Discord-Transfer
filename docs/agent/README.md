# Agent Documentation

このディレクトリには、AI Agent向けの開発指示とプロジェクト仕様書が含まれています。

## ファイル一覧

### 📋 [specification.md](./specification.md)
**プロジェクト仕様書**
- Agent向けの開発ルール
- 機能要件の詳細
- 環境変数定義
- 技術要件

### 📝 [implementation-plan.md](./implementation-plan.md)
**実装計画書**
- 詳細なタスクリスト
- 実装順序の推奨
- 技術的考慮事項
- 見積もり時間

## Agent向け重要ルール

1. **言語使用規則**
   - Agent-ユーザー間の対話: 日本語
   - コード内コメント・テスト: 英語

2. **開発環境**
   - OS: Windows
   - Shell: PowerShell
   - テストURL: example.com ドメインのみ使用

3. **品質管理**
   - 毎回のファイル編集後にlint実行
   - テスト駆動開発の徹底
   - コンパイルエラー・警告の即座修正

## プロジェクト概要

RSS フィードから新着記事を取得し、Discord Webhook で通知するAWS Lambda関数の開発プロジェクトです。

### 主要技術
- TypeScript + Node.js
- AWS Lambda
- AWS S3 (状態管理)
- EventBridge (スケジュール実行)

### 開発状況
**実装完了率: 94% (16/17タスク)**

**✅ 完了済み:**
- すべてのコア機能実装
- 包括的なテストスイート（29テスト）
- ビルド・デプロイスクリプト
- ローカルテスト環境

**🔄 残作業:**
- IAM設定ガイド
- 運用ドキュメント

詳細な進捗状況は [implementation-plan.md](./implementation-plan.md) のタスクリストを参照してください。

---

*このドキュメントは Agent が効率的に開発を進められるよう構成されています。*
