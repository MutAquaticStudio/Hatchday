// Quảng trường "Mầm" (~40×30, rộng, camera bám thú): khu gặp gỡ realtime (shared.js). Khu lõi: đài phun nước nhiều tầng, đường lát, ghế đá, đèn, bảng tin,
// bưu điện, tháp đồng hồ, sân khấu nhỏ. Khu tây/đông dựng dần khi bé tới gần: mặt tiền Chợ, Bệnh viện, Thư viện, Tiệm trà, Tiệm may (chạm cửa để tới đó),
// cổng sang Công viên, cây, hoa, hàng rào, cờ hiệu. Chi tiết dựng/ẩn theo khu: xem world.js.
import { _t } from '../../i18n';
import { makeKit } from './kit.js';
import { makeShared } from './shared.js';
import { festival } from './festival.js';
import { makeFireflies, makeProps, makeWorld } from './world.js';

export function initPlaza(c) {
  const { THREE, add, toon, canvasTex, scene } = c, kit = makeKit(c, { cull: true });
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const world = makeWorld(c, g), props = makeProps({ THREE, add, toon, canvasTex, kit, world, glowMat: c.glowMat });
  const shared = makeShared(c, { placeId: 'plaza', group: g });
  const grass = canvasTex(128, 128, d => { d.fillStyle = '#bfeaa0'; d.fillRect(0, 0, 128, 128); d.fillStyle = '#a8da86'; for (let i = 0; i < 40; i++) d.fillRect((i * 37) % 128, (i * 53) % 128, 3, 6); }, [14, 10]);
  const paving = canvasTex(128, 128, d => { d.fillStyle = '#f4e8d4'; d.fillRect(0, 0, 128, 128); d.strokeStyle = '#dccaa8'; d.lineWidth = 3; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) d.strokeRect(i * 32 + (j % 2) * 16 - 16, j * 32, 32, 32); }, [8, 8]);
  const water = canvasTex(128, 128, d => { d.fillStyle = '#8ed6ff'; d.fillRect(0, 0, 128, 128); d.strokeStyle = 'rgba(255,255,255,.55)'; d.lineWidth = 3; for (let r = 10; r < 90; r += 18) { d.beginPath(); d.arc(64, 64, r, 0, 7); d.stroke(); } }, [1, 1]);
  const dens = world.density();
  let clockHands = null, jets = [], waterMesh = null, jetBoost = 0, spot = null, spotUntil = 0, pigeons = [];
  const ease = u => u * u * (3 - 2 * u), lerp = (a, b, k) => a + (b - a) * k, clamp01 = u => Math.max(0, Math.min(1, u));
  const arc = (a, b, k, h) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k) + Math.sin(k * Math.PI) * h, lerp(a[2], b[2], k)];

  /* ---------- tương tác: đài phun nước, ghế đá, sân khấu; chim bồ câu biết tránh bé ---------- */
  function splashFountain() { // chạy tới mép đài, nhảy tưng và té nước; đài phun mạnh hơn một lúc
    const [fx, fz] = c.getPetXZ(), edge = [Math.sign(fx || 1) * 1.0, 0, 3.0 - 0.6 + 0.4]; jetBoost = 1; let nextDrop = 0, lastB = -1;
    return c.script({ onStart: () => shared.sendAct('fountain'), dur: 3.6, update: (u, t) => {
      if (u < 0.2) return { pos: arc([fx, 0, fz], edge, ease(u / 0.2), 0.15) };
      const [px, pz] = c.getPetXZ(), k = (u - 0.2) / 0.8, bn = Math.floor(k * 3 + 0.5);
      if (bn !== lastB && k < 0.85) { lastB = bn; c.sfx('splash'); }
      const jump = Math.abs(Math.sin(k * Math.PI * 3)) * 0.55 * (k < 0.85 ? 1 : 0);
      if (t > nextDrop && k < 0.85) { nextDrop = t + 0.09; const a = Math.random() * Math.PI * 2; c.spawnAt('drop', px + Math.cos(a) * 0.5, 0.6 + jump, pz + Math.sin(a) * 0.3, { vx: Math.cos(a) * 1.3, vy: 2.2 + Math.random(), g: 7, scale: 0.2, max: 0.7 }); }
      return { pos: [edge[0], jump, edge[2]], stretch: jump > 0.05 ? 0.1 : -0.06, roll: Math.sin(k * Math.PI * 6) * 0.12, face: 0 };
    }, done: ok => { if (!ok) return; c.say(_t('Mát rượi! Nước bắn tùm lum luôn!'), 2200); c.setTemp('excited', 1600); if (ok) c.activity('fountain'); } });
  }
  function sitOn(x, z, ry, label) { // nhảy lên ghế đá, ngồi đung đưa, rồi nhảy xuống
    const [fx, fz] = c.getPetXZ(), front = [x + Math.sin(ry) * 1.15, 0, z + Math.cos(ry) * 1.15];
    let sat = false;
    return c.script({ onStart: () => shared.sendAct('bench'), dur: 6, noWalk: true, update: (u, t) => {
      if (!sat && u >= 0.12) { sat = true; c.sfx('sit'); }
      if (u < 0.12) return { pos: arc([fx, 0, fz], [x, 0.55, z], ease(u / 0.12), 0.5), face: ry, stretch: Math.sin(u / 0.12 * Math.PI) * 0.1 };
      if (u > 0.88) return { pos: arc([x, 0.55, z], front, ease((u - 0.88) / 0.12), 0.5), face: ry };
      return { pos: [x, 0.55, z], face: ry, roll: Math.sin(t * 2.4) * 0.05, stretch: -0.07 + Math.sin(t * 1.6) * 0.015 };
    }, done: ok => { if (!ok) return; c.say(label, 2000); if (ok) c.activity('bench'); } });
  }
  function performOnStage() { // lên sân khấu, đèn rọi đổi màu, nhảy múa và cúi chào
    const [fx, fz] = c.getPetXZ(); spotUntil = performance.now() + 7200;
    let cheered = false, nextBang = 0; const fest = () => !!decor.theme; // ngày lễ: sân khấu có pháo hoa
    return c.script({ onStart: () => shared.sendAct('stage'), dur: 7, update: (u, t) => {
      if (!cheered && u >= 0.12) { cheered = true; c.sfx('cheer'); }
      if (u < 0.12) return { pos: arc([fx, 0, fz], [0, 0.5, -7.5], ease(u / 0.12), 0.6) };
      if (u > 0.9) return { pos: arc([0, 0.5, -7.5], [0, 0, -5.3], ease((u - 0.9) / 0.1), 0.5), face: 0 };
      if (fest() && t > nextBang && u < 0.9) { nextBang = t + 0.55; c.sfx('badge'); const bx = (Math.random() - 0.5) * 7, by = 3 + Math.random() * 2; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; c.spawnAt('sparkle', bx, by, -8.5, { vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6 + 0.5, g: 2.2, scale: 0.34, max: 1.1 }); } }
      const k = (u - 0.12) / 0.78; if (Math.random() < 0.08) c.spawnAt(Math.random() < 0.5 ? 'note' : 'sparkle', (Math.random() - 0.5) * 3, 1.2 + Math.random(), -7.5, { vy: 0.8, scale: 0.34, max: 1 });
      if (k > 0.86) return { pos: [0, 0.5, -7.5], stretch: -0.16 * Math.sin((k - 0.86) / 0.14 * Math.PI), face: 0 };
      return { pos: [0, 0.5 + Math.abs(Math.sin(t * 7)) * 0.18, -7.5], spin: k < 0.4 ? k / 0.4 * Math.PI * 4 : 0, roll: Math.sin(t * 7) * 0.14, face: k < 0.4 ? undefined : 0 };
    }, done: ok => { if (!ok) return; c.say(_t('Cảm ơn mọi người đã xem mình biểu diễn!'), 2400); c.spawn('heart', 4); c.sfx('cheer'); if (ok) c.activity('stage'); } });
  }
  const fireflies = makeFireflies(THREE, g, { x0: -16, x1: 16, z0: -6, z1: 8 }, Math.round(18 * dens));

  /* ---------- khu lõi (dựng ngay) ---------- */
  world.zone({ id: 'core', core: true, cx: 0, cz: 0, build(z) {
    add(z, new THREE.BoxGeometry(46, 0.4, 36), toon('#ffffff', grass), 0, -0.2, 0, '#6aa05a', 0.03);
    add(z, new THREE.CylinderGeometry(7.2, 7.4, 0.12, 56), toon('#ffffff', paving), 0, 0.02, 0, '#c9b48a', 0.02);
    add(z, new THREE.BoxGeometry(46, 0.1, 3.2), toon('#ffffff', paving), 0, 0.03, -7.2, null); // lối đi trước dãy nhà
    add(z, new THREE.BoxGeometry(3.0, 0.1, 22), toon('#ffffff', paving), 14, 0.03, 0.5, null); // đường ra Công viên
    // đài phun nước nhiều tầng
    const f = new THREE.Group(); f.position.set(0, 0, -0.6); z.add(f);
    add(f, new THREE.CylinderGeometry(2.75, 2.85, 0.12, 40), toon('#d9d2c4'), 0, 0.06, 0, '#8a8478', 0.02); // bậc đá quanh đài
    add(f, new THREE.CylinderGeometry(2.4, 2.55, 0.5, 40), toon('#e9eef7'), 0, 0.28, 0, '#8896b0', 0.03);
    add(f, new THREE.TorusGeometry(2.42, 0.1, 8, 48), toon('#f6f8fc'), 0, 0.55, 0, '#8896b0', 0.015).rotation.x = Math.PI / 2; // gờ thành bể
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(f, new THREE.BoxGeometry(0.1, 0.28, 0.06), toon('#cfd6e4'), Math.cos(a) * 2.5, 0.26, Math.sin(a) * 2.5, null).rotation.y = -a + Math.PI / 2; } // gờ trang trí
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.26; add(f, new THREE.SphereGeometry(0.12, 10, 8), toon('#ffffff'), Math.cos(a) * 1.15, 1.42, Math.sin(a) * 1.15, '#8896b0', 0.01); } // hạt ngọc tầng giữa
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4, lp = add(f, new THREE.CircleGeometry(0.22, 12), toon('#7edb72'), Math.cos(a) * 1.55, 0.59, Math.sin(a) * 1.55, null); lp.rotation.x = -Math.PI / 2; add(f, new THREE.SphereGeometry(0.06, 8, 6), toon('#ff9ec4'), Math.cos(a) * 1.55 + 0.05, 0.63, Math.sin(a) * 1.55, null); } // lá súng
    waterMesh = add(f, new THREE.CylinderGeometry(2.15, 2.15, 0.08, 40), toon('#ffffff', water, 'water'), 0, 0.54, 0, null);
    add(f, new THREE.CylinderGeometry(0.3, 0.4, 1.3, 14), toon('#e9eef7'), 0, 1.0, 0, '#8896b0', 0.03);
    add(f, new THREE.CylinderGeometry(1.15, 0.7, 0.2, 28), toon('#e9eef7'), 0, 1.5, 0, '#8896b0', 0.03);
    add(f, new THREE.CylinderGeometry(0.95, 0.95, 0.06, 28), toon('#ffffff', water, 'water'), 0, 1.62, 0, null);
    add(f, new THREE.CylinderGeometry(0.16, 0.22, 0.9, 12), toon('#e9eef7'), 0, 2.0, 0, '#8896b0', 0.03);
    add(f, new THREE.SphereGeometry(0.3, 14, 10), toon('#e9eef7'), 0, 2.55, 0, '#8896b0', 0.03);
    jets = [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const m = add(f, new THREE.SphereGeometry(0.07, 8, 6), toon('#bfe8ff'), 0, 2.2, 0, null); m.userData.i = i; m.userData.keep = true; return m; });
    kit.hotspot({ id: 'fountain', label: _t('Đài phun nước'), at: [0, 2.3, -0.6], stand: [0, 2.9], act: () => splashFountain() }, f);
    // ghế đá và đèn quanh đài (hai ghế gần có thể ngồi)
    for (let i = 0; i < 6; i++) {
      // không đặt ghế ngay trước (lối bé đi vào) và ngay sau đài phun (che sân khấu)
      const a = (i / 6) * Math.PI * 2, r = 4.6, bx = Math.cos(a) * r, bz = -0.6 + Math.sin(a) * r * 0.8, ry = -a + Math.PI / 2, bench = kit.bench(z, bx, bz, ry);
      if (i === 0 || i === 3 || i === 4) kit.hotspot({ id: 'bench' + i, label: _t('Ngồi nghỉ'), at: [bx, 1.5, bz], stand: [bx + Math.sin(ry) * 1.15, bz + Math.cos(ry) * 1.15], act: () => sitOn(bx, bz, ry, [_t('Ngồi đây ngắm đài phun thích ghê~'), _t('Ghế mát quá, mình ngồi thêm xíu nha.'), _t('Nhìn mọi người đi dạo vui thật.')][i % 3]) }, bench);
    }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; props.lamp(z, Math.cos(a) * 6.3, -0.6 + Math.sin(a) * 5.2); }
    [-7.4, -5.6, -3.6, 3.6, 5.6, 7.4].forEach((x, i) => props.topiary(z, x, -5.2 - (i % 2) * 0.1, { shape: i % 2 ? 'cone' : 'ball', s: 0.8 }));
    // vòng hoa quanh đường lát
    const ring = []; for (let i = 0, n = Math.round(46 * dens); i < n; i++) { const a = (i / n) * Math.PI * 2, rr = 7.9 + (i % 2) * 0.3; ring.push({ x: Math.cos(a) * rr, z: -0.6 + Math.sin(a) * rr * 0.82 }); }
    props.flowers(z, ring); props.tufts(z, ring.map(p => ({ x: p.x + 0.2, z: p.z + 0.15 })));
    // bảng tin (mở mục Thông báo)
    const board = new THREE.Group(); board.position.set(-5.8, 0, 2.6); board.rotation.y = 0.5; z.add(board);
    [-0.55, 0.55].forEach(x => add(board, new THREE.BoxGeometry(0.1, 1.9, 0.1), toon('#c29a62'), x, 0.95, 0, '#8a5f3a', 0.02));
    const bs = kit.sign(_t('Bảng tin'), 1.4, 0.9, '#fff3c4', '#7a5a1a', 40); bs.position.set(0, 1.45, 0.08); board.add(bs);
    kit.hotspot({ id: 'news', label: _t('Bảng tin'), at: [-5.8, 2.4, 2.7], stand: [-4.6, 3.6], act: () => c.open.news() }, board);
    // bưu điện (mở hộp thư)
    const post = new THREE.Group(); post.position.set(5.8, 0, 2.6); post.rotation.y = -0.5; z.add(post);
    add(post, new THREE.BoxGeometry(0.62, 0.12, 0.54), toon('#6a5a7a'), 0, 0.06, 0, '#3a3044', 0.015); // đế
    add(post, new THREE.BoxGeometry(0.16, 0.5, 0.16), toon('#7a6a8a'), 0, 0.35, 0, '#443', 0.02);
    add(post, new THREE.BoxGeometry(0.7, 1.0, 0.6), toon('#ff7a8a'), 0, 1.05, 0, '#a83a4a', 0.03);
    add(post, new THREE.CylinderGeometry(0.35, 0.35, 0.6, 18, 1, false, 0, Math.PI), toon('#ff7a8a'), 0, 1.55, 0, '#a83a4a', 0.03).rotation.z = Math.PI / 2;
    add(post, new THREE.BoxGeometry(0.76, 0.08, 0.66), toon('#ffd36e'), 0, 0.58, 0, '#a8742e', 0.01); // viền vàng
    add(post, new THREE.BoxGeometry(0.76, 0.06, 0.66), toon('#ffd36e'), 0, 1.54, 0, null);
    add(post, new THREE.BoxGeometry(0.46, 0.08, 0.04), toon('#2a2230'), 0, 1.3, 0.31, null); // khe thư
    add(post, new THREE.BoxGeometry(0.5, 0.04, 0.06), toon('#ffd36e'), 0, 1.36, 0.31, null);
    add(post, new THREE.BoxGeometry(0.46, 0.36, 0.03), toon('#ffffff'), 0, 0.88, 0.31, null); // bảng giờ lấy thư
    for (let i = 0; i < 3; i++) add(post, new THREE.BoxGeometry(0.32 - i * 0.06, 0.03, 0.01), toon('#c9a6b0'), 0, 0.96 - i * 0.08, 0.33, null);
    add(post, new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), toon('#ffd36e'), 0.22, 1.2, 0.32, null).rotation.x = Math.PI / 2; // ổ khoá
    const flagP = add(post, new THREE.BoxGeometry(0.04, 0.5, 0.04), toon('#7a6a8a'), 0.39, 1.45, 0.1, null); flagP.rotation.z = -0.1;
    add(post, new THREE.BoxGeometry(0.03, 0.18, 0.26), toon('#ffd36e'), 0.41, 1.62, 0.2, '#a8742e', 0.008);
    const env = canvasTex(32, 24, d => { d.fillStyle = '#fffaf0'; d.fillRect(0, 0, 32, 24); d.strokeStyle = '#c96a7a'; d.lineWidth = 2; d.strokeRect(1, 1, 30, 22); d.beginPath(); d.moveTo(1, 1); d.lineTo(16, 13); d.lineTo(31, 1); d.stroke(); });
    const em = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), new THREE.MeshBasicMaterial({ map: env })); em.position.set(0, 1.62, 0.36); post.add(em);
    [[0.55, 0.12, 0.2, '#d9b27a'], [0.6, 0.32, 0.05, '#c9e4ff']].forEach(([px, py, pz, col], i) => add(post, new THREE.BoxGeometry(0.34 - i * 0.08, 0.24 - i * 0.06, 0.3 - i * 0.06), toon(col), px, py, pz, '#7a5a3a', 0.01)); // bưu kiện
    kit.hotspot({ id: 'mail', label: _t('Bưu điện'), at: [5.8, 2.1, 2.7], stand: [4.6, 3.6], act: () => c.open.mail() }, post);
    // tháp đồng hồ + sân khấu nhỏ ở giữa dãy nhà phía sau
    const tower = new THREE.Group(); tower.position.set(0, 0, -10); z.add(tower);
    add(tower, new THREE.BoxGeometry(2.0, 6.0, 2.0), toon('#ffe0c9'), 0, 3.0, 0, '#8a6a7a', 0.04);
    add(tower, new THREE.BoxGeometry(2.3, 0.8, 2.3), toon('#e9d2bc'), 0, 0.4, 0, '#8a6a7a', 0.02); // chân tháp
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => add(tower, new THREE.BoxGeometry(0.22, 5.4, 0.22), toon('#fff8ef'), sx * 1.0, 3.3, sz * 1.0, '#8a7a7a', 0.012)); // cột góc
    [2.6, 5.75].forEach(y => add(tower, new THREE.BoxGeometry(2.26, 0.16, 2.26), toon('#fff8ef'), 0, y, 0, '#8a7a7a', 0.012)); // gờ ngang
    add(tower, new THREE.BoxGeometry(0.7, 1.3, 0.08), toon('#a8744a'), 0, 0.85, 1.02, '#5a3a22', 0.015); // cửa
    add(tower, new THREE.CylinderGeometry(0.35, 0.35, 0.08, 14, 1, false, 0, Math.PI), toon('#a8744a'), 0, 1.5, 1.02, null).rotation.x = Math.PI / 2;
    add(tower, new THREE.BoxGeometry(0.5, 0.7, 0.06), toon('#cfeaff'), 0, 3.3, 1.02, '#8a7a7a', 0.012); // cửa sổ
    add(tower, new THREE.BoxGeometry(0.5, 0.04, 0.03), toon('#fff8ef'), 0, 3.3, 1.06, null);
    add(tower, new THREE.TorusGeometry(0.9, 0.08, 8, 28), toon('#d9b27a'), 0, 4.7, 1.0, '#7a5a3a', 0.01); // viền mặt đồng hồ
    add(tower, new THREE.BoxGeometry(2.4, 0.25, 2.4), toon('#d9644a'), 0, 6.08, 0, '#7a3a2a', 0.02); // mái hiên
    for (let i = 0; i < 8; i++) add(tower, new THREE.ConeGeometry(0.1, 0.18, 3), toon('#fff8ef'), -1.05 + i * 0.3, 5.88, 1.21, null).rotation.x = Math.PI;
    add(tower, new THREE.ConeGeometry(1.7, 1.8, 4), toon('#d9644a'), 0, 7.1, 0, '#7a3a2a', 0.04).rotation.y = Math.PI / 4;
    add(tower, new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), toon('#7a6a8a'), 0, 8.3, 0, null);
    add(tower, new THREE.SphereGeometry(0.1, 8, 6), toon('#ffd36e'), 0, 8.1, 0, '#a8742e', 0.008);
    add(tower, new THREE.BoxGeometry(0.02, 0.24, 0.4), toon('#ff9ec4'), 0, 8.55, 0.2, null); // cờ
    const face = canvasTex(128, 128, d => { d.fillStyle = '#fffdf5'; d.beginPath(); d.arc(64, 64, 58, 0, 7); d.fill(); d.strokeStyle = '#7a5a4a'; d.lineWidth = 6; d.stroke(); d.fillStyle = '#7a5a4a'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; d.fillRect(64 + Math.sin(a) * 46 - 3, 64 - Math.cos(a) * 46 - 3, 6, 6); } });
    const faceM = new THREE.Mesh(new THREE.CircleGeometry(0.8, 28), new THREE.MeshBasicMaterial({ map: face })); faceM.position.set(0, 4.7, 1.01); tower.add(faceM);
    const hand = (len, w, col) => { const p = new THREE.Group(); p.userData.keep = true; p.position.set(0, 4.7, 1.04); tower.add(p); const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.03), new THREE.MeshBasicMaterial({ color: col })); m.position.y = len / 2; p.add(m); return p; };
    clockHands = { h: hand(0.45, 0.07, '#5a3a2a'), m: hand(0.68, 0.05, '#5a3a2a') };
    const stage = new THREE.Group(); stage.position.set(0, 0, -7.6); z.add(stage);
    spot = new THREE.Mesh(new THREE.ConeGeometry(1.9, 4.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); spot.position.set(0, 2.4, 0.3); spot.visible = false; stage.add(spot);
    kit.hotspot({ id: 'stage', label: _t('Sân khấu'), at: [0, 3.9, -7.6], stand: [0, -5.3], act: () => performOnStage() }, stage);
    add(stage, new THREE.BoxGeometry(5.4, 0.5, 2.4), toon('#d9b27a'), 0, 0.25, 0, '#8a5f3a', 0.03);
    [-2.5, 2.5].forEach(x => add(stage, new THREE.BoxGeometry(0.14, 2.8, 0.14), toon('#c29a62'), x, 1.9, -0.9, '#8a5f3a', 0.02));
    add(stage, new THREE.BoxGeometry(5.6, 0.25, 0.4), toon('#ff9ec4'), 0, 3.3, -0.9, '#a8507a', 0.02);
    add(stage, new THREE.BoxGeometry(5.0, 2.4, 0.08), toon('#c9a6ff'), 0, 1.75, -1.1, '#6a4aa8', 0.02);
    const drape = canvasTex(64, 64, d => { const gr = d.createLinearGradient(0, 0, 64, 0); for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, i % 2 ? '#c94a6a' : '#e86a8a'); d.fillStyle = gr; d.fillRect(0, 0, 64, 64); }, [1, 1]);
    [-1, 1].forEach(sx => { const cu = add(stage, new THREE.BoxGeometry(0.9, 2.6, 0.12), toon('#ffffff', drape), sx * 2.15, 1.82, -0.75, '#7a2a4a', 0.015); cu.scale.x = 1; add(stage, new THREE.BoxGeometry(0.94, 0.08, 0.16), toon('#ffd36e'), sx * 2.15, 1.4, -0.74, '#a8742e', 0.006); add(stage, new THREE.SphereGeometry(0.07, 8, 6), toon('#ffd36e'), sx * 1.72, 1.4, -0.66, null); }); // rèm hai bên + dây buộc
    for (let i = 0; i < 10; i++) add(stage, new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(i % 2 ? '#e86a8a' : '#c94a6a'), -2.5 + i * 0.555, 3.2, -0.72, null).rotation.x = Math.PI; // diềm rèm
    add(stage, new THREE.BoxGeometry(5.5, 0.08, 2.5), toon('#c29a62'), 0, 0.52, 0, null); // mặt sàn
    for (let i = 0; i < 9; i++) add(stage, new THREE.BoxGeometry(0.04, 0.02, 2.4), toon('#a8844a'), -2.4 + i * 0.6, 0.57, 0, null); // ván sàn
    [0.17, 0.34].forEach((y, i) => add(stage, new THREE.BoxGeometry(1.6, y, 0.34), toon('#d9b27a'), 0, y / 2, 1.37 + (1 - i) * 0.34, '#8a5f3a', 0.012)); // bậc lên
    for (let i = 0; i < 5; i++) { add(stage, new THREE.CylinderGeometry(0.1, 0.12, 0.1, 10), toon('#d9b27a'), -2.0 + i * 1.0, 0.6, 1.05, '#8a5f3a', 0.006); add(stage, new THREE.SphereGeometry(0.07, 8, 6), toon('#ffe9a8'), -2.0 + i * 1.0, 0.7, 1.1, null); } // đèn sân khấu
    [-1.4, 1.4].forEach(x => add(stage, new THREE.OctahedronGeometry(0.22), toon('#ffd36e'), x, 2.6, -1.04, '#a8742e', 0.01)); // sao trang trí
    props.bunting(z, -6.5, -6.3, 6.5, -6.3, 3.4);
    // loa cạnh sân khấu: mini-game Nhảy theo nhịp
    const spk = new THREE.Group(); spk.position.set(3.55, 0, -7.4); spk.rotation.y = -0.3; z.add(spk);
    add(spk, new THREE.BoxGeometry(0.8, 1.3, 0.6), toon('#4a3a5a'), 0, 0.65, 0, '#2a2030', 0.02);
    [0.95, 0.4].forEach((y, i) => { add(spk, new THREE.CylinderGeometry(i ? 0.24 : 0.15, i ? 0.24 : 0.15, 0.04, 18), toon('#2a2030'), 0, y, 0.31, null).rotation.x = Math.PI / 2; add(spk, new THREE.CylinderGeometry(i ? 0.1 : 0.06, i ? 0.1 : 0.06, 0.05, 12), toon('#ffd36e'), 0, y, 0.33, null).rotation.x = Math.PI / 2; });
    const rs = kit.sign(_t('Nhảy theo nhịp'), 1.7, 0.42, '#fff3c4', '#7a3a5a', 36); rs.position.set(0, 1.62, 0.05); spk.add(rs);
    [-0.5, 0.5].forEach(x => add(spk, new THREE.BoxGeometry(0.05, 0.42, 0.05), toon('#7a6a8a'), x, 1.42, -0.02, null));
    for (let i = 0; i < 3; i++) add(spk, new THREE.TorusGeometry(0.16 + i * 0.12, 0.018, 6, 16, Math.PI / 2), toon('#ffd36e'), 0.55, 1.1, 0.1, null).rotation.z = -Math.PI / 4; // sóng nhạc
    kit.hotspot({ id: 'rhythm', label: _t('Nhảy theo nhịp'), at: [3.55, 2.3, -7.4], stand: [4.4, -6.0], act: () => c.open.mini('rhythm') }, spk);
    // chim bồ câu mổ thóc quanh đài, bay đi khi bé lại gần rồi đáp xuống chỗ khác
    for (let i = 0; i < Math.max(3, Math.round(6 * dens)); i++) {
      const p = new THREE.Group(), hx = Math.cos(i * 1.9) * (3.8 + (i % 3)), hz = 3.2 + Math.sin(i * 2.3) * 1.6; p.userData.keep = true; p.position.set(hx, 0, hz); z.add(p);
      const body = add(p, new THREE.SphereGeometry(0.15, 10, 8), toon(i % 2 ? '#cfd8e3' : '#e4d6c8'), 0, 0.17, 0, '#667', 0.015), head = add(p, new THREE.SphereGeometry(0.09, 8, 8), toon('#e4eaf2'), 0.12, 0.3, 0, '#667', 0.015);
      add(p, new THREE.ConeGeometry(0.03, 0.07, 4), toon('#ffb347'), 0.2, 0.29, 0, null).rotation.z = -Math.PI / 2;
      const wing = add(p, new THREE.SphereGeometry(0.11, 8, 6), toon('#b9c4d4'), -0.02, 0.2, 0.1, null); wing.scale.set(1.3, 0.35, 0.8);
      pigeons.push({ g: p, body, head, wing, mode: 'peck', t: Math.random() * 3, x: hx, z: hz, from: [hx, hz], to: [hx, hz], dur: 1.2, wait: 0 });
    }
    // nền xa: đồi, mây
    props.hills(z, -19, [-16, -6, 5, 15]); props.hills(z, 19, [-14, 2, 16]);
    z.userData.clouds = [props.cloud(z, -12, 9, -14, 1.4), props.cloud(z, 8, 11, -16, 1.8), props.cloud(z, 18, 8.5, -12, 1.2)];
  } });

  /* ---------- khu tây: Chợ Xanh, Bệnh viện ---------- */
  const treeSpots = (xs, zs) => xs.flatMap(x => zs.map((zz, j) => ({ x: x + (j % 2) * 0.7, z: zz, s: 0.9 + ((x * 7 + zz * 3) % 5) / 10 })));
  world.zone({ id: 'west', cx: -13, cz: -1, show: 20, build(z) {
    return [
      () => { props.facade(z, { x: -15, z: -10, w: 4.6, h: 3.4, wall: '#ffe9c4', roof: '#d9644a', label: _t('Chợ Xanh'), to: 'market' }); props.facade(z, { x: -8.5, z: -10, w: 4.2, h: 3.2, wall: '#eafaf4', roof: '#6fcfa8', label: _t('Bệnh viện'), to: 'hospital', sign: '#e4f8f0', fg: '#2f6a58' }); },
      () => props.trees(z, treeSpots([-19, -12.5], [-5, 1.5, 7.5]).slice(0, Math.round(6 * dens) || 3)),
      () => { const pts = []; for (let i = 0, n = Math.round(30 * dens); i < n; i++) pts.push({ x: -19 + (i % 10) * 0.7, z: -5.3 + Math.floor(i / 10) * 0.6 }); props.flowers(z, pts); },
      () => { props.fence(z, -20.5, -12, -20.5, 8, 0.8); props.fence(z, -20.5, 8.5, -9, 8.5, 0.8, true); },
      () => { props.lamp(z, -11, -6.2); props.lamp(z, -17.5, -6.2); props.lamp(z, -12, 5.5); props.bunting(z, -17.5, -6.2, -11, -6.2, 3.0); kit.bench(z, -15, 5.8, Math.PI); kit.bench(z, -17.4, 1.2, Math.PI / 2); },
      () => { const tufts = []; for (let i = 0, n = Math.round(60 * dens); i < n; i++) tufts.push({ x: -20 + ((i * 37) % 120) / 10, z: -6 + ((i * 53) % 130) / 10 }); props.tufts(z, tufts); },
      () => { props.cart(z, -10.2, -4.3, { ry: 0.25, label: _t('Bánh mì') }); props.picnic(z, -15.6, -1.6, { ry: 0.2 }); },
      () => { props.kiosk(z, -9.6, 4.6, { ry: 0.55, label: _t('Hoa tươi') }); props.picnic(z, -14.6, 2.9, { ry: -0.15, cloth: '#7ec8ff', umbrella: '#ffd36e' }); },
      () => { [-16.6, -13.4, -12.2, -9.2].forEach((x, i) => props.topiary(z, x, -5.2 - (i % 2) * 0.1, { shape: i % 2 ? 'cone' : 'ball', s: 0.8 })); props.planter(z, -17.8, -2.8, { w: 1.8, ry: Math.PI / 2 }); props.planter(z, -10.6, 7.6, { w: 2.2 }); },
    ];
  } });

  /* ---------- khu đông: Thư viện, Tiệm trà, Tiệm may, cổng Công viên ---------- */
  world.zone({ id: 'east', cx: 13, cz: -1, show: 20, build(z) {
    return [
      () => { props.facade(z, { x: 8.5, z: -10, w: 4.2, h: 3.4, wall: '#e8f2ff', roof: '#6a8ad8', label: _t('Thư viện'), to: 'library', sign: '#eef4ff', fg: '#2f4a7a' }); props.facade(z, { x: 15, z: -10, w: 4.6, h: 3.2, wall: '#fff0d4', roof: '#b8744a', label: _t('Tiệm trà'), to: 'tea' }); },
      () => props.facade(z, { x: 19.5, z: -2.5, ry: -Math.PI / 2, w: 4.0, h: 3.0, wall: '#f1e9ff', roof: '#8a6ac8', label: _t('Tiệm may'), to: 'tailor', sign: '#f6f0ff', fg: '#4a2f7a' }),
      () => { // cổng sang Công viên (mép nam, bên phải)
        const gate = new THREE.Group(); gate.position.set(14, 0, 9.6); z.add(gate);
        [-1.6, 1.6].forEach(x => add(gate, new THREE.BoxGeometry(0.4, 2.8, 0.4), toon('#d9b27a'), x, 1.4, 0, '#8a5f3a', 0.03));
        add(gate, new THREE.BoxGeometry(4.0, 0.5, 0.5), toon('#7edb72'), 0, 3.0, 0, '#3f8a55', 0.03);
        const sg = kit.sign(_t('Công viên →'), 2.2, 0.5, '#e8fbe0', '#2f6a3a', 34); sg.position.set(0, 3.0, 0.28); gate.add(sg);
        kit.hotspot({ id: 'go-park', label: _t('Công viên'), at: [14, 3.9, 9.6], stand: [14, 7.2], act: () => c.goTo('park') }, gate);
      },
      () => props.trees(z, treeSpots([19, 12], [-5, 1.5, 7.5]).slice(0, Math.round(6 * dens) || 3)),
      () => { const pts = []; for (let i = 0, n = Math.round(30 * dens); i < n; i++) pts.push({ x: 9 + (i % 10) * 0.7, z: 6 + Math.floor(i / 10) * 0.6 }); props.flowers(z, pts); },
      () => { props.fence(z, 20.5, 2, 20.5, 8, 0.8); props.fence(z, 9, 9, 12, 9, 0.8, true); props.fence(z, 16, 9, 20.5, 9, 0.8, true); },
      () => { props.lamp(z, 11, -6.2); props.lamp(z, 18, -6.2); props.lamp(z, 11.5, 5.5); props.bunting(z, 11, -6.2, 18, -6.2, 3.0); kit.bench(z, 17, 4.2, -Math.PI / 2); kit.bench(z, 9.5, 2.2, Math.PI); },
      () => { const tufts = []; for (let i = 0, n = Math.round(60 * dens); i < n; i++) tufts.push({ x: 8 + ((i * 41) % 130) / 10, z: -6 + ((i * 59) % 150) / 10 }); props.tufts(z, tufts); },
      () => { props.cart(z, 9.9, -3.9, { ry: -0.3, label: _t('Kem mát'), body: '#bfe8ff', stripe: '#ff9ec4', goods: 'icecream' }); props.picnic(z, 17.4, -1.4, { ry: -0.25, cloth: '#7edb72', umbrella: '#ff9ec4' }); },
      () => { [10.4, 12.2, 16.2, 17.8].forEach((x, i) => props.topiary(z, x, -5.2 - (i % 2) * 0.1, { shape: i % 2 ? 'ball' : 'cone', s: 0.8 })); [12.1, 15.9].forEach(x => props.topiary(z, x, 10.3, { shape: 'ball', s: 0.9 })); props.planter(z, 17.8, 2.6, { w: 1.8, ry: Math.PI / 2 }); },
    ];
  } });
  // cây rải ở bờ nam và hai bên (khu lõi để nhẹ: chỉ vài cây)
  world.zone({ id: 'south', cx: 0, cz: 11, show: 18, build(z) { return [() => props.trees(z, [{ x: -8, z: 12, s: 1.2 }, { x: -3, z: 13, s: 1.0 }, { x: 4, z: 12.5, s: 1.1 }, { x: 9, z: 13, s: 0.95 }].slice(0, Math.round(4 * dens) || 2)), () => props.fence(z, -20, 14.5, 20, 14.5, 0.8, true)]; } });

  let decor = { theme: null, group: null };
  function applyDecor() {
    const th = (c.events && c.events.decor()) || (c.festivalTheme && c.festivalTheme()) || null;
    if (th === decor.theme) return;
    if (decor.group) { g.remove(decor.group); decor.group = null; }
    decor.theme = th; if (th) { decor.group = festival(c, th); g.add(decor.group); }
  }
  const core = g.children.find(o => o.userData.clouds);
  return {
    group: g,
    enter() { applyDecor(); kit.show(true); shared.enter(); setTimeout(() => { if (c.getArea() === 'plaza') c.say(_t('Quảng trường rộng ghê! Đi dạo và chào mọi người nhé.'), 3200); }, 900); },
    leave() { kit.show(false); shared.leave(); },
    update(dt, now) {
      kit.tick(now); const t = now / 1000, [px, pz] = c.getPetXZ();
      world.update(px, pz);
      jetBoost = Math.max(0, jetBoost - dt * 0.28);
      jets.forEach(j => { const ph = (t * (1.4 + jetBoost) + j.userData.i / 8) % 1, a = j.userData.i * Math.PI / 4, r = 1.0 + jetBoost * 0.9; j.position.set(Math.cos(a) * ph * r, 2.2 + Math.sin(ph * Math.PI) * (0.8 + jetBoost * 1.1), Math.sin(a) * ph * r); });
      if (spot) { const on = performance.now() < spotUntil; spot.visible = on; if (on) spot.material.color.setHSL((t * 0.4) % 1, 0.7, 0.75); }
      const asleep = c.isNight ? c.isNight() : false; // ban đêm chim rúc đầu ngủ, chỉ giật mình khi bé tới rất gần
      pigeons.forEach(b => { // chim: mổ thóc -> bay đi khi bé tới gần -> đáp xuống chỗ khác
        if (b.mode === 'peck') {
          if (asleep) { b.head.position.set(0.02, 0.2, 0); b.body.scale.y = 0.85 + Math.sin(t * 1.6 + b.t * 3) * 0.04; } else { b.body.scale.y = 1; b.head.position.y = 0.3 - Math.max(0, Math.sin(t * 6 + b.t * 7)) * 0.1; b.head.position.x = 0.12 + Math.max(0, Math.sin(t * 6 + b.t * 7)) * 0.06; }
          if (Math.hypot(b.g.position.x - px, b.g.position.z - pz) < (asleep ? 1.1 : 2.3)) { b.mode = 'fly'; c.sfx('flap'); b.t = 0; b.from = [b.g.position.x, b.g.position.z]; const a = Math.atan2(b.g.position.z - pz, b.g.position.x - px) + (Math.random() - 0.5) * 1.2, dd = 5 + Math.random() * 3; b.to = [Math.max(-14, Math.min(14, b.from[0] + Math.cos(a) * dd)), Math.max(-5, Math.min(7, b.from[1] + Math.sin(a) * dd))]; if (Math.hypot(b.to[0], b.to[1] + 0.6) < 3.2) b.to[1] += 3; b.dur = 1.3 + Math.random() * 0.5; b.g.rotation.y = -Math.atan2(b.to[1] - b.from[1], b.to[0] - b.from[0]); }
        } else if (b.mode === 'fly') {
          b.t += dt; const k = Math.min(1, b.t / b.dur); b.g.position.set(lerp(b.from[0], b.to[0], k), Math.sin(k * Math.PI) * 1.6 + 0.0, lerp(b.from[1], b.to[1], k)); b.wing.rotation.z = Math.sin(t * 40) * 0.9; b.wing.scale.y = 0.35 + Math.abs(Math.sin(t * 40)) * 1.1;
          if (k >= 1) { b.mode = 'wait'; b.wait = 1.5 + Math.random() * 2.5; b.wing.rotation.z = 0; b.wing.scale.y = 0.35; }
        } else { b.wait -= dt; if (b.wait <= 0) b.mode = 'peck'; }
      });
      if (waterMesh) waterMesh.material.map.offset.set(Math.sin(t * 0.3) * 0.04, t * 0.02);
      if (clockHands) { const d = new Date(); clockHands.m.rotation.z = -(d.getMinutes() + d.getSeconds() / 60) * Math.PI / 30; clockHands.h.rotation.z = -((d.getHours() % 12) + d.getMinutes() / 60) * Math.PI / 6; }
      const cl = (core || g.children[0]).userData.clouds; if (cl) cl.forEach((m, i) => { m.position.x += dt * (0.25 + i * 0.1); if (m.position.x > 26) m.position.x = -26; });
      const night = c.isNight ? c.isNight() : false; props.night(night); fireflies(t, night);
      shared.update(dt, now);
    },
    tap: e => shared.tap(e) || kit.tap(e), sync() {},
    world,
  };
}
