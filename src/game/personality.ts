/**
 * Cá tính 5 trục, mỗi trục từ -100 đến 100. Lúc sinh bốc ngẫu nhiên trong [-50, 50],
 * sau đó dịch dần theo cách chăm: mỗi hành động thành công đẩy vài trục một chút.
 *
 * Luật ở hai nơi: phần bốc và phần dịch có bản SQL song song trong
 * supabase/migrations/20261113000000_personality.sql (private.roll_personality, private.personality_drift).
 * Test supabase/tests/personality.test.ts so khớp hai bên.
 *
 * Phần còn lại (hành vi rảnh, lời chào, câu nói) chỉ là hiển thị phía client, không ảnh hưởng chỉ số.
 */
import type { PetAction } from '../data/types';

export const AXES = ['energy', 'social', 'curious', 'playful', 'affection'] as const;
export type Axis = (typeof AXES)[number];
export type Personality = Record<Axis, number>;

export const BIRTH_RANGE = 50;
export const LIMIT = 100;

export const TRAITS: Record<Axis, { hi: string; lo: string; hiHint: string; loHint: string }> = {
  energy: { hi: 'Hiếu động', lo: 'Điềm tĩnh', hiHint: 'chạy nhảy suốt ngày', loHint: 'thích ngồi yên một chỗ' },
  social: { hi: 'Thích làm quen', lo: 'Nhút nhát', hiHint: 'hay bắt chuyện', loHint: 'hơi ngại người lạ' },
  curious: { hi: 'Tò mò', lo: 'Thận trọng', hiHint: 'đi xem mọi góc nhà', loHint: 'quen chỗ nào ở chỗ đó' },
  playful: { hi: 'Ham chơi', lo: 'Trầm tính', hiHint: 'lúc nào cũng muốn chơi', loHint: 'thích yên tĩnh' },
  affection: { hi: 'Quấn người', lo: 'Độc lập', hiHint: 'mê được vuốt ve', loHint: 'tự chơi một mình cũng vui' },
};

/**
 * Mỗi hành động thành công (dòng mới trong action_log) đẩy cá tính một chút.
 * Một ngày chăm bình thường dịch khoảng 1–5 điểm mỗi trục, nên cá tính đổi rõ sau vài tuần.
 * Vuốt ve gộp theo lô nên chỉ tính một lần mỗi lô.
 */
export const DRIFT: Partial<Record<PetAction, Partial<Personality>>> = {
  pet: { affection: 0.4 },
  talk: { social: 0.6, curious: 0.2 },
  play_ball: { playful: 0.6, energy: 0.3 },
  play_spin: { playful: 0.4, energy: 0.2 },
  feed: { curious: 0.2 },
  bath_rinse: { affection: 0.2, energy: -0.2 },
  sleep: { energy: -0.3, playful: -0.1 },
};

const clampAxis = (v: number) => Math.max(-LIMIT, Math.min(LIMIT, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Điền đủ 5 trục (thú cũ hoặc dữ liệu thiếu thì là 0). */
export function normalize(p: Partial<Record<string, number>> | null | undefined): Personality {
  const o = {} as Personality;
  for (const a of AXES) { const v = Number(p?.[a]); o[a] = Number.isFinite(v) ? clampAxis(v) : 0; }
  return o;
}
/** Chưa có cá tính (toàn 0): thú tạo trước khi có tính năng này. */
export const isBlank = (p: Partial<Record<string, number>> | null | undefined) => AXES.every(a => !Number(p?.[a]));

/** Bốc cá tính lúc sinh. `rand` trả về số trong [0, 1). Giống private.roll_personality(). */
export function rollPersonality(rand: () => number = Math.random): Personality {
  const o = {} as Personality;
  for (const a of AXES) o[a] = Math.floor(rand() * (BIRTH_RANGE * 2 + 1)) - BIRTH_RANGE;
  return o;
}

/** Áp dụng độ dịch của một hành động. Giống trigger private.personality_on_action(). */
export function applyDrift(p: Personality, action: PetAction): Personality {
  const d = DRIFT[action]; if (!d) return p;
  const o = { ...p };
  for (const a of AXES) if (d[a]) o[a] = round1(clampAxis(o[a] + d[a]!));
  return o;
}

/** Hai nét nổi bật nhất (theo trị tuyệt đối), bỏ qua nét quá nhạt (|v| < 15). */
export function topTraits(p: Personality, n = 2): { axis: Axis; hi: boolean; name: string; hint: string; v: number }[] {
  return AXES.map(a => ({ axis: a, v: p[a] }))
    .filter(x => Math.abs(x.v) >= 15)
    .sort((x, y) => Math.abs(y.v) - Math.abs(x.v))
    .slice(0, n)
    .map(({ axis, v }) => ({ axis, v, hi: v > 0, name: v > 0 ? TRAITS[axis].hi : TRAITS[axis].lo, hint: v > 0 ? TRAITS[axis].hiHint : TRAITS[axis].loHint }));
}

/** Một câu tả cá tính, ví dụ "Bé Ham chơi và Quấn người: lúc nào cũng muốn chơi, mê được vuốt ve." */
export function describe(p: Personality): string {
  const t = topTraits(p);
  if (!t.length) return 'Bé hiền hoà, chưa nghiêng hẳn về nét nào. Cách bạn chăm sẽ dần tạo nên cá tính của bé.';
  return `Bé ${t.map(x => x.name).join(' và ')}: ${t.map(x => x.hint).join(', ')}.`;
}

export type IdleKind = 'visit' | 'wander' | 'yawn' | 'look' | 'dance' | 'hop' | 'wave';

/** Trọng số chọn hành vi rảnh theo cá tính và chỉ số hiện tại. Trục ở 0 thì giữ đúng tỉ lệ cũ. */
export function idleWeights(p: Personality, s: { nl: number; vui: number }): Record<IdleKind, number> {
  const f = (v: number, k = 1) => Math.max(0.15, 1 + (v / 100) * k);
  return {
    visit: 0.3 * f(p.curious),
    wander: 0.2 * f(p.energy) * f(p.curious, 0.5),
    yawn: s.nl < 65 ? 0.08 * f(-p.energy) : 0,
    look: 0.16 * f(-p.playful, 0.5) * f(p.curious, 0.5),
    dance: s.vui > 55 ? 0.14 * f(p.playful) : 0,
    hop: 0.12 * f(p.playful, 0.7) * f(p.energy, 0.7),
    wave: 0.04 * f(p.social, 1.5),
  };
}
export function pickWeighted<K extends string>(w: Record<K, number>, r: number): K {
  const keys = Object.keys(w) as K[], total = keys.reduce((s, k) => s + w[k], 0);
  let x = r * total;
  for (const k of keys) { x -= w[k]; if (x < 0) return k; }
  return keys[keys.length - 1];
}
/** Hệ số nhịp: bé hiếu động nghĩ ra việc nhanh hơn và đi nhanh hơn. */
export const idleGapFactor = (p: Personality) => 1 - p.energy / 250;
export const walkSpeedFactor = (p: Personality) => 1 + p.energy / 400;

const pickLine = (a: string[], r: number) => a[Math.floor(r * a.length) % a.length];

/** Lời chào lúc mở game. */
export function greeting(p: Personality, name: string, r = Math.random()): string {
  if (p.social <= -30) return pickLine([`À… chào bạn. Mình là ${name}.`, `Ừm… bạn tới rồi hả. Mình là ${name}.`], r);
  if (p.affection >= 30) return pickLine([`Bạn về rồi! ${name} nhớ bạn lắm luôn!`, `A, bạn đây rồi! Ôm ${name} một cái đi!`], r);
  if (p.energy >= 30 || p.playful >= 30) return pickLine([`Chào bạn! ${name} đây! Hôm nay chơi gì nè?`, `Yay, bạn tới rồi! Đi chơi không?`], r);
  if (p.curious >= 30) return pickLine([`Chào bạn! ${name} vừa phát hiện một góc nhà hay lắm.`, `Chào bạn! Hôm nay có gì mới không?`], r);
  return `Chào bạn! Mình là ${name}.`;
}

/** Câu đáp khi không bắt được từ khoá nào trong lúc trò chuyện. */
export function smallTalk(p: Personality, r = Math.random()): string {
  const t = topTraits(p, 1)[0];
  const POOL: Record<string, string[]> = {
    'social+': ['Kể thêm đi, mình thích nghe bạn nói lắm!', 'Rồi sao nữa? Rồi sao nữa?', 'Bạn nói chuyện vui ghê, mình muốn nghe hoài.'],
    'social-': ['Ừm… mình nghe nè.', 'Vậy hả… (gật gù)', 'Mình hơi ngại, nhưng mình thích nghe bạn kể.'],
    'curious+': ['Thật hả? Vì sao vậy?', 'Ồ, cái đó là gì vậy, kể mình nghe với!', 'Hay quá, mình chưa biết chuyện này luôn.'],
    'curious-': ['Ừm, mình hiểu rồi.', 'Vậy là ổn rồi ha.', 'Mình thích mọi thứ cứ như cũ.'],
    'playful+': ['Kể xong rồi mình đi chơi bóng nha!', 'Hihi, nghe vui ghê! Chơi trò gì đó đi!', 'Ừm ừm, mà bạn có muốn chơi với mình không?'],
    'playful-': ['Ừm, mình ngồi đây nghe bạn kể nè.', 'Nghe bình yên ghê.', 'Mình thích những lúc yên tĩnh như vầy.'],
    'affection+': ['Bạn nói gì mình cũng thích nghe hết.', 'Mình ở đây với bạn nè.', 'Hihi, được nói chuyện với bạn là vui rồi.'],
    'affection-': ['Ừ, mình nghe rồi.', 'Bạn cứ làm việc của bạn, mình tự chơi được.', 'Ừm, hay đó.'],
    'energy+': ['Ồ ồ! Rồi sao nữa!', 'Nghe phấn khích quá đi!', 'Hay quá, mình muốn chạy một vòng!'],
    'energy-': ['Ừm… nghe hay đó…', 'Mình nghe nè, từ từ kể.', 'Hôm nay thong thả ha.'],
  };
  const key = t ? `${t.axis}${t.hi ? '+' : '-'}` : '';
  return pickLine(POOL[key] || ['Ừm ừm, kể tiếp đi!', 'Thật hả? Hay quá!', 'Mình nhớ chuyện này rồi nha.', 'Hihi, bạn nói chuyện vui ghê.'], r);
}

/** Câu bé nói thỉnh thoảng khi được vuốt ve. */
export function petLine(p: Personality, r = Math.random()): string {
  if (p.affection <= -30) return pickLine(['Thôi được rồi mà~', 'Ừm, đủ rồi đó nha.', 'Mình tự chơi cũng được mà.'], r);
  if (p.affection >= 30) return pickLine(['Thêm nữa đi, thêm nữa!', 'Mình thích được bạn vuốt nhất!', 'Ấm áp ghê~'], r);
  return pickLine(['Hihi, nhột quá!', 'Thêm chút nữa đi mà~', 'Dễ chịu ghê!'], r);
}
