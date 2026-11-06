/** Chat công khai, chat riêng và kiểm duyệt trên Postgres thật; bộ lọc so khớp bản TypeScript bằng bộ ngữ liệu vàng. */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { filterChat, normalize, type WordRule } from '../../src/net/moderation';
import { createHarness, type Harness } from './harness';

const U = (n: number) => `80000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [A, B, C, D, NEWBIE] = [U(1), U(2), U(3), U(4), U(5)];
const corpus = JSON.parse(readFileSync(new URL('./fixtures/chat-corpus.json', import.meta.url), 'utf8')) as { terms: WordRule[]; cases: string[] };
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const as = (u: string) => h.as(u);
const reset = () => h.db.exec('delete from chat_log; delete from chat_strikes; delete from sanctions; delete from reports; delete from dm_messages; delete from realtime.messages;');
const enableChat = (on: boolean) => h.db.exec(`update system_flags set value = '${on}' where key = 'chat.public.enabled'`);
const code = (u: string) => h.one('select friend_code from public_profiles where user_id = $1', [u]);

beforeAll(async () => {
  h = await createHarness();
  await h.addUsers(A, B, C, D, NEWBIE);
  for (const [u, n] of [[A, 'An'], [B, 'Bình'], [C, 'Chi'], [D, 'Dũng'], [NEWBIE, 'Mới']] as const) {
    await as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`);
    await h.db.exec(`update pets set bond_xp = 300 where owner_id = '${u}'`);
    if (u !== NEWBIE) await h.db.exec(`update profiles set created_at = now() - interval '3 days' where id = '${u}'`);
  }
  for (const t of corpus.terms) await h.q('insert into word_filter (term, match, action) values ($1, $2, $3)', [t.term, t.match, t.action]);
  await h.db.exec(`insert into friendships (a, b, status, requested_by, accepted_at) values ('${A}', '${B}', 'accepted', '${A}', now() - interval '5 days')`);
  await as(A); await rpc('join_place', 'plaza'); await as(B); await rpc('join_place', 'plaza'); await as(C); await rpc('join_place', 'tea');
}, 90_000);

describe('bộ lọc: SQL khớp bản TypeScript trên bộ ngữ liệu vàng', () => {
  it.each(corpus.cases.map((c, i) => [i, c] as const))('ca %i: %j', async (_i, text) => {
    const sql = await rpc('private.chat_filter', text), ts = filterChat(text, corpus.terms);
    expect(sql).toEqual({ ok: ts.ok, reason: ts.reason, text: ts.text, flag: ts.flag, norm: ts.norm });
  });
  it('chuẩn hoá giống nhau', async () => {
    for (const t of ['ĐÂY LÀ Thử', 'b4dw0rd', 'zzzoork', 'Phở bò', 'a​b']) expect(await rpc('private.chat_normalize', t)).toBe(normalize(t));
  });
  it('các ca chính cho đúng kết quả mong đợi', () => {
    const r = (t: string) => filterChat(t, corpus.terms);
    expect(r('Xin chào các bạn!').ok).toBe(true);
    expect(r('').reason).toBe('empty'); expect(r('a'.repeat(101)).reason).toBe('too_long');
    expect(r('Xem http://abc.com').reason).toBe('link'); expect(r('chấm com').reason).toBe('link'); expect(r('@tên').reason).toBe('link');
    expect(r('0912 345 678').reason).toBe('phone'); expect(r('tôi 8 tuổi').ok).toBe(true);
    expect(r('🎉🎉🎉🎉').reason).toBe('emoji'); expect(r('🎉🎉🎉').ok).toBe(true);
    expect(r('b4dw0rd').reason).toBe('filtered'); expect(r('bad​word').reason).toBe('filtered'); expect(r('badwords').ok).toBe(true); // từ lành chứa chuỗi xấu
    expect(r('ĐÚXYZ').reason).toBe('filtered'); expect(r('z o r k').reason).toBe('filtered'); // substr bắt cả chữ cách quãng
    expect(r('this maskme text').text).toBe('this *** text'); expect(r('flagme please')).toMatchObject({ ok: true, flag: true });
  });
});

describe('post_chat', () => {
  it('cờ tắt thì chat_disabled; không ở trong kênh thì not_in_place', async () => {
    await reset(); await as(A);
    await expect(rpc('post_chat', 'plaza:1', 'xin chào')).rejects.toThrow('chat_disabled');
    await enableChat(true);
    await as(C); await expect(rpc('post_chat', 'plaza:1', 'xin chào')).rejects.toThrow('not_in_place'); // C ở kênh tea
    await h.as(null); await expect(rpc('post_chat', 'plaza:1', 'xin chào')).rejects.toThrow('not_authenticated');
  });
  it('gửi được, ghi nhật ký, phát tới kênh chat:<kênh> mà không lộ mã người dùng', async () => {
    await reset(); await as(A);
    const r = await rpc('post_chat', 'plaza:1', '  Xin   chào mọi người  ');
    expect(r).toMatchObject({ ok: true, text: 'Xin chào mọi người' });
    const m = await h.q<{ topic: string; event: string; payload: any }>('select topic, event, payload from realtime.messages');
    expect(m).toHaveLength(1); expect(m[0]).toMatchObject({ topic: 'chat:plaza:1', event: 'chat' });
    expect(m[0].payload).toMatchObject({ name: 'An', text: 'Xin chào mọi người', id: r.id });
    expect(JSON.stringify(m[0].payload)).not.toContain(A);
    expect(await h.one('select count(*)::int from chat_log')).toBe(1);
  });
  it('tài khoản dưới 24 giờ chưa chat được', async () => {
    await reset(); await as(NEWBIE); await rpc('join_place', 'plaza');
    await expect(rpc('post_chat', 'plaza:1', 'chào')).rejects.toThrow('account_too_new');
    await h.db.exec(`delete from place_members where user_id = '${NEWBIE}'`);
  });
  it('nội dung xấu bị từ chối kèm lý do; che và gắn cờ hoạt động', async () => {
    await reset(); await as(A);
    expect(await rpc('post_chat', 'plaza:1', 'gọi 0912345678')).toEqual({ ok: false, reason: 'phone' });
    expect(await rpc('post_chat', 'plaza:1', 'xem www.abc.xyz')).toEqual({ ok: false, reason: 'link' });
    expect(await h.one('select count(*)::int from chat_log')).toBe(0);
    expect((await rpc('post_chat', 'plaza:1', 'this maskme text')).text).toBe('this *** text');
    expect((await rpc('post_chat', 'plaza:1', 'flagme please')).ok).toBe(true);
    expect(await h.one(`select count(*)::int from reports where kind = 'chat' and detail like 'auto:%'`)).toBe(1);
  });
  it('3 tin bị chặn trong 5 phút thì tự khoá chat 10 phút', async () => {
    await reset(); await as(A);
    for (const t of ['gọi 0912345678', 'mail a@b.vn', 'www.x.com']) await rpc('post_chat', 'plaza:1', t);
    expect(await h.one(`select count(*)::int from sanctions where user_id = '${A}' and kind = 'mute' and auto`)).toBe(1);
    await expect(rpc('post_chat', 'plaza:1', 'xin chào')).rejects.toThrow('muted');
    await as(B); expect((await rpc('post_chat', 'plaza:1', 'tôi vẫn chat được')).ok).toBe(true); // người khác không bị ảnh hưởng
  });
  it('giới hạn nhịp: tối đa 3 tin trong 6 giây; tin trùng bị chặn', async () => {
    await reset(); await as(A);
    for (const t of ['một', 'hai', 'ba']) expect((await rpc('post_chat', 'plaza:1', t)).ok).toBe(true);
    await expect(rpc('post_chat', 'plaza:1', 'bốn')).rejects.toThrow('rate_limited');
    await reset(); await rpc('post_chat', 'plaza:1', 'trùng nhé');
    await expect(rpc('post_chat', 'plaza:1', 'Trùng   NHÉ')).rejects.toThrow('duplicate');
  });
  it('chat_log không đọc được trực tiếp bằng quyền người chơi', async () => {
    await reset(); await as(A); await rpc('post_chat', 'plaza:1', 'bí mật');
    expect(await h.withRole(A, async () => (await h.q('select * from chat_log')).length)).toBe(0);
  });
});

describe('report_chat', () => {
  it('chụp tin và 10 tin trước; không báo mình, không báo trùng; 3 người báo thì tự khoá 15 phút', async () => {
    await reset(); await as(A);
    for (let i = 0; i < 2; i++) { await h.db.exec(`insert into chat_log (user_id, topic, body, norm) values ('${B}', 'plaza:1', 'tin cũ ${i}', 'tin cu ${i}')`); }
    const sent = await rpc('post_chat', 'plaza:1', 'tin bị báo');
    await expect(rpc('report_chat', sent.id, 'spam')).rejects.toThrow('not_found'); // báo chính mình
    await as(B); await rpc('report_chat', sent.id, 'harassment');
    const ev = await h.one('select snapshot from chat_evidence');
    expect(ev).toMatchObject({ msg: sent.id, topic: 'plaza:1', body: 'tin bị báo' }); expect(ev.before).toHaveLength(2);
    await expect(rpc('report_chat', sent.id, 'harassment')).rejects.toThrow('already_reported');
    await expect(rpc('report_chat', sent.id, 'xấu bụng')).rejects.toThrow('invalid_reason');
    await as(C); await rpc('report_chat', sent.id, 'spam');
    expect(await h.one(`select count(*)::int from sanctions where user_id = '${A}'`)).toBe(0);
    await as(D); await rpc('report_chat', sent.id, 'other');
    expect(await h.one(`select count(*)::int from sanctions where user_id = '${A}' and kind = 'mute' and auto`)).toBe(1);
  });
});

describe('chat riêng (DM)', () => {
  it('chỉ giữa bạn bè; người lạ và người bị chặn bị từ chối', async () => {
    await reset(); await as(C);
    await expect(rpc('send_dm', await code(A), 'chào bạn')).rejects.toThrow('not_friends');
    await expect(rpc('send_dm', await code(C), 'tự nói')).rejects.toThrow('not_found');
    await as(A); await h.db.exec(`insert into blocks (blocker, blocked) values ('${B}', '${A}')`);
    await expect(rpc('send_dm', await code(B), 'chào')).rejects.toThrow('blocked');
    await h.db.exec('delete from blocks');
  });
  it('gửi, nhận, đếm chưa đọc, đánh dấu đã đọc', async () => {
    await reset(); await as(A);
    expect((await rpc('send_dm', await code(B), 'chào Bình')).ok).toBe(true);
    await as(B); expect(await rpc('dm_unread')).toBe(1);
    const th = await rpc('list_dm_threads'); expect(th).toHaveLength(1); expect(th[0]).toMatchObject({ last: 'chào Bình', unread: 1, mine: false }); expect(th[0].with.name).toBe('An');
    const msgs = await rpc('list_dm', await code(A)); expect(msgs.map((m: any) => m.body)).toEqual(['chào Bình']); expect(msgs[0].mine).toBe(false);
    await rpc('mark_dm_read', await code(A)); expect(await rpc('dm_unread')).toBe(0);
    await as(A); expect((await rpc('list_dm_threads'))[0]).toMatchObject({ mine: true, unread: 0 });
  });
  it('DM cũng bị lọc, bị tính gậy và nhịp; có công tắc riêng', async () => {
    await reset(); await as(A);
    expect(await rpc('send_dm', await code(B), 'gọi 0912345678')).toEqual({ ok: false, reason: 'phone' });
    expect(await h.one('select count(*)::int from dm_messages')).toBe(0); expect(await h.one('select count(*)::int from chat_strikes')).toBe(1);
    await h.db.exec(`update system_flags set value = 'false' where key = 'chat.dm.enabled'`);
    await expect(rpc('send_dm', await code(B), 'chào')).rejects.toThrow('chat_disabled');
    await h.db.exec(`update system_flags set value = 'true' where key = 'chat.dm.enabled'`);
  });
  it('tin DM của người đã bị chặn không hiện trong danh sách hội thoại', async () => {
    await reset(); await as(A); await rpc('send_dm', await code(B), 'xin chào');
    await as(B); await h.db.exec(`insert into blocks (blocker, blocked) values ('${B}', '${A}')`);
    expect(await rpc('list_dm_threads')).toHaveLength(0); expect(await rpc('dm_unread')).toBe(0);
    await h.db.exec('delete from blocks');
  });
  it('sweep_chat dọn tin cũ', async () => {
    await reset(); await as(A); await rpc('send_dm', await code(B), 'cũ');
    await h.db.exec(`update dm_messages set created_at = now() - interval '31 days'; insert into chat_log (user_id, topic, body, norm, created_at) values ('${A}', 'x', 'y', 'y', now() - interval '2 days')`);
    await h.db.exec('select private.sweep_chat()');
    expect(await h.one('select count(*)::int from dm_messages')).toBe(0); expect(await h.one(`select count(*)::int from chat_log where topic = 'x'`)).toBe(0);
  });
});
