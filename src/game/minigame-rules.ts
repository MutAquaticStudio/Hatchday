/** Luật mini-game (thuần, có test): Bắt bướm và Pha trà. Điểm tối đa và xu khớp world-activity.ts / máy chủ. */
import { MINI } from './world-activity';

export const BUTTERFLY = { seconds: MINI.butterfly.seconds, target: MINI.butterfly.max, onScreen: 5, hitRadius: 30 } as const;

/** Năm bước pha trà. Vùng xanh hẹp dần và thanh chạy nhanh dần. */
export const BREW_STEPS = [
  { id: 'boil', label: 'Đun nước', hint: 'Dừng khi nước sôi vừa tới', zone: 0.30, speed: 0.55 },
  { id: 'leaf', label: 'Chọn lá trà', hint: 'Dừng ở lượng lá vừa đủ', zone: 0.26, speed: 0.68 },
  { id: 'steep', label: 'Ủ trà', hint: 'Dừng khi trà vừa thơm', zone: 0.22, speed: 0.82 },
  { id: 'pour', label: 'Rót trà', hint: 'Dừng khi chén đầy vừa', zone: 0.19, speed: 0.98 },
  { id: 'honey', label: 'Thêm mật ong', hint: 'Một chút thôi nha', zone: 0.16, speed: 1.15 },
] as const;
export const BREW_STARS = BREW_STEPS.length;

/** Vị trí thanh chạy (0–1) tại thời điểm t giây: đi qua lại đều. `phase` lệch pha để mỗi lượt không giống nhau. */
export function markerAt(t: number, speed: number, phase = 0): number {
  const p = (t * speed + phase) % 2;
  return p < 1 ? p : 2 - p;
}
/** Vùng xanh có tâm center (0–1) và bề rộng zone; trúng nếu thanh nằm trong vùng. */
export const inZone = (pos: number, center: number, zone: number) => Math.abs(pos - center) <= zone / 2;
/** Tâm vùng xanh luôn nằm trọn trong thanh. */
export const zoneCenter = (zone: number, r: number) => zone / 2 + 0.04 + r * (1 - zone - 0.08);
/** Điểm gửi máy chủ: số sao (0–5). */
export const brewScore = (hits: boolean[]) => Math.max(0, Math.min(BREW_STARS, hits.filter(Boolean).length));
/** Điểm gửi máy chủ cho Bắt bướm: số con bắt được, tối đa BUTTERFLY.target. */
export const butterflyScore = (caught: number) => Math.max(0, Math.min(BUTTERFLY.target, Math.floor(caught)));

/* ---------------- 5 trò mới (điểm tối đa khớp MINI / máy chủ) ---------------- */
const clampScore = (k: keyof typeof MINI, n: number) => Math.max(0, Math.min((MINI[k] as { max: number }).max, Math.floor(n)));
/** Số ngẫu nhiên có hạt giống (mulberry32): cùng hạt giống ra cùng dãy, để test và chia bài công bằng. */
export function seeded(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffled<T>(arr: readonly T[], rnd: () => number): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Câu cá (ao Công viên): thả câu, chờ phao chìm rồi giật đúng lúc. Cửa sổ giật hẹp dần theo số cá đã câu. */
export const FISH = { seconds: MINI.fish.seconds, target: MINI.fish.max, waitMin: 1200, waitMax: 3600, bite: 950, biteMin: 520 } as const;
export const fishBiteWindow = (caught: number) => Math.max(FISH.biteMin, FISH.bite - Math.max(0, caught) * 55);
export const fishScore = (n: number) => clampScore('fish', n);

/** Đố vui (Thư viện): 5 câu, 4 lựa chọn, 12 giây mỗi câu. `c` là chỉ số đáp án đúng trong `a`. */
export const QUIZ = { questions: MINI.quiz.max, seconds: 12 } as const;
export const QUIZ_BANK: readonly { q: string; a: readonly string[]; c: number }[] = [
  { q: 'Thanh Năng lượng của bé thấp thì nên làm gì?', a: ['Cho bé đi ngủ', 'Cho bé ăn kẹo', 'Tắm cho bé', 'Cho bé chạy nhảy'], c: 0 },
  { q: 'Ở Hatchday, mua thuốc cho bé ở đâu?', a: ['Bệnh viện', 'Thư viện', 'Tiệm may', 'Công viên'], c: 0 },
  { q: 'Cá sống ở đâu?', a: ['Dưới nước', 'Trên cây', 'Trong cát', 'Trên mây'], c: 0 },
  { q: 'Con vật nào biết bay?', a: ['Chim bồ câu', 'Cá vàng', 'Con mèo', 'Con rùa'], c: 0 },
  { q: 'Mặt trời mọc ở hướng nào?', a: ['Hướng Đông', 'Hướng Tây', 'Hướng Nam', 'Hướng Bắc'], c: 0 },
  { q: 'Một tuần có mấy ngày?', a: ['7 ngày', '5 ngày', '6 ngày', '8 ngày'], c: 0 },
  { q: 'Tết Trung thu, các bé thường rước gì?', a: ['Đèn ông sao', 'Cây thông', 'Quả bí ngô', 'Trứng màu'], c: 0 },
  { q: 'Cầu vồng có mấy màu?', a: ['7 màu', '5 màu', '6 màu', '9 màu'], c: 0 },
  { q: 'Củ cà rốt thường có màu gì?', a: ['Màu cam', 'Màu tím', 'Màu xanh dương', 'Màu đen'], c: 0 },
  { q: 'Muốn nhâm nhi trà thì ghé đâu?', a: ['Tiệm trà', 'Chợ Xanh', 'Bệnh viện', 'Tiệm may'], c: 0 },
  { q: 'Muốn bé sạch sẽ thì làm gì?', a: ['Tắm cho bé', 'Cho bé ngủ', 'Đá bóng', 'Đọc sách'], c: 0 },
  { q: 'Con ong làm ra gì?', a: ['Mật ong', 'Sữa', 'Trứng', 'Len'], c: 0 },
  { q: 'Con gì kêu "quác quác"?', a: ['Con vịt', 'Con mèo', 'Con chó', 'Con bò'], c: 0 },
  { q: 'Mùa nào thường lạnh nhất?', a: ['Mùa đông', 'Mùa hè', 'Mùa xuân', 'Mùa thu'], c: 0 },
  { q: '2 + 3 bằng mấy?', a: ['5', '4', '6', '23'], c: 0 },
  { q: 'Tết Nguyên Đán, các bé thường được nhận gì?', a: ['Bao lì xì', 'Bánh trung thu', 'Kẹo bí ngô', 'Trứng màu'], c: 0 },
  { q: 'Lá cây thường có màu gì?', a: ['Xanh lá', 'Hồng', 'Tím', 'Đen'], c: 0 },
  { q: 'Cây cần gì để lớn?', a: ['Nước và ánh nắng', 'Kẹo ngọt', 'Quả bóng', 'Đồng hồ'], c: 0 },
  { q: 'Đồng hồ lớn ở Quảng trường nằm trên gì?', a: ['Tháp đồng hồ', 'Đài phun nước', 'Sân khấu', 'Cây cầu'], c: 0 },
  { q: 'Bé bị ốm thì nên làm gì?', a: ['Đưa bé đi khám', 'Cho bé ăn thật nhiều kẹo', 'Cho bé chạy thật nhiều', 'Để bé một mình'], c: 0 },
  { q: 'Con bướm có mấy cánh?', a: ['4 cánh', '2 cánh', '6 cánh', '8 cánh'], c: 0 },
  { q: 'Con nhện có mấy chân?', a: ['8 chân', '6 chân', '4 chân', '10 chân'], c: 0 },
  { q: 'Kem để ngoài nắng lâu sẽ thế nào?', a: ['Tan chảy', 'Cứng lại', 'To ra', 'Đổi màu xanh'], c: 0 },
  { q: 'Ăn quá nhiều đồ ngọt dễ bị gì?', a: ['Sâu răng', 'Cao vọt lên', 'Biết bay', 'Mắt đổi màu'], c: 0 },
  { q: 'Ở Chợ Xanh, sạp nào bán cá?', a: ['Cá tươi', 'Đồ gốm', 'Hoa tươi', 'Đèn lồng'], c: 0 },
  { q: 'Ngày Quốc tế Thiếu nhi là ngày nào?', a: ['1 tháng 6', '2 tháng 9', '8 tháng 3', '20 tháng 11'], c: 0 },
  { q: 'Con gì có cái vòi rất dài?', a: ['Con voi', 'Con thỏ', 'Con gà', 'Con cá'], c: 0 },
  { q: 'Nước đông lại thành gì?', a: ['Nước đá', 'Hơi nước', 'Cát', 'Mây'], c: 0 },
  { q: 'Bé thú ngủ ở phòng nào?', a: ['Phòng ngủ', 'Nhà bếp', 'Nhà tắm', 'Vườn'], c: 0 },
  { q: 'Ánh sáng ban đêm trên trời là gì?', a: ['Mặt trăng và sao', 'Cầu vồng', 'Mặt trời', 'Đèn giao thông'], c: 0 },
];
/** Chọn n câu không trùng, xáo thứ tự đáp án; `c` là chỉ số đáp án đúng sau khi xáo. */
export function pickQuiz(seed: number, n: number = QUIZ.questions) {
  const rnd = seeded(seed);
  return shuffled(QUIZ_BANK, rnd).slice(0, n).map(x => { const order = shuffled(x.a.map((_, i) => i), rnd); return { q: x.q, a: order.map(i => x.a[i]), c: order.indexOf(x.c) }; });
}
export const quizScore = (correct: number) => clampScore('quiz', correct);

/** Giao hàng (Chợ Xanh): nhớ sạp nào bán gì (xem 3 giây rồi úp), giao đúng 6 đơn trong 45 giây; sai bị trừ 3 giây. */
export const DELIVERY = { seconds: MINI.delivery.seconds, target: MINI.delivery.max, preview: 3000, penalty: 3 } as const;
export const DELIVERY_STALLS = [
  { id: 'veg', name: 'Rau quả', icon: '🥕' }, { id: 'flower', name: 'Hoa tươi', icon: '🌷' }, { id: 'bakery', name: 'Bánh trái', icon: '🥐' },
  { id: 'fish', name: 'Cá tươi', icon: '🐟' }, { id: 'pottery', name: 'Đồ gốm', icon: '🏺' }, { id: 'lantern', name: 'Đèn lồng', icon: '🏮' },
] as const;
/** Thứ tự đơn hàng: mỗi sạp xuất hiện đúng một lần (6 đơn), xáo theo hạt giống. */
export const deliveryOrders = (seed: number) => shuffled(DELIVERY_STALLS.map(s => s.id), seeded(seed));
export const deliveryScore = (n: number) => clampScore('delivery', n);

/** Nhảy theo nhịp (sân khấu Quảng trường): 20 nốt rơi xuống 3 làn; chạm đúng làn khi nốt chạm vạch (±0,16 giây). */
export const RHYTHM = { notes: MINI.rhythm.max, lanes: 3, fall: 1.6, window: 0.16, gapMin: 0.62, gapMax: 1.05, lead: 1.2 } as const;
export function rhythmChart(seed: number) {
  const rnd = seeded(seed), out: { t: number; lane: number }[] = []; let t = RHYTHM.lead + RHYTHM.fall, last = -1;
  for (let i = 0; i < RHYTHM.notes; i++) {
    let lane = Math.floor(rnd() * RHYTHM.lanes); if (lane === last && rnd() < 0.6) lane = (lane + 1) % RHYTHM.lanes;
    out.push({ t: +t.toFixed(3), lane }); last = lane; t += RHYTHM.gapMin + rnd() * (RHYTHM.gapMax - RHYTHM.gapMin);
  }
  return out;
}
/** Nốt nào (chưa chạm) trong làn `lane` được tính trúng ở thời điểm `now`; -1 nếu không có. */
export function rhythmHit(chart: readonly { t: number; lane: number }[], done: readonly boolean[], lane: number, now: number): number {
  let best = -1, bestD = Infinity;
  chart.forEach((n, i) => { if (done[i] || n.lane !== lane) return; const d = Math.abs(n.t - now); if (d <= RHYTHM.window && d < bestD) { best = i; bestD = d; } });
  return best;
}
export const rhythmScore = (hits: number) => clampScore('rhythm', hits);

/** Bắt sâu (Vườn): sâu ló ra trên 9 chiếc lá, chạm để bắt; bọ rùa là bạn, chạm nhầm bị trừ 1. */
export const BUGS = { seconds: MINI.bugs.seconds, target: MINI.bugs.max, cells: 9, showStart: 1100, showEnd: 650, ladybug: 0.22 } as const;
/** Thời gian sâu ló ra (ms), ngắn dần theo thời gian đã chơi (0–1). */
export const bugShowMs = (progress: number) => Math.round(BUGS.showStart - (BUGS.showStart - BUGS.showEnd) * Math.max(0, Math.min(1, progress)));
export const bugsScore = (n: number) => clampScore('bugs', n);
