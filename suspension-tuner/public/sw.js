// 舊版 SW 曾用 cache-first 把錯誤的 HTML 當成 JS 快取，導致白畫面。
// 此檔僅供「已註冊舊 SW 的瀏覽器」在更新檢查時載入：清掉 Cache Storage 並解除註冊。應用程式已不再註冊 SW。
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .catch(() => self.registration.unregister())
  );
});
