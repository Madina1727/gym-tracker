// Offline cache for the app shell. Network first so updates show up; cache is the fallback offline.
const CACHE = "gym-v2";
const SHELL = ["./", "index.html", "css/app.css", "js/app.js", "js/store.js", "js/db.js", "js/ui.js", "js/kinds.js", "js/parts.js", "js/charts.js", "js/measure.js", "js/sync.js", "js/config.js", "js/pack.js",
  "js/views/home.js", "js/views/plan.js", "js/views/workout.js", "js/views/equipment.js", "js/views/progress.js", "js/views/profile.js", "js/views/welcome.js",
  "vendor/lucide.min.js", "fonts/inter-latin-wght-normal.woff2", "icons/icon.svg", "manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
});
