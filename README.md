# hana-info-checker

花澤香菜公式サイト (https://hana.b-rave.tokyo/news/) のニュースを定期的にチェックし、新しいニュースがあればSlackに通知するツールです。

## 機能

- Playwrightを使用してニュースページをスクレイピング
- 新しいニュースを検出してSlack Webhookで通知
- GitHub Actionsのcronで定期実行（1日4回）
- ニュースデータはリポジトリに保存され、自動でコミット・プッシュ

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
npx playwright install chromium
```

### 2. Slack Webhook URLの設定

GitHub リポジトリの Settings > Secrets and variables > Actions で以下のシークレットを追加:

- `SLACK_WEBHOOK_URL`: Slack Incoming Webhook URL

### 3. 手動実行

```bash
# 通常実行（Slack通知あり）
npm run check

# テスト実行（Slack通知なし）
npm run test
```

## GitHub Actions

ワークフローは以下のスケジュールで自動実行されます:

- 毎日 9:00, 12:00, 18:00, 21:00（日本時間）

Actions タブから手動で実行することも可能です。

## ファイル構成

```
├── src/
│   └── index.js      # メインスクリプト
├── data/
│   └── news.json     # ニュースデータ（自動更新）
├── .github/
│   └── workflows/
│       └── check-news.yml  # GitHub Actions設定
├── package.json
└── README.md
```

## 注意事項

- サイトのHTML構造が変更された場合、スクレイピングが正常に動作しない可能性があります
- 初回実行時は既存のニュースすべてが「新着」として検出されます
