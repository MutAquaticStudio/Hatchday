/**
 * Khung test dùng chung cho các test PGlite mới (test cũ vẫn có bản sao riêng của khung này).
 * Khác bản cũ: có quyền mặc định giống Supabase (anon/authenticated/service_role), `set role` thật để kiểm tra RLS,
 * `auth.jwt()`/`auth.role()` đọc `request.jwt.claims`, và một bản giả của schema `realtime` (messages, topic, send).
 * Lưu ý: `realtime` ở đây chỉ gần đúng, cần kiểm lại trên Supabase thật.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface Harness {
  db: PGlite;
  q: <T = any>(sql: string, p?: unknown[]) => Promise<T[]>;
  one: (sql: string, p?: unknown[]) => Promise<any>;
  /** Đặt người dùng hiện tại (chỉ `auth.uid()`; vẫn chạy bằng quyền cao nhất). */
  as: (uid: string | null, claims?: Record<string, unknown>) => Promise<void>;
  /** Chạy `fn` với vai trò thật (mặc định `authenticated`) để RLS và quyền bảng có hiệu lực; luôn trả vai trò về như cũ. */
  withRole: <T>(uid: string | null, fn: () => Promise<T>, o?: { role?: 'authenticated' | 'anon' | 'service_role'; claims?: Record<string, unknown> }) => Promise<T>;
  /** Chèn người dùng giả vào auth.users (kích hoạt trigger tạo profile nếu có). */
  addUsers: (...ids: string[]) => Promise<void>;
  /** Đặt chủ đề kênh hiện tại cho `realtime.topic()`. */
  setTopic: (t: string | null) => Promise<void>;
}

const SHIM = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.role', true), ''), 'authenticated') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create schema realtime;
create table realtime.messages (id bigint generated always as identity primary key, topic text, extension text, event text, payload jsonb, private boolean default true, inserted_at timestamptz not null default now());
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('realtime.topic', true), '') $$;
create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $$
  insert into realtime.messages (topic, extension, event, payload, private) values (topic, 'broadcast', event, payload, private)
$$;
grant usage on schema realtime to authenticated, service_role;
grant select, insert on realtime.messages to authenticated;
`;

export async function createHarness(): Promise<Harness> {
  const db = new PGlite();
  await db.exec(SHIM);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  const q = async <T = any>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
  const one = async (sql: string, p: unknown[] = []) => Object.values((await q(sql, p))[0] ?? {})[0] as any;
  const setClaims = async (uid: string | null, claims: Record<string, unknown> = {}) => {
    await db.exec(`set request.uid = '${uid ?? ''}'`);
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(uid ? { sub: uid, aal: 'aal1', ...claims } : {})]);
  };
  return {
    db, q, one,
    as: (uid, claims) => setClaims(uid, claims),
    withRole: async (uid, fn, o = {}) => {
      await setClaims(uid, o.claims);
      await db.exec(`set role ${o.role ?? 'authenticated'}`);
      try { return await fn(); } finally { await db.exec('reset role'); }
    },
    addUsers: async (...ids) => { for (const id of ids) await db.query('insert into auth.users values ($1, $2)', [id, `${id.slice(0, 8)}@x.vn`]); },
    setTopic: async t => { await db.query(`select set_config('realtime.topic', $1, false)`, [t ?? '']); },
  };
}
