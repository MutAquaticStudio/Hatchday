/** Thu mua nông sản (sell_food) trên Postgres thật: giá, trần ngày, kho, quyền. Khớp catalog.ts. */
import { beforeAll, describe, expect, it } from 'vitest';
import { FOODS, SELL, sellPrice } from '../../src/game/catalog';
import { createHarness, type Harness } from './harness';
import { noonTz } from './util';

const U = '10000000-0000-4000-8000-0000000000a1';
const V = '10000000-0000-4000-8000-0000000000a2';
let h: Harness;
const sell = async (id: string, n: number) => (await h.q<{ r: any }>('select sell_food($1, $2) as r', [id, n]))[0].r;
const give = (id: string, n: number) => h.db.exec(`insert into entitlements (owner_id, item_id, source, qty) values ('${U}', '${id}', 'gift', ${n}) on conflict (owner_id, item_id) do update set qty = ${n}`);

beforeAll(async () => {
  h = await createHarness();
  await h.addUsers(U, V);
  await h.as(U);
  await h.q("select * from create_pet('Mochi', 'Nhà Mây', 1)");
  await h.db.exec(`update profiles set timezone = '${noonTz()}' where id = '${U}'`);
}, 90_000);

describe('giá thu mua khớp client', () => {
  it('mọi món: floor(giá × 0,4)', async () => {
    for (const f of FOODS) expect(await h.one('select private.sell_price($1)', [f.price]), f.id).toBe(sellPrice(f.price));
  });
});

describe('bán thức ăn', () => {
  it('bán 1 phần: trừ kho, cộng xu đúng giá, ghi nhật ký ngày', async () => {
    const f = FOODS.find(x => x.price >= 20)!;
    await give(f.id, 5);
    const c0 = await h.one('select coins from wallets where owner_id = $1', [U]);
    const r = await sell(f.id, 2);
    expect(r.got).toBe(sellPrice(f.price) * 2); expect(r.qty).toBe(3); expect(r.coins).toBe(c0 + r.got); expect(r.today).toBe(r.got); expect(r.cap).toBe(SELL.dailyCap);
    expect((await h.one('select get_sell_state()')).today).toBe(r.got);
  });
  it('không bán được món không có, không đủ phần, số lượng sai, món nấu hay thuốc', async () => {
    await expect(sell('carot', 31)).rejects.toThrow('invalid_qty');
    await expect(sell('carot', 0)).rejects.toThrow('invalid_qty');
    await give('carot', 1);
    await expect(sell('carot', 2)).rejects.toThrow('not_owned');
    await expect(sell('chao-trung', 1)).rejects.toThrow('unknown_item');
    await expect(sell('tra-gung', 1)).rejects.toThrow('unknown_item');
    await expect(sell('khong-co', 1)).rejects.toThrow('unknown_item');
  });
  it('trần 80 xu mỗi ngày: vượt thì từ chối, kho không đổi', async () => {
    await h.db.exec(`delete from sell_log where owner_id = '${U}'`);
    const f = FOODS.reduce((a, b) => (b.price > a.price ? b : a));
    await give(f.id, 30);
    const per = sellPrice(f.price), n = Math.floor(SELL.dailyCap / per);
    await sell(f.id, n);
    await expect(sell(f.id, 30 - n)).rejects.toThrow('sell_cap');
    expect(Number(await h.one('select qty from entitlements where owner_id = $1 and item_id = $2', [U, f.id]))).toBe(30 - n);
  });
  it('sang ngày mới thì bán lại được', async () => {
    await h.db.exec(`update sell_log set day = day - 1 where owner_id = '${U}'`);
    expect((await h.one('select get_sell_state()')).today).toBe(0);
  });
  it('người chưa có thú vẫn dùng được nhưng không bán được món không có; chưa đăng nhập thì lỗi', async () => {
    await h.as(V);
    await expect(sell('carot', 1)).rejects.toThrow('not_owned');
    await h.as(null);
    await expect(sell('carot', 1)).rejects.toThrow('not_authenticated');
    await h.as(U);
  });
  it('quyền thật: authenticated gọi được, anon không; không ghi thẳng vào sell_log', async () => {
    await give('carot', 3);
    await h.withRole(U, async () => { expect((await h.q<{ r: any }>("select sell_food('carot', 1) as r"))[0].r.qty).toBe(2); });
    await expect(h.withRole(U, () => h.q("insert into sell_log (owner_id, day, coins) values ($1, current_date + 5, 1)", [U]))).rejects.toThrow(/permission denied/);
    await expect(h.withRole(null, () => h.q("select sell_food('carot', 1)"), { role: 'anon' })).rejects.toThrow(/permission denied/);
    expect(Number(await h.withRole(U, async () => h.one('select count(*) from sell_log')))).toBeGreaterThan(0);
    expect(Number(await h.withRole(V, async () => h.one('select count(*) from sell_log')))).toBe(0); // RLS: không thấy của người khác
  });
});
