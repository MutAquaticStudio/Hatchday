// Thùng thư Góp ý & Hỗ trợ và Thông tin trang: người chơi viết thư, nhận trả lời (bản Chơi thử tự trả lời), trả lời tiếp; trang chủ có email liên hệ;
// trang quản trị: support trả lời thư, không thấy Hệ thống; ops sửa thông tin trang, link không https bị chặn.
// Chạy sau `npm run build` (bản Chơi thử, không cấu hình Supabase): node scripts/support-check.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const serve = (root, port) => http.createServer((q, r) => { let f = join(root, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html'); r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(port);
const s1 = serve(new URL('../dist/', import.meta.url).pathname, 4211), s2 = serve(new URL('../dist-admin/', import.meta.url).pathname, 4212);
const until = async (p, fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await p.waitForTimeout(80); } return false; };
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : ''));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  const URL0 = 'http://localhost:4211/?dev&weather=clear';
  await p.goto(URL0); await p.waitForSelector('#demo');
  ok('trang chủ có email liên hệ và liên kết Hỗ trợ', await p.evaluate(() => /m\.thuanwork@gmail\.com/.test(document.querySelector('#ung-ho')?.textContent || '') && !!document.querySelector('.ld-foot a[href^="mailto:"]')));
  await p.click('#demo'); await p.click('button[type=submit]'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1000);
  await p.evaluate(() => localStorage.setItem('hatchday-tour', '1')); await p.goto(URL0); await p.click('#demo'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1500);
  await p.click('#btn-stats'); await p.waitForTimeout(300); await p.evaluate(() => document.querySelector('#btn-support').scrollIntoView()); await p.click('#btn-support');
  await until(p, () => !!document.querySelector('#support:not([hidden]) .sp-new')); await p.waitForTimeout(300);
  await p.click('[data-sp="new"]'); await p.click('[data-sp-kind="bug"]'); await p.fill('#sp-subject', 'Bé kẹt ở Công viên'); await p.fill('#sp-body', 'Bé đứng yên gần ao vịt, bấm đâu cũng không đi được.');
  await p.click('[data-sp="send"]'); await until(p, () => !!document.querySelector('#sp-thread'));
  ok('gửi thư mở luồng trò chuyện', await p.evaluate(() => document.querySelectorAll('#sp-thread .dm-msg.mine').length === 1));
  await p.click('[data-sp="list"]'); await p.waitForTimeout(4800);
  await p.click('[data-sp="list"]').catch(() => {}); await p.evaluate(() => { document.querySelector('#support [data-close]')?.click(); }); await p.waitForTimeout(200);
  await p.click('#btn-stats'); await p.waitForTimeout(200); await p.evaluate(() => document.querySelector('#btn-support').click()); await p.waitForTimeout(800);
  ok('có chấm/dấu thư mới khi đội ngũ trả lời', await p.evaluate(() => !!document.querySelector('.sp-item.unread')));
  await p.click('[data-sp-open]'); await p.waitForTimeout(300);
  ok('thấy câu trả lời của đội ngũ', await p.evaluate(() => !!document.querySelector('#sp-thread .dm-msg.team')));
  await p.fill('#sp-reply', 'Cảm ơn đội ngũ nhé!'); await p.click('[data-sp="reply"]'); await p.waitForTimeout(400);
  ok('trả lời tiếp được', await p.evaluate(() => document.querySelectorAll('#sp-thread .dm-msg.mine').length === 2));
  const over = await p.evaluate(() => { const e = document.querySelector('#support'); return e.scrollWidth - e.clientWidth; }); ok('không tràn ngang', over <= 0, String(over));
  // Admin
  const a = await (await b.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 })).newPage();
  a.on('pageerror', e => errs.push('ADMIN ' + e.message));
  await a.goto('http://localhost:4212/?role=support'); await a.waitForSelector('nav button[data-tab="support"]'); await a.click('nav button[data-tab="support"]'); await a.waitForSelector('[data-tk-open]');
  await a.click('[data-tk-open]'); await a.waitForSelector('#tkr'); await a.fill('#tkr', 'Chào bạn, bạn thử tải lại trang nhé.');
  await a.click('[data-tk-reply]'); await a.waitForTimeout(400); ok('admin trả lời được', await a.evaluate(() => document.querySelectorAll('.tmsg.team').length === 1));
  ok('support không thấy tab Hệ thống', await a.evaluate(() => !document.querySelector('nav button[data-tab="sys"]')));
  await a.goto('http://localhost:4212/?role=ops'); await a.waitForSelector('nav button[data-tab="sys"]'); await a.click('nav button[data-tab="sys"]'); await a.waitForSelector('#si-save');
  await a.fill('#si-donate_url', 'https://ko-fi.com/hatchday'); await a.fill('#si-bank_name', 'Vietcombank'); await a.fill('#si-bank_account', '0123456789'); await a.fill('#si-bank_holder', 'NGUYEN VAN A'); await a.fill('#si-vietqr_bank', 'VCB');
  await a.fill('#si-why', 'mở kênh ủng hộ'); await a.click('#si-save');
  ok('lưu thông tin trang', await until(a, () => /Đã lưu thông tin trang/.test(document.querySelector('#msg')?.textContent || '')));
  await a.fill('#si-donate_url', 'http://khong-an-toan.com'); await a.fill('#si-why', 'thử sai'); await a.click('#si-save'); await until(a, () => /chưa hợp lệ/.test(document.querySelector('#msg')?.textContent || ''), 5000);
  { const m = await a.evaluate(() => document.querySelector('#msg')?.textContent || ''); ok('chặn link không https', /chưa hợp lệ/.test(m), m); }
  await a.evaluate(() => document.querySelector('#si-save').scrollIntoView());
  const errs2 = errs.filter(e => !/vietqr|ERR_|net::/.test(e)); ok('không có lỗi trang', !errs2.length, errs2.join(' | '));
  console.log(out.join('\n')); const bad = out.some(l => l.startsWith('FAIL'));
  await b.close(); s1.close(); s2.close(); process.exit(bad ? 1 : 0);
})();
