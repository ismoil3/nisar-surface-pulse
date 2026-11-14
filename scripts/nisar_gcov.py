#!/usr/bin/env python3
"""
Cuts one NISAR L2 GCOV granule to a site of this app and writes the app's picture files,
with the same method as the data team's packages:

  * the site's grid comes from public/data/<site>/manifest.json (UTM, 60 m, corners, image size);
  * the 20 m GCOV pixels are averaged 3 x 3 in linear power (gamma-0) -> 60 m;
  * HH / HV are written as 8-bit PNG (gray + alpha):  dB = -35 + (v - 1) * 35 / 254,  alpha 0 = no data;
  * the colour picture: R = HH [-25, 0] dB, G = HV [-32, -8] dB, B = HH - HV [0, 15] dB (WebP).

The granule can be a local .h5 file or an https:// URL on ASF (then only the needed part is read,
using the Earthdata login in ~/.netrc). Works the same on a laptop, a server or Google Colab:

    pip install numpy h5py pillow fsspec aiohttp
    python scripts/nisar_gcov.py --site vakhsh_cascade --granule <file.h5 or URL>            # write <date>_HH/HV/RGB
    python scripts/nisar_gcov.py --site vakhsh_cascade --granule <...> --check               # compare with the existing PNGs

The date is taken from the granule name. New files are written into public/data/<site>/
(or --out DIR). The manifest is not changed by this script (see --print-entry).
"""
import argparse, json, math, os, re, sys
import numpy as np

DB_MIN, DB_MAX = -35.0, 0.0


# ---------- UTM (Krüger series, the same as src/lib/nisar.js) ----------
def utm(lon, lat, zone):
    a, f, k0 = 6378137.0, 1 / 298.257223563, 0.9996
    n = f / (2 - f)
    A = (a / (1 + n)) * (1 + n * n / 4 + n ** 4 / 64)
    al = [n / 2 - (2 / 3) * n * n + (5 / 16) * n ** 3, (13 / 48) * n * n - (3 / 5) * n ** 3, (61 / 240) * n ** 3]
    phi, lam = math.radians(lat), math.radians(lon - (zone * 6 - 183))
    e = math.sqrt(f * (2 - f))
    t = math.sinh(math.atanh(math.sin(phi)) - e * math.atanh(e * math.sin(phi)))
    xi, eta = math.atan2(t, math.cos(lam)), math.atanh(math.sin(lam) / math.sqrt(1 + t * t))
    E, N = eta, xi
    for k in (1, 2, 3):
        E += al[k - 1] * math.cos(2 * k * xi) * math.sinh(2 * k * eta)
        N += al[k - 1] * math.sin(2 * k * xi) * math.cosh(2 * k * eta)
    return 500000 + k0 * A * E, k0 * A * N


def site_grid(m):
    """UTM edges of the site picture, exactly as gridOf() in nisar.js."""
    zone = m["epsg_source"] - 32600
    c = [utm(lo, la, zone) for lo, la in m["corners"]]  # TL, TR, BR, BL
    x0, x1 = (c[0][0] + c[3][0]) / 2, (c[1][0] + c[2][0]) / 2
    y0, y1 = (c[0][1] + c[1][1]) / 2, (c[2][1] + c[3][1]) / 2
    return zone, x0, x1, y0, y1


# ---------- reading the granule ----------
def open_h5(path):
    import h5py
    if not path.startswith("http"):
        return h5py.File(path, "r")
    import netrc, aiohttp, fsspec
    login, _, pw = netrc.netrc().authenticators("urs.earthdata.nasa.gov")
    fs = fsspec.filesystem("https", client_kwargs={"auth": aiohttp.BasicAuth(login, pw), "trust_env": True})
    return h5py.File(fs.open(path, "rb", cache_type="blockcache", block_size=8 * 1024 * 1024), "r")


def cut(h, m, freq="frequencyA"):
    """Returns 60 m HH and HV gamma-0 power on the site grid (NaN = no data)."""
    G = h[f"science/LSAR/GCOV/grids/{freq}"]
    epsg = int(G["projection"][()])
    if epsg != m["epsg_source"]:
        sys.exit(f"granule is EPSG {epsg}, site is {m['epsg_source']}")
    xs, ys = G["xCoordinates"], G["yCoordinates"]
    dx, dy = float(G["xCoordinateSpacing"][()]), float(G["yCoordinateSpacing"][()])  # +20, -20
    gx0, gy0 = float(xs[0]) - dx / 2, float(ys[0]) - dy / 2                            # outer edge of pixel 0
    zone, x0, x1, y0, y1 = site_grid(m)
    W, H = m["image_size_px"]
    px = (x1 - x0) / W
    f = round(px / dx)                                                               # 60 / 20 = 3
    c0, r0 = (x0 - gx0) / dx, (y0 - gy0) / dy                                       # site edge in granule pixels
    shift = (c0 - round(c0), r0 - round(r0))
    c0, r0 = int(round(c0)), int(round(r0))
    out = {}
    for pol in ("HHHH", "HVHV"):
        d = G[pol]
        R0, R1, C0, C1 = max(r0, 0), min(r0 + H * f, d.shape[0]), max(c0, 0), min(c0 + W * f, d.shape[1])
        full = np.full((H * f, W * f), np.nan, dtype=np.float32)
        if R1 > R0 and C1 > C0:
            full[R0 - r0:R1 - r0, C0 - c0:C1 - c0] = d[R0:R1, C0:C1]
        full[~np.isfinite(full) | (full <= 0)] = np.nan
        blk = full.reshape(H, f, W, f)
        n = np.sum(np.isfinite(blk), axis=(1, 3))
        s = np.nansum(blk, axis=(1, 3))
        with np.errstate(invalid="ignore", divide="ignore"):
            mean = np.where(n >= 1, s / n, np.nan)  # like the team's packages: no data only where no source pixel is valid
        out[pol[:2]] = mean.astype(np.float32)
    return out, {"factor": f, "grid_shift_px": [round(shift[0], 3), round(shift[1], 3)], "pixel_m": px}


# ---------- encoding ----------
def to_db(p):
    with np.errstate(divide="ignore", invalid="ignore"):
        return 10 * np.log10(p)


def encode(db):
    v = np.clip(np.round((db - DB_MIN) * 254 / (DB_MAX - DB_MIN)) + 1, 1, 255)
    ok = np.isfinite(db)
    gray = np.where(ok, v, 0).astype(np.uint8)
    return np.dstack([gray, np.where(ok, 255, 0).astype(np.uint8)])


def rgb(hh_db, hv_db):
    def st(x, lo, hi):
        return np.clip((x - lo) / (hi - lo), 0, 1) * 255
    ok = np.isfinite(hh_db) & np.isfinite(hv_db)
    img = np.dstack([st(hh_db, -25, 0), st(hv_db, -32, -8), st(hh_db - hv_db, 0, 15), np.where(ok, 255, 0)])
    img[~ok] = 0
    return np.nan_to_num(img).astype(np.uint8)


def decode_png(path):
    from PIL import Image
    a = np.asarray(Image.open(path).convert("LA")).astype(np.float32)
    db = DB_MIN + (a[..., 0] - 1) * (DB_MAX - DB_MIN) / 254
    db[a[..., 1] == 0] = np.nan
    return db


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", required=True, help="folder name in public/data/")
    ap.add_argument("--granule", required=True, help="local .h5 or https URL")
    ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "..", "public", "data"))
    ap.add_argument("--out", default=None, help="write here instead of the site folder")
    ap.add_argument("--check", action="store_true", help="compare with the site's existing PNGs for this date")
    ap.add_argument("--print-entry", action="store_true", help="print the manifest dates[] entry for this date")
    ap.add_argument("--cache", default=None, help="also save the 60 m HH/HV power as <cache>/<site>_<date>.npz")
    ap.add_argument("--no-write", action="store_true", help="do not write picture files (with --cache: fetch only)")
    a = ap.parse_args()

    site_dir = os.path.join(a.data, a.site)
    m = json.load(open(os.path.join(site_dir, "manifest.json")))
    name = os.path.basename(a.granule).replace(".h5", "")
    t = re.search(r"_(\d{4})(\d{2})(\d{2})T\d{6}_", name)
    date = f"{t[1]}-{t[2]}-{t[3]}"
    h = open_h5(a.granule)
    pw, info = cut(h, m)
    hh, hv = to_db(pw["HH"]), to_db(pw["HV"])
    valid = float(np.mean(np.isfinite(hh)))
    print(f"{a.site} {date}: {info}, valid {valid:.1%}, HH median {np.nanmedian(hh):.2f} dB, HV median {np.nanmedian(hv):.2f} dB")
    if a.cache:
        os.makedirs(a.cache, exist_ok=True)
        np.savez_compressed(os.path.join(a.cache, f"{a.site}_{date}.npz"), hh=pw["HH"], hv=pw["HV"], granule=name)
        print(f"  cached {a.site}_{date}.npz")

    if a.check:
        for pol, mine in (("HH", hh), ("HV", hv)):
            ref = decode_png(os.path.join(site_dir, f"{date}_{pol}.png"))
            ok = np.isfinite(ref) & np.isfinite(mine)
            d = mine[ok] - ref[ok]
            r = np.corrcoef(mine[ok], ref[ok])[0, 1]
            print(f"  {pol}: compared {ok.mean():.1%} of pixels, r = {r:.4f}, mean diff {d.mean():+.3f} dB, "
                  f"median |diff| {np.median(np.abs(d)):.3f} dB, 99% |diff| < {np.percentile(np.abs(d), 99):.3f} dB, "
                  f"nodata mismatch {np.mean(np.isfinite(ref) != np.isfinite(mine)):.2%}")
        return

    if a.no_write:
        return
    from PIL import Image
    out = a.out or site_dir
    os.makedirs(out, exist_ok=True)
    Image.fromarray(encode(hh), "LA").save(os.path.join(out, f"{date}_HH.png"), optimize=True)
    Image.fromarray(encode(hv), "LA").save(os.path.join(out, f"{date}_HV.png"), optimize=True)
    Image.fromarray(rgb(hh, hv), "RGBA").save(os.path.join(out, f"{date}_RGB.webp"), quality=88, method=6)
    print(f"  wrote {date}_HH.png, {date}_HV.png, {date}_RGB.webp -> {out}")
    if a.print_entry:
        print(json.dumps({"date": date, "hh": f"{date}_HH.png", "hv": f"{date}_HV.png", "rgb": f"{date}_RGB.webp",
                          "water": None, "water_km2": None, "granule": name}))


if __name__ == "__main__":
    main()
