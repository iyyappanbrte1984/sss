// netlify/functions/marine-ai.js
// Calls Perplexity (server-side) with quota enforcement and stores result to predictions table

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const QUOTA_PER_DAY = Number(process.env.AI_QUOTA_PER_DAY || "10");

    if (!PERPLEXITY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing env vars (PERPLEXITY_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY)" }) };
    }

    const body = JSON.parse(event.body || "{}");
    let latest = body.latestSample || null;

    // If no latestSample provided, fetch the most recent sample from DB
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

    // --- Quota check: count predictions for today ---
    // determine today's start timestamp in UTC (YYYY-MM-DDT00:00:00Z)
    const todayStart = new Date();
    todayStart.setUTCHours(0,0,0,0);
    const isoStart = todayStart.toISOString();

    // Query predictions since isoStart where provider=perplexity
    const qUrl = new URL(`${SUPABASE_URL}/rest/v1/predictions`);
    qUrl.searchParams.set("select", "id");
    qUrl.searchParams.set("created_at", `gte.${isoStart}`);
    qUrl.searchParams.set("provider", `eq.perplexity`);
    qUrl.searchParams.set("limit", "1000"); // safe cap

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

    // --- Build prompt for Perplexity ---
    const prompt = `Analyze ocean water health using the following parameters:
pH: ${latest.ph}
Temperature: ${latest.temperature} °C
Salinity: ${latest.salinity}
Dissolved Oxygen: ${latest.dissolved_oxygen ?? latest.dissolvedOxygen}
Turbidity: ${latest.turbidity}

Provide a short, clear assessment (2-5 sentences) and recommended actions if any.`;

    // Call Perplexity Chat Completions
    const perRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sonar-medium-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 250
      })
    });

    const status = perRes.status;
    const text = await perRes.text();

    if (status !== 200) {
      // return details from Perplexity for debugging (don't log secret)
      return { statusCode: 500, body: JSON.stringify({ error: "Perplexity API failed", status, details: text }) };
    }

    // parse JSON response
    let perJson;
    try { perJson = JSON.parse(text); } catch (e) { perJson = null; }

    // lift out AI message text - try expected location, fallback to raw text
    const aiText = perJson?.choices?.[0]?.message?.content ?? perJson?.choices?.[0]?.text ?? (typeof text === "string" ? text : JSON.stringify(perJson));

    // store prediction in Supabase
    const storePayload = {
      sample_id: latest.id ?? null,
      provider: "perplexity",
      model: perJson?.model ?? "sonar-medium-chat",
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

    // return AI text and store info
    let stored = null;
    try { stored = JSON.parse(insertText); } catch(e) { stored = insertText; }

    return { statusCode: 200, body: JSON.stringify({ success: true, ai_text: aiText, stored }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
