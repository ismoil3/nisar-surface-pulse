import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fmtInt, getLang, placeName, t } from "../lib/i18n.jsx";

const BLANK_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const BLANK_GEO = { type: "FeatureCollection", features: [] };
export const WATER_COLOR = "#22d3ee";
export const WATER_A_COLOR = "#fbbf24";

const baseStyle = () => ({
  version: 8,
  sources: {
    sat: {
      type: "raster", tileSize: 256, maxzoom: 18,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics | Radar: NISAR (NASA/JPL, ISRO) via ASF DAAC",
    },
    dem: {
      type: "raster-dem", tileSize: 256, maxzoom: 13, encoding: "terrarium",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      attribution: "Terrain: Mapzen / AWS Terrain Tiles",
    },
    lbl: {
      type: "raster", tileSize: 256,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
    },
  },
  layers: [
    { id: "sat", type: "raster", source: "sat", paint: { "raster-saturation": -0.3, "raster-brightness-max": 0.8 } },
    { id: "lbl", type: "raster", source: "lbl" },
  ],
});

/** (Re)creates the radar, change and water layers for a site's footprint. */
function addOverlayLayers(map, corners, opacity) {
  for (const id of ["radar", "change", "x0", "x1", "wdiff", "rivers", "waterA", "water"]) {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }
  // x0 / x1: extra ready-made pictures (e.g. the close-up's hidden slopes and harvest layers)
  for (const id of ["radar", "change", "x0", "x1", "wdiff"]) {
    map.addSource(id, { type: "image", url: BLANK_PNG, coordinates: corners });
    map.addLayer(
      {
        id, type: "raster", source: id,
        paint: { "raster-opacity": id === "radar" ? opacity : 0.9, "raster-fade-duration": 0, "raster-resampling": "nearest" },
      },
      "lbl"
    );
  }
  map.addSource("rivers", { type: "geojson", data: BLANK_GEO });
  map.addLayer({ id: "rivers", type: "line", source: "rivers",
    paint: { "line-color": "#7dd3fc", "line-width": 1.3, "line-opacity": 0.75 } });
  map.addSource("waterA", { type: "geojson", data: BLANK_GEO });
  map.addLayer({ id: "waterA", type: "line", source: "waterA",
    paint: { "line-color": WATER_A_COLOR, "line-width": 1.4, "line-dasharray": [2, 1.5] } });
  map.addSource("water", { type: "geojson", data: BLANK_GEO });
  map.addLayer({ id: "water", type: "line", source: "water", paint: { "line-color": WATER_COLOR, "line-width": 1.6 } });
}

/** Shows (or removes) the dated optical photo under the radar layer. */
function setOptical(map, tiles) {
  if (map.getLayer("opt")) map.removeLayer("opt");
  if (map.getSource("opt")) map.removeSource("opt");
  if (!tiles) return;
  map.addSource("opt", { type: "raster", tiles: [tiles], tileSize: 256, maxzoom: 12,
    attribution: "Optical: NASA HLS (Landsat / Sentinel-2) via GIBS" });
  map.addLayer({ id: "opt", type: "raster", source: "opt", paint: { "raster-fade-duration": 0 } },
    map.getLayer("radar") ? "radar" : "lbl");
}

/**
 * One raster layer per date, all added at once so their tiles load in the background.
 * Switching dates only changes which layer is opaque, so playback never shows half-loaded tiles.
 */
function setOpticalStack(map, list) {
  for (const id of map.getStyle().layers.map((l) => l.id).filter((id) => id.startsWith("optk-"))) map.removeLayer(id);
  for (const id of Object.keys(map.getStyle().sources).filter((id) => id.startsWith("optk-"))) map.removeSource(id);
  list.forEach((tiles, k) => {
    if (!tiles) return;
    map.addSource(`optk-${k}`, { type: "raster", tiles: [tiles], tileSize: 256, maxzoom: 12,
      attribution: "Optical: NASA HLS (Landsat / Sentinel-2) via GIBS" });
    map.addLayer({ id: `optk-${k}`, type: "raster", source: `optk-${k}`,
      layout: { visibility: "none" }, paint: { "raster-opacity": 0, "raster-fade-duration": 0 } },
      map.getLayer("radar") ? "radar" : "lbl");
  });
}

const setImage = (map, id, url, corners) => map.getSource(id)?.updateImage({ url: url || BLANK_PNG, coordinates: corners });
const setGeo = (map, id, geo) => map.getSource(id)?.setData(geo || BLANK_GEO);

/**
 * Main map + optional "before" map for the swipe comparison.
 * swipe = { url, water } shows Date A on the left of the handle, or null to hide it.
 */
export default function MapView({ popup, ds, mainUrl, radarCorners, changeUrl, wdiffUrl, wdiffCorners, extras, opticalStack, opticalIndex, frameReadyRef, waterMain, waterA, swipe, opacity, showLabels, point, onPick, badge, view, terrain, context, children }) {
  const wrapRef = useRef(null);
  const mainEl = useRef(null);
  const aEl = useRef(null);
  const mapRef = useRef(null);
  const mapARef = useRef(null);
  const markerRef = useRef(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const [loaded, setLoaded] = useState(false);
  const [loadedA, setLoadedA] = useState(false);
  const [readyId, setReadyId] = useState(null);   // site whose layers exist on the main map
  const [readyAId, setReadyAId] = useState(null); // same for the swipe map
  const [swipeX, setSwipeX] = useState(0.5);
  const [orbit, setOrbit] = useState(false);   // slow automatic rotation in 3D
  const swipeOnRef = useRef(false);

  // create main map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mainEl.current, style: baseStyle(), center: [69.5, 38.4], zoom: 9,
      attributionControl: { compact: true }, maxPitch: 75,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    map.addControl(new maplibregl.FullscreenControl({ container: wrapRef.current }), "top-right");
    map.getCanvas().style.cursor = "crosshair";
    map.on("click", (e) => pickRef.current?.([e.lngLat.lng, e.lngLat.lat]));
    map.on("load", () => setLoaded(true));
    // a replaced image/tile request is cancelled on purpose; keep the console clean for real errors
    map.on("error", (e) => { if (e.error?.name !== "AbortError") console.error(e.error); });
    for (const ev of ["mousedown", "touchstart", "wheel"]) map.on(ev, () => setOrbit(false)); // user takes over
    map.on("move", () => {
      const a = mapARef.current;
      if (a && swipeOnRef.current) a.jumpTo({ center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() });
    });
    markerRef.current = new maplibregl.Marker({ color: "#f59e0b" });
    mapRef.current = map;
    return () => {
      mapARef.current?.remove();
      mapARef.current = null;
      map.remove();
      mapRef.current = null;
      setLoaded(false);
      setLoadedA(false);
    };
  }, []);

  // site layers + zoom to the scene
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !ds) return;
    addOverlayLayers(map, ds.m.corners, opacity);
    const xs = ds.m.corners.map((c) => c[0]), ys = ds.m.corners.map((c) => c[1]);
    map.stop();
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 30, duration: 0 });
    setReadyId(ds.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, ds]);

  const ready = ds && readyId === ds.id;
  // a close-up can cover a different (smaller) footprint than the site's own radar grid
  useEffect(() => { if (ready) setImage(mapRef.current, "radar", mainUrl, radarCorners ?? ds.m.corners); }, [ready, ds, mainUrl, radarCorners]);
  useEffect(() => {
    if (!ready) return;
    setImage(mapRef.current, "change", changeUrl, ds.m.corners);
    mapRef.current.setLayoutProperty("change", "visibility", changeUrl ? "visible" : "none");
  }, [ready, ds, changeUrl]);
  useEffect(() => {
    if (!ready) return;
    setImage(mapRef.current, "wdiff", wdiffUrl, wdiffCorners ?? ds.m.corners);
    mapRef.current.setLayoutProperty("wdiff", "visibility", wdiffUrl ? "visible" : "none");
  }, [ready, ds, wdiffUrl, wdiffCorners]);
  useEffect(() => {
    if (!ready) return;
    ["x0", "x1"].forEach((id, i) => {
      const x = extras?.[i];
      setImage(mapRef.current, id, x?.url, x?.corners ?? ds.m.corners);
      mapRef.current.setLayoutProperty(id, "visibility", x?.url ? "visible" : "none");
    });
  }, [ready, ds, extras]);
  useEffect(() => { if (ready) setGeo(mapRef.current, "water", waterMain); }, [ready, waterMain]);

  // dated photos: build the stack once per site, then only switch which one is visible
  const photoOn = opticalIndex != null;
  useEffect(() => { if (ready) setOpticalStack(mapRef.current, opticalStack || []); }, [ready, opticalStack]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !opticalStack) return;
    opticalStack.forEach((tiles, k) => {
      if (!tiles || !map.getLayer(`optk-${k}`)) return;
      // keep every date "visible" (so its tiles load) while the photo layer is in use, but opaque only for the current one
      map.setLayoutProperty(`optk-${k}`, "visibility", photoOn ? "visible" : "none");
      map.setPaintProperty(`optk-${k}`, "raster-opacity", k === opticalIndex ? 1 : 0);
    });
  }, [ready, opticalStack, opticalIndex, photoOn]);
  // lets the player wait until the next photo has finished loading
  useEffect(() => {
    if (!frameReadyRef) return;
    frameReadyRef.current = (k) => {
      const map = mapRef.current;
      try { return !map?.getSource(`optk-${k}`) || map.isSourceLoaded(`optk-${k}`); } catch { return true; }
    };
  }, [frameReadyRef]);

  // context from OpenStreetMap: rivers (line layer), settlements and dams (HTML markers)
  const ctxMarkers = useRef([]);
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    setGeo(map, "rivers", context?.rivers);
    ctxMarkers.current.forEach((mk) => mk.remove());
    ctxMarkers.current = [];
    if (!context) return;
    const add = (lonlat, cls, html, tip) => {
      const el = document.createElement("div");
      el.className = `mk ${cls}`;
      el.innerHTML = html;
      if (tip) { el.title = tip; el.style.pointerEvents = "auto"; }
      ctxMarkers.current.push(new maplibregl.Marker({ element: el, anchor: "left" }).setLngLat(lonlat).addTo(map));
    };
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    for (const p of context.places) {
      const name = placeName(p);
      if (!name) continue;
      const pop = p.population ? ` <em>${fmtInt(p.population)} ${t("people")}</em>` : "";
      add(p.lonlat, p.kind === "village" ? "place" : "place town", `<i></i><span>${esc(name)}${pop}</span>`, p.population ? t("popTip") : null);
    }
    for (const d of context.dams) if (d.name) add(d.lonlat, "dam", `<i>▲</i><span>${esc(placeName(d))}</span>`);
    return () => { ctxMarkers.current.forEach((mk) => mk.remove()); ctxMarkers.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, context, getLang()]);

  // camera requests from the app (tour, "zoom to hotspot")
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !view) return;
    if (view.bounds) map.fitBounds(view.bounds, { padding: view.duration ? 60 : 30, maxZoom: 14, duration: view.duration ?? 1200 });
    else map.flyTo({ center: view.center, zoom: view.zoom ?? 12, duration: view.duration ?? 1600, essential: true });
  }, [loaded, view]);
  useEffect(() => { if (ready) setGeo(mapRef.current, "waterA", waterA); }, [ready, waterA]);

  // swipe map: created the first time it is needed, then kept
  const swipeOn = !!swipe;
  swipeOnRef.current = swipeOn;
  useEffect(() => {
    if (!swipeOn) return;
    const main = mapRef.current;
    if (!mapARef.current) {
      const a = new maplibregl.Map({
        container: aEl.current, style: baseStyle(), interactive: false, attributionControl: false,
        center: main.getCenter(), zoom: main.getZoom(), bearing: main.getBearing(), pitch: main.getPitch(),
      });
      a.on("load", () => setLoadedA(true));
      a.on("error", (e) => { if (e.error?.name !== "AbortError") console.error(e.error); });
      mapARef.current = a;
    } else {
      mapARef.current.resize();
      mapARef.current.jumpTo({ center: main.getCenter(), zoom: main.getZoom(), bearing: main.getBearing(), pitch: main.getPitch() });
    }
  }, [swipeOn]);
  useEffect(() => {
    if (!loadedA || !ds) return;
    addOverlayLayers(mapARef.current, ds.m.corners, opacity);
    mapARef.current.setLayoutProperty("change", "visibility", "none");
    mapARef.current.setLayoutProperty("wdiff", "visibility", "none");
    mapARef.current.setLayoutProperty("x0", "visibility", "none");
    mapARef.current.setLayoutProperty("x1", "visibility", "none");
    mapARef.current.setLayoutProperty("rivers", "visibility", "none");
    setReadyAId(ds.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedA, ds]);
  const readyA = ds && readyAId === ds.id;
  useEffect(() => {
    if (!readyA || !swipe) return;
    const main = mapRef.current;
    mapARef.current.resize();
    mapARef.current.jumpTo({ center: main.getCenter(), zoom: main.getZoom(), bearing: main.getBearing(), pitch: main.getPitch() });
    setImage(mapARef.current, "radar", swipe.url, swipe.corners ?? ds.m.corners);
    setGeo(mapARef.current, "water", swipe.water);
    setOptical(mapARef.current, swipe.opticalTiles);
  }, [readyA, ds, swipe]);

  // shared paint/layout options
  useEffect(() => {
    for (const m of [mapRef.current, mapARef.current]) {
      if (m?.getLayer("radar")) m.setPaintProperty("radar", "raster-opacity", opacity);
    }
  }, [opacity, ready, readyA]);
  useEffect(() => {
    for (const m of [mapRef.current, mapARef.current]) {
      if (m?.getLayer("lbl")) m.setLayoutProperty("lbl", "visibility", showLabels ? "visible" : "none");
    }
  }, [showLabels, loaded, loadedA]);

  // 3D terrain: radar and overlays are draped over real elevation
  useEffect(() => {
    const main = mapRef.current, a = mapARef.current;
    if (!loaded) return;
    main.setTerrain(terrain ? { source: "dem", exaggeration: 1.4 } : null);
    // the hidden swipe map must not render terrain in the background
    if (a?.getSource("dem")) a.setTerrain(terrain && swipeOn ? { source: "dem", exaggeration: 1.4 } : null);
    // 3D on a Retina screen draws 4x the pixels; render at 1x while tilted to stay smooth
    const ratio = terrain ? 1 : window.devicePixelRatio;
    for (const m of [main, a]) if (m && m.getPixelRatio() !== ratio) m.setPixelRatio(ratio);
  }, [terrain, loaded, loadedA, swipeOn]);
  // tilt the camera only when 3D is actually switched on or off (never on first load,
  // where a running camera animation would fight the jump to the site)
  const tilted = useRef(false);
  useEffect(() => {
    if (!loaded || tilted.current === !!terrain) return;
    tilted.current = !!terrain;
    if (!terrain) setOrbit(false);
    mapRef.current.easeTo({ pitch: terrain ? 60 : 0, bearing: terrain ? -25 : 0, duration: 1200 });
  }, [terrain, loaded]);

  // orbit: rotate slowly around the centre of the view
  useEffect(() => {
    if (!orbit) return;
    const map = mapRef.current;
    let raf, last = performance.now();
    const step = (t) => {
      map.setBearing(map.getBearing() + ((t - last) / 1000) * 9); // 9 degrees per second
      last = t;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [orbit]);

  const turn = (dBearing, dPitch) => {
    const map = mapRef.current;
    setOrbit(false);
    map.easeTo({
      bearing: map.getBearing() + dBearing,
      pitch: Math.max(0, Math.min(75, map.getPitch() + dPitch)),
      duration: 500,
    });
  };

  // clicked point marker
  useEffect(() => {
    const mk = markerRef.current;
    if (!mk || !mapRef.current) return;
    if (point) mk.setLngLat(point).addTo(mapRef.current);
    else mk.remove();
  }, [point]);

  // the answer about a clicked place floats next to it (React content rendered into a map marker)
  const [popEl] = useState(() => {
    const el = document.createElement("div");
    el.className = "map-pop";
    // clicks and scrolls inside the card must not reach the map (or they would pick a new place)
    for (const ev of ["mousedown", "mouseup", "click", "dblclick", "touchstart", "touchend", "wheel", "pointerdown"]) el.addEventListener(ev, (e) => e.stopPropagation());
    return el;
  });
  const popRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    popRef.current?.remove();
    if (!point || !popup) return;
    // open towards the roomier side, so the card never hides under the panel or below the timeline
    const p = map.project(point), c = map.getContainer();
    const right = p.x > c.clientWidth * 0.55, low = p.y > c.clientHeight * 0.45;
    const anchor = `${low ? "bottom" : "top"}-${right ? "right" : "left"}`;
    popRef.current = new maplibregl.Marker({ element: popEl, anchor, offset: [right ? -18 : 18, low ? -30 : 4] }).setLngLat(point).addTo(map);
  }, [point, popup, popEl, loaded]);

  // swipe handle dragging
  const dragging = useRef(false);
  const onMove = (e) => {
    if (!dragging.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setSwipeX(Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)));
  };

  return (
    <section className="mapwrap" ref={wrapRef}>
      <div ref={mainEl} className="mapfill" />
      <div
        ref={aEl}
        className="mapfill mapA"
        hidden={!swipeOn}
        style={{ clipPath: `inset(0 ${(1 - swipeX) * 100}% 0 0)` }}
      />
      {swipeOn && (
        <div
          className="swipe"
          style={{ left: `${swipeX * 100}%` }}
          onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={onMove}
          onPointerUp={() => (dragging.current = false)}
          role="slider"
          aria-label={t("divider")}
          aria-valuenow={Math.round(swipeX * 100)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setSwipeX((x) => Math.max(0.02, x - 0.05));
            if (e.key === "ArrowRight") setSwipeX((x) => Math.min(0.98, x + 0.05));
          }}
        >
          <span />
        </div>
      )}
      {badge && <div className="badge">{badge}</div>}
      {terrain && (
        <div className="ctl3d" aria-label={t("ctl3d")}>
          <button onClick={() => turn(-30, 0)} title={t("rotL")}>⟲</button>
          <button onClick={() => turn(30, 0)} title={t("rotR")}>⟳</button>
          <button onClick={() => turn(0, 12)} title={t("tiltMore")}>⤓</button>
          <button onClick={() => turn(0, -12)} title={t("tiltLess")}>⤒</button>
          <button className={orbit ? "on wide" : "wide"} onClick={() => setOrbit((o) => !o)} title={t("flyTitle")}>
            {t(orbit ? "stop" : "fly")}
          </button>
        </div>
      )}
      {children}
      {popup && createPortal(popup, popEl)}
    </section>
  );
}
