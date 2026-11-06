// Bộ dựng thế giới rộng cho các nơi chung (Quảng trường, Công viên, Tiệm trà):
//  - zones: chia nơi thành các khu; khu lõi dựng ngay khi vào, các khu khác dựng dần (mỗi khung hình tối đa ~4 ms) khi bé tới gần,
//    khu quá xa thì ẩn (không vẽ). Nhờ vậy vào nơi rộng vẫn nhanh và thiết bị yếu không phải dựng/vẽ cả bản đồ.
//  - scatter: vật lặp (cây, hoa, cỏ, hàng rào, đèn) dựng bằng InstancedMesh (một lần vẽ cho cả loạt) kèm viền;
//  - cache hình/vật liệu dùng chung; chất lượng Thấp giảm bớt số vật trang trí (density).
// Mỗi nơi gọi makeWorld(c), khai báo zones rồi gọi world.update(dt, petX, petZ) mỗi khung hình.
const BUDGET_MS = 4;

export function makeWorld(c, group) {
  const { THREE, toon } = c;
  const gCache = new Map(), mCache = new Map(), zones = [], queue = [];
  const geo = (k, f) => { let g = gCache.get(k); if (!g) { g = f(); gCache.set(k, g); } return g; };
  const mat = (k, f) => { let m = mCache.get(k); if (!m) { m = f(); mCache.set(k, m); } return m; };
  const toonC = (col, map) => mat('t:' + col + (map ? map.uuid : ''), () => toon(col, map));
  const outMat = col => mat('o:' + col, () => new THREE.MeshBasicMaterial({ color: col, side: THREE.BackSide }));
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
      if (it.color) m.setColorAt(i, color.set(it.color));
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

/** Bộ vật trang trí dùng chung (nhận { THREE, add, toon, canvasTex, kit, world }). Mỗi hàm thêm vào `g` và trả về nhóm. */
export function makeProps({ THREE, add, toon, canvasTex, kit, world }) {
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
    add(l, new THREE.CylinderGeometry(0.06, 0.09, 2.5, 8), toon('#7a6a8a'), 0, 1.25, 0, '#443', 0.02);
    const bulb = add(l, new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: '#fff3c4' }), 0, 2.6, 0, '#b8a050', 0.02); bulb.userData.lamp = true; lamps.push(bulb);
    add(l, new THREE.ConeGeometry(0.3, 0.2, 10), toon('#7a6a8a'), 0, 2.85, 0, '#443', 0.015);
    return l;
  };
  const night = on => lamps.forEach(b => b.material.color.set(on ? '#ffe28a' : '#fff3c4'));
  /** Mặt tiền toà nhà: thân, mái, cửa sổ, cửa vào (hotspot đi tới `to`), biển tên. */
  const facade = (g, { x, z, w = 4, h = 3, wall = '#ffe9c4', roof = '#d9644a', label, to, sign = '#fff7ef', fg = '#5a3a4a', ry = 0 }) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    add(b, new THREE.BoxGeometry(w, h, 1.6), toon(wall), 0, h / 2, 0, '#8a6a7a', 0.04);
    const r = add(b, new THREE.BoxGeometry(w + 0.5, 0.35, 2.1), toon(roof), 0, h + 0.17, 0.1, '#7a3a2a', 0.03);
    add(b, new THREE.BoxGeometry(w * 0.75, 0.6, 1.2), toon(roof), 0, h + 0.55, 0.05, '#7a3a2a', 0.03);
    [-w * 0.3, w * 0.3].forEach(wx => { add(b, new THREE.BoxGeometry(0.8, 0.8, 0.08), toon('#cfeaff'), wx, h * 0.62, 0.82, '#6a8aa8', 0.02); add(b, new THREE.BoxGeometry(0.95, 0.12, 0.14), toon('#ff9ec4'), wx, h * 0.62 - 0.5, 0.86, '#a8507a', 0.015); });
    const door = add(b, new THREE.BoxGeometry(0.95, 1.5, 0.1), toon('#a8744a'), 0, 0.75, 0.84, '#5a3a22', 0.025);
    add(b, new THREE.CylinderGeometry(0.48, 0.48, 0.1, 14, 1, false, 0, Math.PI), toon('#a8744a'), 0, 1.5, 0.84, '#5a3a22', 0.025).rotation.x = Math.PI / 2;
    add(b, new THREE.BoxGeometry(1.5, 0.12, 0.7), toon(roof), 0, 1.85, 1.1, '#7a3a2a', 0.02).rotation.x = 0.25;
    if (label) { const sg = kit.sign(label, Math.min(w - 0.4, 2.2), 0.5, sign, fg, 34); sg.position.set(0, h - 0.35, 0.83); b.add(sg); }
    if (to) { b.userData.door = door; kit.hotspot({ id: 'go-' + to, label: label || to, at: [x, h + 1.1, z + 1.2], stand: [x, z + 2.4], act: () => c.goTo(to) }, door); }
    return b;
  };
  /** Dây cờ hiệu giữa hai điểm (x0,y,z0)→(x1,y,z1), cờ tam giác nhiều màu. */
  const bunting = (g, x0, z0, x1, z1, y = 3.0, cols = ['#ff9ec4', '#ffd36e', '#7ec8ff', '#c9a6ff', '#7edb72']) => {
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.55)), items = [], tri = world.geo('flag', () => new THREE.ConeGeometry(0.16, 0.34, 3));
    for (let i = 0; i <= n; i++) { const t = i / n; items.push({ x: x0 + (x1 - x0) * t, y: y - Math.sin(t * Math.PI) * 0.35 - 0.12, z: z0 + (z1 - z0) * t, rx: Math.PI, ry: Math.atan2(x1 - x0, z1 - z0), s: 1, color: cols[i % cols.length] }); }
    return world.scatter(g, tri, world.toonC('#ffffff'), items, null);
  };
  const cloud = (g, x, y, z, s = 1) => { const c = new THREE.Group(); c.position.set(x, y, z); c.scale.setScalar(s); g.add(c); const m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 }); [[0, 0, 0, 1.2], [1.1, -0.1, 0, 0.9], [-1.1, -0.15, 0, 0.8], [0.4, 0.5, 0, 0.8]].forEach(([dx, dy, dz, r]) => { const b = new THREE.Mesh(world.geo('cloud', () => new THREE.SphereGeometry(1, 12, 8)), m); b.position.set(dx, dy, dz); b.scale.set(r, r * 0.7, r * 0.8); c.add(b); }); return c; };
  /** Đồi xa làm nền: các nửa quả cầu xanh nhạt xếp theo hàng. */
  const hills = (g, z, xs, cols = ['#bfe8a8', '#aee09a', '#c9eeb5']) => xs.forEach((x, i) => { const h = new THREE.Mesh(world.geo('hill', () => new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), world.toonC(cols[i % cols.length])); h.position.set(x, -0.2, z); h.scale.set(7 + (i % 3) * 2, 2.2 + (i % 2) * 1.4, 4); g.add(h); });
  return { trees, flowers, tufts, fence, lamp, night, facade, bunting, cloud, hills, rnd };
}
