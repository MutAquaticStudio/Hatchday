/** Loài, lớn lên theo tuổi, dáng trưởng thành, Sổ loài — trên Postgres thật (PGlite). */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { formFromCare, GROW_MEMORY, pickSpecies, RARITIES, REGIONS, SPECIES, stageForAge } from '../../src/game/species';

const U = '44444444-4444-4444-4444-444444444444';
const V = '55555555-5555-5555-5555-555555555555';
let db: PGlite;
const q = async <T = any>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const one = async (sql: string, p: unknown[] = []) => Object.values((await q(sql, p))[0])[0] as any;
const as = (uid: string) => db.exec(`set request.uid = '${uid}'`);
const petId = () => one('select id from pets where owner_id = $1', [U]);
/** Lùi ngày sinh để giả lập thời gian trôi. */
const age = async (days: number) => q(`update pets set born_at = now() - make_interval(secs => $1 * 86400) where owner_id = $2`, [days, U]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;`);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users values ('${U}', 's@x.vn'), ('${V}', 't@x.vn')`);
  await as(U);
  await q("select * from create_pet('Mochi', 'Nhà Mây', 3)");
  await q('update pet_secrets set lifespan_days = 40');
}, 60_000);

describe('danh sách loài', () => {
  it('50 loài, 5 miền × (4 thường, 3 hiếm, 2 quý, 1 huyền thoại), khớp species.ts', async () => {
    expect(SPECIES).toHaveLength(50);
    expect(new Set(SPECIES.map(s => s.id)).size).toBe(50);
    expect(new Set(SPECIES.map(s => s.name)).size).toBe(50);
    for (let r = 0; r < REGIONS.length; r++) {
      const c = (k: string) => SPECIES.filter(s => s.region === r && s.rarity === k).length;
      expect([c('thuong'), c('hiem'), c('quy'), c('huyen')]).toEqual([4, 3, 2, 1]);
    }
    const rows = await q('select id, name, region, rarity, weight from species order by id collate "C"');
    expect(rows).toEqual(SPECIES.map(s => ({ id: s.id, name: s.name, region: s.region, rarity: s.rarity, weight: RARITIES[s.rarity].weight }))
      .sort((a, b) => (a.id < b.id ? -1 : 1)));
  });
  it('bốc loài theo trọng số giống client', async () => {
    for (let r = 0; r < 5; r++) for (const x of [0, 0.05, 0.2, 0.37, 0.5, 0.66, 0.8, 0.93, 0.97, 0.9999]) {
      expect(await one('select private.pick_species($1, $2)', [r, x])).toBe(pickSpecies(r, x).id);
    }
  });
  it('tỉ lệ: thường ~65%, huyền thoại ~2% mỗi miền', () => {
    const n = 4900, count: Record<string, number> = {};
    for (let i = 0; i < n; i++) { const s = pickSpecies(1, (i + 0.5) / n); count[s.rarity] = (count[s.rarity] || 0) + 1; }
    expect(count.thuong / n).toBeCloseTo(32 / 49, 2);
    expect(count.huyen / n).toBeCloseTo(1 / 49, 2);
  });
});

describe('ấp trứng', () => {
  it('trứng là miền: thú thuộc đúng miền, có gen sắc độ, ghi vào Sổ loài và ký ức', async () => {
    const p = (await q('select species, stage, form, genes from pets where owner_id = $1', [U]))[0];
    expect(SPECIES.find(s => s.id === p.species)?.region).toBe(3);
    expect(p.stage).toBe('baby'); expect(p.form).toBeNull();
    expect(p.genes.hue).toBeGreaterThanOrEqual(-1); expect(p.genes.hue).toBeLessThanOrEqual(1);
    expect(await q('select species_id, forms from species_seen')).toEqual([{ species_id: p.species, forms: [] }]);
    expect(await one("select body from memories where first_key = 'meet'")).toMatch(/Mình là một bé .+, bạn đặt tên mình là Mochi/);
  });
  it('trứng ngoài 0–4 bị từ chối', async () => {
    await as(V);
    await expect(q("select * from create_pet('A', 'B', 5)")).rejects.toThrow(/invalid_egg/);
    await as(U);
  });
});

describe('lớn lên', () => {
  it('giai đoạn theo ngày tuổi giống client', async () => {
    for (const [d, life] of [[0, 40], [1.9, 40], [2, 40], [6.5, 40], [7, 40], [13.9, 40], [14, 40], [34.9, 40], [35, 40], [27, 30], [40, 40]] as const)
      expect(await one('select private.stage_for($1, $2)', [d, life])).toBe(stageForAge(d, life));
  });
  it('dáng trưởng thành theo kiểu chăm giống client', async () => {
    const cases = [{ fed: 30, ball: 10, pet: 100, talk: 4, bath: 3 }, { fed: 3, ball: 40, pet: 20, talk: 2, bath: 2 },
      { fed: 1, ball: 1, pet: 300, talk: 10, bath: 1 }, { fed: 0, ball: 0, pet: 0, talk: 0, bath: 0 }, { fed: 6, ball: 3, pet: 20, talk: 2, bath: 9 }];
    for (const c of cases) expect(await one('select private.form_for($1, $2, $3, $4, $5)', [c.fed, c.ball, c.pet, c.talk, c.bath])).toBe(formFromCare(c));
  });
  it('get_my_pet đưa thú qua Nhí → Thiếu niên → Trưởng thành (chốt dáng) → Xế chiều, mỗi lần một ký ức', async () => {
    const stage = async () => (await q('select stage, form from get_my_pet()'))[0];
    await age(3); expect((await stage()).stage).toBe('child');
    await age(8); expect((await stage()).stage).toBe('teen');
    // chăm kiểu "chơi nhiều" → Lanh Lợi
    await q(`insert into day_logs (pet_id, owner_id, day, fed, ball, pet, talk, bath) values ($1, $2, current_date - 1, 2, 12, 5, 0, 1)
      on conflict (pet_id, day) do update set ball = 12, fed = 2, pet = 5, talk = 0, bath = 1`, [await petId(), U]);
    await age(15); expect(await stage()).toEqual({ stage: 'adult', form: 'nhanh' });
    await age(36); expect(await stage()).toEqual({ stage: 'elder', form: 'nhanh' });
    const mem = (await q("select first_key, body from memories where first_key like 'grow-%' order by id")).map(r => r.first_key);
    expect(mem).toEqual(['grow-child', 'grow-teen', 'grow-adult', 'grow-elder']);
    expect(await one("select body from memories where first_key = 'grow-adult'")).toBe(GROW_MEMORY('adult', 'nhanh'));
    expect(await one('select forms from species_seen')).toEqual(['nhanh']);
  });
  it('client không tự đổi được giai đoạn hay loài (không có quyền sửa bảng pets)', async () => {
    await db.exec('set role authenticated');
    try { await expect(q("update pets set stage = 'adult', species = 'lan-vang'")).rejects.toThrow(); }
    finally { await db.exec('reset role'); }
  });
  it('anon không đọc được Sổ loài', async () => {
    await db.exec('set role anon');
    try { await expect(q('select * from species_seen')).rejects.toThrow(); }
    finally { await db.exec('reset role'); }
  });
});
