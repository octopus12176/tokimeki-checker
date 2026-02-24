// api/lib/session.js
// セッション管理に関するユーティリティ
// auth.js / history.js / savings.js / feedback.js から共通利用する

import { redis } from './redis.js';
import { serialize, parse } from 'cookie';
import crypto from 'crypto';

// ── 定数 ─────────────────────────────────────────────────────────────────────

export const COOKIE_NAME = 'tkm_session';
export const SESSION_TTL = 60 * 60 * 24 * 7; // 7日（秒）

// ── 署名ユーティリティ ────────────────────────────────────────────────────────

// セッションIDに HMAC-SHA256 署名を付与して返す
export function sign(value) {
  return (
    value +
    '.' +
    crypto
      .createHmac('sha256', process.env.COOKIE_SECRET)
      .update(value)
      .digest('base64url')
  );
}

// 署名付き文字列を検証し、元のセッションIDを返す（改ざん時は null）
export function unsign(signed) {
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  if (sign(value) !== signed) return null;
  return value;
}

// Set-Cookie ヘッダー用の文字列を生成する
// ログアウト時は maxAge に -1 を渡してクッキーを削除する
export function sessionCookie(sessionId, maxAge = SESSION_TTL) {
  return serialize(COOKIE_NAME, sign(sessionId), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

// ── ユーザー取得 ──────────────────────────────────────────────────────────────

// リクエストのクッキーを検証し、Redis からユーザー情報を取得する
// 未認証・署名不正・セッション期限切れのいずれでも null を返す
export async function getUser(req) {
  const cookies = parse(req.headers.cookie || '');
  const signed = cookies[COOKIE_NAME];
  if (!signed) return null;
  const sessionId = unsign(signed);
  if (!sessionId) return null;
  return redis.get(`session:${sessionId}`);
}
