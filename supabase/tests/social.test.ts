/** Hồ sơ công khai, bạn bè, chặn trên Postgres thật (PGlite, vai trò thật). Khớp social.ts. */
import { beforeAll, describe, expect, it } from 'vitest';
import { friendCap, isCodeShape, SOCIAL } from '../../src/game/social';
import { createHarness, type Harness } from './harness';

const A = '20000000-0000-4000-8000-00000000000a';
const B = '20000000-0000-4000-8000-00000000000b';
const C = '20000000-0000-4000-8000-00000000000c';
const D = '20000000-0000-4000-8000-00000000000d'; // chưa có thú
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const as = (u: string) => h.as(u);
const code = async (u: string) => h.one('select friend_code from public_profiles where user_id = $1', [u]);
const pid = async (u: string) => h.one('select public_id from public_profiles where user_id = $1', [u]);
const setLevel = (u: string, lvl: number) => h.db.exec(`update pets set bond_xp = ${[0, 0, 25, 80, 170, 300, 480, 720, 1020, 1400, 1900][lvl]} where owner_id = '${u}'`);

beforeAll(async () => {
  h = await createHarness();
  await h.addUsers(A, B, C, D);
  for (const [u, n] of [[A, 'An'], [B, 'Bình'], [C, 'Chi']] as const) { await as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); }
}, 90_000);

describe('hồ sơ công khai', () => {
  it('trigger tạo hồ sơ cho thú mới, mã bạn bè 8 ký tự đúng bảng chữ, duy nhất', async () => {
    const codes = [await code(A), await code(B), await code(C)];
    for (const c of codes) expect(isCodeShape(c)).toBe(true);
    expect(new Set(codes).size).toBe(3);
  });
  it('đổi tên và lên cấp Gắn bó thì hồ sơ cập nhật; đánh giá chỉ số thường thì không', async () => {
    await h.db.exec(`update pets set name = 'An Mới' where owner_id = '${A}'`);
    expect(await h.one('select display_name from public_profiles where user_id = $1', [A])).toBe('An Mới');
    await setLevel(A, 3);
    expect(Number(await h.one('select bond_level from public_profiles where user_id = $1', [A]))).toBe(3);
    const t0 = await h.one('select updated_at::text from public_profiles where user_id = $1', [A]);
    await h.db.exec(`update pets set no = 10 where owner_id = '${A}'`);
    expect(await h.one('select updated_at::text from public_profiles where user_id = $1', [A])).toBe(t0);
  });
  it('hồ sơ không lộ mã bạn bè, email hay múi giờ qua find_by_code', async () => {
    await as(B);
    const r = await rpc('find_by_code', await code(A));
    expect(Object.keys(r).sort()).toEqual(['bond_level', 'family', 'form', 'friend', 'genes', 'name', 'outfit', 'pid', 'species', 'stage']);
  });
  it('quyền thật: không đọc bảng của người khác, không ghi thẳng', async () => {
    expect(Number(await h.withRole(B, () => h.one('select count(*) from public_profiles')))).toBe(1);
    await expect(h.withRole(B, () => h.q(`update public_profiles set display_name = 'x' where user_id = $1`, [B]))).rejects.toThrow(/permission denied/);
    await expect(h.withRole(B, () => h.q(`insert into friendships (a, b, status, requested_by) values ($1, $2, 'accepted', $1)`, [A < B ? A : B, A < B ? B : A]))).rejects.toThrow(/permission denied/);
  });
});

describe('hạn mức bạn bè khớp client', () => {
  it('theo từng cấp Gắn bó', async () => { for (let lv = 1; lv <= 10; lv++) expect(await h.one('select private.friend_cap($1)', [lv]), `cấp ${lv}`).toBe(friendCap(lv)); expect(friendCap(2)).toBe(30); expect(friendCap(10)).toBe(SOCIAL.friendCapMax); });
});

describe('kết bạn', () => {
  it('gửi lời mời, bên kia thấy, chấp nhận thì thành bạn', async () => {
    await as(A);
    expect((await rpc('send_friend_request', await code(B))).status).toBe('pending');
    await expect(rpc('send_friend_request', await code(B))).rejects.toThrow('already_requested');
    await as(B);
    expect((await rpc('list_requests')).incoming.map((x: any) => x.name)).toEqual(['An Mới']);
    expect((await rpc('get_social_state')).requests_in).toBe(1);
    expect((await rpc('respond_friend_request', await code(A), true)).status).toBe('accepted');
    expect((await rpc('list_friends')).map((x: any) => x.name)).toEqual(['An Mới']);
    await as(A);
    expect((await rpc('list_friends')).map((x: any) => x.name)).toEqual(['Bình']);
    await expect(rpc('send_friend_request', await code(B))).rejects.toThrow('already_friends');
  });
  it('lời mời hai chiều tự thành bạn; từ chối thì xoá', async () => {
    await as(A); await rpc('send_friend_request', await code(C));
    await as(C); expect((await rpc('send_friend_request', await code(A))).status).toBe('accepted');
    await rpc('remove_friend', await code(A));
    await as(A); await rpc('send_friend_request', await code(C));
    await as(C); expect((await rpc('respond_friend_request', await code(A), false)).status).toBe('declined');
    expect((await rpc('list_requests')).incoming).toEqual([]);
  });
  it('mã sai, chính mình, người chưa có thú, mã dạng pid đều xử lý đúng', async () => {
    await as(A);
    await expect(rpc('send_friend_request', 'KHONGCO1')).rejects.toThrow('not_found');
    await expect(rpc('send_friend_request', await code(A))).rejects.toThrow('self_request');
    await as(D);
    await expect(rpc('send_friend_request', await code(A))).rejects.toThrow('no_pet');
    await as(A);
    expect((await rpc('find_by_code', await pid(C))).name).toBe('Chi'); // tìm bằng public_id cũng được (dùng ở Quảng trường)
  });
  it('riêng tư: tắt nhận lời mời thì bị từ chối; giá trị lạ bị chặn', async () => {
    await as(C); await rpc('set_privacy', 'friends', 'none');
    await expect(rpc('set_privacy', 'friends', 'xyz')).rejects.toThrow('invalid_privacy');
    await as(A); await expect(rpc('send_friend_request', await code(C))).rejects.toThrow('not_accepting');
    await as(C); await rpc('set_privacy', 'friends', 'all');
  });
  it('đầy hạn mức thì không thêm được (cả hai phía)', async () => {
    await setLevel(B, 2);
    for (let i = 0; i < SOCIAL.friendCapBase; i++) { const u = `30000000-0000-4000-8000-${String(i).padStart(12, '0')}`; await h.addUsers(u); await h.db.exec(`insert into friendships (a, b, status, requested_by, accepted_at) values ('${B < u ? B : u}', '${B < u ? u : B}', 'accepted', '${u}', now())`); }
    await as(C); await expect(rpc('send_friend_request', await code(B))).rejects.toThrow('their_friend_cap');
    await h.db.exec(`delete from friendships where a = '${B}' or b = '${B}'`);
  });
  it('quá 20 lời mời đang chờ thì từ chối', async () => {
    await h.db.exec(`delete from friendships where a = '${A}' or b = '${A}'`);
    for (let i = 0; i < 20; i++) { const u = `40000000-0000-4000-8000-${String(i).padStart(12, '0')}`; await h.addUsers(u); await h.db.exec(`insert into friendships (a, b, status, requested_by) values ('${A < u ? A : u}', '${A < u ? u : A}', 'pending', '${A}')`); }
    await as(A); await expect(rpc('send_friend_request', await code(B))).rejects.toThrow('too_many_requests');
    await h.db.exec(`delete from friendships where a = '${A}' or b = '${A}'`);
  });
});

describe('chặn', () => {
  it('chặn xoá bạn bè, ẩn nhau khỏi tìm kiếm và không gửi lời mời được', async () => {
    await as(A); await rpc('send_friend_request', await code(B)); await as(B); await rpc('respond_friend_request', await code(A), true);
    await rpc('block_user', await code(A));
    expect(await rpc('list_friends')).toEqual([]);
    await expect(rpc('find_by_code', await code(A))).rejects.toThrow('not_found');
    await as(A);
    await expect(rpc('find_by_code', await code(B))).rejects.toThrow('not_found');
    await expect(rpc('send_friend_request', await code(B))).rejects.toThrow('blocked');
    await as(B); await rpc('unblock_user', await code(A));
    await as(A); expect((await rpc('find_by_code', await code(B))).name).toBe('Bình');
  });
  it('anon không gọi được RPC xã hội', async () => {
    await expect(h.withRole(null, () => h.q('select list_friends()'), { role: 'anon' })).rejects.toThrow(/permission denied/);
  });
});
