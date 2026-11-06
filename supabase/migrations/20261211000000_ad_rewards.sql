-- =====================================================================
-- Hatchday — Quảng cáo thưởng (xem video nhận xu) (P16)
-- Luật ở hai nơi: src/game/ads.ts (AD) và migration này. Test: supabase/tests/ads.test.ts.
-- Máy chủ quyết định: start_ad_reward cấp mã dùng một lần (hết hạn 5 phút), claim_ad_reward kiểm mã, thời gian đã trôi, trần ngày, giãn cách.
-- Quảng cáo web không có xác minh phía máy chủ như bản di động, nên chống gian lận bằng các giới hạn trên (xem README: ad_rewards để dò bất thường).
-- Không đổi quảng cáo lấy thuốc hay đồ cứu bé. Cờ ads.enabled mặc định TẮT (chờ AdSense/H5 Games Ads duyệt).
-- Hàm viết lại nguyên cả hàm, đã đối chiếu với bản mới nhất (20261208000000_places_realtime.sql): public.admin_set_flag (thêm cờ ads.enabled).
-- =====================================================================

create table public.ad_rewards (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   int  not null default 0,
  last_at timestamptz,
  primary key (user_id, day)
);
create table public.ad_nonces (
  nonce     uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  issued_at timestamptz not null default now(),
  used_at   timestamptz
);
create index ad_nonces_user on public.ad_nonces (user_id, issued_at desc);
alter table public.ad_rewards enable row level security;
alter table public.ad_nonces enable row level security;
insert into public.system_flags (key, value) values ('ads.enabled', 'false') on conflict do nothing;

create or replace function private.ad_reward() returns int language sql immutable set search_path = '' as $$ select 20 $$;
create or replace function private.ad_per_day() returns int language sql immutable set search_path = '' as $$ select 5 $$;
create or replace function private.ad_gap_minutes() returns int language sql immutable set search_path = '' as $$ select 10 $$;
create or replace function private.ad_min_watch_seconds() returns int language sql immutable set search_path = '' as $$ select 15 $$;
create or replace function private.ad_nonce_minutes() returns int language sql immutable set search_path = '' as $$ select 5 $$;

create or replace function private.ad_check_limits(uid uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare r public.ad_rewards; d date := private.local_day(uid);
begin
  select * into r from public.ad_rewards where user_id = uid and day = d;
  if r.user_id is not null then
    if r.count >= private.ad_per_day() then raise exception 'ad_limit'; end if;
    if r.last_at > now() - make_interval(mins => private.ad_gap_minutes()) then raise exception 'ad_too_soon'; end if;
  end if;
  return private.ad_per_day() - coalesce(r.count, 0);
end $$;

create or replace function public.start_ad_reward() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); left_n int; n uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if coalesce((select value from public.system_flags where key = 'ads.enabled'), 'false'::jsonb) is distinct from 'true'::jsonb then raise exception 'ads_disabled'; end if;
  left_n := private.ad_check_limits(uid);
  delete from public.ad_nonces where user_id = uid and used_at is null;
  insert into public.ad_nonces (user_id) values (uid) returning nonce into n;
  return jsonb_build_object('nonce', n, 'reward', private.ad_reward(), 'left', left_n, 'wait', private.ad_min_watch_seconds());
end $$;

create or replace function public.claim_ad_reward(p_nonce uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); nn public.ad_nonces; left_n int; age double precision;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if coalesce((select value from public.system_flags where key = 'ads.enabled'), 'false'::jsonb) is distinct from 'true'::jsonb then raise exception 'ads_disabled'; end if;
  select * into nn from public.ad_nonces where nonce = p_nonce and user_id = uid for update;
  if nn.nonce is null or nn.used_at is not null then raise exception 'ad_invalid'; end if;
  age := extract(epoch from now() - nn.issued_at);
  if age < private.ad_min_watch_seconds() then raise exception 'ad_too_fast'; end if;
  if age > private.ad_nonce_minutes() * 60 then raise exception 'ad_expired'; end if;
  left_n := private.ad_check_limits(uid);
  update public.ad_nonces set used_at = now() where nonce = p_nonce;
  insert into public.ad_rewards (user_id, day, count, last_at) values (uid, private.local_day(uid), 1, now())
  on conflict (user_id, day) do update set count = public.ad_rewards.count + 1, last_at = now();
  perform private.earn(uid, private.ad_reward(), false);
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'reward', private.ad_reward(), 'left', left_n - 1);
end $$;

-- Cho client biết còn mấy lượt hôm nay và đã bật chưa (không cấp mã).
create or replace function public.get_ad_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.ad_rewards; d date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  d := private.local_day(uid); select * into r from public.ad_rewards where user_id = uid and day = d;
  return jsonb_build_object('enabled', coalesce((select value from public.system_flags where key = 'ads.enabled'), 'false'::jsonb), 'left', private.ad_per_day() - coalesce(r.count, 0),
    'next_in', greatest(0, ceil(extract(epoch from coalesce(r.last_at, now() - interval '1 day') + make_interval(mins => private.ad_gap_minutes()) - now())))::int,
    'reward', private.ad_reward(), 'per_day', private.ad_per_day());
end $$;

create or replace function public.admin_set_flag(p_key text, p_value jsonb, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid; old jsonb;
begin
  uid := private.require_admin('flag'); perform private.need_reason(p_reason);
  if p_key not in ('chat.public.enabled', 'campaign.approval', 'places.enabled', 'ads.enabled') then raise exception 'unknown_flag'; end if;
  if p_key in ('chat.public.enabled', 'places.enabled', 'ads.enabled') and jsonb_typeof(p_value) <> 'boolean' then raise exception 'invalid_flag'; end if;
  select value into old from public.system_flags where key = p_key;
  insert into public.system_flags (key, value, updated_by) values (p_key, p_value, uid) on conflict (key) do update set value = excluded.value, updated_by = uid, updated_at = now();
  perform private.audit('set_flag', p_key, old, p_value, p_reason);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.start_ad_reward(), public.claim_ad_reward(uuid), public.get_ad_state() from public, anon;
grant execute on function public.start_ad_reward(), public.claim_ad_reward(uuid), public.get_ad_state() to authenticated;
