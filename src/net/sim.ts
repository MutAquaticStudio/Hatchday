/**
 * Bản mô phỏng của nơi chung: nhiều tab cùng nơi thấy nhau (BroadcastChannel) và vài bạn ảo đi lại, thỉnh thoảng làm emote.
 * Dùng ở chế độ Chơi thử và trong test. `?bots=N` trên URL đổi số bạn ảo (mặc định 3, 0 để tắt).
 */
import { EMOTES, PROTO, makeLimiter, parseMsg, type ActId, type EmoteId, type Peer, type PeerLook } from './protocol';
import { CHAT, filterChat, CHAT_REASON_TEXT } from './moderation';
import type { ChatMsg, ChatReply } from '../game/social';
import { Emitter, throttles, type Room, type Transport } from './transport';

const BOT_LOOKS: (PeerLook & { pid: string })[] = [
  { pid: 'b0000000-0000-4000-8000-000000000001', name: 'Lúa Mạch', family: 'Nhà Lúa', species: 'bong-lua', stage: 'adult', form: 'tron', genes: { hue: 0, ear: 1, scale: 1, region: 0 }, outfit: {}, bond_level: 5 },
  { pid: 'b0000000-0000-4000-8000-000000000002', name: 'Nấm Ngủ', family: 'Nhà Nấm', species: 'nam-ngu', stage: 'teen', form: null, genes: { hue: 0.3, ear: 2, scale: 1, region: 3 }, outfit: {}, bond_level: 3 },
  { pid: 'b0000000-0000-4000-8000-000000000003', name: 'Mây Xanh', family: 'Nhà Mây', species: 'bong-may', stage: 'child', form: null, genes: { hue: -0.2, ear: 0, scale: 1, region: 2 }, outfit: {}, bond_level: 2 },
];
const BOT_LINES = ['Chào cả nhà!', 'Hôm nay bé nhà mình vui lắm', 'Ai muốn kết bạn không?', 'Bé của mình thích ăn cà rốt', 'Trời đẹp quá ha', 'Mình mới lên cấp Gắn bó nè', 'Cho vịt ăn thử đi mọi người', 'Hihi 😊', 'Quán trà thơm lắm đó'];
/** Bạn ảo làm gì ở từng nơi (cho Chơi thử). */
const ACTS_BY_PLACE: Record<string, ActId[]> = { plaza: ['bench', 'fountain', 'stage'], park: ['swing', 'seesaw', 'slide', 'ducks', 'ball'], tea: ['tea', 'cat'] };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sessionPid = (): string => {
  const mk = () => 'a' + crypto.randomUUID().slice(1);
  try { const k = 'hatchday-sim-pid'; return sessionStorage.getItem(k) || (sessionStorage.setItem(k, mk()), sessionStorage.getItem(k)!); } catch { return mk(); }
};

const rooms = new Map<string, SimRoom>();
interface SimOpts { bots?: number; botMs?: number; pid?: string }
type Wire = { t: 'hello'; peer: Peer } | { t: 'bye'; pid: string } | { t: 'ask'; pid: string } | { t: string; pid?: string };

/** Vùng bạn ảo đi lại theo từng nơi (khớp vùng đi của địa điểm trong registry.ts, thu nhỏ một chút). */
const SIM_AREA: Record<string, { x: [number, number]; z: [number, number] }> = { plaza: { x: [-15, 15], z: [-5, 7] }, park: { x: [-15, 15], z: [-4, 7] }, tea: { x: [-4.2, 4.2], z: [-0.8, 3.4] } };

export class SimRoom extends Emitter implements Room {
  readonly cap: number; readonly pid: string; readonly topic: string; private area: { x: [number, number]; z: [number, number] };
  private map = new Map<string, Peer & { seen: number; bot?: boolean }>();
  private chan: BroadcastChannel | null; private me: Peer; private timers: ReturnType<typeof setInterval>[] = []; private timeouts: ReturnType<typeof setTimeout>[] = [];
  private th = throttles(); private limit = makeLimiter(); private closed = false;

  constructor(place: string, me: PeerLook & { x: number; z: number }, cap: number, o: SimOpts = {}) {
    super();
    this.area = SIM_AREA[place] ?? SIM_AREA.tea;
    this.cap = cap; this.pid = o.pid ?? sessionPid(); this.me = { ...me, pid: this.pid }; this.topic = place + ':1'; rooms.set(this.topic, this);
    this.chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hatchday-sim:' + place) : null;
    if (this.chan) this.chan.onmessage = ev => this.recv(ev.data as Wire);
    this.post({ t: 'hello', peer: this.me }); this.post({ t: 'ask', pid: this.pid });
    this.timers.push(setInterval(() => this.post({ t: 'hello', peer: this.me }), PROTO.beatMs));
    this.timers.push(setInterval(() => this.sweep(), 2000));
    const nBots = Math.min(o.bots ?? 3, BOT_LOOKS.length, cap - 1);
    for (let i = 0; i < nBots; i++) this.timeouts.push(setTimeout(() => this.addBot(BOT_LOOKS[i], o.botMs ?? 1600), 500 + i * 700));
  }
  private post(m: Wire) { try { this.chan?.postMessage(m); } catch { /* kênh đã đóng */ } }
  peers(): Peer[] { return [...this.map.values()].map(({ seen: _s, bot: _b, ...p }) => p); }

  private recv(m: Wire) {
    if (this.closed || !m || typeof m !== 'object') return;
    if (m.t === 'ask') { if (m.pid !== this.pid) this.post({ t: 'hello', peer: this.me }); return; }
    if (m.t === 'bye') { this.drop(String((m as { pid: string }).pid)); return; }
    if (m.t === 'hello') {
      const p = (m as { peer: Peer }).peer; if (!p || typeof p.pid !== 'string' || p.pid === this.pid) return;
      const known = this.map.get(p.pid);
      if (!known && this.map.size + 1 >= this.cap) return;
      this.map.set(p.pid, { ...p, seen: Date.now() });
      if (!known) this.emit('join', this.strip(p.pid));
      return;
    }
    if (m.t === 'chat') { const c = (m as unknown as { msg: ChatMsg }).msg; if (c && typeof c.text === 'string' && c.text.length <= CHAT.maxLen && typeof c.name === 'string' && typeof c.pid === 'string' && c.pid !== this.pid && this.map.has(c.pid)) this.emit('chat', { id: +c.id || Date.now(), pid: c.pid, name: c.name.slice(0, 24), text: c.text }); return; }
    const msg = parseMsg(m); if (!msg || msg.pid === this.pid) return;
    const peer = this.map.get(msg.pid); if (!peer || !this.limit(msg.pid)) return;
    peer.seen = Date.now();
    if (msg.t === 'intent') { peer.x = msg.x; peer.z = msg.z; this.emit('intent', msg.pid, msg.x, msg.z); } else if (msg.t === 'act') this.emit('act', msg.pid, msg.id); else this.emit('emote', msg.pid, msg.id);
  }
  private strip(pid: string): Peer { const { seen: _s, bot: _b, ...p } = this.map.get(pid)!; return p; }
  private drop(pid: string) { if (this.map.delete(pid)) this.emit('leave', pid); }
  private sweep() { const t = Date.now(); for (const [pid, p] of this.map) if (!p.bot && t - p.seen > PROTO.peerTimeoutMs) this.drop(pid); }

  private addBot(look: PeerLook & { pid: string }, every: number) {
    if (this.closed || this.map.has(look.pid) || this.map.size + 1 >= this.cap) return;
    const A = this.area; this.map.set(look.pid, { ...look, x: rnd(A.x[0] * 0.8, A.x[1] * 0.8), z: rnd(A.z[0], A.z[1]), seen: Date.now(), bot: true });
    this.emit('join', this.strip(look.pid));
    let nextAct = Date.now() + rnd(6000, 20000), nextEmote = Date.now() + rnd(8000, 30000), nextChat = Date.now() + rnd(10000, 30000);
    this.timers.push(setInterval(() => {
      const b = this.map.get(look.pid); if (!b || this.closed) return;
      if (Math.random() < 0.6) { b.x = rnd(this.area.x[0], this.area.x[1]); b.z = rnd(this.area.z[0], this.area.z[1]); this.emit('intent', look.pid, b.x, b.z); }
      if (Date.now() > nextEmote) { nextEmote = Date.now() + rnd(20000, 60000); this.emit('emote', look.pid, EMOTES[Math.floor(Math.random() * EMOTES.length)].id); }
      if (Date.now() > nextAct) { nextAct = Date.now() + rnd(15000, 45000); const pool = ACTS_BY_PLACE[this.topic.split(':')[0]]; if (pool) this.emit('act', look.pid, pool[Math.floor(Math.random() * pool.length)]); }
      if (Date.now() > nextChat) { nextChat = Date.now() + rnd(25000, 70000); this.emit('chat', { id: Date.now(), pid: look.pid, name: look.name, text: BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)] }); }
    }, every));
  }

  /** Chat của chính mình (bản mô phỏng của post_chat): hiện ở tab này và gửi sang các tab khác cùng nơi. */
  chat(text: string) { const m: ChatMsg = { id: Date.now(), pid: this.pid, name: this.me.name, text }; this.emit('chat', m); this.post({ t: 'chat', pid: this.pid, msg: m } as unknown as Wire); return m; }

  sendIntent(x: number, z: number) { this.me.x = x; this.me.z = z; if (this.th.intent()) this.post({ t: 'intent', pid: this.pid, x, z } as Wire); }
  sendEmote(id: EmoteId) { if (this.th.emote()) this.post({ t: 'emote', pid: this.pid, id } as Wire); }
  sendAct(id: ActId) { if (this.th.act()) this.post({ t: 'act', pid: this.pid, id } as Wire); }
  async leave() {
    if (this.closed) return; this.closed = true;
    this.post({ t: 'bye', pid: this.pid }); this.chan?.close(); if (rooms.get(this.topic) === this) rooms.delete(this.topic);
    this.timers.forEach(clearInterval); this.timeouts.forEach(clearTimeout); this.map.clear();
  }
}

const CAPS: Record<string, number> = { plaza: 12, tea: 16, park: 16 };
export const simTransport: Transport = {
  async join(place, me) {
    let bots = 3; try { const q = new URLSearchParams(location.search).get('bots'); if (q !== null) bots = Math.max(0, Math.min(3, +q || 0)); } catch { /* không có location */ }
    return new SimRoom(place, me, CAPS[place] ?? 12, { bots });
  },
};

/** Bản mô phỏng của RPC post_chat: lọc như máy chủ (không có từ khoá), giãn cách 2 giây, rồi phát vào kênh. */
let lastChatAt = 0;
export async function simPostChat(topic: string, text: string): Promise<ChatReply> {
  const room = rooms.get(topic); if (!room) throw new Error('not_in_place');
  const f = filterChat(text);
  if (!f.ok) return { ok: false, reason: f.reason ?? 'filtered' };
  if (Date.now() - lastChatAt < 700) throw new Error('rate_limited');
  lastChatAt = Date.now(); const m = room.chat(f.text);
  return { ok: true, id: m.id, text: f.text };
}
export { CHAT_REASON_TEXT };
