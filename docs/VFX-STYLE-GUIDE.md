# Hatchday — Sổ tay phong cách hiệu ứng (VFX Style Guide)

> **English summary.** Hatchday's arena VFX are cel-shaded *solid shapes with ink outlines and small HDR accents* (never additive-only glows: the arenas are bright and bloom is 0.45). Every move plays four phases: **anticipation → action → impact → follow-through**, and the impact is a *single beat* where the damage number, hit-stop, camera punch and hit sound all land on the same frame. Budgets at ×1 speed: basic ≤ 0.9 s, signature ≤ 1.6 s, ultimate ≤ 3.0 s, support ≤ 1.0 s (multi-hit adds 0.2 s per extra hit, max +0.4 s). Each of the 200 moves is a data recipe `form + motif + colours + options` (`src/game/move-fx.ts`) rendered by 20 attack forms and 6 support forms (`src/game/battle-forms.js`). Each element has its own shape language, palette and motion signature. Screen-space effects are capped (full-screen flash α ≤ 0.35 for ≤ 0.2 s, never more than 3 per second, one inverted impact frame per move at most) and all of it is cut under `prefers-reduced-motion`. Performance is budgeted per quality tier (`thap` / `vua` / `cao`). A checklist at the end gates every new effect.

Tài liệu này là luật cho mọi hiệu ứng trong Đấu trường. Mã nguồn đọc trực tiếp các con số ở đây từ `src/game/move-fx.ts` (bảng nhịp, trần màn hình, ngân sách), nên sửa số thì sửa ở đó và cập nhật lại bảng trong tài liệu này.

## 1. Năm trụ cột

1. **Đọc được trước, đẹp sau.** Trong 0,2 giây người chơi phải biết: ai đánh, hệ gì, trúng ai, mạnh cỡ nào. Hai quái thú không bao giờ bị hiệu ứng che quá 0,25 giây liên tục.
2. **Hình khối đặc, viền mực, điểm nhấn HDR.** Sân sáng và có bloom nên hiệu ứng chỉ cộng sáng sẽ thành đốm trắng nhoè. Mọi hiệu ứng chính là mảng màu đặc có viền mực tối; chỉ lõi nhỏ (≤ 15% diện tích hiệu ứng) mới được sáng vượt 1,0 để bloom bắt.
3. **Một nhịp trúng duy nhất.** Số sát thương, khựng hình, giật ống kính, rung, tiếng trúng: cùng một khung hình. Mọi thứ trước đó là để dồn về nhịp ấy, mọi thứ sau đó là để nhả ra.
4. **Mỗi chiêu một câu chuyện nhỏ.** Tên chiêu nói gì thì hình phải kể đúng thế ("Mưa Hạt Vàng" là hạt thóc vàng rơi, "Bầy Ong Vạn Kim" là đàn ong ùa tới). Cùng hệ nhưng khác loài thì khác dạng hoặc khác hoạ tiết.
5. **Ít mà đắt.** Ba lớp là đủ: chính (hình khối kể chuyện, 60% sự chú ý), phụ (vệt đuôi, vòng lan, mảnh vụn, 30%), nền (hạt li ti, bụi, 10%). Thêm lớp thứ tư thì phải bỏ một lớp khác.

## 2. Ngôn ngữ hình khối theo hệ

| Hệ | Hình khối | Màu chính · sáng · tối · phụ | Chuyển động đặc trưng | Dư âm |
|---|---|---|---|---|
| Mộc | lá nhọn, cánh hoa, gai, hạt; đường cong hữu cơ | `#4fd860` · `#d4ff7a` · `#1f6a34` · `#ffd84a` | mọc lên có đà rồi nảy (ease back), xoáy chậm, rơi lả tả | lá rơi, dây leo co lại |
| Thuỷ | giọt, bong bóng, lưỡi sóng tròn, vảy | `#38a8ff` · `#c8f2ff` · `#0f4f9a` · `#ffffff` | dâng lên rồi đổ xuống (chậm → nhanh), lượn sóng hình sin | vòng gợn, giọt bắn rơi theo trọng lực |
| Phong | lưỡi liềm mảnh, lông vũ, mây, tia chớp gãy khúc | `#6fd4f4` · `#f2fdff` · `#2a7fb0` · `#ffe45a` | nhanh nhất, quét ngang, xoáy tăng tốc, vào ra gọn | vệt gió mảnh tan trong 0,2 giây |
| Dạ | trăng khuyết, mắt, cánh dơi, đốm lửa lạnh; góc nhọn | `#9a5cff` · `#e6d4ff` · `#1a0a2e` · `#ffe9a8` | hiện ra đột ngột, co vào tâm (hút), chém chéo | khói tối loang, vành sáng mảnh |
| Hoả | ngọn lửa hình giọt cong, cầu tròn, hơi nóng cuộn | `#ff6a1a` · `#ffd23e` · `#7a1a08` · `#fff2a0` | bùng ra nhanh rồi bốc lên (ease out), rung nhẹ | tàn lửa bay lên, vết cháy trên sân, khói |

Quy tắc màu:
- **Thứ bậc độ sáng**: lõi sáng nhất (màu sáng, HDR ×1,5) → thân (màu chính, đặc) → viền mực (màu tối gần đen `#1a1226`). Không dùng trắng tinh cho mảng lớn hơn một đốm.
- **Thứ bậc độ rực**: hiệu ứng rực hơn sân, quái thú rực hơn nền; mảnh vụn và hạt nền nhạt hơn lớp chính ít nhất một bậc.
- Chiêu được phép lệch màu hệ khi tên chiêu đòi hỏi (mai vàng, cá heo hồng, trân châu nâu), nhưng **tiếng trúng, sao nổ và vòng lan lúc trúng vẫn theo màu hệ** để người chơi luôn nhận ra hệ.
- Màu đỏ cam `#ff5a2a`, vàng chanh `#fff2a0` dành riêng cho chí mạng; xanh bạc hà `#8dff9e` dành cho hồi phục; đừng dùng cho việc khác.

## 3. Nhịp: bốn pha và bảng thời lượng

Bốn pha: **lấy đà** (người đánh co người, hào quang tụ lại, máy quay vào chậm) → **hành động** (vật bay / lao tới, luôn có gia tốc, không bao giờ tuyến tính) → **trúng** (một nhịp) → **dư âm** (mảnh vụn tan, đối thủ bật lại, người đánh về chỗ, vết trên sân mờ dần).

Tốc độ ×1, 60 khung/giây. "kh" = khung hình.

| Loại | Lấy đà | Hành động | Khựng hình | Dư âm | Trần tổng |
|---|---|---|---|---|---|
| Đòn cơ bản | 0,18 s (11 kh) | 0,26–0,35 s (16–21 kh) | 3 kh | 0,30 s (18 kh) | **0,9 s** |
| Tuyệt chiêu | 0,30 s (18 kh) | 0,40–0,70 s (24–42 kh) | 5 kh | 0,45 s (27 kh) | **1,6 s** |
| Tối thượng | 0,95 s (57 kh): cắt cảnh + tụ lực, nhả ở kh 49 | 0,60–1,25 s (36–75 kh) | 8 kh | 0,60 s (36 kh) | **3,0 s** |
| Hỗ trợ | 0,15 s (9 kh) | 0,55 s (33 kh), hiệu lực ở 70% | — | 0,25 s (15 kh) | **1,0 s** |
| Chiêu kép (đòn + hỗ trợ) | đòn kèm theo nhịp đòn cơ bản, rồi hỗ trợ rút gọn 0,12 + 0,40 + 0,15 s | | 3 kh | | **1,6 s** |
| Gây trạng thái | — | 0,3 s | — | 0,3 s | 0,6 s |
| Trạng thái cuối lượt | — | 0,3 s | — | 0,2 s | 0,5 s |
| Ra sân | 0,4 s vòng mở | 0,2 s rơi xuống | — | 0,4 s lún và nảy | 1,0 s |
| Gục | 0,3 s khựng, lảo đảo | 0,9 s đổ và tan | — | — | 1,2 s |

Thời lượng hành động theo dạng (cơ bản / tuyệt chiêu / tối thượng) nằm ở `FORM_ACT` trong `move-fx.ts`.

Quy tắc bổ sung:
- **Đòn liên hoàn (multi)**: mỗi đòn thêm dài 0,2 s (12 kh), tối đa thêm 0,4 s; cao độ tiếng trúng tăng 12% mỗi đòn; đòn chưa phải cuối chỉ khựng 2 kh và nhẹ hơn 20%; đòn cuối mới đủ lực.
- **Khựng hình cộng thêm**: chí mạng +3 kh, khắc hệ +1 kh. Tối đa 12 kh (0,2 s).
- **Tua ×2**: mọi thời lượng chia đôi (đồng hồ hiệu ứng chạy gấp đôi), khựng hình chia đôi nhưng không dưới 2 kh. Tua thử `?battlefast` (×10): bỏ khựng hình.
- **Đường cong chuyển động**: vật bay dùng gia tốc dần (`0,3u + 0,7u²`); vật rơi dùng `u²`; vật mọc lên và bật ra dùng "back" (vượt 10% rồi về); thu về dùng `1 − (1 − u)³`. Cấm nội suy tuyến tính cho vị trí.
- **Chồng nhịp (overlapping action)**: các phần của một hiệu ứng lệch nhau 2–5 kh (nhiều viên đạn, nhiều vòng, nhiều gai), không bao giờ bật cùng một khung.
- **Co giãn**: lấy đà ép người 14–20%, lao tới vươn dài 20–30%, trúng đòn ép 12%; chỉ đổi tỉ lệ và độ lệch của quái thú, không đụng mô hình.
- Sau dư âm, sân phải **sạch** trước khi câu dẫn tiếp theo hiện ra (trừ vết trên sân và trạng thái kéo dài).

## 4. Ngôn ngữ máy quay

| Cảnh | Khi nào | Ghi chú |
|---|---|---|
| `wide` | mặc định, đòn cơ bản | cả hai quái thú trong khung; quái thú to thì tự lùi |
| `duel` | lấy đà tuyệt chiêu | đẩy vào 12%, hạ thấp một chút |
| `attacker` | lấy đà tối thượng | cận người đánh, kèm thanh điện ảnh và tên chiêu |
| `sky` | chiêu từ trời (mưa, thiên thạch, sét, bổ nhào, triệu hồi, nhật thực) | lùi và ngước lên để thấy đường rơi |
| `target` | dư âm tối thượng | nghiêng về phía đối thủ để bán sức nặng cú trúng |
| `win` | kết trận | quay chậm quanh người thắng |

- Rung theo "chấn động" (trauma²): cơ bản 0,25 · tuyệt chiêu 0,35 · tối thượng 0,5 · chí mạng +0,3; tắt dần trong ≤ 0,55 s.
- Giật ống kính (FOV −5° × lực) chỉ ở nhịp trúng.
- Không cắt cảnh quá 2 lần trong một chiêu (tối thượng: cận → rộng → nghiêng). Đòn cơ bản không đổi cảnh.

## 5. Luật màn hình (an toàn nhạy sáng)

- Chớp toàn màn hình: độ đậm ≤ **0,35**, dài ≤ **0,2 s**, cách nhau ≥ **0,34 s** (không quá 3 lần mỗi giây; lần gọi sớm hơn bị bỏ).
- Khung hình đảo màu (impact frame): ≤ 0,1 s, **tối đa một lần mỗi chiêu**, chỉ cho tối thượng và chí mạng; tính như một lần chớp.
- Không chớp đỏ bão hoà toàn màn hình. Làm tối sân (tối thượng) tối đa 0,72 và phải trả về 0 khi hết chiêu.
- Đường tốc độ chỉ ở rìa màn hình (tâm 32% để trống).
- **`prefers-reduced-motion`**: bỏ rung, giật ống kính, khựng hình, khung đảo màu, đường tốc độ; chớp còn ≤ 0,1; số hạt giảm một nửa; thanh điện ảnh hiện ra không trượt.
- Thanh điện ảnh và tên chiêu (cắt cảnh tối thượng) không che bảng thể lực và không nhận chạm.

## 6. Đồng bộ âm thanh

Mỗi chiêu có bốn lớp tiếng, rơi đúng nhịp hình:

| Lớp | Nhịp | Tiếng |
|---|---|---|
| Lấy đà | khung 0 của pha lấy đà | `antic` (cơ bản), `anticBig` (tuyệt chiêu), `charge` + `cutin` (tối thượng; `charge` dâng đỉnh đúng khung nhả, `release` ở khung nhả) |
| Phóng | khung 0 của pha hành động | theo hoạ tiết: `leaf`, `water`, `fire`, `pluck`, `chime`, `buzz`, `flap`, `gust`, `drum`, `ice`, `bubble`, `swish`, `thump`…; theo dạng: `beamUp` → `beam`, `rumble` → `thump`/`geyser`, `leap` → `fall`, `summon`, `eclipse`, `roar`, `snap`, `burstOut` |
| Đường bay | trong pha hành động | `whoosh` (cao độ theo tầng), `tick` cho từng cú chạm phụ (cao độ tăng dần) |
| Trúng | **đúng khung trúng** | `hit` / `hitBig` / `crit` + lớp đuôi theo hệ (`hitLeaf`…) + `boom` cho tối thượng; ngay sau: `superEff` hoặc `weak` |

- Cao độ theo tầng: cơ bản ×1, tuyệt chiêu ×0,92, tối thượng ×0,82 (càng mạnh càng trầm). Đòn liên hoàn ×(1 + 0,12k).
- Nhạc tự hạ khi có `hitBig`, `crit`, `boom`, `charge` (thiết kế ducking sẵn có). Không thêm tiếng nào dài hơn trần của tầng mình.
- Nét riêng có tiếng riêng: `firstDash`, `heartbeat` (liều mạng), `crack` + `pierce`, `drain`, `recoil`, `cleanse`, `shieldUp` → `shield`, `buffHit`, `healUp` → `heal`, `regenTick`.
- Tiếng phụ (`tick`, `whoosh`, đuôi hệ) thuộc nhóm bị bỏ trước khi quá trần số giọng.

## 7. Ngân sách hiệu năng

| Tầng (`hatchday-quality`) | Hệ số số lượng | Hạt cộng sáng / hạt đặc | Hình hoạ tiết mỗi mẻ | Vệt đuôi (điểm) | Lệnh vẽ hiệu ứng / chiêu | Lớp chồng tối đa |
|---|---|---|---|---|---|---|
| `thap` | ×0,5 | 700 / 400 | 32 | 10 | ≤ 20 | 3 |
| `vua` | ×0,8 | 1800 / 1000 | 64 | 16 | ≤ 40 | 4 |
| `cao` | ×1 | 3000 / 1600 | 96 | 20 | ≤ 60 | 6 |

- Hoạ tiết vẽ theo mẻ (`InstancedMesh`): mỗi cặp hình + màu là **một lệnh vẽ** bất kể số lượng. Mẻ không dùng 30 giây thì giải phóng.
- Vệt đuôi, ống tia, vòng xoáy lấy từ **bể dùng lại**; không tạo vật liệu hay hình học trong vòng lặp từng khung. Cấm cấp phát `Vector3` trong hàm chạy mỗi khung.
- Số lượng ≥ 10 co theo tầng; số nhỏ mang nghĩa (3 đuôi, 7 sắc, 9 đuôi) giữ nguyên.
- Tầng `thap`: bỏ vệt đuôi phụ, lốc còn 4 vòng, mảnh vụn còn 3, không bloom nên điểm nhấn HDR không được là thứ duy nhất làm hiệu ứng đọc được.
- Hạt trong suốt lớn (khói) ≤ 20 hạt cùng lúc; không phủ quá nửa màn hình.

## 8. Hệ thống công thức

- `move-fx.ts`: bảng `T[loài] = [cơ bản, hỗ trợ, tuyệt chiêu, tối thượng]`, mỗi mục là chuỗi `'dạng hoạ-tiết khoá=giá-trị'`; chiêu kép viết `'hỗ-trợ | đòn-đánh'`.
- **20 dạng tấn công**: `shot` bắn một phát · `volley` loạt đạn · `melee` áp sát (cào, cắn, đấm, quất…) · `ram` lao cả thân · `beam` tia · `rain` mưa từ trời · `erupt` trồi lên từ đất (gai, cột, cây, đài sen, rừng nấm) · `vortex` lốc xoáy · `wave` sóng quét mặt sân · `swarm` bầy đàn · `meteor` khối lớn rơi · `roar` vòng âm thanh · `summon` hiện hình rồi ra đòn nối tiếp · `eclipse` nhật thực · `bolt` sét / cột sáng · `dive` bổ nhào · `flurry` loạn đả · `orbit` vây rồi siết · `burst` nổ toả từ thân · `lash` dải quất (xúc tu, rồng, cầu vồng).
- **6 dạng hỗ trợ**: `ward` kết khiên · `veil` màn che · `aura` hào quang bốc lên · `chant` hồi trống · `bloom` hoa nở hồi phục · `rest` nghỉ ngơi.
- **Hoạ tiết** (≈ 40): lá, cánh hoa, hạt, gai, hoa, sen, ong, cây, gạc, giọt, bong bóng, ngọc, vỏ, vảy, lưỡi sóng, mây, lông vũ, diều, sao, tia sáng, chớp, trăng, mắt, nấm, lửa, nanh, nắm đấm, cầu, nốt nhạc, chim, dơi, mảnh băng, đuôi, vòng, zzz, dấu cộng, tim, mặt trời, đèn lồng.
- **Nét riêng** phải đọc được bằng mắt: liên hoàn (đòn tách bạch, cao độ lên dần) · hút máu (ba dải sinh khí chảy về) · ra đòn trước (vệt lao trắng trước khi lấy đà) · xuyên thủ (khiên nứt rồi đường xuyên thẳng) · phản lực (luồng dội đỏ cam vào người đánh) · chí mạng (sao bốn cánh dài + vòng đôi) · liều mạng (lửa đỏ quanh người, tim đập) · giũ sạch (vòng trắng quét từ chân lên đầu) · giáp gai (gai đỏ quanh khiên) · khiên kiên cố (sáu vảy vàng xoay) · thần tốc (lưỡi gió xoáy quanh chân) · tập trung (hồng tâm trên đầu) · hồi dần (vòng xanh dưới chân, dấu cộng bay lên).

## 9. Danh sách kiểm khi nhận một hiệu ứng mới

- [ ] Tên chiêu đọc lên, nhìn hình là hiểu (hỏi một người không biết tên chiêu).
- [ ] Không trùng cả dạng lẫn hoạ tiết với chiêu cùng tầng của loài khác trong cùng hệ.
- [ ] Có đủ bốn pha; nhịp trúng trùng khung với số sát thương, khựng hình và tiếng trúng.
- [ ] Tổng thời lượng trong trần của tầng (`npx vitest run src/game/move-fx.test.ts`).
- [ ] Không có chuyển động vị trí tuyến tính; các phần lệch nhịp nhau 2–5 kh.
- [ ] Đọc rõ trên cả năm sân (Rừng Cổ Thụ, Hồ Thác Bạc, Đỉnh Mây Treo, Phế Tích Trăng, Miệng Núi Lửa): có viền mực, không thành đốm trắng nhoè, hai quái thú không bị che quá 0,25 s.
- [ ] Chớp màn hình trong trần; tối đa một khung đảo màu; `prefers-reduced-motion` vẫn hiểu được chiêu.
- [ ] Bốn lớp tiếng rơi đúng nhịp; không tiếng nào dài hơn hiệu ứng.
- [ ] Tầng `thap` có bản rút gọn; không cấp phát trong vòng lặp từng khung; mọi thứ tự dọn khi xong (kiểm bằng `__battle.fxStats()`).
- [ ] Tua ×2 vẫn đúng nhịp; `?battlefast` không lỗi.
- [ ] Đã xem dải khung hình: `node scripts/vfx-strips.mjs` (ảnh ở thư mục scratchpad `vfx/`).

## 10. Nguồn tham khảo

Phiên làm việc này không có kết nối tra cứu web, nên các nguyên tắc dưới đây được tổng hợp từ hiểu biết sẵn có về những tài liệu công khai sau (nên đối chiếu lại bản gốc khi cần trích dẫn chính xác):

- Riot Games, *League of Legends VFX Style Guide* (bài "A Guide to VFX in League of Legends"): thứ bậc độ sáng và độ rực, lớp chính / phụ / nền, hình khối dễ đọc, nhịp nhanh rồi tan chậm.
- Jason Keyser (VFX Apprentice), các bài giảng về nguyên tắc VFX cách điệu: lấy đà → cao trào → tan, hình khối và nhịp.
- Frank Thomas & Ollie Johnston, *The Illusion of Life*: 12 nguyên tắc hoạt hình (lấy đà, co giãn, chồng nhịp, gia tốc, dư âm).
- Junya C. Motomura (Arc System Works), GDC 2015, *GuiltyGear Xrd's Art Style: The X Factor Between 2D and 3D*: hoạt hình giới hạn, khung giữ, hiệu ứng cel đặc trong 3D.
- Jan Willem Nijman (Vlambeer), *The Art of Screenshake*; Martin Jonasson & Petri Purho, GDC 2012, *Juice It or Lose It*: khựng hình, rung, phản hồi nhiều lớp.
- Squirrel Eiserloh, GDC 2016, *Math for Game Programmers: Juicing Your Cameras With Math*: rung theo chấn động bình phương.
- Masahiro Sakurai, loạt video *Creating Games* (các tập về hit stop và hiệu ứng trúng đòn).
- W3C WCAG 2.2, tiêu chí 2.3.1 "Three Flashes or Below Threshold"; Xbox Accessibility Guideline 118 (nhạy sáng); Game Accessibility Guidelines (giảm chuyển động, tránh nhấp nháy).
- Quan sát nhịp lượt đánh của dòng game nhập vai theo lượt và sưu tầm quái thú nói chung (chỉ học cấu trúc nhịp, không sao chép hình, tên hay hiệu ứng của game nào).
