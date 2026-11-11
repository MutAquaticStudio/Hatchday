// Dựng 3D cho đồ trang trí và trang phục (toon + viền, cùng phong cách với thú).
// Quy ước: đồ sàn/thảm có gốc ở tâm diện tích chiếm chỗ, đáy y = 0, mặt trước hướng +z.
// Đồ treo tường có gốc ở tâm khối, mặt sau sát tường (z = 0), hướng +z.
import { _t } from '../i18n';

export function makeDecor(K) {
  const { THREE, toon, add, canvasTex } = K;
  const INK = '#7a4a63', WOOD = '#d9a06b', WOOD_D = '#a8744e', WOOD_INK = '#7a4a2e';
  const basic = c => new THREE.MeshBasicMaterial({ color: c });
  const S = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
  const Cy = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
  const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const legs = (g, w, d, h, mat, r = 0.05) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(g, Cy(r, r, h, 8), mat, a * w / 2, h / 2, b * d / 2, WOOD_INK, 0.015));
  const tex = (w, h, fn, rep) => canvasTex(w, h, fn, rep);

  const stripeTex = tex(128, 64, g => { g.fillStyle = '#ff9ec4'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#fff'; g.fillRect(0, 26, 128, 12); g.fillStyle = '#ffd36e'; g.fillRect(0, 0, 128, 8); g.fillRect(0, 56, 128, 8); });
  const lanternRed = new THREE.MeshToonMaterial({ color: '#ff5a5a', gradientMap: K.grad, emissive: '#ff3030', emissiveIntensity: 0.35 });

  const B = {
    'o-rom': g => { const t = add(g, new THREE.TorusGeometry(0.72, 0.28, 16, 40), toon('#ffd36e'), 0, 0.28, 0, '#a8742e'); t.rotation.x = -Math.PI / 2; add(g, Cy(0.72, 0.72, 0.14, 32), toon('#fff1c4'), 0, 0.1, 0, null); },
    'giuong-may': g => {
      add(g, Cy(0.85, 0.9, 0.3, 32), toon('#ffffff'), 0, 0.15, 0, '#a8a0c8');
      [[-0.5, 0.42, -0.4, 0.42], [0.5, 0.42, -0.4, 0.42], [0, 0.48, -0.55, 0.45], [-0.6, 0.38, 0.35, 0.34], [0.6, 0.38, 0.35, 0.34]].forEach(([x, y, z, r]) => add(g, S(r), toon('#ffffff'), x, y, z, '#a8a0c8'));
      const pl = add(g, S(0.3), toon('#ffc6dc'), 0, 0.42, -0.1, INK); pl.scale.set(1.4, 0.45, 0.8);
    },
    'ghe-dau': g => { add(g, Cy(0.32, 0.32, 0.08, 20), toon(WOOD), 0, 0.46, 0, WOOD_INK); [0, 2.1, 4.2].forEach(a => { const l = add(g, Cy(0.04, 0.05, 0.44, 8), toon(WOOD_D), Math.cos(a) * 0.2, 0.22, Math.sin(a) * 0.2, WOOD_INK, 0.015); l.rotation.z = Math.cos(a) * 0.12; }); },
    'ban-tra': g => { add(g, Bx(1.7, 0.1, 0.75), toon(WOOD), 0, 0.46, 0, WOOD_INK); legs(g, 1.5, 0.55, 0.42, toon(WOOD_D)); add(g, Cy(0.1, 0.08, 0.14, 14), toon('#fff'), 0.4, 0.58, 0, INK); add(g, Cy(0.18, 0.18, 0.04, 16), toon('#ffd9a8'), -0.3, 0.53, 0.05, INK); },
    'ke-sach': g => {
      add(g, Bx(0.85, 1.7, 0.42), toon(WOOD), 0, 0.85, -0.1, WOOD_INK);
      const cols = ['#ff7a7a', '#7ab8ff', '#ffd36e', '#8fdc7a', '#c9a6ff'];
      [0.45, 0.95, 1.45].forEach((y, k) => { add(g, Bx(0.75, 0.05, 0.36), toon(WOOD_D), 0, y - 0.22, 0.02, null); for (let i = 0; i < 4; i++) add(g, Bx(0.12, 0.34 - (i % 2) * 0.06, 0.3), toon(cols[(i + k) % 5]), -0.26 + i * 0.16, y - 0.03, 0.04, INK, 0.012); });
    },
    'sofa-hong': g => {
      const m = toon('#ff9ec4');
      add(g, Bx(1.8, 0.36, 0.78), m, 0, 0.28, 0, '#a8507a'); add(g, Bx(1.8, 0.62, 0.24), m, 0, 0.72, -0.28, '#a8507a');
      [-0.9, 0.9].forEach(x => add(g, Bx(0.24, 0.5, 0.78), m, x, 0.48, 0, '#a8507a'));
      [-0.4, 0.4].forEach(x => { const c = add(g, S(0.3), toon('#ffc6dc'), x, 0.58, 0.05, '#a8507a'); c.scale.set(1.3, 0.45, 1); });
    },
    'den-keo': g => {
      add(g, Cy(0.03, 0.03, 1.2, 8), toon('#ffffff'), 0, 0.6, 0, INK, 0.012);
      const swirl = tex(128, 128, c => { for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#fff' : '#ff6fa8'; c.beginPath(); c.moveTo(64, 64); c.arc(64, 64, 64, i * Math.PI / 3, (i + 1) * Math.PI / 3); c.fill(); } });
      const disc = add(g, Cy(0.38, 0.38, 0.1, 32), new THREE.MeshToonMaterial({ map: swirl, gradientMap: K.grad, emissive: '#ff9ec4', emissiveIntensity: 0.25 }), 0, 1.35, 0, '#a8507a');
      disc.rotation.x = Math.PI / 2; add(g, Cy(0.2, 0.24, 0.06, 16), toon('#ffd36e'), 0, 0.03, 0, INK);
    },
    'gau-bong': g => {
      const br = toon('#d9a06b');
      const b = add(g, S(0.38), br, 0, 0.38, 0, WOOD_INK); b.scale.set(1, 0.95, 0.9);
      add(g, S(0.28), br, 0, 0.88, 0.04, WOOD_INK);
      [-1, 1].forEach(s => { add(g, S(0.1), br, s * 0.2, 1.1, 0, WOOD_INK); add(g, S(0.12), br, s * 0.36, 0.42, 0.18, WOOD_INK); add(g, S(0.12), br, s * 0.22, 0.1, 0.25, WOOD_INK); add(g, S(0.035, 8, 6), basic('#3a2030'), s * 0.1, 0.92, 0.27, null); });
      add(g, S(0.11), toon('#fff1dc'), 0, 0.82, 0.26, null); add(g, Bx(0.3, 0.12, 0.05), toon('#ff6fa8'), 0, 0.62, 0.22, INK);
    },
    'tv-crt': g => {
      add(g, Bx(0.8, 0.3, 0.55), toon(WOOD_D), 0, 0.15, 0, WOOD_INK);
      add(g, Bx(0.82, 0.66, 0.62), toon('#c8c2d4'), 0, 0.64, -0.02, '#5a5070');
      const scr = tex(64, 48, c => { const gr = c.createLinearGradient(0, 0, 64, 48); gr.addColorStop(0, '#7ad0ff'); gr.addColorStop(1, '#c9a6ff'); c.fillStyle = gr; c.fillRect(0, 0, 64, 48); c.fillStyle = 'rgba(255,255,255,.35)'; for (let y = 0; y < 48; y += 3) c.fillRect(0, y, 64, 1); });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.44), new THREE.MeshBasicMaterial({ map: scr })); s.position.set(-0.04, 0.66, 0.295); g.add(s);
      [0.3].forEach(x => { add(g, S(0.035, 8, 6), toon('#ffd36e'), x, 0.78, 0.3, null); add(g, S(0.035, 8, 6), toon('#ff7a7a'), x, 0.66, 0.3, null); });
      [-1, 1].forEach(s2 => { const a = add(g, Cy(0.012, 0.012, 0.45, 6), toon('#5a5070'), s2 * 0.12, 1.15, -0.05, null); a.rotation.z = -s2 * 0.5; });
    },
    'may-game': g => {
      add(g, Bx(0.6, 0.4, 0.5), toon('#ffd9a8'), 0, 0.2, 0, WOOD_INK);
      const e = add(g, S(0.2, 20, 16), toon('#9ad0ff'), 0, 0.62, 0, '#4b6c96'); e.scale.set(0.95, 1.2, 0.5);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.13), basic('#cfe3a8')); scr.position.set(0, 0.66, 0.1); g.add(scr);
      [-0.06, 0, 0.06].forEach(x => add(g, S(0.025, 8, 6), toon('#ff9ec4'), x, 0.52, 0.09, null));
    },
    'ban-hoc': g => {
      add(g, Bx(1.7, 0.08, 0.7), toon(WOOD), 0, 0.7, 0, WOOD_INK); legs(g, 1.55, 0.55, 0.66, toon(WOOD_D));
      add(g, Bx(0.5, 0.06, 0.36), toon('#ff7a7a'), -0.4, 0.77, 0.05, INK, 0.012); add(g, Bx(0.46, 0.06, 0.34), toon('#7ab8ff'), -0.42, 0.83, 0.05, INK, 0.012);
      add(g, Cy(0.03, 0.03, 0.4, 8), toon('#5a5070'), 0.55, 0.94, -0.15, null); const sh = add(g, Cy(0.08, 0.18, 0.16, 16), toon('#8fdc7a'), 0.55, 1.16, -0.1, INK); sh.rotation.x = 0.4;
    },
    'dong-ho-bao-thuc': g => {
      const b = add(g, Cy(0.26, 0.26, 0.16, 24), toon('#ff7a7a'), 0, 0.34, 0, INK); b.rotation.x = Math.PI / 2;
      const f = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), basic('#fff')); f.position.set(0, 0.34, 0.085); g.add(f);
      [[0, 0.1, 0], [0.07, 0.03, -0.8]].forEach(([x, y, r]) => { const h = new THREE.Mesh(Bx(0.02, 0.14, 0.01), basic('#4a2140')); h.position.set(x, 0.34 + y, 0.09); h.rotation.z = r; g.add(h); });
      [-1, 1].forEach(s => { add(g, S(0.09, 12, 8), toon('#ffd36e'), s * 0.16, 0.6, 0, INK); add(g, Cy(0.02, 0.02, 0.14, 6), toon('#5a5070'), s * 0.16, 0.08, 0, null); });
    },
    'chau-cay': g => {
      add(g, Cy(0.38, 0.28, 0.6, 20), toon('#ff9a7a'), 0, 0.3, 0, '#a5523f');
      [[0, 0.95, 0, 0.45], [-0.27, 0.8, 0.1, 0.32], [0.27, 0.82, -0.05, 0.34], [0.04, 1.3, 0, 0.27]].forEach(([x, y, z, r]) => { const l = add(g, S(r, 20, 14), toon('#6fd08c'), x, y, z, '#3f8a55'); l.scale.set(1, 0.85, 1); });
    },
    'xuong-rong': g => {
      add(g, Cy(0.26, 0.2, 0.36, 16), toon('#ffb36b'), 0, 0.18, 0, '#a5523f');
      const gr = toon('#5cbf6a');
      add(g, new THREE.CapsuleGeometry(0.14, 0.55, 6, 14), gr, 0, 0.75, 0, '#2f7a3d');
      [[-1, 0.7, 0.18], [1, 0.85, 0.14]].forEach(([s, y, h]) => { add(g, new THREE.CapsuleGeometry(0.07, h, 4, 10), gr, s * 0.22, y + 0.08, 0, '#2f7a3d'); add(g, new THREE.CapsuleGeometry(0.07, 0.04, 4, 10), gr, s * 0.14, y - 0.04, 0, '#2f7a3d').rotation.z = Math.PI / 2; });
      add(g, S(0.06, 10, 8), toon('#ff7ab0'), 0, 1.13, 0, INK);
    },
    'cay-lon': g => {
      add(g, Cy(0.34, 0.3, 0.42, 18), toon('#c9a6ff'), 0, 0.21, 0, '#5a4a9a');
      add(g, Cy(0.1, 0.16, 1.3, 10), toon('#a8744e'), 0, 1.05, 0, '#6a4630');
      [[0, 1.85, 0, 0.62], [-0.38, 1.6, 0.1, 0.42], [0.4, 1.65, -0.05, 0.44], [0.05, 2.25, 0.05, 0.38]].forEach(([x, y, z, r]) => add(g, S(r, 20, 14), toon('#5fc46c'), x, y, z, '#2f7a3d'));
    },
    'vo-oc': g => {
      const sh = add(g, S(0.34, 20, 14), toon('#ffd0c0'), 0, 0.3, 0, '#a5523f'); sh.scale.set(1, 0.8, 1.1);
      const c = add(g, new THREE.ConeGeometry(0.18, 0.5, 16), toon('#ffb3a0'), 0.05, 0.62, -0.08, '#a5523f'); c.rotation.z = -0.4;
      add(g, S(0.12, 12, 10), toon('#fff1ea'), 0, 0.22, 0.3, null);
    },
    'hai-dang': g => {
      add(g, Cy(0.3, 0.34, 0.16, 18), toon('#c8c2d4'), 0, 0.08, 0, '#5a5070');
      [['#ffffff', 0.4], ['#ff6a6a', 0.75], ['#ffffff', 1.1]].forEach(([c, y]) => add(g, Cy(0.22 - y * 0.05, 0.26 - y * 0.05, 0.36, 18), toon(c), 0, y, 0, '#a5523f'));
      add(g, S(0.14, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff3a8' }), 0, 1.42, 0, null);
      add(g, new THREE.ConeGeometry(0.2, 0.22, 16), toon('#ff6a6a'), 0, 1.62, 0, '#a5523f');
    },
    'den-long': g => {
      add(g, Cy(0.025, 0.025, 1.3, 8), toon('#4a3a2e'), 0, 0.65, -0.05, null);
      const l = add(g, S(0.3, 20, 14), lanternRed, 0, 1.15, 0.08, '#8a2a2a'); l.scale.set(1, 1.15, 1);
      [0.82, 1.48].forEach(y => add(g, Cy(0.12, 0.12, 0.06, 14), toon('#ffd36e'), 0, y, 0.08, INK));
      add(g, Cy(0.02, 0.005, 0.25, 6), toon('#ffd36e'), 0, 0.66, 0.08, null);
      add(g, Cy(0.22, 0.26, 0.06, 16), toon('#4a3a2e'), 0, 0.03, -0.05, null);
    },
    'long-chim': g => {
      add(g, Cy(0.32, 0.34, 0.08, 20), toon(WOOD_D), 0, 0.3, 0, WOOD_INK);
      add(g, Cy(0.04, 0.06, 0.3, 8), toon(WOOD_D), 0, 0.13, 0, WOOD_INK);
      const cage = new THREE.Mesh(Cy(0.3, 0.3, 0.6, 14, 1), new THREE.MeshToonMaterial({ color: '#c9a06b', gradientMap: K.grad, wireframe: true })); cage.position.y = 0.64; g.add(cage);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: '#c9a06b', gradientMap: K.grad, wireframe: true })); dome.position.y = 0.94; g.add(dome);
      add(g, S(0.09, 12, 10), toon('#ffd84a'), 0, 0.58, 0, '#a8742e'); const bk = add(g, new THREE.ConeGeometry(0.03, 0.07, 8), toon('#ff8a3c'), 0, 0.6, 0.1, null); bk.rotation.x = Math.PI / 2;
    },
    'quat-may': g => {
      add(g, Cy(0.26, 0.3, 0.08, 18), toon('#9fd3f0'), 0, 0.04, 0, '#4b6c96');
      add(g, Cy(0.04, 0.04, 0.8, 8), toon('#e8eef5'), 0, 0.45, 0, '#4b6c96');
      add(g, S(0.1, 12, 10), toon('#9fd3f0'), 0, 0.9, 0, '#4b6c96');
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.015, 6, 28), toon('#e8eef5')); ring.position.set(0, 0.9, 0.1); g.add(ring);
      const blades = new THREE.Group(); blades.position.set(0, 0.9, 0.08); g.add(blades); g.userData.spin = blades;
      for (let i = 0; i < 3; i++) { const b = add(blades, S(0.13, 10, 8), toon('#bfe8ff'), Math.cos(i * 2.09) * 0.16, Math.sin(i * 2.09) * 0.16, 0, '#4b6c96', 0.01); b.scale.set(1, 0.5, 0.15); b.rotation.z = i * 2.09; }
    },
    'ghe-nhua': g => {
      const red = toon('#ff4d4d');
      add(g, Cy(0.28, 0.3, 0.06, 20), red, 0, 0.44, 0, '#8a2a2a');
      add(g, Cy(0.27, 0.33, 0.4, 20, 1), red, 0, 0.22, 0, '#8a2a2a');
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), basic('#8a2a2a')); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.475; g.add(hole);
    },
    bong: g => { add(g, S(0.3, 24, 18), toon('#ffffff', stripeTex), 0, 0.3, 0, '#a8507a', 0.02); },
    'cay-dao': g => {
      add(g, Cy(0.32, 0.26, 0.4, 18), toon('#ffd36e'), 0, 0.2, 0, '#a8742e');
      const tr = add(g, Cy(0.06, 0.1, 1.0, 8), toon('#6a4630'), 0, 0.9, 0, null); tr.rotation.z = 0.15;
      [[-0.2, 1.4, 0.1, 0.3], [0.28, 1.5, 0, 0.32], [0, 1.75, -0.05, 0.3], [-0.35, 1.15, -0.05, 0.22], [0.35, 1.2, 0.1, 0.22]].forEach(([x, y, z, r]) => add(g, S(r, 16, 12), toon('#ffb3cd'), x, y, z, '#a8507a'));
    },
    'den-ong-sao': g => {
      const sh = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 0.16 : 0.38; i ? sh.lineTo(Math.cos(a) * r, -Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, -Math.sin(a) * r); }
      const st = add(g, new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }), new THREE.MeshToonMaterial({ color: '#ff5a5a', gradientMap: K.grad, emissive: '#ff3030', emissiveIntensity: 0.3 }), 0, 1.25, -0.06, '#8a2a2a');
      add(g, Cy(0.025, 0.025, 1.0, 8), toon('#a8744e'), 0, 0.5, 0, null); st.userData.keep = true;
    },
    /* ---------- thảm ---------- */
    'tham-tron': g => { add(g, Cy(1.9, 1.9, 0.05, 56), toon('#bfe3ff', null, 'fabric'), 0, 0.025, 0, '#6f8fb8', 0.02); add(g, Cy(1.4, 1.4, 0.055, 56), toon('#dff1ff', null, 'fabric'), 0, 0.03, 0, null); },
    'tham-cat': g => { const t = tex(128, 96, c => { c.fillStyle = '#ffe6b0'; c.fillRect(0, 0, 128, 96); c.fillStyle = '#f5cf8a'; for (let i = 0; i < 40; i++) c.fillRect((i * 37) % 128, (i * 23) % 96, 3, 3); }); add(g, Bx(2.8, 0.05, 1.8), toon('#ffffff', t, 'fabric'), 0, 0.025, 0, '#c99a5a', 0.02); },
    'tham-reu': g => { const t = tex(128, 128, c => { c.fillStyle = '#7ccf6a'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#9be38a'; for (let i = 0; i < 26; i++) { c.beginPath(); c.arc((i * 47) % 128, (i * 29) % 128, 6, 0, 7); c.fill(); } }); const m = add(g, Cy(1.4, 1.4, 0.05, 40), toon('#ffffff', t, 'fabric'), 0, 0.025, 0, '#3f8a55', 0.02); m.scale.z = 0.95; },
    'tham-ca-ro': g => { const t = tex(128, 128, c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#ffc6dc'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) c.fillRect(x * 32, y * 32, 32, 32); }); add(g, Bx(2.8, 0.05, 2.8), toon('#ffffff', t, 'fabric'), 0, 0.025, 0, '#a8507a', 0.02); },
    /* ---------- treo tường ---------- */
    poster: g => {
      const t = tex(96, 128, c => { c.fillStyle = '#fff3c4'; c.fillRect(0, 0, 96, 128); c.fillStyle = '#ff7ab0'; c.beginPath(); c.arc(48, 56, 26, 0, 7); c.fill(); c.fillStyle = '#4a2140'; c.beginPath(); c.arc(38, 52, 4, 0, 7); c.arc(58, 52, 4, 0, 7); c.fill();
        c.fillStyle = '#7ab8ff'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText('★ ★ ★', 48, 110); });
      add(g, Bx(0.62, 0.84, 0.03), toon('#ffffff', t), 0, 0, 0.015, INK, 0.02);
    },
    'tranh-bien': g => {
      const t = tex(192, 96, c => { const gr = c.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#9fe0ff'); gr.addColorStop(0.55, '#e6f8ff'); gr.addColorStop(0.56, '#3fa8e0'); gr.addColorStop(1, '#2f7ab8'); c.fillStyle = gr; c.fillRect(0, 0, 192, 96);
        c.fillStyle = '#fff3a8'; c.beginPath(); c.arc(150, 30, 14, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; for (let x = 10; x < 190; x += 30) { c.beginPath(); c.arc(x, 66, 8, Math.PI, 0); c.stroke(); } });
      add(g, Bx(1.7, 0.8, 0.06), toon(WOOD), 0, 0, 0.03, WOOD_INK); const p = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.66), new THREE.MeshBasicMaterial({ map: t })); p.position.z = 0.065; g.add(p);
    },
    'dong-ho-treo': g => {
      const b = add(g, Cy(0.34, 0.34, 0.08, 28), toon(WOOD), 0, 0, 0.04, WOOD_INK); b.rotation.x = Math.PI / 2;
      const f = new THREE.Mesh(new THREE.CircleGeometry(0.27, 28), basic('#fff7ef')); f.position.z = 0.085; g.add(f);
      g.userData.clock = [];
      [0.16, 0.22].forEach((len, i) => { const h = new THREE.Group(); h.position.z = 0.09; g.add(h); const m = new THREE.Mesh(Bx(0.025, len, 0.01), basic('#4a2140')); m.position.y = len / 2; h.add(m); g.userData.clock.push(h); });
    },
    'ke-treo': g => {
      add(g, Bx(1.6, 0.08, 0.32), toon(WOOD), 0, -0.25, 0.16, WOOD_INK);
      ['#ff7a7a', '#7ab8ff', '#ffd36e'].forEach((c, i) => add(g, Bx(0.12, 0.32, 0.24), toon(c), -0.5 + i * 0.14, -0.05, 0.16, INK, 0.012));
      add(g, S(0.13, 14, 10), toon('#8fdc7a'), 0.45, -0.08, 0.16, '#2f7a3d'); add(g, Cy(0.1, 0.08, 0.14, 12), toon('#ff9a7a'), 0.45, -0.17, 0.16, '#a5523f');
    },
    'to-chim': g => {
      const n = add(g, new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#a8744e'), 0, -0.05, 0.2, '#6a4630'); n.material.side = THREE.DoubleSide;
      add(g, S(0.12, 12, 10), toon('#7ab8ff'), 0, 0.02, 0.2, '#4b6c96'); add(g, S(0.08, 10, 8), toon('#7ab8ff'), 0.08, 0.13, 0.25, '#4b6c96');
      const bk = add(g, new THREE.ConeGeometry(0.025, 0.06, 6), toon('#ffb36b'), 0.12, 0.13, 0.33, null); bk.rotation.x = Math.PI / 2;
      add(g, Bx(0.6, 0.05, 0.3), toon(WOOD_D), 0, -0.2, 0.15, WOOD_INK);
    },

    /* ---------- Đồ trang trí nông trại (layer 'farm'): gốc ở tâm, đáy y = 0 ---------- */
    'bu-nhin': g => {
      add(g, Cy(0.05, 0.06, 1.5, 8), toon(WOOD_D), 0, 0.75, 0, WOOD_INK, 0.015);
      add(g, Bx(1.0, 0.07, 0.07), toon(WOOD_D), 0, 1.05, 0, WOOD_INK, 0.015);
      const shirt = add(g, new THREE.ConeGeometry(0.34, 0.6, 12), toon('#ff7a7a'), 0, 0.95, 0, '#a83a3a'); shirt.scale.z = 0.6;
      add(g, S(0.2, 16, 12), toon('#f3d6a6'), 0, 1.38, 0, '#8a6a3a');
      [-0.07, 0.07].forEach(x => add(g, S(0.025, 6, 6), basic('#4a2140'), x, 1.42, 0.18, null));
      const brim = add(g, Cy(0.36, 0.36, 0.04, 20), toon('#e8b25a'), 0, 1.55, 0, '#a8742e'); add(g, Cy(0.14, 0.2, 0.2, 16), toon('#e8b25a'), 0, 1.67, 0, '#a8742e'); brim.rotation.z = 0.04;
      [-0.55, 0.55].forEach(x => { for (let k = 0; k < 3; k++) { const st = add(g, Cy(0.012, 0.012, 0.22, 4), toon('#f0c860'), x + (k - 1) * 0.03, 1.0, 0, null); st.rotation.z = (k - 1) * 0.35; } });
    },
    'bien-nong-trai': g => {
      [-0.5, 0.5].forEach(x => add(g, Cy(0.05, 0.06, 0.9, 8), toon(WOOD_D), x, 0.45, 0, WOOD_INK, 0.015));
      const t = tex(256, 96, c => { c.fillStyle = '#e8b47a'; c.fillRect(0, 0, 256, 96); c.strokeStyle = '#a8742e'; c.lineWidth = 6; c.strokeRect(5, 5, 246, 86); c.fillStyle = '#7a4a2e'; c.font = '800 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(_t('NÔNG TRẠI'), 128, 50); });
      const b = add(g, Bx(1.3, 0.45, 0.07), toon('#ffffff', t), 0, 0.78, 0.03, WOOD_INK, 0.015);
      add(g, S(0.07, 8, 6), toon('#ff7a7a'), -0.55, 1.03, 0.04, null); add(g, S(0.07, 8, 6), toon('#ffd36e'), 0.55, 1.03, 0.04, null);
    },
    'dong-rom': g => {
      const t = tex(128, 128, c => { c.fillStyle = '#f0c860'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#d9a83a'; c.lineWidth = 3; for (let y = 8; y < 128; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(128, y + (y % 28 ? 4 : -4)); c.stroke(); } });
      add(g, Cy(0.5, 0.52, 0.5, 18), toon('#ffffff', t), 0, 0.25, 0, '#a8742e');
      const top = add(g, S(0.5, 18, 12), toon('#ffffff', t), 0, 0.5, 0, '#a8742e'); top.scale.set(1, 0.8, 1);
      const bind = add(g, new THREE.TorusGeometry(0.505, 0.03, 6, 24), toon('#c98a5a'), 0, 0.4, 0, null); bind.rotation.x = Math.PI / 2;
    },
    'ghe-vuon': g => {
      add(g, Bx(1.2, 0.08, 0.42), toon(WOOD), 0, 0.42, 0, WOOD_INK);
      add(g, Bx(1.2, 0.34, 0.06), toon(WOOD), 0, 0.72, -0.17, WOOD_INK);
      [-0.5, 0.5].forEach(x => { add(g, Bx(0.07, 0.42, 0.36), toon(WOOD_D), x, 0.21, 0, WOOD_INK, 0.012); add(g, Bx(0.07, 0.5, 0.06), toon(WOOD_D), x, 0.58, -0.17, null); });
      add(g, S(0.09, 8, 6), toon('#ff9ec4'), 0.4, 0.5, 0.05, null);
    },
    'hom-thu': g => {
      add(g, Cy(0.05, 0.06, 0.9, 8), toon(WOOD_D), 0, 0.45, 0, WOOD_INK, 0.015);
      add(g, Bx(0.42, 0.26, 0.3), toon('#ff7a7a'), 0, 1.0, 0, '#a83a3a');
      const arch = add(g, new THREE.CylinderGeometry(0.15, 0.15, 0.42, 14, 1, false, 0, Math.PI), toon('#ff7a7a'), 0, 1.13, 0, '#a83a3a'); arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2;
      add(g, Bx(0.03, 0.2, 0.03), toon('#ffffff'), 0.26, 1.05, 0, null); add(g, Bx(0.12, 0.07, 0.03), toon('#ffd36e'), 0.31, 1.13, 0, null);
    },
    'xe-hoa': g => {
      const body = add(g, Bx(0.9, 0.3, 0.55), toon('#7ab8ff'), 0, 0.42, 0, '#3f6a96'); body.rotation.z = 0.05;
      const wheel = add(g, Cy(0.2, 0.2, 0.08, 18), toon('#a8744e'), -0.5, 0.2, 0, WOOD_INK); wheel.rotation.x = Math.PI / 2;
      [-0.3, 0.3].forEach(z => add(g, Bx(0.55, 0.05, 0.05), toon(WOOD_D), 0.35, 0.18, z, null));
      [['#ff9ec4', -0.25, 0.1], ['#ffd36e', 0, -0.12], ['#ffffff', 0.25, 0.1], ['#c9a6ff', -0.05, 0.14], ['#ff6f7d', 0.28, -0.1]].forEach(([c, x, z]) => { add(g, S(0.12, 10, 8), toon(c), x, 0.7 + Math.abs(z) * 0.4, z, '#7a4a63', 0.012); add(g, Cy(0.015, 0.015, 0.2, 5), toon('#4fae5a'), x, 0.58, z, null); });
    },
    'den-vuon': g => {
      add(g, Cy(0.05, 0.07, 1.6, 8), toon(WOOD_D), 0, 0.8, 0, WOOD_INK, 0.015);
      const arm = add(g, Bx(0.5, 0.05, 0.05), toon(WOOD_D), 0.22, 1.55, 0, WOOD_INK, 0.012); arm.rotation.z = 0;
      add(g, Cy(0.008, 0.008, 0.18, 4), toon('#4a2140'), 0.44, 1.46, 0, null);
      add(g, S(0.16, 14, 10), lanternRed, 0.44, 1.28, 0, '#a83a3a'); add(g, Cy(0.06, 0.06, 0.04, 10), toon('#ffd36e'), 0.44, 1.14, 0, null);
    },
    'to-ong': g => {
      [-0.28, 0.28].forEach(x => [-0.22, 0.22].forEach(z => add(g, Cy(0.04, 0.04, 0.4, 6), toon(WOOD_D), x, 0.2, z, WOOD_INK, 0.01)));
      add(g, Bx(0.75, 0.06, 0.55), toon(WOOD), 0, 0.42, 0, WOOD_INK);
      const hive = tex(64, 128, c => { c.fillStyle = '#ffd95a'; c.fillRect(0, 0, 64, 128); c.fillStyle = '#e0a82a'; for (let y = 10; y < 128; y += 26) c.fillRect(0, y, 64, 8); });
      add(g, Cy(0.28, 0.3, 0.5, 14), toon('#ffffff', hive), 0, 0.7, 0, '#a8742e'); add(g, S(0.28, 14, 10), toon('#ffd95a'), 0, 0.95, 0, '#a8742e').scale.y = 0.5;
      add(g, Cy(0.07, 0.07, 0.04, 10), toon('#4a2140'), 0, 0.68, 0.29, null).rotation.x = Math.PI / 2;
      [[0.4, 0.8, 0.25], [-0.38, 0.95, 0.1]].forEach(([x, y, z]) => { add(g, S(0.05, 8, 6), toon('#ffd95a'), x, y, z, '#4a2140', 0.01); add(g, S(0.035, 6, 6), toon('#ffffff'), x, y + 0.05, z - 0.04, null); });
    },
    'goc-nam': g => {
      add(g, Cy(0.36, 0.42, 0.45, 16), toon('#b9814f'), 0, 0.22, 0, WOOD_INK); add(g, Cy(0.36, 0.36, 0.03, 16), toon('#e8c79a'), 0, 0.46, 0, null);
      [[0.5, 0.12, 0.5], [0.62, -0.12, 0.34], [-0.45, 0.22, 0.4]].forEach(([x, z, sc]) => { add(g, Cy(0.05 * sc * 2, 0.06 * sc * 2, 0.2 * sc * 1.6, 8), toon('#fff3e0'), x, 0.1 * sc * 1.6, z, null); const cap = add(g, S(0.16 * sc * 1.6, 12, 8), toon('#ff6f7d'), x, 0.22 * sc * 1.6, z, '#a83a3a', 0.012); cap.scale.y = 0.6; add(g, S(0.025 * sc * 1.6, 6, 6), toon('#ffffff'), x + 0.04, 0.3 * sc * 1.6, z + 0.04, null); });
    },
    'gieng': g => {
      const stone = tex(128, 64, c => { c.fillStyle = '#c9c3bb'; c.fillRect(0, 0, 128, 64); c.strokeStyle = '#9a948c'; c.lineWidth = 3; for (let y = 0; y <= 64; y += 21) { c.beginPath(); c.moveTo(0, y); c.lineTo(128, y); c.stroke(); } for (let r = 0; r < 3; r++) for (let x = (r % 2) * 16; x < 128; x += 32) { c.beginPath(); c.moveTo(x, r * 21); c.lineTo(x, r * 21 + 21); c.stroke(); } });
      add(g, Cy(0.5, 0.52, 0.55, 20), toon('#ffffff', stone), 0, 0.27, 0, '#7a746c');
      add(g, Cy(0.4, 0.4, 0.02, 20), toon('#5fb4e8'), 0, 0.5, 0, null);
      [-0.45, 0.45].forEach(x => add(g, Cy(0.04, 0.05, 1.1, 8), toon(WOOD_D), x, 0.8, 0, WOOD_INK, 0.012));
      add(g, Cy(0.03, 0.03, 0.96, 8), toon(WOOD_D), 0, 1.2, 0, WOOD_INK, 0.01).rotation.z = Math.PI / 2;
      [-1, 1].forEach(sd => { const r = add(g, Bx(0.62, 0.05, 0.75), toon('#c25a4a'), sd * 0.27, 1.45, 0, '#7a2f26', 0.015); r.rotation.z = -sd * 0.55; });
      add(g, Cy(0.01, 0.01, 0.4, 4), toon('#4a2140'), 0, 1.0, 0, null); add(g, Cy(0.1, 0.08, 0.14, 10), toon('#a8744e'), 0, 0.78, 0, WOOD_INK, 0.01);
    },
    'ao-nho': g => {
      add(g, Cy(0.85, 0.88, 0.1, 28), toon('#5fb4e8'), 0, 0.06, 0, '#2f7aaa');
      const rim = add(g, new THREE.TorusGeometry(0.86, 0.09, 8, 28), toon('#c9c3bb'), 0, 0.1, 0, '#7a746c', 0.012); rim.rotation.x = Math.PI / 2;
      [[-0.3, 0.2, 0.2], [0.25, -0.2, 0.17], [0.1, 0.4, 0.14], [-0.2, -0.35, 0.12]].forEach(([x, z, r]) => { add(g, Cy(r, r, 0.02, 14), toon('#5fc46c'), x, 0.12, z, '#2f7a3d', 0.01); });
      const fl = add(g, new THREE.ConeGeometry(0.1, 0.16, 8), toon('#ff9ec4'), -0.3, 0.22, 0.2, '#a8507a', 0.012); fl.rotation.x = Math.PI;
      add(g, S(0.12, 10, 8), toon('#ffffff'), 0.5, 0.2, 0.1, '#7a4a63', 0.012).scale.set(1.2, 0.9, 1); add(g, S(0.07, 8, 6), toon('#ffffff'), 0.58, 0.3, 0.1, '#7a4a63', 0.01); add(g, new THREE.ConeGeometry(0.03, 0.06, 5), toon('#ffb36b'), 0.66, 0.3, 0.1, null).rotation.z = -Math.PI / 2;
    },
    'coi-xay-gio': g => {
      add(g, new THREE.CylinderGeometry(0.34, 0.5, 1.4, 14), toon('#fff3e0'), 0, 0.7, 0, '#a8778e');
      add(g, new THREE.ConeGeometry(0.42, 0.55, 14), toon('#c25a4a'), 0, 1.67, 0, '#7a2f26');
      add(g, Bx(0.2, 0.3, 0.05), toon(WOOD), 0, 0.2, 0.49, WOOD_INK, 0.012); add(g, Bx(0.16, 0.16, 0.04), toon('#bfe8ff'), 0, 0.95, 0.38, null);
      const hub = new THREE.Group(); hub.position.set(0, 1.3, 0.42); g.add(hub); hub.userData.blades = true;
      add(hub, S(0.07, 8, 6), toon('#a8744e'), 0, 0, 0.04, null);
      [0, 1, 2, 3].forEach(k => { const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2 + 0.3; hub.add(arm); add(arm, Bx(0.07, 0.95, 0.03), toon(WOOD_D), 0, 0.47, 0, WOOD_INK, 0.01); add(arm, Bx(0.28, 0.6, 0.02), toon('#ffffff'), 0.16, 0.55, 0.01, '#a8a0c8', 0.01); });
    },
  };

  /** Tạo món đồ trang trí. */
  function build(id) {
    const g = new THREE.Group(); g.userData.itemId = id;
    (B[id] || (x => add(x, Bx(0.6, 0.6, 0.6), toon('#ccc'), 0, 0.3, 0)))(g);
    return g;
  }

  /* ---------- Giấy dán tường & sàn ---------- */
  const WALLS = {
    'giay-cham-hong': ['#fff0f5', c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#ffd8e7'; for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { c.beginPath(); c.arc(32 + x * 64 + (y % 2) * 32, 32 + y * 64, 7, 0, 7); c.fill(); } }],
    'giay-soc-xanh': ['#f2fbff', c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#bfe6f7'; for (let x = 0; x < 128; x += 32) c.fillRect(x, 0, 14, 128); }],
    'giay-go': ['#f7e3cc', c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#e8cfb2'; for (let x = 0; x < 128; x += 32) c.fillRect(x, 0, 3, 128); c.fillRect(16, 60, 3, 20); c.fillRect(80, 20, 3, 18); }],
    'giay-sao': ['#3a3f86', c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#fff3a8'; [[20, 24], [84, 18], [50, 76], [104, 98], [14, 104]].forEach(([x, y]) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 3 : 8; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.fill(); }); }],
  };
  const FLOORS = {
    'san-go': ['#f6c99c', c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#efe2d6'; for (let i = 0; i < 4; i++) c.fillRect(0, i * 64 + 60, 256, 4); c.fillStyle = '#f4ebe2'; for (let i = 0; i < 4; i++) c.fillRect((i * 97) % 256, i * 64, 4, 64); }],
    'san-gach-bong': ['#ffffff', c => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const ox = x * 128, oy = y * 128; c.fillStyle = '#f7efe2'; c.fillRect(ox, oy, 128, 128); c.fillStyle = '#e07a6a'; c.beginPath(); c.moveTo(ox + 64, oy + 14); c.lineTo(ox + 114, oy + 64); c.lineTo(ox + 64, oy + 114); c.lineTo(ox + 14, oy + 64); c.fill(); c.fillStyle = '#4fa3a5'; c.beginPath(); c.arc(ox + 64, oy + 64, 20, 0, 7); c.fill(); c.fillStyle = '#e8d7bd'; c.fillRect(ox, oy, 128, 3); c.fillRect(ox, oy, 3, 128); } }],
    'san-co': ['#9fdc86', c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#e4f7da'; for (let i = 0; i < 60; i++) { const x = (i * 71) % 256, y = (i * 43) % 256; c.fillRect(x, y, 3, 8); c.fillRect(x + 4, y + 2, 3, 6); } }],
  };
  const texCache = {};
  function surface(kind, id) {
    const tbl = kind === 'wall' ? WALLS : FLOORS, e = tbl[id] || Object.values(tbl)[0];
    const k = kind + id;
    if (!texCache[k]) { const size = kind === 'wall' ? 128 : 256; texCache[k] = canvasTex(size, size, e[1]); texCache[k].wrapS = texCache[k].wrapT = THREE.RepeatWrapping; }
    return { color: e[0], map: texCache[k] };
  }

  /* ---------- Trang phục (gắn vào pivot của thú) ---------- */
  const O = {
    'no-hong': g => { const p = toon('#ff6fa8'); [-1, 1].forEach(s => { const c = add(g, new THREE.ConeGeometry(0.13, 0.24, 14), p, s * 0.12, 0, 0, '#a8507a', 0.015); c.rotation.z = s * Math.PI / 2; }); add(g, S(0.07, 12, 10), toon('#ff9ec4'), 0, 0, 0, '#a8507a'); g.position.set(-0.52, 1.72, 0.42); g.rotation.set(0.3, -0.5, 0.35); },
    'mu-len': g => {
      const m = toon('#7ab8ff'); const cap = add(g, new THREE.SphereGeometry(0.66, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0, 0, '#3a5a8a'); cap.scale.y = 0.72; cap.material.side = THREE.DoubleSide;
      const rim = add(g, new THREE.TorusGeometry(0.64, 0.09, 10, 32), toon('#ffffff'), 0, 0.02, 0, '#3a5a8a'); rim.rotation.x = Math.PI / 2;
      add(g, S(0.14, 14, 10), toon('#ffffff'), 0, 0.52, 0, '#3a5a8a'); g.position.set(0, 1.5, 0.02); g.rotation.x = -0.12;
    },
    'non-la': g => { add(g, new THREE.ConeGeometry(0.85, 0.42, 28, 1, true), toon('#f2d38a'), 0, 0.21, 0, '#a8742e').material.side = THREE.DoubleSide; const s = add(g, new THREE.TorusGeometry(0.6, 0.02, 6, 28), toon('#ff6fa8'), 0, 0.06, 0, null); s.rotation.x = Math.PI / 2; g.position.set(0, 1.78, 0.05); g.rotation.set(-0.15, 0, 0.12); },
    'mu-tiec': g => { const c = add(g, new THREE.ConeGeometry(0.2, 0.5, 18), toon('#ffffff', stripeTex), 0, 0.25, 0, '#a8507a'); c.rotation.y = 0.4; add(g, S(0.07, 10, 8), toon('#ffd36e'), 0, 0.52, 0, INK); g.position.set(0.32, 1.86, 0.05); g.rotation.z = -0.35; },
    'vong-hoa': g => { const r = add(g, new THREE.TorusGeometry(0.56, 0.05, 8, 32), toon('#5cbf6a'), 0, 0, 0, '#2f7a3d', 0.01); r.rotation.x = Math.PI / 2; ['#ff9ec4', '#ffd36e', '#ffffff', '#c9a6ff'].forEach((c, i) => { for (let k = 0; k < 2; k++) { const a = (i * 2 + k) * Math.PI / 4; add(g, S(0.1, 12, 10), toon(c), Math.cos(a) * 0.56, 0.04, Math.sin(a) * 0.56, INK, 0.012); } }); g.position.set(0, 1.74, 0.02); g.rotation.x = -0.2; },
    'kinh-tron': g => { const m = toon('#4a2140'); [-1, 1].forEach(s => add(g, new THREE.TorusGeometry(0.17, 0.028, 8, 28), m, s * 0.29, 0, 0, null)); const b = add(g, Cy(0.02, 0.02, 0.2, 6), m, 0, 0.03, 0, null); b.rotation.z = Math.PI / 2; g.position.set(0, 1.16, 0.97); },
    'kinh-ram': g => { const m = toon('#2a1a30'); [-1, 1].forEach(s => { const l = add(g, Cy(0.19, 0.19, 0.03, 24), new THREE.MeshBasicMaterial({ color: '#2a1a30', transparent: true, opacity: 0.85 }), s * 0.29, 0, 0, null); l.rotation.x = Math.PI / 2; l.scale.y = 1; l.scale.z = 0.8; }); const b = add(g, Bx(0.62, 0.04, 0.03), m, 0, 0.12, 0, null); g.position.set(0, 1.16, 0.98); },
    'khan-quang': g => { const t = add(g, new THREE.TorusGeometry(0.88, 0.1, 10, 40), toon('#ff3b3b'), 0, 0, 0, '#8a2a2a'); t.rotation.x = Math.PI / 2; t.scale.set(1.08, 1, 1); const tri = add(g, new THREE.ConeGeometry(0.16, 0.38, 3), toon('#ff3b3b'), 0.18, -0.2, 0.86, '#8a2a2a'); tri.rotation.set(0.3, 0, Math.PI); g.position.set(0, 0.6, 0.02); },
    chuong: g => { const t = add(g, new THREE.TorusGeometry(0.88, 0.045, 8, 40), toon('#ff6fa8'), 0, 0, 0, '#a8507a', 0.01); t.rotation.x = Math.PI / 2; t.scale.set(1.08, 1, 1); add(g, S(0.11, 14, 10), toon('#ffd84a'), 0, -0.1, 0.93, '#a8742e'); g.position.set(0, 0.6, 0.02); },
    'khan-len': g => { const st = canvasTex(64, 16, c => { for (let x = 0; x < 64; x += 16) { c.fillStyle = '#ffb36b'; c.fillRect(x, 0, 8, 16); c.fillStyle = '#ffffff'; c.fillRect(x + 8, 0, 8, 16); } }); st.wrapS = THREE.RepeatWrapping; st.repeat.set(6, 1); const t = add(g, new THREE.TorusGeometry(0.86, 0.15, 12, 40), toon('#ffffff', st), 0, 0, 0, '#a5523f'); t.rotation.x = Math.PI / 2; t.scale.set(1.08, 1, 1); const tail = add(g, Bx(0.22, 0.5, 0.08), toon('#ffb36b'), -0.35, -0.25, 0.86, '#a5523f'); tail.rotation.z = 0.15; g.position.set(0, 0.62, 0.02); },
    balo: g => { add(g, Bx(0.7, 0.72, 0.32), toon('#ffd36e'), 0, 0, 0, '#a8742e'); add(g, Bx(0.46, 0.3, 0.1), toon('#ffb36b'), 0, -0.14, -0.2, '#a8742e'); [-1, 1].forEach(s => { const st = add(g, new THREE.TorusGeometry(0.36, 0.035, 6, 20, Math.PI), toon('#ffb36b'), s * 0.22, 0.05, 0.25, null); st.rotation.y = Math.PI / 2; st.userData.wrapAround = true; }); g.position.set(0, 0.95, -0.98); },
    canh: g => { g.userData.flap = []; [-1, 1].forEach(s => { const w = new THREE.Group(); w.position.set(s * 0.25, 0, 0); g.add(w); const f = add(w, S(0.4, 18, 12), toon('#ffffff'), s * 0.38, 0.12, 0, '#a8a0c8'); f.scale.set(1, 0.6, 0.12); f.rotation.z = s * 0.4; w.userData.s = s; g.userData.flap.push(w); }); g.position.set(0, 1.15, -0.85); },
    'ao-choang': g => { const t = canvasTex(128, 128, c => { c.fillStyle = '#3a3f86'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#fff3a8'; [[20, 30], [80, 20], [50, 80], [100, 100], [20, 110]].forEach(([x, y]) => c.fillRect(x, y, 5, 5)); }); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.05, 1.2, 24, 1, true, Math.PI * 0.6, Math.PI * 0.8), new THREE.MeshToonMaterial({ map: t, gradientMap: K.grad, side: THREE.DoubleSide })); c.position.y = 0; g.add(c); const knot = add(g, S(0.08, 10, 8), toon('#ffd36e'), 0, 0.58, 0.72, INK); g.position.set(0, 0.95, -0.05); },
  };
  /** Tạo món trang phục, đã đặt sẵn vị trí trong không gian pivot của thú. */
  function buildOutfit(id) {
    const g = new THREE.Group(); g.userData.itemId = id;
    if (O[id]) O[id](g);
    g.traverse(o => { if (o.isMesh && !o.userData.outline) o.castShadow = true; });
    return g;
  }

  return { build, buildOutfit, surface };
}
