// api/marine-ai.js
// Vercel serverless function - Calls Gemini, enforces daily quota, stores prediction in Supabase

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const QUOTA_PER_DAY = Number(process.env.AI_QUOTA_PER_DAY || '10');

    if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({
        error:
          'Missing env vars (GEMINI_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY)',
      });
    }

    const body = req.body || {};
    let latest = body.latestSample ?? null;

    // If latest sample not passed from client, fetch latest from Supabase
    if (!latest) {
      const sampleRes = await fetch(
        `${SUPABASE_URL}/rest/v1/samples?select=*&order=recorded_at.desc&limit=1`,
        {
          method: 'GET',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      if (!sampleRes.ok) {
        const t = await sampleRes.text();
        return res
          .status(500)
          .json({ error: 'Failed to fetch latest sample', details: t });
      }
      const arr = await sampleRes.json();
      latest = arr && arr[0] ? arr[0] : null;
      if (!latest) {
        return res
          .status(400)
          .json({ error: 'No sample available to analyze' });
      }
    }

    // QUOTA check (provider = 'gemini')
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const isoStart = todayStart.toISOString();

    const qUrl = new URL(`${SUPABASE_URL}/rest/v1/predictions`);
    qUrl.searchParams.set('select', 'id');
    qUrl.searchParams.set('created_at', `gte.${isoStart}`);
    qUrl.searchParams.set('provider', `eq.gemini`);
    qUrl.searchParams.set('limit', '1000');

    const qRes = await fetch(qUrl.toString(), {
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!qRes.ok) {
      const t = await qRes.text();
      return res
        .status(500)
        .json({ error: 'Quota check failed', details: t });
    }
    const qArr = await qRes.json();
    const todayCount = Array.isArray(qArr) ? qArr.length : 0;

    if (todayCount >= QUOTA_PER_DAY) {
      return res
        .status(429)
        .json({ error: 'Quota exceeded', todayCount, quota: QUOTA_PER_DAY });
    }

    // Build prompt for Gemini
    const prompt = `You are an ocean health AI assistant for school students.

Analyze ocean water health using these parameters:
pH: ${latest.ph}
Temperature: ${latest.temperature} °C
Salinity: ${latest.salinity}
Dissolved Oxygen: ${latest.dissolved_oxygen ?? latest.dissolvedOxygen}
Turbidity: ${latest.turbidity}

Provide a short (2–4 sentence) assessment and simple suggested actions if needed. Use clear, student‑friendly language.`;

    // Call Gemini via REST generateContent
    // Using gemini-2.0-flash (text‑friendly, current model)
    const GEMINI_MODEL = 'gemini-2.0-flash';

    const gemRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 250,
            temperature: 0.7,
          },
        }),
      }
    );

    const status = gemRes.status;
    const gemText = await gemRes.text();

    if (status !== 200) {
      return res.status(500).json({
        error: 'Gemini API failed',
        status,
        details: gemText,
      });
    }

    let gemJson;
    try {
      gemJson = JSON.parse(gemText);
    } catch (e) {
      gemJson = null;
    }

    // Extract text from Gemini response
    let aiText = '';
    const candidates = gemJson?.candidates || [];
    if (candidates[0]?.content?.parts) {
      aiText = candidates[0].content.parts
        .map((p) => p.text || '')
        .join('\n')
        .trim();
    }
    if (!aiText) {
      aiText =
        typeof gemText === 'string' ? gemText : JSON.stringify(gemJson || {});
    }

    // Store prediction in Supabase (provider = 'gemini')
    const storePayload = {
      sample_id: latest.id ?? null,
      provider: 'gemini',
      model: gemJson?.model ?? GEMINI_MODEL,
      score: null,
      summary: String(aiText).slice(0, 4000),
      details: gemJson ?? {},
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([storePayload]),
    });

    const insertText = await insertRes.text();
    if (!insertRes.ok) {
      return res.status(500).json({
        error: 'Failed storing prediction',
        details: insertText,
      });
    }

    let stored = null;
    try {
      stored = JSON.parse(insertText);
    } catch (e) {
      stored = insertText;
    }

    // Response expected by your frontend
    return res.status(200).json({ success: true, ai_text: aiText, stored });
  } catch (err) {
    console.error('marine-ai error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
