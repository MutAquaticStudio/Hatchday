// Hiệu ứng của Đấu trường (Technical Artist): hệ hạt GPU hai lớp (cộng sáng và trộn thường), các hiệu ứng lưới
// (đạn chiêu, chém, tia, lốc, sét, cột nước, nhật thực, thiên thạch, lá chắn, vòng chữ trống đồng), chuyển động của quái thú
// (lao tới, bị đánh lùi, nhảy, gục, xuất hiện) và hiệu ứng trạng thái kéo dài.
// Ngôn ngữ hình khối theo hệ: Mộc lá + dây leo + gai gỗ · Thuỷ giọt + tia + cột nước · Phong lưỡi liềm + lốc + sét ·
// Dạ vết chém tối + trăng khuyết + nhật thực · Hoả cầu lửa + xoáy lửa + thiên thạch.
// Ba tầng độ "đã": đòn cơ bản ≈ 0,6 giây · tuyệt chiêu ≈ 1,2 giây · tối thượng ≈ 2,5 giây (tụ lực, máy quay cận cảnh, sân bừng sáng).
// Mọi thời lượng chạy theo đồng hồ của trận (timeScale) để nút tua nhanh áp dụng cho cả hiệu ứng.

export const ELEMENT_FX = [
  { c: '#4fd860', c2: '#d4ff7a', icon: '🌿' },
  { c: '#38a8ff', c2: '#c8f2ff', icon: '💧' },
  { c: '#8fe6ff', c2: '#ffffff', icon: '🌀' },
  { c: '#9a5cff', c2: '#e6d4ff', icon: '🌙' },
  { c: '#ff6a1a', c2: '#ffd23e', icon: '🔥' },
];

export function makeFx(THREE, scene, H) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0);
  const rand = (a, b) => a + Math.random() * (b - a), pick = a => (Array.isArray(a) ? rand(a[0], a[1]) : a);
  const fx = { timeScale: 1, freeze: 0, reduce: false };

  /* ---------- đồng hồ và tác vụ theo thời gian ---------- */
  const tasks = new Set();
  /** Chạy fn(u, dt) trong `dur` giây (u từ 0 tới 1); trả về Promise khi xong. */
  const tween = (dur, fn, end) => new Promise(res => tasks.add({ t: 0, dur: Math.max(1e-4, dur), fn, end, res }));
  const wait = s => tween(s);
  const easeOut = u => 1 - (1 - u) * (1 - u), easeIn = u => u * u, back = u => { const c = 1.7; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };

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
  const SYS = { add: particles(THREE.AdditiveBlending, 3000), alpha: particles(THREE.NormalBlending, 1600) };
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), tv = V();
  /** Phát hạt. at: điểm hoặc hàm(i) → điểm. dir + spread: hướng bắn; radial: bắn toả ra từ tâm; path: bay theo đường cong tới `to`. */
  function emit(o) {
    const sys = SYS[o.blend || 'add'], n = Math.round((o.n ?? 10) * (fx.reduce ? 0.5 : 1)), c1 = tmpC.set(o.color || '#ffffff').clone().multiplyScalar(o.hdr ?? 1), c2 = tmpC2.set(o.color2 || o.color || '#ffffff').clone().multiplyScalar(o.hdr ?? 1);
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
  const G = { ring: new THREE.RingGeometry(0.86, 1, 64), sphere: new THREE.SphereGeometry(1, 24, 16), cyl: new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), torus: new THREE.TorusGeometry(1, 0.05, 6, 48), arc: new THREE.TorusGeometry(1, 0.08, 6, 40, 2.4), arcThin: new THREE.TorusGeometry(1, 0.025, 4, 40, 2.4), cone: new THREE.ConeGeometry(1, 1, 7), ico: new THREE.IcosahedronGeometry(1, 2) };
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
  function beam(from, to, color, width, dur) {
    const d = to.clone().sub(from), L = d.length(), m = new THREE.Mesh(G.cyl, solid(color, { opacity: 0.85 })), core = new THREE.Mesh(G.cyl, addM('#ffffff', 1.4));
    [m, core].forEach(x => { x.position.copy(from).addScaledVector(d, 0.5); x.quaternion.setFromUnitVectors(UP, d.clone().normalize()); scene.add(x); });
    return tween(dur, u => { const grow = Math.min(1, u * 3), w = width * (u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3); [m, core].forEach((x, i) => { x.scale.set(w * (i ? 0.35 : 1), L * grow, w * (i ? 0.35 : 1)); x.position.copy(from).addScaledVector(d, grow * 0.5); }); m.material.opacity = 0.85 * (u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3); }, () => { drop(m); drop(core); });
  }
  /** Bay một vật theo đường cong bậc hai tới đích; `each(pos, dt)` để rải vệt. */
  function fly(obj, from, to, dur, { arc = 0.8, side = 0, spin = 0, each } = {}) {
    scene.add(obj); const mid = from.clone().lerp(to, 0.5).add(V(0, arc, 0)).add(H.side().multiplyScalar(side));
    return tween(dur, (u, dt) => { const w = easeIn(u) * 0.35 + u * 0.65, a = (1 - w) * (1 - w), b = 2 * (1 - w) * w, c = w * w; obj.position.set(a * from.x + b * mid.x + c * to.x, a * from.y + b * mid.y + c * to.y, a * from.z + b * mid.z + c * to.z); obj.rotation.z += spin * dt; if (each) each(obj.position, dt); }, () => drop(obj));
  }
  function orb(color, r) { const g = new THREE.Group(), core = new THREE.Mesh(G.sphere, solid('#fff6c8', { depthTest: false })); core.scale.setScalar(r * 0.55); g.add(core); const gl = sprite(color, r * 3, 1.6); g.add(gl); const sh = new THREE.Mesh(G.sphere, solid(color, { opacity: 0.92 })); sh.scale.setScalar(r); g.add(sh); core.renderOrder = 2; return g; }
  function slash(at, color, r, roll, dur = 0.28, dark = false) {
    const g = new THREE.Group(); g.position.copy(at); g.lookAt(H.camPos()); g.rotateZ(roll); scene.add(g);
    if (dark) { const d = new THREE.Mesh(G.arc, new THREE.MeshBasicMaterial({ color: '#12061f', transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })); d.scale.set(r, r, r * 3); g.add(d); }
    const b = new THREE.Mesh(G.arcThin, solid('#ffffff')), c = new THREE.Mesh(G.arc, solid(color, { opacity: 0.9 })); b.scale.set(r, r, r); c.scale.set(r * 1.02, r * 1.02, r * 1.4); g.add(c); g.add(b);
    return tween(dur, u => { g.rotation.z = roll + (u - 0.5) * 1.4; g.children.forEach(c => { c.material.opacity = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4; }); }, () => drop(g));
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
  function tornado(at, color, h, dur, lift) {
    const g = new THREE.Group(); g.position.copy(at); scene.add(g); const rs = [];
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(G.torus, solid(i % 2 ? '#58c8f0' : '#ffffff', { opacity: 0.6 })); m.rotation.x = Math.PI / 2; m.position.y = i * h / 7; g.add(m); rs.push(m); }
    return tween(dur, (u, dt) => { const k = Math.min(1, u * 3), out = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1; rs.forEach((m, i) => { const r = (0.45 + i * 0.16) * k; m.scale.set(r, r, r * 1.4); m.rotation.z += dt * (6 + i); m.material.opacity = 0.6 * out; });
      emit({ at: at.clone().add(V(rand(-0.6, 0.6), rand(0, h), rand(-0.6, 0.6))), n: 2, color, color2: '#ffffff', shape: 5, size: [0.25, 0.1], life: [0.3, 0.5], swirl: { c: at, k: 4 }, speed: [2, 3], spread: 0.1, dir: [0, 1, 0] }); if (lift) lift(Math.sin(u * Math.PI) * 0.5); }, () => drop(g));
  }
  function bolt(to, color) {
    const pts = [], top = to.clone().add(V(rand(-1, 1), 9, rand(-1, 1))); for (let i = 0; i <= 10; i++) { const p = top.clone().lerp(to, i / 10); if (i && i < 10) p.add(V(rand(-0.45, 0.45), 0, rand(-0.45, 0.45))); pts.push(p); }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.02), 60, 0.06, 5); geo.userData.temp = true; const m = new THREE.Mesh(geo, addM(color, 3)); scene.add(m);
    const gl = sprite(color, 2.5, 2.5); gl.position.copy(to); scene.add(gl); H.ui.flash(color, 0.35, 0.12); H.sfx('zap');
    return tween(0.22, u => { m.material.opacity = u < 0.5 ? 1 : (1 - u) * 2; gl.material.opacity = 1 - u; }, () => { drop(m); drop(gl); });
  }
  function explosion(at, el, power = 1) {
    const E = ELEMENT_FX[el]; burst(at, E.c, 1.4 * power, 0.4); flash(at, E.c2, 1.4 * power, 0.3); ring(at.clone().setY(H.ground + 0.03), E.c, 0.2, 2.2 * power, 0.5);
    emit({ at, n: 26 * power, radial: true, color: E.c2, color2: E.c, speed: [3, 7 * power], drag: 3, gravity: 3, life: [0.35, 0.7], size: [0.22, 0.05], shape: 1, hdr: 2 });
    if (el === 4 || el === 3) emit({ at, n: 14 * power, radial: true, up: 0.6, blend: 'alpha', color: el === 4 ? '#3a2a28' : '#1a0a2a', color2: '#000000', alpha: 0.65, speed: [0.6, 1.6], drag: 1.5, gravity: -0.6, life: [0.7, 1.2], size: [0.5, 1.4] });
  }

  /* ---------- chuyển động của quái thú ---------- */
  function lunge(a, d, k = 0.65) { const dir = d.pos.clone().sub(a.pos).setY(0), L = dir.length(); dir.normalize(); return tween(0.16, u => { a.off.copy(dir).multiplyScalar(L * k * easeOut(u)); }).then(() => { tween(0.24, u => { a.off.copy(dir).multiplyScalar(L * k * (1 - easeOut(u))); }); }); }
  function rearBack(a, dur = 0.18) { const dir = a.dir.clone().multiplyScalar(-0.35); return tween(dur, u => { a.off.copy(dir).multiplyScalar(Math.sin(u * Math.PI)); a.sq = Math.sin(u * Math.PI) * 0.06; }); }
  function knock(d, from, p = 1) { const dir = d.pos.clone().sub(from.pos).setY(0).normalize().multiplyScalar(0.32 * p); return tween(0.32, u => { const k = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75; d.off.copy(dir).multiplyScalar(k); d.sq = -0.12 * k; d.shake = (1 - u) * 0.05 * p; }); }
  function hop(a, h = 0.35, dur = 0.4) { return tween(dur, u => { a.off.y = Math.sin(u * Math.PI) * h; a.sq = Math.sin(u * Math.PI * 2) * 0.05; }); }
  function enter(a, el) { const E = ELEMENT_FX[el]; rune(a.pos, E.c, 1.4, 0.9, 0.4); beam(a.pos.clone().add(V(0, -0.2, 0)), a.pos.clone().add(V(0, 5, 0)), E.c, 0.28, 0.5); H.sfx('evolve'); emit({ at: a.pos, n: 30, radial: true, flat: true, up: 0.4, color: E.c2, color2: E.c, speed: [1.5, 3.5], drag: 2, life: [0.5, 0.9], size: [0.2, 0.04], shape: 1, hdr: 2 }); return tween(0.55, u => { a.k = back(u); }); }
  function faint(a, el) {
    const E = ELEMENT_FX[el]; H.sfx('faint');
    return tween(1.0, (u, dt) => { a.k = 1 - easeIn(u); a.tilt = u * 0.5; a.off.y = -u * 0.2; if (Math.random() < 0.6) emit({ at: a.center(), n: 2, box: 0.4, dir: [0, 1, 0], spread: 0.3, color: E.c2, color2: E.c, speed: [0.6, 1.4], life: [0.6, 1.0], size: [0.18, 0.04], shape: 1, hdr: 1.8 }); });
  }

  /* ---------- tác động khi trúng đòn ---------- */
  function impact(a, d, el, { power = 1, crit = false, mult = 1, onHit } = {}) {
    const E = ELEMENT_FX[el], at = d.center(), big = power * (mult > 1.3 ? 1.25 : 1) * (crit ? 1.3 : 1);
    burst(at, E.c, 0.9 * big, 0.3); flash(at, E.c, 1.1 * big, 0.3); ring(d.pos.clone().setY(H.ground + 0.03), E.c, 0.3, 1.6 * big, 0.45);
    emit({ at, n: 16 * big, radial: true, color: E.c, color2: E.c2, speed: [3, 6.5], drag: 4, life: [0.25, 0.45], size: [0.22, 0.05], shape: 1, blend: 'alpha' });
    emit({ at, n: 8 * big, radial: true, color: '#ffffff', speed: [4, 7], drag: 4, life: [0.2, 0.35], size: [0.14, 0.03], shape: 1, hdr: 1.6 });
    if (el === 0) emit({ at, n: 16, radial: true, color: E.c, color2: '#2f8a3a', speed: [2, 4], drag: 2, gravity: 4, life: [0.6, 1.0], size: [0.22, 0.16], shape: 2, spin: 8, blend: 'alpha' });
    if (el === 1) emit({ at, n: 22, radial: true, up: 0.8, color: '#9fdcff', color2: '#e8f8ff', speed: [2.5, 5], gravity: 9, life: [0.5, 0.8], size: [0.12, 0.06], shape: 4, blend: 'alpha' });
    if (el === 2) emit({ at, n: 16, radial: true, flat: true, color: '#ffffff', color2: E.c, speed: [5, 9], drag: 3, life: [0.2, 0.35], size: [0.35, 0.1], shape: 5, hdr: 1.6 });
    if (el === 3) emit({ at, n: 12, radial: true, blend: 'alpha', color: '#1a0a2a', color2: '#000000', alpha: 0.7, speed: [1, 2.5], drag: 2, life: [0.5, 0.9], size: [0.4, 0.9] });
    if (el === 4) emit({ at, n: 20, radial: true, up: 0.5, color: '#ffd23e', color2: '#ff3a0a', speed: [2, 5], drag: 2, gravity: -1, life: [0.4, 0.8], size: [0.18, 0.04], shape: 1, hdr: 2 });
    H.cam.shake(Math.min(1, 0.25 * big + (crit ? 0.3 : 0)));
    if (!fx.reduce && (crit || mult > 1.3)) fx.freeze = crit ? 0.12 : 0.07;
    if (crit) H.ui.flash('#ffffff', 0.45, 0.16);
    H.sfx(crit ? 'crit' : big > 1.3 ? 'hitBig' : 'hit');
    knock(d, a, Math.min(1.6, big));
    onHit?.();
  }

  /* ---------- cách ra chiêu theo hệ và tầng ---------- */
  async function deliverBasic(el, a, d) {
    const E = ELEMENT_FX[el], from = a.mouth(), to = d.center();
    if (el === 0) { H.sfx('leaf'); rearBack(a); emit({ at: from, n: 14, to, stagger: 0.025, life: 0.42, color: E.c, color2: E.c2, size: [0.3, 0.24], shape: 2, blend: 'alpha', wobble: 0.5, arc: 0.6 }); await wait(0.5); return; }
    if (el === 1) { H.sfx('water'); rearBack(a); beam(from, to, E.c, 0.14, 0.45); emit({ at: from, n: 16, to, stagger: 0.015, life: 0.3, color: '#d8f4ff', size: [0.14, 0.1], shape: 4, wobble: 0.15, arc: 0.1, blend: 'alpha' }); await wait(0.32); return; }
    if (el === 2) { H.sfx('wind'); rearBack(a); const p = []; for (let s = -1; s <= 1; s += 2) { const g = new THREE.Group(), m = new THREE.Mesh(G.arc, solid('#3fb8ec')), w = new THREE.Mesh(G.arcThin, solid('#ffffff')); m.scale.set(0.45, 0.45, 1.6); w.scale.set(0.45, 0.45, 1); g.add(m); g.add(w); g.lookAt(H.camPos()); p.push(fly(g, from.clone(), to.clone(), 0.38, { arc: 0.3, side: s * 0.8, spin: 18, each: q => emit({ at: q, n: 1, color: '#ffffff', size: [0.2, 0.05], life: 0.2, speed: 0.2, shape: 5 }) })); } await Promise.all(p); return; }
    if (el === 3) { H.sfx('shadow'); await lunge(a, d, 0.62); for (let i = 0; i < 3; i++) { slash(d.center().add(V(0, (i - 1) * 0.15, 0)), E.c, 0.7, -0.8 + i * 0.8, 0.26, true); await wait(0.05); } return; }
    H.sfx('fire'); rearBack(a); await fly(orb(E.c, 0.22), from, to, 0.42, { arc: 0.7, each: q => emit({ at: q, n: 2, color: '#ffd23e', color2: '#ff3a0a', size: [0.25, 0.04], life: [0.25, 0.4], speed: [0.2, 0.6], shape: 0, hdr: 1.8 }) });
  }
  async function deliverSig(el, a, d, lift) {
    const E = ELEMENT_FX[el], from = a.mouth(), to = d.center();
    if (el === 0) { H.sfx('leaf'); rune(d.pos, E.c, 1.2, 0.5, 0.3); vines(d.pos, '#3f9a46', 5, 1.9, 1.0); emit({ at: i => d.center().add(V(Math.cos(i) * 1.1, rand(-0.6, 0.8), Math.sin(i) * 1.1)), n: 26, swirl: { c: d.pos, k: 5 }, dir: [0, 0.3, 0], spread: 0.1, speed: [2, 3], life: [0.6, 0.9], color: E.c, color2: E.c2, size: [0.3, 0.2], shape: 2, spin: 10, blend: 'alpha' }); await wait(0.55); return; }
    if (el === 1) { H.sfx('water'); rearBack(a, 0.25); for (let i = 0; i < 7; i++) { const g = new THREE.Group(), b = new THREE.Mesh(G.sphere, addM('#bfe8ff', 1.1, { opacity: 0.45 })), hl = sprite('#ffffff', 0.12, 2); hl.position.set(-0.05, 0.06, 0.1); b.add(hl); b.scale.setScalar(0.16); g.add(b); fly(g, from.clone(), to.clone().add(V(rand(-0.3, 0.3), rand(-0.3, 0.3), 0)), 0.5, { arc: rand(0.2, 0.9), side: rand(-0.7, 0.7) }); await wait(0.05); }
      await wait(0.42); const col = new THREE.Mesh(G.cyl, addM(E.c, 1.5, { opacity: 0.7 })); col.position.copy(d.pos); scene.add(col); tween(0.5, u => { col.scale.set(0.8 * (1 - u * 0.4), 3 * easeOut(Math.min(1, u * 2.5)), 0.8 * (1 - u * 0.4)); col.position.y = H.ground + col.scale.y / 2; col.material.opacity = 0.7 * (1 - u); }, () => drop(col)); return; }
    if (el === 2) { H.sfx('wind'); await tornado(d.pos, E.c, 2.4, 0.9, lift); return; }
    if (el === 3) { H.sfx('shadow'); emit({ at: i => to.clone().add(V(Math.cos(i * 1.3) * 1.6, rand(-0.5, 0.8), Math.sin(i * 1.3) * 1.6)), n: 12, to, life: 0.45, color: '#1a0a2a', size: [0.5, 0.2], blend: 'alpha', alpha: 0.85, arc: 0, wobble: 0.1 }); await wait(0.35);
      const g = new THREE.Group(), m = new THREE.Mesh(G.arc, solid('#d8b8ff')); m.scale.set(1.4, 1.4, 4); g.add(m); const w = new THREE.Mesh(G.arcThin, solid('#ffffff')); w.scale.set(1.42, 1.42, 2); g.add(w); const dk = new THREE.Mesh(G.arc, new THREE.MeshBasicMaterial({ color: '#12061f', transparent: true, depthWrite: false, side: THREE.DoubleSide })); dk.scale.set(1.3, 1.3, 9); g.add(dk); g.position.copy(to); g.lookAt(H.camPos()); scene.add(g);
      await tween(0.32, u => { g.rotation.z = -1.6 + u * 2.4; g.children.forEach(c => { c.material.opacity = u < 0.7 ? 1 : (1 - u) / 0.3; }); }, () => drop(g)); return; }
    H.sfx('fire'); emit({ at: i => d.pos.clone().add(V(Math.cos(i * 0.7) * 1.0, 0.1, Math.sin(i * 0.7) * 1.0)), n: 50, swirl: { c: d.pos, k: 3 }, dir: [0, 1, 0], spread: 0.1, speed: [2.5, 4], life: [0.4, 0.7], color: '#ffc21e', color2: '#e8340a', size: [0.4, 0.08], shape: 4, blend: 'alpha' });
    emit({ at: i => d.pos.clone().add(V(Math.cos(i * 0.9) * 0.9, 0.1, Math.sin(i * 0.9) * 0.9)), n: 24, swirl: { c: d.pos, k: 3 }, dir: [0, 1, 0], spread: 0.1, speed: [2.5, 4], life: [0.3, 0.5], color: '#fff2a0', size: [0.25, 0.04], hdr: 1.6 });
    const cone = new THREE.Mesh(G.cone, solid('#ff7a1a', { opacity: 0.85 })); cone.position.copy(d.pos); scene.add(cone); await tween(0.55, u => { cone.scale.set(0.9 * (1 - u * 0.3), 3.2 * easeOut(Math.min(1, u * 2)), 0.9 * (1 - u * 0.3)); cone.position.y = H.ground + cone.scale.y / 2; cone.material.opacity = 0.85 * (1 - u); }, () => drop(cone));
  }
  async function charge(a, el) {
    const E = ELEMENT_FX[el]; H.ui.darken(0.6); H.stage.setGlow(1); H.cam.shot('attacker', a); H.sfx('power');
    rune(a.pos, E.c, 1.8, 1.0, 0.6);
    for (let i = 0; i < 10; i++) { emit({ at: k => a.center().add(V(Math.cos(k * 0.9 + i) * 2.4, rand(-1, 1.6), Math.sin(k * 0.9 + i) * 2.4)), n: 6, to: a.center(), life: 0.4, color: E.c2, color2: E.c, size: [0.25, 0.06], shape: 1, hdr: 2.2, arc: 0, wobble: 0.2 }); await wait(0.07); }
    ring(a.center(), E.c, 0.4, 2.6, 0.4, { flat: false }); flash(a.center(), E.c2, 3, 0.35); H.ui.flash(E.c, 0.35, 0.2); H.cam.shake(0.35);
    await wait(0.2); H.cam.shot('wide'); H.ui.darken(0.25);
  }
  async function deliverUlt(el, a, d, lift) {
    const E = ELEMENT_FX[el], to = d.center();
    await charge(a, el);
    if (el === 0) { H.sfx('leaf'); spikeBurst(d.pos, '#6b8a3a', 8, 1.5, 1.0, 1.25); await wait(0.35); spikeBurst(d.pos, '#4f9a4a', 1, 2.6, 0.8, 0); emit({ at: i => d.center().add(V(Math.cos(i) * 1.5, rand(-0.6, 1.2), Math.sin(i) * 1.5)), n: 50, swirl: { c: d.pos, k: 6 }, speed: [2.5, 4], life: [0.7, 1.0], color: E.c, color2: E.c2, size: [0.32, 0.22], shape: 2, spin: 10, blend: 'alpha' }); await wait(0.3); }
    if (el === 1) { H.sfx('water'); const col = new THREE.Mesh(G.cyl, addM(E.c, 1.5, { opacity: 0.75 })), core = new THREE.Mesh(G.cyl, addM('#ffffff', 1.4, { opacity: 0.5 })); [col, core].forEach(c => { c.position.copy(d.pos); scene.add(c); });
      emit({ at: i => d.pos.clone().add(V(rand(-3, 3), 7, rand(-3, 3))), n: 80, dir: [0, -1, 0], spread: 0.05, speed: [10, 14], life: [0.6, 0.8], color: '#bfe8ff', size: [0.25, 0.25], shape: 5, blend: 'alpha', alpha: 0.7 });
      ring(d.pos.clone().setY(H.ground + 0.05), '#d8f4ff', 0.5, 4.5, 0.9, { hdr: 1.6 });
      await tween(0.8, u => { const h = 4.5 * easeOut(Math.min(1, u * 2)); col.scale.set(1.0, h, 1.0); core.scale.set(0.5, h, 0.5); [col, core].forEach(c => { c.position.y = H.ground + h / 2; c.rotation.y += 0.2; }); col.material.opacity = 0.75 * (1 - Math.max(0, u - 0.6) / 0.4); core.material.opacity = col.material.opacity * 0.6; if (lift) lift(Math.sin(u * Math.PI) * 0.8); }, () => { drop(col); drop(core); }); }
    if (el === 2) { tornado(d.pos, E.c, 3.2, 1.2, lift); for (let i = 0; i < 3; i++) { await wait(0.22); bolt(to.clone().add(V(rand(-0.2, 0.2), 0, rand(-0.2, 0.2))), '#e8fbff'); flash(to, '#ffffff', 2.2, 0.15); } await wait(0.2); }
    if (el === 3) { H.sfx('shadow'); const sph = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: '#0a0418', transparent: true, depthWrite: false })), rim = new THREE.Mesh(G.torus, addM(E.c2, 1.7)); sph.position.copy(to); rim.position.copy(to); rim.lookAt(H.camPos()); scene.add(sph); scene.add(rim);
      await tween(0.9, (u, dt) => { const s = u < 0.75 ? 2.0 * easeOut(u / 0.75) : 2.0 * (1 - (u - 0.75) / 0.25); sph.scale.setScalar(Math.max(0.01, s)); rim.scale.set(s * 1.05, s * 1.05, s * 3); rim.rotation.z += dt * 3; sph.material.opacity = 0.9; }, () => { drop(sph); drop(rim); });
      flash(to, E.c2, 2.4, 0.35); H.ui.flash('#e6d4ff', 0.35, 0.2); }
    if (el === 4) { H.sfx('fire'); const start = to.clone().add(V(-4, 9, -3)); await fly(orb(E.c, 0.6), start, to, 0.6, { arc: 0, each: q => { emit({ at: q, n: 5, box: 0.25, color: '#ffd23e', color2: '#ff3a0a', size: [0.5, 0.06], life: [0.3, 0.5], speed: [0.3, 1], hdr: 2 }); emit({ at: q, n: 1, blend: 'alpha', color: '#3a2a28', color2: '#000000', alpha: 0.5, size: [0.6, 1.2], life: [0.6, 0.9], speed: 0.3 }); } });
      explosion(to, 4, 2.2); ring(d.pos.clone().setY(H.ground + 0.05), '#ffd23e', 0.5, 5, 0.7); }
  }

  /* ---------- hỗ trợ ---------- */
  async function support(m, a) {
    const E = ELEMENT_FX[m.element];
    if (m.kind === 'guard') { H.sfx('shield'); rune(a.pos, E.c, 1.2, 0.5, 0.2); hop(a, 0.15, 0.3); await wait(0.45); return; }
    if (m.kind === 'boost') { H.sfx('power'); for (let i = 0; i < 3; i++) { ring(a.pos.clone().add(V(0, 0.1 + i * 0.5, 0)), i === 1 ? '#ff6a3a' : E.c, 0.6, 1.2, 0.6); await wait(0.1); }
      emit({ at: a.pos, n: 30, box: 0.6, flat: true, dir: [0, 1, 0], spread: 0.15, speed: [2, 4], life: [0.4, 0.7], color: '#ffb03a', color2: '#ff3a1a', size: [0.2, 0.04], shape: 1, hdr: 2 }); if (m.twist === 'focus') flash(a.head(), '#ffffff', 0.8, 0.3); await hop(a, 0.25, 0.35); return; }
    H.sfx('heal'); beam(a.pos.clone(), a.pos.clone().add(V(0, 4, 0)), '#9cffb0', 0.9, 0.8);
    emit({ at: a.pos, n: 40, box: 0.7, flat: true, dir: [0, 1, 0], spread: 0.1, speed: [1, 2.4], life: [0.6, 1.0], color: '#d4ffd8', color2: '#5fd068', size: [0.22, 0.05], shape: 1, hdr: 2 });
    if (m.twist === 'cleanse') ring(a.center(), '#ffffff', 0.3, 1.8, 0.5, { flat: false }); await wait(0.6);
  }

  /* ---------- trạng thái kéo dài trên người quái thú ---------- */
  function syncStatus(s, f, dt) {
    const L = s.loops || (s.loops = {}), want = { root: !!f.status.root, daze: !!f.status.daze, shield: f.guard > 0 && f.hp > 0 };
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
    const c = s.center(), hd = s.head(), t = clock;
    if (L.root) L.root.position.copy(s.pos).setY(H.ground + 0.04), L.root.rotation.y += dt * 0.4;
    if (L.daze) L.daze.children.forEach((m, i) => { const a = t * 3 + i * 2.1; m.position.set(hd.x + Math.cos(a) * 0.45, hd.y + 0.35 + Math.sin(a * 2) * 0.05, hd.z + Math.sin(a) * 0.45); m.lookAt(H.camPos()); });
    if (L.shield) { L.shieldT = Math.min(1, L.shieldT + dt * 5); L.shield.position.copy(c); L.shield.scale.setScalar(s.r * 1.25 * back(L.shieldT)); L.shield.material.uniforms.uT.value = t; L.shield.rotation.y += dt * 0.3; }
    s.emitT = (s.emitT || 0) - dt; if (s.emitT > 0 || f.hp <= 0) return; s.emitT = 0.08;
    if (f.status.burn) emit({ at: c, box: s.r * 0.6, n: 2, dir: [0, 1, 0], spread: 0.2, speed: [0.8, 1.6], life: [0.3, 0.5], color: '#ffd23e', color2: '#ff3a0a', size: [0.28, 0.05], hdr: 2 });
    if (f.status.soak) emit({ at: c, box: s.r * 0.6, n: 1, dir: [0, -1, 0], spread: 0.05, speed: [0.2, 0.5], gravity: 6, life: [0.4, 0.6], color: '#9fdcff', size: [0.09, 0.07], shape: 4, blend: 'alpha' });
    if (f.status.blind) emit({ at: hd, box: 0.25, n: 1, dir: [0, 1, 0], spread: 0.5, speed: [0.1, 0.3], life: [0.6, 1.0], color: '#1a0a2a', color2: '#000000', alpha: 0.6, size: [0.35, 0.6], blend: 'alpha' });
    if (f.boost && Math.random() < 0.5) emit({ at: s.pos, box: s.r * 0.6, flat: true, n: 1, dir: [0, 1, 0], spread: 0.1, speed: [1, 1.8], life: [0.4, 0.6], color: '#ffb03a', color2: '#ff3a1a', size: [0.14, 0.03], shape: 1, hdr: 1.8 });
    if (f.regen && Math.random() < 0.5) emit({ at: c, box: s.r * 0.6, n: 1, dir: [0, 1, 0], spread: 0.2, speed: [0.5, 1], life: [0.5, 0.8], color: '#9cffb0', size: [0.14, 0.03], shape: 1, hdr: 1.8 });
  }
  function clearStatus(s) { if (!s.loops) return; for (const k of ['root', 'daze', 'shield']) if (s.loops[k]) { drop(s.loops[k]); s.loops[k] = null; } }

  /* ---------- vòng lặp ---------- */
  let clock = 0;
  function update(realDt, sizeK) {
    for (const k in SYS) SYS[k].m.uniforms.uScale.value = sizeK;
    if (fx.freeze > 0) { fx.freeze -= realDt; return 0; }
    const dt = realDt * fx.timeScale; clock += dt;
    for (const k of [...tasks]) { k.t += dt; const u = Math.min(1, k.t / k.dur); try { k.fn?.(u, dt); } catch (e) { console.error(e); } if (u >= 1) { tasks.delete(k); k.end?.(); k.res(); } }
    stepParticles(dt);
    return dt;
  }
  function confetti(at) { const cols = ['#ff6a8a', '#ffd23e', '#5fd068', '#3fb2ff', '#9a5cff']; cols.forEach(c => emit({ at: at.clone().add(V(0, 3.5, 0)), box: 2.2, n: 18, dir: [0, 1, 0], spread: 0.6, speed: [1, 3], gravity: 3, drag: 1.2, life: [1.4, 2.0], color: c, size: [0.16, 0.14], shape: 2, spin: 12, blend: 'alpha' })); }

  Object.assign(fx, { update, tween, wait, emit, flash, ring, rune, impact, lunge, knock, hop, enter, faint, support, syncStatus, clearStatus, confetti, explosion, deliverBasic, deliverSig, deliverUlt,
    /** Vệt tốc độ (nét riêng "ra đòn trước"). */ dash(a) { H.sfx('whoosh'); emit({ at: i => a.center().add(V(rand(-0.6, 0.6), rand(-0.5, 0.5), rand(-0.6, 0.6))), n: 16, dir: a.dir.clone().negate(), spread: 0.05, speed: [8, 12], life: [0.15, 0.25], color: '#ffffff', size: [0.35, 0.1], shape: 5, hdr: 1.6 }); },
    /** Hút thể lực: hạt xanh bay từ đối thủ về người đánh. */ drain(a, d) { H.sfx('heal'); emit({ at: d.center(), box: 0.3, n: 14, to: a.center(), stagger: 0.03, life: 0.5, color: '#9cffb0', color2: '#5fd068', size: [0.2, 0.06], shape: 1, hdr: 2, arc: 0.6 }); return wait(0.6); },
    /** Lá chắn vỡ khi bị xuyên. */ shatter(d) { if (!d.loops?.shield) return; emit({ at: d.center(), n: 30, radial: true, color: '#e8fbff', speed: [3, 6], drag: 2, gravity: 5, life: [0.5, 0.8], size: [0.16, 0.06], shape: 4, hdr: 1.6 }); H.sfx('zap'); },
    /** Đốm sáng ở người đánh (phản lực, giáp gai, hút máu, xoá trạng thái). */ self(a, color) { flash(a.center(), color, 1.2, 0.25); emit({ at: a.center(), n: 12, radial: true, color, speed: [2, 3.5], drag: 3, life: [0.3, 0.5], size: [0.14, 0.03], shape: 1, hdr: 2 }); } });
  return fx;
}
