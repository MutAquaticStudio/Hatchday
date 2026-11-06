// Hiệu ứng thời tiết ngoài trời: mưa (vạch rơi + giọt bắn), cánh hoa/lá rơi. Dựng một lần, chỉ chạy khi cần.
// Nằm quanh điểm bám (thú) nên không phụ thuộc cỡ bản đồ; số hạt theo chất lượng đồ hoạ; giảm chuyển động thì không vẽ hạt rơi.

/** Đưa toạ độ v về trong [c - span/2, c + span/2). */
const wrap = (v, c, span) => v - Math.floor((v - c + span / 2) / span) * span;

export function makeWeatherFx({ THREE, scene, canvasTex, reduce }) {
  const RAIN = 260, FALL = 36, W = 14, D = 9, H = 7;
  const rain = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#d6ecff', transparent: true, opacity: 0.55, depthWrite: false }));
  const rpos = new Float32Array(RAIN * 6), rvel = new Float32Array(RAIN);
  for (let i = 0; i < RAIN; i++) { rpos[i * 6] = (Math.random() - 0.5) * W; rpos[i * 6 + 1] = Math.random() * H; rpos[i * 6 + 2] = (Math.random() - 0.5) * D; rvel[i] = 9 + Math.random() * 4; }
  rain.geometry.setAttribute('position', new THREE.BufferAttribute(rpos, 3)); rain.frustumCulled = false; rain.visible = false; scene.add(rain);

  const tex = {
    petal: canvasTex(32, 32, g => { g.fillStyle = '#ffb3cf'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.ellipse(16, 16, 11, 6, 0.6, 0, 7); g.fill(); g.stroke(); }),
    leaf: canvasTex(32, 32, g => { g.fillStyle = '#f0a04b'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(5, 16); g.quadraticCurveTo(16, 2, 27, 16); g.quadraticCurveTo(16, 30, 5, 16); g.fill(); g.stroke(); g.strokeStyle = '#b86a1c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(5, 16); g.lineTo(27, 16); g.stroke(); }),
  };
  const fall = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.32, map: tex.petal, transparent: true, depthWrite: false, alphaTest: 0.05, sizeAttenuation: true }));
  const fpos = new Float32Array(FALL * 3), fph = new Float32Array(FALL), fvel = new Float32Array(FALL);
  for (let i = 0; i < FALL; i++) { fpos[i * 3] = (Math.random() - 0.5) * W; fpos[i * 3 + 1] = Math.random() * H; fpos[i * 3 + 2] = (Math.random() - 0.5) * D; fph[i] = Math.random() * 6.28; fvel[i] = 0.5 + Math.random() * 0.5; }
  fall.geometry.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); fall.frustumCulled = false; fall.visible = false; scene.add(fall);
  let fallKind = null, rainDrops = 0, splashAt = 0;

  return {
    /** sky: 'clear'|'cloudy'|'rain'; amount 0–1; kind: 'petal'|'leaf'|null; density 0–1 theo chất lượng; (cx, cz): tâm vùng hạt (vị trí thú). splash(x, z) gọi để tạo giọt bắn dưới đất. */
    update(dt, { sky, amount, kind, density, cx, cz, outdoors, splash }) {
      const showRain = outdoors && sky === 'rain' && !reduce, showFall = outdoors && sky !== 'rain' && !!kind && !reduce;
      rain.visible = showRain; fall.visible = showFall;
      if (showRain) {
        rainDrops = Math.round(RAIN * (0.35 + 0.65 * amount) * density); rain.geometry.setDrawRange(0, rainDrops * 2);
        for (let i = 0; i < rainDrops; i++) {
          const y = rpos[i * 6 + 1] - rvel[i] * dt, k = i * 6;
          rpos[k] = wrap(rpos[k], cx, W); rpos[k + 2] = wrap(rpos[k + 2], cz + 1, D); // hạt nằm cố định trong thế giới, chỉ quấn lại quanh người xem
          if (y < 0) { rpos[k] = cx + (Math.random() - 0.5) * W; rpos[k + 2] = cz + 1 + (Math.random() - 0.5) * D; rpos[k + 1] = H; if (splash && Math.random() < 0.18) splash(rpos[k], rpos[k + 2]); }
          else rpos[k + 1] = y;
          rpos[k + 3] = rpos[k] - 0.05; rpos[k + 4] = rpos[k + 1] + 0.42; rpos[k + 5] = rpos[k + 2];
        }
        rain.geometry.attributes.position.needsUpdate = true;
      }
      if (showFall) {
        if (kind !== fallKind) { fallKind = kind; fall.material.map = tex[kind]; fall.material.needsUpdate = true; }
        const n = Math.max(6, Math.round(FALL * density)); fall.geometry.setDrawRange(0, n);
        const t = performance.now() / 1000;
        for (let i = 0; i < n; i++) {
          const k = i * 3; fpos[k] = wrap(fpos[k], cx, W); fpos[k + 2] = wrap(fpos[k + 2], cz + 1, D); fpos[k + 1] -= fvel[i] * dt * (kind === 'leaf' ? 0.9 : 0.6); fpos[k] += Math.sin(t * 1.3 + fph[i]) * dt * 0.7; fpos[k + 2] += Math.cos(t * 0.9 + fph[i]) * dt * 0.3;
          if (fpos[k + 1] < 0) { fpos[k + 1] = H; fpos[k] = cx + (Math.random() - 0.5) * W; fpos[k + 2] = cz + 1 + (Math.random() - 0.5) * D; }
        }
        fall.geometry.attributes.position.needsUpdate = true;
      }
    },
    /** Cho kiểm tra: hạt nào đang hiện. */
    state: () => ({ rain: rain.visible, fall: fall.visible }),
    dispose() { scene.remove(rain, fall); rain.geometry.dispose(); fall.geometry.dispose(); },
  };
}
