const CACHE_NAME = 'suspension-tuner-v2';
const STATIC_ASSETS = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function canCacheRequest(req) {
  if (req.method !== 'GET') return false;
  try {
    const u = new URL(req.url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Netlify SPA fallback: missing /assets/*.js still returns 200 text/html — never cache that as a script. */
function shouldStoreResponse(req, res) {
  if (!res.ok || !canCacheRequest(req)) return false;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (req.destination === 'script' && !ct.includes('javascript')) return false;
  if (req.destination === 'style' && !ct.includes('css')) return false;
  return true;
}

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/rest/v1/') || e.request.url.includes('supabase')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Network-first: new deploys change hashed filenames; cache-first + stale index = HTML served as JS (MIME error).
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (shouldStoreResponse(e.request, res)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
