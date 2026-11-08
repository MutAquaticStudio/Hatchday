# Hatchday cho máy tính (Steam)

Vỏ Electron chạy bản build web với `VITE_PLATFORM=steam` (không trang giới thiệu, không quảng cáo, không link ủng hộ bên ngoài, không push trình duyệt).

```bash
npm ci && (cd desktop && npm ci)
npm run build:steam            # build vào desktop/dist (cần .env như bản web nếu muốn nối máy chủ thật)
cd desktop && npm start        # chạy thử; HATCHDAY_DEV=1 để có DevTools (F12)
npm run dist:win               # gói thư mục chạy được cho Windows trong desktop/release (đưa thư mục này lên Steam)
npm run dist:linux             # Linux / Steam Deck
```

- Phục vụ tệp qua giao thức `app://hatchday` (module ES, fetch, CSP chạy như web). CSP lấy từ `dist/_headers`.
- Giao diện tự phóng theo chiều cao cửa sổ (thiết kế cho ~1280×720); người chơi chỉnh thêm "Cỡ chữ" trong Cài đặt.
- F11 hoặc Alt+Enter: toàn màn hình. Kích thước và trạng thái cửa sổ được nhớ.
- Liên kết ngoài (https) mở bằng trình duyệt mặc định; trang không tự chuyển đi nơi khác được.
- Tích hợp Steamworks (đăng nhập, thành tựu) làm ở giai đoạn S3, xem `docs/STEAM-PLAN.md`.
