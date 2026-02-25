// api/lib/utils.js
// 共通ユーティリティ関数

// Upstash は値を文字列で返す場合があるためパースして統一する
export function parseRecord(raw) {
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}
