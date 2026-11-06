/**
 * Realtime thật qua Supabase (kênh riêng tư, chính sách ở 20261208000000_places_realtime.sql). Bật bằng VITE_REALTIME=1.
 * CHƯA thử trên Supabase thật (phiên phát triển không có hai tài khoản để kiểm): xem danh sách kiểm tra trong docs/HANDOFF.md.
 * Luồng: rpc join_place → {topic, cap, pid} → setAuth → channel(private) + presence → shard_roster cho tên/dáng.
 * Presence/người gửi do client khai chỉ để hiển thị; chỉ nhận người có trong shard_roster (máy chủ trả).
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { ChatMsg } from '../game/social';
import { makeLimiter, parseMsg, type EmoteId, type Peer, type PeerLook } from './protocol';
import { Emitter, throttles, type Room, type Transport } from './transport';

type Roster = (PeerLook & { pid: string })[];

class SupaRoom extends Emitter implements Room {
  cap: number; pid: string; readonly topic: string;
  private ch: RealtimeChannel | null = null; private chatCh: RealtimeChannel | null = null; private roster = new Map<string, PeerLook & { pid: string }>(); private live = new Map<string, Peer>();
  private beat: ReturnType<typeof setInterval> | null = null; private lastRoster = 0; private th = throttles(); private limit = makeLimiter(); private me: Peer; private closed = false;
  constructor(topic: string, cap: number, pid: string, me: PeerLook & { x: number; z: number }) { super(); this.topic = topic; this.cap = cap; this.pid = pid; this.me = { ...me, pid }; }

  peers(): Peer[] { return [...this.live.values()]; }

  async start() {
    await this.refreshRoster();
    this.ch = supabase.channel(this.topic, { config: { private: true, broadcast: { self: false, ack: false }, presence: { key: this.pid } } });
    this.ch.on('broadcast', { event: 'intent' }, ({ payload }) => this.recv(payload));
    this.ch.on('broadcast', { event: 'emote' }, ({ payload }) => this.recv(payload));
    this.ch.on('presence', { event: 'sync' }, () => this.syncPresence());
    await new Promise<void>((ok, bad) => {
      const t = setTimeout(() => bad(new Error('realtime_timeout')), 10000);
      this.ch!.subscribe(async status => {
        if (status === 'SUBSCRIBED') { clearTimeout(t); await this.ch!.track({ pid: this.pid, x: this.me.x, z: this.me.z }); ok(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); bad(new Error('realtime_' + status)); }
      });
    });
    // Chat: kênh riêng chỉ nghe (người gửi do máy chủ đóng dấu qua post_chat)
    this.chatCh = supabase.channel('chat:' + this.topic, { config: { private: true } });
    this.chatCh.on('broadcast', { event: 'chat' }, ({ payload }) => {
      const p = payload as Partial<ChatMsg> | null;
      if (p && typeof p.text === 'string' && typeof p.pid === 'string' && typeof p.name === 'string' && p.text.length <= 100 && p.pid !== this.pid) this.emit('chat', { id: Number(p.id) || 0, pid: p.pid, name: p.name.slice(0, 24), text: p.text });
    }).subscribe();
    this.beat = setInterval(() => { void supabase.rpc('place_heartbeat'); }, 40000);
  }
  private async refreshRoster() {
    this.lastRoster = Date.now();
    const { data } = await supabase.rpc('shard_roster', { p_topic: this.topic });
    this.roster = new Map(((data ?? []) as Roster).map(p => [p.pid, p]));
  }
  private syncPresence() {
    if (this.closed || !this.ch) return;
    const state = this.ch.presenceState() as Record<string, { pid?: string; x?: number; z?: number }[]>;
    const now = new Set<string>(); let unknown = false;
    for (const [pid, metas] of Object.entries(state)) {
      if (pid === this.pid) continue;
      const look = this.roster.get(pid);
      if (!look) { unknown = true; continue; } // chưa có trong roster của máy chủ: chưa hiển thị
      now.add(pid);
      const m = metas[metas.length - 1] ?? {};
      const pos = parseMsg({ t: 'intent', pid, x: m.x ?? 0, z: m.z ?? 0 });
      if (!this.live.has(pid)) { const p: Peer = { ...look, x: pos?.t === 'intent' ? pos.x : 0, z: pos?.t === 'intent' ? pos.z : 0 }; this.live.set(pid, p); this.emit('join', p); }
    }
    for (const pid of [...this.live.keys()]) if (!now.has(pid)) { this.live.delete(pid); this.emit('leave', pid); }
    if (unknown && Date.now() - this.lastRoster > 5000) void this.refreshRoster().then(() => this.syncPresence());
  }
  private recv(payload: unknown) {
    const msg = parseMsg(payload); if (!msg || msg.pid === this.pid) return;
    const peer = this.live.get(msg.pid); if (!peer || !this.limit(msg.pid)) return;
    if (msg.t === 'intent') { peer.x = msg.x; peer.z = msg.z; this.emit('intent', msg.pid, msg.x, msg.z); } else this.emit('emote', msg.pid, msg.id);
  }
  sendIntent(x: number, z: number) {
    this.me.x = x; this.me.z = z;
    if (!this.ch || !this.th.intent()) return;
    void this.ch.send({ type: 'broadcast', event: 'intent', payload: { t: 'intent', pid: this.pid, x, z } });
    void this.ch.track({ pid: this.pid, x, z });
  }
  sendEmote(id: EmoteId) { if (this.ch && this.th.emote()) void this.ch.send({ type: 'broadcast', event: 'emote', payload: { t: 'emote', pid: this.pid, id } }); }
  async leave() {
    if (this.closed) return; this.closed = true;
    if (this.beat) clearInterval(this.beat);
    try { await this.ch?.untrack(); await this.ch?.unsubscribe(); await this.chatCh?.unsubscribe(); } catch { /* bỏ qua */ }
    try { await supabase.rpc('leave_place'); } catch { /* máy chủ tự dọn sau 120 giây */ }
    this.live.clear();
  }
}

export const supabaseTransport: Transport = {
  async join(place, me) {
    const { data, error } = await supabase.rpc('join_place', { p_place: place });
    if (error) throw error;
    const info = data as { topic: string; cap: number; pid: string };
    await supabase.realtime.setAuth();
    const room = new SupaRoom(info.topic, info.cap, info.pid, me);
    try { await room.start(); } catch (e) { await room.leave(); throw e; }
    return room;
  },
};
