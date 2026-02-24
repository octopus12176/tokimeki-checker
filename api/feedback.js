// api/feedback.js
import { kv } from '@vercel/kv';
import { parse } from 'cookie';
import crypto from 'crypto';

const COOKIE_NAME = 'tkm_session';
const COOKIE_SECRET = process.env.COOKIE_SECRET;

function unsign(signed) {
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const expected =
    value +
    '.' +
    crypto
      .createHmac('sha256', COOKIE_SECRET)
      .update(value)
      .digest('base64url');
  if (expected !== signed) return null;
  return value;
}

async function getUser(req) {
  const cookies = parse(req.headers.cookie || '');
  const signed = cookies[COOKIE_NAME];
  if (!signed) return null;
  const sessionId = unsign(signed);
  if (!sessionId) return null;
  return kv.get(`session:${sessionId}`);
}

const THEME_INSTRUCTIONS = {
  tokimeki: 'ときめきや感情的な価値について共感を込めてコメントしてください。',
  mise: '見栄や承認欲求について、批判せず優しく本音に気づかせるコメントをしてください。',
  hitsuyou: '必要性や購入目的の明確さについてコメントしてください。',
  tsukauka: '実際に使い続けるかどうかの現実的な視点でコメントしてください。',
  daigae:
    '代替手段（図書館・中古・サブスクなど）の可能性を踏まえてコメントしてください。',
  shihonshugi:
    '消費文化・広告・資本主義への批判的視点を持ちながら、押しつけがましくなくコメントしてください。',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'method not allowed' });

  // Auth guard
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'not authenticated' });

  const {
    itemName,
    itemPrice,
    questionText,
    answerText,
    answerScore,
    questionIndex,
    questionTheme,
  } = req.body;
  if (!itemName || !questionText || !answerText) {
    return res.status(400).json({ error: 'missing required fields' });
  }

  const priceText = itemPrice
    ? `（価格：¥${Number(itemPrice).toLocaleString()}）`
    : '';
  const scoreLabel =
    answerScore >= 2
      ? 'ポジティブな回答'
      : answerScore <= -2
      ? 'ネガティブな回答'
      : '中立的な回答';
  const themeGuide = THEME_INSTRUCTIONS[questionTheme] || '';

  const prompt = `あなたは批評眼のある節約アドバイザーです。ユーザーが「${itemName}${priceText}」の購入を検討しています。

質問テーマ：${questionTheme}
質問（${questionIndex + 1}/6）：${questionText}
ユーザーの回答：「${answerText}」（${scoreLabel}）

${themeGuide}

ルール：
・20〜40文字程度の短い日本語フィードバックを1文だけ返す
・文頭に絵文字を1つだけ使う
・ポジティブな回答 → 背中を押すコメント
・ネガティブな回答 → 優しく、でも鋭く気づきを促すコメント
・中立的な回答 → バランスの取れた問いかけ
・口語で自然に終わること（「ね」「よ」「！」など）
・説教臭くならないこと
フィードバック文のみ返してください。`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.75,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('OpenAI error:', err);
      return res.status(502).json({ error: 'OpenAI API error' });
    }

    const data = await response.json();
    const feedback = data.choices[0].message.content.trim();
    return res.status(200).json({ feedback });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
}
