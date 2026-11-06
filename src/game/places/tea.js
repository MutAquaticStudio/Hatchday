// Tiệm trà "Gió" (~13×10, nội thất đầy đủ): nơi chung (shared.js). Sàn gỗ, tường ốp gỗ, xà ngang, cửa sổ có rèm, quầy pha trà có kệ hũ và ấm đun hơi nước,
// bảng thực đơn viết tay, 4 bàn tròn bốn chỗ trên thảm, quầy ghế cao, góc cửa sổ có gối, mèo ngủ (chạm để vuốt), chậu cây treo, đèn thả và dây đèn.
import { makeKit } from './kit.js';
import { makeShared } from './shared.js';
import { makeWorld } from './world.js';

export function initTea(c) {
  const { THREE, add, toon, canvasTex, scene } = c, kit = makeKit(c);
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const world = makeWorld(c, g);
  const plank = canvasTex(128, 128, d => { d.fillStyle = '#d9ad74'; d.fillRect(0, 0, 128, 128); d.strokeStyle = '#b98f58'; d.lineWidth = 3; for (let i = 0; i < 128; i += 32) { d.beginPath(); d.moveTo(0, i); d.lineTo(128, i); d.stroke(); } d.strokeStyle = '#c79f66'; d.lineWidth = 1.5; for (let i = 0; i < 6; i++) { d.beginPath(); d.moveTo((i * 53) % 128, (i % 4) * 32); d.lineTo((i * 53) % 128, (i % 4) * 32 + 32); d.stroke(); } }, [7, 5]);
  const wallTex = canvasTex(64, 64, d => { d.fillStyle = '#fff0d6'; d.fillRect(0, 0, 64, 64); d.fillStyle = '#f7ddb4'; d.fillRect(0, 0, 6, 64); }, [10, 3]);
  const panel = canvasTex(64, 64, d => { d.fillStyle = '#b98a5e'; d.fillRect(0, 0, 64, 64); d.strokeStyle = '#9a6f45'; d.lineWidth = 3; d.strokeRect(5, 5, 54, 54); }, [10, 1]);
  const W = 13, D = 10;
  let steamBoost = 0, catAwake = 0;
  const ease = u => u * u * (3 - 2 * u), lerp = (a, b, k) => a + (b - a) * k;
  const arc = (a, b, k, h) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k) + Math.sin(k * Math.PI) * h, lerp(a[2], b[2], k)];
  // sàn, tường sau, tường trái, ốp gỗ, xà ngang
  add(g, new THREE.BoxGeometry(W, 0.4, D), toon('#ffffff', plank), 0, -0.2, 0, '#9a5f4a', 0.04);
  add(g, new THREE.BoxGeometry(W, 8.0, 0.3), toon('#ffffff', wallTex), 0, 3.8, -D / 2 - 0.15, '#8a7a9a', 0.04);
  const w2 = wallTex.clone(); w2.repeat.set(7, 3); w2.needsUpdate = true;
  add(g, new THREE.BoxGeometry(0.3, 8.0, D + 0.3), toon('#ffffff', w2), -W / 2 - 0.15, 3.8, 0, '#8a7a9a', 0.04);
  add(g, new THREE.BoxGeometry(W, 1.3, 0.12), toon('#ffffff', panel), 0, 0.65, -D / 2 + 0.06, '#7a5a3a', 0.02);
  add(g, new THREE.BoxGeometry(0.12, 1.3, D), toon('#ffffff', panel), -W / 2 + 0.06, 0.65, 0, '#7a5a3a', 0.02);
  for (let i = -2; i <= 2; i++) add(g, new THREE.BoxGeometry(0.22, 0.22, D), toon('#9a6f45'), i * 2.8, 4.4, 0, '#5a3a22', 0.02); // xà ngang
  const shared = makeShared(c, { placeId: 'tea', group: g });

  // cửa sổ lớn có rèm (tường sau, bên trái)
  const win = canvasTex(256, 192, d => { const gr = d.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#cdeaff'); gr.addColorStop(1, '#eaf7ff'); d.fillStyle = gr; d.fillRect(0, 0, 256, 192); d.fillStyle = '#7edb72'; d.beginPath(); d.arc(60, 175, 46, 0, 7); d.fill(); d.beginPath(); d.arc(190, 180, 54, 0, 7); d.fill(); d.fillStyle = '#fff'; d.beginPath(); d.arc(120, 50, 18, 0, 7); d.arc(145, 54, 22, 0, 7); d.fill(); });
  const wnd = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), new THREE.MeshBasicMaterial({ map: win })); wnd.position.set(-2.8, 2.9, -D / 2 + 0.02); g.add(wnd);
  [[-1.8, 1.0, 3.7], [0.2, 1.0, 3.7]].forEach(() => { });
  add(g, new THREE.BoxGeometry(3.8, 0.14, 0.18), toon('#fff7ef'), -2.8, 4.15, -D / 2 + 0.1, '#a8778e', 0.015); add(g, new THREE.BoxGeometry(3.8, 0.14, 0.18), toon('#fff7ef'), -2.8, 1.65, -D / 2 + 0.1, '#a8778e', 0.015);
  [-4.5, -1.1].forEach(x => add(g, new THREE.BoxGeometry(0.7, 2.7, 0.14), toon('#ff9ec4'), x, 2.9, -D / 2 + 0.14, '#a8507a', 0.015)); // rèm hai bên

  // quầy pha trà + kệ hũ + ấm
  const counter = new THREE.Group(); counter.position.set(-1.5, 0, -3.4); g.add(counter);
  add(counter, new THREE.BoxGeometry(4.8, 1.0, 1.0), toon('#c29a62'), 0, 0.5, 0, '#6a4a3a', 0.03);
  add(counter, new THREE.BoxGeometry(5.0, 0.1, 1.2), toon('#e7c690'), 0, 1.05, 0, '#6a4a3a', 0.02);
  [-1.6, -0.5, 0.6, 1.7].forEach((x, i) => add(counter, new THREE.CylinderGeometry(0.1, 0.07, 0.12, 12), toon('#ffffff'), x, 1.17, 0.2 + (i % 2) * 0.1, '#aaa', 0.015));
  const kettle = add(counter, new THREE.SphereGeometry(0.28, 14, 10), toon('#7ec8a0'), -1.9, 1.35, -0.1, '#3f7a60', 0.02); kettle.scale.y = 0.85;
  add(counter, new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), toon('#7ec8a0'), -1.9, 1.7, -0.1, '#3f7a60', 0.015); add(counter, new THREE.TorusGeometry(0.2, 0.03, 6, 14), toon('#7ec8a0'), -1.9, 1.62, -0.1, '#3f7a60', 0.01);
  const steam = [0, 1, 2, 3].map(i => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })); m.userData.i = i; counter.add(m); return m; });
  kit.npc({ x: -1.5, z: -4.2, color: '#d4f5e6', hat: 'chef' });
  // kệ hũ trà trên tường sau
  const shelf = new THREE.Group(); shelf.position.set(2.8, 0, -D / 2 + 0.3); g.add(shelf);
  const jars = []; [2.2, 3.1].forEach(y => { add(shelf, new THREE.BoxGeometry(3.2, 0.1, 0.5), toon('#a8744a'), 0, y, 0, '#5a3a22', 0.015); for (let i = 0; i < 6; i++) jars.push({ x: shelf.position.x - 1.35 + i * 0.54, y: y + 0.27, z: shelf.position.z, sy: 1 + (i % 2) * 0.2, color: ['#ff9ec4', '#ffd36e', '#9fd8ff', '#c9a6ff', '#7edb72', '#ffb347'][i] }); });
  world.scatter(g, new THREE.CylinderGeometry(0.16, 0.15, 0.4, 10), world.toonC('#ffffff'), jars, '#7a5a5a', 0.015);
  add(shelf, new THREE.BoxGeometry(0.1, 1.5, 0.5), toon('#a8744a'), -1.65, 2.65, 0, '#5a3a22', 0.015); add(shelf, new THREE.BoxGeometry(0.1, 1.5, 0.5), toon('#a8744a'), 1.65, 2.65, 0, '#5a3a22', 0.015);
  // bảng thực đơn viết tay
  const menu = canvasTex(256, 192, d => { d.fillStyle = '#3a4a42'; d.fillRect(0, 0, 256, 192); d.strokeStyle = '#b98a5e'; d.lineWidth = 10; d.strokeRect(5, 5, 246, 182); d.fillStyle = '#fff'; d.font = '800 24px "Baloo 2", system-ui'; d.textAlign = 'center'; d.fillText('Thực đơn hôm nay', 128, 40);
    d.font = '600 18px "Baloo 2", system-ui'; d.textAlign = 'left'; ['Trà gừng mật ong', 'Trà hoa cúc', 'Trà đào cam sả', 'Bánh dorayaki', 'Bánh bông lan trứng'].forEach((t, i) => d.fillText('· ' + t, 28, 76 + i * 26)); });
  const mb = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.65), new THREE.MeshBasicMaterial({ map: menu })); mb.position.set(5.0, 2.7, -D / 2 + 0.03); g.add(mb);
  kit.hotspot({ id: 'order', label: 'Gọi món', at: [-1.5, 2.6, -3.3], stand: [-1.5, -1.7], act: () => { steamBoost = 1; c.sfx('kettle'); c.say('Ấm trà sôi rồi kìa, thơm ghê!', 1800); c.open.shop('food'); } }, counter);
  // quầy ghế cao
  [-3.2, -1.5, 0.2].forEach(x => { const s = new THREE.Group(); s.position.set(x, 0, -2.3); g.add(s); add(s, new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14), toon(['#ff9ec4', '#9fd8ff', '#ffd36e'][Math.round((x + 3.2) / 1.7)]), 0, 0.85, 0, '#7a5a6a', 0.02); add(s, new THREE.CylinderGeometry(0.06, 0.1, 0.8, 8), toon('#8a6a4a'), 0, 0.4, 0, '#5a3a22', 0.015); });

  // thảm tròn + bốn bàn tròn bốn chỗ
  const rug = add(g, new THREE.CylinderGeometry(4.2, 4.2, 0.04, 40), toon('#f4b8c8'), 0.4, 0.02, 0.4, '#c9789a', 0.02); rug.scale.z = 0.62;
  const tables = [[-1.8, -0.2], [2.2, -0.9], [-2.6, 2.4], [2.6, 2.2]], chairs = [], legs = [];
  tables.forEach(([x, z], i) => {
    const t = new THREE.Group(); t.position.set(x, 0, z); g.add(t);
    add(t, new THREE.CylinderGeometry(0.66, 0.66, 0.08, 24), toon('#f6e0b8'), 0, 0.78, 0, '#8a5f3a', 0.03);
    add(t, new THREE.CylinderGeometry(0.08, 0.14, 0.76, 10), toon('#b98a5e'), 0, 0.38, 0, '#6a4a3a', 0.02);
    add(t, new THREE.CylinderGeometry(0.09, 0.07, 0.1, 12), toon('#ffffff'), 0.15, 0.87, 0.05, '#aaa', 0.015); add(t, new THREE.SphereGeometry(0.07, 8, 6), toon(['#ff9ec4', '#ffd36e', '#c9a6ff', '#7edb72'][i]), -0.2, 0.9, -0.1, null);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; chairs.push({ x: x + Math.cos(a) * 1.0, y: 0.42, z: z + Math.sin(a) * 1.0, color: ['#ff9ec4', '#9fd8ff', '#ffd36e', '#c9a6ff'][k] }); legs.push({ x: x + Math.cos(a) * 1.0, y: 0.2, z: z + Math.sin(a) * 1.0 }); }
    kit.hotspot({ id: 'table' + i, label: `Bàn ${i + 1}`, at: [x, 1.8, z], stand: [x, z + 1.2], act: () => sipTea(x, z, ['Trà thơm quá~', 'Ngồi đây thích ghê!', 'Mình nhâm nhi một chút nha.', 'Gió mát ghê!'][i]) }, t);
  });

  world.scatter(g, new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14), world.toonC('#ffffff'), chairs, '#7a5a6a', 0.02); world.scatter(g, new THREE.CylinderGeometry(0.07, 0.07, 0.4, 6), world.toonC('#8a6a4a'), legs, null);
  function sipTea(x, z, line) { // nhảy lên ghế cạnh bàn, nhấp trà vài ngụm (hơi nước bốc lên), rồi xuống
    const [fx, fz] = c.getPetXZ(), seat = [x - 0.39, 0.5, z + 0.92], out = [x, 0, z + 1.5]; let nextSip = 1.2;
    return c.script({ onStart: () => shared.sendAct('tea'), dur: 6.2, noWalk: true, update: (u, t) => {
      if (u < 0.1) return { pos: arc([fx, 0, fz], seat, ease(u / 0.1), 0.45), stretch: Math.sin(u / 0.1 * Math.PI) * 0.1 };
      if (u > 0.9) return { pos: arc(seat, out, ease((u - 0.9) / 0.1), 0.4) };
      if (t > nextSip) { nextSip = t + 1.5; steamBoost = Math.max(steamBoost, 0.6); if (t > 0.6) c.sfx('sip'); }
      const sip = Math.max(0, Math.sin((t - 0.6) * 4.2)) ** 2; // cúi xuống nhấp một ngụm
      return { pos: seat, stretch: -0.08 - sip * 0.06, roll: sip * 0.12 - 0.03, face: 0.25 };
    }, done: ok => { if (!ok) return; c.say(line, 2200); c.spawn('heart', 2); if (ok) c.activity('tea'); } });
  }
  function petTheCat() { // lại gần mèo, vuốt ve: mèo thức dậy, kêu rù rù, hiện tim
    const [fx, fz] = c.getPetXZ(), spot = [-4.7, 0, 3.2]; catAwake = 1; let purred = false;
    return c.script({ onStart: () => shared.sendAct('cat'), dur: 4.4, update: (u, t) => {
      if (!purred && u >= 0.25) { purred = true; c.sfx('purr'); }
      if (u < 0.2) return { pos: arc([fx, 0, fz], spot, ease(u / 0.2), 0.1), face: -Math.PI / 2 };
      if (Math.random() < 0.06) c.spawnAt('heart', -5.5, 1.6, 3.3, { vy: 0.7, scale: 0.34, max: 1 });
      return { pos: [spot[0] + Math.sin(t * 5) * 0.06, 0, spot[2]], stretch: Math.sin(t * 5) * 0.04, roll: Math.sin(t * 5) * 0.06, face: -Math.PI / 2 };
    }, done: ok => { if (!ok) return; c.say('Mèo mềm quá, rù rù~', 2200); if (ok) c.activity('cat'); } });
  }
  // góc cửa sổ trái: ghế dài có gối, mèo ngủ
  const nook = new THREE.Group(); nook.position.set(-5.6, 0, 2.2); g.add(nook);
  add(nook, new THREE.BoxGeometry(1.0, 0.5, 3.4), toon('#c29a62'), 0, 0.25, 0, '#6a4a3a', 0.025); add(nook, new THREE.BoxGeometry(1.0, 0.16, 3.4), toon('#ffd9e6'), 0, 0.55, 0, '#c9789a', 0.02);
  [[-1.1, '#ff9ec4'], [0, '#9fd8ff'], [1.1, '#ffd36e']].forEach(([zz, col]) => add(nook, new THREE.BoxGeometry(0.5, 0.3, 0.5), toon(col), 0, 0.78, zz, '#7a5a6a', 0.02));
  const cat = new THREE.Group(); cat.position.set(0.05, 0.9, 1.1); nook.add(cat);
  const catBody = add(cat, new THREE.SphereGeometry(0.36, 14, 10), toon('#ffcf9a'), 0, 0, 0, '#a8744a', 0.025); catBody.scale.set(1.2, 0.8, 0.9);
  add(cat, new THREE.SphereGeometry(0.22, 12, 10), toon('#ffcf9a'), 0, 0.12, 0.4, '#a8744a', 0.02);
  [-0.12, 0.12].forEach(x => add(cat, new THREE.ConeGeometry(0.07, 0.14, 4), toon('#ffcf9a'), x, 0.34, 0.4, '#a8744a', 0.015));
  const tail = add(cat, new THREE.CylinderGeometry(0.05, 0.04, 0.5, 8), toon('#ffb878'), 0, 0.05, -0.45, null); tail.rotation.x = Math.PI / 2;
  kit.hotspot({ id: 'cat', label: 'Mèo ngủ', at: [-5.6, 2.2, 3.3], stand: [-4.2, 3.0], act: () => { c.setTemp('love', 1600); petTheCat(); } }, cat);
  // chậu cây treo, đèn thả, dây đèn, đồng hồ
  [[-5.8, -3.6], [5.6, -3.6], [5.8, 1.6]].forEach(([x, z], i) => { const p = new THREE.Group(); p.position.set(x, 3.4, z); g.add(p); add(p, new THREE.CylinderGeometry(0.01, 0.01, 1.0, 4), toon('#7a5a4a'), 0, 0.5, 0, null); add(p, new THREE.CylinderGeometry(0.26, 0.2, 0.3, 12), toon('#e8a07a'), 0, 0, 0, '#9a5f4a', 0.02); for (let k = 0; k < 5; k++) add(p, new THREE.SphereGeometry(0.2, 8, 6), toon('#7edb72'), Math.cos(k * 1.3) * 0.25, -0.2 - k * 0.12 - (i % 2) * 0.1, Math.sin(k * 1.3) * 0.2, '#3f8a55', 0.015); });
  const pend = [[-1.8, -0.2], [2.2, -0.9], [-2.6, 2.4], [2.6, 2.2]].map(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 3.6, z); g.add(l); add(l, new THREE.CylinderGeometry(0.01, 0.01, 1.2, 4), toon('#7a5a4a'), 0, 0.6, 0, null); const b = add(l, new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffe9a8' }), 0, 0, 0, '#c9a050', 0.02); b.scale.y = 0.85; return b; });
  const bulbItems = []; for (let i = 0; i < 18; i++) { const t = i / 17; bulbItems.push({ x: -5.6 + t * 11.2, y: 4.1 - Math.sin(t * Math.PI) * 0.4, z: -D / 2 + 0.35, color: i % 2 ? '#fff3c4' : '#ffe08a' }); }
  world.scatter(g, new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbItems, null);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: '#fffdf5' })); clock.position.set(-0.4, 3.8, -D / 2 + 0.04); g.add(clock);
  add(g, new THREE.TorusGeometry(0.42, 0.04, 8, 24), toon('#7a5a3a'), -0.4, 3.8, -D / 2 + 0.05, null);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.02), new THREE.MeshBasicMaterial({ color: '#5a3a2a' })); hand.position.set(-0.4, 3.8, -D / 2 + 0.07); g.add(hand);
  kit.plant(g, 5.6, 3.6, 1.1); kit.plant(g, -5.5, -1.2, 0.9); kit.plant(g, 4.4, -3.6, 0.8);

  return {
    group: g,
    enter() { kit.show(true); shared.enter(); setTimeout(() => { if (c.getArea() === 'tea') c.say('Chạm vào một bàn để ngồi nhâm nhi nhé.', 3000); }, 900); },
    leave() { kit.show(false); shared.leave(); },
    update(dt, now) {
      kit.tick(now); const t = now / 1000;
      steamBoost = Math.max(0, steamBoost - dt * 0.5); catAwake = Math.max(0, catAwake - dt * 0.25);
      steam.forEach(m => { const ph = (t * (0.5 + steamBoost) + m.userData.i / 4) % 1; m.position.set(-1.9 + Math.sin(ph * 6 + m.userData.i) * 0.08, 1.75 + ph * (0.9 + steamBoost * 0.8), -0.1); m.material.opacity = (0.5 + steamBoost * 0.3) * (1 - ph); m.scale.setScalar((0.7 + ph) * (1 + steamBoost * 0.8)); });
      kettle.rotation.z = steamBoost > 0.3 ? Math.sin(t * 40) * 0.07 * steamBoost : 0;
      cat.scale.y = 1 + Math.sin(t * (1.4 + catAwake * 4)) * (0.03 + catAwake * 0.04); tail.rotation.z = Math.sin(t * (1.1 + catAwake * 5)) * (0.25 + catAwake * 0.3); cat.rotation.y = lerp(cat.rotation.y, catAwake > 0.2 ? 0.7 : 0, Math.min(1, dt * 3));
      hand.rotation.z = -t * 0.1; const glow = c.isNight && c.isNight() ? '#ffd36e' : '#ffe9a8'; pend.forEach((b, i) => { b.material.color.set(glow); b.position.y = Math.sin(t * 0.8 + i) * 0.015; });
      shared.update(dt, now);
    },
    tap: e => shared.tap(e) || kit.tap(e), sync() {},
  };
}
