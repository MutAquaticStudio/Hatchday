// Bộ dựng chung cho các địa điểm: điểm chạm (nhãn DOM + vật 3D), NPC dựng bằng khối, biển chữ, ghế dài, cây.
// Mỗi địa điểm nhận `c` (ngữ cảnh) từ game.js: { THREE, add, toon, canvasTex, shell, windowOn, scene, camera, canvas, ray, ndcFrom, walkPetTo, say, startAction, toast, sfx, spawn, hideHint, open }.
import { bakeStatic } from './world.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function makeKit(c, opts = {}) {
  const { THREE, add, toon, camera, canvas, ray, ndcFrom } = c;
  const hots = [], npcs = [];
  let layer = null, active = false;
  const v = new THREE.Vector3();

  function ensureLayer() {
    if (layer) return;
    layer = document.createElement('div'); layer.className = 'hot-layer'; layer.hidden = true;
    document.getElementById('app').appendChild(layer);
    layer.addEventListener('click', e => { const b = e.target.closest('[data-hot]'); if (b) activate(b.dataset.hot); });
  }
  /** def: { id, label, at:[x,y,z] vị trí nhãn, stand:[x,z] nơi thú đứng khi chạm, act() }. mesh: vật 3D bấm được (tuỳ chọn). */
  function hotspot(def, mesh) {
    ensureLayer();
    if (mesh) { mesh.traverse(o => { o.userData.hotspot = def.id; }); mesh.userData.hotRoot = def.id; def.mesh = mesh; }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'hot'; b.dataset.hot = def.id; b.setAttribute('aria-label', def.label); b.innerHTML = `<span class="hd"></span><span class="hl">${def.label}</span>`;
    layer.appendChild(b); def.el = b; hots.push(def); return def;
  }
  function activate(id) {
    const d = hots.find(h => h.id === id); if (!d || !active) return false;
    c.hideHint && c.hideHint();
    const go = d.stand ? c.walkPetTo(d.stand[0], d.stand[1]) : Promise.resolve(true);
    go.then(ok => { if (ok !== false && active) d.act(); });
    return true;
  }
  /** Chạm vào vật 3D của một điểm chạm? */
  function tap(e) {
    const objs = hots.map(h => h.mesh).filter(Boolean); if (!objs.length) return false;
    ray.setFromCamera(ndcFrom(e), camera);
    const hit = ray.intersectObjects(objs, true)[0]; if (!hit) return false;
    return activate(hit.object.userData.hotspot);
  }
  function show(on) { ensureLayer(); active = on; layer.hidden = !on; if (on) updateLabels(); }
  /** Đặt nhãn DOM theo toạ độ 3D, kẹp trong vùng nhìn thấy (trên điện thoại vật ở xa mép vẫn bấm được). */
  function updateLabels() {
    if (!active) return;
    camera.updateMatrixWorld(true);
    const r = canvas.getBoundingClientRect();
    for (const h of hots) {
      v.set(h.at[0], h.at[1], h.at[2]).project(camera);
      // nơi rộng: điểm chạm ở xa ngoài màn hình thì ẩn nhãn (gần mép thì vẫn kẹp vào để bấm được)
      if (opts.cull && (v.z > 1 || Math.abs(v.x) > 1.35 || v.y < -1.3 || v.y > 1.5)) { h.el.style.visibility = 'hidden'; continue; }
      const m = 64; // chừa chỗ cho nhãn chữ khi bung ra, để vị trí không nhảy lúc chấm biến thành nhãn
      const x = clamp((v.x + 1) / 2 * r.width, m, r.width - m), y = clamp((1 - v.y) / 2 * r.height, 112, r.height - 150);
      h.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`; h.el.style.visibility = 'visible'; // ẩn tới khi có vị trí đúng, không nháy ở góc trên
    }
    // Điểm chạm ở xa bé chỉ hiện chấm nhỏ (đỡ che thú của người khác); lại gần mới bung nhãn chữ gọn
    const [px, pz] = c.getPetXZ ? c.getPetXZ() : [0, 0];
    for (const h of hots) { const s = h.stand || [h.at[0], h.at[2]]; h.el.classList.toggle('near', Math.hypot(s[0] - px, s[1] - pz) < 2.6); }
  }
  let labelAt = 0;
  /** Nhãn DOM chỉ cần cập nhật ~30 lần/giây (đỡ tính chiếu và ghi style mỗi khung hình). */
  function tick(now) { const t = now / 1000; npcs.forEach(n => n.tick(t)); if (now - labelAt >= 33) { labelAt = now; updateLabels(); } }

  /** Nhân vật NPC tròn xinh. hat: nurse | doctor | chef | tailor | librarian | vendor | none. */
  function npc({ x, z, y = 0, color = '#ffd0dc', hat = 'none', ry = 0, s = 1, parent }) { // y: đứng trên bục sau quầy để lộ mặt
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(s); (parent || c.scene).add(g);
    const body = toon(color), dark = toon('#3b2a3a'), pink = toon('#ff9fbe'), white = toon('#ffffff');
    add(g, new THREE.SphereGeometry(0.46, 20, 16), body, 0, 0.46, 0, '#8a6a7a', 0.03);
    [-1, 1].forEach(sx => {
      add(g, new THREE.SphereGeometry(0.15, 10, 8), body, sx * 0.29, 0.98, 0, '#8a6a7a', 0.03);
      add(g, new THREE.SphereGeometry(0.052, 8, 8), dark, sx * 0.16, 0.6, 0.41, null);
      add(g, new THREE.SphereGeometry(0.07, 8, 8), pink, sx * 0.27, 0.5, 0.38, null);
      add(g, new THREE.SphereGeometry(0.1, 10, 8), body, sx * 0.22, 0.07, 0.2, '#8a6a7a', 0.03);
    });
    // tay, miệng cười, má hồng nhạt và tạp dề cho người bán/đầu bếp/thợ may
    [-1, 1].forEach(sx => { const arm = add(g, new THREE.SphereGeometry(0.11, 10, 8), body, sx * 0.44, 0.42, 0.12, '#8a6a7a', 0.025); arm.scale.set(0.8, 1.15, 0.8); });
    add(g, new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI), dark, 0, 0.53, 0.44, null).rotation.z = Math.PI;
    if (hat === 'vendor' || hat === 'chef' || hat === 'tailor') {
      const apron = add(g, new THREE.SphereGeometry(0.47, 18, 12, Math.PI / 2 - 0.9, 1.8, Math.PI * 0.52, Math.PI * 0.36), toon(hat === 'chef' ? '#ffffff' : hat === 'tailor' ? '#c9a6ff' : '#7edb72'), 0, 0.46, 0.005, null);
      add(g, new THREE.BoxGeometry(0.16, 0.08, 0.02), toon('#fff7ef'), 0, 0.3, 0.45, null); // túi tạp dề
    }
    if (hat === 'nurse') { add(g, new THREE.BoxGeometry(0.4, 0.16, 0.22), white, 0, 1.0, 0.08, '#c98', 0.02); add(g, new THREE.BoxGeometry(0.1, 0.03, 0.02), toon('#ff4d6d'), 0, 1.01, 0.2, null); add(g, new THREE.BoxGeometry(0.03, 0.1, 0.02), toon('#ff4d6d'), 0, 1.01, 0.2, null); }
    if (hat === 'doctor') { add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), toon('#cfd8e3'), 0, 0.92, 0.38, '#556', 0.02).rotation.x = Math.PI / 2; add(g, new THREE.BoxGeometry(0.62, 0.05, 0.05), toon('#6ab7ff'), 0, 0.68, 0.36, null); }
    if (hat === 'chef') add(g, new THREE.CylinderGeometry(0.2, 0.17, 0.34, 14), white, 0, 1.16, 0, '#bbb', 0.02);
    if (hat === 'tailor') add(g, new THREE.TorusGeometry(0.32, 0.03, 8, 24), toon('#ffd36e'), 0, 0.5, 0, null).rotation.x = Math.PI / 2;
    if (hat === 'librarian') [-1, 1].forEach(sx => add(g, new THREE.TorusGeometry(0.09, 0.016, 8, 16), toon('#6b4a3a'), sx * 0.16, 0.6, 0.43, null));
    if (hat === 'vendor') { add(g, new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20), toon('#f0c36b'), 0, 1.04, 0, '#a77', 0.02); add(g, new THREE.CylinderGeometry(0.17, 0.2, 0.14, 14), toon('#f0c36b'), 0, 1.12, 0, '#a77', 0.02); }
    bakeStatic(THREE, g); g.userData.keep = true; g.traverse(o => { if (o.isMesh) o.userData.noRecv = true; });
    const n = { group: g, tick: t => { g.position.y = y + Math.abs(Math.sin(t * 2 + x)) * 0.03; g.rotation.z = Math.sin(t * 1.4 + z) * 0.025; } };
    npcs.push(n); return n;
  }

  /** Biển chữ phẳng. */
  function sign(text, w, h, bg = '#fff7ef', fg = '#5a3a4a', px = 44) {
    const tex = c.canvasTex(256, Math.round(256 * h / w), (g, tw, th) => {
      g.fillStyle = bg; g.fillRect(0, 0, tw, th); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(5, 5, tw - 10, th - 10);
      g.fillStyle = fg; g.font = `800 ${px}px "Baloo 2", system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, tw / 2, th / 2 + 3);
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  }
  const bench = (parent, x, z, ry = 0, color = '#e8b47a') => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
    add(g, new THREE.BoxGeometry(1.4, 0.12, 0.45), toon(color), 0, 0.42, 0, '#9a5f4a', 0.03);
    add(g, new THREE.BoxGeometry(1.4, 0.4, 0.1), toon(color), 0, 0.72, -0.2, '#9a5f4a', 0.03);
    [-0.6, 0.6].forEach(sx => add(g, new THREE.BoxGeometry(0.1, 0.4, 0.4), toon('#b98a5e'), sx, 0.2, 0, '#9a5f4a', 0.02));
    // chi tiết: tay vịn hai đầu, hai khe ván ở lưng ghế, nẹp dưới mặt ngồi
    [-0.72, 0.72].forEach(sx => { add(g, new THREE.BoxGeometry(0.09, 0.07, 0.42), toon('#b98a5e'), sx, 0.62, -0.02, '#9a5f4a', 0.015); add(g, new THREE.BoxGeometry(0.07, 0.2, 0.07), toon('#b98a5e'), sx, 0.5, 0.17, '#9a5f4a', 0.01); });
    [0.66, 0.78].forEach(y => add(g, new THREE.BoxGeometry(1.36, 0.018, 0.04), toon('#9a5f4a'), 0, y, -0.145, null));
    add(g, new THREE.BoxGeometry(1.3, 0.05, 0.05), toon('#b98a5e'), 0, 0.33, 0.12, null);
    return g;
  };
  const plant = (parent, x, z, s = 1) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
    add(g, new THREE.CylinderGeometry(0.28, 0.22, 0.4, 14), toon('#e8a07a'), 0, 0.2, 0, '#9a5f4a', 0.03);
    [[0, 0.8, 0, 0.36], [-0.2, 0.62, 0.06, 0.26], [0.2, 0.66, -0.04, 0.28]].forEach(([px, py, pz, r]) => add(g, new THREE.SphereGeometry(r, 12, 10), toon('#7edb72'), px, py, pz, '#3f8a55', 0.03));
    return g;
  };
  return { hotspot, activate, tap, show, tick, updateLabels, npc, sign, bench, plant, hots };
}
