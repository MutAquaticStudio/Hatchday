// Công viên "Cỏ Non" (~40×28, rộng, camera bám thú): nơi chung (shared.js). Khu lõi: đồng cỏ, lối đi vòng, cây lớn, vườn hoa, khăn dã ngoại, bóng chung.
// Khu tây: ao có cầu và vịt (cho vịt ăn). Khu đông: sân chơi (xích đu, bập bênh, cầu trượt, hố cát). Khu bắc: lùm cây và vòm nghỉ chân. Cổng về Quảng trường ở mép tây.
// Đồ chơi dùng play_toy (ducks, swing, seesaw, slide). Chi tiết dựng/ẩn theo khu: xem world.js.
import { makeKit } from './kit.js';
import { makeShared } from './shared.js';
import { makeFireflies, makeProps, makeWorld } from './world.js';

export function initPark(c) {
  const { THREE, add, toon, canvasTex, scene } = c, kit = makeKit(c, { cull: true });
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const world = makeWorld(c, g), props = makeProps({ THREE, add, toon, canvasTex, kit, world });
  const shared = makeShared(c, { placeId: 'park', group: g });
  const grass = canvasTex(128, 128, d => { d.fillStyle = '#b6e89a'; d.fillRect(0, 0, 128, 128); d.fillStyle = '#9ed97e'; for (let i = 0; i < 50; i++) d.fillRect((i * 41) % 128, (i * 59) % 128, 3, 7); d.fillStyle = '#fff6b0'; for (let i = 0; i < 6; i++) d.fillRect((i * 67) % 128, (i * 43) % 128, 3, 3); }, [14, 10]);
  const pathTex = canvasTex(64, 64, d => { d.fillStyle = '#f3e3c3'; d.fillRect(0, 0, 64, 64); d.fillStyle = '#e4cfa6'; for (let i = 0; i < 14; i++) d.fillRect((i * 23) % 64, (i * 37) % 64, 4, 3); }, [10, 1]);
  const dens = world.density();
  const fireflies = makeFireflies(THREE, g, { x0: -16, x1: 16, z0: -6, z1: 8 }, Math.round(20 * dens));
  let seats = [], plank = null, ducks = [], pondMat = null, butterflies = [], slideBall = null;

  world.zone({ id: 'core', core: true, cx: 0, cz: 0, build(z) {
    add(z, new THREE.BoxGeometry(46, 0.4, 32), toon('#ffffff', grass), 0, -0.2, 0, '#6aa05a', 0.03);
    // lối đi vòng quanh đồng cỏ
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.2, 6.4, 48), new THREE.MeshToonMaterial({ color: '#f3e3c3', gradientMap: c.grad })); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.03, 0.8); ring.scale.y = 0.8; z.add(ring);
    add(z, new THREE.BoxGeometry(34, 0.08, 1.6), toon('#ffffff', pathTex), 0, 0.03, 6.8, null);
    // cây lớn giữa đồng cỏ
    props.trees(z, [{ x: 0, z: -1.5, s: 1.9 }, { x: -3.4, z: -3.4, s: 1.2 }, { x: 3.6, z: -3.2, s: 1.1 }]);
    kit.bench(z, -2.6, 2.6, 0.3); kit.bench(z, 2.6, 2.6, -0.3);
    // vườn hoa
    const bed = new THREE.Group(); bed.position.set(-1.2, 0, -5.0); z.add(bed);
    add(bed, new THREE.BoxGeometry(3.6, 0.2, 0.9), toon('#b98a5e'), 0, 0.1, 0, '#6a4a3a', 0.02);
    const fl = []; for (let i = 0; i < Math.round(18 * dens); i++) fl.push({ x: -1.2 - 1.6 + (i % 9) * 0.4, z: -5.0 + (i < 9 ? -0.15 : 0.15) }); props.flowers(z, fl);
    // khăn dã ngoại + giỏ
    const pic = new THREE.Group(); pic.position.set(2.2, 0, 4.0); z.add(pic);
    add(pic, new THREE.BoxGeometry(2.0, 0.04, 1.5), toon('#ff9ec4'), 0, 0.04, 0, '#a8507a', 0.02);
    add(pic, new THREE.BoxGeometry(0.7, 0.4, 0.5), toon('#d9b27a'), 0.4, 0.25, 0, '#8a5f3a', 0.02); add(pic, new THREE.SphereGeometry(0.16, 10, 8), toon('#ff6a6a'), -0.5, 0.18, 0.2, '#a83a3a', 0.02);
    // bóng chung
    const ball = add(z, new THREE.SphereGeometry(0.28, 14, 10), toon('#ff6a8a'), -1.4, 0.28, 1.8, '#a83a4a', 0.02);
    add(ball, new THREE.TorusGeometry(0.28, 0.025, 6, 20), toon('#ffffff'), 0, 0, 0, null);
    kit.hotspot({ id: 'ball', label: 'Bóng chung', at: [-1.4, 1.1, 1.8], stand: [-0.7, 2.2], act: () => { c.say('Đá bóng nào! Ai chơi cùng không?', 2600); c.startAction('hop'); } }, ball);
    props.lamp(z, -5, 5.2); props.lamp(z, 5, 5.2);
    // cổng về Quảng trường (mép tây) + bướm
    const gate = new THREE.Group(); gate.position.set(-17.5, 0, 4.5); gate.rotation.y = Math.PI / 2; z.add(gate);
    [-1.6, 1.6].forEach(x => add(gate, new THREE.BoxGeometry(0.4, 2.8, 0.4), toon('#d9b27a'), x, 1.4, 0, '#8a5f3a', 0.03));
    add(gate, new THREE.BoxGeometry(4.0, 0.5, 0.5), toon('#ffb3c9'), 0, 3.0, 0, '#a8507a', 0.03);
    const sg = kit.sign('← Quảng trường', 2.4, 0.5, '#fff0f6', '#8a3a5a', 30); sg.position.set(0, 3.0, 0.28); gate.add(sg);
    kit.hotspot({ id: 'go-plaza', label: 'Quảng trường', at: [-17.5, 3.9, 4.5], stand: [-15.5, 4.5], act: () => c.goTo('plaza') }, gate);
    butterflies = Array.from({ length: Math.round(6 * dens) }, (_, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshBasicMaterial({ color: ['#ff9ec4', '#ffd36e', '#c9a6ff'][i % 3], side: THREE.DoubleSide })); m.userData = { ph: i * 1.3, cx: -8 + i * 3, cz: -2 + (i % 3) * 2 }; z.add(m); return m; });
    props.hills(z, -17, [-15, -5, 6, 16]); props.hills(z, 17, [-12, 4, 15]);
    z.userData.clouds = [props.cloud(z, -10, 9, -13, 1.5), props.cloud(z, 10, 10.5, -15, 1.9)];
  } });

  // ao + cầu + vịt (tây)
  world.zone({ id: 'pond', cx: -12, cz: -2, show: 19, build(z) {
    return [
      () => {
        const pond = new THREE.Group(); pond.position.set(-12, 0, -2.4); z.add(pond);
        pondMat = toon('#8ed6ff'); const wtr = add(pond, new THREE.CylinderGeometry(3.4, 3.4, 0.06, 40), pondMat, 0, 0.03, 0, '#4a90c0', 0.03); wtr.scale.z = 0.7;
        const rim = add(pond, new THREE.TorusGeometry(3.4, 0.14, 8, 40), toon('#d9d2c4'), 0, 0.07, 0, '#8a8478', 0.02); rim.rotation.x = Math.PI / 2; rim.scale.y = 0.7;
        // cầu gỗ bắc qua ao
        const br = new THREE.Group(); br.position.set(0, 0.28, 0); pond.add(br);
        add(br, new THREE.BoxGeometry(4.4, 0.14, 1.0), toon('#c29a62'), 0, 0.32, 0, '#8a5f3a', 0.02).rotation.z = 0;
        [-2.0, 2.0].forEach(x => { add(br, new THREE.BoxGeometry(0.12, 0.7, 0.12), toon('#a8744a'), x, 0.3, 0.45, '#5a3a22', 0.015); add(br, new THREE.BoxGeometry(0.12, 0.7, 0.12), toon('#a8744a'), x, 0.3, -0.45, '#5a3a22', 0.015); });
        add(br, new THREE.BoxGeometry(4.2, 0.07, 0.06), toon('#a8744a'), 0, 0.62, 0.45, '#5a3a22', 0.01); add(br, new THREE.BoxGeometry(4.2, 0.07, 0.06), toon('#a8744a'), 0, 0.62, -0.45, '#5a3a22', 0.01);
        ducks = [[-1.6, 0.5], [1.4, -0.6], [0.2, 1.0]].map(([x, zz], i) => { const d = new THREE.Group(); d.position.set(x, 0.1, zz); pond.add(d); add(d, new THREE.SphereGeometry(0.22, 12, 10), toon('#fff3a0'), 0, 0.16, 0, '#c9a84a', 0.02); add(d, new THREE.SphereGeometry(0.14, 10, 8), toon('#fff3a0'), 0.18, 0.34, 0, '#c9a84a', 0.02); add(d, new THREE.ConeGeometry(0.05, 0.12, 6), toon('#ff9f3a'), 0.34, 0.33, 0, null).rotation.z = -Math.PI / 2; return { d, ph: i * 2, x, z: zz }; });
        kit.hotspot({ id: 'duck', label: 'Cho vịt ăn', at: [-12, 1.9, -2.4], stand: [-8.4, -0.6], act: () => { c.spawn('sparkle', 4, 0.8); c.playToy('ducks'); } }, pond);
      },
      () => { const rocks = []; for (let i = 0; i < Math.round(10 * dens); i++) { const a = i * 0.63; rocks.push({ x: -12 + Math.cos(a) * 3.9, z: -2.4 + Math.sin(a) * 2.8, y: 0.12, s: 0.18 + (i % 3) * 0.08, color: '#c9c2b4' }); } world.scatter(z, world.geo('rock', () => new THREE.DodecahedronGeometry(1, 0)), world.toonC('#ffffff'), rocks, '#7a7468', 0.02); },
      () => props.trees(z, [{ x: -17, z: -6, s: 1.3 }, { x: -16.5, z: 0.5, s: 1.1 }, { x: -9, z: -7.2, s: 1.15 }].slice(0, Math.round(3 * dens) || 2)),
      () => { const p = []; for (let i = 0; i < Math.round(26 * dens); i++) p.push({ x: -17 + (i % 13) * 0.55, z: 2 + Math.floor(i / 13) * 0.6 }); props.flowers(z, p); },
      () => { props.fence(z, -20.5, -9, -20.5, 8, 0.8); props.fence(z, -20, -9.4, -4, -9.4, 0.8, true); },
    ];
  } });

  // sân chơi (đông)
  world.zone({ id: 'play', cx: 12, cz: -1, show: 19, build(z) {
    return [
      () => { // xích đu đôi
        const swing = new THREE.Group(); swing.position.set(10, 0, -3.2); z.add(swing);
        [-1.5, 1.5].forEach(x => { const l = add(swing, new THREE.BoxGeometry(0.12, 2.5, 0.12), toon('#ff9ec4'), x, 1.25, 0, '#a8507a', 0.02); l.rotation.z = x * 0.08; });
        add(swing, new THREE.BoxGeometry(3.4, 0.12, 0.12), toon('#ff9ec4'), 0, 2.5, 0, '#a8507a', 0.02);
        seats = [-0.6, 0.6].map(x => { const s = new THREE.Group(); s.position.set(x, 2.5, 0); swing.add(s); [-0.3, 0.3].forEach(dx => add(s, new THREE.CylinderGeometry(0.012, 0.012, 1.6, 4), toon('#6a4a5a'), dx, -0.8, 0, null)); add(s, new THREE.BoxGeometry(0.8, 0.07, 0.3), toon('#ffd36e'), 0, -1.6, 0, '#a8742e', 0.02); return s; });
        kit.hotspot({ id: 'swing', label: 'Xích đu', at: [10, 3.1, -3.2], stand: [10, -0.8], act: () => c.playToy('swing') }, swing);
      },
      () => { // bập bênh
        const see = new THREE.Group(); see.position.set(14.5, 0, 1.4); z.add(see);
        add(see, new THREE.ConeGeometry(0.3, 0.55, 4), toon('#9fd8ff'), 0, 0.27, 0, '#4a7a9a', 0.02);
        plank = add(see, new THREE.BoxGeometry(2.8, 0.1, 0.42), toon('#ffb347'), 0, 0.58, 0, '#a8742e', 0.02);
        kit.hotspot({ id: 'seesaw', label: 'Bập bênh', at: [14.5, 1.7, 1.4], stand: [14.5, 3.0], act: () => c.playToy('seesaw') }, see);
      },
      () => { // cầu trượt
        const sl = new THREE.Group(); sl.position.set(15.5, 0, -3.6); z.add(sl);
        add(sl, new THREE.BoxGeometry(1.2, 0.12, 1.2), toon('#ffd36e'), 0, 1.9, 0, '#a8742e', 0.02);
        [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].forEach(([x, zz]) => add(sl, new THREE.BoxGeometry(0.1, 1.9, 0.1), toon('#ff7a8a'), x, 0.95, zz, '#a83a4a', 0.015));
        const ramp = add(sl, new THREE.BoxGeometry(0.9, 0.08, 2.6), toon('#6ab7ff'), 0, 0.95, 1.7, '#356a9a', 0.02); ramp.rotation.x = 0.62;
        const lad = add(sl, new THREE.BoxGeometry(0.7, 2.0, 0.08), toon('#ff7a8a'), 0, 0.95, -0.7, '#a83a4a', 0.015); lad.rotation.x = -0.15;
        slideBall = add(sl, new THREE.SphereGeometry(0.1, 8, 6), toon('#ffffff'), 0, 2.1, 0.2, null);
        kit.hotspot({ id: 'slide', label: 'Cầu trượt', at: [15.5, 3.2, -3.6], stand: [15.5, 0.2], act: () => c.playToy('slide') }, sl);
      },
      () => { // hố cát + xô
        const sb = new THREE.Group(); sb.position.set(10.5, 0, 3.8); z.add(sb);
        add(sb, new THREE.BoxGeometry(3.0, 0.25, 2.2), toon('#f1dcae'), 0, 0.12, 0, '#a8905a', 0.02);
        add(sb, new THREE.CylinderGeometry(0.22, 0.17, 0.3, 12), toon('#6ab7ff'), -0.7, 0.4, 0.2, '#356a9a', 0.02); add(sb, new THREE.ConeGeometry(0.2, 0.3, 4), toon('#ff7a8a'), 0.6, 0.38, -0.3, '#a83a4a', 0.02);
      },
      () => props.fence(z, 7, -6.2, 18.5, -6.2, 0.8), () => props.fence(z, 18.5, -6.2, 18.5, 6.2, 0.8), () => props.fence(z, 7, 6.2, 18.5, 6.2, 0.8),
      () => props.trees(z, [{ x: 20, z: -8, s: 1.3 }, { x: 19, z: 8.5, s: 1.1 }, { x: 8, z: -9, s: 1.2 }].slice(0, Math.round(3 * dens) || 2)),
      () => { props.lamp(z, 7.5, -5.2); props.lamp(z, 18, 5.2); kit.bench(z, 7.5, 3.0, Math.PI / 2); },
    ];
  } });

  // vòm nghỉ chân + lùm cây (bắc)
  world.zone({ id: 'grove', cx: 0, cz: -9, show: 19, build(z) {
    return [
      () => { const gz = new THREE.Group(); gz.position.set(5.5, 0, -8.5); z.add(gz); add(gz, new THREE.CylinderGeometry(2.0, 2.1, 0.2, 8), toon('#e8d3a8'), 0, 0.1, 0, '#8a7a5a', 0.02);
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(gz, new THREE.BoxGeometry(0.14, 2.5, 0.14), toon('#ffffff'), Math.cos(a) * 1.8, 1.35, Math.sin(a) * 1.8, '#aaa', 0.015); }
        add(gz, new THREE.ConeGeometry(2.4, 1.3, 8), toon('#ff9ec4'), 0, 3.2, 0, '#a8507a', 0.03); add(gz, new THREE.CylinderGeometry(0.6, 0.6, 0.12, 14), toon('#c29a62'), 0, 0.7, 0, '#8a5f3a', 0.02); add(gz, new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), toon('#a8744a'), 0, 0.4, 0, null); },
      () => props.trees(z, [{ x: -6, z: -8.5, s: 1.4 }, { x: -2, z: -9.5, s: 1.2 }, { x: 1.8, z: -8.8, s: 1.3 }, { x: 9.5, z: -9, s: 1.1 }, { x: -9.5, z: -9.2, s: 1.25 }].slice(0, Math.round(5 * dens) || 3)),
      () => { const t = []; for (let i = 0, n = Math.round(70 * dens); i < n; i++) t.push({ x: -16 + ((i * 47) % 320) / 10, z: -9 + ((i * 61) % 190) / 10 }); props.tufts(z, t); },
    ];
  } });

  return {
    group: g,
    enter() { kit.show(true); shared.enter(); setTimeout(() => { if (c.getArea() === 'park') c.say('Công viên rộng ghê! Mình chạy thử nha.', 2800); }, 900); },
    leave() { kit.show(false); shared.leave(); },
    update(dt, now) {
      kit.tick(now); const t = now / 1000, [px, pz] = c.getPetXZ(); world.update(px, pz);
      seats.forEach((s, i) => { s.rotation.z = Math.sin(t * 1.6 + i * 1.1) * 0.2; }); if (plank) plank.rotation.z = Math.sin(t * 1.2) * 0.14;
      ducks.forEach(({ d, ph, x, z }) => { d.position.x = x + Math.sin(t * 0.5 + ph) * 0.8; d.position.z = z + Math.cos(t * 0.4 + ph) * 0.4; d.position.y = 0.1 + Math.sin(t * 2 + ph) * 0.015; d.rotation.y = Math.cos(t * 0.5 + ph); });
      butterflies.forEach(m => { const u = m.userData; m.position.set(u.cx + Math.sin(t * 0.4 + u.ph) * 3, 0.9 + Math.sin(t * 1.3 + u.ph) * 0.3, u.cz + Math.cos(t * 0.35 + u.ph) * 2); m.rotation.set(-1.2, 0, Math.sin(t * 14 + u.ph) * 0.7); });
      if (slideBall) { const k = (t * 0.35) % 1; slideBall.position.set(0, 2.05 - k * 1.7, 0.2 + k * 2.4); slideBall.visible = k < 0.9; }
      if (pondMat) pondMat.color.setHSL(0.55, 0.9, 0.78 + Math.sin(t * 0.8) * 0.02);
      const night = c.isNight ? c.isNight() : false; props.night(night); fireflies(t, night);
      shared.update(dt, now);
    },
    tap: e => shared.tap(e) || kit.tap(e), sync() {}, world,
  };
}
