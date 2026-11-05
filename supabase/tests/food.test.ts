/** Thức ăn (kho, mua, suất ăn, ăn cân bằng) và nhiệm vụ ngày/tuần/thưởng — trên Postgres thật (PGlite), khớp client. */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { FOOD_BY_ID, FOOD_STOCK, FOODS } from '../../src/game/catalog';
import { isBalanced } from '../../src/game/nutrition';
import { QUEST_BONUS, QUEST_POOL, questsForDay, weekStart, WEEKLY_POOL, weeklyForDay } from '../../src/game/layout';

const U = '88888888-8888-8888-8888-888888888888';
const V = '99999999-9999-9999-9999-999999999999';
let db: PGlite;
const q = async <T = any>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const one = async (sql: string, p: unknown[] = []) => Object.values((await q(sql, p))[0])[0] as any;
const as = (uid: string) => db.exec(`set request.uid = '${uid}'`);
const act = async (a: string, item: string | null = null, n = 1) => (await q<{ r: any }>('select pet_action($1, $2, $3) as r', [a, item, n]))[0].r;
const stock = async (id: string, uid = U) => (await q('select qty from entitlements where owner_id = $1 and item_id = $2', [uid, id]))[0]?.qty ?? 0;
const coins = async () => one('select coins from wallets where owner_id = $1', [U]);
const today = async () => String(await one('select private.local_day($1)::text', [U]));
const hungry = () => db.exec(`update pets set no = 10, vui = 50, nl = 90, asleep = false, stats_at = now() where owner_id = '${U}'; delete from action_log`);
const noLikes = () => db.exec(`update pet_secrets set favorite_food = 'kem', disliked_food = 'che'`);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;`);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users values ('${U}', 'f@x.vn'), ('${V}', 'g@x.vn')`);
  await as(U);
  await q("select * from create_pet('Mochi', 'Nhà Mây', 1)");
  await noLikes();
}, 60_000);

describe('đồng bộ với client', () => {
  it('thức ăn trong SQL khớp catalog.ts (tên, hiệu ứng, nhóm, giá)', async () => {
    const rows = await q("select id, name, effects, price_coins, source, rarity from items where kind = 'food' order by id");
    const want = FOODS.map(f => ({ id: f.id, name: f.name, effects: { no: f.no, vui: f.vui, group: f.group, fresh: f.fresh }, price_coins: f.price, source: 'market', rarity: 'thuong' }))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(rows).toEqual(want);
  });
  it('thứ Hai đầu tuần tính giống client', async () => {
    for (let n = 0; n < 400; n++) {
      const d = new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString().slice(0, 10);
      expect(String(await one('select private.week_start($1::date)::text', [d]))).toBe(weekStart(d));
    }
  });
  it('đủ 12 nhiệm vụ ngày, 6 nhiệm vụ tuần: mục tiêu và thưởng khớp client', async () => {
    const tzs = ['Etc/GMT+12', 'UTC', 'Pacific/Kiritimati']; // ba múi giờ cho ra ba ngày khác nhau
    const days = new Set<string>();
    for (const tz of tzs) {
      await db.exec(`update profiles set timezone = '${tz}' where id = '${U}'`);
      const b = await one('select get_quests()'), d = await today(); days.add(d);
      expect(b.day).toBe(d);
      expect(b.quests.map((x: any) => x.quest)).toEqual(questsForDay(d));
      for (const x of b.quests) { expect(x.target).toBe(QUEST_POOL[x.quest].target); expect(x.reward).toBe(QUEST_POOL[x.quest].reward); }
      expect(b.week).toBe(weekStart(d));
      expect(b.weekly.map((x: any) => x.quest)).toEqual(weeklyForDay(d));
      for (const x of b.weekly) { expect(x.target).toBe(WEEKLY_POOL[x.quest].target); expect(x.reward).toBe(WEEKLY_POOL[x.quest].reward); }
    }
    await db.exec(`update profiles set timezone = 'Asia/Ho_Chi_Minh' where id = '${U}'`);
    expect(days.size).toBeGreaterThanOrEqual(2);
  });
});

describe('kho thức ăn ban đầu', () => {
  it('bé mới được tặng 2 phần mỗi món, đều là quà khởi đầu', async () => {
    for (const f of FOODS) expect(await stock(f.id)).toBe(FOOD_STOCK.start);
    expect(await one("select count(*)::int from entitlements where owner_id = $1 and item_id in (select id from items where kind = 'food') and source = 'starter'", [U])).toBe(FOODS.length);
  });
});

describe('cho ăn', () => {
  it('mỗi lần ăn trừ 1 phần và trả về số phần còn lại', async () => {
    await hungry();
    const r = await act('feed', 'carot');
    expect(r.refused).toBeNull();
    expect(r.stock).toBe(1);
    expect(await stock('carot')).toBe(1);
  });
  it('hết phần thì không ăn được, kho không âm', async () => {
    await hungry(); await act('feed', 'carot');
    expect(await stock('carot')).toBe(0);
    await hungry();
    await expect(act('feed', 'carot')).rejects.toThrow(/not_owned/);
    expect(await stock('carot')).toBe(0);
  });
  it('bé đã no thì từ chối và không mất phần ăn', async () => {
    await db.exec(`update pets set no = 95, stats_at = now()`);
    const before = await stock('comnam');
    const r = await act('feed', 'comnam');
    expect(r.refused).toBe('full');
    expect(await stock('comnam')).toBe(before);
  });
  it('không cho ăn đồ không phải thức ăn', async () => {
    await expect(act('feed', 'ghe-dau')).rejects.toThrow(/unknown_item/);
  });
  it('ghi nhóm dinh dưỡng vào nhật ký ngày', async () => {
    await db.exec(`delete from day_logs; update entitlements set qty = 5 where item_id in (select id from items where kind = 'food')`);
    await hungry(); await act('feed', 'trung-op');
    await hungry(); await act('feed', 'kem');
    expect((await q('select fgroups, foods from day_logs'))[0]).toEqual({ fgroups: ['dam', 'ngot'], foods: ['Trứng ốp la', 'Kem que'] });
  });
});

describe('ăn cân bằng', () => {
  const reset = async () => { await db.exec(`delete from day_logs; update entitlements set qty = 5 where item_id in (select id from items where kind = 'food')`); };
  const feedVui = async (id: string) => { await hungry(); const r = await act('feed', id); return { r, gain: r.pet.vui - 50 }; };
  it('đủ 3 nhóm lành mạnh thì bữa đó Vui +3, đồ ngọt không tính', async () => {
    await reset();
    const a = await feedVui('carot'); expect(a.r.balanced).toBe(false); expect(a.gain).toBeCloseTo(FOOD_BY_ID.carot.vui);
    const b = await feedVui('kem'); expect(b.r.balanced).toBe(false);
    const c = await feedVui('comnam'); expect(c.r.balanced).toBe(false); // mới 2 nhóm lành mạnh
    const d = await feedVui('trung-op'); expect(d.r.balanced).toBe(true); expect(d.gain).toBeCloseTo(FOOD_BY_ID['trung-op'].vui + 3);
  });
  it('tính cả 2 ngày trước, ngày thứ 4 trở về trước thì không', async () => {
    const pid = await one('select id from pets');
    for (const [ago, want] of [[2, true], [3, false]] as const) {
      await reset();
      await q(`insert into day_logs (pet_id, owner_id, day, fgroups) values ($1, $2, private.local_day($2) - $3::int, '{rau,tinhbot}')`, [pid, U, ago]);
      const r = (await feedVui('trung-op')).r;
      expect(r.balanced).toBe(want);
      const logs = (await q('select day::text d, fgroups from day_logs')).map(x => ({ d: x.d, groups: x.fgroups }));
      expect(isBalanced(logs, await today())).toBe(want); // client tính giống
    }
  });
});

describe('mua thức ăn', () => {
  it('mua nhiều phần: trừ đúng xu, cộng vào kho', async () => {
    await db.exec(`update wallets set coins = 500; update entitlements set qty = 1 where item_id = 'banh-mi'`);
    const r = await one("select buy_food('banh-mi', 3)");
    expect(r).toEqual({ coins: 500 - 3 * FOOD_BY_ID['banh-mi'].price, qty: 4 });
    expect(await stock('banh-mi')).toBe(4);
  });
  it('thiếu xu, số lượng sai, kho đầy, món lạ: bị từ chối và không mất xu', async () => {
    await db.exec(`update wallets set coins = 10`);
    await expect(q("select buy_food('banh-mi', 1)")).rejects.toThrow(/not_enough_coins/);
    await db.exec(`update wallets set coins = 5000`);
    await expect(q("select buy_food('banh-mi', 0)")).rejects.toThrow(/invalid_qty/);
    await expect(q("select buy_food('banh-mi', 11)")).rejects.toThrow(/invalid_qty/);
    await expect(q("select buy_food('banh-mi', -2)")).rejects.toThrow(/invalid_qty/);
    await expect(q("select buy_food('ghe-dau', 1)")).rejects.toThrow(/unknown_item/);
    await expect(q("select buy_food('khong-co', 1)")).rejects.toThrow(/unknown_item/);
    await db.exec(`update entitlements set qty = ${FOOD_STOCK.max - 2} where item_id = 'chuoi'`);
    await expect(q("select buy_food('chuoi', 3)")).rejects.toThrow(/stock_full/);
    expect((await one("select buy_food('chuoi', 2)")).qty).toBe(FOOD_STOCK.max);
    expect(await coins()).toBe(5000 - 2 * FOOD_BY_ID.chuoi.price);
  });
  it('món trang trí không mua được bằng buy_food, thức ăn không mua được bằng buy_item', async () => {
    await expect(q("select buy_item('carot')")).rejects.toThrow(/unknown_item/);
  });
  it('chưa đăng nhập hoặc anon thì không mua được', async () => {
    expect(await one("select has_function_privilege('anon', 'public.buy_food(text, int)', 'execute')")).toBe(false);
    expect(await one("select has_function_privilege('anon', 'public.claim_ration()', 'execute')")).toBe(false);
    await db.exec('reset request.uid');
    await expect(q("select buy_food('carot', 1)")).rejects.toThrow(/not_authenticated/);
    await as(U);
  });
});

describe('suất ăn miễn phí', () => {
  it('nhận một lần mỗi ngày: +3 Cơm nắm, kho tối đa 30', async () => {
    await db.exec(`update entitlements set qty = 4 where item_id = 'comnam'`);
    expect((await one('select get_economy()')).ration_claimed).toBe(false);
    expect(await one('select claim_ration()')).toEqual({ item: 'comnam', qty: 4 + FOOD_STOCK.ration });
    expect((await one('select get_economy()')).ration_claimed).toBe(true);
    await expect(q('select claim_ration()')).rejects.toThrow(/already_claimed/);
    await db.exec(`delete from ration_claims; update entitlements set qty = 29 where item_id = 'comnam'`);
    expect((await one('select claim_ration()')).qty).toBe(FOOD_STOCK.max);
  });
  it('bảng mới bật RLS, chỉ cho chủ sở hữu đọc, không có chính sách ghi', async () => {
    for (const t of ['ration_claims', 'weekly_claims']) {
      const pol = await q('select cmd, qual from pg_policies where schemaname = $1 and tablename = $2', ['public', t]);
      expect(pol).toHaveLength(1);
      expect(pol[0].cmd).toBe('SELECT');
      expect(pol[0].qual).toMatch(/owner_id/);
    }
  });
});

describe('nhiệm vụ ngày và thưởng cả ngày', () => {
  const quests = async () => (await one('select get_quests()')).quests as any[];
  it('nhiệm vụ "món khác nhau" và "nhóm dinh dưỡng" đếm đúng', async () => {
    await db.exec(`delete from quest_claims; delete from day_logs`);
    const pid = await one('select id from pets');
    await q(`insert into day_logs (pet_id, owner_id, day, foods, fgroups) values ($1, $2, private.local_day($2), '{"Cơm nắm","Cơm nắm","Kem que"}', '{tinhbot,tinhbot,ngot}')`, [pid, U]);
    const fn = (k: string) => `select private.quest_progress(d, '${k}') from day_logs d`;
    expect(await one(fn('foods_distinct'))).toBe(2);
    expect(await one(fn('groups_distinct'))).toBe(2);
    expect(await one(fn('fed'))).toBe(0);
  });
  it('thưởng cả ngày chỉ nhận được sau khi nhận đủ 5 nhiệm vụ, và chỉ một lần', async () => {
    await db.exec(`delete from quest_claims; update day_logs set fed = 99, bath = 99, ball = 99, pet = 999, talk = 99, sleep = 99,
      foods = '{a,b,c,d}', fgroups = '{rau,dam,tinhbot,traicay}'`);
    await expect(q('select claim_quest_bonus()')).rejects.toThrow(/quest_not_done/);
    const qs = await quests(); let sum = 0;
    for (const x of qs.slice(0, 4)) { await q('select claim_quest($1)', [x.idx]); sum += x.reward; }
    await expect(q('select claim_quest_bonus()')).rejects.toThrow(/quest_not_done/);
    expect((await one('select get_quests()')).bonus.ready).toBe(false);
    const before = await coins();
    await q('select claim_quest(4)');
    expect(await coins()).toBe(before + qs[4].reward);
    expect((await one('select get_quests()')).bonus).toEqual({ reward: QUEST_BONUS, ready: true, claimed: false });
    const b = await one('select claim_quest_bonus()');
    expect(b.reward).toBe(QUEST_BONUS);
    expect(b.coins).toBe(before + qs[4].reward + QUEST_BONUS);
    await expect(q('select claim_quest_bonus()')).rejects.toThrow(/already_claimed/);
    expect((await one('select get_quests()')).bonus.claimed).toBe(true);
    expect(sum).toBeGreaterThan(0);
  });
  it('chỉ số nhiệm vụ sai bị chặn (kể cả số âm)', async () => {
    for (const i of [-1, 5, 99]) await expect(q('select claim_quest($1)', [i])).rejects.toThrow(/invalid_quest/);
  });
});

describe('nhiệm vụ tuần', () => {
  const week = async () => (await one('select get_quests()')).weekly as any[];
  it('tiến độ cộng dồn mọi ngày trong tuần, không tính tuần trước', async () => {
    await db.exec(`delete from weekly_claims; delete from day_logs`);
    const pid = await one('select id from pets'), d = await today(), ws = weekStart(d);
    const w = await week(), key = WEEKLY_POOL[w[0].quest].key;
    await q(`insert into day_logs (pet_id, owner_id, day, ${key}) values ($1, $2, $3::date, 7) on conflict (pet_id, day) do update set ${key} = 7`, [pid, U, ws]);
    await q(`insert into day_logs (pet_id, owner_id, day, ${key}) values ($1, $2, $3::date - 1, 50)`, [pid, U, ws]); // Chủ nhật tuần trước
    let p = (await week())[0].progress;
    expect(p).toBe(7);
    if (d !== ws) { await q(`insert into day_logs (pet_id, owner_id, day, ${key}) values ($1, $2, $3::date, 5) on conflict (pet_id, day) do update set ${key} = 5`, [pid, U, d]); p = (await week())[0].progress; expect(p).toBe(12); }
  });
  it('chưa đủ thì không nhận, đủ thì nhận đúng thưởng một lần', async () => {
    await db.exec(`delete from weekly_claims; update day_logs set fed = 0, ball = 0, talk = 0, pet = 0, bath = 0, sleep = 0`);
    await expect(q('select claim_weekly_quest(0)')).rejects.toThrow(/quest_not_done/);
    const w = await week();
    await db.exec(`update day_logs set fed = 500, ball = 500, talk = 500, pet = 500, bath = 500, sleep = 500 where day = (select max(day) from day_logs)`);
    const before = await coins();
    const r = await one('select claim_weekly_quest(1)');
    expect(r.reward).toBe(WEEKLY_POOL[w[1].quest].reward);
    expect(r.coins).toBe(before + r.reward);
    await expect(q('select claim_weekly_quest(1)')).rejects.toThrow(/already_claimed/);
    expect((await week())[1].claimed).toBe(true);
    expect((await week())[0].claimed).toBe(false);
  });
  it('chỉ số nhiệm vụ tuần sai bị chặn', async () => {
    for (const i of [-1, 3, 50]) await expect(q('select claim_weekly_quest($1)', [i])).rejects.toThrow(/invalid_quest/);
  });
});
