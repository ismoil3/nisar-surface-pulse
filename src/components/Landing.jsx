import { useEffect, useRef, useState } from "react";
import { DATA_ROOT } from "../lib/nisar.js";
import { storyFor } from "../lib/stories.js";
import { LANGS, getLang, rich, t } from "../lib/i18n.jsx";
import { summarize } from "./Dashboard.jsx";

const IMG = {
  hero: `${DATA_ROOT}vakhsh_cascade/2026-10-13_RGB.webp`,
  water: `${DATA_ROOT}vakhsh_cascade/2026-09-07_RGB.webp`,
  motion: `${DATA_ROOT}vakhsh_cascade/motion/coherence.png`,
  crops: `${DATA_ROOT}vakhsh/2026-09-07_RGB.webp`,
  flood: `${DATA_ROOT}nepal/closeup/after.webp`,
  before: `${DATA_ROOT}nepal/closeup/before.webp`,
  after: `${DATA_ROOT}nepal/closeup/after.webp`,
  floodMap: `${DATA_ROOT}nepal/closeup/flood.png`,
};

/** Adds .in to elements with [data-reveal] when they scroll into view (one-shot). */
function useReveal(root) {
  useEffect(() => {
    const els = root.current?.querySelectorAll("[data-reveal]") ?? [];
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { threshold: 0.15 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  });
}

/** Number that counts up from 0 the first time it is seen. */
function CountUp({ value, digits = 1, sign = false }) {
  const ref = useRef(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (value == null) return;
    let raf, start;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const step = (ts) => {
        start ??= ts;
        const k = Math.min(1, (ts - start) / 1400);
        setV(value * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.5 });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  const s = value == null ? "–" : (sign && value > 0 ? "+" : "") + v.toFixed(digits).replace(".", getLang() === "en" ? "." : ",");
  return <span ref={ref}>{s}</span>;
}

/** Before / after slider on the 10 m flood close-up (images load only when the section is near). */
function FloodSlider() {
  const [x, setX] = useState(0.55);
  const [map, setMap] = useState(true);
  const box = useRef(null), drag = useRef(false);
  const move = (e) => {
    if (!drag.current) return;
    const r = box.current.getBoundingClientRect();
    setX(Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)));
  };
  return (
    <div className="lp-slider-wrap">
      <div className="lp-slider" ref={box}
        onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={move} onPointerUp={() => (drag.current = false)}>
        <img src={IMG.after} alt={t("lpAfter")} loading="lazy" draggable="false" />
        {map && <img src={IMG.floodMap} alt="" className="lp-flood" loading="lazy" draggable="false" />}
        <div className="lp-before" style={{ clipPath: `inset(0 ${(1 - x) * 100}% 0 0)` }}>
          <img src={IMG.before} alt={t("lpBefore")} loading="lazy" draggable="false" />
        </div>
        <div className="lp-handle" style={{ left: `${x * 100}%` }} role="slider" tabIndex={0} aria-label={t("divider")} aria-valuenow={Math.round(x * 100)}
          onKeyDown={(e) => { if (e.key === "ArrowLeft") setX((v) => Math.max(0.02, v - 0.05)); if (e.key === "ArrowRight") setX((v) => Math.min(0.98, v + 0.05)); }}>
          <span>⟷</span>
        </div>
        <b className="lp-tag l">{t("lpBefore")}</b>
        <b className="lp-tag r">{t("lpAfter")}</b>
      </div>
      <label className="lp-toggle"><input type="checkbox" checked={map} onChange={(e) => setMap(e.target.checked)} /> {t("lpFloodToggle")}</label>
    </div>
  );
}

/** Small looping drawing: a radar wave hitting a surface and what comes back. */
function Echo({ kind }) {
  return (
    <svg viewBox="0 0 220 140" className={`lp-echo e-${kind}`} aria-hidden="true">
      <defs>
        <linearGradient id={`g-${kind}`} x1="0" x2="1"><stop offset="0" stopColor="currentColor" stopOpacity="0" /><stop offset="1" stopColor="currentColor" /></linearGradient>
      </defs>
      {/* satellite */}
      <g transform="translate(18 14)"><rect x="-6" y="-4" width="12" height="8" rx="2" className="sat" /><rect x="-18" y="-2" width="10" height="4" className="sat" /><rect x="8" y="-2" width="10" height="4" className="sat" /></g>
      {/* outgoing wave */}
      <path d="M24 22 L110 104" className="wave out" />
      {kind === "water" && <><rect x="0" y="104" width="220" height="36" className="surf water" /><path d="M110 104 L200 22" className="wave away" /></>}
      {kind === "rock" && <><path d="M0 140 L0 112 L30 100 L52 110 L80 94 L104 106 L130 92 L160 108 L190 98 L220 110 L220 140 Z" className="surf rock" /><path d="M110 102 L26 24" className="wave back" /><path d="M110 102 L70 40" className="wave back2" /><path d="M110 102 L160 44" className="wave lost" /></>}
      {kind === "plant" && <><rect x="0" y="122" width="220" height="18" className="surf soil" />
        {[70, 92, 114, 136, 158].map((px, i) => <path key={px} d={`M${px} 122 C ${px - 6} 104, ${px + 8} 98, ${px} 80 M${px} 104 l -12 -8 M${px} 96 l 12 -9`} className="stem" style={{ animationDelay: `${i * 0.15}s` }} />)}
        <path d="M110 100 L120 110 L104 116 L116 92 L26 24" className="wave turned" /></>}
    </svg>
  );
}

/** Small static side view of the Vakhsh (the full, moving one is the "river" page). */
function RiverTeaser({ onRiver }) {
  const [P, setP] = useState(null);
  useEffect(() => { fetch(`${DATA_ROOT}river/profile.json`).then((r) => r.json()).then(setP).catch(() => {}); }, []);
  if (!P) return null;
  const X = (km) => 10 + (km / P.length_km) * 580, Y = (z) => 16 + ((1260 - z) / 960) * 200;
  const dam = (id) => P.marks.find((m) => m.id === id), nk = P.nurek_dem, rd = dam("rogun"), below = P.pts.find((p) => p[0] > dam("nurek").km + 1.5)[1];
  const bed = P.pts.map(([km, z]) => (km >= nk.from_km && km <= nk.to_km ? [km, nk.level_m - (nk.level_m - below - 30) * Math.pow((km - nk.from_km) / (nk.to_km - nk.from_km), 1.25)] : [km, z]));
  const line = bed.map(([km, z]) => `${X(km).toFixed(1)},${Y(z).toFixed(1)}`).join(" ");
  const lake = (a, b, lv) => `M${X(a)},${Y(lv)} L${X(b)},${Y(lv)} ` + bed.filter(([km, z]) => km >= a && km <= b && z <= lv).reverse().map(([km, z]) => `L${X(km)},${Y(z)}`).join(" ") + " Z";
  const f = P.frames.vakhsh, plants = [];
  for (let km = f[0] + 4; km < f[1] - 1; km += 4) plants.push([X(km), Y(P.pts.reduce((a, p) => (Math.abs(p[0] - km) < Math.abs(a[0] - km) ? p : a))[1])]);
  return (
    <button className="lp-river-pic" onClick={onRiver} aria-label={t("lpRiverBtn")}>
      <svg viewBox="0 0 600 240" aria-hidden="true">
        <defs><linearGradient id="lr-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3ce1ff" /><stop offset="1" stopColor="#1668c9" /></linearGradient></defs>
        <path d={lake(14, rd.km, 1131)} fill="url(#lr-w)" /><path d={lake(nk.from_km, nk.to_km, nk.level_m)} fill="url(#lr-w)" />
        <polygon points={`10,232 ${line} 590,232`} fill="#18213c" /><polyline points={line} fill="none" stroke="#8fa0cf" strokeWidth="1.4" />
        <polyline points={line} className="rv-flow on" />
        {plants.map(([x, y], i) => <path key={i} d={`M${x},${y} v-13 M${x},${y - 6} l-3.5,-3 M${x},${y - 9} l3.5,-3`} stroke="#c6ff3d" strokeWidth="1.5" fill="none" strokeLinecap="round" />)}
      </svg>
      <div className="steps"><span><b>① {t("res_rogun")}</b>{t("rvStep1")}</span><span><b>② {t("res_nurek")}</b>{t("rvStep2")}</span><span><b>③ {t("rvFields")}</b>{t("rvStep3")}</span></div>
    </button>
  );
}

export default function Landing({ sites, lang, chooseLang, onOpen, onTour, onRiver }) {
  const root = useRef(null);
  const [sum, setSum] = useState(null);
  useEffect(() => { if (sites && !sum) Promise.all(sites.map(summarize)).then(setSum).catch(() => setSum([])); }, [sites, sum]);
  useReveal(root);
  const by = (id) => sum?.find((s) => s.id === id);
  const water = by("vakhsh_cascade"), crops = by("vakhsh"), flood = by("nepal");
  const gained = water?.res ? water.res.reduce((a, r) => a + (r.b - r.a), 0) : null;
  const spot = water?.motion?.spots?.[0];
  const rise = crops?.farm ? Math.max(...crops.farm.hv_median_db) - crops.farm.hv_median_db[0] : null;
  const wet = flood?.closeup?.stats_km2.flood_darker_km2 ?? null;
  const personal = storyFor("vakhsh_cascade", lang).personal;
  const name = (id) => storyFor(id, lang).name;

  const stories = [
    { id: "water", site: "vakhsh_cascade", hash: "mode=story&f=lakes", img: IMG.water, kind: "lpKindWater", title: name("vakhsh_cascade"), n: gained, unit: t("uKm2"), digits: 1, sign: true, label: "lpWaterNum", line: "lpWaterLine" },
    { id: "motion", site: "vakhsh_cascade", hash: "mode=single&pol=motion&f=slope", img: IMG.motion, kind: "lpKindMotion", title: t("lpMotionTitle"), n: spot?.total_cm ?? null, unit: t("uCm"), digits: 1, sign: true, label: "lpMotionNum", line: "lpMotionLine" },
    { id: "crops", site: "vakhsh", hash: "mode=story", img: IMG.crops, kind: "lpKindCrops", title: name("vakhsh"), n: rise, unit: t("uDb"), digits: 1, sign: true, label: "lpCropsNum", line: "lpCropsLine" },
    { id: "flood", site: "nepal", hash: "mode=story&cu=1&cv=swipe&f=flood", img: IMG.flood, kind: "lpKindFlood", title: name("nepal"), n: wet, unit: t("uKm2"), digits: 1, label: "lpFloodNum", line: "lpFloodLine" },
  ];

  return (
    <div className="lp" ref={root}>
      <nav className="lp-nav">
        <div className="lp-logo"><i className="pulse" aria-hidden="true" /><span>Surface Pulse</span></div>
        <div className="lp-nav-r">
          <div className="lp-langs" role="group" aria-label={t("language")}>
            {LANGS.map((l) => <button key={l.id} className={lang === l.id ? "on" : ""} onClick={() => chooseLang(l.id)} lang={l.id}>{l.label}</button>)}
          </div>
          <button className="lp-btn sm" onClick={() => onOpen("water", "mode=story")}>{t("lpOpenMap")}</button>
        </div>
      </nav>

      {/* ---------- hero: radar sweeps the clouds away ---------- */}
      <header className="lp-hero">
        <div className="lp-scene" aria-hidden="true">
          <img src={IMG.hero} alt="" className="lp-radar" />
          <div className="lp-clouds"><i /><i /><i /><i /><i /></div>
          <div className="lp-beam" />
          <div className="lp-grid" />
        </div>
        <div className="lp-hero-txt">
          <p className="lp-kicker"><span className="dot" />{t("lpKicker")}</p>
          <h1>{t("lpH1a")}<br /><em>{t("lpH1b")}</em></h1>
          <p className="lp-sub">{t("lpSub")}</p>
          <div className="lp-ctas">
            <button className="lp-btn" onClick={() => onOpen("water", "mode=story")}>{t("lpStart")} →</button>
            <button className="lp-btn ghost" onClick={onTour}>▶ {t("lpTour")}</button>
            <button className="lp-btn ghost" onClick={onRiver}>〰 {t("lpRiverK")}</button>
          </div>
        </div>
        <p className="lp-beam-cap" aria-hidden="true">{t("lpBeamCap")}</p>
        <div className="lp-scroll" aria-hidden="true">↓</div>
      </header>

      {/* ---------- how radar sees ---------- */}
      <section className="lp-sec lp-how">
        <p className="lp-k" data-reveal>{t("lpHowK")}</p>
        <h2 data-reveal>{t("lpHowT")}</h2>
        <p className="lp-lead" data-reveal>{t("lpHowS")}</p>
        <div className="lp-three">
          {[["water", "lpWaterH", "lpWaterT"], ["rock", "lpRockH", "lpRockT"], ["plant", "lpPlantH", "lpPlantT"]].map(([k, h, x], i) => (
            <article key={k} className={`lp-tile t-${k}`} data-reveal style={{ transitionDelay: `${i * 0.12}s` }}>
              <Echo kind={k} />
              <h3>{t(h)}</h3>
              <p>{rich(t(x))}</p>
            </article>
          ))}
        </div>
        <p className="lp-foot" data-reveal>{rich(t("lpHowFoot"))}</p>
      </section>

      {/* ---------- four stories ---------- */}
      <section className="lp-sec lp-stories">
        <p className="lp-k" data-reveal>{t("lpStoriesK")}</p>
        <h2 data-reveal>{t("lpStoriesT")}</h2>
        <div className="lp-cards">
          {stories.map((s, i) => (
            <button key={s.id} className={`lp-card c-${s.id}`} data-reveal style={{ transitionDelay: `${i * 0.08}s` }} onClick={() => onOpen(s.id, s.hash)}>
              <img src={s.img} alt="" loading="lazy" />
              <div className="lp-card-body">
                <span className="lp-chip">{t(s.kind)}</span>
                <h3>{s.title}</h3>
                <p className="lp-num"><CountUp value={s.n} digits={s.digits} sign={s.sign} /><small>{s.unit}</small></p>
                <p className="lp-num-l">{t(s.label)}</p>
                <p className="lp-line">{t(s.line)}</p>
                <span className="lp-go">{t("lpOpenStory")} →</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ---------- one river, one pulse ---------- */}
      <section className="lp-sec lp-river">
        <div>
          <p className="lp-k" data-reveal>{t("lpRiverK")}</p>
          <h2 data-reveal>{t("lpRiverT")}</h2>
          <p className="lp-lead" data-reveal>{rich(t("lpRiverS", { km: 257 }))}</p>
          <button className="lp-btn" data-reveal onClick={onRiver}>{t("lpRiverBtn")} →</button>
        </div>
        <div data-reveal><RiverTeaser onRiver={onRiver} /></div>
      </section>

      {/* ---------- before / after ---------- */}
      <section className="lp-sec lp-ba">
        <div className="lp-ba-txt">
          <p className="lp-k" data-reveal>{t("lpSlideK")}</p>
          <h2 data-reveal>{t("lpSlideT")}</h2>
          <p className="lp-lead" data-reveal>{rich(t("lpSlideS"))}</p>
          <button className="lp-btn ghost" data-reveal onClick={() => onOpen("flood", "mode=story&cu=1&cv=swipe&f=flood")}>{t("lpSlideBtn")} →</button>
        </div>
        <div data-reveal><FloodSlider /></div>
      </section>

      {/* ---------- NISAR in numbers ---------- */}
      <section className="lp-band">
        {[["12", "lpF1"], ["24", "lpF2"], ["240", "lpF3"], ["3", "lpF4"]].map(([n, k]) => (
          <div key={k} data-reveal><b>{n}</b><span>{t(k)}</span></div>
        ))}
      </section>

      {/* ---------- made in Tajikistan + honesty ---------- */}
      <section className="lp-sec lp-made">
        <div data-reveal>
          <p className="lp-k">{t("lpMadeK")}</p>
          <h2>{t("lpMadeT")}</h2>
          <p className="lp-lead">{personal}</p>
        </div>
        <div className="lp-honest" data-reveal>
          <h3>{t("lpHonestT")}</h3>
          <p>{t("lpHonestS")}</p>
        </div>
      </section>

      <section className="lp-final" data-reveal>
        <h2>{t("lpFinalT")}</h2>
        <div className="lp-ctas">
          <button className="lp-btn" onClick={() => onOpen("water", "mode=story")}>{t("lpStart")} →</button>
          <button className="lp-btn ghost" onClick={onTour}>▶ {t("lpTour")}</button>
        </div>
      </section>

      <footer className="lp-footer">
        <p>{t("lpFoot")}</p>
      </footer>
    </div>
  );
}
