// Usage: node scripts/check-asf.mjs public/data/<site> <asfDir from asf-browse.mjs> [YYYY-MM-DD of our pass] [YYYYMMDD of a pass with a NATIVE.kml]
// Results of 2026-11-13 are in docs/PROJECT_LOG.md. Browse pictures are auto-stretched per image, so lake areas use a relative threshold.
// Independent check of our Vakhsh data against ASF's own public browse pictures of the same NISAR passes.
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
const APP = process.argv[2], ASF = process.argv[3];

function readPng(path) {
  const b = readFileSync(path);
  let p = 8, W, H, ct; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), t = b.toString("ascii", p + 4, p + 8);
    if (t === "IHDR") { W = b.readUInt32BE(p + 8); H = b.readUInt32BE(p + 12); ct = b[p + 17]; }
    if (t === "IDAT") idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const bpp = { 0: 1, 4: 2, 2: 3, 6: 4 }[ct];
  const raw = inflateSync(Buffer.concat(idat)), st = W * bpp, out = new Uint8Array(H * st);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (st + 1)], o = y * st, i = y * (st + 1) + 1;
    for (let x = 0; x < st; x++) {
      const a = x >= bpp ? out[o + x - bpp] : 0, u = y ? out[o + x - st] : 0, c = x >= bpp && y ? out[o + x - st - bpp] : 0;
      let v = raw[i + x];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const pa = Math.abs(u - c), pb = Math.abs(a - c), pc = Math.abs(a + u - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      out[o + x] = v;
    }
  }
  return { W, H, bpp, px: out };
}
// same Krüger series as src/lib/nisar.js
function utm(lon, lat, zone) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  const n = f / (2 - f), A = (a / (1 + n)) * (1 + (n * n) / 4 + n ** 4 / 64);
  const al = [n / 2 - (2 / 3) * n * n + (5 / 16) * n ** 3, (13 / 48) * n * n - (3 / 5) * n ** 3, (61 / 240) * n ** 3];
  const phi = (lat * Math.PI) / 180, lam = ((lon - (zone * 6 - 183)) * Math.PI) / 180, e = Math.sqrt(f * (2 - f));
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(lam)), eta = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
  let E = eta, N = xi;
  for (let k = 1; k <= 3; k++) { E += al[k - 1] * Math.cos(2 * k * xi) * Math.sinh(2 * k * eta); N += al[k - 1] * Math.sin(2 * k * xi) * Math.cosh(2 * k * eta); }
  return [500000 + k0 * A * E, k0 * A * N];
}
const m = JSON.parse(readFileSync(`${APP}/manifest.json`));
const Z = m.epsg_source - 32600, W = m.image_size_px[0], H = m.image_size_px[1];
const c = m.corners.map(([lo, la]) => utm(lo, la, Z));
const g = { x0: (c[0][0] + c[3][0]) / 2, x1: (c[1][0] + c[2][0]) / 2, y0: (c[0][1] + c[1][1]) / 2, y1: (c[2][1] + c[3][1]) / 2 };
console.log(`our grid: ${W}x${H}, pixel ${((g.x1 - g.x0) / W).toFixed(2)} x ${((g.y0 - g.y1) / H).toFixed(2)} m`);

// ASF browse grid from its KML quad (LL, LR, UR, UL)
const kml = readFileSync(`${ASF}/${process.argv[5] || "20261106"}_NATIVE.kml`, "utf8").match(/<coordinates>([^<]+)</)[1].trim().split(/\s+/).map((s) => s.split(",").map(Number));
const q = kml.map(([lo, la]) => utm(lo, la, Z));
console.log("ASF quad in UTM (LL, LR, UR, UL):", q.map((p) => p.map((v) => Math.round(v))).join(" | "));
const bx0 = (q[0][0] + q[3][0]) / 2, bx1 = (q[1][0] + q[2][0]) / 2, by1 = (q[0][1] + q[1][1]) / 2, by0 = (q[2][1] + q[3][1]) / 2;

const DB = (v) => -35 + ((v - 1) * 35) / 254;
function ours(file) { const p = readPng(`${APP}/${file}`); const o = new Float32Array(W * H).fill(NaN); for (let j = 0; j < W * H; j++) if (p.px[j * 2 + 1]) o[j] = DB(p.px[j * 2]); return o; }
function asf(date, pol = "HHHH") {
  const p = readPng(`${ASF}/${date}_A_${pol}.png`);
  const sx = (bx1 - bx0) / p.W, sy = (by0 - by1) / p.H;
  return { ...p, sx, sy, at(e, n) { // nearest pixel value at a UTM position, NaN for no-data (0 or 255 borders)
    const x = Math.floor((e - bx0) / sx), y = Math.floor((by0 - n) / sy);
    if (x < 0 || y < 0 || x >= p.W || y >= p.H) return NaN;
    const v = p.px[y * p.W + x]; return v === 255 ? NaN : v; },
    raw(e, n) { const x = Math.floor((e - bx0) / sx), y = Math.floor((by0 - n) / sy); return x < 0 || y < 0 || x >= p.W || y >= p.H ? NaN : p.px[y * p.W + x]; } };
}
const E = (x) => g.x0 + ((x + 0.5) / W) * (g.x1 - g.x0), N = (y) => g.y0 - ((y + 0.5) / H) * (g.y0 - g.y1);

// 1) geometry + radiometry: correlation of our HH (dB) with ASF's HH browse, same pass, searching small shifts
const D0 = process.argv[4] || "2026-10-13";
const hh = ours(`${D0}_HH.png`), b13 = asf(D0.replaceAll("-", ""));
console.log(`ASF browse: ${b13.W}x${b13.H}, pixel ${b13.sx.toFixed(1)} x ${b13.sy.toFixed(1)} m`);
function corr(dx, dy) {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let y = 2; y < H - 2; y += 2) for (let x = 2; x < W - 2; x += 2) {
    const a = hh[y * W + x]; if (Number.isNaN(a)) continue;
    const b = b13.at(E(x) + dx, N(y) + dy); if (Number.isNaN(b)) continue;
    n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
  }
  return (sab / n - (sa / n) * (sb / n)) / Math.sqrt((saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2));
}
let best = { r: -1 };
for (let dy = -300; dy <= 300; dy += 50) for (let dx = -300; dx <= 300; dx += 50) { const r = corr(dx, dy); if (r > best.r) best = { r, dx, dy }; }
{ const c0 = { ...best }; for (let dy = c0.dy - 50; dy <= c0.dy + 50; dy += 10) for (let dx = c0.dx - 50; dx <= c0.dx + 50; dx += 10) { const r = corr(dx, dy); if (r > best.r) best = { r, dx, dy }; } }
// how fast the match drops with a shift (sensitivity of the test)
console.log("r at 180 m shifts:", [[180,0],[-180,0],[0,180],[0,-180]].map(([a,b]) => corr(a,b).toFixed(3)).join(" "));
// HV too
{ const hv = ours(`${D0}_HV.png`), v13 = asf(D0.replaceAll("-", ""), "HVHV"); let n=0,sa=0,sb=0,saa=0,sbb=0,sab=0;
  for (let y = 2; y < H - 2; y += 2) for (let x = 2; x < W - 2; x += 2) { const a = hv[y*W+x]; if (Number.isNaN(a)) continue; const b = v13.at(E(x), N(y)); if (Number.isNaN(b)) continue; n++; sa+=a; sb+=b; saa+=a*a; sbb+=b*b; sab+=a*b; }
  console.log("HV 2026-10-13 ours vs ASF r =", ((sab/n-(sa/n)*(sb/n))/Math.sqrt((saa/n-(sa/n)**2)*(sbb/n-(sb/n)**2))).toFixed(3)); }
console.log(`HH 2026-10-13, ours vs ASF: r = ${corr(0, 0).toFixed(3)} at zero shift; best r = ${best.r.toFixed(3)} at shift E${best.dx} m, N${best.dy} m`);

// 2) water: rasterize our outlines on our grid (scanline, even-odd)
function rasterize(geo, filter) {
  const mask = new Uint8Array(W * H);
  for (const f of geo.features) {
    if (filter && !filter(f)) continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      const rings = poly.map((r) => r.map(([lo, la]) => { const [e, n] = utm(lo, la, Z); return [((e - g.x0) / (g.x1 - g.x0)) * W, ((g.y0 - n) / (g.y0 - g.y1)) * H]; }));
      for (let y = 0; y < H; y++) {
        const yc = y + 0.5, xs = [];
        for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
          const [xi, yi] = r[i], [xj, yj] = r[j];
          if ((yi > yc) !== (yj > yc)) xs.push(xi + ((yc - yi) * (xj - xi)) / (yj - yi));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x < Math.min(W, xs[k + 1] - 0.5); x++) mask[y * W + x] ^= 1;
      }
    }
  }
  return mask;
}
if (!m.dates.some((d) => d.water)) process.exit(0);
const px = (m.pixel_m * m.pixel_m) / 1e6;
const res = {};
for (const R of ["Nurek", "Rogun"]) {
  const filt = (f) => f.properties?.reservoir === R;
  const w13 = rasterize(JSON.parse(readFileSync(`${APP}/water_2026-10-13.geojson`)), filt);
  // where the lake can be: union of all our outlines, grown by ~1 km
  const uni = new Uint8Array(W * H);
  for (const d of m.dates) if (d.water) { const w = rasterize(JSON.parse(readFileSync(`${APP}/${d.water}`)), filt); for (let j = 0; j < w.length; j++) uni[j] |= w[j]; }
  const zone = new Uint8Array(W * H), r = 16;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (uni[y * W + x]) for (let dy = -r; dy <= r; dy += 4) for (let dx = -r; dx <= r; dx += 4) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) zone[yy * W + xx] = 1; }
  let ourKm = 0; for (let j = 0; j < w13.length; j++) ourKm += w13[j]; ourKm *= px;
  // pick the ASF darkness threshold that best reproduces our 13 Oct outline (IoU), using the best shift
  const sample = (b, x, y) => b.raw(E(x) + best.dx, N(y) + best.dy);
  let bt = { iou: 0 };
  for (let t = 10; t <= 120; t += 2) {
    let i = 0, u = 0;
    for (let j = 0; j < W * H; j++) { if (!zone[j]) continue; const v = sample(b13, j % W, (j / W) | 0); const dk = v < t; if (dk && w13[j]) i++; if (dk || w13[j]) u++; }
    if (i / u > bt.iou) bt = { iou: i / u, t };
  }
  const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
  const meds = (b) => { const dry = [], wet = []; for (let j = 0; j < W * H; j += 3) { if (!zone[j]) continue; const v = sample(b, j % W, (j / W) | 0); if (Number.isNaN(v)) continue; if (!uni[j]) dry.push(v); else if (w13[j]) wet.push(v); } return [med(wet), med(dry)]; };
  const [w0, d0] = meds(b13), frac = (bt.t - w0) / (d0 - w0);
  const otsu = (vals) => { const h = new Float64Array(256); vals.forEach((v) => h[v]++); let tot = vals.length, sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i]; let sB = 0, wB = 0, best = 0, th = 0; for (let i = 0; i < 256; i++) { wB += h[i]; if (!wB) continue; const wF = tot - wB; if (!wF) break; sB += i * h[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = i; } } return th; };
  const row = { ourKm: +ourKm.toFixed(2), thr: bt.t, iou: +bt.iou.toFixed(3), frac: +frac.toFixed(3) };
  for (const d of ["20260907", "20260919", "20261001", "20261013", "20261025", "20261106"]) {
    const b = asf(d); let n = 0, nd = 0, no = 0;
    const [wm, dm] = meds(b), t = wm + frac * (dm - wm);
    const vals = []; for (let j = 0; j < W * H; j++) if (zone[j]) { const v = sample(b, j % W, (j / W) | 0); if (!Number.isNaN(v)) vals.push(v); }
    const to = otsu(vals);
    for (let j = 0; j < W * H; j++) { if (!zone[j]) continue; const v = sample(b, j % W, (j / W) | 0); if (Number.isNaN(v)) { nd++; continue; } if (v < t) n++; if (v < to) no++; }
    // stretch check: median browse value on surely-dry ground (zone but never water) and on surely-wet (water on 13 Oct, deep inside)
    row[d] = `relative thr ${t.toFixed(0)}: ${(n * px).toFixed(1)} km² | otsu ${to}: ${(no * px).toFixed(1)} km²`;
  }
  res[R] = row;
}
console.log(JSON.stringify(res, null, 1));
console.log("our series:", m.dates.slice(-3).map((d) => `${d.date} N=${d.reservoirs.nurek?.area_km2} R=${d.reservoirs.rogun?.area_km2}`).join("; "));
