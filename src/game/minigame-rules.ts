/** Luật mini-game (thuần, có test): Bắt bướm và Pha trà. Điểm tối đa và xu khớp world-activity.ts / máy chủ. */
import { _t } from '../i18n';
import { MINI } from './world-activity';

export const BUTTERFLY = { seconds: MINI.butterfly.seconds, target: MINI.butterfly.max, onScreen: 5, hitRadius: 30 } as const;

/** Năm bước pha trà. Vùng xanh hẹp dần và thanh chạy nhanh dần. */
export const BREW_STEPS = [
  { id: 'boil', label: _t('Đun nước'), hint: _t('Dừng khi nước sôi vừa tới'), zone: 0.30, speed: 0.55 },
  { id: 'leaf', label: _t('Chọn lá trà'), hint: _t('Dừng ở lượng lá vừa đủ'), zone: 0.26, speed: 0.68 },
  { id: 'steep', label: _t('Ủ trà'), hint: _t('Dừng khi trà vừa thơm'), zone: 0.22, speed: 0.82 },
  { id: 'pour', label: _t('Rót trà'), hint: _t('Dừng khi chén đầy vừa'), zone: 0.19, speed: 0.98 },
  { id: 'honey', label: _t('Thêm mật ong'), hint: _t('Một chút thôi nha'), zone: 0.16, speed: 1.15 },
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
  { q: _t('Thanh Năng lượng của bé thấp thì nên làm gì?'), a: [_t('Cho bé đi ngủ'), _t('Cho bé ăn kẹo'), _t('Tắm cho bé'), _t('Cho bé chạy nhảy')], c: 0 },
  { q: _t('Ở Hatchday, mua thuốc cho bé ở đâu?'), a: [_t('Bệnh viện'), _t('Thư viện'), _t('Tiệm may'), _t('Công viên')], c: 0 },
  { q: _t('Cá sống ở đâu?'), a: [_t('Dưới nước'), _t('Trên cây'), _t('Trong cát'), _t('Trên mây')], c: 0 },
  { q: _t('Con vật nào biết bay?'), a: [_t('Chim bồ câu'), _t('Cá vàng'), _t('Con mèo'), _t('Con rùa')], c: 0 },
  { q: _t('Mặt trời mọc ở hướng nào?'), a: [_t('Hướng Đông'), _t('Hướng Tây'), _t('Hướng Nam'), _t('Hướng Bắc')], c: 0 },
  { q: _t('Một tuần có mấy ngày?'), a: [_t('7 ngày'), _t('5 ngày'), _t('6 ngày'), _t('8 ngày')], c: 0 },
  { q: _t('Tết Trung thu, các bé thường rước gì?'), a: [_t('Đèn ông sao'), _t('Cây thông'), _t('Quả bí ngô'), _t('Trứng màu')], c: 0 },
  { q: _t('Cầu vồng có mấy màu?'), a: [_t('7 màu'), _t('5 màu'), _t('6 màu'), _t('9 màu')], c: 0 },
  { q: _t('Củ cà rốt thường có màu gì?'), a: [_t('Màu cam'), _t('Màu tím'), _t('Màu xanh dương'), _t('Màu đen')], c: 0 },
  { q: _t('Muốn nhâm nhi trà thì ghé đâu?'), a: [_t('Tiệm trà'), _t('Chợ Xanh'), _t('Bệnh viện'), _t('Tiệm may')], c: 0 },
  { q: _t('Muốn bé sạch sẽ thì làm gì?'), a: [_t('Tắm cho bé'), _t('Cho bé ngủ'), _t('Đá bóng'), _t('Đọc sách')], c: 0 },
  { q: _t('Con ong làm ra gì?'), a: [_t('Mật ong'), _t('Sữa'), _t('Trứng'), 'Len'], c: 0 },
  { q: _t('Con gì kêu "quác quác"?'), a: [_t('Con vịt'), _t('Con mèo'), _t('Con chó'), _t('Con bò')], c: 0 },
  { q: _t('Mùa nào thường lạnh nhất?'), a: [_t('Mùa đông'), _t('Mùa hè'), _t('Mùa xuân'), _t('Mùa thu')], c: 0 },
  { q: _t('2 + 3 bằng mấy?'), a: ['5', '4', '6', '23'], c: 0 },
  { q: _t('Tết Nguyên Đán, các bé thường được nhận gì?'), a: [_t('Bao lì xì'), _t('Bánh trung thu'), _t('Kẹo bí ngô'), _t('Trứng màu')], c: 0 },
  { q: _t('Lá cây thường có màu gì?'), a: [_t('Xanh lá'), _t('Hồng'), _t('Tím'), _t('Đen')], c: 0 },
  { q: _t('Cây cần gì để lớn?'), a: [_t('Nước và ánh nắng'), _t('Kẹo ngọt'), _t('Quả bóng'), _t('Đồng hồ')], c: 0 },
  { q: _t('Đồng hồ lớn ở Quảng trường nằm trên gì?'), a: [_t('Tháp đồng hồ'), _t('Đài phun nước'), _t('Sân khấu'), _t('Cây cầu')], c: 0 },
  { q: _t('Bé bị ốm thì nên làm gì?'), a: [_t('Đưa bé đi khám'), _t('Cho bé ăn thật nhiều kẹo'), _t('Cho bé chạy thật nhiều'), _t('Để bé một mình')], c: 0 },
  { q: _t('Con bướm có mấy cánh?'), a: [_t('4 cánh'), _t('2 cánh'), _t('6 cánh'), _t('8 cánh')], c: 0 },
  { q: _t('Con nhện có mấy chân?'), a: [_t('8 chân'), _t('6 chân'), _t('4 chân'), _t('10 chân')], c: 0 },
  { q: _t('Kem để ngoài nắng lâu sẽ thế nào?'), a: [_t('Tan chảy'), _t('Cứng lại'), 'To ra', _t('Đổi màu xanh')], c: 0 },
  { q: _t('Ăn quá nhiều đồ ngọt dễ bị gì?'), a: [_t('Sâu răng'), _t('Cao vọt lên'), _t('Biết bay'), _t('Mắt đổi màu')], c: 0 },
  { q: _t('Ở Chợ Xanh, sạp nào bán cá?'), a: [_t('Cá tươi'), _t('Đồ gốm'), _t('Hoa tươi'), _t('Đèn lồng')], c: 0 },
  { q: _t('Ngày Quốc tế Thiếu nhi là ngày nào?'), a: [_t('1 tháng 6'), _t('2 tháng 9'), _t('8 tháng 3'), _t('20 tháng 11')], c: 0 },
  { q: _t('Con gì có cái vòi rất dài?'), a: ['Con voi', _t('Con thỏ'), _t('Con gà'), _t('Con cá')], c: 0 },
  { q: _t('Nước đông lại thành gì?'), a: [_t('Nước đá'), _t('Hơi nước'), _t('Cát'), _t('Mây')], c: 0 },
  { q: _t('Bé ngủ ở phòng nào?'), a: [_t('Phòng ngủ'), _t('Nhà bếp'), _t('Nhà tắm'), _t('Vườn')], c: 0 },
  { q: _t('Ánh sáng ban đêm trên trời là gì?'), a: [_t('Mặt trăng và sao'), _t('Cầu vồng'), _t('Mặt trời'), _t('Đèn giao thông')], c: 0 },
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
  { id: 'veg', name: _t('Rau quả'), icon: '🥕' }, { id: 'flower', name: _t('Hoa tươi'), icon: '🌷' }, { id: 'bakery', name: _t('Bánh trái'), icon: '🥐' },
  { id: 'fish', name: _t('Cá tươi'), icon: '🐟' }, { id: 'pottery', name: _t('Đồ gốm'), icon: '🏺' }, { id: 'lantern', name: _t('Đèn lồng'), icon: '🏮' },
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
