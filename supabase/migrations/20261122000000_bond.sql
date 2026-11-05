-- =====================================================================
-- Hatchday — Gắn bó: cấp 1–10 theo điểm bond_xp, quà xu cho mỗi cấp từ 2 trở lên
-- Luật ở hai nơi: src/game/bond.ts và migration này. Test: supabase/tests/bond.test.ts.
-- bond_xp đã có sẵn trên pets (cộng 1 mỗi hành động chăm sóc thành công trong pet_action; chữa bệnh cộng 3).
-- Không viết lại hàm nào. Quà nhận qua claim_bond_reward, mỗi cấp một lần cho mỗi bé.
-- =====================================================================

-- Mốc điểm cấp 1..10: 0, 25, 80, 170, 300, 480, 720, 1020, 1400, 1900
create or replace function private.bond_level(xp int) returns int
language sql immutable set search_path = '' as $$
  select case when xp >= 1900 then 10 when xp >= 1400 then 9 when xp >= 1020 then 8 when xp >= 720 then 7 when xp >= 480 then 6
              when xp >= 300 then 5 when xp >= 170 then 4 when xp >= 80 then 3 when xp >= 25 then 2 else 1 end
$$;

-- Quà xu khi đạt cấp 1..10: 0, 50, 80, 120, 160, 220, 300, 400, 520, 700
create or replace function private.bond_reward(lv int) returns int
language sql immutable set search_path = '' as $$
  select (array[0, 50, 80, 120, 160, 220, 300, 400, 520, 700])[lv]
$$;

create table public.bond_claims (
  pet_id     uuid not null references public.pets (id) on delete cascade,
  level      int  not null check (level between 2 and 10),
  claimed_at timestamptz not null default now(),
  primary key (pet_id, level)
);
alter table public.bond_claims enable row level security;
create policy "bond_claims: đọc của mình" on public.bond_claims for select to authenticated
  using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = (select auth.uid())));

create or replace function public.claim_bond_reward(p_level int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid; p public.pets; reward int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_level is null or p_level not between 2 and 10 then raise exception 'invalid_level'; end if;
  pid := private.active_pet_id(uid);
  if pid is null then raise exception 'no_pet'; end if;
  select * into p from public.pets where id = pid;
  if private.bond_level(p.bond_xp) < p_level then raise exception 'bond_too_low'; end if;
  if exists (select 1 from public.bond_claims where pet_id = pid and level = p_level) then raise exception 'already_claimed'; end if;
  insert into public.bond_claims (pet_id, level) values (pid, p_level);
  reward := private.bond_reward(p_level);
  perform private.earn(uid, reward, false);
  perform private.remember_first(pid, uid, 'bond-' || p_level, 'milestone', format('Chúng mình thân nhau hơn rồi, đã đạt cấp gắn bó %s.', p_level));
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'reward', reward);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.claim_bond_reward(int) from public, anon;
grant execute on function public.claim_bond_reward(int) to authenticated;
