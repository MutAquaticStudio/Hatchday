// Hook sự kiện (giảm giá, mục tiêu cộng đồng, Mùa cúm + cách ly) và đồ chơi trên trình duyệt thật, chế độ Chơi thử với ?event=all.
// Chạy sau `npm run build`: node scripts/hooks-check.mjs   (cần Playwright + Chromium).
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const PORT = 4197;
const srv = http.createServer((q, r) => { let f = join(root, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html'); r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(PORT);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : ''));
const until = async (p, fn, ms = 10000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(150); } return false; };
const demo = p => p.evaluate(() => JSON.parse(localStorage.getItem('hatchday-demo')));
const patch = (p, fn) => p.evaluate(src => { const d = JSON.parse(localStorage.getItem('hatchday-demo')); new Function('d', src)(d); localStorage.setItem('hatchday-demo', JSON.stringify(d)); }, fn);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  const URL0 = `http://localhost:${PORT}/?dev&event=all`;
  const start = async () => { await p.waitForSelector('#demo'); await p.click('#demo'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1500); };
  await p.goto(URL0); await p.waitForSelector('#demo'); await p.click('#demo'); await p.click('button[type=submit]'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1500);
  await patch(p, 'd.pet.bond_xp = 800; d.pet.nl = 95; d.pet.no = 60; d.pet.vui = 40; d.pet.sach = 90; d.pet.stats_at = new Date().toISOString(); d.coins = 2000; localStorage.setItem("hatchday-tour", "1");');
  await p.goto(URL0); await start();

  // biểu ngữ + mục tiêu cộng đồng
  ok('biểu ngữ có dòng mục tiêu cộng đồng', await until(p, () => { const e = document.getElementById('event-banner'); return !!e && !e.hidden && e.textContent.includes('Cộng đồng bữa ăn') && !!e.querySelector('.ev-bar'); }, 15000));
  await p.click('#event-banner [data-ev-x]');
  await patch(p, 'd.goals = { 3: { mine: 6, claimed: false } }');
  await p.evaluate(() => localStorage.removeItem('hatchday-event-seen')); await p.goto(URL0); await start();
  ok('đủ mục tiêu: có nút Nhận thưởng', await until(p, () => !!document.querySelector('#event-banner [data-goal]:not([disabled])'), 15000));
  const c0 = (await demo(p)).coins; await p.click('#event-banner [data-goal]');
  ok('nhận thưởng mục tiêu +40 xu', await until(p, c => JSON.parse(localStorage.getItem('hatchday-demo')).coins === c + 40, 8000, c0));
  ok('nhận xong hiện "Đã nhận thưởng"', await until(p, () => document.getElementById('event-banner')?.textContent.includes('Đã nhận thưởng')));

  // giảm giá thức ăn 20% (thuốc 30% trong Mùa cúm)
  await p.click('#a-house'); await p.click('.tile[data-go="shop"]'); await p.waitForSelector('#shop:not([hidden])');
  await p.evaluate(() => document.querySelector('#shop [data-tab="food"], #shop [data-shop-tab="food"]')?.click());
  ok('tab Thức ăn có nhãn giảm giá 20%', await until(p, () => document.getElementById('shop').textContent.includes('Đang giảm giá 20% thức ăn')));
  const price = await p.evaluate(() => { const b = document.querySelector('#shop [data-buyfood][data-qty="1"]'); return { id: b.dataset.buyfood, n: +b.textContent.replace(/\D/g, '') }; });
  const coins1 = (await demo(p)).coins; await p.click(`#shop [data-buyfood="${price.id}"][data-qty="1"]`);
  ok('mua thức ăn trừ đúng giá đã giảm', await until(p, ([c, n]) => JSON.parse(localStorage.getItem('hatchday-demo')).coins === c - n, 6000, [coins1, price.n]), `giá hiện ${price.n}`);
  await p.click('.hsheet:not([hidden]) [data-close]');

  // đồ chơi mang theo: Đồ chơi ở vườn (ctx), mua Đĩa ném, chơi
  await p.click('#a-play'); ok('vào Vườn', await until(p, () => document.getElementById('scene-tag').textContent.includes('Vườn'), 15000)); await p.waitForTimeout(1200);
  await p.click('#ctx [data-k="toys"]'); await p.waitForSelector('#toys:not([hidden])');
  ok('bảng Đồ chơi có 13 món', (await p.$$('#toys .toy-row')).length === 13, String((await p.$$('#toys .toy-row')).length));
  const c2 = (await demo(p)).coins; await p.click('[data-toy-buy="frisbee"]');
  ok('mua Đĩa ném (120 xu)', await until(p, c => JSON.parse(localStorage.getItem('hatchday-demo')).coins === c - 120, 6000, c2));
  await p.waitForSelector('[data-toy-play="frisbee"]:not([disabled])'); const v0 = (await demo(p)).pet.vui; await p.click('[data-toy-play="frisbee"]');
  ok('chơi Đĩa ném: Vui tăng, dùng 1/6 lượt', await until(p, v => { const d = JSON.parse(localStorage.getItem('hatchday-demo')); return d.pet.vui > v && d.toys.used.frisbee === 1; }, 8000, v0));
  // đồ cố định: Ban công
  await p.waitForTimeout(1500); await p.click('#ctx [data-k="home"]'); await until(p, () => document.getElementById('scene-tag').textContent.includes('Phòng khách'), 15000); await p.waitForTimeout(1500);
  await p.click('#a-house'); await p.click('.tile[data-go="spaces"]'); await p.click('[data-space="balcony"]');
  ok('vào Ban công', await until(p, () => document.getElementById('scene-tag').textContent.includes('Ban công') && !!document.querySelector('.hot[data-hot="bubbles"]'), 20000)); await p.waitForTimeout(1500);
  await p.click('.hot[data-hot="bubbles"]');
  ok('thổi bong bóng dùng play_toy (đếm lượt của riêng món)', await until(p, () => JSON.parse(localStorage.getItem('hatchday-demo')).toys.used.bubbles === 1, 15000));
  await p.click('#ctx [data-k="home"]'); await until(p, () => document.getElementById('scene-tag').textContent.includes('Phòng khách'), 15000); await p.waitForTimeout(1500);

  // Mùa cúm: bé ốm thì có nút cách ly
  await patch(p, "d.pet.illness = 'cam-lanh'; d.pet.sick_since = new Date().toISOString(); d.pet.recover_at = new Date(Date.now() + 3 * 3600000).toISOString();");
  await p.goto(URL0); await start();
  await p.click('#a-house'); await p.click('.tile[data-go="clinic"]'); await p.waitForSelector('#clinic:not([hidden])');
  ok('Mùa cúm: bé ốm thấy hàng Bật cách ly', await until(p, () => !!document.querySelector('#clinic [data-iso="1"]')));
  await p.click('#clinic [data-iso="1"]');
  ok('bật cách ly: nút đổi thành Đang cách ly', await until(p, () => /Đang cách ly/.test(document.getElementById('clinic').textContent) && JSON.parse(localStorage.getItem('hatchday-demo')).isolating === true));
  ok('thuốc giảm 30% trong Mùa cúm (hiện đúng giá giảm)', await p.evaluate(() => /giảm|Mua/.test(document.getElementById('clinic').textContent)));
  ok('không có lỗi console/trang', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(out.join('\n')); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
