import { fmtDate } from "../lib/nisar.js";
import { t, tr } from "../lib/i18n.jsx";

const f1 = (x) => x.toFixed(1);

/** Physical reasons, written from what the numbers actually say for this pair of dates. */
function reasons(pc) {
  const w = pc.winner, o = w === "hh" ? "hv" : "hh";
  const out = [t(w === "hh" ? "polWhyHH" : "polWhyHV", { hh: f1(pc.hh.contrast), hv: f1(pc.hv.contrast) })];
  if (Math.max(pc.hh.drop, pc.hv.drop) < 5)
    out.push(t("polLowDrop", { w: f1(pc[w].drop), W: w.toUpperCase(), o: f1(pc[o].drop), O: o.toUpperCase() }));
  return out;
}

/** Answers "which polarization shows the change best?" with numbers measured on this site's pixels. */
export default function PolCard({ ds, kA, kB, pc, onView }) {
  if (!pc) return null;
  const d = ds.m.dates;
  const max = Math.max(pc.hh.drop, pc.hv.drop, 1);
  const row = (id, hintKey) => {
    const p = pc[id];
    return (
      <div className={`polrow${pc.winner === id ? " win" : ""}`}>
        <div className="row between">
          <b>{id.toUpperCase()}{pc.winner === id && <span className="tag">{t("clearest")}</span>}</b>
          <button className="ghost tiny" onClick={() => onView(id)}>{t("showOnMap")}</button>
        </div>
        <small>{t(hintKey)}</small>
        <div className="bar"><i style={{ width: `${Math.max(4, (p.drop / max) * 100)}%` }} /></div>
        <div className="polnums">
          <span>{tr("echoFell", { d: f1(p.drop) })} <em>({f1(p.before)} → {f1(p.after)} dB)</em></span>
          <span>{tr("gap", { g: f1(p.contrast), s: p.sep.toFixed(2) })}</span>
        </div>
      </div>
    );
  };
  return (
    <section className="card">
      <h2>{t("polTitle")}</h2>
      <p className="hint">{tr("polIntro", { km: pc.km2.toFixed(1), a: fmtDate(d[kA].date, true), b: fmtDate(d[kB].date, true) })}</p>
      {row("hh", "polHHhint")}
      {row("hv", "polHVhint")}
      <p className="insight">
        <b>{t("polWinner", { pol: pc.winner.toUpperCase() })}</b> {reasons(pc).join(" ")}
      </p>
      <p className="hint">{t("polFoot")}</p>
      <p className="hint">{t("polNasa")} <a href="https://storymaps.arcgis.com/stories/c00d7691b8004b20a14f28df710d05fd" target="_blank" rel="noreferrer">{t("polNasaLink")}</a></p>
    </section>
  );
}
