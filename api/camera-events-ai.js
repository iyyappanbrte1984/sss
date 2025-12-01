export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { windowHours = 24 } = req.body;

    // For now, return a simple AI-like analysis
    // You can integrate Perplexity AI here later
    const aiText = `Camera Event Analysis (Last ${windowHours} hours):

Based on recent detections, the marine environment monitoring shows:

🐟 Fish Detections: Indicate healthy marine biodiversity
🗑️ Trash Detections: Pollution hotspots identified  
🚨 Emergency Events: Critical areas requiring immediate attention

Recommendation: Continue monitoring and increase cleanup efforts in high-trash areas.`;

    return res.status(200).json({ 
      success: true, 
      ai_text: aiText 
    });
  } catch (err) {
    console.error('camera-events-ai error:', err);
    return res.status(500).json({ error: err.message });
  }
}
