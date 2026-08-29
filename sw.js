const CACHE_NAME = "catfood-v4";

const APP_SHELL = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/main.js",
  "/js/calc.js",
  "/js/storage.js",
  "/js/mealPlanner.js",
  "/manifest.webmanifest",
  "/assets/svg/favicon.svg",
  "/assets/svg/cat.svg",
  "/assets/svg/cat-paw.svg",
  "/assets/svg/cat-bowl.svg",
  "/assets/svg/cat-food.svg",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/icon-maskable-512.png",
  "/assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isGoogleFonts =
    url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com";

  if (isGoogleFonts) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("Offline und nicht im Cache.");
  }
}
