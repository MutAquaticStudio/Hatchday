/** Hộp thư, quà tặng, tin tức trên Postgres thật. Khớp social.ts. */
import { beforeAll, describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/game/catalog';
import { isGiftable, SOCIAL, stockCap } from '../../src/game/social';
import { createHarness, type Harness } from './harness';
import { noonTz } from './util';

const A = '50000000-0000-4000-8000-00000000000a';
const B = '50000000-0000-4000-8000-00000000000b';
const C = '50000000-0000-4000-8000-00000000000c';
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const as = (u: string) => h.as(u);
const code = (u: string) => h.one('select friend_code from public_profiles where user_id = $1', [u]);
const give = (u: string, id: string, n: number) => h.db.exec(`insert into entitlements (owner_id, item_id, source, qty) values ('${u}', '${id}', 'gift', ${n}) on conflict (owner_id, item_id) do update set qty = ${n}`);
const qty = async (u: string, id: string) => Number((await h.q('select qty from entitlements where owner_id = $1 and item_id = $2', [u, id]))[0]?.qty ?? 0);
const befriend = async (x: string, y: string, daysAgo = 5) => h.db.exec(`insert into friendships (a, b, status, requested_by, accepted_at) values ('${x < y ? x : y}', '${x < y ? y : x}', 'accepted', '${x}', now() - interval '${daysAgo} days') on conflict do nothing`);

beforeAll(async () => {
  h = await createHarness();
  await h.addUsers(A, B, C);
  for (const [u, n] of [[A, 'An'], [B, 'Bình'], [C, 'Chi']] as const) { await as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); await h.db.exec(`update profiles set timezone = '${noonTz()}', created_at = now() - interval '10 days' where id = '${u}'`); }
  await befriend(A, B);
}, 90_000);

describe('luật quà khớp client', () => {
  it('giftable: mọi món trong catalog khớp isGiftable', async () => {
    const rows = await h.q("select id, kind, layer, source, active from items");
    for (const r of rows) { const want = r.kind === 'dish' || r.kind === 'outfit' ? false : isGiftable(r); expect(await h.one('select private.giftable(i) from items i where id = $1', [r.id]), r.id).toBe(want && r.active); }
    expect(ITEMS.length).toBeGreaterThan(0);
  });
  it('trần kho', () => { expect([stockCap('food'), stockCap('medicine'), stockCap('decor')]).toEqual([30, 10, 1000]); expect(SOCIAL.giftsPerDay).toBe(3); });
});

describe('tặng quà', () => {
  it('tặng đồ cho bạn: trừ kho người gửi, thư nằm ở hộp thư người nhận', async () => {
    await as(A); await give(A, 'carot', 4);
    const r = await rpc('send_gift', await code(B), JSON.stringify([{ id: 'carot', qty: 2 }]), 'Chúc bạn khoẻ!');
    expect(r.id).toBeGreaterThan(0); expect(await qty(A, 'carot')).toBe(2);
    await as(B);
    const inbox = await rpc('get_inbox');
    expect(inbox.mail).toHaveLength(1); expect(inbox.mail[0]).toMatchObject({ kind: 'gift', from: 'An', items: [{ id: 'carot', qty: 2 }], claimed: false, body: 'Chúc bạn khoẻ!' });
    expect((await rpc('get_social_summary')).mail_unread).toBe(1);
  });
  it('nhận quà: vào kho, chỉ nhận một lần', async () => {
    const id = (await rpc('get_inbox')).mail[0].id; const b0 = await qty(B, 'carot');
    await rpc('claim_mail', id);
    expect(await qty(B, 'carot')).toBe(b0 + 2);
    await expect(rpc('claim_mail', id)).rejects.toThrow('already_claimed');
    expect((await rpc('get_social_summary')).mail_unread).toBe(0);
  });
  it('không tặng được: người lạ, bạn mới, tài khoản mới, đồ không được tặng, quá 5 phần, ghi chú lạ, không đủ kho', async () => {
    await as(A);
    await expect(rpc('send_gift', await code(C), JSON.stringify([{ id: 'carot', qty: 1 }]))).rejects.toThrow('not_friends');
    await befriend(A, C, 1);
    await expect(rpc('send_gift', await code(C), JSON.stringify([{ id: 'carot', qty: 1 }]))).rejects.toThrow('too_new_friend');
    await h.db.exec(`update friendships set accepted_at = now() - interval '5 days'`);
    await give(A, 'carot', 10);
    await expect(rpc('send_gift', await code(B), JSON.stringify([{ id: 'no-hong', qty: 1 }]))).rejects.toThrow('not_giftable'); // đồ mặc
    await expect(rpc('send_gift', await code(B), JSON.stringify([{ id: 'chao-trung', qty: 1 }]))).rejects.toThrow('not_giftable'); // món nấu
    await expect(rpc('send_gift', await code(B), JSON.stringify([{ id: 'carot', qty: 6 }]))).rejects.toThrow('invalid_items');
    await expect(rpc('send_gift', await code(B), JSON.stringify([]))).rejects.toThrow('invalid_items');
    await expect(rpc('send_gift', await code(B), JSON.stringify([{ id: 'carot', qty: 1 }]), 'lời tự gõ')).rejects.toThrow('invalid_note');
    await h.db.exec(`delete from entitlements where owner_id = '${A}' and item_id = 'dua-hau'`);
    await expect(rpc('send_gift', await code(B), JSON.stringify([{ id: 'dua-hau', qty: 1 }]))).rejects.toThrow('not_owned');
    await h.db.exec(`update profiles set created_at = now() where id = '${A}'`);
    await expect(rpc('send_gift', await code(B), JSON.stringify([{ id: 'carot', qty: 1 }]))).rejects.toThrow('account_too_new');
    await h.db.exec(`update profiles set created_at = now() - interval '10 days' where id = '${A}'`);
  });
  it('hạn mức: 1 quà mỗi bạn mỗi ngày, 3 quà mỗi ngày', async () => {
    await as(A); await give(A, 'carot', 10);
    await expect(rpc('send_gift', await code(B), JSON.stringify([{ id: 'carot', qty: 1 }]))).rejects.toThrow('gift_limit_friend'); // đã tặng B hôm nay
    await h.db.exec(`delete from mailbox where to_user = '${B}'`);
    await h.db.exec(`insert into mailbox (to_user, from_user, kind, title) select '${C}', '${A}', 'gift', 'x' from generate_series(1, 3)`);
    await expect(rpc('send_gift', await code(B), JSON.stringify([{ id: 'carot', qty: 1 }]))).rejects.toThrow('gift_limit');
    await h.db.exec(`delete from mailbox`);
  });
  it('kho đầy thì thư giữ lại (stock_full); nhận tất cả bỏ qua thư lỗi', async () => {
    await h.db.exec(`update friendships set accepted_at = now() - interval '5 days'`);
    await as(A); await give(A, 'carot', 5); await give(B, 'carot', 29);
    await rpc('send_gift', await code(B), JSON.stringify([{ id: 'carot', qty: 3 }]));
    await as(B); const id = (await rpc('get_inbox')).mail[0].id;
    await expect(rpc('claim_mail', id)).rejects.toThrow('stock_full');
    const all = await rpc('claim_all_mail'); expect(all).toMatchObject({ claimed: 0, skipped: 1 });
    expect(await qty(B, 'carot')).toBe(29);
  });
  it('hết hạn chưa nhận thì trả lại kho người gửi', async () => {
    const before = await qty(A, 'carot');
    await h.db.exec(`update mailbox set expires_at = now() - interval '1 minute'`);
    await as(B); expect((await rpc('get_inbox')).mail).toEqual([]);
    expect(await qty(A, 'carot')).toBe(before + 3);
    await expect(rpc('claim_mail', 1)).rejects.toThrow();
  });
});

describe('thư hệ thống, thưởng, xoá', () => {
  it('thư xu và vật phẩm từ hệ thống: nhận được, không tính trần xu chăm sóc', async () => {
    await h.q(`select private.send_mail('${B}', null, 'reward', 'Quà chào mừng', 'Chúc bạn chơi vui', '[{"id":"tra-gung","qty":2}]'::jsonb, 120)`);
    await as(B);
    const m = (await rpc('get_inbox')).mail[0]; expect(m.from).toBeNull();
    const c0 = await h.one('select coins from wallets where owner_id = $1', [B]); const e0 = await h.one('select earned_today from wallets where owner_id = $1', [B]);
    const r = await rpc('claim_mail', m.id); expect(r.wallet).toBe(c0 + 120);
    expect(await h.one('select earned_today from wallets where owner_id = $1', [B])).toBe(e0);
    expect(await qty(B, 'tra-gung')).toBe(2);
    await rpc('delete_mail', m.id);
    await expect(rpc('delete_mail', m.id)).rejects.toThrow('not_found');
  });
  it('không xoá được thư quà chưa nhận; người khác không nhận được thư của mình', async () => {
    const id = await h.q<{ id: number }>(`insert into mailbox (to_user, from_user, kind, title, items) values ('${B}', '${A}', 'gift', 'q', '[{"id":"carot","qty":1}]') returning id`);
    await as(B); await expect(rpc('delete_mail', id[0].id)).rejects.toThrow('not_found');
    await as(C); await expect(rpc('claim_mail', id[0].id)).rejects.toThrow('not_found');
  });
});

describe('tin tức', () => {
  it('chỉ thấy tin đang chạy và đủ cấp Gắn bó; đánh dấu đã đọc', async () => {
    await h.db.exec(`insert into announcements (kind, title, body, pinned) values ('update', 'Bản cập nhật 1.1', 'Có bản đồ mới', true), ('maintenance', 'Bảo trì', 'Đêm nay', false),
      ('notice', 'Hết hạn', '', false), ('notice', 'Chưa tới', '', false), ('notice', 'Cấp cao', '', false)`);
    await h.db.exec(`update announcements set ends_at = now() - interval '1 hour' where title = 'Hết hạn'; update announcements set starts_at = now() + interval '1 hour' where title = 'Chưa tới'; update announcements set min_bond = 9 where title = 'Cấp cao'`);
    await as(B);
    const news = await rpc('get_news'); expect(news.map((n: any) => n.title)).toEqual(['Bản cập nhật 1.1', 'Bảo trì']); expect(news[0].pinned).toBe(true);
    expect((await rpc('get_social_summary')).news_unread).toBe(2);
    await rpc('mark_news_read', news[0].id); await rpc('mark_news_read', news[0].id);
    expect((await rpc('get_social_summary')).news_unread).toBe(1);
    expect((await rpc('get_news'))[0].read).toBe(true);
  });
  it('quyền thật: đọc được tin, không ghi được tin, không đọc thư người khác', async () => {
    expect(Number(await h.withRole(B, () => h.one('select count(*) from announcements')))).toBe(2);
    await expect(h.withRole(B, () => h.q(`insert into announcements (kind, title) values ('notice', 'x')`))).rejects.toThrow(/permission denied/);
    expect(Number(await h.withRole(C, () => h.one('select count(*) from mailbox')))).toBe(0);
  });
});
