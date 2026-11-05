/** Luật trang trí, kinh tế, nhiệm vụ — thuần, có test. Server (SQL) làm theo cùng công thức. */
import { BY_ID, GRID, ITEMS, PET_ZONE, WINDOW_CELLS, type Item, type Layout, type Placed, type Theme } from './catalog';

/** Kích thước chiếm chỗ sau khi xoay (xoay lẻ thì đổi rộng/sâu). */
export function footprint(it: Item, rot: number): [number, number] {
  const w = it.w || 1, d = it.d || 1;
  return rot % 2 ? [d, w] : [w, d];
}
export function cellsOf(p: Placed): [number, number][] {
  const it = BY_ID[p.id]; if (!it) return [];
  const [w, d] = it.layer === 'wall' ? [it.w || 1, it.d || 1] : footprint(it, p.rot);
  const out: [number, number][] = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push([p.c + i, p.r + j]);
  return out;
}

export type PlaceError = 'unknown' | 'bounds' | 'overlap' | 'pet' | 'window' | 'path' | null;

/** Kiểm tra đặt món `p` vào `layout` (bỏ qua món ở vị trí `ignore`). */
export function canPlace(layout: Layout, p: Placed, ignore = -1): PlaceError {
  const it = BY_ID[p.id];
  if (!it || it.kind !== 'decor' || !it.layer || it.layer === 'wallpaper' || it.layer === 'flooring') return 'unknown';
  const cells = cellsOf(p);
  const maxR = it.layer === 'wall' ? GRID.wallRows : GRID.rows;
  if (cells.some(([c, r]) => c < 0 || r < 0 || c >= GRID.cols || r >= maxR)) return 'bounds';
  const same = layout.items.filter((q, i) => i !== ignore && BY_ID[q.id]?.layer === it.layer);
  const taken = new Set(same.flatMap(cellsOf).map(([c, r]) => c + ',' + r));
  if (cells.some(([c, r]) => taken.has(c + ',' + r))) return 'overlap';
  if (it.layer === 'wall') return cells.some(([c, r]) => WINDOW_CELLS.some(([a, b]) => a === c && b === r)) ? 'window' : null;
  if (it.layer === 'rug') return null;
  if (cells.some(([c, r]) => PET_ZONE.some(([a, b]) => a === c && b === r))) return 'pet';
  const blocked = new Set([...taken, ...cells.map(([c, r]) => c + ',' + r)]);
  return hasPath(blocked) ? null : 'path';
}

/** Còn lối đi từ chỗ thú ra hàng phía trước (cửa) không. */
export function hasPath(blocked: Set<string>): boolean {
  const seen = new Set<string>(); const q: [number, number][] = PET_ZONE.map(([c, r]) => [c, r]);
  q.forEach(([c, r]) => seen.add(c + ',' + r));
  while (q.length) {
    const [c, r] = q.shift()!;
    if (r === GRID.rows - 1) return true;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, k = nc + ',' + nr;
      if (nc < 0 || nr < 0 || nc >= GRID.cols || nr >= GRID.rows || seen.has(k) || blocked.has(k)) continue;
      seen.add(k); q.push([nc, nr]);
    }
  }
  return false;
}

/** Tổng điểm thoải mái: mỗi món tính tối đa 2 bản. */
export function comfortScore(layout: Layout): number {
  const n: Record<string, number> = {};
  let s = 0;
  for (const id of [layout.wallpaper, layout.flooring, ...layout.items.map(i => i.id)]) {
    n[id] = (n[id] || 0) + 1;
    if (n[id] <= 2) s += BY_ID[id]?.comfort || 0;
  }
  return s;
}
export const comfortLevel = (score: number) => (score >= 30 ? 5 : score >= 20 ? 4 : score >= 12 ? 3 : score >= 6 ? 2 : 1);

/** Bộ chủ đề đang kích hoạt: từ 5 món khác nhau cùng chủ đề trở lên. */
export function activeSets(layout: Layout): Theme[] {
  const by: Partial<Record<Theme, Set<string>>> = {};
  for (const id of [layout.wallpaper, layout.flooring, ...layout.items.map(i => i.id)]) {
    const t = BY_ID[id]?.theme; if (t) (by[t] ||= new Set()).add(id);
  }
  return (Object.keys(by) as Theme[]).filter(t => by[t]!.size >= 5);
}

/** Số món đang đặt trong bố cục, theo id. */
export function placedCount(layout: Layout): Record<string, number> {
  const n: Record<string, number> = {};
  for (const p of layout.items) n[p.id] = (n[p.id] || 0) + 1;
  return n;
}

/* ---------- Ngày, nhiệm vụ, cửa hàng ---------- */
export const dayNumber = (day: string) => Math.round(Date.parse(day + 'T00:00:00Z') / 86400000);
export function isWeekend(day: string): boolean { const w = new Date(day + 'T00:00:00Z').getUTCDay(); return w === 0 || w === 6; }

export const QUEST_POOL = [
  { key: 'fed', label: 'Cho bé ăn 2 lần', target: 2 },
  { key: 'bath', label: 'Tắm cho bé 1 lần', target: 1 },
  { key: 'ball', label: 'Chơi ném bóng 3 lần', target: 3 },
  { key: 'pet', label: 'Vuốt ve bé 20 lần', target: 20 },
  { key: 'talk', label: 'Trò chuyện với bé 2 lần', target: 2 },
  { key: 'sleep', label: 'Chúc bé ngủ ngon', target: 1 },
] as const;
export const QUEST_REWARD = 30;
/** 3 nhiệm vụ của ngày, chỉ số trong QUEST_POOL. */
export function questsForDay(day: string): number[] { const n = dayNumber(day); return [n % 6, (n + 2) % 6, (n + 4) % 6]; }

/** 6 món của tiệm xoay vòng trong ngày. */
export function rotationForDay(day: string): string[] {
  const pool = ITEMS.filter(i => i.source === 'rotating').map(i => i.id).sort();
  const start = (dayNumber(day) * 7) % pool.length;
  return Array.from({ length: Math.min(6, pool.length) }, (_, k) => pool[(start + k) % pool.length]);
}

/** Món này có mua được hôm nay không. */
export function buyable(it: Item, day: string): boolean {
  if (it.price == null) return false;
  if (it.source === 'market') return true;
  if (it.source === 'rotating') return rotationForDay(day).includes(it.id);
  if (it.source === 'weekend') return isWeekend(day);
  return false;
}

export const COIN = { careReward: 5, careDailyCap: 50, start: 300, collectionReward: 150 } as const;
