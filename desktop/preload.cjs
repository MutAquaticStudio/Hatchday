// Cầu nối an toàn giữa trang game và tiến trình chính (contextIsolation, sandbox): chỉ lộ vài hàm cần thiết.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hatchdayDesktop', {
  fullscreen: on => ipcRenderer.invoke('hd:fullscreen', on),
  isFullscreen: () => ipcRenderer.invoke('hd:is-fullscreen'),
  quit: () => ipcRenderer.send('hd:quit'),
  openExternal: url => ipcRenderer.send('hd:open-external', String(url)),
  uiScale: v => ipcRenderer.send('hd:ui-scale', Number(v)),
  os: process.platform,
});
