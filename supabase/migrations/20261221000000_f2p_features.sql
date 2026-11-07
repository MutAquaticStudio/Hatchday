-- Tính năng chơi miễn phí (F2P, chỉ xu kiếm được trong game): 5 mini-game mới, kỹ năng của bé, việc làm thêm, thi biểu diễn tuần,
-- lễ hội theo lịch, sổ sticker, Sổ mùa (miễn phí, theo tháng), sổ lưu bút, hẹn chơi, bé của bạn bè ghé chơi khi vắng.
-- Luật khớp src/game/f2p.ts và src/game/world-activity.ts (có test so khớp ở supabase/tests/f2p.test.ts).
-- Hàm viết lại (đối chiếu bản mới nhất ở 20261217000000_world_activity.sql): public.submit_minigame, public.get_world_progress.
-- Không hàm nào trả hay nhận tiền thật; mọi phần thưởng đi qua private.earn (sổ cái ghi nguồn theo tên RPC).

-- ---------- Mini-game mới ----------
alter table public.minigame_logs drop constraint minigame_logs_kind_check,
  add constraint minigame_logs_kind_check check (kind in ('butterfly', 'brew', 'fish', 'quiz', 'delivery', 'rhythm', 'bugs'));

insert into public.world_badges (id, kind, target, reward, sort) values
  ('fish20', 'fish', 20, 50, 13), ('quiz5', 'quiz', 5, 50, 14), ('delivery30', 'delivery', 30, 50, 15), ('rhythm5', 'rhythm', 5, 50, 16), ('bugs60', 'bugs', 60, 50, 17);

insert into public.balance_config (key, value, def, min, max, unit, label, grp, note) values
  ('mini.fish_coin',     2, 2, 0, 6,  'xu', 'Xu mỗi con cá câu được (tối đa 8 con)',        'Mini-game', ''),
  ('mini.quiz_coin',     3, 3, 0, 10, 'xu', 'Xu mỗi câu đố trả lời đúng (tối đa 5 câu)',      'Mini-game', ''),
  ('mini.delivery_coin', 2, 2, 0, 6,  'xu', 'Xu mỗi đơn giao đúng ở Chợ (tối đa 6 đơn)',      'Mini-game', ''),
  ('mini.rhythm_coin',   1, 1, 0, 3,  'xu', 'Xu mỗi nhịp nhảy trúng (tối đa 20 nhịp)',        'Mini-game', ''),
  ('mini.bugs_coin',     1, 1, 0, 3,  'xu', 'Xu mỗi con sâu bắt được ở Vườn (tối đa 15 con)', 'Mini-game', '');

create or replace function private.mini_max(k text) returns int language sql immutable set search_path = '' as $$
  select case k when 'butterfly' then 12 when 'brew' then 5 when 'fish' then 8 when 'quiz' then 5 when 'delivery' then 6 when 'rhythm' then 20 when 'bugs' then 15 end
$$;
create or replace function private.mini_skill(k text) returns text language sql immutable set search_path = '' as $$
  select case k when 'butterfly' then 'run' when 'brew' then 'craft' when 'fish' then 'craft' when 'quiz' then 'smart' when 'delivery' then 'run' when 'rhythm' then 'sing' when 'bugs' then 'run' end
$$;
-- Điểm cộng vào tổng cho huy hiệu (khớp miniTotalAdd): đếm số con/đơn, hoặc 1 khi "hoàn hảo".
create or replace function private.mini_total_add(k text, s int) returns int language sql immutable set search_path = '' as $$
  select case when k in ('brew', 'quiz') then (case when s = private.mini_max(k) then 1 else 0 end)
              when k = 'rhythm' then (case when s >= 16 then 1 else 0 end) else s end
$$;

-- ---------- Kỹ năng ----------
create table public.pet_skills (
  pet_id   uuid not null references public.pets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  skill    text not null check (skill in ('sing', 'run', 'craft', 'smart')),
  xp       int  not null default 0 check (xp >= 0),
  primary key (pet_id, skill)
);
alter table public.pet_skills enable row level security;
create policy "pet_skills: đọc của mình" on public.pet_skills for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function private.skill_level(xp int) returns int language sql immutable set search_path = '' as $$
  select least(10, floor(sqrt(greatest(coalesce(xp, 0), 0) / 5.0)))::int
$$;
create or replace function private.add_skill(uid uuid, sk text, n int) returns void
language plpgsql security definer set search_path = '' as $$
declare pid uuid := private.active_pet_id(uid);
begin
  if pid is null or n <= 0 then return; end if;
  insert into public.pet_skills (pet_id, owner_id, skill, xp) values (pid, uid, sk, n)
    on conflict (pet_id, skill) do update set xp = public.pet_skills.xp + n;
end $$;
create or replace function private.skill_of(uid uuid, sk text) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select xp from public.pet_skills where pet_id = private.active_pet_id(uid) and skill = sk), 0)
$$;
create or replace function private.skills_json(uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_agg(jsonb_build_object('skill', s.k, 'xp', private.skill_of(uid, s.k), 'level', private.skill_level(private.skill_of(uid, s.k))) order by s.o)
  from (values ('sing', 1), ('run', 2), ('craft', 3), ('smart', 4)) s(k, o)
$$;

-- ---------- Viết lại: get_world_progress (thêm 5 trò) ----------
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
    into mini from (values ('butterfly'), ('brew'), ('fish'), ('quiz'), ('delivery'), ('rhythm'), ('bugs')) v(k)
    left join public.minigame_logs m on m.owner_id = uid and m.day = d and m.kind = v.k;
  return jsonb_build_object('day', d, 'kinds', to_jsonb(ks), 'explore', tiers, 'badges', bad, 'mini', mini);
end $$;

-- ---------- Viết lại: submit_minigame (7 trò, cộng kỹ năng ở lượt có thưởng) ----------
create or replace function public.submit_minigame(p_kind text, p_score int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); d date; mx int; per int; lim int := coalesce(private.bal('mini.plays'), 2)::int; m public.minigame_logs; reward int := 0; rewarded boolean := false;
  before_n bigint; add_n int; newly text[] := '{}'; sk text; sxp int := 0;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_kind is null or p_kind not in ('butterfly', 'brew', 'fish', 'quiz', 'delivery', 'rhythm', 'bugs') then raise exception 'unknown_activity'; end if;
  mx := private.mini_max(p_kind);
  if p_score is null or p_score < 0 or p_score > mx then raise exception 'invalid_score'; end if;
  if private.active_pet_id(uid) is null then raise exception 'no_pet'; end if;
  d := private.local_day(uid);
  select * into m from public.minigame_logs where owner_id = uid and day = d and kind = p_kind for update;
  if m.owner_id is not null and m.last_at > now() - interval '20 seconds' then raise exception 'rate_limited'; end if;
  per := coalesce(private.bal('mini.' || p_kind || '_coin'), case p_kind when 'butterfly' then 1 when 'brew' then 3 when 'fish' then 2 when 'quiz' then 3 when 'delivery' then 2 else 1 end)::int;
  if coalesce(m.plays, 0) < lim then reward := p_score * per; rewarded := true; end if;
  insert into public.minigame_logs (owner_id, day, kind, plays, best, last_at) values (uid, d, p_kind, 1, p_score, now())
    on conflict (owner_id, day, kind) do update set plays = public.minigame_logs.plays + 1, best = greatest(public.minigame_logs.best, p_score), last_at = now()
    returning * into m;
  if reward > 0 then perform private.earn(uid, reward, false); end if;
  sk := private.mini_skill(p_kind);
  if rewarded then sxp := round(10.0 * p_score / mx)::int; perform private.add_skill(uid, sk, sxp); end if;
  add_n := private.mini_total_add(p_kind, p_score);
  before_n := private.activity_total(uid, p_kind);
  insert into public.world_activity (owner_id, day, kind, n) values (uid, d, p_kind, 1) on conflict (owner_id, day, kind) do update set n = public.world_activity.n + 1;
  if add_n > 0 then
    insert into public.world_totals (owner_id, kind, n) values (uid, p_kind, add_n) on conflict (owner_id, kind) do update set n = public.world_totals.n + add_n;
    newly := private.badges_crossed(uid, p_kind, before_n);
  end if;
  return jsonb_build_object('reward', reward, 'rewarded', rewarded, 'coins', (select coins from public.wallets where owner_id = uid), 'plays', m.plays,
    'left', greatest(0, lim - m.plays), 'best', m.best, 'newly', to_jsonb(newly), 'skill', sk, 'skill_xp', sxp);
end $$;

-- ---------- Việc làm thêm ----------
create table public.pet_jobs (
  owner_id   uuid primary key references auth.users (id) on delete cascade,
  pet_id     uuid not null references public.pets (id) on delete cascade,
  job        text not null check (job in ('tea', 'market', 'library', 'park')),
  hours      int  not null check (hours in (1, 3, 6)),
  started_at timestamptz not null default now(),
  ends_at    timestamptz not null
);
create table public.job_logs (
  id       bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  pet_id   uuid,
  job      text not null,
  hours    int  not null,
  pay      int  not null,
  day      date not null,
  done_at  timestamptz not null default now()
);
create index job_logs_owner_day on public.job_logs (owner_id, day);
alter table public.pet_jobs enable row level security;
alter table public.job_logs enable row level security;
create policy "pet_jobs: đọc của mình" on public.pet_jobs for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function private.job_skill(j text) returns text language sql immutable set search_path = '' as $$
  select case j when 'tea' then 'craft' when 'market' then 'smart' when 'library' then 'smart' when 'park' then 'run' end
$$;
create or replace function private.job_per_hour(j text) returns int language sql immutable set search_path = '' as $$
  select case j when 'tea' then 12 when 'market' then 12 when 'library' then 10 when 'park' then 10 end
$$;
-- Ca đã bắt đầu hôm nay (tính cả ca đang làm) — trần 2 ca/ngày.
create or replace function private.jobs_today(uid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.job_logs where owner_id = uid and day = private.local_day(uid))::int
       + (select count(*) from public.pet_jobs where owner_id = uid)::int
$$;

create or replace function public.get_job_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); j public.pet_jobs;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into j from public.pet_jobs where owner_id = uid;
  return jsonb_build_object('job', j.job, 'hours', coalesce(j.hours, 0), 'started_at', j.started_at, 'ends_at', j.ends_at,
    'done_today', private.jobs_today(uid), 'per_day', 2, 'skills', coalesce(private.skills_json(uid), '[]'::jsonb));
end $$;

create or replace function public.start_job(p_job text, p_hours int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.pets;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_job is null or p_job not in ('tea', 'market', 'library', 'park') then raise exception 'unknown_job'; end if;
  if p_hours is null or p_hours not in (1, 3, 6) then raise exception 'invalid_hours'; end if;
  select * into p from public.pets where id = private.active_pet_id(uid);
  if p.id is null then raise exception 'no_pet'; end if;
  if p.stage in ('egg', 'departed') then raise exception 'too_young'; end if;
  if p.asleep then raise exception 'asleep'; end if;
  if p.illness is not null then raise exception 'sick_blocked'; end if;
  if p.nl < 25 then raise exception 'too_tired'; end if;
  if exists (select 1 from public.pet_jobs where owner_id = uid) then raise exception 'job_busy'; end if;
  if private.jobs_today(uid) >= 2 then raise exception 'job_limit'; end if;
  insert into public.pet_jobs (owner_id, pet_id, job, hours, ends_at) values (uid, p.id, p_job, p_hours, now() + make_interval(hours => p_hours));
  return public.get_job_state();
end $$;

create or replace function public.finish_job() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); j public.pet_jobs; sk text; lv int; pay int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into j from public.pet_jobs where owner_id = uid for update;
  if j.owner_id is null then raise exception 'no_job'; end if;
  if j.ends_at > now() then raise exception 'job_not_done'; end if;
  sk := private.job_skill(j.job); lv := private.skill_level(private.skill_of(uid, sk));
  pay := round(private.job_per_hour(j.job) * j.hours * (1 + 0.05 * lv))::int;
  delete from public.pet_jobs where owner_id = uid;
  insert into public.job_logs (owner_id, pet_id, job, hours, pay, day) values (uid, j.pet_id, j.job, j.hours, pay, private.local_day(uid));
  perform private.earn(uid, pay, false);
  perform private.add_skill(uid, sk, 4 * j.hours);
  return jsonb_build_object('pay', pay, 'coins', (select coins from public.wallets where owner_id = uid), 'skill', sk, 'skill_xp', 4 * j.hours, 'job', j.job, 'hours', j.hours);
end $$;

create or replace function public.cancel_job() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  delete from public.pet_jobs where owner_id = uid;
  if not found then raise exception 'no_job'; end if;
  return public.get_job_state();
end $$;

-- ---------- Thi biểu diễn tuần ----------
create table public.contest_entries (
  week       date not null,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  pet_id     uuid,
  pet_name   text not null,
  score      int  not null,
  entered_at timestamptz not null default now(),
  claimed    boolean not null default false,
  primary key (week, owner_id)
);
create index contest_entries_rank on public.contest_entries (week, score desc, entered_at);
alter table public.contest_entries enable row level security;

create or replace function private.week_start(d date) returns date language sql immutable set search_path = '' as $$
  select d - (extract(isodow from d)::int - 1)
$$;
create or replace function private.contest_rank(w date, uid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.contest_entries o where o.week = w and (o.score > e.score or (o.score = e.score and o.entered_at < e.entered_at)))::int + 1
  from public.contest_entries e where e.week = w and e.owner_id = uid
$$;
create or replace function private.contest_reward(r int) returns int language sql immutable set search_path = '' as $$
  select case when r = 1 then 100 when r <= 3 then 60 when r <= 10 then 30 else 15 end
$$;

create or replace function public.get_contest() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); w date; lw date; e public.contest_entries; le public.contest_entries; lr int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  w := private.week_start(private.local_day(uid)); lw := w - 7;
  select * into e from public.contest_entries where week = w and owner_id = uid;
  select * into le from public.contest_entries where owner_id = uid and week < w order by week desc limit 1;
  if le.owner_id is not null then lr := private.contest_rank(le.week, uid); end if;
  return jsonb_build_object('week', w, 'entered', e.owner_id is not null, 'score', e.score, 'rank', case when e.owner_id is null then null else private.contest_rank(w, uid) end,
    'entries', (select count(*) from public.contest_entries where week = w),
    'top', coalesce((select jsonb_agg(jsonb_build_object('name', t.pet_name, 'score', t.score, 'mine', t.owner_id = uid) order by t.score desc, t.entered_at)
      from (select * from public.contest_entries where week = w order by score desc, entered_at limit 10) t), '[]'::jsonb),
    'last', case when le.owner_id is null then null else jsonb_build_object('week', le.week, 'rank', lr, 'reward', private.contest_reward(lr), 'claimed', le.claimed) end);
end $$;

create or replace function public.enter_contest() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); w date; p public.pets; lv int; sc int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into p from public.pets where id = private.active_pet_id(uid);
  if p.id is null then raise exception 'no_pet'; end if;
  if p.stage in ('egg', 'departed') then raise exception 'too_young'; end if;
  w := private.week_start(private.local_day(uid));
  if exists (select 1 from public.contest_entries where week = w and owner_id = uid) then raise exception 'already_entered'; end if;
  select coalesce(sum(private.skill_level(xp)), 0) into lv from public.pet_skills where pet_id = p.id;
  sc := lv * 10 + private.bond_level(p.bond_xp) * 5 + (abs(hashtext(uid::text || w::text)) % 20);
  insert into public.contest_entries (week, owner_id, pet_id, pet_name, score) values (w, uid, p.id, p.name, sc);
  return public.get_contest();
end $$;

create or replace function public.claim_contest() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); w date; le public.contest_entries; r int; rew int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  w := private.week_start(private.local_day(uid));
  select * into le from public.contest_entries where owner_id = uid and week < w order by week desc limit 1 for update;
  if le.owner_id is null then raise exception 'contest_not_entered'; end if;
  if le.claimed then raise exception 'already_claimed'; end if;
  r := private.contest_rank(le.week, uid); rew := private.contest_reward(r);
  update public.contest_entries set claimed = true where week = le.week and owner_id = uid;
  perform private.earn(uid, rew, false);
  return jsonb_build_object('rank', r, 'reward', rew, 'coins', (select coins from public.wallets where owner_id = uid));
end $$;

-- ---------- Lễ hội theo lịch ----------
create table public.festival_days (
  id       text not null check (id in ('tet', 'trungthu', 'thieunhi', 'halloween', 'noel', 'nammoi')),
  from_day date not null,
  to_day   date not null check (to_day >= from_day),
  primary key (id, from_day)
);
alter table public.festival_days enable row level security;
insert into public.festival_days (id, from_day, to_day)
select 'tet', t - 1, t + 3 from unnest(array['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03']::date[]) t
union all select 'trungthu', t - 3, t + 1 from unnest(array['2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12']::date[]) t
union all select 'thieunhi', make_date(y, 6, 1), make_date(y, 6, 2) from generate_series(2026, 2030) y
union all select 'halloween', make_date(y, 10, 30), make_date(y, 11, 1) from generate_series(2026, 2030) y
union all select 'noel', make_date(y, 12, 23), make_date(y, 12, 26) from generate_series(2026, 2030) y
union all select 'nammoi', make_date(y, 12, 31), make_date(y + 1, 1, 1) from generate_series(2026, 2030) y;

create table public.festival_claims (
  owner_id uuid not null references auth.users (id) on delete cascade,
  edition  text not null,
  festival text not null,
  day      date not null,
  primary key (owner_id, edition)
);
alter table public.festival_claims enable row level security;

create or replace function private.festival_on(d date) returns public.festival_days
language sql stable security definer set search_path = '' as $$
  select * from public.festival_days where d between from_day and to_day order by from_day limit 1
$$;

create or replace function public.get_festival() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); f public.festival_days; ed text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  f := private.festival_on(private.local_day(uid));
  if f.id is null then return jsonb_build_object('festival', null, 'claimed', false); end if;
  ed := f.id || ':' || extract(year from f.from_day)::int;
  return jsonb_build_object('festival', jsonb_build_object('id', f.id, 'edition', ed, 'from', f.from_day, 'to', f.to_day),
    'claimed', exists (select 1 from public.festival_claims where owner_id = uid and edition = ed));
end $$;

create or replace function public.claim_festival() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date; f public.festival_days; ed text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if private.active_pet_id(uid) is null then raise exception 'no_pet'; end if;
  d := private.local_day(uid); f := private.festival_on(d);
  if f.id is null then raise exception 'no_festival'; end if;
  ed := f.id || ':' || extract(year from f.from_day)::int;
  insert into public.festival_claims (owner_id, edition, festival, day) values (uid, ed, f.id, d) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  perform private.earn(uid, 50, false);
  return jsonb_build_object('reward', 50, 'festival', f.id, 'coins', (select coins from public.wallets where owner_id = uid));
end $$;

-- ---------- Hẹn chơi ----------
create table public.playdates (
  id         bigint generated always as identity primary key,
  from_id    uuid not null references auth.users (id) on delete cascade,
  to_id      uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'done')),
  day        date not null,
  created_at timestamptz not null default now(),
  done_at    timestamptz,
  check (from_id <> to_id)
);
create index playdates_to on public.playdates (to_id, status);
create index playdates_from on public.playdates (from_id, created_at);
alter table public.playdates enable row level security;

create or replace function public.invite_playdate(p_who text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid; d date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null then raise exception 'not_found'; end if;
  if not private.are_friends(uid, t) then raise exception 'not_friends'; end if;
  if private.is_blocked(uid, t) then raise exception 'blocked'; end if;
  if private.active_pet_id(uid) is null then raise exception 'no_pet'; end if;
  d := private.local_day(uid);
  if exists (select 1 from public.playdates where status = 'pending' and created_at > now() - interval '24 hours'
             and ((from_id = uid and to_id = t) or (from_id = t and to_id = uid))) then raise exception 'playdate_exists'; end if;
  if exists (select 1 from public.playdates where status = 'done' and done_at > now() - interval '20 hours'
             and ((from_id = uid and to_id = t) or (from_id = t and to_id = uid))) then raise exception 'playdate_done_today'; end if;
  if (select count(*) from public.playdates where from_id = uid and created_at > now() - interval '24 hours') >= 5 then raise exception 'rate_limited'; end if;
  insert into public.playdates (from_id, to_id, day) values (uid, t, d);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.respond_playdate(p_id bigint, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pd public.playdates; a_name text; b_name text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into pd from public.playdates where id = p_id and to_id = uid for update;
  if pd.id is null then raise exception 'not_found'; end if;
  if pd.status <> 'pending' then raise exception 'already_claimed'; end if;
  if pd.created_at < now() - interval '24 hours' then delete from public.playdates where id = p_id; raise exception 'playdate_expired'; end if;
  if not coalesce(p_accept, false) then delete from public.playdates where id = p_id; return jsonb_build_object('ok', true, 'accepted', false); end if;
  if private.active_pet_id(uid) is null then raise exception 'no_pet'; end if;
  update public.playdates set status = 'done', done_at = now() where id = p_id;
  select name into a_name from public.pets where id = private.active_pet_id(pd.from_id);
  select name into b_name from public.pets where id = private.active_pet_id(uid);
  update public.pets set bond_xp = bond_xp + 3 where id in (private.active_pet_id(pd.from_id), private.active_pet_id(uid));
  insert into public.memories (pet_id, owner_id, kind, body)
  select private.active_pet_id(x.u), x.u, 'play', left('Hẹn chơi với bé ' || coalesce(x.other, 'bạn') || ', vui ơi là vui!', 200)
  from (values (pd.from_id, b_name), (uid, a_name)) x(u, other) where private.active_pet_id(x.u) is not null;
  perform private.earn(pd.from_id, 15, false);
  perform private.earn(uid, 15, false);
  return jsonb_build_object('ok', true, 'accepted', true, 'reward', 15, 'coins', (select coins from public.wallets where owner_id = uid));
end $$;

create or replace function public.list_playdates() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', pd.id, 'from', fp.public_id, 'to', tp.public_id, 'from_name', fp.display_name, 'to_name', tp.display_name,
      'incoming', pd.to_id = uid, 'status', pd.status, 'at', coalesce(pd.done_at, pd.created_at)) order by coalesce(pd.done_at, pd.created_at) desc)
    from (select * from public.playdates where uid in (from_id, to_id) and coalesce(done_at, created_at) > now() - interval '3 days'
          and not (status = 'pending' and created_at < now() - interval '24 hours') order by coalesce(done_at, created_at) desc limit 20) pd
    join public.public_profiles fp on fp.user_id = pd.from_id join public.public_profiles tp on tp.user_id = pd.to_id), '[]'::jsonb);
end $$;

-- ---------- Lời nhắn bạn bè (sổ lưu bút viết chữ; bản biểu tượng cũ là leave_guestbook ở 20261205) ----------
create table public.guest_notes (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  author_id  uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 100),
  day        date not null,
  created_at timestamptz not null default now()
);
create index guest_notes_owner on public.guest_notes (owner_id, created_at desc);
create index guest_notes_author on public.guest_notes (author_id, created_at);
alter table public.guest_notes enable row level security;

create or replace function public.write_guest_note(p_who text, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid; f jsonb; d date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null then raise exception 'not_found'; end if;
  if t = uid then raise exception 'self_request'; end if;
  if not private.are_friends(uid, t) then raise exception 'not_friends'; end if;
  if private.is_blocked(uid, t) then raise exception 'blocked'; end if;
  if exists (select 1 from public.sanctions where user_id = uid and lifted_at is null and until > now() and kind in ('mute', 'ban')) then raise exception 'muted'; end if;
  f := private.chat_filter(p_body);
  if not (f ->> 'ok')::boolean then return jsonb_build_object('ok', false, 'reason', f ->> 'reason'); end if;
  d := private.local_day(uid);
  if exists (select 1 from public.guest_notes where owner_id = t and author_id = uid and created_at > now() - interval '20 hours') then raise exception 'already_signed_today'; end if;
  if (select count(*) from public.guest_notes where author_id = uid and created_at > now() - interval '24 hours') >= 10 then raise exception 'rate_limited'; end if;
  insert into public.guest_notes (owner_id, author_id, body, day) values (t, uid, f ->> 'text', d);
  return jsonb_build_object('ok', true, 'reason', null);
end $$;

create or replace function public.get_guest_notes() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'author', coalesce(pp.display_name, 'Bạn cũ'), 'body', g.body, 'at', g.created_at) order by g.created_at desc)
    from (select * from public.guest_notes where owner_id = uid order by created_at desc limit 30) g
    left join public.public_profiles pp on pp.user_id = g.author_id
    where not private.is_blocked(uid, g.author_id)), '[]'::jsonb);
end $$;

create or replace function public.delete_guest_note(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  delete from public.guest_notes where id = p_id and owner_id = uid;
  if not found then raise exception 'not_found'; end if;
end $$;

-- ---------- Bé của bạn bè ghé chơi (khi chủ vắng): tối đa 3 bé mỗi nơi, đổi theo ngày ----------
create or replace function public.get_visitors(p_place text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_place is null or p_place not in ('plaza', 'park', 'tea') then raise exception 'unknown_place'; end if;
  d := private.local_day(uid);
  return coalesce((select jsonb_agg(v.j) from (
    select private.profile_json(f.o) as j from (
      select case when a = uid then b else a end as o from public.friendships where status = 'accepted' and uid in (a, b)) f
    join public.public_profiles pp on pp.user_id = f.o
    where pp.stage is not null and pp.stage not in ('egg', 'departed') and not private.is_blocked(uid, f.o)
    order by md5(f.o::text || d::text || p_place) limit 3) v), '[]'::jsonb);
end $$;

-- ---------- Sổ sticker ----------
create table public.stickers (
  id     text primary key,
  kind   text not null check (kind in ('badge', 'skill', 'jobs', 'playdate', 'contest', 'contest_top', 'festival', 'season', 'guestbook')),
  ref    text not null default '',
  target int  not null check (target > 0),
  sort   int  not null
);
create table public.sticker_claims (
  owner_id uuid not null references auth.users (id) on delete cascade,
  sticker  text not null references public.stickers (id),
  at       timestamptz not null default now(),
  primary key (owner_id, sticker)
);
alter table public.stickers enable row level security;
alter table public.sticker_claims enable row level security;
insert into public.stickers (id, kind, ref, target, sort) values
  ('st-butterfly', 'badge', 'butterfly40', 1, 1), ('st-teapot', 'badge', 'brew5', 1, 2), ('st-fish', 'badge', 'fish20', 1, 3), ('st-book', 'badge', 'quiz5', 1, 4),
  ('st-box', 'badge', 'delivery30', 1, 5), ('st-disco', 'badge', 'rhythm5', 1, 6), ('st-ladybug', 'badge', 'bugs60', 1, 7), ('st-compass', 'badge', 'explore7', 1, 8),
  ('st-mic', 'skill', 'sing', 3, 9), ('st-shoe', 'skill', 'run', 3, 10), ('st-yarn', 'skill', 'craft', 3, 11), ('st-bulb', 'skill', 'smart', 3, 12), ('st-star', 'skill', 'any', 6, 13),
  ('st-apron', 'jobs', '', 1, 14), ('st-briefcase', 'jobs', '', 15, 15), ('st-balloon', 'playdate', '', 1, 16), ('st-hug', 'playdate', '', 10, 17),
  ('st-ticket', 'contest', '', 1, 18), ('st-trophy', 'contest_top', '', 1, 19), ('st-letter', 'guestbook', '', 5, 20), ('st-season', 'season', '', 5, 21), ('st-season10', 'season', '', 10, 22),
  ('st-tet', 'festival', 'tet', 1, 23), ('st-lantern', 'festival', 'trungthu', 1, 24), ('st-kid', 'festival', 'thieunhi', 1, 25), ('st-pumpkin', 'festival', 'halloween', 1, 26),
  ('st-tree', 'festival', 'noel', 1, 27), ('st-firework', 'festival', 'nammoi', 1, 28);

create or replace function private.sticker_progress(uid uuid, k text, r text) returns int
language plpgsql stable security definer set search_path = '' as $$
declare cw date;
begin
  if k = 'badge' then return (case when exists (select 1 from public.badge_claims where owner_id = uid and badge = r) then 1 else 0 end);
  elsif k = 'skill' then
    if r = 'any' then return coalesce((select max(private.skill_level(xp)) from public.pet_skills where pet_id = private.active_pet_id(uid)), 0); end if;
    return private.skill_level(private.skill_of(uid, r));
  elsif k = 'jobs' then return (select count(*) from public.job_logs where owner_id = uid)::int;
  elsif k = 'playdate' then return (select count(*) from public.playdates where status = 'done' and uid in (from_id, to_id))::int;
  elsif k = 'contest' then return (select count(*) from public.contest_entries where owner_id = uid)::int;
  elsif k = 'contest_top' then
    cw := private.week_start(private.local_day(uid));
    return (select count(*) from public.contest_entries e where e.owner_id = uid and e.week < cw and private.contest_rank(e.week, uid) <= 3)::int;
  elsif k = 'festival' then return (case when exists (select 1 from public.festival_claims where owner_id = uid and festival = r) then 1 else 0 end);
  elsif k = 'season' then return coalesce((select max(n) from (select count(*)::int as n from public.season_claims where owner_id = uid group by season) s), 0);
  elsif k = 'guestbook' then return (select count(*) from public.guest_notes where author_id = uid)::int;
  end if;
  return 0;
end $$;

create or replace function public.get_stickers() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'progress', least(private.sticker_progress(uid, s.kind, s.ref), s.target), 'target', s.target,
    'claimed', exists (select 1 from public.sticker_claims c where c.owner_id = uid and c.sticker = s.id)) order by s.sort) from public.stickers s), '[]'::jsonb);
end $$;

create or replace function public.claim_sticker(p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); s public.stickers;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into s from public.stickers where id = p_id;
  if s.id is null then raise exception 'unknown_sticker'; end if;
  if private.sticker_progress(uid, s.kind, s.ref) < s.target then raise exception 'quest_not_done'; end if;
  insert into public.sticker_claims (owner_id, sticker) values (uid, s.id) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  perform private.earn(uid, 10, false);
  return jsonb_build_object('reward', 10, 'coins', (select coins from public.wallets where owner_id = uid));
end $$;

-- ---------- Sổ mùa (miễn phí, mỗi tháng) ----------
create table public.season_tiers (
  tier  smallint primary key check (tier between 0 and 9),
  xp    int not null check (xp > 0),
  coins int not null check (coins >= 0)
);
create table public.season_claims (
  owner_id uuid not null references auth.users (id) on delete cascade,
  season   text not null check (season ~ '^\d{4}-\d{2}$'),
  tier     smallint not null references public.season_tiers (tier),
  at       timestamptz not null default now(),
  primary key (owner_id, season, tier)
);
alter table public.season_tiers enable row level security;
alter table public.season_claims enable row level security;
insert into public.season_tiers (tier, xp, coins) values
  (0, 50, 20), (1, 120, 25), (2, 200, 30), (3, 300, 35), (4, 420, 60), (5, 560, 40), (6, 720, 45), (7, 900, 50), (8, 1100, 60), (9, 1350, 120);

-- Điểm mùa (khớp SEASON_XP): mỗi hoạt động mỗi ngày tối đa 3 lần × 5; mỗi ca làm 25; hẹn chơi 20; dự thi 30; quà lễ 30.
create or replace function private.season_xp(uid uuid, s text) returns int
language sql stable security definer set search_path = '' as $$
  select (
    coalesce((select sum(least(n, 3) * 5) from public.world_activity where owner_id = uid and to_char(day, 'YYYY-MM') = s), 0)
  + coalesce((select sum(least(tl.n, 3) * 5) from public.toy_logs tl join public.pets p on p.id = tl.pet_id where p.owner_id = uid and to_char(tl.day, 'YYYY-MM') = s), 0)
  + 25 * (select count(*) from public.job_logs where owner_id = uid and to_char(day, 'YYYY-MM') = s)
  + 20 * (select count(*) from public.playdates where status = 'done' and uid in (from_id, to_id) and to_char(done_at at time zone 'UTC', 'YYYY-MM') = s)
  + 30 * (select count(*) from public.contest_entries where owner_id = uid and to_char(entered_at at time zone 'UTC', 'YYYY-MM') = s)
  + 30 * (select count(*) from public.festival_claims where owner_id = uid and to_char(day, 'YYYY-MM') = s)
  )::int
$$;

create or replace function public.get_season() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); s text; x int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  s := to_char(private.local_day(uid), 'YYYY-MM'); x := private.season_xp(uid, s);
  return jsonb_build_object('season', s, 'xp', x, 'tiers', (select jsonb_agg(jsonb_build_object('tier', t.tier, 'xp', t.xp, 'coins', t.coins,
    'claimed', exists (select 1 from public.season_claims c where c.owner_id = uid and c.season = s and c.tier = t.tier), 'ready', x >= t.xp) order by t.tier) from public.season_tiers t));
end $$;

create or replace function public.claim_season(p_tier int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); s text; t public.season_tiers;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into t from public.season_tiers where tier = p_tier;
  if t.tier is null then raise exception 'invalid_tier'; end if;
  s := to_char(private.local_day(uid), 'YYYY-MM');
  if private.season_xp(uid, s) < t.xp then raise exception 'quest_not_done'; end if;
  insert into public.season_claims (owner_id, season, tier) values (uid, s, t.tier) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  perform private.earn(uid, t.coins, false);
  return jsonb_build_object('reward', t.coins, 'coins', (select coins from public.wallets where owner_id = uid));
end $$;

-- ---------- Chỉ xu kiếm được: bỏ nguồn "trả phí" khỏi vật phẩm và quyền sở hữu ----------
update public.items set source = 'event' where source = 'paid';
alter table public.items drop constraint items_source_check,
  add constraint items_source_check check (source in ('starter', 'market', 'rotating', 'weekend', 'event', 'cook'));
update public.entitlements set source = 'gift' where source = 'purchase';
alter table public.entitlements drop constraint entitlements_source_check,
  add constraint entitlements_source_check check (source in ('starter', 'coins', 'gift', 'event'));

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_job_state(), public.start_job(text, int), public.finish_job(), public.cancel_job(),
  public.get_contest(), public.enter_contest(), public.claim_contest(), public.get_festival(), public.claim_festival(),
  public.invite_playdate(text), public.respond_playdate(bigint, boolean), public.list_playdates(),
  public.write_guest_note(text, text), public.get_guest_notes(), public.delete_guest_note(bigint), public.get_visitors(text),
  public.get_stickers(), public.claim_sticker(text), public.get_season(), public.claim_season(int),
  public.get_world_progress(), public.submit_minigame(text, int) from public, anon;
grant execute on function public.get_job_state(), public.start_job(text, int), public.finish_job(), public.cancel_job(),
  public.get_contest(), public.enter_contest(), public.claim_contest(), public.get_festival(), public.claim_festival(),
  public.invite_playdate(text), public.respond_playdate(bigint, boolean), public.list_playdates(),
  public.write_guest_note(text, text), public.get_guest_notes(), public.delete_guest_note(bigint), public.get_visitors(text),
  public.get_stickers(), public.claim_sticker(text), public.get_season(), public.claim_season(int),
  public.get_world_progress(), public.submit_minigame(text, int) to authenticated;
