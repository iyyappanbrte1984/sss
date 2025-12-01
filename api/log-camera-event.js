import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Log raw body for debugging
    console.log('log-camera-event body:', req.body);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase env missing', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
      });
      return res.status(500).json({
        error: 'Supabase environment variables missing',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { code, label, confidence, lat, lng, meta, created_at } = req.body || {};

    if (!code) {
      return res.status(400).json({ error: 'Missing code in body' });
    }

    const insertPayload = {
      code,
      label: label || null,
      confidence: confidence ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      meta: meta ?? null,
      created_at: created_at || new Date().toISOString(),
    };

    console.log('Inserting into camera_events:', insertPayload);

    const { data, error } = await supabase
      .from('camera_events')
      .insert([insertPayload])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: error.message || 'Insert failed' });
    }

    console.log('Insert success:', data);

    return res.status(200).json({ success: true, inserted: data[0] });
  } catch (err) {
    console.error('log-camera-event error (catch):', err);
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
