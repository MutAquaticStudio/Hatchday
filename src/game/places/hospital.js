// Bệnh viện "Nhà thuốc Bông": sảnh có quầy tiếp đón, quầy thuốc 8 lọ, giường khám, bảng sổ bệnh, ghế chờ. Hotspot mở lại Sổ sức khoẻ.
import { makeKit } from './kit.js';
import { MEDICINES } from '../health';

export function initHospital(c) {
  const { THREE, add, toon, canvasTex } = c, kit = makeKit(c);
  const floorTex = canvasTex(128, 128, g => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#d6f3e8'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); }, [6, 5]);
  const g = c.shell('#eafaf4', null, '#ffffff', floorTex, '#9fdcc8');
  c.windowOn(g, 2.6, 3.0, d => { const gr = d.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#9fe0ff'); gr.addColorStop(1, '#eafcff'); d.fillStyle = gr; d.fillRect(0, 0, 256, 192); d.fillStyle = '#7edb72'; d.fillRect(0, 150, 256, 42); d.fillStyle = '#fff'; d.beginPath(); d.arc(70, 70, 20, 0, 7); d.arc(96, 62, 24, 0, 7); d.fill(); });

  // dấu thập đỏ trên tường
  add(g, new THREE.CylinderGeometry(0.55, 0.55, 0.06, 28), toon('#ffffff'), -0.6, 3.5, -3.45, '#9fdcc8', 0.03).rotation.x = Math.PI / 2;
  add(g, new THREE.BoxGeometry(0.62, 0.17, 0.07), toon('#ff4d6d'), -0.6, 3.5, -3.4, null); add(g, new THREE.BoxGeometry(0.17, 0.62, 0.07), toon('#ff4d6d'), -0.6, 3.5, -3.4, null);

  // bảng sổ bệnh / mẹo
  const board = new THREE.Group(); board.position.set(0.9, 2.2, -3.45); g.add(board);
  add(board, new THREE.BoxGeometry(1.5, 1.05, 0.08), toon('#d9b27a'), 0, 0, 0, '#8a5f3a', 0.03);
  [['#fff7ef', -0.42, 0.18], ['#ffe0ec', 0.1, 0.22], ['#e0f4ff', 0.46, 0.1], ['#fff3c4', -0.2, -0.22], ['#e3f7ea', 0.34, -0.24]].forEach(([col, px, py]) => add(board, new THREE.BoxGeometry(0.4, 0.34, 0.03), toon(col), px, py, 0.06, null));
  kit.hotspot({ id: 'chart', label: 'Sổ bệnh', at: [0.9, 2.2, -3.2], stand: [0.9, -1.4], act: () => c.open.clinic('book') }, board);

  // quầy tiếp đón + y tá
  const desk = new THREE.Group(); desk.position.set(-1.7, 0, -2.45); g.add(desk);
  add(desk, new THREE.BoxGeometry(2.3, 1.0, 0.8), toon('#ffffff'), 0, 0.5, 0, '#9fdcc8', 0.03);
  add(desk, new THREE.BoxGeometry(2.4, 0.1, 0.9), toon('#ffb3c9'), 0, 1.04, 0, '#a8507a', 0.03);
  add(desk, new THREE.BoxGeometry(0.5, 0.36, 0.06), toon('#4a4458'), -0.5, 1.28, -0.1, '#2a2430', 0.02);
  add(desk, new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), toon('#ffd36e'), 0.6, 1.13, 0.1, '#a8742e', 0.02);
  kit.npc({ x: -1.7, z: -3.05, color: '#ffffff', hat: 'nurse' });
  kit.hotspot({ id: 'desk', label: 'Quầy tiếp đón', at: [-1.7, 2.0, -2.45], stand: [-1.7, -1.35], act: () => c.open.clinic('status') }, desk);

  // kệ thuốc 8 lọ
  const shelf = new THREE.Group(); shelf.position.set(2.5, 0, -3.1); g.add(shelf);
  add(shelf, new THREE.BoxGeometry(2.0, 2.6, 0.5), toon('#f6e7d2'), 0, 1.3, 0, '#9a5f4a', 0.03);
  [0.55, 1.45].forEach(y => add(shelf, new THREE.BoxGeometry(1.9, 0.07, 0.55), toon('#d9b27a'), 0, y, 0.04, null));
  const colors = ['#ff9ec4', '#7edb72', '#ffd36e', '#6ab7ff', '#c9a6ff', '#ff8f6a', '#5fd3c8', '#ffb3c9'];
  MEDICINES.forEach((m, i) => { const row = i < 4 ? 1.45 : 0.55, col = i % 4; add(shelf, new THREE.CylinderGeometry(0.12, 0.13, 0.36, 12), toon(colors[i]), -0.7 + col * 0.46, row + 0.22, 0.08, '#6a4a5a', 0.02); add(shelf, new THREE.BoxGeometry(0.1, 0.07, 0.1), toon('#ffffff'), -0.7 + col * 0.46, row + 0.45, 0.08, null); });
  kit.hotspot({ id: 'shelf', label: 'Quầy thuốc', at: [2.5, 2.9, -2.7], stand: [2.3, -1.35], act: () => c.open.clinic('cabinet') }, shelf);

  // giường khám + bác sĩ
  const bed = new THREE.Group(); bed.position.set(2.2, 0, -0.35); bed.rotation.y = -Math.PI / 2; g.add(bed);
  add(bed, new THREE.BoxGeometry(1.2, 0.35, 2.0), toon('#ffffff'), 0, 0.3, 0, '#9fdcc8', 0.03);
  add(bed, new THREE.BoxGeometry(1.1, 0.14, 1.9), toon('#cfeeff'), 0, 0.55, 0, '#6a9ac8', 0.03);
  add(bed, new THREE.BoxGeometry(1.12, 0.1, 1.1), toon('#6ab7ff'), 0, 0.66, 0.3, '#3a6aa8', 0.03);
  add(bed, new THREE.BoxGeometry(0.7, 0.12, 0.4), toon('#ffffff'), 0, 0.66, -0.7, '#9fdcc8', 0.03);
  const curtain = add(g, new THREE.BoxGeometry(0.06, 1.9, 1.7), toon('#ffe0ec'), 3.35, 1.5, -0.35, '#c98aa8', 0.02);
  add(g, new THREE.BoxGeometry(0.08, 0.08, 1.9), toon('#cfd8e3'), 3.35, 2.5, -0.35, null);
  kit.npc({ x: 1.05, z: -0.55, color: '#e0f2ff', hat: 'doctor', ry: Math.PI / 2 });
  kit.hotspot({ id: 'bed', label: 'Giường khám', at: [2.2, 1.5, -0.35], stand: [1.45, -0.2], act: () => { c.say(c.state.illness ? 'Nằm xuống đây để bác sĩ khám nhé.' : 'Mình đang khoẻ mà, nhưng nằm thử cũng êm ghê!', 2800); c.open.clinic('status'); } }, bed);
  void curtain;

  // ghế chờ, thảm, cây
  const bn = kit.bench(g, -2.45, 1.5, Math.PI / 2, '#a8e6cf');
  kit.hotspot({ id: 'bench', label: 'Ghế chờ', at: [-2.45, 1.4, 1.5], stand: [-1.5, 1.45], act: () => { c.say('Ngồi chờ một chút nhé, không lâu đâu.', 2600); c.startAction('look'); } }, bn);
  add(g, new THREE.CylinderGeometry(1.4, 1.4, 0.05, 36), toon('#d6f3e8'), 0.2, 0.03, 0.8, '#7cc9b0', 0.02);
  kit.plant(g, -3.7, -2.9); kit.plant(g, 3.8, 1.8, 0.85);

  return {
    group: g,
    enter() { kit.show(true); setTimeout(() => { if (c.getArea() === 'hospital') c.say(c.state.illness ? 'Bé ốm rồi à? Lại quầy tiếp đón hoặc giường khám nhé.' : 'Chào bạn! Bé khoẻ mạnh thì cứ ghé chơi nha.', 3200); }, 700); },
    leave() { kit.show(false); },
    update(dt, now) { kit.tick(now); },
    tap: e => kit.tap(e),
    sync() {},
  };
}
