-- Đấu trường giao hữu: đá nâng cấp, thành tích, xếp hạng, phần thưởng.
-- Trận đánh tính ở máy người chơi (luật trong src/game/battle.ts) vì chỉ là đấu với quái thú do máy điều khiển:
-- máy chủ chọn đối thủ, sân và hạt giống, giới hạn số trận có thưởng mỗi ngày, chặn trận ngắn bất thường và bỏ giữa chừng.
-- Phần thưởng nhỏ và có trần nên gian lận kết quả cũng không làm lệch kinh tế. Thua không mất gì ngoài điểm xếp hạng.
-- Chống lách (soát kinh tế, đợt agency):
-- - Lượt có thưởng bị trừ ngay khi VÀO trận (đấu tập, xếp hạng), nên bỏ trận để chọn lại đối thủ dễ cũng mất lượt.
-- - Thách đấu bạn bè không có thưởng (người chơi tự chọn đối thủ).
-- - Xếp hạng không tính đá nâng cấp của cả hai bên (công bằng giữa nền tảng có/không có quảng cáo thưởng).
-- - Điểm xếp hạng cộng tối đa arena.rating_day_cap mỗi ngày; bên phòng thủ mất/được một nửa điểm (Elo hai phía).
-- - Ghép trận theo điểm, cấp Gắn bó và tuổi; bé mới (đời sau) thì điểm kéo về gần 1000 một nửa.
-- - Máy không chọn loài khắc mạnh hệ của người chơi.
-- Còn lại (chưa làm): máy chủ chạy lại trận từ hạt giống + chuỗi chiêu để xác minh kết quả xếp hạng (Worker chạy battle.ts).
-- Thứ tự hệ: 0 Mộc, 1 Thuỷ, 2 Phong, 3 Dạ, 4 Hoả (khớp src/game/skills.ts).

-- ---------- Bảng ----------
create table public.pet_upgrades (
  pet_id     uuid primary key references public.pets (id) on delete cascade,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  hp         smallint not null default 0 check (hp between 0 and 5),
  atk        smallint not null default 0 check (atk between 0 and 5),
  def        smallint not null default 0 check (def between 0 and 5),
  spd        smallint not null default 0 check (spd between 0 and 5),
  updated_at timestamptz not null default now()
);
create index pet_upgrades_owner on public.pet_upgrades (owner_id);

create table public.arena_stats (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  rating       int  not null default 1000 check (rating >= 0),
  ranked       int  not null default 0,
  wins         int  not null default 0,
  losses       int  not null default 0,
  draws        int  not null default 0,
  streak       int  not null default 0,
  best_streak  int  not null default 0,
  def_wins     int  not null default 0,
  def_losses   int  not null default 0,
  day          date,
  day_rewards  int  not null default 0,
  day_won      boolean not null default false,
  day_rating   int  not null default 0,
  pet_id       uuid,
  updated_at   timestamptz not null default now()
);
create index arena_stats_rating on public.arena_stats (rating desc) where ranked > 0;

create table public.arena_battles (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  mode         text not null check (mode in ('practice', 'ranked', 'friend')),
  opp_user     uuid references auth.users (id) on delete set null,
  opp          jsonb not null,
  field        smallint not null check (field between 0 and 4),
  seed         int not null,
  status       text not null default 'pending' check (status in ('pending', 'done', 'abandoned')),
  result       text check (result in ('win', 'loss', 'draw', 'forfeit')),
  turns        int,
  reward       int not null default 0,
  rewarded     boolean not null default false,
  rating_delta int not null default 0,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index arena_battles_user on public.arena_battles (user_id, started_at desc);
create unique index arena_battles_one_pending on public.arena_battles (user_id) where status = 'pending';

alter table public.pet_upgrades enable row level security;
alter table public.arena_stats enable row level security;
alter table public.arena_battles enable row level security;
revoke all on public.pet_upgrades, public.arena_stats, public.arena_battles from anon, authenticated;

-- ---------- Cân bằng (admin chỉnh ở tab Cân bằng) ----------
insert into public.balance_config (key, value, def, min, max, unit, label, grp, note) values
  ('arena.reward_win',   20, 20, 0, 100, 'xu',  'Thưởng mỗi trận thắng',         'Đấu trường', 'Chỉ tính trong số trận có thưởng mỗi ngày.'),
  ('arena.reward_loss',   5,  5, 0,  50, 'xu',  'Thưởng mỗi trận thua',          'Đấu trường', 'Hoà nhận trung bình của thắng và thua.'),
  ('arena.first_win',    30, 30, 0, 200, 'xu',  'Thưởng thêm trận thắng đầu ngày', 'Đấu trường', ''),
  ('arena.per_day',       5,  5, 0,  20, 'trận', 'Số trận có thưởng mỗi ngày',   'Đấu trường', '0 = đấu không có thưởng.'),
  ('arena.min_seconds',  10, 10, 0, 120, 'giây', 'Trận ngắn nhất được tính',      'Đấu trường', 'Ngắn hơn thì từ chối kết quả (chống gian lận).'),
  ('arena.rating_day_cap', 60, 60, 0, 500, 'điểm', 'Điểm xếp hạng cộng tối đa mỗi ngày', 'Đấu trường', 'Chặn cày điểm; trừ điểm không bị giới hạn.')
on conflict (key) do nothing;

-- ---------- Hàm phụ ----------
/** Giá bậc tiếp theo của đá nâng cấp (bậc hiện tại 0..4). Khớp UPGRADE_COST trong src/game/battle.ts. */
create or replace function private.upgrade_cost(lvl int) returns int
language sql immutable set search_path = '' as $$ select (array[100, 200, 350, 550, 800])[lvl + 1] $$;

create or replace function private.arena_stats_row(uid uuid) returns public.arena_stats
language plpgsql security definer set search_path = '' as $$
declare s public.arena_stats; d date := private.local_day(uid);
begin
  insert into public.arena_stats (user_id) values (uid) on conflict (user_id) do nothing;
  select * into s from public.arena_stats where user_id = uid for update;
  if s.day is distinct from d then update public.arena_stats set day = d, day_rewards = 0, day_won = false, day_rating = 0 where user_id = uid returning * into s; end if;
  return s;
end $$;

/** Bé hiện tại đủ tuổi đấu (từ Nhí). */
create or replace function private.arena_pet(uid uuid) returns public.pets
language sql stable security definer set search_path = '' as $$
  select * from public.pets where owner_id = uid and stage in ('child', 'teen', 'adult', 'elder') limit 1
$$;

create or replace function private.upgrades_json(pid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('hp', hp, 'atk', atk, 'def', def, 'spd', spd) from public.pet_upgrades where pet_id = pid), '{"hp":0,"atk":0,"def":0,"spd":0}'::jsonb)
$$;

/** Ảnh chụp quái thú của một người chơi để làm đối thủ (máy điều khiển). */
create or replace function private.arena_snapshot(u uuid, with_upgrades boolean default true) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('kind', 'player', 'pid', pp.public_id, 'name', p.name, 'family', p.family_name, 'species', p.species,
    'stage', case when p.stage = 'elder' then 'adult' else p.stage end, 'form', p.form, 'bond', private.bond_level(p.bond_xp),
    'upgrades', case when with_upgrades then private.upgrades_json(p.id) else '{"hp":0,"atk":0,"def":0,"spd":0}'::jsonb end, 'rating', coalesce((select rating from public.arena_stats where user_id = u), 1000))
  from public.pets p join public.public_profiles pp on pp.user_id = p.owner_id
  where p.owner_id = u and p.stage in ('child', 'teen', 'adult', 'elder') limit 1
$$;

/** Ghi kết quả một trận (dùng chung cho kết thúc bình thường và bỏ giữa chừng). */
create or replace function private.arena_settle(b public.arena_battles, res text, p_turns int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.arena_stats := private.arena_stats_row(b.user_id); reward int := 0; first boolean := false; delta int := 0; got int := 0;
  per_day int := coalesce(private.bal('arena.per_day'), 5)::int; rw int := coalesce(private.bal('arena.reward_win'), 20)::int; rl int := coalesce(private.bal('arena.reward_loss'), 5)::int;
  cap int := coalesce(private.bal('arena.rating_day_cap'), 60)::int; r_opp int; expct numeric; score numeric;
begin
  if res <> 'forfeit' and b.rewarded then -- lượt thưởng đã trừ lúc vào trận
    reward := case res when 'win' then rw when 'draw' then (rw + rl) / 2 else rl end;
    if res = 'win' and not s.day_won then reward := reward + coalesce(private.bal('arena.first_win'), 30)::int; first := true; end if;
  end if;
  if reward > 0 then got := private.earn(b.user_id, reward, false); end if;
  if b.mode = 'ranked' then
    r_opp := coalesce((b.opp->>'rating')::int, 1000);
    expct := 1 / (1 + power(10::numeric, (r_opp - s.rating) / 400.0));
    score := case res when 'win' then 1 when 'draw' then 0.5 else 0 end;
    delta := round(32 * (score - expct))::int;
    if delta > 0 then delta := least(delta, greatest(0, cap - s.day_rating)); end if;
  end if;
  update public.arena_stats set
    rating = greatest(0, rating + delta), ranked = ranked + (b.mode = 'ranked')::int,
    wins = wins + (res = 'win')::int, losses = losses + (res in ('loss', 'forfeit'))::int, draws = draws + (res = 'draw')::int,
    streak = case when res = 'win' then streak + 1 else 0 end, best_streak = greatest(best_streak, case when res = 'win' then streak + 1 else 0 end),
    day_rating = day_rating + greatest(delta, 0), day_won = day_won or res = 'win', updated_at = now()
  where user_id = b.user_id returning * into s;
  -- quái thú của người kia "phòng thủ": thắng khi người thách đấu thua
  if b.opp_user is not null then
    perform private.arena_stats_row(b.opp_user);
    update public.arena_stats set def_wins = def_wins + (res in ('loss', 'forfeit'))::int, def_losses = def_losses + (res = 'win')::int,
      rating = greatest(0, rating - case when b.mode = 'ranked' then round(delta / 2.0)::int else 0 end) where user_id = b.opp_user;
  end if;
  update public.arena_battles set status = case when res = 'forfeit' and p_turns is null then 'abandoned' else 'done' end, result = res, turns = p_turns, reward = got,
    rating_delta = delta, finished_at = now() where id = b.id;
  return jsonb_build_object('result', res, 'reward', got, 'first_win', first, 'rating', s.rating, 'rating_delta', delta,
    'rewards_left', greatest(0, per_day - s.day_rewards), 'coins', (select coins from public.wallets where owner_id = b.user_id));
end $$;

-- ---------- RPC ----------
create or replace function public.get_arena_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); s public.arena_stats; p public.pets; per_day int := coalesce(private.bal('arena.per_day'), 5)::int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  s := private.arena_stats_row(uid);
  select * into p from public.pets where owner_id = uid and stage <> 'departed' limit 1;
  return jsonb_build_object(
    'upgrades', case when p.id is null then null else private.upgrades_json(p.id) end,
    'costs', jsonb_build_array(100, 200, 350, 550, 800),
    'stats', jsonb_build_object('rating', s.rating, 'ranked', s.ranked, 'wins', s.wins, 'losses', s.losses, 'draws', s.draws, 'streak', s.streak, 'best_streak', s.best_streak, 'def_wins', s.def_wins, 'def_losses', s.def_losses),
    'rewards_left', greatest(0, per_day - s.day_rewards), 'first_win_open', not s.day_won,
    'reward', jsonb_build_object('win', coalesce(private.bal('arena.reward_win'), 20), 'loss', coalesce(private.bal('arena.reward_loss'), 5), 'first_win', coalesce(private.bal('arena.first_win'), 30)),
    'rank', case when s.ranked > 0 then (select count(*) + 1 from public.arena_stats o where o.ranked > 0 and o.rating > s.rating) end,
    'top', coalesce((select jsonb_agg(t order by t.rating desc) from (
        select pp.display_name as name, pp.species, a.rating, a.wins, a.user_id = uid as me from public.arena_stats a join public.public_profiles pp on pp.user_id = a.user_id
        where a.ranked > 0 order by a.rating desc, a.updated_at limit 10) t), '[]'::jsonb));
end $$;

create or replace function public.buy_upgrade(p_stat text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.pets; lvl int; cost int; w public.wallets;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_stat is null or p_stat not in ('hp', 'atk', 'def', 'spd') then raise exception 'invalid_stat'; end if;
  select * into p from public.pets where owner_id = uid and stage not in ('egg', 'departed') limit 1;
  if p.id is null then raise exception 'no_pet'; end if;
  insert into public.pet_upgrades (pet_id, owner_id) values (p.id, uid) on conflict (pet_id) do nothing;
  execute format('select %I from public.pet_upgrades where pet_id = $1 for update', p_stat) into lvl using p.id;
  if lvl >= 5 then raise exception 'upgrade_max'; end if;
  cost := private.upgrade_cost(lvl);
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.coins < cost then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - cost where owner_id = uid;
  execute format('update public.pet_upgrades set %I = %I + 1, updated_at = now() where pet_id = $1', p_stat, p_stat) using p.id;
  return jsonb_build_object('upgrades', private.upgrades_json(p.id), 'coins', w.coins - cost, 'cost', cost);
end $$;

create or replace function public.arena_start(p_mode text, p_who text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); me public.pets; s public.arena_stats; old public.arena_battles; opp jsonb; ou uuid; b public.arena_battles; sp text; st text; bond int;
  my_el int; rewarded boolean := false; per_day int := coalesce(private.bal('arena.per_day'), 5)::int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_mode is null or p_mode not in ('practice', 'ranked', 'friend') then raise exception 'invalid_mode'; end if;
  me := private.arena_pet(uid);
  if me.id is null then raise exception 'arena_too_young'; end if;
  s := private.arena_stats_row(uid);
  -- trận cũ còn dở (tắt máy, thoát giữa chừng): xếp hạng thì tính là thua, chế độ khác chỉ đóng lại
  select * into old from public.arena_battles where user_id = uid and status = 'pending';
  if old.id is not null then
    if old.mode = 'ranked' then perform private.arena_settle(old, 'forfeit', null);
    else update public.arena_battles set status = 'abandoned', finished_at = now() where id = old.id; end if;
  end if;
  st := case when me.stage = 'elder' then 'adult' else me.stage end; bond := private.bond_level(me.bond_xp);
  select region into my_el from public.species where id = me.species;
  -- bé mới (đời sau): điểm xếp hạng kéo về gần 1000 một nửa, vì sức đấu bắt đầu lại từ đầu
  if s.pet_id is distinct from me.id then
    update public.arena_stats set rating = case when pet_id is null then rating else 1000 + (rating - 1000) / 2 end, pet_id = me.id where user_id = uid returning * into s;
  end if;
  if p_mode = 'friend' then
    ou := private.resolve_who(p_who);
    if ou is null or not private.are_friends(uid, ou) or private.is_blocked(uid, ou) then raise exception 'not_friends'; end if;
    opp := private.arena_snapshot(ou, true);
    if opp is null then raise exception 'arena_no_opponent'; end if;
  elsif p_mode = 'ranked' then
    select a.u into ou from (
      -- gần điểm, gần cấp Gắn bó, cùng tuổi (mỗi cấp Gắn bó lệch ~ 80 điểm, khác tuổi ~ 300 điểm)
      select p.owner_id as u, abs(coalesce(x.rating, 1000) - s.rating) + 80 * abs(private.bond_level(p.bond_xp) - bond)
        + 300 * (case when p.stage = 'elder' then 'adult' else p.stage end <> st)::int + random() * 100 as k from public.pets p
      left join public.arena_stats x on x.user_id = p.owner_id
      where p.owner_id <> uid and p.stage in ('child', 'teen', 'adult', 'elder') and not private.is_blocked(uid, p.owner_id)
      order by 2 limit 1) a;
    if ou is not null then opp := private.arena_snapshot(ou, false); end if;
  end if;
  if opp is null then -- máy: loài ngẫu nhiên khác loài của mình, không khắc mạnh hệ mình, cùng tuổi, Gắn bó xê xích một bậc
    -- khắc mạnh (STRONG trong src/game/skills.ts): 0→2, 1→4, 2→3, 3→1, 4→0
    select id into sp from public.species where id <> me.species and (array[2, 4, 3, 1, 0])[region + 1] <> my_el order by random() limit 1;
    opp := jsonb_build_object('kind', 'bot', 'species', sp, 'stage', st, 'form', case when st = 'adult' then (array['tron', 'nhanh', 'thuong', 'sang'])[1 + floor(random() * 4)::int] end,
      'bond', greatest(1, least(10, bond + floor(random() * 3)::int - 1)), 'upgrades', '{"hp":0,"atk":0,"def":0,"spd":0}'::jsonb, 'rating', 1000);
  end if;
  -- lượt có thưởng trừ ngay khi vào trận (bỏ trận để chọn lại đối thủ cũng mất lượt); thách bạn bè không có thưởng
  if p_mode <> 'friend' and s.day_rewards < per_day then
    rewarded := true; update public.arena_stats set day_rewards = day_rewards + 1 where user_id = uid;
  end if;
  insert into public.arena_battles (user_id, mode, opp_user, opp, field, seed, rewarded)
  values (uid, p_mode, ou, opp, floor(random() * 5)::int, floor(random() * 2147483647)::int, rewarded) returning * into b;
  return jsonb_build_object('id', b.id, 'mode', b.mode, 'field', b.field, 'seed', b.seed, 'opp', b.opp, 'rewarded', rewarded,
    'upgrades', case when p_mode = 'ranked' then '{"hp":0,"atk":0,"def":0,"spd":0}'::jsonb else private.upgrades_json(me.id) end);
end $$;

create or replace function public.arena_finish(p_id bigint, p_result text, p_turns int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); b public.arena_battles;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_result is null or p_result not in ('win', 'loss', 'draw', 'forfeit') then raise exception 'invalid_result'; end if;
  select * into b from public.arena_battles where id = p_id and user_id = uid for update;
  if b.id is null or b.status <> 'pending' then raise exception 'arena_not_pending'; end if;
  if p_result <> 'forfeit' and now() - b.started_at < make_interval(secs => coalesce(private.bal('arena.min_seconds'), 10)) then raise exception 'arena_too_fast'; end if;
  if p_result <> 'forfeit' and (p_turns is null or p_turns < 1 or p_turns > 31) then raise exception 'invalid_result'; end if;
  return private.arena_settle(b, p_result, coalesce(p_turns, 0));
end $$;

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_arena_state(), public.buy_upgrade(text), public.arena_start(text, text), public.arena_finish(bigint, text, int) from public, anon;
grant execute on function public.get_arena_state(), public.buy_upgrade(text), public.arena_start(text, text), public.arena_finish(bigint, text, int) to authenticated;
