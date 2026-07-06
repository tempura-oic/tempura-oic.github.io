const CACHE_NAME = 'smart-remote-mock-v1';
const ASSETS = [
    './',
    './index.html',
    './index.css',
    './app.js',
    './manifest.json',
    './icon.svg',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700&display=swap',
    'https://unpkg.com/react@18/umd/react.development.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (e) => {
    // ブラウザでのJSX変換を含むため、まずアセット読み込み時はキャッシュ優先（オフライン対応）とする
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(e.request).then((networkResponse) => {
                if (networkResponse.status === 200) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, networkResponse.clone());
                    });
                }
                return networkResponse;
            }).catch(() => {
                return Response.error();
            });
        })
    );
});
