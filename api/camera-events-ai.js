import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // Use the variable name you have in Vercel
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { windowHours = 24 } = req.body;

    // Calculate the time threshold
    const startTime = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    // Fetch camera events from database
    const { data: events, error } = await supabase
      .from('camera_events')
      .select('*')
      .gte('created_at', startTime)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Count detections by type
    let fishCount = 0, trashCount = 0, emergCount = 0;
    (events || []).forEach(e => {
      if (e.code === 'F') fishCount++;
      if (e.code === 'T') trashCount++;
      if (e.code === 'E') emergCount++;
    });

    const total = fishCount + trashCount + emergCount;

    // Generate AI-like analysis based on actual data
    let aiText = `Camera Event Analysis (Last ${windowHours} hours):\n\n`;
    
    if (total === 0) {
      aiText += `No detections recorded in the last ${windowHours} hours.\n\n`;
      aiText += `System Status: Active monitoring with TensorFlow.js edge detection.`;
    } else {
      aiText += `Total Detections: ${total}\n\n`;
      
      if (fishCount > 0) {
        aiText += `🐟 Fish Detections: ${fishCount}\n`;
        aiText += `   - Indicates ${fishCount > 10 ? 'healthy' : 'moderate'} marine biodiversity\n`;
        aiText += `   - Active marine life presence confirmed\n\n`;
      }
      
      if (trashCount > 0) {
        aiText += `🗑️ Trash Detections: ${trashCount}\n`;
        aiText += `   - ${trashCount > 5 ? 'HIGH PRIORITY' : 'Moderate'} pollution hotspots identified\n`;
        aiText += `   - Cleanup intervention ${trashCount > 5 ? 'URGENTLY' : ''} recommended\n\n`;
      }
      
      if (emergCount > 0) {
        aiText += `🚨 Emergency Events: ${emergCount}\n`;
        aiText += `   - CRITICAL environmental conditions detected\n`;
        aiText += `   - Immediate response required\n\n`;
      }

      aiText += `**Recommendations:**\n`;
      aiText += `1. Continue real-time monitoring in detected zones\n`;
      
      if (trashCount > 0) {
        aiText += `2. Deploy cleanup operations to ${trashCount} pollution locations\n`;
      }
      
      if (fishCount > 0) {
        aiText += `${trashCount > 0 ? '3' : '2'}. Monitor fish population trends for ecosystem health\n`;
      }
      
      if (emergCount > 0) {
        aiText += `${trashCount > 0 && fishCount > 0 ? '4' : trashCount > 0 || fishCount > 0 ? '3' : '2'}. Alert local authorities for ${emergCount} emergency-flagged locations\n`;
      }
      
      aiText += `\nSystem Status: Active monitoring with TensorFlow.js edge detection`;
    }

    return res.status(200).json({ 
      success: true, 
      ai_text: aiText,
      stats: {
        total,
        fish: fishCount,
        trash: trashCount,
        emergency: emergCount,
        windowHours
      }
    });
  } catch (err) {
    console.error('camera-events-ai error:', err);
    return res.status(500).json({ error: err.message });
  }
}
