import { useEffect, useRef } from "react";
import { fmtDate } from "../lib/nisar.js";
import { t, tr, tNote } from "../lib/i18n.jsx";

// Every resource from the challenge's resource list: [name, link, i18n key saying how we used it]
const RESOURCES = [
  ["What is SAR? (NASA Earthdata)", "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar", "useSar"],
  ["Remote Sensing basics (NASA Earthdata)", "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/remote-sensing", "useRs"],
  ["NISAR Data User Guide (ASF)", "https://nisar-docs.asf.alaska.edu/", "useGuide"],
  ["Earthdata Search", "https://search.earthdata.nasa.gov/", "useSearch"],
  ["ASF Data Search Vertex", "https://search.asf.alaska.edu/", "useSearch"],
  ["NISAR StoryMap: Floods", "https://storymaps.arcgis.com/stories/c00d7691b8004b20a14f28df710d05fd", "useFlood"],
  ["NISAR StoryMaps (5)", "https://science.nasa.gov/mission/nisar/arcgis-storymaps/", "useStory"],
  ["NISAR Applications White Papers", "https://science.nasa.gov/mission/nisar/documents/", "usePapers"],
  ["NASA ARSET: Monitoring Surface Water with SAR (2026)", "https://www.earthdata.nasa.gov/s3fs-public/2026-10/arset-2026-surfacewater-part1.pdf", "useArset"],
  ["NASA ARSET: Harnessing NISAR (2026)", "https://www.earthdata.nasa.gov/s3fs-public/2026-06/arset-2026-nisar-part1.pdf", "useArset2"],
  ["UAVSAR Postcards", "https://uavsar.jpl.nasa.gov/education/postcards.html", "usePost"],
  ["CSA: SAR tutorial (Python, QGIS)", "https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial", "useCsa"],
  ["CSA: RADARSAT Constellation Mission / RADARSAT-1", "https://www.asc-csa.gc.ca/eng/satellites/radarsat/access-to-data/default.asp", "usePartner"],
  ["CONAE: SAOCOM catalogue", "https://catalogos.conae.gov.ar/catalogo/catalogo.html", "usePartner"],
];

function Modal({ open, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <article>
        <button className="close" onClick={onClose} aria-label={t("close")}>×</button>
        {children}
      </article>
    </dialog>
  );
}

export function AboutDialog({ open, onClose, m, story, insar, closeup, motion }) {
  const rows = [
    ["rSite", `${story.name || m.name}, ${story.region || m.region}`],
    ["rMission", "NISAR (NASA–ISRO), L-band SAR"],
    ["rProduct", m.sources.radar],
    ["rTrack", `${m.track} / ${m.frame}, ${m.direction}, mode ${m.mode}`],
    ["rPixel", `${m.pixel_m} m, ${m.image_size_px.join(" × ")} px`],
    ["rDates", t("vDates", { n: m.dates.length, a: fmtDate(m.dates[0].date), b: fmtDate(m.dates.at(-1).date) })],
    ["rDem", m.sources.dem ?? (m.event?.valley_definition ? "Copernicus DEM" : null)],
    ["rOptical", t("vOptical")],
    ["rClimate", "NASA POWER (MERRA-2 / GEOS-IT), power.larc.nasa.gov"],
    ["rOsm", "© OpenStreetMap contributors (ODbL), via Overpass API"],
    ["rTerrain", "Mapzen / AWS Terrain Tiles"],
    ["rFacts", story.facts],
    ["rCheck", story.check],
    ["rMotion", motion ? `${motion.sources.radar}, ${fmtDate(motion.dates[0])} → ${fmtDate(motion.dates.at(-1))}, ${motion.pairs.length} × 12 d, ${motion.pixel_m} m` : null],
    ["rCloseup", closeup ? `${closeup.pixel_m} m, ${closeup.image_size_px.join(" × ")} px, ${t("vCloseup", { nb: closeup.before_dates.length, na: closeup.after_dates.length })}` : null],
    ["rInsar", insar ? `${insar.source}, ${fmtDate(insar.from)} → ${fmtDate(insar.to)}` : null],
  ];
  const notes = m.dates.filter((d) => d.note);
  const ev = m.event;
  // NISAR's permanent data gap (27 Jul – 10 Aug 2026) falls inside this site's series
  const hasGap = m.dates[0].date < "2026-07-27" && m.dates.at(-1).date > "2026-08-10";
  return (
    <Modal open={open} onClose={onClose}>
      <h2>{t("aboutTitle")}</h2>
      <dl className="meta">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="meta-row"><dt>{t(k)}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <h3>{t("method")}</h3>
      <ul>
        <li>{tr("mRadar", { min: m.encoding.db_min, max: m.encoding.db_max })} <code>{m.encoding.formula}</code> {t("mGamma")}</li>
        {m.farmland ? (
          <li>{tr("farmMethod")}</li>
        ) : ev ? (
          <>
            <li>{tr("mEvent", { nb: ev.before_dates.length, na: ev.after_dates.length, thr: ev.threshold_db ?? 3, valley: t("valleyDef") })}</li>
            <li>{tr("mEventCtl")}</li>
            <li>{tr("mEventPol")}</li>
            {closeup && <li>{tr("cuMethod")}</li>}
          </>
        ) : (
          <>
            <li>{tr("mOutline", { text: t(m.reservoirNames?.length > 1 ? "mOutlineMulti" : "mOutlineDefault") })}</li>
            <li>{tr("mPol")}</li>
            <li>{tr("mDiff")}</li>
          </>
        )}
        <li>{tr("mChange")}</li>
        {insar && <li>{tr("mInsar")}</li>}
        {motion && <li>{tr("mMotion")}</li>}
      </ul>
      <h3>{t("chTitle")}</h3>
      <ul className="chmap">
        {["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8", "ch9", "ch10", "ch11"].map((k) => <li key={k}>{tr(k)}</li>)}
      </ul>
      <h3>{t("limits")}</h3>
      <ul>
        <li>{tr("l1")}</li>
        <li>{t(m.farmland ? "lFarm" : ev ? "lEvent" : "l2")}</li>
        <li>{t("l3", { px: m.pixel_m })}</li>
        <li>{t("lRes", { px: m.pixel_m })}</li>
        {hasGap && <li>{t("lGap")}</li>}
        {m.dates.some((d) => d.validated) && <li>{tr("lValidated", { n: m.dates.filter((d) => d.validated).length, d: fmtDate(m.dates.find((d) => d.validated).date) })}</li>}
        {notes.map((d) => <li key={d.date}>{fmtDate(d.date)}: {tNote(d.note)}.</li>)}
      </ul>
      <h3>{t("learnMore")}</h3>
      <ul className="resources">
        {RESOURCES.map(([name, url, use]) => (
          <li key={url}><a href={url} target="_blank" rel="noreferrer">{name}</a> <span className="hint">— {t(use)}</span></li>
        ))}
      </ul>
      <h3>{t("granules")}</h3>
      <ol className="granules">
        {m.dates.map((d) => <li key={d.granule ?? d.date}>{d.granule ?? d.date}</li>)}
      </ol>
      <p className="hint">{t("credits")}</p>
    </Modal>
  );
}
