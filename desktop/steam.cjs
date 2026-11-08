// Steamworks cho bản máy tính (steamworks.js). Không có Steam (chạy thử, CI, chưa mở Steam) thì mọi hàm trả về rỗng/false
// và game vẫn chạy với đăng nhập email. App ID: biến STEAM_APP_ID, tệp steam_appid.txt cạnh tệp chạy, hoặc 480 (Spacewar) để thử.
const fs = require('node:fs');
const path = require('node:path');

let sw = null, client = null, error = '';
function readAppId() {
  if (process.env.STEAM_APP_ID) return +process.env.STEAM_APP_ID;
  for (const dir of [process.cwd(), path.dirname(process.execPath), __dirname]) {
    try { const n = +fs.readFileSync(path.join(dir, 'steam_appid.txt'), 'utf8').trim(); if (n) return n; } catch { /* thử chỗ khác */ }
  }
  return 480;
}

function init() {
  if (process.env.HATCHDAY_NO_STEAM === '1') { error = 'disabled'; return false; }
  try {
    sw = require('steamworks.js');
    client = sw.init(readAppId());
    try { sw.electronEnableSteamOverlay(); } catch { /* overlay không bắt buộc */ }
    return true;
  } catch (e) { client = null; error = String((e && e.message) || e); return false; }
}

const safe = (fn, fallback) => { try { return client ? fn() : fallback; } catch { return fallback; } };

/** Thông tin đọc đồng bộ lúc trang khởi động (ngôn ngữ cần biết trước khi dựng chữ). */
const boot = () => ({
  available: !!client,
  lang: safe(() => client.apps.currentGameLanguage(), ''),
  deck: safe(() => client.utils.isSteamRunningOnSteamDeck(), false),
  error: client ? '' : error,
});

function register(ipcMain) {
  ipcMain.on('hd:steam-boot', e => { e.returnValue = boot(); });
  ipcMain.handle('hd:steam-user', () => safe(() => ({ name: client.localplayer.getName(), steamId: client.localplayer.getSteamId().steamId64.toString() }), null));
  // vé cho Web API: máy chủ (Edge Function steam-auth) kiểm với Steam để biết đúng là ai
  ipcMain.handle('hd:steam-ticket', async () => {
    if (!client) return null;
    try { const t = await client.auth.getAuthTicketForWebApi('hatchday'); return t.getBytes().toString('hex'); } catch { return null; }
  });
  ipcMain.handle('hd:steam-achieve', (_e, id) => (typeof id === 'string' && /^ACH_[A-Z0-9_]+$/.test(id) ? safe(() => client.achievement.activate(id), false) : false));
  ipcMain.handle('hd:steam-presence', (_e, key, value) => (typeof key === 'string' && key.length < 64 ? safe(() => { client.localplayer.setRichPresence(key, value == null ? null : String(value).slice(0, 255)); return true; }, false) : false));
  ipcMain.handle('hd:steam-dlc', (_e, appId) => (Number.isInteger(appId) ? safe(() => client.apps.isDlcInstalled(appId), false) : false));
  // bàn phím ảo trên Steam Deck / tay cầm: trả về chữ đã nhập hoặc null khi huỷ
  ipcMain.handle('hd:steam-text', async (_e, o) => {
    if (!client) return null;
    try { return await client.utils.showGamepadTextInput(0, 0, String(o?.desc || '').slice(0, 100), Math.min(500, Math.max(1, +o?.max || 100)), String(o?.text || '')); } catch { return null; }
  });
}

module.exports = { init, register, boot };
