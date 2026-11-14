// Thông báo đẩy phía trình duyệt: service worker nhận push (giả lập bằng CDP ServiceWorker.deliverPushMessage, đúng định dạng
// push_pick gửi), hiện thông báo đúng tiêu đề/nội dung/tag/đường dẫn ?from=push, gộp theo tag, payload hỏng vẫn có thông báo mặc định,
// và bật thông báo trong Chỉ số không lỗi khi trình duyệt không có dịch vụ push (bản Chơi thử dùng nhắc nhở cục bộ).
// Phần mã hoá Web Push + VAPID của Worker có test riêng: npx vitest run workers. Gửi thật tới FCM/Apple cần thử trên thiết bị.
// Chạy sau `npm run build`: node scripts/push-check.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const PORT = 4195, ORIGIN = `http://localhost:${PORT}`;
const srv = http.createServer((q, r) => { let f = join(root, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html'); r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(PORT);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : ''));
(async () => {
  const b = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); // headless mới: bản headless cũ luôn từ chối thông báo
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 } });
  await ctx.grantPermissions(['notifications'], { origin: ORIGIN });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGE ' + e.message));
  const cdp = await ctx.newCDPSession(p); let regId = null; const swErr = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', e => { const r = e.registrations?.find(x => !x.isDeleted); if (r) regId = r.registrationId; });
  cdp.on('ServiceWorker.workerErrorReported', e => swErr.push(e.errorMessage?.errorMessage || 'sw error'));
  await cdp.send('ServiceWorker.enable');
  await p.goto(ORIGIN + '/'); await p.waitForSelector('#demo');
  ok('service worker đăng ký và sẵn sàng', await p.evaluate(async () => !!(await navigator.serviceWorker.ready).active));
  for (let i = 0; i < 40 && !regId; i++) await p.waitForTimeout(100);
  ok('trang có quyền thông báo (đã cấp)', (await p.evaluate(() => Notification.permission)) === 'granted');
  const push = data => cdp.send('ServiceWorker.deliverPushMessage', { origin: ORIGIN, registrationId: regId, data });
  const notes = () => p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(n => ({ title: n.title, body: n.body, tag: n.tag, url: n.data && n.data.url })));
  const wait = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { const n = await notes(); if (fn(n)) return n; await p.waitForTimeout(100); } return notes(); };

  // đúng định dạng push_pick (supabase/migrations/20261216000000_push.sql): title, body, tag, url
  await push(JSON.stringify({ title: 'Bé đói rồi', body: 'Bánh Bò đang chờ bạn cho ăn nè!', tag: 'care', url: './?from=push&k=care' }));
  let n = await wait(l => l.length >= 1);
  ok('push chăm bé: hiện thông báo đúng tiêu đề, nội dung, tag, đường dẫn', n.length === 1 && n[0].title === 'Bé đói rồi' && n[0].body.includes('Bánh Bò') && n[0].tag === 'care' && n[0].url === './?from=push&k=care', JSON.stringify(n));
  await push(JSON.stringify({ title: 'Bé vẫn đói', body: 'Lần hai', tag: 'care', url: './?from=push&k=care' }));
  n = await wait(l => l.some(x => x.title === 'Bé vẫn đói'));
  ok('cùng tag thì thay thông báo cũ (không chồng nhiều cái)', n.filter(x => x.tag === 'care').length === 1 && n.find(x => x.tag === 'care').title === 'Bé vẫn đói', JSON.stringify(n));
  await push(JSON.stringify({ title: 'Có thư mới', body: 'Bạn có quà trong hộp thư', tag: 'mail', url: './?from=push&k=mail' }));
  n = await wait(l => l.some(x => x.tag === 'mail'));
  ok('push thư/quà: thêm một thông báo riêng', n.length === 2 && n.some(x => x.tag === 'mail'), JSON.stringify(n));
  await push('không-phải-json');
  n = await wait(l => l.some(x => x.tag === 'hatchday'));
  ok('payload hỏng: vẫn hiện thông báo mặc định, không lỗi service worker', n.some(x => x.tag === 'hatchday' && x.title === 'Hatchday') && swErr.length === 0, JSON.stringify(n) + ' ' + swErr.join('|'));

  // bản Chơi thử: bật thông báo trong Chỉ số → dùng nhắc nhở cục bộ, không lỗi
  await p.click('#demo'); await p.click('button[type=submit]').catch(() => {}); await p.waitForSelector('#a-house', { timeout: 30000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector('#btn-settings').click()); await p.waitForTimeout(400);
  const toggle = await p.evaluate(() => { const el = document.querySelector('#btn-notify'); if (!el) return 'none'; el.click(); return el.id || el.name || 'ok'; });
  await p.waitForTimeout(800);
  ok('bật nhắc nhở trong Chỉ số không gây lỗi trang', toggle !== 'none' && errs.length === 0, toggle + ' ' + errs.join('|'));
  await b.close(); srv.close();
  console.log(out.join('\n')); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
