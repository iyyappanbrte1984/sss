import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
    return res.status(500).json({ error: err.message });
  }
}
