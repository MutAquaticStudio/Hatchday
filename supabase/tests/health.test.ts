/** Sức khoẻ trên Postgres thật (PGlite): 8 bệnh, điều kiện mắc, ảnh hưởng, thuốc, phòng khám, bệnh nặng; khớp health.ts. */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HEALTH, ILLNESS_BY_ID, ILLNESSES, MEDICINES } from '../../src/game/health';
import { decayStats } from '../../src/game/rules';
import { noonTz, tzForHour } from './util';

const U = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const V = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
let db: PGlite;
const q = async <T = any>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const one = async (sql: string, p: unknown[] = []) => Object.values((await q(sql, p))[0])[0] as any;
const as = (uid: string) => db.exec(`set request.uid = '${uid}'`);
const act = async (a: string, item: string | null = null, n = 1) => (await q<{ r: any }>('select pet_action($1, $2, $3) as r', [a, item, n]))[0].r;
const H = async () => (await q<{ h: any }>('select to_jsonb(h) as h from get_health() h'))[0].h;
const pet = async () => (await q('select * from pets where owner_id = $1', [U]))[0];
const coins = async () => one('select coins from wallets where owner_id = $1', [U]);
const give = (id: string, n: number) => db.exec(`insert into entitlements (owner_id, item_id, source, qty) values ('${U}', '${id}', 'gift', ${n}) on conflict (owner_id, item_id) do update set qty = ${n}`);
const setTz = (tz: string) => db.exec(`update profiles set timezone = '${tz}' where id = '${U}'`);
const failsWith = async (fn: () => Promise<unknown>, msg: string) => { await expect(fn()).rejects.toThrow(msg); };
/** Đưa thú về trạng thái khoẻ, đủ sức, xoá nhật ký. */
const reset = () => db.exec(`update pets set illness = null, sick_since = null, critical_since = null, recover_at = null, no = 70, sach = 70, vui = 70, nl = 90, asleep = false, stats_at = now() where owner_id = '${U}';
  delete from action_log; delete from day_logs; update wallets set coins = 1000 where owner_id = '${U}'; update profiles set timezone = '${noonTz()}' where id = '${U}'`);
const makeSick = (id: string, extra = '') => db.exec(`update pets set illness = '${id}'${extra.includes('sick_since') ? '' : ", sick_since = now() - interval '1 hour'"} ${extra} where owner_id = '${U}'`);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;`);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users values ('${U}', 'h@x.vn'), ('${V}', 'k@x.vn')`);
  await as(U);
  await q("select * from create_pet('Mochi', 'Nhà Mây', 1)");
  await db.exec(`update pet_secrets set favorite_food = 'carot', disliked_food = 'ca-vien'`);
}, 60_000);
beforeEach(async () => { await as(U); await reset(); });

describe('bảng bệnh và thuốc khớp health.ts', () => {
  it('bệnh: nhóm, hệ số giảm, việc bị chặn, cách khỏi, thuốc', async () => {
    const rows = await q("select id, family, decay, block, heal_kind, heal_stat, heal_hours::float as heal_hours, medicine from illnesses order by id");
    const want = ILLNESSES.map(i => ({ id: i.id, family: i.family, decay: i.decay, block: i.block, heal_kind: i.heal.kind,
      heal_stat: i.heal.kind === 'stat' ? i.heal.stat : null, heal_hours: i.heal.kind === 'balanced' ? null : i.heal.hours, medicine: i.medicine }))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(rows).toEqual(want);
  });
  it('thuốc: tên, bệnh chữa được, giá', async () => {
    const rows = await q("select id, name, effects, price_coins from items where kind = 'medicine' order by id");
    const want = MEDICINES.map(m => ({ id: m.id, name: m.name, effects: { cures: m.cures }, price_coins: m.price })).sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(rows).toEqual(want);
  });
});

describe('bệnh do bỏ bê', () => {
  it('chỉ số nguy kịch: bắt đầu đếm nhưng chưa ốm; được chăm lên thì xoá đồng hồ', async () => {
    await db.exec(`update pets set no = 0 where owner_id = '${U}'`);
    const a = await H();
    expect(a.illness).toBeNull(); expect(a.critical_since).not.toBeNull();
    await db.exec(`update pets set no = 50 where owner_id = '${U}'`);
    expect((await H()).critical_since).toBeNull();
  });
  it('đủ 30 phút thì ốm đúng bệnh của chỉ số bị bỏ, ghi ký ức lần đầu', async () => {
    for (const [stat, id] of [['no', 'dau-bung'], ['sach', 'ngua-da'], ['vui', 'u-rut'], ['nl', 'sot-met']]) {
      await reset();
      await db.exec(`update pets set ${stat} = 0, critical_since = now() - interval '31 minutes' where owner_id = '${U}'`);
      const h = await H();
      expect(h.illness).toBe(id); expect(h.sick_since).not.toBeNull(); expect(h.critical_since).toBeNull();
    }
    expect(Number(await one("select count(*) from memories where body like 'Lần đầu mình bị đau bụng%'"))).toBe(1);
    await reset();
    await db.exec(`update pets set no = 0, critical_since = now() - interval '29 minutes' where owner_id = '${U}'`);
    expect((await H()).illness).toBeNull();
  });
  it('nhiều chỉ số cùng nguy kịch thì ra bệnh theo thứ tự No, Sạch, Vui, Năng lượng', async () => {
    await db.exec(`update pets set sach = 0, vui = 0, nl = 0, critical_since = now() - interval '40 minutes' where owner_id = '${U}'`);
    expect((await H()).illness).toBe('ngua-da');
  });
  it('Năng lượng thấp lúc đang ngủ không tính (ngủ là đang hồi)', async () => {
    await db.exec(`update pets set nl = 0, asleep = true, critical_since = now() - interval '40 minutes' where owner_id = '${U}'`);
    const h = await H(); expect(h.illness).toBeNull(); expect(h.critical_since).toBeNull();
  });
  it('mở game lần đầu sau nhiều giờ vắng cũng chỉ bắt đầu đếm, không ốm ngay', async () => {
    await db.exec(`update pets set stats_at = now() - interval '10 hours' where owner_id = '${U}'`);
    const h = await H(); expect(h.no).toBe(0); expect(h.illness).toBeNull(); expect(h.critical_since).not.toBeNull();
  });
});

describe('bệnh do ăn uống', () => {
  const feed = async (id: string) => { await db.exec(`update pets set no = 20 where owner_id = '${U}'`); return act('feed', id); };
  it('sâu răng: bữa ngọt thứ 4 trong ngày (bữa thứ 1–3 không sao)', async () => {
    await give('kem', 9); await give('che', 9);
    for (const id of ['kem', 'che', 'kem']) { await feed(id); expect((await pet()).illness).toBeNull(); }
    await feed('che');
    const p = await pet();
    expect(p.illness).toBe('sau-rang');
    expect(Math.abs(Date.parse(p.recover_at) - Date.parse(p.sick_since) - 6 * 3600000)).toBeLessThan(1000);
  });
  it('bữa không ngọt thì không tính, dù đã ăn nhiều đồ ngọt', async () => {
    await give('kem', 9); await give('carot', 9);
    for (let i = 0; i < 3; i++) await feed('kem');
    await feed('carot');
    expect((await pet()).illness).toBeNull();
  });
  it('món nấu có nhóm ngọt cũng tính (kem chuối = ngọt + trái cây)', async () => {
    await give('kem', 9); await give('kem-chuoi', 9);
    for (let i = 0; i < 3; i++) await feed('kem');
    await feed('kem-chuoi');
    expect((await pet()).illness).toBe('sau-rang');
  });
  it('đang sâu răng, server vẫn cho ăn (chặn món ngọt chỉ do giao diện)', async () => {
    await makeSick('sau-rang', ', recover_at = now() + interval \'5 hours\'');
    await give('kem', 3);
    expect((await feed('kem')).refused).toBeNull();
  });
  it('thiếu chất: bữa thứ 6 trong 3 ngày mà chỉ có 1 nhóm lành mạnh; khỏi khi đủ 3 nhóm', async () => {
    const pid = await one(`select id from pets where owner_id = '${U}'`);
    await db.exec(`insert into day_logs (pet_id, owner_id, day, fed, foods, fgroups) values ('${pid}', '${U}', private.local_day('${U}') - 1, 5, '{Cơm nắm}', '{tinhbot,tinhbot,tinhbot,tinhbot,tinhbot}')`);
    await give('comnam', 5);
    await feed('comnam');
    expect((await pet()).illness).toBe('thieu-chat');
    expect((await H()).illness).toBe('thieu-chat'); // chưa cân bằng thì chưa khỏi
    await db.exec(`update day_logs set fgroups = fgroups || '{rau,dam}' where pet_id = '${pid}' and day = private.local_day('${U}') - 1`);
    expect((await H()).illness).toBeNull();
  });
  it('thiếu chất: 5 bữa hoặc 2 nhóm thì chưa', async () => {
    const pid = await one(`select id from pets where owner_id = '${U}'`);
    await db.exec(`insert into day_logs (pet_id, owner_id, day, fed, foods, fgroups) values ('${pid}', '${U}', private.local_day('${U}'), 4, '{Cơm nắm}', '{tinhbot,tinhbot,tinhbot,dam}')`);
    await give('comnam', 5);
    await feed('comnam'); // 5 bữa
    expect((await pet()).illness).toBeNull();
  });
});

describe('bệnh do vận động và môi trường', () => {
  const play = async () => { await db.exec(`update pets set nl = 90, asleep = false where owner_id = '${U}'`); return act('play_ball'); };
  const seed = async (n: number, minutesAgo: number) => {
    const pid = await one(`select id from pets where owner_id = '${U}'`);
    await db.exec(`insert into action_log (pet_id, action, created_at) select '${pid}', 'play_spin', now() - interval '${minutesAgo} minutes' from generate_series(1, ${n})`);
  };
  it('căng cơ: lần chơi thứ 12 trong 1 giờ (11 lần thì chưa); tự khỏi sau 2 giờ', async () => {
    await seed(10, 10); await play();
    expect((await pet()).illness).toBeNull(); // 11
    await play();
    const p = await pet();
    expect(p.illness).toBe('cang-co');
    expect(Math.abs(Date.parse(p.recover_at) - Date.parse(p.sick_since) - 2 * 3600000)).toBeLessThan(1000);
  });
  it('chơi cách nhau hơn 1 giờ thì không dồn lại', async () => {
    await seed(11, 70); await play();
    expect((await pet()).illness).toBeNull();
  });
  it('cảm lạnh: chơi khuya lần thứ 2 trong 2 giờ; ban ngày thì không', async () => {
    await setTz(tzForHour(23)); await seed(1, 5);
    await play();
    const p = await pet();
    expect(p.illness).toBe('cam-lanh');
    expect(Math.abs(Date.parse(p.recover_at) - Date.parse(p.sick_since) - 4 * 3600000)).toBeLessThan(1000);
    await reset(); await setTz(tzForHour(14)); await seed(1, 5); await play();
    expect((await pet()).illness).toBeNull();
  });
  it('khuya: 22:00 tính, 21:59 không; 04:59 tính, 05:00 không', async () => {
    for (const [h, sick] of [[22, true], [21, false], [4, true], [5, false]] as const) {
      await reset(); await setTz(tzForHour(h)); await seed(1, 1); await play();
      expect(!!(await pet()).illness, `giờ ${h}`).toBe(sick);
    }
  });
  it('đang ốm thì chặn chơi (cả hai đồ chơi); cảm lạnh chặn thêm tắm; vẫn ăn, nói chuyện, ngủ được', async () => {
    await makeSick('cam-lanh', `, recover_at = now() + interval '3 hours'`);
    const before = (await pet()).vui;
    await failsWith(() => act('play_ball'), 'sick_blocked');
    await failsWith(() => act('play_spin'), 'sick_blocked');
    await failsWith(() => act('bath_scrub', null, 3), 'sick_blocked');
    await failsWith(() => act('bath_rinse'), 'sick_blocked');
    expect((await pet()).vui).toBe(before); // hành động bị chặn thì không đổi gì
    await give('carot', 2); await db.exec(`update pets set no = 30 where owner_id = '${U}'`);
    expect((await act('feed', 'carot')).refused).toBeNull();
    expect((await act('talk')).refused).toBeNull();
    expect((await act('pet')).refused).toBeNull();
    await reset(); await makeSick('sau-rang', `, recover_at = now() + interval '3 hours'`);
    expect((await act('bath_scrub')).refused).toBeNull(); // sâu răng không chặn tắm
  });
});

describe('hồi phục', () => {
  it('bệnh bỏ bê: chỉ số bị bỏ lên từ 50 thì nghỉ 3 giờ; tụt dưới 20 thì nghỉ lại; hết giờ thì khỏi', async () => {
    await makeSick('dau-bung', ', no = 60');
    const a = await H();
    expect(Math.abs(Date.parse(a.recover_at) - Date.now() - 3 * 3600000)).toBeLessThan(5000);
    await db.exec(`update pets set no = 10 where owner_id = '${U}'`);
    expect((await H()).recover_at).toBeNull();
    await db.exec(`update pets set no = 35 where owner_id = '${U}'`); // 20–49: giữ nguyên trạng thái
    expect((await H()).illness).toBe('dau-bung');
    await db.exec(`update pets set no = 60, recover_at = now() - interval '1 minute' where owner_id = '${U}'`);
    const h = await H(); expect(h.illness).toBeNull(); expect(h.sick_since).toBeNull(); expect(h.recover_at).toBeNull();
    expect(Number(await one("select count(*) from memories where body like 'Mình khỏi bệnh rồi%'"))).toBe(1);
  });
  it('bệnh theo giờ: hết giờ nghỉ thì khỏi, chưa hết thì vẫn ốm dù chỉ số đã cao', async () => {
    await makeSick('cang-co', `, recover_at = now() + interval '1 hour'`);
    expect((await H()).illness).toBe('cang-co');
    await db.exec(`update pets set recover_at = now() - interval '1 second' where owner_id = '${U}'`);
    expect((await H()).illness).toBeNull();
  });
});

describe('bệnh nặng và ảnh hưởng tới chỉ số', () => {
  it('ốm 24 giờ không tiến triển thì nặng; có hồi phục đang chạy thì không nặng', async () => {
    await makeSick('dau-bung', ', no = 30, sick_since = now() - interval \'25 hours\'');
    expect(await one(`select private.is_severe(p) from pets p where owner_id = '${U}'`)).toBe(true);
    await db.exec(`update pets set recover_at = now() + interval '1 hour' where owner_id = '${U}'`);
    expect(await one(`select private.is_severe(p) from pets p where owner_id = '${U}'`)).toBe(false);
    await db.exec(`update pets set recover_at = null, sick_since = now() - interval '23 hours' where owner_id = '${U}'`);
    expect(await one(`select private.is_severe(p) from pets p where owner_id = '${U}'`)).toBe(false);
  });
  it('mỗi bệnh làm chỉ số giảm đúng hệ số của nó (khớp decayStats ở client), bệnh nặng thêm 25%', async () => {
    for (const il of ILLNESSES) {
      for (const severe of [false, true]) {
        await reset();
        await makeSick(il.id, severe ? `, no = 100, sach = 100, vui = 100, nl = 100, recover_at = null, sick_since = now() - interval '30 hours', stats_at = now() - interval '20 minutes'`
          : `, no = 100, sach = 100, vui = 100, nl = 100, recover_at = now() + interval '5 hours', stats_at = now() - interval '20 minutes'`);
        const want = decayStats({ no: 100, sach: 100, vui: 100, nl: 100, asleep: false, illness: il.id, severe }, 20, (await pet()).comfort_level);
        const got = await H();
        for (const k of ['no', 'sach', 'vui', 'nl'] as const) expect(got[k], `${il.id} ${k} ${severe ? 'nặng' : ''}`).toBeCloseTo(want[k], 1);
      }
    }
  });
  it('khoẻ thì giảm bình thường', async () => {
    await db.exec(`update pets set no = 100, stats_at = now() - interval '20 minutes' where owner_id = '${U}'`);
    expect((await H()).no).toBeCloseTo(100 - 20 * 0.9, 1);
  });
});

describe('chữa bệnh', () => {
  it('thuốc: không ốm thì không dùng được; sai thuốc; chưa có thuốc', async () => {
    await give('tra-gung', 1);
    await failsWith(() => q("select use_medicine('tra-gung')"), 'not_sick');
    await makeSick('ngua-da', `, recover_at = null`);
    await failsWith(() => q("select use_medicine('tra-gung')"), 'wrong_medicine');
    await failsWith(() => q("select use_medicine('thuoc-boi')"), 'not_owned');
    await failsWith(() => q("select use_medicine('carot')"), 'unknown_item');
  });
  it('thuốc đúng bệnh: khỏi ngay, trừ 1 liều, cộng 3 điểm gắn bó', async () => {
    await give('thuoc-boi', 2); await makeSick('ngua-da', ', sach = 0');
    const bond = (await pet()).bond_xp;
    const r = (await q<{ r: any }>("select use_medicine('thuoc-boi') as r"))[0].r;
    expect(r.qty).toBe(1); expect(r.pet.illness).toBeNull();
    expect((await pet()).illness).toBeNull();
    expect((await pet()).bond_xp).toBe(bond + HEALTH.cureBond);
  });
  it('bệnh nặng thì thuốc không đủ, phải ra phòng khám', async () => {
    await give('tra-gung', 1);
    await makeSick('dau-bung', `, no = 30, recover_at = null, sick_since = now() - interval '26 hours'`);
    await failsWith(() => q("select use_medicine('tra-gung')"), 'needs_clinic');
  });
  it('phòng khám: 150 xu, khỏi ngay, bổ sung chỉ số bị bỏ bê lên 60', async () => {
    await makeSick('dau-bung', ', no = 2');
    const r = (await q<{ r: any }>('select visit_clinic() as r'))[0].r;
    expect(r.coins).toBe(850); expect(await coins()).toBe(850);
    const p = await pet(); expect(p.illness).toBeNull(); expect(p.no).toBeGreaterThanOrEqual(60);
  });
  it('phòng khám: bệnh nặng 250 xu; thiếu xu, không ốm thì lỗi; bệnh không có chỉ số bị bỏ thì không đổi chỉ số', async () => {
    await makeSick('u-rut', `, vui = 30, recover_at = null, sick_since = now() - interval '48 hours'`);
    await db.exec(`update wallets set coins = 200 where owner_id = '${U}'`);
    await failsWith(() => q('select visit_clinic()'), 'not_enough_coins');
    await db.exec(`update wallets set coins = 250 where owner_id = '${U}'`);
    await q('select visit_clinic()');
    expect(await coins()).toBe(0);
    await failsWith(() => q('select visit_clinic()'), 'not_sick');
    await reset(); await makeSick('cang-co', ', nl = 33, recover_at = now() + interval \'1 hour\'');
    await q('select visit_clinic()');
    expect((await pet()).nl).toBeCloseTo(33, 0);
  });
  it('mua thuốc: đúng giá, kho tối đa 10 liều, thiếu xu thì lỗi; chỉ mua được thuốc', async () => {
    const r = (await q<{ r: any }>("select buy_medicine('thuoc-sot', 2) as r"))[0].r;
    expect(r.coins).toBe(1000 - 2 * 60); expect(r.qty).toBe(2);
    await failsWith(() => q("select buy_medicine('thuoc-sot', 9)"), 'stock_full');
    await failsWith(() => q("select buy_medicine('thuoc-sot', 0)"), 'invalid_qty');
    await failsWith(() => q("select buy_medicine('carot', 1)"), 'unknown_item');
    await failsWith(() => q("select buy_item('thuoc-sot')"), 'unknown_item');
    await failsWith(() => q("select buy_food('thuoc-sot', 1)"), 'unknown_item');
    await db.exec(`update wallets set coins = 10 where owner_id = '${U}'`);
    await failsWith(() => q("select buy_medicine('vitamin', 1)"), 'not_enough_coins');
  });
  it('thuốc không bị ăn nhầm như thức ăn', async () => {
    await give('tra-gung', 1);
    await failsWith(() => act('feed', 'tra-gung'), 'unknown_item');
  });
});

describe('chỉ chủ thú mới thấy và dùng', () => {
  it('người chưa có thú: get_health trả null; không dùng được thuốc', async () => {
    await as(V);
    expect(await one('select get_health() is null')).toBe(true);
    await failsWith(() => q("select use_medicine('tra-gung')"), 'no_pet');
    await failsWith(() => q('select visit_clinic()'), 'no_pet');
    await as(U);
  });
  it('bảng bệnh ai đăng nhập cũng đọc được, không ai tự sửa được', async () => {
    expect(ILLNESS_BY_ID['dau-bung'].medicine).toBe('tra-gung');
    expect(Number(await one('select count(*) from illnesses'))).toBe(8);
  });
});
