/** Quảng cáo thưởng trên Postgres thật: mã dùng một lần, thời gian xem, trần ngày, giãn cách, công tắc. */
import { beforeAll, describe, expect, it } from 'vitest';
import { AD } from '../../src/game/ads';
import { createHarness, type Harness } from './harness';

const A = 'a1000000-0000-4000-8000-00000000000a', B = 'a1000000-0000-4000-8000-00000000000b';
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const coins = (u: string) => h.one('select coins from wallets where owner_id = $1', [u]);
const flag = (on: boolean) => h.db.exec(`update system_flags set value = '${on}' where key = 'ads.enabled'`);
const reset = () => h.db.exec('delete from ad_rewards; delete from ad_nonces; delete from events;');
const aged = (n: string, secs: number) => h.db.exec(`update ad_nonces set issued_at = now() - interval '${secs} seconds' where nonce = '${n}'`);

beforeAll(async () => {
  h = await createHarness(); await h.addUsers(A, B);
  for (const [u, n] of [[A, 'An'], [B, 'Bình']] as const) { await h.as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); }
}, 90_000);

describe('luật khớp ads.ts', () => {
  it('thưởng, số lượt, giãn cách, thời gian xem, hạn mã', async () => {
    expect(await h.one('select private.ad_reward()')).toBe(AD.reward); expect(await h.one('select private.ad_per_day()')).toBe(AD.perDay);
    expect(await h.one('select private.ad_gap_minutes()')).toBe(AD.gapMinutes); expect(await h.one('select private.ad_min_watch_seconds()')).toBe(AD.minWatchSeconds);
    expect(await h.one('select private.ad_nonce_minutes()')).toBe(AD.nonceMinutes);
  });
});

describe('công tắc', () => {
  it('mặc định tắt: không cấp mã, không nhận thưởng', async () => {
    await reset(); await h.as(A);
    await expect(rpc('start_ad_reward')).rejects.toThrow('ads_disabled'); await expect(rpc('claim_ad_reward', crypto.randomUUID())).rejects.toThrow('ads_disabled');
    expect((await rpc('get_ad_state')).enabled).toBe(false);
    await h.as(null); await expect(rpc('start_ad_reward')).rejects.toThrow('not_authenticated');
  });
});

describe('start và claim', () => {
  it('luồng đúng: nhận 20 xu, còn 4 lượt', async () => {
    await reset(); await flag(true); await h.as(A);
    const t = await rpc('start_ad_reward'); expect(t).toMatchObject({ reward: AD.reward, left: 5, wait: AD.minWatchSeconds });
    await aged(t.nonce, 16); const c0 = await coins(A);
    const r = await rpc('claim_ad_reward', t.nonce); expect(r).toMatchObject({ reward: AD.reward, left: 4 }); expect(await coins(A)).toBe(c0 + AD.reward);
    expect((await rpc('get_ad_state')).left).toBe(4);
  });
  it('mã dùng một lần; mã của người khác không dùng được; mã lạ; chưa đủ thời gian; hết hạn', async () => {
    await reset(); await h.as(A);
    const t = await rpc('start_ad_reward');
    await expect(rpc('claim_ad_reward', t.nonce)).rejects.toThrow('ad_too_fast'); // vừa cấp, chưa xem đủ
    await aged(t.nonce, 20); await h.as(B); await expect(rpc('claim_ad_reward', t.nonce)).rejects.toThrow('ad_invalid'); // mã của A
    await h.as(A); await expect(rpc('claim_ad_reward', crypto.randomUUID())).rejects.toThrow('ad_invalid');
    await rpc('claim_ad_reward', t.nonce); await expect(rpc('claim_ad_reward', t.nonce)).rejects.toThrow('ad_invalid'); // đã dùng
    await h.db.exec(`update ad_rewards set last_at = now() - interval '1 hour'`);
    const t2 = await rpc('start_ad_reward'); await aged(t2.nonce, 400); await expect(rpc('claim_ad_reward', t2.nonce)).rejects.toThrow('ad_expired');
  });
  it('xin mã mới thì mã cũ chưa dùng mất hiệu lực', async () => {
    await reset(); await h.as(A);
    const a = await rpc('start_ad_reward'), b = await rpc('start_ad_reward'); await aged(a.nonce, 20).catch(() => {}); await aged(b.nonce, 20);
    await expect(rpc('claim_ad_reward', a.nonce)).rejects.toThrow('ad_invalid'); await rpc('claim_ad_reward', b.nonce);
  });
  it('giãn cách 10 phút giữa hai lượt', async () => {
    await reset(); await h.as(A);
    const t = await rpc('start_ad_reward'); await aged(t.nonce, 20); await rpc('claim_ad_reward', t.nonce);
    await expect(rpc('start_ad_reward')).rejects.toThrow('ad_too_soon');
    await h.db.exec(`update ad_rewards set last_at = now() - interval '11 minutes'`); expect((await rpc('start_ad_reward')).left).toBe(4);
  });
  it('tối đa 5 lượt mỗi ngày, ngày sau dùng lại được', async () => {
    await reset(); await h.as(A); const c0 = await coins(A);
    for (let i = 0; i < 5; i++) { await h.db.exec(`update ad_rewards set last_at = now() - interval '11 minutes'`); const t = await rpc('start_ad_reward'); await aged(t.nonce, 20); await rpc('claim_ad_reward', t.nonce); }
    expect(await coins(A)).toBe(c0 + 5 * AD.reward);
    await h.db.exec(`update ad_rewards set last_at = now() - interval '11 minutes'`);
    await expect(rpc('start_ad_reward')).rejects.toThrow('ad_limit');
    expect((await rpc('get_ad_state')).left).toBe(0);
    await h.db.exec(`update ad_rewards set day = day - 1`); expect((await rpc('start_ad_reward')).left).toBe(5);
  });
  it('xu quảng cáo không bị nhân bởi sự kiện nhân xu nhiệm vụ', async () => {
    await reset(); await h.db.exec(`insert into events (title, kind, starts_at, ends_at, config) values ('x', 'limited', now() - interval '1 hour', now() + interval '1 day', '{"coin_boost":3}')`);
    await h.as(A); const c0 = await coins(A); const t = await rpc('start_ad_reward'); await aged(t.nonce, 20); await rpc('claim_ad_reward', t.nonce);
    expect(await coins(A)).toBe(c0 + AD.reward);
  });
  it('bảng nhật ký không đọc được trực tiếp', async () => {
    expect(await h.withRole(A, async () => (await h.q('select * from ad_nonces')).length)).toBe(0);
    expect(await h.withRole(A, async () => (await h.q('select * from ad_rewards')).length)).toBe(0);
  });
});
