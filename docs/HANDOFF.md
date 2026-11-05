# Hatchday · Bàn giao

Cập nhật: 2026-11-05 · nhánh `main`.
Game nuôi thú ảo 3D phong cách anime cho người đi làm thế hệ 8x, 9x. Tiếng Việt. Tên Hatchday là tên tạm.
GDD (thiết kế game) nằm ở Claude Docs: https://claude.ai/artifact/QERSng65qNVArQwTthfvko. Thiết kế kỹ thuật: [TDD.md](TDD.md).
Bản chơi thử (chế độ demo, dữ liệu lưu trong trình duyệt): https://claude.ai/artifact/HXVUzK4qzkHWibSCoVD3Xg

## Trạng thái nhanh

| Mục | Trạng thái |
| --- | --- |
| Tài khoản (đăng nhập, đăng ký, quên/đặt lại mật khẩu) | Xong, đã thử với Supabase giả lập |
| Thú: 4 chỉ số, biểu cảm, hành vi rảnh, chuyển cảnh ăn/tắm/chơi/ngủ | Xong |
| Nhật ký ngày, Ký ức | Xong (nhật ký ghép tự động, chưa dùng AI) |
| Trang trí phòng, tủ đồ, cửa hàng bằng xu, nhiệm vụ ngày, sổ sưu tập | Xong |
| 50 loài, 5 miền × 4 độ hiếm, lớn lên theo tuổi, 4 dáng trưởng thành, Sổ loài | Xong |
| Đồ mặc ôm theo mọi dáng, không lẹm | Xong, có script kiểm tra tự động |
| Âm thanh: 12 tiếng hiệu ứng, nhạc nền tự sinh theo phòng/đêm/lúc ngủ, nút Tiếng/Nhạc/Âm lượng | Xong (Web Audio, không cần file âm thanh) |
| Quầy trả phí | Đã ẩn (`PAID_SHOP_ENABLED = false` trong `src/game/catalog.ts`) |
| Chạy trên Supabase thật | Chưa. Mọi thứ mới thử ở chế độ demo hoặc PGlite |

## Chạy và kiểm thử

```bash
npm install                 # có .npmrc legacy-peer-deps=true (lỗi arborist)
npm run dev                 # không có .env thì tự vào chế độ Chơi thử
npm test                    # 66 test: luật chơi + toàn bộ RPC trên Postgres thật (PGlite)
npm run build               # typecheck + build
node scripts/smoke.mjs      # sau build: chạy thật trên trình duyệt (ăn, nói chuyện, tắm, ngủ, lớn lên…)
node scripts/fit-check.mjs  # sau build: thử 3.900 tổ hợp loài × dáng × đồ mặc, phải ra 0 lẹm
```

- `?dev` trên URL: bảng duyệt biểu cảm, tua nhanh thời gian.
- `?fitcheck` chỉ để script kiểm tra đồ mặc dùng (mở `window.__fitCheck`, `window.__thumb`).
- Chế độ Chơi thử có nút **Tua 1 ngày** trong bảng Chỉ số để xem lớn lên và tiến hoá.
- Playwright dùng swiftshader nên FPS đo trong headless không có ý nghĩa.
- `?dev` cũng mở `window.__sfx('tên')` và `window.__audio()` để thử âm thanh. Âm thanh mới chỉ đo bằng máy, chưa ai nghe trên loa thật; muốn chỉnh tiếng thì sửa bảng `VOICES` trong `audio.js`.

## Kiến trúc ngắn

Vite + TypeScript + three.js + Supabase. Server là nguồn sự thật, client gửi hành động theo lô và đồng bộ lại mỗi 60 giây.

```
src/main.ts               điều hướng: tài khoản → tạo thú → game
src/data/api.ts           gọi RPC; isDemo thì chuyển sang demo-api.ts (mô phỏng RPC bằng localStorage)
src/game/store.ts         trạng thái thú, xu, đồ, bố cục, loài; gộp lô hành động
src/game/rules.ts         luật thuần: giảm chỉ số, nhật ký       (song song với private.decay_pet trong SQL)
src/game/layout.ts        đặt đồ, thoải mái, nhiệm vụ, tiệm xoay   (song song với SQL)
src/game/species.ts       50 loài, độ hiếm, giai đoạn, dáng        (song song với SQL, scripts/gen-seed.ts)
src/game/catalog.ts       danh mục vật phẩm (nguồn của seed SQL)
src/game/pet3d.js         dựng thú theo loài/giai đoạn/dáng + đo "ổ cắm" cho đồ mặc
src/game/fit.js           đặt đồ mặc vừa từng dáng thú
src/game/decor3d.js       mô hình đồ trang trí + đồ mặc (dựng bằng code)
src/game/home.js          nhà: trang trí, cửa hàng, tủ đồ, nhiệm vụ, Sổ loài
src/game/game.js          cảnh 3D, vòng lặp, camera, khu vực (~820 dòng, nối các mảng dưới đây)
src/game/face.js          mặt và biểu cảm
src/game/food.js          thức ăn + khay + cho ăn
src/game/chat.js          trò chuyện (bản mẫu)
src/game/diary.js         nhật ký, ký ức, bộ đếm hành động trong ngày
src/game/growth.js        cảnh tiến hoá + thẻ loài
src/game/audio.js         sfx()/music() tổng hợp bằng Web Audio; cài đặt trong bảng Chỉ số
supabase/migrations/      3 migration; supabase/tests/ test RPC
```

**Quy tắc quan trọng khi sửa:**
- Luật nằm ở hai nơi (client và SQL). Sửa một nơi phải sửa nơi kia. Test `decor.test.ts`, `species.test.ts`, `rpc.test.ts` so khớp hai bên.
- Đổi danh mục vật phẩm hoặc danh sách loài: sửa `catalog.ts` / `species.ts`, chạy `node --experimental-strip-types scripts/gen-seed.ts` để lấy SQL, dán vào migration mới (đừng sửa migration đã có).
- Thêm đồ mặc mới: dựng trong `decor3d.js`, thêm quy tắc đặt vào `fit.js` nếu cần, rồi chạy `fit-check`.
- Tuổi thọ thú (30–60 ngày) và món tủ chỉ server biết (`pet_secrets`), không đưa xuống client.

## Việc chưa làm, theo thứ tự đề xuất

**Ưu tiên cao**
1. **Vòng đời và gia phả.** Hiện bé dừng ở tuổi Xế chiều, không bao giờ mất. Cần: chia tay khi hết tuổi thọ, trang tưởng niệm, trứng đời sau mang tên dòng họ và thừa hưởng một phần gen, cây gia phả. (`pets.stage = 'departed'` và `generation` đã có trong schema.)
2. **Thức ăn.** Mới có 4 món, ăn miễn phí không giới hạn. GDD có nhóm dinh dưỡng cân bằng 3 ngày, khẩu vị, trồng trọt, nấu ăn, bảo quản, khoảng 12 món mẫu.
3. **Cá tính 5 trục.** Cột `pets.personality` đã có nhưng chưa dùng.

**Ưu tiên vừa**
4. Cấp Gắn bó (1–10) và mở thêm không gian (hiện chỉ có phòng khách trang trí được).
5. Sức khoẻ: bệnh và cách chữa (hiện chỉ có biểu cảm ốm khi bẩn).
6. Đồ chơi theo bảng trong GDD (mới có ném bóng, xoay vòng).
7. Màn chào mừng quay lại sau khi vắng lâu.
8. Hướng dẫn lần đầu chơi khoảng 30 giây.
9. Đồng hành giờ làm việc: nhắc giải lao, uống nước, chào sáng và tối.

**Đã hẹn để sau**
10. Tích hợp AI: trò chuyện có trí nhớ, nhật ký do AI viết mỗi đêm (Edge Function `chat` và tác vụ theo lịch, xem TDD mục 11).
11. Xã hội: thăm nhà bạn bè, khu vực chung, an toàn cộng đồng.
12. Sự kiện theo mùa, bộ đồ Lễ hội.
13. Thông báo đẩy, service worker (đã có `manifest.webmanifest`).
14. Bán cosmetic thật: cổng thanh toán, Edge Function xác minh giao dịch, rồi bật `PAID_SHOP_ENABLED`.

**Đưa lên chạy thật (chưa ai làm)**
- Tạo dự án Supabase (region Singapore), `npx supabase link`, `npx supabase db push` (3 migration), điền `.env` theo `.env.example`.
- Dashboard Authentication: Site URL và Redirect URLs, mật khẩu tối thiểu 8, rate limit, CAPTCHA, bật Google, viết lại mẫu email tiếng Việt (chi tiết TDD mục 4).
- Host tĩnh thư mục `dist/` (Vercel, Netlify hoặc Cloudflare Pages).
- Thú tạo trước migration loài sẽ được gán loài tự động theo quả trứng cũ.

**Kỹ thuật**
- Đã tách `game.js` thành các module (face, food, chat, diary, growth). Còn lại trong `game.js`: cảnh, vòng lặp, khu vực, camera, hành vi rảnh; chuyển dần sang TypeScript và đưa chữ giao diện ra file riêng để dễ dịch.
- Mô hình 3D thật (glTF) cho 50 loài khi có hoạ sĩ. `pet3d.js` dựng từ khối tròn nên nét riêng giữa các loài còn nhẹ; hệ thống sẵn sàng để thay mô hình từng loài mà không đổi luật chơi.
- Khoá đăng nhập sau 5 lần sai hiện chỉ có phía máy. Lớp bảo vệ thật là rate limit và CAPTCHA của Supabase.

## Làm việc nhóm

Xem [CONTRIBUTING.md](../CONTRIBUTING.md): quy trình nhánh, bản đồ file, và quy tắc migration (hàm SQL bị viết lại nguyên cả hàm nên dễ ghi đè âm thầm). CI chạy trên mọi PR (`.github/workflows/ci.yml`). Nên bật bảo vệ nhánh `main` (bắt buộc PR + CI xanh) trong GitHub Settings.

## Điểm cần để ý

- Lưới sàn là 8×6 ô, GDD còn ghi 6×6. Cần sửa GDD cho khớp.
- Thú tạo bằng quả trứng cũ (3 màu) không còn dùng: trứng giờ là 5 miền, mỗi lần chọn thấy 3 miền ngẫu nhiên, loài do server bốc. Tên loài cố định, người chơi đặt tên riêng và tên dòng họ.
- Server chỉ kiểm tra giới hạn lưới và số lượng sở hữu khi lưu bố cục. Việc đồ chồng nhau và còn đường đi kiểm ở client, nên một client cố tình sai có thể lưu bố cục không hợp lệ (chỉ ảnh hưởng nhà của chính họ).
- Kiểm tra thủ công trong trình duyệt thật chưa có (mới có Chromium headless). Nên thử trên điện thoại thật và màn hình cảm ứng trước khi mời người chơi.
- Bản demo trong artifact dùng localStorage. Xoá dữ liệu trình duyệt là mất thú.

## Lịch sử commit

```
(mới nhất) Tách game.js thành module, CI, CONTRIBUTING, khung âm thanh
e00099f Ẩn quầy trả phí
03c5305 Đồ mặc ôm mọi dáng + chuỗi tiến hoá trong Sổ loài
8798442 5 dáng cơ thể cho các loài
d2c786e 50 loài, giai đoạn lớn lên, dáng trưởng thành theo cách chăm
84a80f6 Trang trí nhà, trang phục, cửa hàng, kinh tế xu
6087d9d Polish rendering, animation, UX/UI
f45e716 Đặt tên Hatchday
b0f3afa Khởi tạo dự án
```
