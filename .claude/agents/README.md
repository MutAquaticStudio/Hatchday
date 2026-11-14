# Subagent của dự án

Các persona lấy từ [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) (giấy phép MIT), thêm phần bối cảnh Hatchday ở đầu mỗi tệp. Claude Code tự nạp thư mục này ở phiên mới; gọi bằng tên, ví dụ "dùng technical-artist để soát hiệu năng cảnh Nhà".

| Nhóm | Agent |
|---|---|
| Game | game-designer, economy-designer, level-designer, narrative-designer, technical-artist, game-audio-engineer |
| Thiết kế | ui-designer, ui-finish-gate-reviewer (chỉ đọc), persona-walkthrough (chỉ đọc) |
| Kỹ thuật | senior-developer (three.js), frontend-developer, backend-architect, code-reviewer (chỉ đọc) |

Cập nhật persona: tải lại tệp gốc và chạy lại bước chuyển đổi (giữ khối "Hatchday project context").
