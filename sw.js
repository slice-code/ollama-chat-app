const CACHE_NAME = 'ollama-chat-v9';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/ollama-chat.js',
  '/chat-ui/chat-ui.js',
  '/el.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css'
];

// Assets that change often — always fetch from network first
const NETWORK_FIRST_PATTERNS = ['.js', '.html', '/'];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Do NOT intercept API calls
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Only GET requests should be cached
  if (event.request.method !== 'GET') {
    return;
  }

  // Network-first for JS/HTML — always get latest code, fallback to cache if offline
  const isNetworkFirst = NETWORK_FIRST_PATTERNS.some(p =>
    url.pathname.endsWith(p) || url.pathname === '/'
  );

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets (images, icons, fonts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});
