# Worker định kỳ (hatchday-cron)

Cloudflare Worker chạy mỗi 15 phút (Cron Trigger `*/15 * * * *`), gọi các hàm chỉ-`service_role` trên Supabase:

| Việc | Hàm | Làm gì |
| --- | --- | --- |
| Thống kê và dọn dẹp | `cron_tick()` | lấy mẫu số người ở nơi chung, tổng hợp `stats_daily` hôm nay/hôm qua (dashboard admin), dọn log chat 24 giờ, mã quảng cáo, phiên cũ |
| Thông báo đẩy | `push_pick()` → gửi Web Push → `push_mark()` | chọn người cần nhắc (bé cần chăm, thư, sự kiện), mã hoá và gửi, ghi kết quả; 404/410 thì xoá đăng ký |

Mã nguồn: `worker.js` (điều phối), `webpush.js` (mã hoá aes128gcm RFC 8291 + VAPID RFC 8292 bằng WebCrypto, không phụ thuộc thư viện).
Test: `npx vitest run workers` (mã hoá được giải lại bằng bộ giải mã độc lập và đã đối chiếu với thư viện `web-push`).

## Biến

| Tên | Loại | Ghi chú |
| --- | --- | --- |
| `SUPABASE_URL` | thường | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | secret | khoá `service_role` của dự án Supabase; chỉ ở Worker |
| `VAPID_PUBLIC` | thường | khoá công khai VAPID (base64url, 87 ký tự); trùng `VITE_VAPID_PUBLIC_KEY` lúc build game |
| `VAPID_PRIVATE_JWK` | secret | khoá riêng VAPID dạng JWK (JSON); không đưa vào trình duyệt |
| `VAPID_SUBJECT` | thường | `https://hatchday.noxelis.co` (hoặc `mailto:`) |

Thiếu cặp VAPID thì Worker chỉ chạy `cron_tick`, bỏ qua push.

## Triển khai

1. Tạo khoá VAPID một lần: `node workers/cron/gen-vapid.mjs > vapid.json` (không commit tệp này).
2. Đăng Worker và đặt biến/secret qua API Cloudflare (`PUT /accounts/<id>/workers/scripts/hatchday-cron`, nhiều module: `worker.js` + `webpush.js`), đặt lịch
   `PUT …/schedules [{"cron":"*/15 * * * *"}]`. Đặt lịch cần tài khoản đã có workers.dev subdomain (mở trang Workers & Pages trong dashboard một lần để tạo).
3. Build game với `VITE_VAPID_PUBLIC_KEY=<publicKey>`, bật cờ `push.enabled` ở admin (tab Hệ thống) khi sẵn sàng.

## Giới hạn đã biết

- Mỗi lượt chọn tối đa 5 người (≤ 5 thiết bị mỗi người) để giữ số lần gọi con dưới giới hạn gói Workers miễn phí (50).
- Chưa thử giao thức thật tới FCM/Apple/Mozilla trong môi trường phát triển; cần thử trên thiết bị thật. iPhone chỉ nhận push khi đã Thêm vào Màn hình chính.
