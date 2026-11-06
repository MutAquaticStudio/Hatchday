/** Tab Hệ thống (công tắc có trạng thái và lần đổi cuối) và tab Cân bằng (núm do máy chủ quyết định, có khoảng, lý do, kiểm toán). */
import { rpc } from '../api';
import { esc, num } from '../charts';

export const FLAGS: { key: string; label: string; desc: string; warn?: string }[] = [
  { key: 'ads.enabled', label: 'Quảng cáo thưởng', desc: 'Người chơi xem video ở Chợ để nhận xu. Cần nhà cung cấp quảng cáo đã cấu hình ở bản chạy thật, nếu không sẽ không có quảng cáo nào hiện.' },
  { key: 'places.enabled', label: 'Nơi chung (Quảng trường, Tiệm trà, Công viên)', desc: 'Tắt khi bảo trì hoặc có sự cố: không ai vào được nơi chung, người đang ở trong sẽ bị đưa ra.' },
  { key: 'chat.public.enabled', label: 'Chat công khai', desc: 'Tin nhắn gõ chữ ở nơi chung.', warn: 'Chỉ bật khi đã chốt pháp lý và có người kiểm duyệt.' },
  { key: 'chat.dm.enabled', label: 'Tin nhắn riêng giữa bạn bè', desc: 'Tắt để dừng toàn bộ tin nhắn riêng.' },
  { key: 'push.enabled', label: 'Thông báo đẩy', desc: 'Công tắc khẩn cho thông báo gửi từ máy chủ khi người chơi đóng trình duyệt.' },
];
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('vi-VN') : '');

/** Lỗi JS của người chơi 7 ngày qua (gộp theo dấu vân tay). Chỉ vai trò có quyền "flag" thấy; thiếu quyền thì không hiện gì. */
function errorsCard(e: any): string {
  if (!e) return '';
  const rows = (e.top || []).map((t: any) => `<tr><td><details><summary>${esc(String(t.message).slice(0, 110))}</summary><pre class="small">${esc(t.stack || '(không có stack)')}</pre></details></td><td>${esc(t.kind)}</td><td class="r">${num(t.count)}</td><td class="r">${num(t.users)}</td><td>${esc(t.place || '')}</td><td class="small">${esc(t.build || '')}</td><td class="small">${esc(when(t.last))}</td></tr>`).join('');
  return `<h2>Lỗi phía người chơi (7 ngày)</h2><div class="card"><p class="small">Tổng <b>${num(e.total)}</b> lần, <b>${num(e.users)}</b> người gặp. Chỉ ghi lỗi JS chưa xử lý (bỏ lỗi mạng, lỗi tiện ích trình duyệt); mỗi người tối đa 20 bản/giờ; xoá sau 30 ngày. Chưa có lỗi nào nghĩa là trang vẫn chạy ổn hoặc chưa có đủ người dùng.</p>
    ${rows ? `<table><tr><th>Lỗi</th><th>Loại</th><th>Lần</th><th>Người</th><th>Màn</th><th>Bản</th><th>Gần nhất</th></tr>${rows}</table>` : '<p class="small">Không có lỗi nào trong 7 ngày qua. 🎉</p>'}</div>`;
}

export async function renderFlags(reasonField: string): Promise<string> {
  const [f, meta, push, errs] = await Promise.all([rpc('admin_list_flags'), rpc('admin_flag_meta'), rpc('admin_push_stats').catch(() => null), rpc('admin_client_errors', { p_days: 7 }).catch(() => null)]);
  const card = (x: typeof FLAGS[number]) => {
    const on = f[x.key] === true, m = meta[x.key];
    return `<div class="card fl"><div><b>${esc(x.label)}</b> <span class="pill ${on ? 'ok' : 'warn'}">${on ? '● Đang bật' : '○ Đang tắt'}</span><p class="small">${esc(x.desc)}${x.warn ? ` <b>${esc(x.warn)}</b>` : ''}</p>
      ${x.key === 'push.enabled' && push ? `<p class="small">Thiết bị đã đăng ký: <b>${esc(push.devices)}</b> (${esc(push.users)} người) · 24 giờ qua: gửi được <b>${esc(push.sent_24h)}</b>, lỗi <b>${esc(push.fail_24h)}</b>.</p>` : ''}
      <p class="small">${m ? `Đổi lần cuối ${esc(when(m.at))} bởi ${esc(m.by || '—')}: “${esc(m.reason || '')}”` : 'Chưa từng đổi (giá trị mặc định).'}</p></div>
      <button class="p" data-flag="${esc(x.key)}" data-on="${on ? 0 : 1}">${on ? 'Tắt' : 'Bật'}</button></div>`;
  };
  return `<h2>Cờ hệ thống</h2><div class="card">${reasonField}<p class="small">Điền lý do rồi bấm bật/tắt ở từng thẻ. Mọi thay đổi ghi vào nhật ký kiểm toán.</p></div>${FLAGS.map(card).join('')}${errorsCard(errs)}`;
}

export async function renderBalance(): Promise<string> {
  const rows = await rpc('admin_list_balance') as any[];
  const groups = [...new Set(rows.map(r => r.grp))];
  const val = (k: string) => Number(rows.find(r => r.key === k)?.value ?? 0);
  const impact = `<p class="small">Ước tính: thưởng quảng cáo tối đa <b>${num(val('ads.reward') * val('ads.per_day'))} xu</b> mỗi người mỗi ngày; xu chăm sóc tối đa <b>${num(val('care.daily_cap'))} xu</b>; bán rau tối đa <b>${num(val('sell.daily_cap'))} xu</b>.</p>`;
  return `<h2>Cân bằng</h2><div class="card"><p class="small">Chỉ gồm các núm do máy chủ quyết định. Giá đồ và tốc độ giảm chỉ số nằm trong code (client cũng tính) nên chưa chỉnh được ở đây. Đổi quá ±50% so với mặc định chỉ owner làm được.</p>
    <label for="why">Lý do (bắt buộc, ghi vào nhật ký)</label><input id="why" maxlength="200">${impact}</div>
    ${groups.map(g => `<h3>${esc(g)}</h3><div class="card"><table><tr><th>Núm</th><th>Giá trị</th><th>Mặc định</th><th>Khoảng</th><th>Đổi lần cuối</th><th></th></tr>${rows.filter(r => r.grp === g).map(r => `<tr><td><b>${esc(r.label)}</b>${r.note ? `<br><span class="small">${esc(r.note)}</span>` : ''}</td>
      <td><input type="number" class="bal" data-key="${esc(r.key)}" value="${esc(r.value)}" min="${esc(r.min)}" max="${esc(r.max)}" step="any" aria-label="${esc(r.label)}" style="width:90px"> ${esc(r.unit)} ${Number(r.value) !== Number(r.def) ? '<span class="pill warn">đã chỉnh</span>' : ''}</td>
      <td>${esc(r.def)}</td><td>${esc(r.min)}–${esc(r.max)}</td><td class="small">${r.updated_at ? `${esc(when(r.updated_at))}<br>${esc(r.by || '')}` : '—'}</td>
      <td><button class="p" data-bal="${esc(r.key)}">Lưu</button> ${Number(r.value) !== Number(r.def) ? `<button class="g" data-bal-reset="${esc(r.key)}" data-def="${esc(r.def)}">Về mặc định</button>` : ''}</td></tr>`).join('')}</table></div>`).join('')}`;
}
