/** Trang trí, trang phục, xu, nhiệm vụ, sổ sưu tập — trên Postgres thật (PGlite). */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, FOODS, ITEMS } from '../../src/game/catalog';
import { comfortLevel, comfortScore, isWeekend, QUEST_POOL, questsForDay, rotationForDay } from '../../src/game/layout';

const U = '33333333-3333-3333-3333-333333333333';
let db: PGlite;
const q = async <T = any>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const one = async (sql: string, p: unknown[] = []) => Object.values((await q(sql, p))[0])[0] as any;
const coins = () => one('select coins from wallets');
const today = async () => String(await one("select private.local_day($1)::text", [U]));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;`);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users values ('${U}', 'c@x.vn'); set request.uid = '${U}'`);
  await q("select * from create_pet('Mochi', 'Nhà Mây', 0)");
}, 60_000);

describe('đồng bộ với client', () => {
  it('danh mục trong SQL khớp catalog.ts', async () => {
    const rows = await q("select id, kind, name, layer, slot, w, d, comfort, theme, tags, price_coins, source, rarity from items where kind not in ('food', 'dish', 'medicine') order by id");
    const want = ITEMS.map(i => ({ id: i.id, kind: i.kind, name: i.name, layer: i.layer ?? null, slot: i.slot ?? null, w: i.w ?? null, d: i.d ?? null,
      comfort: i.comfort ?? 0, theme: i.theme ?? null, tags: i.tags ?? [], price_coins: i.price, source: i.source, rarity: i.rarity }))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(rows).toEqual(want);
  });
  it('tiệm xoay vòng, cấp thoải mái và nhiệm vụ tính giống client', async () => {
    for (const d of ['2026-11-05', '2026-11-06', '2027-01-01']) {
      expect(await one('select private.rotation($1::date)', [d])).toEqual(rotationForDay(d));
      expect(await one('select private.is_weekend($1::date)', [d])).toBe(isWeekend(d));
    }
    expect(await one('select private.comfort_level($1::jsonb)', [JSON.stringify(DEFAULT_LAYOUT)])).toBe(comfortLevel(comfortScore(DEFAULT_LAYOUT)));
    const qs = await one('select get_quests()');
    expect(qs.quests.map((x: any) => x.quest)).toEqual(questsForDay(await today()));
  });
});

describe('tạo thú', () => {
  it('có ví 300 xu, đồ khởi đầu, bố cục mặc định, sở thích', async () => {
    expect(await coins()).toBe(300);
    expect(await one("select count(*)::int from entitlements where source = 'starter'")).toBe(ITEMS.filter(i => i.source === 'starter').length + FOODS.length);
    expect((await one('select layout from room_layouts where slot = 0')).items).toHaveLength(4);
    const g = await one('select genes from pets');
    expect(g.likes).toHaveLength(2);
    expect(g.likes).not.toContain(g.dislike);
    expect(await one('select comfort_level from pets')).toBe(2);
  });
});

describe('mua đồ', () => {
  it('mua đồ ở chợ: trừ xu, tăng số lượng, mua được nhiều bản', async () => {
    expect((await one("select buy_item('ghe-dau')")).coins).toBe(180);
    expect((await one("select buy_item('ghe-dau')")).qty).toBe(2);
    expect(await coins()).toBe(60);
  });
  it('thiếu xu thì không mua được', async () => {
    await expect(q("select buy_item('ke-sach')")).rejects.toThrow(/not_enough_coins/);
    expect(await coins()).toBe(60);
  });
  it('đồ khởi đầu, sự kiện, xoay vòng không có hôm nay, cuối tuần ngày thường: không bán', async () => {
    await db.exec('update wallets set coins = 5000');
    await expect(q("select buy_item('o-rom')")).rejects.toThrow(/not_for_sale/);
    await expect(q("select buy_item('cay-dao')")).rejects.toThrow(/not_for_sale/);
    const rot = rotationForDay(await today());
    const off = ITEMS.find(i => i.source === 'rotating' && !rot.includes(i.id))!;
    await expect(q('select buy_item($1)', [off.id])).rejects.toThrow(/not_for_sale/);
    expect((await one('select buy_item($1)', [rot[0]])).qty).toBe(1);
    if (isWeekend(await today())) expect((await one("select buy_item('cay-lon')")).qty).toBe(1);
    else await expect(q("select buy_item('cay-lon')")).rejects.toThrow(/not_for_sale/);
  });
  it('trang phục chỉ mua một lần', async () => {
    await q("select buy_item('mu-len')");
    await expect(q("select buy_item('mu-len')")).rejects.toThrow(/already_owned/);
  });
});

describe('bố cục phòng', () => {
  const lay = (items: any[], extra = {}) => JSON.stringify({ wallpaper: 'giay-cham-hong', flooring: 'san-go', items, ...extra });
  it('lưu bố cục hợp lệ, cập nhật cấp thoải mái', async () => {
    const r = await one('select save_room_layout(1, $1::jsonb, true)', [lay([...DEFAULT_LAYOUT.items, { id: 'ghe-dau', c: 0, r: 4, rot: 0 }, { id: 'ghe-dau', c: 1, r: 4, rot: 0 }])]);
    expect(r.comfort_level).toBe(2);
    expect(await one('select active_layout from profiles')).toBe(1);
  });
  it('đặt nhiều hơn số đang có, đồ chưa mua, ngoài lưới: bị chặn', async () => {
    const three = [0, 1, 2].map(c => ({ id: 'ghe-dau', c, r: 4, rot: 0 }));
    await expect(q('select save_room_layout(1, $1::jsonb)', [lay(three)])).rejects.toThrow(/not_owned/);
    await expect(q('select save_room_layout(1, $1::jsonb)', [lay([{ id: 'sofa-hong', c: 0, r: 0, rot: 0 }])])).rejects.toThrow(/not_owned/);
    await expect(q('select save_room_layout(1, $1::jsonb)', [lay([{ id: 'o-rom', c: 7, r: 0, rot: 0 }])])).rejects.toThrow(/invalid_layout/);
    await expect(q('select save_room_layout(1, $1::jsonb)', [lay([], { wallpaper: 'giay-sao' })])).rejects.toThrow(/not_owned/);
  });
});

describe('trang phục', () => {
  it('mặc đồ đã có đúng vị trí', async () => {
    expect(await one(`select equip_outfit('{"head": "mu-len", "neck": null}'::jsonb)`)).toEqual({ head: 'mu-len' });
    expect(await one('select outfit from pets')).toEqual({ head: 'mu-len' });
  });
  it('sai vị trí hoặc chưa có thì bị chặn', async () => {
    await expect(q(`select equip_outfit('{"face": "mu-len"}'::jsonb)`)).rejects.toThrow(/not_owned/);
    await expect(q(`select equip_outfit('{"back": "canh"}'::jsonb)`)).rejects.toThrow(/not_owned/);
    await expect(q(`select equip_outfit('{"tail": "mu-len"}'::jsonb)`)).rejects.toThrow(/invalid_outfit/);
  });
  it('lưu bộ phối', async () => {
    await q(`select save_outfit_preset(2, '{"head": "no-hong"}'::jsonb)`);
    expect((await one('select outfit_presets from pets'))[2]).toEqual({ head: 'no-hong' });
  });
});

describe('xu, nhiệm vụ, sổ sưu tập', () => {
  it('chăm sóc được 5 xu, tối đa 50 xu mỗi ngày', async () => {
    await db.exec('update wallets set coins = 0, earned_today = 0; update pets set no = 10, nl = 90, asleep = false, stats_at = now(); delete from action_log');
    const r = await one("select pet_action('feed', 'carot')");
    expect(r.earned).toBe(5);
    for (let i = 0; i < 12; i++) await q("select pet_action('talk')");
    expect(await coins()).toBe(50);
    expect((await one("select pet_action('talk')")).earned).toBe(0);
  });
  it('nhiệm vụ chưa xong không nhận được, xong thì nhận đúng thưởng của nhiệm vụ một lần', async () => {
    await db.exec(`update day_logs set fed = 0, bath = 0, ball = 0, pet = 0, talk = 0, sleep = 0, foods = '{}', fgroups = '{}'`);
    await expect(q('select claim_quest(0)')).rejects.toThrow(/quest_not_done/);
    // đủ mọi loại nhiệm vụ (kể cả "ăn 3 món khác nhau"), để bộ nhiệm vụ của ngày nào cũng xong
    await db.exec(`update day_logs set fed = 9, bath = 9, ball = 9, pet = 99, talk = 9, sleep = 9, foods = '{${FOODS.slice(0, 4).map(f => f.id).join(',')}}'`);
    const before = await coins(), first = QUEST_POOL[questsForDay(await today())[0]];
    expect((await one('select claim_quest(0)')).coins).toBe(before + first.reward);
    await expect(q('select claim_quest(0)')).rejects.toThrow(/already_claimed/);
  });
  it('sổ sưu tập: thiếu món thì chưa nhận, đủ bộ thì nhận 150 xu và ghi ký ức', async () => {
    await expect(q("select claim_collection('pho-cu')")).rejects.toThrow(/collection_incomplete/);
    await db.exec(`insert into entitlements (owner_id, item_id, source) select '${U}', id, 'gift' from items where theme = 'pho-cu' on conflict do nothing`);
    const before = await coins();
    expect((await one("select claim_collection('pho-cu')")).coins).toBe(before + 150);
    expect(await one("select count(*)::int from memories where first_key = 'collection-pho-cu'")).toBe(1);
    await expect(q("select claim_collection('le-hoi')")).rejects.toThrow(/invalid_theme/);
  });
  it('phòng thoải mái hơn thì Vui giảm chậm hơn', async () => {
    await db.exec("update pets set vui = 100, comfort_level = 5, stats_at = now() - interval '100 minutes'");
    const hi = (await q('select * from get_my_pet()'))[0].vui;
    await db.exec("update pets set vui = 100, comfort_level = 1, stats_at = now() - interval '100 minutes'");
    const lo = (await q('select * from get_my_pet()'))[0].vui;
    expect(hi).toBeGreaterThan(lo);
  });
  it('anon không gọi được RPC mới', async () => {
    expect(await one("select has_function_privilege('anon', 'public.buy_item(text)', 'execute')")).toBe(false);
  });
});
