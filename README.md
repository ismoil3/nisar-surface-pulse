# NISAR Surface Pulse

**Live app: https://ismoil3.github.io/nisar-surface-pulse/** · Code: https://github.com/ismoil3/nisar-surface-pulse · Team CIFARSOFT (Tajikistan)

An open-source web app that turns NISAR L-band radar into a story anyone can explore.
The app tells four stories from NISAR L-band radar, in English, Russian and Tajik:

- **Rogun and Nurek, Tajikistan** (gradual change). Two reservoirs on the Vakhsh River in one radar frame. Between 27 June and 13 October 2026 Nurek grew from 74.3 to 89.7 km² and Rogun, still under construction, from 13.9 to 20.0 km²; the estimated Rogun water level rose from about 1,115 m to 1,128 m (±10 m).
- **Ground movement at Rogun** (InSAR, preliminary). Eight 12-day NISAR GUNW pairs: the dam area stays within about ±3 cm; one 0.36 km² slope crept +11.6 cm along the radar line of sight.
- **Vakhsh valley farmland, Tajikistan** (crops). Over ~696 km² of flat fields the plant echo (HV) rose 1.3 dB from June to September; by 6 November 28–54 km² (4–8%) dropped sharply: candidate harvested fields (a range, because the newest passes come from a newer processing version).
- **Bhote Koshi–Trishuli, Nepal** (sudden change). A rock-ice avalanche and flood on 26 August 2026, mapped under monsoon cloud. Right after the flood the HH echo near Betrawati fell by 4.3 dB and stayed low (mud and debris, about 0.3 km²). The app also shows what is *not* the flood: most of the brightening is the river shrinking after the monsoon.

**Camera vs radar:** in the before/after view a visitor can slide between an ordinary satellite photo and the radar picture of the same pass. Over Nepal the photo is mostly cloud; the radar shows the valley floor, except where steep walls hide it.

Built by team **CIFARSOFT** (Tajikistan) for the 2026 NASA Space Apps Challenge, challenge "Dancing with the SARs".

**Team:** _(add member names and roles before submitting)_

## How the app answers the challenge

| Challenge asks | Where it is in the app |
|---|---|
| Why does the surface change? | "Why" tab: physical and human drivers, weather from NASA POWER, "What can the radar miss?"; the Guide |
| Which polarization shows the change best? | "Which radar channel shows the change best?" card: HH and HV measured live on the pixels that turned from land to water (echo drop, land–water gap, separability d′) |
| Future applications of NISAR | "What else can NISAR do?" (floods, landslides, glaciers, farming, infrastructure, earthquakes) in the "What to do" tab |
| Interactive change-detection maps | What changed? (new / lost water) and the expert Signal change map with a dB threshold |
| Time-series animation | Watch it happen: timeline + Play, 11 passes for Vakhsh and 13 for Nepal (to 11 Nov 2026, the newest VALIDATED) |
| Dashboard | **Dashboard** button: every site with KPIs, sparklines and automatic "What needs attention" notes; plus the charts in each card |
| Land deformation | **Ground movement** layer (InSAR, Rogun): dam stable within ±3 cm, one creeping slope +11.6 cm |
| Agriculture | Vakhsh valley farmland: HV growth curve, harvest test, click a field for its own verdict |
| Actionable insights | "What can people do with this?" for managers, decision-makers, scientists, teachers and the public |
| Open source | MIT licence (`LICENSE`); NISAR data free from NASA / ASF |
| Image slider | Before / after swipe (radar or photo) |
| Story map | The step-by-step **Guide** (each step moves the map), the **One river** page (`#/river`) and the one-page reports |
| Polarizations and other sensors | HH / HV / colour composite; optical photos (NASA HLS) per pass and, for the Nepal flood, the clearest photo before and after |
| Ancillary data | Rivers, towns and villages with population, and the dam from OpenStreetMap (`npm run context -- <site>`); 3D terrain |
| Human drivers | Vakhsh: two lakes created by dams, settlements within 3 km of the water. Nepal: villages, road and hydropower plants on the valley floor in the flood path |
| Personal context | "Made in Tajikistan" on the landing page: the Vakhsh is our own river; the app speaks Tajik and Russian as well as English |

## Made for people who have never seen radar data

- Opens with a landing page that explains how radar sees water, rock and plants, then a step-by-step Guide on the map.
- **Simple** mode (default) uses plain words only: "What changed?", "Watch it happen", "Before / after"; pictures are called "Radar", "Radar colour", "Real photo", each with a colour key.
- Clicking the map answers "What happened at this place?" in a sentence plus a water/land strip per date.
- **Expert** mode adds HH / HV channels, the dB signal-change map with a threshold, and the backscatter chart.

## Features

- **One river, one pulse (`#/river`):** the Vakhsh seen from the side, 257 km from above the Rogun lake to the cotton fields (river line from OpenStreetMap, heights from the Copernicus DEM). One timeline moves the Rogun level, the Nurek area and the crop signal together, with the mountain temperature from NASA POWER. No other view in the app links the sites; this one shows why they belong together.
- **Hear the pulse:** every satellite pass is one heartbeat (Web Audio, no files). Louder = more of the picture changed since the last pass; the tone follows the lake area or the crop signal. Off by default.
- **Weather check (NASA POWER):** daily air temperature and rain next to the NISAR passes in the "Why" tab: melt, not rain, fills the lakes (July–August +11.8 °C and 22 mm high in the basin); the fields get 3 mm of rain in three months, so they live on the river; the Nepal flood day had almost no rain.
- **One-page report (`#/report/<story>`):** a printable A4 summary in three languages for people who decide: the main sentence, pictures, numbers pass by pass, why, what to do, how sure we are, sources. "Save as PDF" is the browser's print.
- **Single date + time-lapse:** 11 (Vakhsh) or 13 (Nepal) NISAR acquisitions, 12-day repeat with one pass missing in NISAR's July–August 2026 data gap. Use the timeline or the ▶ button (or press Space).
- **HH / HV / Color:** switch polarizations: HH shows surface and double-bounce echoes (water, bare ground, flooded trees), HV shows volume echoes from plants.
- **Before / after swipe:** drag the handle to compare any two dates.
- **Change map:** computed live in the browser. Speckle-filtered (3×3, linear power) dB difference, adjustable threshold, area in km².
- **Water outline + area chart:** reservoir extent per date, with an automatic text insight.
- **Point inspector:** click the map to get an HH/HV time series and a plain-language interpretation ("flooded since 14 Aug").
- **Story and About panels:** hypotheses on the physical drivers, data provenance, granule IDs, limitations.
- **Shareable links:** the URL hash keeps site, mode, dates, and polarization.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (works on GitHub Pages)
npm run preview    # serve the built site
```

Stack: React 18 + Vite 5, MapLibre GL 4.7, Chart.js 4.4.

## Project layout

```
public/data/vakhsh_cascade/  Rogun + Nurek: NISAR pictures, lake outlines, motion/ (InSAR), orbit84.json (second orbit)
public/data/vakhsh/          Vakhsh valley farmland: NISAR pictures, farmland_timeseries.csv
public/data/nepal/           Nepal flood: NISAR pictures, flood maps, closeup/ (10 m), clear_pair.json (clearest photos)
public/data/river/           long profile of the Vakhsh;  public/data/climate.json  NASA POWER weather
scripts/                     data scripts (Python: NISAR GCOV cut, lakes, farmland, river profile; Node: photos, context, weather)
src/App.jsx                  routes, map page state, guide chapters
src/components/Landing       landing page            src/components/River    "One river, one pulse" page
src/components/Stage         view bar, timeline, guide, answer panel     src/components/MapView   MapLibre map + swipe
src/components/Report        one-page printable report                   src/components/Dashboard all sites + alerts
src/components/*Card         answer cards (lakes, farmland, flood, motion, place, weather, polarization)
src/lib/nisar.js             data loading, dB decoding, change detection, water masks, map focus
src/lib/stories.js           story text per site (en / ru / tg);  src/lib/i18n*.js  interface text
```

## Add a site

Put a folder in `public/data/` with the same layout as `vakhsh_cascade/` (`manifest.json`, `*_HH.png`, `*_HV.png`, `*_RGB.png`, optional `water_*.geojson`), then add its id to `SITES` in `src/lib/nisar.js` and its story text to `src/lib/stories.js`. A site selector appears automatically when there is more than one site. Sites without water outlines hide the area card. A manifest with an `event` block (date, before/after dates, flood map, time series, polarization test) is shown as a sudden-event story, like `nepal/`. `sh scripts/rgb-webp.sh <site>` shrinks the colour pictures about six times.

## Same-day optical photos

`npm run optical -- vakhsh_cascade` asks NASA GIBS for HLS imagery (Landsat + Sentinel-2, 30 m) within ±6 days of every NISAR date, measures cloud cover over the scene, and writes `public/data/<site>/optical.json`. The app then offers a **Photo** layer next to HH / HV / Color. Run it once for each new site; no API key is needed.

## Interferogram (InSAR) picture (Expert extra)

`npm run insar -- <site>` asks the Alaska Satellite Facility for NISAR L2 GUNW interferograms on the site's own track and dates, downloads ASF's public browse picture (no login) and resamples it onto the site's radar grid (`insar.png`, `insar.json`). In Expert mode it appears as the picture **Wave comparison (InSAR)**, and the story chapter "What else can NISAR do?" shows it. Over Vakhsh both reservoirs stand out as speckle, because water never keeps the radar wave coherent. It is shown as a picture only: no ground movement is computed.

This browse picture is shown only as a picture. The measured ground movement (±3 cm at the dam, +11.6 cm on one slope) comes from the team's own GUNW stack in `public/data/vakhsh_cascade/motion/`, shown as the **Ground movement** layer.

## Data

- Optical: NASA HLS (Harmonized Landsat Sentinel-2) via NASA GIBS

- Radar: NISAR L2 GCOV (NASA/JPL, ISRO), ASF DAAC, DOI 10.5067/NIL2GCOV-P1: PROVISIONAL (P05023) and VALIDATED (P05036) products; Nepal to 12 Sep 2026 from the experimental release (X05026)
- Ground movement: NISAR L2 GUNW interferograms (NASA/JPL, ISRO), ASF DAAC, 8 consecutive 12-day pairs on track 12 / frame 21, stacked by the team
- DEM: Copernicus DEM GLO-30 (ESA / Copernicus): lake height rules, Rogun level estimate, farmland slope mask, valley floors in Nepal, river profile
- Context: rivers, towns with population and dams © OpenStreetMap contributors (ODbL), via the Overpass API
- Basemap: Esri World Imagery; 3D terrain: Mapzen / AWS Terrain Tiles
- Space agency partners: ISRO (NISAR is a NASA–ISRO mission), ESA (Copernicus DEM, Sentinel-2 in HLS)
- Weather: NASA POWER (MERRA-2 / GEOS-IT), daily T2M and PRECTOTCORR, `scripts/find-climate.mjs` → `public/data/climate.json`
- River line and dams: © OpenStreetMap contributors (ODbL); long profile made by `scripts/river_profile.py` → `public/data/river/profile.json`

## Use of AI

- We used **Claude (Anthropic), through Claude Code,** as a coding assistant: it wrote most of the web app code and the data scripts in `scripts/` with us, drafted the interface text and its Russian and Tajik versions, and helped check our results against NASA's own browse images.
- **No data, measurement or picture in the app was generated by AI.** Every number comes from NISAR products (GCOV, GUNW), the Copernicus DEM, NASA HLS and NASA POWER, through scripts that are in this repository and can be rerun. Where a script repeats the data team's method, it first reproduces an existing date and prints the agreement.
- The pictures on the page are radar and satellite data; the drawings (radar waves, the river profile) are SVG drawn in code from the data.
- The team is responsible for the final text, the science and the conclusions.
