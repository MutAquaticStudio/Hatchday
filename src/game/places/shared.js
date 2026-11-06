// Bộ dùng chung cho nơi chung (Quảng trường, Tiệm trà, Công viên): vào/rời kênh, thú của người khác, nhãn tên, emote, thẻ hồ sơ.
// Truyền tin ở src/net (SimTransport khi Chơi thử). Chat gõ chữ không ở đây (đợt chat riêng).
import { createTransport } from '../../net/transport';
import { EMOTES, emoteChar } from '../../net/protocol';
import { CHAT_REASON_TEXT, filterChat } from '../../net/moderation';
import * as api from '../../data/api';
import { viError } from '../../lib/errors';
import { SPECIES_BY_ID } from '../species';
import { disposePet } from '../pet3d.js';

const STAGE_SCALE = { baby: 0.78, child: 0.86, teen: 0.94 };
const MAX_FULL = 8; // tối đa 8 thú dựng đầy đủ, còn lại là hình khối nhẹ
const SPEED = 1.7;
const esc = v => String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* Giao diện dùng chung cho mọi nơi chung: một thanh emote, một lớp nhãn tên, một thẻ hồ sơ. `cur` là nơi đang mở. */
let bar = null, labels = null, card = null, countEl = null, cur = null, chatForm = null, chatLog = null;
const blocked = new Set(); // pid đã chặn: ẩn chat của họ

export function makeShared(c, { placeId, group }) {
  const { THREE, camera, ray, ndcFrom } = c;
  const actors = new Map(); const queue = [];
  let room = null, token = 0, active = false, sendAt = 0, last = { x: 1e9, z: 1e9 };
  const v = new THREE.Vector3();

  function ui() {
    if (labels) return;
    const app = document.getElementById('app');
    labels = document.createElement('div'); labels.className = 'actor-layer'; labels.hidden = true; app.appendChild(labels);
    bar = document.createElement('div'); bar.className = 'emote-bar'; bar.hidden = true;
    bar.innerHTML = `<div class="chat-log" id="chat-log" aria-live="polite"></div><form class="chat-box" id="chat-box" autocomplete="off"><input id="chat-in" maxlength="100" placeholder="Nói gì đó với mọi người…" aria-label="Tin nhắn"><button type="submit" class="btn-sm">Gửi</button></form><span class="eb-count" id="eb-count" role="status"></span><div class="eb-row" role="group" aria-label="Biểu cảm">${EMOTES.map(e => `<button type="button" class="eb" data-emote="${e.id}" title="${e.label}" aria-label="${e.label}">${e.e}</button>`).join('')}</div>`;
    const bottom = document.querySelector('.bottom'); bottom.insertBefore(bar, document.getElementById('ctx'));
    countEl = bar.querySelector('#eb-count'); chatForm = bar.querySelector('#chat-box'); chatLog = bar.querySelector('#chat-log');
    chatForm.addEventListener('submit', e => { e.preventDefault(); if (cur) cur.sendChat(chatForm.querySelector('input').value); });
    chatLog.addEventListener('click', e => { const l = e.target.closest('[data-msg]'); if (l && cur) cur.reportLine(l); });
    bar.addEventListener('click', e => { const b = e.target.closest('[data-emote]'); if (b && cur) cur.emote(b.dataset.emote); });
    card = document.createElement('div'); card.className = 'peer-card'; card.hidden = true; app.appendChild(card);
    card.addEventListener('click', e => { if (cur) cur.onCard(e); });
    window.addEventListener('pagehide', () => { if (cur) cur.pagehide(); });
  }
  function emote(id) {
    if (!room) return;
    room.sendEmote(id); c.say(emoteChar(id), 1800);
    if (id === 'wave' || id === 'cheer') c.startAction('hop');
    c.sfx('coin');
  }
  const setCount = t => { if (countEl) countEl.textContent = t; };
  const updateCount = () => { if (room) setCount(`${actors.size + 1}/${room.cap} người ở đây`); };

  function look() {
    const S = c.state, [x, z] = c.getPetXZ();
    return { name: S.name, family: S.family, species: S.species, stage: S.stage, form: S.form, genes: S.genes || {}, outfit: S.outfit || {}, bond_level: c.bondLevel(), x, z };
  }
  function addActor(p) {
    if (actors.has(p.pid)) return;
    const el = document.createElement('div'); el.className = 'actor'; el.innerHTML = `<span class="actor-emote"></span><b>${esc(p.name)}</b>`; labels.appendChild(el);
    const root = new THREE.Group(); root.position.set(p.x, 0, p.z); root.userData.pid = p.pid; group.add(root);
    const a = { peer: p, root, body: null, parts: null, x: p.x, z: p.z, tx: p.x, tz: p.z, yaw: 0, ph: Math.random() * 6, el, emoteUntil: 0, k: STAGE_SCALE[p.stage] || 1, moving: false };
    actors.set(p.pid, a); queue.push(a); updateCount();
  }
  function buildNext() { // tối đa một thú mỗi khung hình để không giật
    const a = queue.shift(); if (!a || !actors.has(a.peer.pid)) return;
    const g = new THREE.Group(), p = a.peer;
    if ([...actors.values()].filter(x => x.parts).length < MAX_FULL) {
      try { a.parts = c.petBuilder.build(g, { species: p.species, stage: p.stage, form: p.form || null, genes: p.genes || {}, face: true }); } catch (e) { a.parts = null; }
    }
    if (!a.parts) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), c.toon('#ffc9a8')); m.position.y = 0.5; g.add(m); }
    g.scale.setScalar(a.k); a.body = g; a.root.add(g);
  }
  function removeActor(pid) {
    const a = actors.get(pid); if (!a) return;
    a.el.remove(); if (a.body) disposePet(a.body); group.remove(a.root); actors.delete(pid); updateCount();
  }
  function showEmote(pid, id) {
    const a = actors.get(pid); if (!a) return;
    a.el.querySelector('.actor-emote').textContent = emoteChar(id); a.emoteUntil = performance.now() + 3200; a.el.classList.add('has-emote');
    if (id === 'wave' || id === 'cheer') a.hop = performance.now();
  }


  /* ---------- Chat công khai (máy chủ lọc và đóng dấu người gửi; ở đây chỉ hiển thị) ---------- */
  let armed = null;
  const setChat = on => { if (!chatForm) return; chatForm.hidden = !on; if (!on && chatLog) chatLog.innerHTML = '<span class="chat-off">Chat đang tạm tắt.</span>'; };
  function onChat(m) {
    if (!chatLog || blocked.has(m.pid)) return;
    chatLog.querySelector('.chat-off')?.remove();
    const mine = room && m.pid === room.pid, line = document.createElement('div');
    line.className = 'chat-line' + (mine ? ' mine' : ''); line.dataset.msg = m.id; line.dataset.pid = m.pid;
    line.innerHTML = `<b>${esc(m.name)}</b> ${esc(m.text)}`; chatLog.appendChild(line);
    while (chatLog.children.length > 4) chatLog.firstChild.remove();
    setTimeout(() => line.remove(), 16000);
    const a = actors.get(m.pid);
    if (a) { const say = a.el.querySelector('.actor-say') || a.el.insertBefore(Object.assign(document.createElement('span'), { className: 'actor-say' }), a.el.firstChild); say.textContent = m.text; a.sayUntil = performance.now() + 5000; a.el.classList.add('has-say'); }
  }
  async function sendChat(text) {
    if (!room || !text.trim()) return;
    const f = filterChat(text); if (!f.ok) { c.toast(CHAT_REASON_TEXT[f.reason] || 'Chưa gửi được.'); return; }
    const input = chatForm.querySelector('input'); input.disabled = true;
    try { const r = await api.postChat(room.topic, text); if (r.ok) input.value = ''; else c.toast(CHAT_REASON_TEXT[r.reason] || 'Chưa gửi được.'); }
    catch (e) { c.toast(viError(e)); }
    input.disabled = false; input.focus({ preventScroll: true });
  }
  async function reportLine(line) {
    if (line.classList.contains('mine') || !line.dataset.msg) return;
    if (armed !== line.dataset.msg) { armed = line.dataset.msg; c.toast('Chạm lần nữa vào tin này để báo cáo.'); setTimeout(() => { if (armed === line.dataset.msg) armed = null; }, 4000); return; }
    armed = null;
    try { await api.reportChat(+line.dataset.msg, 'other'); c.toast('Đã gửi báo cáo. Cảm ơn bạn đã giúp Hatchday an toàn.'); line.remove(); } catch (e) { c.toast(viError(e)); }
  }

  /* ---------- Thẻ hồ sơ khi chạm thú của người khác ---------- */
  let cardPid = null;
  function openCard(a) {
    const p = a.peer; cardPid = p.pid;
    card.innerHTML = `<div class="pc-top"><div><b>${esc(p.name)}</b><small>${esc(SPECIES_BY_ID[p.species]?.name || p.species)} · Gắn bó ${p.bond_level}${p.family ? ' · ' + esc(p.family) : ''}</small></div><button type="button" class="hs-close" data-pc="close" aria-label="Đóng">✕</button></div>
      <div class="pc-act"><button type="button" class="btn-sm" data-pc="friend">Kết bạn</button><button type="button" class="btn-sm ghost" data-pc="block">Chặn</button><button type="button" class="btn-sm ghost" data-pc="report">Báo cáo</button></div>`;
    card.hidden = false;
  }
  async function onCard(e) {
    const b = e.target.closest('[data-pc]'); if (!b) return;
    const k = b.dataset.pc, pid = cardPid; if (k === 'close') { card.hidden = true; return; }
    b.disabled = true;
    try {
      if (k === 'friend') { const r = await api.sendFriendRequest(pid); c.toast(r.status === 'accepted' ? 'Hai bạn đã là bạn bè!' : 'Đã gửi lời mời kết bạn.'); }
      else if (k === 'block') { await api.blockUser(pid); blocked.add(pid); c.toast('Đã chặn người này.'); removeActor(pid); card.hidden = true; }
      else if (k === 'report') { await api.reportUser(pid, 'other'); c.toast('Đã gửi báo cáo. Cảm ơn bạn đã giúp Hatchday an toàn.'); card.hidden = true; }
    } catch (err) { c.toast(viError(err)); }
    b.disabled = false;
  }

  const inst = {
    emote, onCard, sendChat, reportLine, pagehide: () => { if (room) room.leave(); },
    async enter() {
      ui(); cur = inst; active = true; const mine = ++token; bar.hidden = false; labels.hidden = false; setCount('Đang vào kênh…'); chatLog.innerHTML = ''; setChat(false);
      api.getPublicConfig().then(cfg => { if (mine === token) { setChat(cfg.chat_public === true); } }).catch(() => {});
      try {
        const tr = await createTransport(), r = await tr.join(placeId, look());
        if (mine !== token || !active) { await r.leave(); return; }
        room = r;
        r.on('join', addActor); r.on('leave', removeActor);
        r.on('intent', (pid, x, z) => { const a = actors.get(pid); if (a) { a.tx = x; a.tz = z; } });
        r.on('emote', showEmote); r.on('chat', onChat);
        r.peers().forEach(addActor); updateCount();
      } catch (e) { setCount('Chưa vào được kênh chung'); c.toast(viError(e)); }
    },
    leave() {
      active = false; token++; if (cur === inst) cur = null;
      if (bar) { bar.hidden = true; labels.hidden = true; card.hidden = true; }
      if (room) { room.leave(); room = null; }
      [...actors.keys()].forEach(removeActor); queue.length = 0;
    },
    update(dt, now) {
      if (!active) return;
      if (queue.length) buildNext();
      if (room && now - sendAt > 300) { sendAt = now; const [x, z] = c.getPetXZ(); if (Math.hypot(x - last.x, z - last.z) > 0.3) { last = { x, z }; room.sendIntent(x, z); } }
      const t = now / 1000;
      camera.updateMatrixWorld(true);
      const cw = c.canvas.clientWidth, ch = c.canvas.clientHeight;
      for (const a of actors.values()) {
        const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
        a.moving = d > 0.06;
        if (a.moving) { const s = Math.min(d, SPEED * dt); a.x += dx / d * s; a.z += dz / d * s; const want = Math.atan2(dx, dz); let dy = want - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 8); }
        else a.yaw += (0 - a.yaw) * Math.min(1, dt * 4);
        const hop = a.hop && now - a.hop < 500 ? Math.sin((now - a.hop) / 500 * Math.PI) * 0.35 : 0;
        a.root.position.set(a.x, (a.moving ? Math.abs(Math.sin(t * 9 + a.ph)) * 0.06 : 0) + hop, a.z);
        if (a.body) { a.body.rotation.y = a.yaw; a.body.scale.setScalar(a.k * (1 + (a.moving ? 0 : Math.sin(t * 2 + a.ph) * 0.012))); }
        if (a.parts) c.petBuilder.animate(a.parts, t, false);
        if (a.sayUntil && now > a.sayUntil) { a.sayUntil = 0; a.el.classList.remove('has-say'); }
        if (a.emoteUntil && now > a.emoteUntil) { a.emoteUntil = 0; a.el.classList.remove('has-emote'); }
        v.set(a.x, 2.0 * a.k + 0.2, a.z).project(camera);
        const vis = v.z < 1 && Math.abs(v.x) < 1.15;
        a.el.style.display = vis ? '' : 'none';
        if (vis) a.el.style.transform = `translate(${(v.x + 1) / 2 * cw}px, ${(1 - v.y) / 2 * ch}px) translate(-50%, -100%)`;
      }
    },
    /** Chạm vào thú của người khác? */
    tap(e) {
      const roots = [...actors.values()].filter(a => a.body).map(a => a.root); if (!roots.length) return false;
      ray.setFromCamera(ndcFrom(e), camera);
      const hit = ray.intersectObjects(roots, true)[0]; if (!hit) return false;
      let o = hit.object; while (o && !o.userData.pid) o = o.parent;
      const a = o && actors.get(o.userData.pid); if (!a) return false;
      openCard(a); c.hideHint(); return true;
    },
    peerCount: () => actors.size,
  };
  return inst;
}
