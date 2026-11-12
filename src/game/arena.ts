/** Kiểu dữ liệu và hằng số của Đấu trường dùng chung cho máy chủ (migration 20261225000000_arena.sql) và bản Chơi thử. */
import { _t } from '../i18n';
import type { Upgrades } from './battle';

export type ArenaMode = 'practice' | 'ranked' | 'friend';
export type ArenaResult = 'win' | 'loss' | 'draw' | 'forfeit';
export interface ArenaOpp { kind: 'bot' | 'player'; pid?: string; name?: string; family?: string; species: string; stage: string; form: string | null; bond: number; upgrades: Upgrades; rating: number }
export interface ArenaStart { id: number; mode: ArenaMode; field: number; seed: number; opp: ArenaOpp; upgrades: Upgrades; rewarded?: boolean }
export interface ArenaFinish { result: ArenaResult; reward: number; first_win: boolean; rating: number; rating_delta: number; rewards_left: number; coins: number }
export interface ArenaStats { rating: number; ranked: number; wins: number; losses: number; draws: number; streak: number; best_streak: number; def_wins: number; def_losses: number }
export interface ArenaState {
  upgrades: Upgrades | null; costs: number[]; stats: ArenaStats; rewards_left: number; first_win_open: boolean;
  reward: { win: number; loss: number; first_win: number }; rank: number | null; top: { name: string; species: string; rating: number; wins: number; me: boolean }[];
}
/** Giống máy chủ: thưởng mặc định, trần mỗi ngày, trận ngắn nhất được tính (giây). */
export const ARENA = { rewardWin: 20, rewardLoss: 5, firstWin: 30, perDay: 5, minSeconds: 10, k: 32, ratingDayCap: 60 };
/** Khắc mạnh: hệ i khắc mạnh hệ STRONG_OF[i] (khớp STRONG trong skills.ts và mảng trong arena_start). */
export const STRONG_OF = [2, 4, 3, 1, 0];
/** Điểm xếp hạng kiểu Elo (K = 32), khớp private.arena_settle. */
export function ratingDelta(me: number, opp: number, res: ArenaResult): number {
  const exp = 1 / (1 + Math.pow(10, (opp - me) / 400)), score = res === 'win' ? 1 : res === 'draw' ? 0.5 : 0;
  return Math.round(ARENA.k * (score - exp));
}
/** Danh hiệu theo điểm xếp hạng. */
export const RANKS: [number, string][] = [[0, _t('Tập sự')], [1050, _t('Đồng')], [1150, _t('Bạc')], [1300, _t('Vàng')], [1500, _t('Ngọc')], [1750, _t('Huyền thoại')]];
export const rankName = (r: number) => [...RANKS].reverse().find(x => r >= x[0])![1];
