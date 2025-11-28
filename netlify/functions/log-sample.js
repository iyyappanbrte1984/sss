// log-sample.js
import fetch from "node-fetch";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function safeNumber(v){ return v === undefined || v === null ? null : Number(v); }

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    // Basic validation - require at least one reading
    if (!body || (body.ph === undefined && body.temperature === undefined && body.salinity === undefined)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing sensor data (ph / temperature / salinity expected)" }) };
    }

    // Normalize payload to DB column names
    const row = {
      location: body.location || null,
      recorded_at: body.recorded_at || new Date().toISOString(),
      ph: safeNumber(body.ph),
      temperature: safeNumber(body.temperature),
      salinity: safeNumber(body.salinity),
      dissolved_oxygen: safeNumber(body.dissolvedOxygen ?? body.dissolved_oxygen),
      turbidity: safeNumber(body.turbidity),
      meta: body.meta || {}
    };

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/samples`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify([row])
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Supabase insert error", resp.status, t);
      return { statusCode: 502, body: JSON.stringify({ error: "Supabase insert failed", details: t }) };
    }

    const inserted = await resp.json();
    // inserted is an array because we posted an array
    return { statusCode: 200, body: JSON.stringify({ inserted: inserted[0] }) };
  } catch (err) {
    console.error("log-sample error", err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
