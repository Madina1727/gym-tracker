// Router and app shell.
import { S, load, today, save } from "./store.js";
import { paint, icon, esc } from "./ui.js";
import { initSync, onSyncChange, syncLabel, sync } from "./sync.js";
import * as home from "./views/home.js";
import * as plan from "./views/plan.js";
import * as workout from "./views/workout.js";
import * as equipment from "./views/equipment.js";
import * as progress from "./views/progress.js";
import * as profile from "./views/profile.js";
import * as welcome from "./views/welcome.js";

const NAV = [
  { href: "#/", id: "home", label: "Home", icon: "house" },
  { href: "#/plan", id: "plan", label: "My Plan", icon: "calendar-days" },
  { href: "#/workout", id: "workout", label: "Workout", icon: "timer" },
  { href: "#/equipment", id: "equipment", label: "Equipment", icon: "dumbbell" },
  { href: "#/progress", id: "progress", label: "Progress", icon: "chart-line" },
  { href: "#/profile", id: "profile", label: "Profile", icon: "user-round", desktopOnly: true },
];
const ROUTES = { "": home, plan, day: plan, workout, equipment, progress, profile, welcome };

function navHTML(active, tab) {
  return NAV.filter((n) => !(tab && n.desktopOnly)).map((n) =>
    `<a href="${n.href}" class="${n.id === active ? "active" : ""}" ${n.id === active ? 'aria-current="page"' : ""}>${icon(n.icon)}<span>${n.label}</span></a>`).join("");
}
function renderSync() {
  const el = document.getElementById("side-sync");
  el.innerHTML = `<a href="#/profile#sync" class="sync-line ${sync.status}">${icon(sync.user ? (sync.status === "error" ? "cloud-alert" : sync.status === "offline" ? "cloud-off" : "cloud-check") : "cloud-off")}<span>${esc(syncLabel())}</span></a>`;
  paint(el);
}
export async function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [path, ...rest] = hash.split("#")[0].split("/");
  if (!S.state.onboarded && path !== "welcome") { location.replace("#/welcome"); return; }
  const view = ROUTES[path] || home;
  const active = path === "day" ? "plan" : path || "home";
  document.getElementById("side-nav").innerHTML = navHTML(active, false);
  document.getElementById("tabbar").innerHTML = navHTML(active, true);
  document.body.dataset.route = path || "home";
  const root = document.getElementById("view");
  root.innerHTML = "";
  await view.render(root, rest.map(decodeURIComponent), path);
  paint(document);
  renderSync();
  if (!route.keepScroll) window.scrollTo(0, 0);
  route.keepScroll = false;
}
/** Re-render the current view without jumping to the top. */
export function rerender() { route.keepScroll = true; return route(); }
window.__rerender = rerender;

function applyTheme() {
  const t = S.state.profile.theme;
  if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
window.__applyTheme = applyTheme;

(async function start() {
  await load();
  applyTheme();
  window.addEventListener("hashchange", () => route());
  await route();
  initSync().then(() => { onSyncChange(renderSync); renderSync(); });
  if ("serviceWorker" in navigator && location.protocol === "https:" && !window.Capacitor) navigator.serviceWorker.register("sw.js").catch(() => {});
  void today; void save;
})();
