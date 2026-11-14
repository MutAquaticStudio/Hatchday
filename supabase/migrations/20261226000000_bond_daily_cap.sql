-- Trần điểm Gắn bó mỗi ngày (soát kinh tế, đợt agency).
-- Trước đây mỗi lần nói chuyện/vuốt ve/tắm cộng 1 điểm không giới hạn, nên bấm liên tục ~10 phút là lên Gắn bó 10,
-- nhận hết quà xu các cấp và mở chiêu tối thượng. Thiết kế (src/game/bond.ts) giả định 50–150 điểm mỗi ngày.
-- Cách làm: trigger trước khi cập nhật bond_xp, chỉ áp cho khoản cộng nhỏ (≤ 5, mọi đường cộng của người chơi:
-- chăm sóc +1, đồ chơi +1, chữa bệnh +3, quà bạn bè +3). Khoản cộng lớn hơn chỉ đến từ quản trị viên nên đi thẳng.
-- Ngày tính theo múi giờ người chơi (private.local_day), khớp bondGain trong src/game/bond.ts (bản Chơi thử).

alter table public.pets add column if not exists bond_day date, add column if not exists bond_today int not null default 0;

insert into public.balance_config (key, value, def, min, max, unit, label, grp, note) values
  ('bond.daily_cap', 150, 150, 20, 1000, 'điểm', 'Điểm Gắn bó tối đa mỗi ngày', 'Gắn bó', 'Chặn bấm liên tục để lên cấp nhanh; quà xu theo cấp nên đây cũng là trần xu.')
on conflict (key) do nothing;

create or replace function private.cap_bond_gain() returns trigger
language plpgsql security definer set search_path = '' as $$
declare gain int := new.bond_xp - old.bond_xp; d date; cap int;
begin
  if gain <= 0 or gain > 5 then return new; end if;
  d := private.local_day(new.owner_id); cap := coalesce(private.bal('bond.daily_cap'), 150)::int;
  if new.bond_day is distinct from d then new.bond_day := d; new.bond_today := 0; end if;
  gain := least(gain, greatest(0, cap - new.bond_today));
  new.bond_today := new.bond_today + gain; new.bond_xp := old.bond_xp + gain;
  return new;
end $$;

drop trigger if exists pets_cap_bond on public.pets;
create trigger pets_cap_bond before update of bond_xp on public.pets for each row execute function private.cap_bond_gain();

revoke all on function private.cap_bond_gain() from public, anon, authenticated;
