# Hatchday

Game nuôi thú ảo 3D phong cách anime trên web, cho người đi làm thế hệ 8x, 9x. Hatchday là tên tạm.

## Chạy thử

```bash
npm install
cp .env.example .env   # điền URL và publishable key của dự án Supabase
npm run dev
```

Mở `http://localhost:5173`. Thêm `?dev` vào URL để hiện bảng duyệt biểu cảm và nút tua nhanh thời gian.

## Database

```bash
npx supabase link --project-ref <mã dự án>
npx supabase db push
```

## Kiểm thử

```bash
npm test            # luật chơi + RPC trên Postgres thật (PGlite)
npm run typecheck
npm run build
```

Thiết kế kỹ thuật: [docs/TDD.md](docs/TDD.md). Trạng thái hiện tại và việc còn lại: [docs/HANDOFF.md](docs/HANDOFF.md).
