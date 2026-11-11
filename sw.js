// Servicio de la aplicación del mapa: primero la red (datos frescos); si no hay red, lo último guardado.
const CACHE = "mapa-v1";
const BASE = ["./", "./index.html", "./manifest.webmanifest", "./icono-192.png", "./icono-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const clave = url.pathname.endsWith("mapa.cifrado.json") ? url.origin + url.pathname : e.request;  // sin el parámetro anti-caché
  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .then((r) => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(clave, copia)); } return r; })
      .catch(() => caches.match(clave, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
  );
});
