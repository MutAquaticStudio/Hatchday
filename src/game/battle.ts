/**
 * Luật Đấu trường giao hữu (thuần tính toán, không đụng mạng hay giao diện, để máy chủ chép lại y hệt).
 * - Chỉ số của quái thú đến từ tuổi, cấp Gắn bó, dáng trưởng thành (cách chăm) và đá nâng cấp; độ hiếm chỉ cộng rất ít.
 * - Sát thương = sức mạnh chiêu × công/thủ × khắc hệ × (thủ, cường hoá, chí mạng) × dao động nhỏ.
 * - Thua không mất gì. Đá nâng cấp kiếm bằng xu chơi được, không bán bằng tiền thật.
 */
import { _t } from '../i18n';
import { SPECIES, SPECIES_BY_ID, STAGE_ORDER, type Form, type Stage } from './species';
import { elementMult, movesOf, moveUnlocked, type Move, type Status } from './skills';

export type StatKey = 'hp' | 'atk' | 'def' | 'spd';
export type Upgrades = Partial<Record<StatKey, number>>;
/** Đá nâng cấp: mỗi loại tăng một chỉ số, tối đa 5 bậc, mỗi bậc +4%. Giá bằng xu, tăng dần. */
export const UPGRADES: { id: string; stat: StatKey; name: string }[] = [
  { id: 'da-sinh-luc', stat: 'hp', name: _t('Đá Sinh Lực') }, { id: 'da-manh-cong', stat: 'atk', name: _t('Đá Mãnh Công') },
  { id: 'da-kien-giap', stat: 'def', name: _t('Đá Kiên Giáp') }, { id: 'da-tat-phong', stat: 'spd', name: _t('Đá Tật Phong') },
];
export const UPGRADE_MAX = 5, UPGRADE_STEP = 0.04, UPGRADE_COST = [100, 200, 350, 550, 800];

export interface FighterLook { species: string; stage: Stage; form?: Form | null; bond: number; upgrades?: Upgrades }
export interface Fighter { species: string; element: number; hp: number; maxHp: number; atk: number; def: number; spd: number; moves: Move[];
  guard: number; wall: boolean; thorns: boolean; boost: number; haste: number; focus: boolean; regen: number; status: Partial<Record<Status, number>> }

const FORM_BONUS: Record<Form, StatKey> = { tron: 'hp', nhanh: 'spd', thuong: 'def', sang: 'atk' };
/** Chỉ số chiến đấu từ dáng vẻ và cách chăm. Sơ sinh chưa đấu được (trả về null). */
export function fighterOf(l: FighterLook): Fighter | null {
  const sp = SPECIES_BY_ID[l.species] || SPECIES[0], si = Math.min(STAGE_ORDER.indexOf(l.stage), 3); if (si < 1) return null;
  const k = [0, 1, 1.25, 1.5][si] * (1 + 0.02 * ({ thuong: 0, hiem: 1, quy: 2, huyen: 3 }[sp.rarity] || 0)), b = Math.max(1, Math.min(10, l.bond));
  const base: Record<StatKey, number> = { hp: (80 + 8 * b) * k, atk: (16 + 1.6 * b) * k, def: (16 + 1.6 * b) * k, spd: (10 + b) * k };
  if (l.form && si >= 3) base[FORM_BONUS[l.form]] *= 1.15;
  for (const key of Object.keys(base) as StatKey[]) base[key] = Math.round(base[key] * (1 + UPGRADE_STEP * Math.max(0, Math.min(UPGRADE_MAX, l.upgrades?.[key] || 0))));
  return { species: sp.id, element: sp.region, hp: base.hp, maxHp: base.hp, atk: base.atk, def: base.def, spd: base.spd, moves: movesOf(sp.id).filter(m => moveUnlocked(m, l.stage, b)),
    guard: 0, wall: false, thorns: false, boost: 0, haste: 0, focus: false, regen: 0, status: {} };
}

/** Bộ sinh số ngẫu nhiên có hạt giống (mulberry32): cùng hạt giống thì trận đấu diễn ra y hệt. */
export function rngOf(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Sân đấu: chiêu cùng hệ với sân mạnh thêm 10% (giả thuyết, chờ chơi thử). -1 là sân trung lập. */
export const FIELD_BONUS = 1.1;
/** hits: số đòn trúng; back: sát thương giáp gai phản lại người đánh; self: phản lực tự chịu. */
export interface LogLine { turn: number; who: 0 | 1; move: string; dmg: number; heal: number; mult: number; crit: boolean; hits: number; back: number; self: number; status?: Status; skipped?: boolean }
const speed = (f: Fighter) => f.spd * (f.status.root ? 0.7 : 1) * (f.haste ? 1.3 : 1);

/** Thực hiện một chiêu của `a` lên `d`; trả về dòng nhật ký. */
export function useMove(a: Fighter, d: Fighter, m: Move, rnd: () => number, turn = 0, who: 0 | 1 = 0, field = -1): LogLine {
  const line: LogLine = { turn, who, move: m.name, dmg: 0, heal: 0, mult: 1, crit: false, hits: 0, back: 0, self: 0 };
  if (m.kind === 'guard') { a.guard = 2; a.wall = m.twist === 'wall'; a.thorns = m.twist === 'thorns'; return line; }
  if (m.kind === 'boost') { a.boost = 3; if (m.twist === 'haste') a.haste = 3; if (m.twist === 'focus') a.focus = true; return line; }
  if (m.kind === 'heal') { line.heal = Math.round(a.maxHp * 0.3); a.hp = Math.min(a.maxHp, a.hp + line.heal); if (m.twist === 'regen') a.regen = 3; if (m.twist === 'cleanse') a.status = {}; return line; }
  const hits = m.twist === 'multi' ? 2 + (rnd() < 0.5 ? 1 : 0) : 1, mult = elementMult(m.element, d.element), fb = m.element === field ? FIELD_BONUS : 1; line.mult = mult; line.hits = hits;
  for (let h = 0; h < hits; h++) {
    const crit = a.focus || rnd() < (m.twist === 'crit' ? 0.4 : 0.08); a.focus = false; line.crit ||= crit;
    let dmg = m.power * (hits > 1 ? 0.45 : 1) * (a.atk * (a.status.blind ? 0.75 : 1) * (a.boost ? 1.3 : 1)) / (d.def * (d.status.soak ? 0.75 : 1)) * 0.42 * mult * fb * (crit ? 1.5 : 1) * (0.9 + rnd() * 0.1);
    if (m.twist === 'recoil') dmg *= 1.25; if (m.twist === 'lowhp' && a.hp < a.maxHp / 2) dmg *= 1.5;
    if (d.guard && m.twist !== 'pierce') { dmg *= d.wall ? 0.3 : 0.5; if (d.thorns) { const t = Math.round(dmg * 0.25); a.hp = Math.max(0, a.hp - t); line.back += t; } }
    dmg = Math.max(1, Math.round(dmg)); d.hp = Math.max(0, d.hp - dmg); line.dmg += dmg;
  }
  if (m.twist === 'drain') { line.heal = Math.round(line.dmg * 0.3); a.hp = Math.min(a.maxHp, a.hp + line.heal); }
  if (m.twist === 'recoil') { const h0 = a.hp; a.hp = Math.max(1, a.hp - Math.round(a.maxHp * 0.1)); line.self = h0 - a.hp; }
  if (m.twist === 'cleanse') a.status = {};
  if (m.status && d.hp > 0 && rnd() * 100 < (m.chance || 0)) { d.status[m.status] = m.status === 'burn' ? 3 : 2; line.status = m.status; }
  return line;
}
/** Cuối lượt của một bên: bỏng, hồi dần, đếm lùi các hiệu ứng. */
export function endTurn(f: Fighter): { burn: number; regen: number } {
  const out = { burn: 0, regen: 0 };
  if (f.status.burn) { const h0 = f.hp; f.hp = Math.max(0, f.hp - Math.round(f.maxHp * 0.06)); out.burn = h0 - f.hp; }
  if (f.regen && f.hp > 0) { const h0 = f.hp; f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.08)); f.regen--; out.regen = f.hp - h0; }
  if (f.guard) { f.guard--; if (!f.guard) f.wall = f.thorns = false; } if (f.boost) f.boost--; if (f.haste) f.haste--;
  for (const k of Object.keys(f.status) as Status[]) { f.status[k]!--; if (!f.status[k]) delete f.status[k]; }
  return out;
}
/** Máy tự chọn chiêu: hồi khi yếu, cường hoá/thủ lúc đầu, còn lại chọn đòn gây nhiều sát thương nhất theo khắc hệ và sân. */
export function pickMove(a: Fighter, d: Fighter, rnd: () => number, field = -1): Move {
  const sup = a.moves.find(m => m.kind !== 'attack');
  if (sup && sup.kind === 'heal' && a.hp < a.maxHp * 0.45 && rnd() < 0.8) return sup;
  if (sup && sup.kind === 'boost' && !a.boost && rnd() < 0.5) return sup;
  if (sup && sup.kind === 'guard' && !a.guard && rnd() < 0.3) return sup;
  const atk = a.moves.filter(m => m.kind === 'attack');
  const val = (m: Move) => m.power * elementMult(m.element, d.element) * (m.element === field ? FIELD_BONUS : 1);
  return atk.sort((x, y) => val(y) - val(x))[rnd() < 0.75 ? 0 : Math.min(1, atk.length - 1)] || a.moves[0];
}
/** Mô phỏng cả trận (tối đa 30 lượt). Trả về người thắng (0, 1, hoặc -1 nếu hoà) và nhật ký. */
export function simulate(A: FighterLook, B: FighterLook, seed: number, field = -1): { winner: 0 | 1 | -1; log: LogLine[]; hp: [number, number] } | null {
  const a = fighterOf(A), b = fighterOf(B); if (!a || !b) return null;
  const rnd = rngOf(seed), f: [Fighter, Fighter] = [a, b], log: LogLine[] = [];
  for (let turn = 1; turn <= 30 && a.hp > 0 && b.hp > 0; turn++) {
    const mv = [pickMove(a, b, rnd, field), pickMove(b, a, rnd, field)], first = (mv[0].twist === 'first') !== (mv[1].twist === 'first') ? (mv[0].twist === 'first' ? 0 : 1) : speed(a) === speed(b) ? (rnd() < 0.5 ? 0 : 1) : speed(a) > speed(b) ? 0 : 1;
    for (const w of [first, 1 - first] as (0 | 1)[]) { const me = f[w], foe = f[1 - w]; if (me.hp <= 0 || foe.hp <= 0) break;
      if (me.status.daze && rnd() < 0.25) { log.push({ turn, who: w, move: mv[w].name, dmg: 0, heal: 0, mult: 1, crit: false, hits: 0, back: 0, self: 0, skipped: true }); continue; }
      log.push(useMove(me, foe, mv[w], rnd, turn, w, field)); }
    endTurn(a); endTurn(b);
  }
  return { winner: a.hp > 0 && b.hp <= 0 ? 0 : b.hp > 0 && a.hp <= 0 ? 1 : a.hp === b.hp ? -1 : a.hp / a.maxHp > b.hp / b.maxHp ? 0 : 1, log, hp: [a.hp, b.hp] };
}
