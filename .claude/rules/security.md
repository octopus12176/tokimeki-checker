# security.md — セキュリティルール

## 1. API キーの扱い

- API キーは絶対にハードコーディングしない
- 環境変数を通して利用する前提の記述にする
- API キーの console.log は禁止

## 2. OpenAI API

- 外部からの入力は安全に扱い、XSS 対策を行う
- サーバー側（Vercel Functions）で必要に応じ sanitization を行う

## 3. Google OAuth

- redirect URL や scope の勝手な変更を行わない
- トークンを localStorage に保存するコードは生成しない（XSS リスク）
- cookie を利用する場合は HttpOnly が前提

## 4. Redis（Upstash）

- URL や Token は環境変数で扱う
- 個人情報の保存は禁止
- 予測しやすいキャッシュキーを使わない

## 5. フロントエンド関連

- innerHTML の使用は最小限にし、textContent を基本とする
- イベントハンドラを HTML 属性に直接書かない（onclick など）
