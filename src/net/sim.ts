/**
 * Bản mô phỏng của nơi chung: nhiều tab cùng nơi thấy nhau (BroadcastChannel) và vài bạn ảo đi lại, thỉnh thoảng làm emote.
 * Dùng ở chế độ Chơi thử và trong test. `?bots=N` trên URL đổi số bạn ảo (mặc định 3, 0 để tắt).
 */
import { EMOTES, PROTO, makeLimiter, parseMsg, type EmoteId, type Peer, type PeerLook } from './protocol';
import { Emitter, throttles, type Room, type Transport } from './transport';

const BOT_LOOKS: (PeerLook & { pid: string })[] = [
  { pid: 'b0000000-0000-4000-8000-000000000001', name: 'Lúa Mạch', family: 'Nhà Lúa', species: 'bong-lua', stage: 'adult', form: 'tron', genes: { hue: 0, ear: 1, scale: 1, region: 0 }, outfit: {}, bond_level: 5 },
  { pid: 'b0000000-0000-4000-8000-000000000002', name: 'Nấm Ngủ', family: 'Nhà Nấm', species: 'nam-ngu', stage: 'teen', form: null, genes: { hue: 0.3, ear: 2, scale: 1, region: 3 }, outfit: {}, bond_level: 3 },
  { pid: 'b0000000-0000-4000-8000-000000000003', name: 'Mây Xanh', family: 'Nhà Mây', species: 'bong-may', stage: 'child', form: null, genes: { hue: -0.2, ear: 0, scale: 1, region: 2 }, outfit: {}, bond_level: 2 },
];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sessionPid = (): string => {
  const mk = () => 'a' + crypto.randomUUID().slice(1);
  try { const k = 'hatchday-sim-pid'; return sessionStorage.getItem(k) || (sessionStorage.setItem(k, mk()), sessionStorage.getItem(k)!); } catch { return mk(); }
};

interface SimOpts { bots?: number; botMs?: number; pid?: string }
type Wire = { t: 'hello'; peer: Peer } | { t: 'bye'; pid: string } | { t: 'ask'; pid: string } | { t: string; pid?: string };

export class SimRoom extends Emitter implements Room {
  readonly cap: number; readonly pid: string;
  private map = new Map<string, Peer & { seen: number; bot?: boolean }>();
  private chan: BroadcastChannel | null; private me: Peer; private timers: ReturnType<typeof setInterval>[] = []; private timeouts: ReturnType<typeof setTimeout>[] = [];
  private th = throttles(); private limit = makeLimiter(); private closed = false;

  constructor(place: string, me: PeerLook & { x: number; z: number }, cap: number, o: SimOpts = {}) {
    super();
    this.cap = cap; this.pid = o.pid ?? sessionPid(); this.me = { ...me, pid: this.pid };
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
    const msg = parseMsg(m); if (!msg || msg.pid === this.pid) return;
    const peer = this.map.get(msg.pid); if (!peer || !this.limit(msg.pid)) return;
    peer.seen = Date.now();
    if (msg.t === 'intent') { peer.x = msg.x; peer.z = msg.z; this.emit('intent', msg.pid, msg.x, msg.z); } else this.emit('emote', msg.pid, msg.id);
  }
  private strip(pid: string): Peer { const { seen: _s, bot: _b, ...p } = this.map.get(pid)!; return p; }
  private drop(pid: string) { if (this.map.delete(pid)) this.emit('leave', pid); }
  private sweep() { const t = Date.now(); for (const [pid, p] of this.map) if (!p.bot && t - p.seen > PROTO.peerTimeoutMs) this.drop(pid); }

  private addBot(look: PeerLook & { pid: string }, every: number) {
    if (this.closed || this.map.has(look.pid) || this.map.size + 1 >= this.cap) return;
    this.map.set(look.pid, { ...look, x: rnd(-4, 4), z: rnd(-1.5, 1.6), seen: Date.now(), bot: true });
    this.emit('join', this.strip(look.pid));
    let nextEmote = Date.now() + rnd(8000, 30000);
    this.timers.push(setInterval(() => {
      const b = this.map.get(look.pid); if (!b || this.closed) return;
      if (Math.random() < 0.6) { b.x = rnd(-4.5, 4.5); b.z = rnd(-1.5, 1.8); this.emit('intent', look.pid, b.x, b.z); }
      if (Date.now() > nextEmote) { nextEmote = Date.now() + rnd(20000, 60000); this.emit('emote', look.pid, EMOTES[Math.floor(Math.random() * EMOTES.length)].id); }
    }, every));
  }

  sendIntent(x: number, z: number) { this.me.x = x; this.me.z = z; if (this.th.intent()) this.post({ t: 'intent', pid: this.pid, x, z } as Wire); }
  sendEmote(id: EmoteId) { if (this.th.emote()) this.post({ t: 'emote', pid: this.pid, id } as Wire); }
  async leave() {
    if (this.closed) return; this.closed = true;
    this.post({ t: 'bye', pid: this.pid }); this.chan?.close();
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
