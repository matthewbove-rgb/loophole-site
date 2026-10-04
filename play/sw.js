// LOOPHOLE service worker: offline play + updates without a manual release step (r5 #1).
// - The page (navigations) is stale-while-revalidate: the cached page starts instantly (offline too) and a fresh copy is
//   fetched in the background, bypassing the HTTP cache, so the NEXT launch runs the new build. No VERSION bump is needed
//   when only index.html changes. When the fresh page differs, open pages get a message ('lh-updated') and show a toast.
// - Precache bypasses the HTTP cache too (cache:'reload'); otherwise a VERSION bump re-cached the stale page (max-age=600).
// - Bump VERSION when the ASSETS list or the icons change.
const VERSION = 'loophole-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function isPage(req, url) {
  return req.mode === 'navigate' || (url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname) && req.destination === 'document');
}
// fetch the page past the HTTP cache; store it under both keys; tell open pages when it changed
function refreshPage(url) {
  return fetch(url, { cache: 'no-cache' }).then(res => {
    if (!res || !res.ok) return res;
    const keep = res.clone();
    return caches.open(VERSION).then(c => c.match('./index.html').then(old => Promise.all([old ? old.text() : '', keep.clone().text()]))
      .then(([a, b]) => Promise.all([c.put('./index.html', keep.clone()), c.put('./', keep)]).then(() => {
        if (a && a !== b) return self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(cl => { try { cl.postMessage('lh-updated'); } catch (e) {} }));
      }))).then(() => res);
  });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isPage(req, url)) {
    const net = refreshPage(url.origin + url.pathname);
    e.waitUntil(net.catch(() => {}));
    e.respondWith(caches.match('./index.html').then(hit => hit || net).catch(() => net));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match('./index.html'))));
});
