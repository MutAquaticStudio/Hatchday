/** Trang quản trị trên Postgres thật: vai trò, hai bước, kiểm toán, quà, chiến dịch, thông báo, sự kiện, kiểm duyệt. */
import { beforeAll, describe, expect, it } from 'vitest';
import { ACTIONS, can, ROLES, seesEmail, type Role } from '../../admin/src/rbac';
import { createHarness, type Harness } from './harness';

const U = (n: number) => `70000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const OWNER = U(1), OPS = U(2), SUP = U(3), MOD = U(4), ANA = U(5), P1 = U(10), P2 = U(11), P3 = U(12);
const ROLE_OF: Record<string, Role> = { [OWNER]: 'owner', [OPS]: 'ops', [SUP]: 'support', [MOD]: 'moderator', [ANA]: 'analyst' };
let h: Harness;
const as2 = (u: string, aal = 'aal2') => h.as(u, { aal });
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const audits = async (action: string) => Number(await h.one('select count(*) from admin_audit where action = $1', [action]));

beforeAll(async () => {
  h = await createHarness();
  await h.addUsers(OWNER, OPS, SUP, MOD, ANA, P1, P2, P3);
  for (const [u, n] of [[P1, 'Một'], [P2, 'Hai'], [P3, 'Ba']] as const) { await h.as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); }
  for (const [u, r] of Object.entries(ROLE_OF)) await h.db.exec(`insert into admin_roles (user_id, role) values ('${u}', '${r}')`);
}, 90_000);

describe('ma trận quyền khớp admin/src/rbac.ts', () => {
  it('mọi vai trò × mọi hành động', async () => {
    for (const r of ROLES) for (const a of ACTIONS) expect(await h.one('select private.admin_can($1, $2)', [r, a]), `${r}/${a}`).toBe(can(r, a));
    expect(seesEmail('support')).toBe(true); expect(seesEmail('moderator')).toBe(false);
  });
});

describe('cổng vào', () => {
  it('chưa đăng nhập, không phải admin, thiếu xác thực hai bước, sai vai trò đều bị từ chối', async () => {
    await h.as(null); await expect(rpc('admin_dashboard_stats')).rejects.toThrow('not_authenticated');
    await as2(P1); await expect(rpc('admin_dashboard_stats')).rejects.toThrow('not_admin');
    await as2(OWNER, 'aal1'); await expect(rpc('admin_dashboard_stats')).rejects.toThrow('mfa_required');
    await as2(ANA); await expect(rpc('admin_audit_list')).rejects.toThrow('forbidden');
    await as2(MOD); await expect(rpc('admin_dashboard_stats')).rejects.toThrow('forbidden');
    expect((await rpc('admin_list_reports', 'open'))).toEqual([]);
  });
  it('admin_me cho biết vai trò và đã qua hai bước chưa (không cần hai bước để hỏi)', async () => {
    await as2(OPS, 'aal1'); expect(await rpc('admin_me')).toEqual({ role: 'ops', mfa: false });
    await as2(OPS); expect(await rpc('admin_me')).toEqual({ role: 'ops', mfa: true });
    await as2(P1); await expect(rpc('admin_me')).rejects.toThrow('not_admin');
  });
  it('quyền thật: authenticated không đọc/ghi thẳng các bảng quản trị; anon không gọi được RPC', async () => {
    for (const t of ['admin_roles', 'admin_audit', 'system_flags', 'gift_campaigns', 'events', 'reports', 'sanctions', 'word_filter']) {
      expect(Number(await h.withRole(OWNER, () => h.one(`select count(*) from ${t}`), { claims: { aal: 'aal2' } })), t).toBe(t === 'admin_roles' ? 0 : Number(await h.one(`select count(*) from ${t}`)) * 0);
    }
    await expect(h.withRole(OWNER, () => h.q(`insert into admin_roles (user_id, role) values ($1, 'owner')`, [P1]))).rejects.toThrow(/permission denied/);
    await expect(h.withRole(null, () => h.q('select admin_me()'), { role: 'anon' })).rejects.toThrow(/permission denied/);
  });
});

describe('thống kê và người chơi', () => {
  it('bảng điều khiển có số liệu đúng', async () => {
    await as2(ANA); const s = await rpc('admin_dashboard_stats');
    expect(s).toMatchObject({ players: 3, pets_alive: 3, reports_open: 0, friends: 0 });
  });
  it('tìm người chơi: email chỉ hiện cho owner/ops/support; ngắn quá thì lỗi', async () => {
    await as2(SUP); const r = await rpc('admin_search_user', 'Hai'); expect(r).toHaveLength(1); expect(r[0].email).toContain('@');
    await as2(MOD); const m = await rpc('admin_search_user', 'Hai'); expect(m[0].email).toBeNull();
    await expect(rpc('admin_search_user', 'a')).rejects.toThrow('query_too_short');
  });
  it('xem một người: kiểm toán lại; không tồn tại thì lỗi', async () => {
    await as2(SUP); const before = await audits('view_user');
    const u = await rpc('admin_get_user', P2); expect(u.profile.display_name).toBe('Hai'); expect(u.profile.privacy).toBeUndefined();
    expect(await audits('view_user')).toBe(before + 1);
    await expect(rpc('admin_get_user', U(99))).rejects.toThrow('not_found');
  });
});

describe('tặng quà một người', () => {
  it('vào hộp thư người nhận, có kiểm toán; bắt buộc có lý do', async () => {
    await as2(SUP);
    await expect(rpc('admin_grant', P2, 50, JSON.stringify([]), 'Quà', '')).rejects.toThrow('reason_required');
    const mid = await rpc('admin_grant', P2, 50, JSON.stringify([{ id: 'tra-gung', qty: 1 }]), 'Xin lỗi vì lỗi', 'bù lỗi mất dữ liệu #12');
    expect(mid).toBeGreaterThan(0); expect(await audits('grant')).toBe(1);
    await h.as(P2); const inbox = await rpc('get_inbox'); expect(inbox.mail[0]).toMatchObject({ title: 'Quà từ Hatchday', coins: 50, from: null });
  });
  it('hỗ trợ viên có hạn mức (200 xu, 5 phần); owner thì không; moderator không được', async () => {
    await as2(SUP); await expect(rpc('admin_grant', P2, 201, '[]', '', 'vượt hạn mức')).rejects.toThrow('grant_limit');
    await expect(rpc('admin_grant', P2, 0, '[]', '', 'không có gì')).rejects.toThrow('invalid_grant');
    await expect(rpc('admin_grant', P2, 0, JSON.stringify([{ id: 'khong-co', qty: 1 }]), '', 'món lạ')).rejects.toThrow('invalid_grant');
    await as2(OWNER); expect(await rpc('admin_grant', P2, 500, '[]', 'thưởng lớn', 'sự kiện thử')).toBeGreaterThan(0);
    await as2(MOD); await expect(rpc('admin_grant', P2, 1, '[]', '', 'x x x')).rejects.toThrow('forbidden');
  });
});

describe('chiến dịch quà', () => {
  it('xem trước người nhận; nhỏ thì gửi luôn tới đúng nhóm', async () => {
    await as2(OPS);
    expect(await rpc('admin_preview_audience', JSON.stringify({ all: true }))).toBe(3);
    await h.db.exec(`update public_profiles set bond_level = 5 where user_id = '${P3}'`);
    expect(await rpc('admin_preview_audience', JSON.stringify({ min_bond: 3 }))).toBe(1);
    const code3 = await h.one('select friend_code from public_profiles where user_id = $1', [P3]);
    const r = await rpc('admin_create_campaign', 'Chào mừng', 'Cảm ơn bạn', JSON.stringify([{ id: 'carot', qty: 2 }]), 20, JSON.stringify({ codes: [code3] }), 'quà tri ân');
    expect(r).toMatchObject({ status: 'sent', recipients: 1 });
    await h.as(P3); expect((await rpc('get_inbox')).mail.map((m: any) => m.title)).toContain('Chào mừng');
    await h.as(P1); expect((await rpc('get_inbox')).mail.map((m: any) => m.title)).not.toContain('Chào mừng');
  });
  it('vượt ngưỡng thì chờ người khác duyệt; người tạo không tự duyệt; duyệt xong gửi tới mọi người', async () => {
    await as2(OPS); await rpc('admin_set_flag', 'x', '1', 'x x x').catch(() => {});
    await h.db.exec(`update system_flags set value = '{"users": 1, "coins": 500}' where key = 'campaign.approval'`);
    const r = await rpc('admin_create_campaign', 'Quà lớn', '', '[]', 100, JSON.stringify({ all: true }), 'tri ân toàn máy chủ');
    expect(r).toMatchObject({ status: 'pending', recipients: 3 });
    await expect(rpc('admin_approve_campaign', r.id, 'tự duyệt')).rejects.toThrow('self_approval');
    await as2(SUP); await expect(rpc('admin_approve_campaign', r.id, 'đồng ý')).rejects.toThrow('forbidden');
    await as2(OWNER); expect(await rpc('admin_approve_campaign', r.id, 'đã xem')).toBe(3);
    await expect(rpc('admin_approve_campaign', r.id, 'lần hai')).rejects.toThrow('not_pending');
    await h.as(P1); expect((await rpc('get_inbox')).mail.map((m: any) => m.title)).toContain('Quà lớn');
    expect((await h.q<{ r: any }>("select to_jsonb(c) as r from gift_campaigns c where title = 'Quà lớn'"))[0].r).toMatchObject({ status: 'sent', recipients: 3 });
  });
  it('huỷ chiến dịch chờ duyệt; đối tượng rỗng hoặc quà rỗng bị từ chối', async () => {
    await as2(OPS);
    const r = await rpc('admin_create_campaign', 'Chờ', '', '[]', 600, JSON.stringify({ all: true }), 'thử huỷ');
    expect(r.status).toBe('pending'); await rpc('admin_cancel_campaign', r.id, 'đổi ý');
    await expect(rpc('admin_cancel_campaign', r.id, 'lần hai')).rejects.toThrow('not_pending');
    await expect(rpc('admin_create_campaign', 'Rỗng', '', '[]', 10, JSON.stringify({ codes: ['ZZZZZZZZ'] }), 'không ai')).rejects.toThrow('empty_audience');
    await expect(rpc('admin_create_campaign', 'Trống', '', '[]', 0, JSON.stringify({ all: true }), 'không có quà')).rejects.toThrow('invalid_campaign');
  });
});

describe('thông báo và sự kiện', () => {
  it('tạo, sửa, xoá thông báo; người chơi thấy qua get_news; kiểm toán đủ', async () => {
    await as2(OPS);
    const id = await rpc('admin_upsert_announcement', null, 'update', 'Bản 1.2', 'Có bản đồ mới', null, null, true, 1, 'ghi chú bản cập nhật');
    await h.as(P1); expect((await rpc('get_news')).map((n: any) => n.title)).toContain('Bản 1.2');
    await as2(OPS); await rpc('admin_upsert_announcement', id, 'maintenance', 'Bảo trì 1.2', '2 giờ sáng', null, null, true, 1, 'đổi loại');
    await h.as(P1); expect((await rpc('get_news')).find((n: any) => n.id === id)).toMatchObject({ kind: 'maintenance', title: 'Bảo trì 1.2' });
    await as2(OPS); await rpc('admin_delete_announcement', id, 'xong việc');
    await expect(rpc('admin_upsert_announcement', null, 'lạ', 'x', '', null, null, false, 1, 'sai loại')).rejects.toThrow('invalid_announcement');
    await expect(rpc('admin_delete_announcement', id, 'lần hai')).rejects.toThrow('not_found');
    expect([await audits('announce_create'), await audits('announce_update'), await audits('announce_delete')]).toEqual([1, 1, 1]);
  });
  it('sự kiện: cấu hình hợp lệ mới lưu; chỉ sự kiện đang chạy và bật mới tới người chơi; tắt khẩn cấp', async () => {
    await as2(OPS);
    await expect(rpc('admin_upsert_event', null, 'Tết', '', 'seasonal', '2026-01-01', '2026-01-02', JSON.stringify({ gia_tien: 5 }), 'cấu hình lạ')).rejects.toThrow('invalid_event_config');
    await expect(rpc('admin_upsert_event', null, 'Tết', '', 'seasonal', '2026-01-02', '2026-01-01', '{}', 'ngày ngược')).rejects.toThrow();
    const id = await rpc('admin_upsert_event', null, 'Mùa Tết', 'Trang trí Quảng trường', 'seasonal', new Date(Date.now() - 3600e3).toISOString(), new Date(Date.now() + 86400e3).toISOString(), JSON.stringify({ banner: 'Chúc mừng năm mới', plaza_decor: 'tet' }), 'lịch Tết');
    await rpc('admin_upsert_event', null, 'Chưa tới', '', 'limited', new Date(Date.now() + 86400e3).toISOString(), new Date(Date.now() + 2 * 86400e3).toISOString(), '{}', 'sự kiện sau');
    await h.as(P1); expect((await rpc('get_active_events')).map((e: any) => e.title)).toEqual(['Mùa Tết']);
    await as2(OPS); await rpc('admin_set_event_enabled', id, false, 'tắt khẩn cấp');
    await h.as(P1); expect(await rpc('get_active_events')).toEqual([]);
    await as2(ANA); await expect(rpc('admin_list_events')).rejects.toThrow('forbidden');
  });
});

describe('kiểm duyệt', () => {
  it('báo cáo người chơi: giới hạn, trùng, lý do sai', async () => {
    await h.as(P1); const code2 = await h.one('select friend_code from public_profiles where user_id = $1', [P2]);
    await expect(rpc('report_user', code2, 'xyz')).rejects.toThrow('invalid_reason');
    await rpc('report_user', code2, 'harassment', 'nhắn tin làm phiền');
    await expect(rpc('report_user', code2, 'spam')).rejects.toThrow('already_reported');
    await h.as(P3); await rpc('report_user', code2, 'spam');
    await expect(rpc('report_user', await h.one('select friend_code from public_profiles where user_id = $1', [P3]), 'spam')).rejects.toThrow('not_found');
  });
  it('hàng đợi: thấy báo cáo, số báo cáo đang mở; phạt xử lý cả các báo cáo cùng người; có kiểm toán', async () => {
    await as2(MOD); const q = await rpc('admin_list_reports', 'open');
    expect(q).toHaveLength(2); expect(q[0]).toMatchObject({ target: 'Hai', reporter: 'Một', target_open_reports: 2 });
    await expect(rpc('admin_resolve_report', q[0].id, 'mute', 2, '')).rejects.toThrow('reason_required');
    await rpc('admin_resolve_report', q[0].id, 'mute', 2, 'làm phiền nhiều lần');
    expect(await rpc('admin_list_reports', 'open')).toEqual([]);
    expect(await h.one("select private.is_sanctioned($1, 'mute')", [P2])).toBe(true);
    expect(await h.one("select private.is_sanctioned($1, 'ban')", [P2])).toBe(false);
    await expect(rpc('admin_resolve_report', q[0].id, 'dismiss', 0, 'lần hai')).rejects.toThrow('not_open');
    expect(await audits('report_mute')).toBe(1);
  });
  it('phạt trực tiếp, gỡ phạt, không phạt được admin, giờ phải hợp lệ', async () => {
    await as2(MOD);
    const sid = await rpc('admin_sanction', P3, 'ban', 24, 'gian lận');
    expect(await h.one("select private.is_sanctioned($1, 'mute')", [P3])).toBe(true); // cấm tài khoản gồm cả cấm chat
    expect((await rpc('admin_list_sanctions')).map((s: any) => s.kind)).toEqual(expect.arrayContaining(['ban', 'mute']));
    await rpc('admin_lift_sanction', sid, 'kháng cáo đúng');
    expect(await h.one("select private.is_sanctioned($1, 'ban')", [P3])).toBe(false);
    await expect(rpc('admin_sanction', OWNER, 'mute', 1, 'thử admin')).rejects.toThrow('cannot_sanction_admin');
    await expect(rpc('admin_sanction', P3, 'mute', 0, 'giờ sai')).rejects.toThrow('invalid_sanction');
    await expect(rpc('admin_lift_sanction', sid, 'lần hai')).rejects.toThrow('not_found');
  });
  it('bộ từ khoá: thêm, sửa, xoá; chỉ moderator/owner', async () => {
    await as2(MOD);
    await rpc('admin_upsert_word', 'Từ Xấu', 'word', 'block', 'thêm từ'); await rpc('admin_upsert_word', 'từ xấu', 'substr', 'mask', 'đổi kiểu');
    expect(await rpc('admin_list_words')).toEqual([{ term: 'từ xấu', match: 'substr', action: 'mask' }]);
    await expect(rpc('admin_upsert_word', 'x', 'word', 'block', 'quá ngắn')).rejects.toThrow('invalid_word');
    await rpc('admin_delete_word', 'từ xấu', 'dọn'); await expect(rpc('admin_delete_word', 'từ xấu', 'lần hai')).rejects.toThrow('not_found');
    await as2(SUP); await expect(rpc('admin_list_words')).rejects.toThrow('forbidden');
  });
});

describe('vai trò, cờ hệ thống, kiểm toán', () => {
  it('chỉ owner đổi vai trò; không bỏ được owner cuối; vai trò sai bị chặn', async () => {
    await as2(OPS); await expect(rpc('admin_set_role', P1, 'support', 'cấp quyền')).rejects.toThrow('forbidden');
    await as2(OWNER);
    await rpc('admin_set_role', P1, 'support', 'tuyển hỗ trợ viên'); expect(await h.one('select role from admin_roles where user_id = $1', [P1])).toBe('support');
    await expect(rpc('admin_set_role', P1, 'siêu', 'vai trò lạ')).rejects.toThrow('invalid_role');
    await expect(rpc('admin_set_role', OWNER, 'ops', 'tự hạ quyền')).rejects.toThrow('last_owner');
    await rpc('admin_set_role', P1, null, 'nghỉ việc'); expect(Number(await h.one('select count(*) from admin_roles where user_id = $1', [P1]))).toBe(0);
    expect((await rpc('admin_list_roles')).length).toBe(5);
  });
  it('cờ hệ thống: bật chat công cộng cần lý do, ghi kiểm toán, người chơi thấy qua get_public_config', async () => {
    await h.as(P2); expect(await rpc('get_public_config')).toEqual({ chat_public: false });
    await as2(OPS); await expect(rpc('admin_set_flag', 'chat.public.enabled', 'true', '')).rejects.toThrow('reason_required');
    await expect(rpc('admin_set_flag', 'chat.public.enabled', '"yes"', 'sai kiểu')).rejects.toThrow('invalid_flag');
    await expect(rpc('admin_set_flag', 'khong.co', 'true', 'cờ lạ')).rejects.toThrow('unknown_flag');
    await rpc('admin_set_flag', 'chat.public.enabled', 'true', 'đã chốt pháp lý');
    await h.as(P2); expect(await rpc('get_public_config')).toEqual({ chat_public: true });
    await as2(OPS); await rpc('admin_set_flag', 'chat.public.enabled', 'false', 'tắt khẩn cấp');
    expect((await rpc('admin_list_flags'))['chat.public.enabled']).toBe(false);
  });
  it('nhật ký kiểm toán: liệt kê được, không sửa/xoá được kể cả bằng quyền cao', async () => {
    await as2(OPS); const log = await rpc('admin_audit_list', 500);
    expect(log.length).toBeGreaterThan(15); expect(log[0].id).toBeGreaterThan(log[1].id);
    expect(log.find((l: any) => l.action === 'set_flag')).toMatchObject({ reason: expect.any(String) });
    await expect(h.q('update admin_audit set reason = $1', ['sửa'])).rejects.toThrow('audit_immutable');
    await expect(h.q('delete from admin_audit')).rejects.toThrow('audit_immutable');
  });
});
