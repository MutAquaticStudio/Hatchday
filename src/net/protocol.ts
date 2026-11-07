/**
 * Giao thức tin nhắn trong nơi chung. Mọi bên nhận phải qua parseMsg: bỏ tin hỏng, quá lớn, toạ độ ngoài sân, emote lạ.
 * Chat gõ chữ KHÔNG đi qua đây (xem PLAN-social-admin, mục D): người gửi chat do máy chủ đóng dấu.
 */
export const PROTO = {
  v: 1,
  /** Giãn cách tối thiểu giữa hai lần gửi ý định đi và hai emote (ms), theo ngân sách tin của Realtime gói Free. */
  intentMinMs: 1500, emoteMinMs: 3000,
  /** Sân tối đa theo mỗi trục (toạ độ thế giới). */
  bound: 12,
  /** Quá số tin/giây từ một người thì bỏ qua. */
  maxPerSec: 5,
  maxBytes: 512,
  peerTimeoutMs: 15000, beatMs: 5000,
} as const;

/** Tám emote. Chọn bằng nút, không gõ tự do. */
export const EMOTES = [
  { id: 'wave', e: '👋', label: 'Chào' }, { id: 'heart', e: '❤️', label: 'Thương' }, { id: 'laugh', e: '😂', label: 'Cười' }, { id: 'star', e: '⭐', label: 'Tuyệt' },
  { id: 'cheer', e: '🎉', label: 'Hoan hô' }, { id: 'sleepy', e: '😴', label: 'Buồn ngủ' }, { id: 'sad', e: '😢', label: 'Buồn' }, { id: 'hungry', e: '🍙', label: 'Đói' },
] as const;
export type EmoteId = (typeof EMOTES)[number]['id'];

/** Việc bé đang làm ở nơi chung (xích đu, ghế đá, sân khấu…): người khác thấy biểu tượng nổi trên đầu bé. Tự gửi khi bé làm xong một tương tác, không phải nút bấm. */
export const ACTS = [
  { id: 'swing', e: '🎠', text: 'đang đu xích đu' }, { id: 'seesaw', e: '⚖️', text: 'đang chơi bập bênh' }, { id: 'slide', e: '🛝', text: 'đang trượt cầu trượt' },
  { id: 'ducks', e: '🦆', text: 'đang cho vịt ăn' }, { id: 'ball', e: '⚽', text: 'đang đá bóng' }, { id: 'bench', e: '🪑', text: 'đang ngồi nghỉ' },
  { id: 'fountain', e: '⛲', text: 'đang nghịch nước' }, { id: 'stage', e: '🎤', text: 'đang biểu diễn' }, { id: 'tea', e: '🍵', text: 'đang nhấp trà' }, { id: 'cat', e: '🐈', text: 'đang vuốt mèo' },
] as const;
export type ActId = (typeof ACTS)[number]['id'];
export const isAct = (id: unknown): id is ActId => ACTS.some(a => a.id === id);
export const actChar = (id: string) => ACTS.find(a => a.id === id)?.e ?? '';
export const actText = (id: string) => ACTS.find(a => a.id === id)?.text ?? '';
export const isEmote = (id: unknown): id is EmoteId => EMOTES.some(e => e.id === id);
export const emoteChar = (id: string) => EMOTES.find(e => e.id === id)?.e ?? '';

export interface PeerLook { name: string; family?: string | null; species: string; stage: string; form: string | null; genes: Record<string, unknown>; outfit: Record<string, string>; bond_level: number }
export interface Peer extends PeerLook { pid: string; x: number; z: number }

export type NetMsg =
  | { t: 'intent'; pid: string; x: number; z: number }
  | { t: 'emote'; pid: string; id: EmoteId }
  | { t: 'act'; pid: string; id: ActId };

const PID = /^[0-9a-f-]{8,40}$/i;
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Kiểm một tin thô. Trả về null nếu không hợp lệ. Toạ độ được kẹp vào sân. */
export function parseMsg(raw: unknown): NetMsg | null {
  if (!raw || typeof raw !== 'object') return null;
  try { if (JSON.stringify(raw).length > PROTO.maxBytes) return null; } catch { return null; }
  const m = raw as Record<string, unknown>;
  if (typeof m.pid !== 'string' || !PID.test(m.pid)) return null;
  const b = PROTO.bound;
  if (m.t === 'intent' && num(m.x) && num(m.z)) return { t: 'intent', pid: m.pid, x: Math.max(-b, Math.min(b, m.x as number)), z: Math.max(-b, Math.min(b, m.z as number)) };
  if (m.t === 'emote' && isEmote(m.id)) return { t: 'emote', pid: m.pid, id: m.id };
  if (m.t === 'act' && isAct(m.id)) return { t: 'act', pid: m.pid, id: m.id };
  return null;
}

/** Bộ lọc tốc độ cho tin đến: tối đa PROTO.maxPerSec tin mỗi giây cho mỗi người gửi. */
export function makeLimiter(now: () => number = Date.now) {
  const seen = new Map<string, number[]>();
  return (pid: string): boolean => {
    const t = now(), a = (seen.get(pid) ?? []).filter(x => t - x < 1000);
    if (a.length >= PROTO.maxPerSec) { seen.set(pid, a); return false; }
    a.push(t); seen.set(pid, a); return true;
  };
}
