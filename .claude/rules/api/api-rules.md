# paths: src/api/**/*.js

## API 仕様

### 認証エンドポイント (`api/auth.js`)
- `GET /api/auth` — セッション確認、ユーザー情報取得
- `GET /api/auth?action=login` — Google OAuth リダイレクト
- `GET /api/auth?action=callback` — トークン交換、セッション生成
- `GET /api/auth?action=logout` — ログアウト、セッション削除

### フィードバックエンドポイント (`api/feedback.js`)
- `POST /api/feedback` — ユーザーの回答と質問テーマをOpenAI GPT-4に渡し、絵文字付き1文フィードバックを返す

### 履歴エンドポイント (`api/history.js`)
- `GET /api/history` — チェック記録を取得
- `POST /api/history` — チェック結果を保存
- `PATCH /api/history` — 購入判断の更新と節約額加算

### 節約エンドポイント (`api/savings.js`)
- `GET /api/savings` — 節約累計額、月別内訳、節約アイテム一覧を返す

## セッション管理
- `api/lib/session.js` — HMAC-SHA256署名クッキーによるセッション管理
- 全保護エンドポイントで`requireAuth()`ヘルパーを使用

## 購買チェックの流れ
1. 商品名と価格を入力
2. 6問を1問ずつ表示。各回答を`/api/feedback`にPOSTしてAIフィードバックを取得
3. 回答スコアの合計を0〜100に正規化し、`buy` / `wait` / `skip`の判定を出す
4. 結果を`/api/history`に保存。その後、実際の購入判断をユーザーが記録
5. 見送り（saved=true）かつ価格 > 0の場合、Redis内の節約額を加算

## スコア計算
- 6問それぞれに-3〜+3のスコアを持つ選択肢が4〜5個ある
- 回答スコアの合計を正規化して0〜100にする
- 判定の閾値は`app.js`内に定義されている
