/**
 * Đồ chơi: hiệu ứng, trần ngày, mở khoá theo Gắn bó. PHẢI khớp bảng `toys` trong supabase/migrations/20261215000000_hooks_toys.sql
 * (test: supabase/tests/hooks-toys.test.ts). Máy chủ quyết định (RPC play_toy); client dùng bảng này để hiện chữ và hoạt ảnh.
 * fixture: đồ cố định ở một nơi (miễn phí, dùng tại đó); portable: mua bằng xu, dùng được ở vườn và ngoài trời.
 */
export type ToyPlace = 'balcony' | 'playroom' | 'rooftop' | 'park' | 'portable';
export type Axis = 'energy' | 'social' | 'curious' | 'playful' | 'affection';
export interface Toy { id: string; name: string; place: ToyPlace; vui: number; nl: number; no: number; drift: Partial<Record<Axis, number>>; bond: number; cap: number; price: number | null; memory: string; icon: string }

export const TOYS: Toy[] = [
  { id: 'bubbles', name: 'Thổi bong bóng', place: 'balcony', vui: 5, nl: -2, no: -1, drift: { playful: 0.3, curious: 0.2 }, bond: 3, cap: 6, price: null, memory: 'Lần đầu thổi bong bóng ngoài ban công.', icon: '🫧' },
  { id: 'kite', name: 'Thả diều', place: 'rooftop', vui: 7, nl: -4, no: -2, drift: { playful: 0.4, energy: 0.3 }, bond: 7, cap: 5, price: null, memory: 'Lần đầu thả diều trên sân thượng.', icon: '🪁' },
  { id: 'scope', name: 'Kính thiên văn', place: 'rooftop', vui: 5, nl: -1, no: 0, drift: { curious: 0.6 }, bond: 7, cap: 4, price: null, memory: 'Lần đầu ngắm sao bằng kính thiên văn.', icon: '🔭' },
  { id: 'train', name: 'Tàu hoả đồ chơi', place: 'playroom', vui: 6, nl: -3, no: -1, drift: { playful: 0.4 }, bond: 5, cap: 5, price: null, memory: 'Lần đầu chơi tàu hoả đồ chơi.', icon: '🚂' },
  { id: 'pit', name: 'Hồ bóng', place: 'playroom', vui: 7, nl: -5, no: -2, drift: { playful: 0.5, energy: 0.3 }, bond: 5, cap: 5, price: null, memory: 'Lần đầu nhảy xuống hồ bóng.', icon: '🔴' },
  { id: 'blocks', name: 'Xếp hình', place: 'playroom', vui: 5, nl: -2, no: 0, drift: { curious: 0.5 }, bond: 5, cap: 5, price: null, memory: 'Lần đầu xếp hình thành một cái tháp.', icon: '🧱' },
  { id: 'swing', name: 'Xích đu', place: 'park', vui: 6, nl: -3, no: -1, drift: { playful: 0.3, energy: 0.2 }, bond: 4, cap: 6, price: null, memory: 'Lần đầu được đẩy xích đu ở công viên.', icon: '🎠' },
  { id: 'seesaw', name: 'Bập bênh', place: 'park', vui: 6, nl: -4, no: -2, drift: { social: 0.4, playful: 0.3 }, bond: 4, cap: 5, price: null, memory: 'Lần đầu chơi bập bênh.', icon: '⚖️' },
  { id: 'slide', name: 'Cầu trượt', place: 'park', vui: 7, nl: -4, no: -2, drift: { energy: 0.4, playful: 0.3 }, bond: 4, cap: 5, price: null, memory: 'Lần đầu trượt cầu trượt.', icon: '🛝' },
  { id: 'ducks', name: 'Cho vịt ăn', place: 'park', vui: 4, nl: -1, no: -1, drift: { affection: 0.4 }, bond: 4, cap: 5, price: null, memory: 'Lần đầu cho vịt ở ao ăn bánh mì.', icon: '🦆' },
  { id: 'frisbee', name: 'Đĩa ném', place: 'portable', vui: 8, nl: -5, no: -2, drift: { playful: 0.5, energy: 0.4, social: 0.2 }, bond: 3, cap: 6, price: 120, memory: 'Lần đầu ném đĩa bay.', icon: '🥏' },
  { id: 'puzzle', name: 'Bộ xếp tranh', place: 'portable', vui: 5, nl: -1, no: 0, drift: { curious: 0.6 }, bond: 3, cap: 5, price: 90, memory: 'Lần đầu ghép xong một bức tranh.', icon: '🧩' },
  { id: 'musicbox', name: 'Hộp nhạc', place: 'portable', vui: 6, nl: -1, no: 0, drift: { affection: 0.4, curious: 0.1 }, bond: 3, cap: 5, price: 150, memory: 'Lần đầu nghe hộp nhạc, mình thấy yên lòng.', icon: '🎵' },
];
export const TOY_BY_ID: Record<string, Toy> = Object.fromEntries(TOYS.map(t => [t.id, t]));

/** Từ lượt thứ 3 trong ngày (đã dùng ≥ 2 lần) hiệu ứng Vui và No chỉ còn một nửa; Năng lượng vẫn tốn đủ. */
export const toyMult = (used: number): number => (used >= 2 ? 0.5 : 1);
export const toyGain = (t: Toy, used: number): { vui: number; nl: number; no: number } => ({ vui: t.vui * toyMult(used), nl: t.nl, no: t.no * toyMult(used) });

export type ToyRefusal = 'asleep' | 'tired' | 'toy_cap';
export const TOY_REFUSAL_TEXT: Record<ToyRefusal, string> = {
  asleep: 'Bé đang ngủ. Đánh thức bé rồi chơi tiếp nhé.', tired: 'Bé mệt rồi, cho bé nghỉ một chút nhé.', toy_cap: 'Hôm nay bé chơi món này đủ rồi, mai chơi tiếp nhé.',
};
/** Đồ chơi theo nơi (đồ cố định) hoặc mang theo. */
export const toysAt = (place: ToyPlace): Toy[] => TOYS.filter(t => t.place === place);
