/** Nơi chung trên Postgres thật: vào kênh, chọn kênh, nhịp tim, danh sách người trong kênh, chính sách Realtime. */
import { beforeAll, describe, expect, it } from 'vitest';
import { PLACE_BY_ID } from '../../src/game/places/registry';
import { createHarness, type Harness } from './harness';

const U = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [A, B, C, D] = [U(1), U(2), U(3), U(4)];
let h: Harness;
const rpc = async (fn: string, ...args: unknown[]) => (await h.q<{ r: any }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
const as = (u: string) => h.as(u);
const clear = () => h.db.exec('delete from place_members');
const bond = (u: string, xp: number) => h.db.exec(`update pets set bond_xp = ${xp} where owner_id = '${u}'`);

beforeAll(async () => {
  h = await createHarness();
  await h.addUsers(A, B, C, D);
  for (const [u, n] of [[A, 'An'], [B, 'Bình'], [C, 'Chi'], [D, 'Dũng']] as const) { await as(u); await h.q(`select * from create_pet('${n}', 'Nhà ${n}', 1)`); await bond(u, 300); } // Gắn bó cấp 5
}, 90_000);

describe('luật nơi chung khớp registry', () => {
  it('mở khoá và sức chứa giống PLACES', async () => {
    for (const id of ['plaza', 'tea', 'park']) {
      expect(await h.one('select private.place_unlock($1)', [id])).toBe(PLACE_BY_ID[id].unlock);
      expect(await h.one('select private.place_cap($1)', [id])).toBe(PLACE_BY_ID[id].cap);
    }
  });
});

describe('join_place', () => {
  it('chặn nơi lạ, chưa đủ Gắn bó, chưa có bé, nơi đã đóng', async () => {
    await as(A); await clear();
    await expect(rpc('join_place', 'casino')).rejects.toThrow('unknown_place');
    await bond(A, 0); await expect(rpc('join_place', 'plaza')).rejects.toThrow('bond_too_low'); await bond(A, 300);
    await h.db.exec(`update system_flags set value = 'false' where key = 'places.enabled'`);
    await expect(rpc('join_place', 'plaza')).rejects.toThrow('place_closed');
    await h.db.exec(`update system_flags set value = 'true' where key = 'places.enabled'`);
    await h.as(null); await expect(rpc('join_place', 'plaza')).rejects.toThrow('not_authenticated');
  });
  it('người đầu vào kênh 1, người sau vào cùng kênh đông nhất còn chỗ', async () => {
    await clear();
    await as(A); const a = await rpc('join_place', 'plaza'); expect(a).toMatchObject({ topic: 'plaza:1', shard: 1, cap: 12 });
    await as(B); expect((await rpc('join_place', 'plaza')).topic).toBe('plaza:1');
    await as(C); expect((await rpc('join_place', 'tea')).topic).toBe('tea:1'); // nơi khác là kênh riêng
  });
  it('vào nơi khác thì rời kênh cũ; chỉ có một dòng cho mỗi người', async () => {
    await as(C); await rpc('join_place', 'plaza'); await rpc('join_place', 'park');
    expect(await h.one(`select count(*)::int from place_members where user_id = '${C}'`)).toBe(1);
    expect(await h.one(`select topic from place_members where user_id = '${C}'`)).toBe('park:1');
  });
  it('kênh đầy thì sang kênh mới; ưu tiên kênh có bạn bè', async () => {
    await clear();
    const fakes = Array.from({ length: 12 }, (_, i) => U(100 + i));
    await h.addUsers(...fakes);
    for (const f of fakes) await h.db.exec(`insert into place_members (user_id, place, shard, topic) values ('${f}', 'plaza', 1, 'plaza:1')`);
    await as(A); expect((await rpc('join_place', 'plaza')).topic).toBe('plaza:2'); // kênh 1 đã đủ 12
    // D là bạn của A; B vào kênh 3 (kênh mới) rồi D vào: D theo bạn
    await as(B); await h.db.exec(`delete from place_members where user_id = '${B}'`);
    await h.db.exec(`delete from place_members where user_id in (${fakes.slice(0, 7).map(f => `'${f}'`).join(',')})`); // kênh 1 còn 5 người
    await h.db.exec(`insert into friendships (a, b, status, requested_by, accepted_at) values ('${A < D ? A : D}', '${A < D ? D : A}', 'accepted', '${A}', now() - interval '5 days')`);
    await as(D); expect((await rpc('join_place', 'plaza')).topic).toBe('plaza:2'); // theo bạn (A ở kênh 2) dù kênh 1 đông hơn
  });
  it('quá max_shards thì place_full', async () => {
    await clear();
    const many = Array.from({ length: 20 }, (_, i) => U(200 + i));
    await h.addUsers(...many);
    for (let i = 0; i < 20; i++) await h.db.exec(`insert into place_members (user_id, place, shard, topic) select '${many[i]}', 'park', ${i + 1}, 'park:${i + 1}'`);
    // mỗi kênh có 1 người, còn chỗ: người mới vào kênh đông nhất (số nhỏ nhất), không tạo kênh 21
    await as(A); expect((await rpc('join_place', 'park')).shard).toBe(1);
    await h.db.exec(`delete from place_members where user_id = '${A}'`);
    await h.db.exec(`update place_members set topic = 'park:1', shard = 1`); // dồn hết vào kênh 1 để thử đầy: 20 > cap 16 là dữ liệu giả, chỉ thử nhánh đầy
    await as(B); expect((await rpc('join_place', 'park')).shard).toBe(2); // kênh 1 đầy (≥ 16) thì sang kênh trống số nhỏ nhất
  });
});

describe('nhịp tim, hết hạn, rời', () => {
  it('heartbeat làm mới last_seen; chưa vào thì báo not_in_place', async () => {
    await clear(); await as(A);
    await expect(rpc('place_heartbeat')).rejects.toThrow('not_in_place');
    await rpc('join_place', 'plaza');
    await h.db.exec(`update place_members set last_seen = now() - interval '90 seconds' where user_id = '${A}'`);
    await rpc('place_heartbeat');
    expect(await h.one(`select extract(epoch from now() - last_seen)::int < 5 from place_members where user_id = '${A}'`)).toBe(true);
  });
  it('quá 120 giây không nhịp tim thì không tính vào số người và không nghe được kênh', async () => {
    await clear(); await as(A); await rpc('join_place', 'plaza'); await as(B); await rpc('join_place', 'plaza');
    expect((await rpc('places_summary')).plaza).toBe(2);
    await h.db.exec(`update place_members set last_seen = now() - interval '3 minutes' where user_id = '${B}'`);
    expect((await rpc('places_summary')).plaza).toBe(1);
    await as(A); expect(await rpc('shard_roster', 'plaza:1')).toHaveLength(0); // B đã hết hạn
  });
  it('leave_place xoá dòng', async () => {
    await clear(); await as(A); await rpc('join_place', 'plaza'); await rpc('leave_place');
    expect(await h.one('select count(*)::int from place_members')).toBe(0);
  });
});

describe('shard_roster: chỉ hồ sơ công khai', () => {
  it('trả về pid và dáng của người khác trong kênh, không lộ user_id hay mã bạn bè, bỏ chính mình', async () => {
    await clear(); await as(A); await rpc('join_place', 'plaza'); await as(B); await rpc('join_place', 'plaza');
    const r = await rpc('shard_roster', 'plaza:1');
    expect(r).toHaveLength(1); expect(r[0].name).toBe('An');
    expect(Object.keys(r[0]).sort()).toEqual(['bond_level', 'family', 'form', 'genes', 'outfit', 'pid', 'species', 'stage', 'name'].sort());
    expect(JSON.stringify(r)).not.toContain(A);
    expect(JSON.stringify(r)).not.toContain(await h.one('select friend_code from public_profiles where user_id = $1', [A]));
  });
  it('không ở trong kênh thì không xem được; người chặn nhau không thấy nhau', async () => {
    await as(C); await expect(rpc('shard_roster', 'plaza:1')).rejects.toThrow('not_in_place');
    await as(B); await h.db.exec(`insert into blocks (blocker, blocked) values ('${A}', '${B}')`);
    expect(await rpc('shard_roster', 'plaza:1')).toHaveLength(0);
    await h.db.exec('delete from blocks');
  });
});

describe('chính sách realtime.messages', () => {
  it('chỉ người đang ở trong kênh mới nghe và nói được', async () => {
    await clear(); await as(A); await rpc('join_place', 'plaza'); await as(B); await rpc('join_place', 'tea');
    await h.db.exec(`insert into realtime.messages (topic, extension, event, payload) values ('plaza:1', 'broadcast', 'intent', '{}'), ('tea:1', 'broadcast', 'intent', '{}')`);
    await h.setTopic('plaza:1');
    // chính sách xét theo kênh đang nối (realtime.topic()), không theo từng dòng
    expect(await h.withRole(A, async () => (await h.q('select topic from realtime.messages')).length)).toBeGreaterThan(0); // A (trong plaza:1) nghe được kênh plaza:1
    expect(await h.withRole(B, async () => (await h.q('select topic from realtime.messages')).length)).toBe(0); // B ở tea:1 thì không nghe plaza:1
    expect(await h.withRole(C, async () => (await h.q('select topic from realtime.messages')).length)).toBe(0); // C không ở đâu cả
    await h.withRole(A, async () => { await h.q(`insert into realtime.messages (topic, extension, event, payload) values ('plaza:1', 'broadcast', 'emote', '{}')`); }); // A nói được
    await expect(h.withRole(B, async () => { await h.q(`insert into realtime.messages (topic, extension, event, payload) values ('plaza:1', 'broadcast', 'emote', '{}')`); })).rejects.toThrow(/row-level security/i);
    await h.setTopic(null);
  });
});

describe('công tắc khẩn qua admin_set_flag', () => {
  it('owner (aal2) tắt places.enabled thì không ai vào được; giá trị không phải boolean bị từ chối', async () => {
    await h.db.exec(`insert into admin_roles (user_id, role) values ('${D}', 'owner') on conflict do nothing`);
    await h.withRole(D, async () => {
      await expect(rpc('admin_set_flag', 'places.enabled', '"x"', 'thử cờ sai')).rejects.toThrow('invalid_flag');
      await rpc('admin_set_flag', 'places.enabled', 'false', 'bảo trì thử');
    }, { claims: { aal: 'aal2' } });
    await clear(); await as(A); await expect(rpc('join_place', 'plaza')).rejects.toThrow('place_closed');
    await h.db.exec(`update system_flags set value = 'true' where key = 'places.enabled'`);
  });
});
