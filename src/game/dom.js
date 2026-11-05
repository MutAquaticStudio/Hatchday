// Tiện ích DOM dùng chung cho các module giao diện.
export const $ = id => document.getElementById(id);
export const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
export const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
