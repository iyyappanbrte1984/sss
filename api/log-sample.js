// api/log-sample.js
// Vercel serverless function - Insert a single sample into Supabase

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
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Missing Supabase env vars (SUPABASE_URL / SUPABASE_SERVICE_KEY)' });
    }

    const payload = req.body || {};

    const sample = {
      location: payload.location ?? 'unknown',
      ph: payload.ph ?? null,
      temperature: payload.temperature ?? null,
      salinity: payload.salinity ?? null,
      dissolved_oxygen: payload.dissolved_oxygen ?? payload.dissolvedOxygen ?? null,
      turbidity: payload.turbidity ?? null,
      meta: payload.meta ?? {}
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/samples`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify([sample])
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(500).json({ error: 'Supabase insert failed', details: text });
    }

    const inserted = JSON.parse(text || '[]');
    return res.status(200).json({ success: true, inserted });

  } catch (err) {
    console.error('log-sample error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
