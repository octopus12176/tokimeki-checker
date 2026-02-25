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
  BASE_URL,
} = process.env;

const REDIRECT_URI = `${BASE_URL}/api/auth?action=callback`;

// ── ヘルパー関数 ─────────────────────────────────────────────────────────

// 認可コードをアクセストークンに交換する
async function exchangeTokens(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await response.json();
  if (!response.ok) throw new Error('Token exchange failed');
  return tokens;
}

// アクセストークンでユーザープロフィールを取得する
async function fetchUserProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return await response.json();
}

// ホワイトリストを確認する（許可メールが設定されている場合のみ）
function validateAllowedEmail(email) {
  const allowed = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true; // ホワイトリスト未設定なら全員許可
  return allowed.includes(email.toLowerCase());
}

// セッションを Redis に保存する
async function saveSession(userProfile) {
  const user = {
    id: userProfile.sub,
    name: userProfile.name,
    email: userProfile.email,
    picture: userProfile.picture,
  };
  const sessionId = crypto.randomUUID();
  await redis.set(`session:${sessionId}`, user, { ex: SESSION_TTL });
  return sessionId;
}

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
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
    });
    return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }

  // GET /api/auth?action=callback → 認可コードをトークンに交換してセッションを保存
  if (action === 'callback') {
    const { code, error } = req.query;
    if (error || !code) return res.redirect(302, '/?error=oauth_denied');

    try {
      const tokens = await exchangeTokens(code);
      const profile = await fetchUserProfile(tokens.access_token);

      if (!validateAllowedEmail(profile.email)) {
        return res.redirect(302, '/?error=unauthorized');
      }

      const sessionId = await saveSession(profile);
      res.setHeader('Set-Cookie', sessionCookie(sessionId));
      return res.redirect(302, '/');
    } catch (err) {
      console.error('OAuth callback error:', err);
      if (err.message.includes('Token exchange')) {
        return res.redirect(302, '/?error=token_exchange');
      }
      return res.redirect(302, '/?error=session_failed');
    }
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
