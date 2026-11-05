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
  const stage = new THREE.Group(); stage.position.set(-0.2, 0, -1.0); g.add(stage);
  const disc = add(stage, new THREE.CylinderGeometry(1.0, 1.05, 0.18, 32), toon('#ffd9ec'), 0, 0.09, 0, '#a8507a', 0.03);
  [-0.7, 0.7].forEach(sx => add(stage, new THREE.SphereGeometry(0.08, 8, 8), toon('#fff6c9'), sx, 0.3, 0.7, null));
  kit.hotspot({ id: 'stage', label: 'Bục thử đồ', at: [-0.2, 1.4, -1.0], stand: [-0.2, -1.0], act: () => { c.startAction('dance'); c.spawn('sparkle', 4); c.open.wardrobe(); } }, stage);
  void disc;

  // giá treo đồ trái + quầy bán phải
  const rack = new THREE.Group(); rack.position.set(-2.4, 0, -2.5); g.add(rack);
  add(rack, new THREE.BoxGeometry(1.8, 0.07, 0.07), toon('#d9b27a'), 0, 1.9, 0, '#8a5f3a', 0.02);
  [-0.8, 0.8].forEach(sx => add(rack, new THREE.BoxGeometry(0.07, 1.9, 0.07), toon('#d9b27a'), sx, 0.95, 0, '#8a5f3a', 0.02));
  ['#ff9ec4', '#6ab7ff', '#ffd36e', '#7edb72', '#c9a6ff'].forEach((col, i) => { const m = add(rack, new THREE.BoxGeometry(0.28, 0.6, 0.08), toon(col), -0.7 + i * 0.35, 1.5, 0, '#6a4a5a', 0.02); m.rotation.z = (i % 2 ? 1 : -1) * 0.06; });
  kit.hotspot({ id: 'rack', label: 'Tủ đồ của bé', at: [-2.4, 2.4, -2.5], stand: [-2.0, -1.0], act: () => c.open.wardrobe() }, rack);
  const counter = new THREE.Group(); counter.position.set(2.2, 0, -2.45); g.add(counter);
  add(counter, new THREE.BoxGeometry(2.0, 1.0, 0.8), toon('#ffffff'), 0, 0.5, 0, '#c9a6ff', 0.03);
  add(counter, new THREE.BoxGeometry(2.1, 0.1, 0.9), toon('#ffd9ec'), 0, 1.04, 0, '#a8507a', 0.03);
  [[-0.5, '#ff9ec4'], [0, '#6ab7ff'], [0.5, '#ffd36e']].forEach(([x, col]) => add(counter, new THREE.BoxGeometry(0.34, 0.22, 0.3), toon(col), x, 1.2, 0, '#6a4a5a', 0.02));
  kit.npc({ x: 2.2, z: -3.05, color: '#fff0c9', hat: 'tailor' });
  kit.hotspot({ id: 'counter', label: 'Quầy trang phục', at: [2.2, 2.0, -2.45], stand: [2.0, -1.2], act: () => c.open.shop('market', 'outfit') }, counter);

  const mannequin = new THREE.Group(); mannequin.position.set(2.7, 0, 0.6); g.add(mannequin);
  add(mannequin, new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), toon('#8a7a9a'), 0, 0.55, 0, null);
  add(mannequin, new THREE.SphereGeometry(0.32, 14, 12), toon('#ffe0ec'), 0, 1.25, 0, '#a8507a', 0.03);
  add(mannequin, new THREE.CylinderGeometry(0.3, 0.22, 0.12, 14), toon('#8a7a9a'), 0, 0.06, 0, null);
  kit.plant(g, -3.7, 1.8, 0.9);

  return {
    group: g,
    enter() { kit.show(true); setTimeout(() => { if (c.getArea() === 'tailor') c.say('Lên bục thử đồ đi! Mình thích nhất cái nơ.', 3000); }, 700); },
    leave() { kit.show(false); }, update(dt, now) { kit.tick(now); }, tap: e => kit.tap(e), sync() {},
  };
}
