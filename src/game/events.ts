/**
 * Sự kiện đang chạy (do quản trị tạo, xem admin). Cấu hình: banner (chữ), plaza_decor (trang trí Quảng trường theo mùa), coin_boost (nhân xu nhiệm vụ).
 * Luật nhân xu song song với private.event_boost trong supabase/migrations/20261210000000_event_hooks.sql.
 */
export type PlazaDecor = 'tet' | 'trung-thu' | 'giang-sinh' | 'he';
export interface ActiveEvent { id: number; title: string; body: string; kind: string; starts_at: string; ends_at: string; config: { banner?: string; plaza_decor?: PlazaDecor; coin_boost?: number } }

/** Hệ số nhân xu nhiệm vụ: lớn nhất trong các sự kiện đang chạy, mặc định 1, kẹp 1–3. */
export const eventBoost = (events: ActiveEvent[]): number => events.reduce((m, e) => Math.max(m, Math.min(3, Math.max(1, Number(e.config?.coin_boost) || 1))), 1);
/** Thưởng sau khi nhân, làm tròn như SQL round(). */
export const boostedReward = (base: number, boost: number): number => Math.round(base * boost);
export const plazaDecor = (events: ActiveEvent[]): PlazaDecor | null => events.find(e => e.config?.plaza_decor)?.config.plaza_decor ?? null;
export const bannerOf = (events: ActiveEvent[]): { id: number; text: string } | null => { const e = events.find(x => x.config?.banner) ?? events[0]; return e ? { id: e.id, text: e.config?.banner || e.title } : null; };

/* ---------- Giảm giá cửa hàng, mục tiêu cộng đồng, Mùa cúm (migration 20261215000000_hooks_toys.sql) ---------- */
export type DiscountScope = 'food' | 'medicine' | 'decor' | 'outfit' | 'toy';
export type GoalMetric = 'feed' | 'play' | 'pet' | 'bath' | 'talk';
export interface EventConfigExtra { shop_discount?: { pct: number; scope: DiscountScope | 'all' }; epidemic?: boolean; goal?: { metric: GoalMetric; target: number; reward_coins: number } }
type Cfg = ActiveEvent['config'] & EventConfigExtra;
/** Giá sau giảm: làm tròn lên, tối thiểu 1 xu (giống private.discounted). */
export const discountedPrice = (price: number, pct: number): number => Math.max(1, Math.ceil((price * (100 - pct)) / 100 - 1e-9));
/** Giảm giá lớn nhất đang chạy cho loại hàng, 0 nếu không có. */
export const discountPct = (events: ActiveEvent[], kind: DiscountScope): number =>
  events.reduce((m, e) => { const d = (e.config as Cfg)?.shop_discount; return d && (d.scope === 'all' || d.scope === kind) ? Math.max(m, d.pct) : m; }, 0);
export const isEpidemic = (events: ActiveEvent[]): boolean => events.some(e => (e.config as Cfg)?.epidemic === true);
export const goalEvents = (events: ActiveEvent[]) => events.filter(e => (e.config as Cfg)?.goal);
export const GOAL_METRIC_TEXT: Record<GoalMetric, string> = { feed: 'bữa ăn', play: 'lượt chơi', pet: 'lần vuốt ve', bath: 'lần tắm', talk: 'lần trò chuyện' };
export interface EventGoal { event_id: number; title: string; metric: GoalMetric; target: number; reward_coins: number; count: number; mine: number; reached: boolean; claimed: boolean; active: boolean; min_mine: number }
