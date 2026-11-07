/**
 * Luật thuần (có test khớp SQL, migration 20261221000000_f2p_features) cho các tính năng chơi miễn phí:
 * kỹ năng của bé, việc làm thêm, thi biểu diễn tuần, lễ hội theo lịch, sổ sticker, Sổ mùa, sổ lưu bút, hẹn chơi, bé bạn bè ghé chơi.
 * Mọi phần thưởng là xu kiếm được trong game hoặc sticker; không có tiền thật, không có tiền tệ trả phí.
 */
import { MINI, type MiniKind } from './world-activity';

/* ---------------- Kỹ năng ---------------- */
export const SKILLS = [
  { id: 'sing', name: 'Ca hát', icon: '🎵' },
  { id: 'run', name: 'Nhanh nhẹn', icon: '💨' },
  { id: 'craft', name: 'Khéo tay', icon: '🧶' },
  { id: 'smart', name: 'Thông minh', icon: '💡' },
] as const;
export type SkillId = (typeof SKILLS)[number]['id'];
export const SKILL_BY_ID: Record<string, (typeof SKILLS)[number]> = Object.fromEntries(SKILLS.map(s => [s.id, s]));
/** Mini-game nào luyện kỹ năng nào. */
export const MINI_SKILL: Record<MiniKind, SkillId> = { butterfly: 'run', brew: 'craft', fish: 'craft', quiz: 'smart', delivery: 'run', rhythm: 'sing', bugs: 'run' };
export const SKILL_MAX_LEVEL = 10;
/** Kinh nghiệm kỹ năng sau một lượt mini-game có thưởng: 0–10 theo tỉ lệ điểm. */
export const skillXpFor = (kind: MiniKind, score: number) => Math.round((10 * Math.max(0, Math.min(score, MINI[kind].max))) / MINI[kind].max);
/** Cấp kỹ năng: 5 xp → cấp 1, 20 → 2, 45 → 3 … 500 → 10. */
export const skillLevel = (xp: number) => Math.min(SKILL_MAX_LEVEL, Math.floor(Math.sqrt(Math.max(0, xp) / 5)));
/** Xp cần để đạt cấp lv. */
export const skillXpAt = (lv: number) => 5 * lv * lv;

/* ---------------- Việc làm thêm ---------------- */
export const JOBS = [
  { id: 'tea', name: 'Phụ quán trà', place: 'tea', skill: 'craft', perHour: 12, line: 'Mình đi phụ pha trà nha, về kể bạn nghe!' },
  { id: 'market', name: 'Phụ bán hàng ở Chợ', place: 'market', skill: 'smart', perHour: 12, line: 'Mình ra Chợ giúp cô bán rau nha!' },
  { id: 'library', name: 'Xếp sách ở Thư viện', place: 'library', skill: 'smart', perHour: 10, line: 'Mình đi xếp sách, suỵt… nhẹ nhàng thôi.' },
  { id: 'park', name: 'Tưới hoa Công viên', place: 'park', skill: 'run', perHour: 10, line: 'Mình đi tưới hoa cho Công viên xanh mướt nè!' },
] as const;
export type JobId = (typeof JOBS)[number]['id'];
export const JOB_BY_ID: Record<string, (typeof JOBS)[number]> = Object.fromEntries(JOBS.map(j => [j.id, j]));
export const JOB_HOURS = [1, 3, 6] as const;
/** Số ca có lương mỗi ngày; năng lượng tối thiểu để đi làm. */
export const JOB_PER_DAY = 2;
export const JOB_MIN_ENERGY = 25;
/** Lương một ca: theo giờ, cộng 5% mỗi cấp kỹ năng của việc đó. */
export const jobPay = (job: JobId, hours: number, level: number) => Math.round(JOB_BY_ID[job].perHour * hours * (1 + 0.05 * Math.max(0, Math.min(level, SKILL_MAX_LEVEL))));
/** Kinh nghiệm kỹ năng sau một ca. */
export const jobXp = (hours: number) => 4 * hours;

/* ---------------- Thi biểu diễn tuần ---------------- */
/** Tuần thi bắt đầu thứ Hai (ngày địa phương dạng YYYY-MM-DD). */
export function weekStart(day: string): string {
  const d = new Date(day + 'T00:00:00Z'), wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd); return d.toISOString().slice(0, 10);
}
/** Điểm thi: tổng cấp kỹ năng × 10 + cấp Gắn bó × 5 + may mắn 0–19 (máy chủ tính từ băm, không đổi trong tuần). */
export const contestScore = (skillLevels: number, bondLevel: number, luck: number) => skillLevels * 10 + bondLevel * 5 + Math.max(0, Math.min(19, luck));
export const contestReward = (rank: number) => (rank === 1 ? 100 : rank <= 3 ? 60 : rank <= 10 ? 30 : 15);

/* ---------------- Lễ hội theo lịch (ngày địa phương, gồm cả hai đầu) ---------------- */
export interface Festival { id: string; name: string; icon: string; theme: string; line: string }
export const FESTIVALS: readonly Festival[] = [
  { id: 'tet', name: 'Tết Nguyên Đán', icon: '🧧', theme: 'tet', line: 'Chúc mừng năm mới! Bé nhận lì xì nè!' },
  { id: 'trungthu', name: 'Tết Trung thu', icon: '🏮', theme: 'trungthu', line: 'Trung thu rồi! Cùng rước đèn ở Chợ nha!' },
  { id: 'thieunhi', name: 'Quốc tế Thiếu nhi', icon: '🎈', theme: 'thieunhi', line: 'Hôm nay là ngày của các bé!' },
  { id: 'halloween', name: 'Halloween', icon: '🎃', theme: 'halloween', line: 'Hù! Bé hoá trang thành gì nhỉ?' },
  { id: 'noel', name: 'Giáng sinh', icon: '🎄', theme: 'noel', line: 'Giáng sinh an lành! Có quà dưới cây thông nè.' },
  { id: 'nammoi', name: 'Năm mới', icon: '🎆', theme: 'nammoi', line: 'Đếm ngược nào! Chúc mừng năm mới!' },
];
export const FESTIVAL_BY_ID: Record<string, Festival> = Object.fromEntries(FESTIVALS.map(f => [f.id, f]));
/** Các đợt lễ 2026–2030 (Tết và Trung thu theo âm lịch, đã đổi sang dương lịch). Khớp bảng festival_days. */
export const FESTIVAL_DAYS: readonly { id: string; from: string; to: string }[] = (() => {
  const out: { id: string; from: string; to: string }[] = [];
  const add = (day: string, n: number) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const tet = ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03'];
  const trungthu = ['2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12'];
  for (let y = 2026; y <= 2030; y++) {
    const i = y - 2026;
    out.push({ id: 'tet', from: add(tet[i], -1), to: add(tet[i], 3) });
    out.push({ id: 'thieunhi', from: `${y}-06-01`, to: `${y}-06-02` });
    out.push({ id: 'trungthu', from: add(trungthu[i], -3), to: add(trungthu[i], 1) });
    out.push({ id: 'halloween', from: `${y}-10-30`, to: `${y}-11-01` });
    out.push({ id: 'noel', from: `${y}-12-23`, to: `${y}-12-26` });
    out.push({ id: 'nammoi', from: `${y}-12-31`, to: `${y + 1}-01-01` });
  }
  return out.sort((a, b) => a.from.localeCompare(b.from));
})();
/** Lễ hội đang diễn ra vào ngày `day` (YYYY-MM-DD), kèm mã đợt (id:năm bắt đầu) để quà lễ chỉ nhận một lần mỗi đợt. */
export function festivalOn(day: string): (Festival & { edition: string }) | null {
  const r = FESTIVAL_DAYS.find(f => f.from <= day && day <= f.to);
  return r ? { ...FESTIVAL_BY_ID[r.id], edition: `${r.id}:${r.from.slice(0, 4)}` } : null;
}
export const FESTIVAL_GIFT = 50;

/* ---------------- Sổ mùa (miễn phí, mỗi tháng một mùa) ---------------- */
export const seasonOf = (day: string) => day.slice(0, 7);
/** Điểm mùa: mỗi hoạt động mỗi ngày tối đa 3 lần × 5; mỗi ca làm 25; mỗi lần hẹn chơi 20; dự thi 30; nhận quà lễ 30. */
export const SEASON_XP = { activity: 5, activityCap: 3, job: 25, playdate: 20, contest: 30, festival: 30 } as const;
export const SEASON_TIERS = [
  { xp: 50, coins: 20 }, { xp: 120, coins: 25 }, { xp: 200, coins: 30 }, { xp: 300, coins: 35 }, { xp: 420, coins: 60 },
  { xp: 560, coins: 40 }, { xp: 720, coins: 45 }, { xp: 900, coins: 50 }, { xp: 1100, coins: 60 }, { xp: 1350, coins: 120 },
] as const;

/* ---------------- Sổ sticker ---------------- */
export type StickerKind = 'badge' | 'skill' | 'jobs' | 'playdate' | 'contest' | 'contest_top' | 'festival' | 'season' | 'guestbook';
export interface StickerDef { id: string; name: string; icon: string; kind: StickerKind; ref: string; target: number; desc: string }
export const STICKERS: readonly StickerDef[] = [
  { id: 'st-butterfly', name: 'Bướm xinh', icon: '🦋', kind: 'badge', ref: 'butterfly40', target: 1, desc: 'Nhận huy hiệu Thợ săn bướm' },
  { id: 'st-teapot', name: 'Ấm trà', icon: '🫖', kind: 'badge', ref: 'brew5', target: 1, desc: 'Nhận huy hiệu Bậc thầy pha trà' },
  { id: 'st-fish', name: 'Cá vàng', icon: '🐟', kind: 'badge', ref: 'fish20', target: 1, desc: 'Nhận huy hiệu Cần thủ nhí' },
  { id: 'st-book', name: 'Sách hay', icon: '📖', kind: 'badge', ref: 'quiz5', target: 1, desc: 'Nhận huy hiệu Mọt sách' },
  { id: 'st-box', name: 'Thùng hàng', icon: '📦', kind: 'badge', ref: 'delivery30', target: 1, desc: 'Nhận huy hiệu Shipper chăm chỉ' },
  { id: 'st-disco', name: 'Quả cầu disco', icon: '🪩', kind: 'badge', ref: 'rhythm5', target: 1, desc: 'Nhận huy hiệu Vũ công nhí' },
  { id: 'st-ladybug', name: 'Bọ rùa', icon: '🐞', kind: 'badge', ref: 'bugs60', target: 1, desc: 'Nhận huy hiệu Người giữ vườn' },
  { id: 'st-compass', name: 'La bàn', icon: '🧭', kind: 'badge', ref: 'explore7', target: 1, desc: 'Nhận huy hiệu Nhà thám hiểm' },
  { id: 'st-mic', name: 'Micro vàng', icon: '🎤', kind: 'skill', ref: 'sing', target: 3, desc: 'Ca hát đạt cấp 3' },
  { id: 'st-shoe', name: 'Giày chạy', icon: '👟', kind: 'skill', ref: 'run', target: 3, desc: 'Nhanh nhẹn đạt cấp 3' },
  { id: 'st-yarn', name: 'Cuộn len', icon: '🧶', kind: 'skill', ref: 'craft', target: 3, desc: 'Khéo tay đạt cấp 3' },
  { id: 'st-bulb', name: 'Bóng đèn', icon: '💡', kind: 'skill', ref: 'smart', target: 3, desc: 'Thông minh đạt cấp 3' },
  { id: 'st-star', name: 'Ngôi sao', icon: '🌟', kind: 'skill', ref: 'any', target: 6, desc: 'Một kỹ năng bất kỳ đạt cấp 6' },
  { id: 'st-apron', name: 'Tạp dề', icon: '🧑‍🍳', kind: 'jobs', ref: '', target: 1, desc: 'Hoàn thành ca làm đầu tiên' },
  { id: 'st-briefcase', name: 'Cặp xách', icon: '💼', kind: 'jobs', ref: '', target: 15, desc: 'Hoàn thành 15 ca làm' },
  { id: 'st-balloon', name: 'Bóng bay', icon: '🎈', kind: 'playdate', ref: '', target: 1, desc: 'Hẹn chơi với bạn lần đầu' },
  { id: 'st-hug', name: 'Ôm nhau', icon: '🤗', kind: 'playdate', ref: '', target: 10, desc: 'Hẹn chơi 10 lần' },
  { id: 'st-ticket', name: 'Vé dự thi', icon: '🎟️', kind: 'contest', ref: '', target: 1, desc: 'Dự thi biểu diễn lần đầu' },
  { id: 'st-trophy', name: 'Cúp vàng', icon: '🏆', kind: 'contest_top', ref: '', target: 1, desc: 'Vào top 3 thi biểu diễn' },
  { id: 'st-letter', name: 'Lá thư', icon: '💌', kind: 'guestbook', ref: '', target: 5, desc: 'Viết 5 lời nhắn cho bạn bè' },
  { id: 'st-season', name: 'Hoa mùa', icon: '🌸', kind: 'season', ref: '', target: 5, desc: 'Nhận 5 bậc trong một mùa' },
  { id: 'st-season10', name: 'Vương miện mùa', icon: '👑', kind: 'season', ref: '', target: 10, desc: 'Nhận đủ 10 bậc trong một mùa' },
  { id: 'st-tet', name: 'Bao lì xì', icon: '🧧', kind: 'festival', ref: 'tet', target: 1, desc: 'Nhận quà Tết' },
  { id: 'st-lantern', name: 'Đèn ông sao', icon: '🏮', kind: 'festival', ref: 'trungthu', target: 1, desc: 'Nhận quà Trung thu' },
  { id: 'st-kid', name: 'Bóng bay thiếu nhi', icon: '🪁', kind: 'festival', ref: 'thieunhi', target: 1, desc: 'Nhận quà ngày Thiếu nhi' },
  { id: 'st-pumpkin', name: 'Bí ngô', icon: '🎃', kind: 'festival', ref: 'halloween', target: 1, desc: 'Nhận quà Halloween' },
  { id: 'st-tree', name: 'Cây thông', icon: '🎄', kind: 'festival', ref: 'noel', target: 1, desc: 'Nhận quà Giáng sinh' },
  { id: 'st-firework', name: 'Pháo hoa', icon: '🎆', kind: 'festival', ref: 'nammoi', target: 1, desc: 'Nhận quà Năm mới' },
];
export const STICKER_BY_ID: Record<string, StickerDef> = Object.fromEntries(STICKERS.map(s => [s.id, s]));
export const STICKER_COINS = 10;

/* ---------------- Lời nhắn bạn bè, hẹn chơi, bé ghé chơi ---------------- */
export const GUEST_NOTE = { maxLen: 100, perOwnerPerDay: 1, perDay: 10 } as const;
export const PLAYDATE = { coins: 15, bond: 3, expireHours: 24, invitesPerDay: 5 } as const;
export const VISITORS_MAX = 3;

/* ---------------- Kiểu dữ liệu trả về từ máy chủ ---------------- */
export interface SkillRow { skill: SkillId; xp: number; level: number }
export interface JobState { job: JobId | null; hours: number; started_at: string | null; ends_at: string | null; done_today: number; per_day: number; skills: SkillRow[] }
export interface ContestRow { name: string; score: number; mine: boolean }
export interface ContestState { week: string; entered: boolean; score: number | null; rank: number | null; entries: number; top: ContestRow[]; last: { week: string; rank: number; reward: number; claimed: boolean } | null }
export interface StickerState { id: string; progress: number; target: number; claimed: boolean }
export interface SeasonState { season: string; xp: number; tiers: { tier: number; xp: number; coins: number; claimed: boolean; ready: boolean }[] }
export interface FestivalState { festival: { id: string; edition: string; from: string; to: string } | null; claimed: boolean }
export interface GuestNote { id: number; author: string; body: string; at: string }
export interface Playdate { id: number; from: string; to: string; from_name: string; to_name: string; incoming: boolean; status: 'pending' | 'done'; at: string }
/** Hồ sơ công khai của bé bạn bè (giống private.profile_json). */
export interface Visitor { pid: string; name: string; family: string | null; species: string; stage: string; form: string | null; genes: Record<string, unknown>; outfit: Record<string, unknown>; bond_level: number }
