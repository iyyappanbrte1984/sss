// netlify/functions/marine-ai.js
import fetch from "node-fetch";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Helper function: Insert prediction into Supabase
async function storePrediction(predictionText, latestSample) {
  const timestamp = new Date().toISOString();

  const payload = {
    created_at: timestamp,
    prediction: predictionText,
    ph: latestSample.ph,
    temperature: latestSample.temperature,
    salinity: latestSample.salinity,
    dissolved_oxygen: latestSample.dissolved_oxygen ?? latestSample.dissolvedOxygen,
    turbidity: latestSample.turbidity
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase insert failed: ${errorText}`);
  }

  return true;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const latest = body.latestSample;

    if (!latest) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing latestSample in request" })
      };
    }

    if (!PERPLEXITY_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing PERPLEXITY_API_KEY" })
      };
    }

    // Create prompt for Perplexity
    const prompt = `Analyze ocean water health using these parameters:
pH: ${latest.ph}
Temperature: ${latest.temperature}°C
Salinity: ${latest.salinity} PSU
Dissolved Oxygen: ${latest.dissolved_oxygen ?? latest.dissolvedOxygen} mg/L
Turbidity: ${latest.turbidity} NTU

Provide a short, clear assessment of water quality and possible marine impacts.`;

    // Call Perplexity API
    const aiResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sonar-medium-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300
      })
    });

    const status = aiResponse.status;
    const text = await aiResponse.text();

    // Handle Perplexity errors
    if (status !== 200) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Perplexity API failed",
          status: status,
          details: text
        })
      };
    }

    const json = JSON.parse(text);
    const aiText = json?.choices?.[0]?.message?.content || "No AI response received";

    // Store prediction into Supabase
    await storePrediction(aiText, latest);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ai_text: aiText,
        stored: true
      })
    };

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) })
    };
  }
}
