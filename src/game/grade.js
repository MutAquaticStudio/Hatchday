// Chỉnh màu cho thế giới 3D (nhà, vườn, các địa điểm): chuyển bảng màu kẹo pastel sang tông tối, lạnh, giàu không khí
// (xanh lam-ngọc, than, gỗ tối, đá) trong khi vẫn giữ tương quan sáng tối giữa sàn/tường/đồ vật để dễ đọc.
// Mọi nơi dựng cảnh đều đi qua `toon()` / `add()` / `canvasTex()` của game.js nên chỉ cần chỉnh ở đây.
// KHÔNG dùng cho thú (thú dùng toonRaw) và hạt/biểu cảm (FXT) để chúng vẫn sáng và nổi bật.

const cache = new Map();
const ok = c => typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hexToHsl(hex) {
  const n = parseInt(hex.length === 4 ? hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex.slice(1), 16) || 0;
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
}
/** Điểm gãy (hue vào -> hue ra): hồng/tím hồng -> chàm/lam, xanh lá -> lục ngọc, cam/da -> gỗ tối, vàng giữ lại làm ánh đèn. */
const HUE = [[0, 8], [14, 14], [38, 28], [58, 40], [75, 70], [100, 150], [150, 162], [185, 190], [235, 222], [275, 246], [300, 222], [350, 212], [358, 6], [360, 8]];
function mapHue(h) {
  for (let i = 1; i < HUE.length; i++) if (h <= HUE[i][0]) { const [a, A] = HUE[i - 1], [b, B] = HUE[i]; return A + (B - A) * (h - a) / (b - a); }
  return h;
}

/** Màu bề mặt (vật liệu, họa tiết): tối đi, bớt kẹo, ngả lạnh. */
export function grade(c) {
  if (!ok(c)) return c;
  let r = cache.get(c); if (r) return r;
  let [h, s, l] = hexToHsl(c);
  const k0 = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16), ch = (Math.max(k0 >> 16 & 255, k0 >> 8 & 255, k0 & 255) - Math.min(k0 >> 16 & 255, k0 >> 8 & 255, k0 & 255)) / 255;
  s = Math.min(s, ch * 2.6); // màu rất sáng có độ bão hoà HSL cao giả: dùng độ chói màu thực
  const neutral = s < 0.2;
  if (neutral) h = 208; else h = mapHue(h);
  // đường cong sáng: trắng/kem -> xám đá xanh; màu đậm giảm nhẹ để vẫn nổi
  l = 0.04 + 0.45 * Math.pow(l, 1.7);
  s = neutral ? 0.07 + s * 0.4 : clamp(s * 0.5 + 0.03, 0.06, 0.5);
  if (h > 15 && h < 50) s *= 0.7; // gỗ/da bớt cam
  else if (h > 190 && h < 270) s *= 0.8; // xanh lam bớt chói
  r = hslToHex(h, s, l); cache.set(c, r); return r;
}
/** Nét viền: gần đen ngả xanh đêm theo màu gốc (mực), không còn viền hồng nâu. */
export function gradeInk(c) {
  if (!ok(c)) return c;
  const k = 'i' + c; let r = cache.get(k); if (r) return r;
  const [h, s, l] = hexToHsl(c);
  r = hslToHex(s < 0.2 ? 222 : mapHue(h), clamp(s * 0.4, 0.12, 0.4), clamp(l * 0.18, 0.035, 0.1)); cache.set(k, r); return r;
}
/** Ánh sáng/phát sáng: không tối đi, chỉ bớt hồng kẹo (đèn lồng, ô cửa, hạt). */
export function glow(c) {
  if (!ok(c)) return c;
  const k = 'g' + c; let r = cache.get(k); if (r) return r;
  const [h, s, l] = hexToHsl(c);
  r = hslToHex(mapHue(h), clamp(s, 0.3, 1), clamp(l, 0.5, 0.72)); cache.set(k, r); return r;
}

/** Màu trong họa tiết canvas: đổi tông như grade() nhưng chuẩn hoá để trắng vẫn là trắng (họa tiết còn được nhân với màu vật liệu đã tối, tránh tối hai lần). */
const WL = hexToHsl(grade('#ffffff'))[2];
export function gradeTex(c) {
  if (!ok(c)) return c;
  const k = 't' + c; let r = cache.get(k); if (r) return r;
  const [h, s, l] = hexToHsl(grade(c)); r = hslToHex(h, s, clamp(l / WL, 0, 1)); cache.set(k, r); return r;
}
/** Bọc ngữ cảnh canvas 2D để mọi fillStyle/strokeStyle/addColorStop (chuỗi hex) đi qua gradeTex(); rgba() giữ nguyên. */
export function gradeCtx(g) {
  const conv = v => (ok(v) ? gradeTex(v) : typeof v === 'string' && /^#[0-9a-f]{8}$/i.test(v) ? gradeTex(v.slice(0, 7)) + v.slice(7) : v);
  const wrapGrad = gr => { const o = gr.addColorStop.bind(gr); gr.addColorStop = (t, c) => o(t, conv(c)); return gr; };
  return new Proxy(g, {
    get(t, k) {
      const v = t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => wrapGrad(t[k](...a));
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) { t[k] = (k === 'fillStyle' || k === 'strokeStyle' || k === 'shadowColor') ? conv(v) : v; return true; },
  });
}
