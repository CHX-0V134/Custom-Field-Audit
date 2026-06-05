// Field Audit service worker — caches the app shell so it loads with no signal.
// Bump CACHE_VERSION (and the ?v= asset versions) together on every deploy.
const CACHE_VERSION = "v12";
const CACHE = "fieldaudit-" + CACHE_VERSION;
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=12",
  "./config.js?v=12",
  "./questions.js?v=12",
  "./db.js?v=12",
  "./app.js?v=12",
  "./supabase.min.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];
const SUPABASE_HOST = "gbrdnlnhushxfgkudcce.supabase.co";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // never cache writes
  const url = new URL(req.url);

  // Supabase API: always go to network; if offline it fails and the app queues locally.
  if (url.hostname === SUPABASE_HOST) return;

  // Navigations: serve the cached app shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("./index.html").then((r) => r || caches.match("./"))));
    return;
  }

  // Same-origin assets: cache-first, fall back to network and cache it.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => cached)
      )
    );
  }
});
