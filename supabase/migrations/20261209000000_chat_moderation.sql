-- =====================================================================
-- Hatchday — Chat công khai, chat riêng (DM) và kiểm duyệt (P10, P12, P14)
-- Luật ở hai nơi: src/net/moderation.ts (chuẩn hoá + bộ lọc, test so khớp bộ ngữ liệu supabase/tests/fixtures/chat-corpus.json)
-- và migration này. Test: supabase/tests/chat.test.ts.
-- Chat gõ chữ luôn đi qua post_chat/send_dm: người gửi do máy chủ đóng dấu, không do client khai.
-- Cờ chat.public.enabled mặc định TẮT. DM giữa bạn bè cũng cần cờ chat.dm.enabled (mặc định bật).
-- post_chat/send_dm trả {ok:false, reason} khi nội dung bị lọc (không raise) để vết "gậy" còn lại sau khi từ chối.
-- Không viết lại hàm nào có sẵn.
-- =====================================================================

create table public.chat_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  topic      text not null,
  body       text not null,
  norm       text not null,
  created_at timestamptz not null default now()
);
create index chat_log_user on public.chat_log (user_id, created_at desc);
create index chat_log_topic on public.chat_log (topic, id desc);
create table public.chat_strikes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index chat_strikes_user on public.chat_strikes (user_id, created_at desc);
create table public.chat_evidence (
  report_id bigint primary key references public.reports (id) on delete cascade,
  snapshot  jsonb not null
);
create table public.dm_messages (
  id         bigint generated always as identity primary key,
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index dm_pair on public.dm_messages (least(from_user, to_user), greatest(from_user, to_user), id desc);
create index dm_to_unread on public.dm_messages (to_user) where read_at is null;
-- Mọi bảng bật RLS và không có chính sách: chỉ RPC security definer chạm vào (nhật ký chat chỉ quản trị đọc qua RPC).
alter table public.chat_log enable row level security;
alter table public.chat_strikes enable row level security;
alter table public.chat_evidence enable row level security;
alter table public.dm_messages enable row level security;

insert into public.system_flags (key, value) values ('chat.dm.enabled', 'true') on conflict do nothing;

-- ---------- Chuẩn hoá: bỏ dấu, đ→d, chữ thường, bỏ ký tự vô hình, đổi leet (chỉ để so khớp), gộp chữ lặp ----------
create or replace function private.chat_normalize(t text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(regexp_replace(
    translate(lower(regexp_replace(regexp_replace(normalize(coalesce(t, ''), nfd), '[̀-ͯ]', '', 'g'), '[​-‏‪-‮⁠﻿]', '', 'g')),
              'Đđ0134@57$', 'ddoieaasts'),
    '[^a-z0-9]+', ' ', 'g'), '([a-z])\1+', '\1', 'g'))
$$;

-- ---------- Bộ lọc: trả {ok, reason, text, flag, norm} ----------
create or replace function private.chat_filter(p_text text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')); n text; sq text; w record; tn text; hit boolean; masked text; flag boolean := false;
begin
  if char_length(t) = 0 then return jsonb_build_object('ok', false, 'reason', 'empty', 'text', '', 'flag', false, 'norm', ''); end if;
  if char_length(t) > 100 then return jsonb_build_object('ok', false, 'reason', 'too_long', 'text', t, 'flag', false, 'norm', ''); end if;
  n := private.chat_normalize(t); sq := replace(n, ' ', '');
  if t ~ '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]' then return jsonb_build_object('ok', false, 'reason', 'invalid_chars', 'text', t, 'flag', false, 'norm', n); end if;
  if char_length(regexp_replace(t, '[^\U0001F000-\U0001FAFF☀-➿]', '', 'g')) > 3 then return jsonb_build_object('ok', false, 'reason', 'emoji', 'text', t, 'flag', false, 'norm', n); end if;
  if t like '%@%' or lower(t) ~ '(https?:|www\.|[a-z0-9-]+\.(com|vn|net|org|info|xyz|io|me|tv|gg|ly|co)\M)' or sq ~ '(http|www|dotcom|chamcom|dotvn|chamvn)' then
    return jsonb_build_object('ok', false, 'reason', 'link', 'text', t, 'flag', false, 'norm', n);
  end if;
  if char_length(regexp_replace(t, '[^0-9]', '', 'g')) >= 9 then return jsonb_build_object('ok', false, 'reason', 'phone', 'text', t, 'flag', false, 'norm', n); end if;
  masked := t;
  for w in select term, match, action from public.word_filter loop
    tn := private.chat_normalize(w.term); continue when tn = '';
    hit := case w.match when 'word' then (' ' || n || ' ') like ('% ' || tn || ' %') else sq like ('%' || replace(tn, ' ', '') || '%') end;
    continue when not hit;
    if w.action = 'block' then return jsonb_build_object('ok', false, 'reason', 'filtered', 'text', t, 'flag', false, 'norm', n); end if;
    if w.action = 'flag' then flag := true; continue; end if;
    -- mask: che từng từ khớp (từ khoá nhiều từ thì chỉ gắn cờ)
    if position(' ' in tn) > 0 then flag := true; continue; end if;
    masked := (select string_agg(case when (w.match = 'word' and private.chat_normalize(x.word) = tn) or (w.match = 'substr' and replace(private.chat_normalize(x.word), ' ', '') like ('%' || tn || '%')) then '***' else x.word end, ' ' order by x.ord)
               from regexp_split_to_table(masked, ' ') with ordinality as x(word, ord));
  end loop;
  return jsonb_build_object('ok', true, 'reason', null, 'text', masked, 'flag', flag, 'norm', n);
end $$;

-- ---------- Cổng chung: phạt đang có, tuổi tài khoản, nhịp gửi, tin trùng ----------
create or replace function private.chat_gate(uid uuid, p_norm text, p_dm boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.sanctions where user_id = uid and lifted_at is null and until > now() and kind in ('mute', 'ban')) then raise exception 'muted'; end if;
  if (select created_at from public.profiles where id = uid) > now() - interval '24 hours' then raise exception 'account_too_new'; end if;
  if (select count(*) from public.chat_log where user_id = uid and created_at > now() - interval '6 seconds') >= 3
     or (select count(*) from public.chat_log where user_id = uid and created_at > now() - interval '1 minute') >= 20
     or (select count(*) from public.chat_log where user_id = uid and created_at > now() - interval '1 day') >= 200 then raise exception 'rate_limited'; end if;
  if p_norm <> '' and exists (select 1 from public.chat_log where user_id = uid and norm = p_norm and created_at > now() - interval '30 seconds') then raise exception 'duplicate'; end if;
end $$;

-- Gậy: 3 lần bị chặn trong 5 phút → khoá chat 10 phút; 5 lần trong 1 giờ → 1 giờ.
create or replace function private.chat_strike(uid uuid, why text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_strikes (user_id, reason) values (uid, why);
  if exists (select 1 from public.sanctions where user_id = uid and lifted_at is null and until > now() and kind = 'mute') then return; end if;
  if (select count(*) from public.chat_strikes where user_id = uid and created_at > now() - interval '1 hour') >= 5 then
    insert into public.sanctions (user_id, kind, until, reason, auto) values (uid, 'mute', now() + interval '1 hour', 'auto: 5 tin bị chặn trong 1 giờ', true);
  elsif (select count(*) from public.chat_strikes where user_id = uid and created_at > now() - interval '5 minutes') >= 3 then
    insert into public.sanctions (user_id, kind, until, reason, auto) values (uid, 'mute', now() + interval '10 minutes', 'auto: 3 tin bị chặn trong 5 phút', true);
  end if;
end $$;

-- ---------- Chat công khai ----------
create or replace function public.post_chat(p_room text, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); f jsonb; mid bigint; pr public.public_profiles;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if coalesce((select value from public.system_flags where key = 'chat.public.enabled'), 'false'::jsonb) is distinct from 'true'::jsonb then raise exception 'chat_disabled'; end if;
  if not exists (select 1 from public.place_members where user_id = uid and topic = p_room and last_seen > now() - interval '120 seconds') then raise exception 'not_in_place'; end if;
  f := private.chat_filter(p_text);
  perform private.chat_gate(uid, f ->> 'norm');
  if not (f ->> 'ok')::boolean then
    if f ->> 'reason' in ('filtered', 'link', 'phone') then perform private.chat_strike(uid, f ->> 'reason'); end if;
    return jsonb_build_object('ok', false, 'reason', f ->> 'reason');
  end if;
  insert into public.chat_log (user_id, topic, body, norm) values (uid, p_room, f ->> 'text', f ->> 'norm') returning id into mid;
  if (f ->> 'flag')::boolean then insert into public.reports (reporter, target, kind, reason, detail) values (uid, uid, 'chat', 'other', left('auto: từ khoá gắn cờ · ' || (f ->> 'text'), 200)); end if;
  select * into pr from public.public_profiles where user_id = uid;
  perform realtime.send(jsonb_build_object('id', mid, 'pid', pr.public_id, 'name', pr.display_name, 'text', f ->> 'text'), 'chat', 'chat:' || p_room, true);
  return jsonb_build_object('ok', true, 'id', mid, 'text', f ->> 'text');
end $$;

-- Báo cáo một tin chat: máy chủ chụp tin và 10 tin trước đó trong cùng kênh (không giả được).
create or replace function public.report_chat(p_msg bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m public.chat_log; rid bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into m from public.chat_log where id = p_msg;
  if m.id is null or m.user_id = uid then raise exception 'not_found'; end if;
  if p_reason not in ('harassment', 'spam', 'inappropriate_name', 'cheating', 'other') then raise exception 'invalid_reason'; end if;
  if (select count(*) from public.reports where reporter = uid and created_at > now() - interval '1 day') >= 10 then raise exception 'rate_limited'; end if;
  if exists (select 1 from public.reports r join public.chat_evidence e on e.report_id = r.id where r.reporter = uid and r.target = m.user_id and r.status = 'open' and (e.snapshot ->> 'msg')::bigint = p_msg) then raise exception 'already_reported'; end if;
  insert into public.reports (reporter, target, kind, reason, detail) values (uid, m.user_id, 'chat', p_reason, left(m.body, 200)) returning id into rid;
  insert into public.chat_evidence (report_id, snapshot) values (rid, jsonb_build_object('msg', p_msg, 'topic', m.topic, 'at', m.created_at,
    'before', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'user', c.user_id, 'body', c.body, 'at', c.created_at) order by c.id)
                        from (select * from public.chat_log where topic = m.topic and id < p_msg order by id desc limit 10) c), '[]'::jsonb), 'body', m.body));
  -- 3 người khác nhau báo trong 10 phút → tự khoá chat 15 phút
  if (select count(distinct reporter) from public.reports where target = m.user_id and kind = 'chat' and created_at > now() - interval '10 minutes') >= 3
     and not exists (select 1 from public.sanctions where user_id = m.user_id and lifted_at is null and until > now() and kind = 'mute') then
    insert into public.sanctions (user_id, kind, until, reason, auto) values (m.user_id, 'mute', now() + interval '15 minutes', 'auto: 3 người báo cáo trong 10 phút', true);
  end if;
end $$;

-- ---------- Chat riêng giữa bạn bè ----------
create or replace function public.send_dm(p_who text, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid; f jsonb; mid bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if coalesce((select value from public.system_flags where key = 'chat.dm.enabled'), 'true'::jsonb) is distinct from 'true'::jsonb then raise exception 'chat_disabled'; end if;
  t := private.resolve_who(p_who);
  if t is null or t = uid then raise exception 'not_found'; end if;
  if private.is_blocked(uid, t) then raise exception 'blocked'; end if;
  if not private.are_friends(uid, t) then raise exception 'not_friends'; end if;
  f := private.chat_filter(p_text);
  perform private.chat_gate(uid, f ->> 'norm', true);
  if not (f ->> 'ok')::boolean then
    if f ->> 'reason' in ('filtered', 'link', 'phone') then perform private.chat_strike(uid, f ->> 'reason'); end if;
    return jsonb_build_object('ok', false, 'reason', f ->> 'reason');
  end if;
  insert into public.dm_messages (from_user, to_user, body) values (uid, t, f ->> 'text') returning id into mid;
  insert into public.chat_log (user_id, topic, body, norm) values (uid, 'dm', f ->> 'text', f ->> 'norm'); -- để tính nhịp gửi
  return jsonb_build_object('ok', true, 'id', mid, 'text', f ->> 'text');
end $$;

create or replace function public.list_dm_threads() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return coalesce((select jsonb_agg(x order by (x ->> 'at') desc) from (
    select jsonb_build_object('with', private.profile_json(o.other), 'last', o.body, 'at', o.created_at, 'mine', o.from_user = uid,
      'unread', (select count(*) from public.dm_messages u where u.to_user = uid and u.from_user = o.other and u.read_at is null)) x
    from (select distinct on (case when m.from_user = uid then m.to_user else m.from_user end)
            case when m.from_user = uid then m.to_user else m.from_user end as other, m.body, m.created_at, m.from_user
          from public.dm_messages m where uid in (m.from_user, m.to_user) and m.created_at > now() - interval '30 days'
          order by case when m.from_user = uid then m.to_user else m.from_user end, m.id desc) o
    where private.are_friends(uid, o.other) and not private.is_blocked(uid, o.other)) s), '[]'::jsonb);
end $$;

create or replace function public.list_dm(p_who text, p_before bigint default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who);
  if t is null or t = uid then raise exception 'not_found'; end if;
  if private.is_blocked(uid, t) then raise exception 'blocked'; end if;
  if not private.are_friends(uid, t) then raise exception 'not_friends'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'mine', m.from_user = uid, 'body', m.body, 'at', m.created_at, 'read', m.read_at is not null) order by m.id)
    from (select * from public.dm_messages where least(from_user, to_user) = least(uid, t) and greatest(from_user, to_user) = greatest(uid, t)
            and created_at > now() - interval '30 days' and (p_before is null or id < p_before) order by id desc limit 30) m), '[]'::jsonb);
end $$;

create or replace function public.mark_dm_read(p_who text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  t := private.resolve_who(p_who); if t is null then raise exception 'not_found'; end if;
  update public.dm_messages set read_at = now() where to_user = uid and from_user = t and read_at is null;
end $$;

create or replace function public.dm_unread() returns int
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return (select count(*)::int from public.dm_messages m where m.to_user = auth.uid() and m.read_at is null and m.created_at > now() - interval '30 days' and not private.is_blocked(auth.uid(), m.from_user));
end $$;

-- Dọn nhật ký chat 24 giờ, gậy 7 ngày, DM 30 ngày (gọi bằng pg_cron hoặc tay).
create or replace function private.sweep_chat() returns void
language sql security definer set search_path = '' as $$
  delete from public.chat_log where created_at < now() - interval '24 hours';
  delete from public.chat_strikes where created_at < now() - interval '7 days';
  delete from public.dm_messages where created_at < now() - interval '30 days';
$$;

-- Nghe chat của kênh mình: chính sách select cho chủ đề chat:<kênh>
do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute $p$create policy "places: nghe chat của kênh mình" on realtime.messages for select to authenticated using (
      exists (select 1 from public.place_members m where m.user_id = (select auth.uid()) and 'chat:' || m.topic = (select realtime.topic()) and m.last_seen > now() - interval '120 seconds'))$p$;
  end if;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.post_chat(text, text), public.report_chat(bigint, text), public.send_dm(text, text), public.list_dm_threads(), public.list_dm(text, bigint),
  public.mark_dm_read(text), public.dm_unread() from public, anon;
grant execute on function public.post_chat(text, text), public.report_chat(bigint, text), public.send_dm(text, text), public.list_dm_threads(), public.list_dm(text, bigint),
  public.mark_dm_read(text), public.dm_unread() to authenticated;
