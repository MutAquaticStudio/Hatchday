# Kế hoạch: chế độ xã hội và trang quản trị (admin)

Trạng thái: **bản thiết kế, chưa có dòng code nào**. Viết để nhóm duyệt và chốt các câu hỏi mở ở mục 13 trước khi làm.
Nền hiện có: xem [HANDOFF.md](HANDOFF.md) và [TDD.md](TDD.md). Mọi con số trong tài liệu này là đề xuất, cần chỉnh khi có người chơi thật.

## Cập nhật quyết định (sau khi PR #1 gộp)

Bản thiết kế này đã được đối chiếu với code và thay đổi như sau. Kế hoạch triển khai chi tiết nằm trong các PR; phần này là chỗ khác với bản gốc bên dưới:

1. **Chat công cộng gõ chữ bật sẵn** (mục 5 và 13 #2 bên dưới viết là tuỳ chọn). Cờ `chat.public.enabled` ở bản chạy thật giữ tắt cho tới khi chốt pháp lý và có người kiểm duyệt.
2. **`post_chat` là RPC SQL** rồi phát bằng `realtime.send`, không phải Edge Function (Edge Function để dành cho AI).
3. **"Bệnh nặng chỉ chữa ở bệnh viện" chỉ chặn ở giao diện**: máy chủ không biết vị trí, và `needs_clinic` đã ép bệnh nặng ra phòng khám, nên không sửa `visit_clinic` (mục 7 và 10 bên dưới).
4. **Không thêm nút thứ 7 vào thanh dưới** (không vừa 390px): Bản đồ vào bằng chip tên khu vực ở góc trên và một ô trong menu Nhà.
5. **Admin là `vite.admin.config.ts` riêng**, không phải điểm vào thứ hai trong build game.
6. **Hook sự kiện hoãn**: giảm giá, tăng xu và mùa cúm phải viết lại các hàm mua hàng và `private.earn`, nên làm ở một migration "hooks" có một chủ; lát cắt đầu của sự kiện chỉ dùng hàm mới và trigger.
7. **Realtime làm bản mô phỏng trước** (bạn ảo, nhiều tab); bản Supabase viết sẵn nhưng tắt cờ cho tới khi có dự án thật.
8. **Trần kênh mặc định 12 người (gói Free) hoặc 20 (Pro)**, đọc từ cờ hệ thống; người chơi gửi ý định đi chứ không gửi vị trí liên tục.

## 1. Mục tiêu và nguyên tắc

Hatchday là game nuôi thú ấm áp cho người đi làm. Chế độ xã hội phải giữ đúng chất đó: **gặp gỡ nhẹ nhàng, không so đo, không ép**.

1. **An toàn trước tính năng.** Không mở chat khi chưa có chặn, báo cáo, giới hạn tốc độ và người duyệt. Vì vậy trang quản trị làm **trước** chat công cộng.
2. **Server là nguồn sự thật**, như phần còn lại của game. Quà, xu, bạn bè, giới hạn mỗi ngày đều nằm trong SQL, có test; client chỉ hiển thị.
3. **Luật ở hai nơi** (TS và SQL) vẫn áp dụng cho mọi con số có thể tính trước ở client (giới hạn quà, giá).
4. **Chơi một mình vẫn trọn vẹn.** Người không muốn xã hội tắt được hoàn toàn (không nhận lời mời, không hiện trên bản đồ).
5. **Điện thoại là hạng nhất**: mọi màn hình ở đây dùng được bằng cú chạm, nút tối thiểu 40px, thêm vào `scripts/mobile-check.mjs`.
6. **Không có tiền thật trong trao đổi giữa người chơi.** Không chuyển xu trực tiếp giữa người chơi (tránh mua bán xu, lừa đảo, farm tài khoản). Chỉ tặng quà là vật phẩm, có giới hạn.
7. **Realtime chỉ dùng cho chuyện thật sự cần tức thời** (chat, hiện diện ở khu chung). Còn lại (quà, lời mời, thăm nhà) dùng RPC thường, mở lại là thấy.

## 2. Những gì đã có để gắn vào

| Có sẵn | Dùng cho |
| --- | --- |
| Sổ sức khoẻ, thuốc, phòng khám, 8 bệnh (`health.ts`, `clinic.js`) | **Bệnh viện** trên bản đồ; bệnh lây khi gặp bạn |
| Cửa hàng: Thức ăn, Chợ, Tiệm hôm nay, Chợ cuối tuần (`home.js`) | **Chợ** trên bản đồ |
| Vườn rau, mảnh đất, trang trí nông trại (`garden3d.js`) | Thăm vườn bạn, tưới giúp |
| Phòng khách trang trí 3 ô bố cục (`room_layouts`) | Thăm nhà bạn |
| Gắn bó cấp 1–10 (`bond.ts`) | Mở khoá địa điểm, hạn mức bạn bè |
| Gia phả, tên dòng họ, Sổ loài | Hồ sơ công khai |
| Quà theo bộ sưu tập, nhiệm vụ, `entitlements` (kho) | Hộp thư quà |
| Tuần cuối tuần, tiệm xoay (`private.rotation`) | Sự kiện theo mùa dùng chung cơ chế |
| Chưa có: chạy trên Supabase thật, hồ sơ công khai, thông báo đẩy, quyền quản trị | Làm ở giai đoạn 0 |

## 3. Bản đồ thế giới

Một màn hình **Bản đồ** (nút mới trên thanh dưới, thay chỗ nút Nhà thành menu hai tầng, hoặc thêm nút Bản đồ cạnh Nhà). Người chơi chạm vào một địa điểm để đi tới; có hiệu ứng chuyển cảnh như `goTo()` hiện nay.

| Địa điểm | Chung hay riêng | Làm gì | Ghi chú |
| --- | --- | --- | --- |
| **Nhà** | Riêng | Phòng khách, bếp, tắm, ngủ (đã có) | Cho bạn bè ghé thăm (mục 6) |
| **Vườn nhà** | Riêng | Vườn rau, nông trại (đã có) | Bạn bè ghé thăm, tưới giúp |
| **Quảng trường** (khu gặp gỡ) | **Chung, realtime** | Gặp người chơi khác, chat công cộng, biểu cảm, kết bạn | Mục 5 |
| **Chợ** | Chung (nhìn thấy nhau), mua bán riêng tư | Cửa hàng hiện tại dời vào đây; sau này: sạp trao đổi | Mục 10 |
| **Bệnh viện** | Chung (phòng chờ), chữa riêng tư | Phòng khám hiện tại dời vào đây; bệnh nặng chỉ chữa ở đây | Mục 10 |
| **Công viên** | Chung, realtime | Chơi đồ chơi chung, mini-game nhẹ, sự kiện ngoài trời | Giai đoạn sau |
| **Quán quà** (tuỳ chọn) | Riêng | Gói quà, viết thiệp, gửi cho bạn | Có thể gộp vào Chợ |

Quy tắc:
- **Mở khoá theo Gắn bó** (đề xuất): Quảng trường và Chợ mở từ cấp 2 (sau vài ngày chơi, để người mới làm quen đã); Công viên từ cấp 4. Bệnh viện mở luôn (bé ốm không được bị khoá).
- Mỗi địa điểm chung có nhiều **kênh** (shard) tối đa 20 người; vào kênh đang còn chỗ, hoặc kênh có bạn bè.
- Khi đi đâu, thú của bạn **đi cùng**: hiện thú, đồ đang mặc, tên. Không hiện chỉ số, Gắn bó, xu.
- Ngủ hoặc đang ốm: vào Bệnh viện được, các nơi chung khác hiện biểu tượng "đang nghỉ" (bé ốm lây bệnh, xem mục 7).
- Người tắt chế độ xã hội chỉ thấy Nhà, Vườn nhà, Chợ và Bệnh viện ở **bản một mình** (không có người khác).

Phác thảo màn hình điện thoại (390×844): bản đồ vẽ dạng minh hoạ 2D, các địa điểm là nút lớn có biểu tượng, huy hiệu số người đang ở đó ("Quảng trường · 14 người"), huy hiệu đỏ khi có quà/lời mời. Khoá hiện ổ khoá kèm "Cần Gắn bó cấp 2".

## 4. Hạ tầng cần có trước

Hiện mọi thứ mới thử ở chế độ Chơi thử và PGlite. Trước khi làm xã hội cần **giai đoạn 0**:

1. Tạo dự án Supabase thật (HANDOFF mục "Đưa lên chạy thật"), `db push`, xác thực, rate limit, CAPTCHA.
2. **Hồ sơ công khai** `public_profiles` (tên hiển thị, thú đang nuôi: loài, dáng, đồ mặc, cấp Gắn bó đã làm tròn; không có email, múi giờ, xu). Chỉ chứa thứ người khác được thấy.
3. Mã bạn bè ngắn (`friend_code`, 8 ký tự, bỏ chữ dễ nhầm) để kết bạn không cần lộ email.
4. Vai trò quản trị (mục 12) và nhật ký kiểm toán.
5. Quy trình triển khai migration có kiểm duyệt (CONTRIBUTING đã có quy tắc).
6. **Quyết định pháp lý** (mục 13): độ tuổi, xác thực tài khoản, lưu trữ chat. Cần chốt trước khi mở chat.

## 5. Quảng trường và chat công cộng (realtime)

### Mô hình
- Mỗi địa điểm chung có các **kênh** `place:{địa điểm}:{số}`. RPC `join_place(place)` chọn kênh còn chỗ (ưu tiên kênh có bạn), kiểm tra mở khoá, bị cấm chat hay không, rồi trả về tên kênh.
- **Supabase Realtime** (Broadcast và Presence), kết nối WebSocket:
  - Presence: ai đang ở kênh (id, tên, loài, đồ mặc, trạng thái).
  - Broadcast: vị trí (≈ 4–5 lần/giây, chỉ gửi khi di chuyển), biểu cảm, tin nhắn chat.
  - **Vị trí không lưu vào CSDL.** Chat công cộng **không lưu** (hoặc chỉ lưu 24 giờ cho kiểm duyệt, xem mục 9).
- Kiểm soát ai được vào kênh bằng **Realtime Authorization** (chính sách RLS trên kênh riêng tư), không cho tự đặt tên kênh.
- Client nội suy vị trí người khác, dùng lại hệ thống đi lại đã có (`walkPetTo`, `steerTo`). Số lượng thú hiển thị tối đa 20; ở xa dùng mô hình đơn giản.

### Chat công cộng
- Bóng thoại trên đầu thú (dùng lại `#bubble`) và một khung nhật ký chat có thể thu gọn.
- Độ dài tối đa 100 ký tự, 1 tin mỗi 2 giây, 20 tin mỗi phút (kiểm ở server bằng bộ đếm trong CSDL hoặc Edge Function trước khi phát).
- **Lọc từ khoá** (danh sách quản trị chỉnh được, không deploy), chặn link, chặn số điện thoại/email, thay bằng `***`.
- Mỗi tin có nút **Báo cáo**; mỗi người có **Chặn** và **Ẩn chat** (tắt toàn bộ chat công cộng, chỉ còn biểu cảm).
- Biểu cảm nhanh (emote): 8 cái dựng sẵn, không cần gõ chữ. Đây là cách giao tiếp mặc định, chat gõ là tuỳ chọn bật.
- Phát tin qua **Edge Function** `post_chat` (kiểm tra cấm chat, lọc từ, giới hạn tốc độ) chứ không để client phát thẳng, để chặn được.

### Chi phí và giới hạn cần kiểm tra
Số kết nối đồng thời, số tin mỗi giây và giá phụ thuộc gói Supabase. **Cần đo bằng thử tải** trước khi mở rộng; đề xuất bắt đầu giới hạn tổng số người đồng thời ở khu chung và hiện "Quảng trường đang đầy, thử lại sau" khi vượt.

## 6. Bạn bè và thăm nhà

### Kết bạn
Bảng `friendships (a, b, status, created_at)` với `a < b` để mỗi cặp một dòng; `status`: `pending`, `accepted`, `blocked`. Lời mời có `from` để biết ai gửi.

| RPC | Làm gì | Lỗi |
| --- | --- | --- |
| `find_by_code(code)` | Trả hồ sơ công khai của một người | `not_found` |
| `send_friend_request(user)` | Gửi lời mời (từ Quảng trường hoặc theo mã) | `blocked`, `limit`, `exists`, `rate_limited` |
| `respond_friend_request(user, accept)` | Nhận hoặc từ chối | `not_found` |
| `remove_friend(user)`, `block_user(user)` | Xoá bạn, chặn (chặn xoá luôn quan hệ và ẩn nhau) | |
| `list_friends()` | Danh sách bạn, trạng thái, lần cuối ở đâu (nếu bật hiện diện) | |

- Hạn mức bạn: 30 ở cấp Gắn bó 2, tăng dần tới 100 ở cấp 10 (đề xuất).
- Lời mời hiện ở hộp thư và huy hiệu trên nút Bản đồ. Không có tìm theo tên trong giai đoạn đầu (tránh quấy rối); chỉ theo mã hoặc từ Quảng trường.
- Quyền riêng tư: bật/tắt "ai được kết bạn" (mọi người / không ai), "hiện trạng thái online" (bạn bè / không ai).

### Thăm nhà và vườn bạn
- RPC `get_visit(friend)` trả **ảnh chụp công khai**: bố cục phòng đang dùng, bố cục nông trại, thú (loài, dáng, đồ mặc, tên), không trả chỉ số, xu, kho, bí mật. Chỉ cho bạn bè (`accepted`).
- Client dựng cảnh chỉ xem bằng đúng bộ dựng hiện tại (`renderRoom`, `garden3d.sync`), thêm thú của bạn.
- Tương tác nhẹ, có giới hạn, ghi vào bảng `visit_log`:
  - Vuốt ve thú bạn: bạn bè thấy "đã ghé thăm", thú vui một chút (cộng Vui nhỏ cho thú bạn, tối đa 1 lần/người/ngày).
  - **Tưới giúp** cây của bạn (rút thời gian chín theo luật tưới hiện có, tối đa 1 lần/cây/ngày, người giúp nhận xu nhỏ, tối đa 3 lần/ngày). Cần mở rộng `water_crop` thành `water_friend_crop` (hàm mới, không viết lại hàm cũ).
  - **Sổ lưu bút**: để lại một biểu tượng cảm xúc hoặc câu có sẵn (không gõ tự do ở giai đoạn đầu).
- Không sửa được đồ của nhà bạn. Không lấy được gì.

## 7. Bệnh trong bối cảnh xã hội

Nền đã có (8 bệnh, mục 7d của TDD). Mở rộng khi có xã hội:

- **Bệnh viện** là nơi chữa. Bệnh nặng (đã để 24 giờ) **chỉ chữa ở Bệnh viện** (thay vì phòng khám tại nhà như hiện tại; thay đổi này cần sửa `visit_clinic` và test). Bệnh nhẹ vẫn dùng thuốc ở nhà.
- **Bệnh lây** (mới): thêm bệnh **Cúm** (không do bỏ bê). Điều kiện: ở cùng kênh với thú đang bị cúm ≥ 10 phút → 25% mỗi lần kiểm tra mất 10 phút lây (giới hạn mỗi người 1 lần lây/ngày để không tạo dịch dây chuyền khó kiểm soát). Cúm tự khỏi sau 6 giờ hoặc uống thuốc. Bé ốm vẫn vào được Quảng trường nhưng hiện **biểu tượng ốm** để người khác biết và tránh. Người chơi có thể **bật "chế độ cách ly"** (không vào khu chung khi đang ốm) để khỏi bị trách.
- **Mùa cúm** là sự kiện do admin bật (mục 11): tăng xác suất lây, giảm giá thuốc.
- Bác sĩ NPC ở Bệnh viện, phòng chờ có người chơi khác (nhìn thấy nhau, trò chuyện bằng emote).
- Tặng thuốc cho bạn đang ốm (một loại quà, mục 8) là cách tương tác ấm áp.
- Thảo dược trồng ở vườn để làm thuốc: cân nhắc giai đoạn sau (thêm cây gừng, bạc hà vào `crops`).

## 8. Tặng quà và hộp thư

Một **hộp thư** chung cho mọi thứ nhận được, kể cả quà của quản trị:

```
mailbox (id, to_user, from_user null=hệ thống, kind: gift|system|reward|friend_request,
         items jsonb  [{id, qty}], coins int, note text ≤ 80, created_at, expires_at, claimed_at)
```

- **Quà giữa người chơi**: chỉ giữa bạn bè (≥ 3 ngày kể từ lúc kết bạn). Gửi **vật phẩm từ kho của người gửi** (thức ăn, thuốc, đồ trang trí mua bằng xu, đồ mặc), không gửi xu, không gửi đồ trả phí hay đồ không bán được. Trừ khỏi kho người gửi lúc gửi.
- Giới hạn: tối đa 3 quà mỗi ngày mỗi người gửi, 1 quà mỗi ngày cho cùng một bạn, tối đa 5 món mỗi quà, kho người nhận không vượt trần (thức ăn 30, thuốc 10; vượt thì quà nằm lại hộp thư tới khi có chỗ).
- Lời nhắn đi kèm chỉ chọn từ **mẫu có sẵn** ở giai đoạn đầu ("Chúc bạn khoẻ!", "Cảm ơn nhé!"), sau mới cho gõ (qua cùng bộ lọc).
- Hộp thư hết hạn sau 30 ngày (quà bị trả lại người gửi), người nhận **bấm Nhận** mới vào kho (một lần, không nhận hai lần).
- RPC: `send_gift`, `list_mailbox`, `claim_mail(id)`, `claim_all_mail()`, `delete_mail(id)`.
- Đề xuất nhẹ để người nhận cảm ơn lại bằng một biểu tượng, tạo vòng tương tác tích cực.

Quà **từ quản trị** (mục 12) vào cùng hộp thư với `from_user = null`, có thể kèm xu và vật phẩm, hẹn giờ, nhắm một người, một nhóm hoặc tất cả.

## 9. Chat riêng (tin nhắn trực tiếp)

- Chỉ giữa **bạn bè**. Hai người có thể chặn nhau bất cứ lúc nào, chặn là ẩn cả hội thoại.
- Bảng `dm_messages (id, thread, from_user, body ≤ 200, created_at, read_at)` với `thread` = cặp người; RLS chỉ cho hai người trong cuộc đọc.
- Nhận tin tức thời bằng Realtime (kênh riêng của từng người: `user:{id}`), mở lại thì tải lịch sử bằng RPC có phân trang.
- Giới hạn: 20 tin mỗi phút, bộ lọc giống chat công cộng, giai đoạn đầu **không gửi ảnh, link, tệp**.
- Lưu 30 ngày, tự xoá cũ hơn. Người dùng xoá được hội thoại phía mình.
- Báo cáo: người báo cáo gửi kèm **20 tin gần nhất** của hội thoại làm bằng chứng (server lấy, client không tự gửi nội dung).
- Chấm "chưa đọc" trên nút Bản đồ và trên bạn.
- Thông báo đẩy khi có tin mới: cần service worker (HANDOFF mục 9), làm sau.

## 10. Bệnh viện và Chợ trên bản đồ

### Bệnh viện
Dời nội dung **Sổ sức khoẻ** (thẻ bệnh, tủ thuốc, từ điển bệnh) vào một địa điểm có không gian 3D nhỏ: quầy tiếp đón, bác sĩ NPC, phòng chờ chung. Nhà vẫn giữ nút **Sức khoẻ** nhanh (cho thuốc ở nhà). Đổi luật: bệnh nặng và bệnh lây (Cúm) chỉ chữa tại đây.

### Chợ
- **Cửa hàng** hiện tại (Chợ, Tiệm hôm nay, Chợ cuối tuần, Thức ăn) dời vào Chợ chung, thấy người khác đi qua.
- **Bán rau thừa** (hiện chưa có): bán nông sản lấy xu với giá cố định thấp hơn giá mua, tránh lạm phát nhưng giúp dọn kho khi hỏng. Cần thêm hàm mới `sell_food`.
- **Sạp trao đổi** giữa người chơi (rủi ro cao về gian lận và lạm phát): **không làm** ở giai đoạn đầu. Nếu làm sau: chỉ đổi vật phẩm ngang giá trị với vật phẩm (không bằng xu), có hạn mức hằng ngày, có xác nhận hai bên.
- Chợ sự kiện: gian hàng theo mùa (mục 11).

## 11. Sự kiện (events)

Mô hình **dựa trên dữ liệu**, không cứng trong code, để quản trị tạo được mà không phải deploy.

```
events (id, title, kind: seasonal|limited|community|epidemic, starts_at, ends_at, enabled,
        config jsonb, banner text, created_by)
event_progress (event, user, progress jsonb, claimed jsonb)      -- tiến độ từng người
event_global (event, counters jsonb)                             -- mục tiêu cộng đồng (tổng toàn máy chủ)
```

`config` mô tả hiệu ứng bằng các "mô-đun" có sẵn, mỗi mô-đun là một hàm server nhỏ, kiểm thử được:

| Mô-đun | Ví dụ | Chạm tới |
| --- | --- | --- |
| `shop_discount` | Giảm 20% đồ nông trại | `buy_item`, `buy_food` (đọc giảm giá qua hàm `private.price_of`) |
| `shop_feature` | Thêm bộ đồ Lễ hội vào Chợ sự kiện | `items.source`, `buyable()` |
| `quest_bonus` | Nhiệm vụ riêng của sự kiện, thưởng xu | `get_quests` (mở rộng bằng hàm riêng, không viết lại) |
| `coin_boost` | Xu chăm sóc ×2 cuối tuần | `private.earn` |
| `epidemic` | Mùa cúm: xác suất lây, giảm giá thuốc | `health_step`, giá thuốc |
| `community_goal` | Cả server cùng thu 100.000 cà rốt, mọi người nhận quà | `event_global`, `harvest_crop` |
| `plaza_decor` | Trang trí Quảng trường theo mùa | client, đọc `get_active_events()` |

Ghi chú: các hàm gốc (`buy_item`, `private.earn`, `get_quests`) **không viết lại**; thêm điểm gọi (hook) nhỏ một lần, các sự kiện sau chỉ thêm dữ liệu. Khi cần viết lại hàm, theo quy tắc migration của CONTRIBUTING.

Client đọc `get_active_events()` lúc mở game và mỗi 5 phút, hiện **biểu ngữ** và mục "Sự kiện" trong Nhà. Bật/tắt khẩn cấp từ quản trị (công tắc `enabled`).

## 12. Trang quản trị (admin dashboard)

### Kiến trúc
- Ứng dụng web **riêng** (thư mục `admin/` cùng kho, build tách khỏi game), chỉ người có vai trò mới vào được. Đăng nhập bằng tài khoản Supabase có **vai trò** trong bảng `admin_roles`, bắt buộc xác thực hai bước.
- **Không bao giờ** đưa khoá service xuống trình duyệt. Mọi thao tác đi qua **RPC `admin_*`** (security definer, kiểm vai trò ở đầu hàm) hoặc Edge Function dùng service role phía server.
- **Mọi** thao tác ghi đều ghi `admin_audit (id, admin, action, target, before, after, reason, created_at)`, không sửa được. Hành động nhạy cảm bắt buộc nhập **lý do**.
- Hành động lớn (quà cho toàn máy chủ, số xu lớn, cấm vĩnh viễn) cần **duyệt hai người**.

### Vai trò
| Vai trò | Quyền |
| --- | --- |
| `owner` | Mọi thứ, quản lý vai trò |
| `ops` | Sự kiện, danh mục, cân bằng, thông báo hệ thống |
| `support` | Xem hồ sơ người chơi (chỉ đọc), tặng quà nhỏ, khôi phục |
| `moderator` | Hàng đợi báo cáo, cấm chat, cấm tạm thời |
| `analyst` | Chỉ đọc số liệu tổng hợp, không thấy dữ liệu cá nhân |

### Màn hình

1. **Tổng quan**: người chơi hoạt động mỗi ngày, thú đang sống theo loài, tỉ lệ ốm theo bệnh, xu tạo ra và xu tiêu (kinh tế), số quà đã gửi, số người ở Quảng trường, báo cáo đang chờ. (Dùng skill dataviz khi dựng.)
2. **Người chơi**: tìm (tên, mã bạn bè, email chỉ cho `support` trở lên). Hồ sơ **chỉ đọc**: thú, gia phả, ví, kho, bố cục, lịch sử quà, báo cáo liên quan. Hành động: tặng quà, trừ/thưởng xu có lý do, đặt lại món bị lỗi, khoá/mở khoá, cấm chat.
3. **Tặng quà**: soạn thư (tiêu đề, lời nhắn, vật phẩm, xu), chọn người nhận (một người, danh sách mã, nhóm theo điều kiện như "bé còn sống, cấp Gắn bó ≥ 3", toàn bộ), **hẹn giờ**, **xem trước số người nhận**, **ngân sách trần**, duyệt hai người nếu vượt ngưỡng. Gửi vào hộp thư (mục 8), người nhận bấm Nhận. Có **thu hồi** quà chưa nhận.
4. **Sự kiện**: tạo/sửa từ mẫu (mục 11), hẹn giờ bắt đầu/kết thúc, xem trước (chế độ "thử với tài khoản của tôi"), công tắc tắt khẩn cấp, theo dõi tiến độ cộng đồng.
5. **Danh mục & cân bằng**: sửa giá, thưởng, ngưỡng bệnh, quà Gắn bó, tiệm xoay, công thức **không cần deploy** qua bảng `balance_config` (jsonb có phiên bản; server đọc, client nhận qua `get_config()`). Mỗi lần sửa có phiên bản và hoàn tác. Lưu ý quan trọng: hiện các con số này nằm cố định ở `catalog.ts`, `health.ts`, `bond.ts` **và** SQL (luật ở hai nơi). Để chỉnh từ admin phải chuyển các hằng số đó sang cấu hình dữ liệu có chung nguồn; đây là việc lớn, nên làm **trước hoặc cùng** admin v1 và chỉ cho những con số hay chỉnh (giá, thưởng, ngưỡng), không phải mọi luật.
6. **Kiểm duyệt**: hàng đợi báo cáo (nội dung, ngữ cảnh 20 tin, người báo cáo, lịch sử người bị báo cáo), xử lý một chạm (bỏ qua, cảnh cáo, cấm chat 1 giờ/1 ngày/7 ngày, cấm tài khoản), gửi thông báo cho người bị xử lý, quản lý **danh sách từ khoá**.
7. **Thông báo hệ thống**: biểu ngữ trong game, báo bảo trì, đóng/mở các địa điểm chung.
8. **Nhật ký kiểm toán**: ai làm gì, lúc nào, trước/sau, lọc theo người/hành động.

### Phác thảo dữ liệu và RPC quản trị

| Bảng | Ghi chú |
| --- | --- |
| `admin_roles (user, role)` | Ai là quản trị |
| `admin_audit` | Nhật ký không sửa |
| `mailbox` | Hộp thư quà (mục 8), dùng chung |
| `gift_campaigns (id, audience jsonb, items, coins, note, send_at, status, approved_by)` | Chiến dịch quà |
| `events`, `event_progress`, `event_global` | Mục 11 |
| `reports (id, kind, reporter, target, context jsonb, status, handled_by)` | Báo cáo |
| `sanctions (user, kind, until, reason, by)` | Cấm chat, cấm tài khoản |
| `balance_config (key, value jsonb, version, updated_by)` | Cân bằng |
| `word_filter (word, action)` | Danh sách từ khoá |

RPC: `admin_search_user`, `admin_get_user`, `admin_grant`, `admin_revoke`, `admin_create_campaign`, `admin_approve_campaign`, `admin_upsert_event`, `admin_set_event_enabled`, `admin_resolve_report`, `admin_sanction`, `admin_set_config`, `admin_dashboard_stats`.

Test: mỗi RPC có test PGlite kiểm tra **không đủ vai trò thì từ chối**, và mọi hành động ghi để lại dòng kiểm toán.

## 13. Rủi ro và câu hỏi cần quyết định

| # | Câu hỏi | Gợi ý |
| --- | --- | --- |
| 1 | **Pháp lý và độ tuổi**: game có chat và kết bạn có thể phải xác thực tài khoản và có quy định riêng về dịch vụ tương tác trực tuyến tại Việt Nam (ví dụ Nghị định 147/2024/NĐ-CP, chưa kiểm chứng trong phiên làm việc này). | Hỏi tư vấn pháp lý **trước** khi mở chat; đặt độ tuổi tối thiểu rõ ràng (đề xuất 16+, nhắm người đi làm) |
| 2 | Chat công cộng gõ chữ hay chỉ emote ở giai đoạn đầu? | Bắt đầu **emote + chat gõ bật tuỳ chọn**, đo báo cáo rồi mới mặc định |
| 3 | Lưu chat bao lâu? | Chat công cộng 24 giờ (để kiểm duyệt), chat riêng 30 ngày; ghi rõ trong điều khoản |
| 4 | Có cho trao đổi vật phẩm giữa người chơi? | Chỉ **tặng quà** có hạn mức; **không** đổi/bán lại giữa người chơi ở giai đoạn đầu |
| 5 | Admin cùng kho hay kho riêng? | Cùng kho (`admin/`) để dùng chung migration và test; triển khai tách hẳn |
| 6 | Số người tối đa mỗi kênh và tổng đồng thời? | 20 mỗi kênh; thử tải rồi chốt trần tổng |
| 7 | Con số cân bằng đưa vào cấu hình dữ liệu tới mức nào? | Chỉ giá, thưởng, ngưỡng hay chỉnh; luật phức tạp vẫn ở code |
| 8 | Thông báo đẩy (quà, tin nhắn, mùa cúm) | Cần service worker; làm cùng giai đoạn Chat riêng |
| 9 | Ngôn ngữ | Chỉ tiếng Việt ở giai đoạn đầu; bộ lọc từ khoá theo tiếng Việt, tính cả viết không dấu |
| 10 | Bệnh lây có gây ức chế không? | Có chế độ cách ly, giới hạn 1 lần lây/ngày, bệnh nhẹ tự khỏi, tắt được bằng công tắc quản trị |

Rủi ro kỹ thuật chính: (a) chi phí và giới hạn Realtime; (b) quấy rối và nội dung xấu trong chat; (c) lạm dụng quà để farm xu giữa các tài khoản (chống bằng hạn mức, độ tuổi tài khoản, phát hiện cặp gửi qua lại); (d) cân bằng kinh tế khi có thêm nguồn xu (tưới giúp, bán rau); (e) nợ kỹ thuật do luật ở hai nơi khi đưa cấu hình ra dữ liệu.

## 14. Lộ trình đề xuất

Ước lượng độ lớn: **S** vài ngày, **M** 1–2 tuần, **L** nhiều tuần (một người làm).

| GĐ | Nội dung | Phụ thuộc | Cỡ |
| --- | --- | --- | --- |
| 0 | Chạy Supabase thật; hồ sơ công khai; mã bạn bè; vai trò quản trị và nhật ký kiểm toán; chốt pháp lý | — | M |
| 1 | Bản đồ + Bệnh viện + Chợ như địa điểm **một mình** (dời UI hiện có, chưa realtime); bệnh nặng chỉ chữa ở bệnh viện; bán rau thừa | 0 | M |
| 2 | **Hộp thư + tặng quà** (người chơi và hệ thống); bạn bè; thăm nhà/vườn (chỉ xem), tưới giúp | 0 | L |
| 3 | **Admin v1**: tổng quan, người chơi, **tặng quà**, **sự kiện** (mô-đun giảm giá, xu, nhiệm vụ), nhật ký kiểm toán, thông báo hệ thống | 2 | L |
| 4 | **Quảng trường realtime**: hiện diện, emote, chat công cộng, lọc từ, chặn/báo cáo, **kiểm duyệt trong admin** | 3, 0 | L |
| 5 | **Chat riêng**; thông báo đẩy; Cúm và bệnh lây; Mùa cúm | 4 | M |
| 6 | Công viên, mini-game, sự kiện cộng đồng, cân nhắc sạp trao đổi, cân bằng qua `balance_config` | 5 | L |

Lý do thứ tự: **quà và admin trước chat** vì giá trị cao, rủi ro thấp, và có công cụ kiểm duyệt trước khi mở chat; **bản đồ một mình trước** để kiểm thử cách điều hướng và dời UI mà chưa cần hạ tầng realtime.

Mỗi giai đoạn đều theo quy trình hiện có: migration mới (không sửa cũ, ghi rõ hàm bị viết lại), test PGlite cho luật, smoke và mobile-check cho giao diện, cập nhật HANDOFF và TDD.
