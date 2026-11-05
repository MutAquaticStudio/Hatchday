/**
 * Kiểm tra migration + RPC trên Postgres thật (PGlite, chạy trong Node).
 * Giả lập phần tối thiểu của Supabase: schema auth, auth.uid(), role anon/authenticated.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const U = '11111111-1111-1111-1111-111111111111';
const V = '22222222-2222-2222-2222-222222222222';
let db: PGlite;
const q = async <T = any>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const as = (uid: string | null) => db.exec(uid ? `set request.uid = '${uid}'` : 'reset request.uid');
const act = async (a: string, item: string | null = null, n = 1) => (await q<{ r: any }>('select pet_action($1, $2, $3) as r', [a, item, n]))[0].r;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;`);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users values ('${U}', 'a@x.vn'), ('${V}', 'b@x.vn')`);
}, 60_000);

describe('tạo thú', () => {
  it('trigger tạo profile cho người dùng mới', async () => {
    expect((await q('select count(*)::int as n from profiles'))[0].n).toBe(2);
  });
  it('chưa có thú thì get_my_pet trả về rỗng', async () => {
    await as(U);
    expect((await q('select id from get_my_pet()'))[0].id).toBeNull();
  });
  it('tạo được một thú, không tạo được thú thứ hai', async () => {
    const p = (await q('select * from create_pet($1, $2, 1)', ['Bánh Bò', 'Nhà Mây']))[0];
    expect(p.name).toBe('Bánh Bò');
    expect(p.genes.region).toBe(1);
    await expect(q("select * from create_pet('X', 'Y', 0)")).rejects.toThrow(/pet_exists/);
  });
  it('kiểm tra tên', async () => {
    await as(V);
    await expect(q("select * from create_pet('', 'Y', 0)")).rejects.toThrow(/invalid_name/);
    await expect(q("select * from create_pet('Tên dài quá mười sáu ký tự', 'Y', 0)")).rejects.toThrow(/invalid_name/);
    await as(U);
  });
  it('tuổi thọ ẩn trong khoảng 30–60 ngày', async () => {
    const s = (await q('select * from pet_secrets'))[0];
    expect(s.lifespan_days).toBeGreaterThanOrEqual(30);
    expect(s.lifespan_days).toBeLessThanOrEqual(60);
  });
});

describe('hành động', () => {
  it('ăn món tủ: báo fav và ghi ký ức một lần', async () => {
    const fav = (await q('select favorite_food from pet_secrets'))[0].favorite_food;
    const r = await act('feed', fav);
    expect(r.fav).toBe(true);
    expect(r.new_memory).toBe(true);
    await db.exec("update pets set no = 50");
    expect((await act('feed', fav)).new_memory).toBe(false);
  });
  it('no từ 90 trở lên thì từ chối ăn', async () => {
    await db.exec("update entitlements set qty = 5 where item_id = 'carot'"); // món tủ ngẫu nhiên có thể đã dùng hết kho
    await db.exec('update pets set no = 95, stats_at = now()');
    expect((await act('feed', 'carot')).refused).toBe('full');
  });
  it('món không tồn tại bị từ chối', async () => {
    await expect(act('feed', 'banh-gian-lan')).rejects.toThrow(/unknown_item/);
  });
  it('vuốt ve theo lô bị giới hạn 20 lần', async () => {
    await act('pet', null, 500);
    expect((await q('select pet from day_logs'))[0].pet).toBe(20);
  });
  it('đang ngủ thì không chơi được, thức dậy thì được', async () => {
    await act('sleep');
    expect((await act('play_ball')).refused).toBe('asleep');
    await act('wake');
    await db.exec('update pets set nl = 80, stats_at = now()');
    expect((await act('play_ball')).refused).toBeNull();
  });
  it('mệt thì không chơi được', async () => {
    await db.exec('update pets set nl = 10, stats_at = now()');
    expect((await act('play_spin')).refused).toBe('tired');
  });
  it('chỉ số giảm theo giờ server', async () => {
    await db.exec("update pets set no = 100, sach = 100, stats_at = now() - interval '100 minutes'");
    const p = (await q('select * from get_my_pet()'))[0];
    expect(Math.round(p.no)).toBe(10);
    expect(Math.round(p.sach)).toBe(65);
  });
  it('hành động lạ bị từ chối', async () => {
    await expect(act('hack')).rejects.toThrow(/unknown_action/);
  });
  it('quá 30 hành động trong 10 giây thì bị chặn', async () => {
    await db.exec('delete from action_log');
    for (let i = 0; i < 30; i++) await act('talk');
    await expect(act('talk')).rejects.toThrow(/rate_limited/);
  });
});

describe('ký ức', () => {
  it('lưu lời kể, bỏ qua câu quá ngắn', async () => {
    await q("select add_talk_memory('Hôm nay tôi mệt vì deadline')");
    await q("select add_talk_memory('ok')");
    const talk = await q("select body from memories where kind = 'talk'");
    expect(talk).toHaveLength(1);
    expect(talk[0].body).toContain('deadline');
  });
});

describe('bảo mật', () => {
  it('chưa đăng nhập thì bị chặn', async () => {
    await as(null);
    await expect(q('select * from get_my_pet()')).rejects.toThrow(/not_authenticated/);
    await expect(act('talk')).rejects.toThrow(/not_authenticated/);
  });
  it('RLS bật trên mọi bảng public', async () => {
    const rows = await q("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity");
    expect(rows).toEqual([]);
  });
  it('anon không có quyền gọi RPC', async () => {
    const r = await q("select has_function_privilege('anon', 'public.pet_action(text,text,integer)', 'execute') as ok");
    expect(r[0].ok).toBe(false);
  });
});
