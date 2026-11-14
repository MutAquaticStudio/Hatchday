// Hiệu ứng của Đấu trường (Technical Artist). Luật phong cách: docs/VFX-STYLE-GUIDE.md.
// - Mỗi chiêu (200 chiêu) có CÔNG THỨC riêng ở move-fx.ts (dạng + hoạ tiết + màu + nhịp), dựng bởi battle-forms.js.
// - File này giữ phần nền dùng chung: hệ hạt GPU hai lớp, vệt đuôi và khối hình lấy từ bể dùng lại, vòng chữ trống đồng,
//   gai, dây leo, sét, vết trên sân, cú trúng đòn (một nhịp: số sát thương + khựng hình + tiếng + rung) và trạng thái kéo dài.
// - Mọi thời lượng chạy theo đồng hồ của trận (timeScale) để nút tua nhanh áp dụng cho cả hiệu ứng; fx.reduce (giảm chuyển động)
//   bỏ rung, khựng hình, khung đảo màu. Ngân sách hạt / hình theo tầng chất lượng ('thap' | 'vua' | 'cao').
import { PALETTE, QUALITY, TIER_BEATS, STOP_CRIT, STOP_SUPER, STOP_MULTI, recipeOf } from './move-fx';
import { makeForms } from './battle-forms.js';

export const ELEMENT_FX = [
  { c: PALETTE[0].c, c2: PALETTE[0].c2, icon: '🌿' },
  { c: PALETTE[1].c, c2: PALETTE[1].c2, icon: '💧' },
  { c: PALETTE[2].c, c2: PALETTE[2].c2, icon: '🌀' },
  { c: PALETTE[3].c, c2: PALETTE[3].c2, icon: '🌙' },
  { c: PALETTE[4].c, c2: PALETTE[4].c2, icon: '🔥' },
];

export function makeFx(THREE, scene, H) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const rand = (a, b) => a + Math.random() * (b - a), pick = a => (Array.isArray(a) ? rand(a[0], a[1]) : a);
  const fx = { timeScale: 1, freeze: 0, reduce: false }, QB = QUALITY[H.quality] || QUALITY.vua;

  /* ---------- đồng hồ và tác vụ theo thời gian ---------- */
  const tasks = new Set(), run = [];
  // Nhịp chính xác: tác vụ nối tiếp (await tween → tween mới) được tạo giữa hai khung hình nên nhận lại phần thời gian
  // tác vụ trước đã chạy lố trong khung vừa rồi (carry), để chuỗi pha không trễ thêm một khung mỗi bước.
  let carry = 0;
  /** Chạy fn(u, dt) trong `dur` giây (u từ 0 tới 1); trả về Promise khi xong. */
  const tween = (dur, fn, end) => new Promise(res => tasks.add({ t: carry, dur: Math.max(1e-4, dur), fn, end, res }));
  const wait = s => tween(s);
  const easeOut = u => 1 - (1 - u) * (1 - u), back = u => { const c = 1.7; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };

  /* ---------- hệ hạt ---------- */
  const PV = `attribute float aSize, aAlpha, aShape, aRot; attribute vec3 aColor; uniform float uScale; varying float vA, vS, vR; varying vec3 vC;
    void main() { vA = aAlpha; vS = aShape; vR = aRot; vC = aColor; vec4 mv = modelViewMatrix * vec4( position, 1.0 ); gl_PointSize = aSize * uScale / max( 0.1, -mv.z ); gl_Position = projectionMatrix * mv; }`;
  const PF = `varying float vA, vS, vR; varying vec3 vC;
    void main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float c = cos( vR ), s = sin( vR ); p = vec2( c * p.x - s * p.y, s * p.x + c * p.y ); float r = length( p ), a;
      if ( vS < 0.5 ) a = smoothstep( 1.0, 0.0, r );
      else if ( vS < 1.5 ) a = max( smoothstep( 0.16, 0.0, abs( p.x ) * abs( p.y ) * 4.0 ) * smoothstep( 1.0, 0.1, r ), smoothstep( 0.4, 0.0, r ) );
      else if ( vS < 2.5 ) a = step( length( vec2( p.x * 2.4, p.y ) ), 1.0 );
      else if ( vS < 3.5 ) a = smoothstep( 0.2, 0.0, abs( r - 0.72 ) );
      else if ( vS < 4.5 ) a = step( r, 1.0 );
      else a = step( length( vec2( p.x * 4.0, p.y ) ), 1.0 );
      a *= vA; if ( a < 0.01 ) discard; gl_FragColor = vec4( vC, a ); }`;
  function particles(blending, N) {
    const g = new THREE.BufferGeometry(), A = {
      position: new Float32Array(N * 3), aColor: new Float32Array(N * 3), aSize: new Float32Array(N), aAlpha: new Float32Array(N), aShape: new Float32Array(N), aRot: new Float32Array(N) };
    for (const k in A) g.setAttribute(k, new THREE.BufferAttribute(A[k], k === 'position' || k === 'aColor' ? 3 : 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({ vertexShader: PV, fragmentShader: PF, uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false, blending, fog: false });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = blending === THREE.AdditiveBlending ? 20 : 19; scene.add(pts);
    const P = Array.from({ length: N }, () => ({ on: false })); let cur = 0;
    return { m, A, g, P, N, spawn(o) { for (let k = 0; k < N; k++) { cur = (cur + 1) % N; if (!P[cur].on) break; } P[cur] = { on: true, age: 0, ...o }; } };
  }
  const SYS = { add: particles(THREE.AdditiveBlending, QB.add), alpha: particles(THREE.NormalBlending, QB.alpha) };
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), tv = V();
  /** Phát hạt. at: điểm hoặc hàm(i) → điểm. dir + spread: hướng bắn; radial: bắn toả ra từ tâm; path: bay theo đường cong tới `to`. */
  function emit(o) {
    const sys = SYS[o.blend || 'add'], n = Math.round((o.n ?? 10) * (fx.reduce ? 0.5 : 1) * QB.n), c1 = tmpC.set(o.color || '#ffffff').clone().multiplyScalar(o.hdr ?? 1), c2 = tmpC2.set(o.color2 || o.color || '#ffffff').clone().multiplyScalar(o.hdr ?? 1);
    for (let i = 0; i < n; i++) {
      const at = typeof o.at === 'function' ? o.at(i, n) : o.at, b = o.box || 0, p = V(at.x + rand(-b, b), at.y + rand(-b, b) * (o.flat ? 0.2 : 1), at.z + rand(-b, b));
      let v;
      if (o.radial) { v = V(rand(-1, 1), rand(o.flat ? 0 : -1, 1) * (o.flat ? 0.3 : 1), rand(-1, 1)).normalize(); if (o.up) v.y = Math.abs(v.y) + o.up; v.normalize(); }
      else { const d = o.dir ? (o.dir.isVector3 ? o.dir.clone() : V(...o.dir)) : V(0, 1, 0); v = d.normalize().multiplyScalar(1 - (o.spread ?? 0.4)).add(V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(o.spread ?? 0.4)).normalize(); }
      if (o.swirl) { const r = p.clone().sub(o.swirl.c); r.y = 0; const t = V(-r.z, 0, r.x).normalize(); v.addScaledVector(t, o.swirl.k).normalize(); }
      v.multiplyScalar(pick(o.speed ?? [1, 2]));
      const path = o.to ? { a: p.clone(), b: p.clone().lerp(o.to, 0.5).add(V(rand(-1, 1) * (o.wobble ?? 0.6), (o.arc ?? 0.8) + rand(-0.3, 0.3), rand(-1, 1) * (o.wobble ?? 0.6))), c: o.to.clone().add(V(rand(-0.15, 0.15), rand(-0.15, 0.15), rand(-0.15, 0.15))), delay: (o.stagger || 0) * i } : null;
      sys.spawn({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, g: o.gravity || 0, drag: o.drag || 0, life: pick(o.life ?? [0.4, 0.8]), s0: pick(Array.isArray(o.size) ? o.size[0] : o.size ?? 0.2), s1: Array.isArray(o.size) ? o.size[1] : (o.size ?? 0.2) * 0.3,
        a0: o.alpha ?? 1, r: c1.r, gg: c1.g, b: c1.b, r2: c2.r, g2: c2.g, b2: c2.b, shape: o.shape || 0, rot: rand(0, 6.3), spin: (o.spin || 0) * rand(-1, 1), path });
    }
  }
  function stepParticles(dt) {
    for (const k in SYS) {
      const s = SYS[k], A = s.A;
      for (let i = 0; i < s.N; i++) {
        const q = s.P[i];
        if (!q.on) { if (A.aAlpha[i] !== 0) { A.aAlpha[i] = 0; A.aSize[i] = 0; } continue; }
        if (q.path && q.path.delay > 0) { q.path.delay -= dt; A.aAlpha[i] = 0; continue; }
        q.age += dt; const u = q.age / q.life; if (u >= 1) { q.on = false; A.aAlpha[i] = 0; A.aSize[i] = 0; continue; }
        if (q.path) { const w = easeOut(u), a = q.path; q.x = (1 - w) * (1 - w) * a.a.x + 2 * (1 - w) * w * a.b.x + w * w * a.c.x; q.y = (1 - w) * (1 - w) * a.a.y + 2 * (1 - w) * w * a.b.y + w * w * a.c.y; q.z = (1 - w) * (1 - w) * a.a.z + 2 * (1 - w) * w * a.b.z + w * w * a.c.z; }
        else { const dr = Math.exp(-q.drag * dt); q.vx *= dr; q.vy = q.vy * dr - q.g * dt; q.vz *= dr; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
        q.rot += q.spin * dt;
        A.position[i * 3] = q.x; A.position[i * 3 + 1] = q.y; A.position[i * 3 + 2] = q.z;
        A.aColor[i * 3] = q.r + (q.r2 - q.r) * u; A.aColor[i * 3 + 1] = q.gg + (q.g2 - q.gg) * u; A.aColor[i * 3 + 2] = q.b + (q.b2 - q.b) * u;
        A.aSize[i] = q.s0 + (q.s1 - q.s0) * u; A.aAlpha[i] = q.a0 * Math.min(1, u * 10) * Math.pow(1 - u, 1.2); A.aRot[i] = q.rot;
      }
      for (const key in A) s.g.attributes[key].needsUpdate = true;
    }
  }

  /* ---------- vật liệu và khối dùng chung ---------- */
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const addM = (color, hdr = 1.6, o = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(hdr), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false, ...o });
  /** Màu đặc (trộn thường): đọc được trên cả nền sáng lẫn tối, đúng chất cel shading. */
  const solid = (color, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false, ...o });
  const sprite = (color, s, hdr = 2) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(color).multiplyScalar(hdr), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false })); m.scale.setScalar(s); m.renderOrder = 21; return m; };
  const drop = o => { scene.remove(o); o.traverse(x => { if (x.material) { (Array.isArray(x.material) ? x.material : [x.material]).forEach(m => m.dispose()); } if (x.geometry && x.geometry.userData.temp) x.geometry.dispose(); }); };
  const G = { ring: new THREE.RingGeometry(0.86, 1, 64), sphere: new THREE.SphereGeometry(1, 24, 16), cyl: new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), cyl8: new THREE.CylinderGeometry(1, 1, 1, 8), torus: new THREE.TorusGeometry(1, 0.05, 6, 48), arc: new THREE.TorusGeometry(1, 0.08, 6, 40, 2.4), arcThin: new THREE.TorusGeometry(1, 0.025, 4, 40, 2.4), cone: new THREE.ConeGeometry(1, 1, 7), ico: new THREE.IcosahedronGeometry(1, 2) };
  const star = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.42 : 1; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ShapeGeometry(s); })();
  const burstGeo = (() => { const s = new THREE.Shape(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 0.42 : 0.8 + 0.2 * Math.sin(i * 7.3) ** 2; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ShapeGeometry(s); })();
  const drumStar = (() => { const s = new THREE.Shape(); for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, r = i % 2 ? 0.35 : 1; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ShapeGeometry(s); })();

  /* ---------- hiệu ứng cơ bản ---------- */
  function flash(at, color, size = 1.4, dur = 0.28) { const s = sprite(color, 0.01, 3); s.position.copy(at); scene.add(s); return tween(dur, u => { s.scale.setScalar(size * easeOut(Math.min(1, u * 2.2))); s.material.opacity = 1 - u; }, () => drop(s)); }
  /** Sao nổ khi trúng đòn: hình răng cưa màu hệ, lõi trắng, quay mặt về máy quay. */
  function burst(at, color, size = 1, dur = 0.32) {
    const g = new THREE.Group(), o = new THREE.Mesh(burstGeo, solid(color)), i = new THREE.Mesh(burstGeo, solid('#ffffff')); i.scale.setScalar(0.55); i.position.z = 0.01; g.add(o); g.add(i); g.position.copy(at); g.lookAt(H.camPos()); g.rotateZ(Math.random() * 6); g.renderOrder = 23; scene.add(g);
    return tween(dur, u => { g.scale.setScalar(size * back(Math.min(1, u * 3.5)) * (1 + u * 0.2)); const a = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45; o.material.opacity = a; i.material.opacity = a; }, () => drop(g));
  }
  function ring(at, color, r0, r1, dur = 0.45, { flat = true, w = 1, hdr = 2 } = {}) {
    const m = new THREE.Mesh(G.ring, hdr > 0 ? solid(color) : addM(color, -hdr)); m.position.copy(at); if (flat) m.rotation.x = -Math.PI / 2; else m.lookAt(H.camPos()); m.renderOrder = 18; scene.add(m);
    return tween(dur, u => { const r = r0 + (r1 - r0) * easeOut(u); m.scale.set(r, r, r); m.material.opacity = (1 - u) * w; }, () => drop(m));
  }
  /** Vòng chữ trống đồng dưới chân (xuất hiện, tụ lực): sao 14 cánh + hai vòng, xoay chậm. */
  function rune(at, color, r = 1.3, dur = 1.0, hold = 0) {
    const g = new THREE.Group(); g.position.copy(at).add(V(0, 0.02, 0)); scene.add(g);
    const parts = [new THREE.Mesh(drumStar, addM(color, 1.8)), new THREE.Mesh(G.ring, addM(color, 2.2)), new THREE.Mesh(G.ring, addM(color, 1.6))];
    parts[0].scale.setScalar(0.45); parts[2].scale.setScalar(0.72); parts.forEach(p => { p.rotation.x = -Math.PI / 2; g.add(p); });
    return tween(dur + hold, (u, dt) => { const k = Math.min(1, u * (dur + hold) / Math.min(0.3, dur)), f = u > (dur / (dur + hold)) * 0.7 ? 1 - (u - 0.7) / 0.3 : 1; g.scale.setScalar(r * easeOut(k)); g.rotation.y += dt * 1.4; parts.forEach(p => { p.material.opacity = Math.max(0, f); }); }, () => drop(g));
  }
  function spikeBurst(at, color, n, h, dur, radius) {
    const g = new THREE.Group(); g.position.copy(at); scene.add(g); const mat = H.kit.cel(color), ink = H.kit.inkM(0.02), list = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rand(0, 0.4), r = radius * (n > 1 ? 1 : 0), m = new THREE.Mesh(G.cone, mat); m.add(new THREE.Mesh(G.cone, ink)); m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); m.rotation.set(Math.sin(a) * 0.35 * (n > 1 ? 1 : 0), 0, -Math.cos(a) * 0.35 * (n > 1 ? 1 : 0)); m.castShadow = true; g.add(m); list.push({ m, d: i * 0.05 }); }
    return tween(dur, u => { const t = u * dur; list.forEach(({ m, d }) => { const k = Math.max(0, Math.min(1, (t - d) / 0.14)), out = t > dur - 0.25 ? (dur - t) / 0.25 : 1; const s = back(k) * Math.max(0, out); m.scale.set(h * 0.22 * Math.max(0.01, s), h * Math.max(0.01, s), h * 0.22 * Math.max(0.01, s)); m.position.y = h * 0.5 * s - 0.05; }); }, () => { scene.remove(g); });
  }
  function vines(at, color, n, h, dur) {
    const g = new THREE.Group(); g.position.copy(at); scene.add(g); const mat = H.kit.cel(color), ink = H.kit.inkM(0.015), vs = [];
    for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, pts = []; for (let k = 0; k <= 16; k++) { const u = k / 16, a = a0 + u * 3.2, r = 0.75 - u * 0.35; pts.push(V(Math.cos(a) * r, u * h, Math.sin(a) * r)); }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.06, 6); geo.userData.temp = true; const m = new THREE.Mesh(geo, mat); m.add(new THREE.Mesh(geo, ink)); g.add(m); vs.push(m); }
    return tween(dur, u => { const k = Math.min(1, u * 2.2), out = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1; vs.forEach(m => { const c = m.geometry.index.count; m.geometry.setDrawRange(0, Math.floor(c * k / 3) * 3); m.children[0].geometry.setDrawRange(0, Math.floor(c * k / 3) * 3); }); g.scale.setScalar(Math.max(0.01, out)); }, () => drop(g));
  }
  function bolt(to, color, quiet = false) {
    const pts = [], top = to.clone().add(V(rand(-1, 1), 9, rand(-1, 1))); for (let i = 0; i <= 10; i++) { const p = top.clone().lerp(to, i / 10); if (i && i < 10) p.add(V(rand(-0.45, 0.45), 0, rand(-0.45, 0.45))); pts.push(p); }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.02), 60, 0.06, 5); geo.userData.temp = true; const m = new THREE.Mesh(geo, addM(color, 3)); scene.add(m);
    const gl = sprite(color, 2.5, 2.5); gl.position.copy(to); scene.add(gl); if (!quiet) { H.ui.flash(color, 0.3, 0.12); H.sfx('zap'); }
    return tween(0.22, u => { m.material.opacity = u < 0.5 ? 1 : (1 - u) * 2; gl.material.opacity = 1 - u; }, () => { drop(m); drop(gl); });
  }

  /* ---------- vệt đuôi (ribbon) lấy từ bể: N điểm gần nhất thành dải quay mặt về máy quay, đầu đậm, đuôi mảnh ---------- */
  const trailPool = [], tA = V(), tSide = V(), tView = V();
  function newTrail() {
    const N = QB.trail, pos = new Float32Array(N * 2 * 3), al = new Float32Array(N * 2), idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    for (let i = 0; i < N; i++) { al[i * 2] = al[i * 2 + 1] = 1 - i / (N - 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aA', new THREE.BufferAttribute(al, 1)); g.setIndex(idx);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uC: { value: new THREE.Color() }, uO: { value: 1 } },
      vertexShader: 'attribute float aA; varying float vA; void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
      fragmentShader: 'uniform vec3 uC; uniform float uO; varying float vA; void main() { gl_FragColor = vec4( mix( uC, vec3( 1.0 ), vA * vA * 0.35 ), vA * uO ); }' });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 17;
    return { N, g, m, mesh, pts: Array.from({ length: N }, () => V()), n: 0, w: 0.25, gap: 0, live: false };
  }
  /** Lấy một vệt đuôi. long = true: các điểm cách nhau ≥ 0,12 nên vệt dài theo quãng đường (xúc tu, rồng, cầu vồng). */
  function trail(color, width = 0.25, long = false) {
    const T = trailPool.pop() || newTrail(); T.m.uniforms.uC.value.set(color); T.m.uniforms.uO.value = 1; T.n = 0; T.w = width; T.gap = long ? 0.12 : 0; T.live = true; scene.add(T.mesh);
    return {
      push(p) { if (!T.live) return; if (T.n && T.gap && T.pts[0].distanceToSquared(p) < T.gap * T.gap) { T.pts[0].copy(p); } else { const v = T.pts.pop(); v.copy(p); T.pts.unshift(v); T.n = Math.min(T.N, T.n + 1); }
        const P = T.g.attributes.position.array, cam = H.camPos(), last = T.n - 1;
        for (let i = 0; i < T.N; i++) { const q = T.pts[Math.min(i, last)], nx = T.pts[Math.min(i + 1, last)]; tA.copy(q).sub(nx); if (tA.lengthSq() < 1e-6) tA.set(1, 0, 0); tView.copy(cam).sub(q); tSide.crossVectors(tA, tView).normalize().multiplyScalar(T.w * (1 - i / T.N) * 0.5);
          P[i * 6] = q.x + tSide.x; P[i * 6 + 1] = q.y + tSide.y; P[i * 6 + 2] = q.z + tSide.z; P[i * 6 + 3] = q.x - tSide.x; P[i * 6 + 4] = q.y - tSide.y; P[i * 6 + 5] = q.z - tSide.z; }
        T.g.attributes.position.needsUpdate = true; },
      fade(dur = 0.25) { if (!T.live) return wait(0); T.live = false; return tween(dur, u => { T.m.uniforms.uO.value = 1 - u; }, () => { scene.remove(T.mesh); trailPool.push(T); }); },
    };
  }
  /* ---------- khối hình lấy từ bể (ống tia, vòng xoáy, cầu nhật thực) ---------- */
  const meshPool = {};
  function mesh(kind, color, opacity = 1, additive = false) {
    const key = kind + (additive ? '+' : ''), list = meshPool[key] || (meshPool[key] = []);
    let m = list.pop();
    if (!m) { m = new THREE.Mesh(G[kind], additive ? addM('#ffffff', 1) : solid('#ffffff')); m.userData.kind = key; m.renderOrder = 18; }
    m.material.color.set(color); if (additive) m.material.color.multiplyScalar(1.4); m.material.opacity = opacity;
    m.position.set(0, -99, 0); m.quaternion.identity(); m.scale.setScalar(0.001); scene.add(m); return m;
  }
  function free(m) { scene.remove(m); (meshPool[m.userData.kind] || (meshPool[m.userData.kind] = [])).push(m); }

  /* ---------- chuyển động của quái thú ---------- */

  /** Bị đánh bật: lùi nhanh (¼ thời gian) rồi trượt về, ép người, rung; giữ nguyên độ cao để không cắt ngang cú hất tung. */
  function knock(d, from, p = 1) { const dir = d.pos.clone().sub(from.pos).setY(0).normalize().multiplyScalar(0.32 * p); return tween(0.32, u => { const k = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75; const y = d.off.y; d.off.copy(dir).multiplyScalar(k); d.off.y = y; d.sq = -0.12 * k; d.shake = (1 - u) * 0.05 * p; }, () => { d.shake = 0; }); }
  function hop(a, h = 0.35, dur = 0.4) { return tween(dur, u => { a.off.y = Math.sin(u * Math.PI) * h; a.sq = Math.sin(u * Math.PI * 2) * 0.05; }); }

  /* ---------- tác động khi trúng đòn ---------- */
  const decalTex = [];
  function decalMap(el) {
    if (decalTex[el]) return decalTex[el];
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), C = 128, h = n => { const x = Math.sin(n * 127.1 + el * 31.7) * 43758.5453; return x - Math.floor(x); };
    if (el === 4) { const gr = g.createRadialGradient(C, C, 10, C, C, 120); gr.addColorStop(0, 'rgba(20,10,8,.85)'); gr.addColorStop(0.7, 'rgba(40,18,10,.5)'); gr.addColorStop(1, 'rgba(40,18,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(255,140,40,.9)'; g.lineWidth = 3; for (let i = 0; i < 7; i++) { let x = C, y = C, a = h(i) * 6.28; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { a += (h(i * 9 + k) - 0.5) * 1.2; x += Math.cos(a) * 16; y += Math.sin(a) * 16; g.lineTo(x, y); } g.stroke(); } }
    if (el === 1) { g.fillStyle = 'rgba(70,160,230,.55)'; g.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * 6.28, rr = 80 + h(i) * 30; g.lineTo(C + Math.cos(a) * rr, C + Math.sin(a) * rr); } g.fill(); g.strokeStyle = 'rgba(220,245,255,.8)'; g.lineWidth = 4; g.stroke(); }
    if (el === 0) for (let i = 0; i < 26; i++) { g.save(); g.translate(C + (h(i) - 0.5) * 200, C + (h(i + 40) - 0.5) * 200); g.rotate(h(i + 80) * 6.28); g.fillStyle = i % 3 ? 'rgba(80,170,70,.9)' : 'rgba(150,200,80,.9)'; g.beginPath(); g.ellipse(0, 0, 14, 6, 0, 0, 6.28); g.fill(); g.restore(); }
    if (el === 2) { g.strokeStyle = 'rgba(200,240,255,.75)'; g.lineWidth = 5; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(C, C, 30 + i * 20, h(i) * 6, h(i) * 6 + 2.4); g.stroke(); } }
    if (el === 3) { g.strokeStyle = 'rgba(150,90,255,.9)'; g.lineWidth = 4; g.beginPath(); g.arc(C, C, 90, 0, 6.28); g.stroke(); g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; g.moveTo(C + Math.cos(a) * 90, C + Math.sin(a) * 90); g.lineTo(C + Math.cos(a + 2.1) * 90, C + Math.sin(a + 2.1) * 90); } g.stroke(); g.fillStyle = 'rgba(20,8,40,.5)'; g.beginPath(); g.arc(C, C, 60, 0, 6.28); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (decalTex[el] = t);
  }
  /** Vết trên sàn tại chỗ trúng đòn, giữ vài giây rồi mờ dần. */
  function decal(at, el, size = 1.4) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ map: decalMap(el), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, toneMapped: false }));
    m.geometry.userData.temp = true; m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.set(at.x, H.ground + 0.02, at.z); m.renderOrder = 2; scene.add(m);
    return tween(3.5, u => { m.scale.setScalar(size * Math.min(1, u * 12)); m.material.opacity = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4; }, () => drop(m));
  }
  /** Cú trúng đòn: lớp chung (sao nổ đặc màu hệ, vòng, tia vụn) + lớp riêng theo hệ; mọi thứ rơi đúng khung trúng. */
  const HIT_SFX = ['hitLeaf', 'hitWater', 'hitWind', 'hitShadow', 'hitFire'];
  function impact(a, d, el, { power = 1, cls, crit = false, mult = 1, onHit, pitch = 1, final = true } = {}) {
    const E = ELEMENT_FX[el], at = d.center(), tier = cls ?? (power >= 2 ? 2 : power >= 1.4 ? 1 : 0), big = power * (mult > 1.15 ? 1.2 : 1) * (crit ? 1.3 : 1) * (final ? 1 : 0.8);
    onHit?.();
    burst(at, E.c, 0.8 * big, 0.3); flash(at, E.c, 0.45 * big, 0.16); forms.gring(at, E.c, 0.3, 1.2 * big, 0.26, { flat: false }); ring(d.pos.clone().setY(H.ground + 0.03), E.c, 0.3, 1.6 * big, 0.45);
    emit({ at, n: 14 * big, radial: true, color: E.c, color2: E.c2, speed: [3, 6.5], drag: 4, life: [0.25, 0.45], size: [0.22, 0.05], shape: 1, blend: 'alpha' });
    emit({ at, n: 6 * big, radial: true, color: '#ffffff', speed: [4, 7], drag: 4, life: [0.2, 0.32], size: [0.12, 0.03], shape: 1, hdr: 1.4 });
    if (el === 1) emit({ at, n: 16, radial: true, up: 0.8, color: '#9fdcff', color2: '#e8f8ff', speed: [2.5, 5], gravity: 9, life: [0.5, 0.8], size: [0.12, 0.06], shape: 4, blend: 'alpha' });
    if (el === 2) emit({ at, n: 10, radial: true, flat: true, color: '#ffffff', color2: E.c, speed: [5, 9], drag: 3, life: [0.2, 0.35], size: [0.35, 0.1], shape: 5, blend: 'alpha' });
    if (el === 3) emit({ at, n: 10, radial: true, blend: 'alpha', color: '#1a0a2a', color2: '#000000', alpha: 0.7, speed: [1, 2.5], drag: 2, life: [0.5, 0.9], size: [0.4, 0.9] });
    if (el === 4) emit({ at, n: 16, radial: true, up: 0.5, color: '#ffd23e', color2: '#ff3a0a', speed: [2, 5], drag: 2, gravity: -1, life: [0.4, 0.8], size: [0.18, 0.04], shape: 1, blend: 'alpha' });
    if ((el === 4 || el === 3) && tier === 2 && final) emit({ at, n: 12, radial: true, up: 0.6, blend: 'alpha', color: el === 4 ? '#3a2a28' : '#1a0a2a', color2: '#000000', alpha: 0.6, speed: [0.6, 1.6], drag: 1.5, gravity: -0.6, life: [0.7, 1.2], size: [0.5, 1.4] });
    // khựng hình: theo tầng, cộng thêm khi chí mạng / khắc hệ; đòn liên hoàn chưa phải đòn cuối chỉ khựng nhẹ
    const frames = final ? TIER_BEATS[tier].stop + (crit ? STOP_CRIT : 0) + (mult > 1.15 ? STOP_SUPER : 0) : STOP_MULTI;
    if (!fx.reduce && fx.timeScale < 5) fx.freeze = Math.max(2 / 60, Math.min(12, frames) / 60 / fx.timeScale);
    H.cam.shake(Math.min(1, ([0.25, 0.35, 0.5][tier] + (crit ? 0.3 : 0)) * (final ? 1 : 0.6)));
    H.cam.punch?.(Math.min(1, 0.25 * big));
    H.sfx(crit ? 'crit' : tier >= 1 && final ? 'hitBig' : 'hit', { pitch }); H.sfx(HIT_SFX[el], { pitch }); if (tier === 2 && final) H.sfx('boom');
    if (final) { if (mult > 1) H.sfx('superEff'); else if (mult < 1) H.sfx('weak'); }
    if (final && (tier >= 1 || crit)) decal(d.pos, el, 1.1 + power * 0.35);
    if (crit && final) H.ui.flash('#fff2a0', 0.3, 0.14);
    if (!fx.reduce && final && (tier === 2 || crit)) { H.ui.impactFrame?.(tier === 2 ? 0.08 : 0.05); H.ui.lines?.(E.c, tier === 2 ? 0.5 : 0.3); }
    knock(d, a, Math.min(1.6, big));
  }

  /* ---------- công thức chiêu, nét riêng, ra sân, gục ---------- */
  const forms = makeForms(THREE, scene, H, fx, { tween, wait, emit, trail, mesh, free, bolt, vines, spikeBurst, decal, rune, G });

  /* ---------- trạng thái kéo dài trên người quái thú ---------- */

  function syncStatus(s, f, dt) {
    const L = s.loops || (s.loops = {}), ms = !!s.muteSt, want = { root: !ms && !!f.status.root, daze: !ms && !!f.status.daze, shield: !s.mute && f.guard > 0 && f.hp > 0 };
    if (want.root && !L.root) { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.07, 6, 28), H.kit.cel('#3f9a46')); m.rotation.x = Math.PI / 2; m.add(new THREE.Mesh(m.geometry, H.kit.inkM(0.015))); g.add(m);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, t = new THREE.Mesh(G.cone, H.kit.cel('#6b8a3a')); t.scale.set(0.06, 0.2, 0.06); t.position.set(Math.cos(a) * 0.75, 0.08, Math.sin(a) * 0.75); g.add(t); } scene.add(g); L.root = g; }
    if (!want.root && L.root) { drop(L.root); L.root = null; }
    if (want.daze && !L.daze) { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(star, addM('#ffe45a', 2)); m.scale.setScalar(0.12); g.add(m); } scene.add(g); L.daze = g; }
    if (!want.daze && L.daze) { drop(L.daze); L.daze = null; }
    if (want.shield && !L.shield) { const col = f.wall ? '#ffd27a' : f.thorns ? '#ff6a6a' : ELEMENT_FX[f.element].c2, m = new THREE.Mesh(G.ico, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: new THREE.Color(col).multiplyScalar(1.6) }, uT: { value: 0 } },
        vertexShader: 'varying vec3 vN, vV; varying vec3 vP; void main() { vN = normalize( normalMatrix * normal ); vec4 mv = modelViewMatrix * vec4( position, 1.0 ); vV = -mv.xyz; vP = position; gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uT; varying vec3 vN, vV, vP; void main() { float f = pow( 1.0 - abs( dot( normalize( vN ), normalize( vV ) ) ), 2.5 ); float hex = step( 0.92, fract( ( vP.y + uT * 0.2 ) * 6.0 ) ) * 0.4; gl_FragColor = vec4( uC, clamp( f * 0.9 + hex + 0.06, 0.0, 1.0 ) ); }' }));
      const w = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 1)), new THREE.LineBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.4), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); m.add(w); m.renderOrder = 22; scene.add(m); L.shield = m; L.shieldT = 0; }
    if (!want.shield && L.shield) { const m = L.shield; L.shield = null; emit({ at: m.position, n: 24, radial: true, color: '#e8fbff', speed: [2, 4], drag: 2, gravity: 4, life: [0.4, 0.7], size: [0.14, 0.05], shape: 4, hdr: 1.6 }); drop(m); }
    forms.syncAuras(s, f, dt, clock); const c = s.center(), hd = s.head(), t = clock;
    if (L.root) L.root.position.copy(s.pos).setY(H.ground + 0.04), L.root.rotation.y += dt * 0.4;
    if (L.daze) L.daze.children.forEach((m, i) => { const a = t * 3 + i * 2.1; m.position.set(hd.x + Math.cos(a) * 0.45, hd.y + 0.35 + Math.sin(a * 2) * 0.05, hd.z + Math.sin(a) * 0.45); m.lookAt(H.camPos()); });
    if (L.shield) { L.shieldT = Math.min(1, L.shieldT + dt * 5); L.shield.position.copy(c); L.shield.scale.setScalar(s.r * 1.25 * back(L.shieldT)); L.shield.material.uniforms.uT.value = t; L.shield.rotation.y += dt * 0.3; }
    s.emitT = (s.emitT || 0) - dt; if (s.emitT > 0 || f.hp <= 0) return; s.emitT = 0.08;
    if (f.status.burn && !ms) emit({ at: c, box: s.r * 0.6, n: 2, dir: [0, 1, 0], spread: 0.2, speed: [0.8, 1.6], life: [0.3, 0.5], color: '#ffd23e', color2: '#ff3a0a', size: [0.28, 0.05], hdr: 2 });
    if (f.status.soak && !ms) emit({ at: c, box: s.r * 0.6, n: 1, dir: [0, -1, 0], spread: 0.05, speed: [0.2, 0.5], gravity: 6, life: [0.4, 0.6], color: '#9fdcff', size: [0.09, 0.07], shape: 4, blend: 'alpha' });
    if (f.status.blind && !ms) emit({ at: hd, box: 0.25, n: 1, dir: [0, 1, 0], spread: 0.5, speed: [0.1, 0.3], life: [0.6, 1.0], color: '#1a0a2a', color2: '#000000', alpha: 0.6, size: [0.35, 0.6], blend: 'alpha' });
    if (f.boost && !s.mute && Math.random() < 0.5) emit({ at: s.pos, box: s.r * 0.6, flat: true, n: 1, dir: [0, 1, 0], spread: 0.1, speed: [1, 1.8], life: [0.4, 0.6], color: '#ffb03a', color2: '#ff3a1a', size: [0.14, 0.03], shape: 1, hdr: 1.8 });
  }

  function clearStatus(s) { if (!s.loops) return; for (const k of ['root', 'daze', 'shield']) if (s.loops[k]) { drop(s.loops[k]); s.loops[k] = null; } forms.clearAuras(s); }

  /* ---------- vòng lặp ---------- */
  let clock = 0;
  function update(realDt, sizeK) {
    for (const k in SYS) SYS[k].m.uniforms.uScale.value = sizeK;
    if (fx.freeze > 0) { fx.freeze -= realDt; return 0; }
    const dt = realDt * fx.timeScale; clock += dt;
    run.length = 0; for (const k of tasks) run.push(k); carry = 0; let over = 0;
    for (let i = 0; i < run.length; i++) { const k = run[i]; k.t += dt; const u = Math.min(1, k.t / k.dur); try { k.fn?.(u, dt); } catch (e) { console.error(e); } if (u >= 1) { over = Math.max(over, Math.min(dt, k.t - k.dur)); tasks.delete(k); try { k.end?.(); } catch (e) { console.error(e); } k.res(); } }
    carry = over; if (over > 0) setTimeout(settle, 0, 0);
    stepParticles(dt); forms.stepSprites(dt);
    return dt;
  }
  /** Sau một khung hình: tác vụ nối tiếp vừa tạo mà phần thời gian dư (carry) đã đủ dài thì cho xong ngay, không đợi khung sau
   * (tua nhanh ×10 trên máy yếu: cả chuỗi pha ngắn chạy hết trong một khung thay vì mỗi pha một khung). */
  function settle(depth) {
    if (fx.freeze > 0) return;
    run.length = 0; for (const k of tasks) if (k.t >= k.dur) run.push(k);
    if (!run.length) return;
    let over = 0;
    for (let i = 0; i < run.length; i++) { const k = run[i]; over = Math.max(over, k.t - k.dur); try { k.fn?.(1, 0); } catch (e) { console.error(e); } tasks.delete(k); try { k.end?.(); } catch (e) { console.error(e); } k.res(); }
    carry = over; if (depth < 24) setTimeout(settle, 0, depth + 1);
  }
  function confetti(at) { const cols = ['#ff6a8a', '#ffd23e', '#5fd068', '#3fb2ff', '#9a5cff']; cols.forEach(c => emit({ at: at.clone().add(V(0, 3.5, 0)), box: 2.2, n: 18, dir: [0, 1, 0], spread: 0.6, speed: [1, 3], gravity: 3, drag: 1.2, life: [1.4, 2.0], color: c, size: [0.16, 0.14], shape: 2, spin: 12, blend: 'alpha' })); }
  /** Số đối tượng hiệu ứng đang sống (để kiểm tra rò rỉ). */
  function stats() { let p = 0; for (const k in SYS) for (const q of SYS[k].P) if (q.on) p++; let pooled = trailPool.length; for (const k in meshPool) pooled += meshPool[k].length; return { tasks: tasks.size, particles: p, pooled, ...forms.stats() }; }

  Object.assign(fx, { update, tween, wait, emit, flash, ring, rune, impact, decal, knock, hop, syncStatus, clearStatus, confetti, stats, recipeOf,
    cast: forms.cast, support: forms.support, twist: forms.twist, statusBurst: forms.statusBurst, tick: forms.tick, enter: forms.enter, faint: forms.faint });
  return fx;
}
