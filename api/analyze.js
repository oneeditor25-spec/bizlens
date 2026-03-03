// api/analyze.js — BizLens Serverless Function
// Supports Claude (Anthropic) and Google Gemini.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product, model } = req.body;

  if (!product || typeof product !== 'string' || product.trim().length === 0) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  if (product.length > 200) {
    return res.status(400).json({ error: 'Product name too long' });
  }
  if (!['claude', 'gemini'].includes(model)) {
    return res.status(400).json({ error: 'Invalid model. Use "claude" or "gemini"' });
  }

  const prompt = `You are a top-tier business strategist and marketing analyst. Analyze the product/brand/company: "${product.trim()}"

Return ONLY a valid JSON object (no markdown, no backticks, no explanation) with this exact structure:

{
  "name": "Product/Brand name",
  "tagline": "One punchy sentence describing what this product really IS as a business",
  "businessScore": 78,
  "scoreReason": "Why this score (one sentence)",
  "businessModel": {
    "type": "SaaS / Marketplace / DTC / Subscription / etc",
    "revenueStreams": ["stream1", "stream2", "stream3"],
    "unitEconomics": "Brief comment on margins, LTV, CAC"
  },
  "marketing": {
    "primaryChannels": ["channel1", "channel2", "channel3"],
    "positioning": "How they position themselves in the market",
    "targetAudience": "Who they target and why",
    "keyMessage": "Their core marketing message",
    "tactics": ["tactic1", "tactic2", "tactic3", "tactic4"]
  },
  "moat": {
    "type": "Network Effects / Brand / Switching Costs / Cost / etc",
    "description": "Why customers cannot easily leave",
    "strength": 75
  },
  "metrics": [
    { "name": "Brand Power", "value": 85 },
    { "name": "Market Penetration", "value": 72 },
    { "name": "Pricing Power", "value": 68 },
    { "name": "Customer Loyalty", "value": 80 },
    { "name": "Growth Potential", "value": 65 }
  ],
  "swot": {
    "strengths": ["s1", "s2", "s3"],
    "weaknesses": ["w1", "w2"],
    "opportunities": ["o1", "o2", "o3"],
    "threats": ["t1", "t2"]
  },
  "competitiveAdvantage": "2-3 sentences on what makes them truly different",
  "growthStrategy": ["strategy1", "strategy2", "strategy3"],
  "pricingStrategy": "How they price and why (value-based, penetration, premium, freemium, etc.)",
  "keyInsight": "The ONE non-obvious insight about this product/business that most people miss",
  "categoryTags": ["tag1", "tag2", "tag3"],
  "marketTags": ["tag1", "tag2"]
}`;

  try {
    let resultText = '';

    // ── Claude (Anthropic) ───────────────────────────────────────────────────
    if (model === 'claude') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('Claude error:', err);
        return res.status(502).json({ error: 'Claude service error. Check your API key.' });
      }

      const data = await response.json();
      resultText = data.content.map(b => b.text || '').join('');
    }

    // ── Google Gemini ────────────────────────────────────────────────────────
    if (model === 'gemini') {


      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('Gemini error:', err);
        return res.status(502).json({ error: 'Gemini service error. Check your API key.' });
      }

      const data = await response.json();
      resultText = data.candidates[0].content.parts[0].text;
    }

    // ── Parse & return ───────────────────────────────────────────────────────
    const clean = resultText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json({ ...parsed, _model: model });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
