// Hướng dẫn lần đầu chơi (~30 giây): 5 bước, mỗi bước chờ người chơi làm thật rồi tự sang bước sau.
// Thẻ nằm ở trên cùng và không chặn thao tác; nút cần bấm được khoanh sáng. Có nút Bỏ qua, và xem lại được trong bảng Chỉ số.
// Trạng thái "đã xem" lưu ở localStorage 'hatchday-tour' (một lần cho cả trình duyệt, thú đời sau không phải xem lại).
import { S } from './store';
import { dayRec } from './diary.js';
import { $ } from './dom.js';
import { milestone } from '../lib/telemetry';

const KEY = 'hatchday-tour';
const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const write = on => { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* bỏ qua */ } };

/** Mỗi bước: lời hướng dẫn, nút cần khoanh sáng, `base()` ghi mốc lúc bắt đầu bước, `done(mốc)` là điều kiện xong. */
export const TOUR_STEPS = [
  { text: 'Chào bạn! Hãy vuốt lên bé vài lần để vuốt ve nhé.', target: null, base: () => dayRec().pet || 0, done: b => (dayRec().pet || 0) - b >= 3 },
  { text: 'Bé có thể đói bất cứ lúc nào. Bấm nút Ăn để vào bếp.', target: 'a-eat', done: () => !$('tray').hidden },
  { text: 'Kéo món ăn vào bé, hoặc chạm vào món. Mỗi lần ăn dùng hết một phần trong kho.', target: 'tray', base: () => dayRec().fed || 0, done: b => (dayRec().fed || 0) > b },
  { text: 'Bấm Nhà để mua đồ, trang trí và làm nhiệm vụ kiếm xu.', target: 'a-house', done: () => !!$('house') && !$('house').hidden },
  { text: 'Bấm Chỉ số để xem bé cần gì. Chỉ số giảm theo giờ thật, kể cả khi bạn đóng trang.', target: 'btn-stats', done: () => !$('stats').hidden, last: true },
];

/** `c`: { isBusy } nếu cần hoãn (ví dụ đang xem cảnh khác). Trả về { start } để mở lại hướng dẫn. */
export function initTour(c = {}) {
  let card = null, step = -1, base = 0, timer = 0, hl = null, pressed = false;
  const clearHl = () => { hl?.classList.remove('tour-hl'); hl = null; };
  function stop(done) {
    clearInterval(timer); timer = 0; clearHl(); card?.remove(); card = null; step = -1;
    if (done) write(true);
  }
  function show(i) {
    step = i; pressed = false; const s = TOUR_STEPS[i]; base = s.base ? s.base() : 0; clearHl();
    if (s.target) { hl = $(s.target); hl?.classList.add('tour-hl'); }
    if (!card) { card = document.createElement('div'); card.className = 'tour'; card.setAttribute('role', 'status'); card.setAttribute('aria-live', 'polite'); $('app').appendChild(card); }
    card.innerHTML = `<div class="tour-step">Hướng dẫn ${i + 1}/${TOUR_STEPS.length}</div><p>${s.text}</p>
      <div class="tour-act"><button type="button" class="tour-skip" data-tour="skip">Bỏ qua</button>${s.last ? '<button type="button" class="btn-sm" data-tour="finish">Đã hiểu</button>' : ''}</div>`;
  }
  function tick() {
    if (step < 0) return;
    const s = TOUR_STEPS[step];
    const ok = s.done(base) || pressed; // bấm đúng nút là tính xong, kể cả khi bảng đã đóng lại trước lần kiểm tra kế tiếp
    if (!s.last && ok) { if (step + 1 < TOUR_STEPS.length) show(step + 1); }
    else if (s.last && ok && !card.dataset.ready) { card.dataset.ready = '1'; card.querySelector('p').textContent = 'Hay lắm! Chỉ số bé hiện ở đây. Chúc bạn và bé vui nhé.'; clearHl(); }
  }
  $('app').addEventListener('click', e => {
    const b = e.target.closest('[data-tour]');
    if (b) { milestone(b.dataset.tour === 'skip' ? 'tour_skipped' : 'tour_done'); stop(true); return; }
    const t = step >= 0 && TOUR_STEPS[step].target;
    if (t && t !== 'tray' && e.target.closest('#' + t)) pressed = true;
  }, true);
  function start() {
    stop(false); show(0); timer = setInterval(tick, 350);
  }
  $('btn-tour')?.addEventListener('click', () => { write(false); start(); }); // bảng Cài đặt tự đóng khi bấm nút này
  if (!read() && !new URLSearchParams(location.search).has('fitcheck')) {
    // chờ lời chào đầu tiên xong; bé đang ngủ thì thôi, lần sau mở game sẽ hiện
    setTimeout(() => { if (!S.asleep && !c.isBusy?.() && !read()) start(); }, 5000);
  }
  return { start, stop: () => stop(false) };
}
