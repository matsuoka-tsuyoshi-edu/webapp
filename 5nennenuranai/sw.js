/**
 * sw.js - Service Worker
 * 方針：Network-First（オンライン時はHTTPキャッシュを無視して最新を取得し、オフライン時のみキャッシュを返す）
 */
const CACHE_NAME = '5nen-takakukei-cache-v1.0.4';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/steps.js',
  './js/turtle.js',
  './js/judge.js',
  './js/explain.js',
  './js/confetti.js',
  './js/pwa.js',
  './js/app.js',
  './vendor/blockly/blockly.min.js',
  './vendor/blockly/media/sprites.svg',
  './vendor/blockly/media/click.mp3',
  './vendor/blockly/media/drop.mp3',
  './vendor/blockly/media/delete.mp3',
  './vendor/blockly/media/disconnect.mp3',
  './vendor/blockly/media/handopen.cur',
  './vendor/blockly/media/handclosed.cur',
  './vendor/blockly/media/handdelete.cur',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './manual/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of PRECACHE_URLS) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res && res.ok) {
            await cache.put(url, res);
          }
        } catch (err) {
          // 個別ファイルのプリキャッシュ失敗は許容
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((networkRes) => {
        if (networkRes && networkRes.ok) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkRes;
      })
      .catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        throw new Error('Offline and not cached');
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});
