// Mini-game: Bắt bướm (Công viên) và Pha trà (Tiệm trà): mở, chơi thật bằng chạm, nhận xu, hết lượt, không tràn màn hình.
// Chạy sau `npm run build`: node scripts/mini-check.mjs   (cần Playwright + Chromium). Cần ?dev (window.__miniState).
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const PORT = 4198;
const srv = http.createServer((q, r) => { let f = join(root, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html'); r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(PORT);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : ''));
const until = async (p, fn, ms = 10000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(60); } return false; };
const SHOT = process.env.MINI_SHOT_DIR;
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  const URL0 = `http://localhost:${PORT}/?dev&weather=clear`; // thời tiết cố định để kịch bản không phụ thuộc giờ chạy (mưa làm bé tự chạy đi trú)
  const start = async () => { await p.waitForSelector('#demo'); await p.click('#demo'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1200); };
  await p.goto(URL0); await p.waitForSelector('#demo'); await p.click('#demo'); await p.click('button[type=submit]'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1200);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('hatchday-demo')); d.pet.bond_xp = 800; d.pet.nl = 99; d.pet.no = 90; d.pet.vui = 40; d.pet.sach = 95; d.pet.stats_at = new Date().toISOString(); d.coins = 100; localStorage.setItem('hatchday-demo', JSON.stringify(d)); localStorage.setItem('hatchday-tour', '1'); });
  await p.goto(URL0); await start();
  const goTo = async place => { await p.click('#scene-tag'); await p.waitForSelector('#map:not([hidden])'); await p.click(`#map [data-pin="${place}"]`); await p.click(`#map [data-go-place="${place}"]`); await until(p, () => document.querySelector('#map')?.hidden !== false, 8000); await p.waitForTimeout(2500); };
  const coins = () => p.evaluate(() => JSON.parse(localStorage.getItem('hatchday-demo')).coins);
  const shot = async n => { if (SHOT) await p.screenshot({ path: `${SHOT}/${n}.png` }); };
  const overflow = () => p.evaluate(() => { const c = document.querySelector('#mini .mini-card'), r = c.getBoundingClientRect(); return { right: Math.round(r.right), left: Math.round(r.left), bottom: Math.round(r.bottom), vw: innerWidth, vh: innerHeight, sw: c.scrollWidth - c.clientWidth }; });
  const openMini = async hot => { await until(p, h => !!document.querySelector(`.hot[data-hot="${h}"]`), 10000, hot); await p.evaluate(h => document.querySelector(`.hot[data-hot="${h}"]`).click(), hot); return until(p, () => { const m = document.querySelector('#mini'); return !!m && !m.hidden && !!m.querySelector('[data-mini-start]'); }, 12000); };

  /* ---- Bắt bướm ---- */
  await goTo('park');
  ok('Bắt bướm: chạm điểm "Bắt bướm" mở màn giới thiệu', await openMini('catch'));
  let o = await overflow(); ok('Bắt bướm: thẻ giới thiệu nằm trong màn hình', o.left >= 0 && o.right <= o.vw && o.bottom <= o.vh && o.sw <= 0, JSON.stringify(o)); await shot('mini_intro');
  const c0 = await coins();
  await p.click('#mini [data-mini-start]'); ok('Bắt bướm: bắt đầu chơi ngay trong Công viên 3D (không còn lớp phủ che cảnh), có thanh điểm', await until(p, () => !!window.__miniState && !!document.querySelector('#mini-hud') && !document.querySelector('#mini-hud').hidden && document.querySelector('#mini').hidden, 6000));
  const hudBox = await p.evaluate(() => { const r = document.querySelector('#mini-hud').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), vw: innerWidth, hidesNav: getComputedStyle(document.querySelector('.bottom')).display === 'none' }; });
  ok('Bắt bướm: thanh điểm nằm trong màn hình, thanh dưới được ẩn để khỏi bấm nhầm', hudBox.l >= 0 && hudBox.r <= hudBox.vw && hudBox.hidesNav, JSON.stringify(hudBox)); await shot('mini_butterfly');
  await p.touchscreen.tap(8, 400).catch(() => {}); // chạm hụt không làm hỏng
  let caught = 0; const t0 = Date.now();
  while (Date.now() - t0 < 28000) {
    const st = await p.evaluate(() => window.__miniState && window.__miniState()); if (!st) break; caught = st.caught; if (st.phase !== 'play' || caught >= 12) break;
    const cand = st.bs.filter(([x, y]) => x > 10 && x < 380 && y > 150 && y < 640)[0]; if (cand) await p.touchscreen.tap(cand[0], cand[1]).catch(() => {}); await p.waitForTimeout(120);
  }
  ok('Bắt bướm: chạm vào bướm thì bắt được (≥ 5 con)', caught >= 5, 'caught=' + caught);
  ok('Bắt bướm: hiện kết quả sau khi xong', await until(p, () => !!document.querySelector('#mini .mini-score'), 34000));
  const res = await p.evaluate(() => document.querySelector('#mini .mini-card').innerText); await shot('mini_butterfly_result');
  const c1 = await coins(); ok('Bắt bướm: nhận xu theo số bướm (1 xu/con)', c1 - c0 >= 5 && /Nhận \+\d+ xu/.test(res), `+${c1 - c0} · ${res.replace(/\s+/g, ' ').slice(0, 80)}`);
  await p.evaluate(() => document.querySelector('#mini [data-mini-close]').click());
  ok('Bắt bướm: đóng lại thì lớp phủ ẩn', await p.evaluate(() => document.querySelector('#mini').hidden === true));

  /* ---- Pha trà ---- */
  await goTo('tea');
  ok('Pha trà: chạm ấm trà mở màn giới thiệu', await openMini('brew'));
  o = await overflow(); ok('Pha trà: thẻ giới thiệu nằm trong màn hình', o.left >= 0 && o.right <= o.vw && o.bottom <= o.vh && o.sw <= 0, JSON.stringify(o)); await shot('mini_brew_intro');
  const c2 = await coins();
  await p.click('#mini [data-mini-start]'); ok('Pha trà: bước 1 hiện thanh chạy', await until(p, () => !!document.querySelector('#b-bar') && !!window.__miniState, 4000));
  await shot('mini_brew');
  const hits = [];
  for (let step = 0; step < 5; step++) {
    ok(`Pha trà: bước ${step + 1} đúng thứ tự`, await until(p, s => window.__miniState().step === s && window.__miniState().marker !== undefined, 6000, step));
    // chờ vạch vào vùng xanh rồi dừng (mô phỏng người chơi giỏi); riêng bước 3 cố tình dừng ngoài vùng để thử luật "trượt"
    const target = step === 2 ? 'miss' : 'hit';
    const done = await until(p, t => { const s = window.__miniState(); if (!s.zone) return false; const [c, w] = s.zone, inZ = Math.abs(s.marker - c) <= w * 0.3, outZ = Math.abs(s.marker - c) > w * 0.9; if (t === 'hit' ? inZ : outZ) { document.querySelector('[data-brew-stop]').click(); return true; } return false; }, 8000, target);
    hits.push(done); await p.waitForTimeout(800);
  }
  ok('Pha trà: dừng được cả 5 bước', hits.every(Boolean));
  ok('Pha trà: hiện kết quả', await until(p, () => !!document.querySelector('#mini .mini-score'), 6000));
  const res2 = await p.evaluate(() => document.querySelector('#mini .mini-card').innerText); await shot('mini_brew_result');
  const c3 = await coins(); ok('Pha trà: 4 sao (trượt bước 3) nhận 12 xu', c3 - c2 === 12 && /4/.test(res2), `+${c3 - c2} · ${res2.replace(/\s+/g, ' ').slice(0, 80)}`);
  await p.evaluate(() => document.querySelector('#mini [data-mini-close]').click());

  /* ---- Khám phá & huy hiệu đã ghi nhận ---- */
  const w = await p.evaluate(() => JSON.parse(localStorage.getItem('hatchday-demo')).world);
  ok('Mini-game được ghi vào Khám phá hôm nay và tổng huy hiệu', (w.kinds.butterfly || 0) > 0 && (w.kinds.brew || 0) > 0 && (w.totals.butterfly || 0) >= 5, JSON.stringify({ k: w.kinds, t: w.totals }));
  /* ---- Chụp ảnh ---- */
  await p.evaluate(() => document.querySelector('#btn-stats').click()); await p.waitForSelector('#btn-photo', { state: 'visible' });
  await p.evaluate(() => document.querySelector('#btn-photo').click());
  ok('Chụp ảnh: vào chế độ chụp thì ẩn giao diện, còn nút chụp', await until(p, () => document.querySelector('#app').classList.contains('photo') && !document.querySelector('#photo-ui').hidden && getComputedStyle(document.querySelector('.top')).display === 'none', 3000));
  await shot('photo_mode');
  await p.evaluate(() => document.querySelector('[data-photo-shot]').click());
  ok('Chụp ảnh: bấm chụp ra ảnh có khung', await until(p, () => { const i = document.querySelector('#photo-view img'); return !!i && i.complete && i.naturalWidth > 300; }, 8000));
  const ph = await p.evaluate(() => { const i = document.querySelector('#photo-view img'), r = document.querySelector('#photo-view .mini-card').getBoundingClientRect(); return { w: i.naturalWidth, h: i.naturalHeight, right: Math.round(r.right), bottom: Math.round(r.bottom), vw: innerWidth, vh: innerHeight, btns: [...document.querySelectorAll('#photo-view .btn-sm')].map(b => b.textContent) }; });
  ok('Chụp ảnh: thẻ xem ảnh nằm trong màn hình, có Lưu ảnh', ph.right <= ph.vw && ph.bottom <= ph.vh && ph.btns.includes('Lưu ảnh'), JSON.stringify(ph)); await shot('photo_result');
  await p.evaluate(() => document.querySelector('[data-photo-done]').click());
  ok('Chụp ảnh: bấm Xong thì trở lại giao diện thường', await p.evaluate(() => !document.querySelector('#app').classList.contains('photo') && getComputedStyle(document.querySelector('.top')).display !== 'none'));
  ok('không có lỗi console/trang', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(out.join('\n')); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
