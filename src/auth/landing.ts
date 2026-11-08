/**
 * Trang chủ giới thiệu Hatchday (màn đầu khi chưa đăng nhập): giới thiệu, ảnh trong game, tính năng, cam kết chơi miễn phí,
 * phần Ủng hộ (donate) và chân trang có Điều khoản / Quyền riêng tư. Nút đăng nhập, tạo tài khoản, Chơi thử nằm ngay phần đầu.
 * Thông tin ủng hộ lấy từ biến build (để trống thì hiện "sắp mở"):
 *   VITE_DONATE_URL   liên kết ủng hộ (Ko-fi, Buy Me a Coffee, trang MoMo…)   VITE_DONATE_LABEL  chữ trên nút (mặc định "Ủng hộ Hatchday")
 *   VITE_DONATE_BANK  "Ngân hàng|Số tài khoản|Chủ tài khoản"                   VITE_DONATE_QR     đường dẫn ảnh mã QR (đặt trong public/landing/)
 */
import './landing.css';

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env || {};
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const SHOTS = [
  { src: './landing/home.jpg', cap: 'Nhà của bé: chăm, trang trí, mặc đồ' },
  { src: './landing/plaza.jpg', cap: 'Quảng trường: gặp gỡ bạn bè' },
  { src: './landing/park.jpg', cap: 'Công viên: ao vịt, sân chơi, đồng hoa' },
  { src: './landing/market.jpg', cap: 'Chợ Xanh: mua sắm bằng xu kiếm được' },
  { src: './landing/minigame.jpg', cap: '7 mini-game: câu cá, nhảy theo nhịp…' },
];
const FEATURES = [
  ['🥚', 'Ấp trứng, nuôi bé', 'Hơn 50 loài, lớn lên theo cách bạn chăm. Ăn, tắm, ngủ, chơi, khám bệnh, và gia phả qua nhiều đời.'],
  ['🗺️', 'Thế giới để khám phá', 'Quảng trường, Công viên, Chợ, Tiệm trà, Thư viện, Bệnh viện, Tiệm may. Thời tiết và ngày đêm thay đổi thật.'],
  ['🎣', '7 mini-game', 'Bắt bướm, pha trà, câu cá, đố vui, giao hàng, nhảy theo nhịp, bắt sâu. Chơi để kiếm xu và luyện kỹ năng.'],
  ['💼', 'Việc làm & thi tài', 'Cho bé đi làm thêm, lên cấp kỹ năng và tham gia thi biểu diễn mỗi tuần.'],
  ['🤝', 'Bạn bè', 'Kết bạn, tặng quà, thăm nhà, hẹn chơi, để lại lời nhắn. Bé của bạn còn ghé chơi khi bạn vắng.'],
  ['🏮', 'Lễ hội theo mùa', 'Tết, Trung thu, Thiếu nhi, Halloween, Giáng sinh… Sổ mùa và sổ sticker đổi mới mỗi tháng.'],
] as const;

function donateHtml(): string {
  const url = env.VITE_DONATE_URL?.trim(), label = env.VITE_DONATE_LABEL?.trim() || 'Ủng hộ Hatchday', bank = env.VITE_DONATE_BANK?.split('|').map(s => s.trim()), qr = env.VITE_DONATE_QR?.trim();
  const ways = [
    url ? `<a class="btn ld-donate-btn" href="${esc(url)}" target="_blank" rel="noopener">☕ ${esc(label)}</a>` : '',
    bank && bank.length >= 2 ? `<div class="ld-bank"><span>Chuyển khoản</span><b>${esc(bank[0])}</b><b class="ld-acc">${esc(bank[1])}</b>${bank[2] ? `<small>${esc(bank[2])}</small>` : ''}<small>Nội dung: <i>Ung ho Hatchday</i></small></div>` : '',
    qr ? `<img class="ld-qr" src="${esc(qr)}" alt="Mã QR ủng hộ Hatchday" loading="lazy" width="180" height="180">` : '',
  ].filter(Boolean);
  return ways.length ? `<div class="ld-ways">${ways.join('')}</div>` : '<p class="ld-soon">Kênh ủng hộ sẽ sớm mở. Cảm ơn bạn đã quan tâm! Trong lúc chờ, chia sẻ Hatchday với bạn bè cũng là một cách ủng hộ tuyệt vời.</p>';
}

/** HTML trang chủ; `cta` là cụm nút đăng nhập / tạo tài khoản / Chơi thử (giữ nguyên id để luồng cũ chạy như trước). */
export function landingHtml(cta: string, notice = ''): string {
  return `<div class="landing">
  <header class="ld-nav"><a class="ld-logo" href="#top" aria-label="Hatchday">🥚 Hatchday</a>
    <nav aria-label="Trang chủ"><a href="#tinh-nang">Tính năng</a><a href="#mien-phi">Miễn phí</a><a href="#ung-ho">Ủng hộ</a></nav></header>
  <section class="ld-hero" id="top">
    <div class="ld-hero-text">
      <p class="ld-kicker">Trò chơi nuôi thú ảo 3D · miễn phí</p>
      <h1>Một người bạn nhỏ<br>đang chờ bạn.</h1>
      <p class="ld-lead">Ấp trứng, chăm bé lớn lên, dạo quanh thị trấn dễ thương và kết bạn với mọi người. Chơi ngay trên trình duyệt, không cần cài đặt.</p>
      ${notice}
      <div class="ld-cta">${cta}</div>
      <p class="ld-legal">Khi tiếp tục, bạn đồng ý với <a href="./dieu-khoan.html">Điều khoản sử dụng</a> và <a href="./quyen-rieng-tu.html">Chính sách quyền riêng tư</a>.</p>
    </div>
    <div class="ld-hero-art" aria-hidden="true"><div class="device"><div class="lcd"><div class="egg"></div></div><div class="btns"><i></i><i></i><i></i></div></div><span class="ld-spark s1">✦</span><span class="ld-spark s2">♡</span><span class="ld-spark s3">✦</span></div>
  </section>
  <section class="ld-shots" aria-label="Ảnh trong game"><div class="ld-strip">${SHOTS.map(s => `<figure><img src="${s.src}" alt="${esc(s.cap)}" loading="lazy" width="390" height="700"><figcaption>${esc(s.cap)}</figcaption></figure>`).join('')}</div></section>
  <section class="ld-sec" id="tinh-nang"><h2>Có gì trong Hatchday?</h2>
    <div class="ld-grid">${FEATURES.map(([i, t, d]) => `<article class="ld-feat"><span class="ld-ico" aria-hidden="true">${i}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div></section>
  <section class="ld-sec ld-f2p" id="mien-phi"><h2>Miễn phí và công bằng</h2>
    <ul><li><b>Không có tiền tệ trả phí.</b> Mọi món trong game chỉ mua bằng xu kiếm được khi chơi.</li>
      <li><b>Không bán lợi thế.</b> Ai cũng có cơ hội như nhau, chăm chỉ là được.</li>
      <li><b>An toàn cho mọi lứa tuổi.</b> Chat có bộ lọc, có chặn và báo cáo; dữ liệu tối thiểu.</li>
      <li><b>Chơi mọi nơi.</b> Điện thoại hay máy tính đều chơi được, thêm vào Màn hình chính như một ứng dụng.</li></ul></section>
  <section class="ld-sec ld-donate" id="ung-ho"><h2>Ủng hộ Hatchday 💖</h2>
    <p>Hatchday được làm bởi một nhóm nhỏ và chạy hoàn toàn miễn phí. Nếu bạn thích game, một khoản ủng hộ nhỏ sẽ giúp trả tiền máy chủ và làm thêm nhiều điều dễ thương.</p>
    ${donateHtml()}
    <p class="ld-note">Ủng hộ là tự nguyện, không đổi lấy xu, vật phẩm hay lợi thế nào trong game, và không hoàn lại. Xem <a href="./dieu-khoan.html">Điều khoản</a>.</p></section>
  <footer class="ld-foot"><span>© 2026 Hatchday</span><a href="./dieu-khoan.html">Điều khoản sử dụng</a><a href="./quyen-rieng-tu.html">Quyền riêng tư</a><a href="#top">Lên đầu trang ↑</a></footer>
</div>`;
}
