/**
 * Trạng thái thú phía client. Server là nguồn sự thật:
 * - hydrate() tải thú, ký ức, nhật ký ngày.
 * - act() gửi hành động, client đã áp dụng lạc quan trước đó, kết quả server ghi đè chỉ số.
 * - Vuốt ve và kỳ cọ được gộp theo lô 2 giây để không gửi quá nhiều yêu cầu.
 */
import * as api from '../data/api';
import type { ActionResult, Outfit, PetAction, PetRow, QuestRow } from '../data/types';
import { emptyDay, localDay, writeDiary, type DayLog } from './rules';
import { DEFAULT_LAYOUT, type Layout } from './catalog';
import { comfortLevel, comfortScore } from './layout';

export interface Memory { id?: number; t: number; type: string; text: string }

export interface PetState {
  id: string; name: string; family: string; palette: number;
  no: number; vui: number; nl: number; sach: number; asleep: boolean; t: number;
  favFound: boolean; mem: Memory[]; day: DayLog | null; diary: Record<string, string>; firsts: Record<string, number>;
  coins: number; earnedToday: number; rotation: string[]; weekend: boolean;
  owned: Record<string, number>; layouts: (Layout | null)[]; activeLayout: number; comfort: number;
  outfit: Outfit; presets: Outfit[]; likes: string[]; dislike: string; quests: QuestRow[]; collections: string[];
}

export const S: PetState = {
  id: '', name: 'Bé', family: '', palette: 0, no: 70, vui: 70, nl: 80, sach: 80, asleep: false, t: Date.now(),
  favFound: false, mem: [], day: null, diary: {}, firsts: {},
  coins: 0, earnedToday: 0, rotation: [], weekend: false, owned: {}, layouts: [null, null, null], activeLayout: 0, comfort: 1,
  outfit: {}, presets: [{}, {}, {}], likes: [], dislike: '', quests: [], collections: [],
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

function applyRow(p: PetRow) {
  S.id = p.id; S.name = p.name; S.family = p.family_name; S.palette = p.genes?.palette ?? 0;
  S.no = p.no; S.vui = p.vui; S.nl = p.nl; S.sach = p.sach; S.asleep = p.asleep; S.t = Date.now();
  if (p.outfit) S.outfit = p.outfit;
  if (p.outfit_presets) S.presets = p.outfit_presets;
  if (p.comfort_level) S.comfort = p.comfort_level;
  S.likes = p.genes?.likes || ['mem', 'cay']; S.dislike = p.genes?.dislike || 'retro';
}

export async function hydrate(): Promise<void> {
  const p = await api.getMyPet();
  if (!p) throw new Error('no_pet');
  applyRow(p);
  await Promise.all([refreshMemories(), refreshDays(), refreshEconomy(), refreshOwned(), refreshLayouts(), refreshQuests()]);
}

export async function refreshEconomy(): Promise<void> {
  const e = await api.getEconomy();
  S.coins = e.coins; S.earnedToday = e.earned_today; S.rotation = e.rotation; S.weekend = e.weekend; emit();
}
export async function refreshOwned(): Promise<void> {
  S.owned = await api.listOwned();
  S.collections = await api.listCollectionClaims(); emit();
}
export async function refreshLayouts(): Promise<void> {
  const r = await api.getLayouts(); S.layouts = r.layouts; S.activeLayout = r.active; emit();
}
export async function refreshQuests(): Promise<void> { S.quests = await api.getQuests(); emit(); }

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
export async function claimQuest(i: number): Promise<unknown> {
  try { const r = await api.claimQuest(i); S.coins = r.coins; await refreshQuests(); return null; } catch (e) { return e; }
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
  S.diary = {};
  for (const r of rows) {
    const log: DayLog = { d: r.day, fed: r.fed, foods: r.foods, bath: r.bath, ball: r.ball, pet: r.pet, talk: r.talk, sleep: r.sleep };
    if (r.day === today) S.day = log; else S.diary[r.day] = writeDiary(log);
  }
  if (!S.day || S.day.d !== today) S.day = emptyDay(today);
  emit();
}

/** Lưu tạm trên máy để mở lại nhanh; không phải bản chính. */
export function save(): void {
  try { localStorage.setItem('hatchday-cache', JSON.stringify({ name: S.name, palette: S.palette })); } catch { /* bỏ qua */ }
}

let memTimer = 0, questTimer = 0;
const scheduleQuestRefresh = () => { clearTimeout(questTimer); questTimer = window.setTimeout(() => { refreshQuests().catch(() => {}); }, 1500); };
const scheduleMemRefresh = () => { clearTimeout(memTimer); memTimer = window.setTimeout(() => { refreshMemories().catch(() => {}); }, 1200); };

/** Gửi một hành động. Trả về kết quả server (hoặc null nếu lỗi mạng — client giữ bản dự đoán). */
export async function act(action: PetAction, item?: string, count = 1): Promise<ActionResult | null> {
  try {
    const r = await api.petAction(action, item, count);
    applyRow(r.pet);
    if (typeof r.coins === 'number') S.coins = r.coins;
    if (r.earned) S.earnedToday += r.earned;
    if (r.new_memory) scheduleMemRefresh();
    if (['feed', 'bath_rinse', 'play_ball', 'talk', 'sleep', 'pet'].includes(action)) scheduleQuestRefresh();
    emit();
    return r;
  } catch (e) {
    console.warn('pet_action thất bại', action, e);
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
    try { const p = await api.getMyPet(); if (p) { applyRow(p); emit(); } } catch { /* thử lại lần sau */ }
  }, ms);
  addEventListener('pagehide', () => { flushBatch(); });
  return () => clearInterval(id);
}
