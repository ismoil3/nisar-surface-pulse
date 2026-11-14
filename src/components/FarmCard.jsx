import { useMemo } from "react";
import LineChart from "./LineChart.jsx";
import Actions from "./Actions.jsx";
import { fmtDate, harvestRange } from "../lib/nisar.js";
import { getLang, t, tr } from "../lib/i18n.jsx";

const f1 = (x) => (x == null ? "–" : x.toFixed(1));
const HV = "#a3e635", HH = "#60a5fa";

/** Median HV (with the middle half of all fields as a band) and median HH over the farmland, date by date. */
export function FarmChart({ ds, kMain, onPick }) {
  const s = ds.farm.series, d = ds.m.dates;
  const lang = getLang();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => d.map((x) => fmtDate(x.date, true)), [d, lang]);
  const datasets = useMemo(() => {
    if (!s) return [];
    const pts = (color) => ({
      pointRadius: d.map((_, i) => (i === kMain ? 6 : 3)), pointHoverRadius: 7,
      pointBackgroundColor: d.map((_, i) => (i === kMain ? "#fff" : color)),
    });
    return [
      // the band: 75th percentile filled down to the 25th
      { label: "p75", data: s.hv_p75_db, borderWidth: 0, pointRadius: 0, fill: "+1", backgroundColor: "rgba(163,230,53,.18)", tension: 0.25 },
      { label: "p25", data: s.hv_p25_db, borderWidth: 0, pointRadius: 0, fill: false, tension: 0.25 },
      { label: t("farmHV"), data: s.hv_median_db, borderColor: HV, backgroundColor: HV, tension: 0.25, spanGaps: true, ...pts(HV) },
      { label: t("farmHH"), data: s.hh_median_db, borderColor: HH, backgroundColor: HH, borderDash: [5, 4], tension: 0.25, spanGaps: true, ...pts(HH) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, d, kMain, lang]);
  const options = useMemo(() => ({
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", align: "start", labels: { boxWidth: 10, boxHeight: 10, filter: (it) => !/^p\d/.test(it.text) } },
      tooltip: {
        filter: (c) => !/^p\d/.test(c.dataset.label),
        callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y?.toFixed(1)} ${t("uDb")}` },
      },
    },
    scales: { y: { title: { display: true, text: t("backscatter") } }, x: { grid: { display: false } } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lang]);
  if (!s) return null;
  return <LineChart labels={labels} datasets={datasets} options={options} onPointClick={onPick} />;
}

/** "Which channel sees crops best?" for the farmland: the measured rise in HV and HH, and NASA's advice. */
export function FarmPol({ ds, onView }) {
  const s = ds.farm.series, p = ds.farm.peak;
  if (!s) return null;
  const hv = s.hv_median_db[p] - s.hv_median_db[0], hh = s.hh_median_db[p] - s.hh_median_db[0];
  return (
    <section className="card">
      <h2>{t("polTitle")}</h2>
      <p className="hint">{t("farmPolIntro")}</p>
      {[["HV", hv, "farmPolHV"], ["HH", hh, "farmPolHH"]].map(([pol, v, hint]) => (
        <div key={pol} className={`polrow${pol === "HV" ? " win" : ""}`}>
          <div className="row between">
            <b>{pol}{pol === "HV" && <span className="tag">{t("farmPolTag")}</span>}</b>
            <button className="ghost tiny" onClick={() => onView(pol.toLowerCase())}>{t("showOnMap")}</button>
          </div>
          <small>{t(hint)}</small>
          <div className="polnums"><span>{tr("farmPolRow", { d: (v >= 0 ? "+" : "") + v.toFixed(1), a: fmtDate(ds.m.dates[0].date, true), b: fmtDate(ds.m.dates[p].date, true) })}</span></div>
        </div>
      ))}
      <p className="insight">{tr("farmPolWhy")}</p>
      <p className="hint">{t("farmPolNasa")} <a href="https://storymaps.arcgis.com/stories/c00d7691b8004b20a14f28df710d05fd" target="_blank" rel="noreferrer">{t("polNasaLink")}</a></p>
    </section>
  );
}

/** Plain answer to "what changed on the farmland?": crops grew over the summer, harvest has barely begun. */
export default function FarmCard({ ds, story, kMain, onPick, onGrowth, onHarvest }) {
  const f = ds.farm, d = ds.m.dates;
  const pct = f.farmland_km2 ? (f.harvested_km2 / f.farmland_km2) * 100 : null;
  return (
    <section className="card story has-more">
      <h2>{t("farmTitle")}</h2>
      <p className="lead">{tr("farmLead", { km: Math.round(f.farmland_km2), rise: f1(f.rise), a: fmtDate(d[0].date, true), b: fmtDate(d[f.peak].date, true) })}</p>
      <div className="bigstats">
        <div className="grow">
          <b>{f.rise != null ? "+" + f1(f.rise) : "–"} {t("uDb")}</b>
          <small>{t("farmRise")}</small>
          <em>{t("farmRiseEm")}</em>
        </div>
        <div className="cut">
          <b>{harvestRange(f).km} km²</b>
          <small>{t("farmCut", { pct: pct != null ? harvestRange(f).pct : "–" })}</small>
          <em>{t("farmCutEm")}</em>
        </div>
      </div>
      <FarmChart ds={ds} kMain={kMain} onPick={onPick} />
      <p className="hint">{t("farmChartHint")}</p>
      <p className="insight">{tr("farmInsight", { b: fmtDate(d.at(-1).date, true) })}</p>
      <div className="row wrap">
        <button className="primary" onClick={onGrowth}>{t("farmGrowthBtn")}</button>
        <button className="ghost" onClick={onHarvest}>{t("farmHarvestBtn")}</button>
      </div>
      <details>
        <summary>{t("qWhy")}</summary>
        <p>{story.why}</p>
        {story.human && <p>{story.human}</p>}
      </details>
      <details>
        <summary>{t("qMiss")}</summary>
        <ul className="caveats">{story.notSeen.map(([h, x]) => <li key={h}><b>{h}.</b> {x}</li>)}</ul>
      </details>
      <details>
        <summary>{t("qHow")}</summary>
        <p>{tr("farmMethod")}</p>
      </details>
      <details>
        <summary>{t("qMatters")}</summary>
        <p>{story.matters}</p>
        <Actions story={story} />
      </details>
      <details>
        <summary>{t("qFuture")}</summary>
        <ul className="future">{story.future.map(([ic, h, x]) => <li key={h}><span aria-hidden="true">{ic}</span><div><b>{h}.</b> {x}</div></li>)}</ul>
      </details>
      {story.caveats.length > 0 && (
        <details>
          <summary>{t("qSure")}</summary>
          <ul className="caveats">{story.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
