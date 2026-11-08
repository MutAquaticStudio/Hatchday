// Bạn bè, hộp thư, quà tặng, tin tức và thăm nhà bạn (giao diện của các RPC xã hội trong supabase/migrations/20261203..20261205).
// Dữ liệu nằm ở máy chủ; ở đây chỉ giữ bản sao ngắn hạn để vẽ. Luật và hạn mức: social.ts.
import { _t } from '../i18n';
import * as api from '../data/api';
import { viError } from '../lib/errors';
import { CHAT_REASON_TEXT } from '../net/moderation';
import { BY_ID, FOODS } from './catalog';
import { MEDICINES } from './health';
import { GIFT_NOTES, GUESTBOOK, SOCIAL, isGiftable } from './social';
import { SPECIES_BY_ID } from './species';
import { sfx } from './audio.js';

const EMOTE = { heart: '❤️', star: '⭐', smile: '😊', cake: '🍰', flower: '🌸' };
const KIND = { update: _t('Cập nhật'), event: _t('Sự kiện'), maintenance: _t('Bảo trì'), notice: _t('Thông báo') };
const POLL_MS = 60000, FOCUS_MIN_MS = 15000;

export function initSocial({ ctx, S, store, esc, head, open, closeAll, thumb, fillThumbs, app, $, onChange = () => {} }) {
  const D = { together: { playdates: [], notes: [] }, noteFor: null, tab: 'friends', state: null, friends: [], req: { incoming: [], outgoing: [] }, inbox: [], news: [], sum: { mail_unread: 0, news_unread: 0, requests_in: 0, dm_unread: 0 }, dm: { threads: [], open: null, msgs: [] }, armed: new Set(), busy: false };
  let visit = null, gift = null, lastPoll = 0, lastMail = -1;

  const nameOf = id => BY_ID[id]?.name || FOODS.find(f => f.id === id)?.name || MEDICINES.find(m => m.id === id)?.name || id;
  const speciesOf = p => SPECIES_BY_ID[p.species]?.name || p.species;
  const wear = p => Object.values(p.outfit || {}).join(',');
  const petImg = (p, size = 56) => `<img class="soc-pet" data-thumb="pet:${esc(p.species)}:${esc(p.stage)}:${esc(p.form || '')}:${esc(wear(p))}" alt="" width="${size}" height="${size}">`;
  const itemsText = list => list.map(i => `${esc(nameOf(i.id))} ×${i.qty}`).join(', ');
  const total = () => D.sum.mail_unread + D.sum.requests_in + D.sum.news_unread + (D.sum.dm_unread || 0);
  const sub = () => _t`${D.sum.mail_unread} thư mới · ${D.sum.requests_in} lời mời · ${D.sum.news_unread} tin chưa đọc${D.sum.dm_unread ? _t` · ${D.sum.dm_unread} tin nhắn` : ''}`;
  const say = (msg, ms = 2600) => ctx.toast(msg, ms);

  /* ---------- Tải dữ liệu ---------- */
  async function loadSummary() {
    try {
      const [s, dm] = await Promise.all([api.getSocialSummary(), api.dmUnread().catch(() => 0)]); lastPoll = Date.now(); D.sum = { ...s, dm_unread: dm };
      if (lastMail >= 0 && s.mail_unread > lastMail && !ctx.isBusy?.()) ctx.say?.(_t('Có thư mới trong hộp thư nè!'), 3000);
      lastMail = s.mail_unread; onChange();
    } catch { /* mạng chập chờn: lần sau thử lại */ }
  }
  async function loadAll() {
    const r = await Promise.allSettled([api.getSocialState(), api.listFriends(), api.listRequests(), api.getInbox(), api.getNews(), loadSummary(), api.listDmThreads(), api.listPlaydates(), api.getGuestNotes()]);
    if (r[7].status === 'fulfilled') D.together.playdates = r[7].value;
    if (r[8].status === 'fulfilled') D.together.notes = r[8].value;
    if (r[6].status === 'fulfilled') D.dm.threads = r[6].value;
    if (r[0].status === 'fulfilled') D.state = r[0].value;
    if (r[1].status === 'fulfilled') D.friends = r[1].value;
    if (r[2].status === 'fulfilled') D.req = r[2].value;
    if (r[3].status === 'fulfilled') D.inbox = r[3].value.mail;
    if (r[4].status === 'fulfilled') D.news = r[4].value;
    if (!$('social').hidden) render();
  }
  /** Poll nhẹ: lúc mở game, mỗi 60 giây, và khi quay lại tab (cách lần trước ≥ 15 giây). */
  function startPolling() {
    loadSummary();
    setInterval(() => { if (document.visibilityState === 'visible') loadSummary(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastPoll > FOCUS_MIN_MS) loadSummary(); });
  }

  /* ---------- Sheet chính: Bạn bè · Hộp thư · Tin tức ---------- */
  function openSocial(tab = 'friends') {
    D.tab = tab; D.armed.clear(); if (tab !== 'dm') D.dm.open = null; open('social'); render(); loadAll();
  }
  function tabs() {
    const t = (id, label, n) => `<button type="button" class="tab" role="tab" data-soc-tab="${id}" aria-selected="${D.tab === id}">${label}${n ? ` <i class="soc-badge">${n}</i>` : ''}</button>`;
    return _t`<div class="tabs soc-tabs" role="tablist">${t('friends', _t('Bạn bè'), D.sum.requests_in)}${t('mail', _t('Hộp thư'), D.sum.mail_unread + pendingIn())}${t('news', _t('Tin tức'), D.sum.news_unread)}${t('dm', _t('Tin nhắn'), D.sum.dm_unread)}</div>`;
  }
  function render() {
    const el = $('social'); if (!el) return;
    el.innerHTML = head(_t('Bạn bè &amp; thư'), sub()) + tabs() + `<div class="hs-body soc-body">${({ friends: friendsTab, mail: () => togetherTab() + mailTab(), news: newsTab, dm: dmTab })[D.tab]()}</div>`;
    fillThumbs(el);
    if (D.tab === 'news') markNewsRead();
  }

  const pendingIn = () => D.together.playdates.filter(x => x.incoming && x.status === 'pending').length;
  const noteForm = p => _t`<form class="chat-box note-form" data-soc-form="note" data-who="${esc(p.pid)}" autocomplete="off"><input id="note-in" maxlength="100" placeholder="Lời nhắn cho ${esc(p.name)}…" aria-label="Lời nhắn"><button class="btn-sm" type="submit">Gửi</button></form>`;
  function togetherTab() {
    const pd = D.together.playdates, notes = D.together.notes, when = iso => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const pdRows = pd.length ? _t`<ul class="soc-list">${pd.map(x => _t`<li class="soc-row"><div class="soc-info"><b>${x.incoming ? _t`${esc(x.from_name)} rủ bé đi chơi` : _t`Bạn đã rủ ${esc(x.to_name)}`}</b><small>${x.status === 'done' ? _t('Đã chơi cùng nhau 🎈') : x.incoming ? _t('Đang chờ bạn đồng ý') : _t('Đang chờ bạn ấy đồng ý')} · ${when(x.at)}</small></div>
      <div class="soc-act">${x.incoming && x.status === 'pending' ? _t`<button type="button" class="btn-sm" data-soc="pdyes" data-id="${x.id}">Đi chơi (+15 xu)</button><button type="button" class="btn-sm ghost" data-soc="pdno" data-id="${x.id}">Để sau</button>` : ''}</div></li>`).join('')}</ul>`
      : _t('<p class="hs-note">Chưa có lời hẹn nào. Vào tab Bạn bè, bấm "Hẹn chơi" để rủ bé nhà bạn đi chơi.</p>');
    const noteRows = notes.length ? _t`<ul class="soc-list">${notes.map(n => _t`<li class="soc-row"><div class="soc-info"><b>${esc(n.author)}</b><small>${esc(n.body)}</small><small>${when(n.at)}</small></div><div class="soc-act"><button type="button" class="btn-sm ghost" data-soc="delnote" data-id="${n.id}">Xoá</button></div></li>`).join('')}</ul>`
      : _t('<p class="hs-note">Chưa có lời nhắn nào. Bạn bè có thể để lại lời nhắn cho bạn mỗi ngày một lần.</p>');
    return _t`<h3 class="qh">Hẹn chơi</h3>${pdRows}<p class="hs-note">Hẹn chơi: mỗi cặp bạn một lần mỗi ngày. Khi bạn ấy đồng ý, cả hai bé được +15 xu, +3 Gắn bó và một ký ức mới.</p>
      <h3 class="qh">Lời nhắn bạn bè gửi bạn</h3>${noteRows}<h3 class="qh">Thư và quà</h3>`;
  }
  function person(p, actions, extra = '') {
    return _t`<li class="soc-row">${petImg(p)}<div class="soc-info"><b>${esc(p.name)}</b><small>${esc(speciesOf(p))} · Gắn bó ${p.bond_level}${extra}</small></div><div class="soc-act">${actions}</div></li>`;
  }
  const armBtn = (key, label, cls, who) => D.armed.has(key + who)
    ? _t`<button type="button" class="btn-sm" data-soc="${key}" data-who="${esc(who)}">Chắc chứ?</button>`
    : `<button type="button" class="btn-sm ghost ${cls || ''}" data-soc-arm="${key}" data-who="${esc(who)}">${label}</button>`;

  function friendsTab() {
    const st = D.state;
    if (st && st.ready === false) return _t('<p class="hs-note">Hãy đón một bé trước, rồi bạn sẽ có mã bạn bè.</p>');
    const priv = st?.privacy || { friends: 'all', online: 'friends' };
    const reqs = D.req.incoming.length ? _t`<h3 class="soc-h">Lời mời kết bạn</h3><ul class="soc-list">${D.req.incoming.map(p => person(p,
      _t`<button type="button" class="btn-sm" data-soc="accept" data-who="${esc(p.pid)}">Đồng ý</button><button type="button" class="btn-sm ghost" data-soc="decline" data-who="${esc(p.pid)}">Từ chối</button>`)).join('')}</ul>` : '';
    const out = D.req.outgoing.length ? _t`<p class="hs-note">Đang chờ ${D.req.outgoing.length} người trả lời lời mời của bạn.</p>` : '';
    const list = D.friends.length ? _t`<ul class="soc-list">${D.friends.map(p => person(p,
      _t`<button type="button" class="btn-sm" data-soc="visit" data-who="${esc(p.pid)}">Ghé thăm</button><button type="button" class="btn-sm ghost" data-soc="gift" data-who="${esc(p.pid)}">Tặng quà</button><button type="button" class="btn-sm ghost" data-soc="dm" data-who="${esc(p.pid)}">Nhắn tin</button><button type="button" class="btn-sm ghost" data-soc="playdate" data-who="${esc(p.pid)}">Hẹn chơi</button><button type="button" class="btn-sm ghost" data-soc="note" data-who="${esc(p.pid)}">Lời nhắn</button>${D.noteFor === p.pid ? noteForm(p) : ''}${armBtn('remove', _t('Bỏ bạn'), '', p.pid)}${armBtn('block', _t('Chặn'), '', p.pid)}`)).join('')}</ul>`
      : _t('<p class="hs-note">Chưa có bạn nào. Nhập mã bạn bè của người khác ở trên để kết bạn.</p>');
    return _t`<section class="soc-card"><div><small>Mã bạn bè của bạn</small><b class="soc-code" id="soc-mycode">${esc(st?.friend_code || '········')}</b></div><button type="button" class="btn-sm ghost" data-soc="copy">Sao chép</button></section>
      <form class="soc-add" data-soc-form="add" autocomplete="off"><input id="soc-code" maxlength="12" inputmode="text" autocapitalize="characters" placeholder="Nhập mã bạn bè (8 ký tự)" aria-label="Mã bạn bè"><button class="btn-sm" type="submit">Kết bạn</button></form>
      ${isDemoHint()}${reqs}${out}<h3 class="soc-h">Bạn bè${st ? ` (${st.friends ?? D.friends.length}/${st.cap ?? '?'})` : ''}</h3>${list}
      <h3 class="soc-h">Riêng tư</h3><div class="soc-priv">
        <button type="button" class="btn-sm ${priv.friends === 'all' ? 'on' : 'ghost'}" data-soc="priv" data-key="friends" data-val="${priv.friends === 'all' ? 'none' : 'all'}" aria-pressed="${priv.friends === 'all'}">${priv.friends === 'all' ? _t('Nhận lời mời kết bạn') : _t('Đang không nhận lời mời')}</button>
        <button type="button" class="btn-sm ${priv.online === 'friends' ? 'on' : 'ghost'}" data-soc="priv" data-key="online" data-val="${priv.online === 'friends' ? 'none' : 'friends'}" aria-pressed="${priv.online === 'friends'}">${priv.online === 'friends' ? _t('Bạn bè thấy khi mình online') : _t('Ẩn trạng thái online')}</button></div>`;
  }
  const isDemoHint = () => (api.isDemo ? _t('<p class="hs-note">Bản Chơi thử có 3 bạn ảo. Thử mã <b>NAMNGU22</b> hoặc <b>MAYXANH3</b>.</p>') : '');

  function mailTab() {
    const unclaimed = D.inbox.filter(m => !m.claimed).length;
    if (!D.inbox.length) return _t('<p class="hs-note">Hộp thư trống. Quà của bạn bè và thưởng của Hatchday sẽ về đây.</p>');
    return _t`${unclaimed > 1 ? _t('<button type="button" class="btn-sm" data-soc="claimall">Nhận tất cả</button>') : ''}<ul class="soc-list">${D.inbox.map(m => {
      const left = Math.max(0, Math.ceil((Date.parse(m.expires_at) - Date.now()) / 86400000));
      const what = [m.items.length ? itemsText(m.items) : '', m.coins ? `${m.coins} xu` : ''].filter(Boolean).join(' · ');
      return _t`<li class="soc-mail${m.claimed ? ' done' : ''}"><div class="soc-info"><b>${esc(m.title)}</b>${m.body ? `<small>${esc(m.body)}</small>` : ''}${what ? `<small class="soc-what">${what}</small>` : ''}<small>${m.claimed ? _t('Đã nhận') : _t`Còn ${left} ngày`}</small></div>
        <div class="soc-act">${m.claimed ? _t`<button type="button" class="btn-sm ghost" data-soc="delmail" data-id="${m.id}">Xoá</button>` : _t`<button type="button" class="btn-sm" data-soc="claim" data-id="${m.id}">Nhận</button>${m.kind === 'system' ? _t`<button type="button" class="btn-sm ghost" data-soc="delmail" data-id="${m.id}">Xoá</button>` : ''}`}</div></li>`;
    }).join('')}</ul>`;
  }
  function newsTab() {
    if (!D.news.length) return _t('<p class="hs-note">Chưa có tin nào.</p>');
    return _t`<ul class="soc-list">${D.news.map(n => _t`<li class="soc-mail${n.read ? ' done' : ''}"><div class="soc-info"><b><span class="soc-kind k-${esc(n.kind)}">${KIND[n.kind] || 'Tin'}</span> ${esc(n.title)}</b><small>${esc(n.body)}</small>${n.read ? '' : _t('<small class="soc-new">Mới</small>')}</div></li>`).join('')}</ul>`;
  }
  let marking = false;
  async function markNewsRead() {
    const unread = D.news.filter(n => !n.read); if (!unread.length || marking) return; marking = true;
    try { await Promise.all(unread.map(n => api.markNewsRead(n.id))); unread.forEach(n => { n.read = true; }); D.sum.news_unread = 0; await loadSummary(); } catch { /* lần sau */ }
    marking = false; if (!$('social').hidden) render();
  }


  /* ---------- Tin nhắn riêng (chỉ giữa bạn bè) ---------- */
  const when = iso => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  function dmTab() {
    const o = D.dm.open;
    if (o) return _t`<div class="soc-act"><button type="button" class="btn-sm ghost" data-soc="dmback">← Tin nhắn</button><b>${esc(o.name)}</b></div>
      <div class="dm-list" id="dm-list">${D.dm.msgs.length ? D.dm.msgs.map(m => `<div class="dm-msg${m.mine ? ' mine' : ''}"><span>${esc(m.body)}</span><small>${when(m.at)}</small></div>`).join('') : _t('<p class="hs-note">Chưa có tin nào. Gửi lời chào đi!</p>')}</div>
      <form class="chat-box" data-soc-form="dm" autocomplete="off"><input id="dm-in" maxlength="100" placeholder="Nhắn cho ${esc(o.name)}…" aria-label="Tin nhắn"><button class="btn-sm" type="submit">Gửi</button></form>
      <p class="hs-note">Không gửi liên kết, email hay số điện thoại. Tin giữ 30 ngày.</p>`;
    if (!D.dm.threads.length) return _t('<p class="hs-note">Chưa có tin nhắn nào. Mở danh sách bạn bè và bấm "Nhắn tin" để bắt đầu.</p>');
    return _t`<ul class="soc-list">${D.dm.threads.map(t => _t`<li class="soc-row">${petImg(t.with)}<div class="soc-info"><b>${esc(t.with.name)}</b><small>${t.mine ? _t('Bạn: ') : ''}${esc(t.last)}</small></div><div class="soc-act"><button type="button" class="btn-sm${t.unread ? '' : ' ghost'}" data-soc="dm" data-who="${esc(t.with.pid)}">${t.unread ? _t`Mới (${t.unread})` : _t('Mở')}</button></div></li>`).join('')}</ul>`;
  }
  async function openDm(pid) {
    const p = D.friends.find(x => x.pid === pid) || D.dm.threads.find(t => t.with.pid === pid)?.with; if (!p) return;
    D.dm.open = { pid, name: p.name }; D.tab = 'dm'; D.dm.msgs = []; render();
    try { D.dm.msgs = await api.listDm(pid); await api.markDmRead(pid); D.sum.dm_unread = await api.dmUnread().catch(() => 0); onChange(); } catch (e) { ctx.toast(viError(e)); D.dm.open = null; }
    render(); const l = $('dm-list'); if (l) l.scrollTop = l.scrollHeight;
  }

  /* ---------- Tặng quà ---------- */
  function giftables() {
    const rows = [];
    for (const f of FOODS) rows.push({ id: f.id, name: f.name });
    for (const m of MEDICINES) rows.push({ id: m.id, name: m.name });
    for (const it of Object.values(BY_ID)) if (it.kind === 'decor' && isGiftable({ kind: it.kind, layer: it.layer, source: it.source })) rows.push({ id: it.id, name: it.name });
    return rows.map(r => ({ ...r, have: S.owned[r.id] || 0 })).filter(r => r.have > 0);
  }
  const giftTotal = () => Object.values(gift.sel).reduce((a, b) => a + b, 0);
  function openGift(pid) {
    const p = D.friends.find(x => x.pid === pid); if (!p) return;
    gift = { pid, name: p.name, sel: {}, note: '' }; open('gift'); renderGift();
  }
  function renderGift() {
    const el = $('gift'); if (!el || !gift) return;
    const rows = giftables(), n = giftTotal();
    el.innerHTML = head(_t`Tặng quà cho ${esc(gift.name)}`, _t`Chọn tối đa ${SOCIAL.giftMaxItems} phần · đã chọn ${n}`) + _t`<div class="hs-body">${rows.length ? _t`<ul class="soc-list">${rows.map(r => {
      const q = gift.sel[r.id] || 0;
      return _t`<li class="soc-row"><div class="soc-info"><b>${esc(r.name)}</b><small>Bạn có ${r.have}</small></div><div class="soc-act soc-step"><button type="button" class="btn-sm ghost" data-gift="-" data-id="${r.id}" ${q ? '' : 'disabled'} aria-label="Bớt">−</button><b aria-live="polite">${q}</b><button type="button" class="btn-sm" data-gift="+" data-id="${r.id}" ${q < r.have && n < SOCIAL.giftMaxItems ? '' : 'disabled'} aria-label="Thêm">+</button></div></li>`;
    }).join('')}</ul>` : _t('<p class="hs-note">Bạn chưa có món nào tặng được. Mua ở cửa hàng hoặc thu hoạch ở vườn nhé.</p>')}
      <label class="soc-note">Lời nhắn<select id="gift-note"><option value="">Không kèm lời nhắn</option>${GIFT_NOTES.map(t => `<option ${gift.note === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <div class="soc-act"><button type="button" class="btn-sm" data-gift="send" ${n ? '' : 'disabled'}>Gửi quà</button><button type="button" class="btn-sm ghost" data-soc="back">Quay lại</button></div>
      <p class="hs-note">Mỗi ngày tặng tối đa ${SOCIAL.giftsPerDay} quà, 1 quà cho mỗi bạn. Cần là bạn bè từ ${SOCIAL.friendDaysForGift} ngày. Xu không tặng được.</p></div>`;
  }

  /* ---------- Thăm nhà bạn ---------- */
  async function openVisit(pid) {
    open('visit'); $('visit').innerHTML = head(_t('Đang đi thăm…')) + _t('<div class="hs-body"><p class="hs-note">Đợi chút nhé…</p></div>');
    try { visit = { pid, ...(await api.getVisit(pid)) }; } catch (e) { ctx.toast(viError(e)); openSocial('friends'); return; }
    renderVisit();
  }
  function renderVisit() {
    const v = visit, el = $('visit'); if (!v || !el) return;
    const p = v.profile, items = v.room?.items || [], left = Math.max(0, SOCIAL.rewardedPerDay - v.today.rewarded);
    const plots = v.plots.length ? _t`<ul class="soc-list">${v.plots.map(x => _t`<li class="soc-row"><div class="soc-info"><b>${esc(nameOf(x.crop))}</b><small>Ô ${x.plot + 1} · ${x.ready ? _t('đã chín') : _t`tưới ${x.waters}/3 lần`}</small></div><div class="soc-act">${x.ready ? '' : _t`<button type="button" class="btn-sm" data-visit="water" data-plot="${x.plot}" ${x.can_help ? '' : 'disabled'}>${x.can_help ? _t('Tưới giúp') : _t('Đã tưới')}</button>`}</div></li>`).join('')}</ul>` : _t('<p class="hs-note">Vườn của bạn này chưa trồng gì.</p>');
    el.innerHTML = head(_t`Nhà của ${esc(p.name)}`, _t`${esc(speciesOf(p))} · Gắn bó ${p.bond_level} · còn ${left} lần có thưởng hôm nay`) + _t`<div class="hs-body">
      <section class="soc-card">${petImg(p, 72)}<div class="soc-info"><b>${esc(p.name)}</b><small>${esc(p.family || '')}</small></div><button type="button" class="btn-sm" data-visit="stroke" ${v.today.stroked ? 'disabled' : ''}>${v.today.stroked ? _t('Đã vuốt ve') : _t('Vuốt ve')}</button></section>
      <h3 class="soc-h">Phòng</h3><p class="hs-note">${v.room ? _t`${items.length} món đồ · giấy dán tường ${esc(nameOf(v.room.wallpaper))} · sàn ${esc(nameOf(v.room.flooring))}${items.length ? ': ' + [...new Set(items.map(i => nameOf(i.id)))].map(esc).join(', ') : ''}` : _t('Chưa có bố cục.')}</p>
      <h3 class="soc-h">Vườn rau</h3>${plots}
      <h3 class="soc-h">Để lại dấu vết</h3><div class="soc-priv">${GUESTBOOK.map(g => `<button type="button" class="btn-sm ghost soc-emote" data-visit="note" data-emote="${g.id}" aria-label="${esc(g.label)}" ${v.today.noted ? 'disabled' : ''}>${EMOTE[g.id]}</button>`).join('')}</div>
      <div class="soc-act"><button type="button" class="btn-sm ghost" data-soc="gift" data-who="${esc(v.pid)}">Tặng quà</button><button type="button" class="btn-sm ghost" data-soc="back">Quay lại</button></div></div>`;
    fillThumbs(el);
  }

  /* ---------- Hành động ---------- */
  async function run(btn, fn, okMsg) {
    if (D.busy) return; D.busy = true; if (btn) btn.disabled = true;
    try { const r = await fn(); if (okMsg) say(typeof okMsg === 'function' ? okMsg(r) : okMsg); return r; }
    catch (e) { ctx.toast(viError(e)); }
    finally { D.busy = false; }
  }
  async function syncCoins() { await Promise.allSettled([store.refreshEconomy(), store.refreshOwned()]); }

  app.addEventListener('click', async e => {
    const tab = e.target.closest('[data-soc-tab]');
    if (tab) { D.tab = tab.dataset.socTab; D.armed.clear(); if (D.tab !== 'dm') D.dm.open = null; render(); return; }
    const arm = e.target.closest('[data-soc-arm]');
    if (arm) { D.armed.add(arm.dataset.socArm + arm.dataset.who); render(); setTimeout(() => { if (D.armed.delete(arm.dataset.socArm + arm.dataset.who)) { if (!$('social').hidden) render(); } }, 4000); return; }
    const g = e.target.closest('[data-gift]');
    if (g && gift) {
      const id = g.dataset.id, k = g.dataset.gift;
      if (k === '+') gift.sel[id] = (gift.sel[id] || 0) + 1;
      else if (k === '-') { gift.sel[id] = (gift.sel[id] || 0) - 1; if (gift.sel[id] <= 0) delete gift.sel[id]; }
      else if (k === 'send') {
        const items = Object.entries(gift.sel).map(([id, qty]) => ({ id, qty })), note = $('gift-note')?.value || null;
        const r = await run(g, () => api.sendGift(gift.pid, items, note), _t`Đã gửi quà cho ${gift.name}.`);
        if (r) { sfx('buy'); ctx.buzz?.(12); await syncCoins(); gift = null; openSocial('friends'); return; }
      }
      if (gift) { gift.note = $('gift-note')?.value || gift.note; renderGift(); }
      return;
    }
    const vb = e.target.closest('[data-visit]');
    if (vb && visit) {
      const k = vb.dataset.visit;
      const r = await run(vb, () => (k === 'stroke' ? api.strokeFriend(visit.pid) : k === 'water' ? api.waterFriendCrop(visit.pid, +vb.dataset.plot) : api.leaveGuestbook(visit.pid, vb.dataset.emote)),
        r => (k === 'note' ? _t('Đã để lại dấu vết ở nhà bạn.') : r?.got ? _t`Cảm ơn bạn! Nhận ${r.got} xu.` : _t('Cảm ơn bạn đã ghé!')));
      if (r !== undefined || k === 'note') { sfx('coin'); await syncCoins(); try { visit = { pid: visit.pid, ...(await api.getVisit(visit.pid)) }; } catch { /* giữ bản cũ */ } renderVisit(); }
      else renderVisit();
      return;
    }
    const b = e.target.closest('[data-soc]'); if (!b) return;
    const who = b.dataset.who, k = b.dataset.soc;
    if (k === 'copy') { try { await navigator.clipboard.writeText(D.state?.friend_code || ''); say(_t('Đã sao chép mã bạn bè.')); } catch { say(_t`Mã của bạn: ${D.state?.friend_code || ''}`); } return; }
    if (k === 'priv') { await run(b, () => api.setPrivacy(b.dataset.key, b.dataset.val)); await loadAll(); return; }
    if (k === 'accept' || k === 'decline') { await run(b, () => api.respondFriendRequest(who, k === 'accept'), k === 'accept' ? _t('Đã kết bạn!') : _t('Đã từ chối.')); await loadAll(); return; }
    if (k === 'remove') { D.armed.delete('remove' + who); await run(b, () => api.removeFriend(who), _t('Đã bỏ bạn.')); await loadAll(); return; }
    if (k === 'block') { D.armed.delete('block' + who); await run(b, () => api.blockUser(who), _t('Đã chặn người này.')); await loadAll(); return; }
    if (k === 'dm') { open('social'); openDm(who); return; }
    if (k === 'dmback') { D.dm.open = null; render(); loadAll(); return; }
    if (k === 'visit') { openVisit(who); return; }
    if (k === 'playdate') { const r = await run(b, () => api.invitePlaydate(who), _t('Đã rủ bạn đi chơi! Khi bạn ấy đồng ý, cả hai bé cùng nhận quà.')); if (r) sfx('badge'); await loadAll(); return; }
    if (k === 'note') { D.noteFor = D.noteFor === who ? null : who; render(); $('note-in')?.focus({ preventScroll: true }); return; }
    if (k === 'pdyes' || k === 'pdno') { const r = await run(b, () => api.respondPlaydate(+b.dataset.id, k === 'pdyes'), k === 'pdyes' ? _t('Hai bé chơi vui ghê! +15 xu, +3 Gắn bó.') : _t('Đã để sau.')); if (r && k === 'pdyes') { sfx('cheer'); ctx.spawn?.('heart', 4); await syncCoins(); } await loadAll(); return; }
    if (k === 'delnote') { await run(b, () => api.deleteGuestNote(+b.dataset.id)); await loadAll(); return; }
    if (k === 'gift') { openGift(who); return; }
    if (k === 'back') { gift = null; openSocial('friends'); return; }
    if (k === 'claim') { const r = await run(b, () => api.claimMail(+b.dataset.id), r => _t`Đã nhận${r.coins ? ` ${r.coins} xu` : ''}${r.items?.length ? ' ' + itemsText(r.items) : ''}.`); if (r) { sfx('coin'); ctx.buzz?.(10); await syncCoins(); } await loadAll(); return; }
    if (k === 'claimall') { const r = await run(b, () => api.claimAllMail(), r => _t`Đã nhận ${r.claimed} thư${r.skipped ? _t`, ${r.skipped} thư chưa nhận được (kho đầy?)` : ''}.`); if (r) { sfx('coin'); await syncCoins(); } await loadAll(); return; }
    if (k === 'delmail') { await run(b, () => api.deleteMail(+b.dataset.id)); await loadAll(); return; }
  });
  app.addEventListener('submit', async e => {
    const dmf = e.target.closest('[data-soc-form="dm"]');
    if (dmf && D.dm.open) {
      e.preventDefault(); const inp = $('dm-in'), text = inp.value.trim(); if (!text) return; inp.disabled = true;
      try { const r = await api.sendDm(D.dm.open.pid, text); if (r.ok) { D.dm.msgs = await api.listDm(D.dm.open.pid); render(); const l = $('dm-list'); if (l) l.scrollTop = l.scrollHeight; $('dm-in')?.focus({ preventScroll: true }); setTimeout(async () => { if (D.dm.open && D.tab === 'dm') { D.dm.msgs = await api.listDm(D.dm.open.pid).catch(() => D.dm.msgs); if (D.dm.open) { await api.markDmRead(D.dm.open.pid).catch(() => {}); D.sum.dm_unread = await api.dmUnread().catch(() => 0); onChange(); } if (D.dm.open && !$('social').hidden) { render(); const l2 = $('dm-list'); if (l2) l2.scrollTop = l2.scrollHeight; } } }, 4600); } else { ctx.toast(CHAT_REASON_TEXT[r.reason] || _t('Chưa gửi được.')); inp.disabled = false; } }
      catch (err) { ctx.toast(viError(err)); inp.disabled = false; }
      return;
    }
    const nf = e.target.closest('[data-soc-form="note"]');
    if (nf) {
      e.preventDefault(); const inp = $('note-in'), text = inp.value.trim(); if (!text) return; inp.disabled = true;
      try { const r = await api.writeGuestNote(nf.dataset.who, text); if (r.ok) { say(_t('Đã gửi lời nhắn!')); sfx('coin'); D.noteFor = null; render(); } else { say(CHAT_REASON_TEXT[r.reason] || _t('Chưa gửi được.')); inp.disabled = false; } }
      catch (err) { say(viError(err)); inp.disabled = false; }
      return;
    }
    const f = e.target.closest('[data-soc-form="add"]'); if (!f) return; e.preventDefault();
    const code = $('soc-code').value.trim(); if (!code) { say(_t('Bạn chưa nhập mã bạn bè.')); return; }
    const r = await run(f.querySelector('button'), () => api.sendFriendRequest(code), r => (r.status === 'accepted' ? _t('Hai bạn đã là bạn bè!') : _t('Đã gửi lời mời kết bạn.')));
    if (r) $('soc-code').value = '';
    await loadAll();
  });
  app.addEventListener('change', e => { if (e.target.id === 'gift-note' && gift) gift.note = e.target.value; });

  startPolling();
  return { open: openSocial, openMail: () => openSocial('mail'), openNews: () => openSocial('news'), badge: () => total() + pendingIn(), summary: () => D.sum, tileText: () => (total() ? sub() : _t('Bạn bè, hộp thư, quà tặng, tin tức')), refresh: loadSummary };
}
