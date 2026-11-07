-- =====================================================================
-- Hatchday — Nền dữ liệu cho dashboard nhà phát triển (giai đoạn A)
-- Không viết lại hàm nào có sẵn. Chỉ thêm bảng ghi sự kiện, trigger và hàm tổng hợp:
--   coin_ledger (sổ cái xu, ghi bằng trigger trên wallets nên mọi đường đổi xu đều được ghi),
--   client_sessions + ping_session (phiên chơi thật: DAU kể cả người chỉ vào xem, thời lượng phiên),
--   signup_attribution + set_attribution (nguồn người dùng ?ref=), user_milestones + mark_milestone (xong hướng dẫn…),
--   illness_log (lịch sử bệnh), place_visits + place_online_samples (lượt vào nơi chung, số người cùng lúc),
--   user_active_days + stats_daily + private.rollup_stats (tổng hợp theo ngày giờ Việt Nam),
--   cron_tick() cho Cloudflare Worker (chỉ service_role): lấy mẫu, tổng hợp hôm nay và hôm qua, dọn dẹp.
-- Ngày thống kê tính theo múi giờ Asia/Ho_Chi_Minh.
-- =====================================================================

-- ---------- Sổ cái xu ----------
create table public.coin_ledger (
  id       bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  delta    int  not null,
  balance  int  not null,
  ctx      text not null default 'other',
  at       timestamptz not null default now()
);
create index coin_ledger_at on public.coin_ledger (at);
create index coin_ledger_owner on public.coin_ledger (owner_id, at desc);

-- Nguồn của khoản xu: hàm nào đặt hatchday.ctx thì lấy; không thì lấy tên RPC trong câu lệnh gốc (PostgREST gọi "public"."tên"(…)).
create or replace function private.ledger_ctx() returns text
language plpgsql stable set search_path = '' as $$
declare c text := nullif(current_setting('hatchday.ctx', true), ''); q text;
begin
  if c is not null then return c; end if;
  q := coalesce(current_query(), '');
  c := (regexp_match(q, 'public"?\."?([a-z_0-9]+)"?\s*\(', 'i'))[1];
  if c is null then c := (regexp_match(q, '(?:select|from)\s+(?:public\.)?([a-z_0-9]+)\s*\(', 'i'))[1]; end if;
  return coalesce(lower(c), 'other');
end $$;

create or replace function private.wallet_ledger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.coin_ledger (owner_id, delta, balance, ctx) values (new.owner_id, new.coins, new.coins, 'start');
  elsif new.coins is distinct from old.coins then
    insert into public.coin_ledger (owner_id, delta, balance, ctx) values (new.owner_id, new.coins - old.coins, new.coins, private.ledger_ctx());
  end if;
  return null;
end $$;
create trigger wallets_ledger after insert or update of coins on public.wallets for each row execute function private.wallet_ledger();
insert into public.coin_ledger (owner_id, delta, balance, ctx) select owner_id, coins, coins, 'backfill' from public.wallets;

-- ---------- Phiên chơi ----------
create table public.client_sessions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  platform     text not null default 'unknown' check (platform in ('mobile', 'desktop', 'unknown')),
  standalone   boolean not null default false
);
create index client_sessions_user on public.client_sessions (user_id, last_seen_at desc);
create index client_sessions_seen on public.client_sessions (last_seen_at);

create or replace function public.ping_session(p_platform text default 'unknown', p_standalone boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); s public.client_sessions; pf text := case when p_platform in ('mobile', 'desktop') then p_platform else 'unknown' end;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into s from public.client_sessions where user_id = uid order by last_seen_at desc limit 1;
  if s.id is not null and s.last_seen_at > now() - interval '5 minutes' then
    if s.last_seen_at < now() - interval '20 seconds' then update public.client_sessions set last_seen_at = now() where id = s.id; end if;
    return jsonb_build_object('session', s.id, 'new', false);
  end if;
  insert into public.client_sessions (user_id, platform, standalone) values (uid, pf, coalesce(p_standalone, false)) returning * into s;
  return jsonb_build_object('session', s.id, 'new', true);
end $$;

-- ---------- Nguồn người dùng và mốc hành trình ----------
create table public.signup_attribution (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ref     text not null,
  medium  text,
  at      timestamptz not null default now()
);
create or replace function public.set_attribution(p_ref text, p_medium text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r text := lower(btrim(coalesce(p_ref, ''))); m text := nullif(lower(btrim(coalesce(p_medium, ''))), '');
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if r !~ '^[a-z0-9_.-]{1,40}$' or (m is not null and m !~ '^[a-z0-9_.-]{1,40}$') then return; end if;
  insert into public.signup_attribution (user_id, ref, medium) values (uid, r, m) on conflict do nothing;
end $$;

create table public.user_milestones (
  user_id uuid not null references auth.users (id) on delete cascade,
  key     text not null,
  at      timestamptz not null default now(),
  primary key (user_id, key)
);
create or replace function public.mark_milestone(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_key not in ('tour_done', 'tour_skipped', 'pwa_installed', 'push_on') then raise exception 'invalid_milestone'; end if;
  insert into public.user_milestones (user_id, key) values (auth.uid(), p_key) on conflict do nothing;
end $$;

-- ---------- Lịch sử bệnh ----------
create table public.illness_log (
  id         bigint generated always as identity primary key,
  pet_id     uuid not null references public.pets (id) on delete cascade,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  illness    text not null,
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);
create index illness_log_start on public.illness_log (started_at);
create or replace function private.illness_log_fn() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.illness is distinct from old.illness then
    if old.illness is not null then update public.illness_log set ended_at = now() where pet_id = new.id and ended_at is null; end if;
    if new.illness is not null then insert into public.illness_log (pet_id, owner_id, illness) values (new.id, new.owner_id, new.illness); end if;
  end if;
  return null;
end $$;
create trigger pets_illness_log after update of illness on public.pets for each row execute function private.illness_log_fn();
insert into public.illness_log (pet_id, owner_id, illness, started_at) select id, owner_id, illness, coalesce(sick_since, now()) from public.pets where illness is not null and stage <> 'departed';

-- ---------- Lượt vào nơi chung ----------
create table public.place_visits (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  place   text not null,
  at      timestamptz not null default now()
);
create index place_visits_at on public.place_visits (at);
create or replace function private.place_visit_fn() returns trigger
language plpgsql security definer set search_path = '' as $$
begin insert into public.place_visits (user_id, place) values (new.user_id, new.place); return null; end $$;
create trigger place_members_visit after insert on public.place_members for each row execute function private.place_visit_fn();

create table public.place_online_samples (
  place text not null,
  at    timestamptz not null default now(),
  n     int  not null,
  primary key (place, at)
);

-- ---------- Tổng hợp theo ngày ----------
create table public.user_active_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
create index user_active_days_day on public.user_active_days (day);
create table public.stats_daily (
  day    date not null,
  metric text not null,
  dim    text not null default '',
  value  numeric not null,
  primary key (day, metric, dim)
);

alter table public.coin_ledger enable row level security;
alter table public.client_sessions enable row level security;
alter table public.signup_attribution enable row level security;
alter table public.user_milestones enable row level security;
alter table public.illness_log enable row level security;
alter table public.place_visits enable row level security;
alter table public.place_online_samples enable row level security;
alter table public.user_active_days enable row level security;
alter table public.stats_daily enable row level security;

create or replace function private.vn_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;

-- Tổng hợp một ngày. Chỉ chạy lại cho hôm nay và hôm qua: nguồn sống ngắn (chat 24 giờ, mã quảng cáo) chỉ ghi khi p_day là hôm nay,
-- nên số liệu hôm qua là lần chạy cuối của hôm qua. Ảnh chụp 'snap_*' chỉ ghi cho hôm nay.
create or replace function private.rollup_stats(p_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s timestamptz := (p_day::timestamp at time zone 'Asia/Ho_Chi_Minh');
  e timestamptz := ((p_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  today boolean := (p_day = private.vn_today());
begin
  insert into public.user_active_days (user_id, day)
    select user_id, p_day from public.client_sessions where started_at < e and last_seen_at >= s
    union select p.owner_id, p_day from public.action_log a join public.pets p on p.id = a.pet_id where a.created_at >= s and a.created_at < e
  on conflict do nothing;

  delete from public.stats_daily where day = p_day and metric not like 'snap\_%' and (today or metric not in
    ('chat_msgs', 'chat_senders', 'chat_blocked', 'ads_started', 'feat_chat'));
  if today then delete from public.stats_daily where day = p_day and metric like 'snap\_%'; end if;

  insert into public.stats_daily (day, metric, dim, value)
  select p_day, 'dau', '', count(*) from public.user_active_days where day = p_day
  union all select p_day, 'dau_platform', platform, count(distinct user_id) from public.client_sessions where started_at < e and last_seen_at >= s group by platform
  union all select p_day, 'dau_standalone', '', count(distinct user_id) from public.client_sessions where started_at < e and last_seen_at >= s and standalone
  union all select p_day, 'sessions', '', count(*) from public.client_sessions where started_at >= s and started_at < e
  union all select p_day, 'session_secs_sum', '', coalesce(sum(extract(epoch from last_seen_at - started_at)), 0) from public.client_sessions where started_at >= s and started_at < e
  union all select p_day, 'session_secs_p50', '', coalesce(percentile_cont(0.5) within group (order by extract(epoch from last_seen_at - started_at)), 0) from public.client_sessions where started_at >= s and started_at < e
  union all select p_day, 'new_users', '', count(*) from public.profiles where created_at >= s and created_at < e
  union all select p_day, 'new_ref', coalesce(a.ref, 'direct'), count(*) from public.profiles p left join public.signup_attribution a on a.user_id = p.id where p.created_at >= s and p.created_at < e group by 3
  union all select p_day, 'new_pets', '', count(*) from public.pets where created_at >= s and created_at < e
  union all select p_day, 'tour_done', '', count(*) from public.user_milestones where key = 'tour_done' and at >= s and at < e
  union all select p_day, 'actions', '', count(*) from public.action_log where created_at >= s and created_at < e
  union all select p_day, 'action_users', '', count(distinct p.owner_id) from public.action_log a join public.pets p on p.id = a.pet_id where a.created_at >= s and a.created_at < e
  union all select p_day, 'coins_earned', ctx, sum(delta) from public.coin_ledger where at >= s and at < e and delta > 0 and ctx <> 'backfill' group by ctx
  union all select p_day, 'coins_spent', ctx, -sum(delta) from public.coin_ledger where at >= s and at < e and delta < 0 group by ctx
  union all select p_day, 'ads_views', '', coalesce(sum(count), 0) from public.ad_rewards where day = p_day
  union all select p_day, 'ads_users', '', count(*) from public.ad_rewards where day = p_day and count > 0
  union all select p_day, 'reports_new', '', count(*) from public.reports where created_at >= s and created_at < e
  union all select p_day, 'friends_new', '', count(*) from public.friendships where accepted_at >= s and accepted_at < e
  union all select p_day, 'gifts', '', count(*) from public.mailbox where kind = 'gift' and created_at >= s and created_at < e
  union all select p_day, 'dms', '', count(*) from public.dm_messages where created_at >= s and created_at < e
  union all select p_day, 'illness_started', illness, count(*) from public.illness_log where started_at >= s and started_at < e group by illness
  union all select p_day, 'illness_secs', '', coalesce(sum(extract(epoch from ended_at - started_at)), 0) from public.illness_log where ended_at >= s and ended_at < e
  union all select p_day, 'illness_ended', '', count(*) from public.illness_log where ended_at >= s and ended_at < e
  union all select p_day, 'departed', '', count(*) from public.pets where departed_at >= s and departed_at < e
  union all select p_day, 'place_visits', place, count(*) from public.place_visits where at >= s and at < e group by place
  union all select p_day, 'place_users', '', count(distinct user_id) from public.place_visits where at >= s and at < e
  union all select p_day, 'place_peak', place, max(n) from public.place_online_samples where at >= s and at < e group by place
  union all select p_day, 'feat_users', f, count(distinct u) from (
      select case when a.action = 'feed' then 'feed' when a.action like 'bath%' then 'bath' when a.action like 'play%' then 'play'
                  when a.action in ('pet', 'talk', 'sleep') then a.action end as f, p.owner_id as u
        from public.action_log a join public.pets p on p.id = a.pet_id where a.created_at >= s and a.created_at < e
      union all select 'quest', owner_id from public.quest_claims where day = p_day
      union all select 'places', user_id from public.place_visits where at >= s and at < e
      union all select 'shop', owner_id from public.coin_ledger where at >= s and at < e and (ctx like 'buy\_%' or ctx = 'sell_food')
      union all select 'clinic', owner_id from public.coin_ledger where at >= s and at < e and ctx in ('visit_clinic', 'buy_medicine', 'use_medicine')
    ) x where f is not null group by f;

  if today then
    insert into public.stats_daily (day, metric, dim, value)
    select p_day, 'chat_msgs', '', count(*) from public.chat_log where created_at >= s and created_at < e
    union all select p_day, 'chat_senders', '', count(distinct user_id) from public.chat_log where created_at >= s and created_at < e
    union all select p_day, 'chat_blocked', reason, count(*) from public.chat_strikes where created_at >= s and created_at < e group by reason
    union all select p_day, 'ads_started', '', count(*) from public.ad_nonces where issued_at >= s and issued_at < e
    union all select p_day, 'feat_chat', '', count(distinct user_id) from public.chat_log where created_at >= s and created_at < e;

    insert into public.stats_daily (day, metric, dim, value)
    select p_day, 'snap_wallet', 'n', count(*) from public.wallets
    union all select p_day, 'snap_wallet', 'sum', coalesce(sum(coins), 0) from public.wallets
    union all select p_day, 'snap_wallet', 'p50', coalesce(percentile_cont(0.5) within group (order by coins), 0) from public.wallets
    union all select p_day, 'snap_wallet', 'p90', coalesce(percentile_cont(0.9) within group (order by coins), 0) from public.wallets
    union all select p_day, 'snap_bond', lvl::text, count(*) from (select private.bond_level(bond_xp) lvl from public.pets where stage <> 'departed') x group by lvl
    union all select p_day, 'snap_pets_alive', '', count(*) from public.pets where stage <> 'departed'
    union all select p_day, 'snap_users', '', count(*) from public.profiles
    union all select p_day, 'snap_ill_now', '', count(*) from public.pets where illness is not null and stage <> 'departed';
  end if;
end $$;

create or replace function private.sample_places() returns void
language sql security definer set search_path = '' as $$
  insert into public.place_online_samples (place, n)
  select place, count(*) from public.place_members where last_seen > now() - interval '120 seconds' group by place
  on conflict do nothing
$$;

create or replace function private.sweep_stats() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.sweep_chat();
  delete from public.ad_nonces where issued_at < now() - interval '3 days';
  delete from public.client_sessions where last_seen_at < now() - interval '120 days';
  delete from public.coin_ledger where at < now() - interval '120 days';
  delete from public.place_visits where at < now() - interval '120 days';
  delete from public.place_online_samples where at < now() - interval '120 days';
end $$;

-- Cloudflare Worker gọi mỗi 15 phút (service_role).
create or replace function public.cron_tick() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.sample_places();
  perform private.rollup_stats(private.vn_today() - 1);
  perform private.rollup_stats(private.vn_today());
  perform private.sweep_stats();
  return jsonb_build_object('ok', true, 'day', private.vn_today());
end $$;

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.ping_session(text, boolean), public.set_attribution(text, text), public.mark_milestone(text) from public, anon;
grant execute on function public.ping_session(text, boolean), public.set_attribution(text, text), public.mark_milestone(text) to authenticated;
revoke all on function public.cron_tick() from public, anon, authenticated;
-- service_role có sẵn trên Supabase; bản test cũ không tạo vai trò này nên cấp quyền có điều kiện.
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.cron_tick() to service_role; end if; end $$;
