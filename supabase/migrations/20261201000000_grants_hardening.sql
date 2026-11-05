-- =====================================================================
-- Hatchday — Thu quyền ghi trực tiếp lên bảng (P0b)
-- Supabase mặc định cấp mọi quyền trên bảng public cho anon/authenticated và chỉ dựa vào RLS. Mọi thao tác ghi của game đi qua
-- RPC `security definer`, nên thu quyền insert/update/delete: một chính sách RLS thiếu hay sai không còn mở lỗ ghi trực tiếp.
-- Hai ngoại lệ client còn ghi thẳng (src/data/api.ts): xoá ký ức của mình, và đổi múi giờ (chỉ cột `timezone`, không cho sửa cột khác).
-- Không viết lại hàm nào.
-- =====================================================================

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant delete on public.memories to authenticated;
grant update (timezone) on public.profiles to authenticated;

-- Bảng tạo sau này cũng không tự mở quyền ghi (mỗi migration phải cấp rõ nếu cần)
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;
