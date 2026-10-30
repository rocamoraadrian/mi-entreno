/* Service worker de Mi Entreno
 * - Precarga los archivos de la app (funciona sin conexión una vez instalada).
 * - Nunca guarda en caché peticiones a terceros (YouTube, CDNs, Open Food Facts):
 *   esas funciones necesitan Internet y la app lo indica.
 * - Los datos personales (fotos, registros) NO pasan por aquí: viven en IndexedDB del dispositivo.
 */
const CACHE = 'mi-entreno-e2c2a90a31';
const PRECACHE = ["./app-CSRYDZFE.js","./app-f4a3bdfa43.css","./chunk-2FULKXMP.js","./chunk-2XMNVLVU.js","./chunk-2YDI2BVZ.js","./chunk-42J6PPLC.js","./chunk-4BOBZ47E.js","./chunk-54BNICEA.js","./chunk-5HPLX3CI.js","./chunk-6272KX24.js","./chunk-7EMMDNUP.js","./chunk-7QNTALRM.js","./chunk-ARVH3PNS.js","./chunk-BB46IW5C.js","./chunk-CJ7GL32E.js","./chunk-DZOIN6NX.js","./chunk-EE3BSZIG.js","./chunk-FDEGVQBF.js","./chunk-G5TPTVHR.js","./chunk-GLWNXD7K.js","./chunk-HJKNZHZU.js","./chunk-I5G3HRTI.js","./chunk-IKN6NRHJ.js","./chunk-IMDHYXF7.js","./chunk-JLVPP43S.js","./chunk-K4QW252Y.js","./chunk-KWSSB25J.js","./chunk-M3ONQPBJ.js","./chunk-N4FYQQDX.js","./chunk-NQCH2QJB.js","./chunk-NRQ22CHF.js","./chunk-ODF3WHUC.js","./chunk-ORTHH264.js","./chunk-QUNDJNU2.js","./chunk-SWSFQNZE.js","./chunk-VQYSO53J.js","./chunk-WI5C7ETW.js","./chunk-WZ3FJYRQ.js","./chunk-XUMNDXL3.js","./chunk-XW7ZQFS6.js","./chunk-YEJHLY2X.js","./chunk-YXQ4Y6LX.js","./chunk-Z66UM5Y7.js","./pdf.worker-0613f41490.mjs","./apple-touch-icon.png","./favicon.svg","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./aperturas-polea.webp","./elevaciones-laterales-mancuernas.webp","./extension-triceps-polea-cuerda.webp","./press-banca-barra.webp","./press-inclinado-mancuernas.webp","./press-militar-mancuernas.webp","./index.html","./manifest.webmanifest"];

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
