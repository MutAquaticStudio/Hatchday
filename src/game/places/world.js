// Bộ dựng thế giới rộng cho các nơi chung (Quảng trường, Công viên, Tiệm trà):
//  - zones: chia nơi thành các khu; khu lõi dựng ngay khi vào, các khu khác dựng dần (mỗi khung hình tối đa ~4 ms) khi bé tới gần,
//    khu quá xa thì ẩn (không vẽ). Nhờ vậy vào nơi rộng vẫn nhanh và thiết bị yếu không phải dựng/vẽ cả bản đồ.
//  - scatter: vật lặp (cây, hoa, cỏ, hàng rào, đèn) dựng bằng InstancedMesh (một lần vẽ cho cả loạt) kèm viền;
//  - cache hình/vật liệu dùng chung; chất lượng Thấp giảm bớt số vật trang trí (density).
// Mỗi nơi gọi makeWorld(c), khai báo zones rồi gọi world.update(dt, petX, petZ) mỗi khung hình.
import { gradeInk, gradeTex } from '../grade.js';
const BUDGET_MS = 4;

export function makeWorld(c, group) {
  const { THREE, toon } = c;
  const gCache = new Map(), mCache = new Map(), zones = [], queue = [];
  const geo = (k, f) => { let g = gCache.get(k); if (!g) { g = f(); gCache.set(k, g); } return g; };
  const mat = (k, f) => { let m = mCache.get(k); if (!m) { m = f(); mCache.set(k, m); } return m; };
  const toonC = (col, map) => mat('t:' + col + (map ? map.uuid : ''), () => toon(col, map));
  const outMat = col => mat('o:' + col, () => new THREE.MeshBasicMaterial({ color: gradeInk(col), side: THREE.BackSide }));
  /** 0.5 ở chất lượng Thấp, 1 còn lại: nhân số lượng vật trang trí phụ. */
  const density = () => (c.quality && c.quality() === 'thap' ? 0.5 : 1);
  const dummy = new THREE.Object3D(), color = new THREE.Color();

  /** Vật lặp bằng InstancedMesh. items: [{ x, y, z, s | sx, sy, sz, ry, color }]. outline: màu viền (null = không viền). Trả về mesh. */
  function scatter(parent, geometry, material, items, outline = '#6a4a5a', thick = 0.04) {
    if (!items.length) return null;
    const n = items.length, m = new THREE.InstancedMesh(geometry, material, n), o = outline ? new THREE.InstancedMesh(geometry, outMat(outline), n) : null;
    geometry.computeBoundingSphere(); const r = Math.max(geometry.boundingSphere.radius, 0.05);
    items.forEach((it, i) => {
      const sx = it.sx ?? it.s ?? 1, sy = it.sy ?? it.s ?? 1, sz = it.sz ?? it.s ?? 1;
      dummy.position.set(it.x, it.y ?? 0, it.z); dummy.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
      if (o) { const k = 1 + thick / (r * Math.max(sx, sy, sz)); dummy.scale.set(sx * k, sy * k, sz * k); dummy.updateMatrix(); o.setMatrixAt(i, dummy.matrix); }
      if (it.color) m.setColorAt(i, color.set(gradeTex(it.color)));
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = false; m.receiveShadow = true; m.userData.instanced = true; parent.add(m);
    if (o) { o.instanceMatrix.needsUpdate = true; o.userData.outline = true; parent.add(o); }
    return m;
  }

  /** Khai báo một khu. build(g): dựng ngay (khu lõi) hoặc trả về mảng việc nhỏ (hàm) để dựng dần. */
  function zone(def) {
    const z = { id: def.id, cx: def.cx, cz: def.cz, show: def.show ?? 16, g: new THREE.Group(), state: def.core ? 'building' : 'idle', def, tasks: null };
    z.g.visible = !!def.core; group.add(z.g); zones.push(z);
    if (def.core) { const t = def.build(z.g); if (Array.isArray(t)) t.forEach(f => f()); z.state = 'ready'; c.applyShadows?.(z.g); }
    return z;
  }
  const near = (z, x, zz) => Math.hypot(z.cx - x, z.cz - zz) < z.show;

  /** Gọi mỗi khung hình với vị trí thú (toạ độ thế giới). */
  function update(petX, petZ) {
    for (const z of zones) {
      if (z.state === 'idle' && near(z, petX, petZ)) { const t = z.def.build(z.g); z.tasks = Array.isArray(t) ? t : []; z.state = 'building'; queue.push(z); }
      z.g.visible = (z.state !== 'idle') && near(z, petX, petZ) || z.def.core === true;
    }
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < BUDGET_MS) {
      const z = queue[0], f = z.tasks.shift();
      if (f) f(); else { queue.shift(); z.state = 'ready'; c.applyShadows?.(z.g); }
    }
  }
  /** Dựng xong mọi khu ngay (kiểm thử). */
  function finishAll() { for (const z of zones) { if (z.state === 'idle') { const t = z.def.build(z.g); z.tasks = Array.isArray(t) ? t : []; z.state = 'building'; if (!queue.includes(z)) queue.push(z); } } while (queue.length) { const z = queue[0], f = z.tasks.shift(); if (f) f(); else { queue.shift(); z.state = 'ready'; c.applyShadows?.(z.g); } } zones.forEach(z => { z.g.visible = true; }); }
  const status = () => zones.map(z => ({ id: z.id, state: z.state, visible: z.g.visible }));
  /** Giải phóng mọi hình, vật liệu và InstancedMesh của nơi này (gọi khi rời nếu máy yếu). */
  function dispose() { gCache.forEach(g => g.dispose()); mCache.forEach(m => m.dispose()); gCache.clear(); mCache.clear(); }
  return { geo, mat, toonC, scatter, zone, update, finishAll, status, density, dispose, THREE };
}

/** Đom đóm ban đêm: các chấm sáng bay lượn trong hình chữ nhật (x0,x1,z0,z1); ban ngày ẩn. Trả về hàm update(t, night). */
export function makeFireflies(THREE, parent, box, n = 14) {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: '#7ff5d6', transparent: true, opacity: 0.9 }), n), d = new THREE.Object3D(), ph = Array.from({ length: n }, (_, i) => ({ a: i * 1.7, x: box.x0 + ((i * 37) % 100) / 100 * (box.x1 - box.x0), z: box.z0 + ((i * 59) % 100) / 100 * (box.z1 - box.z0) }));
  m.visible = false; m.frustumCulled = false; parent.add(m);
  return (t, night) => {
    m.visible = night; if (!night) return;
    ph.forEach((p, i) => { d.position.set(p.x + Math.sin(t * 0.5 + p.a) * 1.4, 0.7 + Math.sin(t * 0.9 + p.a * 2) * 0.35, p.z + Math.cos(t * 0.4 + p.a) * 1.1); d.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(t * 2 + p.a))); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.instanceMatrix.needsUpdate = true;
  };
}

/** Bộ vật trang trí dùng chung (nhận { THREE, add, toon, canvasTex, kit, world }). Mỗi hàm thêm vào `g` và trả về nhóm. */
export function makeProps({ THREE, add, toon, canvasTex, kit, world, glowMat }) {
  const rnd = (seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
  const trees = (g, items, palette = ['#7edb72', '#6fcf6a', '#8be07a']) => {
    const trunk = world.geo('trunk', () => new THREE.CylinderGeometry(0.16, 0.24, 1.2, 8)), ball = world.geo('ball', () => new THREE.SphereGeometry(1, 12, 10));
    world.scatter(g, trunk, world.toonC('#b98a5e'), items.map(t => ({ x: t.x, y: 0.6 * (t.s || 1), z: t.z, s: t.s || 1 })), '#6a4a3a', 0.03);
    const leaves = []; items.forEach((t, i) => { const s = t.s || 1; [[0, 1.7, 0, 0.95], [-0.5, 1.35, 0.15, 0.7], [0.5, 1.45, -0.1, 0.75]].forEach(([dx, dy, dz, r], k) => leaves.push({ x: t.x + dx * s, y: dy * s, z: t.z + dz * s, s: r * s, color: palette[(i + k) % palette.length] })); });
    world.scatter(g, ball, world.toonC('#ffffff'), leaves, '#3f8a55', 0.04);
  };
  const flowers = (g, pts, cols = ['#ff9ec4', '#ffd36e', '#c9a6ff', '#ff8f6a', '#ffffff']) => {
    const bud = world.geo('bud', () => new THREE.SphereGeometry(0.1, 8, 6)), stem = world.geo('stem', () => new THREE.CylinderGeometry(0.015, 0.015, 0.22, 4));
    world.scatter(g, stem, world.toonC('#5faa5a'), pts.map(p => ({ x: p.x, y: 0.11, z: p.z })), null);
    world.scatter(g, bud, world.toonC('#ffffff'), pts.map((p, i) => ({ x: p.x, y: 0.26, z: p.z, s: 0.9 + (i % 3) * 0.2, color: cols[i % cols.length] })), null);
  };
  const tufts = (g, pts) => { const t = world.geo('tuft', () => new THREE.ConeGeometry(0.07, 0.3, 4)); world.scatter(g, t, world.toonC('#8fd078'), pts.map((p, i) => ({ x: p.x, y: 0.14, z: p.z, s: 0.8 + (i % 4) * 0.15, ry: i })), null); };
  /** Hàng rào gỗ hoặc bụi rào theo đoạn thẳng (x0,z0)→(x1,z1). */
  const fence = (g, x0, z0, x1, z1, step = 0.7, hedge = false) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step)), ry = Math.atan2(x1 - x0, z1 - z0), items = [];
    for (let i = 0; i <= n; i++) items.push({ x: x0 + (x1 - x0) * i / n, y: hedge ? 0.35 : 0.4, z: z0 + (z1 - z0) * i / n, ry });
    if (hedge) world.scatter(g, world.geo('hedge', () => new THREE.SphereGeometry(0.5, 10, 8)), world.toonC('#5fbf6a'), items.map((it, i) => ({ ...it, sy: 0.9, sx: 1, sz: 1, color: i % 2 ? '#5fbf6a' : '#6fcf75' })), '#3f8a55', 0.04);
    else { world.scatter(g, world.geo('post', () => new THREE.BoxGeometry(0.12, 0.8, 0.1)), world.toonC('#d9b27a'), items, '#8a5f3a', 0.02); add(g, new THREE.BoxGeometry(Math.hypot(x1 - x0, z1 - z0), 0.08, 0.06), toon('#c29a62'), (x0 + x1) / 2, 0.6, (z0 + z1) / 2, '#8a5f3a', 0.015).rotation.y = ry - Math.PI / 2; }
  };
  const lamps = [];
  /** Đèn đường: cột + bóng phát sáng ban đêm (cập nhật qua props.night(on)). */
  const lamp = (g, x, z, s = 1) => {
    const l = new THREE.Group(); l.position.set(x, 0, z); l.scale.setScalar(s); g.add(l);
    // đèn đường kiểu cổ: chân loe, vòng giữa, cột mảnh, lồng đèn bốn cạnh có mái
    add(l, new THREE.CylinderGeometry(0.16, 0.22, 0.28, 10), toon('#6a5a7a'), 0, 0.14, 0, '#3a3044', 0.02);
    add(l, new THREE.CylinderGeometry(0.06, 0.09, 2.3, 8), toon('#7a6a8a'), 0, 1.4, 0, '#443', 0.02);
    add(l, new THREE.TorusGeometry(0.1, 0.03, 6, 14), toon('#ffd36e'), 0, 1.1, 0, null).rotation.x = Math.PI / 2;
    add(l, new THREE.CylinderGeometry(0.17, 0.08, 0.1, 4), toon('#6a5a7a'), 0, 2.46, 0, '#3a3044', 0.015).rotation.y = Math.PI / 4;
    const bulb = add(l, new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffcf7a' }), 0, 2.66, 0, null); bulb.userData.lamp = true; lamps.push(bulb);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => add(l, new THREE.BoxGeometry(0.025, 0.36, 0.025), toon('#5a4a6a'), sx * 0.15, 2.66, sz * 0.15, null));
    add(l, new THREE.ConeGeometry(0.28, 0.22, 4), toon('#6a5a7a'), 0, 2.95, 0, '#3a3044', 0.015).rotation.y = Math.PI / 4;
    add(l, new THREE.SphereGeometry(0.045, 8, 6), toon('#ffd36e'), 0, 3.08, 0, null);
    return l;
  };
  const night = on => lamps.forEach(b => b.material.color.set(on ? '#ffe28a' : '#fff3c4'));
  /** Mặt tiền toà nhà: thân có chân tường và cột góc, mái dốc lợp ngói, cửa sổ có khung, chấn song, hộp hoa; cửa vào có tay nắm, bậc, mái hiên sọc (hotspot đi tới `to`), biển tên. */
  const shingleCache = {};
  const shingles = col => shingleCache[col] || (shingleCache[col] = canvasTex(128, 128, d => {
    const c = new THREE.Color(col); d.fillStyle = c.getStyle(); d.fillRect(0, 0, 128, 128);
    d.strokeStyle = c.clone().offsetHSL(0, 0, -0.14).getStyle(); d.lineWidth = 4;
    for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) { d.beginPath(); d.arc(i * 32 + (r % 2) * 16, r * 32 + 32, 16, Math.PI, 0); d.stroke(); }
  }, [3, 1]));
  const awningTex = col => canvasTex(64, 32, d => { d.fillStyle = '#ffffff'; d.fillRect(0, 0, 64, 32); d.fillStyle = col; for (let i = 0; i < 4; i++) d.fillRect(i * 16, 0, 8, 32); }, [2, 1]);
  const facade = (g, { x, z, w = 4, h = 3, wall = '#ffe9c4', roof = '#d9644a', label, to, sign = '#fff7ef', fg = '#5a3a4a', ry = 0 }) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    const dark = new THREE.Color(wall).offsetHSL(0, 0.04, -0.12).getStyle(), trim = '#fff8ef';
    add(b, new THREE.BoxGeometry(w, h, 1.6), toon(wall), 0, h / 2, 0, '#8a6a7a', 0.04);
    add(b, new THREE.BoxGeometry(w + 0.08, 0.3, 1.66), toon(dark), 0, 0.15, 0, '#6a5a6a', 0.015); // chân tường
    [-1, 1].forEach(sx => add(b, new THREE.BoxGeometry(0.18, h, 0.12), toon(trim), sx * (w / 2 - 0.05), h / 2, 0.8, '#8a7a7a', 0.012)); // cột góc
    add(b, new THREE.BoxGeometry(w + 0.12, 0.16, 0.2), toon(trim), 0, h - 0.04, 0.8, '#8a7a7a', 0.012); // gờ dưới mái
    // mái dốc hai mái lợp ngói vảy cá + hồi tam giác + ống khói
    const rise = 0.95, half = 1.08, L = Math.hypot(half, rise), th = Math.atan2(rise, half), rm = toon('#ffffff', shingles(roof));
    [-1, 1].forEach(sd => { const sl = add(b, new THREE.BoxGeometry(w + 0.5, 0.14, L), rm, 0, h + rise / 2, sd * half / 2, '#7a3a2a', 0.02); sl.rotation.x = sd * th; });
    const tri = new THREE.Shape(); tri.moveTo(-half + 0.08, 0); tri.lineTo(half - 0.08, 0); tri.lineTo(0, rise - 0.06); tri.lineTo(-half + 0.08, 0);
    const gableGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: false });
    [-1, 1].forEach(sx => { const gb = add(b, gableGeo, toon(wall), sx * (w / 2 - 0.02), h, 0, '#8a6a7a', 0.012); gb.rotation.y = Math.PI / 2; gb.position.x -= sx > 0 ? 0.08 : 0; });
    add(b, new THREE.BoxGeometry(w + 0.6, 0.1, 0.12), toon(new THREE.Color(roof).offsetHSL(0, 0, -0.15).getStyle()), 0, h + rise + 0.02, 0, null); // nóc
    add(b, new THREE.BoxGeometry(0.34, 0.7, 0.34), toon('#c98a6a'), w * 0.28, h + rise * 0.8, -0.35, '#6a3a2a', 0.015); add(b, new THREE.BoxGeometry(0.42, 0.08, 0.42), toon('#8a5a4a'), w * 0.28, h + rise * 0.8 + 0.38, -0.35, null);
    // cửa sổ: khung trắng, chấn song chữ thập, rèm, hộp hoa
    [-w * 0.3, w * 0.3].forEach(wx => {
      const wy = h * 0.6;
      add(b, new THREE.BoxGeometry(0.98, 0.98, 0.08), toon(trim), wx, wy, 0.8, '#8a7a7a', 0.012);
      add(b, new THREE.BoxGeometry(0.8, 0.8, 0.08), toon('#cfeaff'), wx, wy, 0.83, null);
      add(b, new THREE.BoxGeometry(0.8, 0.05, 0.04), toon(trim), wx, wy, 0.88, null); add(b, new THREE.BoxGeometry(0.05, 0.8, 0.04), toon(trim), wx, wy, 0.88, null);
      add(b, new THREE.BoxGeometry(0.3, 0.68, 0.03), toon('#ffffff'), wx - 0.22, wy + 0.02, 0.86, null).material.color.set('#fff0f6');
      add(b, new THREE.BoxGeometry(1.0, 0.2, 0.22), toon('#c29a62'), wx, wy - 0.56, 0.9, '#8a5f3a', 0.012);
      [-0.3, -0.1, 0.1, 0.3].forEach((fx, i) => add(b, new THREE.SphereGeometry(0.09, 8, 6), toon(['#ff9ec4', '#ffd36e', '#ff8f6a', '#c9a6ff'][i]), wx + fx, wy - 0.4, 0.92, '#7a4a63', 0.008));
    });
    // cửa: tấm ô, tay nắm, vòm, bậc đá, mái hiên sọc
    const door = add(b, new THREE.BoxGeometry(0.95, 1.5, 0.1), toon('#a8744a'), 0, 0.75, 0.84, '#5a3a22', 0.025);
    [0.45, 1.05].forEach(dy => add(b, new THREE.BoxGeometry(0.6, 0.4, 0.03), toon('#8f5f3a'), 0, dy, 0.9, null));
    add(b, new THREE.SphereGeometry(0.05, 8, 6), toon('#ffd36e'), 0.32, 0.78, 0.92, '#a8742e', 0.006);
    add(b, new THREE.CylinderGeometry(0.48, 0.48, 0.1, 14, 1, false, 0, Math.PI), toon('#a8744a'), 0, 1.5, 0.84, '#5a3a22', 0.025).rotation.x = Math.PI / 2;
    add(b, new THREE.BoxGeometry(1.4, 0.1, 0.5), toon('#d9d2c4'), 0, 0.05, 1.05, '#8a8478', 0.012);
    const aw = add(b, new THREE.BoxGeometry(1.6, 0.06, 0.75), toon('#ffffff', awningTex(roof)), 0, 1.95, 1.12, '#7a3a2a', 0.015); aw.rotation.x = 0.32;
    if (label) { const sg = kit.sign(label, Math.min(w - 0.4, 2.2), 0.5, sign, fg, 34); sg.position.set(0, h - 0.42, 0.86); b.add(sg); }
    if (to) { b.userData.door = door; kit.hotspot({ id: 'go-' + to, label: label || to, at: [x, h + 1.1, z + 1.2], stand: [x, z + 2.4], act: () => c.goTo(to) }, door); }
    return b;
  };
  /** Dây cờ hiệu giữa hai điểm (x0,y,z0)→(x1,y,z1), cờ tam giác nhiều màu. */
  const bunting = (g, x0, z0, x1, z1, y = 3.0, cols = ['#ff9ec4', '#ffd36e', '#7ec8ff', '#c9a6ff', '#7edb72']) => {
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.55)), items = [], tri = world.geo('flag', () => new THREE.ConeGeometry(0.16, 0.34, 3));
    for (let i = 0; i <= n; i++) { const t = i / n; items.push({ x: x0 + (x1 - x0) * t, y: y - Math.sin(t * Math.PI) * 0.35 - 0.12, z: z0 + (z1 - z0) * t, rx: Math.PI, ry: Math.atan2(x1 - x0, z1 - z0), s: 1, color: cols[i % cols.length] }); }
    return world.scatter(g, tri, world.toonC('#ffffff'), items, null);
  };
  const cloud = (g, x, y, z, s = 1) => { const c = new THREE.Group(); c.position.set(x, y, z); c.scale.setScalar(s); g.add(c); const m = (glowMat || (x => x))(new THREE.MeshBasicMaterial({ color: '#c9d6ec', transparent: true, opacity: 0.85 })); [[0, 0, 0, 1.2], [1.1, -0.1, 0, 0.9], [-1.1, -0.15, 0, 0.8], [0.4, 0.5, 0, 0.8]].forEach(([dx, dy, dz, r]) => { const b = new THREE.Mesh(world.geo('cloud', () => new THREE.SphereGeometry(1, 12, 8)), m); b.position.set(dx, dy, dz); b.scale.set(r, r * 0.7, r * 0.8); c.add(b); }); return c; };
  /** Đồi xa làm nền: các nửa quả cầu xanh nhạt xếp theo hàng. */
  const hills = (g, z, xs, cols = ['#bfe8a8', '#aee09a', '#c9eeb5']) => xs.forEach((x, i) => { const h = new THREE.Mesh(world.geo('hill', () => new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), world.toonC(cols[i % cols.length])); h.position.set(x, -0.2, z); h.scale.set(7 + (i % 3) * 2, 2.2 + (i % 2) * 1.4, 4); g.add(h); });
  const stripeTex = (a, b, n = 4) => canvasTex(64, 32, d => { d.fillStyle = b; d.fillRect(0, 0, 64, 32); d.fillStyle = a; for (let i = 0; i < n; i++) d.fillRect(i * 64 / n, 0, 32 / n, 32); }, [1, 1]);
  /** Bánh xe gỗ có nan hoa (trục theo trục x của nhóm). */
  const wheel = (g, x, y, z, r = 0.32) => {
    const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.y = Math.PI / 2; g.add(w);
    add(w, new THREE.TorusGeometry(r, 0.05, 6, 18), toon('#7a5a3a'), 0, 0, 0, '#3a2a1a', 0.012);
    for (let i = 0; i < 4; i++) add(w, new THREE.BoxGeometry(0.04, r * 2, 0.03), toon('#a8744a'), 0, 0, 0, null).rotation.z = i * Math.PI / 4;
    add(w, new THREE.CylinderGeometry(0.07, 0.07, 0.08, 10), toon('#ffd36e'), 0, 0, 0, null).rotation.x = Math.PI / 2;
    return w;
  };
  /** Xe đẩy bán hàng: thùng gỗ ô kính, bánh xe, càng đẩy, mái sọc, biển tên, hàng bày (goods: 'bread' | 'icecream' | 'fruit'). */
  const cart = (g, x, z, { ry = 0, label = 'Bánh mì', body = '#ffcf8a', stripe = '#ff8f6a', goods = 'bread' } = {}) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    add(b, new THREE.BoxGeometry(1.9, 0.75, 0.95), toon(body), 0, 0.72, 0, '#8a5a3a', 0.03);
    add(b, new THREE.BoxGeometry(1.98, 0.08, 1.03), toon('#fff8ef'), 0, 1.12, 0, '#8a7a6a', 0.012);
    [-0.5, 0, 0.5].forEach(px => add(b, new THREE.BoxGeometry(0.5, 0.45, 0.02), toon(new THREE.Color(body).offsetHSL(0, 0, -0.08).getStyle()), px, 0.7, 0.485, null));
    const glass = add(b, new THREE.BoxGeometry(1.7, 0.5, 0.75), new THREE.MeshToonMaterial({ color: '#dff4ff', transparent: true, opacity: 0.42, gradientMap: null }), 0, 1.41, 0, '#7a9ab0', 0.012); glass.castShadow = false;
    add(b, new THREE.BoxGeometry(1.76, 0.05, 0.8), toon('#fff8ef'), 0, 1.68, 0, null);
    const cols = { bread: ['#e8a85a', '#d9944a'], icecream: ['#ff9ec4', '#bfe8ff', '#fff3a0'], fruit: ['#ff6a5a', '#ffd36e', '#7edb72'] }[goods] || ['#e8a85a'];
    for (let i = 0; i < 5; i++) {
      const gx = -0.64 + i * 0.32, col = cols[i % cols.length];
      if (goods === 'bread') { const m = add(b, new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), toon(col), gx, 1.24, 0.05 * (i % 2 ? 1 : -1), '#8a5a2a', 0.008); m.rotation.z = Math.PI / 2; m.rotation.y = 0.3; }
      else add(b, new THREE.SphereGeometry(0.09, 10, 8), toon(col), gx, 1.25, 0, '#7a4a3a', 0.008);
    }
    wheel(b, -0.98, 0.33, 0.25); wheel(b, -0.98, 0.33, -0.25);
    add(b, new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8), toon('#7a6a8a'), 0.78, 0.18, 0, '#443', 0.01);
    [-0.3, 0.3].forEach(dz => { const h = add(b, new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), toon('#a8744a'), 1.2, 1.0, dz, null); h.rotation.z = -0.9; });
    add(b, new THREE.CylinderGeometry(0.035, 0.035, 0.66, 6), toon('#a8744a'), 1.48, 1.2, 0, null).rotation.x = Math.PI / 2;
    [-0.82, 0.82].forEach(px => add(b, new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), toon('#c29a62'), px, 2.25, -0.32, '#8a5f3a', 0.01));
    const roofM = add(b, new THREE.BoxGeometry(2.2, 0.06, 1.3), toon('#ffffff', stripeTex(stripe, '#ffffff', 6)), 0, 2.86, 0.05, '#7a3a2a', 0.015); roofM.rotation.x = 0.12;
    const val = []; for (let i = 0; i < 9; i++) val.push(i); val.forEach(i => add(b, new THREE.ConeGeometry(0.12, 0.2, 3), toon(i % 2 ? stripe : '#ffffff'), -0.98 + i * 0.245, 2.68, 0.7, null).rotation.x = Math.PI);
    if (label) { const sg = kit.sign(label, 1.3, 0.34, '#fff7ef', '#7a3a2a', 30); sg.position.set(0, 0.78, 0.5); b.add(sg); }
    return b;
  };
  /** Sạp hoa: kệ bậc thang gỗ với chậu hoa nhiều màu, mái vải, xô hoa phía trước. */
  const kiosk = (g, x, z, { ry = 0, roof = '#ff9ec4', label = 'Hoa tươi' } = {}) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    [0, 1, 2].forEach(i => add(b, new THREE.BoxGeometry(1.9, 0.12, 0.42), toon('#d9b27a'), 0, 0.35 + i * 0.36, 0.3 - i * 0.36, '#8a5f3a', 0.015));
    [-0.92, 0.92].forEach(px => add(b, new THREE.BoxGeometry(0.08, 1.2, 1.2), toon('#c29a62'), px, 0.6, -0.06, '#8a5f3a', 0.015));
    const pots = ['#ff9ec4', '#ffd36e', '#c9a6ff', '#ff8f6a', '#ffffff', '#7ec8ff'];
    [0, 1, 2].forEach(r => [-0.66, -0.22, 0.22, 0.66].forEach((px, k) => {
      const py = 0.41 + r * 0.36, pz = 0.3 - r * 0.36;
      add(b, new THREE.CylinderGeometry(0.11, 0.08, 0.16, 10), toon('#d9825a'), px, py + 0.08, pz, '#7a3a2a', 0.008);
      add(b, new THREE.SphereGeometry(0.13, 10, 8), toon('#6fcf6a'), px, py + 0.24, pz, '#3f8a55', 0.008);
      [[-0.06, 0.05], [0.06, 0.03], [0, -0.06]].forEach(([fx, fz], j) => add(b, new THREE.SphereGeometry(0.055, 8, 6), toon(pots[(r * 4 + k + j) % pots.length]), px + fx, py + 0.33, pz + fz, null));
    }));
    [-0.92, 0.92].forEach(px => add(b, new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), toon('#c29a62'), px, 1.15, -0.6, '#8a5f3a', 0.01));
    const rf = add(b, new THREE.BoxGeometry(2.2, 0.06, 1.5), toon('#ffffff', stripeTex(roof, '#ffffff', 6)), 0, 2.3, 0, '#7a3a5a', 0.015); rf.rotation.x = 0.28;
    for (let i = 0; i < 9; i++) add(b, new THREE.SphereGeometry(0.08, 8, 6), toon(i % 2 ? roof : '#ffffff'), -0.98 + i * 0.245, 2.08, 0.74, null);
    [-0.5, 0.5].forEach((px, i) => { add(b, new THREE.CylinderGeometry(0.2, 0.16, 0.36, 12), toon('#9ab0c8'), px, 0.18, 0.95, '#4a5a6a', 0.01); for (let k = 0; k < 5; k++) add(b, new THREE.SphereGeometry(0.08, 8, 6), toon(pots[(k + i * 2) % pots.length]), px + Math.cos(k * 1.3) * 0.11, 0.48 + (k % 2) * 0.08, 0.95 + Math.sin(k * 1.3) * 0.11, null); });
    if (label) { const sg = kit.sign(label, 1.2, 0.32, '#fff7ef', '#7a3a5a', 30); sg.position.set(0, 1.85, 0.9); sg.rotation.x = -0.15; b.add(sg); }
    return b;
  };
  /** Bàn dã ngoại gỗ có hai ghế dài, khăn caro, giỏ và ô che. */
  const picnic = (g, x, z, { ry = 0, cloth = '#ff8f9a', umbrella = '#7ec8ff' } = {}) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    add(b, new THREE.BoxGeometry(1.8, 0.1, 0.9), toon('#d9b27a'), 0, 0.75, 0, '#8a5f3a', 0.02);
    [-1, 1].forEach(sx => { const l = add(b, new THREE.BoxGeometry(0.08, 0.85, 0.08), toon('#c29a62'), sx * 0.7, 0.38, 0, '#8a5f3a', 0.01); l.rotation.x = 0; [-1, 1].forEach(sz => { const leg = add(b, new THREE.BoxGeometry(0.07, 0.86, 0.07), toon('#c29a62'), sx * 0.7, 0.4, sz * 0.38, '#8a5f3a', 0.01); leg.rotation.x = sz * 0.5; }); });
    [-1, 1].forEach(sz => add(b, new THREE.BoxGeometry(1.8, 0.08, 0.3), toon('#d9b27a'), 0, 0.42, sz * 0.78, '#8a5f3a', 0.015));
    const check = canvasTex(32, 32, d => { d.fillStyle = '#ffffff'; d.fillRect(0, 0, 32, 32); d.fillStyle = cloth; d.globalAlpha = 0.75; for (let i = 0; i < 4; i++) { d.fillRect(i * 8, 0, 4, 32); d.fillRect(0, i * 8, 32, 4); } }, [2, 1]);
    add(b, new THREE.BoxGeometry(1.2, 0.02, 0.92), toon('#ffffff', check), 0, 0.81, 0, null);
    add(b, new THREE.CylinderGeometry(0.18, 0.14, 0.18, 12), toon('#d9a86a'), -0.4, 0.92, 0.05, '#7a5a3a', 0.008);
    add(b, new THREE.TorusGeometry(0.15, 0.02, 6, 14, Math.PI), toon('#a8744a'), -0.4, 1.0, 0.05, null);
    add(b, new THREE.SphereGeometry(0.07, 8, 6), toon('#ff6a5a'), 0.3, 0.87, -0.1, null); add(b, new THREE.SphereGeometry(0.07, 8, 6), toon('#ffd36e'), 0.42, 0.87, 0.08, null);
    add(b, new THREE.CylinderGeometry(0.035, 0.035, 2.3, 6), toon('#f4f0e8'), 0, 1.15, 0, '#6a6a7a', 0.008);
    const um = add(b, new THREE.ConeGeometry(1.25, 0.5, 8, 1, true), toon('#ffffff', stripeTex(umbrella, '#ffffff', 8)), 0, 2.45, 0, '#4a6a8a', 0.02); um.material.side = THREE.DoubleSide;
    add(b, new THREE.SphereGeometry(0.06, 8, 6), toon(umbrella), 0, 2.72, 0, null);
    return b;
  };
  /** Cây cắt tỉa trong chậu: 'ball' (hai quả cầu) hoặc 'cone' (hình nón). */
  const topiary = (g, x, z, { shape = 'ball', s = 1, pot = '#e9eef7' } = {}) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.scale.setScalar(s); g.add(b);
    add(b, new THREE.CylinderGeometry(0.34, 0.26, 0.42, 12), toon(pot), 0, 0.21, 0, '#8896b0', 0.015);
    add(b, new THREE.TorusGeometry(0.34, 0.04, 6, 16), toon(pot), 0, 0.42, 0, null).rotation.x = Math.PI / 2;
    add(b, new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6), toon('#8a5f3a'), 0, 0.65, 0, null);
    if (shape === 'cone') add(b, new THREE.ConeGeometry(0.42, 1.3, 10), toon('#5fbf6a'), 0, 1.25, 0, '#3f8a55', 0.03);
    else { add(b, new THREE.SphereGeometry(0.42, 12, 10), toon('#5fbf6a'), 0, 0.98, 0, '#3f8a55', 0.03); add(b, new THREE.SphereGeometry(0.26, 10, 8), toon('#6fcf75'), 0, 1.55, 0, '#3f8a55', 0.025); }
    return b;
  };
  /** Bồn hoa gỗ chữ nhật trồng hoa (dài w theo trục x của nhóm). */
  const planter = (g, x, z, { w = 1.6, ry = 0, cols } = {}) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    add(b, new THREE.BoxGeometry(w, 0.4, 0.5), toon('#c29a62'), 0, 0.2, 0, '#8a5f3a', 0.015);
    add(b, new THREE.BoxGeometry(w + 0.08, 0.06, 0.58), toon('#d9b27a'), 0, 0.42, 0, null);
    add(b, new THREE.BoxGeometry(w - 0.1, 0.06, 0.4), toon('#7a5a3a'), 0, 0.42, 0, null);
    const pts = []; for (let i = 0, n = Math.round(w / 0.2); i < n; i++) pts.push({ x: x + Math.cos(ry) * (-w / 2 + 0.12 + i * 0.2), z: z - Math.sin(ry) * (-w / 2 + 0.12 + i * 0.2) + (i % 2 ? 0.08 : -0.08) });
    const fl = new THREE.Group(); fl.position.y = 0.3; g.add(fl); flowers(fl, pts, cols);
    return b;
  };
  return { trees, flowers, tufts, fence, lamp, night, facade, bunting, cloud, hills, rnd, cart, kiosk, picnic, topiary, planter, wheel };
}
