/** Cân bằng và dashboard admin: mặc định khớp hằng số cũ, đổi núm có khoảng/lý do/kiểm toán, dashboard trả đúng số liệu và cảnh báo. */
import { beforeAll, describe, expect, it } from 'vitest';
import { AD } from '../../src/game/ads';
import { createHarness, type Harness } from './harness';

const U = (n: number) => `71000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const OWNER = U(1), OPS = U(2), MOD = U(4), ANA = U(5), P1 = U(10), P2 = U(11);
let h: Harness;
const as2 = (u: string, aal = 'aal2') => h.as(u, { aal });
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;

beforeAll(async () => {
  h = await createHarness();
  await h.addUsers(OWNER, OPS, MOD, ANA, P1, P2);
  for (const [u, n] of [[P1, 'Một'], [P2, 'Hai']] as const) { await h.as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); }
  for (const [u, r] of [[OWNER, 'owner'], [OPS, 'ops'], [MOD, 'moderator'], [ANA, 'analyst']]) await h.db.exec(`insert into admin_roles (user_id, role) values ('${u}', '${r}')`);
}, 90_000);

describe('Cân bằng', () => {
  it('mặc định khớp hằng số cũ (ads.ts, trần xu chăm sóc 50, trần bán rau 80)', async () => {
    expect(await h.one('select private.ad_reward()')).toBe(AD.reward); expect(await h.one('select private.ad_per_day()')).toBe(AD.perDay);
    expect(await h.one('select private.ad_gap_minutes()')).toBe(AD.gapMinutes); expect(await h.one('select private.ad_min_watch_seconds()')).toBe(AD.minWatchSeconds);
    await h.as(P1); expect((await rpc('get_public_config')).care_cap).toBe(50); expect((await rpc('get_sell_state')).cap).toBe(80);
    expect(Number(await h.one('select count(*) from balance_config where value <> def'))).toBe(0);
  });
  it('xem/đổi: cần vai ops/owner và aal2; khoảng min–max; lý do; kiểm toán; moderator/analyst bị từ chối', async () => {
    await as2(OPS);
    expect((await rpc('admin_list_balance')).find((b: any) => b.key === 'ads.reward')).toMatchObject({ value: 20, def: 20, min: 5, max: 100 });
    await expect(rpc('admin_set_balance', 'ads.reward', 25, '')).rejects.toThrow('reason_required');
    await expect(rpc('admin_set_balance', 'ads.reward', 500, 'quá lớn')).rejects.toThrow('balance_out_of_range');
    await expect(rpc('admin_set_balance', 'khong.co', 1, 'núm lạ')).rejects.toThrow('unknown_balance');
    await rpc('admin_set_balance', 'ads.reward', 25, 'tăng nhẹ để thử'); // +25% so với mặc định, ops được
    expect(await h.one('select private.ad_reward()')).toBe(25);
    await expect(rpc('admin_set_balance', 'ads.reward', 40, 'tăng mạnh')).rejects.toThrow('balance_needs_owner'); // +100%
    expect(Number(await h.one("select count(*) from admin_audit where action = 'set_balance'"))).toBe(1);
    for (const u of [MOD, ANA]) { await as2(u); await expect(rpc('admin_list_balance')).rejects.toThrow('forbidden'); await expect(rpc('admin_set_balance', 'ads.reward', 21, 'thử')).rejects.toThrow('forbidden'); }
    await as2(OPS, 'aal1'); await expect(rpc('admin_set_balance', 'ads.reward', 21, 'chưa hai bước')).rejects.toThrow();
    await as2(OWNER); await rpc('admin_set_balance', 'ads.reward', 40, 'owner được lệch lớn'); expect(await h.one('select private.ad_reward()')).toBe(40);
    await rpc('admin_set_balance', 'ads.reward', 20, 'trả về mặc định');
  });
  it('trần xu chăm sóc và trần bán rau theo núm', async () => {
    await as2(OWNER);
    await rpc('admin_set_balance', 'care.daily_cap', 12, 'thử trần thấp');
    expect(await h.one('select private.earn($1, 30, true)', [P1])).toBe(12); expect(await h.one('select private.earn($1, 30, true)', [P1])).toBe(0);
    await h.as(P1); expect((await rpc('get_public_config')).care_cap).toBe(12);
    await as2(OWNER); await rpc('admin_set_balance', 'care.daily_cap', 50, 'trả về');
    await rpc('admin_set_balance', 'sell.daily_cap', 41, 'thử'); await h.as(P1); expect((await rpc('get_sell_state')).cap).toBe(41);
    await as2(OWNER); await rpc('admin_set_balance', 'sell.daily_cap', 80, 'trả về');
  });
  it('quảng cáo theo núm: thưởng và số lượt', async () => {
    await as2(OWNER); await rpc('admin_set_balance', 'ads.per_day', 1, 'thử'); await rpc('admin_set_balance', 'ads.reward', 30, 'thử');
    await h.as(P1); expect(await rpc('get_ad_state')).toMatchObject({ reward: 30, per_day: 1 });
    await as2(OWNER); await rpc('admin_set_balance', 'ads.per_day', 5, 'trả về'); await rpc('admin_set_balance', 'ads.reward', 20, 'trả về');
  });
});

describe('công tắc', () => {
  it('thêm push.enabled và chat.dm.enabled; kiểu boolean; lần đổi cuối hiện ở admin_flag_meta', async () => {
    await as2(OPS);
    await rpc('admin_set_flag', 'push.enabled', 'true', 'bật thử push'); await rpc('admin_set_flag', 'chat.dm.enabled', 'false', 'tạm tắt DM');
    await expect(rpc('admin_set_flag', 'push.enabled', '"yes"', 'sai kiểu')).rejects.toThrow('invalid_flag');
    await expect(rpc('admin_set_flag', 'khong.co', 'true', 'cờ lạ')).rejects.toThrow('unknown_flag');
    const meta = await rpc('admin_flag_meta'); expect(meta['push.enabled']).toMatchObject({ reason: 'bật thử push' });
    await rpc('admin_set_flag', 'chat.dm.enabled', 'true', 'bật lại DM'); await rpc('admin_set_flag', 'push.enabled', 'false', 'tắt lại');
  });
});

describe('dashboard', () => {
  it('trả đủ khối, số liệu đúng và analyst xem được; người chơi thường không', async () => {
    await h.db.exec(`insert into client_sessions (user_id, platform, started_at, last_seen_at) values ('${P1}', 'mobile', now() - interval '10 minutes', now() - interval '1 minute'), ('${P2}', 'desktop', now() - interval '20 minutes', now() - interval '10 minutes');
      insert into ad_rewards (user_id, day, count) values ('${P1}', private.vn_today(), 5);
      update pets set illness = 'dau-bung' where owner_id = '${P2}' and stage <> 'departed';
      select private.rollup_stats(private.vn_today());`);
    await as2(ANA);
    const d = await rpc('admin_dashboard_overview', 30);
    expect(d.days).toBe(30); expect(d.series.dau).toHaveLength(30); expect(d.series.dau[29]).toBe(2);
    expect(d.live).toMatchObject({ online_now: 1, pets_alive: 2, ill_now: 1, users_total: 6, ads_capped_today: 1 });
    expect(d.series.dau_platform).toMatchObject({ mobile: expect.any(Array), desktop: expect.any(Array) });
    expect(d.series.ads_views[29]).toBe(5); expect(d.series.illness_started['dau-bung'][29]).toBe(1);
    expect(d.funnel.map((f: any) => f.key)).toEqual(['signup', 'pet', 'action', 'tour', 'quest', 'bond2', 'place', 'friend', 'return']);
    expect(d.funnel[0].n).toBe(6); expect(d.funnel[1].n).toBe(2);
    expect(d.retention.total.d1).toEqual({ n: 0, of: 0 }); // tất cả mới đăng ký hôm nay, chưa đủ ngày để tính
    expect(d.progression.bond['1'].n).toBe(2); expect(d.wallet.n).toBe(2);
    expect(d.heat.length).toBeGreaterThan(0); expect(d.ads_per_day).toBe(5);
    for (const k of ['sessions', 'coins_earned', 'push_sent', 'place_visits']) expect(d.series, k).toHaveProperty(k);
    expect((await rpc('admin_dashboard_overview', 3)).days).toBe(7); expect((await rpc('admin_dashboard_overview', 500)).days).toBe(90); // kẹp khoảng 7–90
    await h.as(P1); await expect(rpc('admin_dashboard_overview', 30)).rejects.toThrow();
    await as2(ANA, 'aal1'); await expect(rpc('admin_dashboard_overview', 30)).rejects.toThrow();
  });
  it('giữ chân và churn tính đúng trên dữ liệu dựng sẵn', async () => {
    // P1 đăng ký 10 ngày trước, hoạt động ngày +1 và +7; P2 đăng ký 10 ngày trước, chỉ hoạt động ngày 0
    await h.db.exec(`update profiles set created_at = now() - interval '10 days' where id in ('${P1}', '${P2}');
      delete from user_active_days where user_id in ('${P1}', '${P2}');
      insert into user_active_days (user_id, day) select '${P1}', (created_at at time zone 'Asia/Ho_Chi_Minh')::date + n from profiles, unnest(array[0, 1, 7]) n where id = '${P1}';
      insert into user_active_days (user_id, day) select '${P2}', (created_at at time zone 'Asia/Ho_Chi_Minh')::date from profiles where id = '${P2}'`);
    await as2(ANA);
    const d = await rpc('admin_dashboard_overview', 30);
    expect(d.retention.total.d1).toEqual({ n: 1, of: 2 }); expect(d.retention.total.d7).toEqual({ n: 1, of: 2 });
    expect(d.retention.total.d14).toEqual({ n: 0, of: 0 }); // chưa đủ 14 ngày
    expect(d.churn.d7).toEqual({ n: 1, of: 2 }); // P2 không hoạt động 7 ngày qua; P1 vẫn còn (ngày +7 = 3 ngày trước)
    expect(d.retention.weeks.length).toBeGreaterThan(0);
  });
  it('cảnh báo: DAU giảm, ads/người, lạm phát xu, báo cáo', async () => {
    const y = "private.vn_today() - 1";
    await h.db.exec(`delete from stats_daily;
      insert into stats_daily (day, metric, dim, value) select ${y} - n, 'dau', '', 10 from generate_series(1, 7) n;
      insert into stats_daily values (${y}, 'dau', '', 5), (${y}, 'ads_views', '', 20), (${y}, 'ads_users', '', 3), (${y}, 'reports_new', '', 11),
        (${y}, 'coins_earned', 'pet_action', 900), (${y}, 'coins_spent', 'buy_food', 300)`);
    await as2(OWNER);
    const keys = (await rpc('admin_dashboard_overview', 30)).alerts.map((a: any) => a.key).sort();
    expect(keys).toEqual(['ads_per_user', 'coin_ratio', 'dau_drop', 'reports']);
    await rpc('admin_set_balance', 'alert.dau_drop_pct', 80, 'nới ngưỡng thử'); // 5 so với 10 là giảm 50%, dưới 80%
    expect((await rpc('admin_dashboard_overview', 30)).alerts.map((a: any) => a.key)).not.toContain('dau_drop');
    await h.db.exec('delete from stats_daily');
    expect((await rpc('admin_dashboard_overview', 30)).alerts).toEqual([]); // không đủ dữ liệu thì không báo bậy
  });
});
