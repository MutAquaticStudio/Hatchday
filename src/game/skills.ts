/**
 * Chiêu thức của quái thú (chuẩn bị cho Đấu trường giao hữu). Mỗi loài có 4 chiêu:
 *   1. đòn cơ bản theo nguyên tố của miền (từ tuổi Nhí)
 *   2. chiêu hỗ trợ theo nguyên tố (Thiếu niên, Gắn bó 3)
 *   3. tuyệt chiêu riêng của loài (Trưởng thành, Gắn bó 5)
 *   4. chiêu tối thượng của nguyên tố (Trưởng thành, Gắn bó 8)
 * Chỉ là dữ liệu và luật mở khoá; trận đấu sẽ dùng bảng này. Không bán, không mua: chiêu mở theo tuổi và Gắn bó.
 */
import { _t } from '../i18n';
import { SPECIES, SPECIES_BY_ID, STAGE_ORDER, STAGES, type Stage } from './species';

export type MoveKind = 'attack' | 'guard' | 'boost' | 'heal';
export interface Move { id: string; name: string; kind: MoveKind; element: number; power: number; unlock: { stage: Stage; bond: number } }

export const ELEMENT_NAMES = [_t('Mộc'), _t('Thuỷ'), _t('Phong'), _t('Dạ'), _t('Hoả')];
export const KIND_NAMES: Record<MoveKind, string> = { attack: _t('Tấn công'), guard: _t('Phòng thủ'), boost: _t('Cường hoá'), heal: _t('Hồi phục') };

const BASIC = [_t('Roi Lá'), _t('Tia Nước'), _t('Lưỡi Gió'), _t('Vuốt Bóng'), _t('Tàn Lửa')];
const SUPPORT: [string, MoveKind][] = [[_t('Hấp Thụ Nắng'), 'heal'], [_t('Màn Sương'), 'guard'], [_t('Thuận Gió'), 'boost'], [_t('Ẩn Mình'), 'guard'], [_t('Hăng Máu'), 'boost']];
const ULTIMATE = [_t('Rừng Thiêng Trỗi Dậy'), _t('Đại Hồng Thuỷ'), _t('Bão Thiên Lôi'), _t('Nguyệt Thực'), _t('Hoả Ngục')];

/** Tuyệt chiêu riêng của từng loài: [tên, loại]. */
const SIGNATURE: Record<string, [string, MoveKind]> = {
  'mam-xanh': [_t('Chồi Phá Thạch'), 'attack'], 'bong-lua': [_t('Mưa Hạt Vàng'), 'attack'], 'ong-mat': [_t('Kim Châm Liên Hoàn'), 'attack'], 'co-may': [_t('Gai Bám Ảnh'), 'attack'], 'hoa-mai': [_t('Vũ Điệu Mai Vàng'), 'boost'],
  'chuon-chuon': [_t('Cánh Cắt Ngọc'), 'attack'], 'de-co': [_t('Khúc Ru Đêm Hè'), 'guard'], 'sen-hong': [_t('Liên Hoa Khai'), 'heal'], 'nai-co': [_t('Gạc Xuyên Rừng'), 'attack'], 'lan-vang': [_t('Kim Lân Hống'), 'attack'],
  'ca-bong': [_t('Bong Bóng Xiết'), 'attack'], 'oc-gao': [_t('Thạch Giáp'), 'guard'], 'giot-mua': [_t('Mưa Rào'), 'attack'], 'tom-tit': [_t('Càng Búng Sấm'), 'attack'], 'rua-dam': [_t('Huyền Vũ Trấn'), 'guard'],
  'sua-bien': [_t('Xúc Tu Nguyệt Quang'), 'attack'], 'rai-ca': [_t('Xoáy Nước Lang'), 'attack'], 'ca-heo-hong': [_t('Sóng Âm Hồng'), 'attack'], 'ngoc-trai': [_t('Minh Châu Chiếu'), 'heal'], 'long-thuy': [_t('Thuỷ Long Giáng Vũ'), 'attack'],
  'bong-may': [_t('Mưa Bông'), 'attack'], 'se-nau': [_t('Mổ Gió'), 'attack'], 'dieu-giay': [_t('Diều Cắt Mây'), 'attack'], 'gio-nhe': [_t('Lốc Thanh Phong'), 'attack'], 'cau-vong': [_t('Thất Sắc Quang'), 'attack'],
  'hai-au': [_t('Lao Sóng'), 'attack'], 'sao-bang': [_t('Lưu Tinh Truy'), 'attack'], 'may-ngu-sac': [_t('Ngũ Vân Hộ Thể'), 'guard'], 'hac-trang': [_t('Hạc Vũ'), 'boost'], 'chim-lac': [_t('Lạc Điểu Minh'), 'attack'],
  'nam-ngu': [_t('Bào Tử Mộng'), 'guard'], 'dom-dom': [_t('Huỳnh Quang Chớp'), 'attack'], 'cu-meo': [_t('Dạ Kiêu Nhãn'), 'boost'], 'doi-nho': [_t('Sóng Siêu Âm'), 'attack'], 'trang-khuyet': [_t('Khuyết Nguyệt Trảm'), 'attack'],
  'cao-bac': [_t('Tam Vĩ Hồ Hoả'), 'attack'], 'meo-muop': [_t('Hổ Trảo'), 'attack'], 'ma-troi': [_t('Lân Hoả Dẫn Hồn'), 'attack'], 'huou-sao': [_t('Tinh Tú Giáng'), 'attack'], 'tho-ngoc': [_t('Ngọc Thố Đảo Dược'), 'heal'],
  'banh-bo': [_t('Phù Bính Nở'), 'attack'], 'xoi-gac': [_t('Xích Nhu Quyền'), 'attack'], 'che-ba-mau': [_t('Tam Sắc Băng'), 'attack'], 'banh-troi': [_t('Bạch Hoàn Lăn'), 'attack'], 'banh-flan': [_t('Hổ Phách Chưởng'), 'attack'],
  'tra-sua': [_t('Trân Châu Liên Xạ'), 'attack'], 'banh-bao': [_t('Hơi Nóng Vân Bao'), 'attack'], 'banh-trung-thu': [_t('Nguyệt Bính Thuẫn'), 'guard'], 'keo-bong-gon': [_t('Đường Vân Quấn'), 'guard'], 'lua-bep': [_t('Táo Hoả Phần Thiên'), 'attack'],
};
const SIG_POWER = { thuong: 70, hiem: 80, quy: 90, huyen: 100 } as const;

/** Bốn chiêu của một loài, theo thứ tự mở khoá. */
export function movesOf(speciesId: string): Move[] {
  const sp = SPECIES_BY_ID[speciesId] || SPECIES[0], el = sp.region, sig = SIGNATURE[sp.id];
  return [
    { id: `basic-${el}`, name: BASIC[el], kind: 'attack', element: el, power: 40, unlock: { stage: 'child', bond: 1 } },
    { id: `support-${el}`, name: SUPPORT[el][0], kind: SUPPORT[el][1], element: el, power: 0, unlock: { stage: 'teen', bond: 3 } },
    { id: `sig-${sp.id}`, name: sig[0], kind: sig[1], element: el, power: sig[1] === 'attack' ? SIG_POWER[sp.rarity] : 0, unlock: { stage: 'adult', bond: 5 } },
    { id: `ult-${el}`, name: ULTIMATE[el], kind: 'attack', element: el, power: 120, unlock: { stage: 'adult', bond: 8 } },
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
