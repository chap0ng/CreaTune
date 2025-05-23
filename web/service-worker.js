// service-worker.js
const CACHE_NAME = 'CreaTune-cache-v4';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  // Core scripts with correct paths
  './js/client/websocket-client.js',
  './js/creatones/soil.js',
  './js/creatones/light.js',
  './js/creatones/creature-hidder.js',
  './js/frame/frame-slider.js',
  // Images and sprites
  './images/soil-background.jpg',
  './sprite/soil-background.png',
  './sprites/creatures/soil-creature.png',
  // Icons
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  // External CDN (Tone.js) - will be cached when fetched
  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('CreaTune cache opened');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('All files cached successfully');
        self.skipWaiting(); // Force activate immediately
      })
      .catch(error => {
        console.error('Cache install failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      self.clients.claim(); // Take control immediately
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  // Skip WebSocket requests
  if (event.request.url.startsWith('ws://') || event.request.url.startsWith('wss://')) {
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return the response
        if (response) {
          console.log('Serving from cache:', event.request.url);
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(
          response => {
            // Check if response is valid
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                console.log('Caching new resource:', event.request.url);
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(error => {
          console.error('Fetch failed:', error);
          
          // Fallback for offline use
          if (event.request.url.endsWith('.html')) {
            return caches.match('./index.html');
          }
          
          // For missing JS files, try to serve from cache or return a helpful error
          if (event.request.url.endsWith('.js')) {
            return new Response(
              `console.error('Failed to load ${event.request.url}');`,
              { headers: { 'Content-Type': 'application/javascript' } }
            );
          }
        });
      })
  );
});