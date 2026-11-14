// Cầu nối an toàn giữa trang game và tiến trình chính (contextIsolation, sandbox): chỉ lộ vài hàm cần thiết.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hatchdayDesktop', {
  fullscreen: on => ipcRenderer.invoke('hd:fullscreen', on),
  isFullscreen: () => ipcRenderer.invoke('hd:is-fullscreen'),
  quit: () => ipcRenderer.send('hd:quit'),
  openExternal: url => ipcRenderer.send('hd:open-external', String(url)),
  uiScale: v => ipcRenderer.send('hd:ui-scale', Number(v)),
  os: process.platform,
  // Steam: đọc đồng bộ lúc khởi động (ngôn ngữ, có Steam không, Steam Deck), còn lại gọi bất đồng bộ
  steam: (() => {
    const b = ipcRenderer.sendSync('hd:steam-boot') || {};
    return {
      available: !!b.available, lang: b.lang || '', deck: !!b.deck,
      user: () => ipcRenderer.invoke('hd:steam-user'),
      ticket: () => ipcRenderer.invoke('hd:steam-ticket'),
      achieve: id => ipcRenderer.invoke('hd:steam-achieve', String(id)),
      presence: (key, value) => ipcRenderer.invoke('hd:steam-presence', String(key), value),
      dlc: appId => ipcRenderer.invoke('hd:steam-dlc', Number(appId)),
      textInput: o => ipcRenderer.invoke('hd:steam-text', o),
    };
  })(),
});
