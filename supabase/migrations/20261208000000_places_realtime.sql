-- =====================================================================
-- Hatchday — Nơi chung (Quảng trường, Tiệm trà, Công viên): vào kênh, nhịp tim, danh sách người trong kênh, chính sách Realtime (P11)
-- Luật ở hai nơi: src/game/places/registry.ts (unlock, cap) và migration này. Test: supabase/tests/places.test.ts.
-- Người khác chỉ thấy `pid` ngẫu nhiên (public_profiles.public_id), không thấy auth.uid hay mã bạn bè.
-- Chính sách realtime.messages gọi thẳng bảng place_members (không gọi hàm private.*, vì khối revoke ở mỗi migration sẽ làm hỏng).
-- Hàm viết lại nguyên cả hàm, đã đối chiếu với bản mới nhất (20261206000000_admin.sql): public.admin_set_flag (thêm cờ places.enabled).
-- =====================================================================

create table public.place_members (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  place     text not null check (place in ('plaza', 'tea', 'park')),
  shard     int  not null check (shard >= 1),
  topic     text not null,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index place_members_topic on public.place_members (topic, last_seen);
alter table public.place_members enable row level security;
create policy "place_members: đọc của mình" on public.place_members for select to authenticated using ((select auth.uid()) = user_id);

insert into public.system_flags (key, value) values ('places.enabled', 'true') on conflict do nothing;

-- ---------- Luật nơi chung ----------
create or replace function private.place_unlock(p text) returns int
language sql immutable set search_path = '' as $$ select case p when 'plaza' then 2 when 'tea' then 3 when 'park' then 4 end $$;
create or replace function private.place_cap(p text) returns int
language sql immutable set search_path = '' as $$ select case p when 'plaza' then 12 when 'tea' then 16 when 'park' then 16 end $$;
create or replace function private.place_max_shards() returns int
language sql immutable set search_path = '' as $$ select 20 $$;

create or replace function public.join_place(p_place text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); lvl int; cap int; sh int; pid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_place is null or p_place not in ('plaza', 'tea', 'park') then raise exception 'unknown_place'; end if;
  if coalesce((select value from public.system_flags where key = 'places.enabled'), 'true'::jsonb) is distinct from 'true'::jsonb then raise exception 'place_closed'; end if;
  select bond_level, public_id into lvl, pid from public.public_profiles where user_id = uid;
  if lvl is null then raise exception 'no_pet'; end if;
  if lvl < private.place_unlock(p_place) then raise exception 'bond_too_low'; end if;
  cap := private.place_cap(p_place);
  perform pg_advisory_xact_lock(hashtext('place:' || p_place));
  delete from public.place_members where user_id = uid;

  -- 1) kênh đang có bạn bè và còn chỗ
  select m.shard into sh from public.place_members m
    join public.friendships f on f.status = 'accepted' and ((f.a = uid and f.b = m.user_id) or (f.b = uid and f.a = m.user_id))
    where m.place = p_place and m.last_seen > now() - interval '120 seconds'
      and (select count(*) from public.place_members x where x.topic = m.topic and x.last_seen > now() - interval '120 seconds') < cap
    order by m.last_seen desc limit 1;
  -- 2) kênh đông nhất còn chỗ (gom người lại với nhau)
  if sh is null then
    select m.shard into sh from public.place_members m
      where m.place = p_place and m.last_seen > now() - interval '120 seconds'
      group by m.shard having count(*) < cap order by count(*) desc, m.shard limit 1;
  end if;
  -- 3) kênh mới (số nhỏ nhất đang trống), tối đa max_shards
  if sh is null then
    select g into sh from generate_series(1, private.place_max_shards()) g
      where not exists (select 1 from public.place_members x where x.place = p_place and x.shard = g and x.last_seen > now() - interval '120 seconds')
      order by g limit 1;
  end if;
  if sh is null then raise exception 'place_full'; end if;

  insert into public.place_members (user_id, place, shard, topic) values (uid, p_place, sh, p_place || ':' || sh);
  return jsonb_build_object('room', p_place || ':' || sh, 'topic', p_place || ':' || sh, 'place', p_place, 'shard', sh, 'cap', cap, 'pid', pid);
end $$;

create or replace function public.place_heartbeat() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  update public.place_members set last_seen = now() where user_id = uid returning topic into t;
  if t is null then raise exception 'not_in_place'; end if;
  return jsonb_build_object('topic', t);
end $$;

create or replace function public.leave_place() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  delete from public.place_members where user_id = uid;
end $$;

-- Số người đang ở mỗi nơi chung (hoạt động trong 120 giây gần đây), để hiện huy hiệu trên Bản đồ.
create or replace function public.places_summary() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return jsonb_build_object(
    'plaza', (select count(*) from public.place_members where place = 'plaza' and last_seen > now() - interval '120 seconds'),
    'tea', (select count(*) from public.place_members where place = 'tea' and last_seen > now() - interval '120 seconds'),
    'park', (select count(*) from public.place_members where place = 'park' and last_seen > now() - interval '120 seconds'));
end $$;

-- Danh sách người trong kênh của mình: chỉ hồ sơ công khai (pid, tên, dáng), bỏ người đã chặn hoặc chặn mình.
create or replace function public.shard_roster(p_topic text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.place_members where user_id = uid and topic = p_topic and last_seen > now() - interval '120 seconds') then raise exception 'not_in_place'; end if;
  return coalesce((select jsonb_agg(private.profile_json(m.user_id)) from public.place_members m
    where m.topic = p_topic and m.user_id <> uid and m.last_seen > now() - interval '120 seconds' and not private.is_blocked(uid, m.user_id)), '[]'::jsonb);
end $$;

-- ---------- Chính sách Realtime: chỉ người đang ở trong kênh mới nghe và nói được ----------
-- Chỉ tạo khi có bảng realtime.messages (Supabase luôn có; một số khung test cũ không có schema realtime).
do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute $p$create policy "places: nghe kênh của mình" on realtime.messages for select to authenticated using (
      exists (select 1 from public.place_members m where m.user_id = (select auth.uid()) and m.topic = (select realtime.topic()) and m.last_seen > now() - interval '120 seconds'))$p$;
    execute $p$create policy "places: nói trong kênh của mình" on realtime.messages for insert to authenticated with check (
      exists (select 1 from public.place_members m where m.user_id = (select auth.uid()) and m.topic = (select realtime.topic()) and m.last_seen > now() - interval '120 seconds'))$p$;
  end if;
end $$;

-- ---------- Công tắc khẩn: thêm cờ places.enabled ----------
create or replace function public.admin_set_flag(p_key text, p_value jsonb, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid; old jsonb;
begin
  uid := private.require_admin('flag'); perform private.need_reason(p_reason);
  if p_key not in ('chat.public.enabled', 'campaign.approval', 'places.enabled') then raise exception 'unknown_flag'; end if;
  if p_key in ('chat.public.enabled', 'places.enabled') and jsonb_typeof(p_value) <> 'boolean' then raise exception 'invalid_flag'; end if;
  select value into old from public.system_flags where key = p_key;
  insert into public.system_flags (key, value, updated_by) values (p_key, p_value, uid) on conflict (key) do update set value = excluded.value, updated_by = uid, updated_at = now();
  perform private.audit('set_flag', p_key, old, p_value, p_reason);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.join_place(text), public.place_heartbeat(), public.leave_place(), public.places_summary(), public.shard_roster(text) from public, anon;
grant execute on function public.join_place(text), public.place_heartbeat(), public.leave_place(), public.places_summary(), public.shard_roster(text) to authenticated;
