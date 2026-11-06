// Mini-game: Bắt bướm (Công viên) và Pha trà (Tiệm trà). Lớp phủ toàn màn hình, chơi bằng chạm một ngón, ~30 giây.
// Điểm báo lên máy chủ (submit_minigame): máy chủ chặn điểm vượt trần, giãn cách và chỉ trả xu cho vài lượt đầu mỗi ngày.
// Luật thuần nằm ở minigame-rules.ts (có test). Giảm chuyển động: bướm bay chậm hơn, không có hạt lấp lánh.
import { S, submitMinigame, refreshWorld } from './store';
import { BREW_STEPS, BUTTERFLY, brewScore, butterflyScore, inZone, markerAt, zoneCenter } from './minigame-rules';
import { MINI } from './world-activity';
import { viError } from '../lib/errors';

const COIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffd36e" stroke="#a8742e" stroke-width="2"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.5h-3a1.8 1.8 0 0 0 0 3.5h4" fill="none" stroke="#a8742e" stroke-width="1.8" stroke-linecap="round"/></svg>';
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#ff9ec4', '#ffd36e', '#c9a6ff', '#7ec8ff', '#ff9a76'];
const TITLE = { butterfly: 'Bắt bướm', brew: 'Pha trà' };
const INTRO = {
  butterfly: `Bướm đang bay quanh bé trong công viên. Chạm vào bướm, bé sẽ nhảy tới bắt! Bắt tối đa ${BUTTERFLY.target} con trong ${BUTTERFLY.seconds} giây, đủ sớm là xong sớm.`,
  brew: 'Năm bước pha trà. Mỗi bước có một thanh chạy qua lại, bấm "Dừng" khi vạch nằm trong vùng xanh. Trúng được sao nào, nhận xu sao đó.',
};

export function initMinigames({ ctx, app, $, reduce, sfx }) {
  let root = null, cur = null, raf = 0;

  function ensure() {
    if (root) return root;
    root = document.createElement('div'); root.id = 'mini'; root.className = 'mini'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    app.appendChild(root);
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', e => {
      if (!root || root.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if ((e.key === ' ' || e.key === 'Enter') && cur?.phase === 'play' && cur.kind === 'brew') { e.preventDefault(); stopBrew(); }
    });
    return root;
  }
  const left = kind => S.world?.mini?.[kind]?.left ?? MINI.plays;
  const bestOf = kind => S.world?.mini?.[kind]?.best ?? 0;

  function open(kind) {
    if (S.asleep) { ctx.toast('Bé đang ngủ, để bé nghỉ chút đã nhé.'); return; }
    ctx.closeAllSheets?.(); ensure(); cancelAnimationFrame(raf);
    cur = { kind, phase: 'intro' }; root.hidden = false; render();
    refreshWorld().then(() => { if (cur && cur.phase === 'intro') render(); }).catch(() => {});
  }
  function close() { cancelAnimationFrame(raf); if (ctl) { const c0 = ctl; ctl = null; cur = null; c0.stop(); } cur = null; if (root) { root.hidden = true; root.innerHTML = ''; } }

  const head = (kind, sub) => `<header class="mini-head"><div><h2>${TITLE[kind]}</h2><span>${sub}</span></div><button type="button" class="x" data-mini-close aria-label="Đóng">✕</button></header>`;

  function render() {
    if (!cur) return;
    const { kind } = cur, l = left(kind);
    if (cur.phase === 'intro') {
      root.innerHTML = `<div class="mini-card">${head(kind, l > 0 ? `Hôm nay còn ${l} lượt có xu` : 'Hết lượt có xu hôm nay, vẫn chơi vui được nha')}
        <p class="mini-intro">${INTRO[kind]}</p>
        <p class="mini-reward">${COIN_SVG}<span>${kind === 'butterfly' ? `${MINI.butterfly.per} xu mỗi con` : `${MINI.brew.per} xu mỗi sao`} · tối đa ${kind === 'butterfly' ? MINI.butterfly.max * MINI.butterfly.per : MINI.brew.max * MINI.brew.per} xu mỗi lượt${bestOf(kind) ? ` · kỷ lục hôm nay ${bestOf(kind)}` : ''}</span></p>
        <div class="mini-actions"><button type="button" class="btn-sm" data-mini-start>Bắt đầu</button><button type="button" class="btn-sm ghost" data-mini-close>Để sau</button></div></div>`;
      root.querySelector('[data-mini-start]').focus?.();
      return;
    }
    if (cur.phase === 'result') {
      const r = cur.result, err = r instanceof Error;
      const body = err ? `<p class="mini-intro">${esc(viError(r))}</p>` : `<div class="mini-score"><b>${cur.score}</b><span>${kind === 'butterfly' ? 'con bướm' : 'sao'}</span></div>
        <p class="mini-reward">${r.rewarded ? `${COIN_SVG}<span>Nhận +${r.reward} xu!</span>` : '<span>Hết lượt có xu hôm nay rồi, mai chơi tiếp nha.</span>'}</p>
        ${kind === 'brew' ? `<p class="mini-stars" aria-hidden="true">${cur.hits.map(h => (h ? '⭐' : '☆')).join('')}</p>` : ''}`;
      const again = !err && r.left > 0;
      root.innerHTML = `<div class="mini-card">${head(kind, err ? 'Chưa lưu được điểm' : cur.score >= (kind === 'butterfly' ? BUTTERFLY.target : 5) ? 'Hoàn hảo!' : 'Xong rồi!')}${body}
        <div class="mini-actions">${again ? '<button type="button" class="btn-sm" data-mini-start>Chơi lại</button>' : ''}<button type="button" class="btn-sm ${again ? 'ghost' : ''}" data-mini-close>Xong</button></div></div>`;
      return;
    }
  }

  function onClick(e) {
    if (e.target.closest('[data-mini-close]')) { close(); return; }
    if (e.target.closest('[data-mini-start]')) { start(cur.kind); return; }
    if (e.target.closest('[data-brew-stop]')) { stopBrew(); return; }
  }
  function start(kind) {
    if (S.asleep) { close(); return; }
    cancelAnimationFrame(raf);
    if (kind === 'butterfly') startButterfly(); else startBrew();
  }
  async function finish(score, extra = {}) {
    cancelAnimationFrame(raf);
    cur = { ...cur, phase: 'result', score, ...extra, result: null }; root.innerHTML = `<div class="mini-card">${head(cur.kind, 'Đang lưu điểm…')}<p class="mini-intro">Chờ xíu nha…</p></div>`;
    const kind = cur.kind, r = await submitMinigame(kind, score);
    if (!cur || cur.kind !== kind || cur.phase !== 'result') return;
    cur.result = r; render();
    if (!(r instanceof Error)) { sfx(r.reward ? 'coin' : 'badge'); if (r.reward) ctx.popText?.(`+${r.reward} xu`, '#a8742e'); ctx.spawn?.('sparkle', 3); }
  }

  /* ---------------- Bắt bướm: chơi ngay trong Công viên 3D (park.js lo bướm và cú chạm); ở đây chỉ có thanh điểm/giờ ---------------- */
  let hud = null, ctl = null, hudTimer = 0;
  function showHud(on) {
    if (!hud) { hud = document.createElement('div'); hud.id = 'mini-hud'; hud.className = 'mini-hud-bar'; hud.hidden = true; app.appendChild(hud); hud.addEventListener('click', e => { if (e.target.closest('[data-catch-stop]')) ctl?.stop(); }); }
    hud.hidden = !on; app.classList.toggle('catching', on);
  }
  function startButterfly() {
    const st = cur = { kind: 'butterfly', phase: 'play' };
    let caught = 0, t0 = performance.now();
    ctl = ctx.catchGame({
      seconds: BUTTERFLY.seconds, target: BUTTERFLY.target, count: BUTTERFLY.onScreen,
      onCatch: n => { caught = n; ctx.buzz?.(8); paint(); },
      onEnd: (n, aborted) => { clearInterval(hudTimer); showHud(false); ctl = null; window.__miniState = null; if (cur !== st) return; if (aborted && n === 0) { close(); return; } root.hidden = false; finish(butterflyScore(n)); },
    });
    if (!ctl) { ctx.toast('Ra Công viên để bắt bướm nhé!'); close(); return; }
    root.hidden = true; ctx.hideHint?.(); ctx.toast?.('Chạm vào bướm để bé nhảy tới bắt!');
    const paint = () => { const left = Math.max(0, BUTTERFLY.seconds - Math.floor((performance.now() - t0) / 1000)); hud.innerHTML = `<span class="mh-score">🦋 ${caught}/${BUTTERFLY.target}</span><span class="mh-time">${left}</span><button type="button" class="btn-sm ghost" data-catch-stop>Dừng</button>`; };
    showHud(true); paint(); hudTimer = setInterval(paint, 250);
    window.__miniState = () => { const s = ctx.catchState(); return { kind: 'butterfly', phase: st.phase, caught: s ? s.caught : caught, bs: s ? s.bs : [] }; };
  }

  /* ---------------- Pha trà ---------------- */
  function startBrew() {
    const st = cur = { kind: 'brew', phase: 'play', step: 0, hits: [], t0: performance.now(), phase0: Math.random(), zones: BREW_STEPS.map(s => zoneCenter(s.zone, Math.random())), frozen: null };
    window.__miniState = () => ({ kind: 'brew', phase: st.phase, step: st.step, marker: st.marker, zone: st.zones[st.step] && [st.zones[st.step], BREW_STEPS[st.step]?.zone], hits: st.hits });
    renderBrew();
    const frame = now => {
      if (cur !== st || st.phase !== 'play') return;
      const s = BREW_STEPS[st.step], sp = reduce ? s.speed * 0.7 : s.speed;
      st.marker = st.frozen ?? markerAt((now - st.t0) / 1000, sp, st.phase0);
      const m = root.querySelector('#b-mark'); if (m) m.style.left = `${st.marker * 100}%`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  function renderBrew() {
    const st = cur, s = BREW_STEPS[st.step], c = st.zones[st.step];
    root.innerHTML = `<div class="mini-card play">${head('brew', `Bước ${st.step + 1}/${BREW_STEPS.length}`)}
      <div class="brew-stars" aria-label="${st.hits.filter(Boolean).length} sao">${BREW_STEPS.map((_, i) => (i < st.hits.length ? (st.hits[i] ? '⭐' : '☆') : '·')).join(' ')}</div>
      <h3 class="brew-step">${s.label}</h3><p class="mini-intro">${s.hint}</p>
      <div class="brew-bar" id="b-bar"><i class="brew-zone" style="left:${(c - s.zone / 2) * 100}%;width:${s.zone * 100}%"></i><b class="brew-mark" id="b-mark"></b></div>
      <div class="mini-actions"><button type="button" class="btn-sm big" data-brew-stop>Dừng!</button></div>
      <p class="mini-hint">Bấm nút hoặc phím Space khi vạch nằm trong vùng xanh</p></div>`;
  }
  function stopBrew() {
    const st = cur; if (!st || st.phase !== 'play' || st.kind !== 'brew' || st.frozen !== null) return;
    const s = BREW_STEPS[st.step], hit = inZone(st.marker ?? 0, st.zones[st.step], s.zone);
    st.frozen = st.marker; st.hits.push(hit); sfx(hit ? 'catch' : 'miss'); ctx.buzz?.(hit ? 10 : 4);
    const bar = root.querySelector('#b-bar'); if (bar) bar.classList.add(hit ? 'ok' : 'bad');
    const stop = root.querySelector('[data-brew-stop]'); if (stop) stop.disabled = true;
    setTimeout(() => {
      if (cur !== st) return;
      if (st.step + 1 >= BREW_STEPS.length) { finish(brewScore(st.hits), { hits: st.hits }); return; }
      st.step++; st.frozen = null; st.t0 = performance.now(); st.phase0 = Math.random(); renderBrew();
    }, reduce ? 350 : 650);
  }

  return { open, close, isOpen: () => !!root && !root.hidden };
}
