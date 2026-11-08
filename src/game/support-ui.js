// Thùng thư Góp ý & Hỗ trợ: người chơi viết thư (góp ý, báo lỗi, tài khoản, khác), xem đội ngũ trả lời và trả lời tiếp.
// Mở từ nút "💌 Góp ý & Hỗ trợ" trong Chỉ số. Có chấm đỏ khi đội ngũ vừa trả lời. Luật ở support.ts, dữ liệu qua api.ts.
import { closeMyTicket, getMyTickets, markTicketRead, replyTicket, submitTicket, supportUnread } from '../data/api';
import { SUPPORT, ticketMeta } from './support';
import { build, place } from '../lib/report-errors';
import { viError } from '../lib/errors';
import { sfx } from './audio.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = iso => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · ${d.getDate()}/${d.getMonth() + 1}`; };
const KIND = Object.fromEntries(SUPPORT.kinds.map(k => [k.id, k]));
const CONTACT = 'm.thuanwork@gmail.com';

export function initSupport({ ctx, $, open, head }) {
  let view = 'list', cur = 0, kind = 'feedback', tickets = [], draft = { subject: '', body: '' }, busy = false;

  /* ---------- chấm báo có trả lời mới ---------- */
  const setDot = n => { $('btn-support')?.classList.toggle('has-dot', n > 0); $('btn-stats')?.classList.toggle('has-dot', n > 0); };
  const checkUnread = () => supportUnread().then(setDot).catch(() => {});
  setTimeout(checkUnread, 4000); setInterval(() => { if (!document.hidden) checkUnread(); }, 5 * 60000);

  const statusPill = t => `<span class="sp-st ${t.status}">${SUPPORT.status[t.status]}</span>`;
  function listHtml() {
    const open = tickets.filter(t => t.status !== 'closed').length;
    return `<button type="button" class="btn-sm big sp-new" data-sp="new"${open >= SUPPORT.maxOpen ? ' disabled' : ''}>✉️ Viết thư mới</button>
      ${open >= SUPPORT.maxOpen ? `<p class="hs-note">Bạn đang có ${open} thư chờ xử lý. Đóng bớt thư đã xong rồi viết thư mới nhé.</p>` : ''}
      ${tickets.length ? `<ul class="sp-list">${tickets.map(t => `<li><button type="button" class="sp-item${t.unread ? ' unread' : ''}" data-sp-open="${t.id}">
        <span class="sp-ico" aria-hidden="true">${KIND[t.kind]?.icon || '💬'}</span><span class="sp-main"><b>${esc(t.subject)}</b><small>${esc(KIND[t.kind]?.name || '')} · ${when(t.updated_at)}</small></span>${statusPill(t)}</button></li>`).join('')}</ul>`
        : '<p class="hs-note">Chưa có thư nào. Góp ý của bạn giúp Hatchday tốt hơn mỗi ngày!</p>'}
      <p class="hs-note">Đội ngũ đọc mọi thư và trả lời ngay tại đây, bạn cũng nhận được thư báo trong Hộp thư. Cần gấp? Email <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`;
  }
  function newHtml() {
    const k = KIND[kind];
    return `<button type="button" class="sp-back" data-sp="list">← Thư của bạn</button>
      <div class="chips sp-kinds" role="radiogroup" aria-label="Loại thư">${SUPPORT.kinds.map(x => `<button type="button" class="chip" role="radio" data-sp-kind="${x.id}" aria-checked="${x.id === kind}" aria-pressed="${x.id === kind}">${x.icon} ${x.name}</button>`).join('')}</div>
      <p class="hs-note">${esc(k.hint)}</p>
      <label class="sp-field">Tiêu đề<input id="sp-subject" maxlength="${SUPPORT.subjectMax}" autocomplete="off" value="${esc(draft.subject)}" placeholder="${kind === 'bug' ? 'Ví dụ: Bé bị kẹt ở Công viên' : 'Một dòng ngắn gọn'}"></label>
      <label class="sp-field">Nội dung<textarea id="sp-body" maxlength="${SUPPORT.bodyMax}" rows="6" placeholder="${kind === 'bug' ? 'Bạn đang làm gì thì lỗi xảy ra? Lỗi trông như thế nào?' : 'Bạn muốn nói gì với đội ngũ?'}">${esc(draft.body)}</textarea></label>
      <p class="hs-note sp-count" id="sp-count">${draft.body.trim().length}/${SUPPORT.bodyMax}</p>
      <p class="hs-note">Thư sẽ kèm loại máy, cỡ màn hình và nơi bé đang ở để đội ngũ dễ tìm lỗi. Đừng ghi mật khẩu vào thư nhé.</p>
      <div class="mini-actions"><button type="button" class="btn-sm big" data-sp="send">Gửi thư</button></div>`;
  }
  function threadHtml() {
    const t = tickets.find(x => x.id === cur); if (!t) return listHtml();
    return `<button type="button" class="sp-back" data-sp="list">← Thư của bạn</button>
      <div class="sp-top"><b>${KIND[t.kind]?.icon || ''} ${esc(t.subject)}</b>${statusPill(t)}</div>
      <div class="dm-list sp-thread" id="sp-thread">${t.messages.map(m => `<div class="dm-msg${m.from_admin ? ' team' : ' mine'}">${m.from_admin ? '<small>Đội ngũ Hatchday</small>' : ''}<span>${esc(m.body).replace(/\n/g, '<br>')}</span><small>${when(m.at)}</small></div>`).join('')}</div>
      ${t.status === 'closed' ? '<p class="hs-note">Thư này đã đóng. Cần thêm gì thì bạn viết thư mới nhé.</p>'
        : `<label class="sp-field">Trả lời<textarea id="sp-reply" maxlength="${SUPPORT.bodyMax}" rows="3" placeholder="Viết thêm cho đội ngũ…"></textarea></label>
        <div class="mini-actions"><button type="button" class="btn-sm big" data-sp="reply">Gửi</button><button type="button" class="btn-sm ghost" data-sp="close">Đã xong, đóng thư</button></div>`}`;
  }
  function render() {
    const el = $('support'); if (!el || el.hidden) return;
    el.innerHTML = head('Góp ý & Hỗ trợ', 'Gửi ý tưởng, báo lỗi hoặc hỏi đội ngũ') + `<div class="hs-body">${view === 'new' ? newHtml() : view === 'thread' ? threadHtml() : listHtml()}</div>`;
    if (view === 'thread') { const th = $('sp-thread'); if (th) th.scrollTop = th.scrollHeight; }
  }
  async function refresh() { try { tickets = await getMyTickets(); } catch { /* giữ bản cũ */ } setDot(tickets.filter(t => t.unread).length); render(); }
  async function openThread(id) {
    view = 'thread'; cur = id; render();
    const t = tickets.find(x => x.id === id); if (t?.unread) { t.unread = false; await markTicketRead(id).catch(() => {}); setDot(tickets.filter(x => x.unread).length); }
  }
  function openSupport() { open('support'); view = 'list'; render(); refresh(); }

  document.addEventListener('input', e => {
    if (e.target.id === 'sp-subject') draft.subject = e.target.value;
    if (e.target.id === 'sp-body') { draft.body = e.target.value; const c = $('sp-count'); if (c) c.textContent = `${draft.body.trim().length}/${SUPPORT.bodyMax}`; }
  });
  document.addEventListener('click', async e => {
    const t = e.target; if (!t.closest?.('#support')) { if (t.closest?.('#btn-support')) openSupport(); return; }
    const k = t.closest('[data-sp-kind]'); if (k) { kind = k.dataset.spKind; render(); return; }
    const o = t.closest('[data-sp-open]'); if (o) { openThread(+o.dataset.spOpen); return; }
    const b = t.closest('[data-sp]'); if (!b || busy) return;
    const act = b.dataset.sp;
    if (act === 'list' || act === 'new') { view = act; render(); if (act === 'new') $('sp-subject')?.focus(); return; }
    busy = true; b.disabled = true;
    try {
      if (act === 'send') {
        const s = draft.subject.trim(), body = draft.body.trim();
        if (!s) { ctx.toast('Bạn thêm tiêu đề cho thư nhé.'); return; }
        if (body.length < SUPPORT.bodyMin) { ctx.toast(`Nội dung cần ít nhất ${SUPPORT.bodyMin} ký tự.`); return; }
        const id = await submitTicket(kind, s, body, ticketMeta(place(), build()));
        draft = { subject: '', body: '' }; sfx('badge'); ctx.toast('Đã gửi thư. Cảm ơn bạn nhiều! 💌');
        tickets = await getMyTickets(); openThread(id);
      } else if (act === 'reply') {
        const v = $('sp-reply')?.value.trim(); if (!v) return;
        await replyTicket(cur, v); sfx('badge'); await refresh();
      } else if (act === 'close') {
        await closeMyTicket(cur); ctx.toast('Đã đóng thư.'); await refresh();
      }
    } catch (err) { ctx.toast(viError(err)); }
    finally { busy = false; if (b.isConnected) b.disabled = false; }
  });

  return { openSupport, checkUnread };
}
