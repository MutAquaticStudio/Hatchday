-- =====================================================================
-- Hatchday — Trang quản trị (P8–P10, phần máy chủ)
-- Mọi RPC admin_* bắt đầu bằng private.require_admin(hành động): kiểm vai trò, ma trận quyền, và xác thực hai bước (aal2).
-- Mọi thao tác ghi để lại dòng admin_audit (không sửa/xoá được). Luật ở hai nơi: admin/src/rbac.ts (ma trận quyền) và migration này.
-- Test: supabase/tests/admin.test.ts. Không viết lại hàm nào cũ.
--
-- Chủ đầu tiên (owner) KHÔNG tạo bằng migration. Chạy tay một lần trong SQL editor của Supabase, sau khi người đó đã đăng ký tài khoản:
--   insert into public.admin_roles (user_id, role) select id, 'owner' from auth.users where email = '<email>';
-- =====================================================================

create table public.admin_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('owner', 'ops', 'support', 'moderator', 'analyst')),
  created_by uuid,
  created_at timestamptz not null default now()
);
create table public.admin_audit (
  id         bigint generated always as identity primary key,
  admin      uuid,
  action     text not null,
  target     text,
  before     jsonb,
  after      jsonb,
  reason     text,
  created_at timestamptz not null default now()
);
create table public.system_flags (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create table public.gift_campaigns (
  id         bigint generated always as identity primary key,
  title      text not null,
  body       text not null default '',
  items      jsonb not null default '[]',
  coins      int not null default 0 check (coins >= 0),
  audience   jsonb not null default '{}',
  status     text not null check (status in ('pending', 'sent', 'cancelled')),
  recipients int not null default 0,
  created_by uuid not null,
  approved_by uuid,
  reason     text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create table public.events (
  id         bigint generated always as identity primary key,
  title      text not null,
  body       text not null default '',
  kind       text not null check (kind in ('seasonal', 'limited', 'community')),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null check (ends_at > starts_at),
  enabled    boolean not null default true,
  config     jsonb not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now()
);
create table public.reports (
  id         bigint generated always as identity primary key,
  reporter   uuid not null references auth.users (id) on delete cascade,
  target     uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('player', 'chat', 'gift')),
  reason     text not null check (reason in ('harassment', 'spam', 'inappropriate_name', 'cheating', 'other')),
  detail     text not null default '' check (char_length(detail) <= 200),
  status     text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.sanctions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('mute', 'ban')),
  until      timestamptz not null,
  reason     text not null,
  auto       boolean not null default false,
  by_admin   uuid,
  created_at timestamptz not null default now(),
  lifted_at  timestamptz
);
create table public.word_filter (
  term   text primary key,
  match  text not null check (match in ('word', 'substr')),
  action text not null check (action in ('block', 'mask', 'flag'))
);
-- Mọi bảng bật RLS và không có chính sách: client không đọc/ghi trực tiếp; chỉ RPC security definer.
alter table public.admin_roles enable row level security;
alter table public.admin_audit enable row level security;
alter table public.system_flags enable row level security;
alter table public.gift_campaigns enable row level security;
alter table public.events enable row level security;
alter table public.reports enable row level security;
alter table public.sanctions enable row level security;
alter table public.word_filter enable row level security;

insert into public.system_flags (key, value) values
  ('chat.public.enabled', 'false'), ('campaign.approval', '{"users": 50, "coins": 500}') on conflict do nothing;

create or replace function private.audit_immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'audit_immutable'; end $$;
create trigger admin_audit_no_change before update or delete on public.admin_audit for each row execute function private.audit_immutable();

-- ---------- Ma trận quyền (phải khớp admin/src/rbac.ts) ----------
create or replace function private.admin_can(r text, a text) returns boolean
language sql immutable set search_path = '' as $$
  select case r
    when 'owner' then true
    when 'ops' then a in ('dashboard', 'search', 'get_user', 'campaign', 'announce', 'event', 'flag', 'audit')
    when 'support' then a in ('dashboard', 'search', 'get_user', 'grant')
    when 'moderator' then a in ('search', 'report', 'sanction', 'word')
    when 'analyst' then a in ('dashboard')
    else false end
$$;

-- Kiểm tra quyền: phải đăng nhập, là admin, có xác thực hai bước, và vai trò được làm hành động này
create or replace function private.require_admin(a text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select role into r from public.admin_roles where user_id = uid;
  if r is null then raise exception 'not_admin'; end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then raise exception 'mfa_required'; end if;
  if not private.admin_can(r, a) then raise exception 'forbidden'; end if;
  return uid;
end $$;
create or replace function private.admin_role(uid uuid) returns text
language sql stable security definer set search_path = '' as $$ select role from public.admin_roles where user_id = uid $$;
create or replace function private.audit(a text, tgt text, bef jsonb, aft jsonb, why text) returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_audit (admin, action, target, before, after, reason) values (auth.uid(), a, tgt, bef, aft, why)
$$;
create or replace function private.need_reason(why text) returns void
language plpgsql set search_path = '' as $$ begin if why is null or char_length(btrim(why)) < 3 then raise exception 'reason_required'; end if; end $$;

-- Người nhận theo "đối tượng": { "all": true } | { "min_bond": 3 } | { "codes": ["ABCDEFGH"] }, các điều kiện cùng có thì giao nhau
create or replace function private.audience_users(aud jsonb) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select user_id from public.public_profiles p
  where (aud ? 'all' or aud ? 'min_bond' or aud ? 'codes')
    and (not (aud ? 'min_bond') or p.bond_level >= (aud ->> 'min_bond')::int)
    and (not (aud ? 'codes') or p.friend_code in (select upper(jsonb_array_elements_text(aud -> 'codes'))))
$$;

create or replace function private.validate_event_config(cfg jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  if jsonb_typeof(cfg) is distinct from 'object' then raise exception 'invalid_event_config'; end if;
  for k in select jsonb_object_keys(cfg) loop
    if k not in ('banner', 'plaza_decor') then raise exception 'invalid_event_config'; end if;
  end loop;
  if cfg ? 'banner' and (jsonb_typeof(cfg -> 'banner') <> 'string' or char_length(cfg ->> 'banner') > 120) then raise exception 'invalid_event_config'; end if;
  if cfg ? 'plaza_decor' and (cfg ->> 'plaza_decor') not in ('tet', 'trung-thu', 'giang-sinh', 'he') then raise exception 'invalid_event_config'; end if;
end $$;

create or replace function private.is_sanctioned(uid uuid, k text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sanctions where user_id = uid and lifted_at is null and until > now() and (kind = k or kind = 'ban'))
$$;

-- ---------- RPC cho người chơi ----------
create or replace function public.get_active_events() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'body', body, 'kind', kind, 'starts_at', starts_at, 'ends_at', ends_at, 'config', config) order by ends_at)
    from public.events where enabled and starts_at <= now() and ends_at > now()), '[]'::jsonb);
end $$;
create or replace function public.get_public_config() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return jsonb_build_object('chat_public', coalesce((select value from public.system_flags where key = 'chat.public.enabled'), 'false'::jsonb));
end $$;
create or replace function public.report_user(p_who text, p_reason text, p_detail text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null or t = uid then raise exception 'not_found'; end if;
  if p_reason not in ('harassment', 'spam', 'inappropriate_name', 'cheating', 'other') then raise exception 'invalid_reason'; end if;
  if (select count(*) from public.reports where reporter = uid and created_at > now() - interval '1 day') >= 10 then raise exception 'rate_limited'; end if;
  if exists (select 1 from public.reports where reporter = uid and target = t and status = 'open') then raise exception 'already_reported'; end if;
  insert into public.reports (reporter, target, kind, reason, detail) values (uid, t, 'player', p_reason, left(coalesce(p_detail, ''), 200));
end $$;

-- ---------- RPC quản trị ----------
create or replace function public.admin_me() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  r := private.admin_role(uid);
  if r is null then raise exception 'not_admin'; end if;
  return jsonb_build_object('role', r, 'mfa', coalesce(auth.jwt() ->> 'aal', '') = 'aal2');
end $$;

create or replace function public.admin_dashboard_stats() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('dashboard');
  return jsonb_build_object(
    'players', (select count(*) from public.public_profiles),
    'new_today', (select count(*) from public.profiles where created_at >= date_trunc('day', now())),
    'pets_alive', (select count(*) from public.pets where stage <> 'departed'),
    'ill_now', (select count(*) from public.pets where illness is not null and stage <> 'departed'),
    'ill_by_type', coalesce((select jsonb_object_agg(illness, n) from (select illness, count(*) n from public.pets where illness is not null group by 1) x), '{}'::jsonb),
    'species_top', coalesce((select jsonb_agg(jsonb_build_object('species', species, 'n', n)) from (select species, count(*) n from public.pets where stage <> 'departed' group by 1 order by 2 desc limit 5) x), '[]'::jsonb),
    'coins_total', coalesce((select sum(coins) from public.wallets), 0),
    'friends', (select count(*) from public.friendships where status = 'accepted'),
    'gifts_7d', (select count(*) from public.mailbox where kind = 'gift' and created_at > now() - interval '7 days'),
    'mail_unclaimed', (select count(*) from public.mailbox where claimed_at is null and returned_at is null and expires_at > now()),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'sanctions_active', (select count(*) from public.sanctions where lifted_at is null and until > now()),
    'events_live', (select count(*) from public.events where enabled and starts_at <= now() and ends_at > now()));
end $$;

create or replace function public.admin_search_user(p_q text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; r text; q text := btrim(coalesce(p_q, ''));
begin
  uid := private.require_admin('search'); r := private.admin_role(uid);
  if char_length(q) < 2 then raise exception 'query_too_short'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', p.display_name, 'code', p.friend_code, 'species', p.species, 'bond_level', p.bond_level,
      'email', case when r in ('owner', 'ops', 'support') then u.email else null end))
    from (select * from public.public_profiles p where p.friend_code = upper(q) or p.display_name ilike '%' || q || '%' or p.user_id::text = lower(q) or
            (r in ('owner', 'ops', 'support') and exists (select 1 from auth.users u2 where u2.id = p.user_id and u2.email = lower(q))) limit 20) p
    join auth.users u on u.id = p.user_id), '[]'::jsonb);
end $$;

create or replace function public.admin_get_user(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; r text; res jsonb;
begin
  uid := private.require_admin('get_user'); r := private.admin_role(uid);
  res := jsonb_build_object(
    'profile', (select to_jsonb(p) - 'privacy' from public.public_profiles p where p.user_id = p_user),
    'email', case when r in ('owner', 'ops', 'support') then (select email from auth.users where id = p_user) else null end,
    'coins', (select coins from public.wallets where owner_id = p_user),
    'pet', (select jsonb_build_object('stage', stage, 'illness', illness, 'bond_xp', bond_xp, 'no', no, 'vui', vui, 'sach', sach, 'nl', nl, 'born_at', born_at) from public.pets where owner_id = p_user and stage <> 'departed'),
    'friends', private.friend_count(p_user),
    'mail', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'title', title, 'coins', coins, 'claimed', claimed_at is not null, 'at', created_at) order by created_at desc)
        from (select * from public.mailbox where to_user = p_user order by created_at desc limit 10) m), '[]'::jsonb),
    'sanctions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'until', until, 'reason', reason, 'lifted', lifted_at is not null) order by created_at desc) from public.sanctions where user_id = p_user), '[]'::jsonb),
    'reports_against', (select count(*) from public.reports where target = p_user));
  if res -> 'profile' is null or res -> 'profile' = 'null'::jsonb then raise exception 'not_found'; end if;
  perform private.audit('view_user', p_user::text, null, null, null);
  return res;
end $$;

-- Tặng quà cho một người (vào hộp thư, người nhận bấm Nhận). Hỗ trợ viên: tối đa 200 xu và 5 phần mỗi lần.
create or replace function public.admin_grant(p_user uuid, p_coins int, p_items jsonb, p_note text, p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid; r text; e jsonb; n int := 0; mid bigint;
begin
  uid := private.require_admin('grant'); r := private.admin_role(uid);
  perform private.need_reason(p_reason);
  p_items := coalesce(p_items, '[]'::jsonb); p_coins := coalesce(p_coins, 0);
  if p_coins < 0 or (p_coins = 0 and jsonb_array_length(p_items) = 0) then raise exception 'invalid_grant'; end if;
  for e in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from public.items where id = e ->> 'id' and active) or coalesce((e ->> 'qty')::int, 0) < 1 then raise exception 'invalid_grant'; end if;
    n := n + (e ->> 'qty')::int;
  end loop;
  if r <> 'owner' and (p_coins > 200 or n > 5) then raise exception 'grant_limit'; end if;
  if not exists (select 1 from public.public_profiles where user_id = p_user) then raise exception 'not_found'; end if;
  mid := private.send_mail(p_user, null, 'reward', 'Quà từ Hatchday', coalesce(p_note, ''), p_items, p_coins);
  perform private.audit('grant', p_user::text, null, jsonb_build_object('coins', p_coins, 'items', p_items, 'mail', mid), p_reason);
  return mid;
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid; old text;
begin
  uid := private.require_admin('role'); perform private.need_reason(p_reason);
  old := private.admin_role(p_user);
  if p_role is not null and p_role not in ('owner', 'ops', 'support', 'moderator', 'analyst') then raise exception 'invalid_role'; end if;
  if old = 'owner' and p_role is distinct from 'owner' and (select count(*) from public.admin_roles where role = 'owner') <= 1 then raise exception 'last_owner'; end if;
  if p_role is null then delete from public.admin_roles where user_id = p_user;
  else insert into public.admin_roles (user_id, role, created_by) values (p_user, p_role, uid) on conflict (user_id) do update set role = excluded.role; end if;
  perform private.audit('set_role', p_user::text, jsonb_build_object('role', old), jsonb_build_object('role', p_role), p_reason);
end $$;
create or replace function public.admin_list_roles() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('role');
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'role', r.role, 'email', u.email, 'since', r.created_at) order by r.created_at) from public.admin_roles r join auth.users u on u.id = r.user_id), '[]'::jsonb);
end $$;

create or replace function public.admin_list_flags() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin perform private.require_admin('flag'); return coalesce((select jsonb_object_agg(key, value) from public.system_flags), '{}'::jsonb); end $$;
create or replace function public.admin_set_flag(p_key text, p_value jsonb, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid; old jsonb;
begin
  uid := private.require_admin('flag'); perform private.need_reason(p_reason);
  if p_key not in ('chat.public.enabled', 'campaign.approval') then raise exception 'unknown_flag'; end if;
  if p_key = 'chat.public.enabled' and jsonb_typeof(p_value) <> 'boolean' then raise exception 'invalid_flag'; end if;
  select value into old from public.system_flags where key = p_key;
  insert into public.system_flags (key, value, updated_by) values (p_key, p_value, uid) on conflict (key) do update set value = excluded.value, updated_by = uid, updated_at = now();
  perform private.audit('set_flag', p_key, old, p_value, p_reason);
end $$;

create or replace function public.admin_audit_list(p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('audit');
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'admin', u.email, 'action', a.action, 'target', a.target, 'before', a.before, 'after', a.after, 'reason', a.reason, 'at', a.created_at) order by a.id desc)
    from (select * from public.admin_audit order by id desc limit least(greatest(p_limit, 1), 200)) a left join auth.users u on u.id = a.admin), '[]'::jsonb);
end $$;

-- Thông báo (tin cập nhật, bảo trì, thông báo chung)
create or replace function public.admin_list_announcements() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('announce');
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.announcements order by created_at desc limit 100) a), '[]'::jsonb);
end $$;
create or replace function public.admin_upsert_announcement(p_id bigint, p_kind text, p_title text, p_body text, p_starts timestamptz, p_ends timestamptz, p_pinned boolean, p_min_bond int, p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid; rid bigint;
begin
  uid := private.require_admin('announce'); perform private.need_reason(p_reason);
  if p_kind not in ('update', 'event', 'maintenance', 'notice') or char_length(btrim(coalesce(p_title, ''))) < 2 then raise exception 'invalid_announcement'; end if;
  if p_ends is not null and p_ends <= coalesce(p_starts, now()) then raise exception 'invalid_announcement'; end if;
  if p_id is null then
    insert into public.announcements (kind, title, body, starts_at, ends_at, pinned, min_bond, created_by)
    values (p_kind, btrim(p_title), coalesce(p_body, ''), coalesce(p_starts, now()), p_ends, coalesce(p_pinned, false), greatest(coalesce(p_min_bond, 1), 1), uid) returning id into rid;
  else
    update public.announcements set kind = p_kind, title = btrim(p_title), body = coalesce(p_body, ''), starts_at = coalesce(p_starts, starts_at), ends_at = p_ends, pinned = coalesce(p_pinned, false), min_bond = greatest(coalesce(p_min_bond, 1), 1)
    where id = p_id returning id into rid;
    if rid is null then raise exception 'not_found'; end if;
  end if;
  perform private.audit(case when p_id is null then 'announce_create' else 'announce_update' end, rid::text, null, jsonb_build_object('kind', p_kind, 'title', p_title), p_reason);
  return rid;
end $$;
create or replace function public.admin_delete_announcement(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('announce'); perform private.need_reason(p_reason);
  delete from public.announcements where id = p_id; if not found then raise exception 'not_found'; end if;
  perform private.audit('announce_delete', p_id::text, null, null, p_reason);
end $$;

-- Sự kiện (dữ liệu: biểu ngữ và trang trí Quảng trường; các mô-đun giá/xu làm ở migration hooks sau)
create or replace function public.admin_list_events() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('event');
  return coalesce((select jsonb_agg(to_jsonb(e) order by e.starts_at desc) from public.events e), '[]'::jsonb);
end $$;
create or replace function public.admin_upsert_event(p_id bigint, p_title text, p_body text, p_kind text, p_starts timestamptz, p_ends timestamptz, p_config jsonb, p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid; rid bigint;
begin
  uid := private.require_admin('event'); perform private.need_reason(p_reason);
  perform private.validate_event_config(coalesce(p_config, '{}'::jsonb));
  if p_id is null then
    insert into public.events (title, body, kind, starts_at, ends_at, config, created_by) values (btrim(p_title), coalesce(p_body, ''), p_kind, p_starts, p_ends, coalesce(p_config, '{}'::jsonb), uid) returning id into rid;
  else
    update public.events set title = btrim(p_title), body = coalesce(p_body, ''), kind = p_kind, starts_at = p_starts, ends_at = p_ends, config = coalesce(p_config, '{}'::jsonb) where id = p_id returning id into rid;
    if rid is null then raise exception 'not_found'; end if;
  end if;
  perform private.audit(case when p_id is null then 'event_create' else 'event_update' end, rid::text, null, jsonb_build_object('title', p_title, 'kind', p_kind), p_reason);
  return rid;
end $$;
create or replace function public.admin_set_event_enabled(p_id bigint, p_enabled boolean, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('event'); perform private.need_reason(p_reason);
  update public.events set enabled = p_enabled where id = p_id; if not found then raise exception 'not_found'; end if;
  perform private.audit('event_enabled', p_id::text, null, to_jsonb(p_enabled), p_reason);
end $$;

-- Chiến dịch quà: xem trước người nhận, tạo (vượt ngưỡng thì chờ người khác duyệt), duyệt, huỷ
create or replace function private.send_campaign(cid bigint) returns int
language plpgsql security definer set search_path = '' as $$
declare c public.gift_campaigns; n int;
begin
  select * into c from public.gift_campaigns where id = cid for update;
  insert into public.mailbox (to_user, from_user, kind, title, body, items, coins, expires_at)
  select u, null, 'reward', c.title, c.body, c.items, c.coins, now() + interval '30 days' from private.audience_users(c.audience) u;
  get diagnostics n = row_count;
  update public.gift_campaigns set status = 'sent', sent_at = now(), recipients = n where id = cid;
  return n;
end $$;
create or replace function public.admin_preview_audience(p_audience jsonb) returns int
language plpgsql security definer set search_path = '' as $$
begin perform private.require_admin('campaign'); return (select count(*) from private.audience_users(p_audience)); end $$;
create or replace function public.admin_create_campaign(p_title text, p_body text, p_items jsonb, p_coins int, p_audience jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; n int; cid bigint; th jsonb; e jsonb;
begin
  uid := private.require_admin('campaign'); perform private.need_reason(p_reason);
  p_items := coalesce(p_items, '[]'::jsonb); p_coins := coalesce(p_coins, 0);
  if char_length(btrim(coalesce(p_title, ''))) < 2 or (p_coins = 0 and jsonb_array_length(p_items) = 0) or p_coins < 0 then raise exception 'invalid_campaign'; end if;
  for e in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from public.items where id = e ->> 'id' and active) or coalesce((e ->> 'qty')::int, 0) < 1 then raise exception 'invalid_campaign'; end if;
  end loop;
  n := (select count(*) from private.audience_users(p_audience));
  if n = 0 then raise exception 'empty_audience'; end if;
  insert into public.gift_campaigns (title, body, items, coins, audience, status, recipients, created_by, reason) values (btrim(p_title), coalesce(p_body, ''), p_items, p_coins, p_audience, 'pending', n, uid, p_reason) returning id into cid;
  select value into th from public.system_flags where key = 'campaign.approval';
  if n <= (th ->> 'users')::int and p_coins <= (th ->> 'coins')::int then perform private.send_campaign(cid); end if; -- nhỏ thì gửi luôn
  perform private.audit('campaign_create', cid::text, null, jsonb_build_object('recipients', n, 'coins', p_coins, 'audience', p_audience), p_reason);
  return jsonb_build_object('id', cid, 'status', (select status from public.gift_campaigns where id = cid), 'recipients', n);
end $$;
create or replace function public.admin_approve_campaign(p_id bigint, p_reason text) returns int
language plpgsql security definer set search_path = '' as $$
declare uid uuid; c public.gift_campaigns; n int;
begin
  uid := private.require_admin('campaign'); perform private.need_reason(p_reason);
  select * into c from public.gift_campaigns where id = p_id for update;
  if c.id is null then raise exception 'not_found'; end if;
  if c.status <> 'pending' then raise exception 'not_pending'; end if;
  if c.created_by = uid then raise exception 'self_approval'; end if;
  update public.gift_campaigns set approved_by = uid where id = p_id;
  n := private.send_campaign(p_id);
  perform private.audit('campaign_approve', p_id::text, null, jsonb_build_object('recipients', n), p_reason);
  return n;
end $$;
create or replace function public.admin_cancel_campaign(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('campaign'); perform private.need_reason(p_reason);
  update public.gift_campaigns set status = 'cancelled' where id = p_id and status = 'pending'; if not found then raise exception 'not_pending'; end if;
  perform private.audit('campaign_cancel', p_id::text, null, null, p_reason);
end $$;
create or replace function public.admin_list_campaigns() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('campaign');
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (select * from public.gift_campaigns order by created_at desc limit 50) c), '[]'::jsonb);
end $$;

-- Kiểm duyệt: báo cáo, phạt, từ khoá
create or replace function public.admin_list_reports(p_status text default 'open') returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('report');
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'reason', r.reason, 'detail', r.detail, 'status', r.status, 'at', r.created_at,
      'reporter', private.profile_json(r.reporter) ->> 'name', 'target_id', r.target, 'target', private.profile_json(r.target) ->> 'name',
      'target_open_reports', (select count(*) from public.reports x where x.target = r.target and x.status = 'open')) order by r.created_at)
    from (select * from public.reports where status = p_status order by created_at limit 100) r), '[]'::jsonb);
end $$;
create or replace function public.admin_sanction(p_user uuid, p_kind text, p_hours int, p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid; sid bigint;
begin
  uid := private.require_admin('sanction'); perform private.need_reason(p_reason);
  if p_kind not in ('mute', 'ban') or p_hours is null or p_hours not between 1 and 24 * 365 then raise exception 'invalid_sanction'; end if;
  if private.admin_role(p_user) is not null then raise exception 'cannot_sanction_admin'; end if;
  insert into public.sanctions (user_id, kind, until, reason, by_admin) values (p_user, p_kind, now() + make_interval(hours => p_hours), p_reason, uid) returning id into sid;
  perform private.audit('sanction', p_user::text, null, jsonb_build_object('kind', p_kind, 'hours', p_hours), p_reason);
  return sid;
end $$;
create or replace function public.admin_lift_sanction(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('sanction'); perform private.need_reason(p_reason);
  update public.sanctions set lifted_at = now() where id = p_id and lifted_at is null; if not found then raise exception 'not_found'; end if;
  perform private.audit('sanction_lift', p_id::text, null, null, p_reason);
end $$;
create or replace function public.admin_list_sanctions() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('sanction');
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'user_id', s.user_id, 'name', private.profile_json(s.user_id) ->> 'name', 'kind', s.kind, 'until', s.until, 'reason', s.reason, 'auto', s.auto) order by s.created_at desc)
    from public.sanctions s where s.lifted_at is null and s.until > now()), '[]'::jsonb);
end $$;
-- Xử lý một báo cáo: bỏ qua, hoặc phạt người bị báo cáo (và đóng báo cáo)
create or replace function public.admin_resolve_report(p_id bigint, p_action text, p_hours int, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid; r public.reports;
begin
  uid := private.require_admin('report'); perform private.need_reason(p_reason);
  select * into r from public.reports where id = p_id for update;
  if r.id is null then raise exception 'not_found'; end if;
  if r.status <> 'open' then raise exception 'not_open'; end if;
  if p_action not in ('dismiss', 'mute', 'ban') then raise exception 'invalid_action'; end if;
  if p_action <> 'dismiss' then
    if private.admin_role(r.target) is not null then raise exception 'cannot_sanction_admin'; end if;
    insert into public.sanctions (user_id, kind, until, reason, by_admin) values (r.target, p_action, now() + make_interval(hours => p_hours), p_reason, uid);
  end if;
  update public.reports set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end, handled_by = uid, handled_at = now() where id = p_id;
  update public.reports set status = 'resolved', handled_by = uid, handled_at = now() where target = r.target and status = 'open' and p_action <> 'dismiss';
  perform private.audit('report_' || p_action, p_id::text, null, jsonb_build_object('target', r.target, 'hours', p_hours), p_reason);
end $$;
create or replace function public.admin_list_words() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin perform private.require_admin('word'); return coalesce((select jsonb_agg(to_jsonb(w) order by w.term) from public.word_filter w), '[]'::jsonb); end $$;
create or replace function public.admin_upsert_word(p_term text, p_match text, p_action text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('word'); perform private.need_reason(p_reason);
  if char_length(btrim(coalesce(p_term, ''))) < 2 or p_match not in ('word', 'substr') or p_action not in ('block', 'mask', 'flag') then raise exception 'invalid_word'; end if;
  insert into public.word_filter (term, match, action) values (lower(btrim(p_term)), p_match, p_action) on conflict (term) do update set match = excluded.match, action = excluded.action;
  perform private.audit('word_upsert', lower(btrim(p_term)), null, jsonb_build_object('match', p_match, 'action', p_action), p_reason);
end $$;
create or replace function public.admin_delete_word(p_term text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('word'); perform private.need_reason(p_reason);
  delete from public.word_filter where term = lower(btrim(p_term)); if not found then raise exception 'not_found'; end if;
  perform private.audit('word_delete', lower(btrim(p_term)), null, null, p_reason);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'admin\_%' or p.proname in ('get_active_events', 'get_public_config', 'report_user')) loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
