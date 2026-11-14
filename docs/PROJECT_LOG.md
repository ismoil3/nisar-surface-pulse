# Project log

What has been built, why, and what is still open. Newest decisions first within each section.
Last updated: 2026-11-13.

## What the app does
- Two stories, each in English, Russian and Tajik:
  - **Rogun and Nurek, Tajikistan.** A gradual change: two reservoirs fill in summer.
    - Nurek grew from 74.3 to 89.7 km² and Rogun from 13.9 to 20.0 km².
    - Rogun's estimated water level rose from 1,115 to 1,128 m (±10 m).
  - **Bhote Koshi–Trishuli, Nepal.** A sudden change: a flood on 2026-08-26 under monsoon cloud.
- Views:
  - **What changed?** New water in orange (Vakhsh), or a before/after flood map on valley floors (Nepal).
  - **Watch it happen.** Play the passes like a film.
  - **Before / after.** Swipe between two dates, or "Camera vs radar" (photo and radar of the same pass).
  - **Signal change** (Expert only).
- Picture choices:
  - Radar HH.
  - Radar colour.
  - Real photo: NASA HLS within ±6 days, with a cloud warning above 30%.
  - Radar HV (Expert).
  - **Wave comparison (InSAR)** (Expert): ASF browse picture of a NISAR GUNW interferogram.
- Guided tour (7 steps) and a scroll story (9 chapters). Click any place for a plain verdict and its history.
- The "Which channel is best?" card answers the challenge's polarization question with numbers, and cites NASA's flood StoryMap (HH is best for water).
- **About the data** lists the method, limitations, dam facts with sources, all 14 challenge resources with how each was used, and the granules.

## Challenge requirements and where they are met
| Requirement | Where |
|---|---|
| Why does the surface change? | Story "Why", tour step 6, place verdicts |
| Which polarization is best? | PolCard / EventPolCard (measured HH vs HV + NASA citation) |
| Future NISAR uses | "What else can NISAR do?" (7 items) + InSAR picture |
| Change maps, time series, before/after slider, story map | Views above |
| Polarizations + optical | HH/HV/colour + HLS photo + camera-vs-radar |
| Ancillary layers | OpenStreetMap rivers, villages with population, dams; 3D terrain |
| Human impact, personal context | "We are from Tajikistan", resettlement, electricity, villages near water |

## Key decisions
- **2026-11-14: cloud-free before / after photos for the Nepal flood.** The HLS photos within ±6 days of the 13 radar passes are 12–92% cloud (monsoon), so the camera swipe showed only clouds. `scripts/find-clear-pair.mjs nepal` scores every HLS S30 and L30 day from 1 Mar to 12 Nov on the 10 m close-up area (zoom 10 tiles, same cloud rule as find-optical): 75 days with full cover; clearest before = 24 May (1.5%, 94 days before), after = 21 Sep (2.2%, 26 days after); among photos within 2% cloud the one closest to the event wins. The map uses this pair automatically in "before / after" + "real photo" on event sites, says so in the badge, and can switch back to the per-date photos. Also fixed: two-date views could open with A = B (e.g. `a=0&b=0`).
- **2026-11-14: data audit (every date, every headline number). Three corrections.**
  - Checked for all 35 pictures: granule name matches date / track / frame, 12-day spacing (24 days only across NISAR's gap), files exist, ≥ 99.8% valid pixels; lake outlines rasterize to the stated areas within 0.3 km²; optical photos within ±6 days.
  - **Nurek on 6 Nov (85.1 km²) is probably rough water, not a lower lake.** That pass followed rain (POWER: 12 mm in three days): the always-water core is 2.8 dB and the shore land 2.4 dB brighter in HH than on 25 Oct. With both thresholds raised by 2 dB the outline is 88.1 km² (25 Oct: 88.1). The value is flagged (`reservoirs.nurek.flag`, `area_km2_adj`) and no text says "released" any more.
  - **"Harvested area doubled" was not supported.** The 3 dB test compares VALIDATED passes with a PROVISIONAL summer peak. Adding +0.2 dB (the HV offset we measured) gives 40.9 km², +0.6 dB gives 27.9 km²; 13 Oct was 26.3 km²; 17 of the 54 km² are single pixels. The app now shows 28–54 km² (`farmland.harvested_km2_min`).
  - **Nepal's first 8 passes are from the experimental release (X05026), not PROVISIONAL** as the manifest said (X = eXperimental in NASA's CRID list). ASF has PROVISIONAL versions for 20 Jun–12 Sep; we streamed the 19 Aug one (`scripts/nisar_gcov.py --check`, 2 min) and it is identical on our grid after the 0 dB clip, so the team's pictures and flood maps stand. About now says so. 8 Jun exists only as X05026.
  - Rogun's rise is no longer read across two orbits (track 12: 1115 → 1128 m; track 84: 1118 → 1131 m). Nurek dates corrected to 1961–1980 (first power 1972).
  - Seen, not an error: the whole Rogun–Nurek frame is about 2 dB brighter on 13 Oct and 6 Nov (wet ground after rain). Change maps that use these dates show wide brightening that is weather.
- **2026-11-14: four signature features, so the project is not a copy of the other teams' ideas** (we read 16 competing READMEs; before/after sliders, timelines and "honest limits" are everywhere).
  - **"One river, one pulse" (`#/river`, River.jsx):** the long profile of the Vakhsh, 256.5 km, 1179 → 368 m. `scripts/river_profile.py` chains 18 OSM ways (joins with gaps 0.74, 0.3, 0.07 km), samples the Copernicus DEM (lowest value within 90 m, non-rising downstream; this changed the raw DEM by < 0.3 m for 95% of points) and snaps six dams. The lakes and the fields share the same track-12 passes, so one timeline moves the Rogun level, the Nurek area and the crop HV median.
  - **Nurek level cannot be estimated:** the DEM shows Nurek as a flat lake at 900 m with 89 km²; our areas (74–90 km²) are mostly below that, so the shoreline was under water when the DEM was flown. We show Nurek's area only and draw its bottom as a guess (dashed). Rogun's level works because the DEM predates the filling.
  - **NASA POWER weather** (`scripts/find-climate.mjs`, three ~50 km cells): upper basin (cell at 3,368 m) July–August mean +11.8 °C and 22 mm rain; −2.9 °C in the 12 days before 6 Nov. Valley July–September 3 mm rain at about 30 °C. Nepal: 2.4 mm on the flood day plus the day before, against 45.6 mm on the wettest day. One value (3 Jun, 349.5 mm in a day, next highest 24.5) is treated as a model artefact: kept in `suspect`, not drawn, and said so under the chart.
  - **Sound:** one heartbeat per pass; loudness = mean |HH change| since the previous pass (every 37th pixel), tone = lake area or crop HV. Off by default.
  - **One-page report** (`#/report/<story>`): prints to exactly one A4 page for all four stories in tg and ru (checked with `Page.printToPDF`); pictures are redrawn at 760 px so a PDF is under 1 MB.
  - README has a "Use of AI" section (required by Space Apps).
- **2026-11-14: newest NISAR passes added with the team's method, reproduced and checked first** (Earthdata login in ~/.netrc).
  - `scripts/nisar_gcov.py` cuts a GCOV granule (local .h5 or streamed from ASF) to a site grid: 3x3 mean of the 20 m gamma-0 power → 60 m, same 8-bit dB encoding and RGB. Check on 13 Oct (same granule as the team): HV r = 0.9986, HH identical except pixels brighter than 0 dB, which the PNG format clips (the team's files clip them too).
  - `scripts/nisar_water.py`: the team's lake rule (dark in HH and HV, Copernicus DEM height range, connected to the lake); thresholds learned from the team's 9 outlines. Nurek: IoU 0.959, area within -2.4…+2.0 % on every date → used for 25 Oct and 6 Nov (88.0, 85.1 km²; possibly the start of the winter release, near the method's uncertainty, said so in the app). Rogun: IoU 0.86 and up to -20 % on the latest dates → NOT used; Rogun's newest values come from the team's second-orbit package (track 84, to 11 Nov, `orbit84.json`, card "A second orbit confirms it").
  - `scripts/nisar_farm.py`: the team's farmland rule (slope < 2°, median HH −16…−4 dB). Reproduces the team's medians within 0.10 dB (HV) / 0.14 dB (HH) and "fell sharply" 26.3 vs 25.1 km². New: by 6 Nov 54.1 km² (7.8 %) fell sharply, twice the 13 Oct value.
  - Lakes outlined on only some dates are left out of two-date comparisons (`commonLakes` in nisar.js), so a missing Rogun outline never shows as "water gone".
  - VALIDATED passes (CRID ≥ P05036) are marked ◆ on the timeline and explained in About.
  - Full granules are in `data-raw/` (gitignored); aria2 is installed (`data-raw/aria_all.sh`), but the line is ~4–5 MB/s, so the site footprints are also cached as `data-raw/cache/*.npz`.
- **2026-11-14: Nepal extended to 11 Nov; processing-version check.**
  - Nepal 18 Oct rebuilt from the full granule: 100 % of pixels identical to the team's PNGs after 8-bit encoding (their no-data rule = no valid source pixel; script changed to match). 30 Oct and 11 Nov (VALIDATED) added: 13 dates. The flood map and its numbers stay the team's (6 before / 5 after).
  - `scripts/nisar_crid_check.py`: the 30 Oct pass exists as UR/P05023 and PR/P05036. Same 20 x 20 km window: at 600 m the new version is −0.6 dB (HH) and −0.2 dB (HV); best whole-pixel shift 2 px (20 m) east-west; at 10 m per pixel r is only 0.48 (speckle + shift). The old one is an urgent-response product, so part of the shift is its rapid orbit.
  - Consequences: Nurek's fall 88.0 → 85.1 km² is against the direction of the version bias (darker HH would add water), so it is not a software effect. The farmland HH step after 13 Oct (−0.4 dB) is about the version offset and must not be read as real.
- **2026-11-14: old files moved to the Trash** (`~/.Trash/nasa-app-old-20261114-1658/`): integrated zips, `data-archive/`, `README_for_Ismoil.md`, `Tour.jsx`, `StoryScroll.jsx`.
- **2026-11-14: map page rebuilt as layout A after a UX review** (answer first, one guide instead of tour + story, four stories as chips, place card next to the click, expert tools in a Lab tab, phone bottom sheet). Routes via react-router-dom (HashRouter): `#/map/water`, `/motion`, `/crops`, `/flood`; back/forward works.
- **2026-11-14: full redesign.**
  - New landing page: hero where a radar beam sweeps clouds off a real NISAR picture (the core idea: radar sees through clouds), "how radar sees" (water / rock / plants animations), four story cards with numbers computed from the data, a 10 m before/after flood slider, NISAR facts (12 days, 24 cm, 240 km), "Made in Tajikistan" and an honest-limits box. All text in en/ru/tg.
  - App: two-row top bar (actions; site pills with icons), rounded map, glass cards, mode buttons with icons, a video-player timeline dock on the map. The old welcome card is off (the landing page replaces it).
  - Fonts tested with Tajik letters in Chrome: Geologica + Onest chosen; Unbounded, Rubik, Manrope rejected (missing Tajik glyphs).
- **2026-11-14: every point of the NASA challenge text is now covered in the app** (list in About → "How this page answers the NASA challenge", 11 items).
  - InSAR ground movement for Rogun from the team's `rogun_insar` package: layer "Ground movement" (coherence base + ≥3 cm overlay, 80 m), MotionCard (slope vs dam chart, ±2 cm noise band), story chapter, About row. `displacement_los.png` deliberately not used (terrain-following troposphere). Caveat added for small ≥3 cm patches next to the dam site.
  - Dashboard (top button): one tile per site with KPIs and sparklines (light CSV/JSON only), plus rule-based "What needs attention" notes (slope > 3 cm, lake > +10%, biggest flood scar, harvest share).
  - "What can people do with this?": four audiences per site (managers, decision-makers, scientists, teachers/public), in the cards and the last story chapter.
  - MIT `LICENSE`; units in new components translated (дБ, см).
  - Date strip / ◀ ▶ in "What happened at this place?" move the whole map date by date; loaded sites stay cached in memory; frames pre-rendered in idle time.
- **2026-11-13 (night): independent check against ASF's own pictures** (`scripts/asf-browse.mjs` + `scripts/check-asf.mjs`, no login).
  - ASF serves public per-channel browse PNGs (`*_NATIVE_A_HHHH.png`, `*_HVHV.png`, 170–180 m, UTM, footprint in `*_NATIVE.kml`). They are auto-stretched per image, not dB.
  - Vakhsh cascade, 13 Oct: our HH vs ASF r = 0.74, HV r = 0.75, best match at zero shift (10 m search step). Farmland: HH 0.78, HV 0.82, best within ~70 m.
  - Nepal: pixel correlation is meaningless (ASF browse is dominated by black shadow / white layover, ours is terrain-flattened). Dark river channels match best at zero shift, five times worse 600 m away.
  - Lake areas from ASF pictures (relative threshold fitted to our 13 Oct outline, IoU 0.76 Nurek / 0.69 Rogun): Nurek 88.0 / 91.4 / 94.7 / 90.9 km² (7 Sep–13 Oct) vs ours 88.6–89.7 (1–7%); Rogun 17–19 vs ours 19–20 (narrow canyon lost at 180 m).
  - A fixed threshold claimed Nurek shrank to 72 km² on 6 Nov. That was the per-image stretch, not the lake; with the relative threshold Nurek is ~89 km² and Rogun ~18 km² on 25 Oct and 6 Nov. Not added to the app as data (browse is not calibrated); mentioned in the About "Independent check" line.
- **New NISAR passes found (2026-11-13, ASF search):**
  - Track 12 / frame 21 (both Tajik sites): 2026-10-25 and 2026-11-06, `NISAR_L2_GCOV_V1` (VALIDATED, CRID P05036).
  - Track 98 / frame 16 (Nepal): 2026-10-30 (VALIDATED), 2026-11-11 (urgent-response "UR" product only so far).
  - GIBS layer `NISAR_L2_Geocoded_Polarimetric_Covariance` exists in the WMTS capabilities (a global daily mosaic, picture only).
- **2026-11-13 (evening): three new data packages from the data team added.**
  - `vakhsh_cascade`: rasters and outlines identical; merged `story` numbers and per-date flags into the manifest. The two-orbit cross-check (track 84 gives the same Rogun/Nurek change) is now a caveat in all three languages. The ready-made `change_water_*.png` was not copied: the app draws the same gain/loss map itself.
  - New site `vakhsh` (farmland test): FarmCard (HV/HH medians + p25–p75 band), FarmPol (HV is the plant channel), farm verdict on click, 6-step tour, 10-chapter story. Tour field spot [68.75129, 37.92274] (HV −19.0 → −14.4 dB). Harvest wording: the 25 km² figure is from the per-field peak test, not the Sep→Oct change map (which shows ~1.8 km²).
  - `nepal_lower` became a **10 m close-up inside the Nepal site** (it has no per-date rasters, so it cannot be its own site): `event.closeup` → `nepal/closeup/closeup.json`; display PNGs converted to WebP q75 (3–4 MB each, full 10 m). New tour step and story chapter. Numbers: 1.94 km² wetter channel, 0.27 km² debris, control 0.77 km², seasonal 4.34 km² (not counted).
  - The "pretty" PNGs (hero, before/after, places, summaries) have English text baked in, so they are NOT in the app (rule 1). Use them in slides.
  - Checked in Chrome: Nepal close-up (tg), farmland tour (ru), farmland on phone 390×800 (tg), Nepal story (en), cascade (ru).
- **2026-11-13: InSAR added as a picture only.**
  - ASF serves public browse PNGs of NISAR GUNW products without a login, and `scripts/find-insar.mjs` resamples one onto the site grid.
  - Pairs used: Vakhsh 2026-10-01 → 10-13; Nepal 2026-08-19 → 08-31.
  - No millimetre values are computed. That needs the HDF5 product (Earthdata login), many pairs and an atmosphere correction.
  - Both lakes appear as speckle, which independently confirms our water outlines.
- **2026-11-13: pixel mapping switched from a lon/lat affine fit to exact UTM.**
  - The old fit was off by up to 12 px (730 m) at the SE corner of Vakhsh.
  - HH/HV clarity scores changed to 3.61 vs 3.38; HH still wins.
- **2026-11-13: Nepal "29× above noise" rewritten.**
  - 7.5 of the 8.5 km² is seasonal brightening.
  - The honest headline is darker ground: 1.0 km² vs 0.3 km² in the quiet test (about 3×).
- **2026-11-13: text audited against NASA sources** by three subagents (science, method, translations). Fixes:
  - HH physics: rough ground scatters part of the signal back; it is not "straight back".
  - InSAR vs amplitude kept separate in the text.
  - Flooded trees look bright.
  - PROVISIONAL / VALIDATED status.
  - Tajik terminology.
- **2026-11-13: dam facts sourced** and shown in About:
  - Nurek: 300 m, built 1972–1980, tallest dam until 2013.
  - Share of national electricity: from about half to 70%, depending on the source.
  - Rogun: planned 335 m; up to 42,000 people resettled.
- **2026-11-12: Rogun-only site replaced by the Vakhsh cascade** (Rogun + Nurek in one frame); Nepal added as an event site.
  - RGB pictures converted to WebP; data went from 117 MB to about 61 MB.
- **2026-11-12: real-photo playback** preloads every date's HLS layer and waits until the next one has loaded, so frames are complete.
- **2026-11-12: trilingual UI (EN / RU / TJ).**
  - The language is remembered in localStorage and in the link (`lang=`).
  - OSM names are transliterated to Cyrillic; Chinese-script names fall back to English.

## Data layout
- **Vakhsh** (`public/data/<site>/`, same layout for every site):
  - `manifest.json`
  - `*_HH.png` and `*_HV.png` (8-bit, dB = −35 + (v−1)·35/254, alpha 0 = no data)
  - `*_RGB.webp`
  - `water_*.geojson`
  - `optical.json`, `context.json`
  - `insar.png` + `insar.json`
- **Nepal:** no water outlines. Instead it has `manifest.event`:
  - before/after dates
  - `flood_map_HH_valleys.png`
  - `flood_timeseries.csv`
  - the polarization test
  - the interpretation

## Open questions and team to-dos
1. **Ahmad's photos/video:** put the files in `public/team/` and list them in `media` in `src/lib/stories.js`.
2. **Native speakers** should read the Russian and Tajik text. Words to check: "наворбардорӣ", "тафсилоти тасвир", "Парвоз дар гирд".
3. **Nepal granules (answered 2026-11-14):** `X05026` = experimental release; PROVISIONAL versions exist for 20 Jun–12 Sep and the one we checked is identical. Optional: restream the other six (`data-raw/nepal_p_urls.txt`, 2 min each) to confirm all of them.
4. **InSAR (done 2026-11-14, preliminary):** confirm the creeping slope (38.7634 N, 69.9185 E) from a second orbit (e.g. the descending track 020 / frame 069) and decide what the small patches next to the dam site are.
5. **Validated data:** NISAR VALIDATED products exist from 2026-10-21. New passes would lengthen the series.
6. **Possible extra validation:** compare the lake areas with NASA OPERA DSWx (30 m water maps; needs an Earthdata login).
7. **Farmland mask (data team):** a PNG of the farmland mask and of the 25 km² "fell sharply" pixels would let the map show exactly what the numbers count.
8. **VALIDATED passes (data team, needs Earthdata login):** HH/HV GCOV for 2026-10-25 and 2026-11-06 (track 12/21) and 2026-10-30 (track 98/16), via Harmony or asf_search, same 60 m grid. They use CRID P05036 while our series is P05023, so show them as a separate "VALIDATED" step and do not compute change across the two versions without saying so.
9. **Not done yet:**
   - The radar picture on the map can sit up to 3 px (180 m) off, because MapLibre draws it with a 4-corner warp; the calculations are exact.
   - The Expert "signal change" map has no terrain mask.
   - No test on a real phone.
