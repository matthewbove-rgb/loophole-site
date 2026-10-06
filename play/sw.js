// Retired: the game moved to https://matthewbove-rgb.github.io/Loophole-public/
// This worker replaces the old cache-first worker: it clears the old caches, unregisters itself and reloads open pages (which now redirect).
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{e.waitUntil((async()=>{try{for(const k of await caches.keys())await caches.delete(k);}catch(err){}
  try{await self.registration.unregister();}catch(err){}
  try{for(const c of await self.clients.matchAll({type:'window'}))c.navigate(c.url);}catch(err){}})());});
