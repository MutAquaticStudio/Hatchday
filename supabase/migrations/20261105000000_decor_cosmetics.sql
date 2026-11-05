-- =====================================================================
-- Hatchday — Trang trí phòng, trang phục, xu, nhiệm vụ ngày, sổ sưu tập
-- Seed vật phẩm sinh từ src/game/catalog.ts (scripts/gen-seed.ts). Đừng sửa tay.
-- =====================================================================

-- ---------- Vật phẩm: thêm thuộc tính ----------
alter table public.items drop constraint if exists items_kind_check;
alter table public.items
  add constraint items_kind_check check (kind in ('food', 'decor', 'outfit')),
  add column layer  text check (layer in ('floor', 'rug', 'wall', 'wallpaper', 'flooring')),
  add column slot   text check (slot in ('head', 'face', 'neck', 'back')),
  add column w      int,
  add column d      int,
  add column comfort int not null default 0,
  add column theme  text,
  add column tags   text[] not null default '{}',
  add column source text not null default 'starter' check (source in ('starter', 'market', 'rotating', 'weekend', 'event', 'paid')),
  add column rarity text not null default 'thuong' check (rarity in ('thuong', 'dep', 'hiem', 'ky-niem'));

insert into public.items (id, kind, name, layer, slot, w, d, comfort, theme, tags, price_coins, source, rarity) values
  ('o-rom', 'decor', 'Ổ rơm', 'floor', null, 2, 2, 3, 'go-moc', '{mem}', null, 'starter', 'thuong'),
  ('giuong-may', 'decor', 'Giường mây', 'floor', null, 2, 2, 5, 'pastel', '{mem}', 900, 'rotating', 'dep'),
  ('ghe-dau', 'decor', 'Ghế đẩu gỗ', 'floor', null, 1, 1, 1, 'go-moc', '{}', 120, 'market', 'thuong'),
  ('ban-tra', 'decor', 'Bàn trà gỗ', 'floor', null, 2, 1, 2, 'go-moc', '{}', 300, 'market', 'thuong'),
  ('ke-sach', 'decor', 'Kệ sách', 'floor', null, 1, 1, 2, 'go-moc', '{sach}', 280, 'market', 'thuong'),
  ('sofa-hong', 'decor', 'Sofa hồng', 'floor', null, 2, 1, 4, 'pastel', '{mem}', 650, 'rotating', 'dep'),
  ('den-keo', 'decor', 'Đèn kẹo ngọt', 'floor', null, 1, 1, 1, 'pastel', '{sang}', 380, 'market', 'thuong'),
  ('gau-bong', 'decor', 'Gấu bông khổng lồ', 'floor', null, 1, 1, 3, 'pastel', '{mem}', 720, 'rotating', 'dep'),
  ('tv-crt', 'decor', 'TV đèn hình', 'floor', null, 1, 1, 2, 'tuoi-tho-9x', '{retro}', 450, 'rotating', 'dep'),
  ('may-game', 'decor', 'Máy chơi game cầm tay', 'floor', null, 1, 1, 1, 'tuoi-tho-9x', '{retro,choi}', 300, 'market', 'thuong'),
  ('ban-hoc', 'decor', 'Bàn học gỗ', 'floor', null, 2, 1, 2, 'tuoi-tho-9x', '{sach}', 380, 'market', 'thuong'),
  ('dong-ho-bao-thuc', 'decor', 'Đồng hồ báo thức', 'floor', null, 1, 1, 1, 'tuoi-tho-9x', '{retro}', 150, 'market', 'thuong'),
  ('chau-cay', 'decor', 'Chậu cây', 'floor', null, 1, 1, 2, 'rung', '{cay}', null, 'starter', 'thuong'),
  ('xuong-rong', 'decor', 'Xương rồng', 'floor', null, 1, 1, 1, 'rung', '{cay}', 90, 'market', 'thuong'),
  ('cay-lon', 'decor', 'Cây cổ thụ mini', 'floor', null, 1, 1, 3, 'rung', '{cay}', 1100, 'weekend', 'hiem'),
  ('vo-oc', 'decor', 'Vỏ ốc khổng lồ', 'floor', null, 1, 1, 1, 'bien', '{}', 110, 'market', 'thuong'),
  ('hai-dang', 'decor', 'Đèn hải đăng', 'floor', null, 1, 1, 2, 'bien', '{sang}', 420, 'rotating', 'dep'),
  ('den-long', 'decor', 'Đèn lồng giấy', 'floor', null, 1, 1, 1, 'pho-cu', '{sang}', 220, 'market', 'thuong'),
  ('long-chim', 'decor', 'Lồng chim', 'floor', null, 1, 1, 2, 'pho-cu', '{}', 260, 'market', 'thuong'),
  ('quat-may', 'decor', 'Quạt máy', 'floor', null, 1, 1, 1, 'pho-cu', '{retro}', 200, 'market', 'thuong'),
  ('ghe-nhua', 'decor', 'Ghế nhựa đỏ', 'floor', null, 1, 1, 1, 'pho-cu', '{}', 80, 'market', 'thuong'),
  ('bong', 'decor', 'Bóng', 'floor', null, 1, 1, 1, null, '{choi}', null, 'starter', 'thuong'),
  ('cay-dao', 'decor', 'Cây đào Tết', 'floor', null, 1, 1, 3, 'le-hoi', '{cay}', null, 'event', 'hiem'),
  ('den-ong-sao', 'decor', 'Đèn ông sao', 'floor', null, 1, 1, 2, 'le-hoi', '{sang}', null, 'event', 'hiem'),
  ('tham-tron', 'decor', 'Thảm tròn xanh', 'rug', null, 4, 4, 1, null, '{mem}', null, 'starter', 'thuong'),
  ('tham-cat', 'decor', 'Thảm cát', 'rug', null, 3, 2, 1, 'bien', '{}', 240, 'market', 'thuong'),
  ('tham-reu', 'decor', 'Thảm rêu', 'rug', null, 3, 3, 2, 'rung', '{cay}', 300, 'market', 'thuong'),
  ('tham-ca-ro', 'decor', 'Thảm ca rô', 'rug', null, 3, 3, 1, 'pastel', '{mem}', 180, 'market', 'thuong'),
  ('poster', 'decor', 'Poster hoạt hình', 'wall', null, 1, 1, 1, 'tuoi-tho-9x', '{retro}', 150, 'market', 'thuong'),
  ('tranh-bien', 'decor', 'Tranh biển', 'wall', null, 2, 1, 1, 'bien', '{}', 260, 'market', 'thuong'),
  ('dong-ho-treo', 'decor', 'Đồng hồ gỗ', 'wall', null, 1, 1, 1, 'go-moc', '{}', 200, 'market', 'thuong'),
  ('ke-treo', 'decor', 'Kệ treo tường', 'wall', null, 2, 1, 1, 'go-moc', '{sach}', 160, 'market', 'thuong'),
  ('to-chim', 'decor', 'Tổ chim', 'wall', null, 1, 1, 1, 'rung', '{cay}', 140, 'market', 'thuong'),
  ('giay-cham-hong', 'decor', 'Giấy chấm hồng', 'wallpaper', null, 0, 0, 0, 'pastel', '{}', null, 'starter', 'thuong'),
  ('giay-soc-xanh', 'decor', 'Giấy sọc xanh biển', 'wallpaper', null, 0, 0, 0, 'bien', '{}', 350, 'market', 'thuong'),
  ('giay-go', 'decor', 'Ốp ván gỗ', 'wallpaper', null, 0, 0, 0, 'go-moc', '{}', 420, 'market', 'thuong'),
  ('giay-sao', 'decor', 'Giấy sao đêm', 'wallpaper', null, 0, 0, 1, null, '{sang}', 500, 'rotating', 'dep'),
  ('san-go', 'decor', 'Sàn gỗ', 'flooring', null, 0, 0, 0, 'go-moc', '{}', null, 'starter', 'thuong'),
  ('san-gach-bong', 'decor', 'Gạch bông', 'flooring', null, 0, 0, 1, 'pho-cu', '{retro}', 480, 'rotating', 'dep'),
  ('san-co', 'decor', 'Sàn cỏ', 'flooring', null, 0, 0, 1, 'rung', '{cay}', 400, 'market', 'thuong'),
  ('no-hong', 'outfit', 'Nơ hồng', null, 'head', null, null, 0, null, '{}', null, 'starter', 'thuong'),
  ('mu-len', 'outfit', 'Mũ len', null, 'head', null, null, 0, null, '{mem}', 220, 'market', 'thuong'),
  ('non-la', 'outfit', 'Nón lá mini', null, 'head', null, null, 0, null, '{}', 260, 'market', 'thuong'),
  ('mu-tiec', 'outfit', 'Mũ sinh nhật', null, 'head', null, null, 0, null, '{choi}', 180, 'market', 'thuong'),
  ('vong-hoa', 'outfit', 'Vòng hoa', null, 'head', null, null, 0, null, '{cay}', 520, 'rotating', 'dep'),
  ('kinh-tron', 'outfit', 'Kính tròn', null, 'face', null, null, 0, null, '{sach}', 240, 'market', 'thuong'),
  ('kinh-ram', 'outfit', 'Kính râm', null, 'face', null, null, 0, null, '{sang}', 300, 'market', 'thuong'),
  ('khan-quang', 'outfit', 'Khăn quàng đỏ', null, 'neck', null, null, 0, null, '{retro}', 120, 'market', 'thuong'),
  ('chuong', 'outfit', 'Chuông cổ', null, 'neck', null, null, 0, null, '{choi}', 200, 'market', 'thuong'),
  ('khan-len', 'outfit', 'Khăn len', null, 'neck', null, null, 0, null, '{mem}', 340, 'rotating', 'dep'),
  ('balo', 'outfit', 'Ba lô nhỏ', null, 'back', null, null, 0, null, '{choi}', 380, 'market', 'thuong'),
  ('canh', 'outfit', 'Cánh thiên thần', null, 'back', null, null, 0, null, '{sang}', 1200, 'weekend', 'hiem'),
  ('ao-choang', 'outfit', 'Áo choàng sao', null, 'back', null, null, 0, null, '{sang}', 950, 'weekend', 'hiem');

-- ---------- Ví xu ----------
create table public.wallets (
  owner_id      uuid primary key references auth.users (id) on delete cascade,
  coins         int  not null default 300 check (coins >= 0),
  earned_today  int  not null default 0,
  earned_day    date
);

-- ---------- Bố cục phòng (3 ô) ----------
create table public.room_layouts (
  owner_id    uuid not null references auth.users (id) on delete cascade,
  slot        int  not null check (slot between 0 and 2),
  layout      jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (owner_id, slot)
);
alter table public.profiles add column active_layout int not null default 0 check (active_layout between 0 and 2);

-- ---------- Trang phục & thoải mái trên thú ----------
alter table public.pets
  add column outfit          jsonb not null default '{}',
  add column outfit_presets  jsonb not null default '[{}, {}, {}]',
  add column comfort_level   int   not null default 1 check (comfort_level between 1 and 5);

-- ---------- Nhiệm vụ & sổ sưu tập ----------
create table public.quest_claims (
  owner_id  uuid not null references auth.users (id) on delete cascade,
  day       date not null,
  idx       int  not null check (idx between 0 and 2),
  primary key (owner_id, day, idx)
);
create table public.collection_claims (
  owner_id  uuid not null references auth.users (id) on delete cascade,
  theme     text not null,
  primary key (owner_id, theme)
);

alter table public.wallets           enable row level security;
alter table public.room_layouts      enable row level security;
alter table public.quest_claims      enable row level security;
alter table public.collection_claims enable row level security;
create policy "wallets: đọc của mình"      on public.wallets           for select to authenticated using ((select auth.uid()) = owner_id);
create policy "layouts: đọc của mình"      on public.room_layouts      for select to authenticated using ((select auth.uid()) = owner_id);
create policy "quests: đọc của mình"       on public.quest_claims      for select to authenticated using ((select auth.uid()) = owner_id);
create policy "collections: đọc của mình"  on public.collection_claims for select to authenticated using ((select auth.uid()) = owner_id);

-- =====================================================================
-- Hàm nội bộ
-- =====================================================================
create or replace function private.day_number(d date) returns int language sql immutable as $$ select d - date '1970-01-01' $$;
create or replace function private.is_weekend(d date) returns boolean language sql immutable as $$ select extract(isodow from d) in (6, 7) $$;

-- 6 món tiệm xoay vòng của ngày — cùng công thức với rotationForDay() ở client
create or replace function private.rotation(d date) returns text[]
language sql stable security definer set search_path = '' as $$
  with pool as (select array_agg(id order by id collate "C") a from public.items where source = 'rotating' and active)
  select array(select a[1 + ((private.day_number(d) * 7 + k) % cardinality(a))] from pool, generate_series(0, least(5, cardinality(a) - 1)) k)
$$;

create or replace function private.ensure_wallet(uid uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.wallets (owner_id) values (uid) on conflict do nothing
$$;

-- Cộng xu. capped = true thì tính vào trần xu chăm sóc mỗi ngày (50).
create or replace function private.earn(uid uuid, amount int, capped boolean) returns int
language plpgsql security definer set search_path = '' as $$
declare d date := private.local_day(uid); w public.wallets; got int;
begin
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.earned_day is distinct from d then w.earned_today := 0; end if;
  got := case when capped then greatest(0, least(amount, 50 - w.earned_today)) else amount end;
  update public.wallets set coins = coins + got, earned_today = w.earned_today + (case when capped then got else 0 end), earned_day = d where owner_id = uid;
  return got;
end $$;

create or replace function private.owns(uid uuid, item text, n int default 1) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select qty from public.entitlements where owner_id = uid and item_id = item), 0) >= n
$$;

-- Cấp thoải mái từ bố cục — cùng công thức với comfortScore()/comfortLevel() ở client
create or replace function private.comfort_level(lay jsonb) returns int
language sql stable security definer set search_path = '' as $$
  with ids as (
    select lay ->> 'wallpaper' id union all select lay ->> 'flooring'
    union all select e ->> 'id' from jsonb_array_elements(coalesce(lay -> 'items', '[]')) e
  ), numbered as (select id, row_number() over (partition by id) n from ids)
  select case when s >= 30 then 5 when s >= 20 then 4 when s >= 12 then 3 when s >= 6 then 2 else 1 end
  from (select coalesce(sum(i.comfort), 0) s from numbered x join public.items i on i.id = x.id where x.n <= 2) t
$$;

-- Kiểm tra bố cục: vật phẩm đúng loại, đủ số lượng sở hữu, nằm trong lưới 8×6 (tường 8×3).
-- Chồng nhau và lối đi do client kiểm tra (layout.ts); server chặn gian lận về sở hữu và kích thước.
create or replace function private.check_layout(uid uuid, lay jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare e jsonb; it public.items; c int; r int; rot int; w int; dd int; rec record;
begin
  if jsonb_typeof(lay -> 'items') is distinct from 'array' or jsonb_array_length(lay -> 'items') > 80 then raise exception 'invalid_layout'; end if;
  if not exists (select 1 from public.items where id = lay ->> 'wallpaper' and layer = 'wallpaper') or not private.owns(uid, lay ->> 'wallpaper')
     or not exists (select 1 from public.items where id = lay ->> 'flooring' and layer = 'flooring') or not private.owns(uid, lay ->> 'flooring') then
    raise exception 'not_owned';
  end if;
  for e in select * from jsonb_array_elements(lay -> 'items') loop
    select * into it from public.items where id = e ->> 'id' and kind = 'decor' and layer in ('floor', 'rug', 'wall');
    if it.id is null then raise exception 'invalid_layout'; end if;
    c := (e ->> 'c')::int; r := (e ->> 'r')::int; rot := coalesce((e ->> 'rot')::int, 0) % 4;
    w := case when it.layer <> 'wall' and rot % 2 = 1 then it.d else it.w end;
    dd := case when it.layer <> 'wall' and rot % 2 = 1 then it.w else it.d end;
    if c < 0 or r < 0 or c + w > 8 or r + dd > (case when it.layer = 'wall' then 3 else 6 end) then raise exception 'invalid_layout'; end if;
  end loop;
  for rec in select x ->> 'id' id, count(*)::int n from jsonb_array_elements(lay -> 'items') x group by 1 loop
    if not private.owns(uid, rec.id, rec.n) then raise exception 'not_owned'; end if;
  end loop;
end $$;

create or replace function private.check_outfit(uid uuid, o jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare k text; v text;
begin
  if jsonb_typeof(o) <> 'object' then raise exception 'invalid_outfit'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(o) loop
    if k not in ('head', 'face', 'neck', 'back') then raise exception 'invalid_outfit'; end if;
    if v is not null and (not exists (select 1 from public.items where id = v and kind = 'outfit' and slot = k) or not private.owns(uid, v)) then
      raise exception 'not_owned';
    end if;
  end loop;
end $$;

-- Giảm chỉ số, có tính cấp thoải mái (cùng công thức với decayStats() ở client)
create or replace function private.decay_pet(pid uuid) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare p public.pets; mins double precision; k double precision;
begin
  select * into p from public.pets where id = pid for update;
  mins := least(extract(epoch from (now() - p.stats_at)) / 60.0, 4320);
  k := 0.05 * (p.comfort_level - 1);
  if mins > 0 then
    update public.pets set
      no   = private.clamp((no   - mins * 0.9)::real),
      vui  = private.clamp((vui  - mins * 0.5 * (1 - k))::real),
      sach = private.clamp((sach - mins * 0.35)::real),
      nl   = private.clamp((case when asleep then nl + mins * 3 * (1 + k) else nl - mins * 0.45 * (1 - k) end)::real),
      stats_at = now()
    where id = pid
    returning * into p;
  end if;
  return p;
end $$;

-- =====================================================================
-- RPC
-- =====================================================================
create or replace function public.create_pet(p_name text, p_family text, p_egg int) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.pets; foods text[]; tags text[]; lay jsonb := '{"wallpaper":"giay-cham-hong","flooring":"san-go","items":[{"id":"tham-tron","c":2,"r":2,"rot":0},{"id":"o-rom","c":0,"r":0,"rot":0},{"id":"chau-cay","c":7,"r":0,"rot":0},{"id":"bong","c":6,"r":4,"rot":0}]}'::jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if private.active_pet_id(uid) is not null then raise exception 'pet_exists'; end if;
  p_name := btrim(p_name); p_family := btrim(p_family);
  if char_length(p_name) not between 1 and 16 or char_length(p_family) not between 1 and 16 then raise exception 'invalid_name'; end if;
  if p_egg not between 0 and 2 then raise exception 'invalid_egg'; end if;

  select array_agg(t order by random()) into tags from unnest(array['mem', 'sach', 'cay', 'choi', 'sang', 'retro']) t;
  insert into public.pets (owner_id, name, family_name, genes)
  values (uid, p_name, p_family, jsonb_build_object(
    'palette', p_egg, 'ear', floor(random() * 4)::int, 'sprout', floor(random() * 3)::int,
    'scale', round((0.95 + random() * 0.1)::numeric, 3),
    'likes', jsonb_build_array(tags[1], tags[2]), 'dislike', tags[3]))
  returning * into p;

  select array_agg(id order by random()) into foods from public.items where kind = 'food' and active;
  insert into public.pet_secrets (pet_id, lifespan_days, favorite_food, disliked_food)
  values (p.id, 30 + floor(random() * 31)::int, foods[1], foods[2]);

  insert into public.entitlements (owner_id, item_id, source, qty)
  select uid, id, 'starter', 1 from public.items where source = 'starter' and active
  on conflict do nothing;
  perform private.ensure_wallet(uid);
  insert into public.room_layouts (owner_id, slot, layout) values (uid, 0, lay) on conflict (owner_id, slot) do nothing;
  update public.pets set comfort_level = private.comfort_level(lay) where id = p.id returning * into p;

  perform private.remember_first(p.id, uid, 'meet', 'meet', format('Ngày đầu tiên gặp bạn. Bạn đặt tên mình là %s.', p_name));
  return p;
end $$;

create or replace function public.get_economy() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date; w public.wallets;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform private.ensure_wallet(uid);
  d := private.local_day(uid);
  select * into w from public.wallets where owner_id = uid;
  return jsonb_build_object('coins', w.coins, 'earned_today', case when w.earned_day = d then w.earned_today else 0 end,
    'day', d, 'rotation', to_jsonb(private.rotation(d)), 'weekend', private.is_weekend(d));
end $$;

create or replace function public.buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); it public.items; d date; w public.wallets; q int;
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
  perform private.ensure_wallet(uid);
  select * into w from public.wallets where owner_id = uid for update;
  if w.coins < it.price_coins then raise exception 'not_enough_coins'; end if;
  update public.wallets set coins = coins - it.price_coins where owner_id = uid returning * into w;
  insert into public.entitlements (owner_id, item_id, source, qty) values (uid, it.id, 'coins', 1)
  on conflict (owner_id, item_id) do update set qty = public.entitlements.qty + 1
  returning qty into q;
  return jsonb_build_object('coins', w.coins, 'qty', q);
end $$;

create or replace function public.save_room_layout(p_slot int, p_layout jsonb, p_activate boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid; lvl int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_slot not between 0 and 2 then raise exception 'invalid_layout'; end if;
  perform private.check_layout(uid, p_layout);
  insert into public.room_layouts (owner_id, slot, layout, updated_at) values (uid, p_slot, p_layout, now())
  on conflict (owner_id, slot) do update set layout = excluded.layout, updated_at = now();
  lvl := private.comfort_level(p_layout);
  if p_activate then
    update public.profiles set active_layout = p_slot where id = uid;
    pid := private.active_pet_id(uid);
    if pid is not null then perform private.decay_pet(pid); update public.pets set comfort_level = lvl where id = pid; end if;
  end if;
  return jsonb_build_object('comfort_level', lvl);
end $$;

create or replace function public.equip_outfit(p_outfit jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); o jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform private.check_outfit(uid, p_outfit);
  o := jsonb_strip_nulls(p_outfit);
  update public.pets set outfit = o where id = private.active_pet_id(uid);
  return o;
end $$;

create or replace function public.save_outfit_preset(p_idx int, p_outfit jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if p_idx not between 0 and 2 then raise exception 'invalid_outfit'; end if;
  perform private.check_outfit(uid, p_outfit);
  update public.pets set outfit_presets = jsonb_set(outfit_presets, array[p_idx::text], jsonb_strip_nulls(p_outfit)) where id = private.active_pet_id(uid);
end $$;

-- Nhiệm vụ ngày — cùng bộ với QUEST_POOL/questsForDay() ở client
create or replace function public.get_quests() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date; n int; pid uuid; dl public.day_logs;
  keys text[] := array['fed', 'bath', 'ball', 'pet', 'talk', 'sleep']; targets int[] := array[2, 1, 3, 20, 2, 1]; res jsonb := '[]'; i int; q int; prog int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  d := private.local_day(uid); n := private.day_number(d); pid := private.active_pet_id(uid);
  select * into dl from public.day_logs where pet_id = pid and day = d;
  for i in 0..2 loop
    q := (n + i * 2) % 6;
    prog := coalesce((to_jsonb(dl) ->> keys[q + 1])::int, 0);
    res := res || jsonb_build_object('idx', i, 'quest', q, 'progress', prog, 'target', targets[q + 1],
      'claimed', exists (select 1 from public.quest_claims where owner_id = uid and day = d and idx = i));
  end loop;
  return res;
end $$;

create or replace function public.claim_quest(p_idx int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); qs jsonb; q jsonb; d date;
begin
  qs := public.get_quests(); q := qs -> p_idx; d := private.local_day(uid);
  if q is null then raise exception 'invalid_quest'; end if;
  if (q ->> 'progress')::int < (q ->> 'target')::int then raise exception 'quest_not_done'; end if;
  insert into public.quest_claims (owner_id, day, idx) values (uid, d, p_idx) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  perform private.earn(uid, 30, false);
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid));
end $$;

create or replace function public.claim_collection(p_theme text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); missing int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_theme = 'le-hoi' or not exists (select 1 from public.items where theme = p_theme) then raise exception 'invalid_theme'; end if;
  select count(*) into missing from public.items i where i.theme = p_theme and i.active and not private.owns(uid, i.id);
  if missing > 0 then raise exception 'collection_incomplete'; end if;
  insert into public.collection_claims (owner_id, theme) values (uid, p_theme) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  perform private.earn(uid, 150, false);
  perform private.remember_first(private.active_pet_id(uid), uid, 'collection-' || p_theme, 'milestone',
    format('Tụi mình sưu tập đủ bộ %s rồi!', case p_theme when 'go-moc' then 'Gỗ mộc' when 'pastel' then 'Pastel' when 'tuoi-tho-9x' then 'Tuổi thơ 9x'
      when 'rung' then 'Rừng' when 'bien' then 'Biển' when 'pho-cu' then 'Phố cũ' else p_theme end));
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid));
end $$;

-- Hành động chăm sóc: như cũ, thêm xu (5 xu mỗi lần chăm sóc thành công, tối đa 50 xu/ngày)
create or replace function public.pet_action(p_action text, p_item text default null, p_count int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); pid uuid; p public.pets; s public.pet_secrets; it public.items;
  n int := greatest(1, least(coalesce(p_count, 1), 20));
  d date; refused text := null; fav boolean := false; recent int; first_new boolean := false; earned int := 0;
  dno real := 0; dvui real := 0; dnl real := 0; dsach real := 0;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  pid := private.active_pet_id(uid);
  if pid is null then raise exception 'no_pet'; end if;

  select count(*) into recent from public.action_log where pet_id = pid and created_at > now() - interval '10 seconds';
  if recent >= 30 then raise exception 'rate_limited'; end if;

  p := private.decay_pet(pid);
  select * into s from public.pet_secrets where pet_id = pid;
  d := private.local_day(uid);
  insert into public.day_logs (pet_id, owner_id, day) values (pid, uid, d) on conflict do nothing;

  if p.asleep and p_action not in ('wake', 'pet') then
    refused := 'asleep';
  elsif p_action = 'feed' then
    select * into it from public.items where id = p_item and kind = 'food' and active;
    if it.id is null then raise exception 'unknown_item'; end if;
    if not private.owns(uid, it.id) then raise exception 'not_owned'; end if;
    if p.no >= 90 then refused := 'full';
    else
      fav := (it.id = s.favorite_food);
      dno := (it.effects ->> 'no')::real; dvui := (it.effects ->> 'vui')::real + (case when fav then 10 else 0 end);
      if it.id = s.disliked_food then dvui := dvui - 6; end if;
      dsach := -2;
      update public.day_logs set fed = fed + 1, foods = array_append(foods, it.name) where pet_id = pid and day = d;
      first_new := private.remember_first(pid, uid, 'food-' || it.id, 'food',
        case when fav then format('Lần đầu ăn %s, hoá ra là món tủ của mình!', it.name) else format('Lần đầu được ăn %s.', it.name) end);
    end if;
  elsif p_action = 'pet' then
    dvui := 1.6 * n;
    update public.day_logs set pet = pet + n where pet_id = pid and day = d;
  elsif p_action = 'bath_scrub' then
    dsach := 3 * n;
  elsif p_action = 'bath_rinse' then
    dsach := 100; dvui := 4;
    update public.day_logs set bath = bath + 1 where pet_id = pid and day = d;
    first_new := private.remember_first(pid, uid, 'bath', 'bath', 'Lần đầu được tắm bồn với vịt cao su.');
  elsif p_action in ('play_ball', 'play_spin') then
    if p.nl < 15 then refused := 'tired';
    else
      dvui := case when p_action = 'play_ball' then 8 else 6 end; dnl := -4; dno := -2;
      if p_action = 'play_ball' then
        update public.day_logs set ball = ball + 1 where pet_id = pid and day = d;
        first_new := private.remember_first(pid, uid, 'ball', 'play', 'Lần đầu chơi ném bóng ngoài vườn.');
      end if;
    end if;
  elsif p_action = 'talk' then
    dvui := 2;
    update public.day_logs set talk = talk + 1 where pet_id = pid and day = d;
  elsif p_action = 'sleep' then
    update public.pets set asleep = true where id = pid;
    update public.day_logs set sleep = sleep + 1 where pet_id = pid and day = d;
  elsif p_action = 'wake' then
    update public.pets set asleep = false where id = pid;
  else
    raise exception 'unknown_action';
  end if;

  if refused is null then
    update public.pets set
      no = private.clamp(no + dno), vui = private.clamp(vui + dvui), nl = private.clamp(nl + dnl),
      sach = case when p_action = 'bath_rinse' then 100 else private.clamp(sach + dsach) end,
      bond_xp = bond_xp + 1
    where id = pid;
    insert into public.action_log (pet_id, action) values (pid, p_action);
    if p_action in ('feed', 'bath_rinse', 'play_ball', 'play_spin', 'talk', 'sleep') then
      earned := private.earn(uid, 5, true);
    end if;
  end if;

  select * into p from public.pets where id = pid;
  return jsonb_build_object('pet', to_jsonb(p), 'refused', refused, 'fav', fav, 'new_memory', first_new,
    'earned', earned, 'coins', (select coins from public.wallets where owner_id = uid));
end $$;

-- ---------- Quyền thực thi ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.create_pet(text, text, int), public.pet_action(text, text, int), public.get_economy(), public.buy_item(text),
  public.save_room_layout(int, jsonb, boolean), public.equip_outfit(jsonb), public.save_outfit_preset(int, jsonb),
  public.get_quests(), public.claim_quest(int), public.claim_collection(text) from public, anon;
grant execute on function public.create_pet(text, text, int), public.pet_action(text, text, int), public.get_economy(), public.buy_item(text),
  public.save_room_layout(int, jsonb, boolean), public.equip_outfit(jsonb), public.save_outfit_preset(int, jsonb),
  public.get_quests(), public.claim_quest(int), public.claim_collection(text) to authenticated;

-- ---------- Chuyển dữ liệu cho người chơi đã có thú ----------
insert into public.wallets (owner_id) select id from public.profiles on conflict do nothing;
insert into public.entitlements (owner_id, item_id, source, qty)
  select p.owner_id, i.id, 'starter', 1 from public.pets p cross join public.items i where i.source = 'starter' and i.active
  on conflict do nothing;
insert into public.room_layouts (owner_id, slot, layout)
  select distinct owner_id, 0, '{"wallpaper":"giay-cham-hong","flooring":"san-go","items":[{"id":"tham-tron","c":2,"r":2,"rot":0},{"id":"o-rom","c":0,"r":0,"rot":0},{"id":"chau-cay","c":7,"r":0,"rot":0},{"id":"bong","c":6,"r":4,"rot":0}]}'::jsonb from public.pets on conflict do nothing;
update public.pets set comfort_level = private.comfort_level('{"wallpaper":"giay-cham-hong","flooring":"san-go","items":[{"id":"tham-tron","c":2,"r":2,"rot":0},{"id":"o-rom","c":0,"r":0,"rot":0},{"id":"chau-cay","c":7,"r":0,"rot":0},{"id":"bong","c":6,"r":4,"rot":0}]}'::jsonb);
update public.pets set genes = genes || '{"likes": ["mem", "cay"], "dislike": "retro"}'::jsonb where not genes ? 'likes';
