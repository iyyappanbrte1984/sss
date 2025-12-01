// app/api/log-camera-event/route.js
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(req) {
  try {
    const body = await req.json();
    let {
      code,
      label,
      confidence,
      source,
      recorded_at,
      location,
      lat,
      lng,
      meta
    } = body || {};

    code = String(code || '').toUpperCase();
    if (!['F', 'T', 'E'].includes(code)) {
      return NextResponse.json(
        { error: 'Invalid code. Must be F, T, or E.' },
        { status: 400 }
      );
    }

    if (typeof confidence === 'string') confidence = parseFloat(confidence);
    if (Number.isNaN(confidence)) confidence = null;

    const insertPayload = {
      code,
      label: label || null,
      confidence,
      source: source || 'live-demo',
      created_at: recorded_at || new Date().toISOString(),
      location: location || null,
      lat: lat ?? null,
      lng: lng ?? null,
      meta: meta ?? null
    };

    const { data, error } = await supabaseServer
      .from('camera_events')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error (camera_events):', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ inserted: data }, { status: 200 });
  } catch (err) {
    console.error('log-camera-event error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
