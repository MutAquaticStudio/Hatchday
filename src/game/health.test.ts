import { describe, expect, it } from 'vitest';
import { clinicPrice, criticalStat, decayFactor, healthStep, HEALTH, ILLNESS_BY_ID, ILLNESSES, isNightHour, isSevere, MEDICINES, minutesToRecover, minutesToSick, triggeredByAction, type HealthCtx, type HealthState } from './health';
import { decayStats, deriveExpression } from './rules';

const NOW = Date.parse('2026-11-05T12:00:00Z');
const min = (m: number) => new Date(NOW - m * 60000).toISOString();
const well = (o: Partial<HealthState> = {}): HealthState => ({ no: 70, sach: 70, vui: 70, nl: 70, asleep: false, ...o });
const ctx = (o: Partial<HealthCtx> = {}): HealthCtx => ({ meals3d: 0, healthyGroups3d: 3, ...o });

describe('bảng bệnh', () => {
  it('8 bệnh, mỗi bệnh có đúng một thuốc và thuốc trỏ về đúng bệnh', () => {
    expect(ILLNESSES).toHaveLength(8);
    expect(MEDICINES).toHaveLength(8);
    for (const i of ILLNESSES) expect(MEDICINES.filter(m => m.cures === i.id).map(m => m.id)).toEqual([i.medicine]);
  });
  it('bốn bệnh bỏ bê ứng với bốn chỉ số, mỗi bệnh làm chính chỉ số đó giảm nhanh hơn', () => {
    const neglect = ILLNESSES.filter(i => i.family === 'bo-be');
    expect(neglect.map(i => (i.heal as { stat: string }).stat).sort()).toEqual(['nl', 'no', 'sach', 'vui']);
    for (const i of neglect) expect(i.decay[(i.heal as { stat: 'no' }).stat]).toBeGreaterThan(1);
  });
});

describe('bệnh bỏ bê', () => {
  it('chỉ số ≤ 5: thứ tự ưu tiên No, Sạch, Vui, Năng lượng; Năng lượng không tính lúc ngủ', () => {
    expect(criticalStat(well({ no: 5, sach: 0 }))).toBe('no');
    expect(criticalStat(well({ sach: 2, vui: 1 }))).toBe('sach');
    expect(criticalStat(well({ vui: 0 }))).toBe('vui');
    expect(criticalStat(well({ nl: 4 }))).toBe('nl');
    expect(criticalStat(well({ nl: 4, asleep: true }))).toBeNull();
    expect(criticalStat(well({ no: 6 }))).toBeNull();
  });
  it('mới nguy kịch thì chỉ bắt đầu đếm, chưa ốm', () => {
    const r = healthStep(well({ no: 0 }), ctx(), NOW);
    expect(r.illness).toBeNull();
    expect(r.critical_since).toBe(new Date(NOW).toISOString());
  });
  it('nguy kịch đủ 30 phút thì ốm đúng bệnh của chỉ số đó', () => {
    for (const [stat, id] of [['no', 'dau-bung'], ['sach', 'ngua-da'], ['vui', 'u-rut'], ['nl', 'sot-met']] as const) {
      const r = healthStep(well({ [stat]: 0, critical_since: min(30) }), ctx(), NOW);
      expect(r.illness).toBe(id); expect(r.event).toBe('fell-sick'); expect(r.critical_since).toBeNull();
    }
    expect(healthStep(well({ no: 0, critical_since: min(29) }), ctx(), NOW).illness).toBeNull();
  });
  it('được chăm lên thì đồng hồ 30 phút về 0', () => {
    expect(healthStep(well({ no: 40, critical_since: min(25) }), ctx(), NOW).critical_since).toBeNull();
  });
  it('ốm vì bỏ bê: chăm chỉ số lên từ 50 thì nghỉ 3 giờ rồi khỏi; tụt dưới 20 thì nghỉ lại', () => {
    const sick = well({ illness: 'dau-bung', sick_since: min(60), no: 55 });
    const a = healthStep(sick, ctx(), NOW);
    expect(a.illness).toBe('dau-bung');
    expect(Date.parse(a.recover_at!) - NOW).toBe(3 * 3600000);
    expect(minutesToRecover({ ...sick, recover_at: a.recover_at }, NOW)).toBe(180);
    expect(healthStep({ ...sick, recover_at: a.recover_at, no: 10 }, ctx(), NOW).recover_at).toBeNull();
    expect(healthStep({ ...sick, recover_at: a.recover_at, no: 30 }, ctx(), NOW).recover_at).toBe(a.recover_at); // 20–49: giữ nguyên
    const done = healthStep({ ...sick, recover_at: min(1), no: 10 }, ctx(), NOW);
    expect(done.illness).toBeNull(); expect(done.event).toBe('recovered');
  });
  it('báo còn bao nhiêu phút nữa thì ốm', () => {
    expect(minutesToSick(well({ vui: 3, critical_since: min(10) }), NOW)).toEqual({ stat: 'vui', left: 20 });
    expect(minutesToSick(well(), NOW)).toBeNull();
    expect(minutesToSick(well({ vui: 0, illness: 'u-rut' }), NOW)).toBeNull();
  });
});

describe('bệnh do hành động', () => {
  it('sâu răng: bữa ngọt thứ 4 trong ngày, bữa không ngọt thì không', () => {
    expect(triggeredByAction(ctx({ action: 'feed', lastMealSweet: true, sweetsToday: 3 }))).toBeNull();
    expect(triggeredByAction(ctx({ action: 'feed', lastMealSweet: true, sweetsToday: 4 }))).toBe('sau-rang');
    expect(triggeredByAction(ctx({ action: 'feed', lastMealSweet: false, sweetsToday: 5 }))).toBeNull();
  });
  it('thiếu chất: từ 6 bữa trong 3 ngày mà chỉ 1 nhóm lành mạnh', () => {
    expect(triggeredByAction(ctx({ action: 'feed', meals3d: 6, healthyGroups3d: 1 }))).toBe('thieu-chat');
    expect(triggeredByAction(ctx({ action: 'feed', meals3d: 5, healthyGroups3d: 1 }))).toBeNull();
    expect(triggeredByAction(ctx({ action: 'feed', meals3d: 9, healthyGroups3d: 2 }))).toBeNull();
  });
  it('căng cơ: chơi từ 12 lần trong 1 giờ; cảm lạnh: chơi khuya từ 2 lần trong 2 giờ (ưu tiên cảm lạnh)', () => {
    expect(triggeredByAction(ctx({ action: 'play', plays1h: 11 }))).toBeNull();
    expect(triggeredByAction(ctx({ action: 'play', plays1h: 12 }))).toBe('cang-co');
    expect(triggeredByAction(ctx({ action: 'play', plays1h: 2, nightPlays2h: 1 }))).toBeNull();
    expect(triggeredByAction(ctx({ action: 'play', plays1h: 2, nightPlays2h: 2 }))).toBe('cam-lanh');
    expect(triggeredByAction(ctx({ action: 'play', plays1h: 12, nightPlays2h: 2 }))).toBe('cam-lanh');
  });
  it('chỉ xét lúc có hành động tương ứng; mở game không tự mắc lại', () => {
    expect(triggeredByAction(ctx({ lastMealSweet: true, sweetsToday: 9, meals3d: 9, healthyGroups3d: 0, plays1h: 20, nightPlays2h: 9 }))).toBeNull();
    expect(healthStep(well(), ctx({ meals3d: 9, healthyGroups3d: 0 }), NOW).illness).toBeNull();
  });
  it('khuya là 22:00–04:59', () => {
    expect([21, 22, 23, 0, 4, 5].map(h => isNightHour(h))).toEqual([false, true, true, true, true, false]);
    expect([19, 20, 21, 4, 5].map(h => isNightHour(h, true))).toEqual([false, true, true, true, false]); // Mùa cúm: từ 20:00
  });
  it('bệnh theo giờ tự khỏi đúng số giờ; thiếu chất khỏi khi ăn cân bằng', () => {
    const a = healthStep(well(), ctx({ action: 'play', plays1h: 12 }), NOW);
    expect(a.illness).toBe('cang-co'); expect(Date.parse(a.recover_at!) - NOW).toBe(2 * 3600000);
    const b = healthStep(well(), ctx({ action: 'play', plays1h: 2, nightPlays2h: 2 }), NOW);
    expect(Date.parse(b.recover_at!) - NOW).toBe(4 * 3600000);
    const c = healthStep(well(), ctx({ action: 'feed', lastMealSweet: true, sweetsToday: 4 }), NOW);
    expect(Date.parse(c.recover_at!) - NOW).toBe(6 * 3600000);
    const t = well({ illness: 'thieu-chat', sick_since: min(10) });
    expect(healthStep(t, ctx({ healthyGroups3d: 2 }), NOW).illness).toBe('thieu-chat');
    expect(healthStep(t, ctx({ healthyGroups3d: 3 }), NOW).event).toBe('recovered');
    expect(healthStep({ ...well({ illness: 'cang-co', sick_since: min(130) }), recover_at: min(10) }, ctx(), NOW).event).toBe('recovered');
  });
});

describe('bệnh nặng', () => {
  it('nặng khi không có tiến triển phục hồi suốt 24 giờ', () => {
    const base = { illness: 'dau-bung', sick_since: min(24 * 60), recover_at: null };
    expect(isSevere(base, NOW)).toBe(true);
    expect(isSevere({ ...base, sick_since: min(24 * 60 - 1) }, NOW)).toBe(false);
    expect(isSevere({ ...base, recover_at: min(-60) }, NOW)).toBe(false);
    expect(isSevere({ illness: null, sick_since: null, recover_at: null }, NOW)).toBe(false);
  });
  it('phòng khám đắt hơn khi nặng', () => { expect(clinicPrice(false)).toBe(150); expect(clinicPrice(true)).toBe(250); });
});

describe('ảnh hưởng tới chỉ số', () => {
  it('hệ số giảm theo từng bệnh, bệnh nặng nhân thêm 1,25', () => {
    expect(decayFactor(null, 'no', false)).toBe(1);
    expect(decayFactor('dau-bung', 'no', false)).toBe(1.5);
    expect(decayFactor('dau-bung', 'sach', false)).toBe(1);
    expect(decayFactor('dau-bung', 'no', true)).toBeCloseTo(1.875);
  });
  it('decayStats áp hệ số của bệnh; ngủ thì Năng lượng vẫn hồi bình thường', () => {
    const s = { no: 100, vui: 100, nl: 100, sach: 100, asleep: false };
    expect(decayStats(s, 10).no).toBeCloseTo(91);
    expect(decayStats({ ...s, illness: 'dau-bung' }, 10).no).toBeCloseTo(100 - 10 * 0.9 * 1.5);
    expect(decayStats({ ...s, illness: 'sot-met' }, 10).nl).toBeCloseTo(100 - 10 * 0.45 * 1.5);
    expect(decayStats({ ...s, illness: 'sot-met', severe: true }, 10).nl).toBeCloseTo(100 - 10 * 0.45 * 1.5 * 1.25);
    const sleepy = { ...s, nl: 20, asleep: true, illness: 'sot-met' };
    expect(decayStats(sleepy, 10).nl).toBeCloseTo(50);
  });
  it('mỗi bệnh đều có hệ số, chặn việc gì thì viết ra được; ốm thì mặt ốm', () => {
    for (const i of ILLNESSES) expect(Object.keys(i.decay).length).toBeGreaterThan(0);
    expect(ILLNESS_BY_ID['cam-lanh'].block).toEqual(['play', 'bath']);
    expect(deriveExpression({ ...well(), illness: 'sau-rang' })).toBe('sick');
    expect(HEALTH.balancedGroups).toBe(3);
  });
});
