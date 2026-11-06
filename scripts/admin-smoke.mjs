// Kiểm tra trang quản trị trên trình duyệt (chế độ chạy thử trong bộ nhớ, không cần máy chủ). Chạy sau `npm run build:admin`: node scripts/admin-smoke.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../dist-admin/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const PORT = 4205;
const srv = http.createServer((q, r) => { let f = join(root, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html'); r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(PORT);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : ''));
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const open = async (role, vp = { width: 1100, height: 800 }) => {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); }); p.on('dialog', d => d.accept('lý do thử nghiệm'));
    await p.goto(`http://localhost:${PORT}/?role=${role}`); await p.waitForSelector('nav button'); return p;
  };
  const tabs = p => p.$$eval('nav button', els => els.map(e => e.dataset.tab));
  const go = async (p, t) => { await p.click(`nav [data-tab="${t}"]`); await p.waitForSelector('main h2'); };
  const noOverflow = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

  ok('analyst chỉ thấy Tổng quan', JSON.stringify(await tabs(await open('analyst'))) === '["dash"]');
  ok('moderator thấy Người chơi và Kiểm duyệt, không thấy Tặng quà', JSON.stringify(await tabs(await open('moderator'))) === '["users","mod","chat"]');
  ok('support thấy Tổng quan và Người chơi', JSON.stringify(await tabs(await open('support'))) === '["dash","users"]');

  const p = await open('owner');
  ok('owner thấy đủ 9 tab', (await tabs(p)).length === 9, (await tabs(p)).join());
  await p.waitForFunction(() => document.querySelectorAll('.stat').length === 11, null, { timeout: 8000 }).catch(() => {}); // số liệu vẽ sau khi tải xong
  ok('Tổng quan hiện số liệu',(await p.textContent('main')).includes('Người chơi') && (await p.$$('.stat')).length === 11);

  await go(p, 'users'); await p.fill('#q', 'Nắng'); await p.click('#find'); await p.waitForSelector('[data-view]');
  ok('tìm người chơi theo tên, thấy email (owner)', (await p.textContent('#found')).includes('nang@example.com'));
  await p.click('[data-view]'); await p.waitForSelector('#grant');
  await p.click('#grant'); await p.waitForTimeout(300);
  ok('tặng quà thiếu lý do bị từ chối', (await p.textContent('#msg')).includes('lý do'));
  await p.fill('#why', 'bù lỗi'); await p.click('#grant'); await p.waitForTimeout(300);
  ok('tặng quà có lý do thành công', (await p.textContent('#msg')).includes('Đã gửi quà'));

  await go(p, 'gifts'); await p.fill('#ct', 'Quà Tết'); await p.fill('#why', 'tri ân'); await p.click('#prev'); await p.waitForFunction(() => document.getElementById('cnt').textContent.includes('người'));
  ok('xem trước số người nhận', (await p.textContent('#cnt')).startsWith('3 người'));
  await p.click('#mk'); await p.waitForSelector('[data-ap]');
  ok('chiến dịch lớn chờ duyệt', (await p.textContent('main')).includes('Chờ duyệt'));
  await p.click('[data-ap]'); await p.waitForTimeout(400);
  ok('người tạo tự duyệt bị từ chối', (await p.textContent('#msg')).includes('không được tự duyệt'));

  await go(p, 'news'); await p.fill('#nt', 'Bản 1.3'); await p.fill('#why', 'ghi chú cập nhật'); await p.click('#post'); await p.waitForSelector('[data-del]');
  ok('đăng thông báo', (await p.textContent('main')).includes('Bản 1.3'));
  await p.click('[data-del]'); await p.waitForFunction(() => !document.querySelector('[data-del]'));
  ok('xoá thông báo', true);

  await go(p, 'events'); await p.fill('#et', 'Mùa Tết'); await p.fill('#es', '2026-11-01T00:00'); await p.fill('#ee', '2026-12-01T00:00'); await p.selectOption('#ed', 'tet'); await p.fill('#why', 'lịch Tết'); await p.click('#mkev'); await p.waitForSelector('[data-tg]');
  ok('tạo sự kiện', (await p.textContent('main')).includes('Mùa Tết'));
  await p.click('[data-tg]'); await p.waitForFunction(() => document.querySelector('[data-tg]')?.textContent.includes('Bật lại'));
  ok('tắt khẩn cấp sự kiện', true);

  await go(p, 'mod');
  ok('hàng đợi có 1 báo cáo', (await p.$$('[data-rs="mute"]')).length === 1);
  await p.click('[data-rs="mute"]'); await p.waitForSelector('[data-lift]');
  ok('xử lý báo cáo: người bị phạt hiện trong danh sách', (await p.textContent('main')).includes('Nắng'));

  // Bộ lọc chat: thống kê, ô thử cùng luật máy chủ, thêm/xoá từ khoá, tra nhật ký chat, cấm chat từ nhật ký
  await go(p, 'chat'); await p.waitForSelector('#ft');
  ok('tab Bộ lọc chat có thống kê và luật có sẵn', (await p.textContent('main')).includes('Tin 24 giờ qua') && (await p.textContent('main')).includes('Luật có sẵn'));
  await p.fill('#ft', 'gọi 0912 345 678 nhé'); ok('ô thử: số điện thoại bị chặn', (await p.textContent('#fres')).includes('Bị chặn: phone'));
  await p.fill('#ft', 'xin chào cả nhà'); ok('ô thử: câu bình thường gửi được', (await p.textContent('#fres')).includes('Gửi được'));
  await p.fill('#wt', 'từ xấu'); await p.fill('#why', 'thêm từ'); await p.click('#addw'); await p.waitForSelector('[data-dw]');
  ok('thêm từ khoá', (await p.textContent('main')).includes('từ xấu'));
  await p.fill('#ft', 'đây là một từ xấu đấy'); ok('ô thử dùng từ khoá vừa thêm', (await p.textContent('#fres')).includes('Bị chặn: filtered'));
  await p.click('#lgo'); await p.waitForSelector('[data-mute]');
  ok('nhật ký chat hiện 3 tin', (await p.$$('[data-mute]')).length === 3);
  await p.fill('#lq', 'bóng'); await p.click('#lgo'); await p.waitForFunction(() => document.querySelectorAll('[data-mute]').length === 1);
  ok('tìm theo nội dung', (await p.textContent('#llog')).includes('ai chơi bóng không'));
  await p.click('[data-mute]'); await p.waitForFunction(() => document.querySelector('#llog')?.textContent.includes('đang bị phạt'));
  ok('cấm chat từ nhật ký: người đó hiện đang bị phạt', true);

  await go(p, 'sys'); await p.fill('#why', 'đã chốt pháp lý'); await p.click('#chat'); await p.waitForFunction(() => document.querySelector('.pill.ok'));
  ok('bật chat công cộng', (await p.textContent('main')).includes('Đang bật'));
  await go(p, 'audit');
  const log = await p.textContent('main');
  ok('nhật ký ghi đủ việc đã làm', ['grant', 'campaign_create', 'announce_create', 'announce_delete', 'event_create', 'report_mute', 'set_flag', 'word_upsert'].every(a => log.includes(a)), log.slice(0, 0));

  const m = await open('owner', { width: 390, height: 780 });
  ok('điện thoại: Tổng quan không tràn ngang', await noOverflow(m));
  for (const t of ['users', 'gifts', 'mod', 'audit']) { await go(m, t); ok(`điện thoại: ${t} không tràn ngang`, await noOverflow(m)); }

  console.log(out.join('\n')); console.log('errors:', JSON.stringify(errs));
  await b.close(); srv.close(); process.exitCode = (out.some(l => l.startsWith('FAIL')) || errs.length) ? 1 : 0;
})().catch(e => { console.log(out.join('\n')); console.error(e); srv.close(); process.exit(1); });
