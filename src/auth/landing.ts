/**
 * Trang chủ giới thiệu Hatchday (màn đầu khi chưa đăng nhập): giới thiệu, ảnh trong game, tính năng, cam kết chơi miễn phí,
 * phần Ủng hộ (donate) và chân trang có Điều khoản / Quyền riêng tư / Hỗ trợ. Nút đăng nhập, tạo tài khoản, Chơi thử nằm ngay phần đầu.
 * Thông tin ủng hộ và email liên hệ chỉnh trong trang quản trị (tab Hệ thống → Thông tin trang), đọc qua RPC get_site_info.
 * Chưa có máy chủ hoặc chưa chỉnh thì dùng biến build (để trống hết thì hiện "sắp mở"):
 *   VITE_DONATE_URL, VITE_DONATE_LABEL, VITE_DONATE_BANK ("Ngân hàng|Số tài khoản|Chủ tài khoản"), VITE_DONATE_QR (ảnh trong public/landing/).
 */
import './landing.css';
import { supabase, isConfigured } from '../lib/supabase';

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env || {};
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface SiteInfo { donate_url?: string; donate_label?: string; bank_name?: string; bank_account?: string; bank_holder?: string; vietqr_bank?: string; qr_url?: string; contact_email?: string }
export const CONTACT_EMAIL = 'm.thuanwork@gmail.com';
/** Thông tin từ biến build (dự phòng). */
export function envSiteInfo(): SiteInfo {
  const bank = env.VITE_DONATE_BANK?.split('|').map(s => s.trim());
  return { donate_url: env.VITE_DONATE_URL?.trim(), donate_label: env.VITE_DONATE_LABEL?.trim(), bank_name: bank?.[0], bank_account: bank?.[1], bank_holder: bank?.[2], qr_url: env.VITE_DONATE_QR?.trim() };
}
const safeUrl = (u?: string) => (u && /^https:\/\/[^\s<>"']+$/.test(u) ? u : '');
const safeImg = (u?: string) => (u && /^\.?\/[A-Za-z0-9/_.-]+\.(png|jpe?g|webp|svg)$/.test(u) && !u.includes('..') ? u : '');
/** Ảnh QR: ảnh tự tải lên trang, hoặc mã VietQR tạo từ mã ngân hàng + số tài khoản. */
export function qrSrc(i: SiteInfo): string {
  const own = safeImg(i.qr_url); if (own) return own;
  const acc = (i.bank_account || '').replace(/[^0-9]/g, ''), bank = (i.vietqr_bank || '').replace(/[^A-Za-z0-9]/g, '');
  if (!acc || !bank) return '';
  const q = new URLSearchParams({ addInfo: 'Ung ho Hatchday' }); if (i.bank_holder) q.set('accountName', i.bank_holder);
  return `https://img.vietqr.io/image/${bank}-${acc}-compact.png?${q}`;
}

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

export function donateHtml(info: SiteInfo = envSiteInfo()): string {
  const url = safeUrl(info.donate_url), label = info.donate_label || 'Ủng hộ Hatchday', qr = qrSrc(info);
  const ways = [
    url ? `<a class="btn ld-donate-btn" href="${esc(url)}" target="_blank" rel="noopener">☕ ${esc(label)}</a>` : '',
    info.bank_name && info.bank_account ? `<div class="ld-bank"><span>Chuyển khoản</span><b>${esc(info.bank_name)}</b><b class="ld-acc">${esc(info.bank_account)}</b>${info.bank_holder ? `<small>${esc(info.bank_holder)}</small>` : ''}<small>Nội dung: <i>Ung ho Hatchday</i></small></div>` : '',
    qr ? `<img class="ld-qr" src="${esc(qr)}" alt="Mã QR ủng hộ Hatchday" loading="lazy" width="180" height="180">` : '',
  ].filter(Boolean);
  return ways.length ? `<div class="ld-ways">${ways.join('')}</div>` : '<p class="ld-soon">Kênh ủng hộ sẽ sớm mở. Cảm ơn bạn đã quan tâm! Trong lúc chờ, chia sẻ Hatchday với bạn bè cũng là một cách ủng hộ tuyệt vời.</p>';
}

/** Lấy thông tin trang từ máy chủ rồi vẽ lại phần Ủng hộ và email liên hệ. Lỗi mạng thì giữ bản dự phòng. */
export async function hydrateLanding(root: ParentNode): Promise<void> {
  if (!isConfigured) return;
  try {
    const { data, error } = await supabase.rpc('get_site_info'); if (error || !data) return;
    const info: SiteInfo = { ...envSiteInfo(), ...(data as SiteInfo) };
    const box = root.querySelector('#ld-donate-ways'); if (box) box.innerHTML = donateHtml(info);
    const mail = info.contact_email || CONTACT_EMAIL;
    root.querySelectorAll<HTMLAnchorElement>('[data-contact]').forEach(a => { a.href = `mailto:${mail}`; if (a.dataset.contact === 'text') a.textContent = mail; });
  } catch { /* giữ bản dự phòng */ }
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
    <div id="ld-donate-ways">${donateHtml()}</div>
    <p class="ld-note">Ủng hộ là tự nguyện, không đổi lấy xu, vật phẩm hay lợi thế nào trong game, và không hoàn lại. Xem <a href="./dieu-khoan.html">Điều khoản</a>. Thắc mắc gửi <a href="mailto:${CONTACT_EMAIL}" data-contact="text">${CONTACT_EMAIL}</a>.</p></section>
  <footer class="ld-foot"><span>© 2026 Hatchday</span><a href="./dieu-khoan.html">Điều khoản sử dụng</a><a href="./quyen-rieng-tu.html">Quyền riêng tư</a><a href="mailto:${CONTACT_EMAIL}" data-contact>Hỗ trợ</a><a href="#top">Lên đầu trang ↑</a></footer>
</div>`;
}
