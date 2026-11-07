/** Tính năng chơi miễn phí trên Postgres thật (PGlite): mini-game mới + kỹ năng, việc làm thêm, thi biểu diễn, lễ hội,
 *  hẹn chơi, lời nhắn bạn bè, bé ghé chơi, sticker, Sổ mùa, và không còn nguồn "trả phí". */
import { beforeAll, describe, expect, it } from 'vitest';
import { MINI, MINI_KINDS, miniReward, miniTotalAdd } from '../../src/game/world-activity';
import { FESTIVAL_DAYS, SEASON_TIERS, STICKERS, contestReward, jobPay, skillLevel, skillXpFor, weekStart } from '../../src/game/f2p';
import { createHarness, type Harness } from './harness';
import { noonTz } from './util';

const U = (n: number) => `74000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const A = U(1), B = U(2), C = U(3);
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const coins = async (u: string) => Number(await h.one('select coins from wallets where owner_id = $1', [u]));
const pidOf = (u: string) => h.one('select public_id::text from public_profiles where user_id = $1', [u]);
const unlock = () => h.db.exec(`update minigame_logs set last_at = now() - interval '1 minute'`);
const today = (u: string) => h.one(`select private.local_day('${u}')::text`);

beforeAll(async () => {
  h = await createHarness(); await h.addUsers(A, B, C);
  for (const [u, n] of [[A, 'An'], [B, 'Bình'], [C, 'Chi']] as const) {
    await h.as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`);
    await h.db.exec(`update profiles set timezone = '${noonTz()}', created_at = now() - interval '3 days' where id = '${u}'`);
  }
  await h.db.exec(`update pets set stage = 'baby', asleep = false, nl = 90`);
  await h.db.exec(`insert into friendships (a, b, status, requested_by, accepted_at) values ('${A}', '${B}', 'accepted', '${A}', now() - interval '5 days')`);
  await h.as(A);
}, 90_000);

describe('danh mục khớp TS', () => {
  it('sticker, bậc Sổ mùa, ngày lễ và xu mini-game', async () => {
    expect(await h.q('select id, kind, ref, target from stickers order by sort')).toEqual(STICKERS.map(s => ({ id: s.id, kind: s.kind, ref: s.ref, target: s.target })));
    expect(await h.q('select xp, coins from season_tiers order by tier')).toEqual(SEASON_TIERS.map(t => ({ xp: t.xp, coins: t.coins })));
    const fd = await h.q<{ id: string; f: string; t: string }>(`select id, from_day::text f, to_day::text t from festival_days order by from_day`);
    expect(fd.map(r => ({ id: r.id, from: r.f, to: r.t }))).toEqual(FESTIVAL_DAYS.map(f => ({ id: f.id, from: f.from, to: f.to })));
    for (const k of MINI_KINDS) {
      expect(Number(await h.one(`select private.mini_max('${k}')`))).toBe(MINI[k].max);
      for (const s of [0, 1, MINI[k].max - 1, MINI[k].max]) expect(Number(await h.one(`select private.mini_total_add('${k}', ${s})`))).toBe(miniTotalAdd(k, s));
    }
    for (const k of ['fish', 'quiz', 'delivery', 'rhythm', 'bugs'] as const) expect(Number(await h.one(`select value from balance_config where key = 'mini.${k}_coin'`))).toBe(MINI[k].per);
    for (const xp of [0, 4, 5, 19, 20, 45, 499, 500, 9999]) expect(Number(await h.one(`select private.skill_level(${xp})`))).toBe(skillLevel(xp));
    for (const d of ['2026-11-02', '2026-11-08', '2026-11-09']) expect(await h.one(`select private.week_start('${d}')::text`)).toBe(weekStart(d));
    for (const r of [1, 2, 3, 4, 10, 11]) expect(Number(await h.one(`select private.contest_reward(${r})`))).toBe(contestReward(r));
  });
});

describe('mini-game mới', () => {
  it('nhận 5 trò mới, trả xu theo bảng và cộng kỹ năng; điểm vượt trần bị chặn', async () => {
    await expect(rpc('submit_minigame', 'fish', 9)).rejects.toThrow('invalid_score');
    const c0 = await coins(A), r = await rpc('submit_minigame', 'fish', 6);
    expect(r.reward).toBe(miniReward('fish', 6)); expect(await coins(A)).toBe(c0 + r.reward);
    expect(r.skill).toBe('craft'); expect(r.skill_xp).toBe(skillXpFor('fish', 6));
    for (const k of ['quiz', 'delivery', 'rhythm', 'bugs']) { await unlock(); expect((await rpc('submit_minigame', k, MINI[k as 'quiz'].max)).rewarded).toBe(true); }
    const p = await rpc('get_world_progress');
    expect(Object.keys(p.mini).sort()).toEqual([...MINI_KINDS].sort());
    expect(p.badges.find((b: any) => b.id === 'fish20').progress).toBe(6);
    expect(p.badges.find((b: any) => b.id === 'quiz5').progress).toBe(1);
  });
});

describe('việc làm thêm', () => {
  it('kiểm tra điều kiện, chưa xong thì chưa nhận, xong thì trả lương theo cấp kỹ năng', async () => {
    await expect(rpc('start_job', 'xyz', 1)).rejects.toThrow('unknown_job');
    await expect(rpc('start_job', 'tea', 2)).rejects.toThrow('invalid_hours');
    await h.db.exec(`update pets set nl = 10 where owner_id = '${A}'`);
    await expect(rpc('start_job', 'tea', 1)).rejects.toThrow('too_tired');
    await h.db.exec(`update pets set nl = 90 where owner_id = '${A}'`);
    const s = await rpc('start_job', 'tea', 3);
    expect(s.job).toBe('tea'); expect(s.done_today).toBe(1);
    await expect(rpc('start_job', 'park', 1)).rejects.toThrow('job_busy');
    await expect(rpc('finish_job')).rejects.toThrow('job_not_done');
    await h.db.exec(`update pet_jobs set ends_at = now() - interval '1 second'`);
    const xp = Number(await h.one(`select private.skill_of('${A}', 'craft')`)), c0 = await coins(A), r = await rpc('finish_job');
    expect(r.pay).toBe(jobPay('tea', 3, skillLevel(xp))); expect(await coins(A)).toBe(c0 + r.pay);
    expect(Number(await h.one(`select private.skill_of('${A}', 'craft')`))).toBe(xp + 12);
    await rpc('start_job', 'park', 1); await rpc('cancel_job'); // ca đã huỷ không tính, không có lương
    await rpc('start_job', 'park', 1); await h.db.exec(`update pet_jobs set ends_at = now() - interval '1 second'`); await rpc('finish_job');
    await expect(rpc('start_job', 'park', 1)).rejects.toThrow('job_limit'); // đủ 2 ca/ngày
  });
});

describe('thi biểu diễn tuần', () => {
  it('dự thi một lần mỗi tuần, có hạng; tuần sau nhận thưởng theo hạng một lần', async () => {
    const g = await rpc('enter_contest');
    expect(g.entered).toBe(true); expect(g.rank).toBe(1); expect(g.top[0].mine).toBe(true);
    await expect(rpc('enter_contest')).rejects.toThrow('already_entered');
    await expect(rpc('claim_contest')).rejects.toThrow('contest_not_entered');
    await h.db.exec(`update contest_entries set week = week - 7`);
    const st = await rpc('get_contest');
    expect(st.entered).toBe(false); expect(st.last.rank).toBe(1); expect(st.last.reward).toBe(100);
    const c0 = await coins(A); expect((await rpc('claim_contest')).reward).toBe(100); expect(await coins(A)).toBe(c0 + 100);
    await expect(rpc('claim_contest')).rejects.toThrow('already_claimed');
  });
});

describe('lễ hội', () => {
  it('ngoài lễ: không có quà; trong lễ: nhận 50 xu một lần mỗi đợt', async () => {
    const d = await today(A);
    if (!(await rpc('get_festival')).festival) await expect(rpc('claim_festival')).rejects.toThrow('no_festival');
    await h.db.exec(`delete from festival_days where '${d}'::date between from_day and to_day; insert into festival_days (id, from_day, to_day) values ('noel', '${d}', '${d}')`);
    const f = await rpc('get_festival'); expect(f.festival.id).toBe('noel'); expect(f.claimed).toBe(false);
    const c0 = await coins(A); expect((await rpc('claim_festival')).reward).toBe(50); expect(await coins(A)).toBe(c0 + 50);
    await expect(rpc('claim_festival')).rejects.toThrow('already_claimed');
  });
});

describe('hẹn chơi', () => {
  it('chỉ bạn bè; một lời mời đang chờ mỗi cặp; nhận thì cả hai được xu, gắn bó và ký ức', async () => {
    await h.as(C); await expect(rpc('invite_playdate', await pidOf(A))).rejects.toThrow('not_friends');
    await h.as(A); await rpc('invite_playdate', await pidOf(B));
    await expect(rpc('invite_playdate', await pidOf(B))).rejects.toThrow('playdate_exists');
    await h.as(B);
    const inc = (await rpc('list_playdates')).find((x: any) => x.incoming);
    expect(inc.from_name).toBe('An');
    const bond0 = Number(await h.one(`select bond_xp from pets where owner_id = '${A}'`)), cA = await coins(A), cB = await coins(B);
    expect((await rpc('respond_playdate', inc.id, true)).accepted).toBe(true);
    expect(await coins(A)).toBe(cA + 15); expect(await coins(B)).toBe(cB + 15);
    expect(Number(await h.one(`select bond_xp from pets where owner_id = '${A}'`))).toBe(bond0 + 3);
    expect(Number(await h.one(`select count(*) from memories where owner_id = '${B}' and body like 'Hẹn chơi với bé An%'`))).toBe(1);
    await expect(rpc('respond_playdate', inc.id, true)).rejects.toThrow('already_claimed');
    await h.as(A); await expect(rpc('invite_playdate', await pidOf(B))).rejects.toThrow('playdate_done_today');
  });
});

describe('lời nhắn bạn bè', () => {
  it('lọc chữ, một lời nhắn mỗi ngày cho mỗi bạn; chủ đọc và xoá được', async () => {
    await h.as(A);
    expect((await rpc('write_guest_note', await pidOf(B), 'ghé www.lua.com nha')).reason).toBe('link');
    expect((await rpc('write_guest_note', await pidOf(B), 'Bé Bình dễ thương quá!')).ok).toBe(true);
    await expect(rpc('write_guest_note', await pidOf(B), 'Thêm lần nữa')).rejects.toThrow('already_signed_today');
    await h.as(C); await expect(rpc('write_guest_note', await pidOf(B), 'chào')).rejects.toThrow('not_friends');
    await h.as(B); const notes = await rpc('get_guest_notes');
    expect(notes).toHaveLength(1); expect(notes[0].author).toBe('An'); expect(notes[0].body).toBe('Bé Bình dễ thương quá!');
    await rpc('delete_guest_note', notes[0].id); expect(await rpc('get_guest_notes')).toEqual([]);
    expect(await rpc('get_guestbook')).toEqual([]); // sổ lưu bút biểu tượng cũ vẫn chạy riêng
  });
});

describe('bé của bạn bè ghé chơi', () => {
  it('chỉ bạn bè, tối đa 3, không gồm người bị chặn', async () => {
    await h.as(A);
    const v = await rpc('get_visitors', 'plaza'); expect(v.map((x: any) => x.name)).toEqual(['Bình']);
    await expect(rpc('get_visitors', 'home')).rejects.toThrow('unknown_place');
    await h.db.exec(`insert into blocks (blocker, blocked) values ('${B}', '${A}')`);
    expect(await rpc('get_visitors', 'plaza')).toEqual([]);
    await h.db.exec(`delete from blocks`);
  });
});

describe('sticker và Sổ mùa', () => {
  it('sticker nhận khi đủ điều kiện, một lần, +10 xu', async () => {
    await h.as(A);
    const st = await rpc('get_stickers');
    expect(st.find((s: any) => s.id === 'st-apron').progress).toBe(1); // đã làm ca đầu tiên (trần 1)
    await expect(rpc('claim_sticker', 'st-briefcase')).rejects.toThrow('quest_not_done');
    await expect(rpc('claim_sticker', 'nope')).rejects.toThrow('unknown_sticker');
    const c0 = await coins(A); expect((await rpc('claim_sticker', 'st-apron')).reward).toBe(10); expect(await coins(A)).toBe(c0 + 10);
    await expect(rpc('claim_sticker', 'st-apron')).rejects.toThrow('already_claimed');
    expect((await rpc('get_stickers')).find((s: any) => s.id === 'st-lantern').progress).toBe(0);
  });
  it('điểm mùa cộng từ hoạt động, ca làm, hẹn chơi, dự thi, quà lễ; nhận bậc khi đủ', async () => {
    await h.as(A);
    const s = await rpc('get_season');
    // 5 trò (mỗi trò 1 lần × 5) + 2 ca làm × 25 + hẹn chơi 20 + dự thi 30 + quà lễ 30
    expect(s.xp).toBe(5 * 5 + 50 + 20 + 30 + 30);
    expect(s.tiers[0].ready).toBe(true); expect(s.tiers[1].ready).toBe(true); expect(s.tiers[2].ready).toBe(false);
    const c0 = await coins(A); expect((await rpc('claim_season', 0)).reward).toBe(SEASON_TIERS[0].coins); expect(await coins(A)).toBe(c0 + SEASON_TIERS[0].coins);
    await expect(rpc('claim_season', 0)).rejects.toThrow('already_claimed');
    await expect(rpc('claim_season', 2)).rejects.toThrow('quest_not_done');
    await expect(rpc('claim_season', 12)).rejects.toThrow('invalid_tier');
  });
});

describe('chỉ xu kiếm được', () => {
  it('không còn vật phẩm "trả phí" hay nguồn "purchase"', async () => {
    await expect(h.db.exec(`update items set source = 'paid' where id = (select id from items limit 1)`)).rejects.toThrow();
    await expect(h.db.exec(`insert into entitlements (owner_id, item_id, source, qty) values ('${A}', (select id from items limit 1), 'purchase', 1)`)).rejects.toThrow();
  });
  it('khách không gọi được các hàm mới', async () => {
    for (const fn of ['get_job_state()', 'get_contest()', 'get_stickers()', 'get_season()', 'list_playdates()', 'get_guest_notes()']) {
      await expect(h.withRole(null, () => h.q(`select ${fn}`), { role: 'anon' })).rejects.toThrow();
    }
  });
});
