-- Thùng thư Góp ý & Hỗ trợ + thông tin trang (ủng hộ, email liên hệ) chỉnh được trong trang quản trị.
--
-- 1) Thông tin trang: lưu ở system_flags khoá 'site.info' (jsonb). Trang giới thiệu đọc qua get_site_info()
--    (cho cả khách chưa đăng nhập vì trang chủ hiện trước khi đăng nhập; chỉ trả các trường công khai).
--    Admin có quyền 'flag' (owner, ops) sửa bằng admin_set_site_info, có lý do và ghi kiểm toán.
-- 2) Góp ý & Hỗ trợ: người chơi gửi phiếu (góp ý, báo lỗi, tài khoản, khác), trao đổi qua lại với đội ngũ.
--    Đội ngũ (quyền 'ticket': owner, ops, support) xem, trả lời, đóng phiếu. Khi đội ngũ trả lời, người chơi nhận
--    một thư hệ thống trong Hộp thư (không kèm xu/quà) để biết mà mở xem.
--    Chống spam: tối đa 3 phiếu chưa đóng và 5 phiếu mới mỗi 24 giờ; tối đa 10 tin trả lời mỗi giờ mỗi phiếu.

-- ---------- Thông tin trang ----------
insert into public.system_flags (key, value) values ('site.info', '{"contact_email": "m.thuanwork@gmail.com"}')
  on conflict (key) do nothing;

create or replace function public.get_site_info() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_object_agg(k, v) from jsonb_each((select value from public.system_flags where key = 'site.info')) as e(k, v)
    where k in ('donate_url', 'donate_label', 'bank_name', 'bank_account', 'bank_holder', 'vietqr_bank', 'qr_url', 'contact_email')
      and jsonb_typeof(v) = 'string'), '{}'::jsonb)
$$;

-- Kiểm tra từng trường; chuỗi rỗng = bỏ trường đó. Trường lạ hoặc sai dạng → invalid_site_info.
create or replace function private.clean_site_info(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; s text; out jsonb := '{}';
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'invalid_site_info'; end if;
  for k, v in select * from jsonb_each(p) loop
    if jsonb_typeof(v) = 'null' then continue; end if;
    if jsonb_typeof(v) <> 'string' then raise exception 'invalid_site_info'; end if;
    s := btrim(v #>> '{}');
    if s = '' then continue; end if;
    if k = 'donate_url' then if char_length(s) > 300 or s !~ '^https://[^\s<>"'']+$' then raise exception 'invalid_site_info'; end if;
    elsif k = 'donate_label' then if char_length(s) > 40 then raise exception 'invalid_site_info'; end if;
    elsif k in ('bank_name', 'bank_holder') then if char_length(s) > 60 then raise exception 'invalid_site_info'; end if;
    elsif k = 'bank_account' then if s !~ '^[0-9][0-9 .-]{3,29}$' then raise exception 'invalid_site_info'; end if;
    elsif k = 'vietqr_bank' then if s !~ '^[A-Za-z0-9]{2,12}$' then raise exception 'invalid_site_info'; end if;
    elsif k = 'qr_url' then if char_length(s) > 200 or s !~ '^\.?/[A-Za-z0-9/_.-]+\.(png|jpg|jpeg|webp|svg)$' or s ~ '\.\.' then raise exception 'invalid_site_info'; end if;
    elsif k = 'contact_email' then if char_length(s) > 120 or s !~ '^[^@\s<>"'']+@[^@\s<>"'']+\.[A-Za-z]{2,}$' then raise exception 'invalid_site_info'; end if;
    else raise exception 'invalid_site_info'; end if;
    out := out || jsonb_build_object(k, s);
  end loop;
  return out;
end $$;

create or replace function public.admin_set_site_info(p_info jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; old jsonb; nv jsonb;
begin
  uid := private.require_admin('flag'); perform private.need_reason(p_reason);
  nv := private.clean_site_info(p_info);
  select value into old from public.system_flags where key = 'site.info';
  insert into public.system_flags (key, value, updated_by) values ('site.info', nv, uid)
    on conflict (key) do update set value = excluded.value, updated_by = uid, updated_at = now();
  perform private.audit('set_site_info', 'site.info', old, nv, p_reason);
  return nv;
end $$;

-- Lần đổi cuối của mỗi cờ, nay gồm cả thông tin trang. Viết lại public.admin_flag_meta (bản mới nhất ở 20261214000000_admin_dashboard.sql).
create or replace function public.admin_flag_meta() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('flag');
  return coalesce((select jsonb_object_agg(target, jsonb_build_object('at', created_at, 'reason', reason, 'by', split_part(coalesce((select email from auth.users where id = admin), ''), '@', 1)))
    from (select distinct on (target) target, created_at, reason, admin from public.admin_audit where action in ('set_flag', 'set_site_info') order by target, created_at desc) x), '{}'::jsonb);
end $$;

-- ---------- Góp ý & Hỗ trợ ----------
create table public.support_tickets (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('feedback', 'bug', 'account', 'other')),
  subject       text not null check (char_length(subject) between 1 and 80),
  status        text not null default 'open' check (status in ('open', 'answered', 'closed')),
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  user_seen_at  timestamptz not null default now(),
  admin_seen_at timestamptz
);
create index support_tickets_user on public.support_tickets (user_id, updated_at desc);
create index support_tickets_status on public.support_tickets (status, updated_at desc);
create table public.support_messages (
  id         bigint generated always as identity primary key,
  ticket_id  bigint not null references public.support_tickets (id) on delete cascade,
  from_admin boolean not null default false,
  author     uuid references auth.users (id) on delete set null,
  body       text not null check (char_length(body) between 1 and 2000),
  at         timestamptz not null default now()
);
create index support_messages_ticket on public.support_messages (ticket_id, at);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- Thông tin máy kèm theo (để sửa lỗi): chỉ giữ vài khoá ngắn, không lưu IP.
create or replace function private.clean_ticket_meta(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce((select jsonb_object_agg(k, left(v #>> '{}', 160)) from jsonb_each(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end) as e(k, v)
    where k in ('platform', 'screen', 'place', 'build', 'ua', 'standalone') and jsonb_typeof(v) in ('string', 'number', 'boolean')), '{}'::jsonb)
$$;

create or replace function public.submit_ticket(p_kind text, p_subject text, p_body text, p_meta jsonb default '{}') returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); sub text := btrim(coalesce(p_subject, '')); bod text := btrim(coalesce(p_body, '')); tid bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_kind is null or p_kind not in ('feedback', 'bug', 'account', 'other') then raise exception 'invalid_ticket'; end if;
  if char_length(sub) < 1 or char_length(sub) > 80 or char_length(bod) < 5 or char_length(bod) > 2000 then raise exception 'invalid_ticket'; end if;
  if (select count(*) from public.support_tickets where user_id = uid and status <> 'closed') >= 3
     or (select count(*) from public.support_tickets where user_id = uid and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'ticket_limit';
  end if;
  insert into public.support_tickets (user_id, kind, subject, meta) values (uid, p_kind, sub, private.clean_ticket_meta(p_meta)) returning id into tid;
  insert into public.support_messages (ticket_id, author, body) values (tid, uid, bod);
  return tid;
end $$;

create or replace function public.reply_ticket(p_id bigint, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); bod text := btrim(coalesce(p_body, '')); st text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select status into st from public.support_tickets where id = p_id and user_id = uid for update;
  if st is null then raise exception 'not_found'; end if;
  if st = 'closed' then raise exception 'ticket_closed'; end if;
  if char_length(bod) < 1 or char_length(bod) > 2000 then raise exception 'invalid_ticket'; end if;
  if (select count(*) from public.support_messages where ticket_id = p_id and not from_admin and at > now() - interval '1 hour') >= 10 then raise exception 'rate_limited'; end if;
  insert into public.support_messages (ticket_id, author, body) values (p_id, uid, bod);
  update public.support_tickets set status = 'open', updated_at = now(), user_seen_at = now(), admin_seen_at = null where id = p_id;
end $$;

create or replace function public.close_my_ticket(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  update public.support_tickets set status = 'closed', updated_at = now(), user_seen_at = now() where id = p_id and user_id = uid;
  if not found then raise exception 'not_found'; end if;
end $$;

-- 20 phiếu gần nhất của mình, kèm toàn bộ tin; unread = đội ngũ đã trả lời sau lần mình xem cuối.
create or replace function public.get_my_tickets() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return coalesce((select jsonb_agg(x order by x ->> 'updated_at' desc) from (
    select jsonb_build_object('id', t.id, 'kind', t.kind, 'subject', t.subject, 'status', t.status, 'created_at', t.created_at, 'updated_at', t.updated_at,
      'unread', exists (select 1 from public.support_messages m where m.ticket_id = t.id and m.from_admin and m.at > t.user_seen_at),
      'messages', coalesce((select jsonb_agg(jsonb_build_object('from_admin', m.from_admin, 'body', m.body, 'at', m.at) order by m.at, m.id) from public.support_messages m where m.ticket_id = t.id), '[]'::jsonb)) as x
    from public.support_tickets t where t.user_id = uid order by t.updated_at desc limit 20) y), '[]'::jsonb);
end $$;

create or replace function public.support_unread() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.support_tickets t where t.user_id = auth.uid()
    and exists (select 1 from public.support_messages m where m.ticket_id = t.id and m.from_admin and m.at > t.user_seen_at)
$$;

create or replace function public.mark_ticket_read(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.support_tickets set user_seen_at = now() where id = p_id and user_id = auth.uid();
end $$;

-- ---------- Phía quản trị ----------
-- Thêm hành động 'ticket' (owner, ops, support). Viết lại private.admin_can (bản mới nhất ở 20261206000000_admin.sql); khớp admin/src/rbac.ts.
create or replace function private.admin_can(r text, a text) returns boolean
language sql immutable set search_path = '' as $$
  select case r
    when 'owner' then true
    when 'ops' then a in ('dashboard', 'search', 'get_user', 'campaign', 'announce', 'event', 'flag', 'audit', 'ticket')
    when 'support' then a in ('dashboard', 'search', 'get_user', 'grant', 'ticket')
    when 'moderator' then a in ('search', 'report', 'sanction', 'word')
    when 'analyst' then a in ('dashboard')
    else false end
$$;

create or replace function public.admin_list_tickets(p_status text default 'open', p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare st text := coalesce(p_status, 'open'); n int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  perform private.require_admin('ticket');
  if st not in ('open', 'answered', 'closed', 'all') then raise exception 'invalid_ticket'; end if;
  return jsonb_build_object(
    'counts', (select jsonb_build_object('open', count(*) filter (where status = 'open'), 'answered', count(*) filter (where status = 'answered'),
      'closed', count(*) filter (where status = 'closed'), 'new', count(*) filter (where status = 'open' and admin_seen_at is null)) from public.support_tickets),
    'items', coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('id', t.id, 'kind', t.kind, 'subject', t.subject, 'status', t.status, 'created_at', t.created_at, 'updated_at', t.updated_at,
        'new', t.admin_seen_at is null, 'name', p.display_name, 'code', p.friend_code,
        'messages', (select count(*) from public.support_messages m where m.ticket_id = t.id),
        'last', (select left(m.body, 140) from public.support_messages m where m.ticket_id = t.id order by m.at desc, m.id desc limit 1)) as x
      from public.support_tickets t left join public.public_profiles p on p.user_id = t.user_id
      where st = 'all' or t.status = st order by (t.admin_seen_at is null) desc, t.updated_at desc limit n) y), '[]'::jsonb));
end $$;

create or replace function public.admin_get_ticket(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; t public.support_tickets; r text; out jsonb;
begin
  uid := private.require_admin('ticket'); r := private.admin_role(uid);
  select * into t from public.support_tickets where id = p_id;
  if t.id is null then raise exception 'not_found'; end if;
  update public.support_tickets set admin_seen_at = now() where id = p_id;
  select jsonb_build_object('id', t.id, 'kind', t.kind, 'subject', t.subject, 'status', t.status, 'meta', t.meta, 'created_at', t.created_at, 'user_id', t.user_id,
    'name', p.display_name, 'code', p.friend_code,
    'email', case when r in ('owner', 'ops', 'support') then (select u.email from auth.users u where u.id = t.user_id) end,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('from_admin', m.from_admin, 'body', m.body, 'at', m.at,
      'by', case when m.from_admin then (select u.email from auth.users u where u.id = m.author) end) order by m.at, m.id) from public.support_messages m where m.ticket_id = t.id), '[]'::jsonb))
    into out from (select 1) one left join public.public_profiles p on p.user_id = t.user_id;
  return out;
end $$;

create or replace function public.admin_reply_ticket(p_id bigint, p_body text, p_close boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid; t public.support_tickets; bod text := btrim(coalesce(p_body, ''));
begin
  uid := private.require_admin('ticket');
  select * into t from public.support_tickets where id = p_id for update;
  if t.id is null then raise exception 'not_found'; end if;
  if char_length(bod) < 1 or char_length(bod) > 2000 then raise exception 'invalid_ticket'; end if;
  insert into public.support_messages (ticket_id, from_admin, author, body) values (p_id, true, uid, bod);
  update public.support_tickets set status = case when coalesce(p_close, false) then 'closed' else 'answered' end, updated_at = now(), admin_seen_at = now() where id = p_id;
  perform private.send_mail(t.user_id, null, 'system', 'Đội ngũ Hatchday đã trả lời bạn',
    'Về: ' || t.subject || E'\nMở Cài đặt → Góp ý & Hỗ trợ để đọc và trả lời.', '[]'::jsonb, 0, 30);
  perform private.audit('ticket_reply', p_id::text, null, jsonb_build_object('close', coalesce(p_close, false)), null);
end $$;

create or replace function public.admin_set_ticket_status(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare old text;
begin
  perform private.require_admin('ticket');
  if p_status is null or p_status not in ('open', 'answered', 'closed') then raise exception 'invalid_ticket'; end if;
  select status into old from public.support_tickets where id = p_id;
  if old is null then raise exception 'not_found'; end if;
  update public.support_tickets set status = p_status, updated_at = now() where id = p_id;
  perform private.audit('ticket_status', p_id::text, to_jsonb(old), to_jsonb(p_status), null);
end $$;

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_site_info(), public.admin_set_site_info(jsonb, text), public.submit_ticket(text, text, text, jsonb), public.reply_ticket(bigint, text),
  public.close_my_ticket(bigint), public.get_my_tickets(), public.support_unread(), public.mark_ticket_read(bigint), public.admin_list_tickets(text, int),
  public.admin_get_ticket(bigint), public.admin_reply_ticket(bigint, text, boolean), public.admin_set_ticket_status(bigint, text) from public, anon;
grant execute on function public.admin_set_site_info(jsonb, text), public.submit_ticket(text, text, text, jsonb), public.reply_ticket(bigint, text),
  public.close_my_ticket(bigint), public.get_my_tickets(), public.support_unread(), public.mark_ticket_read(bigint), public.admin_list_tickets(text, int),
  public.admin_get_ticket(bigint), public.admin_reply_ticket(bigint, text, boolean), public.admin_set_ticket_status(bigint, text) to authenticated;
-- Trang giới thiệu hiện trước khi đăng nhập nên khách cũng đọc được thông tin công khai này (chỉ đọc, chỉ các trường đã lọc).
grant execute on function public.get_site_info() to anon, authenticated;
