import { describe, expect, it } from 'vitest';
import { AuthError, steamEmail, steamLogin, verifyTicket, type Admin } from './logic';

const env = { webApiKey: 'K', appId: '123' };
const ok = (params: object) => async () => ({ ok: true, status: 200, json: async () => ({ response: { params } }) });
const SID = '76561198000000001';
const TICKET = 'ab'.repeat(40);

function fakeAdmin() {
  const links = new Map<string, string>(), users = new Map<string, string>(); const calls: string[] = [];
  const a: Admin = {
    async findUserBySteam(s) { return links.get(s) ?? null; },
    async createUser(email) { const id = 'u' + (users.size + 1); users.set(id, email); calls.push('create'); return id; },
    async link(s, u) { links.set(s, u); },
    async touch() { calls.push('touch'); },
    async emailOf(u) { return users.get(u) ?? null; },
    async magicLinkHash(email) { return 'hash:' + email; },
  };
  return { a, calls };
}

describe('đăng nhập Steam', () => {
  it('vé sai định dạng bị chặn trước khi gọi Steam', async () => {
    let called = false;
    await expect(verifyTicket('xyz', env, async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; })).rejects.toThrow('invalid_ticket');
    expect(called).toBe(false);
  });
  it('gửi đúng tham số tới Steam (identity hatchday, appid) và trả SteamID', async () => {
    let url = '';
    const id = await verifyTicket(TICKET, env, async u => { url = u; return ok({ result: 'OK', steamid: SID })(); });
    expect(id).toBe(SID);
    expect(url).toContain('identity=hatchday'); expect(url).toContain('appid=123'); expect(url).toContain('partner.steam-api.com');
  });
  it('Steam từ chối, SteamID lạ, nhà phát hành cấm, mạng lỗi', async () => {
    await expect(verifyTicket(TICKET, env, ok({ result: 'Invalid' }))).rejects.toThrow('ticket_rejected');
    await expect(verifyTicket(TICKET, env, ok({ result: 'OK', steamid: '1' }))).rejects.toThrow('ticket_rejected');
    await expect(verifyTicket(TICKET, env, ok({ result: 'OK', steamid: SID, publisherbanned: true }))).rejects.toThrow('banned');
    await expect(verifyTicket(TICKET, env, async () => ({ ok: false, status: 500, json: async () => ({}) }))).rejects.toBeInstanceOf(AuthError);
  });
  it('lần đầu tạo tài khoản gắn SteamID, lần sau dùng lại đúng tài khoản đó', async () => {
    const { a, calls } = fakeAdmin();
    const r1 = await steamLogin(TICKET, env, ok({ result: 'OK', steamid: SID }), a);
    expect(r1).toEqual({ token_hash: 'hash:' + steamEmail(SID), created: true });
    const r2 = await steamLogin(TICKET, env, ok({ result: 'OK', steamid: SID }), a);
    expect(r2.created).toBe(false); expect(r2.token_hash).toBe(r1.token_hash);
    expect(calls).toEqual(['create', 'touch']);
  });
});
