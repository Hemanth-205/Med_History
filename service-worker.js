const CACHE_NAME = 'medhistory-v1';
const ASSETS_TO_CACHE = [
    '/',
    'index.html',
    'login.html',
    'dashboard.html',
    'doctor_index.html',
    'doctor_dashboard.html',
    'about.html',
    'reset-password.html',
    'offline.html',
    'css/style.css',
    'js/app.js',
    'js/supabase-config.js',
    'manifest.json',
    'assets/icons/icon-192x192.png',
    'assets/icons/icon-512x512.png'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Pre-caching assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('SW: Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request)
                .then((networkResponse) => {
                    // Don't cache supabase or external API calls here for now, 
                    // just static assets if they weren't in precache
                    return networkResponse;
                })
                .catch(() => {
                    // If it's a page navigation, show offline page
                    if (event.request.mode === 'navigate') {
                        return caches.match('offline.html');
                    }
                    return null;
                });
        })
    );
});
