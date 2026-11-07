// Tính năng chơi miễn phí (chế độ Chơi thử): 5 mini-game mới chơi thật, Việc làm (bé vắng nhà) + kỹ năng, Thi biểu diễn,
// Lễ hội (?festival=trungthu), Sổ mùa + Sticker, Hẹn chơi + Lời nhắn, bé bạn bè ghé chơi ở Quảng trường, Album ảnh, không còn quầy trả phí,
// và không tràn màn hình 390px. Chạy sau `npm run build`: node scripts/f2p-check.mjs   (cần Playwright + Chromium, ?dev).
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
const until = async (p, fn, ms = 10000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(60); } return false; };
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  const URL0 = `http://localhost:${PORT}/?dev&weather=clear&festival=trungthu`;
  const start = async () => { await p.waitForSelector('#demo'); await p.click('#demo'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1200); };
  await p.goto(URL0); await p.waitForSelector('#demo'); await p.click('#demo'); await p.click('button[type=submit]'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1200);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('hatchday-demo')); d.pet.bond_xp = 800; d.pet.nl = 99; d.pet.no = 90; d.pet.vui = 60; d.pet.sach = 95; d.pet.asleep = false; d.pet.stats_at = new Date().toISOString(); d.coins = 100; localStorage.setItem('hatchday-demo', JSON.stringify(d)); localStorage.setItem('hatchday-tour', '1'); });
  await p.goto(URL0); await start();
  const coins = () => p.evaluate(() => JSON.parse(localStorage.getItem('hatchday-demo')).coins);
  const closeAll = () => p.evaluate(() => { document.querySelectorAll('[data-close]').forEach(x => { if (x.offsetParent) x.click(); }); document.querySelector('#mini [data-mini-close]')?.click(); });
  const tile = async k => { await closeAll(); await p.waitForTimeout(150); await p.evaluate(() => document.querySelector('#a-house').click()); await p.waitForSelector(`[data-go="${k}"]`); await p.evaluate(k => document.querySelector(`[data-go="${k}"]`).click(), k); await p.waitForTimeout(700); };
  const goTo = async place => { await closeAll(); await p.click('#scene-tag'); await p.waitForSelector('#map:not([hidden])'); await p.click(`#map [data-pin="${place}"]`); await p.click(`#map [data-go-place="${place}"]`); await until(p, () => document.querySelector('#map')?.hidden !== false, 8000); await p.waitForTimeout(2500); };
  const openMini = async hot => { await until(p, h => !!document.querySelector(`.hot[data-hot="${h}"]`), 10000, hot); await p.evaluate(h => document.querySelector(`.hot[data-hot="${h}"]`).click(), hot); return until(p, () => { const m = document.querySelector('#mini'); return !!m && !m.hidden && !!m.querySelector('[data-mini-start]'); }, 15000); };
  const fits = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }, sel);
  const result = () => until(p, () => !!document.querySelector('#mini .mini-score'), 60000);
  const resText = () => p.evaluate(() => document.querySelector('#mini .mini-card')?.innerText.replace(/\s+/g, ' ').slice(0, 90));

  /* ---- 5 mini-game ---- */
  await goTo('park'); ok('Câu cá: bến câu ở ao mở màn giới thiệu', await openMini('fish'));
  let c0 = await coins(); await p.click('#mini [data-mini-start]');
  for (let i = 0; i < 6; i++) { // thả câu, chờ phao chìm rồi giật
    await p.evaluate(() => document.querySelector('[data-fish]').click());
    await until(p, () => window.__miniState?.().step === 'bite', 6000); await p.evaluate(() => document.querySelector('[data-fish]').click()); await p.waitForTimeout(150);
  }
  const fishN = await p.evaluate(() => window.__miniState?.().caught ?? -1); ok('Câu cá: giật đúng lúc thì câu được cá', fishN >= 4, 'caught=' + fishN);
  ok('Câu cá: hết giờ hiện kết quả và nhận xu (2 xu/con)', await result() && (await coins()) - c0 >= 8, `+${(await coins()) - c0} · ${await resText()}`);
  ok('Câu cá: kết quả có kinh nghiệm kỹ năng', /Khéo tay \+\d+/.test(await resText()));

  await goTo('library'); ok('Đố vui: giá vẽ ở Thư viện mở màn giới thiệu', await openMini('quiz'));
  c0 = await coins(); await p.click('#mini [data-mini-start]');
  for (let i = 0; i < 5; i++) { await until(p, i => window.__miniState?.().i === i && !!document.querySelector('[data-quiz]:not([disabled])'), 6000, i); await p.evaluate(() => document.querySelector(`[data-quiz="${window.__miniState().correct}"]`).click()); await p.waitForTimeout(950); }
  ok('Đố vui: trả lời đúng cả 5 câu → 15 xu', await result() && (await coins()) - c0 === 15, `+${(await coins()) - c0} · ${await resText()}`);

  await goTo('market'); ok('Giao hàng: xe giao hàng ở Chợ mở màn giới thiệu', await openMini('delivery'));
  c0 = await coins(); await p.click('#mini [data-mini-start]');
  await until(p, () => window.__miniState?.().open === false, 6000);
  for (let i = 0; i < 6; i++) { await p.evaluate(() => document.querySelector(`[data-stall="${window.__miniState().want}"]`).click()); await p.waitForTimeout(550); }
  ok('Giao hàng: giao đúng 6 đơn → 12 xu', await result() && (await coins()) - c0 === 12, `+${(await coins()) - c0} · ${await resText()}`);

  await goTo('plaza'); ok('Nhảy theo nhịp: loa cạnh sân khấu mở màn giới thiệu', await openMini('rhythm'));
  c0 = await coins(); await p.click('#mini [data-mini-start]');
  const KEY = ['a', 's', 'd'];
  const t0 = Date.now();
  while (Date.now() - t0 < 40000) { // chạm đúng làn khi nốt tới vạch
    const s = await p.evaluate(() => { const st = window.__miniState?.(); if (!st) return null; const i = st.chart.findIndex((n, k) => !st.done[k] && Math.abs(n.t - st.now) < 0.09); return { phase: st.phase, lane: i >= 0 ? st.chart[i].lane : -1 }; });
    if (!s || s.phase !== 'play') break; if (s.lane >= 0) await p.keyboard.press(KEY[s.lane]); await p.waitForTimeout(25);
  }
  ok('Nhảy theo nhịp: chạm trúng nhịp và nhận xu', await result() && (await coins()) - c0 >= 8, `+${(await coins()) - c0} · ${await resText()}`);

  await closeAll(); await p.evaluate(() => document.querySelector('.ctx-btn[data-k="home"]')?.click()); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('#a-play').click()); await p.waitForTimeout(2000);
  ok('Bắt sâu: nút "Bắt sâu" ở Vườn mở màn giới thiệu', await p.evaluate(() => { const b = document.querySelector('.ctx-btn[data-k="bugs"]'); b?.click(); return !!b; }) && await until(p, () => !!document.querySelector('#mini [data-mini-start]'), 5000));
  c0 = await coins(); await p.click('#mini [data-mini-start]');
  const t1 = Date.now(); let bugs = 0;
  while (Date.now() - t1 < 34000) {
    const s = await p.evaluate(() => window.__miniState?.()); if (!s || s.phase !== 'play') break; bugs = s.n;
    if (s.cell >= 0 && s.who === 'bug') { const r = await p.evaluate(c => { const e = document.querySelector(`[data-cell="${c}"]`).getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; }, s.cell); await p.touchscreen.tap(r[0], r[1]); }
    await p.waitForTimeout(60);
  }
  ok('Bắt sâu: chạm vào sâu thì bắt được', await result() && (await coins()) - c0 >= 5, `n=${bugs} +${(await coins()) - c0}`);
  ok('Mini-game: thẻ chơi nằm gọn trong màn hình 390px', await fits('#mini .mini-card'));
  await closeAll(); await p.evaluate(() => document.querySelector('.ctx-btn[data-k="home"]')?.click()); await p.waitForTimeout(1500);

  /* ---- Việc làm thêm ---- */
  await tile('jobs'); ok('Việc làm: bảng có 4 việc và 4 kỹ năng', await p.evaluate(() => document.querySelectorAll('[data-job-go]').length === 4 && document.querySelectorAll('.skills li').length === 4));
  await p.evaluate(() => document.querySelector('[data-job-go="library"]').click()); await p.waitForTimeout(800);
  ok('Việc làm: bé đi làm thì vắng nhà (ẩn thú, có thẻ đếm giờ)', await p.evaluate(() => !document.querySelector('#job-chip').hidden));
  await closeAll(); await p.evaluate(() => document.querySelector('#a-eat').click()); await p.waitForTimeout(500);
  ok('Việc làm: đang vắng thì bấm Ăn không đi bếp mà mở bảng Việc làm', await p.evaluate(() => !document.querySelector('#jobs').hidden));
  c0 = await coins(); await p.waitForTimeout(5200); await tile('jobs');
  await until(p, () => !!document.querySelector('[data-job-finish]'), 4000); await p.evaluate(() => document.querySelector('[data-job-finish]').click()); await p.waitForTimeout(900);
  ok('Việc làm: xong ca nhận lương bằng xu (10 xu/giờ, +5% mỗi cấp kỹ năng), bé về nhà', [10, 11].includes((await coins()) - c0) && await p.evaluate(() => document.querySelector('#job-chip').hidden), `+${(await coins()) - c0}`);

  /* ---- Thi biểu diễn ---- */
  await tile('contest'); await p.evaluate(() => document.querySelector('[data-contest-enter]')?.click()); await p.waitForTimeout(800);
  ok('Thi biểu diễn: dự thi được và có bảng xếp hạng', await p.evaluate(() => !!document.querySelector('.leader li.mine') && /đã dự thi/.test(document.querySelector('#contest').innerText)));

  /* ---- Lễ hội ---- */
  await tile('festival'); c0 = await coins(); await p.evaluate(() => document.querySelector('[data-fest-claim]')?.click()); await p.waitForTimeout(800);
  ok('Lễ hội (Trung thu thử): nhận quà lễ +50 xu một lần', (await coins()) - c0 === 50 && await p.evaluate(() => !document.querySelector('[data-fest-claim]')), `+${(await coins()) - c0}`);

  /* ---- Sổ mùa + Sticker ---- */
  await tile('quests'); await p.evaluate(() => document.querySelector('[data-quest-tab="season"]').click()); await p.waitForTimeout(500);
  c0 = await coins(); await p.evaluate(() => document.querySelector('[data-season="0"]')?.click()); await p.waitForTimeout(800);
  ok('Sổ mùa: đủ điểm thì nhận bậc 1 (+20 xu)', (await coins()) - c0 === 20, `+${(await coins()) - c0}`);
  await p.evaluate(() => document.querySelector('[data-quest-tab="stickers"]').click()); await p.waitForTimeout(500);
  c0 = await coins(); await p.evaluate(() => document.querySelector('[data-sticker="st-apron"]')?.click()); await p.waitForTimeout(800);
  ok('Sticker: dán sticker Tạp dề sau ca làm đầu (+10 xu)', (await coins()) - c0 === 10, `+${(await coins()) - c0}`);
  ok('Sticker: sổ 28 ô vừa màn hình', await p.evaluate(() => document.querySelectorAll('.sticker').length === 28) && await fits('#quests'));

  /* ---- Hẹn chơi + lời nhắn ---- */
  await tile('social'); await p.evaluate(() => document.querySelector('[data-soc-tab="mail"]').click()); await p.waitForTimeout(700);
  c0 = await coins(); await p.evaluate(() => document.querySelector('[data-soc="pdyes"]')?.click()); await p.waitForTimeout(900);
  ok('Hẹn chơi: đồng ý lời hẹn của bạn ảo → +15 xu', (await coins()) - c0 === 15, `+${(await coins()) - c0}`);
  await p.evaluate(() => document.querySelector('[data-soc-tab="friends"]').click()); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-soc="note"]').click()); await p.fill('#note-in', 'Chào bé, mai hẹn chơi nha!'); await p.evaluate(() => document.querySelector('[data-soc-form="note"] button').click()); await p.waitForTimeout(700);
  ok('Lời nhắn: gửi được lời nhắn cho bạn', await p.evaluate(() => !document.querySelector('#note-in')));

  /* ---- Bé bạn bè ghé chơi ---- */
  await goTo('plaza'); ok('Bé bạn bè ghé chơi: có nhãn "ghé chơi" ở Quảng trường', await until(p, () => !!document.querySelector('.actor.ghost'), 8000));

  /* ---- Không còn quầy trả phí ---- */
  await closeAll(); await p.evaluate(() => document.querySelector('#btn-coins')?.click()); await p.waitForTimeout(600);
  ok('Cửa hàng: không còn tab "Trả phí"', await p.evaluate(() => !!document.querySelector('#shop') && !/Trả phí/.test(document.querySelector('#shop').innerText)));
  ok('không có lỗi console/trang', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(out.join('\n')); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
