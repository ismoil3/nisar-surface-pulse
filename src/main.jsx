import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { slugFor } from "./lib/routes.js";
import "./styles.css";
import "./app.css";

// Old shared links looked like "#site=nepal&mode=story…"; turn them into the new routes ("#/map/flood?mode=story…").
// HashRouter keeps working from any sub-path (GitHub Pages) because the route lives after the "#".
if (/^#site=/.test(location.hash)) {
  const p = new URLSearchParams(location.hash.slice(1));
  const site = p.get("site");
  p.delete("site");
  history.replaceState(null, "", `${location.pathname}${location.search}#/map/${slugFor(site, p.get("mode"), p.get("pol"))}?${p}`);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
