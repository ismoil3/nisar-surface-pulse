import { useMemo } from "react";
import LineChart from "./LineChart.jsx";
import { fmtDate } from "../lib/nisar.js";
import { getLang, t, tr } from "../lib/i18n.jsx";

const day = (iso) => Math.round((Date.parse(iso) - Date.parse("2026-06-01")) / 864e5);
const C12 = "#fbbf24", C84 = "#3ce1ff";

/**
 * Rogun measured from two different NISAR orbits on the same chart (real dates on the x axis).
 * Track 84 is an independent check and reaches the newest (VALIDATED) passes.
 */
export default function Orbit2Card({ ds }) {
  const o = ds.orbit2, lang = getLang();
  const a12 = ds.m.dates.map((d) => ({ x: day(d.date), y: d.reservoirs?.rogun?.area_km2 ?? null, date: d.date })).filter((p) => p.y != null);
  const a84 = o.dates.filter((d) => d.area_km2 != null).map((d) => ({ x: day(d.date), y: d.area_km2, date: d.date, v: d.validated, flag: d.flag }));
  const first = a84[0], last = a84.at(-1);
  const lv = o.dates.filter((d) => d.level_m_est != null);
  const nVal = a84.filter((p) => p.v).length;
  const datasets = useMemo(() => [
    { label: t("o2Track", { n: 12 }), data: a12, borderColor: C12, backgroundColor: C12, tension: 0.25, pointRadius: 3 },
    { label: t("o2Track", { n: 84 }), data: a84, borderColor: C84, backgroundColor: C84, tension: 0.25, borderDash: [5, 4],
      pointRadius: a84.map((p) => (p.v ? 6 : 3)), pointStyle: a84.map((p) => (p.v ? "rectRot" : "circle")),
      pointBackgroundColor: a84.map((p) => (p.flag ? "transparent" : C84)) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [ds, lang]);
  const options = useMemo(() => ({
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      legend: { position: "top", align: "start", labels: { boxWidth: 10, boxHeight: 10 } },
      tooltip: { callbacks: {
        title: (c) => fmtDate(c[0].raw.date),
        label: (c) => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)} ${t("uKm2")}${c.raw.v ? " · VALIDATED" : ""}${c.raw.flag ? " · " + t("o2Flag") : ""}`,
      } },
    },
    scales: {
      x: { type: "linear", min: day("2026-06-15"), max: day("2026-11-15"), grid: { display: false },
        ticks: { stepSize: 30, callback: (v) => fmtDate(new Date(Date.parse("2026-06-01") + v * 864e5).toISOString().slice(0, 10), true) } },
      y: { title: { display: true, text: t("uKm2") } },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lang]);
  return (
    <section className="card">
      <h2>{t("o2Title")}</h2>
      <p>{tr("o2Lead", { a: first.y.toFixed(1), b: last.y.toFixed(1), la: lv[0]?.level_m_est, lb: lv.at(-1)?.level_m_est, d0: fmtDate(first.date, true), d1: fmtDate(last.date, true), nv: nVal })}</p>
      <LineChart datasets={datasets} options={options} />
      <p className="hint">{t("o2Hint")}</p>
    </section>
  );
}
