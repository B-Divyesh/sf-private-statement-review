const VERSION = "psr-shell-v6";
const ASSET_CACHE = "psr-assets-v6";
const SHELL = [
  "/",
  "/privacy/",
  "/terms/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/art/ledger-garden-960.webp",
  "/art/ledger-garden-1536.webp",
  "/art/ledger-garden-960.avif",
  "/art/ledger-garden-1536.avif"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then(async (cache) => {
    await cache.addAll(SHELL);
    const home = await cache.match("/");
    if (!home) return;
    const markup = await home.text();
    const builtAssets = [...markup.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    if (builtAssets.length) await cache.addAll(builtAssets);
  }));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![VERSION, ASSET_CACHE].includes(key)).map((key) => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(VERSION).then((cache) => cache.put(request, copy));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match("/")) || caches.match("/offline.html")));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(ASSET_CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
