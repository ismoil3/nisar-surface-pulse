import { useMemo } from "react";
import LineChart from "./LineChart.jsx";
import { fmtDate } from "../lib/nisar.js";
import { getLang, t, tr } from "../lib/i18n.jsx";

const SPOT = "#f97316", DAM = "#e5e7eb";
const NOISE_CM = 2; // the data team's noise band: changes smaller than this are not trusted

/** Ground motion over time (cm along the radar line of sight) at the moving slope and at the dam, with the noise band. */
export function MotionChart({ ds }) {
  const mo = ds.motion, lang = getLang();
  const keys = Object.keys(mo.series);
  const spotKey = keys.find((k) => /spot/i.test(k)), damKey = keys.find((k) => /dam/i.test(k));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => mo.seriesDates.map((d) => fmtDate(d, true)), [mo, lang]);
  const datasets = useMemo(() => {
    const n = mo.seriesDates.length;
    return [
      { label: "+2", data: Array(n).fill(NOISE_CM), borderWidth: 0, pointRadius: 0, fill: "+1", backgroundColor: "rgba(148,160,196,.16)" },
      { label: "-2", data: Array(n).fill(-NOISE_CM), borderWidth: 0, pointRadius: 0, fill: false },
      spotKey && { label: t("moSpot"), data: mo.series[spotKey], borderColor: SPOT, backgroundColor: SPOT, tension: 0.2, pointRadius: 3 },
      damKey && { label: t("moDam"), data: mo.series[damKey], borderColor: DAM, backgroundColor: DAM, borderDash: [5, 4], tension: 0.2, pointRadius: 3 },
    ].filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mo, lang]);
  const options = useMemo(() => ({
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", align: "start", labels: { boxWidth: 10, boxHeight: 10, filter: (it) => !/^[+-]2$/.test(it.text) } },
      tooltip: { filter: (c) => !/^[+-]2$/.test(c.dataset.label), callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y > 0 ? "+" : ""}${c.parsed.y?.toFixed(1)} ${t("uCm")}` } },
    },
    scales: { y: { title: { display: true, text: t("moAxis") } }, x: { grid: { display: false } } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lang]);
  return <LineChart labels={labels} datasets={datasets} options={options} />;
}

/** "Is the ground moving?": InSAR result for the site (dam stable, one creeping slope), with honest limits. */
export default function MotionCard({ ds, onSpot, onDam }) {
  const mo = ds.motion, spot = mo.spots?.[0];
  const damKey = Object.keys(mo.series).find((k) => /dam/i.test(k));
  const damMax = damKey ? Math.max(...mo.series[damKey].map(Math.abs)) : null;
  const a = fmtDate(mo.dates[0], true), b = fmtDate(mo.dates.at(-1), true);
  // rate per 12 days over the real time span (one of the pairs spans 24 days, across NISAR's data gap)
  const perStep = spot ? (spot.total_cm / ((Date.parse(mo.dates.at(-1)) - Date.parse(mo.dates[0])) / 864e5)) * 12 : null;
  return (
    <section className="card story">
      <h2>{t("moTitle")}</h2>
      <p className="lead">{tr("moLead", { n: mo.pairs.length, a, b })}</p>
      <div className="bigstats">
        <div className="steady">
          <b>±{damMax != null ? damMax.toFixed(1) : "–"} {t("uCm")}</b>
          <small>{t("moDamStat")}</small>
          <em>{t("moDamEm")}</em>
        </div>
        {spot && (
          <div className="moving">
            <b>+{spot.total_cm.toFixed(1)} {t("uCm")}</b>
            <small>{t("moSpotStat", { km: spot.area_km2.toFixed(2) })}</small>
            <em>{t("moSpotEm", { r: perStep.toFixed(1) })}</em>
          </div>
        )}
      </div>
      <MotionChart ds={ds} />
      <p className="hint">{t("moChartHint", { n: NOISE_CM })}</p>
      <div className="row wrap">
        {spot && <button className="primary" onClick={() => onSpot([spot.lon, spot.lat])}>{t("moSpotBtn")}</button>}
        {onDam && <button className="ghost" onClick={onDam}>{t("moDamBtn")}</button>}
      </div>
      <div className="legend">
        <span><i style={{ background: "#b2182b" }} />{t("moKeyRed")}</span>
        <span><i style={{ background: "#2166ac" }} />{t("moKeyBlue")}</span>
        <span><i style={{ background: "#9aa0af" }} />{t("moKeyGrey")}</span>
      </div>
      <details open>
        <summary>{t("moWhyTitle")}</summary>
        <p>{tr("moWhy")}</p>
      </details>
      <details>
        <summary>{t("qHow")}</summary>
        <p>{tr("moMethod", { n: mo.pairs.length, px: mo.pixel_m, coh: mo.coherence_min })}</p>
      </details>
      <details>
        <summary>{t("qSure")}</summary>
        <ul className="caveats">
          <li>{t("moC1")}</li>
          <li>{t("moC2")}</li>
          <li>{t("moC3")}</li>
          <li>{t("moC4")}</li>
          <li>{t("moC5")}</li>
        </ul>
      </details>
    </section>
  );
}
