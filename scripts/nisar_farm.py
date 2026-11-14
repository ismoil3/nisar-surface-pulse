#!/usr/bin/env python3
"""
Farmland time series for new dates, with the data team's rule (manifest "farmland.method"):
  farmland = slope < 2 deg (Copernicus DEM) and median HH between -16 and -4 dB;
  per date: median HV (and its 25 / 75 %) and median HH over that farmland.
First reproduces the team's CSV on the existing dates (printed), then appends the new dates.

    python scripts/nisar_farm.py --site vakhsh --dem data-raw/dem --cache data-raw/cache [--dates 2026-10-25 2026-11-06 --write]
"""
import argparse, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from nisar_gcov import decode_png, to_db, encode, rgb  # noqa: E402
from nisar_water import grid_lonlat, dem_on_grid  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "..", "public", "data"))
    ap.add_argument("--dem", required=True)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--dates", nargs="*", default=[])
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    sd = os.path.join(a.data, a.site)
    m = json.load(open(os.path.join(sd, "manifest.json")))
    f = m["farmland"]
    lon, lat = grid_lonlat(m)
    z = dem_on_grid(lon, lat, a.dem)
    gy, gx = np.gradient(z, m["pixel_m"])
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))

    old = [d for d in m["dates"]]
    HH = np.stack([decode_png(os.path.join(sd, d["hh"])) for d in old])
    HV = np.stack([decode_png(os.path.join(sd, d["hv"])) for d in old])
    med_hh = np.nanmedian(HH, axis=0)
    farm = (slope < 2) & (med_hh > -16) & (med_hh < -4)
    km2 = farm.sum() * m["pixel_m"] ** 2 / 1e6
    print(f"farmland: ours {km2:.1f} km² vs team {f['farmland_km2']} km²")

    ref = {r.split(",")[0]: r.split(",")[1:] for r in open(os.path.join(sd, f["file"])).read().strip().split("\n")[1:]}
    errs = []
    for i, d in enumerate(old):
        ours = [np.nanmedian(HV[i][farm]), np.nanpercentile(HV[i][farm], 25), np.nanpercentile(HV[i][farm], 75), np.nanmedian(HH[i][farm])]
        team = [float(x) for x in ref[d["date"]]]
        errs.append(np.array(ours) - np.array(team))
        print(f"  {d['date']}: HV median ours {ours[0]:.2f} / team {team[0]:.2f}, HH median ours {ours[3]:.2f} / team {team[3]:.2f}")
    e = np.abs(np.array(errs))
    print(f"max |diff| over all dates: HV median {e[:, 0].max():.2f} dB, HH median {e[:, 3].max():.2f} dB")

    # harvest test on the team's last date, to check the rule: HV fell >= 3 dB from its summer peak
    peak = np.nanmax(HV, axis=0)
    cut = farm & (peak - HV[-1] >= 3)
    print(f"'fell sharply' by {old[-1]['date']}: ours {cut.sum() * m['pixel_m'] ** 2 / 1e6:.1f} km² vs team {f['harvested_km2']} km²")

    if not a.dates:
        return
    rows, new = [], []
    for date in a.dates:
        zf = np.load(os.path.join(a.cache, f"{a.site}_{date}.npz"))
        hh, hv = to_db(zf["hh"]), to_db(zf["hv"])
        # the stored PNGs are what the app shows; medians use the same 8-bit values as the team's
        hh8, hv8 = [np.where(e8[..., 1] > 0, -35 + (e8[..., 0].astype(float) - 1) * 35 / 254, np.nan) for e8 in (encode(hh), encode(hv))]
        vals = [np.nanmedian(hv8[farm]), np.nanpercentile(hv8[farm], 25), np.nanpercentile(hv8[farm], 75), np.nanmedian(hh8[farm])]
        rows.append(f"{date}," + ",".join(f"{v:.2f}" for v in vals))
        new.append((date, hh, hv, hv8, str(zf["granule"])))
        print(f"{date}: HV median {vals[0]:.2f} dB, HH median {vals[3]:.2f} dB")
    allHV = np.concatenate([HV, np.stack([x[3] for x in new])])
    peak = np.nanmax(allHV, axis=0)
    cut = farm & (peak - allHV[-1] >= 3)
    cut_km2 = round(float(cut.sum() * m["pixel_m"] ** 2 / 1e6), 1)
    print(f"'fell sharply' by {a.dates[-1]}: {cut_km2} km² ({cut_km2 / f['farmland_km2'] * 100:.1f}% of the farmland)")
    if not a.write:
        return
    from PIL import Image
    for date, hh, hv, _, gran in new:
        Image.fromarray(encode(hh), "LA").save(os.path.join(sd, f"{date}_HH.png"), optimize=True)
        Image.fromarray(encode(hv), "LA").save(os.path.join(sd, f"{date}_HV.png"), optimize=True)
        Image.fromarray(rgb(hh, hv), "RGBA").save(os.path.join(sd, f"{date}_RGB.webp"), quality=88, method=6)
        m["dates"] = [d for d in m["dates"] if d["date"] != date] + [{
            "date": date, "hh": f"{date}_HH.png", "hv": f"{date}_HV.png", "rgb": f"{date}_RGB.webp",
            "water": None, "water_km2": None, "granule": gran}]
    m["dates"].sort(key=lambda d: d["date"])
    f["harvested_km2_team"] = f.get("harvested_km2_team", f["harvested_km2"])
    f["harvested_km2"] = cut_km2
    f["harvested_by"] = a.dates[-1]
    json.dump(m, open(os.path.join(sd, "manifest.json"), "w"), ensure_ascii=False, indent=1)
    p = os.path.join(sd, f["file"])
    lines = [l for l in open(p).read().strip().split("\n") if l.split(",")[0] not in a.dates] + rows
    open(p, "w").write("\n".join(lines) + "\n")
    print("written")


if __name__ == "__main__":
    main()
