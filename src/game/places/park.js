// Công viên "Cỏ Non" (~40×28, rộng, camera bám thú): nơi chung (shared.js). Khu lõi: đồng cỏ, lối đi vòng, cây lớn, vườn hoa, khăn dã ngoại, bóng chung.
// Khu tây: ao có cầu và vịt (cho vịt ăn). Khu đông: sân chơi (xích đu, bập bênh, cầu trượt, hố cát). Khu bắc: lùm cây và vòm nghỉ chân. Cổng về Quảng trường ở mép tây.
// Đồ chơi dùng play_toy (ducks, swing, seesaw, slide). Chi tiết dựng/ẩn theo khu: xem world.js.
import { makeKit } from './kit.js';
import { makeShared } from './shared.js';
import { makeFireflies, makeProps, makeWorld } from './world.js';

export function initPark(c) {
  const { THREE, add, toon, canvasTex, scene } = c, kit = makeKit(c, { cull: true });
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const world = makeWorld(c, g), props = makeProps({ THREE, add, toon, canvasTex, kit, world });
  const shared = makeShared(c, { placeId: 'park', group: g });
  const grass = canvasTex(128, 128, d => { d.fillStyle = '#b6e89a'; d.fillRect(0, 0, 128, 128); d.fillStyle = '#9ed97e'; for (let i = 0; i < 50; i++) d.fillRect((i * 41) % 128, (i * 59) % 128, 3, 7); d.fillStyle = '#fff6b0'; for (let i = 0; i < 6; i++) d.fillRect((i * 67) % 128, (i * 43) % 128, 3, 3); }, [14, 10]);
  const pathTex = canvasTex(64, 64, d => { d.fillStyle = '#f3e3c3'; d.fillRect(0, 0, 64, 64); d.fillStyle = '#e4cfa6'; for (let i = 0; i < 14; i++) d.fillRect((i * 23) % 64, (i * 37) % 64, 4, 3); }, [10, 1]);
  const dens = world.density();
  const fireflies = makeFireflies(THREE, g, { x0: -16, x1: 16, z0: -6, z1: 8 }, Math.round(20 * dens));
  let mill = null, kite = null, seats = [], plank = null, ducks = [], pondMat = null, butterflies = [], slideBall = null, ball = null, ballV = null, slideGrp = null, swingTurn = 0, duckUntil = 0, duckAtt = 0, ballCd = 0;
  const ease = u => u * u * (3 - 2 * u), lerp = (a, b, k) => a + (b - a) * k, clamp01 = u => Math.max(0, Math.min(1, u));
  const arc = (a, b, k, h) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k) + Math.sin(k * Math.PI) * h, lerp(a[2], b[2], k)];

  /* ---------- tương tác: thú chơi thật trên đồ chơi (kịch bản chuyển động + phản ứng của đồ vật) ---------- */
  function rideSwing() { // nhảy lên ghế xích đu, đưa dần lên cao rồi nhảy xuống
    const s = seats[swingTurn++ % seats.length], sw = s.parent, bx = sw.position.x + s.position.x, bz = sw.position.z, [fx, fz] = c.getPetXZ(), L = 1.6, A = 0.62, T0 = 0.14, T1 = 0.86; let lastS = 0;
    c.sfx('boing');
    return c.script({ onStart: () => shared.sendAct('swing'), dur: 7, noWalk: true, update: (u, t) => {
      const th = Math.sin(t * 2.4) * A * (u < T0 ? 0 : u > T1 ? clamp01((1 - u) / (1 - T1)) : clamp01((u - T0) / 0.25));
      s.userData.ride = th; if (Math.abs(th) > 0.3 && Math.sign(th) !== lastS) { lastS = Math.sign(th); c.sfx('creak'); }
      const seat = [bx + L * Math.sin(th), 2.5 - L * Math.cos(th) + 0.04, bz];
      if (u < T0) { const k = ease(u / T0); return { pos: arc([fx, 0, fz], [bx, 0.9, bz], k, 0.7), stretch: Math.sin(k * Math.PI) * 0.12 }; }
      if (u > T1) { const k = ease((u - T1) / (1 - T1)); return { pos: arc(seat, [bx, 0, bz + 1.8], k, 0.5), stretch: Math.sin(k * Math.PI) * 0.1 }; }
      return { pos: seat, roll: th * 0.5, face: 0 };
    }, done: () => { s.userData.ride = null; c.sfx('thud'); } });
  }
  function rideSeesaw() { // ngồi đầu bập bênh, bập bênh lên xuống theo bé
    const see = plank.parent, cx = see.position.x, cz = see.position.z, ex = -1.15, [fx, fz] = c.getPetXZ(); let lastS = 0;
    c.sfx('boing');
    return c.script({ onStart: () => shared.sendAct('seesaw'), dur: 6, noWalk: true, update: (u, t) => {
      const th = Math.sin(t * 2.2) * 0.24 * (u < 0.15 ? 0 : u > 0.85 ? (1 - u) / 0.15 : clamp01((u - 0.15) / 0.15)); plank.userData.ride = th; if (Math.abs(th) > 0.2 && Math.sign(th) !== lastS) { lastS = Math.sign(th); c.sfx(th < 0 ? 'thud' : 'boing'); }
      const end = [cx + ex * Math.cos(th), 0.64 + ex * Math.sin(th), cz];
      if (u < 0.15) return { pos: arc([fx, 0, fz], [cx + ex, 0.64, cz], ease(u / 0.15), 0.6) };
      if (u > 0.85) return { pos: arc(end, [cx + ex, 0, cz + 1.4], ease((u - 0.85) / 0.15), 0.5) };
      return { pos: end, roll: -th * 0.5, face: 0, stretch: th > 0.1 ? 0.06 : 0 };
    }, done: () => { plank.userData.ride = null; } });
  }
  function rideSlide() { // leo thang, ngồi trên đỉnh, trượt xuống ngã vào bãi cỏ
    const p = slideGrp.position, [fx, fz] = c.getPetXZ(), foot = [p.x, 0, p.z - 1.1], top = [p.x, 2.0, p.z - 0.05], rampTop = [p.x, 1.8, p.z + 0.5], rampEnd = [p.x, 0.2, p.z + 2.7], out = [p.x, 0, p.z + 3.4]; let phase = 0;
    return c.script({ onStart: () => shared.sendAct('slide'), dur: 5.6, update: u => {
      if (phase < 1 && u >= 0.52) { phase = 1; c.sfx('whee'); } else if (phase < 2 && u >= 0.78) { phase = 2; c.sfx('thud'); }
      if (u < 0.12) return { pos: arc([fx, 0, fz], foot, ease(u / 0.12), 0.2) };
      if (u < 0.42) { const k = (u - 0.12) / 0.3; return { pos: [foot[0], lerp(0, top[1], k) + Math.abs(Math.sin(k * 14)) * 0.1, lerp(foot[2], top[2], k)], face: Math.PI }; }
      if (u < 0.52) return { pos: [top[0], top[1] + Math.sin((u - 0.42) / 0.1 * Math.PI) * 0.12, top[2] + (u - 0.42) * 1.5], stretch: -0.1 * Math.sin((u - 0.42) / 0.1 * Math.PI), face: 0 };
      if (u < 0.74) { const k = ease((u - 0.52) / 0.22); return { pos: [rampTop[0], lerp(rampTop[1], rampEnd[1], k * k), lerp(rampTop[2], rampEnd[2], k)], roll: -0.35, stretch: 0.08, face: 0 }; }
      if (u < 0.84) { const k = (u - 0.74) / 0.1; return { pos: arc(rampEnd, out, ease(k), 0.45), spin: k * Math.PI * 2, face: 0 }; }
      return { pos: out, stretch: Math.sin((u - 0.84) / 0.16 * Math.PI) * 0.08, face: 0 };
    } });
  }
  function feedDucks() { // ngồi xổm bên ao tung vụn bánh, vịt bơi lại
    const pond = ducks[0] && ducks[0].d.parent; duckUntil = performance.now() + 7000; let nextCrumb = 0, nextQuack = 0.9;
    return c.script({ onStart: () => shared.sendAct('ducks'), dur: 4.6, noWalk: true, update: (u, t) => {
      if (t > nextQuack && u < 0.9) { nextQuack = t + 0.7 + Math.random() * 0.5; c.sfx('quack'); }
      if (t > nextCrumb) { nextCrumb = t + 0.32; const [px, pz] = c.getPetXZ(); c.spawnAt('crumb', px - 0.35, 0.75, pz - 0.1, { vx: -1.6 - Math.random(), vy: 2.2, g: 6, scale: 0.16, max: 0.9 }); }
      return { stretch: -0.12 * Math.min(1, Math.sin(Math.min(1, u * 8) * Math.PI / 2)) * (u > 0.9 ? (1 - u) / 0.1 : 1), roll: Math.sin(t * 6) * 0.03, face: Math.PI * 0.8, _pond: pond };
    } });
  }
  function kickBall() { // chạy tới đá bóng, bóng nảy và lăn đi, bé đuổi theo nhặt lại
    if (!ball) return Promise.resolve(false);
    const [fx, fz] = c.getPetXZ(), bp = ball.position, spot = [bp.x + 0.55, 0, bp.z + 0.35]; let kicked = false;
    return c.script({ onStart: () => shared.sendAct('ball'), dur: 1.5, update: u => {
      if (u < 0.45) return { pos: arc([fx, 0, fz], spot, ease(u / 0.45), 0.15), stretch: -0.1 * Math.sin(u / 0.45 * Math.PI / 2), face: -Math.PI / 2 };
      if (!kicked) { kicked = true; c.sfx('kick'); ballV = { vx: -2.2 - Math.random() * 1.3, vy: 3.4, vz: -1.8 - Math.random() * 1.6 }; c.spawnAt('sparkle', bp.x, 0.5, bp.z, { vy: 1, scale: 0.4, max: 0.5 }); }
      const k = (u - 0.45) / 0.55; return { pos: [spot[0] - 0.2 * Math.sin(Math.min(1, k * 2) * Math.PI), Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.25, spot[2]], stretch: 0.1 * Math.sin(k * Math.PI), roll: 0.12 * Math.sin(k * Math.PI), face: -Math.PI / 2 };
    }, done: () => { setTimeout(() => { if (c.getArea() === 'park' && ball) c.walkPetTo(ball.position.x + 0.6, ball.position.z + 0.5).then(ok => { if (ok) c.say('Lấy lại được rồi nè!', 1800); }); }, 2600); } });
  }

  /* ---------- mini-game Bắt bướm ngay trong công viên: bướm bay quanh bé, chạm vào bướm để bé nhảy tới bắt ---------- */
  let catchGame = null;
  const WING = ['#ff9ec4', '#ffd36e', '#c9a6ff', '#7ec8ff', '#ff9a76'];
  function makeCatchButterfly(i) {
    const grp = new THREE.Group(), col = WING[i % WING.length];
    const wingGeo = new THREE.CircleGeometry(0.3, 14); wingGeo.scale(1, 0.8, 1);
    const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }), edge = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    const wings = [-1, 1].map(sd => { const w = new THREE.Group(); const o = new THREE.Mesh(wingGeo, edge); o.scale.setScalar(1.14); o.position.z = -0.002; const m = new THREE.Mesh(wingGeo, mat); const dot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), edge); dot.position.set(sd * 0.04, 0.03, 0.002); w.add(o, m, dot); w.position.x = sd * 0.02; m.position.x = o.position.x = sd * 0.26; dot.position.x = sd * 0.26; grp.add(w); return w; });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.3, 4, 8), new THREE.MeshBasicMaterial({ color: '#5a3a4a' })); grp.add(body); grp.scale.setScalar(1.5);
    grp.userData = { wings, ph: Math.random() * 6, a: Math.random() * 6.28, sp: 0.7 + Math.random() * 0.5, turn: 0, col };
    return grp;
  }
  function startCatch(o) { // o: { seconds, target, count, onCatch(n), onEnd(n, aborted) }
    if (catchGame) stopCatch(true);
    const list = Array.from({ length: o.count }, (_, i) => makeCatchButterfly(i)), st = catchGame = { o, list, caught: 0, t0: performance.now(), done: false };
    const [px, pz] = c.getPetXZ();
    list.forEach((b, i) => { b.position.set(px + (Math.random() - 0.5) * 9, 1 + Math.random() * 1.6, pz - 1 - Math.random() * 3.5); b.userData.i = i; g.add(b); });
    return { stop: () => stopCatch(true), state: () => ({ caught: st.caught, bs: list.map(b => screenOf(b)) }) };
  }
  function stopCatch(aborted) {
    const st = catchGame; if (!st) return; catchGame = null;
    st.list.forEach(b => { g.remove(b); b.traverse(m => { if (m.geometry) m.geometry.dispose(); }); });
    st.o.onEnd(st.caught, !!aborted);
  }
  const _v = new THREE.Vector3();
  function screenOf(b) { b.getWorldPosition(_v); _v.project(c.camera); const r = c.canvas.getBoundingClientRect(); return [r.left + (_v.x + 1) / 2 * r.width, r.top + (1 - _v.y) / 2 * r.height]; }
  /** Chạm khi đang chơi: tìm bướm gần điểm chạm nhất trên màn hình (bán kính ~46px); trúng thì bé nhảy tới bắt. Luôn nuốt cú chạm. */
  function catchTap(e) {
    const st = catchGame; if (!st || st.done) return false;
    let hit = -1, best = 46 * 46;
    st.list.forEach((b, i) => { const [x, y] = screenOf(b), d = (x - e.clientX) ** 2 + (y - e.clientY) ** 2; if (d < best) { best = d; hit = i; } });
    if (hit < 0) { c.sfx('miss'); return true; }
    const b = st.list[hit], bx = b.position.x, bz = b.position.z; st.caught++; c.sfx('catch'); c.spawnAt('sparkle', bx, b.position.y, bz, { vy: 0.8, scale: 0.5, max: 0.7 }); for (let k = 0; k < 4; k++) c.spawnAt('sparkle', bx + (Math.random() - 0.5) * 0.6, b.position.y + (Math.random() - 0.5) * 0.4, bz, { vy: 0.5 + Math.random(), scale: 0.28, max: 0.8 });
    c.walkPetTo(Math.max(-16, Math.min(16, bx)), Math.max(-6, Math.min(7.5, bz + 0.6))); c.startAction('hop');
    b.position.set(bx + (Math.random() < 0.5 ? -9 : 9), 1 + Math.random() * 1.6, bz + (Math.random() - 0.5) * 3); b.userData.a = Math.random() * 6.28; // bướm mới bay vào từ mép
    st.o.onCatch(st.caught);
    if (st.caught >= st.o.target) { st.done = true; setTimeout(() => stopCatch(false), 500); }
    return true;
  }
  function updateCatch(dt, now, px, pz) {
    const st = catchGame; if (!st) return;
    if (!st.done && (now - st.t0) / 1000 >= st.o.seconds) { st.done = true; stopCatch(false); return; }
    const t = now / 1000, slow = c.reduce ? 0.55 : 1;
    for (const b of st.list) {
      const u = b.userData; u.turn -= dt; if (u.turn <= 0) { u.turn = 0.6 + Math.random() * 1.2; u.a += (Math.random() - 0.5) * 2.2; }
      let vx = Math.cos(u.a) * u.sp * 1.6 * slow, vz = Math.sin(u.a) * u.sp * 1.1 * slow;
      // giữ bướm trong tầm nhìn quanh bé
      if (b.position.x < px - 7) vx = Math.abs(vx) + 0.6; if (b.position.x > px + 7) vx = -Math.abs(vx) - 0.6;
      if (b.position.z < pz - 5) vz = Math.abs(vz) + 0.4; if (b.position.z > pz + 1.5) vz = -Math.abs(vz) - 0.4;
      b.position.x += vx * dt; b.position.z += vz * dt; b.position.y = 1.5 + Math.sin(t * 1.6 + u.ph) * 0.55 + Math.sin(t * 0.7 + u.ph * 2) * 0.25;
      b.quaternion.copy(c.camera.quaternion); b.rotateZ(Math.max(-0.5, Math.min(0.5, -vx * 0.12))); // luôn quay mặt về phía người chơi để dễ thấy và dễ chạm
      const f = c.reduce ? 0.8 : 0.35 + Math.abs(Math.sin(t * 16 + u.ph)) * 0.65; u.wings[0].scale.x = u.wings[1].scale.x = f; // vỗ cánh
    }
  }

  world.zone({ id: 'core', core: true, cx: 0, cz: 0, build(z) {
    add(z, new THREE.BoxGeometry(46, 0.4, 32), toon('#ffffff', grass), 0, -0.2, 0, '#6aa05a', 0.03);
    // lối đi vòng quanh đồng cỏ
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.2, 6.4, 48), new THREE.MeshToonMaterial({ color: '#f3e3c3', gradientMap: c.grad })); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.03, 0.8); ring.scale.y = 0.8; z.add(ring);
    add(z, new THREE.BoxGeometry(34, 0.08, 1.6), toon('#ffffff', pathTex), 0, 0.03, 6.8, null);
    // cây lớn giữa đồng cỏ
    props.trees(z, [{ x: 0, z: -1.5, s: 1.9 }, { x: -3.4, z: -3.4, s: 1.2 }, { x: 3.6, z: -3.2, s: 1.1 }]);
    kit.bench(z, -2.6, 2.6, 0.3); kit.bench(z, 2.6, 2.6, -0.3);
    // vườn hoa
    const bed = new THREE.Group(); bed.position.set(-1.2, 0, -5.0); z.add(bed);
    add(bed, new THREE.BoxGeometry(3.6, 0.2, 0.9), toon('#b98a5e'), 0, 0.1, 0, '#6a4a3a', 0.02);
    const fl = []; for (let i = 0; i < Math.round(18 * dens); i++) fl.push({ x: -1.2 - 1.6 + (i % 9) * 0.4, z: -5.0 + (i < 9 ? -0.15 : 0.15) }); props.flowers(z, fl);
    // khăn dã ngoại + giỏ
    const pic = new THREE.Group(); pic.position.set(2.2, 0, 4.0); z.add(pic);
    const check = canvasTex(32, 32, d => { d.fillStyle = '#ffffff'; d.fillRect(0, 0, 32, 32); d.fillStyle = 'rgba(255,120,170,.7)'; for (let i = 0; i < 4; i++) { d.fillRect(i * 8, 0, 4, 32); d.fillRect(0, i * 8, 32, 4); } }, [3, 2]);
    add(pic, new THREE.BoxGeometry(2.0, 0.04, 1.5), toon('#ffffff', check), 0, 0.04, 0, '#a8507a', 0.02);
    [[-0.3, -0.35], [0.1, 0.45]].forEach(([px, pz]) => { add(pic, new THREE.CylinderGeometry(0.2, 0.17, 0.03, 16), toon('#ffffff'), px, 0.08, pz, '#9a9aaa', 0.006); add(pic, new THREE.SphereGeometry(0.08, 8, 6), toon('#ffcf8a'), px, 0.13, pz, null); });
    add(pic, new THREE.CylinderGeometry(0.06, 0.06, 0.24, 10), toon('#bfe8ff'), -0.75, 0.16, -0.45, '#4a7a9a', 0.006); add(pic, new THREE.TorusGeometry(0.14, 0.025, 6, 12, Math.PI), toon('#a8744a'), 0.4, 0.45, 0, null);
    add(pic, new THREE.BoxGeometry(0.7, 0.4, 0.5), toon('#d9b27a'), 0.4, 0.25, 0, '#8a5f3a', 0.02); add(pic, new THREE.SphereGeometry(0.16, 10, 8), toon('#ff6a6a'), -0.5, 0.18, 0.2, '#a83a3a', 0.02);
    // bóng chung
    ball = add(z, new THREE.SphereGeometry(0.28, 14, 10), toon('#ff6a8a'), -1.4, 0.28, 1.8, '#a83a4a', 0.02);
    add(ball, new THREE.TorusGeometry(0.28, 0.025, 6, 20), toon('#ffffff'), 0, 0, 0, null);
    kit.hotspot({ id: 'catch', label: 'Bắt bướm', at: [2.2, 1.4, 4.0], stand: [1.0, 5.0], act: () => c.open.mini('butterfly') }, pic);
    kit.hotspot({ id: 'ball', label: 'Bóng chung', at: [-1.4, 1.1, 1.8], stand: [-0.7, 2.2], act: () => { c.say('Đá bóng nào! Ai chơi cùng không?', 2200); kickBall(); } }, ball);
    props.lamp(z, -5, 5.2); props.lamp(z, 5, 5.2);
    // cổng về Quảng trường (mép tây) + bướm
    const gate = new THREE.Group(); gate.position.set(-17.5, 0, 4.5); gate.rotation.y = Math.PI / 2; z.add(gate);
    [-1.6, 1.6].forEach(x => add(gate, new THREE.BoxGeometry(0.4, 2.8, 0.4), toon('#d9b27a'), x, 1.4, 0, '#8a5f3a', 0.03));
    add(gate, new THREE.BoxGeometry(4.0, 0.5, 0.5), toon('#ffb3c9'), 0, 3.0, 0, '#a8507a', 0.03);
    const sg = kit.sign('← Quảng trường', 2.4, 0.5, '#fff0f6', '#8a3a5a', 30); sg.position.set(0, 3.0, 0.28); gate.add(sg);
    kit.hotspot({ id: 'go-plaza', label: 'Quảng trường', at: [-17.5, 3.9, 4.5], stand: [-15.5, 4.5], act: () => c.goTo('plaza') }, gate);
    butterflies = Array.from({ length: Math.round(6 * dens) }, (_, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshBasicMaterial({ color: ['#ff9ec4', '#ffd36e', '#c9a6ff'][i % 3], side: THREE.DoubleSide })); m.userData = { ph: i * 1.3, cx: -8 + i * 3, cz: -2 + (i % 3) * 2 }; z.add(m); return m; });
    { // diều bay trên trời phía bắc, dây buộc vào cọc sau lùm cây
      add(z, new THREE.CylinderGeometry(0.05, 0.06, 0.6, 6), toon('#a8744a'), -7.5, 0.3, -7.6, null);
      kite = new THREE.Group(); kite.position.set(-10, 8.2, -15); z.add(kite);
      const kg = new THREE.Shape(); kg.moveTo(0, 0.7); kg.lineTo(0.45, 0); kg.lineTo(0, -0.9); kg.lineTo(-0.45, 0); kg.lineTo(0, 0.7);
      const km = add(kite, new THREE.ShapeGeometry(kg), toon('#ff7a9a'), 0, 0, 0, null); km.material.side = THREE.DoubleSide;
      add(kite, new THREE.BoxGeometry(0.02, 1.6, 0.02), toon('#ffffff'), 0, -0.1, 0.01, null); add(kite, new THREE.BoxGeometry(0.9, 0.02, 0.02), toon('#ffffff'), 0, 0, 0.01, null);
      for (let i = 0; i < 4; i++) add(kite, new THREE.BoxGeometry(0.16, 0.08, 0.02), toon(['#ffd36e', '#7ec8ff', '#c9a6ff', '#7edb72'][i]), Math.sin(i) * 0.1, -1.0 - i * 0.28, 0, null);
      const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector3(lerp(-7.5, -10, k), lerp(0.6, 7.6, k) - Math.sin(k * Math.PI) * 1.2, lerp(-7.6, -15, k))); }
      z.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffffff' })));
    }
    props.hills(z, -17, [-15, -5, 6, 16]); props.hills(z, 17, [-12, 4, 15]);
    z.userData.clouds = [props.cloud(z, -10, 9, -13, 1.5), props.cloud(z, 10, 10.5, -15, 1.9)];
  } });

  // ao + cầu + vịt (tây)
  world.zone({ id: 'pond', cx: -12, cz: -2, show: 19, build(z) {
    return [
      () => {
        const pond = new THREE.Group(); pond.position.set(-12, 0, -2.4); z.add(pond);
        pondMat = toon('#8ed6ff'); const wtr = add(pond, new THREE.CylinderGeometry(3.4, 3.4, 0.06, 40), pondMat, 0, 0.03, 0, '#4a90c0', 0.03); wtr.scale.z = 0.7;
        const rim = add(pond, new THREE.TorusGeometry(3.4, 0.14, 8, 40), toon('#d9d2c4'), 0, 0.07, 0, '#8a8478', 0.02); rim.rotation.x = Math.PI / 2; rim.scale.y = 0.7;
        // cầu gỗ bắc qua ao
        const br = new THREE.Group(); br.position.set(0, 0.28, 0); pond.add(br);
        add(br, new THREE.BoxGeometry(4.4, 0.14, 1.0), toon('#c29a62'), 0, 0.32, 0, '#8a5f3a', 0.02).rotation.z = 0;
        [-2.0, 2.0].forEach(x => { add(br, new THREE.BoxGeometry(0.12, 0.7, 0.12), toon('#a8744a'), x, 0.3, 0.45, '#5a3a22', 0.015); add(br, new THREE.BoxGeometry(0.12, 0.7, 0.12), toon('#a8744a'), x, 0.3, -0.45, '#5a3a22', 0.015); });
        add(br, new THREE.BoxGeometry(4.2, 0.07, 0.06), toon('#a8744a'), 0, 0.62, 0.45, '#5a3a22', 0.01); add(br, new THREE.BoxGeometry(4.2, 0.07, 0.06), toon('#a8744a'), 0, 0.62, -0.45, '#5a3a22', 0.01);
        ducks = [[-1.6, 0.5], [1.4, -0.6], [0.2, 1.0]].map(([x, zz], i) => { const d = new THREE.Group(); d.position.set(x, 0.1, zz); pond.add(d); add(d, new THREE.SphereGeometry(0.22, 12, 10), toon('#fff3a0'), 0, 0.16, 0, '#c9a84a', 0.02); add(d, new THREE.SphereGeometry(0.14, 10, 8), toon('#fff3a0'), 0.18, 0.34, 0, '#c9a84a', 0.02); add(d, new THREE.ConeGeometry(0.05, 0.12, 6), toon('#ff9f3a'), 0.34, 0.33, 0, null).rotation.z = -Math.PI / 2; return { d, ph: i * 2, x, z: zz }; });
        ducks.forEach(({ d }) => { add(d, new THREE.SphereGeometry(0.13, 8, 6), toon('#ffe680'), -0.02, 0.2, 0.15, null).scale.set(1.3, 0.5, 0.5); add(d, new THREE.SphereGeometry(0.13, 8, 6), toon('#ffe680'), -0.02, 0.2, -0.15, null).scale.set(1.3, 0.5, 0.5); add(d, new THREE.ConeGeometry(0.08, 0.16, 5), toon('#fff3a0'), -0.24, 0.24, 0, null).rotation.z = 1.2; [-0.05, 0.05].forEach(e => add(d, new THREE.SphereGeometry(0.025, 6, 5), toon('#2a2230'), 0.28, 0.39, e * 1.6, null)); });
        for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.4, r = 1.6 + (i % 3) * 0.55, lp = add(pond, new THREE.CircleGeometry(0.26 + (i % 2) * 0.08, 12, 0.3, Math.PI * 2 - 0.6), toon('#6fcf6a'), Math.cos(a) * r, 0.075, Math.sin(a) * r * 0.65, null); lp.rotation.x = -Math.PI / 2; lp.rotation.z = a; if (i % 3 === 0) add(pond, new THREE.SphereGeometry(0.07, 8, 6), toon('#ffb3d1'), Math.cos(a) * r, 0.12, Math.sin(a) * r * 0.65, null); }
        for (let i = 0; i < 12; i++) { const a = Math.PI * 0.55 + i * 0.09 + (i % 2) * 0.03, r = 3.2 + (i % 3) * 0.12, x = Math.cos(a) * r, zz = Math.sin(a) * r * 0.7, h = 0.7 + (i % 4) * 0.15; add(pond, new THREE.CylinderGeometry(0.02, 0.025, h, 4), toon('#6faa5a'), x, h / 2, zz, null); if (i % 2 === 0) add(pond, new THREE.CapsuleGeometry(0.045, 0.16, 3, 6), toon('#a8744a'), x, h + 0.05, zz, null); }
        for (let i = 0; i < 9; i++) add(br, new THREE.BoxGeometry(0.03, 0.02, 0.98), toon('#a8844a'), -2.0 + i * 0.5, 0.4, 0, null); // ván cầu
        [-1, 0, 1].forEach(x => { add(br, new THREE.BoxGeometry(0.1, 0.35, 0.1), toon('#a8744a'), x, 0.55, 0.45, null); add(br, new THREE.BoxGeometry(0.1, 0.35, 0.1), toon('#a8744a'), x, 0.55, -0.45, null); });
        [-2.0, 2.0].forEach(x => [0.45, -0.45].forEach(zz => add(br, new THREE.SphereGeometry(0.08, 8, 6), toon('#ffd36e'), x, 0.7, zz, null)));
        const dock = new THREE.Group(); dock.position.set(-13.6, 0, 0.1); z.add(dock); // bến câu cá nhỏ ở bờ nam
        add(dock, new THREE.BoxGeometry(1.4, 0.1, 1.1), toon('#c29a62'), 0, 0.22, -0.2, '#8a5f3a', 0.015);
        [[-0.6, 0.25], [0.6, 0.25], [-0.6, -0.65], [0.6, -0.65]].forEach(([x, zz]) => add(dock, new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), toon('#a8744a'), x, 0.1, zz, null));
        const rod = add(dock, new THREE.CylinderGeometry(0.02, 0.03, 1.8, 6), toon('#7a5a3a'), 0.25, 0.9, -0.5, null); rod.rotation.x = -0.75;
        add(dock, new THREE.SphereGeometry(0.06, 8, 6), toon('#ff5a5a'), 0.25, 0.08, -1.55, null);
        add(dock, new THREE.CylinderGeometry(0.17, 0.14, 0.26, 12), toon('#6ab7ff'), -0.4, 0.4, 0.1, '#356a9a', 0.01);
        kit.hotspot({ id: 'fish', label: 'Câu cá', at: [-13.6, 1.6, 0.1], stand: [-13.6, 1.3], act: () => c.open.mini('fish') }, dock);
        kit.hotspot({ id: 'duck', label: 'Cho vịt ăn', at: [-12, 1.9, -2.4], stand: [-8.4, -0.6], act: () => { if (c.playToy('ducks')) { c.spawn('sparkle', 4, 0.8); feedDucks(); } } }, pond);
      },
      () => { const rocks = []; for (let i = 0; i < Math.round(10 * dens); i++) { const a = i * 0.63; rocks.push({ x: -12 + Math.cos(a) * 3.9, z: -2.4 + Math.sin(a) * 2.8, y: 0.12, s: 0.18 + (i % 3) * 0.08, color: '#c9c2b4' }); } world.scatter(z, world.geo('rock', () => new THREE.DodecahedronGeometry(1, 0)), world.toonC('#ffffff'), rocks, '#7a7468', 0.02); },
      () => props.trees(z, [{ x: -17, z: -6, s: 1.3 }, { x: -16.5, z: 0.5, s: 1.1 }, { x: -9, z: -7.2, s: 1.15 }].slice(0, Math.round(3 * dens) || 2)),
      () => { const p = []; for (let i = 0; i < Math.round(26 * dens); i++) p.push({ x: -17 + (i % 13) * 0.55, z: 2 + Math.floor(i / 13) * 0.6 }); props.flowers(z, p); },
      () => { props.fence(z, -20.5, -9, -20.5, 8, 0.8); props.fence(z, -20, -9.4, -4, -9.4, 0.8, true); },
    ];
  } });

  // sân chơi (đông)
  world.zone({ id: 'play', cx: 12, cz: -1, show: 19, build(z) {
    return [
      () => { // xích đu đôi
        const swing = new THREE.Group(); swing.position.set(10, 0, -3.2); z.add(swing);
        [-1.5, 1.5].forEach(x => [-1, 1].forEach(sz => { const l = add(swing, new THREE.BoxGeometry(0.12, 2.65, 0.12), toon('#ff9ec4'), x, 1.25, sz * 0.42, '#a8507a', 0.02); l.rotation.x = sz * 0.34; }));
        [-1.5, 1.5].forEach(x => { add(swing, new THREE.BoxGeometry(0.08, 0.08, 0.95), toon('#ffd36e'), x, 0.9, 0, '#a8742e', 0.01); add(swing, new THREE.SphereGeometry(0.11, 8, 6), toon('#ffd36e'), x, 2.56, 0, '#a8742e', 0.008); });
        add(swing, new THREE.BoxGeometry(3.4, 0.12, 0.12), toon('#ff9ec4'), 0, 2.5, 0, '#a8507a', 0.02);
        seats = [-0.6, 0.6].map(x => { const s = new THREE.Group(); s.position.set(x, 2.5, 0); swing.add(s); [-0.3, 0.3].forEach(dx => add(s, new THREE.CylinderGeometry(0.012, 0.012, 1.6, 4), toon('#6a4a5a'), dx, -0.8, 0, null)); add(s, new THREE.BoxGeometry(0.8, 0.07, 0.3), toon('#ffd36e'), 0, -1.6, 0, '#a8742e', 0.02); return s; });
        kit.hotspot({ id: 'swing', label: 'Xích đu', at: [10, 3.1, -3.2], stand: [10, -0.8], act: () => { if (c.playToy('swing')) rideSwing(); } }, swing);
      },
      () => { // bập bênh
        const see = new THREE.Group(); see.position.set(14.5, 0, 1.4); z.add(see);
        add(see, new THREE.ConeGeometry(0.3, 0.55, 4), toon('#9fd8ff'), 0, 0.27, 0, '#4a7a9a', 0.02);
        plank = add(see, new THREE.BoxGeometry(2.8, 0.1, 0.42), toon('#ffb347'), 0, 0.58, 0, '#a8742e', 0.02);
        [-1, 1].forEach(sx => { add(plank, new THREE.BoxGeometry(0.5, 0.08, 0.46), toon(sx < 0 ? '#ff7a8a' : '#6ab7ff'), sx * 1.15, 0.08, 0, '#6a4a5a', 0.01); const hd = add(plank, new THREE.TorusGeometry(0.14, 0.03, 6, 12, Math.PI), toon('#7a6a8a'), sx * 0.8, 0.14, 0, null); hd.rotation.y = Math.PI / 2; });
        add(see, new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), toon('#7a6a8a'), 0, 0.58, 0, null).rotation.x = Math.PI / 2;
        [-1.2, 1.2].forEach(x => add(see, new THREE.CylinderGeometry(0.16, 0.2, 0.1, 12), toon('#9a9aaa'), x, 0.05, 0, '#5a5a6a', 0.008)); // lốp đệm
        kit.hotspot({ id: 'seesaw', label: 'Bập bênh', at: [14.5, 1.7, 1.4], stand: [14.5, 3.0], act: () => { if (c.playToy('seesaw')) rideSeesaw(); } }, see);
      },
      () => { // cầu trượt
        const sl = new THREE.Group(); sl.position.set(15.5, 0, -3.6); z.add(sl); slideGrp = sl;
        add(sl, new THREE.BoxGeometry(1.2, 0.12, 1.2), toon('#ffd36e'), 0, 1.9, 0, '#a8742e', 0.02);
        [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].forEach(([x, zz]) => add(sl, new THREE.BoxGeometry(0.1, 1.9, 0.1), toon('#ff7a8a'), x, 0.95, zz, '#a83a4a', 0.015));
        const ramp = add(sl, new THREE.BoxGeometry(0.9, 0.08, 2.6), toon('#6ab7ff'), 0, 0.95, 1.7, '#356a9a', 0.02); ramp.rotation.x = 0.62;
        const lad = add(sl, new THREE.BoxGeometry(0.7, 2.0, 0.08), toon('#ff7a8a'), 0, 0.95, -0.7, '#a83a4a', 0.015); lad.rotation.x = -0.15;
        slideBall = add(sl, new THREE.SphereGeometry(0.1, 8, 6), toon('#ffffff'), 0, 2.1, 0.2, null);
        [-0.5, 0.5].forEach(x => { const r = add(sl, new THREE.BoxGeometry(0.08, 0.2, 2.6), toon('#4a90d0'), x, 1.08, 1.7, '#356a9a', 0.01); r.rotation.x = 0.62; });
        [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].forEach(([x, zz]) => add(sl, new THREE.BoxGeometry(0.08, 1.4, 0.08), toon('#ff7a8a'), x, 2.6, zz, null));
        [-0.55, 0.55].forEach(x => add(sl, new THREE.BoxGeometry(0.06, 0.06, 1.1), toon('#ffd36e'), x, 2.35, 0, null));
        add(sl, new THREE.ConeGeometry(1.0, 0.7, 4), toon('#7edb72'), 0, 3.6, 0, '#3f8a55', 0.02).rotation.y = Math.PI / 4;
        add(sl, new THREE.BoxGeometry(0.02, 0.2, 0.3), toon('#ff9ec4'), 0, 4.1, 0.15, null); add(sl, new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), toon('#7a6a8a'), 0, 4.0, 0, null);
        for (let i = 0; i < 5; i++) add(sl, new THREE.BoxGeometry(0.66, 0.05, 0.06), toon('#ffffff'), 0, 0.25 + i * 0.36, -0.7 - (0.25 + i * 0.36) * Math.tan(0.15) + 0.14, null); // bậc thang
        kit.hotspot({ id: 'slide', label: 'Cầu trượt', at: [15.5, 3.2, -3.6], stand: [15.5, 0.2], act: () => { if (c.playToy('slide')) rideSlide(); } }, sl);
      },
      () => { // hố cát + xô
        const sb = new THREE.Group(); sb.position.set(10.5, 0, 3.8); z.add(sb);
        add(sb, new THREE.BoxGeometry(3.0, 0.25, 2.2), toon('#f1dcae'), 0, 0.12, 0, '#a8905a', 0.02);
        [[-1.5, 0, 0.12, 2.3], [1.5, 0, 0.12, 2.3], [0, -1.1, 3.1, 0.12], [0, 1.1, 3.1, 0.12]].forEach(([x, zz, w, d]) => add(sb, new THREE.BoxGeometry(w, 0.32, d), toon('#d9b27a'), x, 0.16, zz, '#8a5f3a', 0.012));
        add(sb, new THREE.CylinderGeometry(0.3, 0.42, 0.34, 4), toon('#e8cf98'), 0.1, 0.4, 0.3, '#a8905a', 0.012).rotation.y = Math.PI / 4; add(sb, new THREE.CylinderGeometry(0.14, 0.2, 0.22, 4), toon('#e8cf98'), 0.1, 0.68, 0.3, '#a8905a', 0.01).rotation.y = Math.PI / 4; add(sb, new THREE.BoxGeometry(0.02, 0.12, 0.14), toon('#ff9ec4'), 0.1, 0.9, 0.36, null); // lâu đài cát
        const sh = add(sb, new THREE.BoxGeometry(0.16, 0.03, 0.5), toon('#ffd36e'), -0.2, 0.28, -0.5, null); sh.rotation.y = 0.6;
        add(sb, new THREE.CylinderGeometry(0.22, 0.17, 0.3, 12), toon('#6ab7ff'), -0.7, 0.4, 0.2, '#356a9a', 0.02); add(sb, new THREE.ConeGeometry(0.2, 0.3, 4), toon('#ff7a8a'), 0.6, 0.38, -0.3, '#a83a4a', 0.02);
      },
      () => props.fence(z, 7, -6.2, 18.5, -6.2, 0.8), () => props.fence(z, 18.5, -6.2, 18.5, 6.2, 0.8), () => props.fence(z, 7, 6.2, 18.5, 6.2, 0.8),
      () => props.trees(z, [{ x: 20, z: -8, s: 1.3 }, { x: 19, z: 8.5, s: 1.1 }, { x: 8, z: -9, s: 1.2 }].slice(0, Math.round(3 * dens) || 2)),
      () => { props.lamp(z, 7.5, -5.2); props.lamp(z, 18, 5.2); kit.bench(z, 7.5, 3.0, Math.PI / 2); },
    ];
  } });

  // vòm nghỉ chân + lùm cây (bắc)
  world.zone({ id: 'grove', cx: 0, cz: -9, show: 19, build(z) {
    return [
      () => { const gz = new THREE.Group(); gz.position.set(5.5, 0, -8.5); z.add(gz); add(gz, new THREE.CylinderGeometry(2.0, 2.1, 0.2, 8), toon('#e8d3a8'), 0, 0.1, 0, '#8a7a5a', 0.02);
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(gz, new THREE.BoxGeometry(0.14, 2.5, 0.14), toon('#ffffff'), Math.cos(a) * 1.8, 1.35, Math.sin(a) * 1.8, '#aaa', 0.015); }
        add(gz, new THREE.ConeGeometry(2.4, 1.3, 8), toon('#ff9ec4'), 0, 3.2, 0, '#a8507a', 0.03); add(gz, new THREE.CylinderGeometry(0.6, 0.6, 0.12, 14), toon('#c29a62'), 0, 0.7, 0, '#8a5f3a', 0.02); add(gz, new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), toon('#a8744a'), 0, 0.4, 0, null);
        add(gz, new THREE.CylinderGeometry(2.25, 2.25, 0.16, 8), toon('#ffd6e6'), 0, 2.62, 0, '#a8507a', 0.015); add(gz, new THREE.SphereGeometry(0.16, 10, 8), toon('#ffd36e'), 0, 3.95, 0, '#a8742e', 0.01);
        for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 + Math.PI / 16; add(gz, new THREE.SphereGeometry(0.11, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(i % 2 ? '#ff9ec4' : '#ffffff'), Math.cos(a) * 2.22, 2.5, Math.sin(a) * 2.22, null).rotation.x = Math.PI; }
        for (let i = 0; i < 6; i++) { if (i === 1) continue; const a = i * Math.PI / 3 + Math.PI / 6, x = Math.cos(a) * 1.56, zz = Math.sin(a) * 1.56, rl = add(gz, new THREE.BoxGeometry(1.75, 0.08, 0.08), toon('#ffffff'), x, 0.85, zz, '#aaa', 0.01); rl.rotation.y = -a + Math.PI / 2; for (let k = -2; k <= 2; k++) add(gz, new THREE.BoxGeometry(0.05, 0.6, 0.05), toon('#ffffff'), x + Math.cos(-a + Math.PI / 2) * k * 0.3, 0.5, zz - Math.sin(-a + Math.PI / 2) * k * 0.3, null); }
        [0, 2, 4].forEach(i => { const a = i * Math.PI / 3; add(gz, new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), toon('#6a4a5a'), Math.cos(a) * 1.5, 2.35, Math.sin(a) * 1.5, null); add(gz, new THREE.SphereGeometry(0.13, 10, 8), toon('#ffe9a8'), Math.cos(a) * 1.5, 2.12, Math.sin(a) * 1.5, '#a8742e', 0.008); });
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(gz, new THREE.SphereGeometry(0.3, 8, 6), toon('#ff9ec4'), Math.cos(a) * 2.25, 0.25, Math.sin(a) * 2.25, '#a8507a', 0.01).scale.y = 0.7; } },
      () => { props.picnic(z, -4.6, -6.2, { ry: 0.3, cloth: '#ffd36e', umbrella: '#7edb72' }); props.planter(z, 2.6, -6.8, { w: 1.8 }); props.planter(z, 8.4, -6.8, { w: 1.8 }); },
      () => props.trees(z, [{ x: -6, z: -8.5, s: 1.4 }, { x: -2, z: -9.5, s: 1.2 }, { x: 1.8, z: -8.8, s: 1.3 }, { x: 9.5, z: -9, s: 1.1 }, { x: -9.5, z: -9.2, s: 1.25 }].slice(0, Math.round(5 * dens) || 3)),
      () => { const t = []; for (let i = 0, n = Math.round(70 * dens); i < n; i++) t.push({ x: -16 + ((i * 47) % 320) / 10, z: -9 + ((i * 61) % 190) / 10 }); props.tufts(z, t); },
    ];
  } });

  // đồng hoa phía nam (mở rộng): luống tulip theo hàng, cối xay gió, xe kem, bàn dã ngoại, diều
  world.zone({ id: 'meadow', cx: 0, cz: 10.5, show: 18, build(z) {
    return [
      () => { const rows = ['#ff7a9a', '#ffd36e', '#c9a6ff', '#ff9a5a', '#ffffff', '#ff9ec4'], n = Math.round(16 * dens);
        add(z, new THREE.BoxGeometry(11, 0.06, 3.9), toon('#c99a6a'), -10, 0.03, 10.1, null);
        rows.forEach((col, r) => { add(z, new THREE.BoxGeometry(10.6, 0.1, 0.3), toon('#7ec86a'), -10, 0.06, 8.6 + r * 0.6, null); const pts = []; for (let i = 0; i < n; i++) pts.push({ x: -15 + i * (10 / Math.max(1, n - 1)), z: 8.6 + r * 0.6 }); props.flowers(z, pts, [col]); }); },
      () => { // cối xay gió nhỏ
        const w = new THREE.Group(); w.position.set(-16.5, 0, 11.2); z.add(w);
        add(w, new THREE.CylinderGeometry(0.7, 1.05, 3.2, 8), toon('#fff3e4'), 0, 1.6, 0, '#8a6a7a', 0.03);
        add(w, new THREE.ConeGeometry(0.95, 1.0, 8), toon('#d9644a'), 0, 3.7, 0, '#7a3a2a', 0.03);
        add(w, new THREE.BoxGeometry(0.6, 1.0, 0.08), toon('#a8744a'), 0, 0.5, 0.98, '#5a3a22', 0.015); add(w, new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), toon('#cfeaff'), 0, 2.2, 0.82, '#8a7a7a', 0.01).rotation.x = Math.PI / 2;
        mill = new THREE.Group(); mill.position.set(0, 3.1, 0.95); w.add(mill);
        add(mill, new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10), toon('#a8744a'), 0, 0, 0, null).rotation.x = Math.PI / 2;
        for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; mill.add(arm); add(arm, new THREE.BoxGeometry(0.08, 1.7, 0.05), toon('#a8744a'), 0, 0.9, 0.05, null); add(arm, new THREE.BoxGeometry(0.42, 1.2, 0.03), toon('#fff8ef'), 0.24, 1.05, 0.07, '#8a7a7a', 0.01); }
      },
      () => { props.cart(z, 4.5, 9.6, { ry: -0.15, label: 'Kem mát', body: '#ffd6e6', stripe: '#7ec8ff', goods: 'icecream' }); props.picnic(z, 9.5, 10.2, { ry: 0.2 }); props.picnic(z, 14.2, 9.4, { ry: -0.3, cloth: '#7ec8ff', umbrella: '#ffd36e' }); },
      () => { props.fence(z, -20.5, 13.2, 20.5, 13.2, 0.8); props.trees(z, [{ x: 18.5, z: 11.8, s: 1.2 }, { x: -19, z: 8.6, s: 1.0 }].slice(0, Math.round(2 * dens) || 1));
        props.topiary(z, -3.8, 8.0, { shape: 'cone', s: 0.8 }); props.topiary(z, 2.2, 8.0, { shape: 'ball', s: 0.8 }); props.lamp(z, -4.4, 8.1); props.lamp(z, 7.2, 8.1); kit.bench(z, 0.4, 10.6, Math.PI); },
      () => { const t = []; for (let i = 0, n = Math.round(50 * dens); i < n; i++) t.push({ x: -4 + ((i * 47) % 240) / 10, z: 8 + ((i * 61) % 50) / 10 }); props.tufts(z, t); },
    ];
  } });

  return {
    group: g,
    enter() { kit.show(true); shared.enter(); setTimeout(() => { if (c.getArea() === 'park') c.say('Công viên rộng ghê! Mình chạy thử nha.', 2800); }, 900); },
    leave() { stopCatch(true); kit.show(false); shared.leave(); },
    update(dt, now) {
      kit.tick(now); const t = now / 1000, [px, pz] = c.getPetXZ(); world.update(px, pz);
      if (mill) mill.rotation.z = -t * 0.9; if (kite) { kite.position.x = -10 + Math.sin(t * 0.7) * 0.5; kite.position.y = 8.2 + Math.sin(t * 1.1) * 0.3; kite.rotation.z = Math.sin(t * 0.9) * 0.25; }
      seats.forEach((s, i) => { s.rotation.z = s.userData.ride ?? Math.sin(t * 1.6 + i * 1.1) * 0.2; }); if (plank) plank.rotation.z = plank.userData.ride ?? Math.sin(t * 1.2) * 0.14;
      duckAtt += ((performance.now() < duckUntil ? 1 : 0) - duckAtt) * Math.min(1, dt * 1.4);
      ducks.forEach(({ d, ph, x, z }, i) => {
        const wx = x + Math.sin(t * 0.5 + ph) * 0.8, wz = z + Math.cos(t * 0.4 + ph) * 0.4, tx = 2.5 + i * 0.35, tz = 0.9 + (i - 1) * 0.5; // quanh chỗ bé ngồi (toạ độ ao)
        d.position.x = lerp(wx, tx, duckAtt); d.position.z = lerp(wz, tz, duckAtt); d.position.y = 0.1 + Math.sin(t * 2 + ph) * 0.015 + (duckAtt > 0.8 ? Math.abs(Math.sin(t * 7 + ph)) * 0.08 : 0);
        d.rotation.y = lerp(Math.cos(t * 0.5 + ph), Math.PI * 0.5, duckAtt) + (duckAtt > 0.8 ? Math.sin(t * 9 + ph) * 0.25 : 0);
        if (duckAtt > 0.85 && Math.random() < dt * 0.35) c.spawnAt('note', d.parent.position.x + d.position.x, 0.8, d.parent.position.z + d.position.z, { vy: 0.7, scale: 0.28, max: 0.9 });
      });
      if (ball && now > ballCd && ball.position.y < 0.9 && !c.state.asleep) { // bé đi tới chạm bóng thì bóng bị đá nảy đi (không đi xuyên qua)
        const dx = ball.position.x - px, dz = ball.position.z - pz, d = Math.hypot(dx, dz);
        if (d < 0.95) { const nx = dx / (d || 1), nz = dz / (d || 1), sp = 3.2 + Math.random() * 1.2; ballV = { vx: nx * sp, vy: 3.0 + Math.random() * 0.8, vz: nz * sp }; ballCd = now + 450; c.sfx('kick'); c.spawnAt('sparkle', ball.position.x, 0.5, ball.position.z, { vy: 1, scale: 0.4, max: 0.5 }); c.setTemp('excited', 700); }
      }
      if (ballV && ball) { // bóng nảy, lăn rồi dừng
        const b = ball.position; b.x += ballV.vx * dt; b.z += ballV.vz * dt; ballV.vy -= 9 * dt; b.y += ballV.vy * dt;
        if (b.y < 0.28) { b.y = 0.28; ballV.vy = Math.abs(ballV.vy) > 0.8 ? -ballV.vy * 0.55 : 0; ballV.vx *= 0.82; ballV.vz *= 0.82; }
        if (b.x < -16 || b.x > 16) ballV.vx *= -0.6; if (b.z < -6 || b.z > 8) ballV.vz *= -0.6; b.x = Math.max(-16, Math.min(16, b.x)); b.z = Math.max(-6, Math.min(8, b.z));
        ball.rotation.x += ballV.vz * dt * 3; ball.rotation.z -= ballV.vx * dt * 3; if (ballV.vy === 0 && Math.hypot(ballV.vx, ballV.vz) < 0.12) ballV = null;
      }
      butterflies.forEach(m => { // bướm bay tránh bé khi bé lại gần rồi quay về
        const u = m.userData; u.fx = u.fx || 0; u.fz = u.fz || 0; const bx = u.cx + Math.sin(t * 0.4 + u.ph) * 3 + u.fx, bz = u.cz + Math.cos(t * 0.35 + u.ph) * 2 + u.fz, dx = bx - px, dz = bz - pz, d = Math.hypot(dx, dz), scare = d < 2.8;
        if (scare) { u.fx += dx / Math.max(d, 0.3) * dt * 5; u.fz += dz / Math.max(d, 0.3) * dt * 5; } u.fx *= 1 - dt * 0.5; u.fz *= 1 - dt * 0.5;
        m.position.set(bx, 0.9 + Math.sin(t * 1.3 + u.ph) * 0.3 + (scare ? 0.7 : 0), bz); m.rotation.set(-1.2, 0, Math.sin(t * (scare ? 26 : 14) + u.ph) * 0.7);
      });
      if (slideBall) { const k = (t * 0.35) % 1; slideBall.position.set(0, 2.05 - k * 1.7, 0.2 + k * 2.4); slideBall.visible = k < 0.9; }
      if (pondMat) pondMat.color.setHSL(0.55, 0.9, 0.78 + Math.sin(t * 0.8) * 0.02);
      const night = c.isNight ? c.isNight() : false; props.night(night); fireflies(t, night);
      updateCatch(dt, now, px, pz);
      shared.update(dt, now);
    },
    catchGame: startCatch, catching: () => !!catchGame, catchState: () => (catchGame ? { caught: catchGame.caught, bs: catchGame.list.map(screenOf) } : null),
    tap: e => (catchGame ? catchTap(e) : shared.tap(e) || kit.tap(e)), sync() {}, world,
  };
}
