// service-worker.js
const CACHE_NAME = 'creatune-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/simplified-styles.css',
  '/css/state-styles.css',
  '/js/frame-anim.js',
  '/js/drag-container.js',
  '/js/websocket-client.js',
  '/js/state-manager.js',
  '/js/enhanced-synth-logic.js',
  '/js/enhanced-creatures.js',
  '/assets/frame-sprite.png',
  '/assets/tab-top.png',
  '/assets/top-bar-image.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js',
  'https://fonts.googleapis.com/css2?family=VT323&display=swap'
];

// Install event - Cache assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing Service Worker...');
  
  // Skip waiting to ensure the new service worker activates immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.filter(cacheName => {
            return cacheName !== CACHE_NAME;
          }).map(cacheName => {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - Network with cache fallback strategy
self.addEventListener('fetch', event => {
  // Skip WebSocket requests
  if (event.request.url.includes('ws://') || event.request.url.includes('wss://')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone the response for caching
        const responseClone = response.clone();
        
        caches.open(CACHE_NAME)
          .then(cache => {
            // Don't cache responses that aren't successful
            if (response.status === 200) {
              cache.put(event.request, responseClone);
            }
          });
        
        return response;
      })
      .catch(() => {
        // If network fetch fails, try to serve from cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // For navigation requests, return the offline page if available
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            // Otherwise, just return an error response
            return new Response('Network error occurred', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Handle messages from the main application
self.addEventListener('message', event => {
  console.log('[Service Worker] Received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});