/** Chế độ Chơi thử: Góp ý & Hỗ trợ lưu trong trình duyệt. Đội ngũ "trả lời" tự động sau vài giây để thử được cả luồng. */
import type { SupportTicket, TicketKind } from '../game/support';
import { SUPPORT } from '../game/support';

const KEY = 'hatchday-demo-support';
const load = (): SupportTicket[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const save = (t: SupportTicket[]) => { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* bỏ qua */ } };
const now = () => new Date().toISOString();
const fail = (code: string) => { throw Object.assign(new Error(code), { code }); };

function autoReply(id: number) {
  setTimeout(() => {
    const all = load(), t = all.find(x => x.id === id); if (!t || t.status === 'closed') return;
    t.messages.push({ from_admin: true, body: 'Cảm ơn bạn đã gửi! Đây là bản Chơi thử nên câu trả lời này là tự động. Ở bản chính thức, đội ngũ Hatchday sẽ đọc và trả lời bạn ngay tại đây.', at: now() });
    t.status = 'answered'; t.unread = true; t.updated_at = now(); save(all);
  }, 4000);
}

export async function getMyTickets(): Promise<SupportTicket[]> { return load().sort((a, b) => b.updated_at.localeCompare(a.updated_at)); }
export async function supportUnread(): Promise<number> { return load().filter(t => t.unread).length; }
export async function submitTicket(kind: TicketKind, subject: string, body: string): Promise<number> {
  const all = load(), s = subject.trim(), b = body.trim();
  if (!SUPPORT.kinds.some(k => k.id === kind) || !s || s.length > SUPPORT.subjectMax || b.length < SUPPORT.bodyMin || b.length > SUPPORT.bodyMax) fail('invalid_ticket');
  if (all.filter(t => t.status !== 'closed').length >= SUPPORT.maxOpen) fail('ticket_limit');
  const id = Math.max(0, ...all.map(t => t.id)) + 1;
  all.push({ id, kind, subject: s, status: 'open', created_at: now(), updated_at: now(), unread: false, messages: [{ from_admin: false, body: b, at: now() }] });
  save(all); autoReply(id); return id;
}
export async function replyTicket(id: number, body: string): Promise<void> {
  const all = load(), t = all.find(x => x.id === id), b = body.trim(); if (!t) return fail('not_found');
  if (t.status === 'closed') fail('ticket_closed'); if (!b || b.length > SUPPORT.bodyMax) fail('invalid_ticket');
  t.messages.push({ from_admin: false, body: b, at: now() }); t.status = 'open'; t.updated_at = now(); save(all);
}
export async function closeMyTicket(id: number): Promise<void> { const all = load(), t = all.find(x => x.id === id); if (!t) return fail('not_found'); t.status = 'closed'; t.updated_at = now(); save(all); }
export async function markTicketRead(id: number): Promise<void> { const all = load(), t = all.find(x => x.id === id); if (t) { t.unread = false; save(all); } }
