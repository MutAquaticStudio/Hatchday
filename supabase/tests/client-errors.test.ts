/** Nhật ký lỗi phía người chơi: ghi, gộp trùng, giới hạn, quyền xem — trên Postgres thật (PGlite). */
import { beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './harness';

const U = (n: number) => `74000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const A = U(1), B = U(2), OPS = U(3), ANALYST = U(4);
let h: Harness;
const log = (kind: string, msg: string, stack = 'at x (a.js:1)', place = 'park', build = 'abc') => h.q('select log_client_error($1,$2,$3,$4,$5)', [kind, msg, stack, place, build]);
const count = async () => Number(await h.one('select coalesce(sum(n), 0) from client_errors'));

beforeAll(async () => {
  h = await createHarness(); await h.addUsers(A, B, OPS, ANALYST);
  await h.db.exec(`insert into admin_roles (user_id, role) values ('${OPS}', 'ops'), ('${ANALYST}', 'analyst')`);
}, 90_000);

describe('log_client_error', () => {
  it('khách bị bỏ qua êm; loại lạ bị bỏ; ghi một bản và rút gọn dữ liệu dài', async () => {
    await h.as(null); await log('js', 'x'); expect(await count()).toBe(0);
    await h.as(A); await log('lạ', 'x'); expect(await count()).toBe(0);
    await log('js', 'm'.repeat(1000), 's'.repeat(2000), 'p'.repeat(200), 'b'.repeat(200));
    const r = (await h.q<any>('select * from client_errors'))[0];
    expect(r.message.length).toBe(300); expect(r.stack.length).toBe(600); expect(r.place.length).toBe(40); expect(r.build.length).toBe(40); expect(r.user_id).toBe(A);
  });
  it('lỗi trùng trong 10 phút chỉ tăng số lần; sau 10 phút thì ghi bản mới', async () => {
    await h.db.exec('delete from client_errors'); await h.as(A);
    await log('js', 'lỗi A'); await log('js', 'lỗi A'); await log('js', 'lỗi A');
    expect(Number(await h.one('select count(*) from client_errors'))).toBe(1); expect(await count()).toBe(3);
    await h.db.exec("update client_errors set last_at = now() - interval '11 minutes'"); await log('js', 'lỗi A');
    expect(Number(await h.one('select count(*) from client_errors'))).toBe(2);
    await log('promise', 'lỗi A'); expect(Number(await h.one('select count(*) from client_errors'))).toBe(3); // khác loại
  });
  it('tối đa 20 bản mỗi giờ mỗi người', async () => {
    await h.db.exec('delete from client_errors'); await h.as(B);
    for (let i = 0; i < 30; i++) await log('js', 'lỗi khác nhau ' + i);
    expect(Number(await h.one("select count(*) from client_errors where user_id = $1", [B]))).toBe(20);
  });
});

describe('admin_client_errors', () => {
  it('chỉ vai trò có quyền "flag" xem được (ops), analyst và người thường bị từ chối', async () => {
    await h.as(OPS, { aal: 'aal2' }); const r = (await h.q<{ r: any }>('select admin_client_errors(7) as r'))[0].r;
    expect(r.total).toBe(20); expect(r.users).toBe(1); expect(r.top.length).toBe(20); expect(r.daily.length).toBe(1);
    await h.as(ANALYST, { aal: 'aal2' }); await expect(h.q('select admin_client_errors(7)')).rejects.toThrow('forbidden');
    await h.as(A); await expect(h.q('select admin_client_errors(7)')).rejects.toThrow();
  });
  it('xếp theo số lần, gộp người, giới hạn ngày', async () => {
    await h.db.exec('delete from client_errors'); await h.as(A); await log('js', 'hay gặp'); await log('js', 'hay gặp'); await log('js', 'hay gặp'); await log('render', 'hiếm');
    await h.as(B); await log('js', 'hay gặp');
    await h.db.exec("update client_errors set at = now() - interval '10 days', last_at = now() - interval '10 days' where message = 'hiếm'");
    await h.as(OPS, { aal: 'aal2' }); const r = (await h.q<{ r: any }>('select admin_client_errors(7) as r'))[0].r;
    expect(r.top.map((t: any) => [t.message, t.count, t.users])).toEqual([['hay gặp', 4, 2]]);
    const r30 = (await h.q<{ r: any }>('select admin_client_errors(30) as r'))[0].r; expect(r30.top.length).toBe(2);
  });
  it('người chơi không đọc/ghi bảng trực tiếp; sweep_stats dọn log cũ', async () => {
    await h.withRole(A, async () => { expect(await h.q('select * from client_errors')).toEqual([]); await expect(h.q("insert into client_errors (fp, kind, message) values ('x','js','x')")).rejects.toThrow(); });
    await h.db.exec("insert into client_errors (fp, kind, message, at) values ('old', 'js', 'cũ', now() - interval '40 days')");
    await h.q('select private.sweep_stats()');
    expect(Number(await h.one("select count(*) from client_errors where fp = 'old'"))).toBe(0);
  });
});
