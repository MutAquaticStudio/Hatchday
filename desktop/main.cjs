// Vỏ Electron của Hatchday (bản Steam). Phục vụ thư mục dist/ (build với VITE_PLATFORM=steam) qua giao thức riêng app://hatchday
// để module ES, fetch và CSP chạy như trên web; một cửa sổ duy nhất; nhớ kích thước; F11 / Alt+Enter toàn màn hình;
// liên kết ngoài mở bằng trình duyệt mặc định; DevTools chỉ mở khi chạy với HATCHDAY_DEV=1.
const { app, BrowserWindow, ipcMain, net, protocol, session, shell, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { readCsp } = require('./csp.cjs');
const steam = require('./steam.cjs');

const DIST = path.join(__dirname, 'dist');
const DEV = process.env.HATCHDAY_DEV === '1';
const SHOT = process.env.HATCHDAY_SCREENSHOT; // dùng cho kiểm thử tự động: chụp ảnh cửa sổ rồi thoát
const ORIGIN = 'app://hatchday';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
if (!app.requestSingleInstanceLock()) { app.quit(); }
steam.init(); // trước khi tạo cửa sổ để overlay Steam gắn được vào

const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function loadState() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return { width: 1280, height: 720, fullscreen: false }; } }
function saveState(win) { try { const b = win.getNormalBounds(); fs.writeFileSync(stateFile(), JSON.stringify({ ...b, fullscreen: win.isFullScreen() })); } catch { /* bỏ qua */ } }

let win = null, uiScale = 1;
// Giao diện thiết kế cho khung ~1280×720: cửa sổ lớn hơn thì phóng to cả trang (chữ, nút) theo chiều cao, cảnh 3D vẫn nét
// vì devicePixelRatio tăng theo. Người chơi chỉnh thêm bằng "Cỡ chữ" trong Cài đặt.
function applyZoom() {
  if (!win) return; const [w, h] = win.getContentSize();
  const z = Math.max(0.8, Math.min(3, Math.min(h / 720, w / 1280) * uiScale));
  win.webContents.setZoomFactor(Math.round(z * 100) / 100);
}
function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    width: Math.max(1024, st.width || 1280), height: Math.max(600, st.height || 720), x: st.x, y: st.y, minWidth: 1024, minHeight: 600,
    fullscreen: !!st.fullscreen, backgroundColor: '#ffd7e6', title: 'Hatchday', show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: DEV, spellcheck: false, backgroundThrottling: true },
  });
  win.once('ready-to-show', () => win.show());
  win.on('resize', applyZoom); win.webContents.on('did-finish-load', applyZoom);
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
  win.on('close', () => saveState(win));
  // Không cho trang tự chuyển đi nơi khác; liên kết ngoài (https) mở bằng trình duyệt mặc định
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
    if (DEV && input.key === 'F12') win.webContents.toggleDevTools();
  });
  win.loadURL(`${ORIGIN}/index.html${SHOT ? '?dev' : ''}`);
  if (SHOT) {
    setTimeout(async () => { try { const img = await win.webContents.capturePage(); fs.writeFileSync(SHOT, img.toPNG()); } catch (err) { console.error(err); } app.exit(0); }, +(process.env.HATCHDAY_SHOT_DELAY || 6000));
  }
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  if (!DEV) Menu.setApplicationMenu(null);
  const csp = readCsp(DIST);
  protocol.handle('app', async req => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    let file = path.normalize(path.join(DIST, rel));
    if (!file.startsWith(DIST)) return new Response('Not found', { status: 404 });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html'); // điều hướng kiểu SPA
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers({ 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff' });
    if (file.endsWith('.html')) headers.set('content-security-policy', csp);
    return new Response(res.body, { status: 200, headers });
  });
  // Không xin quyền gì ngoài thông báo (nhắc nhở cục bộ) và toàn màn hình
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'notifications' || perm === 'fullscreen'));
  ipcMain.handle('hd:fullscreen', (_e, on) => { if (!win) return false; win.setFullScreen(typeof on === 'boolean' ? on : !win.isFullScreen()); return win.isFullScreen(); });
  ipcMain.handle('hd:is-fullscreen', () => !!win && win.isFullScreen());
  ipcMain.on('hd:quit', () => app.quit());
  steam.register(ipcMain);
  ipcMain.on('hd:ui-scale', (_e, v) => { if (Number.isFinite(v)) { uiScale = Math.max(0.7, Math.min(1.5, v)); applyZoom(); } });
  ipcMain.on('hd:open-external', (_e, url) => { if (/^https:\/\/[^\s]+$/.test(url)) shell.openExternal(url); });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
