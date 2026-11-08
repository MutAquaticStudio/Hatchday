/** Luật Góp ý & Hỗ trợ dùng chung cho giao diện và bản Chơi thử. PHẢI khớp supabase/migrations/20261222000000_support_site.sql. */
export type TicketKind = 'feedback' | 'bug' | 'account' | 'other';
export type TicketStatus = 'open' | 'answered' | 'closed';
export interface TicketMessage { from_admin: boolean; body: string; at: string }
export interface SupportTicket { id: number; kind: TicketKind; subject: string; status: TicketStatus; created_at: string; updated_at: string; unread: boolean; messages: TicketMessage[] }

export const SUPPORT = {
  subjectMax: 80, bodyMin: 5, bodyMax: 2000, maxOpen: 3, maxPerDay: 5,
  kinds: [
    { id: 'feedback', icon: '💡', name: 'Góp ý', hint: 'Ý tưởng, điều bạn thích hoặc chưa thích' },
    { id: 'bug', icon: '🐞', name: 'Báo lỗi', hint: 'Game chạy sai, kẹt, hiện lạ' },
    { id: 'account', icon: '🔑', name: 'Tài khoản', hint: 'Đăng nhập, dữ liệu, xoá tài khoản' },
    { id: 'other', icon: '💬', name: 'Khác', hint: 'Câu hỏi hay chuyện khác' },
  ] as { id: TicketKind; icon: string; name: string; hint: string }[],
  status: { open: 'Đang chờ trả lời', answered: 'Đã trả lời', closed: 'Đã đóng' } as Record<TicketStatus, string>,
};

/** Thông tin máy kèm theo phiếu để dễ sửa lỗi (không có gì cá nhân). */
export function ticketMeta(place: string, build: string): Record<string, string | boolean> {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  return {
    platform: nav ? (/Android/i.test(nav.userAgent) ? 'android' : /iPhone|iPad|iPod/i.test(nav.userAgent) ? 'ios' : 'desktop') : 'unknown',
    screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio || 1}` : '',
    standalone: typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches,
    place, build, ua: nav ? nav.userAgent.slice(0, 160) : '',
  };
}
