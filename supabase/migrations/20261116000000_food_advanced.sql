-- =====================================================================
-- Hatchday — Thức ăn nâng cao: khẩu vị riêng, vườn rau, nấu ăn, tủ lạnh và thức ăn hỏng
-- Seed (thức ăn có cờ fresh, món nấu, công thức, cây trồng) sinh từ src/game/catalog.ts (scripts/gen-seed.ts). Đừng sửa tay.
-- Luật ở hai nơi: catalog.ts (DISHES, RECIPES, CROPS, FRIDGE, spoilLoss) và migration này. Test: supabase/tests/advanced-food.test.ts.
--
-- Hàm viết lại nguyên cả hàm, đã đối chiếu với bản mới nhất trên main:
--   public.pet_action (nhánh 'feed': ăn được cả món nấu, món nấu tính hai nhóm dinh dưỡng, trả thêm 'dislike', ghi ký ức khi lần đầu ăn món bé ghét),
--   public.get_economy (thêm fridge_level và spoiled; áp thức ăn hỏng mỗi ngày một lần).
-- create_pet, buy_food, claim_ration KHÔNG bị viết lại.
-- =====================================================================

-- ---------- Loại vật phẩm mới: món nấu ----------
alter table public.items drop constraint items_kind_check, add constraint items_kind_check check (kind in ('food', 'dish', 'decor', 'outfit'));
alter table public.items drop constraint items_source_check, add constraint items_source_check check (source in ('starter', 'market', 'rotating', 'weekend', 'event', 'paid', 'cook'));

-- ---------- Bảng tham chiếu: công thức và cây trồng (ai cũng đọc được, không ai sửa được) ----------
create table public.recipes (
  id    text primary key,
  dish  text not null references public.items (id),
  a     text not null references public.items (id),
  b     text not null references public.items (id)
);
create table public.crops (
  id     text primary key references public.items (id),
  hours  int not null check (hours > 0),
  seed   int not null check (seed >= 0),
  yield  int not null check (yield > 0)
);
alter table public.recipes enable row level security;
alter table public.crops   enable row level security;
create policy "recipes: ai cũng đọc" on public.recipes for select to authenticated using (true);
create policy "crops: ai cũng đọc"   on public.crops   for select to authenticated using (true);

-- ---------- Seed: thức ăn (thêm cờ fresh), món nấu, công thức, cây trồng ----------
-- FOODS
insert into public.items (id, kind, name, effects, price_coins, source, rarity) values
  ('comnam', 'food', 'Cơm nắm', '{"no":25,"vui":3,"group":"tinhbot","fresh":false}', 15, 'market', 'thuong'),
  ('bap-nuong', 'food', 'Bắp nướng', '{"no":22,"vui":7,"group":"tinhbot","fresh":false}', 22, 'market', 'thuong'),
  ('banh-mi', 'food', 'Bánh mì', '{"no":28,"vui":6,"group":"tinhbot","fresh":false}', 32, 'market', 'thuong'),
  ('carot', 'food', 'Cà rốt', '{"no":10,"vui":2,"group":"rau","fresh":true}', 12, 'market', 'thuong'),
  ('canh-rau', 'food', 'Canh rau', '{"no":16,"vui":3,"group":"rau","fresh":true}', 18, 'market', 'thuong'),
  ('trung-op', 'food', 'Trứng ốp la', '{"no":20,"vui":4,"group":"dam","fresh":true}', 24, 'market', 'thuong'),
  ('ca-vien', 'food', 'Cá viên chiên', '{"no":14,"vui":12,"group":"dam","fresh":true}', 30, 'market', 'thuong'),
  ('sua-chua', 'food', 'Sữa chua', '{"no":12,"vui":9,"group":"dam","fresh":true}', 20, 'market', 'thuong'),
  ('chuoi', 'food', 'Chuối', '{"no":12,"vui":5,"group":"traicay","fresh":true}', 14, 'market', 'thuong'),
  ('dua-hau', 'food', 'Dưa hấu', '{"no":14,"vui":8,"group":"traicay","fresh":true}', 20, 'market', 'thuong'),
  ('kem', 'food', 'Kem que', '{"no":5,"vui":15,"group":"ngot","fresh":false}', 22, 'market', 'thuong'),
  ('che', 'food', 'Chè đậu', '{"no":15,"vui":12,"group":"ngot","fresh":false}', 28, 'market', 'thuong')
on conflict (id) do update set name = excluded.name, effects = excluded.effects, price_coins = excluded.price_coins, source = excluded.source, rarity = excluded.rarity;
-- DISHES
insert into public.items (id, kind, name, effects, price_coins, source, rarity) values
  ('chao-trung', 'dish', 'Cháo trứng', '{"no":40,"vui":10,"group":"tinhbot","group2":"dam","fresh":true}', null, 'cook', 'thuong'),
  ('com-rau', 'dish', 'Cơm rau', '{"no":38,"vui":8,"group":"tinhbot","group2":"rau","fresh":true}', null, 'cook', 'thuong'),
  ('banh-mi-trung', 'dish', 'Bánh mì trứng', '{"no":45,"vui":14,"group":"tinhbot","group2":"dam","fresh":true}', null, 'cook', 'thuong'),
  ('sinh-to', 'dish', 'Sinh tố chuối', '{"no":24,"vui":22,"group":"traicay","group2":"dam","fresh":true}', null, 'cook', 'thuong'),
  ('salad', 'dish', 'Salad trái cây', '{"no":22,"vui":18,"group":"rau","group2":"traicay","fresh":true}', null, 'cook', 'thuong'),
  ('che-trai-cay', 'dish', 'Chè trái cây', '{"no":26,"vui":28,"group":"ngot","group2":"traicay","fresh":true}', null, 'cook', 'thuong');
-- RECIPES
insert into public.recipes (id, dish, a, b) values
  ('chao-trung', 'chao-trung', 'comnam', 'trung-op'),
  ('com-rau', 'com-rau', 'comnam', 'canh-rau'),
  ('banh-mi-trung', 'banh-mi-trung', 'banh-mi', 'trung-op'),
  ('sinh-to', 'sinh-to', 'chuoi', 'sua-chua'),
  ('salad', 'salad', 'carot', 'dua-hau'),
  ('che-trai-cay', 'che-trai-cay', 'che', 'dua-hau');
-- CROPS
insert into public.crops (id, hours, seed, yield) values
  ('carot', 4, 5, 3),
  ('bap-nuong', 6, 6, 3),
  ('chuoi', 8, 8, 3),
  ('dua-hau', 10, 10, 3);


-- ---------- Vườn rau: 4 ô mỗi người chơi ----------
create table public.garden_plots (
  owner_id    uuid not null references auth.users (id) on delete cascade,
  plot        int  not null check (plot between 0 and 3),
  crop        text not null references public.crops (id),
  planted_at  timestamptz not null default now(),
  primary key (owner_id, plot)
);
alter table public.garden_plots enable row level security;
create policy "garden: đọc của mình" on public.garden_plots for select to authenticated using ((select auth.uid()) = owner_id);

-- ---------- Tủ lạnh: cấp 0, 1, 2 giữ tối đa 3, 6, 10 phần thức ăn tươi mỗi món ----------
alter table public.wallets
  add column fridge_level int not null default 0 check (fridge_level between 0 and 2),
  add column spoil_day    date;

-- =====================================================================
-- Hàm nội bộ
-- =====================================================================
-- Số phần hỏng sau một ngày: 1/4 phần vượt mức giữ, làm tròn lên. Giống spoilLoss().
create or replace function private.spoil_loss(qty int, keep int) returns int
language sql immutable set search_path = '' as $$ select case when qty > keep then ceil((qty - keep) / 4.0)::int else 0 end $$;

-- Áp thức ăn hỏng cho những ngày đã qua kể từ lần áp trước (tối đa 7 ngày). Lần đầu chỉ đặt mốc.
-- Trả về { món: số phần hỏng } của lần áp này.
create or replace function private.apply_spoilage(uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w public.wallets; d date := private.local_day(uid); gap int; keep int; lost jsonb := '{}'; r record; i int; l int;
begin
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.spoil_day is null then update public.wallets set spoil_day = d where owner_id = uid; return lost; end if;
  gap := least(greatest(d - w.spoil_day, 0), 7);
  update public.wallets set spoil_day = greatest(d, w.spoil_day) where owner_id = uid;
  keep := case w.fridge_level when 0 then 3 when 1 then 6 else 10 end;
  for i in 1..gap loop
    for r in select e.item_id, e.qty from public.entitlements e join public.items it on it.id = e.item_id
             where e.owner_id = uid and it.kind in ('food', 'dish') and (it.effects ->> 'fresh')::boolean and e.qty > keep loop
      l := private.spoil_loss(r.qty, keep);
      update public.entitlements set qty = qty - l where owner_id = uid and item_id = r.item_id;
      lost := jsonb_set(lost, array[r.item_id], to_jsonb(coalesce((lost ->> r.item_id)::int, 0) + l));
    end loop;
  end loop;
  return lost;
end $$;

-- =====================================================================
-- RPC
-- =====================================================================
create or replace function public.get_economy() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date; w public.wallets; spoiled jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform private.ensure_wallet(uid);
  spoiled := private.apply_spoilage(uid);
  d := private.local_day(uid);
  select * into w from public.wallets where owner_id = uid;
  return jsonb_build_object('coins', w.coins, 'earned_today', case when w.earned_day = d then w.earned_today else 0 end,
    'day', d, 'rotation', to_jsonb(private.rotation(d)), 'weekend', private.is_weekend(d),
    'ration_claimed', exists (select 1 from public.ration_claims where owner_id = uid and day = d),
    'fridge_level', w.fridge_level, 'spoiled', spoiled);
end $$;

-- Mua tủ lạnh lớn hơn: cấp 1 giá 200 xu, cấp 2 giá 500 xu.
create or replace function public.upgrade_fridge() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); w public.wallets; cost int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.fridge_level >= 2 then raise exception 'max_level'; end if;
  cost := case w.fridge_level when 0 then 200 else 500 end;
  if w.coins < cost then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - cost, fridge_level = fridge_level + 1 where owner_id = uid returning * into w;
  return jsonb_build_object('coins', w.coins, 'fridge_level', w.fridge_level);
end $$;

-- Vườn rau: trạng thái các ô, kèm giờ server để client không phải tin đồng hồ máy.
create or replace function public.get_garden() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return jsonb_build_object('now', now(), 'plots', coalesce((
    select jsonb_agg(jsonb_build_object('plot', g.plot, 'crop', g.crop, 'planted_at', g.planted_at,
      'ready_at', g.planted_at + make_interval(hours => c.hours), 'ready', now() >= g.planted_at + make_interval(hours => c.hours)) order by g.plot)
    from public.garden_plots g join public.crops c on c.id = g.crop where g.owner_id = uid), '[]'::jsonb));
end $$;

create or replace function public.plant_crop(p_plot int, p_crop text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.crops; w public.wallets;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_plot is null or p_plot not between 0 and 3 then raise exception 'invalid_plot'; end if;
  select * into c from public.crops where id = p_crop;
  if c.id is null then raise exception 'unknown_crop'; end if;
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if exists (select 1 from public.garden_plots where owner_id = uid and plot = p_plot) then raise exception 'plot_busy'; end if;
  if w.coins < c.seed then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - c.seed where owner_id = uid returning * into w;
  insert into public.garden_plots (owner_id, plot, crop) values (uid, p_plot, p_crop);
  return jsonb_build_object('coins', w.coins);
end $$;

create or replace function public.harvest_crop(p_plot int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); g public.garden_plots; c public.crops; cur int; got int; q int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into g from public.garden_plots where owner_id = uid and plot = p_plot;
  if g.crop is null then raise exception 'plot_empty'; end if;
  select * into c from public.crops where id = g.crop;
  if now() < g.planted_at + make_interval(hours => c.hours) then raise exception 'not_ready'; end if;
  perform private.apply_spoilage(uid);
  cur := coalesce((select qty from public.entitlements where owner_id = uid and item_id = g.crop), 0);
  got := least(c.yield, 30 - cur);
  if got <= 0 then raise exception 'stock_full'; end if;
  insert into public.entitlements (owner_id, item_id, source, qty) values (uid, g.crop, 'gift', got)
  on conflict (owner_id, item_id) do update set qty = public.entitlements.qty + got returning qty into q;
  delete from public.garden_plots where owner_id = uid and plot = p_plot;
  return jsonb_build_object('item', g.crop, 'qty', q, 'got', got);
end $$;

-- Nấu ăn: mỗi món dùng một phần của mỗi nguyên liệu, được một phần món nấu. Nấu 1–5 lần một lúc.
create or replace function public.cook(p_recipe text, p_qty int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.recipes; cur int; q int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into r from public.recipes where id = p_recipe;
  if r.id is null then raise exception 'unknown_recipe'; end if;
  if p_qty is null or p_qty not between 1 and 5 then raise exception 'invalid_qty'; end if;
  perform private.apply_spoilage(uid);
  if not private.owns(uid, r.a, p_qty) or not private.owns(uid, r.b, p_qty) then raise exception 'missing_ingredient'; end if;
  cur := coalesce((select qty from public.entitlements where owner_id = uid and item_id = r.dish), 0);
  if cur + p_qty > 30 then raise exception 'stock_full'; end if;
  update public.entitlements set qty = qty - p_qty where owner_id = uid and item_id in (r.a, r.b);
  insert into public.entitlements (owner_id, item_id, source, qty) values (uid, r.dish, 'gift', p_qty)
  on conflict (owner_id, item_id) do update set qty = public.entitlements.qty + p_qty returning qty into q;
  return jsonb_build_object('dish', r.dish, 'qty', q);
end $$;

-- Khẩu vị: món tủ và món ghét của bé chỉ lộ ra sau khi bé đã được ăn thử món đó. Trả về món đã biết, số món đã thử trên tổng số.
create or replace function public.get_tastes() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid; s public.pet_secrets;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  pid := private.active_pet_id(uid);
  if pid is null then raise exception 'no_pet'; end if;
  select * into s from public.pet_secrets where pet_id = pid;
  return jsonb_build_object(
    'fav', case when exists (select 1 from public.memories where pet_id = pid and first_key = 'food-' || s.favorite_food) then s.favorite_food end,
    'dis', case when exists (select 1 from public.memories where pet_id = pid and first_key = 'food-' || s.disliked_food) then s.disliked_food end,
    'tried', (select count(*)::int from public.memories m join public.items i on m.first_key = 'food-' || i.id where m.pet_id = pid and i.kind = 'food'),
    'total', (select count(*)::int from public.items where kind = 'food' and active));
end $$;

-- Hành động chăm sóc. Khác bản trước ở nhánh 'feed': ăn được cả món nấu (kind 'dish'); món nấu thuộc hai nhóm dinh dưỡng;
-- trả thêm 'dislike' và ghi ký ức khi lần đầu bé ăn món mình ghét.
create or replace function public.pet_action(p_action text, p_item text default null, p_count int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); pid uuid; p public.pets; s public.pet_secrets; it public.items;
  n int := greatest(1, least(coalesce(p_count, 1), 20));
  d date; refused text := null; fav boolean := false; disliked boolean := false; recent int; first_new boolean := false; earned int := 0;
  dno real := 0; dvui real := 0; dnl real := 0; dsach real := 0;
  grp text; grp2 text; ng int; balanced boolean := false; stock int := null;
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
    select * into it from public.items where id = p_item and kind in ('food', 'dish') and active;
    if it.id is null then raise exception 'unknown_item'; end if;
    if not private.owns(uid, it.id) then raise exception 'not_owned'; end if;
    if p.no >= 90 then refused := 'full';
    else
      fav := (it.id = s.favorite_food); disliked := (it.id = s.disliked_food);
      grp := it.effects ->> 'group'; grp2 := it.effects ->> 'group2';
      dno := (it.effects ->> 'no')::real; dvui := (it.effects ->> 'vui')::real + (case when fav then 10 else 0 end);
      if disliked then dvui := dvui - 6; end if;
      dsach := -2;
      update public.day_logs set fed = fed + 1, foods = array_append(foods, it.name), fgroups = array_append(fgroups, grp) where pet_id = pid and day = d;
      if grp2 is not null then update public.day_logs set fgroups = array_append(fgroups, grp2) where pet_id = pid and day = d; end if;
      -- ăn cân bằng: tính cả bữa này
      select count(distinct g)::int into ng from public.day_logs l, unnest(l.fgroups) g
        where l.owner_id = uid and l.day between d - 2 and d and g <> 'ngot';
      balanced := ng >= 3;
      if balanced then dvui := dvui + 3; end if;
      update public.entitlements set qty = qty - 1 where owner_id = uid and item_id = it.id returning qty into stock;
      first_new := private.remember_first(pid, uid, 'food-' || it.id, 'food',
        case when fav then format('Lần đầu ăn %s, hoá ra là món tủ của mình!', it.name)
             when disliked then format('Lần đầu ăn %s, mình không ưa món này lắm.', it.name)
             else format('Lần đầu được ăn %s.', it.name) end);
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
  return jsonb_build_object('pet', to_jsonb(p), 'refused', refused, 'fav', fav, 'dislike', disliked, 'new_memory', first_new,
    'earned', earned, 'coins', (select coins from public.wallets where owner_id = uid), 'stock', stock, 'balanced', balanced);
end $$;

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.upgrade_fridge(), public.get_garden(), public.plant_crop(int, text), public.harvest_crop(int),
  public.cook(text, int), public.get_tastes() from public, anon;
grant execute on function public.upgrade_fridge(), public.get_garden(), public.plant_crop(int, text), public.harvest_crop(int),
  public.cook(text, int), public.get_tastes() to authenticated;
