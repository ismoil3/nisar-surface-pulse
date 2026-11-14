// For a sudden event (flood): the CLEAREST optical photo before the event and the clearest after it,
// searched over whole months (not only +-6 days around a radar pass), scored on the area that matters
// (the 10 m close-up of the lower valley when there is one). In the monsoon the photos next to the
// radar passes are 30-90% cloud, so a fair camera before / after needs this wider search.
// NASA HLS (Landsat 30 m + Sentinel-2 30 m) via NASA GIBS, no key.
// Usage: node scripts/find-clear-pair.mjs nepal [YYYY-MM-DD first day to search]
// Output: public/data/<site>/clear_pair.json
import { readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const site = process.argv[2] || "nepal";
const FROM = process.argv[3] || "2026-03-01";
const dir = new URL(`../public/data/${site}/`, import.meta.url);
const m = JSON.parse(await readFile(new URL("manifest.json", dir)));
if (!m.event) { console.error("this site has no event"); process.exit(1); }
let area = m.corners, areaName = "site";
if (m.event.closeup) {
  const c = JSON.parse(await readFile(new URL(m.event.closeup, dir)));
  area = c.corners; areaName = "closeup";
}
const LAYERS = ["HLS_S30_Nadir_BRDF_Adjusted_Reflectance", "HLS_L30_Nadir_BRDF_Adjusted_Reflectance"];
const Z = 10, MIN_COVER = 0.95;
const tileUrl = (layer, date, x, y) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level12/${Z}/${y}/${x}.png`;
const N = 2 ** Z;
const lon2fx = (lon) => ((lon + 180) / 360) * N;
const lat2fy = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N; };
const lons = area.map((c) => c[0]), lats = area.map((c) => c[1]);
const fx0 = lon2fx(Math.min(...lons)), fx1 = lon2fx(Math.max(...lons));
const fy0 = lat2fy(Math.max(...lats)), fy1 = lat2fy(Math.min(...lats));
const tiles = [];
for (let x = Math.floor(fx0); x <= Math.floor(fx1); x++) for (let y = Math.floor(fy0); y <= Math.floor(fy1); y++) tiles.push([x, y]);

// ---- minimal PNG decoder (8-bit RGB / RGBA, non-interlaced) ----
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ch = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("latin1", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      const ct = data[9];
      if (data[8] !== 8 || (ct !== 2 && ct !== 6) || data[12] !== 0) return null;
      ch = ct === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * ch, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? out[dst + i - ch] : 0;
      const b = y ? out[dst - stride + i] : 0;
      const c = y && i >= ch ? out[dst - stride + i - ch] : 0;
      let v = raw[src + i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + i] = v;
    }
  }
  return { w, h, ch, px: out };
}


/** Share of the area with data, and share of that data that is cloud (bright and grey-white), as in find-optical.mjs. */
async function score(layer, date) {
  let total = 0, valid = 0, cloud = 0;
  await Promise.all(tiles.map(async ([tx, ty]) => {
    let img = null;
    for (let i = 0; i < 3 && !img; i++) {
      try { const r = await fetch(tileUrl(layer, date, tx, ty)); if (r.ok) img = decodePng(Buffer.from(await r.arrayBuffer())); else if (r.status < 500) break; } catch { /* retry */ }
    }
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const gx = tx + (x + 0.5) / 256, gy = ty + (y + 0.5) / 256;
      if (gx < fx0 || gx > fx1 || gy < fy0 || gy > fy1) continue;
      total++;
      if (!img) continue;
      const i = (y * img.w + x) * img.ch;
      if (img.ch === 4 && img.px[i + 3] === 0) continue;
      valid++;
      const r = img.px[i], g = img.px[i + 1], b = img.px[i + 2];
      if (Math.min(r, g, b) > 175 && Math.max(r, g, b) - Math.min(r, g, b) < 40) cloud++;
    }
  }));
  return { cover: valid / total, cloud: valid ? (100 * cloud) / valid : 100 };
}
const shift = (iso, d) => new Date(Date.parse(iso + "T00:00:00Z") + d * 864e5).toISOString().slice(0, 10);
const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);

const ev = m.event.date, today = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
const all = [];
for (let d = FROM; d <= today; d = shift(d, 1)) {
  if (d === ev) continue;
  for (const layer of LAYERS) all.push({ layer, date: d });
}
let done = 0;
const found = [];
const queue = [...all];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const c = queue.shift();
    const s = await score(c.layer, c.date);
    if (++done % 50 === 0) console.error(`${done}/${all.length}`);
    if (s.cover >= MIN_COVER) found.push({ ...c, cloud_pct: +s.cloud.toFixed(1) });
  }
}));
// clearest first; among nearly equally clear photos (within 2%), the one closest to the event
const pick = (list) => list.sort((a, b) => (Math.abs(a.cloud_pct - b.cloud_pct) > 2 ? a.cloud_pct - b.cloud_pct : Math.abs(days(a.date, ev)) - Math.abs(days(b.date, ev))))[0] ?? null;
const before = pick(found.filter((x) => x.date < ev)), after = pick(found.filter((x) => x.date > ev));
const show = (x) => x && `${x.date} ${x.layer.slice(4, 7)} cloud ${x.cloud_pct}%`;
console.log(`photos with full cover: ${found.length}; before: ${show(before)}; after: ${show(after)}`);
console.log("clearest 5 before:", found.filter((x) => x.date < ev).sort((a, b) => a.cloud_pct - b.cloud_pct).slice(0, 5).map(show).join(" | "));
console.log("clearest 5 after:", found.filter((x) => x.date > ev).sort((a, b) => a.cloud_pct - b.cloud_pct).slice(0, 5).map(show).join(" | "));
const strip = (x) => x && { layer: x.layer, date: x.date, cloud_pct: Math.round(x.cloud_pct), days_from_event: days(x.date, ev) };
await writeFile(new URL("clear_pair.json", dir), JSON.stringify({ area: areaName, searched: [FROM, today], event: ev, before: strip(before), after: strip(after) }, null, 1) + "\n");
