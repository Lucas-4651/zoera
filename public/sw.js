/**
 * Service worker de Zoera.
 *
 * Règle de base : les scores sont vivants, on ne les cache JAMAIS.
 *   • navigation  → réseau d'abord, cache en secours, page hors-ligne en dernier
 *   • statiques   → cache d'abord, rafraîchissement en arrière-plan
 *   • /api/…      → jamais intercepté (données temps réel)
 */

const VERSION = "zoera-v1";
const OFFLINE_URL = "/offline.html";

/* Le socle indispensable pour afficher quelque chose hors-ligne.
   On ajoute chaque entrée séparément : une ressource manquante ne doit pas
   faire échouer l'installation du service worker. */
const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/css/app.css",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/js/main.js",
  "/js/dom.js",
  "/js/favorites.js",
  "/js/filters.js",
  "/js/live.js",
  "/js/pwa.js",
  "/js/search.js",
  "/js/tabs.js",
  "/js/types.js",
  "/js/ui.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {
            /* ressource absente : on continue, le cache se remplira à l'usage */
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Statique : on sert le cache et on rafraîchit derrière. */
function staleWhileRevalidate(request) {
  return caches.open(VERSION).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  /* Données temps réel : le réseau seul décide. */
  if (url.pathname.startsWith("/api/")) return;

  /* Navigation : réseau d'abord (le HTML est rendu côté serveur). */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  if (
    url.pathname.startsWith("/css/") ||
    url.pathname.startsWith("/js/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
