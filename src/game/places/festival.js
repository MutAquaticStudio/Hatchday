// Trang trí Quảng trường theo mùa (sự kiện plaza_decor): tet, trung-thu, giang-sinh, he.
export function festival(c, theme) {
  const { THREE, add, toon } = c, g = new THREE.Group();
  const lantern = (x, y, z, col) => { const l = new THREE.Group(); l.position.set(x, y, z); g.add(l); add(l, new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4), toon('#7a5a4a'), 0, 0.25, 0, null); const b = add(l, new THREE.SphereGeometry(0.2, 12, 10), toon(col), 0, 0, 0, '#a84a4a', 0.02); b.scale.y = 1.2; return l; };
  if (theme === 'trung-thu') { ['#ffd36e', '#ff8fb8', '#ff6a6a', '#9fd8ff', '#c9a6ff', '#7edb72'].forEach((col, i) => lantern(-5 + i * 2, 2.9 + (i % 2) * 0.3, -3.5, col)); [-3, 0, 3].forEach((x, i) => lantern(x, 2.6, 3.8, ['#ffd36e', '#ff8fb8', '#9fd8ff'][i])); }
  if (theme === 'tet') {
    [-6.2, 6.2].forEach(x => { const t = new THREE.Group(); t.position.set(x, 0, 1.2); g.add(t); add(t, new THREE.CylinderGeometry(0.1, 0.16, 1.4, 8), toon('#8a5f3a'), 0, 0.7, 0, '#4a3020', 0.02); for (let i = 0; i < 12; i++) add(t, new THREE.SphereGeometry(0.13, 8, 6), toon(i % 3 ? '#ff9ec4' : '#ffd0e0'), Math.cos(i) * 0.7, 1.5 + (i % 4) * 0.22, Math.sin(i * 1.7) * 0.5, null); });
    for (let i = 0; i < 6; i++) lantern(-5 + i * 2, 3.0, -3.4, '#ff3b3b');
  }
  if (theme === 'giang-sinh') {
    const t = new THREE.Group(); t.position.set(5.6, 0, 1.6); g.add(t);
    [[1.0, 0.7], [0.75, 1.3], [0.5, 1.8]].forEach(([r, y]) => add(t, new THREE.ConeGeometry(r, 0.9, 14), toon('#3f9a63'), 0, y, 0, '#2a6a43', 0.02));
    for (let i = 0; i < 12; i++) { const a = i * 2.4, h = 0.5 + (i / 12) * 1.5, r = 0.9 - (h - 0.5) * 0.4; add(t, new THREE.SphereGeometry(0.06, 6, 6), toon(['#ff6a6a', '#ffd36e', '#9fd8ff'][i % 3]), Math.cos(a) * r, h, Math.sin(a) * r, null); }
    add(t, new THREE.SphereGeometry(0.14, 8, 8), toon('#ffd36e'), 0, 2.3, 0, '#a8742e', 0.02);
  }
  if (theme === 'he') [[-5.2, 1.2, '#ff8fb8'], [5.2, 1.6, '#7ec8ff'], [-4.2, -2.6, '#ffd36e']].forEach(([x, z, col]) => { const u = new THREE.Group(); u.position.set(x, 0, z); g.add(u); add(u, new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), toon('#ffffff'), 0, 0.9, 0, '#999', 0.01); add(u, new THREE.ConeGeometry(1.0, 0.45, 16), toon(col), 0, 1.9, 0, '#7a5a6a', 0.02); });
  return g;
}
