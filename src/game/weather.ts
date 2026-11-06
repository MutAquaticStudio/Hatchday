/** Thời tiết của thế giới: suy ra từ giờ địa phương nên mọi người cùng thấy một bầu trời mà không cần máy chủ. Thuần, có test. */
export type Sky = 'clear' | 'cloudy' | 'rain';
export type Fall = 'petal' | 'leaf' | null;
export interface Weather { sky: Sky; /** 0–1: cường độ mưa / độ u ám */ amount: number }

/** Mỗi khối 3 giờ có một thời tiết cố định theo ngày. */
export const BLOCK_MS = 3 * 3600000;

/** Hàm băm nhỏ, đủ đều cho việc chọn thời tiết. */
function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Số thứ tự khối 3 giờ theo giờ địa phương của máy. */
export function blockIndex(ms: number): number {
  const d = new Date(ms), local = ms - d.getTimezoneOffset() * 60000;
  return Math.floor(local / BLOCK_MS);
}

/** Mưa ~18% số khối, âm u ~24%, còn lại quang đãng; hai khối liền nhau không cùng mưa quá lâu (mưa tối đa 2 khối liên tiếp). */
export function weatherAt(ms: number): Weather {
  const b = blockIndex(ms);
  const raw = (i: number): Sky => { const v = hash(i); return v < 0.18 ? 'rain' : v < 0.42 ? 'cloudy' : 'clear'; };
  let sky = raw(b);
  if (sky === 'rain' && raw(b - 1) === 'rain' && raw(b - 2) === 'rain') sky = 'cloudy';
  const amount = sky === 'clear' ? 0 : 0.5 + hash(b + 7919) * 0.5;
  return { sky, amount };
}

/** Cánh hoa (xuân) hoặc lá rơi (thu) theo tháng. */
export function fallFor(month: number): Fall { return month >= 1 && month <= 3 ? 'petal' : month >= 8 && month <= 10 ? 'leaf' : null; }

/** Ghi đè để thử: ?weather=rain|cloudy|clear (chỉ dùng cho kiểm tra/ảnh chụp). */
export function weatherOverride(search: string): Sky | null {
  const v = new URLSearchParams(search).get('weather');
  return v === 'rain' || v === 'cloudy' || v === 'clear' ? v : null;
}

/** Hệ số ánh sáng ngoài trời theo thời tiết: [hemi, sun]. */
export const SKY_LIGHT: Record<Sky, [number, number]> = { clear: [1, 1], cloudy: [0.9, 0.7], rain: [0.78, 0.42] };

export const SKY_LABEL: Record<Sky, string> = { clear: 'Trời quang', cloudy: 'Trời âm u', rain: 'Trời đang mưa' };
