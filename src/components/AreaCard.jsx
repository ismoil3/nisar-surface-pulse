import { useMemo } from "react";
import LineChart from "./LineChart.jsx";
import { WATER_A_COLOR, WATER_COLOR } from "./MapView.jsx";
import { fmtDate, signed } from "../lib/nisar.js";
import { fmtInt, getLang, t, tr, tNote } from "../lib/i18n.jsx";

const RES_COLORS = ["#22d3ee", "#f59e0b", "#a3e635", "#f472b6"];
const OPTIONS_MULTI = {
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { position: "top", align: "start", labels: { boxWidth: 10, boxHeight: 10 } },
    tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y?.toFixed(1)} km²` } },
  },
  scales: { y: { title: { display: true, text: "km²" }, grace: "10%" }, x: { grid: { display: false } } },
};
const OPTIONS = {
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.y.toFixed(1)} km²` } } },
  scales: { y: { title: { display: true, text: "km²" }, grace: "10%" }, x: { grid: { display: false } } },
};

export default function AreaCard({ m, stats, kMain, kA, showA, onPick, note }) {
  const lang = getLang();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => m.dates.map((d) => fmtDate(d.date, true)), [m, lang]);
  const res = m.reservoirNames ?? [];
  const multi = res.length > 1;
  const resName = (r) => t(`res_${r}`) === `res_${r}` ? r[0].toUpperCase() + r.slice(1) : t(`res_${r}`);
  const datasets = useMemo(() => {
    if (multi)
      return res.map((r, n) => ({
        label: resName(r), data: m.dates.map((d) => d.reservoirs?.[r]?.area_km2 ?? null),
        borderColor: RES_COLORS[n % 4], backgroundColor: RES_COLORS[n % 4], tension: 0.3, spanGaps: true,
        pointRadius: m.dates.map((_, i) => (i === kMain || (showA && i === kA) ? 6 : 3)), pointHoverRadius: 7,
        pointBackgroundColor: m.dates.map((_, i) => (i === kMain ? "#fff" : RES_COLORS[n % 4])),
      }));
    const color = (i) => (i === kMain ? "#fff" : showA && i === kA ? WATER_A_COLOR : WATER_COLOR);
    return [{
      data: m.dates.map((d) => d.water_km2),
      borderColor: WATER_COLOR, backgroundColor: "rgba(34,211,238,.15)", fill: true, tension: 0.3,
      pointRadius: m.dates.map((_, i) => (i === kMain || (showA && i === kA) ? 6 : 3)),
      pointHoverRadius: 7,
      pointBackgroundColor: m.dates.map((_, i) => color(i)),
    }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, kMain, kA, showA, multi, lang]);

  const ds = m.dates;
  const { a, b, ia, ib, min, max, best, pct, plateau } = stats;
  const now = ds[kMain].water_km2;
  const level = ds[kMain].level_m_est;
  const hasLevel = ds.some((d) => d.level_m_est != null);
  const day = (i) => fmtDate(ds[i].date, true);

  if (multi) {
    const lr = m.levelReservoir;
    // the season summary uses the dates where every lake was outlined (the same method on both ends)
    const per = res.map((r) => ({ r, a: ds[ia].reservoirs?.[r]?.area_km2, b: ds[ib].reservoirs?.[r]?.area_km2 }));
    // newer passes where only some lakes were outlined (e.g. VALIDATED dates measured by this app)
    const after = res.map((r) => ({ r, pts: ds.map((d, i) => [d.reservoirs?.[r]?.area_km2, i]).filter(([v, i]) => v != null && i > ib) })).filter((x) => x.pts.length);
    return (
      <section className="card">
        <div className="row between">
          <h2>{t("areaTitleMulti")}</h2>
          <span className="pill">{signed(pct, 0)}%</span>
        </div>
        <div className={`kpis${res.length + (lr ? 1 : 0) > 2 ? " three" : ""}`}>
          {res.map((r) => {
            const v = ds[kMain].reservoirs?.[r]?.area_km2;
            const other = v == null && ds[kMain].reservoirs?.[r]?.note === "second_orbit";
            return <div key={r}><b>{v != null ? v.toFixed(1) : "–"}</b><small>{t("kmOf", { name: resName(r) })}{other && <><br />{t("o2See")}</>}</small></div>;
          })}
          {lr && <div><b>{level != null ? `≈${fmtInt(level)}` : "–"}</b><small>{t("levelOf", { name: resName(lr) })}</small></div>}
        </div>
        <p className="hint">{t("dotHint")}</p>
        <LineChart labels={labels} datasets={datasets} options={OPTIONS_MULTI} onPointClick={onPick} />
        <p className="insight">
          {per.filter((p) => p.a != null).map((p) => (
            <span key={p.r}>{tr("areaInsightRes", { name: resName(p.r), a: p.a.toFixed(1), b: p.b.toFixed(1), dv: signed(p.b - p.a), pct: signed(((p.b - p.a) / p.a) * 100, 0) })} </span>
          ))}
          {tr("areaInsightTotal", { dv: signed(b - a), a: day(ia), b: day(ib), f1: day(best.i1), f2: day(best.i2) })}
          {plateau && t("plateau")}
          {now == null && !res.some((r) => ds[kMain].reservoirs?.[r]?.area_km2 != null) && t("noOutlineOn", { day: day(kMain), note: ds[kMain].note ? `: ${tNote(ds[kMain].note).toLowerCase()}` : "" })}
          {note && <> {note}</>}
        </p>
        {after.map(({ r, pts }) => {
          const last = pts.at(-1)[0], prev = pts.length > 1 ? pts.at(-2)[0] : ds[ib].reservoirs?.[r]?.area_km2;
          return (
            <p key={r} className="insight newest">
              {tr("areaAfter", { name: resName(r), d: day(ib), list: pts.map(([v, i]) => `${v.toFixed(1)} (${day(i)})`).join(" → ") })}
              {ds[pts.at(-1)[1]].reservoirs?.[r]?.flag ? <> {tr("areaAfterRough", { adj: ds[pts.at(-1)[1]].reservoirs[r].area_km2_adj?.toFixed(1) ?? "–" })}</> : last < prev && <> {t("areaAfterDown")}</>}
            </p>
          );
        })}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="row between">
        <h2>{t("areaTitle")}</h2>
        <span className="pill">{signed(pct, 0)}%</span>
      </div>
      <div className={`kpis${hasLevel ? " three" : ""}`}>
        <div><b>{now != null ? now.toFixed(1) : "–"}</b><small>{t("kmOnDate")}</small></div>
        <div><b>{min.toFixed(0)}–{max.toFixed(0)}</b><small>{t("kmRange")}</small></div>
        {hasLevel && <div><b>{level != null ? `≈${fmtInt(level)} m` : "–"}</b><small>{t("levelLabel")}</small></div>}
      </div>
      <p className="hint">{t("dotHint")}</p>
      <LineChart labels={labels} datasets={datasets} options={OPTIONS} onPointClick={onPick} />
      <p className="insight">
        {tr("areaInsight", {
          dv: signed(b - a), pct: signed(pct, 0), a: day(ia), b: day(ib),
          f1: day(best.i1), f2: day(best.i2), fdv: signed(best.dv), rate: (best.rate * 100).toFixed(0),
        })}
        {plateau && t("plateau")}
        {now == null && t("noOutlineOn", { day: day(kMain), note: ds[kMain].note ? `: ${tNote(ds[kMain].note).toLowerCase()}` : "" })}
        {note && <> {note}</>}
      </p>
    </section>
  );
}
