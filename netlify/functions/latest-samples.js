// latest-samples.js
import fetch from "node-fetch";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export async function handler(event) {
  try {
    const q = (event.queryStringParameters && Number(event.queryStringParameters.limit)) || 20;

    // fetch latest samples (with a limit)
    const url = `${SUPABASE_URL}/rest/v1/samples?select=*&order=recorded_at.desc&limit=${q}`;
    const resp = await fetch(url, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Supabase fetch error", resp.status, t);
      return { statusCode: 502, body: JSON.stringify({ error: "Supabase query failed", details: t }) };
    }

    const rows = await resp.json();
    return { statusCode: 200, body: JSON.stringify(rows) };
  } catch (err) {
    console.error("latest-samples error", err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
