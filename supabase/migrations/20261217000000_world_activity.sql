-- Hoạt động trong thế giới: mục "Khám phá hôm nay", huy hiệu, mini-game (bắt bướm, pha trà).
-- Máy chủ quyết định mọi khoản thưởng và trần ngày; client chỉ báo "đã làm gì". Hằng số khớp src/game/world-activity.ts (test: supabase/tests/world-activity.test.ts).
-- Hàm không viết lại hàm cũ nào. Xu đi qua private.earn nên sổ cái ghi nguồn theo tên RPC (claim_explore, claim_badge, submit_minigame).

create table public.world_activity (
  owner_id uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  kind     text not null,
  n        int  not null default 0,
  primary key (owner_id, day, kind)
);
create table public.world_totals (
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind     text not null,
  n        bigint not null default 0,
  primary key (owner_id, kind)
);
create table public.badge_claims (
  owner_id uuid not null references auth.users (id) on delete cascade,
  badge    text not null,
  at       timestamptz not null default now(),
  primary key (owner_id, badge)
);
create table public.explore_claims (
  owner_id uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  tier     smallint not null check (tier between 0 and 1),
  primary key (owner_id, day, tier)
);
create table public.minigame_logs (
  owner_id uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  kind     text not null check (kind in ('butterfly', 'brew')),
  plays    int  not null default 0,
  best     int  not null default 0,
  last_at  timestamptz not null default now(),
  primary key (owner_id, day, kind)
);
create table public.world_badges (
  id text primary key, kind text not null, target int not null check (target > 0), reward int not null check (reward >= 0), sort int not null
);
alter table public.world_activity enable row level security;
alter table public.world_totals enable row level security;
alter table public.badge_claims enable row level security;
alter table public.explore_claims enable row level security;
alter table public.minigame_logs enable row level security;
alter table public.world_badges enable row level security;

insert into public.world_badges (id, kind, target, reward, sort) values
  ('swing10', 'swing', 10, 30, 1), ('seesaw10', 'seesaw', 10, 30, 2), ('slide10', 'slide', 10, 30, 3), ('ducks10', 'ducks', 10, 30, 4),
  ('bench15', 'bench', 15, 30, 5), ('fountain15', 'fountain', 15, 30, 6), ('stage5', 'stage', 5, 40, 7), ('tea12', 'tea', 12, 30, 8),
  ('cat10', 'cat', 10, 30, 9), ('butterfly40', 'butterfly', 40, 50, 10), ('brew5', 'brew', 5, 50, 11), ('explore7', 'explore', 7, 60, 12);

insert into public.balance_config (key, value, def, min, max, unit, label, grp, note) values
  ('mini.plays',         2, 2, 0, 6,  'lượt', 'Số lượt mini-game có thưởng mỗi ngày (mỗi trò)', 'Mini-game', '0 = vẫn chơi được nhưng không có xu.'),
  ('mini.butterfly_coin', 1, 1, 0, 5, 'xu',   'Xu mỗi con bướm bắt được (tối đa 12 con)',     'Mini-game', 'Điểm do máy khách báo nên trần ngày là lớp bảo vệ chính.'),
  ('mini.brew_coin',     3, 3, 0, 10, 'xu',   'Xu mỗi sao khi pha trà (tối đa 5 sao)',         'Mini-game', '');

-- ---------- Helper ----------
create or replace function private.is_toy_kind(k text) returns boolean language sql immutable set search_path = '' as $$ select k in ('swing', 'seesaw', 'slide', 'ducks') $$;

-- Tổng số lần của một hoạt động: đồ chơi lấy từ toy_logs, "explore" là số ngày đã nhận bậc 1, còn lại lấy từ world_totals.
create or replace function private.activity_total(uid uuid, k text) returns bigint
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_toy_kind(k) then
    return coalesce((select sum(tl.n) from public.toy_logs tl join public.pets p on p.id = tl.pet_id where p.owner_id = uid and tl.toy = k), 0);
  elsif k = 'explore' then
    return (select count(*) from public.explore_claims where owner_id = uid and tier = 0);
  end if;
  return coalesce((select n from public.world_totals where owner_id = uid and kind = k), 0);
end $$;

-- Các hoạt động khác nhau đã làm trong ngày d (mọi đồ chơi + hoạt động + mini-game).
create or replace function private.kinds_today(uid uuid, d date) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct k order by k), '{}') from (
    select kind as k from public.world_activity where owner_id = uid and day = d and n > 0
    union select tl.toy from public.toy_logs tl join public.pets p on p.id = tl.pet_id where p.owner_id = uid and tl.day = d and tl.n > 0
  ) s
$$;

-- Huy hiệu nào vừa đủ điều kiện (chưa nhận) nhưng trước đó thì chưa: so sánh tổng trước/sau khi cộng.
create or replace function private.badges_crossed(uid uuid, k text, before_n bigint) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(b.id order by b.sort), '{}') from public.world_badges b
  where b.kind = k and before_n < b.target and private.activity_total(uid, k) >= b.target
$$;

-- ---------- Trạng thái ----------
create or replace function public.get_world_progress() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date; ks text[]; n int; tiers jsonb; bad jsonb; mini jsonb; lim int := coalesce(private.bal('mini.plays'), 2)::int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  d := private.local_day(uid); ks := private.kinds_today(uid, d); n := coalesce(array_length(ks, 1), 0);
  tiers := jsonb_build_array(
    jsonb_build_object('tier', 0, 'need', 3, 'reward', 20, 'claimed', exists (select 1 from public.explore_claims where owner_id = uid and day = d and tier = 0), 'ready', n >= 3),
    jsonb_build_object('tier', 1, 'need', 6, 'reward', 40, 'claimed', exists (select 1 from public.explore_claims where owner_id = uid and day = d and tier = 1), 'ready', n >= 6));
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'progress', least(private.activity_total(uid, b.kind), b.target), 'target', b.target, 'reward', b.reward,
    'claimed', exists (select 1 from public.badge_claims c where c.owner_id = uid and c.badge = b.id)) order by b.sort), '[]') into bad from public.world_badges b;
  select jsonb_object_agg(k, jsonb_build_object('plays', coalesce(m.plays, 0), 'left', greatest(0, lim - coalesce(m.plays, 0)), 'best', coalesce(m.best, 0)))
    into mini from (values ('butterfly'), ('brew')) v(k) left join public.minigame_logs m on m.owner_id = uid and m.day = d and m.kind = v.k;
  return jsonb_build_object('day', d, 'kinds', to_jsonb(ks), 'explore', tiers, 'badges', bad, 'mini', mini);
end $$;

-- ---------- Báo hoạt động ----------
create or replace function public.record_activity(p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date; used int; counted boolean := false; before_n bigint; newly text[] := '{}';
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_kind is null or p_kind not in ('bench', 'fountain', 'stage', 'tea', 'cat') then raise exception 'unknown_activity'; end if;
  if private.active_pet_id(uid) is null then raise exception 'no_pet'; end if;
  d := private.local_day(uid);
  select coalesce(n, 0) into used from public.world_activity where owner_id = uid and day = d and kind = p_kind; used := coalesce(used, 0);
  if used < 30 then -- trần 30 lần/ngày mỗi hoạt động, vượt thì bỏ qua êm (không báo lỗi)
    before_n := private.activity_total(uid, p_kind);
    insert into public.world_activity (owner_id, day, kind, n) values (uid, d, p_kind, 1) on conflict (owner_id, day, kind) do update set n = public.world_activity.n + 1;
    insert into public.world_totals (owner_id, kind, n) values (uid, p_kind, 1) on conflict (owner_id, kind) do update set n = public.world_totals.n + 1;
    counted := true; newly := private.badges_crossed(uid, p_kind, before_n);
  end if;
  return jsonb_build_object('kinds', to_jsonb(private.kinds_today(uid, d)), 'counted', counted, 'newly', to_jsonb(newly));
end $$;

-- ---------- Nhận thưởng ----------
create or replace function public.claim_explore(p_tier int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date; n int; need int; rew int; before_n bigint; newly text[] := '{}';
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_tier is null or p_tier not in (0, 1) then raise exception 'invalid_tier'; end if;
  d := private.local_day(uid); n := coalesce(array_length(private.kinds_today(uid, d), 1), 0);
  need := case p_tier when 0 then 3 else 6 end; rew := case p_tier when 0 then 20 else 40 end;
  if n < need then raise exception 'quest_not_done'; end if;
  before_n := private.activity_total(uid, 'explore');
  insert into public.explore_claims (owner_id, day, tier) values (uid, d, p_tier) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  perform private.earn(uid, rew, false);
  if p_tier = 0 then newly := private.badges_crossed(uid, 'explore', before_n); end if;
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'reward', rew, 'newly', to_jsonb(newly));
end $$;

create or replace function public.claim_badge(p_badge text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); b public.world_badges;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into b from public.world_badges where id = p_badge;
  if b.id is null then raise exception 'unknown_badge'; end if;
  if private.activity_total(uid, b.kind) < b.target then raise exception 'quest_not_done'; end if;
  insert into public.badge_claims (owner_id, badge) values (uid, b.id) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  perform private.earn(uid, b.reward, false);
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'reward', b.reward);
end $$;

-- ---------- Mini-game ----------
-- Điểm do máy khách báo; máy chủ chặn điểm vượt trần, giãn cách tối thiểu 20 giây giữa hai lượt cùng trò, và chỉ trả xu cho vài lượt đầu mỗi ngày.
create or replace function public.submit_minigame(p_kind text, p_score int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); d date; mx int; per int; lim int := coalesce(private.bal('mini.plays'), 2)::int; m public.minigame_logs; reward int := 0; rewarded boolean := false;
  before_n bigint; add_n int; newly text[] := '{}';
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_kind is null or p_kind not in ('butterfly', 'brew') then raise exception 'unknown_activity'; end if;
  mx := case p_kind when 'butterfly' then 12 else 5 end;
  if p_score is null or p_score < 0 or p_score > mx then raise exception 'invalid_score'; end if;
  if private.active_pet_id(uid) is null then raise exception 'no_pet'; end if;
  d := private.local_day(uid);
  select * into m from public.minigame_logs where owner_id = uid and day = d and kind = p_kind for update;
  if m.owner_id is not null and m.last_at > now() - interval '20 seconds' then raise exception 'rate_limited'; end if;
  per := case p_kind when 'butterfly' then coalesce(private.bal('mini.butterfly_coin'), 1)::int else coalesce(private.bal('mini.brew_coin'), 3)::int end;
  if coalesce(m.plays, 0) < lim then reward := p_score * per; rewarded := true; end if;
  insert into public.minigame_logs (owner_id, day, kind, plays, best, last_at) values (uid, d, p_kind, 1, p_score, now())
    on conflict (owner_id, day, kind) do update set plays = public.minigame_logs.plays + 1, best = greatest(public.minigame_logs.best, p_score), last_at = now()
    returning * into m;
  if reward > 0 then perform private.earn(uid, reward, false); end if;
  -- tổng cho huy hiệu: bướm cộng số con bắt được, trà chỉ cộng khi đủ 5 sao; hoạt động trong ngày luôn được ghi để tính "Khám phá"
  add_n := case p_kind when 'butterfly' then p_score else (case when p_score = 5 then 1 else 0 end) end;
  before_n := private.activity_total(uid, p_kind);
  insert into public.world_activity (owner_id, day, kind, n) values (uid, d, p_kind, 1) on conflict (owner_id, day, kind) do update set n = public.world_activity.n + 1;
  if add_n > 0 then
    insert into public.world_totals (owner_id, kind, n) values (uid, p_kind, add_n) on conflict (owner_id, kind) do update set n = public.world_totals.n + add_n;
    newly := private.badges_crossed(uid, p_kind, before_n);
  end if;
  return jsonb_build_object('reward', reward, 'rewarded', rewarded, 'coins', (select coins from public.wallets where owner_id = uid), 'plays', m.plays,
    'left', greatest(0, lim - m.plays), 'best', m.best, 'newly', to_jsonb(newly));
end $$;

-- Dọn log cũ: viết lại private.sweep_stats (bản gốc ở 20261213000000_stats_foundation.sql) và thêm 3 bảng mới.
create or replace function private.sweep_stats() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.sweep_chat();
  delete from public.ad_nonces where issued_at < now() - interval '3 days';
  delete from public.client_sessions where last_seen_at < now() - interval '120 days';
  delete from public.coin_ledger where at < now() - interval '120 days';
  delete from public.place_visits where at < now() - interval '120 days';
  delete from public.place_online_samples where at < now() - interval '120 days';
  delete from public.world_activity where day < current_date - 45;
  delete from public.minigame_logs where day < current_date - 45;
  delete from public.explore_claims where day < current_date - 400;
end $$;

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_world_progress(), public.record_activity(text), public.claim_explore(int), public.claim_badge(text), public.submit_minigame(text, int) from public, anon;
grant execute on function public.get_world_progress(), public.record_activity(text), public.claim_explore(int), public.claim_badge(text), public.submit_minigame(text, int) to authenticated;
