/**
 * Chế độ Chơi thử: chạy không cần Supabase, dữ liệu lưu trong trình duyệt.
 * Mô phỏng đúng luật của các RPC trong supabase/migrations (để xem trước, không dùng cho bản chính thức).
 */
import { clamp, decayStats, localDay } from '../game/rules';
import { BY_ID, DEFAULT_LAYOUT, ITEMS, STARTER_ITEMS, type Layout } from '../game/catalog';
import { buyable, COIN, comfortLevel, comfortScore, QUEST_POOL, QUEST_REWARD, questsForDay, rotationForDay, isWeekend } from '../game/layout';
import type { ActionResult, DayLogRow, Economy, MemoryRow, Outfit, PetAction, PetRow, QuestRow, SeenRow } from './types';
import { formFromCare, pickSpecies, stageForAge, REGIONS, GROW_MEMORY } from '../game/species';

const KEY = 'hatchday-demo';
const FOOD: Record<string, { name: string; no: number; vui: number }> = {
  carot: { name: 'Cà rốt', no: 10, vui: 2 }, comnam: { name: 'Cơm nắm', no: 25, vui: 3 },
  kem: { name: 'Kem que', no: 5, vui: 15 }, che: { name: 'Chè đậu', no: 15, vui: 12 },
};
interface DB {
  pet: PetRow | null; mem: MemoryRow[]; days: Record<string, DayLogRow>; fav: string; dis: string; firsts: string[]; nextId: number;
  coins: number; earnedDay: string; earnedToday: number; owned: Record<string, number>; layouts: (Layout | null)[]; active: number;
  quests: string[]; collections: string[]; life?: number; seen?: SeenRow[];
}

function load(): DB {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null') as DB | null;
    if (d) {
      // bản lưu cũ (trước khi có loài): gán loài, tuổi thọ
      if (d.pet && !d.pet.species) { const sp = pickSpecies(0, Math.random()); d.pet.species = sp.id; d.pet.form = null; d.pet.genes = { ...d.pet.genes, region: 0, hue: 0 }; }
      if (d.pet && !d.life) d.life = 30 + Math.floor(Math.random() * 31);
      d.seen ||= d.pet ? [{ species_id: d.pet.species, first_at: d.pet.born_at, forms: [] }] : [];
      return d;
    }
  } catch { /* bỏ qua */ }
  return fresh();
}
/** Lớn lên theo tuổi (cùng luật với private.grow_pet). */
function grow(db: DB) {
  const p = db.pet; if (!p) return;
  const days = (Date.now() - Date.parse(p.born_at)) / 86400000;
  const st = stageForAge(days, db.life || 45);
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
  owned: {}, layouts: [null, null, null], active: 0, quests: [], collections: [] });
function earn(db: DB, n: number, capped: boolean): number {
  const d = localDay(); if (db.earnedDay !== d) { db.earnedDay = d; db.earnedToday = 0; }
  const got = capped ? Math.max(0, Math.min(n, COIN.careDailyCap - db.earnedToday)) : n;
  db.coins += got; if (capped) db.earnedToday += got; return got;
}
function store(db: DB) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* bỏ qua */ } }
function decay(db: DB) {
  if (!db.pet) return;
  const mins = (Date.now() - Date.parse(db.pet.stats_at)) / 60000;
  Object.assign(db.pet, decayStats(db.pet, mins, db.pet.comfort_level ?? 1), { stats_at: new Date().toISOString() });
}
function day(db: DB): DayLogRow {
  const d = localDay();
  return (db.days[d] ||= { day: d, fed: 0, foods: [], bath: 0, ball: 0, pet: 0, talk: 0, sleep: 0 });
}
function first(db: DB, key: string, kind: string, body: string): boolean {
  if (db.firsts.includes(key)) return false;
  db.firsts.push(key); db.mem.unshift({ id: db.nextId++, kind, body, created_at: new Date().toISOString() });
  return true;
}

export async function getMyPet(): Promise<PetRow | null> { const db = load(); decay(db); grow(db); store(db); return db.pet; }
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
  const ids = Object.keys(FOOD).sort(() => Math.random() - 0.5);
  const now = new Date().toISOString();
  if (!(egg >= 0 && egg < REGIONS.length)) throw new Error('invalid_egg');
  const sp = pickSpecies(egg, Math.random());
  db.pet = { id: 'demo', owner_id: 'demo', name, family_name: family, generation: 1, stage: 'baby', species: sp.id, form: null,
    genes: { region: egg, ear: Math.floor(Math.random() * 4), scale: Math.round((0.96 + Math.random() * 0.08) * 1000) / 1000, hue: Math.round((Math.random() * 2 - 1) * 100) / 100 },
    personality: {}, no: 72, vui: 74, nl: 82, sach: 85, asleep: false, stats_at: now, bond_xp: 0, born_at: now };
  db.fav = ids[0]; db.dis = ids[1]; db.life = 30 + Math.floor(Math.random() * 31);
  db.seen ||= []; if (!db.seen.some(x => x.species_id === sp.id)) db.seen.push({ species_id: sp.id, first_at: now, forms: [] });
  const tags = ['mem', 'sach', 'cay', 'choi', 'sang', 'retro'].sort(() => Math.random() - 0.5);
  db.pet.genes.likes = [tags[0], tags[1]]; db.pet.genes.dislike = tags[2];
  db.pet.outfit = {}; db.pet.outfit_presets = [{}, {}, {}];
  for (const id of [...STARTER_ITEMS, ...Object.keys(FOOD)]) db.owned[id] = Math.max(db.owned[id] || 0, 1);
  db.layouts[0] = structuredClone(DEFAULT_LAYOUT); db.active = 0;
  db.pet.comfort_level = comfortLevel(comfortScore(DEFAULT_LAYOUT));
  first(db, 'meet', 'meet', `Ngày đầu tiên gặp bạn. Mình là một bé ${sp.name}, bạn đặt tên mình là ${name}.`);
  store(db);
  return db.pet;
}

export async function renamePet(name: string) { const db = load(); if (db.pet) db.pet.name = name; store(db); }

export async function petAction(action: PetAction, item?: string, count = 1): Promise<ActionResult> {
  const db = load(); if (!db.pet) throw new Error('no_pet');
  decay(db);
  const p = db.pet, d = day(db), n = Math.max(1, Math.min(count, 20));
  let refused: ActionResult['refused'] = null, fav = false, newMem = false;
  if (p.asleep && action !== 'wake' && action !== 'pet') refused = 'asleep';
  else if (action === 'feed') {
    const f = FOOD[item || '']; if (!f) throw new Error('unknown_item');
    if (p.no >= 90) refused = 'full';
    else {
      fav = item === db.fav;
      p.no = clamp(p.no + f.no); p.vui = clamp(p.vui + f.vui + (fav ? 10 : 0) - (item === db.dis ? 6 : 0)); p.sach = clamp(p.sach - 2);
      d.fed++; d.foods.push(f.name);
      newMem = first(db, 'food-' + item, 'food', fav ? `Lần đầu ăn ${f.name}, hoá ra là món tủ của mình!` : `Lần đầu được ăn ${f.name}.`);
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
  const earned = !refused && ['feed', 'bath_rinse', 'play_ball', 'play_spin', 'talk', 'sleep'].includes(action) ? earn(db, COIN.careReward, true) : 0;
  store(db);
  return { pet: { ...p }, refused, fav, new_memory: newMem, earned, coins: db.coins };
}

export async function addTalkMemory(text: string) {
  const db = load(); const t = text.trim().slice(0, 120); if (t.length < 4) return;
  db.mem.unshift({ id: db.nextId++, kind: 'talk', body: `Bạn kể: “${t}”`, created_at: new Date().toISOString() }); store(db);
}
export async function listMemories(): Promise<MemoryRow[]> { return load().mem.slice(0, 60); }
export async function deleteMemory(id: number) { const db = load(); db.mem = db.mem.filter(m => m.id !== id); store(db); }
export async function listDayLogs(): Promise<DayLogRow[]> { return Object.values(load().days).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30); }
export function resetDemo() { try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ } }

/* ---------- Trang trí, trang phục, xu, nhiệm vụ (mô phỏng RPC) ---------- */
export async function getEconomy(): Promise<Economy> {
  const db = load(), d = localDay();
  return { coins: db.coins, earned_today: db.earnedDay === d ? db.earnedToday : 0, day: d, rotation: rotationForDay(d), weekend: isWeekend(d) };
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
export async function getQuests(): Promise<QuestRow[]> {
  const db = load(), d = localDay(), log = db.days[d];
  return questsForDay(d).map((q, i) => ({ idx: i, quest: q, target: QUEST_POOL[q].target,
    progress: log ? Number((log as unknown as Record<string, number>)[QUEST_POOL[q].key]) || 0 : 0, claimed: db.quests.includes(d + ':' + i) }));
}
export async function claimQuest(i: number) {
  const q = (await getQuests())[i]; if (!q) throw new Error('invalid_quest');
  if (q.progress < q.target) throw new Error('quest_not_done');
  const db = load(), k = localDay() + ':' + i; if (db.quests.includes(k)) throw new Error('already_claimed');
  db.quests.push(k); earn(db, QUEST_REWARD, false); store(db); return { coins: db.coins };
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
