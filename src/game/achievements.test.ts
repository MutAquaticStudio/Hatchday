import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, earnedAchievements } from './achievements';
import { SPECIES } from './species';
import { BADGES } from './world-activity';

const base = { bondXp: 0, generation: 1, stage: 'baby', seen: [], badges: [] };
describe('thành tựu Steam', () => {
  it('API name duy nhất, đúng định dạng Steam (chữ hoa, số, gạch dưới)', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => /^ACH_[A-Z0-9_]+$/.test(id))).toBe(true);
  });
  it('bé mới chỉ có thành tựu ấp trứng', () => { expect(earnedAchievements(base)).toEqual(['ACH_HATCH']); });
  it('lớn lên, gắn bó, đời sau, sổ loài, huyền thoại', () => {
    const legend = SPECIES.find(s => s.rarity === 'huyen')!;
    const r = earnedAchievements({ ...base, stage: 'adult', bondXp: 1e9, generation: 2, seen: SPECIES.map(s => ({ species_id: s.id })) });
    for (const id of ['ACH_GROW_KID', 'ACH_GROW_ADULT', 'ACH_BOND_5', 'ACH_BOND_10', 'ACH_NEXT_GEN', 'ACH_SPECIES_10', 'ACH_SPECIES_ALL', 'ACH_LEGEND']) expect(r).toContain(id);
    expect(earnedAchievements({ ...base, seen: [{ species_id: legend.id }] })).toContain('ACH_LEGEND');
  });
  it('thành tựu theo huy hiệu dùng đúng id huy hiệu đang có', () => {
    const ids = new Set(BADGES.map(b => b.id));
    for (const b of ['butterfly40', 'brew5', 'fish20', 'quiz5', 'delivery30', 'rhythm5', 'bugs60', 'explore7', 'stage5']) expect(ids.has(b), b).toBe(true);
    const done = earnedAchievements({ ...base, badges: [{ id: 'fish20', progress: 20, target: 20, reward: 50, claimed: false }] });
    expect(done).toContain('ACH_ANGLER');
  });
});
