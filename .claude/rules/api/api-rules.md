# paths: src/api/*.js

## ベストプラクティス

- 外部 API 呼び出しのロジックは `/api/` にまとめる
- fetch のラップ関数などは役割ごとに整理する
- エラーハンドリングは必ず入れる

## 禁止事項

- API キーやシークレットのハードコーディング
- 認証フロー（Google OAuth）の勝手な変更
- OpenAI の prompt や system 設定を無断変更

## コメント

- 日本語で「なぜその処理が必要か」を書く

---

## API 仕様

### 認証エンドポイント (`api/auth.js`)

- `GET /api/auth` — セッション確認、ユーザー情報取得
- `GET /api/auth?action=login` — Google OAuth リダイレクト
- `GET /api/auth?action=callback` — トークン交換、セッション生成
- `GET /api/auth?action=logout` — ログアウト、セッション削除

### フィードバックエンドポイント (`api/feedback.js`)

- `POST /api/feedback` — ユーザーの回答と質問テーマを OpenAI GPT-4 に渡し、絵文字付き 1 文フィードバックを返す

### 履歴エンドポイント (`api/history.js`)

- `GET /api/history` — チェック記録を取得
- `POST /api/history` — チェック結果を保存
- `PATCH /api/history` — 購入判断の更新と節約額加算

### 節約エンドポイント (`api/savings.js`)

- `GET /api/savings` — 節約累計額、月別内訳、節約アイテム一覧を返す

## セッション管理

- `api/lib/session.js` — HMAC-SHA256 署名クッキーによるセッション管理
- 全保護エンドポイントで`requireAuth()`ヘルパーを使用

## 購買チェックの流れ

1. 商品名と価格を入力
2. 6 問を 1 問ずつ表示。各回答を`/api/feedback`に POST して AI フィードバックを取得
3. 回答スコアの合計を 0〜100 に正規化し、`buy` / `wait` / `skip`の判定を出す
4. 結果を`/api/history`に保存。その後、実際の購入判断をユーザーが記録
5. 見送り（saved=true）かつ価格 > 0 の場合、Redis 内の節約額を加算

## スコア計算

- 6 問それぞれに-3〜+3 のスコアを持つ選択肢が 4〜5 個ある
- 回答スコアの合計を正規化して 0〜100 にする
- 判定の閾値は`app.js`内に定義されている
