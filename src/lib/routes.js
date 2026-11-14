// The four stories of the app and their routes: "#/map/<slug>?<view>".
// One radar site can hold two stories (Rogun lakes + Rogun ground movement).

export const STORY_ROUTES = [
  { slug: "water", site: "vakhsh_cascade", icon: "💧", kind: "lpKindWater" },
  { slug: "motion", site: "vakhsh_cascade", icon: "⛰️", kind: "lpKindMotion", preset: { mode: "single", pol: "motion" } },
  { slug: "crops", site: "vakhsh", icon: "🌾", kind: "lpKindCrops" },
  { slug: "flood", site: "nepal", icon: "🌊", kind: "lpKindFlood" },
];

export const routeOf = (slug) => STORY_ROUTES.find((r) => r.slug === slug) ?? null;

/** Which story a view belongs to (the motion picture on the Vakhsh site is its own story). */
export function slugFor(site, mode, pol) {
  if (site === "vakhsh_cascade" && mode === "single" && pol === "motion") return "motion";
  return STORY_ROUTES.find((r) => r.site === site && !r.preset)?.slug ?? "water";
}
