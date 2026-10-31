/**
 * Trạng thái thú phía client. Server là nguồn sự thật:
 * - hydrate() tải thú, ký ức, nhật ký ngày.
 * - act() gửi hành động, client đã áp dụng lạc quan trước đó, kết quả server ghi đè chỉ số.
 * - Vuốt ve và kỳ cọ được gộp theo lô 2 giây để không gửi quá nhiều yêu cầu.
 */
import * as api from '../data/api';
import type { ActionResult, PetAction, PetRow } from '../data/types';
import { emptyDay, localDay, writeDiary, type DayLog } from './rules';

export interface Memory { id?: number; t: number; type: string; text: string }

export interface PetState {
  id: string; name: string; family: string; palette: number;
  no: number; vui: number; nl: number; sach: number; asleep: boolean; t: number;
  favFound: boolean; mem: Memory[]; day: DayLog | null; diary: Record<string, string>; firsts: Record<string, number>;
}

export const S: PetState = {
  id: '', name: 'Bé', family: '', palette: 0, no: 70, vui: 70, nl: 80, sach: 80, asleep: false, t: Date.now(),
  favFound: false, mem: [], day: null, diary: {}, firsts: {},
};

type Listener = () => void;
const listeners = new Set<Listener>();
export const onSync = (fn: Listener) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach(fn => fn());

function applyRow(p: PetRow) {
  S.id = p.id; S.name = p.name; S.family = p.family_name; S.palette = p.genes?.palette ?? 0;
  S.no = p.no; S.vui = p.vui; S.nl = p.nl; S.sach = p.sach; S.asleep = p.asleep; S.t = Date.now();
}

export async function hydrate(): Promise<void> {
  const p = await api.getMyPet();
  if (!p) throw new Error('no_pet');
  applyRow(p);
  await Promise.all([refreshMemories(), refreshDays()]);
}

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
  try { localStorage.setItem('thu-ao-cache', JSON.stringify({ name: S.name, palette: S.palette })); } catch { /* bỏ qua */ }
}

let memTimer = 0;
const scheduleMemRefresh = () => { clearTimeout(memTimer); memTimer = window.setTimeout(() => { refreshMemories().catch(() => {}); }, 1200); };

/** Gửi một hành động. Trả về kết quả server (hoặc null nếu lỗi mạng — client giữ bản dự đoán). */
export async function act(action: PetAction, item?: string, count = 1): Promise<ActionResult | null> {
  try {
    const r = await api.petAction(action, item, count);
    applyRow(r.pet);
    if (r.new_memory) scheduleMemRefresh();
    emit();
    return r;
  } catch (e) {
    console.warn('pet_action thất bại', action, e);
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
