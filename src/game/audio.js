// Âm thanh. Hiện là chỗ trống: game đã gọi sfx('tên') ở các thời điểm đáng có tiếng, việc còn lại là làm cho nó kêu.
//
// Cách làm gợi ý: Web Audio API (hoặc Howler). Tạo AudioContext lúc người chơi chạm lần đầu (trình duyệt chặn tự phát),
// lưu âm lượng và bật/tắt trong localStorage ('hatchday-audio'), thêm nút trong bảng Chỉ số, tôn trọng prefers-reduced-motion
// ở mức nhạc nền. Mọi tiếng nên ngắn, dịu, hợp phong cách anime ấm áp.
//
// Các sự kiện hiện có (xem chỗ gọi: grep "sfx("):
//   pet      vuốt/chạm vào thú          feed     cho ăn            talk   gửi tin nhắn
//   bath     kỳ cọ / xả nước            play     ném bóng / xoay   sleep  đi ngủ        wake   thức dậy
//   evolve   thú lớn sang giai đoạn mới  coin     nhận xu           buy    mua đồ        place  đặt đồ trong phòng
//   ui       bấm nút thường

/** @typedef {'pet'|'feed'|'talk'|'bath'|'play'|'sleep'|'wake'|'evolve'|'coin'|'buy'|'place'|'ui'} SfxName */

/** Phát một hiệu ứng âm thanh ngắn. Hiện chưa làm gì. @param {SfxName} _name */
export function sfx(_name) { /* TODO: phát âm thanh */ }

/** Nhạc nền theo khu vực/thời điểm. Hiện chưa làm gì. @param {string} _scene ví dụ 'home', 'kitchen', 'night' */
export function music(_scene) { /* TODO: nhạc nền */ }
