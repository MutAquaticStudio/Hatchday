/**
 * Xã hội: bạn bè, quà, thăm nhà. Luật thuần, song song với supabase/migrations/20261203..20261205 (test: supabase/tests/social.test.ts).
 * Mọi con số ở đây phải khớp SQL.
 */
export const SOCIAL = {
  /** Hạn mức bạn bè theo cấp Gắn bó: 30 ở cấp 2 trở xuống, tăng đều tới 100 ở cấp 10. */
  friendCapBase: 30, friendCapMax: 100,
  maxPendingRequests: 20,
  /** Quà: tối đa 3 quà mỗi ngày, 1 quà mỗi ngày cho cùng một bạn, 5 phần mỗi quà, bạn bè từ 3 ngày, tài khoản gửi từ 3 ngày. */
  giftsPerDay: 3, giftsPerFriendPerDay: 1, giftMaxItems: 5, friendDaysForGift: 3, accountDaysForGift: 3,
  mailExpireDays: 30, noteMax: 80,
  /** Thăm nhà: vuốt ve bạn (1 lần/bạn/ngày, Vui +2 cho bé bạn), tưới giúp (1 lần/ô/ngày), xu thưởng cho người giúp, tối đa 3 lần có thưởng mỗi ngày. */
  visitReward: 3, waterReward: 5, rewardedPerDay: 3, strokeVui: 2,
} as const;

export const friendCap = (bondLevel: number): number => Math.floor(SOCIAL.friendCapBase + (Math.max(bondLevel, 2) - 2) * 8.75);

/** Mã bạn bè: 8 ký tự, bỏ chữ dễ nhầm (không có I, O, 0, 1). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normalizeCode = (s: string): string => s.trim().toUpperCase();
export const isCodeShape = (s: string): boolean => /^[A-HJ-NP-Z2-9]{8}$/.test(normalizeCode(s));

/** Dấu vết để lại ở nhà bạn (không gõ tự do). */
export const GUESTBOOK = [
  { id: 'heart', label: 'Trái tim' }, { id: 'star', label: 'Ngôi sao' }, { id: 'smile', label: 'Mặt cười' },
  { id: 'cake', label: 'Bánh ngọt' }, { id: 'flower', label: 'Bông hoa' },
] as const;

export const PRIVACY_KEYS = { friends: ['all', 'none'], online: ['friends', 'none'] } as const;

/** Mẫu lời nhắn kèm quà. */
export const GIFT_NOTES = ['Chúc bạn khoẻ!', 'Cảm ơn bạn nhé!', 'Tặng bạn món nhỏ.', 'Chúc bé của bạn vui!'] as const;

export interface PublicProfile {
  pid: string; name: string; family: string | null; species: string; stage: string; form: string | null;
  genes: Record<string, unknown>; outfit: Record<string, string>; bond_level: number; since?: string; friend?: boolean;
}
export interface SocialState { ready: boolean; friend_code?: string; pid?: string; privacy?: { friends: string; online: string }; friends?: number; cap?: number; requests_in?: number; requests_out?: number }

/** Quà được tặng: thức ăn, thuốc, đồ trang trí mua được (trừ giấy dán tường và sàn). Song song với private.giftable. */
export function isGiftable(it: { kind: string; layer?: string | null; source?: string | null }): boolean {
  if (it.kind === 'food' || it.kind === 'medicine') return true;
  return it.kind === 'decor' && !!it.layer && it.layer !== 'wallpaper' && it.layer !== 'flooring' && ['market', 'rotating', 'weekend'].includes(it.source || '');
}
/** Trần kho khi nhận quà (thức ăn 30, thuốc 10). */
export const stockCap = (kind: string): number => (kind === 'food' || kind === 'dish' ? 30 : kind === 'medicine' ? 10 : 1000);
export interface MailRow { id: number; kind: 'gift' | 'system' | 'reward'; title: string; body: string; items: { id: string; qty: number }[]; coins: number; from: string | null; created_at: string; expires_at: string; claimed: boolean }
export interface NewsRow { id: number; kind: 'update' | 'event' | 'maintenance' | 'notice'; title: string; body: string; pinned: boolean; starts_at: string; ends_at: string | null; read: boolean }
export interface SocialSummary { mail_unread: number; news_unread: number; requests_in: number; events_version: number }

export interface VisitData {
  profile: PublicProfile;
  room: { wallpaper: string; flooring: string; items: { id: string; c: number; r: number; rot: number }[] } | null;
  farm: { id: string; x: number; z: number; rot: number }[] | null;
  parcels: { parcel: number; level: number }[];
  plots: { plot: number; crop: string; ready: boolean; waters: number; can_help: boolean }[];
  today: { stroked: boolean; noted: boolean; rewarded: number };
}
