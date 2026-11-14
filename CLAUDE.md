# NISAR Surface Pulse: notes for Claude

NASA Space Apps Challenge 2026, NISAR surface-change challenge (event starts 2026-11-14).
Team CIFARSOFT from Tajikistan. Ismoil is the frontend developer; he writes Tajik in Latin script, so reply in Tajik (Cyrillic).
A teammate prepares the NISAR data (Python) and hands it over as zips in the project root.
Murodbek is the team member to whom InSAR was explained; he may prepare InSAR data later.

**Goal:** someone with no radar knowledge must understand what changed, where and why. Judges score accessibility, storytelling and scientific validity.

Full history, decisions and open questions: [docs/PROJECT_LOG.md](docs/PROJECT_LOG.md).
Science checked against NASA resources: [docs/NASA_RESOURCES.md](docs/NASA_RESOURCES.md).

## Stack and run
- React 18.3.1 + Vite 5.4.11, maplibre-gl 4.7.1, chart.js 4.4.1, react-router-dom 6.28.0 (added 2026-11-14 with the user's OK). No other runtime dependencies.
- `npm run dev`, then Cmd+Shift+R in the browser. `npm run build` must pass before finishing any change.
- Data scripts: `npm run optical -- <site>`, `npm run context -- <site>`, `npm run insar -- <site>`, `sh scripts/rgb-webp.sh <site>`.
- New NISAR dates (Python venv with numpy h5py pillow fsspec aiohttp pyproj tifffile imagecodecs scipy scikit-image): `scripts/nisar_gcov.py` (pictures, `--check` against existing PNGs), `scripts/nisar_water.py` (lake outlines, `--calibrate` first), `scripts/nisar_farm.py`. Always reproduce an existing date before adding new ones, and report the agreement.

## Design (2026-11-14 redesign)
- Routes (HashRouter, because `base: "./"` must work on GitHub Pages): `#/` landing, `#/map/<water|motion|crops|flood>?<view>` map (`src/lib/routes.js`). Old `#site=…` links are converted in `main.jsx`.
- Map page = layout A (chosen by the user): full map; story chips top-left; view bar + timeline dock at the bottom; right "answer" panel with tabs What changed / Why / Can we trust it / What to do / Lab; one step-by-step **Guide** (replaced the old tour + scroll story); place answers float next to the click; phone = bottom sheet. Parts in `src/components/Stage.jsx`.
- App look lives in `src/app.css`, loaded after `src/styles.css` (tokens: ink #04060b, accent lime #c6ff3d). Timeline dock on the map in "Watch it happen".
- Fonts: **Geologica** (headings) + **Onest** (text). Both render Tajik ҳ ҷ ӣ ӯ қ ғ. Unbounded, Rubik and Manrope do NOT (they fall back to a serif); `document.fonts.check` wrongly says they do, so check a screenshot before changing fonts.

## Sites (src/lib/nisar.js `SITES`)
- `vakhsh_cascade`: Rogun + Nurek in one frame (water site, per-reservoir areas in `dates[].reservoirs`).
- `vakhsh_cascade` also has `motion/` (InSAR ground movement, layer "Ground movement", MotionCard).
- `vakhsh`: Vakhsh valley farmland, Khatlon (farm site, `manifest.farmland`: HV/HH medians over ~696 km² of flat fields; no water outlines). Not a Rogun duplicate.
- `nepal`: Bhote Koshi–Trishuli flood of 2026-08-26 (event site, `manifest.event`, no water outlines).
  `event.closeup` → `nepal/closeup/`: 10 m before/after composites of the lower valley (Betrawati–Galchhi) + flood/hidden/seasonal overlays.
- Do NOT add Rogun again as a separate site: the user does not want duplication. The old single-lake data (`data-archive/`) was moved to the Trash on 2026-11-14. A second-orbit Rogun series (track 84) is shown inside the water story (`orbit84.json`), not as a site.

## Rules
1. **Three languages, always.** Every user-facing string goes into `src/lib/i18n.jsx` or `src/lib/i18n-extra.js` (and site text into `src/lib/stories.js`) in `en`, `ru` and `tg`. Never hard-code text. Same `{placeholders}` in all three.
2. **Tajik terms:** "обхезӣ" = flood, "сел" only for a real mudflow, "дБ" not "dB", "кӯл" for lake, polite imperative ("-ед"/"диҳед").
3. **Science must match NASA sources** (docs/NASA_RESOURCES.md). Our method is backscatter amplitude (GCOV). Ground movement in centimetres (landslides, dams, earthquakes, glaciers) is InSAR (phase, GUNW); never say our amplitude map does that. The only real InSAR we have is `vakhsh_cascade/motion/` (team GUNW stack, 8 pairs, PRELIMINARY: dam within ±3 cm, one slope +11.6 cm LOS, a few small patches incl. near the dam site); keep its caveats.
4. **Be honest about limits:** data are PROVISIONAL; 60 m pixels averaged from 10–20 m; NISAR data gap 2026-07-27..08-10; in Nepal most brightening is seasonal; at 60 m the sure flood signal is about 0.3 km² of mud near Betrawati, the 10 m close-up shows 1.9 km² wetter channel vs 0.8 km² in the quiet test (~2.5×); farmland "harvested" 25 km² are candidates only.
5. **Pixel geometry:** the radar grid is regular in UTM (`epsg_source`). Use `toPixF` / `pixelToLonLat` in nisar.js (exact UTM); never go back to a lon/lat affine fit (it was off by up to 12 px).
6. Dam facts and their sources live in `STORIES.vakhsh_cascade.facts`; do not add numbers without a source.
7. New Map/UI features must be checked in a real browser (see below), in at least one non-English language.

## Browser verification
Headless Chrome with `--virtual-time-budget` gives false failures. Drive real Chrome over the DevTools protocol instead
(`--headless=new --use-angle=metal`, real time, click and evaluate). The driver script lives in the session scratchpad
and may be gone; it is a ~70-line Node script using `fetch` to `/json` and a WebSocket (`Runtime.evaluate`,
`Page.captureScreenshot`, `Input.dispatchMouseEvent`). Rewrite it if needed. `VIEW=390x800` tests the phone layout.

## Shell gotchas
zsh does not word-split `$VAR`; pass flags inline. Use `"${OUT:?}"` with rm.
