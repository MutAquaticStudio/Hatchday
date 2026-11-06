-- =====================================================================
-- Hatchday — Thông báo đẩy từ máy chủ (giai đoạn E)
-- Người chơi đăng ký thiết bị (Web Push) và chọn loại thông báo. Cloudflare Worker (workers/cron) gọi push_pick() mỗi 15 phút bằng service_role,
-- gửi Web Push rồi báo kết quả bằng push_mark(). Luật chọn người nhận nằm ở push_pick (cùng luật với nhắc nhở cục bộ notify.js):
--   care : bé cần chăm (đói/buồn/bẩn/ốm), người chơi vắng ≥ 40 phút, tối đa 1 lần/4 giờ;
--   mail : có thư/quà chưa nhận, tối đa 1 lần/24 giờ;
--   event: sự kiện mới bắt đầu trong 24 giờ qua, mỗi sự kiện một lần.
-- Chung: tối đa 3 thông báo/24 giờ/người, không gửi trong giờ yên lặng (mặc định 22:00–07:00 giờ của người chơi), cờ push.enabled là công tắc khẩn.
-- Hàm viết lại: public.cron_tick (từ 20261213000000_stats_foundation.sql; thêm tổng hợp push). Test: supabase/tests/push.test.ts.
-- =====================================================================

create table public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh     text not null check (char_length(p256dh) between 40 and 200),
  auth       text not null check (char_length(auth) between 10 and 100),
  ua         text check (char_length(ua) <= 200),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fail_count int not null default 0
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
create table public.push_prefs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  care       boolean not null default true,
  events     boolean not null default true,
  mail       boolean not null default true,
  quiet_from int not null default 22 check (quiet_from between 0 and 23),
  quiet_to   int not null default 7 check (quiet_to between 0 and 23)
);
create table public.push_log (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind    text not null check (kind in ('care', 'mail', 'event')),
  ref     text,
  sent_at timestamptz not null default now(),
  status  text not null default 'queued' check (status in ('queued', 'ok', 'fail'))
);
create index push_log_user on public.push_log (user_id, sent_at desc);
create index push_log_at on public.push_log (sent_at);
alter table public.push_subscriptions enable row level security;
alter table public.push_prefs enable row level security;
alter table public.push_log enable row level security;

-- ---------- Người chơi ----------
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000 or char_length(coalesce(p_p256dh, '')) not between 40 and 200 or char_length(coalesce(p_auth, '')) not between 10 and 100 then raise exception 'invalid_subscription'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, ua) values (uid, p_endpoint, p_p256dh, p_auth, left(p_ua, 200))
    on conflict (endpoint) do update set user_id = uid, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, fail_count = 0;
  delete from public.push_subscriptions where user_id = uid and id not in (select id from public.push_subscriptions where user_id = uid order by created_at desc, id desc limit 5);
end $$;

create or replace function public.remove_push_subscription(p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.push_subscriptions where user_id = auth.uid() and endpoint = p_endpoint;
end $$;

create or replace function public.set_push_prefs(p_care boolean, p_events boolean, p_mail boolean, p_quiet_from int default 22, p_quiet_to int default 7) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_quiet_from not between 0 and 23 or p_quiet_to not between 0 and 23 then raise exception 'invalid_prefs'; end if;
  insert into public.push_prefs (user_id, care, events, mail, quiet_from, quiet_to) values (auth.uid(), coalesce(p_care, true), coalesce(p_events, true), coalesce(p_mail, true), p_quiet_from, p_quiet_to)
    on conflict (user_id) do update set care = excluded.care, events = excluded.events, mail = excluded.mail, quiet_from = excluded.quiet_from, quiet_to = excluded.quiet_to;
end $$;

create or replace function public.get_push_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.push_prefs;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into p from public.push_prefs where user_id = uid;
  return jsonb_build_object('devices', (select count(*) from public.push_subscriptions where user_id = uid),
    'prefs', jsonb_build_object('care', coalesce(p.care, true), 'events', coalesce(p.events, true), 'mail', coalesce(p.mail, true), 'quiet_from', coalesce(p.quiet_from, 22), 'quiet_to', coalesce(p.quiet_to, 7)),
    'enabled', coalesce((select value from public.system_flags where key = 'push.enabled'), 'false'::jsonb));
end $$;

-- ---------- Worker (service_role) ----------
create or replace function private.in_quiet(h int, f int, t int) returns boolean
language sql immutable set search_path = '' as $$ select case when f > t then (h >= f or h < t) else (h >= f and h < t) end $$;

create or replace function public.push_pick(p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record; s record; res jsonb := '[]'::jsonb; p public.pets; k text; rf text; ttl text; msg text; h int; n int; ev record; lid bigint;
begin
  if coalesce((select value from public.system_flags where key = 'push.enabled'), 'false'::jsonb) <> 'true'::jsonb then return res; end if;
  for r in select u.user_id, coalesce(pp.care, true) care, coalesce(pp.events, true) events, coalesce(pp.mail, true) mail, coalesce(pp.quiet_from, 22) qf, coalesce(pp.quiet_to, 7) qt,
                  coalesce(pr.timezone, 'Asia/Ho_Chi_Minh') tz
           from (select distinct user_id from public.push_subscriptions where fail_count < 8) u
           left join public.push_prefs pp on pp.user_id = u.user_id join public.profiles pr on pr.id = u.user_id
           order by random() limit greatest(1, least(coalesce(p_limit, 50), 200)) loop
    begin
      h := extract(hour from now() at time zone r.tz)::int;
      if private.in_quiet(h, r.qf, r.qt) then continue; end if;
      if (select count(*) from public.push_log where user_id = r.user_id and sent_at > now() - interval '24 hours') >= 3 then continue; end if;
      if exists (select 1 from public.client_sessions where user_id = r.user_id and last_seen_at > now() - interval '40 minutes') then continue; end if;
      k := null; rf := null;
      if r.care and not exists (select 1 from public.push_log where user_id = r.user_id and kind = 'care' and sent_at > now() - interval '4 hours') then
        select * into p from public.pets where owner_id = r.user_id and stage not in ('egg', 'departed');
        if p.id is not null and not p.asleep and not exists (select 1 from public.action_log where pet_id = p.id and created_at > now() - interval '40 minutes') then
          p := private.decay_pet(p.id);
          if p.illness is not null then k := 'care'; ttl := 'Hatchday'; msg := format('%s đang không khoẻ, ghé xem bé nhé.', p.name);
          elsif p.no < 35 then k := 'care'; ttl := 'Hatchday'; msg := format('%s đói rồi, ghé cho bé ăn nhé.', p.name);
          elsif p.vui < 35 then k := 'care'; ttl := 'Hatchday'; msg := format('%s hơi buồn, ghé chơi với bé nhé.', p.name);
          elsif p.sach < 30 then k := 'care'; ttl := 'Hatchday'; msg := format('%s bẩn rồi, ghé tắm cho bé nhé.', p.name); end if;
        end if;
      end if;
      if k is null and r.mail and not exists (select 1 from public.push_log where user_id = r.user_id and kind = 'mail' and sent_at > now() - interval '24 hours') then
        select count(*) into n from public.mailbox where to_user = r.user_id and claimed_at is null and returned_at is null and expires_at > now() and created_at > now() - interval '3 days';
        if n > 0 then k := 'mail'; ttl := 'Bạn có thư mới'; msg := format('Có %s thư hoặc quà đang chờ bạn nhận.', n); end if;
      end if;
      if k is null and r.events then
        select e.id, e.title, e.config into ev from public.events e where e.enabled and e.starts_at <= now() and e.starts_at > now() - interval '24 hours' and e.ends_at > now()
          and not exists (select 1 from public.push_log l where l.user_id = r.user_id and l.kind = 'event' and l.ref = e.id::text) order by e.starts_at desc limit 1;
        if ev.id is not null then k := 'event'; rf := ev.id::text; ttl := 'Sự kiện mới'; msg := coalesce(ev.config ->> 'banner', ev.title); end if;
      end if;
      if k is null then continue; end if;
      insert into public.push_log (user_id, kind, ref) values (r.user_id, k, rf) returning id into lid;
      for s in select id, endpoint, p256dh, auth from public.push_subscriptions where user_id = r.user_id and fail_count < 8 loop
        res := res || jsonb_build_array(jsonb_build_object('sub_id', s.id, 'log_id', lid, 'user_id', r.user_id, 'kind', k, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
          'payload', jsonb_build_object('title', ttl, 'body', msg, 'tag', k, 'url', './?from=push&k=' || k)));
      end loop;
    exception when others then continue; -- một người lỗi không làm hỏng cả đợt
    end;
  end loop;
  return res;
end $$;

-- Báo kết quả gửi một thiết bị: 404/410 thì xoá đăng ký; lỗi khác tăng đếm, quá 8 lần thì bỏ.
create or replace function public.push_mark(p_sub bigint, p_log bigint, p_ok boolean, p_status int default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_ok then
    update public.push_subscriptions set last_ok_at = now(), fail_count = 0 where id = p_sub;
    update public.push_log set status = 'ok' where id = p_log;
  else
    if p_status in (404, 410) then delete from public.push_subscriptions where id = p_sub;
    else update public.push_subscriptions set fail_count = fail_count + 1 where id = p_sub; end if;
    update public.push_log set status = 'fail' where id = p_log and status = 'queued';
  end if;
end $$;

create or replace function private.rollup_push(p_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare s timestamptz := (p_day::timestamp at time zone 'Asia/Ho_Chi_Minh'); e timestamptz := ((p_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
begin
  delete from public.stats_daily where day = p_day and (metric in ('push_sent', 'push_fail', 'push_return') or (metric like 'snap\_push%' and p_day = private.vn_today()));
  insert into public.stats_daily (day, metric, dim, value)
  select p_day, 'push_sent', '', count(*) from public.push_log where sent_at >= s and sent_at < e and status = 'ok'
  union all select p_day, 'push_fail', '', count(*) from public.push_log where sent_at >= s and sent_at < e and status = 'fail'
  union all select p_day, 'push_return', '', count(distinct l.user_id) from public.push_log l
    where l.sent_at >= s and l.sent_at < e and l.status = 'ok' and exists (select 1 from public.client_sessions c where c.user_id = l.user_id and c.started_at > l.sent_at and c.started_at <= l.sent_at + interval '1 hour');
  if p_day = private.vn_today() then
    insert into public.stats_daily (day, metric, dim, value)
    select p_day, 'snap_push_devices', '', count(*) from public.push_subscriptions
    union all select p_day, 'snap_push_users', '', count(distinct user_id) from public.push_subscriptions;
  end if;
end $$;

create or replace function public.cron_tick() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.sample_places();
  perform private.rollup_stats(private.vn_today() - 1);
  perform private.rollup_stats(private.vn_today());
  perform private.rollup_push(private.vn_today() - 1);
  perform private.rollup_push(private.vn_today());
  perform private.sweep_stats();
  delete from public.push_log where sent_at < now() - interval '60 days';
  return jsonb_build_object('ok', true, 'day', private.vn_today());
end $$;

create or replace function public.admin_push_stats() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('flag');
  return jsonb_build_object('devices', (select count(*) from public.push_subscriptions), 'users', (select count(distinct user_id) from public.push_subscriptions),
    'sent_24h', (select count(*) from public.push_log where sent_at > now() - interval '24 hours' and status = 'ok'),
    'fail_24h', (select count(*) from public.push_log where sent_at > now() - interval '24 hours' and status = 'fail'));
end $$;

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.save_push_subscription(text, text, text, text), public.remove_push_subscription(text), public.set_push_prefs(boolean, boolean, boolean, int, int),
  public.get_push_state(), public.admin_push_stats() from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text), public.remove_push_subscription(text), public.set_push_prefs(boolean, boolean, boolean, int, int),
  public.get_push_state(), public.admin_push_stats() to authenticated;
revoke all on function public.push_pick(int), public.push_mark(bigint, bigint, boolean, int) from public, anon, authenticated;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.push_pick(int), public.push_mark(bigint, bigint, boolean, int) to service_role; end if; end $$;
