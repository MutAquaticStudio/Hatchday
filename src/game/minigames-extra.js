// Năm mini-game mới chơi trong lớp phủ (cùng khung với Pha trà ở minigames.js): Câu cá, Đố vui, Giao hàng, Nhảy theo nhịp, Bắt sâu.
// Mỗi trò nhận `g` = { root, head, finish(score, extra), sfx, buzz, reduce, ctx, live(fn) } và trả về hàm dọn dẹp.
// Luật thuần (điểm, đề, nhịp) nằm ở minigame-rules.ts (có test); máy chủ chặn điểm vượt trần như các trò cũ.
import {
  BUGS, bugShowMs, bugsScore, DELIVERY, DELIVERY_STALLS, deliveryOrders, deliveryScore, FISH, fishBiteWindow, fishScore,
  pickQuiz, QUIZ, quizScore, RHYTHM, rhythmChart, rhythmHit, rhythmScore, seeded, shuffled,
} from './minigame-rules';

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const timerBar = () => '<div class="mg-timer"><i id="mg-time"></i></div>';
const setTime = (root, left, total) => { const t = root.querySelector('#mg-time'); if (t) t.style.width = `${Math.max(0, left / total) * 100}%`; };

/* ---------------- Câu cá ---------------- */
function fish(g) {
  const { root, head, sfx, buzz, reduce } = g;
  const st = { phase: 'cast', caught: 0, t0: performance.now(), biteAt: 0, timer: 0, raf: 0, ended: false, msg: 'Chạm "Thả câu" rồi chờ phao chìm nhé!' };
  root.innerHTML = `<div class="mini-card play">${head('fish', `Câu tối đa ${FISH.target} con trong ${FISH.seconds} giây`)}
    ${timerBar()}<div class="mg-row"><span class="mg-pill" id="f-n">🐟 0/${FISH.target}</span></div>
    <div class="fish-pond" id="f-pond"><span class="fish-ripple r1"></span><span class="fish-ripple r2"></span><span class="fish-pad p1"></span><span class="fish-pad p2"><i></i></span><span class="fish-pad p3"></span><span class="fish-reeds l"><i></i><i></i><i></i></span><span class="fish-reeds r"><i></i><i></i></span><span class="fish-shadow s1"><svg class="fish-svg" viewBox="0 0 60 30" aria-hidden="true"><path d="M4 15c8-12 30-12 40 0-10 12-32 12-40 0z" fill="currentColor"/><path d="M42 15l14-9v18z" fill="currentColor"/></svg></span><span class="fish-shadow s2"><svg class="fish-svg" viewBox="0 0 60 30" aria-hidden="true"><path d="M4 15c8-12 30-12 40 0-10 12-32 12-40 0z" fill="currentColor"/><path d="M42 15l14-9v18z" fill="currentColor"/></svg></span><span class="fish-shadow s3"><svg class="fish-svg" viewBox="0 0 60 30" aria-hidden="true"><path d="M4 15c8-12 30-12 40 0-10 12-32 12-40 0z" fill="currentColor"/><path d="M42 15l14-9v18z" fill="currentColor"/></svg></span><span class="fish-line"></span><b class="fish-bob" id="f-bob" aria-hidden="true"><i></i></b><span class="fish-dock"></span><span class="fish-catch" id="f-catch"></span></div>
    <p class="mini-intro" id="f-msg">${st.msg}</p>
    <div class="mini-actions"><button type="button" class="btn-sm big" id="f-btn" data-fish>Thả câu</button></div></div>`;
  const $ = s => root.querySelector(s), btn = $('#f-btn'), bob = $('#f-bob'), pond = $('#f-pond');
  const say = (m, cls = '') => { $('#f-msg').textContent = m; pond.className = 'fish-pond ' + cls; };
  const cast = () => {
    st.phase = 'wait'; btn.textContent = 'Giật cần!'; say('Suỵt… chờ phao chìm…', 'waiting'); sfx('splash');
    const wait = FISH.waitMin + Math.random() * (FISH.waitMax - FISH.waitMin);
    clearTimeout(st.timer); st.timer = setTimeout(() => { if (st.ended) return; st.phase = 'bite'; st.biteAt = performance.now(); say('Cắn câu rồi! Giật nhanh!', 'bite'); buzz(20); sfx('boing');
      st.timer = setTimeout(() => { if (st.phase === 'bite' && !st.ended) { st.phase = 'cast'; btn.textContent = 'Thả câu'; say('Cá chạy mất rồi, thử lại nha.'); sfx('miss'); } }, fishBiteWindow(st.caught)); }, wait);
  };
  const pull = () => {
    if (st.phase === 'cast') { cast(); return; }
    clearTimeout(st.timer);
    if (st.phase === 'wait') { st.phase = 'cast'; btn.textContent = 'Thả câu'; say('Sớm quá, cá giật mình bơi đi mất!'); sfx('miss'); return; }
    if (st.phase === 'bite') {
      st.caught++; st.phase = 'cast'; btn.textContent = 'Thả câu'; sfx('catch'); buzz(12);
      const c = $('#f-catch'); c.textContent = ['🐟', '🐠', '🐡', '🦐'][st.caught % 4]; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
      $('#f-n').textContent = `🐟 ${st.caught}/${FISH.target}`; say(st.caught >= FISH.target ? 'Đủ rồi! Câu giỏi ghê!' : `Được ${st.caught} con! Thả câu tiếp nào.`);
      if (st.caught >= FISH.target) end();
    }
  };
  const end = () => { if (st.ended) return; st.ended = true; clearTimeout(st.timer); cancelAnimationFrame(st.raf); setTimeout(() => g.finish(fishScore(st.caught)), reduce ? 200 : 500); };
  btn.addEventListener('click', pull);
  const onKey = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pull(); } }; document.addEventListener('keydown', onKey);
  const frame = now => {
    if (st.ended) return; const left = FISH.seconds - (now - st.t0) / 1000; setTime(root, left, FISH.seconds);
    if (bob) bob.style.transform = st.phase === 'bite' ? `translateY(${6 + Math.sin(now / 40) * 4}px)` : `translateY(${Math.sin(now / 400) * 3}px)`;
    if (left <= 0) { end(); return; } st.raf = requestAnimationFrame(frame);
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
    root.innerHTML = `<div class="mini-card play">${head('quiz', `Câu ${st.i + 1}/${qs.length} · đúng ${st.right}`)}${timerBar()}
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
  root.innerHTML = `<div class="mini-card play">${head('delivery', 'Nhớ sạp nào bán gì, rồi giao đúng chỗ')}${timerBar()}
    <div class="mg-row"><span class="mg-pill" id="d-n">📦 0/${DELIVERY.target}</span></div><div class="deliv-order"><span class="deliv-cust" aria-hidden="true">🧑‍🍳</span><span class="mg-order" id="d-order">Nhìn kỹ các sạp nhé…</span></div>
    <div class="deliv-grid">${tiles.map(s => `<button type="button" class="deliv-tile open st-${s.id}" data-stall="${s.id}"><span class="dt-roof" aria-hidden="true"></span><span class="dt-icon">${s.icon}</span><span class="dt-box" aria-hidden="true">?</span><b>${esc(s.name)}</b></button>`).join('')}</div>
    <p class="mini-hint">Đơn sai bị trừ ${DELIVERY.penalty} giây</p></div>`;
  const $ = s => root.querySelector(s);
  const showOrder = () => { const s = byId[orders[st.i]]; $('#d-order').innerHTML = `Giao <span class="dt-big">${s.icon}</span> tới sạp nào?`; };
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
  root.innerHTML = `<div class="mini-card play rhythm">${head('rhythm', 'Chạm đúng làn khi nốt chạm vạch')}
    <div class="mg-row"><span class="mg-pill" id="r-n">🎵 0/${chart.length}</span><span class="mg-pill" id="r-combo"></span></div>
    <div class="rh-field" id="r-field"><span class="rh-spot s1"></span><span class="rh-spot s2"></span><span class="rh-spot s3"></span>${[0, 1, 2].map(l => `<div class="rh-lane l${l}" data-lane-col="${l}"></div>`).join('')}<div class="rh-line"></div><div class="rh-floor"></div>
      ${chart.map((n, i) => `<span class="rh-note" id="rn-${i}" style="left:${(n.lane + 0.5) / 3 * 100}%">${LANE_ICON[n.lane]}</span>`).join('')}</div>
    <div class="rh-pads">${[0, 1, 2].map(l => `<button type="button" class="rh-pad p${l}" data-lane="${l}" aria-label="Làn ${l + 1}">${LANE_ICON[l]}</button>`).join('')}</div>
    <p class="mini-hint">Bàn phím: A · S · D hoặc ← ↓ →</p></div>`;
  const notes = chart.map((_, i) => root.querySelector(`#rn-${i}`)), field = root.querySelector('#r-field');
  const now = () => (performance.now() - st.t0) / 1000;
  const tap = lane => {
    if (st.ended) return; const i = rhythmHit(chart, done, lane, now()), pad = root.querySelector(`[data-lane="${lane}"]`);
    pad.classList.remove('hit', 'miss'); void pad.offsetWidth;
    if (i >= 0) { done[i] = true; st.hits++; st.combo++; notes[i].classList.add('got'); pad.classList.add('hit'); sfx('catch'); buzz(6); if (st.combo % 4 === 0) ctx.startAction?.('dance'); }
    else { st.combo = 0; pad.classList.add('miss'); }
    root.querySelector('#r-n').textContent = `🎵 ${st.hits}/${chart.length}`; root.querySelector('#r-combo').textContent = st.combo >= 3 ? `Combo ×${st.combo}` : '';
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
  root.innerHTML = `<div class="mini-card play">${head('bugs', `Bắt sâu bảo vệ vườn rau · ${BUGS.seconds} giây`)}${timerBar()}
    <div class="mg-row"><span class="mg-pill" id="b-n">🐛 0/${BUGS.target}</span><span class="mg-order" id="b-msg">Bọ rùa 🐞 là bạn, đừng bắt nhé!</span></div>
    <div class="bug-grid bug-bed">${Array.from({ length: BUGS.cells }, (_, i) => `<button type="button" class="bug-cell" data-cell="${i}" aria-label="Lá ${i + 1}"><span class="bug-leaf">🥬</span><span class="bug-who"></span></button>`).join('')}</div></div>`;
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
    if (st.kind === 'bug') { st.n = Math.min(BUGS.target, st.n + 1); sfx('catch'); buzz(8); root.querySelector('#b-msg').textContent = 'Bắt được rồi!'; }
    else { st.n = Math.max(0, st.n - 1); sfx('miss'); buzz(4); root.querySelector('#b-msg').textContent = 'Ối, bọ rùa là bạn mà!'; }
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
export const EXTRA_TITLE = { fish: 'Câu cá', quiz: 'Đố vui', delivery: 'Giao hàng', rhythm: 'Nhảy theo nhịp', bugs: 'Bắt sâu' };
export const EXTRA_INTRO = {
  fish: `Thả câu xuống ao, chờ phao chìm rồi bấm "Giật cần!" thật nhanh. Giật sớm quá cá sẽ chạy mất. Câu tối đa ${FISH.target} con trong ${FISH.seconds} giây.`,
  quiz: `${QUIZ.questions} câu đố vui, mỗi câu ${QUIZ.seconds} giây. Chọn đáp án đúng để giúp bé thông minh hơn!`,
  delivery: `Nhìn kỹ sạp nào bán gì trong ${DELIVERY.preview / 1000} giây, rồi các sạp sẽ úp lại. Giao đúng ${DELIVERY.target} đơn hàng trong ${DELIVERY.seconds} giây nhé.`,
  rhythm: `Nốt nhạc rơi xuống 3 làn. Chạm đúng làn khi nốt chạm vạch để bé nhảy theo. ${RHYTHM.notes} nốt, trúng càng nhiều càng nhiều xu.`,
  bugs: `Sâu đang ăn lá rau! Chạm vào sâu 🐛 để bắt, nhưng đừng bắt bọ rùa 🐞 vì bọ rùa là bạn của vườn. ${BUGS.seconds} giây.`,
};
export const EXTRA_UNIT = { fish: 'con cá', quiz: 'câu đúng', delivery: 'đơn giao đúng', rhythm: 'nhịp trúng', bugs: 'con sâu' };
