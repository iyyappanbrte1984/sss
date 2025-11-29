export default async function handler(req, res) {
  // This endpoint just returns configuration for the frontend:
  // - basemap URL template (Planet tiles)
  // - center and zoom
  // - and (optionally) time range
  // Your PLANET_API_KEY stays on the server; we don't expose it directly.
  try {
    // For now we’ll return a simple config. If needed, you can later
    // call Planet APIs here to dynamically choose the best basemap, etc.
    const planetBasemap = {
      // Example Web Mercator basemap for Planet (YOU may need to adjust
      // based on your Planet plan and basemap type)
      // This assumes you have access to a Planet Tiles basemap endpoint.
      // If not, we can later switch to static imagery.
      urlTemplate: "https://tiles.planet.com/basemaps/v1/planet-tiles/global_monthly_{year}_{month}_mosaic/gmap/{z}/{x}/{y}.png?api_key={apiKey}",
      minZoom: 2,
      maxZoom: 18
    };

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      ok: true,
      basemap: planetBasemap,
      currentYear: year,
      currentMonth: month,
      // Center roughly around Tamil Nadu / Bay of Bengal
      mapCenter: { lat: 11.0, lng: 79.0 },
      mapZoom: 6
    });
  } catch (e) {
    console.error("planet-imagery error:", e);
    res.status(500).json({ ok: false, error: e.message || "Planet config error" });
  }
}
