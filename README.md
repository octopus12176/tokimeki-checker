# ときめきチェッカー — セットアップ手順

## ファイル構成

```
tokimeki-checker/
├── index.html          # メイン画面（マークアップのみ）
├── css/
│   └── style.css       # 全スタイル
├── js/
│   ├── questions.js    # 質問データ
│   ├── ui.js           # UI描画ヘルパー
│   └── app.js          # 画面制御・メインロジック
├── api/
│   ├── auth.js         # Google OAuth + セッション管理
│   ├── feedback.js     # OpenAI フィードバック生成
│   └── history.js      # 履歴・節約額 CRUD
├── package.json
└── vercel.json
```

---

## 1. Vercel KV を有効にする

Vercel ダッシュボード → プロジェクト → **Storage** タブ → **KV Database を作成**

作成すると以下の環境変数が自動追加されます：

- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

---

## 2. Google OAuth アプリを作成する

1. [Google Cloud Console](https://console.cloud.google.com/) → 新しいプロジェクト作成
2. **APIs & Services → OAuth consent screen** を設定（External）
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: `https://your-app.vercel.app/api/auth?action=callback`
4. **Client ID** と **Client Secret** を控える

---

## 3. Vercel 環境変数を設定する

Vercel ダッシュボード → プロジェクト → **Settings → Environment Variables** に以下を追加：

| 変数名                 | 値                                                                     |
| ---------------------- | ---------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth の Client ID                                              |
| `GOOGLE_CLIENT_SECRET` | Google OAuth の Client Secret                                          |
| `BASE_URL`             | `https://your-app.vercel.app`（末尾スラッシュなし）                    |
| `COOKIE_SECRET`        | ランダムな 32 文字以上の文字列（例：`openssl rand -base64 32` で生成） |
| `OPENAI_API_KEY`       | OpenAI の API キー                                                     |

---

## 4. デプロイ

```bash
# GitHubにプッシュ → Vercel が自動デプロイ
git add .
git commit -m "feat: add auth, savings, db"
git push origin main
```

または Vercel CLI：

```bash
npm i -g vercel
vercel --prod
```

---

## 動作フロー

```
ユーザー → /  → auth チェック（Cookie）
              ├─ 未ログイン → ログイン画面
              └─ ログイン済 → 入力画面
                              ↓
                         6問に回答
                              ↓
                    各回答 → /api/feedback（OpenAI）
                              ↓
                         結果画面
                              ↓
                    「買った／買わなかった」選択
                              ↓
                    /api/history に保存（Vercel KV）
                    節約額を累計加算
```
