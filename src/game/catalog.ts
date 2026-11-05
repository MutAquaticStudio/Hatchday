/**
 * Danh mục vật phẩm (nguồn sự thật cho tên, giá, kích thước, chủ đề).
 * Seed SQL trong supabase/migrations/*_decor_cosmetics.sql phải khớp — test catalog-sync kiểm tra.
 */
export type Kind = 'food' | 'decor' | 'outfit';
export type Layer = 'floor' | 'rug' | 'wall' | 'wallpaper' | 'flooring';
export type Slot = 'head' | 'face' | 'neck' | 'back';
/** Bật quầy trả phí trong cửa hàng (tạm ẩn cho tới khi có cổng thanh toán). */
export const PAID_SHOP_ENABLED = false;

export type Source = 'starter' | 'market' | 'rotating' | 'weekend' | 'event' | 'paid';
export type Rarity = 'thuong' | 'dep' | 'hiem' | 'ky-niem';
export type Theme = 'go-moc' | 'pastel' | 'tuoi-tho-9x' | 'rung' | 'bien' | 'pho-cu' | 'le-hoi';
export type Tag = 'mem' | 'sach' | 'cay' | 'choi' | 'sang' | 'retro';

export interface Item {
  id: string; name: string; kind: Kind;
  layer?: Layer; slot?: Slot;
  w?: number; d?: number;          // số ô (rộng × sâu, hoặc rộng × cao với đồ treo tường)
  comfort?: number; theme?: Theme | null; tags?: Tag[];
  price: number | null; source: Source; rarity: Rarity;
}

const D = (id: string, name: string, layer: Layer, w: number, d: number, comfort: number, theme: Theme | null, tags: Tag[], price: number | null, source: Source, rarity: Rarity = 'thuong'): Item =>
  ({ id, name, kind: 'decor', layer, w, d, comfort, theme, tags, price, source, rarity });
const O = (id: string, name: string, slot: Slot, tags: Tag[], price: number | null, source: Source, rarity: Rarity = 'thuong'): Item =>
  ({ id, name, kind: 'outfit', slot, tags, price, source, rarity });

export const ITEMS: Item[] = [
  // Nội thất (sàn)
  D('o-rom', 'Ổ rơm', 'floor', 2, 2, 3, 'go-moc', ['mem'], null, 'starter'),
  D('giuong-may', 'Giường mây', 'floor', 2, 2, 5, 'pastel', ['mem'], 900, 'rotating', 'dep'),
  D('ghe-dau', 'Ghế đẩu gỗ', 'floor', 1, 1, 1, 'go-moc', [], 120, 'market'),
  D('ban-tra', 'Bàn trà gỗ', 'floor', 2, 1, 2, 'go-moc', [], 300, 'market'),
  D('ke-sach', 'Kệ sách', 'floor', 1, 1, 2, 'go-moc', ['sach'], 280, 'market'),
  D('sofa-hong', 'Sofa hồng', 'floor', 2, 1, 4, 'pastel', ['mem'], 650, 'rotating', 'dep'),
  D('den-keo', 'Đèn kẹo ngọt', 'floor', 1, 1, 1, 'pastel', ['sang'], 380, 'market'),
  D('gau-bong', 'Gấu bông khổng lồ', 'floor', 1, 1, 3, 'pastel', ['mem'], 720, 'rotating', 'dep'),
  D('tv-crt', 'TV đèn hình', 'floor', 1, 1, 2, 'tuoi-tho-9x', ['retro'], 450, 'rotating', 'dep'),
  D('may-game', 'Máy chơi game cầm tay', 'floor', 1, 1, 1, 'tuoi-tho-9x', ['retro', 'choi'], 300, 'market'),
  D('ban-hoc', 'Bàn học gỗ', 'floor', 2, 1, 2, 'tuoi-tho-9x', ['sach'], 380, 'market'),
  D('dong-ho-bao-thuc', 'Đồng hồ báo thức', 'floor', 1, 1, 1, 'tuoi-tho-9x', ['retro'], 150, 'market'),
  D('chau-cay', 'Chậu cây', 'floor', 1, 1, 2, 'rung', ['cay'], null, 'starter'),
  D('xuong-rong', 'Xương rồng', 'floor', 1, 1, 1, 'rung', ['cay'], 90, 'market'),
  D('cay-lon', 'Cây cổ thụ mini', 'floor', 1, 1, 3, 'rung', ['cay'], 1100, 'weekend', 'hiem'),
  D('vo-oc', 'Vỏ ốc khổng lồ', 'floor', 1, 1, 1, 'bien', [], 110, 'market'),
  D('hai-dang', 'Đèn hải đăng', 'floor', 1, 1, 2, 'bien', ['sang'], 420, 'rotating', 'dep'),
  D('den-long', 'Đèn lồng giấy', 'floor', 1, 1, 1, 'pho-cu', ['sang'], 220, 'market'),
  D('long-chim', 'Lồng chim', 'floor', 1, 1, 2, 'pho-cu', [], 260, 'market'),
  D('quat-may', 'Quạt máy', 'floor', 1, 1, 1, 'pho-cu', ['retro'], 200, 'market'),
  D('ghe-nhua', 'Ghế nhựa đỏ', 'floor', 1, 1, 1, 'pho-cu', [], 80, 'market'),
  D('bong', 'Bóng', 'floor', 1, 1, 1, null, ['choi'], null, 'starter'),
  D('cay-dao', 'Cây đào Tết', 'floor', 1, 1, 3, 'le-hoi', ['cay'], null, 'event', 'hiem'),
  D('den-ong-sao', 'Đèn ông sao', 'floor', 1, 1, 2, 'le-hoi', ['sang'], null, 'event', 'hiem'),
  // Thảm
  D('tham-tron', 'Thảm tròn xanh', 'rug', 4, 4, 1, null, ['mem'], null, 'starter'),
  D('tham-cat', 'Thảm cát', 'rug', 3, 2, 1, 'bien', [], 240, 'market'),
  D('tham-reu', 'Thảm rêu', 'rug', 3, 3, 2, 'rung', ['cay'], 300, 'market'),
  D('tham-ca-ro', 'Thảm ca rô', 'rug', 3, 3, 1, 'pastel', ['mem'], 180, 'market'),
  // Treo tường (rộng × cao)
  D('poster', 'Poster hoạt hình', 'wall', 1, 1, 1, 'tuoi-tho-9x', ['retro'], 150, 'market'),
  D('tranh-bien', 'Tranh biển', 'wall', 2, 1, 1, 'bien', [], 260, 'market'),
  D('dong-ho-treo', 'Đồng hồ gỗ', 'wall', 1, 1, 1, 'go-moc', [], 200, 'market'),
  D('ke-treo', 'Kệ treo tường', 'wall', 2, 1, 1, 'go-moc', ['sach'], 160, 'market'),
  D('to-chim', 'Tổ chim', 'wall', 1, 1, 1, 'rung', ['cay'], 140, 'market'),
  // Giấy dán tường & sàn
  D('giay-cham-hong', 'Giấy chấm hồng', 'wallpaper', 0, 0, 0, 'pastel', [], null, 'starter'),
  D('giay-soc-xanh', 'Giấy sọc xanh biển', 'wallpaper', 0, 0, 0, 'bien', [], 350, 'market'),
  D('giay-go', 'Ốp ván gỗ', 'wallpaper', 0, 0, 0, 'go-moc', [], 420, 'market'),
  D('giay-sao', 'Giấy sao đêm', 'wallpaper', 0, 0, 1, null, ['sang'], 500, 'rotating', 'dep'),
  D('san-go', 'Sàn gỗ', 'flooring', 0, 0, 0, 'go-moc', [], null, 'starter'),
  D('san-gach-bong', 'Gạch bông', 'flooring', 0, 0, 1, 'pho-cu', ['retro'], 480, 'rotating', 'dep'),
  D('san-co', 'Sàn cỏ', 'flooring', 0, 0, 1, 'rung', ['cay'], 400, 'market'),
  // Trang phục
  O('no-hong', 'Nơ hồng', 'head', [], null, 'starter'),
  O('mu-len', 'Mũ len', 'head', ['mem'], 220, 'market'),
  O('non-la', 'Nón lá mini', 'head', [], 260, 'market'),
  O('mu-tiec', 'Mũ sinh nhật', 'head', ['choi'], 180, 'market'),
  O('vong-hoa', 'Vòng hoa', 'head', ['cay'], 520, 'rotating', 'dep'),
  O('kinh-tron', 'Kính tròn', 'face', ['sach'], 240, 'market'),
  O('kinh-ram', 'Kính râm', 'face', ['sang'], 300, 'market'),
  O('khan-quang', 'Khăn quàng đỏ', 'neck', ['retro'], 120, 'market'),
  O('chuong', 'Chuông cổ', 'neck', ['choi'], 200, 'market'),
  O('khan-len', 'Khăn len', 'neck', ['mem'], 340, 'rotating', 'dep'),
  O('balo', 'Ba lô nhỏ', 'back', ['choi'], 380, 'market'),
  O('canh', 'Cánh thiên thần', 'back', ['sang'], 1200, 'weekend', 'hiem'),
  O('ao-choang', 'Áo choàng sao', 'back', ['sang'], 950, 'weekend', 'hiem'),
];

export const BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map(i => [i.id, i]));

export const THEMES: Record<Theme, string> = {
  'go-moc': 'Gỗ mộc', pastel: 'Pastel', 'tuoi-tho-9x': 'Tuổi thơ 9x', rung: 'Rừng', bien: 'Biển', 'pho-cu': 'Phố cũ', 'le-hoi': 'Lễ hội',
};
export const SET_LINES: Partial<Record<Theme, string>> = {
  'go-moc': 'Phòng ấm như nhà gỗ trên núi, mình ngủ ngon hẳn.',
  pastel: 'Phòng toàn màu kẹo, mình muốn nhảy múa quá!',
  'tuoi-tho-9x': 'Hồi xưa ai cũng mê mấy món này đó, bạn nhớ không?',
  rung: 'Sáng nay có chim ghé cửa sổ chào mình nè.',
  bien: 'Nghe như có tiếng sóng đâu đây…',
  'pho-cu': 'Tối rồi, nghe tiếng rao đêm là thèm ăn vặt ghê.',
};
export const TAGS: Record<Tag, string> = { mem: 'đồ êm', sach: 'sách vở', cay: 'cây cỏ', choi: 'đồ chơi', sang: 'đồ phát sáng', retro: 'đồ cổ điển' };
export const SLOTS: Record<Slot, string> = { head: 'Đầu', face: 'Mặt', neck: 'Cổ', back: 'Lưng' };
export const RARITY: Record<Rarity, string> = { thuong: 'Thường', dep: 'Đẹp', hiem: 'Hiếm', 'ky-niem': 'Kỷ niệm' };

/* ---------- Thức ăn ----------
 * Mua bằng xu ở tab "Thức ăn" trong cửa hàng, mỗi lần cho ăn dùng hết một phần.
 * Seed SQL (bảng items, kind = 'food') phải khớp: supabase/migrations/20261114000000_food_economy.sql, test kiểm tra. */
export type FoodGroup = 'tinhbot' | 'rau' | 'dam' | 'traicay' | 'ngot';
/** `healthy`: tính vào "ăn cân bằng" (xem nutrition.ts). Đồ ngọt thì không. */
export const FOOD_GROUPS: Record<FoodGroup, { name: string; healthy: boolean }> = {
  tinhbot: { name: 'Tinh bột', healthy: true }, rau: { name: 'Rau củ', healthy: true }, dam: { name: 'Đạm', healthy: true },
  traicay: { name: 'Trái cây', healthy: true }, ngot: { name: 'Đồ ngọt', healthy: false },
};
/** `kind` 'food': mua ở cửa hàng hoặc thu hoạch. 'dish': món nấu, không bán. `fresh`: thức ăn tươi, để lâu trong kho sẽ hỏng (xem FRIDGE). */
export interface Food { id: string; name: string; kind: 'food' | 'dish'; group: FoodGroup; group2?: FoodGroup; no: number; vui: number; price: number | null; fresh: boolean; line: string }
const FRESH_GROUPS: FoodGroup[] = ['rau', 'traicay', 'dam'];
const F = (id: string, name: string, group: FoodGroup, no: number, vui: number, price: number, line: string): Food & { price: number } =>
  ({ id, name, kind: 'food', group, no, vui, price, fresh: FRESH_GROUPS.includes(group), line });
export const FOODS: (Food & { price: number })[] = [
  F('comnam', 'Cơm nắm', 'tinhbot', 25, 3, 15, 'No bụng ghê, cảm ơn nha!'),
  F('bap-nuong', 'Bắp nướng', 'tinhbot', 22, 7, 22, 'Thơm lừng mùi bơ!'),
  F('banh-mi', 'Bánh mì', 'tinhbot', 28, 6, 32, 'Giòn tan, ngon ghê!'),
  F('carot', 'Cà rốt', 'rau', 10, 2, 12, 'Giòn giòn ngọt ngọt!'),
  F('canh-rau', 'Canh rau', 'rau', 16, 3, 18, 'Ấm bụng ghê!'),
  F('trung-op', 'Trứng ốp la', 'dam', 20, 4, 24, 'Béo béo thơm thơm!'),
  F('ca-vien', 'Cá viên chiên', 'dam', 14, 12, 30, 'Giòn rụm, nóng hổi!'),
  F('sua-chua', 'Sữa chua', 'dam', 12, 9, 20, 'Chua chua ngọt ngọt!'),
  F('chuoi', 'Chuối', 'traicay', 12, 5, 14, 'Chuối thơm quá trời!'),
  F('dua-hau', 'Dưa hấu', 'traicay', 14, 8, 20, 'Mát rượi, ngọt lịm!'),
  F('kem', 'Kem que', 'ngot', 5, 15, 22, 'Mát lạnh luôn!'),
  F('che', 'Chè đậu', 'ngot', 15, 12, 28, 'Ngọt lịm tim!'),
];

/* ---------- Món nấu (kind 'dish') ----------
 * Nấu từ hai nguyên liệu trong kho (mỗi thứ một phần). Mỗi món thuộc hai nhóm dinh dưỡng, nên dễ đạt "ăn cân bằng". */
const Dish = (id: string, name: string, group: FoodGroup, group2: FoodGroup, no: number, vui: number, line: string): Food =>
  ({ id, name, kind: 'dish', group, group2, no, vui, price: null, fresh: true, line });
export const DISHES: Food[] = [
  Dish('chao-trung', 'Cháo trứng', 'tinhbot', 'dam', 40, 10, 'Nóng hổi, béo ngậy!'),
  Dish('com-rau', 'Cơm rau', 'tinhbot', 'rau', 38, 8, 'Ăn xong khoẻ re!'),
  Dish('banh-mi-trung', 'Bánh mì trứng', 'tinhbot', 'dam', 45, 14, 'Thơm nức mũi luôn!'),
  Dish('sinh-to', 'Sinh tố chuối', 'traicay', 'dam', 24, 22, 'Mịn mịn, ngọt thanh!'),
  Dish('salad', 'Salad trái cây', 'rau', 'traicay', 22, 18, 'Tươi rói, giòn tan!'),
  Dish('che-trai-cay', 'Chè trái cây', 'ngot', 'traicay', 26, 28, 'Mát lịm, ngon hết sảy!'),
  Dish('com-chien-rau', 'Cơm chiên rau củ', 'tinhbot', 'rau', 36, 9, 'Thơm lừng, hạt cơm tơi xốp!'),
  Dish('banh-mi-ca-vien', 'Bánh mì cá viên', 'tinhbot', 'dam', 40, 20, 'Nóng giòn, nhai sướng răng!'),
  Dish('bap-xao-trung', 'Bắp xào trứng', 'tinhbot', 'dam', 38, 12, 'Ngọt bùi, béo thơm!'),
  Dish('canh-trung', 'Canh trứng rau', 'rau', 'dam', 30, 8, 'Ấm bụng, dễ ăn ghê!'),
  Dish('sua-chua-dua', 'Sữa chua dưa hấu', 'dam', 'traicay', 24, 22, 'Mát chua ngọt, đã quá!'),
  Dish('kem-chuoi', 'Kem chuối', 'ngot', 'traicay', 18, 30, 'Lạnh tê răng mà mê!'),
  Dish('che-bap', 'Chè bắp', 'ngot', 'tinhbot', 32, 22, 'Dẻo thơm, ngọt dịu!'),
  Dish('banh-flan', 'Bánh flan', 'dam', 'ngot', 20, 26, 'Mềm mịn, tan trong miệng!'),
  Dish('ca-vien-rau', 'Cá viên xào rau', 'dam', 'rau', 30, 16, 'Giòn giòn, đủ vị!'),
  Dish('chuoi-nuong', 'Chuối nướng', 'traicay', 'tinhbot', 30, 18, 'Thơm khói, ngọt lịm!'),
];
export interface Recipe { id: string; dish: string; a: string; b: string }
export const RECIPES: Recipe[] = [
  { id: 'chao-trung', dish: 'chao-trung', a: 'comnam', b: 'trung-op' },
  { id: 'com-rau', dish: 'com-rau', a: 'comnam', b: 'canh-rau' },
  { id: 'banh-mi-trung', dish: 'banh-mi-trung', a: 'banh-mi', b: 'trung-op' },
  { id: 'sinh-to', dish: 'sinh-to', a: 'chuoi', b: 'sua-chua' },
  { id: 'salad', dish: 'salad', a: 'carot', b: 'dua-hau' },
  { id: 'che-trai-cay', dish: 'che-trai-cay', a: 'che', b: 'dua-hau' },
  { id: 'com-chien-rau', dish: 'com-chien-rau', a: 'comnam', b: 'carot' },
  { id: 'banh-mi-ca-vien', dish: 'banh-mi-ca-vien', a: 'banh-mi', b: 'ca-vien' },
  { id: 'bap-xao-trung', dish: 'bap-xao-trung', a: 'bap-nuong', b: 'trung-op' },
  { id: 'canh-trung', dish: 'canh-trung', a: 'canh-rau', b: 'trung-op' },
  { id: 'sua-chua-dua', dish: 'sua-chua-dua', a: 'sua-chua', b: 'dua-hau' },
  { id: 'kem-chuoi', dish: 'kem-chuoi', a: 'kem', b: 'chuoi' },
  { id: 'che-bap', dish: 'che-bap', a: 'che', b: 'bap-nuong' },
  { id: 'banh-flan', dish: 'banh-flan', a: 'trung-op', b: 'sua-chua' },
  { id: 'ca-vien-rau', dish: 'ca-vien-rau', a: 'ca-vien', b: 'canh-rau' },
  { id: 'chuoi-nuong', dish: 'chuoi-nuong', a: 'chuoi', b: 'bap-nuong' },
];
/** Mọi thứ bé ăn được: thức ăn mua + món nấu. */
export const EDIBLES: Food[] = [...FOODS, ...DISHES];
export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(EDIBLES.map(f => [f.id, f]));

/* ---------- Vườn rau: gieo hạt, đợi thật vài giờ, thu hoạch được 3 phần ---------- */
export interface Crop { id: string; hours: number; seed: number; yield: number }
export const CROPS: Crop[] = [
  { id: 'carot', hours: 4, seed: 5, yield: 3 },
  { id: 'bap-nuong', hours: 6, seed: 6, yield: 3 },
  { id: 'chuoi', hours: 8, seed: 8, yield: 3 },
  { id: 'dua-hau', hours: 10, seed: 10, yield: 3 },
];
export const GARDEN_PLOTS = 4;

/* ---------- Tủ lạnh và thức ăn hỏng ----------
 * Thức ăn tươi (fresh) mỗi ngày hỏng một phần số dư trên mức giữ được. Mua tủ lạnh lớn hơn để giữ được nhiều hơn.
 * Thức ăn khô (tinh bột, đồ ngọt) không bao giờ hỏng. */
export const FRIDGE = [{ keep: 3, price: 0 }, { keep: 6, price: 200 }, { keep: 10, price: 500 }] as const;
/** Số phần hỏng sau một ngày: 1/4 phần vượt mức giữ, làm tròn lên. Giống private.spoil_loss(). */
export const spoilLoss = (qty: number, keep: number) => (qty > keep ? Math.ceil((qty - keep) / 4) : 0);
export const FOOD_STOCK = {
  start: 2,            // mỗi món bé mới được tặng 2 phần để thử và tìm món tủ
  max: 30,             // giữ tối đa 30 phần mỗi món
  packMax: 10,         // mua tối đa 10 phần một lần
  rationId: 'comnam', ration: 3, // suất ăn miễn phí mỗi ngày: 3 Cơm nắm, để bé không bao giờ đói vì hết xu
} as const;

/* ---------- Lưới phòng ---------- */
export const GRID = { cols: 8, rows: 6, cell: 1, x0: -4, z0: -3.3, wallRows: 3, wallY0: 1.0 } as const;
/** Ô dành cho thú (không đặt nội thất), lối ra phía trước là hàng cuối. */
export const PET_ZONE = [[3, 3], [4, 3], [3, 4], [4, 4]] as const;
/** Ô tường bị cửa sổ chiếm. */
export const WINDOW_CELLS = [[4, 1], [5, 1], [6, 1], [4, 2], [5, 2], [6, 2]] as const;

export interface Placed { id: string; c: number; r: number; rot: number }
export interface Layout { wallpaper: string; flooring: string; items: Placed[] }

export const DEFAULT_LAYOUT: Layout = {
  wallpaper: 'giay-cham-hong', flooring: 'san-go',
  items: [
    { id: 'tham-tron', c: 2, r: 2, rot: 0 },
    { id: 'o-rom', c: 0, r: 0, rot: 0 },
    { id: 'chau-cay', c: 7, r: 0, rot: 0 },
    { id: 'bong', c: 6, r: 4, rot: 0 },
  ],
};
export const STARTER_ITEMS = ITEMS.filter(i => i.source === 'starter').map(i => i.id);
