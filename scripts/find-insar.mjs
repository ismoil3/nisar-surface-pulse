// Adds a NISAR interferogram (InSAR) picture to a site.
// It asks the Alaska Satellite Facility for NISAR L2 GUNW products over the site, picks the pair of
// passes that matches the site's own dates, downloads ASF's public browse picture of that interferogram
// (no login needed) and resamples it onto the site's radar grid.
// Usage: node scripts/find-insar.mjs <site>
// Output: public/data/<site>/insar.png (same footprint as the radar pictures) + insar.json
//
// The browse picture shows the phase of the interferogram in colour. It is a picture, not a measurement:
// millimetre values need the full HDF5 product (Earthdata login) and corrections for the atmosphere.
import { readFile, writeFile } from "node:fs/promises";
import { inflateSync, deflateSync, crc32 } from "node:zlib";

const site = process.argv[2] || "vakhsh_cascade";
const dir = new URL(`../public/data/${site}/`, import.meta.url);
let m;
try {
  m = JSON.parse(await readFile(new URL("manifest.json", dir)));
} catch {
  console.error(`No data for "${site}": public/data/${site}/manifest.json was not found.`);
  process.exit(1);
}

// ---------- 1. find the interferogram ----------
const dates = m.dates.map((d) => d.date);
const [lon, lat] = m.center;
const q = new URLSearchParams({
  dataset: "NISAR", processingLevel: "GUNW", intersectsWith: `POINT(${lon} ${lat})`,
  start: dates[0], end: dates.at(-1) + "T23:59:59Z", output: "jsonlite", maxResults: "250",
});
const res = await (await fetch("https://api.daac.asf.alaska.edu/services/search/param?" + q, { headers: { "User-Agent": "nisar-surface-pulse/1.0" } })).json();
const pad = (n) => String(n).padStart(3, "0");
const wantTrack = `_${pad(m.track)}_${m.direction[0]}_${pad(m.frame)}_`;
const iso = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const pairs = (res.results ?? [])
  .map((g) => {
    const t = g.granuleName.match(/_(\d{8})T\d{6}_\d{8}T\d{6}_(\d{8})T\d{6}_/);
    return t && g.granuleName.includes(wantTrack) && { g, a: iso(t[1]), b: iso(t[2]) };
  })
  .filter((p) => p && dates.includes(p.a) && dates.includes(p.b));
if (!pairs.length) {
  console.error(`No NISAR interferogram on track ${m.track}, frame ${m.frame} matches this site's dates.`);
  process.exit(1);
}
// an event site wants the pair around the event; otherwise the latest pair
const want = m.event?.closest_pair;
const pick = (want && pairs.find((p) => p.a === want[0] && p.b === want[1])) || pairs.sort((x, y) => (x.b < y.b ? 1 : -1))[0];
const browse = pick.g.browse.find((u) => u.endsWith("_LATLON.png"));
console.log(`interferogram ${pick.a} -> ${pick.b}: ${pick.g.granuleName}`);

// ---------- 2. read ASF's browse picture ----------
function readPng(b) {
  let p = 8, W, H, ct;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), t = b.toString("ascii", p + 4, p + 8);
    if (t === "IHDR") { W = b.readUInt32BE(p + 8); H = b.readUInt32BE(p + 12); ct = b[p + 17]; }
    if (t === "IDAT") idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  if (ct !== 6) throw new Error("expected an RGBA browse picture");
  const raw = inflateSync(Buffer.concat(idat)), st = W * 4, out = new Uint8Array(H * st);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (st + 1)], o = y * st, i = y * (st + 1) + 1;
    for (let x = 0; x < st; x++) {
      const a = x >= 4 ? out[o + x - 4] : 0, u = y ? out[o + x - st] : 0, c = x >= 4 && y ? out[o + x - st - 4] : 0;
      let v = raw[i + x];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const pa = Math.abs(u - c), pb = Math.abs(a - c), pc = Math.abs(a + u - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      out[o + x] = v;
    }
  }
  return { W, H, px: out };
}
function writePng(W, H, px) {
  const chunk = (t, d) => {
    const head = Buffer.alloc(8); head.writeUInt32BE(d.length, 0); head.write(t, 4, "ascii");
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), d])) >>> 0, 0);
    return Buffer.concat([head, d, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const src = readPng(Buffer.from(await (await fetch(browse)).arrayBuffer()));

// the picture is a plain lon/lat grid: its painted area spans the bounding box of the product footprint
let x0 = src.W, x1 = 0, y0 = src.H, y1 = 0;
for (let y = 0; y < src.H; y++)
  for (let x = 0; x < src.W; x++)
    if (src.px[(y * src.W + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
const ring = pick.g.wkt.match(/-?\d+\.?\d*\s+-?\d+\.?\d*/g).map((s) => s.split(/\s+/).map(Number));
const lons = ring.map((r) => r[0]), lats = ring.map((r) => r[1]);
const box = { w: Math.min(...lons), e: Math.max(...lons), s: Math.min(...lats), n: Math.max(...lats) };

// ---------- 3. resample onto the site's radar grid (at quarter size: the browse is about 250 m per pixel) ----------
const W = Math.round(m.image_size_px[0] / 2), H = Math.round(m.image_size_px[1] / 2);
const [tl, tr, br, bl] = m.corners, out = new Uint8Array(W * H * 4);
// "no data" in the browse is painted in one flat dark colour (the most common opaque colour)
const count = new Map();
for (let i = 0; i < src.px.length; i += 4) if (src.px[i + 3]) { const k = (src.px[i] << 16) | (src.px[i + 1] << 8) | src.px[i + 2]; count.set(k, (count.get(k) ?? 0) + 1); }
const nodata = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
let painted = 0;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W, v = (y + 0.5) / H;
    const lo = (1 - u) * (1 - v) * tl[0] + u * (1 - v) * tr[0] + u * v * br[0] + (1 - u) * v * bl[0];
    const la = (1 - u) * (1 - v) * tl[1] + u * (1 - v) * tr[1] + u * v * br[1] + (1 - u) * v * bl[1];
    const sx = Math.round(x0 + ((lo - box.w) / (box.e - box.w)) * (x1 - x0)), sy = Math.round(y0 + ((box.n - la) / (box.n - box.s)) * (y1 - y0));
    if (sx < 0 || sy < 0 || sx >= src.W || sy >= src.H) continue;
    const i = (sy * src.W + sx) * 4, o = (y * W + x) * 4;
    if (!src.px[i + 3] || ((src.px[i] << 16) | (src.px[i + 1] << 8) | src.px[i + 2]) === nodata) continue;
    out[o] = src.px[i]; out[o + 1] = src.px[i + 1]; out[o + 2] = src.px[i + 2]; out[o + 3] = 255;
    painted++;
  }
await writeFile(new URL("insar.png", dir), writePng(W, H, out));
await writeFile(new URL("insar.json", dir), JSON.stringify({
  image: "insar.png", from: pick.a, to: pick.b, granule: pick.g.granuleName, browse,
  coverage_pct: Math.round((100 * painted) / (W * H)),
  source: "NISAR L2 GUNW browse image, ASF DAAC",
}, null, 2) + "\n");
console.log(`wrote public/data/${site}/insar.png (${W} x ${H}, ${Math.round((100 * painted) / (W * H))}% covered) and insar.json`);
