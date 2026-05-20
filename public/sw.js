// Minimal service worker for offline shell + HuggingFace model cache.
// Network-first for app shell (so updates land quickly), cache-first for
// model assets (so the user doesn't re-download 80-800MB).

const APP_CACHE = 'mnm-app-v1';
const MODEL_CACHE = 'mnm-model-v1';
// HF Hub responses come from rotating CDN subdomains, so match by suffix.
// Once a model file is cached, it is served forever from MODEL_CACHE (no TTL,
// no revalidation) until the user clears site data or MODEL_CACHE is bumped.
const MODEL_HOST_SUFFIXES = [
  'huggingface.co',
  'hf.co',
  'xethub.hf.co',
];

function isModelHost(hostname) {
  return MODEL_HOST_SUFFIXES.some((s) => hostname === s || hostname.endsWith('.' + s));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) =>
      cache.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg']),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== APP_CACHE && k !== MODEL_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (isModelHost(url.hostname)) {
    event.respondWith(cacheFirst(req, MODEL_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, APP_CACHE));
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // Skip opaque responses — partial/corrupt opaque bodies cannot be inspected
  // and have no expiry once cached, so a single bad fetch would persist forever.
  if (res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error('offline and not cached');
  }
}
