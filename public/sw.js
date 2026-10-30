const CACHE_NAME = 'mapcraft-v3';

const STATIC_PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.svg?v=2',
  './icons/icon-512.svg?v=2',
];

// 安裝階段：預先快取核心 App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE).catch(() => {
        // 部分檔案若建置時期尚未產出，不阻斷安裝
      });
    })
  );
  self.skipWaiting();
});

// 啟動階段：清理舊快取並立即接管控制權
self.addEventListener('activate', (event) => {
  event.waitUntil(
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
  self.clients.claim();
});

// 請求攔截：HTML 導覽使用 Network-First 確保部署更新即時生效，靜態資源使用 Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 外部 API 與 LLM 呼叫一律直通網路（絕不快取金鑰或串流）
  if (
    url.origin !== self.location.origin ||
    event.request.method !== 'GET' ||
    url.pathname.includes('/v1/')
  ) {
    return;
  }

  const acceptHeader = event.request.headers.get('accept') || '';
  const isHtmlNavigation =
    event.request.mode === 'navigate' ||
    acceptHeader.includes('text/html') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  // 2. HTML 與頁面導覽採用 Network-First，避免舊版 index.html 卡住新版 JS bundle
  if (isHtmlNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. 其他靜態資源使用 Stale-While-Revalidate 策略
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
