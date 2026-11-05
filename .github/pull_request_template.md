## Làm gì

<!-- Một hai câu: thêm/sửa tính năng nào, vì sao. -->

## Đã kiểm tra

- [ ] `npm test` và `npm run build` đều qua
- [ ] Nếu đụng đồ mặc hoặc thú: `node scripts/fit-check.mjs` ra 0 lẹm
- [ ] Đã thử trong trình duyệt (chế độ Chơi thử), cả màn điện thoại nếu có đổi giao diện

## Có đổi luật chơi hoặc dữ liệu không?

- [ ] Không
- [ ] Có: đã sửa **cả** client (`rules.ts`, `layout.ts`, `species.ts`…) **và** SQL, test so khớp hai bên đều qua
- [ ] Có migration mới: tên theo giờ (`YYYYMMDDHHMMSS_ten.sql`), **không sửa migration cũ**
- [ ] Migration này viết lại (`create or replace`) hàm SQL nào? Liệt kê: <!-- ví dụ pet_action -->
      Đã đối chiếu với `main` để chắc không ghi đè phần sửa của người khác

## Ảnh / video (nếu đổi giao diện)
