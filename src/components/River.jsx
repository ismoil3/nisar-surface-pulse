// "One river, one pulse": the Vakhsh from the Rogun lake down to the cotton fields as one long profile
// (distance along the river against height). The lakes and the fields are measured on the same NISAR passes,
// so one timeline moves all of them: water is stored high in summer and feeds power and fields below.
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDate } from "../lib/nisar.js";
import { loadRiver } from "../lib/river.js";
import { LANGS, getLang, rich, t, tr } from "../lib/i18n.jsx";
import "../river.css";
import { beat, levels, saveSound, strengths, unlockSound } from "../lib/pulse.js";

const W = 1200, H = 520, L = 58, R = 18, T = 64, B = 64;
const Z0 = 300, Z1 = 1260;
const num = (x, d = 1) => (x == null ? "–" : x.toFixed(d).replace(".", getLang() === "en" ? "." : ","));
const sgn = (x, d = 1) => (x > 0 ? "+" : x < 0 ? "−" : "") + num(Math.abs(x), d);

/** Value of a series at a fractional step (nulls are skipped: the nearest measured value is used). */
function at(steps, key, pos) {
  const get = (i) => { const v = steps[i]?.[key]; return v == null ? null : v; };
  const i = Math.floor(pos), f = pos - i;
  const a = get(i), b = get(Math.min(steps.length - 1, i + 1));
  if (a != null && b != null) return a + (b - a) * f;
  return a ?? b;
}

/** Smoothly follows the chosen step (so the water and the plants move instead of jumping). */
function useTween(k) {
  const [pos, setPos] = useState(k);
  const cur = useRef(k);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { cur.current = k; setPos(k); return; }
    let raf, t0;
    const from = cur.current;
    const step = (ts) => {
      t0 ??= ts;
      const u = Math.min(1, (ts - t0) / 700), e = 1 - Math.pow(1 - u, 3);
      cur.current = from + (k - from) * e;
      setPos(cur.current);
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [k]);
  return pos;
}

function Spark({ values, k, color, onPick }) {
  const v = values.map((x, i) => [i, x]).filter(([, x]) => x != null);
  if (v.length < 2) return null;
  const lo = Math.min(...v.map((p) => p[1])), hi = Math.max(...v.map((p) => p[1]));
  const X = (i) => 4 + (i / (values.length - 1)) * 192, Y = (x) => 50 - ((x - lo) / (hi - lo || 1)) * 42;
  const cur = values[k] != null ? [X(k), Y(values[k])] : null;
  return (
    <svg viewBox="0 0 200 56" className="rv-spark" role="img" aria-hidden="true" onClick={(e) => {
      const r = e.currentTarget.getBoundingClientRect();
      onPick(Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)));
    }}>
      <polyline points={v.map(([i, x]) => `${X(i)},${Y(x)}`).join(" ")} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {v.map(([i, x]) => <circle key={i} cx={X(i)} cy={Y(x)} r="2" fill={color} opacity=".55" />)}
      {cur && <><line x1={cur[0]} x2={cur[0]} y1="2" y2="54" stroke="#ffffff40" strokeDasharray="2 3" /><circle cx={cur[0]} cy={cur[1]} r="5" fill={color} stroke="#04060b" strokeWidth="2" /></>}
    </svg>
  );
}

export default function River({ sites, lang, chooseLang, onHome, onOpen, onReport }) {
  const [D, setD] = useState(null);
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);
  const [hover, setHover] = useState(null);
  const svg = useRef(null);
  useEffect(() => { if (sites && !D) loadRiver(sites).then((d) => { setD(d); if (d) setK(d.steps.length - 1); }).catch(() => setD(false)); }, [sites, D]);
  const pos = useTween(k);
  const n = D ? D.steps.length : 0;

  // sound: one heartbeat per pass; loudness = how much the lakes changed, tone = how full Nurek is
  const snd = useMemo(() => {
    if (!D) return null;
    const total = D.steps.map((s) => (s.nurek != null && s.rogun != null ? s.nurek + s.rogun : s.nurek));
    return { str: strengths(total), lvl: levels(D.steps.map((s) => s.nurek)) };
  }, [D]);
  const go = (i, quiet) => { setK(i); if (sound && !quiet && snd) beat(snd.str[i], snd.lvl[i]); };
  useEffect(() => {
    if (!playing || !D) return;
    const h = setInterval(() => setK((x) => {
      const nx = (x + 1) % n;
      if (sound && snd) beat(snd.str[nx], snd.lvl[nx]);
      return nx;
    }), 1300);
    return () => clearInterval(h);
  }, [playing, D, n, sound, snd]);
  useEffect(() => {
    const onKey = (e) => {
      if (!D || e.target.matches("input, select, textarea, button")) return;
      if (e.key === "ArrowRight") { setPlaying(false); go(Math.min(n - 1, k + 1)); }
      if (e.key === "ArrowLeft") { setPlaying(false); go(Math.max(0, k - 1)); }
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const toggleSound = () => {
    const on = !sound;
    if (on && !unlockSound()) return;
    setSound(on); saveSound(on);
    if (on && snd) setTimeout(() => beat(snd.str[k], snd.lvl[k]), 30);
  };

  const geo = useMemo(() => {
    if (!D) return null;
    const P = D.profile, len = P.length_km;
    const X = (km) => L + (km / len) * (W - L - R), Y = (z) => T + ((Z1 - z) / (Z1 - Z0)) * (H - T - B);
    const mark = (id) => P.marks.find((m) => m.id === id);
    const nk = P.nurek_dem, nd = mark("nurek"), rd = mark("rogun");
    const below = P.pts.find((p) => p[0] > nd.km + 1.5)[1];
    // the DEM shows Nurek as a flat lake: its bottom is unknown, so a simple sloping bed is drawn there (dashed)
    const bed = P.pts.map(([km, z]) => (km >= nk.from_km && km <= nk.to_km ? [km, nk.level_m - (nk.level_m - below - 30) * Math.pow((km - nk.from_km) / (nk.to_km - nk.from_km), 1.25)] : [km, z]));
    const line = bed.map(([km, z]) => `${X(km).toFixed(1)},${Y(z).toFixed(1)}`).join(" ");
    const f = P.frames.vakhsh;
    const plants = [];
    for (let km = f[0] + 4; km < f[1] - 1; km += 2.6) {
      const z = P.pts.reduce((a, p) => (Math.abs(p[0] - km) < Math.abs(a[0] - km) ? p : a))[1];
      plants.push([X(km), Y(z)]);
    }
    return { P, len, X, Y, mark, nk, nd, rd, bed, line, plants, below };
  }, [D]);

  if (D === false) return <div className="lp rv"><p className="rv-wait">{t("errNoSite")}</p></div>;
  if (!D || !geo) return <div className="lp rv"><p className="rv-wait">{t("gettingReady")}</p></div>;

  const { P, len, X, Y, mark, nk, nd, rd, bed, line, plants } = geo;
  const S = D.steps, s = S[k], s0 = S[0];
  const level = at(S, "level", pos), level0 = s0.level;
  const nurek = at(S, "nurek", pos), hv = at(S, "hv", pos);
  const hvs = S.map((x) => x.hv).filter((x) => x != null), hvLo = Math.min(...hvs), hvHi = Math.max(...hvs);
  const grow = (hv - hvLo) / (hvHi - hvLo || 1);
  const nks = S.map((x) => x.nurek), nkLo = Math.min(...nks), nkHi = Math.max(...nks);
  const pamT = at(S.map((x) => ({ v: x.pamir?.t ?? null })), "v", pos);
  const melt = pamT != null && pamT > 0;

  // Rogun water: from the dam upstream to where the old river bed rises above the level
  const up = P.pts.filter(([km, z]) => km <= rd.km && z < level);
  const head = up.length ? up[0][0] : rd.km;
  const wedge = (lv, pts, x = X, y = Y) => pts.length ? `M${x(pts[0][0])},${y(lv)} L${x(rd.km)},${y(lv)} ` + [...pts].reverse().map(([km, z]) => `L${x(km)},${y(z)}`).join(" ") + " Z" : "";
  // inset: Rogun enlarged
  const IX = (km) => 835 + ((km - 10) / (rd.km + 2 - 10)) * 330, IY = (z) => 66 + ((1230 - z) / (1230 - 985)) * 150;
  const insetBed = P.pts.filter(([km]) => km >= 10 && km <= rd.km + 2);
  const rough = !!s.nurekFlag;
  const lastOk = [...S].reverse().find((x) => x.nurek != null && !x.nurekFlag), flagged = S.find((x) => x.nurekFlag);
  // a level from the second orbit is compared with that orbit's own first level
  const base = s.other && D.o2 ? D.o2.l0 : level0, l12 = S.filter((x) => x.level != null && !x.other);
  const fieldKm = P.frames.vakhsh[1] - 12, fieldZ = P.pts.reduce((a, p) => (Math.abs(p[0] - fieldKm) < Math.abs(a[0] - fieldKm) ? p : a))[1];
  const dams = P.marks.filter((m) => m.kind === "dam" && !["rogun", "nurek"].includes(m.id));

  const onMove = (e) => {
    const r = svg.current.getBoundingClientRect();
    const km = ((e.clientX - r.left) / r.width * W - L) / (W - L - R) * len;
    if (km < 0 || km > len) return setHover(null);
    const p = bed.reduce((a, q) => (Math.abs(q[0] - km) < Math.abs(a[0] - km) ? q : a));
    const inNurek = km >= nk.from_km && km <= nk.to_km;
    setHover({ km: p[0], z: inNurek ? nk.level_m : p[1], lake: inNurek });
  };

  const first = S.findIndex((x) => x.nurek != null);
  const peak = nks.indexOf(nkHi);
  const summer = D.clim ? { pam: S.filter((x) => x.pamir).reduce((a, x) => Math.max(a, x.pamir.t), -99) } : null;
  const dry = D.valleyDry;

  return (
    <div className="lp rv">
      <nav className="lp-nav">
        <button className="lp-logo rv-home" onClick={onHome} title={t("lpHome")}><i className="pulse" aria-hidden="true" /><span>Surface Pulse</span></button>
        <div className="lp-nav-r">
          <div className="lp-langs" role="group" aria-label={t("language")}>
            {LANGS.map((l) => <button key={l.id} className={lang === l.id ? "on" : ""} onClick={() => chooseLang(l.id)} lang={l.id}>{l.label}</button>)}
          </div>
          <button className="lp-btn sm" onClick={() => onOpen("water", "mode=story")}>{t("lpOpenMap")}</button>
        </div>
      </nav>

      <header className="rv-head">
        <p className="lp-k">{t("rvK")}</p>
        <h1>{t("rvT")}</h1>
        <p className="lp-lead">{rich(t("rvLead", { km: Math.round(len), a: P.pts[0][1], b: P.pts.at(-1)[1] }))}</p>
      </header>

      <section className="rv-stage">
        <div className="rv-scroll">
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="rv-svg" role="img" aria-label={t("rvAria")} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            <defs>
              <linearGradient id="rv-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0c1730" /><stop offset="1" stopColor="#04060b" /></linearGradient>
              <linearGradient id="rv-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3ce1ff" stopOpacity=".95" /><stop offset="1" stopColor="#1668c9" stopOpacity=".75" /></linearGradient>
              <linearGradient id="rv-land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24304f" /><stop offset="1" stopColor="#0a0f1c" /></linearGradient>
            </defs>
            <rect x="0" y="0" width={W} height={H} fill="url(#rv-sky)" rx="22" />
            {/* height grid */}
            {[400, 600, 800, 1000, 1200].map((z) => (
              <g key={z}><line x1={L} x2={W - R} y1={Y(z)} y2={Y(z)} className="rv-grid" /><text x={L - 8} y={Y(z) + 4} className="rv-ax" textAnchor="end">{z}</text></g>
            ))}
            <text x="10" y={T - 14} className="rv-ax">{t("rvM")}</text>
            {/* which stretch each NISAR picture covers */}
            {[["vakhsh_cascade", "rvFrameLakes", "#3ce1ff"], ["vakhsh", "rvFrameFields", "#c6ff3d"]].map(([id, key, c]) => (
              <g key={id}>
                <rect x={X(P.frames[id][0])} width={X(P.frames[id][1]) - X(P.frames[id][0])} y={H - B + 26} height="5" rx="2.5" fill={c} opacity=".8" />
                <text x={(X(P.frames[id][0]) + X(P.frames[id][1])) / 2} y={H - B + 48} className="rv-frame" textAnchor="middle" fill={c}>{t(key)}</text>
              </g>
            ))}
            {[0, 50, 100, 150, 200, 250].map((km) => <text key={km} x={X(km)} y={H - B + 18} className="rv-ax" textAnchor="middle">{km} {t("rvKm")}</text>)}

            {/* water */}
            <path d={`M${X(nk.from_km)},${Y(nk.level_m)} L${X(nk.to_km)},${Y(nk.level_m)} ` + bed.filter(([km]) => km >= nk.from_km && km <= nk.to_km).reverse().map(([km, z]) => `L${X(km)},${Y(z)}`).join(" ") + " Z"} fill="url(#rv-water)" />
            <path d={wedge(level, up)} fill="url(#rv-water)" />
            {/* land */}
            <polygon points={`${L},${H - B + 4} ${line} ${W - R},${H - B + 4}`} fill="url(#rv-land)" />
            <polyline points={line} className="rv-bed" />
            <polyline points={bed.filter(([km]) => km >= nk.from_km && km <= nk.to_km).map(([km, z]) => `${X(km)},${Y(z)}`).join(" ")} className="rv-bed guess" />
            <polyline points={line} className={`rv-flow${melt ? " on" : ""}`} style={{ animationDuration: `${melt ? Math.max(1.2, 6 - pamT * 0.35) : 0}s` }} />
            {/* level of the first pass, to see the rise */}
            {level0 != null && <line x1={X(head) - 6} x2={X(rd.km)} y1={Y(level0)} y2={Y(level0)} className="rv-ghost" />}

            {/* dams */}
            <g className="rv-dam big">
              <polygon points={`${X(rd.km) - 3},${Y(level + 18)} ${X(rd.km) + 3},${Y(level + 18)} ${X(rd.km) + 13},${Y(rd.z - 30)} ${X(rd.km) - 5},${Y(rd.z - 4)}`} />
              <polygon points={`${X(nd.km) - 3},${Y(nk.level_m + 14)} ${X(nd.km) + 3},${Y(nk.level_m + 14)} ${X(nd.km) + 12},${Y(geo.below)} ${X(nd.km) - 4},${Y(geo.below + 30)}`} />
            </g>
            {dams.map((m, i) => (
              <g key={m.id} className="rv-dam">
                <line x1={X(m.km)} x2={X(m.km)} y1={Y(m.z) + 2} y2={Y(m.z) - 26 - (i % 2) * 18} />
                <rect x={X(m.km) - 2.5} y={Y(m.z) - 9} width="5" height="11" rx="1" />
                <text x={X(m.km)} y={Y(m.z) - 31 - (i % 2) * 18} textAnchor="middle">{t(`rvDam_${m.id}`)}</text>
              </g>
            ))}

            {/* cotton fields: the plants grow with the HV echo */}
            <g className="rv-plants">
              {plants.map(([x, y], i) => {
                const h = 7 + grow * 17 * (0.8 + 0.2 * Math.sin(i * 1.7));
                return <path key={i} d={`M${x},${y} v${-h} M${x},${y - h * 0.45} l-4,-3.5 M${x},${y - h * 0.7} l4,-3.5`} />;
              })}
            </g>

            {/* labels */}
            <g className="rv-lab">
              <text x={X((head + rd.km) / 2)} y={Y(level) - 34} textAnchor="middle" className="t go" onClick={() => onOpen("water", "mode=story&f=rogun")}>{t("res_rogun")} ↗</text>
              <text x={X((head + rd.km) / 2)} y={Y(level) - 16} textAnchor="middle" className="v">{Math.round(level).toLocaleString("ru-RU")} {t("rvMUnit")}</text>
              <text x={X((nk.from_km + nk.to_km) / 2)} y={Y(nk.level_m) - 46} textAnchor="middle" className="t go" onClick={() => onOpen("water", "mode=story&f=nurek")}>{t("res_nurek")} ↗</text>
              <text x={X((nk.from_km + nk.to_km) / 2)} y={Y(nk.level_m) - 28} textAnchor="middle" className="v">{num(nurek)} {t("uKm2")}</text>
              <text x={X(fieldKm)} y={Y(fieldZ) - 58} textAnchor="middle" className="t g go" onClick={() => onOpen("crops", "mode=story")}>{t("rvFields")} ↗</text>
              <text x={X(fieldKm)} y={Y(fieldZ) - 40} textAnchor="middle" className="v g">HV {num(hv, 2)} {t("uDb")}</text>
              {rough && <text x={X(nd.km) + 18} y={Y(760)} className="note">≈ {t("rvRough")}</text>}
            </g>
            {/* Nurek fullness meter (area, because its level cannot be read from the elevation map) */}
            <g transform={`translate(${X((nk.from_km + nk.to_km) / 2) - 45}, ${Y(nk.level_m) - 18})`} className="rv-meter" aria-hidden="true">
              <rect x="0" y="0" width="90" height="6" rx="3" />
              <rect x="0" y="0" width={Math.max(6, 90 * ((nurek - nkLo) / (nkHi - nkLo || 1)))} height="6" rx="3" className="f" />
            </g>

            {/* weather chips (NASA POWER) */}
            {pamT != null && (
              <g className="rv-chip" transform={`translate(${L + 10}, 20)`}>
                <rect width="360" height="30" rx="15" />
                <text x="14" y="20">{melt ? "☀️" : "❄️"} {t("rvPamir")}: <tspan className="b">{sgn(pamT)} °C</tspan> · {t(melt ? "rvMelt" : "rvFrozen")}</text>
              </g>
            )}

            {/* inset: Rogun enlarged */}
            <g className="rv-inset">
              <rect x="835" y="66" width="330" height="150" rx="12" />
              <clipPath id="rv-clip"><rect x="835" y="66" width="330" height="150" rx="12" /></clipPath>
              <g clipPath="url(#rv-clip)">
                <path d={wedge(level, insetBed.filter(([km, z]) => km <= rd.km && z < level), IX, IY)} fill="url(#rv-water)" />
                <polygon points={`835,216 ${insetBed.map(([km, z]) => `${IX(km)},${IY(z)}`).join(" ")} 1165,216`} fill="url(#rv-land)" />
                <polyline points={insetBed.map(([km, z]) => `${IX(km)},${IY(z)}`).join(" ")} className="rv-bed" />
                {level0 != null && <line x1="835" x2={IX(rd.km)} y1={IY(level0)} y2={IY(level0)} className="rv-ghost" />}
                <polygon points={`${IX(rd.km) - 4},${IY(level + 14)} ${IX(rd.km) + 4},${IY(level + 14)} ${IX(rd.km) + 22},216 ${IX(rd.km) - 12},216`} className="idam" />
              </g>
              <text x="849" y="88" className="it">🔍 {t("rvInset")}</text>
              <text x="849" y="108" className="iv">{Math.round(level).toLocaleString("ru-RU")} {t("rvMUnit")} <tspan className="d">{base != null ? `${sgn(level - base, 0)} ${t("rvMUnit")}` : ""}</tspan></text>
              {level0 != null && <text x="849" y={IY(level0) + 14} className="ig">{t("rvStart", { d: fmtDate(s0.date, true) })}</text>}
            </g>

            {hover && (
              <g className="rv-hover" pointerEvents="none">
                <line x1={X(hover.km)} x2={X(hover.km)} y1={T - 6} y2={H - B + 4} />
                <circle cx={X(hover.km)} cy={Y(hover.z)} r="4.5" />
                <text x={Math.min(W - 150, X(hover.km) + 10)} y={Math.max(T + 8, Y(hover.z) - 12)}>{Math.round(hover.km)} {t("rvKm")} · {Math.round(hover.z)} {t("rvMUnit")}{hover.lake ? ` · ${t("rvLake")}` : ""}</text>
              </g>
            )}
          </svg>
        </div>

        {/* timeline: one beat per satellite pass */}
        <div className="rv-time" role="group" aria-label={t("date")}>
          <button className={`dock-play${playing ? " on" : ""}`} onClick={() => setPlaying((p) => !p)} aria-label={t(playing ? "pause" : "play")}>{playing ? "❚❚" : "▶"}</button>
          <div className="rv-time-main">
            <div className="dock-date"><b>{fmtDate(s.date)}</b>{s.validated && <span className="rv-val">◆ {t("valTag")}</span>}{s.other && <span>{t("rvOther", { d: fmtDate(s.other, true) })}</span>}</div>
            <div className="dock-ticks">
              {S.map((x, i) => {
                const [day, mon] = fmtDate(x.date, true).split(" ");
                return (
                  <button key={x.date} className={`${i === k ? "on" : i < k ? "past" : ""}${x.validated ? " val" : ""}`} onClick={() => { setPlaying(false); go(i); }} aria-current={i === k} title={fmtDate(x.date)}>
                    <i /><small>{x.validated && <b className="vdot" aria-hidden="true">◆</b>}{day} {mon}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <button className={`rv-sound${sound ? " on" : ""}`} onClick={toggleSound} aria-pressed={sound} title={t("sndHint")}>{sound ? "🔊" : "🔇"}<span>{t(sound ? "sndOn" : "sndOff")}</span></button>
        </div>
        <p className="rv-note">{t("rvNote", { lvl: nk.level_m })}</p>
      </section>

      {/* the three steps of the staircase, as numbers */}
      <section className="rv-cards">
        <article className="rv-card c1">
          <span className="lp-chip">① {t("rvStep1")}</span>
          <h3>{t("res_rogun")}</h3>
          <p className="rv-big">{s.level != null ? Math.round(s.level).toLocaleString("ru-RU") : "–"}<small>{t("rvMUnit")}</small></p>
          <p className="rv-sub">{s.level != null && level0 != null ? tr("rvC1", { d: sgn(s.level - base, 0), a: num(s.rogun), d0: fmtDate(s.other && D.o2 ? D.o2.d0 : s0.date, true) }) : t("rvNoData")}</p>
          <Spark values={S.map((x) => x.level)} k={k} color="#3ce1ff" onPick={(i) => { setPlaying(false); go(i); }} />
          <button className="rv-link" onClick={() => onOpen("water", "mode=story&f=rogun")}>{t("rvSeeMap")} →</button>
        </article>
        <article className="rv-card c2">
          <span className="lp-chip">② {t("rvStep2")}</span>
          <h3>{t("res_nurek")}</h3>
          <p className="rv-big">{num(s.nurek)}<small>{t("uKm2")}</small></p>
          <p className="rv-sub">{tr("rvC2", { d: sgn(s.nurek - S[first].nurek), pk: num(nkHi), dpk: fmtDate(S[peak].date, true), d0: fmtDate(S[first].date, true) })}{rough && <> {t("rvRough")}.</>}</p>
          <Spark values={nks} k={k} color="#7aa7ff" onPick={(i) => { setPlaying(false); go(i); }} />
          <button className="rv-link" onClick={() => onOpen("water", "mode=story&f=nurek")}>{t("rvSeeMap")} →</button>
        </article>
        <article className="rv-card c3">
          <span className="lp-chip">③ {t("rvStep3")}</span>
          <h3>{t("rvFields")}</h3>
          <p className="rv-big">{num(s.hv, 2)}<small>{t("uDb")} HV</small></p>
          <p className="rv-sub">{tr("rvC3", { d: sgn(s.hv - s0.hv, 2), km: Math.round(D.farm_km2), d0: fmtDate(s0.date, true) })}</p>
          <Spark values={S.map((x) => x.hv)} k={k} color="#c6ff3d" onPick={(i) => { setPlaying(false); go(i); }} />
          <button className="rv-link" onClick={() => onOpen("crops", "mode=story")}>{t("rvSeeMap")} →</button>
        </article>
        <article className="rv-card c4">
          <span className="lp-chip">☀️ {t("rvWeather")}</span>
          <h3>{t("rvWhyT")}</h3>
          <dl className="rv-wx">
            <div><dt>{t("rvPamir")}</dt><dd>{s.pamir ? `${sgn(s.pamir.t)} °C` : "–"}</dd></div>
            <div><dt>{t("rvValleyT")}</dt><dd>{s.valley ? `${sgn(s.valley.t)} °C` : "–"}</dd></div>
            <div><dt>{t("rvValleyP")}</dt><dd>{s.valley ? `${num(s.valley.p, 0)} ${t("uMm")}` : "–"}</dd></div>
          </dl>
          <p className="rv-sub">{t("rvWx12")}</p>
          <Spark values={S.map((x) => x.pamir?.t ?? null)} k={k} color="#ff8a3d" onPick={(i) => { setPlaying(false); go(i); }} />
        </article>
      </section>

      {/* what the staircase says */}
      <section className="lp-sec rv-say">
        <p className="lp-k">{t("rvSayK")}</p>
        <h2>{t("rvSayT")}</h2>
        <ol className="rv-list">
          <li><b>{t("rvS1h")}</b><span>{tr("rvS1", { t: summer ? sgn(summer.pam) : "–", a: num(S[first].nurek), b: num(nkHi), l0: level0, l1: l12.at(-1)?.level, m0: D.o2?.l0 ?? "–", m1: D.o2?.l1 ?? "–", dm: D.o2 ? fmtDate(D.o2.d1, true) : "–" })}</span></li>
          <li><b>{t("rvS2h")}</b><span>{tr("rvS2", { pk: num(nkHi), dpk: fmtDate(S[peak].date, true), b: num(lastOk.nurek), d1: fmtDate(lastOk.date, true), t: S.at(-1).pamir ? sgn(S.at(-1).pamir.t) : "–" })}{flagged && <> {tr("rvS2flag", { d: fmtDate(flagged.date, true), v: num(flagged.nurek), adj: num(flagged.nurekAdj) })}</>}</span></li>
          <li><b>{t("rvS3h")}</b><span>{tr("rvS3", { km: Math.round(D.farm_km2), d: sgn(hvHi - s0.hv, 1), p: dry ? num(dry.p, 0) : "–", tt: dry ? num(dry.t, 0) : "–" })}</span></li>
        </ol>
        <div className="lp-honest rv-honest">
          <h3>{t("lpHonestT")}</h3>
          <p>{t("rvHonest", { lvl: nk.level_m })}</p>
        </div>
        <div className="lp-ctas rv-ctas">
          <button className="lp-btn" onClick={() => onOpen("water", "mode=story")}>{t("lpOpenMap")} →</button>
          <button className="lp-btn ghost" onClick={() => onReport("water")}>📄 {t("repBtn")}</button>
        </div>
        <p className="rv-src">{t("rvSrc")}</p>
      </section>
    </div>
  );
}
