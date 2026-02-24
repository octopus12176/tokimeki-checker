// api/lib/redis.js
// Upstash Redis クライアントのシングルトン
// KV_REST_API_URL / KV_REST_API_TOKEN は Vercel の環境変数から自動的に読み込まれる

import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});
