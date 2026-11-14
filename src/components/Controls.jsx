import { fmtDate, opticalSensor, signed } from "../lib/nisar.js";
import { t, tr, tNote } from "../lib/i18n.jsx";

// Views are phrased as what the visitor wants to do. `expert: true` ones are hidden in Simple mode.
export const MODES = [
  { id: "story", title: "modeStory", sub: "modeStorySub", icon: "◎" },
  { id: "single", title: "modeSingle", sub: "modeSingleSub", icon: "▶" },
  { id: "swipe", title: "modeSwipe", sub: "modeSwipeSub", icon: "⇆" },
  { id: "change", title: "modeChange", sub: "modeChangeSub", icon: "Δ", expert: true },
];

export const LAYERS = [
  { id: "hh", label: "layerRadar", expertLabel: "layerRadarX" },
  { id: "rgb", label: "layerRGB" },
  { id: "photo", label: "layerPhoto", needsOptical: true },
  { id: "hv", label: "layerHV", expert: true },
  { id: "insar", label: "layerInsar", expert: true, needsInsar: true },
  { id: "motion", label: "layerMotion", needsMotion: true },
];

/** "Photo taken the same day" / "2 days earlier" note for a date's optical image. */
export function PhotoNote({ ds, k }) {
  const o = ds.optical[k];
  const day = fmtDate(ds.m.dates[k].date, true);
  if (!o) return <>{t("photoNone", { day })}</>;
  const n = Math.abs(o.offset_days);
  const when = n === 0 ? t("photoSame") : t(o.offset_days < 0 ? "photoBefore" : "photoAfter", { n });
  const cloud = o.cloud_pct >= 8 ? t("photoCloud", { pct: o.cloud_pct }) : "";
  return <>{tr("photoLine", { day, sensor: opticalSensor(o), date: fmtDate(o.date, true), when, cloud })}</>;
}

/** One plain sentence (plus a colour key) that tells a newcomer how to read the chosen picture. */
export function LayerHelp({ ds, s }) {
  const key = (items) => (
    <span className="key">
      {items.map(([c, k]) => <span key={k}><i style={{ background: c }} />{t(k)}</span>)}
    </span>
  );
  if (s.pol === "photo")
    return (
      <p className="hint">
        {t("helpPhoto")}<br />
        {s.mode !== "single" && <><PhotoNote ds={ds} k={s.kA} /><br /></>}
        <PhotoNote ds={ds} k={s.mode === "single" ? s.k : s.kB} />
      </p>
    );
  if (s.pol === "rgb")
    return (
      <p className="hint">
        {t("helpRGB")}
        {key([["#b6e02c", "keyPlants"], ["#b06be0", "keyBare"], ["#16323a", "keyWater"]])}
      </p>
    );
  if (s.pol === "insar" && ds.insar)
    return (
      <p className="hint">
        {t("helpInsar", { a: fmtDate(ds.insar.from, true), b: fmtDate(ds.insar.to, true) })}
        {key([["#dfe3f0", "keyInsarSmooth"], ["#7a3b6b", "keyInsarNoise"]])}
      </p>
    );
  if (s.pol === "motion" && ds.motion)
    return (
      <p className="hint">
        {t("helpMotion")}
        {key([["#b2182b", "moKeyRed"], ["#2166ac", "moKeyBlue"], ["#c5c5c5", "moKeyCoh"]])}
      </p>
    );
  if (s.pol === "hv") return <p className="hint">{t("helpHV")}</p>;
  return (
    <p className="hint">
      {t("helpHH")}
      {key([["#f2f2f2", "keyRock"], ["#333", "keySmooth"]])}
    </p>
  );
}

export default function Controls({ ds, s, set, playing, onTogglePlay, change, hasWater, dock, lab }) {
  const dates = ds.m.dates;
  const dateOptions = dates.map((d, i) => <option key={d.date} value={i}>{fmtDate(d.date)}</option>);
  const wa = dates[s.kA].water_km2, wb = dates[s.kB].water_km2;
  const modes = MODES.filter((m) => s.expert || !m.expert);
  const hasPhotos = ds.optical.some(Boolean);
  const xr = s.mode === "swipe" && s.xray; // camera vs radar on the same pass
  const layers = LAYERS.filter((l) => (s.expert || !l.expert) && (!l.needsOptical || (hasPhotos && !xr)) && (!l.needsInsar || (ds.insar && s.mode === "single")) && (!l.needsMotion || (ds.motion && s.mode === "single")));
  const pol = xr && s.pol === "photo" ? "rgb" : s.pol;

  return (
    <section className="card">
      {!lab && <div className="step"><span>1</span>{t("step1")}</div>}
      {!lab && <div className={`modes n${modes.length}`} role="tablist" aria-label={t("step1")}>
        {modes.map((m) => (
          <button key={m.id} className={s.mode === m.id ? "on" : ""} onClick={() => set({ mode: m.id })} role="tab" aria-selected={s.mode === m.id}>
            <span className="mi" aria-hidden="true">{m.icon}</span>
            <b>{t(m.title)}</b>
            <small>{t(m.id === "story" && ds.event ? "modeEventSub" : m.id === "story" && ds.farm ? "modeFarmSub" : m.sub)}</small>
          </button>
        ))}
      </div>}

      {!lab && s.mode === "swipe" && hasPhotos && (
        <div className="seg" role="tablist">
          <button className={!xr ? "on" : ""} onClick={() => set({ xray: false })} role="tab" aria-selected={!xr}>{t("swTwoDates")}</button>
          <button className={xr ? "on" : ""} onClick={() => set({ xray: true })} role="tab" aria-selected={xr}>{t("swXray")}</button>
        </div>
      )}

      {s.mode !== "change" && (
        <>
          <div className="step"><span>2</span>{t("step2")}</div>
          <div className="seg" role="tablist" aria-label={t("step2")}>
            {layers.map((l) => (
              <button key={l.id} className={pol === l.id ? "on" : ""} onClick={() => set({ pol: l.id })} role="tab" aria-selected={pol === l.id}>
                {t(s.expert && l.expertLabel ? l.expertLabel : l.label)}
              </button>
            ))}
          </div>
          {xr
            ? <p className="hint">{t("xrayHint")}<br />{ds.optical[s.kB] ? <PhotoNote ds={ds} k={s.kB} /> : t("xrayNoPhoto")}</p>
            : <LayerHelp ds={ds} s={s} />}
        </>
      )}

      {ds.event && s.mode === "story" ? (
        <p className="hint">{tr("evPairNote", { nb: ds.event.before.length, na: ds.event.after.length, date: fmtDate(ds.event.date) })}</p>
      ) : dock ? <p className="hint dock-hint">{t("dockHint")}</p> : <div className="step"><span>{s.mode === "change" ? 2 : 3}</span>{t(s.mode === "single" ? "step3single" : xr ? "step3one" : "step3pair")}</div>}

      {ds.event && s.mode === "story" ? null : s.mode === "single" && dock ? null : s.mode === "single" ? (
        <div>
          <div className="timeline">
            <button className={`play${playing ? " on" : ""}`} onClick={onTogglePlay}>
              {t(playing ? "pause" : "play")}
            </button>
            <span className="mono bigdate">{fmtDate(dates[s.k].date)}</span>
          </div>
          <input type="range" min={0} max={dates.length - 1} step={1} value={s.k} aria-label={t("date")}
            onChange={(e) => set({ k: +e.target.value })} />
          <div className="ticks">
            {dates.map((d, i) => {
              const [day, mon] = fmtDate(d.date, true).split(" ");
              return (
                <span key={d.date} className={i === s.k ? "on" : ""} onClick={() => set({ k: i })}>
                  {day}<br />{mon}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="pair">
            {!xr && <label>{t("from")}
              <select value={s.kA} onChange={(e) => set({ kA: +e.target.value })}>{dateOptions}</select>
            </label>}
            <label>{t(xr ? "date" : "to")}
              <select value={s.kB} onChange={(e) => set({ kB: +e.target.value })}>{dateOptions}</select>
            </label>
          </div>

          {s.mode === "swipe" && !xr && <p className="hint">{t("swipeHint")}</p>}

          {s.mode === "change" && (
            <>
              <div className="row between">
                <span className="lbl">{t("threshold")}</span>
                <span className="mono">{s.thr} dB</span>
              </div>
              <input type="range" min={1} max={8} step={0.5} value={s.thr} onChange={(e) => set({ thr: +e.target.value })} />
              <div className="row">
                <span className="lbl">{t("compareIn")}</span>
                <div className="seg small">
                  {["hh", "hv"].map((p) => (
                    <button key={p} className={s.cpol === p ? "on" : ""} onClick={() => set({ cpol: p })}>{p.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div className="legend">
                <span><i style={{ background: "#2f6bff" }} />{t("sigLoss")} <em>{t(ds.farm ? "sigLossEmFarm" : "sigLossEm")}</em></span>
                <span><i style={{ background: "#ff3b3b" }} />{t("sigGain")} <em>{t(ds.farm ? "sigGainEmFarm" : "sigGainEm")}</em></span>
              </div>
              <p className="hint">{t(ds.farm ? "changeHintFarm" : "changeHint")}</p>
              <div className="stats3">
                <div><b>{change ? change.down.toFixed(1) : "–"}</b><small>{t("kmDarker")}</small></div>
                <div><b>{change ? change.up.toFixed(1) : "–"}</b><small>{t("kmBrighter")}</small></div>
                {hasWater && <div><b>{wa != null && wb != null ? signed(wb - wa) : "–"}</b><small>{t("dWater")}</small></div>}
              </div>
            </>
          )}
        </div>
      )}

      {[...(s.mode === "single" ? [s.k] : xr ? [s.kB] : [s.kA, s.kB])].filter((i) => dates[i].note).map((i) => (
        <p className="warn" key={i}>{fmtDate(dates[i].date, true)}: {tNote(dates[i].note)}.</p>
      ))}

      <details className="opts" open={s.terrain || undefined}>
        <summary>{t("mapOptions")}</summary>
        <div className="stack">
          <label className="check" title={t("opt3dTitle")}>
            <input type="checkbox" checked={s.terrain} onChange={(e) => set({ terrain: e.target.checked })} /> {t("opt3d")}
          </label>
          <label className="check">
            <input type="checkbox" checked={s.showWater} disabled={!hasWater} onChange={(e) => set({ showWater: e.target.checked })} /> {t("optWater")}
          </label>
          {ds.context && (
            <label className="check">
              <input type="checkbox" checked={s.showContext} onChange={(e) => set({ showContext: e.target.checked })} /> {t("optContext")}
            </label>
          )}
          <label className="check">
            <input type="checkbox" checked={s.showLabels} onChange={(e) => set({ showLabels: e.target.checked })} /> {t("optLabels")}
          </label>
          <div className="row between">
            <span className="lbl">{t("optOpacity")}</span>
            <input type="range" className="grow" min={0} max={1} step={0.01} value={s.opacity}
              onChange={(e) => set({ opacity: +e.target.value })} />
          </div>
          <p className="hint">{t("optBgHint")}</p>
        </div>
      </details>
    </section>
  );
}
