/**
 * 50 loài thú của Hatchday, chia 5 miền × 4 độ hiếm, cùng luật lớn lên theo tuổi và dáng trưởng thành.
 * Nguyên tắc thiết kế (để không giống game khác):
 * - Quái thú cel-shading, mỗi loài một dáng riêng (bốn chân, hai chân, chim, rắn) dựng trong monster.js.
 * - Cảm hứng từ thiên nhiên, đồ vật, truyện dân gian Việt Nam. 5 hệ theo miền (skills.ts), đấu theo lượt ở Đấu trường; không bắt thú.
 * - Lớn lên theo số ngày sống. Dáng trưởng thành do cách người chơi chăm (ăn / chơi / thương / tắm), không do cấp độ.
 * Danh sách loài cũng nằm trong bảng `public.species` (scripts/gen-seed.ts sinh ra, test so khớp).
 */

import { _t } from '../i18n';
export type Rarity = 'thuong' | 'hiem' | 'quy' | 'huyen';
export type Body = 'tron' | 'le' | 'dai' | 'det' | 'giot';
export type Ears = 'meo' | 'tho' | 'gau' | 'cup' | 'vay' | 'sung' | 'ang' | 'la' | 'long' | 'none';
export type Top = 'none' | 'mam' | 'hoa' | 'may' | 'sao' | 'nam' | 'lua' | 'giot' | 'trang' | 'xoay' | 'chom';
export type Tail = 'none' | 'tron' | 'xu' | 'xoan' | 'ca' | 'la' | 'sao' | 'may';
export type Pattern = 'none' | 'bung' | 'dom' | 'soc' | 'ma' | 'cauvong';
export type Extra = 'canh' | 'vay' | 'mai' | 'oc' | 'bom' | 'gai' | 'coan' | 'hao' | 'ria' | 'tua';
/** Dáng cơ thể: bánh dẻo tròn, bốn chân, đứng hai chân, chim, bay lượn (cá/rồng/đuôi dài). */
export type Plan = 'banh' | 'thu4' | 'dung' | 'chim' | 'ran';
export type Stage = 'baby' | 'child' | 'teen' | 'adult' | 'elder';
export type Form = 'tron' | 'nhanh' | 'thuong' | 'sang';

export interface Palette { body: string; deep: string; ink: string; inner: string; accent: string }
export interface Species {
  id: string; name: string; region: number; rarity: Rarity;
  body: Body; ears: Ears; top: Top; tail: Tail; pattern: Pattern; extra: Extra[];
  pal: Palette; blurb: string; plan: Plan;
}

export const REGIONS = [
  { name: _t('Đồng Nội'), egg: _t('Trứng Đồng Nội'), color: '#bfe8a8', dot: '#fff3a8' },
  { name: _t('Sông Nước'), egg: _t('Trứng Sông Nước'), color: '#a8d8ff', dot: '#ffffff' },
  { name: _t('Mây Trời'), egg: _t('Trứng Mây Trời'), color: '#e6e0ff', dot: '#ffffff' },
  { name: _t('Rừng Đêm'), egg: _t('Trứng Rừng Đêm'), color: '#b9b0ee', dot: '#fff27a' },
  { name: _t('Góc Bếp'), egg: _t('Trứng Góc Bếp'), color: '#ffd9b0', dot: '#ff8a8a' },
] as const;

export const RARITIES: Record<Rarity, { name: string; weight: number; color: string }> = {
  thuong: { name: _t('Thường'), weight: 8, color: '#8a7a8a' },
  hiem: { name: _t('Hiếm'), weight: 4, color: '#3f8fd8' },
  quy: { name: _t('Quý'), weight: 2, color: '#9a4ad8' },
  huyen: { name: _t('Huyền thoại'), weight: 1, color: '#e08a00' },
};

const P = (body: string, deep: string, ink: string, inner = '#ffb3c9', accent = deep): Palette => ({ body, deep, ink, inner, accent });
const s = (id: string, name: string, region: number, rarity: Rarity, body: Body, ears: Ears, top: Top, tail: Tail, pattern: Pattern, extra: Extra[], pal: Palette, blurb: string): Species =>
  ({ id, name, region, rarity, body, ears, top, tail, pattern, extra, pal, blurb, plan: PLAN[id] || 'banh' });

/** Dáng cơ thể của từng loài (loài không có tên ở đây là bánh dẻo tròn). Sơ sinh thì loài nào cũng tròn. */
const PLAN: Record<string, Plan> = {
  'mam-xanh': 'dung', 'bong-lua': 'thu4', 'co-may': 'dung', 'hoa-mai': 'thu4', 'chuon-chuon': 'ran', 'de-co': 'thu4', 'sen-hong': 'dung', 'nai-co': 'thu4', 'lan-vang': 'thu4',
  'ca-bong': 'ran', 'tom-tit': 'ran', 'rua-dam': 'thu4', 'rai-ca': 'thu4', 'ca-heo-hong': 'ran', 'long-thuy': 'ran',
  'se-nau': 'chim', 'dieu-giay': 'ran', 'gio-nhe': 'dung', 'cau-vong': 'thu4', 'hai-au': 'chim', 'hac-trang': 'chim', 'chim-lac': 'chim',
  'nam-ngu': 'dung', 'cu-meo': 'chim', 'doi-nho': 'chim', 'trang-khuyet': 'thu4', 'cao-bac': 'thu4', 'meo-muop': 'thu4', 'ma-troi': 'ran', 'huou-sao': 'thu4', 'tho-ngoc': 'dung',
  'xoi-gac': 'dung', 'che-ba-mau': 'dung', 'tra-sua': 'dung', 'lua-bep': 'dung',
};

export const SPECIES: Species[] = [
  // ---- Đồng Nội ----
  s('mam-xanh', _t('Diệp Nha'), 0, 'thuong', 'tron', 'gau', 'mam', 'tron', 'bung', [], P('#cdeec0', '#a9dc98', '#4d7a3f', '#ffc2cf', '#7edb72'), _t('Chồi trên đầu hút nắng, đủ sức xé toạc đá tảng.')),
  s('bong-lua', _t('Kim Túc'), 0, 'thuong', 'le', 'long', 'none', 'xu', 'soc', [], P('#ffe7a3', '#f5cf6e', '#8a6a2a', '#ffc2a8'), _t('Gai lưng như lúa chín, rũ mình là mưa thóc.')),
  s('ong-mat', _t('Phong Châm'), 0, 'thuong', 'tron', 'ang', 'none', 'tron', 'soc', ['canh'], P('#ffe28a', '#ffc94a', '#7a5a1a', '#ffb3a0', '#6a4a2a'), _t('Vo ve như giông, kim đuôi xuyên vỏ cây.')),
  s('co-may', _t('Thảo Ảnh'), 0, 'thuong', 'dai', 'la', 'none', 'la', 'none', [], P('#d8f0b0', '#b8dc84', '#5a7a2e', '#ffc2cf'), _t('Nấp trong cỏ may, gai nó bám theo bóng kẻ thù.')),
  s('hoa-mai', _t('Hoàng Mai'), 0, 'hiem', 'tron', 'meo', 'hoa', 'tron', 'bung', ['coan'], P('#fff0c8', '#ffd98a', '#9a6a2a', '#ffb3a0', '#ffd23e'), _t('Nở giữa rét Tết, cánh sắc như dao.')),
  s('chuon-chuon', _t('Thanh Dực'), 0, 'hiem', 'giot', 'ang', 'none', 'none', 'ma', ['canh'], P('#c8f0ea', '#8edccc', '#2e7a6a', '#ffc2cf', '#a8e8ff'), _t('Cánh mỏng như ngọc, lướt qua cỏ đứt.')),
  s('de-co', _t('Lục Khúc'), 0, 'hiem', 'le', 'ang', 'none', 'none', 'ma', ['gai'], P('#c9e09a', '#a2c46a', '#4e6a24', '#ffc2a8'), _t('Đá hậu gãy cọc tre, tiếng gáy ru địch ngủ.')),
  s('sen-hong', _t('Liên Hoa'), 0, 'quy', 'tron', 'none', 'hoa', 'la', 'none', ['coan'], P('#ffe0ea', '#ffc0d4', '#9a4a6a', '#ff9fbe', '#ff8fb6'), _t('Mọc từ bùn, hương sen làm địch chùn tay.')),
  s('nai-co', _t('Lộc Diệp'), 0, 'quy', 'dai', 'sung', 'hoa', 'tron', 'dom', [], P('#f2d8b8', '#e2b98a', '#7a5232', '#ffc2cf', '#fff6e0'), _t('Gạc mọc lá non, húc một cú xuyên cả rừng.')),
  s('lan-vang', _t('Kim Lân'), 0, 'huyen', 'tron', 'sung', 'chom', 'xu', 'dom', ['hao', 'ria'], P('#ffe9b0', '#ffcf6e', '#9a5a1a', '#ff9f9f', '#ff6a4a'), _t('Thức dậy theo trống hội, tiếng hống rung cả làng.')),
  // ---- Sông Nước ----
  s('ca-bong', _t('Lam Ngư'), 1, 'thuong', 'giot', 'vay', 'none', 'ca', 'bung', [], P('#c8e6ff', '#9fd0ff', '#3a5a8a', '#ffc2cf'), _t('Cá thần giếng cổ, quẫy đuôi là nổi sóng.')),
  s('oc-gao', _t('Thạch Loa'), 1, 'thuong', 'det', 'ang', 'none', 'none', 'none', ['oc'], P('#ffe2cc', '#ffc9a6', '#8a5a3a', '#ffb3c9', '#f2a6c0'), _t('Vỏ cứng như đá sông, búa nện cũng bật ra.')),
  s('giot-mua', _t('Vũ Châu'), 1, 'thuong', 'giot', 'none', 'giot', 'none', 'ma', [], P('#d6efff', '#a8dcff', '#3a6a9a', '#ffc2cf'), _t('Sinh từ mưa ngâu, giận lên là trút mưa rào.')),
  s('tom-tit', _t('Xích Giáp'), 1, 'thuong', 'dai', 'ang', 'none', 'ca', 'soc', [], P('#ffcfc0', '#ffaa94', '#9a4a3a', '#ffe0a8'), _t('Búng càng như sấm, lột xác là cứng thêm.')),
  s('rua-dam', _t('Huyền Quy'), 1, 'hiem', 'det', 'none', 'mam', 'tron', 'none', ['mai'], P('#cfe8c4', '#9ccc8a', '#4a6a3a', '#ffc2cf', '#c49a6c'), _t('Mai phủ rêu nghìn năm, đã cắn là không nhả.')),
  s('sua-bien', _t('Hải Nguyệt'), 1, 'hiem', 'giot', 'none', 'none', 'none', 'ma', ['tua'], P('#f0dcff', '#dcbcff', '#6a4a9a', '#ffb3dc', '#ffc6f0'), _t('Xúc tu sáng ánh trăng, chạm vào là tê dại.')),
  s('rai-ca', _t('Thuỷ Lang'), 1, 'hiem', 'dai', 'gau', 'none', 'xu', 'bung', ['ria'], P('#e8cbb0', '#cfa27e', '#6a4a32', '#ffc2cf'), _t('Săn bầy ngược thác, quẫy đuôi thành xoáy.')),
  s('ca-heo-hong', _t('Hồng Kình'), 1, 'quy', 'giot', 'vay', 'none', 'ca', 'bung', [], P('#ffd6e8', '#ffb0d0', '#9a4a72', '#ff9fbe'), _t('Gầm từ đáy sông, sóng âm vỡ mạn thuyền.')),
  s('ngoc-trai', _t('Minh Châu'), 1, 'quy', 'tron', 'vay', 'giot', 'ca', 'ma', ['coan'], P('#f4f0ff', '#ddd6f8', '#6a6a9a', '#ffc2dc', '#ffffff'), _t('Ngọc giếng Mỵ Châu, chói loá mắt kẻ thù.')),
  s('long-thuy', _t('Thuỷ Long'), 1, 'huyen', 'dai', 'sung', 'none', 'ca', 'soc', ['vay', 'hao', 'ria'], P('#c4f0f0', '#8ad8dc', '#2a6a7a', '#ffc2cf', '#ffd23e'), _t('Gọi mưa cứu lúa, nổi giận nhấn chìm cả bến.')),
  // ---- Mây Trời ----
  s('bong-may', _t('Vân Miên'), 2, 'thuong', 'tron', 'none', 'may', 'may', 'none', [], P('#f8f8ff', '#e2e2f6', '#6a6a9a', '#ffc2dc'), _t('Thân mây giông, húc phải là choáng váng.')),
  s('se-nau', _t('Phong Tước'), 2, 'thuong', 'tron', 'long', 'none', 'tron', 'bung', ['canh'], P('#e8d0b4', '#c9a27e', '#6a4a32', '#ffc2a8'), _t('Kéo đàn che trời, mổ nhanh hơn gió.')),
  s('dieu-giay', _t('Chỉ Diên'), 2, 'thuong', 'giot', 'none', 'none', 'sao', 'soc', [], P('#ffd0d0', '#ff9e9e', '#9a3a3a', '#ffe0a8', '#7ab8ff'), _t('Đứt dây là hoá dữ, cưỡi gió xé mây.')),
  s('gio-nhe', _t('Thanh Phong'), 2, 'thuong', 'dai', 'la', 'xoay', 'xoan', 'ma', [], P('#dff6f0', '#b6e8dc', '#3a7a6a', '#ffc2cf'), _t('Đi đâu lốc theo đó, cuốn bay mái tranh.')),
  s('cau-vong', _t('Thất Sắc'), 2, 'hiem', 'tron', 'meo', 'none', 'xu', 'cauvong', [], P('#fff0f6', '#ffd0e6', '#8a4a72', '#ffb3c9'), _t('Hiện sau giông, bảy sắc lông chói hoa mắt.')),
  s('hai-au', _t('Hải Vũ'), 2, 'hiem', 'giot', 'none', 'none', 'tron', 'bung', ['canh'], P('#ffffff', '#dfe6f0', '#4a5a7a', '#ffc2cf', '#ffc94a'), _t('Lượn trong mắt bão, sà xuống như mũi lao.')),
  s('sao-bang', _t('Lưu Tinh'), 2, 'hiem', 'tron', 'none', 'sao', 'sao', 'ma', [], P('#fff4c8', '#ffe08a', '#8a6a2a', '#ffc2a8'), _t('Rơi từ trời xuống, đuôi còn vệt sao cháy.')),
  s('may-ngu-sac', _t('Ngũ Vân'), 2, 'quy', 'tron', 'long', 'may', 'may', 'cauvong', ['canh'], P('#f0e6ff', '#d6c4ff', '#5a4a9a', '#ffb3dc'), _t('Khoác ráng năm sắc, vỗ cánh dựng tường mây.')),
  s('hac-trang', _t('Bạch Hạc'), 2, 'quy', 'dai', 'long', 'chom', 'tron', 'none', ['canh'], P('#ffffff', '#e6e6ee', '#3a3a5a', '#ffc2cf', '#ff5a5a'), _t('Một chân canh cửa đình, mỏ nhọn như giáo.')),
  s('chim-lac', _t('Lạc Điểu'), 2, 'huyen', 'giot', 'long', 'chom', 'xu', 'soc', ['canh', 'hao'], P('#ffe6b8', '#ffcf7a', '#8a4a1a', '#ffb3a0', '#ff7a3a'), _t('Thoát từ trống đồng, kêu vang như sấm.')),
  // ---- Rừng Đêm ----
  s('nam-ngu', _t('Mộng Khuẩn'), 3, 'thuong', 'det', 'none', 'nam', 'none', 'bung', [], P('#f6e6d8', '#e0c6ae', '#6a4a3a', '#ffc2cf', '#ff7a8a'), _t('Bào tử của nó làm địch lạc trong mơ.')),
  s('dom-dom', _t('Huỳnh Quang'), 3, 'thuong', 'giot', 'ang', 'none', 'sao', 'none', ['canh'], P('#c8c4f0', '#a6a0e0', '#3a3a7a', '#ffc2dc', '#fff27a'), _t('Một chớp đèn đuôi, địch loá cả mắt.')),
  s('cu-meo', _t('Dạ Kiêu'), 3, 'thuong', 'tron', 'long', 'none', 'tron', 'bung', ['canh'], P('#d8c6b0', '#b89e80', '#5a4232', '#ffc2a8'), _t('Mắt xuyên đêm, vồ mồi không một tiếng động.')),
  s('doi-nho', _t('Dạ Dực'), 3, 'thuong', 'tron', 'meo', 'none', 'none', 'bung', ['canh'], P('#d6c8e8', '#b6a2d6', '#4a3a6a', '#ffb3dc'), _t('Treo ngược trong hang, tiếng rít làm mù lối.')),
  s('trang-khuyet', _t('Khuyết Nguyệt'), 3, 'hiem', 'tron', 'meo', 'trang', 'xu', 'ma', [], P('#dcd6ff', '#b8aef0', '#4a428a', '#ffb3dc', '#ffe58a'), _t('Sừng trăng khuyết, chém đâu tối sầm đó.')),
  s('cao-bac', _t('Ngân Hồ'), 3, 'hiem', 'le', 'meo', 'none', 'xu', 'bung', [], P('#e6e6f0', '#c4c4d8', '#4a4a6a', '#ffc2cf'), _t('Ba đuôi lửa bạc, đủ chín đuôi thành hồ tinh.')),
  s('meo-muop', _t('Hổ Miêu'), 3, 'hiem', 'tron', 'meo', 'none', 'xoan', 'soc', ['ria'], P('#f0dcc0', '#d6b48a', '#6a4a2a', '#ffb3c9'), _t('Lim dim như mèo, vồ lên thì vuốt hổ xé đá.')),
  s('ma-troi', _t('Lân Hoả'), 3, 'quy', 'giot', 'none', 'lua', 'xoan', 'ma', [], P('#d6f0ff', '#a8dcff', '#3a5a9a', '#ffc2dc', '#7ad6ff'), _t('Lửa lạnh lập loè trên gò mả, dụ người lạc lối.')),
  s('huou-sao', _t('Tinh Lộc'), 3, 'quy', 'dai', 'sung', 'none', 'tron', 'dom', [], P('#ccc4f0', '#a8a0e0', '#4a3a8a', '#ffb3dc', '#fff2a8'), _t('Gạc chở sao trời, giẫm xuống sao rơi.')),
  s('tho-ngoc', _t('Ngọc Thố'), 3, 'huyen', 'tron', 'tho', 'trang', 'tron', 'ma', ['hao'], P('#f4f8ff', '#dfe6ff', '#5a62a0', '#ffb3c9', '#ffe58a'), _t('Canh lò thuốc cung trăng, chày ngọc giã nát cả đá.')),
  // ---- Góc Bếp ----
  s('banh-bo', _t('Phù Bính'), 4, 'thuong', 'det', 'gau', 'none', 'none', 'ma', [], P('#fff4e0', '#f6d8a8', '#8a6a3a', '#ffc2cf'), _t('Bụng ủ lửa, phồng to rồi nổ bùng.')),
  s('xoi-gac', _t('Xích Nhu'), 4, 'thuong', 'tron', 'gau', 'mam', 'none', 'dom', [], P('#ffb4a0', '#ff8a70', '#9a3a2a', '#ffe0a8', '#fff6e0'), _t('Đỏ như gấc chín, nóng máu là tung quyền lửa.')),
  s('che-ba-mau', _t('Tam Sắc'), 4, 'thuong', 'dai', 'none', 'xoay', 'none', 'cauvong', [], P('#fff0c8', '#ffd98a', '#8a5a3a', '#ffc2cf'), _t('Vỏ băng lõi lửa, ba tầng đều bỏng.')),
  s('banh-troi', _t('Bạch Hoàn'), 4, 'thuong', 'tron', 'none', 'none', 'none', 'none', ['bom'], P('#fffaf0', '#f0e6d6', '#8a7a5a', '#ffc2cf'), _t('Lõi đường nóng chảy, lăn như thiên thạch.')),
  s('banh-flan', _t('Hổ Phách'), 4, 'hiem', 'det', 'none', 'none', 'none', 'ma', [], P('#ffe8a0', '#ffd06a', '#8a5a1a', '#ffb3a0', '#b8662e'), _t('Hổ phách sóng sánh, giận là hoá dung nham.')),
  s('tra-sua', _t('Trân Châu'), 4, 'hiem', 'dai', 'meo', 'none', 'none', 'dom', [], P('#e8d0b8', '#ceaa86', '#6a4a32', '#ffc2cf', '#4a3020'), _t('Nhả trân châu bỏng rát như đạn ghém.')),
  s('banh-bao', _t('Vân Bao'), 4, 'hiem', 'tron', 'gau', 'xoay', 'none', 'none', ['bom'], P('#fffaf2', '#efe2cc', '#8a7a5a', '#ffc2cf', '#ff9a7a'), _t('Phì hơi như xửng hấp, lại gần là bỏng.')),
  s('banh-trung-thu', _t('Nguyệt Bính'), 4, 'quy', 'det', 'none', 'hoa', 'none', 'dom', ['coan'], P('#f2c48a', '#d9a060', '#7a4a1a', '#ffc2a8', '#fff0c8'), _t('Vỏ nướng như khiên, rực sáng đêm rằm.')),
  s('keo-bong-gon', _t('Đường Vân'), 4, 'quy', 'tron', 'long', 'may', 'may', 'none', [], P('#ffd6ec', '#ffb0d8', '#9a4a7a', '#ff9fbe', '#b8e4ff'), _t('Quấn tơ đường nóng, càng giãy càng dính.')),
  s('lua-bep', _t('Táo Hoả'), 4, 'huyen', 'tron', 'sung', 'lua', 'xoan', 'bung', ['hao'], P('#ffd0a8', '#ffaa7a', '#9a4a2a', '#ffb3a0', '#ffd23e'), _t('Lửa bếp thời Ông Táo, giận lên thiêu cả trời.')),
];

export const SPECIES_BY_ID: Record<string, Species> = Object.fromEntries(SPECIES.map(x => [x.id, x]));

/** Chọn một loài theo trọng số độ hiếm trong miền của quả trứng. `r` trong [0, 1). Cùng công thức với SQL. */
export function pickSpecies(region: number, r: number): Species {
  const pool = SPECIES.filter(x => x.region === region).sort((a, b) => (a.id < b.id ? -1 : 1));
  const total = pool.reduce((t, x) => t + RARITIES[x.rarity].weight, 0);
  let acc = 0; const target = r * total;
  for (const x of pool) { acc += RARITIES[x.rarity].weight; if (target < acc) return x; }
  return pool[pool.length - 1];
}

/* ---------------- Lớn lên ---------------- */
export const STAGES: Record<Stage, { name: string; from: number; scale: number }> = {
  baby: { name: _t('Sơ sinh'), from: 0, scale: 0.72 },
  child: { name: _t('Nhí'), from: 2, scale: 0.84 },
  teen: { name: _t('Thiếu niên'), from: 7, scale: 0.93 },
  adult: { name: _t('Trưởng thành'), from: 14, scale: 1 },
  elder: { name: _t('Xế chiều'), from: -5, scale: 0.97 },
};
export const STAGE_ORDER: Stage[] = ['baby', 'child', 'teen', 'adult', 'elder'];
/** Giai đoạn theo số ngày tuổi. Xế chiều là 5 ngày cuối của tuổi thọ (tuổi thọ chỉ server biết). */
export function stageForAge(days: number, lifespan: number): Stage {
  if (days >= lifespan - 5) return 'elder';
  if (days >= STAGES.adult.from) return 'adult';
  if (days >= STAGES.teen.from) return 'teen';
  if (days >= STAGES.child.from) return 'child';
  return 'baby';
}

export const FORMS: Record<Form, { name: string; hint: string }> = {
  tron: { name: _t('Phúng Phính'), hint: _t('được ăn ngon') },
  nhanh: { name: _t('Lanh Lợi'), hint: _t('được chơi nhiều') },
  thuong: { name: _t('Tình Cảm'), hint: _t('được vuốt ve, trò chuyện') },
  sang: { name: _t('Lấp Lánh'), hint: _t('được tắm rửa sạch sẽ') },
};
export interface CareSums { fed: number; ball: number; pet: number; talk: number; bath: number }
/**
 * Dáng trưởng thành theo kiểu chăm sóc (cộng dồn nhật ký các ngày). Mỗi loại chia cho mức "chăm đều" một ngày
 * (ăn 3, chơi bóng 3, vuốt 20 + nói 2, tắm 1) rồi lấy cao nhất. Hoà thì ưu tiên Tình Cảm.
 */
export function formFromCare(c: CareSums): Form {
  const score: [Form, number][] = [
    ['thuong', c.pet / 20 + c.talk / 2],
    ['tron', c.fed / 3],
    ['nhanh', c.ball / 3],
    ['sang', c.bath / 1],
  ];
  let best = score[0];
  for (const x of score) if (x[1] > best[1] + 1e-9) best = x;
  return best[0];
}

/** Câu ghi vào Ký ức khi thú lớn sang giai đoạn mới (giống câu trong SQL). */
export function GROW_MEMORY(stage: Stage, form: Form | null): string {
  if (stage === 'child') return _t('Mình lớn thành bé Nhí rồi, vỏ trứng trên đầu rơi mất tiêu!');
  if (stage === 'teen') return _t('Mình đã là Thiếu niên, ra dáng lắm rồi nha.');
  if (stage === 'adult') return _t`Mình trưởng thành rồi, thành dáng ${FORMS[form || 'thuong'].name} vì ${FORMS[form || 'thuong'].hint}.`;
  if (stage === 'elder') return _t('Mình bước vào tuổi xế chiều. Mình muốn ở bên bạn thật nhiều.');
  return _t('Mình vừa chào đời.');
}
