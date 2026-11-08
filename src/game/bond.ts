/**
 * Gắn bó: mỗi hành động chăm sóc thành công cộng 1 điểm (bond_xp), chữa bệnh cộng 3. Điểm quy ra cấp 1–10.
 * Mỗi cấp từ 2 trở lên có một phần quà xu, nhận bằng claim_bond_reward (mỗi cấp một lần cho mỗi bé).
 * Luật song song với private.bond_level và claim_bond_reward trong supabase/migrations/20261122000000_bond.sql
 * (supabase/tests/bond.test.ts so khớp hai bên). Con số tự cân: bé sống 30–60 ngày, người chơi chăm đều khoảng 50–150 điểm mỗi ngày.
 */
import { _t } from '../i18n';
export const BOND = {
  /** Điểm tối thiểu để đạt cấp 1..10. */
  levels: [0, 25, 80, 170, 300, 480, 720, 1020, 1400, 1900],
  /** Quà xu khi đạt cấp 1..10 (cấp 1 không có quà). */
  rewards: [0, 50, 80, 120, 160, 220, 300, 400, 520, 700],
  titles: [_t('Mới quen'), _t('Quen thuộc'), _t('Thân thiết'), _t('Gắn bó'), _t('Tin cậy'), _t('Bạn tốt'), _t('Tri âm'), _t('Tri kỷ'), _t('Khó tách rời'), _t('Một lòng')],
  max: 10,
} as const;

export const bondLevel = (xp: number): number => {
  let lv = 1;
  for (let i = 1; i < BOND.levels.length; i++) if (xp >= BOND.levels[i]) lv = i + 1;
  return lv;
};

export interface BondProgress { level: number; title: string; into: number; need: number; pct: number; max: boolean }
/** Tiến độ tới cấp kế tiếp: đã có `into` trên `need` điểm của cấp hiện tại. */
export function bondProgress(xp: number): BondProgress {
  const level = bondLevel(xp), title = BOND.titles[level - 1];
  if (level >= BOND.max) return { level, title, into: 0, need: 0, pct: 100, max: true };
  const lo = BOND.levels[level - 1], hi = BOND.levels[level];
  return { level, title, into: xp - lo, need: hi - lo, pct: Math.round(((xp - lo) / (hi - lo)) * 100), max: false };
}

/** Các cấp đã đạt mà chưa nhận quà. */
export const unclaimedLevels = (xp: number, claimed: number[]): number[] =>
  Array.from({ length: bondLevel(xp) - 1 }, (_, i) => i + 2).filter(l => !claimed.includes(l));
