import { describe, expect, it } from 'vitest';
import { EMOTES, PROTO, makeLimiter, parseMsg } from './protocol';
import { SimRoom } from './sim';
import { makeThrottle } from './transport';

const look = (name: string) => ({ name, species: 'mam-xanh', stage: 'baby', form: null, genes: {}, outfit: {}, bond_level: 2, x: 0, z: 0 });
const A = 'a0000000-0000-4000-8000-000000000001', B = 'a0000000-0000-4000-8000-000000000002';
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const until = async (fn: () => boolean, ms = 1500) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await wait(10); } return false; };

describe('giao thức', () => {
  it('nhận tin hợp lệ và kẹp toạ độ vào sân', () => {
    expect(parseMsg({ t: 'intent', pid: A, x: 2, z: -1 })).toEqual({ t: 'intent', pid: A, x: 2, z: -1 });
    expect(parseMsg({ t: 'intent', pid: A, x: 999, z: -999 })).toEqual({ t: 'intent', pid: A, x: PROTO.bound, z: -PROTO.bound });
    expect(parseMsg({ t: 'emote', pid: A, id: 'heart' })).toEqual({ t: 'emote', pid: A, id: 'heart' });
  });
  it('bỏ tin hỏng, thiếu trường, emote lạ, pid sai, quá lớn, kiểu khác', () => {
    for (const bad of [null, 'x', 5, {}, { t: 'intent', pid: A }, { t: 'intent', pid: A, x: NaN, z: 0 }, { t: 'intent', pid: A, x: '1', z: 0 }, { t: 'emote', pid: A, id: 'hack' },
      { t: 'emote', pid: 'không-phải-uuid!', id: 'heart' }, { t: 'chat', pid: A, text: 'xin chào' }, { t: 'intent', pid: A, x: 0, z: 0, junk: 'x'.repeat(2000) }]) expect(parseMsg(bad)).toBeNull();
  });
  it('có 8 emote có biểu tượng và nhãn', () => { expect(EMOTES).toHaveLength(8); EMOTES.forEach(e => { expect(e.e).toBeTruthy(); expect(e.label).toBeTruthy(); }); });
  it('bộ lọc tốc độ: tối đa 5 tin mỗi giây mỗi người, người khác không ảnh hưởng', () => {
    let t = 1000; const ok = makeLimiter(() => t);
    expect([1, 2, 3, 4, 5, 6, 7].map(() => ok(A))).toEqual([true, true, true, true, true, false, false]);
    expect(ok(B)).toBe(true); t += 1001; expect(ok(A)).toBe(true);
  });
  it('giãn cách gửi', () => { let t = 0; const th = makeThrottle(1500, () => t); expect(th()).toBe(true); t = 1000; expect(th()).toBe(false); t = 1600; expect(th()).toBe(true); });
});

describe('SimRoom: hai người cùng nơi', () => {
  it('thấy nhau, nhận ý định đi và emote, thấy khi rời', async () => {
    const a = new SimRoom('plaza', look('An'), 12, { pid: A, bots: 0 }), b = new SimRoom('plaza', look('Bình'), 12, { pid: B, bots: 0 });
    const seen: string[] = [], moves: [string, number, number][] = [], emotes: [string, string][] = [], gone: string[] = [];
    a.on('join', p => seen.push(p.name)); a.on('intent', (p, x, z) => moves.push([p, x, z])); a.on('emote', (p, id) => emotes.push([p, id])); a.on('leave', p => gone.push(p));
    expect(await until(() => a.peers().length === 1 && b.peers().length === 1)).toBe(true);
    expect(seen).toContain('Bình'); expect(a.peers()[0].pid).toBe(B);
    b.sendIntent(3, 1.5); expect(await until(() => moves.length === 1)).toBe(true); expect(moves[0]).toEqual([B, 3, 1.5]);
    expect(a.peers()[0]).toMatchObject({ x: 3, z: 1.5 });
    b.sendIntent(4, 2); b.sendIntent(5, 2); await wait(60); expect(moves).toHaveLength(1); // bị giãn cách 1,5 giây
    b.sendEmote('heart'); expect(await until(() => emotes.length === 1)).toBe(true); expect(emotes[0]).toEqual([B, 'heart']);
    b.sendEmote('star'); await wait(60); expect(emotes).toHaveLength(1); // emote giãn cách 3 giây
    await b.leave(); expect(await until(() => gone.includes(B))).toBe(true); expect(a.peers()).toHaveLength(0);
    await a.leave();
  });
  it('nơi khác nhau thì không thấy nhau', async () => {
    const a = new SimRoom('plaza', look('An'), 12, { pid: A, bots: 0 }), b = new SimRoom('tea', look('Bình'), 16, { pid: B, bots: 0 });
    await wait(150); expect(a.peers()).toHaveLength(0); expect(b.peers()).toHaveLength(0);
    await a.leave(); await b.leave();
  });
  it('kênh đầy thì không nhận thêm người', async () => {
    const a = new SimRoom('plaza', look('An'), 2, { pid: A, bots: 0 }), b = new SimRoom('plaza', look('Bình'), 2, { pid: B, bots: 0 });
    await until(() => a.peers().length === 1);
    const c = new SimRoom('plaza', look('Chi'), 2, { pid: 'a0000000-0000-4000-8000-000000000003', bots: 0 });
    await wait(150); expect(a.peers()).toHaveLength(1); expect(c.peers().length).toBeLessThanOrEqual(1);
    await Promise.all([a.leave(), b.leave(), c.leave()]);
  });
  it('bạn ảo vào dần và đi lại', async () => {
    const a = new SimRoom('park', look('An'), 16, { pid: A, bots: 2, botMs: 40 });
    const moves: string[] = []; a.on('intent', p => moves.push(p));
    expect(await until(() => a.peers().length === 2, 3000)).toBe(true);
    expect(await until(() => moves.length > 0, 3000)).toBe(true);
    await a.leave(); expect(a.peers()).toHaveLength(0);
  });
});
