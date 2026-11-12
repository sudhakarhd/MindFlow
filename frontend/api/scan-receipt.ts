export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const imageUrl = req.body?.prompt || req.body?.imageUrl;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Fetch image from URL
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      return res.status(400).json({ error: 'Failed to fetch image from URL' });
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-pro'];
    let geminiRes: Response | null = null;
    let lastErrorText = '';

    for (const model of models) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: base64Data
                    }
                  },
                  {
                    text: 'Extract receipt details in strict JSON format with keys: store_name (string), receipt_date (YYYY-MM-DD string), total_amount (number), and items (array of objects with name, price, and category where category must be one of: Produce, Dairy, Meat, Pantry, Household). Return ONLY valid JSON.'
                  }
                ]
              }
            ]
          })
        }
      );

      if (geminiRes.ok) {
        break;
      }

      lastErrorText = await geminiRes.text();
      if (geminiRes.status !== 503 && geminiRes.status !== 429) {
        break;
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      return res.status(500).json({ error: `Gemini API error: ${lastErrorText}` });
    }

    const geminiJson = await geminiRes.json();
    const textResponse = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({ response: textResponse });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
