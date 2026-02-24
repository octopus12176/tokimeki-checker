// api/savings.js
// 節約額の集計・月別内訳・リセット専用エンドポイント
import { redis } from './lib/redis.js';
import { parse } from 'cookie';
import crypto from 'crypto';

const COOKIE_NAME   = 'tkm_session';
const COOKIE_SECRET = process.env.COOKIE_SECRET;

function unsign(signed) {
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const expected = value + '.' + crypto
    .createHmac('sha256', COOKIE_SECRET)
    .update(value)
    .digest('base64url');
  if (expected !== signed) return null;
  return value;
}

async function getUser(req) {
  const cookies   = parse(req.headers.cookie || '');
  const signed    = cookies[COOKIE_NAME];
  if (!signed) return null;
  const sessionId = unsign(signed);
  if (!sessionId) return null;
  return redis.get(`session:${sessionId}`);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'not authenticated' });

  const historyKey = `history:${user.id}`;
  const savingsKey = `savings:${user.id}`;

  // ── GET /api/savings
  // 累計節約額 + 月別内訳を返す
  if (req.method === 'GET') {
    const [rawHistory, totalSaved] = await Promise.all([
      redis.lrange(historyKey, 0, 99),
      redis.get(savingsKey),
    ]);

    const history = (rawHistory || []).map(h =>
      typeof h === 'string' ? JSON.parse(h) : h
    );

    // 月別集計
    const byMonth = {};
    history
      .filter(h => h.saved && h.itemPrice > 0)
      .forEach(h => {
        // createdAt があればそれを使い、なければ date 文字列から推測
        const d = h.createdAt
          ? new Date(h.createdAt)
          : new Date();                       // fallback
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth[key] = (byMonth[key] || 0) + Number(h.itemPrice);
      });

    // 月別を新しい順にソート
    const monthly = Object.entries(byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, amount]) => ({ month, amount }));

    // 節約レコードのみ抽出（最新20件）
    const savedItems = history
      .filter(h => h.saved && h.itemPrice > 0)
      .slice(0, 20);

    return res.status(200).json({
      totalSaved: Number(totalSaved) || 0,
      monthly,
      savedItems,
    });
  }

  // ── DELETE /api/savings
  // 節約額のみリセット（履歴は残す）
  if (req.method === 'DELETE') {
    await redis.set(savingsKey, 0);
    return res.status(200).json({ ok: true, message: '節約額をリセットしました' });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
