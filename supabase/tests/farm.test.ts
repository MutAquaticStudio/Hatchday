/** Trang trí nông trại trên Postgres thật (PGlite): mua đồ, lưu bố cục, chặn gian lận về sở hữu và phạm vi. */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/game/catalog';
import { isWeekend } from '../../src/game/layout';

const U = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
let db: PGlite;
const q = async <T = any>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const one = async (sql: string, p: unknown[] = []) => Object.values((await q(sql, p))[0])[0] as any;
const save = (items: unknown[]) => q('select save_farm_layout($1::jsonb)', [JSON.stringify({ items })]);
const FARM = ITEMS.filter(i => i.layer === 'farm');

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;`);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users values ('${U}', 'fm@x.vn'); set request.uid = '${U}'`);
  await q("select * from create_pet('Mochi', 'Nhà Mây', 0)");
  await db.exec('update wallets set coins = 10000');
}, 60_000);

describe('danh mục đồ nông trại', () => {
  it('12 món trong catalog.ts khớp bảng items, đều là decor layer farm, không tính điểm thoải mái', async () => {
    expect(FARM).toHaveLength(12);
    const rows = await q("select id, name, price_coins, source, rarity, comfort, theme from items where layer = 'farm' order by id");
    expect(rows).toEqual(FARM.map(i => ({ id: i.id, name: i.name, price_coins: i.price, source: i.source, rarity: i.rarity, comfort: 0, theme: null })).sort((a, b) => (a.id < b.id ? -1 : 1)));
    expect(new Set(FARM.map(i => i.name)).size).toBe(12);
  });
  it('mua được nhiều bản ở chợ, đồ xoay vòng/cuối tuần theo luật cửa hàng', async () => {
    expect((await one("select buy_item('bu-nhin')")).qty).toBe(1);
    expect((await one("select buy_item('bu-nhin')")).qty).toBe(2);
    expect((await one("select buy_item('dong-rom')")).qty).toBe(1);
    const day = String(await one('select private.local_day($1)::text', [U]));
    if (isWeekend(day)) expect((await one("select buy_item('coi-xay-gio')")).qty).toBe(1); // cối xay gió chỉ bán cuối tuần
    else await expect(q("select buy_item('coi-xay-gio')")).rejects.toThrow(/not_for_sale/);
  });
  it('đồ nông trại không đặt được trong phòng', async () => {
    const lay = { wallpaper: 'giay-cham-hong', flooring: 'san-go', items: [{ id: 'bu-nhin', c: 0, r: 0, rot: 0 }] };
    await expect(q('select save_room_layout(0, $1::jsonb)', [JSON.stringify(lay)])).rejects.toThrow(/invalid_layout/);
  });
});

describe('bố cục nông trại', () => {
  it('lưu bố cục hợp lệ và đọc lại', async () => {
    const items = [{ id: 'bu-nhin', x: -4.5, z: 0.5, rot: 0 }, { id: 'bu-nhin', x: 4.5, z: 0.5, rot: 1 }, { id: 'dong-rom', x: -5, z: 3, rot: 2 }];
    expect((await save(items))[0].save_farm_layout).toEqual({ count: 3 });
    expect((await q('select layout from farm_layouts'))[0].layout).toEqual({ items });
  });
  it('lưu lại thì thay hẳn bản cũ', async () => {
    await save([{ id: 'dong-rom', x: 5, z: 4, rot: 0 }]);
    expect((await q('select layout from farm_layouts'))[0].layout.items).toHaveLength(1);
    expect(await one('select count(*)::int from farm_layouts')).toBe(1);
  });
  it('đặt nhiều hơn số đang có hoặc món chưa mua thì bị chặn', async () => {
    await expect(save([{ id: 'dong-rom', x: 5, z: 4, rot: 0 }, { id: 'dong-rom', x: 5, z: 3, rot: 0 }])).rejects.toThrow(/not_owned/); // có 1
    await expect(save([{ id: 'gieng', x: 5, z: 4, rot: 0 }])).rejects.toThrow(/not_owned/);
  });
  it('sai loại, ngoài sân, xoay sai, quá nhiều món: bị chặn', async () => {
    await expect(save([{ id: 'o-rom', x: 0, z: 3, rot: 0 }])).rejects.toThrow(/invalid_layout/); // đồ trong phòng
    await expect(save([{ id: 'khong-co', x: 0, z: 3, rot: 0 }])).rejects.toThrow(/invalid_layout/);
    await expect(save([{ id: 'bu-nhin', x: 7, z: 3, rot: 0 }])).rejects.toThrow(/invalid_layout/);
    await expect(save([{ id: 'bu-nhin', x: 0, z: -5, rot: 0 }])).rejects.toThrow(/invalid_layout/);
    await expect(save([{ id: 'bu-nhin', x: 0, z: 6, rot: 0 }])).rejects.toThrow(/invalid_layout/);
    await expect(save([{ id: 'bu-nhin', x: 0, z: 3, rot: 4 }])).rejects.toThrow(/invalid_layout/);
    await db.exec(`update entitlements set qty = 99 where item_id = 'bu-nhin'`);
    await expect(save(Array.from({ length: 61 }, (_, i) => ({ id: 'bu-nhin', x: -5 + (i % 10), z: 3, rot: 0 })))).rejects.toThrow(/invalid_layout/);
    await expect(q("select save_farm_layout('{\"items\": \"x\"}'::jsonb)")).rejects.toThrow(/invalid_layout/);
  });
  it('bố cục rỗng cũng lưu được; anon không gọi được; chưa đăng nhập thì từ chối', async () => {
    expect((await save([]))[0].save_farm_layout).toEqual({ count: 0 });
    expect(await one("select has_function_privilege('anon', 'public.save_farm_layout(jsonb)', 'execute')")).toBe(false);
    await db.exec('reset request.uid');
    await expect(save([])).rejects.toThrow(/not_authenticated/);
  });
});
