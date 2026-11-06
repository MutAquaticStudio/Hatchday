/** Hook sự kiện (giảm giá, mục tiêu cộng đồng, Mùa cúm lây + cách ly) và đồ chơi, trên Postgres thật. */
import { beforeAll, describe, expect, it } from 'vitest';
import { discountedPrice } from '../../src/game/events';
import { TOYS, TOY_BY_ID } from '../../src/game/toys';
import { createHarness, type Harness } from './harness';

const U = (n: number) => `72000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const A = U(1), B = U(2), C = U(3);
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const coins = async (u: string) => Number(await h.one('select coins from wallets where owner_id = $1', [u]));
const ev = (cfg: object, o: { enabled?: boolean; from?: string; to?: string } = {}) => h.db.exec(`delete from events; insert into events (title, kind, starts_at, ends_at, enabled, config) values ('thử', 'limited', now() + interval '${o.from ?? '-1 hour'}', now() + interval '${o.to ?? '1 day'}', ${o.enabled ?? true}, '${JSON.stringify(cfg)}')`);
const pet = (u: string) => `(select id from pets where owner_id = '${u}' and stage <> 'departed')`;
const setPet = (u: string, set: string) => h.db.exec(`update pets set ${set} where owner_id = '${u}' and stage <> 'departed'`);

beforeAll(async () => {
  h = await createHarness(); await h.addUsers(A, B, C);
  for (const [u, n] of [[A, 'An'], [B, 'Bình'], [C, 'Cúc']] as const) { await h.as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); }
}, 90_000);

describe('cấu hình sự kiện', () => {
  const bad = async (cfg: object) => expect(h.q('select private.validate_event_config($1::jsonb)', [JSON.stringify(cfg)])).rejects.toThrow('invalid_event_config');
  it('khoá mới hợp lệ và sai thì bị từ chối', async () => {
    for (const cfg of [{ shop_discount: { pct: 20, scope: 'food' } }, { epidemic: true }, { goal: { metric: 'feed', target: 100, reward_coins: 30 } }, { coin_boost: 1.5, banner: 'x' }])
      await h.q('select private.validate_event_config($1::jsonb)', [JSON.stringify(cfg)]);
    await bad({ shop_discount: { pct: 4, scope: 'food' } }); await bad({ shop_discount: { pct: 51, scope: 'food' } }); await bad({ shop_discount: { pct: 20.5, scope: 'food' } });
    await bad({ shop_discount: { pct: 20, scope: 'xe' } }); await bad({ epidemic: 'có' }); await bad({ goal: { metric: 'lạ', target: 100, reward_coins: 1 } });
    await bad({ goal: { metric: 'feed', target: 5, reward_coins: 1 } }); await bad({ goal: { metric: 'feed', target: 100, reward_coins: 501 } }); await bad({ khac: 1 });
  });
});

describe('giảm giá', () => {
  it('buy_food, buy_medicine, buy_item áp giảm giá đúng phạm vi; trả paid; ngoài thời gian/tắt thì không giảm', async () => {
    const food = await h.one("select id from items where kind = 'food' and price_coins is not null order by price_coins desc limit 1"), fp = Number(await h.one('select price_coins from items where id = $1', [food]));
    const med = await h.one("select id from items where kind = 'medicine' limit 1"), mp = Number(await h.one('select price_coins from items where id = $1', [med]));
    await h.db.exec(`update wallets set coins = 5000`); await h.as(A);
    await ev({ shop_discount: { pct: 20, scope: 'food' } });
    let c0 = await coins(A), r = await rpc('buy_food', food, 2); expect(r.paid).toBe(discountedPrice(fp, 20) * 2); expect(await coins(A)).toBe(c0 - r.paid);
    c0 = await coins(A); r = await rpc('buy_medicine', med, 1); expect(r.paid).toBe(mp); // thuốc không thuộc phạm vi
    await ev({ shop_discount: { pct: 50, scope: 'all' } }); c0 = await coins(A); r = await rpc('buy_medicine', med, 1); expect(r.paid).toBe(discountedPrice(mp, 50));
    const decor = (await h.q<{ id: string; price_coins: number }>("select id, price_coins from items where kind = 'decor' and source = 'market' and price_coins is not null and layer not in ('wallpaper', 'flooring') limit 1"))[0];
    r = await rpc('buy_item', decor.id); expect(r.paid).toBe(discountedPrice(decor.price_coins, 50));
    await ev({ shop_discount: { pct: 50, scope: 'all' } }, { enabled: false }); r = await rpc('buy_medicine', med, 1); expect(r.paid).toBe(mp);
    await ev({ shop_discount: { pct: 50, scope: 'all' } }, { from: '1 hour', to: '2 hours' }); r = await rpc('buy_medicine', med, 1); expect(r.paid).toBe(mp); // chưa bắt đầu
    await ev({ shop_discount: { pct: 50, scope: 'all' } }, { from: '-2 hours', to: '-1 hour' }); r = await rpc('buy_medicine', med, 1); expect(r.paid).toBe(mp); // đã hết
  });
  it('lấy mức lớn nhất khi có nhiều sự kiện; công thức làm tròn khớp discountedPrice (TS)', async () => {
    await h.db.exec(`delete from events; insert into events (title, kind, starts_at, ends_at, config) values
      ('a', 'limited', now() - interval '1 hour', now() + interval '1 day', '{"shop_discount":{"pct":10,"scope":"food"}}'), ('b', 'limited', now() - interval '1 hour', now() + interval '1 day', '{"shop_discount":{"pct":30,"scope":"all"}}')`);
    expect(await h.one("select private.event_discount('food')")).toBe(30);
    for (const pct of [5, 10, 15, 33, 50]) {
      await ev({ shop_discount: { pct, scope: 'food' } });
      for (const price of [1, 2, 3, 7, 15, 40, 99, 120, 333]) expect(await h.one("select private.discounted('food', $1)", [price]), `${price}/${pct}`).toBe(discountedPrice(price, pct));
    }
    await h.db.exec('delete from events'); expect(await h.one("select private.discounted('food', 40)")).toBe(40);
  });
});

describe('mục tiêu cộng đồng', () => {
  it('cộng khi đúng chỉ số, đạt mục tiêu, nhận một lần, cần đóng góp ≥ 5, chưa đạt thì chưa nhận', async () => {
    await ev({ goal: { metric: 'feed', target: 12, reward_coins: 30 } });
    const feed = async (u: string, n: number) => h.db.exec(`insert into action_log (pet_id, action) select ${pet(u)}, 'feed' from generate_series(1, ${n})`);
    await feed(A, 5); await h.db.exec(`insert into action_log (pet_id, action) select ${pet(A)}, 'talk'`); // talk không tính
    await h.as(A); let g = (await rpc('get_event_goal'))[0]; expect(g).toMatchObject({ count: 5, mine: 5, reached: false, target: 12, reward_coins: 30, metric: 'feed' });
    await expect(rpc('claim_event_goal', g.event_id)).rejects.toThrow('goal_not_reached');
    await feed(B, 3); await feed(C, 4);
    await h.as(B); g = (await rpc('get_event_goal'))[0]; expect(g).toMatchObject({ count: 12, mine: 3, reached: true });
    await expect(rpc('claim_event_goal', g.event_id)).rejects.toThrow('goal_not_contributed'); // mới đóng góp 3
    await h.as(A); const c0 = await coins(A); expect((await rpc('claim_event_goal', g.event_id)).reward).toBe(30); expect(await coins(A)).toBe(c0 + 30);
    await expect(rpc('claim_event_goal', g.event_id)).rejects.toThrow('already_claimed');
    expect((await rpc('get_event_goal'))[0]).toMatchObject({ claimed: true });
    await h.db.exec(`update events set starts_at = now() - interval '6 days', ends_at = now() - interval '4 days'`); expect(await rpc('get_event_goal')).toEqual([]); // quá 3 ngày sau khi kết thúc
    await h.db.exec(`update events set starts_at = now() - interval '3 days', ends_at = now() - interval '1 day'`); await h.as(C);
    expect(await rpc('get_event_goal')).toHaveLength(1); // vẫn còn trong 3 ngày để nhận
  });
  it('sự kiện tắt hoặc không có mục tiêu thì không đếm; chơi tính cả đồ chơi', async () => {
    await ev({ goal: { metric: 'play', target: 10, reward_coins: 0 } }); await h.db.exec('delete from event_goal; delete from event_goal_contrib');
    await h.db.exec(`insert into action_log (pet_id, action) select ${pet(A)}, a from unnest(array['play_ball', 'play_spin']) a`);
    await h.db.exec(`insert into action_log (pet_id, action, detail) select ${pet(A)}, 'play_toy', 'bubbles'`);
    expect(Number(await h.one('select count from event_goal'))).toBe(3);
    await ev({ goal: { metric: 'play', target: 10, reward_coins: 0 } }, { enabled: false }); await h.db.exec('delete from event_goal');
    await h.db.exec(`insert into action_log (pet_id, action) select ${pet(A)}, 'play_ball'`); expect(Number(await h.one('select count(*) from event_goal'))).toBe(0);
  });
});

describe('đồ chơi', () => {
  it('bảng toys khớp toys.ts', async () => {
    const rows = await h.q<any>('select * from toys order by id'), ts = [...TOYS].sort((a, b) => a.id.localeCompare(b.id));
    expect(rows.map((r: any) => r.id)).toEqual(ts.map(t => t.id));
    for (const r of rows) {
      const t = TOY_BY_ID[r.id];
      expect({ name: r.name, place: r.place, vui: r.vui, nl: r.nl, no: r.no, bond: r.bond_unlock, cap: r.daily_cap, price: r.price_coins, memory: r.first_memory }, r.id)
        .toEqual({ name: t.name, place: t.place, vui: t.vui, nl: t.nl, no: t.no, bond: t.bond, cap: t.cap, price: t.price, memory: t.memory });
      expect(r.drift, r.id).toEqual(t.drift);
    }
  });
  it('mở khoá Gắn bó, hiệu ứng, giảm một nửa từ lượt 3, trần ngày, ký ức đầu tiên, trôi cá tính, xu chăm sóc', async () => {
    await h.db.exec('delete from events'); await h.as(A);
    await setPet(A, 'bond_xp = 0, vui = 50, nl = 90, no = 60, asleep = false, illness = null, sick_since = null, recover_at = null');
    await expect(rpc('play_toy', 'bubbles')).rejects.toThrow('toy_locked'); await expect(rpc('play_toy', 'khong-co')).rejects.toThrow('unknown_toy');
    await setPet(A, 'bond_xp = 80, personality = \'{"energy":0,"social":0,"curious":0,"playful":0,"affection":0}\''); // cấp 3
    await h.db.exec(`update wallets set earned_today = 0, earned_day = null where owner_id = '${A}'`);
    let r = await rpc('play_toy', 'bubbles'); expect(r.refused).toBeNull(); expect(r.new_memory).toBe(true); expect(r.left).toBe(5); expect(r.earned).toBe(5);
    expect(r.pet.vui).toBeCloseTo(55, 1); expect(r.pet.nl).toBeCloseTo(88, 1); expect(r.pet.no).toBeCloseTo(59, 1);
    expect(await h.one("select detail from action_log where pet_id = " + pet(A) + " and action = 'play_toy' limit 1")).toBe('bubbles');
    expect(await h.one('select personality ->> \'playful\' from pets where owner_id = $1 and stage <> \'departed\'', [A])).toBe('0.3');
    await rpc('play_toy', 'bubbles'); r = await rpc('play_toy', 'bubbles'); expect(r.mult).toBe(0.5); expect(r.new_memory).toBe(false);
    expect(Number(r.pet.vui) - 60).toBeCloseTo(2.5 + 0, 1); // lượt 3: +5 × 0.5
    await setPet(A, 'nl = 90, vui = 10');
    for (let i = 0; i < 3; i++) await rpc('play_toy', 'bubbles'); // tổng 6 lượt
    expect((await rpc('play_toy', 'bubbles')).refused).toBe('toy_cap'); // trần 6/ngày
    await expect(rpc('play_toy', 'train')).rejects.toThrow('toy_locked'); // cấp 3 chưa đủ cấp 5
    await setPet(A, 'bond_xp = 170, nl = 10'); expect((await rpc('play_toy', 'swing')).refused).toBe('tired');
    await setPet(A, 'nl = 90, asleep = true'); expect((await rpc('play_toy', 'swing')).refused).toBe('asleep');
  });
  it('bé ốm bị chặn; đồ mang theo phải mua (có giảm giá), mua một lần', async () => {
    await h.as(A); await setPet(A, "asleep = false, nl = 90, illness = 'cang-co', sick_since = now(), recover_at = now() + interval '2 hours'");
    await expect(rpc('play_toy', 'swing')).rejects.toThrow('sick_blocked');
    await setPet(A, 'illness = null, sick_since = null, recover_at = null'); await h.db.exec(`update wallets set coins = 1000 where owner_id = '${A}'`);
    await expect(rpc('play_toy', 'frisbee')).rejects.toThrow('toy_not_owned'); await expect(rpc('buy_toy', 'bubbles')).rejects.toThrow('unknown_toy'); // đồ cố định không bán
    await ev({ shop_discount: { pct: 25, scope: 'toy' } }); const r = await rpc('buy_toy', 'frisbee'); expect(r.paid).toBe(discountedPrice(120, 25)); expect(r.coins).toBe(1000 - r.paid);
    await expect(rpc('buy_toy', 'frisbee')).rejects.toThrow('already_owned');
    await h.db.exec('delete from events'); await setPet(A, 'nl = 90, vui = 20');
    expect((await rpc('play_toy', 'frisbee')).pet.vui).toBeCloseTo(28, 1);
    expect(await rpc('get_toys')).toMatchObject({ owned: ['frisbee'], used: { frisbee: 1 } });
    await h.db.exec(`update wallets set coins = 10 where owner_id = '${A}'`); await expect(rpc('buy_toy', 'puzzle')).rejects.toThrow('not_enough_coins');
  });
});

describe('Mùa cúm', () => {
  const tzFor = async (hour: number) => { const off = ((hour - Number(await h.one("select extract(hour from now() at time zone 'utc')"))) % 24 + 24) % 24; return off <= 14 ? `Etc/GMT-${off}` : `Etc/GMT+${24 - off}`; };
  it('cảm lạnh dễ hơn: 1 lượt chơi từ 20:00 trong Mùa cúm (bình thường cần 2 lượt từ 22:00)', async () => {
    const tz = await tzFor(21); await h.db.exec(`update profiles set timezone = '${tz}' where id = '${C}'`);
    await h.db.exec('delete from events'); await h.as(C); await setPet(C, "illness = null, sick_since = null, recover_at = null, nl = 90, asleep = false, bond_xp = 200");
    await h.db.exec(`delete from action_log where pet_id = ${pet(C)}; update pets set illness = null where owner_id = '${C}'`);
    await h.db.exec(`insert into action_log (pet_id, action) select ${pet(C)}, 'play_ball'`); expect(await h.one('select illness from pets where owner_id = $1 and stage <> \'departed\'', [C])).toBeNull(); // 21h, không có sự kiện, 1 lượt: chưa ốm
    await ev({ epidemic: true }); await h.db.exec(`delete from action_log where pet_id = ${pet(C)}`);
    await h.db.exec(`insert into action_log (pet_id, action) select ${pet(C)}, 'play_ball'`); expect(await h.one('select illness from pets where owner_id = $1 and stage <> \'departed\'', [C])).toBe('cam-lanh');
    await h.db.exec(`update profiles set timezone = 'Asia/Ho_Chi_Minh' where id = '${C}'`);
  });
  it('lây giữa người chơi: cạnh bé đang cảm lạnh đủ 300 giây thì bị lây, 1 lần/ngày, miễn nhiễm sau khi khỏi, tắt sự kiện thì không lây', async () => {
    await ev({ epidemic: true });
    await setPet(C, "illness = 'cam-lanh', sick_since = now() - interval '30 minutes', recover_at = now() + interval '3 hours'");
    await setPet(A, "illness = null, sick_since = null, recover_at = null, asleep = false, nl = 80"); await setPet(B, "illness = null, sick_since = null, recover_at = null, asleep = false");
    await h.db.exec(`delete from place_members; delete from infection_log; delete from place_exposure; delete from illness_log;
      insert into place_members (user_id, place, shard, topic) values ('${C}', 'plaza', 1, 'plaza:1'), ('${A}', 'plaza', 1, 'plaza:1'), ('${B}', 'park', 1, 'park:1')`);
    const beat = async (u: string) => { await h.db.exec(`update place_members set last_seen = now() - interval '40 seconds' where user_id = '${u}'; update place_members set last_seen = now() where user_id = '${C}'`); await h.as(u); return rpc('place_heartbeat'); };
    for (let i = 0; i < 7; i++) expect((await beat(A)).infected).toBe(false);
    expect(Number(await h.one('select secs from place_exposure where user_id = $1', [A]))).toBeGreaterThanOrEqual(240);
    expect((await beat(A)).infected).toBe(true); // 8 × 40 = 320 giây
    expect(await h.one('select illness from pets where owner_id = $1 and stage <> \'departed\'', [A])).toBe('cam-lanh');
    expect(Number(await h.one('select count(*) from infection_log where user_id = $1', [A]))).toBe(1);
    for (let i = 0; i < 9; i++) expect((await beat(B)).infected).toBe(false); // ở kênh khác thì không lây
    await h.db.exec(`update pets set illness = null, sick_since = null, recover_at = null where owner_id = '${A}' and stage <> 'departed'; delete from infection_log`); // khỏi (ghi illness_log đóng)
    for (let i = 0; i < 9; i++) expect((await beat(A)).infected).toBe(false); // miễn nhiễm 12 giờ
    await h.db.exec(`update illness_log set ended_at = now() - interval '13 hours' where owner_id = '${A}'; delete from place_exposure`);
    for (let i = 0; i < 8; i++) await beat(A);
    expect(await h.one('select illness from pets where owner_id = $1 and stage <> \'departed\'', [A])).toBe('cam-lanh'); // hết miễn nhiễm, bị lây lại
    await h.db.exec(`update pets set illness = null, sick_since = null, recover_at = null where owner_id = '${A}' and stage <> 'departed'; update illness_log set ended_at = now() - interval '20 hours'; delete from place_exposure`);
    for (let i = 0; i < 9; i++) expect((await beat(A)).infected).toBe(false); // đã bị lây hôm nay (infection_log) nên không lây lần hai
    await h.db.exec('delete from events; delete from infection_log; delete from place_exposure; update illness_log set ended_at = now() - interval \'20 hours\'');
    for (let i = 0; i < 9; i++) expect((await beat(A)).infected).toBe(false); // hết sự kiện thì không lây
  });
  it('cách ly: chỉ khi bé ốm; bật rồi không vào được nơi chung và bị đưa ra; tắt thì vào lại', async () => {
    await h.as(B); await expect(rpc('set_isolation', true)).rejects.toThrow('not_sick'); expect(await rpc('get_isolation')).toEqual({ isolating: false });
    await setPet(B, "illness = 'cam-lanh', sick_since = now(), recover_at = now() + interval '4 hours'");
    await h.db.exec(`insert into place_members (user_id, place, shard, topic) values ('${B}', 'plaza', 1, 'plaza:1') on conflict (user_id) do update set topic = excluded.topic`);
    expect(await rpc('set_isolation', true)).toEqual({ isolating: true }); expect(await rpc('get_isolation')).toEqual({ isolating: true });
    expect(Number(await h.one('select count(*) from place_members where user_id = $1', [B]))).toBe(0);
    await expect(h.db.exec(`insert into place_members (user_id, place, shard, topic) values ('${B}', 'plaza', 1, 'plaza:1')`)).rejects.toThrow('isolating');
    expect(await rpc('set_isolation', false)).toEqual({ isolating: false });
    await h.db.exec(`insert into place_members (user_id, place, shard, topic) values ('${B}', 'plaza', 1, 'plaza:1')`);
    await rpc('set_isolation', true); await setPet(B, 'illness = null, sick_since = null, recover_at = null'); expect(await rpc('get_isolation')).toEqual({ isolating: false }); // khỏi bệnh thì hết cách ly
  });
});
