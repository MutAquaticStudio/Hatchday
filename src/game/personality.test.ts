import { describe as group, expect, it } from 'vitest';
import { applyDrift, AXES, describe, greeting, idleWeights, isBlank, normalize, pickWeighted, rollPersonality, smallTalk, topTraits, type Personality } from './personality';

const zero = normalize(null);
const P = (o: Partial<Personality>): Personality => ({ ...zero, ...o });

group('normalize / isBlank', () => {
  it('điền đủ trục thiếu, kẹp trong [-100, 100]', () => {
    expect(normalize({ energy: 140, social: -3 } as any)).toEqual({ energy: 100, social: -3, curious: 0, playful: 0, affection: 0 });
    expect(isBlank({})).toBe(true);
    expect(isBlank(zero)).toBe(true);
    expect(isBlank(P({ curious: 2 }))).toBe(false);
  });
});

group('rollPersonality', () => {
  it('giống SQL: floor(r * 101) - 50 cho từng trục', () => {
    expect(rollPersonality(() => 0)).toEqual(normalize(Object.fromEntries(AXES.map(a => [a, -50]))));
    expect(rollPersonality(() => 0.9999)).toEqual(normalize(Object.fromEntries(AXES.map(a => [a, 50]))));
    expect(rollPersonality(() => 0.5).energy).toBe(0);
  });
});

group('applyDrift', () => {
  it('chơi nhiều thì ham chơi, hiếu động hơn; ngủ thì dịu lại', () => {
    let p = zero;
    for (let i = 0; i < 10; i++) p = applyDrift(p, 'play_ball');
    expect(p.playful).toBe(6);
    expect(p.energy).toBe(3);
    expect(applyDrift(p, 'sleep').energy).toBe(2.7);
  });
  it('không đổi khi hành động không có trong bảng, không vượt 100', () => {
    expect(applyDrift(zero, 'wake')).toBe(zero);
    expect(applyDrift(P({ affection: 99.9 }), 'pet').affection).toBe(100);
  });
  it('làm tròn một chữ số, không trôi số thực', () => {
    let p = zero;
    for (let i = 0; i < 7; i++) p = applyDrift(p, 'feed');
    expect(p.curious).toBe(1.4);
  });
});

group('mô tả', () => {
  it('lấy nét mạnh nhất, bỏ nét quá nhạt', () => {
    const p = P({ playful: 40, affection: -25, energy: 10 });
    expect(topTraits(p).map(t => t.name)).toEqual(['Ham chơi', 'Độc lập']);
    expect(describe(p)).toMatch(/^Bé Ham chơi và Độc lập:/);
    expect(describe(zero)).toMatch(/chưa nghiêng/);
  });
});

group('hành vi rảnh', () => {
  it('cá tính 0 giữ gần đúng tỉ lệ cũ', () => {
    const w = idleWeights(zero, { nl: 50, vui: 80 });
    expect(w.visit).toBeCloseTo(0.3);
    expect(w.wander).toBeCloseTo(0.2);
    expect(w.dance).toBeCloseTo(0.14);
  });
  it('ham chơi thì nhảy múa nhiều hơn, trầm tính thì ngắm nghía nhiều hơn', () => {
    const s = { nl: 80, vui: 80 };
    expect(idleWeights(P({ playful: 80 }), s).dance).toBeGreaterThan(idleWeights(P({ playful: -80 }), s).dance * 3);
    expect(idleWeights(P({ playful: -80 }), s).look).toBeGreaterThan(idleWeights(P({ playful: 80 }), s).look);
  });
  it('không ngáp khi còn khoẻ, không nhảy múa khi buồn', () => {
    const w = idleWeights(P({ energy: -100 }), { nl: 90, vui: 30 });
    expect(w.yawn).toBe(0);
    expect(w.dance).toBe(0);
    for (const v of Object.values(w)) expect(v).toBeGreaterThanOrEqual(0);
  });
  it('pickWeighted chọn theo trọng số', () => {
    const w = { a: 1, b: 3 };
    expect(pickWeighted(w, 0.1)).toBe('a');
    expect(pickWeighted(w, 0.3)).toBe('b');
    expect(pickWeighted(w, 0.9999)).toBe('b');
  });
});

group('lời nói', () => {
  it('nhút nhát thì chào rụt rè, quấn người thì chào mừng rỡ', () => {
    expect(greeting(P({ social: -50 }), 'Mochi', 0)).toMatch(/^À…/);
    expect(greeting(P({ affection: 50 }), 'Mochi', 0)).toMatch(/nhớ bạn/);
    expect(greeting(zero, 'Mochi')).toBe('Chào bạn! Mình là Mochi.');
  });
  it('câu đáp theo nét nổi bật nhất', () => {
    expect(smallTalk(P({ curious: 60 }), 0)).toMatch(/Vì sao/);
    expect(typeof smallTalk(zero, 0.5)).toBe('string');
  });
});
