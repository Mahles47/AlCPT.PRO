// =====================================================
// ALCPT Pro Quiz — Service Worker
// =====================================================

const CACHE_NAME = 'alcpt-pro-v2';
const STATIC_CACHE = 'alcpt-static-v2';

// الملفات اللي هتتخزن للاستخدام offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap'
];

// ===================== INSTALL =====================
self.addEventListener('install', event => {
  console.log('[SW] Installing ALCPT Pro...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        // Cache بالتدريج - لو فيه ملف فشل مش هيوقف الباقي
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
          )
        );
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting(); // فعّل الـ SW على طول
      })
  );
});

// ===================== ACTIVATE =====================
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== STATIC_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activated');
        return self.clients.claim(); // سيطر على كل التابات الحالية
      })
  );
});

// ===================== FETCH =====================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل الـ requests اللي مش HTTP/HTTPS
  if (!request.url.startsWith('http')) return;

  // استراتيجية: Cache First للـ static assets
  // Network First للباقي
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

// ===================== HELPERS =====================

function isStaticAsset(url) {
  const staticExtensions = ['.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
         url.hostname === 'fonts.googleapis.com' ||
         url.hostname === 'fonts.gstatic.com';
}

// Cache First: ابحث في الكاش الأول، لو مش موجود اجيب من النت
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Cache first failed:', error);
    return caches.match('./index.html'); // fallback للصفحة الرئيسية
  }
}

// Network First: اجيب من النت الأول، لو فيه مشكلة هات من الكاش
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Network failed, trying cache:', error);
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback للصفحة الرئيسية لو offline
    return caches.match('./index.html');
  }
}

// ===================== MESSAGES =====================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
  }
});
