/**
 * Chế độ Chơi thử: chạy không cần Supabase, dữ liệu lưu trong trình duyệt.
 * Mô phỏng đúng luật của các RPC trong supabase/migrations (để xem trước, không dùng cho bản chính thức).
 */
import { clamp, decayStats, localDay } from '../game/rules';
import { BY_ID, CROPS, readyAtMs, WATER, DEFAULT_LAYOUT, EDIBLES, FOOD_BY_ID, FOOD_STOCK, FOODS, FRIDGE, GARDEN_LAND, GARDEN_PLOTS, PARCEL, ITEMS, RECIPES, spoilLoss, STARTER_ITEMS, type Layout } from '../game/catalog';
import { BALANCED_BONUS, isBalanced } from '../game/nutrition';
import { buyable, COIN, comfortLevel, comfortScore, dayNumber, QUEST_BONUS, QUEST_POOL, questsForDay, rotationForDay, isWeekend, weekStart, WEEKLY_POOL, weeklyForDay } from '../game/layout';
import type { ActionResult, CureResult, DayLogRow, Economy, FarmItem, Garden, MemoryRow, Outfit, PetAction, PetRow, QuestBoard, QuestRow, SeenRow, Tastes } from './types';
import { applyDrift, isBlank, normalize, rollPersonality } from '../game/personality';
import { blendPersonality, HEIR_FAV_INHERIT, pickHeirSpecies } from '../game/lineage';
import { BOND, bondLevel } from '../game/bond';
import { clinicPrice, healthStep, HEALTH, ILLNESS_BY_ID, isNightHour, isSevere, MEDICINE_BY_ID, type HealthCtx } from '../game/health';
import { formFromCare, pickSpecies, SPECIES_BY_ID, stageForAge, REGIONS, GROW_MEMORY } from '../game/species';

const KEY = 'hatchday-demo';
interface DB {
  pet: PetRow | null; mem: MemoryRow[]; days: Record<string, DayLogRow>; fav: string; dis: string; firsts: string[]; nextId: number;
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
    plays1h: plays.filter(t => now - t < 3600000).length, nightPlays2h: plays.filter(t => isNightHour(new Date(t).getHours())).length,
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
export async function buyItem(id: string): Promise<{ coins: number; qty: number }> {
  const db = load(), it = BY_ID[id];
  if (!it || it.kind === 'food') throw new Error('unknown_item');
  if (!buyable(it, localDay())) throw new Error('not_for_sale');
  if ((it.kind === 'outfit' || it.layer === 'wallpaper' || it.layer === 'flooring') && db.owned[id]) throw new Error('already_owned');
  if (db.coins < (it.price || 0)) throw new Error('not_enough_coins');
  db.coins -= it.price || 0; db.owned[id] = (db.owned[id] || 0) + 1; store(db);
  return { coins: db.coins, qty: db.owned[id] };
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
  db.quests.push(k); earn(db, q.reward, false); store(db); return { coins: db.coins, reward: q.reward };
}
export async function claimQuestBonus() {
  const b = await getQuests(); if (!b.bonus.ready) throw new Error('quest_not_done');
  const db = load(), k = localDay() + ':5'; if (db.quests.includes(k)) throw new Error('already_claimed');
  db.quests.push(k); earn(db, QUEST_BONUS, false); store(db); return { coins: db.coins, reward: QUEST_BONUS };
}
export async function claimWeeklyQuest(i: number) {
  const b = await getQuests(), q = b.weekly[i]; if (!(i >= 0 && i <= 2) || !q) throw new Error('invalid_quest');
  if (q.progress < q.target) throw new Error('quest_not_done');
  const db = load(), k = b.week + ':' + i; if (db.weekly?.includes(k)) throw new Error('already_claimed');
  (db.weekly ||= []).push(k); earn(db, q.reward, false); store(db); return { coins: db.coins, reward: q.reward };
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
  if (db.coins < f.price * qty) throw new Error('not_enough_coins');
  db.coins -= f.price * qty; db.owned[id] = (db.owned[id] || 0) + qty; store(db);
  return { coins: db.coins, qty: db.owned[id] };
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
  if (db.coins < m.price * qty) throw new Error('not_enough_coins');
  db.coins -= m.price * qty; db.owned[id] = cur + qty; store(db); return { coins: db.coins, qty: db.owned[id] };
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
