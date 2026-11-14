// NISAR data helpers: loading, dB decoding, rendering, change detection, point sampling.
// Data layout: one folder per site in public/data/ with manifest.json (see README.md and CLAUDE.md).

import { fmtDateL } from "./i18n.jsx";

export const DATA_ROOT = `${import.meta.env.BASE_URL}data/`;
export const SITES = ["vakhsh_cascade", "vakhsh", "nepal"]; // missing folders are skipped
export const STRETCH = { hh: [-25, 0], hv: [-32, -8] }; // display stretch in dB (same as RGB product)

export const abs = (p) => new URL(p, location.href).href;
const powToDb = (p) => 10 * Math.log10(p);

// ---------- loading ----------
async function loadGray(url) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const cv = document.createElement("canvas");
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const out = new Uint8Array(cv.width * cv.height); // 0 = no data
  for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = d[i + 3] === 0 ? 0 : Math.max(1, d[i]);
  return out;
}

export async function probeSites() {
  const found = [];
  await Promise.all(
    SITES.map(async (id) => {
      try {
        const r = await fetch(`${DATA_ROOT}${id}/manifest.json`);
        if (r.ok) found.push({ id, m: await r.json() });
      } catch {
        /* missing site */
      }
    })
  );
  return found.sort((a, b) => SITES.indexOf(a.id) - SITES.indexOf(b.id));
}

/** Loads every scene of a site into memory. Returns a "dataset" used by all helpers below. */
export async function loadDataset(site, onProgress) {
  const m = site.m;
  const base = `${DATA_ROOT}${site.id}/`;
  const DB = new Float32Array(256);
  const POW = new Float32Array(256);
  for (let v = 1; v < 256; v++) {
    DB[v] = m.encoding.db_min + ((v - 1) * (m.encoding.db_max - m.encoding.db_min)) / 254;
    POW[v] = Math.pow(10, DB[v] / 10);
  }
  normalizeReservoirs(m);
  // processing version of each pass: CRID P05036 and later = NISAR VALIDATED data, P05023 = PROVISIONAL
  for (const d of m.dates) d.validated = +((d.granule ?? "").match(/_P(\d{5})_/)?.[1] ?? 0) >= 5036;
  const ds = {
    id: site.id, m, base, DB, POW,
    w: m.image_size_px[0], h: m.image_size_px[1],
    raw: { hh: [], hv: [] }, water: [], optical: [],
    cache: { url: {}, smooth: { hh: [], hv: [] }, mask: {}, wdiff: {}, pol: {} },
    context: null, insar: null,
  };
  // optional: nearest optical image per date (made by scripts/find-optical.mjs)
  try {
    const list = await (await fetch(base + "optical.json")).json();
    ds.optical = m.dates.map((d) => list.find((o) => o.date === d.date)?.optical ?? null);
  } catch {
    ds.optical = m.dates.map(() => null);
  }
  // optional: rivers, villages and dams from OpenStreetMap (made by scripts/find-context.mjs)
  try {
    ds.context = await (await fetch(base + "context.json")).json();
  } catch {
    ds.context = null;
  }
  // optional: a NISAR interferogram picture on the same footprint (made by scripts/find-insar.mjs)
  try {
    const i = await (await fetch(base + "insar.json")).json();
    ds.insar = { ...i, url: abs(base + i.image) };
  } catch {
    ds.insar = null;
  }
  // optional: real ground motion from NISAR InSAR (GUNW pairs), made by the team (centimetres along the radar line of sight)
  ds.motion = null;
  if (m.motion) {
    try {
      const mb = base + m.motion.replace(/[^/]*$/, "");
      const mo = await (await fetch(base + m.motion)).json();
      const rows = (await (await fetch(mb + mo.timeseries)).text()).trim().split(/\r?\n/).map((l) => l.split(","));
      const head = rows.shift();
      const series = Object.fromEntries(head.slice(1).map((h, c) => [h, rows.map((r) => +r[c + 1])]));
      ds.motion = { ...mo, series, seriesDates: rows.map((r) => r[0]), url: { coh: abs(mb + mo.layers.coherence), sig: abs(mb + mo.layers.significant) } };
    } catch { ds.motion = null; }
  }
  // optional: the same reservoir measured from a second orbit (independent check, often newer dates)
  ds.orbit2 = null;
  if (m.orbit2) {
    try { ds.orbit2 = await (await fetch(base + m.orbit2)).json(); } catch { ds.orbit2 = null; }
  }
  // keep the map readable: only settlements with a known population, or towns and cities
  if (ds.context?.places)
    ds.context.places = ds.context.places.filter((p) => p.population || p.kind !== "village").slice(0, 30);
  // optional: a sudden event (flood, landslide) with before/after dates and ready-made change maps
  ds.event = m.event ? await loadEvent(m, base) : null;
  // optional: a farmland test (crop growth from the HV echo) with its median time series
  ds.farm = m.farmland ? await loadFarm(m, base) : null;
  // the event's named places (and the close-up's) become map markers when OpenStreetMap had nothing
  if (ds.event?.places) {
    const have = new Set((ds.context?.places ?? []).map((p) => p.name));
    // skip a named place that sits within ~1.5 km of a settlement already on the map (e.g. "Trishuli Bazar (Bidur)" next to Bidur)
    const near = ([lo, la]) => (ds.context?.places ?? []).some((p) => Math.hypot((p.lonlat[0] - lo) * 0.88, p.lonlat[1] - la) < 0.014);
    const extra = Object.entries({ ...(ds.event.closeup?.places ?? {}), ...ds.event.places }).filter(([n, ll]) => !have.has(n) && !near(ll))
      .map(([name, lonlat]) => ({ name, local: name, names: {}, kind: "village", population: null, lonlat }));
    ds.context = { rivers: { type: "FeatureCollection", features: [] }, dams: [], ...(ds.context ?? {}), places: [...(ds.context?.places ?? []), ...extra] };
  }
  const total = m.dates.length * 2;
  let done = 0;
  const tick = (x) => (onProgress?.(++done, total), x);
  await Promise.all(
    m.dates.map(async (d, k) => {
      const [hh, hv, water] = await Promise.all([
        loadGray(abs(base + d.hh)).then(tick),
        loadGray(abs(base + d.hv)).then(tick),
        d.water ? fetch(base + d.water).then((r) => r.json()).catch(() => null) : null,
      ]);
      ds.raw.hh[k] = hh;
      ds.raw.hv[k] = hv;
      ds.water[k] = water;
    })
  );
  return ds;
}

/**
 * Sites with several reservoirs in one picture (dates[].reservoirs = { nurek: {area_km2}, rogun: {area_km2, level_m_est} }):
 * the total water area and the water level are filled in so the rest of the app can treat them like one lake.
 */
function normalizeReservoirs(m) {
  const names = new Set();
  for (const d of m.dates) for (const r of Object.keys(d.reservoirs ?? {})) names.add(r);
  m.reservoirNames = [...names];
  if (!names.size) return;
  for (const d of m.dates) {
    const v = m.reservoirNames.map((r) => d.reservoirs?.[r]?.area_km2);
    if (d.water_km2 == null && v.every((x) => x != null)) d.water_km2 = +v.reduce((a, b) => a + b, 0).toFixed(2);
    if (d.level_m_est == null) d.level_m_est = m.reservoirNames.map((r) => d.reservoirs?.[r]?.level_m_est).find((x) => x != null) ?? null;
  }
  m.levelReservoir = m.reservoirNames.find((r) => m.dates.some((d) => d.reservoirs?.[r]?.level_m_est != null)) ?? null;
}

/** Event block of the manifest plus its time series (CSV) and the ready-made overlay images. */
async function loadEvent(m, base) {
  const ev = m.event;
  const idx = (iso) => m.dates.findIndex((d) => d.date === iso);
  let series = null;
  if (ev.timeseries) {
    try {
      const rows = (await (await fetch(base + ev.timeseries)).text()).trim().split(/\r?\n/).map((l) => l.split(","));
      const head = rows.shift();
      series = Object.fromEntries(head.slice(1).map((h, c) => [h, m.dates.map((d) => {
        const row = rows.find((r) => r[0] === d.date);
        return row && row[c + 1] !== "" ? +row[c + 1] : null;
      })]));
    } catch { series = null; }
  }
  const before = (ev.before_dates ?? []).map(idx).filter((i) => i >= 0);
  const after = (ev.after_dates ?? []).map(idx).filter((i) => i >= 0);
  const pair = (ev.closest_pair ?? []).map(idx);
  // optional: a sharper (10 m) close-up of part of the valley, made from the same passes
  let closeup = null;
  if (ev.closeup) {
    try {
      const cb = base + ev.closeup.replace(/[^/]*$/, "");
      const c = await (await fetch(base + ev.closeup)).json();
      closeup = { ...c, url: Object.fromEntries(Object.entries(c.layers).map(([k, f]) => [k, abs(cb + f)])) };
    } catch { closeup = null; }
  }
  return {
    ...ev, series, before, after, closeup,
    kBefore: pair[0] >= 0 ? pair[0] : before.at(-1) ?? 0,
    kAfter: pair[1] >= 0 ? pair[1] : after[0] ?? m.dates.length - 1,
    overlay: ev.flood_map_png ? abs(base + ev.flood_map_png) : ev.change_png ? abs(base + ev.change_png) : null,
    hotspot: ev.interpretation?.flood_signal ? [ev.interpretation.flood_signal.lon, ev.interpretation.flood_signal.lat] : null,
  };
}

/** Farmland block of the manifest plus its median time series (CSV, one row per date). */
async function loadFarm(m, base) {
  const f = m.farmland;
  let series = null;
  try {
    const rows = (await (await fetch(base + f.file)).text()).trim().split(/\r?\n/).map((l) => l.split(","));
    const head = rows.shift();
    series = Object.fromEntries(head.slice(1).map((h, c) => [h, m.dates.map((d) => {
      const row = rows.find((r) => r[0] === d.date);
      return row && row[c + 1] !== "" ? +row[c + 1] : null;
    })]));
  } catch { series = null; }
  const hv = series?.hv_median_db ?? [];
  // the summer peak of the HV echo, and its rise from the first date
  let peak = 0;
  hv.forEach((v, i) => { if (v != null && v > (hv[peak] ?? -Infinity)) peak = i; });
  return { ...f, series, peak, rise: hv.length ? hv[peak] - hv[0] : null };
}

/**
 * Event sites: mean HH echo before vs after the event at one pixel (3x3 mean),
 * plus the echo on each date relative to the "before" mean.
 */
export function eventPoint(ds, x, y) {
  const ev = ds.event;
  const hh = ds.m.dates.map((_, i) => dbAt(ds, ds.raw.hh[i], x, y));
  const mean = (ks) => {
    const v = ks.map((i) => hh[i]).filter((x2) => x2 != null);
    return v.length ? powToDb(v.reduce((a, b) => a + Math.pow(10, b / 10), 0) / v.length) : null;
  };
  const b = mean(ev.before), a = mean(ev.after);
  return { hh, before: b, after: a, diff: a != null && b != null ? a - b : null, rel: hh.map((v) => (v != null && b != null ? v - b : null)) };
}

/** XYZ tile URL of the NASA HLS optical image (Landsat / Sentinel-2, 30 m) for one day. */
export const opticalTiles = (o) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${o.layer}/default/${o.date}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png`;
export const opticalSensor = (o) => (o.layer.includes("S30") ? "Sentinel-2" : "Landsat");

// ---------- image products ----------
function toDataUrl(imgData) {
  const cv = document.createElement("canvas");
  cv.width = imgData.width;
  cv.height = imgData.height;
  cv.getContext("2d").putImageData(imgData, 0, 0);
  return cv.toDataURL("image/png");
}

/** Contrast-stretched grayscale PNG (data URL) for HH/HV, or the RGB composite URL. Cached. */
export function radarUrl(ds, k, pol) {
  if (pol === "photo") return null; // optical photo is a tile layer, not a radar image
  if (pol === "insar") return ds.insar?.url ?? null;
  if (pol === "motion") return ds.motion?.url.coh ?? null; // one coherence picture for the whole InSAR stack // one interferogram picture for the whole site (not per date)
  if (pol === "rgb") return abs(ds.base + ds.m.dates[k].rgb);
  const key = `${pol}-${k}`;
  if (ds.cache.url[key]) return ds.cache.url[key];
  const [lo, hi] = STRETCH[pol];
  const lut = new Uint8Array(256);
  for (let v = 1; v < 256; v++) lut[v] = Math.round(255 * Math.min(1, Math.max(0, (ds.DB[v] - lo) / (hi - lo))));
  const src = ds.raw[pol][k];
  const img = new ImageData(ds.w, ds.h);
  const o = img.data;
  for (let j = 0, i = 0; j < src.length; j++, i += 4) {
    const v = src[j];
    if (!v) continue;
    o[i] = o[i + 1] = o[i + 2] = lut[v];
    o[i + 3] = 255;
  }
  return (ds.cache.url[key] = toDataUrl(img));
}

/** 3x3 speckle filter (mean in linear power), returned in dB; NaN = no data. Cached. */
function smoothed(ds, pol, k) {
  if (ds.cache.smooth[pol][k]) return ds.cache.smooth[pol][k];
  const { w, h, POW } = ds;
  const src = ds.raw[pol][k];
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!src[y * w + x]) { out[y * w + x] = NaN; continue; }
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const v = src[yy * w + xx];
          if (v) { s += POW[v]; n++; }
        }
      }
      out[y * w + x] = powToDb(s / n);
    }
  }
  return (ds.cache.smooth[pol][k] = out);
}

/** Date B − Date A change map. Blue = signal loss, red = signal gain. Areas in km². */
export function changeProduct(ds, kA, kB, pol, thr) {
  const a = smoothed(ds, pol, kA);
  const b = smoothed(ds, pol, kB);
  const img = new ImageData(ds.w, ds.h);
  const o = img.data;
  let down = 0, up = 0;
  for (let j = 0, i = 0; j < a.length; j++, i += 4) {
    const d = b[j] - a[j];
    if (Number.isNaN(d)) continue;
    if (d <= -thr) { o[i] = 47; o[i + 1] = 107; o[i + 2] = 255; o[i + 3] = 230; down++; }
    else if (d >= thr) { o[i] = 255; o[i + 1] = 59; o[i + 2] = 59; o[i + 3] = 230; up++; }
  }
  const px = (ds.m.pixel_m * ds.m.pixel_m) / 1e6;
  return { url: toDataUrl(img), down: down * px, up: up * px };
}

// ---------- geometry ----------
/**
 * WGS84 lon/lat -> UTM easting/northing (Krüger series, good to millimetres).
 * The radar grid is a regular grid in UTM, so this is the exact way to find a pixel;
 * a straight-line fit through the lon/lat corners is off by up to 12 pixels across a 75 km frame.
 */
function utm(lon, lat, zone) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  const n = f / (2 - f), A = (a / (1 + n)) * (1 + (n * n) / 4 + n ** 4 / 64);
  const al = [n / 2 - (2 / 3) * n * n + (5 / 16) * n ** 3, (13 / 48) * n * n - (3 / 5) * n ** 3, (61 / 240) * n ** 3];
  const phi = (lat * Math.PI) / 180, lam = ((lon - (zone * 6 - 183)) * Math.PI) / 180;
  const e = Math.sqrt(f * (2 - f));
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(lam)), eta = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
  let E = eta, N = xi;
  for (let k = 1; k <= 3; k++) {
    E += al[k - 1] * Math.cos(2 * k * xi) * Math.sinh(2 * k * eta);
    N += al[k - 1] * Math.sin(2 * k * xi) * Math.cosh(2 * k * eta);
  }
  return [500000 + k0 * A * E, k0 * A * N];
}

/** Grid frame of a site: UTM zone and the UTM position of the image edges (null for non-UTM data). */
function gridOf(ds) {
  if (ds.grid !== undefined) return ds.grid;
  const epsg = ds.m.epsg_source;
  if (!(epsg > 32600 && epsg <= 32660)) return (ds.grid = null); // northern-hemisphere UTM only
  const zone = epsg - 32600;
  const c = ds.m.corners.map(([lo, la]) => utm(lo, la, zone)); // TL, TR, BR, BL
  return (ds.grid = {
    zone, x0: (c[0][0] + c[3][0]) / 2, x1: (c[1][0] + c[2][0]) / 2, y0: (c[0][1] + c[1][1]) / 2, y1: (c[2][1] + c[3][1]) / 2,
  });
}

/** lon/lat -> fractional pixel position. */
function toPixF(ds, [lon, lat]) {
  const g = gridOf(ds);
  if (g) {
    const [e, n] = utm(lon, lat, g.zone);
    return [((e - g.x0) / (g.x1 - g.x0)) * ds.w, ((g.y0 - n) / (g.y0 - g.y1)) * ds.h];
  }
  const [tl, tr, , bl] = ds.m.corners; // fallback: straight-line fit through three corners
  const ax = tr[0] - tl[0], ay = tr[1] - tl[1], bx = bl[0] - tl[0], by = bl[1] - tl[1];
  const px = lon - tl[0], py = lat - tl[1], det = ax * by - ay * bx;
  return [((px * by - py * bx) / det) * ds.w, ((ax * py - ay * px) / det) * ds.h];
}

export function lonLatToPixel(ds, ll) {
  const [fx, fy] = toPixF(ds, ll);
  const x = Math.floor(fx), y = Math.floor(fy);
  return x < 0 || y < 0 || x >= ds.w || y >= ds.h ? null : [x, y];
}

/** Pixel -> lon/lat: a first guess from the four corners, then corrected against toPixF. */
export function pixelToLonLat(ds, x, y) {
  const [tl, tr, br, bl] = ds.m.corners;
  const u = x / ds.w, v = y / ds.h;
  const mix = (k) => (1 - u) * (1 - v) * tl[k] + u * (1 - v) * tr[k] + u * v * br[k] + (1 - u) * v * bl[k];
  let lon = mix(0), lat = mix(1);
  const dLon = (tr[0] - tl[0]) / ds.w, dLat = (bl[1] - tl[1]) / ds.h; // degrees per pixel
  for (let k = 0; k < 4; k++) {
    const [fx, fy] = toPixF(ds, [lon, lat]);
    lon += (x - fx) * dLon;
    lat += (y - fy) * dLat;
  }
  return [lon, lat];
}

export function siteBounds(ds) {
  const xs = ds.m.corners.map((c) => c[0]), ys = ds.m.corners.map((c) => c[1]);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
}

// ---------- water masks ----------
/** Rasterizes a date's water outline onto the radar grid (1 = water). null when there is no outline. */
/** Reservoir names in a date's outline file (lower case), or null when the features carry none. */
function lakesOf(geo) {
  const feats = geo?.type === "FeatureCollection" ? geo.features : geo ? [geo] : [];
  const n = feats.map((f) => f.properties?.reservoir?.toLowerCase()).filter(Boolean);
  return n.length ? new Set(n) : null;
}
/**
 * Lakes outlined on both dates. Newer dates can carry only some lakes (e.g. Nurek but not Rogun);
 * a comparison must then leave the missing lake out, or it would look like water that disappeared.
 */
function commonLakes(ds, kA, kB) {
  const a = lakesOf(ds.water[kA]), b = lakesOf(ds.water[kB]);
  if (!a || !b) return null;
  const both = [...a].filter((x) => b.has(x));
  return both.length === a.size && both.length === b.size ? null : new Set(both);
}

function waterMask(ds, k, only = null) {
  const key = `${k}|${only ? [...only].sort().join(",") : "*"}`;
  if (ds.cache.mask[key] !== undefined) return ds.cache.mask[key];
  const geo0 = ds.water[k];
  if (!geo0) return (ds.cache.mask[key] = null);
  const geo = only && geo0.type === "FeatureCollection"
    ? { ...geo0, features: geo0.features.filter((f) => only.has(f.properties?.reservoir?.toLowerCase())) } : geo0;
  const cv = document.createElement("canvas");
  cv.width = ds.w;
  cv.height = ds.h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  const feats = geo.type === "FeatureCollection" ? geo.features : [geo];
  for (const f of feats) {
    const g = f.geometry;
    const polys = g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of polys)
      for (const ring of poly)
        ring.forEach((ll, i) => {
          const [x, y] = toPixF(ds, ll);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
  }
  ctx.fill("evenodd");
  const d = ctx.getImageData(0, 0, ds.w, ds.h).data;
  const out = new Uint8Array(ds.w * ds.h);
  for (let j = 0; j < out.length; j++) out[j] = d[j * 4 + 3] > 127 ? 1 : 0;
  return (ds.cache.mask[key] = out);
}

export const GAIN_RGB = [255, 159, 28];  // new water
export const LOSS_RGB = [236, 72, 153];  // water gone
export const KEEP_RGB = [34, 211, 238];  // water on both dates
export const PITCH_KM2 = (105 * 68) / 1e6; // one football pitch

/**
 * Water gained / lost between two dates from the outlines, as an overlay image,
 * plus the place where the lake grew the most (hotspot, [lon, lat]).
 */
export function waterDiff(ds, kA, kB) {
  const key = `${kA}-${kB}`;
  if (key in ds.cache.wdiff) return ds.cache.wdiff[key];
  const only = commonLakes(ds, kA, kB);
  const a = waterMask(ds, kA, only), b = waterMask(ds, kB, only);
  if (!a || !b) return (ds.cache.wdiff[key] = null);
  const img = new ImageData(ds.w, ds.h);
  const o = img.data;
  const CELL = 40, gw = Math.ceil(ds.w / CELL), grid = new Uint32Array(gw * Math.ceil(ds.h / CELL));
  let gained = 0, lost = 0, kept = 0;
  const put = (i, [r, g, bl], al) => { o[i] = r; o[i + 1] = g; o[i + 2] = bl; o[i + 3] = al; };
  for (let j = 0, i = 0; j < a.length; j++, i += 4) {
    if (b[j] && !a[j]) {
      put(i, GAIN_RGB, 240); gained++;
      grid[Math.floor(j / ds.w / CELL) * gw + Math.floor((j % ds.w) / CELL)]++;
    } else if (a[j] && !b[j]) { put(i, LOSS_RGB, 240); lost++; }
    else if (a[j]) { put(i, KEEP_RGB, 60); kept++; }
  }
  let best = 0;
  for (let c = 1; c < grid.length; c++) if (grid[c] > grid[best]) best = c;
  // the hotspot must sit on a pixel that really became water (a cell centre can be dry land):
  // take the new-water pixel closest to the centre of the new water in the busiest cell
  const cx0 = (best % gw) * CELL, cy0 = Math.floor(best / gw) * CELL;
  const cells = [];
  for (let y = cy0; y < Math.min(ds.h, cy0 + CELL); y++)
    for (let x = cx0; x < Math.min(ds.w, cx0 + CELL); x++) {
      const j = y * ds.w + x;
      if (b[j] && !a[j]) cells.push([x, y]);
    }
  let hx = cx0 + CELL / 2, hy = cy0 + CELL / 2;
  if (cells.length) {
    const mx = cells.reduce((s2, p) => s2 + p[0], 0) / cells.length, my = cells.reduce((s2, p) => s2 + p[1], 0) / cells.length;
    const [px, py] = cells.reduce((q, p) => (Math.hypot(p[0] - mx, p[1] - my) < Math.hypot(q[0] - mx, q[1] - my) ? p : q));
    hx = px + 0.5; hy = py + 0.5;
  }
  const px = (ds.m.pixel_m * ds.m.pixel_m) / 1e6;
  return (ds.cache.wdiff[key] = {
    url: toDataUrl(img),
    gained: gained * px, lost: lost * px, kept: kept * px,
    hotspot: grid[best] ? pixelToLonLat(ds, hx, hy) : null,
  });
}

// ---------- which polarization shows the change best ----------
/**
 * Compares HH and HV on real pixels between two dates (speckle-filtered dB):
 *  - drop: how far the echo fell on pixels that turned from land into water
 *  - contrast: land minus water on the later date
 *  - separability: contrast divided by the pooled spread (d'), i.e. how cleanly water stands out
 */
export function polCompare(ds, kA, kB) {
  const key = `${kA}-${kB}`;
  if (key in ds.cache.pol) return ds.cache.pol[key];
  const only = commonLakes(ds, kA, kB);
  const a = waterMask(ds, kA, only), b = waterMask(ds, kB, only);
  if (!a || !b) return (ds.cache.pol[key] = null);
  const out = { n: 0 };
  for (const pol of ["hh", "hv"]) {
    const A = smoothed(ds, pol, kA), B = smoothed(ds, pol, kB);
    let nNew = 0, sA = 0, sB = 0, nL = 0, sL = 0, qL = 0, nW = 0, sW = 0, qW = 0;
    for (let j = 0; j < a.length; j++) {
      const va = A[j], vb = B[j];
      if (Number.isNaN(va) || Number.isNaN(vb)) continue;
      if (b[j] && !a[j]) { nNew++; sA += va; sB += vb; }
      if (b[j]) { nW++; sW += vb; qW += vb * vb; }
      else if (!a[j]) { nL++; sL += vb; qL += vb * vb; }
    }
    if (!nNew || !nW || !nL) return (ds.cache.pol[key] = null);
    const mL = sL / nL, mW = sW / nW;
    const sdL = Math.sqrt(Math.max(0, qL / nL - mL * mL)), sdW = Math.sqrt(Math.max(0, qW / nW - mW * mW));
    out[pol] = {
      before: sA / nNew, after: sB / nNew, drop: sA / nNew - sB / nNew,
      land: mL, water: mW, contrast: mL - mW,
      sep: (mL - mW) / Math.sqrt((sdL * sdL + sdW * sdW) / 2),
    };
    out.n = nNew;
  }
  out.km2 = (out.n * ds.m.pixel_m * ds.m.pixel_m) / 1e6;
  out.winner = out.hh.sep >= out.hv.sep ? "hh" : "hv";
  return (ds.cache.pol[key] = out);
}

/** Settlements (from the context layer) within `km` of the water on date k, nearest first. */
export function placesNearWater(ds, k, km = 3) {
  const mask = waterMask(ds, k);
  if (!mask || !ds.context) return [];
  const r = Math.ceil((km * 1000) / ds.m.pixel_m);
  const res = [];
  for (const p of ds.context.places) {
    const [fx, fy] = toPixF(ds, p.lonlat);
    const px = Math.round(fx), py = Math.round(fy);
    let best = Infinity;
    for (let y = Math.max(0, py - r); y <= Math.min(ds.h - 1, py + r); y++)
      for (let x = Math.max(0, px - r); x <= Math.min(ds.w - 1, px + r); x++)
        if (mask[y * ds.w + x]) best = Math.min(best, Math.hypot(x - px, y - py));
    if (best <= r) res.push({ ...p, km: (best * ds.m.pixel_m) / 1000 });
  }
  return res.sort((x, y) => x.km - y.km);
}

// ---------- point sampling ----------
/** 3x3 mean backscatter in dB at pixel (x, y), or null when there is no data. */
export function dbAt(ds, arr, x, y) {
  if (!arr[y * ds.w + x]) return null; // same rule as smoothed(): no value where the pixel itself has no data
  let s = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= ds.w || yy >= ds.h) continue;
      const v = arr[yy * ds.w + xx];
      if (v) { s += ds.POW[v]; n++; }
    }
  return n ? +powToDb(s / n).toFixed(2) : null;
}

/** true/false if the point is inside the water polygon, null if there is no outline. */
export function inWater(geo, [x, y]) {
  if (!geo) return null;
  const feats = geo.type === "FeatureCollection" ? geo.features : [geo];
  const ringHit = (r) => {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  // even-odd over every ring of a feature: right for polygons with holes and for outlines written as separate rings
  return feats.some((f) => {
    const g = f.geometry;
    const rings = g?.type === "Polygon" ? g.coordinates : g?.type === "MultiPolygon" ? g.coordinates.flat() : [];
    return rings.filter(ringHit).length % 2 === 1;
  });
}

// ---------- formatting ----------
/** Date in the current interface language (see i18n.jsx). */
/** "Fell sharply" farmland as text: a range when the newest passes come from another processing version. */
export function harvestRange(f) {
  const lo = f.harvested_km2_min, hi = f.harvested_km2, c = (x) => x.toFixed(1), pc = (x) => ((x / f.farmland_km2) * 100).toFixed(1);
  return lo != null ? { km: `${Math.round(lo)}–${Math.round(hi)}`, pct: `${pc(lo)}–${pc(hi)}` } : { km: c(hi), pct: pc(hi) };
}
export const fmtDate = (iso, short) => fmtDateL(iso, short);
export const signed = (x, dp = 1) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(dp);

/** Season statistics for the water-area card and the story. null when the site has no outlines. */
export function areaStats(m) {
  const ds = m.dates;
  const valid = ds.map((d, i) => [d.water_km2, i]).filter(([v]) => v != null);
  if (valid.length < 2) return null;
  const [a, ia] = valid[0];
  const [b, ib] = valid[valid.length - 1];
  const vals = valid.map(([v]) => v);
  const min = Math.min(...vals), max = Math.max(...vals);
  let best = { rate: -Infinity };
  for (let i = 1; i < valid.length; i++) {
    const [v1, i1] = valid[i - 1], [v2, i2] = valid[i];
    const days = (new Date(ds[i2].date) - new Date(ds[i1].date)) / 864e5;
    const rate = (v2 - v1) / days;
    if (rate > best.rate) best = { rate, i1, i2, dv: v2 - v1 };
  }
  return {
    a, b, ia, ib, min, max, best,
    pct: ((b - a) / a) * 100,
    plateau: max - b < 0.05 * (max - min) && valid.length > 4,
  };
}
