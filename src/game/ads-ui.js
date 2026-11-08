// Xem video nhận xu (tự nguyện). Máy chủ quyết định phần thưởng (ads.ts, 20261211000000_ad_rewards.sql); ở đây chỉ hiện quảng cáo và gọi RPC.
import { _t } from '../i18n';
import * as api from '../data/api';
import { viError } from '../lib/errors';
import { AD } from './ads';
import { createAdProvider } from './ads-providers.js';
import { sfx } from './audio.js';

const CONSENT = 'hatchday-ad-consent';
const consented = () => { try { return localStorage.getItem(CONSENT) === '1'; } catch { return false; } };

export function initAds({ ctx, store, head, open, app, $ }) {
  let st = null, busy = false;
  const provider = createAdProvider();
  const mins = s => Math.ceil(s / 60);
  async function openAds() { open('ads'); render(); try { st = await api.getAdState(); } catch { st = null; } render(); }
  function render() {
    const el = $('ads'); if (!el || el.hidden) return;
    let body;
    if (!provider) body = _t('<p class="hs-note">Chưa có quảng cáo để xem. Quay lại sau nhé.</p>');
    else if (!st) body = _t('<p class="hs-note">Đợi chút nhé…</p>');
    else if (st.enabled !== true) body = _t('<p class="hs-note">Quảng cáo thưởng đang tạm tắt.</p>');
    else if (!consented()) body = _t`<p class="hs-note">Xem một video ngắn để nhận ${st.reward} xu. Quảng cáo do bên thứ ba cung cấp và có thể dùng cookie. Bạn xem hoàn toàn tự nguyện, không xem cũng không mất gì.</p>
      <label class="check"><input type="checkbox" id="ad-consent"> <span>Tôi đồng ý xem quảng cáo thưởng</span></label><div class="soc-act"><button type="button" class="btn-sm" data-ad="consent" disabled>Đồng ý</button></div>`;
    else body = _t`<p class="hs-note">Xem một video khoảng ${AD.minWatchSeconds} giây để nhận <b>${st.reward} xu</b>. Hôm nay còn <b>${st.left}</b>/${st.per_day} lượt${st.next_in > 0 ? _t`, lượt kế tiếp sau ${mins(st.next_in)} phút` : ''}.</p>
      <div class="soc-act"><button type="button" class="btn-sm" data-ad="watch" ${st.left > 0 && st.next_in <= 0 && !busy ? '' : 'disabled'}>Xem video nhận ${st.reward} xu</button></div>
      <p class="hs-note">Nếu không có quảng cáo hoặc bạn đóng giữa chừng, bạn không bị trừ gì và không nhận xu. Quảng cáo không đổi lấy thuốc hay đồ cứu bé.</p>`;
    el.innerHTML = head(_t('Xem video nhận xu'), _t('Tự nguyện, có giới hạn mỗi ngày')) + `<div class="hs-body">${body}</div>`;
  }
  async function watch(btn) {
    if (busy || !provider) return; busy = true; btn.disabled = true;
    try {
      const t = await api.startAdReward();
      const outcome = await provider.show({ seconds: Math.max(t.wait + 1, 3) });
      if (outcome === 'viewed') {
        const r = await api.claimAdReward(t.nonce); sfx('coin'); ctx.buzz?.(12); ctx.toast(_t`Cảm ơn bạn! Nhận ${r.reward} xu.`); await store.refreshEconomy();
      } else ctx.toast(outcome === 'dismissed' ? _t('Bạn đã đóng giữa chừng nên chưa nhận xu.') : _t('Chưa có quảng cáo lúc này, thử lại sau nhé.'));
    } catch (e) { ctx.toast(viError(e)); }
    busy = false; try { st = await api.getAdState(); } catch { /* giữ bản cũ */ } render();
  }
  app.addEventListener('click', e => {
    const b = e.target.closest('[data-ad]'); if (!b) return;
    if (b.dataset.ad === 'watch') watch(b);
    else if (b.dataset.ad === 'consent') { try { localStorage.setItem(CONSENT, '1'); } catch { /* bỏ qua */ } render(); }
  });
  app.addEventListener('change', e => { if (e.target.id === 'ad-consent') { const b = document.querySelector('[data-ad="consent"]'); if (b) b.disabled = !e.target.checked; } });
  return { open: openAds };
}
