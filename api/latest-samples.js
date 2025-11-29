// api/latest-samples.js
// Vercel serverless function - Return latest samples for the dashboard

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Missing Supabase env vars (SUPABASE_URL / SUPABASE_SERVICE_KEY)' });
    }

    const limit = Number(req.query.limit || 20);

    const url = new URL(`${SUPABASE_URL}/rest/v1/samples`);
    url.searchParams.set('select', '*');
    url.searchParams.set('order', 'recorded_at.desc');
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(500).json({ error: 'Failed fetching samples', details: text });
    }

    const data = JSON.parse(text);
    return res.status(200).json(data);
    
  } catch (err) {
    console.error('latest-samples error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
