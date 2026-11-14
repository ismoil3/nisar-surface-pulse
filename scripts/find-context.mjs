// Downloads context layers for a site from OpenStreetMap (Overpass API):
// rivers, towns/villages (with population when OSM has it) and dams inside the scene box.
// Usage: node scripts/find-context.mjs <site>
// Output: public/data/<site>/context.json  { rivers: GeoJSON, places: [...], dams: [...] }
import { readFile, writeFile } from "node:fs/promises";

const site = process.argv[2] || "vakhsh_cascade";
const dir = new URL(`../public/data/${site}/`, import.meta.url);
let m;
try {
  m = JSON.parse(await readFile(new URL("manifest.json", dir)));
} catch {
  console.error(`No data for "${site}": public/data/${site}/manifest.json was not found.`);
  process.exit(1);
}
const lons = m.corners.map((c) => c[0]), lats = m.corners.map((c) => c[1]);
const bbox = [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)].join(",");

const query = `[out:json][timeout:60];
(
  way["waterway"="river"](${bbox});
  node["place"~"^(city|town|village)$"](${bbox});
  way["waterway"="dam"](${bbox});
  node["waterway"="dam"](${bbox});
);
out tags geom;`;

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
let data;
for (const url of ENDPOINTS) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "nisar-surface-pulse/1.0" },
      body: "data=" + encodeURIComponent(query),
    });
    if (r.ok) { data = await r.json(); break; }
    console.error(url, "->", r.status);
  } catch (e) {
    console.error(url, "->", e.message);
  }
}
if (!data) { console.error("Overpass did not answer; try again later."); process.exit(1); }

const name = (t) => t["name:en"] || t["int_name"] || t.name || null;
const round = (x) => +x.toFixed(5);
const rivers = { type: "FeatureCollection", features: [] };
const places = [], dams = [];
for (const el of data.elements) {
  const t = el.tags || {};
  if (el.type === "way" && t.waterway === "river") {
    rivers.features.push({
      type: "Feature", properties: { name: name(t) },
      geometry: { type: "LineString", coordinates: el.geometry.map((p) => [round(p.lon), round(p.lat)]) },
    });
  } else if (el.type === "node" && t.place) {
    places.push({ name: name(t), local: t.name || null, names: { ru: t["name:ru"] || null, tg: t["name:tg"] || null }, kind: t.place, population: t.population ? +t.population : null, lonlat: [round(el.lon), round(el.lat)] });
  } else if (t.waterway === "dam") {
    const g = el.geometry || [{ lon: el.lon, lat: el.lat }];
    const lon = g.reduce((a, p) => a + p.lon, 0) / g.length, lat = g.reduce((a, p) => a + p.lat, 0) / g.length;
    dams.push({ name: name(t), local: t.name || null, names: { ru: t["name:ru"] || null, tg: t["name:tg"] || null }, lonlat: [round(lon), round(lat)] });
  }
}
places.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
await writeFile(new URL("context.json", dir), JSON.stringify({ source: "© OpenStreetMap contributors (ODbL), via Overpass API", rivers, places, dams }) + "\n");
console.log(`rivers: ${rivers.features.length} ways (${[...new Set(rivers.features.map((f) => f.properties.name).filter(Boolean))].join(", ")})`);
console.log(`places: ${places.length}`, places.slice(0, 12).map((p) => `${p.name}${p.population ? " (" + p.population + ")" : ""}`).join(", "));
console.log(`dams: ${dams.length}`, JSON.stringify(dams));
