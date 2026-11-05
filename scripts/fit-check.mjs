// Kiểm tra mặc đồ: mọi loài × giai đoạn/dáng × món trang phục, báo các trường hợp đồ đè tai/sừng/chỏm hoặc lún vào đầu/thân.
// Chạy sau `npm run build`: node scripts/fit-check.mjs   (cần Playwright + Chromium)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // Playwright cài sẵn toàn cục hoặc trong devDependencies
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let f = join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html');
  r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f));
}).listen(4199);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await (await b.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  await p.goto('http://localhost:4199/?fitcheck'); await p.waitForSelector('#demo'); await p.click('#demo');
  await p.click('button[type=submit]'); await p.waitForFunction(() => typeof window.__fitCheck === 'function', null, { timeout: 30000 });
  const r = await p.evaluate(() => window.__fitCheck());
  console.log(`Đã thử ${r.checked} tổ hợp, ${r.bad.length} trường hợp bị lẹm.`);
  r.bad.slice(0, 30).forEach(x => console.log(' ', JSON.stringify(x)));
  process.exitCode = r.bad.length ? 1 : 0;
} finally { await b.close(); srv.close(); }
