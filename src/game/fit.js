// Mặc đồ vừa với mọi dáng thú.
// Đồ trong decor3d.js được thiết kế cho thú tròn gốc; ở đây đổi chúng về "điểm neo" của từng ô
// rồi đặt lên ổ cắm đã đo trên thú thật (pet3d.measureSockets):
// - Đội đầu: thử nhiều vị trí (giữa đỉnh, nghiêng trái/phải, nghiêng trước, thu nhỏ) và chọn chỗ không đè tai/sừng/chỏm.
// - Kính: đặt đúng mặt phẳng mắt, sát bề mặt mặt.
// - Cổ: co giãn vòng theo tiết diện cổ đo được (x và z riêng).
// - Lưng: đặt lên mặt lưng thật (kể cả mai rùa, vỏ ốc), thú bốn chân thì đeo trên sống lưng.
// - Áo choàng: dựng lại theo kích thước cổ và thân.

/** Điểm neo của từng ô trên thú tròn gốc (khớp với toạ độ trong decor3d.js). */
const BASE = { crown: [0, 1.93, 0], face: [0, 1.16, 0.982], neck: [0, 0.6, 0.02], back: [0, 0.95, -1.0] };
/** Mũ ôm đầu: vành ở độ sâu `ringY` dưới đỉnh, bán kính vành `ringR` (theo thiết kế gốc). Tai, chỏm chui qua lỗ mũ. */
const WRAP = { 'mu-len': { ringY: 0.43, ringR: 0.64, gap: 0.05, cuffs: true }, 'vong-hoa': { ringY: 0.19, ringR: 0.56, gap: 0.04 } };
/** Đồ quàng cổ: bán kính vòng gốc (trục x đã giãn 1.08) và độ dày ống. */
const NECK = { 'khan-quang': { r: 0.88, tube: 0.1 }, chuong: { r: 0.88, tube: 0.045 }, 'khan-len': { r: 0.86, tube: 0.15 } };
/** Đồ đeo lưng: mặt trước của món cách tâm món bao nhiêu (để áp sát mặt lưng, không lún vào thân). */
const BACK = { balo: 0.16, canh: -0.05 };

export function makeFitter(THREE) {
  const v = new THREE.Vector3(), w = new THREE.Vector3();

  /** Các điểm mẫu (đỉnh lưới) của món đồ trong không gian của thú. */
  function samples(root, step = 3) {
    root.updateMatrixWorld(true);
    const pts = [];
    root.traverse(o => {
      if (!o.isMesh || o.userData.outline || o.userData.wrapAround) return;
      const pos = o.geometry.attributes.position; if (!pos) return;
      for (let i = 0; i < pos.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
    });
    return pts;
  }
  /** Mức đè lên vùng cấm (0 = không đè). */
  function overlap(pts, keepOut) {
    let worst = 0;
    for (const k of keepOut) {
      w.fromArray(k.c);
      for (const p of pts) { const d = k.r - p.distanceTo(w); if (d > worst) worst = d; }
    }
    return worst;
  }
  /** Mức lún vào trong đầu/thân (điểm nằm sâu hơn `inset` bên trong khối elip). */
  function sink(pts, E, inset = 0.86) {
    let worst = 0;
    for (const p of pts) {
      const x = (p.x - E.c[0]) / E.r[0], y = (p.y - E.c[1]) / E.r[1], z = (p.z - E.c[2]) / E.r[2];
      const q = Math.sqrt(x * x + y * y + z * z); if (q < inset) worst = Math.max(worst, inset - q);
    }
    return worst;
  }

  /** Đặt món đồ đội đầu: thử lần lượt các vị trí, lấy vị trí đầu tiên không đè. */
  function fitHead(outer, inner, sk) {
    inner.position.sub(v.fromArray(BASE.crown));
    const C = sk.crown, k = C.k;
    const at = (alpha, beta, s) => {
      // điểm trên mặt elip đầu, nghiêng alpha sang ngang và beta ra trước
      const x = Math.sin(alpha) * C.r[0], y = Math.cos(alpha) * Math.cos(beta) * C.r[1], z = Math.sin(beta) * C.r[2];
      outer.position.set(C.c[0] + x, C.c[1] + y, C.c[2] + z);
      outer.rotation.set(beta, 0, -alpha); outer.scale.setScalar(k * s);
    };
    const tries = [];
    const ring = s => tries.push([0, 0, s], [0.55, 0, s], [-0.55, 0, s], [0, 0.42, s], [0.85, 0, s * 0.85], [-0.85, 0, s * 0.85]);
    [1, 0.8, 0.62].forEach(ring);
    tries.push([0, -1.15, 0.85], [0, -1.15, 0.7]); // đeo sau gáy (như nón lá quàng dây sau lưng)
    [0.48, 0.38].forEach(ring);
    const run = ko => {
      let best = null;
      for (const t of tries) {
        at(...t);
        const o = overlap(samples(outer, 1), ko);
        if (o < 0.015) return { ok: true, t, o };
        if (!best || o < best.o) best = { ok: false, t, o };
      }
      return best;
    };
    let r = run(sk.keepOut);
    // không chỗ nào tránh được chỏm đầu (hoa, sao, kem…) → mũ che chỏm, giống tóc nằm dưới mũ. Tai/sừng thì không bao giờ ẩn.
    if (!r.ok && sk.keepOut.some(k => k.kind === 'top')) { const r2 = run(sk.keepOut.filter(k => k.kind !== 'top')); if (r2.ok) r = { ...r2, hideTop: true }; }
    at(...r.t);
    return r;
  }

  /** Mũ ôm đầu: co giãn theo tiết diện đầu ở độ cao vành, thêm viền lỗ tai cho tai chui qua. */
  function fitWrap(outer, inner, sk, spec) {
    inner.position.sub(v.fromArray(BASE.crown));
    const C = sk.crown, [rx, ry, rz] = C.r;
    const d = spec.ringY * ry / 0.95, t = (ry - d) / ry, f = Math.sqrt(Math.max(0, 1 - t * t));
    const sx = (rx * f + spec.gap) / spec.ringR, sz = (rz * f + spec.gap) / spec.ringR, sy = d / spec.ringY;
    outer.position.fromArray(C.p); outer.scale.set(sx, sy, sz);
    if (spec.cuffs) {
      const rim = inner.children.find(c => c.geometry?.type === 'TorusGeometry');
      for (const e of sk.ears) {
        if (e.p[1] < C.p[1] - d * 0.9) continue;
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(e.r, 0.05, 8, 20), rim ? rim.material : new THREE.MeshBasicMaterial({ color: '#fff' }));
        // vòng lỗ tai: đặt theo toạ độ của thú, nên bù lại phép co giãn của nhóm ngoài
        const holder = new THREE.Group(); holder.position.set((e.p[0] - C.p[0]) / sx, (e.p[1] - C.p[1]) / sy, (e.p[2] - C.p[2]) / sz); holder.scale.set(1 / sx, 1 / sy, 1 / sz);
        cuff.rotation.set(Math.PI / 2, 0, 0); const tilt = new THREE.Group(); tilt.rotation.z = e.rz; tilt.add(cuff); holder.add(tilt); outer.add(holder);
      }
    }
  }

  function fitFace(outer, inner, sk) {
    inner.position.sub(v.fromArray(BASE.face));
    const F = sk.face; outer.position.set(F.p[0], F.p[1], F.p[2] + 0.01); outer.scale.setScalar(F.k);
  }

  function fitNeck(outer, inner, sk, id) {
    inner.position.sub(v.fromArray(BASE.neck));
    const N = sk.neck, spec = NECK[id] || { r: 0.88, tube: 0.1 };
    const sy = Math.min(1, Math.max(0.6, (N.rx + N.rz) / 1.9));
    const sx = (N.rx + spec.tube * sy * 0.75) / (spec.r * 1.08), sz = (N.rz + spec.tube * sy * 0.75) / spec.r;
    outer.position.fromArray(N.p); outer.scale.set(sx, sy, sz); outer.rotation.x = N.tilt || 0;
  }

  function fitBack(outer, inner, sk, id) {
    inner.position.sub(v.fromArray(BASE.back)); inner.position.z -= BACK[id] ?? 0;
    const Bk = sk.back, k = Bk.k;
    outer.position.fromArray(Bk.p); outer.scale.setScalar(k);
    if (Bk.n[1] > 0.5) { outer.rotation.x = Math.PI / 2; outer.position.y += 0.02; }
    if (id === 'canh') {
      // cánh thiên thần: nhô cao hơn; nếu thú đã có cánh riêng thì lùi ra sau để không lồng vào nhau
      outer.position.y += (Bk.n[1] > 0.5 ? 0.05 : 0.22) * k;
      if (sk.ownWings) { if (Bk.n[1] > 0.5) outer.position.y += 0.18; else outer.position.z -= 0.22; }
    }
  }

  /** Áo choàng dựng lại theo cổ + thân. Thú bốn chân và loài thân dài: tấm choàng phủ dọc sống lưng. */
  function cape(sk, tex, grad) {
    const g = new THREE.Group();
    const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: grad, side: THREE.DoubleSide });
    if (sk.plan === 'thu4' || sk.plan === 'ran') {
      const Bd = sk.body, r = Math.max(Bd.r[0], Bd.r[1]) + 0.06;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, Bd.r[2] * 1.6, 24, 1, true, -Math.PI * 0.42, Math.PI * 0.84), mat);
      m.rotation.x = Math.PI / 2; m.rotation.y = Math.PI; m.position.fromArray(Bd.c); m.position.y += 0.02; g.add(m);
      return g;
    }
    const N = sk.neck, Bd = sk.body;
    const top = Math.max(N.rx, N.rz) + 0.05, bot = Math.max(Bd.r[0], Bd.r[2]) + 0.1;
    const h = Math.max(0.35, N.p[1] - Math.max(0.15, sk.bodyBottom + 0.05));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(top, bot, h, 24, 1, true, Math.PI * 0.6, Math.PI * 0.8), mat);
    m.position.set(0, N.p[1] - h / 2, (N.p[2] + Bd.c[2]) / 2); m.scale.z = Bd.r[2] / Math.max(Bd.r[0], 0.01) * 0.95 + 0.05;
    g.add(m);
    return g;
  }

  /**
   * Bọc món đồ `inner` (đã dựng bởi decor3d, toạ độ theo thú tròn gốc) và đặt vừa thú theo `sk` (ổ cắm).
   * Trả về nhóm ngoài để thêm vào pivot. `report` ghi kết quả kiểm tra (dùng cho test).
   */
  function fit(inner, item, sk) {
    const outer = new THREE.Group(); outer.userData.itemId = item.id;
    if (!sk) { outer.add(inner); return outer; }
    const cyl = item.id === 'ao-choang' && inner.children.find(c => c.geometry?.type === 'CylinderGeometry');
    if (cyl) {
      const knot = inner.children.find(c => c.geometry?.type === 'SphereGeometry');
      const c = cape(sk, cyl.material.map, cyl.material.gradientMap); outer.add(c);
      if (knot) { const N = sk.neck; knot.position.set(0, N.p[1] - 0.02, N.p[2] + N.rz + 0.04); outer.add(knot); }
      return outer;
    }
    outer.add(inner);
    if (inner.userData.flap) outer.userData.flap = inner.userData.flap;
    let res = { ok: true };
    if (item.slot === 'head' && WRAP[item.id]) fitWrap(outer, inner, sk, WRAP[item.id]);
    else if (item.slot === 'head') res = fitHead(outer, inner, sk);
    else if (item.slot === 'face') fitFace(outer, inner, sk);
    else if (item.slot === 'neck') fitNeck(outer, inner, sk, item.id);
    else if (item.slot === 'back') fitBack(outer, inner, sk, item.id);
    outer.userData.fit = res;
    return outer;
  }

  /** Kiểm tra một món đã đặt: đè vùng cấm (tai, sừng…) và lún vào đầu/thân. */
  function check(outer, item, sk) {
    const pts = samples(outer, 1);
    const E = item.slot === 'back' ? sk.body : sk.head;
    const ko = outer.userData.fit?.hideTop ? sk.keepOut.filter(k => k.kind !== 'top') : sk.keepOut;
    return { keepOut: item.slot === 'head' && !WRAP[item.id] ? overlap(pts, ko) : 0, sink: item.slot === 'face' || item.slot === 'head' ? sink(pts, sk.head) : item.slot === 'back' ? sink(pts, E, 0.8) : sink(pts, sk.head, 0.86) };
  }

  return { fit, check };
}
