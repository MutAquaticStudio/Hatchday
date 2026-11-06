/** Hoạt động thế giới: Khám phá hôm nay, huy hiệu, mini-game — trên Postgres thật (PGlite). */
import { beforeAll, describe, expect, it } from 'vitest';
import { ACTIVITY_KINDS, BADGES, EXPLORE_TIERS, MINI, miniReward } from '../../src/game/world-activity';
import { createHarness, type Harness } from './harness';

const U = (n: number) => `73000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const A = U(1), B = U(2);
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const coins = async (u: string) => Number(await h.one('select coins from wallets where owner_id = $1', [u]));
const prog = () => rpc('get_world_progress');
const pid = (u: string) => `(select id from pets where owner_id = '${u}' and stage <> 'departed')`;
const unlock = () => h.db.exec(`update minigame_logs set last_at = now() - interval '1 minute'`);

beforeAll(async () => {
  h = await createHarness(); await h.addUsers(A, B);
  for (const [u, n] of [[A, 'An'], [B, 'Bình']] as const) { await h.as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); }
  await h.as(A);
}, 90_000);

describe('danh mục', () => {
  it('huy hiệu TS khớp bảng world_badges', async () => {
    const rows = await h.q<{ id: string; kind: string; target: number; reward: number }>('select id, kind, target, reward from world_badges order by sort');
    expect(rows).toEqual(BADGES.map(b => ({ id: b.id, kind: b.kind, target: b.target, reward: b.reward })));
  });
  it('bậc Khám phá và mini-game khớp mặc định', async () => {
    const p = await prog();
    expect(p.explore.map((t: any) => ({ need: t.need, reward: t.reward }))).toEqual(EXPLORE_TIERS.map(t => ({ need: t.need, reward: t.reward })));
    expect(Number(await h.one("select value from balance_config where key = 'mini.plays'"))).toBe(MINI.plays);
    expect(Number(await h.one("select value from balance_config where key = 'mini.butterfly_coin'"))).toBe(MINI.butterfly.per);
    expect(Number(await h.one("select value from balance_config where key = 'mini.brew_coin'"))).toBe(MINI.brew.per);
  });
});

describe('record_activity', () => {
  it('từ chối loại lạ và khách; chỉ nhận loại trong danh sách', async () => {
    await expect(rpc('record_activity', 'xyz')).rejects.toThrow('unknown_activity');
    await expect(rpc('record_activity', 'swing')).rejects.toThrow('unknown_activity'); // đồ chơi đi qua play_toy
    await h.as(null); await expect(rpc('record_activity', 'bench')).rejects.toThrow('not_authenticated'); await h.as(A);
    for (const k of ACTIVITY_KINDS) expect((await rpc('record_activity', k)).counted).toBe(true);
  });
  it('trần 30 lần/ngày mỗi hoạt động, vượt thì bỏ qua êm', async () => {
    for (let i = 0; i < 40; i++) await rpc('record_activity', 'bench');
    expect(Number(await h.one("select n from world_activity where owner_id = $1 and kind = 'bench'", [A]))).toBe(30);
    expect((await rpc('record_activity', 'bench')).counted).toBe(false);
    expect(Number(await h.one("select n from world_totals where owner_id = $1 and kind = 'bench'", [A]))).toBe(30);
  });
});

describe('Khám phá hôm nay', () => {
  it('đếm các hoạt động khác nhau, kể cả đồ chơi; chưa đủ thì không nhận; nhận một lần', async () => {
    await h.as(B);
    await expect(rpc('claim_explore', 0)).rejects.toThrow('quest_not_done');
    await rpc('record_activity', 'tea'); await rpc('record_activity', 'tea'); // lặp lại không tăng số loại
    expect((await prog()).kinds).toEqual(['tea']);
    await h.db.exec(`insert into toy_logs (pet_id, day, toy, n) values (${pid(B)}, private.local_day('${B}'), 'swing', 1)`);
    await rpc('record_activity', 'cat');
    expect((await prog()).kinds.sort()).toEqual(['cat', 'swing', 'tea']);
    const c0 = await coins(B), r = await rpc('claim_explore', 0);
    expect(r.reward).toBe(EXPLORE_TIERS[0].reward); expect(await coins(B)).toBe(c0 + r.reward);
    await expect(rpc('claim_explore', 0)).rejects.toThrow('already_claimed');
    await expect(rpc('claim_explore', 1)).rejects.toThrow('quest_not_done');
    await expect(rpc('claim_explore', 2)).rejects.toThrow('invalid_tier');
    for (const k of ['bench', 'stage', 'fountain']) await rpc('record_activity', k);
    expect((await rpc('claim_explore', 1)).reward).toBe(EXPLORE_TIERS[1].reward);
    await h.as(A);
  });
});

describe('huy hiệu', () => {
  it('tiến độ tăng, chưa đủ thì không nhận, đủ thì nhận một lần; báo huy hiệu vừa đạt', async () => {
    await h.as(B);
    const b0 = (await prog()).badges.find((b: any) => b.id === 'cat10');
    expect(b0.progress).toBe(1);
    await expect(rpc('claim_badge', 'cat10')).rejects.toThrow('quest_not_done');
    let newly: string[] = [];
    for (let i = 0; i < 9; i++) newly = (await rpc('record_activity', 'cat')).newly;
    expect(newly).toEqual(['cat10']);
    const c0 = await coins(B), r = await rpc('claim_badge', 'cat10');
    expect(r.reward).toBe(30); expect(await coins(B)).toBe(c0 + 30);
    await expect(rpc('claim_badge', 'cat10')).rejects.toThrow('already_claimed');
    await expect(rpc('claim_badge', 'khong-co')).rejects.toThrow('unknown_badge');
    expect((await prog()).badges.find((b: any) => b.id === 'cat10')).toMatchObject({ claimed: true, progress: 10, target: 10 });
    await h.as(A);
  });
  it('huy hiệu đồ chơi đếm từ toy_logs của mọi bé của người chơi', async () => {
    await h.db.exec(`insert into toy_logs (pet_id, day, toy, n) values (${pid(A)}, private.local_day('${A}'), 'slide', 6), (${pid(A)}, private.local_day('${A}') - 1, 'slide', 4)`);
    expect((await prog()).badges.find((b: any) => b.id === 'slide10').progress).toBe(10);
    expect((await rpc('claim_badge', 'slide10')).reward).toBe(30);
  });
});

describe('mini-game', () => {
  it('thưởng đúng công thức, chỉ vài lượt đầu mỗi ngày có xu, điểm vượt trần bị từ chối', async () => {
    await expect(rpc('submit_minigame', 'butterfly', 13)).rejects.toThrow('invalid_score');
    await expect(rpc('submit_minigame', 'butterfly', -1)).rejects.toThrow('invalid_score');
    await expect(rpc('submit_minigame', 'brew', 6)).rejects.toThrow('invalid_score');
    await expect(rpc('submit_minigame', 'dua', 1)).rejects.toThrow('unknown_activity');
    const c0 = await coins(A);
    let r = await rpc('submit_minigame', 'butterfly', 9);
    expect(r).toMatchObject({ reward: miniReward('butterfly', 9), rewarded: true, plays: 1, left: MINI.plays - 1, best: 9 }); expect(await coins(A)).toBe(c0 + r.reward);
    await expect(rpc('submit_minigame', 'butterfly', 5)).rejects.toThrow('rate_limited'); // quá sát lượt trước
    await unlock(); r = await rpc('submit_minigame', 'butterfly', 12);
    expect(r).toMatchObject({ reward: 12, rewarded: true, plays: 2, left: 0, best: 12 });
    await unlock(); r = await rpc('submit_minigame', 'butterfly', 12);
    expect(r).toMatchObject({ reward: 0, rewarded: false, plays: 3, left: 0 }); // hết lượt có thưởng
    expect(await coins(A)).toBe(c0 + 9 + 12);
  });
  it('bướm cộng tổng cho huy hiệu theo số con; trà chỉ tính khi đủ 5 sao; cả hai tính vào Khám phá', async () => {
    expect((await prog()).badges.find((b: any) => b.id === 'butterfly40').progress).toBe(9 + 12 + 12);
    await unlock(); let r = await rpc('submit_minigame', 'brew', 4);
    expect(r).toMatchObject({ reward: miniReward('brew', 4), rewarded: true }); expect((await prog()).badges.find((b: any) => b.id === 'brew5').progress).toBe(0);
    await unlock(); r = await rpc('submit_minigame', 'brew', 5);
    expect(r.reward).toBe(15); expect((await prog()).badges.find((b: any) => b.id === 'brew5').progress).toBe(1);
    expect((await prog()).kinds).toEqual(expect.arrayContaining(['butterfly', 'brew']));
  });
  it('khách và người chưa có bé bị từ chối; ví không bị âm', async () => {
    await h.as(null); await expect(rpc('submit_minigame', 'brew', 1)).rejects.toThrow('not_authenticated');
    await h.addUsers(U(9)); await h.as(U(9)); await expect(rpc('submit_minigame', 'brew', 1)).rejects.toThrow('no_pet'); await h.as(A);
  });
});

describe('quyền và dữ liệu', () => {
  it('người chơi không đọc/ghi bảng trực tiếp (RLS bật, không chính sách); hàm private không gọi được', async () => {
    await h.withRole(A, async () => {
      for (const t of ['world_activity', 'world_totals', 'badge_claims', 'explore_claims', 'minigame_logs'])
        expect(await h.q(`select * from ${t}`)).toEqual([]);
      await expect(h.q("insert into world_totals (owner_id, kind, n) values (auth.uid(), 'cat', 999)")).rejects.toThrow();
      await expect(h.q("select private.activity_total(auth.uid(), 'cat')")).rejects.toThrow();
    });
  });
  it('sổ cái ghi nguồn xu theo tên RPC', async () => {
    const ctxs = (await h.q<{ ctx: string }>('select distinct ctx from coin_ledger where owner_id = $1', [A])).map(r => r.ctx);
    expect(ctxs).toEqual(expect.arrayContaining(['submit_minigame', 'claim_badge']));
  });
  it('sweep_stats dọn log cũ và vẫn chạy', async () => {
    await h.db.exec(`insert into world_activity (owner_id, day, kind, n) values ('${A}', current_date - 60, 'tea', 1); insert into minigame_logs (owner_id, day, kind) values ('${A}', current_date - 60, 'brew')`);
    await h.q('select private.sweep_stats()');
    expect(Number(await h.one("select count(*) from world_activity where day < current_date - 45"))).toBe(0);
    expect(Number(await h.one("select count(*) from minigame_logs where day < current_date - 45"))).toBe(0);
  });
});
