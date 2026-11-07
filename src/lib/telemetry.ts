/**
 * Đo lường nhẹ cho nhà phát triển (dashboard admin): phiên chơi và nguồn người dùng. Không cookie bên thứ ba, không gửi gì ngoài
 * Supabase của dự án, và chỉ chạy khi đã đăng nhập thật (bản Chơi thử không gửi gì).
 *   - ?ref=… (hoặc utm_source/utm_medium) được nhớ lúc vào trang, gửi một lần sau khi đăng nhập (set_attribution).
 *   - Khi tab đang hiện, cứ 60 giây gọi ping_session một lần (máy chủ tự gộp thành phiên, nghỉ quá 5 phút là phiên mới).
 * Luật ở máy chủ: supabase/migrations/20261213000000_stats_foundation.sql (test: supabase/tests/stats.test.ts).
 */
import { isDemo, markMilestone, pingSession, setAttribution } from '../data/api';

const REF = 'hatchday-ref';
const PING_MS = 60_000;

/** Gọi sớm ở lần tải trang (trước khi đăng nhập) để không mất tham số nguồn. */
export function captureReferral(): void {
  try {
    const q = new URLSearchParams(location.search);
    const ref = q.get('ref') || q.get('utm_source'), medium = q.get('utm_medium');
    if (ref && !localStorage.getItem(REF)) localStorage.setItem(REF, JSON.stringify({ ref, medium }));
  } catch { /* bỏ qua */ }
}

export const detectPlatform = (): 'mobile' | 'desktop' => {
  try { return matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'; } catch { return 'desktop'; }
};
export const isStandalone = (): boolean => {
  try { return matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true; } catch { return false; }
};

let started = false;
/** Bắt đầu gửi nhịp phiên (gọi một lần sau khi vào game). */
export function startTelemetry(): void {
  if (started || isDemo) return; started = true;
  try {
    const raw = localStorage.getItem(REF);
    if (raw) { const o = JSON.parse(raw) as { ref: string; medium: string | null }; setAttribution(o.ref, o.medium).catch(() => {}).finally(() => { try { localStorage.removeItem(REF); } catch { /* bỏ qua */ } }); }
  } catch { /* bỏ qua */ }
  const ping = () => { if (document.visibilityState === 'visible') pingSession(detectPlatform(), isStandalone()).catch(() => {}); };
  ping(); setInterval(ping, PING_MS);
  document.addEventListener('visibilitychange', ping);
}

/** Mốc hành trình (không chặn game nếu lỗi). */
export const milestone = (key: 'tour_done' | 'tour_skipped' | 'pwa_installed' | 'push_on'): void => { if (!isDemo) markMilestone(key).catch(() => {}); };
