# Redisデータモデル

## キー設計
Redis上で以下のキーパターンを使用：

### セッション
- `session:{sessionId}` → ユーザー情報JSONオブジェクト（TTL: 7日）
  - ユーザーのログイン状態と基本情報を保持

### 履歴
- `history:{userId}` → チェック記録JSONのRedisリスト（最大100件）
  - 各チェック結果（商品名、価格、スコア、判定、フィードバック等）を保存

### 節約額
- `savings:{userId}` → 以下の構造を持つJSON
  ```json
  {
    "total": <累計節約額>,
    "monthly": {
      "YYYY-MM": <月別節約額>,
      ...
    },
    "items": [
      { "name": <商品名>, "price": <価格>, "date": <日付> },
      ...
    ]
  }
  ```

## アクセスパターン
- ユーザーが見送り（saved=true）かつ価格 > 0の場合、Redis内の節約額を加算
- 節約API（`api/savings.js`）で累計額、月別内訳、節約アイテム一覧を取得
