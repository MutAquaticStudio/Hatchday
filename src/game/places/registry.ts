/**
 * Danh mục địa điểm của thế giới (dữ liệu thuần, không phụ thuộc three.js) và các nút trên Bản đồ.
 * Luật mở khoá theo Gắn bó nằm ở đây; game.js tra bảng này thay cho các bảng cứng theo khu.
 */
export type CamPreset = [number, number, number, number, number, number, number]; // [fov, camX, camY, camZ, lookX, lookY, lookZ]

export interface PlaceDef {
  id: string;
  name: string;
  /** Tên ngắn hiện ở chip khu vực (≤ 12 ký tự). */
  short: string;
  /** solo: một mình; shared: nơi chung có người khác (realtime). */
  kind: 'solo' | 'shared';
  outdoor: boolean;
  /** Cấp Gắn bó tối thiểu để vào. */
  unlock: number;
  /** Chỗ thú đứng lúc vào: [x, y, z]. */
  pet: [number, number, number];
  /** Camera ngang và dọc. */
  cam: [CamPreset, CamPreset];
  /** Vùng thú đi được (toạ độ thế giới). */
  walk: { x: [number, number]; z: [number, number] };
  /** Nơi rộng: camera bám thú. x/z là khoảng dịch camera tối đa; kx/kz là tỉ lệ theo vị trí thú; zBase là z lúc vào. */
  follow?: { x: [number, number]; z: [number, number]; kx: number; kz: number; zBase: number };
  /** Chỗ trú mưa: [x, z, câu bé nói khi tới nơi]. Trời mưa thì bé tự chạy tới đây. */
  shelter?: [number, number, string?];
  /** Vật cản tròn (đài phun, ao…): thú bị đẩy ra khi đi vào. */
  blockers?: { x: number; z: number; r: number }[];
  /** Nút ngữ cảnh dưới đáy. */
  ctx: [string, string][];
  enterLine: string;
  blurb: string;
  /** Vị trí ghim trên Bản đồ, phần trăm của khung 100×100. */
  map: { x: number; y: number };
  /** Số người tối đa mỗi kênh ở nơi chung (gói Free dùng số nhỏ hơn, xem net/). */
  cap: number;
  /** false: đã có chỗ trên Bản đồ nhưng chưa mở (sẽ bật khi làm xong). */
  ready: boolean;
  /** true: không có ghim trên Bản đồ (không gian của nhà, mở từ menu Nhà theo cấp Gắn bó). */
  hidden?: boolean;
}

const INDOOR_CAM: [CamPreset, CamPreset] = [[30, 0, 3.2, 9.6, 0, 0.75, 0], [44, 0, 3.6, 11.5, 0, 0.35, 0]];
const OUTDOOR_CAM: [CamPreset, CamPreset] = [[34, 0, 5.4, 10.2, 0, 0.5, -0.8], [48, 0, 6.4, 12, 0, 0.2, -0.8]];
/** Nơi rộng (Quảng trường, Công viên): camera cao và xa hơn để thấy cả khu; camera còn bám thú (follow). */
const WIDE_CAM: [CamPreset, CamPreset] = [[40, 0, 7.6, 13.2, 0, 0.1, -1.4], [54, 0, 9.4, 15.2, 0, -0.2, -1.4]];
/** Tiệm trà (~13×10): camera xa hơn phòng thường để thấy cả quầy, bàn và góc cửa sổ. */
const TEA_CAM: [CamPreset, CamPreset] = [[38, 0, 4.2, 13.2, 0, 0.8, -0.4], [52, 0, 5.0, 15.0, 0, 0.4, -0.4]];
const BACK: [string, string][] = [['map', 'Bản đồ'], ['home', 'Về phòng']];

export const PLACES: PlaceDef[] = [
  { id: 'hospital', name: 'Bệnh viện', short: 'Bệnh viện', kind: 'solo', outdoor: false, unlock: 0, pet: [0, 0, 0.9], cam: INDOOR_CAM,
    walk: { x: [-3.5, 3.5], z: [-1.5, 2.6] }, ctx: BACK, enterLine: 'Bệnh viện Nhà thuốc Bông đây. Mình không sợ đâu… chắc vậy.', map: { x: 84, y: 28 }, cap: 12, ready: true,
    blurb: 'Khám bệnh, mua thuốc, xem sổ bệnh. Luôn mở, kể cả lúc bé ốm.' },
  { id: 'market', name: 'Chợ Xanh', short: 'Chợ Xanh', kind: 'solo', outdoor: true, unlock: 2, pet: [0, 0, 1.2], cam: OUTDOOR_CAM,
    walk: { x: [-13, 13], z: [-0.8, 4.2] }, follow: { x: [-9.5, 9.5], z: [0, 1.4], kx: 0.9, kz: 0.6, zBase: 1.2 }, blockers: [{ x: -12.9, z: -1.7, r: 1.0 }, { x: 12.9, z: -1.7, r: 1.1 }], ctx: BACK, enterLine: 'Chợ đông vui ghê! Mua gì cũng có.', map: { x: 16, y: 28 }, cap: 16, ready: true,
    blurb: 'Mua thức ăn, đồ trang trí, nông trại; bán rau thừa lấy xu.' },
  { id: 'tailor', name: 'Tiệm may Kim Chỉ', short: 'Tiệm may', kind: 'solo', outdoor: false, unlock: 0, pet: [0, 0, 0.9], cam: INDOOR_CAM,
    walk: { x: [-3.4, 3.4], z: [-1.2, 2.6] }, ctx: BACK, enterLine: 'Thử đồ nào! Mình muốn xem mình mặc gì hợp nhất.', map: { x: 50, y: 77 }, cap: 1, ready: true,
    blurb: 'Gương lớn, giá treo đồ, thử và mua trang phục.' },
  { id: 'library', name: 'Thư viện Sách Mây', short: 'Thư viện', kind: 'solo', outdoor: false, unlock: 2, pet: [0, 0, 0.9], cam: INDOOR_CAM,
    walk: { x: [-3.4, 3.4], z: [-1.2, 2.6] }, ctx: BACK, enterLine: 'Suỵt… ở đây phải nói nhỏ thôi nha.', map: { x: 50, y: 10 }, cap: 1, ready: true,
    blurb: 'Sổ loài, nhật ký, gia phả và bảng tin cập nhật.' },
  { id: 'plaza', name: 'Quảng trường Mầm', short: 'Quảng trường', kind: 'shared', outdoor: true, unlock: 2, pet: [0, 0, 3.4], cam: WIDE_CAM,
    walk: { x: [-17, 17], z: [-7, 8] }, follow: { x: [-12, 12], z: [-2.5, 3], kx: 0.9, kz: 0.45, zBase: 3.4 }, blockers: [{ x: 0, z: -0.6, r: 2.95 }, { x: -10.2, z: -4.3, r: 1.1 }, { x: 9.9, z: -3.9, r: 1.1 }, { x: -9.6, z: 4.6, r: 1.1 }, { x: -15.6, z: -1.6, r: 1.15 }, { x: -14.6, z: 2.9, r: 1.15 }, { x: 17.4, z: -1.4, r: 1.15 }], shelter: [-2.6, -6.6, 'Mưa rồi, mình nép gần sân khấu nha~'], ctx: BACK, enterLine: 'Quảng trường đông vui quá! Mình chào mọi người nhé.', map: { x: 50, y: 45 }, cap: 12, ready: true,
    blurb: 'Khu gặp gỡ: gặp người chơi khác, nhắn tin, kết bạn.' },
  { id: 'tea', name: 'Tiệm trà Gió', short: 'Tiệm trà', kind: 'shared', outdoor: false, unlock: 3, pet: [0, 0, 1.0], cam: TEA_CAM,
    walk: { x: [-4.6, 4.8], z: [-1.6, 3.8] }, blockers: [{ x: -1.8, z: -0.2, r: 0.7 }, { x: 2.2, z: -0.9, r: 0.7 }, { x: -2.6, z: 2.4, r: 0.7 }, { x: 2.6, z: 2.2, r: 0.7 }], ctx: BACK, enterLine: 'Thơm mùi trà quá~ Mình ngồi một chút nhé.', map: { x: 84, y: 62 }, cap: 16, ready: true,
    blurb: 'Bàn bốn chỗ, ngồi nhâm nhi và trò chuyện cùng bạn.' },
  { id: 'park', name: 'Công viên Cỏ Non', short: 'Công viên', kind: 'shared', outdoor: true, unlock: 4, pet: [0, 0, 2.4], cam: WIDE_CAM,
    walk: { x: [-17, 17], z: [-6.5, 11.6] }, follow: { x: [-12, 12], z: [-2.5, 8.2], kx: 0.9, kz: 0.92, zBase: 2.4 }, blockers: [{ x: -12, z: -2.4, r: 2.7 }, { x: -4.6, z: -6.2, r: 1.15 }, { x: -16.5, z: 11.2, r: 1.25 }, { x: 4.5, z: 9.6, r: 1.1 }, { x: 9.5, z: 10.2, r: 1.15 }, { x: 14.2, z: 9.4, r: 1.15 }], shelter: [5.5, -6.4, 'Mưa rồi, mình trú dưới vòm nghỉ chân nha~'], ctx: BACK, enterLine: 'Công viên rộng ghê! Mình chạy thử nha.', map: { x: 16, y: 62 }, cap: 16, ready: true,
    blurb: 'Sân chơi, ao vịt, bóng chung và chơi cùng bạn.' },
];
const HOME_BACK: [string, string][] = [['home', 'Về phòng']];
/** Không gian của nhà, mở theo cấp Gắn bó (ban công 3, phòng chơi 5, sân thượng 7). Mỗi nơi có đồ chơi riêng (dùng hành động chơi có sẵn). */
PLACES.push(
  { id: 'balcony', name: 'Ban công Nắng', short: 'Ban công', kind: 'solo', outdoor: true, unlock: 3, pet: [0, 0, 0.8], cam: INDOOR_CAM, walk: { x: [-2.6, 2.6], z: [-0.8, 1.8] }, ctx: HOME_BACK,
    enterLine: 'Ban công có nắng và gió. Thổi bong bóng nha!', map: { x: 0, y: 0 }, cap: 1, ready: true, hidden: true, blurb: 'Thổi bong bóng, nằm võng, ngắm phố.' },
  { id: 'playroom', name: 'Phòng chơi Cầu Vồng', short: 'Phòng chơi', kind: 'solo', outdoor: false, unlock: 5, pet: [0, 0, 1.0], cam: INDOOR_CAM, walk: { x: [-3.2, 3.2], z: [-1.0, 2.4] }, ctx: HOME_BACK,
    enterLine: 'Phòng chơi nhiều đồ chơi quá! Chơi cái nào trước đây?', map: { x: 0, y: 0 }, cap: 1, ready: true, hidden: true, blurb: 'Tàu hoả đồ chơi, hồ bóng, xếp hình.' },
  { id: 'rooftop', name: 'Sân thượng Sao', short: 'Sân thượng', kind: 'solo', outdoor: true, unlock: 7, pet: [0, 0, 1.2], cam: OUTDOOR_CAM, walk: { x: [-3.6, 3.6], z: [-0.8, 3.0] }, ctx: HOME_BACK,
    enterLine: 'Sân thượng cao ghê! Thả diều thôi.', map: { x: 0, y: 0 }, cap: 1, ready: true, hidden: true, blurb: 'Thả diều, ngắm sao bằng kính thiên văn.' },
);
export const SPACES = PLACES.filter(p => p.hidden);
export const PLACE_BY_ID: Record<string, PlaceDef> = Object.fromEntries(PLACES.map(p => [p.id, p]));

/** Ghim trên Bản đồ: các nơi có sẵn (Nhà, Vườn nhà) cộng các địa điểm. */
export interface MapNode { id: string; name: string; blurb: string; map: { x: number; y: number }; unlock: number; ready: boolean; place: boolean; hidden?: boolean }
export const MAP_NODES: MapNode[] = [
  { id: 'home', name: 'Nhà', blurb: 'Phòng khách, bếp, phòng tắm và phòng ngủ của bé.', map: { x: 22, y: 91 }, unlock: 0, ready: true, place: false },
  { id: 'garden', name: 'Vườn nhà', blurb: 'Trồng rau, tưới nước, trang trí nông trại.', map: { x: 78, y: 91 }, unlock: 0, ready: true, place: false },
  ...PLACES.map(p => ({ id: p.id, name: p.name, blurb: p.blurb, map: p.map, unlock: p.unlock, ready: p.ready, place: true, hidden: p.hidden })),
];

export const isUnlocked = (unlock: number, bondLevel: number) => bondLevel >= unlock;

export type EnterBlock = null | 'locked' | 'asleep' | 'soon';
/** Vào được không? Ngủ thì không đi đâu được, trừ Bệnh viện. Trả về lý do nếu không. */
export function enterBlock(id: string, o: { bondLevel: number; asleep: boolean }): EnterBlock {
  const n = MAP_NODES.find(x => x.id === id); if (!n) return 'soon';
  if (!n.ready) return 'soon';
  if (!isUnlocked(n.unlock, o.bondLevel)) return 'locked';
  if (o.asleep && id !== 'hospital' && id !== 'home') return 'asleep';
  return null;
}
export const BLOCK_TEXT: Record<Exclude<EnterBlock, null>, (n?: MapNode) => string> = {
  locked: n => `Chưa mở. Cần Gắn bó cấp ${n?.unlock ?? 2}.`,
  asleep: () => 'Bé đang ngủ. Cho bé thức dậy rồi hãy đi nhé.',
  soon: () => 'Nơi này sắp mở. Đợi chút nhé!',
};
