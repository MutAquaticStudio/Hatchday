import { describe, expect, it } from 'vitest';
import { elementMult, matchups, movesOf, STRONG, MINOR } from './skills';
import { endTurn, fighterOf, simulate, useMove, pickMove, rngOf, UPGRADE_MAX, FIELD_BONUS } from './battle';
import { SPECIES } from './species';

describe('khắc hệ', () => {
  it('mỗi hệ khắc đúng hai hệ và kỵ đúng hai hệ, không hệ nào tự khắc mình', () => {
    for (let e = 0; e < 5; e++) { const m = matchups(e); expect(new Set(m.strong).size).toBe(2); expect(new Set(m.weak).size).toBe(2); expect([...m.strong, ...m.weak]).not.toContain(e); expect(elementMult(e, e)).toBe(1); }
  });
  it('khắc thì nhân lớn hơn 1, bị khắc thì nhỏ hơn 1, đối xứng ngược chiều', () => {
    for (let e = 0; e < 5; e++) { expect(elementMult(e, STRONG[e])).toBe(1.2); expect(elementMult(STRONG[e], e)).toBe(0.83); expect(elementMult(e, MINOR[e])).toBe(1.1); expect(elementMult(MINOR[e], e)).toBe(0.91); }
  });
  it('Thuỷ dập Hoả, Hoả thiêu Mộc', () => { expect(elementMult(1, 4)).toBe(1.2); expect(elementMult(4, 0)).toBe(1.2); });
});
describe('chiêu có nét riêng', () => {
  it('tuyệt chiêu và chiêu tối thượng đều có nét riêng; tối thượng có hồi chiêu và cơ hội gây trạng thái của hệ', () => {
    for (const sp of SPECIES) { const m = movesOf(sp.id); expect(m[2].twist).toBeTruthy(); expect(m[3].twist).toBeTruthy(); expect(m[3].chance).toBe(35); expect(m[3].cooldown).toBe(3); }
  });
  it('dùng chiêu tối thượng xong thì 2 lượt sau mới dùng lại được; máy cũng không chọn khi đang hồi', () => {
    const a = fighterOf({ species: 'lua-bep', stage: 'adult', form: null, bond: 8 })!, d = fighterOf({ species: 'mam-xanh', stage: 'adult', form: null, bond: 8 })!, ult = a.moves[3], rnd = rngOf(3);
    useMove(a, d, ult, rnd); expect(a.cd[ult.id]).toBe(3);
    endTurn(a); expect(a.cd[ult.id]).toBe(2); for (let i = 0; i < 20; i++) expect(pickMove(a, d, rngOf(i)).id).not.toBe(ult.id);
    endTurn(a); endTurn(a); expect(a.cd[ult.id]).toBeUndefined();
  });
  it('hồi thể lực giảm dần mỗi lần dùng', () => {
    const a = fighterOf({ species: 'mam-xanh', stage: 'adult', form: null, bond: 8 })!, d = fighterOf({ species: 'lua-bep', stage: 'adult', form: null, bond: 8 })!, heal = a.moves.find(m => m.kind === 'heal')!;
    a.hp = 10; const h1 = useMove(a, d, heal, rngOf(1)).heal; a.hp = 10; const h2 = useMove(a, d, heal, rngOf(1)).heal; expect(h2).toBeLessThan(h1);
  });
  it('tuyệt chiêu hỗ trợ kèm một đòn đánh (chiêu kép)', () => {
    const sp = SPECIES.find(s => movesOf(s.id)[2].kind !== 'attack')!, a = fighterOf({ species: sp.id, stage: 'adult', form: null, bond: 8 })!, d = fighterOf({ species: 'lua-bep', stage: 'adult', form: null, bond: 8 })!;
    expect(useMove(a, d, a.moves[2], rngOf(2)).dmg).toBeGreaterThan(0);
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

describe('sân đấu và máy chọn chiêu', () => {
  const L = (species: string) => ({ species, stage: 'adult' as const, form: null, bond: 8 });
  it('chiêu cùng hệ với sân mạnh hơn đúng hệ số sân', () => {
    const hit = (field: number) => { const a = fighterOf(L('banh-bo'))!, d = fighterOf(L('mam-xanh'))!; return useMove(a, d, a.moves[0], rngOf(7), 1, 0, field).dmg; };
    const base = hit(-1), home = hit(4);
    expect(home / base).toBeGreaterThan(FIELD_BONUS - 0.03); expect(home / base).toBeLessThan(FIELD_BONUS + 0.03);
  });
  it('máy ưu tiên đòn khắc hệ đối thủ', () => {
    const a = fighterOf(L('banh-bo'))!, d = fighterOf(L('mam-xanh'))!;
    a.moves = [{ ...a.moves[0], power: 60, element: 1 }, { ...a.moves[0], power: 50, element: 4 }];
    let fire = 0; const r = rngOf(3); for (let i = 0; i < 100; i++) if (pickMove(a, d, r).element === 4) fire++;
    expect(fire).toBeGreaterThan(60);
  });
  it('nhật ký ghi số đòn trúng', () => {
    const a = fighterOf(L('cao-bac'))!, d = fighterOf(L('lua-bep'))!;
    expect(useMove(a, d, a.moves[0], rngOf(5)).hits).toBe(1);
  });
});
