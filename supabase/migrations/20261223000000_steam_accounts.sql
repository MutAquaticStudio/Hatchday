-- Tài khoản Steam: mỗi SteamID gắn với đúng một người dùng Hatchday. Chỉ Edge Function steam-auth (service role) đọc/ghi;
-- client không đọc được bảng này (RLS bật, không có chính sách). Xoá người dùng thì xoá luôn liên kết.
create table public.steam_accounts (
  steam_id      text primary key check (steam_id ~ '^[0-9]{17}$'),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);
alter table public.steam_accounts enable row level security;
revoke all on public.steam_accounts from anon, authenticated;
