-- =====================================================================
-- Hatchday — Thăm nhà bạn: xem ảnh chụp công khai, vuốt ve, tưới giúp, để lại dấu vết (P7)
-- Chỉ giữa bạn bè. Ảnh chụp chỉ có phòng đang dùng, nông trại, bé (loài, dáng, đồ mặc, tên) và các ô vườn; không có chỉ số, xu, kho.
-- Luật ở hai nơi: src/game/social.ts (SOCIAL, GUESTBOOK) và migration này. Test: supabase/tests/visit.test.ts.
-- Không viết lại hàm nào (tưới giúp là hàm mới, không đụng water_crop).
-- =====================================================================

create table public.visit_log (
  id        bigint generated always as identity primary key,
  visitor   uuid not null references auth.users (id) on delete cascade,
  host      uuid not null references auth.users (id) on delete cascade,
  kind      text not null check (kind in ('stroke', 'water', 'note')),
  plot      int,
  emote     text,
  day       date not null,
  created_at timestamptz not null default now()
);
create index visit_log_host on public.visit_log (host, created_at desc);
create index visit_log_visitor_day on public.visit_log (visitor, day);
alter table public.visit_log enable row level security;
create policy "visit_log: đọc của mình" on public.visit_log for select to authenticated using ((select auth.uid()) in (visitor, host));

create or replace function private.visit_day(uid uuid) returns date
language sql stable security definer set search_path = '' as $$ select private.local_day(uid) $$;

-- Số lần có thưởng của người thăm trong ngày (vuốt ve và tưới giúp)
create or replace function private.rewarded_today(uid uuid, d date) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.visit_log where visitor = uid and day = d and kind in ('stroke', 'water')
$$;

create or replace function public.get_visit(p_who text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid; d date; lay jsonb; sl int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null or t = uid then raise exception 'not_found'; end if;
  if private.is_blocked(uid, t) then raise exception 'blocked'; end if;
  if not private.are_friends(uid, t) then raise exception 'not_friends'; end if;
  d := private.local_day(uid);
  sl := coalesce((select active_layout from public.profiles where id = t), 0);
  select r.layout into lay from public.room_layouts r where r.owner_id = t and r.slot = sl limit 1;
  return jsonb_build_object(
    'profile', private.profile_json(t),
    'room', lay,
    'farm', (select layout -> 'items' from public.farm_layouts where owner_id = t),
    'parcels', coalesce((select jsonb_agg(jsonb_build_object('parcel', parcel, 'level', level) order by parcel) from public.garden_parcels where owner_id = t), '[{"parcel":0,"level":0}]'::jsonb),
    'plots', coalesce((select jsonb_agg(jsonb_build_object('plot', g.plot, 'crop', g.crop, 'ready', now() >= private.plot_ready_at(g.planted_at, c.hours, g.waters), 'waters', g.waters,
        'can_help', g.waters < 3 and now() < private.plot_ready_at(g.planted_at, c.hours, g.waters) and (g.watered_at is null or now() - g.watered_at >= interval '30 minutes')
                    and not exists (select 1 from public.visit_log v where v.visitor = uid and v.host = t and v.kind = 'water' and v.plot = g.plot and v.day = d)) order by g.plot)
      from public.garden_plots g join public.crops c on c.id = g.crop where g.owner_id = t), '[]'::jsonb),
    'today', jsonb_build_object('stroked', exists (select 1 from public.visit_log where visitor = uid and host = t and kind = 'stroke' and day = d),
                                'noted', exists (select 1 from public.visit_log where visitor = uid and host = t and kind = 'note' and day = d),
                                'rewarded', private.rewarded_today(uid, d)));
end $$;

create or replace function public.stroke_friend_pet(p_who text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid; d date; pid uuid; got int := 0;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null or t = uid or not private.are_friends(uid, t) or private.is_blocked(uid, t) then raise exception 'not_friends'; end if;
  d := private.local_day(uid);
  if exists (select 1 from public.visit_log where visitor = uid and host = t and kind = 'stroke' and day = d) then raise exception 'already_today'; end if;
  pid := private.active_pet_id(t);
  if pid is not null then update public.pets set vui = private.clamp((vui + 2)::real) where id = pid; end if;
  if private.rewarded_today(uid, d) < 3 then got := 3; perform private.earn(uid, 3, false); end if;
  insert into public.visit_log (visitor, host, kind, day) values (uid, t, 'stroke', d);
  return jsonb_build_object('got', got);
end $$;

create or replace function public.water_friend_crop(p_who text, p_plot int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid; d date; g public.garden_plots; c public.crops; got int := 0;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null or t = uid or not private.are_friends(uid, t) or private.is_blocked(uid, t) then raise exception 'not_friends'; end if;
  d := private.local_day(uid);
  if exists (select 1 from public.visit_log where visitor = uid and host = t and kind = 'water' and plot = p_plot and day = d) then raise exception 'already_today'; end if;
  select * into g from public.garden_plots where owner_id = t and plot = p_plot for update;
  if g.crop is null then raise exception 'plot_empty'; end if;
  select * into c from public.crops where id = g.crop;
  if now() >= private.plot_ready_at(g.planted_at, c.hours, g.waters) then raise exception 'already_ready'; end if;
  if g.waters >= 3 then raise exception 'max_watered'; end if;
  if g.watered_at is not null and now() - g.watered_at < interval '30 minutes' then raise exception 'too_soon'; end if;
  update public.garden_plots set waters = waters + 1, watered_at = now() where owner_id = t and plot = p_plot returning * into g;
  if private.rewarded_today(uid, d) < 3 then got := 5; perform private.earn(uid, 5, false); end if;
  insert into public.visit_log (visitor, host, kind, plot, day) values (uid, t, 'water', p_plot, d);
  return jsonb_build_object('waters', g.waters, 'got', got);
end $$;

create or replace function public.leave_guestbook(p_who text, p_emote text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid; d date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_emote not in ('heart', 'star', 'smile', 'cake', 'flower') then raise exception 'invalid_emote'; end if;
  t := private.resolve_who(p_who);
  if t is null or t = uid or not private.are_friends(uid, t) or private.is_blocked(uid, t) then raise exception 'not_friends'; end if;
  d := private.local_day(uid);
  if exists (select 1 from public.visit_log where visitor = uid and host = t and kind = 'note' and day = d) then raise exception 'already_today'; end if;
  insert into public.visit_log (visitor, host, kind, emote, day) values (uid, t, 'note', p_emote, d);
end $$;

-- Dấu vết bạn để lại ở nhà mình (10 gần nhất)
create or replace function public.get_guestbook() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('from', private.profile_json(v.visitor) ->> 'name', 'kind', v.kind, 'emote', v.emote, 'at', v.created_at) order by v.created_at desc)
    from (select * from public.visit_log where host = uid order by created_at desc limit 10) v), '[]'::jsonb);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_visit(text), public.stroke_friend_pet(text), public.water_friend_crop(text, int), public.leave_guestbook(text, text), public.get_guestbook() from public, anon;
grant execute on function public.get_visit(text), public.stroke_friend_pet(text), public.water_friend_crop(text, int), public.leave_guestbook(text, text), public.get_guestbook() to authenticated;
