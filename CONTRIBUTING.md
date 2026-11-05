# Đóng góp cho Hatchday

Đọc trước: [docs/HANDOFF.md](docs/HANDOFF.md) (trạng thái, việc còn lại) và [docs/TDD.md](docs/TDD.md) (thiết kế kỹ thuật).

## Quy trình

1. Chọn một việc trong mục "Việc chưa làm" của HANDOFF, báo lại để người khác không làm trùng.
2. Tạo nhánh từ `main`, tên có **tên người làm** để biết nhánh của ai: `feat/<nguoi>/<viec>` hoặc `fix/<nguoi>/<viec>` (ví dụ `feat/an/audio`, `feat/binh/lifecycle`). Mỗi nhánh chỉ một người đẩy lên.
3. Làm, chạy kiểm tra (bên dưới), commit nhỏ và rõ.
4. **Trước khi mở PR: rebase lên `main` mới nhất** (`git fetch && git rebase origin/main`) rồi chạy lại kiểm tra.
5. Mở Pull Request vào `main`. CI phải xanh. Không đẩy thẳng `main`.
6. Gộp từng PR một. PR nào có migration thì gộp xong mới gộp PR migration tiếp theo.

Mỗi người đặt `git config user.name` và `user.email` của riêng mình.

### Khi nhiều người dùng chung một tài khoản GitHub

- Nhánh khác nhau thì làm song song bình thường, không cần mời thêm ai vào repo.
- Vì PR đều do cùng một tài khoản mở, GitHub không cho tài khoản tự duyệt PR của chính nó. Khi bật bảo vệ `main`, chọn **bắt buộc PR + CI xanh, nhưng để số người duyệt bằng 0**. Người kia xem PR rồi tự bấm gộp.
- GitHub sẽ không phân biệt được ai là ai, nên **tên người nằm ở `git config user.name`/`user.email`, ở tên nhánh, và ở đầu mô tả PR** (ví dụ "[An] Thêm âm thanh").
- Đừng cùng lúc đẩy lên một nhánh. Nếu cần làm chung một việc, một người đẩy, người kia `git pull` rồi mới làm tiếp.
- Mật khẩu, mã xác thực hai bước hay token của tài khoản chỉ chia sẻ qua kênh an toàn, không dán vào chat hay commit. Nếu sau này đông người, mỗi người một tài khoản GitHub riêng (miễn phí) sẽ an toàn và dễ theo dõi hơn.

## Kiểm tra trước khi mở PR

```bash
npm test                       # luật chơi + toàn bộ migration/RPC trên Postgres thật (PGlite)
npm run build                  # typecheck + build
node scripts/smoke.mjs         # chạy thật trên trình duyệt: ăn, nói chuyện, tắm, ngủ, lớn lên… (cần Playwright)
node scripts/fit-check.mjs     # chỉ khi đụng thú hoặc đồ mặc (cần Playwright)
```

Hai script trình duyệt cần `npm run build` trước và Playwright (`npm i --no-save playwright` rồi `npx playwright install chromium`). Tuỳ máy mà chạy chậm, đừng đo FPS bằng chúng.

`npm run dev` không cần tài khoản Supabase nào: không có `.env` thì vào chế độ Chơi thử (dữ liệu lưu trong trình duyệt). Trong bảng Chỉ số có nút "Tua 1 ngày" để xem lớn lên và tiến hoá.

## Bản đồ file (ai sửa chỗ nào)

Mỗi tính năng nên nằm trong **file riêng của nó**, `game.js` chỉ nối các mảng lại.

| Mảng | File chính |
| --- | --- |
| Cảnh 3D, vòng lặp, camera, khu vực | `src/game/game.js` |
| Mặt và biểu cảm | `src/game/face.js` |
| Cho ăn, khay thức ăn | `src/game/food.js` |
| Trò chuyện | `src/game/chat.js` |
| Nhật ký, ký ức, đếm hành động trong ngày | `src/game/diary.js` |
| Lớn lên, cảnh tiến hoá, thẻ loài | `src/game/growth.js` |
| Âm thanh | `src/game/audio.js` (`sfx('tên')`, `music('cảnh')`) |
| Nhà: trang trí, cửa hàng, tủ đồ, nhiệm vụ, Sổ loài | `src/game/home.js` |
| Dựng thú, đồ mặc | `pet3d.js`, `fit.js`, `decor3d.js` |
| Luật thuần (có bản SQL song song) | `rules.ts`, `layout.ts`, `species.ts`, `catalog.ts` |
| Trạng thái và gọi server | `store.ts`, `data/api.ts`, `data/demo-api.ts`, `data/types.ts` |

## Quy tắc dễ làm hỏng nhất

**1. Luật ở hai nơi.** Phần lớn luật chơi có bản TypeScript (client) và bản SQL (server). Sửa một nơi phải sửa nơi kia; test `rpc.test.ts`, `decor.test.ts`, `species.test.ts` so khớp hai bên. Chế độ Chơi thử (`demo-api.ts`) cũng phải mô phỏng đúng RPC mới.

**2. Migration.**
- Không sửa migration đã có. Thêm file mới `supabase/migrations/YYYYMMDDHHMMSS_ten.sql`, giờ lớn hơn mọi file đang có.
- Hàm SQL được viết lại **nguyên cả hàm** bằng `create or replace`. Nếu hai nhánh cùng viết lại một hàm, migration chạy sau sẽ **âm thầm ghi đè** phần sửa của nhánh kia, git không báo xung đột. Vì vậy:
  - Mỗi hàm chỉ **một người sửa tại một thời điểm**. Hàm hay bị đụng: `pet_action`, `create_pet`, `get_my_pet`, `decay_pet`.
  - Trước khi viết lại hàm, đọc bản **mới nhất trên `main`** (không phải bản trong migration cũ), rồi bắt đầu từ đó.
  - Ghi hàm nào bị viết lại vào phần mô tả PR.
- Danh mục vật phẩm và loài: sửa `catalog.ts` / `species.ts`, chạy `node --experimental-strip-types scripts/gen-seed.ts` lấy SQL, dán vào migration mới.

**3. Thú và đồ mặc.** Thêm đồ mặc mới hoặc loài mới thì chạy `node scripts/fit-check.mjs`. Báo lẹm thì chỉnh trong `fit.js` / `pet3d.js`.

**4. Bí mật.** Tuổi thọ của thú và món tủ chỉ server biết (`pet_secrets`). Đừng đưa xuống client. Không commit `.env` hay khoá Supabase.

## Hỗ trợ Claude Code

Mỗi người dùng phiên Claude Code của mình trên repo này. Đưa cho nó `docs/HANDOFF.md` và `CONTRIBUTING.md` trước khi bắt đầu việc.
