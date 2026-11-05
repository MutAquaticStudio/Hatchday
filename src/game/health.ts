/**
 * Sức khoẻ: 8 bệnh, mỗi bệnh có điều kiện mắc, ảnh hưởng và cách khỏi riêng.
 * Luật thuần, song song với private.health_step trong supabase/migrations/20261121000000_illness.sql
 * (supabase/tests/health.test.ts so khớp bảng bệnh và chạy từng kịch bản trên cả hai bên).
 *
 * Bốn nhóm:
 *  - Bỏ bê (4 bệnh): một chỉ số ≤ 5 liên tục 30 phút trong lúc bạn đang mở game mà chưa chăm. Chỉ số nào bị bỏ thì ra bệnh đó.
 *    Đóng game thì đồng hồ 30 phút không chạy (người đi làm vắng cả đêm không bị phạt).
 *  - Ăn uống: Sâu răng (cho ăn món ngọt thứ 4 trong ngày), Thiếu chất (ăn từ 6 bữa trong 3 ngày mà chỉ có 1 nhóm lành mạnh).
 *  - Vận động: Căng cơ (chơi đồ chơi từ 12 lần trong 1 giờ).
 *  - Môi trường: Cảm lạnh (chơi ngoài vườn lúc khuya 22:00–05:00, từ 2 lần trong 2 giờ).
 * Bệnh do hành động chỉ xét ngay lúc làm hành động đó (không tự mắc lại khi mở game).
 *
 * Khỏi bằng một trong ba đường: thuốc đúng bệnh (mua ở tiệm), phòng khám (khỏi ngay, bổ sung chỉ số bị bỏ bê),
 * hoặc tự khỏi (`heal`): bệnh bỏ bê khỏi sau 3 giờ nghỉ kể từ lúc chỉ số bị bỏ được chăm lên từ 50;
 * bệnh vận động, ăn uống, môi trường tự khỏi sau số giờ riêng; Thiếu chất khỏi ngay khi ăn cân bằng.
 * Bệnh không có tiến triển phục hồi trong 24 giờ thì thành NẶNG: giảm chỉ số nhanh hơn 25% và chỉ phòng khám chữa được.
 */
export type HealthStat = 'no' | 'sach' | 'vui' | 'nl';
export type Block = 'play' | 'bath' | 'sweets';

export const HEALTH = {
  /** Chỉ số ≤ mức này là "nguy kịch". */
  critical: 5,
  /** Nguy kịch liên tục bao nhiêu phút thì ốm. */
  criticalMinutes: 30,
  /** Bệnh bỏ bê: chỉ số được chăm lên từ mức này thì bắt đầu nghỉ để khỏi; tụt dưới `relapseBelow` thì nghỉ lại từ đầu. */
  fixAt: 50,
  relapseBelow: 20,
  /** Số bữa ngọt trong ngày khiến sâu răng (tính cả bữa vừa ăn). */
  sweetsLimit: 4,
  /** Chơi từ bấy nhiêu lần trong 1 giờ thì căng cơ. */
  overplay: { n: 12, hours: 1 },
  /** Chơi ngoài vườn lúc khuya (từ giờ `from` tới trước giờ `to`) từ `n` lần trong `hours` giờ thì cảm lạnh. */
  nightPlay: { n: 2, hours: 2, from: 22, to: 5 },
  /** Thiếu chất: ăn từ `meals` bữa trong 3 ngày mà không quá `maxGroups` nhóm lành mạnh (nhóm "ngot" không tính). */
  malnutrition: { meals: 6, maxGroups: 1 },
  /** Cân bằng: từ bấy nhiêu nhóm lành mạnh trong 3 ngày. */
  balancedGroups: 3,
  /** Không tiến triển phục hồi suốt bấy nhiêu giờ thì thành bệnh nặng. */
  severeHours: 24,
  /** Bệnh nặng: giảm chỉ số nhanh hơn bấy nhiêu lần (nhân thêm vào hệ số của bệnh). */
  severeK: 1.25,
  clinicPrice: 150,
  clinicSeverePrice: 250,
  /** Phòng khám bổ sung chỉ số bị bỏ bê lên tối thiểu mức này. */
  clinicRestore: 60,
  medicineMax: 10,
  /** Chữa bệnh được cộng điểm gắn bó. */
  cureBond: 3,
} as const;

export type Family = 'bo-be' | 'an-uong' | 'van-dong' | 'moi-truong';
/** Cách tự khỏi. `stat`: chăm chỉ số bị bỏ lên rồi nghỉ `hours` giờ; `time`: sau `hours` giờ kể từ lúc ốm; `balanced`: khỏi khi ăn cân bằng. */
export type Heal = { kind: 'stat'; stat: HealthStat; hours: number } | { kind: 'time'; hours: number } | { kind: 'balanced' };

export interface Illness {
  id: string; name: string; family: Family;
  /** Điều kiện mắc, viết cho người chơi đọc. */
  cause: string;
  /** Câu bé nói khi đang ốm. */
  sign: string;
  /** Hệ số nhân tốc độ giảm của từng chỉ số khi ốm (không ghi = 1). */
  decay: Partial<Record<HealthStat, number>>;
  /** Việc bé không làm được khi ốm. */
  block: Block[];
  heal: Heal;
  medicine: string;
}

export const ILLNESSES: Illness[] = [
  { id: 'dau-bung', name: 'Đau bụng', family: 'bo-be', cause: 'No ở mức gần 0 suốt 30 phút mà chưa cho ăn', sign: 'Bụng mình đau quá…',
    decay: { no: 1.5, vui: 1.2 }, block: ['play'], heal: { kind: 'stat', stat: 'no', hours: 3 }, medicine: 'tra-gung' },
  { id: 'ngua-da', name: 'Nổi mẩn', family: 'bo-be', cause: 'Sạch ở mức gần 0 suốt 30 phút mà chưa tắm', sign: 'Người mình ngứa ngáy khó chịu…',
    decay: { sach: 1.5, vui: 1.3 }, block: [], heal: { kind: 'stat', stat: 'sach', hours: 3 }, medicine: 'thuoc-boi' },
  { id: 'u-rut', name: 'Ủ rũ', family: 'bo-be', cause: 'Vui ở mức gần 0 suốt 30 phút mà chưa chơi hay vuốt ve', sign: 'Mình buồn lắm, chẳng muốn làm gì…',
    decay: { vui: 1.5, nl: 1.2 }, block: ['play'], heal: { kind: 'stat', stat: 'vui', hours: 3 }, medicine: 'mat-ong' },
  { id: 'sot-met', name: 'Sốt mệt', family: 'bo-be', cause: 'Năng lượng ở mức gần 0 suốt 30 phút mà chưa cho ngủ', sign: 'Mình nóng người, mệt rã rời…',
    decay: { nl: 1.5, no: 1.2 }, block: ['play'], heal: { kind: 'stat', stat: 'nl', hours: 3 }, medicine: 'thuoc-sot' },
  { id: 'sau-rang', name: 'Sâu răng', family: 'an-uong', cause: 'Cho ăn món ngọt thứ 4 trong cùng một ngày', sign: 'Răng mình ê buốt, không ăn đồ ngọt được…',
    decay: { vui: 1.3 }, block: ['sweets'], heal: { kind: 'time', hours: 6 }, medicine: 'nuoc-muoi' },
  { id: 'thieu-chat', name: 'Thiếu chất', family: 'an-uong', cause: 'Ăn từ 6 bữa trong 3 ngày mà chỉ có 1 nhóm lành mạnh (cơm mãi, hoặc toàn đồ ngọt)', sign: 'Người mình yếu ớt, thèm đủ thứ…',
    decay: { nl: 1.3, no: 1.2 }, block: [], heal: { kind: 'balanced' }, medicine: 'vitamin' },
  { id: 'cang-co', name: 'Căng cơ', family: 'van-dong', cause: 'Chơi đồ chơi từ 12 lần trong 1 giờ', sign: 'Chân mình mỏi nhừ, nhúc nhích là đau…',
    decay: { nl: 1.3 }, block: ['play'], heal: { kind: 'time', hours: 2 }, medicine: 'dau-xoa' },
  { id: 'cam-lanh', name: 'Cảm lạnh', family: 'moi-truong', cause: 'Chơi ngoài vườn lúc khuya (22:00–05:00) từ 2 lần trong 2 giờ', sign: 'Hắt xì! Mình lạnh run, sụt sịt hoài…',
    decay: { nl: 1.3, vui: 1.2 }, block: ['play', 'bath'], heal: { kind: 'time', hours: 4 }, medicine: 'thuoc-ho' },
];
export const ILLNESS_BY_ID: Record<string, Illness> = Object.fromEntries(ILLNESSES.map(i => [i.id, i]));
/** Bệnh bỏ bê ứng với chỉ số nào. */
export const NEGLECT_ILLNESS: Record<HealthStat, Illness> = Object.fromEntries(ILLNESSES.filter(i => i.family === 'bo-be').map(i => [(i.heal as { stat: HealthStat }).stat, i])) as Record<HealthStat, Illness>;
export const FAMILY_NAME: Record<Family, string> = { 'bo-be': 'Do bỏ bê', 'an-uong': 'Do ăn uống', 'van-dong': 'Do vận động', 'moi-truong': 'Do môi trường' };

export interface Medicine { id: string; name: string; cures: string; price: number }
export const MEDICINES: Medicine[] = [
  { id: 'tra-gung', name: 'Trà gừng', cures: 'dau-bung', price: 50 },
  { id: 'thuoc-boi', name: 'Thuốc bôi lá', cures: 'ngua-da', price: 50 },
  { id: 'mat-ong', name: 'Mật ong ấm', cures: 'u-rut', price: 50 },
  { id: 'thuoc-sot', name: 'Thuốc hạ sốt', cures: 'sot-met', price: 60 },
  { id: 'nuoc-muoi', name: 'Nước súc miệng muối', cures: 'sau-rang', price: 40 },
  { id: 'vitamin', name: 'Vitamin tổng hợp', cures: 'thieu-chat', price: 70 },
  { id: 'dau-xoa', name: 'Dầu xoa bóp', cures: 'cang-co', price: 40 },
  { id: 'thuoc-ho', name: 'Siro ho thảo mộc', cures: 'cam-lanh', price: 50 },
];
export const MEDICINE_BY_ID: Record<string, Medicine> = Object.fromEntries(MEDICINES.map(m => [m.id, m]));

export interface HealthState {
  no: number; sach: number; vui: number; nl: number; asleep: boolean;
  illness?: string | null; critical_since?: string | null; recover_at?: string | null; sick_since?: string | null;
}
/** Số liệu từ hành động vừa làm, chỉ có khi đang xét ngay sau một hành động (không có khi chỉ mở game hay đồng bộ định kỳ). */
export interface HealthCtx {
  action?: 'feed' | 'play';
  /** feed: bữa vừa ăn có thuộc nhóm ngọt không, và số bữa ngọt hôm nay (tính cả bữa này). */
  lastMealSweet?: boolean; sweetsToday?: number;
  /** play: số lần chơi trong 1 giờ và số lần chơi lúc khuya trong 2 giờ (tính cả lần này). */
  plays1h?: number; nightPlays2h?: number;
  /** Ăn trong 3 ngày gần nhất (tính cả bữa này): số bữa và số nhóm lành mạnh khác nhau. */
  meals3d: number; healthyGroups3d: number;
}

/** Chỉ số đang nguy kịch (thứ tự ưu tiên: No, Sạch, Vui, Năng lượng; Năng lượng không tính lúc ngủ). */
export function criticalStat(s: Pick<HealthState, 'no' | 'sach' | 'vui' | 'nl' | 'asleep'>): HealthStat | null {
  const c = HEALTH.critical;
  if (s.no <= c) return 'no';
  if (s.sach <= c) return 'sach';
  if (s.vui <= c) return 'vui';
  if (s.nl <= c && !s.asleep) return 'nl';
  return null;
}

/** Bệnh do hành động vừa làm gây ra (null = không). Thứ tự ưu tiên: cảm lạnh, căng cơ, sâu răng, thiếu chất. */
export function triggeredByAction(c: HealthCtx): string | null {
  if (c.action === 'play') {
    if ((c.nightPlays2h ?? 0) >= HEALTH.nightPlay.n) return 'cam-lanh';
    if ((c.plays1h ?? 0) >= HEALTH.overplay.n) return 'cang-co';
  }
  if (c.action === 'feed') {
    if (c.lastMealSweet && (c.sweetsToday ?? 0) >= HEALTH.sweetsLimit) return 'sau-rang';
    if (c.meals3d >= HEALTH.malnutrition.meals && c.healthyGroups3d <= HEALTH.malnutrition.maxGroups) return 'thieu-chat';
  }
  return null;
}

/** Khung giờ khuya? (giờ địa phương 0–23) */
export const isNightHour = (h: number) => h >= HEALTH.nightPlay.from || h < HEALTH.nightPlay.to;

export type HealthEvent = 'fell-sick' | 'recovered' | null;
export interface HealthPatch { illness: string | null; critical_since: string | null; recover_at: string | null; sick_since: string | null; event: HealthEvent }

const iso = (ms: number) => new Date(ms).toISOString();
const hoursMs = (h: number) => h * 3600000;

/** Bệnh đang nặng? (không có tiến triển phục hồi suốt `severeHours`.) */
export function isSevere(s: Pick<HealthState, 'illness' | 'sick_since' | 'recover_at'>, nowMs: number): boolean {
  return !!s.illness && !s.recover_at && !!s.sick_since && nowMs - Date.parse(s.sick_since) >= hoursMs(HEALTH.severeHours);
}

/** Hệ số nhân tốc độ giảm của một chỉ số (1 nếu khoẻ). Dùng chung cho decayStats và private.decay_pet. */
export function decayFactor(illness: string | null | undefined, stat: HealthStat, severe: boolean): number {
  const il = illness ? ILLNESS_BY_ID[illness] : null;
  if (!il) return 1;
  return (il.decay[stat] ?? 1) * (severe ? HEALTH.severeK : 1);
}

function fallSick(id: string, nowMs: number, rest: Heal): Pick<HealthPatch, 'illness' | 'sick_since' | 'recover_at' | 'critical_since' | 'event'> {
  return { illness: id, sick_since: iso(nowMs), recover_at: rest.kind === 'time' ? iso(nowMs + hoursMs(rest.hours)) : null, critical_since: null, event: 'fell-sick' };
}

/**
 * Một bước đánh giá sức khoẻ: gọi lúc mở game, mỗi phút khi đang mở, và sau mỗi hành động (kèm `ctx.action`).
 * Đang ốm thì chỉ xét hồi phục; chưa ốm thì xét bệnh do hành động (nếu có) rồi bệnh bỏ bê.
 */
export function healthStep(s: HealthState, ctx: HealthCtx, nowMs: number): HealthPatch {
  let { illness = null, critical_since = null, recover_at = null, sick_since = null } = s;
  let event: HealthEvent = null;
  if (!illness) {
    const byAction = triggeredByAction(ctx);
    if (byAction) { ({ illness, sick_since, recover_at, critical_since, event } = fallSick(byAction, nowMs, ILLNESS_BY_ID[byAction].heal) as HealthPatch); }
    else {
      const c = criticalStat(s);
      if (!c) critical_since = null;
      else if (!critical_since) critical_since = iso(nowMs);
      else if (nowMs - Date.parse(critical_since) >= HEALTH.criticalMinutes * 60000) {
        const il = NEGLECT_ILLNESS[c]; ({ illness, sick_since, recover_at, critical_since, event } = fallSick(il.id, nowMs, il.heal) as HealthPatch);
      }
    }
  } else {
    const il = ILLNESS_BY_ID[illness];
    const h = il?.heal;
    const cured = () => { illness = null; sick_since = null; recover_at = null; critical_since = null; event = 'recovered'; };
    if (!il) cured();
    else if (recover_at && Date.parse(recover_at) <= nowMs) cured();
    else if (h.kind === 'balanced') { if (ctx.healthyGroups3d >= HEALTH.balancedGroups) cured(); }
    else if (h.kind === 'stat') {
      if (s[h.stat] >= HEALTH.fixAt) { if (!recover_at) recover_at = iso(nowMs + hoursMs(h.hours)); }
      else if (s[h.stat] < HEALTH.relapseBelow) recover_at = null;
    }
  }
  return { illness, critical_since, recover_at, sick_since, event };
}

/** Còn bao nhiêu phút nữa thì ốm nếu cứ bỏ bê (null = chưa nguy kịch). */
export function minutesToSick(s: HealthState, nowMs: number): { stat: HealthStat; left: number } | null {
  if (s.illness) return null;
  const c = criticalStat(s); if (!c) return null;
  const since = s.critical_since ? Date.parse(s.critical_since) : nowMs;
  return { stat: c, left: Math.max(0, Math.ceil(HEALTH.criticalMinutes - (nowMs - since) / 60000)) };
}

/** Bé đang nghỉ để khỏi: còn bao nhiêu phút (null = chưa bắt đầu hồi phục). */
export function minutesToRecover(s: HealthState, nowMs: number): number | null {
  if (!s.illness || !s.recover_at) return null;
  return Math.max(0, Math.ceil((Date.parse(s.recover_at) - nowMs) / 60000));
}

/** Giá phòng khám theo độ nặng. */
export const clinicPrice = (severe: boolean) => (severe ? HEALTH.clinicSeverePrice : HEALTH.clinicPrice);

export const STAT_LABEL: Record<HealthStat, string> = { no: 'No', sach: 'Sạch', vui: 'Vui', nl: 'Năng lượng' };
export const BLOCK_LABEL: Record<Block, string> = { play: 'không chơi được đồ chơi', bath: 'không tắm được', sweets: 'không ăn được đồ ngọt' };

/** Mô tả ảnh hưởng của một bệnh cho người chơi đọc. */
export function effectLines(il: Illness): string[] {
  const L: string[] = [];
  const d = (Object.entries(il.decay) as [HealthStat, number][]).map(([k, v]) => `${STAT_LABEL[k]} giảm nhanh ×${String(v).replace('.', ',')}`);
  if (d.length) L.push(d.join(', '));
  il.block.forEach(b => L.push(BLOCK_LABEL[b][0].toUpperCase() + BLOCK_LABEL[b].slice(1)));
  return L;
}

/** Cách tự khỏi, viết cho người chơi đọc. */
export function healLine(il: Illness): string {
  const h = il.heal;
  if (h.kind === 'stat') return `${STAT_LABEL[h.stat]} được chăm lên từ ${HEALTH.fixAt} thì nghỉ ${h.hours} giờ là khỏi`;
  if (h.kind === 'time') return `Tự khỏi sau ${h.hours} giờ nghỉ ngơi`;
  return `Khỏi ngay khi ăn cân bằng (từ ${HEALTH.balancedGroups} nhóm lành mạnh trong 3 ngày)`;
}
