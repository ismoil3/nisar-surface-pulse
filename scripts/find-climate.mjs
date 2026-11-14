// Daily air temperature and rain for the "why" behind each story, from NASA POWER
// (MERRA-2 / GEOS-IT model re-analysis on a ~50 km grid, free, no login): https://power.larc.nasa.gov
// These are grid-cell values, not weather-station readings.
// Usage: node scripts/find-climate.mjs            Output: public/data/climate.json
import { writeFile } from "node:fs/promises";

const POINTS = {
  pamir: { lonlat: [71.5, 39.0], sites: ["vakhsh_cascade"] },   // upper Vakhsh (Surkhob) basin, where the melt water comes from
  valley: { lonlat: [68.78, 37.84], sites: ["vakhsh"] },         // Bokhtar, the irrigated farmland
  nepal: { lonlat: [85.3, 28.1], sites: ["nepal"] },             // Rasuwa, upper Trishuli valley
};
const START = "20260601";
const end = new Date(Date.now() - 864e5).toISOString().slice(0, 10).replaceAll("-", "");

const out = { source: "NASA POWER (MERRA-2 / GEOS-IT), daily, grid cell about 50 km; https://power.larc.nasa.gov", fetched: new Date().toISOString().slice(0, 10), points: {} };
for (const [id, p] of Object.entries(POINTS)) {
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=${p.lonlat[0]}&latitude=${p.lonlat[1]}&start=${START}&end=${end}&format=JSON`;
  const r = await fetch(url);
  if (!r.ok) { console.error(id, r.status); process.exit(1); }
  const j = await r.json();
  const T = j.properties.parameter.T2M, P = j.properties.parameter.PRECTOTCORR;
  const days = Object.keys(T).filter((d) => T[d] > -900 && P[d] > -900);
  // a single day far above everything else (seen: 349.5 mm on 3 Jun 2026 in the mountain cell, next highest 24.5 mm)
  // is treated as a model artefact: it is kept in "suspect" and left out of the series (null), never silently changed
  const rain = days.map((d) => +P[d].toFixed(1)), top = [...rain].sort((a, b) => b - a);
  const suspect = rain.map((v, i) => (v > 150 && v > 5 * top[1] ? { date: `${days[i].slice(0, 4)}-${days[i].slice(4, 6)}-${days[i].slice(6)}`, mm: v } : null)).filter(Boolean);
  out.points[id] = {
    suspect,
    lonlat: p.lonlat, sites: p.sites, cell_elevation_m: Math.round(j.geometry.coordinates[2]),
    start: `${days[0].slice(0, 4)}-${days[0].slice(4, 6)}-${days[0].slice(6)}`,
    t: days.map((d) => +T[d].toFixed(1)), p: rain.map((v) => (suspect.some((x) => x.mm === v) ? null : v)),
  };
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  console.log(id, days.length, "days to", days.at(-1), "| cell height", out.points[id].cell_elevation_m, "m | mean T", (sum(out.points[id].t) / days.length).toFixed(1), "°C | rain", sum(out.points[id].p).toFixed(0), "mm", suspect.length ? "| left out: " + JSON.stringify(suspect) : "");
}
await writeFile(new URL("../public/data/climate.json", import.meta.url), JSON.stringify(out) + "\n");
