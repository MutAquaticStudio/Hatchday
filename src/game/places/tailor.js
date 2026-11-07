// Tiệm may "Kim Chỉ": gương lớn và bục thử đồ, giá treo, quầy bán trang phục, bảng bạn bè đang mặc (sau khi có bạn bè).
import { makeKit } from './kit.js';

export function initTailor(c) {
  const { THREE, add, toon, canvasTex } = c, kit = makeKit(c);
  const floorTex = canvasTex(128, 128, g => { g.fillStyle = '#f3e8ff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e4d3fa'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); }, [6, 5]);
  const wallTex = canvasTex(64, 64, g => { g.fillStyle = '#f7efff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#e8d8fb'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(8 + i * 10, 10 + (i % 2) * 22, 3, 0, 7); g.fill(); } }, [5, 3]);
  const g = c.shell('#f7efff', wallTex, '#f3e8ff', floorTex, '#c9a6ff');
  c.windowOn(g, 2.8, 3.0, d => { const gr = d.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#d8c8ff'); gr.addColorStop(1, '#fff1fa'); d.fillStyle = gr; d.fillRect(0, 0, 256, 192); });

  // gương lớn + bục xoay
  const mirror = new THREE.Group(); mirror.position.set(-0.2, 0, -3.35); g.add(mirror);
  add(mirror, new THREE.BoxGeometry(1.9, 2.8, 0.1), toon('#c9a6ff'), 0, 1.7, 0, '#6a4aa8', 0.03);
  add(mirror, new THREE.BoxGeometry(1.65, 2.55, 0.05), toon('#e8f6ff'), 0, 1.7, 0.06, null);
  add(mirror, new THREE.BoxGeometry(0.5, 2.3, 0.04), toon('#ffffff'), -0.4, 1.7, 0.1, null).rotation.z = 0.3;
  add(mirror, new THREE.CylinderGeometry(0.95, 0.95, 0.1, 24, 1, false, -Math.PI / 2, Math.PI), toon('#c9a6ff'), 0, 3.1, 0, '#6a4aa8', 0.02).rotation.x = Math.PI / 2; // vòm đỉnh
  add(mirror, new THREE.SphereGeometry(0.14, 10, 8), toon('#ffd36e'), 0, 3.95, 0.04, '#a8742e', 0.01);
  for (let i = 0; i < 7; i++) [-1, 1].forEach(sx => add(mirror, new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff6c9' }), sx * 0.92, 0.6 + i * 0.36, 0.08, null)); // bóng đèn quanh gương
  const stage = new THREE.Group(); stage.position.set(-0.2, 0, -1.0); g.add(stage);
  const disc = add(stage, new THREE.CylinderGeometry(1.0, 1.05, 0.18, 32), toon('#ffd9ec'), 0, 0.09, 0, '#a8507a', 0.03);
  [-0.7, 0.7].forEach(sx => add(stage, new THREE.SphereGeometry(0.08, 8, 8), toon('#fff6c9'), sx, 0.3, 0.7, null));
  add(stage, new THREE.TorusGeometry(1.02, 0.04, 6, 36), toon('#ffd36e'), 0, 0.18, 0, null).rotation.x = Math.PI / 2;
  add(stage, new THREE.CylinderGeometry(1.25, 1.25, 0.02, 36), toon('#c9a6ff'), 0, 0.01, 0, null); // thảm tròn dưới bục
  kit.hotspot({ id: 'stage', label: 'Bục thử đồ', at: [-0.2, 1.4, -1.0], stand: [-0.2, -1.0], act: () => { c.startAction('dance'); c.spawn('sparkle', 4); c.open.wardrobe(); } }, stage);
  void disc;

  // giá treo đồ trái + quầy bán phải
  const rack = new THREE.Group(); rack.position.set(-2.4, 0, -2.5); g.add(rack);
  add(rack, new THREE.BoxGeometry(1.8, 0.07, 0.07), toon('#d9b27a'), 0, 1.9, 0, '#8a5f3a', 0.02);
  [-0.8, 0.8].forEach(sx => add(rack, new THREE.BoxGeometry(0.07, 1.9, 0.07), toon('#d9b27a'), sx, 0.95, 0, '#8a5f3a', 0.02));
  ['#ff9ec4', '#6ab7ff', '#ffd36e', '#7edb72', '#c9a6ff'].forEach((col, i) => { // áo treo trên móc: thân, tay áo, cổ
    const x = -0.7 + i * 0.35, sh = new THREE.Group(); sh.position.set(x, 1.5, 0); sh.rotation.z = (i % 2 ? 1 : -1) * 0.05; rack.add(sh);
    add(sh, new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), toon('#8a7a9a'), 0, 0.4, 0, null);
    add(sh, new THREE.BoxGeometry(0.28, 0.04, 0.03), toon('#8a7a9a'), 0, 0.33, 0, null);
    if (i % 2) { add(sh, new THREE.ConeGeometry(0.2, 0.62, 12), toon(col), 0, 0.0, 0, '#6a4a5a', 0.015); } else { add(sh, new THREE.BoxGeometry(0.28, 0.5, 0.08), toon(col), 0, 0.05, 0, '#6a4a5a', 0.015); [-1, 1].forEach(s2 => { const sl = add(sh, new THREE.BoxGeometry(0.1, 0.24, 0.07), toon(col), s2 * 0.17, 0.18, 0, '#6a4a5a', 0.01); sl.rotation.z = s2 * 0.5; }); }
    add(sh, new THREE.SphereGeometry(0.03, 6, 5), toon('#ffffff'), 0, 0.22, 0.05, null);
  });
  [-0.5, 0.1, 0.6].forEach((x, i) => { add(rack, new THREE.CapsuleGeometry(0.06, 0.12, 4, 8), toon(['#ff7a8a', '#6ab7ff', '#ffd36e'][i]), x, 0.08, 0.15, '#6a4a5a', 0.008).rotation.z = Math.PI / 2; add(rack, new THREE.CapsuleGeometry(0.06, 0.12, 4, 8), toon(['#ff7a8a', '#6ab7ff', '#ffd36e'][i]), x + 0.15, 0.08, 0.15, '#6a4a5a', 0.008).rotation.z = Math.PI / 2; }); // giày dưới giá
  kit.hotspot({ id: 'rack', label: 'Tủ đồ của bé', at: [-2.4, 2.4, -2.5], stand: [-2.0, -1.0], act: () => c.open.wardrobe() }, rack);
  const counter = new THREE.Group(); counter.position.set(2.2, 0, -2.45); g.add(counter);
  add(counter, new THREE.BoxGeometry(2.0, 1.0, 0.8), toon('#ffffff'), 0, 0.5, 0, '#c9a6ff', 0.03);
  add(counter, new THREE.BoxGeometry(2.1, 0.1, 0.9), toon('#ffd9ec'), 0, 1.04, 0, '#a8507a', 0.03);
  [[-0.5, '#ff9ec4'], [0, '#6ab7ff'], [0.5, '#ffd36e']].forEach(([x, col]) => add(counter, new THREE.BoxGeometry(0.34, 0.22, 0.3), toon(col), x, 1.2, 0, '#6a4a5a', 0.02));
  kit.npc({ x: 0.98, z: -2.75, color: '#fff0c9', hat: 'tailor', ry: -0.25, parent: g });
  // máy may, kéo, thước dây trên quầy; kệ cuộn vải và ống chỉ trên tường
  const sm = new THREE.Group(); sm.position.set(0.55, 1.1, 0.12); counter.add(sm);
  add(sm, new THREE.BoxGeometry(0.5, 0.12, 0.24), toon('#ff9ec4'), 0, 0.06, 0, '#a8507a', 0.01); add(sm, new THREE.BoxGeometry(0.1, 0.3, 0.2), toon('#ff9ec4'), 0.2, 0.25, 0, '#a8507a', 0.01); add(sm, new THREE.BoxGeometry(0.46, 0.1, 0.2), toon('#ff9ec4'), 0.02, 0.4, 0, '#a8507a', 0.01); add(sm, new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6), toon('#cfd8e3'), -0.16, 0.28, 0, null); add(sm, new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), toon('#ffffff'), 0.27, 0.32, 0, null).rotation.z = Math.PI / 2;
  [-1, 1].forEach(s2 => add(counter, new THREE.TorusGeometry(0.05, 0.015, 6, 12), toon('#ff6a8a'), -0.75 + s2 * 0.06, 1.1, 0.25, null).rotation.x = Math.PI / 2);
  add(counter, new THREE.TorusGeometry(0.1, 0.03, 6, 16), toon('#ffd36e'), -0.2, 1.1, 0.28, null).rotation.x = Math.PI / 2;
  const wall = new THREE.Group(); wall.position.set(-2.4, 2.45, -3.4); g.add(wall);
  add(wall, new THREE.BoxGeometry(2.2, 0.08, 0.36), toon('#d9b27a'), 0, 0, 0.05, '#8a5f3a', 0.012); add(wall, new THREE.BoxGeometry(2.2, 0.08, 0.36), toon('#d9b27a'), 0, 0.62, 0.05, '#8a5f3a', 0.012);
  ['#ff9ec4', '#7ec8ff', '#ffd36e', '#7edb72', '#c9a6ff'].forEach((col, i) => add(wall, new THREE.CylinderGeometry(0.13, 0.13, 0.32, 14), toon(col), -0.8 + i * 0.4, 0.17, 0.08, '#6a4a5a', 0.01).rotation.x = Math.PI / 2); // cuộn vải
  for (let i = 0; i < 8; i++) { const x = -0.95 + i * 0.27; add(wall, new THREE.CylinderGeometry(0.07, 0.07, 0.16, 10), toon(['#ff6a8a', '#ffd36e', '#6ab7ff', '#7edb72', '#c9a6ff', '#ff9a5a', '#ffffff', '#3a3a5a'][i]), x, 0.12 + 0.62, 0.08, null); add(wall, new THREE.CylinderGeometry(0.085, 0.085, 0.02, 10), toon('#d9b27a'), x, 0.04 + 0.62, 0.08, null); add(wall, new THREE.CylinderGeometry(0.085, 0.085, 0.02, 10), toon('#d9b27a'), x, 0.21 + 0.62, 0.08, null); } // ống chỉ
  // phòng thử đồ có rèm (góc trái trước) + bản phác thảo dán tường
  const booth = new THREE.Group(); booth.position.set(-3.55, 0, -0.2); g.add(booth);
  add(booth, new THREE.TorusGeometry(0.6, 0.03, 6, 24, Math.PI), toon('#d9b27a'), 0, 2.4, 0, null).rotation.x = Math.PI / 2;
  add(booth, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), toon('#d9b27a'), 0.6, 1.2, 0, null); add(booth, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), toon('#d9b27a'), -0.6, 1.2, 0, null);
  const drapeT = canvasTex(64, 64, d => { const gr = d.createLinearGradient(0, 0, 64, 0); for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, i % 2 ? '#e8a6d8' : '#ffc9ec'); d.fillStyle = gr; d.fillRect(0, 0, 64, 64); });
  const cur = add(booth, new THREE.CylinderGeometry(0.6, 0.62, 2.2, 20, 1, true, 0, Math.PI * 0.9), toon('#ffffff', drapeT), 0, 1.25, 0, '#a8507a', 0.012); cur.material.side = THREE.DoubleSide; cur.rotation.y = Math.PI * 0.55;
  [[1.45, 2.3], [1.95, 2.0], [-3.2, 1.4]].forEach(([x, y], i) => { add(g, new THREE.BoxGeometry(0.4, 0.5, 0.02), toon('#fffdf5'), x - 0.2, y, -3.47, '#c9a6ff', 0.006).rotation.z = (i - 1) * 0.1; add(g, new THREE.ConeGeometry(0.1, 0.24, 8), toon(['#ff9ec4', '#7ec8ff', '#ffd36e'][i]), x - 0.2, y - 0.04, -3.44, null); add(g, new THREE.SphereGeometry(0.025, 6, 5), toon('#ff6a8a'), x - 0.2, y + 0.22, -3.44, null); });
  kit.hotspot({ id: 'counter', label: 'Quầy trang phục', at: [2.2, 2.0, -2.45], stand: [2.0, -1.2], act: () => c.open.shop('market', 'outfit') }, counter);

  const mannequin = new THREE.Group(); mannequin.position.set(2.7, 0, 0.6); g.add(mannequin);
  add(mannequin, new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), toon('#8a7a9a'), 0, 0.55, 0, null);
  add(mannequin, new THREE.SphereGeometry(0.32, 14, 12), toon('#ffe0ec'), 0, 1.25, 0, '#a8507a', 0.03);
  add(mannequin, new THREE.CylinderGeometry(0.3, 0.22, 0.12, 14), toon('#8a7a9a'), 0, 0.06, 0, null);
  add(mannequin, new THREE.ConeGeometry(0.42, 0.6, 18), toon('#ff9ec4'), 0, 1.0, 0, '#a8507a', 0.015); // váy
  add(mannequin, new THREE.TorusGeometry(0.3, 0.04, 6, 20), toon('#ffffff'), 0, 1.25, 0, null).rotation.x = Math.PI / 2;
  [-1, 1].forEach(sx => add(mannequin, new THREE.ConeGeometry(0.09, 0.18, 4), toon('#ff6a8a'), sx * 0.1, 1.42, 0.28, null).rotation.z = sx * Math.PI / 2); add(mannequin, new THREE.SphereGeometry(0.05, 8, 6), toon('#ff6a8a'), 0, 1.42, 0.3, null); // nơ
  kit.plant(g, -3.7, 1.8, 0.9);

  return {
    group: g,
    enter() { kit.show(true); setTimeout(() => { if (c.getArea() === 'tailor') c.say('Lên bục thử đồ đi! Mình thích nhất cái nơ.', 3000); }, 700); },
    leave() { kit.show(false); }, update(dt, now) { kit.tick(now); }, tap: e => kit.tap(e), sync() {},
  };
}
