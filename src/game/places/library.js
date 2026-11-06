// Thư viện "Sách Mây": kệ sổ loài, bàn nhật ký, khung gia phả, bảng tin cập nhật, bàn thủ thư AI (sắp có).
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
  add(dex, new THREE.BoxGeometry(2.0, 3.0, 0.5), toon('#c29a62'), 0, 1.5, 0, '#6a4a3a', 0.03);
  [0.4, 1.2, 2.0].forEach(y => { add(dex, new THREE.BoxGeometry(1.8, 0.07, 0.46), toon('#e7c690'), 0, y, 0.04, null); books(dex, 1.8, y + 0.04, 0.06, 9); });
  kit.hotspot({ id: 'dex', label: 'Sổ loài', at: [-2.0, 3.3, -2.8], stand: [-1.8, -1.0], act: () => c.open.dex() }, dex);

  // bàn nhật ký (phải)
  const desk = new THREE.Group(); desk.position.set(1.9, 0, -2.5); g.add(desk);
  add(desk, new THREE.BoxGeometry(2.0, 0.9, 0.9), toon('#e7c690'), 0, 0.45, 0, '#6a4a3a', 0.03);
  add(desk, new THREE.BoxGeometry(0.7, 0.07, 0.5), toon('#ffffff'), -0.3, 0.95, 0.05, '#bbb', 0.02).rotation.y = 0.2;
  add(desk, new THREE.CylinderGeometry(0.2, 0.2, 0.3, 14), toon('#ffd36e'), 0.6, 1.1, 0, '#a8742e', 0.02);
  kit.npc({ x: 1.9, z: -3.15, color: '#e0d4ff', hat: 'librarian' });
  kit.hotspot({ id: 'diary', label: 'Nhật ký', at: [1.9, 2.1, -2.5], stand: [1.9, -1.25], act: () => document.getElementById('btn-diary').click() }, desk);

  // khung gia phả (giữa tường)
  const frame = new THREE.Group(); frame.position.set(0, 2.3, -3.45); g.add(frame);
  add(frame, new THREE.BoxGeometry(1.5, 1.1, 0.1), toon('#b98a5e'), 0, 0, 0, '#6a4a3a', 0.03);
  add(frame, new THREE.BoxGeometry(1.3, 0.9, 0.05), toon('#fff7ef'), 0, 0, 0.07, null);
  [[0, 0.25], [-0.3, -0.12], [0.3, -0.12]].forEach(([x, y]) => add(frame, new THREE.SphereGeometry(0.1, 10, 8), toon('#ffb3c9'), x, y, 0.12, '#a8507a', 0.02));
  add(frame, new THREE.BoxGeometry(0.02, 0.2, 0.02), toon('#a8507a'), -0.15, 0.1, 0.1, null).rotation.z = 0.6; add(frame, new THREE.BoxGeometry(0.02, 0.2, 0.02), toon('#a8507a'), 0.15, 0.1, 0.1, null).rotation.z = -0.6;
  kit.hotspot({ id: 'family', label: 'Gia phả', at: [0, 3.1, -3.2], stand: [0, -1.3], act: () => c.open.family() }, frame);

  // bảng tin cập nhật (phải, sát tường) và bàn thủ thư AI (trái, sắp có)
  const news = kit.sign('Tin mới', 1.3, 0.85, '#e0f4ff', '#3a5a8a', 38); news.position.set(3.1, 1.9, -1.2); news.rotation.y = -0.9; g.add(news);
  kit.hotspot({ id: 'news', label: 'Bảng tin', at: [3.0, 2.5, -1.2], stand: [2.6, -0.6], act: () => c.open.news() }, news);
  const ai = new THREE.Group(); ai.position.set(-3.0, 0, -0.6); ai.rotation.y = 0.8; g.add(ai);
  add(ai, new THREE.BoxGeometry(1.2, 0.8, 0.7), toon('#cdbdf5'), 0, 0.4, 0, '#6a4aa8', 0.03);
  add(ai, new THREE.SphereGeometry(0.22, 12, 10), toon('#ffffff'), 0, 1.0, 0, '#6a4aa8', 0.02);
  kit.hotspot({ id: 'ai', label: 'Thủ thư (sắp có)', at: [-3.0, 1.7, -0.6], stand: [-2.2, -0.2], act: () => c.open.ai() }, ai);
  kit.plant(g, 3.8, 1.9, 0.9);

  return {
    group: g,
    enter() { kit.show(true); setTimeout(() => { if (c.getArea() === 'library') c.say('Suỵt… Sổ loài ở kệ bên trái nha.', 3000); }, 700); },
    leave() { kit.show(false); }, update(dt, now) { kit.tick(now); }, tap: e => kit.tap(e), sync() {},
  };
}
