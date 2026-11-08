# Kế hoạch phát hành Hatchday miễn phí trên Steam

Quyết định đã chốt (2026-11-08):
- **Ngôn ngữ**: tiếng Việt + tiếng Anh ngay bản phát hành.
- **Đăng nhập**: tự đăng nhập bằng tài khoản Steam (vé xác thực Steam → tài khoản Hatchday); bản web giữ email.
- **Kiếm tiền**: bản Steam tắt quảng cáo thưởng và liên kết ủng hộ bên ngoài (quy định Steam); thêm DLC "Supporter Pack" (không cho lợi thế). Bản web giữ nguyên.
- **Art và âm thanh**: nâng toàn bộ bằng code (mô hình, hoạt ảnh, ánh sáng, hiệu ứng, nhạc, tiếng).

Một mã nguồn, hai bản build: `web` (như hiện tại) và `steam` (`VITE_PLATFORM=steam`, đóng gói Electron).

## Giai đoạn

### S1. Nền tảng máy tính (desktop-first)
- Cờ nền tảng `PLATFORM` (`web` | `steam`): bản Steam bỏ trang giới thiệu/đăng ký email, bỏ quảng cáo, bỏ link ủng hộ, bỏ cài PWA/push trình duyệt.
- Vỏ Electron (`desktop/`): cửa sổ 1280×720 mặc định, toàn màn hình (F11 / Alt+Enter), nhớ kích thước, một phiên bản duy nhất, chặn mở trang lạ, CSP như bản web, tự tắt DevTools ở bản phát hành; electron-builder cho Windows (bắt buộc), Linux/Steam Deck, macOS (sau).
- Bảng **Cài đặt** đầy đủ (thay phần cài đặt rải trong Chỉ số): đồ hoạ (Thấp/Vừa/Cao/Rất cao, độ phân giải nội bộ, giới hạn FPS, VSync, bóng, khử răng cưa), âm thanh (tổng/nhạc/tiếng), hiển thị (toàn màn hình, cỡ chữ giao diện), ngôn ngữ, điều khiển, tài khoản.
- Bố cục 16:9 chuẩn ở 1280×720, 1920×1080, 2560×1440 và 1280×800 (Steam Deck); phím tắt cho mọi hành động chính.

### S2. Đa ngôn ngữ (Việt + Anh)
- `t('…')` / `` t`…${x}…` `` với câu tiếng Việt làm khoá, từ điển `src/i18n/en.json`; số, ngày, tiền xu định dạng theo ngôn ngữ.
- Chuỗi từ máy chủ (tên vật phẩm, thư hệ thống, tin tức) dịch ở phía client theo cùng từ điển; thư có tham số chuyển sang mã + tham số.
- Kiểm tra tự động: quét mã tìm chuỗi tiếng Việt chưa bọc `t()`, khoá thiếu bản dịch, chữ tiếng Anh bị lẹm/tràn (fit-check chạy cả hai ngôn ngữ).
- Trang chủ, Điều khoản, Quyền riêng tư, trang cửa hàng Steam bản tiếng Anh.

### S3. Tích hợp Steam
- `steamworks.js` trong tiến trình chính Electron; thử bằng App ID 480 khi chưa có App ID thật.
- Đăng nhập Steam: client lấy vé (`getAuthTicketForWebApi`) → Edge Function `steam-auth` gọi `ISteamUserAuth/AuthenticateUserTicket` (khoá Web API của nhà phát hành) → tạo/tìm người dùng Supabase gắn SteamID → trả phiên đăng nhập. Liên kết tài khoản email sẵn có với Steam (tuỳ chọn).
- Thành tựu Steam ánh xạ từ huy hiệu và mốc chơi (Gắn bó cấp 10, đủ 50 loài, …); Rich Presence ("Đang ở Quảng trường"); overlay; Steam Cloud không cần (dữ liệu ở máy chủ).
- Kiểm tra quyền DLC Supporter Pack → huy hiệu/khung tên cảm ơn (chỉ trang trí).

### S4. Tay cầm và Steam Deck
- Điều hướng giao diện bằng tay cầm (vòng focus rõ ràng, D-pad/stick, A/B), con trỏ ảo cho cảnh 3D, gợi ý nút theo thiết bị.
- Bàn phím ảo Steam cho ô nhập chữ (`ShowGamepadTextInput`); chữ đọc được ở 1280×800; cấu hình tay cầm mặc định.
- Mục tiêu: Steam Deck Verified.

### S5. Nâng chất lượng (liên tục)
- Thú cưng: hình khối mượt hơn, mắt/miệng biểu cảm, hoạt ảnh nghỉ, đi, nhảy, phản ứng; chuyển cảnh lớn lên đẹp.
- Cảnh: hậu kỳ (bloom nhẹ, ánh sáng môi trường, chỉnh màu theo giờ), hiệu ứng hạt, nước, cây cỏ đung đưa, chi tiết nội thất.
- Âm thanh: nhạc theo nơi và theo giờ (nhiều bài, chuyển mượt), tiếng bước chân/môi trường, phối âm.
- Giao diện: bộ biểu tượng thống nhất, chuyển động UI, phản hồi khi bấm, màn tải.
- Hiệu năng: 60 FPS ở GPU tích hợp tầm trung; đo bằng HUD và profile, giảm draw call.

### S6. Trang cửa hàng và phát hành
- Ảnh capsule (header 920×430, small 462×174, main 1232×706, vertical 748×896, library 600×900, hero 3840×1240, logo), ≥5 ảnh 1920×1080, trailer 30–60 giây (dựng từ cảnh trong game + ffmpeg), mô tả Việt/Anh.
- Khảo sát nội dung Steam, chính sách quyền riêng tư bản Anh, kênh hỗ trợ.
- Script đóng gói và tải lên (steamcmd + depot), nhánh beta để thử nội bộ, Playtest.

## Chỉ chủ dự án làm được
- Tài khoản Steamworks (phí 100 USD/ứng dụng), thông tin thuế/ngân hàng, App ID, tạo DLC Supporter Pack.
- Khoá Steam Web API của nhà phát hành (dán qua form an toàn, không gửi trong chat).
- Đăng nhập steamcmd để tải bản build lên; thử trên máy thật và Steam Deck.
- Đồng ý áp migration và triển khai lên máy chủ thật.

## Thứ tự làm
S1 → S2 → S3 (đăng nhập + thành tựu) → S4 → S6, còn S5 làm xen kẽ suốt quá trình.
