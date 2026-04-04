const CACHE_NAME = 'ollama-chat-v6';

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

// Fetch — bypass SW entirely for API calls, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Do NOT intercept API calls — let browser handle them natively.
  // Calling event.respondWith(fetch(event.request)) on POST requests with
  // a streaming body (e.g. /api/ollama/chat) causes "Error in input stream"
  // because the request body may already be locked/consumed.
  if (url.pathname.startsWith('/api/')) {
    return; // fallthrough → browser default network fetch
  }

  // Only GET requests should be cached
  if (event.request.method !== 'GET') {
    return;
  }

  // Cache-first for static assets
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
