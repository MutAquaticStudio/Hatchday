/** Thức ăn nâng cao trên Postgres thật (PGlite): món nấu, công thức, vườn rau, tủ lạnh và thức ăn hỏng, khẩu vị. Khớp client. */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { CROPS, DISHES, FOOD_BY_ID, FOODS, FRIDGE, readyAtMs, RECIPES, spoilLoss, WATER } from '../../src/game/catalog';

const U = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
let db: PGlite;
const q = async <T = any>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const one = async (sql: string, p: unknown[] = []) => Object.values((await q(sql, p))[0])[0] as any;
const as = (uid: string) => db.exec(`set request.uid = '${uid}'`);
const act = async (a: string, item: string | null = null, n = 1) => (await q<{ r: any }>('select pet_action($1, $2, $3) as r', [a, item, n]))[0].r;
const stock = async (id: string) => (await q('select qty from entitlements where owner_id = $1 and item_id = $2', [U, id]))[0]?.qty ?? 0;
const setStock = (id: string, n: number) => db.exec(`insert into entitlements (owner_id, item_id, source, qty) values ('${U}', '${id}', 'gift', ${n}) on conflict (owner_id, item_id) do update set qty = ${n}`);
const coins = async () => one('select coins from wallets where owner_id = $1', [U]);
const setCoins = (n: number) => db.exec(`update wallets set coins = ${n} where owner_id = '${U}'`);
const hungry = () => db.exec(`update pets set no = 10, vui = 50, nl = 90, asleep = false, stats_at = now() where owner_id = '${U}'; delete from action_log`);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;`);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users values ('${U}', 'a@x.vn')`);
  await as(U);
  await q("select * from create_pet('Mochi', 'Nhà Mây', 2)");
  await db.exec(`update pet_secrets set favorite_food = 'kem', disliked_food = 'che'`);
}, 60_000);

describe('đồng bộ với client', () => {
  it('món nấu, công thức, cây trồng trong SQL khớp catalog.ts', async () => {
    const dishes = await q("select id, name, effects, price_coins, source from items where kind = 'dish' order by id");
    expect(dishes).toEqual(DISHES.map(d => ({ id: d.id, name: d.name, effects: { no: d.no, vui: d.vui, group: d.group, group2: d.group2, fresh: true }, price_coins: null, source: 'cook' }))
      .sort((a, b) => (a.id < b.id ? -1 : 1)));
    expect(await q('select id, dish, a, b from recipes order by id')).toEqual([...RECIPES].sort((a, b) => (a.id < b.id ? -1 : 1)));
    expect(await q('select id, hours, seed, yield from crops order by id')).toEqual([...CROPS].sort((a, b) => (a.id < b.id ? -1 : 1)));
  });
  it('thức ăn tươi (rau, trái cây, đạm) và thức ăn khô (tinh bột, đồ ngọt) đúng như catalog', async () => {
    for (const f of FOODS) expect((await q('select effects from items where id = $1', [f.id]))[0].effects.fresh).toBe(f.group !== 'tinhbot' && f.group !== 'ngot');
  });
  it('mọi công thức dùng nguyên liệu mua được hoặc thu hoạch được, mỗi món nấu có đúng một công thức', () => {
    const base = new Set(FOODS.map(f => f.id));
    for (const r of RECIPES) { expect(base.has(r.a) && base.has(r.b)).toBe(true); expect(FOOD_BY_ID[r.dish].kind).toBe('dish'); }
    expect(new Set(RECIPES.map(r => r.dish)).size).toBe(DISHES.length);
    for (const c of CROPS) expect(base.has(c.id)).toBe(true);
  });
  it('16 công thức: không trùng cặp nguyên liệu, mỗi nguyên liệu dùng ít nhất một lần, mỗi món thuộc hai nhóm khác nhau', () => {
    expect(RECIPES).toHaveLength(16);
    expect(DISHES).toHaveLength(16);
    const pairs = RECIPES.map(r => [r.a, r.b].sort().join('+'));
    expect(new Set(pairs).size).toBe(RECIPES.length);
    for (const r of RECIPES) expect(r.a).not.toBe(r.b);
    const used = new Set(RECIPES.flatMap(r => [r.a, r.b]));
    for (const f of FOODS) expect(used.has(f.id)).toBe(true);
    expect(new Set(DISHES.map(d => d.name)).size).toBe(DISHES.length);
    for (const d of DISHES) { expect(d.group2).toBeDefined(); expect(d.group2).not.toBe(d.group); expect(d.no + d.vui).toBeGreaterThan(20); }
  });
  it('món nấu đáng nấu: no + vui không kém tổng hai nguyên liệu quá nhiều, và có nhóm lành mạnh', () => {
    for (const r of RECIPES) {
      const a = FOOD_BY_ID[r.a], b = FOOD_BY_ID[r.b], d = FOOD_BY_ID[r.dish];
      expect(d.no + d.vui).toBeGreaterThanOrEqual((a.no + a.vui + b.no + b.vui) * 0.55); // gọn một bữa thay vì hai
      expect(d.group !== 'ngot' || d.group2 !== 'ngot').toBe(true);
    }
  });
  it('số phần hỏng mỗi ngày giống spoilLoss()', async () => {
    for (const keep of FRIDGE.map(f => f.keep)) for (let n = 0; n <= 40; n++) expect(await one('select private.spoil_loss($1, $2)', [n, keep])).toBe(spoilLoss(n, keep));
  });
  it('món tủ và món ghét của bé chưa bao giờ là món nấu', async () => {
    for (let i = 0; i < 20; i++) {
      const id = `dddddddd-dddd-dddd-dddd-${String(i).padStart(12, '0')}`;
      await db.exec(`insert into auth.users values ('${id}', 'u${i}@x.vn'); set request.uid = '${id}'`);
      await q("select * from create_pet('B', 'N', 1)");
    }
    expect(await one("select count(*)::int from pet_secrets s join items i on i.id in (s.favorite_food, s.disliked_food) where i.kind <> 'food' and s.pet_id <> (select id from pets where owner_id = $1)", [U])).toBe(0);
    await as(U);
  });
});

describe('thức ăn hỏng và tủ lạnh', () => {
  const backdate = (days: number) => db.exec(`update wallets set spoil_day = private.local_day('${U}') - ${days} where owner_id = '${U}'`);
  it('lần đầu chỉ đặt mốc ngày, không hỏng gì', async () => {
    await setStock('carot', 12);
    const e = await one('select get_economy()');
    expect(e.spoiled).toEqual({});
    expect(await stock('carot')).toBe(12);
    expect(e.fridge_level).toBe(0);
  });
  it('qua 2 ngày: thức ăn tươi hỏng 1/4 phần vượt mức giữ mỗi ngày, thức ăn khô không hỏng', async () => {
    await setStock('carot', 12); await setStock('comnam', 12); await setStock('sua-chua', 3);
    await backdate(2);
    const e = await one('select get_economy()');
    expect(await stock('carot')).toBe(12 - spoilLoss(12, 3) - spoilLoss(12 - spoilLoss(12, 3), 3)); // 12 → 9 → 7
    expect(await stock('carot')).toBe(7);
    expect(e.spoiled).toEqual({ carot: 5 });
    expect(await stock('comnam')).toBe(12);
    expect(await stock('sua-chua')).toBe(3); // bằng mức giữ thì không hỏng
  });
  it('gọi lại trong cùng ngày thì không hỏng thêm', async () => {
    const e = await one('select get_economy()');
    expect(e.spoiled).toEqual({});
    expect(await stock('carot')).toBe(7);
  });
  it('tối đa 7 ngày dù vắng lâu hơn', async () => {
    await setStock('chuoi', 30); await backdate(60);
    await one('select get_economy()');
    let n = 30; for (let i = 0; i < 7; i++) n -= spoilLoss(n, 3);
    expect(await stock('chuoi')).toBe(n);
  });
  it('món nấu cũng hỏng', async () => {
    await setStock('salad', 11); await backdate(1);
    await one('select get_economy()');
    expect(await stock('salad')).toBe(11 - spoilLoss(11, 3));
  });
  it('mua tủ lạnh: cấp 1 giá 200 xu giữ 6 phần, cấp 2 giá 500 xu giữ 10 phần, hết cấp thì từ chối', async () => {
    await setCoins(100);
    await expect(q('select upgrade_fridge()')).rejects.toThrow(/not_enough_coins/);
    await setCoins(1000);
    expect(await one('select upgrade_fridge()')).toEqual({ coins: 800, fridge_level: 1 });
    await setStock('carot', 12); await db.exec(`update wallets set spoil_day = private.local_day('${U}') - 1`);
    await one('select get_economy()');
    expect(await stock('carot')).toBe(12 - spoilLoss(12, FRIDGE[1].keep));
    expect(await one('select upgrade_fridge()')).toEqual({ coins: 300, fridge_level: 2 });
    await expect(q('select upgrade_fridge()')).rejects.toThrow(/max_level/);
    expect(FRIDGE.map(f => f.price)).toEqual([0, 200, 500]);
  });
});

describe('vườn rau', () => {
  const plot = async (n: number) => (await q('select * from garden_plots where owner_id = $1 and plot = $2', [U, n]))[0];
  it('gieo hạt: trừ tiền hạt giống, ô đã có cây hoặc sai ô/cây/thiếu xu thì từ chối', async () => {
    await setCoins(100);
    expect(await one("select plant_crop(0, 'carot')")).toEqual({ coins: 100 - CROPS[0].seed });
    expect((await plot(0)).crop).toBe('carot');
    await expect(q("select plant_crop(0, 'chuoi')")).rejects.toThrow(/plot_busy/);
    await expect(q("select plant_crop(4, 'chuoi')")).rejects.toThrow(/invalid_plot/);
    await expect(q("select plant_crop(-1, 'chuoi')")).rejects.toThrow(/invalid_plot/);
    await expect(q("select plant_crop(1, 'comnam')")).rejects.toThrow(/unknown_crop/);
    await setCoins(1);
    await expect(q("select plant_crop(1, 'dua-hau')")).rejects.toThrow(/not_enough_coins/);
    expect(await plot(1)).toBeUndefined();
  });
  it('chưa đủ giờ thì chưa thu hoạch được, ô trống thì báo ô trống', async () => {
    await expect(q('select harvest_crop(0)')).rejects.toThrow(/not_ready/);
    await expect(q('select harvest_crop(3)')).rejects.toThrow(/plot_empty/);
    const g = await one('select get_garden()');
    expect(g.plots).toHaveLength(1);
    expect(g.plots[0]).toMatchObject({ plot: 0, crop: 'carot', ready: false });
  });
  it('đủ giờ: thu hoạch được đúng số phần, ô trống lại, tính cả nhiều loại cây', async () => {
    await setStock('carot', 0); await setCoins(100);
    await db.exec(`update garden_plots set planted_at = now() - interval '${CROPS[0].hours} hours' + interval '1 minute'`);
    await expect(q('select harvest_crop(0)')).rejects.toThrow(/not_ready/); // còn thiếu 1 phút
    await db.exec(`update garden_plots set planted_at = now() - interval '${CROPS[0].hours} hours'`);
    expect((await one('select get_garden()')).plots[0].ready).toBe(true);
    expect(await one('select harvest_crop(0)')).toEqual({ item: 'carot', qty: CROPS[0].yield, got: CROPS[0].yield });
    expect(await plot(0)).toBeUndefined();
    await q("select plant_crop(2, 'dua-hau')");
    await db.exec(`update garden_plots set planted_at = now() - interval '9 hours'`);
    await expect(q('select harvest_crop(2)')).rejects.toThrow(/not_ready/); // dưa hấu cần 10 giờ
  });
  it('kho đầy thì chỉ nhận phần còn chỗ, đầy hẳn thì từ chối và giữ nguyên cây', async () => {
    await db.exec(`delete from garden_plots`); await setCoins(100);
    await q("select plant_crop(0, 'carot')"); await db.exec(`update garden_plots set planted_at = now() - interval '5 hours'`);
    await setStock('carot', 29);
    expect((await one('select harvest_crop(0)')).got).toBe(1);
    await q("select plant_crop(0, 'carot')"); await db.exec(`update garden_plots set planted_at = now() - interval '5 hours'`);
    await setStock('carot', 30);
    await expect(q('select harvest_crop(0)')).rejects.toThrow(/stock_full/);
    expect(await plot(0)).toBeDefined();
  });
  it('anon không gọi được, chưa đăng nhập thì từ chối', async () => {
    expect(await one("select has_function_privilege('anon', 'public.plant_crop(int, text)', 'execute')")).toBe(false);
    await db.exec('reset request.uid');
    await expect(q('select get_garden()')).rejects.toThrow(/not_authenticated/);
    await as(U);
  });
});

describe('nấu ăn', () => {
  const stockAll = async () => { for (const f of FOODS) await setStock(f.id, 5); };
  it('thiếu nguyên liệu thì không nấu được', async () => {
    await stockAll(); await setStock('trung-op', 0);
    await expect(q("select cook('chao-trung')")).rejects.toThrow(/missing_ingredient/);
    expect(await stock('comnam')).toBe(5);
  });
  it('nấu: dùng một phần mỗi nguyên liệu, được một phần món nấu', async () => {
    await stockAll(); await setStock('chao-trung', 0);
    expect(await one("select cook('chao-trung')")).toEqual({ dish: 'chao-trung', qty: 1 });
    expect(await stock('comnam')).toBe(4); expect(await stock('trung-op')).toBe(4);
    expect(await one("select cook('chao-trung', 3)")).toEqual({ dish: 'chao-trung', qty: 4 });
    expect(await stock('comnam')).toBe(1);
  });
  it('công thức, số lượng, kho đầy: kiểm tra đúng', async () => {
    await stockAll();
    await expect(q("select cook('khong-co')")).rejects.toThrow(/unknown_recipe/);
    await expect(q("select cook('salad', 0)")).rejects.toThrow(/invalid_qty/);
    await expect(q("select cook('salad', 6)")).rejects.toThrow(/invalid_qty/);
    await setStock('salad', 29);
    await expect(q("select cook('salad', 2)")).rejects.toThrow(/stock_full/);
    expect(await stock('carot')).toBe(5); // không mất nguyên liệu khi bị từ chối
  });
  it('món nấu không mua được bằng buy_food', async () => {
    await expect(q("select buy_food('salad', 1)")).rejects.toThrow(/unknown_item/);
  });
});

describe('ăn món nấu và khẩu vị', () => {
  it('món nấu tính hai nhóm dinh dưỡng: salad (rau + trái cây) cộng đạm là ăn cân bằng', async () => {
    await db.exec('delete from day_logs'); await setStock('salad', 5); await setStock('trung-op', 5);
    await hungry(); const a = await act('feed', 'salad');
    expect(a.balanced).toBe(false); expect(a.stock).toBe(4);
    expect((await q('select fgroups from day_logs'))[0].fgroups).toEqual(['rau', 'traicay']);
    await hungry(); const b = await act('feed', 'trung-op');
    expect(b.balanced).toBe(true);
    expect(b.pet.vui - 50).toBeCloseTo(FOOD_BY_ID['trung-op'].vui + 3);
  });
  it('chưa ăn thử thì chưa biết khẩu vị', async () => {
    await db.exec("delete from memories where first_key like 'food-%'");
    const t = await one('select get_tastes()');
    expect(t).toEqual({ fav: null, dis: null, tried: 0, total: FOODS.length });
  });
  it('ăn món tủ thì lộ món tủ, ăn món ghét thì lộ món ghét và bị trừ Vui', async () => {
    await setStock('kem', 3); await setStock('che', 3);
    await hungry(); const k = await act('feed', 'kem');
    expect(k.fav).toBe(true); expect(k.dislike).toBe(false);
    expect(await one('select get_tastes()')).toEqual({ fav: 'kem', dis: null, tried: 1, total: FOODS.length });
    await hungry(); const c = await act('feed', 'che');
    expect(c.dislike).toBe(true); expect(c.fav).toBe(false);
    expect(c.balanced).toBe(true); // vẫn đang trong 3 ngày ăn đủ nhóm từ các bữa trước
    expect(c.pet.vui - 50).toBeCloseTo(FOOD_BY_ID.che.vui - 6 + 3);
    expect(await one('select get_tastes()')).toEqual({ fav: 'kem', dis: 'che', tried: 2, total: FOODS.length });
    expect(await one("select body from memories where first_key = 'food-che'")).toMatch(/không ưa/);
  });
  it('món nấu không làm lộ khẩu vị (không tính vào số món đã thử)', async () => {
    await setStock('chao-trung', 2); await hungry(); await act('feed', 'chao-trung');
    expect((await one('select get_tastes()')).tried).toBe(2);
  });
  it('bảng mới chỉ cho đọc, bật RLS', async () => {
    for (const t of ['recipes', 'crops', 'garden_plots']) {
      expect(await one('select relrowsecurity from pg_class where relname = $1', [t])).toBe(true);
      const pol = await q('select cmd from pg_policies where tablename = $1', [t]);
      expect(pol.map(x => x.cmd)).toEqual(['SELECT']);
    }
  });
});

describe('tưới nước', () => {
  const plant = async (plotN = 0, crop = 'carot') => { await db.exec('delete from garden_plots'); await setCoins(500); await q('select plant_crop($1, $2)', [plotN, crop]); };
  const garden = async () => (await one('select get_garden()')).plots[0];
  it('giờ chín theo số lần tưới giống readyAtMs()', async () => {
    for (const c of CROPS) for (let w = 0; w <= 3; w++) {
      const ms = Date.parse('2026-11-05T08:00:00Z');
      const sql = await one('select private.plot_ready_at($1::timestamptz, $2, $3)', ['2026-11-05T08:00:00Z', c.hours, w]);
      expect(new Date(sql).getTime()).toBe(Math.round(readyAtMs(ms, c.hours, w)));
    }
  });
  it('tưới nước rút ngắn 10% thời gian chín, hai lần tưới phải cách nhau 30 phút, tối đa 3 lần', async () => {
    await plant();
    const g0 = await garden();
    expect(g0).toMatchObject({ waters: 0, can_water: true, ready: false });
    const r1 = await one('select water_crop(0)');
    expect(r1.waters).toBe(1);
    const g1 = await garden();
    expect(Date.parse(g0.ready_at) - Date.parse(g1.ready_at)).toBe(WATER.cut * CROPS[0].hours * 3600000);
    expect(g1.can_water).toBe(false);
    await expect(q('select water_crop(0)')).rejects.toThrow(/too_soon/);
    for (const n of [2, 3]) {
      await db.exec(`update garden_plots set watered_at = now() - interval '31 minutes'`);
      expect((await one('select water_crop(0)')).waters).toBe(n);
    }
    await db.exec(`update garden_plots set watered_at = now() - interval '31 minutes'`);
    expect((await garden()).can_water).toBe(false);
    await expect(q('select water_crop(0)')).rejects.toThrow(/max_watered/);
    expect(WATER.max).toBe(3);
  });
  it('ô trống hoặc cây đã chín thì không tưới', async () => {
    await db.exec('delete from garden_plots');
    await expect(q('select water_crop(2)')).rejects.toThrow(/plot_empty/);
    await plant();
    await db.exec(`update garden_plots set planted_at = now() - interval '5 hours'`);
    await expect(q('select water_crop(0)')).rejects.toThrow(/already_ready/);
    expect((await garden()).can_water).toBe(false);
  });
  it('tưới đủ thì chín sớm hơn và hái được sớm hơn', async () => {
    await plant();
    await db.exec(`update garden_plots set planted_at = now() - interval '3 hours 50 minutes'`);
    await expect(q('select harvest_crop(0)')).rejects.toThrow(/not_ready/); // carot cần 4 giờ
    await db.exec(`update garden_plots set waters = 1`); // 4 giờ × 0,9 = 3 giờ 36 phút
    await setStock('carot', 0);
    expect((await one('select harvest_crop(0)')).got).toBe(CROPS[0].yield);
  });
  it('anon không gọi được, chưa đăng nhập thì từ chối', async () => {
    expect(await one("select has_function_privilege('anon', 'public.water_crop(int)', 'execute')")).toBe(false);
    await db.exec('reset request.uid');
    await expect(q('select water_crop(0)')).rejects.toThrow(/not_authenticated/);
    await as(U);
  });
});
