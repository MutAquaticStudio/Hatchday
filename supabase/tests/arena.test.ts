/** Đấu trường trên Postgres thật (PGlite): đá nâng cấp, chọn đối thủ, phần thưởng có trần, xếp hạng, bỏ trận, thách đấu bạn bè. */
import { beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './harness';

const U = (n: number) => `76000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const A = U(1), B = U(2), C = U(3), D = U(4);
let h: Harness;
const val = async (sql: string, args: unknown[] = []) => (await h.q<{ r: any }>(`select ${sql} as r`, args))[0].r;
const age = (uid: string) => h.db.query(`update arena_battles set started_at = now() - interval '1 minute' where user_id = $1 and status = 'pending'`, [uid]);
const coins = async (uid: string) => Number(await h.one('select coins from wallets where owner_id = $1', [uid]));

beforeAll(async () => {
  h = await createHarness(); await h.addUsers(A, B, C, D);
  for (const [u, n] of [[A, 'An'], [B, 'Bình'], [C, 'Chi']] as const) { await h.as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); }
  await h.db.exec(`update pets set stage = 'adult' where owner_id in ('${A}', '${B}')`); // C còn sơ sinh
  await h.db.exec(`update wallets set coins = 5000 where owner_id = '${A}'`);
}, 90_000);

describe('đá nâng cấp', () => {
  it('mua từng bậc đúng giá, tối đa 5 bậc, sai chỉ số thì từ chối', async () => {
    await h.as(A);
    const costs = [100, 200, 350, 550, 800];
    for (let i = 0; i < 5; i++) { const before = await coins(A); const r = await val('buy_upgrade($1)', ['atk']); expect(r.cost).toBe(costs[i]); expect(r.upgrades.atk).toBe(i + 1); expect(await coins(A)).toBe(before - costs[i]); }
    await expect(val('buy_upgrade($1)', ['atk'])).rejects.toThrow('upgrade_max');
    await expect(val('buy_upgrade($1)', ['mp'])).rejects.toThrow('invalid_stat');
  });
  it('thiếu xu thì không trừ gì', async () => {
    await h.as(B); await h.db.exec(`update wallets set coins = 50 where owner_id = '${B}'`);
    await expect(val('buy_upgrade($1)', ['hp'])).rejects.toThrow('not_enough_coins');
    expect(await coins(B)).toBe(50);
  });
  it('người chơi không ghi thẳng vào bảng nâng cấp được', async () => {
    await expect(h.withRole(A, () => h.q(`update pet_upgrades set hp = 5`))).rejects.toThrow();
  });
});

describe('vào trận', () => {
  it('bé còn sơ sinh chưa vào được', async () => {
    await h.as(C); await expect(val('arena_start($1)', ['practice'])).rejects.toThrow('arena_too_young');
  });
  it('đấu tập: đối thủ là máy, khác loài, cùng tuổi; có sân và hạt giống', async () => {
    await h.as(A); const r = await val('arena_start($1)', ['practice']);
    const mine = await h.one(`select species from pets where owner_id = '${A}'`);
    expect(r.opp.kind).toBe('bot'); expect(r.opp.species).not.toBe(mine); expect(r.opp.stage).toBe('adult');
    expect(r.field).toBeGreaterThanOrEqual(0); expect(r.field).toBeLessThanOrEqual(4); expect(r.upgrades.atk).toBe(5);
  });
  it('xếp hạng: gặp quái thú của người chơi khác (kèm chỉ số nâng cấp), không gặp bé sơ sinh', async () => {
    await h.as(A); const r = await val('arena_start($1)', ['ranked']);
    expect(r.opp.kind).toBe('player'); expect(r.opp.name).toBe('Bình'); expect(r.opp.upgrades).toEqual({ hp: 0, atk: 0, def: 0, spd: 0 });
  });
});

describe('kết thúc và phần thưởng', () => {
  it('trận quá ngắn bị từ chối', async () => {
    await h.as(A); const r = await val('arena_start($1)', ['practice']);
    await expect(val('arena_finish($1, $2, $3)', [r.id, 'win', 3])).rejects.toThrow('arena_too_fast');
  });
  it('thắng trận đầu ngày nhận thưởng thắng + thưởng đầu ngày; không nộp hai lần', async () => {
    await h.as(A); const before = await coins(A); const id = await h.one(`select id from arena_battles where user_id = '${A}' and status = 'pending'`); await age(A);
    const r = await val('arena_finish($1, $2, $3)', [id, 'win', 4]);
    expect(r.reward).toBe(50); expect(r.first_win).toBe(true); expect(await coins(A)).toBe(before + 50); expect(r.rewards_left).toBe(4);
    await expect(val('arena_finish($1, $2, $3)', [id, 'win', 4])).rejects.toThrow('arena_not_pending');
  });
  it('trần số trận có thưởng mỗi ngày', async () => {
    await h.as(A); let last: any;
    for (let i = 0; i < 6; i++) { const s = await val('arena_start($1)', ['practice']); await age(A); last = await val('arena_finish($1, $2, $3)', [s.id, 'loss', 5]); }
    expect(last.reward).toBe(0); expect(last.rewards_left).toBe(0);
    const st = await val('get_arena_state()'); expect(st.stats.losses).toBe(7); expect(st.stats.wins).toBe(1); // 6 trận thua + 1 trận xếp hạng bị bỏ dở ở phần trước
  });
  it('xếp hạng: thắng thì tăng điểm, quái thú bên kia ghi một trận thủ thua', async () => {
    await h.as(A); const before = Number(await h.one(`select rating from arena_stats where user_id = '${A}'`)); const s = await val('arena_start($1)', ['ranked']); await age(A);
    const r = await val('arena_finish($1, $2, $3)', [s.id, 'win', 6]);
    expect(r.rating_delta).toBeGreaterThan(0); expect(r.rating).toBe(before + r.rating_delta);
    expect(Number(await h.one(`select def_losses from arena_stats where user_id = '${B}'`))).toBe(1);
    expect((await val('get_arena_state()')).rank).toBe(1);
  });
  it('bỏ trận xếp hạng giữa chừng: vào trận mới thì trận cũ tính là thua', async () => {
    await h.as(A); const before = Number(await h.one(`select rating from arena_stats where user_id = '${A}'`));
    await val('arena_start($1)', ['ranked']); await val('arena_start($1)', ['practice']);
    expect(Number(await h.one(`select rating from arena_stats where user_id = '${A}'`))).toBeLessThan(before);
    expect(Number(await h.one(`select count(*) from arena_battles where user_id = '${A}' and mode = 'ranked' and status = 'abandoned' and result = 'forfeit'`))).toBeGreaterThanOrEqual(1);
    expect(Number(await h.one(`select count(*) from arena_battles where user_id = '${A}' and status = 'pending'`))).toBe(1);
  });
});

describe('thách đấu bạn bè', () => {
  it('chỉ thách được bạn bè', async () => {
    const pidB = await h.one(`select public_id::text from public_profiles where user_id = '${B}'`);
    await h.as(A); await expect(val('arena_start($1, $2)', ['friend', pidB])).rejects.toThrow('not_friends');
    await h.db.exec(`insert into friendships (a, b, status, requested_by, accepted_at) values ('${A < B ? A : B}', '${A < B ? B : A}', 'accepted', '${A}', now())`);
    const r = await val('arena_start($1, $2)', ['friend', pidB]); expect(r.opp.name).toBe('Bình'); expect(r.mode).toBe('friend');
  });
});
