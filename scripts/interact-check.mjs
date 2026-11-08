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
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, timezoneId: 'Asia/Ho_Chi_Minh' })).newPage();
  // cố định 10 giờ sáng giờ VN: chơi đồ chơi ban đêm (22:00–05:00) dễ bị cảm lạnh và bị chặn chơi, làm test phụ thuộc giờ chạy
  { const vn = new Date(Date.now() + 7 * 3600e3); vn.setUTCHours(3, 0, 0, 0); await p.clock.install({ time: vn }); await p.clock.resume(); }
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  const URL0 = `http://localhost:${PORT}/?dev&weather=clear`; // thời tiết cố định để kịch bản không phụ thuộc giờ chạy (mưa làm bé tự chạy đi trú)
  const start = async () => { await p.waitForSelector('#demo'); await p.click('#demo'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1200); };
  await p.goto(URL0); await p.waitForSelector('#demo'); await p.click('#demo'); await p.click('button[type=submit]'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1200);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('hatchday-demo')); d.pet.bond_xp = 800; d.pet.nl = 99; d.pet.no = 90; d.pet.vui = 40; d.pet.sach = 95; d.pet.stats_at = new Date().toISOString(); d.coins = 500; localStorage.setItem('hatchday-demo', JSON.stringify(d)); localStorage.setItem('hatchday-tour', '1'); });
  await p.goto(URL0); await start();
  const goTo = async place => { await p.click('#scene-tag'); await p.waitForSelector('#map:not([hidden])'); await p.click(`#map [data-pin="${place}"]`); await p.click(`#map [data-go-place="${place}"]`); await until(p, () => document.querySelector('#map')?.hidden !== false, 8000); await p.waitForTimeout(2500); };
  /** Bấm điểm chạm (bằng DOM, vì nhãn ở xa có thể bị ẩn), theo dõi thú đến hết kịch bản; trả về { maxY, minZ, maxZ, ran, endY }. */
  // Máy CI chạy WebGL phần mềm rất chậm (vài khung/giây): kịch bản kéo dài hơn nhiều so với máy thường, nên chờ bé rảnh trước khi bấm và cho khung chờ rộng.
  const interact = async (hot, ms = 60000) => {
    await until(p, () => !window.__petPos()[3], 60000); // chờ kịch bản trước kết thúc
    await until(p, h => !!document.querySelector(`.hot[data-hot="${h}"]`), 10000, hot); // khu ngoài dựng dần nên đồ chơi có thể chưa sẵn sàng
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
  r = await interact('seesaw'); const ssd = await p.evaluate(() => ({ toast: document.querySelector('#toast')?.textContent, last: window.__lastToy, gates: window.__gates, used: JSON.parse(localStorage.getItem('hatchday-demo')).toys?.used })); ok('bập bênh: bé ngồi đầu bập bênh, lên xuống rồi xuống đất', r.ran && r.maxY > 0.5 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2), ssd })); await calm();
  r = await interact('slide'); ok('cầu trượt: leo lên đỉnh (cao > 1,6) rồi trượt ra phía trước', r.ran && r.maxY > 1.6 && r.maxZ - r.minZ > 3 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2), dz: +(r.maxZ - r.minZ).toFixed(1) })); await calm();
  r = await interact('duck'); ok('cho vịt ăn: bé ngồi xổm bên ao (kịch bản chạy xong)', r.ran && r.endY < 0.15); await calm();
  r = await interact('ball'); ok('đá bóng: bé chạy tới đá (kịch bản chạy xong)', r.ran && r.endY < 0.15);
  ok('đá bóng: bóng bay đi rồi bé đuổi theo nhặt lại (thú đi tiếp sau kịch bản)', await until(p, () => { const [, , , s] = window.__petPos(); return !s; }, 6000));
  await p.waitForTimeout(3500);

  await goTo('plaza');
  r = await interact('fountain'); ok('đài phun nước: bé nhảy tưng ở mép đài', r.ran && r.maxY > 0.3 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2) })); await calm();
  r = await interact('bench0'); ok('ghế đá: bé nhảy lên ngồi (cao ≈ 0,55) rồi xuống', r.ran && r.maxY > 0.5 && r.maxY < 1.3 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2) })); await calm();
  r = await interact('stage', 60000); ok('sân khấu: bé lên sân khấu (z ≈ -7,5, cao ≥ 0,5) biểu diễn rồi xuống', r.ran && r.maxY > 0.5 && r.minZ < -7 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2), minZ: +r.minZ.toFixed(1) }));

  await goTo('tea');
  r = await interact('table0'); ok('bàn trà: bé nhảy lên ghế (cao ≈ 0,5), nhấp trà rồi xuống', r.ran && r.maxY > 0.4 && r.endY < 0.15, JSON.stringify({ maxY: +r.maxY.toFixed(2) })); await calm();
  r = await interact('cat'); ok('mèo ngủ: bé lại gần vuốt ve (kịch bản chạy xong)', r.ran && r.endY < 0.15);
  r = await interact('order', 3000); ok('quầy gọi món mở cửa hàng, không đổ kịch bản', !r.ran || r.endY < 0.15);
  // Hoạt động đã được ghi vào "Khám phá hôm nay" và hiện trong sheet Nhiệm vụ, không tràn ngang
  const dbg = await p.evaluate(() => JSON.parse(localStorage.getItem('hatchday-demo'))); const w = dbg.world;
  ok('Khám phá hôm nay: đồ chơi và hoạt động đã hoàn tất được ghi lại', ['swing', 'seesaw', 'slide', 'ducks', 'fountain', 'bench', 'stage', 'tea', 'cat'].every(k => (w?.kinds?.[k] || 0) > 0), JSON.stringify({ kinds: w?.kinds, used: dbg?.toys?.used, ill: dbg?.pet?.illness, nl: dbg?.pet?.nl }));
  await p.evaluate(() => document.querySelector('#a-house').click()); await p.waitForSelector('[data-go="quests"]'); await p.evaluate(() => document.querySelector('[data-go="quests"]').click()); await p.waitForSelector('#quests [data-quest-tab]');
  const tab = async k => { await p.evaluate(k => document.querySelector(`#quests [data-quest-tab="${k}"]`).click(), k); await p.waitForTimeout(150); };
  const probe = () => p.evaluate(() => { const e = document.querySelector('#quests'), b = [...document.querySelectorAll('#quests .btn-sm:not(:disabled)')].map(x => x.getBoundingClientRect().height); return { over: e.scrollWidth - e.clientWidth, explore: !!e.querySelector('.explore'), badges: e.querySelectorAll('.badge').length, minBtn: Math.min(...b, 99) }; });
  await tab('explore'); let q = await probe(); ok('sheet Nhiệm vụ > Khám phá: hiện đủ, không tràn ngang', q.explore && q.over <= 0, JSON.stringify(q));
  await tab('badges'); q = await probe(); ok('sheet Nhiệm vụ > Huy hiệu: 17 huy hiệu, không tràn ngang, nút đủ cao', q.badges === 17 && q.over <= 0 && q.minBtn >= 28, JSON.stringify(q));
  // Bóng ở vườn: bé đi tới chạm thì bóng bị đá đi (không đi xuyên); nấu ăn phải vào Bếp và đi tới bếp lò
  await p.goto(URL0); await start();
  await p.evaluate(() => document.querySelector('#a-play').click()); await p.waitForTimeout(2200);
  const b0 = await p.evaluate(() => window.__ball());
  await p.evaluate(b => window.__walk(b[0], b[2]), b0);
  ok('bóng ở vườn: bé đi tới chạm bóng thì bóng bị đá nảy đi', await until(p, b => { const n = window.__ball(); return n[3] === true && Math.hypot(n[0] - b[0], n[2] - b[2]) > 0.6; }, 9000, b0), JSON.stringify({ b0, b1: await p.evaluate(() => window.__ball()) }));
  ok('bóng ở vườn: bóng dừng lại sau khi lăn', await until(p, () => window.__ball()[3] === false, 16000)); // máy thử chậm: thời gian mô phỏng trôi chậm hơn đồng hồ thật
  await p.evaluate(() => document.querySelector('.ctx-btn[data-k="home"]').click()); await p.waitForTimeout(1800);
  await p.evaluate(() => document.querySelector('#a-house').click()); await p.waitForSelector('.tile[data-go="cooking"]'); await p.evaluate(() => document.querySelector('.tile[data-go="cooking"]').click());
  ok('Nấu ăn: chuyển cảnh sang Bếp và mở bảng nấu sau khi bé đi tới bếp lò', await until(p, () => document.querySelector('#scene-tag').textContent.includes('Bếp') && !document.querySelector('#cooking').hidden, 12000));
  const sp = await p.evaluate(() => window.__petPos()); ok('Nấu ăn: bé đứng trước bếp lò', Math.hypot(sp[0] + 2.25, sp[2] + 1.85) < 0.5, JSON.stringify(sp));
  await p.evaluate(() => document.querySelector('#cooking [data-close]').click());
  ok('Nấu ăn: đóng bảng thì bé quay lại giữa bếp', await until(p, () => { const q = window.__petPos(); return !q[3] && Math.hypot(q[0], q[2]) < 0.5; }, 8000));
  // Thời tiết: mưa chỉ rơi ngoài trời, quang đãng thì không có mưa
  const wxAt = async (url, place) => { await p.goto(url); await start(); if (place) await goTo(place); await p.waitForTimeout(800); return p.evaluate(() => window.__wx()); };
  let wx = await wxAt(`http://localhost:${PORT}/?dev&weather=rain`, 'park'); ok('thời tiết: ?weather=rain thì Công viên có mưa rơi', wx.sky === 'rain' && wx.rain === true, JSON.stringify(wx));
  wx = await wxAt(`http://localhost:${PORT}/?dev&weather=rain`, null); ok('thời tiết: trong nhà không có mưa dù trời mưa', wx.sky === 'rain' && wx.rain === false, JSON.stringify(wx));
  wx = await wxAt(`http://localhost:${PORT}/?dev&weather=clear`, 'park'); ok('thời tiết: trời quang thì không có mưa', wx.sky === 'clear' && wx.rain === false, JSON.stringify(wx));
  ok('không có lỗi console/trang', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(out.join('\n')); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
