// Usage: node scripts/asf-browse.mjs "POINT(lon lat)" _012_A_021_ 2026-06-20 2026-11-14 <outDir>
// downloads ASF's public per-channel browse pictures (HHHH, HVHV) + NATIVE.kml for one track/frame
import { writeFile, mkdir } from "node:fs/promises";
const [pt, tf, start, end, out] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const q = new URLSearchParams({ dataset: "NISAR", processingLevel: "GCOV", intersectsWith: pt, start, end: end + "T23:59:59Z", output: "jsonlite", maxResults: "500" });
const r = await (await fetch("https://api.daac.asf.alaska.edu/services/search/param?" + q, { headers: { "User-Agent": "nisar-app-check/1.0" } })).json();
for (const g of r.results.filter((x) => x.granuleName.includes(tf) && x.granuleName.includes("_PR_"))) {
  const d = g.granuleName.match(/_(\d{8})T/)[1];
  const urls = [...g.browse.filter((u) => /NATIVE_A_(HHHH|HVHV)\.png$/.test(u)), ...(g.nisar?.additionalUrls ?? []).filter((u) => u.endsWith("_NATIVE.kml"))];
  for (const u of urls) {
    const res = await fetch(u, { headers: { "User-Agent": "nisar-app-check/1.0" } });
    const b = Buffer.from(await res.arrayBuffer());
    const name = `${d}_${u.split("_").slice(-2).join("_").replace(/^.*?(NATIVE|A_)/, "$1")}`;
    await writeFile(`${out}/${name}`, b);
    console.log(d, g.collectionName, name, res.status, b.length);
  }
}
