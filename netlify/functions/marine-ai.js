// netlify/functions/marine-ai.js
// Calls Perplexity, enforces daily quota, stores prediction in Supabase predictions table.

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const PERPLEXITY_KEY = process.env.PERPLEXITY_KEY; // matches your Netlify var name
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const QUOTA_PER_DAY = Number(process.env.AI_QUOTA_PER_DAY || "10");

    if (!PERPLEXITY_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing env vars (PERPLEXITY_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY)" }) };
    }

    // parse incoming body: may include latestSample; if not, we fetch latest sample from DB
    const body = JSON.parse(event.body || "{}");
    let latest = body.latestSample ?? null;

    if (!latest) {
      // fetch 1 latest sample
      const sampleRes = await fetch(`${SUPABASE_URL}/rest/v1/samples?select=*&order=recorded_at.desc&limit=1`, {
        method: "GET",
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      if (!sampleRes.ok) {
        const t = await sampleRes.text();
        return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch latest sample", details: t }) };
      }
      const arr = await sampleRes.json();
      latest = arr && arr[0] ? arr[0] : null;
      if (!latest) {
        return { statusCode: 400, body: JSON.stringify({ error: "No sample available to analyze" }) };
      }
    }

    // QUOTA check: count predictions by provider=perplexity since UTC midnight
    const todayStart = new Date();
    todayStart.setUTCHours(0,0,0,0);
    const isoStart = todayStart.toISOString();

    const qUrl = new URL(`${SUPABASE_URL}/rest/v1/predictions`);
    qUrl.searchParams.set("select", "id");
    qUrl.searchParams.set("created_at", `gte.${isoStart}`);
    qUrl.searchParams.set("provider", `eq.perplexity`);
    qUrl.searchParams.set("limit", "1000");

    const qRes = await fetch(qUrl.toString(), {
      method: "GET",
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    if (!qRes.ok) {
      const t = await qRes.text();
      return { statusCode: 500, body: JSON.stringify({ error: "Quota check failed", details: t }) };
    }
    const qArr = await qRes.json();
    const todayCount = Array.isArray(qArr) ? qArr.length : 0;

    if (todayCount >= QUOTA_PER_DAY) {
      return { statusCode: 429, body: JSON.stringify({ error: "Quota exceeded", todayCount, quota: QUOTA_PER_DAY }) };
    }

    // Build prompt
    const prompt = `Analyze ocean water health using these parameters:
pH: ${latest.ph}
Temperature: ${latest.temperature} °C
Salinity: ${latest.salinity}
Dissolved Oxygen: ${latest.dissolved_oxygen ?? latest.dissolvedOxygen}
Turbidity: ${latest.turbidity}

Provide a short (2-4 sentence) assessment and suggested actions if needed.`;

    // Call Perplexity - FIXED MODEL NAME
    const perRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 250
      })
    });

    const status = perRes.status;
    const text = await perRes.text();

    if (status !== 200) {
      // return status + body for debugging
      return { statusCode: 500, body: JSON.stringify({ error: "Perplexity API failed", status, details: text }) };
    }

    let perJson;
    try { perJson = JSON.parse(text); } catch (e) { perJson = null; }

    const aiText = perJson?.choices?.[0]?.message?.content ?? perJson?.choices?.[0]?.text ?? (typeof text === "string" ? text : JSON.stringify(perJson));

    // Store prediction in Supabase
    const storePayload = {
      sample_id: latest.id ?? null,
      provider: "perplexity",
      model: perJson?.model ?? "llama-3.1-sonar-small-128k-online",
      score: null,
      summary: String(aiText).slice(0, 4000),
      details: perJson ?? {}
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify([storePayload])
    });

    const insertText = await insertRes.text();
    if (!insertRes.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: "Failed storing prediction", details: insertText }) };
    }

    let stored = null;
    try { stored = JSON.parse(insertText); } catch (e) { stored = insertText; }

    return { statusCode: 200, body: JSON.stringify({ success: true, ai_text: aiText, stored }) };

  } catch (err) {
    console.error("marine-ai error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
