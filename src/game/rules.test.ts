import { describe, expect, it } from 'vitest';
import { decayStats, deriveExpression, emptyDay, writeDiary, levelLabel, MAX_OFFLINE_MIN } from './rules';

const base = { no: 80, vui: 80, nl: 80, sach: 80, asleep: false };

describe('decayStats', () => {
  it('giảm đúng tốc độ theo phút', () => {
    const s = decayStats(base, 10);
    expect(s.no).toBeCloseTo(71);
    expect(s.vui).toBeCloseTo(75);
    expect(s.sach).toBeCloseTo(76.5);
    expect(s.nl).toBeCloseTo(75.5);
  });
  it('khi ngủ thì năng lượng hồi lại, không vượt 100', () => {
    expect(decayStats({ ...base, asleep: true }, 10).nl).toBe(100);
  });
  it('không xuống dưới 0 và giới hạn 3 ngày vắng mặt', () => {
    const s = decayStats(base, MAX_OFFLINE_MIN * 10);
    expect(s.no).toBe(0);
    expect(decayStats(base, -5)).toEqual(base);
  });
});

describe('deriveExpression', () => {
  it('ưu tiên ngủ, rồi ốm, rồi dỗi', () => {
    expect(deriveExpression({ ...base, asleep: true, sach: 0 })).toBe('sleep');
    expect(deriveExpression({ ...base, sach: 10, no: 10 })).toBe('sick');
    expect(deriveExpression({ ...base, no: 20, vui: 30 })).toBe('sulky');
    expect(deriveExpression({ ...base, no: 20 })).toBe('hungry');
    expect(deriveExpression({ ...base, nl: 10 })).toBe('sleepy');
    expect(deriveExpression({ ...base, vui: 10 })).toBe('sad');
    expect(deriveExpression(base)).toBe('vui');
  });
});

describe('writeDiary', () => {
  it('ngày trống vẫn có một câu', () => {
    expect(writeDiary(emptyDay('2026-10-31'))).toMatch(/yên ắng/);
  });
  it('nhắc món ăn không trùng lặp', () => {
    const t = writeDiary({ ...emptyDay('2026-10-31'), fed: 3, foods: ['Kem que', 'Kem que', 'Cà rốt'], bath: 2 });
    expect(t).toContain('Kem que, Cà rốt');
    expect(t).toContain('tắm tận 2 lần');
  });
});

it('nhãn mức chỉ số', () => {
  expect([levelLabel(90), levelLabel(50), levelLabel(30), levelLabel(5)]).toEqual(['Đầy', 'Ổn', 'Hơi thấp', 'Thấp']);
});
