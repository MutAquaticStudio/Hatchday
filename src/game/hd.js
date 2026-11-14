// Chất lượng hình khối dùng chung (high poly theo tầng chất lượng) và viền mực thống nhất.
//  - tier(): tầng chất lượng đang chọn ('thap' | 'vua' | 'cao' | 'dienanh'), đọc từ khoá 'hatchday-quality'.
//  - hdThree(THREE): bản THREE có các khối tròn tự tăng số múi theo tầng (cầu, trụ, nón, xuyến, đĩa, vành, viên nang, tiện, ống)
//    và hộp được bo cạnh. Số múi ≤ 6 là đa giác có chủ ý (trụ lục giác, chóp bốn mặt) nên giữ nguyên; máy yếu ('thap') giữ số gốc.
//  - inkMaterial / inkNormals: viền mực bằng vỏ mặt sau đẩy theo pháp tuyến đã làm mượt, độ dày tính trong không gian nhìn
//    (không phụ thuộc tỉ lệ của vật) và kẹp theo tỉ lệ màn hình để nét đều nhau ở mọi vật, mọi khoảng cách.
//  - blobGeo / rockGeo / spireGeo: khối hữu cơ mịn (tán cây, mây, đá, mỏm núi) từ cầu chia nhỏ dời đỉnh theo nhiễu, pháp tuyến mượt.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

let TIER = 'vua';
try { const q = localStorage.getItem('hatchday-quality'); if (q === 'thap' || q === 'vua' || q === 'cao' || q === 'dienanh') TIER = q; } catch { /* bỏ qua */ }
export const tier = () => TIER;
export const setTier = t => { if (t) TIER = t; };
/** Hệ số độ mịn: 0 = giữ nguyên số múi gốc (máy yếu), 1 = vừa, 1.4 = cao / điện ảnh. */
export const fine = () => (TIER === 'thap' ? 0 : TIER === 'vua' ? 1 : 1.4);
/** Chọn giá trị theo tầng: pick(thấp, vừa, cao). */
export const pick = (lo, mid, hi) => (TIER === 'thap' ? lo : TIER === 'vua' ? mid : hi);
/** Số múi quanh trục cho khối tròn bán kính r mà mã gốc xin n múi (n < min giữ nguyên: đa giác có chủ ý). */
export function segs(r, n, min = 7) {
  const k = fine(); if (!k || !(n >= min)) return n;
  return Math.max(n, Math.min(64, Math.round(k * (8 + 24 * Math.sqrt(Math.min(Math.abs(r) || 0.1, 2.5))))));
}

const wrapped = new WeakMap();
export function hdThree(T) {
  let H = wrapped.get(T); if (H) return H;
  const up = (r, n, def) => segs(r, n === undefined ? def : n, 5);   // 5–6 múi (cột, cuống, cà rốt) cũng làm tròn; ≤ 4 là chóp/cột vuông có chủ ý
  class SphereGeometry extends T.SphereGeometry { constructor(r = 1, w = 32, h = 16, ...a) { const w2 = segs(r, w, 4); super(r, w2, w2 > w ? Math.min(48, Math.max(h, Math.round(h * w2 / w))) : h, ...a); } }
  class CylinderGeometry extends T.CylinderGeometry { constructor(rt = 1, rb = 1, h = 1, n, ...a) { super(rt, rb, h, up(Math.max(rt, rb), n, 32), ...a); } }
  class ConeGeometry extends T.ConeGeometry { constructor(r = 1, h = 1, n, ...a) { super(r, h, up(r, n, 32), ...a); } }
  class CircleGeometry extends T.CircleGeometry { constructor(r = 1, n, ...a) { super(r, segs(r, n ?? 32), ...a); } }
  class RingGeometry extends T.RingGeometry { constructor(ri = 0.5, ro = 1, n, ...a) { super(ri, ro, segs(ro, n ?? 32), ...a); } }
  class TorusGeometry extends T.TorusGeometry { constructor(R = 1, tube = 0.4, rs = 12, ts = 48, ...a) { super(R, tube, fine() && rs >= 5 ? Math.max(rs, Math.round(segs(tube, 8) * 0.75)) : rs, segs(R, ts), ...a); } }
  class CapsuleGeometry extends T.CapsuleGeometry { constructor(r = 1, h = 1, cs = 4, rs = 8, ...a) { const r2 = segs(r, rs); super(r, h, r2 > rs ? Math.max(cs, Math.round(r2 / 3)) : cs, r2, ...a); } }
  class LatheGeometry extends T.LatheGeometry { constructor(pts, n = 12, ...a) { let r = 0.1; if (pts) for (const p of pts) r = Math.max(r, Math.abs(p.x)); super(pts, segs(r, n), ...a); } }
  class TubeGeometry extends T.TubeGeometry { constructor(path, ts = 64, r = 1, rs = 8, closed = false) { const k = fine(); super(path, k ? Math.round(ts * (k > 1 ? 2 : 1.5)) : ts, r, k && rs >= 5 ? Math.max(rs, Math.round(segs(r, 8) * 0.75)) : rs, closed); } }
  class ExtrudeGeometry extends T.ExtrudeGeometry { constructor(sh, o = {}) { const k = fine(); super(sh, k ? { ...o, curveSegments: Math.max(o.curveSegments ?? 12, Math.round(18 * k)), bevelSegments: o.bevelEnabled === false ? o.bevelSegments : Math.max(o.bevelSegments ?? 3, k > 1 ? 4 : 3) } : o); } }
  class ShapeGeometry extends T.ShapeGeometry { constructor(sh, cs = 12) { super(sh, fine() ? Math.max(cs, Math.round(18 * fine())) : cs); } }
  /** Hộp bo cạnh: chỉ áp cho hộp đặc cỡ đồ vật (không chia đoạn, không quá mỏng, không phải tường/sàn lớn). */
  function BoxGeometry(w = 1, h = 1, d = 1, sw = 1, sh = 1, sd = 1) {
    const k = fine(), mn = Math.min(w, h, d), mx = Math.max(w, h, d);
    if (!k || sw > 1 || sh > 1 || sd > 1 || !(mn >= 0.02) || mx > 5) return new T.BoxGeometry(w, h, d, sw, sh, sd);
    const g = new RoundedBoxGeometry(w, h, d, k > 1 ? 2 : 1, Math.min(0.035, mn * 0.22)); g.type = 'BoxGeometry'; g.parameters = { width: w, height: h, depth: d, widthSegments: 1, heightSegments: 1, depthSegments: 1 }; return g;
  }
  H = { ...T, SphereGeometry, CylinderGeometry, ConeGeometry, CircleGeometry, RingGeometry, TorusGeometry, CapsuleGeometry, LatheGeometry, TubeGeometry, ExtrudeGeometry, ShapeGeometry, BoxGeometry, RAW: T };
  wrapped.set(T, H); wrapped.set(H, H); return H;
}

/* ---------- viền mực ---------- */
/** Độ dày nét chuẩn (đơn vị thế giới) và khoảng kẹp theo chiều cao màn hình. */
export const INK = { width: 0.019, min: 0.0013, max: 0.0042 };
const INK_GLSL = `
  {
    #ifdef INK_SMOOTH
      vec3 inkN = aInkN;
    #else
      vec3 inkN = normal;
    #endif
    #ifdef USE_SKINNING
      inkN = transformedNormal;
      #ifdef FLIP_SIDED
        inkN = - inkN; // BackSide: three flipped the normal, flip back to push outward
      #endif
    #else
      #ifdef USE_INSTANCING
        mat3 inkIm = mat3( instanceMatrix );
        inkN /= vec3( dot( inkIm[ 0 ], inkIm[ 0 ] ), dot( inkIm[ 1 ], inkIm[ 1 ] ), dot( inkIm[ 2 ], inkIm[ 2 ] ) );
        inkN = inkIm * inkN;
      #endif
      inkN = normalMatrix * inkN;
    #endif
    inkN = normalize( inkN );
    float inkK = projectionMatrix[ 1 ][ 1 ] * 0.5;
    float inkD = isOrthographic ? 1.0 : max( - mvPosition.z, 0.001 );
    float inkF = clamp( inkW.x * inkK / inkD, inkW.y, inkW.z );
    mvPosition.xyz += inkN * ( inkF * inkD / inkK );
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const inkCache = new WeakMap();
/**
 * Vật liệu viền mực dùng chung. `k` nhân độ dày chuẩn (nét mảnh hơn cho chi tiết nhỏ), `smooth` = lưới có thuộc tính aInkN
 * (xem inkNormals) để cạnh cứng không bị hở nét. Lưới có pháp tuyến vốn mượt (quái thú, khối hữu cơ) thì không cần.
 */
export function inkMaterial(THREE, color, { k = 1, smooth = false } = {}) {
  const T = THREE.RAW || THREE; let byT = inkCache.get(T); if (!byT) inkCache.set(T, byT = new Map());
  const c = new T.Color(color), key = c.getHexString() + '|' + k.toFixed(2) + (smooth ? 's' : '');
  let m = byT.get(key); if (m) return m;
  m = new T.MeshBasicMaterial({ color: c, side: T.BackSide });
  const w = { value: new T.Vector3(INK.width * k, INK.min * Math.min(1, k * 1.2), INK.max * Math.min(1.25, k)) };
  if (smooth) m.defines = { INK_SMOOTH: '' };
  m.onBeforeCompile = sh => {
    sh.uniforms.inkW = w;
    sh.vertexShader = 'uniform vec3 inkW;\n' + (smooth ? 'attribute vec3 aInkN;\n' : '') + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + INK_GLSL);
  };
  m.customProgramCacheKey = () => 'hd-ink' + (smooth ? 's' : '');
  m.userData.k = 'ink' + key; m.userData.ink = true;
  byT.set(key, m); return m;
}
/** Thêm aInkN: pháp tuyến trung bình của các đỉnh trùng vị trí, để vỏ viền liền nét ở cạnh cứng (hộp, vành trụ, nắp). Làm một lần mỗi lưới. */
export function inkNormals(THREE, geo) {
  if (geo.attributes.aInkN || !geo.attributes.normal) return geo;
  const p = geo.attributes.position, nr = geo.attributes.normal, n = p.count, out = new Float32Array(n * 3), map = new Map(), first = new Int32Array(n);
  geo.computeBoundingSphere(); const q = 1 / Math.max(1e-5, (geo.boundingSphere ? geo.boundingSphere.radius : 1) * 2e-4);
  for (let i = 0; i < n; i++) {
    const key = Math.round(p.getX(i) * q) + ',' + Math.round(p.getY(i) * q) + ',' + Math.round(p.getZ(i) * q); let f = map.get(key);
    if (f === undefined) { map.set(key, f = i); }
    first[i] = f;
    // cộng mỗi hướng pháp tuyến khác nhau một lần (không để mặt chia nhiều tam giác kéo lệch hướng)
    const x = nr.getX(i), y = nr.getY(i), z = nr.getZ(i), o = f * 3;
    if (f === i) { out[o] = x; out[o + 1] = y; out[o + 2] = z; } else { const l = Math.hypot(out[o], out[o + 1], out[o + 2]) || 1; if ((out[o] * x + out[o + 1] * y + out[o + 2] * z) / l < 0.985) { out[o] += x; out[o + 1] += y; out[o + 2] += z; } }
  }
  for (let i = 0; i < n; i++) { const o = first[i] * 3, l = Math.hypot(out[o], out[o + 1], out[o + 2]) || 1; if (first[i] === i) { out[o] /= l; out[o + 1] /= l; out[o + 2] /= l; } }
  for (let i = 0; i < n; i++) { if (first[i] !== i) { const o = first[i] * 3; out[i * 3] = out[o]; out[i * 3 + 1] = out[o + 1]; out[i * 3 + 2] = out[o + 2]; } }
  geo.setAttribute('aInkN', new (THREE.RAW || THREE).BufferAttribute(out, 3)); return geo;
}

/**
 * Vật liệu viền cho một lưới cụ thể: tính sẵn aInkN và thu nét lại cho vật mảnh (cọc, dây, chân ghế) để mực không nuốt mất vật.
 * `k` nhân độ dày chuẩn; kết quả làm tròn theo bậc 1/8 để dùng chung vật liệu.
 */
export function inkFor(THREE, geo, color, k = 1) {
  inkNormals(THREE, geo);
  let lim = geo.userData.inkLim;
  if (lim === undefined) { geo.computeBoundingBox(); const b = geo.boundingBox, d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].sort((x, y) => x - y); lim = geo.userData.inkLim = d[1] * 0.22 / INK.width; }
  k = Math.max(0.125, Math.round(Math.min(Math.max(k, 0.4), 1.5, lim) * 8) / 8);
  return inkMaterial(THREE, color, { k, smooth: true });
}

/* ---------- khối hữu cơ ---------- */
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v), L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}
const geoCache = new Map();
function ball(THREE, det, f, key) {
  const T = THREE.RAW || THREE, ck = key + '|' + det; let g = geoCache.get(ck); if (g) return g;
  const src = new T.IcosahedronGeometry(1, det); src.deleteAttribute('uv'); src.deleteAttribute('normal'); g = mergeVertices(src, 1e-4); src.dispose();
  const p = g.attributes.position, v = new T.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); f(v); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); g.computeBoundingSphere(); geoCache.set(ck, g); return g;
}
/** Tán cây / mây / bụi: cầu có các múi phồng tròn (kiểu súp lơ), bán kính ~1. `lumps` số múi, `amp` độ phồng. */
export function blobGeo(THREE, seed = 0, { lumps = 14, amp = 0.3, det } = {}) {
  const C = []; for (let i = 0; i < lumps; i++) { const y = 1 - 2 * (i + 0.5) / lumps, r = Math.sqrt(1 - y * y), a = i * 2.39996 + h3(seed, i, 1) * 0.9; C.push([Math.cos(a) * r, y + (h3(seed, i, 2) - 0.5) * 0.25, Math.sin(a) * r, 0.75 + 0.5 * h3(seed, i, 3)]); }
  const w = 2.2 / Math.sqrt(lumps);
  return ball(THREE, det ?? pick(3, 4, 6), v => {
    let m = 0; for (const c of C) { const l = Math.hypot(c[0], c[1], c[2]), d = (v.x * c[0] + v.y * c[1] + v.z * c[2]) / l, ang = Math.acos(Math.min(1, d)) / (w * c[3]); if (ang < 1) m = Math.max(m, Math.sqrt(1 - ang * ang) * c[3]); }
    v.multiplyScalar(1 - amp * 0.55 + amp * m + 0.03 * vnoise(v.x * 5 + seed, v.y * 5, v.z * 5));
  }, 'blob' + seed + '|' + lumps + '|' + amp);
}
/** Tảng đá: cầu bị vạt vài mặt phẳng (cạnh vạt mềm) cộng nhiễu, pháp tuyến mượt, bán kính ~1. */
export function rockGeo(THREE, seed = 0, { cuts = 9, amp = 0.22, det } = {}) {
  const P = []; for (let i = 0; i < cuts; i++) { const y = 1 - 2 * (i + 0.5) / cuts, r = Math.sqrt(1 - y * y), a = i * 2.39996 + h3(seed, i, 5) * 2; P.push([Math.cos(a) * r, y, Math.sin(a) * r, 0.62 + 0.3 * h3(seed, i, 6)]); }
  const kk = 0.12;
  return ball(THREE, det ?? pick(2, 3, 5), v => {
    const n = 0.86 + amp * (vnoise(v.x * 1.7 + seed * 3.1, v.y * 1.7 + 7, v.z * 1.7) - 0.5) * 2 + 0.05 * vnoise(v.x * 6, v.y * 6 + seed, v.z * 6);
    let rad = n; for (const c of P) { const d = v.x * c[0] + v.y * c[1] + v.z * c[2]; if (d > 0.05) { const lim = c[3] / d, h = Math.max(kk - Math.abs(rad - lim), 0) / kk; rad = Math.min(rad, lim) - h * h * kk * 0.25; } }
    v.multiplyScalar(rad);
  }, 'rock' + seed + '|' + cuts + '|' + amp);
}
/** Mỏm đá nhọn (núi lửa, vách): nón nhiều múi dời theo nhiễu, cao 1, đáy bán kính 1, gốc ở y = 0. */
export function spireGeo(THREE, seed = 0) {
  const T = THREE.RAW || THREE, ck = 'spire' + seed; let g = geoCache.get(ck); if (g) return g;
  const rs = pick(9, 22, 32), hs = pick(4, 10, 16), pos = [], idx = [];
  for (let j = 0; j <= hs; j++) { const u = j / hs, r0 = Math.pow(1 - u, 0.8) * (1 - 0.12 * Math.sin(u * 9 + seed)) + 0.015;
    for (let i = 0; i < rs; i++) { const a = i / rs * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a), k = 0.72 + 0.5 * vnoise(cx * 1.6 + seed * 1.7, u * 3.2, cz * 1.6) + 0.1 * vnoise(cx * 5, u * 9 + seed, cz * 5), lean = 0.12 * u * u; pos.push(cx * r0 * k + lean * Math.cos(seed), u, cz * r0 * k + lean * Math.sin(seed)); } }
  pos.push(0.12 * Math.cos(seed), 1.02, 0.12 * Math.sin(seed)); const tip = pos.length / 3 - 1;
  for (let j = 0; j < hs; j++) for (let i = 0; i < rs; i++) { const a = j * rs + i, b = j * rs + (i + 1) % rs, c = a + rs, d = b + rs; idx.push(a, c, b, b, c, d); }
  for (let i = 0; i < rs; i++) idx.push(hs * rs + i, tip, hs * rs + (i + 1) % rs);
  g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); geoCache.set(ck, g); return g;
}

/** Tinh thể cắt mặt (đá quý): lăng trụ hai chóp có vành vát, `sides` mặt, mặt phẳng sắc (cố ý có cạnh), cao 2, bán kính 0.62. */
export function gemGeo(THREE, sides = 8) {
  const T = THREE.RAW || THREE, ck = 'gem' + sides; let g = geoCache.get(ck); if (g) return g;
  const P = [[0, -1], [0.5, -0.32], [0.62, -0.06], [0.6, 0.18], [0.42, 0.62], [0.12, 0.94], [0, 1]].map(([x, y]) => new T.Vector2(x, y));
  g = new T.LatheGeometry(P, sides).toNonIndexed(); g.computeVertexNormals(); g.computeBoundingSphere(); geoCache.set(ck, g); return g;
}
