-- Bộ lọc chat công khai trong trang quản trị: tra nhật ký chat 24 giờ (có ghi kiểm toán) và thống kê tin bị chặn.
-- Hàm mới, không viết lại hàm nào có sẵn. Quyền: 'report' (moderator, owner) như hàng đợi báo cáo.

create or replace function public.admin_chat_log(p_q text default null, p_user uuid default null, p_limit int default 100) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 100), 1), 200); q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform private.require_admin('report');
  perform private.audit('view_chat_log', p_user::text, null, jsonb_build_object('q', q, 'limit', lim), null);
  return coalesce((select jsonb_agg(x order by x.id desc) from (
    select c.id, c.created_at as at, c.user_id, c.topic, c.body, private.profile_json(c.user_id) ->> 'name' as name,
           exists (select 1 from public.sanctions s where s.user_id = c.user_id and s.lifted_at is null and s.until > now()) as sanctioned
    from public.chat_log c
    where (p_user is null or c.user_id = p_user) and (q is null or c.body ilike '%' || replace(replace(q, '%', ''), '_', '') || '%')
    order by c.id desc limit lim) x), '[]'::jsonb);
end $$;

create or replace function public.admin_chat_filter_stats() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin('report');
  return jsonb_build_object(
    'messages_24h', (select count(*) from public.chat_log where created_at > now() - interval '24 hours'),
    'senders_24h', (select count(distinct user_id) from public.chat_log where created_at > now() - interval '24 hours'),
    'blocked', coalesce((select jsonb_object_agg(reason, n) from (select reason, count(*) n from public.chat_strikes where created_at > now() - interval '24 hours' group by reason) b), '{}'::jsonb),
    'auto_mutes_24h', (select count(*) from public.sanctions where auto and created_at > now() - interval '24 hours'),
    'words', (select count(*) from public.word_filter));
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.admin_chat_log(text, uuid, int), public.admin_chat_filter_stats() from public, anon;
grant execute on function public.admin_chat_log(text, uuid, int), public.admin_chat_filter_stats() to authenticated;
