// Nhắc nhở khi bé cần chăm: tuỳ chọn bật trong Chỉ số. Khi bạn rời tab, sau ~40 phút nếu bé đã đói, buồn hoặc bẩn thì hiện một thông báo
// (tối đa một lần mỗi 4 giờ). Chạy trong trình duyệt nên chỉ hoạt động lúc trình duyệt còn mở; thông báo đẩy từ máy chủ (khi đóng hẳn trình duyệt)
// cần khoá VAPID và một tác vụ gửi, chưa làm (service worker đã có sẵn trình nhận push).
import { decayStats } from './rules';

const PREF = 'hatchday-notify', LAST = 'hatchday-notify-last', WAIT_MS = 40 * 60000, GAP_MS = 4 * 3600000;
const supported = () => 'Notification' in window && 'serviceWorker' in navigator;
const wants = () => { try { return localStorage.getItem(PREF) === '1'; } catch { return false; } };

export function initNotify({ S, $ }) {
  const btn = $('btn-notify'), note = $('notify-note');
  if (!btn) return;
  let timer = null;
  const paint = () => {
    if (!supported()) { btn.hidden = true; if (note) note.textContent = 'Trình duyệt này chưa hỗ trợ thông báo.'; return; }
    const denied = Notification.permission === 'denied', on = wants() && Notification.permission === 'granted';
    btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'Bật' : 'Tắt';
    if (note) note.textContent = denied ? 'Thông báo đang bị chặn trong cài đặt trình duyệt. Bật lại ở đó nếu bạn muốn nhận nhắc nhở.' : 'Khi bạn rời tab một lúc và bé cần chăm, mình sẽ nhắc nhẹ (tối đa 4 giờ một lần).';
  };
  btn.addEventListener('click', async () => {
    if (!supported()) return;
    if (wants() && Notification.permission === 'granted') { try { localStorage.setItem(PREF, '0'); } catch { /* bỏ qua */ } paint(); return; }
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    try { localStorage.setItem(PREF, p === 'granted' ? '1' : '0'); } catch { /* bỏ qua */ }
    paint();
  });
  const need = () => {
    const mins = (Date.now() - S.t) / 60000, d = decayStats({ no: S.no, vui: S.vui, nl: S.nl, sach: S.sach, asleep: S.asleep, illness: S.illness }, mins, S.comfort);
    if (S.illness) return `${S.name} đang không khoẻ, ghé xem bé nhé.`;
    if (d.no < 35) return `${S.name} đói rồi, ghé cho bé ăn nhé.`;
    if (d.vui < 35) return `${S.name} hơi buồn, ghé chơi với bé nhé.`;
    if (d.sach < 30) return `${S.name} bẩn rồi, ghé tắm cho bé nhé.`;
    return null;
  };
  async function remind() {
    if (!wants() || !supported() || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
    let last = 0; try { last = +localStorage.getItem(LAST) || 0; } catch { /* bỏ qua */ }
    if (Date.now() - last < GAP_MS) return;
    const msg = need(); if (!msg) return;
    try { const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return; await reg.showNotification('Hatchday', { body: msg, icon: './icon.svg', tag: 'care', data: { url: './' } }); localStorage.setItem(LAST, String(Date.now())); } catch { /* bỏ qua */ }
  }
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (document.visibilityState === 'hidden' && wants()) timer = setTimeout(remind, WAIT_MS);
  });
  if (window.location.search.includes('dev')) window.__remindNow = remind;
  paint();
}
