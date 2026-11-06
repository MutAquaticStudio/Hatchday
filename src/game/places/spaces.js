// Ba không gian của nhà, mở theo cấp Gắn bó: Ban công (3), Phòng chơi (5), Sân thượng (7). Mỗi nơi có đồ chơi riêng;
// chơi đồ chơi dùng hành động chơi có sẵn (c.play: kiểm bệnh, mệt, ghi lên máy chủ), nên luật cũ vẫn áp dụng.
import { makeKit } from './kit.js';

export function initBalcony(c) {
  const { THREE, add, toon, canvasTex, scene } = c, kit = makeKit(c);
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const sky = canvasTex(64, 64, d => { const gr = d.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#9fd8ff'); gr.addColorStop(1, '#ffe9c4'); d.fillStyle = gr; d.fillRect(0, 0, 64, 64); }, [1, 1]);
  add(g, new THREE.BoxGeometry(7, 0.4, 5), toon('#e8d0a8'), 0, -0.2, 0.2, '#9a7f5a', 0.03);
  add(g, new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: sky }), 0, 2.2, -3.2);
  add(g, new THREE.BoxGeometry(7, 0.08, 0.1), toon('#ffffff'), 0, 1.0, 2.6, '#aaa', 0.02);
  for (let i = -3; i <= 3; i++) add(g, new THREE.BoxGeometry(0.05, 1.0, 0.05), toon('#ffffff'), i, 0.5, 2.6, '#aaa', 0.01);
  [[-3.0, -1.2], [3.0, -1.2], [-3.1, 1.4]].forEach(([x, z]) => kit.plant(g, x, z, 1.1));
  const hammock = new THREE.Group(); hammock.position.set(-1.6, 0, -1.4); g.add(hammock);
  [-0.9, 0.9].forEach(x => add(hammock, new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), toon('#b98a5e'), x, 0.65, 0, '#6a4a3a', 0.02));
  const net = add(hammock, new THREE.CylinderGeometry(0.3, 0.3, 1.6, 12, 1, true), toon('#ffb3c9'), 0, 0.7, 0, '#a8507a', 0.02); net.rotation.z = Math.PI / 2; net.scale.set(1, 1, 0.8);
  kit.hotspot({ id: 'hammock', label: 'Võng', at: [-1.6, 1.9, -1.4], stand: [-1.6, -0.2], act: () => { c.setTemp('sleepy', 2600); c.say('Nằm võng mát quá… zzz', 2800); } }, hammock);
  const bub = new THREE.Group(); bub.position.set(1.8, 0, -1.2); g.add(bub);
  add(bub, new THREE.CylinderGeometry(0.4, 0.5, 0.9, 14), toon('#9fd8ff'), 0, 0.45, 0, '#4a7a9a', 0.03);
  add(bub, new THREE.TorusGeometry(0.28, 0.04, 8, 20), toon('#ff9ec4'), 0, 1.15, 0, '#a8507a', 0.02);
  const orbs = [0, 1, 2, 3, 4].map(i => add(g, new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshToonMaterial({ color: '#d8f2ff', transparent: true, opacity: 0.6, gradientMap: c.grad }), 1.8, 1.4, -1.2, null));
  kit.hotspot({ id: 'bubbles', label: 'Thổi bong bóng', at: [1.8, 1.9, -1.2], stand: [1.8, 0], act: () => { c.spawn('bubble', 6, 1.0); c.playToy('bubbles'); } }, bub);
  return {
    group: g, enter() { kit.show(true); }, leave() { kit.show(false); },
    update(dt, now) { kit.tick(now); const t = now / 1000; orbs.forEach((o, i) => { const ph = (t * 0.5 + i / 5) % 1; o.position.set(1.8 + Math.sin(t + i) * 0.4 + ph * 0.8, 1.4 + ph * 1.6, -1.2 + Math.cos(t * 0.7 + i) * 0.3); o.scale.setScalar(0.6 + ph * 0.8); }); },
    tap: e => kit.tap(e), sync() {},
  };
}

export function initPlayroom(c) {
  const { THREE, add, toon, canvasTex } = c, kit = makeKit(c);
  const floorTex = canvasTex(128, 128, d => { ['#ffd9e8', '#d9ecff', '#fff3c4', '#dff7e0'].forEach((col, i) => { d.fillStyle = col; d.fillRect((i % 2) * 64, Math.floor(i / 2) * 64, 64, 64); }); }, [5, 5]);
  const wallTex = canvasTex(64, 64, d => { d.fillStyle = '#fff0f6'; d.fillRect(0, 0, 64, 64); d.fillStyle = '#ffd0e0'; for (let i = 0; i < 4; i++) d.fillRect(i * 16, 0, 8, 64); }, [6, 2]);
  const g = c.shell('#fff0f6', wallTex, '#ffd9e8', floorTex, '#ff9ec4');
  const train = new THREE.Group(); train.position.set(-2.0, 0, 0.2); g.add(train);
  ['#ff6a6a', '#ffd36e', '#7edb72', '#6ab7ff'].forEach((col, i) => { const w = new THREE.Group(); w.position.set(i * 0.75, 0, 0); train.add(w); add(w, new THREE.BoxGeometry(0.62, 0.4, 0.42), toon(col), 0, 0.3, 0, '#6a4a5a', 0.02); [-0.2, 0.2].forEach(x => add(w, new THREE.CylinderGeometry(0.1, 0.1, 0.46, 10), toon('#3b2a3a'), x, 0.1, 0, null).rotation.x = Math.PI / 2); });
  kit.hotspot({ id: 'train', label: 'Tàu hoả', at: [-0.6, 1.2, 0.2], stand: [-0.6, 1.2], act: () => c.playToy('train') }, train);
  const pit = new THREE.Group(); pit.position.set(2.2, 0, -1.6); g.add(pit);
  add(pit, new THREE.BoxGeometry(2.0, 0.5, 1.4), toon('#9fd8ff'), 0, 0.25, 0, '#4a7a9a', 0.03);
  for (let i = 0; i < 14; i++) add(pit, new THREE.SphereGeometry(0.13, 8, 6), toon(['#ff6a6a', '#ffd36e', '#7edb72', '#c9a6ff'][i % 4]), -0.8 + (i % 7) * 0.27, 0.55, -0.3 + Math.floor(i / 7) * 0.5, null);
  kit.hotspot({ id: 'pit', label: 'Hồ bóng', at: [2.2, 1.3, -1.6], stand: [2.2, -0.2], act: () => { c.spawn('sparkle', 4); c.playToy('pit'); } }, pit);
  const blocks = new THREE.Group(); blocks.position.set(0.2, 0, -2.4); g.add(blocks);
  [[0, 0, '#ff9ec4'], [0.5, 0, '#ffd36e'], [0.25, 0.45, '#7edb72'], [0.25, 0.9, '#6ab7ff']].forEach(([x, y, col]) => add(blocks, new THREE.BoxGeometry(0.45, 0.45, 0.45), toon(col), x, 0.23 + y, 0, '#6a4a5a', 0.02));
  kit.hotspot({ id: 'blocks', label: 'Xếp hình', at: [0.45, 1.8, -2.4], stand: [0.4, -1.4], act: () => c.playToy('blocks') }, blocks);
  kit.plant(g, -3.4, -2.6, 0.9);
  return { group: g, enter() { kit.show(true); }, leave() { kit.show(false); }, update(dt, now) { kit.tick(now); }, tap: e => kit.tap(e), sync() {} };
}

export function initRooftop(c) {
  const { THREE, add, toon, canvasTex, scene } = c, kit = makeKit(c);
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  add(g, new THREE.BoxGeometry(9, 0.5, 6.5), toon('#cfd6e4'), 0, -0.25, 0.4, '#7a8296', 0.03);
  add(g, new THREE.BoxGeometry(9, 0.7, 0.18), toon('#b8c0d0'), 0, 0.35, 3.5, '#7a8296', 0.02);
  const tank = new THREE.Group(); tank.position.set(-3.4, 0, -2.2); g.add(tank);
  add(tank, new THREE.CylinderGeometry(0.7, 0.7, 1.3, 18), toon('#9fb8d0'), 0, 1.4, 0, '#566', 0.03); [-0.5, 0.5].forEach(x => add(tank, new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), toon('#7a8296'), x, 0.4, 0, null));
  const scope = new THREE.Group(); scope.position.set(2.8, 0, -1.4); g.add(scope);
  add(scope, new THREE.CylinderGeometry(0.04, 0.08, 1.1, 8), toon('#7a6a5a'), 0, 0.55, 0, '#443', 0.02);
  const tube = add(scope, new THREE.CylinderGeometry(0.12, 0.16, 1.1, 14), toon('#6ab7ff'), 0, 1.25, 0, '#356', 0.03); tube.rotation.z = -0.9;
  kit.hotspot({ id: 'scope', label: 'Kính thiên văn', at: [2.8, 2.3, -1.4], stand: [2.4, 0.2], act: () => { c.spawn('sparkle', 6, 1.0); c.playToy('scope'); } }, scope);
  const kite = new THREE.Group(); kite.position.set(-0.6, 3.2, -1.0); g.add(kite);
  const body = add(kite, new THREE.ConeGeometry(0.5, 0.9, 4), toon('#ff7a9a'), 0, 0, 0, '#a83a5a', 0.03); body.rotation.z = Math.PI;
  const tail = add(g, new THREE.CylinderGeometry(0.01, 0.01, 2.2, 4), toon('#ffd36e'), -0.6, 2.0, -0.2, null); tail.rotation.z = 0.2;
  const reel = new THREE.Group(); reel.position.set(-0.5, 0, 0.6); g.add(reel);
  add(reel, new THREE.CylinderGeometry(0.3, 0.3, 0.2, 14), toon('#ffd36e'), 0, 0.2, 0, '#a8742e', 0.03);
  kit.hotspot({ id: 'kite', label: 'Thả diều', at: [-0.5, 1.4, 0.6], stand: [-0.4, 1.6], act: () => c.playToy('kite') }, reel);
  kit.bench(g, 3.0, 2.2, Math.PI); kit.plant(g, -3.6, 2.4, 1.0);
  return {
    group: g, enter() { kit.show(true); }, leave() { kit.show(false); },
    update(dt, now) { kit.tick(now); const t = now / 1000; kite.position.set(-0.6 + Math.sin(t * 0.9) * 0.4, 3.2 + Math.sin(t * 1.3) * 0.2, -1.0); kite.rotation.z = Math.sin(t * 1.1) * 0.15; },
    tap: e => kit.tap(e), sync() {},
  };
}
