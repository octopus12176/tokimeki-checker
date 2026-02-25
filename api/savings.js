// api/savings.js
// 累計節約額・月別内訳の取得、および節約額リセットエンドポイント

import { redis } from './lib/redis.js';
import { getUser } from './lib/session.js';
import { parseRecord } from './lib/utils.js';

// ── ヘルパー関数 ─────────────────────────────────────────────────────────

// 履歴から節約レコード（saved: true かつ価格あり）を月別に集計する
function aggregateByMonth(history) {
  const byMonth = {};
  history
    .filter((h) => h.saved && h.itemPrice > 0)
    .forEach((h) => {
      const d = h.createdAt ? new Date(h.createdAt) : new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + Number(h.itemPrice);
    });

  return Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, amount]) => ({ month, amount }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 認証チェック
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'not authenticated' });

  const historyKey = `history:${user.id}`;
  const savingsKey = `savings:${user.id}`;

  // GET /api/savings → 累計節約額・月別内訳・節約レコード一覧を返す
  if (req.method === 'GET') {
    const [rawHistory, totalSaved] = await Promise.all([
      redis.lrange(historyKey, 0, 99),
      redis.get(savingsKey),
    ]);

    const history = (rawHistory || []).map(parseRecord);
    const monthly = aggregateByMonth(history);
    const savedItems = history
      .filter((h) => h.saved && h.itemPrice > 0)
      .slice(0, 20);

    return res.status(200).json({
      totalSaved: Number(totalSaved) || 0,
      monthly,
      savedItems,
    });
  }

  // DELETE /api/savings → 節約額をリセット（履歴は保持）
  if (req.method === 'DELETE') {
    await redis.set(savingsKey, 0);
    return res.status(200).json({ ok: true, message: '節約額をリセットしました' });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
