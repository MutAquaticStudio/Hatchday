-- =====================================================================
-- Hatchday — Đặt search_path rỗng cho ba hàm thuần còn thiếu (Supabase advisor 0011 function_search_path_mutable)
-- private.clamp (20261031), private.day_number và private.is_weekend (20261105) chỉ dùng toán tử/hàm của pg_catalog,
-- nên đổi cấu hình không đổi kết quả. Không viết lại thân hàm nào.
-- =====================================================================

alter function private.clamp(real) set search_path = '';
alter function private.day_number(date) set search_path = '';
alter function private.is_weekend(date) set search_path = '';
