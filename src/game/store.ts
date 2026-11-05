/**
 * Trạng thái thú phía client. Server là nguồn sự thật:
 * - hydrate() tải thú, ký ức, nhật ký ngày.
 * - act() gửi hành động, client đã áp dụng lạc quan trước đó, kết quả server ghi đè chỉ số.
 * - Vuốt ve và kỳ cọ được gộp theo lô 2 giây để không gửi quá nhiều yêu cầu.
 */
import * as api from '../data/api';
import type { ActionResult, FarmItem, Garden, Outfit, PetAction, PetRow, QuestBoard, QuestRow, SeenRow, Tastes } from '../data/types';
import type { CareSums, Form, Stage } from './species';
import { emptyDay, localDay, writeDiary, type DayLog } from './rules';
import { DEFAULT_LAYOUT, type Layout } from './catalog';
import { comfortLevel, comfortScore } from './layout';
import { bondLevel } from './bond';
import { normalize, topTraits, type Personality } from './personality';
import { recentGroups, type DayGroups } from './nutrition';
import type { FoodGroup } from './catalog';

export interface Memory { id?: number; t: number; type: string; text: string }

export interface PetState {
  id: string; name: string; family: string; palette: number;
  species: string; stage: Stage; form: Form | null; genes: PetRow['genes'] | null; bornAt: number; generation: number; seen: SeenRow[]; care: CareSums;
  no: number; vui: number; nl: number; sach: number; asleep: boolean; t: number;
  favFound: boolean; mem: Memory[]; day: DayLog | null; diary: Record<string, string>; firsts: Record<string, number>;
  coins: number; earnedToday: number; rotation: string[]; weekend: boolean;
  owned: Record<string, number>; layouts: (Layout | null)[]; activeLayout: number; comfort: number;
  outfit: Outfit; presets: Outfit[]; likes: string[]; dislike: string; quests: QuestRow[]; collections: string[];
  personality: Personality;
  weekly: QuestRow[]; questBonus: QuestBoard['bonus']; rationDay: string; groupLog: DayGroups[];
  /** Gia phả: mọi bé từ đời 1 tới nay, cũ trước. */
  lineage: PetRow[];
  /** Tủ lạnh (cấp 0–2), vườn rau, khẩu vị bé đã lộ ra. */
  fridge: number; garden: Garden | null; tastes: Tastes;
  /** Đồ trang trí nông trại đã đặt. */
  farm: FarmItem[];
  /** Sức khoẻ: bệnh đang mắc (null = khoẻ) và các mốc thời gian (ISO) kèm theo. */
  illness: string | null; sickSince: string | null; criticalSince: string | null; recoverAt: string | null;
  /** Gắn bó: điểm hiện tại và các cấp đã nhận quà. */
  bondXp: number; bondClaims: number[];
  /** Xu đã bán nông sản hôm nay ở Chợ (trần mỗi ngày). */
  soldToday: number;
}

export const S: PetState = {
  id: '', name: 'Bé', family: '', palette: 0, species: 'mam-xanh', stage: 'baby', form: null, genes: null, bornAt: Date.now(), generation: 1, seen: [], care: { fed: 0, ball: 0, pet: 0, talk: 0, bath: 0 }, no: 70, vui: 70, nl: 80, sach: 80, asleep: false, t: Date.now(),
  favFound: false, mem: [], day: null, diary: {}, firsts: {},
  coins: 0, earnedToday: 0, rotation: [], weekend: false, owned: {}, layouts: [null, null, null], activeLayout: 0, comfort: 1,
  outfit: {}, presets: [{}, {}, {}], likes: [], dislike: '', quests: [], collections: [],
  personality: normalize(null),
  weekly: [], questBonus: { reward: 0, ready: false, claimed: false }, rationDay: '', groupLog: [], lineage: [],
  fridge: 0, garden: null, tastes: { fav: null, dis: null, tried: 0, total: 0 }, farm: [],
  illness: null, sickSince: null, criticalSince: null, recoverAt: null,
  bondXp: 0, bondClaims: [], soldToday: 0,
};
/** Bố cục đang dùng (luôn có giá trị). */
export const activeLayout = (): Layout => S.layouts[S.activeLayout] || S.layouts[0] || DEFAULT_LAYOUT;

type Listener = () => void;
const listeners = new Set<Listener>();
export const onSync = (fn: Listener) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach(fn => fn());
const errListeners = new Set<(e: unknown) => void>();
/** Báo cho giao diện khi không lưu được lên server (để hiện thông báo nhẹ). */
export const onSyncError = (fn: (e: unknown) => void) => { errListeners.add(fn); return () => errListeners.delete(fn); };

const departListeners = new Set<(p: PetRow) => void>();
/** Báo khi bé hết tuổi thọ và ra đi (server trả về bé đó đúng một lần). */
export const onDepart = (fn: (p: PetRow) => void) => { departListeners.add(fn); return () => departListeners.delete(fn); };

function applyRow(p: PetRow) {
  if (p.stage === 'departed') { departListeners.forEach(fn => fn(p)); return; }
  const prevPid = S.id;
  S.id = p.id; S.name = p.name; S.family = p.family_name; S.palette = p.genes?.palette ?? 0;
  S.no = p.no; S.vui = p.vui; S.nl = p.nl; S.sach = p.sach; S.asleep = p.asleep; S.t = Date.now();
  if (p.outfit) S.outfit = p.outfit;
  if (p.outfit_presets) S.presets = p.outfit_presets;
  if (p.comfort_level) S.comfort = p.comfort_level;
  S.likes = p.genes?.likes || ['mem', 'cay']; S.dislike = p.genes?.dislike || 'retro';
  S.personality = normalize(p.personality);
  const prevBond = S.bondXp; S.bondXp = p.bond_xp ?? 0;
  if (hydrated && prevPid === p.id && bondLevel(S.bondXp) > bondLevel(prevBond)) bondListeners.forEach(fn => fn(bondLevel(S.bondXp)));
  const prevIllness = S.illness;
  S.illness = p.illness ?? null; S.sickSince = p.sick_since ?? null; S.criticalSince = p.critical_since ?? null; S.recoverAt = p.recover_at ?? null;
  if (hydrated && prevPid === p.id && prevIllness !== S.illness) illnessListeners.forEach(fn => fn(S.illness, prevIllness));
  const trait = topTraits(S.personality, 1)[0];
  // Chỉ báo khi nét mới vượt nét đã báo ít nhất 3 điểm, để hai trục sát nhau không báo qua báo lại.
  if (!hydrated || prevPid !== p.id) shownTrait = trait ?? null;
  else if (trait && trait.name !== shownTrait?.name && Math.abs(trait.v) >= Math.abs(shownTrait ? S.personality[shownTrait.axis] : 0) + 3) {
    shownTrait = trait; traitListeners.forEach(fn => fn(trait.name));
  }
  const prev = { stage: S.stage, form: S.form, id: S.id };
  S.species = p.species || 'mam-xanh'; S.form = p.form ?? null; S.genes = p.genes; S.generation = p.generation || 1;
  S.stage = (['baby', 'child', 'teen', 'adult', 'elder'].includes(p.stage) ? p.stage : 'baby') as Stage;
  S.bornAt = Date.parse(p.born_at) || Date.now();
  if (hydrated && prev.id === S.id && (prev.stage !== S.stage || prev.form !== S.form)) {
    growListeners.forEach(fn => fn(prev.stage, S.stage)); refreshSeen().catch(() => {}); scheduleMemRefresh();
  }
}
let hydrated = false;
const bondListeners = new Set<(level: number) => void>();
/** Báo khi gắn bó lên cấp mới. */
export const onBondLevel = (fn: (level: number) => void) => { bondListeners.add(fn); return () => bondListeners.delete(fn); };
const illnessListeners = new Set<(now: string | null, was: string | null) => void>();
/** Báo khi bé mắc bệnh (now = mã bệnh) hoặc khỏi bệnh (now = null). */
export const onIllness = (fn: (now: string | null, was: string | null) => void) => { illnessListeners.add(fn); return () => illnessListeners.delete(fn); };
let shownTrait: ReturnType<typeof topTraits>[number] | null = null;
const traitListeners = new Set<(name: string) => void>();
/** Báo khi nét cá tính nổi bật nhất của thú đổi sang nét khác (do cách chăm). */
export const onTraitShift = (fn: (name: string) => void) => { traitListeners.add(fn); return () => traitListeners.delete(fn); };
const growListeners = new Set<(from: Stage, to: Stage) => void>();
/** Báo khi thú lớn sang giai đoạn mới (để chạy cảnh tiến hoá). */
export const onGrow = (fn: (from: Stage, to: Stage) => void) => { growListeners.add(fn); return () => growListeners.delete(fn); };
const spoilListeners = new Set<(lost: Record<string, number>) => void>();
let pendingSpoil: Record<string, number> | null = null;
/** Báo khi có thức ăn tươi bị hỏng (kể cả lần hỏng xảy ra trước khi giao diện sẵn sàng). */
export const onSpoil = (fn: (lost: Record<string, number>) => void) => { spoilListeners.add(fn); if (pendingSpoil) { const p = pendingSpoil; pendingSpoil = null; fn(p); } return () => spoilListeners.delete(fn); };
export async function refreshFarm(): Promise<void> { S.farm = await api.getFarm(); emit(); }
/** Lưu bố cục nông trại. Trả về lỗi nếu thất bại, null nếu thành công. */
export async function saveFarm(items: FarmItem[]): Promise<unknown> {
  try { await api.saveFarm(items); S.farm = structuredClone(items); emit(); return null; } catch (e) { return e; }
}
export async function refreshTastes(): Promise<void> { S.tastes = await api.getTastes(); emit(); }
let gardenSkew = 0;
/** Giờ server (để đếm ngược vườn rau không phụ thuộc đồng hồ máy). */
export const serverNow = () => Date.now() + gardenSkew;
export async function refreshGarden(): Promise<void> { const g = await api.getGarden(); gardenSkew = Date.parse(g.now) - Date.now(); S.garden = g; emit(); }
export async function refreshSeen(): Promise<void> { S.seen = await api.listSpeciesSeen(); emit(); }
export async function refreshFamily(): Promise<void> { S.lineage = await api.listFamily(); emit(); }
/** Ký ức của một bé trong gia phả (để xem trang tưởng niệm). */
export const familyMemories = (petId: string) => api.listMemories(petId);
/** Chỉ có ở chế độ Chơi thử: tua nhanh tuổi của thú để xem tiến hoá. */
export async function demoAge(days: number): Promise<void> { const p = await api.demoAge(days); if (p) { applyRow(p); emit(); } }

export async function hydrate(): Promise<void> {
  const p = await api.getMyPet();
  if (!p) throw new Error('no_pet');
  applyRow(p);
  if (p.stage !== 'departed') { const h = await api.getHealth(); if (h) applyRow(h); }
  await Promise.all([refreshMemories(), refreshDays(), refreshEconomy(), refreshOwned(), refreshLayouts(), refreshQuests(), refreshSeen(), refreshFamily(), refreshTastes(), refreshGarden(), refreshFarm(), refreshBond()]);
  hydrated = true;
}

export async function refreshEconomy(): Promise<void> {
  const e = await api.getEconomy();
  S.coins = e.coins; S.earnedToday = e.earned_today; S.rotation = e.rotation; S.weekend = e.weekend; S.rationDay = e.ration_claimed ? e.day : ''; S.fridge = e.fridge_level || 0;
  if (e.spoiled && Object.keys(e.spoiled).length) { if (spoilListeners.size) spoilListeners.forEach(fn => fn(e.spoiled)); else pendingSpoil = e.spoiled; }
  emit();
}
export async function refreshOwned(): Promise<void> {
  S.owned = await api.listOwned();
  S.collections = await api.listCollectionClaims(); emit();
}
export async function refreshLayouts(): Promise<void> {
  const r = await api.getLayouts(); S.layouts = r.layouts; S.activeLayout = r.active; emit();
}
export async function refreshQuests(): Promise<void> { const b = await api.getQuests(); S.quests = b.quests; S.weekly = b.weekly; S.questBonus = b.bonus; emit(); }

/** Mua một món bằng xu. Trả về thông báo lỗi tiếng Việt nếu thất bại (null = thành công). */
export async function buy(id: string): Promise<unknown> {
  try { const r = await api.buyItem(id); S.coins = r.coins; S.owned = { ...S.owned, [id]: r.qty }; emit(); return null; }
  catch (e) { return e; }
}
/** Lưu bố cục vào ô `slot` và dùng nó. */
export async function saveLayout(slot: number, layout: Layout): Promise<unknown> {
  try {
    const r = await api.saveLayout(slot, layout, true);
    S.layouts = S.layouts.map((l, i) => (i === slot ? structuredClone(layout) : l)); S.activeLayout = slot; S.comfort = r.comfort_level; emit(); return null;
  } catch (e) { return e; }
}
/** Mặc đồ: áp dụng ngay trên máy, lưu lên server. */
export async function equip(o: Outfit): Promise<unknown> {
  S.outfit = Object.fromEntries(Object.entries(o).filter(([, v]) => v)); emit();
  try { await api.equipOutfit(S.outfit); return null; } catch (e) { errListeners.forEach(fn => fn(e)); return e; }
}
export async function savePreset(i: number): Promise<void> {
  S.presets = S.presets.map((p, k) => (k === i ? { ...S.outfit } : p)); emit();
  try { await api.saveOutfitPreset(i, S.outfit); } catch (e) { errListeners.forEach(fn => fn(e)); }
}
/** Nhận thưởng nhiệm vụ ngày. Trả về { reward } nếu được, hoặc lỗi. */
export async function claimQuest(i: number): Promise<{ reward: number } | { error: unknown }> {
  try { const r = await api.claimQuest(i); S.coins = r.coins; await refreshQuests(); return { reward: r.reward }; } catch (error) { return { error }; }
}
export async function claimQuestBonus(): Promise<{ reward: number } | { error: unknown }> {
  try { const r = await api.claimQuestBonus(); S.coins = r.coins; await refreshQuests(); return { reward: r.reward }; } catch (error) { return { error }; }
}
export async function claimWeeklyQuest(i: number): Promise<{ reward: number } | { error: unknown }> {
  try { const r = await api.claimWeeklyQuest(i); S.coins = r.coins; await refreshQuests(); return { reward: r.reward }; } catch (error) { return { error }; }
}

/** Mua thức ăn (qty phần). Trả về lỗi nếu thất bại, null nếu thành công. */
export async function buyFood(id: string, qty: number): Promise<unknown> {
  try { const r = await api.buyFood(id, qty); S.coins = r.coins; S.owned = { ...S.owned, [id]: r.qty }; emit(); return null; } catch (e) { return e; }
}
export async function refreshBond(): Promise<void> { S.bondClaims = await api.getBondClaims(); emit(); }
/** Nhận quà gắn bó của một cấp. */
export async function claimBond(level: number): Promise<{ reward: number } | { error: unknown }> {
  try { const r = await api.claimBond(level); S.coins = r.coins; S.bondClaims = [...S.bondClaims, level]; scheduleMemRefresh(); emit(); return { reward: r.reward }; } catch (error) { return { error }; }
}
/** Bán thức ăn thừa ở Chợ. Trả về { got } hoặc lỗi. */
export async function sellFood(id: string, qty: number): Promise<{ got: number } | { error: unknown }> {
  try { const r = await api.sellFood(id, qty); S.coins = r.coins; S.owned = { ...S.owned, [id]: r.qty }; S.soldToday = r.today; emit(); return { got: r.got }; } catch (error) { return { error }; }
}
export async function refreshSell(): Promise<void> { S.soldToday = (await api.getSellState()).today; emit(); }
/** Đồng bộ sức khoẻ ngay (xét bệnh bỏ bê và hồi phục). */
export async function refreshHealth(): Promise<void> { const h = await api.getHealth(); if (h && h.stage !== 'departed') { applyRow(h); emit(); } }
/** Mua thuốc (qty liều). Trả về lỗi nếu thất bại, null nếu thành công. */
export async function buyMedicine(id: string, qty: number): Promise<unknown> {
  try { const r = await api.buyMedicine(id, qty); S.coins = r.coins; S.owned = { ...S.owned, [id]: r.qty }; emit(); return null; } catch (e) { return e; }
}
/** Cho bé uống thuốc. */
export async function useMedicine(id: string): Promise<unknown> {
  try { const r = await api.useMedicine(id); S.owned = { ...S.owned, [id]: r.qty ?? 0 }; applyRow(r.pet); scheduleMemRefresh(); emit(); return null; } catch (e) { return e; }
}
/** Đưa bé ra phòng khám. */
export async function visitClinic(): Promise<unknown> {
  try { const r = await api.visitClinic(); if (typeof r.coins === 'number') S.coins = r.coins; applyRow(r.pet); scheduleMemRefresh(); emit(); return null; } catch (e) { return e; }
}
/** Mua tủ lạnh lớn hơn. */
export async function upgradeFridge(): Promise<unknown> {
  try { const r = await api.upgradeFridge(); S.coins = r.coins; S.fridge = r.fridge_level; emit(); return null; } catch (e) { return e; }
}
export async function plantCrop(plot: number, crop: string): Promise<unknown> {
  try { const r = await api.plantCrop(plot, crop); S.coins = r.coins; await refreshGarden(); return null; } catch (e) { return e; }
}
/** Nâng cấp một mảnh đất (thêm 3 ô). */
export async function upgradeParcel(parcel: number): Promise<unknown> {
  try { const r = await api.upgradeParcel(parcel); S.coins = r.coins; await refreshGarden(); return null; } catch (e) { return e; }
}
/** Mua thêm một mảnh đất mới (khi mảnh cuối đã đủ 9 ô). Trả về số thứ tự mảnh mới hoặc lỗi. */
export async function buyParcel(): Promise<{ parcel: number } | { error: unknown }> {
  try { const r = await api.buyParcel(); S.coins = r.coins; await refreshGarden(); return { parcel: r.parcel }; } catch (error) { return { error }; }
}
export async function waterCrop(plot: number): Promise<unknown> {
  try { await api.waterCrop(plot); await refreshGarden(); return null; } catch (e) { return e; }
}
export async function harvestCrop(plot: number): Promise<{ item: string; got: number } | { error: unknown }> {
  try { const r = await api.harvestCrop(plot); S.owned = { ...S.owned, [r.item]: r.qty }; await refreshGarden(); return r; } catch (error) { return { error }; }
}
export async function cook(recipe: string, qty = 1): Promise<{ dish: string; qty: number } | { error: unknown }> {
  try { const r = await api.cook(recipe, qty); await refreshOwned(); return r; } catch (error) { return { error }; }
}
/** Nhận suất ăn miễn phí của ngày. */
export async function claimRation(): Promise<unknown> {
  try { const r = await api.claimRation(); S.owned = { ...S.owned, [r.item]: r.qty }; S.rationDay = localDay(); emit(); return null; } catch (e) { return e; }
}
/** Các nhóm lành mạnh bé đã ăn trong 3 ngày gần nhất (tính cả bữa vừa cho ăn trên máy). */
export function nutritionNow(): FoodGroup[] {
  const today = localDay();
  return recentGroups([...S.groupLog.filter(l => l.d !== today), { d: today, groups: S.day?.groups || [] }], today);
}
export async function claimCollection(t: string): Promise<unknown> {
  try { const r = await api.claimCollection(t); S.coins = r.coins; S.collections = [...S.collections, t]; scheduleMemRefresh(); emit(); return null; } catch (e) { return e; }
}
/** Cấp thoải mái dự kiến của một bố cục (để hiện khi đang trang trí). */
export const previewComfort = (l: Layout) => comfortLevel(comfortScore(l));

export async function refreshMemories(): Promise<void> {
  const rows = await api.listMemories(S.id);
  S.mem = rows.map(r => ({ id: r.id, t: Date.parse(r.created_at), type: r.kind, text: r.body }));
  S.favFound = rows.some(r => /món tủ/.test(r.body));
  emit();
}

export async function refreshDays(): Promise<void> {
  const rows = await api.listDayLogs(S.id);
  const today = localDay();
  S.diary = {}; S.groupLog = []; S.care = { fed: 0, ball: 0, pet: 0, talk: 0, bath: 0 };
  for (const r of rows) {
    S.care.fed += r.fed; S.care.ball += r.ball; S.care.pet += r.pet; S.care.talk += r.talk; S.care.bath += r.bath;
    S.groupLog.push({ d: r.day, groups: r.fgroups || [] });
    const log: DayLog = { d: r.day, fed: r.fed, foods: r.foods, groups: r.fgroups || [], bath: r.bath, ball: r.ball, pet: r.pet, talk: r.talk, sleep: r.sleep };
    if (r.day === today) S.day = log; else S.diary[r.day] = writeDiary(log);
  }
  if (!S.day || S.day.d !== today) S.day = emptyDay(today);
  emit();
}

/** Lưu tạm trên máy để mở lại nhanh; không phải bản chính. */
export function save(): void {
  try { localStorage.setItem('hatchday-cache', JSON.stringify({ name: S.name, species: S.species })); } catch { /* bỏ qua */ }
}

let memTimer = 0, questTimer = 0;
const scheduleQuestRefresh = () => { clearTimeout(questTimer); questTimer = window.setTimeout(() => { refreshQuests().catch(() => {}); }, 1500); };
const scheduleMemRefresh = () => { clearTimeout(memTimer); memTimer = window.setTimeout(() => { refreshMemories().catch(() => {}); }, 1200); };

/** Gửi một hành động. Trả về kết quả server (hoặc null nếu lỗi mạng — client giữ bản dự đoán). */
export async function act(action: PetAction, item?: string, count = 1): Promise<ActionResult | null> {
  try {
    const r = await api.petAction(action, item, count);
    applyRow(r.pet);
    if (action === 'feed' && item && typeof r.stock === 'number') S.owned = { ...S.owned, [item]: r.stock };
    if (action === 'feed') refreshTastes().catch(() => {});
    if (typeof r.coins === 'number') S.coins = r.coins;
    if (r.earned) S.earnedToday += r.earned;
    if (r.new_memory) scheduleMemRefresh();
    if (['feed', 'bath_rinse', 'play_ball', 'talk', 'sleep', 'pet'].includes(action)) scheduleQuestRefresh();
    emit();
    return r;
  } catch (e) {
    console.warn('pet_action thất bại', action, e);
    if (String((e as Error)?.message ?? e).includes('sick_blocked')) { refreshHealth().catch(() => {}); return null; } // bé đang ốm, client chưa biết kịp
    errListeners.forEach(fn => fn(e));
    return null;
  }
}

const batch: Partial<Record<PetAction, number>> = {};
let batchTimer = 0;
/** Gộp các hành động lặp nhanh (vuốt ve, kỳ cọ) rồi gửi theo lô. */
export function actBatched(action: 'pet' | 'bath_scrub'): void {
  batch[action] = (batch[action] || 0) + 1;
  if (batchTimer) return;
  batchTimer = window.setTimeout(flushBatch, 2000);
}
export async function flushBatch(): Promise<void> {
  batchTimer = 0;
  for (const k of Object.keys(batch) as ('pet' | 'bath_scrub')[]) {
    let n = batch[k] || 0; delete batch[k];
    while (n > 0) { const c = Math.min(n, 20); n -= c; await act(k, undefined, c); }
  }
}

export async function addTalkMemory(text: string): Promise<void> {
  try { await api.addTalkMemory(text); scheduleMemRefresh(); } catch (e) { console.warn(e); }
}

export async function deleteMemory(m: Memory): Promise<void> {
  S.mem = S.mem.filter(x => x !== m); emit();
  if (m.id != null) { try { await api.deleteMemory(m.id); } catch (e) { console.warn(e); scheduleMemRefresh(); } }
}

let nameTimer = 0;
export function renamePet(name: string): void {
  S.name = name; clearTimeout(nameTimer);
  nameTimer = window.setTimeout(() => { api.renamePet(name).catch(e => console.warn(e)); }, 800);
}

/** Đồng bộ lại định kỳ để chỉ số không lệch khỏi server. */
export function startPeriodicSync(ms = 60_000): () => void {
  const id = window.setInterval(async () => {
    try { const p = await api.getMyPet(); if (p) { applyRow(p); if (p.stage !== 'departed') { const h = await api.getHealth(); if (h) applyRow(h); } emit(); } await refreshEconomy(); await refreshOwned(); } catch { /* thử lại lần sau */ }
  }, ms);
  addEventListener('pagehide', () => { flushBatch(); });
  return () => clearInterval(id);
}

/** Trạng thái sức khoẻ hiện tại cho các hàm trong health.ts. */
export const healthNow = (): import('./health').HealthState => ({ no: S.no, sach: S.sach, vui: S.vui, nl: S.nl, asleep: S.asleep,
  illness: S.illness, sick_since: S.sickSince, critical_since: S.criticalSince, recover_at: S.recoverAt });
