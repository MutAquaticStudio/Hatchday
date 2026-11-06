import { describe, expect, it } from 'vitest';
import { BREW_STEPS, BREW_STARS, BUTTERFLY, brewScore, butterflyScore, inZone, markerAt, zoneCenter } from './minigame-rules';
import { MINI } from './world-activity';

describe('luật mini-game', () => {
  it('hằng số khớp máy chủ: 12 con bướm, 5 sao, 30 giây', () => {
    expect(BUTTERFLY.target).toBe(MINI.butterfly.max); expect(BREW_STARS).toBe(MINI.brew.max); expect(BUTTERFLY.seconds).toBe(30);
  });
  it('thanh chạy đi qua lại trong [0,1], bắt đầu từ 0', () => {
    expect(markerAt(0, 1)).toBe(0); expect(markerAt(1, 1)).toBe(1); expect(markerAt(2, 1)).toBeCloseTo(0, 9);
    for (let t = 0; t < 20; t += 0.137) { const m = markerAt(t, 0.9, 0.3); expect(m).toBeGreaterThanOrEqual(0); expect(m).toBeLessThanOrEqual(1); }
  });
  it('vùng xanh luôn nằm trọn trong thanh và hẹp dần', () => {
    for (const s of BREW_STEPS) for (const r of [0, 0.25, 0.5, 0.99, 1]) { const c = zoneCenter(s.zone, r); expect(c - s.zone / 2).toBeGreaterThanOrEqual(0.04 - 1e-9); expect(c + s.zone / 2).toBeLessThanOrEqual(0.96 + 1e-9); }
    BREW_STEPS.slice(1).forEach((s, i) => { expect(s.zone).toBeLessThan(BREW_STEPS[i].zone); expect(s.speed).toBeGreaterThan(BREW_STEPS[i].speed); });
  });
  it('trúng vùng khi ở trong nửa bề rộng', () => { expect(inZone(0.5, 0.5, 0.2)).toBe(true); expect(inZone(0.6, 0.5, 0.2)).toBe(true); expect(inZone(0.61, 0.5, 0.2)).toBe(false); });
  it('điểm gửi máy chủ luôn trong trần', () => {
    expect(brewScore([true, true, false, true, true])).toBe(4); expect(brewScore([])).toBe(0); expect(brewScore(Array(9).fill(true))).toBe(5);
    expect(butterflyScore(7.9)).toBe(7); expect(butterflyScore(99)).toBe(12); expect(butterflyScore(-3)).toBe(0);
  });
  it('mỗi bước đủ dễ để người chơi thật làm được: vùng xanh ≥ 16% và thời gian qua vùng ≥ 0,15 giây', () => {
    for (const s of BREW_STEPS) { expect(s.zone).toBeGreaterThanOrEqual(0.16); expect(s.zone / s.speed).toBeGreaterThanOrEqual(0.13); }
  });
});
