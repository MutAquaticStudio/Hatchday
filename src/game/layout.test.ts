import { describe, expect, it } from 'vitest';
import { BY_ID, DEFAULT_LAYOUT, ITEMS, THEMES, type Layout } from './catalog';
import { activeSets, buyable, canPlace, comfortLevel, comfortScore, QUEST_POOL, questsForDay, rotationForDay, weekStart, WEEKLY_POOL, weeklyForDay } from './layout';
import { decayStats } from './rules';

const L = (items: Layout['items'] = []): Layout => ({ wallpaper: 'giay-cham-hong', flooring: 'san-go', items });

describe('danh mục', () => {
  it('id không trùng, đồ trang trí có lớp, trang phục có vị trí', () => {
    expect(new Set(ITEMS.map(i => i.id)).size).toBe(ITEMS.length);
    ITEMS.filter(i => i.kind === 'decor').forEach(i => expect(i.layer).toBeTruthy());
    ITEMS.filter(i => i.kind === 'outfit').forEach(i => expect(i.slot).toBeTruthy());
  });
  it('mỗi chủ đề (trừ lễ hội) có ít nhất 5 món để kích hoạt bộ', () => {
    for (const t of Object.keys(THEMES)) if (t !== 'le-hoi') expect(ITEMS.filter(i => i.theme === t).length).toBeGreaterThanOrEqual(5);
  });
  it('bố cục mặc định hợp lệ', () => {
    DEFAULT_LAYOUT.items.forEach((p, i) => expect(canPlace(DEFAULT_LAYOUT, p, i)).toBeNull());
  });
});

describe('đặt đồ', () => {
  it('ngoài lưới, chồng nhau, chỗ của thú, ô cửa sổ', () => {
    expect(canPlace(L(), { id: 'ban-tra', c: 7, r: 0, rot: 0 })).toBe('bounds');
    expect(canPlace(L([{ id: 'ghe-dau', c: 0, r: 0, rot: 0 }]), { id: 'ban-tra', c: 0, r: 0, rot: 0 })).toBe('overlap');
    expect(canPlace(L(), { id: 'ghe-dau', c: 3, r: 3, rot: 0 })).toBe('pet');
    expect(canPlace(L(), { id: 'poster', c: 5, r: 1, rot: 0 })).toBe('window');
    expect(canPlace(L(), { id: 'poster', c: 0, r: 1, rot: 0 })).toBeNull();
  });
  it('thảm được nằm dưới nội thất, nội thất không chặn thảm', () => {
    expect(canPlace(L([{ id: 'tham-tron', c: 2, r: 2, rot: 0 }]), { id: 'ghe-dau', c: 2, r: 2, rot: 0 })).toBeNull();
  });
  it('xoay đổi chiều chiếm chỗ', () => {
    expect(canPlace(L(), { id: 'ban-tra', c: 7, r: 0, rot: 1 })).toBeNull();
  });
  it('không cho chặn hết lối ra', () => {
    const wall = [0, 2, 4, 6].map(c => ({ id: 'ban-tra', c, r: 5, rot: 0 }));
    expect(canPlace(L(wall.slice(0, 3)), wall[3])).toBe('path');
  });
});

describe('thoải mái & bộ chủ đề', () => {
  it('mỗi món tính tối đa 2 bản, cấp theo ngưỡng', () => {
    const three = L([0, 1, 2].map(c => ({ id: 'gau-bong', c, r: 0, rot: 0 })));
    expect(comfortScore(three)).toBe(6);
    expect([comfortLevel(0), comfortLevel(6), comfortLevel(12), comfortLevel(20), comfortLevel(30)]).toEqual([1, 2, 3, 4, 5]);
  });
  it('bố cục mặc định ở cấp 2', () => {
    expect(comfortLevel(comfortScore(DEFAULT_LAYOUT))).toBe(2);
  });
  it('5 món khác nhau cùng chủ đề thì kích hoạt bộ', () => {
    const set = L([{ id: 'tv-crt', c: 0, r: 0, rot: 0 }, { id: 'may-game', c: 1, r: 0, rot: 0 }, { id: 'ban-hoc', c: 2, r: 0, rot: 0 }, { id: 'dong-ho-bao-thuc', c: 4, r: 0, rot: 0 }, { id: 'poster', c: 0, r: 0, rot: 0 }]);
    expect(activeSets(set)).toContain('tuoi-tho-9x');
    expect(activeSets(L(set.items.slice(0, 4)))).not.toContain('tuoi-tho-9x');
  });
  it('phòng thoải mái làm Vui giảm chậm hơn', () => {
    const s = { no: 80, vui: 80, nl: 80, sach: 80, asleep: false };
    expect(decayStats(s, 100, 5).vui).toBeGreaterThan(decayStats(s, 100, 1).vui);
  });
});

describe('cửa hàng & nhiệm vụ', () => {
  it('tiệm xoay vòng có 6 món khác nhau, đổi theo ngày', () => {
    const a = rotationForDay('2026-11-05'), b = rotationForDay('2026-11-06');
    expect(new Set(a).size).toBe(6);
    expect(a).not.toEqual(b);
  });
  it('chợ cuối tuần chỉ mở thứ Bảy, Chủ nhật; đồ sự kiện và khởi đầu không bán', () => {
    expect(buyable(BY_ID['cay-lon'], '2026-11-07')).toBe(true);
    expect(buyable(BY_ID['cay-lon'], '2026-11-05')).toBe(false);
    expect(buyable(BY_ID['cay-dao'], '2026-11-07')).toBe(false);
    expect(buyable(BY_ID['o-rom'], '2026-11-07')).toBe(false);
    expect(buyable(BY_ID['ghe-dau'], '2026-11-05')).toBe(true);
  });
  it('5 nhiệm vụ khác nhau mỗi ngày, ngày nào cũng có đủ 5 trong cả năm', () => {
    for (let n = 0; n < 400; n++) {
      const day = new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString().slice(0, 10), q = questsForDay(day);
      expect(q).toHaveLength(5);
      expect(new Set(q).size).toBe(5);
      for (const i of q) expect(QUEST_POOL[i]).toBeDefined();
    }
  });
  it('mọi nhiệm vụ trong kho đều xuất hiện, thưởng tăng theo độ khó', () => {
    const seen = new Set<number>();
    for (let n = 0; n < 12; n++) questsForDay(new Date(Date.UTC(2026, 10, 1) + n * 86400000).toISOString().slice(0, 10)).forEach(i => seen.add(i));
    expect(seen.size).toBe(QUEST_POOL.length);
    for (const key of new Set(QUEST_POOL.map(q => q.key))) {
      const same = QUEST_POOL.filter(q => q.key === key).sort((x, y) => x.target - y.target);
      same.slice(1).forEach((q, i) => expect(q.reward).toBeGreaterThan(same[i].reward)); // làm nhiều hơn thì thưởng nhiều hơn
    }
  });
  it('tuần bắt đầu thứ Hai, 3 nhiệm vụ tuần không đổi trong tuần và khác nhau', () => {
    expect(weekStart('2026-11-05')).toBe('2026-11-02'); // thứ Năm
    expect(weekStart('2026-11-02')).toBe('2026-11-02'); // thứ Hai
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // Chủ nhật
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
    const w = weeklyForDay('2026-11-02');
    expect(weeklyForDay('2026-11-08')).toEqual(w);
    expect(weeklyForDay('2026-11-09')).not.toEqual(w);
    for (let n = 0; n < 60; n++) {
      const q = weeklyForDay(new Date(Date.UTC(2026, 0, 5) + n * 7 * 86400000).toISOString().slice(0, 10));
      expect(new Set(q).size).toBe(3);
      q.forEach(i => expect(WEEKLY_POOL[i]).toBeDefined());
    }
  });
});
