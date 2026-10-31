/* Service worker de Mi Entreno
 * - Precarga los archivos de la app (funciona sin conexión una vez instalada).
 * - Nunca guarda en caché peticiones a terceros (YouTube, CDNs, Open Food Facts):
 *   esas funciones necesitan Internet y la app lo indica.
 * - Los datos personales (fotos, registros) NO pasan por aquí: viven en IndexedDB del dispositivo.
 */
const CACHE = 'mi-entreno-11802a7892';
const PRECACHE = ["./app-SNHKBFRY.js","./app-ddade5eca3.css","./chunk-2B7EUTBZ.js","./chunk-3F75HWGC.js","./chunk-4BOBZ47E.js","./chunk-4LXMUIFE.js","./chunk-4SGYN5LD.js","./chunk-4T4LUVZH.js","./chunk-5WJLJ7XD.js","./chunk-64DSRSCQ.js","./chunk-73V46D3P.js","./chunk-7AZ4234U.js","./chunk-7EMMDNUP.js","./chunk-AGPDBGTE.js","./chunk-AISUFIPF.js","./chunk-D6NDCSSR.js","./chunk-DDBR6KCE.js","./chunk-DFUZTSA5.js","./chunk-E3PNSPW4.js","./chunk-FJFEMW23.js","./chunk-FNBIHK5Z.js","./chunk-G52WM7SM.js","./chunk-G5TPTVHR.js","./chunk-G7LQQT7S.js","./chunk-GN5YZPEZ.js","./chunk-HX5Y7ALH.js","./chunk-I5G3HRTI.js","./chunk-JVW3CJ77.js","./chunk-KHCUBCUC.js","./chunk-LDQG66DQ.js","./chunk-MBNZK3LB.js","./chunk-N4FYQQDX.js","./chunk-NY3P7UDL.js","./chunk-OP27MCUX.js","./chunk-OZ4IIYWU.js","./chunk-Q2VA5EBF.js","./chunk-QIFIGOWG.js","./chunk-QJT3ZUAA.js","./chunk-QZXTDUOA.js","./chunk-S2EIRISK.js","./chunk-SWSFQNZE.js","./chunk-T2IUEFV7.js","./chunk-U4GSYZNF.js","./chunk-V2ZRL3F4.js","./chunk-V7B6663G.js","./chunk-VIXMHH7J.js","./chunk-VMCWDIPN.js","./chunk-XIRWQ5MK.js","./chunk-YIGIFLCF.js","./pdf.worker-0613f41490.mjs","./apple-touch-icon.png","./favicon.svg","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./aperturas-polea.webp","./elevaciones-laterales-mancuernas.webp","./extension-triceps-polea-cuerda.webp","./press-banca-barra.webp","./press-inclinado-mancuernas.webp","./press-militar-mancuernas.webp","./index.html","./manifest.webmanifest"];

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
  let due = items.filter((r) => r.at <= now + 90000 && r.at >= now - 20 * 60000 && !seen.has(r.id));
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
