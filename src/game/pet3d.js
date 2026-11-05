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
    Math.sin(theta) * Math.sin(phi) * (b.sx + lift), (b.y ?? b.cy) + Math.cos(theta) * (b.sy + lift), Math.sin(theta) * Math.cos(phi) * (b.sz + lift));

  /**
   * look = { species, stage, form, genes } → dựng vào `into` (Group rỗng). Trả về các bộ phận để game.js làm hoạt ảnh.
   * stage: baby | child | teen | adult | elder. form chỉ có tác dụng từ adult.
   */
  /** Bố trí đầu (H) và thân (B) theo dáng cơ thể + giai đoạn. Sơ sinh luôn là bánh dẻo tròn. */
  function layout(sp, lvl, form) {
    const fat = form === 'tron' ? 1.18 : 1, quick = form === 'nhanh';
    const legK = form === 'tron' ? 0.8 : quick ? 1.15 : 1;
    if (lvl === 0 || sp.plan === 'banh' || !sp.plan) {
      const b = { ...BODY[sp.body] };
      if (form === 'tron') { b.sx *= 1.08; b.sz *= 1.06; b.sy *= 0.98; b.cy -= 0.02; }
      if (quick) { b.sy *= 1.05; b.cy += 0.04; b.sx *= 0.97; }
      const E = { y: b.cy, z: 0, sx: b.sx, sy: b.sy, sz: b.sz };
      return { kind: 'banh', H: E, B: E, sep: false, legs: 'stub', legL: 0, arms: true, hover: 0, segs: [] };
    }
    const t = lvl === 1 ? 0 : lvl === 2 ? 0.5 : 1, L = (a, b) => a + (b - a) * t;
    const hr = L(0.8, 0.67), H = { sx: hr * 1.06, sy: hr * 0.97, sz: hr }, g = L(0.84, 1);
    if (sp.plan === 'thu4') {
      const legL = L(0.2, 0.36) * (quick ? 1.25 : 1) * legK;
      const B = { sx: 0.74 * fat * g, sy: 0.56 * g, sz: (quick ? 1.08 : 1) * g * 0.98 };
      B.y = legL + B.sy * 0.85; B.z = -0.22; H.y = B.y + B.sy * 0.55 + H.sy * 0.52; H.z = B.z + B.sz * 0.78;
      return { kind: 'thu4', H, B, sep: true, legs: 'thu4', legL, arms: false, hover: 0, segs: [] };
    }
    if (sp.plan === 'dung') {
      const legL = L(0.1, 0.18) * (quick ? 1.35 : 1) * legK;
      const B = { sx: 0.66 * fat * g, sy: L(0.5, 0.6), sz: 0.6 * fat * g };
      B.y = legL + B.sy * 0.92; B.z = 0; H.y = B.y + B.sy * 0.78 + H.sy * 0.62; H.z = 0.04;
      return { kind: 'dung', H, B, sep: true, legs: 'stub', legL, arms: true, hover: 0, segs: [] };
    }
    if (sp.plan === 'chim') {
      const legL = L(0.16, 0.3) * (quick ? 1.3 : 1) * legK * (sp.id === 'hac-trang' ? 1.5 : 1);
      const B = { sx: 0.62 * fat * g, sy: L(0.52, 0.62), sz: 0.62 * fat * g };
      B.y = legL + B.sy * 0.9; B.z = -0.06; H.y = B.y + B.sy * 0.7 + H.sy * 0.62; H.z = 0.08;
      return { kind: 'chim', H, B, sep: true, legs: 'chim', legL, arms: false, hover: 0, segs: [] };
    }
    /* ran: bay lơ lửng, thân là chuỗi khúc tròn nhỏ dần về đuôi */
    const B = { sx: 0.52 * fat * g, sy: 0.46 * g, sz: 0.52 * fat * g, y: 0.62, z: -0.42 };
    H.y = 1.05; H.z = 0.22;
    const n = lvl === 1 ? 2 : lvl === 2 ? 3 : 4, segs = [];
    for (let i = 0; i < n; i++) { const k = (i + 1) / 4; segs.push({ y: 0.6 + Math.sin(k * 2.6) * 0.18 + (quick ? k * 0.15 : 0), z: B.z - 0.42 * (i + 1) * g, r: 0.42 * g * (1 - k * 0.62) }); }
    return { kind: 'ran', H, B, sep: true, legs: 'none', legL: 0, arms: false, hover: 0.32, segs };
  }

  /**
   * look = { species, stage, form, genes, face? } → dựng vào `into` (Group rỗng). Trả về các bộ phận để game.js làm hoạt ảnh.
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

    const Lo = layout(sp, lvl, form), { H, B, sep } = Lo;
    const root = new THREE.Group(); root.position.y = Lo.hover;
    const kH = H.sx / BASE.sx, kB = B.sx / BASE.sx;
    const outward = (m, E) => m.lookAt(m.position.clone().sub(new THREE.Vector3(0, E.y, E.z)).multiplyScalar(2).add(new THREE.Vector3(0, E.y, E.z)));

    /* đầu (mang khuôn mặt) và thân */
    const head = add(root, S(1, 56, 40), bodyMat, 0, H.y, H.z, INK, 0.035);
    head.scale.set(H.sx, H.sy, H.sz);
    let bodyM = head;
    if (sep) { bodyM = add(root, S(1, 40, 28), bodyMat, 0, B.y, B.z, INK, 0.035 / Math.max(kB, 0.5)); bodyM.scale.set(B.sx, B.sy, B.sz); }
    if (!sep && sp.body === 'le') { const bl = add(root, S(0.86, 40, 28), bodyMat, 0, B.y - 0.42, 0.02, INK, 0.035); bl.scale.set(1.36, 0.78, 1.22); }
    if (!sep && sp.body === 'giot') add(root, Cone(0.42, 0.62, 28), bodyMat, 0, B.y + B.sy * 0.93, -0.04, INK, 0.03).rotation.x = -0.12;
    Lo.segs.forEach((g, i) => add(root, S(g.r, 24, 18), i % 2 ? deepMat : bodyMat, 0, g.y, g.z, INK, 0.03));
    let neckM = null;
    if (Lo.kind === 'thu4') { neckM = add(root, S(0.36 * kH * 1.06, 20, 14), bodyMat, 0, (H.y + B.y) / 2 + 0.05, (H.z + B.z) / 2 + 0.12, INK, 0.03); neckM.scale.set(1, 1.2, 1); }
    if (Lo.kind === 'chim') add(root, Cone(0.1 * kH, 0.2 * kH, 12), toon('#ffb84a'), 0, H.y - H.sy * 0.32, H.z + H.sz * 0.97, '#a8742e', 0.012).rotation.x = Math.PI / 2;
    const headTop = H.y + H.sy;

    /* hoa văn (xuất hiện từ Nhí) */
    if (lvl >= 1) {
      if (sp.pattern === 'bung') { const m = add(root, S(0.5 * kB, 28, 20), toon(lighten(pal.body, 0.55)), 0, 0, 0, null); m.position.copy(onBody(B, Lo.kind === 'thu4' ? 1.55 : 2.05, 0, -0.08 * kB)); m.position.z += B.z; m.scale.set(1.25, 0.9, 0.45); outward(m, B); }
      if (sp.pattern === 'dom') [[1.15, 2.3], [1.5, 2.9], [0.9, 3.4], [1.35, 3.9], [1.7, 2.0], [1.0, 4.3], [0.7, 2.7]].forEach(([th, ph], i) => {
        if (lvl < 2 && i > 3) return;
        const m = add(root, S((0.11 + (i % 3) * 0.025) * Math.max(kB, 0.7), 14, 10), toon(pal.accent), 0, 0, 0, null); m.position.copy(onBody(B, th, ph, -0.03)); m.position.z += B.z; m.scale.set(1, 1, 0.35); outward(m, B);
      });
      if (sp.pattern === 'soc') [0.75, 1.15, 1.55].forEach(th => [-1, 1].forEach(sg => {
        const m = add(root, S(0.32 * Math.max(kB, 0.7), 16, 10), toon(pal.deep === pal.body ? pal.accent : pal.deep), 0, 0, 0, null);
        m.position.copy(onBody(B, th, Math.PI + sg * 0.55, -0.04)); m.position.z += B.z; m.scale.set(0.95, 0.2, 0.3); outward(m, B); m.rotateZ(sg * 0.5);
      }));
      const cap = (E, a, b, c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1.012, 48, 8, 0, Math.PI * 2, a, b), toon(c)); m.position.set(0, E.y, E.z); m.scale.set(E.sx, E.sy, E.sz); root.add(m); };
      if (sp.pattern === 'ma') { const m = new THREE.Mesh(new THREE.SphereGeometry(1.012, 48, 16, 0, Math.PI * 2, 0, 0.72), petToon(pal.deep)); m.position.set(0, H.y, H.z); m.scale.set(H.sx, H.sy, H.sz); root.add(m); }
      if (sp.pattern === 'cauvong') {
        const cols = ['#ffa6c9', '#ffe08a', '#a8ecc4', '#a8d4ff'];
        cols.forEach((c, i) => cap(H, 0.18 + i * 0.15, 0.15, c));
        if (sep || sp.body !== 'tron') cols.slice(0, 3).forEach((c, i) => cap(B, 2.25 + i * 0.22, 0.22, c));
      }
    }

    /* tai: nhóm ngoài để game.js lắc (rotation.z quanh -s·0.38), nhóm trong mang góc riêng của từng kiểu */
    const earScale = (0.9 + (genes.ear || 0) * 0.07) * [0.72, 0.85, 0.95, 1, 1][lvl] * (form === 'nhanh' ? 1.3 : 1) * kH;
    const ears = [-1, 1].map(s => {
      const eg = new THREE.Group(); eg.userData.s = s; eg.rotation.z = -s * 0.38; root.add(eg);
      const ig = new THREE.Group(); eg.add(ig); ig.scale.setScalar(earScale);
      eg.position.set(s * 0.5 * H.sx / BASE.sx, H.y + 0.55 * H.sy, H.z - 0.03);
      const e = sp.ears;
      if (e === 'meo') { const c = add(ig, Cone(0.3, 0.6, 20), bodyMat, 0, 0.28, 0, INK, 0.03); c.scale.z = 0.6; const i2 = add(ig, Cone(0.17, 0.36, 16), innerMat, 0, 0.25, 0.09, null); i2.scale.z = 0.4; }
      if (e === 'tho') { ig.rotation.z = s * 0.22; const c = add(ig, S(0.3, 24, 18), bodyMat, 0, 0.62, -0.02, INK, 0.03); c.scale.set(0.55, 1.9, 0.45); const i2 = add(ig, S(0.18), innerMat, 0, 0.6, 0.1, null); i2.scale.set(0.5, 2.3, 0.3); }
      if (e === 'gau') { const c = add(ig, S(0.27, 22, 16), bodyMat, 0, 0.14, -0.02, INK, 0.03); c.scale.z = 0.7; const i2 = add(ig, S(0.15), innerMat, 0, 0.14, 0.12, null); i2.scale.z = 0.35; }
      if (e === 'cup') { ig.rotation.z = -s * 1.55; ig.position.y = -0.12; const c = add(ig, S(0.3, 22, 16), deepMat, 0, 0.36, -0.02, INK, 0.03); c.scale.set(0.62, 1.35, 0.45); }
      if (e === 'vay') { eg.position.y = H.y + 0.15 * H.sy; eg.position.x = s * (H.sx * 0.93); ig.rotation.z = -s * 1.1; const c = add(ig, Cone(0.24, 0.62, 3), accMat, 0, 0.26, 0, INK, 0.02); c.scale.z = 0.3; }
      if (e === 'sung') { ig.rotation.z = s * 0.15; add(ig, Cone(0.1, 0.42, 14), toon(pal.accent), 0, 0.2, 0, INK, 0.02); if (sp.rarity === 'huyen' && lvl >= 3) { const br = add(ig, Cone(0.06, 0.22, 10), toon(pal.accent), s * 0.1, 0.24, 0, INK, 0.015); br.rotation.z = -s * 0.9; } }
      if (e === 'ang') { ig.rotation.z = s * 0.1; add(ig, Cy(0.022, 0.03, 0.5, 8), toon(pal.ink), 0, 0.25, 0, null); add(ig, S(0.09, 14, 10), lvl >= 2 && sp.id === 'dom-dom' ? glow(pal.accent) : accMat, 0, 0.52, 0, INK, 0.015); }
      if (e === 'la') { const c = add(ig, S(0.28, 20, 14), toon(pal.deep), 0, 0.34, 0, INK, 0.025); c.scale.set(0.5, 1.3, 0.16); add(ig, Cy(0.012, 0.012, 0.5, 6), toon(pal.ink), 0, 0.34, 0.05, null); }
      if (e === 'long') [-0.35, 0, 0.35].forEach((a, k) => { const f = add(ig, S(0.12, 14, 10), k === 1 ? accMat : deepMat, Math.sin(a) * 0.12, 0.2 + Math.cos(a) * 0.08, 0, INK, 0.02); f.scale.set(0.6, 1.9, 0.5); f.rotation.z = -a * 1.4; });
      return eg;
    });

    /* chỏm đầu: Sơ sinh đội vỏ trứng, từ Nhí mới có chỏm riêng của loài */
    const topG = new THREE.Group(); topG.position.set(0, headTop - 0.07 * kH, H.z); topG.scale.setScalar(kH); root.add(topG);
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
      if (t === 'nam') { const cp = add(g, new THREE.SphereGeometry(0.62, 32, 14, 0, Math.PI * 2, 0, 1.4), toon(pal.accent), 0, -0.12, 0, INK, 0.03); cp.scale.y = 0.75; [[0.3, 0.25, 0.2], [-0.32, 0.22, 0.15], [0, 0.38, -0.25], [0.05, 0.3, 0.4], [-0.15, 0.2, -0.45]].forEach(([x, y, z]) => { const d = add(g, S(0.08, 10, 8), toon('#ffffff'), x, y - 0.06, z, null); d.scale.y = 0.5; }); }
      if (t === 'lua') { const f = add(g, S(0.2, 18, 14), glow(pal.accent, 0.6), 0, 0.14, 0, INK, 0.015); f.scale.y = 1.1; add(g, Cone(0.15, 0.32, 14), glow(pal.accent, 0.6), 0, 0.38, 0, INK, 0.015); add(g, S(0.09, 10, 8), glow('#fff6c8', 0.7), 0, 0.12, 0.1, null); g.userData.flicker = 1; }
      if (t === 'giot') { const c = sp.id === 'ngoc-trai' ? '#fffaff' : '#8fd3ff'; add(g, S(0.16, 18, 14), toon(c), 0, 0.14, 0, INK, 0.015); add(g, Cone(0.13, 0.22, 16), toon(c), 0, 0.33, 0, INK, 0.015); }
      if (t === 'trang') { const m = add(g, new THREE.TorusGeometry(0.2, 0.07, 10, 24, Math.PI * 1.3), glow(pal.accent, 0.4), 0, 0.26, 0, INK, 0.015); m.rotation.z = -Math.PI * 0.15; }
      if (t === 'xoay') { [0.22, 0.16, 0.1].forEach((r, i) => { const tr = add(g, new THREE.TorusGeometry(r, 0.07, 10, 24), toon(sp.id === 'banh-bao' ? '#fffaf2' : '#fff6e8'), 0, 0.05 + i * 0.11, 0, INK, 0.015); tr.rotation.x = Math.PI / 2; }); add(g, Cone(0.06, 0.14, 10), toon(pal.accent), 0, 0.38, 0, INK, 0.01); }
      if (t === 'chom') [-0.4, 0, 0.4].forEach((a, k) => { const f = add(g, S(0.1, 12, 10), toon(pal.accent), Math.sin(a) * 0.1, 0.2, -k * 0.05, INK, 0.015); f.scale.set(0.6, 2.2, 0.6); f.rotation.z = -a; });
      if (stage === 'elder') [[-0.16, 0.02], [0.16, 0.0]].forEach(([x, z]) => add(root, S(0.11 * kH, 12, 10), toon('#ffffff'), x * kH, headTop - 0.12 * kH, H.z + 0.45 * kH + z, '#a8a0c8', 0.015).scale.set(1.3, 0.5, 0.7));
    }

    /* tay: khung co giãn theo thân để hoạt ảnh cũ (x = ±0.98, y = 0.78) vẫn đúng chỗ */
    const armRig = new THREE.Group(); root.add(armRig);
    armRig.scale.set(B.sx / BASE.sx, B.sy / BASE.sy, B.sz / BASE.sz); armRig.position.set(0, B.y - BASE.cy * B.sy / BASE.sy, B.z);
    armRig.visible = Lo.arms;
    const arms = [-1, 1].map(s => { const a = add(armRig, S(0.2, 18, 14), bodyMat, s * 0.98, 0.78, 0.22, INK); const k = sep ? 1.45 : 1; a.scale.set(0.8 * k, 1 * k, 0.8 * k); return a; });

    /* chân: game.js đặt y = 0.1 (+ nhấc), z = 0.38 (+ bước). Nhóm `legRig` dời tới đúng chỗ của từng dáng. */
    const legRig = new THREE.Group(); root.add(legRig);
    const frontZ = Lo.kind === 'thu4' ? B.z + B.sz * 0.55 : sep ? B.z + B.sz * 0.42 : 0.38;
    legRig.position.z = frontZ - 0.38;
    const footX = Lo.kind === 'thu4' ? 0.42 * B.sx : sep ? 0.44 * B.sx : 0.42 * Math.min(1.15, B.sx / BASE.sx);
    const legTop = sep ? B.y - B.sy * 0.55 : 0;
    const makeLeg = (g, front) => {
      if (Lo.legs === 'stub') { const f = add(g, S(sep ? 0.22 : 0.27, 20, 14), deepMat, 0, 0, 0, INK); f.scale.set(1, 0.5, 1.2); if (sep && Lo.legL > 0.05) add(g, Cy(0.11, 0.13, Lo.legL + 0.1, 12), bodyMat, 0, (Lo.legL + 0.1) / 2, -0.04, INK, 0.02); }
      if (Lo.legs === 'thu4') { const h = legTop - 0.1 + 0.08; add(g, Cy(0.13 * kB / 0.74, 0.12 * kB / 0.74, h, 14), front ? bodyMat : deepMat, 0, h / 2 - 0.02, 0, INK, 0.02); const pad = add(g, S(0.15 * kB / 0.74, 16, 12), deepMat, 0, -0.03, 0.05, INK, 0.02); pad.scale.set(1, 0.55, 1.2); }
      if (Lo.legs === 'chim') { const h = legTop - 0.1 + 0.08; add(g, Cy(0.035, 0.035, h, 8), toon('#ffb84a'), 0, h / 2, 0, '#a8742e', 0.01); [-0.5, 0, 0.5].forEach(a => { const toe = add(g, S(0.06, 10, 8), toon('#ffb84a'), Math.sin(a) * 0.08, -0.07, Math.cos(a) * 0.08, '#a8742e', 0.01); toe.scale.set(0.7, 0.45, 1.6); toe.rotation.y = a; }); }
    };
    const feet = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * footX, 0.1, 0.38); legRig.add(g); makeLeg(g, true); return g; });
    const backLegs = Lo.legs === 'thu4' ? [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * footX, 0.1, B.z - B.sz * 0.55); root.add(g); makeLeg(g, false); return g; }) : [];

    /* đuôi */
    const tail = new THREE.Group(); root.add(tail);
    const last = Lo.segs[Lo.segs.length - 1];
    if (last) tail.position.set(0, last.y, last.z - last.r * 0.8);
    else if (Lo.kind === 'thu4') tail.position.set(0, B.y + 0.15 * B.sy, B.z - 0.95 * B.sz);
    else tail.position.set(0, B.y - 0.5 * B.sy, B.z - 0.98 * B.sz);
    const tailScale = [0.7, 0.85, 0.95, 1, 1][lvl] * (form === 'nhanh' ? 1.4 : form === 'tron' ? 0.85 : 1) * (sep ? 0.9 : 1);
    const tg = new THREE.Group(); tg.scale.setScalar(tailScale); tail.add(tg);
    if (Lo.kind === 'thu4') tg.rotation.x = -0.5;
    const tt = lvl === 0 ? (sp.tail === 'none' ? 'none' : 'tron') : sp.tail === 'none' && Lo.kind === 'chim' ? 'ca' : sp.tail;
    if (tt === 'tron') add(tg, S(0.22, 18, 14), deepMat, 0, 0, 0, INK);
    if (tt === 'xu') { const m = add(tg, S(0.32, 20, 14), deepMat, 0, 0.18, -0.14, INK); m.scale.set(0.8, 1.3, 0.8); m.rotation.x = -0.6; add(tg, S(0.16, 14, 10), toon(lighten(pal.body, 0.6)), 0, 0.5, -0.36, INK, 0.02); }
    if (tt === 'xoan') { const m = add(tg, new THREE.TorusGeometry(0.17, 0.07, 10, 24, Math.PI * 1.6), deepMat, 0, 0.12, -0.08, INK, 0.02); m.rotation.y = Math.PI / 2; }
    if (tt === 'ca') [-1, 1].forEach(s => { const f = add(tg, S(0.22, 16, 12), accMat, s * 0.14, 0.1, -0.12, INK, 0.02); f.scale.set(0.45, 1.2, 0.25); f.rotation.z = -s * 0.7; });
    if (tt === 'la') { const f = add(tg, S(0.24, 16, 12), toon(sp.pal.deep), 0, 0.12, -0.12, INK, 0.02); f.scale.set(0.6, 1.4, 0.18); f.rotation.x = -0.7; }
    if (tt === 'sao') { add(tg, Cy(0.025, 0.025, 0.4, 6), toon(pal.ink), 0, 0.15, -0.1, null).rotation.x = -0.5; add(tg, starGeo(0.15), glow(pal.accent, 0.5), 0, 0.34, -0.22, INK, 0.012); }
    if (tt === 'may') [[0, 0.06, 0, 0.2], [0, 0.22, -0.16, 0.15]].forEach(([x, y, z, r]) => add(tg, S(r), toon(sp.id === 'keo-bong-gon' ? pal.accent : '#ffffff'), x, y, z, '#a8a0c8', 0.02));

    /* phụ kiện của loài: má phúng phính và ria có từ Nhí, các thứ khác từ Thiếu niên (cánh chim có từ Nhí), hào quang chỉ khi trưởng thành */
    const anim = { wings: [], halo: null, orbit: [], tent: [], spin: [], backLegs, feet, segs: [] };
    const extras = new Set(sp.extra);
    if (form === 'tron') extras.add('bom');
    if (Lo.kind === 'chim') extras.add('canh');
    const exScale = lvl >= 3 ? 1 : 0.75;
    for (const ex of extras) {
      if (ex === 'bom' && lvl >= 1) [-1, 1].forEach(s => { const m = add(root, S(0.26 * kH, 18, 14), bodyMat, s * 0.74 * H.sx, H.y - 0.22 * H.sy, H.z + 0.5 * H.sz, INK, 0.025); m.scale.set(0.8, 0.75, 0.7); });
      if (ex === 'ria' && lvl >= 1) [-1, 1].forEach(s => [-0.06, 0.04].forEach(dy => { const w = add(root, Cy(0.012, 0.012, 0.42 * kH, 5), toon(INK), s * 0.92 * H.sx, H.y - 0.06 * H.sy + dy * kH, H.z + 0.48 * H.sz, null); w.rotation.z = Math.PI / 2 + s * dy * 3; w.rotation.y = s * 0.5; }));
      if (ex === 'canh' && (lvl >= 2 || (Lo.kind === 'chim' && lvl >= 1))) [-1, 1].forEach(s => {
        const w = new THREE.Group(); w.userData.s = s; root.add(w);
        const bat = sp.id === 'doi-nho', bug = sp.id === 'chuon-chuon' || sp.id === 'ong-mat' || sp.id === 'dom-dom';
        const mat = bug ? new THREE.MeshToonMaterial({ color: '#e8f6ff', gradientMap: K.grad, transparent: true, opacity: 0.75 }) : toon(bat ? pal.deep : Lo.kind === 'chim' ? pal.deep : lvl >= 3 ? '#ffffff' : lighten(pal.body, 0.5));
        if (Lo.kind === 'chim') {
          w.position.set(s * B.sx * 0.9, B.y + 0.08 * B.sy, B.z); w.userData.side = true;
          const m = add(w, S(0.34, 18, 12), mat, s * 0.06, -0.05, -0.05, INK, 0.02); m.scale.set(0.35, 1.05 * exScale, 0.85 * exScale); m.rotation.z = s * 0.2;
          const tip = add(w, S(0.16, 12, 10), toon(pal.accent), s * 0.1, -0.32 * exScale, -0.2, INK, 0.015); tip.scale.set(0.4, 1.1, 0.8);
        } else {
          w.position.set(s * 0.5 * B.sx, B.y + 0.15 * B.sy, B.z - 0.72 * B.sz);
          const n = bug ? 2 : 1, ws = sep ? 1.25 : 1;
          for (let k = 0; k < n; k++) { const m = add(w, S(0.3, 18, 12), mat, s * 0.32 * ws, 0.12 - k * 0.22, 0, bug ? '#9ab8d8' : INK, 0.02); m.scale.set(1.35 * exScale * ws, (bug ? 0.45 : 0.8) * exScale * ws, 0.18); m.rotation.z = s * (0.5 - k * 0.6); }
        }
        anim.wings.push(w);
      });
      if (lvl < 2) continue;
      if (ex === 'vay') { const f = add(root, Cone(0.28 * exScale, 0.6 * exScale, 3), accMat, 0, B.y + 0.6 * B.sy, B.z - 0.55 * B.sz, INK, 0.02); f.scale.z = 0.35; f.rotation.x = -0.5; Lo.segs.forEach((g, i) => { if (i < 2) { const f2 = add(root, Cone(0.18 * exScale, 0.4 * exScale, 3), accMat, 0, g.y + g.r * 0.9, g.z, INK, 0.015); f2.scale.z = 0.35; f2.rotation.x = -0.5; } }); }
      if (ex === 'mai') {
        const m = add(root, new THREE.SphereGeometry(0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), toon(pal.accent), 0, 0, 0, INK, 0.03);
        if (Lo.kind === 'thu4') { m.position.set(0, B.y + 0.05, B.z); m.scale.set(B.sx * 1.25 * exScale, 0.75 * exScale, B.sz * 1.15 * exScale); }
        else { m.position.set(0, B.y - 0.1, B.z - 0.42 * B.sz); m.rotation.x = -Math.PI / 2 + 0.25; m.scale.set(exScale * kB, exScale * kB, 0.75 * exScale); }
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const d = add(m, new THREE.CircleGeometry(0.16, 6), toon(lighten(pal.accent, 0.35)), Math.cos(a) * 0.45, 0.8, Math.sin(a) * 0.45, null); d.lookAt(Math.cos(a) * 1.4, 2.4, Math.sin(a) * 1.4); if (Lo.kind !== 'thu4') { d.position.set(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.8); d.lookAt(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 2.4); } }
      }
      if (ex === 'oc') { const g = new THREE.Group(); g.position.set(0, B.y + 0.15, B.z - 0.78 * B.sz); g.scale.setScalar(exScale * Math.max(kB, 0.8)); root.add(g); add(g, S(0.5, 24, 18), toon(pal.accent), 0, 0, -0.1, INK, 0.03); [0.36, 0.24, 0.12].forEach((r, i) => add(g, new THREE.TorusGeometry(r, 0.05, 8, 24), toon(lighten(pal.accent, 0.3)), 0, 0, 0.32 + i * 0.06, null)); }
      if (ex === 'gai') [0.6, 0.95, 1.3, 1.65].forEach(th => { const c = add(root, Cone(0.11 * exScale, 0.26 * exScale, 10), toon(pal.deep), 0, 0, 0, INK, 0.015); c.position.copy(onBody(B, Lo.kind === 'thu4' ? th * 0.6 : th, Math.PI, -0.02)); c.position.z += B.z; outward(c, B); c.rotateX(Math.PI / 2); });
      if (ex === 'coan') { const cy = sep ? H.y - H.sy * 0.8 : B.y - 0.62 * B.sy, cz = sep ? H.z * 0.7 + B.z * 0.3 : 0, rx = sep ? H.sx * 0.78 : 0.82 * B.sx, rz = sep ? H.sz * 0.72 : 0.78 * B.sz; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const p = add(root, S(0.2 * Math.max(kH, 0.8), 12, 10), toon(pal.accent), Math.sin(a) * rx, cy, cz + Math.cos(a) * rz, INK, 0.015); p.scale.set(1.1 * exScale, 0.35, 0.7 * exScale); p.rotation.y = a; } }
      if (ex === 'tua') for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; const t = add(root, Cy(0.05, 0.03, 0.42 * exScale, 8), toon(pal.deep), Math.sin(a) * 0.6 * B.sx, 0.22, B.z + Math.cos(a) * 0.55 * B.sz - 0.1, INK, 0.012); t.userData.ph = i; anim.tent.push(t); }
      if (ex === 'hao' && lvl >= 3) { const h = add(root, new THREE.TorusGeometry(0.42 * Math.max(kH, 0.8), 0.045, 10, 40), glow('#ffe58a', 0.7), 0, headTop + 0.42, H.z - 0.1, '#b88a2a', 0.012); h.rotation.x = Math.PI / 2 - 0.25; h.userData.y = headTop + 0.42; anim.halo = h; }
    }

    /* nét riêng khi trưởng thành theo dáng cơ thể */
    const neckExtra = [];
    if (lvl >= 3) {
      if (Lo.kind === 'thu4' && neckM) {
        // bờm lông xù quanh cổ
        const c = neckM.position, r = 0.36 * kH * 1.06;
        for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; const f = add(root, S(0.17 * kH, 14, 10), toon(lighten(pal.body, 0.45)), Math.sin(a) * r * 1.05, c.y - 0.05 + Math.cos(a) * 0.04, c.z + Math.cos(a) * r * 0.95 - 0.04, INK, 0.015); f.scale.set(1, 1.25, 0.8); neckExtra.push(f); }
      }
      if (Lo.kind === 'chim') {
        // lông đuôi dài
        [-0.35, 0, 0.35].forEach((a, i) => { const f = add(root, S(0.14, 14, 10), i === 1 ? accMat : deepMat, Math.sin(a) * 0.18, B.y - 0.25 * B.sy, B.z - B.sz * 0.95 - 0.18, INK, 0.015); f.scale.set(0.55, 0.5, 2.1); f.rotation.set(0.5, a * 0.9, 0); });
      }
      if (Lo.kind === 'ran') {
        // vây lưng trên từng khúc và ria
        Lo.segs.forEach((g, i) => { if (i < 3) { const f2 = add(root, Cone(0.15, 0.34, 3), accMat, 0, g.y + g.r * 0.85, g.z, INK, 0.015); f2.scale.z = 0.35; f2.rotation.x = -0.5; } });
        if (!sp.extra.includes('ria')) [-1, 1].forEach(s => { const w = add(root, Cy(0.014, 0.008, 0.5 * kH, 5), toon(pal.accent), s * 0.85 * H.sx, H.y - 0.25 * H.sy, H.z + 0.6 * H.sz, null); w.rotation.z = Math.PI / 2 - s * 0.35; w.rotation.y = s * 0.6; });
      }
    }

    /* dáng trưởng thành: mỗi dáng có dấu hiệu riêng để nhìn là biết */
    if (form === 'nhanh') [-1, 1].forEach(s => [0, 1].forEach(k => { const m = add(root, S(0.2 * Math.max(kB, 0.7), 12, 8), toon(pal.accent), 0, 0, 0, null); m.position.copy(onBody(B, 1.45 + k * 0.28, s * (1.7 - k * 0.15), -0.03)); m.position.z += B.z; m.scale.set(1.3, 0.16, 0.3); outward(m, B); m.rotateZ(s * 0.5); }));
    if (form === 'tron') { const m = add(root, S(0.55 * Math.max(kB, 0.7), 24, 16), toon(lighten(pal.body, 0.6)), 0, 0, 0, null); m.position.copy(onBody(B, Lo.kind === 'thu4' ? 1.75 : 2.15, 0, -0.1 * kB)); m.position.z += B.z; m.scale.set(1.2, 1, 0.45); outward(m, B); }
    if (form === 'sang') [[1.0, 1.2], [1.3, -1.3], [0.8, 2.6], [1.5, -2.4]].forEach(([th, ph]) => { const st = add(root, starGeo(0.09 * Math.max(kB, 0.75), 0.03), glow('#fff2a8', 0.6), 0, 0, 0, '#b88a2a', 0.008); st.position.copy(onBody(B, th, ph, 0.01)); st.position.z += B.z; outward(st, B); });
    if (form === 'thuong') { const ht = add(tail, heartGeo(0.12), toon('#ff7aa8'), 0, 0.25, -0.25, '#a83a62', 0.012); ht.rotation.y = Math.PI / 2; }
    if (form === 'thuong') { const h = add(root, heartGeo(0.16 * Math.max(kB, 0.75)), toon('#ff7aa8'), 0, 0, 0, '#a83a62', 0.015); h.position.copy(onBody(B, Lo.kind === 'thu4' ? 1.5 : sep ? 1.85 : 2.12, 0, 0.0)); h.position.z += B.z; h.rotation.x = Lo.kind === 'thu4' ? 0 : -0.35; }
    if (form === 'sang') for (let i = 0; i < 3; i++) { const st = add(root, starGeo(0.1, 0.04), glow('#fff2a8', 0.8), 0, 0, 0, '#b88a2a', 0.01); st.userData.ph = i * Math.PI * 2 / 3; anim.orbit.push(st); }
    topG.traverse(o => { if (o.userData.spin) anim.spin.push(o); });
    anim.root = root; anim.hover = Lo.hover; anim.legRigZ = legRig.position.z;

    if (look.face) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(1.006, 48, 30, Math.PI / 2 - 0.75, 1.5, Math.PI / 2 - 0.78, 1.24),
        new THREE.MeshBasicMaterial({ map: simpleFace(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      head.add(f);
    }
    const hv = Lo.hover;
    const sockets = measureSockets(root, { H, B, Lo, kH, kB, head, neckM, neckExtra, ears, topG, tail, armRig, legRig, backLegs, anim, sp, lvl });
    into.add(root);
    return { body: head, ears, top: topG, tail, arms, feet, anim, sockets, flicker: !!topG.children[0]?.userData?.flicker, headY: headTop + hv,
      mouth: [0, H.y - 0.35 * H.sy + hv, H.z + 0.95 * H.sz], center: [0, (H.y + B.y) / 2 + hv, (H.z + B.z) / 2], plan: Lo.kind, stage, species: sp };
  }

  /**
   * Đo "ổ cắm" cho đồ mặc trên chính mô hình vừa dựng (bắn tia vào bề mặt), để đồ mặc ôm sát mọi dáng:
   * crown (đỉnh đầu), face (mặt phẳng mắt), neck (vòng cổ: tâm + bán kính x/z), back (mặt lưng + pháp tuyến),
   * keepOut (tai, sừng, chỏm, hào quang — đồ đội đầu không được đè lên).
   */
  const ray = new THREE.Raycaster();
  function measureSockets(root, m) {
    const { H, B, Lo, kH, kB, head, neckM, neckExtra, ears, topG, tail, armRig, legRig, backLegs, anim, sp } = m;
    const hv = Lo.hover;
    root.updateMatrixWorld(true);
    const skip = new Set();
    const mark = o => o && o.traverse(x => skip.add(x));
    ears.forEach(mark); mark(topG); mark(tail); mark(armRig); mark(legRig); backLegs.forEach(mark); anim.wings.forEach(mark); anim.orbit.forEach(mark); mark(anim.halo);
    const solid = []; root.traverse(o => { if (o.isMesh && !o.userData.outline && !skip.has(o) && !o.material.transparent) solid.push(o); });
    const first = (o, d, list = solid) => { ray.set(o, d.normalize()); ray.far = 20; const h = ray.intersectObjects(list, false)[0]; return h ? h.point : null; };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    /* mặt: tia từ phía trước ở độ cao mắt (mắt vẽ ở 0.2·ry trên tâm đầu) */
    const eyeY = H.y + hv + 0.2 * H.sy;
    const fh = first(V(0, eyeY, 6), V(0, 0, -1), [head]);
    const face = { p: [0, eyeY, (fh ? fh.z : H.z + H.sz)], k: kH };

    /* cổ: đo tiết diện ngang theo 12 hướng */
    let ny, nz;
    if (Lo.kind === 'banh') { ny = H.y - 0.4 * H.sy + hv; nz = H.z; }
    else if (Lo.kind === 'thu4') { ny = (H.y + B.y) / 2 + 0.05 + hv; nz = (H.z + B.z) / 2 + 0.12; }
    else if (Lo.kind === 'ran') { ny = H.y - 0.72 * H.sy + hv; nz = H.z - 0.12; }
    else { ny = H.y - 0.84 * H.sy + hv; nz = H.z * 0.6 + B.z * 0.4; }
    // thú bốn chân / bay lượn: chỉ đo đầu + khúc cổ (không đo thân dài), vòng cổ nghiêng theo trục cổ
    const neckList = Lo.kind === 'thu4' ? [head, neckM, ...neckExtra] : Lo.kind === 'ran' ? [head] : solid;
    let tilt = 0;
    if (Lo.kind === 'thu4') tilt = Math.atan2(H.z - (B.z + 0.45 * B.sz), H.y - B.y) * 0.8;
    let rx = 0.2, rz = 0.2;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, d = V(Math.sin(a), 0, Math.cos(a));
      const h = first(V(0, ny, nz).addScaledVector(d, 5), d.clone().negate(), neckList);
      if (h) { rx = Math.max(rx, Math.abs(h.x)); rz = Math.max(rz, Math.abs(h.z - nz)); }
    }
    if (tilt) rz = Math.max(rx * 0.9, rz * Math.cos(tilt));
    const neck = { p: [0, ny, nz], rx, rz, tilt };

    /* lưng: thú bốn chân thì đeo trên sống lưng (pháp tuyến hướng lên), còn lại sau lưng (hướng -z) */
    let back;
    if (Lo.kind === 'thu4') { const h = first(V(0, 6, B.z - 0.1 * B.sz), V(0, -1, 0)); back = { p: [0, h ? h.y : B.y + B.sy + hv, B.z - 0.1 * B.sz], n: [0, 1, 0], k: Math.min(1, Math.max(kB * 1.1, 0.65)) }; }
    else { const by = B.y + hv + 0.05 * B.sy, h = first(V(0, by, -6), V(0, 0, 1)); back = { p: [0, by, h ? h.z : B.z - B.sz], n: [0, 0, -1], k: Math.min(1, Math.max(kB, 0.65)) }; }

    /* vùng cấm cho đồ đội đầu: mỗi lưới của tai/chỏm/hào quang thành một khối cầu bao */
    const keepOut = [];
    const addKO = (o, kind) => o && o.traverse(x => { if (!x.isMesh || x.userData.outline) return; x.geometry.computeBoundingSphere(); const s0 = x.geometry.boundingSphere; const c = s0.center.clone().applyMatrix4(x.matrixWorld); const sc = new THREE.Vector3().setFromMatrixScale(x.matrixWorld); keepOut.push({ kind, c: [c.x, c.y, c.z], r: s0.radius * Math.max(sc.x, sc.y, sc.z) * 0.85 }); });
    ears.forEach(e => addKO(e, 'ear')); if (m.lvl > 0) addKO(topG, 'top'); addKO(anim.halo, 'halo');
    /* chân tai (cho viền lỗ tai khi đội mũ len) */
    const earInfo = ears.filter(e => e.children[0]?.children.length && sp.ears !== 'vay' && sp.ears !== 'cup').map(e => ({ p: [e.position.x, e.position.y, e.position.z], rz: e.rotation.z, r: 0.17 * e.children[0].scale.x / 0.9 + 0.02 }));
    return {
      ears: earInfo, plan: Lo.kind, crown: { p: [0, H.y + H.sy + hv, H.z], k: kH, r: [H.sx, H.sy, H.sz], c: [0, H.y + hv, H.z] }, face, neck, back, keepOut,
      head: { c: [0, H.y + hv, H.z], r: [H.sx, H.sy, H.sz] }, body: { c: [0, B.y + hv, B.z], r: [B.sx, B.sy, B.sz] },
      bodyBottom: Lo.kind === 'banh' ? 0.12 : B.y + hv - B.sy, ownWings: anim.wings.length > 0, shell: sp.extra.includes('mai') || sp.extra.includes('oc'),
    };
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
    a.wings.forEach(w => { if (w.userData.side) w.rotation.z = w.userData.s * (0.1 + Math.max(0, Math.sin(t * 3.2)) * 0.25); else w.rotation.y = w.userData.s * (0.25 + Math.sin(t * 9) * 0.25); });
    if (a.halo) { a.halo.rotation.z = t * 0.8; a.halo.position.y = a.halo.userData.y + Math.sin(t * 2) * 0.04; }
    const cx = parts.center;
    a.orbit.forEach(s => { const p = t * 1.2 + s.userData.ph; s.position.set(Math.cos(p) * 1.35, cx[1] + Math.sin(p * 2) * 0.35 - a.hover, cx[2] + Math.sin(p) * 1.0); s.rotation.y = t * 2; });
    if (a.hover) a.root.position.y = a.hover + Math.sin(t * 2.1) * 0.07;
    a.backLegs.forEach((g, i) => { const f = a.feet[1 - i]; if (g.userData.z0 === undefined) g.userData.z0 = g.position.z; g.position.y = f.position.y; g.position.z = g.userData.z0 + (f.position.z - 0.38); });
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
