/** Chế độ Chơi thử: Đấu trường lưu trong trình duyệt, cùng luật với máy chủ (đá nâng cấp, trần thưởng, Elo, bỏ trận). */
import { ARENA, ratingDelta, type ArenaFinish, type ArenaMode, type ArenaResult, type ArenaStart, type ArenaState, type ArenaStats } from '../game/arena';
import { UPGRADE_COST, UPGRADE_MAX, type Upgrades } from '../game/battle';
import { SPECIES } from '../game/species';
import { bondLevel } from '../game/bond';
import { withDB } from './demo-api';
import { DEMO_BOTS } from './demo-social';

const KEY = 'hatchday-demo-arena';
interface Pending { id: number; mode: ArenaMode; at: number; opp: ArenaStart['opp']; oppPid?: string }
interface Store { up: Record<string, Upgrades>; st: ArenaStats; day: string; dayRewards: number; dayWon: boolean; pending: Pending | null; next: number; ghosts: Record<string, number> }
const zero = (): Upgrades => ({ hp: 0, atk: 0, def: 0, spd: 0 });
const fresh = (): Store => ({ up: {}, st: { rating: 1000, ranked: 0, wins: 0, losses: 0, draws: 0, streak: 0, best_streak: 0, def_wins: 0, def_losses: 0 }, day: '', dayRewards: 0, dayWon: false, pending: null, next: 1, ghosts: {} });
const load = (): Store => { try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return fresh(); } };
const save = (s: Store) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* bỏ qua */ } };
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const today = () => new Date().toLocaleDateString('en-CA');
const roll = (s: Store) => { if (s.day !== today()) { s.day = today(); s.dayRewards = 0; s.dayWon = false; } };
const pet = () => withDB(db => db.pet);
/** Người chơi "khác" ở bản Chơi thử: các bé mô phỏng của phần Bạn bè, mỗi bé một điểm xếp hạng cố định. */
const ghost = (b: (typeof DEMO_BOTS)[number], s: Store) => ({ kind: 'player' as const, pid: b.pid, name: b.name, family: b.family, species: b.species, stage: (b.stage === 'elder' ? 'adult' : b.stage) as string, form: b.form ?? null,
  bond: b.bond ?? 4, upgrades: { hp: (b.name.length) % 3, atk: (b.name.length + 1) % 3, def: 1, spd: 0 }, rating: s.ghosts[b.pid] ?? (950 + (b.name.length * 37) % 200) });

export async function getArenaState(): Promise<ArenaState> {
  const s = load(); roll(s); save(s); const p = pet();
  const top = [...DEMO_BOTS.map(b => ({ name: b.name, species: b.species, rating: ghost(b, s).rating, wins: 3 + (b.name.length % 5), me: false })), ...(s.st.ranked ? [{ name: p?.name || '', species: p?.species || '', rating: s.st.rating, wins: s.st.wins, me: true }] : [])]
    .sort((a, b) => b.rating - a.rating).slice(0, 10);
  return { upgrades: p ? s.up[p.id] || zero() : null, costs: [...UPGRADE_COST], stats: s.st, rewards_left: Math.max(0, ARENA.perDay - s.dayRewards), first_win_open: !s.dayWon,
    reward: { win: ARENA.rewardWin, loss: ARENA.rewardLoss, first_win: ARENA.firstWin }, rank: s.st.ranked ? top.findIndex(t => t.me) + 1 || null : null, top };
}
export async function buyUpgrade(stat: keyof Upgrades): Promise<{ upgrades: Upgrades; coins: number; cost: number }> {
  if (!['hp', 'atk', 'def', 'spd'].includes(stat)) fail('invalid_stat');
  const s = load(), p = pet(); if (!p || p.stage === 'departed') return fail('no_pet');
  const u = s.up[p.id] || zero(), lvl = u[stat] || 0; if (lvl >= UPGRADE_MAX) fail('upgrade_max');
  const cost = UPGRADE_COST[lvl];
  const coins = withDB(db => { if (db.coins < cost) fail('not_enough_coins'); db.coins -= cost; return db.coins; });
  u[stat] = lvl + 1; s.up[p.id] = u; save(s); return { upgrades: { ...u }, coins, cost };
}
function settle(s: Store, b: Pending, res: ArenaResult, turns: number | null): ArenaFinish {
  roll(s); let reward = 0, first = false, delta = 0;
  if (res !== 'forfeit' && s.dayRewards < ARENA.perDay) { reward = res === 'win' ? ARENA.rewardWin : res === 'draw' ? Math.floor((ARENA.rewardWin + ARENA.rewardLoss) / 2) : ARENA.rewardLoss; if (res === 'win' && !s.dayWon) { reward += ARENA.firstWin; first = true; } s.dayRewards++; }
  const coins = withDB((db, earn) => { if (reward) earn(reward); return db.coins; });
  if (b.mode === 'ranked') { delta = ratingDelta(s.st.rating, b.opp.rating, res); s.st.rating = Math.max(0, s.st.rating + delta); s.st.ranked++; if (b.oppPid) s.ghosts[b.oppPid] = b.opp.rating - Math.round(delta / 2); }
  const st = s.st; if (res === 'win') { st.wins++; st.streak++; st.best_streak = Math.max(st.best_streak, st.streak); s.dayWon = true; } else { st.streak = 0; if (res === 'draw') st.draws++; else st.losses++; }
  s.pending = null; void turns;
  return { result: res, reward, first_win: first, rating: st.rating, rating_delta: delta, rewards_left: Math.max(0, ARENA.perDay - s.dayRewards), coins };
}
export async function arenaStart(mode: ArenaMode, who?: string): Promise<ArenaStart> {
  const s = load(), p = pet(); if (!p || !['child', 'teen', 'adult', 'elder'].includes(p.stage)) return fail('arena_too_young');
  if (s.pending) { if (s.pending.mode === 'ranked') settle(s, s.pending, 'forfeit', null); s.pending = null; }
  const stage = p.stage === 'elder' ? 'adult' : p.stage, bond = bondLevel(p.bond_xp || 0);
  let opp: ArenaStart['opp'] | null = null, oppPid: string | undefined;
  if (mode === 'friend') { const b = DEMO_BOTS.find(x => x.pid === who); if (!b) fail('not_friends'); opp = ghost(b!, s); oppPid = b!.pid; }
  if (mode === 'ranked') { const b = [...DEMO_BOTS].sort((x, y) => Math.abs(ghost(x, s).rating - s.st.rating) - Math.abs(ghost(y, s).rating - s.st.rating) + (Math.random() - 0.5) * 120)[0]; opp = ghost(b, s); oppPid = b.pid; }
  if (!opp) { const pool = SPECIES.filter(x => x.id !== p.species), sp = pool[Math.floor(Math.random() * pool.length)];
    opp = { kind: 'bot', species: sp.id, stage, form: stage === 'adult' ? (['tron', 'nhanh', 'thuong', 'sang'] as const)[Math.floor(Math.random() * 4)] : null, bond: Math.max(1, Math.min(10, bond + Math.floor(Math.random() * 3) - 1)), upgrades: zero(), rating: 1000 }; }
  const b: Pending = { id: s.next++, mode, at: Date.now(), opp, oppPid }; s.pending = b; save(s);
  return { id: b.id, mode, field: Math.floor(Math.random() * 5), seed: (Math.random() * 2 ** 31) | 0, opp, upgrades: s.up[p.id] || zero() };
}
export async function arenaFinish(id: number, result: ArenaResult, turns: number | null): Promise<ArenaFinish> {
  const s = load(), b = s.pending; if (!b || b.id !== id) return fail('arena_not_pending');
  const fast = /[?&]battlefast\b/.test(location.search);
  if (result !== 'forfeit' && !fast && Date.now() - b.at < ARENA.minSeconds * 1000) fail('arena_too_fast');
  const r = settle(s, b, result, turns); save(s); return r;
}
