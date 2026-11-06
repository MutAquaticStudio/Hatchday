// Quảng trường "Mầm" (~40×30, rộng, camera bám thú): khu gặp gỡ realtime (shared.js). Khu lõi: đài phun nước nhiều tầng, đường lát, ghế đá, đèn, bảng tin,
// bưu điện, tháp đồng hồ, sân khấu nhỏ. Khu tây/đông dựng dần khi bé tới gần: mặt tiền Chợ, Bệnh viện, Thư viện, Tiệm trà, Tiệm may (chạm cửa để tới đó),
// cổng sang Công viên, cây, hoa, hàng rào, cờ hiệu. Chi tiết dựng/ẩn theo khu: xem world.js.
import { makeKit } from './kit.js';
import { makeShared } from './shared.js';
import { festival } from './festival.js';
import { makeProps, makeWorld } from './world.js';

export function initPlaza(c) {
  const { THREE, add, toon, canvasTex, scene } = c, kit = makeKit(c);
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const world = makeWorld(c, g), props = makeProps({ THREE, add, toon, canvasTex, kit, world });
  const shared = makeShared(c, { placeId: 'plaza', group: g });
  const grass = canvasTex(128, 128, d => { d.fillStyle = '#bfeaa0'; d.fillRect(0, 0, 128, 128); d.fillStyle = '#a8da86'; for (let i = 0; i < 40; i++) d.fillRect((i * 37) % 128, (i * 53) % 128, 3, 6); }, [14, 10]);
  const paving = canvasTex(128, 128, d => { d.fillStyle = '#f4e8d4'; d.fillRect(0, 0, 128, 128); d.strokeStyle = '#dccaa8'; d.lineWidth = 3; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) d.strokeRect(i * 32 + (j % 2) * 16 - 16, j * 32, 32, 32); }, [8, 8]);
  const water = canvasTex(128, 128, d => { d.fillStyle = '#8ed6ff'; d.fillRect(0, 0, 128, 128); d.strokeStyle = 'rgba(255,255,255,.55)'; d.lineWidth = 3; for (let r = 10; r < 90; r += 18) { d.beginPath(); d.arc(64, 64, r, 0, 7); d.stroke(); } }, [1, 1]);
  const dens = world.density();
  let clockHands = null, jets = [], waterMesh = null;

  /* ---------- khu lõi (dựng ngay) ---------- */
  world.zone({ id: 'core', core: true, cx: 0, cz: 0, build(z) {
    add(z, new THREE.BoxGeometry(46, 0.4, 36), toon('#ffffff', grass), 0, -0.2, 0, '#6aa05a', 0.03);
    add(z, new THREE.CylinderGeometry(7.2, 7.4, 0.12, 56), toon('#ffffff', paving), 0, 0.02, 0, '#c9b48a', 0.02);
    add(z, new THREE.BoxGeometry(46, 0.1, 3.2), toon('#ffffff', paving), 0, 0.03, -7.2, null); // lối đi trước dãy nhà
    add(z, new THREE.BoxGeometry(3.0, 0.1, 22), toon('#ffffff', paving), 14, 0.03, 0.5, null); // đường ra Công viên
    // đài phun nước nhiều tầng
    const f = new THREE.Group(); f.position.set(0, 0, -0.6); z.add(f);
    add(f, new THREE.CylinderGeometry(2.4, 2.55, 0.5, 40), toon('#e9eef7'), 0, 0.28, 0, '#8896b0', 0.03);
    waterMesh = add(f, new THREE.CylinderGeometry(2.15, 2.15, 0.08, 40), toon('#ffffff', water), 0, 0.54, 0, null);
    add(f, new THREE.CylinderGeometry(0.3, 0.4, 1.3, 14), toon('#e9eef7'), 0, 1.0, 0, '#8896b0', 0.03);
    add(f, new THREE.CylinderGeometry(1.15, 0.7, 0.2, 28), toon('#e9eef7'), 0, 1.5, 0, '#8896b0', 0.03);
    add(f, new THREE.CylinderGeometry(0.95, 0.95, 0.06, 28), toon('#ffffff', water), 0, 1.62, 0, null);
    add(f, new THREE.CylinderGeometry(0.16, 0.22, 0.9, 12), toon('#e9eef7'), 0, 2.0, 0, '#8896b0', 0.03);
    add(f, new THREE.SphereGeometry(0.3, 14, 10), toon('#e9eef7'), 0, 2.55, 0, '#8896b0', 0.03);
    jets = [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const m = add(f, new THREE.SphereGeometry(0.07, 8, 6), toon('#bfe8ff'), 0, 2.2, 0, null); m.userData.i = i; return m; });
    // ghế đá và đèn quanh đài
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5, r = 4.6; kit.bench(z, Math.cos(a) * r, -0.6 + Math.sin(a) * r * 0.8, -a + Math.PI / 2); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; props.lamp(z, Math.cos(a) * 6.3, -0.6 + Math.sin(a) * 5.2); }
    // vòng hoa quanh đường lát
    const ring = []; for (let i = 0, n = Math.round(46 * dens); i < n; i++) { const a = (i / n) * Math.PI * 2, rr = 7.9 + (i % 2) * 0.3; ring.push({ x: Math.cos(a) * rr, z: -0.6 + Math.sin(a) * rr * 0.82 }); }
    props.flowers(z, ring); props.tufts(z, ring.map(p => ({ x: p.x + 0.2, z: p.z + 0.15 })));
    // bảng tin (mở mục Thông báo)
    const board = new THREE.Group(); board.position.set(-5.8, 0, 2.6); board.rotation.y = 0.5; z.add(board);
    [-0.55, 0.55].forEach(x => add(board, new THREE.BoxGeometry(0.1, 1.9, 0.1), toon('#c29a62'), x, 0.95, 0, '#8a5f3a', 0.02));
    const bs = kit.sign('Bảng tin', 1.4, 0.9, '#fff3c4', '#7a5a1a', 40); bs.position.set(0, 1.45, 0.08); board.add(bs);
    kit.hotspot({ id: 'news', label: 'Bảng tin', at: [-5.8, 2.4, 2.7], stand: [-4.6, 3.6], act: () => c.open.news() }, board);
    // bưu điện (mở hộp thư)
    const post = new THREE.Group(); post.position.set(5.8, 0, 2.6); post.rotation.y = -0.5; z.add(post);
    add(post, new THREE.BoxGeometry(0.7, 1.1, 0.6), toon('#ff7a8a'), 0, 0.85, 0, '#a83a4a', 0.03);
    add(post, new THREE.CylinderGeometry(0.35, 0.35, 0.6, 18, 1, false, 0, Math.PI), toon('#ff7a8a'), 0, 1.4, 0, '#a83a4a', 0.03).rotation.z = Math.PI / 2;
    add(post, new THREE.BoxGeometry(0.4, 0.06, 0.04), toon('#2a2230'), 0, 1.1, 0.31, null);
    add(post, new THREE.BoxGeometry(0.16, 0.5, 0.16), toon('#7a6a8a'), 0, 0.25, 0, '#443', 0.02);
    kit.hotspot({ id: 'mail', label: 'Bưu điện', at: [5.8, 2.1, 2.7], stand: [4.6, 3.6], act: () => c.open.mail() }, post);
    // tháp đồng hồ + sân khấu nhỏ ở giữa dãy nhà phía sau
    const tower = new THREE.Group(); tower.position.set(0, 0, -10); z.add(tower);
    add(tower, new THREE.BoxGeometry(2.0, 6.0, 2.0), toon('#ffe0c9'), 0, 3.0, 0, '#8a6a7a', 0.04);
    add(tower, new THREE.ConeGeometry(1.7, 1.8, 4), toon('#d9644a'), 0, 6.9, 0, '#7a3a2a', 0.04).rotation.y = Math.PI / 4;
    const face = canvasTex(128, 128, d => { d.fillStyle = '#fffdf5'; d.beginPath(); d.arc(64, 64, 58, 0, 7); d.fill(); d.strokeStyle = '#7a5a4a'; d.lineWidth = 6; d.stroke(); d.fillStyle = '#7a5a4a'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; d.fillRect(64 + Math.sin(a) * 46 - 3, 64 - Math.cos(a) * 46 - 3, 6, 6); } });
    const faceM = new THREE.Mesh(new THREE.CircleGeometry(0.8, 28), new THREE.MeshBasicMaterial({ map: face })); faceM.position.set(0, 4.7, 1.01); tower.add(faceM);
    const hand = (len, w, col) => { const p = new THREE.Group(); p.position.set(0, 4.7, 1.04); tower.add(p); const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.03), new THREE.MeshBasicMaterial({ color: col })); m.position.y = len / 2; p.add(m); return p; };
    clockHands = { h: hand(0.45, 0.07, '#5a3a2a'), m: hand(0.68, 0.05, '#5a3a2a') };
    const stage = new THREE.Group(); stage.position.set(0, 0, -7.6); z.add(stage);
    add(stage, new THREE.BoxGeometry(5.4, 0.5, 2.4), toon('#d9b27a'), 0, 0.25, 0, '#8a5f3a', 0.03);
    [-2.5, 2.5].forEach(x => add(stage, new THREE.BoxGeometry(0.14, 2.8, 0.14), toon('#c29a62'), x, 1.9, -0.9, '#8a5f3a', 0.02));
    add(stage, new THREE.BoxGeometry(5.6, 0.25, 0.4), toon('#ff9ec4'), 0, 3.3, -0.9, '#a8507a', 0.02);
    add(stage, new THREE.BoxGeometry(5.0, 2.4, 0.08), toon('#c9a6ff'), 0, 1.75, -1.1, '#6a4aa8', 0.02);
    props.bunting(z, -6.5, -6.3, 6.5, -6.3, 3.4);
    // nền xa: đồi, mây
    props.hills(z, -19, [-16, -6, 5, 15]); props.hills(z, 19, [-14, 2, 16]);
    z.userData.clouds = [props.cloud(z, -12, 9, -14, 1.4), props.cloud(z, 8, 11, -16, 1.8), props.cloud(z, 18, 8.5, -12, 1.2)];
  } });

  /* ---------- khu tây: Chợ Xanh, Bệnh viện ---------- */
  const treeSpots = (xs, zs) => xs.flatMap(x => zs.map((zz, j) => ({ x: x + (j % 2) * 0.7, z: zz, s: 0.9 + ((x * 7 + zz * 3) % 5) / 10 })));
  world.zone({ id: 'west', cx: -13, cz: -1, show: 20, build(z) {
    return [
      () => { props.facade(z, { x: -15, z: -10, w: 4.6, h: 3.4, wall: '#ffe9c4', roof: '#d9644a', label: 'Chợ Xanh', to: 'market' }); props.facade(z, { x: -8.5, z: -10, w: 4.2, h: 3.2, wall: '#eafaf4', roof: '#6fcfa8', label: 'Bệnh viện', to: 'hospital', sign: '#e4f8f0', fg: '#2f6a58' }); },
      () => props.trees(z, treeSpots([-19, -12.5], [-5, 1.5, 7.5]).slice(0, Math.round(6 * dens) || 3)),
      () => { const pts = []; for (let i = 0, n = Math.round(30 * dens); i < n; i++) pts.push({ x: -19 + (i % 10) * 0.7, z: -5.3 + Math.floor(i / 10) * 0.6 }); props.flowers(z, pts); },
      () => { props.fence(z, -20.5, -12, -20.5, 8, 0.8); props.fence(z, -20.5, 8.5, -9, 8.5, 0.8, true); },
      () => { props.lamp(z, -11, -6.2); props.lamp(z, -17.5, -6.2); props.lamp(z, -12, 5.5); props.bunting(z, -17.5, -6.2, -11, -6.2, 3.0); kit.bench(z, -15, 5.8, Math.PI); kit.bench(z, -17.4, 1.2, Math.PI / 2); },
      () => { const tufts = []; for (let i = 0, n = Math.round(60 * dens); i < n; i++) tufts.push({ x: -20 + ((i * 37) % 120) / 10, z: -6 + ((i * 53) % 130) / 10 }); props.tufts(z, tufts); },
    ];
  } });

  /* ---------- khu đông: Thư viện, Tiệm trà, Tiệm may, cổng Công viên ---------- */
  world.zone({ id: 'east', cx: 13, cz: -1, show: 20, build(z) {
    return [
      () => { props.facade(z, { x: 8.5, z: -10, w: 4.2, h: 3.4, wall: '#e8f2ff', roof: '#6a8ad8', label: 'Thư viện', to: 'library', sign: '#eef4ff', fg: '#2f4a7a' }); props.facade(z, { x: 15, z: -10, w: 4.6, h: 3.2, wall: '#fff0d4', roof: '#b8744a', label: 'Tiệm trà', to: 'tea' }); },
      () => props.facade(z, { x: 19.5, z: -2.5, ry: -Math.PI / 2, w: 4.0, h: 3.0, wall: '#f1e9ff', roof: '#8a6ac8', label: 'Tiệm may', to: 'tailor', sign: '#f6f0ff', fg: '#4a2f7a' }),
      () => { // cổng sang Công viên (mép nam, bên phải)
        const gate = new THREE.Group(); gate.position.set(14, 0, 9.6); z.add(gate);
        [-1.6, 1.6].forEach(x => add(gate, new THREE.BoxGeometry(0.4, 2.8, 0.4), toon('#d9b27a'), x, 1.4, 0, '#8a5f3a', 0.03));
        add(gate, new THREE.BoxGeometry(4.0, 0.5, 0.5), toon('#7edb72'), 0, 3.0, 0, '#3f8a55', 0.03);
        const sg = kit.sign('Công viên →', 2.2, 0.5, '#e8fbe0', '#2f6a3a', 34); sg.position.set(0, 3.0, 0.28); gate.add(sg);
        kit.hotspot({ id: 'go-park', label: 'Công viên', at: [14, 3.9, 9.6], stand: [14, 7.2], act: () => c.goTo('park') }, gate);
      },
      () => props.trees(z, treeSpots([19, 12], [-5, 1.5, 7.5]).slice(0, Math.round(6 * dens) || 3)),
      () => { const pts = []; for (let i = 0, n = Math.round(30 * dens); i < n; i++) pts.push({ x: 9 + (i % 10) * 0.7, z: 6 + Math.floor(i / 10) * 0.6 }); props.flowers(z, pts); },
      () => { props.fence(z, 20.5, 2, 20.5, 8, 0.8); props.fence(z, 9, 9, 12, 9, 0.8, true); props.fence(z, 16, 9, 20.5, 9, 0.8, true); },
      () => { props.lamp(z, 11, -6.2); props.lamp(z, 18, -6.2); props.lamp(z, 11.5, 5.5); props.bunting(z, 11, -6.2, 18, -6.2, 3.0); kit.bench(z, 17, 4.2, -Math.PI / 2); kit.bench(z, 9.5, 2.2, Math.PI); },
      () => { const tufts = []; for (let i = 0, n = Math.round(60 * dens); i < n; i++) tufts.push({ x: 8 + ((i * 41) % 130) / 10, z: -6 + ((i * 59) % 150) / 10 }); props.tufts(z, tufts); },
    ];
  } });
  // cây rải ở bờ nam và hai bên (khu lõi để nhẹ: chỉ vài cây)
  world.zone({ id: 'south', cx: 0, cz: 11, show: 18, build(z) { return [() => props.trees(z, [{ x: -8, z: 12, s: 1.2 }, { x: -3, z: 13, s: 1.0 }, { x: 4, z: 12.5, s: 1.1 }, { x: 9, z: 13, s: 0.95 }].slice(0, Math.round(4 * dens) || 2)), () => props.fence(z, -20, 14.5, 20, 14.5, 0.8, true)]; } });

  let decor = { theme: null, group: null };
  function applyDecor() {
    const th = (c.events && c.events.decor()) || null;
    if (th === decor.theme) return;
    if (decor.group) { g.remove(decor.group); decor.group = null; }
    decor.theme = th; if (th) { decor.group = festival(c, th); g.add(decor.group); }
  }
  const core = g.children.find(o => o.userData.clouds);
  return {
    group: g,
    enter() { applyDecor(); kit.show(true); shared.enter(); setTimeout(() => { if (c.getArea() === 'plaza') c.say('Quảng trường rộng ghê! Đi dạo và chào mọi người nhé.', 3200); }, 900); },
    leave() { kit.show(false); shared.leave(); },
    update(dt, now) {
      kit.tick(now); const t = now / 1000, [px, pz] = c.getPetXZ();
      world.update(px, pz);
      jets.forEach(j => { const ph = (t * 1.4 + j.userData.i / 8) % 1, a = j.userData.i * Math.PI / 4; j.position.set(Math.cos(a) * ph * 1.0, 2.2 + Math.sin(ph * Math.PI) * 0.8, Math.sin(a) * ph * 1.0); });
      if (waterMesh) waterMesh.material.map.offset.set(Math.sin(t * 0.3) * 0.04, t * 0.02);
      if (clockHands) { const d = new Date(); clockHands.m.rotation.z = -(d.getMinutes() + d.getSeconds() / 60) * Math.PI / 30; clockHands.h.rotation.z = -((d.getHours() % 12) + d.getMinutes() / 60) * Math.PI / 6; }
      const cl = (core || g.children[0]).userData.clouds; if (cl) cl.forEach((m, i) => { m.position.x += dt * (0.25 + i * 0.1); if (m.position.x > 26) m.position.x = -26; });
      props.night(c.isNight ? c.isNight() : false);
      shared.update(dt, now);
    },
    tap: e => shared.tap(e) || kit.tap(e), sync() {},
    world,
  };
}
