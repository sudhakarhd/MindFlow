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

    // Call Gemini API via native fetch
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(500).json({ error: `Gemini API error: ${errText}` });
    }

    const geminiJson = await geminiRes.json();
    const textResponse = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({ response: textResponse });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
