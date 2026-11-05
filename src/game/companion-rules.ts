/**
 * Đồng hành giờ làm việc và màn chào mừng quay lại. Luật thuần (không DOM), chỉ chạy ở client:
 * - Chào mừng quay lại: vắng từ 3 giờ trở lên thì hiện thẻ tóm tắt bé đã thế nào (không trừ gì, chỉ báo).
 * - Nhắc giải lao mỗi 50 phút, uống nước mỗi 90 phút (tính theo thời gian trang đang mở và nhìn thấy), chỉ trong giờ làm việc 08:00–19:00.
 * - Chào sáng (05:00–11:00) và chào tối (từ 18:00), mỗi buổi một lần mỗi ngày.
 */
export const COMPANION = {
  awayMinutes: 180,
  breakEvery: 50,
  waterEvery: 90,
  workFrom: 8,
  workTo: 19,
  morning: [5, 11] as const,
  eveningFrom: 18,
} as const;

export interface CompanionPrefs { break: boolean; water: boolean; greet: boolean }
export const DEFAULT_PREFS: CompanionPrefs = { break: true, water: true, greet: true };

export type SeenSnap = { t: number; no: number; vui: number; sach: number; nl: number };

/** Vắng đủ lâu để hiện thẻ chào mừng? */
export const wasAway = (snap: SeenSnap | null, nowMs: number): boolean => !!snap && nowMs - snap.t >= COMPANION.awayMinutes * 60000;

/** Giờ làm việc (giờ địa phương 0–23)? */
export const isWorkHour = (h: number) => h >= COMPANION.workFrom && h < COMPANION.workTo;

export type Reminder = 'break' | 'water';
/** Cộng dồn `dtMin` phút đang mở trang. Trả về việc cần nhắc (nếu có) và bộ đếm mới. Ngoài giờ làm việc thì không nhắc và giữ bộ đếm về 0. */
export function stepReminders(acc: { break: number; water: number }, dtMin: number, hour: number, prefs: CompanionPrefs): { due: Reminder | null; acc: { break: number; water: number } } {
  if (!isWorkHour(hour)) return { due: null, acc: { break: 0, water: 0 } };
  let b = acc.break + dtMin, w = acc.water + dtMin, due: Reminder | null = null;
  if (prefs.break && b >= COMPANION.breakEvery) { due = 'break'; b = 0; }
  else if (prefs.water && w >= COMPANION.waterEvery) { due = 'water'; w = 0; }
  // nhắc giải lao xong thì cũng coi như nghỉ, đẩy lùi nhắc nước một chút để không dồn hai lời nhắc sát nhau
  if (due === 'break') w = Math.min(w, COMPANION.waterEvery - 10);
  return { due, acc: { break: b, water: w } };
}

export type Greeting = 'morning' | 'evening' | null;
/** Chào buổi nào lúc này, nếu hôm nay chưa chào buổi đó. `done` là các buổi đã chào hôm nay. */
export function greetingFor(hour: number, done: Greeting[], prefs: CompanionPrefs): Greeting {
  if (!prefs.greet) return null;
  if (hour >= COMPANION.morning[0] && hour < COMPANION.morning[1] && !done.includes('morning')) return 'morning';
  if (hour >= COMPANION.eveningFrom && !done.includes('evening')) return 'evening';
  return null;
}

export const LINES = {
  break: ['Bạn ngồi lâu rồi nè. Đứng dậy vươn vai một chút nhé!', 'Mắt bạn mỏi chưa? Nhìn ra xa 20 giây giúp mình nha.', 'Nghỉ tay một chút đi bạn, mình đợi được mà.'],
  water: ['Uống nước nào bạn ơi! Mình cũng khát theo rồi nè.', 'Nhớ uống một ly nước nha, giữ sức làm việc.', 'Ly nước của bạn đâu rồi? Uống một ngụm đi!'],
  morning: ['Chào buổi sáng! Hôm nay mình cùng cố gắng nhé.', 'Sáng rồi! Chúc bạn một ngày làm việc thật suôn sẻ.'],
  evening: ['Tối rồi, hôm nay bạn vất vả nhiều. Nghỉ ngơi thôi nha!', 'Hết giờ làm rồi đó. Về ăn tối và nghỉ ngơi nhé, mình ở đây với bạn.'],
} as const;
export const pickLine = (k: keyof typeof LINES, r = Math.random()) => LINES[k][Math.floor(r * LINES[k].length)];

/** Phút vắng → chữ. */
export function awayText(mins: number): string {
  if (mins >= 2 * 1440) return `${Math.floor(mins / 1440)} ngày`;
  if (mins >= 1440) return 'hơn một ngày';
  const h = Math.floor(mins / 60), m = mins % 60;
  return m >= 10 ? `${h} giờ ${m} phút` : `${h} giờ`;
}

/** Các chỉ số tụt đáng kể trong lúc vắng (từ 15 điểm trở lên), kèm giá trị trước và sau. */
export function drops(snap: SeenSnap, now: { no: number; vui: number; sach: number; nl: number }): { key: 'no' | 'vui' | 'sach' | 'nl'; from: number; to: number }[] {
  return (['no', 'vui', 'sach', 'nl'] as const).filter(k => snap[k] - now[k] >= 15).map(k => ({ key: k, from: Math.round(snap[k]), to: Math.round(now[k]) }));
}
