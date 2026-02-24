# コードスタイル

## 関数・コード構造

- **単一関数は 50 行を超えないこと**。超える場合は分割する
- **複雑なロジックは小さな関数に分割**し、各関数が1つの責務を持つようにする
- **早期 return** を使用して、ネストを減らす
- **ネストされた三項演算子は避ける**。代わりに `if/else` または変数を使用する

## 変数・定数宣言

- **`const` を優先**。再割り当てが必要な場合のみ `let` を使用
- **`var` は使用しない**
- **定数は `UPPER_SNAKE_CASE`**（モジュール最上部）
  ```javascript
  const MAX_HISTORY = 100;
  const API_TIMEOUT = 5000;
  ```
- **変数・関数は `camelCase`**

## セミコロン・フォーマット

- **セミコロンは必須**
- **インデント：2スペース**
- **ファイルは改行で終了**

## 等価演算子・型チェック

- **`===` と `!==` のみ使用**。`==` と `!=` は避ける
- 型が不確実な場合は `typeof` で明示的にチェック
  ```javascript
  if (typeof value === 'string') { ... }
  ```

## 非同期処理

- **`async/await` を優先**
- **`.then()` チェーンは避ける**
- **すべての API 呼び出しに try-catch を含める**
  ```javascript
  try {
    const res = await fetch('/api/endpoint');
    if (!res.ok) return; // または throw new Error(...)
    const data = await res.json();
    // ...
  } catch (e) {
    console.error('Operation failed:', e);
    // ユーザーへのエラー表示を含める
  }
  ```
- **API 呼び出し時は loading 状態を管理**

## 文字列

- **テンプレートリテラルを使用**
  ```javascript
  const message = `Item: ${name}, Price: ¥${price}`;
  ```
- **シングルクォート（`'`）推奨**（避けられない場合はダブルクォート）

## オブジェクト・配列

- **スプレッド演算子を使用**
  ```javascript
  const newObj = { ...obj, newKey: value };
  const newArr = [...arr, newItem];
  ```
- **短縮プロパティ構文を使用**
  ```javascript
  const user = { id, name, email }; // id: id, name: name, ... ではなく
  ```
- **配列操作は `.map()`, `.filter()`, `.reduce()` を優先**
  ```javascript
  const doubled = numbers.map(n => n * 2);
  const filtered = items.filter(item => item.active);
  ```

## リストレンダリング

- **key 属性を付与し、`index` ではなく ID を使用**（フレームワークを使用しないバニラ JS でもデータオブジェクトの ID を参照する）
- **可変な配列の操作時は index 以外を識別子にする**

## コメント

- **意図が明確でない複雑なロジックのみコメントを付ける**
- **コードで説明できることはコメントしない**
- **日本語コメント可**

## グローバル変数・スコープ

- **グローバル変数を避ける**
- **IIFE パターン（`const Module = (() => { ... })()`）で状態をカプセル化**
- **必要に応じて `export` / `import` でモジュール化**

## エラーハンドリング

- **予測可能なエラーには具体的な処理を用意**
  ```javascript
  if (!response.ok) {
    if (response.status === 401) {
      // 認証エラー処理
    } else if (response.status === 400) {
      // バリデーションエラー処理
    }
  }
  ```
- **ユーザーに対して有用なエラーメッセージを表示**
- **開発用エラーログは `console.error()` で記録**

## オブジェクト分割代入

- **ネストされた分割代入は避け、分かりやすさを優先**
  ```javascript
  // Good
  const { user, history } = data;
  const { id, name } = user;

  // Avoid (ネストが深い)
  const { user: { profile: { id, name } } } = data;
  ```

## ループ・反復処理

- **`.map()`, `.filter()` 等の関数型メソッドを優先**
- **パフォーマンスが重要な場合は `for` ループを使用する**
  ```javascript
  // 大規模データ処理の場合
  for (let i = 0; i < largeArray.length; i++) {
    // ...
  }
  ```
