import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // ← Changed from SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get events from last 24 hours
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get counts by code
    const { data: countData, error: countError } = await supabase
      .from('camera_events')
      .select('code')
      .gte('created_at', last24h);

    if (countError) throw countError;

    // Count by code
    const counts = {};
    (countData || []).forEach(row => {
      counts[row.code] = (counts[row.code] || 0) + 1;
    });

    const countsArray = Object.entries(counts).map(([code, count]) => ({
      code,
      count
    }));

    // Get recent 20 events for map
    const { data: recentData, error: recentError } = await supabase
      .from('camera_events')
      .select('*')
      .gte('created_at', last24h)
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentError) throw recentError;

    return res.status(200).json({
      counts: countsArray,
      recent: recentData || []
    });
  } catch (err) {
    console.error('camera-events-summary error:', err);
    return res.status(500).json({ error: err.message });
  }
}
