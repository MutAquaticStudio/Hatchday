// Nhà cung cấp quảng cáo thưởng. Chỉ bật khi đã cấu hình rõ: AdSense/H5 Games Ads (VITE_ADS_PROVIDER=adsense + VITE_ADSENSE_CLIENT)
// hoặc bản thử có đếm giây (Chơi thử, hoặc VITE_ADS_PROVIDER=test). Nếu máy chủ bật cờ ads.enabled mà chưa cấu hình nhà cung cấp thì
// không có quảng cáo nào hiện (createAdProvider trả về null), tuyệt đối không phát xu cho quảng cáo giả ở bản thật.
import { isDemo } from '../data/api';

/** Quảng cáo giả đếm ngược, để thử luồng và chạy kiểm tra tự động. */
function overlayAd({ seconds, onTick }) {
  return new Promise(resolve => {
    const el = document.createElement('div'); el.className = 'ad-overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Quảng cáo thử');
    let left = seconds;
    el.innerHTML = `<div class="ad-box"><small>Quảng cáo thử (không phải quảng cáo thật)</small><div class="ad-art" aria-hidden="true">🎬</div><b class="ad-left" aria-live="polite">${left}</b><button type="button" class="btn-sm ghost" data-ad-skip>Bỏ qua (không nhận xu)</button></div>`;
    document.getElementById('app').appendChild(el);
    const done = r => { clearInterval(t); el.remove(); resolve(r); };
    const t = setInterval(() => { left -= 1; el.querySelector('.ad-left').textContent = String(Math.max(left, 0)); if (onTick) onTick(left); if (left <= 0) done('viewed'); }, 1000);
    el.querySelector('[data-ad-skip]').addEventListener('click', () => done('dismissed'));
  });
}
export const testProvider = { name: 'test', show: o => overlayAd(o) };

let adsenseLoaded = null;
function loadAdsense(client) {
  return adsenseLoaded || (adsenseLoaded = new Promise((ok, bad) => {
    const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous'; s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    s.onload = () => { window.adsbygoogle = window.adsbygoogle || []; window.adBreak = window.adConfig = o => window.adsbygoogle.push(o); window.adConfig({ preloadAdBreaks: 'on', sound: 'on' }); ok(); };
    s.onerror = () => { adsenseLoaded = null; bad(new Error('ads_load')); };
    document.head.appendChild(s);
  }));
}
/** Ad Placement API của H5 Games Ads (cần Google duyệt). CHƯA thử với quảng cáo thật. Chỉ cấp xu trong adViewed. */
export const adsenseProvider = client => ({
  name: 'adsense',
  async show() {
    try { await loadAdsense(client); } catch { return 'unavailable'; }
    return new Promise(resolve => {
      let finished = false; const end = r => { if (!finished) { finished = true; resolve(r); } };
      window.adBreak({ type: 'reward', name: 'xu-thuong', beforeReward: showAd => showAd(), adViewed: () => end('viewed'), adDismissed: () => end('dismissed'), adBreakDone: info => end(info && info.breakStatus === 'viewed' ? 'viewed' : 'unavailable') });
    });
  },
});

export function createAdProvider() {
  const kind = import.meta.env.VITE_ADS_PROVIDER, client = import.meta.env.VITE_ADSENSE_CLIENT;
  if (kind === 'adsense' && client) return adsenseProvider(client);
  if (isDemo || kind === 'test') return testProvider;
  return null;
}
