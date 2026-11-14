// Finds, for every NISAR date of a site, the best nearby optical photo
// (NASA HLS: Landsat 30 m + Sentinel-2 30 m, served by NASA GIBS, no key needed).
// "Best" = covers the scene, few clouds, as close to the radar date as possible.
// Usage: node scripts/find-optical.mjs <site>        (works for any folder in public/data/)
// Output: public/data/<site>/optical.json
//   [{ date, optical: { layer, date, offset_days, cloud_pct } | null }]
import { readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const site = process.argv[2] || "nurek";
const dir = new URL(`../public/data/${site}/`, import.meta.url);
let m;
try {
  m = JSON.parse(await readFile(new URL("manifest.json", dir)));
} catch {
  console.error(`No data for "${site}": public/data/${site}/manifest.json was not found.\n` +
    `Put the site's folder (manifest.json + HH/HV/RGB PNGs) into public/data/ first, then run this again.`);
  process.exit(1);
}

const LAYERS = ["HLS_S30_Nadir_BRDF_Adjusted_Reflectance", "HLS_L30_Nadir_BRDF_Adjusted_Reflectance"];
const Z = 9;              // tile zoom used for scoring (~230 m per pixel here)
const MAX_OFFSET = 6;     // search +-6 days around the radar pass
const MIN_COVER = 0.9;    // photo must cover 90% of the scene
const DAY_PENALTY = 5;    // one day away costs as much as 5% cloud
const CLEAR = 8;          // below 8% cloud counts as clear
const tileUrl = (layer, date, x, y) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level12/${Z}/${y}/${x}.png`;

// ---- scene footprint in tile-pixel space ----
const N = 2 ** Z;
const lon2fx = (lon) => ((lon + 180) / 360) * N;
const lat2fy = (lat) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N;
};
const lons = m.corners.map((c) => c[0]), lats = m.corners.map((c) => c[1]);
const fx0 = lon2fx(Math.min(...lons)), fx1 = lon2fx(Math.max(...lons));
const fy0 = lat2fy(Math.max(...lats)), fy1 = lat2fy(Math.min(...lats));
const tiles = [];
for (let x = Math.floor(fx0); x <= Math.floor(fx1); x++)
  for (let y = Math.floor(fy0); y <= Math.floor(fy1); y++) tiles.push([x, y]);

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

/** Share of the scene that has data, and share of that data that is cloud (bright and grey-white). */
async function score(layer, date) {
  let total = 0, valid = 0, cloud = 0;
  await Promise.all(
    tiles.map(async ([tx, ty]) => {
      let img = null;
      try {
        const r = await fetch(tileUrl(layer, date, tx, ty));
        if (r.ok) img = decodePng(Buffer.from(await r.arrayBuffer()));
      } catch { /* treat as empty */ }
      const S = 256;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const gx = tx + (x + 0.5) / S, gy = ty + (y + 0.5) / S;
          if (gx < fx0 || gx > fx1 || gy < fy0 || gy > fy1) continue;
          total++;
          if (!img) continue;
          const i = (y * img.w + x) * img.ch;
          if (img.ch === 4 && img.px[i + 3] === 0) continue;
          valid++;
          const r = img.px[i], g = img.px[i + 1], b = img.px[i + 2];
          if (Math.min(r, g, b) > 175 && Math.max(r, g, b) - Math.min(r, g, b) < 40) cloud++;
        }
    })
  );
  return { cover: valid / total, cloud: valid ? (100 * cloud) / valid : 100 };
}

const shift = (iso, days) => new Date(Date.parse(iso + "T00:00:00Z") + days * 864e5).toISOString().slice(0, 10);

const out = [];
for (const d of m.dates) {
  let best = null;
  for (let off = -MAX_OFFSET; off <= MAX_OFFSET; off++) {
    const date = shift(d.date, off);
    for (const layer of LAYERS) {
      const s = await score(layer, date);
      if (s.cover < MIN_COVER) continue;
      const cost = (s.cloud < CLEAR ? 0 : s.cloud) + DAY_PENALTY * Math.abs(off);
      if (!best || cost < best.cost) best = { layer, date, offset_days: off, cloud_pct: Math.round(s.cloud), cost };
    }
  }
  console.log(d.date, "->", best
    ? `${best.date} (${best.offset_days >= 0 ? "+" : ""}${best.offset_days} d) ${best.layer.slice(0, 7)} cloud ${best.cloud_pct}%`
    : "none");
  if (best) delete best.cost;
  out.push({ date: d.date, optical: best });
}
await writeFile(new URL("optical.json", dir), JSON.stringify(out, null, 2) + "\n");
console.log(`wrote public/data/${site}/optical.json`);
