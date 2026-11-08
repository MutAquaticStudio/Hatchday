# Steamworks: thành tựu, Rich Presence, đăng nhập Steam

Tài liệu cho chủ dự án khi cấu hình ứng dụng trên Steamworks. Mã nguồn liên quan: `src/game/achievements.ts`,
`src/lib/steam.ts`, `desktop/steam.cjs`, `supabase/functions/steam-auth/`, migration `20261223000000_steam_accounts.sql`.

## 1. Thành tựu (Stats & Achievements → Achievements)

API name phải gõ đúng y như cột đầu. Icon 64×64 (bản mở khoá và bản xám) làm ở giai đoạn S6.

| API name | Tên (EN) | Mô tả (EN) | Tên (VI) | Mô tả (VI) |
|---|---|---|---|---|
| ACH_HATCH | Hello, little one | Hatch your first egg | Chào bé con | Ấp quả trứng đầu tiên |
| ACH_GROW_KID | Shell's off! | Raise your pet to the Kid stage | Rơi vỏ trứng | Nuôi bé tới tuổi Nhí |
| ACH_GROW_ADULT | All grown up | Raise your pet to adulthood | Trưởng thành | Nuôi bé tới tuổi trưởng thành |
| ACH_BOND_5 | Trusted friend | Reach Bond level 5 | Bạn tin cậy | Gắn bó đạt cấp 5 |
| ACH_BOND_10 | Devoted | Reach Bond level 10 | Một lòng | Gắn bó đạt cấp 10 |
| ACH_NEXT_GEN | Family tree | Welcome a second-generation pet | Gia phả | Đón bé đời thứ hai |
| ACH_SPECIES_10 | Collector | Meet 10 species | Nhà sưu tầm | Gặp 10 loài |
| ACH_SPECIES_ALL | Living encyclopedia | Meet every species | Bách khoa sống | Gặp đủ mọi loài |
| ACH_LEGEND | Once in a lifetime | Meet a Legendary species | Ngàn năm có một | Gặp một loài Huyền thoại |
| ACH_BUTTERFLY | Butterfly Hunter | Catch 40 butterflies | Thợ săn bướm | Bắt 40 con bướm |
| ACH_TEA_MASTER | Tea Master | Brew perfect tea 5 times | Bậc thầy pha trà | Pha trà hoàn hảo 5 lần |
| ACH_ANGLER | Little Angler | Catch 20 fish | Cần thủ nhí | Câu 20 con cá |
| ACH_BOOKWORM | Bookworm | Ace the quiz 5 times | Mọt sách | Trả lời đúng hết đố vui 5 lần |
| ACH_COURIER | Little Courier | Deliver 30 orders | Bưu tá nhí | Giao đúng 30 đơn hàng |
| ACH_DANCER | Little Dancer | Hit 16+ beats 5 times | Vũ công nhí | Nhảy trúng từ 16 nhịp 5 lần |
| ACH_GARDENER | Garden Keeper | Catch 60 bugs | Người giữ vườn | Bắt 60 con sâu |
| ACH_EXPLORER | Explorer | Complete Explore on 7 days | Nhà thám hiểm | Hoàn thành Khám phá 7 ngày |
| ACH_STAGE_STAR | Stage Star | Perform on stage 5 times | Ngôi sao sân khấu | Biểu diễn trên sân khấu 5 lần |

## 2. Rich Presence (Community → Rich Presence)

Tải lên tệp localization sau (định dạng VDF của Steam). Game đặt `steam_display` = `#Status_<nơi>`.

```
"lang"
{
  "english"
  {
    "tokens"
    {
      "#Status_home"     "At home with their pet"
      "#Status_plaza"    "Hanging out in Town Square"
      "#Status_park"     "Playing in the Park"
      "#Status_tea"      "Sipping tea at the Tea House"
      "#Status_market"   "Shopping at the Green Market"
      "#Status_hospital" "At the Hospital"
      "#Status_library"  "Reading at the Library"
      "#Status_tailor"   "Trying on outfits at the Tailor"
    }
  }
  "vietnamese"
  {
    "tokens"
    {
      "#Status_home"     "Đang ở nhà với bé"
      "#Status_plaza"    "Đang dạo Quảng trường"
      "#Status_park"     "Đang chơi ở Công viên"
      "#Status_tea"      "Đang nhâm nhi ở Tiệm trà"
      "#Status_market"   "Đang đi Chợ Xanh"
      "#Status_hospital" "Đang ở Bệnh viện"
      "#Status_library"  "Đang đọc sách ở Thư viện"
      "#Status_tailor"   "Đang thử đồ ở Tiệm may"
    }
  }
}
```

## 3. Đăng nhập bằng Steam

1. Steamworks → Users & Permissions → Manage Groups: tạo **Web API key của nhà phát hành** (publisher key).
2. Supabase: áp migration `20261223000000_steam_accounts.sql`, rồi triển khai hàm:
   `npx supabase functions deploy steam-auth --no-verify-jwt`
3. Đặt bí mật cho hàm (không gửi khoá qua chat): `npx supabase secrets set STEAM_WEB_API_KEY=… STEAM_APP_ID=…`
4. Bản Steam đặt `steam_appid.txt` (chứa App ID) cạnh tệp chạy khi thử ngoài Steam; khi chạy từ Steam thì không cần.

Luồng: Electron lấy vé Web API (`identity = hatchday`) → `steam-auth` kiểm vé với `ISteamUserAuth/AuthenticateUserTicket`
→ tìm hoặc tạo tài khoản gắn SteamID (email nội bộ `steam-<id>@users.hatchday.noxelis.co`, không nhận thư)
→ trả `token_hash` → game gọi `auth.verifyOtp` để có phiên. Không có Steam thì game cho đăng nhập bằng email như bản web.

## 4. Supporter Pack (DLC)

Tạo DLC "Supporter Pack" (không cho lợi thế trong game). Gửi App ID của DLC để game hiện khung tên/huy hiệu cảm ơn
(`desktop.steam.dlc(appId)`); phần thưởng chỉ để trang trí.
