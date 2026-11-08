// Sự kiện đang chạy: biểu ngữ dưới thanh trên (bỏ qua được, nhớ theo mã sự kiện), hệ số nhân xu nhiệm vụ, trang trí Quảng trường theo mùa.
// Dữ liệu từ get_active_events (quản trị tạo sự kiện ở admin). Làm mới mỗi 5 phút.
import { _t } from '../i18n';
import * as api from '../data/api';
import { bannerOf, eventBoost, GOAL_METRIC_TEXT, plazaDecor } from './events';
import { setPricingEvents } from './pricing';
import { S, claimGoal, onSync, refreshGoals } from './store';
import { viError } from '../lib/errors';

const SEEN = 'hatchday-event-seen';
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initEvents({ $ }) {
  let list = [], el = null;
  const seen = () => { try { return JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch { return []; } };
  function render() {
    const b = bannerOf(list);
    if (!el) { el = document.createElement('div'); el.id = 'event-banner'; el.className = 'event-banner'; el.hidden = true; $('app').appendChild(el); el.addEventListener('click', e => { const gb = e.target.closest('[data-goal]'); if (gb) { claimGoal(+gb.dataset.goal).then(r => { if (r instanceof Error || (r && !r.reward && r.message)) window.dispatchEvent(new CustomEvent('hatchday:toast', { detail: viError(r) })); else window.dispatchEvent(new CustomEvent('hatchday:toast', { detail: _t`Nhận ${r.reward} xu. Cảm ơn bạn đã góp sức!` })); render(); }); return; }
      if (e.target.closest('[data-ev-x]')) { try { localStorage.setItem(SEEN, JSON.stringify([...seen(), +el.dataset.id])); } catch { /* bỏ qua */ } el.hidden = true; } }); }
    if (!b || seen().includes(b.id)) { el.hidden = true; return; }
    const g = S.goals.find(x => x.active) || S.goals[0];
    const goalRow = g ? _t`<div class="ev-goal"><span>🎯 ${g.reached ? _t('Cả nhà đã đạt mục tiêu!') : _t`Cộng đồng ${GOAL_METRIC_TEXT[g.metric]}: ${g.count.toLocaleString('vi-VN')}/${g.target.toLocaleString('vi-VN')}`} · bạn góp ${g.mine}</span>
      <span class="ev-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${g.target}" aria-valuenow="${Math.min(g.count, g.target)}"><i style="width:${Math.min(100, (g.count / g.target) * 100)}%"></i></span>
      ${g.reached && !g.claimed ? _t`<button type="button" class="btn-sm" data-goal="${g.event_id}" ${g.mine >= g.min_mine ? '' : 'disabled'}>${g.mine >= g.min_mine ? _t`Nhận ${g.reward_coins} xu` : _t`Góp thêm ${g.min_mine - g.mine} lượt để nhận`}</button>` : g.claimed ? _t('<small>Đã nhận thưởng ✓</small>') : ''}</div>` : '';
    el.dataset.id = b.id; el.innerHTML = _t`<div class="ev-row"><span>🎉 ${esc(b.text)}</span><button type="button" data-ev-x aria-label="Đóng thông báo sự kiện">✕</button></div>${goalRow}`; el.hidden = false;
  }
  async function load() { try { list = await api.getActiveEvents(); setPricingEvents(list); await refreshGoals(); } catch { /* mạng chập chờn */ } render(); }
  load(); setInterval(load, 300000); onSync(render);
  return { list: () => list, boost: () => eventBoost(list), decor: () => plazaDecor(list), refresh: load };
}
