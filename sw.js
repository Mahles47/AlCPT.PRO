const CACHE_NAME = 'alcpt-pro-v16';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// تثبيت الـ Service Worker وحفظ الملفات الأساسية
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// تفعيل وتطهير الكاش القديم تماماً
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
    }).then(() => self.clients.claim())
  );
});

// استراتيجية جلب البيانات
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // صفحات التنقل: الشبكة أولاً عشان أي تحديث يوصل فوراً، والكاش احتياطي وقت الأوفلاين
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
        return networkResponse;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // باقي الملفات الثابتة: الكاش أولاً زي ما هو
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });
        return networkResponse;
      });
    }).catch(() => caches.match('./index.html'))
  );
});
