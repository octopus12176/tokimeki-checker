export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { itemName, itemPrice, questionText, answerText, answerScore, questionIndex } = req.body;

  if (!itemName || !questionText || !answerText) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const priceText = itemPrice ? `（価格：¥${Number(itemPrice).toLocaleString()}）` : '';
  const scoreLabel = answerScore >= 2 ? 'ポジティブな回答' : answerScore <= -2 ? 'ネガティブな回答' : '中立的な回答';

  const prompt = `あなたは節約アドバイザーです。ユーザーが「${itemName}${priceText}」の購入を検討しています。
以下の質問に対してユーザーが回答しました。

質問（${questionIndex + 1}/5）：${questionText}
ユーザーの回答：「${answerText}」（${scoreLabel}）

この回答に対して、20〜35文字程度の短い日本語のフィードバックを1文だけ返してください。
・絵文字を1つだけ文頭に使ってください
・ポジティブな回答には背中を押すコメントを
・ネガティブな回答には優しく気づきを促すコメントを
・中立的な回答にはバランスの取れたコメントを
・「！」や「ね」などで終わる自然な口語にしてください
フィードバック文のみ返してください。余計な説明は不要です。`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('OpenAI error:', err);
      return res.status(502).json({ error: 'OpenAI API error', detail: err });
    }

    const data = await response.json();
    const feedback = data.choices[0].message.content.trim();
    return res.status(200).json({ feedback });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
