// Hiệu ứng chiêu thức theo CÔNG THỨC (move-fx.ts): mỗi chiêu = một dạng (form) + một hoạ tiết (motif) + màu + nhịp.
// File này dựng phần hình: hoạ tiết cel (hình phẳng có viền mực, vẽ theo mẻ InstancedMesh nên mỗi loại chỉ tốn một lệnh vẽ),
// 20 dạng tấn công, 6 dạng hỗ trợ, nét riêng (twist), hào quang kéo dài, gây trạng thái, ra sân, gục.
// Quy ước nhịp (docs/VFX-STYLE-GUIDE.md): lấy đà → hành động → TRÚNG (đúng một nhịp: số sát thương + khựng hình + tiếng) → dư âm.
// Mỗi dạng tấn công là hàm (c) trả Promise kết thúc ĐÚNG lúc trúng đòn sau c.act giây; phần dư âm tự chạy tiếp rồi tự dọn.
import { PALETTE, QUALITY, REHIT, COMBO_SUPPORT_BEATS, OTHER_BEATS, recipeOf } from './move-fx';

const TAU = Math.PI * 2;
/* ---------- hình hoạ tiết (đơn vị: bán kính ≈ 1, mũi nhọn hướng +y) ---------- */
const circ = (r = 1, n = 28, cx = 0, cy = 0, sx = 1) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * TAU) * r * sx, cy + Math.sin(i / n * TAU) * r]);
const polar = (f, n = 40) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, r = f(a); return [Math.cos(a) * r, Math.sin(a) * r]; });
const sym = (f, n = 14) => { const h = Array.from({ length: n + 1 }, (_, i) => f(i / n)); return [...h, ...h.slice(1, -1).reverse().map(([x, y]) => [-x, y])]; };
const spike = (n, r1, r0, jag = 0) => Array.from({ length: n * 2 }, (_, i) => { const a = Math.PI / 2 + i * Math.PI / n, r = i % 2 ? r0 : r1 * (1 - jag * Math.sin(i * 7.3) ** 2); return [Math.cos(a) * r, Math.sin(a) * r]; });
const cres = (span, thick) => { const n = 18, out = [], inn = []; for (let i = 0; i <= n; i++) { const t = i / n, a = -span + t * (Math.PI + 2 * span), k = Math.sin(t * Math.PI); out.push([Math.cos(a), Math.sin(a)]); if (i && i < n) inn.push([Math.cos(a) * (1 - thick * k), Math.sin(a) * (1 - thick * k) - 0.12 * k * thick]); } return [...out, ...inn.reverse()]; };
const center = p => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2; return p.map(([x, y]) => [x - cx, y - cy]); };
const rot = (p, a) => p.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
const scl = (p, k, dx = 0, dy = 0) => p.map(([x, y]) => [x * k + dx, y * k + dy]);
const tear = (w, bend = 0) => sym(t => { const a = Math.PI * t; return [w * Math.sin(a) * Math.sin(a / 2) ** 1.2, Math.cos(a)]; }, 16).map(([x, y]) => [x + bend * (y > 0 ? y * y : 0), y]);
const sup = (p, r, sx = 1) => polar(a => r / (Math.abs(Math.cos(a)) ** p + Math.abs(Math.sin(a)) ** p) ** (1 / p), 36).map(([x, y]) => [x * sx, y]);
const JAG = spike(12, 1, 0.45, 0.22);
/** out: các đa giác tô màu chính (có viền mực) · holes: lỗ · hi: mảng nhấn màu c2 (undefined = bản thu nhỏ của hình; null = không có) */
const SHAPES = {
  leaf: { out: [sym(t => [0.42 * Math.sin(Math.PI * t) ** 0.8, 1 - 2 * t])], hi: [[[0, 0.7], [0.06, 0], [0, -0.75], [-0.06, 0]]] },
  petal: { out: [sym(t => [0.58 * Math.sin(Math.PI * t) ** 0.55 * (1 - 0.35 * t), 1 - 2 * t])] },
  grain: { out: [sym(t => [0.36 * Math.sin(Math.PI * t) ** 0.6, 1 - 2 * t])] },
  thorn: { out: [[[0, 1], [0.16, -0.55], [0, -1], [-0.16, -0.55]]], hi: null },
  flower: { out: [polar(a => 0.5 + 0.5 * Math.abs(Math.cos(2.5 * a)) ** 0.7, 60)], hi: [circ(0.26, 14)] },
  lotus: { out: [polar(a => 0.42 + 0.58 * Math.abs(Math.cos(4 * a)) ** 1.6, 80)], hi: [circ(0.24, 14)] },
  bee: { out: [sym(t => [t < 0.86 ? 0.5 * Math.sin(Math.PI * t / 0.86) ** 0.7 : 0.1 * (1 - t) / 0.14, 0.8 - 1.8 * t])], hi: [[[-0.4, 0.3], [0.4, 0.3], [0.44, 0.1], [-0.44, 0.1]], [[-0.42, -0.15], [0.42, -0.15], [0.32, -0.36], [-0.32, -0.36]]] },
  tree: { out: [[[0.13, -1], [0.13, -0.25], [0.55, -0.3], [0.8, 0], [0.7, 0.4], [0.45, 0.7], [0.15, 0.95], [-0.15, 0.95], [-0.45, 0.7], [-0.7, 0.4], [-0.8, 0], [-0.55, -0.3], [-0.13, -0.25], [-0.13, -1]]], hi: [circ(0.26, 12, -0.22, 0.42)] },
  antler: { out: [[[0.08, -1], [0.12, -0.3], [0.5, 0.1], [0.62, 0.6], [0.48, 0.6], [0.4, 0.25], [0.14, 0.05], [0.16, 0.6], [0.3, 1], [0.14, 0.95], [0, 0.55], [-0.14, 0.95], [-0.3, 1], [-0.16, 0.6], [-0.14, 0.05], [-0.4, 0.25], [-0.48, 0.6], [-0.62, 0.6], [-0.5, 0.1], [-0.12, -0.3], [-0.08, -1]]], hi: null },
  drop: { out: [tear(0.66)], hiAt: [-0.1, -0.2] },
  disc: { out: [circ(1)], hi: [circ(0.26, 12, -0.36, 0.38)] },
  shell: { out: [[...Array.from({ length: 19 }, (_, i) => { const a = i / 18 * Math.PI, r = 0.86 + 0.14 * Math.abs(Math.cos(4.5 * a)); return [Math.cos(a) * r, Math.sin(a) * r - 0.35]; }), [-0.3, -0.8], [0.3, -0.8]]], hi: [[[0, 0.45], [0.05, -0.2], [0, -0.7], [-0.05, -0.2]], [[0.42, 0.25], [0.1, -0.6], [0.02, -0.66], [0.34, 0.25]], [[-0.42, 0.25], [-0.1, -0.6], [-0.02, -0.66], [-0.34, 0.25]]] },
  scale: { out: [sup(1.5, 0.82, 0.8)] },
  crest: { out: [center(cres(-0.45, 0.42))], hi: null },
  moon: { out: [rot(center(cres(0.75, 0.7)), -0.6)], hi: null },
  cloud: { out: [polar(a => 0.68 + 0.24 * Math.abs(Math.sin(2.5 * a + 0.6)), 50).map(([x, y]) => [x, y * 0.68])] },
  feather: { out: [sym(t => [0.27 * Math.sin(Math.PI * t) ** 0.5 * (1 - 0.3 * t), 1 - 2 * t])], hi: [[[0, 0.8], [0.035, 0], [0, -0.95], [-0.035, 0]]] },
  kite: { out: [[[0, 1], [0.62, 0.25], [0, -1], [-0.62, 0.25]]], hi: [[[0, 0.8], [0.04, 0.25], [0, -0.8], [-0.04, 0.25]], [[-0.5, 0.25], [0, 0.29], [0.5, 0.25], [0, 0.21]]] },
  star: { out: [spike(5, 1, 0.46)] }, spark: { out: [spike(4, 1, 0.2)] }, sun: { out: [spike(12, 1, 0.74)], hi: [circ(0.42, 18)] }, burst: { out: [JAG], hi: [scl(JAG, 0.52)] },
  bolt: { out: [[[0.1, 1], [-0.5, -0.05], [-0.08, -0.05], [-0.25, -1], [0.5, 0.15], [0.08, 0.15], [0.4, 1]]], hi: null },
  eye: { out: [rot(sym(t => [0.5 * Math.sin(Math.PI * t) ** 0.8, 1 - 2 * t]), Math.PI / 2)], hi: [circ(0.3, 16)] },
  spore: { out: [[[0.18, -1], [0.18, -0.15], [0.95, -0.15], ...Array.from({ length: 11 }, (_, i) => { const a = (i + 1) / 12 * Math.PI; return [Math.cos(a) * 0.95, Math.sin(a) * 0.85 - 0.15]; }), [-0.95, -0.15], [-0.18, -0.15], [-0.18, -1]]], hi: [circ(0.14, 10, -0.4, 0.25), circ(0.1, 10, 0.3, 0.38), circ(0.08, 10, 0.05, 0.1)] },
  flame: { out: [tear(0.62, 0.22)], hiAt: [-0.05, -0.28] },
  tail: { out: [tear(0.5).map(([x, y]) => [x + 0.3 * Math.sin(y * 1.6), y])], hiAt: [0.12, 0.3] },
  fang: { out: [[[-0.38, 1], [0.38, 1], [0.24, 0.2], [0, -1], [-0.24, 0.2]]], hi: null },
  fist: { out: [sup(4, 0.82)] },
  note: { out: [circ(0.36, 16, -0.2, -0.6, 1.2), [[0.12, -0.6], [0.24, -0.6], [0.24, 0.9], [0.12, 0.9]], [[0.24, 0.9], [0.7, 0.55], [0.62, 0.3], [0.24, 0.62]]], hi: null },
  bird: { out: [[[0, -0.15], [0.35, 0.25], [0.75, 0.3], [1, 0.05], [0.7, 0.12], [0.38, 0], [0.08, -0.4], [0, -0.3], [-0.08, -0.4], [-0.38, 0], [-0.7, 0.12], [-1, 0.05], [-0.75, 0.3], [-0.35, 0.25]]], hi: null },
  bat: { out: [[[0, 0.25], [0.15, 0.5], [0.25, 0.25], [0.6, 0.45], [1, 0.2], [0.8, 0.05], [0.75, -0.25], [0.5, -0.1], [0.35, -0.4], [0.15, -0.15], [0, -0.45], [-0.15, -0.15], [-0.35, -0.4], [-0.5, -0.1], [-0.75, -0.25], [-0.8, 0.05], [-1, 0.2], [-0.6, 0.45], [-0.25, 0.25], [-0.15, 0.5]]], hi: [circ(0.05, 6, -0.07, 0.2), circ(0.05, 6, 0.07, 0.2)] },
  shard: { out: [[[0.1, 1], [0.4, 0.3], [0.25, -0.7], [-0.05, -1], [-0.35, -0.4], [-0.3, 0.4]]], hi: [[[0.05, 0.8], [0.2, 0.2], [0.1, -0.5], [0, 0.1]]] },
  ring: { out: [circ(1, 44)], holes: [circ(0.76, 44)], hi: null },
  zzz: { out: [[[-0.6, 0.8], [0.6, 0.8], [0.6, 0.5], [-0.15, -0.5], [0.6, -0.5], [0.6, -0.8], [-0.6, -0.8], [-0.6, -0.5], [0.15, 0.5], [-0.6, 0.5]]], hi: null },
  plus: { out: [[[-0.3, 1], [0.3, 1], [0.3, 0.3], [1, 0.3], [1, -0.3], [0.3, -0.3], [0.3, -1], [-0.3, -1], [-0.3, -0.3], [-1, -0.3], [-1, 0.3], [-0.3, 0.3]]], hi: null },
  heart: { out: [Array.from({ length: 36 }, (_, i) => { const t = i / 36 * TAU; return [16 * Math.sin(t) ** 3 / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 + 0.1]; })], hiAt: [-0.3, 0.3], hiK: 0.25 },
  lantern: { out: [sup(2.6, 0.8, 0.85), [[-0.3, 0.74], [0.3, 0.74], [0.3, 1], [-0.3, 1]], [[-0.22, -0.74], [0.22, -0.74], [0.22, -1], [-0.22, -1]]], hi: [circ(0.42, 16, 0, 0, 0.8)] },
};
const SHAPE_OF = { bubble: 'disc', pearl: 'disc', ball: 'disc' };
/** Tên hình của một hoạ tiết (hoạ tiết lạ thì dùng hình tròn). */
export const shapeOf = motif => { const k = SHAPE_OF[motif] || motif; return SHAPES[k] ? k : 'disc'; };
export const hasShape = motif => !!SHAPES[SHAPE_OF[motif] || motif];
export const FORM_NAMES = ['shot', 'volley', 'melee', 'ram', 'beam', 'rain', 'erupt', 'vortex', 'wave', 'swarm', 'meteor', 'roar', 'summon', 'eclipse', 'bolt', 'dive', 'flurry', 'orbit', 'burst', 'lash', 'ward', 'veil', 'aura', 'chant', 'bloom', 'rest'];
const RAINBOW = ['#ff5a5a', '#ff9a3a', '#ffe14a', '#5fdc6a', '#4ab8ff', '#6a6aff', '#c86aff'], TRI = ['#ff6a7a', '#fff6e0', '#5fdc8a'];
/** Hoạ tiết phóng to so với kích thước khai báo trong các dạng (máy quay rộng của Đấu trường làm hình nhỏ đi); vòng giữ đúng bán kính thật. */
const MOTIF_SCALE = 1.45;
const SKY_FORMS = { rain: 1, meteor: 1, bolt: 1, dive: 1, summon: 1, eclipse: 1 }, MOVERS = { melee: 1, ram: 1, dive: 1, flurry: 1 };

export function makeForms(THREE, scene, H, fx, P) {
  const { tween, wait, emit, trail, mesh, free, bolt, vines, spikeBurst, decal, rune } = P;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), rand = (a, b) => a + Math.random() * (b - a);
  const Q = QUALITY[H.quality] || QUALITY.vua, low = H.quality === 'thap';
  const E = { out: u => 1 - (1 - u) * (1 - u), out3: u => 1 - (1 - u) ** 3, in2: u => u * u, in3: u => u * u * u, io: u => u * u * (3 - 2 * u), acc: u => 0.3 * u + 0.7 * u * u,
    back: u => { const c = 1.7; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; }, bell: u => Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) };
  const after = (s, fn) => tween(Math.max(1e-4, s), null, fn);
  const tv = V(), tv2 = V(), tR = V(), tU = V(), tS = V(), UP = V(0, 1, 0);
  /** Vectơ "sang phải màn hình" (dùng tạm, không cấp phát). */
  const sideV = () => tS.set(1, 0, 0).applyQuaternion(H.camQuat());

  /* ---------- hoạ tiết vẽ theo mẻ ---------- */
  const geos = {};
  function motifGeo(name) {
    if (geos[name]) return geos[name];
    const def = SHAPES[name], pos = [], kk = [], idx = [], W = 0.075;
    const add = (x, y, k) => { pos.push(x, y, 0); kk.push(k); };
    const area = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s; };
    const wind = (p, ccw) => ((area(p) > 0) === ccw ? p : p.slice().reverse());
    // viền mực: dải bám mép ngoài của đa giác (nối góc kiểu miter), vẽ TRƯỚC phần tô nên chỗ các mảng chồng nhau không lộ nét
    const stroke = p => { const n = p.length, base = pos.length / 3;
      for (let i = 0; i < n; i++) { const a = p[(i + n - 1) % n], b = p[i], c = p[(i + 1) % n]; let ax = b[1] - a[1], ay = a[0] - b[0], bx = c[1] - b[1], by = b[0] - c[0]; const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1; ax /= la; ay /= la; bx /= lb; by /= lb;
        let mx = ax + bx, my = ay + by; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml; const len = W / Math.max(0.4, mx * ax + my * ay); add(b[0] - mx * W * 0.6, b[1] - my * W * 0.6, 0); add(b[0] + mx * len, b[1] + my * len, 0); }
      for (let i = 0; i < n; i++) { const a = base + i * 2, b = base + ((i + 1) % n) * 2; idx.push(a, a + 1, b, a + 1, b + 1, b); } };
    const fill = (p, holes, k) => { const v2 = q => q.map(([x, y]) => new THREE.Vector2(x, y)), base = pos.length / 3; [p, ...holes].forEach(q => q.forEach(([x, y]) => add(x, y, k))); THREE.ShapeUtils.triangulateShape(v2(p), holes.map(v2)).forEach(f => idx.push(base + f[0], base + f[1], base + f[2])); };
    const polys = def.out.map(p => wind(p, true)), holes = (def.holes || []).map(p => wind(p, false));
    polys.forEach(stroke); holes.forEach(stroke); polys.forEach((p, i) => fill(p, i ? [] : holes, 1));
    const hi = def.hi === undefined ? [scl(polys[0], def.hiK || 0.42, (def.hiAt || [0, 0])[0], (def.hiAt || [0, 0])[1])] : def.hi || [];
    hi.forEach(p => fill(wind(p, true), [], 2));
    return (geos[name] = { pos: new THREE.Float32BufferAttribute(pos, 3), k: new THREE.Float32BufferAttribute(kk, 1), idx });
  }
  const SV = 'attribute float aK; attribute float aA; varying float vK; varying float vA; void main() { vK = aK; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( position, 1.0 ); }';
  const SF = 'uniform vec3 uC; uniform vec3 uC2; uniform vec3 uInk; varying float vK; varying float vA; void main() { if ( vA < 0.01 ) discard; gl_FragColor = vec4( vK < 0.5 ? uInk : vK < 1.5 ? uC : uC2, vA ); }';
  const batches = new Map(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), FLATQ = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2), DUMMY = { on: false, p: V(), s: 0, sx: 1, sy: 1, roll: 0, a: 0, flat: false, kill() {} };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qz = new THREE.Quaternion(), _s = V(), ZAX = V(0, 0, 1);
  function batchOf(shape, c, c2, ink) {
    const key = shape + c + c2 + ink; let b = batches.get(key); if (b) return b;
    const src = motifGeo(shape), g = new THREE.BufferGeometry(), cap = Q.sprites; g.setAttribute('position', src.pos); g.setAttribute('aK', src.k); g.setIndex(src.idx);
    const aA = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage); g.setAttribute('aA', aA);
    const mat = new THREE.ShaderMaterial({ vertexShader: SV, fragmentShader: SF, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: { uC: { value: new THREE.Color(c) }, uC2: { value: new THREE.Color(c2).multiplyScalar(1.15) }, uInk: { value: new THREE.Color(ink) } } });
    const m = new THREE.InstancedMesh(g, mat, cap); m.frustumCulled = false; m.renderOrder = 19; m.count = 0; m.visible = false; scene.add(m);
    b = { key, m, g, mat, aA, cap, live: 0, idle: 0, S: [], k: shape === 'ring' ? 1 : MOTIF_SCALE };
    for (let i = 0; i < cap; i++) { const s = { on: false, was: false, p: V(), s: 1, sx: 1, sy: 1, roll: 0, a: 1, flat: false, kill() { if (s.on) { s.on = false; b.live--; } } }; b.S.push(s); }
    batches.set(key, b); return b;
  }
  /** Lấy một hình hoạ tiết (sprite). Hết chỗ trong mẻ thì trả về hình giả để hiệu ứng vẫn chạy đúng nhịp. */
  function spr(motif, c, c2 = '#ffffff', ink = '#1a1226') {
    const b = batchOf(shapeOf(motif), c, c2, ink); if (b.live >= b.cap) return DUMMY;
    for (let i = 0; i < b.cap; i++) { const s = b.S[i]; if (!s.on) { s.on = true; s.s = 1; s.sx = s.sy = 1; s.roll = 0; s.a = 1; s.flat = false; s.p.set(0, -99, 0); b.live++; b.idle = 0; return s; } }
    return DUMMY;
  }
  function stepSprites(dt) {
    const cq = H.camQuat();
    for (const b of batches.values()) {
      if (!b.live && !b.m.visible) { b.idle += dt; if (b.idle > 30 && batches.size > 24) { scene.remove(b.m); b.g.dispose(); b.mat.dispose(); batches.delete(b.key); } continue; }
      let hi = 0;
      for (let i = 0; i < b.cap; i++) { const s = b.S[i];
        if (!s.on) { if (s.was) { b.m.setMatrixAt(i, ZERO); s.was = false; } continue; }
        hi = i + 1; _qz.setFromAxisAngle(ZAX, s.roll); _q.copy(s.flat ? FLATQ : cq).multiply(_qz); _s.set(s.s * s.sx * b.k, s.s * s.sy * b.k, 1); _m.compose(s.p, _q, _s); b.m.setMatrixAt(i, _m); b.aA.array[i] = s.a; s.was = true; }
      b.m.count = hi; b.m.visible = hi > 0; b.m.instanceMatrix.needsUpdate = true; b.aA.needsUpdate = true;
    }
  }
  /** Xoay hình cho mũi (+y) chỉ theo hướng bay `v` trên màn hình. */
  const aim = (s, v) => { const q = H.camQuat(); tR.set(1, 0, 0).applyQuaternion(q); tU.set(0, 1, 0).applyQuaternion(q); const x = v.dot(tR), y = v.dot(tU); if (x * x + y * y > 1e-8) s.roll = Math.atan2(-x, y); };
  const bez = (out, a, m, b, w) => { const i = 1 - w; return out.set(i * i * a.x + 2 * i * w * m.x + w * w * b.x, i * i * a.y + 2 * i * w * m.y + w * w * b.y, i * i * a.z + 2 * i * w * m.z + w * w * b.z); };
  const jit = r => V(rand(-r, r), rand(-r, r), rand(-r, r));
  /** Bay một hình theo đường cong tới đích, có gia tốc (không bao giờ tuyến tính), kèm vệt đuôi. */
  function toss(s, from, to, dur, o = {}) {
    const mid = from.clone().lerp(to, 0.5); mid.y += o.arc || 0; if (o.side) mid.addScaledVector(sideV(), o.side);
    const ease = o.ease || E.acc, tr = o.trail && s !== DUMMY ? trail(o.trail, o.tw || 0.2) : null, prev = from.clone(), s0 = o.s0 ?? s.s, s1 = o.s1 ?? s0; s.p.copy(from); s.s = s0;
    return tween(dur, (u, dt) => { prev.copy(s.p); bez(s.p, from, mid, to, ease(u)); if (o.spin) s.roll += o.spin * dt; else if (u > 0) aim(s, tv.copy(s.p).sub(prev)); s.s = (s0 + (s1 - s0) * u) * (o.pop ? Math.min(1, u * 6) : 1); tr?.push(s.p); o.each?.(s.p, u, dt); }, () => { o.end?.(s.p); if (!o.keep) s.kill(); tr?.fade(); });
  }
  /** Sao nổ nhỏ (hình răng cưa đặc, lõi sáng): bật ra có đà rồi co lại. Dùng cho mọi cú chạm phụ. */
  function pow(at, c, size = 0.6, dur = 0.22, c2 = '#ffffff') { const s = spr('burst', c, c2); s.p.copy(at); s.roll = rand(0, TAU); s.s = 0; return tween(dur, u => { s.s = size * (u < 0.35 ? E.back(u / 0.35) : 1 - E.in2((u - 0.35) / 0.65)); s.roll += 0.05; }, () => s.kill()); }
  /** Vòng lan trên mặt sân (hoặc quay mặt về máy quay khi flat = false). */
  function gring(at, c, r0, r1, dur = 0.4, o = {}) { const s = spr('ring', c, c, c); s.flat = o.flat !== false; s.p.copy(at); if (s.flat) s.p.y = H.ground + 0.04 + (o.y || 0); s.s = r0; const ease = o.ease || E.out3; return tween(dur, u => { s.s = r0 + (r1 - r0) * ease(u); s.a = (o.a ?? 1) * (o.hold ? Math.min(1, (1 - u) * 4) : 1 - u * u); }, () => s.kill()); }
  /** Hình hoạ tiết bật ra rồi tan (nhấn nhá, mảnh vụn đứng yên). */
  function puff(motif, at, c, c2, size, dur, o = {}) { const s = spr(motif, c, c2); s.p.copy(at); s.roll = o.roll ?? 0; s.s = 0; const vy = o.rise || 0; return tween(dur, (u, dt) => { s.s = size * (u < 0.3 ? E.back(u / 0.3) : 1 - E.in3((u - 0.3) / 0.7)); s.p.y += vy * dt; if (o.spin) s.roll += o.spin * dt; }, () => s.kill()); }
  const colOf = (R, i) => (R.k === 'rainbow' ? RAINBOW[i % 7] : R.k === 'tri' ? TRI[i % 3] : R.c);
  /** Mảnh hoạ tiết văng ra theo hình nan quạt rồi rơi (lớp phụ lúc trúng đòn: mỗi chiêu vỡ ra đúng chất của mình). */
  function debris(at, R, n, power = 1) {
    for (let i = 0; i < n; i++) { const s = spr(R.m2 || R.motif, colOf(R, i), R.c2), a = rand(0, TAU), sp = rand(1.6, 3.2) * power, vx = Math.cos(a) * sp, vz = Math.sin(a) * sp; let vy = rand(2, 4.2) * power; const size = rand(0.12, 0.22) * (0.8 + power * 0.25), spin = rand(-9, 9); s.p.copy(at); s.s = 0;
      tween(rand(0.4, 0.62), (u, dt) => { vy -= 9 * dt; s.p.x += vx * dt; s.p.y = Math.max(H.ground + 0.05, s.p.y + vy * dt); s.p.z += vz * dt; s.roll += spin * dt; s.s = size * (1 - E.in3(u)); }, () => s.kill()); }
  }
  /** Hạt lấp lánh rải dọc đường bay (giãn theo thời gian, không phụ thuộc số khung hình). */
  const sparkle = (c, c2, rate = 40) => { let acc = 0; return (p, u, dt) => { acc += dt * rate * Q.n; while (acc >= 1) { acc -= 1; emit({ at: p, n: 1, box: 0.06, color: c2, color2: c, size: [0.16, 0.03], life: [0.2, 0.36], speed: [0.1, 0.5], shape: 1, blend: 'alpha' }); } }; };
  /** Số lượng theo công thức; số lớn thì co theo tầng chất lượng, số nhỏ (3 đuôi, 7 sắc…) giữ nguyên vì là nghĩa của chiêu. */
  const cnt = (c, def) => { const n = c.R.n || def, k = (n >= 10 ? Q.n : 1) * (c.rehit && n > 3 ? 0.5 : 1); return Math.max(1, Math.round(n * k)); };
  const groundAt = p => V(p.x, H.ground + 0.04, p.z);
  /** Tia: ống đặc màu chiêu + lõi sáng, mọc nhanh rồi thon lại. Trả về Promise lúc tia chạm đích. */
  function ray(from, to, c, c2, w, grow, hold) {
    const d = to.clone().sub(from), L = d.length(), dir = d.clone().normalize(), a = mesh('cyl', c, 0.92), b = mesh('cyl', c2, 1); [a, b].forEach(x => { x.quaternion.setFromUnitVectors(UP, dir); x.scale.set(0.001, 0.001, 0.001); x.position.copy(from); });
    const total = grow + hold + 0.16;
    tween(total, u => { const t = u * total, g = E.out3(Math.min(1, t / grow)), k = t < grow + hold ? 1 + 0.12 * Math.sin(t * 60) : Math.max(0, 1 - (t - grow - hold) / 0.16); a.scale.set(w * k, L * g, w * k); b.scale.set(w * 0.45 * k, L * g, w * 0.45 * k); a.position.copy(from).addScaledVector(dir, L * g * 0.5); b.position.copy(a.position); }, () => { free(a); free(b); });
    return wait(grow);
  }

  /* ---------- chuyển động của quái thú: co giãn, ngả người (chỉ đổi tỉ lệ và độ lệch) ---------- */
  const dirTo = (a, d) => d.pos.clone().sub(a.pos).setY(0);
  /** Về chỗ sau khi ra đòn: trượt về có giảm tốc rồi đứng yên. */
  function home(s, dur = 0.3) { const o = s.off.clone(), l = s.lean || 0, sp = s.spin || 0; if (o.lengthSq() < 1e-6 && !l && !sp) return wait(dur); return tween(dur, u => { const w = 1 - E.out3(u); s.off.copy(o).multiplyScalar(w); s.lean = l * w; s.spin = sp * w; s.sq = Math.sin(u * Math.PI) * 0.06; }, () => { s.off.set(0, 0, 0); s.lean = 0; s.spin = 0; }); }
  /** Lấy đà: lùi, ép người xuống, ngả ra sau. Giữ nguyên tư thế ở cuối để pha hành động bung ra từ đó. */
  function windup(a, dur, k = 1) { const back = a.dir.clone().multiplyScalar(-0.3 * k); return tween(dur, u => { const w = E.out3(u); a.off.copy(back).multiplyScalar(w); a.sq = -0.16 * k * w; a.lean = -0.14 * k * w; }); }
  /** Bung ra khi nhả đòn (chiêu tầm xa): chồm tới, vươn người rồi lắng lại. */
  function release(a) { const o = a.off.clone(), l = a.lean || 0, fwd = a.dir.clone().multiplyScalar(0.22); return tween(0.3, u => { const w = E.out3(Math.min(1, u * 2.4)), back = u < 0.42 ? 0 : E.io((u - 0.42) / 0.58); a.off.copy(o).lerp(fwd, w).multiplyScalar(1 - back); a.lean = (l + (0.16 - l) * w) * (1 - back); a.sq = 0.16 * Math.sin(Math.min(1, u * 1.6) * Math.PI); }, () => { a.off.set(0, 0, 0); a.lean = 0; }); }
  /** Lao tới sát đối thủ (dừng ở mép thân): chậm rồi vọt, thân vươn dài. */
  function dashTo(a, d, dur, gap = 0.2) { const o = a.off.clone(), t = dirTo(a, d), L = t.length(); t.multiplyScalar(Math.max(0.2, (L - a.r - d.r - gap) / L)); const l = a.lean || 0; return tween(dur, u => { const w = E.in3(u); a.off.copy(o).lerp(t, w); a.sq = 0.2 * Math.sin(u * Math.PI); a.lean = l + (0.22 - l) * w; }); }

  /* ---------- 20 dạng tấn công ---------- */
  const F = {};
  F.shot = async c => {
    const { R, act } = c, s = spr(R.motif, R.c, R.c2), size = 0.34 * R.s * c.big, tr = { trail: R.c, tw: 0.3 * R.s * c.big, each: sparkle(R.c, R.c2) }; H.sfx(c.snd, { pitch: c.pitch });
    if (R.k === 'bounce') { const mid = c.from.clone().lerp(c.to, 0.55); mid.y = H.ground + 0.2; s.s = size;
      await toss(s, c.from, mid, act * 0.55, { ...tr, arc: R.arc || 1.2, spin: 10, keep: true }); gring(mid, R.c2, 0.15, 0.9, 0.28); H.sfx('tick', { pitch: 0.7 }); emit({ at: mid, n: 6, radial: true, flat: true, color: R.c2, speed: [1, 2.4], life: [0.2, 0.35], size: [0.14, 0.03], blend: 'alpha' });
      return toss(s, mid, c.to, act * 0.45, { ...tr, arc: 0.7, spin: 10 }); }
    const spin = R.k === 'spin' || R.k === 'blade' ? 17 : 0;
    return toss(s, c.from, c.to, act, { ...tr, s0: size * 0.5, s1: size * (R.k === 'puff' ? 2.1 : 1.15), arc: R.arc || (R.k === 'blade' || R.k === 'palm' ? 0.05 : 0.38), spin });
  };
  F.volley = c => {
    const { R, act } = c, n = cnt(c, 5), line = R.k === 'line', fly = act * (line ? 0.5 : 0.6), gap = (act - fly) / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) after(i * gap, () => { const s = spr(R.motif, colOf(R, i), R.c2), f = n > 1 ? i / (n - 1) - 0.5 : 0, last = i === n - 1; H.sfx(i ? 'tick' : c.snd, { pitch: c.pitch * (1 + i * 0.06), gain: i ? 0.6 : 1 });
      toss(s, c.from, last ? c.to : c.to.clone().add(jit(0.28)), fly, { s0: 0.14 * R.s * c.big, s1: 0.27 * R.s * c.big, arc: R.arc || (line ? 0.08 : 0.35 + Math.abs(f) * 1.1), side: line ? f * 0.3 : f * 2.6, spin: R.motif === 'ball' || R.motif === 'shard' ? 12 : 0, trail: colOf(R, i), tw: 0.13 * c.big, end: p => { if (!last) { pow(p, colOf(R, i), 0.34 * c.big, 0.16); c.d.shake = 0.03; } } }); });
    return wait(act);
  };
  /** Vết chém: lưỡi liềm đặc quét một cung rồi mảnh dần. motif khác 'crest' thì là hình đó vung theo cung (tát, quất). */
  function cut(at, c, c2, size, roll, dur, delay = 0, sweep = 1.5, motif = 'crest') {
    const blade = motif === 'crest' || motif === 'moon' || !hasShape(motif) ? 'crest' : motif, s = spr(blade, c, c2), w = spr('crest', '#ffffff', '#ffffff', c), o = at.clone(); s.s = w.s = 0;
    tween(delay + dur, u => { const t = (u * (delay + dur) - delay) / dur; if (t < 0) return; const k = E.out3(Math.min(1, t * 2.2)), r = roll + (k - 0.5) * sweep, out = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      if (blade === 'crest') { s.p.copy(o); w.p.copy(o); s.roll = w.roll = r; s.s = size; w.s = size * 0.94; s.sy = (0.5 + k * 0.6) * out; w.sy = 0.4 * out * out; }
      else { tR.set(1, 0, 0).applyQuaternion(H.camQuat()); tU.set(0, 1, 0).applyQuaternion(H.camQuat()); s.p.copy(o).addScaledVector(tR, -Math.sin(r) * size * 0.55).addScaledVector(tU, Math.cos(r) * size * 0.55); s.roll = r; s.s = size * 0.55 * out; w.p.copy(o); w.roll = r; w.s = size; w.sy = 0.5 * out * out; } }, () => { s.kill(); w.kill(); });
  }
  F.melee = async c => {
    const { a, d, R, act } = c, kd = R.k || 'claw', near = a.off.lengthSq() > 0.6;
    if (!near) { H.sfx('swish', { pitch: c.pitch }); await dashTo(a, d, act * 0.58); } else await wait(act * 0.2);
    const at = d.center(), T = near ? act * 0.8 : act * 0.42, size = (0.75 + c.cls * 0.25) * R.s;
    H.sfx(kd === 'bite' ? 'chomp' : 'swish', { pitch: c.pitch * 1.3 });
    if (kd === 'claw') for (let i = 0; i < 3; i++) cut(at.clone().addScaledVector(sideV(), (i - 1) * 0.26), R.c, R.c2, size, -0.75, T + 0.12, i * T * 0.12);
    else if (kd === 'bite') [1, -1].forEach(sg => { const s = spr('fang', R.c, R.c2); s.roll = sg > 0 ? 0 : Math.PI; s.s = 0; const y0 = at.y + sg * 1.0 * size, x = at.clone(); tween(T + 0.14, u => { const t = Math.min(1, u * (T + 0.14) / T); s.p.copy(x); s.p.y = y0 + (at.y + sg * 0.16 - y0) * E.in3(t); s.s = size * 0.5 * (u > 0.85 ? (1 - u) / 0.15 : Math.min(1, u * 5)); }, () => s.kill()); });
    else if (kd === 'whip' || kd === 'slap') cut(at, R.c, R.c2, size * 1.5, 0.9, T + 0.14, 0, 2.6, R.motif);
    else { const s = spr(R.motif, R.c, R.c2), from = a.mouth(); s.s = 0; tween(T, u => { s.p.copy(from).lerp(at, E.in3(u)); aim(s, tv.copy(at).sub(from)); if (kd === 'pound') { s.p.y += (1 - u) * 1.3; s.roll = Math.PI; } s.s = size * 0.45 * E.out(Math.min(1, u * 3)); }, () => { s.kill(); gring(at, R.c2, 0.2, 1.2 * size, 0.26, { flat: false }); }); }
    await wait(T);
  };
  F.ram = c => {
    const { a, d, R, act } = c, o = a.off.clone(), t = dirTo(a, d), L = t.length(), dir = t.clone().normalize(); t.multiplyScalar(Math.max(0.2, (L - a.r - d.r - 0.05) / L));
    const head = spr(R.motif, R.c, R.c2), tr = trail(R.c, a.h * 0.75), tr2 = low ? null : trail(R.c2, a.h * 0.3), l0 = a.lean || 0, roll = R.k === 'roll', dust = sparkle(R.c, R.c2, 50); head.s = 0; H.sfx('whoosh', { pitch: c.pitch }); H.sfx(c.snd, { pitch: c.pitch });
    return tween(act, (u, dt) => { const w = E.in3(u); a.off.copy(o).lerp(t, w); a.sq = 0.22 * Math.sin(u * Math.PI); a.lean = roll ? w * TAU * 2 : l0 + (0.3 - l0) * w;
      const ce = a.center(); head.p.copy(ce).addScaledVector(dir, a.r + 0.25); aim(head, dir); head.s = (0.25 + 0.5 * w) * R.s * c.big * (R.k === 'surf' ? 1.5 : 1); if (R.k === 'surf') { head.p.y = H.ground + 0.3 * head.s; head.roll = 0; }
      tr.push(ce); tr2?.push(tv.copy(ce).setY(ce.y + a.h * 0.22)); dust(tv.copy(a.pos).add(a.off), u, dt); }, () => { head.kill(); tr.fade(); tr2?.fade(); if (roll) a.lean = 0; });
  };
  F.beam = async c => {
    const { R, act } = c, from = c.from, core = spr(R.motif, R.c, R.c2), w = (0.13 + c.cls * 0.07) * R.s, up = act * 0.5; core.s = 0; H.sfx('beamUp', { pitch: c.pitch });
    emit({ at: () => from.clone().add(jit(0.9)), n: 8 + c.cls * 4, to: from, life: up, color: R.c2, color2: R.c, size: [0.16, 0.04], shape: 1, blend: 'alpha', arc: 0, wobble: 0.15 });
    tween(act + 0.3, (u, dt) => { const t = u * (act + 0.3); core.p.copy(from); core.roll += dt * 9; core.s = t < up ? 0.42 * c.big * E.back(t / up) : 0.42 * c.big * Math.max(0, 1 - (t - act - 0.05) / 0.25) * (1 + 0.15 * Math.sin(t * 50)); }, () => core.kill());
    await wait(up); H.sfx('beam', { pitch: c.pitch });
    if (R.k === 'breath') { const n = Math.round(14 * Q.n); for (let i = 0; i < n; i++) after(i / n * (act * 0.5 + 0.2), () => { const s = spr(R.motif, i % 3 ? R.c : R.c2, R.ac); toss(s, from, c.to.clone().add(jit(0.45)), act * 0.42, { s0: 0.12, s1: 0.5 * c.big, arc: rand(-0.1, 0.3), ease: E.out }); }); emit({ at: from, n: 20, dir: c.to.clone().sub(from), spread: 0.16, speed: [6, 10], life: [0.25, 0.45], color: R.c2, color2: R.c, size: [0.3, 0.06], blend: 'alpha' }); return wait(act * 0.5); }
    const cols = R.k === 'rainbow' ? RAINBOW.slice(0, 5) : R.k === 'tri' ? TRI : [R.c], grow = act * 0.5, hold = 0.22;
    cols.forEach((col, i) => { const dy = (i - (cols.length - 1) / 2) * w * 1.3; ray(from.clone().setY(from.y + dy), c.to.clone().setY(c.to.y + dy), col, cols.length > 1 ? '#ffffff' : R.c2, w * (cols.length > 1 ? 0.75 : 1), grow, hold); });
    // hạt hoạ tiết trượt dọc tia: mỗi loài một kiểu tia riêng
    for (let i = 0; i < 3; i++) after(i * 0.07, () => { const s = spr(R.motif, R.c2, R.c); toss(s, from, c.to, grow + 0.1, { s0: 0.2 * c.big, s1: 0.3 * c.big, spin: 10, ease: E.out }); });
    return wait(grow);
  };
  F.rain = c => {
    const { d, R, act } = c, n = cnt(c, 14), fall = Math.min(0.3, act * 0.5), span = act - fall + 0.22, slant = dirTo(c.a, d).normalize().multiplyScalar(R.k === 'slant' ? -3.2 : -0.9), top = c.sky || null, leadI = Math.min(n - 1, Math.round(n * (act - fall) / span));
    H.sfx(c.snd, { pitch: c.pitch });
    for (let i = 0; i < n; i++) after(i / n * span, () => { const lead = i === leadI, r = lead ? 0 : rand(0.2, 1.1), an = rand(0, TAU), to = V(d.pos.x + Math.cos(an) * r, lead ? d.center().y : H.ground + 0.08, d.pos.z + Math.sin(an) * r), from = top ? top.clone().add(jit(0.5)) : to.clone().add(slant).add(V(0, 4.8, 0)), s = spr(R.motif, colOf(R, i), R.c2);
      if (i % 3 === 0) H.sfx('tick', { pitch: rand(0.8, 1.5), gain: 0.5 });
      toss(s, from, to, fall, { ease: E.in2, s0: 0.3 * R.s * (0.8 + c.cls * 0.15), trail: i % 3 === 0 || n < 10 ? colOf(R, i) : null, tw: 0.08, spin: R.motif === 'star' || R.motif === 'cloud' ? 6 : 0, end: p => { gring(p, R.c2, 0.1, 0.5, 0.25); if (i % 2) emit({ at: p, n: 3, radial: true, up: 0.8, color: R.c2, color2: R.c, speed: [1, 2.2], gravity: 6, life: [0.2, 0.4], size: [0.12, 0.04], blend: 'alpha' }); } }); });
    return wait(act);
  };
  F.erupt = async c => {
    const { d, R, act } = c, kd = R.k || 'spikes', at = groundAt(d.pos), tele = act * 0.5, h = (1.5 + c.cls * 0.55) * R.s;
    H.sfx('rumble', { pitch: c.pitch }); gring(at, R.c, 1.7, 0.45, tele, { ease: E.in2, hold: true }); if (c.cls) gring(at, R.c2, 2.3, 0.6, tele, { ease: E.in2, hold: true, a: 0.7 });
    tween(tele, u => { d.shake = 0.02 + u * 0.04; }, () => { d.shake = 0; });
    if (kd === 'line') { const n = R.n || 4, a0 = c.a.pos, st = tele / n; for (let i = 0; i < n; i++) after(i * st, () => { const p = a0.clone().lerp(d.pos, (i + 1) / (n + 1)); spikeBurst(p, R.c, 1, h * (0.45 + i * 0.1), 0.5, 0); puff(R.motif, p.clone().setY(H.ground + h * 0.5), R.c, R.c2, 0.5 + i * 0.1, 0.45); H.sfx('tick', { pitch: 0.6 + i * 0.1 }); }); }
    await wait(tele); H.sfx(kd === 'pillar' || kd === 'lava' ? 'geyser' : 'thump', { pitch: c.pitch }); const grow = act - tele;
    if (kd === 'pillar' || kd === 'lava' || kd === 'bloom') {
      const col = mesh('cyl', R.c, 0.9), core = mesh('cyl', R.c2, 1), life = grow + 0.5, w = (0.55 + c.cls * 0.15) * R.s;
      tween(life, (u, dt) => { const t = u * life, g = E.out3(Math.min(1, t / grow)), k = t < grow + 0.2 ? 1 : Math.max(0, 1 - (t - grow - 0.2) / 0.3), hh = (h + 1.6) * g; col.scale.set(w * k, hh, w * k); core.scale.set(w * 0.5 * k, hh * 1.02, w * 0.5 * k); col.position.set(at.x, H.ground + hh / 2, at.z); core.position.copy(col.position); col.rotation.y += dt * 8; d.off.y = 0.7 * E.bell(t / (grow + 0.45)) * (c.cls ? 1 : 0.4); }, () => { free(col); free(core); d.off.y = 0; });
      if (kd === 'bloom') { const fl = spr(R.motif, R.c, R.c2); fl.flat = true; fl.p.copy(at); fl.s = 0; tween(life + 0.3, (u, dt) => { fl.s = 2.4 * R.s * E.back(Math.min(1, u * 3)) * (u > 0.8 ? (1 - u) / 0.2 : 1); fl.roll += dt * 0.8; }, () => fl.kill()); }
      if (kd === 'lava') decal(d.pos, 4, 2.2);
      for (let i = 0; i < Math.round(8 * Q.n); i++) after(rand(0, grow + 0.2), () => { const s = spr(R.motif, i % 2 ? R.c : R.c2, R.ac), p0 = at.clone().add(V(rand(-0.4, 0.4), 0, rand(-0.4, 0.4))); toss(s, p0, p0.clone().add(V(rand(-0.9, 0.9), h + rand(0.3, 1.4), rand(-0.9, 0.9))), 0.45, { ease: E.out3, s0: 0.3, s1: 0.05 }); });
    } else if (kd === 'tree') {
      const tk = new THREE.Mesh(P.G.cyl8, H.kit.cel('#7a5634')); tk.add(new THREE.Mesh(P.G.cyl8, H.kit.inkM(0.03))); at.add(tv.copy(d.pos).sub(H.camPos()).setY(0).normalize().multiplyScalar(d.r + 0.25)); tk.position.copy(at); /* thân cây mọc ngay sau lưng đối thủ (không che người) rồi hất tung lên */ tk.scale.setScalar(0.001); scene.add(tk); const crown = [], life = grow + 0.75, hh = h + 1.4;
      for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(P.G.ico, H.kit.cel(i % 2 ? R.c : '#2f8a3a')); m.add(new THREE.Mesh(P.G.ico, H.kit.inkM(0.03))); m.scale.setScalar(0.001); scene.add(m); crown.push({ m, o: i ? V(Math.cos(i * 1.6) * 0.75, rand(-0.25, 0.3), Math.sin(i * 1.6) * 0.75) : V(0, 0.35, 0), r: i ? rand(0.6, 0.8) : 1.0 }); }
      tween(life, u => { const t = u * life, g = E.back(Math.min(1, t / grow)), out = t > life - 0.25 ? (life - t) / 0.25 : 1, y = hh * g * out; tk.scale.set(0.26 * out + 0.001, Math.max(0.01, y), 0.26 * out + 0.001); tk.position.y = H.ground + y / 2; crown.forEach(({ m, o, r }, i) => { const cg = E.back(Math.min(1, Math.max(0, (t - grow * 0.55 - i * 0.03) / 0.22))) * out; m.scale.setScalar(Math.max(0.001, r * cg)); m.position.set(at.x + o.x * cg, H.ground + y + o.y, at.z + o.z * cg); }); d.off.y = 0.9 * E.bell(t / life); }, () => { scene.remove(tk); crown.forEach(x => scene.remove(x.m)); d.off.y = 0; });
      after(grow * 0.8, () => { for (let i = 0; i < Math.round(14 * Q.n); i++) { const s = spr('leaf', i % 2 ? R.c : R.c2, R.ac), p0 = at.clone().add(V(rand(-1, 1), hh + rand(-0.3, 0.6), rand(-1, 1))); toss(s, p0, p0.clone().add(V(rand(-1.6, 1.6), -hh * rand(0.5, 1), rand(-1.6, 1.6))), rand(0.7, 1.1), { ease: E.out, s0: 0.2, s1: 0.1, spin: rand(-6, 6), side: rand(-0.6, 0.6) }); } });
    } else if (kd === 'sprout') { vines(d.pos, '#3f9a46', 3, h, grow + 0.55); after(grow * 0.6, () => { for (let i = 0; i < 4; i++) puff('leaf', d.pos.clone().add(V(Math.cos(i * 1.7) * 0.6, h * (0.4 + i * 0.16), Math.sin(i * 1.7) * 0.6)), R.c, R.c2, 0.42, 0.55, { roll: i * 1.3 }); }); spikeBurst(d.pos, '#8a8478', 5, 0.5, grow + 0.4, 0.75);
    } else if (kd === 'grove') { const n = R.n || 6; for (let i = 0; i < n; i++) after(i * grow / n * 0.8, () => { const a = i / n * TAU, r = i === n - 1 ? 0 : 1.0, p = d.pos.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r)), s = spr(R.motif, i % 2 ? R.c : R.c2, R.ac), big = r ? rand(0.5, 0.8) : 1.3; s.s = 0; H.sfx('tick', { pitch: 0.7 + i * 0.08 }); tween(0.75, u => { const g = E.back(Math.min(1, u * 3.2)) * (u > 0.8 ? (1 - u) / 0.2 : 1); s.s = big * g; s.p.set(p.x, H.ground + big * g * 0.95, p.z); s.sx = 1 + 0.25 * Math.sin(u * 14) * (1 - u); }, () => s.kill()); });
    } else { const n = R.n || (c.cls === 2 ? 7 : c.cls ? 5 : 3); spikeBurst(d.pos, R.motif === 'thorn' ? '#6b8a3a' : R.c, n, h, grow + 0.5, n > 1 ? 0.7 : 0); if (R.k === 'tri') TRI.forEach((col, i) => puff(R.motif, d.pos.clone().add(V((i - 1) * 0.7, h * 0.8, 0)), col, '#ffffff', 0.5, 0.6)); else for (let i = 0; i < 3; i++) puff(R.motif, d.center().add(jit(0.6)), R.c, R.c2, 0.4, 0.5, { roll: rand(0, 6) }); tween(grow + 0.3, u => { d.off.y = 0.35 * E.bell(u); }, () => { d.off.y = 0; }); }
    await wait(grow);
  };
  F.vortex = c => {
    const { d, R, act } = c, life = act + 0.45, h = (1.9 + c.cls * 0.55) * R.s, at = d.pos, rs = [], sp = [], n = Math.round((R.n || 9) * Q.n), wide = R.k === 'big' || R.k === 'steam' ? 1.3 : 1; H.sfx('gust', { pitch: c.pitch }); H.sfx(c.snd, { pitch: c.pitch });
    for (let i = 0; i < (low ? 4 : 7); i++) { const m = mesh('torus', i % 2 ? R.c : R.c2, 0.85); m.rotation.x = Math.PI / 2; m.scale.setScalar(0.001); rs.push(m); }
    for (let i = 0; i < n; i++) { const s = spr(R.motif, colOf(R, i), R.c2); s.s = 0; sp.push(s); }
    tween(life, (u, dt) => { const t = u * life, k = E.out3(Math.min(1, t / (act * 0.5))), out = t > life - 0.3 ? (life - t) / 0.3 : 1;
      rs.forEach((m, i) => { const f = i / rs.length, r = (0.4 + f * 0.95) * k * wide * out + 0.001; m.scale.set(r, r, 1.6 + f * 2); m.position.set(at.x + Math.sin(t * 9 + i) * 0.12 * f, H.ground + 0.15 + f * h * k, at.z + Math.cos(t * 7 + i) * 0.12 * f); m.rotation.z += dt * (7 + i * 1.5); });
      sp.forEach((s, i) => { const f = (i / n + t * 0.9) % 1, a = t * 9 + i * 2.4, r = (0.45 + f * 0.9) * wide; s.p.set(at.x + Math.cos(a) * r, H.ground + 0.2 + f * h, at.z + Math.sin(a) * r); s.s = 0.24 * R.s * k * out * (0.6 + f * 0.6); s.roll = a; });
      d.off.y = 0.55 * (c.cls ? 1 : 0.5) * E.bell(t / life); d.spin = t * 7 * out; }, () => { rs.forEach(free); sp.forEach(s => s.kill()); d.off.y = 0; d.spin = 0; });
    if (R.k === 'storm') [0.45, 0.78].forEach(f => after(act * f, () => bolt(d.head().add(jit(0.3)), '#fff6b0', true)));
    return wait(act);
  };
  F.wave = c => {
    const { a, d, R, act } = c, tidal = R.k === 'tidal', lanes = tidal ? 1 : R.n || 3, dir = dirTo(a, d), L = dir.length(); dir.normalize(); const perp = V(-dir.z, 0, dir.x), start = a.pos.clone().addScaledVector(dir, a.r + 0.2), sp = [], life = act + 0.25, big = (tidal ? 1.9 : 0.85) * R.s * (0.8 + c.cls * 0.2), foam = sparkle(R.c, R.c2, 70);
    H.sfx(c.snd, { pitch: c.pitch }); H.sfx('whoosh', { pitch: c.pitch * 0.7 });
    for (let r = 0; r < (tidal ? 3 : 2); r++) for (let l = 0; l < lanes; l++) { const s = spr(R.motif, r ? R.c2 : colOf(R, l), r ? R.c : R.c2); s.s = 0; sp.push({ s, off: lanes > 1 ? (l / (lanes - 1) - 0.5) * 2.2 : 0, r, ph: rand(0, 6) }); }
    tween(life, (u, dt) => { const t = u * life / act, w = Math.pow(t, 1.7), grow = E.out(Math.min(1, t * 2.5)), out = t > 1 ? Math.max(0, 1 - (t - 1) / (0.25 / act)) : 1;
      sp.forEach(({ s, off, r, ph }) => { const k = big * (1 - r * 0.28) * grow * out; s.p.copy(start).addScaledVector(dir, (L + 0.4) * w - r * 0.45).addScaledVector(perp, off * (0.6 + 0.4 * grow)); s.p.y = H.ground + k * 0.52 + Math.abs(Math.sin(t * 14 + ph)) * 0.12; s.s = k; s.roll = tidal || R.motif === 'crest' ? Math.sin(t * 9 + ph) * 0.12 : R.motif === 'fang' ? Math.PI : Math.sin(t * 12 + ph) * 0.3; });
      foam(tv.copy(start).addScaledVector(dir, (L + 0.4) * w).setY(H.ground + 0.15), u, dt); }, () => sp.forEach(x => x.s.kill()));
    return wait(act);
  };
  F.swarm = c => {
    const { a, d, R, act } = c, n = cnt(c, 20), base = c.sky || a.center().add(V(0, a.h * 0.5, 0)), leadI = Math.round(n * 0.75); H.sfx(c.snd, { pitch: c.pitch });
    for (let i = 0; i < n; i++) { const arrive = i === leadI ? act : act * (0.55 + 0.6 * i / n), dur = act * rand(0.42, 0.55);
      after(Math.max(0, arrive - dur), () => { const s = spr(R.motif, colOf(R, i), R.c2), from = base.clone().add(jit(0.9)), to = i === leadI ? d.center() : d.center().add(jit(0.4)), size = rand(0.13, 0.2) * R.s * (1 + c.cls * 0.12);
        toss(s, from, to, dur, { s0: size, arc: rand(-0.4, 1.6), side: rand(-2.4, 2.4), keep: true, pop: true, trail: i % 4 === 0 && !low ? R.c : null, tw: 0.07, end: p => { if (i % 3 === 0) { pow(p, R.c, 0.3, 0.14); H.sfx('tick', { pitch: 1 + (i % 7) * 0.08, gain: 0.5 }); c.d.shake = 0.04; }
          const exit = p.clone().addScaledVector(tv.copy(p).sub(from).setY(0).normalize(), rand(1.5, 3)).add(V(0, rand(0.5, 2), 0)); toss(s, p.clone(), exit, 0.32, { ease: E.out, s0: size, s1: 0.01, arc: 0.3 }); } }); }); }
    return wait(act);
  };
  F.meteor = c => {
    const { a, d, R, act } = c, to = d.center(), from = c.sky || to.clone().addScaledVector(dirTo(a, d).normalize(), -3.6).add(V(0, 6.2, 0)), s = spr(R.m2 || R.motif, R.c, R.c2), size = 0.62 * R.s * (0.8 + c.cls * 0.25), sh = spr('disc', '#120a1c', '#120a1c', '#120a1c'), g = groundAt(d.pos), smoke = sparkle(R.c, R.c2, 60);
    sh.flat = true; sh.p.copy(g); sh.s = 0.3; sh.a = 0.15; H.sfx('fall', { pitch: c.pitch }); gring(g, R.c, 2.2, 0.6, act, { ease: E.in2, hold: true });
    tween(act, u => { sh.s = 0.3 + 1.0 * E.in2(u); sh.a = 0.15 + 0.4 * u; }, () => sh.kill());
    return toss(s, from, to, act, { ease: E.in2, s0: size * 0.7, s1: size, spin: R.motif === 'moon' ? 2 : 7, trail: R.c, tw: size * 1.1, each: smoke, end: () => { gring(g, R.c2, 0.4, 3.2 * R.s, 0.5); gring(g, R.c, 0.3, 2.2 * R.s, 0.4); } });
  };
  F.roar = c => {
    const { a, R, act } = c, n = R.n || 3, gap = 0.085, snap = R.k === 'snap', from = c.from, rider = R.motif !== 'ring'; H.sfx(snap ? 'snap' : 'roar', { pitch: c.pitch }); if (rider) H.sfx(c.snd, { pitch: c.pitch, gain: 0.7 });
    tween(act, u => { a.sq = 0.1 * Math.sin(u * Math.PI * n); a.lean = 0.14 * E.bell(u); }, () => { a.lean = 0; });
    for (let i = 0; i < n; i++) after(i * gap, () => { const s = spr('ring', i % 2 ? R.c2 : R.c, R.c, i % 2 ? R.c : R.dk), m = rider ? spr(R.motif, R.c, R.c2) : DUMMY, dur = snap ? act * 0.65 : act, s1 = (0.9 + c.cls * 0.3 + i * 0.12) * R.s;
      if (snap) after(act * 0.35 - i * gap * 0.5, go); else go();
      function go() { toss(s, from, c.to, dur, { ease: snap ? E.out3 : E.acc, s0: 0.12, s1, spin: 0.001, each: (p, u) => { s.a = u > 0.85 ? (1 - u) / 0.15 : 1; s.sx = 0.55; if (rider) { m.p.copy(p).add(tv.set(0, Math.sin(u * 12 + i) * 0.25, 0)); m.s = 0.2 + 0.25 * u; m.roll = Math.sin(u * 9 + i) * 0.4; } }, end: () => m.kill() }); } });
    return wait(act);
  };
  F.summon = async c => {
    const { a, R, act } = c, rise = act * 0.4, at = a.pos.clone().addScaledVector(a.dir, -0.7).add(V(0, a.h + 1.3 * R.s, 0)), size = 1.5 * R.s * (0.75 + c.cls * 0.25), life = act + 0.35, tails = R.motif === 'tail', list = [];
    H.sfx('summon', { pitch: c.pitch }); H.sfx(c.snd, { pitch: c.pitch * 0.8 });
    const n = tails ? 9 : 1; for (let i = 0; i < n; i++) { const s = spr(R.motif, colOf(R, i), R.c2); s.s = 0; list.push(s); }
    const halo = spr('sun', R.c2, R.c2, R.c); halo.s = 0; const base = tails ? a.center().addScaledVector(a.dir, -0.35) : at;
    tween(life, (u, dt) => { const t = u * life, out = t > life - 0.3 ? (life - t) / 0.3 : 1; halo.p.copy(base).addScaledVector(a.dir, -0.15); halo.roll += dt * 0.6; halo.s = (tails ? 1.2 : size * 1.25) * E.out3(Math.min(1, t / rise)) * out; halo.a = 0.55;
      list.forEach((s, i) => { const g = E.back(Math.min(1, Math.max(0, (t - i * rise * 0.07) / (rise * 0.6)))) * out; if (tails) { const an = (i - 4) * 0.3 + Math.sin(t * 3 + i) * 0.05; tR.set(1, 0, 0).applyQuaternion(H.camQuat()); s.p.copy(base).addScaledVector(tR, -Math.sin(an) * 0.95 * g).add(tv.set(0, Math.cos(an) * 0.95 * g, 0)); s.roll = an; s.s = 0.75 * g; } else { s.p.copy(at); s.p.y += Math.sin(t * 3) * 0.06; s.s = size * g; s.roll = R.motif === 'sun' || R.motif === 'ring' || R.motif === 'flower' ? t * 0.8 : Math.sin(t * 2) * 0.05; } }); }, () => { list.forEach(s => s.kill()); halo.kill(); });
    gring(a.pos, R.c, 0.4, 2.2, rise + 0.2);
    await wait(rise);
    const sub = { ...c, R: { ...R, form: R.then || 'volley', motif: R.m2 || R.motif, s: 1, arc: 0 }, act: act - rise, sky: tails ? null : at, from: tails ? base.clone().add(V(0, 0.8, 0)) : at.clone() };
    await (F[sub.R.form] || F.volley)(sub);
  };
  F.eclipse = async c => {
    const { d, R, act } = c, to = d.center(), sph = mesh('sphere', '#0a0418', 0.96), rim = mesh('torus', R.c2, 1), life = act + 0.22, r = 1.7 * (0.7 + c.cls * 0.2), moon = spr('disc', R.c2, '#ffffff', R.c), from = to.clone().add(V(-2.2, 2.6, 0)); moon.s = 0; sph.scale.setScalar(0.001); rim.scale.setScalar(0.001); H.sfx('eclipse', { pitch: c.pitch }); H.ui.darken(0.72);
    tween(life, u => { const t = u * life, g = t < act ? E.io(t / act) : 1 - E.in2((t - act) / 0.22); sph.position.copy(to); rim.position.copy(to); rim.quaternion.copy(H.camQuat()); sph.scale.setScalar(Math.max(0.01, r * g)); const rr = r * (1.9 - 0.8 * Math.min(1, t / act)) * (t < act ? 1 : 1 + (t - act) * 9); rim.scale.set(rr, rr, 1.2 + 3 * (1 - g)); rim.material.opacity = t < act ? 1 : Math.max(0, 1 - (t - act) / 0.22);
      moon.p.copy(from).lerp(to, E.io(Math.min(1, t / act))); moon.s = 0.5 * (t < act ? 1 : Math.max(0, 1 - (t - act) / 0.1)); d.shake = 0.03 * g; }, () => { free(sph); free(rim); moon.kill(); d.shake = 0; H.ui.darken(c.cls === 2 ? 0.3 : 0); });
    emit({ at: i => to.clone().add(V(Math.cos(i * 1.3) * 2.2, rand(-0.6, 1.2), Math.sin(i * 1.3) * 2.2)), n: 16, to, life: act * 0.9, color: '#1a0a2a', color2: R.c, size: [0.5, 0.15], blend: 'alpha', alpha: 0.85, arc: 0, wobble: 0.2, stagger: 0.02 });
    await wait(act); gring(to, R.c, 0.3, 2.2, 0.35, { flat: false });
  };
  F.bolt = async c => {
    const { d, R, act } = c, n = R.n || 1, at = groundAt(d.pos), pillar = R.k === 'pillar', line = mesh('cyl', R.c, 0.75); line.scale.setScalar(0.001); H.sfx('beamUp', { pitch: c.pitch * 1.3 });
    gring(at, R.c, 1.6, 0.35, act, { ease: E.in2, hold: true });
    tween(act, u => { const w = 0.02 + 0.02 * Math.sin(u * 50) ** 2; line.scale.set(w, 9, w); line.position.set(at.x, H.ground + 4.5, at.z); line.material.opacity = 0.35 + 0.5 * u; }, () => free(line));
    for (let i = 0; i < n - 1; i++) after(act * (0.45 + 0.5 * i / n), () => { const p = d.pos.clone().add(V(rand(-1.3, 1.3), 0, rand(-1.3, 1.3))); bolt(p, R.c2, true); pow(p.setY(H.ground + 0.2), R.c, 0.5, 0.2); });
    await wait(act);
    if (pillar) { ray(d.pos.clone().setY(H.ground + 9), at, R.c, R.c2, 0.8 * R.s, 0.06, 0.3); for (let i = 0; i < Math.round(10 * Q.n); i++) after(i * 0.03, () => { const s = spr(R.m2 || R.motif, R.c2, '#ffffff'), p0 = at.clone().add(V(rand(-0.5, 0.5), 5, rand(-0.5, 0.5))); toss(s, p0, p0.clone().setY(H.ground + 0.1), 0.3, { ease: E.in2, s0: 0.24, spin: 8 }); }); H.sfx('beam', { pitch: 0.8 }); }
    else { bolt(d.center(), R.motif === 'bolt' || R.motif === 'kite' ? '#fff6b0' : R.c2); puff(R.motif, d.head().add(V(0, 0.5, 0)), R.c, R.c2, 0.6, 0.4, { spin: 6 }); }
  };
  F.dive = async c => {
    const { a, d, R, act } = c, o = a.off.clone(), t = dirTo(a, d), L = t.length(), land = t.clone().multiplyScalar(Math.max(0.2, (L - a.r - d.r) / L)), top = R.k === 'high' ? 5.2 : 3.3, upT = act * 0.42, hang = act * 0.13, down = act - upT - hang, apex = o.clone().lerp(land, 0.55).setY(top);
    H.sfx('leap', { pitch: c.pitch }); gring(a.pos, R.c2, 0.3, 1.3, 0.3);
    await tween(upT, u => { const w = E.out3(u); a.off.copy(o).lerp(apex, w); a.sq = 0.25 * (1 - u); a.lean = -0.25 * w; });
    puff(R.motif, a.center().add(V(0, a.h * 0.4, 0)), R.c, R.c2, 0.7 * R.s, hang + 0.25, { spin: 5 }); H.sfx(c.snd, { pitch: c.pitch * 1.2 });
    await tween(hang, u => { a.off.copy(apex); a.off.y = top + 0.12 * Math.sin(u * Math.PI); a.lean = -0.25 + 0.75 * u; a.sq = -0.08; });
    H.sfx('fall', { pitch: c.pitch * 1.4 }); const tr = trail(R.c, a.h * 0.8), w1 = spr(R.motif, R.c, R.c2), w2 = spr(R.motif, R.c2, R.c), fin = land.clone().setY(0.25), dv = fin.clone().sub(apex); w1.s = w2.s = 0;
    await tween(down, u => { const w = E.in3(u); a.off.copy(apex).lerp(fin, w); a.lean = 0.5; a.sq = 0.3 * Math.sin(u * Math.PI * 0.9); const ce = a.center(); tr.push(ce); [w1, w2].forEach((s, i) => { s.p.copy(ce).addScaledVector(sideV(), (i ? 1 : -1) * (a.r + 0.25)); s.p.y += 0.3; s.s = 0.42 * R.s * (0.6 + 0.4 * w); aim(s, dv); }); }, () => { tr.fade(); w1.kill(); w2.kill(); gring(groundAt(d.pos), R.c, 0.3, 2.4, 0.4); });
  };
  F.flurry = async c => {
    const { a, d, R, act } = c, n = cnt(c, 4), near = a.off.lengthSq() > 0.6, fistK = R.motif === 'fist';
    if (!near) { H.sfx('swish', { pitch: c.pitch }); await dashTo(a, d, act * 0.3, 0.35); } const T = near ? act : act * 0.7, st = T / n, base = a.off.clone();
    for (let i = 0; i < n; i++) { const last = i === n - 1, sd = (i % 2 ? 1 : -1), at = d.center().add(last ? V() : V(rand(-0.25, 0.25), rand(-0.3, 0.3), 0));
      tween(st, u => { a.off.copy(base).addScaledVector(sideV().setY(0), sd * 0.4 * E.bell(u)); a.sq = 0.12 * Math.sin(u * Math.PI); a.lean = 0.2; });
      if (fistK) { const s = spr('fist', R.c, R.c2), from = a.mouth(); s.s = 0; tween(st, u => { s.p.copy(from).lerp(at, E.in2(u)); s.s = 0.4 * R.s * Math.min(1, u * 4); }, () => s.kill()); }
      else { cut(at, R.c, R.c2, (0.8 + c.cls * 0.2) * R.s * (last ? 1.35 : 1), -1.4 + i * 1.9, st + 0.16, st * 0.3, sd * 1.6); if (R.motif !== 'crest') for (let j = 0; j < 2; j++) { const s = spr(R.motif, R.c, R.c2), p0 = at.clone(); toss(s, p0, p0.clone().add(jit(1.1)), 0.4, { ease: E.out3, s0: 0.24, s1: 0.04, spin: rand(-8, 8) }); } }
      await wait(st);
      if (!last) { pow(at, R.c, 0.42, 0.16); H.sfx('tick', { pitch: 0.9 + i * 0.12 }); d.shake = 0.05; d.sq = -0.06; }
    }
    d.shake = 0;
  };
  F.orbit = c => {
    const { d, R, act } = c, n = cnt(c, 7), sp = [], ce = d.center(), inT = act * 0.35, r0 = 1.25 * (R.s > 1.3 ? 1.25 : 1) + c.cls * 0.15; H.sfx(c.snd, { pitch: c.pitch });
    for (let i = 0; i < n; i++) { const s = spr(R.motif, colOf(R, i), R.c2); s.s = 0; sp.push(s); after(i * inT / n, () => H.sfx('tick', { pitch: 0.8 + i * (0.7 / n), gain: 0.5 })); }
    after(act * 0.62, () => H.sfx('whoosh', { pitch: 1.4 }));
    return tween(act, u => { const t = u * act, sq = E.in3(Math.max(0, (t - inT) / (act - inT))), r = r0 * (1 - sq) + 0.12, an = t * 3 + sq * 9;
      sp.forEach((s, i) => { const g = E.back(Math.min(1, Math.max(0, (t - i * inT / n) / 0.14))), b = an + i / n * TAU; s.p.set(ce.x + Math.cos(b) * r, ce.y + Math.sin(b * 2 + i) * 0.3 * (1 - sq) + (i % 2 ? 0.25 : -0.25) * (1 - sq), ce.z + Math.sin(b) * r); s.s = 0.3 * R.s * g * (1 - sq * 0.5); s.roll = b; }); d.sq = -0.1 * sq; d.shake = 0.04 * sq; }, () => { sp.forEach(s => s.kill()); d.shake = 0; });
  };
  F.burst = async c => {
    const { a, d, R, act } = c, n = cnt(c, 10), swell = act * 0.4, L = dirTo(a, d).length(), ce = a.center(); H.sfx('beamUp', { pitch: c.pitch * 0.8 });
    await tween(swell, u => { a.sq = -0.2 * E.out(u); a.shake = 0.05 * u; });
    H.sfx('burstOut', { pitch: c.pitch }); H.sfx(c.snd, { pitch: c.pitch }); a.shake = 0; const fly = act - swell, g = groundAt(a.pos);
    tween(0.3, u => { a.sq = 0.3 * Math.sin(u * Math.PI); });
    gring(g, R.c, 0.3, L + 0.6, fly + 0.1, { ease: E.out }); gring(g, R.c2, 0.2, L * 0.75, fly + 0.1, { ease: E.out });
    if (R.motif === 'ring') for (let i = 0; i < (R.n || 3); i++) after(i * 0.06, () => gring(ce, i % 2 ? R.c2 : R.c, 0.3, (L + 0.4) * (1 - i * 0.12), fly + 0.12, { flat: false, ease: E.out }));
    else for (let i = 0; i < n; i++) { const s = spr(R.motif, colOf(R, i), R.c2), lead = i === 0, an = i / n * TAU, to = lead ? d.center() : ce.clone().add(V(Math.cos(an) * (L + 0.3), rand(-0.2, 1.4), Math.sin(an) * (L + 0.3))); toss(s, ce.clone(), to, lead ? fly : fly * rand(1, 1.3), { ease: E.out, s0: 0.16 * R.s, s1: (lead ? 0.5 : 0.36) * R.s * (0.8 + c.cls * 0.2), arc: rand(0, 0.6), spin: rand(-6, 6) }); }
    await wait(fly);
  };
  F.lash = c => {
    const { a, R, act } = c, n = R.n || 1, kd = R.k || '', dragon = kd === 'dragon', bow = kd === 'rainbow', from = dragon ? a.pos.clone().addScaledVector(a.dir, -1.5).add(V(0, 5, 0)) : c.from, to = c.to, ax = to.clone().sub(from), side = H.side(), hold = bow ? 0.5 : 0.2; H.sfx(c.snd, { pitch: c.pitch }); H.sfx('whoosh', { pitch: c.pitch * (dragon ? 0.6 : 1.2) });
    for (let i = 0; i < n; i++) { const col = bow ? RAINBOW[(i * 3) % 7] : colOf(R, i), head = spr(dragon ? 'fang' : R.motif, col, R.c2), w = (dragon ? 0.7 : bow ? 0.3 : 0.12) * R.s * (dragon ? 1 : c.big), tr = trail(col, w, true), tr2 = dragon || bow ? trail(bow ? RAINBOW[(i * 3 + 2) % 7] : R.c2, w * 0.45, true) : null, ph = i * 2.1 + rand(0, 1), amp = kd === 'snake' ? 0.9 : dragon ? 1.7 : 0.45, waves = kd === 'snake' ? 3 : dragon ? 2.6 : 2, prev = from.clone(), spread = n > 1 ? (i / (n - 1) - 0.5) * 2 : 0;
      head.s = 0; head.p.copy(from); tween(act, u => { const e = E.acc(u), fall = 1 - e; prev.copy(head.p); head.p.copy(from).addScaledVector(ax, e);
        if (dragon) { const an = e * TAU * waves + ph; head.p.addScaledVector(side, Math.cos(an) * amp * fall).add(tv.set(0, Math.sin(an) * amp * 0.7 * fall, 0)); }
        else { head.p.addScaledVector(side, (Math.sin(e * Math.PI * waves + ph) * amp + spread * 1.5 * Math.sin(e * Math.PI)) * (bow ? 0.3 : 1) * Math.min(1, fall * 3)); head.p.y += Math.sin(e * Math.PI) * (bow ? 2.4 + i * 0.5 : 0.35 + Math.abs(spread) * 0.6) + Math.cos(e * Math.PI * waves + ph) * amp * 0.35 * fall * (bow ? 0 : 1); }
        head.s = (dragon ? 0.75 : 0.26) * R.s * Math.min(1, u * 8) * (dragon ? 1 : c.big); if (u > 0) aim(head, tv.copy(head.p).sub(prev)); tr.push(head.p); tr2?.push(tv2.copy(head.p).setY(head.p.y - w * 0.7)); },
      () => { head.kill(); after(hold, () => { tr.fade(0.3); tr2?.fade(0.3); }); }); }
    return wait(act);
  };

  /* ---------- 6 dạng hỗ trợ (kết thúc sau c.act giây; c.lock() là nhịp hiệu lực: lá chắn / hào quang hiện lên) ---------- */
  const S = {};
  S.ward = async c => {
    const { a, R, act } = c, n = 6, sp = [], ce = a.center(), r0 = a.r * 2.2 + 0.5; H.sfx('shieldUp');
    for (let i = 0; i < n; i++) { const s = spr(R.motif, colOf(R, i), R.c2); s.s = 0; sp.push(s); }
    gring(a.pos, R.c, 1.8, 0.6, act * 0.7, { ease: E.in2, hold: true });
    await tween(act * 0.7, u => { const sq = E.in3(u), r = r0 * (1 - sq * 0.55), an = u * 5; sp.forEach((s, i) => { const g = E.back(Math.min(1, Math.max(0, (u - i * 0.04) / 0.2))), b = an + i / n * TAU; s.p.set(ce.x + Math.cos(b) * r, ce.y + Math.sin(b * 2 + i) * 0.25, ce.z + Math.sin(b) * r); s.s = 0.34 * R.s * g; s.roll = Math.sin(u * 6 + i) * 0.3; }); a.sq = -0.12 * u; });
    sp.forEach(s => s.kill()); c.lock(); H.sfx('shield'); pow(ce, R.c2, 0.9, 0.24, R.c); gring(ce, R.c, 0.4, a.r * 2.4 + 0.8, 0.35, { flat: false }); tween(0.25, u => { a.sq = 0.14 * Math.sin(u * Math.PI); });
    await wait(act * 0.3);
  };
  S.veil = async c => {
    const { a, R, act } = c, n = 7, ce = a.center(); H.sfx('veil');
    for (let i = 0; i < n; i++) after(i * act * 0.07, () => { const s = spr(R.motif, i % 2 ? R.c : R.c2, R.c), an = i / n * TAU, life = act * 0.75; s.s = 0; tween(life, u => { const b = an + u * 5, r = (a.r * 1.5 + 0.35) * (0.6 + 0.4 * Math.sin(u * Math.PI)); s.p.set(ce.x + Math.cos(b) * r, a.pos.y + 0.1 + u * (a.h + 0.5), ce.z + Math.sin(b) * r); s.s = 0.42 * R.s * E.bell(u); s.roll = b; s.a = 0.9; }, () => s.kill()); });
    await tween(act * 0.7, u => { a.off.copy(sideV().setY(0)).multiplyScalar(Math.sin(u * Math.PI * 4) * 0.22 * (1 - u)); a.sq = 0.06 * Math.sin(u * Math.PI * 4); }, () => a.off.set(0, 0, 0));
    c.lock(); H.sfx('shield', { pitch: 1.3 }); gring(a.pos, R.c2, 0.3, 1.8, 0.35); await wait(act * 0.3);
  };
  S.aura = async c => {
    const { a, R, act } = c, n = 6; H.sfx('power', { gain: 0.8 });
    for (let i = 0; i < 2; i++) after(i * act * 0.2, () => gring(a.pos, i ? R.c2 : R.c, 0.4, 1.9, 0.45));
    for (let i = 0; i < n; i++) after(i * act * 0.08, () => { const s = spr(R.motif, colOf(R, i), R.c2), an = i / n * TAU, life = act * 0.7; s.s = 0; tween(life, u => { const b = an + u * 7, r = (a.r + 0.45) * (1 - u * 0.35); s.p.set(a.pos.x + Math.cos(b) * r, a.pos.y + 0.1 + E.in2(u) * (a.h + 1.1), a.pos.z + Math.sin(b) * r); s.s = 0.3 * R.s * E.bell(Math.min(1, u * 1.15)); s.roll = R.motif === 'ring' ? 0 : Math.sin(u * 8) * 0.3; }, () => s.kill()); });
    emit({ at: a.pos, n: 24, box: 0.6, flat: true, dir: [0, 1, 0], spread: 0.12, speed: [2, 4.2], life: [0.4, 0.7], color: R.c2, color2: R.c, size: [0.2, 0.04], shape: 1, blend: 'alpha' });
    await tween(act * 0.7, u => { a.sq = u < 0.5 ? -0.14 * E.out(u * 2) : 0.2 * Math.sin((u - 0.5) * 2 * Math.PI); a.off.y = u > 0.5 ? 0.3 * Math.sin((u - 0.5) * 2 * Math.PI) : 0; }, () => { a.off.y = 0; });
    c.lock(); H.sfx('buffHit'); pow(a.head().add(V(0, 0.45, 0)), R.c2, 0.7, 0.26, R.c); await wait(act * 0.3);
  };
  S.chant = async c => {
    const { a, R, act } = c, beats = 2, bt = act * 0.35, ce = a.center();
    for (let b = 0; b < beats; b++) { H.sfx('drum', { pitch: 1 + b * 0.25 }); gring(ce, b ? R.c2 : R.c, 0.3, 2.2, 0.4, { flat: false }); gring(a.pos, R.c, 0.3, 2.0, 0.4);
      for (let i = 0; i < 3; i++) { const s = spr(R.motif, colOf(R, i + b), R.c2), an = (i + b * 0.5) / 3 * TAU, p0 = ce.clone(); toss(s, p0, p0.clone().add(V(Math.cos(an) * 1.5, rand(0.8, 1.8), Math.sin(an) * 1.5)), 0.5, { ease: E.out3, s0: 0.2, s1: 0.4 * R.s, spin: R.motif === 'sun' ? 5 : 0.001, each: (p, u) => { s.a = u > 0.7 ? (1 - u) / 0.3 : 1; } }); }
      await tween(bt, u => { a.sq = 0.2 * Math.sin(u * Math.PI) * (1 - u * 0.3) - 0.06; }); }
    c.lock(); H.sfx('buffHit'); pow(a.head().add(V(0, 0.45, 0)), R.c2, 0.7, 0.26, R.c); await wait(act - bt * beats);
  };
  S.bloom = async c => {
    const { a, R, act } = c, top = a.head().add(V(0, 1.0, 0)), big = spr(R.k === 'full' ? 'disc' : R.motif, R.c, R.c2), n = Math.round(8 * Q.n), life = act + 0.2, col = mesh('cyl', R.c2, 0.0, true); big.s = 0; col.scale.setScalar(0.001); H.sfx('healUp');
    tween(life, (u, dt) => { const t = u * life; big.p.copy(top); big.s = 0.62 * R.s * (t < act * 0.35 ? E.back(t / (act * 0.35)) : 1 - E.in3(Math.max(0, (t - act * 0.75) / (life - act * 0.75)))); if (R.motif !== 'moon' && R.motif !== 'heart' && R.motif !== 'drop') big.roll += dt * 1.2; const k = E.bell(t / life); col.scale.set(a.r * 1.3 * k + 0.01, 4, a.r * 1.3 * k + 0.01); col.position.set(a.pos.x, a.pos.y + 2, a.pos.z); col.material.opacity = 0.3 * k; }, () => { big.kill(); free(col); });
    gring(a.pos, R.c, 0.3, 1.7, act * 0.8);
    for (let i = 0; i < n; i++) after(act * 0.3 + i * act * 0.05, () => { const s = spr(i % 2 ? 'plus' : R.motif, i % 2 ? '#8dff9e' : colOf(R, i), i % 2 ? '#eaffea' : R.c2), p0 = top.clone().add(V(rand(-0.5, 0.5), 0, rand(-0.5, 0.5))); toss(s, p0, a.center().add(jit(0.3)), 0.4, { ease: E.io, s0: 0.2, s1: 0.08, side: rand(-0.5, 0.5), spin: 0.001 }); });
    await wait(act * 0.72); c.lock(); H.sfx('heal'); tween(0.3, u => { a.sq = 0.12 * Math.sin(u * Math.PI); }); emit({ at: a.center(), n: 14, radial: true, up: 0.6, color: '#eaffea', color2: '#5fd068', speed: [1, 2.4], drag: 2, life: [0.4, 0.7], size: [0.16, 0.03], shape: 1, blend: 'alpha' });
    await wait(act * 0.28);
  };
  S.rest = async c => {
    const { a, R, act } = c, n = 3; H.sfx('healUp', { pitch: 0.8 });
    if (R.k === 'moult') { const g = spr(R.motif, R.c, R.c2), p0 = a.center(); toss(g, p0, p0.clone().addScaledVector(a.dir, -1.3).add(V(0, 0.4, 0)), act, { ease: E.out3, s0: 0.7, s1: 0.5, spin: 0.001, each: (p, u) => { g.a = 1 - u; } }); }
    for (let i = 0; i < n; i++) after(i * act * 0.2, () => { const s = spr(R.motif, R.c, R.c2), p0 = a.head().add(V(0.2, 0.2, 0)); s.s = 0; H.sfx('tick', { pitch: 1.2 + i * 0.2, gain: 0.4 }); tween(act * 0.55, u => { s.p.copy(p0); s.p.x += Math.sin(u * 5 + i) * 0.18 + u * 0.3; s.p.y += u * 1.2; s.s = (0.2 + i * 0.07) * R.s * E.bell(Math.min(1, u * 1.2)); s.roll = Math.sin(u * 4) * 0.25; }, () => s.kill()); });
    await tween(act * 0.72, u => { a.sq = -0.2 * E.bell(u) + 0.03 * Math.sin(u * 12); if (R.k === 'flip') a.tilt = 0.25 * Math.sin(u * Math.PI * 2); }, () => { a.tilt = 0; });
    c.lock(); H.sfx('heal'); tween(0.3, u => { a.sq = 0.16 * Math.sin(u * Math.PI); }); gring(a.pos, '#8dff9e', 0.3, 1.6, 0.4); pow(a.head().add(V(0, 0.4, 0)), '#eaffea', 0.55, 0.24, '#8dff9e');
    await wait(act * 0.28);
  };

  /* ---------- nét riêng (twist) ---------- */
  const twist = {
    /** Ra đòn trước: vệt lao chớp nhoáng cắt ngang trước khi lấy đà. */
    first(a) { H.sfx('firstDash'); const o = a.pos.clone().add(V(0, a.h * 0.5, 0)), tr = trail('#ffffff', a.h * 0.55), s = spr('spark', '#fff6b0', '#ffffff'); s.p.copy(a.head()).add(V(0, 0.4, 0)); s.s = 0;
      emit({ at: () => a.center().add(jit(0.5)), n: 12, dir: a.dir.clone().negate(), spread: 0.04, speed: [8, 13], life: [0.14, 0.24], color: '#ffffff', size: [0.4, 0.1], shape: 5, blend: 'alpha' });
      return tween(0.16, u => { const w = Math.sin(u * Math.PI); a.off.copy(a.dir).multiplyScalar(0.8 * w); a.sq = 0.18 * w; tr.push(tv.copy(o).add(a.off)); s.s = 0.45 * w; s.roll += 0.4; }, () => { tr.fade(); s.kill(); a.off.set(0, 0, 0); }); },
    /** Liều mạng (thể lực dưới nửa): lửa đỏ bốc quanh người, tim đập. */
    lowhp(a, dur) { H.sfx('heartbeat'); gring(a.pos, '#ff3a2a', 0.4, 1.8, dur + 0.2); for (let i = 0; i < 5; i++) after(i * dur * 0.15, () => { const s = spr('flame', '#ff3a2a', '#ffd23e'), an = i * 1.3; s.s = 0; tween(0.5, u => { s.p.set(a.pos.x + Math.cos(an) * a.r * 1.2, a.pos.y + u * (a.h + 0.6), a.pos.z + Math.sin(an) * a.r * 1.2); s.s = 0.42 * E.bell(u); }, () => s.kill()); }); },
    /** Xuyên thủ: lá chắn nứt (nếu có) rồi một đường xuyên thẳng qua người. */
    pierce(a, d, c, guarded) { const ce = d.center(), dir = dirTo(a, d).normalize(); if (guarded) { H.sfx('crack'); for (let i = 0; i < 3; i++) puff('bolt', ce.clone().add(jit(d.r)), '#ffffff', '#e8fbff', 0.5, 0.35, { roll: rand(0, 6) }); emit({ at: ce, n: 22, radial: true, color: '#e8fbff', color2: '#9ad8ff', speed: [3, 6], drag: 2, gravity: 5, life: [0.4, 0.7], size: [0.16, 0.06], shape: 4, blend: 'alpha' }); }
      H.sfx('pierce'); ray(ce.clone().addScaledVector(dir, -1.6), ce.clone().addScaledVector(dir, 3.2), '#ffffff', c, 0.05, 0.07, 0.1); const s = spr('thorn', '#ffffff', c); toss(s, ce.clone(), ce.clone().addScaledVector(dir, 3.2), 0.16, { ease: E.out3, s0: 0.5, s1: 0.2 }); },
    /** Hút thể lực: ba dải sinh khí uốn lượn chảy từ đối thủ về người đánh. */
    drain(a, d) { H.sfx('drain'); const from = d.center(), to = a.center(), side = H.side();
      for (let i = 0; i < 3; i++) { const tr = trail(i === 1 ? '#eaffea' : '#5fd068', 0.16, true), s = spr('plus', '#8dff9e', '#eaffea'), ph = i * 2.1; s.s = 0; s.p.copy(from); tween(0.5, u => { const e = E.io(Math.max(0, Math.min(1, u * 1.15 - i * 0.06))); s.p.copy(from).lerp(to, e).addScaledVector(side, Math.sin(e * Math.PI * 2 + ph) * 0.5 * (1 - e)); s.p.y += Math.sin(e * Math.PI) * (0.5 + i * 0.3); s.s = 0.2 * E.bell(e); tr.push(s.p); }, () => { s.kill(); tr.fade(0.3); }); }
      after(0.45, () => { gring(a.pos, '#8dff9e', 0.3, 1.5, 0.35); a.sq = 0.12; }); return wait(OTHER_BEATS.twist); },
    /** Phản lực: luồng dội ngược đỏ cam đập vào chính người đánh. */
    recoil(a) { H.sfx('recoil'); const ce = a.center(); pow(ce, '#ff7a2a', 0.8, 0.24, '#ffe0a0'); gring(ce, '#ff5a2a', 0.3, 1.5, 0.3, { flat: false }); const back = a.dir.clone().multiplyScalar(-0.3); return tween(0.3, u => { const k = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75; a.off.copy(back).multiplyScalar(k); a.sq = -0.14 * k; a.shake = 0.06 * (1 - u); }, () => { a.off.set(0, 0, 0); a.shake = 0; }); },
    /** Giáp gai phản đòn: gai đỏ bắn ngược về người đánh. */
    thorns(a, d) { H.sfx('pluck', { pitch: 1.4 }); for (let i = 0; i < 4; i++) { const s = spr('thorn', '#ff5a5a', '#ffd0d0'); toss(s, d.center().add(jit(0.3)), a.center().add(jit(0.2)), 0.2 + i * 0.02, { s0: 0.3, trail: '#ff5a5a', tw: 0.08 }); } after(0.2, () => { pow(a.center(), '#ff5a5a', 0.6, 0.2); a.shake = 0.06; after(0.2, () => { a.shake = 0; }); }); },
    /** Giũ sạch: vòng trắng xanh quét từ chân lên đầu, bụi bẩn tối màu bắn ra. */
    cleanse(a) { H.sfx('cleanse'); const s = spr('ring', '#ffffff', '#ffffff', '#8fe6ff'); s.flat = true; s.s = 0; emit({ at: a.center(), n: 12, radial: true, blend: 'alpha', color: '#2a1a3a', color2: '#000000', alpha: 0.7, speed: [1.5, 3], drag: 2, life: [0.4, 0.6], size: [0.3, 0.1] });
      for (let i = 0; i < 4; i++) after(0.1 + i * 0.07, () => puff('spark', a.center().add(jit(a.r)), '#ffffff', '#c8f2ff', 0.34, 0.3, { spin: 6 }));
      return tween(0.45, u => { s.p.set(a.pos.x, a.pos.y + 0.05 + E.io(u) * (a.h + 0.2), a.pos.z); s.s = (a.r * 1.5 + 0.3) * (0.8 + 0.3 * Math.sin(u * Math.PI)); s.a = 1 - u * u; }, () => s.kill()); },
    /** Chí mạng: sao bốn cánh dài xé ngang + vòng đôi. */
    crit(at, c) { const s = spr('spark', '#fff2a0', '#ffffff', '#ff5a2a'), s2 = spr('spark', '#ffffff', '#ffffff', c); s.p.copy(at); s2.p.copy(at); s2.roll = Math.PI / 4; s.s = s2.s = 0; tween(0.34, u => { const k = u < 0.2 ? E.back(u / 0.2) : 1 - E.in2((u - 0.2) / 0.8); s.s = 1.25 * k; s.sx = 0.5; s2.s = 0.7 * k; s.roll = 0.2 + u * 0.3; }, () => { s.kill(); s2.kill(); }); gring(at, '#ff5a2a', 0.3, 1.9, 0.3, { flat: false }); },
  };

  /* ---------- gây trạng thái · trạng thái cuối lượt · ra sân · gục ---------- */
  function statusBurst(s, st) {
    const g = groundAt(s.pos);
    if (st === 'root') { H.sfx('stRoot'); vines(s.pos, '#3f9a46', 5, s.h * 0.8, 0.9); gring(g, '#4fd860', 1.8, 0.6, 0.35, { ease: E.in2, hold: true }); for (let i = 0; i < 5; i++) after(0.2 + i * 0.04, () => puff('thorn', V(s.pos.x + Math.cos(i * 1.26) * 0.8, H.ground + 0.3, s.pos.z + Math.sin(i * 1.26) * 0.8), '#6b8a3a', '#d4ff7a', 0.4, 0.5)); tween(0.4, u => { s.sq = -0.12 * E.bell(u); }); }
    if (st === 'soak') { H.sfx('stSoak'); const d = spr('drop', '#38a8ff', '#c8f2ff'), top = s.head().add(V(0, 2.2, 0)); toss(d, top, s.head(), 0.28, { ease: E.in2, s0: 0.6, spin: 0.001, end: p => { H.sfx('splash'); gring(g, '#38a8ff', 0.3, 1.6, 0.4); emit({ at: p, n: 26, radial: true, up: 0.6, color: '#9fdcff', color2: '#e8f8ff', speed: [2, 4.5], gravity: 9, life: [0.4, 0.7], size: [0.14, 0.06], shape: 4, blend: 'alpha' }); s.sq = -0.14; for (let i = 0; i < 4; i++) puff('drop', p.clone().add(jit(0.5)), '#8fd8ff', '#ffffff', 0.24, 0.35, { rise: -1.5 }); } }); }
    if (st === 'daze') { H.sfx('stDaze'); for (let i = 0; i < 3; i++) gring(s.head(), '#ffe45a', 0.2, 0.9, 0.45, { y: s.h + 0.2 + i * 0.12 }); puff('star', s.head().add(V(0, 0.5, 0)), '#ffe45a', '#ffffff', 0.5, 0.45, { spin: 9 }); tween(0.5, u => { s.tilt = 0.14 * Math.sin(u * Math.PI * 3) * (1 - u); }, () => { s.tilt = 0; }); }
    if (st === 'blind') { H.sfx('stBlind'); const e = spr('eye', '#1a0a2e', '#9a5cff', '#e6d4ff'), p = s.head(); e.s = 0; tween(0.55, u => { e.p.copy(p); e.s = 0.7 * (u < 0.3 ? E.back(u / 0.3) : 1); e.sy = u < 0.45 ? 1 : Math.max(0.06, 1 - (u - 0.45) / 0.3); e.a = u > 0.85 ? (1 - u) / 0.15 : 1; }, () => e.kill()); emit({ at: p, n: 18, radial: true, blend: 'alpha', color: '#140822', color2: '#000000', alpha: 0.85, speed: [0.6, 1.6], drag: 2, life: [0.6, 1.0], size: [0.5, 1.1] }); }
    if (st === 'burn') { H.sfx('stBurn'); for (let i = 0; i < 6; i++) after(i * 0.04, () => { const f = spr('flame', i % 2 ? '#ff6a1a' : '#ffc21e', '#fff2a0'), an = i * 1.05; f.s = 0; tween(0.5, u => { f.p.set(s.pos.x + Math.cos(an) * s.r, s.pos.y + 0.1 + u * (s.h + 0.3), s.pos.z + Math.sin(an) * s.r); f.s = 0.5 * E.bell(u); f.sx = 1 + 0.2 * Math.sin(u * 20); }, () => f.kill()); }); gring(g, '#ff6a1a', 0.3, 1.5, 0.4); s.shake = 0.05; after(0.3, () => { s.shake = 0; }); }
  }
  /** Nhịp trạng thái cuối lượt: bỏng liếm lên người, hồi dần toả dấu cộng. */
  function tick(s, kind) {
    if (kind === 'burn') { H.sfx('burnTick'); for (let i = 0; i < 3; i++) { const f = spr('flame', '#ff6a1a', '#ffd23e'), an = i * 2.1 + rand(0, 1); f.s = 0; tween(0.42, u => { f.p.set(s.pos.x + Math.cos(an) * s.r * 0.9, s.pos.y + 0.2 + u * s.h, s.pos.z + Math.sin(an) * s.r * 0.9); f.s = 0.42 * E.bell(u); }, () => f.kill()); } tween(0.3, u => { s.shake = 0.05 * (1 - u); s.sq = -0.08 * E.bell(u); }, () => { s.shake = 0; }); }
    if (kind === 'regen') { H.sfx('regenTick'); gring(s.pos, '#8dff9e', 0.3, 1.4, 0.4); for (let i = 0; i < 3; i++) after(i * 0.08, () => puff('plus', s.center().add(jit(s.r)), '#8dff9e', '#eaffea', 0.26, 0.42, { rise: 1.4 })); tween(0.3, u => { s.sq = 0.08 * E.bell(u); }); }
    return wait(0.3);
  }
  /** Ra sân (≈1 giây): vòng trống đồng mở ra → cột sáng → rơi xuống, lún người, nảy lên → vòng bụi + hoạ tiết của loài toả ra. */
  async function enter(a, el, motif) {
    const Pl = PALETTE[el], g = groundAt(a.pos); H.sfx('enter'); rune(a.pos, Pl.c, 1.4, 0.9, 0.3); gring(g, Pl.c, 2.2, 0.5, 0.45, { ease: E.in2, hold: true }); a.k = 0;
    await wait(0.4); ray(a.pos.clone().setY(H.ground + 8), g, Pl.c, Pl.c2, 0.5, 0.1, 0.12);
    await tween(0.2, u => { a.k = Math.max(0.05, u); a.off.y = 2.4 * (1 - E.in2(u)); a.sq = 0.3; });
    a.off.y = 0; H.cam.shake(0.3); gring(g, Pl.c2, 0.4, 2.6, 0.45); gring(g, Pl.c, 0.3, 1.8, 0.35); debris(a.center(), { motif: motif || 'spark', c: Pl.c, c2: Pl.c2, k: '' }, low ? 4 : 8, 1);
    emit({ at: a.pos, n: 18, radial: true, flat: true, up: 0.3, color: '#e8e0d0', color2: Pl.c, alpha: 0.7, speed: [1.5, 3.5], drag: 2.5, life: [0.4, 0.8], size: [0.3, 0.7], blend: 'alpha' });
    await tween(0.4, u => { a.k = 1; a.sq = -0.3 * Math.cos(u * Math.PI * 2.5) * (1 - u); });
    a.sq = 0;
  }
  /** Gục (≈1,2 giây): khựng, lảo đảo, đổ xuống rồi tan thành đốm sáng bay lên. */
  async function faint(a, el) {
    const Pl = PALETTE[el]; H.sfx('faint'); let acc = 0;
    await tween(0.3, u => { a.shake = 0.08 * (1 - u); a.tilt = 0.08 * Math.sin(u * Math.PI * 3); a.sq = -0.1 * u; });
    a.shake = 0; gring(groundAt(a.pos), Pl.c, 0.4, 2.0, 0.6);
    await tween(0.9, (u, dt) => { const w = E.in2(u); a.tilt = 0.55 * E.out(Math.min(1, u * 2)); a.k = Math.max(0.02, 1 - E.in3(u)); a.off.y = -0.25 * w; acc += dt * 16 * Q.n; while (acc >= 1) { acc -= 1; puff(Math.random() < 0.5 ? 'spark' : 'disc', a.center().add(jit(0.45)), Pl.c2, Pl.c, rand(0.1, 0.2), 0.6, { rise: rand(1, 2.2) }); } });
  }

  /* ---------- hào quang kéo dài (nét riêng của chiêu hỗ trợ) ---------- */
  const AURA = {
    thorns: () => Array.from({ length: 8 }, () => spr('thorn', '#ff5a5a', '#ffd0d0')), wall: () => Array.from({ length: 6 }, () => spr('scale', '#ffcf5a', '#fff6c0', '#7a5a1a')),
    haste: () => [spr('crest', '#8fe6ff', '#ffffff'), spr('crest', '#ffffff', '#ffffff', '#8fe6ff'), spr('crest', '#8fe6ff', '#ffffff')], focus: () => [spr('ring', '#ff5a4a', '#ff5a4a'), spr('spark', '#fff2a0', '#ffffff', '#ff5a4a')],
    regen: () => [spr('ring', '#8dff9e', '#8dff9e'), spr('plus', '#8dff9e', '#eaffea'), spr('plus', '#8dff9e', '#eaffea')],
  };
  function syncAuras(s, f, dt, t) {
    const L = s.loops || (s.loops = {}), on = !s.mute && f.hp > 0;
    for (const k in AURA) { const key = 'a_' + k, want = on && (k === 'thorns' ? f.guard > 0 && f.thorns : k === 'wall' ? f.guard > 0 && f.wall : k === 'haste' ? f.haste > 0 : k === 'focus' ? f.focus : f.regen > 0);
      if (want && !L[key]) { L[key] = AURA[k](); L[key].t = 0; L[key].forEach(x => { x.s = 0; }); } if (!want && L[key]) { L[key].forEach(x => x.kill()); L[key] = null; } if (L[key]) L[key].t = Math.min(1, L[key].t + dt * 4); }
    const c = s.center(), r = s.r * 1.3 + 0.15;
    if (L.a_thorns) { const g = E.back(L.a_thorns.t); L.a_thorns.forEach((x, i) => { const a = i / 8 * TAU + t * 0.5, y = Math.sin(i * 2.4) * 0.5, w = Math.sqrt(1 - y * y * 0.6); tv.set(Math.cos(a) * w, y, Math.sin(a) * w); x.p.copy(c).addScaledVector(tv, r * (1.02 + 0.04 * Math.sin(t * 5 + i))); aim(x, tv); x.s = 0.3 * g; }); }
    if (L.a_wall) { const g = E.back(L.a_wall.t); L.a_wall.forEach((x, i) => { const a = i / 6 * TAU - t * 0.35; x.p.set(c.x + Math.cos(a) * r * 1.05, c.y + (i % 2 ? 0.28 : -0.28) * s.h * 0.5, c.z + Math.sin(a) * r * 1.05); x.s = 0.4 * g; x.a = 0.92; }); }
    if (L.a_haste) L.a_haste.forEach((x, i) => { const a = t * 9 + i * TAU / 3; x.p.set(s.pos.x + s.off.x + Math.cos(a) * r, s.pos.y + 0.25 + i * 0.3, s.pos.z + s.off.z + Math.sin(a) * r); x.s = 0.4 * L.a_haste.t; tv.set(-Math.sin(a), 0.1, Math.cos(a)); aim(x, tv); x.sy = 0.6; });
    if (L.a_focus) { const hd = s.head(); hd.y += 0.55; const [ringS, sp] = L.a_focus, g = E.back(L.a_focus.t); ringS.p.copy(hd); sp.p.copy(hd); ringS.s = (0.3 + 0.03 * Math.sin(t * 6)) * g; sp.s = 0.42 * g; sp.roll = t * 2; }
    if (L.a_regen) { const [ringS, p1, p2] = L.a_regen; ringS.flat = true; ringS.p.set(s.pos.x, H.ground + 0.05, s.pos.z); ringS.s = (r + 0.2) * (0.9 + 0.1 * Math.sin(t * 3)) * L.a_regen.t; ringS.a = 0.8; [p1, p2].forEach((x, i) => { const u = (t * 0.7 + i * 0.5) % 1, a = t + i * 3; x.p.set(c.x + Math.cos(a) * r * 0.8, s.pos.y + 0.2 + u * (s.h + 0.4), c.z + Math.sin(a) * r * 0.8); x.s = 0.2 * Math.sin(u * Math.PI); }); }
  }
  function clearAuras(s) { if (!s.loops) return; for (const k in AURA) if (s.loops['a_' + k]) { s.loops['a_' + k].forEach(x => x.kill()); s.loops['a_' + k] = null; } }

  /* ---------- đạo diễn một chiêu ---------- */
  const ctxOf = (R, a, d, o, k = 0) => ({ R, a, d, cls: R.cls, k, rehit: k > 0, act: k > 0 ? REHIT : R.beats.act, big: [1, 1.3, 1.7][R.cls], pitch: (1 + k * 0.12) * [1, 0.92, 0.82][R.cls], snd: R.snd, from: a.mouth(), to: d.center(), sky: null, lock: o.lock || (() => {}) });
  /** Lấy đà theo tầng. Tối thượng: thanh điện ảnh + tên chiêu cắt ngang (DOM), máy quay cận, tụ lực rồi nhả. */
  async function antic(c, o) {
    const { a, R } = c, T = R.beats.antic, ce = a.center();
    if (o.first) await twist.first(a);
    if (o.lowhp) twist.lowhp(a, T);
    if (R.cls < 2) {
      H.sfx(R.cls ? 'anticBig' : 'antic', { pitch: c.pitch });
      if (R.cls) { H.cam.shot('duel'); gring(a.pos, R.c, 1.7, 0.5, T, { ease: E.in2, hold: true }); emit({ at: i => ce.clone().add(V(Math.cos(i * 1.1) * 1.5, rand(-0.6, 1.1), Math.sin(i * 1.1) * 1.5)), n: 12, to: ce, life: T, color: R.c2, color2: R.c, size: [0.2, 0.05], shape: 1, blend: 'alpha', arc: 0, wobble: 0.2 }); }
      else puff('spark', a.mouth(), R.c2, '#ffffff', 0.3, T + 0.05, { spin: 8 });
      return windup(a, o.first ? Math.max(0.05, T - 0.16) : T, R.cls ? 1.2 : 0.8);
    }
    H.ui.cutin?.(o.name || '', R.c, T); H.ui.darken(0.55); H.stage.setGlow(1); H.cam.shot('attacker', a); H.sfx('charge'); H.sfx('cutin'); H.ui.lines?.(R.c, T);
    rune(a.pos, R.c, 1.8, T * 0.8, 0.3); const n = low ? 5 : 9, sp = [];
    for (let i = 0; i < n; i++) { const s = spr(R.motif, colOf(R, i), R.c2); s.s = 0; sp.push(s); }
    const rel = T * 0.86; windup(a, rel, 1.4);
    await tween(rel, u => { const sq = E.in2(u); sp.forEach((s, i) => { const an = u * 9 + i / n * TAU, r = 2.3 - 2.0 * sq; s.p.set(a.pos.x + Math.cos(an) * r, a.pos.y + 0.2 + (i / n) * (a.h + 0.6) * (0.4 + 0.6 * u), a.pos.z + Math.sin(an) * r); s.s = 0.2 * Math.min(1, u * 5) * (1 - sq * 0.4); s.roll = an; }); a.shake = 0.035 * u; });
    sp.forEach(s => s.kill()); a.shake = 0; H.sfx('release'); pow(ce, R.c, 0.75, 0.26, R.c2); gring(ce, R.c, 0.4, 1.7, 0.32, { flat: false, a: 0.8 }); gring(a.pos, R.c, 0.4, 3.0, 0.45); H.ui.flash(R.c, 0.3, 0.18); H.cam.shake(0.35);
    H.cam.shot(SKY_FORMS[R.form] ? 'sky' : 'wide'); H.ui.darken(0.3);
    await wait(T - rel);
  }
  /**
   * Diễn trọn một đòn đánh theo công thức. o: { hits, info(k, last) → { crit, mult, onHit }, first, lowhp, guarded, pierce, name }.
   * Thứ tự: lấy đà → (mỗi đòn: hành động → TRÚNG) → dư âm (về chỗ, mảnh vụn tan) → trả máy quay.
   */
  async function cast(R, a, d, o = {}) {
    const n = Math.max(1, o.hits || 1), c0 = ctxOf(R, a, d, o);
    await antic(c0, o);
    if (!MOVERS[R.form] && !(R.form === 'summon' && MOVERS[R.then])) release(a);
    for (let k = 0; k < n; k++) {
      const c = ctxOf(R, a, d, o, k), last = k === n - 1, form = k > 0 && (R.form === 'summon' || R.form === 'eclipse') ? (R.then && F[R.then] ? R.then : 'volley') : R.form;
      if (k > 0) c.R = { ...R, form, motif: R.m2 || R.motif };
      await (F[form] || F.shot)(c);
      if (k === 0 && o.pierce) twist.pierce(a, d, R.c, o.guarded);
      const info = o.info?.(k, last) || {};
      fx.impact(a, d, R.element, { power: [1, 1.4, 2][R.cls] * (last ? 1 : 0.8), cls: R.cls, crit: info.crit, mult: info.mult ?? 1, pitch: 1 + k * 0.12, onHit: info.onHit, final: last, multi: n > 1 });
      if (info.crit) twist.crit(d.center(), R.c);
      debris(d.center(), R, low ? 3 : 4 + R.cls * 2, 0.8 + R.cls * 0.2);
      if (!last) await wait(0.05);
    }
    if (R.cls === 2) H.cam.shot('target', d);
    await Promise.all([home(a, Math.min(0.32, R.beats.follow)), wait(R.beats.follow)]);
    d.off.y = 0; d.spin = 0;
    if (R.cls === 2) { H.ui.cutout?.(); H.ui.darken(0); H.stage.setGlow(0); }
    if (R.cls) H.cam.shot('wide');
  }
  /** Diễn một chiêu hỗ trợ. combo = true: bản rút gọn chạy sau đòn kèm của chiêu kép. o.lock: gọi đúng nhịp hiệu lực. */
  async function support(R, a, o = {}) {
    const b = o.combo ? COMBO_SUPPORT_BEATS : R.beats, c = ctxOf(R, a, a, o); c.act = b.act;
    H.sfx('antic', { pitch: 1.2 }); await tween(b.antic, u => { a.sq = -0.14 * E.out3(u); });
    await (S[R.form] || S.aura)(c);
    await wait(b.follow);
  }

  return { F, S, twist, cast, support, statusBurst, tick, enter, faint, syncAuras, clearAuras, stepSprites, spr, pow, gring, puff, debris, home, recipeOf, E, stats: () => ({ batches: batches.size, sprites: [...batches.values()].reduce((s, b) => s + b.live, 0) }) };
}
