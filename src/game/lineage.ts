/**
 * Vòng đời và gia phả: luật thừa hưởng cho thú đời sau. Server làm y hệt trong supabase/migrations/20261115000000_lifecycle.sql
 * (private.blend_personality, private.pick_heir_species, public.hatch_heir). Test: supabase/tests/lifecycle.test.ts.
 *
 * Bé thừa hưởng: tên dòng họ, đời + 1, cá tính (trung bình với một lần bốc mới), tai, nửa sắc độ,
 * sở thích đồ trang trí đầu tiên, 50% món tủ. Chọn đúng miền của bé đã đi thì có 30% nở ra đúng loài đó.
 */
import { AXES, type Personality } from './personality';
import { pickSpecies, SPECIES_BY_ID } from './species';

export const HEIR_SAME_SPECIES = 0.3;
export const HEIR_FAV_INHERIT = 0.5;

/** Làm tròn ra xa số 0 (giống round() của Postgres). */
const roundAway = (x: number) => Math.sign(x) * Math.round(Math.abs(x));

/** Cá tính đời sau: trung bình từng trục của cha mẹ lúc ra đi và một lần bốc mới, làm tròn số nguyên. */
export function blendPersonality(parent: Personality, fresh: Personality): Personality {
  const o = {} as Personality;
  for (const a of AXES) o[a] = roundAway(((parent[a] || 0) + (fresh[a] || 0)) / 2) + 0; // + 0 để tránh -0
  return o;
}

/** Loài của thú đời sau. r1, r2 trong [0, 1). */
export function pickHeirSpecies(parentSpecies: string, region: number, r1: number, r2: number): string {
  const p = SPECIES_BY_ID[parentSpecies];
  return p && p.region === region && r1 < HEIR_SAME_SPECIES ? parentSpecies : pickSpecies(region, r2).id;
}
