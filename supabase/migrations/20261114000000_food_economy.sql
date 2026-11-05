-- =====================================================================
-- Hatchday — Hệ thống thức ăn (kho, mua bằng xu, ăn cân bằng) và nhiệm vụ kiếm xu (5 nhiệm vụ ngày + thưởng, 3 nhiệm vụ tuần)
-- Phần seed thức ăn sinh từ src/game/catalog.ts (scripts/gen-seed.ts). Đừng sửa tay.
-- Luật ở hai nơi: catalog.ts (FOODS, FOOD_STOCK), nutrition.ts, layout.ts (QUEST_POOL, WEEKLY_POOL). Test so khớp hai bên.
--
-- Hàm viết lại nguyên cả hàm (create or replace), đã đối chiếu với bản mới nhất trên main:
--   public.pet_action (nhánh 'feed': trừ kho, nhóm dinh dưỡng, cân bằng), public.get_economy (thêm ration_claimed),
--   public.get_quests (đổi dạng trả về), public.claim_quest (thưởng theo nhiệm vụ).
-- create_pet KHÔNG bị viết lại: tặng kho thức ăn ban đầu bằng trigger.
-- =====================================================================

-- ---------- Thức ăn: giá, nhóm dinh dưỡng, bán ở chợ ----------
-- FOODS
insert into public.items (id, kind, name, effects, price_coins, source, rarity) values
  ('comnam', 'food', 'Cơm nắm', '{"no":25,"vui":3,"group":"tinhbot"}', 15, 'market', 'thuong'),
  ('bap-nuong', 'food', 'Bắp nướng', '{"no":22,"vui":7,"group":"tinhbot"}', 22, 'market', 'thuong'),
  ('banh-mi', 'food', 'Bánh mì', '{"no":28,"vui":6,"group":"tinhbot"}', 32, 'market', 'thuong'),
  ('carot', 'food', 'Cà rốt', '{"no":10,"vui":2,"group":"rau"}', 12, 'market', 'thuong'),
  ('canh-rau', 'food', 'Canh rau', '{"no":16,"vui":3,"group":"rau"}', 18, 'market', 'thuong'),
  ('trung-op', 'food', 'Trứng ốp la', '{"no":20,"vui":4,"group":"dam"}', 24, 'market', 'thuong'),
  ('ca-vien', 'food', 'Cá viên chiên', '{"no":14,"vui":12,"group":"dam"}', 30, 'market', 'thuong'),
  ('sua-chua', 'food', 'Sữa chua', '{"no":12,"vui":9,"group":"dam"}', 20, 'market', 'thuong'),
  ('chuoi', 'food', 'Chuối', '{"no":12,"vui":5,"group":"traicay"}', 14, 'market', 'thuong'),
  ('dua-hau', 'food', 'Dưa hấu', '{"no":14,"vui":8,"group":"traicay"}', 20, 'market', 'thuong'),
  ('kem', 'food', 'Kem que', '{"no":5,"vui":15,"group":"ngot"}', 22, 'market', 'thuong'),
  ('che', 'food', 'Chè đậu', '{"no":15,"vui":12,"group":"ngot"}', 28, 'market', 'thuong')
on conflict (id) do update set name = excluded.name, effects = excluded.effects, price_coins = excluded.price_coins, source = excluded.source, rarity = excluded.rarity;

-- ---------- Nhật ký ngày: ghi lại nhóm dinh dưỡng đã ăn ----------
alter table public.day_logs add column fgroups text[] not null default '{}';

-- ---------- Kho thức ăn ban đầu: mỗi bé mới tặng 2 phần mỗi món (giống FOOD_STOCK.start) ----------
create or replace function private.pet_starter_food() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.entitlements (owner_id, item_id, source, qty)
  select new.owner_id, id, 'starter', 2 from public.items where kind = 'food' and active
  on conflict (owner_id, item_id) do update set qty = greatest(public.entitlements.qty, 2);
  return new;
end $$;
create trigger pets_starter_food after insert on public.pets for each row execute function private.pet_starter_food();

-- Người chơi đã có thú: bổ sung kho cho đủ 2 phần mỗi món
insert into public.entitlements (owner_id, item_id, source, qty)
select p.owner_id, i.id, 'starter', 2 from (select distinct owner_id from public.pets) p cross join public.items i where i.kind = 'food' and i.active
on conflict (owner_id, item_id) do update set qty = greatest(public.entitlements.qty, 2);

-- ---------- Suất ăn miễn phí mỗi ngày ----------
create table public.ration_claims (
  owner_id  uuid not null references auth.users (id) on delete cascade,
  day       date not null,
  primary key (owner_id, day)
);
alter table public.ration_claims enable row level security;
create policy "ration: đọc của mình" on public.ration_claims for select to authenticated using ((select auth.uid()) = owner_id);

-- ---------- Nhiệm vụ: thêm thưởng cả ngày (idx 5) và nhiệm vụ tuần ----------
alter table public.quest_claims drop constraint quest_claims_idx_check, add constraint quest_claims_idx_check check (idx between 0 and 5);
create table public.weekly_claims (
  owner_id  uuid not null references auth.users (id) on delete cascade,
  week      date not null,
  idx       int  not null check (idx between 0 and 2),
  primary key (owner_id, week, idx)
);
alter table public.weekly_claims enable row level security;
create policy "weekly: đọc của mình" on public.weekly_claims for select to authenticated using ((select auth.uid()) = owner_id);

-- =====================================================================
-- Hàm nội bộ
-- =====================================================================
-- Thứ Hai đầu tuần chứa d. Giống weekStart() ở client.
create or replace function private.week_start(d date) returns date
language sql immutable set search_path = '' as $$
  select date '1970-01-01' + (7 * ((d - date '1970-01-01' + 3) / 7) - 3)
$$;

-- Tiến độ một nhiệm vụ ngày: cột của day_logs, hoặc số món / số nhóm khác nhau
create or replace function private.quest_progress(dl public.day_logs, k text) returns int
language sql immutable set search_path = '' as $$
  select coalesce(case k
    when 'foods_distinct' then (select count(distinct x)::int from unnest(dl.foods) x)
    when 'groups_distinct' then (select count(distinct x)::int from unnest(dl.fgroups) x)
    else (to_jsonb(dl) ->> k)::int end, 0)
$$;

-- =====================================================================
-- RPC
-- =====================================================================
create or replace function public.get_economy() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date; w public.wallets;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform private.ensure_wallet(uid);
  d := private.local_day(uid);
  select * into w from public.wallets where owner_id = uid;
  return jsonb_build_object('coins', w.coins, 'earned_today', case when w.earned_day = d then w.earned_today else 0 end,
    'day', d, 'rotation', to_jsonb(private.rotation(d)), 'weekend', private.is_weekend(d),
    'ration_claimed', exists (select 1 from public.ration_claims where owner_id = uid and day = d));
end $$;

-- Mua thức ăn: p_qty phần (1–10), kho tối đa 30 phần mỗi món.
create or replace function public.buy_food(p_item text, p_qty int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); it public.items; w public.wallets; cur int; q int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into it from public.items where id = p_item and active and kind = 'food';
  if it.id is null then raise exception 'unknown_item'; end if;
  if p_qty is null or p_qty not between 1 and 10 then raise exception 'invalid_qty'; end if;
  cur := coalesce((select qty from public.entitlements where owner_id = uid and item_id = it.id), 0);
  if cur + p_qty > 30 then raise exception 'stock_full'; end if;
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.coins < it.price_coins * p_qty then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - it.price_coins * p_qty where owner_id = uid returning * into w;
  insert into public.entitlements (owner_id, item_id, source, qty) values (uid, it.id, 'coins', p_qty)
  on conflict (owner_id, item_id) do update set qty = public.entitlements.qty + p_qty
  returning qty into q;
  return jsonb_build_object('coins', w.coins, 'qty', q);
end $$;

-- Suất ăn miễn phí: 3 Cơm nắm mỗi ngày (giống FOOD_STOCK.ration)
create or replace function public.claim_ration() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date; q int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  d := private.local_day(uid);
  insert into public.ration_claims (owner_id, day) values (uid, d) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  insert into public.entitlements (owner_id, item_id, source, qty) values (uid, 'comnam', 'gift', 3)
  on conflict (owner_id, item_id) do update set qty = least(30, public.entitlements.qty + 3)
  returning qty into q;
  return jsonb_build_object('item', 'comnam', 'qty', q);
end $$;

-- Bảng nhiệm vụ: 5 nhiệm vụ ngày, thưởng làm hết cả 5, 3 nhiệm vụ tuần. Giống QUEST_POOL / WEEKLY_POOL ở client.
create or replace function public.get_quests() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date; n int; pid uuid; dl public.day_logs; ws date; wn int;
  dkeys text[] := array['fed', 'bath', 'ball', 'pet', 'talk', 'sleep', 'fed', 'ball', 'pet', 'talk', 'foods_distinct', 'groups_distinct'];
  dtargets int[] := array[2, 1, 3, 20, 2, 1, 4, 6, 60, 5, 3, 3];
  drewards int[] := array[20, 20, 25, 20, 20, 20, 35, 40, 40, 40, 40, 45];
  wkeys text[] := array['fed', 'ball', 'talk', 'pet', 'bath', 'sleep'];
  wtargets int[] := array[20, 20, 15, 150, 5, 5];
  wrewards int[] := array[100, 100, 100, 110, 100, 100];
  daily jsonb := '[]'; weekly jsonb := '[]'; i int; q int; prog int; done int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  d := private.local_day(uid); n := private.day_number(d); pid := private.active_pet_id(uid);
  select * into dl from public.day_logs where pet_id = pid and day = d;
  for i in 0..4 loop
    q := (n + i * 5) % 12;
    daily := daily || jsonb_build_object('idx', i, 'quest', q, 'progress', private.quest_progress(dl, dkeys[q + 1]),
      'target', dtargets[q + 1], 'reward', drewards[q + 1],
      'claimed', exists (select 1 from public.quest_claims where owner_id = uid and day = d and idx = i));
  end loop;
  select count(*)::int into done from public.quest_claims where owner_id = uid and day = d and idx between 0 and 4;
  ws := private.week_start(d); wn := (n + 3) / 7;
  for i in 0..2 loop
    q := (wn + i * 2) % 6;
    select coalesce(sum((to_jsonb(l) ->> wkeys[q + 1])::int), 0)::int into prog
      from public.day_logs l where l.owner_id = uid and l.day between ws and ws + 6;
    weekly := weekly || jsonb_build_object('idx', i, 'quest', q, 'progress', prog, 'target', wtargets[q + 1], 'reward', wrewards[q + 1],
      'claimed', exists (select 1 from public.weekly_claims where owner_id = uid and week = ws and idx = i));
  end loop;
  return jsonb_build_object('day', d, 'quests', daily, 'week', ws, 'weekly', weekly,
    'bonus', jsonb_build_object('reward', 50, 'ready', done = 5,
      'claimed', exists (select 1 from public.quest_claims where owner_id = uid and day = d and idx = 5)));
end $$;

create or replace function public.claim_quest(p_idx int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); q jsonb; d date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_idx is null or p_idx not between 0 and 4 then raise exception 'invalid_quest'; end if;
  q := public.get_quests() -> 'quests' -> p_idx; d := private.local_day(uid);
  if (q ->> 'progress')::int < (q ->> 'target')::int then raise exception 'quest_not_done'; end if;
  insert into public.quest_claims (owner_id, day, idx) values (uid, d, p_idx) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  perform private.earn(uid, (q ->> 'reward')::int, false);
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'reward', (q ->> 'reward')::int);
end $$;

-- Thưởng thêm khi nhận đủ 5 nhiệm vụ trong ngày
create or replace function public.claim_quest_bonus() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not (public.get_quests() -> 'bonus' ->> 'ready')::boolean then raise exception 'quest_not_done'; end if;
  d := private.local_day(uid);
  insert into public.quest_claims (owner_id, day, idx) values (uid, d, 5) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  perform private.earn(uid, 50, false);
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'reward', 50);
end $$;

create or replace function public.claim_weekly_quest(p_idx int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); b jsonb; q jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_idx is null or p_idx not between 0 and 2 then raise exception 'invalid_quest'; end if;
  b := public.get_quests(); q := b -> 'weekly' -> p_idx;
  if (q ->> 'progress')::int < (q ->> 'target')::int then raise exception 'quest_not_done'; end if;
  insert into public.weekly_claims (owner_id, week, idx) values (uid, (b ->> 'week')::date, p_idx) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  perform private.earn(uid, (q ->> 'reward')::int, false);
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'reward', (q ->> 'reward')::int);
end $$;

-- Hành động chăm sóc. Khác bản trước ở nhánh 'feed': phải còn phần trong kho và trừ 1 phần mỗi lần ăn,
-- ghi nhóm dinh dưỡng vào day_logs, và ăn cân bằng (3 nhóm lành mạnh trong 3 ngày) thì Vui +3. Trả thêm 'stock' và 'balanced'.
create or replace function public.pet_action(p_action text, p_item text default null, p_count int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); pid uuid; p public.pets; s public.pet_secrets; it public.items;
  n int := greatest(1, least(coalesce(p_count, 1), 20));
  d date; refused text := null; fav boolean := false; recent int; first_new boolean := false; earned int := 0;
  dno real := 0; dvui real := 0; dnl real := 0; dsach real := 0;
  grp text; ng int; balanced boolean := false; stock int := null;
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
    if not private.owns(uid, it.id) then raise exception 'not_owned'; end if;
    if p.no >= 90 then refused := 'full';
    else
      fav := (it.id = s.favorite_food);
      grp := it.effects ->> 'group';
      dno := (it.effects ->> 'no')::real; dvui := (it.effects ->> 'vui')::real + (case when fav then 10 else 0 end);
      if it.id = s.disliked_food then dvui := dvui - 6; end if;
      dsach := -2;
      update public.day_logs set fed = fed + 1, foods = array_append(foods, it.name), fgroups = array_append(fgroups, grp) where pet_id = pid and day = d;
      -- ăn cân bằng: tính cả bữa này
      select count(distinct g)::int into ng from public.day_logs l, unnest(l.fgroups) g
        where l.owner_id = uid and l.day between d - 2 and d and g <> 'ngot';
      balanced := ng >= 3;
      if balanced then dvui := dvui + 3; end if;
      update public.entitlements set qty = qty - 1 where owner_id = uid and item_id = it.id returning qty into stock;
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
    if p_action in ('feed', 'bath_rinse', 'play_ball', 'play_spin', 'talk', 'sleep') then
      earned := private.earn(uid, 5, true);
    end if;
  end if;

  select * into p from public.pets where id = pid;
  return jsonb_build_object('pet', to_jsonb(p), 'refused', refused, 'fav', fav, 'new_memory', first_new,
    'earned', earned, 'coins', (select coins from public.wallets where owner_id = uid), 'stock', stock, 'balanced', balanced);
end $$;

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.buy_food(text, int), public.claim_ration(), public.claim_quest_bonus(), public.claim_weekly_quest(int) from public, anon;
grant execute on function public.buy_food(text, int), public.claim_ration(), public.claim_quest_bonus(), public.claim_weekly_quest(int) to authenticated;
