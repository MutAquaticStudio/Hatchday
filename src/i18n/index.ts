/**
 * Đa ngôn ngữ (Việt + Anh). Câu tiếng Việt chính là khoá; bản tiếng Anh nằm trong en.json.
 *   t('Chỉ số')                      → "Stats"
 *   t`Còn ${n} ngày nữa lên ${name}`  → khoá "Còn {0} ngày nữa lên {1}", bản dịch có thể đổi thứ tự {1} … {0}
 * Số nhiều trong bản dịch: "{0} {0|day|days}" chọn dạng theo giá trị {0} (1 → day, còn lại → days).
 * Thiếu bản dịch thì giữ tiếng Việt (test i18n.test.ts bảo đảm không thiếu khoá nào khi phát hành).
 * Ngôn ngữ: ?lang=vi|en (thử), rồi localStorage 'hatchday-lang' (chọn trong Cài đặt); chưa chọn thì bản web là tiếng Việt,
 * bản Steam theo ngôn ngữ hệ điều hành (vi → Việt, còn lại → Anh).
 */
import EN from './en.json';

export type Lang = 'vi' | 'en';
const dict: Record<string, string> = EN as Record<string, string>;

const isSteamBuild = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env || {}).VITE_PLATFORM === 'steam';
function detect(): Lang {
  try { const q = new URLSearchParams(location.search).get('lang'); if (q === 'vi' || q === 'en') return q; } catch { /* bỏ qua */ }
  try { const s = localStorage.getItem('hatchday-lang'); if (s === 'vi' || s === 'en') return s; } catch { /* bỏ qua */ }
  // bản web hướng tới người Việt: mặc định tiếng Việt; bản Steam theo ngôn ngữ hệ điều hành (vi → Việt, còn lại → Anh)
  if (!isSteamBuild) return 'vi';
  try { const n = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase(); return n.startsWith('vi') ? 'vi' : 'en'; } catch { return 'en'; }
}
export const LANG: Lang = typeof window === 'undefined' ? 'vi' : detect();
export const LOCALE = LANG === 'vi' ? 'vi-VN' : 'en-US';
export const isEn = LANG === 'en';

/** Đổi ngôn ngữ: lưu lại rồi tải lại trang (mọi chữ được dựng lại theo ngôn ngữ mới). */
export function setLang(l: Lang): void { try { localStorage.setItem('hatchday-lang', l); } catch { /* bỏ qua */ } location.reload(); }

const fill = (tpl: string, vals: unknown[]): string => tpl
  .replace(/\{(\d+)\|([^|{}]*)\|([^|{}]*)\}/g, (_m, i, one, many) => (Number(vals[+i]) === 1 ? one : many))
  .replace(/\{(\d+)\}/g, (_m, i) => String(vals[+i] ?? ''));

/** Dịch một câu (hoặc một khuôn có tham số khi dùng như tagged template). */
export function t(s: string | TemplateStringsArray, ...vals: unknown[]): string {
  if (typeof s === 'string') return LANG === 'vi' ? s : (dict[s] ?? s);
  const key = s.reduce((acc, part, i) => acc + (i ? `{${i - 1}}` : '') + part, '');
  if (LANG === 'vi') return fill(key, vals);
  return fill(dict[key] ?? key, vals);
}

/** Khoá của một tagged template (dùng cho công cụ trích xuất và test). */
export const templateKey = (parts: readonly string[]): string => parts.reduce((acc, part, i) => acc + (i ? `{${i - 1}}` : '') + part, '');

/** Dịch HTML tĩnh (markup.html, trang công khai): nút văn bản và các thuộc tính hiển thị. */
export function translateDom(root: ParentNode): void {
  if (LANG === 'vi') return;
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  for (const n of nodes) { const raw = n.nodeValue || '', k = raw.trim(); if (k && dict[k]) n.nodeValue = raw.replace(k, dict[k]); }
  (root as Element).querySelectorAll?.('[aria-label],[title],[placeholder]').forEach(el => {
    for (const a of ['aria-label', 'title', 'placeholder']) { const v = el.getAttribute(a); if (v && dict[v]) el.setAttribute(a, dict[v]); }
  });
}

/** Tên dùng trong mã game (tránh trùng các biến cục bộ tên `t` như thời gian khung hình). */
export const _t = t;
