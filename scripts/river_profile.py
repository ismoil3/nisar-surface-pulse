#!/usr/bin/env python3
"""
Long profile of the Vakhsh river ("the water staircase") from the top of the Rogun frame to the
end of the farmland frame: distance along the river against height.

  * river line: OpenStreetMap ways named Vakhsh / Surkhob (Overpass, saved as data-raw/river/osm.json);
  * height: Copernicus DEM GLO-30, lowest value within 90 m of the line (the line is not exactly in the channel),
    then made non-rising downstream;
  * dams: OpenStreetMap, snapped to the line.

The DEM was flown in 2011-2015: it shows the valley before Rogun was filled (so the river bed there is real)
and Nurek as a lake at 900 m (its bottom is not in the DEM).

    python scripts/river_profile.py --osm data-raw/river/osm.json --dem data-raw/dem
Output: public/data/river/profile.json
"""
import argparse, json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from nisar_water import dem_on_grid  # noqa: E402

NAMES = {"Vakhsh", "Vakhsh River", "Вахш", "Surkhob"}
DAMS = {"rogun": "Rogun Dam", "nurek": "Nurek Dam", "baipaza": "Baypaza", "sangtuda1": "Sangtuda-1", "sangtuda2": "Sangtuda-2", "sarband": "Sarband"}
TOWNS = {"norak": (69.3081, 38.3897), "bokhtar": (68.7821, 37.8357)}
START = (70.105, 38.905)   # where the river enters the Rogun-Nurek frame
END = (68.60, 37.727)      # where it leaves the farmland frame


def km(a, b):
    la = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * math.cos(la), a[1] - b[1]) * 111.32


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", required=True)
    ap.add_argument("--dem", required=True)
    ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "..", "public", "data"))
    a = ap.parse_args()
    els = json.load(open(a.osm))["elements"]
    ways = [[(p["lon"], p["lat"]) for p in e["geometry"]] for e in els
            if e["type"] == "way" and e["tags"].get("waterway") == "river" and (e["tags"].get("name:en") or e["tags"].get("name")) in NAMES]
    # chain the ways downstream: start with the way passing closest to START, then always the way whose head is nearest to the tail
    def near(w, p):
        return min(km(q, p) for q in w)
    first = min(ways, key=lambda w: near(w, START))
    i0 = min(range(len(first)), key=lambda i: km(first[i], START))
    line, used, gaps = list(first[i0:]), {id(first)}, []
    while km(line[-1], END) > 0.3:
        j = min(range(len(line)), key=lambda i: km(line[i], END))
        if j < len(line) - 1 and km(line[j], END) < 0.3:
            line = line[:j + 1]
            break
        rest = [w for w in ways if id(w) not in used]
        nxt = min(rest, key=lambda w: km(w[0], line[-1]))
        g = km(nxt[0], line[-1])
        if g > 2:
            sys.exit(f"gap of {g:.1f} km after {line[-1]}")
        if g > 0.01:
            gaps.append(round(g, 2))
        used.add(id(nxt))
        line += nxt
        j = min(range(len(line)), key=lambda i: km(line[i], END))
        if km(line[j], END) < 0.3:
            line = line[:j + 1]
            break
    print(f"river line: {len(line)} points from {len(used)} ways, joins with gaps (km): {gaps}")

    # resample every 100 m
    d = np.concatenate([[0], np.cumsum([km(line[i], line[i + 1]) for i in range(len(line) - 1)])])
    s = np.arange(0, d[-1], 0.1)
    lon = np.interp(s, d, [p[0] for p in line]); lat = np.interp(s, d, [p[1] for p in line])
    z = np.full(len(s), np.inf)
    for dx in (-3, -2, -1, 0, 1, 2, 3):
        for dy in (-3, -2, -1, 0, 1, 2, 3):   # +-90 m in 30 m steps
            zz = dem_on_grid(lon + dx * 30 / (111320 * np.cos(np.radians(lat))), lat + dy * 30 / 111320, a.dem)
            z = np.fmin(z, zz)
    raw = z.copy()
    z = np.minimum.accumulate(z)
    print(f"length {d[-1]:.1f} km, height {z[0]:.0f} -> {z[-1]:.0f} m; 'non-rising' changed the raw DEM by median {np.median(raw - z):.1f} m, 95% < {np.percentile(raw - z, 95):.1f} m")

    def snap(p):
        i = int(np.argmin([km((lon[k], lat[k]), p) for k in range(len(s))]))
        return i, km((lon[i], lat[i]), p)
    marks = []
    for key, pat in DAMS.items():
        cand = []
        for e in els:
            nm = (e.get("tags", {}).get("name:en") or e.get("tags", {}).get("name") or "")
            if e.get("tags", {}).get("waterway") == "dam" and pat in nm:
                g = e.get("geometry") or [e]
                cand.append((sum(p["lon"] for p in g) / len(g), sum(p["lat"] for p in g) / len(g)))
        i, off = snap(cand[0])
        marks.append({"id": key, "kind": "dam", "km": round(float(s[i]), 1), "z": round(float(z[i])), "lonlat": [round(cand[0][0], 4), round(cand[0][1], 4)]})
        print(f"  dam {key}: km {s[i]:.1f}, river {z[i]:.0f} m (snapped {off * 1000:.0f} m)")
    for key, p in TOWNS.items():
        i, off = snap(p)
        marks.append({"id": key, "kind": "town", "km": round(float(s[i]), 1), "z": round(float(z[i])), "lonlat": list(p)})
        print(f"  town {key}: km {s[i]:.1f} ({off:.1f} km from the river)")

    # where each radar frame covers the river
    frames = {}
    for site in ("vakhsh_cascade", "vakhsh"):
        m = json.load(open(os.path.join(a.data, site, "manifest.json")))
        lo = [c[0] for c in m["corners"]]; la = [c[1] for c in m["corners"]]
        inside = (lon >= min(lo)) & (lon <= max(lo)) & (lat >= min(la)) & (lat <= max(la))
        frames[site] = [round(float(s[inside][0]), 1), round(float(s[inside][-1]), 1)]
    # the DEM lake of Nurek: the flat stretch upstream of the dam
    nk = next(x for x in marks if x["id"] == "nurek")["km"]
    lake = z[(s < nk - 0.5) & (s > nk - 80)]
    lvl = float(np.round(np.median(lake[-200:])))
    flat = s[(s < nk) & (np.abs(z - lvl) < 1.5)]
    print(f"Nurek in the DEM: flat at {lvl:.0f} m from km {flat[0]:.1f} to {flat[-1]:.1f}")
    step = 4  # 400 m
    out = {
        "what": "Long profile of the Vakhsh river: distance along the river (km) against height (m)",
        "sources": {"line": "© OpenStreetMap contributors (ODbL)", "height": "Copernicus DEM GLO-30 (ESA/Copernicus), lowest value within 90 m of the line, non-rising downstream"},
        "length_km": round(float(s[-1]), 1),
        "pts": [[round(float(s[i]), 1), round(float(z[i])), round(float(lon[i]), 4), round(float(lat[i]), 4)] for i in list(range(0, len(s), step)) + [len(s) - 1]],
        "marks": sorted(marks, key=lambda x: x["km"]),
        "frames": frames,
        "nurek_dem": {"level_m": lvl, "from_km": round(float(flat[0]), 1), "to_km": round(float(flat[-1]), 1)},
    }
    os.makedirs(os.path.join(a.data, "river"), exist_ok=True)
    json.dump(out, open(os.path.join(a.data, "river", "profile.json"), "w"), separators=(",", ":"))
    print("written", os.path.getsize(os.path.join(a.data, "river", "profile.json")), "bytes")


if __name__ == "__main__":
    main()
