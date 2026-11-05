/**
 * Ăn cân bằng: trong 3 ngày gần nhất (hôm nay và 2 ngày trước, theo giờ địa phương), bé đã ăn từ 3 nhóm lành mạnh
 * khác nhau trở lên (Tinh bột, Rau củ, Đạm, Trái cây; Đồ ngọt không tính). Khi đó mỗi bữa ăn được cộng thêm
 * BALANCED_BONUS điểm Vui. Phần tính trong SQL: public.pet_action (nhánh 'feed').
 */
import { FOOD_GROUPS, type FoodGroup } from './catalog';
import { dayNumber } from './layout';

export const BALANCED_DAYS = 3;
export const BALANCED_GROUPS = 3;
export const BALANCED_BONUS = 3;

export interface DayGroups { d: string; groups: readonly string[] }

/** Các nhóm lành mạnh bé đã ăn trong BALANCED_DAYS ngày tính tới `today`. */
export function recentGroups(logs: readonly DayGroups[], today: string): FoodGroup[] {
  const n = dayNumber(today), seen = new Set<FoodGroup>();
  for (const l of logs) {
    const k = dayNumber(l.d);
    if (k > n || k <= n - BALANCED_DAYS) continue;
    for (const g of l.groups) if (FOOD_GROUPS[g as FoodGroup]?.healthy) seen.add(g as FoodGroup);
  }
  return (Object.keys(FOOD_GROUPS) as FoodGroup[]).filter(g => seen.has(g));
}
export const isBalanced = (logs: readonly DayGroups[], today: string) => recentGroups(logs, today).length >= BALANCED_GROUPS;
