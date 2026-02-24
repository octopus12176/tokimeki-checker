# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) へのガイダンスを提供します。

## プロジェクト概要

「ときめきチェッカー」— 購買判断を支援するWebアプリ。ユーザーが購入を検討している商品について6つの質問に答え、AI生成のフィードバックを受け取り、購入を見送ることで節約できた金額を記録する。

## 開発・デプロイ

ビルド・リント・テストスクリプトは存在しない。ファイルをそのままVercelにデプロイするため、コンパイル工程はない。

**ローカル開発:**
```bash
npm install
vercel dev   # サーバーレス関数と静的ファイルをローカルで起動
```

**デプロイ:**
```bash
vercel       # プレビューデプロイ
vercel --prod  # 本番デプロイ
```

**必須環境変数**（Vercelダッシュボード、またはローカルは`.env.local`に設定）:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth認証情報
- `BASE_URL` — 例: `https://your-app.vercel.app`
- `COOKIE_SECRET` — クッキー署名用の32文字以上のランダム文字列
- `OPENAI_API_KEY` — GPT-4フィードバック生成用
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` — Upstash Redis接続情報
- `ALLOWED_EMAILS`（任意） — アクセスを許可するメールアドレスのカンマ区切りリスト

## 詳細ガイド

詳細な実装ガイドラインは`.claude/rules/`配下のファイルを参照してください。

- **アーキテクチャ概要** → `rules/architecture.md`
- **フロントエンド実装** → `rules/frontend.md`
- **API仕様・データフロー** → `rules/api/api-rules.md`
- **Redisデータモデル** → `rules/database.md`
- **コードスタイル** → `rules/code-style.md`
- **CSSガイドライン** → `rules/css.md`
- **HTMLガイドライン** → `rules/html.md`
