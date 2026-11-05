import { describe, expect, it } from 'vitest';
import { BOND, bondLevel, bondProgress, unclaimedLevels } from './bond';

describe('Gắn bó', () => {
  it('10 cấp, mốc tăng dần, quà tăng dần', () => {
    expect(BOND.levels).toHaveLength(10); expect(BOND.rewards).toHaveLength(10); expect(BOND.titles).toHaveLength(10);
    for (let i = 1; i < 10; i++) { expect(BOND.levels[i]).toBeGreaterThan(BOND.levels[i - 1]); expect(BOND.rewards[i]).toBeGreaterThan(BOND.rewards[i - 1]); }
    expect(BOND.rewards[0]).toBe(0);
  });
  it('quy điểm ra cấp đúng ở từng mốc', () => {
    expect(bondLevel(0)).toBe(1); expect(bondLevel(24)).toBe(1); expect(bondLevel(25)).toBe(2); expect(bondLevel(79)).toBe(2);
    expect(bondLevel(80)).toBe(3); expect(bondLevel(1899)).toBe(9); expect(bondLevel(1900)).toBe(10); expect(bondLevel(99999)).toBe(10);
  });
  it('tiến độ tới cấp kế tiếp; cấp cuối đầy', () => {
    expect(bondProgress(0)).toMatchObject({ level: 1, title: 'Mới quen', into: 0, need: 25, pct: 0 });
    expect(bondProgress(52)).toMatchObject({ level: 2, into: 27, need: 55, pct: 49 });
    expect(bondProgress(5000)).toMatchObject({ level: 10, max: true, pct: 100 });
  });
  it('liệt kê cấp chưa nhận quà', () => {
    expect(unclaimedLevels(0, [])).toEqual([]);
    expect(unclaimedLevels(300, [])).toEqual([2, 3, 4, 5]);
    expect(unclaimedLevels(300, [2, 4])).toEqual([3, 5]);
  });
});
