import { describe, expect, it } from 'vitest';
import { blockIndex, BLOCK_MS, fallFor, SKY_LIGHT, weatherAt, weatherOverride } from './weather';

describe('thời tiết', () => {
  it('cố định trong một khối 3 giờ và giống nhau giữa những người cùng múi giờ', () => {
    const t0 = new Date(2026, 10, 6, 6, 0, 0).getTime(), t1 = new Date(2026, 10, 6, 8, 59, 0).getTime();
    expect(blockIndex(t0)).toBe(blockIndex(t1));
    expect(weatherAt(t0)).toEqual(weatherAt(t1));
  });
  it('tỉ lệ mưa và âm u hợp lý trên nhiều ngày, không mưa quá 2 khối liền nhau, mưa luôn có cường độ', () => {
    const n = 8 * 400, counts = { clear: 0, cloudy: 0, rain: 0 }; let run = 0, maxRun = 0;
    for (let i = 0; i < n; i++) {
      const w = weatherAt(new Date(2026, 0, 1).getTime() + i * BLOCK_MS); counts[w.sky]++;
      run = w.sky === 'rain' ? run + 1 : 0; maxRun = Math.max(maxRun, run);
      if (w.sky === 'clear') expect(w.amount).toBe(0); else { expect(w.amount).toBeGreaterThanOrEqual(0.5); expect(w.amount).toBeLessThanOrEqual(1); }
    }
    expect(counts.rain / n).toBeGreaterThan(0.1); expect(counts.rain / n).toBeLessThan(0.25);
    expect(counts.cloudy / n).toBeGreaterThan(0.15); expect(counts.clear / n).toBeGreaterThan(0.45);
    expect(maxRun).toBeLessThanOrEqual(2);
  });
  it('cánh hoa mùa xuân, lá mùa thu, còn lại không có; ánh sáng giảm khi mưa', () => {
    expect([1, 2, 3].map(fallFor)).toEqual(['petal', 'petal', 'petal']); expect([8, 9, 10].map(fallFor)).toEqual(['leaf', 'leaf', 'leaf']); expect(fallFor(6)).toBeNull();
    expect(SKY_LIGHT.rain[1]).toBeLessThan(SKY_LIGHT.cloudy[1]); expect(SKY_LIGHT.clear).toEqual([1, 1]);
  });
  it('ghi đè bằng ?weather= chỉ nhận giá trị hợp lệ', () => {
    expect(weatherOverride('?weather=rain')).toBe('rain'); expect(weatherOverride('?x=1&weather=clear')).toBe('clear'); expect(weatherOverride('?weather=snow')).toBeNull(); expect(weatherOverride('')).toBeNull();
  });
});
