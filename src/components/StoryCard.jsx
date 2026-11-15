import Actions from "./Actions.jsx";
import { fmtDate, signed, PITCH_KM2 } from "../lib/nisar.js";
import { fmtInt, placeName, rich, t, tr, tNote } from "../lib/i18n.jsx";

/** "Roghun (15,132 people), Obigarm (7,085 people), …" in the current language. */
export function placeList(places, max) {
  return places.slice(0, max).map((p) => placeName(p) + (p.population ? ` (${t("peopleN", { n: fmtInt(p.population) })})` : "")).join(", ");
}

/** Plain-language summary of the water change between two dates, for people who have never seen radar data. */
export default function StoryCard({ ds, story, kA, kB, wd, near = [], onZoomHotspot, onSwap }) {
  const m = ds.m;
  const dA = m.dates[kA], dB = m.dates[kB];
  const order = kA <= kB;

  if (!wd) {
    const missing = [dA, dB].filter((d) => d.water_km2 == null);
    const note = missing[0]?.note ? ` (${tNote(missing[0].note).toLowerCase()})` : "";
    return (
      <section className="card">
        <h2>{t("whatChanged")}</h2>
        <p className="warn">
          {missing.length
            ? t("noOutlineFor", { dates: missing.map((d) => fmtDate(d.date, true)).join(` ${t("and")} `), note })
            : t("noOutlines")}
        </p>
      </section>
    );
  }

  // the measured lake areas when both dates have them (the same number as the area chart and the landing page);
  // the pixel difference of the two outlines can differ by about 0.1 km² from rounding at the edges
  const net = dA.water_km2 != null && dB.water_km2 != null ? dB.water_km2 - dA.water_km2 : wd.gained - wd.lost;
  const pct = dA.water_km2 ? (net / dA.water_km2) * 100 : null;
  const grew = net > 0.05, shrank = net < -0.05;
  const lvA = dA.level_m_est, lvB = dB.level_m_est;
  const pctTxt = pct != null && (grew || shrank) ? t("leadPct", { pct: signed(pct, 0) }) : "";
  // on multi-lake sites the level belongs to one lake only (story.levelAt names it)
  const levelTxt = lvA != null && lvB != null && lvA !== lvB
    ? t((lvB > lvA ? "leadRose" : "leadFell") + (story.levelAt ? "At" : ""), { m: Math.abs(lvB - lvA), at: story.levelAt })
    : "";
  const lead = t(grew ? "leadGrew" : shrank ? "leadShrank" : "leadSame", {
    a: fmtDate(dA.date), b: fmtDate(dB.date), name: story.leadName || story.name || m.name, pct: pctTxt, level: levelTxt,
  });

  return (
    <section className="card story has-more">
      <div className="row between">
        <h2>{t("whatChanged")}</h2>
        <span className={`pill ${shrank ? "neg" : ""}`}>{signed(net)} {t("uKm2")}</span>
      </div>

      {!order && (
        <p className="warn">{t("reversed")} <button className="link" onClick={onSwap}>{t("swap")}</button></p>
      )}

      <p className="lead">{rich(lead)}</p>

      <div className="bigstats">
        <div className="gain">
          <b>{wd.gained.toFixed(1)} km²</b>
          <small>{t("newWater")}</small>
          <em>{t("pitches", { n: fmtInt(wd.gained / PITCH_KM2) })}</em>
        </div>
        <div className="loss">
          <b>{wd.lost.toFixed(1)} km²</b>
          <small>{t("waterGone")}</small>
          <em>{wd.lost < 0.3 ? t("almostNothing") : t("pitchesShort", { n: fmtInt(wd.lost / PITCH_KM2) })}</em>
        </div>
      </div>

      <div className="legend">
        <span><i className="sw gain" />{t("legendGain", { a: fmtDate(dA.date, true), b: fmtDate(dB.date, true) })}</span>
        <span><i className="sw loss" />{t("legendLoss")}</span>
        <span><i className="sw keep" />{t("legendKeep")}</span>
      </div>

      {wd.hotspot && <button className="primary" onClick={onZoomHotspot}>{t("hotspotBtn")}</button>}

      <details open>
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
        {near.length > 0 && (
          <p>
            {tr("nearText", { n: near.length, list: placeList(near, 6), more: near.length > 6 ? t("andOthers") : "" })}{" "}
            <em>{t("osmSource")}</em>
          </p>
        )}
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
