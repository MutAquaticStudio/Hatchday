-- =====================================================================
-- Hatchday — Hook sự kiện (giảm giá, mục tiêu cộng đồng, Mùa cúm lây) và Đồ chơi mới (giai đoạn C+D)
-- Một migration duy nhất cho mọi hàm bị viết lại (đã đối chiếu với bản mới nhất của từng hàm):
--   private.validate_event_config (từ 20261210000000_event_hooks.sql; thêm shop_discount, epidemic, goal),
--   public.buy_item (20261105000000_decor_cosmetics.sql), public.buy_food (20261114000000_food_economy.sql),
--   public.buy_medicine (20261121000000_illness.sql): giá sau giảm giá sự kiện, trả thêm 'paid',
--   private.health_step, private.health_on_action (20261121000000_illness.sql): tính cả đồ chơi; Mùa cúm hạ ngưỡng cảm lạnh,
--   private.personality_on_action (20261113000000_personality.sql): trôi cá tính theo đồ chơi,
--   public.place_heartbeat (20261208000000_places_realtime.sql): thêm lây cúm ở nơi chung, trả thêm 'infected'.
-- Luật ở hai nơi: src/game/events.ts (giảm giá, mục tiêu), src/game/toys.ts (đồ chơi). Test: supabase/tests/hooks-toys.test.ts.
-- =====================================================================

-- ---------- Cấu hình sự kiện ----------
create or replace function private.validate_event_config(cfg jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare k text; g jsonb;
begin
  if jsonb_typeof(cfg) is distinct from 'object' then raise exception 'invalid_event_config'; end if;
  for k in select jsonb_object_keys(cfg) loop
    if k not in ('banner', 'plaza_decor', 'coin_boost', 'shop_discount', 'epidemic', 'goal') then raise exception 'invalid_event_config'; end if;
  end loop;
  if cfg ? 'banner' and (jsonb_typeof(cfg -> 'banner') <> 'string' or char_length(cfg ->> 'banner') > 120) then raise exception 'invalid_event_config'; end if;
  if cfg ? 'plaza_decor' and (cfg ->> 'plaza_decor') not in ('tet', 'trung-thu', 'giang-sinh', 'he') then raise exception 'invalid_event_config'; end if;
  if cfg ? 'coin_boost' and (jsonb_typeof(cfg -> 'coin_boost') <> 'number' or (cfg ->> 'coin_boost')::numeric < 1 or (cfg ->> 'coin_boost')::numeric > 3) then raise exception 'invalid_event_config'; end if;
  if cfg ? 'epidemic' and jsonb_typeof(cfg -> 'epidemic') <> 'boolean' then raise exception 'invalid_event_config'; end if;
  if cfg ? 'shop_discount' then
    g := cfg -> 'shop_discount';
    if jsonb_typeof(g) <> 'object' or jsonb_typeof(g -> 'pct') <> 'number' or (g ->> 'pct')::numeric not between 5 and 50 or (g ->> 'pct')::numeric <> floor((g ->> 'pct')::numeric)
       or (g ->> 'scope') not in ('food', 'medicine', 'decor', 'outfit', 'toy', 'all') then raise exception 'invalid_event_config'; end if;
  end if;
  if cfg ? 'goal' then
    g := cfg -> 'goal';
    if jsonb_typeof(g) <> 'object' or (g ->> 'metric') not in ('feed', 'play', 'pet', 'bath', 'talk')
       or jsonb_typeof(g -> 'target') <> 'number' or (g ->> 'target')::numeric not between 10 and 1000000 or (g ->> 'target')::numeric <> floor((g ->> 'target')::numeric)
       or jsonb_typeof(g -> 'reward_coins') <> 'number' or (g ->> 'reward_coins')::numeric not between 0 and 500 or (g ->> 'reward_coins')::numeric <> floor((g ->> 'reward_coins')::numeric)
    then raise exception 'invalid_event_config'; end if;
  end if;
end $$;

create or replace function private.epidemic_on() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events where enabled and starts_at <= now() and ends_at > now() and config ? 'epidemic' and (config ->> 'epidemic')::boolean)
$$;

-- Giảm giá lớn nhất đang chạy cho loại hàng (food | medicine | decor | outfit | toy), 0 nếu không có.
create or replace function private.event_discount(k text) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(max((config -> 'shop_discount' ->> 'pct')::int), 0) from public.events
  where enabled and starts_at <= now() and ends_at > now() and config ? 'shop_discount' and (config -> 'shop_discount' ->> 'scope') in ('all', k)
$$;
-- Giá sau giảm, làm tròn lên, tối thiểu 1 xu (giống discountedPrice trong events.ts).
create or replace function private.discounted(k text, price int) returns int
language sql stable set search_path = '' as $$ select greatest(1, ceil(price * (100 - private.event_discount(k)) / 100.0))::int $$;

create or replace function public.buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); it public.items; d date; w public.wallets; q int; price int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into it from public.items where id = p_item and active and kind in ('decor', 'outfit');
  if it.id is null then raise exception 'unknown_item'; end if;
  d := private.local_day(uid);
  if it.price_coins is null
     or (it.source = 'rotating' and not it.id = any (private.rotation(d)))
     or (it.source = 'weekend' and not private.is_weekend(d))
     or it.source not in ('market', 'rotating', 'weekend') then
    raise exception 'not_for_sale';
  end if;
  if (it.kind = 'outfit' or it.layer in ('wallpaper', 'flooring')) and private.owns(uid, it.id) then raise exception 'already_owned'; end if;
  price := private.discounted(it.kind, it.price_coins);
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.coins < price then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - price where owner_id = uid returning * into w;
  insert into public.entitlements (owner_id, item_id, source, qty) values (uid, it.id, 'coins', 1)
  on conflict (owner_id, item_id) do update set qty = public.entitlements.qty + 1
  returning qty into q;
  return jsonb_build_object('coins', w.coins, 'qty', q, 'paid', price);
end $$;

create or replace function public.buy_food(p_item text, p_qty int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); it public.items; w public.wallets; cur int; q int; total int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into it from public.items where id = p_item and active and kind = 'food';
  if it.id is null then raise exception 'unknown_item'; end if;
  if p_qty is null or p_qty not between 1 and 10 then raise exception 'invalid_qty'; end if;
  cur := coalesce((select qty from public.entitlements where owner_id = uid and item_id = it.id), 0);
  if cur + p_qty > 30 then raise exception 'stock_full'; end if;
  total := private.discounted('food', it.price_coins) * p_qty;
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.coins < total then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - total where owner_id = uid returning * into w;
  insert into public.entitlements (owner_id, item_id, source, qty) values (uid, it.id, 'coins', p_qty)
  on conflict (owner_id, item_id) do update set qty = public.entitlements.qty + p_qty
  returning qty into q;
  return jsonb_build_object('coins', w.coins, 'qty', q, 'paid', total);
end $$;

create or replace function public.buy_medicine(p_item text, p_qty int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); it public.items; w public.wallets; cur int; q int; total int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into it from public.items where id = p_item and active and kind = 'medicine';
  if it.id is null then raise exception 'unknown_item'; end if;
  if p_qty is null or p_qty not between 1 and 10 then raise exception 'invalid_qty'; end if;
  cur := coalesce((select qty from public.entitlements where owner_id = uid and item_id = it.id), 0);
  if cur + p_qty > 10 then raise exception 'stock_full'; end if;
  total := private.discounted('medicine', it.price_coins) * p_qty;
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.coins < total then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - total where owner_id = uid returning * into w;
  insert into public.entitlements (owner_id, item_id, source, qty) values (uid, it.id, 'coins', p_qty)
  on conflict (owner_id, item_id) do update set qty = public.entitlements.qty + p_qty
  returning qty into q;
  return jsonb_build_object('coins', w.coins, 'qty', q, 'paid', total);
end $$;

-- ---------- Mục tiêu cộng đồng ----------
create table public.event_goal (
  event_id   bigint primary key references public.events (id) on delete cascade,
  count      bigint not null default 0,
  reached_at timestamptz
);
create table public.event_goal_contrib (
  event_id   bigint not null references public.events (id) on delete cascade,
  user_id    uuid   not null references auth.users (id) on delete cascade,
  count      int    not null default 0,
  claimed_at timestamptz,
  primary key (event_id, user_id)
);
alter table public.event_goal enable row level security;
alter table public.event_goal_contrib enable row level security;

create or replace function private.goal_metric(act text) returns text
language sql immutable set search_path = '' as $$
  select case when act = 'feed' then 'feed' when act in ('play_ball', 'play_spin', 'play_toy') then 'play' when act = 'pet' then 'pet'
              when act = 'bath_rinse' then 'bath' when act = 'talk' then 'talk' end
$$;

create or replace function private.goal_on_action() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m text := private.goal_metric(new.action); e record; uid uuid; c bigint;
begin
  if m is null then return null; end if;
  select owner_id into uid from public.pets where id = new.pet_id;
  for e in select id, (config -> 'goal' ->> 'target')::bigint as target from public.events
           where enabled and starts_at <= now() and ends_at > now() and config ? 'goal' and (config -> 'goal' ->> 'metric') = m loop
    insert into public.event_goal_contrib (event_id, user_id, count) values (e.id, uid, 1)
      on conflict (event_id, user_id) do update set count = public.event_goal_contrib.count + 1;
    insert into public.event_goal (event_id, count) values (e.id, 1)
      on conflict (event_id) do update set count = public.event_goal.count + 1 returning count into c;
    if c >= e.target then update public.event_goal set reached_at = coalesce(reached_at, now()) where event_id = e.id; end if;
  end loop;
  return null;
end $$;
create trigger action_log_goal after insert on public.action_log for each row execute function private.goal_on_action();

-- Mục tiêu đang chạy (và 3 ngày sau khi kết thúc để nhận thưởng).
create or replace function public.get_event_goal() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('event_id', e.id, 'title', e.title, 'metric', e.config -> 'goal' ->> 'metric', 'target', (e.config -> 'goal' ->> 'target')::bigint,
      'reward_coins', (e.config -> 'goal' ->> 'reward_coins')::int, 'count', coalesce(g.count, 0), 'mine', coalesce(c.count, 0), 'reached', g.reached_at is not null,
      'claimed', c.claimed_at is not null, 'active', e.ends_at > now(), 'min_mine', 5) order by e.starts_at)
    from public.events e left join public.event_goal g on g.event_id = e.id left join public.event_goal_contrib c on c.event_id = e.id and c.user_id = uid
    where e.enabled and e.config ? 'goal' and e.starts_at <= now() and e.ends_at + interval '3 days' > now()), '[]'::jsonb);
end $$;

create or replace function public.claim_event_goal(p_event bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); e public.events; g public.event_goal; c public.event_goal_contrib; reward int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into e from public.events where id = p_event and enabled and config ? 'goal' and starts_at <= now() and ends_at + interval '3 days' > now();
  if e.id is null then raise exception 'goal_not_found'; end if;
  select * into g from public.event_goal where event_id = e.id;
  if g.reached_at is null then raise exception 'goal_not_reached'; end if;
  select * into c from public.event_goal_contrib where event_id = e.id and user_id = uid for update;
  if c.user_id is null or c.count < 5 then raise exception 'goal_not_contributed'; end if;
  if c.claimed_at is not null then raise exception 'already_claimed'; end if;
  update public.event_goal_contrib set claimed_at = now() where event_id = e.id and user_id = uid;
  reward := (e.config -> 'goal' ->> 'reward_coins')::int;
  if reward > 0 then perform private.earn(uid, reward, false); end if;
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'reward', reward);
end $$;

-- ---------- Mùa cúm: cách ly, tiếp xúc, lây ----------
create table public.pet_isolation (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active  boolean not null default false
);
create table public.place_exposure (
  user_id uuid primary key references auth.users (id) on delete cascade,
  secs    int  not null default 0
);
create table public.infection_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  at      timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.pet_isolation enable row level security;
alter table public.place_exposure enable row level security;
alter table public.infection_log enable row level security;

create or replace function public.set_isolation(p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid; ill text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  pid := private.active_pet_id(uid); if pid is null then raise exception 'no_pet'; end if;
  select illness into ill from public.pets where id = pid;
  if coalesce(p_on, false) and ill is null then raise exception 'not_sick'; end if;
  insert into public.pet_isolation (user_id, active) values (uid, coalesce(p_on, false)) on conflict (user_id) do update set active = excluded.active;
  if coalesce(p_on, false) then delete from public.place_members where user_id = uid; end if;
  return jsonb_build_object('isolating', coalesce(p_on, false));
end $$;
create or replace function public.get_isolation() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return jsonb_build_object('isolating', coalesce((select active from public.pet_isolation where user_id = uid), false)
    and exists (select 1 from public.pets where owner_id = uid and stage <> 'departed' and illness is not null));
end $$;

-- Bé đang ốm và bật cách ly thì không vào được nơi chung.
create or replace function private.isolation_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select active from public.pet_isolation where user_id = new.user_id), false)
     and exists (select 1 from public.pets where owner_id = new.user_id and stage <> 'departed' and illness is not null) then raise exception 'isolating'; end if;
  return new;
end $$;
create trigger place_members_isolation before insert on public.place_members for each row execute function private.isolation_guard();

-- Mỗi nhịp 40 giây ở nơi chung trong Mùa cúm: ở cạnh bé đang cảm lạnh (đã ốm ≥ 10 phút) cộng dồn giây tiếp xúc; đủ 300 giây thì bị lây.
-- Xác định, không ngẫu nhiên. Mỗi người tối đa 1 lần/ngày; vừa khỏi được miễn nhiễm 12 giờ; bé đang ốm/ngủ/trứng không bị lây.
create or replace function private.epidemic_tick(uid uuid, t text, prev timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
declare p public.pets; d date := private.local_day(uid); src boolean; s int; il public.illnesses;
begin
  select * into p from public.pets where owner_id = uid and stage <> 'departed' for update;
  if p.id is null or p.stage = 'egg' or p.illness is not null or p.asleep
     or exists (select 1 from public.infection_log where user_id = uid and day = d)
     or exists (select 1 from public.illness_log where pet_id = p.id and ended_at > now() - interval '12 hours') then
    update public.place_exposure set secs = 0 where user_id = uid; return false;
  end if;
  src := exists (select 1 from public.place_members m join public.pets q on q.owner_id = m.user_id and q.stage <> 'departed'
                 where m.topic = t and m.user_id <> uid and m.last_seen > now() - interval '120 seconds' and q.illness = 'cam-lanh' and q.sick_since <= now() - interval '10 minutes');
  if not src then update public.place_exposure set secs = 0 where user_id = uid; return false; end if;
  insert into public.place_exposure (user_id, secs) values (uid, least(extract(epoch from now() - prev), 60)::int)
    on conflict (user_id) do update set secs = public.place_exposure.secs + least(extract(epoch from now() - prev), 60)::int returning secs into s;
  if s < 300 then return false; end if;
  select * into il from public.illnesses where id = 'cam-lanh';
  update public.pets set illness = 'cam-lanh', sick_since = now(), critical_since = null, recover_at = now() + make_interval(secs => il.heal_hours * 3600) where id = p.id;
  insert into public.infection_log (user_id, day) values (uid, d);
  update public.place_exposure set secs = 0 where user_id = uid;
  perform private.remember_first(p.id, uid, 'infect-cam-lanh', 'milestone', 'Mình bị lây cảm lạnh ở chỗ đông người. Hắt xì liên tục!');
  return true;
end $$;

create or replace function public.place_heartbeat() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t text; prev timestamptz; infected boolean := false;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select topic, last_seen into t, prev from public.place_members where user_id = uid;
  if t is null then raise exception 'not_in_place'; end if;
  update public.place_members set last_seen = now() where user_id = uid;
  if private.epidemic_on() then infected := private.epidemic_tick(uid, t, prev); end if;
  return jsonb_build_object('topic', t, 'infected', infected);
end $$;

-- ---------- Sức khoẻ: tính cả đồ chơi; Mùa cúm hạ ngưỡng cảm lạnh (1 lượt chơi từ 20:00 thay vì 2 lượt từ 22:00) ----------
create or replace function private.health_step(pid uuid, p_action text default null) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare
  p public.pets; il public.illnesses; uid uuid; today date; tz text; c text; byact text := null; cause real;
  meals int := 0; hgroups int := 0; sweets int := 0; plays1 int := 0; plays2 int := 0; lastsweet boolean := false;
  epi boolean := private.epidemic_on(); night_from int; need2 int;
begin
  select * into p from public.pets where id = pid for update;
  if p.id is null or p.stage in ('egg', 'departed') then return p; end if;
  uid := p.owner_id; today := private.local_day(uid);
  night_from := case when epi then 20 else 22 end; need2 := case when epi then 1 else 2 end;
  select coalesce(sum(fed), 0)::int into meals from public.day_logs where pet_id = pid and day between today - 2 and today;
  select count(distinct g)::int into hgroups from public.day_logs l, unnest(l.fgroups) g where l.pet_id = pid and l.day between today - 2 and today and g <> 'ngot';

  if p.illness is null then
    if p_action = 'play' then
      tz := coalesce((select timezone from public.profiles where id = uid), 'Asia/Ho_Chi_Minh');
      select count(*)::int into plays1 from public.action_log where pet_id = pid and action in ('play_ball', 'play_spin', 'play_toy') and created_at > now() - interval '1 hour';
      select count(*)::int into plays2 from public.action_log where pet_id = pid and action in ('play_ball', 'play_spin', 'play_toy') and created_at > now() - interval '2 hours'
        and (extract(hour from created_at at time zone tz) >= night_from or extract(hour from created_at at time zone tz) < 5);
      if plays2 >= need2 then byact := 'cam-lanh'; elsif plays1 >= 12 then byact := 'cang-co'; end if;
    elsif p_action = 'feed' then
      select count(*)::int into sweets from public.day_logs l, unnest(l.fgroups) g where l.pet_id = pid and l.day = today and g = 'ngot';
      select exists (select 1 from public.day_logs l join public.items it on it.name = l.foods[array_length(l.foods, 1)]
        where l.pet_id = pid and l.day = today and it.kind in ('food', 'dish') and 'ngot' in (it.effects ->> 'group', it.effects ->> 'group2')) into lastsweet;
      if lastsweet and sweets >= 4 then byact := 'sau-rang';
      elsif meals >= 6 and hgroups <= 1 then byact := 'thieu-chat'; end if;
    end if;

    if byact is null then
      c := case when p.no <= 5 then 'no' when p.sach <= 5 then 'sach' when p.vui <= 5 then 'vui' when p.nl <= 5 and not p.asleep then 'nl' end;
      if c is null then
        update public.pets set critical_since = null where id = pid and critical_since is not null;
      elsif p.critical_since is null then
        update public.pets set critical_since = now() where id = pid;
      elsif now() - p.critical_since >= interval '30 minutes' then
        select * into il from public.illnesses where heal_kind = 'stat' and heal_stat = c;
        byact := il.id;
      end if;
    end if;

    if byact is not null then
      select * into il from public.illnesses where id = byact;
      update public.pets set illness = il.id, sick_since = now(), critical_since = null,
        recover_at = case when il.heal_kind = 'time' then now() + make_interval(secs => il.heal_hours * 3600) end
      where id = pid;
      perform private.remember_first(pid, uid, 'sick-' || il.id, 'milestone', format('Lần đầu mình bị %s. Mình khó chịu lắm.', lower(il.name)));
    end if;
  else
    select * into il from public.illnesses where id = p.illness;
    if p.recover_at is not null and p.recover_at <= now() then
      perform private.cure_pet(pid, 0);
    elsif il.heal_kind = 'balanced' then
      if hgroups >= 3 then perform private.cure_pet(pid, 0); end if;
    elsif il.heal_kind = 'stat' then
      cause := case il.heal_stat when 'no' then p.no when 'sach' then p.sach when 'vui' then p.vui else p.nl end;
      if cause >= 50 then
        if p.recover_at is null then update public.pets set recover_at = now() + make_interval(secs => il.heal_hours * 3600) where id = pid; end if;
      elsif cause < 20 then
        update public.pets set recover_at = null where id = pid and recover_at is not null;
      end if;
    end if;
  end if;
  select * into p from public.pets where id = pid;
  return p;
end $$;

create or replace function private.health_on_action() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ill text; blk text[];
begin
  select p.illness, coalesce(i.block, '{}') into ill, blk from public.pets p left join public.illnesses i on i.id = p.illness where p.id = new.pet_id;
  if ill is not null and ((new.action in ('play_ball', 'play_spin', 'play_toy') and 'play' = any (blk)) or (new.action in ('bath_scrub', 'bath_rinse') and 'bath' = any (blk))) then
    raise exception 'sick_blocked';
  end if;
  perform private.health_step(new.pet_id, case when new.action in ('play_ball', 'play_spin', 'play_toy') then 'play' when new.action = 'feed' then 'feed' end);
  return new;
end $$;

-- ---------- Đồ chơi ----------
alter table public.action_log add column detail text;

create table public.toys (
  id           text primary key,
  name         text not null,
  place        text not null check (place in ('balcony', 'playroom', 'rooftop', 'park', 'portable')),
  vui          real not null,
  nl           real not null,
  no           real not null default 0,
  drift        jsonb not null default '{}',
  bond_unlock  int  not null default 1,
  daily_cap    int  not null,
  price_coins  int,
  first_memory text not null,
  active       boolean not null default true
);
alter table public.toys enable row level security;
create policy "toys: ai cũng đọc" on public.toys for select to authenticated using (true);
insert into public.toys (id, name, place, vui, nl, no, drift, bond_unlock, daily_cap, price_coins, first_memory) values
  ('bubbles', 'Thổi bong bóng', 'balcony', 5, -2, -1, '{"playful":0.3,"curious":0.2}', 3, 6, null, 'Lần đầu thổi bong bóng ngoài ban công.'),
  ('kite', 'Thả diều', 'rooftop', 7, -4, -2, '{"playful":0.4,"energy":0.3}', 7, 5, null, 'Lần đầu thả diều trên sân thượng.'),
  ('scope', 'Kính thiên văn', 'rooftop', 5, -1, 0, '{"curious":0.6}', 7, 4, null, 'Lần đầu ngắm sao bằng kính thiên văn.'),
  ('train', 'Tàu hoả đồ chơi', 'playroom', 6, -3, -1, '{"playful":0.4}', 5, 5, null, 'Lần đầu chơi tàu hoả đồ chơi.'),
  ('pit', 'Hồ bóng', 'playroom', 7, -5, -2, '{"playful":0.5,"energy":0.3}', 5, 5, null, 'Lần đầu nhảy xuống hồ bóng.'),
  ('blocks', 'Xếp hình', 'playroom', 5, -2, 0, '{"curious":0.5}', 5, 5, null, 'Lần đầu xếp hình thành một cái tháp.'),
  ('swing', 'Xích đu', 'park', 6, -3, -1, '{"playful":0.3,"energy":0.2}', 4, 6, null, 'Lần đầu được đẩy xích đu ở công viên.'),
  ('seesaw', 'Bập bênh', 'park', 6, -4, -2, '{"social":0.4,"playful":0.3}', 4, 5, null, 'Lần đầu chơi bập bênh.'),
  ('slide', 'Cầu trượt', 'park', 7, -4, -2, '{"energy":0.4,"playful":0.3}', 4, 5, null, 'Lần đầu trượt cầu trượt.'),
  ('ducks', 'Cho vịt ăn', 'park', 4, -1, -1, '{"affection":0.4}', 4, 5, null, 'Lần đầu cho vịt ở ao ăn bánh mì.'),
  ('frisbee', 'Đĩa ném', 'portable', 8, -5, -2, '{"playful":0.5,"energy":0.4,"social":0.2}', 3, 6, 120, 'Lần đầu ném đĩa bay.'),
  ('puzzle', 'Bộ xếp tranh', 'portable', 5, -1, 0, '{"curious":0.6}', 3, 5, 90, 'Lần đầu ghép xong một bức tranh.'),
  ('musicbox', 'Hộp nhạc', 'portable', 6, -1, 0, '{"affection":0.4,"curious":0.1}', 3, 5, 150, 'Lần đầu nghe hộp nhạc, mình thấy yên lòng.');

create table public.toy_owned (
  owner_id uuid not null references auth.users (id) on delete cascade,
  toy_id   text not null references public.toys (id),
  at       timestamptz not null default now(),
  primary key (owner_id, toy_id)
);
create table public.toy_logs (
  pet_id uuid not null references public.pets (id) on delete cascade,
  day    date not null,
  toy    text not null,
  n      int  not null default 0,
  primary key (pet_id, day, toy)
);
alter table public.toy_owned enable row level security;
alter table public.toy_logs enable row level security;

create or replace function private.personality_on_action() returns trigger
language plpgsql security definer set search_path = '' as $$
declare dr jsonb; p jsonb; k text; v numeric;
begin
  dr := case when new.action = 'play_toy' then coalesce((select drift from public.toys where id = new.detail), '{}'::jsonb) else private.personality_drift(new.action) end;
  if dr = '{}'::jsonb then return null; end if;
  select personality into p from public.pets where id = new.pet_id for update;
  if p is null then return null; end if;
  for k, v in select key, value::numeric from jsonb_each_text(dr) loop
    p := jsonb_set(p, array[k], to_jsonb(round(greatest(-100, least(100, coalesce((p ->> k)::numeric, 0) + v)), 1)));
  end loop;
  update public.pets set personality = p where id = new.pet_id;
  return null;
end $$;

-- Trạng thái đồ chơi hôm nay: món đã mua, số lượt đã dùng mỗi món.
create or replace function public.get_toys() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid; d date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  pid := private.active_pet_id(uid); d := private.local_day(uid);
  return jsonb_build_object('owned', coalesce((select jsonb_agg(toy_id order by toy_id) from public.toy_owned where owner_id = uid), '[]'::jsonb),
    'used', coalesce((select jsonb_object_agg(toy, n) from public.toy_logs where pet_id = pid and day = d), '{}'::jsonb));
end $$;

create or replace function public.buy_toy(p_toy text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t public.toys; w public.wallets; price int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into t from public.toys where id = p_toy and active and place = 'portable' and price_coins is not null;
  if t.id is null then raise exception 'unknown_toy'; end if;
  if exists (select 1 from public.toy_owned where owner_id = uid and toy_id = t.id) then raise exception 'already_owned'; end if;
  price := private.discounted('toy', t.price_coins);
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.coins < price then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - price where owner_id = uid returning * into w;
  insert into public.toy_owned (owner_id, toy_id) values (uid, t.id);
  return jsonb_build_object('coins', w.coins, 'paid', price);
end $$;

-- Chơi một món đồ chơi. Hiệu ứng lấy từ bảng toys (toys.ts giống hệt); từ lượt thứ 3 trong ngày chỉ được một nửa; có trần mỗi ngày mỗi món.
create or replace function public.play_toy(p_toy text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); pid uuid; p public.pets; t public.toys; d date; used int := 0; mult numeric := 1; refused text := null; earned int := 0; recent int; first_new boolean := false;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  pid := private.active_pet_id(uid); if pid is null then raise exception 'no_pet'; end if;
  select count(*) into recent from public.action_log where pet_id = pid and created_at > now() - interval '10 seconds';
  if recent >= 30 then raise exception 'rate_limited'; end if;
  select * into t from public.toys where id = p_toy and active;
  if t.id is null then raise exception 'unknown_toy'; end if;
  p := private.decay_pet(pid); d := private.local_day(uid);
  if private.bond_level(p.bond_xp) < t.bond_unlock then raise exception 'toy_locked'; end if;
  if t.place = 'portable' and not exists (select 1 from public.toy_owned where owner_id = uid and toy_id = t.id) then raise exception 'toy_not_owned'; end if;
  select coalesce(n, 0) into used from public.toy_logs where pet_id = pid and day = d and toy = t.id;
  used := coalesce(used, 0);
  if p.asleep then refused := 'asleep';
  elsif p.nl < 15 then refused := 'tired';
  elsif used >= t.daily_cap then refused := 'toy_cap';
  else
    if used >= 2 then mult := 0.5; end if;
    insert into public.toy_logs (pet_id, day, toy, n) values (pid, d, t.id, 1) on conflict (pet_id, day, toy) do update set n = public.toy_logs.n + 1;
    insert into public.action_log (pet_id, action, detail) values (pid, 'play_toy', t.id); -- có thể ném sick_blocked (bé đang ốm)
    update public.pets set vui = private.clamp((vui + t.vui * mult)::real), nl = private.clamp((nl + t.nl)::real), no = private.clamp((no + t.no * mult)::real), bond_xp = bond_xp + 1 where id = pid;
    earned := private.earn(uid, 5, true);
    first_new := private.remember_first(pid, uid, 'toy-' || t.id, 'play', t.first_memory);
  end if;
  select * into p from public.pets where id = pid;
  return jsonb_build_object('pet', to_jsonb(p), 'refused', refused, 'earned', earned, 'coins', (select coins from public.wallets where owner_id = uid), 'new_memory', first_new,
    'mult', mult, 'left', greatest(0, t.daily_cap - used - (case when refused is null then 1 else 0 end)), 'toy', t.id);
end $$;

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_event_goal(), public.claim_event_goal(bigint), public.set_isolation(boolean), public.get_isolation(), public.get_toys(), public.buy_toy(text), public.play_toy(text) from public, anon;
grant execute on function public.get_event_goal(), public.claim_event_goal(bigint), public.set_isolation(boolean), public.get_isolation(), public.get_toys(), public.buy_toy(text), public.play_toy(text) to authenticated;
