-- =====================================================================
-- Hatchday — Vòng đời và gia phả
-- Bé sống 30–60 ngày (tuổi thọ ẩn trong pet_secrets). Hết tuổi thọ thì chia tay: stage = 'departed', ghi ngày đi và số ngày đã sống.
-- Người chơi đón một quả trứng đời sau (hatch_heir): giữ tên dòng họ, đời + 1, thừa hưởng một phần cá tính và gen.
--
-- Luật ở hai nơi: src/game/lineage.ts (blendPersonality, pickHeirSpecies, hằng số) và migration này. Test: supabase/tests/lifecycle.test.ts.
--
-- Hàm viết lại nguyên cả hàm, đã đối chiếu với bản mới nhất trên main:
--   private.grow_pet (thêm nhánh chia tay khi hết tuổi thọ; phần lớn lên giữ nguyên).
-- create_pet, get_my_pet, pet_action KHÔNG bị viết lại: tạo thú đời sau dùng hàm riêng hatch_heir.
-- =====================================================================

alter table public.pets
  add column parent_id    uuid references public.pets (id) on delete set null,
  add column departed_at  timestamptz,
  add column lived_days   int;

-- Đã từng có thú thì chỉ được đón thú đời sau (hatch_heir, có parent_id), không tạo lại "đời 1" bằng create_pet.
create or replace function private.pet_require_heir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is null and exists (select 1 from public.pets where owner_id = new.owner_id) then
    raise exception 'heir_required';
  end if;
  return new;
end $$;
create trigger pets_require_heir before insert on public.pets for each row execute function private.pet_require_heir();

-- ---------- Luật thừa hưởng ----------
/** Trung bình hai số, làm tròn ra xa số 0 (giống Math.sign(x) * Math.round(Math.abs(x)) ở client). */
create or replace function private.blend1(x numeric, y numeric) returns int
language sql immutable set search_path = '' as $$ select round((coalesce(x, 0) + coalesce(y, 0)) / 2)::int $$;

/** Cá tính đời sau = trung bình cá tính cha mẹ lúc ra đi và một lần bốc ngẫu nhiên mới. Giống blendPersonality(). */
create or replace function private.blend_personality(a jsonb, b jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'energy', private.blend1((a ->> 'energy')::numeric, (b ->> 'energy')::numeric),
    'social', private.blend1((a ->> 'social')::numeric, (b ->> 'social')::numeric),
    'curious', private.blend1((a ->> 'curious')::numeric, (b ->> 'curious')::numeric),
    'playful', private.blend1((a ->> 'playful')::numeric, (b ->> 'playful')::numeric),
    'affection', private.blend1((a ->> 'affection')::numeric, (b ->> 'affection')::numeric))
$$;

/** Chọn miền trùng miền của bé đã đi thì có 30% nở ra đúng loài đó, còn lại bốc theo độ hiếm. Giống pickHeirSpecies(). */
create or replace function private.pick_heir_species(parent text, p_region int, r1 double precision, r2 double precision) returns text
language sql stable set search_path = '' as $$
  select case when (select region from public.species where id = parent) = p_region and r1 < 0.3 then parent
              else private.pick_species(p_region, r2) end
$$;

-- ---------- Lớn lên và chia tay ----------
/** Cập nhật giai đoạn theo tuổi; vào Trưởng thành thì chốt dáng; hết tuổi thọ thì chia tay. Tuổi thọ vẫn chỉ server biết. */
create or replace function private.grow_pet(pid uuid) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare p public.pets; life int; st text; f text; s record; days double precision;
begin
  select * into p from public.pets where id = pid for update;
  if p.stage = 'departed' then return p; end if;
  select lifespan_days into life from public.pet_secrets where pet_id = pid;
  life := coalesce(life, 45);
  days := extract(epoch from now() - p.born_at) / 86400.0;
  f := p.form;
  st := private.stage_for(days, life);

  if (st in ('adult', 'elder') or days >= life) and f is null then
    select coalesce(sum(fed), 0) as fed, coalesce(sum(ball), 0) as ball, coalesce(sum(d.pet), 0) as pet,
           coalesce(sum(talk), 0) as talk, coalesce(sum(bath), 0) as bath into s
    from public.day_logs d where d.pet_id = pid;
    f := private.form_for(s.fed, s.ball, s.pet, s.talk, s.bath);
    update public.species_seen set forms = array_append(forms, f)
      where owner_id = p.owner_id and species_id = p.species and not (f = any (forms));
  end if;

  if days >= life then
    update public.pets set stage = 'departed', form = f, departed_at = p.born_at + make_interval(secs => life * 86400.0), lived_days = life
      where id = pid returning * into p;
    perform private.remember_first(pid, p.owner_id, 'depart', 'milestone',
      format('Mình đã sống bên bạn %s ngày. Cảm ơn bạn đã thương mình, mình sẽ nhớ mãi.', life));
    return p;
  end if;

  if st = p.stage then return p; end if;
  update public.pets set stage = st, form = f where id = pid returning * into p;
  perform private.remember_first(pid, p.owner_id, 'grow-' || st, 'milestone', private.grow_memory(st, f));
  return p;
end $$;

-- ---------- Đón thú đời sau ----------
/** Đón quả trứng đời sau của bé đã đi. Giữ tên dòng họ, đời + 1. Thừa hưởng: cá tính (trung bình với một lần bốc mới),
 *  tai, nửa sắc độ, sở thích đồ trang trí đầu tiên, và 50% món tủ. Loài: xem pick_heir_species. */
create or replace function public.hatch_heir(p_name text, p_egg int) returns public.pets
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); par public.pets; p public.pets; sp text; sp_name text; pl text; tags text[]; like1 text; like2 text; dis text;
  fav text; pfav text; lay jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if private.active_pet_id(uid) is not null then raise exception 'pet_exists'; end if;
  select * into par from public.pets where owner_id = uid and stage = 'departed' order by generation desc, born_at desc limit 1;
  if par.id is null then raise exception 'no_parent'; end if;
  p_name := btrim(p_name);
  if char_length(p_name) not between 1 and 16 then raise exception 'invalid_name'; end if;
  if p_egg is null or p_egg not between 0 and 4 then raise exception 'invalid_egg'; end if;

  sp := private.pick_heir_species(par.species, p_egg, random(), random());
  select name into sp_name from public.species where id = sp;
  pl := par.genes -> 'likes' ->> 0;
  select array_agg(t order by random()) into tags from unnest(array['mem', 'sach', 'cay', 'choi', 'sang', 'retro']) t where t is distinct from pl;
  like1 := coalesce(pl, tags[1]); like2 := case when pl is null then tags[2] else tags[1] end; dis := case when pl is null then tags[3] else tags[2] end;

  insert into public.pets (owner_id, name, family_name, generation, species, parent_id, genes, personality)
  values (uid, p_name, par.family_name, par.generation + 1, sp, par.id, jsonb_build_object(
    'region', p_egg, 'ear', coalesce((par.genes ->> 'ear')::int, floor(random() * 4)::int),
    'scale', round((0.96 + random() * 0.08)::numeric, 3),
    'hue', round((coalesce((par.genes ->> 'hue')::numeric, 0) * 0.5 + (random() * 2 - 1) * 0.5)::numeric, 2),
    'likes', jsonb_build_array(like1, like2), 'dislike', dis),
    private.blend_personality(par.personality, private.roll_personality()))
  returning * into p;

  select favorite_food into pfav from public.pet_secrets where pet_id = par.id;
  select id into fav from public.items where kind = 'food' and active order by random() limit 1;
  if pfav is not null and random() < 0.5 then fav := pfav; end if;
  insert into public.pet_secrets (pet_id, lifespan_days, favorite_food, disliked_food)
  values (p.id, 30 + floor(random() * 31)::int, fav,
    (select id from public.items where kind = 'food' and active and id <> fav order by random() limit 1));

  insert into public.species_seen (owner_id, species_id) values (uid, sp) on conflict do nothing;
  perform private.ensure_wallet(uid);
  select rl.layout into lay from public.room_layouts rl join public.profiles pr on pr.id = rl.owner_id
    where rl.owner_id = uid and rl.slot = pr.active_layout;
  if lay is not null then update public.pets set comfort_level = private.comfort_level(lay) where id = p.id returning * into p; end if;

  perform private.remember_first(p.id, uid, 'meet', 'meet',
    format('Mình là một bé %s, đời thứ %s của %s. Mình nghe kể về %s nhiều lắm.', sp_name, p.generation, par.family_name, par.name));
  return p;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.hatch_heir(text, int) from public, anon;
grant execute on function public.hatch_heir(text, int) to authenticated;
