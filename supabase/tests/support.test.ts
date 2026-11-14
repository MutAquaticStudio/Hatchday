/** Thùng thư Góp ý & Hỗ trợ và thông tin trang (ủng hộ, email liên hệ) trên Postgres thật (PGlite). */
import { beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './harness';

const U = (n: number) => `75000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const A = U(1), B = U(2), OPS = U(3), SUP = U(4), MOD = U(5), ANALYST = U(6);
let h: Harness;
const val = async (sql: string, args: unknown[] = []) => (await h.q<{ r: any }>(`select ${sql} as r`, args))[0].r;
const submit = (kind: string, subject: string, body: string, meta: unknown = {}) => val('submit_ticket($1, $2, $3, $4)', [kind, subject, body, JSON.stringify(meta)]);

beforeAll(async () => {
  h = await createHarness(); await h.addUsers(A, B, OPS, SUP, MOD, ANALYST);
  await h.db.exec(`insert into admin_roles (user_id, role) values ('${OPS}', 'ops'), ('${SUP}', 'support'), ('${MOD}', 'moderator'), ('${ANALYST}', 'analyst')`);
}, 90_000);

describe('thông tin trang', () => {
  it('mặc định có email liên hệ; khách chưa đăng nhập cũng đọc được', async () => {
    const r = await h.withRole(null, () => val('get_site_info()'), { role: 'anon' });
    expect(r).toEqual({ contact_email: 'm.thuanwork@gmail.com' });
  });
  it('ops sửa được, cần lý do, ghi kiểm toán; trường rỗng bị bỏ', async () => {
    await h.as(OPS, { aal: 'aal2' });
    await expect(val('admin_set_site_info($1, $2)', [JSON.stringify({ donate_url: 'https://ko-fi.com/hatchday' }), ''])).rejects.toThrow('reason_required');
    const r = await val('admin_set_site_info($1, $2)', [JSON.stringify({ donate_url: 'https://ko-fi.com/hatchday', donate_label: 'Mời team ly trà', bank_name: 'Vietcombank', bank_account: '0123 456 789', bank_holder: 'NGUYEN VAN A', vietqr_bank: 'VCB', qr_url: '', contact_email: 'm.thuanwork@gmail.com' }), 'mở kênh ủng hộ']);
    expect(r).toEqual({ donate_url: 'https://ko-fi.com/hatchday', donate_label: 'Mời team ly trà', bank_name: 'Vietcombank', bank_account: '0123 456 789', bank_holder: 'NGUYEN VAN A', vietqr_bank: 'VCB', contact_email: 'm.thuanwork@gmail.com' });
    expect((await h.withRole(null, () => val('get_site_info()'), { role: 'anon' })).donate_url).toBe('https://ko-fi.com/hatchday');
    expect(Number(await h.one("select count(*) from admin_audit where action = 'set_site_info'"))).toBe(1);
  });
  it('chặn dữ liệu sai dạng: link không https, javascript:, ảnh ngoài trang, email sai, trường lạ', async () => {
    await h.as(OPS, { aal: 'aal2' });
    for (const bad of [{ donate_url: 'http://x.com' }, { donate_url: 'javascript:alert(1)' }, { donate_url: 'https://x.com/"><script>' }, { qr_url: 'https://evil.com/qr.png' },
      { qr_url: '/../secret.png' }, { contact_email: 'abc' }, { bank_account: 'abc' }, { vietqr_bank: 'V C B' }, { lạ: 'x' }, { donate_label: 'x'.repeat(41) }, { donate_url: 5 }])
      await expect(val('admin_set_site_info($1, $2)', [JSON.stringify(bad), 'thử sai']), JSON.stringify(bad)).rejects.toThrow('invalid_site_info');
    expect(await val('admin_set_site_info($1, $2)', [JSON.stringify({ qr_url: './landing/qr.png' }), 'ảnh QR trong trang'])).toEqual({ qr_url: './landing/qr.png' });
  });
  it('support, analyst, người thường không sửa được', async () => {
    for (const who of [SUP, ANALYST]) { await h.as(who, { aal: 'aal2' }); await expect(val('admin_set_site_info($1, $2)', ['{}', 'thử quyền'])).rejects.toThrow('forbidden'); }
    await h.as(A); await expect(val('admin_set_site_info($1, $2)', ['{}', 'thử quyền'])).rejects.toThrow();
  });
});

describe('Góp ý & Hỗ trợ: người chơi', () => {
  it('gửi phiếu, kiểm tra dữ liệu, chỉ giữ thông tin máy cho phép', async () => {
    await h.as(null); await expect(submit('bug', 'x', 'nội dung')).rejects.toThrow('not_authenticated');
    await h.as(A);
    await expect(submit('lạ', 'Tiêu đề', 'nội dung dài')).rejects.toThrow('invalid_ticket');
    await expect(submit('bug', '   ', 'nội dung dài')).rejects.toThrow('invalid_ticket');
    await expect(submit('bug', 'Tiêu đề', 'ngắn')).rejects.toThrow('invalid_ticket');
    await expect(submit('bug', 'x'.repeat(81), 'nội dung dài')).rejects.toThrow('invalid_ticket');
    const id = await submit('bug', '  Bé kẹt ở Công viên ', 'Bé không đi được nữa', { place: 'park', build: 'abc', ip: '1.2.3.4', ua: 'x'.repeat(500) });
    const t = (await h.q<any>('select * from support_tickets where id = $1', [id]))[0];
    expect(t.subject).toBe('Bé kẹt ở Công viên'); expect(t.status).toBe('open'); expect(t.meta.ip).toBeUndefined(); expect(t.meta.place).toBe('park'); expect(t.meta.ua.length).toBe(160);
    const mine = await val('get_my_tickets()'); expect(mine.length).toBe(1); expect(mine[0].messages).toEqual([expect.objectContaining({ from_admin: false, body: 'Bé không đi được nữa' })]);
  });
  it('tối đa 3 phiếu chưa đóng; đóng bớt thì gửi tiếp được; tối đa 5 phiếu mới mỗi ngày', async () => {
    await h.as(B);
    const ids = [await submit('feedback', 'Một', 'góp ý số một'), await submit('feedback', 'Hai', 'góp ý số hai'), await submit('other', 'Ba', 'góp ý số ba')];
    await expect(submit('feedback', 'Bốn', 'góp ý số bốn')).rejects.toThrow('ticket_limit');
    await h.q('select close_my_ticket($1)', [ids[0]]); await submit('feedback', 'Bốn', 'góp ý số bốn');
    await h.q('select close_my_ticket($1)', [ids[1]]); await submit('feedback', 'Năm', 'góp ý số năm');
    await h.q('select close_my_ticket($1)', [ids[2]]); await expect(submit('feedback', 'Sáu', 'góp ý số sáu')).rejects.toThrow('ticket_limit');
  });
  it('không đọc, trả lời hay đóng phiếu của người khác; không đọc/ghi bảng trực tiếp', async () => {
    await h.as(A); const id = (await val('get_my_tickets()'))[0].id;
    await h.as(B);
    await expect(h.q('select reply_ticket($1, $2)', [id, 'chen ngang'])).rejects.toThrow('not_found');
    await expect(h.q('select close_my_ticket($1)', [id])).rejects.toThrow('not_found');
    expect((await val('get_my_tickets()')).some((t: any) => t.id === id)).toBe(false);
    await h.withRole(B, async () => {
      expect(await h.q('select * from support_tickets')).toEqual([]); expect(await h.q('select * from support_messages')).toEqual([]);
      await expect(h.q("insert into support_tickets (user_id, kind, subject) values ($1, 'bug', 'x')", [B])).rejects.toThrow();
    });
    await expect(h.withRole(null, () => h.q('select get_my_tickets()'), { role: 'anon' })).rejects.toThrow(/permission denied/);
  });
});

describe('Góp ý & Hỗ trợ: đội ngũ', () => {
  it('support xem danh sách, mở phiếu (thấy email), trả lời → người chơi có thư và dấu chưa đọc', async () => {
    await h.as(SUP, { aal: 'aal2' });
    const list = await val('admin_list_tickets($1, $2)', ['open', 50]);
    expect(list.counts.open).toBeGreaterThanOrEqual(1); expect(list.counts.new).toBeGreaterThanOrEqual(1);
    const it0 = list.items.find((x: any) => x.subject === 'Bé kẹt ở Công viên'); expect(it0.new).toBe(true); expect(it0.last).toBe('Bé không đi được nữa');
    const t = await val('admin_get_ticket($1)', [it0.id]); expect(t.email).toContain('@'); expect(t.meta.place).toBe('park');
    expect((await val('admin_list_tickets($1, $2)', ['open', 50])).items.find((x: any) => x.id === it0.id).new).toBe(false);
    await expect(h.q('select admin_reply_ticket($1, $2, $3)', [it0.id, '  ', false])).rejects.toThrow('invalid_ticket');
    await h.q('select admin_reply_ticket($1, $2, $3)', [it0.id, 'Bạn thử tải lại trang nhé.', false]);
    await h.as(A);
    expect(await val('support_unread()')).toBe(1);
    const mine = (await val('get_my_tickets()')).find((x: any) => x.id === it0.id);
    expect(mine.status).toBe('answered'); expect(mine.unread).toBe(true); expect(mine.messages.at(-1)).toEqual(expect.objectContaining({ from_admin: true, body: 'Bạn thử tải lại trang nhé.' }));
    const mail = await h.q<any>("select kind, coins, title from mailbox where to_user = $1", [A]); expect(mail).toEqual([{ kind: 'system', coins: 0, title: 'Đội ngũ Hatchday đã trả lời bạn' }]);
    await h.q('select mark_ticket_read($1)', [it0.id]); expect(await val('support_unread()')).toBe(0);
    await h.q('select reply_ticket($1, $2)', [it0.id, 'Được rồi, cảm ơn!']);
    expect((await val('get_my_tickets()')).find((x: any) => x.id === it0.id).status).toBe('open');
  });
  it('trả lời kèm đóng; người chơi không trả lời được phiếu đã đóng; mở lại bằng đổi trạng thái', async () => {
    await h.as(OPS, { aal: 'aal2' }); const id = (await val('admin_list_tickets($1, $2)', ['open', 50])).items.find((x: any) => x.subject === 'Bé kẹt ở Công viên').id;
    await h.q('select admin_reply_ticket($1, $2, $3)', [id, 'Đã sửa xong.', true]);
    await h.as(A); await expect(h.q('select reply_ticket($1, $2)', [id, 'thêm'])).rejects.toThrow('ticket_closed');
    await h.as(OPS, { aal: 'aal2' }); await expect(h.q('select admin_set_ticket_status($1, $2)', [id, 'lạ'])).rejects.toThrow('invalid_ticket');
    await h.q('select admin_set_ticket_status($1, $2)', [id, 'open']);
    await h.as(A); await h.q('select reply_ticket($1, $2)', [id, 'thêm']);
    expect(Number(await h.one("select count(*) from admin_audit where action in ('ticket_reply', 'ticket_status')"))).toBeGreaterThanOrEqual(3);
  });
  it('moderator, analyst, người thường không vào được; cần hai bước', async () => {
    for (const who of [MOD, ANALYST]) { await h.as(who, { aal: 'aal2' }); await expect(h.q("select admin_list_tickets('open', 10)")).rejects.toThrow('forbidden'); }
    await h.as(SUP); await expect(h.q("select admin_list_tickets('open', 10)")).rejects.toThrow('mfa_required');
    await h.as(A); await expect(h.q("select admin_list_tickets('open', 10)")).rejects.toThrow('not_admin');
  });
});
