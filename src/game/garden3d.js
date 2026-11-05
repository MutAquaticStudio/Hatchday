// Vườn rau 3D trong cảnh Vườn: 4 luống đất, cây lớn dần theo giờ thật, chạm vào luống để gieo hạt, tưới nước, hái rau.
// Mỗi thao tác có hoạt ảnh: hạt bay vào đất và nảy mầm, bình tưới nghiêng rót nước, rau bay vào giỏ.
// Dữ liệu thật (cây nào, chín lúc nào, số lần tưới) nằm ở server (get_garden, plant_crop, water_crop, harvest_crop); file này chỉ vẽ và gọi.
import { CROPS, FOOD_BY_ID, GARDEN_PLOTS, WATER } from './catalog';
import { FOOD_SVG } from './food.js';
import { viError } from '../lib/errors';
import { $, esc } from './dom.js';

const BED_X = [-2.25, -0.75, 0.75, 2.25], BED_Z = -2.7, TOP = 0.19; // luống nằm sau thảm cỏ của thú, trước hàng rào
const clamp01 = v => Math.max(0, Math.min(1, v));
const easeOutBack = p => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const easeInOut = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/** Hiện chữ "còn 2 giờ 10 phút". */
export function leftText(ms) { const m = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(m / 60); return h ? `còn ${h} giờ${m % 60 ? ' ' + (m % 60) + ' phút' : ''}` : `còn ${m} phút`; }

/**
 * `c`: { THREE, garden, toon, add, canvasTex, camera, canvas, ray, ndcFrom, spawnAt, popText, say, startAction, toast, sfx, buzz,
 *        reduce, getArea, petPos, store }. `store`: { S, plantCrop, waterCrop, harvestCrop, refreshGarden, serverNow }.
 * Trả về { sync, tap, update, screenOf, closeMenu }.
 */
export function initGarden3d(c) {
  const { THREE, garden, toon, add, canvasTex, camera, canvas, ray, ndcFrom, spawnAt, popText, say, startAction, toast, sfx, buzz, reduce, store } = c;
  const { S } = store;
  const D = reduce ? 0.01 : 1; // giảm chuyển động: gần như nhảy tới kết quả ngay
  const anims = [];
  const tween = (dur, fn, done) => anims.push({ t: 0, dur: Math.max(dur * D, 0.01), fn, done });
  const wait = (dur, done) => tween(dur, () => {}, done);

  /* ---------------- vật liệu và mô hình dùng chung ---------------- */
  const green = toon('#5fc46c'), green2 = toon('#7edb72'), brown = toon('#8a5a2e'), yellow = toon('#ffd95a'), orange = toon('#ff9a3c');
  const melonTex = canvasTex(64, 64, g => { g.fillStyle = '#4fae5a'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#2f7a3d'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 7, 64); });
  const OUT = '#3f6a3a';

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
  const beds = BED_X.slice(0, GARDEN_PLOTS).map((x, i) => {
    const root = new THREE.Group(); root.position.set(x, 0, BED_Z); garden.add(root);
    const wood = toon('#c98a5a');
    [[0, 0.5, 1.3, 0.05], [0, -0.5, 1.3, 0.05], [-0.62, 0, 0.05, 1.05], [0.62, 0, 0.05, 1.05]].forEach(([dx, dz, w, d]) => { const p = add(root, new THREE.BoxGeometry(w === 0.05 ? 0.1 : w, 0.2, d === 0.05 ? 0.1 : d), wood, dx, 0.1, dz, '#7a4a2a', 0.02); p.userData.plot = i; });
    const soilMat = toon('#7a4a2e'), soil = add(root, new THREE.BoxGeometry(1.16, 0.18, 0.94), soilMat, 0, 0.09, 0, '#4a2c1a', 0.02); soil.userData.plot = i;
    for (let k = -1; k <= 1; k++) { const f = add(root, new THREE.BoxGeometry(1.0, 0.02, 0.06), toon('#6a3e24'), 0, TOP, k * 0.28, null); f.userData.plot = i; }
    const mound = add(root, new THREE.SphereGeometry(0.2, 12, 8), toon('#6a3e24'), 0, TOP, 0, null); mound.scale.set(1.6, 0.35, 1); mound.visible = false;
    return { i, root, soil, soilMat, mound, plants: [], crop: '', busy: false, dark: 0 };
  });
  const plantXs = [-0.34, 0, 0.34];

  function removePlants(b) { b.plants.forEach(p => b.root.remove(p.root)); b.plants = []; b.crop = ''; }
  function addPlants(b, cropId) {
    removePlants(b); b.crop = cropId;
    plantXs.forEach((dx, k) => { const p = buildPlant(cropId); p.root.position.set(dx, TOP, (k - 1) * 0.04); p.root.rotation.y = k * 1.7; b.root.add(p.root); b.plants.push(p); });
  }
  /** Cỡ cây theo tiến độ 0–1: mầm nhỏ rồi lớn dần; chín thì hiện quả. */
  function applyGrowth(b, prog, ripe, t) {
    const s = 0.28 + 0.72 * clamp01(prog), seedOnly = prog < 0.1;
    b.mound.visible = seedOnly;
    b.plants.forEach((p, k) => {
      p.root.visible = !seedOnly;
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
      tween(0.9, p => { const s = 0.28 * easeOutBack(clamp01(p)); b.plants.forEach(pl => pl.root.scale.setScalar(Math.max(0.01, s))); }, () => { b.growing = false; b.busy = false; sync(); });
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
        b.busy = false; sync();
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
        removePlants(b); b.growing = false; b.busy = false; sync();
        popText(`+${got} ${FOOD_BY_ID[cropId].name}`, '#3f9a63'); startAction('dance');
      });
    });
  }

  /* ---------------- đồng bộ với dữ liệu server ---------------- */
  const plotOf = i => S.garden?.plots.find(p => p.plot === i);
  function sync() {
    if (!S.garden) return;
    const now = store.serverNow();
    beds.forEach(b => {
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
  let menuPlot = -1, menuAt = 0;
  const screenOf = (i, y = 0.4) => { const b = beds[i], v = new THREE.Vector3(b.root.position.x, y, b.root.position.z).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; };
  function closeMenu() { menu.hidden = true; menuPlot = -1; }
  function menuHtml(i) {
    const p = plotOf(i), now = store.serverNow();
    if (!p) return `<h3>Ô đất ${i + 1}</h3><p class="pm-note">Chọn cây để gieo hạt</p><div class="pm-crops">${CROPS.map(cr => `<button type="button" class="pm-crop" data-plant="${cr.id}" ${S.coins >= cr.seed ? '' : 'disabled'}>${FOOD_SVG[cr.id]}<b>${esc(FOOD_BY_ID[cr.id].name)}</b><small>${cr.seed} xu · ${cr.hours} giờ</small></button>`).join('')}</div>`;
    const cr = CROPS.find(x => x.id === p.crop), ready = Date.parse(p.ready_at), name = FOOD_BY_ID[p.crop].name;
    if (now >= ready) return `<h3>${esc(name)} chín rồi!</h3><p class="pm-note">Hái được ${cr.yield} phần</p><button type="button" class="btn-sm" data-harvest>Hái rau +${cr.yield}</button>`;
    const planted = Date.parse(p.planted_at), pct = clamp01((now - planted) / Math.max(1, ready - planted)) * 100;
    const why = p.waters >= WATER.max ? 'Đã tưới đủ 3 lần' : !p.can_water ? 'Vừa tưới xong, đợi một lát' : `Mỗi lần tưới rút ngắn ${Math.round(WATER.cut * 100)}% thời gian`;
    return `<h3>${esc(name)}</h3><div class="bar-track"><i style="width:${Math.max(4, pct)}%"></i></div><p class="pm-note">${leftText(ready - now)}</p>
      <button type="button" class="btn-sm" data-water ${p.can_water ? '' : 'disabled'}>Tưới nước (${p.waters}/${WATER.max})</button><p class="pm-note">${why}</p>`;
  }
  function openMenu(i) {
    menuPlot = i; menuAt = performance.now(); menu.innerHTML = menuHtml(i); menu.hidden = false;
    const pt = screenOf(i, 0.9), r = $('app').getBoundingClientRect(), w = menu.offsetWidth || 220;
    menu.style.left = `${Math.max(8, Math.min(r.width - w - 8, pt.x - r.left - w / 2))}px`;
    menu.style.top = `${Math.max(70, pt.y - r.top - (menu.offsetHeight || 150) - 10)}px`;
  }
  menu.addEventListener('click', async e => {
    const i = menuPlot; if (i < 0) return;
    const pl = e.target.closest('[data-plant]'), wt = e.target.closest('[data-water]'), hv = e.target.closest('[data-harvest]'), b = beds[i];
    if (!pl && !wt && !hv) return;
    closeMenu(); if (b.busy) return; b.busy = true; // chặn đồng bộ chen vào trong lúc gọi server
    if (pl) {
      const err = await store.plantCrop(i, pl.dataset.plant);
      if (err) { b.busy = false; toast(viError(err)); return; }
      b.busy = false; animPlant(b, pl.dataset.plant); toast(`Đã gieo ${FOOD_BY_ID[pl.dataset.plant].name}.`);
    } else if (wt) {
      const err = await store.waterCrop(i);
      if (err) { b.busy = false; toast(viError(err)); return; }
      b.busy = false; animWater(b); say('Mát quá, cây lớn nhanh nhé!', 2200);
    } else {
      const res = await store.harvestCrop(i);
      if ('error' in res) { b.busy = false; toast(viError(res.error)); return; }
      b.busy = false; animHarvest(b, res.item, res.got);
    }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); e.stopImmediatePropagation(); } }, true);

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
    beds.forEach(b => { b.soilMat.color.set(b.dark > 0 ? (b.dark > 0.5 ? '#4a2c1a' : '#5e3a22') : '#7a4a2e'); });
    if (basketSq > 0) { basketSq = Math.max(0, basketSq - dt * 4); basket.scale.set(1 + 0.12 * basketSq, 1 - 0.18 * basketSq, 1 + 0.12 * basketSq); }
    if (c.getArea() !== 'garden') { if (!menu.hidden) closeMenu(); return; }
    if (now > tickAt) {
      tickAt = now + 250; sync();
      if (!menu.hidden && now - menuAt > 4000) { menuAt = now; const i = menuPlot; menu.innerHTML = menuHtml(i); } // đếm ngược sống động
    }
    if (!reduce && now > sparkAt) { sparkAt = now + 1300; beds.forEach(b => { const p = plotOf(b.i); if (p && !b.busy && store.serverNow() >= Date.parse(p.ready_at)) spawnAt('sparkle', b.root.position.x + (Math.random() - 0.5) * 0.8, 0.8, b.root.position.z + 0.2, { vy: 0.45, max: 0.9, scale: 0.22 }); }); }
  }

  return { sync, tap, update, screenOf, closeMenu };
}
