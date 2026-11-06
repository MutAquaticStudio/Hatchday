/** Trang quản trị Hatchday: đăng nhập, xác thực hai bước (TOTP), các màn hình theo vai trò. */
import { isDemo, rpc, sb, viMsg } from './api';
import { can, type Action, type Role } from './rbac';
import { mountCaptcha } from '../../src/lib/captcha';

const root = document.getElementById('root')!;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN') : '—');
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const val = (id: string) => ($(id) as HTMLInputElement).value;

interface Tab { id: string; label: string; need: Action; render: () => Promise<string>; bind?: () => void }
let role: Role = 'analyst', tab = '', idle = 0;
const flash = (html: string, bad = false) => { const m = $('msg'); if (m) { m.className = 'msg' + (bad ? ' err' : ''); m.innerHTML = html; } };
const guard = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); flash(ok); } catch (e) { flash(esc(viMsg(e)), true); } };

/* ---------- Đăng nhập + hai bước ---------- */
function loginView(msg = '') {
  root.innerHTML = `<div class="login card"><h2>Hatchday — Quản trị</h2>${msg ? `<div class="msg err">${esc(msg)}</div>` : ''}
    <label for="em">Email</label><input id="em" type="email" autocomplete="username"><label for="pw">Mật khẩu</label><input id="pw" type="password" autocomplete="current-password">
    <div id="captcha"></div><p><button class="p" id="go">Đăng nhập</button></p><p class="small">${isDemo ? 'Chế độ chạy thử (chưa cấu hình Supabase): dùng ?role=owner|ops|support|moderator|analyst.' : 'Chỉ tài khoản đã được cấp vai trò mới vào được.'}</p></div>`;
  const captcha = mountCaptcha(document.getElementById('captcha'));
  $('go').onclick = async () => {
    if (isDemo) return start();
    let captchaToken: string | undefined;
    try { captchaToken = await captcha.token(); } catch { return loginView('Chưa xác minh được bạn là người thật. Tải lại trang và thử lại.'); }
    const { error } = await sb!.auth.signInWithPassword({ email: val('em'), password: val('pw'), options: { captchaToken } });
    if (error) return loginView('Email hoặc mật khẩu chưa đúng.');
    await mfaStep();
  };
}
async function mfaStep(): Promise<void> {
  const aal = await sb!.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.data?.currentLevel === 'aal2') return start();
  const factors = await sb!.auth.mfa.listFactors(); const totp = factors.data?.totp?.find(f => f.status === 'verified');
  let factorId = totp?.id, qr = '';
  if (!factorId) { const en = await sb!.auth.mfa.enroll({ factorType: 'totp' }); if (en.error || !en.data) return loginView('Không bật được xác thực hai bước.'); factorId = en.data.id; qr = en.data.totp.qr_code; }
  root.innerHTML = `<div class="login card"><h2>Xác thực hai bước</h2>${qr ? `<p>Quét mã bằng ứng dụng xác thực rồi nhập mã 6 số.</p><img alt="Mã QR" src="${esc(qr)}" width="180" height="180">` : '<p>Nhập mã 6 số từ ứng dụng xác thực.</p>'}
    <label for="code">Mã</label><input id="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><p><button class="p" id="ok">Xác nhận</button></p><div id="msg"></div></div>`;
  $('ok').onclick = async () => {
    const ch = await sb!.auth.mfa.challenge({ factorId: factorId! }); if (ch.error) return flash('Không tạo được thử thách.', true);
    const v = await sb!.auth.mfa.verify({ factorId: factorId!, challengeId: ch.data.id, code: val('code') });
    if (v.error) return flash('Mã chưa đúng.', true); start();
  };
}

/* ---------- Các màn hình ---------- */
const reasonField = '<label for="why">Lý do (bắt buộc, ghi vào nhật ký)</label><input id="why" maxlength="200">';
const TABS: Tab[] = [
  { id: 'dash', label: 'Tổng quan', need: 'dashboard', render: async () => {
    const s = await rpc('admin_dashboard_stats'); const st = (n: string, v: unknown) => `<div class="stat"><b>${esc(v)}</b><span>${n}</span></div>`;
    return `<h2>Tổng quan</h2><div class="grid">${st('Người chơi', s.players)}${st('Mới hôm nay', s.new_today)}${st('Thú đang sống', s.pets_alive)}${st('Đang ốm', s.ill_now)}${st('Xu đang có', s.coins_total)}${st('Bạn bè', s.friends)}${st('Quà 7 ngày', s.gifts_7d)}${st('Thư chưa nhận', s.mail_unclaimed)}${st('Báo cáo đang mở', s.reports_open)}${st('Đang bị phạt', s.sanctions_active)}${st('Sự kiện đang chạy', s.events_live)}</div>
      <h3>Bệnh theo loại</h3><div class="card">${Object.entries(s.ill_by_type || {}).map(([k, n]) => `<span class="pill warn">${esc(k)}: ${esc(n)}</span> `).join('') || '<span class="small">Không có bé nào đang ốm.</span>'}</div>
      <h3>Loài phổ biến</h3><div class="card">${(s.species_top || []).map((x: any) => `<span class="pill">${esc(x.species)}: ${esc(x.n)}</span> `).join('') || '—'}</div>`; } },
  { id: 'users', label: 'Người chơi', need: 'search', render: async () => `<h2>Người chơi</h2><div class="card row"><div><label for="q">Tên, mã bạn bè${can(role, 'get_user') ? ', email' : ''}</label><input id="q"></div><button class="p" id="find">Tìm</button></div><div id="found"></div><div id="user"></div>`,
    bind: () => {
      $('find').onclick = () => guard(async () => { const r = await rpc('admin_search_user', { p_q: val('q') }); $('found').innerHTML = `<div class="card"><table><tr><th>Tên</th><th>Mã</th><th>Loài</th><th>Gắn bó</th><th>Email</th><th></th></tr>${r.map((p: any) => `<tr><td>${esc(p.name)}</td><td>${esc(p.code)}</td><td>${esc(p.species)}</td><td>${esc(p.bond_level)}</td><td>${esc(p.email ?? '—')}</td><td>${can(role, 'get_user') ? `<button class="g" data-view="${esc(p.user_id)}">Xem</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Không thấy ai.</td></tr>'}</table></div>`; }, 'Đã tìm.');
      $('found').onclick = async e => { const b = (e.target as HTMLElement).closest('[data-view]') as HTMLElement | null; if (!b) return; const id = b.dataset.view!;
        await guard(async () => { const u = await rpc('admin_get_user', { p_user: id }); $('user').innerHTML = `<div class="card"><h3>${esc(u.profile.display_name)} (${esc(u.profile.friend_code)})</h3><p>Email: ${esc(u.email ?? '—')} · Xu: ${esc(u.coins)} · Bạn bè: ${esc(u.friends)} · Báo cáo về người này: ${esc(u.reports_against)}</p>
          <p>Bé: ${esc(u.pet?.stage)} · bệnh: ${esc(u.pet?.illness ?? 'không')} · No ${esc(Math.round(u.pet?.no))} · Vui ${esc(Math.round(u.pet?.vui))} · Sạch ${esc(Math.round(u.pet?.sach))} · NL ${esc(Math.round(u.pet?.nl))}</p>
          ${can(role, 'grant') ? `<h3>Tặng quà</h3><div class="row"><div><label for="gc">Xu</label><input id="gc" type="number" min="0" value="50" style="width:90px"></div><div><label for="gn">Lời nhắn</label><input id="gn" maxlength="80"></div></div>${reasonField}<p><button class="p" id="grant">Gửi vào hộp thư</button></p>` : ''}
          ${can(role, 'sanction') ? `<h3>Phạt</h3><div class="row"><select id="sk"><option value="mute">Cấm chat</option><option value="ban">Cấm tài khoản</option></select><input id="sh" type="number" min="1" value="24" style="width:90px"><span class="small">giờ</span></div>${reasonField.replace('id="why"', 'id="why2"')}<p><button class="g" id="sanc">Phạt</button></p>` : ''}</div>`;
          const g = document.getElementById('grant'); if (g) g.onclick = () => guard(() => rpc('admin_grant', { p_user: id, p_coins: +val('gc'), p_items: [], p_note: val('gn'), p_reason: val('why') }), 'Đã gửi quà.');
          const s = document.getElementById('sanc'); if (s) s.onclick = () => guard(() => rpc('admin_sanction', { p_user: id, p_kind: val('sk'), p_hours: +val('sh'), p_reason: val('why2') }), 'Đã phạt.'); }, 'Đã mở hồ sơ (được ghi vào nhật ký).'); }; } },
  { id: 'gifts', label: 'Tặng quà', need: 'campaign', render: async () => {
    const list = await rpc('admin_list_campaigns');
    return `<h2>Chiến dịch quà</h2><div class="card"><div class="row"><div><label for="ct">Tiêu đề</label><input id="ct"></div><div><label for="cc">Xu mỗi người</label><input id="cc" type="number" min="0" value="50" style="width:110px"></div></div>
      <label for="cb">Lời nhắn</label><textarea id="cb"></textarea><div class="row"><div><label for="ca">Nhóm nhận</label><select id="ca"><option value="all">Mọi người</option><option value="b3">Gắn bó từ cấp 3</option><option value="b5">Gắn bó từ cấp 5</option><option value="codes">Theo mã bạn bè</option></select></div><div><label for="cd">Mã (cách nhau dấu phẩy)</label><input id="cd"></div></div>${reasonField}
      <p><button class="g" id="prev">Xem trước số người nhận</button> <button class="p" id="mk">Tạo chiến dịch</button> <span id="cnt" class="small"></span></p><p class="small">Chiến dịch lớn (nhiều người hoặc nhiều xu) cần một quản trị viên khác duyệt.</p></div>
      <h3>Gần đây</h3><div class="card"><table><tr><th>Tiêu đề</th><th>Xu</th><th>Người nhận</th><th>Trạng thái</th><th>Lúc</th><th></th></tr>${list.map((c: any) => `<tr><td>${esc(c.title)}</td><td>${esc(c.coins)}</td><td>${esc(c.recipients)}</td><td><span class="pill ${c.status === 'sent' ? 'ok' : c.status === 'pending' ? 'warn' : ''}">${esc(c.status === 'sent' ? 'Đã gửi' : c.status === 'pending' ? 'Chờ duyệt' : 'Đã huỷ')}</span></td><td>${fmt(c.created_at)}</td><td>${c.status === 'pending' ? `<button class="g" data-ap="${esc(c.id)}">Duyệt</button> <button class="g" data-cn="${esc(c.id)}">Huỷ</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Chưa có.</td></tr>'}</table></div>`; },
    bind: () => {
      const aud = () => { const t = val('ca'); return t === 'all' ? { all: true } : t === 'b3' ? { min_bond: 3 } : t === 'b5' ? { min_bond: 5 } : { codes: val('cd').split(',').map(x => x.trim().toUpperCase()).filter(Boolean) }; };
      $('prev').onclick = () => guard(async () => { $('cnt').textContent = `${await rpc('admin_preview_audience', { p_audience: aud() })} người sẽ nhận`; }, 'Đã đếm.');
      $('mk').onclick = () => guard(async () => { const r = await rpc('admin_create_campaign', { p_title: val('ct'), p_body: val('cb'), p_items: [], p_coins: +val('cc'), p_audience: aud(), p_reason: val('why') }); await show('gifts'); flash(r.status === 'sent' ? `Đã gửi cho ${r.recipients} người.` : `Chờ duyệt (${r.recipients} người).`); }, '');
      document.querySelector('main')!.addEventListener('click', async e => { const t = e.target as HTMLElement; const ap = t.closest('[data-ap]') as HTMLElement | null, cn = t.closest('[data-cn]') as HTMLElement | null; if (!ap && !cn) return;
        const reason = prompt('Lý do?') || ''; await guard(async () => { if (ap) await rpc('admin_approve_campaign', { p_id: +ap.dataset.ap!, p_reason: reason }); else await rpc('admin_cancel_campaign', { p_id: +cn!.dataset.cn!, p_reason: reason }); await show('gifts'); }, 'Đã xử lý.'); }, { once: true }); } },
  { id: 'news', label: 'Thông báo', need: 'announce', render: async () => {
    const list = await rpc('admin_list_announcements');
    return `<h2>Thông báo trong game</h2><div class="card"><div class="row"><div><label for="nk">Loại</label><select id="nk"><option value="update">Cập nhật</option><option value="maintenance">Bảo trì</option><option value="event">Sự kiện</option><option value="notice">Thông báo</option></select></div><div><label for="nt">Tiêu đề</label><input id="nt"></div></div>
      <label for="nb">Nội dung</label><textarea id="nb"></textarea><div class="row"><label><input id="np" type="checkbox" style="width:auto"> Ghim lên đầu</label></div>${reasonField}<p><button class="p" id="post">Đăng ngay</button></p></div>
      <h3>Đã đăng</h3><div class="card"><table><tr><th>Loại</th><th>Tiêu đề</th><th>Từ</th><th></th></tr>${list.map((a: any) => `<tr><td>${esc(a.kind)}</td><td>${esc(a.title)}${a.pinned ? ' <span class="pill">ghim</span>' : ''}</td><td>${fmt(a.starts_at)}</td><td><button class="g" data-del="${esc(a.id)}">Xoá</button></td></tr>`).join('') || '<tr><td colspan="4">Chưa có.</td></tr>'}</table></div>`; },
    bind: () => {
      $('post').onclick = () => guard(async () => { await rpc('admin_upsert_announcement', { p_id: null, p_kind: val('nk'), p_title: val('nt'), p_body: val('nb'), p_starts: null, p_ends: null, p_pinned: ($('np') as HTMLInputElement).checked, p_min_bond: 1, p_reason: val('why') }); await show('news'); }, '');
      document.querySelector('main')!.addEventListener('click', async e => { const d = (e.target as HTMLElement).closest('[data-del]') as HTMLElement | null; if (!d) return; const reason = prompt('Lý do xoá?') || ''; await guard(async () => { await rpc('admin_delete_announcement', { p_id: +d.dataset.del!, p_reason: reason }); await show('news'); }, 'Đã xoá.'); }, { once: true }); } },
  { id: 'events', label: 'Sự kiện', need: 'event', render: async () => {
    const list = await rpc('admin_list_events');
    return `<h2>Sự kiện</h2><div class="card"><div class="row"><div><label for="et">Tên</label><input id="et"></div><div><label for="ek">Loại</label><select id="ek"><option value="seasonal">Theo mùa</option><option value="limited">Giới hạn</option><option value="community">Cộng đồng</option></select></div></div>
      <div class="row"><div><label for="es">Bắt đầu</label><input id="es" type="datetime-local"></div><div><label for="ee">Kết thúc</label><input id="ee" type="datetime-local"></div></div>
      <div class="row"><div><label for="eb">Biểu ngữ</label><input id="eb" maxlength="120"></div><div><label for="ed">Trang trí Quảng trường</label><select id="ed"><option value="">Không</option><option value="tet">Tết</option><option value="trung-thu">Trung thu</option><option value="giang-sinh">Giáng sinh</option><option value="he">Mùa hè</option></select></div><div><label for="ec">Nhân xu nhiệm vụ (1–3, để trống nếu không)</label><input id="ec" type="number" min="1" max="3" step="0.1" style="width:90px"></div></div>${reasonField}<p><button class="p" id="mkev">Tạo sự kiện</button></p></div>
      <h3>Danh sách</h3><div class="card"><table><tr><th>Tên</th><th>Từ</th><th>Đến</th><th>Bật</th><th></th></tr>${list.map((v: any) => `<tr><td>${esc(v.title)}</td><td>${fmt(v.starts_at)}</td><td>${fmt(v.ends_at)}</td><td>${v.enabled ? '<span class="pill ok">Bật</span>' : '<span class="pill">Tắt</span>'}</td><td><button class="g" data-tg="${esc(v.id)}" data-on="${v.enabled ? 0 : 1}">${v.enabled ? 'Tắt khẩn cấp' : 'Bật lại'}</button></td></tr>`).join('') || '<tr><td colspan="5">Chưa có.</td></tr>'}</table></div>`; },
    bind: () => {
      $('mkev').onclick = () => guard(async () => { const cfg: Record<string, string | number> = {}; if (val('eb')) cfg.banner = val('eb'); if (val('ed')) cfg.plaza_decor = val('ed'); if (val('ec')) cfg.coin_boost = +val('ec');
        await rpc('admin_upsert_event', { p_id: null, p_title: val('et'), p_body: '', p_kind: val('ek'), p_starts: new Date(val('es')).toISOString(), p_ends: new Date(val('ee')).toISOString(), p_config: cfg, p_reason: val('why') }); await show('events'); }, '');
      document.querySelector('main')!.addEventListener('click', async e => { const t = (e.target as HTMLElement).closest('[data-tg]') as HTMLElement | null; if (!t) return; const reason = prompt('Lý do?') || ''; await guard(async () => { await rpc('admin_set_event_enabled', { p_id: +t.dataset.tg!, p_enabled: t.dataset.on === '1', p_reason: reason }); await show('events'); }, 'Đã đổi.'); }, { once: true }); } },
  { id: 'mod', label: 'Kiểm duyệt', need: 'report', render: async () => {
    const [reports, sanc, words] = await Promise.all([rpc('admin_list_reports', { p_status: 'open' }), rpc('admin_list_sanctions'), rpc('admin_list_words')]);
    return `<h2>Kiểm duyệt</h2><h3>Báo cáo đang mở (${reports.length})</h3><div class="card"><table><tr><th>Người báo</th><th>Người bị báo</th><th>Lý do</th><th>Chi tiết</th><th>Báo cáo mở</th><th></th></tr>${reports.map((r: any) => `<tr><td>${esc(r.reporter)}</td><td>${esc(r.target)}</td><td>${esc(r.reason)}</td><td>${esc(r.detail)}</td><td>${esc(r.target_open_reports)}</td><td><button class="g" data-rs="dismiss" data-id="${esc(r.id)}">Bỏ qua</button> <button class="g" data-rs="mute" data-id="${esc(r.id)}">Cấm chat 24h</button> <button class="g" data-rs="ban" data-id="${esc(r.id)}">Cấm 7 ngày</button></td></tr>`).join('') || '<tr><td colspan="6">Không có báo cáo.</td></tr>'}</table></div>
      <h3>Đang bị phạt</h3><div class="card"><table><tr><th>Người</th><th>Loại</th><th>Đến</th><th>Lý do</th><th></th></tr>${sanc.map((s: any) => `<tr><td>${esc(s.name)}</td><td>${esc(s.kind)}</td><td>${fmt(s.until)}</td><td>${esc(s.reason)}</td><td><button class="g" data-lift="${esc(s.id)}">Gỡ</button></td></tr>`).join('') || '<tr><td colspan="5">Không ai.</td></tr>'}</table></div>
      <h3>Bộ từ khoá</h3><div class="card"><div class="row"><div><label for="wt">Từ</label><input id="wt"></div><div><label for="wm">Cách khớp</label><select id="wm"><option value="word">Cả từ</option><option value="substr">Chứa chuỗi</option></select></div><div><label for="wa">Xử lý</label><select id="wa"><option value="block">Chặn tin</option><option value="mask">Che bằng ***</option><option value="flag">Gắn cờ</option></select></div></div>${reasonField}<p><button class="p" id="addw">Thêm</button></p>
      <p>${words.map((w: any) => `<span class="pill">${esc(w.term)} · ${esc(w.action)} <a href="#" data-dw="${esc(w.term)}">xoá</a></span> `).join('') || '<span class="small">Chưa có từ nào.</span>'}</p></div>`; },
    bind: () => {
      $('addw').onclick = () => guard(async () => { await rpc('admin_upsert_word', { p_term: val('wt'), p_match: val('wm'), p_action: val('wa'), p_reason: val('why') }); await show('mod'); }, '');
      document.querySelector('main')!.addEventListener('click', async e => { const t = e.target as HTMLElement; const rs = t.closest('[data-rs]') as HTMLElement | null, lf = t.closest('[data-lift]') as HTMLElement | null, dw = t.closest('[data-dw]') as HTMLElement | null; if (!rs && !lf && !dw) return; e.preventDefault();
        const reason = prompt('Lý do?') || ''; await guard(async () => { if (rs) await rpc('admin_resolve_report', { p_id: +rs.dataset.id!, p_action: rs.dataset.rs, p_hours: rs.dataset.rs === 'ban' ? 168 : 24, p_reason: reason }); else if (lf) await rpc('admin_lift_sanction', { p_id: +lf.dataset.lift!, p_reason: reason }); else await rpc('admin_delete_word', { p_term: dw!.dataset.dw, p_reason: reason }); await show('mod'); }, 'Đã xử lý.'); }, { once: true }); } },
  { id: 'sys', label: 'Hệ thống', need: 'flag', render: async () => {
    const f = await rpc('admin_list_flags'); const roles = can(role, 'role') ? await rpc('admin_list_roles') : [];
    return `<h2>Cờ hệ thống</h2><div class="card"><p>Chat công cộng: <span class="pill ${f['chat.public.enabled'] ? 'ok' : 'warn'}">${f['chat.public.enabled'] ? 'Đang bật' : 'Đang tắt'}</span></p>${reasonField}<p><button class="p" id="chat">${f['chat.public.enabled'] ? 'Tắt chat công cộng' : 'Bật chat công cộng'}</button></p><p class="small">Chỉ bật khi đã chốt pháp lý và có người kiểm duyệt.</p></div>
      ${roles.length ? `<h3>Vai trò quản trị</h3><div class="card"><table><tr><th>Email</th><th>Vai trò</th><th>Từ</th></tr>${roles.map((r: any) => `<tr><td>${esc(r.email)}</td><td>${esc(r.role)}</td><td>${fmt(r.since)}</td></tr>`).join('')}</table></div>` : ''}`; },
    bind: () => { $('chat').onclick = () => guard(async () => { const f = await rpc('admin_list_flags'); await rpc('admin_set_flag', { p_key: 'chat.public.enabled', p_value: !f['chat.public.enabled'], p_reason: val('why') }); await show('sys'); }, ''); } },
  { id: 'audit', label: 'Nhật ký', need: 'audit', render: async () => {
    const log = await rpc('admin_audit_list', { p_limit: 100 });
    return `<h2>Nhật ký kiểm toán</h2><div class="card"><table><tr><th>Lúc</th><th>Ai</th><th>Việc</th><th>Đối tượng</th><th>Lý do</th></tr>${log.map((l: any) => `<tr><td>${fmt(l.at)}</td><td>${esc(l.admin)}</td><td>${esc(l.action)}</td><td>${esc(l.target)}</td><td>${esc(l.reason)}</td></tr>`).join('') || '<tr><td colspan="5">Chưa có.</td></tr>'}</table></div><p class="small">Nhật ký không sửa hoặc xoá được.</p>`; } },
];

async function show(id: string) {
  const t = TABS.find(x => x.id === id && can(role, x.need)) || TABS.find(x => can(role, x.need)); if (!t) return;
  tab = t.id; document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-current', String((b as HTMLElement).dataset.tab === tab)));
  const main = document.querySelector('main')!; main.innerHTML = '<p class="small">Đang tải…</p>';
  try { main.innerHTML = '<div id="msg"></div>' + await t.render(); t.bind?.(); } catch (e) { main.innerHTML = `<div class="msg err">${esc(viMsg(e))}</div>`; }
}
async function start(): Promise<void> {
  try { const me = await rpc('admin_me'); role = me.role; if (!me.mfa && !isDemo) return mfaStep(); } catch (e) { return loginView(viMsg(e)); }
  root.innerHTML = `<header><h1>Hatchday · Quản trị</h1><nav>${TABS.filter(t => can(role, t.need)).map(t => `<button data-tab="${t.id}">${t.label}</button>`).join('')}</nav><span class="who">Vai trò: ${esc(role)} <button class="g" id="out">Thoát</button></span></header><main></main>`;
  document.querySelector('nav')!.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null; if (b) show(b.dataset.tab!); });
  $('out').onclick = async () => { await sb?.auth.signOut(); loginView(); };
  await show(tab || 'dash');
}
// Tự đăng xuất sau 30 phút không thao tác
['click', 'keydown'].forEach(ev => addEventListener(ev, () => { idle = Date.now(); }));
setInterval(() => { if (!isDemo && idle && Date.now() - idle > 30 * 60000 && sb) { idle = 0; sb.auth.signOut().then(() => loginView('Đã tự thoát vì lâu không thao tác.')); } }, 60000);
if (isDemo) start(); else sb!.auth.getSession().then(({ data }) => (data.session ? mfaStep() : loginView()));
