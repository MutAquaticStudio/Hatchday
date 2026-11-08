// Khuôn mặt của thú: vẽ lên canvas 2D rồi dán lên quả cầu đầu. Biểu cảm (EXPR) và vẽ mặt (drawFace) nằm ở đây.
// Muốn thêm biểu cảm mới: thêm vào EXPR; muốn thêm kiểu mắt/miệng: thêm hàm vẽ rồi nối vào drawFace/mouth.
import { _t } from '../i18n';

export function makeFace({ THREE, renderer }) {
  const FW = 600, FH = 496;
  const fc = document.createElement('canvas'); fc.width = FW; fc.height = FH;
  const fx = fc.getContext('2d');
  const faceTex = new THREE.CanvasTexture(fc); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const faceGeo = new THREE.SphereGeometry(1.006, 64, 40, Math.PI / 2 - 0.75, 1.5, Math.PI / 2 - 0.78, 1.24);
  const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));

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
    vui:      { label: _t('Vui'),        eyes: 'open',  mouth: 'w',      blush: .45, msg: _t('đang vui') },
    excited:  { label: _t('Phấn khích'), eyes: 'star',  mouth: 'open',   blush: .7,  fx: 'sparkle', msg: _t('phấn khích quá!') },
    hungry:   { label: _t('Đói'),        eyes: 'open',  lookY: -12, mouth: 'o', blush: .3, drool: true, msg: _t('hơi đói') },
    sleepy:   { label: _t('Buồn ngủ'),   eyes: 'open',  lid: .58, mouth: 'line', blush: .25, msg: _t('buồn ngủ rồi') },
    sleep:    { label: _t('Ngủ'),        eyes: 'sleep', mouth: 'smallo', blush: .35, fx: 'zzz', msg: _t('đang ngủ') },
    sick:     { label: _t('Ốm'),         eyes: 'swirl', mouth: 'wavy',   blush: 0, cold: true, gloom: true, fx: 'sweat', msg: _t('bị cảm lạnh') },
    sulky:    { label: _t('Dỗi'),        eyes: 'open',  lid: .36, lidCurve: -6, brows: 'angry', mouth: 'pout', blush: .65, fx: 'anger', msg: _t('đang dỗi') },
    sad:      { label: _t('Buồn'),       eyes: 'open',  tears: true, brows: 'sad', mouth: 'frown', blush: .2, msg: _t('hơi buồn') },
    love:     { label: _t('Âu yếm'),     eyes: 'happy', mouth: 'open',   blush: .9, fx: 'heart', msg: _t('thích được vuốt ve') },
    yawn:     { label: _t('Ngáp'),       eyes: 'squeeze', mouth: 'open', blush: .3, msg: _t('đang ngáp') },
    chew:     { label: 'Nhai',       eyes: 'happy', mouth: 'chew',   blush: .5, msg: _t('đang nhai nhóp nhép') },
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

  return { face, EXPR, drawFace };
}
