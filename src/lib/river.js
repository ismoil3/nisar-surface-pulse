// Data for the "one river" page: the Vakhsh from the Rogun lake down to the cotton fields.
// Everything comes from files the app already has (manifests, CSVs) plus the long profile and the NASA POWER weather.
import { DATA_ROOT } from "./nisar.js";

const csv = async (url) => {
  const rows = (await (await fetch(url)).text()).trim().split(/\r?\n/).map((l) => l.split(","));
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, c) => [h, c && r[c] !== "" ? +r[c] : c ? null : r[c]])));
};
const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const validated = (g) => +((g ?? "").match(/_P(\d{5})_/)?.[1] ?? 0) >= 5036;

let climate = null;
/** NASA POWER daily weather (one small file for all places), loaded once. */
export function loadClimate() {
  climate ??= fetch(`${DATA_ROOT}climate.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return climate;
}

/** Mean temperature and total rain of the n days up to (and including) a date. */
export function weatherBefore(pt, date, n = 12) {
  if (!pt) return null;
  const i = days(date, pt.start);
  if (i < 0 || i >= pt.t.length) return null;
  const a = Math.max(0, i - n + 1);
  const t = pt.t.slice(a, i + 1), p = pt.p.slice(a, i + 1);
  return { t: t.reduce((x, y) => x + y, 0) / t.length, p: p.reduce((x, y) => x + y, 0) };
}

/** Weather of a calendar range [from, to] (ISO dates): mean temperature, total rain. */
export function weatherRange(pt, from, to) {
  if (!pt) return null;
  const a = Math.max(0, days(from, pt.start)), b = Math.min(pt.t.length - 1, days(to, pt.start));
  if (b < a) return null;
  const t = pt.t.slice(a, b + 1), p = pt.p.slice(a, b + 1);
  return { t: t.reduce((x, y) => x + y, 0) / t.length, p: p.reduce((x, y) => x + y, 0), n: t.length };
}

/** One step per pass of NISAR track 12 (the lakes and the fields are on the same passes). */
export async function loadRiver(sites) {
  const cas = sites.find((s) => s.id === "vakhsh_cascade"), farm = sites.find((s) => s.id === "vakhsh");
  if (!cas || !farm) return null;
  const [profile, clim, ts, fs, o2] = await Promise.all([
    fetch(`${DATA_ROOT}river/profile.json`).then((r) => r.json()),
    loadClimate(),
    csv(`${DATA_ROOT}vakhsh_cascade/timeseries.csv`),
    csv(`${DATA_ROOT}vakhsh/${farm.m.farmland.file}`),
    cas.m.orbit2 ? fetch(`${DATA_ROOT}vakhsh_cascade/${cas.m.orbit2}`).then((r) => r.json()).catch(() => null) : null,
  ]);
  const steps = cas.m.dates.map((d) => {
    const row = ts.find((r) => r.date === d.date) ?? {};
    let level = row.rogun_level_m_est ?? null, rogun = row.rogun_km2 ?? null, other = null;
    if (level == null && o2) {
      // newest passes: Rogun is measured from the second orbit (track 84), a few days apart
      const near = o2.dates.filter((x) => x.level_m_est != null).sort((a, b) => Math.abs(days(a.date, d.date)) - Math.abs(days(b.date, d.date)))[0];
      if (near && Math.abs(days(near.date, d.date)) <= 7) { level = near.level_m_est; rogun = near.area_km2; other = near.date; }
    }
    const f = fs.find((r) => r.date === d.date);
    return {
      date: d.date, validated: validated(d.granule),
      nurek: row.nurek_km2 ?? null, rogun, level, other,
      hv: f?.hv_median_db ?? null,
      pamir: weatherBefore(clim?.points.pamir, d.date), valley: weatherBefore(clim?.points.valley, d.date),
    };
  });
  // July to September in the valley: how hot and how dry the growing season was
  return { profile, clim, steps, farm_km2: farm.m.farmland.farmland_km2, valleyDry: weatherRange(clim?.points.valley, "2026-07-01", "2026-09-30") };
}
