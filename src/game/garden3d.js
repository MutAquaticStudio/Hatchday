// Vườn rau 3D trong cảnh Vườn: 4 luống đất, cây lớn dần theo giờ thật, chạm vào luống để gieo hạt, tưới nước, hái rau.
// Mỗi thao tác có hoạt ảnh: hạt bay vào đất và nảy mầm, bình tưới nghiêng rót nước, rau bay vào giỏ.
// Dữ liệu thật (cây nào, chín lúc nào, số lần tưới) nằm ở server (get_garden, plant_crop, water_crop, harvest_crop); file này chỉ vẽ và gọi.
import { _t } from '../i18n';
import { BY_ID, CROPS, FOOD_BY_ID, GARDEN_LAND, ITEMS, PARCEL, plotIndex, WATER } from './catalog';
import { FOOD_SVG } from './food.js';
import { viError } from '../lib/errors';
import { $, esc } from './dom.js';

// 9 luống chia thành 3 mảnh đất, mỗi mảnh một hàng 3 luống: mảnh đầu mở sẵn, hai mảnh sau mua dần (hàng sau trước, hàng trước sau)
const ROWS = [-3.5, -2.2, -0.9];
const SLOTS = ROWS.flatMap(z => [-1.5, 0, 1.5].map(x => ({ x, z })));
const TOP = 0.19;
const clamp01 = v => Math.max(0, Math.min(1, v));
const easeOutBack = p => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const easeInOut = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

const lcg = seed => { let a = seed; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; };
/**
 * Texture cho nền vườn, vẽ bằng canvas (không cần file ảnh): cỏ có đốm sáng tối, ngọn cỏ và hoa nhỏ; thảm cỏ cắt sọc;
 * vùng đất nâu có sỏi, mép mờ dần vào cỏ; vân gỗ cho thành luống; hạt đất cho luống. Các texture lặp lại liền mạch.
 */
export function groundTextures(canvasTex) {
  const R = lcg(11), tile = (W, H, fn) => { for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) fn(dx, dy); };
  const blob = (g, W, H, n, rMin, rMax, colors) => { for (let i = 0; i < n; i++) { const x = R() * W, y = R() * H, r = rMin + R() * (rMax - rMin), rot = R() * 3; g.fillStyle = colors[Math.floor(R() * colors.length)]; tile(W, H, (dx, dy) => { g.beginPath(); g.ellipse(x + dx, y + dy, r, r * 0.7, rot, 0, 7); g.fill(); }); } };
  const blades = (g, W, H, n, cols) => { g.lineCap = 'round'; for (let i = 0; i < n; i++) { const x = R() * W, y = R() * H, len = 4 + R() * 6, a = (R() - 0.5) * 0.9; g.strokeStyle = cols[Math.floor(R() * cols.length)]; g.lineWidth = 1.3; tile(W, H, (dx, dy) => { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.sin(a) * len, y + dy - Math.cos(a) * len); g.stroke(); }); } };
  const grass = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#8fdc7a'; g.fillRect(0, 0, W, H);
    blob(g, W, H, 150, 12, 34, ['rgba(96,184,96,.30)', 'rgba(196,244,152,.30)']);
    blades(g, W, H, 650, ['#6fbf62', '#a8ec92', '#7ed06e']);
    for (let i = 0; i < 18; i++) { const x = R() * W, y = R() * H; g.fillStyle = ['#ffffff', '#ffc2da', '#fff0a0'][i % 3]; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); g.fillStyle = '#f2b13a'; g.beginPath(); g.arc(x, y, 0.9, 0, 7); g.fill(); }
  }, [7, 7]);
  const lawn = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#a9e892'; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 64) { g.fillStyle = 'rgba(110,196,104,.22)'; g.fillRect(x, 0, 32, H); } // sọc cắt cỏ
    blob(g, W, H, 80, 8, 20, ['rgba(255,255,255,.14)', 'rgba(110,196,104,.14)']);
    blades(g, W, H, 260, ['#8fdc7a', '#c4f4a8']);
  });
  const dirt = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#b98a5c'; g.fillRect(0, 0, W, H);
    blob(g, W, H, 120, 6, 22, ['rgba(150,100,60,.35)', 'rgba(214,170,120,.30)']);
    for (let i = 0; i < 520; i++) { g.fillStyle = ['#a77649', '#caa070', '#8a5a34'][i % 3]; g.fillRect(R() * W, R() * H, 2 + R() * 2, 2 + R() * 2); }
    for (let i = 0; i < 26; i++) { g.fillStyle = ['#d9c09a', '#b8a58a'][i % 2]; g.beginPath(); g.ellipse(R() * W, R() * H, 3 + R() * 3, 2 + R() * 2, R() * 3, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'destination-out'; // mép mờ dần vào cỏ
    [[0, 0, 0, 34, 0, 0, W, 34], [0, H, 0, H - 34, 0, H - 34, W, 34], [0, 0, 34, 0, 0, 0, 34, H], [W, 0, W - 34, 0, W - 34, 0, 34, H]].forEach(([x0, y0, x1, y1, rx, ry, rw, rh]) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    });
  });
  const wood = canvasTex(128, 64, (g, W, H) => {
    g.fillStyle = '#c98a5a'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { g.strokeStyle = i % 2 ? 'rgba(122,74,42,.35)' : 'rgba(240,190,140,.30)'; g.lineWidth = 1 + R() * 1.4; const y = R() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + (R() - 0.5) * 6, W * 0.7, y + (R() - 0.5) * 6, W, y + (R() - 0.5) * 4); g.stroke(); }
    g.fillStyle = 'rgba(100,60,30,.5)'; g.beginPath(); g.ellipse(W * 0.7, H * 0.4, 5, 3, 0, 0, 7); g.fill();
  });
  const soil = canvasTex(128, 128, (g, W, H) => { // nhạt để màu của vật liệu quyết định (đất khô / ướt)
    g.fillStyle = '#ececec'; g.fillRect(0, 0, W, H);
    blob(g, W, H, 40, 6, 16, ['rgba(255,255,255,.5)', 'rgba(200,200,200,.5)']);
    for (let i = 0; i < 260; i++) { g.fillStyle = ['#d2d2d2', '#ffffff', '#c4c4c4'][i % 3]; g.fillRect(R() * W, R() * H, 2, 2); }
  }, [2, 2]);
  return { grass, lawn, dirt, wood, soil };
}

/** Hiện chữ "còn 2 giờ 10 phút". */
export function leftText(ms) { const m = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(m / 60); return h ? _t`còn ${h} giờ${m % 60 ? ' ' + (m % 60) + _t(' phút') : ''}` : _t`còn ${m} phút`; }

/**
 * `c`: { THREE, garden, toon, add, canvasTex, camera, canvas, ray, ndcFrom, spawnAt, popText, say, startAction, toast, sfx, buzz,
 *        reduce, getArea, petPos, walkPet, buildDecor, thumb, store }. `store`: { S, plantCrop, waterCrop, harvestCrop, upgradeParcel, buyParcel, saveFarm, refreshGarden, serverNow }.
 * Trả về { sync, tap, update, screenOf, closeMenu }.
 */
export function initGarden3d(c) {
  const { THREE, garden, toon, add, canvasTex, ground, camera, canvas, ray, ndcFrom, spawnAt, popText, say, startAction, toast, sfx, buzz, reduce, store } = c;
  const { S } = store;
  const D = reduce ? 0.01 : 1; // giảm chuyển động: gần như nhảy tới kết quả ngay
  const anims = [];
  const tween = (dur, fn, done) => anims.push({ t: 0, dur: Math.max(dur * D, 0.01), fn, done });
  const wait = (dur, done) => tween(dur, () => {}, done);

  /* ---------------- vật liệu và mô hình dùng chung ---------------- */
  const green = toon('#5fc46c'), green2 = toon('#7edb72'), brown = toon('#8a5a2e'), yellow = toon('#ffd95a'), orange = toon('#ff9a3c');
  const melonTex = canvasTex(64, 64, g => { g.fillStyle = '#4fae5a'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#2f7a3d'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 7, 64); });
  const OUT = '#3f6a3a';

  /* ---------------- đất nông trại: vùng đất nâu, bụi cỏ, đá nhỏ ---------------- */
  const dirtMat = new THREE.MeshToonMaterial({ map: ground.dirt, transparent: true, gradientMap: c.grad });
  { const dirt = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 4.7), dirtMat);
    dirt.rotation.x = -Math.PI / 2; dirt.position.set(0, 0.012, -2.1); garden.add(dirt);
    const R = lcg(29), stone = toon('#c9c3bb'), tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.3, 5), toon('#ffffff'), 330), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    let n = 0;
    while (n < 330) { // bụi cỏ rải rác ngoài thảm của thú và ngoài vùng đất
      const x = (R() * 2 - 1) * 7, z = -4.0 + R() * 8.8;
      if (Math.hypot(x, z - 0.6) < 2.7 || (Math.abs(x) < 3.3 && z < -0.1 && z > -4.5)) continue;
      for (let k = 0; k < 3 && n < 330; k++, n++) { e.set((R() - 0.5) * 0.5, R() * 3, (R() - 0.5) * 0.5); q.setFromEuler(e); const s = 0.7 + R() * 0.8;
        m4.compose(new THREE.Vector3(x + (R() - 0.5) * 0.18, 0.13 * s, z + (R() - 0.5) * 0.18), q, new THREE.Vector3(s, s, s)); tufts.setMatrixAt(n, m4); tufts.setColorAt(n, col.set(['#6fc866', '#58b45a', '#8fdc7a'][n % 3])); } }
    garden.add(tufts);
    for (let i = 0; i < 14; i++) { const x = (i % 2 ? 1 : -1) * (3.3 + R() * 0.5), z = -4.1 + R() * 3.9, s = 0.07 + R() * 0.07; const st = add(garden, new THREE.SphereGeometry(s, 8, 6), stone, x, s * 0.4, z, '#8a8278', 0.01); st.scale.set(1.3, 0.6, 1); } }

  /** Cây theo loại: { leaf, fruit } cho một gốc. fruit chỉ hiện khi chín. */
  function buildPlant(cropId) {
    const root = new THREE.Group(), leaf = new THREE.Group(), fruit = new THREE.Group(); root.add(leaf, fruit);
    if (cropId === 'carot') {
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, b = add(leaf, new THREE.ConeGeometry(0.045, 0.5, 5), green2, Math.cos(a) * 0.07, 0.34, Math.sin(a) * 0.07, OUT, 0.01); b.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
      const r = add(fruit, new THREE.ConeGeometry(0.1, 0.3, 10), orange, 0, 0.07, 0, '#a85a1a', 0.015); r.rotation.x = Math.PI;
    } else if (cropId === 'bap-nuong') {
      add(leaf, new THREE.CylinderGeometry(0.03, 0.04, 0.85, 8), green, 0, 0.42, 0, OUT, 0.01);
      [[-0.5, 0.55, 0.9], [0.5, 0.45, -0.9], [0.1, 0.65, 0.2]].forEach(([tilt, y, ry]) => { const l = add(leaf, new THREE.ConeGeometry(0.09, 0.62, 4), green2, 0, y, 0, OUT, 0.01); l.scale.z = 0.25; l.rotation.set(0, ry, tilt); });
      const cob = add(fruit, new THREE.CylinderGeometry(0.07, 0.055, 0.3, 10), yellow, 0.09, 0.5, 0, '#a8742e', 0.015); cob.rotation.z = -0.25;
      add(fruit, new THREE.ConeGeometry(0.08, 0.14, 8), green2, 0.06, 0.68, 0, OUT, 0.01);
    } else if (cropId === 'chuoi') {
      add(leaf, new THREE.CylinderGeometry(0.03, 0.045, 0.7, 8), toon('#9cc46a'), 0, 0.35, 0, OUT, 0.01);
      [0, 2.1, 4.2].forEach(a => { const l = add(leaf, new THREE.SphereGeometry(0.3, 12, 8), green2, Math.cos(a) * 0.2, 0.72, Math.sin(a) * 0.2, OUT, 0.01); l.scale.set(1, 0.12, 0.38); l.rotation.y = -a; l.rotation.z = 0.18; });
      [-0.06, 0, 0.06].forEach((dx, k) => { const b = add(fruit, new THREE.CapsuleGeometry(0.035, 0.17, 4, 8), yellow, dx, 0.55 - k * 0.01, 0.06, '#a8742e', 0.012); b.rotation.z = (k - 1) * 0.35; });
    } else if (cropId === 'dua-hau') {
      [0, 2.1, 4.2].forEach(a => { const l = add(leaf, new THREE.SphereGeometry(0.17, 10, 8), green, Math.cos(a) * 0.17, 0.08, Math.sin(a) * 0.17, OUT, 0.01); l.scale.set(1, 0.3, 0.8); l.rotation.y = -a; });
      const m = add(fruit, new THREE.SphereGeometry(0.2, 16, 12), toon('#ffffff', melonTex), 0.03, 0.2, 0.04, '#2f6a3a', 0.015); m.scale.set(1.15, 0.95, 1);
    }
    return { root, leaf, fruit };
  }
  /** Một phần thu hoạch để bay vào giỏ. */
  function buildFruitOnly(cropId) { const p = buildPlant(cropId); p.root.remove(p.leaf); p.fruit.visible = true; return p.root; }

  /* ---------------- luống đất ---------------- */
  const beds = SLOTS.map(({ x, z }, i) => {
    const root = new THREE.Group(); root.position.set(x, 0, z); garden.add(root);
    const wood = toon('#ffffff', ground.wood);
    [[0, 0.5, 1.3, 0.05], [0, -0.5, 1.3, 0.05], [-0.62, 0, 0.05, 1.05], [0.62, 0, 0.05, 1.05]].forEach(([dx, dz, w, d]) => { const p = add(root, new THREE.BoxGeometry(w === 0.05 ? 0.1 : w, 0.2, d === 0.05 ? 0.1 : d), wood, dx, 0.1, dz, '#7a4a2a', 0.02); p.userData.plot = i; });
    const soilMat = toon('#7a4a2e', ground.soil), soil = add(root, new THREE.BoxGeometry(1.16, 0.18, 0.94), soilMat, 0, 0.09, 0, '#4a2c1a', 0.02); soil.userData.plot = i;
    for (let k = -1; k <= 1; k++) { const f = add(root, new THREE.BoxGeometry(1.0, 0.02, 0.06), toon('#6a3e24'), 0, TOP, k * 0.28, null); f.userData.plot = i; }
    const mound = add(root, new THREE.SphereGeometry(0.2, 12, 8), toon('#6a3e24'), 0, TOP, 0, null); mound.scale.set(1.6, 0.35, 1); mound.visible = false;
    // biển "đất hoang" cho ô chưa mở: cọc gỗ, tấm biển, đồng xu vàng
    const sign = new THREE.Group(); sign.position.set(0, 0, 0.1); root.add(sign);
    add(sign, new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), toon('#a8744e'), 0, 0.3, 0, '#6a4630', 0.012);
    const board = add(sign, new THREE.BoxGeometry(0.5, 0.3, 0.05), toon('#e8b47a'), 0, 0.68, 0, '#8a5a2a', 0.015);
    const coin = add(sign, new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), toon('#ffd36e'), 0, 0.68, 0.04, '#a8742e', 0.012); coin.rotation.x = Math.PI / 2; board.userData.plot = i; coin.userData.plot = i;
    const furrows = root.children.filter(o => o.geometry && o.geometry.type === 'BoxGeometry' && o.position.y === TOP);
    return { i, root, soil, soilMat, mound, sign, furrows, plants: [], crop: '', busy: false, dark: 0, locked: false };
  });
  const plantXs = [-0.34, 0, 0.34];

  function removePlants(b) { b.plants.forEach(p => b.root.remove(p.root)); b.plants = []; b.crop = ''; }
  function addPlants(b, cropId) {
    removePlants(b); b.crop = cropId;
    plantXs.forEach((dx, k) => { const p = buildPlant(cropId); p.root.position.set(dx, TOP, (k - 1) * 0.04); p.root.rotation.y = k * 1.7; b.root.add(p.root); b.plants.push(p); });
  }
  /** Cỡ cây theo tiến độ 0–1: mầm nhỏ rồi lớn dần; chín thì hiện quả. */
  function applyGrowth(b, prog, ripe, t) {
    const s = 0.3 + 0.7 * clamp01(prog); // mầm luôn hiện, lớn dần tới lúc chín
    b.mound.visible = false;
    b.plants.forEach((p, k) => {
      p.root.visible = true;
      if (b.growing) return; // đang chạy hoạt ảnh gieo: để hoạt ảnh lo
      p.root.scale.setScalar(s);
      p.fruit.visible = ripe;
      if (!reduce) { p.leaf.rotation.z = Math.sin(t * 1.4 + b.i + k) * 0.035; if (ripe) p.fruit.position.y = Math.sin(t * 2.2 + k) * 0.012; }
    });
  }

  /* ---------------- giỏ, bình tưới ---------------- */
  const basket = new THREE.Group(); basket.position.set(-3.45, 0, 1.0); garden.add(basket);
  { const wick = toon('#e8b47a'), inner = toon('#c98a5a');
    const body = add(basket, new THREE.CylinderGeometry(0.48, 0.38, 0.36, 20, 1, true), wick, 0, 0.18, 0, '#8a5a2a', 0.02); body.material.side = THREE.DoubleSide;
    add(basket, new THREE.CylinderGeometry(0.38, 0.38, 0.03, 20), inner, 0, 0.02, 0, null);
    add(basket, new THREE.TorusGeometry(0.48, 0.03, 8, 24), wick, 0, 0.36, 0, '#8a5a2a', 0.012).rotation.x = Math.PI / 2;
    const h = add(basket, new THREE.TorusGeometry(0.4, 0.025, 8, 20, Math.PI), wick, 0, 0.36, 0, '#8a5a2a', 0.012); h.rotation.set(0, 0, 0); }
  let basketSq = 0;

  const can = new THREE.Group(); can.visible = false; garden.add(can);
  { const blue = toon('#7fc8f8');
    add(can, new THREE.CylinderGeometry(0.2, 0.17, 0.3, 14), blue, 0, 0, 0, '#2f7aaa', 0.02);
    const sp = add(can, new THREE.CylinderGeometry(0.025, 0.04, 0.34, 8), blue, -0.27, 0.07, 0, '#2f7aaa', 0.015); sp.rotation.z = 0.75;
    const rose = add(can, new THREE.CylinderGeometry(0.06, 0.04, 0.05, 10), toon('#4fa8e0'), -0.4, 0.2, 0, '#2f7aaa', 0.012); rose.rotation.z = 0.75;
    const hd = add(can, new THREE.TorusGeometry(0.12, 0.025, 8, 14), blue, 0.21, 0.04, 0, '#2f7aaa', 0.012); hd.rotation.y = Math.PI / 2; }
  const drops = []; const dropGeo = new THREE.SphereGeometry(0.03, 8, 6), dropMat = new THREE.MeshBasicMaterial({ color: '#7fd0ff', transparent: true, opacity: 0.9 });

  /* ---------------- hoạt ảnh ---------------- */
  const worldOf = (b, dx = 0, y = TOP, dz = 0) => new THREE.Vector3(b.root.position.x + dx, y, b.root.position.z + dz);
  function puff(pos, n = 3) { for (let k = 0; k < n; k++) spawnAt('puff', pos.x + (Math.random() - 0.5) * 0.4, pos.y + 0.1, pos.z + 0.25 + Math.random() * 0.1, { vy: 0.5, vx: (Math.random() - 0.5) * 0.7, max: 0.7, scale: 0.28 }); }

  /** Làm xong thì thú quay về giữa sân, khỏi che luống. */
  const backToLawn = () => setTimeout(() => { c.walkPet(0, 1.3); }, 450 * D);

  /** Gieo hạt: hạt bay vòng cung vào luống, đất phồng lên, mầm nảy ra. */
  function animPlant(b, cropId) {
    b.busy = true; b.growing = true;
    const from = c.petPos().clone(); from.y = 1.1; const to = worldOf(b);
    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), brown); garden.add(seed);
    sfx('place'); startAction('hop');
    tween(0.65, p => { seed.position.lerpVectors(from, to, p); seed.position.y += Math.sin(p * Math.PI) * 1.2; seed.rotation.x = p * 9; }, () => {
      garden.remove(seed); puff(to); sfx('feed');
      addPlants(b, cropId); b.plants.forEach(p => p.root.scale.setScalar(0.01)); b.mound.visible = false;
      tween(0.3, p => { b.soil.scale.y = 1 - 0.35 * Math.sin(p * Math.PI); });
      tween(0.9, p => { const s = 0.28 * easeOutBack(clamp01(p)); b.plants.forEach(pl => pl.root.scale.setScalar(Math.max(0.01, s))); }, () => { b.growing = false; b.busy = false; sync(); backToLawn(); });
    });
  }

  /** Tưới nước: bình bay tới, nghiêng, rót những giọt nước; đất sẫm lại, cây nhún lên. */
  function animWater(b) {
    b.busy = true; sfx('bath'); startAction('look');
    const at = worldOf(b, 0.5, 1.25, 0.45), start = at.clone().add(new THREE.Vector3(1.1, 0.7, -0.1));
    can.visible = true; can.rotation.set(0, 0, 0); can.position.copy(start);
    tween(0.5, p => { const e = easeInOut(p); can.position.lerpVectors(start, at, e); can.rotation.z = 0.8 * e; }, () => {
      let acc = 0;
      tween(1.2, (p, dt) => {
        acc += dt;
        while (acc > 0.03) { acc -= 0.03; const tip = new THREE.Vector3(-0.42, 0.04, 0).applyEuler(can.rotation).add(can.position);
          const d = new THREE.Mesh(dropGeo, dropMat); d.position.copy(tip); garden.add(d); drops.push({ m: d, vx: -0.45 - Math.random() * 0.3, vy: 0.1, vz: (Math.random() - 0.5) * 0.25, floor: TOP + 0.03 + Math.random() * 0.03 }); }
        can.position.y = at.y + Math.sin(p * 12) * 0.01; b.dark = Math.min(1, p * 2.2);
      }, () => {
        puff(worldOf(b), 2); b.plants.forEach(pl => { pl.root.scale.multiplyScalar(1.08); });
        tween(0.5, p => { const e = easeInOut(p); can.rotation.z = 0.8 * (1 - e); can.position.lerpVectors(at, start, e); }, () => { can.visible = false; });
        tween(4, p => { b.dark = 1 - p; }, () => { b.dark = 0; });
        b.busy = false; sync(); backToLawn();
      });
    });
  }

  /** Hái rau: cây rung, quả bay vòng cung vào giỏ, cây biến mất, đất trống lại. */
  function animHarvest(b, cropId, got) {
    b.busy = true; b.growing = true; sfx('coin'); startAction('hop');
    tween(0.5, p => { b.plants.forEach((pl, k) => { pl.root.rotation.z = Math.sin(p * Math.PI * 7 + k) * 0.14 * (1 - p); pl.root.position.y = TOP + Math.sin(p * Math.PI) * 0.03; }); }, () => {
      const target = new THREE.Vector3(basket.position.x, 0.5, basket.position.z);
      b.plants.forEach((pl, k) => {
        if (k >= got) return;
        const start = worldOf(b, plantXs[k], 0.5, (k - 1) * 0.04), fruit = buildFruitOnly(cropId); fruit.position.copy(start); fruit.scale.setScalar(1.15); garden.add(fruit);
        wait(k * 0.16, () => {
          puff(start, 2);
          tween(0.75, p => { fruit.position.lerpVectors(start, target, p); fruit.position.y += Math.sin(p * Math.PI) * 1.1; fruit.rotation.z = p * 6; }, () => {
            garden.remove(fruit); basketSq = 1; sfx('place'); buzz(8);
            for (let s = 0; s < 2; s++) spawnAt('sparkle', target.x + (Math.random() - 0.5) * 0.5, 0.7, target.z + 0.2, { vy: 0.7, max: 0.8, scale: 0.26 });
          });
        });
      });
      tween(0.35, p => { b.plants.forEach(pl => pl.root.scale.setScalar(Math.max(0.01, pl.root.scale.x * (1 - 0.18)))); }, () => {
        removePlants(b); b.growing = false; b.busy = false; sync(); backToLawn();
        popText(`+${got} ${FOOD_BY_ID[cropId].name}`, '#3f9a63'); startAction('dance');
      });
    });
  }

  /** Mở rộng đất: ô mới nảy lên từng cái một, bụi bay, đồng xu vàng biến mất. */
  function animExpand(from, to) {
    sfx('buy'); buzz(14); startAction('dance'); say(_t('Đất mới rộng thênh thang!'), 2400);
    for (let i = from; i < to; i++) {
      const b = beds[i]; b.busy = true; b.root.visible = true; b.root.scale.setScalar(0.01);
      wait((i - from) * 0.2, () => { puff(worldOf(b), 4); tween(0.7, p => b.root.scale.setScalar(Math.max(0.01, easeOutBack(p))), () => { b.root.scale.setScalar(1); b.busy = false; sync(); }); });
    }
    sync();
  }

  /* ---------------- đồng bộ với dữ liệu server ---------------- */
  const plotOf = i => S.garden?.plots.find(p => p.plot === gidx(i));
  /* ---- mảnh đất: mỗi mảnh dùng chung khu luống 3×3, đổi mảnh bằng thanh chọn ---- */
  let parcel = 0;
  const parcelsNow = () => S.garden?.parcels || [{ parcel: 0, level: 0, size: GARDEN_LAND[0].plots }];
  const sizeNow = () => parcelsNow()[parcel]?.size || GARDEN_LAND[0].plots;
  const gidx = slot => plotIndex(parcel, slot); // số thứ tự ô toàn cục gửi lên server
  /** Hàng luống gần thú nhất đang hiện (mảnh đã mua + mảnh sắp bán), và chỗ thú đứng để làm việc phía trước hàng đó. */
  const frontRowZ = () => ROWS[Math.min(Math.floor(sizeNow() / 3), ROWS.length - 1)];
  const workZ = () => frontRowZ() + 1.15;
  function sync() {
    if (!S.garden) return;
    const now = store.serverNow(), size = sizeNow();
    beds.forEach(b => {
      b.root.visible = b.i < size + 3; // chỉ hiện thêm mảnh đất sắp bán
      b.locked = b.i >= size; b.sign.visible = b.locked; b.furrows.forEach(f => { f.visible = !b.locked; });
      if (b.locked) { if (b.crop) removePlants(b); b.mound.visible = false; return; }
      if (b.busy) return;
      const p = plotOf(b.i);
      if (!p) { if (b.crop) removePlants(b); b.mound.visible = false; return; }
      if (p.crop !== b.crop) addPlants(b, p.crop);
      const planted = Date.parse(p.planted_at), ready = Date.parse(p.ready_at), ripe = now >= ready;
      applyGrowth(b, ripe ? 1 : clamp01((now - planted) / Math.max(1, ready - planted)), ripe, performance.now() / 1000);
    });
  }

  /* ---------------- bảng chọn khi chạm vào luống ---------------- */
  const menu = document.createElement('div'); menu.id = 'plot-menu'; menu.className = 'plot-menu'; menu.hidden = true; $('app').appendChild(menu);
  let menuPlot = -1, menuAt = 0, menuOpenedAt = 0;
  const screenOf = (i, y = 0.4) => { const b = beds[i], v = new THREE.Vector3(b.root.position.x, y, b.root.position.z).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; };
  function closeMenu() { menu.hidden = true; menuPlot = -1; }
  function menuHtml(i) {
    const p = plotOf(i), now = store.serverNow(), lvl = parcelsNow()[parcel]?.level || 0;
    if (beds[i].locked) { const next = GARDEN_LAND[lvl + 1]; return next ? _t`<h3>Đất chưa mở</h3><p class="pm-note">Nâng cấp mảnh đất này (+${next.plots - GARDEN_LAND[lvl].plots} ô, lên ${next.plots} ô)</p><button type="button" class="btn-sm" data-expand ${S.coins >= next.price ? '' : 'disabled'}>Nâng cấp · ${next.price} xu</button>` : _t('<h3>Mảnh đất đã đủ 9 ô</h3>'); }
    if (!p) return _t`<h3>Ô đất ${i + 1}</h3><p class="pm-note">Chọn cây để gieo hạt</p><div class="pm-crops">${CROPS.map(cr => _t`<button type="button" class="pm-crop" data-plant="${cr.id}" ${S.coins >= cr.seed ? '' : 'disabled'}>${FOOD_SVG[cr.id]}<b>${esc(FOOD_BY_ID[cr.id].name)}</b><small>${cr.seed} xu · ${cr.hours} giờ</small></button>`).join('')}</div>`;
    const cr = CROPS.find(x => x.id === p.crop), ready = Date.parse(p.ready_at), name = FOOD_BY_ID[p.crop].name;
    if (now >= ready) return _t`<h3>${esc(name)} chín rồi!</h3><p class="pm-note">Hái được ${cr.yield} phần</p><button type="button" class="btn-sm" data-harvest>Hái rau +${cr.yield}</button>`;
    const planted = Date.parse(p.planted_at), pct = clamp01((now - planted) / Math.max(1, ready - planted)) * 100;
    const why = p.waters >= WATER.max ? _t('Đã tưới đủ 3 lần') : !p.can_water ? _t('Vừa tưới xong, đợi một lát') : _t`Mỗi lần tưới rút ngắn ${Math.round(WATER.cut * 100)}% thời gian`;
    return _t`<h3>${esc(name)}</h3><div class="bar-track"><i style="width:${Math.max(4, pct)}%"></i></div><p class="pm-note">${leftText(ready - now)}</p>
      <button type="button" class="btn-sm" data-water ${p.can_water ? '' : 'disabled'}>Tưới nước (${p.waters}/${WATER.max})</button><p class="pm-note">${why}</p>`;
  }
  function openMenu(i) {
    menuPlot = i; menuAt = menuOpenedAt = performance.now(); menu.innerHTML = menuHtml(i); menu.hidden = false;
    const pt = screenOf(i, 0.9), r = $('app').getBoundingClientRect(), w = menu.offsetWidth || 220;
    menu.style.left = `${Math.max(8, Math.min(r.width - w - 8, pt.x - r.left - w / 2))}px`;
    menu.style.top = `${Math.max(70, pt.y - r.top - (menu.offsetHeight || 150) - 10)}px`;
  }
  menu.addEventListener('click', async e => {
    // trên cảm ứng, sau khi nhả ngón tay trình duyệt còn gửi một "click" giả vào đúng chỗ menu vừa hiện ra: bỏ qua để khỏi bấm nhầm
    if (performance.now() - menuOpenedAt < 450) return;
    const i = menuPlot; if (i < 0) return;
    const pl = e.target.closest('[data-plant]'), wt = e.target.closest('[data-water]'), hv = e.target.closest('[data-harvest]'), ex = e.target.closest('[data-expand]'), b = beds[i];
    if (!pl && !wt && !hv && !ex) return;
    closeMenu(); if (b.busy) return; b.busy = true; // chặn đồng bộ chen vào trong lúc gọi server
    const toBed = () => c.walkPet(b.root.position.x, workZ()); // thú tự đi tới trước luống rồi mới làm
    if (ex) {
      const before = sizeNow(), err = await store.upgradeParcel(parcel);
      if (err) { b.busy = false; toast(viError(err)); return; }
      b.busy = false; animExpand(before, sizeNow()); renderBar(); return;
    }
    if (pl) {
      const err = await store.plantCrop(gidx(i), pl.dataset.plant);
      if (err) { b.busy = false; toast(viError(err)); return; }
      await toBed(); b.busy = false; animPlant(b, pl.dataset.plant); toast(_t`Đã gieo ${FOOD_BY_ID[pl.dataset.plant].name}.`);
    } else if (wt) {
      const err = await store.waterCrop(gidx(i));
      if (err) { b.busy = false; toast(viError(err)); return; }
      await toBed(); b.busy = false; animWater(b); say(_t('Mát quá, cây lớn nhanh nhé!'), 2200);
    } else {
      const res = await store.harvestCrop(gidx(i));
      if ('error' in res) { b.busy = false; toast(viError(res.error)); return; }
      await toBed(); b.busy = false; animHarvest(b, res.item, res.got);
    }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && edit) { stopEdit(); e.stopImmediatePropagation(); } else if (e.key === 'Escape' && !menu.hidden) { closeMenu(); e.stopImmediatePropagation(); } }, true);

  /** Chạm lên canvas: trúng luống thì mở bảng chọn. Trả về true nếu đã xử lý. */
  function tap(e) {
    if (c.getArea() !== 'garden') return false;
    ray.setFromCamera(ndcFrom(e), camera);
    const hit = ray.intersectObjects(beds.map(b => b.root), true).find(h => { let o = h.object; while (o && o.userData.plot === undefined) o = o.parent; return !!o; });
    if (!hit) { const was = !menu.hidden; closeMenu(); return was; }
    let o = hit.object; while (o.userData.plot === undefined) o = o.parent;
    const i = o.userData.plot; if (beds[i].busy) return true;
    store.refreshGarden().then(() => { if (c.getArea() === 'garden') openMenu(i); }).catch(() => openMenu(i));
    buzz(6); return true;
  }

  /* ---------------- trang trí nông trại: đặt, kéo, xoay, cất đồ mua ở cửa hàng ---------------- */
  const FARM_ITEMS = ITEMS.filter(i => i.layer === 'farm');
  const farmRoot = new THREE.Group(); garden.add(farmRoot);
  let farmMeshes = [], farmSig = '', edit = null; // edit: { items, sel, drag }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28), new THREE.MeshBasicMaterial({ color: '#5fbf86', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.visible = false; garden.add(ring);
  const farmGround = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), farmHit = new THREE.Vector3();
  const snap = v => Math.round(v * 4) / 4;
  /** Bán kính chiếm chỗ của từng món (đơn vị thế giới), để không đặt chồng lên nhau. */
  const FARM_R = { 'ao-nho': 1.0, gieng: 0.7, 'coi-xay-gio': 0.75, 'to-ong': 0.5, 'xe-hoa': 0.65, 'ghe-vuon': 0.65, 'dong-rom': 0.55, 'bu-nhin': 0.5, 'bien-nong-trai': 0.7, 'hom-thu': 0.35, 'den-vuon': 0.4, 'goc-nam': 0.45 };
  const farmR = id => FARM_R[id] ?? 0.5;
  function placeMesh(g, it) { g.position.set(it.x, 0, it.z); g.rotation.y = it.rot * Math.PI / 2; }
  function buildFarm(items) {
    farmRoot.children.slice().forEach(g => { farmRoot.remove(g); g.traverse(o => o.geometry?.dispose()); });
    farmMeshes = items.map(it => { const g = c.buildDecor(it.id); placeMesh(g, it); farmRoot.add(g); return g; });
  }
  function syncFarm() { if (edit) return; const sig = JSON.stringify(S.farm); if (sig !== farmSig) { farmSig = sig; buildFarm(S.farm); } }
  /** Chỗ đặt hợp lệ: trong sân, ngoài vùng luống, ngoài thảm cỏ của thú, ngoài giỏ, không đè món khác. Server chỉ kiểm tra phạm vi và số lượng. */
  function farmValid(items, i) {
    const it = items[i];
    if (Math.abs(it.x) > 6.4 || it.z < -4.0 || it.z > 5.0) return false;
    if (Math.abs(it.x) < 3.3 && it.z < -0.2) return false;
    if (Math.hypot(it.x, it.z - 0.6) < 1.4) return false; // chỗ thú đứng giữa sân (thú đi quanh được, đồ chỉ là trang trí)
    if (Math.hypot(it.x - basket.position.x, it.z - basket.position.z) < 0.9) return false;
    return items.every((o, k) => k === i || Math.hypot(o.x - it.x, o.z - it.z) >= farmR(o.id) + farmR(it.id) + 0.1);
  }
  function updateRing() {
    const it = edit && edit.sel >= 0 ? edit.items[edit.sel] : null; ring.visible = !!it;
    if (it) { ring.position.set(it.x, 0.04, it.z); ring.material.color.set(farmValid(edit.items, edit.sel) ? '#5fbf86' : '#ff5a5a'); }
  }
  const fe = sel => panel.querySelector(sel);
  const panel = document.createElement('div'); panel.className = 'edit-ui farm-ui'; panel.hidden = true; $('app').appendChild(panel);
  function renderPanel() {
    const counts = {}; edit.items.forEach(it => { counts[it.id] = (counts[it.id] || 0) + 1; });
    const list = FARM_ITEMS.filter(i => (S.owned[i.id] || 0) > 0), selIt = edit.sel >= 0 ? BY_ID[edit.items[edit.sel].id] : null;
    panel.innerHTML = _t`<div class="edit-top"><div class="edit-title"><b>Trang trí nông trại</b><span>${edit.items.length} món · chạm món bên dưới để đặt, kéo để di chuyển</span></div>
        <div class="edit-actions"><button type="button" class="pill save" data-fe="save">Lưu</button><button type="button" class="pill" data-fe="cancel">Hủy</button></div></div>
      <div class="item-bar" ${selIt ? '' : 'hidden'}><b>${selIt ? esc(selIt.name) : ''}</b><button type="button" class="btn-sm ghost" data-fe="rotate">Xoay</button><button type="button" class="btn-sm ghost" data-fe="store">Cất</button><button type="button" class="btn-sm ghost" data-fe="desel">Xong</button></div>
      <div class="inventory"><div class="inv-row">${list.length ? list.map(i => { const left = (S.owned[i.id] || 0) - (counts[i.id] || 0);
        return `<button type="button" class="inv-item" data-fe-add="${i.id}" ${left <= 0 ? 'disabled' : ''} title="${esc(i.name)}"><img data-fe-thumb="${i.id}" alt="" width="56" height="56"><span>${esc(i.name)}</span><em>${left}</em></button>`; }).join('')
        : _t('<p class="hs-note" style="margin:6px 8px">Bạn chưa có đồ trang trí nông trại. Mua ở Cửa hàng, mục Nông trại nhé.</p>')}</div></div>`;
    panel.querySelectorAll('[data-fe-thumb]').forEach(im => { const u = c.thumb?.(im.dataset.feThumb); if (u) im.src = u; });
  }
  function startEdit() {
    if (c.getArea() !== 'garden' || edit) return;
    closeMenu(); edit = { items: structuredClone(S.farm), sel: -1, drag: null }; farmSig = '';
    c.setCam?.(new THREE.Vector3(0, 8.4, 14.5), new THREE.Vector3(0, 0, 0.4)); // lùi ra để thấy cả sân
    $('app').classList.add('farm-editing'); panel.hidden = false; buildFarm(edit.items); renderPanel(); updateRing();
    say(_t('Chạm đồ ở dưới để đặt vào sân nhé!'), 2600);
  }
  function stopEdit() { c.setCam?.(null, null); edit = null; panel.hidden = true; ring.visible = false; $('app').classList.remove('farm-editing'); farmSig = ''; syncFarm(); }
  function addItem(id) {
    let best = null;
    for (let x = -6.0; x <= 6.0; x += 0.5) for (let z = -3.5; z <= 4.9; z += 0.5) {
      const cand = { id, x, z, rot: 0 }; if (!farmValid([...edit.items, cand], edit.items.length)) continue;
      // ưu tiên chỗ nhìn thấy được ở góc nhìn thường (|x| ≤ 4, z ≤ 3,8), gần quanh thú, không quá gần thú
      const d = Math.max(0, Math.abs(x) - 4.0) * 3 + Math.max(0, z - 3.8) * 3 + Math.abs(z - 1.6) * 0.25 + (Math.hypot(x, z - 0.6) < 2.1 ? 1.5 : 0) + Math.abs(Math.abs(x) - 3.0) * 0.1;
      if (!best || d < best.d) best = { d, cand };
    }
    if (!best) { toast(_t('Sân hết chỗ trống rồi.')); return; }
    edit.items.push(best.cand); edit.sel = edit.items.length - 1;
    const g = c.buildDecor(id); placeMesh(g, best.cand); farmRoot.add(g); farmMeshes.push(g);
    sfx('place'); buzz(10); renderPanel(); updateRing();
  }
  function removeSel() { const i = edit.sel; if (i < 0) return; const g = farmMeshes.splice(i, 1)[0]; farmRoot.remove(g); g.traverse(o => o.geometry?.dispose()); edit.items.splice(i, 1); edit.sel = -1; sfx('ui'); renderPanel(); updateRing(); }
  panel.addEventListener('click', async e => {
    const add = e.target.closest('[data-fe-add]'), act = e.target.closest('[data-fe]'); if (!edit) return;
    if (add) { addItem(add.dataset.feAdd); return; }
    if (!act) return;
    const k = act.dataset.fe;
    if (k === 'rotate' && edit.sel >= 0) { const it = edit.items[edit.sel]; it.rot = (it.rot + 1) % 4; placeMesh(farmMeshes[edit.sel], it); sfx('ui'); }
    else if (k === 'store') removeSel();
    else if (k === 'desel') { edit.sel = -1; renderPanel(); updateRing(); }
    else if (k === 'cancel') { stopEdit(); }
    else if (k === 'save') {
      const bad = edit.items.findIndex((_, i) => !farmValid(edit.items, i));
      if (bad >= 0) { edit.sel = bad; renderPanel(); updateRing(); toast(_t('Có món đang đặt sai chỗ (vòng đỏ). Hãy dời đi nhé.')); return; }
      act.disabled = true; const err = await store.saveFarm(edit.items);
      if (err) { act.disabled = false; toast(viError(err)); return; }
      stopEdit(); sfx('coin'); toast(_t('Đã lưu nông trại!')); startAction('dance');
    }
  });
  /** Con trỏ khi đang trang trí nông trại: chọn món, kéo đi, thả (thả sai chỗ thì quay về chỗ cũ). */
  function editPointer(type, e) {
    if (!edit) return;
    const groundAt = () => { ray.setFromCamera(ndcFrom(e), camera); return ray.ray.intersectPlane(farmGround, farmHit) ? farmHit : null; };
    if (type === 'down') {
      ray.setFromCamera(ndcFrom(e), camera);
      const hit = ray.intersectObjects(farmMeshes, true)[0]; let idx = -1;
      if (hit) { let o = hit.object; while (o && !farmMeshes.includes(o)) o = o.parent; idx = farmMeshes.indexOf(o); }
      edit.sel = idx; edit.drag = idx >= 0 ? { i: idx, orig: { x: edit.items[idx].x, z: edit.items[idx].z }, x: e.clientX, y: e.clientY, moved: false } : null;
      if (idx >= 0) buzz(6);
      renderPanel(); updateRing();
    } else if (type === 'move' && edit.drag) {
      const d = edit.drag; if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true; if (!d.moved) return;
      const g = groundAt(); if (!g) return; const it = edit.items[d.i];
      it.x = Math.max(-6.5, Math.min(6.5, snap(g.x))); it.z = Math.max(-4.2, Math.min(5.2, snap(g.z))); placeMesh(farmMeshes[d.i], it); updateRing();
    } else if (type === 'up' && edit.drag) {
      const d = edit.drag; edit.drag = null; const it = edit.items[d.i];
      if (d.moved && !farmValid(edit.items, d.i)) { it.x = d.orig.x; it.z = d.orig.z; placeMesh(farmMeshes[d.i], it); toast(_t('Chỗ này không đặt được, món về chỗ cũ.')); buzz(20); }
      else if (d.moved) sfx('place');
      updateRing();
    }
  }

  /* ---------------- thanh chọn mảnh đất ---------------- */
  const bar = document.createElement('div'); bar.id = 'parcel-bar'; bar.className = 'parcel-bar'; bar.hidden = true; $('app').appendChild(bar);
  const dirtTints = ['#ffffff', '#ffdcae', '#cfe3ff'];
  function renderBar() {
    const ps = parcelsNow(), last = ps[ps.length - 1], canBuy = ps.length < PARCEL.max, full = last.level >= GARDEN_LAND.length - 1;
    bar.innerHTML = ps.map(p => _t`<button type="button" class="chip" data-parcel="${p.parcel}" aria-pressed="${p.parcel === parcel}">Mảnh ${p.parcel + 1} · ${p.size} ô</button>`).join('') +
      (canBuy ? _t`<button type="button" class="chip buy" data-buy-parcel ${full && S.coins >= PARCEL.prices[ps.length] ? '' : 'disabled'} title="${full ? '' : _t('Cần nâng cấp mảnh cuối lên đủ 9 ô')}">＋ Mua đất · ${PARCEL.prices[ps.length].toLocaleString('vi-VN')} xu</button>` : '');
  }
  function setParcel(k) {
    if (k === parcel || beds.some(b => b.busy)) return;
    parcel = k; closeMenu(); beds.forEach(b => { if (b.crop) removePlants(b); b.mound.visible = false; });
    dirtMat.color.set(dirtTints[k] || '#ffffff'); renderBar(); sync();
  }
  bar.addEventListener('click', async e => {
    const pk = e.target.closest('[data-parcel]'), by = e.target.closest('[data-buy-parcel]');
    if (pk) { setParcel(+pk.dataset.parcel); return; }
    if (!by) return;
    by.disabled = true; const res = await store.buyParcel();
    if ('error' in res) { toast(viError(res.error)); renderBar(); return; }
    sfx('buy'); buzz(14); toast(_t`Đã mua mảnh đất ${res.parcel + 1}!`); setParcel(res.parcel); startAction('dance');
  });

  /* ---------------- vòng lặp ---------------- */
  let tickAt = 0, sparkAt = 0;
  function update(dt, now) {
    for (let k = anims.length - 1; k >= 0; k--) {
      const a = anims[k]; a.t += dt; const p = clamp01(a.t / a.dur); a.fn(p, dt);
      if (p >= 1) { anims.splice(k, 1); a.done?.(); }
    }
    for (let k = drops.length - 1; k >= 0; k--) {
      const d = drops[k]; d.vy -= 5.5 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
      if (d.m.position.y < d.floor) { garden.remove(d.m); drops.splice(k, 1); }
    }
    beds.forEach(b => { b.soilMat.color.set(b.locked ? '#a6d48a' : b.dark > 0 ? (b.dark > 0.5 ? '#4a2c1a' : '#5e3a22') : '#7a4a2e'); });
    if (basketSq > 0) { basketSq = Math.max(0, basketSq - dt * 4); basket.scale.set(1 + 0.12 * basketSq, 1 - 0.18 * basketSq, 1 + 0.12 * basketSq); }
    bar.hidden = c.getArea() !== 'garden' || !!edit;
    if (c.getArea() !== 'garden') { if (!menu.hidden) closeMenu(); if (edit) stopEdit(); return; }
    syncFarm();
    if (edit && ring.visible) ring.scale.setScalar(1 + Math.sin(now / 160) * 0.06);
    if (now > tickAt) {
      tickAt = now + 250; sync();
      const key = parcelsNow().map(p => p.level).join() + '|' + parcel + '|' + (S.coins >= PARCEL.prices[1]);
      if (bar.dataset.k !== key) { bar.dataset.k = key; renderBar(); }
      if (!menu.hidden && now - menuAt > 4000) { menuAt = now; const i = menuPlot; menu.innerHTML = menuHtml(i); } // đếm ngược sống động
    }
    if (!reduce && now > sparkAt) { sparkAt = now + 1300; beds.forEach(b => { const p = plotOf(b.i); if (p && !b.busy && store.serverNow() >= Date.parse(p.ready_at)) spawnAt('sparkle', b.root.position.x + (Math.random() - 0.5) * 0.8, 0.8, b.root.position.z + 0.2, { vy: 0.45, max: 0.9, scale: 0.22 }); }); }
  }

  return { sync, tap, update, screenOf, closeMenu, startEdit, editing: () => !!edit, editPointer, minZ: () => workZ() - 0.25, workSpot: i => ({ x: beds[i].root.position.x, z: workZ() }) };
}
