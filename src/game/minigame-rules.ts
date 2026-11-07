/** Luật mini-game (thuần, có test): Bắt bướm và Pha trà. Điểm tối đa và xu khớp world-activity.ts / máy chủ. */
import { MINI } from './world-activity';

export const BUTTERFLY = { seconds: MINI.butterfly.seconds, target: MINI.butterfly.max, onScreen: 5, hitRadius: 30 } as const;

/** Năm bước pha trà. Vùng xanh hẹp dần và thanh chạy nhanh dần. */
export const BREW_STEPS = [
  { id: 'boil', label: 'Đun nước', hint: 'Dừng khi nước sôi vừa tới', zone: 0.30, speed: 0.55 },
  { id: 'leaf', label: 'Chọn lá trà', hint: 'Dừng ở lượng lá vừa đủ', zone: 0.26, speed: 0.68 },
  { id: 'steep', label: 'Ủ trà', hint: 'Dừng khi trà vừa thơm', zone: 0.22, speed: 0.82 },
  { id: 'pour', label: 'Rót trà', hint: 'Dừng khi chén đầy vừa', zone: 0.19, speed: 0.98 },
  { id: 'honey', label: 'Thêm mật ong', hint: 'Một chút thôi nha', zone: 0.16, speed: 1.15 },
] as const;
export const BREW_STARS = BREW_STEPS.length;

/** Vị trí thanh chạy (0–1) tại thời điểm t giây: đi qua lại đều. `phase` lệch pha để mỗi lượt không giống nhau. */
export function markerAt(t: number, speed: number, phase = 0): number {
  const p = (t * speed + phase) % 2;
  return p < 1 ? p : 2 - p;
}
/** Vùng xanh có tâm center (0–1) và bề rộng zone; trúng nếu thanh nằm trong vùng. */
export const inZone = (pos: number, center: number, zone: number) => Math.abs(pos - center) <= zone / 2;
/** Tâm vùng xanh luôn nằm trọn trong thanh. */
export const zoneCenter = (zone: number, r: number) => zone / 2 + 0.04 + r * (1 - zone - 0.08);
/** Điểm gửi máy chủ: số sao (0–5). */
export const brewScore = (hits: boolean[]) => Math.max(0, Math.min(BREW_STARS, hits.filter(Boolean).length));
/** Điểm gửi máy chủ cho Bắt bướm: số con bắt được, tối đa BUTTERFLY.target. */
export const butterflyScore = (caught: number) => Math.max(0, Math.min(BUTTERFLY.target, Math.floor(caught)));
