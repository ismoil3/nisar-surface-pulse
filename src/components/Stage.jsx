// Building blocks of the map page (layout A): the view bar and the timeline dock on the map,
// the step-by-step guide and the tabbed "answer" panel on the right.
import { useEffect, useRef } from "react";
import { MODES, LAYERS } from "./Controls.jsx";
import { fmtDate } from "../lib/nisar.js";
import { t } from "../lib/i18n.jsx";
import Actions from "./Actions.jsx";

/** View (what changed / film / before-after / signal change) and picture (radar / colour / photo / …), on the map. */
export function ViewBar({ ds, s, set, cu, eventStory }) {
  const modes = MODES.filter((m) => s.expert || !m.expert);
  const hasPhotos = ds.optical.some(Boolean);
  const xr = s.mode === "swipe" && s.xray;
  const layers = LAYERS.filter((l) => !l.expert && (!l.needsOptical || (hasPhotos && !xr)) && (!l.needsMotion || (ds.motion && s.mode === "single")));
  const pol = xr && s.pol === "photo" ? "rgb" : s.pol;
  if (cu) return null;
  return (
    <div className="viewbar">
      <div className="vb-modes" role="tablist" aria-label={t("step1")}>
        {modes.map((m) => (
          <button key={m.id} role="tab" aria-selected={s.mode === m.id} className={s.mode === m.id ? "on" : ""} onClick={() => set({ mode: m.id })} title={t(m.id === "story" && ds.event ? "modeEventSub" : m.id === "story" && ds.farm ? "modeFarmSub" : m.sub)}>
            <span className="mi" aria-hidden="true">{m.icon}</span><span className="vb-l">{t(m.title)}</span>
          </button>
        ))}
      </div>
      {s.mode !== "change" && !(eventStory && s.mode === "story") && (
        <div className="vb-layers" role="tablist" aria-label={t("step2")}>
          {layers.map((l) => (
            <button key={l.id} role="tab" aria-selected={pol === l.id} className={pol === l.id ? "on" : ""} onClick={() => set({ pol: l.id })}>{t(l.label)}</button>
          ))}
          {s.mode === "swipe" && hasPhotos && (
            <button className={`vb-xray${xr ? " on" : ""}`} onClick={() => set({ xray: !xr })} title={t("xrayHint")}>📷↔📡</button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Timeline under the map. One date: play + pick a date. Two dates: two markers, "From" (hollow) and "To" (filled);
 * the small switch says which one a click moves.
 */
export function Dock({ ds, s, set, playing, togglePlay, which, setWhich, sound, toggleSound }) {
  const d = ds.m.dates;
  const single = s.mode === "single";
  const xray = s.mode === "swipe" && s.xray; // camera vs radar: one pass, so one date
  const pick = (i) => (single ? set({ k: i }) : xray ? set({ kB: i }) : set(which === "a" ? { kA: i } : { kB: i }));
  const cur = single ? s.k : xray || which === "b" ? s.kB : s.kA;
  const wkm = d[single ? s.k : s.kB].water_km2;
  return (
    <div className={`dock${single || xray ? "" : " two"}`} role="group" aria-label={t("date")}>
      {xray ? null : single ? (
        <button className={`dock-play${playing ? " on" : ""}`} onClick={togglePlay} aria-label={t(playing ? "pause" : "play")}>{playing ? "❚❚" : "▶"}</button>
      ) : (
        <div className="dock-ab" role="radiogroup" aria-label={t("date")}>
          <button className={which === "a" ? "on" : ""} onClick={() => setWhich("a")} role="radio" aria-checked={which === "a"}><i className="mk-a" />{t("from")}</button>
          <button className={which === "b" ? "on" : ""} onClick={() => setWhich("b")} role="radio" aria-checked={which === "b"}><i className="mk-b" />{t("to")}</button>
        </div>
      )}
      <div className="dock-main">
        <div className="dock-date">
          {single ? <b>{fmtDate(d[s.k].date)}</b> : xray ? <b>{fmtDate(d[s.kB].date)}</b> : <b>{fmtDate(d[s.kA].date, true)} → {fmtDate(d[s.kB].date, true)}</b>}
          {wkm != null && <span>{t("lakeSize")} {wkm.toFixed(1)} {t("uKm2")}</span>}
        </div>
        <div className="dock-ticks">
          {d.map((x, i) => {
            const [day, mon] = fmtDate(x.date, true).split(" ");
            const cls = single ? (i === s.k ? "on" : i < s.k ? "past" : "") : xray ? (i === s.kB ? "on" : "")
              : [i === s.kB ? "on" : "", i === s.kA ? "a" : "", i > Math.min(s.kA, s.kB) && i < Math.max(s.kA, s.kB) ? "past" : ""].join(" ");
            return (
              <button key={x.date} className={`${cls}${x.validated ? " val" : ""}`} onClick={() => pick(i)} title={fmtDate(x.date) + (x.validated ? ` · ${t("valTag")}` : "")} aria-current={i === cur}>
                <i /><small>{x.validated && <b className="vdot" aria-hidden="true">◆</b>}{day} {mon}</small>
              </button>
            );
          })}
        </div>
      </div>
      {single && toggleSound && <button className={`dock-sound${sound ? " on" : ""}`} onClick={toggleSound} aria-pressed={sound} title={t("sndHint")} aria-label={t(sound ? "sndOn" : "sndOff")}>{sound ? "🔊" : "🔇"}</button>}
    </div>
  );
}

/** One chapter at a time in the right panel; each step also moves the map. Replaces the old tour + scroll story. */
export function Guide({ chapters, idx, onStep, onClose }) {
  const ch = chapters[idx];
  const box = useRef(null);
  useEffect(() => { box.current?.scrollTo({ top: 0 }); }, [idx]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches("input, select, textarea") || document.querySelector("dialog[open]")) return;
      if (e.key === "ArrowRight") onStep(idx + 1);
      if (e.key === "ArrowLeft") onStep(idx - 1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, onStep, onClose]);
  if (!ch) return null;
  const last = idx === chapters.length - 1;
  return (
    <section className="guide">
      <div className="guide-top">
        <span className="guide-n">{t("guideStep", { i: idx + 1, n: chapters.length })}</span>
        <button className="ghost tiny" onClick={onClose}>{t("guideClose")} ×</button>
      </div>
      <div className="guide-bar" aria-hidden="true"><i style={{ width: `${((idx + 1) / chapters.length) * 100}%` }} /></div>
      <div className="guide-body" ref={box}>
        <h2>{ch.title}</h2>
        <div className="chapter-body">{ch.body}</div>
      </div>
      <div className="guide-nav">
        <button className="ghost" onClick={() => onStep(idx - 1)} disabled={idx === 0}>{t("tourBack")}</button>
        <div className="guide-dots" aria-hidden="true">{chapters.map((c, i) => <i key={c.id} className={i === idx ? "on" : i < idx ? "done" : ""} onClick={() => onStep(i)} />)}</div>
        <button className="primary" onClick={() => (last ? onClose() : onStep(idx + 1))}>{last ? t("guideDone") : `${t("tourNext")}`}</button>
      </div>
    </section>
  );
}

export const TABS = [
  ["what", "tabWhat"],
  ["why", "tabWhy"],
  ["trust", "tabTrust"],
  ["act", "tabAct"],
  ["lab", "tabLab"],
];

/** Tabs of the answer panel. `content` maps a tab id to what it shows. */
export function AnswerPanel({ tab, setTab, content, head }) {
  const body = useRef(null);
  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [tab]);
  return (
    <section className="answer-in">
      {head}
      <div className="tabs" role="tablist">
        {TABS.map(([id, k]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{t(k)}</button>
        ))}
      </div>
      <div className="answer-body" ref={body} role="tabpanel">{content[tab]}</div>
    </section>
  );
}

/** "Why" tab: the physical drivers, the human side, and what the radar cannot see. */
export function WhyTab({ story, method, extra }) {
  return (
    <div className="stack-l">
      <section className="card"><h2>{t("qWhy")}</h2><p>{story.why}</p>{story.human && <p>{story.human}</p>}</section>
      {extra}
      <section className="card"><h2>{t("qMiss")}</h2><ul className="caveats">{story.notSeen.map(([h, x]) => <li key={h}><b>{h}.</b> {x}</li>)}</ul></section>
      {method && <section className="card"><h2>{t("qHow")}</h2><p>{method}</p></section>}
    </div>
  );
}

/** "What to do" tab: why it matters, one action per audience, and what NISAR could do next. */
export function ActTab({ story, onReport }) {
  return (
    <div className="stack-l">
      <section className="card story"><h2>{t("qMatters")}</h2><p>{story.matters}</p><Actions story={story} />
        {onReport && <button className="primary report-btn" onClick={onReport}>📄 {t("repBtn")}</button>}
      </section>
      <section className="card"><h2>{t("qFuture")}</h2>
        <ul className="future">{story.future.map(([ic, h, x]) => <li key={h}><span aria-hidden="true">{ic}</span><div><b>{h}.</b> {x}</div></li>)}</ul>
      </section>
    </div>
  );
}
