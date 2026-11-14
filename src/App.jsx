import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { WATER_A_COLOR, WATER_COLOR } from "./components/MapView.jsx";
import Controls from "./components/Controls.jsx";
import AreaCard from "./components/AreaCard.jsx";
import PointCard from "./components/PointCard.jsx";
import { AboutDialog } from "./components/Dialogs.jsx";
import PolCard from "./components/PolCard.jsx";
import StoryCard from "./components/StoryCard.jsx";
import EventCard, { CloseupCard, EventPolCard, ZoneCard, cornerBounds } from "./components/EventCard.jsx";
import FarmCard, { FarmChart, FarmPol } from "./components/FarmCard.jsx";
import MotionCard, { MotionChart } from "./components/MotionCard.jsx";
import Orbit2Card from "./components/Orbit2Card.jsx";
import Actions from "./components/Actions.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Landing from "./components/Landing.jsx";
import "./landing.css";
import "./river.css";
import { Link, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { STORY_ROUTES, routeOf, slugFor } from "./lib/routes.js";
import River from "./components/River.jsx";
import Report from "./components/Report.jsx";
import ClimateCard from "./components/ClimateCard.jsx";
import { beat, levels, saveSound, unlockSound } from "./lib/pulse.js";
import { ActTab, AnswerPanel, Dock, Guide, ViewBar, WhyTab } from "./components/Stage.jsx";
import { LayerHelp } from "./components/Controls.jsx";
import { storyFor } from "./lib/stories.js";
import { LANGS, fmtInt, initialLang, placeName, rich, saveLang, setLang, t, tr } from "./lib/i18n.jsx";
import { placeList } from "./components/StoryCard.jsx";
import { areaStats, changeProduct, fmtDate, loadDataset, lonLatToPixel, probeSites, opticalTiles, placesNearWater, polCompare, radarUrl, signed, siteBounds, waterDiff, PITCH_KM2 } from "./lib/nisar.js";

const DEFAULTS = {
  mode: "story", pol: "hh", cpol: "hh", k: 0, kA: 0, kB: 0, thr: 3,
  opacity: 0.92, showWater: true, showLabels: true, showContext: true, terrain: false, expert: false, xray: false,
  // 10 m close-up of an event site: on/off, which picture, which colour layers
  cu: false, cuView: "swipe", cuFlood: true, cuHidden: true, cuSeason: false,
  clearRef: false, // photo layer: show the clearest photo of the season (clearly labelled) instead of a cloudy one
};
const POL_LABEL = { hh: "polHH", hv: "polHV", rgb: "polRGB", photo: "polPhoto", insar: "polInsar", motion: "polMotion" };

/** First-visit flag; storage can be unavailable (private window), so every access is guarded. */
const markWelcome = () => { try { localStorage.setItem("nsp_welcome", "1"); } catch { /* ignore */ } };

/** A photo exists for date k and is mostly free of cloud. */
const clearPhoto = (ds, k) => !!ds.optical[k] && ds.optical[k].cloud_pct < 30;

/** View state from the route's query string, validated against the site's date count. */
function readParams(search, n, def) {
  const p = new URLSearchParams(search);
  const idx = (v, d) => (v != null && v !== "" && +v >= 0 && +v < n ? +v : d);
  const out = { k: idx(p.get("d"), def.k), kA: idx(p.get("a"), def.kA), kB: idx(p.get("b"), def.kB) };
  if (["story", "single", "swipe", "change"].includes(p.get("mode"))) out.mode = p.get("mode");
  if (["hh", "hv", "rgb", "photo", "insar", "motion"].includes(p.get("pol"))) out.pol = p.get("pol");
  if (["hh", "hv"].includes(p.get("cpol"))) out.cpol = p.get("cpol");
  const thr = +p.get("thr");
  if (thr >= 1 && thr <= 8) out.thr = thr;
  if (p.get("3d") === "1") out.terrain = true;
  if (p.get("x") === "1") out.expert = true;
  if (p.get("xr") === "1") out.xray = true;
  if (p.get("cu") === "1") out.cu = true;
  if (["before", "after", "swipe"].includes(p.get("cv"))) out.cuView = p.get("cv");
  return out;
}

export default function App() {
  const [lang, setLangState] = useState(initialLang);
  setLang(lang);
  const chooseLang = (l) => { setLang(l); saveLang(l); setLangState(l); };
  const [sites, setSites] = useState(null);
  const [siteId, setSiteId] = useState(null);
  const [ds, setDs] = useState(null);
  const [progress, setProgress] = useState(null); // [done, total]
  const [error, setError] = useState(null);
  const [s, setS] = useState(DEFAULTS);
  // loaded sites stay in memory, so switching back to a site is instant (pictures, filters and masks included)
  const siteCache = useRef(new Map());
  const [playing, setPlaying] = useState(false);
  const [point, setPoint] = useState(null);
  const [outside, setOutside] = useState(false);
  const [dialog, setDialog] = useState(null); // "story" | "about" | null
  const [view, setView] = useState(null);     // camera request for the map
  const [guideIdx, setGuideIdx] = useState(-1); // step of the guide in the right panel, -1 = closed
  const [tab, setTab] = useState("what");          // tab of the answer panel
  const [which, setWhich] = useState("b");         // which date a click on the timeline moves (two-date views)
  const [sheet, setSheet] = useState(false);       // phone: answer panel pulled up
  // routes: "/" = landing page, "/map/<story>?<view>" = the map
  const location = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();
  const slug = location.pathname.startsWith("/map/") ? location.pathname.slice(5) : null;
  const route = routeOf(slug);
  const screen = route ? "app" : location.pathname === "/river" ? "river" : location.pathname.startsWith("/report/") ? "report" : "landing";
  const [nav, setNav] = useState(0);      // bumps to re-apply the view from the URL for the same site
  const applying = useRef(false);         // true while a view from the URL is being applied (URL sync waits)
  const [applied, setApplied] = useState(0); // bumps when that is done, so the URL sync runs once more
  const pendingGuide = useRef(false);

  const set = useCallback((patch) => {
    if ("mode" in patch) setPlaying(false);
    setS((o) => ({ ...o, ...("mode" in patch && !("cu" in patch) ? { cu: false } : {}), ...(("mode" in patch || "pol" in patch) && !("clearRef" in patch) ? { clearRef: false } : {}), ...patch }));
  }, []);

  // discover sites
  useEffect(() => {
    probeSites()
      .then((found) => {
        if (!found.length) throw new Error(t("errNoSite"));
        setSites(found);
        const want = routeOf(location.pathname.slice(5))?.site;
        setSiteId((found.find((x) => x.id === want) || found[0]).id);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // the route decides the site (story chips, back / forward, shared links)
  useEffect(() => {
    if (sites && route && route.site !== siteId && sites.some((x) => x.id === route.site)) setSiteId(route.site);
  }, [sites, route, siteId]);
  // back / forward inside the same site: re-apply the view written in the URL
  const lastKey = useRef(location.key);
  useEffect(() => {
    if (location.key === lastKey.current) return;
    lastKey.current = location.key;
    if (navType === "POP" && route) { applying.current = true; setNav((x) => x + 1); }
  }, [location.key, navType, route]);

  // load the selected site
  useEffect(() => {
    if (!sites || !siteId) return;
    let cancelled = false;
    const site = sites.find((x) => x.id === siteId);
    applying.current = true;
    setPlaying(false);
    setPoint(null);
    setGuideIdx(-1);
    setView(null);
    const cached = siteCache.current.get(siteId);
    if (!cached) setProgress([0, site.m.dates.length * 2]);
    (cached ? Promise.resolve(cached) : loadDataset(site, (d, t) => !cancelled && setProgress([d, t])))
      .then((loaded) => {
        siteCache.current.set(siteId, loaded);
        if (cancelled) return;
        const n = loaded.m.dates.length;
        const r = routeOf(window.location.hash.replace(/^#\/map\//, "").split("?")[0]);
        const query = window.location.hash.split("?")[1] ?? "";
        // "From" defaults to the first date that has a lake outline (early frames can miss the lake)
        // event sites (flood) start on the last pass before and the first pass after the event
        const ev = loaded.event;
        const def = ev ? { k: ev.kAfter, kA: ev.kBefore, kB: ev.kAfter }
          : loaded.farm ? { k: loaded.farm.peak, kA: 0, kB: loaded.farm.peak, pol: "rgb" } : { k: n - 1, kA: areaStats(loaded.m)?.ia ?? 0, kB: areaStats(loaded.m)?.ib ?? n - 1 };
        const fromUrl = r?.site === siteId ? readParams(query, n, def) : { ...def };
        const view = { ...(def.pol ? { pol: def.pol } : {}), mode: "story", xray: false, ...(r?.site === siteId ? r.preset ?? {} : {}), ...fromUrl };
        // the interferogram picture exists only for some sites
        setS((o) => {
          const n2 = { ...o, cu: false, clearRef: false, ...view };
          if (n2.cu && !loaded.event?.closeup) n2.cu = false;
          return (n2.pol === "insar" && !loaded.insar) || (n2.pol === "motion" && !loaded.motion) ? { ...n2, pol: "hh" } : n2;
        });
        setDs(loaded);
        setProgress(null);
        setTab("what");
        applying.current = false;
        setApplied((x) => x + 1);
      })
      .catch((e) => !cancelled && setError(t("errLoad", { msg: e.message })));
    return () => { cancelled = true; };
  }, [sites, siteId, nav]);

  const n = ds?.m.dates.length ?? 0;
  const kMain = s.mode === "single" ? s.k : s.kB;
  // "camera vs radar": the swipe compares a photo and the radar picture of the same pass
  const xr = s.mode === "swipe" && s.xray;
  const polMain = s.mode === "change" ? s.cpol : xr && s.pol === "photo" ? "rgb" : s.pol;
  // the 10 m close-up replaces the site's own pictures while it is open
  const cu = s.cu && ds?.event?.closeup ? ds.event.closeup : null;
  // InSAR ground motion: its own (smaller, 80 m) footprint, one picture for the whole stack
  const mo = !cu && s.mode === "single" && s.pol === "motion" && ds?.motion ? ds.motion : null;

  // derived map products
  const mainUrl = useMemo(() => ds && (cu ? cu.url[s.cuView === "before" ? "before" : "after"] : radarUrl(ds, kMain, polMain)), [ds, cu, s.cuView, kMain, polMain]);
  const cuExtras = useMemo(() => cu && [
    s.cuHidden ? { url: cu.url.hidden, corners: cu.corners } : null,
    s.cuSeason ? { url: cu.url.seasonal, corners: cu.corners } : null,
  ], [cu, s.cuHidden, s.cuSeason]);
  const change = useMemo(
    () => (ds && s.mode === "change" ? changeProduct(ds, s.kA, s.kB, s.cpol, s.thr) : null),
    [ds, s.mode, s.kA, s.kB, s.cpol, s.thr]
  );
  const swipe = useMemo(
    () => (cu ? (s.cuView === "swipe" ? { url: cu.url.before, corners: cu.corners, water: null, opticalTiles: null } : null) : ds && xr ? {
      url: null, water: null, opticalTiles: ds.optical[s.kB] ? opticalTiles(ds.optical[s.kB]) : null,
    } : ds && s.mode === "swipe" ? {
      url: radarUrl(ds, s.kA, s.pol), water: s.showWater ? ds.water[s.kA] : null,
      opticalTiles: s.pol === "photo" && ds.optical[s.kA] ? opticalTiles(ds.optical[s.kA]) : null,
    } : null),
    [ds, cu, s.cuView, xr, s.mode, s.kA, s.kB, s.pol, s.showWater]
  );
  // the clearest photo of the whole series (for cloudy places, as a labelled reference)
  const clearIdx = useMemo(() => {
    if (!ds) return null;
    let best = null;
    ds.optical.forEach((o, i) => { if (o && (best == null || o.cloud_pct < ds.optical[best].cloud_pct)) best = i; });
    return best;
  }, [ds]);
  const refOn = s.clearRef && clearIdx != null && s.mode === "single";
  const optK = refOn ? clearIdx : kMain;
  const optMain = ds && !cu && s.mode !== "change" && !xr && s.pol === "photo" ? ds.optical[optK] : null;
  // the cloudiest photo currently on screen (to warn the visitor and offer the radar)
  const cloudy = !ds || cu || s.mode === "change" || s.mode === "story" || xr || s.pol !== "photo" ? 0
    : Math.max(ds.optical[optK]?.cloud_pct ?? 0, s.mode === "swipe" ? ds.optical[s.kA]?.cloud_pct ?? 0 : 0);
  // cloud cover of the photo on each pass, and how many were cloudy (≥30%)
  const clouds = useMemo(() => ds && ds.optical.map((o) => o?.cloud_pct ?? null), [ds]);
  const nCloudy = clouds ? clouds.filter((c) => c != null && c >= 30).length : 0;
  const opticalStack = useMemo(() => ds && ds.optical.map((o) => (o ? opticalTiles(o) : null)), [ds]);
  const frameReadyRef = useRef(null);
  const stats = useMemo(() => ds && areaStats(ds.m), [ds]);
  const story = useMemo(() => storyFor(ds?.id, lang), [ds, lang]);
  const siteName = story.name || ds?.m.name;
  const wd = useMemo(() => (ds && s.mode === "story" ? waterDiff(ds, s.kA, s.kB) : null), [ds, s.mode, s.kA, s.kB]);
  const wdFull = useMemo(() => ds && stats && waterDiff(ds, stats.ia, stats.ib), [ds, stats]);

  // pre-render the current layer for every date in idle time, so the first step to any date is instant
  useEffect(() => {
    if (!ds || cu || !["hh", "hv"].includes(polMain)) return;
    const idle = window.requestIdleCallback ?? ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 50));
    const cancelIdle = window.cancelIdleCallback ?? clearTimeout;
    let i = 0, h;
    const work = (dl) => {
      while (i < ds.m.dates.length && dl.timeRemaining() > 4) radarUrl(ds, i++, polMain);
      if (i < ds.m.dates.length) h = idle(work);
    };
    h = idle(work);
    return () => cancelIdle(h);
  }, [ds, cu, polMain]);

  // animation
  useEffect(() => {
    if (!playing || !ds) return;
    ds.m.dates.forEach((_, i) => radarUrl(ds, i, s.pol)); // pre-render frames for smooth playback
    // with real photos, wait (up to ~5 s) until the next date's photo is fully loaded before showing it
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      if (now - last < 900) return; // each date stays on screen at least 0.9 s
      setS((o) => {
        const next = (o.k + 1) % n;
        const ready = o.pol !== "photo" || !frameReadyRef.current || frameReadyRef.current(next);
        if (!ready && now - last < 6000) return o;
        last = now;
        return { ...o, k: next };
      });
    }, 150);
    return () => clearInterval(t);
  }, [playing, ds, n, s.pol]);
  // "hear the pulse": one heartbeat per pass while the film plays or a date is picked;
  // loudness = how much of the picture changed since the previous pass (mean |change| of the HH echo)
  const [sound, setSound] = useState(false);
  const beats = useMemo(() => {
    if (!ds) return null;
    const ch = ds.raw.hh.map((img, k) => {
      if (!k || !img || !ds.raw.hh[k - 1]) return null;
      const prev = ds.raw.hh[k - 1];
      let sum = 0, cnt = 0;
      for (let i = 0; i < img.length; i += 37) if (img[i] && prev[i]) { sum += Math.abs(img[i] - prev[i]); cnt++; }
      return cnt ? sum / cnt : null;
    });
    const hi = Math.max(...ch.filter((x) => x != null), 1e-9);
    // tone: the site's main number (lake area or the crops' HV echo), where there is one
    const main = ds.m.dates.map((d, i) => d.water_km2 ?? ds.farm?.series?.hv_median_db?.[i] ?? null);
    return { str: ch.map((x) => (x == null ? 0.3 : 0.15 + 0.85 * (x / hi))), lvl: main.some((x) => x != null) ? levels(main) : null };
  }, [ds]);
  const toggleSound = useCallback(() => {
    setSound((on) => {
      if (!on && !unlockSound()) return on;
      saveSound(!on);
      return !on;
    });
  }, []);
  useEffect(() => {
    if (sound && beats && screen === "app" && s.mode === "single") beat(beats.str[s.k], beats.lvl?.[s.k] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.k, sound]);
  const togglePlay = useCallback(() => {
    setS((o) => (o.mode === "single" ? o : { ...o, mode: "single" }));
    setPlaying((p) => !p);
  }, []);

  // open the 10 m close-up and fly to it
  const openCloseup = useCallback((patch = {}) => {
    const c = ds?.event?.closeup;
    if (!c) return;
    setPlaying(false);
    setS((o) => ({ ...o, cu: true, cuView: "swipe", cuFlood: true, cuHidden: true, ...patch }));
    setView({ bounds: cornerBounds(c.corners), n: Date.now() });
  }, [ds]);

  // ---------- guided tour ----------
  const tour = useMemo(() => {
    if (ds?.farm) {
      const f = ds.farm, d = ds.m.dates, n2 = d.length, P = f.peak, L = n2 - 1;
      const fit = { bounds: siteBounds(ds) };
      const day = (i) => fmtDate(d[i].date, true);
      const spot = story.spot;
      return [
        { title: t("f1title", { name: siteName }), text: story.tourIntro,
          apply: () => { set({ mode: "single", pol: "rgb", k: P, showContext: true }); setView({ ...fit, n: 1 }); } },
        { title: t("f2title"), text: t("f2text", { a: day(0), b: day(L) }),
          apply: () => { set({ mode: "single", pol: "rgb", k: 0 }); setPlaying(true); setView({ ...fit, n: 2 }); } },
        { title: t("f3title"), text: t("f3text", { rise: f.rise?.toFixed(1), a: day(0), b: day(P), km: Math.round(f.farmland_km2) }),
          apply: () => { set({ mode: "swipe", xray: false, pol: "rgb", kA: 0, kB: P }); setView({ ...fit, n: 3 }); } },
        { title: t("f4title"), text: t("f4text"),
          apply: () => { set({ mode: "single", pol: "rgb", k: P }); if (spot) { setPoint(spot); setOutside(false); setView({ center: spot, zoom: 12.5, n: 4 }); } } },
        { title: t("f5title"), text: t("f5text", { a: day(P), h: Math.round(f.harvested_km2), pct: ((f.harvested_km2 / f.farmland_km2) * 100).toFixed(1), b: day(L) }),
          apply: () => { set({ mode: "change", expert: true, cpol: "hv", kA: P, kB: L, thr: 3 }); setView({ ...fit, n: 5 }); } },
        { title: t("f6title"), text: story.tourWhy,
          apply: () => { set({ mode: "single", expert: true, pol: "hv", k: P }); setView({ ...fit, n: 6 }); } },
      ];
    }
    if (ds?.event) {
      const ev = ds.event, B0 = ev.kBefore, A0 = ev.kAfter, hot = ev.hotspot, d = ds.m.dates;
      const fit = { bounds: siteBounds(ds) };
      const day = (i) => fmtDate(d[i].date, true);
      return [
        { title: t("e1title", { name: siteName }), text: t("e1text", { name: story.region || siteName }),
          apply: () => { set({ mode: "single", pol: "rgb", k: B0, showWater: false }); setView({ ...fit, n: 1 }); } },
        { title: t("e2title"), text: t("e2text", { a: day(0), b: day(d.length - 1), date: fmtDate(ev.date, true) }),
          apply: () => { set({ mode: "single", pol: "hh", k: 0 }); setPlaying(true); setView({ ...fit, n: 2 }); } },
        { title: t("e3title"), text: t("e3text"),
          apply: () => { set({ mode: "story", pol: "hh", kA: B0, kB: A0 }); setView(hot ? { center: [hot[0] + 0.03, hot[1] - 0.04], zoom: 11.3, n: 3 } : { ...fit, n: 3 }); } },
        { title: t("e4title"), text: story.hotspot,
          apply: () => { set({ mode: "story", kA: B0, kB: A0 }); if (hot) setView({ center: hot, zoom: 12.6, n: 4 }); } },
        ...(ev.closeup ? [{ title: t("cuTourTitle"), text: t("cuTourText", { px: ev.closeup.pixel_m, w: ev.closeup.stats_km2.flood_darker_km2.toFixed(1) }),
          apply: () => openCloseup({ cuView: "after" }) }] : []),
        { title: t("e5title"), text: t("e5text"),
          apply: () => { set({ mode: "single", pol: "hh", k: A0 }); if (hot) { setPoint(hot); setOutside(false); setView({ center: hot, zoom: 12.6, n: 5 }); } } },
        { title: t("e6title"), text: t(ds.optical[A0] ? "e6textX" : "e6text", { a: day(B0), b: day(A0), pct: ds.optical[A0]?.cloud_pct }),
          apply: () => { set({ mode: "swipe", pol: "rgb", xray: !!ds.optical[A0], kA: B0, kB: A0 }); setView({ ...fit, n: 6 }); } },
        { title: t("e7title"), text: t("e7text"),
          apply: () => { set({ mode: "change", expert: true, cpol: "hh", kA: B0, kB: A0, thr: 3 }); setView({ ...fit, n: 7 }); } },
      ];
    }
    if (!ds || !stats || !wdFull) return [];
    const d = ds.m.dates, A = stats.ia, B = stats.ib;
    const fit = { bounds: siteBounds(ds) };
    const hot = wdFull.hotspot;
    const day = (i) => fmtDate(d[i].date, true);
    return [
      { title: t("t1title", { name: siteName }), text: t("t1text", { name: siteName, inCountry: story.country ? t("inCountry", { country: story.country }) : "" }),
        apply: () => { set({ mode: "single", pol: "rgb", k: A, showWater: false }); setView({ ...fit, n: 1 }); } },
      { title: t("t2title"), text: t("t2text", { a: day(A), b: day(B) }),
        apply: () => { set({ mode: "single", pol: "hh", k: A, showWater: true }); setPlaying(true); setView({ ...fit, n: 2 }); } },
      { title: t("t3title"), text: t(story.levelAt ? "t3textMulti" : "t3text", {
          g: wdFull.gained.toFixed(1), n: fmtInt(wdFull.gained / PITCH_KM2), pct: signed(stats.pct, 0),
          lost: wdFull.lost < 0.3 ? t("t3noLoss") : t("t3loss", { l: wdFull.lost.toFixed(1) }),
        }),
        apply: () => { set({ mode: "story", pol: "hh", kA: A, kB: B }); setView({ ...fit, n: 3 }); } },
      { title: t("t4title"), text: story.hotspot,
        apply: () => { set({ mode: "story", kA: A, kB: B }); if (hot) setView({ center: hot, zoom: 12.3, n: 4 }); } },
      { title: t("t5title"), text: t("t5text"),
        apply: () => { set({ mode: "single", pol: "hh", k: B }); if (hot) { setPoint(hot); setOutside(false); setView({ center: hot, zoom: 12.3, n: 5 }); } } },
      { title: t("t6title"), text: story.tourWhy,
        apply: () => { set({ mode: "swipe", xray: false, pol: clearPhoto(ds, A) && clearPhoto(ds, B) ? "photo" : "rgb", kA: A, kB: B }); setView({ ...fit, n: 6 }); } },
      { title: t("t7title"), text: t("t7text"),
        apply: () => { set({ mode: "change", expert: true, kA: A, kB: B, thr: 3 }); setView({ ...fit, n: 7 }); } },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds, stats, wdFull, story, set, lang, openCloseup]);
  const closeTour = useCallback(() => { setGuideIdx(-1); setPlaying(false); }, []);

  // ---------- answers to the challenge questions, measured on this site ----------
  const pc = useMemo(() => (ds && s.mode === "story" ? polCompare(ds, s.kA, s.kB) : null), [ds, s.mode, s.kA, s.kB]);
  const pcFull = useMemo(() => ds && stats && polCompare(ds, stats.ia, stats.ib), [ds, stats]);
  const near = useMemo(() => (ds && stats ? placesNearWater(ds, stats.ib, 3) : []), [ds, stats]);

  // ---------- scroll story: the same steps as the tour, plus the three questions ----------
  const chapters = useMemo(() => {
    if (!tour.length) return [];
    if (ds.farm) {
      const f = ds.farm, d = ds.m.dates, P = f.peak, L = d.length - 1;
      const fit = () => setView({ bounds: siteBounds(ds), n: Math.random() });
      const P_ = ({ children }) => <p>{children}</p>;
      const day = (i) => fmtDate(d[i].date, true);
      const places = ds.context?.places ?? [];
      return [
        { id: "home", title: story.c1title || (story.personal ? t("c1titlePersonal") : t("f1title", { name: siteName })),
          apply: () => { set({ mode: "single", pol: "rgb", k: P, showContext: true }); fit(); },
          body: <>
            {story.personal && <P_>{story.personal}</P_>}
            <P_>{story.intro(siteName)}</P_>
          </> },
        { id: "people", title: story.c2title || t("c2title"),
          apply: () => { set({ mode: "single", pol: "rgb", k: P, showContext: true }); fit(); },
          body: <>
            <P_>{story.human}</P_>
            {places.length > 0 && <P_>{placeList(places, 8)}. <em>{t("osmSource")}</em></P_>}
          </> },
        { id: "film", title: t("f2title"), apply: tour[1].apply,
          body: <P_>{tour[1].text} {t("c3passes", { n: d.length, a: day(0), b: day(L) })}</P_> },
        { id: "changed", title: t("f3title"), apply: tour[2].apply,
          body: <>
            <P_>{tour[2].text}</P_>
            <FarmChart ds={ds} kMain={P} />
            <p className="hint">{t("farmChartHint")}</p>
          </> },
        { id: "where", title: t("f4title"), apply: tour[3].apply, body: <P_>{tour[3].text}</P_> },
        { id: "harvest", title: t("f5title"), apply: tour[4].apply,
          body: <>
            <P_>{tour[4].text}</P_>
            <P_>{tr("farmInsight", { b: day(L) })}</P_>
          </> },
        { id: "why", title: t("c6title"),
          apply: () => { set({ mode: "swipe", xray: false, pol: "rgb", kA: 0, kB: P }); fit(); },
          body: <>
            <P_>{story.why}</P_>
            <h3>{t("c6hidden")}</h3>
            <ul className="caveats">{story.notSeen.map(([h, x]) => <li key={h}><b>{h}.</b> {x}</li>)}</ul>
          </> },
        { id: "pol", title: t("c7title"),
          apply: () => { set({ mode: "single", expert: true, pol: "hv", k: P }); fit(); },
          body: <FarmPol ds={ds} onView={(pol) => set({ mode: "single", expert: true, pol, k: P })} /> },
        { id: "future", title: t("c8title"),
          apply: ds.insar ? () => { set({ mode: "single", expert: true, pol: "insar", k: P }); fit(); } : tour[4].apply,
          body: <>
            <P_>{t(ds.insar ? "c8textInsar" : "c8text")}</P_>
            {ds.insar && <p className="hint">{t("helpInsar", { a: fmtDate(ds.insar.from, true), b: fmtDate(ds.insar.to, true) })}</p>}
            <ul className="future">{story.future.map(([ic, h, x]) => <li key={h}><span aria-hidden="true">{ic}</span><div><b>{h}.</b> {x}</div></li>)}</ul>
          </> },
        { id: "matters", title: t("c9title"),
          apply: () => { set({ mode: "single", pol: "rgb", k: P }); fit(); },
          body: <>
            <P_>{story.matters}</P_>
            <Actions story={story} />
            {story.caveats.length > 0 && <><h3>{t("qSure")}</h3><ul className="caveats">{story.caveats.map((c) => <li key={c}>{c}</li>)}</ul></>}
          </> },
      ];
    }
    if (ds.event) {
      const ev = ds.event, B0 = ev.kBefore, A0 = ev.kAfter, d = ds.m.dates;
      const fit = () => setView({ bounds: siteBounds(ds), n: Math.random() });
      const P = ({ children }) => <p>{children}</p>;
      const day = (i) => fmtDate(d[i].date, true);
      const places = ds.context?.places ?? [];
      return [
        { id: "home", title: story.personal ? t("c1titlePersonal") : t("e1title", { name: siteName }),
          apply: () => { set({ mode: "single", pol: "rgb", k: A0, showContext: true }); fit(); },
          body: <>
            {story.personal && <P>{story.personal}</P>}
            <P>{story.intro(siteName)}</P>
            {story.media.map((x) => (
              <figure key={x.src} className="media">
                {/\.(mp4|webm)$/i.test(x.src) ? <video src={x.src} controls playsInline /> : <img src={x.src} alt={x.caption} loading="lazy" />}
                <figcaption>{x.caption}</figcaption>
              </figure>
            ))}
          </> },
        { id: "people", title: t("ec2title"),
          apply: () => { set({ mode: "single", pol: "rgb", k: A0, showContext: true }); ev.hotspot ? setView({ center: ev.hotspot, zoom: 10.6, n: Math.random() }) : fit(); },
          body: <>
            <P>{story.human}</P>
            <P>{t("ec2text")}</P>
            {places.length > 0 && <P>{placeList(places, 8)}. <em>{t("osmSource")}</em></P>}
          </> },
        { id: "film", title: t("c3title"), apply: tour[1].apply,
          body: <P>{tour[1].text} {t("c3passes", { n: d.length, a: day(0), b: day(d.length - 1) })}</P> },
        { id: "changed", title: t("e3title"), apply: tour[2].apply,
          body: <>
            <P>{tour[2].text}</P>
            <P>{tr("ec4extra", { d: (ev.hh_valley_darker_km2 ?? ev.valley_darker_km2 ?? 0).toFixed(1), b: (ev.hh_valley_brighter_km2 ?? ev.valley_brighter_km2 ?? 0).toFixed(1) })}</P>
            <p className="hint">{t("evOnly")}</p>
          </> },
        { id: "where", title: t("e4title"), apply: tour[3].apply, body: <P>{story.hotspot}</P> },
        ...(ev.closeup ? [{ id: "closeup", title: t("cuTitle"), apply: () => openCloseup({ cuView: "after" }),
          body: <>
            <P>{story.cuWhy}</P>
            <P>{tr("cuChapter", { px: ev.closeup.pixel_m, w: ev.closeup.stats_km2.flood_darker_km2.toFixed(1), d: ev.closeup.stats_km2.flood_brighter_km2.toFixed(1), s: ev.closeup.stats_km2.seasonal_brighter_km2.toFixed(1) })}</P>
            <P>{tr("cu60vs10", { px: ev.closeup.pixel_m })}</P>
            <p className="hint">{t("cuChapterHint")}</p>
          </> }] : []),
        { id: "why", title: t("c6title"),
          apply: () => { set({ mode: "swipe", xray: false, pol: "rgb", kA: B0, kB: A0 }); setView({ center: ev.hotspot ?? ds.m.center, zoom: 11.2, n: Math.random() }); },
          body: <>
            <P>{story.why}</P>
            <h3>{t("c6hidden")}</h3>
            <ul className="caveats">{story.notSeen.map(([h, x]) => <li key={h}><b>{h}.</b> {x}</li>)}</ul>
            <p className="hint">{t("c6hint", { a: day(B0), b: day(A0) })}</p>
          </> },
        { id: "pol", title: t("c7title"),
          apply: () => { set({ mode: "single", expert: true, pol: "hh", k: A0 }); fit(); },
          body: <EventPolCard ds={ds} onView={(pol) => set({ mode: "single", expert: true, pol, k: A0 })} /> },
        { id: "future", title: t("c8title"),
          apply: ds.insar ? () => { set({ mode: "single", expert: true, pol: "insar", k: A0 }); fit(); } : tour.at(-1).apply,
          body: <>
            <P>{t(ds.insar ? "c8textInsar" : "c8text")}</P>
            {ds.insar && <p className="hint">{t("helpInsar", { a: fmtDate(ds.insar.from, true), b: fmtDate(ds.insar.to, true) })}</p>}
            <ul className="future">{story.future.map(([ic, h, x]) => <li key={h}><span aria-hidden="true">{ic}</span><div><b>{h}.</b> {x}</div></li>)}</ul>
          </> },
        { id: "matters", title: t("c9title"),
          apply: () => { set({ mode: "story", pol: "hh", kA: B0, kB: A0 }); fit(); },
          body: <>
            <P>{story.matters}</P>
            <Actions story={story} />
            {story.caveats.length > 0 && <><h3>{t("qSure")}</h3><ul className="caveats">{story.caveats.map((c) => <li key={c}>{c}</li>)}</ul></>}
          </> },
      ];
    }
    const d = ds.m.dates, A = stats.ia, B = stats.ib;
    const fit = () => setView({ bounds: siteBounds(ds), n: Math.random() });
    const dam = ds.context?.dams.find((x) => x.name);
    const P = ({ children }) => <p>{children}</p>;
    const day = (i) => fmtDate(d[i].date, true);
    return [
      { id: "home", title: story.personal ? t("c1titlePersonal") : t("t1title", { name: siteName }),
        apply: () => { set({ mode: "single", pol: ds.optical[B] ? "photo" : "rgb", k: B, showWater: true, showContext: true }); fit(); },
        body: <>
          {story.personal && <P>{story.personal}</P>}
          <P>{story.intro(siteName)}</P>
          {story.media.map((x) => (
            <figure key={x.src} className="media">
              {/\.(mp4|webm)$/i.test(x.src) ? <video src={x.src} controls playsInline /> : <img src={x.src} alt={x.caption} loading="lazy" />}
              <figcaption>{x.caption}</figcaption>
            </figure>
          ))}
          <p className="hint">{t("c1hint", { date: ds.optical[B] ? fmtDate(ds.optical[B].date, true) : day(B) })}</p>
        </> },
      { id: "people", title: story.c2title || t("c2title"),
        apply: () => { set({ mode: "single", pol: "rgb", k: B, showWater: true, showContext: true }); dam ? setView({ center: dam.lonlat, zoom: 11.6, n: Math.random() }) : fit(); },
        body: <>
          {story.human && <P>{story.human}</P>}
          {dam && <P>{tr("c2dam", { dam: placeName(dam) })}</P>}
          {near.length > 0 && <P>{tr("c2near", { n: near.length, list: placeList(near, 5) })} <em>{t("osmSource")}</em></P>}
          <p className="hint">{t("c2hint")}</p>
        </> },
      { id: "film", title: t("c3title"), apply: tour[1].apply,
        body: <P>{tour[1].text} {t("c3passes", { n: d.length, a: day(0), b: day(d.length - 1) })}</P> },
      { id: "changed", title: t("t3title"), apply: tour[2].apply,
        body: <>
          <P>{tour[2].text}</P>
          {d[A].level_m_est != null && d[B].level_m_est != null && <P>{tr(story.levelAt ? "c4levelAt" : "c4level", { a: fmtInt(d[A].level_m_est), b: fmtInt(d[B].level_m_est), at: story.levelAt })}</P>}
        </> },
      { id: "where", title: t("t4title"), apply: tour[3].apply, body: <P>{tour[3].text}</P> },
      { id: "why", title: t("c6title"),
        apply: () => { set({ mode: "swipe", xray: false, pol: clearPhoto(ds, A) && clearPhoto(ds, B) ? "photo" : "rgb", kA: A, kB: B }); fit(); },
        body: <>
          <P>{story.why}</P>
          <h3>{t("c6hidden")}</h3>
          <ul className="caveats">{story.notSeen.map(([h, x]) => <li key={h}><b>{h}.</b> {x}</li>)}</ul>
          <p className="hint">{t("c6hint", { a: day(A), b: day(B) })}</p>
        </> },
      { id: "pol", title: t("c7title"),
        apply: () => { set({ mode: "single", expert: true, pol: pcFull?.winner ?? "hh", k: B, showWater: true }); fit(); },
        body: pcFull
          ? <PolCard ds={ds} kA={A} kB={B} pc={pcFull} onView={(pol) => set({ mode: "single", expert: true, pol, k: B })} />
          : <P>{t("c7none")}</P> },
      ...(ds.motion ? [{ id: "motion", title: t("moTitle"),
        apply: () => { set({ mode: "single", pol: "motion", k: B }); setView({ bounds: [[ds.motion.corners[3][0], ds.motion.corners[2][1]], [ds.motion.corners[1][0], ds.motion.corners[0][1]]], n: Math.random() }); },
        body: <>
          <P>{tr("moLead", { n: ds.motion.pairs.length, a: fmtDate(ds.motion.dates[0], true), b: fmtDate(ds.motion.dates.at(-1), true) })}</P>
          <MotionChart ds={ds} />
          <P>{tr("moChapter", { cm: ds.motion.spots?.[0]?.total_cm.toFixed(1) })}</P>
          <p className="hint">{t("moC2")} {t("moC5")}</p>
        </> }] : []),
      { id: "future", title: t("c8title"),
        apply: () => { set(ds.insar ? { mode: "single", expert: true, pol: "insar", k: B, showWater: true } : { mode: "change", expert: true, kA: A, kB: B, thr: 3 }); fit(); },
        body: <>
          <P>{t(ds.insar ? "c8textInsar" : "c8text")}</P>
          {ds.insar && <p className="hint">{t("helpInsar", { a: fmtDate(ds.insar.from, true), b: fmtDate(ds.insar.to, true) })}{story.insarNote ? " " + story.insarNote : ""}</p>}
          <ul className="future">{story.future.map(([ic, h, x]) => <li key={h}><span aria-hidden="true">{ic}</span><div><b>{h}.</b> {x}</div></li>)}</ul>
        </> },
      { id: "matters", title: t("c9title"),
        apply: () => { set({ mode: "story", pol: "hh", kA: A, kB: B }); fit(); },
        body: <>
          <P>{story.matters}</P>
          {story.caveats.length > 0 && <><h3>{t("qSure")}</h3><ul className="caveats">{story.caveats.map((c) => <li key={c}>{c}</li>)}</ul></>}
        </> },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, ds, stats, story, near, pcFull, set, lang, openCloseup]);
  const goGuide = useCallback((i) => {
    if (i < 0 || i >= chapters.length) return;
    setGuideIdx(i);
    setSheet(true);
    chapters[i].apply();
  }, [chapters]);
  // landing page / dashboard → a story on the map (query = "mode=…&pol=…")
  const enterApp = (slugTo, query = "") => {
    markWelcome();
    setDialog(null); setPoint(null); setGuideIdx(-1);
    applying.current = true;
    navigate(`/map/${slugTo}?${query}${query ? "&" : ""}lang=${lang}`);
    setNav((x) => x + 1);
  };
  const enterTour = () => { pendingGuide.current = true; enterApp("water", "mode=story"); };
  useEffect(() => {
    if (screen === "app" && pendingGuide.current && chapters.length && ds?.id === "vakhsh_cascade" && !progress) { pendingGuide.current = false; goGuide(0); }
  }, [screen, chapters, ds, progress, goGuide]);
  const toLanding = () => { closeTour(); setPlaying(false); navigate("/"); };
  // story chips: the same site switches view at once; another site loads through the route
  const openRoute = (r) => {
    setGuideIdx(-1); setPoint(null);
    if (r.site === siteId && ds) {
      if (r.preset) set(r.preset);
      else if (s.pol === "motion") set({ mode: "story", pol: "hh" });
      if (r.preset?.pol === "motion" && ds.motion) { const c = ds.motion.corners; setView({ bounds: [[c[3][0], c[2][1]], [c[1][0], c[0][1]]], n: Date.now() }); }
      else setView({ bounds: siteBounds(ds), n: Date.now() });
    } else navigate(`/map/${r.slug}?lang=${lang}`);
  };

  // keyboard: Space = play/pause, arrows = step dates
  useEffect(() => {
    const onKey = (e) => {
      if (!ds || e.target.matches("input, select, textarea") || document.querySelector("dialog[open]")) return;
      if (guideIdx >= 0) return;
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      if (s.mode === "single" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        setPlaying(false);
        setS((o) => ({ ...o, k: Math.max(0, Math.min(n - 1, o.k + (e.key === "ArrowRight" ? 1 : -1))) }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ds, n, s.mode, togglePlay, guideIdx]);

  // shareable URL
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    // wait while a site loads or a view from the URL is being applied, or the old view would overwrite the new URL
    if (!ds || screen !== "app" || applying.current || route?.site !== ds.id) return;
    const p = new URLSearchParams({ mode: s.mode, pol: s.pol, d: s.k, a: s.kA, b: s.kB, thr: s.thr, cpol: s.cpol, "3d": s.terrain ? 1 : 0, x: s.expert ? 1 : 0, xr: s.xray ? 1 : 0, lang });
    if (cu) { p.set("cu", 1); p.set("cv", s.cuView); }
    const want = `/map/${slugFor(ds.id, s.mode, s.pol)}?${p}`;
    if (want !== location.pathname + location.search) navigate(want, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, screen, ds, route, cu, s.cuView, s.mode, s.pol, s.k, s.kA, s.kB, s.thr, s.cpol, s.terrain, s.expert, s.xray, lang]);

  useEffect(() => { if (!outside) return; const h = setTimeout(() => setOutside(false), 2600); return () => clearTimeout(h); }, [outside]);
  const onPick = useCallback(
    (ll) => {
      if (!ds) return;
      const inside = !!lonLatToPixel(ds, ll);
      setOutside(!inside);
      setPoint(inside ? ll : null);
    },
    [ds]
  );

  const onAreaPick = useCallback(
    (i) => {
      setPlaying(false);
      setS((o) => (o.mode === "single" ? { ...o, k: i } : { ...o, kB: i }));
    },
    []
  );

  const setExpert = (on) =>
    set(on ? { expert: true } : { expert: false, ...(s.mode === "change" ? { mode: "story" } : {}), ...(s.pol === "hv" || s.pol === "insar" ? { pol: "hh" } : {}) });

  const m = ds?.m;
  // the timeline sits on the map (like a video player); hidden where dates do not apply
  const eventStory = !!ds?.event && s.mode === "story";
  const dock = !!ds && !cu && !mo && !eventStory && !(s.mode === "single" && s.pol === "insar");
  const fitSite = () => ds && setView({ bounds: siteBounds(ds), n: Date.now() });
  const fmt = (i) => fmtDate(m.dates[i].date);
  const cuLegend = cu && s.cuFlood ? <> · <span className="sw flood" /> {t("cuWetShort")} · <span className="sw rock" /> {t("cuDebrisShort")}</> : null;
  const badge = !ds ? null : cu ? (
    s.cuView === "swipe"
      ? <><div className="ab"><span>◀ {t("cuBefore")}</span><span>{t("cuAfter")} ▶</span></div><div>{t("cuBadge", { px: cu.pixel_m })}{cuLegend}</div></>
      : <><b>{t(s.cuView === "before" ? "cuBefore" : "cuAfter")}</b> · {t("cuBadge", { px: cu.pixel_m })}{cuLegend}</>
  ) : s.mode === "story" && ds.farm ? (
    <><b>{fmt(s.kB)}</b> · {t(POL_LABEL[s.pol])} · {t("farmBadge")}</>
  ) : s.mode === "story" && ds.event ? (
    <>{t("evBadge", { date: fmtDate(ds.event.date) })} · <span className="sw flood" /> {t("evBlue")} · <span className="sw rock" /> {t("evRed")}</>
  ) : s.mode === "story" ? (
    <><b>{fmt(s.kA)}</b> → <b>{fmt(s.kB)}</b> · <span className="sw gain" /> {t("newWater")} · <span className="sw loss" /> {t("waterGone")} · <span className="sw keep" /> {t("waterBoth")}</>
  ) : mo ? (
    <>{t("polMotion")} · <b>{fmtDate(mo.dates[0])}</b> → <b>{fmtDate(mo.dates.at(-1))}</b> · <span className="sw" style={{ background: "#b2182b" }} />/<span className="sw" style={{ background: "#2166ac" }} /> {t("moBadge")}</>
  ) : s.mode === "single" && s.pol === "insar" && ds.insar ? (
    <>{t("polInsar")} · <b>{fmtDate(ds.insar.from)}</b> → <b>{fmtDate(ds.insar.to)}</b></>
  ) : s.mode === "single" ? (
    <>
      <b>{fmt(s.k)}</b> · {t(POL_LABEL[s.pol])}
      {m.dates[s.k].water_km2 != null && <> · {t("lakeSize")} <b>{m.dates[s.k].water_km2.toFixed(1)} km²</b></>}
    </>
  ) : xr ? (
    <div className="ab">
      <span>◀ {t("xrayCam")} <b>{ds.optical[s.kB] ? fmtDate(ds.optical[s.kB].date) : "–"}</b>{ds.optical[s.kB]?.cloud_pct >= 8 && <> · ☁️ {ds.optical[s.kB].cloud_pct}%</>}</span>
      <span>{t("xrayRadar")} <b>{fmt(s.kB)}</b> ▶</span>
    </div>
  ) : s.mode === "swipe" ? (
    <div className="ab"><span>◀ <b>{fmt(s.kA)}</b></span><span><b>{fmt(s.kB)}</b> ▶</span></div>
  ) : (
    <>
      {t("changeBadge")} <b>{fmt(s.kA)}</b> → <b>{fmt(s.kB)}</b> · {s.cpol.toUpperCase()} ±{s.thr} dB
      {stats && <><br /><span style={{ color: WATER_A_COLOR }}>- - -</span> {t("waterA")} &nbsp; <span style={{ color: WATER_COLOR }}>———</span> {t("waterB")}</>}
    </>
  );

  // ---------- the answer panel: what changed / why / can we trust it / what to do / lab ----------
  const clearPoint = () => { setPoint(null); setOutside(false); };
  const whatTab = !ds ? null : cu ? (
    <div className="what-tab">
      <CloseupCard ds={ds} s={s} set={set} story={story}
        onPlace={(ll) => setView({ center: ll, zoom: 13.6, n: Date.now() })}
        onExit={() => { set({ cu: false }); fitSite(); }} />
    </div>
  ) : (
    <div className="what-tab">
      {mo && (
        <MotionCard ds={ds}
          onSpot={(ll) => { setPoint(null); setView({ center: ll, zoom: 12.3, n: Date.now() }); }}
          onDam={ds.context?.dams.some((d) => /rogun/i.test(d.name)) ? () => setView({ center: ds.context.dams.find((d) => /rogun/i.test(d.name)).lonlat, zoom: 13, n: Date.now() }) : null} />
      )}
      {s.mode === "change" && <Controls ds={ds} s={s} set={set} playing={playing} onTogglePlay={togglePlay} change={change} hasWater={!!stats} dock lab />}
      {s.mode === "story" && ds.event && (
        <EventCard ds={ds} story={story} onZoomHotspot={() => ds.event.hotspot && setView({ center: ds.event.hotspot, zoom: 12.6, n: Date.now() })}
          onCloseup={ds.event.closeup ? () => openCloseup() : null} />
      )}
      {s.mode === "story" && ds.farm && (
        <FarmCard ds={ds} story={story} kMain={kMain} onPick={onAreaPick}
          onGrowth={() => { set({ mode: "swipe", xray: false, pol: "rgb", kA: 0, kB: ds.farm.peak }); fitSite(); }}
          onHarvest={() => { set({ mode: "change", expert: true, cpol: "hv", kA: ds.farm.peak, kB: n - 1, thr: 3 }); fitSite(); }} />
      )}
      {s.mode === "story" && !ds.event && !ds.farm && (
        <StoryCard ds={ds} story={story} kA={s.kA} kB={s.kB} wd={wd} near={near}
          onSwap={() => set({ kA: s.kB, kB: s.kA })}
          onZoomHotspot={() => wd?.hotspot && setView({ center: wd.hotspot, zoom: 12.3, n: Date.now() })} />
      )}
      {ds.event && <ZoneCard ds={ds} kMain={kMain} onPick={onAreaPick} />}
      {ds.farm && s.mode !== "story" && (
        <section className="card">
          <h2>{t("farmChartTitle")}</h2>
          <FarmChart ds={ds} kMain={kMain} onPick={onAreaPick} />
          <p className="hint">{t("farmChartHint")}</p>
        </section>
      )}
      {stats && !mo && <AreaCard m={m} stats={stats} note={story.areaNote} kMain={kMain} kA={s.kA} showA={s.mode !== "single"} onPick={onAreaPick} />}
      {ds.orbit2 && !mo && <Orbit2Card ds={ds} />}
      {!mo && s.mode !== "change" && (
        <details className="card readpic">
          <summary>{t("howRead")}</summary>
          <LayerHelp ds={ds} s={s} />
        </details>
      )}
      {clouds && nCloudy * 2 >= clouds.filter((c) => c != null).length && nCloudy > 0 && (() => {
        const worst = clouds.reduce((b, c, i) => (c != null && c > (clouds[b] ?? -1) ? i : b), 0);
        return (
          <section className="card cloudcard">
            <h2>{t("cloudTitle")}</h2>
            <p>{tr("cloudText", { c: nCloudy, n: ds.m.dates.length })}</p>
            <div className="cloudbars" aria-label={t("cloudLegend")}>
              {clouds.map((c, i) => {
                const [day, mon] = fmtDate(ds.m.dates[i].date, true).split(" ");
                return (
                  <div key={i} title={`${fmtDate(ds.m.dates[i].date)}: ${c ?? "–"}%`}>
                    <span className="cam"><i style={{ height: `${c ?? 0}%` }} /></span>
                    <span className="rad" />
                    <small>{day}<br />{mon}</small>
                  </div>
                );
              })}
            </div>
            <div className="legend"><span><i style={{ background: "#e5e9f5" }} />{t("cloudLegend")}</span><span><i style={{ background: "var(--accent)" }} />{t("cloudRadar")}</span></div>
            <button className="primary" onClick={() => set({ mode: "swipe", xray: true, pol: "photo", kB: worst })}>{t("cloudBtn", { date: fmtDate(ds.m.dates[worst].date, true), pct: clouds[worst] })}</button>
          </section>
        );
      })()}
      <p className="hint big clickme">{t(ds.event ? "clickHintEv" : ds.farm ? "clickHintFarm" : "clickHint")}</p>
    </div>
  );
  const trustTab = !ds ? null : (
    <div className="stack-l">
      {ds.event ? <EventPolCard ds={ds} onView={(pol) => set({ mode: "single", expert: true, pol, k: ds.event.kAfter })} />
        : ds.farm ? <FarmPol ds={ds} onView={(pol) => set({ mode: "single", expert: true, pol, k: ds.farm.peak })} />
        : pcFull ? <PolCard ds={ds} kA={stats.ia} kB={stats.ib} pc={pcFull} onView={(pol) => set({ mode: "single", expert: true, pol })} /> : null}
      <section className="card">
        <h2>{t("qSure")}</h2>
        <ul className="caveats">
          <li>{tr("l1")}</li>
          {story.caveats.map((c) => <li key={c}>{c}</li>)}
          {mo && ["moC1", "moC2", "moC5"].map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
      </section>
      {story.check && <section className="card"><h2>{t("rCheck")}</h2><p>{story.check}</p></section>}
      <button className="ghost" onClick={() => setDialog("about")}>{t("btnAbout")} →</button>
    </div>
  );
  const labTab = !ds ? null : (
    <div className="stack-l">
      <section className="card">
        <h2>{t("tabLab")}</h2>
        <p className="hint">{t("labIntro")}</p>
        <div className="seg" title={t("levelTitle")}>
          <button className={!s.expert ? "on" : ""} onClick={() => setExpert(false)}>{t("simple")}</button>
          <button className={s.expert ? "on" : ""} onClick={() => setExpert(true)}>{t("expert")}</button>
        </div>
      </section>
      <Controls ds={ds} s={s} set={set} playing={playing} onTogglePlay={togglePlay} change={change} hasWater={!!stats} dock lab />
    </div>
  );
  const route0 = route ?? STORY_ROUTES.find((r) => r.site === ds?.id);
  const answerHead = ds && (
    <header className="answer-head">
      <span className="kicker">{route0?.icon} {t(route0?.kind ?? "lpKindWater")}</span>
      <h2>{mo ? t("lpMotionTitle") : siteName}</h2>
      <p className="hint">{story.region || m.region}{story.country && !String(story.region).includes(story.country) ? `, ${story.country}` : ""} · {fmtDate(m.dates[0].date, true)} → {fmtDate(m.dates.at(-1).date, true)}</p>
    </header>
  );
  const pointPopup = ds && point ? (
    <PointCard ds={ds} point={point} k={kMain} outside={false} expert={s.expert} onPick={onAreaPick} onClear={clearPoint} />
  ) : null;

  return (
    <>
      {screen === "landing" && <Landing sites={sites} lang={lang} chooseLang={chooseLang} onOpen={enterApp} onTour={enterTour} onRiver={() => navigate("/river")} />}
      {screen === "river" && <River sites={sites} lang={lang} chooseLang={chooseLang} onHome={toLanding} onOpen={enterApp} onReport={(sl) => navigate(`/report/${sl}`)} />}
      {screen === "report" && <Report sites={sites} slug={location.pathname.slice(8)} lang={lang} chooseLang={chooseLang} onBack={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} />}
      <div className="shell" aria-hidden={screen !== "app" || undefined}>
        <header className="topbar">
          <Link to="/" className="brand" title={t("lpHome")} onClick={(e) => { e.preventDefault(); toLanding(); }}>
            <i className="pulse" aria-hidden="true" />
            <div><h1>Surface Pulse</h1></div>
          </Link>
          <div className="top-actions">
            <button className={guideIdx >= 0 ? "primary on" : "primary"} onClick={() => (guideIdx >= 0 ? closeTour() : goGuide(0))} disabled={!chapters.length}>
              {guideIdx >= 0 ? `× ${t("guideClose")}` : `▶ ${t("btnGuide")}`}
            </button>
            <button className="ghost" onClick={() => setDialog("dash")} disabled={!sites}>▦ {t("btnDash")}</button>
            <button className="ghost" onClick={() => setDialog("about")} disabled={!ds}>ⓘ {t("btnAbout")}</button>
            <div className="seg small level lang" role="group" aria-label={t("language")}>
              {LANGS.map((l) => (
                <button key={l.id} className={lang === l.id ? "on" : ""} onClick={() => chooseLang(l.id)} title={l.name} lang={l.id}>{l.label}</button>
              ))}
            </div>
          </div>
        </header>

        <main className="stage">
          <div className="mapcol">
            <MapView
              ds={ds}
              popup={pointPopup}
              mainUrl={mainUrl}
              radarCorners={cu?.corners ?? mo?.corners}
              changeUrl={cu ? null : change?.url}
              wdiffUrl={mo ? mo.url.sig : cu ? (s.cuFlood ? cu.url.flood : null) : ds?.event ? (s.mode === "story" ? ds.event.overlay : null) : wd?.url}
              wdiffCorners={cu?.corners ?? mo?.corners}
              extras={cuExtras}
              opticalStack={opticalStack}
              opticalIndex={optMain ? optK : null}
              frameReadyRef={frameReadyRef}
              view={view}
              context={ds && s.showContext ? ds.context : null}
              terrain={s.terrain}
              waterMain={ds && !cu && !mo && s.showWater && s.mode !== "story" ? ds.water[kMain] : null}
              waterA={ds && s.showWater && s.mode === "change" ? ds.water[s.kA] : null}
              swipe={swipe}
              opacity={s.opacity}
              showLabels={s.showLabels}
              point={point}
              onPick={onPick}
              badge={<>{badge}
                {refOn && optMain && <div className="cloudwarn ref">📷 {t("cloudRefOn", { date: fmtDate(optMain.date, true), pct: optMain.cloud_pct })} <button className="link" onClick={() => set({ clearRef: false })}>{t("cloudRefOff")}</button></div>}
                {cloudy >= 30 && !refOn && <div className="cloudwarn">{t("cloudWarn", { pct: cloudy })} <button className="link" onClick={() => set({ pol: "rgb" })}>{t("cloudWarnBtn")}</button>
                  {s.mode === "single" && clearIdx != null && ds.optical[clearIdx].cloud_pct < 30 && <> · <button className="link" onClick={() => set({ clearRef: true })}>{t("cloudRefBtn", { date: fmtDate(ds.optical[clearIdx].date, true), pct: ds.optical[clearIdx].cloud_pct })}</button></>}</div>}
              </>}
            >
              <nav className="chips" aria-label={t("site")}>
                {STORY_ROUTES.filter((r) => sites?.some((x) => x.id === r.site) && (r.slug !== "motion" || siteCache.current.get("vakhsh_cascade")?.motion || sites.find((x) => x.id === r.site)?.m.motion)).map((r) => {
                  const on = (route0?.slug ?? slug) === r.slug && (r.slug !== "water" || !mo) && (r.slug !== "motion" || !!mo);
                  return <button key={r.slug} className={on ? "on" : ""} onClick={() => openRoute(r)} aria-pressed={on}><span aria-hidden="true">{r.icon}</span>{t(r.kind)}</button>;
                })}
              </nav>
              {ds && (
                <div className="mapdock">
                  <ViewBar ds={ds} s={s} set={set} cu={cu} eventStory={!!ds.event} />
                  {dock && <Dock ds={ds} s={s} set={(p) => { setPlaying(false); set(p); }} playing={playing} togglePlay={togglePlay} which={which} setWhich={setWhich} sound={sound} toggleSound={toggleSound} />}
                  {cu && <button className="primary cu-back" onClick={() => { set({ cu: false }); fitSite(); }}>{t("cuExit")}</button>}
                </div>
              )}
              {outside && <div className="toast" role="status">{t("outside")}</div>}
            </MapView>
            {(progress || error || !ds) && (
              <div className="loader">
                {!error && <div className="spin" />}
                <span>{error ?? (progress ? t("loadingPics", { a: progress[0], b: progress[1] }) : t("gettingReady"))}</span>
              </div>
            )}
          </div>

          <aside className={`answer${sheet ? " open" : ""}`} aria-label={t("tabWhat")}>
            <button className="sheet-handle" onClick={() => setSheet((v) => !v)} aria-expanded={sheet} aria-label={t(sheet ? "sheetDown" : "sheetUp")}><i /></button>
            {ds && (guideIdx >= 0
              ? <Guide chapters={chapters} idx={guideIdx} onStep={goGuide} onClose={closeTour} />
              : <AnswerPanel tab={tab} setTab={(x) => { setTab(x); setSheet(true); }} head={answerHead} content={{
                  what: whatTab,
                  why: <WhyTab story={story} method={ds.farm ? tr("farmMethod") : mo ? tr("moMethod", { n: mo.pairs.length, px: mo.pixel_m, coh: mo.coherence_min }) : tr("howText")} extra={!mo && <ClimateCard id={ds.id} m={m} />} />,
                  trust: trustTab,
                  act: <ActTab story={story} onReport={() => navigate(`/report/${mo ? "motion" : route0?.slug ?? "water"}`)} />,
                  lab: labTab,
                }} />)}
          </aside>
        </main>
      </div>

      <Dashboard open={dialog === "dash"} onClose={() => setDialog(null)} sites={sites} onOpenSite={(id) => enterApp(slugFor(id))} />
      {m && <AboutDialog open={dialog === "about"} onClose={() => setDialog(null)} m={m} story={story} insar={ds.insar} closeup={ds.event?.closeup} motion={ds.motion} />}
    </>
  );
}
