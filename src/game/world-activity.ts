/** Hoạt động trong thế giới: mục "Khám phá hôm nay", huy hiệu và mini-game. Thuần, có test khớp với SQL (`world_badges`, hằng số trong migration 20261217). */

/** Hoạt động không phải đồ chơi, báo về máy chủ bằng record_activity. */
import { _t } from '../i18n';
export const ACTIVITY_KINDS = ['bench', 'fountain', 'stage', 'tea', 'cat'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
/** Đồ chơi cố định ngoài trời: đếm từ `toy_logs` (play_toy), không cần báo thêm. */
export const TOY_KINDS = ['swing', 'seesaw', 'slide', 'ducks'] as const;
export const MINI_KINDS = ['butterfly', 'brew', 'fish', 'quiz', 'delivery', 'rhythm', 'bugs'] as const;
export type MiniKind = (typeof MINI_KINDS)[number];

export const ACTIVITY_LABEL: Record<string, string> = {
  swing: _t('Xích đu'), seesaw: _t('Bập bênh'), slide: _t('Cầu trượt'), ducks: _t('Cho vịt ăn'), bench: _t('Ngồi ghế đá'), fountain: _t('Đài phun nước'),
  stage: _t('Sân khấu'), tea: _t('Nhấp trà'), cat: _t('Vuốt mèo'), butterfly: _t('Bắt bướm'), brew: _t('Pha trà'), bubbles: _t('Thổi bong bóng'), kite: _t('Thả diều'),
  fish: _t('Câu cá'), quiz: _t('Đố vui'), delivery: _t('Giao hàng'), rhythm: _t('Nhảy theo nhịp'), bugs: _t('Bắt sâu'),
};

/** Bậc thưởng "Khám phá hôm nay": chơi đủ số hoạt động khác nhau trong ngày. */
export const EXPLORE_TIERS = [{ need: 3, reward: 20 }, { need: 6, reward: 40 }] as const;

export interface BadgeDef { id: string; kind: string; target: number; reward: number; name: string; desc: string; icon: string }
/** Huy hiệu: tiến độ lấy từ máy chủ (toy_logs, world_totals, explore_claims). Khớp bảng `world_badges`. */
export const BADGES: readonly BadgeDef[] = [
  { id: 'swing10', kind: 'swing', target: 10, reward: 30, name: _t('Vua xích đu'), desc: _t('Đu xích đu 10 lần'), icon: '🎠' },
  { id: 'seesaw10', kind: 'seesaw', target: 10, reward: 30, name: _t('Nhà bập bênh'), desc: _t('Chơi bập bênh 10 lần'), icon: '⚖️' },
  { id: 'slide10', kind: 'slide', target: 10, reward: 30, name: _t('Tia chớp cầu trượt'), desc: _t('Trượt cầu trượt 10 lần'), icon: '🛝' },
  { id: 'ducks10', kind: 'ducks', target: 10, reward: 30, name: _t('Bạn của loài vịt'), desc: _t('Cho vịt ăn 10 lần'), icon: '🦆' },
  { id: 'bench15', kind: 'bench', target: 15, reward: 30, name: _t('Người ngắm cảnh'), desc: _t('Ngồi nghỉ ở ghế đá 15 lần'), icon: '🪑' },
  { id: 'fountain15', kind: 'fountain', target: 15, reward: 30, name: _t('Thích nghịch nước'), desc: _t('Nhảy ở đài phun nước 15 lần'), icon: '⛲' },
  { id: 'stage5', kind: 'stage', target: 5, reward: 40, name: _t('Ngôi sao sân khấu'), desc: _t('Biểu diễn trên sân khấu 5 lần'), icon: '🎤' },
  { id: 'tea12', kind: 'tea', target: 12, reward: 30, name: _t('Tín đồ trà'), desc: _t('Nhấp trà ở Tiệm trà 12 lần'), icon: '🍵' },
  { id: 'cat10', kind: 'cat', target: 10, reward: 30, name: _t('Bạn của mèo'), desc: _t('Vuốt ve mèo 10 lần'), icon: '🐈' },
  { id: 'butterfly40', kind: 'butterfly', target: 40, reward: 50, name: _t('Thợ săn bướm'), desc: _t('Bắt tổng cộng 40 con bướm'), icon: '🦋' },
  { id: 'brew5', kind: 'brew', target: 5, reward: 50, name: _t('Bậc thầy pha trà'), desc: _t('Pha trà hoàn hảo 5 lần'), icon: '🫖' },
  { id: 'explore7', kind: 'explore', target: 7, reward: 60, name: _t('Nhà thám hiểm'), desc: _t('Hoàn thành mục Khám phá 7 ngày'), icon: '🧭' },
  { id: 'fish20', kind: 'fish', target: 20, reward: 50, name: _t('Cần thủ nhí'), desc: _t('Câu tổng cộng 20 con cá'), icon: '🎣' },
  { id: 'quiz5', kind: 'quiz', target: 5, reward: 50, name: _t('Mọt sách'), desc: _t('Trả lời đúng hết 5 câu đố 5 lần'), icon: '📚' },
  { id: 'delivery30', kind: 'delivery', target: 30, reward: 50, name: _t('Bưu tá nhí'), desc: _t('Giao đúng 30 đơn hàng ở Chợ'), icon: '📦' },
  { id: 'rhythm5', kind: 'rhythm', target: 5, reward: 50, name: _t('Vũ công nhí'), desc: _t('Nhảy trúng từ 16 nhịp trở lên 5 lần'), icon: '💃' },
  { id: 'bugs60', kind: 'bugs', target: 60, reward: 50, name: _t('Người giữ vườn'), desc: _t('Bắt tổng cộng 60 con sâu'), icon: '🐛' },
];
export const BADGE_BY_ID: Record<string, BadgeDef> = Object.fromEntries(BADGES.map(b => [b.id, b]));

/** Mini-game: số lượt có thưởng mỗi ngày, điểm tối đa và xu mỗi điểm. Mặc định của balance_config (mini.*). */
export const MINI = {
  plays: 2,
  butterfly: { max: 12, per: 1, seconds: 30 },
  brew: { max: 5, per: 3 },
  fish: { max: 8, per: 2, seconds: 40 },
  quiz: { max: 5, per: 3 },
  delivery: { max: 6, per: 2, seconds: 45 },
  rhythm: { max: 20, per: 1 },
  bugs: { max: 15, per: 1, seconds: 30 },
} as const;
/** Điểm cộng vào tổng cho huy hiệu sau một lượt (khớp submit_minigame): đếm số con/đơn, hoặc 1 khi đạt "hoàn hảo". */
export function miniTotalAdd(kind: MiniKind, score: number): number {
  if (kind === 'brew' || kind === 'quiz') return score === MINI[kind].max ? 1 : 0;
  if (kind === 'rhythm') return score >= 16 ? 1 : 0;
  return score;
}
export const miniReward = (kind: MiniKind, score: number) => Math.max(0, Math.min(MINI[kind].max, Math.floor(score))) * MINI[kind].per;

export interface ExploreTier { tier: number; need: number; reward: number; claimed: boolean; ready: boolean }
export interface BadgeState { id: string; progress: number; target: number; reward: number; claimed: boolean }
export interface MiniState { plays: number; left: number; best: number }
export interface WorldProgress {
  day: string; kinds: string[]; explore: ExploreTier[]; badges: BadgeState[]; mini: Record<MiniKind, MiniState>;
}
export interface ActivityResult { kinds: string[]; counted: boolean; newly: string[] }
export interface MiniResult { reward: number; rewarded: boolean; coins: number; plays: number; left: number; best: number; newly: string[]; skill?: string; skill_xp?: number }
