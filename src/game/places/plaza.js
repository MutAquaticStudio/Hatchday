// Quảng trường "Mầm": khu gặp gỡ. Đài phun nước, ghế đá, cây, bảng tin, bưu điện, biển chỉ đường; thú của người chơi khác (shared.js).
import { makeKit } from './kit.js';
import { makeShared } from './shared.js';
import { festival } from './festival.js';

export function initPlaza(c) {
  const { THREE, add, toon, canvasTex, scene } = c, kit = makeKit(c);
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const shared = makeShared(c, { placeId: 'plaza', group: g });
  const grass = canvasTex(128, 128, d => { d.fillStyle = '#bfeaa0'; d.fillRect(0, 0, 128, 128); d.fillStyle = '#a8da86'; for (let i = 0; i < 40; i++) d.fillRect((i * 37) % 128, (i * 53) % 128, 3, 6); }, [8, 6]);
  const paving = canvasTex(128, 128, d => { d.fillStyle = '#f4e8d4'; d.fillRect(0, 0, 128, 128); d.strokeStyle = '#dccaa8'; d.lineWidth = 3; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) d.strokeRect(i * 32 + (j % 2) * 16 - 16, j * 32, 32, 32); }, [5, 4]);
  add(g, new THREE.BoxGeometry(18, 0.4, 12), toon('#ffffff', grass), 0, -0.2, 0, '#6aa05a', 0.03);
  add(g, new THREE.CylinderGeometry(6.4, 6.6, 0.12, 48), toon('#ffffff', paving), 0, 0.02, 0.3, '#c9b48a', 0.02);

  // đài phun nước
  const fountain = new THREE.Group(); fountain.position.set(0, 0, -1.4); g.add(fountain);
  add(fountain, new THREE.CylinderGeometry(1.7, 1.8, 0.45, 32), toon('#e9eef7'), 0, 0.28, 0, '#8896b0', 0.03);
  add(fountain, new THREE.CylinderGeometry(1.5, 1.5, 0.08, 32), toon('#8ed6ff'), 0, 0.5, 0, null);
  add(fountain, new THREE.CylinderGeometry(0.22, 0.3, 1.1, 14), toon('#e9eef7'), 0, 0.9, 0, '#8896b0', 0.03);
  add(fountain, new THREE.CylinderGeometry(0.7, 0.4, 0.15, 24), toon('#e9eef7'), 0, 1.3, 0, '#8896b0', 0.03);
  const jets = [0, 1, 2, 3, 4, 5].map(i => { const m = add(fountain, new THREE.SphereGeometry(0.07, 8, 6), toon('#bfe8ff'), 0, 1.4, 0, null); m.userData.i = i; return m; });

  // cây, đèn, ghế đá
  const tree = (x, z, s = 1) => { const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); g.add(t); add(t, new THREE.CylinderGeometry(0.14, 0.2, 1.0, 10), toon('#b98a5e'), 0, 0.5, 0, '#6a4a3a', 0.02); add(t, new THREE.SphereGeometry(0.85, 14, 12), toon('#7edb72'), 0, 1.5, 0, '#3f8a55', 0.03); add(t, new THREE.SphereGeometry(0.55, 12, 10), toon('#92e386'), 0.35, 1.9, 0.1, '#3f8a55', 0.03); return t; };
  tree(-7, -3.2); tree(7, -3.2); tree(-7.4, 2.4, 0.9); tree(7.4, 2.4, 0.9);
  [[-4.4, -3.4], [4.4, -3.4]].forEach(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 0, z); g.add(l); add(l, new THREE.CylinderGeometry(0.06, 0.08, 2.3, 8), toon('#7a6a8a'), 0, 1.15, 0, '#443', 0.02); add(l, new THREE.SphereGeometry(0.2, 12, 10), toon('#fff3b0'), 0, 2.4, 0, '#c9a84a', 0.02); });
  kit.bench(g, -3.4, -2.0, 0.3); kit.bench(g, 3.4, -2.0, -0.3); kit.bench(g, -3.6, 2.5, Math.PI - 0.3); kit.bench(g, 3.6, 2.5, Math.PI + 0.3);

  // bảng tin (mở mục Thông báo)
  const board = new THREE.Group(); board.position.set(-5.4, 0, -0.6); board.rotation.y = 0.5; g.add(board);
  [-0.55, 0.55].forEach(x => add(board, new THREE.BoxGeometry(0.1, 1.9, 0.1), toon('#c29a62'), x, 0.95, 0, '#8a5f3a', 0.02));
  const bs = kit.sign('Bảng tin', 1.4, 0.9, '#fff3c4', '#7a5a1a', 40); bs.position.set(0, 1.45, 0.08); board.add(bs);
  kit.hotspot({ id: 'news', label: 'Bảng tin', at: [-5.4, 2.4, -0.5], stand: [-4.4, 0.4], act: () => c.open.news() }, board);

  // bưu điện (mở hộp thư)
  const post = new THREE.Group(); post.position.set(5.4, 0, -0.6); post.rotation.y = -0.5; g.add(post);
  add(post, new THREE.BoxGeometry(0.7, 1.1, 0.6), toon('#ff7a8a'), 0, 0.85, 0, '#a83a4a', 0.03);
  add(post, new THREE.CylinderGeometry(0.35, 0.35, 0.6, 18, 1, false, 0, Math.PI), toon('#ff7a8a'), 0, 1.4, 0, '#a83a4a', 0.03).rotation.z = Math.PI / 2;
  add(post, new THREE.BoxGeometry(0.4, 0.06, 0.04), toon('#2a2230'), 0, 1.1, 0.31, null);
  add(post, new THREE.BoxGeometry(0.16, 0.5, 0.16), toon('#7a6a8a'), 0, 0.25, 0, '#443', 0.02);
  kit.hotspot({ id: 'mail', label: 'Bưu điện', at: [5.4, 2.1, -0.5], stand: [4.4, 0.4], act: () => c.open.mail() }, post);

  // biển chỉ đường
  const signs = [['market', 'Chợ Xanh', -2.6, -3.9], ['hospital', 'Bệnh viện', 0, -4.2], ['tea', 'Tiệm trà', 2.6, -3.9], ['park', 'Công viên', 5.8, 2.8]];
  signs.forEach(([id, name, x, z]) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); g.add(s);
    add(s, new THREE.BoxGeometry(0.1, 1.4, 0.1), toon('#c29a62'), 0, 0.7, 0, '#8a5f3a', 0.02);
    const sg = kit.sign(name, 1.3, 0.4, '#e4f6ff', '#2f5a7a', 34); sg.position.set(0, 1.4, 0.07); s.add(sg);
    kit.hotspot({ id: 'go-' + id, label: name, at: [x, 2.0, z], stand: [x, Math.min(3, z + 1.1)], act: () => c.goTo(id) }, s);
  });

  let decor = { theme: null, group: null };
  function applyDecor() {
    const th = (c.events && c.events.decor()) || null;
    if (th === decor.theme) return;
    if (decor.group) { g.remove(decor.group); decor.group = null; }
    decor.theme = th; if (th) { decor.group = festival(c, th); g.add(decor.group); }
  }
  return {
    group: g,
    enter() { applyDecor(); kit.show(true); shared.enter(); setTimeout(() => { if (c.getArea() === 'plaza') c.say('Chạm vào bạn khác để chào hỏi và kết bạn nhé!', 3200); }, 900); },
    leave() { kit.show(false); shared.leave(); },
    update(dt, now) {
      kit.tick(now); const t = now / 1000;
      jets.forEach(j => { const ph = (t * 1.4 + j.userData.i / 6) % 1, a = j.userData.i * Math.PI / 3; j.position.set(Math.cos(a) * ph * 0.9, 1.4 + Math.sin(ph * Math.PI) * 0.7, Math.sin(a) * ph * 0.9); });
      shared.update(dt, now);
    },
    tap: e => shared.tap(e) || kit.tap(e), sync() {},
  };
}
