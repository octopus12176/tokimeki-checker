# アーキテクチャ

## スタック
バニラJS フロントエンド + Vercel サーバーレス関数 (Node.js) + Upstash Redis + Google OAuth + OpenAI API

## フロントエンド（フレームワークなし）
- `index.html` — 全画面を非表示の`<div>`として定義したシングルページアプリ
- `js/app.js` — 状態管理、認証フロー、質問の進行制御、APIコール。`const App = (() => {...})()`パターンで実装
- `js/ui.js` — 画面切り替え、DOMレンダリング（タイムライン・履歴・節約モーダル）
- `js/questions.js` — 6問の質問定義（選択肢・スコア -3〜+3・AIプロンプトテーマ）
- `css/style.css` — CSSカスタムプロパティベースのデザインシステム

画面切り替えはCSSのshow/hideで行い、現在の画面状態は`app.js`内の`state`オブジェクトで管理する。

## API（Vercel サーバーレス関数）
- `api/auth.js` — Google OAuth 2.0フロー: `/api/auth`（セッション確認）、`?action=login`（リダイレクト）、`?action=callback`（トークン交換・セッション生成）、`?action=logout`
- `api/feedback.js` — POST: ユーザーの回答と質問テーマをOpenAI GPT-4に渡し、絵文字付き1文フィードバックを返す
- `api/history.js` — GET（履歴取得）、POST（チェック結果保存）、PATCH（購入判断の更新と節約額加算）
- `api/savings.js` — GET: 節約累計額・月別内訳・節約アイテム一覧を返す
- `api/lib/redis.js` — Upstash Redisシングルトン
- `api/lib/session.js` — HMAC-SHA256署名クッキーによるセッション管理。全保護エンドポイントで`requireAuth()`ヘルパーを使用
