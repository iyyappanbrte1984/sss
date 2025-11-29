// netlify/functions/log-sample.js
// Inserts a water sample into Supabase (server-side using service_role key)

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing Supabase env vars" }) };
    }

    const payload = JSON.parse(event.body || "{}");
    // sanitize basic shape
    const sample = {
      location: payload.location || payload.loc || "unknown",
      ph: payload.ph ?? null,
      temperature: payload.temperature ?? null,
      salinity: payload.salinity ?? null,
      dissolved_oxygen: payload.dissolved_oxygen ?? payload.dissolvedOxygen ?? null,
      turbidity: payload.turbidity ?? null,
      meta: payload.meta ?? {}
    };

    // use Supabase REST to insert
    const res = await fetch(`${SUPABASE_URL}/rest/v1/samples`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify([sample])
    });

    const text = await res.text();
    if (!res.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: "Supabase insert failed", details: text }) };
    }

    // returned representation (array) — parse JSON
    const inserted = JSON.parse(text || "[]");
    return { statusCode: 200, body: JSON.stringify({ success: true, inserted }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
