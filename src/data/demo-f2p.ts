/**
 * Chế độ Chơi thử: mô phỏng kỹ năng, việc làm thêm, thi biểu diễn, lễ hội, sticker và Sổ mùa
 * (cùng luật với supabase/migrations/20261221000000_f2p_features.sql; mã lỗi giống bản thật).
 * Khác bản thật: thi biểu diễn có vài bé ảo dự thi sẵn; ?dev cho ca làm xong sau 5 giây; ?festival=<id> để xem thử lễ hội.
 */
import { bondLevel } from '../game/bond';
import { localDay } from '../game/rules';
import type { MiniKind } from '../game/world-activity';
import {
  contestReward, contestScore, festivalOn, FESTIVAL_BY_ID, FESTIVAL_GIFT, JOB_BY_ID, JOB_HOURS, JOB_MIN_ENERGY, JOB_PER_DAY, jobPay, jobXp, MINI_SKILL,
  SEASON_TIERS, SEASON_XP, seasonOf, SKILLS, skillLevel, skillXpFor, STICKER_BY_ID, STICKER_COINS, STICKERS, weekStart,
  type ContestState, type FestivalState, type JobState, type SeasonState, type SkillId, type StickerState,
} from '../game/f2p';
import { withDB } from './demo-api';

const KEY = 'hatchday-demo-f2p';
interface FD {
  skills: Record<string, Record<string, number>>; // pet id → kỹ năng → xp
  job: { job: string; hours: number; started_at: string; ends_at: string; pet: string } | null;
  jobLogs: { day: string; job: string; pay: number }[];
  contest: { week: string; score: number; at: number; claimed: boolean }[];
  festivals: { edition: string; festival: string; day: string }[];
  stickers: string[];
  season: Record<string, number[]>;
  /** Số lần mỗi hoạt động theo ngày (để tính điểm mùa giống world_activity + toy_logs). */
  acts: Record<string, Record<string, number>>;
  playdates: number; playdateDays: string[];
  notes: number;
}
const load = (): FD => {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null') as FD | null; if (d) return d; } catch { /* bỏ qua */ }
  return { skills: {}, job: null, jobLogs: [], contest: [], festivals: [], stickers: [], season: {}, acts: {}, playdates: 0, playdateDays: [], notes: 0 };
};
const save = (d: FD) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* bỏ qua */ } };
const fail = (code: string): never => { throw new Error(code); };
const dev = () => { try { return new URLSearchParams(location.search).has('dev'); } catch { return false; } };
const petId = () => withDB(db => (db.pet && db.pet.stage !== 'departed' ? db.pet.id : null));

/* ---------- Kỹ năng ---------- */
const skillsOf = (d: FD, pid: string | null) => (pid ? (d.skills[pid] ||= {}) : {});
function addSkill(d: FD, sk: SkillId, n: number) { const pid = petId(); if (!pid || n <= 0) return; const s = skillsOf(d, pid); s[sk] = (s[sk] || 0) + n; }
const skillRows = (d: FD) => { const s = skillsOf(d, petId()); return SKILLS.map(k => ({ skill: k.id, xp: s[k.id] || 0, level: skillLevel(s[k.id] || 0) })); };

/** Gọi từ demo-api sau mỗi hoạt động (đồ chơi, hoạt động, mini-game) để tính điểm mùa. */
export function noteActivity(kind: string) { const d = load(), day = localDay(); const a = (d.acts[day] ||= {}); a[kind] = (a[kind] || 0) + 1; save(d); }
/** Gọi từ demo-api sau một lượt mini-game có thưởng: cộng kỹ năng, trả về kỹ năng và xp. */
export function miniSkill(kind: MiniKind, score: number, rewarded: boolean) {
  const d = load(), sk = MINI_SKILL[kind], xp = rewarded ? skillXpFor(kind, score) : 0;
  if (xp) addSkill(d, sk, xp); save(d); return { skill: sk, skill_xp: xp };
}

/* ---------- Việc làm thêm ---------- */
const jobsToday = (d: FD) => d.jobLogs.filter(l => l.day === localDay()).length + (d.job ? 1 : 0);
const jobState = (d: FD): JobState => ({ job: (d.job?.job as JobState['job']) ?? null, hours: d.job?.hours ?? 0, started_at: d.job?.started_at ?? null, ends_at: d.job?.ends_at ?? null, done_today: jobsToday(d), per_day: JOB_PER_DAY, skills: skillRows(d) });
export async function getJobState(): Promise<JobState> { return jobState(load()); }
export async function startJob(job: string, hours: number): Promise<JobState> {
  if (!JOB_BY_ID[job]) fail('unknown_job');
  if (!(JOB_HOURS as readonly number[]).includes(hours)) fail('invalid_hours');
  const p = withDB(db => db.pet); if (!p || p.stage === 'departed') fail('no_pet');
  if (p!.stage === 'egg') fail('too_young'); if (p!.asleep) fail('asleep'); if (p!.illness) fail('sick_blocked'); if (p!.nl < JOB_MIN_ENERGY) fail('too_tired');
  const d = load(); if (d.job) fail('job_busy'); if (jobsToday(d) >= JOB_PER_DAY) fail('job_limit');
  const now = Date.now(); d.job = { job, hours, pet: p!.id, started_at: new Date(now).toISOString(), ends_at: new Date(now + (dev() ? 5000 : hours * 3600000)).toISOString() };
  save(d); return jobState(d);
}
export async function finishJob() {
  const d = load(), j = d.job; if (!j) fail('no_job');
  if (Date.parse(j!.ends_at) > Date.now()) fail('job_not_done');
  const sk = JOB_BY_ID[j!.job].skill as SkillId, lv = skillLevel(skillsOf(d, petId())[sk] || 0), pay = jobPay(j!.job as never, j!.hours, lv);
  d.job = null; d.jobLogs.push({ day: localDay(), job: j!.job, pay }); addSkill(d, sk, jobXp(j!.hours)); save(d);
  const coins = withDB((db, earn) => { earn(pay); return db.coins; });
  return { pay, coins, skill: sk, skill_xp: jobXp(j!.hours), job: j!.job, hours: j!.hours };
}
export async function cancelJob(): Promise<JobState> { const d = load(); if (!d.job) fail('no_job'); d.job = null; save(d); return jobState(d); }

/* ---------- Thi biểu diễn tuần (có vài bé ảo dự thi) ---------- */
const BOTS = [{ name: 'Lúa Mạch', score: 74 }, { name: 'Nấm Ngủ', score: 52 }, { name: 'Mây Hồng', score: 38 }, { name: 'Bơ', score: 61 }, { name: 'Kẹo', score: 27 }];
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
function board(week: string, mine?: { score: number; at: number }) {
  const rows = BOTS.map((b, i) => ({ name: b.name, score: b.score + (hash(week + b.name) % 9), mine: false, at: i }));
  const name = withDB(db => db.pet?.name || 'Bé');
  if (mine) rows.push({ name, score: mine.score, mine: true, at: mine.at });
  return rows.sort((a, b) => b.score - a.score || a.at - b.at);
}
const rankIn = (week: string, e: { score: number; at: number }) => board(week, e).findIndex(r => r.mine) + 1;
function contestState(d: FD): ContestState {
  const w = weekStart(localDay()), e = d.contest.find(c => c.week === w), rows = board(w, e);
  const le = [...d.contest].filter(c => c.week < w).sort((a, b) => b.week.localeCompare(a.week))[0];
  return { week: w, entered: !!e, score: e?.score ?? null, rank: e ? rankIn(w, e) : null, entries: rows.length, top: rows.slice(0, 10).map(r => ({ name: r.name, score: r.score, mine: r.mine })),
    last: le ? { week: le.week, rank: rankIn(le.week, le), reward: contestReward(rankIn(le.week, le)), claimed: le.claimed } : null };
}
export async function getContest(): Promise<ContestState> { return contestState(load()); }
export async function enterContest(): Promise<ContestState> {
  const p = withDB(db => db.pet); if (!p || p.stage === 'departed') fail('no_pet'); if (p!.stage === 'egg') fail('too_young');
  const d = load(), w = weekStart(localDay()); if (d.contest.some(c => c.week === w)) fail('already_entered');
  const lv = skillRows(d).reduce((n, r) => n + r.level, 0), score = contestScore(lv, bondLevel(p!.bond_xp), hash(p!.id + w) % 20);
  d.contest.push({ week: w, score, at: Date.now(), claimed: false }); save(d); return contestState(d);
}
export async function claimContest() {
  const d = load(), w = weekStart(localDay()), le = [...d.contest].filter(c => c.week < w).sort((a, b) => b.week.localeCompare(a.week))[0];
  if (!le) fail('contest_not_entered'); if (le!.claimed) fail('already_claimed');
  const r = rankIn(le!.week, le!), rew = contestReward(r); le!.claimed = true; save(d);
  return { rank: r, reward: rew, coins: withDB((db, earn) => { earn(rew); return db.coins; }) };
}

/* ---------- Lễ hội ---------- */
function festToday() {
  let q: string | null = null; try { q = new URLSearchParams(location.search).get('festival'); } catch { /* bỏ qua */ }
  const day = localDay();
  if (q && FESTIVAL_BY_ID[q]) return { id: q, edition: `${q}:${day.slice(0, 4)}`, from: day, to: day };
  const f = festivalOn(day); return f ? { id: f.id, edition: f.edition, from: day, to: day } : null;
}
export async function getFestival(): Promise<FestivalState> { const f = festToday(), d = load(); return { festival: f, claimed: !!f && d.festivals.some(x => x.edition === f.edition) }; }
export async function claimFestival() {
  const f = festToday(); if (!f) fail('no_festival');
  const d = load(); if (d.festivals.some(x => x.edition === f!.edition)) fail('already_claimed');
  d.festivals.push({ edition: f!.edition, festival: f!.id, day: localDay() }); save(d);
  return { reward: FESTIVAL_GIFT, festival: f!.id, coins: withDB((db, earn) => { earn(FESTIVAL_GIFT); return db.coins; }) };
}

/* ---------- Hẹn chơi và lời nhắn (đếm cho sticker/điểm mùa; luồng chính ở demo-social) ---------- */
export function notePlaydate() { const d = load(); d.playdates++; d.playdateDays.push(localDay()); save(d); }
export function noteGuestNote() { const d = load(); d.notes++; save(d); }

/* ---------- Sticker ---------- */
function stickerProgress(d: FD, id: string): number {
  const s = STICKER_BY_ID[id], w = weekStart(localDay());
  const badges = withDB(db => db.world?.badges || []);
  switch (s.kind) {
    case 'badge': return badges.includes(s.ref) ? 1 : 0;
    case 'skill': { const rows = skillRows(d); return s.ref === 'any' ? Math.max(0, ...rows.map(r => r.level)) : rows.find(r => r.skill === s.ref)?.level || 0; }
    case 'jobs': return d.jobLogs.length;
    case 'playdate': return d.playdates;
    case 'contest': return d.contest.length;
    case 'contest_top': return d.contest.filter(c => c.week < w && rankIn(c.week, c) <= 3).length;
    case 'festival': return d.festivals.some(f => f.festival === s.ref) ? 1 : 0;
    case 'season': return Math.max(0, ...Object.values(d.season).map(t => t.length));
    case 'guestbook': return d.notes;
  }
}
export async function getStickers(): Promise<StickerState[]> { const d = load(); return STICKERS.map(s => ({ id: s.id, progress: Math.min(stickerProgress(d, s.id), s.target), target: s.target, claimed: d.stickers.includes(s.id) })); }
export async function claimSticker(id: string) {
  const s = STICKER_BY_ID[id]; if (!s) fail('unknown_sticker');
  const d = load(); if (stickerProgress(d, id) < s.target) fail('quest_not_done'); if (d.stickers.includes(id)) fail('already_claimed');
  d.stickers.push(id); save(d); return { reward: STICKER_COINS, coins: withDB((db, earn) => { earn(STICKER_COINS); return db.coins; }) };
}

/* ---------- Sổ mùa ---------- */
function seasonXp(d: FD, s: string) {
  let xp = 0;
  for (const [day, kinds] of Object.entries(d.acts)) if (seasonOf(day) === s) for (const n of Object.values(kinds)) xp += Math.min(n, SEASON_XP.activityCap) * SEASON_XP.activity;
  xp += SEASON_XP.job * d.jobLogs.filter(l => seasonOf(l.day) === s).length;
  xp += SEASON_XP.playdate * d.playdateDays.filter(x => seasonOf(x) === s).length;
  xp += SEASON_XP.contest * d.contest.filter(c => seasonOf(new Date(c.at).toISOString().slice(0, 10)) === s).length;
  xp += SEASON_XP.festival * d.festivals.filter(f => seasonOf(f.day) === s).length;
  return xp;
}
export async function getSeason(): Promise<SeasonState> {
  const d = load(), s = seasonOf(localDay()), xp = seasonXp(d, s), got = d.season[s] || [];
  return { season: s, xp, tiers: SEASON_TIERS.map((t, i) => ({ tier: i, xp: t.xp, coins: t.coins, claimed: got.includes(i), ready: xp >= t.xp })) };
}
export async function claimSeason(tier: number) {
  const t = SEASON_TIERS[tier]; if (!t) fail('invalid_tier');
  const d = load(), s = seasonOf(localDay()); if (seasonXp(d, s) < t.xp) fail('quest_not_done');
  const got = (d.season[s] ||= []); if (got.includes(tier)) fail('already_claimed');
  got.push(tier); save(d); return { reward: t.coins, coins: withDB((db, earn) => { earn(t.coins); return db.coins; }) };
}
