// Chợ Xanh: sáu điểm chạm (rau quả, tiệm hôm nay, chợ cuối tuần, nội thất, thu mua nông sản, sổ sưu tập), người bán, chim bồ câu.
import { makeKit } from './kit.js';

export function initMarket(c) {
  const { THREE, add, toon, canvasTex, scene } = c, kit = makeKit(c);
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const cobble = canvasTex(128, 128, d => { d.fillStyle = '#f0e2c8'; d.fillRect(0, 0, 128, 128); d.strokeStyle = '#d8c39c'; d.lineWidth = 3; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { d.strokeRect(i * 32 + (j % 2) * 16 - 16, j * 32, 32, 32); } }, [6, 4]);
  add(g, new THREE.BoxGeometry(14, 0.4, 10), toon('#ffffff', cobble), 0, -0.2, 0, '#9a7f5a', 0.03);
  add(g, new THREE.BoxGeometry(14, 0.5, 0.3), toon('#d9b27a'), 0, 0.15, -4.8, '#8a5f3a', 0.02); // hàng rào sau
  [-5, -2.5, 0, 2.5, 5].forEach(x => add(g, new THREE.BoxGeometry(0.16, 0.9, 0.16), toon('#c29a62'), x, 0.45, -4.8, '#8a5f3a', 0.02));
  add(g, new THREE.CylinderGeometry(1.1, 1.2, 0.1, 30), toon('#ffe9c4'), 0, 0.04, 1.4, '#c29a62', 0.02); // quảng trường nhỏ giữa chợ

  const stripe = (a, b) => canvasTex(128, 64, d => { for (let i = 0; i < 8; i++) { d.fillStyle = i % 2 ? a : b; d.fillRect(i * 16, 0, 16, 64); } }, [1, 1]);
  function stall(x, z, col, light, label, goods, hat = 'vendor', ry = 0) {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
    add(s, new THREE.BoxGeometry(1.9, 0.8, 0.8), toon(light), 0, 0.4, 0, '#8a5f3a', 0.03);
    [-0.9, 0.9].forEach(sx => add(s, new THREE.BoxGeometry(0.08, 2.1, 0.08), toon('#c29a62'), sx, 1.05, -0.35, '#8a5f3a', 0.02));
    const aw = add(s, new THREE.BoxGeometry(2.2, 0.08, 1.1), toon('#ffffff', stripe(col, '#ffffff')), 0, 2.15, 0.05, '#7a5a5a', 0.02); aw.rotation.x = 0.22;
    const sg = kit.sign(label, 1.5, 0.4, '#fff7ef', '#5a3a4a', 34); sg.position.set(0, 1.78, 0.5); s.add(sg);
    goods(s);
    kit.npc({ x: 0, z: -0.65, color: '#ffe7c9', hat, parent: s });
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

  const T = 'market';
  kit.hotspot({ id: 'food', label: 'Rau quả', at: [-2.5, 2.7, -3.3], stand: [-2.2, -0.8], act: () => c.open.shop('food') }, food);
  kit.hotspot({ id: 'today', label: 'Tiệm hôm nay', at: [0, 2.7, -3.3], stand: [0, -0.8], act: () => c.open.shop('rotating') }, today);
  kit.hotspot({ id: 'weekend', label: 'Chợ cuối tuần', at: [2.5, 2.7, -3.3], stand: [2.2, -0.8], act: () => (c.state.weekend ? c.open.shop('weekend') : c.toast('Chợ cuối tuần chỉ mở thứ Bảy và Chủ nhật.')) }, wk);
  kit.hotspot({ id: 'furn', label: 'Nội thất', at: [-2.65, 2.5, -1.45], stand: [-2.2, -0.4], act: () => c.open.shop('market') }, furn);
  kit.hotspot({ id: 'sell', label: 'Thu mua rau', at: [2.65, 2.5, -1.45], stand: [2.2, -0.4], act: () => c.open.sell() }, sell);
  kit.hotspot({ id: 'book', label: 'Sổ sưu tập', at: [0, 2.3, -1.9], stand: [0, -0.5], act: () => c.open.shop('book') }, book);
  void T;

  // chim bồ câu
  const pigeons = [[-0.5, 1.9], [0.6, 1.2], [0.1, 2.1]].map(([x, z], i) => {
    const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
    add(p, new THREE.SphereGeometry(0.13, 10, 8), toon('#cfd8e3'), 0, 0.15, 0, '#556', 0.02); add(p, new THREE.SphereGeometry(0.08, 8, 8), toon('#e4eaf2'), 0.1, 0.27, 0, '#556', 0.02);
    return { p, ph: i * 2 };
  });
  kit.plant(g, -4.2, 0.6, 0.9); kit.plant(g, 4.2, 0.6, 0.9);

  return {
    group: g,
    enter() { kit.show(true); setTimeout(() => { if (c.getArea() === 'market') c.say('Rau tươi nè! Bạn mua cho mình món ngon nha.', 3000); }, 700); },
    leave() { kit.show(false); },
    update(dt, now) { kit.tick(now); const t = now / 1000; pigeons.forEach(({ p, ph }) => { p.position.y = Math.max(0, Math.sin(t * 3 + ph)) * 0.04; p.rotation.y = Math.sin(t * 0.6 + ph) * 0.8; }); },
    tap: e => kit.tap(e), sync() {},
  };
}
