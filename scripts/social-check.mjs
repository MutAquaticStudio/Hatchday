// Kiểm tra giao diện xã hội trên trình duyệt thật (chế độ Chơi thử, bạn ảo): bạn bè, hộp thư, quà, tin tức, thăm nhà,
// và (điện thoại 390px) không tràn ngang. Chạy sau `npm run build`: node scripts/social-check.mjs   (cần Playwright + Chromium).
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const PORT = 4193;
const srv = http.createServer((q, r) => {
  let f = join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html');
  r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f));
}).listen(PORT);

const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : ''));
const until = async (p, fn, ms = 8000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(150); } return false; };

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  const demo = () => p.evaluate(() => JSON.parse(localStorage.getItem('hatchday-demo')));
  const text = sel => p.textContent(sel).then(t => (t || '').replace(/\s+/g, ' '));
  const noOverflow = async (label) => {
    const w = await p.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth, bad: [...document.querySelectorAll('.hsheet:not([hidden]) *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.className || e.tagName).slice(0, 5) }));
    ok(label + ': không tràn ngang', w.doc <= w.win && !w.bad.length, JSON.stringify(w));
  };
  await p.goto(`http://localhost:${PORT}/?dev`); await p.waitForSelector('#demo'); await p.click('#demo');
  await p.click('button[type=submit]'); await until(p, () => !!document.querySelector('#a-house'), 30000);
  await p.waitForTimeout(1500);

  // Nhà → ô Bạn bè & thư, có chấm báo vì có 1 lời mời + 2 thư + 2 tin
  await p.click('#a-house');
  ok('menu Nhà có ô "Bạn bè & thư" và nút Nhà có chấm báo', !!(await p.$('.tile[data-go="social"]')) && await p.evaluate(() => document.getElementById('a-house').classList.contains('need')));
  ok('ô báo số thư, lời mời, tin chưa đọc', (await text('.tile[data-go="social"]')).includes('2 thư mới') && (await text('.tile[data-go="social"]')).includes('1 lời mời'), await text('.tile[data-go="social"]'));
  await p.click('.tile[data-go="social"]'); await p.waitForSelector('#social:not([hidden]) .soc-code');
  ok('hiện mã bạn bè 8 ký tự', /^[A-HJ-NP-Z2-9]{8}$/.test((await text('#soc-mycode')).trim()), await text('#soc-mycode'));
  ok('có 1 bạn ảo và 1 lời mời đến', (await p.$$('#social .soc-row')).length === 2, String((await p.$$('#social .soc-row')).length));
  await noOverflow('tab Bạn bè');

  // đồng ý lời mời của Nấm Ngủ
  await p.click('[data-soc="accept"]'); ok('đồng ý lời mời: thành 2 bạn', await until(p, () => document.querySelectorAll('#social .soc-list:last-of-type .soc-row').length >= 2 && !document.querySelector('[data-soc="accept"]')));
  // gửi lời mời tới mã hợp lệ và mã sai
  await p.fill('#soc-code', 'ZZZZZZZZ'); await p.click('.soc-add button'); await until(p, () => /Không tìm thấy/.test(document.getElementById('toast')?.textContent || ''));
  ok('mã sai báo "Không tìm thấy"', (await text('#toast')).includes('Không tìm thấy'), await text('#toast'));
  await p.fill('#soc-code', 'mayxanh3'); await p.click('.soc-add button');
  ok('gửi lời mời tới Mây Xanh (chữ thường vẫn nhận)', await until(p, () => /Đã gửi lời mời/.test(document.getElementById('toast')?.textContent || '') || /Đang chờ 1 người/.test(document.getElementById('social')?.textContent || '')));
  // riêng tư
  await p.click('[data-key="friends"]'); ok('đổi riêng tư: không nhận lời mời', await until(p, () => /Đang không nhận lời mời/.test(document.getElementById('social')?.textContent || '')));
  await p.click('[data-key="friends"]');

  // Hộp thư: nhận thư chào mừng (+30 xu) và quà 2 cà rốt
  const before = await demo();
  await p.click('[data-soc-tab="mail"]'); await p.waitForSelector('#social [data-soc="claim"]');
  ok('hộp thư có 2 thư chưa nhận và nút Nhận tất cả', (await p.$$('#social [data-soc="claim"]')).length === 2 && !!(await p.$('[data-soc="claimall"]')));
  await noOverflow('tab Hộp thư');
  await p.click('[data-soc="claimall"]'); await until(p, () => !document.querySelector('#social [data-soc="claim"]'));
  const after = await demo();
  ok('nhận tất cả: +30 xu và +2 cà rốt', after.coins === before.coins + 30 && (after.owned.carot || 0) === (before.owned.carot || 0) + 2, `xu ${before.coins}→${after.coins}, carot ${before.owned.carot}→${after.owned.carot}`);
  ok('thư đã nhận có nút Xoá', !!(await p.$('#social [data-soc="delmail"]')));
  await p.click('[data-soc="delmail"]'); ok('xoá thư đã nhận', await until(p, () => document.querySelectorAll('#social .soc-mail').length === 1));

  // Tin tức: mở tab thì đánh dấu đã đọc
  await p.click('[data-soc-tab="news"]'); await p.waitForSelector('#social .soc-kind');
  ok('tab Tin tức có tin cập nhật được ghim', (await text('#social')).includes('Bản đồ thế giới đã mở'));
  await noOverflow('tab Tin tức');
  ok('mở Tin tức: huy hiệu tin chưa đọc biến mất', await until(p, () => !document.querySelector('[data-soc-tab="news"] .soc-badge')));

  // Tặng quà cho Lúa Mạch (bạn từ 10 ngày trước)
  await p.click('[data-soc-tab="friends"]'); await p.waitForSelector('[data-soc="gift"]');
  const LUA = 'b0000000-0000-4000-8000-000000000001', NAM = 'b0000000-0000-4000-8000-000000000002';
  const owned0 = (await demo()).owned.carot || 0;
  await p.click(`[data-soc="gift"][data-who="${LUA}"]`); await p.waitForSelector('#gift:not([hidden]) [data-gift="+"]');
  await noOverflow('thẻ Tặng quà');
  await p.click('#gift [data-id="carot"][data-gift="+"]'); await p.click('#gift [data-id="carot"][data-gift="+"]');
  await p.selectOption('#gift-note', 'Chúc bạn khoẻ!'); await p.click('[data-gift="send"]');
  ok('gửi quà: trừ 2 cà rốt khỏi kho', await until(p, () => !document.getElementById('gift') || document.getElementById('gift').hidden) && ((await demo()).owned.carot || 0) === owned0 - 2, `carot ${owned0}→${(await demo()).owned.carot}`);
  await p.click(`[data-soc="gift"][data-who="${LUA}"]`); await p.waitForSelector('#gift:not([hidden]) [data-gift="+"]');
  await p.click('#gift [data-id="carot"][data-gift="+"]'); await p.click('[data-gift="send"]');
  ok('tặng lần hai cùng bạn trong ngày bị từ chối', await until(p, () => /đã tặng người này một món/.test(document.getElementById('toast')?.textContent || '')), await text('#toast'));
  await p.click('[data-soc="back"]');

  // Thăm nhà Lúa Mạch: vuốt ve (+3 xu), tưới giúp (+5 xu), để lại dấu vết
  await p.waitForSelector(`[data-soc="visit"][data-who="${LUA}"]`); const c0 = (await demo()).coins;
  await p.click(`[data-soc="visit"][data-who="${LUA}"]`); await p.waitForSelector('#visit:not([hidden]) [data-visit="stroke"]');
  ok('thẻ thăm nhà hiện tên bé và 3 ô vườn', (await text('#visit')).includes('Lúa Mạch') && (await p.$$('#visit [data-visit="water"]')).length === 2);
  await noOverflow('thẻ Thăm nhà');
  await p.click('[data-visit="stroke"]'); ok('vuốt ve bé bạn: +3 xu, nút chuyển "Đã vuốt ve"', await until(p, () => /Đã vuốt ve/.test(document.getElementById('visit')?.textContent || '')) && (await demo()).coins === c0 + 3, `xu ${c0}→${(await demo()).coins}`);
  await p.click('#visit [data-visit="water"]'); ok('tưới giúp: +5 xu', await until(p, () => /Đã tưới/.test(document.getElementById('visit')?.textContent || '')) && (await demo()).coins === c0 + 8, `xu ${(await demo()).coins}`);
  await p.click('[data-emote="heart"]'); ok('để lại dấu vết: các nút dấu vết bị khoá trong ngày', await until(p, () => [...document.querySelectorAll('#visit .soc-emote')].every(x => x.disabled)));
  await p.click('#visit [data-soc="back"]'); await p.waitForSelector('#social:not([hidden])');

  // Chặn có bước xác nhận, rồi bỏ bạn
  await p.click(`[data-soc-arm="block"][data-who="${NAM}"]`); ok('Chặn cần bấm hai lần', !!(await p.$('[data-soc="block"]')));
  await p.click('[data-soc="block"]'); ok('chặn xong thì Nấm Ngủ biến khỏi danh sách bạn', await until(p, n => !document.querySelector(`[data-soc="visit"][data-who="${n}"]`), 8000, NAM));

  // Esc đóng sheet
  await p.keyboard.press('Escape'); ok('Esc đóng bảng', await until(p, () => document.getElementById('social').hidden));
  await p.waitForTimeout(500);
  ok('không có lỗi console/trang', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(out.join('\n')); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
