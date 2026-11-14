// "What the weather says": daily air temperature and rain from NASA POWER next to the NISAR passes.
// It turns the "why" from a sentence into a number (melt, not rain; irrigation, not rain; no rain peak on the flood day).
import { useEffect, useState } from "react";
import { fmtDate } from "../lib/nisar.js";
import { loadClimate, weatherBefore, weatherRange } from "../lib/river.js";
import { getLang, t, tr } from "../lib/i18n.jsx";

const iso = (start, i) => new Date(Date.parse(start) + i * 864e5).toISOString().slice(0, 10);
const idx = (start, date) => Math.round((Date.parse(date) - Date.parse(start)) / 864e5);
const num = (x, d = 1) => x.toFixed(d).replace(".", getLang() === "en" ? "." : ",");
const sgn = (x, d = 1) => (x > 0 ? "+" : x < 0 ? "−" : "") + num(Math.abs(x), d);

export const climatePoint = (clim, id) => Object.values(clim?.points ?? {}).find((p) => p.sites.includes(id)) ?? null;

/** One sentence per kind of site, computed from the daily values. */
export function climateFinding(pt, m) {
  if (!pt) return null;
  const last = m.dates.at(-1).date;
  if (m.event) {
    const i = idx(pt.start, m.event.date);
    if (i < 1 || i >= pt.p.length) return null;
    const mx = Math.max(...pt.p), imx = pt.p.indexOf(mx);
    return tr("clFlood", { d: fmtDate(m.event.date, true), p: num(pt.p[i] + pt.p[i - 1]), mx: num(mx), dmx: fmtDate(iso(pt.start, imx), true) });
  }
  if (m.farmland) {
    const w = weatherRange(pt, "2026-07-01", "2026-09-30");
    return w && tr("clCrops", { p: num(w.p, 0), t: num(w.t, 0) });
  }
  const w = weatherRange(pt, "2026-07-01", "2026-08-31"), now = weatherBefore(pt, last);
  return w && now && tr("clWater", { h: pt.cell_elevation_m.toLocaleString("ru-RU"), t: sgn(w.t), p: num(w.p, 0), tn: sgn(now.t) });
}

export function ClimateChart({ pt, m }) {
  const W = 340, H = 150, L = 26, R = 26, T = 10, B = 22;
  const n = pt.t.length, tLo = Math.min(0, ...pt.t), tHi = Math.max(...pt.t), pHi = Math.max(...pt.p, 1);
  const X = (i) => L + (i / (n - 1)) * (W - L - R), YT = (v) => T + ((tHi - v) / (tHi - tLo)) * (H - T - B), YP = (v) => H - B - (v / pHi) * (H - T - B) * 0.8;
  const months = [];
  for (let i = 0; i < n; i++) if (iso(pt.start, i).endsWith("-01")) months.push(i);
  const ev = m.event ? idx(pt.start, m.event.date) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cl-chart" role="img" aria-label={`${t("clT")}; ${t("clP")}`}>
      {tLo < 0 && <line x1={L} x2={W - R} y1={YT(0)} y2={YT(0)} className="zero" />}
      {pt.p.map((v, i) => v > 0.05 && <rect key={i} x={X(i) - 0.7} width="1.4" y={YP(v)} height={H - B - YP(v)} className="rain" />)}
      <polyline points={pt.t.map((v, i) => `${X(i).toFixed(1)},${YT(v).toFixed(1)}`).join(" ")} className="temp" />
      {m.dates.map((d) => { const i = idx(pt.start, d.date); return i >= 0 && i < n ? <path key={d.date} d={`M${X(i)},${H - B} v6`} className="pass" /> : null; })}
      {ev != null && ev >= 0 && ev < n && <><line x1={X(ev)} x2={X(ev)} y1={T} y2={H - B} className="event" /><text x={X(ev) + 4} y={T + 9} className="evt">{t("clEvent")}</text></>}
      {months.map((i) => <text key={i} x={X(i)} y={H - 3} className="ax" textAnchor="middle">{fmtDate(iso(pt.start, i), true).split(" ")[1]}</text>)}
      <text x={L - 4} y={YT(tHi) + 4} className="ax t" textAnchor="end">{Math.round(tHi)}°</text>
      <text x={L - 4} y={YT(tLo) + 4} className="ax t" textAnchor="end">{Math.round(tLo)}°</text>
      <text x={W - R + 4} y={YP(pHi) + 4} className="ax p">{Math.round(pHi)}</text>
      <text x={W - R + 4} y={H - B} className="ax p">0</text>
    </svg>
  );
}

export default function ClimateCard({ id, m }) {
  const [clim, setClim] = useState(null);
  useEffect(() => { loadClimate().then(setClim); }, []);
  const pt = climatePoint(clim, id);
  const text = pt && climateFinding(pt, m);
  if (!pt || !text) return null;
  return (
    <section className="card climate">
      <h2>{t("clTitle")}</h2>
      <p>{text}</p>
      <ClimateChart pt={pt} m={m} />
      <p className="cl-key"><i className="k-t" /> {t("clT")} <i className="k-p" /> {t("clP")} <i className="k-n" /> {t("clPass")}</p>
      <p className="hint">{t("clNote")}{pt.suspect?.length ? ` ${t("clSuspect", { d: fmtDate(pt.suspect[0].date, true), mm: num(pt.suspect[0].mm, 0) })}` : ""}</p>
    </section>
  );
}
