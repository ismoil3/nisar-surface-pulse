import { useMemo } from "react";
import LineChart from "./LineChart.jsx";
import Actions from "./Actions.jsx";
import { fmtDate } from "../lib/nisar.js";
import { getLang, t, tr } from "../lib/i18n.jsx";

const f1 = (x) => (x == null ? "–" : x.toFixed(1));

/** Fractional chart position of the event date between the last "before" pass and the first "after" pass. */
export function eventAt(ds) {
  const ev = ds.event, d = ds.m.dates;
  const i = ev.before.at(-1), j = ev.after[0];
  if (i == null || j == null) return null;
  const t0 = +new Date(d[i].date), t1 = +new Date(d[j].date), te = +new Date(ev.date);
  return i + (j - i) * Math.min(1, Math.max(0, (te - t0) / (t1 - t0)));
}

/** Plain-language answer to "what happened?" for a sudden event (flood / landslide). */
export default function EventCard({ ds, story, onZoomHotspot, onCloseup }) {
  const ev = ds.event;
  const fs = ev.interpretation?.flood_signal;
  const date = fmtDate(ev.date);
  const darker = ev.hh_valley_darker_km2 ?? ev.valley_darker_km2 ?? ev.darker_km2;
  const brighter = ev.hh_valley_brighter_km2 ?? ev.valley_brighter_km2 ?? ev.brighter_km2;
  const hh = ev.polarization_test?.find((p) => p.pol === "HH");
  // the same test on dates before the event: how much "darker" ground appears with no flood
  const darkerCtl = ev.hh_valley_control_darker_km2 ?? ev.valley_control_darker_km2 ?? ev.control_darker_km2 ?? 0;

  return (
    <section className="card story has-more">
      <h2>{t("evTitle")}</h2>
      {fs && <p className="lead">{tr("evLead", { date, river: story.river || ds.m.name, where: story.where || fs.where, db: Math.abs(fs.change_db).toFixed(1) })}</p>}

      <div className="bigstats">
        <div className="dark">
          <b>{f1(darker)} km²</b>
          <small>{t("evDarker")}</small>
          <em>{t("evDarkerEm")}</em>
        </div>
        <div className="bright">
          <b>{f1(brighter)} km²</b>
          <small>{t("evBrighter")}</small>
          <em>{t("evBrighterEm")}</em>
        </div>
      </div>

      <div className="legend">
        <span><i className="sw flood" />{t("evLegendBlue")}</span>
        <span><i className="sw rock" />{t("evLegendRed")}</span>
      </div>
      <p className="hint">{t("evOnly")}</p>

      <div className="row wrap">
        {ev.hotspot && <button className="primary" onClick={onZoomHotspot}>{t("evHotspotBtn")}</button>}
        {onCloseup && <button className="primary alt" onClick={onCloseup}>{t("cuBtn", { px: ev.closeup.pixel_m })}</button>}
      </div>

      {hh && darker != null && (
        <details open className="keep">
          <summary>{t("evProofTitle")}</summary>
          <p>{tr("evProof", { d: f1(darker), dc: f1(darkerCtl), x: darkerCtl > 0 ? Math.round(darker / darkerCtl) : "–", b: f1(brighter) })}</p>
        </details>
      )}
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
        <p>{tr("howText")}</p>
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

const ZONES = [
  ["darker_zone_hh_db", "zoneDark", "#2f6bff"],
  ["brighter_zone_hh_db", "zoneBright", "#ff3b3b"],
  ["stable_zone_hh_db", "zoneStable", "#94a0c4"],
];

/** HH echo over time in the zones that got darker / brighter / stayed the same, with the event marked. */
export function ZoneCard({ ds, kMain, onPick }) {
  const ev = ds.event, s = ev.series, d = ds.m.dates;
  const lang = getLang();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => d.map((x) => fmtDate(x.date, true)), [d, lang]);
  const at = eventAt(ds);
  const datasets = useMemo(() => ZONES.filter(([k]) => s?.[k]).map(([k, label, color]) => ({
    label: t(label), data: s[k], borderColor: color, backgroundColor: color, tension: 0.25, spanGaps: true,
    pointRadius: d.map((_, i) => (i === kMain ? 6 : 3)), pointHoverRadius: 7,
    pointBackgroundColor: d.map((_, i) => (i === kMain ? "#fff" : color)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [s, d, kMain, lang]);
  const options = useMemo(() => ({
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", align: "start", labels: { boxWidth: 10, boxHeight: 10 } },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y?.toFixed(1)} dB` } },
      eventLine: { at, label: t("floodMark") },
    },
    scales: { y: { title: { display: true, text: "HH dB" } }, x: { grid: { display: false } } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [at, lang]);
  if (!s) return null;

  const dark = s.darker_zone_hh_db, bright = s.brighter_zone_hh_db;
  const mean = (ks, arr) => { const v = ks.map((i) => arr?.[i]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const preK = ev.before.at(-1);
  return (
    <section className="card">
      <h2>{t("zoneTitle")}</h2>
      <p className="hint">{t("zoneHint", { date: fmtDate(ev.date, true) })}</p>
      <LineChart labels={labels} datasets={datasets} options={options} onPointClick={onPick} />
      {dark && bright && (
        <p className="insight">
          {tr("zoneInsight", {
            b: f1(mean(ev.before, dark)), a: f1(mean(ev.after, dark)), date: fmtDate(ev.date, true),
            pre: f1(bright[preK]), preDay: fmtDate(d[preK].date, true),
          })}
        </p>
      )}
    </section>
  );
}

/** "Which polarization shows the change best?" for an event site, from the data team's before/after vs quiet-period test. */
export function EventPolCard({ ds, onView }) {
  const test = ds.event.polarization_test;
  if (!test?.length) return <p>{t("ec7none")}</p>;
  const win = test.reduce((a, b) => (b.signal_to_noise > a.signal_to_noise ? b : a));
  const max = Math.max(...test.map((p) => Math.max(p.flood_km2, p.control_km2)), 1);
  const hh = test.find((p) => p.pol === "HH");
  return (
    <section className="card">
      <h2>{t("polTitle")}</h2>
      <p className="hint">{t("evPolIntro")}</p>
      {test.map((p) => (
        <div key={p.pol} className={`polrow${p === win ? " win" : ""}`}>
          <div className="row between">
            <b>{p.pol}{p === win && <span className="tag">{t("clearest")}</span>}</b>
            <button className="ghost tiny" onClick={() => onView(p.pol.toLowerCase())}>{t("showOnMap")}</button>
          </div>
          <small>{t(p.pol === "HH" ? "polHHhint" : "polHVhint")}</small>
          <div className="bar"><i style={{ width: `${Math.max(4, (p.flood_km2 / max) * 100)}%` }} /></div>
          <div className="bar ctl"><i style={{ width: `${Math.max(2, (p.control_km2 / max) * 100)}%` }} /></div>
          <div className="polnums">
            <span>{tr("evPolRow", { f: f1(p.flood_km2), c: f1(p.control_km2) })}</span>
            <span>{tr("evPolRatio", { r: f1(p.signal_to_noise) })}</span>
          </div>
        </div>
      ))}
      <p className="insight"><b>{t("polWinner", { pol: win.pol })}</b> {hh && t("evPolWhy", { r: Math.round(hh.signal_to_noise) })}</p>
      <p className="hint">{t("polNasa")} <a href="https://storymaps.arcgis.com/stories/c00d7691b8004b20a14f28df710d05fd" target="_blank" rel="noreferrer">{t("polNasaLink")}</a></p>
    </section>
  );
}

/** Bounds [[w, s], [e, n]] of a four-corner footprint. */
export const cornerBounds = (c) => [
  [Math.min(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1]))],
  [Math.max(...c.map((p) => p[0])), Math.max(...c.map((p) => p[1]))],
];

export const CU_VIEWS = [["before", "cuBefore"], ["swipe", "cuSwipe"], ["after", "cuAfter"]];

/** The 10 m close-up of the lower valley: before/after pictures, the flood colours and where they are. */
export function CloseupCard({ ds, s, set, story, onPlace, onExit }) {
  const cu = ds.event.closeup;
  const st = cu.stats_km2;
  const x = st.control_darker_km2 > 0 ? st.flood_darker_km2 / st.control_darker_km2 : null;
  const check = (key, label, color) => (
    <label className="check">
      <input type="checkbox" checked={!!s[key]} onChange={(e) => set({ [key]: e.target.checked })} />
      <i className="swatch" style={{ background: color }} /> {t(label)}
    </label>
  );
  return (
    <section className="card story">
      <div className="row between">
        <h2>{t("cuTitle")}</h2>
        <button className="ghost tiny" onClick={onExit}>{t("cuExit")}</button>
      </div>
      <p className="lead">{tr("cuLead", { px: cu.pixel_m, nb: cu.before_dates.length, na: cu.after_dates.length })}</p>
      <div className="seg" role="tablist" aria-label={t("cuTitle")}>
        {CU_VIEWS.map(([id, label]) => (
          <button key={id} className={s.cuView === id ? "on" : ""} onClick={() => set({ cuView: id })} role="tab" aria-selected={s.cuView === id}>{t(label)}</button>
        ))}
      </div>
      {s.cuView === "swipe" && <p className="hint">{t("cuSwipeHint")}</p>}

      <div className="bigstats">
        <div className="dark">
          <b>{f1(st.flood_darker_km2)} km²</b>
          <small>{t("cuWet")}</small>
          <em>{t("cuWetEm")}</em>
        </div>
        <div className="bright">
          <b>{f1(st.flood_brighter_km2)} km²</b>
          <small>{t("cuDebris")}</small>
          <em>{t("cuDebrisEm")}</em>
        </div>
      </div>

      <div className="stack">
        {check("cuFlood", "cuShowFlood", "linear-gradient(90deg,#288cff 50%,#ff4632 50%)")}
        {check("cuHidden", "cuShowHidden", "#b4b4b4")}
        {check("cuSeason", "cuShowSeason", "#ffcd00")}
      </div>

      <h3>{t("cuWhere")}</h3>
      <ul className="cuplaces">
        {cu.zones_by_place.map((z) => (
          <li key={z.place}>
            <button className="link" onClick={() => onPlace(z.lonlat)}>{story.cuPlaces?.[z.place] ?? z.place}</button>
            <span>{tr(z.debris_km2 > 0 ? "cuPlaceBoth" : "cuPlaceWet", { w: z.wet_km2.toFixed(2), d: z.debris_km2.toFixed(2) })}</span>
          </li>
        ))}
      </ul>

      <details open>
        <summary>{t("evProofTitle")}</summary>
        <p>{tr("cuProof", { d: f1(st.flood_darker_km2), dc: f1(st.control_darker_km2), x: x ? x.toFixed(1) : "–", s: f1(st.seasonal_brighter_km2) })}</p>
      </details>
      <details>
        <summary>{t("cuWhyTitle")}</summary>
        <p>{story.cuWhy}</p>
        <p>{tr("cu60vs10", { px: cu.pixel_m })}</p>
      </details>
      <details>
        <summary>{t("qHow")}</summary>
        <p>{tr("cuMethod")}</p>
      </details>
    </section>
  );
}
