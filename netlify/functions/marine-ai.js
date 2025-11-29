// marine-ai.js  (PERPLEXITY VERSION)
import fetch from "node-fetch";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

function buildPrompt(latest) {
  return `
You are an expert ocean water quality scientist.

Analyse this marine sensor reading:

pH: ${latest.ph}
Temperature: ${latest.temperature} °C
Salinity: ${latest.salinity} PSU
Dissolved Oxygen: ${latest.dissolved_oxygen ?? latest.dissolvedOxygen} mg/L
Turbidity: ${latest.turbidity} NTU

Return a JSON with:
{
  "summary": "Healthy / Watch / Alert",
  "concerns": ["point 1", "point 2"],
  "actions": ["action 1", "action 2"]
}

Keep under 120 words.
`;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const latest = payload.latestSample;

    if (!latest) {
      return { statusCode: 400, body: JSON.stringify({ error: "latestSample required" }) };
    }

    const prompt = buildPrompt(latest);

    // -------------------------------
    // 💡 CALL PERPLEXITY AI COMPLETIONS API
    // -------------------------------
    const perplexityResp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sonar-medium-chat",   // recommended fast/cheap model
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 300
      })
    });

    if (!perplexityResp.ok) {
      const txt = await perplexityResp.text();
      console.error("Perplexity API error:", txt);
      return { statusCode: 500, body: JSON.stringify({ error: "Perplexity API failed", details: txt }) };
    }

    const data = await perplexityResp.json();

    // Extract text
    const message = data.choices?.[0]?.message?.content || JSON.stringify(data);

    // -------------------------------
    // SAVE PREDICTION TO SUPABASE
    // -------------------------------
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
        provider: "perplexity",
        model: "sonar-medium-chat",
        summary: message.substring(0, 10000),
        details: data
      }])
    });

    const inserted = await insertResp.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        ai_text: message,
        stored: inserted[0]
      })
    };

  } catch (err) {
    console.error("marine-ai error", err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
