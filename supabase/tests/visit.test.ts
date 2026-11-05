/** Thăm nhà bạn trên Postgres thật: ảnh chụp công khai, vuốt ve, tưới giúp, dấu vết. */
import { beforeAll, describe, expect, it } from 'vitest';
import { GUESTBOOK, SOCIAL } from '../../src/game/social';
import { createHarness, type Harness } from './harness';
import { noonTz } from './util';

const A = '60000000-0000-4000-8000-00000000000a';
const B = '60000000-0000-4000-8000-00000000000b';
const C = '60000000-0000-4000-8000-00000000000c';
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const as = (u: string) => h.as(u);
const code = (u: string) => h.one('select friend_code from public_profiles where user_id = $1', [u]);
const coins = (u: string) => h.one('select coins from wallets where owner_id = $1', [u]);

beforeAll(async () => {
  h = await createHarness();
  await h.addUsers(A, B, C);
  for (const [u, n] of [[A, 'An'], [B, 'Bình'], [C, 'Chi']] as const) { await as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); await h.db.exec(`update profiles set timezone = '${noonTz()}' where id = '${u}'`); }
  await h.db.exec(`insert into friendships (a, b, status, requested_by, accepted_at) values ('${A < B ? A : B}', '${A < B ? B : A}', 'accepted', '${A}', now() - interval '5 days')`);
  await h.db.exec(`insert into garden_plots (owner_id, plot, crop, planted_at) values ('${B}', 0, 'carot', now() - interval '1 hour'), ('${B}', 1, 'carot', now() - interval '1 hour'), ('${B}', 2, 'carot', now() - interval '1 hour'), ('${B}', 3, 'carot', now() - interval '1 hour')`);
  await h.db.exec(`update pets set vui = 40, stats_at = now() where owner_id = '${B}'`);
}, 90_000);

describe('xem ảnh chụp', () => {
  it('bạn bè xem được: hồ sơ, phòng, vườn; không có chỉ số, xu, kho', async () => {
    await as(A);
    const v = await rpc('get_visit', await code(B));
    expect(v.profile.name).toBe('Bình'); expect(v.room).toBeNull === undefined;
    expect(Object.keys(v).sort()).toEqual(['farm', 'parcels', 'plots', 'profile', 'room', 'today']);
    expect(JSON.stringify(v)).not.toMatch(/"(coins|no|sach|qty)":/); // khoá thôi: gen "dislike" có thể có giá trị "sach"
    expect(v.plots).toHaveLength(4); expect(v.plots[0].can_help).toBe(true);
  });
  it('người lạ, người bị chặn, chính mình thì không xem được', async () => {
    await as(C); await expect(rpc('get_visit', await code(B))).rejects.toThrow('not_friends');
    await as(A); await expect(rpc('get_visit', await code(A))).rejects.toThrow('not_found');
    await h.db.exec(`insert into blocks (blocker, blocked) values ('${B}', '${A}')`);
    await expect(rpc('get_visit', await code(B))).rejects.toThrow('blocked');
    await h.db.exec(`delete from blocks`);
  });
});

describe('tương tác', () => {
  it('vuốt ve bé bạn: Vui +2, người thăm nhận 3 xu, mỗi bạn một lần mỗi ngày', async () => {
    await as(A); const c0 = await coins(A);
    expect((await rpc('stroke_friend_pet', await code(B))).got).toBe(SOCIAL.visitReward);
    expect(await coins(A)).toBe(c0 + 3);
    expect(await h.one('select vui from pets where owner_id = $1', [B])).toBeCloseTo(42, 0);
    await expect(rpc('stroke_friend_pet', await code(B))).rejects.toThrow('already_today');
    await as(C); await expect(rpc('stroke_friend_pet', await code(B))).rejects.toThrow('not_friends');
  });
  it('tưới giúp: tăng lượt tưới, thưởng 5 xu, mỗi ô một lần mỗi ngày; tối đa 3 lần có thưởng/ngày', async () => {
    await as(A); const c0 = await coins(A);
    const r = await rpc('water_friend_crop', await code(B), 0);
    expect(r).toMatchObject({ waters: 1, got: SOCIAL.waterReward }); expect(await coins(A)).toBe(c0 + 5);
    await expect(rpc('water_friend_crop', await code(B), 0)).rejects.toThrow('already_today');
    expect((await rpc('water_friend_crop', await code(B), 1)).got).toBe(5); // đã có 2 lần thưởng (vuốt ve + 2 lần tưới = 3)
    expect((await rpc('water_friend_crop', await code(B), 2)).got).toBe(0); // quá 3 lần có thưởng
    const v = await rpc('get_visit', await code(B)); expect(v.today.rewarded).toBe(4); expect(v.plots[0].can_help).toBe(false);
  });
  it('không tưới được: ô trống, cây đã chín, người lạ', async () => {
    await as(A); await expect(rpc('water_friend_crop', await code(B), 20)).rejects.toThrow('plot_empty');
    await h.db.exec(`update garden_plots set planted_at = now() - interval '20 hours' where owner_id = '${B}' and plot = 3`);
    await expect(rpc('water_friend_crop', await code(B), 3)).rejects.toThrow('already_ready');
    await as(C); await expect(rpc('water_friend_crop', await code(B), 3)).rejects.toThrow('not_friends');
  });
  it('dấu vết: chỉ chọn trong danh sách, mỗi bạn một lần mỗi ngày, chủ nhà thấy', async () => {
    await as(A);
    await expect(rpc('leave_guestbook', await code(B), 'tu-go')).rejects.toThrow('invalid_emote');
    await rpc('leave_guestbook', await code(B), GUESTBOOK[0].id);
    await expect(rpc('leave_guestbook', await code(B), 'star')).rejects.toThrow('already_today');
    await as(B);
    const gb = await rpc('get_guestbook'); expect(gb.some((x: any) => x.kind === 'note' && x.emote === 'heart' && x.from === 'An')).toBe(true);
    expect(gb.length).toBeGreaterThanOrEqual(4);
  });
  it('quyền thật: chỉ thấy nhật ký của mình, không ghi thẳng', async () => {
    expect(Number(await h.withRole(C, () => h.one('select count(*) from visit_log')))).toBe(0);
    await expect(h.withRole(A, () => h.q(`insert into visit_log (visitor, host, kind, day) values ($1, $2, 'stroke', current_date)`, [A, B]))).rejects.toThrow(/permission denied/);
  });
});
