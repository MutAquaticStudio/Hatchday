// Năm mini-game mới chơi trong lớp phủ (cùng khung với Pha trà ở minigames.js): Câu cá, Đố vui, Giao hàng, Nhảy theo nhịp, Bắt sâu.
// Mỗi trò nhận `g` = { root, head, finish(score, extra), sfx, buzz, reduce, ctx, live(fn) } và trả về hàm dọn dẹp.
// Luật thuần (điểm, đề, nhịp) nằm ở minigame-rules.ts (có test); máy chủ chặn điểm vượt trần như các trò cũ.
import { _t } from '../i18n';
import {
  BUGS, bugShowMs, bugsScore, DELIVERY, DELIVERY_STALLS, deliveryOrders, deliveryScore, FISH, fishBiteWindow, fishScore,
  pickQuiz, QUIZ, quizScore, RHYTHM, rhythmChart, rhythmHit, rhythmScore, seeded, shuffled,
} from './minigame-rules';

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const timerBar = () => '<div class="mg-timer"><i id="mg-time"></i></div>';
const setTime = (root, left, total) => { const t = root.querySelector('#mg-time'); if (t) t.style.width = `${Math.max(0, left / total) * 100}%`; };

/* ---------------- Câu cá: cảnh ao vẽ bằng SVG, cập nhật mỗi khung hình ---------------- */
const FISH_PATH = 'M-14 0c6-9 20-9 26 0-6 9-20 9-26 0z M10 0l9-7v14z';
function fish(g) {
  const { root, head, sfx, buzz, reduce } = g, W = 340, H = 230, TIP = { x: 214, y: 84 }, HOME = { x: 222, y: 112 };
  const st = { phase: 'cast', caught: 0, t0: performance.now(), timer: 0, raf: 0, ended: false, bob: { ...HOME }, from: null, to: null, castT: 0, biteAt: 0, waitEnd: 0, jump: null, land: null, ripples: [], last: performance.now() };
  const shadows = [0, 1, 2].map(i => ({ x: 60 + i * 90, y: 70 + (i % 2) * 60, vx: (i % 2 ? -1 : 1) * 12, vy: 4, tx: 0, ty: 0, hook: false }));
  root.innerHTML = _t`<div class="mini-card play">${head('fish', _t`Câu tối đa ${FISH.target} con trong ${FISH.seconds} giây`)}
    ${timerBar()}<div class="mg-row"><span class="mg-pill" id="f-n">🐟 0/${FISH.target}</span><span class="mg-order" id="f-hint">Chờ phao chìm rồi giật!</span></div>
    <svg class="fish-scene" id="f-scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ao câu cá">
      <defs><radialGradient id="fw" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#d4f2ff"/><stop offset=".55" stop-color="#8fd3f5"/><stop offset="1" stop-color="#4f9fd2"/></radialGradient></defs>
      <rect width="${W}" height="${H}" fill="#9fd88a"/><ellipse cx="${W / 2}" cy="${H / 2 - 6}" rx="${W / 2 - 10}" ry="${H / 2 - 12}" fill="url(#fw)" stroke="#c9b48a" stroke-width="6"/>
      <g id="f-sh">${shadows.map((_, i) => `<path d="${FISH_PATH}" fill="${i === 1 ? 'rgba(255,140,60,.38)' : 'rgba(30,70,110,.3)'}"/>`).join('')}</g>
      <g class="fish-pads"><g transform="translate(58 52)"><path d="M0-14a14 14 0 1 0 13 5L0 0z" fill="#6fcf6a"/></g><g transform="translate(286 66) rotate(140)"><path d="M0-16a16 16 0 1 0 15 6L0 0z" fill="#6fcf6a"/><circle cx="-4" cy="4" r="5" fill="#ffb3d1"/><circle cx="-4" cy="4" r="2" fill="#fff"/></g><g transform="translate(262 158) rotate(-60)"><path d="M0-12a12 12 0 1 0 11 4L0 0z" fill="#5fbf62"/></g></g>
      <g id="f-rip"></g>
      <g class="fish-reed">${[[18, 150], [26, 160], [34, 146], [312, 152], [320, 140]].map(([x, y], i) => `<g transform="translate(${x} ${y})"><path d="M0 0q${i % 2 ? 4 : -4} -30 0 -${48 + i * 6}" stroke="#5fa04f" stroke-width="3" fill="none"/><rect x="-3" y="-${54 + i * 6}" width="6" height="16" rx="3" fill="#a8744a"/></g>`).join('')}</g>
      <g transform="translate(${W / 2} ${H})"><rect x="-70" y="-30" width="140" height="34" rx="6" fill="#c29a62" stroke="#8a5f3a" stroke-width="3"/>${[-46, -22, 2, 26, 50].map(x => `<line x1="${x}" y1="-28" x2="${x}" y2="2" stroke="#a8744a" stroke-width="2"/>`).join('')}</g>
      <g id="f-pet" transform="translate(150 196)"><ellipse cx="0" cy="8" rx="20" ry="5" fill="rgba(0,0,0,.15)"/><circle r="20" fill="#ffd9e6" stroke="#8a5a6a" stroke-width="3"/><circle cx="-7" cy="-3" r="2.6" fill="#3b2a3a"/><circle cx="7" cy="-3" r="2.6" fill="#3b2a3a"/><ellipse cx="-11" cy="4" rx="4" ry="2.4" fill="#ff9fbe"/><ellipse cx="11" cy="4" rx="4" ry="2.4" fill="#ff9fbe"/><path id="f-mouth" d="M-3 5q3 3 6 0" stroke="#3b2a3a" stroke-width="2" fill="none"/></g>
      <g id="f-bucket" transform="translate(112 204)"><ellipse cx="0" cy="12" rx="17" ry="4" fill="rgba(0,0,0,.15)"/><path d="M-15 -12h30l-4 24h-22z" fill="#7fb6e6" stroke="#3f6f9a" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="0" cy="-12" rx="15" ry="4" fill="#bfe6ff" stroke="#3f6f9a" stroke-width="2.5"/><path d="M-13 -2h26" stroke="#3f6f9a" stroke-width="2" opacity=".5"/><path d="M-15 -12q15 -22 30 0" fill="none" stroke="#3f6f9a" stroke-width="2"/></g>
      <text id="f-plus" x="112" y="176" font-size="16" font-weight="800" fill="#ff6fa8" stroke="#fff" stroke-width="3" paint-order="stroke" text-anchor="middle" opacity="0">+1</text>
      <line id="f-rod" x1="164" y1="196" x2="${TIP.x}" y2="${TIP.y}" stroke="#7a5a3a" stroke-width="4" stroke-linecap="round"/>
      <path id="f-line" d="" stroke="rgba(60,60,80,.75)" stroke-width="1.5" fill="none"/>
      <g id="f-bob"><circle r="7" fill="#fff" stroke="#7a2a3a" stroke-width="2"/><path d="M-7 0a7 7 0 0 1 14 0z" fill="#ff5a5a" stroke="#7a2a3a" stroke-width="2"/><line x1="0" y1="-7" x2="0" y2="-13" stroke="#7a2a3a" stroke-width="2"/></g>
      <text id="f-ex" font-size="22" font-weight="800" fill="#ff7a2a" text-anchor="middle" opacity="0">!</text>
      <g id="f-jump" opacity="0"><path d="${FISH_PATH}" fill="#ffb347" stroke="#a8601a" stroke-width="1.5"/><circle cx="-8" cy="-2" r="1.6" fill="#3b2a3a"/></g>
    </svg>
    <p class="mini-intro" id="f-msg">Chạm "Thả câu" rồi chờ phao chìm nhé!</p>
    <div class="mini-actions"><button type="button" class="btn-sm big" id="f-btn" data-fish>Thả câu</button></div></div>`;
  const $ = s => root.querySelector(s), btn = $('#f-btn'), sh = [...$('#f-sh').children], bobEl = $('#f-bob'), lineEl = $('#f-line'), rodEl = $('#f-rod'), ex = $('#f-ex'), jump = $('#f-jump'), rip = $('#f-rip'), mouth = $('#f-mouth'), bucket = $('#f-bucket'), plus = $('#f-plus');
  const say = m => { $('#f-msg').textContent = m; };
  const ripple = (x, y, big = false) => st.ripples.push({ x, y, t: 0, max: big ? 28 : 18 });
  const reel = () => { st.phase = 'cast'; btn.textContent = _t('Thả câu'); st.from = { ...st.bob }; st.to = { ...HOME }; st.castT = 0; shadows.forEach(f => { f.hook = false; }); };
  const cast = () => {
    st.phase = 'wait'; btn.textContent = _t('Giật cần!'); say(_t('Suỵt… chờ phao chìm…')); sfx('splash');
    st.from = { ...st.bob }; st.to = { x: 90 + Math.random() * 160, y: 62 + Math.random() * 70 }; st.castT = 0;
    const wait = FISH.waitMin + Math.random() * (FISH.waitMax - FISH.waitMin); st.waitEnd = performance.now() + wait;
    const f = shadows[Math.floor(Math.random() * shadows.length)]; f.hook = true; // con cá sẽ cắn câu bơi dần lại gần phao
    clearTimeout(st.timer); st.timer = setTimeout(() => {
      if (st.ended || st.phase !== 'wait') return; st.phase = 'bite'; st.biteAt = performance.now(); say(_t('Cắn câu rồi! Giật nhanh!')); buzz(20); sfx('boing'); ripple(st.bob.x, st.bob.y, true);
      st.timer = setTimeout(() => { if (st.phase === 'bite' && !st.ended) { say(_t('Cá chạy mất rồi, thử lại nha.')); sfx('miss'); reel(); } }, fishBiteWindow(st.caught));
    }, wait);
  };
  const pull = () => {
    if (st.ended) return;
    if (st.phase === 'cast') { cast(); return; }
    clearTimeout(st.timer);
    if (st.phase === 'wait') { say(_t('Sớm quá, cá giật mình bơi đi mất!')); sfx('miss'); shadows.forEach(f => { if (f.hook) { f.vx = (f.x - st.bob.x) * 3; f.vy = (f.y - st.bob.y) * 3; } }); reel(); return; }
    if (st.phase === 'bite') {
      st.caught++; sfx('catch'); buzz(12);
      const kinds = ['#ffb347', '#ff7a9a', '#6ab7ff', '#7edb72']; jump.querySelector('path').setAttribute('fill', kinds[st.caught % 4]);
      st.jump = { t: 0, x0: st.bob.x, y0: st.bob.y, x: st.bob.x, y: st.bob.y }; ripple(st.bob.x, st.bob.y, true);
      const f = shadows.find(x => x.hook); if (f) { f.x = Math.random() < 0.5 ? -30 : W + 30; f.y = 60 + Math.random() * 100; }
      $('#f-n').textContent = `🐟 ${st.caught}/${FISH.target}`; say(st.caught >= FISH.target ? _t('Đủ rồi! Câu giỏi ghê!') : _t`Được ${st.caught} con! Thả câu tiếp nào.`);
      reel(); st.from = null; st.bob = { ...HOME }; if (st.caught >= FISH.target) end();
    }
  };
  const end = () => { if (st.ended) return; st.ended = true; clearTimeout(st.timer); setTimeout(() => { cancelAnimationFrame(st.raf); g.finish(fishScore(st.caught)); }, reduce ? 300 : 900); };
  btn.addEventListener('click', pull);
  const onKey = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pull(); } }; document.addEventListener('keydown', onKey);
  const frame = now => {
    const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now; const t = now / 1000;
    if (!st.ended) { const left = FISH.seconds - (now - st.t0) / 1000; setTime(root, left, FISH.seconds); if (left <= 0) end(); }
    // phao: bay theo đường cong khi thả/thu, nhấp nhô khi chờ, giật xuống khi cá cắn
    if (st.from) { st.castT = Math.min(1, st.castT + dt / (reduce ? 0.25 : 0.55)); const k = st.castT, e = k * k * (3 - 2 * k);
      st.bob.x = st.from.x + (st.to.x - st.from.x) * e; st.bob.y = st.from.y + (st.to.y - st.from.y) * e - Math.sin(k * Math.PI) * (st.phase === 'cast' ? 10 : 40);
      if (k >= 1) { if (st.phase !== 'cast') ripple(st.bob.x, st.bob.y); st.from = null; } }
    let by = st.bob.y; const swing = st.phase === 'cast' && !st.from;
    if (st.phase === 'wait' && !st.from) by += Math.sin(t * 2.4) * 1.6;
    if (st.phase === 'bite') by += 5 + Math.abs(Math.sin(t * 22)) * 6;
    const bx = st.bob.x + (swing ? Math.sin(t * 1.8) * 3 : 0);
    const hooked = st.jump && st.phase === 'cast' && !st.from && st.jump.t < 0.62; // cá còn mắc câu: dây kéo theo cá, phao ẩn
    bobEl.setAttribute('transform', `translate(${bx.toFixed(1)} ${by.toFixed(1)})`); bobEl.setAttribute('opacity', hooked ? '0' : '1');
    const ex2 = hooked ? st.jump.x : bx, ey2 = hooked ? st.jump.y - 8 : by - 13;
    const taut = hooked || st.phase === 'bite' ? 0 : st.phase === 'cast' ? 6 : 18, mx = (TIP.x + ex2) / 2, my = Math.max(TIP.y, ey2 + 13) + taut;
    lineEl.setAttribute('d', `M${TIP.x} ${TIP.y} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex2.toFixed(1)} ${ey2.toFixed(1)}`);
    rodEl.setAttribute('x2', String(TIP.x + (st.phase === 'bite' ? Math.sin(t * 20) * 2 : 0))); rodEl.setAttribute('y2', String(TIP.y + (st.phase === 'bite' ? 6 : 0)));
    ex.setAttribute('x', bx.toFixed(1)); ex.setAttribute('y', (by - 22).toFixed(1)); ex.setAttribute('opacity', st.phase === 'bite' ? String(0.6 + Math.abs(Math.sin(t * 10)) * 0.4) : '0');
    mouth.setAttribute('d', st.phase === 'bite' || st.jump ? 'M-4 4q4 6 8 0z' : 'M-3 5q3 3 6 0');
    // cá dưới nước: đi dạo; con sắp cắn bơi dần về phía phao
    shadows.forEach((f, i) => {
      if (f.hook && st.phase !== 'cast') { const k = Math.min(1, dt * (st.phase === 'bite' ? 6 : 1.2)), d = Math.max(0, (st.waitEnd - now) / 1000); f.x += ((st.bob.x - 16 - d * 30) - f.x) * k; f.y += (st.bob.y + 6 - f.y) * k; }
      else { f.vx += (Math.random() - 0.5) * 30 * dt; f.vy += (Math.random() - 0.5) * 20 * dt; f.vx = Math.max(-26, Math.min(26, f.vx * 0.99)); f.vy = Math.max(-12, Math.min(12, f.vy * 0.98)); f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.x < 40 || f.x > W - 40) f.vx = -f.vx; if (f.y < 40 || f.y > H - 70) f.vy = -f.vy; f.x = Math.max(30, Math.min(W - 30, f.x)); f.y = Math.max(34, Math.min(H - 64, f.y)); }
      const dir = f.hook ? 1 : f.vx >= 0 ? 1 : -1;
      sh[i].setAttribute('transform', `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${dir * -1} 1) rotate(${Math.sin(t * 6 + i) * 6})`);
    });
    // gợn nước
    if (!reduce && Math.random() < dt * 0.4) ripple(40 + Math.random() * (W - 80), 40 + Math.random() * (H - 110));
    st.ripples = st.ripples.filter(r => (r.t += dt) < 1.4);
    rip.innerHTML = st.ripples.map(r => `<ellipse cx="${r.x.toFixed(1)}" cy="${r.y.toFixed(1)}" rx="${(4 + r.t / 1.4 * r.max).toFixed(1)}" ry="${(2 + r.t / 1.4 * r.max * 0.4).toFixed(1)}" fill="none" stroke="rgba(255,255,255,${(0.8 * (1 - r.t / 1.4)).toFixed(2)})" stroke-width="2"/>`).join('');
    // cá nhảy lên khỏi mặt nước rồi rơi vào xô bên bến
    if (st.jump) { const j = st.jump; j.t += dt / (reduce ? 0.45 : 1.1); const k = Math.min(1, j.t), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
      j.x = j.x0 + (112 - j.x0) * e; j.y = j.y0 + (192 - j.y0) * e - Math.sin(k * Math.PI) * 78;
      const wig = Math.sin(j.t * 38) * (1 - k) * 28, dir = j.x0 > 112 ? 1 : -1; // cá quẫy khi bị kéo lên
      jump.setAttribute('opacity', k < 1 ? '1' : '0'); jump.setAttribute('transform', `translate(${j.x.toFixed(1)} ${j.y.toFixed(1)}) rotate(${(dir * (-50 + k * 140) + wig).toFixed(0)}) scale(${(1.15 + Math.sin(k * Math.PI) * 0.35).toFixed(2)})`);
      if (k >= 1) { st.jump = null; st.land = 0; ripple(112, 192); } }
    if (st.land != null) { st.land += dt; const q = Math.min(1, st.land / 0.7);
      bucket.setAttribute('transform', `translate(112 204) scale(${(1 + Math.sin(q * Math.PI) * 0.18).toFixed(3)} ${(1 - Math.sin(q * Math.PI) * 0.12).toFixed(3)})`);
      plus.setAttribute('opacity', (1 - q).toFixed(2)); plus.setAttribute('y', (176 - q * 18).toFixed(1)); if (q >= 1) st.land = null; }
    st.raf = requestAnimationFrame(frame);
  };
  st.raf = requestAnimationFrame(frame);
  g.live(() => ({ kind: 'fish', phase: st.ended ? 'done' : 'play', step: st.phase, caught: st.caught }));
  return () => { st.ended = true; clearTimeout(st.timer); cancelAnimationFrame(st.raf); document.removeEventListener('keydown', onKey); };
}

/* ---------------- Đố vui ---------------- */
function quiz(g) {
  const { root, head, sfx, buzz } = g, qs = pickQuiz(Math.floor(Math.random() * 1e9));
  const st = { i: 0, right: 0, t0: 0, raf: 0, ended: false, locked: false };
  const render = () => {
    const x = qs[st.i]; st.t0 = performance.now(); st.locked = false;
    root.innerHTML = _t`<div class="mini-card play">${head('quiz', _t`Câu ${st.i + 1}/${qs.length} · đúng ${st.right}`)}${timerBar()}
      <div class="quiz-board"><span class="quiz-chalk" aria-hidden="true">✎ Câu ${st.i + 1}</span><h3 class="quiz-q">${esc(x.q)}</h3></div><div class="quiz-a">${x.a.map((t, k) => `<button type="button" class="quiz-opt o${k}" data-quiz="${k}"><i aria-hidden="true">${'ABCD'[k]}</i><span>${esc(t)}</span></button>`).join('')}</div></div>`;
  };
  const answer = k => {
    if (st.locked || st.ended) return; st.locked = true;
    const x = qs[st.i], ok = k === x.c; if (ok) st.right++;
    root.querySelectorAll('.quiz-opt').forEach(b => { const n = +b.dataset.quiz; b.disabled = true; if (n === x.c) b.classList.add('ok'); else if (n === k) b.classList.add('bad'); });
    sfx(ok ? 'catch' : 'miss'); buzz(ok ? 10 : 4);
    setTimeout(() => { if (st.ended) return; if (++st.i >= qs.length) { st.ended = true; g.finish(quizScore(st.right)); } else render(); }, 900);
  };
  root.addEventListener('click', onClick);
  function onClick(e) { const b = e.target.closest('[data-quiz]'); if (b) answer(+b.dataset.quiz); }
  const frame = now => {
    if (st.ended) return; const left = QUIZ.seconds - (now - st.t0) / 1000; setTime(root, left, QUIZ.seconds);
    if (left <= 0 && !st.locked) answer(-1); st.raf = requestAnimationFrame(frame);
  };
  render(); st.raf = requestAnimationFrame(frame);
  g.live(() => ({ kind: 'quiz', phase: st.ended ? 'done' : 'play', i: st.i, right: st.right, correct: qs[st.i]?.c }));
  return () => { st.ended = true; cancelAnimationFrame(st.raf); root.removeEventListener('click', onClick); };
}

/* ---------------- Giao hàng ---------------- */
function delivery(g) {
  const { root, head, sfx, buzz, reduce } = g, rnd = seeded(Math.floor(Math.random() * 1e9));
  const tiles = shuffled(DELIVERY_STALLS, rnd), orders = deliveryOrders(Math.floor(rnd() * 1e9));
  const st = { n: 0, i: 0, t0: performance.now(), penalty: 0, raf: 0, ended: false, open: true, lock: false };
  const byId = Object.fromEntries(DELIVERY_STALLS.map(s => [s.id, s]));
  root.innerHTML = _t`<div class="mini-card play">${head('delivery', _t('Nhớ sạp nào bán gì, rồi giao đúng chỗ'))}${timerBar()}
    <div class="mg-row"><span class="mg-pill" id="d-n">📦 0/${DELIVERY.target}</span></div><div class="deliv-order"><span class="deliv-cust" aria-hidden="true">🧑‍🍳</span><span class="mg-order" id="d-order">Nhìn kỹ các sạp nhé…</span></div>
    <div class="deliv-grid">${tiles.map(s => `<button type="button" class="deliv-tile open st-${s.id}" data-stall="${s.id}"><span class="dt-roof" aria-hidden="true"></span><span class="dt-slot"><span class="dt-icon">${s.icon}</span><span class="dt-box" aria-hidden="true">?</span></span><b>${esc(s.name)}</b></button>`).join('')}</div>
    <p class="mini-hint">Đơn sai bị trừ ${DELIVERY.penalty} giây</p></div>`;
  const $ = s => root.querySelector(s);
  const showOrder = () => { const s = byId[orders[st.i]]; $('#d-order').innerHTML = _t`Giao <span class="dt-big">${s.icon}</span> tới sạp nào?`; };
  const closeAll = () => { st.open = false; root.querySelectorAll('.deliv-tile').forEach(b => b.classList.remove('open')); showOrder(); };
  const t1 = setTimeout(closeAll, reduce ? DELIVERY.preview + 800 : DELIVERY.preview);
  const pick = id => {
    if (st.open || st.lock || st.ended) return; const want = orders[st.i], b = root.querySelector(`[data-stall="${id}"]`), right = root.querySelector(`[data-stall="${want}"]`);
    st.lock = true;
    if (id === want) { st.n++; st.i++; b.classList.add('open', 'ok'); sfx('coin'); buzz(10); $('#d-n').textContent = `📦 ${st.n}/${DELIVERY.target}`; }
    else { st.penalty += DELIVERY.penalty; b.classList.add('bad'); right.classList.add('open', 'hint'); sfx('miss'); buzz(4); }
    setTimeout(() => {
      root.querySelectorAll('.deliv-tile').forEach(x => x.classList.remove('open', 'ok', 'bad', 'hint')); st.lock = false;
      if (st.n >= DELIVERY.target) end(); else showOrder();
    }, id === want ? 450 : 900);
  };
  const end = () => { if (st.ended) return; st.ended = true; cancelAnimationFrame(st.raf); g.finish(deliveryScore(st.n)); };
  const onClick = e => { const b = e.target.closest('[data-stall]'); if (b) pick(b.dataset.stall); };
  root.addEventListener('click', onClick);
  const frame = now => {
    if (st.ended) return; const left = DELIVERY.seconds - (now - st.t0) / 1000 - st.penalty; setTime(root, left, DELIVERY.seconds);
    if (left <= 0) { end(); return; } st.raf = requestAnimationFrame(frame);
  };
  st.raf = requestAnimationFrame(frame);
  g.live(() => ({ kind: 'delivery', phase: st.ended ? 'done' : 'play', open: st.open, want: orders[st.i], n: st.n }));
  return () => { st.ended = true; clearTimeout(t1); cancelAnimationFrame(st.raf); root.removeEventListener('click', onClick); };
}

/* ---------------- Nhảy theo nhịp ---------------- */
function rhythm(g) {
  const { root, head, sfx, buzz, ctx } = g, chart = rhythmChart(Math.floor(Math.random() * 1e9)), done = chart.map(() => false);
  const st = { hits: 0, miss: 0, t0: performance.now(), raf: 0, ended: false, combo: 0 };
  const LANE_ICON = ['🎵', '⭐', '💖'];
  root.innerHTML = _t`<div class="mini-card play rhythm">${head('rhythm', _t('Chạm đúng làn khi nốt rơi tới vạch'))}
    <div class="mg-row"><span class="mg-pill" id="r-n">🎵 0/${chart.length}</span><span class="mg-pill" id="r-combo"></span></div>
    <div class="rh-field" id="r-field"><span class="rh-spot s1"></span><span class="rh-spot s2"></span><span class="rh-spot s3"></span>${[0, 1, 2].map(l => `<div class="rh-lane l${l}" data-lane-col="${l}"></div>`).join('')}<div class="rh-line"></div><div class="rh-floor"></div>
      ${chart.map((n, i) => `<span class="rh-note" id="rn-${i}" style="left:${(n.lane + 0.5) / 3 * 100}%">${LANE_ICON[n.lane]}</span>`).join('')}</div>
    <div class="rh-pads">${[0, 1, 2].map(l => _t`<button type="button" class="rh-pad p${l}" data-lane="${l}" aria-label="Làn ${l + 1}">${LANE_ICON[l]}</button>`).join('')}</div>
    <p class="mini-hint">Bàn phím: A · S · D hoặc ← ↓ →</p></div>`;
  const notes = chart.map((_, i) => root.querySelector(`#rn-${i}`)), field = root.querySelector('#r-field');
  const now = () => (performance.now() - st.t0) / 1000;
  const tap = lane => {
    if (st.ended) return; const i = rhythmHit(chart, done, lane, now()), pad = root.querySelector(`[data-lane="${lane}"]`);
    pad.classList.remove('hit', 'miss'); void pad.offsetWidth;
    if (i >= 0) { done[i] = true; st.hits++; st.combo++; notes[i].classList.add('got'); pad.classList.add('hit'); sfx('catch'); buzz(6); if (st.combo % 4 === 0) ctx.startAction?.('dance'); }
    else { st.combo = 0; pad.classList.add('miss'); }
    root.querySelector('#r-n').textContent = `🎵 ${st.hits}/${chart.length}`; root.querySelector('#r-combo').textContent = st.combo >= 3 ? _t`Liên tiếp ×${st.combo}` : '';
  };
  const onDown = e => { const b = e.target.closest('[data-lane]'); if (b) { e.preventDefault(); tap(+b.dataset.lane); } };
  const KEYS = { a: 0, s: 1, d: 2, A: 0, S: 1, D: 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 };
  const onKey = e => { if (e.key in KEYS && !e.repeat) { e.preventDefault(); tap(KEYS[e.key]); } };
  root.addEventListener('pointerdown', onDown); document.addEventListener('keydown', onKey);
  const end = () => { if (st.ended) return; st.ended = true; cancelAnimationFrame(st.raf); g.finish(rhythmScore(st.hits)); };
  const frame = () => {
    if (st.ended) return; const t = now(), h = field.clientHeight, lineY = h - 34;
    chart.forEach((n, i) => {
      const el = notes[i]; if (done[i]) { el.style.opacity = '0'; return; }
      const k = 1 - (n.t - t) / RHYTHM.fall; // 0 ở đỉnh, 1 ở vạch
      if (k < -0.05 || t - n.t > RHYTHM.window + 0.25) { el.style.opacity = '0'; if (t - n.t > RHYTHM.window && !el.dataset.missed) { el.dataset.missed = '1'; st.miss++; st.combo = 0; } return; }
      el.style.opacity = '1'; el.style.transform = `translate(-50%, ${k * lineY - 14}px)`;
    });
    if (t > chart[chart.length - 1].t + 0.8) { end(); return; }
    st.raf = requestAnimationFrame(frame);
  };
  st.raf = requestAnimationFrame(frame);
  g.live(() => ({ kind: 'rhythm', phase: st.ended ? 'done' : 'play', hits: st.hits, now: now(), chart, done }));
  return () => { st.ended = true; cancelAnimationFrame(st.raf); root.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
}

/* ---------------- Bắt sâu ---------------- */
function bugs(g) {
  const { root, head, sfx, buzz } = g;
  const st = { n: 0, t0: performance.now(), raf: 0, ended: false, cell: -1, kind: '', until: 0, next: 0 };
  root.innerHTML = _t`<div class="mini-card play">${head('bugs', _t`Bắt sâu bảo vệ vườn rau · ${BUGS.seconds} giây`)}${timerBar()}
    <div class="mg-row"><span class="mg-pill" id="b-n">🐛 0/${BUGS.target}</span><span class="mg-order" id="b-msg">Bọ rùa 🐞 là bạn, đừng bắt nhé!</span></div>
    <div class="bug-grid bug-bed">${Array.from({ length: BUGS.cells }, (_, i) => _t`<button type="button" class="bug-cell" data-cell="${i}" aria-label="Lá ${i + 1}"><span class="bug-leaf">🥬</span><span class="bug-who"></span></button>`).join('')}</div></div>`;
  const cells = [...root.querySelectorAll('.bug-cell')];
  const hide = () => { if (st.cell >= 0) cells[st.cell].classList.remove('up', 'friend'); st.cell = -1; };
  const show = (now, prog) => {
    hide(); let c; do { c = Math.floor(Math.random() * BUGS.cells); } while (c === st.last && BUGS.cells > 1);
    st.last = c; st.cell = c; st.kind = Math.random() < BUGS.ladybug ? 'friend' : 'bug';
    const el = cells[c]; el.querySelector('.bug-who').textContent = st.kind === 'friend' ? '🐞' : '🐛'; el.classList.add('up'); if (st.kind === 'friend') el.classList.add('friend');
    st.until = now + bugShowMs(prog); st.next = st.until + 120 + Math.random() * 220;
  };
  const hit = i => {
    if (st.ended || i !== st.cell) return;
    if (st.kind === 'bug') { st.n = Math.min(BUGS.target, st.n + 1); sfx('catch'); buzz(8); root.querySelector('#b-msg').textContent = _t('Bắt được rồi!'); }
    else { st.n = Math.max(0, st.n - 1); sfx('miss'); buzz(4); root.querySelector('#b-msg').textContent = _t('Ối, bọ rùa là bạn mà!'); }
    root.querySelector('#b-n').textContent = `🐛 ${st.n}/${BUGS.target}`; hide(); st.next = performance.now() + 200;
    if (st.n >= BUGS.target) end();
  };
  const onDown = e => { const b = e.target.closest('[data-cell]'); if (b) { e.preventDefault(); hit(+b.dataset.cell); } };
  root.addEventListener('pointerdown', onDown);
  const end = () => { if (st.ended) return; st.ended = true; cancelAnimationFrame(st.raf); hide(); g.finish(bugsScore(st.n)); };
  const frame = now => {
    if (st.ended) return; const el = (now - st.t0) / 1000, left = BUGS.seconds - el; setTime(root, left, BUGS.seconds);
    if (left <= 0) { end(); return; }
    if (st.cell >= 0 && now > st.until) hide();
    if (st.cell < 0 && now > st.next) show(now, el / BUGS.seconds);
    st.raf = requestAnimationFrame(frame);
  };
  st.next = performance.now() + 500; st.raf = requestAnimationFrame(frame);
  g.live(() => ({ kind: 'bugs', phase: st.ended ? 'done' : 'play', n: st.n, cell: st.cell, who: st.kind }));
  return () => { st.ended = true; cancelAnimationFrame(st.raf); root.removeEventListener('pointerdown', onDown); };
}

export const EXTRA_GAMES = { fish, quiz, delivery, rhythm, bugs };
export const EXTRA_TITLE = { fish: _t('Câu cá'), quiz: _t('Đố vui'), delivery: _t('Giao hàng'), rhythm: _t('Nhảy theo nhịp'), bugs: _t('Bắt sâu') };
export const EXTRA_INTRO = {
  fish: _t`Thả câu xuống ao, chờ phao chìm rồi bấm "Giật cần!" thật nhanh. Giật sớm quá cá sẽ chạy mất. Câu tối đa ${FISH.target} con trong ${FISH.seconds} giây.`,
  quiz: _t`${QUIZ.questions} câu đố vui, mỗi câu ${QUIZ.seconds} giây. Chọn đáp án đúng để giúp bé thông minh hơn!`,
  delivery: _t`Nhìn kỹ sạp nào bán gì trong ${DELIVERY.preview / 1000} giây, rồi hàng sẽ được che lại. Giao đúng ${DELIVERY.target} đơn hàng trong ${DELIVERY.seconds} giây nhé.`,
  rhythm: _t`Nốt nhạc rơi xuống 3 làn. Chạm đúng làn khi nốt rơi tới vạch để bé nhảy theo. ${RHYTHM.notes} nốt, trúng càng nhiều, xu càng nhiều.`,
  bugs: _t`Sâu đang ăn lá rau! Chạm vào sâu 🐛 để bắt, nhưng đừng bắt bọ rùa 🐞 vì bọ rùa là bạn của vườn. ${BUGS.seconds} giây.`,
};
export const EXTRA_UNIT = { fish: _t('con cá'), quiz: _t('câu đúng'), delivery: _t('đơn giao đúng'), rhythm: _t('nhịp trúng'), bugs: _t('con sâu') };
