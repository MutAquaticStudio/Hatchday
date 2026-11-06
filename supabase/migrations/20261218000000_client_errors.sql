-- Nhật ký lỗi phía người chơi: trang bắt lỗi JS chưa xử lý và gửi một bản tóm tắt ngắn lên đây để nhà phát triển thấy lỗi thật sau khi triển khai.
-- Không lưu nội dung người chơi nhập, không lưu địa chỉ IP; chỉ: loại lỗi, thông điệp rút gọn, vài dòng đầu stack, màn đang mở, bản build.
-- Chống spam: tối đa 20 bản/giờ/người, và tin trùng (cùng dấu vân tay) trong 10 phút chỉ tính số lần. Dọn sau 30 ngày (private.sweep_stats).
-- Quyền xem: vai trò có quyền 'flag' (ops, owner), không phải analyst/support, vì stack có thể chứa đường dẫn.

create table public.client_errors (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  user_id    uuid references auth.users (id) on delete set null,
  fp         text not null,
  kind       text not null check (kind in ('js', 'promise', 'render', 'rpc')),
  message    text not null,
  stack      text,
  place      text,
  build      text,
  n          int  not null default 1
);
create index client_errors_at on public.client_errors (at desc);
create index client_errors_fp on public.client_errors (fp, at desc);
alter table public.client_errors enable row level security;

create or replace function public.log_client_error(p_kind text, p_message text, p_stack text, p_place text, p_build text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); f text; msg text; recent int;
begin
  if uid is null then return; end if; -- chưa đăng nhập thì bỏ qua êm
  if p_kind is null or p_kind not in ('js', 'promise', 'render', 'rpc') then return; end if;
  msg := left(coalesce(nullif(btrim(p_message), ''), '(trống)'), 300);
  select count(*) into recent from public.client_errors where user_id = uid and at > now() - interval '1 hour';
  if recent >= 20 then return; end if;
  f := md5(p_kind || '|' || left(msg, 120) || '|' || left(coalesce(p_stack, ''), 160));
  update public.client_errors set n = n + 1, last_at = now() where user_id = uid and fp = f and last_at > now() - interval '10 minutes';
  if found then return; end if;
  insert into public.client_errors (user_id, fp, kind, message, stack, place, build)
    values (uid, f, p_kind, msg, left(p_stack, 600), left(p_place, 40), left(p_build, 40));
end $$;

-- Tổng hợp theo dấu vân tay trong p_days ngày: số lần, số người, lần cuối, mẫu; kèm số lỗi theo ngày.
create or replace function public.admin_client_errors(p_days int default 7) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int := least(greatest(coalesce(p_days, 7), 1), 30); s timestamptz;
begin
  perform private.require_admin('flag');
  s := now() - make_interval(days => n);
  return jsonb_build_object(
    'total', coalesce((select sum(e.n) from public.client_errors e where e.at >= s), 0),
    'users', (select count(distinct user_id) from public.client_errors where at >= s),
    'top', coalesce((select jsonb_agg(t order by (t ->> 'count')::int desc) from (
      select jsonb_build_object('fp', e.fp, 'kind', min(e.kind), 'message', min(e.message), 'stack', min(e.stack), 'place', min(e.place), 'build', max(e.build),
        'count', sum(e.n), 'users', count(distinct e.user_id), 'last', max(e.last_at)) as t
      from public.client_errors e where e.at >= s group by e.fp order by sum(e.n) desc limit 20) x), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d) from (
      select (e.at at time zone 'Asia/Ho_Chi_Minh')::date as d, sum(e.n) as c from public.client_errors e where e.at >= s group by 1) y), '[]'::jsonb));
end $$;

-- Dọn log cũ: viết lại private.sweep_stats (bản mới nhất ở 20261217000000_world_activity.sql) và thêm client_errors.
create or replace function private.sweep_stats() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.sweep_chat();
  delete from public.ad_nonces where issued_at < now() - interval '3 days';
  delete from public.client_sessions where last_seen_at < now() - interval '120 days';
  delete from public.coin_ledger where at < now() - interval '120 days';
  delete from public.place_visits where at < now() - interval '120 days';
  delete from public.place_online_samples where at < now() - interval '120 days';
  delete from public.world_activity where day < current_date - 45;
  delete from public.minigame_logs where day < current_date - 45;
  delete from public.explore_claims where day < current_date - 400;
  delete from public.client_errors where at < now() - interval '30 days';
end $$;

-- ---------- Quyền ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.log_client_error(text, text, text, text, text), public.admin_client_errors(int) from public, anon;
grant execute on function public.log_client_error(text, text, text, text, text), public.admin_client_errors(int) to authenticated;
