/**
 * Chế độ Chơi thử: chạy không cần Supabase, dữ liệu lưu trong trình duyệt.
 * Mô phỏng đúng luật của các RPC trong supabase/migrations (để xem trước, không dùng cho bản chính thức).
 */
import { clamp, decayStats, localDay } from '../game/rules';
import { BY_ID, CROPS, SELL, sellPrice, readyAtMs, WATER, DEFAULT_LAYOUT, EDIBLES, FOOD_BY_ID, FOOD_STOCK, FOODS, FRIDGE, GARDEN_LAND, GARDEN_PLOTS, PARCEL, ITEMS, RECIPES, spoilLoss, STARTER_ITEMS, type Layout } from '../game/catalog';
import { BALANCED_BONUS, isBalanced } from '../game/nutrition';
import { buyable, COIN, comfortLevel, comfortScore, dayNumber, QUEST_BONUS, QUEST_POOL, questsForDay, rotationForDay, isWeekend, weekStart, WEEKLY_POOL, weeklyForDay } from '../game/layout';
import type { ToyResult, ToysState, ActionResult, CureResult, DayLogRow, Economy, FarmItem, Garden, MemoryRow, Outfit, PetAction, PetRow, QuestBoard, QuestRow, SeenRow, Tastes } from './types';
import { applyDrift, applyDriftBy, isBlank, normalize, rollPersonality } from '../game/personality';
import { TOY_BY_ID, toyGain } from '../game/toys';
import { blendPersonality, HEIR_FAV_INHERIT, pickHeirSpecies } from '../game/lineage';
import { BOND, bondLevel } from '../game/bond';
import { boostedReward, discountedPrice, discountPct, eventBoost, goalEvents, isEpidemic, type ActiveEvent, type DiscountScope, type EventGoal, type GoalMetric } from '../game/events';
import { AD, type AdState, type AdTicket } from '../game/ads';
import { ACTIVITY_KINDS, BADGES, BADGE_BY_ID, EXPLORE_TIERS, MINI, MINI_KINDS, miniReward, miniTotalAdd, TOY_KINDS, type ActivityResult, type MiniKind, type MiniResult, type WorldProgress } from '../game/world-activity';
import { clinicPrice, healthStep, HEALTH, ILLNESS_BY_ID, isNightHour, isSevere, MEDICINE_BY_ID, type HealthCtx } from '../game/health';
import { miniSkill, noteActivity } from './demo-f2p';
import { formFromCare, pickSpecies, SPECIES_BY_ID, stageForAge, REGIONS, GROW_MEMORY } from '../game/species';

const KEY = 'hatchday-demo';
interface DB {
  pet: PetRow | null; mem: MemoryRow[]; days: Record<string, DayLogRow>; fav: string; dis: string; firsts: string[]; nextId: number;
  toys?: { owned: string[]; day: string; used: Record<string, number> }; goals?: Record<number, { mine: number; claimed: boolean }>; isolating?: boolean;
  coins: number; earnedDay: string; earnedToday: number; owned: Record<string, number>; layouts: (Layout | null)[]; active: number;
  quests: string[]; collections: string[]; life?: number; seen?: SeenRow[];
  /** Ngày đã nhận suất ăn, tuần:idx đã nhận nhiệm vụ tuần, đã bù kho thức ăn cho bản lưu cũ. */
  ration?: string[]; weekly?: string[]; foodStock?: boolean;
  /** Gia phả: các bé đã ra đi (cũ trước) và ký ức của họ. Ở bản thử, nhật ký ngày và nhiệm vụ tuần tính lại từ đầu cho bé đời sau. */
  family?: PetRow[]; oldMem?: Record<string, MemoryRow[]>;
  /** Tủ lạnh (cấp 0–2), ngày đã tính thức ăn hỏng lần cuối, vườn rau (ô → cây và giờ gieo). */
  /** Mức nâng cấp của từng mảnh đất (0–2), mảnh đầu có sẵn. */
  /** Lúc chơi đồ chơi gần đây (ms), để tính căng cơ và cảm lạnh. */
  plays?: number[];
  /** Các cấp gắn bó bé hiện tại đã nhận quà. */
  bond?: number[];
  /** Xu đã bán nông sản theo ngày (trần mỗi ngày). */
  sold?: Record<string, number>;
  /** Quảng cáo thưởng hôm nay (mô phỏng ad_rewards/ad_nonces). */
  ads?: { day: string; count: number; last: number; nonce?: string; at?: number };
  /** Hoạt động thế giới (mô phỏng world_activity, world_totals, badge_claims, explore_claims, minigame_logs). */
  world?: { day: string; kinds: Record<string, number>; totals: Record<string, number>; badges: string[]; explore: string[]; exploreDays: number; mini: Record<string, { plays: number; best: number; last: number }> };
  parcels?: number[]; farm?: FarmItem[]; fridge?: number; spoilDay?: string; garden?: Record<string, { crop: string; planted_at: string; waters?: number; watered_at?: string }>;
}

function load(): DB {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null') as DB | null;
    if (d) {
      // bản lưu cũ (trước khi có loài): gán loài, tuổi thọ
      if (d.pet && !d.pet.species) { const sp = pickSpecies(0, Math.random()); d.pet.species = sp.id; d.pet.form = null; d.pet.genes = { ...d.pet.genes, region: 0, hue: 0 }; }
      if (d.pet && !d.life) d.life = 30 + Math.floor(Math.random() * 31);
      d.seen ||= d.pet ? [{ species_id: d.pet.species, first_at: d.pet.born_at, forms: [] }] : [];
      // bản lưu cũ (trước khi có kho thức ăn): tặng đủ phần ban đầu, đúng một lần
      if (d.pet && !d.foodStock) { for (const f of FOODS) d.owned[f.id] = Math.max(d.owned[f.id] || 0, FOOD_STOCK.start); d.foodStock = true; }
      d.ration ||= []; d.weekly ||= [];
      return d;
    }
  } catch { /* bỏ qua */ }
  return fresh();
}
/** Lớn lên theo tuổi (cùng luật với private.grow_pet). */
function grow(db: DB) {
  const p = db.pet; if (!p) return;
  const days = (Date.now() - Date.parse(p.born_at)) / 86400000, life = db.life || 45;
  if (p.stage === 'departed') return;
  const st = stageForAge(days, life);
  if (days >= life) {
    // hết tuổi thọ: chia tay (giống nhánh chia tay của private.grow_pet)
    if (!p.form) { const sum = { fed: 0, ball: 0, pet: 0, talk: 0, bath: 0 }; for (const d of Object.values(db.days)) { sum.fed += d.fed; sum.ball += d.ball; sum.pet += d.pet; sum.talk += d.talk; sum.bath += d.bath; } p.form = formFromCare(sum); }
    p.stage = 'departed'; p.departed_at = new Date(Date.parse(p.born_at) + life * 86400000).toISOString(); p.lived_days = life;
    first(db, 'depart', 'milestone', `Mình đã sống bên bạn ${life} ngày. Cảm ơn bạn đã thương mình, mình sẽ nhớ mãi.`);
    return;
  }
  if (st === p.stage) return;
  p.stage = st;
  if ((st === 'adult' || st === 'elder') && !p.form) {
    const sum = { fed: 0, ball: 0, pet: 0, talk: 0, bath: 0 };
    for (const d of Object.values(db.days)) { sum.fed += d.fed; sum.ball += d.ball; sum.pet += d.pet; sum.talk += d.talk; sum.bath += d.bath; }
    p.form = formFromCare(sum);
    const row = db.seen?.find(x => x.species_id === p.species);
    if (row && !row.forms.includes(p.form)) row.forms.push(p.form);
  }
  first(db, 'grow-' + st, 'milestone', GROW_MEMORY(st, p.form));
}
const fresh = (): DB => ({ pet: null, mem: [], days: {}, fav: '', dis: '', firsts: [], nextId: 1, coins: COIN.start, earnedDay: '', earnedToday: 0,
  owned: {}, layouts: [null, null, null], active: 0, quests: [], collections: [], ration: [], weekly: [], foodStock: true });
function earn(db: DB, n: number, capped: boolean): number {
  const d = localDay(); if (db.earnedDay !== d) { db.earnedDay = d; db.earnedToday = 0; }
  const got = capped ? Math.max(0, Math.min(n, COIN.careDailyCap - db.earnedToday)) : n;
  db.coins += got; if (capped) db.earnedToday += got; return got;
}
function store(db: DB) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* bỏ qua */ } }
function decay(db: DB) {
  if (!db.pet) return;
  const mins = (Date.now() - Date.parse(db.pet.stats_at)) / 60000;
  const d = decayStats({ ...db.pet, severe: isSevere(db.pet, Date.now()) }, mins, db.pet.comfort_level ?? 1);
  Object.assign(db.pet, { no: d.no, vui: d.vui, nl: d.nl, sach: d.sach, stats_at: new Date().toISOString() });
}
/** Số liệu cho healthStep: ăn trong 3 ngày, số lần chơi gần đây (giống các truy vấn trong private.health_step). */
function healthCtx(db: DB, action?: 'feed' | 'play', lastMealSweet = false): HealthCtx {
  const d = localDay(), n = dayNumber(d), now = Date.now();
  const logs = Object.values(db.days).filter(x => dayNumber(x.day) >= n - 2 && dayNumber(x.day) <= n);
  const plays = (db.plays || []).filter(t => now - t < 2 * 3600000);
  return {
    action, lastMealSweet, sweetsToday: (db.days[d]?.fgroups || []).filter(g => g === 'ngot').length,
    meals3d: logs.reduce((a, x) => a + x.fed, 0), healthyGroups3d: new Set(logs.flatMap(x => x.fgroups || []).filter(g => g !== 'ngot')).size,
    plays1h: plays.filter(t => now - t < 3600000).length, nightPlays2h: plays.filter(t => isNightHour(new Date(t).getHours(), isEpidemic(demoEvents()))).length, epidemic: isEpidemic(demoEvents()),
  };
}
/** Một bước đánh giá sức khoẻ (giống private.health_step). */
function tick(db: DB, action?: 'feed' | 'play', lastMealSweet = false) {
  const p = db.pet; if (!p || p.stage === 'departed') return;
  const r = healthStep(p, healthCtx(db, action, lastMealSweet), Date.now());
  p.illness = r.illness; p.sick_since = r.sick_since; p.critical_since = r.critical_since; p.recover_at = r.recover_at;
  if (r.event === 'fell-sick' && r.illness) first(db, 'sick-' + r.illness, 'milestone', `Lần đầu mình bị ${ILLNESS_BY_ID[r.illness].name.toLowerCase()}. Mình khó chịu lắm.`);
  if (r.event === 'recovered') first(db, 'cured', 'milestone', 'Mình khỏi bệnh rồi. Cảm ơn bạn đã chăm mình nhé.');
}
function cure(db: DB, bond: number) {
  const p = db.pet!; p.illness = null; p.sick_since = null; p.recover_at = null; p.critical_since = null; p.bond_xp += bond;
  first(db, 'cured', 'milestone', 'Mình khỏi bệnh rồi. Cảm ơn bạn đã chăm mình nhé.');
}
function day(db: DB): DayLogRow {
  const d = localDay();
  return (db.days[d] ||= { day: d, fed: 0, foods: [], fgroups: [], bath: 0, ball: 0, pet: 0, talk: 0, sleep: 0 });
}
function first(db: DB, key: string, kind: string, body: string): boolean {
  if (db.firsts.includes(key)) return false;
  db.firsts.push(key); db.mem.unshift({ id: db.nextId++, kind, body, created_at: new Date().toISOString() });
  return true;
}

export async function getMyPet(): Promise<PetRow | null> {
  const db = load(); decay(db); grow(db);
  if (db.pet && isBlank(db.pet.personality)) db.pet.personality = rollPersonality(); // giống phần chuyển dữ liệu trong migration cá tính
  if (db.pet?.stage === 'departed') {
    // như server: trả về bé vừa ra đi đúng một lần, rồi cất vào gia phả
    const gone = db.pet; (db.family ||= []).push(gone); (db.oldMem ||= {})[gone.id] = db.mem;
    db.pet = null; db.mem = []; db.firsts = []; db.days = {}; store(db); return gone;
  }
  store(db); return db.pet;
}
export async function listSpeciesSeen(): Promise<SeenRow[]> { return load().seen || []; }
/** Lùi ngày sinh `days` ngày (chỉ để xem thử tiến hoá). */
export async function demoAge(days: number): Promise<PetRow | null> {
  const db = load(); if (!db.pet) return null;
  db.pet.born_at = new Date(Date.parse(db.pet.born_at) - days * 86400000).toISOString();
  grow(db); store(db); return db.pet;
}

export async function createPet(name: string, family: string, egg: number): Promise<PetRow> {
  const db = load();
  if (db.pet) throw new Error('pet_exists');
  if (db.family?.length) throw new Error('heir_required');
  const ids = FOODS.map(f => f.id).sort(() => Math.random() - 0.5);
  const now = new Date().toISOString();
  if (!(egg >= 0 && egg < REGIONS.length)) throw new Error('invalid_egg');
  const sp = pickSpecies(egg, Math.random());
  db.pet = { id: 'demo', owner_id: 'demo', name, family_name: family, generation: 1, stage: 'baby', species: sp.id, form: null,
    genes: { region: egg, ear: Math.floor(Math.random() * 4), scale: Math.round((0.96 + Math.random() * 0.08) * 1000) / 1000, hue: Math.round((Math.random() * 2 - 1) * 100) / 100 },
    personality: rollPersonality(), no: 72, vui: 74, nl: 82, sach: 85, asleep: false, stats_at: now, bond_xp: 0, born_at: now };
  db.bond = [];
  db.fav = ids[0]; db.dis = ids[1]; db.life = 30 + Math.floor(Math.random() * 31);
  db.seen ||= []; if (!db.seen.some(x => x.species_id === sp.id)) db.seen.push({ species_id: sp.id, first_at: now, forms: [] });
  const tags = ['mem', 'sach', 'cay', 'choi', 'sang', 'retro'].sort(() => Math.random() - 0.5);
  db.pet.genes.likes = [tags[0], tags[1]]; db.pet.genes.dislike = tags[2];
  db.pet.outfit = {}; db.pet.outfit_presets = [{}, {}, {}];
  for (const id of STARTER_ITEMS) db.owned[id] = Math.max(db.owned[id] || 0, 1);
  for (const f of FOODS) db.owned[f.id] = Math.max(db.owned[f.id] || 0, FOOD_STOCK.start);
  db.layouts[0] = structuredClone(DEFAULT_LAYOUT); db.active = 0;
  db.pet.comfort_level = comfortLevel(comfortScore(DEFAULT_LAYOUT));
  first(db, 'meet', 'meet', `Ngày đầu tiên gặp bạn. Mình là một bé ${sp.name}, bạn đặt tên mình là ${name}.`);
  store(db);
  return db.pet;
}

/** Đón thú đời sau (giống public.hatch_heir). */
export async function hatchHeir(name: string, egg: number): Promise<PetRow> {
  const db = load();
  if (db.pet) throw new Error('pet_exists');
  const par = db.family?.[db.family.length - 1]; if (!par) throw new Error('no_parent');
  name = name.trim(); if (name.length < 1 || name.length > 16) throw new Error('invalid_name');
  if (!(egg >= 0 && egg < REGIONS.length)) throw new Error('invalid_egg');
  const sp = pickHeirSpecies(par.species, egg, Math.random(), Math.random()), spec = SPECIES_BY_ID[sp], now = new Date().toISOString();
  const pl = par.genes.likes?.[0];
  const tags = ['mem', 'sach', 'cay', 'choi', 'sang', 'retro'].filter(t => t !== pl).sort(() => Math.random() - 0.5);
  const likes = pl ? [pl, tags[0]] : [tags[0], tags[1]], dislike = pl ? tags[1] : tags[2];
  const foods = FOODS.map(f => f.id).sort(() => Math.random() - 0.5);
  const fav = db.fav && Math.random() < HEIR_FAV_INHERIT ? db.fav : foods[0];
  db.fav = fav; db.dis = foods.find(x => x !== fav)!; db.life = 30 + Math.floor(Math.random() * 31); db.bond = [];
  db.pet = { id: 'demo-' + (par.generation + 1), owner_id: 'demo', name, family_name: par.family_name, generation: par.generation + 1, stage: 'baby', species: sp, form: null, parent_id: par.id,
    genes: { region: egg, ear: par.genes.ear, scale: Math.round((0.96 + Math.random() * 0.08) * 1000) / 1000, hue: Math.round(((par.genes.hue || 0) * 0.5 + (Math.random() * 2 - 1) * 0.5) * 100) / 100, likes, dislike },
    personality: blendPersonality(normalize(par.personality), rollPersonality()), no: 72, vui: 74, nl: 82, sach: 85, asleep: false, stats_at: now, bond_xp: 0, born_at: now,
    outfit: {}, outfit_presets: [{}, {}, {}], comfort_level: comfortLevel(comfortScore(db.layouts[db.active] || DEFAULT_LAYOUT)) };
  db.seen ||= []; if (!db.seen.some(x => x.species_id === sp)) db.seen.push({ species_id: sp, first_at: now, forms: [] });
  for (const f of FOODS) db.owned[f.id] = Math.max(db.owned[f.id] || 0, FOOD_STOCK.start);
  first(db, 'meet', 'meet', `Mình là một bé ${spec.name}, đời thứ ${db.pet.generation} của ${par.family_name}. Mình nghe kể về ${par.name} nhiều lắm.`);
  store(db); return db.pet;
}
/** Cả gia phả, cũ trước (bé đã đi và bé hiện tại). */
export async function listFamily(): Promise<PetRow[]> { const db = load(); return [...(db.family || []), ...(db.pet && db.pet.stage !== 'departed' ? [db.pet] : [])]; }

export async function renamePet(name: string) { const db = load(); if (db.pet) db.pet.name = name; store(db); }

export async function petAction(action: PetAction, item?: string, count = 1): Promise<ActionResult> {
  const db = load(); if (!db.pet) throw new Error('no_pet');
  decay(db);
  const p = db.pet, d = day(db), n = Math.max(1, Math.min(count, 20));
  const play = action === 'play_ball' || action === 'play_spin';
  let sweetMeal = false;
  let refused: ActionResult['refused'] = null, fav = false, disliked = false, newMem = false, balanced = false, stock: number | null = null;
  if (p.asleep && action !== 'wake' && action !== 'pet') refused = 'asleep';
  else if (action === 'feed') {
    const f = FOOD_BY_ID[item || '']; if (!f) throw new Error('unknown_item');
    if (!(db.owned[f.id] >= 1)) throw new Error('not_owned');
    if (p.no >= 90) refused = 'full';
    else {
      fav = item === db.fav; disliked = item === db.dis;
      d.fed++; d.foods.push(f.name); (d.fgroups ||= []).push(f.group); if (f.group2) d.fgroups.push(f.group2);
      balanced = isBalanced(Object.values(db.days).map(x => ({ d: x.day, groups: x.fgroups || [] })), localDay());
      p.no = clamp(p.no + f.no); p.vui = clamp(p.vui + f.vui + (fav ? 10 : 0) - (item === db.dis ? 6 : 0) + (balanced ? BALANCED_BONUS : 0)); p.sach = clamp(p.sach - 2);
      stock = --db.owned[f.id]; sweetMeal = f.group === 'ngot' || f.group2 === 'ngot';
      newMem = first(db, 'food-' + item, 'food', fav ? `Lần đầu ăn ${f.name}, hoá ra là món tủ của mình!` : disliked ? `Lần đầu ăn ${f.name}, mình không ưa món này lắm.` : `Lần đầu được ăn ${f.name}.`);
    }
  } else if (action === 'pet') { p.vui = clamp(p.vui + 1.6 * n); d.pet += n; }
  else if (action === 'bath_scrub') p.sach = clamp(p.sach + 3 * n);
  else if (action === 'bath_rinse') { p.sach = 100; p.vui = clamp(p.vui + 4); d.bath++; newMem = first(db, 'bath', 'bath', 'Lần đầu được tắm bồn với vịt cao su.'); }
  else if (action === 'play_ball' || action === 'play_spin') {
    if (p.nl < 15) refused = 'tired';
    else {
      p.vui = clamp(p.vui + (action === 'play_ball' ? 8 : 6)); p.nl = clamp(p.nl - 4); p.no = clamp(p.no - 2);
      if (action === 'play_ball') { d.ball++; newMem = first(db, 'ball', 'play', 'Lần đầu chơi ném bóng ngoài vườn.'); }
    }
  } else if (action === 'talk') { p.vui = clamp(p.vui + 2); d.talk++; }
  else if (action === 'sleep') { p.asleep = true; d.sleep++; }
  else if (action === 'wake') p.asleep = false;
  if (!refused) {
    // giống trigger action_log_health: chặn việc bé ốm không làm được, rồi xét bệnh do hành động
    const blk = p.illness ? ILLNESS_BY_ID[p.illness]?.block || [] : [];
    if ((play && blk.includes('play')) || ((action === 'bath_scrub' || action === 'bath_rinse') && blk.includes('bath'))) throw new Error('sick_blocked');
    if (play) db.plays = [...(db.plays || []).filter(t => Date.now() - t < 2 * 3600000), Date.now()];
    p.bond_xp += 1; // giống pet_action
    if (GOAL_OF[action]) goalAdd(db, GOAL_OF[action]);
    p.personality = applyDrift(normalize(p.personality), action); // giống trigger trên action_log
    tick(db, play ? 'play' : action === 'feed' ? 'feed' : undefined, sweetMeal);
  }
  const earned = !refused && ['feed', 'bath_rinse', 'play_ball', 'play_spin', 'talk', 'sleep'].includes(action) ? earn(db, COIN.careReward, true) : 0;
  store(db);
  return { pet: { ...p }, refused, fav, new_memory: newMem, earned, coins: db.coins, stock, balanced, dislike: disliked };
}

export async function addTalkMemory(text: string) {
  const db = load(); const t = text.trim().slice(0, 120); if (t.length < 4) return;
  db.mem.unshift({ id: db.nextId++, kind: 'talk', body: `Bạn kể: “${t}”`, created_at: new Date().toISOString() }); store(db);
}
export async function listMemories(petId?: string): Promise<MemoryRow[]> { const db = load(); return (petId && db.oldMem?.[petId] ? db.oldMem[petId] : db.mem).slice(0, 60); }
export async function deleteMemory(id: number) { const db = load(); db.mem = db.mem.filter(m => m.id !== id); store(db); }
export async function listDayLogs(): Promise<DayLogRow[]> { return Object.values(load().days).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30); }
export function resetDemo() { try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ } }

/* ---------- Trang trí, trang phục, xu, nhiệm vụ (mô phỏng RPC) ---------- */
/** Thức ăn tươi hỏng dần (giống private.apply_spoilage). Trả về { món: số phần hỏng } của lần này. */
function applySpoilage(db: DB): Record<string, number> {
  const d = localDay(), lost: Record<string, number> = {};
  if (!db.spoilDay) { db.spoilDay = d; return lost; }
  const gap = Math.min(Math.max(dayNumber(d) - dayNumber(db.spoilDay), 0), 7);
  if (dayNumber(d) > dayNumber(db.spoilDay)) db.spoilDay = d;
  const keep = FRIDGE[db.fridge || 0].keep;
  for (let i = 0; i < gap; i++) for (const f of EDIBLES) {
    if (!f.fresh) continue;
    const have = db.owned[f.id] || 0, l = spoilLoss(have, keep);
    if (l) { db.owned[f.id] = have - l; lost[f.id] = (lost[f.id] || 0) + l; }
  }
  return lost;
}
export async function getEconomy(): Promise<Economy> {
  const db = load(), d = localDay(), spoiled = applySpoilage(db); store(db);
  return { fridge_level: db.fridge || 0, spoiled, coins: db.coins, earned_today: db.earnedDay === d ? db.earnedToday : 0, day: d, rotation: rotationForDay(d), weekend: isWeekend(d), ration_claimed: !!db.ration?.includes(d) };
}
export async function buyItem(id: string): Promise<{ coins: number; qty: number; paid?: number }> {
  const db = load(), it = BY_ID[id];
  if (!it || it.kind === 'food') throw new Error('unknown_item');
  if (!buyable(it, localDay())) throw new Error('not_for_sale');
  if ((it.kind === 'outfit' || it.layer === 'wallpaper' || it.layer === 'flooring') && db.owned[id]) throw new Error('already_owned');
  const paid = px(it.kind === 'outfit' ? 'outfit' : 'decor', it.price || 0);
  if (db.coins < paid) throw new Error('not_enough_coins');
  db.coins -= paid; db.owned[id] = (db.owned[id] || 0) + 1; store(db);
  return { coins: db.coins, qty: db.owned[id], paid };
}
export async function listOwned() { return load().owned; }
export async function getLayouts() { const db = load(); return { layouts: db.layouts, active: db.active }; }
export async function saveLayout(slot: number, layout: Layout, activate = true) {
  const db = load();
  const n: Record<string, number> = {};
  for (const p of layout.items) n[p.id] = (n[p.id] || 0) + 1;
  for (const id of [layout.wallpaper, layout.flooring]) if (!db.owned[id]) throw new Error('not_owned');
  for (const [id, k] of Object.entries(n)) if ((db.owned[id] || 0) < k) throw new Error('not_owned');
  db.layouts[slot] = structuredClone(layout);
  const lvl = comfortLevel(comfortScore(layout));
  if (activate) { db.active = slot; if (db.pet) { decay(db); db.pet.comfort_level = lvl; } }
  store(db); return { comfort_level: lvl };
}
export async function equipOutfit(o: Outfit) {
  const db = load(); const clean: Outfit = {};
  for (const [k, v] of Object.entries(o)) if (v) { if (BY_ID[v]?.slot !== k || !db.owned[v]) throw new Error('not_owned'); clean[k as keyof Outfit] = v; }
  if (db.pet) db.pet.outfit = clean; store(db); return clean;
}
export async function saveOutfitPreset(i: number, o: Outfit) {
  const db = load(); if (!db.pet) return;
  const p = db.pet.outfit_presets || [{}, {}, {}]; p[i] = Object.fromEntries(Object.entries(o).filter(([, v]) => v)); db.pet.outfit_presets = p; store(db);
}
function dayProgress(log: DayLogRow | undefined, key: string): number {
  if (!log) return 0;
  if (key === 'foods_distinct') return new Set(log.foods).size;
  if (key === 'groups_distinct') return new Set(log.fgroups || []).size;
  return Number((log as unknown as Record<string, number>)[key]) || 0;
}
export async function getQuests(): Promise<QuestBoard> {
  const db = load(), d = localDay(), log = db.days[d], ws = weekStart(d), w0 = dayNumber(ws);
  const quests: QuestRow[] = questsForDay(d).map((q, i) => ({ idx: i, quest: q, target: QUEST_POOL[q].target, reward: QUEST_POOL[q].reward,
    progress: dayProgress(log, QUEST_POOL[q].key), claimed: db.quests.includes(d + ':' + i) }));
  const weekly: QuestRow[] = weeklyForDay(d).map((q, i) => ({ idx: i, quest: q, target: WEEKLY_POOL[q].target, reward: WEEKLY_POOL[q].reward,
    progress: Object.values(db.days).filter(x => dayNumber(x.day) >= w0 && dayNumber(x.day) <= w0 + 6).reduce((s, x) => s + dayProgress(x, WEEKLY_POOL[q].key), 0),
    claimed: !!db.weekly?.includes(ws + ':' + i) }));
  return { day: d, quests, week: ws, weekly, bonus: { reward: QUEST_BONUS, ready: quests.every(q => q.claimed), claimed: db.quests.includes(d + ':5') } };
}
export async function claimQuest(i: number) {
  const q = (await getQuests()).quests[i]; if (!(i >= 0 && i <= 4) || !q) throw new Error('invalid_quest');
  if (q.progress < q.target) throw new Error('quest_not_done');
  const db = load(), k = localDay() + ':' + i; if (db.quests.includes(k)) throw new Error('already_claimed');
  const r = boostedReward(q.reward, demoBoost()); db.quests.push(k); earn(db, r, false); store(db); return { coins: db.coins, reward: r };
}
export async function claimQuestBonus() {
  const b = await getQuests(); if (!b.bonus.ready) throw new Error('quest_not_done');
  const db = load(), k = localDay() + ':5'; if (db.quests.includes(k)) throw new Error('already_claimed');
  const r = boostedReward(QUEST_BONUS, demoBoost()); db.quests.push(k); earn(db, r, false); store(db); return { coins: db.coins, reward: r };
}
export async function claimWeeklyQuest(i: number) {
  const b = await getQuests(), q = b.weekly[i]; if (!(i >= 0 && i <= 2) || !q) throw new Error('invalid_quest');
  if (q.progress < q.target) throw new Error('quest_not_done');
  const db = load(), k = b.week + ':' + i; if (db.weekly?.includes(k)) throw new Error('already_claimed');
  const r = boostedReward(q.reward, demoBoost()); (db.weekly ||= []).push(k); earn(db, r, false); store(db); return { coins: db.coins, reward: r };
}

/* ---------- Thức ăn nâng cao: tủ lạnh, vườn rau, nấu ăn, khẩu vị ---------- */
export async function upgradeFridge() {
  const db = load(), lvl = db.fridge || 0; if (lvl >= 2) throw new Error('max_level');
  const cost = FRIDGE[lvl + 1].price; if (db.coins < cost) throw new Error('not_enough_coins');
  db.coins -= cost; db.fridge = lvl + 1; store(db); return { coins: db.coins, fridge_level: db.fridge };
}
export async function getGarden(): Promise<Garden> {
  const db = load(), now = Date.now();
  const plots = Object.entries(db.garden || {}).map(([k, g]) => {
    const waters = g.waters || 0, ready = readyAtMs(Date.parse(g.planted_at), CROPS.find(c => c.id === g.crop)!.hours, waters);
    const gapOk = !g.watered_at || now - Date.parse(g.watered_at) >= WATER.gapMinutes * 60000;
    return { plot: +k, crop: g.crop, planted_at: g.planted_at, ready_at: new Date(ready).toISOString(), ready: now >= ready,
      waters, watered_at: g.watered_at || null, can_water: waters < WATER.max && now < ready && gapOk };
  }).sort((a, b) => a.plot - b.plot);
  const parcels = (db.parcels || [0]).map((level, parcel) => ({ parcel, level, size: GARDEN_LAND[level].plots }));
  return { now: new Date(now).toISOString(), parcels, plots };
}
export async function plantCrop(plot: number, crop: string) {
  const db = load(); if (!(plot >= 0 && plot < GARDEN_PLOTS)) throw new Error('invalid_plot');
  const lvl = (db.parcels || [0])[Math.floor(plot / PARCEL.plots)];
  if (lvl === undefined || plot % PARCEL.plots >= GARDEN_LAND[lvl].plots) throw new Error('plot_locked');
  const c = CROPS.find(x => x.id === crop); if (!c) throw new Error('unknown_crop');
  if (db.garden?.[plot]) throw new Error('plot_busy');
  if (db.coins < c.seed) throw new Error('not_enough_coins');
  db.coins -= c.seed; (db.garden ||= {})[plot] = { crop, planted_at: new Date().toISOString() }; store(db); return { coins: db.coins };
}
export async function upgradeParcel(parcel: number) {
  const db = load(), levels = db.parcels || [0]; if (!(parcel in levels)) throw new Error('plot_locked');
  const lvl = levels[parcel]; if (lvl >= GARDEN_LAND.length - 1) throw new Error('max_land');
  const cost = GARDEN_LAND[lvl + 1].price; if (db.coins < cost) throw new Error('not_enough_coins');
  db.coins -= cost; levels[parcel] = lvl + 1; db.parcels = levels; store(db);
  return { coins: db.coins, parcel, level: lvl + 1, size: GARDEN_LAND[lvl + 1].plots };
}
export async function buyParcel() {
  const db = load(), levels = db.parcels || [0], n = levels.length;
  if (n >= PARCEL.max) throw new Error('max_parcels');
  if (levels[n - 1] < GARDEN_LAND.length - 1) throw new Error('parcel_not_full');
  const cost = PARCEL.prices[n]; if (db.coins < cost) throw new Error('not_enough_coins');
  db.coins -= cost; levels.push(0); db.parcels = levels; store(db);
  return { coins: db.coins, parcel: n };
}
/** Bố cục nông trại (giống public.save_farm_layout: đúng loại 'farm', đủ số lượng sở hữu, trong sân, xoay 0–3). */
export async function getFarm(): Promise<FarmItem[]> { return structuredClone(load().farm || []); }
export async function saveFarm(items: FarmItem[]) {
  const db = load(); if (!Array.isArray(items) || items.length > 60) throw new Error('invalid_layout');
  const n: Record<string, number> = {};
  for (const it of items) {
    if (BY_ID[it.id]?.layer !== 'farm' || !(Math.abs(it.x) <= 6.5 && it.z >= -4.2 && it.z <= 5.2) || ![0, 1, 2, 3].includes(it.rot)) throw new Error('invalid_layout');
    n[it.id] = (n[it.id] || 0) + 1;
  }
  for (const [id, k] of Object.entries(n)) if ((db.owned[id] || 0) < k) throw new Error('not_owned');
  db.farm = structuredClone(items); store(db); return { count: items.length };
}
export async function waterCrop(plot: number) {
  const db = load(), g = db.garden?.[plot]; if (!g) throw new Error('plot_empty');
  const c = CROPS.find(x => x.id === g.crop)!, now = Date.now(), waters = g.waters || 0;
  if (now >= readyAtMs(Date.parse(g.planted_at), c.hours, waters)) throw new Error('already_ready');
  if (waters >= WATER.max) throw new Error('max_watered');
  if (g.watered_at && now - Date.parse(g.watered_at) < WATER.gapMinutes * 60000) throw new Error('too_soon');
  g.waters = waters + 1; g.watered_at = new Date(now).toISOString(); store(db);
  return { waters: g.waters, ready_at: new Date(readyAtMs(Date.parse(g.planted_at), c.hours, g.waters)).toISOString() };
}
export async function harvestCrop(plot: number) {
  const db = load(), g = db.garden?.[plot]; if (!g) throw new Error('plot_empty');
  const c = CROPS.find(x => x.id === g.crop)!;
  if (Date.now() < readyAtMs(Date.parse(g.planted_at), c.hours, g.waters || 0)) throw new Error('not_ready');
  applySpoilage(db);
  const got = Math.min(c.yield, FOOD_STOCK.max - (db.owned[c.id] || 0)); if (got <= 0) throw new Error('stock_full');
  db.owned[c.id] = (db.owned[c.id] || 0) + got; delete db.garden![plot]; store(db);
  return { item: c.id, qty: db.owned[c.id], got };
}
export async function cook(recipe: string, qty = 1) {
  const db = load(), r = RECIPES.find(x => x.id === recipe); if (!r) throw new Error('unknown_recipe');
  if (!(qty >= 1 && qty <= 5)) throw new Error('invalid_qty');
  applySpoilage(db);
  if ((db.owned[r.a] || 0) < qty || (db.owned[r.b] || 0) < qty) throw new Error('missing_ingredient');
  if ((db.owned[r.dish] || 0) + qty > FOOD_STOCK.max) throw new Error('stock_full');
  db.owned[r.a] -= qty; db.owned[r.b] -= qty; db.owned[r.dish] = (db.owned[r.dish] || 0) + qty; store(db);
  return { dish: r.dish, qty: db.owned[r.dish] };
}
/** Món tủ và món ghét chỉ lộ ra sau khi bé được ăn thử món đó (giống public.get_tastes). */
export async function getTastes(): Promise<Tastes> {
  const db = load(), tried = (id: string) => db.firsts.includes('food-' + id);
  return { fav: db.fav && tried(db.fav) ? db.fav : null, dis: db.dis && tried(db.dis) ? db.dis : null, tried: FOODS.filter(f => tried(f.id)).length, total: FOODS.length };
}

/* ---------- Thức ăn ---------- */
export async function buyFood(id: string, qty: number) {
  const db = load(), f = FOOD_BY_ID[id]; if (!f || f.kind !== 'food' || f.price == null) throw new Error('unknown_item');
  if (!(qty >= 1 && qty <= FOOD_STOCK.packMax)) throw new Error('invalid_qty');
  if ((db.owned[id] || 0) + qty > FOOD_STOCK.max) throw new Error('stock_full');
  const total = px('food', f.price) * qty;
  if (db.coins < total) throw new Error('not_enough_coins');
  db.coins -= total; db.owned[id] = (db.owned[id] || 0) + qty; store(db);
  return { coins: db.coins, qty: db.owned[id], paid: total };
}
export async function claimRation() {
  const db = load(), d = localDay(); if (db.ration?.includes(d)) throw new Error('already_claimed');
  (db.ration ||= []).push(d);
  db.owned[FOOD_STOCK.rationId] = Math.min(FOOD_STOCK.max, (db.owned[FOOD_STOCK.rationId] || 0) + FOOD_STOCK.ration); store(db);
  return { item: FOOD_STOCK.rationId, qty: db.owned[FOOD_STOCK.rationId] };
}
export async function claimCollection(t: string) {
  const db = load();
  if (t === 'le-hoi') throw new Error('invalid_theme');
  if (ITEMS.some(i => i.theme === t && !db.owned[i.id])) throw new Error('collection_incomplete');
  if (db.collections.includes(t)) throw new Error('already_claimed');
  db.collections.push(t); earn(db, COIN.collectionReward, false);
  first(db, 'collection-' + t, 'milestone', 'Tụi mình sưu tập đủ một bộ đồ trang trí rồi!');
  store(db); return { coins: db.coins };
}
export async function listCollectionClaims() { return load().collections; }


/* ---------- Sức khoẻ: bệnh, thuốc, phòng khám (mô phỏng RPC) ---------- */
export async function getHealth(): Promise<PetRow | null> {
  const db = load(); if (!db.pet || db.pet.stage === 'departed') return db.pet;
  decay(db); tick(db); store(db); return db.pet;
}
export async function buyMedicine(id: string, qty: number) {
  const db = load(), m = MEDICINE_BY_ID[id]; if (!m) throw new Error('unknown_item');
  if (!(qty >= 1 && qty <= 10)) throw new Error('invalid_qty');
  const cur = db.owned[id] || 0; if (cur + qty > HEALTH.medicineMax) throw new Error('stock_full');
  const total = px('medicine', m.price) * qty;
  if (db.coins < total) throw new Error('not_enough_coins');
  db.coins -= total; db.owned[id] = cur + qty; store(db); return { coins: db.coins, qty: db.owned[id], paid: total };
}
export async function useMedicine(id: string): Promise<CureResult> {
  const db = load(), m = MEDICINE_BY_ID[id]; if (!m) throw new Error('unknown_item');
  if (!db.pet) throw new Error('no_pet');
  decay(db); tick(db); const p = db.pet;
  if (!p.illness) throw new Error('not_sick');
  if (m.cures !== p.illness) throw new Error('wrong_medicine');
  if (isSevere(p, Date.now())) throw new Error('needs_clinic');
  if (!(db.owned[id] >= 1)) throw new Error('not_owned');
  db.owned[id]--; cure(db, HEALTH.cureBond); store(db);
  return { pet: { ...p }, qty: db.owned[id] };
}
export async function visitClinic(): Promise<CureResult> {
  const db = load(); if (!db.pet) throw new Error('no_pet');
  decay(db); tick(db); const p = db.pet;
  if (!p.illness) throw new Error('not_sick');
  const il = ILLNESS_BY_ID[p.illness], cost = clinicPrice(isSevere(p, Date.now()));
  if (db.coins < cost) throw new Error('not_enough_coins');
  db.coins -= cost;
  if (il.heal.kind === 'stat') p[il.heal.stat] = Math.max(p[il.heal.stat], HEALTH.clinicRestore);
  cure(db, HEALTH.cureBond); store(db);
  return { pet: { ...p }, coins: db.coins };
}


/* ---------- Gắn bó (mô phỏng RPC) ---------- */
export async function getBondClaims(): Promise<number[]> { return load().bond || []; }
export async function claimBond(level: number) {
  const db = load(); if (!db.pet) throw new Error('no_pet');
  if (!(level >= 2 && level <= 10)) throw new Error('invalid_level');
  if (bondLevel(db.pet.bond_xp) < level) throw new Error('bond_too_low');
  if ((db.bond || []).includes(level)) throw new Error('already_claimed');
  (db.bond ||= []).push(level); const reward = BOND.rewards[level - 1]; earn(db, reward, false);
  first(db, 'bond-' + level, 'milestone', `Chúng mình thân nhau hơn rồi, đã đạt cấp gắn bó ${level}.`); store(db);
  return { coins: db.coins, reward };
}


/* ---------- Chợ: thu mua nông sản (mô phỏng RPC) ---------- */
export async function getSellState() { const db = load(); return { today: db.sold?.[localDay()] || 0, cap: SELL.dailyCap }; }
export async function sellFood(id: string, qty: number) {
  const db = load(), f = FOODS.find(x => x.id === id);
  if (!f) throw new Error('unknown_item');
  if (!(qty >= 1 && qty <= SELL.maxQty)) throw new Error('invalid_qty');
  if ((db.owned[id] || 0) < qty) throw new Error('not_owned');
  const d = localDay(), today = db.sold?.[d] || 0, total = sellPrice(f.price) * qty;
  if (total <= 0) throw new Error('not_for_sale');
  if (today + total > SELL.dailyCap) throw new Error('sell_cap');
  db.owned[id] -= qty; earn(db, total, false); (db.sold ||= {})[d] = today + total; store(db);
  return { coins: db.coins, qty: db.owned[id], got: total, today: today + total, cap: SELL.dailyCap };
}

/* ---------- Cổng cho demo-social: cùng bản lưu (xu, kho, thú), cùng luật cộng xu ---------- */
export type DemoDB = DB;
export function withDB<T>(fn: (db: DB, earnCoins: (n: number) => number) => T): T {
  const db = load(); const r = fn(db, n => earn(db, n, false)); store(db); return r;
}

/* ---------- Sự kiện (mô phỏng get_active_events): thêm ?event=boost vào địa chỉ để xem thử ---------- */
export function demoEvents(): ActiveEvent[] {
  let flags: string[] = []; try { flags = (new URLSearchParams(location.search).get('event') || '').split(',').filter(Boolean); } catch { /* không có location */ }
  const has = (k: string) => flags.includes(k) || flags.includes('all'), t0 = new Date(Date.now() - 3600000).toISOString(), t1 = new Date(Date.now() + 7 * 86400000).toISOString();
  const out: ActiveEvent[] = [];
  if (has('boost')) out.push({ id: 1, title: 'Tuần lễ nhiệm vụ', body: 'Hoàn thành nhiệm vụ để nhận thêm xu.', kind: 'limited', starts_at: t0, ends_at: t1, config: { banner: 'Tuần lễ nhiệm vụ: xu thưởng nhiệm vụ nhân 1,5!', coin_boost: 1.5, plaza_decor: 'trung-thu' } });
  if (has('sale')) out.push({ id: 2, title: 'Chợ giảm giá', body: 'Thức ăn và thuốc giảm giá.', kind: 'limited', starts_at: t0, ends_at: t1, config: { banner: 'Chợ giảm giá: thức ăn -20%, thuốc -30%!', shop_discount: { pct: 20, scope: 'food' } } as ActiveEvent['config'] });
  if (has('goal')) out.push({ id: 3, title: 'Cả nhà cùng ăn', body: 'Cộng đồng cùng cho bé ăn.', kind: 'limited', starts_at: t0, ends_at: t1, config: { banner: 'Mục tiêu cộng đồng: cùng cho bé ăn!', goal: { metric: 'feed', target: 200, reward_coins: 40 } } as ActiveEvent['config'] });
  if (has('flu')) out.push({ id: 4, title: 'Mùa cúm', body: 'Trời trở lạnh, bé dễ cảm hơn. Cẩn thận khi đi chỗ đông người.', kind: 'limited', starts_at: t0, ends_at: t1, config: { banner: 'Mùa cúm: giữ ấm cho bé, thuốc ho giảm giá!', epidemic: true, shop_discount: { pct: 30, scope: 'medicine' } } as ActiveEvent['config'] });
  return out;
}
/** Giá sau giảm giá sự kiện (giống private.discounted). */
const px = (kind: DiscountScope, base: number) => discountedPrice(base, discountPct(demoEvents(), kind));

/* ---------- Đồ chơi (mô phỏng get_toys / buy_toy / play_toy) ---------- */
const toysOf = (db: DB): { owned: string[]; day: string; used: Record<string, number> } => { const d = localDay(); if (!db.toys || db.toys.day !== d) db.toys = { owned: db.toys?.owned || [], day: d, used: {} }; return db.toys; };
export async function getToys(): Promise<ToysState> { const db = load(), t = toysOf(db); return { owned: [...t.owned], used: { ...t.used } }; }
export async function buyToy(id: string): Promise<{ coins: number; paid: number }> {
  const db = load(), t = TOY_BY_ID[id], ts = toysOf(db); if (!t || t.place !== 'portable' || t.price == null) throw new Error('unknown_toy');
  if (ts.owned.includes(id)) throw new Error('already_owned');
  const paid = px('toy', t.price); if (db.coins < paid) throw new Error('not_enough_coins');
  db.coins -= paid; ts.owned.push(id); store(db); return { coins: db.coins, paid };
}
export async function playToy(id: string): Promise<ToyResult> {
  const db = load(), t = TOY_BY_ID[id]; if (!db.pet) throw new Error('no_pet'); if (!t) throw new Error('unknown_toy');
  decay(db); const p = db.pet, ts = toysOf(db);
  if (bondLevel(p.bond_xp) < t.bond) throw new Error('toy_locked');
  if (t.place === 'portable' && !ts.owned.includes(id)) throw new Error('toy_not_owned');
  const used = ts.used[id] || 0; let refused: ToyResult['refused'] = null, earned = 0, newMem = false, mult = 1;
  if (p.asleep) refused = 'asleep'; else if (p.nl < 15) refused = 'tired'; else if (used >= t.cap) refused = 'toy_cap';
  else {
    if ((p.illness ? ILLNESS_BY_ID[p.illness]?.block || [] : []).includes('play')) throw new Error('sick_blocked');
    mult = used >= 2 ? 0.5 : 1; const g = toyGain(t, used);
    ts.used[id] = used + 1; p.vui = clamp(p.vui + g.vui); p.nl = clamp(p.nl + g.nl); p.no = clamp(p.no + g.no);
    db.plays = [...(db.plays || []).filter(x => Date.now() - x < 2 * 3600000), Date.now()];
    p.bond_xp += 1; p.personality = applyDriftBy(normalize(p.personality), t.drift); tick(db, 'play'); worldToy(db, id);
    earned = earn(db, COIN.careReward, true); newMem = first(db, 'toy-' + id, 'play', t.memory); goalAdd(db, 'play');
  }
  store(db);
  return { pet: { ...p }, refused, earned, coins: db.coins, new_memory: newMem, mult, left: Math.max(0, t.cap - used - (refused ? 0 : 1)), toy: id };
}

/* ---------- Hoạt động thế giới: Khám phá hôm nay, huy hiệu, mini-game (mô phỏng record_activity… ) ---------- */
const worldOf = (db: DB) => { const d = localDay(); if (!db.world) db.world = { day: d, kinds: {}, totals: {}, badges: [], explore: [], exploreDays: 0, mini: {} }; if (db.world.day !== d) { db.world.day = d; db.world.kinds = {}; db.world.explore = []; db.world.mini = {}; } return db.world; };
const worldTotal = (w: NonNullable<DB['world']>, k: string) => (k === 'explore' ? w.exploreDays : w.totals[k] || 0);
const crossed = (w: NonNullable<DB['world']>, k: string, before: number) => BADGES.filter(b => b.kind === k && before < b.target && worldTotal(w, k) >= b.target).map(b => b.id);
/** Đồ chơi chơi hôm nay cũng tính vào Khám phá và huy hiệu (giống toy_logs ở máy chủ). */
function worldToy(db: DB, id: string) { noteActivity(id); const w = worldOf(db); w.kinds[id] = (w.kinds[id] || 0) + 1; if ((TOY_KINDS as readonly string[]).includes(id)) w.totals[id] = (w.totals[id] || 0) + 1; }
export async function getWorldProgress(): Promise<WorldProgress> {
  const db = load(), w = worldOf(db), kinds = Object.keys(w.kinds).filter(k => w.kinds[k] > 0).sort(), n = kinds.length, lim = MINI.plays;
  return {
    day: w.day, kinds,
    explore: EXPLORE_TIERS.map((t, i) => ({ tier: i, need: t.need, reward: t.reward, claimed: w.explore.includes(String(i)), ready: n >= t.need })),
    badges: BADGES.map(b => ({ id: b.id, progress: Math.min(worldTotal(w, b.kind), b.target), target: b.target, reward: b.reward, claimed: w.badges.includes(b.id) })),
    mini: Object.fromEntries(MINI_KINDS.map(k => { const m = w.mini[k]; return [k, { plays: m?.plays || 0, left: Math.max(0, lim - (m?.plays || 0)), best: m?.best || 0 }]; })) as WorldProgress['mini'],
  };
}
export async function recordActivity(kind: string): Promise<ActivityResult> {
  if (!(ACTIVITY_KINDS as readonly string[]).includes(kind)) throw new Error('unknown_activity');
  const db = load(); if (!db.pet) throw new Error('no_pet');
  const w = worldOf(db); let counted = false, newly: string[] = [];
  if ((w.kinds[kind] || 0) < 30) { const b = worldTotal(w, kind); w.kinds[kind] = (w.kinds[kind] || 0) + 1; w.totals[kind] = b + 1; counted = true; newly = crossed(w, kind, b); noteActivity(kind); }
  store(db); return { kinds: Object.keys(w.kinds).sort(), counted, newly };
}
export async function claimExplore(tier: number): Promise<{ coins: number; reward: number; newly: string[] }> {
  if (tier !== 0 && tier !== 1) throw new Error('invalid_tier');
  const db = load(), w = worldOf(db), t = EXPLORE_TIERS[tier]; if (Object.keys(w.kinds).length < t.need) throw new Error('quest_not_done');
  if (w.explore.includes(String(tier))) throw new Error('already_claimed');
  const b = worldTotal(w, 'explore'); w.explore.push(String(tier)); if (tier === 0) w.exploreDays++;
  earn(db, t.reward, false); store(db); return { coins: db.coins, reward: t.reward, newly: tier === 0 ? crossed(w, 'explore', b) : [] };
}
export async function claimBadge(id: string): Promise<{ coins: number; reward: number }> {
  const b = BADGE_BY_ID[id]; if (!b) throw new Error('unknown_badge');
  const db = load(), w = worldOf(db); if (worldTotal(w, b.kind) < b.target) throw new Error('quest_not_done'); if (w.badges.includes(id)) throw new Error('already_claimed');
  w.badges.push(id); earn(db, b.reward, false); store(db); return { coins: db.coins, reward: b.reward };
}
export async function submitMinigame(kind: string, score: number): Promise<MiniResult> {
  if (!(MINI_KINDS as readonly string[]).includes(kind)) throw new Error('unknown_activity');
  const k = kind as MiniKind, cfg = MINI[k]; if (!Number.isInteger(score) || score < 0 || score > cfg.max) throw new Error('invalid_score');
  const db = load(); if (!db.pet) throw new Error('no_pet');
  const w = worldOf(db), m = (w.mini[k] ||= { plays: 0, best: 0, last: 0 });
  if (m.last && Date.now() - m.last < (devAds() ? 0 : 20000)) throw new Error('rate_limited');
  const rewarded = m.plays < MINI.plays, reward = rewarded ? miniReward(k, score) : 0;
  m.plays++; m.best = Math.max(m.best, score); m.last = Date.now(); w.kinds[k] = (w.kinds[k] || 0) + 1;
  if (reward) earn(db, reward, false);
  const add = miniTotalAdd(k, score), b = worldTotal(w, k); let newly: string[] = [];
  if (add) { w.totals[k] = b + add; newly = crossed(w, k, b); }
  store(db); noteActivity(k); const sk = miniSkill(k, score, rewarded);
  return { reward, rewarded, coins: db.coins, plays: m.plays, left: Math.max(0, MINI.plays - m.plays), best: m.best, newly, ...sk };
}

/* ---------- Mục tiêu cộng đồng (mô phỏng): người khác góp sẵn khoảng 40% mục tiêu ---------- */
const GOAL_OF: Record<string, GoalMetric> = { feed: 'feed', play_ball: 'play', play_spin: 'play', pet: 'pet', bath_rinse: 'bath', talk: 'talk' };
function goalAdd(db: DB, metric: GoalMetric) {
  for (const e of goalEvents(demoEvents())) { const g = (e.config as { goal?: { metric: GoalMetric } }).goal!; if (g.metric === metric) { const m = ((db.goals ||= {})[e.id] ||= { mine: 0, claimed: false }); m.mine++; } }
}
export async function getEventGoal(): Promise<EventGoal[]> {
  const db = load();
  return goalEvents(demoEvents()).map(e => { const g = (e.config as unknown as { goal: { metric: GoalMetric; target: number; reward_coins: number } }).goal, m = db.goals?.[e.id] || { mine: 0, claimed: false }, count = Math.min(g.target, Math.round(g.target * 0.4) + m.mine * 20);
    return { event_id: e.id, title: e.title, metric: g.metric, target: g.target, reward_coins: g.reward_coins, count, mine: m.mine, reached: count >= g.target, claimed: m.claimed, active: true, min_mine: 5 }; });
}
export async function claimEventGoal(id: number): Promise<{ coins: number; reward: number }> {
  const db = load(), g = (await getEventGoal()).find(x => x.event_id === id); if (!g) throw new Error('goal_not_found');
  if (!g.reached) throw new Error('goal_not_reached'); if (g.mine < g.min_mine) throw new Error('goal_not_contributed'); if (g.claimed) throw new Error('already_claimed');
  (db.goals ||= {})[id].claimed = true; earn(db, g.reward_coins, false); store(db); return { coins: db.coins, reward: g.reward_coins };
}

/* ---------- Cách ly (Mùa cúm) ---------- */
export async function getIsolation(): Promise<{ isolating: boolean }> { const db = load(); return { isolating: !!db.isolating && !!db.pet?.illness }; }
export async function setIsolation(on: boolean): Promise<{ isolating: boolean }> {
  const db = load(); if (!db.pet) throw new Error('no_pet'); if (on && !db.pet.illness) throw new Error('not_sick');
  db.isolating = on; store(db); return { isolating: on };
}
const demoBoost = () => eventBoost(demoEvents());

/* ---------- Quảng cáo thưởng (mô phỏng start_ad_reward / claim_ad_reward). Thêm ?dev để rút ngắn thời gian xem còn 2 giây ---------- */
const devAds = () => { try { return new URLSearchParams(location.search).has('dev'); } catch { return false; } };
const adMin = () => (devAds() ? 2 : AD.minWatchSeconds), adGap = () => (devAds() ? 0 : AD.gapMinutes * 60000);
const adToday = (db: DB) => { const d = localDay(); if (!db.ads || db.ads.day !== d) db.ads = { day: d, count: 0, last: 0 }; return db.ads; };
export async function getAdState(): Promise<AdState> {
  const db = load(), a = adToday(db);
  return { enabled: true, left: AD.perDay - a.count, next_in: Math.max(0, Math.ceil((a.last + adGap() - Date.now()) / 1000)), reward: AD.reward, per_day: AD.perDay };
}
export async function startAdReward(): Promise<AdTicket> {
  const db = load(), a = adToday(db);
  if (a.count >= AD.perDay) throw new Error('ad_limit');
  if (a.last && Date.now() - a.last < adGap()) throw new Error('ad_too_soon');
  a.nonce = crypto.randomUUID(); a.at = Date.now(); store(db);
  return { nonce: a.nonce, reward: AD.reward, left: AD.perDay - a.count, wait: adMin() };
}
export async function claimAdReward(nonce: string) {
  const db = load(), a = adToday(db);
  if (!a.nonce || a.nonce !== nonce) throw new Error('ad_invalid');
  const age = (Date.now() - (a.at ?? 0)) / 1000;
  if (age < adMin()) throw new Error('ad_too_fast');
  if (age > AD.nonceMinutes * 60) throw new Error('ad_expired');
  if (a.count >= AD.perDay) throw new Error('ad_limit');
  a.nonce = undefined; a.count += 1; a.last = Date.now(); earn(db, AD.reward, false); store(db);
  return { coins: db.coins, reward: AD.reward, left: AD.perDay - a.count };
}
