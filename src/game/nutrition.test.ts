import { describe, expect, it } from 'vitest';
import { FOOD_BY_ID, FOOD_GROUPS, FOOD_STOCK, FOODS, type FoodGroup } from './catalog';
import { BALANCED_BONUS, isBalanced, recentGroups } from './nutrition';

describe('danh mục thức ăn', () => {
  it('12 món, mỗi nhóm có ít nhất 2 món, id và tên không trùng', () => {
    expect(FOODS).toHaveLength(12);
    expect(new Set(FOODS.map(f => f.id)).size).toBe(12);
    expect(new Set(FOODS.map(f => f.name)).size).toBe(12);
    for (const g of Object.keys(FOOD_GROUPS) as FoodGroup[]) expect(FOODS.filter(f => f.group === g).length).toBeGreaterThanOrEqual(2);
  });
  it('giá hợp lý: rẻ hơn mọi món trang trí, và suất ăn miễn phí là món rẻ nhất để no bụng', () => {
    for (const f of FOODS) { expect(f.price).toBeGreaterThan(0); expect(f.price).toBeLessThanOrEqual(40); expect(f.no + f.vui).toBeGreaterThan(0); }
    const perNo = (id: string) => FOOD_BY_ID[id].price! / FOOD_BY_ID[id].no;
    expect(FOOD_BY_ID[FOOD_STOCK.rationId]).toBeDefined();
    expect(perNo(FOOD_STOCK.rationId)).toBe(Math.min(...FOODS.map(f => f.price / f.no)));
  });
  it('đồ ngọt cho nhiều Vui hơn No; tinh bột cho nhiều No nhất', () => {
    for (const f of FOODS.filter(f => f.group === 'ngot')) expect(f.vui).toBeGreaterThan(f.no / 2);
    expect(Math.max(...FOODS.filter(f => f.group === 'tinhbot').map(f => f.no))).toBe(Math.max(...FOODS.map(f => f.no)));
  });
});

describe('ăn cân bằng', () => {
  const day = (d: string, ...groups: string[]) => ({ d, groups });
  it('cần ≥ 3 nhóm lành mạnh khác nhau trong 3 ngày gần nhất', () => {
    expect(isBalanced([day('2026-11-05', 'rau', 'dam')], '2026-11-05')).toBe(false);
    expect(isBalanced([day('2026-11-05', 'rau', 'dam', 'traicay')], '2026-11-05')).toBe(true);
    expect(isBalanced([day('2026-11-03', 'rau'), day('2026-11-04', 'dam'), day('2026-11-05', 'tinhbot')], '2026-11-05')).toBe(true);
  });
  it('đồ ngọt không tính, ăn lặp nhóm không tính thêm', () => {
    expect(isBalanced([day('2026-11-05', 'rau', 'rau', 'dam', 'ngot', 'ngot')], '2026-11-05')).toBe(false);
    expect(recentGroups([day('2026-11-05', 'ngot', 'rau', 'rau')], '2026-11-05')).toEqual(['rau']);
  });
  it('ngày thứ 4 trở về trước và ngày tương lai không tính', () => {
    expect(isBalanced([day('2026-11-02', 'rau', 'dam', 'tinhbot')], '2026-11-05')).toBe(false);
    expect(isBalanced([day('2026-11-03', 'rau', 'dam', 'tinhbot')], '2026-11-05')).toBe(true);
    expect(isBalanced([day('2026-11-06', 'rau', 'dam', 'tinhbot')], '2026-11-05')).toBe(false);
  });
  it('thưởng cân bằng là +3 Vui', () => { expect(BALANCED_BONUS).toBe(3); });
});
