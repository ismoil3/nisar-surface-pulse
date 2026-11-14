#!/usr/bin/env python3
"""
Lake outlines for new dates of a reservoir site, with the data team's method (manifest "notes"):

  Nurek: dark in HH and HV, elevation 850-920 m (Copernicus DEM), connected to the lake.
  Rogun: dark in HH and HV, in the valley below 1,170 m upstream of the dam, connected to the lake.
         level_m_est = the level at which the pre-filling DEM floods the same area (about +-10 m).

"Dark" thresholds are not written in the manifest, so they are LEARNED from the team's own outlines
on the existing dates (best mean overlap), and the agreement is printed before anything is written.

    python scripts/nisar_water.py --site vakhsh_cascade --dem data-raw/dem --cache data-raw/cache --calibrate
    python scripts/nisar_water.py --site vakhsh_cascade --dem data-raw/dem --cache data-raw/cache --dates 2026-10-25 2026-11-06 --write
"""
import argparse, glob, json, os, re, sys
import numpy as np
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from nisar_gcov import site_grid, decode_png, to_db, encode, rgb  # noqa: E402

RULES = {"nurek": {"zmin": 850, "zmax": 920}, "rogun": {"zmin": -1e9, "zmax": 1170}}


def grid_lonlat(m):
    from pyproj import Transformer
    zone, x0, x1, y0, y1 = site_grid(m)
    W, H = m["image_size_px"]
    xs = x0 + (np.arange(W) + 0.5) * (x1 - x0) / W
    ys = y0 - (np.arange(H) + 0.5) * (y0 - y1) / H
    X, Y = np.meshgrid(xs, ys)
    lon, lat = Transformer.from_crs(m["epsg_source"], 4326, always_xy=True).transform(X, Y)
    return lon, lat


def dem_on_grid(lon, lat, dem_dir):
    """Copernicus GLO-30 (1 x 1 degree COG tiles, pixel centres on whole arc-seconds), nearest sample."""
    import tifffile
    z = np.full(lon.shape, np.nan, dtype=np.float32)
    for f in glob.glob(os.path.join(dem_dir, "*.tif")):
        t = re.search(r"_([NS])(\d+)_00_([EW])(\d+)_00_", f)
        la0 = int(t[2]) * (1 if t[1] == "N" else -1)
        lo0 = int(t[4]) * (1 if t[3] == "E" else -1)
        sel = (lat >= la0) & (lat < la0 + 1) & (lon >= lo0) & (lon < lo0 + 1)
        if not sel.any():
            continue
        a = tifffile.imread(f)
        h, w = a.shape
        r = np.clip(((la0 + 1 - lat[sel]) * h).astype(int), 0, h - 1)
        c = np.clip(((lon[sel] - lo0) * w).astype(int), 0, w - 1)
        z[sel] = a[r, c]
    return z


def rasterize(geo, m, name):
    """Team outline (GeoJSON, lon/lat) -> mask on the site grid."""
    from pyproj import Transformer
    from skimage.draw import polygon
    tr = Transformer.from_crs(4326, m["epsg_source"], always_xy=True)
    zone, x0, x1, y0, y1 = site_grid(m)
    W, H = m["image_size_px"]
    mask = np.zeros((H, W), bool)
    for f in geo["features"]:
        if f["properties"].get("reservoir", "").lower() != name:
            continue
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for poly in polys:
            for k, ring in enumerate(poly):
                e, n = tr.transform(*np.array(ring).T)
                rr, cc = polygon((y0 - n) / (y0 - y1) * H - 0.5, (e - x0) / (x1 - x0) * W - 0.5, (H, W))
                if k == 0:
                    mask[rr, cc] = True
                else:
                    mask[rr, cc] = False
    return mask


def detect(hh, hv, z, zone, seed, t_hh, t_hv, fill):
    """Water mask with the team's rules: dark in both channels, height range, inside the zone, connected to the lake."""
    dark = (hh < t_hh) & (hv < t_hv) & zone
    lab, _ = ndimage.label(dark)
    ids = np.unique(lab[seed & (lab > 0)])
    w = np.isin(lab, ids[ids > 0])
    return ndimage.binary_fill_holes(w) & zone if fill else w


def iou(a, b):
    u = (a | b).sum()
    return (a & b).sum() / u if u else 1.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "..", "public", "data"))
    ap.add_argument("--dem", required=True)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--calibrate", action="store_true")
    ap.add_argument("--dates", nargs="*", default=[])
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    sd = os.path.join(a.data, a.site)
    m = json.load(open(os.path.join(sd, "manifest.json")))
    px_km2 = m["pixel_m"] ** 2 / 1e6
    lon, lat = grid_lonlat(m)
    z = dem_on_grid(lon, lat, a.dem)
    print(f"DEM on grid: {np.isfinite(z).mean():.1%} covered, {np.nanmin(z):.0f}..{np.nanmax(z):.0f} m")

    # the team's outlines on existing dates
    old = [d for d in m["dates"] if d.get("water")]
    team = {r: [] for r in RULES}
    imgs = []
    for d in old:
        geo = json.load(open(os.path.join(sd, d["water"])))
        for r in RULES:
            team[r].append(rasterize(geo, m, r))
        imgs.append((d["date"], decode_png(os.path.join(sd, d["hh"])), decode_png(os.path.join(sd, d["hv"]))))
    # zone = where the lake can be: the team's outlines on all dates, grown by 600 m, within the height rule;
    # seed = pixels that are lake on every date
    zones, seeds = {}, {}
    for r, rule in RULES.items():
        uni = np.any(team[r], axis=0)
        zones[r] = ndimage.binary_dilation(uni, iterations=10) & (z >= rule["zmin"]) & (z <= rule["zmax"])
        seeds[r] = np.all(team[r], axis=0)
        km = [t.sum() * px_km2 for t in team[r]]
        print(f"{r}: team outlines {min(km):.1f}..{max(km):.1f} km² (rasterized), seed {seeds[r].sum() * px_km2:.1f} km²")

    if a.write:
        write_dates(a, m, sd, z, zones, seeds, px_km2)
        return
    best = {}
    for r in RULES:
        res = []
        for smooth in (False, True):  # here: fill holes inside the lake
            for t_hh in np.arange(-20, -3, 1.0):
                for t_hv in np.arange(-28, -11, 1.0):
                    s = [iou(detect(hh, hv, z, zones[r], seeds[r], t_hh, t_hv, smooth), team[r][i]) for i, (_, hh, hv) in enumerate(imgs)]
                    res.append((np.mean(s), t_hh, t_hv, smooth))
        res.sort(reverse=True)
        best[r] = res[0]
        print(f"{r}: best mean IoU {res[0][0]:.3f} with HH < {res[0][1]} dB, HV < {res[0][2]} dB, fill holes {res[0][3]}")
        print("   runners-up:", [(round(x[0], 3), x[1], x[2], x[3]) for x in res[1:4]])
        _, t_hh, t_hv, smooth = res[0]
        for i, (date, hh, hv) in enumerate(imgs):
            mine = detect(hh, hv, z, zones[r], seeds[r], t_hh, t_hv, smooth)
            mk, tk = mine.sum() * px_km2, next(d for d in old if d["date"] == date)["reservoirs"][r]["area_km2"]
            print(f"   {date}: ours {mk:6.2f} km² vs team {tk:6.2f} km² ({(mk - tk) / tk * 100:+.1f}%), IoU {iou(mine, team[r][i]):.3f}")
    json.dump({r: {"iou": float(b[0]), "t_hh": float(b[1]), "t_hv": float(b[2]), "smooth": bool(b[3])} for r, b in best.items()},
              open(os.path.join(a.cache, f"{a.site}_water_rules.json"), "w"), indent=1)


def outline(mask, m, name):
    """Mask -> GeoJSON feature (MultiPolygon of closed rings; holes are rings too, read with the even-odd rule)."""
    from pyproj import Transformer
    from skimage import measure
    zone, x0, x1, y0, y1 = site_grid(m)
    W, H = m["image_size_px"]
    tr = Transformer.from_crs(m["epsg_source"], 4326, always_xy=True)
    polys = []
    for c in measure.find_contours(np.pad(mask, 1).astype(float), 0.5):
        if len(c) < 8:
            continue
        c = measure.approximate_polygon(c, tolerance=0.4)
        rr, cc = c[:, 0] - 1, c[:, 1] - 1
        e = x0 + (cc + 0.5) * (x1 - x0) / W
        n = y0 - (rr + 0.5) * (y0 - y1) / H
        lo, la = tr.transform(e, n)
        ring = [[round(float(x), 6), round(float(y), 6)] for x, y in zip(lo, la)]
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        polys.append([ring])
    return {"type": "Feature", "properties": {"reservoir": name.capitalize()}, "geometry": {"type": "MultiPolygon", "coordinates": polys}}


def write_dates(a, m, sd, z, zones, seeds, px_km2):
    from PIL import Image
    rules = json.load(open(os.path.join(a.cache, f"{a.site}_water_rules.json")))
    use = [r for r in RULES if rules[r]["iou"] >= 0.9]  # only lakes the method reproduces well
    print("lakes outlined with our method:", use, {r: round(rules[r]["iou"], 3) for r in RULES})
    rows = []
    for date in a.dates:
        zf = np.load(os.path.join(a.cache, f"{a.site}_{date}.npz"))
        hh, hv = to_db(zf["hh"]), to_db(zf["hv"])
        Image.fromarray(encode(hh), "LA").save(os.path.join(sd, f"{date}_HH.png"), optimize=True)
        Image.fromarray(encode(hv), "LA").save(os.path.join(sd, f"{date}_HV.png"), optimize=True)
        Image.fromarray(rgb(hh, hv), "RGBA").save(os.path.join(sd, f"{date}_RGB.webp"), quality=88, method=6)
        res, feats = {}, []
        for r in RULES:
            if r in use:
                R = rules[r]
                w = detect(hh, hv, z, zones[r], seeds[r], R["t_hh"], R["t_hv"], R["smooth"])
                res[r] = {"area_km2": round(float(w.sum() * px_km2), 2), "method": "app (scripts/nisar_water.py)"}
                feats.append(outline(w, m, r))
            else:
                res[r] = {"area_km2": None, "note": "second_orbit"}
        json.dump({"type": "FeatureCollection", "features": feats}, open(os.path.join(sd, f"water_{date}.geojson"), "w"))
        entry = {"date": date, "hh": f"{date}_HH.png", "hv": f"{date}_HV.png", "rgb": f"{date}_RGB.webp",
                 "water": f"water_{date}.geojson", "water_km2": None, "reservoirs": res, "granule": str(zf["granule"])}
        m["dates"] = [d for d in m["dates"] if d["date"] != date] + [entry]
        rows.append((date, res))
        print(date, {r: v["area_km2"] for r, v in res.items()})
    m["dates"].sort(key=lambda d: d["date"])
    json.dump(m, open(os.path.join(sd, "manifest.json"), "w"), ensure_ascii=False, indent=1)
    ts = os.path.join(sd, "timeseries.csv")
    if os.path.exists(ts):
        lines = [l for l in open(ts).read().strip().split("\n") if l.split(",")[0] not in a.dates]
        head = lines[0].split(",")
        for date, res in rows:
            vals = {"date": date, "nurek_km2": res["nurek"]["area_km2"], "rogun_km2": res["rogun"]["area_km2"]}
            lines.append(",".join("" if vals.get(h) is None else str(vals.get(h, "")) for h in head))
        open(ts, "w").write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
