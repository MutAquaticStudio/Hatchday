-- =====================================================================
-- Hatchday — Trang trí nông trại
-- 12 món đồ trang trí đặt ngoài vườn (items.layer = 'farm'), mua ở cửa hàng như đồ trang trí khác (buy_item), mua được nhiều bản.
-- Bố cục nông trại lưu một bản cho mỗi người chơi: { items: [{ id, x, z, rot }] }.
-- Seed sinh từ src/game/catalog.ts (scripts/gen-seed.ts). Đừng sửa tay. Test: supabase/tests/farm.test.ts.
-- Không viết lại hàm nào có sẵn: buy_item đã bán được đồ trang trí 'decor'; check_layout của phòng vẫn chỉ nhận floor/rug/wall.
-- =====================================================================

alter table public.items drop constraint items_layer_check,
  add constraint items_layer_check check (layer in ('floor', 'rug', 'wall', 'wallpaper', 'flooring', 'farm'));

-- FARM ITEMS
insert into public.items (id, kind, name, layer, slot, w, d, comfort, theme, tags, price_coins, source, rarity) values
  ('bien-nong-trai', 'decor', 'Biển nông trại', 'farm', null, 1, 1, 0, null, '{}', 90, 'market', 'thuong'),
  ('dong-rom', 'decor', 'Đống rơm', 'farm', null, 1, 1, 0, null, '{}', 120, 'market', 'thuong'),
  ('hom-thu', 'decor', 'Hòm thư', 'farm', null, 1, 1, 0, null, '{}', 130, 'market', 'thuong'),
  ('bu-nhin', 'decor', 'Bù nhìn', 'farm', null, 1, 1, 0, null, '{}', 140, 'market', 'thuong'),
  ('goc-nam', 'decor', 'Gốc cây nấm', 'farm', null, 1, 1, 0, null, '{}', 150, 'market', 'thuong'),
  ('ghe-vuon', 'decor', 'Ghế gỗ vườn', 'farm', null, 1, 1, 0, null, '{}', 160, 'market', 'thuong'),
  ('to-ong', 'decor', 'Tổ ong', 'farm', null, 1, 1, 0, null, '{}', 200, 'market', 'thuong'),
  ('xe-hoa', 'decor', 'Xe đẩy hoa', 'farm', null, 1, 1, 0, null, '{}', 220, 'market', 'thuong'),
  ('den-vuon', 'decor', 'Đèn lồng vườn', 'farm', null, 1, 1, 0, null, '{}', 240, 'market', 'thuong'),
  ('gieng', 'decor', 'Giếng nước', 'farm', null, 1, 1, 0, null, '{}', 420, 'rotating', 'dep'),
  ('ao-nho', 'decor', 'Ao sen nhỏ', 'farm', null, 1, 1, 0, null, '{}', 520, 'rotating', 'dep'),
  ('coi-xay-gio', 'decor', 'Cối xay gió mini', 'farm', null, 1, 1, 0, null, '{}', 760, 'weekend', 'hiem')
on conflict (id) do nothing;

create table public.farm_layouts (
  owner_id    uuid primary key references auth.users (id) on delete cascade,
  layout      jsonb not null default '{"items":[]}',
  updated_at  timestamptz not null default now()
);
alter table public.farm_layouts enable row level security;
create policy "farm: đọc của mình" on public.farm_layouts for select to authenticated using ((select auth.uid()) = owner_id);

-- Kiểm tra bố cục nông trại: tối đa 60 món, đúng loại 'farm', đủ số lượng sở hữu, nằm trong sân (x từ -6,5 tới 6,5; z từ -4,2 tới 5,2), xoay 0–3.
-- Việc không chồng lên luống, thảm của thú và món khác do client kiểm tra (garden3d.js); server chặn gian lận về sở hữu và phạm vi.
create or replace function private.check_farm_layout(uid uuid, lay jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare e jsonb; rec record; x numeric; z numeric;
begin
  if jsonb_typeof(lay -> 'items') is distinct from 'array' or jsonb_array_length(lay -> 'items') > 60 then raise exception 'invalid_layout'; end if;
  for e in select * from jsonb_array_elements(lay -> 'items') loop
    if not exists (select 1 from public.items where id = e ->> 'id' and kind = 'decor' and layer = 'farm') then raise exception 'invalid_layout'; end if;
    x := (e ->> 'x')::numeric; z := (e ->> 'z')::numeric;
    if x is null or z is null or x not between -6.5 and 6.5 or z not between -4.2 and 5.2 then raise exception 'invalid_layout'; end if;
    if coalesce((e ->> 'rot')::int, 0) not between 0 and 3 then raise exception 'invalid_layout'; end if;
  end loop;
  for rec in select x2 ->> 'id' id, count(*)::int n from jsonb_array_elements(lay -> 'items') x2 group by 1 loop
    if not private.owns(uid, rec.id, rec.n) then raise exception 'not_owned'; end if;
  end loop;
end $$;

create or replace function public.save_farm_layout(p_layout jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform private.check_farm_layout(uid, p_layout);
  insert into public.farm_layouts (owner_id, layout, updated_at) values (uid, jsonb_build_object('items', p_layout -> 'items'), now())
  on conflict (owner_id) do update set layout = excluded.layout, updated_at = now();
  return jsonb_build_object('count', jsonb_array_length(p_layout -> 'items'));
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.save_farm_layout(jsonb) from public, anon;
grant execute on function public.save_farm_layout(jsonb) to authenticated;
