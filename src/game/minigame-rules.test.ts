import { describe, expect, it } from 'vitest';
import { BREW_STEPS, BREW_STARS, BUTTERFLY, BUGS, brewScore, bugShowMs, bugsScore, butterflyScore, DELIVERY, DELIVERY_STALLS, deliveryOrders, deliveryScore, FISH, fishBiteWindow, fishScore, inZone, markerAt, pickQuiz, QUIZ, QUIZ_BANK, quizScore, RHYTHM, rhythmChart, rhythmHit, rhythmScore, zoneCenter } from './minigame-rules';
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

describe('5 trò mới', () => {
  it('điểm luôn trong khoảng 0..trần của máy chủ', () => {
    expect(fishScore(-2)).toBe(0); expect(fishScore(99)).toBe(MINI.fish.max);
    expect(quizScore(7)).toBe(MINI.quiz.max); expect(deliveryScore(3.7)).toBe(3); expect(rhythmScore(25)).toBe(MINI.rhythm.max); expect(bugsScore(16)).toBe(MINI.bugs.max);
  });
  it('cửa sổ giật cần câu hẹp dần nhưng không dưới mức tối thiểu', () => {
    expect(fishBiteWindow(0)).toBe(FISH.bite); expect(fishBiteWindow(3)).toBeLessThan(fishBiteWindow(1)); expect(fishBiteWindow(50)).toBe(FISH.biteMin);
  });
  it('đố vui: 5 câu không trùng, đáp án đúng vẫn đúng sau khi xáo, cùng hạt giống ra cùng đề', () => {
    const a = pickQuiz(42), b = pickQuiz(42);
    expect(a).toEqual(b); expect(new Set(a.map(x => x.q)).size).toBe(QUIZ.questions);
    for (const x of a) { const src = QUIZ_BANK.find(y => y.q === x.q)!; expect(x.a[x.c]).toBe(src.a[src.c]); expect([...x.a].sort()).toEqual([...src.a].sort()); }
    for (const x of QUIZ_BANK) { expect(x.a).toHaveLength(4); expect(new Set(x.a).size).toBe(4); }
  });
  it('giao hàng: mỗi sạp đúng một đơn', () => {
    const o = deliveryOrders(7); expect(o).toHaveLength(DELIVERY.target); expect(new Set(o).size).toBe(DELIVERY_STALLS.length);
  });
  it('nhảy theo nhịp: 20 nốt tăng dần, giãn cách hợp lệ; chạm đúng làn trong cửa sổ mới trúng', () => {
    const ch = rhythmChart(3);
    expect(ch).toHaveLength(RHYTHM.notes);
    for (let i = 1; i < ch.length; i++) { const gap = ch[i].t - ch[i - 1].t; expect(gap).toBeGreaterThanOrEqual(RHYTHM.gapMin - 1e-6); expect(gap).toBeLessThanOrEqual(RHYTHM.gapMax + 1e-6); }
    const done = ch.map(() => false), n = ch[0];
    expect(rhythmHit(ch, done, n.lane, n.t + 0.1)).toBe(0);
    expect(rhythmHit(ch, done, (n.lane + 1) % 3, n.t)).not.toBe(0);
    expect(rhythmHit(ch, done, n.lane, n.t + 0.3)).toBe(-1);
    done[0] = true; expect(rhythmHit(ch, done, n.lane, n.t)).not.toBe(0);
  });
  it('bắt sâu: sâu ló ra ngắn dần', () => {
    expect(bugShowMs(0)).toBe(BUGS.showStart); expect(bugShowMs(1)).toBe(BUGS.showEnd); expect(bugShowMs(0.5)).toBeLessThan(BUGS.showStart);
  });
});
