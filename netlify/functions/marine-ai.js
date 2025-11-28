// marine-ai.js
import fetch from "node-fetch";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function buildPrompt(latest) {
  return `
You are an expert ocean-science assistant. Given the latest sensor reading, return a short JSON with keys:
- summary (one-line status: Healthy / Watch / Alert)
- concerns (array of up to 2 strings)
- actions (array of 1-3 practical steps for students / community)
Keep the answer concise, plain text, no markdown, under 120 words.

Latest sample:
pH: ${latest.ph}
Temperature: ${latest.temperature} °C
Salinity: ${latest.salinity} PSU
Dissolved O2: ${latest.dissolved_oxygen ?? latest.dissolvedOxygen} mg/L
Turbidity: ${latest.turbidity} NTU
`;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const latest = payload.latestSample;
    if (!latest) return { statusCode: 400, body: JSON.stringify({ error: "latestSample required" }) };

    // Compose prompt
    const prompt = buildPrompt(latest);

    // Call OpenAI Responses API
    const openaiResp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: prompt,
        max_output_tokens: 400
      })
    });

    if (!openaiResp.ok) {
      const t = await openaiResp.text();
      console.error("OpenAI error", openaiResp.status, t);
      return { statusCode: 502, body: JSON.stringify({ error: "OpenAI call failed", details: t }) };
    }

    const openaiJson = await openaiResp.json();
    // Try to extract text robustly:
    let message = "";
    try {
      message = openaiJson.output?.[0]?.content?.[0]?.text ?? JSON.stringify(openaiJson);
    } catch(e) {
      message = JSON.stringify(openaiJson);
    }

    // Store prediction in Supabase predictions table (service role)
    const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify([{
        sample_id: latest.id || null,
        provider: "openai",
        model: OPENAI_MODEL,
        summary: String(message).slice(0, 10000),
        details: { raw: openaiJson }
      }])
    });

    if (!insertResp.ok) {
      const t = await insertResp.text();
      console.error("Supabase insert prediction failed", insertResp.status, t);
      return { statusCode: 502, body: JSON.stringify({ error: "Saving prediction failed", details: t }) };
    }

    const inserted = await insertResp.json();
    return { statusCode: 200, body: JSON.stringify({ ai_text: message, stored: inserted[0] }) };
  } catch (err) {
    console.error("marine-ai error", err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
