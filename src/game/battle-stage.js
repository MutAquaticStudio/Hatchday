// Sân đấu của Đấu trường: 5 map theo năm hệ, dựng hoàn toàn bằng code theo lối cel shading (tô 3 nấc + viền mực).
// Chung cho mọi sân: bệ đá tròn, mặt sàn khắc hoa văn trống đồng (sao giữa, vòng chim bay, răng cưa, vòng tròn chấm),
// năm trụ ngũ hành mang tinh thể năm màu (trụ cùng hệ với sân sáng hơn), cờ hai bên, bầu trời và hạt bay theo cảnh.
// Luật sân (chiêu cùng hệ mạnh thêm 10%) ở battle.ts. Sân được dựng một lần rồi dùng lại.
import { _t } from '../i18n';
import { hdThree, inkMaterial, inkNormals, rockGeo as hdRock, blobGeo, spireGeo, gemGeo, pick } from './hd.js';
import { bakeStatic } from './places/world.js';

export const ARENAS = [
  { el: 0, name: _t('Rừng Cổ Thụ'), sky: ['#7fc6ff', '#ffe9b8', '#5a8f4a'], fog: '#cfe6c0', stone: '#b9b29a', line: '#6f6450', glow: '#7dff8a', sun: '#fff1d6', hemi: ['#d9f2ff', '#4f6b3a'], key: 2.4 },
  { el: 1, name: _t('Hồ Thác Bạc'), sky: ['#5fb4ff', '#d8f3ff', '#3a7fb0'], fog: '#bfe3f5', stone: '#a9bfc8', line: '#4f6a78', glow: '#7fd8ff', sun: '#f4fbff', hemi: ['#dff4ff', '#3d6a80'], key: 2.3 },
  { el: 2, name: _t('Đỉnh Mây Treo'), sky: ['#2f74e0', '#b8dcff', '#cfe0ff'], fog: '#c8dcf5', stone: '#9fa9bc', line: '#4a5468', glow: '#9ae8ff', sun: '#ffffff', hemi: ['#e0ecff', '#6a7488'], key: 2.1 },
  { el: 3, name: _t('Phế Tích Trăng'), sky: ['#0b0f2e', '#3a2a6e', '#1a1638'], fog: '#2a2450', stone: '#7d7a9a', line: '#3a3660', glow: '#b48cff', sun: '#c8d0ff', hemi: ['#8a90ff', '#1a1430'], key: 1.6 },
  { el: 4, name: _t('Miệng Núi Lửa'), sky: ['#3a1410', '#ff8a3a', '#2a0f0c'], fog: '#5a2a1c', stone: '#6a5a58', line: '#2a1c1c', glow: '#ffb13a', sun: '#ffd0a0', hemi: ['#ffb890', '#3a1410'], key: 2.0 },
];
const ELC = ['#5fd068', '#3fb2ff', '#9ee8ff', '#9a5cff', '#ff6a1a'];

const h1 = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function makeStageKit(THREE0) {
  const THREE = hdThree(THREE0);   // khối tròn nhiều múi theo tầng chất lượng (hd.js)
  const ramp = new THREE.DataTexture(new Uint8Array([120, 120, 130, 255, 196, 196, 204, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  const mats = new Map(), inks = new Map();
  /** Vật liệu cel theo màu (dùng chung). */
  const cel = (color, o = {}) => { const k = color + JSON.stringify(o); let m = mats.get(k); if (!m) { m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...o }); mats.set(k, m); } return m; };
  /** Viền mực dùng chung (hd.js): độ dày theo màn hình, không phình khi vật bị phóng to. `t` là độ dày cũ tính theo đơn vị thế giới (0.03 = nét chuẩn). */
  const inkM = (t, col = '#1a1424') => inkMaterial(THREE, col, { k: t / 0.03 });
  const inkS = (t, col = '#1a1424') => inkMaterial(THREE, col, { k: t / 0.03, smooth: true });
  function put(parent, geo, mat, { x = 0, y = 0, z = 0, ink = 0.03, shadow = true, recv = true } = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = recv; parent.add(m);
    if (ink) { inkNormals(THREE, geo); const o = new THREE.Mesh(geo, inkS(ink)); o.raycast = () => {}; m.add(o); }
    return m;
  }
  /** Tảng đá / vách / mỏm: khối tròn chia nhỏ, vạt mặt và dời theo nhiễu, pháp tuyến mượt (hd.js). `det` cũ giữ chữ ký, không còn dùng. */
  const rockGeo = seed => hdRock(THREE, Math.round(seed) % 24);

  /* ---------- mặt sàn: hoa văn trống đồng ---------- */
  function drumTex(A) {
    const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), e = document.createElement('canvas'); e.width = e.height = N; const ge = e.getContext('2d');
    g.fillStyle = A.stone; g.fillRect(0, 0, N, N); ge.fillStyle = '#000'; ge.fillRect(0, 0, N, N);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + h1(i) * 0.05})`; g.beginPath(); g.arc(h1(i * 3) * N, h1(i * 5) * N, 2 + h1(i * 7) * 9, 0, 7); g.fill(); }
    const C = N / 2, both = f => { g.strokeStyle = g.fillStyle = A.line; f(g); ge.strokeStyle = ge.fillStyle = A.glow; f(ge); };
    const ring = r => both(x => { x.lineWidth = 5; x.beginPath(); x.arc(C, C, r, 0, 7); x.stroke(); });
    // ngôi sao giữa 14 cánh
    both(x => { x.beginPath(); for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, r = i % 2 ? 34 : 104; x.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r); } x.closePath(); x.fill(); });
    [118, 132].forEach(ring);
    // vòng tròn tiếp tuyến có chấm giữa
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, x0 = C + Math.cos(a) * 158, y0 = C + Math.sin(a) * 158; both(x => { x.lineWidth = 4; x.beginPath(); x.arc(x0, y0, 17, 0, 7); x.stroke(); x.beginPath(); x.arc(x0, y0, 5, 0, 7); x.fill(); }); }
    [184, 198].forEach(ring);
    // răng cưa
    both(x => { x.beginPath(); for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2, r = i % 2 ? 206 : 228; x.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r); } x.lineWidth = 4; x.stroke(); });
    [236, 248].forEach(ring);
    // vòng chim bay (đầu nhọn, cánh vút, đuôi dài) theo chiều kim đồng hồ
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = 300; both(x => { x.save(); x.translate(C + Math.cos(a) * r, C + Math.sin(a) * r); x.rotate(a + Math.PI / 2); x.lineWidth = 5;
      x.beginPath(); x.moveTo(-34, 6); x.quadraticCurveTo(-6, -4, 30, 0); x.lineTo(42, -2); x.stroke(); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(-8, -26, -26, -34); x.stroke(); x.beginPath(); x.moveTo(-30, 6); x.lineTo(-52, 16); x.stroke(); x.restore(); }); }
    [352, 366].forEach(ring);
    // vạch thang
    for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; both(x => { x.lineWidth = 4; x.beginPath(); x.moveTo(C + Math.cos(a) * 372, C + Math.sin(a) * 372); x.lineTo(C + Math.cos(a) * 394, C + Math.sin(a) * 394); x.stroke(); }); }
    [400, 412].forEach(ring);
    // vòng chấm ngoài cùng
    for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; both(x => { x.beginPath(); x.arc(C + Math.cos(a) * 440, C + Math.sin(a) * 440, 7, 0, 7); x.fill(); }); }
    [470, 490].forEach(ring);
    const mk = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    return { map: mk(c), emissive: mk(e) };
  }

  /* ---------- bầu trời: dải màu dọc + mặt trời/trăng + sao ---------- */
  function sky(A, moon) {
    const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTop: { value: new THREE.Color(A.sky[0]) }, uMid: { value: new THREE.Color(A.sky[1]) }, uBot: { value: new THREE.Color(A.sky[2]) }, uStars: { value: moon ? 1 : 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec3 vD; void main() { vD = normalize( position ); gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
      fragmentShader: `uniform vec3 uTop, uMid, uBot; uniform float uStars, uT; varying vec3 vD;
        float h( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
        void main() { float y = vD.y; vec3 c = y > 0.0 ? mix( uMid, uTop, smoothstep( 0.0, 0.55, y ) ) : mix( uMid, uBot, smoothstep( 0.0, -0.25, y ) );
          c = floor( c * 24.0 ) / 24.0;
          if ( uStars > 0.5 && y > 0.05 ) { vec2 q = floor( vD.xz / ( y + 0.4 ) * 180.0 ); float s = step( 0.996, h( q ) ) * ( 0.6 + 0.4 * sin( uT * 2.0 + h( q + 3.0 ) * 30.0 ) ); c += vec3( s ); }
          gl_FragColor = vec4( c, 1.0 ); }` });
    const s = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), m); s.renderOrder = -10; s.userData.sky = m; return s;
  }

  /* ---------- hạt bay của cảnh (đom đóm, bụi nước, vệt gió, sao, tàn lửa) ---------- */
  function motes(n, { color, size, area, rise, sway, add = true }) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = (h1(i * 3.1) - 0.5) * area[0]; p[i * 3 + 1] = h1(i * 5.7) * area[1]; p[i * 3 + 2] = (h1(i * 7.3) - 0.5) * area[2] - area[2] * 0.2; seed[i] = h1(i * 9.1); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(color) }, uS: { value: size }, uH: { value: area[1] }, uRise: { value: rise }, uSway: { value: sway } },
      vertexShader: `attribute float aSeed; uniform float uT, uS, uH, uRise, uSway; varying float vA;
        void main() { vec3 p = position; p.y = mod( p.y + uT * uRise * ( 0.5 + aSeed ), uH ); p.x += sin( uT * ( 0.6 + aSeed ) + aSeed * 30.0 ) * uSway; p.z += cos( uT * ( 0.5 + aSeed ) + aSeed * 20.0 ) * uSway;
          vA = ( 0.5 + 0.5 * sin( uT * 3.0 + aSeed * 40.0 ) ) * smoothstep( 0.0, 0.15 * uH, p.y ) * smoothstep( uH, uH * 0.7, p.y );
          vec4 mv = modelViewMatrix * vec4( p, 1.0 ); gl_PointSize = uS * 300.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform vec3 uC; varying float vA; void main() { float d = length( gl_PointCoord - 0.5 ); if ( d > 0.5 ) discard; gl_FragColor = vec4( uC, vA * smoothstep( 0.5, 0.1, d ) ); }' });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.userData.mat = m; return pts;
  }

  /* ---------- đồ dựng theo cảnh ---------- */
  function tree(par, x, z, s, A) {
    const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); t.rotation.y = h1(x * 3 + z) * 6; par.add(t);
    put(t, new THREE.CylinderGeometry(0.28, 0.5, 4, 9, pick(1, 4, 6)), cel('#6b4a34'), { y: 2, ink: 0.04 });
    [[0, 4.6, 0, 1.9], [-1.0, 3.9, 0.4, 1.3], [1.0, 4.0, -0.3, 1.4], [0.2, 5.6, 0.1, 1.3]].forEach(([a, b, c, r], i) => { const m = put(t, blobGeo(THREE, (i * 5 + Math.round(Math.abs(x) * 3)) % 12, { lumps: 12, amp: 0.34, det: pick(2, 3, 5) }), cel(['#4f9a4a', '#5fb05a', '#468a44', '#6cc066'][i]), { x: a, y: b, z: c, ink: 0.05 }); m.scale.setScalar(r); });
  }
  function column(par, x, z, h, broken, col) {
    const g = new THREE.Group(); g.position.set(x, 0, z); par.add(g);
    put(g, new THREE.BoxGeometry(1.2, 0.35, 1.2), cel(col), { y: 0.18, ink: 0.03 });
    put(g, new THREE.CylinderGeometry(0.42, 0.48, h, 12), cel(col), { y: 0.35 + h / 2, ink: 0.03 });
    if (!broken) put(g, new THREE.BoxGeometry(1.1, 0.3, 1.1), cel(col), { y: 0.5 + h, ink: 0.03 });
    else { const c = put(g, new THREE.CylinderGeometry(0.36, 0.42, 0.6, 12), cel(col), { x: 0.9, y: 0.3, z: 0.4, ink: 0.03 }); c.rotation.z = 1.4; }
    return g;
  }

  /** Dựng sân theo hệ `el` (0..4). Trả về { group, ground, update(t), setGlow(k), lights, arena }. */
  function build(el) {
    const A = ARENAS[el], G = new THREE.Group(), anim = [], glowMats = [];
    const tex = drumTex(A), gy = 0.35;
    // bệ đá và mặt trống đồng
    const topM = new THREE.MeshToonMaterial({ color: '#ffffff', map: tex.map, gradientMap: ramp, emissive: '#ffffff', emissiveMap: tex.emissive, emissiveIntensity: 0.12 }); glowMats.push(topM);
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 5.15, gy, 72), [cel(A.stone), topM, cel(A.stone)]); plat.position.y = gy / 2; plat.receiveShadow = true; plat.castShadow = true; G.add(plat);
    { inkNormals(THREE, plat.geometry); const o = new THREE.Mesh(plat.geometry, inkS(0.04)); plat.add(o); }
    put(G, new THREE.TorusGeometry(4.98, 0.11, 8, 96), cel('#b88a3a'), { y: gy, ink: 0.02 }).rotation.x = Math.PI / 2;
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, b = put(G, new THREE.BoxGeometry(0.9, 0.42, 0.55), cel(i % 2 ? A.stone : A.line), { x: Math.cos(a) * 5.45, y: 0.12, z: Math.sin(a) * 5.45, ink: 0.025 }); b.rotation.y = -a; b.scale.y = 0.7 + h1(i) * 0.5; }
    // năm trụ ngũ hành phía sau
    const pillars = [];
    ELC.forEach((c, i) => { const a = Math.PI * (1.12 + i * 0.19), x = Math.cos(a) * 6.6, z = Math.sin(a) * 6.6, P = column(G, x, z, 2.6 + (i === 2 ? 0.6 : 0), false, A.stone);
      const cm = new THREE.MeshToonMaterial({ color: c, gradientMap: ramp, emissive: c, emissiveIntensity: i === el ? 1.4 : 0.45 }); glowMats.push(cm);
      const cr = put(P, gemGeo(THREE, 8), cm, { y: 3.75 + (i === 2 ? 0.6 : 0), ink: 0.025 }); cr.scale.set(0.62, 0.67, 0.62); cr.userData.keep = true; pillars.push(cr); });
    anim.push(t => pillars.forEach((p, i) => { p.rotation.y = t * 0.6 + i; p.position.y += Math.sin(t * 1.5 + i) * 0.002; }));
    // cờ hai bên
    [-1, 1].forEach(s => { const x = s * 6.2, z = 1.8; put(G, new THREE.CylinderGeometry(0.07, 0.09, 5.2, 8), cel('#5a3a24'), { x, y: 2.6, z, ink: 0.02 });
      const fl = new THREE.Group(); fl.userData.keep = true; fl.position.set(x + s * 0.06, 4.5, z); G.add(fl); const cloth = put(fl, new THREE.PlaneGeometry(1.1, 2.4, pick(1, 6, 10), pick(8, 20, 32)), cel(ELC[el], { side: THREE.DoubleSide }), { x: s * 0.6, y: -1.0, ink: 0 });
      anim.push(t => { const p = cloth.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 2.4 + p.getY(i) * 2 + s) * 0.12 * (1 - (p.getY(i) + 1.2) / 2.4)); p.needsUpdate = true; }); });

    // cảnh nền
    const ground = (col, y = -0.02) => { const g = new THREE.CircleGeometry(60, 48); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, cel(col)); m.position.y = y; m.receiveShadow = true; G.add(m); return m; };
    if (el === 0) {
      ground('#6fae55');
      for (let i = 0; i < 26; i++) { const a = Math.PI * (0.9 + h1(i) * 1.3), r = 10 + h1(i * 2) * 10; tree(G, Math.cos(a) * r, Math.sin(a) * r, 0.8 + h1(i * 3) * 0.7, A); }
      for (let i = 0; i < 40; i++) { const a = h1(i * 5) * Math.PI * 2, r = 6.2 + h1(i * 7) * 5, b = put(G, rockGeo(i, 0), cel(i % 3 ? '#5a9a4a' : '#4a8a42'), { x: Math.cos(a) * r, y: 0.2, z: Math.sin(a) * r, ink: 0.03 }); b.scale.set(0.6 + h1(i) * 0.6, 0.45, 0.6 + h1(i + 1) * 0.6); }
      for (let i = 0; i < 18; i++) { const a = h1(i * 11) * Math.PI * 2, r = 5.8 + h1(i * 13) * 3, x = Math.cos(a) * r, z = Math.sin(a) * r; put(G, new THREE.CylinderGeometry(0.06, 0.08, 0.35, 6), cel('#f2e6cc'), { x, y: 0.17, z, ink: 0.015 }); put(G, new THREE.SphereGeometry(0.22, 12, 6, 0, 6.3, 0, 1.6), cel(i % 2 ? '#e8503a' : '#f0a43a'), { x, y: 0.34, z, ink: 0.02 }); }
      G.add(motes(70, { color: '#d8ff8a', size: 0.09, area: [26, 6, 26], rise: 0.15, sway: 0.6 }));
    }
    if (el === 1) {
      const wm = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: 'varying vec2 vW; void main() { vW = ( modelMatrix * vec4( position, 1.0 ) ).xz; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
        fragmentShader: `uniform float uT; varying vec2 vW; void main() { float r = length( vW ); float f = sin( r * 3.0 - uT * 1.6 ) * 0.5 + 0.5; float n = sin( vW.x * 1.3 + uT ) * sin( vW.y * 1.1 - uT * 0.8 );
          vec3 c = mix( vec3( 0.16, 0.5, 0.78 ), vec3( 0.32, 0.72, 0.92 ), smoothstep( 0.2, 0.9, f * 0.6 + n * 0.4 ) ); c = mix( c, vec3( 0.92, 0.98, 1.0 ), step( 0.93, f ) * smoothstep( 14.0, 5.6, r ) ); gl_FragColor = vec4( c, 1.0 ); }` });
      const water = new THREE.Mesh(new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2), wm); water.position.y = -0.05; G.add(water); anim.push(t => { wm.uniforms.uT.value = t; });
      put(G, new THREE.CylinderGeometry(5.6, 6.2, 0.6, 40), cel('#8a9aa0'), { y: -0.2, ink: 0.03 });
      // vách đá và thác sau lưng
      for (let i = 0; i < 9; i++) { const a = Math.PI * (1.15 + i * 0.09), r = 16, b = put(G, rockGeo(i + 20, 1), cel(i % 2 ? '#7a8a90' : '#6a7a82'), { x: Math.cos(a) * r, y: 3, z: Math.sin(a) * r, ink: 0.06 }); b.scale.set(3.6, 6 + h1(i) * 4, 3); }
      const fm = new THREE.ShaderMaterial({ transparent: true, uniforms: { uT: { value: 0 } }, vertexShader: 'varying vec2 vU; void main() { vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
        fragmentShader: 'uniform float uT; varying vec2 vU; void main() { float s = fract( vU.y * 6.0 + uT * 1.4 + sin( vU.x * 20.0 ) * 0.1 ); vec3 c = mix( vec3( 0.55, 0.82, 0.98 ), vec3( 1.0 ), step( 0.75, s ) ); gl_FragColor = vec4( c, 0.95 ); }' });
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(5, 12), fm); fall.position.set(0, 5.5, -14.2); G.add(fall); anim.push(t => { fm.uniforms.uT.value = t; });
      for (let i = 0; i < 14; i++) { const a = h1(i * 3) * Math.PI * 2, r = 7.5 + h1(i * 5) * 5, l = put(G, new THREE.CylinderGeometry(0.5, 0.5, 0.04, 14, 1, false, 0.3, 5.8), cel('#5fae5a'), { x: Math.cos(a) * r, y: 0.0, z: Math.sin(a) * r, ink: 0.015, shadow: false }); l.scale.setScalar(0.6 + h1(i) * 0.6); }
      G.add(motes(90, { color: '#e8f8ff', size: 0.07, area: [24, 7, 24], rise: 0.4, sway: 0.4 }));
    }
    if (el === 2) {
      put(G, new THREE.CylinderGeometry(5.6, 9, 8, 14), cel('#9a9488'), { y: -4.1, ink: 0.05 });
      for (let i = 0; i < 60; i++) { const a = h1(i * 2) * Math.PI * 2, r = 9 + h1(i * 3) * 26, c = put(G, blobGeo(THREE, 30 + i % 8, { lumps: 9, amp: 0.4 }), cel(i % 3 ? '#ffffff' : '#e6eeff'), { x: Math.cos(a) * r, y: -3 - h1(i * 5) * 2, z: Math.sin(a) * r, ink: 0, shadow: false }); c.scale.set(3 + h1(i) * 4, 1.4 + h1(i * 7), 3 + h1(i * 9) * 4); }
      for (let i = 0; i < 6; i++) { const a = Math.PI * (1.1 + i * 0.16), r = 13 + h1(i) * 5, R = new THREE.Group(); R.userData.keep = true; R.position.set(Math.cos(a) * r, 3 + h1(i * 3) * 4, Math.sin(a) * r); G.add(R); const b = put(R, rockGeo(i + 40, 1), cel('#9a9488'), { ink: 0.05 }); b.scale.set(1.8, 1.2, 1.6); put(R, new THREE.CylinderGeometry(1.7, 1.6, 0.3, 10), cel('#7fc06a'), { y: 1.1, ink: 0.03 }); anim.push(t => { R.position.y += Math.sin(t * 0.8 + i) * 0.003; }); }
      // dây cờ cầu phúc
      [-1, 1].forEach(s => { const flags = new THREE.Group(); flags.userData.keep = true; G.add(flags); for (let i = 0; i < 9; i++) { const u = i / 8, f = put(flags, new THREE.PlaneGeometry(0.42, 0.5), cel(ELC[i % 5], { side: THREE.DoubleSide }), { x: s * (6.2 - u * 0.2), y: 4.7 - Math.sin(u * Math.PI) * 0.8, z: 1.8 - u * 9, ink: 0, shadow: false }); f.rotation.y = Math.PI / 2; anim.push(t => { f.rotation.x = Math.sin(t * 3 + i) * 0.3; }); } });
      G.add(motes(60, { color: '#ffffff', size: 0.12, area: [30, 8, 30], rise: 0.0, sway: 3.0 }));
    }
    if (el === 3) {
      ground('#3a3658');
      [[-8, -9, 4.5, 0], [-3.5, -12, 6, 0], [3.5, -12, 5.5, 1], [8, -9, 3, 1], [-11, -4, 3.4, 1], [11, -4, 5, 0]].forEach(([x, z, h, b]) => column(G, x, z, h, !!b, '#8a86a8'));
      { const arch = put(G, new THREE.TorusGeometry(3.2, 0.42, 10, 24, Math.PI), cel('#8a86a8'), { x: 0, y: 5.6, z: -12.4, ink: 0.04 }); arch.scale.y = 0.9; }
      const moon = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.6), fog: false })); moon.position.set(-14, 16, -40); moon.lookAt(0, 2, 0); G.add(moon);
      [5.2, 6.6].forEach((r, i) => { const h = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: '#8a90ff', transparent: true, opacity: 0.18 - i * 0.07, fog: false, depthWrite: false })); h.position.set(-14, 16, -40.2 - i * 0.1); h.lookAt(0, 2, 0); G.add(h); });
      const cm = new THREE.MeshToonMaterial({ color: '#b48cff', gradientMap: ramp, emissive: '#7a4cff', emissiveIntensity: 0.9 }); glowMats.push(cm);
      for (let i = 0; i < 12; i++) { const a = Math.PI * (0.95 + h1(i) * 1.1), r = 7 + h1(i * 3) * 6;
        const c = put(G, gemGeo(THREE, 6), cm, { x: Math.cos(a) * r, y: 0.5, z: Math.sin(a) * r, ink: 0.02 }); c.scale.set(0.5, 0.45 * (1.8 + h1(i) * 1.5), 0.5); c.rotation.z = (h1(i * 5) - 0.5) * 0.6; }
      G.add(motes(120, { color: '#c8b0ff', size: 0.07, area: [30, 9, 30], rise: 0.25, sway: 0.5 }));
    }
    if (el === 4) {
      const lm = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: 'varying vec2 vW; void main() { vW = ( modelMatrix * vec4( position, 1.0 ) ).xz; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
        fragmentShader: `uniform float uT; varying vec2 vW; float h( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
          void main() { vec2 p = vW * 0.45 + vec2( uT * 0.08, uT * 0.05 ); vec2 i = floor( p ), f = fract( p ); float m = 1.0; for ( int y = -1; y <= 1; y++ ) for ( int x = -1; x <= 1; x++ ) { vec2 g = vec2( float( x ), float( y ) ); vec2 o = vec2( h( i + g ), h( i + g + 7.0 ) ); m = min( m, length( g + o - f ) ); }
            vec3 c = mix( vec3( 1.6, 0.9, 0.15 ), vec3( 0.55, 0.12, 0.05 ), smoothstep( 0.08, 0.5, m ) ); gl_FragColor = vec4( c, 1.0 ); }` });
      const lava = new THREE.Mesh(new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2), lm); lava.position.y = -0.3; G.add(lava); anim.push(t => { lm.uniforms.uT.value = t; });
      put(G, new THREE.CylinderGeometry(5.6, 6.6, 1.0, 16), cel('#3a2c2c'), { y: -0.45, ink: 0.04 });
      for (let i = 0; i < 16; i++) { const a = Math.PI * (0.9 + h1(i) * 1.2), r = 11 + h1(i * 2) * 10, rw = 1.4 + h1(i) * 1.4, rh = 4 + h1(i * 3) * 7, s = put(G, spireGeo(THREE, i % 10), cel(i % 2 ? '#3a2c2c' : '#4a3634'), { x: Math.cos(a) * r, y: -0.5, z: Math.sin(a) * r, ink: 0.05 }); s.scale.set(rw, rh, rw); s.rotation.y = h1(i * 7) * 6; }
      for (let i = 0; i < 18; i++) { const a = h1(i * 13) * Math.PI * 2, r = 7.2 + h1(i * 17) * 6, b = put(G, rockGeo(i + 60, 0), cel('#2c2222'), { x: Math.cos(a) * r, y: -0.1, z: Math.sin(a) * r, ink: 0.03 }); b.scale.set(0.8 + h1(i) * 0.8, 0.5, 0.8 + h1(i + 2) * 0.8); }
      G.add(motes(140, { color: '#ffb040', size: 0.08, area: [28, 10, 28], rise: 0.9, sway: 0.35 }));
    }

    // gộp đồ tĩnh cùng vật liệu (cây, đá, bậc, trụ, viền mực…) thành ít lưới: giảm lệnh vẽ để có chỗ cho khối mịn hơn
    // gộp riêng cảnh gần (trong vùng bản đồ bóng ±8) và cảnh xa: cảnh xa không vẽ vào bản đồ bóng (trước đây cũng bị cắt khỏi khung bóng),
    // nhờ vậy lưới gộp không kéo cả rừng cây vào lượt đổ bóng
    const far = new THREE.Group(); far.userData.keep = true; G.add(far); [...G.children].forEach(o => { if (o !== far && (o.isMesh || o.isGroup) && Math.hypot(o.position.x, o.position.z) > 8.5) far.attach(o); });
    bakeStatic(THREE, G); bakeStatic(THREE, far);
    G.traverse(o => { if (o.userData.baked && !o.userData.outline) { o.receiveShadow = true; let f = false; for (let q = o; q; q = q.parent) if (q === far) f = true; o.castShadow = !f; } });
    far.traverse(o => { if (o.isMesh) o.castShadow = false; });
    const sk = sky(A, el === 3); G.add(sk);
    const hemi = new THREE.HemisphereLight(A.hemi[0], A.hemi[1], el === 3 ? 0.95 : 1.1); G.add(hemi);
    const key = new THREE.DirectionalLight(A.sun, A.key * 0.8); key.position.set(el === 3 ? -6 : 6, 10, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 }); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; G.add(key); G.add(key.target);
    const rim = new THREE.DirectionalLight(el === 4 ? '#ff7a3a' : el === 3 ? '#9a7cff' : '#bfe0ff', 1.2); rim.position.set(-5, 4, -8); G.add(rim);
    if (el === 4 || el === 3) { const pl = new THREE.PointLight(el === 4 ? '#ff6a1a' : '#9a5cff', 6, 14, 1.6); pl.position.set(0, 1.2, 0); G.add(pl); }
    const motesL = []; G.traverse(o => { if (o.isPoints && o.userData.mat) motesL.push(o.userData.mat); });
    let glowK = 0;
    return {
      group: G, arena: A, ground: gy, lights: { hemi, key, rim, base: [hemi.intensity, key.intensity, rim.intensity] }, fog: A.fog,
      update(t) { sk.userData.sky.uniforms.uT.value = t; motesL.forEach(m => { m.uniforms.uT.value = t; }); anim.forEach(f => f(t)); topM.emissiveIntensity = 0.12 + glowK * 1.6 + Math.sin(t * 2) * 0.03; },
      /** Độ sáng hoa văn trống đồng (0..1): bừng lên khi tụ lực chiêu tối thượng. */
      setGlow(k) { glowK = k; },
    };
  }
  return { build, cel, inkM, put, ramp };
}
