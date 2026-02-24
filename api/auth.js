// api/auth.js
// Google OAuth 2.0 flow + session via signed cookie (Vercel KV)
import { kv } from '@vercel/kv';
import { serialize, parse } from 'cookie';
import crypto from 'crypto';

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  BASE_URL,           // e.g. https://your-app.vercel.app
  COOKIE_SECRET,      // random 32+ char string, set in Vercel env vars
} = process.env;

const REDIRECT_URI  = `${BASE_URL}/api/auth?action=callback`;
const COOKIE_NAME   = 'tkm_session';
const SESSION_TTL   = 60 * 60 * 24 * 7; // 7 days (seconds)

// ── Helpers ──────────────────────────────────────────────────────────────
function sign(value) {
  return value + '.' + crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('base64url');
}

function unsign(signed) {
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  if (sign(value) !== signed) return null;
  return value;
}

function sessionCookie(sessionId, maxAge = SESSION_TTL) {
  return serialize(COOKIE_NAME, sign(sessionId), {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge,
  });
}

// ── Handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const { action } = req.query;

  // ── GET /api/auth  → return current user or 401 ──
  if (req.method === 'GET' && !action) {
    const cookies   = parse(req.headers.cookie || '');
    const signed    = cookies[COOKIE_NAME];
    if (!signed) return res.status(401).json({ error: 'not authenticated' });

    const sessionId = unsign(signed);
    if (!sessionId) return res.status(401).json({ error: 'invalid session' });

    const user = await kv.get(`session:${sessionId}`);
    if (!user)  return res.status(401).json({ error: 'session expired' });

    return res.status(200).json(user);
  }

  // ── GET /api/auth?action=login  → redirect to Google ──
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

  // ── GET /api/auth?action=callback  → exchange code, set session ──
  if (action === 'callback') {
    const { code, error } = req.query;
    if (error || !code) return res.redirect(302, '/?error=oauth_denied');

    // Exchange code for tokens
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

    // Fetch user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();

    const user = {
      id:      profile.sub,
      name:    profile.name,
      email:   profile.email,
      picture: profile.picture,
    };

    // Store session in KV
    const sessionId = crypto.randomUUID();
    await kv.set(`session:${sessionId}`, user, { ex: SESSION_TTL });

    res.setHeader('Set-Cookie', sessionCookie(sessionId));
    return res.redirect(302, '/');
  }

  // ── GET /api/auth?action=logout ──
  if (action === 'logout') {
    const cookies   = parse(req.headers.cookie || '');
    const signed    = cookies[COOKIE_NAME];
    const sessionId = signed ? unsign(signed) : null;
    if (sessionId) await kv.del(`session:${sessionId}`);

    res.setHeader('Set-Cookie', sessionCookie('', -1));
    return res.redirect(302, '/');
  }

  return res.status(404).json({ error: 'not found' });
}
