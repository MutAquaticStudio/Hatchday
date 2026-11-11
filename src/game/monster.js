// Quái thú cel shading: thân nặn bằng trường khoảng cách (SDF) hoà trộn mượt rồi dựng lưới bằng surface nets,
// lông là các lọn cong đặt có chủ đích, viền mực bằng vỏ ngược đẩy theo pháp tuyến, mắt dùng chính khuôn mặt 2D của game
// (face.js) dán thành hai miếng ôm theo đầu nên mọi biểu cảm vẫn chạy.
// Quy ước thiết kế: +x là phía trước, +y lên, ±z hai bên; khi dựng xong đổi sang hệ của game (mặt nhìn về +z) và thu nhỏ S lần.
// Bốn khung dáng: bốn chân, đứng hai chân, chim, rắn/cá bay lượn; cả 50 loài khai trong DEF. Bộ dựng cũ trong pet3d.js chỉ còn là dự phòng.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPECIES_BY_ID, SPECIES, STAGES } from './species';

const S = 0.56, XOFF = 0.45;
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const cap = (x, y, z, ax, ay, az, bx, by, bz, ra, rb) => { const dx = bx - ax, dy = by - ay, dz = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz + 1e-9))); return Math.hypot(x - ax - dx * t, y - ay - dy * t, z - az - dz * t) - (ra + (rb - ra) * t); };
const ell = (x, y, z, cx, cy, cz, rx, ry, rz) => { const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz, k0 = Math.hypot(px, py, pz), k1 = Math.hypot(px / rx, py / ry, pz / rz); return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); };
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

/** Lưới từ SDF bằng surface nets (không cần bảng tra như marching cubes). Trả về { pos, idx }. */
function surfaceNets(f, min, max, h) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1, ny = Math.ceil((max[1] - min[1]) / h) + 1, nz = Math.ceil((max[2] - min[2]) / h) + 1, V = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) V[i + nx * (j + ny * k)] = f(min[0] + i * h, min[1] + j * h, min[2] + k * h);
  const id = new Int32Array(nx * ny * nz).fill(-1), pos = [], idx = [], C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let m = 0; for (let c = 0; c < 8; c++) { v[c] = V[i + C[c][0] + nx * (j + C[c][1] + ny * (k + C[c][2]))]; if (v[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) { if ((v[a] < 0) === (v[b] < 0)) continue; const t = v[a] / (v[a] - v[b]); sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++; }
    id[i + nx * (j + ny * k)] = pos.length / 3; pos.push(min[0] + (i + sx / n) * h, min[1] + (j + sy / n) * h, min[2] + (k + sz / n) * h);
  }
  const q = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d); };
  const I = (i, j, k) => id[i + nx * (j + ny * k)];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = V[i + nx * (j + ny * k)] < 0;
    if (s0 !== (V[i + 1 + nx * (j + ny * k)] < 0)) q(I(i, j - 1, k - 1), I(i, j, k - 1), I(i, j, k), I(i, j - 1, k), !s0);
    if (s0 !== (V[i + nx * (j + 1 + ny * k)] < 0)) q(I(i - 1, j, k - 1), I(i - 1, j, k), I(i, j, k), I(i, j, k - 1), !s0);
    if (s0 !== (V[i + nx * (j + ny * (k + 1))] < 0)) q(I(i - 1, j - 1, k), I(i, j - 1, k), I(i, j, k), I(i - 1, j, k), !s0);
  }
  return { pos, idx };
}

/**
 * Tham số của từng loài: pose là khung dáng ('quad' bốn chân, 'bi' đứng hai chân, 'bird' chim, 'serp' rắn/cá bay lượn),
 * còn lại là nét riêng (tai, sừng, đuôi, cánh, mai, gai lưng…). Những gì không ghi thì lấy mặc định trong beast().
 */
const DEF = {
  // Đồng Nội
  'mam-xanh': { pose: 'bi', ears: 'point', earK: 0.6, tail: 'whip', ruff: 0.3 },
  'bong-lua': { bulk: 1.22, ml: 0.8, leg: 0.82, ears: 'round', tail: 'whip', spikes: true, ruff: 0.4 },
  'ong-mat': { pose: 'bi', bulk: 0.9, ears: 'none', horns: 'feeler', tail: 'stub', wings: 'bug', ruff: 0.5 },
  'co-may': { pose: 'bi', bulk: 0.85, ears: 'point', earK: 1.3, tail: 'whip', ruff: 0.4 },
  'hoa-mai': { bulk: 0.92, ml: 0.72, ears: 'point', tail: 'whip', ruff: 0.3 },
  'chuon-chuon': { pose: 'serp', ears: 'none', horns: 'feeler', wings: 'bug', ruff: 0.2 },
  'de-co': { bulk: 0.9, ml: 0.7, leg: 1.1, ears: 'none', horns: 'feeler', tail: 'stub', spikes: true, ruff: 0 },
  'sen-hong': { pose: 'bi', ears: 'none', horns: 'crescent', tail: 'plume', ruff: 1 },
  'nai-co': { bulk: 0.9, leg: 1.28, neck: 1.35, ml: 0.95, ears: 'point', earK: 0.6, horns: 'antler', tail: 'stub', ruff: 0.5 },
  'lan-vang': { bulk: 1.12, ml: 0.85, ears: 'round', horns: 'curve', tails: 1, ruff: 1, spikes: true },
  // Sông Nước
  'ca-bong': { pose: 'serp', ears: 'none', ruff: 0 },
  'oc-gao': { bulk: 1.1, leg: 0.55, len: 0.85, ml: 0.6, ears: 'none', horns: 'feeler', tail: 'stub', shell: true, ruff: 0 },
  'giot-mua': { pose: 'bi', bulk: 0.9, ears: 'none', horns: 'crescent', tail: 'stub', ruff: 0.3 },
  'tom-tit': { pose: 'serp', ears: 'none', horns: 'feeler', spikes: true, ruff: 0 },
  'rua-dam': { bulk: 1.15, leg: 0.6, len: 0.9, neck: 0.9, ml: 0.6, ears: 'none', tail: 'stub', shell: true, ruff: 0 },
  'sua-bien': { pose: 'serp', ears: 'none', ruff: 0.8, bulk: 1.1 },
  'rai-ca': { bulk: 0.95, len: 1.2, leg: 0.72, ml: 0.75, ears: 'round', tail: 'whip', tailFat: 1.7, ruff: 0.3 },
  'ca-heo-hong': { pose: 'serp', ears: 'none', bulk: 1.18, ruff: 0, wings: 'bat' },
  'ngoc-trai': { pose: 'bi', ears: 'none', horns: 'crescent', tail: 'plume', ruff: 0.8 },
  'long-thuy': { pose: 'serp', ears: 'none', horns: 'antler', spikes: true, ruff: 1, len: 1.2 },
  // Mây Trời
  'bong-may': { bulk: 1.25, leg: 0.8, ml: 0.7, ears: 'round', horns: 'curve', tail: 'stub', ruff: 1 },
  'se-nau': { pose: 'bird', bulk: 0.95 },
  'dieu-giay': { pose: 'serp', ears: 'none', wings: 'feather', ruff: 0.3 },
  'gio-nhe': { pose: 'bi', bulk: 0.85, ears: 'point', earK: 1.4, tail: 'plume', ruff: 0.6 },
  'cau-vong': { ears: 'point', tails: 1, ruff: 0.7, ml: 0.8 },
  'hai-au': { pose: 'bird', neck: 1.15 },
  'sao-bang': { bulk: 0.9, ears: 'point', tails: 1, ruff: 0.8, horns: 'crescent' },
  'may-ngu-sac': { bulk: 1.1, ears: 'round', tails: 2, ruff: 1, wings: 'feather' },
  'hac-trang': { pose: 'bird', leg: 1.5, neck: 1.6, bulk: 0.9 },
  'chim-lac': { pose: 'bird', leg: 1.15, neck: 1.2, ruff: 1, horns: 'crescent' },
  // Rừng Đêm
  'nam-ngu': { pose: 'bi', bulk: 1.15, ears: 'none', tail: 'stub', ruff: 0.8 },
  'dom-dom': { pose: 'bi', bulk: 0.88, ears: 'none', horns: 'feeler', tail: 'stub', wings: 'bug', ruff: 0.3 },
  'cu-meo': { pose: 'bird', bulk: 1.2, ears: 'point', earK: 0.7, ruff: 0.9 },
  'doi-nho': { pose: 'bird', beak: false, wings: 'bat', ears: 'point', earK: 1.25, ruff: 0.6 },
  'trang-khuyet': { bulk: 0.95, ml: 0.75, ears: 'point', horns: 'crescent', tails: 1, ruff: 0.6 },
  'cao-bac': { tails: 3, ruff: 1, ears: 'point' },
  'meo-muop': { bulk: 1.18, ml: 0.68, ears: 'point', earK: 0.62, tail: 'whip', tailFat: 1.3, ruff: 0.7 },
  'ma-troi': { pose: 'serp', ears: 'none', horns: 'crescent', ruff: 0.6 },
  'huou-sao': { bulk: 0.9, leg: 1.25, neck: 1.3, ml: 0.95, ears: 'point', earK: 0.6, horns: 'antler', tail: 'stub', ruff: 0.5 },
  'tho-ngoc': { pose: 'bi', ears: 'point', earK: 1.9, tail: 'stub', ruff: 1, horns: 'crescent' },
  // Góc Bếp (lửa)
  'banh-bo': { bulk: 1.25, leg: 0.75, ml: 0.65, ears: 'round', tail: 'stub', ruff: 0.5 },
  'xoi-gac': { pose: 'bi', ears: 'round', tail: 'whip', spikes: true, ruff: 0.4 },
  'che-ba-mau': { pose: 'bi', bulk: 0.85, ears: 'point', tail: 'plume', ruff: 0.5 },
  'banh-troi': { pose: 'bi', bulk: 1.2, ears: 'round', tail: 'stub', ruff: 0.5 },
  'banh-flan': { bulk: 1.1, ml: 0.7, ears: 'point', earK: 0.6, tail: 'whip', tailFat: 1.4, ruff: 0.8 },
  'tra-sua': { pose: 'bi', ears: 'point', tail: 'whip', ruff: 0.5 },
  'banh-bao': { bulk: 1.3, leg: 0.7, ml: 0.6, ears: 'round', tail: 'stub', ruff: 0.8 },
  'banh-trung-thu': { bulk: 1.15, leg: 0.6, ml: 0.6, ears: 'none', horns: 'crescent', tail: 'stub', shell: true, ruff: 0 },
  'keo-bong-gon': { bulk: 1.15, ears: 'point', earK: 1.4, tails: 2, ruff: 1 },
  'lua-bep': { pose: 'bi', bulk: 1.15, ears: 'none', horns: 'curve', tail: 'whip', tailFat: 1.6, spikes: true, wings: 'bat', ruff: 0.5 },
};
export const hasMonster = sp => !!DEF[sp.id];

export function makeMonsterBuilder(K) {
  const { THREE } = K;
  const UPv = new THREE.Vector3(0, 1, 0), FWv = new THREE.Vector3(0, 0, 1);
  const M = new THREE.Matrix4().set(0, 0, -S, 0, 0, S, 0, 0, S, 0, 0, -XOFF * S, 0, 0, 0, 1);   // hệ thiết kế → hệ game
  const toG = p => new THREE.Vector3(-(p[2] || 0) * S, p[1] * S, (p[0] - XOFF) * S);
  const bake = (geo, pivot) => { geo.applyMatrix4(M); if (pivot) geo.translate(-pivot.x, -pivot.y, -pivot.z); return geo; };

  /** Dựng lưới có pháp tuyến (gradient của SDF), màu đỉnh và độ phát sáng từ hàm tô `paint(x, y, z, n, c)` (trả về độ phát sáng). */
  function sculpt(sdf, min, max, cell, paint) {
    const sn = surfaceNets(sdf, min, max, cell), P = sn.pos, n = P.length / 3, nor = new Float32Array(n * 3), col = new Float32Array(n * 3), glow = new Float32Array(n), c = new THREE.Color(), N = [0, 0, 0], e = cell * 0.4;
    for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      let gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e); const l = Math.hypot(gx, gy, gz) || 1; N[0] = gx / l; N[1] = gy / l; N[2] = gz / l; nor.set(N, i * 3);
      glow[i] = paint(x, y, z, N, c) || 0; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1)); g.setIndex(sn.idx); return g;
  }
  /** Ống quét theo đường cong (lọn lông, sừng, râu): bán kính theo `radii`, màu chuyển từ c0 sang c1 về phía ngọn. */
  function sweep(pts, radii, o = {}) {
    const radial = o.radial || 7, sub = o.sub || 4, curve = new THREE.CatmullRomCurve3(pts.map(p => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2] || 0)))), N = (pts.length - 1) * sub, pos = [], nor = [], idx = [], col = [], gl = [];
    const t = new THREE.Vector3(), side = new THREE.Vector3(), up2 = new THREE.Vector3(), p = new THREE.Vector3(), d = new THREE.Vector3(), c0 = new THREE.Color(o.c0 || '#fff'), c1 = new THREE.Color(o.c1 || o.c0 || '#fff'), c = new THREE.Color();
    for (let i = 0; i <= N; i++) { const u = i / N; curve.getPoint(u, p); curve.getTangent(u, t); const f = u * (pts.length - 1), i0 = Math.min(pts.length - 2, Math.floor(f)), k = f - i0, r = radii[i0] + (radii[i0 + 1] - radii[i0]) * k;
      side.crossVectors(Math.abs(t.y) > 0.92 ? FWv : UPv, t).normalize(); up2.crossVectors(t, side).normalize(); c.copy(c0).lerp(c1, sst(o.cs ?? 0.3, o.ce ?? 0.8, u));
      for (let j = 0; j <= radial; j++) { const a = j / radial * Math.PI * 2; d.copy(side).multiplyScalar(Math.cos(a)).addScaledVector(up2, Math.sin(a) * (o.flat || 1)); pos.push(p.x + d.x * r, p.y + d.y * r, p.z + d.z * r); d.normalize(); nor.push(d.x, d.y, d.z); col.push(c.r, c.g, c.b); gl.push((o.glow || 0) * sst(0.35, 0.9, u)); } }
    const W = radial + 1; for (let i = 0; i < N; i++) for (let j = 0; j < radial; j++) { const a = i * W + j, b = a + 1, e = a + W, g = e + 1; idx.push(a, b, e, b, g, e); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(gl, 1)); g.setIndex(idx); return g;
  }
  /** Điểm trên bề mặt (sdf = 0) theo tia từ điểm trong thân c theo hướng d. */
  const surf = (sdf, c, d) => { const dv = new THREE.Vector3(d[0], d[1], d[2] || 0).normalize(); let a = 0, b = 2.4; for (let i = 0; i < 22; i++) { const m = (a + b) / 2; if (sdf(c[0] + dv.x * m, c[1] + dv.y * m, c[2] + dv.z * m) < 0) a = m; else b = m; } return new THREE.Vector3(c[0] + dv.x * a, c[1] + dv.y * a, c[2] + dv.z * a); };
  const tuftGeo = (base, dir, len, w, curl, o = {}) => { const d = new THREE.Vector3(dir[0], dir[1], dir[2] || 0).normalize(), cv = new THREE.Vector3(curl[0], curl[1], curl[2] || 0);
    return sweep([base.clone().addScaledVector(d, -0.07), base.clone().addScaledVector(d, len * 0.34).addScaledVector(cv, len * 0.04), base.clone().addScaledVector(d, len * 0.74).addScaledVector(cv, len * 0.3), base.clone().addScaledVector(d, len).addScaledVector(cv, len * 0.8)], [w * 0.7, w, w * 0.6, 0.004], { flat: o.flat || 0.62, ...o }); };

  /* ---------- màu của loài: lông sáng, áo choàng đậm, tất sẫm, hoa văn phát sáng theo nguyên tố của miền ---------- */
  function palette(sp, stage) {
    const hs = { h: 0, s: 0, l: 0 }, mk = (hex, f) => { const c = new THREE.Color(hex); c.getHSL(hs); f(hs); c.setHSL(hs.h, hs.s, hs.l); return c; };
    const el = (K.ELEMENT[sp.region] || K.ELEMENT[0]).glow, old = stage === 'elder' ? 0.75 : 1;
    return {
      fur: mk(sp.pal.body, h => { h.l = Math.min(0.96, h.l * 1.04); h.s = Math.min(1, h.s * 1.1 * old); }),
      mantle: mk(sp.pal.deep, h => { h.s = Math.max(0.45, h.s) * old; h.l = Math.min(0.56, h.l * 0.64); }),
      sock: mk(sp.pal.deep, h => { h.s = Math.max(0.42, h.s); h.l = 0.24; }),
      tip: mk(el, h => { h.l = 0.62; }), glow: mk(el, h => { h.l = 0.8; }), hot: mk(el, h => { h.l = 0.93; }),
      inner: mk(sp.pal.inner, h => { h.l = Math.min(0.66, h.l); }), bone: new THREE.Color('#efe6d2'), nose: new THREE.Color('#0c0c16'), ink: mk(sp.pal.ink, h => { h.l = Math.min(0.2, h.l); h.s = Math.max(0.3, h.s); }),
      accent: mk(sp.pal.accent, h => { h.s = Math.max(0.5, h.s); h.l = Math.min(0.6, h.l); }),
    };
  }

  /* ---------- khung bốn chân ---------- */
  const geoCache = new Map();
  function beast(sp, stage, form, cell) {
    const key = [sp.id, stage, form || '', cell].join('|'); let R = geoCache.get(key); if (R) return R;
    const lvl = { baby: 0, child: 1, teen: 2, adult: 3, elder: 3 }[stage], g = [0, 0.4, 0.75, 1][lvl], rk = { thuong: 0, hiem: 1, quy: 2, huyen: 3 }[sp.rarity] || 0;
    const o = { bulk: 1, len: 1, leg: 1, neck: 1, ml: 1, ruff: 0.6, ears: 'point', earK: 1, horns: 'none', tail: 'plume', tailFat: 1, ...DEF[sp.id] };
    const pose = o.pose || 'quad', bird = pose === 'bird', bi = pose === 'bi' || bird, serp = pose === 'serp'; if (bird) { o.tail = 'fan'; if (!DEF[sp.id].ears) o.ears = 'none'; if (o.beak !== false) o.beak = true; if (!o.wings) o.wings = 'feather'; } if (serp) { o.tail = 'whip'; if (!o.wings) o.wings = 'fin'; if (o.spikes === undefined) o.spikes = true; }
    const fat = o.bulk * (form === 'tron' ? 1.14 : 1), ll = (0.55 + 0.45 * g) * o.leg * (form === 'nhanh' ? 1.12 : 1), bl = (0.78 + 0.22 * g) * o.len, hs = (1.36 - 0.36 * g) * (bi && !bird ? 1.1 : 1), ml = (0.5 + 0.5 * g) * o.ml, ruff = o.ruff * (0.25 + 0.75 * g), tk = 0.42 + 0.58 * g;
    const legLen = 1.0 * ll, nk = (0.55 + 0.45 * g) * o.neck, STEP = bi || serp ? 0 : 0.14 * (0.5 + 0.5 * g);
    // bộ xương theo khung dáng: hông, giữa thân, ngực (toạ độ x, y), bán kính ba khúc, các khối cơ [cx, cy, cz, rx, ry, rz, độ hoà], gốc cổ
    let hipX, hipY, shX, chY, midP, rr, EL, nb, nt, tb, hover = 0;
    if (bi) { hipX = -0.14; hipY = legLen * 0.72 + 0.42 * fat; shX = 0.2; chY = hipY + 0.74 * bl; midP = [0.02, (hipY + chY) / 2]; rr = bird ? [0.4 * fat, 0.42 * fat, 0.4 * fat] : [0.44 * fat, 0.4 * fat, 0.47 * fat];
      EL = [[hipX + 0.16, hipY + 0.18, 0, 0.4 * fat, 0.46 * fat, 0.38 * fat, 0.18], [shX, chY + 0.06, bird ? 0.3 : 0.36, bird ? 0.24 : 0.3, 0.3, bird ? 0.2 : 0.24, 0.14], [hipX, hipY - 0.06, 0.26, 0.34, 0.38, 0.26, 0.14]];
      nb = [shX + 0.1, chY + 0.38]; nt = [nb[0] + 0.12 * nk, nb[1] + 0.34 * nk]; tb = [hipX - 0.3, hipY - 0.02, 0]; }
    else if (serp) { hover = 0.3; hipX = -1.3 * bl; hipY = 0.82; shX = 0.45 * bl; chY = 1.02; midP = [(hipX + shX) / 2, 0.6]; rr = [0.27 * fat, 0.31 * fat, 0.35 * fat];
      EL = [[shX, chY - 0.05, 0, 0.36 * fat, 0.36 * fat, 0.3 * fat, 0.15]]; nb = [shX + 0.32, chY + 0.4]; nt = [nb[0] + 0.2 * nk, nb[1] + 0.42 * nk]; tb = [hipX - 0.15, hipY, 0]; }
    else { hipX = -0.95 * bl; hipY = legLen + 0.5 * fat; shX = 0.55 * bl; chY = hipY + 0.03; midP = [(hipX + shX) / 2, hipY]; rr = [0.36 * fat, 0.32 * fat, 0.45 * fat];
      EL = [[shX + 0.05, hipY - 0.16, 0, 0.44 * fat, 0.52 * fat, 0.35 * fat, 0.18], [shX, hipY, 0.29, 0.3, 0.42, 0.2, 0.14], [hipX, hipY - 0.1, 0.29, 0.42, 0.5, 0.24, 0.16]];
      nb = [shX + 0.4, hipY + 0.35]; nt = [nb[0] + 0.3 * nk, nb[1] + 0.45 * nk]; tb = [hipX - 0.25, hipY + 0.12, 0]; }
    const sy = chY, hc = [nt[0] + (bi ? 0.2 : 0.25) * hs, nt[1] + 0.2 * hs], backDot = n => (bi ? -n[0] * 0.85 + n[1] * 0.3 : n[1]), hp = (dx, dy, dz = 0) => [hc[0] + dx * hs, hc[1] + dy * hs, dz * hs];
    const mzA = hp(0.12, -0.05), mzB = hp(0.12 + 0.74 * ml * (o.beak ? 0.8 : 1), -0.23), noseP = hp(0.15 + 0.76 * ml, -0.205), bx0 = nb[0] - 0.05;
    const bend = x => (x > bx0 ? 0.09 * (x - bx0) * (x - bx0) : 0), Wp = p => [p[0], p[1], (p[2] || 0) + bend(p[0])];
    const pal = palette(sp, stage);
    const torso = (x, y, zw) => {
      const z = Math.hypot(zw - bend(x), 0.075) - 0.075 * 0.6; let d = cap(x, y, z, hipX, hipY, 0, midP[0], midP[1], 0, rr[0], rr[1]);
      d = smin(d, cap(x, y, z, midP[0], midP[1], 0, shX, chY, 0, rr[1], rr[2]), 0.15); d = smin(d, cap(x, y, z, shX, chY, 0, nb[0], nb[1], 0, rr[2], 0.3), 0.15); d = smin(d, cap(x, y, z, nb[0], nb[1], 0, nt[0], nt[1], 0, 0.3, 0.235), 0.14);
      for (const e of EL) d = smin(d, ell(x, y, z, e[0], e[1], e[2], e[3], e[4], e[5]), e[6]);
      if (!serp) d = smin(d, cap(x, y, z, nt[0] + 0.06, nt[1] - 0.14, 0, bi ? hipX + 0.3 : shX + 0.3, bi ? hipY + 0.12 : chY - 0.22, 0, bi ? 0.2 : 0.25, (bi ? 0.3 : 0.33) * fat), 0.14);   // lấp rãnh giữa ngực (giữa hai khối cơ vai) để mặt trước không bị một dải bóng tối
      if (ruff > 0.05) d = smin(d, ell(x, y, z, nb[0] + 0.05, nb[1] + 0.1, 0, 0.22 + 0.08 * ruff, 0.27 + 0.1 * ruff, 0.22 + 0.08 * ruff), 0.16);
      if (o.shell && lvl >= 1) d = smin(d, ell(x, y, z, midP[0], midP[1] + 0.22, 0, 0.78 * bl, 0.46, 0.56), 0.06);
      d = smin(d, ell(x, y, z, hc[0], hc[1], 0, 0.33 * hs, 0.28 * hs, 0.29 * hs), 0.12);
      d = smin(d, ell(x, y, z, hc[0] - 0.1 * hs, hc[1] - 0.14 * hs, 0.24 * hs, 0.2 * hs, 0.18 * hs, 0.12 * hs), 0.08);
      if (o.beak) return smin(d, cap(x, y, z, mzA[0], mzA[1] + 0.02, 0, mzB[0], mzB[1] + 0.03, 0, 0.165 * hs, 0.02), 0.05);
      d = smin(d, cap(x, y, z, mzA[0], mzA[1], 0, mzB[0], mzB[1], 0, 0.18 * hs, 0.07 * hs), 0.1);
      d = smin(d, cap(x, y, z, hc[0], hc[1] - 0.2 * hs, 0.05 * hs, mzB[0] - 0.09 * hs, mzB[1] - 0.08 * hs, 0.02, 0.1 * hs, 0.045 * hs), 0.05);
      return smin(d, Math.hypot(x - noseP[0], y - noseP[1], z) - 0.05 * hs, 0.03);
    };
    const BEAK = new THREE.Color('#ffb23e'), FURH = '#' + pal.fur.getHexString(), FUR2H = '#' + pal.fur.clone().lerp(pal.mantle, 0.28).getHexString();
    /* móng (gộp vào lưới chân/tay để cùng chuyển động) và lọn lông khuỷu */
    const claws = (e, dx = 1) => (lvl < 1 ? [] : [-1, 0, 1].map(t => sweep([[e[0] + 0.05 * dx, e[1] - 0.01, e[2] + t * 0.055], [e[0] + 0.16 * dx, e[1], e[2] + t * 0.07], [e[0] + 0.23 * dx, e[1] - 0.07, e[2] + t * 0.075]], [0.032, 0.024, 0.003], { c0: '#efe6d2', c1: '#efe6d2', radial: 5, sub: 3 })));
    const elbow = P => (lvl < 2 || bird ? [] : [tuftGeo(new THREE.Vector3(P[1][0] - 0.08, P[1][1] + 0.06, P[1][2]), [-0.75, -0.65, 0], 0.27, 0.075, [0, -0.4, 0], { c0: FURH, c1: FUR2H })]);
    const patt = sp.pattern, mid = midP[0], runeC = bi ? [[shX, chY, 0.15], [hipX, hipY - 0.05, 0.18]] : [[shX - 0.05, chY + 0.05, 0.17], [hipX - 0.03, hipY, 0.2]];
    const ring = (x, y, cx, cy, r) => { const dd = Math.hypot(x - cx, y - cy), ang = Math.atan2(y - cy, x - cx); return Math.max(sst(0.035, 0.02, Math.abs(dd - r)) * (Math.abs(ang - 0.6) > 0.7 ? 1 : 0), sst(0.06, 0.045, dd)); };
    const paintTorso = (x, y, zw, n, c) => {
      const az = Math.abs(zw - bend(x)), head = x > hc[0] - 0.36 * hs && y > hc[1] - 0.4 * hs, nose = !o.beak && Math.hypot(x - noseP[0], y - noseP[1], az) < 0.068 * hs, beak = o.beak && head && x > mzA[0] + 0.17 * hs ? 1 : 0;
      const shell = o.shell && lvl >= 1 ? sst(0.02, 0.0, ell(x, y, az, mid, midP[1] + 0.22, 0, 0.78 * bl, 0.46, 0.56)) : 0;
      let mantle = head ? sst(0.075 * hs, 0.06 * hs, az) * sst(hc[1] + 0.1 * hs, hc[1] + 0.14 * hs, y) * sst(hc[0] + 0.08 * hs, hc[0] + 0.02 * hs, x) : sst(0.3, 0.34, backDot(n) + 0.1 * Math.sin((bi ? y : x) * 8.5)) * (bi || serp || y > hipY - 0.3 ? 1 : 0);
      if (patt === 'soc' && !head) mantle = Math.max(mantle, sst(0.55, 0.62, Math.sin(x * 9 + y * 2.5)) * sst(-0.25, 0.1, n[1]));
      if (patt === 'ma' && head) mantle = Math.max(mantle, sst(hc[1] - 0.02 * hs, hc[1] + 0.02 * hs, y) * sst(mzA[0] + 0.3 * hs, mzA[0] + 0.24 * hs, x));
      const belly = head ? 0 : bi ? sst(0.4, 0.52, n[0]) * sst(chY + 0.3, chY + 0.2, y) : patt === 'bung' || serp ? sst(0.45, 0.6, -n[1]) : 0;
      const streak = head && lvl >= 1 ? sst(0.036 * hs, 0.026 * hs, cap(x, y, az, hc[0] + 0.2 * hs, hc[1] - 0.08 * hs, 0.285 * hs, hc[0] - 0.03 * hs, hc[1] - 0.15 * hs, 0.33 * hs, 0, 0)) : 0;
      const runes = !head && lvl >= 2 && az > 0.22 ? Math.max(ring(x, y, runeC[0][0], runeC[0][1], runeC[0][2]), rk >= 1 ? ring(x, y, runeC[1][0], runeC[1][1], runeC[1][2]) : 0) : 0;
      const spots = patt === 'dom' && !head && lvl >= 1 ? sst(0.82, 0.88, Math.sin(x * 7.3 + 1) * Math.sin(y * 8.1) * Math.sin(az * 9 + 2) + 0.55) * sst(-0.2, 0.2, n[1]) : 0;
      const mark = Math.max(streak, runes, spots);
      c.copy(pal.fur).lerp(pal.mantle, Math.min(1, mantle)).lerp(pal.hot, belly * 0.6).lerp(pal.accent, shell).lerp(pal.mantle, shell * sst(0.1, 0.0, Math.abs(((x * 3.2) % 1 + 1) % 1 - 0.5)) * 0.8).lerp(pal.glow, mark).lerp(pal.nose, nose ? 1 : 0).lerp(BEAK, beak);
      return mark * (1 - shell);
    };
    const cellT = cell, pad = 0.08, tx1 = mzB[0] + 0.14 * hs, ty1 = Math.max(hc[1] + 0.34 * hs, o.shell ? midP[1] + 0.75 : 0), zmax = 0.62 * Math.max(fat, 1) + bend(tx1) + (o.shell ? 0.05 : 0);
    const torsoGeo = sculpt(torso, [hipX - 0.55 * fat - pad, Math.min(hipY, midP[1]) - 0.75 * fat - pad, -0.62 * Math.max(fat, 1) - pad], [tx1 + pad, ty1 + pad, zmax + pad], cellT, paintTorso);

    /* chân: bốn lưới riêng để game nhấc và bước từng chân */
    const legs = []; const sockE = 0.5 + 0.3 * ll;
    const paintLeg = (x, y, z, n, c) => { const e = sockE + 0.04 * Math.sin(z * 26 + x * 9), band = sst(0.03, 0.018, Math.abs(y - e - 0.06)) * (lvl >= 1 ? 1 : 0); c.copy(pal.fur).lerp(pal.sock, sst(e, e - 0.03, y)).lerp(pal.glow, band); return band; };
    const arms = [];
    if (!serp) [-1, 1].forEach(s => {
      const fx = shX + s * STEP, hx = hipX - s * STEP, lr = bird ? 0.55 : 1;
      const F = bi ? [[hipX + 0.02, hipY - 0.15, s * 0.28, 0.29], [hipX + 0.24, 0.5 * legLen + 0.12, s * 0.32, 0.19 * lr], [hipX - 0.02, 0.2, s * 0.32, 0.13 * lr], [hipX + 0.28, 0.09, s * 0.32, 0.11]]
        : [[fx + 0.05, hipY - 0.27, s * 0.3, 0.17], [fx + 0.11, 0.72 * legLen, s * 0.32, 0.11], [fx + 0.05, 0.16, s * 0.32, 0.09], [fx + 0.25, 0.085, s * 0.32, 0.1]];
      const Hd = [[hx, hipY - 0.3, s * 0.3, 0.24], [hx + 0.25, 0.78 * legLen, s * 0.34, 0.14], [hx - 0.17, 0.46 * legLen, s * 0.34, 0.09], [hx - 0.05, 0.12, s * 0.34, 0.085], [hx + 0.15, 0.085, s * 0.34, 0.1]];
      if (bi && !bird) { const A = [[shX + 0.02, chY + 0.12, s * 0.44, 0.19], [shX + 0.2, chY - 0.28, s * 0.58, 0.14], [shX + 0.46, chY - 0.46, s * 0.52, 0.13]], pv = toG(A[0]);
        const fa = (x, y, z) => smin(cap(x, y, z, A[0][0], A[0][1], A[0][2], A[1][0], A[1][1], A[1][2], A[0][3], A[1][3]), cap(x, y, z, A[1][0], A[1][1], A[1][2], A[2][0], A[2][1], A[2][2], A[1][3], A[2][3]), 0.07), handY = A[2][1] + 0.16;
        arms.push({ s, pivot: pv, geo: bake(mergeGeometries([sculpt(fa, [shX - 0.26, A[2][1] - 0.2, s * 0.5 - 0.36], [A[2][0] + 0.2, A[0][1] + 0.26, s * 0.5 + 0.36], cell, (x, y, z, n, c) => { c.copy(pal.fur).lerp(pal.sock, sst(handY + 0.03, handY, y)); return 0; }), ...claws([A[2][0] + 0.04, A[2][1] - 0.02, A[2][2]])], false), pv) }); }
      (bi ? [[F, true]] : [[F, true], [Hd, false]]).forEach(([Pn, front]) => {
        const f = (x, y, z) => { let d = 1e9; for (let i = 0; i < Pn.length - 1; i++) { const a = Pn[i], b = Pn[i + 1]; d = smin(d, cap(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], a[3], i === Pn.length - 2 ? 0.105 : b[3]), 0.07); } return d; };
        const xs = Pn.map(p => p[0]), ys = Pn.map(p => p[1]);
        const e = Pn[Pn.length - 1]; legs.push({ front, s, geo: bake(mergeGeometries([sculpt(f, [Math.min(...xs) - 0.36, 0, s * 0.32 - 0.36], [Math.max(...xs) + 0.24, Math.max(...ys) + 0.34, s * 0.32 + 0.36], cell, paintLeg), ...claws([e[0], 0.085, e[2]]), ...elbow(Pn)], false)) });
      });
    });

    /* tai */
    const ears = [];
    if (o.ears !== 'none') [-1, 1].forEach(s => {
      const round = o.ears === 'round', el = (round ? 0.34 : 1) * o.earK * (0.75 + 0.25 * g), a = Wp(hp(-0.14, 0.16, s * 0.2)), b = Wp(hp(-0.14 - 0.16 * el, 0.16 + 0.64 * el, s * (0.2 + 0.16 * el))), r0 = (round ? 0.15 : 0.14) * hs, r1 = round ? 0.11 * hs : 0.02;
      const f = (x, y, z) => -smin(-cap(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], r0, r1), ell(x, y, z, (a[0] + b[0]) / 2 + 0.07 * hs, (a[1] + b[1]) / 2 + 0.02, (a[2] + b[2]) / 2 - s * 0.01, 0.05 * hs, Math.max(0.08, 0.26 * el * hs), 0.085 * hs), 0.04);
      const tipY = a[1] + (b[1] - a[1]) * 0.72, paint = (x, y, z, n, c) => { c.copy(pal.fur).lerp(pal.inner, n[0] > 0.3 ? 1 : 0).lerp(pal.sock, round ? 0 : sst(tipY, tipY + 0.04, y)); return 0; };
      const lo = [Math.min(a[0], b[0]) - r0 - 0.05, a[1] - r0 - 0.05, Math.min(a[2], b[2]) - r0 - 0.05], hi = [Math.max(a[0], b[0]) + r0 + 0.05, b[1] + r1 + 0.08, Math.max(a[2], b[2]) + r0 + 0.05], pv = toG(a);
      ears.push({ s, pivot: pv, geo: bake(sculpt(f, lo, hi, cell * 0.8, paint), pv) });
    });

    /* lọn lông và phần cứng gắn liền thân (không tách hoạt ảnh) */
    const fixed = [], C = c => '#' + c.getHexString(), FUR = C(pal.fur), FUR2 = C(pal.fur.clone().lerp(pal.mantle, 0.28)), MAN = C(pal.mantle), MAN2 = C(pal.mantle.clone().lerp(pal.fur, 0.4)), TIP = C(pal.tip), HOT = C(pal.hot), BONE = C(pal.bone);
    const ruffC = [nb[0] + 0.05, nb[1] + 0.1, 0];
    if (ruff > 0.2) [[0, 0, 11, 0, 0.5, 0.13], [-0.18, -0.13, 10, 0.26, 0.6, 0.15]].forEach(([ox, oy, n, off, len, w], row) => { if (row && ruff < 0.5) return; for (let i = 0; i < n; i++) { const a = (i + off) / n * Math.PI * 2, d = [-0.2, Math.cos(a), Math.sin(a)], low = Math.cos(a) < -0.35, b = surf(torso, Wp([ruffC[0] + ox, ruffC[1] + oy, 0]), d), top = Math.cos(a) > 0.45;
      fixed.push(tuftGeo(b, low ? [d[0] - 0.55, d[1] - 0.55, d[2] * 0.8] : [d[0] - 1.0, d[1] * 0.75 - 0.25, d[2] * 0.8], len * ruff * (low ? 0.62 : 1) * (0.85 + 0.3 * h3(i, row, 3)), w * (0.7 + 0.3 * ruff), low ? [-0.5, -0.5, 0] : [0, -0.9, 0], { c0: top ? MAN : FUR, c1: top ? MAN2 : FUR2 })); } });
    if (ruff > 0.4) { fixed.push(tuftGeo(surf(torso, bi ? [shX, chY, 0] : [shX + 0.17, chY - 0.13, 0], bi ? [1, -0.1, 0] : [0.8, -0.45, 0]), bi ? [0.45, -0.9, 0] : [0.3, -1, 0], 0.5 * ruff, 0.17, [-0.35, 0, 0], { c0: FUR, c1: FUR2 })); }
    if (lvl >= 1 && !o.beak) [-1, 1].forEach(s => [[-0.55, 0.1, 0.34], [-0.75, -0.2, 0.28], [-0.6, -0.55, 0.22]].forEach(([dx, dy, len]) => fixed.push(tuftGeo(surf(torso, Wp(hp(-0.06, -0.12, s * 0.1)), [-0.25, dy * 0.6, s]), [dx, dy, s * 0.75], len * hs, 0.085 * hs, [0, -0.5, 0], { c0: FUR, c1: FUR2 }))));
    if (lvl >= 2 && rk >= 1) { const b = surf(torso, bi ? [shX, chY + 0.05, 0] : [shX + 0.17, chY - 0.02, 0], bi ? [1, 0.2, 0] : [0.9, 0.25, 0]), V = (x, y) => b.clone().add(new THREE.Vector3(x, y, 0));   // ngọc nguyên tố trên ngực
      fixed.push(sweep([V(-0.03, -0.12), V(0.035, 0), V(-0.03, 0.12)], [0.004, 0.08, 0.004], { c0: TIP, c1: HOT, flat: 0.6, radial: 6, sub: 3, glow: 1, cs: 0, ce: 0.6 })); }
    if (lvl >= 2) [-0.22, 0, 0.22].forEach(z => fixed.push(tuftGeo(surf(torso, Wp(hp(-0.08, 0.06, z)), [-0.5, 0.85, z * 0.6]), [-0.95, 0.42, z], (0.42 - Math.abs(z) * 0.5) * hs, 0.1, [0, -0.5, 0], { c0: MAN, c1: MAN2 })));
    if (lvl >= 1 && !o.shell) { const n = o.spikes ? 7 : 5; for (let i = 0; i < n; i++) { const u = i / (n - 1), x = shX + 0.17 - i * (shX + 0.17 - hipX + 0.05) / (n - 1), b = bi ? surf(torso, [shX - 0.05 + (hipX - shX + 0.05) * u, chY + 0.2 + (hipY - chY) * u, 0], [-1, 0.2, 0]) : surf(torso, [x, chY + (hipY - chY) * u, 0], [-0.15, 1, 0]);
      const sd = bi ? [[0.06, 0.02], [-0.2, 0.06], [-0.4, -0.08]] : [[0.04, -0.06], [-0.08, 0.2], [-0.26, 0.36]];
      fixed.push(o.spikes ? sweep(sd.map(q => b.clone().add(new THREE.Vector3(q[0], q[1], 0))), [0.085, 0.06, 0.004], { flat: 0.5, c0: C(pal.accent), c1: HOT, radial: 6, sub: 3 }) : tuftGeo(b, bi ? [-0.6, -0.8, 0] : [-0.95, 0.5, 0], 0.32 - i * 0.02, 0.1, bi ? [-0.4, 0, 0] : [0, -0.5, 0], { c0: MAN, c1: MAN2 })); } }
    if (o.horns !== 'none' && lvl >= 1) [-1, 1].forEach(s => { const hk = (0.35 + 0.65 * g) * hs, hb = Wp(hp(0.04, 0.24, s * 0.16)), P3 = (dx, dy, dz) => new THREE.Vector3(hb[0] + dx * hk, hb[1] + dy * hk, hb[2] + s * dz * hk), hopt = { c0: C(pal.accent), c1: BONE, radial: 8, sub: 6, cs: 0.1, ce: 0.9 };
      if (o.horns === 'curve') fixed.push(sweep([P3(0.02, -0.05, 0), P3(-0.2, 0.36, 0.1), P3(-0.62, 0.52, 0.18), P3(-0.95, 0.32, 0.24)], [0.1 * hk, 0.085 * hk, 0.05 * hk, 0.006], hopt));
      if (o.horns === 'crescent') fixed.push(sweep([P3(0.02, -0.05, 0), P3(0.06, 0.34, 0.12), P3(-0.12, 0.62, 0.1), P3(-0.34, 0.7, 0.0)], [0.075 * hk, 0.065 * hk, 0.04 * hk, 0.005], { ...hopt, c0: TIP, c1: HOT, glow: 1 }));
      if (o.horns === 'feeler') fixed.push(sweep([P3(0.06, -0.04, 0), P3(0.3, 0.5, 0.14), P3(0.72, 0.72, 0.24), P3(1.0, 0.6, 0.3)], [0.028, 0.022, 0.016, 0.03], { ...hopt, c0: MAN, c1: TIP, glow: 1 }));
      if (o.horns === 'antler') { fixed.push(sweep([P3(0.0, -0.05, 0), P3(-0.1, 0.4, 0.14), P3(-0.34, 0.78, 0.3), P3(-0.3, 1.1, 0.42)], [0.07 * hk, 0.06 * hk, 0.042 * hk, 0.006], hopt)); [[0.4, 0.14, 0.3, 0.62, 0.1], [0.78, 0.3, 0.0, 1.02, 0.2]].forEach(([y0, z0, x1, y1, z1]) => fixed.push(sweep([P3(-0.1 - (y0 - 0.4) * 0.6, y0, z0), P3(x1 * 0.6, (y0 + y1) / 2 + 0.08, (z0 + z1) / 2), P3(x1, y1, z1)], [0.045 * hk, 0.032 * hk, 0.005], hopt))); } });
    if (sp.extra.includes('ria') && lvl >= 1) [-1, 1].forEach(s => [0.06, -0.04].forEach((dy, i) => { const b = Wp([mzB[0] - 0.12 * hs, mzB[1] + dy * hs, s * 0.085 * hs]); fixed.push(sweep([new THREE.Vector3(...b), new THREE.Vector3(b[0] + 0.02, b[1] + dy * 1.2, b[2] + s * 0.22), new THREE.Vector3(b[0] - 0.08, b[1] + dy * 2.2 - 0.04, b[2] + s * 0.4)], [0.011, 0.008, 0.002], { c0: HOT, c1: HOT, radial: 5, sub: 4, glow: 0.6 })); }));

    /* đuôi: mỗi đuôi một lưới + lọn lông riêng để vẫy */
    const tails = [], nT = lvl === 0 ? 1 : (o.tails || (o.tail === 'plume' ? [1, 1, 2, 3][rk] : 1)), style = o.tail;
    for (let ti = 0; ti < nT; ti++) {
      const k = nT === 1 ? 0 : nT === 2 ? (ti ? 0.6 : -0.6) : ti - 1, up = k ? 0 : 0.15 * tk, tf = o.tailFat;
      const T = style === 'plume' ? [[0, 0, 0, 0.16], [-0.62, 0.33, k * 0.46, 0.3], [-1.3, 0.98 + up, k * 1.0, 0.4], [-1.7, 1.73 + up * 1.6, k * 1.28, 0.33], [-1.48, 2.38 + up * 2, k * 1.12, 0.05]]
        : serp ? [[0, 0, 0, 0.26], [-0.7, -0.15, 0.12, 0.22], [-1.4, 0.1, -0.12, 0.16], [-2.0, 0.45, 0.1, 0.09], [-2.4, 0.9, 0, 0.03]]
        : style === 'fan' ? [[0, 0, 0, 0.12], [-0.25, 0.02, 0, 0.1], [-0.42, 0.0, 0, 0.03]]
        : style === 'whip' ? [[0, 0, 0, 0.13 * tf], [-0.6, -0.1, 0, 0.11 * tf], [-1.2, 0.05, 0.1, 0.085 * tf], [-1.65, 0.5, 0.16, 0.06 * tf], [-1.75, 1.0, 0.1, 0.035]]
          : [[0, 0, 0, 0.14], [-0.3, 0.12, 0, 0.13], [-0.52, 0.3, 0, 0.03]];
      const P = T.map(p => [tb[0] + p[0] * tk, tb[1] + p[1] * tk, p[2] * tk, p[3] * (style === 'stub' ? 1 : 0.6 + 0.4 * tk)]);
      const f = (x, y, z) => { let d = 1e9; for (let i = 0; i < P.length - 1; i++) d = smin(d, cap(x, y, z, P[i][0], P[i][1], P[i][2], P[i + 1][0], P[i + 1][1], P[i + 1][2], P[i][3], P[i + 1][3]), 0.12); return d; };
      const tipE = P[P.length - 1][1] - 0.75 * tk, plume = style === 'plume';
      const paint = (x, y, z, n, c) => { const e = tipE + 0.16 * tk * Math.sin(z * 9 + x * 7), tT = plume ? sst(e, e + 0.04, y) : 0, band = plume && lvl >= 1 ? sst(0.045, 0.03, Math.abs(y - e + 0.16)) : 0, rb = patt === 'cauvong' ? Math.floor(((y - tb[1]) / tk) * 3.2) % 4 : -1;
        c.copy(pal.fur).lerp(pal.mantle, plume ? 0 : sst(0.2, 0.3, n[1])); if (rb >= 0 && plume) c.lerp(new THREE.Color(['#ff8fb8', '#ffd66a', '#7fe0a8', '#7fb8ff'][rb]), 0.75); c.lerp(pal.tip, tT).lerp(pal.glow, band); return Math.max(band, tT * 0.55); };
      const xs = P.map(p => p[0]), ys = P.map(p => p[1]), zs = P.map(p => p[2]), rm = Math.max(...P.map(p => p[3])) + 0.1, pv = toG(tb);
      const parts = [sculpt(f, [Math.min(...xs) - rm, Math.min(...ys) - rm, Math.min(...zs) - rm], [Math.max(...xs) + rm, Math.max(...ys) + rm, Math.max(...zs) + rm], cell * (plume ? 1.15 : 0.8), paint)];
      const P3 = P.map(p => new THREE.Vector3(p[0], p[1], p[2])), frame = (a, b) => { const ax = b.clone().sub(a).normalize(), u = new THREE.Vector3().crossVectors(ax, FWv).normalize(), v = new THREE.Vector3().crossVectors(ax, u).normalize(); return { ax, u, v }; };
      if (plume && lvl >= 1) {
        [[1, 2, 0.35, 6, 0.46, 0.2, FUR, FUR2, 0], [2, 3, 0.1, 7, 0.52, 0.24, FUR, FUR2, 0], [2, 3, 0.7, 7, 0.56, 0.24, FUR, TIP, 0.3], [3, 4, 0.3, 7, 0.7, 0.22, TIP, HOT, 1], [3, 4, 0.68, 5, 0.66, 0.17, TIP, HOT, 1]].forEach(([i0, i1, t, n, len, w, c0, c1, gl], row) => { if (lvl < 2 && row % 2) return; const { ax, u, v } = frame(P3[i0], P3[i1]), cc = P3[i0].clone().lerp(P3[i1], t);
          for (let q = 0; q < n; q++) { const a = (q + row * 0.5 + ti * 0.3) / n * Math.PI * 2, rad = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)); parts.push(tuftGeo(surf(f, cc.toArray(), rad.toArray()), rad.clone().multiplyScalar(0.42).addScaledVector(ax, 1).toArray(), len * tk * (0.85 + 0.3 * h3(q, row, ti)), w * tk, rad.clone().multiplyScalar(row >= 3 ? -0.55 : 0.35).toArray(), { c0, c1, glow: gl, cs: 0.2 })); } });
        const { ax } = frame(P3[3], P3[4]); parts.push(tuftGeo(P3[4].clone().addScaledVector(ax, -0.3 * tk), ax.toArray(), 0.85 * tk, 0.24 * tk, [0.3, 0, k * 0.2], { c0: TIP, c1: HOT, glow: 1, flat: 0.8 }));
      } else if (style === 'fan') { const nf = lvl >= 2 ? 7 : 5; for (let q = 0; q < nf; q++) { const a = (q / (nf - 1) - 0.5) * 1.5; parts.push(tuftGeo(P3[1].clone(), [-1, -0.25 + 0.15 * Math.cos(a * 2), Math.sin(a) * 0.9], (0.75 - Math.abs(a) * 0.2) * tk * (rk >= 2 ? 1.5 : 1), 0.15 * tk, [0, -0.3, 0], { c0: q % 2 ? MAN : FUR, c1: q % 2 ? TIP : MAN2, flat: 0.3, glow: rk >= 2 ? 0.6 : 0 })); } }
      else if (style === 'whip' && lvl >= 1) { const { ax, u, v } = frame(P3[3], P3[4]); for (let q = 0; q < 5; q++) { const a = q / 5 * Math.PI * 2, rad = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)); parts.push(tuftGeo(P3[4].clone().addScaledVector(ax, -0.08), rad.clone().multiplyScalar(0.5).addScaledVector(ax, 1).toArray(), 0.42 * tk, 0.12 * tk, rad.clone().multiplyScalar(-0.5).toArray(), { c0: TIP, c1: HOT, glow: 1 })); } }
      tails.push({ k, pivot: pv, geo: bake(mergeGeometries(parts.map(p => (p.index ? p : p)), false), pv) });
    }

    /* cánh: quạt các lá dẹt (lông vũ, màng dơi) hoặc hai phiến mỏng (côn trùng); là lưới riêng để vỗ */
    const wings = [];
    if (o.wings && lvl >= 1) [-1, 1].forEach(s => { const bug = o.wings === 'bug', bat = o.wings === 'bat', fin = o.wings === 'fin', wk = (0.5 + 0.5 * g) * (bug ? 0.9 : fin ? 0.62 : bird ? 1.45 : 1.3), wb = bi ? [shX - 0.22, chY + 0.12, s * 0.3] : fin ? [shX + 0.05, chY - 0.08, s * 0.3] : [shX - 0.1, chY + 0.3, s * 0.26], pv = toG(wb), base = new THREE.Vector3(...wb), parts = [], n = bug ? 2 : fin ? 3 : bat ? 4 : 6;
      for (let i = 0; i < n; i++) { const u = i / Math.max(1, n - 1), dir = bug ? [-0.5 - 0.3 * i, 0.55 - 0.5 * i, s * 0.9] : [-0.25 - 0.55 * u, 0.95 - 1.15 * u, s * (0.85 - 0.25 * u)];
        parts.push(tuftGeo(base.clone(), dir, (bug ? 1.2 : 1.25 - 0.35 * u) * wk, (bug ? 0.17 : bat ? 0.26 : 0.19) * wk, bug ? [0, 0, 0] : [-0.25, -0.5, 0], { c0: bug ? HOT : bat ? MAN : (i % 2 ? FUR : MAN2), c1: bug ? C(pal.glow) : bat ? C(pal.accent) : (i % 2 ? MAN2 : TIP), flat: bug ? 0.12 : 0.2, glow: bug ? 0.5 : 0, radial: 6 })); }
      wings.push({ s, bug, pivot: pv, geo: bake(mergeGeometries(parts, false), pv) }); });

    /* mắt: hai miếng ôm theo đầu, lấy hình từ hai ô mắt của khuôn mặt 2D */
    const eyes = [-1, 1].map(s => {
      const c0 = Wp([hc[0], hc[1], 0]), ctr = surf(torso, c0, [0.6, 0.06, s * 0.52]), fr = new THREE.Vector3(0.82, -0.12, -s * 0.5).normalize(), upv = new THREE.Vector3(0.1, 1, 0).normalize(), hw = 0.155 * hs, hh = 0.2 * hs, n = 6, pos = [], uv = [], idx = [];
      const u0 = s > 0 ? 0.2 : 0.56, u1 = s > 0 ? 0.44 : 0.8, cv = new THREE.Vector3(...c0);
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const a = i / n * 2 - 1, b = j / n * 2 - 1, tp = ctr.clone().addScaledVector(fr, a * hw).addScaledVector(upv, b * hh), dir = tp.clone().sub(cv), p = surf(torso, c0, dir.toArray()); p.addScaledVector(dir.normalize(), 0.016);
        pos.push(p.x, p.y, p.z); const uu = (a + 1) / 2; uv.push(s > 0 ? u0 + (u1 - u0) * uu : u1 - (u1 - u0) * uu, 0.335 + 0.39 * (b + 1) / 2); }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, d = a + n + 1, e = d + 1; if (s > 0) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d); }
      const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); ge.setIndex(idx); return bake(ge);
    });

    R = { lvl, pal, pose, hover, torsoGeo: bake(torsoGeo), fixedGeo: fixed.length ? bake(mergeGeometries(fixed, false)) : null, legs, arms, ears, tails, wings, eyes,
      head: { c: toG(Wp([hc[0], hc[1], 0])), r: [0.29 * hs * S, 0.28 * hs * S, 0.33 * hs * S] }, body: { c: toG([mid, (hipY + chY) / 2, 0]), r: bi ? [0.42 * fat * S, (chY - hipY) / 2 * S + 0.2, 0.4 * fat * S] : [0.4 * fat * S, 0.42 * fat * S, (shX - hipX) / 2 * S + 0.2] },
      headTop: (hc[1] + 0.28 * hs) * S, mouth: toG(Wp([mzB[0], mzB[1] - 0.06, 0])), sy: (hipY + chY) / 2 * S };
    geoCache.set(key, R); if (geoCache.size > 40) geoCache.delete(geoCache.keys().next().value);
    return R;
  }

  /* ---------- vật liệu ---------- */
  const inkMats = new Map();
  const ink = col => { const k = col.getHexString(); let m = inkMats.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: col, side: THREE.BackSide }); m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize( normal ) * 0.0125;'); }; m.customProgramCacheKey = () => 'mon-ink'; inkMats.set(k, m); } return m; };
  const hitGeo = new THREE.SphereGeometry(1, 10, 8), hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  let celM = null;
  function put(parent, geo, inkM) {
    const mesh = new THREE.Mesh(geo, celM || (celM = K.petCel())); parent.add(mesh);
    const o = new THREE.Mesh(geo, inkM); o.userData.outline = true; o.raycast = () => {}; mesh.add(o); return mesh;
  }

  /** look = { species, stage, form, genes, face?, lod? } → dựng vào `into`; trả về bộ phận cho game.js như pet3d.build, hoặc null nếu loài chưa có quái thú. */
  function build(into, look, H) {
    const sp = SPECIES_BY_ID[look.species] || SPECIES[0]; if (!hasMonster(sp)) return null;
    const stage = look.stage && STAGES[look.stage] ? look.stage : 'baby', grown = stage === 'adult' || stage === 'elder', form = grown ? look.form : null;
    const cell = look.lod ? 0.075 : K.quality && K.quality() === 'thap' ? 0.07 : 0.052;
    const R = beast(sp, stage, form, cell), inkM = ink(R.pal.ink), root = new THREE.Group(), el = K.ELEMENT[sp.region] || K.ELEMENT[0];
    const torso = put(root, R.torsoGeo, inkM); if (R.fixedGeo) put(root, R.fixedGeo, inkM);
    const faceTex = look.face ? H.simpleFace(el.iris, K.FIERCE[stage] || 0) : K.faceTex();
    const eyeM = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    R.eyes.forEach(g => { const e = new THREE.Mesh(g, eyeM); e.userData.noShadow = true; e.raycast = () => {}; root.add(e); });
    // chân: game đặt feet[i].position = (x, 0.1 + nhấc, 0.38 + bước)
    const legRig = new THREE.Group(); legRig.position.set(0, -0.1, -0.38); root.add(legRig); const backRig = new THREE.Group(); backRig.position.y = -0.1; root.add(backRig);
    const feet = [], backLegs = [];
    [1, -1].forEach(s => R.legs.filter(l => l.s === s).forEach(l => { const g = new THREE.Group(); put(g, l.geo, inkM); if (l.front) { g.position.set(0, 0.1, 0.38); legRig.add(g); feet.push(g); } else { g.position.set(0, 0.1, 0); backRig.add(g); backLegs.push(g); } }));
    const ears = R.ears.map(e => { const eg = new THREE.Group(), gs = -e.s; eg.userData.s = gs; eg.position.copy(e.pivot); eg.rotation.z = -gs * 0.38; const ig = new THREE.Group(); ig.rotation.z = gs * 0.38; eg.add(ig); put(ig, e.geo, inkM); root.add(eg); return eg; });
    const tail = new THREE.Group(); root.add(tail);
    const tails = R.tails.map(t => { const g = new THREE.Group(); g.position.copy(t.pivot); g.userData.k = t.k; put(g, t.geo, inkM); tail.add(g); return g; });
    const topG = new THREE.Group(); topG.position.set(R.head.c.x, R.headTop - 0.03, R.head.c.z); root.add(topG);
    if (R.lvl === 0) { const capM = K.toon('#fffaf0'); capM.side = THREE.DoubleSide; const cp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 22, 10, 0, Math.PI * 2, 0, 1.15), capM); cp.position.y = -0.2; topG.add(cp); topG.rotation.z = 0.2; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, z = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.1, 4), capM); z.position.set(Math.cos(a) * 0.3, -0.08, Math.sin(a) * 0.3); z.rotation.x = Math.PI; topG.add(z); } }
    // vùng chạm vô hình bao quanh thân: vuốt ve / bấm trúng dễ như thú tròn cũ dù thân quái thú mảnh
    { const hit = new THREE.Mesh(hitGeo, hitMat); hit.visible = false; hit.userData.noShadow = true; hit.position.set(0, R.headTop * 0.52, (R.head.c.z + R.body.c.z) / 2); hit.scale.set(0.5, R.headTop * 0.52, Math.max(0.6, (R.head.c.z - R.body.c.z) / 2 + 0.45)); root.add(hit); }
    const anchor = new THREE.Group(); anchor.scale.setScalar(1e-4); anchor.position.copy(R.head.c); root.add(anchor);   // game gắn mặt 2D vào đây (ẩn): mắt đã lấy hình trực tiếp
    // tay (khung đứng): game đặt arms[i].position = (±0.98, 0.78 + nhấc); lưới tay lệch lại cho khớp vai
    const armRig = new THREE.Group(); root.add(armRig);
    const arms = [1, -1].map(s => { const a = new THREE.Group(), gs = -s, d = R.arms.find(x => x.s === s); a.position.set(gs * 0.98, 0.78, 0); if (d) { const h = new THREE.Group(); h.position.set(d.pivot.x - gs * 0.98, d.pivot.y - 0.78, d.pivot.z); put(h, d.geo, inkM); a.add(h); armRig.add(a); } return a; });
    const wingsG = R.wings.map(w => { const g = new THREE.Group(); g.position.copy(w.pivot); g.userData.s = -w.s; g.userData.side = !w.bug; put(g, w.geo, inkM); root.add(g); return g; });
    const kind = R.pose === 'bi' || R.pose === 'bird' ? 'dung' : R.pose === 'serp' ? 'ran' : 'thu4'; root.position.y = R.hover;
    const anim = { wings: wingsG, halo: null, orbit: [], tent: [], spin: [], gems: [], backLegs, feet, segs: [], root, hover: R.hover, legRigZ: legRig.position.z, mon: { tails, torso } };
    const Hh = { y: R.head.c.y, z: R.head.c.z, sx: R.head.r[0], sy: R.head.r[1], sz: R.head.r[2] }, Bb = { y: R.body.c.y, z: R.body.c.z, sx: R.body.r[0], sy: R.body.r[1], sz: R.body.r[2] };
    const sockets = H.measureSockets(root, { H: Hh, B: Bb, Lo: { kind, hover: R.hover }, kH: Hh.sx / 1.06, kB: Bb.sx / 1.06, head: torso, neckM: torso, neckExtra: [], ears, topG, tail, armRig, legRig, backLegs, anim, sp, lvl: R.lvl });
    into.add(root);
    return { body: anchor, ears, top: topG, tail, arms, feet, anim, sockets, flicker: false, headY: R.headTop + R.hover, mouth: [R.mouth.x, R.mouth.y + R.hover, R.mouth.z], center: [0, R.sy + R.hover, 0], plan: 'thu4', stage, species: sp };
  }
  /** Hoạt ảnh riêng của quái thú: các đuôi đung đưa lệch pha. */
  function animate(parts, t) { const m = parts.anim.mon; if (!m) return; m.tails.forEach((g, i) => { g.rotation.z = Math.sin(t * 1.7 + i * 1.3) * 0.07 + g.userData.k * 0.02; g.rotation.x = Math.sin(t * 1.3 + i * 0.9) * 0.05; }); }
  return { build, animate, has: hasMonster };
}
