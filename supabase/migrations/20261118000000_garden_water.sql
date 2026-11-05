-- =====================================================================
-- Hatchday — Tưới nước cho vườn rau
-- Mỗi lần tưới rút ngắn 10% tổng thời gian chín của cây, tối đa 3 lần mỗi cây, mỗi lần cách nhau ít nhất 30 phút.
-- Luật ở hai nơi: catalog.ts (WATER, readyAtMs) và migration này. Test: supabase/tests/advanced-food.test.ts.
--
-- Hàm viết lại nguyên cả hàm, đã đối chiếu với bản mới nhất trên main (20261116000000_food_advanced.sql):
--   public.get_garden (thêm waters, watered_at, can_water; giờ chín tính theo số lần tưới),
--   public.harvest_crop (giờ chín tính theo số lần tưới).
-- =====================================================================

alter table public.garden_plots
  add column waters     int not null default 0 check (waters between 0 and 3),
  add column watered_at timestamptz;

-- Giờ cây chín: giờ gieo + số giờ của cây × (1 − 0,1 × số lần tưới). Giống readyAtMs().
create or replace function private.plot_ready_at(planted timestamptz, hours int, waters int) returns timestamptz
language sql immutable set search_path = '' as $$
  select planted + make_interval(secs => (hours * 3600 * (1 - 0.1 * waters))::double precision)
$$;

create or replace function public.get_garden() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return jsonb_build_object('now', now(), 'plots', coalesce((
    select jsonb_agg(jsonb_build_object('plot', g.plot, 'crop', g.crop, 'planted_at', g.planted_at,
      'ready_at', private.plot_ready_at(g.planted_at, c.hours, g.waters),
      'ready', now() >= private.plot_ready_at(g.planted_at, c.hours, g.waters),
      'waters', g.waters, 'watered_at', g.watered_at,
      'can_water', g.waters < 3 and now() < private.plot_ready_at(g.planted_at, c.hours, g.waters)
                   and (g.watered_at is null or now() - g.watered_at >= interval '30 minutes')) order by g.plot)
    from public.garden_plots g join public.crops c on c.id = g.crop where g.owner_id = uid), '[]'::jsonb));
end $$;

create or replace function public.water_crop(p_plot int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); g public.garden_plots; c public.crops; ready timestamptz;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into g from public.garden_plots where owner_id = uid and plot = p_plot for update;
  if g.crop is null then raise exception 'plot_empty'; end if;
  select * into c from public.crops where id = g.crop;
  ready := private.plot_ready_at(g.planted_at, c.hours, g.waters);
  if now() >= ready then raise exception 'already_ready'; end if;
  if g.waters >= 3 then raise exception 'max_watered'; end if;
  if g.watered_at is not null and now() - g.watered_at < interval '30 minutes' then raise exception 'too_soon'; end if;
  update public.garden_plots set waters = waters + 1, watered_at = now() where owner_id = uid and plot = p_plot returning * into g;
  return jsonb_build_object('waters', g.waters, 'ready_at', private.plot_ready_at(g.planted_at, c.hours, g.waters));
end $$;

create or replace function public.harvest_crop(p_plot int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); g public.garden_plots; c public.crops; cur int; got int; q int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into g from public.garden_plots where owner_id = uid and plot = p_plot;
  if g.crop is null then raise exception 'plot_empty'; end if;
  select * into c from public.crops where id = g.crop;
  if now() < private.plot_ready_at(g.planted_at, c.hours, g.waters) then raise exception 'not_ready'; end if;
  perform private.apply_spoilage(uid);
  cur := coalesce((select qty from public.entitlements where owner_id = uid and item_id = g.crop), 0);
  got := least(c.yield, 30 - cur);
  if got <= 0 then raise exception 'stock_full'; end if;
  insert into public.entitlements (owner_id, item_id, source, qty) values (uid, g.crop, 'gift', got)
  on conflict (owner_id, item_id) do update set qty = public.entitlements.qty + got returning qty into q;
  delete from public.garden_plots where owner_id = uid and plot = p_plot;
  return jsonb_build_object('item', g.crop, 'qty', q, 'got', got);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.water_crop(int) from public, anon;
grant execute on function public.water_crop(int) to authenticated;
