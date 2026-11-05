import { describe, expect, it } from 'vitest';
import { blendPersonality, HEIR_FAV_INHERIT, HEIR_SAME_SPECIES, pickHeirSpecies } from './lineage';
import { normalize } from './personality';
import { SPECIES } from './species';

const P = (o: object) => normalize(o as any);

describe('blendPersonality', () => {
  it('trung bình từng trục, làm tròn ra xa số 0 (không ra -0)', () => {
    expect(blendPersonality(P({ energy: 40, social: -40 }), P({ energy: 10, social: -11 }))).toEqual(P({ energy: 25, social: -26 }));
    expect(blendPersonality(P({ energy: 3 }), P({ energy: 4 })).energy).toBe(4);
    expect(blendPersonality(P({ energy: -3 }), P({ energy: -4 })).energy).toBe(-4);
    expect(Object.is(blendPersonality(P({}), P({})).energy, 0)).toBe(true);
  });
  it('đời sau gần cha mẹ hơn là một lần bốc ngẫu nhiên', () => {
    const parent = P({ energy: 80, social: 80, curious: 80, playful: 80, affection: 80 });
    const kid = blendPersonality(parent, P({ energy: -50, social: -50, curious: -50, playful: -50, affection: -50 }));
    expect(kid.energy).toBe(15);
    expect(Math.abs(kid.energy - 80)).toBeLessThan(Math.abs(-50 - 80));
  });
});

describe('pickHeirSpecies', () => {
  const parent = SPECIES[0];
  it('cùng miền và r1 nhỏ thì giữ loài của bé đã đi', () => {
    expect(pickHeirSpecies(parent.id, parent.region, HEIR_SAME_SPECIES - 0.01, 0.5)).toBe(parent.id);
    const other = pickHeirSpecies(parent.id, parent.region, HEIR_SAME_SPECIES, 0.0);
    expect(SPECIES.find(s => s.id === other)?.region).toBe(parent.region);
  });
  it('khác miền thì luôn bốc trong miền đã chọn', () => {
    const region = (parent.region + 2) % 5;
    for (const r1 of [0, 0.1, 0.9]) expect(SPECIES.find(s => s.id === pickHeirSpecies(parent.id, region, r1, 0.4))?.region).toBe(region);
  });
  it('hằng số thừa hưởng', () => { expect(HEIR_SAME_SPECIES).toBe(0.3); expect(HEIR_FAV_INHERIT).toBe(0.5); });
});
