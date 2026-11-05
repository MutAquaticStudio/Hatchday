-- =====================================================================
-- Hatchday — Mảnh đất cho vườn rau: nâng cấp và mua thêm
-- Mỗi mảnh đất bắt đầu có 3 ô, nâng cấp được lên 6 ô (300 xu) rồi 9 ô (600 xu). Mảnh đầu có sẵn.
-- Khi mảnh cuối đã đủ 9 ô thì mua được mảnh đất mới (1.000 xu cho mảnh thứ hai, 2.000 xu cho mảnh thứ ba), tối đa 3 mảnh (27 ô).
-- Số thứ tự ô toàn cục = mảnh × 9 + ô trong mảnh.
-- Luật ở hai nơi: catalog.ts (GARDEN_LAND, PARCEL) và migration này. Test: supabase/tests/advanced-food.test.ts.
--
-- Hàm viết lại nguyên cả hàm, đã đối chiếu với bản mới nhất trên main:
--   public.get_garden (từ 20261118000000_garden_water.sql; thêm parcels),
--   public.plant_crop (từ 20261116000000_food_advanced.sql; chỉ gieo được ở ô thuộc mảnh đã có và đã nâng cấp tới đó).
-- =====================================================================

create table public.garden_parcels (
  owner_id  uuid not null references auth.users (id) on delete cascade,
  parcel    int  not null check (parcel between 0 and 2),
  level     int  not null default 0 check (level between 0 and 2),
  primary key (owner_id, parcel)
);
alter table public.garden_parcels enable row level security;
create policy "parcels: đọc của mình" on public.garden_parcels for select to authenticated using ((select auth.uid()) = owner_id);

alter table public.garden_plots drop constraint garden_plots_plot_check, add constraint garden_plots_plot_check check (plot between 0 and 26);

-- Mảnh đất đầu tiên luôn có
create or replace function private.ensure_parcel0(uid uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.garden_parcels (owner_id, parcel) values (uid, 0) on conflict do nothing
$$;

create or replace function public.get_garden() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform private.ensure_parcel0(uid);
  return jsonb_build_object('now', now(),
    'parcels', (select jsonb_agg(jsonb_build_object('parcel', parcel, 'level', level, 'size', 3 + 3 * level) order by parcel) from public.garden_parcels where owner_id = uid),
    'plots', coalesce((
      select jsonb_agg(jsonb_build_object('plot', g.plot, 'crop', g.crop, 'planted_at', g.planted_at,
        'ready_at', private.plot_ready_at(g.planted_at, c.hours, g.waters),
        'ready', now() >= private.plot_ready_at(g.planted_at, c.hours, g.waters),
        'waters', g.waters, 'watered_at', g.watered_at,
        'can_water', g.waters < 3 and now() < private.plot_ready_at(g.planted_at, c.hours, g.waters)
                     and (g.watered_at is null or now() - g.watered_at >= interval '30 minutes')) order by g.plot)
      from public.garden_plots g join public.crops c on c.id = g.crop where g.owner_id = uid), '[]'::jsonb));
end $$;

create or replace function public.plant_crop(p_plot int, p_crop text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.crops; w public.wallets; lvl int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_plot is null or p_plot not between 0 and 26 then raise exception 'invalid_plot'; end if;
  select * into c from public.crops where id = p_crop;
  if c.id is null then raise exception 'unknown_crop'; end if;
  perform private.ensure_parcel0(uid); perform private.ensure_wallet(uid);
  select level into lvl from public.garden_parcels where owner_id = uid and parcel = p_plot / 9;
  if lvl is null or (p_plot % 9) >= 3 + 3 * lvl then raise exception 'plot_locked'; end if;
  select * into w from public.wallets where owner_id = uid for update;
  if exists (select 1 from public.garden_plots where owner_id = uid and plot = p_plot) then raise exception 'plot_busy'; end if;
  if w.coins < c.seed then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - c.seed where owner_id = uid returning * into w;
  insert into public.garden_plots (owner_id, plot, crop) values (uid, p_plot, p_crop);
  return jsonb_build_object('coins', w.coins);
end $$;

-- Nâng cấp một mảnh đất: 3 → 6 ô giá 300 xu, 6 → 9 ô giá 600 xu.
create or replace function public.upgrade_parcel(p_parcel int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); w public.wallets; lvl int; cost int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform private.ensure_parcel0(uid); perform private.ensure_wallet(uid);
  select level into lvl from public.garden_parcels where owner_id = uid and parcel = p_parcel for update;
  if lvl is null then raise exception 'plot_locked'; end if;
  if lvl >= 2 then raise exception 'max_land'; end if;
  cost := case lvl when 0 then 300 else 600 end;
  select * into w from public.wallets where owner_id = uid for update;
  if w.coins < cost then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - cost where owner_id = uid returning * into w;
  update public.garden_parcels set level = level + 1 where owner_id = uid and parcel = p_parcel;
  return jsonb_build_object('coins', w.coins, 'parcel', p_parcel, 'level', lvl + 1, 'size', 3 + 3 * (lvl + 1));
end $$;

-- Mua mảnh đất mới: chỉ khi mảnh cuối đã đủ 9 ô. Mảnh thứ hai giá 1.000 xu, mảnh thứ ba giá 2.000 xu.
create or replace function public.buy_parcel() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); w public.wallets; n int; last_level int; cost int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform private.ensure_parcel0(uid); perform private.ensure_wallet(uid);
  select count(*)::int, (select level from public.garden_parcels where owner_id = uid order by parcel desc limit 1)
    into n, last_level from public.garden_parcels where owner_id = uid;
  if n >= 3 then raise exception 'max_parcels'; end if;
  if last_level < 2 then raise exception 'parcel_not_full'; end if;
  cost := case n when 1 then 1000 else 2000 end;
  select * into w from public.wallets where owner_id = uid for update;
  if w.coins < cost then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - cost where owner_id = uid returning * into w;
  insert into public.garden_parcels (owner_id, parcel) values (uid, n);
  return jsonb_build_object('coins', w.coins, 'parcel', n);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.upgrade_parcel(int), public.buy_parcel() from public, anon;
grant execute on function public.upgrade_parcel(int), public.buy_parcel() to authenticated;
