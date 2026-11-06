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
