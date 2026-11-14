// Bảng Cài đặt (nút ⚙ trên cùng, phím Esc khi không có gì đang mở): hình ảnh, toàn màn hình, cỡ chữ giao diện (bản máy tính),
// hiện FPS, âm thanh, nhắc nhở, Góp ý & Hỗ trợ, hướng dẫn, đăng xuất, thoát game (bản máy tính).
// Các nút chất lượng / âm thanh / nhắc nhở vẫn do module của chúng gắn sự kiện theo id; module này chỉ lo mở/đóng và phần mới.
import { desktop } from '../lib/platform';
import { LANG, setLang } from '../i18n';

const $ = id => document.getElementById(id);
const KEY = 'hatchday-settings';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* bỏ qua */ } };

export function initSettings({ closeOthers }) {
  const sheet = $('settings'), btn = $('btn-settings'); if (!sheet || !btn) return { open() {}, close() {}, isOpen: () => false };
  const st = { ui: 1, fps: false, ...load() };
  const canFull = !!desktop || !!document.fullscreenEnabled;
  sheet.querySelectorAll('.desk-only').forEach(el => { el.hidden = el.id === 'set-full' || el.querySelector('#set-full') ? !canFull : !desktop; });

  const setOpen = on => { if (on) closeOthers(); sheet.hidden = !on; btn.setAttribute('aria-expanded', String(on)); if (on) { syncFull(); sheet.querySelector('button')?.focus({ preventScroll: true }); } };
  btn.addEventListener('click', () => setOpen(sheet.hidden));
  $('settings-close')?.addEventListener('click', () => { setOpen(false); btn.focus(); });

  /* toàn màn hình: bản máy tính qua Electron, bản web qua Fullscreen API */
  const isFull = async () => (desktop ? desktop.isFullscreen() : !!document.fullscreenElement);
  const syncFull = async () => { const b = $('set-full'); if (b) b.setAttribute('aria-pressed', String(await isFull())); };
  $('set-full')?.addEventListener('click', async () => {
    if (desktop) await desktop.fullscreen(); else if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen().catch(() => {});
    setTimeout(syncFull, 150);
  });
  document.addEventListener('fullscreenchange', syncFull);

  /* cỡ chữ giao diện (bản máy tính: phóng cả cửa sổ theo chiều cao, nhân thêm hệ số này) */
  const syncUi = () => sheet.querySelectorAll('[data-ui]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.ui === st.ui)));
  sheet.querySelectorAll('[data-ui]').forEach(b => b.addEventListener('click', () => { st.ui = +b.dataset.ui; save(st); syncUi(); desktop?.uiScale?.(st.ui); }));
  syncUi(); desktop?.uiScale?.(st.ui);

  /* đếm khung hình */
  const fpsEl = document.createElement('div'); fpsEl.className = 'fps-chip'; fpsEl.hidden = !st.fps; fpsEl.setAttribute('aria-hidden', 'true'); document.getElementById('app')?.appendChild(fpsEl);
  const syncFps = () => { $('set-fps')?.setAttribute('aria-pressed', String(st.fps)); fpsEl.hidden = !st.fps; };
  $('set-fps')?.addEventListener('click', () => { st.fps = !st.fps; save(st); syncFps(); });
  syncFps();
  let n = 0, at = performance.now();
  const tick = now => { n++; if (now - at >= 500) { if (st.fps) fpsEl.textContent = `${Math.round(n * 1000 / (now - at))} FPS`; n = 0; at = now; } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);

  /* ngôn ngữ: đổi thì tải lại để mọi chữ dựng lại theo ngôn ngữ mới */
  sheet.querySelectorAll('[data-lang]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)); b.addEventListener('click', () => { if (b.dataset.lang !== LANG) setLang(b.dataset.lang); }); });

  $('btn-quit')?.addEventListener('click', () => desktop?.quit());
  // mở thư Góp ý hay hướng dẫn từ đây thì đóng Cài đặt trước
  ['btn-support', 'btn-tour'].forEach(id => $(id)?.addEventListener('click', () => setOpen(false), true));

  return { open: () => setOpen(true), close: () => setOpen(false), isOpen: () => !sheet.hidden };
}
