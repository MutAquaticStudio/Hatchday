/**
 * Thành tựu Steam: luật thuần (tính từ trạng thái game) để bản Steam mở khoá qua Steamworks, và để test.
 * API name (cột `id`) PHẢI trùng với thành tựu tạo trong Steamworks (danh sách và mô tả ở docs/STEAM-ACHIEVEMENTS.md).
 * Mở khoá là thao tác lặp lại an toàn: Steam bỏ qua thành tựu đã có, nên chỉ cần gọi lại khi trạng thái đổi.
 */
import { bondLevel } from './bond';
import { SPECIES } from './species';
import type { BadgeState } from './world-activity';

export interface AchievementInput {
  bondXp: number; generation: number; stage: string; seen: { species_id: string }[]; badges: BadgeState[];
}
export interface AchievementDef { id: string; test: (s: AchievementInput) => boolean }

const LEGEND = new Set(SPECIES.filter(s => s.rarity === 'huyen').map(s => s.id));
const badge = (id: string) => (s: AchievementInput) => s.badges.some(b => b.id === id && (b.claimed || b.progress >= b.target));

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'ACH_HATCH', test: () => true }, // vào game với một bé là đã ấp trứng
  { id: 'ACH_GROW_KID', test: s => ['child', 'teen', 'adult', 'elder'].includes(s.stage) },
  { id: 'ACH_GROW_ADULT', test: s => ['adult', 'elder'].includes(s.stage) },
  { id: 'ACH_BOND_5', test: s => bondLevel(s.bondXp) >= 5 },
  { id: 'ACH_BOND_10', test: s => bondLevel(s.bondXp) >= 10 },
  { id: 'ACH_NEXT_GEN', test: s => s.generation >= 2 },
  { id: 'ACH_SPECIES_10', test: s => new Set(s.seen.map(x => x.species_id)).size >= 10 },
  { id: 'ACH_SPECIES_ALL', test: s => new Set(s.seen.map(x => x.species_id)).size >= SPECIES.length },
  { id: 'ACH_LEGEND', test: s => s.seen.some(x => LEGEND.has(x.species_id)) },
  { id: 'ACH_BUTTERFLY', test: badge('butterfly40') },
  { id: 'ACH_TEA_MASTER', test: badge('brew5') },
  { id: 'ACH_ANGLER', test: badge('fish20') },
  { id: 'ACH_BOOKWORM', test: badge('quiz5') },
  { id: 'ACH_COURIER', test: badge('delivery30') },
  { id: 'ACH_DANCER', test: badge('rhythm5') },
  { id: 'ACH_GARDENER', test: badge('bugs60') },
  { id: 'ACH_EXPLORER', test: badge('explore7') },
  { id: 'ACH_STAGE_STAR', test: badge('stage5') },
];

/** Danh sách thành tựu đã đạt với trạng thái hiện tại. */
export const earnedAchievements = (s: AchievementInput): string[] => ACHIEVEMENTS.filter(a => a.test(s)).map(a => a.id);
