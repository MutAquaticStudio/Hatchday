// Sự kiện đang chạy: biểu ngữ dưới thanh trên (bỏ qua được, nhớ theo mã sự kiện), hệ số nhân xu nhiệm vụ, trang trí Quảng trường theo mùa.
// Dữ liệu từ get_active_events (quản trị tạo sự kiện ở admin). Làm mới mỗi 5 phút.
import * as api from '../data/api';
import { bannerOf, eventBoost, plazaDecor } from './events';

const SEEN = 'hatchday-event-seen';
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initEvents({ $ }) {
  let list = [], el = null;
  const seen = () => { try { return JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch { return []; } };
  function render() {
    const b = bannerOf(list);
    if (!el) { el = document.createElement('div'); el.id = 'event-banner'; el.className = 'event-banner'; el.hidden = true; $('app').appendChild(el); el.addEventListener('click', e => { if (e.target.closest('[data-ev-x]')) { try { localStorage.setItem(SEEN, JSON.stringify([...seen(), +el.dataset.id])); } catch { /* bỏ qua */ } el.hidden = true; } }); }
    if (!b || seen().includes(b.id)) { el.hidden = true; return; }
    el.dataset.id = b.id; el.innerHTML = `<span>🎉 ${esc(b.text)}</span><button type="button" data-ev-x aria-label="Đóng thông báo sự kiện">✕</button>`; el.hidden = false;
  }
  async function load() { try { list = await api.getActiveEvents(); } catch { /* mạng chập chờn */ } render(); }
  load(); setInterval(load, 300000);
  return { list: () => list, boost: () => eventBoost(list), decor: () => plazaDecor(list), refresh: load };
}
