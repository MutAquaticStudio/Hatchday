// Thú tương tác với thế giới: xích đu, bập bênh, cầu trượt, bóng, vịt (Công viên); đài phun, ghế đá, sân khấu, chim bồ câu (Quảng trường);
// bàn trà và mèo (Tiệm trà). Chạy sau `npm run build`: node scripts/interact-check.mjs   (cần Playwright + Chromium). Cần ?dev (window.__petPos).
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const PORT = 4199;
const srv = http.createServer((q, r) => { let f = join(root, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html'); r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(PORT);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : ''));
const until = async (p, fn, ms = 10000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  const URL0 = `http://localhost:${PORT}/?dev`;
  const start = async () => { await p.waitForSelector('#demo'); await p.click('#demo'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1200); };
  await p.goto(URL0); await p.waitForSelector('#demo'); await p.click('#demo'); await p.click('button[type=submit]'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1200);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('hatchday-demo')); d.pet.bond_xp = 800; d.pet.nl = 99; d.pet.no = 90; d.pet.vui = 40; d.pet.sach = 95; d.pet.stats_at = new Date().toISOString(); d.coins = 500; localStorage.setItem('hatchday-demo', JSON.stringify(d)); localStorage.setItem('hatchday-tour', '1'); });
  await p.goto(URL0); await start();
  const goTo = async place => { await p.click('#scene-tag'); await p.waitForSelector('#map:not([hidden])'); await p.click(`#map [data-pin="${place}"]`); await p.click(`#map [data-go-place="${place}"]`); await until(p, () => document.querySelector('#map')?.hidden !== false, 8000); await p.waitForTimeout(2500); };
  /** Bấm điểm chạm (bằng DOM, vì nhãn ở xa có thể bị ẩn), theo dõi thú đến hết kịch bản; trả về { maxY, minZ, maxZ, ran, endY }. */
  const interact = async (hot, ms = 14000) => {
    await p.evaluate(h => document.querySelector(`.hot[data-hot="${h}"]`).click(), hot);
    const r = { maxY: 0, ran: false, minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9, endY: 0 }; const t0 = Date.now(); let done = 0;
    while (Date.now() - t0 < ms) {
      const [x, y, z, s] = await p.evaluate(() => window.__petPos());
      if (s) { r.ran = true; r.maxY = Math.max(r.maxY, y); r.minX = Math.min(r.minX, x); r.maxX = Math.max(r.maxX, x); r.minZ = Math.min(r.minZ, z); r.maxZ = Math.max(r.maxZ, z); done = 0; } else if (r.ran) { r.endY = done++ ? Math.min(r.endY, y) : y; if (done > 6) break; }
      await p.waitForTimeout(100);
    }
    return r;
  };
  const calm = () => p.waitForTimeout(1200);

  await goTo('park');
  let r = await interact('swing'); ok('xích đu: bé nhảy lên ghế và đung đưa trên cao rồi xuống đất', r.ran && r.maxY > 0.8 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2), endY: +r.endY.toFixed(2) })); await calm();
  r = await interact('seesaw'); ok('bập bênh: bé ngồi đầu bập bênh, lên xuống rồi xuống đất', r.ran && r.maxY > 0.5 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2) })); await calm();
  r = await interact('slide'); ok('cầu trượt: leo lên đỉnh (cao > 1,6) rồi trượt ra phía trước', r.ran && r.maxY > 1.6 && r.maxZ - r.minZ > 3 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2), dz: +(r.maxZ - r.minZ).toFixed(1) })); await calm();
  r = await interact('duck'); ok('cho vịt ăn: bé ngồi xổm bên ao (kịch bản chạy xong)', r.ran && r.endY < 0.15); await calm();
  r = await interact('ball'); ok('đá bóng: bé chạy tới đá (kịch bản chạy xong)', r.ran && r.endY < 0.15);
  ok('đá bóng: bóng bay đi rồi bé đuổi theo nhặt lại (thú đi tiếp sau kịch bản)', await until(p, () => { const [, , , s] = window.__petPos(); return !s; }, 6000));
  await p.waitForTimeout(3500);

  await goTo('plaza');
  r = await interact('fountain'); ok('đài phun nước: bé nhảy tưng ở mép đài', r.ran && r.maxY > 0.3 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2) })); await calm();
  r = await interact('bench0'); ok('ghế đá: bé nhảy lên ngồi (cao ≈ 0,55) rồi xuống', r.ran && r.maxY > 0.5 && r.maxY < 1.3 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2) })); await calm();
  r = await interact('stage', 16000); ok('sân khấu: bé lên sân khấu (z ≈ -7,5, cao ≥ 0,5) biểu diễn rồi xuống', r.ran && r.maxY > 0.5 && r.minZ < -7 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2), minZ: +r.minZ.toFixed(1) }));

  await goTo('tea');
  r = await interact('table0'); ok('bàn trà: bé nhảy lên ghế (cao ≈ 0,5), nhấp trà rồi xuống', r.ran && r.maxY > 0.4 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2) })); await calm();
  r = await interact('cat'); ok('mèo ngủ: bé lại gần vuốt ve (kịch bản chạy xong)', r.ran && r.endY < 0.15);
  r = await interact('order', 3000); ok('quầy gọi món mở cửa hàng, không đổ kịch bản', !r.ran || r.endY < 0.15);
  ok('không có lỗi console/trang', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(out.join('\n')); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
