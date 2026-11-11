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
export interface Move { id: string; name: string; kind: MoveKind; element: number; power: number; unlock: { stage: Stage; bond: number } }

export const ELEMENT_NAMES = [_t('Mộc'), _t('Thuỷ'), _t('Phong'), _t('Dạ'), _t('Hoả')];
export const KIND_NAMES: Record<MoveKind, string> = { attack: _t('Tấn công'), guard: _t('Phòng thủ'), boost: _t('Cường hoá'), heal: _t('Hồi phục') };

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
const SIG_POWER = { thuong: 70, hiem: 80, quy: 90, huyen: 100 } as const;

/** Bốn chiêu của một loài, theo thứ tự mở khoá. */
export function movesOf(speciesId: string): Move[] {
  const sp = SPECIES_BY_ID[speciesId] || SPECIES[0], el = sp.region, m = MOVES[sp.id];
  return [
    { id: `${sp.id}-1`, name: m[0], kind: 'attack', element: el, power: 40, unlock: { stage: 'child', bond: 1 } },
    { id: `${sp.id}-2`, name: m[1][0], kind: m[1][1], element: el, power: 0, unlock: { stage: 'teen', bond: 3 } },
    { id: `${sp.id}-3`, name: m[2][0], kind: m[2][1], element: el, power: m[2][1] === 'attack' ? SIG_POWER[sp.rarity] : 0, unlock: { stage: 'adult', bond: 5 } },
    { id: `${sp.id}-4`, name: m[3], kind: 'attack', element: el, power: 120 + SIG_POWER[sp.rarity] / 10, unlock: { stage: 'adult', bond: 8 } },
  ];
}
/** Chiêu đã mở chưa, theo giai đoạn (Xế chiều tính như Trưởng thành) và cấp Gắn bó. */
export function moveUnlocked(m: Move, stage: Stage, bond: number): boolean {
  const rank = (s: Stage) => Math.min(STAGE_ORDER.indexOf(s), STAGE_ORDER.indexOf('adult'));
  return rank(stage) >= rank(m.unlock.stage) && bond >= m.unlock.bond;
}
/** Mô tả ngắn: công dụng và điều kiện mở. */
export function moveDesc(m: Move): string {
  if (m.kind === 'attack') return _t`Gây sát thương hệ ${ELEMENT_NAMES[m.element]}, sức mạnh ${m.power}.`;
  if (m.kind === 'guard') return _t('Giảm sát thương nhận vào trong 2 lượt.');
  if (m.kind === 'boost') return _t('Tăng sức tấn công trong 3 lượt.');
  return _t('Hồi một phần thể lực.');
}
export function moveLockNote(m: Move): string { return _t`Mở khi ${STAGES[m.unlock.stage].name}, Gắn bó cấp ${m.unlock.bond}`; }
