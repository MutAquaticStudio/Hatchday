// Chính sách bảo mật nội dung cho bản máy tính: lấy từ public/_headers của bản web (một nguồn duy nhất), thay 'self' cho giao thức app://.
const fs = require('node:fs');
const path = require('node:path');
function readCsp(distDir) {
  try {
    const txt = fs.readFileSync(path.join(distDir, '_headers'), 'utf8');
    const m = /Content-Security-Policy:\s*(.+)/.exec(txt);
    if (m) return m[1].trim();
  } catch { /* không có tệp: dùng mặc định chặt */ }
  return "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'";
}
module.exports = { readCsp };
