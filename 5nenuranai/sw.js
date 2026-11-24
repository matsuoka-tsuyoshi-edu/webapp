/**
 * Service Worker - 魔法のプログラミング占いの館
 * Chrome PWAインストール要件（fetchハンドラ）を満たしつつ、
 * ブラウザキャッシュによる古いファイルの読み込みを防ぐため Network-Only（cache: 'no-store'）で動作します。
 */
const SW_VERSION = '20261124-04';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).catch(() => fetch(event.request))
  );
});
