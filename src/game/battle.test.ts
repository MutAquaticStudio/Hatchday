import { describe, expect, it } from 'vitest';
import { elementMult, matchups, movesOf, STRONG, MINOR } from './skills';
import { fighterOf, simulate, UPGRADE_MAX } from './battle';
import { SPECIES } from './species';

describe('khắc hệ', () => {
  it('mỗi hệ khắc đúng hai hệ và kỵ đúng hai hệ, không hệ nào tự khắc mình', () => {
    for (let e = 0; e < 5; e++) { const m = matchups(e); expect(new Set(m.strong).size).toBe(2); expect(new Set(m.weak).size).toBe(2); expect([...m.strong, ...m.weak]).not.toContain(e); expect(elementMult(e, e)).toBe(1); }
  });
  it('khắc thì nhân lớn hơn 1, bị khắc thì nhỏ hơn 1, đối xứng ngược chiều', () => {
    for (let e = 0; e < 5; e++) { expect(elementMult(e, STRONG[e])).toBe(1.5); expect(elementMult(STRONG[e], e)).toBe(0.67); expect(elementMult(e, MINOR[e])).toBe(1.25); expect(elementMult(MINOR[e], e)).toBe(0.8); }
  });
  it('Thuỷ dập Hoả, Hoả thiêu Mộc', () => { expect(elementMult(1, 4)).toBe(1.5); expect(elementMult(4, 0)).toBe(1.5); });
});
describe('chiêu có nét riêng', () => {
  it('tuyệt chiêu và chiêu tối thượng đều có nét riêng; đòn tối thượng chắc chắn gây trạng thái của hệ', () => {
    for (const sp of SPECIES) { const m = movesOf(sp.id); expect(m[2].twist).toBeTruthy(); expect(m[3].twist).toBeTruthy(); expect(m[3].chance).toBe(100); }
  });
});
describe('đấu trường', () => {
  const L = (species: string, o = {}) => ({ species, stage: 'adult' as const, form: null, bond: 8, ...o });
  it('sơ sinh chưa đấu được; chỉ số tăng theo Gắn bó và đá nâng cấp (có trần)', () => {
    expect(fighterOf({ species: 'cao-bac', stage: 'baby', bond: 5 })).toBeNull();
    const a = fighterOf(L('cao-bac', { bond: 3 }))!, b = fighterOf(L('cao-bac', { bond: 9 }))!, c = fighterOf(L('cao-bac', { bond: 9, upgrades: { atk: 99 } }))!, d = fighterOf(L('cao-bac', { bond: 9, upgrades: { atk: UPGRADE_MAX } }))!;
    expect(b.maxHp).toBeGreaterThan(a.maxHp); expect(c.atk).toBe(d.atk); expect(d.atk).toBeGreaterThan(b.atk);
  });
  it('cùng hạt giống thì trận đấu y hệt, và trận nào cũng kết thúc', () => {
    const r1 = simulate(L('cao-bac'), L('lua-bep'), 42)!, r2 = simulate(L('cao-bac'), L('lua-bep'), 42)!;
    expect(r1).toEqual(r2); expect(r1.log.length).toBeGreaterThan(0); expect(r1.log.at(-1)!.turn).toBeLessThanOrEqual(30);
  });
  it('hai bên ngang chỉ số thì hệ khắc thắng nhiều hơn hẳn (Thuỷ đấu Hoả)', () => {
    let w = 0; for (let s = 1; s <= 200; s++) if (simulate(L('ca-bong'), L('banh-bo'), s)!.winner === 0) w++;
    expect(w).toBeGreaterThan(130);
  });
  it('không loài nào thắng áp đảo mọi loài cùng độ hiếm: tỉ lệ thắng trung bình của từng loài Thường nằm trong khoảng hợp lý', () => {
    const commons = SPECIES.filter(s => s.rarity === 'thuong');
    for (const a of commons) { let w = 0, n = 0; for (const b of commons) { if (a === b) continue; for (let s = 1; s <= 6; s++) { n++; if (simulate(L(a.id), L(b.id), s * 7)!.winner === 0) w++; } } expect(w / n).toBeGreaterThan(0.2); expect(w / n).toBeLessThan(0.8); }
  });
});
