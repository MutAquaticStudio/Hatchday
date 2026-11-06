// Tiệm trà "Gió": bốn bàn tròn bốn chỗ, quầy pha trà, đèn lồng. Nơi chung (shared.js).
import { makeKit } from './kit.js';
import { makeShared } from './shared.js';

export function initTea(c) {
  const { THREE, add, toon, canvasTex } = c, kit = makeKit(c);
  const floorTex = canvasTex(128, 128, d => { d.fillStyle = '#d4a870'; d.fillRect(0, 0, 128, 128); d.strokeStyle = '#bb8f58'; d.lineWidth = 3; for (let i = 0; i < 128; i += 32) { d.beginPath(); d.moveTo(i, 0); d.lineTo(i, 128); d.stroke(); } }, [5, 5]);
  const wallTex = canvasTex(64, 64, d => { d.fillStyle = '#ffeacc'; d.fillRect(0, 0, 64, 64); d.fillStyle = '#f7d9ac'; d.fillRect(0, 0, 8, 64); }, [8, 3]);
  const g = c.shell('#ffeacc', wallTex, '#d4a870', floorTex, '#a8744a');
  const shared = makeShared(c, { placeId: 'tea', group: g });
  c.windowOn(g, 2.9, 3.0, d => { const gr = d.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#cdeaff'); gr.addColorStop(1, '#eaf7ff'); d.fillStyle = gr; d.fillRect(0, 0, 256, 192); d.fillStyle = '#7edb72'; d.beginPath(); d.arc(60, 170, 46, 0, 7); d.fill(); d.beginPath(); d.arc(190, 175, 54, 0, 7); d.fill(); });

  // quầy pha trà
  const counter = new THREE.Group(); counter.position.set(-2.4, 0, -3.0); g.add(counter);
  add(counter, new THREE.BoxGeometry(2.6, 0.95, 0.8), toon('#c29a62'), 0, 0.48, 0, '#6a4a3a', 0.03);
  add(counter, new THREE.BoxGeometry(2.7, 0.08, 0.9), toon('#e7c690'), 0, 0.98, 0, '#6a4a3a', 0.02);
  const pot = add(counter, new THREE.SphereGeometry(0.2, 14, 10), toon('#7ec8a0'), -0.6, 1.2, 0, '#3f7a60', 0.02); pot.scale.y = 0.85;
  add(counter, new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), toon('#7ec8a0'), -0.6, 1.42, 0, '#3f7a60', 0.02);
  [0.2, 0.5, 0.8].forEach(x => add(counter, new THREE.CylinderGeometry(0.1, 0.07, 0.12, 12), toon('#ffffff'), x, 1.08, 0.05, '#aaa', 0.02));
  kit.npc({ x: -2.4, z: -3.7, color: '#d4f5e6', hat: 'chef' });
  kit.hotspot({ id: 'order', label: 'Gọi món', at: [-2.4, 2.3, -2.9], stand: [-2.4, -1.7], act: () => c.open.shop('food') }, counter);

  // bốn bàn tròn
  const tables = [[0.6, -1.6], [3.0, -1.5], [-1.9, 0.5], [2.4, 1.0]];
  tables.forEach(([x, z], i) => {
    const t = new THREE.Group(); t.position.set(x, 0, z); g.add(t);
    add(t, new THREE.CylinderGeometry(0.62, 0.62, 0.08, 24), toon('#f6e0b8'), 0, 0.78, 0, '#8a5f3a', 0.03);
    add(t, new THREE.CylinderGeometry(0.08, 0.14, 0.76, 10), toon('#b98a5e'), 0, 0.38, 0, '#6a4a3a', 0.02);
    add(t, new THREE.CylinderGeometry(0.09, 0.07, 0.1, 12), toon('#ffffff'), 0.15, 0.87, 0.05, '#aaa', 0.02);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, ch = new THREE.Group(); ch.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95); t.add(ch); add(ch, new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14), toon(['#ff9ec4', '#9fd8ff', '#ffd36e', '#c9a6ff'][k]), 0, 0.42, 0, '#7a5a6a', 0.02); add(ch, new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), toon('#b98a5e'), 0, 0.2, 0, '#6a4a3a', 0.02); }
    kit.hotspot({ id: 'table' + i, label: `Bàn ${i + 1}`, at: [x, 1.7, z], stand: [x, z + 1.0], act: () => { c.say(['Trà thơm quá~', 'Ngồi đây thích ghê!', 'Mình nhâm nhi một chút nha.', 'Gió mát ghê!'][i], 2600); c.startAction('hop'); } }, t);
  });

  // đèn lồng
  [-3.6, -1.2, 1.2, 3.6].forEach((x, i) => { const l = new THREE.Group(); l.position.set(x, 3.3, -2.2 + (i % 2) * 1.6); g.add(l); add(l, new THREE.CylinderGeometry(0.01, 0.01, 0.9, 4), toon('#7a5a4a'), 0, 0.45, 0, null); const b = add(l, new THREE.SphereGeometry(0.26, 14, 10), toon(['#ff6a6a', '#ffb347', '#ff8fb8', '#ffd36e'][i]), 0, 0, 0, '#a84a4a', 0.02); b.scale.y = 1.2; });
  kit.plant(g, 3.8, -3.0, 0.9); kit.plant(g, -3.8, 1.8, 0.8);

  return {
    group: g,
    enter() { kit.show(true); shared.enter(); setTimeout(() => { if (c.getArea() === 'tea') c.say('Chạm vào một bàn để ngồi nhâm nhi nhé.', 3000); }, 900); },
    leave() { kit.show(false); shared.leave(); },
    update(dt, now) { kit.tick(now); shared.update(dt, now); },
    tap: e => shared.tap(e) || kit.tap(e), sync() {},
  };
}
