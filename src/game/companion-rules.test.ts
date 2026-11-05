import { describe, expect, it } from 'vitest';
import { awayText, COMPANION, DEFAULT_PREFS, drops, greetingFor, isWorkHour, pickLine, stepReminders, wasAway } from './companion-rules';

const NOW = Date.parse('2026-11-05T12:00:00Z');
const snap = (minsAgo: number, o = {}) => ({ t: NOW - minsAgo * 60000, no: 80, vui: 70, sach: 90, nl: 60, ...o });

describe('chào mừng quay lại', () => {
  it('chỉ hiện khi đã có lần ghi trước và vắng từ 3 giờ', () => {
    expect(wasAway(null, NOW)).toBe(false);
    expect(wasAway(snap(179), NOW)).toBe(false);
    expect(wasAway(snap(180), NOW)).toBe(true);
  });
  it('nói thời gian vắng dễ đọc', () => {
    expect(awayText(180)).toBe('3 giờ'); expect(awayText(200)).toBe('3 giờ 20 phút'); expect(awayText(185)).toBe('3 giờ');
    expect(awayText(1500)).toBe('hơn một ngày'); expect(awayText(3000)).toBe('2 ngày');
  });
  it('liệt kê chỉ số tụt từ 15 điểm trở lên, kèm giá trị trước và sau', () => {
    expect(drops(snap(300), { no: 6.4, vui: 60, sach: 80, nl: 10 })).toEqual([{ key: 'no', from: 80, to: 6 }, { key: 'nl', from: 60, to: 10 }]);
    expect(drops(snap(300), { no: 70, vui: 60, sach: 80, nl: 50 })).toEqual([]);
  });
});

describe('đồng hành giờ làm việc', () => {
  it('giờ làm việc 08:00–18:59', () => { expect([7, 8, 18, 19, 23].map(isWorkHour)).toEqual([false, true, true, false, false]); });
  it('nhắc giải lao sau 50 phút, nhắc nước sau 90 phút, đếm lại từ 0', () => {
    let acc = { break: 0, water: 0 }, got: (string | null)[] = [];
    for (let m = 1; m <= 100; m++) { const r = stepReminders(acc, 1, 10, DEFAULT_PREFS); acc = r.acc; if (r.due) got.push(`${m}:${r.due}`); }
    expect(got).toEqual(['50:break', '90:water', '100:break'].filter((_, i) => i < 3));
  });
  it('tắt từng loại nhắc', () => {
    let acc = { break: 0, water: 0 }; const due: string[] = [];
    for (let m = 1; m <= 200; m++) { const r = stepReminders(acc, 1, 10, { ...DEFAULT_PREFS, break: false }); acc = r.acc; if (r.due) due.push(r.due); }
    expect(new Set(due)).toEqual(new Set(['water']));
  });
  it('ngoài giờ làm việc thì không nhắc và đếm về 0', () => {
    const r = stepReminders({ break: 49, water: 89 }, 5, 21, DEFAULT_PREFS);
    expect(r.due).toBeNull(); expect(r.acc).toEqual({ break: 0, water: 0 });
  });
  it('mỗi buổi chào một lần mỗi ngày, chỉ đúng khung giờ', () => {
    expect(greetingFor(8, [], DEFAULT_PREFS)).toBe('morning');
    expect(greetingFor(8, ['morning'], DEFAULT_PREFS)).toBeNull();
    expect(greetingFor(12, [], DEFAULT_PREFS)).toBeNull();
    expect(greetingFor(18, [], DEFAULT_PREFS)).toBe('evening');
    expect(greetingFor(22, ['evening'], DEFAULT_PREFS)).toBeNull();
    expect(greetingFor(8, [], { ...DEFAULT_PREFS, greet: false })).toBeNull();
    expect(COMPANION.breakEvery).toBe(50);
  });
  it('lời nhắc luôn có chữ', () => { for (const k of ['break', 'water', 'morning', 'evening'] as const) for (const r of [0, 0.5, 0.999]) expect(pickLine(k, r).length).toBeGreaterThan(10); });
});
