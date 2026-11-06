-- =====================================================================
-- Hatchday — Hook sự kiện: nhân xu nhiệm vụ (coin_boost) (P15, phần nhỏ)
-- Cấu hình sự kiện nhận thêm khoá `coin_boost` (số từ 1 đến 3). Khi có sự kiện đang chạy, xu thưởng nhiệm vụ ngày, thưởng cả ngày
-- và nhiệm vụ tuần nhân theo hệ số lớn nhất của các sự kiện đang bật (làm tròn). Không tác động xu chăm sóc (có trần mỗi ngày),
-- quà thư, bán nông sản hay thưởng Gắn bó. Chưa làm: giảm giá cửa hàng (shop_discount) và Mùa cúm (epidemic).
-- Luật ở hai nơi: src/game/events.ts (boostedReward) và migration này. Test: supabase/tests/events-hooks.test.ts.
--
-- Hàm viết lại nguyên cả hàm, đã đối chiếu với bản mới nhất:
--   private.validate_event_config (từ 20261206000000_admin.sql; thêm coin_boost),
--   public.claim_quest, public.claim_quest_bonus, public.claim_weekly_quest (từ 20261114000000_food_economy.sql; nhân thưởng).
-- =====================================================================

create or replace function private.validate_event_config(cfg jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  if jsonb_typeof(cfg) is distinct from 'object' then raise exception 'invalid_event_config'; end if;
  for k in select jsonb_object_keys(cfg) loop
    if k not in ('banner', 'plaza_decor', 'coin_boost') then raise exception 'invalid_event_config'; end if;
  end loop;
  if cfg ? 'banner' and (jsonb_typeof(cfg -> 'banner') <> 'string' or char_length(cfg ->> 'banner') > 120) then raise exception 'invalid_event_config'; end if;
  if cfg ? 'plaza_decor' and (cfg ->> 'plaza_decor') not in ('tet', 'trung-thu', 'giang-sinh', 'he') then raise exception 'invalid_event_config'; end if;
  if cfg ? 'coin_boost' and (jsonb_typeof(cfg -> 'coin_boost') <> 'number' or (cfg ->> 'coin_boost')::numeric < 1 or (cfg ->> 'coin_boost')::numeric > 3) then raise exception 'invalid_event_config'; end if;
end $$;

-- Hệ số nhân xu nhiệm vụ đang có hiệu lực (1 = không có sự kiện).
create or replace function private.event_boost() returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(max((config ->> 'coin_boost')::numeric), 1) from public.events where enabled and starts_at <= now() and ends_at > now() and config ? 'coin_boost'
$$;

create or replace function public.claim_quest(p_idx int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); q jsonb; d date; reward int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_idx is null or p_idx not between 0 and 4 then raise exception 'invalid_quest'; end if;
  q := public.get_quests() -> 'quests' -> p_idx; d := private.local_day(uid);
  if (q ->> 'progress')::int < (q ->> 'target')::int then raise exception 'quest_not_done'; end if;
  insert into public.quest_claims (owner_id, day, idx) values (uid, d, p_idx) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  reward := round((q ->> 'reward')::int * private.event_boost())::int;
  perform private.earn(uid, reward, false);
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'reward', reward);
end $$;

create or replace function public.claim_quest_bonus() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date; reward int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not (public.get_quests() -> 'bonus' ->> 'ready')::boolean then raise exception 'quest_not_done'; end if;
  d := private.local_day(uid);
  insert into public.quest_claims (owner_id, day, idx) values (uid, d, 5) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  reward := round(50 * private.event_boost())::int;
  perform private.earn(uid, reward, false);
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'reward', reward);
end $$;

create or replace function public.claim_weekly_quest(p_idx int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); b jsonb; q jsonb; reward int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_idx is null or p_idx not between 0 and 2 then raise exception 'invalid_quest'; end if;
  b := public.get_quests(); q := b -> 'weekly' -> p_idx;
  if (q ->> 'progress')::int < (q ->> 'target')::int then raise exception 'quest_not_done'; end if;
  insert into public.weekly_claims (owner_id, week, idx) values (uid, (b ->> 'week')::date, p_idx) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  reward := round((q ->> 'reward')::int * private.event_boost())::int;
  perform private.earn(uid, reward, false);
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'reward', reward);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
