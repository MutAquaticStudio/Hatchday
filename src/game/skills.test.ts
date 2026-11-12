import { describe, expect, it } from 'vitest';
import { SPECIES } from './species';
import { movesOf, moveUnlocked } from './skills';

describe('chiêu thức của quái thú', () => {
  it('loài nào cũng có đủ 4 chiêu riêng, không chiêu nào trùng tên giữa các loài', () => {
    const names = new Set<string>();
    for (const sp of SPECIES) { const m = movesOf(sp.id); expect(m).toHaveLength(4); expect(m.every(x => x.name && x.element === sp.region)).toBe(true); m.forEach(x => names.add(x.name)); }
    expect(names.size).toBe(SPECIES.length * 4); // mỗi loài một bộ chiêu riêng, không trùng tên
  });
  it('mở dần theo tuổi và Gắn bó; Xế chiều giữ chiêu của Trưởng thành', () => {
    const m = movesOf('cao-bac');
    expect(m.map(x => moveUnlocked(x, 'baby', 10))).toEqual([false, false, false, false]);
    expect(m.map(x => moveUnlocked(x, 'child', 1))).toEqual([true, false, false, false]);
    expect(m.map(x => moveUnlocked(x, 'teen', 3))).toEqual([true, true, false, false]);
    expect(m.map(x => moveUnlocked(x, 'adult', 5))).toEqual([true, true, true, false]);
    expect(m.map(x => moveUnlocked(x, 'elder', 8))).toEqual([true, true, true, true]);
  });
  it('độ hiếm không đổi sức mạnh chiêu (chỉ là dáng vẻ)', () => {
    expect(movesOf('lan-vang')[2].power).toBe(movesOf('bong-lua')[2].power); expect(movesOf('lan-vang')[3].power).toBe(movesOf('bong-lua')[3].power);
  });
});
