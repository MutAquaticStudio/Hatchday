/** Hook sự kiện: nhân xu nhiệm vụ trên Postgres thật, khớp events.ts. */
import { beforeAll, describe, expect, it } from 'vitest';
import { boostedReward, eventBoost } from '../../src/game/events';
import { createHarness, type Harness } from './harness';

const U = '90000000-0000-4000-8000-000000000001';
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const coins = () => h.one('select coins from wallets where owner_id = $1', [U]);
const addEvent = (cfg: object, o: { enabled?: boolean; start?: string; end?: string } = {}) =>
  h.q(`insert into events (title, kind, starts_at, ends_at, enabled, config) values ('thử', 'limited', now() ${o.start ?? '- interval \'1 hour\''}, now() ${o.end ?? '+ interval \'1 day\''}, $1, $2)`, [o.enabled ?? true, JSON.stringify(cfg)]);

beforeAll(async () => { h = await createHarness(); await h.addUsers(U); await h.as(U); await h.q(`select * from create_pet('An', 'Nhà An', 1)`); }, 90_000);

describe('validate_event_config', () => {
  it('nhận coin_boost từ 1 đến 3; từ chối ngoài khoảng, sai kiểu, khoá lạ', async () => {
    for (const ok of [{ coin_boost: 1 }, { coin_boost: 1.5 }, { coin_boost: 3 }, { banner: 'x', coin_boost: 2, plaza_decor: 'tet' }]) await rpc('private.validate_event_config', JSON.stringify(ok));
    for (const bad of [{ coin_boost: 0.9 }, { coin_boost: 3.1 }, { coin_boost: '2' }, { shop_discount: 10 }]) await expect(rpc('private.validate_event_config', JSON.stringify(bad))).rejects.toThrow('invalid_event_config');
  });
});

describe('event_boost và thưởng nhiệm vụ', () => {
  it('không có sự kiện: hệ số 1; chỉ tính sự kiện đang bật và đang trong thời gian; lấy hệ số lớn nhất', async () => {
    expect(Number(await rpc('private.event_boost'))).toBe(1);
    await addEvent({ coin_boost: 2 }, { enabled: false }); await addEvent({ coin_boost: 3 }, { start: "+ interval '1 hour'", end: "+ interval '2 hours'" }); await addEvent({ banner: 'chỉ banner' });
    expect(Number(await rpc('private.event_boost'))).toBe(1);
    await addEvent({ coin_boost: 1.5 }); await addEvent({ coin_boost: 2 });
    expect(Number(await rpc('private.event_boost'))).toBe(2);
    expect(eventBoost([{ id: 1, title: '', body: '', kind: '', starts_at: '', ends_at: '', config: { coin_boost: 1.5 } }, { id: 2, title: '', body: '', kind: '', starts_at: '', ends_at: '', config: { coin_boost: 2 } }])).toBe(2);
  });
  it('nhận thưởng nhiệm vụ ngày được nhân hệ số, khớp boostedReward', async () => {
    await h.db.exec('delete from events'); await addEvent({ coin_boost: 1.5 });
    await h.as(U);
    // chăm đủ để mọi nhiệm vụ xong: ép tiến độ bằng cách ghi nhật ký ngày
    const d = await h.one(`select private.local_day('${U}')::text`);
    await h.db.exec(`insert into day_logs (pet_id, owner_id, day, fed, foods, fgroups, bath, ball, pet, talk, sleep) select id, '${U}', '${d}', 99, '{a,b,c,d}', '{rau,dam,tinhbot}', 99, 99, 99, 99, 99 from pets where owner_id = '${U}' on conflict (pet_id, day) do update set fed = 99, foods = '{a,b,c,d}', fgroups = '{rau,dam,tinhbot}', bath = 99, ball = 99, pet = 99, talk = 99, sleep = 99`);
    const board = await rpc('get_quests'); const q0 = board.quests[0];
    const before = await coins(); const r = await rpc('claim_quest', 0);
    expect(r.reward).toBe(boostedReward(q0.reward, 1.5)); expect(await coins()).toBe(before + r.reward);
  });
  it('không có sự kiện thì thưởng đúng bằng gốc; thưởng cả ngày nhân 50', async () => {
    await h.db.exec('delete from events');
    const board = await rpc('get_quests'); const before = await coins();
    const r = await rpc('claim_quest', 1); expect(r.reward).toBe(board.quests[1].reward); expect(await coins()).toBe(before + r.reward);
    await addEvent({ coin_boost: 2 });
    for (const i of [2, 3, 4]) await rpc('claim_quest', i);
    const c0 = await coins(); expect((await rpc('claim_quest_bonus')).reward).toBe(100); expect(await coins()).toBe(c0 + 100);
  });
  it('xu chăm sóc (có trần) không bị nhân', async () => {
    await h.db.exec('delete from events'); await addEvent({ coin_boost: 3 });
    await h.as(U); const before = await coins(); await h.q(`select pet_action('pet', null, 1)`);
    expect((await coins()) - before).toBeLessThanOrEqual(5);
  });
});
