#!/usr/bin/env python3
"""
Same NISAR pass, two processing versions (CRIDs): how much does the software alone change the numbers?
Reads the same window of HH and HV from both granules and prints the difference in dB.

    python scripts/nisar_crid_check.py <old.h5 or URL> <new.h5 or URL> [--size 2000]
"""
import sys, os, argparse
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from nisar_gcov import open_h5

ap = argparse.ArgumentParser()
ap.add_argument("old"); ap.add_argument("new"); ap.add_argument("--size", type=int, default=2000)
a = ap.parse_args()
out = {}
for name, path in (("old", a.old), ("new", a.new)):
    h = open_h5(path)
    G = h["science/LSAR/GCOV/grids/frequencyA"]
    x, y = G["xCoordinates"][:], G["yCoordinates"][:]
    out[name] = (G, x, y, str(h["science/LSAR/identification/productVersion"][()]) if "productVersion" in h["science/LSAR/identification"] else "")
(G0, x0, y0, _), (G1, x1, y1, _) = out["old"], out["new"]
# a window in the middle of the overlap, on the same ground coordinates in both files
xc, yc = (max(x0.min(), x1.min()) + min(x0.max(), x1.max())) / 2, (max(y0.min(), y1.min()) + min(y0.max(), y1.max())) / 2
n = a.size
def win(G, x, y):
    c = int(np.argmin(np.abs(x - xc))) - n // 2; r = int(np.argmin(np.abs(y - yc))) - n // 2
    return {p: G[p][r:r + n, c:c + n] for p in ("HHHH", "HVHV")}, (float(x[c]), float(y[r]))
w0, o0 = win(G0, x0, y0); w1, o1 = win(G1, x1, y1)
print(f"window {n} x {n} px, origin old {o0}, new {o1} (same ground: {o0 == o1})")
for p in ("HHHH", "HVHV"):
    a0, a1 = w0[p].astype(float), w1[p].astype(float)
    ok = np.isfinite(a0) & np.isfinite(a1) & (a0 > 0) & (a1 > 0)
    d = 10 * np.log10(a1[ok] / a0[ok])
    print(f"{p[:2]}: valid {ok.mean():.1%}; new - old: mean {d.mean():+.3f} dB, median {np.median(d):+.3f} dB, std {d.std():.3f} dB, "
          f"5..95% {np.percentile(d, 5):+.3f}..{np.percentile(d, 95):+.3f} dB; r = {np.corrcoef(np.log10(a0[ok]), np.log10(a1[ok]))[0, 1]:.5f}")

# the app works on 60 m means (speckle averaged out); repeat the comparison there and on 600 m blocks,
# and search for a whole-pixel shift between the two versions
def block(a, k):
    m = (a.shape[0] // k) * k
    b = np.where(np.isfinite(a) & (a > 0), a, np.nan)[:m, :m].reshape(m // k, k, m // k, k)
    return np.nanmean(b, axis=(1, 3))
for k, label in ((6, "60 m"), (60, "600 m")):
    for p in ("HHHH", "HVHV"):
        b0, b1 = block(w0[p].astype(float), k), block(w1[p].astype(float), k)
        ok = np.isfinite(b0) & np.isfinite(b1)
        d = 10 * np.log10(b1[ok] / b0[ok])
        print(f"{label} {p[:2]}: new - old mean {d.mean():+.3f} dB, median {np.median(d):+.3f}, std {d.std():.3f}; r = {np.corrcoef(np.log10(b0[ok]), np.log10(b1[ok]))[0, 1]:.4f}")
a0 = np.nan_to_num(np.log10(np.where(w0["HHHH"] > 0, w0["HHHH"], np.nan)), nan=0.0); a1 = np.nan_to_num(np.log10(np.where(w1["HHHH"] > 0, w1["HHHH"], np.nan)), nan=0.0)
best = (-1, 0, 0)
for dy in range(-6, 7):
    for dx in range(-6, 7):
        A = a0[8:-8, 8:-8]; B = a1[8 + dy:a1.shape[0] - 8 + dy, 8 + dx:a1.shape[1] - 8 + dx]
        r = np.corrcoef(A.ravel()[::7], B.ravel()[::7])[0, 1]
        if r > best[0]: best = (r, dx, dy)
print(f"best whole-pixel shift of new vs old: dx {best[1]}, dy {best[2]} px (r = {best[0]:.3f}; r at zero shift {np.corrcoef(a0.ravel()[::7], a1.ravel()[::7])[0, 1]:.3f})")
