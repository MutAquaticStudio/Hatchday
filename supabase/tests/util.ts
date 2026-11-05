/** Múi giờ mà bây giờ là `hour` giờ (mặc định 12 giờ trưa), để test không phụ thuộc giờ chạy máy
 *  (cảm lạnh tính theo giờ địa phương 22:00–05:00). */
export function tzForHour(hour = 12, now = new Date()): string {
  const diff = (hour - now.getUTCHours() + 48) % 24; // địa phương = UTC + diff
  const off = diff > 12 ? diff - 24 : diff;
  return off === 0 ? 'Etc/UTC' : `Etc/GMT${off > 0 ? '-' : '+'}${Math.abs(off)}`;
}
export const noonTz = () => tzForHour(12);
