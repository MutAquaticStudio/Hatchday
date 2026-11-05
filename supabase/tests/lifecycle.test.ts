/** Vòng đời và gia phả trên Postgres thật (PGlite): chia tay khi hết tuổi thọ, đón thú đời sau, thừa hưởng, khớp lineage.ts. */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { blendPersonality, pickHeirSpecies } from '../../src/game/lineage';
import { AXES, type Personality } from '../../src/game/personality';
import { REGIONS, SPECIES, SPECIES_BY_ID } from '../../src/game/species';

const U = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const V = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
let db: PGlite;
const q = async <T = any>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const one = async (sql: string, p: unknown[] = []) => Object.values((await q(sql, p))[0])[0] as any;
const as = (uid: string) => db.exec(`set request.uid = '${uid}'`);
const act = async (a: string, item: string | null = null, n = 1) => (await q<{ r: any }>('select pet_action($1, $2, $3) as r', [a, item, n]))[0].r;
/** Lùi ngày sinh của bé đang sống để giả lập thời gian trôi. */
const age = (days: number) => q(`update pets set born_at = now() - make_interval(secs => $1 * 86400) where owner_id = $2 and stage <> 'departed'`, [days, U]);
const current = async () => (await q('select * from get_my_pet()'))[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;`);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users values ('${U}', 'l@x.vn'), ('${V}', 'm@x.vn')`);
  await as(U);
  await q("select * from create_pet('Mochi', 'Nhà Mây', 1)");
  await q('update pet_secrets set lifespan_days = 40');
}, 60_000);

describe('chia tay khi hết tuổi thọ', () => {
  it('còn 1 ngày thì vẫn là Xế chiều, chưa đi', async () => {
    await age(39);
    const p = await current();
    expect(p.stage).toBe('elder');
    expect(p.departed_at).toBeNull();
  });
  it('hết tuổi thọ: get_my_pet trả về bé vừa ra đi đúng một lần, ghi ngày đi và số ngày sống', async () => {
    await age(41);
    const p = await current();
    expect(p.stage).toBe('departed');
    expect(p.lived_days).toBe(40);
    expect(p.form).not.toBeNull();
    const gone = new Date(p.departed_at).getTime(), born = new Date(p.born_at).getTime();
    expect(Math.round((gone - born) / 86400000)).toBe(40);
    expect((await current()).id).toBeNull(); // lần sau không còn bé đang sống
    expect(await one("select count(*)::int from memories where first_key = 'depart'")).toBe(1);
  });
  it('bé đã đi không nhận hành động nữa', async () => {
    await expect(act('pet')).rejects.toThrow(/no_pet/);
    expect(await one("select count(*)::int from pets where stage = 'departed'")).toBe(1);
  });
  it('đi rồi thì chốt dáng và ghi vào Sổ loài', async () => {
    const f = await one("select form from pets where stage = 'departed'");
    const forms = await one('select forms from species_seen');
    expect(forms).toContain(f);
  });
});

describe('đón thú đời sau', () => {
  it('đã từng có thú thì create_pet bị chặn, phải dùng hatch_heir', async () => {
    await expect(q("select * from create_pet('Bé', 'Nhà Mây', 0)")).rejects.toThrow(/heir_required/);
  });
  it('kiểm tra tên và trứng', async () => {
    await expect(q("select * from hatch_heir('', 3)")).rejects.toThrow(/invalid_name/);
    await expect(q("select * from hatch_heir('Tên dài quá mười sáu ký tự', 3)")).rejects.toThrow(/invalid_name/);
    await expect(q("select * from hatch_heir('Con', 9)")).rejects.toThrow(/invalid_egg/);
  });
  it('người chưa có bé nào thì không đón được', async () => {
    await as(V);
    await expect(q("select * from hatch_heir('Con', 0)")).rejects.toThrow(/no_parent/);
    await as(U);
  });
  it('bé đời 2: giữ dòng họ, đời + 1, trỏ về bé đời trước, thừa hưởng tai và sở thích', async () => {
    const par = (await q("select * from pets where stage = 'departed'"))[0];
    const c = (await q("select * from hatch_heir('Con Mochi', 3)"))[0];
    expect(c.generation).toBe(2);
    expect(c.family_name).toBe('Nhà Mây');
    expect(c.parent_id).toBe(par.id);
    expect(c.stage).toBe('baby');
    expect(c.genes.ear).toBe(par.genes.ear);
    expect(c.genes.likes[0]).toBe(par.genes.likes[0]);
    expect(c.genes.likes).not.toContain(c.genes.dislike);
    expect(c.genes.region).toBe(3);
    expect(Math.abs(c.genes.hue - (par.genes.hue ?? 0) * 0.5)).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(SPECIES_BY_ID[c.species]).toBeDefined();
  });
  it('cá tính đời sau nằm trong khoảng cha mẹ ± nửa lần bốc, là số nguyên', async () => {
    const par = (await q("select personality from pets where stage = 'departed'"))[0].personality as Personality;
    const c = (await q("select personality from pets where stage <> 'departed'"))[0].personality as Personality;
    for (const a of AXES) {
      expect(Number.isInteger(c[a])).toBe(true);
      expect(c[a]).toBeGreaterThanOrEqual(Math.round((par[a] - 50) / 2) - 1);
      expect(c[a]).toBeLessThanOrEqual(Math.round((par[a] + 50) / 2) + 1);
    }
  });
  it('có tuổi thọ ẩn mới, món tủ khác món ghét, kho thức ăn, ký ức đầu tiên nhắc tên bé trước', async () => {
    const s = (await q("select * from pet_secrets where pet_id = (select id from pets where stage <> 'departed')"))[0];
    expect(s.lifespan_days).toBeGreaterThanOrEqual(30);
    expect(s.lifespan_days).toBeLessThanOrEqual(60);
    expect(s.favorite_food).not.toBe(s.disliked_food);
    expect(await one("select min(qty)::int from entitlements where item_id in (select id from items where kind = 'food')")).toBeGreaterThanOrEqual(2);
    expect(await one("select body from memories where first_key = 'meet' and pet_id = (select id from pets where stage <> 'departed')")).toMatch(/đời thứ 2.*Mochi/);
    expect(await one('select count(*)::int from species_seen')).toBeGreaterThanOrEqual(1);
  });
  it('bé đời 2 sống bình thường: get_my_pet và hành động chạy được, không đón thêm khi đang có bé', async () => {
    expect((await current()).generation).toBe(2);
    await db.exec(`update pets set nl = 90, stats_at = now() where stage <> 'departed'`);
    expect((await act('talk')).refused).toBeNull();
    await expect(q("select * from hatch_heir('Con', 1)")).rejects.toThrow(/pet_exists/);
  });
  it('đời 3 nối với đời 2, gia phả đủ ba đời theo thứ tự', async () => {
    await q('update pet_secrets set lifespan_days = 31');
    await age(35);
    expect((await current()).stage).toBe('departed');
    const c = (await q("select * from hatch_heir('Cháu', 0)"))[0];
    expect(c.generation).toBe(3);
    const fam = await q('select generation, stage, parent_id, id from pets order by generation');
    expect(fam.map(x => x.generation)).toEqual([1, 2, 3]);
    expect(fam[1].parent_id).toBe(fam[0].id);
    expect(fam[2].parent_id).toBe(fam[1].id);
    expect(fam.map(x => x.stage)).toEqual(['departed', 'departed', 'baby']);
  });
});

describe('khớp luật thừa hưởng với client', () => {
  it('trung bình cá tính, làm tròn ra xa số 0, giống blendPersonality()', async () => {
    const vals = [-100, -50, -33.5, -3, -0.6, 0, 0.4, 3, 7, 12.3, 50, 99.9];
    for (const x of vals) for (const y of [-50, -7, -1, 0, 1, 4, 50]) {
      const a: Personality = { energy: x, social: y, curious: x, playful: y, affection: x };
      const b: Personality = { energy: y, social: x, curious: -y, playful: -x, affection: y };
      const sql = await one('select private.blend_personality($1::jsonb, $2::jsonb)', [JSON.stringify(a), JSON.stringify(b)]);
      expect(sql).toEqual(blendPersonality(a, b));
    }
  });
  it('chọn loài cho đời sau: cùng miền và r1 < 0,3 thì giữ loài, còn lại bốc theo độ hiếm', async () => {
    const parent = SPECIES.find(s => s.region === 2 && s.rarity === 'huyen')!;
    for (const region of [0, 1, 2, 3, 4]) for (const r1 of [0, 0.29, 0.3, 0.9]) for (const r2 of [0, 0.2, 0.5, 0.8, 0.9999]) {
      expect(await one('select private.pick_heir_species($1, $2, $3, $4)', [parent.id, region, r1, r2])).toBe(pickHeirSpecies(parent.id, region, r1, r2));
    }
    expect(pickHeirSpecies(parent.id, parent.region, 0.1, 0.5)).toBe(parent.id);
    expect(pickHeirSpecies(parent.id, (parent.region + 1) % REGIONS.length, 0.1, 0.5)).not.toBe(parent.id);
  });
});
