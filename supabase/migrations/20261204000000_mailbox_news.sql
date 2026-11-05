-- =====================================================================
-- Hatchday — Hộp thư, quà tặng, tin tức (P6)
-- Luật ở hai nơi: src/game/social.ts (SOCIAL, GIFT_NOTES, isGiftable) và migration này. Test: supabase/tests/mailbox.test.ts.
-- Quà người chơi chỉ giữa bạn bè, vật phẩm lấy từ kho người gửi; xu không chuyển giữa người chơi.
-- Không viết lại hàm nào.
-- =====================================================================

create table public.mailbox (
  id          bigint generated always as identity primary key,
  to_user     uuid not null references auth.users (id) on delete cascade,
  from_user   uuid references auth.users (id) on delete set null,
  kind        text not null check (kind in ('gift', 'system', 'reward')),
  title       text not null,
  body        text not null default '',
  items       jsonb not null default '[]',
  coins       int  not null default 0 check (coins >= 0),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',
  claimed_at  timestamptz,
  returned_at timestamptz
);
create index mailbox_to on public.mailbox (to_user, created_at desc);
alter table public.mailbox enable row level security;
create policy "mailbox: đọc của mình" on public.mailbox for select to authenticated using ((select auth.uid()) = to_user);

create table public.announcements (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('update', 'event', 'maintenance', 'notice')),
  title      text not null,
  body       text not null default '',
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  pinned     boolean not null default false,
  min_bond   int not null default 1,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
create policy "announcements: ai cũng đọc tin đang chạy" on public.announcements for select to authenticated
  using (starts_at <= now() and (ends_at is null or ends_at > now())
         and min_bond <= coalesce((select bond_level from public.public_profiles where user_id = (select auth.uid())), 1));

create table public.announcement_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  announcement_id bigint not null references public.announcements (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);
alter table public.announcement_reads enable row level security;
create policy "announcement_reads: đọc của mình" on public.announcement_reads for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- Hàm nội bộ ----------
-- Quà được tặng: thức ăn, thuốc, đồ trang trí mua được (trừ giấy dán tường và sàn). Không tặng đồ mặc, đồ khởi đầu, đồ sự kiện, đồ trả phí.
create or replace function private.giftable(it public.items) returns boolean
language sql immutable set search_path = '' as $$
  select it.active and (it.kind in ('food', 'medicine') or (it.kind = 'decor' and it.layer not in ('wallpaper', 'flooring') and it.source in ('market', 'rotating', 'weekend')))
$$;

-- Gửi một thư (dùng cho quà người chơi, quà hệ thống và quản trị)
create or replace function private.send_mail(p_to uuid, p_from uuid, p_kind text, p_title text, p_body text, p_items jsonb, p_coins int, p_days int default 30) returns bigint
language sql security definer set search_path = '' as $$
  insert into public.mailbox (to_user, from_user, kind, title, body, items, coins, expires_at)
  values (p_to, p_from, p_kind, p_title, coalesce(p_body, ''), coalesce(p_items, '[]'), coalesce(p_coins, 0), now() + make_interval(days => p_days)) returning id
$$;

-- Quà người chơi hết hạn mà chưa nhận thì trả lại kho người gửi (làm lười, khi người nhận mở hộp thư)
create or replace function private.sweep_mail(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m record; e jsonb;
begin
  for m in select * from public.mailbox where to_user = uid and claimed_at is null and returned_at is null and expires_at <= now() limit 50 loop
    if m.kind = 'gift' and m.from_user is not null then
      for e in select * from jsonb_array_elements(m.items) loop
        insert into public.entitlements (owner_id, item_id, source, qty) values (m.from_user, e ->> 'id', 'gift', (e ->> 'qty')::int)
        on conflict (owner_id, item_id) do update set qty = public.entitlements.qty + (e ->> 'qty')::int;
      end loop;
    end if;
    update public.mailbox set returned_at = now() where id = m.id;
  end loop;
end $$;

-- ---------- RPC ----------
create or replace function public.get_social_summary() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); bl int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  bl := coalesce((select bond_level from public.public_profiles where user_id = uid), 1);
  return jsonb_build_object(
    'mail_unread', (select count(*) from public.mailbox where to_user = uid and claimed_at is null and returned_at is null and expires_at > now()),
    'news_unread', (select count(*) from public.announcements a where a.starts_at <= now() and (a.ends_at is null or a.ends_at > now()) and a.min_bond <= bl
                      and not exists (select 1 from public.announcement_reads r where r.user_id = uid and r.announcement_id = a.id)),
    'requests_in', (select count(*) from public.friendships where status = 'pending' and uid in (a, b) and requested_by <> uid),
    'events_version', coalesce((select max(id) from public.announcements where kind = 'event'), 0));
end $$;

create or replace function public.get_inbox() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform private.sweep_mail(uid);
  return jsonb_build_object('mail', coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'title', m.title, 'body', m.body, 'items', m.items, 'coins', m.coins,
      'from', case when m.from_user is null then null else private.profile_json(m.from_user) ->> 'name' end, 'created_at', m.created_at, 'expires_at', m.expires_at, 'claimed', m.claimed_at is not null)
      order by (m.claimed_at is not null), m.created_at desc)
    from (select * from public.mailbox where to_user = uid and returned_at is null and expires_at > now() and (claimed_at is null or claimed_at > now() - interval '3 days') order by created_at desc limit 50) m), '[]'::jsonb));
end $$;

create or replace function private.claim_one(uid uuid, mid bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.mailbox; e jsonb; it public.items; have int; cap int;
begin
  select * into m from public.mailbox where id = mid and to_user = uid for update;
  if m.id is null then raise exception 'not_found'; end if;
  if m.claimed_at is not null then raise exception 'already_claimed'; end if;
  if m.returned_at is not null or m.expires_at <= now() then raise exception 'expired'; end if;
  for e in select * from jsonb_array_elements(m.items) loop
    select * into it from public.items where id = e ->> 'id';
    cap := case when it.kind in ('food', 'dish') then 30 when it.kind = 'medicine' then 10 else 1000 end;
    have := coalesce((select qty from public.entitlements where owner_id = uid and item_id = it.id), 0);
    if have + (e ->> 'qty')::int > cap then raise exception 'stock_full'; end if;
  end loop;
  for e in select * from jsonb_array_elements(m.items) loop
    insert into public.entitlements (owner_id, item_id, source, qty) values (uid, e ->> 'id', 'gift', (e ->> 'qty')::int)
    on conflict (owner_id, item_id) do update set qty = public.entitlements.qty + (e ->> 'qty')::int;
  end loop;
  if m.coins > 0 then perform private.earn(uid, m.coins, false); end if;
  update public.mailbox set claimed_at = now() where id = mid;
  return jsonb_build_object('items', m.items, 'coins', m.coins);
end $$;

create or replace function public.claim_mail(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); res jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  res := private.claim_one(uid, p_id);
  return res || jsonb_build_object('wallet', (select coins from public.wallets where owner_id = uid));
end $$;

create or replace function public.claim_all_mail() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); mid bigint; ok int := 0; skipped int := 0;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  for mid in select id from public.mailbox where to_user = uid and claimed_at is null and returned_at is null and expires_at > now() order by created_at limit 50 loop
    begin perform private.claim_one(uid, mid); ok := ok + 1; exception when others then skipped := skipped + 1; end;
  end loop;
  return jsonb_build_object('claimed', ok, 'skipped', skipped, 'wallet', (select coins from public.wallets where owner_id = uid));
end $$;

create or replace function public.delete_mail(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  delete from public.mailbox where id = p_id and to_user = uid and (claimed_at is not null or kind = 'system');
  if not found then raise exception 'not_found'; end if;
end $$;

-- Tặng quà: p_items = [{ "id": "carot", "qty": 2 }, ...], p_note là một trong các câu mẫu hoặc rỗng.
create or replace function public.send_gift(p_who text, p_items jsonb, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid; e jsonb; it public.items; total int := 0; n int; d date; tz text; f public.friendships; sname text; mid bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null or t = uid then raise exception 'not_found'; end if;
  if private.is_blocked(uid, t) then raise exception 'blocked'; end if;
  select * into f from public.friendships where a = least(uid, t) and b = greatest(uid, t) and status = 'accepted';
  if f.a is null then raise exception 'not_friends'; end if;
  if f.accepted_at > now() - interval '3 days' then raise exception 'too_new_friend'; end if;
  if (select created_at from public.profiles where id = uid) > now() - interval '3 days' then raise exception 'account_too_new'; end if;
  if p_note is not null and p_note <> '' and p_note not in ('Chúc bạn khoẻ!', 'Cảm ơn bạn nhé!', 'Tặng bạn món nhỏ.', 'Chúc bé của bạn vui!') then raise exception 'invalid_note'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 5 then raise exception 'invalid_items'; end if;
  for e in select * from jsonb_array_elements(p_items) loop
    n := coalesce((e ->> 'qty')::int, 0);
    if n < 1 then raise exception 'invalid_items'; end if;
    select * into it from public.items where id = e ->> 'id';
    if it.id is null or not private.giftable(it) then raise exception 'not_giftable'; end if;
    if not private.owns(uid, it.id, n) then raise exception 'not_owned'; end if;
    total := total + n;
  end loop;
  if total > 5 then raise exception 'invalid_items'; end if;
  tz := coalesce((select timezone from public.profiles where id = uid), 'Asia/Ho_Chi_Minh');
  d := (now() at time zone tz)::date;
  if (select count(*) from public.mailbox where from_user = uid and kind = 'gift' and (created_at at time zone tz)::date = d) >= 3 then raise exception 'gift_limit'; end if;
  if exists (select 1 from public.mailbox where from_user = uid and to_user = t and kind = 'gift' and (created_at at time zone tz)::date = d) then raise exception 'gift_limit_friend'; end if;
  for e in select * from jsonb_array_elements(p_items) loop
    update public.entitlements set qty = qty - (e ->> 'qty')::int where owner_id = uid and item_id = e ->> 'id';
  end loop;
  sname := coalesce((select display_name from public.public_profiles where user_id = uid), 'Một người bạn');
  mid := private.send_mail(t, uid, 'gift', 'Quà từ ' || sname, coalesce(p_note, ''), p_items, 0);
  return jsonb_build_object('id', mid);
end $$;

create or replace function public.get_news() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); bl int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  bl := coalesce((select bond_level from public.public_profiles where user_id = uid), 1);
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'title', a.title, 'body', a.body, 'pinned', a.pinned, 'starts_at', a.starts_at, 'ends_at', a.ends_at,
      'read', exists (select 1 from public.announcement_reads r where r.user_id = uid and r.announcement_id = a.id)) order by a.pinned desc, a.starts_at desc)
    from public.announcements a where a.starts_at <= now() and (a.ends_at is null or a.ends_at > now()) and a.min_bond <= bl), '[]'::jsonb);
end $$;

create or replace function public.mark_news_read(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into public.announcement_reads (user_id, announcement_id) select uid, id from public.announcements where id = p_id on conflict do nothing;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_social_summary(), public.get_inbox(), public.claim_mail(bigint), public.claim_all_mail(), public.delete_mail(bigint),
  public.send_gift(text, jsonb, text), public.get_news(), public.mark_news_read(bigint) from public, anon;
grant execute on function public.get_social_summary(), public.get_inbox(), public.claim_mail(bigint), public.claim_all_mail(), public.delete_mail(bigint),
  public.send_gift(text, jsonb, text), public.get_news(), public.mark_news_read(bigint) to authenticated;
