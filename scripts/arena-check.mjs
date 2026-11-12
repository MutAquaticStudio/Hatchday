// Đấu trường: mở từ menu Nhà, đánh trọn một trận (tua nhanh ?battlefast), kiểm tra lời dẫn, thanh thể lực, Sổ khắc hệ, màn kết quả,
// nút Rời trận và bố cục trên điện thoại dọc (nút chiêu nằm trong màn hình, không đè lên bảng thông tin).
// Chạy sau `npm run build` (bản Chơi thử): node scripts/arena-check.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../dist/', import.meta.url).pathname, types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const PORT = 4232;
const srv = http.createServer((q, r) => { let f = join(root, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html'); r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(PORT);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : ''));
const until = async (p, fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await p.waitForTimeout(150); } return false; };

async function session(b, vp, label, full) {
  const p = await (await b.newContext({ viewport: vp })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const U = `http://localhost:${PORT}/?dev&weather=clear&battlefast`;
  await p.goto(U); await p.click('#demo'); await p.click('button[type=submit]').catch(() => {}); await until(p, () => !!document.querySelector('#a-house'), 30000);
  await p.evaluate(() => { localStorage.setItem('hatchday-tour', '1'); localStorage.setItem('hatchday-matchups', '[]'); const d = JSON.parse(localStorage.getItem('hatchday-demo')); d.pet.species = 'cao-bac'; d.pet.bond_xp = 1950; d.pet.born_at = new Date(Date.now() - 20 * 864e5).toISOString(); d.pet.stage = 'adult'; localStorage.setItem('hatchday-demo', JSON.stringify(d)); });
  await p.goto(U); await p.click('#demo'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1200);
  await p.evaluate(() => { document.querySelector('.welcome [data-w="close"]')?.click(); document.querySelector('#a-house').click(); }); await p.waitForTimeout(300);
  await p.click('[data-go="arena"]');
  ok(`${label}: mở Đấu trường thì hiện sân đấu`, await until(p, () => !document.querySelector('#battle').hidden, 5000));
  const ready = await until(p, () => window.__battle.state().awaiting, 180000);
  const st = await p.evaluate(() => window.__battle.state());
  ok(`${label}: sau phần giới thiệu thì hiện 4 chiêu để chọn`, ready && st.moves === 4 && (await p.$$('.bt-move')).length === 4, JSON.stringify(st));
  ok(`${label}: Sổ khắc hệ đã biết sẵn 5 cặp của hệ mình`, st.found === 5, String(st.found));
  const lay = await p.evaluate(() => {
    const r = e => e.getBoundingClientRect(), mv = [...document.querySelectorAll('.bt-move')].map(r), pl = [...document.querySelectorAll('.bt-plate')].map(r), W = innerWidth, H = innerHeight;
    const inside = mv.every(b => b.left >= 0 && b.right <= W + 0.5 && b.top >= 0 && b.bottom <= H + 0.5), over = mv.some(b => pl.some(q => !(b.right <= q.left || b.left >= q.right || b.bottom <= q.top || b.top >= q.bottom)));
    return { inside, over, minH: Math.min(...mv.map(b => b.height)) };
  });
  ok(`${label}: nút chiêu nằm trọn trong màn hình, không đè bảng thông tin, đủ cao để bấm`, lay.inside && !lay.over && lay.minH >= 44, JSON.stringify(lay));
  if (!full) {
    await p.click('[data-bt="run"]'); await p.click('[data-bt="run"]');
    ok(`${label}: bấm Rời trận hai lần thì thoát`, await until(p, () => document.querySelector('#battle').hidden, 4000));
    ok(`${label}: không có lỗi trang`, !errs.length, errs.join(' | '));
    return p.context().close();
  }
  await p.click('[data-bt="chart"]');
  ok(`${label}: Sổ khắc hệ mở bảng 5×5`, await p.evaluate(() => document.querySelectorAll('.bt-chart td').length === 25));
  await p.click('[data-bt="chart-close"]');
  await p.keyboard.press('4'); await until(p, () => !window.__battle.state().awaiting, 3000);
  ok(`${label}: phím số 4 chọn chiêu tối thượng`, !(await p.evaluate(() => window.__battle.state().awaiting)));
  let n = 0;
  while (n++ < 400) { const s = await p.evaluate(() => window.__battle.state()); if (s.over !== null && s.over !== undefined) break; if (s.awaiting) await p.evaluate(k => { window.__battle.choose(k); }, n % 4); await p.waitForTimeout(250); }
  const end = await p.evaluate(() => window.__battle.state());
  ok(`${label}: trận kết thúc có thắng thua`, end.over === 0 || end.over === 1 || end.over === -1, JSON.stringify(end));
  ok(`${label}: một bên về 0 thể lực hoặc hết 30 lượt`, end.hp[0] === 0 || end.hp[1] === 0 || end.turn > 30, JSON.stringify(end.hp));
  ok(`${label}: hiện màn kết quả`, await until(p, () => !document.querySelector('.bt-result').hidden, 60000));
  const jn = await p.evaluate(() => JSON.parse(localStorage.getItem('hatchday-matchups') || '[]').length);
  ok(`${label}: Sổ khắc hệ lưu cặp hệ đối thủ đã dùng (đối thủ khác hệ thì có thêm cặp mới)`, end.els[0] === end.els[1] ? jn === 5 : jn > 5, `${jn} cặp, hệ ${end.els}`);
  await p.click('[data-bt="again"]');
  ok(`${label}: Trận mới bắt đầu lại`, await until(p, () => window.__battle.state().turn === 1 && document.querySelector('.bt-result').hidden, 10000));
  await p.evaluate(() => window.__battle.close()); await p.waitForTimeout(500);
  ok(`${label}: về nhà thì đóng Đấu trường`, await p.evaluate(() => document.querySelector('#battle').hidden));
  ok(`${label}: không có lỗi trang`, !errs.length, errs.join(' | '));
  await p.context().close();
}
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try { await session(b, { width: 1280, height: 720 }, 'máy tính', true); await session(b, { width: 390, height: 844 }, 'điện thoại', false); }
  catch (e) { ok('chạy hết kịch bản', false, e.message); }
  console.log(out.join('\n')); await b.close(); srv.close(); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})();
