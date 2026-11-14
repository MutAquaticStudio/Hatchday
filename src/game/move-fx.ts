/**
 * Công thức hiệu ứng của 200 chiêu (dữ liệu thuần, không đụng three.js để kiểm thử được). Xem docs/VFX-STYLE-GUIDE.md.
 * Mỗi chiêu = một DẠNG (form: cách chiêu di chuyển) + một HOẠ TIẾT (motif: hình khối bay ra) + màu + tuỳ chọn,
 * chọn theo NGHĨA của tên chiêu. Phần dựng hình nằm ở battle-forms.js; nhịp (số giây từng pha) lấy từ bảng ở đây
 * nên dữ liệu và hình luôn khớp nhau.
 * Cú pháp một công thức: 'dạng hoạ-tiết khoá=giá-trị …'; chiêu kép (hỗ trợ kèm đòn) viết 'hỗ-trợ … | đòn-đánh …'.
 *   n số lượng · c màu chính · c2 màu nhấn · s cỡ · k biến thể của dạng · arc độ vồng · then dạng nối tiếp (summon) · m2 hoạ tiết của phần nối tiếp
 */
import { SPECIES, SPECIES_BY_ID } from './species';
import { movesOf, type Move } from './skills';

/** Bảng màu theo hệ: c chính · c2 sáng (nhấn HDR) · dk tối (bóng, mực) · ac màu phụ. Thứ tự: Mộc, Thuỷ, Phong, Dạ, Hoả. */
export const PALETTE = [
  { c: '#4fd860', c2: '#d4ff7a', dk: '#1f6a34', ac: '#ffd84a' },
  { c: '#38a8ff', c2: '#c8f2ff', dk: '#0f4f9a', ac: '#ffffff' },
  { c: '#6fd4f4', c2: '#f2fdff', dk: '#2a7fb0', ac: '#ffe45a' },
  { c: '#9a5cff', c2: '#e6d4ff', dk: '#1a0a2e', ac: '#ffe9a8' },
  { c: '#ff6a1a', c2: '#ffd23e', dk: '#7a1a08', ac: '#fff2a0' },
] as const;

export type AttackForm = 'shot' | 'volley' | 'melee' | 'ram' | 'beam' | 'rain' | 'erupt' | 'vortex' | 'wave' | 'swarm' | 'meteor' | 'roar' | 'summon' | 'eclipse' | 'bolt' | 'dive' | 'flurry' | 'orbit' | 'burst' | 'lash';
export type SupportForm = 'ward' | 'veil' | 'aura' | 'chant' | 'bloom' | 'rest';
export type Form = AttackForm | SupportForm;

/** Thời lượng pha hành động (giây ở tốc độ ×1) từ lúc ra đòn tới đúng nhịp trúng, theo tầng [cơ bản, tuyệt chiêu, tối thượng]. */
export const FORM_ACT: Record<AttackForm, [number, number, number]> = {
  shot: [0.28, 0.4, 0.6], volley: [0.34, 0.6, 0.9], melee: [0.26, 0.4, 0.6], ram: [0.3, 0.45, 0.7], beam: [0.3, 0.55, 0.9],
  rain: [0.35, 0.65, 1.1], erupt: [0.32, 0.55, 0.9], vortex: [0.35, 0.7, 1.2], wave: [0.34, 0.6, 1.0], swarm: [0.35, 0.7, 1.2],
  meteor: [0.35, 0.6, 0.9], roar: [0.3, 0.5, 0.9], summon: [0.35, 0.7, 1.25], eclipse: [0.35, 0.7, 1.2], bolt: [0.3, 0.5, 0.8],
  dive: [0.35, 0.65, 1.0], flurry: [0.34, 0.65, 1.1], orbit: [0.35, 0.7, 1.1], burst: [0.32, 0.55, 0.9], lash: [0.32, 0.6, 1.0],
};
export const SUPPORT_FORMS: SupportForm[] = ['ward', 'veil', 'aura', 'chant', 'bloom', 'rest'];
export const isSupportForm = (f: string): f is SupportForm => (SUPPORT_FORMS as string[]).includes(f);

/** Nhịp theo tầng (giây, ×1): lấy đà · khựng hình khi trúng (số khung ở 60 khung/giây) · dư âm · trần tổng thời lượng. */
export const TIER_BEATS = [
  { antic: 0.18, stop: 3, follow: 0.3, budget: 0.9 },
  { antic: 0.3, stop: 5, follow: 0.45, budget: 1.6 },
  { antic: 0.95, stop: 8, follow: 0.6, budget: 3.0 },
] as const;
/** Chiêu hỗ trợ: lấy đà · diễn · dư âm (trần 1 giây); bản rút gọn khi là phần sau của chiêu kép. */
export const SUPPORT_BEATS = { antic: 0.15, act: 0.55, follow: 0.25, budget: 1.0 } as const;
export const COMBO_SUPPORT_BEATS = { antic: 0.12, act: 0.4, follow: 0.15 } as const;
/** Đòn liên hoàn: mỗi đòn thêm dài REHIT giây, tối đa 2 đòn thêm (phần nới trần của nét riêng "multi"). */
export const REHIT = 0.2, REHIT_MAX = 2;
/** Khựng hình cộng thêm (khung): chí mạng, khắc hệ; đòn liên hoàn chưa phải đòn cuối chỉ khựng 2 khung. */
export const STOP_CRIT = 3, STOP_SUPER = 1, STOP_MULTI = 2;
/** Các nhịp khác (giây): gây trạng thái, trạng thái cuối lượt, gục, ra sân. */
export const OTHER_BEATS = { status: 0.6, tick: 0.5, faint: 1.2, enter: 1.0, twist: 0.6 } as const;
/** Trần hiệu ứng toàn màn hình. */
export const SCREEN = { flashAlpha: 0.35, flashAlphaReduced: 0.1, flashDur: 0.2, flashGap: 0.34, impactFrame: 0.1 } as const;
/** Ngân sách theo tầng chất lượng ('hatchday-quality'): hệ số số lượng, trần hạt cộng sáng / hạt đặc, trần hình khối (sprite) mỗi mẻ. */
export const QUALITY = {
  thap: { n: 0.5, add: 700, alpha: 400, sprites: 32, trail: 10 },
  vua: { n: 0.8, add: 1800, alpha: 1000, sprites: 64, trail: 16 },
  cao: { n: 1, add: 3000, alpha: 1600, sprites: 96, trail: 20 },
} as const;

/** Hoạ tiết: hình khối cel (xem MOTIF_SHAPES ở battle-forms.js). c/c2 là màu riêng nếu không theo màu hệ; snd là tiếng lúc phóng. */
export const MOTIFS: Record<string, { c?: string; c2?: string; snd: string }> = {
  leaf: { snd: 'leaf' }, petal: { c: '#ffb0d0', c2: '#fff0f6', snd: 'leaf' }, grain: { c: '#f2c64a', c2: '#fff3b0', snd: 'pluck' }, thorn: { snd: 'pluck' },
  flower: { c: '#ffd84a', c2: '#fff6c0', snd: 'chime' }, lotus: { c: '#ff9ac0', c2: '#fff0f6', snd: 'chime' }, bee: { c: '#ffc21e', c2: '#2a1808', snd: 'buzz' }, tree: { c: '#3fa04a', c2: '#b8f08a', snd: 'thump' },
  antler: { c: '#c89a5a', c2: '#fff0c8', snd: 'swish' }, drop: { snd: 'water' }, bubble: { c: '#8fd8ff', c2: '#ffffff', snd: 'bubble' }, pearl: { c: '#f4ecff', c2: '#ffffff', snd: 'chime' },
  shell: { c: '#e8c8a8', c2: '#fff4e4', snd: 'thump' }, scale: { c: '#2a8aff', c2: '#b8f0ff', snd: 'swish' }, crest: { snd: 'swish' }, cloud: { c: '#f4faff', c2: '#ffffff', snd: 'gust' },
  feather: { c: '#f4faff', c2: '#ffffff', snd: 'flap' }, kite: { c: '#ff5a4a', c2: '#ffe08a', snd: 'gust' }, star: { c: '#ffe45a', c2: '#fffbe0', snd: 'chime' }, spark: { c: '#fff6b0', c2: '#ffffff', snd: 'chime' },
  bolt: { c: '#ffe45a', c2: '#ffffff', snd: 'zap' }, moon: { c: '#e6d4ff', c2: '#ffffff', snd: 'shadow' }, eye: { c: '#ffd23e', c2: '#1a0a2e', snd: 'shadow' }, spore: { c: '#c88aff', c2: '#ffe6ff', snd: 'bubble' },
  flame: { snd: 'fire' }, fang: { c: '#f4f4ff', c2: '#ffffff', snd: 'swish' }, fist: { snd: 'swish' }, ball: { c: '#fff8ec', c2: '#ffffff', snd: 'pluck' },
  note: { c: '#ffe45a', c2: '#ffffff', snd: 'drum' }, bird: { c: '#8a6a4a', c2: '#e8d0b0', snd: 'flap' }, bat: { c: '#2a1048', c2: '#9a5cff', snd: 'flap' }, shard: { c: '#b8f0ff', c2: '#ffffff', snd: 'ice' },
  tail: { c: '#e8e4ff', c2: '#ffffff', snd: 'shadow' }, ring: { snd: 'gust' }, zzz: { c: '#e6d4ff', c2: '#ffffff', snd: 'chime' }, plus: { c: '#8dff9e', c2: '#eaffea', snd: 'chime' },
  heart: { c: '#ff8ab0', c2: '#ffe0ea', snd: 'chime' }, sun: { c: '#ffcf3a', c2: '#fff6c0', snd: 'drum' }, lantern: { c: '#ff8a3a', c2: '#ffe9a8', snd: 'chime' },
};

/** Công thức của từng loài theo thứ tự 4 chiêu. Đọc tên chiêu ở skills.ts để hiểu vì sao chọn dạng và hoạ tiết đó. */
const T: Record<string, [string, string, string, string]> = {
  /* ---- Mộc ---- */
  'mam-xanh': ['lash leaf n=1', 'bloom sun', 'erupt leaf k=sprout', 'erupt tree k=tree'],
  'bong-lua': ['volley grain n=6', 'ward grain', 'rain grain n=18', 'wave grain k=field s=1.3'],
  'ong-mat': ['melee bee k=sting', 'bloom drop c=#ffc83a c2=#fff0b0', 'volley thorn n=5 c=#ffd84a c2=#fff6c0 k=line', 'swarm bee n=28'],
  'co-may': ['shot thorn', 'veil leaf', 'orbit thorn n=8', 'wave leaf k=gust s=1.3'],
  'hoa-mai': ['volley petal n=5 c=#ffd84a c2=#fff6c0', 'bloom flower', 'aura petal c=#ffd84a c2=#fff6c0 | flurry petal n=3 c=#ffd84a c2=#fff6c0', 'summon flower then=rain m2=petal n=24'],
  'chuon-chuon': ['ram crest c=#5ad8c8', 'aura ring c=#8fe0ff', 'flurry crest n=3 c=#7af0c0 c2=#eafff4', 'swarm crest n=20 c=#5ad8e8 c2=#eaffff'],
  'de-co': ['melee fist k=kick', 'chant note c=#b8f06a', 'ward note c=#b8f06a | roar note c=#b8f06a n=3', 'burst note c=#b8f06a n=14'],
  'sen-hong': ['melee leaf k=slap s=1.4', 'ward petal', 'bloom lotus | burst petal n=10', 'erupt lotus k=bloom'],
  'nai-co': ['ram antler', 'aura ring', 'erupt antler k=line n=5', 'summon antler then=dive'],
  'lan-vang': ['shot ball arc=1.5 c=#ff5a3a c2=#ffd84a k=bounce', 'chant sun c=#ff5a3a c2=#ffd84a', 'roar ring c=#ffcf3a c2=#fff6c0 n=4', 'dive cloud c=#ffcf3a c2=#fff6c0'],
  /* ---- Thuỷ ---- */
  'ca-bong': ['melee crest k=whip', 'veil bubble', 'orbit bubble n=7', 'wave crest k=tidal s=1.5'],
  'oc-gao': ['volley bubble n=5', 'ward shell', 'ward shard c=#9ab0c0 | ram shell k=roll', 'meteor shell s=1.3'],
  'giot-mua': ['shot drop', 'bloom drop', 'rain drop n=22', 'summon cloud c=#8aa0c0 c2=#e0ecff then=rain m2=drop n=30'],
  'tom-tit': ['melee fist k=punch c=#ff7a5a', 'rest shell c=#ff9a7a k=moult', 'roar ring k=snap n=3 c2=#ffffff', 'ram crest c=#ff5a4a c2=#ffd0c0 k=surf'],
  'rua-dam': ['melee fang k=bite', 'ward shell c=#5ab08a c2=#d0ffe8', 'ward scale c=#2a6a8a | erupt drop k=pillar', 'summon shell c=#3a8a7a c2=#c8fff0 then=wave'],
  'sua-bien': ['lash bolt n=1 c=#b8f0ff', 'veil crest c=#c8b8ff', 'lash moon n=4 c=#c8b8ff c2=#ffffff', 'summon moon c=#c8d8ff then=wave k=tidal'],
  'rai-ca': ['shot ball arc=1.3 c=#9aa8b0 c2=#e8f0f4', 'bloom heart', 'vortex crest', 'wave fang k=pack s=1.2'],
  'ca-heo-hong': ['ram drop c=#ff9ac8 c2=#ffe6f2', 'chant ring c=#ff9ac8', 'roar ring c=#ff9ac8 c2=#ffe6f2 n=5', 'dive crest c=#ff9ac8 c2=#ffe6f2'],
  'ngoc-trai': ['beam pearl', 'ward shell c=#f0e8ff c2=#ffffff', 'bloom pearl | beam pearl', 'orbit pearl n=16'],
  'long-thuy': ['melee scale k=whip', 'aura cloud c=#8ab8e8', 'rain scale n=14 k=slant', 'lash scale k=dragon n=1 s=2.2'],
  /* ---- Phong ---- */
  'bong-may': ['ram cloud', 'rest cloud', 'rain cloud n=9 s=1.3', 'orbit cloud n=10 s=1.7'],
  'se-nau': ['melee thorn k=peck c=#c89a5a c2=#fff0c8', 'bloom feather c=#c8a070 c2=#fff0d8', 'flurry feather n=4 c=#c8a070 c2=#fff0d8', 'swarm bird n=26'],
  'dieu-giay': ['shot kite k=spin', 'aura crest', 'dive kite', 'summon kite then=bolt n=3'],
  'gio-nhe': ['wave crest k=gust s=0.7', 'bloom leaf c=#b8f0e0 c2=#f0fff8', 'vortex crest', 'wave crest k=gale n=5 s=1.4'],
  'cau-vong': ['beam spark k=rainbow', 'bloom drop k=rainbow', 'volley spark n=7 k=rainbow', 'lash ring n=2 k=rainbow s=1.6'],
  'hai-au': ['dive feather s=0.7', 'aura feather', 'ram crest c=#ffffff c2=#c8f2ff k=surf', 'vortex feather k=storm'],
  'sao-bang': ['shot star', 'aura star', 'lash star n=1 k=snake', 'rain star n=14 k=slant s=1.3'],
  'may-ngu-sac': ['melee cloud k=whip', 'veil cloud c=#ffb070 c2=#ffe8c8', 'ward cloud k=rainbow | volley cloud n=5 k=rainbow', 'summon cloud k=rainbow then=beam'],
  'hac-trang': ['melee thorn k=peck c=#ffffff c2=#ff5a4a', 'ward feather', 'aura feather | flurry feather n=3', 'dive feather k=high s=1.4'],
  'chim-lac': ['melee crest k=whip c=#d8a04a c2=#fff0c0', 'chant sun c=#d8a04a c2=#fff0c0', 'roar sun c=#d8a04a c2=#fff0c0 n=3', 'summon sun c=#d8a04a c2=#fff0c0 then=swarm m2=bird n=18'],
  /* ---- Dạ ---- */
  'nam-ngu': ['shot spore k=puff', 'rest zzz', 'ward spore | rain spore n=8', 'erupt spore k=grove n=7'],
  'dom-dom': ['shot spark c=#d8ff5a c2=#ffffff', 'aura lantern c=#d8ff5a c2=#ffffff', 'bolt spark c=#d8ff5a n=1', 'swarm lantern n=24 c=#e8ff7a c2=#ffffff'],
  'cu-meo': ['dive feather c=#7a5ab8 c2=#e6d4ff s=0.7', 'ward eye', 'aura eye | beam eye', 'summon eye then=flurry m2=feather n=6'],
  'doi-nho': ['melee fang k=bite c=#e6d4ff', 'rest bat k=flip', 'roar ring c=#c89aff c2=#ffffff n=5', 'swarm bat n=24'],
  'trang-khuyet': ['melee moon k=claw', 'bloom moon', 'shot moon k=blade s=1.7', 'eclipse moon'],
  'cao-bac': ['melee crest k=claw c=#e8e8ff c2=#ffffff', 'veil tail', 'volley flame n=3 c=#7ab8ff c2=#e8f6ff k=fan', 'summon tail then=volley m2=flame n=9 c=#7ab8ff c2=#e8f6ff'],
  'meo-muop': ['melee crest k=claw c=#ffb03a c2=#fff0c0', 'rest zzz c=#ffd8a0', 'flurry crest n=3 k=claw c=#ffb03a c2=#fff0c0', 'burst ring c=#ffb03a c2=#fff0c0 n=3'],
  'ma-troi': ['shot flame c=#5ae0d0 c2=#e0fffa', 'veil flame c=#5ae0d0 c2=#e0fffa', 'lash flame n=3 c=#5ae0d0 c2=#e0fffa k=snake', 'wave flame c=#5ae0d0 c2=#e0fffa k=parade n=7'],
  'huou-sao': ['melee star k=kick', 'bloom star', 'rain star n=9 c=#c8b0ff c2=#ffffff', 'summon star c=#c8b0ff then=bolt k=pillar n=1'],
  'tho-ngoc': ['melee fist k=pound c=#c8ffd8', 'aura spark c=#c8ffd8', 'bloom pearl c=#a8ffc8 | dive fist c=#c8ffd8 s=0.8', 'meteor moon s=1.4'],
  /* ---- Hoả ---- */
  'banh-bo': ['shot cloud c=#ffe8d8 k=puff', 'rest flame', 'erupt cloud k=pillar c=#fff0e4', 'burst flame n=16'],
  'xoi-gac': ['melee fist k=punch c=#ff3a2a', 'aura flame c=#ff3a2a', 'flurry fist n=4 c=#ff3a2a c2=#ffd23e', 'ram flame c=#ff3a2a k=comet'],
  'che-ba-mau': ['volley shard n=4', 'aura ring k=tri', 'erupt shard k=spikes n=3', 'summon ring k=tri then=beam'],
  'banh-troi': ['ram ball k=roll c=#f6e6cc c2=#c87a3a', 'bloom drop c=#c87a3a c2=#ffd8a0', 'volley ball n=3 arc=1.5 s=1.3 c=#f6e6cc c2=#c87a3a', 'meteor ball s=1.5 c=#f6e6cc c2=#c87a3a'],
  'banh-flan': ['melee drop k=slap c=#e8902a c2=#ffe08a', 'ward bubble c=#ffc85a c2=#fff3c8', 'shot fist s=1.8 c=#e8902a c2=#ffe08a k=palm', 'erupt flame k=lava c=#e8902a'],
  'tra-sua': ['shot pearl c=#5a3420 c2=#e8c8a0', 'aura spark c=#e8c8a0', 'volley pearl n=8 c=#5a3420 c2=#e8c8a0 k=line', 'vortex pearl c=#5a3420 c2=#e8c8a0'],
  'banh-bao': ['burst cloud s=0.6 n=6', 'ward cloud c=#fff4e0', 'orbit cloud n=6 c=#fff4e0', 'vortex cloud k=steam'],
  'banh-trung-thu': ['ram sun c=#c8742a c2=#ffe08a', 'bloom moon c=#ffe08a k=full', 'ward sun c=#c8742a c2=#ffe08a | shot sun c=#c8742a c2=#ffe08a k=spin', 'summon moon c=#ffe08a then=rain m2=lantern n=12'],
  'keo-bong-gon': ['lash cloud n=1 c=#ff9ad0 c2=#ffe6f4', 'bloom heart c=#ff9ad0', 'ward cloud c=#ff9ad0 c2=#ffe6f4 | lash cloud n=3 c=#ff9ad0 c2=#ffe6f4', 'vortex cloud c=#ff9ad0 c2=#ffe6f4 k=big'],
  'lua-bep': ['beam flame k=breath', 'aura flame', 'erupt flame k=pillar', 'summon flame then=meteor m2=flame'],
};

export interface Beats { antic: number; act: number; /** khựng hình, giây */ stop: number; follow: number; total: number; budget: number }
export interface Recipe {
  id: string; src: string; form: Form; motif: string; element: number; /** 0 cơ bản · 1 tuyệt chiêu · 2 tối thượng */ cls: 0 | 1 | 2; support: boolean;
  c: string; c2: string; dk: string; ac: string; n: number; s: number; k: string; arc: number; then?: AttackForm; m2?: string;
  /** đòn kèm của chiêu kép */ strike?: Recipe; beats: Beats; snd: string;
}

function parse(src: string, el: number, cls: 0 | 1 | 2, id: string): Recipe {
  const [form, motif, ...rest] = src.trim().split(/\s+/), o: Record<string, string> = {};
  for (const kv of rest) { const i = kv.indexOf('='); o[kv.slice(0, i)] = kv.slice(i + 1); }
  const P = PALETTE[el], M = MOTIFS[motif] || { snd: 'launch' }, support = isSupportForm(form);
  let beats: Beats;
  if (support) { const b = SUPPORT_BEATS; beats = { antic: b.antic, act: b.act, stop: 0, follow: b.follow, total: b.antic + b.act + b.follow, budget: b.budget }; }
  else { const b = TIER_BEATS[cls], act = (FORM_ACT[form as AttackForm] || [0.3, 0.5, 0.9])[cls], stop = b.stop / 60; beats = { antic: b.antic, act, stop, follow: b.follow, total: b.antic + act + stop + b.follow, budget: b.budget }; }
  return { id, src, form: form as Form, motif, element: el, cls, support, c: o.c || M.c || P.c, c2: o.c2 || (o.c ? '#ffffff' : M.c2 || P.c2), dk: P.dk, ac: P.ac,
    n: +(o.n || 0), s: +(o.s || 1), k: o.k || '', arc: +(o.arc || 0), then: o.then as AttackForm | undefined, m2: o.m2, beats, snd: M.snd };
}

const cache = new Map<string, Recipe>();
/** Công thức hiệu ứng của một chiêu (theo id 'loài-số'). Chiêu lạ thì rơi về đòn bắn cơ bản theo hệ, không bao giờ ném lỗi. */
export function recipeOf(m: Pick<Move, 'id' | 'element' | 'kind'>): Recipe {
  const hit = cache.get(m.id); if (hit) return hit;
  const cut = m.id.lastIndexOf('-'), sp = m.id.slice(0, cut), idx = Math.max(0, Math.min(3, (+m.id.slice(cut + 1) || 1) - 1)), row = T[sp];
  const cls: 0 | 1 | 2 = idx === 3 ? 2 : idx === 2 ? 1 : 0, el = SPECIES_BY_ID[sp]?.region ?? m.element ?? 0;
  const src = row ? row[idx] : m.kind === 'attack' ? 'shot ' + ['leaf', 'drop', 'crest', 'moon', 'flame'][el] : m.kind === 'guard' ? 'ward ring' : m.kind === 'boost' ? 'aura ring' : 'bloom plus';
  const [main, extra] = src.split('|'), r = parse(main, el, cls, m.id);
  if (r.support && cls === 1) {
    // chiêu kép: đòn kèm chạy theo nhịp đòn cơ bản, phần hỗ trợ rút gọn; tổng vẫn nằm trong trần của tuyệt chiêu
    r.strike = parse(extra || (row ? row[0] : 'shot leaf'), el, 0, m.id + 's');
    const b = COMBO_SUPPORT_BEATS; r.beats = { antic: b.antic, act: b.act, stop: 0, follow: b.follow, total: r.strike.beats.total + b.antic + b.act + b.follow, budget: TIER_BEATS[1].budget };
  }
  cache.set(m.id, r); return r;
}
/** Mọi công thức của mọi loài (để kiểm thử và trình xem thử). */
export function allRecipes(): { species: string; move: Move; recipe: Recipe }[] {
  return SPECIES.flatMap(sp => movesOf(sp.id).map(move => ({ species: sp.id, move, recipe: recipeOf(move) })));
}
/** Tổng thời lượng một chiêu ở tốc độ ×1 kể cả phần nới của đòn liên hoàn (hits đòn). */
export const moveDuration = (r: Recipe, hits = 1) => r.beats.total + Math.min(REHIT_MAX, Math.max(0, hits - 1)) * REHIT;
