// Sự kiện (biểu ngữ, nhân xu nhiệm vụ) và không gian theo Gắn bó (Ban công, Phòng chơi, Sân thượng) trên trình duyệt thật, chế độ Chơi thử.
// Chạy sau `npm run build`: node scripts/world-check.mjs   (cần Playwright + Chromium).
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const PORT = 4196;
const srv = http.createServer((q, r) => { let f = join(root, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html'); r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(PORT);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : ''));
const until = async (p, fn, ms = 10000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(150); } return false; };
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  const URL0 = `http://localhost:${PORT}/?dev&event=boost`;
  const start = async () => { await p.waitForSelector('#demo'); await p.click('#demo'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1200); };
  await p.goto(URL0); await p.waitForSelector('#demo'); await p.click('#demo'); await p.click('button[type=submit]'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1500);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('hatchday-demo')); d.pet.bond_xp = 300; d.pet.nl = 95; d.pet.no = 80; d.pet.vui = 60; d.pet.sach = 90; d.pet.stats_at = new Date().toISOString(); localStorage.setItem('hatchday-demo', JSON.stringify(d)); });
  await p.goto(URL0); await start();

  // sự kiện: biểu ngữ, đóng rồi nhớ
  ok('biểu ngữ sự kiện hiện đúng chữ', await until(p, () => { const e = document.getElementById('event-banner'); return !!e && !e.hidden && e.textContent.includes('nhân 1,5'); }));
  await p.click('#event-banner [data-ev-x]'); ok('đóng biểu ngữ', await p.evaluate(() => document.getElementById('event-banner').hidden));
  await p.goto(URL0); await start(); await p.waitForTimeout(800);
  ok('đã đóng thì tải lại vẫn ẩn', await p.evaluate(() => document.getElementById('event-banner')?.hidden ?? true));
  await p.click('#a-house'); await p.click('.tile[data-go="quests"]'); await p.waitForSelector('#quests:not([hidden])');
  ok('mục Nhiệm vụ báo hệ số nhân của sự kiện', (await p.textContent('#quests')).includes('nhân 1,5 lần'));
  await p.click('.hsheet:not([hidden]) [data-close]');

  // không gian theo Gắn bó (cấp 5): ban công và phòng chơi mở, sân thượng cần cấp 7
  await p.click('#a-house'); await p.click('.tile[data-go="spaces"]'); await p.waitForSelector('#spaces:not([hidden])');
  const rows = await p.evaluate(() => [...document.querySelectorAll('#spaces .soc-row')].map(r => ({ t: r.textContent.replace(/\s+/g, ' '), go: !!r.querySelector('[data-space]') })));
  ok('3 không gian; ban công và phòng chơi có nút Đi tới, sân thượng khoá ở cấp 7', rows.length === 3 && rows[0].go && rows[1].go && !rows[2].go && rows[2].t.includes('cấp 7'), JSON.stringify(rows.map(r => r.go)));
  await p.click('[data-space="balcony"]');
  ok('đi tới Ban công: chip đổi tên, có Võng và Thổi bong bóng', await until(p, () => document.getElementById('scene-tag').textContent.includes('Ban công') && !!document.querySelector('.hot[data-hot="bubbles"]') && !!document.querySelector('.hot[data-hot="hammock"]'), 20000));
  const nl0 = (await p.evaluate(() => JSON.parse(localStorage.getItem('hatchday-demo')).pet.nl));
  await p.click('.hot[data-hot="bubbles"]');
  ok('chơi bong bóng dùng hành động chơi: năng lượng giảm', await until(p, n => JSON.parse(localStorage.getItem('hatchday-demo')).pet.nl < n, 20000, nl0), `nl ${nl0}`);
  await p.click('#ctx [data-k="home"]'); ok('về phòng từ Ban công', await until(p, () => document.getElementById('scene-tag').textContent.includes('Phòng khách'), 15000)); await p.waitForTimeout(1500); // đợi hết chuyển cảnh
  await p.click('#a-house'); await p.click('.tile[data-go="spaces"]'); await p.click('[data-space="playroom"]');
  ok('đi tới Phòng chơi: có Tàu hoả, Hồ bóng, Xếp hình', await until(p, () => document.getElementById('scene-tag').textContent.includes('Phòng chơi') && ['train', 'pit', 'blocks'].every(h => !!document.querySelector(`.hot[data-hot="${h}"]`)), 20000));
  await p.click('#ctx [data-k="home"]'); await until(p, () => document.getElementById('scene-tag').textContent.includes('Phòng khách'), 15000);
  // nâng lên cấp 7: sân thượng mở
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('hatchday-demo')); d.pet.bond_xp = 800; localStorage.setItem('hatchday-demo', JSON.stringify(d)); });
  await p.goto(URL0); await start();
  await p.click('#a-house'); await p.click('.tile[data-go="spaces"]'); await p.click('[data-space="rooftop"]');
  ok('cấp 7: đi tới Sân thượng có Thả diều và Kính thiên văn', await until(p, () => document.getElementById('scene-tag').textContent.includes('Sân thượng') && !!document.querySelector('.hot[data-hot="kite"]') && !!document.querySelector('.hot[data-hot="scope"]'), 20000));
  // Quảng trường có trang trí sự kiện không gây lỗi
  await p.click('#ctx [data-k="home"]'); await until(p, () => document.getElementById('scene-tag').textContent.includes('Phòng khách'), 15000);
  await p.click('#scene-tag'); await p.waitForTimeout(300); await p.click('#map [data-pin="plaza"]'); await p.click('#map [data-go-place="plaza"]');
  ok('Quảng trường với trang trí Trung thu vẫn vào được', await until(p, () => document.getElementById('scene-tag').textContent.includes('Quảng trường') && !!document.querySelector('.emote-bar:not([hidden])'), 20000));
  await p.click('#scene-tag'); await p.waitForSelector('#map:not([hidden])');
  ok('Bản đồ vẫn chỉ có 9 ghim (không gian của nhà không lên bản đồ)', (await p.$$('#map .pin')).length === 9);
  ok('không có lỗi console/trang', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(out.join('\n')); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
