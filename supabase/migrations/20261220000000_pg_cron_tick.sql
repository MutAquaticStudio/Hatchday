-- Lịch chạy cron_tick (lấy mẫu người ở nơi chung, tổng hợp thống kê ngày, dọn log) ngay trong Supabase bằng pg_cron, để dashboard admin có số liệu
-- mà không cần Worker Cloudflare (Worker còn chờ tên miền workers.dev). cron_tick không gửi push nên chạy ở đây an toàn.
-- Khi Worker `hatchday-cron` đã có lịch thì gỡ job này để khỏi đếm đôi:  select cron.unschedule('hatchday-tick');
-- Chỉ chạy khi có pg_cron (Supabase có; khung test PGlite thì bỏ qua).
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if not exists (select 1 from cron.job where jobname = 'hatchday-tick') then
      perform cron.schedule('hatchday-tick', '*/15 * * * *', $c$select public.cron_tick()$c$);
    end if;
  end if;
end $$;
