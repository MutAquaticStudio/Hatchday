// Dựng thú 3D theo loài + giai đoạn + dáng + gen. Dùng chung cho thú trong game và ảnh thu nhỏ ở Sổ loài.
// Quy ước (không gian `pivot`): thân là khối cầu tâm y≈0.98, đỉnh đầu ≈1.93, mặt nhìn về +z.
import { SPECIES_BY_ID, SPECIES, STAGES, REGIONS } from './species';

/** Vị trí chuẩn mà đồ mặc (decor3d) đang giả định — dùng để tính độ lệch cho từng dáng thân. */
const BASE = { cy: 0.98, sx: 1.06, sy: 0.95, sz: 1 };
const BODY = {
  tron: { cy: 0.98, sx: 1.06, sy: 0.95, sz: 1 },
  le: { cy: 0.96, sx: 1.04, sy: 0.93, sz: 1 },
  dai: { cy: 1.05, sx: 0.98, sy: 1.04, sz: 0.96 },
  det: { cy: 0.86, sx: 1.18, sy: 0.83, sz: 1.08 },
  giot: { cy: 0.98, sx: 1.02, sy: 0.96, sz: 1 },
};

export function makePetBuilder(K) {
  const { THREE, add, toon, petToon } = K;
  const S = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
  const Cone = (r, h, s = 16) => new THREE.ConeGeometry(r, h, s);
  const Cy = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
  const shape = (pts) => { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); return sh; };
  const starGeo = (r, d = 0.08) => {
    const pts = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    const g = new THREE.ExtrudeGeometry(shape(pts), { depth: d, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }); g.center(); return g;
  };
  const heartGeo = (r, d = 0.06) => {
    const sh = new THREE.Shape(); sh.moveTo(0, -r); sh.bezierCurveTo(r * 1.4, -r * 0.1, r * 0.7, r * 1.1, 0, r * 0.45); sh.bezierCurveTo(-r * 0.7, r * 1.1, -r * 1.4, -r * 0.1, 0, -r);
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }); g.center(); return g;
  };
  const glow = (c, k = 0.45) => new THREE.MeshToonMaterial({ color: c, gradientMap: K.grad, emissive: c, emissiveIntensity: k });
  /** Đặt vật lên bề mặt thân (ellipsoid) theo hướng (theta từ đỉnh, phi quanh trục y; phi = 0 là mặt trước). */
  const onBody = (b, theta, phi, lift = 0) => new THREE.Vector3(
    Math.sin(theta) * Math.sin(phi) * (b.sx + lift), b.cy + Math.cos(theta) * (b.sy + lift), Math.sin(theta) * Math.cos(phi) * (b.sz + lift));

  /**
   * look = { species, stage, form, genes } → dựng vào `into` (Group rỗng). Trả về các bộ phận để game.js làm hoạt ảnh.
   * stage: baby | child | teen | adult | elder. form chỉ có tác dụng từ adult.
   */
  function build(into, look) {
    const sp = SPECIES_BY_ID[look.species] || SPECIES[0];
    const stage = look.stage && STAGES[look.stage] ? look.stage : 'baby';
    const grown = stage === 'adult' || stage === 'elder';
    const form = grown ? look.form : null;
    const genes = look.genes || {};
    const lvl = { baby: 0, child: 1, teen: 2, adult: 3, elder: 3 }[stage];

    /* màu: gen lệch sắc độ nhẹ để không bé nào giống bé nào; xế chiều nhạt đi một chút */
    const hue = (genes.hue || 0) * 0.025;
    const tint = c => { const col = new THREE.Color(c); col.offsetHSL(hue, stage === 'elder' ? -0.12 : 0, stage === 'elder' ? 0.03 : 0); return '#' + col.getHexString(); };
    const pal = { body: tint(sp.pal.body), deep: tint(sp.pal.deep), ink: sp.pal.ink, inner: form === 'thuong' ? '#ff9fbe' : sp.pal.inner, accent: tint(sp.pal.accent) };
    const INK = pal.ink;
    const bodyMat = petToon(pal.body), deepMat = petToon(pal.deep), accMat = toon(pal.accent), innerMat = toon(pal.inner);

    /* thân */
    const b = { ...BODY[sp.body] };
    if (form === 'tron') { b.sx *= 1.08; b.sz *= 1.06; b.sy *= 0.98; b.cy -= 0.02; }
    if (form === 'nhanh') { b.sy *= 1.05; b.cy += 0.04; b.sx *= 0.97; }
    const body = add(into, S(1, 56, 40), bodyMat, 0, b.cy, 0, INK, 0.035);
    body.scale.set(b.sx, b.sy, b.sz);
    if (sp.body === 'le') { const bl = add(into, S(0.86, 40, 28), bodyMat, 0, b.cy - 0.42, 0.02, INK, 0.035); bl.scale.set(1.36, 0.78, 1.22); }
    if (sp.body === 'giot') add(into, Cone(0.42, 0.62, 28), bodyMat, 0, b.cy + b.sy * 0.93, -0.04, INK, 0.03).rotation.x = -0.12;
    const top = b.cy + b.sy;

    /* hoa văn (xuất hiện từ Nhí) */
    if (lvl >= 1) {
      if (sp.pattern === 'bung') { const m = add(into, S(0.5, 28, 20), toon(lighten(pal.body, 0.55)), 0, b.cy - b.sy * 0.5, b.sz * 0.66, null); m.scale.set(1.25, 0.9, 0.45); }
      if (sp.pattern === 'dom') [[1.15, 2.3], [1.5, 2.9], [0.9, 3.4], [1.35, 3.9], [1.7, 2.0], [1.0, 4.3], [0.7, 2.7]].forEach(([th, ph], i) => {
        if (lvl < 2 && i > 3) return;
        const m = add(into, S(0.11 + (i % 3) * 0.025, 14, 10), toon(pal.accent), 0, 0, 0, null); m.position.copy(onBody(b, th, ph, -0.03)); m.scale.set(1, 1, 0.35); m.lookAt(m.position.clone().multiplyScalar(2).setY(m.position.y * 2 - b.cy));
      });
      if (sp.pattern === 'soc') [0.75, 1.15, 1.55].forEach(th => [-1, 1].forEach(sg => {
        const m = add(into, S(0.32, 16, 10), toon(pal.deep === pal.body ? pal.accent : pal.deep), 0, 0, 0, null);
        m.position.copy(onBody(b, th, Math.PI + sg * 0.55, -0.04)); m.scale.set(0.95, 0.2, 0.3); m.lookAt(m.position.clone().multiplyScalar(2).setY(m.position.y * 2 - b.cy)); m.rotateZ(sg * 0.5);
      }));
      if (sp.pattern === 'ma') { const m = new THREE.Mesh(new THREE.SphereGeometry(1.012, 48, 16, 0, Math.PI * 2, 0, 0.72), petToon(pal.deep)); m.position.y = b.cy; m.scale.set(b.sx, b.sy, b.sz); into.add(m); }
      if (sp.pattern === 'cauvong') {
        const cols = ['#ffa6c9', '#ffe08a', '#a8ecc4', '#a8d4ff'];
        cols.forEach((c, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1.012, 48, 6, 0, Math.PI * 2, 0.18 + i * 0.15, 0.15), toon(c)); m.position.y = b.cy; m.scale.set(b.sx, b.sy, b.sz); into.add(m); });
        if (sp.body !== 'tron') cols.slice(0, 3).forEach((c, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1.012, 48, 6, 0, Math.PI * 2, 2.25 + i * 0.22, 0.22), toon(c)); m.position.y = b.cy; m.scale.set(b.sx, b.sy, b.sz); into.add(m); });
      }
    }

    /* tai: nhóm ngoài để game.js lắc (rotation.z quanh -s·0.38), nhóm trong mang góc riêng của từng kiểu */
    const earScale = (0.9 + (genes.ear || 0) * 0.07) * [0.72, 0.85, 0.95, 1, 1][lvl] * (form === 'nhanh' ? 1.18 : 1);
    const ears = [-1, 1].map(s => {
      const eg = new THREE.Group(); eg.userData.s = s; eg.rotation.z = -s * 0.38; into.add(eg);
      const ig = new THREE.Group(); eg.add(ig); ig.scale.setScalar(earScale);
      eg.position.set(s * 0.5 * b.sx / BASE.sx, b.cy + 0.55 * b.sy, -0.03);
      const e = sp.ears;
      if (e === 'meo') { const c = add(ig, Cone(0.3, 0.6, 20), bodyMat, 0, 0.28, 0, INK, 0.03); c.scale.z = 0.6; const i2 = add(ig, Cone(0.17, 0.36, 16), innerMat, 0, 0.25, 0.09, null); i2.scale.z = 0.4; }
      if (e === 'tho') { ig.rotation.z = s * 0.22; const c = add(ig, S(0.3, 24, 18), bodyMat, 0, 0.62, -0.02, INK, 0.03); c.scale.set(0.55, 1.9, 0.45); const i2 = add(ig, S(0.18), innerMat, 0, 0.6, 0.1, null); i2.scale.set(0.5, 2.3, 0.3); }
      if (e === 'gau') { const c = add(ig, S(0.27, 22, 16), bodyMat, 0, 0.14, -0.02, INK, 0.03); c.scale.z = 0.7; const i2 = add(ig, S(0.15), innerMat, 0, 0.14, 0.12, null); i2.scale.z = 0.35; }
      if (e === 'cup') { ig.rotation.z = -s * 1.55; ig.position.y = -0.12; const c = add(ig, S(0.3, 22, 16), deepMat, 0, 0.36, -0.02, INK, 0.03); c.scale.set(0.62, 1.35, 0.45); }
      if (e === 'vay') { eg.position.y = b.cy + 0.15 * b.sy; eg.position.x = s * (b.sx * 0.93); ig.rotation.z = -s * 1.1; const c = add(ig, Cone(0.24, 0.62, 3), accMat, 0, 0.26, 0, INK, 0.02); c.scale.z = 0.3; }
      if (e === 'sung') { ig.rotation.z = s * 0.15; add(ig, Cone(0.1, 0.42, 14), toon(pal.accent), 0, 0.2, 0, INK, 0.02); if (sp.rarity === 'huyen' && lvl >= 3) { const br = add(ig, Cone(0.06, 0.22, 10), toon(pal.accent), s * 0.1, 0.24, 0, INK, 0.015); br.rotation.z = -s * 0.9; } }
      if (e === 'ang') { ig.rotation.z = s * 0.1; add(ig, Cy(0.022, 0.03, 0.5, 8), toon(pal.ink), 0, 0.25, 0, null); add(ig, S(0.09, 14, 10), lvl >= 2 && sp.id === 'dom-dom' ? glow(pal.accent) : accMat, 0, 0.52, 0, INK, 0.015); }
      if (e === 'la') { const c = add(ig, S(0.28, 20, 14), toon(pal.deep), 0, 0.34, 0, INK, 0.025); c.scale.set(0.5, 1.3, 0.16); add(ig, Cy(0.012, 0.012, 0.5, 6), toon(pal.ink), 0, 0.34, 0.05, null); }
      if (e === 'long') [-0.35, 0, 0.35].forEach((a, k) => { const f = add(ig, S(0.12, 14, 10), k === 1 ? accMat : deepMat, Math.sin(a) * 0.12, 0.2 + Math.cos(a) * 0.08, 0, INK, 0.02); f.scale.set(0.6, 1.9, 0.5); f.rotation.z = -a * 1.4; });
      return eg;
    });

    /* chỏm đầu: Sơ sinh đội vỏ trứng, từ Nhí mới có chỏm riêng của loài */
    const topG = new THREE.Group(); topG.position.set(0, top - 0.07, 0); into.add(topG);
    const topScale = [0.6, 0.75, 0.9, 1, 1][lvl];
    if (lvl === 0) {
      const rc = REGIONS[sp.region] || REGIONS[0];
      const cap = add(topG, new THREE.SphereGeometry(0.6, 28, 14, 0, Math.PI * 2, 0, 1.15), toon('#fffaf0'), 0, -0.3, 0, '#9a8a7a', 0.02);
      cap.material.side = THREE.DoubleSide; topG.rotation.z = 0.22;
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const z = add(topG, Cone(0.09, 0.16, 4), toon('#fffaf0'), Math.cos(a) * 0.54, -0.1, Math.sin(a) * 0.54, null); z.rotation.x = Math.PI; }
      [[0.25, 0.08, 0.38], [-0.3, 0.12, 0.3], [0.05, 0.24, 0.22]].forEach(([x, y, z]) => { const d = add(topG, S(0.07, 10, 8), toon(rc.color), x, y, z, null); d.scale.z = 0.4; d.lookAt(x * 3, y * 3 + 0.3, z * 3); });
    } else {
      const g = new THREE.Group(); g.scale.setScalar(topScale); topG.add(g);
      const t = sp.top;
      if (t === 'mam') { add(g, Cy(0.03, 0.04, 0.32, 8), toon('#5cbf6a'), 0, 0.14, 0, '#2f7a3d', 0.015); [-1, 1].forEach(s => { const lf = add(g, S(0.16, 16, 12), toon('#7edb72'), s * 0.15, 0.3, 0, '#2f7a3d', 0.02); lf.scale.set(1.25, 0.45, 0.7); lf.rotation.z = s * 0.45; }); }
      if (t === 'hoa') { const petal = sp.id === 'hoa-mai' ? '#ffd23e' : sp.id === 'sen-hong' ? '#ff9fc4' : pal.accent; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const p = add(g, S(0.14, 14, 10), toon(petal), Math.cos(a) * 0.17, 0.1, Math.sin(a) * 0.17, INK, 0.015); p.scale.set(1.2, 0.4, 0.8); p.rotation.y = -a; } add(g, S(0.09, 12, 10), toon('#ffb84a'), 0, 0.15, 0, INK, 0.015); }
      if (t === 'may') [[0, 0.12, 0, 0.2], [-0.2, 0.06, 0.05, 0.15], [0.2, 0.07, -0.02, 0.16]].forEach(([x, y, z, r]) => add(g, S(r), toon(sp.id === 'keo-bong-gon' ? pal.accent : '#ffffff'), x, y, z, '#a8a0c8', 0.02));
      if (t === 'sao') { const st = add(g, starGeo(0.24), glow(pal.accent, 0.35), 0, 0.22, 0, INK, 0.015); st.userData.spin = 1; }
      if (t === 'nam') { const cap = add(g, new THREE.SphereGeometry(0.62, 32, 14, 0, Math.PI * 2, 0, 1.4), toon(pal.accent), 0, -0.12, 0, INK, 0.03); cap.scale.y = 0.75; [[0.3, 0.25, 0.2], [-0.32, 0.22, 0.15], [0, 0.38, -0.25], [0.05, 0.3, 0.4], [-0.15, 0.2, -0.45]].forEach(([x, y, z]) => { const d = add(g, S(0.08, 10, 8), toon('#ffffff'), x, y - 0.06, z, null); d.scale.y = 0.5; }); }
      if (t === 'lua') { const f = add(g, S(0.2, 18, 14), glow(pal.accent, 0.6), 0, 0.14, 0, INK, 0.015); f.scale.y = 1.1; add(g, Cone(0.15, 0.32, 14), glow(pal.accent, 0.6), 0, 0.38, 0, INK, 0.015); add(g, S(0.09, 10, 8), glow('#fff6c8', 0.7), 0, 0.12, 0.1, null); g.userData.flicker = 1; }
      if (t === 'giot') { const c = sp.id === 'ngoc-trai' ? '#fffaff' : '#8fd3ff'; add(g, S(0.16, 18, 14), toon(c), 0, 0.14, 0, INK, 0.015); add(g, Cone(0.13, 0.22, 16), toon(c), 0, 0.33, 0, INK, 0.015); }
      if (t === 'trang') { const m = add(g, new THREE.TorusGeometry(0.2, 0.07, 10, 24, Math.PI * 1.3), glow(pal.accent, 0.4), 0, 0.26, 0, INK, 0.015); m.rotation.z = -Math.PI * 0.15; }
      if (t === 'xoay') { [0.22, 0.16, 0.1].forEach((r, i) => { const tr = add(g, new THREE.TorusGeometry(r, 0.07, 10, 24), toon(sp.id === 'banh-bao' ? '#fffaf2' : '#fff6e8'), 0, 0.05 + i * 0.11, 0, INK, 0.015); tr.rotation.x = Math.PI / 2; }); add(g, Cone(0.06, 0.14, 10), toon(pal.accent), 0, 0.38, 0, INK, 0.01); }
      if (t === 'chom') [-0.4, 0, 0.4].forEach((a, k) => { const f = add(g, S(0.1, 12, 10), toon(pal.accent), Math.sin(a) * 0.1, 0.2, -k * 0.05, INK, 0.015); f.scale.set(0.6, 2.2, 0.6); f.rotation.z = -a; });
      if (stage === 'elder') [[-0.16, 0.02], [0.16, 0.0]].forEach(([x, z]) => add(into, S(0.11, 12, 10), toon('#ffffff'), x, top - 0.12, 0.45 + z, '#a8a0c8', 0.015).scale.set(1.3, 0.5, 0.7));
    }

    /* tay, chân: tay nằm trong khung co giãn theo bề ngang thân để hoạt ảnh cũ (x = ±0.98) vẫn đúng */
    const armRig = new THREE.Group(); armRig.scale.x = b.sx / BASE.sx; armRig.position.y = b.cy - BASE.cy; into.add(armRig);
    const arms = [-1, 1].map(s => { const a = add(armRig, S(0.2, 18, 14), bodyMat, s * 0.98, 0.78, 0.22, INK); a.scale.set(0.8, 1, 0.8); return a; });
    const feet = [-1, 1].map(s => { const f = add(into, S(0.27, 20, 14), deepMat, s * 0.42 * Math.min(1.15, b.sx / BASE.sx), 0.1, 0.38, INK); f.scale.set(1, 0.5, 1.2); return f; });

    /* đuôi (từ Nhí) */
    const tail = new THREE.Group(); tail.position.set(0, b.cy - 0.48, -0.98 * b.sz); into.add(tail);
    const tailScale = [0.7, 0.85, 0.95, 1, 1][lvl] * (form === 'nhanh' ? 1.25 : 1);
    const tg = new THREE.Group(); tg.scale.setScalar(tailScale); tail.add(tg);
    const tt = lvl === 0 ? (sp.tail === 'none' ? 'none' : 'tron') : sp.tail;
    if (tt === 'tron') add(tg, S(0.22, 18, 14), deepMat, 0, 0, 0, INK);
    if (tt === 'xu') { const m = add(tg, S(0.32, 20, 14), deepMat, 0, 0.18, -0.14, INK); m.scale.set(0.8, 1.3, 0.8); m.rotation.x = -0.6; add(tg, S(0.16, 14, 10), toon(lighten(pal.body, 0.6)), 0, 0.5, -0.36, INK, 0.02); }
    if (tt === 'xoan') { const m = add(tg, new THREE.TorusGeometry(0.17, 0.07, 10, 24, Math.PI * 1.6), deepMat, 0, 0.12, -0.08, INK, 0.02); m.rotation.y = Math.PI / 2; }
    if (tt === 'ca') [-1, 1].forEach(s => { const f = add(tg, S(0.22, 16, 12), accMat, s * 0.14, 0.1, -0.12, INK, 0.02); f.scale.set(0.45, 1.2, 0.25); f.rotation.z = -s * 0.7; });
    if (tt === 'la') { const f = add(tg, S(0.24, 16, 12), toon(sp.pal.deep), 0, 0.12, -0.12, INK, 0.02); f.scale.set(0.6, 1.4, 0.18); f.rotation.x = -0.7; }
    if (tt === 'sao') { add(tg, Cy(0.025, 0.025, 0.4, 6), toon(pal.ink), 0, 0.15, -0.1, null).rotation.x = -0.5; add(tg, starGeo(0.15), glow(pal.accent, 0.5), 0, 0.34, -0.22, INK, 0.012); }
    if (tt === 'may') [[0, 0.06, 0, 0.2], [0, 0.22, -0.16, 0.15]].forEach(([x, y, z, r]) => add(tg, S(r), toon(sp.id === 'keo-bong-gon' ? pal.accent : '#ffffff'), x, y, z, '#a8a0c8', 0.02));

    /* phụ kiện của loài: má phúng phính và ria có từ Nhí, các thứ khác từ Thiếu niên, hào quang chỉ khi trưởng thành */
    const anim = { wings: [], halo: null, orbit: [], tent: [], spin: [] };
    const extras = new Set(sp.extra);
    if (form === 'tron') extras.add('bom');
    const exScale = lvl >= 3 ? 1 : 0.75;
    for (const ex of extras) {
      if (ex === 'bom' && lvl >= 1) [-1, 1].forEach(s => { const m = add(into, S(0.26, 18, 14), bodyMat, s * 0.74 * b.sx, b.cy - 0.22, 0.5 * b.sz, INK, 0.025); m.scale.set(0.8, 0.75, 0.7); });
      if (ex === 'ria' && lvl >= 1) [-1, 1].forEach(s => [-0.06, 0.04].forEach(dy => { const w = add(into, Cy(0.012, 0.012, 0.42, 5), toon(INK), s * 0.92 * b.sx, b.cy - 0.06 + dy, 0.48 * b.sz, null); w.rotation.z = Math.PI / 2 + s * dy * 3; w.rotation.y = s * 0.5; }));
      if (lvl < 2) continue;
      if (ex === 'canh') [-1, 1].forEach(s => {
        const w = new THREE.Group(); w.position.set(s * 0.5 * b.sx, b.cy + 0.15, -0.72 * b.sz); w.userData.s = s; into.add(w);
        const bat = sp.id === 'doi-nho', bug = sp.id === 'chuon-chuon' || sp.id === 'ong-mat' || sp.id === 'dom-dom';
        const mat = bug ? new THREE.MeshToonMaterial({ color: '#e8f6ff', gradientMap: K.grad, transparent: true, opacity: 0.75 }) : toon(bat ? pal.deep : lvl >= 3 ? '#ffffff' : lighten(pal.body, 0.5));
        const n = bug ? 2 : 1;
        for (let k = 0; k < n; k++) { const m = add(w, S(0.3, 18, 12), mat, s * 0.32, 0.12 - k * 0.22, 0, bug ? '#9ab8d8' : INK, 0.02); m.scale.set(1.35 * exScale, (bug ? 0.45 : 0.8) * exScale, 0.18); m.rotation.z = s * (0.5 - k * 0.6); }
        anim.wings.push(w);
      });
      if (ex === 'vay') { const f = add(into, Cone(0.28 * exScale, 0.6 * exScale, 3), accMat, 0, b.cy + 0.55 * b.sy, -0.72 * b.sz, INK, 0.02); f.scale.z = 0.35; f.rotation.x = -0.5; }
      if (ex === 'mai') { const m = add(into, new THREE.SphereGeometry(0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), toon(pal.accent), 0, b.cy - 0.1, -0.42 * b.sz, INK, 0.03); m.rotation.x = -Math.PI / 2 + 0.25; m.scale.set(exScale, exScale, 0.75 * exScale); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const d = add(m, new THREE.CircleGeometry(0.16, 6), toon(lighten(pal.accent, 0.35)), Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.8, null); d.lookAt(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 2.4); } }
      if (ex === 'oc') { const g = new THREE.Group(); g.position.set(0, b.cy + 0.15, -0.78 * b.sz); g.scale.setScalar(exScale); into.add(g); add(g, S(0.5, 24, 18), toon(pal.accent), 0, 0, -0.1, INK, 0.03); [0.36, 0.24, 0.12].forEach((r, i) => { const tr = add(g, new THREE.TorusGeometry(r, 0.05, 8, 24), toon(lighten(pal.accent, 0.3)), 0, 0, 0.32 + i * 0.06, null); tr.rotation.y = 0; }); }
      if (ex === 'gai') [0.6, 0.95, 1.3, 1.65].forEach(th => { const c = add(into, Cone(0.11 * exScale, 0.26 * exScale, 10), toon(pal.deep), 0, 0, 0, INK, 0.015); c.position.copy(onBody(b, th, Math.PI, -0.02)); c.lookAt(c.position.clone().multiplyScalar(2).setY(c.position.y * 2 - b.cy)); c.rotateX(Math.PI / 2); });
      if (ex === 'coan') for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const p = add(into, S(0.2, 12, 10), toon(pal.accent), Math.sin(a) * 0.82 * b.sx, b.cy - 0.62 * b.sy, Math.cos(a) * 0.78 * b.sz, INK, 0.015); p.scale.set(1.1 * exScale, 0.35, 0.7 * exScale); p.rotation.y = a; }
      if (ex === 'tua') for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; const t = add(into, Cy(0.05, 0.03, 0.42 * exScale, 8), toon(pal.deep), Math.sin(a) * 0.6 * b.sx, 0.22, Math.cos(a) * 0.55 * b.sz - 0.1, INK, 0.012); t.userData.ph = i; anim.tent.push(t); }
      if (ex === 'hao' && lvl >= 3) { const h = add(into, new THREE.TorusGeometry(0.42, 0.045, 10, 40), glow('#ffe58a', 0.7), 0, top + 0.42, -0.1, '#b88a2a', 0.012); h.rotation.x = Math.PI / 2 - 0.25; anim.halo = h; }
    }

    /* dáng trưởng thành */
    if (form === 'thuong') { const h = add(into, heartGeo(0.16), toon('#ff7aa8'), 0, b.cy - b.sy * 0.55, b.sz * 0.83, '#a83a62', 0.015); h.rotation.x = -0.35; }
    if (form === 'sang') for (let i = 0; i < 3; i++) { const st = add(into, starGeo(0.1, 0.04), glow('#fff2a8', 0.8), 0, 0, 0, '#b88a2a', 0.01); st.userData.ph = i * Math.PI * 2 / 3; anim.orbit.push(st); }
    topG.traverse(o => { if (o.userData.spin) anim.spin.push(o); });

    const h = (top - (BASE.cy + BASE.sy));
    const offsets = {
      head: [h, 0], face: [(b.cy + 0.18 * b.sy) - (BASE.cy + 0.18 * BASE.sy), b.sz - BASE.sz],
      neck: [(b.cy - 0.4 * b.sy) - (BASE.cy - 0.4 * BASE.sy), 0], back: [b.cy - BASE.cy, -(b.sz - BASE.sz)],
    };
    if (look.face) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(1.006, 48, 30, Math.PI / 2 - 0.75, 1.5, Math.PI / 2 - 0.78, 1.24),
        new THREE.MeshBasicMaterial({ map: simpleFace(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      body.add(f);
    }
    return { body, ears, top: topG, tail, arms, feet, anim, offsets, flicker: !!topG.children[0]?.userData.flicker, headY: top, stage, species: sp };
  }

  /** Mặt tĩnh cho ảnh thu nhỏ (trong game, mặt do game.js vẽ và đổi theo cảm xúc). */
  let faceTex = null;
  function simpleFace() {
    if (faceTex) return faceTex;
    const W = 300, H = 248, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const ell = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };
    [W * 0.32, W * 0.68].forEach(x => {
      const y = H * 0.47; ell(x, y, 23, 32); g.fillStyle = '#4a2140'; g.fill();
      const gr = g.createLinearGradient(0, y - 32, 0, y + 32); gr.addColorStop(0, '#4a2140'); gr.addColorStop(0.5, '#8a4be0'); gr.addColorStop(1, '#ffa6dc');
      ell(x, y + 2, 19, 27); g.fillStyle = gr; g.fill(); ell(x, y + 3, 9, 13); g.fillStyle = '#2a0f2e'; g.fill();
      ell(x - 7, y - 12, 8, 10); g.fillStyle = '#fff'; g.fill(); ell(x + 8, y + 11, 4, 4); g.fill();
      ell(x + (x < W / 2 ? -14 : 14), y + 44, 20, 9); g.fillStyle = 'rgba(255,120,160,.35)'; g.fill();
    });
    g.strokeStyle = '#4a2140'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath();
    g.moveTo(W / 2 - 14, H * 0.72); g.quadraticCurveTo(W / 2 - 7, H * 0.78, W / 2, H * 0.73); g.quadraticCurveTo(W / 2 + 7, H * 0.78, W / 2 + 14, H * 0.72); g.stroke();
    faceTex = new THREE.CanvasTexture(c); faceTex.colorSpace = THREE.SRGBColorSpace; return faceTex;
  }

  /** Hoạt ảnh phụ (cánh vỗ, hào quang xoay, sao bay quanh, xúc tu đung đưa). */
  function animate(parts, t, reduce) {
    if (!parts || reduce) return;
    const a = parts.anim;
    a.wings.forEach(w => { w.rotation.y = w.userData.s * (0.25 + Math.sin(t * 9) * 0.25); });
    if (a.halo) { a.halo.rotation.z = t * 0.8; a.halo.position.y = parts.headY + 0.42 + Math.sin(t * 2) * 0.04; }
    a.orbit.forEach(s => { const p = t * 1.2 + s.userData.ph; s.position.set(Math.cos(p) * 1.35, 1.1 + Math.sin(p * 2) * 0.35, Math.sin(p) * 1.0); s.rotation.y = t * 2; });
    a.tent.forEach(o => { o.rotation.x = Math.sin(t * 2.5 + o.userData.ph) * 0.25; o.rotation.z = Math.cos(t * 2 + o.userData.ph) * 0.15; });
    a.spin.forEach(o => { o.rotation.y = t * 1.5; });
    if (parts.flicker) { const g = parts.top.children[0]; g.scale.y = 1 + Math.sin(t * 13) * 0.06; }
  }

  return { build, animate };
}

function lighten(hex, k) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = c => Math.round(c + (255 - c) * k).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}

/** Giải phóng tài nguyên GPU của một nhóm thú cũ (vật liệu viền dùng chung thì giữ lại). */
export function disposePet(group) {
  group.traverse(o => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    if (!o.userData.outline) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m?.dispose());
  });
  group.clear();
}
