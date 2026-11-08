/**
 * Lõi đăng nhập Steam, tách khỏi Deno để test bằng Vitest với fetch và Supabase giả.
 * 1. Kiểm vé với Steam (ISteamUserAuth/AuthenticateUserTicket, identity "hatchday") → SteamID đã xác thực.
 * 2. Tìm tài khoản gắn SteamID (bảng steam_accounts); chưa có thì tạo người dùng mới (email nội bộ không nhận thư).
 * 3. Tạo magic link nội bộ → trả token_hash để client gọi auth.verifyOtp lấy phiên. Không bao giờ trả khoá hay mật khẩu.
 */
export interface SteamEnv { webApiKey: string; appId: string }
export interface Admin {
  findUserBySteam(steamId: string): Promise<string | null>;
  createUser(email: string, meta: Record<string, unknown>): Promise<string>;
  link(steamId: string, userId: string): Promise<void>;
  touch(steamId: string): Promise<void>;
  emailOf(userId: string): Promise<string | null>;
  magicLinkHash(email: string): Promise<string>;
}
export type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

export const steamEmail = (steamId: string) => `steam-${steamId}@users.hatchday.noxelis.co`;
export class AuthError extends Error { constructor(public code: string, public status = 400) { super(code); } }

/** Kiểm vé với Steam; trả SteamID64 (chuỗi). */
export async function verifyTicket(ticket: string, env: SteamEnv, fetchFn: Fetch): Promise<string> {
  if (!/^[0-9a-f]{20,4096}$/i.test(ticket)) throw new AuthError('invalid_ticket');
  const u = new URL('https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/');
  u.searchParams.set('key', env.webApiKey); u.searchParams.set('appid', env.appId); u.searchParams.set('ticket', ticket); u.searchParams.set('identity', 'hatchday');
  const res = await fetchFn(u.toString());
  if (!res.ok) throw new AuthError('steam_unreachable', 502);
  const body = await res.json();
  const p = body?.response?.params;
  if (!p || p.result !== 'OK' || !/^\d{17}$/.test(String(p.steamid))) throw new AuthError('ticket_rejected', 401);
  if (p.publisherbanned) throw new AuthError('banned', 403);
  return String(p.steamid);
}

/** Đăng nhập / tạo tài khoản; trả token_hash cho verifyOtp. */
export async function steamLogin(ticket: string, env: SteamEnv, fetchFn: Fetch, admin: Admin): Promise<{ token_hash: string; created: boolean }> {
  const steamId = await verifyTicket(ticket, env, fetchFn);
  let userId = await admin.findUserBySteam(steamId), created = false;
  if (!userId) {
    userId = await admin.createUser(steamEmail(steamId), { provider: 'steam', steam_id: steamId, tos_accepted_at: new Date().toISOString(), tos_version: 'steam' });
    await admin.link(steamId, userId); created = true;
  } else await admin.touch(steamId);
  const email = (await admin.emailOf(userId)) || steamEmail(steamId);
  return { token_hash: await admin.magicLinkHash(email), created };
}
