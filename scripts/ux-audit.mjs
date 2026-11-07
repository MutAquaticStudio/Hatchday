// Rà soát giao diện tự động: với mỗi màn hình (nhà, từng sheet, từng địa điểm, mini-game…) chụp ảnh và quét lỗi bố cục
// (tràn ngang, nút nhỏ hơn 36px, nút đè lên nhau, chữ bị cắt, nút ra ngoài màn hình). Dùng để audit UX/UI, chưa nằm trong CI.
// Chạy sau `npm run build`:  node scripts/ux-audit.mjs [rộng=390] [thư-mục-ảnh]   → in tóm tắt, ghi <thư-mục-ảnh>/audit.json
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const PORT = 4197;
const srv = http.createServer((q, r) => { let f = join(root, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html'); r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(PORT);
const W = +(process.argv[2] || 390), H = W >= 900 ? 800 : Math.round(W * 2.05), OUT = process.argv[3] || '/tmp/ux-audit';
mkdirSync(OUT, { recursive: true });
const until = async (p, fn, ms = 10000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(80); } return false; };

/** Chạy trong trang: trả về danh sách vấn đề bố cục của màn hình hiện tại. */
function scan() {
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && !e.closest('[hidden]'); };
  const label = e => (e.getAttribute('aria-label') || e.textContent || e.id || e.className || e.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 36);
  const R = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const issues = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > innerWidth + 1) issues.push({ k: 'tràn ngang trang', d: `scrollWidth ${doc.scrollWidth} > ${innerWidth}` });
  const ints = [...document.querySelectorAll('button, a[href], input, select, textarea, [role=button], .hot')].filter(vis);
  for (const e of ints) {
    const r = R(e);
    if (r.w < 36 || r.h < 36) { if (!(e.matches('input[type=range],input[type=checkbox]') && r.h >= 20)) issues.push({ k: 'nút nhỏ', d: `${label(e)} ${Math.round(r.w)}×${Math.round(r.h)}` }); }
    if (r.r > innerWidth + 1 || r.l < -1) issues.push({ k: 'ra ngoài màn hình (ngang)', d: `${label(e)} l=${Math.round(r.l)} r=${Math.round(r.r)}` });
    if (r.b > innerHeight + 1 && getComputedStyle(e).position === 'fixed') issues.push({ k: 'ra ngoài màn hình (dọc)', d: label(e) });
  }
  for (let i = 0; i < ints.length; i++) for (let j = i + 1; j < ints.length; j++) {
    const a = ints[i], b = ints[j]; if (a.contains(b) || b.contains(a)) continue;
    const ra = R(a), rb = R(b), w = Math.min(ra.r, rb.r) - Math.max(ra.l, rb.l), h = Math.min(ra.b, rb.b) - Math.max(ra.t, rb.t);
    if (w > 4 && h > 4 && (w * h) / Math.min(ra.w * ra.h, rb.w * rb.h) > 0.3) {
      // chỉ tính khi hai nút cùng nằm trên cùng (không bị lớp khác che) để tránh báo giả với sheet nằm trên cảnh
      const cx = (Math.max(ra.l, rb.l) + Math.min(ra.r, rb.r)) / 2, cy = (Math.max(ra.t, rb.t) + Math.min(ra.b, rb.b)) / 2, top = document.elementFromPoint(cx, cy);
      if (top && (a.contains(top) || b.contains(top))) issues.push({ k: 'nút đè lên nhau', d: `${label(a)} ⟷ ${label(b)}` });
    }
  }
  for (const e of document.querySelectorAll('button, .pill, .chip, b, span, p, h1, h2, h3, small, li, label')) {
    if (!vis(e) || e.children.length > 3) continue; const s = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && /hidden|clip/.test(s.overflowX) && s.textOverflow !== 'ellipsis' && (e.textContent || '').trim()) issues.push({ k: 'chữ bị cắt', d: `${label(e)} (${e.scrollWidth}>${e.clientWidth})` });
  }
  const uniq = new Map(); for (const i of issues) uniq.set(i.k + '|' + i.d, i);
  return [...uniq.values()];
}

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mobile = W < 900;
  const p = await (await b.newContext({ viewport: { width: W, height: H }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  const URL0 = `http://localhost:${PORT}/?dev&event=all`;
  await p.goto(URL0); await p.waitForSelector('#demo'); await p.click('#demo'); await p.click('button[type=submit]'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1000);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('hatchday-demo')); d.pet.bond_xp = 800; d.pet.nl = 80; d.pet.no = 55; d.pet.vui = 50; d.pet.sach = 60; d.pet.stats_at = new Date().toISOString(); d.coins = 640; localStorage.setItem('hatchday-demo', JSON.stringify(d)); localStorage.setItem('hatchday-tour', '1'); });
  await p.goto(URL0); await p.waitForSelector('#demo'); await p.click('#demo'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1500);

  const report = []; const shot = async name => {
    await p.waitForTimeout(450);
    const issues = await p.evaluate(scan); await p.screenshot({ path: join(OUT, `${W}_${name}.png`) });
    report.push({ name, issues }); console.log(`${issues.length ? '!!' : 'ok'} ${name}${issues.length ? ' — ' + issues.length + ' vấn đề' : ''}`); issues.forEach(i => console.log('     · ' + i.k + ': ' + i.d));
  };
  const closeAll = () => p.evaluate(() => { document.querySelectorAll('[data-close]').forEach(b => { if (b.offsetParent) b.click(); }); document.querySelector('#mini [data-mini-close]')?.click(); document.querySelector('[data-photo-exit]')?.click(); });
  const openTile = async k => { await closeAll(); await p.waitForTimeout(120); await p.evaluate(() => { const h = document.querySelector('#house'); if (!h || h.hidden) document.querySelector('#a-house').click(); }); await p.waitForSelector(`[data-go="${k}"]`); await p.evaluate(k => document.querySelector(`[data-go="${k}"]`).click(), k); await p.waitForTimeout(k === 'cooking' ? 4500 : 500); };
  const goTo = async place => { await closeAll(); await p.click('#scene-tag'); await p.waitForSelector('#map:not([hidden])'); await shot('map_open'); await p.click(`#map [data-pin="${place}"]`); await p.click(`#map [data-go-place="${place}"]`); await until(p, () => document.querySelector('#map')?.hidden !== false, 8000); await p.waitForTimeout(3200); };
  const home = async () => { await closeAll(); await p.evaluate(() => document.querySelector('.ctx-btn[data-k="home"]')?.click()); await p.waitForTimeout(1500); };

  await shot('home');
  await p.evaluate(() => document.querySelector('#a-house').click()); await p.waitForTimeout(500); await shot('house_menu');
  for (const k of ['shop', 'wardrobe', 'quests', 'dex', 'family', 'cooking', 'clinic', 'social', 'spaces']) { await openTile(k); await shot('sheet_' + k); }
  await openTile('quests'); await p.evaluate(() => document.querySelector('[data-quest-tab="explore"]').click()); await shot('sheet_quests_explore');
  await p.evaluate(() => document.querySelector('[data-quest-tab="badges"]').click()); await shot('sheet_quests_badges');
  await closeAll(); await p.evaluate(() => document.querySelector('#btn-stats').click()); await p.waitForTimeout(500); await shot('sheet_stats');
  await closeAll(); await p.evaluate(() => document.querySelector('#btn-diary')?.click()); await p.waitForTimeout(500); await shot('sheet_diary');
  await closeAll(); await p.evaluate(() => document.querySelector('#a-eat').click()); await p.waitForTimeout(1500); await shot('kitchen');
  await p.evaluate(() => document.querySelector('#a-bath').click()); await p.waitForTimeout(1500); await shot('bath');
  await p.evaluate(() => document.querySelector('#a-play').click()); await p.waitForTimeout(1500); await shot('garden');
  await p.evaluate(() => document.querySelector('#a-house').click()); await p.waitForTimeout(300); await closeAll();
  for (const place of ['plaza', 'park', 'tea', 'hospital', 'market', 'tailor', 'library']) { await goTo(place); await shot('place_' + place); }
  await goTo('park'); await p.evaluate(() => document.querySelector('.hot[data-hot="catch"]')?.click()); await p.waitForSelector('#mini [data-mini-start]', { timeout: 15000 }).catch(() => {}); await shot('mini_intro');
  await closeAll();
  writeFileSync(join(OUT, `audit_${W}.json`), JSON.stringify({ width: W, report, errs }, null, 1));
  const total = report.reduce((n, r) => n + r.issues.length, 0);
  console.log(`\nTổng: ${report.length} màn, ${total} vấn đề, ${errs.length} lỗi console`); errs.slice(0, 5).forEach(e => console.log('  ' + e));
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
