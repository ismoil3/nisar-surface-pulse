import { useEffect, useMemo, useRef } from "react";
import LineChart from "./LineChart.jsx";
import { dbAt, eventPoint, fmtDate, inWater, lonLatToPixel } from "../lib/nisar.js";
import { getLang, t } from "../lib/i18n.jsx";

/** Plain-language verdict about a place, from its water/land history. */
function verdict(ds, wet) {
  const d = ds.m.dates, n = wet.length;
  const day = (i) => fmtDate(d[i].date, true);
  const first = wet.indexOf(true), firstDry = wet.indexOf(false);
  if (first < 0) return { icon: "⛰️", head: t("vDryHead"), text: t("vDryText") };
  if (firstDry < 0) return { icon: "💧", head: t("vWetHead"), text: t("vWetText") };
  if (first > 0 && wet.slice(first).every(Boolean))
    return { icon: "🌊", head: t("vFloodHead", { a: day(first - 1), b: day(first) }), text: t("vFloodText") };
  if (wet[0] && wet.slice(firstDry).every((w) => !w))
    return { icon: "🏜️", head: t("vDriedHead", { a: day(firstDry - 1), b: day(firstDry) }), text: t("vDriedText") };
  return { icon: "〰️", head: t("vShoreHead"), text: t("vShoreText", { w: wet.filter(Boolean).length, n }) };
}

const REL = 3; // dB: same threshold as the change map

/** Verdict for a sudden-event site: did the echo change after the event, and which way. */
function eventVerdict(ds, ep) {
  const date = fmtDate(ds.event.date, true);
  if (ep.diff == null) return { icon: "⛰️", head: t("pNoData"), text: "" };
  const d = Math.abs(ep.diff).toFixed(1);
  if (ep.diff <= -REL) return { icon: "🌊", head: t("pDarkHead"), text: t("pDarkText", { d, date }) };
  if (ep.diff >= REL) return { icon: "🪨", head: t("pBrightHead"), text: t("pBrightText", { d, date }) };
  return { icon: "✅", head: t("pSameHead"), text: t("pSameText", { d, date }) };
}

/** Verdict for a farmland site: did the plant echo (HV) grow over the summer, or fall after its peak? */
function farmVerdict(ds, sample) {
  const d = ds.m.dates, hv = sample.hv;
  if (sample.wet.every(Boolean)) return { icon: "💧", head: t("vWetHead"), text: t("vWetText") };
  const v = hv.map((x, i) => [x, i]).filter(([x]) => x != null);
  if (v.length < 3) return { icon: "⛰️", head: t("pNoData"), text: "" };
  const [first, i0] = v[0], [last, iL] = v.at(-1);
  const [peak, iP] = v.reduce((a, b) => (b[0] > a[0] ? b : a));
  const day = (i) => fmtDate(d[i].date, true);
  if (peak - last >= REL && iP < iL) return { icon: "🌾", head: t("pFarmCutHead"), text: t("pFarmCutText", { d: (peak - last).toFixed(1), a: day(iP), b: day(iL) }) };
  if (peak - first >= 2) return { icon: "🌱", head: t("pFarmGrowHead"), text: t("pFarmGrowText", { d: (peak - first).toFixed(1), a: day(i0), b: day(iP) }) };
  return { icon: "▫️", head: t("pFarmFlatHead"), text: t("pFarmFlatText") };
}

export default function PointCard({ ds, point, k, onClear, outside, expert, onPick }) {
  const lang = getLang();
  const sample = useMemo(() => {
    if (!point) return null;
    const px = lonLatToPixel(ds, point);
    if (!px) return null;
    const [x, y] = px;
    const hh = ds.m.dates.map((_, i) => dbAt(ds, ds.raw.hh[i], x, y));
    const hv = ds.m.dates.map((_, i) => dbAt(ds, ds.raw.hv[i], x, y));
    // water or land on each date: from the outline when there is one, otherwise from a dark echo in both channels
    const wet = ds.m.dates.map((_, i) => {
      const w = inWater(ds.water[i], point);
      return w != null ? w : hh[i] != null && hv[i] != null && hh[i] < -17 && hv[i] < -25;
    });
    return { hh, hv, wet, ep: ds.event ? eventPoint(ds, x, y) : null };
  }, [ds, point]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => ds.m.dates.map((d) => fmtDate(d.date, true)), [ds, lang]);
  const options = useMemo(() => ({
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", align: "end", labels: { boxWidth: 10, boxHeight: 10 } },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y?.toFixed(1)} dB` } },
    },
    scales: {
      y: { title: { display: true, text: t("backscatter") }, suggestedMin: -30, suggestedMax: -5 },
      x: { grid: { display: false } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lang]);
  const datasets = useMemo(() => {
    if (!sample) return [];
    const r = ds.m.dates.map((_, i) => (i === k ? 5 : 2));
    return [
      { label: "HH", data: sample.hh, borderColor: "#60a5fa", backgroundColor: "#60a5fa", tension: 0.25, spanGaps: true, pointRadius: r },
      { label: "HV", data: sample.hv, borderColor: "#a3e635", backgroundColor: "#a3e635", tension: 0.25, spanGaps: true, pointRadius: r },
    ];
  }, [ds, sample, k]);

  const v = sample && (sample.ep ? eventVerdict(ds, sample.ep) : ds.farm ? farmVerdict(ds, sample) : verdict(ds, sample.wet));
  const lastBefore = ds.event?.before.at(-1);

  // bring the answer into view: the card sits low in the panel and a click on the map would otherwise seem to do nothing
  const cardRef = useRef(null);
  useEffect(() => {
    if (point) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [point]);

  return (
    <section className="card" ref={cardRef}>
      <div className="row between">
        <h2>{t("placeTitle")}</h2>
        {sample && <button className="ghost tiny" onClick={onClear}>{t("clear")}</button>}
      </div>
      {!sample ? (
        <p className="hint big">{t(outside ? "outside" : ds.event ? "clickHintEv" : ds.farm ? "clickHintFarm" : "clickHint")}</p>
      ) : (
        <>
          <div className="verdict">
            <span className="vicon" aria-hidden="true">{v.icon}</span>
            <div>
              <b>{v.head}</b>
              {v.text && <p>{v.text}</p>}
            </div>
          </div>
          {onPick && (
            <div className="stepper" role="group" aria-label={t("date")}>
              <button className="ghost tiny" onClick={() => onPick(Math.max(0, k - 1))} disabled={k <= 0} aria-label={t("prevDate")}>◀</button>
              <span className="mono">{fmtDate(ds.m.dates[k].date)}</span>
              <button className="ghost tiny" onClick={() => onPick(Math.min(ds.m.dates.length - 1, k + 1))} disabled={k >= ds.m.dates.length - 1} aria-label={t("nextDate")}>▶</button>
              <small>{t("stepHint")}</small>
            </div>
          )}
          {sample.ep ? (
            <>
              <div className={`strip${onPick ? " click" : ""}`} aria-label={t("stripEvLabel")}>
                {ds.m.dates.map((d, i) => {
                  const [day, mon] = fmtDate(d.date, true).split(" ");
                  const r = sample.ep.rel[i];
                  const cls = r == null ? "na" : r <= -REL ? "dk" : r >= REL ? "br" : "nm";
                  const word = r == null ? "–" : t(cls === "dk" ? "relDarker" : cls === "br" ? "relBrighter" : "relSame");
                  return [
                    <div key={d.date} className={`${cls}${i === k ? " now" : ""}`} onClick={onPick ? () => onPick(i) : undefined} title={`${fmtDate(d.date)}: ${word}${r != null ? ` (${r > 0 ? "+" : ""}${r.toFixed(1)} dB)` : ""}`}>
                      <i />
                      <small>{day}<br />{mon}</small>
                    </div>,
                    i === lastBefore && <span key="ev" className="ev" title={t("floodMark")} />,
                  ];
                })}
              </div>
              <div className="legend rowl">
                <span><i className="sw dkc" />{t("relDarker")}</span>
                <span><i className="sw nmc" />{t("relSame")}</span>
                <span><i className="sw brc" />{t("relBrighter")}</span>
              </div>
            </>
          ) : ds.farm ? null : (<>
          <div className={`strip${onPick ? " click" : ""}`} aria-label={t("stripLabel")}>
            {ds.m.dates.map((d, i) => {
              const [day, mon] = fmtDate(d.date, true).split(" ");
              return (
                <div key={d.date} className={`${sample.wet[i] ? "wet" : "dry"}${i === k ? " now" : ""}`} onClick={onPick ? () => onPick(i) : undefined} title={`${fmtDate(d.date)}: ${t(sample.wet[i] ? "water" : "land")}`}>
                  <i />
                  <small>{day}<br />{mon}</small>
                </div>
              );
            })}
          </div>
          <div className="legend rowl">
            <span><i className="sw wetc" />{t("water")}</span>
            <span><i className="sw dryc" />{t("land")}</span>
          </div>
          </>)}
          {(expert || ds.farm) && (
            <>
              <LineChart labels={labels} datasets={datasets} options={options} onPointClick={onPick} />
              <p className="insight">
                <span className="mono">{point[1].toFixed(4)}°N, {point[0].toFixed(4)}°E</span> · {fmtDate(ds.m.dates[k].date, true)}: HH{" "}
                <b>{sample.hh[k] ?? "–"}</b> dB, HV <b>{sample.hv[k] ?? "–"}</b> dB {t("pixelMean")}.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
