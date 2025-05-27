// service-worker.js
const CACHE_NAME = 'CreaTune-cache-v7'; // Incremented cache version
const urlsToCache = [
  './', // Essential for the root
  './index.html',
  './styles.css',
  './manifest.json',

  // Core scripts
  './js/client/websocket-client.js',
  './js/creatones/soil.js',
  // './js/creatones/light.js', // Uncomment if this file exists and is needed offline
  // './js/creatones/creature-hidder.js', // Uncomment if this file exists and is needed offline
  './js/other/frame-slider.js', // Corrected path
  './js/other/Tone.js', // Caching local Tone.js as used in index.html

  // Images
  './images/creature.png',
  './images/soil-background.jpg',

  // Sprites (adjust paths if these specific files exist)
  './sprites/creatures/soil-creature.png',
  // './sprites/backgrounds/soil-background.png', // Example: if you have this file
  // './sprites/creatures/light-creature.png', // Uncomment if this file exists and is needed offline
  // './sprites/creatures/idle-creature.png', // Uncomment if this file exists and is needed offline

  // Icons
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log(`🔧 Service Worker installing: ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`📦 Cache opened: ${CACHE_NAME}`);
        return cache.addAll(urlsToCache)
          .then(() => {
            console.log('✅ All specified files cached successfully in:', CACHE_NAME);
          })
          .catch(error => {
            console.error(`❌ Cache.addAll failed for ${CACHE_NAME}:`, error);
            // For debugging, try to see which URL might have caused it
            // This often happens if one of the URLs in urlsToCache returns a 404 or other error
            urlsToCache.forEach(url => {
              fetch(url).then(res => {
                if (!res.ok) {
                  console.error(`Failed to fetch for caching: ${url} - Status: ${res.status}`);
                }
              }).catch(fetchErr => {
                console.error(`Network error trying to fetch for caching: ${url}`, fetchErr);
              });
            });
          });
      })
      .then(() => {
        self.skipWaiting(); // Force activate immediately
      })
      .catch(error => {
        // This catch is for errors in caches.open or the skipWaiting part
        console.error(`❌ Cache install process failed for ${CACHE_NAME}:`, error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log(`⚡ Service Worker activating: ${CACHE_NAME}`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log(`✅ Service Worker activated: ${CACHE_NAME}`);
      return self.clients.claim(); // Take control immediately
    })
  );
});

// Fetch event - serve from cache when offline, with better error handling
self.addEventListener('fetch', event => {
  // Skip WebSocket requests
  if (event.request.url.startsWith('ws://') || event.request.url.startsWith('wss://')) {
    return; // Let WebSocket requests pass through normally
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return; // Only cache GET requests
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return the response
        if (response) {
          // console.log('📂 Serving from cache:', event.request.url);
          return response;
        }
        
        // Not in cache - fetch from network
        // console.log('🌐 Fetching from network:', event.request.url);
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(
          networkResponse => {
            // Check if response is valid to cache
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              // Don't cache error responses or opaque responses unless intended
              return networkResponse;
            }

            // Clone the response to cache it
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                // console.log('💾 Caching new resource:', event.request.url);
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
          console.error('🚫 Fetch failed for:', event.request.url, error);
          
          // Fallback for offline navigation to HTML pages
          if (event.request.mode === 'navigate' && event.request.url.endsWith('.html')) {
            console.log('↩️ Offline fallback to index.html for navigation request.');
            return caches.match('./index.html');
          }
          
          // You can add more specific fallbacks for other asset types if needed
          // For example, a placeholder image or a generic "offline" message for JS/CSS.
          // For now, it will just fail if not in cache and network fails.
          return new Response(`Network error: ${error.message}. Resource not available offline.`, {
            status: 408, // Request Timeout
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});