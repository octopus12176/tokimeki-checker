// api/history.js
import { redis } from './lib/redis.js';
import { parse } from 'cookie';
import crypto from 'crypto';

const COOKIE_NAME   = 'tkm_session';
const COOKIE_SECRET = process.env.COOKIE_SECRET;

function unsign(signed) {
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const expected = value + '.' + crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('base64url');
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'not authenticated' });

  const historyKey = `history:${user.id}`;
  const savingsKey = `savings:${user.id}`;

  // ── GET: return history list + total savings ──
  if (req.method === 'GET') {
    const [history, totalSaved] = await Promise.all([
      redis.lrange(historyKey, 0, 99),   // latest 100 records
      redis.get(savingsKey),
    ]);
    return res.status(200).json({
      history:    (history || []).map(h => typeof h === 'string' ? JSON.parse(h) : h),
      totalSaved: totalSaved || 0,
    });
  }

  // ── POST: save a new check result ──
  if (req.method === 'POST') {
    const { itemName, itemPrice, type, verdict, score, saved, date } = req.body;

    const record = {
      id:        crypto.randomUUID(),
      itemName:  itemName  || '不明',
      itemPrice: itemPrice || 0,
      type:      type      || 'wait',
      verdict:   verdict   || '',
      score:     score     || 0,
      saved:     !!saved,
      date:      date      || new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      createdAt: Date.now(),
    };

    // Prepend to list (newest first), cap at 100
    await redis.lpush(historyKey, JSON.stringify(record));
    await redis.ltrim(historyKey, 0, 99);

    // Accumulate savings
    if (saved && itemPrice > 0) {
      await redis.incrbyfloat(savingsKey, Number(itemPrice));
    }

    return res.status(201).json({ ok: true, record });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
