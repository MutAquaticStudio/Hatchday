/* Service worker của Hatchday: mở nhanh (cache tài nguyên đã băm tên), mở được khi mất mạng (trang đã tải), nhận thông báo đẩy.
   Chỉ cache cùng origin; không bao giờ cache cuộc gọi tới Supabase hay bất kỳ origin nào khác. Đổi VERSION khi sửa luật cache. */
const VERSION = 'v1';
const CACHE = 'hatchday-' + VERSION;

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('hatchday-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Tài nguyên băm tên (assets/): cache trước, tải lần đầu thì lưu
  if (url.pathname.includes('/assets/')) {
    e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(req); if (hit) return hit; const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }));
    return;
  }
  // Trang: mạng trước, mất mạng thì dùng bản đã lưu
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { if (res.ok) caches.open(CACHE).then(c => c.put('./', res.clone())); return res; }).catch(async () => (await caches.match('./')) || Response.error()));
    return;
  }
  // Biểu tượng, manifest: dùng bản lưu và cập nhật nền
  e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(req); const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit); return hit || net; }));
});

/* Thông báo đẩy: máy chủ gửi { title, body, tag, url }. (Máy chủ gửi push chưa có; xem docs/HANDOFF.md.) */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { /* bỏ qua */ }
  e.waitUntil(self.registration.showNotification(d.title || 'Hatchday', { body: d.body || 'Bé đang nhớ bạn!', icon: './icon.svg', badge: './icon.svg', tag: d.tag || 'hatchday', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => { const c = list[0]; return c ? c.focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || './'); }));
});
