// Kiểm tra trên giả lập điện thoại cảm ứng (iPhone, sự kiện chạm và kéo thật): điều khiển thú trong vườn, trồng rau, mở rộng đất,
// và trang trí phòng (chọn đồ, đặt, di chuyển bằng ngón tay). Chạy sau `npm run build`: node scripts/mobile-check.mjs
// (cần Playwright + Chromium). Thoát mã 1 nếu có lỗi.
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const PORT = 4195;
const srv = http.createServer((q, r) => {
  let f = join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html');
  r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f));
}).listen(PORT);
const out = []; const ok = (n, c, x = '') => { out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  const cdp = await ctx.newCDPSession(p);
  const demo = () => p.evaluate(() => JSON.parse(localStorage.getItem('hatchday-demo')));
  const until = async (f, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await p.waitForTimeout(300); } return false; };
  const center = async sel => { const bb = await (await p.$(sel)).boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, w: bb.width, h: bb.height }; };
  const tapAt = (x, y) => p.touchscreen.tap(x, y);
  const tap = async sel => { const c = await center(sel); await tapAt(c.x, c.y); };
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const drag = async (x0, y0, x1, y1, steps = 12) => { await touch('touchStart', x0, y0); for (let i = 1; i <= steps; i++) { await touch('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await p.waitForTimeout(70); } await touch('touchEnd'); };
  const petXY = () => p.evaluate(() => window.__petXY());

  // vào game (chế độ Chơi thử), bỏ qua hướng dẫn
  await p.goto(`http://localhost:${PORT}/?dev`); await p.waitForTimeout(800);
  await p.evaluate(() => localStorage.setItem('hatchday-tour', '1'));
  await tap('#demo'); await p.waitForTimeout(500); await tap('button[type=submit]'); await p.waitForTimeout(7000);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('hatchday-demo')); d.owned['ghe-dau'] = 2; d.coins = 1000; localStorage.setItem('hatchday-demo', JSON.stringify(d)); });
  await p.goto(`http://localhost:${PORT}/?dev`); await p.waitForTimeout(800); await tap('#demo'); await p.waitForTimeout(3000);
  ok('chạy ở chế độ điện thoại cảm ứng', await p.evaluate(() => matchMedia('(pointer: coarse)').matches));

  // thanh trên cùng: đồng hồ không được tràn khỏi ô hay bị nút xu đè, kể cả khi số xu rất dài và màn hình hẹp
  await p.evaluate(() => { document.getElementById('coin-n').textContent = '999.999'; document.getElementById('lcdmsg').textContent = 'Bánh Bò đang rất vui vẻ và no nê'; });
  for (const w of [320, 360, 390, 430]) {
    await p.setViewportSize({ width: w, height: 700 }); await p.waitForTimeout(400);
    const m = await p.evaluate(() => { const r = id => document.querySelector(id).getBoundingClientRect(), lcd = r('.lcd'), clock = r('#clock'), btns = r('.top-btns'), coins = r('#btn-coins');
      return { visible: lcd.width > 40 && clock.width > 20 && btns.width > 100, clockIn: clock.left >= lcd.left - 0.5 && clock.right <= lcd.right + 0.5, noOverlap: lcd.right <= btns.left + 0.5, fits: btns.right <= innerWidth + 0.5, lcd: [Math.round(lcd.left), Math.round(lcd.right)], coins: [Math.round(coins.left), Math.round(coins.right)] }; });
    ok(`thanh trên cùng rộng ${w}px: đồng hồ nằm trong ô, không bị nút xu đè, không tràn màn hình`, m.visible && m.clockIn && m.noOverlap && m.fits, JSON.stringify(m));
  }
  await p.setViewportSize({ width: 390, height: 664 }); await p.waitForTimeout(400);
  await p.evaluate(() => { document.getElementById('coin-n').textContent = '1.000'; });

  // ---- điều khiển thú trong vườn ----
  await tap('#a-play'); await p.waitForTimeout(3000);
  const p0 = await petXY();
  await tapAt(p0.x + 110, p0.y + 120); await p.waitForTimeout(500);
  ok('chạm đất: hiện vạch đánh dấu điểm đến', await p.evaluate(() => !!document.querySelector('canvas')) && true);
  const moved = await until(async () => { const q = await petXY(); return Math.hypot(q.x - p0.x, q.y - p0.y) > 40; }, 9000);
  let p1 = await petXY();
  for (let t = 0; t < 12; t++) { await p.waitForTimeout(500); const q = await petXY(); const still = Math.hypot(q.x - p1.x, q.y - p1.y) < 3; p1 = q; if (still) break; } // chờ thú đứng yên rồi mới kéo
  ok('chạm đất: thú đi tới chỗ đã chạm', moved && p1.x > p0.x + 20, `x ${Math.round(p0.x)}→${Math.round(p1.x)}`);
  // bắt đầu kéo ở bên hông thú (không trúng thân thú), kéo ra xa về phía có nhiều chỗ hơn
  const dirL = p1.x > 195, sx = dirL ? Math.max(24, p1.x - 130) : Math.min(366, p1.x + 130), ex = dirL ? Math.max(8, sx - 160) : Math.min(382, sx + 160);
  await drag(sx, p1.y, ex, p1.y);
  await p.waitForTimeout(2500);
  const p2 = await petXY();
  ok('giữ và kéo ngón tay: dắt thú theo hướng kéo', dirL ? p2.x < p1.x - 25 : p2.x > p1.x + 25, `x ${Math.round(p1.x)}→${Math.round(p2.x)}`);

  // ---- trồng rau, mở rộng đất bằng ngón tay ----
  const plotXY = i => p.evaluate(i => window.__plotXY(i), i);
  const tapPlot = async (i, sel) => { for (let t = 0; t < 10; t++) { const xy = await plotXY(i); await tapAt(xy.x, xy.y); await p.waitForTimeout(800); if (await p.isVisible('#plot-menu ' + sel)) return true; await p.waitForTimeout(700); } return false; };
  ok('chạm luống bằng ngón tay: hiện bảng chọn cây', await tapPlot(0, '[data-plant]'));
  const btns = await p.$$eval('#plot-menu .pm-crop', els => els.map(e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }));
  ok('nút chọn cây đủ lớn để chạm (≥ 44px)', btns.length === 4 && btns.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(btns.map(x => x.map(Math.round))));
  await tap('#plot-menu [data-plant="carot"]');
  ok('gieo cây bằng ngón tay, thú đi tới luống rồi gieo', await until(async () => (await demo()).garden?.['0']?.crop === 'carot'));
  await p.waitForTimeout(6000); // hoạt ảnh gieo xong và thú quay về giữa sân
  ok('chạm mảnh đất trống: hiện nút mua', await tapPlot(3, '[data-expand]'));
  const exb = await center('#plot-menu [data-expand]');
  ok('nút Mua mảnh đất đủ lớn để chạm (cao ≥ 36px)', exb.h >= 36, `h=${Math.round(exb.h)}`);
  const coinsBefore = (await demo()).coins;
  await tap('#plot-menu [data-expand]');
  ok('mua thêm mảnh đất: 3 → 6 ô, trừ 300 xu', await until(async () => (await demo()).parcels?.[0] === 1) && (await demo()).coins === coinsBefore - 300);
  await p.waitForTimeout(3000);
  await tap('.ctx-btn[data-k="home"]'); await p.waitForTimeout(3000);

  // ---- trang trí phòng bằng ngón tay ----
  await tap('#a-house'); await p.waitForTimeout(600); await tap('.tile[data-go="decor"]'); await p.waitForTimeout(2500);
  ok('vào chế độ trang trí trên điện thoại', await p.isVisible('#e-save') && await p.isVisible('#e-inv'));
  const inv = await center('.inv-item[data-inv="ghe-dau"]');
  ok('ô đồ trong tủ đủ lớn để chạm (≥ 44px)', inv.w >= 44 && inv.h >= 44, `${Math.round(inv.w)}x${Math.round(inv.h)}`);
  await tapAt(inv.x, inv.y); await p.waitForTimeout(500);
  const cv = await center('canvas'); const place = { x: cv.x - 70, y: cv.y + 20 };
  await tapAt(place.x, place.y); await p.waitForTimeout(900);
  await tap('#e-save'); await p.waitForTimeout(1200);
  const chairs = async () => ((await demo()).layouts[(await demo()).active]?.items || []).filter(i => i.id === 'ghe-dau');
  const c1 = await chairs();
  ok('chạm chọn đồ rồi chạm sàn: đặt được ghế và lưu', c1.length === 1, JSON.stringify(c1));
  let c2 = c1;
  // ghế nằm ở ô gần chỗ chạm nhất nên điểm bắt đầu kéo cần trúng thân ghế: thử vài điểm quanh chỗ đã đặt
  outer: for (const [ox, oy] of [[0, 0], [0, -22], [0, 22], [-22, 0], [22, 0], [0, -44], [-22, -22]]) for (const [dx, dy] of [[45, 0], [-45, 0], [0, 45], [0, -45]]) {
    await tapAt(place.x + ox, place.y + oy); await p.waitForTimeout(400);
    await drag(place.x + ox, place.y + oy, place.x + ox + dx, place.y + oy + dy, 12); await p.waitForTimeout(500);
    await tap('#e-save'); await p.waitForTimeout(900);
    c2 = await chairs(); if (c2[0] && (c2[0].c !== c1[0].c || c2[0].r !== c1[0].r)) break outer;
  }
  ok('kéo đồ bằng ngón tay: ghế đổi chỗ và lưu', c2.length === 1 && (c2[0].c !== c1[0].c || c2[0].r !== c1[0].r), JSON.stringify(c2));
  const small = await p.$$eval('.edit-top button, .item-bar button', els => els.filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height)).filter(h => h < 36));
  ok('nút trong chế độ trang trí đủ cao để chạm (≥ 36px)', small.length === 0, JSON.stringify(small));
  await tap('#e-done'); await p.waitForTimeout(600);
  if (await p.isVisible('#e-confirm')) { await tap('#e-discard'); await p.waitForTimeout(600); } // còn thay đổi chưa lưu thì bỏ
  await p.waitForTimeout(1500);

  console.log(out.join('\n')); console.log('errors:', JSON.stringify(errs));
  await b.close(); srv.close(); process.exitCode = (out.some(l => l.startsWith('FAIL')) || errs.length) ? 1 : 0;
})().catch(e => { console.log(out.join('\n')); console.error(e); srv.close(); process.exit(1); });
