// Công viên "Cỏ Non": ao có vịt, xích đu, bập bênh, vườn hoa, bóng chung. Nơi chung (shared.js).
import { makeKit } from './kit.js';
import { makeShared } from './shared.js';

export function initPark(c) {
  const { THREE, add, toon, canvasTex, scene } = c, kit = makeKit(c);
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const shared = makeShared(c, { placeId: 'park', group: g });
  const grass = canvasTex(128, 128, d => { d.fillStyle = '#b6e89a'; d.fillRect(0, 0, 128, 128); d.fillStyle = '#9ed97e'; for (let i = 0; i < 50; i++) d.fillRect((i * 41) % 128, (i * 59) % 128, 3, 7); d.fillStyle = '#fff6b0'; for (let i = 0; i < 6; i++) d.fillRect((i * 83) % 128, (i * 47) % 128, 4, 4); }, [9, 6]);
  add(g, new THREE.BoxGeometry(20, 0.4, 13), toon('#ffffff', grass), 0, -0.2, 0, '#6aa05a', 0.03);
  add(g, new THREE.BoxGeometry(20, 0.5, 0.3), toon('#d9b27a'), 0, 0.15, -5.2, '#8a5f3a', 0.02);

  // ao và vịt
  const pond = new THREE.Group(); pond.position.set(-4.0, 0, -1.8); g.add(pond);
  const water = add(pond, new THREE.CylinderGeometry(1.9, 1.9, 0.06, 36), toon('#8ed6ff'), 0, 0.03, 0, '#4a90c0', 0.03); water.scale.z = 0.7;
  const rim = add(pond, new THREE.TorusGeometry(1.9, 0.12, 8, 36), toon('#d9d2c4'), 0, 0.06, 0, '#8a8478', 0.02); rim.rotation.x = Math.PI / 2; rim.scale.y = 0.7;
  const ducks = [[-0.5, 0.1], [0.6, -0.2]].map(([x, z], i) => { const d = new THREE.Group(); d.position.set(x, 0.1, z); pond.add(d); add(d, new THREE.SphereGeometry(0.2, 12, 10), toon('#fff3a0'), 0, 0.14, 0, '#c9a84a', 0.02); add(d, new THREE.SphereGeometry(0.12, 10, 8), toon('#fff3a0'), 0.17, 0.3, 0, '#c9a84a', 0.02); add(d, new THREE.ConeGeometry(0.05, 0.1, 6), toon('#ff9a3a'), 0.3, 0.3, 0, null).rotation.z = -Math.PI / 2; return { d, ph: i * 2.4, x, z }; });
  kit.hotspot({ id: 'duck', label: 'Cho vịt ăn', at: [-4.0, 1.5, -1.8], stand: [-2.6, -0.2], act: () => { c.spawn('sparkle', 4, 0.8); c.playToy('ducks'); } }, pond);

  // xích đu
  const swing = new THREE.Group(); swing.position.set(3.8, 0, -2.2); g.add(swing);
  [-0.8, 0.8].forEach(x => { const l = add(swing, new THREE.BoxGeometry(0.1, 2.3, 0.1), toon('#ff9ec4'), x, 1.15, 0, '#a8507a', 0.02); l.rotation.z = x * 0.12; });
  add(swing, new THREE.BoxGeometry(2.0, 0.1, 0.1), toon('#ff9ec4'), 0, 2.3, 0, '#a8507a', 0.02);
  const seat = new THREE.Group(); seat.position.set(0, 2.3, 0); swing.add(seat);
  [-0.3, 0.3].forEach(x => add(seat, new THREE.CylinderGeometry(0.012, 0.012, 1.5, 4), toon('#6a4a5a'), x, -0.75, 0, null));
  add(seat, new THREE.BoxGeometry(0.8, 0.07, 0.3), toon('#ffd36e'), 0, -1.5, 0, '#a8742e', 0.02);
  kit.hotspot({ id: 'swing', label: 'Xích đu', at: [3.8, 2.9, -2.2], stand: [3.8, -0.8], act: () => c.playToy('swing') }, swing);

  // bập bênh
  const see = new THREE.Group(); see.position.set(1.0, 0, 2.4); g.add(see);
  add(see, new THREE.ConeGeometry(0.28, 0.5, 4), toon('#9fd8ff'), 0, 0.25, 0, '#4a7a9a', 0.02);
  const plank = add(see, new THREE.BoxGeometry(2.6, 0.1, 0.4), toon('#ffb347'), 0, 0.55, 0, '#a8742e', 0.02);
  kit.hotspot({ id: 'seesaw', label: 'Bập bênh', at: [1.0, 1.6, 2.4], stand: [1.0, 1.4], act: () => c.playToy('seesaw') }, see);

  // vườn hoa, cây, bóng
  const bed = new THREE.Group(); bed.position.set(-1.2, 0, -3.8); g.add(bed);
  add(bed, new THREE.BoxGeometry(2.4, 0.2, 0.7), toon('#b98a5e'), 0, 0.1, 0, '#6a4a3a', 0.02);
  for (let i = 0; i < 8; i++) { const col = ['#ff9ec4', '#ffd36e', '#c9a6ff', '#ff8f6a'][i % 4]; add(bed, new THREE.SphereGeometry(0.1, 8, 6), toon(col), -1.0 + i * 0.28, 0.32 + (i % 2) * 0.05, 0, '#6a4a5a', 0.01); add(bed, new THREE.CylinderGeometry(0.015, 0.015, 0.25, 4), toon('#3f8a55'), -1.0 + i * 0.28, 0.2, 0, null); }
  const tree = (x, z, s = 1) => { const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); g.add(t); add(t, new THREE.CylinderGeometry(0.16, 0.24, 1.2, 10), toon('#b98a5e'), 0, 0.6, 0, '#6a4a3a', 0.02); add(t, new THREE.SphereGeometry(1.0, 14, 12), toon('#7edb72'), 0, 1.8, 0, '#3f8a55', 0.03); add(t, new THREE.SphereGeometry(0.65, 12, 10), toon('#92e386'), 0.4, 2.3, 0.1, '#3f8a55', 0.03); };
  tree(7.4, -3.4, 1.1); tree(-7.8, 0.8); tree(7.6, 2.2, 0.9); tree(-7.2, -4, 0.9);
  kit.bench(g, -5.6, 2.8, 0.2);
  const ball = add(g, new THREE.SphereGeometry(0.28, 14, 10), toon('#ff6a8a'), -1.4, 0.28, 1.8, '#a83a4a', 0.02);
  add(ball, new THREE.TorusGeometry(0.28, 0.025, 6, 20), toon('#ffffff'), 0, 0, 0, null);
  kit.hotspot({ id: 'ball', label: 'Bóng chung', at: [-1.4, 1.1, 1.8], stand: [-0.7, 2.2], act: () => { c.say('Đá bóng nào! Ai chơi cùng không?', 2600); c.startAction('hop'); } }, ball);

  return {
    group: g,
    enter() { kit.show(true); shared.enter(); setTimeout(() => { if (c.getArea() === 'park') c.say('Công viên rộng ghê! Mình chạy thử nha.', 2800); }, 900); },
    leave() { kit.show(false); shared.leave(); },
    update(dt, now) {
      kit.tick(now); const t = now / 1000;
      seat.rotation.z = Math.sin(t * 1.6) * 0.18; plank.rotation.z = Math.sin(t * 1.2) * 0.12;
      ducks.forEach(({ d, ph, x, z }) => { d.position.x = x + Math.sin(t * 0.5 + ph) * 0.5; d.position.z = z + Math.cos(t * 0.4 + ph) * 0.3; d.position.y = 0.1 + Math.sin(t * 2 + ph) * 0.015; d.rotation.y = Math.cos(t * 0.5 + ph); });
      shared.update(dt, now);
    },
    tap: e => shared.tap(e) || kit.tap(e), sync() {},
  };
}
