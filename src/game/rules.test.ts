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
  it('không có ngữ cảnh thì giữ hành vi cũ', () => {
    expect(deriveExpression({ ...base, vui: 95 })).toBe('vui');
  });
  it('khuya mà còn thức và hơi mệt thì buồn ngủ; ban ngày thì không', () => {
    const s = { ...base, nl: 50 };
    expect(deriveExpression(s, { hour: 23 })).toBe('sleepy');
    expect(deriveExpression(s, { hour: 2 })).toBe('sleepy');
    expect(deriveExpression(s, { hour: 14 })).toBe('vui');
    expect(deriveExpression({ ...base, nl: 65 }, { hour: 7 })).toBe('sleepy');
    expect(deriveExpression({ ...base, nl: 90 }, { hour: 7 })).toBe('vui');
  });
  it('bị bỏ rơi lâu: bé hiếu động dỗi, bé trầm buồn; chăm thường xuyên thì không', () => {
    const s = { ...base, vui: 60 };
    const lau = 61 * 60000;
    expect(deriveExpression(s, { hour: 14, sinceCareMs: lau, energy: 20 })).toBe('sulky');
    expect(deriveExpression(s, { hour: 14, sinceCareMs: lau, energy: -20 })).toBe('sad');
    expect(deriveExpression(s, { hour: 14, sinceCareMs: 5 * 60000, energy: 20 })).toBe('vui');
    // bé quấn người chịu được ít hơn
    expect(deriveExpression(s, { hour: 14, sinceCareMs: 31 * 60000, affection: 30, energy: 20 })).toBe('sulky');
    expect(deriveExpression(s, { hour: 14, sinceCareMs: 31 * 60000, affection: 0, energy: 20 })).toBe('vui');
  });
  it('âu yếm khi gắn bó cao, đang vui và vừa được chăm', () => {
    expect(deriveExpression({ ...base, vui: 90 }, { hour: 14, bondLevel: 5, sinceCareMs: 30000 })).toBe('love');
    expect(deriveExpression({ ...base, vui: 90 }, { hour: 14, bondLevel: 3, sinceCareMs: 30000 })).toBe('vui');
    expect(deriveExpression({ ...base, vui: 90 }, { hour: 14, bondLevel: 5, sinceCareMs: 600000 })).not.toBe('love');
  });
  it('phấn khích ở nơi ngoài trời hoặc khi vừa chơi nhiều', () => {
    const s = { ...base, vui: 90 };
    expect(deriveExpression(s, { hour: 14, area: 'park' })).toBe('excited');
    expect(deriveExpression(s, { hour: 14, area: 'home' })).toBe('vui');
    expect(deriveExpression(s, { hour: 14, area: 'home', energy: 30 })).toBe('excited');
    expect(deriveExpression({ ...base, vui: 72 }, { hour: 14, area: 'home', playsRecent: 2 })).toBe('excited');
    expect(deriveExpression({ ...s, nl: 40 }, { hour: 14, area: 'park' })).not.toBe('excited');
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
