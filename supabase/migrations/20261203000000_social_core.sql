-- =====================================================================
-- Hatchday — Lõi xã hội: hồ sơ công khai, mã bạn bè, kết bạn, chặn (P5)
-- Luật ở hai nơi: src/game/social.ts (friendCap, normalizeCode, PRIVACY_KEYS) và migration này. Test: supabase/tests/social.test.ts.
-- Hồ sơ công khai (public_profiles) chỉ do trigger trên pets ghi; người chơi khác chỉ thấy qua RPC, không đọc bảng trực tiếp.
-- Không viết lại hàm nào.
-- =====================================================================

create table public.public_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  public_id    uuid not null unique default gen_random_uuid(),
  friend_code  text not null unique,
  pet_id       uuid,
  display_name text not null,
  family_name  text,
  species      text,
  stage        text,
  form         text,
  genes        jsonb not null default '{}',
  outfit       jsonb not null default '{}',
  bond_level   int  not null default 1,
  -- riêng tư: friends = 'all' | 'none' (ai được gửi lời mời); online = 'friends' | 'none'
  privacy      jsonb not null default '{"friends":"all","online":"friends"}',
  updated_at   timestamptz not null default now()
);
alter table public.public_profiles enable row level security;
create policy "public_profiles: đọc của mình" on public.public_profiles for select to authenticated using ((select auth.uid()) = user_id);

create table public.friendships (
  a            uuid not null references auth.users (id) on delete cascade,
  b            uuid not null references auth.users (id) on delete cascade,
  status       text not null check (status in ('pending', 'accepted')),
  requested_by uuid not null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  primary key (a, b),
  check (a < b),
  check (requested_by in (a, b))
);
create index friendships_b on public.friendships (b);
alter table public.friendships enable row level security;
create policy "friendships: đọc của mình" on public.friendships for select to authenticated using ((select auth.uid()) in (a, b));

create table public.blocks (
  blocker    uuid not null references auth.users (id) on delete cascade,
  blocked    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
alter table public.blocks enable row level security;
create policy "blocks: đọc của mình" on public.blocks for select to authenticated using ((select auth.uid()) = blocker);

-- ---------- Hàm nội bộ ----------
-- Hạn mức bạn bè theo cấp Gắn bó: 30 ở cấp 2 trở xuống, tăng đều tới 100 ở cấp 10
create or replace function private.friend_cap(lv int) returns int
language sql immutable set search_path = '' as $$ select floor(30 + (greatest(lv, 2) - 2) * 8.75)::int $$;

create or replace function private.new_friend_code() returns text
language plpgsql set search_path = '' as $$
declare c text; i int; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  loop
    c := '';
    for i in 1..8 loop c := c || substr(alphabet, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.public_profiles where friend_code = c);
  end loop;
  return c;
end $$;

create or replace function private.sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stage = 'departed' then return new; end if;
  insert into public.public_profiles (user_id, pet_id, display_name, family_name, species, stage, form, genes, outfit, bond_level, friend_code)
  values (new.owner_id, new.id, new.name, new.family_name, new.species, new.stage, new.form, new.genes, coalesce(new.outfit, '{}'), private.bond_level(new.bond_xp), private.new_friend_code())
  on conflict (user_id) do update set pet_id = excluded.pet_id, display_name = excluded.display_name, family_name = excluded.family_name, species = excluded.species,
    stage = excluded.stage, form = excluded.form, genes = excluded.genes, outfit = excluded.outfit, bond_level = excluded.bond_level, updated_at = now();
  return new;
end $$;
create trigger pets_profile_insert after insert on public.pets for each row execute function private.sync_profile();
create trigger pets_profile_update after update on public.pets for each row
  when (old.name is distinct from new.name or old.family_name is distinct from new.family_name or old.species is distinct from new.species or old.stage is distinct from new.stage
        or old.form is distinct from new.form or old.genes is distinct from new.genes or old.outfit is distinct from new.outfit
        or private.bond_level(old.bond_xp) is distinct from private.bond_level(new.bond_xp))
  execute function private.sync_profile();

-- Hồ sơ cho thú đã có sẵn
insert into public.public_profiles (user_id, pet_id, display_name, family_name, species, stage, form, genes, outfit, bond_level, friend_code)
select p.owner_id, p.id, p.name, p.family_name, p.species, p.stage, p.form, p.genes, coalesce(p.outfit, '{}'), private.bond_level(p.bond_xp), private.new_friend_code()
from public.pets p where p.stage <> 'departed' on conflict (user_id) do nothing;

create or replace function private.resolve_who(p_who text) returns uuid
language sql stable security definer set search_path = '' as $$
  select user_id from public.public_profiles where friend_code = upper(btrim(p_who)) or public_id::text = lower(btrim(p_who)) limit 1
$$;
create or replace function private.are_friends(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships where a = least(x, y) and b = greatest(x, y) and status = 'accepted')
$$;
create or replace function private.is_blocked(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (blocker = x and blocked = y) or (blocker = y and blocked = x))
$$;
create or replace function private.friend_count(u uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.friendships where status = 'accepted' and u in (a, b)
$$;
-- Hồ sơ mà người khác được thấy (không có mã bạn bè, không có riêng tư)
create or replace function private.profile_json(u uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('pid', public_id, 'name', display_name, 'family', family_name, 'species', species, 'stage', stage, 'form', form,
    'genes', genes, 'outfit', outfit, 'bond_level', bond_level) from public.public_profiles where user_id = u
$$;

-- ---------- RPC ----------
create or replace function public.get_social_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pr public.public_profiles;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into pr from public.public_profiles where user_id = uid;
  if pr.user_id is null then return jsonb_build_object('ready', false); end if;
  return jsonb_build_object('ready', true, 'friend_code', pr.friend_code, 'pid', pr.public_id, 'privacy', pr.privacy, 'friends', private.friend_count(uid),
    'cap', private.friend_cap(pr.bond_level),
    'requests_in', (select count(*) from public.friendships where status = 'pending' and uid in (a, b) and requested_by <> uid),
    'requests_out', (select count(*) from public.friendships where status = 'pending' and requested_by = uid));
end $$;

create or replace function public.set_privacy(p_key text, p_value text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); res jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not ((p_key = 'friends' and p_value in ('all', 'none')) or (p_key = 'online' and p_value in ('friends', 'none'))) then raise exception 'invalid_privacy'; end if;
  update public.public_profiles set privacy = jsonb_set(privacy, array[p_key], to_jsonb(p_value)) where user_id = uid returning privacy into res;
  if res is null then raise exception 'no_pet'; end if;
  return res;
end $$;

create or replace function public.find_by_code(p_who text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null or t = uid or private.is_blocked(uid, t) then raise exception 'not_found'; end if;
  return private.profile_json(t) || jsonb_build_object('friend', private.are_friends(uid, t));
end $$;

create or replace function public.send_friend_request(p_who text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid; f public.friendships; mine public.public_profiles; theirs public.public_profiles;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null then raise exception 'not_found'; end if;
  if t = uid then raise exception 'self_request'; end if;
  if private.is_blocked(uid, t) then raise exception 'blocked'; end if;
  select * into mine from public.public_profiles where user_id = uid;
  select * into theirs from public.public_profiles where user_id = t;
  if mine.user_id is null then raise exception 'no_pet'; end if;
  select * into f from public.friendships where a = least(uid, t) and b = greatest(uid, t);
  if f.a is not null and f.status = 'accepted' then raise exception 'already_friends'; end if;
  if f.a is not null and f.status = 'pending' and f.requested_by = uid then raise exception 'already_requested'; end if;
  if theirs.privacy ->> 'friends' = 'none' then raise exception 'not_accepting'; end if;
  if private.friend_count(uid) >= private.friend_cap(mine.bond_level) then raise exception 'friend_cap'; end if;
  if private.friend_count(t) >= private.friend_cap(theirs.bond_level) then raise exception 'their_friend_cap'; end if;
  if (select count(*) from public.friendships where requested_by = uid and status = 'pending') >= 20 then raise exception 'too_many_requests'; end if;
  if f.a is not null then -- họ đã gửi lời mời cho mình: coi như đồng ý
    update public.friendships set status = 'accepted', accepted_at = now() where a = f.a and b = f.b;
    return jsonb_build_object('status', 'accepted');
  end if;
  insert into public.friendships (a, b, status, requested_by) values (least(uid, t), greatest(uid, t), 'pending', uid);
  return jsonb_build_object('status', 'pending');
end $$;

create or replace function public.respond_friend_request(p_who text, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid; f public.friendships; mine public.public_profiles; theirs public.public_profiles;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  select * into f from public.friendships where t is not null and a = least(uid, t) and b = greatest(uid, t) and status = 'pending' and requested_by = t;
  if f.a is null then raise exception 'not_found'; end if;
  if not p_accept then delete from public.friendships where a = f.a and b = f.b; return jsonb_build_object('status', 'declined'); end if;
  select * into mine from public.public_profiles where user_id = uid; select * into theirs from public.public_profiles where user_id = t;
  if private.friend_count(uid) >= private.friend_cap(mine.bond_level) then raise exception 'friend_cap'; end if;
  if private.friend_count(t) >= private.friend_cap(theirs.bond_level) then raise exception 'their_friend_cap'; end if;
  update public.friendships set status = 'accepted', accepted_at = now() where a = f.a and b = f.b;
  return jsonb_build_object('status', 'accepted');
end $$;

create or replace function public.remove_friend(p_who text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null then raise exception 'not_found'; end if;
  delete from public.friendships where a = least(uid, t) and b = greatest(uid, t);
end $$;

create or replace function public.block_user(p_who text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null or t = uid then raise exception 'not_found'; end if;
  delete from public.friendships where a = least(uid, t) and b = greatest(uid, t);
  insert into public.blocks (blocker, blocked) values (uid, t) on conflict do nothing;
end $$;

create or replace function public.unblock_user(p_who text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null then raise exception 'not_found'; end if;
  delete from public.blocks where blocker = uid and blocked = t;
end $$;

create or replace function public.list_friends() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return coalesce((select jsonb_agg(private.profile_json(case when f.a = uid then f.b else f.a end) || jsonb_build_object('since', f.accepted_at) order by f.accepted_at desc)
    from public.friendships f where f.status = 'accepted' and uid in (f.a, f.b)), '[]'::jsonb);
end $$;

create or replace function public.list_requests() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return jsonb_build_object(
    'incoming', coalesce((select jsonb_agg(private.profile_json(f.requested_by) order by f.created_at desc) from public.friendships f where f.status = 'pending' and uid in (f.a, f.b) and f.requested_by <> uid), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(private.profile_json(case when f.a = uid then f.b else f.a end) order by f.created_at desc) from public.friendships f where f.status = 'pending' and f.requested_by = uid), '[]'::jsonb));
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_social_state(), public.set_privacy(text, text), public.find_by_code(text), public.send_friend_request(text), public.respond_friend_request(text, boolean),
  public.remove_friend(text), public.block_user(text), public.unblock_user(text), public.list_friends(), public.list_requests() from public, anon;
grant execute on function public.get_social_state(), public.set_privacy(text, text), public.find_by_code(text), public.send_friend_request(text), public.respond_friend_request(text, boolean),
  public.remove_friend(text), public.block_user(text), public.unblock_user(text), public.list_friends(), public.list_requests() to authenticated;
