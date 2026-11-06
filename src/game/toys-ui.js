// Bảng Đồ chơi: đồ mang theo (mua bằng xu, chơi ở đâu cũng được) và đồ cố định ở từng nơi (Ban công, Phòng chơi, Sân thượng, Công viên).
// Máy chủ quyết định hiệu ứng và trần ngày (play_toy); bảng này chỉ hiện và gọi ctx.playToy (game.js lo hoạt ảnh).
import { S, buyToy, refreshToys } from './store';
import { TOYS } from './toys';
import { bondLevel } from './bond';
import { priceOf, salePct } from './pricing';
import { PLACE_BY_ID } from './places/registry';
import { viError } from '../lib/errors';

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initToys({ ctx, head, open, app, $ }) {
  function render() {
    const el = $('toys'); if (!el || el.hidden) return;
    const lvl = bondLevel(S.bondXp), sale = salePct('toy');
    const row = t => {
      const used = S.toys.used[t.id] || 0, left = Math.max(0, t.cap - used), locked = lvl < t.bond, portable = t.place === 'portable', owned = portable && S.toys.owned.includes(t.id);
      const where = portable ? 'Mang theo, chơi ở đâu cũng được' : `Ở ${PLACE_BY_ID[t.place]?.name || ''}`;
      let act;
      if (locked) act = `<small>Gắn bó cấp ${t.bond}</small>`;
      else if (portable && !owned) { const p = priceOf('toy', t.price); act = `<button type="button" class="btn-sm buy" data-toy-buy="${t.id}" ${S.coins >= p ? '' : 'disabled'}>${p} xu</button>`; }
      else if (portable) act = `<button type="button" class="btn-sm" data-toy-play="${t.id}" ${left ? '' : 'disabled'}>Chơi</button>`;
      else act = `<small>${left}/${t.cap} lượt</small>`;
      return `<div class="toy-row${locked ? ' lock' : ''}"><span class="toy-ic" aria-hidden="true">${t.icon}</span><div><b>${esc(t.name)}</b><small>${where} · +${t.vui} Vui${owned || !portable ? ` · còn ${left}/${t.cap} lượt hôm nay` : ''}${used >= 2 ? ' · từ lượt thứ 3 chỉ còn một nửa' : ''}</small></div>${act}</div>`;
    };
    el.innerHTML = head('Đồ chơi', 'Chơi nhiều thì bé vui, nhưng cũng mệt') + `<div class="hs-body">${sale ? `<div class="sale-note">🏷 Đang giảm giá ${sale}% đồ chơi</div>` : ''}
      <h3>Mang theo</h3>${TOYS.filter(t => t.place === 'portable').map(row).join('')}
      <h3>Ở các nơi</h3>${TOYS.filter(t => t.place !== 'portable').map(row).join('')}
      <p class="hs-note">Đồ chơi ở các nơi mở theo Gắn bó (Ban công, Phòng chơi, Sân thượng ở menu Nhà; Công viên trên Bản đồ). Mỗi món có trần lượt mỗi ngày và làm bé mệt.</p></div>`;
  }
  async function openToys() { open('toys'); render(); try { await refreshToys(); } catch { /* giữ bản cũ */ } render(); }
  app.addEventListener('click', async e => {
    const buy = e.target.closest('[data-toy-buy]'), play = e.target.closest('[data-toy-play]');
    if (buy) { buy.disabled = true; const err = await buyToy(buy.dataset.toyBuy); if (err) ctx.toast(viError(err)); else { ctx.toast('Đã mua đồ chơi mới!'); } render(); }
    else if (play) { ctx.closeAllSheets?.(); ctx.playToy(play.dataset.toyPlay); }
  });
  return { open: openToys };
}
