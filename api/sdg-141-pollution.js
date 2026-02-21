// api/sdg-141-pollution.js
// Returns plastic debris density time series for SDG 14.1.1b

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('shoreline_surveys')
      .select('survey_date, site_name, transect_m, plastic_count')
      .order('survey_date', { ascending: true });

    if (error) throw error;

    const series = (data || []).map(row => {
      const length = row.transect_m || 100; // default 100 m if missing
      const itemsPer100m = (row.plastic_count || 0) * (100 / length);

      return {
        date: row.survey_date,
        site: row.site_name || 'Site',
        items_per_100m: Number(itemsPer100m.toFixed(1))
      };
    });

    return res.status(200).json(series);
  } catch (err) {
    console.error('sdg-141 error', err);
    return res.status(500).json({ error: String(err) });
  }
}
