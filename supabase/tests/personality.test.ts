/** Cá tính 5 trục trên Postgres thật (PGlite): bốc lúc sinh, dịch theo cách chăm, khớp personality.ts. */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyDrift, AXES, DRIFT, normalize, type Personality } from '../../src/game/personality';
import type { PetAction } from '../../src/data/types';
import { noonTz } from './util';

const U = '66666666-6666-6666-6666-666666666666';
const V = '77777777-7777-7777-7777-777777777777';
let db: PGlite;
const q = async <T = any>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const as = (uid: string) => db.exec(`set request.uid = '${uid}'`);
const act = async (a: string, item: string | null = null, n = 1) => (await q<{ r: any }>('select pet_action($1, $2, $3) as r', [a, item, n]))[0].r;
const persona = async (uid = U): Promise<Personality> => (await q('select personality from pets where owner_id = $1', [uid]))[0].personality;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;`);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users values ('${U}', 'p@x.vn'), ('${V}', 'q@x.vn')`);
  await as(U);
  await q("select * from create_pet('Mochi', 'Nhà Mây', 2)");
  await db.exec(`update profiles set timezone = '${noonTz()}' where id = '${U}'`); // chơi lúc khuya sẽ bị cảm lạnh, nên cho giờ địa phương là trưa
}, 60_000);

describe('bốc cá tính lúc sinh', () => {
  it('thú mới có đủ 5 trục, số nguyên trong [-50, 50]', async () => {
    const p = await persona();
    expect(Object.keys(p).sort()).toEqual([...AXES].sort());
    for (const a of AXES) { expect(Number.isInteger(p[a])).toBe(true); expect(Math.abs(p[a])).toBeLessThanOrEqual(50); }
  });
  it('bốc ngẫu nhiên, đủ cả hai phía', async () => {
    const rows = await q<{ p: Personality }>('select private.roll_personality() as p from generate_series(1, 300)');
    const vals = rows.flatMap(r => AXES.map(a => r.p[a]));
    expect(Math.min(...vals)).toBe(-50);
    expect(Math.max(...vals)).toBe(50);
    expect(new Set(rows.map(r => JSON.stringify(r.p))).size).toBe(300);
  });
  it('thú được truyền sẵn cá tính (đời sau thừa hưởng) thì giữ nguyên', async () => {
    const given = { energy: 12, social: -7, curious: 0, playful: 33, affection: 5 };
    await q(`insert into pets (owner_id, name, family_name, species, genes, personality) values ($1, 'Con', 'Nhà Mây', 'mam-xanh', '{}', $2)`, [V, JSON.stringify(given)]);
    expect(await persona(V)).toEqual(given);
    await q('delete from pets where owner_id = $1', [V]);
  });
  it('thú cũ toàn 0 (trước tính năng) được bốc lại khi chạy migration', async () => {
    const sql = readFileSync(join(__dirname, '..', 'migrations', '20261113000000_personality.sql'), 'utf8');
    const backfill = sql.slice(sql.lastIndexOf('update public.pets set personality'));
    await q(`alter table pets disable trigger pets_roll_personality`);
    await q(`insert into pets (owner_id, name, family_name, species, genes) values ($1, 'Cũ', 'Nhà Mây', 'mam-xanh', '{}')`, [V]);
    await q(`alter table pets enable trigger pets_roll_personality`);
    expect(Object.values(await persona(V)).every(v => v === 0)).toBe(true);
    const before = await persona();
    await db.exec(backfill);
    expect(Object.values(await persona(V)).some(v => v !== 0)).toBe(true);
    expect(await persona()).toEqual(before); // thú đã có cá tính thì không đổi
    await q('delete from pets where owner_id = $1', [V]);
  });
});

describe('cá tính dịch theo cách chăm', () => {
  it('bảng dịch trong SQL khớp DRIFT', async () => {
    const all: PetAction[] = ['feed', 'pet', 'bath_scrub', 'bath_rinse', 'play_ball', 'play_spin', 'talk', 'sleep', 'wake'];
    for (const a of all) expect((await q('select private.personality_drift($1) as d', [a]))[0].d).toEqual(DRIFT[a] ?? {});
  });
  it('chuỗi hành động cho kết quả giống client', async () => {
    await q("update pets set nl = 90, no = 40, asleep = false where owner_id = $1", [U]);
    let want = normalize(await persona());
    const seq: [PetAction, string | null, number][] = [['pet', null, 5], ['talk', null, 1], ['play_ball', null, 1], ['play_spin', null, 1],
      ['feed', 'carot', 1], ['bath_scrub', null, 3], ['bath_rinse', null, 1], ['talk', null, 1], ['sleep', null, 1], ['wake', null, 1]];
    for (const [a, item, n] of seq) {
      const r = await act(a, item, n);
      expect(r.refused).toBeNull();
      want = applyDrift(want, a);
      expect(normalize(r.pet.personality)).toEqual(want); // RPC trả về cá tính mới ngay
    }
    expect(normalize(await persona())).toEqual(want);
  });
  it('hành động bị từ chối thì không dịch', async () => {
    await q('update pets set nl = 5 where owner_id = $1', [U]);
    const before = await persona();
    expect((await act('play_ball')).refused).toBe('tired');
    expect(await persona()).toEqual(before);
  });
  it('không vượt quá 100', async () => {
    await q(`update pets set personality = jsonb_set(personality, '{affection}', '99.9'), nl = 90 where owner_id = $1`, [U]);
    await act('pet'); await act('pet');
    expect((await persona()).affection).toBe(100);
  });
  it('client không tự sửa được cá tính', async () => {
    const before = await persona();
    await q('set role authenticated');
    try { await q(`update pets set personality = '{}' where owner_id = $1`, [U]); } catch { /* bị chặn là đúng */ }
    finally { await q('reset role'); }
    expect(await persona()).toEqual(before);
  });
});
