// Dải khung hình hiệu ứng chiêu thức (trình xem ?dev của Đấu trường): mỗi chiêu chụp 8 khung trải đều trên thời lượng của nó,
// ghép thành một ảnh 4×2 để xem nhịp (lấy đà → hành động → trúng → dư âm), độ rõ trên từng sân, rác hình còn sót.
// Chạy sau `npm run build`: node scripts/vfx-strips.mjs [thư-mục-ra] [lọc-tên]   (mặc định ./vfx-strips)
// Kèm kiểm tra: thời lượng đo được ≤ trần sổ tay (docs/VFX-STYLE-GUIDE.md), không lỗi trang, hiệu ứng tự dọn sau khi xong.
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../dist/', import.meta.url).pathname, types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const PORT = 4591, OUT = process.argv[2] || 'vfx-strips', ONLY = process.argv[3] || '';
const srv = http.createServer((q, r) => { let f = join(root, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html'); r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(PORT);
const until = async (p, fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await p.waitForTimeout(60); } return false; };

// [loài, chiêu 0..3, sân 0..4, tuỳ chọn] — phủ đủ 5 hệ × 4 tầng chiêu × các dạng; mỗi chiêu thử trên một sân khác nhau
const SAMPLE = [
  ['bong-lua', 2, 0], ['ong-mat', 3, 2], ['mam-xanh', 3, 1], ['hoa-mai', 3, 3], ['nai-co', 0, 4], ['sen-hong', 1, 0], ['co-may', 2, 3],
  ['giot-mua', 3, 1], ['long-thuy', 3, 4], ['ca-bong', 3, 0], ['rai-ca', 2, 2], ['ngoc-trai', 0, 3], ['oc-gao', 2, 1], ['sua-bien', 2, 3],
  ['dieu-giay', 3, 2], ['cau-vong', 3, 0], ['hai-au', 3, 4], ['se-nau', 3, 1], ['hac-trang', 3, 3], ['gio-nhe', 0, 2], ['chim-lac', 1, 4],
  ['trang-khuyet', 3, 3], ['cao-bac', 2, 0], ['cao-bac', 3, 4], ['doi-nho', 3, 2], ['huou-sao', 3, 1], ['meo-muop', 0, 3], ['nam-ngu', 1, 0], ['dom-dom', 2, 4],
  ['lua-bep', 3, 4], ['banh-troi', 3, 2], ['xoi-gac', 2, 0, { crit: true }], ['tra-sua', 2, 1], ['banh-flan', 3, 3], ['banh-bo', 0, 4], ['che-ba-mau', 3, 0], ['keo-bong-gon', 3, 1],
  ['chuon-chuon', 2, 2, { guard: true }], ['ca-heo-hong', 3, 1],
];

(async () => {
  mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage(), errs = [], report = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const U = `http://localhost:${PORT}/?dev&weather=clear`;
  await p.goto(U); await p.click('#demo'); await p.click('button[type=submit]').catch(() => {}); await until(p, () => !!document.querySelector('#a-house'), 30000);
  await p.evaluate(() => { localStorage.setItem('hatchday-tour', '1'); const d = JSON.parse(localStorage.getItem('hatchday-demo')); d.pet.species = 'cao-bac'; d.pet.bond_xp = 1950; d.pet.born_at = new Date(Date.now() - 20 * 864e5).toISOString(); d.pet.stage = 'adult'; localStorage.setItem('hatchday-demo', JSON.stringify(d)); });
  await p.goto(U); await p.click('#demo'); await until(p, () => !!document.querySelector('#a-house'), 30000); await p.waitForTimeout(1000);
  await p.evaluate(() => { document.querySelector('.welcome [data-w="close"]')?.click(); document.querySelector('#a-house').click(); }); await p.waitForTimeout(300);
  await p.click('[data-go="arena"]'); await until(p, () => window.__battle?.lobbyReady(), 60000);
  await p.click('[data-mode="practice"]'); await until(p, () => window.__battle.state().awaiting, 180000);
  // tờ ghép ảnh
  const sheet = await ctx.newPage(); await sheet.setContent('<canvas id=c></canvas>');
  const compose = (imgs, label) => sheet.evaluate(async ({ imgs, label }) => {
    const W = 480, Hh = 270, c = document.getElementById('c'); c.width = W * 4; c.height = Hh * 2 + 34; const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < imgs.length; i++) { const im = new Image(); im.src = 'data:image/png;base64,' + imgs[i].png; await im.decode(); g.drawImage(im, (i % 4) * W, 34 + Math.floor(i / 4) * Hh, W, Hh); g.fillStyle = '#ffe9a8'; g.font = 'bold 16px sans-serif'; g.fillText(imgs[i].t.toFixed(2) + ' s', (i % 4) * W + 8, 34 + Math.floor(i / 4) * Hh + 20); }
    g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.fillText(label, 10, 24); return c.toDataURL('image/png').split(',')[1];
  }, { imgs, label });

  for (const [sp, idx, arena, o = {}] of SAMPLE) {
    const id = `${sp}-${idx + 1}`; if (ONLY && !id.includes(ONLY)) continue;
    await p.evaluate(a => window.__battle.setArena(a), arena);
    // lượt "khô" để dựng hình quái thú của loài và đo thời lượng
    const dry = await p.evaluate(([sp, idx, o]) => window.__battle.demoMove(sp, idx, o), [sp, idx, o]);
    await p.waitForTimeout(300);
    const span = 0.28 + dry.t + 0.15, frames = [];
    await p.evaluate(([sp, idx, o, first]) => { window.__battle.holdIn(first); window.__demo = window.__battle.demoMove(sp, idx, o); }, [sp, idx, o, 0.28 + 0.06]);
    let at = 0.34;
    for (let i = 0; i < 8; i++) {
      await until(p, () => window.__battle.held(), 20000);
      frames.push({ png: (await p.screenshot()).toString('base64'), t: at - 0.28 });
      const next = 0.28 + 0.06 + (span - 0.34) * (i + 1) / 7; await p.evaluate(dt => { window.__battle.resume(); if (dt > 0) window.__battle.holdIn(dt); }, i < 7 ? next - at : 0); at = next;
    }
    await p.evaluate(() => { window.__battle.resume(); return window.__demo; });
    const name = `${String(report.length + 1).padStart(2, '0')}-${id}-${dry.form}-${dry.motif}.png`, label = `${dry.name} · ${id} · ${dry.form}/${dry.motif} · sân ${arena} · ${dry.t.toFixed(2)} s / trần ${dry.budget} s`;
    writeFileSync(join(OUT, name), Buffer.from(await compose(frames, label), 'base64'));
    report.push(`${dry.t <= dry.budget + 0.45 ? 'OK  ' : 'FAIL'} ${id.padEnd(16)} ${(dry.form + '/' + dry.motif).padEnd(18)} đo ${dry.t.toFixed(2)} s · kế hoạch ${dry.plan.toFixed(2)} s · trần ${dry.budget} s · ${name}`);
    await p.waitForTimeout(200);
  }
  // các nhịp còn lại: trạng thái, cuối lượt, ra sân, gục
  for (const st of ['root', 'soak', 'daze', 'blind', 'burn']) { await p.evaluate(s => window.__battle.demoStatus(s), st); await p.waitForTimeout(700); }
  await p.evaluate(() => window.__battle.demoTick('burn')); await p.evaluate(() => window.__battle.demoTick('regen'));
  await p.evaluate(() => window.__battle.demoFaint(1)); await p.evaluate(() => window.__battle.demoEnter(1));
  await p.waitForTimeout(4500);
  const st = await p.evaluate(() => window.__battle.fxStats());
  report.push(`${st.tasks <= 8 && st.sprites <= 30 ? 'OK  ' : 'FAIL'} hiệu ứng tự dọn sau khi xong ${JSON.stringify(st)}`);
  report.push(`${errs.length ? 'FAIL' : 'OK  '} không có lỗi trang ${errs.slice(0, 5).join(' | ')}`);
  console.log(report.join('\n')); await b.close(); srv.close(); process.exit(report.some(l => l.startsWith('FAIL')) ? 1 : 0);
})();
