// api/ocean-data-layers.js

export default async function handler(req, res) {
  try {
    const { layer, daysAgo = 0 } = req.query || {};
    const dAgo = Number(daysAgo) || 0;

    // Convert daysAgo to a date string (YYYY-MM-DD) if you later need it
    const now = new Date();
    const target = new Date(now.getTime() - dAgo * 24 * 60 * 60 * 1000);
    const y = target.getUTCFullYear();
    const m = String(target.getUTCMonth() + 1).padStart(2, "0");
    const day = String(target.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;

    // For now, use NASA GIBS-style demo tile URLs and similar open products.
    // Later you can swap these for specific MODIS/VIIRS/SST products.
    // All tiles use Web Mercator (EPSG:3857) xyz format.

    let config;

    switch (layer) {
      case "chlorophyll":
        // Example: NASA GIBS-like chlorophyll visualization (placeholder XYZ)
        config = {
          id: "chlorophyll",
          title: "Chlorophyll Concentration",
          date: dateStr,
          // Replace this with a real GIBS WMTS/XYZ endpoint when you have it.
          tileUrl:
            "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Aqua_Chlorophyll_A/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
          // We inject {date} client-side.
          attribution: "Imagery: NASA EOSDIS GIBS (chlorophyll)",
          min: 0,
          max: 20,
          units: "mg m^-3",
          palette: "blue-green-yellow"
        };
        break;

      case "sst":
        // Example: SST visualization (placeholder XYZ; swap for NOAA product later)
        config = {
          id: "sst",
          title: "Sea Surface Temperature",
          date: dateStr,
          tileUrl:
            "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Aqua_L3_SST_MidIR/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
          attribution: "Imagery: NASA / NOAA SST visualization",
          min: -2,
          max: 35,
          units: "°C",
          palette: "blue-yellow-red"
        };
        break;

      default:
        res.status(400).json({ error: "Unknown layer", layer });
        return;
    }

    // Attach resolved date string
    config.date = dateStr;

    res.setHeader("Content-Type", "application/json");
    res.status(200).json(config);
  } catch (err) {
    console.error("ocean-data-layers error", err);
    res.status(500).json({ error: "Server error" });
  }
}
