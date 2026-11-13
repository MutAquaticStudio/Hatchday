// Đấu trường giao hữu: trận đánh theo lượt kiểu game sưu tầm quái thú cổ điển, trên sân đấu 3D (battle-stage.js) với hiệu ứng
// chiêu thức (battle-fx.js). Luật ở battle.ts / skills.ts. Máy chủ (migration arena) chọn đối thủ, sân, hạt giống và phát thưởng.
// Sảnh: thành tích, đá nâng cấp, ba chế độ (Đấu tập với máy, Xếp hạng với quái thú của người chơi khác, Thách đấu bạn bè), bảng xếp hạng.
// Đối thủ là người chơi thì quái thú của họ do máy điều khiển (đấu bất đồng bộ); thua không mất gì ngoài điểm xếp hạng.
// Nhịp một lượt: chọn chiêu → bên nhanh hơn ra đòn trước → lời dẫn "X dùng Y!" → hiệu ứng → số sát thương → khắc hệ / chí mạng /
// trạng thái → cuối lượt (bỏng, hồi dần) → lượt mới. Chạm vào hộp lời thoại để đọc nhanh; nút ×2 tua nhanh cả hiệu ứng.
// Sổ khắc hệ: mỗi cặp hệ chỉ hiện hiệu quả trên nút chiêu sau khi người chơi đã gặp trong trận (lưu trên máy).
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { _t } from '../i18n';
import { SPECIES, SPECIES_BY_ID } from './species';
import { ELEMENT_NAMES, KIND_NAMES, STATUS_INFO, elementMult, moveDesc, movesOf } from './skills';
import { recipeOf, moveDuration } from './move-fx';
import { endTurn, fighterOf, pickMove, rngOf, useMove, UPGRADES, UPGRADE_MAX, HEAL, HEAL_DECAY } from './battle';
import { rankName } from './arena';
import { arenaFinish, arenaStart, buyUpgrade, getArenaState, listFriends } from '../data/api';
import { viError } from '../lib/errors';
import { bondLevel } from './bond';
import { sfx, battleMusic, setBattleIntensity } from './audio.js';
import { makeStageKit, ARENAS } from './battle-stage.js';
import { makeFx, ELEMENT_FX } from './battle-fx.js';

const JOURNAL = 'hatchday-matchups', SPEEDK = 'hatchday-battle-speed';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } } };
const MULT_TXT = m => (m >= 1.2 ? _t('Rất hiệu quả') : m > 1 ? _t('Hiệu quả') : m === 1 ? _t('Bình thường') : m >= 0.9 ? _t('Kém') : _t('Rất kém'));
const MULT_MSG = m => (m >= 1.2 ? _t('Rất hiệu quả!') : m > 1 ? _t('Khá hiệu quả.') : m >= 0.9 ? _t('Không hiệu quả lắm…') : _t('Bị khắc chế!'));

export function initArena({ ctx, closeAll, getS }) {
  const { THREE } = ctx, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const devFast = /[?&]battlefast\b/.test(location.search);
  let R = null, B = null;

  /* ---------- máy quay ---------- */
  function makeCam(camera) {
    const c = { pos: V(), look: V(), tPos: V(), tLook: V(), fov: 38, tFov: 38, k: 3, trauma: 0 };
    const portrait = () => R.h > R.w * 1.05;
    c.shot = (name, s) => {
      c.k = 3;
      if (name === 'wide') { if (portrait()) { c.tPos.set(-3.6, 5.6, 13.5); c.tLook.set(-0.3, 0.95, -0.4); c.tFov = 50; } else { c.tPos.set(-5.4, 3.2, 9.2); c.tLook.set(0.55, 1.05, -1.0); c.tFov = 32; }
        // quái thú to (đuôi dài, cánh rộng) thì lùi máy quay cho cả hai lọt khung
        if (B?.mine && B?.theirs) { const big = Math.min(1.6, Math.max(1, Math.max(B.mine.h, B.theirs.h, B.mine.r * 2.4, B.theirs.r * 2.4) / 1.7)); c.tPos.sub(c.tLook).multiplyScalar(big).add(c.tLook); } }
      // biến thể của cảnh rộng (docs/VFX-STYLE-GUIDE.md §4): duel đẩy vào khi lấy đà tuyệt chiêu, sky lùi và ngước lên cho chiêu từ trời,
      // target nghiêng về phía người trúng đòn ở dư âm của chiêu tối thượng
      if (name === 'duel' || name === 'sky' || name === 'target') { c.shot('wide'); c.k = name === 'duel' ? 2.2 : 2.6;
        if (name === 'duel') { c.tPos.lerp(c.tLook, 0.12); c.tPos.y -= 0.3; }
        if (name === 'sky') { c.tPos.sub(c.tLook).multiplyScalar(1.1).add(c.tLook); c.tLook.y += 0.9; c.tFov += 4; }
        if (name === 'target' && s) { c.tLook.lerp(s.center(), 0.35); c.tPos.lerp(s.pos, 0.12); c.tPos.y += 0.2; } }
      if (name === 'intro') { c.pos.set(7.5, 6.2, 10); c.look.set(0, 1, 0); c.tPos.copy(c.pos); c.tLook.copy(c.look); c.fov = c.tFov = 44; }
      if (name === 'attacker' || name === 'win') { const right = V().crossVectors(s.dir, V(0, 1, 0)).normalize(), d = name === 'win' ? Math.max(3.4, s.r * 2.6 + s.h * 0.9) : Math.max(2.7, s.r * 2 + s.h * 0.6); c.tPos.copy(s.pos).addScaledVector(s.dir, d).addScaledVector(right, 1.1).add(V(0, s.h * 0.75, 0)); c.tLook.copy(s.center()); c.tFov = portrait() ? 50 : 38; c.k = name === 'win' ? 1.6 : 5; }
    };
    c.slow = k => { c.k = k; };
    /** Giật ống kính khi trúng đòn mạnh: thu hẹp góc nhìn trong chớp mắt rồi trả về. */
    c.punch = k => { if (!fx().reduce) c.fov -= 5 * k; };
    c.shake = k => { if (!fx().reduce) c.trauma = Math.min(1, c.trauma + k); };
    c.update = dt => {
      const f = 1 - Math.exp(-dt * c.k); c.pos.lerp(c.tPos, f); c.look.lerp(c.tLook, f); c.fov += (c.tFov - c.fov) * f;
      c.trauma = Math.max(0, c.trauma - dt * 1.8); const s = c.trauma * c.trauma * 0.22;
      camera.position.copy(c.pos).add(V((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s)); camera.lookAt(c.look);
      if (Math.abs(camera.fov - c.fov) > 0.01) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
    };
    return c;
  }
  const fx = () => R.fx;

  /* ---------- dựng khung một lần ---------- */
  function ensure() {
    if (R) return R;
    const root = document.createElement('div'); root.id = 'battle'; root.className = 'bt'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', _t('Đấu trường'));
    root.innerHTML = `<canvas class="bt-cv" aria-hidden="true"></canvas><div class="bt-dark"></div><div class="bt-lines"></div><div class="bt-bars" aria-hidden="true"><i></i><i></i></div><div class="bt-cutin" aria-hidden="true"><b></b></div><div class="bt-flash"></div><div class="bt-pops" aria-hidden="true"></div>
      <div class="bt-plate foe" data-p="1"></div><div class="bt-plate mine" data-p="0"></div><div class="bt-field"></div>
      <div class="bt-panel"><div class="bt-msg" aria-live="polite"><p class="bt-text"></p><span class="bt-more" aria-hidden="true">▾</span></div>
        <div class="bt-cmds" hidden><div class="bt-moves"></div><div class="bt-side"><button type="button" class="bt-btn" data-bt="chart">📖 ${_t('Sổ khắc hệ')}</button><button type="button" class="bt-btn" data-bt="speed"></button><button type="button" class="bt-btn" data-bt="run">${_t('Rời trận')}</button></div></div></div>
      <div class="bt-chart" hidden></div><div class="bt-result" hidden></div><div class="bt-lobby" hidden></div>`;
    (document.getElementById('app') || document.body).appendChild(root);
    // tầng chất lượng (Cài đặt): Thấp = không bóng, không bloom, không khử răng cưa; Vừa = bóng 1024, MSAA 2; Cao = bóng 2048, MSAA 4
    const q = s => root.querySelector(s), canvas = q('.bt-cv'), tier = store.get('hatchday-quality', 'vua'), low = tier === 'thap', high = tier === 'cao';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = !low; renderer.shadowMap.type = THREE.PCFShadowMap;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: low ? 0 : high ? 4 : 2 }));
    composer.addPass(new RenderPass(scene, camera)); const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.45, 0.45, 1.25); if (!low) composer.addPass(bloom); composer.addPass(new OutputPass());
    const kit = makeStageKit(THREE);
    R = { root, q, renderer, scene, camera, composer, bloom, kit, stages: new Map(), w: 1, h: 1, low, high, open: false, t: 0, last: 0, speed: +store.get(SPEEDK, '1') || 1, msg: null, journal: new Set(JSON.parse(store.get(JOURNAL, '[]'))) };
    R.cam = makeCam(camera);
    const ui = {
      /** Chớp toàn màn hình, có trần an toàn nhạy sáng: độ đậm ≤ 0,35 (giảm chuyển động ≤ 0,1), dài ≤ 0,2 s, cách nhau ≥ 0,34 s (≤ 3 lần/giây). */
      flash(color, a, dur) { const now = performance.now(); if (now - (R.flashAt || -1e9) < 340) return; R.flashAt = now; const el = q('.bt-flash'); el.style.transition = 'none'; el.style.background = color; el.style.opacity = String(Math.min(fx().reduce ? 0.1 : 0.35, a)); void el.offsetWidth; el.style.transition = `opacity ${Math.min(0.2, dur) / fx().timeScale}s ease-out`; el.style.opacity = '0'; },
      darken(k) { q('.bt-dark').style.opacity = String(k); },
      /** Khung hình va chạm kiểu anime: đảo màu thật ngắn (chiêu tối thượng, chí mạng). */
      impactFrame(sec) { const now = performance.now(); if (fx().reduce || now - (R.ifAt || -1e9) < 600) return; R.ifAt = R.flashAt = now; root.classList.add('impact'); setTimeout(() => root.classList.remove('impact'), Math.min(0.1, sec) * 1000); },
      /** Cắt cảnh chiêu tối thượng: hai thanh điện ảnh trượt vào và tên chiêu lướt ngang trong `sec` giây (đồng hồ trận). */
      cutin(name, color, sec) { const el = q('.bt-cutin'); el.querySelector('b').textContent = name; root.style.setProperty('--cc', color); root.style.setProperty('--cd', (sec / fx().timeScale).toFixed(2) + 's'); root.classList.remove('cutin'); void el.offsetWidth; root.classList.add('cutin', 'bars'); clearTimeout(R.cutT); R.cutT = setTimeout(() => root.classList.remove('cutin'), sec / fx().timeScale * 1000); },
      cutout() { root.classList.remove('bars', 'cutin'); },
      /** Đường tốc độ toả ra từ tâm màn hình, màu theo hệ. */
      lines(color, sec) { const el = q('.bt-lines'); el.style.setProperty('--lc', color); el.style.transition = 'none'; el.style.opacity = '0.9'; void el.offsetWidth; el.style.transition = `opacity ${sec / fx().timeScale}s ease-in`; el.style.opacity = '0'; },
    };
    R.fx = makeFx(THREE, scene, { kit, cam: R.cam, ui, sfx, quality: tier, camQuat: () => camera.quaternion, get ground() { return B?.stage.ground ?? 0.35; }, stage: { setGlow: k => B?.stage.setGlow(k) }, camPos: () => camera.position, side: () => V().setFromMatrixColumn(camera.matrixWorld, 0) });
    R.fx.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => { const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight; R.w = w; R.h = h; const pr = Math.min(devicePixelRatio || 1, low ? 1 : high ? 1.5 : 1.25); renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); if (B && !B.intro) R.cam.shot('wide'); };
    R.resize = resize; addEventListener('resize', () => { if (R.open) resize(); });
    // chạm hộp lời thoại: hiện hết chữ / sang câu tiếp
    q('.bt-msg').addEventListener('click', advance);
    // bảng thông tin của mình luôn nằm ngay trên khung lệnh (khung cao thấp tuỳ đang chọn chiêu hay đang đọc lời dẫn)
    new ResizeObserver(() => root.style.setProperty('--bt-panel', q('.bt-panel').offsetHeight + 'px')).observe(q('.bt-panel'));
    root.addEventListener('click', onClick);
    addEventListener('keydown', onKey, true);
    return R;
  }

  /* ---------- lời thoại chạy chữ ---------- */
  function say(text, hold = 0.55) {
    if (devFast) hold = Math.min(hold, 0.05);
    if (R.msg?.res) R.msg.res();
    return new Promise(res => { R.msg = { full: text, shown: 0, hold, res }; R.q('.bt-more').hidden = true; });
  }
  function advance() { const m = R.msg; if (!m) return; if (m.shown < m.full.length) m.shown = m.full.length; else m.hold = 0; }
  function stepMsg(dt) {
    const m = R.msg; if (!m) return;
    if (m.shown < m.full.length) { m.shown = Math.min(m.full.length, devFast ? m.full.length : m.shown + dt * 75); R.q('.bt-text').textContent = m.full.slice(0, Math.ceil(m.shown)); return; }
    R.q('.bt-text').textContent = m.full; if (!m.res) return;
    R.q('.bt-more').hidden = m.hold <= 0.01; m.hold -= dt; if (m.hold <= 0) { const r = m.res; m.res = null; r(); }
  }

  /* ---------- quái thú trên sân ---------- */
  function makeSlot(pos, other) {
    const s = { pos, off: V(), sq: 0, k: 0, tilt: 0, shake: 0, h: 1.4, r: 0.6, wrap: new THREE.Group(), body: new THREE.Group(), parts: null, phase: Math.random() * 6 };
    s.dir = other.clone().sub(pos).setY(0).normalize(); s.wrap.add(s.body); s.wrap.rotation.order = 'YXZ'; s.lean = 0; s.spin = 0;
    s.center = () => s.pos.clone().add(s.off).add(V(0, s.h * 0.5 * Math.max(0.2, s.k), 0));
    s.head = () => s.pos.clone().add(s.off).add(V(0, s.h * 0.92 * Math.max(0.2, s.k), 0));
    s.mouth = () => s.pos.clone().add(s.off).addScaledVector(s.dir, s.r * 0.9).add(V(0, s.h * 0.7, 0));
    return s;
  }
  function buildMonster(s, look) {
    s.parts = ctx.petBuilder.build(s.body, { ...look, face: true, lod: !!look.lod });
    s.body.traverse(o => { if (o.isMesh && !o.userData.outline && !o.material?.transparent) o.castShadow = true; });
    s.body.scale.setScalar(s.base = s.pos.z > 0 ? 1.0 : 1.15); s.body.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(s.body), sz = b.getSize(V()); s.h = Math.max(0.8, sz.y); s.r = Math.max(0.45, Math.min(1.1, Math.max(sz.x, sz.z) * 0.32));
  }
  function stepSlot(s, t) {
    const j = s.shake ? V((Math.random() - 0.5) * s.shake, 0, (Math.random() - 0.5) * s.shake) : V();
    s.wrap.position.copy(s.pos).add(s.off).add(j); s.wrap.rotation.set(s.lean || 0, Math.atan2(s.dir.x, s.dir.z) + (s.spin || 0), s.tilt); // ngả người (lấy đà, lao tới) và xoay (bị lốc cuốn)
    s.wrap.scale.set(s.k * (1 - s.sq * 0.5), s.k * (1 + s.sq), s.k * (1 - s.sq * 0.5)); s.sq *= 0.9;
    s.body.position.y = Math.sin(t * 2.2 + s.phase) * 0.025; s.body.scale.y = s.base * (1 + Math.sin(t * 2.2 + s.phase) * 0.012);
    if (s.parts) ctx.petBuilder.animate(s.parts, t, false);
  }

  /* ---------- bảng thông tin hai bên ---------- */
  function plate(i) {
    const F = i ? B.foe : B.me, who = i ? B.theirs : B.mine, el = F.element, E = ELEMENT_FX[el];
    R.q(`.bt-plate[data-p="${i}"]`).innerHTML = `<div class="bt-name"><b>${esc(who.name)}</b><span class="bt-el" style="--el:${E.c}">${E.icon} ${ELEMENT_NAMES[el]}</span><span class="bt-lv">${who.rating ? '🏆 ' + who.rating : _t('Gắn bó') + ' ' + who.bond}</span></div>
      <div class="bt-hp"><span>${_t('TL')}</span><div class="bt-bar"><i></i></div></div><div class="bt-sub"><span class="bt-num"></span><span class="bt-st"></span></div>`;
    who.disp = F.hp; who.stKey = '';
  }
  function stepPlates(dt) {
    [[B.me, B.mine, 0], [B.foe, B.theirs, 1]].forEach(([F, who, i]) => {
      const el = R.q(`.bt-plate[data-p="${i}"]`), tgt = who.tgt ?? F.hp, rate = F.maxHp * 0.9 * dt;
      who.disp += Math.max(-rate, Math.min(rate, tgt - who.disp)); const k = Math.max(0, who.disp / F.maxHp), bar = el.querySelector('.bt-bar i');
      bar.style.width = (k * 100).toFixed(1) + '%'; bar.className = k > 0.5 ? '' : k > 0.2 ? 'mid' : 'low';
      el.querySelector('.bt-num').textContent = `${Math.round(who.disp)}/${F.maxHp}`;
      const st = [...Object.keys(F.status).map(s => STATUS_INFO[s].name), F.guard ? '🛡' : '', F.boost ? '⚔' : '', F.focus ? '🎯' : ''].filter(Boolean).join(' · ');
      if (st !== who.stKey) { who.stKey = st; el.querySelector('.bt-st').textContent = st; }
    });
  }
  const hpTo = (i, v) => { (i ? B.theirs : B.mine).tgt = Math.max(0, Math.round(v)); setBattleIntensity(1 - Math.min((B.mine.tgt ?? B.me.hp) / B.me.maxHp, (B.theirs.tgt ?? B.foe.hp) / B.foe.maxHp)); };
  function pop(s, text, cls = '') {
    const p = s.head().add(V(0, 0.25, 0)).project(R.camera), el = document.createElement('div');
    el.className = 'bt-pop ' + cls; el.textContent = text; el.style.left = ((p.x * 0.5 + 0.5) * 100).toFixed(1) + '%'; el.style.top = ((-p.y * 0.5 + 0.5) * 100).toFixed(1) + '%';
    R.q('.bt-pops').appendChild(el); setTimeout(() => el.remove(), 1300);
  }

  /* ---------- nút chiêu và Sổ khắc hệ ---------- */
  const known = (a, d) => R.journal.has(`${a}>${d}`);
  function learn(a, d) { const k = `${a}>${d}`; if (R.journal.has(k)) return; R.journal.add(k); B.found++; store.set(JOURNAL, JSON.stringify([...R.journal])); }
  function renderMoves() {
    const { me, foe, field } = B;
    R.q('.bt-moves').innerHTML = me.moves.map((m, i) => {
      const E = ELEMENT_FX[m.element], atk = m.kind === 'attack', mu = elementMult(m.element, foe.element), k = known(m.element, foe.element);
      const hint = !atk ? `<em>${KIND_NAMES[m.kind]}</em>` : k ? `<em class="${mu > 1 ? 'up' : mu < 1 ? 'down' : ''}">${mu > 1 ? '▲' : mu < 1 ? '▼' : '='} ${MULT_TXT(mu)}</em>` : `<em class="unk">? ${_t('Chưa rõ')}</em>`;
      const cd = me.cd?.[m.id] || 0, extra = !atk && m.power ? ' + ' + _t`đòn ${m.power}` : '';
      return `<button type="button" class="bt-move${cd ? ' cd' : ''}" data-move="${i}" style="--el:${E.c}" aria-describedby="bt-desc" ${cd ? 'disabled' : ''}><span class="bt-mi">${E.icon}</span><b>${esc(m.name)}</b>
        <small>${cd ? _t`Hồi chiêu: còn ${cd - 1} lượt` : (atk ? `${_t('Sức mạnh')} ${Math.round(m.power)}` : m.kind === 'guard' ? _t('Lá chắn 2 lượt') : m.kind === 'boost' ? _t('Cường hoá 3 lượt') : _t`Hồi ${Math.round(100 * HEAL * Math.pow(HEAL_DECAY, me.heals || 0))}% thể lực`) + extra}${!cd && m.element === field ? ' · ' + _t('+10% sân') : ''}</small>${cd ? '' : hint}<kbd>${i + 1}</kbd></button>`;
    }).join('');
    R.q('[data-bt="speed"]').textContent = `⏩ ×${R.speed}`;
    R.q('.bt-moves').querySelectorAll('.bt-move').forEach(b => { const show = () => { if (B.awaiting) R.q('.bt-text').textContent = moveDesc(me.moves[+b.dataset.move]); }; b.addEventListener('pointerenter', show); b.addEventListener('focus', show); });
  }
  function renderChart() {
    const el = R.q('.bt-chart'), cell = (a, d) => { if (!known(a, d)) return '<td class="unk">?</td>'; const m = elementMult(a, d); return `<td class="${m > 1 ? 'up' : m < 1 ? 'down' : ''}">×${m}</td>`; };
    el.innerHTML = `<div class="bt-card"><h3>📖 ${_t('Sổ khắc hệ')}</h3><p class="bt-note">${_t('Hàng: hệ của chiêu · Cột: hệ của đối thủ. Ô chỉ hiện sau khi bạn gặp cặp hệ đó trong trận.')}</p>
      <table><tr><th></th>${ELEMENT_FX.map((E, i) => `<th>${E.icon}<br>${ELEMENT_NAMES[i]}</th>`).join('')}</tr>${ELEMENT_FX.map((E, a) => `<tr><th>${E.icon} ${ELEMENT_NAMES[a]}</th>${ELEMENT_FX.map((_, d) => cell(a, d)).join('')}</tr>`).join('')}</table>
      <p class="bt-note">${_t`Đã khám phá ${R.journal.size}/25 cặp. Sân đấu cộng 10% cho chiêu cùng hệ với sân.`}</p><button type="button" class="bt-btn wide" data-bt="chart-close">${_t('Đóng')}</button></div>`;
    el.hidden = false; el.querySelector('[data-bt="chart-close"]').focus();
  }

  /* ---------- sảnh ---------- */
  let L = null, A = null; // L: cảnh sảnh (sân + quái thú của mình); A: dữ liệu sảnh từ máy chủ
  const STAT_NAME = { hp: _t('Thể lực'), atk: _t('Tấn công'), def: _t('Phòng thủ'), spd: _t('Tốc độ') };
  function clearScene() {
    if (B) { [B.mine, B.theirs].forEach(s => { R.fx.clearStatus(s); R.scene.remove(s.wrap); }); R.scene.remove(B.stage.group); B = null; }
    if (L) { R.scene.remove(L.slot.wrap); R.scene.remove(L.stage.group); L = null; }
  }
  function useStage(field) { if (!R.stages.has(field)) { const st = R.kit.build(field); st.group.traverse(o => { if (o.isDirectionalLight && o.castShadow) { o.castShadow = !R.low; o.shadow.mapSize.setScalar(R.high ? 2048 : 1024); } }); R.stages.set(field, st); } const st = R.stages.get(field); R.scene.add(st.group); R.scene.fog = new THREE.Fog(st.fog, 24, 80); return st; }
  async function lobby() {
    clearScene(); battleMusic(false); R.root.classList.add('in-lobby'); ['.bt-result', '.bt-chart', '.bt-cmds'].forEach(x => { R.q(x).hidden = true; });
    if (R.msg?.res) { const r = R.msg.res; R.msg = null; r(); }
    const S = getS(), st = useStage(Math.floor(Math.random() * 5)), slot = makeSlot(V(0, st.ground, 0.6), V(0, st.ground, 8));
    L = { stage: st, slot, cut: true }; buildMonster(slot, { species: S.species, stage: S.stage, form: S.form, genes: S.genes || {} }); slot.k = 1; R.scene.add(slot.wrap);
    R.cam.slow(1.2); R.q('.bt-text').textContent = '';
    const el = R.q('.bt-lobby'); el.hidden = false; el.innerHTML = `<div class="bt-card lobby"><p>${_t('Đang tải…')}</p></div>`;
    try { A = await getArenaState(); } catch (e) { A = null; ctx.toast?.(viError(e)); }
    if (L) renderLobby();
  }
  function renderLobby(friends) {
    const S = getS(), el = R.q('.bt-lobby'), lv = bondLevel(S.bondXp), up = A?.upgrades || { hp: 0, atk: 0, def: 0, spd: 0 };
    const f = fighterOf({ species: S.species, stage: S.stage, form: S.form, bond: lv, upgrades: up }), sp = SPECIES_BY_ID[S.species], E = ELEMENT_FX[sp?.region ?? 0];
    const st = A?.stats || { rating: 1000, ranked: 0, wins: 0, losses: 0, draws: 0, streak: 0, best_streak: 0, def_wins: 0, def_losses: 0 }, coins = S.coins ?? 0;
    const row = k => {
      const lvl = up[k] || 0, cost = A?.costs?.[lvl], it = UPGRADES.find(u => u.stat === k);
      return `<div class="bt-up"><span class="bt-up-n">${STAT_NAME[k]} <b>${f ? f[k === 'hp' ? 'maxHp' : k] : '—'}</b></span><span class="bt-pips">${Array.from({ length: UPGRADE_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>
        <button type="button" class="bt-btn" data-up="${k}" ${lvl >= UPGRADE_MAX || !A ? 'disabled' : ''}>${lvl >= UPGRADE_MAX ? _t('Tối đa') : _t`${esc(it?.name || '')} · ${cost} xu`}</button></div>`;
    };
    el.innerHTML = `<div class="bt-card lobby">
      <div class="bt-lob-head"><h3>${_t('Đấu trường')}</h3><button type="button" class="bt-btn" data-bt="home">${_t('Về nhà')}</button></div>
      <p class="bt-who"><b>${esc(S.name || sp?.name || '')}</b> <span class="bt-el" style="--el:${E.c}">${E.icon} ${ELEMENT_NAMES[sp?.region ?? 0]}</span> · ${_t('Gắn bó')} ${lv}</p>
      <p class="bt-rank">🏅 ${rankName(st.rating)} · ${st.rating} ${_t('điểm')}${A?.rank ? ' · ' + _t`hạng ${A.rank}` : ''}<br><small>${_t`Thắng ${st.wins} · Thua ${st.losses} · Hoà ${st.draws} · Chuỗi thắng dài nhất ${st.best_streak} · Phòng thủ thắng ${st.def_wins}/${st.def_wins + st.def_losses}`}</small></p>
      <p class="bt-note">${A ? _t`Hôm nay còn ${A.rewards_left} trận có thưởng: thắng ${A.reward.win} xu, thua ${A.reward.loss} xu.` + (A.first_win_open ? ' ' + _t`Thắng trận đầu ngày thêm ${A.reward.first_win} xu.` : '') : ''}</p>
      ${f ? '' : `<p class="bt-warn">${_t('Bé còn nhỏ quá. Lên tuổi Nhí là bé học được chiêu đầu tiên và vào Đấu trường được.')}</p>`}
      <h4>${_t('Đá nâng cấp')} <small>(${_t`đang có ${coins} xu`})</small></h4>${['hp', 'atk', 'def', 'spd'].map(row).join('')}
      <p class="bt-note">${_t('Mỗi bậc +2% chỉ số, tối đa 5 bậc. Đá gắn với bé hiện tại. Trận Xếp hạng không tính đá nâng cấp cho công bằng.')}</p>
      <h4>${_t('Chọn trận')}</h4>
      <div class="bt-modes"><button type="button" class="bt-btn wide" data-mode="practice" ${f ? '' : 'disabled'}>🎯 ${_t('Đấu tập')}<small>${_t('Đấu với quái thú của máy')}</small></button>
        <button type="button" class="bt-btn wide" data-mode="ranked" ${f ? '' : 'disabled'}>🏆 ${_t('Xếp hạng')}<small>${_t('Gặp quái thú của người chơi khác, tính điểm')}</small></button>
        <button type="button" class="bt-btn wide" data-bt="friends" ${f ? '' : 'disabled'}>🤝 ${_t('Thách đấu bạn bè')}<small>${_t('Quái thú của bạn bè do máy điều khiển, không có thưởng')}</small></button></div>
      ${friends ? `<div class="bt-friends">${friends.length ? friends.map(p => { const ok = ['child', 'teen', 'adult', 'elder'].includes(p.stage); return `<button type="button" class="bt-btn" data-friend="${esc(p.pid)}" ${ok ? '' : 'disabled'}>${esc(p.name)} · ${esc(SPECIES_BY_ID[p.species]?.name || '')}${ok ? '' : ' · ' + _t('còn nhỏ')}</button>`; }).join('') : `<p class="bt-note">${_t('Chưa có bạn bè. Kết bạn ở Nhà → Bạn bè & thư.')}</p>`}</div>` : ''}
      ${A?.top?.length ? `<details class="bt-top"><summary>${_t('Bảng xếp hạng')}</summary><ol>${A.top.map(t => `<li class="${t.me ? 'me' : ''}"><b>${esc(t.name)}</b> · ${esc(SPECIES_BY_ID[t.species]?.name || '')} · ${t.rating}</li>`).join('')}</ol></details>` : ''}
    </div>`;
  }
  async function buy(k, btn) {
    btn.disabled = true;
    try {
      const r = await buyUpgrade(k), S = getS(); A.upgrades = r.upgrades; S.coins = r.coins; ctx.store?.refreshEconomy?.(); sfx('power');
      if (L) { R.fx.rune(L.slot.pos, ELEMENT_FX[SPECIES_BY_ID[S.species]?.region ?? 0].c, 1.4, 0.6, 0.2); R.fx.hop(L.slot, 0.3, 0.4); }
      renderLobby();
    } catch (e) { ctx.toast?.(viError(e)); btn.disabled = false; }
  }

  /* ---------- một trận ---------- */
  async function start(mode = 'practice', who) {
    const S = getS(), lv = bondLevel(S.bondXp);
    let srv; try { srv = await arenaStart(mode, who); } catch (e) { ctx.toast?.(viError(e)); return lobby(); }
    const me = fighterOf({ species: S.species, stage: S.stage, form: S.form, bond: lv, upgrades: srv.upgrades }), o = srv.opp, osp = SPECIES_BY_ID[o.species];
    const foe = fighterOf({ species: o.species, stage: o.stage, form: o.form, bond: o.bond, upgrades: o.upgrades });
    if (!me || !foe) { ctx.toast?.(_t('Không vào được trận này.')); return lobby(); }
    clearScene(); R.root.classList.remove('in-lobby'); R.q('.bt-lobby').hidden = true; battleMusic(true);
    R.q('.bt-result').hidden = true; R.q('.bt-chart').hidden = true; R.q('.bt-cmds').hidden = true;
    const field = srv.field, st = useStage(field);
    const gy = st.ground, P = V(-2.25, gy, 1.55), O = V(2.15, gy, -1.95);
    B = { id: srv.id, mode, who, opp: o, me, foe, field, stage: st, rnd: rngOf(srv.seed), turn: 1, over: null, awaiting: false, intro: true, found: 0, best: null, mine: null, theirs: null };
    const oName = o.kind === 'player' ? o.name : osp?.name || '';
    B.mine = Object.assign(makeSlot(P, O), { name: S.name || SPECIES_BY_ID[S.species].name, bond: lv });
    B.theirs = Object.assign(makeSlot(O, P), { name: oName, bond: o.bond, rating: mode === 'ranked' ? o.rating : null });
    buildMonster(B.mine, { species: S.species, stage: S.stage, form: S.form, genes: S.genes || {} }); buildMonster(B.theirs, { species: o.species, stage: o.stage, form: o.form, genes: {}, lod: true });
    R.scene.add(B.mine.wrap); R.scene.add(B.theirs.wrap);
    for (let e = 0; e < 5; e++) learn(me.element, e); B.found = 0; // hệ của bé thì bảng Chỉ số đã cho biết
    plate(0); plate(1); R.q('.bt-plate.mine').classList.remove('in'); R.q('.bt-plate.foe').classList.remove('in');
    R.q('.bt-field').innerHTML = `<b>${esc(ARENAS[field].name)}</b> · ${ELEMENT_FX[field].icon} ${_t`${ELEMENT_NAMES[field]} +10%`}`;
    R.cam.shot('intro'); R.cam.slow(0.9); R.cam.tPos.set(-1.2, 3.4, 8.2); R.cam.tLook.set(0.8, 1.2, -1.2);
    R.q('.bt-text').textContent = '';
    await R.fx.wait(0.6);
    R.cam.tPos.copy(B.theirs.pos).addScaledVector(B.theirs.dir, 4.2).add(V(1.4, 1.6, 0)); R.cam.tLook.copy(B.theirs.pos).add(V(0, 0.9, 0)); R.cam.slow(2.2);
    await R.fx.enter(B.theirs, B.foe.element, recipeOf(foe.moves[0]).motif); R.q('.bt-plate.foe').classList.add('in');
    await say(o.kind === 'player' ? _t`${oName} (${osp?.name || ''}) của ${o.family || _t('một người chơi')} bước ra ${ARENAS[field].name}!` : _t`${oName} hệ ${ELEMENT_NAMES[B.foe.element]} bước ra ${ARENAS[field].name}!`);
    R.cam.shot('wide'); R.cam.slow(2);
    await say(_t`Sân ${ARENAS[field].name}: chiêu hệ ${ELEMENT_NAMES[field]} mạnh thêm 10%.`, 0.6);
    await R.fx.enter(B.mine, B.me.element, recipeOf(me.moves[0]).motif); R.q('.bt-plate.mine').classList.add('in');
    await say(_t`Tiến lên, ${B.mine.name}!`, 0.4);
    B.intro = false; R.cam.shot('wide'); prompt();
  }

  function prompt() { if (!B || B.over !== null) return; renderMoves(); R.q('.bt-cmds').hidden = false; B.awaiting = true; sfx('turn'); say(_t`${B.mine.name} sẽ làm gì?`, 0); R.q('.bt-move')?.focus({ preventScroll: true }); }

  async function choose(i) {
    if (!B?.awaiting || !B.me.moves[i] || B.me.cd?.[B.me.moves[i].id]) return;
    B.awaiting = false; R.q('.bt-cmds').hidden = true; sfx('ui');
    try { await turn(i); } catch (e) { console.error(e); }
    if (B && B.over === null) prompt();
  }
  async function turn(i) {
    const { me, foe, rnd, field } = B, F = [me, foe], SL = [B.mine, B.theirs], mv = [me.moves[i], pickMove(foe, me, rnd, field)];
    const sp = f => f.spd * (f.status.root ? 0.7 : 1) * (f.haste ? 1.3 : 1);
    const first = (mv[0].twist === 'first') !== (mv[1].twist === 'first') ? (mv[0].twist === 'first' ? 0 : 1) : sp(me) === sp(foe) ? (rnd() < 0.5 ? 0 : 1) : sp(me) > sp(foe) ? 0 : 1;
    for (const w of [first, 1 - first]) {
      const a = F[w], d = F[1 - w]; if (a.hp <= 0 || d.hp <= 0) break;
      if (a.status.daze && rnd() < 0.25) { R.fx.hop(SL[w], 0.1, 0.3); sfx('stDaze'); await say(_t`${SL[w].name} choáng váng, không ra đòn được!`); continue; }
      await act(w, mv[w]);
      if (d.hp <= 0) { await down(1 - w); return; }
      if (a.hp <= 0) { await down(w); return; }
    }
    for (const w of [0, 1]) {
      const f = F[w], s = SL[w]; if (f.hp <= 0) continue; const r = endTurn(f);
      if (r.burn) { await R.fx.tick(s, 'burn'); pop(s, '−' + r.burn, 'burn'); hpTo(w, f.hp); await say(_t`${s.name} bị bỏng thiêu đốt!`, 0.5); }
      if (r.regen) { await R.fx.tick(s, 'regen'); pop(s, '+' + r.regen, 'heal'); hpTo(w, f.hp); await say(_t`${s.name} hồi phục dần.`, 0.4); }
      if (f.hp <= 0) { await down(w); return; }
    }
    B.turn++;
    if (B.turn > 30) { const k = me.hp / me.maxHp - foe.hp / foe.maxHp; await say(_t('Hết giờ! Phân định theo thể lực còn lại.')); finish(k > 0 ? 0 : k < 0 ? 1 : -1); }
  }
  /**
   * Diễn một chiêu theo công thức hiệu ứng (move-fx.ts) và nhịp của docs/VFX-STYLE-GUIDE.md:
   * lời dẫn → lấy đà → hành động → TRÚNG (số sát thương hiện đúng khung khựng hình) → dư âm → nét riêng → trạng thái → lời bình.
   * Trạng thái mới, lá chắn và hào quang được "tắt tiếng" (mute) tới đúng nhịp hiệu lực nên không hiện ra trước khi chiêu tới.
   */
  async function act(w, m) {
    const F = [B.me, B.foe], a = F[w], d = F[1 - w], sa = w ? B.theirs : B.mine, sd = w ? B.mine : B.theirs, el = m.element, Rc = recipeOf(m);
    say(_t`${sa.name} dùng ${m.name}!`, 0);
    await R.fx.wait(0.28);
    const before = { ah: a.hp, dh: d.hp, guard: d.guard > 0 }, line = useMove(a, d, m, B.rnd, B.turn, w, B.field);
    const popHit = (hit, crit) => pop(sd, '−' + hit, crit ? 'crit' : line.mult > 1 ? 'super' : line.mult < 1 ? 'weak' : '');
    sa.mute = true; sd.muteSt = true;
    try {
      if (m.kind !== 'attack') {
        if (line.dmg > 0 && Rc.strike) { // chiêu kép: đánh một đòn rồi mới hỗ trợ
          await R.fx.cast(Rc.strike, sa, sd, { hits: 1, name: m.name, info: () => ({ crit: line.crit, mult: line.mult, onHit: () => { popHit(line.dmg, line.crit); hpTo(1 - w, d.hp); } }) });
          learn(el, d.element);
          if (d.hp <= 0) return;
        }
        await R.fx.support(Rc, sa, { combo: !!Rc.strike, lock: () => { sa.mute = false; if (m.kind === 'heal') { pop(sa, '+' + line.heal, 'heal'); hpTo(w, a.hp); } } });
        sa.mute = false;
        if (m.twist === 'cleanse') R.fx.twist.cleanse(sa);
        if (line.dmg > 0 && line.mult !== 1) await say(MULT_MSG(line.mult), 0.4);
        if (m.kind === 'heal') await say(_t`${sa.name} hồi ${line.heal} thể lực!`);
        if (m.kind === 'guard') await say(a.wall ? _t`${sa.name} dựng lá chắn kiên cố!` : a.thorns ? _t`${sa.name} dựng lá chắn gai!` : _t`${sa.name} dựng lá chắn!`);
        if (m.kind === 'boost') await say(a.haste ? _t`${sa.name} tăng sức tấn công và tốc độ!` : a.focus ? _t`${sa.name} tập trung cao độ: đòn kế tiếp chắc chắn chí mạng!` : _t`${sa.name} tăng sức tấn công!`);
        if (m.twist === 'cleanse') await say(_t`${sa.name} giũ sạch trạng thái xấu.`, 0.4);
        return;
      }
      sa.mute = false;
      const n = Math.max(1, line.hits), per = Array.from({ length: n }, (_, k) => Math.floor(line.dmg / n) + (k < line.dmg % n ? 1 : 0)); let dealt = 0;
      await R.fx.cast(Rc, sa, sd, { hits: n, name: m.name, first: m.twist === 'first', lowhp: m.twist === 'lowhp' && before.ah < a.maxHp / 2, pierce: m.twist === 'pierce', guarded: before.guard,
        info: (k, last) => ({ crit: line.crit && last, mult: k === 0 ? line.mult : 1, onHit: () => { dealt += per[k]; popHit(per[k], line.crit && last); hpTo(1 - w, before.dh - dealt); } }) });
      sd.off.y = 0; hpTo(1 - w, d.hp);
      if (!B.best || line.dmg > B.best.dmg) B.best = { dmg: line.dmg, move: m.name, mine: !w };
      learn(el, d.element);
      if (n > 1) await say(_t`Trúng ${n} đòn!`, 0.35);
      if (line.crit) await say(_t('Chí mạng!'), 0.4);
      if (line.mult !== 1) await say(MULT_MSG(line.mult), 0.5);
      if (line.back) { R.fx.twist.thorns(sa, sd); await R.fx.wait(0.2); pop(sa, '−' + line.back); hpTo(w, a.hp); await say(_t`Lá chắn gai phản lại ${line.back} sát thương!`, 0.45); }
      if (m.twist === 'drain' && line.heal) { await R.fx.twist.drain(sa, sd); pop(sa, '+' + line.heal, 'heal'); hpTo(w, a.hp); await say(_t`${sa.name} hút lại ${line.heal} thể lực.`, 0.45); }
      if (line.self) { R.fx.twist.recoil(sa); pop(sa, '−' + line.self); hpTo(w, a.hp); await say(_t`${sa.name} chịu phản lực ${line.self}.`, 0.4); }
      if (m.twist === 'cleanse') { await R.fx.twist.cleanse(sa); if (line.heal) { pop(sa, '+' + line.heal, 'heal'); hpTo(w, a.hp); } await say(_t`${sa.name} giũ sạch trạng thái xấu.`, 0.4); }
      if (line.status) { sd.muteSt = false; R.fx.statusBurst(sd, line.status); await R.fx.wait(0.3); await say(_t`${sd.name} bị ${STATUS_INFO[line.status].name}: ${STATUS_INFO[line.status].desc}.`, 0.6); }
    } finally { sa.mute = false; sd.muteSt = false; }
  }
  async function down(w) {
    const s = w ? B.theirs : B.mine, f = w ? B.foe : B.me; R.fx.clearStatus(s); hpTo(w, 0);
    await Promise.all([R.fx.faint(s, f.element), say(_t`${s.name} kiệt sức!`, 0.5)]);
    finish(w ? 0 : 1);
  }
  async function finish(winner) {
    B.over = winner; B.awaiting = false; R.q('.bt-cmds').hidden = true; battleMusic(false, { hold: 2.5 });
    [B.mine, B.theirs].forEach(s => R.fx.clearStatus(s)); // tắt lá chắn, trạng thái để máy quay cận không bị che
    if (winner === 0) { R.cam.shot('win', B.mine); sfx('win'); R.fx.confetti(B.mine.pos); R.fx.hop(B.mine, 0.45, 0.5); await say(_t`${B.mine.name} chiến thắng!`, 0.9); }
    else if (winner === 1) { R.cam.shot('win', B.theirs); sfx('lose'); await say(_t('Thua trận rồi. Không sao, mình tập tiếp nhé.'), 0.9); }
    else await say(_t('Hai bên ngang tài, hoà!'), 0.9);
    try { B.reward = await arenaFinish(B.id, winner === 0 ? 'win' : winner === 1 ? 'loss' : 'draw', Math.min(31, B.turn)); ctx.store?.refreshEconomy?.(); if (B.reward.reward) sfx('coin'); }
    catch (e) { B.reward = null; B.rewardErr = viError(e); }
    showResult(winner);
  }
  function showResult(winner) {
    const el = R.q('.bt-result');
    el.innerHTML = `<div class="bt-card"><h3>${winner === 0 ? _t('Chiến thắng!') : winner === 1 ? _t('Thua trận') : _t('Hoà')}</h3>
      <ul><li>${_t`Số lượt: ${Math.min(30, B.turn)}`}</li>${B.best ? `<li>${_t`Đòn mạnh nhất: ${esc(B.best.move)} (${B.best.dmg})`}</li>` : ''}<li>${B.found ? _t`Sổ khắc hệ ghi thêm ${B.found} cặp hệ mới.` : _t('Không có cặp hệ mới nào.')}</li></ul>
      ${B.reward ? `<p class="bt-gain">${B.reward.reward ? _t`+${B.reward.reward} xu` + (B.reward.first_win ? ' · ' + _t('có thưởng thắng đầu ngày') : '') : _t('Hết lượt có thưởng hôm nay.')}${B.mode === 'ranked' ? ` · 🏆 ${B.reward.rating} (${B.reward.rating_delta >= 0 ? '+' : ''}${B.reward.rating_delta})` : ''}</p><p class="bt-note">${_t`Còn ${B.reward.rewards_left} trận có thưởng hôm nay.`}</p>` : `<p class="bt-warn">${esc(B.rewardErr || '')}</p>`}
      <p class="bt-note">${_t('Đấu giao hữu: thua không mất gì ngoài điểm xếp hạng.')}</p><div class="bt-row"><button type="button" class="bt-btn wide" data-bt="again">${_t('Đấu tiếp')}</button><button type="button" class="bt-btn wide" data-bt="lobby">${_t('Về sảnh')}</button></div></div>`;
    el.hidden = false; el.querySelector('button')?.focus();
  }

  /* ---------- nhập liệu ---------- */
  let runAt = 0;
  function onClick(e) {
    const mv = e.target.closest('[data-move]'); if (mv) { choose(+mv.dataset.move); return; }
    const b = e.target.closest('[data-bt], [data-mode], [data-friend], [data-up]'); if (!b || b.disabled) return; const k = b.dataset.bt;
    if (k === 'chart') renderChart();
    if (k === 'chart-close') { R.q('.bt-chart').hidden = true; R.q('.bt-move')?.focus(); }
    if (k === 'speed') { R.speed = R.speed === 1 ? 2 : 1; store.set(SPEEDK, String(R.speed)); R.fx.timeScale = devFast ? 10 : R.speed; b.textContent = `⏩ ×${R.speed}`; }
    if (k === 'run') { if (performance.now() - runAt < 3000) forfeit(); else { runAt = performance.now(); b.textContent = _t('Bấm lần nữa để rời'); setTimeout(() => { if (b.isConnected) b.textContent = _t('Rời trận'); }, 3000); } }
    if (k === 'again') start(B?.mode || 'practice', B?.who);
    if (k === 'lobby') lobby();
    if (k === 'home') close();
    if (k === 'friends') listFriends().then(f => renderLobby(f)).catch(err => ctx.toast?.(viError(err)));
    if (b.dataset.mode) start(b.dataset.mode);
    if (b.dataset.friend) start('friend', b.dataset.friend);
    if (b.dataset.up) buy(b.dataset.up, b);
  }
  /** Rời trận giữa chừng: tính là bỏ cuộc (xếp hạng thì trừ điểm), rồi về sảnh. */
  async function forfeit() {
    if (B && B.over === null && B.id) { const id = B.id; B.over = -2; try { await arenaFinish(id, 'forfeit', null); } catch { /* đã kết thúc */ } }
    lobby();
  }
  function onKey(e) {
    if (!R?.open) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); if (!R.q('.bt-chart').hidden) { R.q('.bt-chart').hidden = true; return; } if (!R.q('.bt-result').hidden) { lobby(); return; } if (L) { close(); return; } R.q('[data-bt="run"]')?.click(); return; }
    if (/^[1-4]$/.test(e.key) && B?.awaiting) { e.stopPropagation(); choose(+e.key - 1); return; }
    if ((e.key === ' ' || e.key === 'Enter') && !B?.awaiting && R.q('.bt-result').hidden && R.q('.bt-chart').hidden && !(e.target instanceof HTMLButtonElement)) { e.stopPropagation(); e.preventDefault(); advance(); }
  }

  /* ---------- vòng lặp vẽ ---------- */
  function frame(now) {
    const real = Math.min(0.1, R.last ? (now - R.last) / 1000 : 0.016); R.last = now;
    const sizeK = (R.renderer.getDrawingBufferSize(new THREE.Vector2()).y / 2) / Math.tan((R.camera.fov * Math.PI / 180) / 2);
    if (R.hold) { R.cam.update(0); R.composer.render(); return; }
    const dt = R.fx.update(real, sizeK); R.t += dt; if (R.holdAt != null && R.t >= R.holdAt) { R.holdAt = null; R.hold = true; }
    if (L) { L.stage.update(R.t); stepSlot(L.slot, R.t); const a = R.t * 0.12, wide = R.w > R.h * 1.05; R.cam.tPos.set(Math.sin(a) * 6.2 + (wide ? 2.2 : 0), 2.4, Math.cos(a) * 6.2 + 1); R.cam.tLook.set(wide ? 1.4 : 0, wide ? 1.1 : 0.5, 0.6); R.cam.tFov = wide ? 36 : 50; if (L.cut) { L.cut = false; R.cam.pos.copy(R.cam.tPos); R.cam.look.copy(R.cam.tLook); R.cam.fov = R.cam.tFov; } }
    if (B) { B.stage.update(R.t); [B.mine, B.theirs].forEach(s => stepSlot(s, R.t)); R.fx.syncStatus(B.mine, B.me, dt); R.fx.syncStatus(B.theirs, B.foe, dt); stepPlates(real); }
    stepMsg(dt || real * 0.0001); R.cam.update(real); R.composer.render();
  }
  function openArena() {
    closeAll(); ensure(); R.root.hidden = false; R.open = true; R.fx.timeScale = devFast ? 10 : R.speed; ctx.pauseWorld?.(true);
    R.resize(); R.last = 0; R.renderer.setAnimationLoop(frame); lobby();
  }
  function close() {
    if (!R) return; battleMusic(false); R.open = false; R.renderer.setAnimationLoop(null); R.root.hidden = true; ctx.pauseWorld?.(false);
    if (B && B.over === null && B.id) arenaFinish(B.id, 'forfeit', null).catch(() => {});
    clearScene();
    if (R.msg?.res) { const r = R.msg.res; R.msg = null; r(); }
  }
  if (/[?&]dev\b/.test(location.search)) window.__battle = { state: () => (B ? { t: +R.t.toFixed(2), hold: !!R.hold, awaiting: B.awaiting, over: B.over, turn: B.turn, hp: [B.me.hp, B.foe.hp], els: [B.me.element, B.foe.element], field: B.field, moves: B.me.moves.length, found: R.journal.size } : { none: true }), choose, open: openArena, close, start, lobbyReady: () => !!L && !R.q('.bt-lobby').hidden && !!R.q('[data-mode]'), upgrades: () => A?.upgrades, /** dừng hình sau `s` giây đồng hồ trận (để chụp hiệu ứng) */ holdIn: s => { R.hold = false; R.holdAt = R.t + s; }, held: () => !!R.hold, resume: () => { R.hold = false; R.holdAt = null; },
    /**
     * Trình xem hiệu ứng (?dev): diễn chiêu thứ `idx` (0..3) của loài `speciesId` trong trận đang mở, đúng luồng của trận thật.
     * o: { who: 0 | 1 bên ra đòn, crit: ép chí mạng, guard: đối thủ đang thủ (xem xuyên thủ), low: người đánh dưới nửa thể lực, look: đổi dáng người đánh thành loài đó }.
     * Trả về { t: số giây đồng hồ trận của phần hiệu ứng, budget: trần theo sổ tay, total: cả lời dẫn }.
     */
    demoMove: async (speciesId, idx, o = {}) => {
      const w = o.who ? 1 : 0, m = movesOf(speciesId)[idx], F = [B.me, B.foe], a = F[w], d = F[1 - w], sa = w ? B.theirs : B.mine; if (!m) return null;
      if (o.look !== false && sa.sp !== speciesId) { sa.sp = speciesId; sa.body.clear(); buildMonster(sa, { species: speciesId, stage: 'adult', genes: {}, lod: !!w }); sa.wrap.updateMatrixWorld(true); }
      B.awaiting = false; R.q('.bt-cmds').hidden = true;
      for (const f of F) { f.hp = f.maxHp; f.status = {}; f.cd = {}; f.guard = 0; f.wall = f.thorns = false; f.boost = f.haste = f.regen = 0; f.focus = false; f.heals = 0; }
      if (o.crit) a.focus = true; if (o.guard) d.guard = 2; if (o.low) a.hp = Math.round(a.maxHp * 0.3);
      hpTo(0, B.me.hp); hpTo(1, B.foe.hp);
      let t = 0; const wrap = k => { const f = R.fx[k]; R.fx[k] = async (...x) => { const t0 = R.t; try { return await f(...x); } finally { t += R.t - t0; R.fx[k] = f; } }; };
      wrap(m.kind === 'attack' ? 'cast' : 'support'); if (m.kind !== 'attack' && recipeOf(m).strike) wrap('cast');
      const t0 = R.t; await act(w, m); const Rc = recipeOf(m);
      return { t: +t.toFixed(3), total: +(R.t - t0).toFixed(3), budget: Rc.beats.budget, plan: +moveDuration(Rc, 1).toFixed(3), form: Rc.form, motif: Rc.motif, name: m.name };
    },
    /** Thử hiệu ứng gây trạng thái / nhịp cuối lượt / ra sân / gục trên quái thú bên `who`. */
    demoStatus: (st, who = 1) => R.fx.statusBurst(who ? B.theirs : B.mine, st),
    demoTick: (kind, who = 1) => R.fx.tick(who ? B.theirs : B.mine, kind),
    demoEnter: (who = 1) => R.fx.enter(who ? B.theirs : B.mine, (who ? B.foe : B.me).element),
    demoFaint: async (who = 1) => { const s = who ? B.theirs : B.mine; await R.fx.faint(s, (who ? B.foe : B.me).element); s.k = 1; s.tilt = 0; s.off.set(0, 0, 0); },
    fxStats: () => R.fx.stats(),
    setSpeed: k => { R.fx.timeScale = k; },
    setReduce: v => { R.fx.reduce = !!v; },
  };
  return { openArena, close };
}
