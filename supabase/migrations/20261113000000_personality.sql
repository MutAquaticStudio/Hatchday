-- =====================================================================
-- Cá tính 5 trục (energy, social, curious, playful, affection), mỗi trục -100..100.
-- Bản TypeScript song song: src/game/personality.ts. Test: supabase/tests/personality.test.ts.
--
-- Không viết lại create_pet hay pet_action. Dùng hai trigger:
--   1. Trước khi thêm thú: cá tính còn mặc định (toàn 0) thì bốc ngẫu nhiên trong [-50, 50].
--      Thú đời sau (vòng đời, làm sau) có thể truyền sẵn cá tính thừa hưởng, trigger sẽ giữ nguyên.
--   2. Sau mỗi dòng action_log (pet_action chỉ ghi khi hành động thành công): dịch cá tính một chút.
-- =====================================================================

/** Bốc cá tính lúc sinh. Giống rollPersonality(). */
create or replace function private.roll_personality() returns jsonb
language sql volatile set search_path = '' as $$
  select jsonb_build_object(
    'energy', floor(random() * 101)::int - 50, 'social', floor(random() * 101)::int - 50,
    'curious', floor(random() * 101)::int - 50, 'playful', floor(random() * 101)::int - 50,
    'affection', floor(random() * 101)::int - 50)
$$;

/** Độ dịch của mỗi hành động. Giống DRIFT trong personality.ts. */
create or replace function private.personality_drift(act text) returns jsonb
language sql immutable set search_path = '' as $$
  select case act
    when 'pet' then '{"affection":0.4}'
    when 'talk' then '{"social":0.6,"curious":0.2}'
    when 'play_ball' then '{"playful":0.6,"energy":0.3}'
    when 'play_spin' then '{"playful":0.4,"energy":0.2}'
    when 'feed' then '{"curious":0.2}'
    when 'bath_rinse' then '{"affection":0.2,"energy":-0.2}'
    when 'sleep' then '{"energy":-0.3,"playful":-0.1}'
    else '{}' end::jsonb
$$;

create or replace function private.personality_on_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.personality is null or not exists (
    select 1 from jsonb_each_text(new.personality) e where e.value ~ '^-?[0-9.]+$' and e.value::numeric <> 0) then
    new.personality := private.roll_personality();
  end if;
  return new;
end $$;

create or replace function private.personality_on_action() returns trigger
language plpgsql security definer set search_path = '' as $$
declare dr jsonb := private.personality_drift(new.action); p jsonb; k text; v numeric;
begin
  if dr = '{}'::jsonb then return null; end if;
  select personality into p from public.pets where id = new.pet_id for update;
  if p is null then return null; end if;
  for k, v in select key, value::numeric from jsonb_each_text(dr) loop
    p := jsonb_set(p, array[k], to_jsonb(round(greatest(-100, least(100, coalesce((p ->> k)::numeric, 0) + v)), 1)));
  end loop;
  update public.pets set personality = p where id = new.pet_id;
  return null;
end $$;

create trigger pets_roll_personality before insert on public.pets
  for each row execute function private.personality_on_insert();
create trigger action_log_personality after insert on public.action_log
  for each row execute function private.personality_on_action();

revoke all on all functions in schema private from public, anon, authenticated;

-- ---------- Chuyển dữ liệu: thú đã có mà chưa có cá tính thì bốc cho nó ----------
update public.pets set personality = private.roll_personality()
  where not exists (select 1 from jsonb_each_text(personality) e where e.value ~ '^-?[0-9.]+$' and e.value::numeric <> 0);
