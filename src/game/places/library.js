// Thư viện "Sách Mây": kệ sổ loài, bàn nhật ký, khung gia phả, bảng tin cập nhật, bàn thủ thư AI (sắp có).
import { _t } from '../../i18n';
import { makeKit } from './kit.js';

export function initLibrary(c) {
  const { THREE, add, toon, canvasTex } = c, kit = makeKit(c);
  const floorTex = canvasTex(128, 128, g => { g.fillStyle = '#d9b27a'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#c29a62'; g.lineWidth = 3; for (let i = 0; i < 128; i += 32) { g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } }, [5, 5]);
  const wallTex = canvasTex(64, 64, g => { g.fillStyle = '#fff3dc'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#f6e2bd'; g.fillRect(0, 0, 8, 64); }, [8, 3]);
  const g = c.shell('#fff3dc', wallTex, '#d9b27a', floorTex, '#b98a5e');
  c.windowOn(g, 2.9, 3.0, d => { const gr = d.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#ffe9b8'); gr.addColorStop(1, '#fff7e0'); d.fillStyle = gr; d.fillRect(0, 0, 256, 192); d.fillStyle = '#ffd36e'; d.beginPath(); d.arc(190, 60, 26, 0, 7); d.fill(); });
  const bookCols = ['#ff9ec4', '#6ab7ff', '#ffd36e', '#7edb72', '#c9a6ff', '#ff8f6a'];
  const books = (parent, w, y, z, n) => { for (let i = 0; i < n; i++) add(parent, new THREE.BoxGeometry(0.16, 0.5 + (i % 3) * 0.08, 0.34), toon(bookCols[i % 6]), -w / 2 + 0.2 + i * (w - 0.3) / n, y + 0.26, z, '#6a4a5a', 0.02); };

  // kệ Sổ loài (trái)
  const dex = new THREE.Group(); dex.position.set(-2.0, 0, -3.1); g.add(dex);
  add(dex, new THREE.BoxGeometry(2.0, 3.0, 0.08), toon('#a8744a'), 0, 1.5, -0.22, '#6a4a3a', 0.03); // tấm lưng
  [-0.96, 0.96].forEach(x => add(dex, new THREE.BoxGeometry(0.1, 3.0, 0.52), toon('#c29a62'), x, 1.5, 0.02, '#6a4a3a', 0.02)); // hai vách
  [0.4, 1.2, 2.0].forEach(y => { add(dex, new THREE.BoxGeometry(1.8, 0.07, 0.46), toon('#e7c690'), 0, y, 0.04, null); books(dex, 1.8, y + 0.04, 0.06, 9); });
  add(dex, new THREE.BoxGeometry(2.2, 0.16, 0.6), toon('#a8744a'), 0, 3.06, 0.02, '#6a4a3a', 0.02); // gờ đỉnh kệ
  add(dex, new THREE.BoxGeometry(2.1, 0.2, 0.56), toon('#a8744a'), 0, 0.1, 0.02, null);
  add(dex, new THREE.SphereGeometry(0.2, 14, 10), toon('#7ec8ff'), 0.6, 3.38, 0, '#3a6a9a', 0.015); add(dex, new THREE.TorusGeometry(0.22, 0.02, 6, 16, Math.PI), toon('#ffd36e'), 0.6, 3.38, 0, null); add(dex, new THREE.CylinderGeometry(0.1, 0.12, 0.08, 10), toon('#ffd36e'), 0.6, 3.18, 0, null); // quả địa cầu
  [-0.6, -0.3].forEach((x, i) => add(dex, new THREE.BoxGeometry(0.2, 0.5, 0.36), toon(bookCols[i + 2]), x, 3.4, 0, '#6a4a5a', 0.015)); // sách trên nóc
  const lad = new THREE.Group(); lad.position.set(1.05, 0, 0.35); lad.rotation.x = -0.18; dex.add(lad); // thang gỗ
  [-0.2, 0.2].forEach(x => add(lad, new THREE.BoxGeometry(0.06, 2.8, 0.06), toon('#8a5f3a'), x, 1.4, 0, null)); for (let i = 0; i < 6; i++) add(lad, new THREE.BoxGeometry(0.4, 0.05, 0.05), toon('#a8744a'), 0, 0.3 + i * 0.45, 0, null);
  kit.hotspot({ id: 'dex', label: _t('Sổ loài'), at: [-2.0, 3.3, -2.8], stand: [-1.8, -1.0], act: () => c.open.dex() }, dex);

  // bàn nhật ký (phải)
  const desk = new THREE.Group(); desk.position.set(1.9, 0, -2.5); g.add(desk);
  add(desk, new THREE.BoxGeometry(2.0, 0.9, 0.9), toon('#e7c690'), 0, 0.45, 0, '#6a4a3a', 0.03);
  add(desk, new THREE.BoxGeometry(0.7, 0.07, 0.5), toon('#ffffff'), -0.3, 0.95, 0.05, '#bbb', 0.02).rotation.y = 0.2;
  add(desk, new THREE.CylinderGeometry(0.2, 0.2, 0.3, 14), toon('#ffd36e'), 0.6, 1.1, 0, '#a8742e', 0.02);
  [-0.6, 0, 0.6].forEach(x => { add(desk, new THREE.BoxGeometry(0.5, 0.26, 0.03), toon('#d9b27a'), x, 0.6, 0.46, null); add(desk, new THREE.SphereGeometry(0.035, 6, 5), toon('#ffd36e'), x, 0.6, 0.48, null); }); // ngăn kéo
  add(desk, new THREE.BoxGeometry(2.1, 0.08, 0.98), toon('#c29a62'), 0, 0.92, 0, null);
  add(desk, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), toon('#3a3a5a'), 0.12, 0.98, 0.15, null); const quill = add(desk, new THREE.ConeGeometry(0.04, 0.4, 5), toon('#ffffff'), 0.16, 1.14, 0.13, null); quill.rotation.z = -0.4; // lọ mực + bút lông
  [0, 1, 2].forEach(i => add(desk, new THREE.BoxGeometry(0.42, 0.08, 0.3), toon(bookCols[i + 3]), -0.75, 1.0 + i * 0.08, 0.05, '#6a4a5a', 0.008).rotation.y = i * 0.15); // chồng sách
  add(desk, new THREE.CylinderGeometry(0.12, 0.14, 0.04, 12), toon('#6a8a5a'), 0.85, 0.98, -0.2, null); add(desk, new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), toon('#6a8a5a'), 0.85, 1.22, -0.2, null); add(desk, new THREE.ConeGeometry(0.18, 0.2, 14, 1, true), toon('#7edb72'), 0.8, 1.45, -0.1, '#3f8a55', 0.01).rotation.z = 0.4; // đèn bàn
  kit.npc({ x: 0.5, z: -2.85, color: '#e0d4ff', hat: 'librarian', ry: 0.25, parent: g });
  kit.hotspot({ id: 'diary', label: _t('Nhật ký'), at: [1.9, 2.1, -2.5], stand: [1.9, -1.25], act: () => document.getElementById('btn-diary').click() }, desk);

  // khung gia phả (giữa tường)
  const frame = new THREE.Group(); frame.position.set(0, 2.3, -3.45); g.add(frame);
  add(frame, new THREE.BoxGeometry(1.5, 1.1, 0.1), toon('#b98a5e'), 0, 0, 0, '#6a4a3a', 0.03);
  add(frame, new THREE.BoxGeometry(1.3, 0.9, 0.05), toon('#fff7ef'), 0, 0, 0.07, null);
  [[0, 0.25], [-0.3, -0.12], [0.3, -0.12]].forEach(([x, y]) => add(frame, new THREE.SphereGeometry(0.1, 10, 8), toon('#ffb3c9'), x, y, 0.12, '#a8507a', 0.02));
  add(frame, new THREE.BoxGeometry(0.02, 0.2, 0.02), toon('#a8507a'), -0.15, 0.1, 0.1, null).rotation.z = 0.6; add(frame, new THREE.BoxGeometry(0.02, 0.2, 0.02), toon('#a8507a'), 0.15, 0.1, 0.1, null).rotation.z = -0.6;
  kit.hotspot({ id: 'family', label: _t('Gia phả'), at: [0, 3.1, -3.2], stand: [0, -1.3], act: () => c.open.family() }, frame);

  // bảng tin cập nhật (phải, sát tường) và bàn thủ thư AI (trái, sắp có)
  const news = kit.sign(_t('Tin mới'), 1.3, 0.85, '#e0f4ff', '#3a5a8a', 38); news.position.set(3.1, 1.9, -1.2); news.rotation.y = -0.9; g.add(news);
  kit.hotspot({ id: 'news', label: _t('Bảng tin'), at: [3.0, 2.5, -1.2], stand: [2.6, -0.6], act: () => c.open.news() }, news);
  const ai = new THREE.Group(); ai.position.set(-3.0, 0, -0.6); ai.rotation.y = 0.8; g.add(ai);
  add(ai, new THREE.BoxGeometry(1.2, 0.8, 0.7), toon('#cdbdf5'), 0, 0.4, 0, '#6a4aa8', 0.03);
  add(ai, new THREE.CylinderGeometry(0.2, 0.26, 0.1, 14), toon('#ffd36e'), 0, 0.85, 0, '#a8742e', 0.01);
  const orb = add(ai, new THREE.SphereGeometry(0.24, 16, 12), toon('#e9dcff'), 0, 1.1, 0, '#6a4aa8', 0.02); orb.material.transparent = true; orb.material.opacity = 0.85;
  add(ai, new THREE.OctahedronGeometry(0.08), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 0, 1.1, 0, null);
  add(ai, new THREE.BoxGeometry(1.24, 0.06, 0.74), toon('#ffffff'), 0, 0.81, 0, null);
  [-0.4, 0.4].forEach(x => add(ai, new THREE.OctahedronGeometry(0.06), toon('#ffd36e'), x, 0.5, 0.36, null));
  kit.hotspot({ id: 'ai', label: _t('Thủ thư (sắp có)'), at: [-3.0, 1.7, -0.6], stand: [-2.2, -0.2], act: () => c.open.ai() }, ai);
  kit.plant(g, 3.8, 1.9, 0.9);
  // giá vẽ "Đố vui" (mini-game)
  const easel = new THREE.Group(); easel.position.set(3.0, 0, 0.15); easel.rotation.y = -0.45; g.add(easel);
  [-0.35, 0.35].forEach(x => { const l = add(easel, new THREE.BoxGeometry(0.07, 1.7, 0.07), toon('#a8744a'), x, 0.82, 0, '#5a3a22', 0.01); l.rotation.z = x > 0 ? -0.08 : 0.08; });
  add(easel, new THREE.BoxGeometry(0.07, 1.5, 0.07), toon('#a8744a'), 0, 0.72, -0.35, null).rotation.x = 0.3;
  const qb = kit.sign(_t('Đố vui ?'), 0.95, 0.7, '#2f5a4a', '#ffffff', 40); qb.position.set(0, 1.2, 0.06); easel.add(qb);
  add(easel, new THREE.BoxGeometry(0.9, 0.06, 0.12), toon('#a8744a'), 0, 0.8, 0.06, null);
  kit.hotspot({ id: 'quiz', label: _t('Đố vui'), at: [3.0, 2.2, 0.15], stand: [2.4, 1.0], act: () => c.open.mini('quiz') }, easel);
  // trang trí: thảm tròn, đèn thả, đồng hồ, dây sao, gối ngồi đọc, chồng sách dưới sàn
  const rug = canvasTex(160, 96, d => { d.fillStyle = '#c9a6ff'; d.fillRect(0, 0, 160, 96); d.strokeStyle = '#fff3dc'; d.lineWidth = 5; d.strokeRect(8, 8, 144, 80); d.fillStyle = '#b48ef0'; for (let i = 0; i < 6; i++) d.fillRect(22 + i * 22, 40, 10, 16); });
  const rm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), toon('#ffffff', rug)); rm.rotation.x = -Math.PI / 2; rm.position.set(-2.4, 0.012, 1.7); rm.receiveShadow = true; g.add(rm); // thảm góc đọc sách
  [-1.2, 1.2].forEach(x => { add(g, new THREE.CylinderGeometry(0.01, 0.01, 1.2, 4), toon('#6a4a5a'), x, 4.2, -1.6, null); const sh = add(g, new THREE.ConeGeometry(0.34, 0.3, 16, 1, true), toon('#ffd36e'), x, 3.55, -1.6, '#a8742e', 0.012); sh.material.side = THREE.DoubleSide; sh.userData.noShadow = true; add(g, new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3c4' }), x, 3.45, -1.6, null); });
  const clock = canvasTex(64, 64, d => { d.fillStyle = '#fffdf5'; d.beginPath(); d.arc(32, 32, 30, 0, 7); d.fill(); d.strokeStyle = '#6a4a3a'; d.lineWidth = 3; d.beginPath(); d.moveTo(32, 32); d.lineTo(32, 12); d.moveTo(32, 32); d.lineTo(46, 36); d.stroke(); });
  add(g, new THREE.CylinderGeometry(0.36, 0.36, 0.08, 24), toon('#a8744a'), 1.3, 3.55, -3.45, '#6a4a3a', 0.015).rotation.x = Math.PI / 2;
  const cf = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ map: clock })); cf.position.set(1.3, 3.55, -3.4); g.add(cf);
  for (let i = 0; i < 9; i++) { const x = -3.9 + i * 0.5; add(g, new THREE.OctahedronGeometry(0.09), toon(['#ffd36e', '#ffffff', '#ff9ec4'][i % 3]), x, 4.05 - Math.sin(i / 8 * Math.PI) * 0.35, -3.42, null); }
  [[-2.9, 1.6, '#ff9ec4'], [-2.3, 2.2, '#7ec8ff']].forEach(([x, z, col]) => { const p = add(g, new THREE.SphereGeometry(0.42, 16, 10), toon(col), x, 0.2, z, '#6a4a5a', 0.02); p.scale.y = 0.45; add(g, new THREE.SphereGeometry(0.05, 8, 6), toon('#ffffff'), x, 0.39, z, null); }); // gối ngồi
  [0, 1, 2, 3].forEach(i => add(g, new THREE.BoxGeometry(0.5, 0.11, 0.36), toon(bookCols[i]), 3.1, 0.06 + i * 0.11, 1.4, '#6a4a5a', 0.008).rotation.y = i * 0.25); // chồng sách sàn
  add(g, new THREE.BoxGeometry(0.7, 0.3, 0.04), toon('#fff7ef'), -1.0, 3.5, -3.47, '#8a6a5a', 0.01); // biển "Suỵt"
  const hush = kit.sign(_t('Suỵt…'), 0.66, 0.26, '#fff7ef', '#7a5a4a', 28); hush.position.set(-1.0, 3.5, -3.43); g.add(hush);

  return {
    group: g,
    enter() { kit.show(true); setTimeout(() => { if (c.getArea() === 'library') c.say(_t('Suỵt… Sổ loài ở kệ bên trái nha.'), 3000); }, 700); },
    leave() { kit.show(false); }, update(dt, now) { kit.tick(now); }, tap: e => kit.tap(e), sync() {},
  };
}
