// Mi Turno SS: guarda la app en el teléfono para que funcione sin conexión.
const VERSION = 'mi-turno-v2';
const ASSETS = ['./', './index.html', './pdf.min.js', './pdf.worker.min.js', './manifest.webmanifest',
  './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((k) => k !== VERSION && k !== 'share-inbox' && k !== 'fonts')
    .map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Android: PDF recibido con "Compartir"
  if (req.method === 'POST' && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const f = fd.get('pdf');
        if (f && f.size) {
          const c = await caches.open('share-inbox');
          await c.put('shared.pdf', new Response(f, { headers: { 'content-type': 'application/pdf', 'x-name': encodeURIComponent(f.name || 'grilla.pdf') } }));
        }
      } catch (err) {}
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;

  // tipografías: se guardan la primera vez que se usan
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open('fonts').then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => new Response('', { status: 504 })))));
    return;
  }
  if (url.origin !== location.origin) return;

  // app: responde desde el teléfono y se actualiza sola cuando hay internet
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const key = req.mode === 'navigate' ? './index.html' : req;
    const hit = await c.match(key, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    return (await fresh) || new Response('Sin conexión', { status: 503 });
  }));
});
