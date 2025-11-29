// marine-ai-debug.js — temporary debug version
import fetch from "node-fetch"; // keep or use global fetch if available

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  try {
    const payload = JSON.parse(event.body || "{}");
    const latest = payload.latestSample;
    if (!latest) return { statusCode: 400, body: JSON.stringify({ error: "latestSample required" }) };

    const prompt = `Analyze sample: pH ${latest.ph}, temp ${latest.temperature}, salinity ${latest.salinity}, DO ${latest.dissolved_oxygen || latest.dissolvedOxygen}, turbidity ${latest.turbidity}`;

    // Call Perplexity and capture full response
    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sonar-medium-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300
      })
    });

    const status = resp.status;
    const text = await resp.text(); // read as text so we can display HTML errors too

    // return the raw Perplexity response for debugging
    return {
      statusCode: 200,
      body: JSON.stringify({
        note: "DEBUG: Perplexity raw response (do not keep this deployed long).",
        perplexity_status: status,
        perplexity_body: text.slice(0, 20000) // limit length
      })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
