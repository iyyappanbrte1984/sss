// netlify/functions/latest-samples.js
// Returns latest samples (used by dashboard and live-demo)

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing Supabase env vars" }) };
    }

    const url = new URL(`${SUPABASE_URL}/rest/v1/samples`);
    const params = event.queryStringParameters || {};
    const limit = params.limit || 20;
    // request all columns, ordered by recorded_at desc
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "recorded_at.desc");
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    const data = await res.text();
    if (!res.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: "Failed fetching samples", details: data }) };
    }

    return { statusCode: 200, body: data };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
