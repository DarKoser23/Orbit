const scope = self.registration.scope;
const prefix = "orbit-shell:" + scope + ":";
const cacheName = prefix + "v3";
const files = ["./", "./index.html", "./desktop.js", "./manifest.json", "./favicon.png",
  "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];
const shell = new Set(files.map((file) => new URL(file, scope).href));

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...shell].map((url) => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(prefix) && key !== cacheName)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const asset = url.origin + url.pathname;
  const isShell = shell.has(asset);
  const library = (url.origin === "https://www.gstatic.com" && url.pathname.startsWith("/firebasejs/"))
    || (url.origin === "https://cdn.jsdelivr.net" && url.pathname.startsWith("/npm/sortablejs@"));
  if (!isShell && !library) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const key = isShell ? asset : req;
    if (library) {
      const hit = await cache.match(key);
      if (hit) return hit;
    }
    let res;
    try {
      res = await fetch(req);
    } catch (err) {
      const hit = await cache.match(key);
      if (hit) return hit;
      throw err;
    }
    if (res.ok || (library && res.type === "opaque")) {
      try { await cache.put(key, res.clone()); } catch { /* Cache indisponible ou plein. */ }
    }
    return res;
  })());
});
