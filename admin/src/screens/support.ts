/** Tab Hỗ trợ (thư Góp ý & Hỗ trợ của người chơi) và thẻ Thông tin trang (ủng hộ, email liên hệ) trong tab Hệ thống. */
import { rpc } from '../api';
import { esc } from '../charts';

const KIND: Record<string, string> = { feedback: '💡 Góp ý', bug: '🐞 Báo lỗi', account: '🔑 Tài khoản', other: '💬 Khác' };
const STATUS: Record<string, [string, string]> = { open: ['Chờ trả lời', 'warn'], answered: ['Đã trả lời', 'ok'], closed: ['Đã đóng', ''] };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('vi-VN') : '');
const pill = (s: string) => `<span class="pill ${STATUS[s]?.[1] || ''}">${esc(STATUS[s]?.[0] || s)}</span>`;

export async function renderTickets(status: string): Promise<string> {
  const r = await rpc('admin_list_tickets', { p_status: status, p_limit: 100 });
  const c = r.counts || {};
  const tab = (k: string, label: string, n?: number) => `<button class="${k === status ? 'p' : 'g'}" data-tk-status="${k}">${label}${n != null ? ` (${esc(n)})` : ''}</button>`;
  const rows = (r.items || []).map((t: any) => `<tr${t.new ? ' class="new"' : ''}><td>${t.new ? '<span class="pill warn">Mới</span> ' : ''}<b>${esc(t.subject)}</b><br><span class="small">${esc(t.last || '')}</span></td>
    <td>${esc(KIND[t.kind] || t.kind)}</td><td>${esc(t.name || '—')}<br><span class="small">${esc(t.code || '')}</span></td><td>${pill(t.status)}</td><td class="r">${esc(t.messages)}</td><td class="small">${esc(when(t.updated_at))}</td>
    <td><button class="p" data-tk-open="${esc(t.id)}">Mở</button></td></tr>`).join('');
  return `<h2>Góp ý &amp; Hỗ trợ</h2><div class="card"><p class="small">Thư người chơi gửi từ Chỉ số → Góp ý &amp; Hỗ trợ. Khi bạn trả lời, người chơi nhận một thư báo trong Hộp thư và thấy câu trả lời trong game. Thư chưa ai mở xếp lên đầu.</p>
    <div class="row">${tab('open', 'Chờ trả lời', c.open)}${tab('answered', 'Đã trả lời', c.answered)}${tab('closed', 'Đã đóng', c.closed)}${tab('all', 'Tất cả')}</div></div>
    <div class="card">${rows ? `<table><tr><th>Thư</th><th>Loại</th><th>Người gửi</th><th>Trạng thái</th><th>Tin</th><th>Cập nhật</th><th></th></tr>${rows}</table>` : '<p class="small">Không có thư nào ở mục này.</p>'}</div>
    <div id="tk"></div>`;
}

export async function renderTicket(id: number): Promise<string> {
  const t = await rpc('admin_get_ticket', { p_id: id });
  const meta = Object.entries(t.meta || {}).map(([k, v]) => `${esc(k)}: <code>${esc(v)}</code>`).join(' · ');
  return `<div class="card tk-open"><h3>${esc(KIND[t.kind] || t.kind)} · ${esc(t.subject)} ${pill(t.status)}</h3>
    <p class="small">Từ <b>${esc(t.name || '—')}</b> (${esc(t.code || 'chưa có mã')})${t.email ? ` · ${esc(t.email)}` : ''} · gửi ${esc(when(t.created_at))}</p>${meta ? `<p class="small">Máy: ${meta}</p>` : ''}
    <div class="thread">${(t.messages || []).map((m: any) => `<div class="tmsg${m.from_admin ? ' team' : ''}"><span class="small">${m.from_admin ? `Đội ngũ${m.by ? ` (${esc(m.by)})` : ''}` : 'Người chơi'} · ${esc(when(m.at))}</span><p>${esc(m.body).replace(/\n/g, '<br>')}</p></div>`).join('')}</div>
    <label for="tkr">Trả lời (người chơi đọc được)</label><textarea id="tkr" maxlength="2000" placeholder="Chào bạn, cảm ơn bạn đã báo…"></textarea>
    <p><button class="p" data-tk-reply="${esc(t.id)}">Gửi trả lời</button> <button class="g" data-tk-reply-close="${esc(t.id)}">Gửi và đóng thư</button>
      ${t.status === 'closed' ? `<button class="g" data-tk-set="${esc(t.id)}" data-st="open">Mở lại</button>` : `<button class="g" data-tk-set="${esc(t.id)}" data-st="closed">Đóng không trả lời</button>`}</p></div>`;
}

/* ---------- Thông tin trang ---------- */
const FIELDS: { k: string; label: string; ph: string; note?: string }[] = [
  { k: 'contact_email', label: 'Email liên hệ', ph: 'm.thuanwork@gmail.com', note: 'Hiện ở trang chủ, Điều khoản và trong game.' },
  { k: 'donate_url', label: 'Liên kết ủng hộ', ph: 'https://ko-fi.com/…', note: 'Phải bắt đầu bằng https:// (Ko-fi, Buy Me a Coffee, trang MoMo…).' },
  { k: 'donate_label', label: 'Chữ trên nút ủng hộ', ph: 'Ủng hộ Hatchday' },
  { k: 'bank_name', label: 'Ngân hàng', ph: 'Vietcombank' },
  { k: 'bank_account', label: 'Số tài khoản', ph: '0123 456 789' },
  { k: 'bank_holder', label: 'Chủ tài khoản', ph: 'NGUYEN VAN A' },
  { k: 'vietqr_bank', label: 'Mã ngân hàng VietQR (để tự tạo mã QR)', ph: 'VCB, MB, TCB, ACB…', note: 'Có mã này và số tài khoản thì trang chủ tự hiện mã QR chuyển khoản (ảnh từ img.vietqr.io).' },
  { k: 'qr_url', label: 'Hoặc ảnh QR riêng trong trang', ph: './landing/qr.png', note: 'Chỉ nhận ảnh nằm trong trang (thư mục public/landing/). Có ảnh này thì dùng thay cho VietQR.' },
];
export const SITE_KEYS = FIELDS.map(f => f.k);

export function qrPreview(i: Record<string, string>): string {
  if (i.qr_url) return '';
  const acc = (i.bank_account || '').replace(/[^0-9]/g, ''), bank = (i.vietqr_bank || '').replace(/[^A-Za-z0-9]/g, '');
  if (!acc || !bank) return '';
  const q = new URLSearchParams({ addInfo: 'Ung ho Hatchday' }); if (i.bank_holder) q.set('accountName', i.bank_holder);
  return `https://img.vietqr.io/image/${bank}-${acc}-compact.png?${q}`;
}

export function siteInfoCard(info: Record<string, string>, meta?: { at: string; by: string; reason: string }): string {
  const qr = qrPreview(info);
  return `<h2>Thông tin trang</h2><div class="card"><p class="small">Phần Ủng hộ ở trang chủ và email liên hệ. Để trống ô nào thì ẩn phần đó; để trống hết thì trang chủ hiện "Kênh ủng hộ sẽ sớm mở". Đổi xong có hiệu lực ngay, không cần đưa bản mới lên.</p>
    <div class="site-grid">${FIELDS.map(f => `<div><label for="si-${f.k}">${esc(f.label)}</label><input id="si-${f.k}" data-si="${f.k}" value="${esc(info[f.k] || '')}" placeholder="${esc(f.ph)}" maxlength="300">${f.note ? `<span class="small">${esc(f.note)}</span>` : ''}</div>`).join('')}</div>
    ${qr ? `<p class="small">Xem trước mã QR:</p><img src="${esc(qr)}" alt="Mã QR xem trước" width="140" height="140" style="border-radius:12px;border:2px solid #eee">` : ''}
    <label for="si-why">Lý do (bắt buộc, ghi vào nhật ký)</label><input id="si-why" maxlength="200">
    <p><button class="p" id="si-save">Lưu thông tin trang</button></p>
    <p class="small">${meta ? `Đổi lần cuối ${esc(when(meta.at))} bởi ${esc(meta.by || '—')}: “${esc(meta.reason || '')}”` : 'Chưa từng đổi.'}</p></div>`;
}
