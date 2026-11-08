// Chợ Xanh (~30 ngang, camera bám thú): sáu điểm chạm ở khu giữa (rau quả, tiệm hôm nay, chợ cuối tuần, nội thất, thu mua nông sản, sổ sưu tập),
// hai dãy hàng trang trí ở khu tây (bánh trái, hoa, giếng) và khu đông (cá, gốm, đèn lồng) dựng dần khi bé tới gần, cổng chợ ở hai đầu, chim bồ câu.
import { makeKit } from './kit.js';
import { isSteam } from '../../lib/platform';
import { bakeStatic, makeProps, makeWorld } from './world.js';

export function initMarket(c) {
  const { THREE, add, toon, canvasTex, scene } = c, kit = makeKit(c);
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const world = makeWorld(c, g), props = makeProps({ THREE, add, toon, canvasTex, kit, world }), dens = world.density();
  const cobble = canvasTex(128, 128, d => { d.fillStyle = '#f0e2c8'; d.fillRect(0, 0, 128, 128); d.strokeStyle = '#d8c39c'; d.lineWidth = 3; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { d.strokeRect(i * 32 + (j % 2) * 16 - 16, j * 32, 32, 32); } }, [6, 4]);
  // nền lát đá kéo dài ra phía trước (phủ kín đáy khung hình) và đồi xa phía sau thay cho mảng trời trống
  const cob = cobble.clone(); cob.repeat.set(6 * 40 / 14, 4 * 22 / 10); cob.needsUpdate = true;
  add(g, new THREE.BoxGeometry(40, 0.4, 22), toon('#ffffff', cob), 0, -0.2, 5, '#9a7f5a', 0.03);
  ['#9bdc8a', '#86cf86', '#a8e39a'].forEach((col, i) => { for (let k = 0; k < 6; k++) { const r = 4 + ((i + k) * 5 % 3) * 1.4, h = add(g, new THREE.SphereGeometry(r, 26, 12), toon(col), -28 + k * 11 + i * 3.5, -r * 0.5, -12 - i * 2.4, null); h.scale.set(1.6, 0.7, 1); } });
  [[-7, -8.6], [6.5, -9.2], [10, -8], [-15, -8.4], [16, -8.8], [-11, -9.6]].forEach(([x, z], i) => { add(g, new THREE.CylinderGeometry(0.22, 0.3, 1.6, 10), toon('#a8744e'), x, 0.8, z, '#6a4630', 0.02); add(g, new THREE.SphereGeometry(1.2 + (i % 2) * 0.3, 18, 14), toon('#6fd08c'), x, 2.4, z, '#2f7a3d', 0.03); });
  add(g, new THREE.BoxGeometry(30, 0.5, 0.3), toon('#d9b27a'), 0, 0.15, -4.8, '#8a5f3a', 0.02); // hàng rào sau
  for (let x = -15; x <= 15; x += 2.5) add(g, new THREE.BoxGeometry(0.16, 0.9, 0.16), toon('#c29a62'), x, 0.45, -4.8, '#8a5f3a', 0.02);
  add(g, new THREE.BoxGeometry(30, 0.06, 0.08), toon('#c29a62'), 0, 0.75, -4.8, null);

  const stripe = (a, b) => canvasTex(128, 64, d => { for (let i = 0; i < 8; i++) { d.fillStyle = i % 2 ? a : b; d.fillRect(i * 16, 0, 16, 64); } }, [1, 1]);
  function stall(x, z, col, light, label, goods, hat = 'vendor', ry = 0) {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
    add(s, new THREE.BoxGeometry(1.9, 0.8, 0.8), toon(light), 0, 0.4, 0, '#8a5f3a', 0.03);
    [-0.9, 0.9].forEach(sx => add(s, new THREE.BoxGeometry(0.08, 2.1, 0.08), toon('#c29a62'), sx, 1.05, -0.35, '#8a5f3a', 0.02));
    const aw = add(s, new THREE.BoxGeometry(2.2, 0.08, 1.1), toon('#ffffff', stripe(col, '#ffffff')), 0, 2.15, 0.05, '#7a5a5a', 0.02); aw.rotation.x = 0.22;
    const sg = kit.sign(label, 1.5, 0.4, '#fff7ef', '#5a3a4a', 34); sg.position.set(0, 1.78, 0.5); s.add(sg);
    goods(s);
    kit.npc({ x: 0, z: -0.7, y: 0.42, color: '#ffe7c9', hat, parent: s });
    return s;
  }
  const ball = (s, col, x, y, z, r = 0.12) => add(s, new THREE.SphereGeometry(r, 10, 8), toon(col), x, y, z, '#6a4a3a', 0.02);
  const crate = s => add(s, new THREE.BoxGeometry(0.5, 0.2, 0.4), toon('#c29a62'), 0, 0.9, 0.12, '#8a5f3a', 0.02);

  const food = stall(-2.5, -3.5, '#7edb72', '#e6f9dc', 'Rau quả', s => { [-0.55, 0, 0.55].forEach((x, i) => { crate(s).position.x = x; [0, 1, 2].forEach(k => ball(s, ['#ff8f4d', '#7edb72', '#ffd95a'][i], x - 0.1 + k * 0.1, 1.06, 0.12)); }); });
  const today = stall(0, -3.5, '#ff9ec4', '#ffe9f1', 'Hôm nay', s => { [-0.5, 0, 0.5].forEach((x, i) => { add(s, new THREE.BoxGeometry(0.34, 0.34, 0.3), toon(['#c9a6ff', '#6ab7ff', '#ffd36e'][i]), x, 1.0, 0.1, '#6a4a5a', 0.02); }); });
  const wk = stall(2.5, -3.5, '#c9a6ff', '#f1e9ff', 'Cuối tuần', s => { [-0.4, 0.2, 0.6].forEach((x, i) => ball(s, ['#ff9ec4', '#ffd36e', '#7edb72'][i], x, 1.0, 0.12, 0.16)); });
  const furn = stall(-2.65, -1.65, '#6ab7ff', '#e2f3ff', 'Nội thất', s => { add(s, new THREE.BoxGeometry(0.5, 0.4, 0.4), toon('#ff9ec4'), -0.4, 1.0, 0.1, '#a8507a', 0.02); add(s, new THREE.CylinderGeometry(0.2, 0.16, 0.4, 12), toon('#7edb72'), 0.3, 1.0, 0.1, '#3f8a55', 0.02); }, 'vendor', 0.15);
  const sell = stall(2.65, -1.65, '#ffd36e', '#fff6d6', 'Thu mua', s => { crate(s).position.x = -0.4; crate(s).position.x = 0.3; ball(s, '#ff8f4d', -0.4, 1.06, 0.12); ball(s, '#7edb72', 0.3, 1.06, 0.12); add(s, new THREE.BoxGeometry(0.5, 0.06, 0.3), toon('#cfd8e3'), 0.75, 0.84, 0.12, '#556', 0.02); }, 'vendor', -0.15);
  const book = new THREE.Group(); book.position.set(0, 0, -1.9); g.add(book);
  add(book, new THREE.BoxGeometry(0.1, 1.7, 0.1), toon('#c29a62'), -0.55, 0.85, 0, '#8a5f3a', 0.02); add(book, new THREE.BoxGeometry(0.1, 1.7, 0.1), toon('#c29a62'), 0.55, 0.85, 0, '#8a5f3a', 0.02);
  const bs = kit.sign('Sổ sưu tập', 1.5, 0.7, '#fff3c4', '#7a5a1a', 34); bs.position.set(0, 1.5, 0); book.add(bs);

  // biển Video thưởng: xem video nhận xu (tự nguyện)
  const video = new THREE.Group(); video.position.set(-4.4, 0, -0.3); g.add(video);
  add(video, new THREE.BoxGeometry(0.1, 1.5, 0.1), toon('#c29a62'), 0, 0.75, 0, '#8a5f3a', 0.02);
  const vs = kit.sign('Video thưởng', 1.3, 0.55, '#e4f6ff', '#2f5a7a', 30); vs.position.set(0, 1.4, 0.08); video.add(vs);
  // biển Đồ chơi: mua đồ chơi mang theo
  const toyPost = new THREE.Group(); toyPost.position.set(4.4, 0, -0.3); g.add(toyPost);
  add(toyPost, new THREE.BoxGeometry(0.1, 1.5, 0.1), toon('#c29a62'), 0, 0.75, 0, '#8a5f3a', 0.02);
  const ts = kit.sign('Đồ chơi', 1.2, 0.55, '#ffeef6', '#8a3a5a', 32); ts.position.set(0, 1.4, 0.08); toyPost.add(ts);
  const T = 'market';
  kit.hotspot({ id: 'food', label: 'Rau quả', at: [-2.5, 2.7, -3.3], stand: [-2.2, -0.8], act: () => c.open.shop('food') }, food);
  kit.hotspot({ id: 'today', label: 'Tiệm hôm nay', at: [0, 2.7, -3.3], stand: [0, -0.8], act: () => c.open.shop('rotating') }, today);
  kit.hotspot({ id: 'weekend', label: 'Chợ cuối tuần', at: [2.5, 2.7, -3.3], stand: [2.2, -0.8], act: () => (c.state.weekend ? c.open.shop('weekend') : c.toast('Chợ cuối tuần chỉ mở thứ Bảy và Chủ nhật.')) }, wk);
  kit.hotspot({ id: 'furn', label: 'Nội thất', at: [-2.65, 2.5, -1.45], stand: [-2.2, -0.4], act: () => c.open.shop('market') }, furn);
  kit.hotspot({ id: 'sell', label: 'Thu mua rau', at: [2.65, 2.5, -1.45], stand: [2.2, -0.4], act: () => c.open.sell() }, sell);
  kit.hotspot({ id: 'book', label: 'Sổ sưu tập', at: [0, 2.3, -1.9], stand: [0, -0.5], act: () => c.open.shop('book') }, book);
  if (!isSteam) kit.hotspot({ id: 'video', label: 'Video thưởng', at: [-4.4, 2.2, -0.2], stand: [-3.6, 1.0], act: () => c.open.ads() }, video);
  kit.hotspot({ id: 'toys', label: 'Đồ chơi', at: [4.4, 2.2, -0.2], stand: [3.6, 1.0], act: () => c.open.toys() }, toyPost);
  void T;

  // chim bồ câu: đặt xa chỗ bé đứng (bé vào chợ ở giữa) để không chồng lên chân bé
  const pigeons = [[-3.4, 3.2, 0.5], [3.3, 2.6, -0.6], [-2.2, 4.2, 2.4]].map(([x, z, ry], i) => {
    const p = new THREE.Group(); p.userData.keep = true; p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
    const body = add(p, new THREE.SphereGeometry(0.17, 12, 10), toon('#b9c2d4'), 0, 0.2, 0, '#5a6278', 0.018); body.scale.set(1.25, 0.9, 0.95);
    add(p, new THREE.SphereGeometry(0.1, 10, 8), toon('#8fa0c0'), 0.15, 0.3, 0, '#5a6278', 0.015); // cổ ánh tím
    add(p, new THREE.SphereGeometry(0.085, 10, 8), toon('#c9d2e4'), 0.23, 0.38, 0, '#5a6278', 0.015); // đầu
    const beak = add(p, new THREE.ConeGeometry(0.03, 0.09, 6), toon('#ffb36b'), 0.33, 0.37, 0, null); beak.rotation.z = -Math.PI / 2;
    add(p, new THREE.SphereGeometry(0.014, 6, 6), toon('#2a2230'), 0.27, 0.41, 0.06, null); add(p, new THREE.SphereGeometry(0.014, 6, 6), toon('#2a2230'), 0.27, 0.41, -0.06, null);
    const tail = add(p, new THREE.ConeGeometry(0.07, 0.2, 6), toon('#9aa6c0'), -0.27, 0.22, 0, '#5a6278', 0.012); tail.rotation.z = Math.PI / 2 + 0.3;
    [-0.05, 0.05].forEach(dz => add(p, new THREE.CylinderGeometry(0.01, 0.01, 0.1, 5), toon('#ff8a7a'), 0.02, 0.05, dz, null));
    bakeStatic(THREE, p); return { p, ph: i * 2 };
  });
  kit.plant(g, -4.2, 0.6, 0.9); kit.plant(g, 4.2, 0.6, 0.9);
  // trạm giao hàng (mini-game): xe đẩy chở thùng hàng
  const dv = new THREE.Group(); dv.position.set(-5.9, 0, -1.6); dv.rotation.y = 0.35; g.add(dv);
  add(dv, new THREE.BoxGeometry(1.2, 0.12, 0.8), toon('#6ab7ff'), 0, 0.42, 0, '#356a9a', 0.015);
  [[-0.5, 0.42], [0.5, 0.42], [-0.5, -0.42], [0.5, -0.42]].forEach(([x, zz]) => add(dv, new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), toon('#4a4a5a'), x, 0.16, zz, null).rotation.x = Math.PI / 2);
  add(dv, new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), toon('#7a6a8a'), -0.65, 0.85, 0, null).rotation.z = 0.35;
  [[-0.25, 0.7, 0, '#d9b27a'], [0.25, 0.7, 0.05, '#c29a62'], [0, 1.05, 0, '#e8c690']].forEach(([x, y, zz, col]) => add(dv, new THREE.BoxGeometry(0.42, 0.34, 0.42), toon(col), x, y, zz, '#8a5f3a', 0.012));
  const ds = kit.sign('Giao hàng', 1.0, 0.3, '#e4f6ff', '#2f5a7a', 30); ds.position.set(0, 1.55, 0.05); dv.add(ds);
  kit.hotspot({ id: 'delivery', label: 'Giao hàng', at: [-5.9, 2.2, -1.6], stand: [-5.3, -0.6], act: () => c.open.mini('delivery') }, dv);

  /* ---------- hai dãy hàng hai bên (chỉ trang trí, dựng dần khi bé tới gần) ---------- */
  function deco(z, x, zz, col, light, label, goods, hat, ry = 0) { // sạp trang trí: như stall nhưng không có điểm chạm
    const s = new THREE.Group(); s.position.set(x, 0, zz); s.rotation.y = ry; z.add(s);
    add(s, new THREE.BoxGeometry(1.9, 0.8, 0.8), toon(light), 0, 0.4, 0, '#8a5f3a', 0.03);
    add(s, new THREE.BoxGeometry(1.96, 0.06, 0.86), toon('#fff8ef'), 0, 0.82, 0, null);
    [-0.9, 0.9].forEach(sx => add(s, new THREE.BoxGeometry(0.08, 2.1, 0.08), toon('#c29a62'), sx, 1.05, -0.35, '#8a5f3a', 0.02));
    const aw = add(s, new THREE.BoxGeometry(2.2, 0.08, 1.1), toon('#ffffff', stripe(col, '#ffffff')), 0, 2.15, 0.05, '#7a5a5a', 0.02); aw.rotation.x = 0.22;
    for (let i = 0; i < 8; i++) add(s, new THREE.ConeGeometry(0.11, 0.18, 3), toon(i % 2 ? col : '#ffffff'), -0.96 + i * 0.275, 1.98, 0.6, null).rotation.x = Math.PI;
    const sg = kit.sign(label, 1.4, 0.38, '#fff7ef', '#5a3a4a', 32); sg.position.set(0, 0.5, 0.42); s.add(sg);
    goods(s); kit.npc({ x: 0, z: -0.7, y: 0.42, color: hat === 'chef' ? '#fff0d9' : '#ffe7c9', hat: hat || 'vendor', parent: s });
    return s;
  }
  const basket = (z, x, zz, col) => { add(z, new THREE.CylinderGeometry(0.34, 0.26, 0.3, 12), toon('#d9a86a'), x, 0.15, zz, '#7a5a3a', 0.012); for (let i = 0; i < 5; i++) add(z, new THREE.SphereGeometry(0.11, 8, 6), toon(col), x + Math.cos(i * 1.3) * 0.15, 0.34, zz + Math.sin(i * 1.3) * 0.13, null); };
  const barrel = (z, x, zz) => { add(z, new THREE.CylinderGeometry(0.32, 0.32, 0.75, 12), toon('#b98a5e'), x, 0.38, zz, '#6a4a3a', 0.015); [0.15, 0.6].forEach(y => add(z, new THREE.TorusGeometry(0.33, 0.025, 6, 16), toon('#7a6a8a'), x, y, zz, null).rotation.x = Math.PI / 2); };
  const crates = (z, x, zz) => { add(z, new THREE.BoxGeometry(0.6, 0.45, 0.5), toon('#c29a62'), x, 0.23, zz, '#8a5f3a', 0.015); add(z, new THREE.BoxGeometry(0.55, 0.4, 0.45), toon('#d9b27a'), x + 0.05, 0.66, zz - 0.02, '#8a5f3a', 0.015).rotation.y = 0.3; add(z, new THREE.BoxGeometry(0.6, 0.45, 0.5), toon('#c29a62'), x + 0.65, 0.23, zz + 0.1, '#8a5f3a', 0.015); };
  const gateArch = (z, x, label) => { // cổng chợ ở đầu dãy
    const a = new THREE.Group(); a.position.set(x, 0, -0.6); a.rotation.y = Math.PI / 2; z.add(a);
    [-2.4, 2.4].forEach(px => { add(a, new THREE.BoxGeometry(0.4, 3.4, 0.4), toon('#d9644a'), px, 1.7, 0, '#7a3a2a', 0.02); add(a, new THREE.BoxGeometry(0.6, 0.3, 0.6), toon('#c9a06a'), px, 0.15, 0, null); });
    add(a, new THREE.BoxGeometry(5.6, 0.4, 0.6), toon('#ffd36e'), 0, 3.4, 0, '#a8742e', 0.02); add(a, new THREE.BoxGeometry(6.0, 0.18, 0.8), toon('#d9644a'), 0, 3.7, 0, '#7a3a2a', 0.02);
    const sg = kit.sign(label, 2.4, 0.5, '#fff3c4', '#7a3a1a', 36); sg.position.set(0, 2.85, 0.24); a.add(sg);
    [-1.6, 1.6].forEach(px => { add(a, new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), toon('#6a4a5a'), px, 3.05, 0.1, null); add(a, new THREE.SphereGeometry(0.22, 12, 10), toon('#ff6a5a'), px, 2.75, 0.1, '#a83a3a', 0.01).scale.y = 1.2; });
  };
  const lanterns = (z, x0, x1, y, zz) => { for (let i = 0, n = Math.round(Math.abs(x1 - x0) / 0.9); i <= n; i++) { const x = x0 + (x1 - x0) * i / n; add(z, new THREE.SphereGeometry(0.15, 10, 8), toon(['#ff6a5a', '#ffd36e', '#ff9ec4'][i % 3]), x, y - Math.sin(i / n * Math.PI) * 0.3 - 0.2, zz, null).scale.y = 1.25; } add(z, new THREE.BoxGeometry(Math.abs(x1 - x0), 0.02, 0.02), toon('#6a4a5a'), (x0 + x1) / 2, y, zz, null); [x0, x1].forEach(x => { add(z, new THREE.CylinderGeometry(0.05, 0.06, y + 0.1, 6), toon('#a8744a'), x, (y + 0.1) / 2, zz, '#5a3a22', 0.01); add(z, new THREE.SphereGeometry(0.08, 8, 6), toon('#ffd36e'), x, y + 0.14, zz, null); }); };
  world.zone({ id: 'west', cx: -9, cz: 0, show: 17, build(z) { return [
    () => deco(z, -6.6, -3.5, '#ffb347', '#fff1dc', 'Bánh trái', s => { [-0.55, 0, 0.55].forEach((x, i) => { add(s, new THREE.CylinderGeometry(0.22, 0.24, 0.06, 14), toon('#ffffff'), x, 0.88, 0.12, '#9a9aaa', 0.006); for (let k = 0; k < 3; k++) add(s, new THREE.CapsuleGeometry(0.06, 0.14, 4, 8), toon(['#e8a85a', '#ff9ec4', '#ffd36e'][i]), x - 0.08 + k * 0.08, 0.96, 0.12, '#8a5a2a', 0.006).rotation.z = Math.PI / 2; }); }, 'chef'),
    () => deco(z, -9.2, -3.5, '#ff9ec4', '#ffeef6', 'Hoa tươi', s => { [-0.6, -0.2, 0.2, 0.6].forEach((x, i) => { add(s, new THREE.CylinderGeometry(0.12, 0.09, 0.2, 10), toon('#9ab0c8'), x, 0.92, 0.12, '#4a5a6a', 0.006); for (let k = 0; k < 3; k++) add(s, new THREE.SphereGeometry(0.07, 8, 6), toon(['#ff9ec4', '#ffd36e', '#c9a6ff', '#ffffff'][(i + k) % 4]), x + (k - 1) * 0.06, 1.1 + (k % 2) * 0.05, 0.12, null); }); }),
    () => deco(z, -11.8, -3.5, '#7edb72', '#e6f9dc', 'Trà & mứt', s => { [-0.55, -0.15, 0.25, 0.6].forEach((x, i) => { add(s, new THREE.CylinderGeometry(0.1, 0.1, 0.24, 10), toon(['#ffd36e', '#ff8f6a', '#c9a6ff', '#7edb72'][i]), x, 0.95, 0.12, '#6a4a5a', 0.006); add(s, new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10), toon('#fff8ef'), x, 1.09, 0.12, null); }); }),
    () => { gateArch(z, -14.2, 'Chợ Xanh'); lanterns(z, -12.8, -5.6, 3.4, -2.9); },
    () => { // giếng nước + chậu hoa
      const w = new THREE.Group(); w.position.set(-12.9, 0, -1.7); z.add(w);
      add(w, new THREE.CylinderGeometry(0.75, 0.8, 0.7, 16), toon('#d9d2c4'), 0, 0.35, 0, '#8a8478', 0.02); add(w, new THREE.CylinderGeometry(0.6, 0.6, 0.04, 16), toon('#8ed6ff'), 0, 0.6, 0, null);
      [-0.7, 0.7].forEach(x => add(w, new THREE.BoxGeometry(0.1, 1.6, 0.1), toon('#a8744a'), x, 1.15, 0, '#5a3a22', 0.012));
      add(w, new THREE.ConeGeometry(1.0, 0.6, 4), toon('#d9644a'), 0, 2.2, 0, '#7a3a2a', 0.02).rotation.y = Math.PI / 4; add(w, new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), toon('#7a5a3a'), 0, 1.5, 0, null).rotation.z = Math.PI / 2;
      add(w, new THREE.CylinderGeometry(0.14, 0.12, 0.2, 10), toon('#a8744a'), 0, 1.15, 0, '#5a3a22', 0.008);
      props.topiary(z, -12.6, 3.4, { shape: 'ball', s: 0.8 }); props.planter(z, -7.6, 3.6, { w: 1.6 });
    },
    () => { basket(z, -7.6, -1.9, '#ff8f4d'); basket(z, -8.4, -1.6, '#7edb72'); crates(z, -10.8, -2.2); props.lamp(z, -7.9, -2.4); },
  ]; } });
  world.zone({ id: 'east', cx: 9, cz: 0, show: 17, build(z) { return [
    () => deco(z, 6.6, -3.5, '#6ab7ff', '#e2f3ff', 'Cá tươi', s => { add(s, new THREE.BoxGeometry(1.5, 0.06, 0.5), toon('#e4f4ff'), 0, 0.86, 0.12, null); for (let i = 0; i < 5; i++) { const f = add(s, new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), toon(i % 2 ? '#9ab0c8' : '#ffb3a0'), -0.56 + i * 0.28, 0.93, 0.12, '#4a5a6a', 0.006); f.rotation.z = Math.PI / 2; add(s, new THREE.ConeGeometry(0.06, 0.1, 3), toon(i % 2 ? '#9ab0c8' : '#ffb3a0'), -0.56 + i * 0.28 + 0.18, 0.93, 0.12, null).rotation.z = Math.PI / 2; } }),
    () => deco(z, 9.2, -3.5, '#d9825a', '#fff0e4', 'Đồ gốm', s => { [-0.6, -0.2, 0.2, 0.6].forEach((x, i) => { add(s, new THREE.SphereGeometry(0.15, 12, 10), toon(['#d9825a', '#7ec8ff', '#ffe9c4', '#c9a6ff'][i]), x, 1.0, 0.12, '#6a4a3a', 0.008).scale.y = 1.2; add(s, new THREE.CylinderGeometry(0.07, 0.1, 0.1, 10), toon(['#d9825a', '#7ec8ff', '#ffe9c4', '#c9a6ff'][i]), x, 1.2, 0.12, null); }); }),
    () => deco(z, 11.8, -3.5, '#ff6a5a', '#fff0ee', 'Đèn lồng', s => { [-0.55, 0, 0.55].forEach((x, i) => { add(s, new THREE.SphereGeometry(0.17, 12, 10), toon(['#ff6a5a', '#ffd36e', '#ff9ec4'][i]), x, 1.55, 0.3, '#a83a3a', 0.008).scale.y = 1.3; add(s, new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), toon('#6a4a5a'), x, 1.85, 0.3, null); }); add(s, new THREE.BoxGeometry(1.6, 0.04, 0.04), toon('#a8744a'), 0, 2.0, 0.3, null); }),
    () => { gateArch(z, 14.2, 'Chợ Xanh'); lanterns(z, 5.6, 12.8, 3.4, -2.9); },
    () => { props.cart(z, 12.9, -1.7, { ry: -0.35, label: 'Nước mía', body: '#e6f9dc', stripe: '#7edb72', goods: 'fruit' }); props.topiary(z, 12.6, 3.4, { shape: 'cone', s: 0.8 }); },
    () => { basket(z, 7.6, -1.9, '#ffd95a'); crates(z, 10.4, -2.2); barrel(z, 5.6, -2.0); barrel(z, 6.3, -2.2); props.lamp(z, 7.9, -2.4); },
  ]; } });

  // gộp vật tĩnh của khu giữa và bên trong từng sạp có điểm chạm (bớt lệnh vẽ trên điện thoại)
  bakeStatic(THREE, g); g.traverse(o => { if (o.userData.hotRoot && !o.isMesh) bakeStatic(THREE, o, { inHotspot: o.userData.hotRoot }); });
  return {
    group: g,
    enter() { kit.show(true); setTimeout(() => { if (c.getArea() === 'market') c.say('Rau tươi nè! Bạn mua cho mình món ngon nha.', 3000); }, 700); },
    leave() { kit.show(false); },
    update(dt, now) { kit.tick(now); const t = now / 1000, [px, pz] = c.getPetXZ(); world.update(px, pz); props.night(c.isNight ? c.isNight() : false); pigeons.forEach(({ p, ph }) => { p.position.y = Math.max(0, Math.sin(t * 3 + ph)) * 0.04; p.rotation.y = Math.sin(t * 0.6 + ph) * 0.8; }); },
    tap: e => kit.tap(e), sync() {},
  };
}
