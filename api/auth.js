// api/auth.js
// Google OAuth 2.0 認証フロー
// ログイン・コールバック・ログアウト・セッション確認の4アクションを処理する

import { redis } from './lib/redis.js';
import { parse } from 'cookie';
import crypto from 'crypto';
import {
  COOKIE_NAME,
  SESSION_TTL,
  unsign,
  sessionCookie,
  getUser,
} from './lib/session.js';

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  BASE_URL, // 例: https://your-app.vercel.app
} = process.env;

// Google に登録したリダイレクト URI（末尾のクエリも含めて完全一致が必要）
const REDIRECT_URI = `${BASE_URL}/api/auth?action=callback`;

export default async function handler(req, res) {
  const { action } = req.query;

  // GET /api/auth → ログイン中のユーザー情報を返す（未認証なら 401）
  if (req.method === 'GET' && !action) {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'not authenticated' });
    return res.status(200).json(user);
  }

  // GET /api/auth?action=login → Google 認証画面へリダイレクト
  if (action === 'login') {
    const params = new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      response_type: 'code',
      scope:         'openid email profile',
      access_type:   'online',
      prompt:        'select_account',
    });
    return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }

  // GET /api/auth?action=callback → 認可コードをトークンに交換してセッションを保存
  if (action === 'callback') {
    const { code, error } = req.query;
    if (error || !code) return res.redirect(302, '/?error=oauth_denied');

    // 認可コードをアクセストークンに交換
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) return res.redirect(302, '/?error=token_exchange');

    // アクセストークンでユーザー情報を取得
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();

    // ALLOWED_EMAILS が設定されている場合はホワイトリスト照合（空なら全員許可）
    const ALLOWED = (process.env.ALLOWED_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (ALLOWED.length > 0 && !ALLOWED.includes(profile.email.toLowerCase())) {
      return res.redirect(302, '/?error=unauthorized');
    }

    const user = {
      id:      profile.sub,
      name:    profile.name,
      email:   profile.email,
      picture: profile.picture,
    };

    // セッションを Redis に保存して署名付きクッキーをセット
    const sessionId = crypto.randomUUID();
    try {
      await redis.set(`session:${sessionId}`, user, { ex: SESSION_TTL });
    } catch (err) {
      console.error('Redis セッション書き込み失敗:', err);
      return res.redirect(302, '/?error=session_failed');
    }

    res.setHeader('Set-Cookie', sessionCookie(sessionId));
    return res.redirect(302, '/');
  }

  // GET /api/auth?action=logout → Redis のセッションを削除してクッキーを無効化
  if (action === 'logout') {
    const cookies = parse(req.headers.cookie || '');
    const signed = cookies[COOKIE_NAME];
    const sessionId = signed ? unsign(signed) : null;
    if (sessionId) await redis.del(`session:${sessionId}`);

    res.setHeader('Set-Cookie', sessionCookie('', -1));
    return res.redirect(302, '/');
  }

  return res.status(404).json({ error: 'not found' });
}
