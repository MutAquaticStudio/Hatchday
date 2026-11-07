/** Thông báo đẩy: đăng ký thiết bị, tuỳ chọn, luật chọn người nhận (push_pick), báo kết quả (push_mark), tổng hợp. */
import { beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './harness';

const U = (n: number) => `73000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const A = U(1), B = U(2), C = U(3), OWNER = U(9);
const K = 'B'.repeat(87), AUTH = 'a'.repeat(22);
const ep = (n: string) => `https://push.example.com/send/${n}`;
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const pick = () => h.withRole(null, () => rpc('push_pick', 50), { role: 'service_role' });
const flag = (on: boolean) => h.db.exec(`update system_flags set value = '${on}' where key = 'push.enabled'`);
const idle = (u: string) => h.db.exec(`delete from client_sessions where user_id = '${u}'; delete from action_log where pet_id in (select id from pets where owner_id = '${u}')`);
const pet = (u: string, set: string) => h.db.exec(`update pets set ${set} where owner_id = '${u}' and stage <> 'departed'`);

beforeAll(async () => {
  h = await createHarness(); await h.addUsers(A, B, C, OWNER);
  for (const [u, n] of [[A, 'An'], [B, 'Bình'], [C, 'Cúc']] as const) { await h.as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); }
  await h.db.exec(`insert into admin_roles (user_id, role) values ('${OWNER}', 'owner')`);
}, 90_000);

describe('đăng ký thiết bị và tuỳ chọn', () => {
  it('lưu, cập nhật cùng endpoint, tối đa 5 thiết bị, xoá, kiểm tra đầu vào', async () => {
    await h.as(A);
    await rpc('save_push_subscription', ep('a1'), K, AUTH, 'Chrome'); await rpc('save_push_subscription', ep('a1'), K, AUTH, 'Chrome 2');
    expect(await h.q('select ua from push_subscriptions where user_id = $1', [A])).toEqual([{ ua: 'Chrome 2' }]);
    for (let i = 2; i <= 7; i++) await rpc('save_push_subscription', ep('a' + i), K, AUTH, null);
    expect(Number(await h.one('select count(*) from push_subscriptions where user_id = $1', [A]))).toBe(5);
    await rpc('remove_push_subscription', ep('a7')); expect(Number(await h.one('select count(*) from push_subscriptions where user_id = $1', [A]))).toBe(4);
    await expect(rpc('save_push_subscription', 'http://khong-https', K, AUTH)).rejects.toThrow('invalid_subscription');
    await expect(rpc('save_push_subscription', ep('x'), 'ngan', AUTH)).rejects.toThrow('invalid_subscription');
    await h.as(B); await rpc('save_push_subscription', ep('a2'), K, AUTH, 'Máy B'); // chiếm endpoint của người khác thì chuyển chủ (cùng thiết bị đổi tài khoản)
    expect(await h.one('select user_id from push_subscriptions where endpoint = $1', [ep('a2')])).toBe(B);
    await h.as(null); await expect(rpc('save_push_subscription', ep('z'), K, AUTH)).rejects.toThrow('not_authenticated');
  });
  it('tuỳ chọn mặc định và đổi; giờ yên lặng hợp lệ; trạng thái', async () => {
    await h.as(C); expect(await rpc('get_push_state')).toMatchObject({ devices: 0, prefs: { care: true, events: true, mail: true, quiet_from: 22, quiet_to: 7 } });
    await rpc('set_push_prefs', false, true, false, 23, 6); expect((await rpc('get_push_state')).prefs).toEqual({ care: false, events: true, mail: false, quiet_from: 23, quiet_to: 6 });
    await expect(rpc('set_push_prefs', true, true, true, 24, 7)).rejects.toThrow(); await rpc('set_push_prefs', true, true, true, 22, 7);
  });
  it('bảng không đọc trực tiếp được; push_pick/push_mark không gọi được bởi người chơi', async () => {
    for (const t of ['push_subscriptions', 'push_prefs', 'push_log']) expect(await h.withRole(A, async () => (await h.q(`select * from ${t}`)).length), t).toBe(0);
    await expect(h.withRole(A, () => rpc('push_pick', 10))).rejects.toThrow(); await expect(h.withRole(A, () => rpc('push_mark', 1, 1, true, 200))).rejects.toThrow();
  });
});

describe('push_pick', () => {
  it('công tắc khẩn tắt thì không chọn ai', async () => {
    await flag(false); await idle(A); await pet(A, 'no = 10, asleep = false'); expect(await pick()).toEqual([]);
  });
  it('care: bé đói + người chơi vắng ≥ 40 phút → một thông báo cho mọi thiết bị; không lặp trong 4 giờ', async () => {
    await flag(true); await h.db.exec(`delete from push_log; delete from push_subscriptions; set timezone = 'UTC'`);
    await h.db.exec(`update profiles set timezone = 'Etc/GMT-0'; update system_flags set updated_at = now()`);
    await h.as(A); await rpc('save_push_subscription', ep('d1'), K, AUTH, 'điện thoại'); await rpc('save_push_subscription', ep('d2'), K, AUTH, 'máy tính');
    await idle(A); await pet(A, "no = 10, vui = 90, sach = 90, nl = 90, asleep = false, illness = null, stats_at = now()");
    // đưa giờ về ngoài giờ yên lặng bằng cách đặt khung yên lặng không chứa giờ hiện tại
    const hr = Number(await h.one("select extract(hour from now() at time zone 'UTC')::int"));
    await h.db.exec(`insert into push_prefs (user_id, quiet_from, quiet_to) values ('${A}', ${(hr + 2) % 24}, ${(hr + 3) % 24}) on conflict (user_id) do update set quiet_from = excluded.quiet_from, quiet_to = excluded.quiet_to`);
    const r = await pick(); expect(r).toHaveLength(2); expect(new Set(r.map((x: any) => x.endpoint))).toEqual(new Set([ep('d1'), ep('d2')]));
    expect(r[0]).toMatchObject({ kind: 'care', user_id: A, payload: { title: 'Hatchday', tag: 'care' } }); expect(r[0].payload.body).toContain('đói rồi');
    expect(r[0].payload.url).toContain('from=push');
    expect(await pick()).toEqual([]); // đã gửi, 4 giờ nữa mới lại
  });
  it('không gửi khi: người chơi vừa hoạt động, bé đang ngủ, trong giờ yên lặng, hết hạn mức 3/ngày, tắt loại, thiết bị lỗi nhiều', async () => {
    const reset = async () => { await h.db.exec('delete from push_log'); await idle(A); await pet(A, "no = 10, asleep = false"); };
    await reset(); await h.db.exec(`insert into client_sessions (user_id, last_seen_at) values ('${A}', now() - interval '10 minutes')`); expect(await pick()).toEqual([]); // vừa vào chơi
    await reset(); await pet(A, 'asleep = true'); expect(await pick()).toEqual([]);
    await reset(); const hr = Number(await h.one("select extract(hour from now() at time zone 'UTC')::int"));
    await h.db.exec(`update push_prefs set quiet_from = ${hr}, quiet_to = ${(hr + 1) % 24} where user_id = '${A}'`); expect(await pick()).toEqual([]); // đang giờ yên lặng
    await h.db.exec(`update push_prefs set quiet_from = ${(hr + 2) % 24}, quiet_to = ${(hr + 3) % 24} where user_id = '${A}'`);
    await reset(); await h.db.exec(`insert into push_log (user_id, kind, sent_at, status) select '${A}', 'event', now() - interval '1 hour', 'ok' from generate_series(1, 3)`); expect(await pick()).toEqual([]); // đủ 3/24 giờ
    await reset(); await h.db.exec(`update push_prefs set care = false where user_id = '${A}'`); expect(await pick()).toEqual([]); await h.db.exec(`update push_prefs set care = true where user_id = '${A}'`);
    await reset(); await h.db.exec(`update push_subscriptions set fail_count = 8 where user_id = '${A}'`); expect(await pick()).toEqual([]); await h.db.exec(`update push_subscriptions set fail_count = 0 where user_id = '${A}'`);
    await reset(); await pet(A, 'no = 90, vui = 90, sach = 90, nl = 90, stats_at = now()'); expect(await pick()).toEqual([]); // bé ổn, không cần chăm
  });
  it('nội dung theo nhu cầu: ốm > đói > buồn > bẩn; mail; sự kiện (mỗi sự kiện một lần)', async () => {
    const one = async () => { await h.db.exec('delete from push_log'); await idle(A); const r = await pick(); return r.length ? r[0] : null; };
    await pet(A, "no = 10, illness = 'dau-bung', sick_since = now(), recover_at = now() + interval '3 hours', stats_at = now()"); expect((await one()).payload.body).toContain('không khoẻ');
    await pet(A, "illness = null, sick_since = null, recover_at = null, no = 90, vui = 10, sach = 90, stats_at = now()"); expect((await one()).payload.body).toContain('hơi buồn');
    await pet(A, "vui = 90, sach = 5, stats_at = now()"); expect((await one()).payload.body).toContain('bẩn rồi');
    await pet(A, "sach = 90, stats_at = now()"); expect(await one()).toBeNull();
    await h.db.exec(`insert into mailbox (to_user, kind, title, coins) values ('${A}', 'reward', 'Quà', 10), ('${A}', 'system', 'Chào', 0)`);
    let m = await one(); expect(m).toMatchObject({ kind: 'mail', payload: { title: 'Bạn có thư mới' } }); expect(m.payload.body).toContain('2 thư');
    await h.db.exec(`delete from push_log; insert into push_log (user_id, kind, sent_at, status) values ('${A}', 'mail', now() - interval '2 hours', 'ok')`); expect(await pick()).toEqual([]); // thư: 1 lần/24 giờ
    await h.db.exec(`delete from push_log; delete from mailbox; delete from events; insert into events (title, kind, starts_at, ends_at, config) values ('Hội chợ', 'limited', now() - interval '1 hour', now() + interval '1 day', '{"banner":"Hội chợ mùa thu bắt đầu!"}')`);
    m = await one(); expect(m).toMatchObject({ kind: 'event', payload: { title: 'Sự kiện mới', body: 'Hội chợ mùa thu bắt đầu!' } });
    await h.db.exec(`insert into push_log (user_id, kind, ref, sent_at, status) select '${A}', 'event', id::text, now() - interval '5 hours', 'ok' from events`); expect(await pick()).toEqual([]); // đã báo sự kiện này
    await h.db.exec('delete from events; delete from push_log');
  });
});

describe('push_mark và tổng hợp', () => {
  it('thành công cập nhật; 404/410 xoá đăng ký; lỗi khác tăng đếm', async () => {
    await h.db.exec(`delete from push_log; insert into push_log (id, user_id, kind) overriding system value values (900, '${A}', 'care')`);
    await h.db.exec(`delete from push_subscriptions where user_id = '${A}'; insert into push_subscriptions (user_id, endpoint, p256dh, auth) select '${A}', 'https://push.example.com/m' || n, '${K}', '${AUTH}' from generate_series(1, 3) n`);
    const subs = await h.q<{ id: string }>('select id from push_subscriptions where user_id = $1 order by id', [A]);
    await h.withRole(null, async () => { await rpc('push_mark', subs[0].id, 900, true, 201); await rpc('push_mark', subs[1].id, 900, false, 500); await rpc('push_mark', subs[2].id, 900, false, 410); }, { role: 'service_role' });
    expect(await h.one('select status from push_log where id = 900')).toBe('ok'); // một thiết bị nhận được là tính đã gửi
    expect(await h.one('select fail_count from push_subscriptions where id = $1', [subs[1].id])).toBe(1);
    expect(Number(await h.one('select count(*) from push_subscriptions where id = $1', [subs[2].id]))).toBe(0);
    expect(await h.one('select last_ok_at is not null from push_subscriptions where id = $1', [subs[0].id])).toBe(true);
    await h.db.exec(`update push_log set status = 'queued' where id = 900`); await h.withRole(null, () => rpc('push_mark', subs[1].id, 900, false, 500), { role: 'service_role' });
    expect(await h.one('select status from push_log where id = 900')).toBe('fail');
  });
  it('cron_tick tổng hợp push_sent / push_fail / push_return và thiết bị; admin_push_stats', async () => {
    // giờ gửi nằm trong "hôm nay" giờ VN kể cả khi test chạy ngay sau nửa đêm (trước đây lỗi trong 30 phút đầu ngày)
    const sent = `greatest(now() - interval '30 minutes', (private.vn_today()::timestamp at time zone 'Asia/Ho_Chi_Minh') + interval '1 second')`;
    await h.db.exec(`delete from push_log; delete from client_sessions;
      insert into push_log (user_id, kind, sent_at, status) values ('${A}', 'care', ${sent}, 'ok'), ('${B}', 'mail', ${sent}, 'fail');
      insert into client_sessions (user_id, started_at, last_seen_at) values ('${A}', ${sent} + interval '20 seconds', ${sent} + interval '25 minutes')`);
    await h.withRole(null, () => rpc('cron_tick'), { role: 'service_role' });
    const m = async (k: string) => Number(await h.one("select value from stats_daily where day = private.vn_today() and metric = $1 and dim = ''", [k]));
    expect(await m('push_sent')).toBe(1); expect(await m('push_fail')).toBe(1); expect(await m('push_return')).toBe(1); expect(await m('snap_push_devices')).toBeGreaterThanOrEqual(1);
    await h.as(OWNER, { aal: 'aal2' }); expect(await rpc('admin_push_stats')).toMatchObject({ sent_24h: 1, fail_24h: 1 });
    await h.as(A); await expect(rpc('admin_push_stats')).rejects.toThrow();
  });
});
