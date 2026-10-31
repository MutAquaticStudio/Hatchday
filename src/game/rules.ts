/**
 * Luật chơi thuần (không phụ thuộc DOM/three.js) — client dùng để dự đoán,
 * server (supabase/migrations/*_init.sql) là nguồn sự thật. Hằng số phải khớp hai bên.
 */
export const DECAY_PER_MIN = { no: 0.9, vui: 0.5, sach: 0.35, nlAwake: 0.45, nlAsleep: 3 } as const;
export const MAX_OFFLINE_MIN = 60 * 24 * 3;

export interface Stats { no: number; vui: number; nl: number; sach: number; asleep: boolean }

export const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

/** Giảm chỉ số theo số phút đã trôi qua. Trả về bản sao. */
export function decayStats<T extends Stats>(s: T, mins: number): T {
  const m = Math.max(0, Math.min(mins, MAX_OFFLINE_MIN));
  return {
    ...s,
    no: clamp(s.no - m * DECAY_PER_MIN.no),
    vui: clamp(s.vui - m * DECAY_PER_MIN.vui),
    sach: clamp(s.sach - m * DECAY_PER_MIN.sach),
    nl: clamp(s.asleep ? s.nl + m * DECAY_PER_MIN.nlAsleep : s.nl - m * DECAY_PER_MIN.nlAwake),
  };
}

export type ExprKey = 'vui' | 'excited' | 'hungry' | 'sleepy' | 'sleep' | 'sick' | 'sulky' | 'sad' | 'love' | 'chew' | 'yawn';

/** Biểu cảm mặc định suy ra từ chỉ số (khi không có biểu cảm tạm thời). */
export function deriveExpression(s: Stats): ExprKey {
  if (s.asleep) return 'sleep';
  if (s.sach < 20) return 'sick';
  if (s.no < 30 && s.vui < 40) return 'sulky';
  if (s.no < 30) return 'hungry';
  if (s.nl < 22) return 'sleepy';
  if (s.vui < 28) return 'sad';
  return 'vui';
}

export const levelLabel = (v: number) => (v >= 75 ? 'Đầy' : v >= 45 ? 'Ổn' : v >= 25 ? 'Hơi thấp' : 'Thấp');

export interface DayLog { d: string; fed: number; foods: string[]; bath: number; ball: number; pet: number; talk: number; sleep: number }

export const emptyDay = (d: string): DayLog => ({ d, fed: 0, foods: [], bath: 0, ball: 0, pet: 0, talk: 0, sleep: 0 });

/** Trang nhật ký ghép từ mẫu câu (sẽ thay bằng AI ở giai đoạn sau). */
export function writeDiary(d: DayLog): string {
  const L: string[] = [];
  const foods = [...new Set(d.foods)];
  if (foods.length) L.push(`Hôm nay mình được ăn ${foods.slice(0, 3).join(', ')}.${foods.includes('Kem que') ? ' Kem que là số một!' : ''}`);
  if (d.bath) L.push(d.bath > 1 ? `Được tắm tận ${d.bath} lần, thơm phức luôn.` : 'Được tắm một trận đã đời, bọt nhiều ghê.');
  if (d.ball) L.push(`Ra vườn chơi ném bóng ${d.ball} lần. Lần nào mình cũng bắt được nha!`);
  if (d.pet > 25) L.push('Bạn vuốt ve mình nhiều lắm, mình vui muốn xỉu.');
  else if (d.pet) L.push('Bạn có xoa đầu mình, nhột mà thích.');
  if (d.talk) L.push(d.talk > 3 ? 'Tụi mình nói chuyện nhiều ghê. Mình nhớ hết đó.' : 'Bạn có ghé nói chuyện với mình một chút.');
  if (d.sleep) L.push('Tối được chúc ngủ ngon, mình mơ thấy một cánh đồng kem.');
  if (!L.length) L.push('Hôm nay yên ắng quá. Mình ngồi đợi bạn bên cửa sổ.');
  const end = ['Mai gặp lại nha!', 'Ngủ ngon nha bạn.', 'Mong mai bạn cũng vui.'];
  L.push(end[[...d.d].reduce((a, c) => a + c.charCodeAt(0), 0) % end.length]);
  return L.join(' ');
}

/** Ngày theo giờ địa phương dạng YYYY-MM-DD. */
export function localDay(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Bảng màu theo quả trứng đã chọn (gen "palette"). */
export const PALETTES = [
  { name: 'Hồng đào', body: '#ffd0dc', deep: '#ffb3c9', ink: '#8a4462', inner: '#ff9fbe' },
  { name: 'Bạc hà', body: '#c9f2e0', deep: '#a6e6cb', ink: '#3f7a66', inner: '#ffb3c9' },
  { name: 'Oải hương', body: '#ddd3ff', deep: '#c6b8ff', ink: '#5a4a9a', inner: '#ffb3dc' },
] as const;
