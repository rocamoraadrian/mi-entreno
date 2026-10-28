/* Service worker de Mi Entreno
 * - Precarga los archivos de la app (funciona sin conexión una vez instalada).
 * - Nunca guarda en caché peticiones a terceros (YouTube, CDNs, Open Food Facts):
 *   esas funciones necesitan Internet y la app lo indica.
 * - Los datos personales (fotos, registros) NO pasan por aquí: viven en IndexedDB del dispositivo.
 */
const CACHE = 'mi-entreno-37edb5ec00';
const PRECACHE = ["./app-R2RGNLXL.js","./app-f4a3bdfa43.css","./chunk-25TRP5E7.js","./chunk-2GOP3BW5.js","./chunk-2UNFAKYH.js","./chunk-3LXGL7PL.js","./chunk-4BOBZ47E.js","./chunk-5FC3IAAU.js","./chunk-7EMMDNUP.js","./chunk-7FLYDKAJ.js","./chunk-A7NJSI2D.js","./chunk-AZVWAUKZ.js","./chunk-BD64HJFE.js","./chunk-DBNDUMSY.js","./chunk-DNBDHIER.js","./chunk-DZOIN6NX.js","./chunk-FZ72BJHL.js","./chunk-G5TPTVHR.js","./chunk-GELKTNI6.js","./chunk-GTZ7OINP.js","./chunk-HFMYTIWL.js","./chunk-I5G3HRTI.js","./chunk-JKIATYB6.js","./chunk-JLQRE72O.js","./chunk-K4U6YHWQ.js","./chunk-LD2E2RFH.js","./chunk-N4FYQQDX.js","./chunk-OBP6WRRD.js","./chunk-OGKIC4WV.js","./chunk-OJEUSQGZ.js","./chunk-PFRYA3SP.js","./chunk-SWSFQNZE.js","./chunk-T7KHMELS.js","./chunk-U4AU4PO2.js","./chunk-UMHHRIZH.js","./chunk-UP3ZQR5F.js","./chunk-VJUGBMHZ.js","./chunk-WVUBUR46.js","./chunk-Z2I5B62B.js","./chunk-Z66UM5Y7.js","./chunk-ZENT7W3E.js","./chunk-ZVOK3GDR.js","./pdf.worker-0613f41490.mjs","./apple-touch-icon.png","./favicon.svg","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./aperturas-polea.webp","./elevaciones-laterales-mancuernas.webp","./extension-triceps-polea-cuerda.webp","./press-banca-barra.webp","./press-inclinado-mancuernas.webp","./press-militar-mancuernas.webp","./index.html","./manifest.webmanifest"];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('mi-entreno-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // terceros: red directa, sin caché

  // Navegación: index.html desde caché (app de una sola página)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html', { ignoreSearch: true }).then((r) => r || caches.match('./')))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});

// Al pulsar la notificación del temporizador, enfocar la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow('./');
    })
  );
});
