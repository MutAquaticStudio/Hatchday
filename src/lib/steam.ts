/**
 * Steam ở phía game (bản Steam): đăng nhập bằng tài khoản Steam, thành tựu, trạng thái hiện cho bạn bè Steam (Rich Presence).
 * Đăng nhập: Electron lấy vé Web API → Edge Function `steam-auth` kiểm vé với Steam, tạo/tìm tài khoản gắn SteamID
 * và trả token_hash → supabase.auth.verifyOtp tạo phiên. Không có Steam thì mọi hàm là no-op.
 */
import { supabase, isConfigured } from './supabase';
import { desktop, isSteam } from './platform';
import { earnedAchievements, type AchievementInput } from '../game/achievements';

export const steam = isSteam ? desktop?.steam : undefined;
export const steamReady = (): boolean => !!steam?.available;
export const canSteamLogin = (): boolean => steamReady() && isConfigured;

export class SteamLoginError extends Error {}

/** Đăng nhập bằng Steam. Ném SteamLoginError (mã lỗi trong message) khi không được. */
export async function steamSignIn(): Promise<void> {
  if (!canSteamLogin()) throw new SteamLoginError('steam_unavailable');
  const ticket = await steam!.ticket();
  if (!ticket) throw new SteamLoginError('steam_ticket');
  const { data, error } = await supabase.functions.invoke('steam-auth', { body: { ticket } });
  if (error || !data?.token_hash) throw new SteamLoginError(String((data && data.error) || error?.message || 'steam_auth'));
  const v = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
  if (v.error) throw new SteamLoginError(v.error.message);
}

const done = new Set<string>();
/** Mở khoá các thành tựu đã đạt (gọi lại an toàn; chỉ gửi những cái chưa gửi trong phiên này). */
export function syncAchievements(s: AchievementInput): void {
  if (!steamReady()) return;
  for (const id of earnedAchievements(s)) if (!done.has(id)) { done.add(id); void steam!.achieve(id); }
}

/** Trạng thái hiện trong danh sách bạn bè Steam. `place` là mã nơi (home, plaza, park…) khớp tệp rich presence. */
export function setPresence(place: string): void {
  if (!steamReady()) return;
  void steam!.presence('place', place);
  void steam!.presence('steam_display', '#Status_' + place.replace(/[^a-z_]/g, ''));
}
