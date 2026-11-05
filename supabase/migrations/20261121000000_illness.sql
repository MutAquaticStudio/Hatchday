-- =====================================================================
-- Hatchday — Sức khoẻ: 8 bệnh, mỗi bệnh có điều kiện mắc, ảnh hưởng và cách khỏi riêng
-- Luật ở hai nơi: src/game/health.ts (+ rules.ts: decayStats) và migration này. Test: supabase/tests/health.test.ts.
--
-- Bốn nhóm bệnh:
--   Bỏ bê: một chỉ số ≤ 5 liên tục 30 phút trong lúc người chơi đang mở game (đồng hồ chạy khi get_health/hành động gọi vào).
--   Ăn uống: sâu răng (món ngọt thứ 4 trong ngày), thiếu chất (6 bữa trong 3 ngày mà chỉ 1 nhóm lành mạnh).
--   Vận động: căng cơ (chơi từ 12 lần trong 1 giờ). Môi trường: cảm lạnh (chơi lúc khuya 22–05 giờ, từ 2 lần trong 2 giờ).
-- Bệnh do hành động chỉ xét ngay lúc làm hành động (trigger trên action_log), không tự mắc lại khi mở game.
-- Bệnh nặng: không có tiến triển phục hồi (recover_at rỗng) suốt 24 giờ → giảm chỉ số nhanh hơn 25%, chỉ phòng khám chữa được.
-- Khi ốm: hệ số giảm chỉ số theo bảng illnesses.decay; trigger action_log chặn chơi/tắm theo illnesses.block
-- (chặn món ngọt khi sâu răng chỉ do giao diện, vì action_log không ghi món).
--
-- Hàm viết lại nguyên cả hàm, đã đối chiếu với bản mới nhất trên main:
--   private.decay_pet (từ 20261105000000_decor_cosmetics.sql; thêm hệ số bệnh).
-- Không viết lại: pet_action, get_my_pet, create_pet, buy_item (bệnh chạy bằng trigger và hàm mới).
-- =====================================================================

alter table public.items drop constraint items_kind_check,
  add constraint items_kind_check check (kind in ('food', 'dish', 'decor', 'outfit', 'medicine'));

alter table public.pets
  add column illness        text,
  add column sick_since     timestamptz,
  add column critical_since timestamptz,
  add column recover_at     timestamptz;

create table public.illnesses (
  id         text primary key,
  name       text not null,
  family     text not null check (family in ('bo-be', 'an-uong', 'van-dong', 'moi-truong')),
  -- hệ số nhân tốc độ giảm của từng chỉ số, ví dụ {"no":1.5,"vui":1.2}
  decay      jsonb not null default '{}',
  -- việc không làm được khi ốm: play, bath, sweets
  block      text[] not null default '{}',
  heal_kind  text not null check (heal_kind in ('stat', 'time', 'balanced')),
  heal_stat  text check (heal_stat in ('no', 'sach', 'vui', 'nl')),
  heal_hours numeric,
  medicine   text not null references public.items (id)
);
alter table public.illnesses enable row level security;
create policy "illnesses: ai cũng đọc" on public.illnesses for select to authenticated using (true);
alter table public.pets add constraint pets_illness_fk foreign key (illness) references public.illnesses (id);

-- MEDICINES
insert into public.items (id, kind, name, effects, price_coins, source, rarity) values
  ('tra-gung', 'medicine', 'Trà gừng', '{"cures":"dau-bung"}', 50, 'market', 'thuong'),
  ('thuoc-boi', 'medicine', 'Thuốc bôi lá', '{"cures":"ngua-da"}', 50, 'market', 'thuong'),
  ('mat-ong', 'medicine', 'Mật ong ấm', '{"cures":"u-rut"}', 50, 'market', 'thuong'),
  ('thuoc-sot', 'medicine', 'Thuốc hạ sốt', '{"cures":"sot-met"}', 60, 'market', 'thuong'),
  ('nuoc-muoi', 'medicine', 'Nước súc miệng muối', '{"cures":"sau-rang"}', 40, 'market', 'thuong'),
  ('vitamin', 'medicine', 'Vitamin tổng hợp', '{"cures":"thieu-chat"}', 70, 'market', 'thuong'),
  ('dau-xoa', 'medicine', 'Dầu xoa bóp', '{"cures":"cang-co"}', 40, 'market', 'thuong'),
  ('thuoc-ho', 'medicine', 'Siro ho thảo mộc', '{"cures":"cam-lanh"}', 50, 'market', 'thuong')
on conflict (id) do update set name = excluded.name, effects = excluded.effects, price_coins = excluded.price_coins;
-- ILLNESSES
insert into public.illnesses (id, name, family, decay, block, heal_kind, heal_stat, heal_hours, medicine) values
  ('dau-bung', 'Đau bụng', 'bo-be', '{"no":1.5,"vui":1.2}', '{play}', 'stat', 'no', 3, 'tra-gung'),
  ('ngua-da', 'Nổi mẩn', 'bo-be', '{"sach":1.5,"vui":1.3}', '{}', 'stat', 'sach', 3, 'thuoc-boi'),
  ('u-rut', 'Ủ rũ', 'bo-be', '{"vui":1.5,"nl":1.2}', '{play}', 'stat', 'vui', 3, 'mat-ong'),
  ('sot-met', 'Sốt mệt', 'bo-be', '{"nl":1.5,"no":1.2}', '{play}', 'stat', 'nl', 3, 'thuoc-sot'),
  ('sau-rang', 'Sâu răng', 'an-uong', '{"vui":1.3}', '{sweets}', 'time', null, 6, 'nuoc-muoi'),
  ('thieu-chat', 'Thiếu chất', 'an-uong', '{"nl":1.3,"no":1.2}', '{}', 'balanced', null, null, 'vitamin'),
  ('cang-co', 'Căng cơ', 'van-dong', '{"nl":1.3}', '{play}', 'time', null, 2, 'dau-xoa'),
  ('cam-lanh', 'Cảm lạnh', 'moi-truong', '{"nl":1.3,"vui":1.2}', '{play,bath}', 'time', null, 4, 'thuoc-ho')
on conflict (id) do update set name = excluded.name, family = excluded.family, decay = excluded.decay, block = excluded.block, heal_kind = excluded.heal_kind, heal_stat = excluded.heal_stat, heal_hours = excluded.heal_hours, medicine = excluded.medicine;

-- ---------- Giảm chỉ số: thêm hệ số theo bệnh (cùng công thức với decayStats() ở client) ----------
create or replace function private.decay_pet(pid uuid) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare p public.pets; mins double precision; k double precision; f jsonb := '{}'; sev double precision := 1;
begin
  select * into p from public.pets where id = pid for update;
  mins := least(extract(epoch from (now() - p.stats_at)) / 60.0, 4320);
  k := 0.05 * (p.comfort_level - 1);
  if p.illness is not null then
    select decay into f from public.illnesses where id = p.illness;
    if private.is_severe(p) then sev := 1.25; end if;
  end if;
  if mins > 0 then
    update public.pets set
      no   = private.clamp((no   - mins * 0.9 * coalesce((f ->> 'no')::double precision, 1) * sev)::real),
      vui  = private.clamp((vui  - mins * 0.5 * (1 - k) * coalesce((f ->> 'vui')::double precision, 1) * sev)::real),
      sach = private.clamp((sach - mins * 0.35 * coalesce((f ->> 'sach')::double precision, 1) * sev)::real),
      nl   = private.clamp((case when asleep then nl + mins * 3 * (1 + k) else nl - mins * 0.45 * (1 - k) * coalesce((f ->> 'nl')::double precision, 1) * sev end)::real),
      stats_at = now()
    where id = pid
    returning * into p;
  end if;
  return p;
end $$;

-- Bệnh nặng: đang ốm, chưa có tiến triển phục hồi, và đã ốm từ 24 giờ
create or replace function private.is_severe(p public.pets) returns boolean
language sql stable security definer set search_path = '' as $$
  select p.illness is not null and p.recover_at is null and p.sick_since is not null and now() - p.sick_since >= interval '24 hours'
$$;

-- Khỏi bệnh: xoá mọi mốc, cộng điểm gắn bó nếu do người chơi chữa
create or replace function private.cure_pet(pid uuid, bond int) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare p public.pets;
begin
  update public.pets set illness = null, sick_since = null, recover_at = null, critical_since = null, bond_xp = bond_xp + bond
  where id = pid returning * into p;
  perform private.remember_first(pid, p.owner_id, 'cured', 'milestone', 'Mình khỏi bệnh rồi. Cảm ơn bạn đã chăm mình nhé.');
  return p;
end $$;

-- Một bước đánh giá sức khoẻ — cùng luật với healthStep() ở client.
-- p_action: null (mở game / đồng bộ định kỳ), 'play' hoặc 'feed' (ngay sau hành động đó).
create or replace function private.health_step(pid uuid, p_action text default null) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare
  p public.pets; il public.illnesses; uid uuid; today date; tz text; c text; byact text := null; cause real;
  meals int := 0; hgroups int := 0; sweets int := 0; plays1 int := 0; plays2 int := 0; lastsweet boolean := false;
begin
  select * into p from public.pets where id = pid for update;
  if p.id is null or p.stage in ('egg', 'departed') then return p; end if;
  uid := p.owner_id; today := private.local_day(uid);
  select coalesce(sum(fed), 0)::int into meals from public.day_logs where pet_id = pid and day between today - 2 and today;
  select count(distinct g)::int into hgroups from public.day_logs l, unnest(l.fgroups) g where l.pet_id = pid and l.day between today - 2 and today and g <> 'ngot';

  if p.illness is null then
    if p_action = 'play' then
      tz := coalesce((select timezone from public.profiles where id = uid), 'Asia/Ho_Chi_Minh');
      select count(*)::int into plays1 from public.action_log where pet_id = pid and action in ('play_ball', 'play_spin') and created_at > now() - interval '1 hour';
      select count(*)::int into plays2 from public.action_log where pet_id = pid and action in ('play_ball', 'play_spin') and created_at > now() - interval '2 hours'
        and (extract(hour from created_at at time zone tz) >= 22 or extract(hour from created_at at time zone tz) < 5);
      if plays2 >= 2 then byact := 'cam-lanh'; elsif plays1 >= 12 then byact := 'cang-co'; end if;
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

-- Sau mỗi hành động: chặn việc bé ốm không làm được (chơi, tắm), rồi xét bệnh do hành động đó.
create or replace function private.health_on_action() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ill text; blk text[];
begin
  select p.illness, coalesce(i.block, '{}') into ill, blk from public.pets p left join public.illnesses i on i.id = p.illness where p.id = new.pet_id;
  if ill is not null and ((new.action in ('play_ball', 'play_spin') and 'play' = any (blk)) or (new.action in ('bath_scrub', 'bath_rinse') and 'bath' = any (blk))) then
    raise exception 'sick_blocked';
  end if;
  perform private.health_step(new.pet_id, case when new.action in ('play_ball', 'play_spin') then 'play' when new.action = 'feed' then 'feed' end);
  return new;
end $$;
create trigger action_log_health after insert on public.action_log
  for each row execute function private.health_on_action();

-- ---------- RPC ----------
-- Gọi lúc mở game và mỗi phút: áp giảm chỉ số, xét bệnh bỏ bê và hồi phục. Trả về thú (có illness, critical_since, recover_at).
create or replace function public.get_health() returns public.pets
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  pid := private.active_pet_id(uid);
  if pid is null then return null; end if;
  perform private.decay_pet(pid);
  return private.health_step(pid, null);
end $$;

create or replace function public.buy_medicine(p_item text, p_qty int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); it public.items; w public.wallets; cur int; q int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into it from public.items where id = p_item and active and kind = 'medicine';
  if it.id is null then raise exception 'unknown_item'; end if;
  if p_qty is null or p_qty not between 1 and 10 then raise exception 'invalid_qty'; end if;
  cur := coalesce((select qty from public.entitlements where owner_id = uid and item_id = it.id), 0);
  if cur + p_qty > 10 then raise exception 'stock_full'; end if;
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.coins < it.price_coins * p_qty then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - it.price_coins * p_qty where owner_id = uid returning * into w;
  insert into public.entitlements (owner_id, item_id, source, qty) values (uid, it.id, 'coins', p_qty)
  on conflict (owner_id, item_id) do update set qty = public.entitlements.qty + p_qty
  returning qty into q;
  return jsonb_build_object('coins', w.coins, 'qty', q);
end $$;

-- Cho thuốc đúng bệnh. Bệnh nặng thì thuốc không đủ, phải ra phòng khám.
create or replace function public.use_medicine(p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid; p public.pets; it public.items; q int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into it from public.items where id = p_item and active and kind = 'medicine';
  if it.id is null then raise exception 'unknown_item'; end if;
  pid := private.active_pet_id(uid);
  if pid is null then raise exception 'no_pet'; end if;
  perform private.decay_pet(pid);
  p := private.health_step(pid, null);
  if p.illness is null then raise exception 'not_sick'; end if;
  if it.effects ->> 'cures' is distinct from p.illness then raise exception 'wrong_medicine'; end if;
  if private.is_severe(p) then raise exception 'needs_clinic'; end if;
  if not private.owns(uid, it.id) then raise exception 'not_owned'; end if;
  update public.entitlements set qty = qty - 1 where owner_id = uid and item_id = it.id returning qty into q;
  p := private.cure_pet(pid, 3);
  return jsonb_build_object('pet', to_jsonb(p), 'qty', q);
end $$;

-- Phòng khám: khỏi ngay (150 xu, bệnh nặng 250 xu) và bổ sung chỉ số bị bỏ bê lên ít nhất 60.
create or replace function public.visit_clinic() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid; p public.pets; il public.illnesses; w public.wallets; cost int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  pid := private.active_pet_id(uid);
  if pid is null then raise exception 'no_pet'; end if;
  perform private.decay_pet(pid);
  p := private.health_step(pid, null);
  if p.illness is null then raise exception 'not_sick'; end if;
  select * into il from public.illnesses where id = p.illness;
  cost := case when private.is_severe(p) then 250 else 150 end;
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.coins < cost then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - cost where owner_id = uid returning * into w;
  if il.heal_kind = 'stat' then
    update public.pets set
      no   = case when il.heal_stat = 'no'   then greatest(no, 60)   else no end,
      sach = case when il.heal_stat = 'sach' then greatest(sach, 60) else sach end,
      vui  = case when il.heal_stat = 'vui'  then greatest(vui, 60)  else vui end,
      nl   = case when il.heal_stat = 'nl'   then greatest(nl, 60)   else nl end
    where id = pid;
  end if;
  p := private.cure_pet(pid, 3);
  return jsonb_build_object('pet', to_jsonb(p), 'coins', w.coins);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_health(), public.buy_medicine(text, int), public.use_medicine(text), public.visit_clinic() from public, anon;
grant execute on function public.get_health(), public.buy_medicine(text, int), public.use_medicine(text), public.visit_clinic() to authenticated;
