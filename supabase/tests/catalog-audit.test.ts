/** Kiểm tra toàn danh mục sau khi nạp mọi migration: RLS, quyền ghi, hàm security definer, hàm private. */
import { beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await createHarness(); }, 90_000);

/** Bảng mà `authenticated` được ghi trực tiếp (kèm lý do). Mọi bảng khác chỉ ghi qua RPC. */
const WRITE_ALLOW: Record<string, string[]> = { memories: ['delete'] };
const COLUMN_UPDATE_ALLOW: Record<string, string[]> = { profiles: ['timezone'] };

describe('danh mục sau khi nạp mọi migration', () => {
  it('mọi bảng public bật RLS', async () => {
    const rows = await h.q("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1");
    expect(rows.map(r => r.relname)).toEqual([]);
  });
  it('chỉ danh sách cho phép được ghi trực tiếp bởi authenticated; anon không đụng được bảng nào', async () => {
    const tables = (await h.q("select c.oid::regclass::text as t, relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1")).map(r => r.relname as string);
    const bad: string[] = [];
    for (const t of tables) {
      for (const priv of ['insert', 'update', 'delete', 'truncate']) {
        const has = await h.one(`select has_table_privilege('authenticated', 'public.${t}', '${priv}')`);
        if (has && !(WRITE_ALLOW[t] ?? []).includes(priv)) bad.push(`authenticated ${priv} ${t}`);
      }
      for (const priv of ['select', 'insert', 'update', 'delete']) if (await h.one(`select has_table_privilege('anon', 'public.${t}', '${priv}')`)) bad.push(`anon ${priv} ${t}`);
    }
    expect(bad).toEqual([]);
  });
  it('quyền ghi theo cột chỉ đúng chỗ cho phép (profiles chỉ sửa được timezone)', async () => {
    for (const [t, cols] of Object.entries(COLUMN_UPDATE_ALLOW)) {
      const all = (await h.q(`select column_name from information_schema.columns where table_schema = 'public' and table_name = '${t}'`)).map(r => r.column_name as string);
      for (const c of all) expect(await h.one(`select has_column_privilege('authenticated', 'public.${t}', '${c}', 'update')`), `${t}.${c}`).toBe(cols.includes(c));
    }
  });
  it('anon không chạy được hàm public nào', async () => {
    const rows = await h.q("select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute') order by 1");
    expect(rows.map(r => r.f)).toEqual([]);
  });
  it('hàm security definer ở public và private đều đặt search_path rỗng', async () => {
    const rows = await h.q("select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c = 'search_path=\"\"') order by 1");
    expect(rows.map(r => r.f)).toEqual([]);
  });
  it('mọi hàm ở public và private (kể cả hàm thuần) đều đặt search_path rỗng', async () => {
    const rows = await h.q("select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prokind = 'f' and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c = 'search_path=\"\"') order by 1");
    expect(rows.map(r => r.f)).toEqual([]);
  });
  it('authenticated không chạy được hàm private nào', async () => {
    const rows = await h.q("select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'execute') order by 1");
    expect(rows.map(r => r.f)).toEqual([]);
  });
});

describe('khung test', () => {
  it('withRole chạy bằng vai trò thật và luôn trả vai trò về', async () => {
    const U = '10000000-0000-4000-8000-000000000001';
    await h.addUsers(U);
    expect(await h.withRole(U, async () => h.one('select current_user'))).toBe('authenticated');
    expect(await h.one('select current_user')).not.toBe('authenticated');
  });
  it('realtime giả: send ghi dòng, topic đọc được', async () => {
    await h.setTopic('plaza:1');
    expect(await h.one('select realtime.topic()')).toBe('plaza:1');
    await h.q("select realtime.send('{\"a\":1}'::jsonb, 'chat', 'plaza:1', true)");
    expect(Number(await h.one("select count(*) from realtime.messages where topic = 'plaza:1'"))).toBe(1);
  });
});
