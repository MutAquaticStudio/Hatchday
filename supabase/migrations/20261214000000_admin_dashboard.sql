-- =====================================================================
-- Hatchday — Admin: công tắc, Cân bằng (núm do máy chủ quyết định), dashboard chỉ số nhà phát triển (giai đoạn B)
--
-- Hàm viết lại nguyên cả hàm, đã đối chiếu với bản mới nhất:
--   private.ad_reward / ad_per_day / ad_gap_minutes / ad_min_watch_seconds (từ 20261211000000_ad_rewards.sql; đọc balance_config),
--   private.earn (từ 20261105000000_decor_cosmetics.sql; trần xu chăm sóc đọc balance_config),
--   public.get_sell_state, public.sell_food (từ 20261202000000_sell_food.sql; trần bán mỗi ngày đọc balance_config),
--   public.get_public_config (từ 20261206000000_admin.sql; thêm care_cap),
--   public.admin_set_flag (từ 20261211000000_ad_rewards.sql; thêm push.enabled, chat.dm.enabled).
-- Mặc định của balance_config bằng đúng hằng số cũ (test: supabase/tests/balance.test.ts) nên hành vi không đổi cho tới khi admin chỉnh.
-- =====================================================================

-- ---------- Cờ ----------
insert into public.system_flags (key, value) values ('push.enabled', 'false') on conflict do nothing;

create or replace function public.admin_set_flag(p_key text, p_value jsonb, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid; old jsonb;
begin
  uid := private.require_admin('flag'); perform private.need_reason(p_reason);
  if p_key not in ('chat.public.enabled', 'chat.dm.enabled', 'campaign.approval', 'places.enabled', 'ads.enabled', 'push.enabled') then raise exception 'unknown_flag'; end if;
  if p_key <> 'campaign.approval' and jsonb_typeof(p_value) <> 'boolean' then raise exception 'invalid_flag'; end if;
  select value into old from public.system_flags where key = p_key;
  insert into public.system_flags (key, value, updated_by) values (p_key, p_value, uid) on conflict (key) do update set value = excluded.value, updated_by = uid, updated_at = now();
  perform private.audit('set_flag', p_key, old, p_value, p_reason);
end $$;

-- Lần đổi cuối của từng cờ (ai, lúc nào, vì sao) để hiện trên thẻ công tắc.
create or replace function public.admin_flag_meta() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('flag');
  return coalesce((select jsonb_object_agg(target, jsonb_build_object('at', created_at, 'reason', reason, 'by', split_part(coalesce((select email from auth.users where id = admin), ''), '@', 1)))
    from (select distinct on (target) target, created_at, reason, admin from public.admin_audit where action = 'set_flag' order by target, created_at desc) x), '{}'::jsonb);
end $$;

-- ---------- Cân bằng ----------
create table public.balance_config (
  key        text primary key,
  value      numeric not null,
  def        numeric not null,
  min        numeric not null,
  max        numeric not null,
  unit       text not null default '',
  label      text not null,
  grp        text not null,
  note       text not null default '',
  updated_by uuid,
  updated_at timestamptz,
  check (min <= max and value between min and max and def between min and max)
);
alter table public.balance_config enable row level security;
insert into public.balance_config (key, value, def, min, max, unit, label, grp, note) values
  ('ads.reward',            20,  20,  5,   100, 'xu',      'Thưởng mỗi lượt xem quảng cáo', 'Quảng cáo', 'Không bị nhân bởi sự kiện nhân xu nhiệm vụ.'),
  ('ads.per_day',            5,   5,  0,    20, 'lượt',    'Số lượt xem tối đa mỗi ngày',    'Quảng cáo', '0 = không ai nhận được thưởng.'),
  ('ads.gap_minutes',       10,  10,  0,   120, 'phút',    'Giãn cách giữa hai lượt',        'Quảng cáo', ''),
  ('ads.min_watch_seconds', 15,  15,  5,    60, 'giây',    'Thời gian xem tối thiểu',        'Quảng cáo', 'Máy chủ từ chối nhận thưởng nếu nhận sớm hơn.'),
  ('ads.ecpm_usd',           1,   1,  0,    50, 'USD',     'eCPM ước tính (cho ARPDAU)',      'Quảng cáo', 'Chỉ dùng để ước tính doanh thu trên dashboard, không ảnh hưởng game.'),
  ('care.daily_cap',        50,  50, 10,   200, 'xu',      'Trần xu chăm sóc mỗi ngày',      'Kinh tế',   'Xu kiếm từ chăm bé (ăn, tắm, chơi…); nhiệm vụ và quảng cáo không tính.'),
  ('sell.daily_cap',        80,  80, 20,   400, 'xu',      'Trần bán rau mỗi ngày',          'Kinh tế',   'Tổng xu thu mua nông sản mỗi người mỗi ngày.'),
  ('alert.dau_drop_pct',    20,  20,  5,    80, '%',       'Cảnh báo DAU giảm hơn',          'Cảnh báo',  'So với trung bình 7 ngày trước đó (cần trung bình ≥ 5 người).'),
  ('alert.ads_per_user',   4.5, 4.5,  1,    20, 'lượt',    'Cảnh báo lượt quảng cáo/người vượt',  'Cảnh báo', 'Tính trên người có xem quảng cáo hôm qua.'),
  ('alert.coin_ratio',     1.3, 1.3, 1.05,   3, 'lần',     'Cảnh báo xu kiếm/xu tiêu vượt',  'Cảnh báo',  'Tính 7 ngày gần nhất, bỏ xu khởi đầu; cần kiếm ≥ 500 xu.'),
  ('alert.reports_per_day', 10,  10,  1,   100, 'báo cáo', 'Cảnh báo báo cáo mỗi ngày vượt', 'Cảnh báo',  '');

create or replace function private.bal(k text) returns numeric
language sql stable security definer set search_path = '' as $$ select value from public.balance_config where key = k $$;

create or replace function private.ad_reward() returns int language sql stable set search_path = '' as $$ select coalesce(private.bal('ads.reward'), 20)::int $$;
create or replace function private.ad_per_day() returns int language sql stable set search_path = '' as $$ select coalesce(private.bal('ads.per_day'), 5)::int $$;
create or replace function private.ad_gap_minutes() returns int language sql stable set search_path = '' as $$ select coalesce(private.bal('ads.gap_minutes'), 10)::int $$;
create or replace function private.ad_min_watch_seconds() returns int language sql stable set search_path = '' as $$ select coalesce(private.bal('ads.min_watch_seconds'), 15)::int $$;

create or replace function private.earn(uid uuid, amount int, capped boolean) returns int
language plpgsql security definer set search_path = '' as $$
declare d date := private.local_day(uid); w public.wallets; got int; cap int := coalesce(private.bal('care.daily_cap'), 50)::int;
begin
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.earned_day is distinct from d then w.earned_today := 0; end if;
  got := case when capped then greatest(0, least(amount, cap - w.earned_today)) else amount end;
  update public.wallets set coins = coins + got, earned_today = w.earned_today + (case when capped then got else 0 end), earned_day = d where owner_id = uid;
  return got;
end $$;

create or replace function public.get_sell_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  d := private.local_day(uid);
  return jsonb_build_object('today', coalesce((select coins from public.sell_log where owner_id = uid and day = d), 0), 'cap', coalesce(private.bal('sell.daily_cap'), 80)::int);
end $$;

create or replace function public.sell_food(p_item text, p_qty int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); it public.items; d date; today int; unit int; total int; q int; cap int := coalesce(private.bal('sell.daily_cap'), 80)::int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into it from public.items where id = p_item and active and kind = 'food';
  if it.id is null then raise exception 'unknown_item'; end if;
  if p_qty is null or p_qty not between 1 and 30 then raise exception 'invalid_qty'; end if;
  if not private.owns(uid, it.id, p_qty) then raise exception 'not_owned'; end if;
  d := private.local_day(uid);
  today := coalesce((select coins from public.sell_log where owner_id = uid and day = d), 0);
  unit := private.sell_price(it.price_coins); total := unit * p_qty;
  if total <= 0 then raise exception 'not_for_sale'; end if;
  if today + total > cap then raise exception 'sell_cap'; end if;
  update public.entitlements set qty = qty - p_qty where owner_id = uid and item_id = it.id returning qty into q;
  perform private.earn(uid, total, false);
  insert into public.sell_log (owner_id, day, coins) values (uid, d, total)
  on conflict (owner_id, day) do update set coins = public.sell_log.coins + total;
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'qty', q, 'got', total, 'today', today + total, 'cap', cap);
end $$;

create or replace function public.get_public_config() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return jsonb_build_object('chat_public', coalesce((select value from public.system_flags where key = 'chat.public.enabled'), 'false'::jsonb),
    'care_cap', coalesce(private.bal('care.daily_cap'), 50)::int);
end $$;

create or replace function public.admin_list_balance() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('flag');
  return coalesce((select jsonb_agg(to_jsonb(b) - 'updated_by' || jsonb_build_object('by', split_part(coalesce((select email from auth.users where id = b.updated_by), ''), '@', 1)) order by b.grp, b.key) from public.balance_config b), '[]'::jsonb);
end $$;

-- Đổi một núm: trong khoảng min–max; lệch quá ±50% so với mặc định chỉ owner được làm; ghi kiểm toán.
create or replace function public.admin_set_balance(p_key text, p_value numeric, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid; b public.balance_config;
begin
  uid := private.require_admin('flag'); perform private.need_reason(p_reason);
  select * into b from public.balance_config where key = p_key; if b.key is null then raise exception 'unknown_balance'; end if;
  if p_value is null or p_value < b.min or p_value > b.max then raise exception 'balance_out_of_range'; end if;
  if b.def > 0 and abs(p_value - b.def) / b.def > 0.5 and not exists (select 1 from public.admin_roles where user_id = uid and role = 'owner') then raise exception 'balance_needs_owner'; end if;
  update public.balance_config set value = p_value, updated_by = uid, updated_at = now() where key = p_key;
  perform private.audit('set_balance', p_key, to_jsonb(b.value), to_jsonb(p_value), p_reason);
end $$;

-- ---------- Dashboard ----------
create or replace function private.stat_series(m text, dm text, a date, b date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(coalesce(s.value, 0) order by g.day), '[]'::jsonb)
  from generate_series(a::timestamp, b::timestamp, interval '1 day') g(day)
  left join public.stats_daily s on s.day = g.day::date and s.metric = m and s.dim = dm
$$;
create or replace function private.stat_dims(m text, a date, b date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(dim, private.stat_series(m, dim, a, b)), '{}'::jsonb)
  from (select distinct dim from public.stats_daily where metric = m and day between a and b and dim <> '') x
$$;

-- Giữ chân theo tuần đăng ký: D1/D3/D7/D14/D30 = số người (đã đủ ngày) còn hoạt động đúng ngày đó / số người đã đủ ngày.
create or replace function private.retention(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with u as (select p.id, (p.created_at at time zone 'Asia/Ho_Chi_Minh')::date sd from public.profiles p
             where (p.created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to),
  k(n) as (values (1), (3), (7), (14), (30)),
  c as (select u.id, u.sd, k.n, (u.sd + k.n <= private.vn_today()) as matured,
               exists (select 1 from public.user_active_days a where a.user_id = u.id and a.day = u.sd + k.n) as act
        from u cross join k),
  w as (select date_trunc('week', sd)::date wk, jsonb_build_object('week', date_trunc('week', sd)::date, 'size', count(distinct id),
          'd1', jsonb_build_object('n', count(*) filter (where n = 1 and matured and act), 'of', count(*) filter (where n = 1 and matured)),
          'd3', jsonb_build_object('n', count(*) filter (where n = 3 and matured and act), 'of', count(*) filter (where n = 3 and matured)),
          'd7', jsonb_build_object('n', count(*) filter (where n = 7 and matured and act), 'of', count(*) filter (where n = 7 and matured)),
          'd14', jsonb_build_object('n', count(*) filter (where n = 14 and matured and act), 'of', count(*) filter (where n = 14 and matured)),
          'd30', jsonb_build_object('n', count(*) filter (where n = 30 and matured and act), 'of', count(*) filter (where n = 30 and matured))) j
        from c group by 1)
  select jsonb_build_object('weeks', coalesce((select jsonb_agg(j order by wk) from w), '[]'::jsonb),
    'total', jsonb_build_object('size', (select count(*) from u),
      'd1', jsonb_build_object('n', (select count(*) from c where n = 1 and matured and act), 'of', (select count(*) from c where n = 1 and matured)),
      'd3', jsonb_build_object('n', (select count(*) from c where n = 3 and matured and act), 'of', (select count(*) from c where n = 3 and matured)),
      'd7', jsonb_build_object('n', (select count(*) from c where n = 7 and matured and act), 'of', (select count(*) from c where n = 7 and matured)),
      'd14', jsonb_build_object('n', (select count(*) from c where n = 14 and matured and act), 'of', (select count(*) from c where n = 14 and matured)),
      'd30', jsonb_build_object('n', (select count(*) from c where n = 30 and matured and act), 'of', (select count(*) from c where n = 30 and matured))))
$$;

create or replace function public.admin_dashboard_overview(p_days int default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n int := least(greatest(coalesce(p_days, 30), 7), 90); d1 date := private.vn_today(); d0 date := private.vn_today() - (least(greatest(coalesce(p_days, 30), 7), 90) - 1);
  tz constant text := 'Asia/Ho_Chi_Minh';
  alerts jsonb := '[]'::jsonb; y date := private.vn_today() - 1;
  dau_y numeric; dau_avg numeric; ads_v numeric; ads_u numeric; earned numeric; spent numeric; reps numeric;
  per_day int := private.ad_per_day();
  out jsonb;
begin
  perform private.require_admin('dashboard');

  -- Cảnh báo theo ngưỡng (Cân bằng → Cảnh báo)
  select coalesce(value, 0) into dau_y from public.stats_daily where day = y and metric = 'dau' and dim = '';
  select coalesce(avg(value), 0) into dau_avg from public.stats_daily where day between y - 7 and y - 1 and metric = 'dau' and dim = '';
  if dau_avg >= 5 and dau_y < dau_avg * (1 - coalesce(private.bal('alert.dau_drop_pct'), 20) / 100) then
    alerts := alerts || jsonb_build_array(jsonb_build_object('key', 'dau_drop', 'level', 'bad', 'value', round(dau_y), 'text', format('DAU hôm qua %s, thấp hơn trung bình 7 ngày trước (%s) quá ngưỡng.', round(dau_y), round(dau_avg, 1))));
  end if;
  select coalesce(value, 0) into ads_v from public.stats_daily where day = y and metric = 'ads_views' and dim = '';
  select coalesce(value, 0) into ads_u from public.stats_daily where day = y and metric = 'ads_users' and dim = '';
  if ads_u >= 3 and ads_v / ads_u > coalesce(private.bal('alert.ads_per_user'), 4.5) then
    alerts := alerts || jsonb_build_array(jsonb_build_object('key', 'ads_per_user', 'level', 'warn', 'value', round(ads_v / ads_u, 2), 'text', format('Hôm qua mỗi người xem quảng cáo %s lượt (trần %s/ngày): kiểm tra người chạm trần.', round(ads_v / ads_u, 2), per_day)));
  end if;
  select coalesce(sum(value), 0) into earned from public.stats_daily where day between y - 6 and y and metric = 'coins_earned' and dim not in ('start', 'backfill');
  select coalesce(sum(value), 0) into spent from public.stats_daily where day between y - 6 and y and metric = 'coins_spent';
  if earned >= 500 and spent > 0 and earned / spent > coalesce(private.bal('alert.coin_ratio'), 1.3) then
    alerts := alerts || jsonb_build_array(jsonb_build_object('key', 'coin_ratio', 'level', 'warn', 'value', round(earned / spent, 2), 'text', format('Xu kiếm gấp %s lần xu tiêu trong 7 ngày: dấu hiệu lạm phát.', round(earned / spent, 2))));
  end if;
  select coalesce(value, 0) into reps from public.stats_daily where day = y and metric = 'reports_new' and dim = '';
  if reps > coalesce(private.bal('alert.reports_per_day'), 10) then
    alerts := alerts || jsonb_build_array(jsonb_build_object('key', 'reports', 'level', 'warn', 'value', reps, 'text', format('%s báo cáo mới hôm qua, vượt ngưỡng.', reps)));
  end if;

  out := jsonb_build_object(
    'generated_at', now(), 'from', d0, 'to', d1, 'days', n,
    'alerts', alerts,
    'live', jsonb_build_object(
      'online_now', (select count(distinct user_id) from public.client_sessions where last_seen_at > now() - interval '3 minutes'),
      'in_places', (select count(*) from public.place_members where last_seen > now() - interval '120 seconds'),
      'pets_alive', (select count(*) from public.pets where stage <> 'departed'),
      'ill_now', (select count(*) from public.pets where illness is not null and stage <> 'departed'),
      'users_total', (select count(*) from public.profiles),
      'events_live', (select count(*) from public.events where enabled and starts_at <= now() and ends_at > now()),
      'reports_open', (select count(*) from public.reports where status = 'open'),
      'sanctions_active', (select count(*) from public.sanctions where lifted_at is null and until > now()),
      'mail_unclaimed', (select count(*) from public.mailbox where claimed_at is null and returned_at is null and expires_at > now()),
      'ads_capped_today', (select count(*) from public.ad_rewards where day = d1 and count >= per_day and per_day > 0),
      'dau_wau_mau', jsonb_build_object('wau', (select count(distinct user_id) from public.user_active_days where day > d1 - 7),
        'mau', (select count(distinct user_id) from public.user_active_days where day > d1 - 30))),
    'series', jsonb_build_object(
      'dau', private.stat_series('dau', '', d0, d1), 'dau_platform', private.stat_dims('dau_platform', d0, d1), 'dau_standalone', private.stat_series('dau_standalone', '', d0, d1),
      'new_users', private.stat_series('new_users', '', d0, d1), 'new_ref', private.stat_dims('new_ref', d0, d1), 'new_pets', private.stat_series('new_pets', '', d0, d1), 'tour_done', private.stat_series('tour_done', '', d0, d1),
      'sessions', private.stat_series('sessions', '', d0, d1), 'session_secs_sum', private.stat_series('session_secs_sum', '', d0, d1), 'session_secs_p50', private.stat_series('session_secs_p50', '', d0, d1),
      'actions', private.stat_series('actions', '', d0, d1), 'action_users', private.stat_series('action_users', '', d0, d1),
      'coins_earned', private.stat_dims('coins_earned', d0, d1), 'coins_spent', private.stat_dims('coins_spent', d0, d1),
      'ads_views', private.stat_series('ads_views', '', d0, d1), 'ads_users', private.stat_series('ads_users', '', d0, d1), 'ads_started', private.stat_series('ads_started', '', d0, d1),
      'illness_started', private.stat_dims('illness_started', d0, d1), 'illness_secs', private.stat_series('illness_secs', '', d0, d1), 'illness_ended', private.stat_series('illness_ended', '', d0, d1),
      'departed', private.stat_series('departed', '', d0, d1),
      'friends_new', private.stat_series('friends_new', '', d0, d1), 'gifts', private.stat_series('gifts', '', d0, d1), 'dms', private.stat_series('dms', '', d0, d1),
      'chat_msgs', private.stat_series('chat_msgs', '', d0, d1), 'chat_senders', private.stat_series('chat_senders', '', d0, d1), 'chat_blocked', private.stat_dims('chat_blocked', d0, d1),
      'reports_new', private.stat_series('reports_new', '', d0, d1), 'place_visits', private.stat_dims('place_visits', d0, d1), 'place_users', private.stat_series('place_users', '', d0, d1), 'place_peak', private.stat_dims('place_peak', d0, d1),
      'feat_users', private.stat_dims('feat_users', d0, d1), 'feat_chat', private.stat_series('feat_chat', '', d0, d1),
      'push_sent', private.stat_series('push_sent', '', d0, d1), 'push_fail', private.stat_series('push_fail', '', d0, d1), 'push_return', private.stat_series('push_return', '', d0, d1)),
    'retention', private.retention(d0, d1),
    'churn', (select jsonb_object_agg('d' || k.n, jsonb_build_object('n', coalesce(x.gone, 0), 'of', coalesce(x.total, 0)))
      from (values (7), (14), (30)) k(n) left join lateral (
        select count(*) filter (where coalesce(l.last_day, '1970-01-01'::date) <= d1 - k.n) gone, count(*) total
        from (select p.id, (select max(day) from public.user_active_days d where d.user_id = p.id) last_day from public.profiles p
              where (p.created_at at time zone tz)::date <= d1 - k.n) l) x on true),
    'funnel', (select jsonb_build_array(
        jsonb_build_object('key', 'signup', 'n', count(*)),
        jsonb_build_object('key', 'pet', 'n', count(*) filter (where exists (select 1 from public.pets q where q.owner_id = u.id))),
        jsonb_build_object('key', 'action', 'n', count(*) filter (where exists (select 1 from public.action_log l join public.pets q on q.id = l.pet_id where q.owner_id = u.id))),
        jsonb_build_object('key', 'tour', 'n', count(*) filter (where exists (select 1 from public.user_milestones m where m.user_id = u.id and m.key in ('tour_done', 'tour_skipped')))),
        jsonb_build_object('key', 'quest', 'n', count(*) filter (where exists (select 1 from public.quest_claims c where c.owner_id = u.id))),
        jsonb_build_object('key', 'bond2', 'n', count(*) filter (where exists (select 1 from public.pets q where q.owner_id = u.id and private.bond_level(q.bond_xp) >= 2))),
        jsonb_build_object('key', 'place', 'n', count(*) filter (where exists (select 1 from public.place_visits v where v.user_id = u.id))),
        jsonb_build_object('key', 'friend', 'n', count(*) filter (where exists (select 1 from public.friendships f where f.status = 'accepted' and (f.a = u.id or f.b = u.id)))),
        jsonb_build_object('key', 'return', 'n', count(*) filter (where exists (select 1 from public.user_active_days d where d.user_id = u.id and d.day > (u.created_at at time zone tz)::date))))
      from public.profiles u where (u.created_at at time zone tz)::date between d0 and d1),
    'progression', jsonb_build_object(
      'bond', coalesce((select jsonb_object_agg(lvl::text, jsonb_build_object('n', cnt, 'age_p50', age)) from (
          select private.bond_level(bond_xp) lvl, count(*) cnt, round(percentile_cont(0.5) within group (order by extract(epoch from now() - born_at) / 86400)::numeric, 1) age
          from public.pets where stage <> 'departed' group by 1) x), '{}'::jsonb),
      'stage', coalesce((select jsonb_object_agg(stage, cnt) from (select stage, count(*) cnt from public.pets group by 1) x), '{}'::jsonb),
      'lived_p50', (select round(percentile_cont(0.5) within group (order by lived_days)::numeric, 1) from public.pets where lived_days is not null),
      'churn_by_bond', coalesce((select jsonb_object_agg(lvl::text, cnt) from (
          select private.bond_level(q.bond_xp) lvl, count(*) cnt from public.pets q
          where q.stage <> 'departed' and not exists (select 1 from public.user_active_days d where d.user_id = q.owner_id and d.day > d1 - 7)
            and (q.created_at at time zone tz)::date <= d1 - 7 group by 1) x), '{}'::jsonb)),
    'wallet', (select jsonb_build_object('n', count(*), 'sum', coalesce(sum(coins), 0), 'avg', coalesce(round(avg(coins), 1), 0), 'p50', coalesce(percentile_cont(0.5) within group (order by coins), 0),
        'p90', coalesce(percentile_cont(0.9) within group (order by coins), 0), 'max', coalesce(max(coins), 0)) from public.wallets),
    'heat', coalesce((select jsonb_agg(jsonb_build_array(dow, h, c)) from (
        select extract(isodow from started_at at time zone tz)::int dow, extract(hour from started_at at time zone tz)::int h, count(*) c
        from public.client_sessions where started_at > now() - interval '28 days' group by 1, 2) x), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'kind', e.kind, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'enabled', e.enabled, 'config', e.config,
        'dau_during', (select round(coalesce(avg(value), 0), 1) from public.stats_daily s where s.metric = 'dau' and s.dim = '' and s.day between (e.starts_at at time zone tz)::date and least((e.ends_at at time zone tz)::date, d1)),
        'dau_before', (select round(coalesce(avg(value), 0), 1) from public.stats_daily s where s.metric = 'dau' and s.dim = '' and s.day between (e.starts_at at time zone tz)::date - 7 and (e.starts_at at time zone tz)::date - 1)) order by e.starts_at desc)
      from public.events e where e.ends_at >= (d0::timestamp at time zone tz) and e.starts_at <= now() + interval '1 day'), '[]'::jsonb),
    'ads_ecpm', coalesce(private.bal('ads.ecpm_usd'), 1),
    'ads_per_day', per_day
  );
  return out;
end $$;

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.admin_flag_meta(), public.admin_list_balance(), public.admin_set_balance(text, numeric, text), public.admin_dashboard_overview(int) from public, anon;
grant execute on function public.admin_flag_meta(), public.admin_list_balance(), public.admin_set_balance(text, numeric, text), public.admin_dashboard_overview(int) to authenticated;
