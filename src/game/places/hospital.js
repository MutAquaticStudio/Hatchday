// Bệnh viện "Nhà thuốc Bông": sảnh có quầy tiếp đón, quầy thuốc 8 lọ, giường khám, bảng sổ bệnh, ghế chờ. Hotspot mở lại Sổ sức khoẻ.
import { _t } from '../../i18n';
import { makeKit } from './kit.js';
import { MEDICINES } from '../health';

export function initHospital(c) {
  const { THREE, add, toon, canvasTex } = c, kit = makeKit(c);
  const ease = u => u * u * (3 - 2 * u), lerp = (a, b, k) => a + (b - a) * k;
  const arc = (a, b, k, h) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k) + Math.sin(k * Math.PI) * h, lerp(a[2], b[2], k)];
  /** Ba điểm "việc y tế" dùng chung một cách tương tác: bé đi tới đứng cạnh (không chồng vào đồ vật), làm một động tác ngắn, rồi mở đúng mục của Sổ sức khoẻ. */
  const inspect = (yaw, then) => c.script({ dur: 0.95, noWalk: true, update: u => ({ face: yaw, stretch: 0.07 * Math.sin(u * Math.PI), hop: 0.05 * Math.sin(u * Math.PI) }) }).then(() => then());
  /** Nằm lên giường khám: nhảy lên, nằm thở nhẹ, rồi xuống lại chỗ đứng cạnh giường. */
  function lieOnBed() {
    const [fx, fz] = c.getPetXZ(), top = [2.45, 0.74, -0.35], out = [2.3, 0, 0.85];
    c.say(c.state.illness ? _t('Nằm xuống đây để bác sĩ khám nhé.') : _t('Mình đang khoẻ mà, nhưng nằm thử cũng êm ghê!'), 2600);
    return c.script({ dur: 3.4, noWalk: true, update: (u, t) => {
      if (u < 0.18) return { pos: arc([fx, 0, fz], top, ease(u / 0.18), 0.5), stretch: Math.sin(u / 0.18 * Math.PI) * 0.1 };
      if (u > 0.84) return { pos: arc(top, out, ease((u - 0.84) / 0.16), 0.45), face: 0 };
      return { pos: top, roll: Math.sin(t * 1.8) * 0.04, stretch: -0.08 + Math.sin(t * 1.8) * 0.015, face: 0 };
    } }).then(() => c.open.clinic('status'));
  }
  /** Ngồi ghế chờ: nhảy lên ghế, ngó quanh, ngáp, đung đưa nhẹ, rồi nhảy xuống. */
  function sitWait() {
    const [fx, fz] = c.getPetXZ(), seat = [-2.38, 0.52, 1.5], front = [-1.4, 0, 1.5]; let sat = false, yawned = false;
    return c.script({ dur: 6.8, noWalk: true, update: (u, t) => {
      if (u < 0.1) return { pos: arc([fx, 0, fz], seat, ease(u / 0.1), 0.45), face: Math.PI / 2, stretch: Math.sin(u / 0.1 * Math.PI) * 0.1 };
      if (!sat) { sat = true; c.sfx('sit'); }
      if (u > 0.9) return { pos: arc(seat, front, ease((u - 0.9) / 0.1), 0.4), face: Math.PI / 2 };
      if (!yawned && u > 0.5) { yawned = true; c.spawn('zzz', 1); c.say(_t('Ngồi chờ hơi buồn ngủ nhỉ…'), 2000); }
      return { pos: seat, face: Math.PI / 2 + Math.sin(t * 0.9) * 0.55, roll: Math.sin(t * 2.2) * 0.04, stretch: -0.07 + Math.sin(t * 1.7) * 0.012, hop: Math.max(0, Math.sin(t * 4.4)) * 0.015 };
    }, done: ok => { if (ok) c.say(_t('Nghỉ xíu khoẻ hẳn!'), 1800); } });
  }
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
  kit.hotspot({ id: 'chart', label: _t('Sổ bệnh'), at: [0.9, 2.2, -3.2], stand: [0.9, -1.4], act: () => inspect(Math.PI, () => c.open.clinic('book')) }, board);

  // quầy tiếp đón + y tá
  const desk = new THREE.Group(); desk.position.set(-1.7, 0, -2.45); g.add(desk);
  add(desk, new THREE.BoxGeometry(2.3, 1.0, 0.8), toon('#ffffff'), 0, 0.5, 0, '#9fdcc8', 0.03);
  add(desk, new THREE.BoxGeometry(2.4, 0.1, 0.9), toon('#ffb3c9'), 0, 1.04, 0, '#a8507a', 0.03);
  add(desk, new THREE.BoxGeometry(0.5, 0.36, 0.06), toon('#4a4458'), -0.5, 1.28, -0.1, '#2a2430', 0.02);
  add(desk, new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), toon('#ffd36e'), 0.6, 1.13, 0.1, '#a8742e', 0.02);
  // chi tiết quầy: cốc bút, chồng giấy, chậu cây nhỏ
  { const pc = add(desk, new THREE.CylinderGeometry(0.07, 0.06, 0.14, 10), toon('#9fdcc8'), 0.15, 1.16, 0.15, '#4a8a78', 0.01); [[-0.02, '#ff6a8a'], [0.03, '#6ab7ff']].forEach(([dx, col]) => add(pc, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 5), toon(col), dx, 0.14, 0, null));
    [0, 0.03].forEach((dy, i) => add(desk, new THREE.BoxGeometry(0.34, 0.025, 0.24), toon(i ? '#fff3c4' : '#ffffff'), -0.9, 1.1 + dy, 0.1, '#bbb', 0.008).rotation.y = i * 0.2);
    const sp = add(desk, new THREE.CylinderGeometry(0.08, 0.06, 0.1, 10), toon('#e8a07a'), 0.95, 1.14, 0.2, '#9a5f4a', 0.01); add(sp, new THREE.SphereGeometry(0.1, 10, 8), toon('#7edb72'), 0, 0.12, 0, '#3f8a55', 0.01); }
  kit.npc({ x: -0.25, z: -2.75, color: '#ffffff', hat: 'nurse', ry: -0.2, parent: g });
  kit.hotspot({ id: 'desk', label: _t('Quầy tiếp đón'), at: [-1.7, 2.0, -2.45], stand: [-1.7, -1.35], act: () => inspect(Math.PI, () => c.open.clinic('status')) }, desk);

  // kệ thuốc 8 lọ
  const shelf = new THREE.Group(); shelf.position.set(2.5, 0, -3.1); g.add(shelf);
  add(shelf, new THREE.BoxGeometry(2.0, 2.6, 0.5), toon('#f6e7d2'), 0, 1.3, 0, '#9a5f4a', 0.03);
  [0.55, 1.45, 2.3].forEach(y => add(shelf, new THREE.BoxGeometry(1.9, 0.07, 0.62), toon('#d9b27a'), 0, y, 0.12, '#8a5f3a', 0.01)); // ván kệ nhô ra khỏi thân tủ
  add(shelf, new THREE.BoxGeometry(0.34, 0.1, 0.05), toon('#ff4d6d'), 0, 2.45, 0.27, null); add(shelf, new THREE.BoxGeometry(0.1, 0.34, 0.05), toon('#ff4d6d'), 0, 2.45, 0.27, null); // dấu thập trên tủ
  const colors = ['#ff9ec4', '#7edb72', '#ffd36e', '#6ab7ff', '#c9a6ff', '#ff8f6a', '#5fd3c8', '#ffb3c9'];
  MEDICINES.forEach((m, i) => { const row = i < 4 ? 1.45 : 0.55, col = i % 4, x = -0.7 + col * 0.46; // lọ đặt ở mép trước ván để nhìn thấy từ camera
    add(shelf, new THREE.CylinderGeometry(0.12, 0.13, 0.36, 12), toon(colors[i]), x, row + 0.22, 0.3, '#6a4a5a', 0.02); add(shelf, new THREE.CylinderGeometry(0.075, 0.075, 0.08, 10), toon('#ffffff'), x, row + 0.44, 0.3, '#6a4a5a', 0.012);
    add(shelf, new THREE.BoxGeometry(0.17, 0.13, 0.02), toon('#ffffff'), x, row + 0.2, 0.425, null); add(shelf, new THREE.BoxGeometry(0.1, 0.025, 0.02), toon(colors[i]), x, row + 0.2, 0.437, null); });
  kit.hotspot({ id: 'shelf', label: _t('Quầy thuốc'), at: [2.5, 2.9, -2.7], stand: [2.3, -1.35], act: () => inspect(Math.PI, () => c.open.clinic('cabinet')) }, shelf);

  // giường khám + bác sĩ
  const bed = new THREE.Group(); bed.position.set(2.2, 0, -0.35); bed.rotation.y = -Math.PI / 2; g.add(bed);
  add(bed, new THREE.BoxGeometry(1.2, 0.35, 2.0), toon('#ffffff'), 0, 0.3, 0, '#9fdcc8', 0.03);
  add(bed, new THREE.BoxGeometry(1.1, 0.14, 1.9), toon('#cfeeff'), 0, 0.55, 0, '#6a9ac8', 0.03);
  add(bed, new THREE.BoxGeometry(1.12, 0.1, 1.1), toon('#6ab7ff'), 0, 0.66, 0.3, '#3a6aa8', 0.03);
  add(bed, new THREE.BoxGeometry(0.7, 0.12, 0.4), toon('#ffffff'), 0, 0.66, -0.7, '#9fdcc8', 0.03);
  // chi tiết giường: gối tròn, sọc chăn, thành giường và chân có bánh xe
  const pil = add(bed, new THREE.SphereGeometry(0.34, 14, 10), toon('#ffffff'), 0, 0.76, -0.72, '#9fdcc8', 0.02); pil.scale.set(1.15, 0.45, 0.8);
  [-0.18, 0.1].forEach(z => add(bed, new THREE.BoxGeometry(1.13, 0.012, 0.07), toon('#ffffff'), 0, 0.717, 0.4 + z, null));
  [-0.6, 0.6].forEach(x => { add(bed, new THREE.BoxGeometry(0.04, 0.22, 1.6), toon('#cfd8e3'), x, 0.75, 0.05, null); [-0.8, 0.8].forEach(z => { add(bed, new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), toon('#6a7a8a'), x * 0.8, 0.07, z, '#3a4a5a', 0.01); }); });
  // cột truyền dịch cạnh giường: cột, túi dịch, ống nhỏ giọt
  { const iv = new THREE.Group(); iv.position.set(3.0, 0, 0.45); g.add(iv);
    add(iv, new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8), toon('#cfd8e3'), 0, 1.1, 0, '#6a7a8a', 0.01); add(iv, new THREE.CylinderGeometry(0.2, 0.22, 0.04, 14), toon('#6a7a8a'), 0, 0.03, 0, null);
    add(iv, new THREE.BoxGeometry(0.5, 0.03, 0.03), toon('#cfd8e3'), 0, 2.2, 0, null);
    const bag = add(iv, new THREE.CylinderGeometry(0.1, 0.12, 0.34, 12), toon('#dff6ff'), 0.18, 2.0, 0, '#6a9ac8', 0.012); bag.material.transparent = true; bag.material.opacity = 0.9;
    add(iv, new THREE.CylinderGeometry(0.075, 0.075, 0.18, 12), toon('#7ec8ff'), 0.18, 1.94, 0, null); }
  const curtain = add(g, new THREE.BoxGeometry(0.06, 1.9, 1.7), toon('#ffe0ec'), 3.35, 1.5, -0.35, '#c98aa8', 0.02);
  add(g, new THREE.BoxGeometry(0.08, 0.08, 1.9), toon('#cfd8e3'), 3.35, 2.5, -0.35, null);
  kit.npc({ x: 1.05, z: -0.55, color: '#e0f2ff', hat: 'doctor', ry: Math.PI / 2, parent: g });
  kit.hotspot({ id: 'bed', label: _t('Giường khám'), at: [2.2, 1.5, -0.35], stand: [2.3, 0.85], act: () => lieOnBed() }, bed);
  void curtain;

  // ghế chờ, thảm, cây
  const bn = kit.bench(g, -2.45, 1.5, Math.PI / 2, '#a8e6cf');
  kit.hotspot({ id: 'bench', label: _t('Ghế chờ'), at: [-2.45, 1.4, 1.5], stand: [-1.4, 1.5], act: () => sitWait() }, bn);
  { const mat = canvasTex(128, 80, d => { d.fillStyle = '#d6f3e8'; d.fillRect(0, 0, 128, 80); d.strokeStyle = '#9fdcc8'; d.lineWidth = 6; d.strokeRect(6, 6, 116, 68); d.fillStyle = '#ffffff'; d.fillRect(58, 24, 12, 32); d.fillRect(48, 34, 32, 12); }); // thảm chữ nhật có chữ thập
    const rm = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.1), toon('#ffffff', mat)); rm.rotation.x = -Math.PI / 2; rm.position.set(-1.6, 0.015, 1.2); rm.receiveShadow = true; g.add(rm); }
  kit.plant(g, -3.7, -2.9); kit.plant(g, 3.8, 1.8, 0.85);

  return {
    group: g,
    enter() { kit.show(true); setTimeout(() => { if (c.getArea() === 'hospital') c.say(c.state.illness ? _t('Bé ốm rồi à? Lại quầy tiếp đón hoặc giường khám nhé.') : _t('Chào bạn! Bé khoẻ mạnh thì cứ ghé chơi nha.'), 3200); }, 700); },
    leave() { kit.show(false); },
    update(dt, now) { kit.tick(now); },
    tap: e => kit.tap(e),
    sync() {},
  };
}
