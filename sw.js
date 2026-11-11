// Solo conserva recursos de esta app; los datos y la conexión se guardan cifrados.
const CACHE = "mapa-v2-sin-usb";
const BASE = ["./", "./index.html", "./chat.js", "./manifest.webmanifest", "./icono-192.png", "./icono-512.png"];
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(BASE);
    await Promise.allSettled(["mapa.cifrado.json", "conexion.cifrada.json"].map(async p => {
      const r = await fetch(p, {cache:"no-store"});
      if (r.ok) await c.put(new URL(p, self.registration.scope).href, r);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const nuevo = await caches.open(CACHE);
    for (const k of await caches.keys()) {
      if (!k.startsWith("mapa-") || k === CACHE) continue;
      const viejo = await caches.open(k);
      for (const req of await viejo.keys()) {
        if (!req.url.startsWith(self.registration.scope) || await nuevo.match(req)) continue;
        await nuevo.put(req, await viejo.match(req));
      }
      // Se conserva el respaldo anterior para no afectar otra instalación del mismo origen.
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || !url.href.startsWith(self.registration.scope)) return;
  const clave = url.pathname.endsWith(".cifrada.json") || url.pathname.endsWith("mapa.cifrado.json") ? url.origin + url.pathname : e.request;
  e.respondWith((async () => {
    const c = await caches.open(CACHE), ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(e.request, {cache:"no-store",signal:ctrl.signal});
      if (!r.ok) throw Error("HTTP " + r.status);
      await c.put(clave,r.clone());
      return r;
    } catch (_) {
      return await c.match(clave,{ignoreSearch:true}) ||
        (e.request.mode === "navigate" ? await c.match(new URL("index.html",self.registration.scope).href) : null) ||
        Response.error();
    } finally { clearTimeout(t); }
  })());
});
