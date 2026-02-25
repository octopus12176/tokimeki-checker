// api/history.js
// チェック履歴の保存・取得・購入決定の更新エンドポイント

import { redis } from './lib/redis.js';
import { getUser } from './lib/session.js';
import { parseRecord } from './lib/utils.js';
import crypto from 'crypto';

// ── ヘルパー関数 ─────────────────────────────────────────────────────────

// チェック結果レコードを生成する
function createRecord(id, itemName, itemPrice, type, verdict, score, saved, date) {
  return {
    id: id || crypto.randomUUID(),
    itemName: itemName || '不明',
    itemPrice: itemPrice || 0,
    type: type || 'wait',
    verdict: verdict || '',
    score: score || 0,
    saved: saved !== undefined ? saved : null,
    date: date || new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
    createdAt: Date.now(),
  };
}

// 履歴リストから指定 ID のレコードを検索する
async function findRecordById(historyKey, recordId) {
  const rawList = await redis.lrange(historyKey, 0, -1);
  for (let i = 0; i < rawList.length; i++) {
    const record = parseRecord(rawList[i]);
    if (record.id === recordId) {
      return { index: i, record };
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 認証チェック
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'not authenticated' });

  const historyKey = `history:${user.id}`;
  const savingsKey = `savings:${user.id}`;

  // GET /api/history → 履歴リストと累計節約額を返す
  if (req.method === 'GET') {
    const [rawHistory, totalSaved] = await Promise.all([
      redis.lrange(historyKey, 0, 99), // 最新100件
      redis.get(savingsKey),
    ]);
    return res.status(200).json({
      history:    (rawHistory || []).map(parseRecord),
      totalSaved: totalSaved || 0,
    });
  }

  // POST /api/history → 新しいチェック結果を履歴に追加する
  // saved: null = 未決定 / true = 見送り（節約）/ false = 購入
  if (req.method === 'POST') {
    const { id, itemName, itemPrice, type, verdict, score, saved, date } = req.body;
    const record = createRecord(id, itemName, itemPrice, type, verdict, score, saved, date);

    await redis.lpush(historyKey, JSON.stringify(record));
    await redis.ltrim(historyKey, 0, 99);

    if (saved === true && itemPrice > 0) {
      await redis.incrbyfloat(savingsKey, Number(itemPrice));
    }

    return res.status(201).json({ ok: true, record });
  }

  // PATCH /api/history → 未決定レコードの購入・見送りを後から更新する
  if (req.method === 'PATCH') {
    const { id, saved } = req.body;
    if (!id || saved === undefined || saved === null) {
      return res.status(400).json({ error: 'id と saved (true/false) が必要です' });
    }

    const result = await findRecordById(historyKey, id);
    if (!result) return res.status(404).json({ error: 'レコードが見つかりません' });

    const { index: foundIndex, record } = result;
    if (record.saved !== null && record.saved !== undefined) {
      return res.status(400).json({ error: '既に決定済みです' });
    }

    record.saved = saved;
    await redis.lset(historyKey, foundIndex, JSON.stringify(record));

    if (saved && record.itemPrice > 0) {
      await redis.incrbyfloat(savingsKey, Number(record.itemPrice));
    }

    return res.status(200).json({ ok: true, record });
  }

  // DELETE /api/history → 履歴レコードを削除する
  // ?id=xxx がある場合は指定IDのレコードのみ削除、ない場合は全履歴を削除
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (id) {
      // 個別削除：指定 ID のレコードを削除
      const result = await findRecordById(historyKey, id);
      if (!result) return res.status(404).json({ error: 'レコードが見つかりません' });

      // 全件取得して対象以外を再構築
      const rawList = await redis.lrange(historyKey, 0, -1);
      const filteredList = rawList.filter((item) => {
        const record = parseRecord(item);
        return record.id !== id;
      });

      // 削除して再度 rpush で再構築
      await redis.del(historyKey);
      if (filteredList.length > 0) {
        await redis.rpush(historyKey, ...filteredList);
      }

      return res.status(200).json({ ok: true, message: 'レコードを削除しました' });
    } else {
      // 全削除：全履歴を削除
      await redis.del(historyKey);
      return res.status(200).json({ ok: true, message: '全履歴を削除しました' });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
}
