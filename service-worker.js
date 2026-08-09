// Service Worker for Semper Nexus
// Provides offline caching and improved performance

// Cache version - update this when deploying new versions
// Format: v{major}.{minor}.{patch}-{timestamp}
const CACHE_VERSION = 'v2.6.0-20260809';
const CACHE_NAME = `semper-nexus-${CACHE_VERSION}`;

// Assets to cache immediately on install.
// Paths are relative to the service worker scope, NOT root-absolute: the app
// serves from / on cloud.gov but /semper-nexus/ on GitHub Pages, and absolute
// paths 404 there. One 404 rejects cache.addAll, which failed the whole
// install and silently disabled offline support on every deploy target
// (the list also named two images that no longer exist).
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './lib/fa-checklists.js',
  './lib/secnav-data.js',
  './lib/alnav-data.js'
];
// manifest.json and icon.svg are NOT precached: Vite rewrites their
// references to hashed assets/ URLs in the build, so the root copies 404
// there. They get cached on first use by the fetch handler instead.

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches and notify clients
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        const oldCaches = cacheNames.filter(
          (name) => (name.startsWith('semper-nexus-') || name.startsWith('usmc-directives-') || name.startsWith('message-watch-')) && name !== CACHE_NAME
        );

        if (oldCaches.length > 0) {
          console.log('[Service Worker] Found old caches to delete:', oldCaches);
        }

        return Promise.all(
          oldCaches.map((name) => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        // Take control of all pages immediately
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients about the update
        return self.clients.matchAll({ type: 'window' });
      })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION
          });
        });
        console.log(`[Service Worker] Notified ${clients.length} clients about update to ${CACHE_VERSION}`);
      })
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Intercept cross-origin requests for offline functionality
  if (url.origin !== self.location.origin) {
    // List of all API and proxy hosts that should be cached for offline use
    const apiHosts = [
      'onrender.com',         // Custom proxy server
      'marines.mil',          // Marines.mil data
      'navy.mil',             // Navy data
      'igmc.marines.mil',     // IGMC checklists
      'esd.whs.mil',          // DoD forms
      'defense.gov',          // legacy DoD FMR host
      'war.gov',              // current DoD FMR host (rebrand)
      'travel.dod.mil'        // DTMO (JTR)
    ];

    // Use network-first strategy for all API and proxy requests
    // This ensures offline functionality works with any proxy
    // Use strict hostname matching to prevent malicious domain abuse
    if (apiHosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) {
      event.respondWith(networkFirst(request));
    }
    return;
  }

  // HTML documents use network-first. Cache-first on the document pinned the
  // app to a stale index.html indefinitely: the cached copy referenced an old
  // app.js query string and an old CSP connect-src, so a fresh deploy stayed
  // invisible and cross-origin fetches to the current proxy host were blocked.
  // Versioned assets keep cache-first, since their ?v= query busts the cache.
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // For same-origin requests, use cache-first strategy
  event.respondWith(cacheFirst(request));
});

/**
 * Cache-first strategy: Try cache, fall back to network
 * Best for static assets that don't change often
 */
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Serving from cache:', request.url);
      return cachedResponse;
    }

    console.log('[Service Worker] Fetching from network:', request.url);
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);

    // Return offline page if available. Relative to SW scope, matching the
    // precached URL - '/index.html' misses under the /semper-nexus/ base.
    const cachedResponse = await caches.match('./index.html');
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return generic error response
    return new Response('Offline - please check your internet connection', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

/**
 * Network-first strategy: Try network, fall back to cache
 * Best for API calls and dynamic content
 */
async function networkFirst(request) {
  try {
    console.log('[Service Worker] Network-first fetch:', request.url);
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Received SKIP_WAITING message');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[Service Worker] Clearing cache');
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[Service Worker] Cache cleared');
        return caches.open(CACHE_NAME);
      })
    );
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.source.postMessage({
      type: 'VERSION_INFO',
      version: CACHE_VERSION,
      cacheName: CACHE_NAME
    });
  }
});

console.log(`[Service Worker] Loaded successfully - version ${CACHE_VERSION}`);
