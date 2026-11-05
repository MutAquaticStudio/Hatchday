// Lớp hiển thị & tương tác 3D (chuyển từ bản mẫu). Sẽ tách nhỏ và chuyển sang TypeScript dần.
import * as THREE from 'three';
import { S, save, act, actBatched, addTalkMemory, renamePet, onSync, onSyncError, onTraitShift, startPeriodicSync,
  buy, saveLayout, equip, savePreset, claimQuest, claimQuestBonus, claimWeeklyQuest, claimCollection, buyFood, claimRation, nutritionNow, refreshFamily, familyMemories, refreshGarden, plantCrop, waterCrop, harvestCrop, upgradeParcel, buyParcel, saveFarm, cook, upgradeFridge, serverNow, onSpoil, refreshQuests, activeLayout, previewComfort, onIllness, healthNow, buyMedicine, useMedicine, visitClinic, refreshHealth, onBondLevel, claimBond } from './store';
import { BOND, bondProgress, unclaimedLevels } from './bond';
import { HEALTH, ILLNESS_BY_ID, isSevere, minutesToSick, STAT_NOUN } from './health';
import { blockedNow, minutesVi } from './clinic.js';
import { initHome } from './home.js';
import { viError } from '../lib/errors';
import { decayStats, localDay } from './rules';
import { makePetBuilder, disposePet } from './pet3d.js';
import { makeFace } from './face.js';
import { dayRec, count, renderDiary, initDiary } from './diary.js';
import { $, clamp } from './dom.js';
import { initFood } from './food.js';
import { initChat } from './chat.js';
import { initGrowth } from './growth.js';
import { initTour } from './tour.js';
import { initCompanion } from './companion.js';
import { initFarewell } from './farewell.js';
import { groundTextures, initGarden3d } from './garden3d.js';
import { makeDecor } from './decor3d.js';
import { FOOD_BY_ID } from './catalog';
import { tastesLine } from './nutrition';
import { sfx, music, initAudio } from './audio.js';
import { STAGES } from './species';
import { AXES, TRAITS, describe as describePersona, greeting, idleGapFactor, idleWeights, petLine, pickWeighted, walkSpeedFactor } from './personality';
let home = null, editing = false;
const camOverride = { pos: null, look: null };

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- trạng thái: dữ liệu nằm ở store (đồng bộ server) ---------------- */
function decay(s, mins) {
  const d = decayStats({ ...s, severe: !!s.illness && isSevere(healthNow(), Date.now()) }, mins, S.comfort || 1);
  s.no = d.no; s.vui = d.vui; s.nl = d.nl; s.sach = d.sach; s.t = Date.now();
}

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
const rimColor = { value: new THREE.Color('#fff4e8') }, rimStrength = { value: 0.5 }, evoGlow = { value: 0 };
function petToon(color) {
  const m = toon(color);
  m.onBeforeCompile = sh => {
    sh.uniforms.rimColor = rimColor; sh.uniforms.rimStrength = rimStrength; sh.uniforms.evoGlow = evoGlow;
    sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimStrength;\nuniform float evoGlow;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      '#include <opaque_fragment>\n  float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);\n  gl_FragColor.rgb += rimColor * smoothstep(0.6, 0.7, rimF) * rimStrength;\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.98, 0.94), evoGlow);');
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
const homeFloor = add(room, new THREE.BoxGeometry(9, 0.4, 7), toon('#f6c99c', woodTex), 0, -0.2, 0, '#9a5f4a', 0.04);
const wallTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd8e7';
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.beginPath(); g.arc(32 + x * 64 + (y % 2) * 32, 32 + y * 64, 7, 0, Math.PI * 2); g.fill(); }
}, [6, 3]);
const homeWall = add(room, new THREE.BoxGeometry(9, 5, 0.3), toon('#fff0f5', wallTex), 0, 2.3, -3.65, '#b77b95', 0.04);
const wallTex2 = wallTex.clone(); wallTex2.repeat.set(4, 3); wallTex2.needsUpdate = true;
const homeWall2 = add(room, new THREE.BoxGeometry(0.3, 5, 7.3), toon('#fff0f5', wallTex2), -4.65, 2.3, 0, '#b77b95', 0.04);
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

/* Thảm, ổ rơm, chậu cây… giờ là đồ trang trí theo bố cục (home.js) */

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
  garden:  [[34, 0, 5.6, 10.0, 0, 0.35, -0.9], [48, 0, 6.6, 11.8, 0, 0.1, -0.9]], // nhìn từ cao hơn để thấy cả luống rau phía sau thú
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
const groundTex = groundTextures(canvasTex); // texture nền vườn (garden3d.js)
add(garden, new THREE.CylinderGeometry(15, 14.5, 0.6, 72), toon('#ffffff', groundTex.grass), 0, -0.3, 0, '#4f9a4a', 0.04);
add(garden, new THREE.CylinderGeometry(2.4, 2.4, 0.04, 40), toon('#ffffff', groundTex.lawn), 0, 0.02, 0.6, null);
for (let i = -7; i <= 7; i++) add(garden, new THREE.BoxGeometry(0.2, 1.1, 0.2), toon('#fff3e0'), i * 0.85, 0.55, -4.3, '#a8778e', 0.02);
[0.75, 0.35].forEach(y => add(garden, new THREE.BoxGeometry(12.5, 0.12, 0.12), toon('#fff3e0'), 0, y, -4.25, '#a8778e', 0.02));
add(garden, new THREE.CylinderGeometry(0.28, 0.38, 2.2, 14), toon('#a8744e'), -4.6, 1.1, -2.6, '#6a4630');
[[-4.6, 2.9, -2.6, 1.3], [-5.3, 2.4, -2.2, 0.9], [-3.9, 2.5, -2.3, 0.95]].forEach(([x, y, z, r]) => add(garden, new THREE.SphereGeometry(r, 22, 16), toon('#5fc46c'), x, y, z, '#2f7a3d'));
[[4.3, 0.5, -3.0, 0.8], [5.2, 0.45, -2.3, 0.6], [3.6, 0.4, -2.2, 0.5]].forEach(([x, y, z, r]) => add(garden, new THREE.SphereGeometry(r, 18, 14), toon('#6fd08c'), x, y, z, '#2f7a3d'));
{ const R2 = rnd(5); const cols = ['#ff9ec4', '#ffd36e', '#ffffff', '#c9b8ff'];
  for (let i = 0; i < 26; i++) { const x = (R2() * 2 - 1) * 6, z = -3.6 + R2() * 6.5; if (Math.hypot(x, z - 0.6) < 2.6 || (Math.abs(x) < 3.2 && z < -0.2 && z > -4.2)) continue; // chừa chỗ cho luống rau
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
    area = name; petBase.set(...PET_POS[name]); petOff.set(0, 0, 0); moveYaw = null; fetchBall = null; wander = null; action = null; cancelCtrl();
    if (name === 'garden') ball.position.set(2.0, 0.3, 1.4);
    particles.forEach(p => releaseSprite(p.s)); particles.length = 0; camIntro = reduce ? 0 : 1;
    bubbleEl.hidden = true; anim = null;
    resize(); applyAreaLights(); onEnter(name);
    document.getElementById('scene-tag').textContent = AREA_NAME[name];
    updateMusic();
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
  garden: [['ball', 'Ném bóng'], ['spin', 'Xoay vòng'], ['farm', 'Trang trí'], ['home', 'Về phòng']],
  bedroom: [['wake', 'Thức dậy']],
};
function onEnter(name) {
  document.getElementById('tray').hidden = name !== 'kitchen';
  [['a-eat', 'kitchen'], ['a-bath', 'bath'], ['a-play', 'garden']].forEach(([id, a]) => document.getElementById(id).setAttribute('aria-pressed', String(name === a)));
  const ctx = document.getElementById('ctx');
  ctx.innerHTML = CTX[name].map(([k, l]) => `<button class="ctx-btn${k === 'home' || k === 'wake' ? ' ghosty' : ''}" type="button" data-k="${k}">${l}</button>`).join('');
  ctx.hidden = !CTX[name].length;
  const line = { kitchen: 'Tới giờ ăn rồi! Hôm nay ăn gì đây?', bath: 'Nước ấm quá~ Vuốt lên người mình để kỳ cọ nha!', garden: 'Ra vườn thôi! Chạm vào đất để mình đi tới đó, chạm luống đất để trồng rau, hoặc ném bóng cho mình nhé!' }[name];
  if (name === 'garden') refreshGarden().then(() => gardenFx.sync()).catch(() => {});
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
  sfx('bath'); actBatched('bath_scrub'); S.sach = clamp(S.sach + 3); spawn('bubble', 2, 0.9); setTemp('love', 1200); impulse(-0.9); scrubN++;
  if (scrubN % 8 === 0) say(['Chỗ đó đó, ngứa quá!', 'Bọt nhiều ghê!', 'Sạch bong rồi nè!'][Math.floor(Math.random() * 3)], 1800);
}
function rinse() {
  sfx('bath'); count('bath'); act('bath_rinse'); popText('Sạch bong!', '#2fa8e0');
  S.sach = 100; S.vui = clamp(S.vui + 4); spawn('sparkle', 4, 1); spawn('bubble', 10, 1.3);
  startAction('shake'); setTemp('love', 2000); say('Thơm phức rồi nè!', 2200); save(); renderStats();
  setTimeout(() => { if (area === 'bath') goTo('home'); }, 2600);
}
/** Bé đang ốm nên chưa làm được việc này? Nếu vậy nói một câu và trả về true. */
function sickBlocks(what) {
  if (!blockedNow(S).includes(what)) return false;
  const il = ILLNESS_BY_ID[S.illness];
  setTemp('sick', 1800); say(what === 'play' ? `Mình đang ${il.name.toLowerCase()}, chưa chơi được đâu… Cho mình uống thuốc hoặc nghỉ ngơi nha.` : `Mình đang ${il.name.toLowerCase()}, tắm nước bây giờ lạnh lắm…`, 3200);
  return true;
}
function throwBall() {
  if (fetchBall) return;
  if (sickBlocks('play')) return;
  cancelCtrl();
  if (S.nl < 15) { setTemp('sleepy', 1800); say('Mình mệt quá, cho mình nghỉ chút đã…', 2600); return; }
  const tx = (Math.random() * 2 - 1) * 3.2, tz = -1.6 + Math.random() * 2.4;
  fetchBall = { phase: 'fly', t: 0, from: new THREE.Vector3(0.6, 2.8, 5.5), to: new THREE.Vector3(tx, 0.3, tz) };
  setTemp('excited', 900); sfx('play');
}
function spinPlay() {
  if (sickBlocks('play')) return;
  if (S.nl < 15) { setTemp('sleepy', 1800); say('Mình mệt quá, cho mình nghỉ chút đã…', 2600); return; }
  sfx('play'); act('play_spin'); popText('+6 Vui'); S.vui = clamp(S.vui + 6); S.nl = clamp(S.nl - 4); S.no = clamp(S.no - 2);
  anim = { type: 'spin', t: 0, dur: 1.1 }; setTemp('excited', 1600); spawn('note', 2); spawn('sparkle', 2);
  setTimeout(() => say(['Yeah! Thêm vòng nữa!', 'Vui quá đi!', 'Chóng mặt mà vui ghê!'][Math.floor(Math.random() * 3)], 2200), 1100);
  save(); renderStats();
}
const tmpV = new THREE.Vector3();
function updateArea(dt, t) {
  if (area === 'bath') { duck.position.y = 1.05 + Math.sin(t * 2.2) * 0.04; duck.rotation.z = Math.sin(t * 1.7) * 0.12; }
  moveMark.visible = !!ctrl && area === 'garden';
  if (moveMark.visible) { const k = 1 + Math.sin(t * 7) * 0.12; moveMark.scale.set(k, k, k); }
  if (area !== 'garden' || !fetchBall) { if (!wander && !ctrl && !keyMoving) moveYaw = null; return; }
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
    if (f.phase === 'back') { petRoot.localToWorld(ball.position.set(0, (petParts.headY + 0.5) * grow.scale.y, 0.2)); }
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
/* Thú dựng theo loài + giai đoạn + dáng (pet3d.js). `grow` co giãn theo tuổi, `pivot` để nhún nhảy, `petLook` chứa thân thú (dựng lại khi lớn). */
/* khuôn mặt: xem face.js */
const { face, EXPR, drawFace } = makeFace({ THREE, renderer });
const petBuilder = makePetBuilder({ THREE, add, toon, petToon, grad });
const petRoot = new THREE.Group(); petRoot.position.set(0, 0, 0.35); scene.add(petRoot);
const grow = new THREE.Group(); petRoot.add(grow);
const pivot = new THREE.Group(); grow.add(pivot);
const petLook = new THREE.Group(); pivot.add(petLook);
let body, ears, sprout, tail, arms, feet, petParts = null, lookKey = '', lookBooted = false;
const currentLook = () => ({ species: S.species, stage: S.stage, form: S.form, genes: S.genes });
function buildLook() {
  const L = currentLook(), k = JSON.stringify(L); if (k === lookKey) return false; lookKey = k;
  face.removeFromParent();           // tách mặt trước khi giải phóng thân cũ (mặt dùng chung, không được dispose)
  disposePet(petLook);
  petParts = petBuilder.build(petLook, L);
  ({ body, ears, top: sprout, tail, arms, feet } = petParts);
  body.add(face);
  grow.scale.setScalar((STAGES[L.stage]?.scale || 1) * (L.genes?.scale || 1));
  if (lookBooted) applyShadows(petLook);
  home?.refreshOutfit();
  return true;
}
buildLook();

/* bóng tròn dưới chân */
const shadowTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(90,40,90,.38)'); r.addColorStop(1, 'rgba(90,40,90,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.075, 0.4); scene.add(shadow);

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
  const p = periodNow(); if (p === period) return; period = p; updateMusic();
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
  if (S.illness || S.sach < 20) return 'sick';
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
  petRoot.localToWorld(pv.set(0, (petParts.headY + 0.62) * grow.scale.y, 0)); pv.project(camera);
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
  if (gardenFx.editing()) { gardenFx.editPointer('down', e); return; } // đang trang trí nông trại
  if (editing) return;
  const hit = hitPet(e);
  down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, hit, moved: 0, acc: 0, ground: area === 'garden' && !hit && !fetchBall, steer: false };
  if (hit) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
});
canvas.addEventListener('pointermove', e => {
  pointerNdc.copy(ndcFrom(e));
  if (gardenFx.editing()) { gardenFx.editPointer('move', e); return; }
  if (down && down.ground && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) { down.steer = true; steerTo(groundPoint(e)); } // giữ và kéo để dắt thú
  if (!down || !down.hit) return;
  const d = Math.hypot(e.clientX - down.lx, e.clientY - down.ly); down.lx = e.clientX; down.ly = e.clientY;
  down.moved += d; down.acc += d;
  if (down.acc > 42) { down.acc = 0; petStroke(); }
});
function endDown(e) {
  if (gardenFx.editing()) { gardenFx.editPointer('up', e); down = null; return; }
  if (down && down.hit && down.moved < 10) poke();
  else if (down && !down.hit && !down.steer && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10) {
    if (gardenFx.tap(e)) hideHint(); // chạm luống rau hoặc đóng bảng chọn
    else if (area === 'garden') steerTo(groundPoint(e)); // chạm đất: thú đi tới đó
  }
  down = null; canvas.style.cursor = 'grab';
}
canvas.addEventListener('pointerup', endDown);
canvas.addEventListener('pointercancel', () => { down = null; });

let petN = 0;
function petStroke() {
  hideHint();
  if (area === 'bath' && !S.asleep) { scrub(); return; }
  if (S.asleep) { if (Math.random() < 0.3) spawn('zzz'); impulse(-0.5); return; }
  S.vui = clamp(S.vui + 1.6); sfx('pet'); count('pet'); actBatched('pet'); if (++petN % 6 === 0) popText('+Vui'); setTemp('love', 1500); spawn('heart', 1, 0.7); impulse(-1.1);
  if (Math.random() < 0.15) say(petLine(S.personality), 1800);
}
function poke() {
  hideHint();
  if (S.asleep) { spawn('zzz'); impulse(-2); say('Ư… cho mình ngủ thêm chút…', 2200); return; }
  sfx('pet'); impulse(-4.2); addTrauma(0.12); buzz(10); setTemp('excited', 900); spawn('note'); spawn('sparkle'); S.vui = clamp(S.vui + 1);
}

/* ---------------- nút hành động ---------------- */
function toggleSheet(which) {
  const map = { talk: ['chat', 'a-talk'] };
  Object.entries(map).forEach(([k, [el, btn]]) => { const on = k === which && $(el).hidden; $(el).hidden = !on; $(btn).setAttribute('aria-pressed', String(on)); if (on && k === 'talk') $('chat-input').focus(); });
}
$('a-eat').onclick = () => { hideHint(); toggleSheet(null); if (S.asleep) { say('Suỵt… mình đang ngủ mà.', 2200); return; } goTo('kitchen'); };
$('a-talk').onclick = () => toggleSheet('talk');
$('a-bath').onclick = () => { hideHint(); toggleSheet(null); if (S.asleep) { say('Để sáng mai tắm nha…', 2200); return; } if (sickBlocks('bath')) return; goTo('bath'); };
$('a-play').onclick = () => { hideHint(); toggleSheet(null); if (S.asleep) { say('Zzz… mai chơi tiếp nha…', 2200); return; } if (S.illness && blockedNow(S).includes('play')) { toast(`${S.name} đang ốm nên chưa chơi đồ chơi được. Ra vườn vẫn đi dạo, trồng rau được nhé.`); } goTo('garden'); };
$('a-sleep').onclick = () => { hideHint(); toggleSheet(null); S.asleep ? wake() : goSleep(); };
function goSleep() { sfx('sleep'); count('sleep'); act('sleep'); S.asleep = true; applySleep(); goTo('bedroom'); setTimeout(() => say(`Chúc ${S.name} ngủ ngon… Zzz`, 2600), reduce ? 0 : 700); save(); }
function wake() { sfx('wake'); act('wake'); S.asleep = false; applySleep(); goTo('home'); setTimeout(() => { say('Chào buổi sáng! Mình ngủ ngon lắm.', 2600); startAction('stretch'); spawn('sparkle', 2); }, reduce ? 0 : 700); save(); }
$('ctx').addEventListener('click', e => {
  const b = e.target.closest('.ctx-btn'); if (!b) return; hideHint();
  ({ home: () => goTo('home'), rinse, ball: throwBall, spin: spinPlay, wake, farm: () => gardenFx.startEdit() })[b.dataset.k]();
});
/* Nhạc nền: lúc ngủ > ban đêm > theo khu vực */
function updateMusic() { music(S.asleep ? 'sleep' : period === 'dem' ? 'night' : area); }
function applySleep() { updateMusic(); $('dim').classList.toggle('on', S.asleep); $('sleep-label').textContent = S.asleep ? 'Thức dậy' : 'Ngủ'; $('a-sleep').setAttribute('aria-pressed', String(S.asleep)); }

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
function renderBond() {
  const b = bondProgress(S.bondXp), un = unclaimedLevels(S.bondXp, S.bondClaims);
  $('bond').innerHTML = `<div class="bond-head"><b>Gắn bó · Cấp ${b.level} · ${b.title}</b><span>${b.max ? 'Cấp cao nhất' : `${b.into}/${b.need} điểm`}</span></div><div class="bar-track"><i style="width:${b.pct}%"></i></div>`
    + (un.length ? `<div class="bond-gifts">${un.map(l => `<button type="button" class="btn-sm" data-bond="${l}">Nhận quà cấp ${l} · +${BOND.rewards[l - 1]} xu</button>`).join('')}</div>` : '')
    + '<p class="note">Chăm bé đều đặn (cho ăn, tắm, chơi, nói chuyện, chữa bệnh) thì gắn bó lên cấp. Từ cấp 2, mỗi cấp có một phần quà xu.</p>';
}
$('bond').addEventListener('click', async e => {
  const b = e.target.closest('[data-bond]'); if (!b) return; b.disabled = true;
  const r = await claimBond(+b.dataset.bond);
  if ('error' in r) toast(viError(r.error)); else { sfx('coin'); buzz(12); popText(`+${r.reward} xu`, '#a8742e'); spawn('heart', 3); spawn('sparkle', 3); }
  renderBond();
});
onBondLevel(l => { sfx('wake'); spawn('heart', 4); spawn('sparkle', 3); setTemp('love', 1800); say(`Mình với bạn thân nhau hơn rồi nè!`, 3000); toast(`Gắn bó cấp ${l}: ${BOND.titles[l - 1]}. Mở Chỉ số để nhận quà ${BOND.rewards[l - 1]} xu.`); });
function renderStats() { STAT.forEach(([k]) => { $('f-' + k).style.width = S[k] + '%'; $('l-' + k).textContent = lvl(S[k]); }); renderBond(); renderPersona(); renderTastes(); }
/* Cá tính: mỗi trục là một thanh hai đầu, chấm nằm lệch về nét mạnh hơn */
$('persona-axes').innerHTML = AXES.map(a => `<div class="axis" role="img" id="ax-${a}"><span>${TRAITS[a].lo}</span><div class="axis-track"><i id="axd-${a}"></i></div><span>${TRAITS[a].hi}</span></div>`).join('');
function renderTastes() { $('tastes').textContent = 'Khẩu vị: ' + tastesLine(S.tastes); }
function renderPersona() {
  $('persona-desc').textContent = describePersona(S.personality);
  AXES.forEach(a => {
    const v = S.personality[a];
    $('axd-' + a).style.left = (50 + v / 2) + '%';
    $('ax-' + a).setAttribute('aria-label', `${TRAITS[a].lo} – ${TRAITS[a].hi}: ${Math.abs(v) < 15 ? 'cân bằng' : (v > 0 ? TRAITS[a].hi : TRAITS[a].lo)}`);
  });
}
onTraitShift(name => { toast(`${S.name} đang dần trở nên ${name.toLowerCase()} hơn.`); if (!$('stats').hidden) renderPersona(); });
$('btn-stats').onclick = () => { const s = $('stats'); s.hidden = !s.hidden; $('btn-stats').setAttribute('aria-expanded', String(!s.hidden)); renderStats(); if (!s.hidden) growth.renderSpecies(); if (!s.hidden) { $('diary').hidden = true; $('btn-diary').setAttribute('aria-expanded', 'false'); } };
$('pet-name').value = S.name;
$('pet-name').addEventListener('input', e => { const v = e.target.value.trim().slice(0, 16); if (v) renamePet(v); });

initDiary();
const food = initFood({ sweetsBlocked: () => blockedNow(S).includes('sweets'), sweetsLimit: HEALTH.sweetsLimit, toast: m => toast(m), petRoot, camera, canvas, reduce, hitPet, hideHint, say, setTemp, popText, impulse, spawn, renderStats, shake: () => { shake = 1; }, openShop: () => home && home.openShop('food') });
initChat({ reduce, hideHint, say, setTemp, spawn });
/* Vườn rau 3D: luống đất, cây lớn dần, hoạt ảnh gieo, tưới, hái (garden3d.js) */
const farmDecor = makeDecor({ THREE, toon, add, canvasTex, grad }); // mô hình đồ trang trí nông trại (dùng chung kiểu dựng với đồ trong phòng)
const gardenFx = initGarden3d({
  THREE, garden, toon, add, canvasTex, ground: groundTex, grad, camera, canvas, ray, ndcFrom, spawnAt, popText, say, startAction, toast, sfx, buzz, reduce, getArea: () => area,
  petPos: () => petRoot.getWorldPosition(new THREE.Vector3()), walkPet: walkPetTo,
  buildDecor: id => farmDecor.build(id), thumb: id => home && home.thumb(id),
  setCam: (pos, look) => { camOverride.pos = pos; camOverride.look = look; }, // lùi camera ra để thấy cả sân khi trang trí
  store: { S, plantCrop, waterCrop, harvestCrop, upgradeParcel, buyParcel, saveFarm, refreshGarden, serverNow },
});

/* ---------------- hành vi rảnh rỗi & hoạt cảnh ---------------- */
let ctrl = null, keyMoving = false;
const keys = new Set();
let idleAt = performance.now() + 6000, wander = null, action = null, walking = false, walkPh = 0, chompAt = 0, puffAt = 0, earTwAt = performance.now() + 3000;
const earKick = [0, 0], lastOff = new THREE.Vector3(), mouthW = new THREE.Vector3();
const ACT_DUR = { yawn: 1.8, look: 2.4, dance: 2.0, hop: 1.0, stretch: 1.6, shake: 1.3, wave: 1.6 };
function busy(now) { return growth.isEvolving() || editing || S.asleep || area !== 'home' || anim || fetchBall || override || (temp && now < temp.until) || (down && down.hit) || food.isDragging(); }
function startAction(type) { action = { type, t: 0, fxAt: 0 }; }
function idleThink(now) {
  if (now < idleAt) return;
  idleAt = now + (4500 + Math.random() * 6000) * idleGapFactor(S.personality);
  if (busy(now) || wander || action) return;
  // Cá tính quyết định bé hay làm gì lúc rảnh (personality.ts)
  let k = pickWeighted(idleWeights(S.personality, S), Math.random());
  if (k === 'visit') { const v = home && home.pickVisit(); if (v) { wander = { x: v.x - petBase.x, z: v.z - petBase.z, then: v.then }; return; } k = 'wander'; }
  if (k === 'wander') { const a = Math.random() * Math.PI * 2, d = 0.5 + Math.random() * 0.9; wander = { x: Math.cos(a) * d, z: Math.sin(a) * d * 0.6 }; }
  else startAction(k);
}
function spawnAt(type, x, y, z, o = {}) {
  const sp = getSprite(FXT[type]);
  sp.position.set(x, y, z); const sc = o.scale || 0.3; sp.scale.set(sc, sc, sc);
  particles.push({ s: sp, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g || 0, life: 0, max: o.max || 0.8, base: sc, type });
}
/* ---------------- tự điều khiển thú trong vườn ---------------- */
const GARDEN_X = 4.0, GARDEN_Z1 = 3.2; // vùng thú được đi (toạ độ thế giới); mép sau là phía trước hàng luống gần nhất (gardenFx.minZ())
const clampGardenOff = (v, axis) => (axis === 'x' ? clamp(v, -GARDEN_X - petBase.x, GARDEN_X - petBase.x) : clamp(v, gardenFx.minZ() - petBase.z, GARDEN_Z1 - petBase.z));
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), groundHit = new THREE.Vector3();
const moveMark = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
moveMark.rotation.x = -Math.PI / 2; moveMark.visible = false; garden.add(moveMark);
/** Điểm trên mặt đất dưới con trỏ (toạ độ thế giới), đã kẹp trong vùng đi được. */
function groundPoint(e) {
  ray.setFromCamera(ndcFrom(e), camera);
  if (!ray.ray.intersectPlane(groundPlane, groundHit)) return null;
  return { x: clamp(groundHit.x, -GARDEN_X, GARDEN_X), z: clamp(groundHit.z, gardenFx.minZ(), GARDEN_Z1) };
}
function cancelCtrl() { const c = ctrl; ctrl = null; if (c && c.then) c.then(false); }
/** Cho thú đi tới (wx, wz). Trả về Promise khi tới nơi (hoặc bị huỷ). */
function walkPetTo(wx, wz) {
  return new Promise(resolve => {
    if (S.asleep || editing) { resolve(false); return; }
    cancelCtrl(); wander = null; action = null; hideHint();
    const x = clampGardenOff(wx - petBase.x, 'x'), z = clampGardenOff(wz - petBase.z, 'z');
    if (Math.hypot(x - petOff.x, z - petOff.z) < 0.25) { resolve(true); return; }
    ctrl = { x, z, then: resolve }; moveMark.position.set(petBase.x + x, 0.03, petBase.z + z);
  });
}
/** Chạm vào đất vườn: thú đi tới đó. */
function steerTo(g) {
  if (!g || S.asleep || editing || fetchBall) return;
  cancelCtrl(); wander = null; action = null; hideHint();
  ctrl = { x: clampGardenOff(g.x - petBase.x, 'x'), z: clampGardenOff(g.z - petBase.z, 'z'), then: null };
  moveMark.position.set(petBase.x + ctrl.x, 0.03, petBase.z + ctrl.z);
}
const KEYDIR = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
addEventListener('keydown', e => {
  const k = KEYDIR[e.key]; if (!k || area !== 'garden' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) return;
  keys.add(k); e.preventDefault();
});
addEventListener('keyup', e => { const k = KEYDIR[e.key]; if (k) keys.delete(k); });
addEventListener('blur', () => keys.clear());
function animStep(dt, t, now, key) {
  const o = { hop: 0, roll: 0, yaw: 0, stretch: 0, arm: 0, wave: 0 };
  if (!reduce) idleThink(now);
  /* điều khiển thú trong vườn: phím mũi tên / WASD hoặc chạm đất để thú đi tới */
  keyMoving = false;
  if (area === 'garden' && !S.asleep && !editing && !fetchBall && !growth.isEvolving()) {
    const kx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0), kz = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    if (kx || kz) {
      cancelCtrl(); wander = null; action = null; keyMoving = true;
      const l = Math.hypot(kx, kz), sp = 2.6 * walkSpeedFactor(S.personality) * (S.illness ? 0.6 : 1) * dt;
      petOff.x = clampGardenOff(petOff.x + kx / l * sp, 'x'); petOff.z = clampGardenOff(petOff.z + kz / l * sp, 'z'); moveYaw = Math.atan2(kx, kz);
    } else if (ctrl) {
      const dx = ctrl.x - petOff.x, dz = ctrl.z - petOff.z, d = Math.hypot(dx, dz), step = 2.6 * walkSpeedFactor(S.personality) * (S.illness ? 0.6 : 1) * dt;
      if (d > 0.06) { petOff.x += dx / d * Math.min(step, d); petOff.z += dz / d * Math.min(step, d); moveYaw = Math.atan2(dx, dz); }
      else { const then = ctrl.then; ctrl = null; moveYaw = null; if (then) then(true); }
    }
  } else if (ctrl) cancelCtrl();
  if (wander) {
    if (busy(now)) wander = null;
    else {
      const dx = wander.x - petOff.x, dz = wander.z - petOff.z, d = Math.hypot(dx, dz), step = 1.2 * walkSpeedFactor(S.personality) * (S.illness ? 0.6 : 1) * dt;
      if (d > 0.04) { petOff.x += dx / d * Math.min(step, d); petOff.z += dz / d * Math.min(step, d); moveYaw = Math.atan2(dx, dz); }
      else { const then = wander.then; wander = null; moveYaw = null; if (then) then(); }
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
    chompAt = now + 280; impulse(-1.1); petRoot.localToWorld(mouthW.fromArray(petParts.mouth).multiplyScalar(grow.scale.y));
    spawnAt('crumb', mouthW.x + (Math.random() - 0.5) * 0.3, mouthW.y, mouthW.z, { vx: (Math.random() - 0.5) * 1.2, vy: 1.2, g: 7, scale: 0.12, max: 0.6 });
  }
  return o;
}

/* ---------------- camera rig: thị sai, zoom, rung nhẹ (skill game-feel) ---------------- */
const camBase = new THREE.Vector3(), lookBase = new THREE.Vector3(), camPar = new THREE.Vector2(), focusW = new THREE.Vector3(), lookNow = new THREE.Vector3();
let camZoom = 0, trauma = 0, camIntro = 0, zoomExtra = 0;
function addTrauma(v) { if (!reduce) trauma = Math.min(1, trauma + v); }
function updateCamera(dt, t) {
  if (camOverride.pos) {
    const k = Math.min(1, dt * 3.5); camera.position.lerp(camOverride.pos, k); lookNow.lerp(camOverride.look, k); camera.lookAt(lookNow); return;
  }
  const zoomTarget = (!$('chat').hidden ? 0.24 : 0) + (down && down.hit ? 0.07 : 0) + zoomExtra;
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
  petRoot.localToWorld(pv.set(0, (petParts.headY + 0.32) * grow.scale.y, 0)); pv.project(camera);
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
onSpoil(lost => toast(`Thức ăn tươi bị hỏng: ${Object.entries(lost).map(([id, n]) => `${n} ${FOOD_BY_ID[id]?.name || id}`).join(', ')}. Mua tủ lạnh lớn hơn để giữ được lâu.`));
onSyncError(() => { const n = performance.now(); if (n - toastAt > 15000) { toastAt = n; toast('Chưa lưu được lên máy chủ. Bạn kiểm tra mạng nhé.'); } });
document.querySelector('.bar').addEventListener('click', e => { if (e.target.closest('.act')) buzz(8); });

/* Chấm gợi ý nhu cầu trên nút (không đếm số, không màu đỏ) */
let warnAt = 0, sickFxAt = 0;
const sickChip = $('sick-chip');
sickChip.addEventListener('click', () => { hideHint(); if (home) home.openClinic(); });
/** Chip "Đang ốm / Sắp ốm" ở góc trên, cảnh báo sớm khi bé sắp ốm, và thi thoảng bé than ốm. */
function updateHealth(now) {
  const hs = healthNow(), wall = Date.now(), risk = minutesToSick(hs, wall);
  if (S.illness) {
    const il = ILLNESS_BY_ID[S.illness], sev = isSevere(hs, wall);
    sickChip.hidden = false; sickChip.className = 'sick-chip' + (sev ? ' severe' : ''); sickChip.textContent = `Đang ${il.name.toLowerCase()}${sev ? ' (nặng)' : ''}`;
    if (now > sickFxAt && !S.asleep && !editing && area !== 'bath') { sickFxAt = now + 25000 + Math.random() * 15000; spawn('sweat', 2); if (area === 'home') say(il.sign, 3000); }
  } else if (risk && risk.left <= 20) {
    sickChip.hidden = false; sickChip.className = 'sick-chip warn'; sickChip.textContent = `Sắp ốm: ${STAT_NOUN[risk.stat]} · ${minutesVi(risk.left)}`;
    if (now > warnAt) { warnAt = now + 5 * 60000; toast(`${S.name} sắp ốm: ${STAT_NOUN[risk.stat]} gần 0, còn khoảng ${minutesVi(risk.left)}. Chăm bé ngay nhé!`); if (area === 'home') say('Mình khó chịu quá… chăm mình đi mà…', 3200); }
  } else sickChip.hidden = true;
}
onIllness((now, was) => {
  if (now) {
    const il = ILLNESS_BY_ID[now]; sfx('sleep'); buzz(30); spawn('sweat', 4); setTemp('sick', 2400); impulse(-1.2);
    toast(`${S.name} bị ${il.name.toLowerCase()}. Mở Nhà → Sức khoẻ để chữa.`); say(il.sign, 3600);
  } else if (was) {
    sfx('wake'); spawn('sparkle', 5); spawn('heart', 2); setTemp('love', 1600); say('Mình khỏi ốm rồi! Cảm ơn bạn đã chăm mình.', 3200); toast(`${S.name} đã khỏi bệnh.`);
  }
});
function updateNeeds() {
  updateHealth(performance.now());
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
  applyShadows(scene);
}
function applyShadows(root) {
  root.traverse(o => {
    if (!o.isMesh || o.userData.outline || o === face || o === shadow || o.material.blending === THREE.AdditiveBlending || o.material.transparent) return;
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
setupShadows(); applyQuality(); lookBooted = true;
initAudio();
/* Nhà của bé: bố cục phòng, trang trí, cửa hàng, tủ đồ, nhiệm vụ */
home = initHome({
  THREE, scene, camera, canvas, renderer, room, toon, add, canvasTex, grad, $, reduce,
  homeFloor, homeWalls: [homeWall, homeWall2], pivot, petBase, petBuilder, getPetParts: () => petParts,
  store: { S, healthNow, buyMedicine, useMedicine, visitClinic, refreshHealth, buy, saveLayout, equip, savePreset, claimQuest, claimQuestBonus, claimWeeklyQuest, claimCollection, buyFood, claimRation, nutritionNow, refreshFamily, familyMemories, refreshGarden, plantCrop, harvestCrop, cook, upgradeFridge, serverNow, refreshQuests, activeLayout, previewComfort, onSync, today: () => localDay() },
  say, setTemp, spawn, popText, impulse, startAction, addTrauma, buzz, toast, hideHint, applyShadows, ndcFrom,
  getArea: () => area, goTo, isIdle: () => !busy(performance.now()), isNight: () => period === 'dem',
  setZoom: z => { zoomExtra = z; },
  closeGameSheets: () => { toggleSheet(null); ['stats', 'diary'].forEach(id => { $(id).hidden = true; }); $('btn-stats').setAttribute('aria-expanded', 'false'); $('btn-diary').setAttribute('aria-expanded', 'false'); },
  setEditing: on => {
    editing = on; wander = null; action = null; moveYaw = null; petOff.set(0, 0, 0);
    const portrait = canvas.clientHeight > canvas.clientWidth * 1.05;
    camOverride.pos = on ? new THREE.Vector3(0, portrait ? 15 : 10.5, portrait ? 9.5 : 7.2) : null;
    camOverride.look = on ? new THREE.Vector3(0, 0, portrait ? -0.2 : -0.5) : null;
  },
});
applyPeriod(); applySleep(); renderStats(); updateNeeds();
if (S.asleep) goTo('bedroom', true);
dayRec();
const growth = initGrowth({ evoGlow, reduce, buildLook, cancelMotion: () => { action = null; wander = null; anim = null; }, say, setTemp, spawn, impulse, addTrauma, toast, popText, buzz, getHome: () => home });
onSync(() => { gardenFx.sync(); renderStats(); applySleep(); if (!$('diary').hidden) renderDiary(); if (!growth.isEvolving()) buildLook(); if (!$('stats').hidden) growth.renderSpecies(); });
startPeriodicSync();
if (new URLSearchParams(location.search).has('dev')) { document.querySelector('.review').hidden = false; const f = $('fast'); if (f) f.closest('label').hidden = false; }
const DEV = new URLSearchParams(location.search).has('dev'), devhud = $('devhud');
if (DEV) devhud.hidden = false;
let blinkAt = performance.now() + 2500, blinkUntil = 0, fxAt = 0, saveAt = 0, clockAt = 0, lastKey = '', fpsN = 0, fpsAt = 0;
function tick(now, dt) {
  const t = now / 1000;
  gardenFx.update(dt, now);
  /* chỉ số theo thời gian */
  decay(S, (dt / 60) * ($('fast')?.checked ? 60 : 1));
  if (now > saveAt) { saveAt = now + 5000; save(); if (!$('stats').hidden) renderStats(); }
  if (now > clockAt) { clockAt = now + 1000; const d = new Date(); $('clock').textContent = d.toTimeString().slice(0, 5); applyPeriod(); updateNeeds(); }
  const key = current(now), e = EXPR[key];
  if (key !== lastKey) { if (lastKey) impulse(-1.3); lastKey = key; }
  $('lcdmsg').textContent = S.illness && key === 'sick' ? `${S.name} bị ${ILLNESS_BY_ID[S.illness].name.toLowerCase()}` : `${S.name} ${e.msg}`;
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
  if (growth.isEvolving()) { const g = growth.step(dt); spinY += g.spin; hop += g.hop; }
  pivot.scale.y *= 1 + ex.stretch; pivot.scale.x *= 1 - ex.stretch * 0.4; pivot.scale.z *= 1 - ex.stretch * 0.4;
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); roll += Math.sin(t * 30) * 0.12 * shake; }
  if (!reduce && key === 'sleepy') roll += Math.sin(t * 1.4) * 0.06;
  if (!reduce && key === 'sick') roll += Math.sin(t * 22) * 0.012;
  petRoot.position.set(petBase.x + petOff.x, petBase.y + hop, petBase.z + petOff.z);
  shadow.position.set(petRoot.position.x, 0.075, petRoot.position.z + 0.05); shadow.visible = area !== 'bath' && area !== 'bedroom';
  updateArea(dt, t);
  /* nhìn theo con trỏ, quay đi khi dỗi */
  /* dáng bốn chân / bay lượn đứng hơi nghiêng 3/4 để thấy cả thân */
  const side = petParts && (petParts.plan === 'thu4' || petParts.plan === 'ran') ? 0.42 : 0;
  const wantYaw = moveYaw !== null ? moveYaw : key === 'sulky' ? 0.75 : sleeping ? side * 0.5 : pointerNdc.x * 0.45 + side;
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
  if (home) home.update(dt, t);
  petBuilder.animate(petParts, t, reduce);
  updateCamera(dt, t);
  if (!bubbleEl.hidden) { if (now > bubbleUntil) bubbleEl.hidden = true; else placeBubble(); }
  renderer.render(scene, camera);
  if (DEV) { fpsN++; if (now > fpsAt) { const i = renderer.info.render; devhud.textContent = `${fpsN * 2} FPS · ${i.calls} draw · ${(i.triangles / 1000).toFixed(1)}k tam giác · pr ${renderer.getPixelRatio()}`; fpsN = 0; fpsAt = now + 500; } }
}
/* Vòng lặp theo skill threejs-scene-setup: setAnimationLoop + Timer, dt kẹp trong [0, 0.1] */
const timer = new THREE.Timer(); timer.connect(document);
renderer.setAnimationLoop(() => { timer.update(); tick(performance.now(), Math.min(Math.max(timer.getDelta(), 0), 0.1)); });
initTour({ isBusy: () => growth.isEvolving() });
initCompanion({ say, startAction, spawn, sfx, goTo, openClinic: () => home && home.openClinic(), isBusy: () => growth.isEvolving() || editing || !!anim, dev: DEV });
initFarewell();
/* Chỉ ở ?dev: cho script kiểm tra biết thú đang ở đâu trên màn hình (thú đi lang thang nên không nằm cố định giữa màn hình) */
if (DEV) window.__plotXY = i => gardenFx.screenOf(i);
if (DEV) window.__petXY = () => { const v = new THREE.Vector3(); petRoot.localToWorld(v.set(0, 0.9, 0)); v.project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; };
setTimeout(() => { say(greeting(S.personality, S.name), 3200); if (!S.asleep && S.personality.social > -30) startAction('wave'); }, 700);
setTimeout(hideHint, 9000);
addEventListener('pagehide', save);
