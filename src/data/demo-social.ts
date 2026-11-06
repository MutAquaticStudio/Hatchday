/**
 * Chế độ Chơi thử: mô phỏng các RPC xã hội (bạn bè, hộp thư, quà, tin tức, thăm nhà) với vài bạn ảo, lưu trong trình duyệt.
 * Luật giống supabase/migrations/20261203..20261205 (hạn mức, giới hạn ngày, mã lỗi). Khác bản thật ở hai điểm, để xem thử luồng được:
 * tài khoản không bị chặn tặng quà vì còn mới (account_too_new), và bạn ảo tự đồng ý lời mời sau vài giây.
 */
import { BY_ID, FOODS } from '../game/catalog';
import { bondLevel } from '../game/bond';
import { MEDICINES } from '../game/health';
import { localDay } from '../game/rules';
import { friendCap, GIFT_NOTES, GUESTBOOK, isGiftable, SOCIAL, stockCap, type MailRow, type NewsRow, type PublicProfile, type SocialState, type SocialSummary, type VisitData } from '../game/social';
import { withDB } from './demo-api';

const KEY = 'hatchday-demo-social';
const DAY = 86400000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface Bot { pid: string; code: string; name: string; family: string; species: string; stage: string; form: string | null; bond: number; plots: { plot: number; crop: string; ready: boolean; waters: number }[] }
/** Bạn ảo. Mã bạn bè dùng được ở ô "Thêm bạn" của bản thử. */
export const DEMO_BOTS: Bot[] = [
  { pid: 'b0000000-0000-4000-8000-000000000001', code: 'LUAMACH4', name: 'Lúa Mạch', family: 'Nhà Lúa', species: 'bong-lua', stage: 'adult', form: 'tron', bond: 5, plots: [{ plot: 0, crop: 'carot', ready: false, waters: 0 }, { plot: 1, crop: 'dua-hau', ready: false, waters: 1 }, { plot: 2, crop: 'chuoi', ready: true, waters: 0 }] },
  { pid: 'b0000000-0000-4000-8000-000000000002', code: 'NAMNGU22', name: 'Nấm Ngủ', family: 'Nhà Nấm', species: 'nam-ngu', stage: 'teen', form: null, bond: 3, plots: [{ plot: 0, crop: 'carot', ready: false, waters: 0 }] },
  { pid: 'b0000000-0000-4000-8000-000000000003', code: 'MAYXANH3', name: 'Mây Hồng', family: 'Nhà Mây', species: 'bong-may', stage: 'child', form: null, bond: 2, plots: [] },
];
const botBy = (who: string) => DEMO_BOTS.find(b => b.code === who.trim().toUpperCase() || b.pid === who.trim().toLowerCase());

interface Stored extends MailRow { /* thư đã lưu, claimed là cờ */ }
interface SD {
  code: string; privacy: { friends: string; online: string };
  friends: { pid: string; since: number }[]; incoming: string[]; outgoing: { pid: string; at: number }[]; blocks: string[];
  mail: Stored[]; nextMail: number; read: number[];
  visits: { pid: string; kind: 'stroke' | 'water' | 'note'; plot?: number; emote?: string; day: string }[];
  gifts: { to: string; day: string }[]; botPlots: Record<string, { waters: number; at: number }>;
}

function seed(): SD {
  const now = Date.now(), iso = (t: number) => new Date(t).toISOString();
  const code = Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  return {
    code, privacy: { friends: 'all', online: 'friends' },
    friends: [{ pid: DEMO_BOTS[0].pid, since: now - 10 * DAY }], incoming: [DEMO_BOTS[1].pid], outgoing: [], blocks: [],
    mail: [
      { id: 1, kind: 'system', title: 'Chào mừng đến Hatchday', body: 'Quà làm quen cho bạn và bé. Chúc hai bạn có những ngày thật vui!', items: [], coins: 30, from: null, created_at: iso(now - 3600000), expires_at: iso(now + 30 * DAY), claimed: false },
      { id: 2, kind: 'gift', title: 'Quà từ Lúa Mạch', body: 'Chúc bé của bạn vui!', items: [{ id: 'carot', qty: 2 }], coins: 0, from: 'Lúa Mạch', created_at: iso(now - 7200000), expires_at: iso(now + 30 * DAY), claimed: false },
    ],
    nextMail: 3, read: [],
    visits: [],
    gifts: [], botPlots: {},
  };
}
const load = (): SD => { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null') as SD | null; if (d) return d; } catch { /* bỏ qua */ } const s = seed(); save(s); return s; };
const save = (d: SD) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* bỏ qua */ } };
const fail = (code: string): never => { throw new Error(code); };

const NEWS: Omit<NewsRow, 'read'>[] = [
  { id: 1, kind: 'update', title: 'Bản đồ thế giới đã mở', body: 'Bé đã đi chợ, tới bệnh viện, tiệm may và thư viện được rồi. Mở khoá thêm nơi mới khi tăng cấp Gắn bó.', pinned: true, starts_at: new Date(Date.now() - 2 * DAY).toISOString(), ends_at: null },
  { id: 2, kind: 'notice', title: 'Chào bạn mới', body: 'Đây là bản Chơi thử. Bạn bè và quà tặng là bạn ảo; khi chơi bằng tài khoản thật, bạn sẽ gặp người chơi khác.', pinned: false, starts_at: new Date(Date.now() - DAY).toISOString(), ends_at: null },
];

function profile(b: Bot): PublicProfile {
  return { pid: b.pid, name: b.name, family: b.family, species: b.species, stage: b.stage, form: b.form, genes: { hue: 0, ear: 1, scale: 1, region: 0 }, outfit: {}, bond_level: b.bond };
}
/** Bạn ảo tự đồng ý lời mời sau 15 giây (để xem được luồng). */
function tickBots(d: SD) {
  const now = Date.now();
  for (const o of [...d.outgoing]) if (now - o.at > 15000) { d.outgoing = d.outgoing.filter(x => x.pid !== o.pid); if (!d.friends.some(f => f.pid === o.pid)) d.friends.push({ pid: o.pid, since: now }); }
}
const myLevel = () => withDB(db => bondLevel(db.pet?.bond_xp ?? 0));
const hasPet = () => withDB(db => !!db.pet && db.pet.stage !== 'departed');
const isFriend = (d: SD, pid: string) => d.friends.some(f => f.pid === pid);
const rewardedToday = (d: SD, day: string) => d.visits.filter(v => v.day === day && (v.kind === 'stroke' || v.kind === 'water')).length;
const resolve = (who: string): Bot => botBy(who) ?? fail('not_found');

export async function getSocialState(): Promise<SocialState> {
  if (!hasPet()) return { ready: false };
  const d = load(); tickBots(d); save(d);
  return { ready: true, friend_code: d.code, pid: 'me', privacy: d.privacy, friends: d.friends.length, cap: friendCap(myLevel()), requests_in: d.incoming.length, requests_out: d.outgoing.length };
}
export async function getSocialSummary(): Promise<SocialSummary> {
  const d = load(); tickBots(d); save(d); const now = Date.now();
  return { mail_unread: d.mail.filter(m => !m.claimed && Date.parse(m.expires_at) > now).length, news_unread: NEWS.filter(n => !d.read.includes(n.id)).length, requests_in: d.incoming.length, events_version: 0 };
}
export async function setPrivacy(key: string, value: string) {
  if (!((key === 'friends' && ['all', 'none'].includes(value)) || (key === 'online' && ['friends', 'none'].includes(value)))) fail('invalid_privacy');
  const d = load(); (d.privacy as Record<string, string>)[key] = value; save(d); return d.privacy;
}
export async function findByCode(who: string): Promise<PublicProfile> {
  const d = load(), b = resolve(who);
  if (d.blocks.includes(b.pid)) fail('not_found');
  return { ...profile(b), friend: isFriend(d, b.pid) };
}
export async function sendFriendRequest(who: string) {
  const d = load(), b = botBy(who); if (!b) fail('not_found');
  const bot = b as Bot;
  if (d.blocks.includes(bot.pid)) fail('blocked');
  if (isFriend(d, bot.pid)) fail('already_friends');
  if (d.outgoing.some(o => o.pid === bot.pid)) fail('already_requested');
  if (d.friends.length >= friendCap(myLevel())) fail('friend_cap');
  if (d.outgoing.length >= SOCIAL.maxPendingRequests) fail('too_many_requests');
  if (d.incoming.includes(bot.pid)) { d.incoming = d.incoming.filter(x => x !== bot.pid); d.friends.push({ pid: bot.pid, since: Date.now() }); save(d); return { status: 'accepted' as const }; }
  d.outgoing.push({ pid: bot.pid, at: Date.now() }); save(d); return { status: 'pending' as const };
}
export async function respondFriendRequest(who: string, accept: boolean) {
  const d = load(), b = resolve(who);
  if (!d.incoming.includes(b.pid)) fail('not_found');
  d.incoming = d.incoming.filter(x => x !== b.pid);
  if (!accept) { save(d); return { status: 'declined' }; }
  if (d.friends.length >= friendCap(myLevel())) fail('friend_cap');
  d.friends.push({ pid: b.pid, since: Date.now() }); save(d); return { status: 'accepted' };
}
export async function removeFriend(who: string) { const d = load(), b = resolve(who); d.friends = d.friends.filter(f => f.pid !== b.pid); save(d); }
export async function blockUser(who: string) { const d = load(), b = resolve(who); d.friends = d.friends.filter(f => f.pid !== b.pid); d.incoming = d.incoming.filter(x => x !== b.pid); if (!d.blocks.includes(b.pid)) d.blocks.push(b.pid); save(d); }
export async function unblockUser(who: string) { const d = load(), b = resolve(who); d.blocks = d.blocks.filter(x => x !== b.pid); save(d); }
export async function listFriends(): Promise<PublicProfile[]> {
  const d = load(); tickBots(d); save(d);
  return [...d.friends].sort((a, b) => b.since - a.since).map(f => ({ ...profile(DEMO_BOTS.find(x => x.pid === f.pid)!), since: new Date(f.since).toISOString() }));
}
export async function listRequests() {
  const d = load(); tickBots(d); save(d);
  const p = (pid: string) => profile(DEMO_BOTS.find(x => x.pid === pid)!);
  return { incoming: d.incoming.map(p), outgoing: d.outgoing.map(o => p(o.pid)) };
}

/* ---------- Hộp thư ---------- */
export async function getInbox() {
  const d = load(), now = Date.now();
  return { mail: d.mail.filter(m => Date.parse(m.expires_at) > now).sort((a, b) => Number(a.claimed) - Number(b.claimed) || Date.parse(b.created_at) - Date.parse(a.created_at)) };
}
const kindOf = (id: string) => (FOODS.some(f => f.id === id) ? 'food' : MEDICINES.some(m => m.id === id) ? 'medicine' : BY_ID[id]?.kind ?? 'decor');
function claimOne(d: SD, id: number): { items: { id: string; qty: number }[]; coins: number; wallet: number } {
  const m = d.mail.find(x => x.id === id); if (!m) fail('not_found');
  const mail = m as Stored;
  if (mail.claimed) fail('already_claimed');
  if (Date.parse(mail.expires_at) <= Date.now()) fail('expired');
  return withDB((db, earn) => {
    for (const it of mail.items) if ((db.owned[it.id] || 0) + it.qty > stockCap(kindOf(it.id))) fail('stock_full');
    for (const it of mail.items) db.owned[it.id] = (db.owned[it.id] || 0) + it.qty;
    if (mail.coins > 0) earn(mail.coins);
    mail.claimed = true;
    return { items: mail.items, coins: mail.coins, wallet: db.coins };
  });
}
export async function claimMail(id: number) { const d = load(); const r = claimOne(d, id); save(d); return r; }
export async function claimAllMail() {
  const d = load(); let ok = 0, skipped = 0;
  for (const m of d.mail.filter(x => !x.claimed && Date.parse(x.expires_at) > Date.now()).slice(0, 50)) { try { claimOne(d, m.id); ok++; } catch { skipped++; } }
  save(d); return { claimed: ok, skipped, wallet: withDB(db => db.coins) };
}
export async function deleteMail(id: number) {
  const d = load(), m = d.mail.find(x => x.id === id);
  if (!m || !(m.claimed || m.kind === 'system')) fail('not_found');
  d.mail = d.mail.filter(x => x.id !== id); save(d);
}

/* ---------- Quà ---------- */
export async function sendGift(who: string, items: { id: string; qty: number }[], note: string | null) {
  const d = load(), b = resolve(who);
  if (d.blocks.includes(b.pid)) fail('blocked');
  const f = d.friends.find(x => x.pid === b.pid); if (!f) fail('not_friends');
  if (Date.now() - (f as { since: number }).since < SOCIAL.friendDaysForGift * DAY) fail('too_new_friend');
  if (note && !(GIFT_NOTES as readonly string[]).includes(note)) fail('invalid_note');
  if (!Array.isArray(items) || items.length < 1 || items.length > SOCIAL.giftMaxItems) fail('invalid_items');
  let total = 0;
  for (const it of items) {
    if (!(it.qty >= 1)) fail('invalid_items');
    const kind = kindOf(it.id), meta = BY_ID[it.id];
    const ok = FOODS.some(x => x.id === it.id) || MEDICINES.some(x => x.id === it.id) || (!!meta && isGiftable({ kind: meta.kind, layer: meta.layer, source: meta.source }));
    if (!ok) fail('not_giftable');
    void kind; total += it.qty;
  }
  if (total > SOCIAL.giftMaxItems) fail('invalid_items');
  const day = localDay();
  if (d.gifts.filter(g => g.day === day).length >= SOCIAL.giftsPerDay) fail('gift_limit');
  if (d.gifts.some(g => g.day === day && g.to === b.pid)) fail('gift_limit_friend');
  withDB(db => {
    for (const it of items) if ((db.owned[it.id] || 0) < it.qty) fail('not_owned');
    for (const it of items) db.owned[it.id] -= it.qty;
  });
  d.gifts.push({ to: b.pid, day }); save(d);
  return { id: d.gifts.length };
}

/* ---------- Tin tức ---------- */
export async function getNews(): Promise<NewsRow[]> { const d = load(); return NEWS.map(n => ({ ...n, read: d.read.includes(n.id) })).sort((a, b) => Number(b.pinned) - Number(a.pinned)); }
export async function markNewsRead(id: number) { const d = load(); if (NEWS.some(n => n.id === id) && !d.read.includes(id)) d.read.push(id); save(d); }

/* ---------- Thăm nhà bạn ---------- */
function friendOrFail(d: SD, who: string): Bot {
  const b = resolve(who);
  if (d.blocks.includes(b.pid)) fail('blocked');
  if (!isFriend(d, b.pid)) fail('not_friends');
  return b;
}
const botPlots = (d: SD, b: Bot) => b.plots.map(p => ({ ...p, waters: p.waters + (d.botPlots[`${b.pid}:${p.plot}`]?.waters || 0) }));
export async function getVisit(who: string): Promise<VisitData> {
  const d = load(), b = friendOrFail(d, who), day = localDay();
  return {
    profile: profile(b),
    room: { wallpaper: 'giay-cham-hong', flooring: 'san-go', items: [{ id: 'tham-tron', c: 2, r: 2, rot: 0 }, { id: 'o-rom', c: 0, r: 0, rot: 0 }, { id: 'chau-cay', c: 7, r: 0, rot: 0 }, { id: 'bong', c: 6, r: 4, rot: 0 }] },
    farm: null, parcels: [{ parcel: 0, level: 0 }],
    plots: botPlots(d, b).map(p => ({
      plot: p.plot, crop: p.crop, ready: p.ready, waters: p.waters,
      can_help: !p.ready && p.waters < 3 && !d.visits.some(v => v.pid === b.pid && v.kind === 'water' && v.plot === p.plot && v.day === day),
    })),
    today: { stroked: d.visits.some(v => v.pid === b.pid && v.kind === 'stroke' && v.day === day), noted: d.visits.some(v => v.pid === b.pid && v.kind === 'note' && v.day === day), rewarded: rewardedToday(d, day) },
  };
}
export async function strokeFriend(who: string) {
  const d = load(), b = friendOrFail(d, who), day = localDay();
  if (d.visits.some(v => v.pid === b.pid && v.kind === 'stroke' && v.day === day)) fail('already_today');
  let got = 0; if (rewardedToday(d, day) < SOCIAL.rewardedPerDay) { got = SOCIAL.visitReward; withDB((_, earn) => earn(got)); }
  d.visits.push({ pid: b.pid, kind: 'stroke', day }); save(d); return { got };
}
export async function waterFriendCrop(who: string, plot: number) {
  const d = load(), b = friendOrFail(d, who), day = localDay();
  if (d.visits.some(v => v.pid === b.pid && v.kind === 'water' && v.plot === plot && v.day === day)) fail('already_today');
  const p = botPlots(d, b).find(x => x.plot === plot); if (!p) fail('plot_empty');
  const pl = p as { ready: boolean; waters: number };
  if (pl.ready) fail('already_ready');
  if (pl.waters >= 3) fail('max_watered');
  let got = 0; if (rewardedToday(d, day) < SOCIAL.rewardedPerDay) { got = SOCIAL.waterReward; withDB((_, earn) => earn(got)); }
  const k = `${b.pid}:${plot}`; d.botPlots[k] = { waters: (d.botPlots[k]?.waters || 0) + 1, at: Date.now() };
  d.visits.push({ pid: b.pid, kind: 'water', plot, day }); save(d); return { waters: pl.waters + 1, got };
}
export async function leaveGuestbook(who: string, emote: string) {
  if (!GUESTBOOK.some(g => g.id === emote)) fail('invalid_emote');
  const d = load(), b = friendOrFail(d, who), day = localDay();
  if (d.visits.some(v => v.pid === b.pid && v.kind === 'note' && v.day === day)) fail('already_today');
  d.visits.push({ pid: b.pid, kind: 'note', emote, day }); save(d);
}
/** Dấu vết bạn bè để lại ở nhà mình: bản thử chỉ có vài dấu từ bạn ảo. */
export async function getGuestbook() {
  const d = load(); void d;
  return [{ from: DEMO_BOTS[0].name, kind: 'note', emote: 'flower', at: new Date(Date.now() - 5 * 3600000).toISOString() }];
}
