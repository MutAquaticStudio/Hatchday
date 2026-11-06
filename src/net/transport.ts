/**
 * Truyền tin trong nơi chung. Hai bản cùng giao diện:
 * - SimTransport (src/net/sim.ts): nhiều tab trình duyệt + bạn ảo, dùng ở chế độ Chơi thử và để kiểm thử.
 * - SupabaseTransport (src/net/supabase-transport.ts): Realtime thật, bật bằng VITE_REALTIME=1 (chưa thử trên Supabase thật).
 * Không bật Realtime ở bản thật thì dùng SoloTransport: vào nơi chung nhưng chỉ có mình bạn.
 */
import { isDemo } from '../data/api';
import { PROTO, type EmoteId, type Peer, type PeerLook } from './protocol';

export interface RoomEvents {
  join: (p: Peer) => void;
  leave: (pid: string) => void;
  intent: (pid: string, x: number, z: number) => void;
  emote: (pid: string, id: EmoteId) => void;
}
export interface Room {
  /** Sức chứa của kênh. */
  readonly cap: number;
  /** Mã công khai của mình trong kênh. */
  readonly pid: string;
  peers(): Peer[];
  on<K extends keyof RoomEvents>(ev: K, fn: RoomEvents[K]): () => void;
  /** Gửi ý định đi tới (x, z). Tự giãn cách theo PROTO.intentMinMs; gọi nhiều cũng được. */
  sendIntent(x: number, z: number): void;
  sendEmote(id: EmoteId): void;
  leave(): Promise<void>;
}
export interface Transport { join(place: string, me: PeerLook & { x: number; z: number }): Promise<Room> }

/** Bộ phát sự kiện nhỏ dùng chung cho các Room. */
export class Emitter {
  private fns: { [K in keyof RoomEvents]: Set<RoomEvents[K]> } = { join: new Set(), leave: new Set(), intent: new Set(), emote: new Set() };
  on<K extends keyof RoomEvents>(ev: K, fn: RoomEvents[K]) { (this.fns[ev] as Set<RoomEvents[K]>).add(fn); return () => { (this.fns[ev] as Set<RoomEvents[K]>).delete(fn); }; }
  emit<K extends keyof RoomEvents>(ev: K, ...a: Parameters<RoomEvents[K]>) { for (const f of this.fns[ev] as Set<(...x: Parameters<RoomEvents[K]>) => void>) f(...a); }
}

/** Giới hạn gửi: bỏ qua tin nếu chưa đủ giãn cách. */
export function makeThrottle(ms: number, now: () => number = Date.now) {
  let last = -Infinity;
  return (): boolean => { const t = now(); if (t - last < ms) return false; last = t; return true; };
}
export const throttles = () => ({ intent: makeThrottle(PROTO.intentMinMs), emote: makeThrottle(PROTO.emoteMinMs) });

class SoloRoom extends Emitter implements Room {
  readonly cap = 1; readonly pid = 'solo';
  peers() { return []; }
  sendIntent() {} sendEmote() {}
  async leave() {}
}
export const soloTransport: Transport = { join: async () => new SoloRoom() };

/** Chọn bản truyền tin theo môi trường. Nạp lười để bản không dùng không vào gói tải. */
export async function createTransport(): Promise<Transport> {
  if (isDemo) return (await import('./sim')).simTransport;
  if (import.meta.env.VITE_REALTIME === '1') return (await import('./supabase-transport')).supabaseTransport;
  return soloTransport;
}
