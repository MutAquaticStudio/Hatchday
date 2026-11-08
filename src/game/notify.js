// Nhắc nhở khi bé cần chăm (tuỳ chọn bật trong Chỉ số), hai lớp:
//  1) Thông báo đẩy từ máy chủ (Web Push): tới cả khi đã đóng hẳn trình duyệt. Chỉ có ở bản chạy thật có khoá VAPID, khi trình duyệt hỗ trợ
//     (iPhone cần Thêm vào Màn hình chính) và máy chủ bật cờ push.enabled. Người chơi chọn loại (chăm bé, thư, sự kiện); giờ yên lặng 22:00–07:00.
//  2) Nhắc nhở cục bộ (dự phòng): khi rời tab ~40 phút mà bé đói/buồn/bẩn/ốm thì hiện thông báo, tối đa một lần mỗi 4 giờ. Chỉ chạy lúc trình duyệt còn mở,
//     và tự nhường chỗ cho thông báo đẩy khi thiết bị này đã đăng ký push và máy chủ đang bật push.
import { _t } from '../i18n';
import { decayStats } from './rules';
import { getPushState, setPushPrefs } from '../data/api';
import { needsInstall, pushSupported, serverPushEnabled, subscribePush, unsubscribePush } from '../lib/push';
import { milestone } from '../lib/telemetry';

const PREF = 'hatchday-notify', LAST = 'hatchday-notify-last', PUSH = 'hatchday-notify-push', WAIT_MS = 40 * 60000, GAP_MS = 4 * 3600000;
const supported = () => 'Notification' in window && 'serviceWorker' in navigator;
const wants = () => { try { return localStorage.getItem(PREF) === '1'; } catch { return false; } };
const flag = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) === '1'; localStorage.setItem(k, v ? '1' : '0'); } catch { /* bỏ qua */ } return !!v; };

export function initNotify({ S, $ }) {
  const btn = $('btn-notify'), note = $('notify-note'), row = $('push-row');
  if (!btn) return;
  let timer = null, serverOn = false, prefs = { care: true, events: true, mail: true, quiet_from: 22, quiet_to: 7 };
  const pushActive = () => flag(PUSH) && serverOn;
  const paint = () => {
    if (!supported()) { btn.hidden = true; if (note) note.textContent = _t('Trình duyệt này chưa hỗ trợ thông báo.'); return; }
    const denied = Notification.permission === 'denied', on = wants() && Notification.permission === 'granted';
    btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? _t('Bật') : _t('Tắt');
    if (note) {
      note.textContent = denied ? _t('Thông báo đang bị chặn trong cài đặt trình duyệt. Bật lại ở đó nếu bạn muốn nhận nhắc nhở.')
        : on && pushActive() ? _t('Mình sẽ nhắc nhẹ cả khi bạn đã đóng trang (không làm phiền 22:00–07:00).')
        : needsInstall() && pushSupported() ? _t('Trên iPhone, hãy Thêm vào Màn hình chính để nhận nhắc nhở khi đóng trang.')
        : _t('Khi bạn rời tab một lúc và bé cần chăm, mình sẽ nhắc nhẹ (tối đa 4 giờ một lần).');
    }
    if (row) {
      row.hidden = !(on && pushActive());
      row.querySelectorAll('[data-pp]').forEach(b => b.setAttribute('aria-pressed', String(prefs[b.dataset.pp] !== false)));
    }
  };
  async function loadServer() {
    if (!pushSupported()) { serverOn = false; return; }
    serverOn = await serverPushEnabled();
    try { prefs = { ...prefs, ...(await getPushState()).prefs }; } catch { /* giữ mặc định */ }
    // làm mới đăng ký thiết bị nếu người chơi đang bật (phòng khi trình duyệt đổi khoá)
    if (wants() && Notification.permission === 'granted' && flag(PUSH)) subscribePush().catch(() => {});
    paint();
  }
  btn.addEventListener('click', async () => {
    if (!supported()) return;
    if (wants() && Notification.permission === 'granted') { flag(PREF, false); if (flag(PUSH)) { flag(PUSH, false); unsubscribePush(); } paint(); return; }
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    flag(PREF, p === 'granted');
    if (p === 'granted' && pushSupported()) { try { flag(PUSH, await subscribePush()); if (flag(PUSH)) milestone('push_on'); } catch { flag(PUSH, false); } }
    paint();
  });
  row?.addEventListener('click', async e => {
    const b = e.target.closest('[data-pp]'); if (!b) return;
    prefs = { ...prefs, [b.dataset.pp]: !(prefs[b.dataset.pp] !== false) }; paint();
    try { await setPushPrefs(prefs); } catch { /* lần sau thử lại */ }
  });
  // Service worker báo đăng ký push đã đổi: đăng ký lại
  navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.type === 'resubscribe' && wants() && flag(PUSH)) subscribePush().catch(() => {}); });

  const need = () => {
    const mins = (Date.now() - S.t) / 60000, d = decayStats({ no: S.no, vui: S.vui, nl: S.nl, sach: S.sach, asleep: S.asleep, illness: S.illness }, mins, S.comfort);
    if (S.illness) return _t`${S.name} đang không khoẻ, ghé xem bé nhé.`;
    if (d.no < 35) return _t`${S.name} đói rồi, ghé cho bé ăn nhé.`;
    if (d.vui < 35) return _t`${S.name} hơi buồn, ghé chơi với bé nhé.`;
    if (d.sach < 30) return _t`${S.name} bẩn rồi, ghé tắm cho bé nhé.`;
    return null;
  };
  async function remind() {
    if (!wants() || !supported() || Notification.permission !== 'granted' || document.visibilityState === 'visible' || pushActive()) return;
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
  paint(); loadServer();
}
