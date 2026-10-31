-- =====================================================================
-- Thú ảo đồng hành — schema khởi tạo (giai đoạn 1: MVP chơi một mình)
-- Nguyên tắc: server là nguồn sự thật cho chỉ số, thời gian và phần thưởng.
-- Client chỉ ĐỌC bảng qua RLS và GHI qua các hàm RPC đã kiểm tra.
-- =====================================================================

create schema if not exists private;

-- ---------- Hồ sơ người chơi ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  timezone    text not null default 'Asia/Ho_Chi_Minh' check (char_length(timezone) <= 64),
  created_at  timestamptz not null default now()
);

-- ---------- Thú ----------
create table public.pets (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 16),
  family_name   text not null check (char_length(family_name) between 1 and 16),
  generation    int  not null default 1,
  stage         text not null default 'baby' check (stage in ('egg', 'baby', 'teen', 'adult', 'departed')),
  genes         jsonb not null,
  personality   jsonb not null default '{"energy":0,"social":0,"curious":0,"playful":0,"affection":0}',
  no            real not null default 72 check (no   between 0 and 100),
  vui           real not null default 74 check (vui  between 0 and 100),
  nl            real not null default 82 check (nl   between 0 and 100),
  sach          real not null default 85 check (sach between 0 and 100),
  asleep        boolean not null default false,
  stats_at      timestamptz not null default now(),
  bond_xp       int not null default 0,
  born_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create unique index pets_one_active_per_owner on public.pets (owner_id) where stage <> 'departed';

-- Thông tin ẩn: client không đọc được (RLS bật, không có policy)
create table public.pet_secrets (
  pet_id         uuid primary key references public.pets (id) on delete cascade,
  lifespan_days  int  not null check (lifespan_days between 30 and 60),
  favorite_food  text not null,
  disliked_food  text not null
);

-- ---------- Vật phẩm & quyền sở hữu (sẵn cho cosmetic sau này) ----------
create table public.items (
  id           text primary key,
  kind         text not null check (kind in ('food', 'decor', 'outfit')),
  name         text not null,
  effects      jsonb not null default '{}',
  price_coins  int,
  active       boolean not null default true
);
create table public.entitlements (
  owner_id    uuid not null references auth.users (id) on delete cascade,
  item_id     text not null references public.items (id),
  source      text not null check (source in ('starter', 'coins', 'gift', 'event', 'purchase')),
  qty         int  not null default 1 check (qty >= 0),
  created_at  timestamptz not null default now(),
  primary key (owner_id, item_id)
);

-- ---------- Ký ức, nhật ký, nhật ký hoạt động ----------
create table public.memories (
  id          bigint generated always as identity primary key,
  pet_id      uuid not null references public.pets (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('meet', 'food', 'bath', 'play', 'talk', 'milestone')),
  body        text not null check (char_length(body) <= 200),
  first_key   text,
  created_at  timestamptz not null default now()
);
create unique index memories_first_once on public.memories (pet_id, first_key) where first_key is not null;
create index memories_pet_recent on public.memories (pet_id, created_at desc);

create table public.day_logs (
  pet_id    uuid not null references public.pets (id) on delete cascade,
  owner_id  uuid not null references auth.users (id) on delete cascade,
  day       date not null,
  fed       int  not null default 0,
  foods     text[] not null default '{}',
  bath      int  not null default 0,
  ball      int  not null default 0,
  pet       int  not null default 0,
  talk      int  not null default 0,
  sleep     int  not null default 0,
  primary key (pet_id, day)
);

-- Trang nhật ký do AI viết (giai đoạn sau). Hiện client tự ghép từ day_logs.
create table public.diary_entries (
  pet_id      uuid not null references public.pets (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  day         date not null,
  body        text not null check (char_length(body) <= 2000),
  source      text not null default 'ai' check (source in ('template', 'ai')),
  created_at  timestamptz not null default now(),
  primary key (pet_id, day)
);

create table public.action_log (
  id          bigint generated always as identity primary key,
  pet_id      uuid not null references public.pets (id) on delete cascade,
  action      text not null,
  created_at  timestamptz not null default now()
);
create index action_log_pet_time on public.action_log (pet_id, created_at desc);

-- ---------- Dữ liệu khởi tạo ----------
insert into public.items (id, kind, name, effects) values
  ('carot',  'food', 'Cà rốt',  '{"no":10,"vui":2,"group":"rau"}'),
  ('comnam', 'food', 'Cơm nắm', '{"no":25,"vui":3,"group":"tinhbot"}'),
  ('kem',    'food', 'Kem que', '{"no":5,"vui":15,"group":"ngot"}'),
  ('che',    'food', 'Chè đậu', '{"no":15,"vui":12,"group":"ngot"}');

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.pets          enable row level security;
alter table public.pet_secrets   enable row level security;
alter table public.items         enable row level security;
alter table public.entitlements  enable row level security;
alter table public.memories      enable row level security;
alter table public.day_logs      enable row level security;
alter table public.diary_entries enable row level security;
alter table public.action_log    enable row level security;

create policy "profiles: đọc của mình"   on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: sửa của mình"   on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "pets: đọc của mình"       on public.pets for select to authenticated using ((select auth.uid()) = owner_id);
create policy "items: ai cũng đọc"       on public.items for select to authenticated using (active);
create policy "entitlements: của mình"   on public.entitlements for select to authenticated using ((select auth.uid()) = owner_id);
create policy "memories: đọc của mình"   on public.memories for select to authenticated using ((select auth.uid()) = owner_id);
create policy "memories: xoá của mình"   on public.memories for delete to authenticated using ((select auth.uid()) = owner_id);
create policy "day_logs: đọc của mình"   on public.day_logs for select to authenticated using ((select auth.uid()) = owner_id);
create policy "diary: đọc của mình"      on public.diary_entries for select to authenticated using ((select auth.uid()) = owner_id);
-- pet_secrets, action_log: không có policy → client không truy cập được.

-- =====================================================================
-- Hàm nội bộ
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function private.clamp(v real) returns real
language sql immutable as $$ select greatest(0, least(100, v)) $$;

-- Áp chỉ số theo thời gian thực của server (tối đa 3 ngày một lần tính)
create or replace function private.decay_pet(pid uuid) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare p public.pets; mins double precision;
begin
  select * into p from public.pets where id = pid for update;
  mins := least(extract(epoch from (now() - p.stats_at)) / 60.0, 4320);
  if mins > 0 then
    update public.pets set
      no   = private.clamp((no   - mins * 0.9)::real),
      vui  = private.clamp((vui  - mins * 0.5)::real),
      sach = private.clamp((sach - mins * 0.35)::real),
      nl   = private.clamp((case when asleep then nl + mins * 3 else nl - mins * 0.45 end)::real),
      stats_at = now()
    where id = pid
    returning * into p;
  end if;
  return p;
end $$;

create or replace function private.local_day(uid uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select timezone from public.profiles where id = uid), 'Asia/Ho_Chi_Minh'))::date
$$;

create or replace function private.active_pet_id(uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.pets where owner_id = uid and stage <> 'departed' limit 1
$$;

create or replace function private.remember_first(pid uuid, uid uuid, k text, kind text, body text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.memories (pet_id, owner_id, kind, body, first_key) values (pid, uid, kind, body, k)
  on conflict (pet_id, first_key) where first_key is not null do nothing;
  return found;
end $$;

-- =====================================================================
-- RPC cho client
-- =====================================================================
create or replace function public.get_my_pet() returns public.pets
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  pid := private.active_pet_id(uid);
  if pid is null then return null; end if;
  return private.decay_pet(pid);
end $$;

create or replace function public.create_pet(p_name text, p_family text, p_egg int) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.pets; foods text[]; fav text; dis text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if private.active_pet_id(uid) is not null then raise exception 'pet_exists'; end if;
  p_name := btrim(p_name); p_family := btrim(p_family);
  if char_length(p_name) not between 1 and 16 or char_length(p_family) not between 1 and 16 then raise exception 'invalid_name'; end if;
  if p_egg not between 0 and 2 then raise exception 'invalid_egg'; end if;

  insert into public.pets (owner_id, name, family_name, genes)
  values (uid, p_name, p_family, jsonb_build_object(
    'palette', p_egg,
    'ear',     floor(random() * 4)::int,
    'sprout',  floor(random() * 3)::int,
    'scale',   round((0.95 + random() * 0.1)::numeric, 3)))
  returning * into p;

  select array_agg(id order by random()) into foods from public.items where kind = 'food' and active;
  fav := foods[1]; dis := foods[2];
  insert into public.pet_secrets (pet_id, lifespan_days, favorite_food, disliked_food)
  values (p.id, 30 + floor(random() * 31)::int, fav, dis);

  insert into public.entitlements (owner_id, item_id, source, qty)
  select uid, id, 'starter', 1 from public.items where kind = 'food' and active
  on conflict do nothing;

  perform private.remember_first(p.id, uid, 'meet', 'meet', format('Ngày đầu tiên gặp bạn. Bạn đặt tên mình là %s.', p_name));
  return p;
end $$;

create or replace function public.rename_pet(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  p_name := btrim(p_name);
  if char_length(p_name) not between 1 and 16 then raise exception 'invalid_name'; end if;
  update public.pets set name = p_name where id = private.active_pet_id(uid);
end $$;

-- Mọi hành động chăm sóc đi qua đây: kiểm tra, áp dụng, ghi nhật ký, trả về chỉ số mới.
create or replace function public.pet_action(p_action text, p_item text default null, p_count int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); pid uuid; p public.pets; s public.pet_secrets; it public.items;
  n int := greatest(1, least(coalesce(p_count, 1), 20));
  d date; refused text := null; fav boolean := false; recent int; first_new boolean := false;
  dno real := 0; dvui real := 0; dnl real := 0; dsach real := 0;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  pid := private.active_pet_id(uid);
  if pid is null then raise exception 'no_pet'; end if;

  select count(*) into recent from public.action_log where pet_id = pid and created_at > now() - interval '10 seconds';
  if recent >= 30 then raise exception 'rate_limited'; end if;

  p := private.decay_pet(pid);
  select * into s from public.pet_secrets where pet_id = pid;
  d := private.local_day(uid);
  insert into public.day_logs (pet_id, owner_id, day) values (pid, uid, d) on conflict do nothing;

  if p.asleep and p_action not in ('wake', 'pet') then
    refused := 'asleep';
  elsif p_action = 'feed' then
    select * into it from public.items where id = p_item and kind = 'food' and active;
    if it.id is null then raise exception 'unknown_item'; end if;
    if not exists (select 1 from public.entitlements where owner_id = uid and item_id = it.id and qty > 0) then raise exception 'not_owned'; end if;
    if p.no >= 90 then refused := 'full';
    else
      fav := (it.id = s.favorite_food);
      dno := (it.effects ->> 'no')::real; dvui := (it.effects ->> 'vui')::real + (case when fav then 10 else 0 end);
      if it.id = s.disliked_food then dvui := dvui - 6; end if;
      dsach := -2;
      update public.day_logs set fed = fed + 1, foods = array_append(foods, it.name) where pet_id = pid and day = d;
      first_new := private.remember_first(pid, uid, 'food-' || it.id, 'food',
        case when fav then format('Lần đầu ăn %s, hoá ra là món tủ của mình!', it.name) else format('Lần đầu được ăn %s.', it.name) end);
    end if;
  elsif p_action = 'pet' then
    dvui := 1.6 * n;
    update public.day_logs set pet = pet + n where pet_id = pid and day = d;
  elsif p_action = 'bath_scrub' then
    dsach := 3 * n;
  elsif p_action = 'bath_rinse' then
    dsach := 100; dvui := 4;
    update public.day_logs set bath = bath + 1 where pet_id = pid and day = d;
    first_new := private.remember_first(pid, uid, 'bath', 'bath', 'Lần đầu được tắm bồn với vịt cao su.');
  elsif p_action in ('play_ball', 'play_spin') then
    if p.nl < 15 then refused := 'tired';
    else
      dvui := case when p_action = 'play_ball' then 8 else 6 end; dnl := -4; dno := -2;
      if p_action = 'play_ball' then
        update public.day_logs set ball = ball + 1 where pet_id = pid and day = d;
        first_new := private.remember_first(pid, uid, 'ball', 'play', 'Lần đầu chơi ném bóng ngoài vườn.');
      end if;
    end if;
  elsif p_action = 'talk' then
    dvui := 2;
    update public.day_logs set talk = talk + 1 where pet_id = pid and day = d;
  elsif p_action = 'sleep' then
    update public.pets set asleep = true where id = pid;
    update public.day_logs set sleep = sleep + 1 where pet_id = pid and day = d;
  elsif p_action = 'wake' then
    update public.pets set asleep = false where id = pid;
  else
    raise exception 'unknown_action';
  end if;

  if refused is null then
    update public.pets set
      no = private.clamp(no + dno), vui = private.clamp(vui + dvui), nl = private.clamp(nl + dnl),
      sach = case when p_action = 'bath_rinse' then 100 else private.clamp(sach + dsach) end,
      bond_xp = bond_xp + 1
    where id = pid;
    insert into public.action_log (pet_id, action) values (pid, p_action);
  end if;

  select * into p from public.pets where id = pid;
  return jsonb_build_object('pet', to_jsonb(p), 'refused', refused, 'fav', fav, 'new_memory', first_new);
end $$;

create or replace function public.add_talk_memory(p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid; today_count int;
begin
  pid := private.active_pet_id(uid);
  if pid is null then raise exception 'no_pet'; end if;
  p_text := left(btrim(p_text), 120);
  if char_length(p_text) < 4 then return; end if;
  select count(*) into today_count from public.memories where pet_id = pid and kind = 'talk' and created_at > now() - interval '1 day';
  if today_count >= 20 then return; end if;
  insert into public.memories (pet_id, owner_id, kind, body) values (pid, uid, 'talk', format('Bạn kể: “%s”', p_text));
end $$;

-- ---------- Quyền thực thi ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.get_my_pet(), public.create_pet(text, text, int), public.rename_pet(text),
  public.pet_action(text, text, int), public.add_talk_memory(text) from public, anon;
grant execute on function public.get_my_pet(), public.create_pet(text, text, int), public.rename_pet(text),
  public.pet_action(text, text, int), public.add_talk_memory(text) to authenticated;
