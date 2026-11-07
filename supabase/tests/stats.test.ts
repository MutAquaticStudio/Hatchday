/** Nền dữ liệu dashboard: sổ cái xu, phiên chơi, nguồn người dùng, mốc, lịch sử bệnh, lượt vào nơi chung, tổng hợp theo ngày. */
import { beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './harness';

const A = 'b1000000-0000-4000-8000-00000000000a', B = 'b1000000-0000-4000-8000-00000000000b';
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const metric = async (m: string, dim = '') => { const r = await h.q<{ value: string }>('select value from stats_daily where day = private.vn_today() and metric = $1 and dim = $2', [m, dim]); return r.length ? Number(r[0].value) : null; };

beforeAll(async () => {
  h = await createHarness(); await h.addUsers(A, B);
  for (const [u, n] of [[A, 'An'], [B, 'Bình']] as const) { await h.as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); }
}, 90_000);

describe('sổ cái xu', () => {
  it('mọi đường đổi xu đều có dòng; tổng delta bằng số dư; nguồn lấy theo tên RPC', async () => {
    await h.as(A);
    await rpc('claim_ration').catch(() => {});
    await rpc('buy_food', 'carot', 2).catch(() => rpc('buy_food', 'com-nam', 2).catch(() => {}));
    await h.db.exec(`update wallets set coins = coins + 40 where owner_id = '${A}'`); // đường đổi xu bất kỳ vẫn được ghi
    const sum = Number(await h.one('select sum(delta) from coin_ledger where owner_id = $1', [A])), coins = Number(await h.one('select coins from wallets where owner_id = $1', [A]));
    expect(sum).toBe(coins);
    expect(Number(await h.one("select count(*) from coin_ledger where owner_id = $1 and ctx = 'start'", [A]))).toBe(1);
    expect(Number(await h.one("select count(*) from coin_ledger where owner_id = $1 and delta = 40", [A]))).toBe(1);
  });
  it('hatchday.ctx đặt rõ thì được ưu tiên', async () => {
    await h.db.exec(`select set_config('hatchday.ctx', 'thu-nghiem', false); update wallets set coins = coins + 1 where owner_id = '${B}'; select set_config('hatchday.ctx', '', false)`);
    expect(await h.one("select ctx from coin_ledger where owner_id = $1 order by id desc limit 1", [B])).toBe('thu-nghiem');
  });
});

describe('phiên chơi, nguồn, mốc', () => {
  it('ping_session: mở phiên mới, giữ phiên trong 5 phút, mở phiên mới sau khi nghỉ', async () => {
    await h.as(A);
    const a = await rpc('ping_session', 'mobile', true); expect(a.new).toBe(true);
    const b = await rpc('ping_session', 'mobile', true); expect(b).toEqual({ session: a.session, new: false });
    await h.db.exec(`update client_sessions set last_seen_at = now() - interval '6 minutes' where id = ${a.session}`);
    const c = await rpc('ping_session', 'khac'); expect(c.new).toBe(true); expect(c.session).not.toBe(a.session);
    expect(await h.one('select platform from client_sessions where id = $1', [c.session])).toBe('unknown');
    await h.as(null); await expect(rpc('ping_session')).rejects.toThrow('not_authenticated');
  });
  it('nguồn: chỉ nhận một lần, bỏ qua giá trị lạ; mốc chỉ nhận khoá cho phép', async () => {
    await h.as(B);
    await rpc('set_attribution', 'Facebook', 'Cpc'); await rpc('set_attribution', 'khac'); await rpc('set_attribution', 'có dấu!');
    expect(await h.q('select ref, medium from signup_attribution where user_id = $1', [B])).toEqual([{ ref: 'facebook', medium: 'cpc' }]);
    await h.as(A); await rpc('set_attribution', 'bad ref'); expect(Number(await h.one('select count(*) from signup_attribution where user_id = $1', [A]))).toBe(0);
    await rpc('mark_milestone', 'tour_done'); await rpc('mark_milestone', 'tour_done');
    expect(Number(await h.one("select count(*) from user_milestones where user_id = $1", [A]))).toBe(1);
    await expect(rpc('mark_milestone', 'lạ')).rejects.toThrow('invalid_milestone');
  });
  it('bảng thống kê không đọc trực tiếp được', async () => {
    for (const t of ['coin_ledger', 'client_sessions', 'signup_attribution', 'user_milestones', 'illness_log', 'place_visits', 'stats_daily', 'user_active_days'])
      expect(await h.withRole(A, async () => (await h.q(`select * from ${t}`)).length), t).toBe(0);
  });
});

describe('lịch sử bệnh và lượt vào nơi chung', () => {
  it('illness_log mở khi ốm, đóng khi khỏi', async () => {
    await h.db.exec(`update pets set illness = 'dau-bung', sick_since = now() where owner_id = '${A}' and stage <> 'departed'`);
    expect(await h.q('select illness, ended_at from illness_log where owner_id = $1', [A])).toEqual([{ illness: 'dau-bung', ended_at: null }]);
    await h.db.exec(`update pets set illness = null, sick_since = null where owner_id = '${A}' and stage <> 'departed'`);
    expect((await h.q<{ ended_at: unknown }>('select ended_at from illness_log where owner_id = $1', [A]))[0].ended_at).not.toBeNull();
  });
  it('vào nơi chung ghi place_visits', async () => {
    await h.db.exec(`insert into place_members (user_id, place, shard, topic) values ('${A}', 'plaza', 1, 'plaza:1'), ('${B}', 'tea', 1, 'tea:1')`);
    expect(Number(await h.one('select count(*) from place_visits'))).toBe(2);
  });
});

describe('tổng hợp theo ngày', () => {
  it('rollup_stats: DAU, phiên, xu theo nguồn, ads, bệnh, nơi chung, tính năng; chạy lại cho cùng kết quả', async () => {
    await h.db.exec(`insert into ad_rewards (user_id, day, count) values ('${A}', private.vn_today(), 3), ('${B}', private.vn_today(), 1);
      insert into action_log (pet_id, action) select id, 'feed' from pets where owner_id = '${B}' and stage <> 'departed';
      insert into chat_log (user_id, topic, body, norm) values ('${A}', 'plaza:1', 'xin chào', 'xin chao');
      insert into chat_strikes (user_id, reason) values ('${A}', 'link');
      select private.sample_places();`);
    await h.db.exec('select private.rollup_stats(private.vn_today())');
    expect(await metric('dau')).toBe(2); // A có phiên, B có hành động
    expect(await metric('dau_platform', 'unknown')).toBe(1);
    expect(await metric('sessions')).toBe(2);
    expect(await metric('ads_views')).toBe(4); expect(await metric('ads_users')).toBe(2);
    expect(await metric('new_ref', 'facebook')).toBe(1); expect(await metric('new_ref', 'direct')).toBe(1);
    expect(await metric('tour_done')).toBe(1);
    expect(await metric('illness_started', 'dau-bung')).toBe(1); expect(await metric('illness_ended')).toBe(1);
    expect(await metric('place_visits', 'plaza')).toBe(1); expect(await metric('place_users')).toBe(2); expect(await metric('place_peak', 'tea')).toBe(1);
    expect(await metric('feat_users', 'feed')).toBe(1); expect(await metric('feat_users', 'places')).toBe(2);
    expect(await metric('chat_msgs')).toBe(1); expect(await metric('chat_blocked', 'link')).toBe(1);
    expect(await metric('coins_earned', 'start')).toBe(600);
    expect(await metric('snap_users')).toBe(2); expect(await metric('snap_wallet', 'n')).toBe(2);
    const before = JSON.stringify(await h.q('select day, metric, dim, value from stats_daily order by 1, 2, 3'));
    await h.db.exec('select private.rollup_stats(private.vn_today())');
    expect(JSON.stringify(await h.q('select day, metric, dim, value from stats_daily order by 1, 2, 3'))).toBe(before);
    expect(Number(await h.one('select count(*) from user_active_days where day = private.vn_today()'))).toBe(2);
  });
  it('chạy cho hôm qua không xoá số liệu chat đã chốt và không tạo ảnh chụp mới', async () => {
    await h.db.exec(`insert into stats_daily values (private.vn_today() - 1, 'chat_msgs', '', 7), (private.vn_today() - 1, 'snap_users', '', 99)`);
    await h.db.exec('select private.rollup_stats(private.vn_today() - 1)');
    expect(Number(await h.one("select value from stats_daily where day = private.vn_today() - 1 and metric = 'chat_msgs'"))).toBe(7);
    expect(Number(await h.one("select value from stats_daily where day = private.vn_today() - 1 and metric = 'snap_users'"))).toBe(99);
  });
  it('cron_tick: chỉ service_role; chạy xong có tổng hợp hôm nay và dọn dẹp', async () => {
    await expect(h.withRole(A, () => rpc('cron_tick'))).rejects.toThrow();
    await h.db.exec(`update client_sessions set last_seen_at = now() - interval '130 days', started_at = now() - interval '130 days'`);
    const r = await h.withRole(null, () => rpc('cron_tick'), { role: 'service_role' }); expect(r.ok).toBe(true);
    expect(Number(await h.one('select count(*) from client_sessions where last_seen_at < now() - interval \'120 days\''))).toBe(0);
    expect(await metric('dau')).not.toBeNull();
  });
});
