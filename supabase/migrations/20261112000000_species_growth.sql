-- =====================================================================
-- Hatchday · Giai đoạn 6: 50 loài thú, lớn lên theo tuổi, dáng trưởng thành, Sổ loài
-- Luật giống src/game/species.ts (test supabase/tests/species.test.ts so khớp).
-- =====================================================================

-- ---------- Loài ----------
create table public.species (
  id      text primary key,
  name    text not null,
  region  int  not null check (region between 0 and 4),
  rarity  text not null check (rarity in ('thuong', 'hiem', 'quy', 'huyen')),
  weight  int  not null check (weight > 0)
);
alter table public.species enable row level security;
create policy species_read on public.species for select to authenticated using (true);

-- Sinh bằng: node --experimental-strip-types scripts/gen-seed.ts
insert into public.species (id, name, region, rarity, weight) values
  ('mam-xanh', 'Mầm Xanh', 0, 'thuong', 8),
  ('bong-lua', 'Bông Lúa', 0, 'thuong', 8),
  ('ong-mat', 'Ong Mật', 0, 'thuong', 8),
  ('co-may', 'Cỏ May', 0, 'thuong', 8),
  ('hoa-mai', 'Hoa Mai', 0, 'hiem', 4),
  ('chuon-chuon', 'Chuồn Chuồn', 0, 'hiem', 4),
  ('de-co', 'Dế Cỏ', 0, 'hiem', 4),
  ('sen-hong', 'Sen Hồng', 0, 'quy', 2),
  ('nai-co', 'Nai Cỏ', 0, 'quy', 2),
  ('lan-vang', 'Lân Vàng', 0, 'huyen', 1),
  ('ca-bong', 'Cá Bống', 1, 'thuong', 8),
  ('oc-gao', 'Ốc Gạo', 1, 'thuong', 8),
  ('giot-mua', 'Giọt Mưa', 1, 'thuong', 8),
  ('tom-tit', 'Tôm Tít', 1, 'thuong', 8),
  ('rua-dam', 'Rùa Đầm', 1, 'hiem', 4),
  ('sua-bien', 'Sứa Biển', 1, 'hiem', 4),
  ('rai-ca', 'Rái Cá', 1, 'hiem', 4),
  ('ca-heo-hong', 'Cá Heo Hồng', 1, 'quy', 2),
  ('ngoc-trai', 'Ngọc Trai', 1, 'quy', 2),
  ('long-thuy', 'Long Thuỷ', 1, 'huyen', 1),
  ('bong-may', 'Bông Mây', 2, 'thuong', 8),
  ('se-nau', 'Sẻ Nâu', 2, 'thuong', 8),
  ('dieu-giay', 'Diều Giấy', 2, 'thuong', 8),
  ('gio-nhe', 'Gió Nhẹ', 2, 'thuong', 8),
  ('cau-vong', 'Cầu Vồng', 2, 'hiem', 4),
  ('hai-au', 'Hải Âu', 2, 'hiem', 4),
  ('sao-bang', 'Sao Băng', 2, 'hiem', 4),
  ('may-ngu-sac', 'Mây Ngũ Sắc', 2, 'quy', 2),
  ('hac-trang', 'Hạc Trắng', 2, 'quy', 2),
  ('chim-lac', 'Chim Lạc', 2, 'huyen', 1),
  ('nam-ngu', 'Nấm Ngủ', 3, 'thuong', 8),
  ('dom-dom', 'Đom Đóm', 3, 'thuong', 8),
  ('cu-meo', 'Cú Mèo', 3, 'thuong', 8),
  ('doi-nho', 'Dơi Nhỏ', 3, 'thuong', 8),
  ('trang-khuyet', 'Trăng Khuyết', 3, 'hiem', 4),
  ('cao-bac', 'Cáo Bạc', 3, 'hiem', 4),
  ('meo-muop', 'Mèo Mướp', 3, 'hiem', 4),
  ('ma-troi', 'Ma Trơi', 3, 'quy', 2),
  ('huou-sao', 'Hươu Sao', 3, 'quy', 2),
  ('tho-ngoc', 'Thỏ Ngọc', 3, 'huyen', 1),
  ('banh-bo', 'Bánh Bò', 4, 'thuong', 8),
  ('xoi-gac', 'Xôi Gấc', 4, 'thuong', 8),
  ('che-ba-mau', 'Chè Ba Màu', 4, 'thuong', 8),
  ('banh-troi', 'Bánh Trôi', 4, 'thuong', 8),
  ('banh-flan', 'Bánh Flan', 4, 'hiem', 4),
  ('tra-sua', 'Trà Sữa', 4, 'hiem', 4),
  ('banh-bao', 'Bánh Bao', 4, 'hiem', 4),
  ('banh-trung-thu', 'Bánh Trung Thu', 4, 'quy', 2),
  ('keo-bong-gon', 'Kẹo Bông Gòn', 4, 'quy', 2),
  ('lua-bep', 'Lửa Bếp', 4, 'huyen', 1);

-- ---------- Thú: loài, giai đoạn mới, dáng trưởng thành ----------
alter table public.pets drop constraint if exists pets_stage_check;
alter table public.pets add constraint pets_stage_check check (stage in ('egg', 'baby', 'child', 'teen', 'adult', 'elder', 'departed'));
alter table public.pets add column species text references public.species (id);
alter table public.pets add column form text check (form in ('tron', 'nhanh', 'thuong', 'sang'));

-- ---------- Sổ loài: các loài người chơi đã từng nuôi ----------
create table public.species_seen (
  owner_id    uuid not null references auth.users (id) on delete cascade,
  species_id  text not null references public.species (id),
  first_at    timestamptz not null default now(),
  forms       text[] not null default '{}',
  primary key (owner_id, species_id)
);
alter table public.species_seen enable row level security;
create policy species_seen_own on public.species_seen for select to authenticated using (owner_id = (select auth.uid()));

-- ---------- Luật ----------
/** Chọn loài theo trọng số trong miền, r ∈ [0, 1). Giống pickSpecies() ở client. */
create or replace function private.pick_species(p_region int, r double precision) returns text
language sql stable set search_path = '' as $$
  with pool as (
    select id, sum(weight) over (order by id collate "C") as acc, sum(weight) over () as total
    from public.species where region = p_region)
  select coalesce(
    (select id from pool where r * total < acc order by acc limit 1),
    (select id from pool order by id collate "C" desc limit 1))
$$;

create or replace function private.stage_for(days double precision, lifespan int) returns text
language sql immutable set search_path = '' as $$
  select case when days >= lifespan - 5 then 'elder' when days >= 14 then 'adult'
              when days >= 7 then 'teen' when days >= 2 then 'child' else 'baby' end
$$;

/** Dáng trưởng thành theo kiểu chăm (cộng dồn day_logs). Hoà thì ưu tiên Tình Cảm. Giống formFromCare(). */
create or replace function private.form_for(fed numeric, ball numeric, pet numeric, talk numeric, bath numeric) returns text
language plpgsql immutable set search_path = '' as $$
declare best text := 'thuong'; bs numeric := pet / 20.0 + talk / 2.0;
begin
  if fed / 3.0 > bs + 1e-9 then best := 'tron'; bs := fed / 3.0; end if;
  if ball / 3.0 > bs + 1e-9 then best := 'nhanh'; bs := ball / 3.0; end if;
  if bath > bs + 1e-9 then best := 'sang'; end if;
  return best;
end $$;

create or replace function private.grow_memory(st text, f text) returns text
language sql immutable set search_path = '' as $$
  select case st
    when 'child' then 'Mình lớn thành bé Nhí rồi, vỏ trứng trên đầu rơi mất tiêu!'
    when 'teen' then 'Mình đã là Thiếu niên, ra dáng lắm rồi nha.'
    when 'adult' then format('Mình trưởng thành rồi, thành dáng %s vì %s.',
      case coalesce(f, 'thuong') when 'tron' then 'Phúng Phính' when 'nhanh' then 'Lanh Lợi' when 'sang' then 'Lấp Lánh' else 'Tình Cảm' end,
      case coalesce(f, 'thuong') when 'tron' then 'được ăn ngon' when 'nhanh' then 'được chơi nhiều' when 'sang' then 'được tắm rửa sạch sẽ' else 'được vuốt ve, trò chuyện' end)
    when 'elder' then 'Mình bước vào tuổi xế chiều. Mình muốn ở bên bạn thật nhiều.'
    else 'Mình vừa chào đời.' end
$$;

/** Cập nhật giai đoạn theo tuổi; khi vào Trưởng thành thì chốt dáng. Tuổi thọ vẫn chỉ server biết. */
create or replace function private.grow_pet(pid uuid) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare p public.pets; life int; st text; f text; s record;
begin
  select * into p from public.pets where id = pid for update;
  if p.stage = 'departed' then return p; end if;
  select lifespan_days into life from public.pet_secrets where pet_id = pid;
  st := private.stage_for(extract(epoch from now() - p.born_at) / 86400.0, coalesce(life, 45));
  if st = p.stage then return p; end if;
  f := p.form;
  if st in ('adult', 'elder') and f is null then
    select coalesce(sum(fed), 0) as fed, coalesce(sum(ball), 0) as ball, coalesce(sum(d.pet), 0) as pet,
           coalesce(sum(talk), 0) as talk, coalesce(sum(bath), 0) as bath into s
    from public.day_logs d where d.pet_id = pid;
    f := private.form_for(s.fed, s.ball, s.pet, s.talk, s.bath);
    update public.species_seen set forms = array_append(forms, f)
      where owner_id = p.owner_id and species_id = p.species and not (f = any (forms));
  end if;
  update public.pets set stage = st, form = f where id = pid returning * into p;
  perform private.remember_first(pid, p.owner_id, 'grow-' || st, 'milestone', private.grow_memory(st, f));
  return p;
end $$;

-- ---------- RPC ----------
create or replace function public.get_my_pet() returns public.pets
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  pid := private.active_pet_id(uid);
  if pid is null then return null; end if;
  perform private.decay_pet(pid);
  return private.grow_pet(pid);
end $$;

/** p_egg là miền của quả trứng (0–4). Loài được bốc ngẫu nhiên theo độ hiếm, trên server. */
create or replace function public.create_pet(p_name text, p_family text, p_egg int) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.pets; foods text[]; tags text[]; sp text; sp_name text;
  lay jsonb := '{"wallpaper":"giay-cham-hong","flooring":"san-go","items":[{"id":"tham-tron","c":2,"r":2,"rot":0},{"id":"o-rom","c":0,"r":0,"rot":0},{"id":"chau-cay","c":7,"r":0,"rot":0},{"id":"bong","c":6,"r":4,"rot":0}]}'::jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if private.active_pet_id(uid) is not null then raise exception 'pet_exists'; end if;
  p_name := btrim(p_name); p_family := btrim(p_family);
  if char_length(p_name) not between 1 and 16 or char_length(p_family) not between 1 and 16 then raise exception 'invalid_name'; end if;
  if p_egg is null or p_egg not between 0 and 4 then raise exception 'invalid_egg'; end if;

  sp := private.pick_species(p_egg, random());
  select name into sp_name from public.species where id = sp;
  select array_agg(t order by random()) into tags from unnest(array['mem', 'sach', 'cay', 'choi', 'sang', 'retro']) t;
  insert into public.pets (owner_id, name, family_name, species, genes)
  values (uid, p_name, p_family, sp, jsonb_build_object(
    'region', p_egg, 'ear', floor(random() * 4)::int,
    'scale', round((0.96 + random() * 0.08)::numeric, 3), 'hue', round((random() * 2 - 1)::numeric, 2),
    'likes', jsonb_build_array(tags[1], tags[2]), 'dislike', tags[3]))
  returning * into p;

  select array_agg(id order by random()) into foods from public.items where kind = 'food' and active;
  insert into public.pet_secrets (pet_id, lifespan_days, favorite_food, disliked_food)
  values (p.id, 30 + floor(random() * 31)::int, foods[1], foods[2]);

  insert into public.species_seen (owner_id, species_id) values (uid, sp) on conflict do nothing;
  insert into public.entitlements (owner_id, item_id, source, qty)
  select uid, id, 'starter', 1 from public.items where source = 'starter' and active
  on conflict do nothing;
  perform private.ensure_wallet(uid);
  insert into public.room_layouts (owner_id, slot, layout) values (uid, 0, lay) on conflict (owner_id, slot) do nothing;
  update public.pets set comfort_level = private.comfort_level(lay) where id = p.id returning * into p;

  perform private.remember_first(p.id, uid, 'meet', 'meet', format('Ngày đầu tiên gặp bạn. Mình là một bé %s, bạn đặt tên mình là %s.', sp_name, p_name));
  return p;
end $$;

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_my_pet(), public.create_pet(text, text, int) from public, anon;
grant execute on function public.get_my_pet(), public.create_pet(text, text, int) to authenticated;
grant select on public.species, public.species_seen to authenticated;

-- ---------- Chuyển dữ liệu: thú cũ nhận loài theo quả trứng đã chọn ----------
update public.pets set species = private.pick_species(least(greatest(coalesce((genes ->> 'palette')::int, 0), 0), 4), random()),
  genes = genes || jsonb_build_object('region', least(greatest(coalesce((genes ->> 'palette')::int, 0), 0), 4), 'hue', 0)
  where species is null;
insert into public.species_seen (owner_id, species_id, first_at)
  select owner_id, species, born_at from public.pets on conflict do nothing;
alter table public.pets alter column species set not null;
