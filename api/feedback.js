// api/feedback.js
// 各質問への回答に対する AI フィードバックを生成するエンドポイント

import { getUser } from './lib/session.js';

const THEME_INSTRUCTIONS = {
  tokimeki: 'ときめきや感情的な価値について共感を込めてコメントしてください。',
  mise: '見栄や承認欲求について、批判せず優しく本音に気づかせるコメントをしてください。',
  hitsuyou: '必要性や購入目的の明確さについてコメントしてください。',
  tsukauka: '実際に使い続けるかどうかの現実的な視点でコメントしてください。',
  daigae: '代替手段（図書館・中古・サブスクなど）の可能性を踏まえてコメントしてください。',
  shihonshugi: '消費文化・広告・資本主義への批判的視点を持ちながら、押しつけがましくなくコメントしてください。',
};

// ── ヘルパー関数 ─────────────────────────────────────────────────────────

// スコアを人間が読みやすいラベルに変換する
function getScoreLabel(answerScore) {
  if (answerScore >= 2) return 'ポジティブな回答';
  if (answerScore <= -2) return 'ネガティブな回答';
  return '中立的な回答';
}

// OpenAI に送るプロンプトを構築する
function buildPrompt(itemName, itemPrice, questionText, answerText, answerScore, questionIndex, questionTheme) {
  const scoreLabel = getScoreLabel(answerScore);
  const priceText = itemPrice ? `（価格：¥${Number(itemPrice).toLocaleString()}）` : '';
  const themeGuide = THEME_INSTRUCTIONS[questionTheme] || '';

  return `あなたは批評眼のある節約アドバイザーです。ユーザーが「${itemName}${priceText}」の購入を検討しています。

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
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

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

  const prompt = buildPrompt(itemName, itemPrice, questionText, answerText, answerScore, questionIndex, questionTheme);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.75,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('OpenAI エラー:', err);
      return res.status(502).json({ error: 'OpenAI API error' });
    }

    const data = await response.json();
    const feedback = data.choices[0].message.content.trim();
    return res.status(200).json({ feedback });
  } catch (err) {
    console.error('サーバーエラー:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
}
