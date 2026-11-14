# NASA resources: what they say and how the app uses them

All 14 resources from the challenge's resource list were read on 2026-11-13.
Read StoryMaps through the ArcGIS API, because their pages are JavaScript only:
`https://www.arcgis.com/sharing/rest/content/items/<id>/data?f=json`.
Read PDFs with `pdftotext`.

## Facts the app relies on
**NISAR mission (ASF NISAR Data User Guide, ARSET):**
- Satellite: L-band 24 cm, S-band 9.4 cm (mainly over India), 12-day repeat, 240 km swath, launched 2025-07-30.
- L2 GCOV:
  - gamma-0 power, radiometrically terrain corrected (RTC) with the Copernicus DEM.
  - Posting 10–20 m; UTM projection; HDF5 files.
  - RTC does not remove layover or radar shadow.
- L2 GUNW: geocoded unwrapped interferogram (InSAR, phase). Measures ground movement in centimetres.
- Data status:
  - BETA: February 2026.
  - PROVISIONAL: acquisitions from 2026-06-17 ("calibrated, validated at a limited set of sites").
  - VALIDATED: released 2026-11-06, for acquisitions from 2026-10-21.
- Permanent data gap: 2026-07-27 to 2026-08-10.

**Scattering (NASA Earthdata "What is SAR", NISAR flood StoryMap):**
- Calm water reflects away (specular), so it is dark. Wind roughens the water and brightens it.
- Rough surfaces send back part of the signal. HH is sensitive to surface and double-bounce scattering.
- HV (cross-pol) is sensitive to volume scattering from plants.
- Flooded vegetation looks very bright (double bounce), which is mostly seen at L-band.

**Floods (StoryMap):** "For flood applications, the HH channel from NISAR will be the most relevant ... HV is more suitable to detect vegetation." Our measurements agree on both sites.

**Sources of confusion (ARSET "Monitoring Surface Water with SAR", 2026):**
- Wind and agricultural areas look like water.
- Radar shadow looks like water.
- Urban areas and topography look like inundated vegetation.

**Wildfires (StoryMap):** HV drops where vegetation burned (HV ratio before/after).

**White papers:**
- Floods: mapped "twice every 12 days", through clouds, even under forest canopies.
- Landslides: InSAR detects slow creep before failure.
- Levees and dams: a baseline of many passes flags abnormal movement and seepage.
- Mountain glaciers: "reservoirs in the sky"; 12-day repeat for velocity; wet vs dry snow in the echo.
- Earthquakes: reservoir filling can induce seismicity.
- Soil moisture: maps every 6–12 days at 200 m.

**Other sources:**
- UAVSAR: NASA's airborne L-band prototype of NISAR (used in the StoryMaps and postcards).
- OPERA DSWx: 30 m water maps from HLS, Sentinel-1, and NISAR (the NISAR version, DSWx-NI, is "under development").
- Partner agencies:
  - RADARSAT-1 (C-band, open archive) and RCM (C-band): no confirmed free coverage of Tajikistan or Nepal.
  - SAOCOM (L-band): needs a licence.
  - CSA SAR tutorial: a beginner guide to opening an RCM GeoTIFF in QGIS or Python. It has no change detection.

## InSAR vs our method (for the team)
- NISAR is the satellite. GCOV and GUNW are two products made from the same radar passes.
- GCOV = amplitude (echo strength). Our water outlines and flood map use it.
- GUNW = InSAR (phase difference between two passes). It measures centimetre ground movement.
- Water and changed surfaces decorrelate, so lakes appear as speckle in an interferogram.
- They are used together: amplitude says *what* the surface is; InSAR says *how the ground moved*.

## Where each resource appears in the app
The About dialog (`RESOURCES` in `src/components/Dialogs.jsx`) lists every resource with a translated note on how it was used.
