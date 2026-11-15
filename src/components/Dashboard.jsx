import { useEffect, useRef, useState } from "react";
import { DATA_ROOT, fmtDate, harvestRange } from "../lib/nisar.js";
import { storyFor } from "../lib/stories.js";
import { getLang, t, tr } from "../lib/i18n.jsx";

const f1 = (x) => (x == null ? "–" : x.toFixed(1));
const csv = async (url) => {
  const rows = (await (await fetch(url)).text()).trim().split(/\r?\n/).map((l) => l.split(","));
  const head = rows.shift();
  return Object.fromEntries(head.map((h, c) => [h, rows.map((r) => (c ? +r[c] : r[c]))]));
};

/** Small extra numbers for each site (only light files: CSV / JSON, never the pictures). */
export async function summarize({ id, m }) {
  const base = `${DATA_ROOT}${id}/`;
  const out = { id, m };
  const safe = async (f) => { try { return await f(); } catch { return null; } };
  if (m.dates.some((d) => d.reservoirs)) {
    out.kind = "water";
    out.res = Object.keys(m.dates.find((d) => d.reservoirs).reservoirs).map((r) => {
      // a value flagged by the data check (e.g. rough water after rain) is not used for the season's change
      const v = m.dates.map((d) => (d.reservoirs?.[r]?.flag ? null : d.reservoirs?.[r]?.area_km2 ?? null));
      // start and end = first and last pass on which every lake was measured (the map uses the same two dates)
      const all = m.dates.map((d) => Object.values(d.reservoirs ?? {}).every((x) => x.area_km2 != null && !x.flag));
      const i0 = all.indexOf(true), i1 = all.lastIndexOf(true);
      return { r, series: v, a: v[i0], b: v[i1] };
    });
  }
  if (m.motion) out.motion = await safe(async () => {
    const mb = base + m.motion.replace(/[^/]*$/, "");
    const mo = await (await fetch(base + m.motion)).json();
    const c = await csv(mb + mo.timeseries);
    return { ...mo, series: Object.fromEntries(Object.entries(c).slice(1)) };
  });
  if (m.farmland) {
    out.kind = "crops";
    out.farm = await safe(() => csv(base + m.farmland.file));
  }
  if (m.event) {
    out.kind = "flood";
    out.closeup = m.event.closeup ? await safe(async () => (await fetch(base + m.event.closeup)).json()) : null;
  }
  return out;
}

/** Which story and place a dashboard tile opens. */
const TILE = { water: ["water", "mode=story&f=lakes"], crops: ["crops", "mode=story"], flood: ["flood", "mode=story&cu=1&cv=swipe&f=flood"] };

/** Tiny line chart as inline SVG. */
function Spark({ values, color = "#22d3ee", band }) {
  const v = values.map((x, i) => [i, x]).filter(([, x]) => x != null);
  if (v.length < 2) return null;
  const xs = values.length - 1, lo = Math.min(...v.map((p) => p[1]), band ? -band : Infinity), hi = Math.max(...v.map((p) => p[1]), band ?? -Infinity);
  const X = (i) => (i / xs) * 116 + 2, Y = (x) => 34 - ((x - lo) / (hi - lo || 1)) * 30;
  return (
    <svg viewBox="0 0 120 38" className="spark" aria-hidden="true">
      {band && <rect x="2" y={Y(band)} width="116" height={Y(-band) - Y(band)} fill="rgba(148,160,196,.18)" />}
      <polyline points={v.map(([i, x]) => `${X(i)},${Y(x)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={X(v.at(-1)[0])} cy={Y(v.at(-1)[1])} r="2.6" fill={color} />
    </svg>
  );
}

/** Rule-based "what should someone do about it" flags, computed from the numbers (not written by hand). */
function alerts(S, story) {
  const out = [];
  for (const s of S) {
    const name = story(s.id).name || s.m.name;
    const spot = s.motion?.spots?.[0];
    if (spot && spot.total_cm >= 3) out.push({ lvl: "warn", go: ["motion", "mode=single&pol=motion&f=slope"], text: tr("alSlope", { name, cm: spot.total_cm.toFixed(1), n: s.motion.pairs.length }) });
    for (const r of s.res ?? []) if (r.a && r.b && (r.b - r.a) / r.a > 0.1)
      out.push({ lvl: "info", go: ["water", `mode=story&f=${r.r}`], text: tr("alLake", { lake: t(`res_${r.r}`), pct: Math.round(((r.b - r.a) / r.a) * 100), b: f1(r.b) }) });
    if (s.closeup) {
      const top = [...s.closeup.zones_by_place].sort((a, b) => b.wet_km2 + b.debris_km2 - a.wet_km2 - a.debris_km2)[0];
      out.push({ lvl: "warn", go: ["flood", `mode=story&cu=1&cv=swipe&f=${encodeURIComponent("place:" + top.place)}`], text: tr("alFlood", { place: story(s.id).cuPlaces?.[top.place] ?? top.place, w: top.wet_km2.toFixed(2), d: top.debris_km2.toFixed(2) }) });
    }
    if (s.m.farmland) {
            out.push({ lvl: "info", go: ["crops", "mode=story"], text: tr("alHarvest", { pct: harvestRange(s.m.farmland).pct, b: fmtDate(s.m.dates.at(-1).date, true) }) });
    }
  }
  return out;
}

export default function Dashboard({ open, onClose, sites, onOpenSite }) {
  const ref = useRef(null);
  const [S, setS] = useState(null);
  const lang = getLang();
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => { if (open && sites && !S) Promise.all(sites.map(summarize)).then(setS); }, [open, sites, S]);
  const story = (id) => storyFor(id, lang);

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} className="dash">
      <article>
        <button className="close" onClick={onClose} aria-label={t("close")}>×</button>
        <h2>{t("dashTitle")}</h2>
        <p className="hint">{t("dashIntro")}</p>
        {!S ? <p>{t("gettingReady")}</p> : (
          <>
            <div className="dash-grid">
              {S.map((s) => {
                const st = story(s.id), d = s.m.dates;
                return (
                  <section key={s.id} className="card dash-tile">
                    <div className="row between">
                      <span className={`kind k-${s.kind}`}>{t(`kind_${s.kind}`)}</span>
                      <small className="hint">{fmtDate(d[0].date, true)} → {fmtDate(d.at(-1).date, true)} · {t("dashPasses", { n: d.length })}</small>
                    </div>
                    <h3>{st.name || s.m.name}</h3>
                    <small className="hint">{st.region || s.m.region}</small>
                    <div className="kpis">
                      {s.res?.map((r) => (
                        <div key={r.r}><b>{f1(r.a)} → {f1(r.b)}</b><small>{t("kmOf", { name: t(`res_${r.r}`) })}</small><Spark values={r.series} /></div>
                      ))}
                      {s.motion?.spots?.[0] && (
                        <div><b>+{f1(s.motion.spots[0].total_cm)} {t("uCm")}</b><small>{t("dashSlope")}</small>
                          <Spark values={Object.entries(s.motion.series ?? {}).find(([k]) => /spot/i.test(k))?.[1] ?? []} color="#f97316" band={2} /></div>
                      )}
                      {s.farm && (
                        <div><b>+{f1(Math.max(...s.farm.hv_median_db) - s.farm.hv_median_db[0])} {t("uDb")}</b><small>{t("dashCrops", { km: Math.round(s.m.farmland.farmland_km2) })}</small><Spark values={s.farm.hv_median_db} color="#a3e635" /></div>
                      )}
                      {s.farm && (
                        <div><b>{harvestRange(s.m.farmland).km} {t("uKm2")}</b><small>{t("dashHarvest")}</small></div>
                      )}
                      {s.closeup && (
                        <>
                          <div><b>{f1(s.closeup.stats_km2.flood_darker_km2)} km²</b><small>{t("dashWet")}</small></div>
                          <div><b>{f1(s.closeup.stats_km2.flood_brighter_km2)} km²</b><small>{t("dashDebris")}</small></div>
                        </>
                      )}
                      {s.m.event && <div><b>{fmtDate(s.m.event.date, true)}</b><small>{t("dashEvent")}</small></div>}
                    </div>
                    <button className="primary" onClick={() => { onOpenSite(...TILE[s.kind]); onClose(); }}>{t("dashOpen")}</button>
                  </section>
                );
              })}
            </div>
            <h3>{t("dashAlerts")}</h3>
            <ul className="alerts">
              {alerts(S, story).map((a, i) => (
                <li key={i} className={a.lvl}>
                  <span aria-hidden="true">{a.lvl === "warn" ? "⚠️" : "ℹ️"}</span>
                  <div>{a.text} <button className="link" onClick={() => { onOpenSite(...a.go); onClose(); }}>{t("dashOpen")}</button></div>
                </li>
              ))}
            </ul>
            <p className="hint">{t("dashAlertsHint")}</p>
          </>
        )}
      </article>
    </dialog>
  );
}
