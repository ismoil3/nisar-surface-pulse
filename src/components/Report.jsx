// One-page report for people who decide: the main sentence, the pictures, the numbers pass by pass,
// why it changed, how sure we are and the sources. Light page made for paper; "Save as PDF" is the browser's print.
import { useEffect, useState } from "react";
import { DATA_ROOT, fmtDate, harvestRange } from "../lib/nisar.js";
import { STORY_ROUTES, routeOf } from "../lib/routes.js";
import { storyFor } from "../lib/stories.js";
import { loadClimate, loadRiver } from "../lib/river.js";
import { LANGS, getLang, t, tr } from "../lib/i18n.jsx";
import { summarize } from "./Dashboard.jsx";
import { ClimateChart, climateFinding, climatePoint } from "./ClimateCard.jsx";
import "../report.css";

const num = (x, d = 1) => (x == null ? "–" : x.toFixed(d).replace(".", getLang() === "en" ? "." : ","));
const sgn = (x, d = 1) => (x > 0 ? "+" : x < 0 ? "−" : "") + num(Math.abs(x), d);
const validated = (g) => +((g ?? "").match(/_P(\d{5})_/)?.[1] ?? 0) >= 5036;

/** Small line chart for paper: one series, first / last / extreme values written out. */
function Mini({ title, values, labels, color = "#0b63ce", digits = 1 }) {
  const v = values.map((x, i) => [i, x]).filter(([, x]) => x != null);
  if (v.length < 2) return null;
  const lo = Math.min(...v.map((p) => p[1])), hi = Math.max(...v.map((p) => p[1]));
  const X = (i) => 34 + (i / (values.length - 1)) * 250, Y = (x) => 84 - ((x - lo) / (hi - lo || 1)) * 62;
  return (
    <figure className="rep-mini">
      <figcaption>{title}</figcaption>
      <svg viewBox="0 0 300 108" role="img" aria-label={title}>
        <line x1="34" x2="284" y1="84" y2="84" stroke="#c9d2e3" /><line x1="34" x2="284" y1="22" y2="22" stroke="#e6ebf5" strokeDasharray="3 4" />
        <text x="30" y="26" textAnchor="end" className="ax">{num(hi, digits)}</text><text x="30" y="88" textAnchor="end" className="ax">{num(lo, digits)}</text>
        <polyline points={v.map(([i, x]) => `${X(i)},${Y(x)}`).join(" ")} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
        {v.map(([i, x]) => <circle key={i} cx={X(i)} cy={Y(x)} r="2.6" fill={color} />)}
        <text x={X(v[0][0])} y="102" className="ax">{labels[v[0][0]]}</text><text x={X(v.at(-1)[0])} y="102" textAnchor="end" className="ax">{labels[v.at(-1)[0]]}</text>
      </svg>
    </figure>
  );
}

/** A picture for paper: drawn once at about 760 px (with its colour overlay on top), so the PDF stays small. */
function Pic({ src, over, cap }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let off = false;
    const load = (u) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });
    Promise.all([load(src), over ? load(over) : null]).then(([a, b]) => {
      if (off) return;
      const w = Math.min(760, a.naturalWidth), h = Math.round((a.naturalHeight / a.naturalWidth) * w);
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      const c = cv.getContext("2d");
      c.fillStyle = "#0a1020"; c.fillRect(0, 0, w, h);
      c.drawImage(a, 0, 0, w, h);
      if (b) c.drawImage(b, 0, 0, w, h);
      setUrl(cv.toDataURL("image/jpeg", 0.85));
    }).catch(() => !off && setUrl(src));
    return () => { off = true; };
  }, [src, over]);
  return <figure><div>{url && <img src={url} alt={cap} />}</div><figcaption>{cap}</figcaption></figure>;
}

export default function Report({ sites, slug, lang, chooseLang, onBack }) {
  const route = routeOf(slug) ?? STORY_ROUTES[0];
  const site = sites?.find((x) => x.id === route.site);
  const [D, setD] = useState(null);
  useEffect(() => {
    if (!site) return;
    let off = false;
    setD(null);
    Promise.all([summarize(site), route.slug === "water" ? loadRiver(sites).catch(() => null) : null, loadClimate()])
      .then(([sum, riv, clim]) => !off && setD({ sum, riv, clim }));
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, route.slug]);
  useEffect(() => { document.documentElement.classList.add("rep-on"); return () => document.documentElement.classList.remove("rep-on"); }, []);
  if (!site || !D) return <div className="rep"><p className="rep-wait">{t("gettingReady")}</p></div>;

  const m = site.m, story = storyFor(site.id, lang), base = `${DATA_ROOT}${site.id}/`;
  const d = m.dates, sh = (x) => fmtDate(x, true), labels = d.map((x) => sh(x.date));
  const motion = route.slug === "motion" ? D.sum.motion : null;
  const pt = motion ? null : climatePoint(D.clim, site.id);
  let head, pics, charts = null, table = null, extraSure = null, title = story.name || m.name;

  if (motion) {
    title = t("lpMotionTitle");
    const mb = base + m.motion.replace(/[^/]*$/, "");
    const spot = Object.entries(motion.series).find(([k]) => /spot/i.test(k))?.[1] ?? [], dam = Object.entries(motion.series).find(([k]) => /dam/i.test(k))?.[1] ?? [];
    const ml = motion.dates.map(sh);
    head = tr("repMotion", { a: sh(motion.dates[0]), b: sh(motion.dates.at(-1)), cm: num(motion.spots[0].total_cm), n: motion.pairs.length });
    pics = [[mb + motion.layers.coherence, t("polMotion"), mb + motion.layers.significant]];
    charts = <><Mini title={t("repSpot")} values={spot} labels={ml} color="#c2410c" /><Mini title={t("repDam")} values={dam} labels={ml} color="#475569" /></>;
    table = { head: [t("repDate"), t("repSpot"), t("repDam")], rows: motion.dates.map((x, i) => [sh(x), sgn(spot[i]), sgn(dam[i])]) };
  } else if (route.slug === "water" && D.riv) {
    const S = D.riv.steps, nk = S.map((x) => x.nurek), pk = Math.max(...nk), ip = nk.indexOf(pk), lv = S.filter((x) => x.level != null);
    const ok = [...S].reverse().find((x) => x.nurek != null && !x.nurekFlag), fl = S.find((x) => x.nurekFlag), l12 = lv.filter((x) => !x.other), o2 = D.riv.o2;
    head = tr("repWater", { a: num(nk[0]), pk: num(pk), dpk: sh(S[ip].date), b: num(ok.nurek), d1: sh(ok.date), l0: l12[0].level, l1: l12.at(-1).level, m0: o2?.l0 ?? "–", m1: o2?.l1 ?? "–", dm: o2 ? sh(o2.d1) : "–" });
    if (fl) extraSure = tr("rvS2flag", { d: sh(fl.date), v: num(fl.nurek), adj: num(fl.nurekAdj) });
    pics = [[base + d[0].rgb, fmtDate(d[0].date)], [base + d.at(-1).rgb, fmtDate(d.at(-1).date)]];
    charts = <><Mini title={`${t("res_nurek")}, ${t("uKm2")}`} values={nk} labels={labels} /><Mini title={t("repLevel")} values={S.map((x) => x.level)} labels={labels} color="#0e7490" digits={0} /></>;
    table = { head: [t("repDate"), `${t("res_nurek")}, ${t("uKm2")}`, `${t("res_rogun")}, ${t("uKm2")}`, t("repLevel"), t("repStatus")],
      rows: S.map((x) => [sh(x.date), num(x.nurek) + (x.nurekFlag ? " †" : ""), num(x.rogun) + (x.other ? " *" : ""), x.level ?? "–", t(x.validated ? "repVal" : "repProv")]),
      foot: S.some((x) => x.other) ? `* ${t("rvOther", { d: S.filter((x) => x.other).map((x) => sh(x.other)).join(", ") })}` : null };
  } else if (m.farmland && D.sum.farm) {
    const f = D.sum.farm, hv = f.hv_median_db, hh = f.hh_median_db, fl = m.farmland;
    head = tr("repCrops", { km: Math.round(fl.farmland_km2), d: sgn(Math.max(...hv) - hv[0]), d0: sh(d[0].date), d1: sh(fl.harvested_by ?? d.at(-1).date), h: harvestRange(fl).km, pct: harvestRange(fl).pct });
    pics = [[base + d[0].rgb, fmtDate(d[0].date)], [base + d.at(-1).rgb, fmtDate(d.at(-1).date)]];
    charts = <><Mini title={`${t("repHv")}, ${t("uDb")}`} values={hv} labels={labels} color="#3f7d0a" digits={2} /><Mini title={`${t("repHh")}, ${t("uDb")}`} values={hh} labels={labels} color="#475569" digits={2} /></>;
    table = { head: [t("repDate"), `HV, ${t("uDb")}`, `HH, ${t("uDb")}`, t("repStatus")], rows: d.map((x, i) => [sh(x.date), num(hv[i], 2), num(hh[i], 2), t(validated(x.granule) ? "repVal" : "repProv")]) };
  } else if (m.event && D.sum.closeup) {
    const c = D.sum.closeup, cb = base + m.event.closeup.replace(/[^/]*$/, ""), st = c.stats_km2;
    head = tr("repFlood", { d: fmtDate(m.event.date), w: num(st.flood_darker_km2), r: num(st.flood_brighter_km2), s: num(st.seasonal_brighter_km2) });
    pics = [[cb + c.layers.before, t("cuBefore")], [cb + c.layers.after, t("cuAfter"), cb + c.layers.flood]];
    table = { title: t("repByPlace"), head: [t("site"), `${t("cuWetShort")}, ${t("uKm2")}`, `${t("cuDebrisShort")}, ${t("uKm2")}`], rows: c.zones_by_place.map((z) => [story.cuPlaces?.[z.place] ?? z.place, num(z.wet_km2, 2), num(z.debris_km2, 2)]) };
  }
  const weather = pt && climateFinding(pt, m);
  const sure = motion ? [t("moC1"), t("moC2"), t("moC5")] : (story.caveats ?? []).slice(0, 3);
  const url = `${location.origin}${location.pathname}#/map/${route.slug}`;

  return (
    <div className="rep">
      <div className="rep-bar">
        <button onClick={onBack}>← {t("repBack")}</button>
        <div className="rep-tabs">{STORY_ROUTES.filter((r) => sites.some((x) => x.id === r.site)).map((r) => <a key={r.slug} href={`#/report/${r.slug}`} className={r.slug === route.slug ? "on" : ""}>{r.icon} {t(r.kind)}</a>)}</div>
        <div className="rep-langs">{LANGS.map((l) => <button key={l.id} className={lang === l.id ? "on" : ""} onClick={() => chooseLang(l.id)} lang={l.id}>{l.label}</button>)}</div>
        <button className="go" onClick={() => window.print()}>⬇ {t("repPrint")}</button>
      </div>

      <article className="rep-page">
        <header className="rep-head">
          <div>
            <p className="rep-k">Surface Pulse · {t("repTitle")}</p>
            <h1>{title}</h1>
            <p className="rep-meta">{story.region || m.region} · {fmtDate((motion?.dates ?? d.map((x) => x.date))[0])} → {fmtDate((motion?.dates ?? d.map((x) => x.date)).at(-1))} · NISAR {t(route.kind)}</p>
          </div>
          <p className="rep-made">{t("repMade", { d: fmtDate(new Date().toISOString().slice(0, 10)) })}<br />CIFARSOFT · NASA Space Apps 2026</p>
        </header>

        <section className="rep-lead"><h2>{t("repHead")}</h2><p>{head}</p></section>

        <div className="rep-cols">
          <section>
            <h2>{t("repPics")}</h2>
            <div className={`rep-pics n${pics?.length}`}>
              {pics?.map(([src, cap, over]) => <Pic key={src} src={src} over={over} cap={cap} />)}
            </div>
            {charts && <div className="rep-charts">{charts}</div>}
            {pt && weather && <><h2>{t("repWeather")}</h2><p>{weather}</p><ClimateChart pt={pt} m={m} /><p className="rep-small">{t("clNote")}{pt.suspect?.length ? ` ${t("clSuspect", { d: sh(pt.suspect[0].date), mm: Math.round(pt.suspect[0].mm) })}` : ""}</p></>}
          </section>
          <section>
            {table && <>
              <h2>{table.title ?? t("repNumbers")}</h2>
              <table><thead><tr>{table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{table.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table>
              {table.foot && <p className="rep-small">{table.foot}</p>}
            </>}
            <h2>{motion ? t("moWhyTitle") : t("repWhy")}</h2><p>{motion ? tr("moWhy") : story.why}</p>
            <h2>{t("repMatters")}</h2><p>{story.matters}</p>
          </section>
        </div>

        <div className="rep-cols">
          <section><h2>{t("repDo")}</h2><ul>{(story.actions ?? []).map(([ic, who, x]) => <li key={who}><b>{who}.</b> {x}</li>)}</ul></section>
          <section><h2>{t("repSure")}</h2><ul>{extraSure && <li>† {extraSure}</li>}{sure.map((x) => <li key={x}>{x}</li>)}{!motion && <li>{t("repLimits")}</li>}</ul></section>
        </div>

        <footer className="rep-foot">
          <p><b>{t("repSources")}:</b> {motion ? motion.sources.radar : m.sources.radar}{m.sources.dem ? ` · ${m.sources.dem}` : ""}{pt ? " · NASA POWER (MERRA-2 / GEOS-IT)" : ""} · © OpenStreetMap contributors.</p>
          <p><b>{t("repLink")}:</b> {url}</p>
        </footer>
      </article>
    </div>
  );
}
