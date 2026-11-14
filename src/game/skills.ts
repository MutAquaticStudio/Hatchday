/**
 * Chiêu thức của quái thú (chuẩn bị cho Đấu trường giao hữu). Mỗi loài có 4 chiêu:
 *   1. đòn cơ bản (từ tuổi Nhí)
 *   2. chiêu hỗ trợ: phòng thủ, cường hoá hoặc hồi phục (Thiếu niên, Gắn bó 3)
 *   3. tuyệt chiêu (Trưởng thành, Gắn bó 5)
 *   4. chiêu tối thượng (Trưởng thành, Gắn bó 8)
 * Cả 4 chiêu đều là của riêng loài đó (200 chiêu, không trùng tên); nguyên tố của chiêu theo miền của loài.
 * Chỉ là dữ liệu và luật mở khoá; trận đấu sẽ dùng bảng này. Không bán, không mua: chiêu mở theo tuổi và Gắn bó.
 */
import { _t } from '../i18n';
import { SPECIES, SPECIES_BY_ID, STAGE_ORDER, STAGES, type Stage } from './species';

export type MoveKind = 'attack' | 'guard' | 'boost' | 'heal';
export type Status = 'root' | 'soak' | 'daze' | 'blind' | 'burn';
export type Twist = 'multi' | 'drain' | 'first' | 'pierce' | 'recoil' | 'crit' | 'lowhp' | 'cleanse' | 'thorns' | 'wall' | 'haste' | 'focus' | 'regen';
export interface Move { id: string; name: string; kind: MoveKind; element: number; power: number; unlock: { stage: Stage; bond: number };
  /** Trạng thái gây cho đối thủ (đòn tấn công) và xác suất %. */ status?: Status; chance?: number;
  /** Nét riêng của chiêu (tuyệt chiêu và chiêu tối thượng). */ twist?: Twist;
  /** Số lượt phải chờ sau khi dùng (chiêu tối thượng). */ cooldown?: number }

export const ELEMENT_NAMES = [_t('Mộc'), _t('Thuỷ'), _t('Phong'), _t('Dạ'), _t('Hoả')];
export const KIND_NAMES: Record<MoveKind, string> = { attack: _t('Tấn công'), guard: _t('Phòng thủ'), boost: _t('Cường hoá'), heal: _t('Hồi phục') };

/**
 * Khắc chế giữa năm hệ. Vòng chính (×1.2): Thuỷ dập Hoả, Hoả thiêu Mộc, Mộc chắn Phong, Phong xua Dạ, Dạ kéo triều Thuỷ.
 * Vòng phụ (×1.1): Hoả soi Dạ, Dạ che nắng Mộc, Mộc hút Thuỷ, Thuỷ nặng Phong, Phong thổi tắt Hoả.
 * Chiều ngược lại bị giảm (×0.83 và ×0.91). Thứ tự hệ: 0 Mộc, 1 Thuỷ, 2 Phong, 3 Dạ, 4 Hoả.
 */
export const STRONG: Record<number, number> = { 1: 4, 4: 0, 0: 2, 2: 3, 3: 1 };
export const MINOR: Record<number, number> = { 4: 3, 3: 0, 0: 1, 1: 2, 2: 4 };
export function elementMult(att: number, def: number): number {
  if (STRONG[att] === def) return 1.2; if (MINOR[att] === def) return 1.1;
  if (STRONG[def] === att) return 0.83; if (MINOR[def] === att) return 0.91;
  return 1;
}
/** Trạng thái đặc trưng của từng hệ. */
export const ELEMENT_STATUS: Status[] = ['root', 'soak', 'daze', 'blind', 'burn'];
export const STATUS_INFO: Record<Status, { name: string; desc: string }> = {
  root: { name: _t('Trói rễ'), desc: _t('giảm 30% tốc độ trong 2 lượt') },
  soak: { name: _t('Ướt sũng'), desc: _t('giảm 25% phòng thủ trong 2 lượt') },
  daze: { name: _t('Choáng gió'), desc: _t('25% khả năng mất lượt, trong 2 lượt') },
  blind: { name: _t('Loá mắt'), desc: _t('giảm 25% tấn công trong 2 lượt') },
  burn: { name: _t('Bỏng'), desc: _t('mất 4% thể lực mỗi lượt, trong 3 lượt') },
};
export const TWIST_INFO: Record<Twist, string> = {
  multi: _t('Đánh liên tiếp 2–3 lần'), drain: _t('Hồi lại 50% sát thương gây ra'), first: _t('Luôn ra đòn trước'), pierce: _t('Xuyên qua phòng thủ'),
  recoil: _t('Mạnh hơn 20% nhưng tự mất 4% thể lực'), crit: _t('40% khả năng chí mạng'), lowhp: _t('Mạnh thêm 20% khi thể lực dưới một nửa'), cleanse: _t('Xoá mọi trạng thái xấu của mình và hồi 5% thể lực'),
  thorns: _t('Phản lại 25% sát thương khi đang thủ'), wall: _t('Giảm tới 70% sát thương'), haste: _t('Tăng thêm 30% tốc độ'), focus: _t('Đòn kế tiếp chắc chắn chí mạng'), regen: _t('Hồi thêm 5% thể lực mỗi lượt trong 3 lượt'),
};
const TWISTS: Record<MoveKind, Twist[]> = { attack: ['multi', 'drain', 'first', 'pierce', 'recoil', 'crit', 'lowhp', 'cleanse'], guard: ['thorns', 'wall'], boost: ['haste', 'focus'], heal: ['regen', 'cleanse'] };
const SIG_CHANCE = 40;

/** Bộ chiêu riêng của từng loài: [đòn cơ bản, [chiêu hỗ trợ, loại], [tuyệt chiêu, loại], chiêu tối thượng]. Không loài nào trùng tên chiêu với loài khác. */
const MOVES: Record<string, [string, [string, MoveKind], [string, MoveKind], string]> = {
  'mam-xanh': [_t('Quất Chồi'), [_t('Tắm Nắng'), 'heal'], [_t('Chồi Phá Thạch'), 'attack'], _t('Đại Thụ Vươn Trời')],
  'bong-lua': [_t('Vãi Thóc'), [_t('Rơm Ấm'), 'guard'], [_t('Mưa Hạt Vàng'), 'attack'], _t('Mùa Vàng Bội Thu')],
  'ong-mat': [_t('Chích Nhẹ'), [_t('Mật Ngọt'), 'heal'], [_t('Kim Châm Liên Hoàn'), 'attack'], _t('Bầy Ong Vạn Kim')],
  'co-may': [_t('Phóng Gai'), [_t('Lẩn Trong Cỏ'), 'guard'], [_t('Gai Bám Ảnh'), 'attack'], _t('Thảo Nguyên Nổi Gió')],
  'hoa-mai': [_t('Cánh Hoa Bay'), [_t('Hương Xuân'), 'heal'], [_t('Vũ Điệu Mai Vàng'), 'boost'], _t('Vạn Mai Khai Xuân')],
  'chuon-chuon': [_t('Lướt Cánh'), [_t('Điểm Nước'), 'boost'], [_t('Cánh Cắt Ngọc'), 'attack'], _t('Thanh Dực Loạn Vũ')],
  'de-co': [_t('Đá Hậu'), [_t('Gáy Vang'), 'boost'], [_t('Khúc Ru Đêm Hè'), 'guard'], _t('Dạ Khúc Đồng Xanh')],
  'sen-hong': [_t('Tát Lá Sen'), [_t('Hương Sen'), 'guard'], [_t('Liên Hoa Khai'), 'heal'], _t('Toà Sen Tịnh Thế')],
  'nai-co': [_t('Húc Gạc'), [_t('Lắng Tai'), 'boost'], [_t('Gạc Xuyên Rừng'), 'attack'], _t('Lộc Vương Giáng Lâm')],
  'lan-vang': [_t('Vờn Cầu'), [_t('Trống Hội'), 'boost'], [_t('Kim Lân Hống'), 'attack'], _t('Kim Lân Đạp Vân')],
  'ca-bong': [_t('Quẫy Đuôi'), [_t('Lặn Sâu'), 'guard'], [_t('Bong Bóng Xiết'), 'attack'], _t('Sóng Bạc Đầu')],
  'oc-gao': [_t('Phun Bọt'), [_t('Rút Vào Vỏ'), 'guard'], [_t('Thạch Giáp'), 'guard'], _t('Thạch Loa Trấn Thuỷ')],
  'giot-mua': [_t('Giọt Bắn'), [_t('Mưa Phùn'), 'heal'], [_t('Mưa Rào'), 'attack'], _t('Mưa Ngâu Bất Tận')],
  'tom-tit': [_t('Búng Càng'), [_t('Lột Xác'), 'heal'], [_t('Càng Búng Sấm'), 'attack'], _t('Xích Giáp Phá Lãng')],
  'rua-dam': [_t('Cắn Chặt'), [_t('Thu Mình'), 'guard'], [_t('Huyền Vũ Trấn'), 'guard'], _t('Huyền Quy Trấn Hải')],
  'sua-bien': [_t('Chích Điện'), [_t('Trôi Theo Sóng'), 'guard'], [_t('Xúc Tu Nguyệt Quang'), 'attack'], _t('Hải Nguyệt Triều Dâng')],
  'rai-ca': [_t('Ném Sỏi'), [_t('Nắm Tay Nhau'), 'heal'], [_t('Xoáy Nước Lang'), 'attack'], _t('Thuỷ Lang Săn Thác')],
  'ca-heo-hong': [_t('Húc Mõm'), [_t('Tiếng Gọi Bầy'), 'boost'], [_t('Sóng Âm Hồng'), 'attack'], _t('Hồng Kình Vượt Sóng')],
  'ngoc-trai': [_t('Tia Ngọc'), [_t('Vỏ Trai Khép'), 'guard'], [_t('Minh Châu Chiếu'), 'heal'], _t('Vạn Châu Quy Tụ')],
  'long-thuy': [_t('Vảy Rồng Quật'), [_t('Gọi Mây'), 'boost'], [_t('Thuỷ Long Giáng Vũ'), 'attack'], _t('Long Vương Nộ Hải')],
  'bong-may': [_t('Húc Bông'), [_t('Gối Mây'), 'heal'], [_t('Mưa Bông'), 'attack'], _t('Vân Miên Phủ Trời')],
  'se-nau': [_t('Mổ Nhanh'), [_t('Rỉa Lông'), 'heal'], [_t('Mổ Gió'), 'attack'], _t('Đàn Sẻ Che Trời')],
  'dieu-giay': [_t('Cắt Dây'), [_t('Bắt Gió'), 'boost'], [_t('Diều Cắt Mây'), 'attack'], _t('Chỉ Diên Thăng Thiên')],
  'gio-nhe': [_t('Thổi Bay'), [_t('Gió Mát'), 'heal'], [_t('Lốc Thanh Phong'), 'attack'], _t('Thanh Phong Vạn Dặm')],
  'cau-vong': [_t('Tia Sắc Màu'), [_t('Sau Cơn Mưa'), 'heal'], [_t('Thất Sắc Quang'), 'attack'], _t('Cầu Vồng Song Sinh')],
  'hai-au': [_t('Sà Xuống'), [_t('Lượn Gió'), 'boost'], [_t('Lao Sóng'), 'attack'], _t('Hải Vũ Xé Bão')],
  'sao-bang': [_t('Tia Sao'), [_t('Điều Ước'), 'boost'], [_t('Lưu Tinh Truy'), 'attack'], _t('Mưa Sao Băng')],
  'may-ngu-sac': [_t('Mây Quật'), [_t('Ráng Chiều'), 'guard'], [_t('Ngũ Vân Hộ Thể'), 'guard'], _t('Ngũ Sắc Tường Vân')],
  'hac-trang': [_t('Mổ Hạc'), [_t('Đứng Một Chân'), 'guard'], [_t('Hạc Vũ'), 'boost'], _t('Bạch Hạc Lăng Không')],
  'chim-lac': [_t('Cánh Đồng Quật'), [_t('Trống Đồng Vang'), 'boost'], [_t('Lạc Điểu Minh'), 'attack'], _t('Lạc Điểu Quy Nguyên')],
  'nam-ngu': [_t('Rắc Phấn'), [_t('Ngủ Gật'), 'heal'], [_t('Bào Tử Mộng'), 'guard'], _t('Rừng Nấm Mê Cung')],
  'dom-dom': [_t('Chớp Sáng'), [_t('Thắp Đèn'), 'boost'], [_t('Huỳnh Quang Chớp'), 'attack'], _t('Vạn Đăng Hội Tụ')],
  'cu-meo': [_t('Vồ Đêm'), [_t('Xoay Đầu'), 'guard'], [_t('Dạ Kiêu Nhãn'), 'boost'], _t('Dạ Kiêu Tuần Dạ')],
  'doi-nho': [_t('Cắn Trộm'), [_t('Treo Ngược'), 'heal'], [_t('Sóng Siêu Âm'), 'attack'], _t('Dạ Dực Che Trăng')],
  'trang-khuyet': [_t('Cào Trăng'), [_t('Trăng Tròn Dần'), 'heal'], [_t('Khuyết Nguyệt Trảm'), 'attack'], _t('Nguyệt Thực Toàn Phần')],
  'cao-bac': [_t('Vuốt Bạc'), [_t('Ảo Ảnh'), 'guard'], [_t('Tam Vĩ Hồ Hoả'), 'attack'], _t('Cửu Vĩ Hiện Hình')],
  'meo-muop': [_t('Tát Vuốt'), [_t('Lim Dim'), 'heal'], [_t('Hổ Trảo'), 'attack'], _t('Hổ Miêu Gầm Núi')],
  'ma-troi': [_t('Đốm Lửa Lạnh'), [_t('Lập Loè'), 'guard'], [_t('Lân Hoả Dẫn Hồn'), 'attack'], _t('Bách Hoả Dạ Hành')],
  'huou-sao': [_t('Đạp Sao'), [_t('Ánh Sao Dịu'), 'heal'], [_t('Tinh Tú Giáng'), 'attack'], _t('Ngân Hà Đổ Xuống')],
  'tho-ngoc': [_t('Chày Giã'), [_t('Bột Tiên'), 'boost'], [_t('Ngọc Thố Đảo Dược'), 'heal'], _t('Nguyệt Cung Giáng Thế')],
  'banh-bo': [_t('Hơi Nóng Phả'), [_t('Ủ Ấm'), 'heal'], [_t('Phù Bính Nở'), 'attack'], _t('Phù Bính Bùng Nổ')],
  'xoi-gac': [_t('Đấm Thẳng'), [_t('Nóng Máu'), 'boost'], [_t('Xích Nhu Quyền'), 'attack'], _t('Xích Nhu Liệt Hoả')],
  'che-ba-mau': [_t('Hắt Đá Lạnh'), [_t('Ba Tầng Vị'), 'boost'], [_t('Tam Sắc Băng'), 'attack'], _t('Tam Sắc Hợp Nhất')],
  'banh-troi': [_t('Lăn Tròn'), [_t('Nhân Đường Ngọt'), 'heal'], [_t('Bạch Hoàn Lăn'), 'attack'], _t('Bạch Hoàn Thiên Thạch')],
  'banh-flan': [_t('Vả Hổ Phách'), [_t('Rung Rinh'), 'guard'], [_t('Hổ Phách Chưởng'), 'attack'], _t('Hổ Phách Dung Nham')],
  'tra-sua': [_t('Bắn Trân Châu'), [_t('Tỉnh Táo'), 'boost'], [_t('Trân Châu Liên Xạ'), 'attack'], _t('Trân Châu Bão Táp')],
  'banh-bao': [_t('Phì Hơi'), [_t('Vỏ Mềm'), 'guard'], [_t('Hơi Nóng Vân Bao'), 'attack'], _t('Vân Bao Xửng Hấp')],
  'banh-trung-thu': [_t('Húc Vỏ'), [_t('Trăng Rằm'), 'heal'], [_t('Nguyệt Bính Thuẫn'), 'guard'], _t('Nguyệt Bính Đoàn Viên')],
  'keo-bong-gon': [_t('Tơ Đường'), [_t('Ngọt Lịm'), 'heal'], [_t('Đường Vân Quấn'), 'guard'], _t('Đường Vân Lốc Xoáy')],
  'lua-bep': [_t('Phun Lửa'), [_t('Giữ Lửa'), 'boost'], [_t('Táo Hoả Phần Thiên'), 'attack'], _t('Táo Quân Giáng Hoả')],
};
/** Sức mạnh như nhau mọi độ hiếm: độ hiếm chỉ đổi dáng vẻ, không đổi sức đấu (loài thường không bị thiệt). */
const SIG_POWER = 85, ULT_POWER = 100, ULT_CHANCE = 35;
/** Chiêu tối thượng dùng xong phải chờ 2 lượt mới dùng lại (giá trị 3 = đếm cả lượt vừa dùng). */
export const ULT_COOLDOWN = 3;
/** Loài có tuyệt chiêu là chiêu hỗ trợ chỉ có hai đòn đánh, nên đòn cơ bản mạnh hơn để bù. */
const BASIC_SUPPORT = 50;
/** Tuyệt chiêu hỗ trợ kèm một đòn đánh nhẹ (chiêu kép). */
const SIG_SUPPORT_POWER: Record<MoveKind, number> = { attack: 0, guard: 60, boost: 55, heal: 40 };

/** Bốn chiêu của một loài, theo thứ tự mở khoá. */
export function movesOf(speciesId: string): Move[] {
  const sp = SPECIES_BY_ID[speciesId] || SPECIES[0], el = sp.region, m = MOVES[sp.id], st = ELEMENT_STATUS[el], idx = SPECIES.indexOf(sp);
  // nét riêng chọn theo thứ tự loài trong miền nên các loài cùng hệ không giống nhau, và cố định (máy chủ tính ra y hệt)
  const tw = (k: MoveKind, shift = 0) => TWISTS[k][(idx + shift) % TWISTS[k].length], sigAtk = m[2][1] === 'attack';
  return [
    { id: `${sp.id}-1`, name: m[0], kind: 'attack', element: el, power: sigAtk ? 40 : BASIC_SUPPORT, unlock: { stage: 'child', bond: 1 } },
    { id: `${sp.id}-2`, name: m[1][0], kind: m[1][1], element: el, power: 0, unlock: { stage: 'teen', bond: 3 } },
    { id: `${sp.id}-3`, name: m[2][0], kind: m[2][1], element: el, power: sigAtk ? SIG_POWER : SIG_SUPPORT_POWER[m[2][1]], unlock: { stage: 'adult', bond: 5 }, twist: tw(m[2][1]), ...(sigAtk ? { status: st, chance: SIG_CHANCE } : {}) },
    { id: `${sp.id}-4`, name: m[3], kind: 'attack', element: el, power: ULT_POWER, unlock: { stage: 'adult', bond: 8 }, status: st, chance: ULT_CHANCE, twist: tw('attack', 3), cooldown: ULT_COOLDOWN },
  ];
}
/** Chiêu đã mở chưa, theo giai đoạn (Xế chiều tính như Trưởng thành) và cấp Gắn bó. */
export function moveUnlocked(m: Move, stage: Stage, bond: number): boolean {
  const rank = (s: Stage) => Math.min(STAGE_ORDER.indexOf(s), STAGE_ORDER.indexOf('adult'));
  return rank(stage) >= rank(m.unlock.stage) && bond >= m.unlock.bond;
}
/** Mô tả ngắn: công dụng và điều kiện mở. */
export function moveDesc(m: Move): string {
  const base = m.kind === 'attack' ? _t`Gây sát thương hệ ${ELEMENT_NAMES[m.element]}, sức mạnh ${m.power}.` : m.kind === 'guard' ? _t('Giảm sát thương nhận vào trong 2 lượt.') : m.kind === 'boost' ? _t('Tăng sức tấn công trong 3 lượt.') : _t('Hồi một phần thể lực (mỗi lần sau hồi ít hơn).');
  const st = m.status ? ' ' + _t`${m.chance}% gây ${STATUS_INFO[m.status].name} (${STATUS_INFO[m.status].desc}).` : '';
  return base + (m.kind !== 'attack' && m.power > 0 ? ' ' + _t`Kèm một đòn hệ ${ELEMENT_NAMES[m.element]}, sức mạnh ${m.power}.` : '') + st + (m.twist ? ' ' + TWIST_INFO[m.twist] + '.' : '') + (m.cooldown ? ' ' + _t`Dùng xong phải chờ ${m.cooldown - 1} lượt.` : '');
}
export function moveLockNote(m: Move): string { return _t`Mở khi ${STAGES[m.unlock.stage].name}, Gắn bó cấp ${m.unlock.bond}`; }

/** Hệ này khắc hệ nào và kỵ hệ nào (để người chơi tra cứu). */
export function matchups(el: number): { strong: number[]; weak: number[] } {
  const strong = [STRONG[el], MINOR[el]], weak = [0, 1, 2, 3, 4].filter(x => STRONG[x] === el || MINOR[x] === el);
  return { strong, weak };
}
