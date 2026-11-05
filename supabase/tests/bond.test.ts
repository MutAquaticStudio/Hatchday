/** Gắn bó trên Postgres thật (PGlite): cấp theo điểm và quà xu khớp bond.ts. */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOND, bondLevel } from '../../src/game/bond';

const U = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const V = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
let db: PGlite;
const q = async <T = any>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const one = async (sql: string, p: unknown[] = []) => Object.values((await q(sql, p))[0])[0] as any;
const as = (uid: string) => db.exec(`set request.uid = '${uid}'`);
const claim = async (l: number) => (await q<{ r: any }>('select claim_bond_reward($1) as r', [l]))[0].r;
const coins = async () => one('select coins from wallets where owner_id = $1', [U]);
const setXp = (xp: number) => db.exec(`update pets set bond_xp = ${xp} where owner_id = '${U}'`);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;`);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users values ('${U}', 'b@x.vn'), ('${V}', 'c@x.vn')`);
  await as(U);
  await q("select * from create_pet('Mochi', 'Nhà Mây', 1)");
}, 60_000);

describe('đồng bộ với client', () => {
  it('cấp theo điểm: mọi mốc và ngay trước mốc', async () => {
    const pts = [...BOND.levels.flatMap(l => [l - 1, l, l + 1]), 5000].filter(x => x >= 0);
    for (const xp of pts) expect(await one('select private.bond_level($1)', [xp]), `xp ${xp}`).toBe(bondLevel(xp));
  });
  it('quà từng cấp khớp bảng', async () => {
    for (let lv = 1; lv <= 10; lv++) expect(await one('select private.bond_reward($1)', [lv])).toBe(BOND.rewards[lv - 1]);
  });
});

describe('nhận quà gắn bó', () => {
  it('chưa đủ điểm thì không nhận được; cấp sai thì lỗi', async () => {
    await setXp(10);
    await expect(claim(2)).rejects.toThrow('bond_too_low');
    await expect(claim(1)).rejects.toThrow('invalid_level');
    await expect(claim(11)).rejects.toThrow('invalid_level');
  });
  it('đủ điểm: nhận đúng số xu, mỗi cấp một lần', async () => {
    await setXp(300);
    const c0 = await coins();
    const r = await claim(3);
    expect(r.reward).toBe(80); expect(r.coins).toBe(c0 + 80); expect(await coins()).toBe(c0 + 80);
    await expect(claim(3)).rejects.toThrow('already_claimed');
    expect((await claim(5)).reward).toBe(160);
    await expect(claim(6)).rejects.toThrow('bond_too_low');
  });
  it('ghi ký ức cột mốc', async () => {
    expect(Number(await one("select count(*) from memories where body like 'Chúng mình thân nhau hơn rồi%'"))).toBeGreaterThanOrEqual(1);
  });
  it('quà không bị tính vào trần xu chăm sóc mỗi ngày', async () => {
    const before = await one('select earned_today from wallets where owner_id = $1', [U]);
    await claim(2);
    expect(await one('select earned_today from wallets where owner_id = $1', [U])).toBe(before);
  });
  it('người chưa có thú thì không nhận được', async () => {
    await as(V);
    await expect(claim(2)).rejects.toThrow('no_pet');
    await as(U);
  });
  it('chữa bệnh và hành động chăm sóc cộng điểm', async () => {
    await setXp(0);
    await db.exec(`update pets set no = 20, nl = 90, asleep = false, stats_at = now() where owner_id = '${U}'`);
    await q("select pet_action('talk', null, 1)");
    expect(await one('select bond_xp from pets where owner_id = $1', [U])).toBe(1);
  });
});
