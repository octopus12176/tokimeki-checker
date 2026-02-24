// api/history.js
// チェック履歴の保存・取得・購入決定の更新エンドポイント

import { redis } from './lib/redis.js';
import { getUser } from './lib/session.js';
import crypto from 'crypto';

// Upstash は値を文字列で返す場合があるためパースして統一する
function parseRecord(raw) {
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
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

    const record = {
      id:        id || crypto.randomUUID(),
      itemName:  itemName  || '不明',
      itemPrice: itemPrice || 0,
      type:      type      || 'wait',
      verdict:   verdict   || '',
      score:     score     || 0,
      saved:     saved !== undefined ? saved : null,
      date:      date || new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      createdAt: Date.now(),
    };

    // 先頭に追加（新着順）して最大100件に制限
    await redis.lpush(historyKey, JSON.stringify(record));
    await redis.ltrim(historyKey, 0, 99);

    // 明示的に見送り（saved: true）かつ価格ありの場合のみ節約額を加算
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

    // 対象レコードを線形検索して index を特定する
    const rawList = await redis.lrange(historyKey, 0, -1);
    let foundIndex = -1;
    let record = null;

    for (let i = 0; i < rawList.length; i++) {
      const r = parseRecord(rawList[i]);
      if (r.id === id) {
        if (r.saved !== null && r.saved !== undefined) {
          return res.status(400).json({ error: '既に決定済みです' });
        }
        foundIndex = i;
        record = r;
        break;
      }
    }

    if (!record) return res.status(404).json({ error: 'レコードが見つかりません' });

    // Redis リストの該当位置を直接更新する
    record.saved = saved;
    await redis.lset(historyKey, foundIndex, JSON.stringify(record));

    // 見送り（saved: true）かつ価格ありの場合に節約額を加算
    if (saved && record.itemPrice > 0) {
      await redis.incrbyfloat(savingsKey, Number(record.itemPrice));
    }

    return res.status(200).json({ ok: true, record });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
