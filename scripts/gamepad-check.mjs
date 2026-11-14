// Tay cầm: giả một tay cầm "standard" (navigator.getGamepads) rồi bấm thật: Y mở menu Nhà, D-pad di chuyển vòng chọn,
// A mở ô đang chọn, B đóng bảng, Start mở Cài đặt, LB/RB đổi tab, cần trái dắt bé đi ở Vườn; dải gợi ý nút hiện khi dùng tay cầm.
// Chạy sau `npm run build` (bản Chơi thử): node scripts/gamepad-check.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const PORT = 4231;
const srv = http.createServer((q, r) => { let f = join(root, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html'); r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(PORT);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : ''));
const until = async (p, fn, ms = 8000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(80); } return false; };

// tay cầm giả: window.__pad.press(i) giữ nút i trong vài khung hình rồi nhả; __pad.axes đặt cần
const FAKE = () => {
  const pad = { id: 'Fake Xbox Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.__pad = {
    pad, press(i, ms = 320) { pad.buttons[i].pressed = true; pad.buttons[i].value = 1; setTimeout(() => { pad.buttons[i].pressed = false; pad.buttons[i].value = 0; }, ms); },
    axes(a) { pad.axes = a; },
  };
  navigator.getGamepads = () => [pad, null, null, null];
};

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(FAKE);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const U = `http://localhost:${PORT}/?dev&weather=clear`;
  await p.goto(U); await p.waitForSelector('#demo'); await p.click('#demo'); await p.click('button[type=submit]').catch(() => {});
  await until(p, () => !!document.querySelector('#a-house'), 30000);
  await p.evaluate(() => { localStorage.setItem('hatchday-tour', '1'); const d = JSON.parse(localStorage.getItem('hatchday-demo')); d.pet.bond_xp = 800; d.pet.nl = 99; localStorage.setItem('hatchday-demo', JSON.stringify(d)); });
  await p.goto(U); await p.click('#demo'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.querySelector('.welcome [data-w="close"]')?.click(); window.dispatchEvent(new Event('gamepadconnected')); });
  const press = async (i, wait = 400) => { await p.evaluate(i => window.__pad.press(i), i); await p.waitForTimeout(wait); };

  await press(3, 700); // Y
  ok('Y mở menu Nhà', await until(p, () => !document.querySelector('#house')?.hidden));
  ok('dùng tay cầm thì hiện dải gợi ý nút và vòng chọn', await p.evaluate(() => document.body.classList.contains('pad') && !document.querySelector('.pad-hints').hidden));
  const f0 = await p.evaluate(() => document.activeElement?.closest('#house') ? (document.activeElement.dataset.go || document.activeElement.className) : 'ngoài');
  const cur = () => p.evaluate(() => document.activeElement?.closest('#house') ? (document.activeElement.dataset.go || document.activeElement.className) : 'ngoài');
  for (let k = 0; k < 3; k++) { await press(13, 50); if (await until(p, f => { const a = document.activeElement; return !!a?.closest('#house') && (a.dataset.go || a.className) !== f; }, 2500, f0)) break; } // D-pad xuống
  const f1 = await cur();
  for (let k = 0; k < 3; k++) { await press(15, 50); if (await until(p, f => (document.activeElement?.dataset.go || document.activeElement?.className) !== f, 1500, f1)) break; } await until(p, f => { const a = document.activeElement; return !!a?.closest('#house') && (a.dataset.go || a.className) !== f; }, 5000, f1); // phải
  const f2 = await cur();
  ok('D-pad: lần đầu chọn ô nội dung đầu tiên của bảng, sau đó di chuyển theo hướng', f1 !== 'ngoài' && f2 !== 'ngoài' && f2 !== f1, `${f0} → ${f1} → ${f2}`);
  // chọn ô Nhiệm vụ rồi A
  await p.evaluate(() => document.querySelector('[data-go="quests"]').focus());
  await press(0, 700);
  ok('A mở ô đang chọn (Nhiệm vụ)', await until(p, () => !!document.querySelector('#quests') && !document.querySelector('#quests').hidden));
  const tab0 = await p.evaluate(() => document.querySelector('#quests [aria-selected="true"], #quests [data-quest-tab].on')?.dataset.questTab || '');
  await press(5, 50); // RB
  await until(p, t0 => (document.querySelector('#quests [aria-selected="true"]')?.dataset.questTab || '') !== t0, 5000, tab0);
  const tab1 = await p.evaluate(() => document.querySelector('#quests [aria-selected="true"], #quests [data-quest-tab].on')?.dataset.questTab || '');
  ok('RB đổi sang tab kế tiếp', tab0 !== tab1 && !!tab1, `${tab0} → ${tab1}`);
  await press(1, 600); // B
  ok('B đóng bảng', await until(p, () => !document.querySelector('.hsheet:not([hidden])')));
  await press(9, 600); // Start
  ok('Start mở Cài đặt', await until(p, () => !document.querySelector('#settings')?.hidden));
  await press(1, 50);
  ok('B đóng Cài đặt', await until(p, () => document.querySelector('#settings')?.hidden, 6000));
  // cần trái dắt bé ở Vườn
  await p.evaluate(() => { document.querySelector('#a-house').click(); document.querySelector('[data-go="garden"]').click(); }); await p.waitForTimeout(2500);
  const before = await p.evaluate(() => window.__petPos?.());
  await p.evaluate(() => window.__pad.axes([1, 0, 0, 0])); await until(p, b => { const q = window.__petPos?.(); return !!q && Math.abs(q[0] - b[0]) > 0.6; }, 6000, before); await p.evaluate(() => window.__pad.axes([0, 0, 0, 0]));
  const after = await p.evaluate(() => window.__petPos?.());
  ok('cần trái dắt bé đi', !!before && !!after && Math.abs(after[0] - before[0]) > 0.5, JSON.stringify({ before, after }));
  await p.mouse.move(400, 300); await p.mouse.move(600, 400); await p.waitForTimeout(200);
  ok('dùng chuột thì ẩn gợi ý tay cầm', await p.evaluate(() => !document.body.classList.contains('pad')));
  ok('không có lỗi trang', !errs.length, errs.join(' | '));
  console.log(out.join('\n'));
  await b.close(); srv.close(); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})();
