-- Hàm của trigger sự kiện `ensure_rls` (tự bật RLS cho bảng mới) không cần ai gọi qua API: thu quyền thực thi của anon/authenticated
-- (Supabase advisor: anon_security_definer_function_executable). Trigger sự kiện vẫn chạy bình thường. Chỉ chạy khi hàm tồn tại.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
