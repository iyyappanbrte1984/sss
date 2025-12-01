import { createClient } from '@supabase/supabase-js';

// Check for both possible environment variable names
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!process.env.SUPABASE_URL || !supabaseKey) {
  console.error('Missing Supabase credentials:', {
    hasUrl: !!process.env.SUPABASE_URL,
    hasKey: !!supabaseKey,
    availableVars: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
  });
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if Supabase is configured
    if (!process.env.SUPABASE_URL || !supabaseKey) {
      throw new Error('Supabase not configured. Missing SUPABASE_URL or SUPABASE_KEY/SUPABASE_SERVICE_KEY');
    }

    const { code, label, confidence, lat, lng, meta, created_at } = req.body;

    const { data, error } = await supabase
      .from('camera_events')
      .insert([{
        code,
        label,
        confidence,
        lat,
        lng,
        meta,
        created_at: created_at || new Date().toISOString()
      }])
      .select();

    if (error) throw error;

    return res.status(200).json({ success: true, inserted: data[0] });
  } catch (err) {
    console.error('log-camera-event error:', err);
    return res.status(500).json({ 
      error: err.message,
      details: 'Check Vercel environment variables: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set'
    });
  }
}
