/* Service worker de Mi Entreno
 * - Precarga los archivos de la app (funciona sin conexión una vez instalada).
 * - Nunca guarda en caché peticiones a terceros (YouTube, CDNs, Open Food Facts):
 *   esas funciones necesitan Internet y la app lo indica.
 * - Los datos personales (fotos, registros) NO pasan por aquí: viven en IndexedDB del dispositivo.
 */
const CACHE = 'mi-entreno-359a63fc5a';
const PRECACHE = ["./app-3d988b44d6.css","./app-7KI65O3P.js","./chunk-2B7EUTBZ.js","./chunk-2JMJIYNB.js","./chunk-2WRAJWIL.js","./chunk-4BOBZ47E.js","./chunk-5WJLJ7XD.js","./chunk-6BW76JGR.js","./chunk-6IVAKMMU.js","./chunk-6LSUJF35.js","./chunk-6PHCFIRI.js","./chunk-6Z5AR5MN.js","./chunk-7EMMDNUP.js","./chunk-AFNP5YRW.js","./chunk-B6LUG6RL.js","./chunk-BF4IL3RB.js","./chunk-COB4OE66.js","./chunk-DEVPWSCZ.js","./chunk-DGBVMJGI.js","./chunk-DMLC6CY2.js","./chunk-EA5OHTFB.js","./chunk-EX32RK2Q.js","./chunk-FFFG44RO.js","./chunk-FOKMDN4Z.js","./chunk-FP22BQNE.js","./chunk-G55WZVKP.js","./chunk-G5TPTVHR.js","./chunk-I4PYVTKZ.js","./chunk-I5G3HRTI.js","./chunk-ISHHO37A.js","./chunk-IVCYSE2F.js","./chunk-JY4NPBE5.js","./chunk-KBGTOAOB.js","./chunk-KCXOX56G.js","./chunk-LDQG66DQ.js","./chunk-MDCZDYVN.js","./chunk-MW4AXSXV.js","./chunk-N4FYQQDX.js","./chunk-NX4XZ2MI.js","./chunk-O53C6L6P.js","./chunk-O6DP6HBZ.js","./chunk-OG2WKDZR.js","./chunk-REZFZWJY.js","./chunk-RNENL4PM.js","./chunk-SSEUE27H.js","./chunk-SWSFQNZE.js","./chunk-U2JIS4TH.js","./chunk-UGAZFYLP.js","./chunk-V2ZRL3F4.js","./chunk-VNIHAVYY.js","./chunk-WSSUUYZW.js","./chunk-XN3PKJWO.js","./chunk-YDK2TJFR.js","./chunk-YW2SWHKG.js","./chunk-Z4KHJBXD.js","./pdf.worker-0613f41490.mjs","./apple-touch-icon.png","./favicon.svg","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./aperturas-polea.webp","./elevaciones-laterales-mancuernas.webp","./extension-triceps-polea-cuerda.webp","./fondo-atleta.webp","./press-banca-barra.webp","./press-inclinado-mancuernas.webp","./press-militar-mancuernas.webp","./index.html","./manifest.webmanifest"];

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
  // Entrenador con IA: el motor y el modelo de MediaPipe (de Google/jsDelivr) se guardan la primera vez
  // en una caché propia, para que la función siga funcionando sin conexión. No incluye datos personales.
  const isIA = (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/@mediapipe/tasks-vision@')) ||
    (url.hostname === 'storage.googleapis.com' && url.pathname.startsWith('/mediapipe-models/'));
  if (isIA) {
    event.respondWith(caches.open('ia-modelos-v1').then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
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

// Al pulsar una notificación: abrir la app (en la pantalla del aviso si la trae)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const hash = event.notification.data?.url || '';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { if (hash && 'navigate' in c) c.navigate('./' + hash).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow('./' + hash);
    })
  );
});

// ---------------- Recordatorios con la app cerrada ----------------
// Tu servidor de Cloudflare envía un aviso SIN contenido a la hora exacta. El texto
// (qué comida toca, etc.) se lee aquí, de los datos guardados en tu móvil.
function idb() {
  return new Promise((res, rej) => { const r = indexedDB.open('mi-entreno'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
function kvGet(dbh, key) {
  return new Promise((res) => {
    try { const q = dbh.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => res(q.result ? q.result.value : null); q.onerror = () => res(null); }
    catch (e) { res(null); }
  });
}
function kvSet(dbh, key, value) {
  return new Promise((res) => {
    try { const t = dbh.transaction('kv', 'readwrite'); t.objectStore('kv').put({ key, value, updatedAt: new Date().toISOString() }); t.oncomplete = () => res(); t.onerror = () => res(); }
    catch (e) { res(); }
  });
}
async function showDueReminders() {
  const now = Date.now();
  let dbh = null, items = [], shown = [], weekItems = [];
  try {
    dbh = await idb();
    const st = (await kvGet(dbh, 'reminders')) || {};
    items = st.items || [];
    weekItems = st.week || [];
    shown = (await kvGet(dbh, 'remindersShown')) || [];
  } catch (e) { /* sin datos */ }
  const seen = new Set(shown);
  const inWindow = items.filter((r) => r.at <= now + 90000 && r.at >= now - 20 * 60000);
  let due = inWindow.filter((r) => !seen.has(r.id));
  // Sin duplicados: si este aviso ya salió con la app abierta, Android exige mostrar algo al recibir
  // el push; se vuelve a poner con la MISMA etiqueta y en silencio, así sustituye al anterior.
  if (!due.length && inWindow.length) {
    const r = inWindow[inWindow.length - 1];
    await self.registration.showNotification(r.title, { body: r.body, tag: r.id, silent: true, icon: './icon-192.png', badge: './icon-192.png', data: { url: r.url || '#/agenda' } });
    return;
  }
  if (!due.length) {
    // Si llevas días sin abrir la app, usa el aviso de tu semana tipo a esa misma hora
    const week = 7 * 86400000;
    due = weekItems.filter((r) => { const d = (((now - r.at) % week) + week) % week; return d < 90000 || d > week - 90000; })
      .map((r) => ({ ...r, id: r.id + '|+' + Math.round(now / 60000) }))
      .filter((r) => !seen.has(r.id));
  }
  if (!due.length) due = [{ id: 'generico|' + now, title: 'Mi Entreno', body: 'Tienes un recordatorio. Abre tu agenda para ver qué toca.', url: '#/agenda' }];
  for (const r of due) {
    await self.registration.showNotification(r.title, { body: r.body, tag: r.id, icon: './icon-192.png', badge: './icon-192.png', data: { url: r.url || '#/agenda' }, vibrate: [200, 100, 200] });
    seen.add(r.id);
  }
  if (dbh) await kvSet(dbh, 'remindersShown', Array.from(seen).slice(-300));
}
self.addEventListener('push', (event) => { event.waitUntil(showDueReminders()); });
