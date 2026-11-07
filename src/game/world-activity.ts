/** Hoạt động trong thế giới: mục "Khám phá hôm nay", huy hiệu và mini-game. Thuần, có test khớp với SQL (`world_badges`, hằng số trong migration 20261217). */

/** Hoạt động không phải đồ chơi, báo về máy chủ bằng record_activity. */
export const ACTIVITY_KINDS = ['bench', 'fountain', 'stage', 'tea', 'cat'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
/** Đồ chơi cố định ngoài trời: đếm từ `toy_logs` (play_toy), không cần báo thêm. */
export const TOY_KINDS = ['swing', 'seesaw', 'slide', 'ducks'] as const;
export const MINI_KINDS = ['butterfly', 'brew'] as const;
export type MiniKind = (typeof MINI_KINDS)[number];

export const ACTIVITY_LABEL: Record<string, string> = {
  swing: 'Xích đu', seesaw: 'Bập bênh', slide: 'Cầu trượt', ducks: 'Cho vịt ăn', bench: 'Ngồi ghế đá', fountain: 'Đài phun nước',
  stage: 'Sân khấu', tea: 'Nhấp trà', cat: 'Vuốt mèo', butterfly: 'Bắt bướm', brew: 'Pha trà', bubbles: 'Thổi bong bóng', kite: 'Thả diều',
};

/** Bậc thưởng "Khám phá hôm nay": chơi đủ số hoạt động khác nhau trong ngày. */
export const EXPLORE_TIERS = [{ need: 3, reward: 20 }, { need: 6, reward: 40 }] as const;

export interface BadgeDef { id: string; kind: string; target: number; reward: number; name: string; desc: string; icon: string }
/** Huy hiệu: tiến độ lấy từ máy chủ (toy_logs, world_totals, explore_claims). Khớp bảng `world_badges`. */
export const BADGES: readonly BadgeDef[] = [
  { id: 'swing10', kind: 'swing', target: 10, reward: 30, name: 'Vua xích đu', desc: 'Đu xích đu 10 lần', icon: '🎠' },
  { id: 'seesaw10', kind: 'seesaw', target: 10, reward: 30, name: 'Nhà bập bênh', desc: 'Chơi bập bênh 10 lần', icon: '⚖️' },
  { id: 'slide10', kind: 'slide', target: 10, reward: 30, name: 'Tia chớp cầu trượt', desc: 'Trượt cầu trượt 10 lần', icon: '🛝' },
  { id: 'ducks10', kind: 'ducks', target: 10, reward: 30, name: 'Bạn của loài vịt', desc: 'Cho vịt ăn 10 lần', icon: '🦆' },
  { id: 'bench15', kind: 'bench', target: 15, reward: 30, name: 'Người ngắm cảnh', desc: 'Ngồi nghỉ ở ghế đá 15 lần', icon: '🪑' },
  { id: 'fountain15', kind: 'fountain', target: 15, reward: 30, name: 'Thích nghịch nước', desc: 'Nhảy ở đài phun nước 15 lần', icon: '⛲' },
  { id: 'stage5', kind: 'stage', target: 5, reward: 40, name: 'Ngôi sao sân khấu', desc: 'Biểu diễn trên sân khấu 5 lần', icon: '🎤' },
  { id: 'tea12', kind: 'tea', target: 12, reward: 30, name: 'Tín đồ trà', desc: 'Nhấp trà ở Tiệm trà 12 lần', icon: '🍵' },
  { id: 'cat10', kind: 'cat', target: 10, reward: 30, name: 'Bạn của mèo', desc: 'Vuốt ve mèo 10 lần', icon: '🐈' },
  { id: 'butterfly40', kind: 'butterfly', target: 40, reward: 50, name: 'Thợ săn bướm', desc: 'Bắt tổng cộng 40 con bướm', icon: '🦋' },
  { id: 'brew5', kind: 'brew', target: 5, reward: 50, name: 'Bậc thầy pha trà', desc: 'Pha trà hoàn hảo 5 lần', icon: '🫖' },
  { id: 'explore7', kind: 'explore', target: 7, reward: 60, name: 'Nhà thám hiểm', desc: 'Hoàn thành mục Khám phá 7 ngày', icon: '🧭' },
];
export const BADGE_BY_ID: Record<string, BadgeDef> = Object.fromEntries(BADGES.map(b => [b.id, b]));

/** Mini-game: số lượt có thưởng mỗi ngày, điểm tối đa và xu mỗi điểm. Mặc định của balance_config (mini.*). */
export const MINI = {
  plays: 2,
  butterfly: { max: 12, per: 1, seconds: 30 },
  brew: { max: 5, per: 3 },
} as const;
export const miniReward = (kind: MiniKind, score: number) => Math.max(0, Math.min(MINI[kind].max, Math.floor(score))) * MINI[kind].per;

export interface ExploreTier { tier: number; need: number; reward: number; claimed: boolean; ready: boolean }
export interface BadgeState { id: string; progress: number; target: number; reward: number; claimed: boolean }
export interface MiniState { plays: number; left: number; best: number }
export interface WorldProgress {
  day: string; kinds: string[]; explore: ExploreTier[]; badges: BadgeState[]; mini: Record<MiniKind, MiniState>;
}
export interface ActivityResult { kinds: string[]; counted: boolean; newly: string[] }
export interface MiniResult { reward: number; rewarded: boolean; coins: number; plays: number; left: number; best: number; newly: string[] }
