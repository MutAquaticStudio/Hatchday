/** Luật Góp ý & Hỗ trợ dùng chung cho giao diện và bản Chơi thử. PHẢI khớp supabase/migrations/20261222000000_support_site.sql. */
import { _t } from '../i18n';
export type TicketKind = 'feedback' | 'bug' | 'account' | 'other';
export type TicketStatus = 'open' | 'answered' | 'closed';
export interface TicketMessage { from_admin: boolean; body: string; at: string }
export interface SupportTicket { id: number; kind: TicketKind; subject: string; status: TicketStatus; created_at: string; updated_at: string; unread: boolean; messages: TicketMessage[] }

export const SUPPORT = {
  subjectMax: 80, bodyMin: 5, bodyMax: 2000, maxOpen: 3, maxPerDay: 5,
  kinds: [
    { id: 'feedback', icon: '💡', name: _t('Góp ý'), hint: _t('Ý tưởng, điều bạn thích hoặc chưa thích') },
    { id: 'bug', icon: '🐞', name: _t('Báo lỗi'), hint: _t('Game chạy sai, kẹt, hiện lạ') },
    { id: 'account', icon: '🔑', name: _t('Tài khoản'), hint: _t('Đăng nhập, dữ liệu, xoá tài khoản') },
    { id: 'other', icon: '💬', name: _t('Khác'), hint: _t('Câu hỏi hay chuyện khác') },
  ] as { id: TicketKind; icon: string; name: string; hint: string }[],
  status: { open: _t('Đang chờ trả lời'), answered: _t('Đã trả lời'), closed: _t('Đã đóng') } as Record<TicketStatus, string>,
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
