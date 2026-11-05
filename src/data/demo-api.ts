/**
 * Chế độ Chơi thử: chạy không cần Supabase, dữ liệu lưu trong trình duyệt.
 * Mô phỏng đúng luật của các RPC trong supabase/migrations (để xem trước, không dùng cho bản chính thức).
 */
import { clamp, decayStats, localDay } from '../game/rules';
import type { ActionResult, DayLogRow, MemoryRow, PetAction, PetRow } from './types';

const KEY = 'hatchday-demo';
const FOOD: Record<string, { name: string; no: number; vui: number }> = {
  carot: { name: 'Cà rốt', no: 10, vui: 2 }, comnam: { name: 'Cơm nắm', no: 25, vui: 3 },
  kem: { name: 'Kem que', no: 5, vui: 15 }, che: { name: 'Chè đậu', no: 15, vui: 12 },
};
interface DB { pet: PetRow | null; mem: MemoryRow[]; days: Record<string, DayLogRow>; fav: string; dis: string; firsts: string[]; nextId: number }

function load(): DB {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d) return d as DB; } catch { /* bỏ qua */ }
  return { pet: null, mem: [], days: {}, fav: '', dis: '', firsts: [], nextId: 1 };
}
function store(db: DB) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* bỏ qua */ } }
function decay(db: DB) {
  if (!db.pet) return;
  const mins = (Date.now() - Date.parse(db.pet.stats_at)) / 60000;
  Object.assign(db.pet, decayStats(db.pet, mins), { stats_at: new Date().toISOString() });
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

export async function getMyPet(): Promise<PetRow | null> { const db = load(); decay(db); store(db); return db.pet; }

export async function createPet(name: string, family: string, egg: number): Promise<PetRow> {
  const db = load();
  if (db.pet) throw new Error('pet_exists');
  const ids = Object.keys(FOOD).sort(() => Math.random() - 0.5);
  const now = new Date().toISOString();
  db.pet = { id: 'demo', owner_id: 'demo', name, family_name: family, generation: 1, stage: 'baby',
    genes: { palette: egg, ear: Math.floor(Math.random() * 4), sprout: Math.floor(Math.random() * 3), scale: 1 },
    personality: {}, no: 72, vui: 74, nl: 82, sach: 85, asleep: false, stats_at: now, bond_xp: 0, born_at: now };
  db.fav = ids[0]; db.dis = ids[1];
  first(db, 'meet', 'meet', `Ngày đầu tiên gặp bạn. Bạn đặt tên mình là ${name}.`);
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
  store(db);
  return { pet: { ...p }, refused, fav, new_memory: newMem };
}

export async function addTalkMemory(text: string) {
  const db = load(); const t = text.trim().slice(0, 120); if (t.length < 4) return;
  db.mem.unshift({ id: db.nextId++, kind: 'talk', body: `Bạn kể: “${t}”`, created_at: new Date().toISOString() }); store(db);
}
export async function listMemories(): Promise<MemoryRow[]> { return load().mem.slice(0, 60); }
export async function deleteMemory(id: number) { const db = load(); db.mem = db.mem.filter(m => m.id !== id); store(db); }
export async function listDayLogs(): Promise<DayLogRow[]> { return Object.values(load().days).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30); }
export function resetDemo() { try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ } }
