// service-worker.js - Enables offline functionality and PWA features

const CACHE_NAME = 'creaTune-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './audio-engine.js',
  './ui-controller.js',
  './sprite-integration.js',
  './sensor-manager.js',
  './websocket-manager.js',
  './frame-anim.js',
  './drag-container.js',
  './manifest.json',
  './images/creature.png',
  './assets/frame-sprite.png',
  './assets/top-bar-image.png',
  './assets/tab-top.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=VT323&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
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
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  // Skip WebSocket requests
  if (event.request.url.startsWith('ws://')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return the response
        if (response) {
          return response;
        }
        
        // Clone the request for fetch
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(
          response => {
            // Check if response is valid
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response for caching
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(() => {
          // Fallback for offline access - return index.html for HTML requests
          if (event.request.url.match(/\.html$/) || event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});