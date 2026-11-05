// Lớp hiển thị & tương tác 3D (chuyển từ bản mẫu). Sẽ tách nhỏ và chuyển sang TypeScript dần.
import * as THREE from 'three';
import { S, save, act, actBatched, addTalkMemory, deleteMemory as delMem, renamePet, onSync, onSyncError, startPeriodicSync } from './store';
import { decayStats, writeDiary as writeDiaryRule, PALETTES } from './rules';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

/* ---------------- trạng thái: dữ liệu nằm ở store (đồng bộ server) ---------------- */
function decay(s, mins) { Object.assign(s, decayStats(s, mins)); s.t = Date.now(); }

/* ---------------- renderer ---------------- */
const canvas = $('c');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
catch (e) { document.getElementById('app').insertAdjacentHTML('beforeend', '<div id="err">Trình duyệt này chưa mở được WebGL nên không vẽ được căn phòng 3D.</div>'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.shadowMap.type = THREE.PCFShadowMap; // r182+: PCF mặc định đã mềm
/* Chất lượng hình ảnh: độ phân giải là ngân sách hiệu năng (skill threejs-scene-setup) */
const QUALITY = { thap: { pr: 1, shadow: 0 }, vua: { pr: 1.5, shadow: 1024 }, cao: { pr: 2, shadow: 2048 } };
let quality = 'vua';
try { const q = localStorage.getItem('hatchday-quality'); if (q && QUALITY[q]) quality = q; } catch (e) { /* bỏ qua */ }
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
const look = new THREE.Vector3(0, 1.15, 0);

/* toon */
const grad = new THREE.DataTexture(new Uint8Array([105, 180, 255]), 3, 1, THREE.RedFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
const toon = (color, map) => new THREE.MeshToonMaterial({ color, gradientMap: grad, map: map || null });
/* Viền sáng anime (rim light) cho thú: chèn vào shader toon, sau opaque_fragment */
const rimColor = { value: new THREE.Color('#fff4e8') }, rimStrength = { value: 0.5 };
function petToon(color) {
  const m = toon(color);
  m.onBeforeCompile = sh => {
    sh.uniforms.rimColor = rimColor; sh.uniforms.rimStrength = rimStrength;
    sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimStrength;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      '#include <opaque_fragment>\n  float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);\n  gl_FragColor.rgb += rimColor * smoothstep(0.6, 0.7, rimF) * rimStrength;');
  };
  m.customProgramCacheKey = () => 'pet-rim';
  return m;
}
const outlineMats = {};
function outline(mesh, color, t = 0.03) {
  mesh.geometry.computeBoundingSphere();
  const r = mesh.geometry.boundingSphere.radius;
  const m = outlineMats[color] || (outlineMats[color] = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  const o = new THREE.Mesh(mesh.geometry, m);
  o.scale.setScalar(1 + t / Math.max(r, 0.05));
  o.userData.outline = true;
  mesh.add(o);
  return mesh;
}
function add(parent, geo, mat, x = 0, y = 0, z = 0, oc = '#7a4a63', ot = 0.03) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m);
  if (oc) outline(m, oc, ot);
  return m;
}
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/* ---------------- phòng ---------------- */
const room = new THREE.Group(); scene.add(room);
const woodTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#efe2d6'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 64 + 60, w, 4);
  g.fillStyle = '#f4ebe2'; for (let i = 0; i < 4; i++) g.fillRect((i * 97) % w, i * 64, 4, 64);
}, [3, 3]);
add(room, new THREE.BoxGeometry(9, 0.4, 7), toon('#f6c99c', woodTex), 0, -0.2, 0, '#9a5f4a', 0.04);
const wallTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd8e7';
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.beginPath(); g.arc(32 + x * 64 + (y % 2) * 32, 32 + y * 64, 7, 0, Math.PI * 2); g.fill(); }
}, [6, 3]);
add(room, new THREE.BoxGeometry(9, 5, 0.3), toon('#fff0f5', wallTex), 0, 2.3, -3.65, '#b77b95', 0.04);
const wallTex2 = wallTex.clone(); wallTex2.repeat.set(4, 3); wallTex2.needsUpdate = true;
add(room, new THREE.BoxGeometry(0.3, 5, 7.3), toon('#fff0f5', wallTex2), -4.65, 2.3, 0, '#b77b95', 0.04);
add(room, new THREE.BoxGeometry(9, 0.35, 0.36), toon('#ffb3cd'), 0, 0.17, -3.45, '#b77b95');

/* cửa sổ */
const winCanvas = document.createElement('canvas'); winCanvas.width = 256; winCanvas.height = 192;
const winTex = new THREE.CanvasTexture(winCanvas); winTex.colorSpace = THREE.SRGBColorSpace;
const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), new THREE.MeshBasicMaterial({ map: winTex }));
win.position.set(1.7, 2.9, -3.48); room.add(win);
const frameM = toon('#fff7ef');
[[1.7, 3.85, 2.7, 0.14], [1.7, 1.95, 2.7, 0.14]].forEach(([x, y, w, h]) => add(room, new THREE.BoxGeometry(w, h, 0.16), frameM, x, y, -3.45, '#a8778e'));
[[0.4, 2.9], [3.0, 2.9], [1.7, 2.9]].forEach(([x, y], i) => add(room, new THREE.BoxGeometry(i === 2 ? 0.08 : 0.14, 1.9, 0.16), frameM, x, y, -3.45, '#a8778e'));
add(room, new THREE.BoxGeometry(2.9, 0.12, 0.42), toon('#ffd9a8'), 1.7, 1.86, -3.3, '#a8778e');

/* dây đèn */
const bulbs = [];
for (let i = 0; i < 9; i++) {
  const x = -3.6 + i * 0.62, y = 4.25 - Math.sin(i / 8 * Math.PI) * 0.35;
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: ['#ffd36e', '#ff9ec4', '#9fe0ff'][i % 3] }));
  b.position.set(x, y, -3.42); room.add(b); bulbs.push(b);
}

/* thảm */
add(room, new THREE.CylinderGeometry(2.2, 2.2, 0.06, 56), toon('#bfe3ff'), 0, 0.03, 0.2, '#6f8fb8', 0.02);
add(room, new THREE.CylinderGeometry(1.6, 1.6, 0.065, 56), toon('#dff1ff'), 0, 0.035, 0.2, null);

/* ổ ngủ */
const bed = new THREE.Group(); bed.position.set(-2.9, 0, -1.9); room.add(bed);
const torus = add(bed, new THREE.TorusGeometry(0.75, 0.3, 16, 40), toon('#ffd36e'), 0, 0.3, 0, '#a8742e');
torus.rotation.x = -Math.PI / 2;
add(bed, new THREE.CylinderGeometry(0.75, 0.75, 0.16, 32), toon('#fff1c4'), 0, 0.12, 0, null);

/* chậu cây */
const plant = new THREE.Group(); plant.position.set(3.4, 0, -2.5); room.add(plant);
add(plant, new THREE.CylinderGeometry(0.42, 0.32, 0.7, 20), toon('#ff9a7a'), 0, 0.35, 0, '#a5523f');
[[0, 1.05, 0, 0.5], [-0.3, 0.9, 0.12, 0.36], [0.3, 0.92, -0.05, 0.38], [0.05, 1.42, 0, 0.3]].forEach(([x, y, z, r]) => {
  const l = add(plant, new THREE.SphereGeometry(r, 20, 14), toon('#6fd08c'), x, y, z, '#3f8a55'); l.scale.set(1, 0.85, 1);
});

/* kệ + máy chơi game cầm tay hình quả trứng (chi tiết hoài niệm) */
add(room, new THREE.BoxGeometry(0.5, 0.1, 1.6), toon('#ffd9a8'), -4.25, 2.2, -0.6, '#a8778e');
const egg = add(room, new THREE.SphereGeometry(0.22, 20, 16), toon('#9ad0ff'), -4.22, 2.47, -0.85, '#4b6c96');
egg.scale.set(0.95, 1.2, 0.6);
const lcdScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.13), new THREE.MeshBasicMaterial({ color: '#cfe3a8' }));
lcdScreen.position.set(-4.08, 2.5, -0.85); lcdScreen.rotation.y = Math.PI / 2; room.add(lcdScreen);
add(room, new THREE.BoxGeometry(0.3, 0.4, 0.3), toon('#ff9ec4'), -4.22, 2.45, -0.25, '#a8507a');

/* Vệt nắng qua cửa sổ + bụi lấp lánh (chỉ ban ngày, ở phòng khách) */
const beamTex = canvasTex(64, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,246,214,.6)'); gr.addColorStop(1, 'rgba(255,246,214,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); });
const beams = new THREE.Group(); room.add(beams);
const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.45 });
[[1.15, 0.95], [2.25, 0.7]].forEach(([x, w]) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.4), beamMat); b.position.set(x, 1.55, -1.95); b.rotation.set(-0.8, 0, 0.12); beams.add(b); });
const DUST = 36, dustPos = new Float32Array(DUST * 3), dustSeed = new Float32Array(DUST);
for (let i = 0; i < DUST; i++) { dustSeed[i] = Math.random() * 100; dustPos[i * 3] = 0.8 + Math.random() * 1.9; dustPos[i * 3 + 1] = 0.4 + Math.random() * 2.6; dustPos[i * 3 + 2] = -3.1 + Math.random() * 2.4; }
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#fff3c4', size: 0.045, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
beams.add(dust);

/* ---------------- các khu vực ---------------- */
const areas = { home: room };
let area = 'home', moveYaw = null, fetchBall = null;
const petBase = new THREE.Vector3(0, 0, 0.35), petOff = new THREE.Vector3();
const AREA_NAME = { home: 'Phòng khách', kitchen: 'Bếp', bath: 'Phòng tắm', garden: 'Vườn', bedroom: 'Phòng ngủ' };
const PET_POS = { home: [0, 0, 0.35], kitchen: [0, 0, 0], bath: [0, 0.12, 0.2], garden: [0, 0, 0.6], bedroom: [0, 0.62, -0.4] };
/* [fov, camX, camY, camZ, lookX, lookY, lookZ] — ngang / dọc */
const CAM = {
  home:    [[30, 0, 3.2, 9.6, 0, 0.75, 0], [44, 0, 3.6, 11.5, 0, 0.35, 0]],
  kitchen: [[30, 0, 3.4, 9.4, 0, 0.75, 0.3], [44, 0, 3.8, 11.2, 0, 0.35, 0.3]],
  bath:    [[30, 0, 3.9, 8.8, 0, 0.95, 0], [44, 0, 4.3, 10.6, 0, 0.5, 0]],
  garden:  [[34, 0, 2.8, 10.5, 0, 1.0, 0], [48, 0, 3.2, 12.5, 0, 0.6, 0]],
  bedroom: [[30, 0, 4.0, 8.8, 0, 1.25, -0.3], [44, 0, 4.4, 10.6, 0, 0.85, -0.3]],
};
function shell(wallColor, wallT, floorColor, floorT, trim) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  add(g, new THREE.BoxGeometry(9, 0.4, 7), toon(floorColor, floorT), 0, -0.2, 0, '#9a5f4a', 0.04);
  add(g, new THREE.BoxGeometry(9, 5, 0.3), toon(wallColor, wallT), 0, 2.3, -3.65, '#8a7a9a', 0.04);
  let t2 = null; if (wallT) { t2 = wallT.clone(); t2.repeat.set(4, 3); t2.needsUpdate = true; }
  add(g, new THREE.BoxGeometry(0.3, 5, 7.3), toon(wallColor, t2), -4.65, 2.3, 0, '#8a7a9a', 0.04);
  add(g, new THREE.BoxGeometry(9, 0.35, 0.36), toon(trim), 0, 0.17, -3.45, '#8a7a9a');
  return g;
}
function windowOn(g, x, y, draw) {
  const c = canvasTex(256, 192, draw);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.5), new THREE.MeshBasicMaterial({ map: c })); w.position.set(x, y, -3.48); g.add(w);
  const fm = toon('#fff7ef');
  [[y + 0.8], [y - 0.8]].forEach(([yy]) => add(g, new THREE.BoxGeometry(2.3, 0.13, 0.16), fm, x, yy, -3.45, '#a8778e'));
  [x - 1.08, x + 1.08, x].forEach((xx, i) => add(g, new THREE.BoxGeometry(i === 2 ? 0.07 : 0.13, 1.6, 0.16), fm, xx, y, -3.45, '#a8778e'));
}

/* Bếp */
const tileTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#cfe6f5'; g.lineWidth = 6; g.strokeRect(0, 0, w, h); g.fillStyle = '#9fd3f0'; g.fillRect(52, 52, 24, 24); }, [9, 5]);
const checkTex = canvasTex(128, 128, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ffe0a8'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); }, [6, 5]);
const kitchen = shell('#ffffff', tileTex, '#fff2d6', checkTex, '#9fd3f0'); areas.kitchen = kitchen;
add(kitchen, new THREE.BoxGeometry(5.2, 1.6, 1.0), toon('#ffb3c9'), -1.4, 0.8, -3.0, '#a8507a');
[-3.3, -2.0, -0.7, 0.6].forEach(x => add(kitchen, new THREE.BoxGeometry(0.5, 0.07, 0.05), toon('#ffffff'), x, 1.2, -2.48, '#a8507a', 0.01));
add(kitchen, new THREE.BoxGeometry(5.4, 0.14, 1.15), toon('#fff7ef'), -1.4, 1.66, -2.98, '#a8778e');
add(kitchen, new THREE.CylinderGeometry(0.32, 0.32, 0.06, 24), toon('#4a4458'), -2.6, 1.76, -2.9, '#2a2430');
add(kitchen, new THREE.CylinderGeometry(0.42, 0.36, 0.5, 24), toon('#9fd3f0'), -2.6, 2.04, -2.9, '#4b6c96');
add(kitchen, new THREE.BoxGeometry(1.3, 3.0, 1.1), toon('#bfe8ff'), 3.4, 1.5, -2.9, '#4b6c96');
add(kitchen, new THREE.BoxGeometry(1.3, 0.05, 1.12), toon('#9fd3f0'), 3.4, 2.0, -2.9, null);
add(kitchen, new THREE.BoxGeometry(0.08, 0.7, 0.08), toon('#ffffff'), 2.85, 2.5, -2.32, '#4b6c96');
add(kitchen, new THREE.BoxGeometry(2.4, 0.1, 0.5), toon('#ffd9a8'), -1.2, 3.1, -3.3, '#a8778e');
[[-2, '#ff9ec4'], [-1.4, '#ffd36e'], [-0.8, '#7edb72']].forEach(([x, c]) => add(kitchen, new THREE.CylinderGeometry(0.16, 0.16, 0.4, 14), toon(c), x, 3.36, -3.3, '#7a4a63'));
windowOn(kitchen, 1.2, 3.0, (g) => { const gr = g.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#8fd8ff'); gr.addColorStop(1, '#e6f8ff'); g.fillStyle = gr; g.fillRect(0, 0, 256, 192); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(80, 80, 22, 0, 7); g.arc(108, 70, 26, 0, 7); g.arc(136, 82, 20, 0, 7); g.fill(); });
add(kitchen, new THREE.CylinderGeometry(1.5, 1.5, 0.05, 40), toon('#ffcfdc'), 0, 0.03, 0.4, '#a8507a', 0.02);
add(kitchen, new THREE.BoxGeometry(2.4, 0.14, 0.9), toon('#ffd9a8'), 0, 0.52, 1.85, '#9a5f4a');
[[-1.05, 1.5], [1.05, 1.5], [-1.05, 2.2], [1.05, 2.2]].forEach(([x, z]) => add(kitchen, new THREE.BoxGeometry(0.12, 0.45, 0.12), toon('#e8b47a'), x, 0.23, z, '#9a5f4a'));
add(kitchen, new THREE.CylinderGeometry(0.42, 0.34, 0.06, 28), toon('#ffffff'), 0, 0.62, 1.8, '#8a7a9a', 0.02);

/* Phòng tắm */
const bathTile = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#eaf7ff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#bfe3f7'; g.lineWidth = 5; [[2, 2], [66, 2], [2, 66], [66, 66]].forEach(([x, y]) => g.strokeRect(x, y, 60, 60)); }, [6, 4]);
const bath = shell('#eaf7ff', bathTile, '#d6f0ff', null, '#9fd3f0'); areas.bath = bath;
const tub = add(bath, new THREE.CylinderGeometry(1.9, 1.7, 1.0, 40), toon('#ffffff'), 0, 0.5, 0.2, '#6f8fb8', 0.04); tub.scale.set(1.15, 1, 0.8);
const water = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.05, 40), new THREE.MeshToonMaterial({ color: '#8fdcff', gradientMap: grad, transparent: true, opacity: 0.93 }));
water.scale.set(1.15, 1, 0.8); water.position.set(0, 1.01, 0.2); bath.add(water);
const rim = add(bath, new THREE.TorusGeometry(1.86, 0.12, 12, 48), toon('#ffffff'), 0, 1.02, 0.2, '#6f8fb8', 0.02); rim.rotation.x = -Math.PI / 2; rim.scale.set(1.15, 0.8, 1);
[[-1.2, 0.5], [1.1, -0.2], [-0.6, -0.5], [0.9, 0.85], [-1.5, -0.1], [1.6, 0.3]].forEach(([x, z], i) => { const f = add(bath, new THREE.SphereGeometry(0.2 + (i % 3) * 0.06, 14, 10), toon('#ffffff'), x, 1.05, z + 0.2, '#9fc8e8', 0.02); f.scale.set(1, 0.6, 1); });
const duck = new THREE.Group(); duck.position.set(1.25, 1.05, 0.75); bath.add(duck);
const dB = add(duck, new THREE.SphereGeometry(0.22, 18, 14), toon('#ffd84a'), 0, 0.08, 0, '#a8742e', 0.02); dB.scale.set(1.2, 0.8, 1);
add(duck, new THREE.SphereGeometry(0.14, 16, 12), toon('#ffd84a'), 0.12, 0.3, 0, '#a8742e', 0.02);
const beak = add(duck, new THREE.ConeGeometry(0.06, 0.14, 10), toon('#ff8a3c'), 0.28, 0.29, 0, '#a5523f', 0.01); beak.rotation.z = -Math.PI / 2;
add(bath, new THREE.CylinderGeometry(0.05, 0.05, 1.2, 10), toon('#cfd8e8'), -2.6, 3.5, -3.3, '#6f8fb8', 0.01);
const shower = add(bath, new THREE.CylinderGeometry(0.32, 0.18, 0.2, 20), toon('#cfd8e8'), -2.6, 2.9, -3.1, '#6f8fb8'); shower.rotation.x = 0.5;
add(bath, new THREE.BoxGeometry(0.12, 1.3, 0.9), toon('#ff9ec4'), -4.45, 2.4, -1.2, '#a8507a');
add(bath, new THREE.BoxGeometry(2.0, 0.05, 0.9), toon('#ffcfdc'), 0, 0.03, 2.2, '#a8507a', 0.02);

/* Vườn */
const garden = new THREE.Group(); garden.visible = false; scene.add(garden); areas.garden = garden;
add(garden, new THREE.CylinderGeometry(15, 14.5, 0.6, 72), toon('#8fdc7a'), 0, -0.3, 0, '#4f9a4a', 0.04);
add(garden, new THREE.CylinderGeometry(2.4, 2.4, 0.04, 40), toon('#a9e892'), 0, 0.02, 0.6, null);
for (let i = -7; i <= 7; i++) add(garden, new THREE.BoxGeometry(0.2, 1.1, 0.2), toon('#fff3e0'), i * 0.85, 0.55, -4.3, '#a8778e', 0.02);
[0.75, 0.35].forEach(y => add(garden, new THREE.BoxGeometry(12.5, 0.12, 0.12), toon('#fff3e0'), 0, y, -4.25, '#a8778e', 0.02));
add(garden, new THREE.CylinderGeometry(0.28, 0.38, 2.2, 14), toon('#a8744e'), -4.6, 1.1, -2.6, '#6a4630');
[[-4.6, 2.9, -2.6, 1.3], [-5.3, 2.4, -2.2, 0.9], [-3.9, 2.5, -2.3, 0.95]].forEach(([x, y, z, r]) => add(garden, new THREE.SphereGeometry(r, 22, 16), toon('#5fc46c'), x, y, z, '#2f7a3d'));
[[4.3, 0.5, -3.0, 0.8], [5.2, 0.45, -2.3, 0.6], [3.6, 0.4, -2.2, 0.5]].forEach(([x, y, z, r]) => add(garden, new THREE.SphereGeometry(r, 18, 14), toon('#6fd08c'), x, y, z, '#2f7a3d'));
{ const R2 = rnd(5); const cols = ['#ff9ec4', '#ffd36e', '#ffffff', '#c9b8ff'];
  for (let i = 0; i < 26; i++) { const x = (R2() * 2 - 1) * 6, z = -3.6 + R2() * 6.5; if (Math.hypot(x, z - 0.6) < 2.6) continue;
    add(garden, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), toon('#4fae5a'), x, 0.15, z, null);
    add(garden, new THREE.SphereGeometry(0.11, 10, 8), toon(cols[i % 4]), x, 0.33, z, '#7a4a63', 0.015); } }
const cloudM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
[[-6, 5.2, -9], [3, 6.2, -10], [8, 4.8, -9]].forEach(([x, y, z]) => { [[0, 0, 1], [1.1, 0.2, 1.2], [2.2, 0, 0.9]].forEach(([dx, dy, r]) => { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), cloudM); c.position.set(x + dx, y + dy, z); garden.add(c); }); });
const ballTex = canvasTex(128, 64, g => { g.fillStyle = '#ff9ec4'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#ffffff'; g.fillRect(0, 26, 128, 12); g.fillStyle = '#ffd36e'; g.fillRect(0, 0, 128, 8); g.fillRect(0, 56, 128, 8); });
const ball = add(garden, new THREE.SphereGeometry(0.3, 24, 18), toon('#ffffff', ballTex), 2.0, 0.3, 1.4, '#a8507a', 0.02);

/* Phòng ngủ */
const starWall = canvasTex(128, 128, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff2b0'; [[20, 30], [80, 20], [50, 80], [104, 96]].forEach(([x, y]) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 4 : 10; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); }); }, [6, 3]);
const bedroom = shell('#b9b0f0', starWall, '#e8c9a8', woodTex, '#9d8fe0'); areas.bedroom = bedroom;
windowOn(bedroom, 2.3, 3.0, (g) => { const gr = g.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#1b1d4d'); gr.addColorStop(1, '#5a3d8a'); g.fillStyle = gr; g.fillRect(0, 0, 256, 192);
  g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(170, 70, 30, 0, 7); g.fill(); g.fillStyle = '#26245a'; g.beginPath(); g.arc(184, 60, 27, 0, 7); g.fill();
  g.fillStyle = '#fff'; [[30, 30], [70, 90], [110, 40], [60, 150], [210, 150], [140, 130]].forEach(([x, y]) => g.fillRect(x, y, 4, 4)); });
add(bedroom, new THREE.BoxGeometry(3.4, 0.5, 3.4), toon('#ffd9a8'), 0, 0.25, -0.7, '#9a5f4a');
add(bedroom, new THREE.BoxGeometry(3.2, 0.3, 3.2), toon('#fff7fb'), 0, 0.6, -0.7, '#a8778e');
add(bedroom, new THREE.BoxGeometry(3.4, 1.8, 0.25), toon('#ff9ec4'), 0, 1.1, -2.4, '#a8507a');
const pillow = add(bedroom, new THREE.SphereGeometry(0.6, 20, 14), toon('#ffffff'), 0, 1.0, -1.85, '#a8778e'); pillow.scale.set(1.7, 0.45, 0.8);
const blanketTex = canvasTex(128, 128, g => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#d6e4ff'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 32, y * 32, 32, 32); }, [3, 2]);
add(bedroom, new THREE.BoxGeometry(3.25, 0.5, 1.7), toon('#9fb8ff', blanketTex), 0, 0.95, 0.35, '#5a5aa8', 0.03);
add(bedroom, new THREE.BoxGeometry(0.9, 0.9, 0.9), toon('#ffd9a8'), 2.6, 0.45, -1.6, '#9a5f4a');
add(bedroom, new THREE.CylinderGeometry(0.08, 0.12, 0.5, 10), toon('#ffffff'), 2.6, 1.15, -1.6, '#a8778e', 0.01);
const shade = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.4, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd59a', side: THREE.DoubleSide })); shade.position.set(2.6, 1.55, -1.6); bedroom.add(shade);
add(bedroom, new THREE.CylinderGeometry(2.0, 2.0, 0.05, 40), toon('#c9b8ff'), 0, 0.03, 1.9, '#6a5ab0', 0.02);

function rnd(seed) { let a = seed; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; }

/* chuyển cảnh */
let going = false;
function goTo(name, instant) {
  if (going) return;
  if (name === area) { onEnter(name); return; }
  const label = name === 'home' ? 'Về Phòng khách…' : `Đi tới ${AREA_NAME[name]}…`;
  const swap = () => {
    Object.entries(areas).forEach(([k, g]) => { g.visible = k === name; });
    area = name; petBase.set(...PET_POS[name]); petOff.set(0, 0, 0); moveYaw = null; fetchBall = null; wander = null; action = null;
    if (name === 'garden') ball.position.set(2.0, 0.3, 1.4);
    particles.forEach(p => releaseSprite(p.s)); particles.length = 0; camIntro = reduce ? 0 : 1;
    bubbleEl.hidden = true; anim = null;
    resize(); applyAreaLights(); onEnter(name);
    document.getElementById('scene-tag').textContent = AREA_NAME[name];
  };
  if (instant || reduce) { swap(); return; }
  going = true;
  const w = document.getElementById('wipe'); document.getElementById('wipe-label').textContent = label;
  w.className = 'in';
  setTimeout(() => { swap(); w.className = 'out'; setTimeout(() => { w.className = ''; going = false; }, 500); }, 500);
}
const CTX = {
  home: [],
  kitchen: [['home', 'Ăn xong, về phòng']],
  bath: [['rinse', 'Xả nước'], ['home', 'Về phòng']],
  garden: [['ball', 'Ném bóng'], ['spin', 'Xoay vòng'], ['home', 'Về phòng']],
  bedroom: [['wake', 'Thức dậy']],
};
function onEnter(name) {
  document.getElementById('tray').hidden = name !== 'kitchen';
  [['a-eat', 'kitchen'], ['a-bath', 'bath'], ['a-play', 'garden']].forEach(([id, a]) => document.getElementById(id).setAttribute('aria-pressed', String(name === a)));
  const ctx = document.getElementById('ctx');
  ctx.innerHTML = CTX[name].map(([k, l]) => `<button class="ctx-btn${k === 'home' || k === 'wake' ? ' ghosty' : ''}" type="button" data-k="${k}">${l}</button>`).join('');
  ctx.hidden = !CTX[name].length;
  const line = { kitchen: 'Tới giờ ăn rồi! Hôm nay ăn gì đây?', bath: 'Nước ấm quá~ Vuốt lên người mình để kỳ cọ nha!', garden: 'Ra vườn chơi thôi! Ném bóng cho mình đi!' }[name];
  if (line) setTimeout(() => say(line, 3200), reduce ? 0 : 350);
}
function applyAreaLights() {
  const night = period === 'dem';
  beams.visible = !night;
  rimColor.value.set(area === 'bedroom' || night ? '#b9c4ff' : period === 'chieu' ? '#ffd9b8' : '#fff4e8'); rimStrength.value = area === 'bedroom' ? 0.35 : night ? 0.4 : 0.5;
  if (area === 'bedroom') { hemi.intensity = 0.75; sun.intensity = 0.35; sun.color.set('#b7b8ff'); lamp.position.set(2.4, 2.2, -0.6); lamp.intensity = 20; return; }
  const moon = night && area === 'garden';
  hemi.intensity = moon ? 1.3 : night ? 0.95 : 1.6; sun.intensity = moon ? 1.0 : night ? 0.7 : 2.0; sun.color.set(night ? '#c3c4ff' : (period === 'chieu' ? '#ffd2b0' : '#fff1dc'));
  lamp.position.set(-1.5, 3, 2); lamp.intensity = night && area !== 'garden' ? 18 : 0;
}
let scrubN = 0;
function scrub() {
  actBatched('bath_scrub'); S.sach = clamp(S.sach + 3); spawn('bubble', 2, 0.9); setTemp('love', 1200); impulse(-0.9); scrubN++;
  if (scrubN % 8 === 0) say(['Chỗ đó đó, ngứa quá!', 'Bọt nhiều ghê!', 'Sạch bong rồi nè!'][Math.floor(Math.random() * 3)], 1800);
}
function rinse() {
  count('bath'); act('bath_rinse'); popText('Sạch bong!', '#2fa8e0');
  S.sach = 100; S.vui = clamp(S.vui + 4); spawn('sparkle', 4, 1); spawn('bubble', 10, 1.3);
  startAction('shake'); setTemp('love', 2000); say('Thơm phức rồi nè!', 2200); save(); renderStats();
  setTimeout(() => { if (area === 'bath') goTo('home'); }, 2600);
}
function throwBall() {
  if (fetchBall) return;
  if (S.nl < 15) { setTemp('sleepy', 1800); say('Mình mệt quá, cho mình nghỉ chút đã…', 2600); return; }
  const tx = (Math.random() * 2 - 1) * 3.2, tz = -1.6 + Math.random() * 2.4;
  fetchBall = { phase: 'fly', t: 0, from: new THREE.Vector3(0.6, 2.8, 5.5), to: new THREE.Vector3(tx, 0.3, tz) };
  setTemp('excited', 900);
}
function spinPlay() {
  if (S.nl < 15) { setTemp('sleepy', 1800); say('Mình mệt quá, cho mình nghỉ chút đã…', 2600); return; }
  act('play_spin'); popText('+6 Vui'); S.vui = clamp(S.vui + 6); S.nl = clamp(S.nl - 4); S.no = clamp(S.no - 2);
  anim = { type: 'spin', t: 0, dur: 1.1 }; setTemp('excited', 1600); spawn('note', 2); spawn('sparkle', 2);
  setTimeout(() => say(['Yeah! Thêm vòng nữa!', 'Vui quá đi!', 'Chóng mặt mà vui ghê!'][Math.floor(Math.random() * 3)], 2200), 1100);
  save(); renderStats();
}
const tmpV = new THREE.Vector3();
function updateArea(dt, t) {
  if (area === 'bath') { duck.position.y = 1.05 + Math.sin(t * 2.2) * 0.04; duck.rotation.z = Math.sin(t * 1.7) * 0.12; }
  if (area !== 'garden' || !fetchBall) { if (!wander) moveYaw = null; return; }
  const f = fetchBall;
  if (f.phase === 'fly') {
    f.t += dt / 0.8; const p = Math.min(f.t, 1);
    ball.position.lerpVectors(f.from, f.to, p); ball.position.y += Math.sin(p * Math.PI) * 2.4; ball.rotation.x += dt * 8;
    if (p >= 1) { f.phase = 'bounce'; f.bt = 0; impulse(-1); addTrauma(0.15); }
  } else if (f.phase === 'bounce') {
    f.bt += dt; ball.position.y = 0.3 + Math.abs(Math.sin(f.bt * 9)) * 0.6 * Math.exp(-f.bt * 4); setTemp('excited', 250);
    if (f.bt > 0.55) { f.phase = 'run'; ball.position.y = 0.3; }
  } else if (f.phase === 'run' || f.phase === 'back') {
    const goal = f.phase === 'run' ? tmpV.set(f.to.x - petBase.x, 0, f.to.z - petBase.z + 0.9) : tmpV.set(0, 0, 0);
    const dx = goal.x - petOff.x, dz = goal.z - petOff.z, d = Math.hypot(dx, dz), step = 3.6 * dt;
    if (d > 0.05) { petOff.x += dx / d * Math.min(step, d); petOff.z += dz / d * Math.min(step, d); moveYaw = Math.atan2(dx, dz); }
    setTemp('excited', 250);
    if (f.phase === 'back') { petRoot.localToWorld(ball.position.set(0, 2.45, 0.2)); }
    if (d < 0.08) {
      if (f.phase === 'run') { f.phase = 'back'; spawn('sparkle'); impulse(-2); }
      else {
        fetchBall = null; moveYaw = null; ball.position.set(petBase.x + 1.0, 0.3, petBase.z + 0.9);
        count('ball'); act('play_ball'); popText('+8 Vui');
        S.vui = clamp(S.vui + 8); S.nl = clamp(S.nl - 4); S.no = clamp(S.no - 2);
        setTemp('love', 1500); spawn('heart', 2); say(['Bắt được rồi nè! Ném nữa đi!', 'Mình chạy nhanh không?', 'Hihi, lần nữa nha!'][Math.floor(Math.random() * 3)], 2400);
        save(); renderStats();
      }
    }
  }
}

/* ---------------- con thú ---------------- */
const PAL = PALETTES[S.palette] || PALETTES[0];
const PET_INK = PAL.ink, BODY = PAL.body, DEEP = PAL.deep;
const petRoot = new THREE.Group(); petRoot.position.set(0, 0, 0.35); scene.add(petRoot);
const pivot = new THREE.Group(); petRoot.add(pivot);
const body = add(pivot, new THREE.SphereGeometry(1, 56, 40), petToon(BODY), 0, 0.98, 0, PET_INK, 0.035);
body.scale.set(1.06, 0.95, 1);
/* tai */
const ears = [-1, 1].map(s => {
  const eg = new THREE.Group(); eg.position.set(s * 0.5, 1.5, -0.03); eg.rotation.z = -s * 0.38; eg.userData.s = s; pivot.add(eg);
  const ear = add(eg, new THREE.SphereGeometry(0.34, 24, 18), petToon(BODY), 0, 0.3, -0.02, PET_INK, 0.03); ear.scale.set(0.62, 1.25, 0.52);
  const inner = add(eg, new THREE.SphereGeometry(0.2, 18, 14), toon(PAL.inner), 0, 0.28, 0.11, null); inner.scale.set(0.55, 1.05, 0.3);
  return eg;
});
/* mầm lá trên đầu */
const sprout = new THREE.Group(); sprout.position.set(0.05, 1.86, 0); pivot.add(sprout);
add(sprout, new THREE.CylinderGeometry(0.03, 0.04, 0.32, 8), toon('#5cbf6a'), 0, 0.14, 0, '#2f7a3d', 0.015);
[-1, 1].forEach(s => { const lf = add(sprout, new THREE.SphereGeometry(0.16, 16, 12), toon('#7edb72'), s * 0.15, 0.3, 0, '#2f7a3d', 0.02); lf.scale.set(1.25, 0.45, 0.7); lf.rotation.z = s * 0.45; });
/* tay, chân, đuôi */
const arms = [-1, 1].map(s => { const a = add(pivot, new THREE.SphereGeometry(0.2, 18, 14), petToon(BODY), s * 0.98, 0.78, 0.22, PET_INK); a.scale.set(0.8, 1, 0.8); return a; });
const feet = [-1, 1].map(s => { const f = add(pivot, new THREE.SphereGeometry(0.27, 20, 14), petToon(DEEP), s * 0.42, 0.1, 0.38, PET_INK); f.scale.set(1, 0.5, 1.2); return f; });
const tail = add(pivot, new THREE.SphereGeometry(0.22, 18, 14), petToon(DEEP), 0, 0.5, -0.98, PET_INK);

/* bóng tròn dưới chân */
const shadowTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(90,40,90,.38)'); r.addColorStop(1, 'rgba(90,40,90,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.075, 0.4); scene.add(shadow);

/* ---------------- khuôn mặt (texture 2D) ---------------- */
const FW = 600, FH = 496;
const fc = document.createElement('canvas'); fc.width = FW; fc.height = FH;
const fx = fc.getContext('2d');
const faceTex = new THREE.CanvasTexture(fc); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const faceGeo = new THREE.SphereGeometry(1.006, 64, 40, Math.PI / 2 - 0.75, 1.5, Math.PI / 2 - 0.78, 1.24);
const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
body.add(face);

const INK = '#4a2140', LX = FW * 0.32, RX = FW * 0.68, EY = FH * 0.47, MX = FW / 2, MY = FH * 0.74;
function ell(x, y, rx, ry) { fx.beginPath(); fx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
function star(x, y, r, col) {
  fx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * 0.38 : r; fx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  fx.closePath(); fx.fillStyle = col; fx.fill();
}
function eyeOpen(x, y, o = {}) {
  const rx = 46, ry = 64, ly = o.lookY || 0, lx = o.lookX || 0;
  fx.save();
  let lidY = null;
  if (o.lid) { lidY = y - ry + 2 * ry * o.lid; fx.beginPath(); fx.rect(x - 90, lidY, 180, 200); fx.clip(); }
  ell(x, y, rx, ry); fx.fillStyle = INK; fx.fill();
  const g = fx.createLinearGradient(0, y - ry, 0, y + ry);
  g.addColorStop(0, '#4a2140'); g.addColorStop(0.5, '#8a4be0'); g.addColorStop(1, '#ffa6dc');
  ell(x, y + 4, rx - 8, ry - 10); fx.fillStyle = g; fx.fill();
  ell(x + lx, y + 6 + ly, 18, 26); fx.fillStyle = '#2a0f2e'; fx.fill();
  if (o.star) { star(x - 10, y - 18 + ly, 24, '#fff'); star(x + 17, y + 24, 11, '#fff'); }
  else { ell(x - 15 + lx * 0.5, y - 24 + ly, 15, 19); fx.fillStyle = '#fff'; fx.fill(); ell(x + 16, y + 22, 7, 7); fx.fill(); }
  if (o.tears) { fx.fillStyle = 'rgba(140,210,255,.85)'; fx.fillRect(x - rx, y + 30, rx * 2, 40); }
  fx.restore();
  fx.strokeStyle = INK; fx.lineCap = 'round';
  if (lidY !== null) {
    fx.lineWidth = 11; fx.beginPath(); fx.moveTo(x - rx - 4, lidY + 2); fx.quadraticCurveTo(x, lidY + (o.lidCurve || 8), x + rx + 4, lidY + 2); fx.stroke();
  } else {
    fx.lineWidth = 11; fx.beginPath(); fx.ellipse(x, y, rx + 2, ry + 2, 0, Math.PI * 1.08, Math.PI * 1.92); fx.stroke();
    const side = x < MX ? -1 : 1; fx.lineWidth = 8; fx.beginPath(); fx.moveTo(x + side * (rx - 2), y - ry * 0.55); fx.lineTo(x + side * (rx + 14), y - ry * 0.78); fx.stroke();
  }
  if (o.tears) { fx.fillStyle = '#8fd3ff'; fx.beginPath(); const tx = x + (x < MX ? -rx + 6 : rx - 6), ty = y + ry - 2; fx.moveTo(tx, ty); fx.quadraticCurveTo(tx + 12, ty + 22, tx, ty + 30); fx.quadraticCurveTo(tx - 12, ty + 22, tx, ty); fx.fill(); }
}
function eyeHappy(x, y) { fx.strokeStyle = INK; fx.lineWidth = 13; fx.lineCap = 'round'; fx.beginPath(); fx.moveTo(x - 40, y + 14); fx.quadraticCurveTo(x, y - 36, x + 40, y + 14); fx.stroke(); }
function eyeSleep(x, y) {
  fx.strokeStyle = INK; fx.lineWidth = 11; fx.lineCap = 'round'; fx.beginPath(); fx.moveTo(x - 40, y + 4); fx.quadraticCurveTo(x, y + 34, x + 40, y + 4); fx.stroke();
  fx.lineWidth = 6; [-24, 0, 24].forEach(d => { fx.beginPath(); fx.moveTo(x + d, y + 22 - Math.abs(d) * 0.2); fx.lineTo(x + d * 1.2, y + 36); fx.stroke(); });
}
function eyeSwirl(x, y) {
  fx.strokeStyle = INK; fx.lineWidth = 8; fx.lineCap = 'round'; fx.beginPath();
  for (let a = 0; a < Math.PI * 6; a += 0.15) { const r = 4 + a * 2.6; fx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.15); }
  fx.stroke();
}
function eyeSqueeze(x, y) {
  const s = x < MX ? 1 : -1; fx.strokeStyle = INK; fx.lineWidth = 12; fx.lineCap = 'round'; fx.lineJoin = 'round';
  fx.beginPath(); fx.moveTo(x - s * 30, y - 26); fx.lineTo(x + s * 26, y); fx.lineTo(x - s * 30, y + 26); fx.stroke();
}
function brows(kind) {
  fx.strokeStyle = INK; fx.lineWidth = 10; fx.lineCap = 'round'; fx.beginPath();
  if (kind === 'angry') { fx.moveTo(LX - 42, EY - 102); fx.lineTo(LX + 40, EY - 80); fx.moveTo(RX + 42, EY - 102); fx.lineTo(RX - 40, EY - 80); }
  else { fx.moveTo(LX - 42, EY - 84); fx.lineTo(LX + 38, EY - 104); fx.moveTo(RX + 42, EY - 84); fx.lineTo(RX - 38, EY - 104); }
  fx.stroke();
}
function blush(a, cold) {
  if (a <= 0 && !cold) return;
  [FW * 0.17, FW * 0.83].forEach(x => {
    ell(x, FH * 0.66, 44, 22); fx.fillStyle = cold ? 'rgba(130,170,255,.35)' : `rgba(255,105,150,${a * 0.55})`; fx.fill();
    if (!cold && a > 0.4) { fx.strokeStyle = `rgba(220,70,120,${a * 0.8})`; fx.lineWidth = 5; fx.lineCap = 'round';
      [-16, 0, 16].forEach(d => { fx.beginPath(); fx.moveTo(x + d - 6, FH * 0.66 + 9); fx.lineTo(x + d + 6, FH * 0.66 - 9); fx.stroke(); }); }
  });
}
function mouth(kind, phase) {
  fx.strokeStyle = INK; fx.fillStyle = '#7a1f3d'; fx.lineWidth = 8; fx.lineCap = 'round'; fx.lineJoin = 'round';
  const k = kind === 'chew' ? (phase ? 'smallo' : 'w') : kind;
  fx.beginPath();
  if (k === 'w') { fx.moveTo(MX - 26, MY - 6); fx.quadraticCurveTo(MX - 13, MY + 14, MX, MY - 4); fx.quadraticCurveTo(MX + 13, MY + 14, MX + 26, MY - 6); fx.stroke(); }
  else if (k === 'open') { fx.moveTo(MX - 34, MY - 10); fx.quadraticCurveTo(MX, MY - 4, MX + 34, MY - 10); fx.quadraticCurveTo(MX + 28, MY + 34, MX, MY + 36); fx.quadraticCurveTo(MX - 28, MY + 34, MX - 34, MY - 10); fx.fill(); fx.stroke();
    ell(MX, MY + 24, 16, 9); fx.fillStyle = '#ff8fb0'; fx.fill(); }
  else if (k === 'o') { ell(MX, MY + 4, 13, 17); fx.fill(); fx.stroke(); }
  else if (k === 'smallo') { ell(MX, MY + 2, 8, 9); fx.fill(); fx.stroke(); }
  else if (k === 'line') { fx.moveTo(MX - 14, MY + 2); fx.lineTo(MX + 14, MY + 2); fx.stroke(); }
  else if (k === 'wavy') { fx.moveTo(MX - 30, MY); for (let i = 0; i <= 6; i++) fx.lineTo(MX - 30 + i * 10, MY + (i % 2 ? -7 : 7)); fx.stroke(); }
  else if (k === 'pout') { fx.moveTo(MX - 18, MY + 10); fx.quadraticCurveTo(MX, MY - 12, MX + 18, MY + 10); fx.stroke(); }
  else if (k === 'frown') { fx.moveTo(MX - 26, MY + 12); fx.quadraticCurveTo(MX, MY - 14, MX + 26, MY + 12); fx.stroke(); }
}
function gloom() { fx.strokeStyle = 'rgba(100,120,210,.5)'; fx.lineWidth = 6; for (let i = 0; i < 7; i++) { const x = FW * 0.3 + i * FW * 0.067; fx.beginPath(); fx.moveTo(x, 8); fx.lineTo(x, 70 + (i % 2) * 22); fx.stroke(); } }

const EXPR = {
  vui:      { label: 'Vui',        eyes: 'open',  mouth: 'w',      blush: .45, msg: 'đang vui' },
  excited:  { label: 'Phấn khích', eyes: 'star',  mouth: 'open',   blush: .7,  fx: 'sparkle', msg: 'phấn khích quá!' },
  hungry:   { label: 'Đói',        eyes: 'open',  lookY: -12, mouth: 'o', blush: .3, drool: true, msg: 'hơi đói' },
  sleepy:   { label: 'Buồn ngủ',   eyes: 'open',  lid: .58, mouth: 'line', blush: .25, msg: 'buồn ngủ rồi' },
  sleep:    { label: 'Ngủ',        eyes: 'sleep', mouth: 'smallo', blush: .35, fx: 'zzz', msg: 'đang ngủ' },
  sick:     { label: 'Ốm',         eyes: 'swirl', mouth: 'wavy',   blush: 0, cold: true, gloom: true, fx: 'sweat', msg: 'bị cảm lạnh' },
  sulky:    { label: 'Dỗi',        eyes: 'open',  lid: .36, lidCurve: -6, brows: 'angry', mouth: 'pout', blush: .65, fx: 'anger', msg: 'đang dỗi' },
  sad:      { label: 'Buồn',       eyes: 'open',  tears: true, brows: 'sad', mouth: 'frown', blush: .2, msg: 'hơi buồn' },
  love:     { label: 'Âu yếm',     eyes: 'happy', mouth: 'open',   blush: .9, fx: 'heart', msg: 'thích được vuốt ve' },
  yawn:     { label: 'Ngáp',       eyes: 'squeeze', mouth: 'open', blush: .3, msg: 'đang ngáp' },
  chew:     { label: 'Nhai',       eyes: 'happy', mouth: 'chew',   blush: .5, msg: 'đang nhai nhóp nhép' },
};
let faceKey = '';
function drawFace(key, blink, phase, gx = 0, gy = 0) {
  const k = key + '|' + blink + '|' + phase + '|' + gx + '|' + gy; if (k === faceKey) return; faceKey = k;
  const e = EXPR[key];
  fx.clearRect(0, 0, FW, FH);
  if (e.gloom) gloom();
  blush(e.blush, e.cold);
  const eyes = (blink && (e.eyes === 'open' || e.eyes === 'star')) ? 'blink' : e.eyes;
  [LX, RX].forEach(x => {
    if (eyes === 'open' || eyes === 'star') eyeOpen(x, EY, { lid: e.lid, lidCurve: e.lidCurve, lookY: e.lookY !== undefined ? e.lookY : gy, lookX: gx, star: eyes === 'star', tears: e.tears });
    else if (eyes === 'happy') eyeHappy(x, EY);
    else if (eyes === 'sleep' || eyes === 'blink') eyeSleep(x, EY);
    else if (eyes === 'swirl') eyeSwirl(x, EY);
    else if (eyes === 'squeeze') eyeSqueeze(x, EY);
  });
  if (e.brows) brows(e.brows);
  mouth(e.mouth, phase);
  if (e.drool) { fx.fillStyle = '#bfe8ff'; fx.strokeStyle = INK; fx.lineWidth = 4; fx.beginPath(); fx.moveTo(MX + 14, MY + 14); fx.quadraticCurveTo(MX + 28, MY + 38, MX + 16, MY + 46); fx.quadraticCurveTo(MX + 4, MY + 38, MX + 14, MY + 14); fx.fill(); fx.stroke(); }
  faceTex.needsUpdate = true;
}

/* ---------------- ký hiệu cảm xúc (sprite) ---------------- */
const FXT = {
  heart: canvasTex(128, 128, g => { g.translate(64, 70); g.beginPath(); g.moveTo(0, 34); g.bezierCurveTo(-60, -6, -36, -58, 0, -26); g.bezierCurveTo(36, -58, 60, -6, 0, 34); g.fillStyle = '#ff5c9a'; g.strokeStyle = '#fff'; g.lineWidth = 8; g.stroke(); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-18, -18, 8, 5, -0.6, 0, Math.PI * 2); g.fill(); }),
  sparkle: canvasTex(128, 128, g => { g.translate(64, 64); g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 14 : 54; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = '#ffe066'; g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke(); g.fill(); }),
  sweat: canvasTex(128, 128, g => { g.translate(64, 64); g.beginPath(); g.moveTo(0, -50); g.quadraticCurveTo(40, 10, 0, 46); g.quadraticCurveTo(-40, 10, 0, -50); g.fillStyle = '#7cc7ff'; g.strokeStyle = '#fff'; g.lineWidth = 7; g.stroke(); g.fill(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(-10, 12, 6, 12, 0.3, 0, Math.PI * 2); g.fill(); }),
  anger: canvasTex(128, 128, g => { g.translate(64, 64); g.strokeStyle = '#ff4d6d'; g.lineWidth = 13; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(10, -42); g.quadraticCurveTo(12, -12, 42, -10); g.stroke(); g.restore(); } }),
  zzz: canvasTex(128, 128, g => { g.font = '800 96px "Baloo 2", system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#fff'; g.strokeText('Z', 64, 70); g.fillStyle = '#8f7cff'; g.fillText('Z', 64, 70); }),
  note: canvasTex(128, 128, g => { g.fillStyle = '#5ac8fa'; g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.ellipse(46, 92, 22, 16, -0.4, 0, Math.PI * 2); g.stroke(); g.fill(); g.fillRect(62, 22, 9, 70); g.beginPath(); g.moveTo(66, 22); g.quadraticCurveTo(96, 30, 98, 58); g.lineTo(90, 58); g.quadraticCurveTo(86, 40, 66, 40); g.fill(); }),
  bubble: canvasTex(128, 128, g => { g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.fillStyle = 'rgba(220,245,255,.45)'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#9fdcff'; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 34, Math.PI * 1.1, Math.PI * 1.5); g.stroke(); }),
};
FXT.crumb = canvasTex(64, 64, g => { g.fillStyle = '#e8b47a'; g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 20, 0, 7); g.stroke(); g.fill(); });
FXT.puff = canvasTex(128, 128, g => { g.fillStyle = 'rgba(255,255,255,.92)'; [[44, 72, 30], [80, 66, 34], [62, 44, 28]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); });
FXT.drop = FXT.sweat;
const particles = [];
/* Pool sprite: tái sử dụng thay vì tạo/huỷ mỗi hạt (skill performance-optimization) */
const spritePool = [];
function getSprite(tex) {
  const s = spritePool.pop() || new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  s.material.map = tex; s.material.opacity = 1; s.material.rotation = 0; scene.add(s); return s;
}
function releaseSprite(s) { scene.remove(s); spritePool.push(s); }
const headLocal = new THREE.Vector3(0, 2.25, 0), headW = new THREE.Vector3();
function spawn(type, n = 1, spread = 0.9) {
  for (let i = 0; i < n; i++) {
    const s = getSprite(FXT[type]);
    petRoot.localToWorld(headW.copy(headLocal));
    s.position.set(headW.x + (Math.random() - 0.5) * spread * 2, headW.y + Math.random() * 0.3 - (type === 'bubble' ? 1.1 : 0), headW.z + 0.3 + Math.random() * 0.3);
    const sc = type === 'bubble' ? 0.25 + Math.random() * 0.35 : 0.42; s.scale.set(sc, sc, sc);
    particles.push({ s, vx: (Math.random() - 0.5) * 0.4, vy: 0.7 + Math.random() * 0.5, life: 0, max: 1.3 + Math.random() * 0.5, base: sc, type });
  }
}

/* ---------------- ánh sáng & giờ thật ---------------- */
const hemi = new THREE.HemisphereLight('#fff6fb', '#b9a3e3', 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 2.0); sun.position.set(3, 8, 6); scene.add(sun);
const lamp = new THREE.PointLight('#ffb36b', 0, 9, 2); lamp.position.set(-1.5, 3, 2); scene.add(lamp);
const SKY = {
  sang:  ['#9fe0ff', '#ffe9f4', 'sun'],
  trua:  ['#63c4ff', '#cdf1ff', 'sun'],
  chieu: ['#ff9fb6', '#ffd99a', 'sun'],
  dem:   ['#1b1d4d', '#5a3d8a', 'moon'],
};
let period = '';
function periodNow() { const h = new Date().getHours(); return h >= 5 && h < 10 ? 'sang' : h >= 10 && h < 16 ? 'trua' : h >= 16 && h < 19 ? 'chieu' : 'dem'; }
function applyPeriod() {
  const p = periodNow(); if (p === period) return; period = p;
  const [a, b, body] = SKY[p];
  $('sky').style.background = `linear-gradient(${a}, ${b})`;
  const g = winCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 192);
  gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 256, 192);
  if (body === 'sun') { g.fillStyle = '#fff6c2'; g.beginPath(); g.arc(196, 52, 24, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.95)'; [[60, 70], [110, 120]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.arc(x + 22, y - 8, 22, 0, Math.PI * 2); g.arc(x + 46, y, 17, 0, Math.PI * 2); g.fill(); }); }
  else { g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(190, 54, 22, 0, Math.PI * 2); g.fill(); g.fillStyle = b; g.beginPath(); g.arc(200, 46, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; [[30, 30], [70, 80], [120, 40], [150, 120], [40, 140], [220, 140], [100, 160]].forEach(([x, y]) => g.fillRect(x, y, 3, 3)); }
  winTex.needsUpdate = true;
  applyAreaLights();
}

/* ---------------- biểu cảm hiện tại ---------------- */
let override = null, temp = null;
function derived() {
  if (S.asleep) return 'sleep';
  if (S.sach < 20) return 'sick';
  if (S.no < 30 && S.vui < 40) return 'sulky';
  if (S.no < 30) return 'hungry';
  if (S.nl < 22) return 'sleepy';
  if (S.vui < 28) return 'sad';
  return 'vui';
}
function setTemp(key, ms) { temp = { key, until: performance.now() + ms }; }
function current(now) { if (override) return override; if (temp && now < temp.until) return temp.key; temp = null; return derived(); }

/* ---------------- bong bóng thoại ---------------- */
const bubbleEl = $('bubble'); let bubbleUntil = 0;
function say(text, ms = 3600) { bubbleEl.textContent = text; bubbleEl.hidden = false; bubbleUntil = performance.now() + ms; bubbleEl.classList.remove('pop'); void bubbleEl.offsetWidth; bubbleEl.classList.add('pop'); }
const pv = new THREE.Vector3();
function placeBubble() {
  petRoot.localToWorld(pv.set(0, 2.55, 0)); pv.project(camera);
  const r = canvas.getBoundingClientRect();
  bubbleEl.style.left = `${(pv.x + 1) / 2 * r.width}px`; bubbleEl.style.top = `${(1 - pv.y) / 2 * r.height}px`;
}

/* ---------------- squash & stretch, hoạt cảnh ---------------- */
let sq = 0, sqv = 0, anim = null, shake = 0, yaw = 0;
const pointerNdc = new THREE.Vector2(0, 0);
function impulse(v) { sqv += v; }

/* ---------------- tương tác con trỏ ---------------- */
const ray = new THREE.Raycaster();
function ndcFrom(e) { const r = canvas.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
function hitPet(e) { ray.setFromCamera(ndcFrom(e), camera); return ray.intersectObject(pivot, true).length > 0; }
let down = null;
const hint = $('hint');
function hideHint() { hint.classList.add('gone'); }
canvas.addEventListener('pointerdown', e => {
  const hit = hitPet(e);
  down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, hit, moved: 0, acc: 0 };
  if (hit) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
});
canvas.addEventListener('pointermove', e => {
  pointerNdc.copy(ndcFrom(e));
  if (!down || !down.hit) return;
  const d = Math.hypot(e.clientX - down.lx, e.clientY - down.ly); down.lx = e.clientX; down.ly = e.clientY;
  down.moved += d; down.acc += d;
  if (down.acc > 42) { down.acc = 0; petStroke(); }
});
function endDown() { if (down && down.hit && down.moved < 10) poke(); down = null; canvas.style.cursor = 'grab'; }
canvas.addEventListener('pointerup', endDown);
canvas.addEventListener('pointercancel', () => { down = null; });

let petN = 0;
function petStroke() {
  hideHint();
  if (area === 'bath' && !S.asleep) { scrub(); return; }
  if (S.asleep) { if (Math.random() < 0.3) spawn('zzz'); impulse(-0.5); return; }
  S.vui = clamp(S.vui + 1.6); count('pet'); actBatched('pet'); if (++petN % 6 === 0) popText('+Vui'); setTemp('love', 1500); spawn('heart', 1, 0.7); impulse(-1.1);
  if (Math.random() < 0.15) say(['Hihi, nhột quá!', 'Thêm chút nữa đi mà~', 'Dễ chịu ghê!'][Math.floor(Math.random() * 3)], 1800);
}
function poke() {
  hideHint();
  if (S.asleep) { spawn('zzz'); impulse(-2); say('Ư… cho mình ngủ thêm chút…', 2200); return; }
  impulse(-4.2); addTrauma(0.12); buzz(10); setTemp('excited', 900); spawn('note'); spawn('sparkle'); S.vui = clamp(S.vui + 1);
}

/* ---------------- thức ăn ---------------- */
const FOODS = [
  { id: 'carot', name: 'Cà rốt', no: 10, vui: 2, line: 'Giòn giòn ngọt ngọt!', svg: '<svg viewBox="0 0 40 40"><path d="M14 13l13 3-11 19z" fill="#ff9a3c" stroke="#4a2140" stroke-width="2.2" stroke-linejoin="round"/><path d="M20 14c-1-5-4-7-7-8M22 15c1-5 4-8 8-8M21 14c0-4 0-7 1-10" fill="none" stroke="#4fae5a" stroke-width="2.6" stroke-linecap="round"/></svg>' },
  { id: 'comnam', name: 'Cơm nắm', no: 25, vui: 3, line: 'No bụng ghê, cảm ơn nha!', svg: '<svg viewBox="0 0 40 40"><path d="M20 6c6 0 15 17 13 23-1 4-25 4-26 0-2-6 7-23 13-23z" fill="#fff" stroke="#4a2140" stroke-width="2.2" stroke-linejoin="round"/><rect x="13" y="24" width="14" height="10" rx="2" fill="#2f4a3a"/></svg>' },
  { id: 'kem', name: 'Kem que', no: 5, vui: 15, line: 'Mát lạnh luôn!', svg: '<svg viewBox="0 0 40 40"><rect x="18" y="26" width="4" height="10" rx="2" fill="#e8b47a" stroke="#4a2140" stroke-width="1.8"/><path d="M12 12a8 8 0 0 1 16 0v14H12z" fill="#ff9ec4" stroke="#4a2140" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 18h16" stroke="#fff" stroke-width="2.4"/></svg>' },
  { id: 'che', name: 'Chè đậu', no: 15, vui: 12, line: 'Ngọt lịm tim!', svg: '<svg viewBox="0 0 40 40"><path d="M9 16h22l-3 17H12z" fill="#dff4ff" stroke="#4a2140" stroke-width="2.2" stroke-linejoin="round"/><path d="M10 20h20" stroke="#4a2140" stroke-width="1.6"/><circle cx="16" cy="25" r="2.4" fill="#a8507a"/><circle cx="22" cy="27" r="2.4" fill="#a8507a"/><circle cx="20" cy="22" r="2" fill="#7edb72"/><path d="M27 6l-4 13" stroke="#ff9ec4" stroke-width="2.6" stroke-linecap="round"/></svg>' },
];
const tray = $('tray');
tray.innerHTML = '<span class="tray-hint">Kéo món ăn vào thú, hoặc chạm</span>' + FOODS.map(f => `<button class="food" type="button" data-id="${f.id}">${f.svg}${f.name}<small>+${f.no} no</small></button>`).join('');
let drag = null;
tray.addEventListener('pointerdown', e => {
  const b = e.target.closest('.food'); if (!b) return;
  e.preventDefault();
  const f = FOODS.find(x => x.id === b.dataset.id);
  const g = document.createElement('div'); g.className = 'ghost'; g.innerHTML = f.svg; g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px';
  document.body.appendChild(g);
  drag = { f, g, x0: e.clientX, y0: e.clientY, moved: false };
  b.setPointerCapture(e.pointerId);
});
tray.addEventListener('pointermove', e => {
  if (!drag) return;
  drag.g.style.left = e.clientX + 'px'; drag.g.style.top = e.clientY + 'px';
  if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) drag.moved = true;
});
tray.addEventListener('pointerup', e => {
  if (!drag) return;
  const { f, g, moved } = drag; drag = null;
  if (!moved || hitPetLoose(e)) flyAndFeed(f, g); else { g.remove(); }
});
tray.addEventListener('pointercancel', () => { if (drag) { drag.g.remove(); drag = null; } });
function hitPetLoose(e) {
  if (hitPet(e)) return true;
  petRoot.localToWorld(pv.set(0, 1.1, 0)); pv.project(camera);
  const r = canvas.getBoundingClientRect();
  const sx = (pv.x + 1) / 2 * r.width + r.left, sy = (1 - pv.y) / 2 * r.height + r.top;
  return Math.hypot(e.clientX - sx, e.clientY - sy) < Math.min(r.width, r.height) * 0.16;
}
function flyAndFeed(f, g) {
  petRoot.localToWorld(pv.set(0, 0.85, 0.9)); pv.project(camera);
  const r = canvas.getBoundingClientRect();
  g.classList.add('fly');
  requestAnimationFrame(() => { g.style.left = ((pv.x + 1) / 2 * r.width + r.left) + 'px'; g.style.top = ((1 - pv.y) / 2 * r.height + r.top) + 'px'; g.style.transform = 'translate(-50%,-50%) scale(.4)'; g.style.opacity = '0.2'; });
  setTimeout(() => { g.remove(); feed(f); }, reduce ? 0 : 450);
}
function feed(f) {
  hideHint();
  if (S.asleep) { say('Suỵt… mình đang ngủ mà.', 2400); return; }
  if (S.no >= 90) { setTemp('sulky', 1600); shake = 1; say('Mình no căng rồi mà~', 2400); return; }
  S.no = clamp(S.no + f.no); S.vui = clamp(S.vui + f.vui); S.sach = clamp(S.sach - 2);
  popText(`+${f.no} No`, '#f08a24');
  count('fed'); dayRec().foods.push(f.name);
  setTemp('chew', 1500); impulse(-1.5);
  const req = act('feed', f.id);
  setTimeout(async () => {
    const r = await req;
    if (r && r.refused === 'full') { setTemp('sulky', 1400); say('Mình no căng rồi mà~', 2400); }
    else if (r && r.fav) { setTemp('love', 1800); spawn('heart', 4, 1); spawn('sparkle', 2); say(S.favFound ? 'Món tủ của mình nè!!' : 'Ơ… đây là món tủ của mình! Sao bạn biết hay vậy?', 3400); S.favFound = true; }
    else { spawn('sparkle'); say(f.line, 2600); }
    save(); renderStats();
  }, 1500);
}

/* ---------------- nút hành động ---------------- */
function toggleSheet(which) {
  const map = { talk: ['chat', 'a-talk'] };
  Object.entries(map).forEach(([k, [el, btn]]) => { const on = k === which && $(el).hidden; $(el).hidden = !on; $(btn).setAttribute('aria-pressed', String(on)); if (on && k === 'talk') $('chat-input').focus(); });
}
$('a-eat').onclick = () => { hideHint(); toggleSheet(null); if (S.asleep) { say('Suỵt… mình đang ngủ mà.', 2200); return; } goTo('kitchen'); };
$('a-talk').onclick = () => toggleSheet('talk');
$('a-bath').onclick = () => { hideHint(); toggleSheet(null); if (S.asleep) { say('Để sáng mai tắm nha…', 2200); return; } goTo('bath'); };
$('a-play').onclick = () => { hideHint(); toggleSheet(null); if (S.asleep) { say('Zzz… mai chơi tiếp nha…', 2200); return; } goTo('garden'); };
$('a-sleep').onclick = () => { hideHint(); toggleSheet(null); S.asleep ? wake() : goSleep(); };
function goSleep() { count('sleep'); act('sleep'); S.asleep = true; applySleep(); goTo('bedroom'); setTimeout(() => say(`Chúc ${S.name} ngủ ngon… Zzz`, 2600), reduce ? 0 : 700); save(); }
function wake() { act('wake'); S.asleep = false; applySleep(); goTo('home'); setTimeout(() => { say('Chào buổi sáng! Mình ngủ ngon lắm.', 2600); startAction('stretch'); spawn('sparkle', 2); }, reduce ? 0 : 700); save(); }
$('ctx').addEventListener('click', e => {
  const b = e.target.closest('.ctx-btn'); if (!b) return; hideHint();
  ({ home: () => goTo('home'), rinse, ball: throwBall, spin: spinPlay, wake })[b.dataset.k]();
});
function applySleep() { $('dim').classList.toggle('on', S.asleep); $('sleep-label').textContent = S.asleep ? 'Thức dậy' : 'Ngủ'; $('a-sleep').setAttribute('aria-pressed', String(S.asleep)); }

/* ---------------- trò chuyện (bản mẫu, chưa dùng AI) ---------------- */
function reply(t) {
  const s = t.toLowerCase();
  if (S.asleep) return 'Zzz… (thú đang ngủ, mai nói tiếp nha)';
  if (/chào|hello|\bhi\b|alo/.test(s)) return `Chào bạn! ${S.name} nhớ bạn quá trời. Hôm nay bạn thế nào?`;
  if (/đói|ăn|cơm|kem/.test(s)) return S.no < 45 ? 'Đói lắm luôn á… cho mình ăn đi mà~' : 'Mình vừa ăn xong, no căng bụng rồi nè!';
  if (/buồn|mệt|chán|áp lực|stress/.test(s)) { setTemp('love', 2600); spawn('heart', 2); return 'Lại đây mình ôm một cái. Hôm nay bạn vất vả rồi ha.'; }
  if (/yêu|thương|thích bạn|cute|dễ thương/.test(s)) { setTemp('love', 2200); spawn('heart', 3); return 'Mình cũng thương bạn nhất luôn!'; }
  if (/tên/.test(s)) return `Mình là ${S.name} nè! Tên này bạn đặt đó.`;
  if (/ngủ/.test(s)) return 'Tối nay nhớ chúc mình ngủ ngon nha.';
  if (/làm|công việc|sếp|deadline/.test(s)) return 'Làm việc xong nhớ uống nước nha. Mình ngồi đây chờ bạn.';
  if (/nhớ/.test(s) && S.mem.length) { const m = S.mem[Math.floor(Math.random() * Math.min(S.mem.length, 8))]; return `Nhớ chứ! ${m.text}`; }
  setTemp('excited', 900);
  return ['Ừm ừm, kể tiếp đi!', 'Thật hả? Hay quá!', 'Mình nhớ chuyện này rồi nha.', 'Hihi, bạn nói chuyện vui ghê.'][Math.floor(Math.random() * 4)];
}
$('chat').addEventListener('submit', e => {
  e.preventDefault(); const v = $('chat-input').value.trim(); if (!v) return;
  $('chat-input').value = ''; hideHint();
  setTemp('vui', 700);
  setTimeout(() => say(reply(v), 4200), reduce ? 0 : 500);
  S.vui = clamp(S.vui + 2); count('talk'); act('talk');
  if (/(^|\s)(tôi|mình|em|anh|chị|tớ)(\s|$)/i.test(v) && v.length > 10) { remember('talk', `Bạn kể: “${v.slice(0, 70)}”`); addTalkMemory(v); }
});

/* ---------------- duyệt biểu cảm ---------------- */
const chipKeys = [['auto', 'Tự động'], ...['vui', 'excited', 'hungry', 'sleepy', 'sleep', 'sick', 'sulky', 'sad', 'love'].map(k => [k, EXPR[k].label])];
$('chips').innerHTML = chipKeys.map(([k, l]) => `<button class="chip" type="button" data-k="${k}" aria-pressed="${k === 'auto'}">${l}</button>`).join('');
$('chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  override = b.dataset.k === 'auto' ? null : b.dataset.k;
  [...$('chips').children].forEach(c => c.setAttribute('aria-pressed', String(c === b)));
  hideHint();
});

/* ---------------- bảng chỉ số ---------------- */
const STAT = [['no', 'No', '#ffb35c'], ['vui', 'Vui', '#ff6fa8'], ['nl', 'Năng lượng', '#8f7cff'], ['sach', 'Sạch sẽ', '#4fc3f7']];
$('bars').innerHTML = STAT.map(([k, l, c]) => `<div class="stat"><span>${l}</span><div class="track"><div class="fill" id="f-${k}" style="background:${c}"></div></div><span class="lvl" id="l-${k}"></span></div>`).join('');
const lvl = v => v >= 75 ? 'Đầy' : v >= 45 ? 'Ổn' : v >= 25 ? 'Hơi thấp' : 'Thấp';
function renderStats() { STAT.forEach(([k]) => { $('f-' + k).style.width = S[k] + '%'; $('l-' + k).textContent = lvl(S[k]); }); }
$('btn-stats').onclick = () => { const s = $('stats'); s.hidden = !s.hidden; $('btn-stats').setAttribute('aria-expanded', String(!s.hidden)); renderStats(); if (!s.hidden) { $('diary').hidden = true; $('btn-diary').setAttribute('aria-expanded', 'false'); } };
$('pet-name').value = S.name;
$('pet-name').addEventListener('input', e => { const v = e.target.value.trim().slice(0, 16); if (v) renamePet(v); });

/* ---------------- nhật ký & ký ức ---------------- */
const WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dayRec() {
  const k = today();
  if (!S.day || S.day.d !== k) { if (S.day) S.diary[S.day.d] = writeDiary(S.day); S.day = { d: k, fed: 0, foods: [], bath: 0, ball: 0, pet: 0, talk: 0, sleep: 0 }; }
  return S.day;
}
function count(k) { const d = dayRec(); d[k] = (d[k] || 0) + 1; if (!$('diary').hidden) renderDiary(); }
function remember(type, text) { S.mem.unshift({ t: Date.now(), type, text }); if (S.mem.length > 60) S.mem.length = 60; save(); if (!$('diary').hidden) renderDiary(); }
function firstTime(key, type, text) { if (S.firsts[key]) return; S.firsts[key] = 1; remember(type, text); }
const writeDiary = writeDiaryRule;
function dayTitle(k) { const [y, m, dd] = k.split('-').map(Number); return `${WD[new Date(y, m - 1, dd).getDay()]}, ${dd}/${m}`; }
function ago(t) { const x = (Date.now() - t) / 1000; return x < 60 ? 'vừa xong' : x < 3600 ? `${Math.floor(x / 60)} phút trước` : x < 86400 ? `${Math.floor(x / 3600)} giờ trước` : `${Math.floor(x / 86400)} ngày trước`; }
const MEM_COL = { meet: '#ff6fa8', food: '#ffb35c', bath: '#4fc3f7', play: '#7edb72', talk: '#8f7cff' };
let dTab = 'pages';
function renderDiary() {
  const el = $('dpanel');
  if (dTab === 'pages') {
    const d = dayRec(), past = Object.keys(S.diary).sort().reverse();
    el.innerHTML = `<article class="page"><h3>${dayTitle(d.d)}</h3><span class="writing">${esc(S.name)} đang viết trang hôm nay…</span><p>${esc(writeDiary(d))}</p></article>` +
      past.map(k => `<article class="page"><h3>${dayTitle(k)}</h3><p>${esc(S.diary[k])}</p></article>`).join('');
  } else {
    el.innerHTML = S.mem.length
      ? `<p class="empty">Những điều ${esc(S.name)} nhớ. Bạn xoá được từng dòng.</p>` + S.mem.map((m, i) => `<div class="mem"><i style="background:${MEM_COL[m.type] || '#ccc'}"></i><span>${esc(m.text)}<small>${ago(m.t)}</small></span><button type="button" data-i="${i}" aria-label="Xoá ký ức này">Xoá</button></div>`).join('')
      : '<p class="empty">Chưa có ký ức nào.</p>';
  }
}
$('dpanel').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; const m = S.mem[Number(b.dataset.i)]; if (m) delMem(m).then(renderDiary); renderDiary(); });
function setTab(t) { dTab = t; $('tab-pages').setAttribute('aria-selected', String(t === 'pages')); $('tab-mem').setAttribute('aria-selected', String(t === 'mem')); renderDiary(); }
$('tab-pages').onclick = () => setTab('pages'); $('tab-mem').onclick = () => setTab('mem');
$('btn-diary').onclick = () => { const s = $('diary'); s.hidden = !s.hidden; $('btn-diary').setAttribute('aria-expanded', String(!s.hidden)); if (!s.hidden) { $('stats').hidden = true; $('btn-stats').setAttribute('aria-expanded', 'false'); renderDiary(); } };

/* ---------------- hành vi rảnh rỗi & hoạt cảnh ---------------- */
let idleAt = performance.now() + 6000, wander = null, action = null, walking = false, walkPh = 0, chompAt = 0, puffAt = 0, earTwAt = performance.now() + 3000;
const earKick = [0, 0], lastOff = new THREE.Vector3(), mouthW = new THREE.Vector3();
const ACT_DUR = { yawn: 1.8, look: 2.4, dance: 2.0, hop: 1.0, stretch: 1.6, shake: 1.3, wave: 1.6 };
function busy(now) { return S.asleep || area !== 'home' || anim || fetchBall || override || (temp && now < temp.until) || (down && down.hit) || drag; }
function startAction(type) { action = { type, t: 0, fxAt: 0 }; }
function idleThink(now) {
  if (now < idleAt) return;
  idleAt = now + 4500 + Math.random() * 6000;
  if (busy(now) || wander || action) return;
  const r = Math.random();
  if (r < 0.42) { const a = Math.random() * Math.PI * 2, d = 0.5 + Math.random() * 0.9; wander = { x: Math.cos(a) * d, z: Math.sin(a) * d * 0.6 }; }
  else if (r < 0.58 && S.nl < 65) startAction('yawn');
  else if (r < 0.74) startAction('look');
  else if (r < 0.88 && S.vui > 55) startAction('dance');
  else startAction('hop');
}
function spawnAt(type, x, y, z, o = {}) {
  const sp = getSprite(FXT[type]);
  sp.position.set(x, y, z); const sc = o.scale || 0.3; sp.scale.set(sc, sc, sc);
  particles.push({ s: sp, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g || 0, life: 0, max: o.max || 0.8, base: sc, type });
}
function animStep(dt, t, now, key) {
  const o = { hop: 0, roll: 0, yaw: 0, stretch: 0, arm: 0, wave: 0 };
  if (!reduce) idleThink(now);
  if (wander) {
    if (busy(now)) wander = null;
    else {
      const dx = wander.x - petOff.x, dz = wander.z - petOff.z, d = Math.hypot(dx, dz), step = 1.2 * dt;
      if (d > 0.04) { petOff.x += dx / d * Math.min(step, d); petOff.z += dz / d * Math.min(step, d); moveYaw = Math.atan2(dx, dz); }
      else { wander = null; moveYaw = null; }
    }
  }
  const sp = Math.hypot(petOff.x - lastOff.x, petOff.z - lastOff.z) / Math.max(dt, 1e-3); lastOff.copy(petOff);
  walking = sp > 0.25;
  if (walking) {
    walkPh += dt * (sp > 2 ? 18 : 12); o.hop += Math.abs(Math.sin(walkPh)) * 0.08; o.roll += Math.sin(walkPh) * 0.05;
    if (area === 'garden' && now > puffAt) { puffAt = now + 180; spawnAt('puff', petRoot.position.x, 0.15, petRoot.position.z + 0.3, { vy: 0.3, vx: (Math.random() - 0.5) * 0.4, scale: 0.35, max: 0.6 }); }
  }
  feet.forEach((f, i) => { const ph = walkPh + i * Math.PI; f.position.y = 0.1 + (walking ? Math.max(0, Math.sin(ph)) * 0.14 : 0); f.position.z = 0.38 + (walking ? Math.cos(ph) * 0.1 : 0); });
  if (action) {
    const a = action; a.t += dt; const p = a.t, u = Math.min(p / ACT_DUR[a.type], 1), bell = Math.sin(u * Math.PI);
    if (a.type === 'yawn') { if (u < 0.85) setTemp('yawn', 150); o.stretch = bell * 0.12; o.arm = bell * 0.7; if (!a.fxAt) { a.fxAt = 1; if (Math.random() < 0.5) say('Oáp…', 1300); } }
    if (a.type === 'look') o.yaw = Math.sin(u * Math.PI * 2) * 0.75;
    if (a.type === 'dance') { setTemp('excited', 150); o.roll += Math.sin(p * 11) * 0.16; o.hop += Math.abs(Math.sin(p * 11)) * 0.1; o.arm = Math.abs(Math.sin(p * 11)) * 0.8; if (now > a.fxAt) { a.fxAt = now + 450; spawn('note'); } }
    if (a.type === 'hop') { if (u < 0.2) o.stretch = -0.14 * Math.sin(u / 0.2 * Math.PI / 2); else o.hop += Math.sin((u - 0.2) / 0.8 * Math.PI) * 0.6; if (u >= 1) { impulse(-2.8); addTrauma(0.08); } }
    if (a.type === 'stretch') { setTemp('yawn', 150); o.stretch = bell * 0.16; o.arm = bell * 1.1; }
    if (a.type === 'shake') {
      o.roll += Math.sin(p * 42) * 0.22 * (1 - u);
      if (now > a.fxAt) { a.fxAt = now + 70; const sg = Math.random() < 0.5 ? -1 : 1;
        spawnAt('drop', petRoot.position.x + sg * 1.0, petRoot.position.y + 1.0 + Math.random() * 1.2, petRoot.position.z + 0.3, { vx: sg * (1.5 + Math.random()), vy: 1 + Math.random(), g: 6, scale: 0.18, max: 0.7 }); }
    }
    if (a.type === 'wave') o.wave = 0.35 + Math.sin(p * 14) * 0.1;
    if (u >= 1) action = null;
  }
  if (now > earTwAt) { earTwAt = now + 2500 + Math.random() * 4500; earKick[Math.random() < 0.5 ? 0 : 1] = 1; }
  ears.forEach((e, i) => {
    const s = e.userData.s; earKick[i] *= Math.exp(-dt * 7);
    let target = -s * 0.38 + s * Math.sin(earKick[i] * 9) * earKick[i] * 0.35 + s * sqv * 0.025;
    if (key === 'sleep' || key === 'sad' || key === 'sick') target = -s * 0.75;
    if (key === 'excited' || key === 'love') target = -s * 0.22 + s * Math.sin(t * 14) * 0.08;
    e.rotation.z += (target - e.rotation.z) * Math.min(1, dt * 12);
  });
  tail.position.x = (S.vui > 55 && key !== 'sleep' ? Math.sin(t * 10) : Math.sin(t * 2) * 0.3) * 0.09;
  if (key === 'chew' && now > chompAt) {
    chompAt = now + 280; impulse(-1.1); petRoot.localToWorld(mouthW.set(0, 0.75, 1.0));
    spawnAt('crumb', mouthW.x + (Math.random() - 0.5) * 0.3, mouthW.y, mouthW.z, { vx: (Math.random() - 0.5) * 1.2, vy: 1.2, g: 7, scale: 0.12, max: 0.6 });
  }
  return o;
}

/* ---------------- camera rig: thị sai, zoom, rung nhẹ (skill game-feel) ---------------- */
const camBase = new THREE.Vector3(), lookBase = new THREE.Vector3(), camPar = new THREE.Vector2(), focusW = new THREE.Vector3(), lookNow = new THREE.Vector3();
let camZoom = 0, trauma = 0, camIntro = 0;
function addTrauma(v) { if (!reduce) trauma = Math.min(1, trauma + v); }
function updateCamera(dt, t) {
  const zoomTarget = (!$('chat').hidden ? 0.24 : 0) + (down && down.hit ? 0.07 : 0);
  camZoom += (zoomTarget - camZoom) * Math.min(1, dt * 3);
  camIntro = Math.max(0, camIntro - dt * 1.5);
  if (!reduce) { const k = Math.min(1, dt * 2.5); camPar.x += (pointerNdc.x * 0.28 - camPar.x) * k; camPar.y += (pointerNdc.y * 0.14 - camPar.y) * k; }
  petRoot.localToWorld(focusW.set(0, 1.3, 0));
  camera.position.copy(camBase).lerp(focusW, camZoom - camIntro * camIntro * 0.22);
  camera.position.x += camPar.x; camera.position.y += camPar.y;
  trauma = Math.max(0, trauma - dt * 1.8);
  const sh = trauma * trauma; // bình phương: va nhẹ gần như không rung, va mạnh mới rõ
  camera.position.x += Math.sin(t * 37) * 0.07 * sh; camera.position.y += Math.sin(t * 43 + 1) * 0.05 * sh;
  lookNow.copy(lookBase).lerp(focusW, camZoom * 0.5);
  camera.lookAt(lookNow);
}

/* ---------------- phản hồi: số bay lên, rung tay, thông báo ---------------- */
const popsEl = $('pops');
function popText(text, color = '#ff5c9a') {
  petRoot.localToWorld(pv.set(0, 2.25, 0)); pv.project(camera);
  const r = canvas.getBoundingClientRect(), el = document.createElement('span');
  el.className = 'pop-text'; el.textContent = text; el.style.color = color;
  el.style.left = `${(pv.x + 1) / 2 * r.width + (Math.random() - 0.5) * 50}px`; el.style.top = `${(1 - pv.y) / 2 * r.height}px`;
  popsEl.appendChild(el); setTimeout(() => el.remove(), 1250);
}
const coarse = matchMedia('(pointer: coarse)').matches;
function buzz(ms = 8) { if (coarse && navigator.vibrate) navigator.vibrate(ms); }
const toastEl = $('toast'); let toastTimer = 0, toastAt = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200); }
addEventListener('offline', () => toast('Mất kết nối mạng. Bé vẫn ở đây, mình sẽ lưu lại khi có mạng.'));
addEventListener('online', () => toast('Đã có mạng trở lại.'));
onSyncError(() => { const n = performance.now(); if (n - toastAt > 15000) { toastAt = n; toast('Chưa lưu được lên máy chủ. Bạn kiểm tra mạng nhé.'); } });
document.querySelector('.bar').addEventListener('click', e => { if (e.target.closest('.act')) buzz(8); });

/* Chấm gợi ý nhu cầu trên nút (không đếm số, không màu đỏ) */
function updateNeeds() {
  const need = { 'a-eat': S.no < 40, 'a-bath': S.sach < 40, 'a-play': S.vui < 40 && S.nl >= 20, 'a-sleep': S.nl < 25 && !S.asleep };
  Object.entries(need).forEach(([id, on]) => $(id).classList.toggle('need', on && !S.asleep || (id === 'a-sleep' && on)));
}

/* Phím tắt: 1–5 hành động, Enter trò chuyện, Esc đóng lớp trên cùng */
[['a-eat', 'Ăn (phím 1)'], ['a-bath', 'Tắm (phím 2)'], ['a-play', 'Chơi (phím 3)'], ['a-talk', 'Nói (phím 4 hoặc Enter)'], ['a-sleep', 'Ngủ / Thức dậy (phím 5)']].forEach(([id, t]) => { $(id).title = t; });
addEventListener('keydown', e => {
  const typing = e.target instanceof Element && e.target.closest('input, textarea');
  if (e.key === 'Escape') {
    if (!$('chat').hidden) { toggleSheet(null); $('a-talk').focus(); }
    else if (!$('diary').hidden) { $('btn-diary').click(); $('btn-diary').focus(); }
    else if (!$('stats').hidden) { $('btn-stats').click(); $('btn-stats').focus(); }
    else if (area !== 'home' && area !== 'bedroom') goTo('home');
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const keyMap = { 1: 'a-eat', 2: 'a-bath', 3: 'a-play', 4: 'a-talk', 5: 'a-sleep' };
  if (keyMap[e.key]) { e.preventDefault(); $(keyMap[e.key]).click(); }
  else if (e.key === 'Enter' && $('chat').hidden) { e.preventDefault(); toggleSheet('talk'); }
});

/* Bóng đổ thật: vật nhỏ đổ bóng, mọi bề mặt nhận bóng (skill threejs-materials-lighting) */
function setupShadows() {
  sun.target.position.set(0, 0, 0); scene.add(sun.target);
  const c = sun.shadow.camera; c.left = -6; c.right = 6; c.top = 6; c.bottom = -6; c.near = 1; c.far = 24;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.traverse(o => {
    if (!o.isMesh || o.userData.outline || o === face || o === shadow || o.material.blending === THREE.AdditiveBlending) return;
    o.geometry.computeBoundingSphere();
    o.castShadow = o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) < 2;
    o.receiveShadow = true;
  });
}
let blobBase = 1;
function applyQuality() {
  const q = QUALITY[quality];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr));
  const on = q.shadow > 0;
  if (renderer.shadowMap.enabled !== on || (on && sun.shadow.mapSize.x !== q.shadow)) {
    renderer.shadowMap.enabled = on; sun.castShadow = on;
    if (on) { sun.shadow.mapSize.set(q.shadow, q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }
  blobBase = on ? 0.55 : 1;
  document.querySelectorAll('.qbtn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.q === quality)));
  resize();
}
document.querySelector('.quality')?.addEventListener('click', e => {
  const b = e.target.closest('.qbtn'); if (!b) return;
  quality = b.dataset.q; try { localStorage.setItem('hatchday-quality', quality); } catch (err) { /* bỏ qua */ }
  applyQuality();
});

/* ---------------- camera ---------------- */
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  const portrait = h > w * 1.05;
  const cp = CAM[area][portrait ? 1 : 0];
  camera.fov = cp[0]; camera.position.set(cp[1], cp[2], cp[3]); look.set(cp[4], cp[5], cp[6]);
  camera.lookAt(look); camera.updateProjectionMatrix();
  camBase.copy(camera.position); lookBase.copy(look);
}
new ResizeObserver(resize).observe(canvas); resize();

/* ---------------- vòng lặp ---------------- */
setupShadows(); applyQuality();
applyPeriod(); applySleep(); renderStats(); updateNeeds();
if (S.asleep) goTo('bedroom', true);
dayRec();
onSync(() => { renderStats(); applySleep(); if (!$('diary').hidden) renderDiary(); });
startPeriodicSync();
if (new URLSearchParams(location.search).has('dev')) { document.querySelector('.review').hidden = false; const f = $('fast'); if (f) f.closest('label').hidden = false; }
const DEV = new URLSearchParams(location.search).has('dev'), devhud = $('devhud');
if (DEV) devhud.hidden = false;
let blinkAt = performance.now() + 2500, blinkUntil = 0, fxAt = 0, saveAt = 0, clockAt = 0, lastKey = '', fpsN = 0, fpsAt = 0;
function tick(now, dt) {
  const t = now / 1000;
  /* chỉ số theo thời gian */
  decay(S, (dt / 60) * ($('fast')?.checked ? 60 : 1));
  if (now > saveAt) { saveAt = now + 5000; save(); if (!$('stats').hidden) renderStats(); }
  if (now > clockAt) { clockAt = now + 1000; const d = new Date(); $('clock').textContent = d.toTimeString().slice(0, 5); applyPeriod(); updateNeeds(); }
  const key = current(now), e = EXPR[key];
  if (key !== lastKey) { if (lastKey) impulse(-1.3); lastKey = key; }
  $('lcdmsg').textContent = `${S.name} ${e.msg}`;
  /* chớp mắt */
  if (now > blinkAt) { blinkUntil = now + 130; blinkAt = now + 2200 + Math.random() * 3000; }
  const gx = moveYaw !== null ? 0 : Math.round(clamp(pointerNdc.x * 1.6 - yaw * 0.8, -1, 1) * 3) * 4, gy = Math.round(clamp(-pointerNdc.y * 1.6, -1, 1) * 2) * 4;
  drawFace(key, now < blinkUntil, Math.floor(t * 6) % 2, gx, gy);
  /* ký hiệu cảm xúc định kỳ */
  if (e.fx && now > fxAt) { fxAt = now + (e.fx === 'anger' ? 900 : 1100); spawn(e.fx, 1, e.fx === 'anger' ? 0.6 : 0.8); }
  /* lò xo squash & stretch */
  sqv += (-130 * sq - 9 * sqv) * dt; sq += sqv * dt;
  const sleeping = key === 'sleep';
  const breath = reduce ? 0 : Math.sin(t * (sleeping ? 1.3 : 2.4)) * (sleeping ? 0.03 : 0.018);
  const droop = key === 'sad' || key === 'sick' ? -0.04 : 0;
  pivot.scale.set(1 - sq * 0.55 - breath * 0.4, 1 + sq + breath + droop, 1 - sq * 0.55 - breath * 0.4);
  /* nhún nhảy, xoay */
  let hop = 0, spinY = 0, roll = 0;
  if (!reduce && key === 'excited') hop = Math.abs(Math.sin(t * 7)) * 0.28;
  if (anim) {
    anim.t += dt; const p = Math.min(anim.t / anim.dur, 1);
    if (anim.type === 'spin') { spinY = p * Math.PI * 2; hop = Math.sin(p * Math.PI) * 0.9; }
    if (anim.type === 'wiggle') roll = Math.sin(p * Math.PI * 6) * 0.18 * (1 - p);
    if (p >= 1) anim = null;
  }
  const ex = animStep(dt, t, now, key); hop += ex.hop; roll += ex.roll; spinY += ex.yaw;
  pivot.scale.y *= 1 + ex.stretch; pivot.scale.x *= 1 - ex.stretch * 0.4; pivot.scale.z *= 1 - ex.stretch * 0.4;
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); roll += Math.sin(t * 30) * 0.12 * shake; }
  if (!reduce && key === 'sleepy') roll += Math.sin(t * 1.4) * 0.06;
  if (!reduce && key === 'sick') roll += Math.sin(t * 22) * 0.012;
  petRoot.position.set(petBase.x + petOff.x, petBase.y + hop, petBase.z + petOff.z);
  shadow.position.set(petRoot.position.x, 0.075, petRoot.position.z + 0.05); shadow.visible = area !== 'bath' && area !== 'bedroom';
  updateArea(dt, t);
  /* nhìn theo con trỏ, quay đi khi dỗi */
  const wantYaw = moveYaw !== null ? moveYaw : key === 'sulky' ? 0.75 : sleeping ? 0 : pointerNdc.x * 0.45;
  yaw += (wantYaw - yaw) * Math.min(1, dt * 4);
  petRoot.rotation.y = yaw + spinY;
  petRoot.rotation.z = roll;
  pivot.rotation.x = sleeping ? 0.1 : (-0.08 - pointerNdc.y * 0.1);
  arms.forEach((a, i) => { const sg = i ? 1 : -1; a.position.y = 0.78 + (key === 'excited' || key === 'love' ? Math.abs(Math.sin(t * 8 + i)) * 0.18 : 0) + ex.arm * 0.5 + (i === 1 ? ex.wave : 0) + (walking ? Math.sin(walkPh + i * Math.PI) * 0.06 : 0); a.position.x = sg * (0.98 + ex.arm * 0.08 + (i === 1 ? ex.wave * 0.2 : 0)); });
  sprout.rotation.z = reduce ? 0 : Math.sin(t * 2.1) * 0.12 + roll;
  shadow.scale.setScalar(1 - hop * 0.35); shadow.material.opacity = (1 - hop * 0.5) * blobBase;
  bulbs.forEach((b, i) => b.material.color.setHSL(((i * 0.11 + t * (reduce ? 0 : 0.05)) % 1), 0.85, 0.75));
  /* hạt */
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life += dt;
    p.vy -= (p.g || 0) * dt; p.s.position.x += p.vx * dt; p.s.position.z += (p.vz || 0) * dt; p.s.position.y += p.vy * dt * (p.type === 'bubble' ? 0.8 : 1);
    const k = p.life / p.max; p.s.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    const pop = Math.min(1, p.life * 6); p.s.scale.setScalar(p.base * (0.6 + 0.4 * pop));
    if (p.life >= p.max) { releaseSprite(p.s); particles.splice(i, 1); }
  }
  /* bong bóng thoại */
  if (beams.visible && room.visible && !reduce) {
    const a = dustGeo.attributes.position;
    for (let i = 0; i < DUST; i++) { const sd = dustSeed[i]; a.array[i * 3 + 1] = 0.4 + ((sd * 0.37 + t * 0.06) % 2.6); a.array[i * 3] += Math.sin(t * 0.6 + sd) * 0.0015; }
    a.needsUpdate = true; beamMat.opacity = 0.38 + Math.sin(t * 0.7) * 0.07;
  }
  updateCamera(dt, t);
  if (!bubbleEl.hidden) { if (now > bubbleUntil) bubbleEl.hidden = true; else placeBubble(); }
  renderer.render(scene, camera);
  if (DEV) { fpsN++; if (now > fpsAt) { const i = renderer.info.render; devhud.textContent = `${fpsN * 2} FPS · ${i.calls} draw · ${(i.triangles / 1000).toFixed(1)}k tam giác · pr ${renderer.getPixelRatio()}`; fpsN = 0; fpsAt = now + 500; } }
}
/* Vòng lặp theo skill threejs-scene-setup: setAnimationLoop + Timer, dt kẹp trong [0, 0.1] */
const timer = new THREE.Timer(); timer.connect(document);
renderer.setAnimationLoop(() => { timer.update(); tick(performance.now(), Math.min(Math.max(timer.getDelta(), 0), 0.1)); });
setTimeout(() => { say(`Chào bạn! Mình là ${S.name}.`, 3200); if (!S.asleep) startAction('wave'); }, 700);
setTimeout(hideHint, 9000);
addEventListener('pagehide', save);
