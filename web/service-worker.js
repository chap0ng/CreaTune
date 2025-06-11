const CACHE_NAME = 'CreaTune-cache-v12'; // <<< INCREMENTED cache version
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',

  // Core scripts
  './js/client/websocket-client.js',
  './js/creatones/soil.js',
  './js/creatones/light.js',
  './js/creatones/temp.js', 
  './js/creatones/lightsoil.js',
  './js/creatones/tempsoil.js', // <<< ADDED TEMPSOIL.JS
  './js/creatones/templight.js', // This was already in your index.html, adding here for completeness
  './js/other/frame-slider.js',
  './js/other/Tone.js',
  // './js/other/audio-enabler.js', // This was commented out, ensure it's correct


  // Images & Sprites
  './images/creature.png', 
  './images/soil-background.jpg', // This seems like an old direct background, ensure it's still used or remove
  './sprites/creatures/soil-creature.png',
  './sprites/creatures/light-creature.png',
  './sprites/creatures/temp-creature.png', 
  './sprites/creatures/lightsoil-creature.png',
  './sprites/creatures/tempsoil-creature.png', // <<< ADDED TEMPSOIL-CREATURE.PNG
  './sprites/creatures/templight-creature.png', // <<< ADDED TEMPLIGHT-CREATURE.PNG
  
  './sprites/backgrounds/Background_soil.gif', 
  './sprites/backgrounds/Background_light.gif',
  './sprites/backgrounds/Background_temp.gif', 
  // './sprites/backgrounds/Background_lightsoil.gif', // <<< ADD IF YOU HAVE ONE
  // './sprites/backgrounds/Background_tempsoil.gif', // <<< ADD IF YOU HAVE ONE
  // './sprites/backgrounds/Background_templight.gif', // <<< ADD IF YOU HAVE ONE

  './sprites/frame/frameropeh.png',
  './sprites/frame/frameropel.png',
  './sprites/frame/knotbotleft.png',
  './sprites/frame/knotbotright.png',
  './sprites/frame/knottopleft.png',
  './sprites/frame/knottopright.png',


  // Icons
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  console.log(`🔧 Service Worker installing: ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`📦 Cache opened: ${CACHE_NAME}`);
        return Promise.all(
          urlsToCache.map(url => {
            return fetch(url, { cache: 'no-store' }) // Fetch fresh versions during install
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
                }
                return cache.put(url, response);
              })
              .catch(error => {
                console.error(`❌ Failed to cache ${url}:`, error);
                // Optionally, don't let one failed asset break the entire cache install
                // For critical assets, you might want it to fail.
              });
          })
        ).then(() => {
            console.log('✅ All specified files attempted to cache in:', CACHE_NAME);
        });
      })
      .then(() => {
        self.skipWaiting();
      })
      .catch(error => {
        console.error(`❌ Cache install process failed for ${CACHE_NAME}:`, error);
      })
  );
});

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
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip WebSocket requests and non-GET requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Cache hit - return response
        if (cachedResponse) {
          // console.log('📂 Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache - fetch from network
        // console.log('🌐 Fetching from network:', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
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
          if (event.request.mode === 'navigate' && event.request.headers.get('accept').includes('text/html')) {
            console.log('↩️ Offline fallback to index.html for navigation request.');
            return caches.match('./index.html');
          }
          // For other types of requests, you might want to return a specific offline response or nothing
          // return new Response("Offline. Please check your connection.", {
          //   status: 503, // Service Unavailable
          //   headers: { 'Content-Type': 'text/plain' }
          // });
        });
      })
  );
});