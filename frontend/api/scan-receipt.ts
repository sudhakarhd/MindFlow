export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const imageUrl = req.body?.prompt || req.body?.imageUrl;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Fetch image from Supabase Storage URL
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      return res.status(400).json({ error: `Failed to fetch image (${imageRes.status})` });
    }

    const detectedMime = imageRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'];
    let geminiRes: Response | null = null;
    let lastErrorText = '';

    for (const model of models) {
      let success = false;
      for (let attempt = 0; attempt < 3; attempt++) {
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
                        mime_type: detectedMime,
                        data: base64Data
                      }
                    },
                    {
                      text: 'Extract receipt details in strict JSON format with keys: store_name (string), receipt_date (YYYY-MM-DD string), total_amount (number), and items (array of objects with name, price, and category where category must be one of: Produce, Dairy, Meat, Pantry, Household).'
                    }
                  ]
                }
              ],
              generationConfig: {
                responseMimeType: 'application/json'
              }
            })
          }
        );

        if (geminiRes.ok) {
          success = true;
          break;
        }

        lastErrorText = await geminiRes.text();
        if (geminiRes.status === 429 || geminiRes.status === 503) {
          const sleepTime = (Math.pow(2, attempt) * 1000) + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, sleepTime));
          continue;
        } else {
          break;
        }
      }

      if (success) {
        break;
      }

      if (geminiRes && geminiRes.status !== 503 && geminiRes.status !== 429 && geminiRes.status !== 404) {
        break;
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      return res.status(500).json({ error: `Gemini API error: ${lastErrorText}` });
    }

    const geminiJson = await geminiRes.json();
    const textResponse = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    return res.status(200).json({ response: textResponse });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}