-- =====================================================================
-- Hatchday — Thêm 10 công thức nấu ăn (tổng 16): 10 món nấu mới và công thức của chúng.
-- Seed sinh từ src/game/catalog.ts (scripts/gen-seed.ts), dạng upsert nên chạy lại không hại. Đừng sửa tay.
-- Không viết lại hàm nào: cook(), pet_action() đọc công thức và hiệu ứng từ bảng.
-- Test: supabase/tests/advanced-food.test.ts so khớp bảng với catalog.ts.
-- =====================================================================

-- DISHES
insert into public.items (id, kind, name, effects, price_coins, source, rarity) values
  ('chao-trung', 'dish', 'Cháo trứng', '{"no":40,"vui":10,"group":"tinhbot","group2":"dam","fresh":true}', null, 'cook', 'thuong'),
  ('com-rau', 'dish', 'Cơm rau', '{"no":38,"vui":8,"group":"tinhbot","group2":"rau","fresh":true}', null, 'cook', 'thuong'),
  ('banh-mi-trung', 'dish', 'Bánh mì trứng', '{"no":45,"vui":14,"group":"tinhbot","group2":"dam","fresh":true}', null, 'cook', 'thuong'),
  ('sinh-to', 'dish', 'Sinh tố chuối', '{"no":24,"vui":22,"group":"traicay","group2":"dam","fresh":true}', null, 'cook', 'thuong'),
  ('salad', 'dish', 'Salad trái cây', '{"no":22,"vui":18,"group":"rau","group2":"traicay","fresh":true}', null, 'cook', 'thuong'),
  ('che-trai-cay', 'dish', 'Chè trái cây', '{"no":26,"vui":28,"group":"ngot","group2":"traicay","fresh":true}', null, 'cook', 'thuong'),
  ('com-chien-rau', 'dish', 'Cơm chiên rau củ', '{"no":36,"vui":9,"group":"tinhbot","group2":"rau","fresh":true}', null, 'cook', 'thuong'),
  ('banh-mi-ca-vien', 'dish', 'Bánh mì cá viên', '{"no":40,"vui":20,"group":"tinhbot","group2":"dam","fresh":true}', null, 'cook', 'thuong'),
  ('bap-xao-trung', 'dish', 'Bắp xào trứng', '{"no":38,"vui":12,"group":"tinhbot","group2":"dam","fresh":true}', null, 'cook', 'thuong'),
  ('canh-trung', 'dish', 'Canh trứng rau', '{"no":30,"vui":8,"group":"rau","group2":"dam","fresh":true}', null, 'cook', 'thuong'),
  ('sua-chua-dua', 'dish', 'Sữa chua dưa hấu', '{"no":24,"vui":22,"group":"dam","group2":"traicay","fresh":true}', null, 'cook', 'thuong'),
  ('kem-chuoi', 'dish', 'Kem chuối', '{"no":18,"vui":30,"group":"ngot","group2":"traicay","fresh":true}', null, 'cook', 'thuong'),
  ('che-bap', 'dish', 'Chè bắp', '{"no":32,"vui":22,"group":"ngot","group2":"tinhbot","fresh":true}', null, 'cook', 'thuong'),
  ('banh-flan', 'dish', 'Bánh flan', '{"no":20,"vui":26,"group":"dam","group2":"ngot","fresh":true}', null, 'cook', 'thuong'),
  ('ca-vien-rau', 'dish', 'Cá viên xào rau', '{"no":30,"vui":16,"group":"dam","group2":"rau","fresh":true}', null, 'cook', 'thuong'),
  ('chuoi-nuong', 'dish', 'Chuối nướng', '{"no":30,"vui":18,"group":"traicay","group2":"tinhbot","fresh":true}', null, 'cook', 'thuong')
on conflict (id) do update set name = excluded.name, effects = excluded.effects;
-- RECIPES
insert into public.recipes (id, dish, a, b) values
  ('chao-trung', 'chao-trung', 'comnam', 'trung-op'),
  ('com-rau', 'com-rau', 'comnam', 'canh-rau'),
  ('banh-mi-trung', 'banh-mi-trung', 'banh-mi', 'trung-op'),
  ('sinh-to', 'sinh-to', 'chuoi', 'sua-chua'),
  ('salad', 'salad', 'carot', 'dua-hau'),
  ('che-trai-cay', 'che-trai-cay', 'che', 'dua-hau'),
  ('com-chien-rau', 'com-chien-rau', 'comnam', 'carot'),
  ('banh-mi-ca-vien', 'banh-mi-ca-vien', 'banh-mi', 'ca-vien'),
  ('bap-xao-trung', 'bap-xao-trung', 'bap-nuong', 'trung-op'),
  ('canh-trung', 'canh-trung', 'canh-rau', 'trung-op'),
  ('sua-chua-dua', 'sua-chua-dua', 'sua-chua', 'dua-hau'),
  ('kem-chuoi', 'kem-chuoi', 'kem', 'chuoi'),
  ('che-bap', 'che-bap', 'che', 'bap-nuong'),
  ('banh-flan', 'banh-flan', 'trung-op', 'sua-chua'),
  ('ca-vien-rau', 'ca-vien-rau', 'ca-vien', 'canh-rau'),
  ('chuoi-nuong', 'chuoi-nuong', 'chuoi', 'bap-nuong')
on conflict (id) do update set dish = excluded.dish, a = excluded.a, b = excluded.b;
